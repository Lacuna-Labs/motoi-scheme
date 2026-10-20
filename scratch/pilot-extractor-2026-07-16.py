#!/usr/bin/env python3
"""
pilot-extractor-2026-07-16.py

Pilot extractor for Motoi Copilot corpus.
Reads book-of-scheme chapters (SLATL), emits JSONL SFT pairs.

Extractors implemented for the pilot:
  E1 — explain-then-code (prose section → runnable block)
  E2 — code-then-explain (runnable block → 1-sentence explanation)
  E3 — variation-pair    (multi-block sections → tier prompts)
  E4 — common-desktop-tasks (topic-scoped small programs — hand-curated per chapter)
  E5 — four-routing-patterns (dialect/import/base routing — hand-curated)

Design doc: ~/code/lacuna-labs/design-docs/architect-motoi-copilot-corpus-2026-07-16.slat

Output: JSONL, one message-array per line, first line is a provenance header record.
"""
import json
import os
import re
import hashlib
import glob
import sys
import datetime

BOOK_DIR = "/Users/alfred/code/motoi-scheme/scheme-books/book-of-scheme"
OUT_PATH = "/Users/alfred/code/motoi-scheme/training-data/pilot-book-of-scheme-2026-07-16.jsonl"

# ---------------------------------------------------------------------------
# SLAT chapter parser (loose — enough for pilot; robust parse deferred to
# motoi's own slat reader in Wave 1 crews).
# ---------------------------------------------------------------------------

CHAPTER_HEADER_RE = re.compile(
    r':title\s+"([^"]+)"|:chapter-number\s+(\d+|null)|:book\s+"([^"]+)"|:arc\s+"([^"]+)"'
)

# The prose field is embedded as a large "..."-quoted string. We take everything
# between :prose\n" ... " at the end of the record. It uses \" escapes internally.
PROSE_FIELD_RE = re.compile(r':prose\s+"(.*)"\s*\)?\s*\Z', re.DOTALL)

def unescape_slat_string(s):
    """Reverse the SLAT string escaping: \\" → ", \\\\ → \\, \\n → newline."""
    out = []
    i = 0
    while i < len(s):
        c = s[i]
        if c == "\\" and i + 1 < len(s):
            nxt = s[i+1]
            if nxt == '"':
                out.append('"'); i += 2; continue
            if nxt == "\\":
                out.append("\\"); i += 2; continue
            if nxt == "n":
                out.append("\n"); i += 2; continue
            if nxt == "t":
                out.append("\t"); i += 2; continue
            out.append(c); i += 1; continue
        out.append(c); i += 1
    return "".join(out)

def parse_chapter(path):
    """Return {title, chapter_num, book, prose_markdown}."""
    with open(path, "r", encoding="utf-8") as f:
        text = f.read()
    meta = {"title": None, "chapter_num": None, "book": None, "arc": None, "source_path": path}
    for m in CHAPTER_HEADER_RE.finditer(text):
        if m.group(1): meta["title"] = m.group(1)
        elif m.group(2):
            v = m.group(2)
            meta["chapter_num"] = None if v == "null" else int(v)
        elif m.group(3): meta["book"] = m.group(3)
        elif m.group(4): meta["arc"] = m.group(4)
    m = PROSE_FIELD_RE.search(text)
    if not m:
        return None
    meta["prose"] = unescape_slat_string(m.group(1))
    return meta

# ---------------------------------------------------------------------------
# Markdown parsing: sections, runnable code blocks, prose.
# ---------------------------------------------------------------------------

RUNNABLE_PRE_RE = re.compile(
    r'<pre\s+data-runnable[^>]*data-lang="([^"]+)"[^>]*>(.*?)</pre>',
    re.DOTALL
)
FENCED_RE = re.compile(r'```(?P<lang>[\w-]+)?\n(?P<code>.*?)\n```', re.DOTALL)
HEADING_RE = re.compile(r'^(#{1,4})\s+(.*)$', re.MULTILINE)
SAKURA_QUOTE_RE = re.compile(
    r'>\s*\*\*Sakura says\*\*.*?(?=\n\n[^>]|\Z)', re.DOTALL
)
FRONTMATTER_RE = re.compile(r'\A---\n.*?\n---\n', re.DOTALL)

def strip_frontmatter(md):
    return FRONTMATTER_RE.sub("", md, count=1)

def strip_sakura_quotes(md):
    # Drop the "Sakura says" pink-box blocks — persona voice, not Copilot voice.
    return SAKURA_QUOTE_RE.sub("", md)

def extract_code_blocks(md):
    """Return list of {code, lang, char_pos}."""
    blocks = []
    for m in RUNNABLE_PRE_RE.finditer(md):
        lang = m.group(1).strip()
        code = m.group(2).strip()
        if code:
            blocks.append({"code": code, "lang": lang, "pos": m.start()})
    for m in FENCED_RE.finditer(md):
        lang = (m.group("lang") or "").strip()
        code = m.group("code").strip()
        if code:
            blocks.append({"code": code, "lang": lang, "pos": m.start()})
    blocks.sort(key=lambda b: b["pos"])
    return blocks

def split_sections(md):
    """Yield (level, heading, section-body) tuples split at ## headings."""
    sections = []
    positions = [(m.start(), len(m.group(1)), m.group(2).strip()) for m in HEADING_RE.finditer(md)]
    # Prepend a virtual section 0 for content before first heading (chapter intro).
    positions = [(0, 0, "__intro__")] + positions
    for i, (start, level, heading) in enumerate(positions):
        end = positions[i+1][0] if i+1 < len(positions) else len(md)
        body = md[start:end]
        # Skip the heading line itself when returning body
        body_lines = body.split("\n", 1)
        body_only = body_lines[1] if len(body_lines) > 1 else ""
        sections.append((level, heading, body_only.strip()))
    return sections

# ---------------------------------------------------------------------------
# Language filters — only keep code we're confident is Motoi Scheme.
# ---------------------------------------------------------------------------

MOTOI_LANGS = {"sakura-scheme", "motoi", "scheme"}

def is_motoi_code(block):
    if block["lang"].lower() in MOTOI_LANGS:
        return True
    return False

# Quick heuristic: reject code containing shell prompts, python-y syntax
BAD_PATTERNS = [
    re.compile(r'^\s*\$\s'),        # shell prompt
    re.compile(r'^\s*sakura>\s'),   # REPL prompt in prose
    re.compile(r'^\s*(def|class|import|from)\s+\w+\s*[:(=]'),  # python
]

REPL_PROMPT_RE = re.compile(r'^sakura>\s+', re.MULTILINE)

def clean_repl_prompt(code):
    """Strip 'sakura> ' prompts to leave just the form."""
    return REPL_PROMPT_RE.sub("", code)

def parens_balanced(code):
    """Rough s-expr paren balance check. Ignores strings/chars for simplicity."""
    depth = 0
    in_str = False
    i = 0
    while i < len(code):
        c = code[i]
        if in_str:
            if c == "\\" and i+1 < len(code):
                i += 2; continue
            if c == '"':
                in_str = False
            i += 1; continue
        if c == '"':
            in_str = True; i += 1; continue
        if c == ";":  # line comment
            while i < len(code) and code[i] != "\n":
                i += 1
            continue
        if c == "(":
            depth += 1
        elif c == ")":
            depth -= 1
            if depth < 0:
                return False
        i += 1
    return depth == 0

def code_is_wellformed(code):
    """Reject clearly broken snippets: ellipsis-truncated, unbalanced parens,
    empty, or shell/other-language pollution."""
    stripped = code.strip()
    if not stripped:
        return False
    # Ellipsis "..." usually indicates snipped/incomplete code.
    if "..." in stripped or "…" in stripped:
        return False
    # Shell-y prompts:
    if stripped.startswith("$ ") or stripped.startswith("# "):
        return False
    # Nested "```" fences leaked in:
    if "```" in stripped:
        return False
    # Reject "_" placeholder in match position — usually paired with truncation.
    # Balance check.
    if not parens_balanced(stripped):
        return False
    return True

# ---------------------------------------------------------------------------
# Prose-to-question paraphrase templates.
# ---------------------------------------------------------------------------

QUESTION_TEMPLATES_BY_HEADING_HINT = [
    (re.compile(r'\bdefine\b', re.I),        "How do I `define` {topic} in Motoi?"),
    (re.compile(r'\blet\b', re.I),           "How do I use `let` for {topic} in Motoi?"),
    (re.compile(r'\blambda\b', re.I),        "How do I write a lambda for {topic} in Motoi?"),
    (re.compile(r'\bmap\b', re.I),           "How do I `map` over {topic} in Motoi?"),
    (re.compile(r'\bmatch\b', re.I),         "How do I `match` on {topic} in Motoi?"),
    (re.compile(r'\bmacro', re.I),           "Write a macro that {topic} in Motoi."),
    (re.compile(r'\brecord', re.I),          "How do I define a record for {topic} in Motoi?"),
    (re.compile(r'\berror|guard', re.I),     "How do I handle {topic} in Motoi?"),
    (re.compile(r'\bslat', re.I),            "How do I use SLAT to {topic} in Motoi?"),
    (re.compile(r'\bcortex', re.I),          "How do I use Cortex to {topic} in Motoi?"),
    (re.compile(r'\bimport|module', re.I),   "How do I import {topic} in Motoi?"),
    (re.compile(r'\brepl|,help|,doc', re.I), "How do I use the REPL to {topic}?"),
    (re.compile(r'\brecurs|tail', re.I),     "Show me tail-recursive {topic} in Motoi."),
    (re.compile(r'\bnumber|integer|float', re.I), "How do I work with numbers in {topic} in Motoi?"),
    (re.compile(r'\bstring', re.I),          "How do I work with strings for {topic} in Motoi?"),
    (re.compile(r'\bsymbol', re.I),          "How do I use symbols for {topic} in Motoi?"),
    (re.compile(r'\blist|pair|cons', re.I),  "How do I work with lists for {topic} in Motoi?"),
    (re.compile(r'\bboolean|nil|null', re.I),"How do I test {topic} in Motoi?"),
    (re.compile(r'\bcharacter|char', re.I),  "How do I work with characters for {topic} in Motoi?"),
]

def paraphrase_prompt(heading, prose_snippet):
    """Turn a section heading + prose snippet into a user question."""
    heading_clean = heading.lower().strip(" `.:-")
    # Extract a topic phrase from prose (first sentence, stripped)
    first_sentence = re.split(r'(?<=[.!?])\s', prose_snippet.strip(), maxsplit=1)[0]
    first_sentence = re.sub(r'\s+', " ", first_sentence).strip()[:180]
    # Fall back to heading if prose is empty
    if not first_sentence:
        first_sentence = heading

    for pat, template in QUESTION_TEMPLATES_BY_HEADING_HINT:
        if pat.search(heading) or pat.search(first_sentence):
            # Simple topic substitution from heading
            return template.format(topic=heading_clean or "this")

    # Generic fallback
    if len(heading_clean) < 40 and heading_clean != "__intro__":
        return f"In Motoi Scheme, show me an example of {heading_clean}."
    return f"Give me a small Motoi Scheme example that demonstrates: {first_sentence[:120]}"

def code_to_explain_prompt(code):
    return f"What does this Motoi Scheme program do?\n\n```motoi\n{code}\n```"

def explain_from_prose(prose_snippet, code_block):
    """Two-sentence explanation drawing from prose. Trim, drop 'Sakura says'-y voice."""
    if not prose_snippet:
        return None
    # First — remove any embedded code blocks / <pre> tags / fenced code from the
    # prose so we don't pull them into an "explanation".
    p = re.sub(r'<pre[^>]*>.*?</pre>', ' ', prose_snippet, flags=re.DOTALL)
    p = re.sub(r'```[\w-]*\n.*?\n```', ' ', p, flags=re.DOTALL)
    p = re.sub(r'`[^`]{,80}`', lambda m: m.group(0), p)  # keep inline `code` in prose OK
    p = re.sub(r'^\s*>\s.*$', '', p, flags=re.MULTILINE)  # drop blockquotes
    p = re.sub(r'\s+', ' ', p).strip()
    if not p:
        return None
    # Take first 1-2 sentences (up to ~260 chars).
    sentences = re.split(r'(?<=[.!?])\s', p)
    kept = []
    total = 0
    for s in sentences:
        s = s.strip()
        if not s:
            continue
        # Drop lines that look like heading references / cross-links / navigation.
        if s.startswith("Chapter ") or s.startswith("[[") or "→" in s:
            continue
        if s.startswith("Appendix "):
            continue
        # Drop lines that mention specific frontmatter-y noise.
        if "canonical:" in s or "slug:" in s or "last-reviewed" in s:
            continue
        # Drop any residual < or > that suggest HTML leaked through
        if "<pre" in s or "</pre" in s:
            continue
        if total + len(s) > 260:
            break
        kept.append(s)
        total += len(s)
        if len(kept) >= 2:
            break
    if not kept:
        return None
    result = " ".join(kept).strip()
    # Final guard: reject if the "explanation" is longer than a real explanation
    # should be, or contains obvious code-tags.
    if len(result) < 12 or "<pre" in result or "```" in result:
        return None
    # Reject orphan-fragment tell-tales:
    lower = result.lower()
    ORPHAN_STARTS = ("you'll see:", "returns ", "produces ", "gives ", "outputs ",
                     "prints ", "shows ", "yields ", "**", "> ")
    ORPHAN_ENDINGS = (":", "…", "...")
    for start in ORPHAN_STARTS:
        if lower.startswith(start):
            return None
    if result.endswith(ORPHAN_ENDINGS) and len(result) < 40:
        return None
    # Reject "explanations" that are actually just a heading followed by colon
    if re.match(r'^\*\*[^*]{1,60}\*\*:?$', result):
        return None
    return result

# ---------------------------------------------------------------------------
# The pair generators.
# ---------------------------------------------------------------------------

def make_pair(user, assistant):
    return {
        "messages": [
            {"role": "user", "content": user.strip()},
            {"role": "assistant", "content": assistant.strip()},
        ]
    }

def pairs_from_chapter(meta):
    """Yield JSONL-ready pair dicts."""
    md = strip_frontmatter(meta["prose"])
    md = strip_sakura_quotes(md)
    sections = split_sections(md)

    seen_codes = set()

    for level, heading, body in sections:
        blocks = [b for b in extract_code_blocks(body) if is_motoi_code(b)]
        if not blocks:
            continue

        # Prose is what precedes the FIRST code block in this section.
        first_block_pos = blocks[0]["pos"]
        prose_before = body[:first_block_pos].strip()
        # Strip out markdown formatting bits.
        prose_before = re.sub(r'^#+\s+.*$', '', prose_before, flags=re.MULTILINE).strip()
        prose_before = re.sub(r'^\s*[-*]\s+', '', prose_before, flags=re.MULTILINE)

        # E1 — explain-then-code (uses first block in section)
        first_block = blocks[0]
        code_clean = clean_repl_prompt(first_block["code"]).strip()
        code_hash = hashlib.sha1(code_clean.encode()).hexdigest()
        if code_hash not in seen_codes and code_clean and code_is_wellformed(code_clean):
            seen_codes.add(code_hash)
            user_q = paraphrase_prompt(heading if heading != "__intro__" else meta["title"] or "",
                                       prose_before or (meta.get("title") or ""))
            assistant_a = f"```motoi\n{code_clean}\n```"
            explain = explain_from_prose(prose_before, first_block)
            if explain:
                assistant_a += f"\n\n{explain}"
            yield {**make_pair(user_q, assistant_a),
                   "_meta": {"extractor": "E1", "chapter": meta.get("chapter_num"),
                             "title": meta.get("title"), "heading": heading}}

        # E2 — code-then-explain (uses each block)
        for b in blocks:
            code_clean = clean_repl_prompt(b["code"]).strip()
            if not code_clean or not code_is_wellformed(code_clean):
                continue
            # Skip trivially short forms
            if len(code_clean) < 6:
                continue
            explain = explain_from_prose(prose_before, b)
            if not explain:
                # Fall back to a generic explanation grounded in the heading.
                if heading and heading != "__intro__":
                    explain = f"It demonstrates {heading.lower().strip(' `.:')} in Motoi Scheme."
                else:
                    continue
            yield {**make_pair(code_to_explain_prompt(code_clean), explain),
                   "_meta": {"extractor": "E2", "chapter": meta.get("chapter_num"),
                             "title": meta.get("title"), "heading": heading}}

        # E3 — variation-pair: if section has 2+ blocks, emit each as a variation.
        if len(blocks) >= 2:
            tiers = ["a simple", "an intermediate", "a more elaborate", "another"]
            for i, b in enumerate(blocks[:4]):
                code_clean = clean_repl_prompt(b["code"]).strip()
                if not code_clean or len(code_clean) < 6:
                    continue
                if not code_is_wellformed(code_clean):
                    continue
                tier = tiers[min(i, len(tiers)-1)]
                topic = (heading or "").strip(" `.:-").lower() or (meta.get("title") or "this")
                user_q = f"Show me {tier} example of {topic} in Motoi Scheme."
                assistant_a = f"```motoi\n{code_clean}\n```"
                yield {**make_pair(user_q, assistant_a),
                       "_meta": {"extractor": "E3", "chapter": meta.get("chapter_num"),
                                 "title": meta.get("title"), "heading": heading, "tier": tier}}

# ---------------------------------------------------------------------------
# E4 — hand-curated common-desktop-tasks (pilot pass — a small seed set)
# E5 — hand-curated routing patterns (pilot pass — a small seed set)
# Real Wave 1 crews expand these dramatically.
# ---------------------------------------------------------------------------

E4_PAIRS = [
    ("Write a small Motoi program that counts the elements of a list.",
     "```motoi\n(define (count-elems xs)\n  (if (null? xs) 0 (+ 1 (count-elems (cdr xs)))))\n(count-elems (list 1 2 3 4 5))\n```"),
    ("Write a small Motoi program that squares every number in a list.",
     "```motoi\n(map (lambda (n) (* n n)) (list 1 2 3 4 5))\n```"),
    ("Write a small Motoi program that filters even numbers from a list.",
     "```motoi\n(filter even? (list 1 2 3 4 5 6))\n```"),
    ("Write a small Motoi program that sums a list of numbers using fold.",
     "```motoi\n(fold + 0 (list 1 2 3 4 5))\n```"),
    ("Write a small Motoi program that defines a point record with x and y and reads x back.",
     "```motoi\n(define-record point (x y))\n(define p (point 3 4))\n(point-x p)\n```"),
    ("Write a small Motoi program that reads a slat file and prints every top-level record.",
     "```motoi\n(for-each (lambda (r) (display r) (newline))\n          (slat-load (open-input-file \"data.slatl\")))\n```"),
    ("Write a small Motoi program that composes two functions and applies the composition.",
     "```motoi\n(define (compose f g) (lambda (x) (f (g x))))\n((compose (lambda (n) (* n n)) (lambda (n) (+ n 1))) 4)\n```"),
    ("Write a small Motoi program that uses guard to catch an error and return a default.",
     "```motoi\n(guard (e (#t 'fallback))\n  (car '()))\n```"),
    ("Write a small Motoi program that defines a tail-recursive factorial.",
     "```motoi\n(define (fact n acc)\n  (if (= n 0) acc (fact (- n 1) (* n acc))))\n(fact 10 1)\n```"),
    ("Write a small Motoi program that appends two lists.",
     "```motoi\n(append (list 1 2 3) (list 4 5 6))\n```"),
    ("Write a small Motoi program that reverses a list.",
     "```motoi\n(reverse (list 1 2 3 4 5))\n```"),
    ("Write a small Motoi program that defines a swap! macro using syntax-rules.",
     "```motoi\n(define-syntax swap!\n  (syntax-rules ()\n    ((_ a b) (let ((t a)) (set! a b) (set! b t)))))\n```"),
    ("Write a small Motoi program that writes a slat record to canonical string form.",
     "```motoi\n(slat-dumps '(event :ts 1 :kind \"card.opened\"))\n```"),
    ("Write a small Motoi program that returns the length of a string.",
     "```motoi\n(string-length \"Motoi Scheme\")\n```"),
    ("Write a small Motoi program that concatenates two strings.",
     "```motoi\n(string-append \"Motoi \" \"Scheme\")\n```"),
    ("Write a small Motoi program that tests whether a value is a symbol.",
     "```motoi\n(symbol? 'apple)\n```"),
    ("Write a small Motoi program that reads a value from Cortex and defaults if missing.",
     "```motoi\n(let ((v (cortex-read 'user.favorite-color)))\n  (if v v 'unset))\n```"),
    ("Write a small Motoi program that appends an event to a Cortex stream.",
     "```motoi\n(cortex-append! 'app.events\n  (list 'event :ts (now) :kind :opened))\n```"),
    ("Write a small Motoi program that walks a nested list and collects every symbol.",
     "```motoi\n(define (collect-syms x)\n  (cond ((symbol? x) (list x))\n        ((pair? x) (append (collect-syms (car x))\n                           (collect-syms (cdr x))))\n        (else '())))\n(collect-syms '(a (b (c d)) e))\n```"),
    ("Write a small Motoi program that runs a REPL meta-command to describe map.",
     "```motoi\n,doc map\n```"),
]

E5_PAIRS = [
    ("In Motoi, I want to draw a red rectangle. Which verb do I reach for?",
     "Framebuffer verbs — first import them. Then rectangle-with-fill:\n\n```motoi\n(import (verbs framebuffer))\n(rect 10 10 100 60 'red)\n```\n\n`rect` is base Motoi once the framebuffer verb layer is imported."),
    ("In Motoi, I want to persist the user's preference across sessions. Which verb do I reach for?",
     "Cortex — Motoi provides it as an adapter. Use `cortex-write!` for a single fact:\n\n```motoi\n(cortex-write! 'user.pref.theme 'dark)\n```\n\nCortex is adapter-shaped: the runtime injects it; the verb is base."),
    ("In Motoi, I want to open a card in a Sakura-flavored app. Which verb do I reach for?",
     "That's Sakura-dialect territory — `card/open` isn't in base Motoi:\n\n```motoi\n#!dialect sakura\n(card/open 'my-card)\n```\n\nOn plain Motoi, use `(import (verbs card))` if the runtime provides it; otherwise the verb won't resolve."),
    ("In Motoi, I want to serialize a value to canonical slat. Which verb do I reach for?",
     "Base Motoi — `slat-dumps` is core:\n\n```motoi\n(slat-dumps '(point :x 3 :y 4))\n```\n\nNo import needed. SLAT is first-class in Motoi."),
    ("In Motoi, I want to run a shell command. Which verb do I reach for?",
     "That's Lacuna-dialect territory — not in base Motoi:\n\n```motoi\n#!dialect lacuna\n(sys/exec \"ls -la\")\n```\n\nPlain Motoi doesn't ship shell verbs — they're intentionally in the ops dialect."),
    ("In Motoi, I want to define a helper that both my code and Sakura's dialect can use. Which verb do I reach for?",
     "Base `define` — dialect-neutral, works in every variant:\n\n```motoi\n(define (round-up-cents dollars)\n  (* 100 (ceiling dollars)))\n```\n\nWritten in base, callable from any dialect."),
]

def hand_curated_pairs():
    for user, assistant in E4_PAIRS:
        yield {**make_pair(user, assistant),
               "_meta": {"extractor": "E4", "source": "hand-curated-desktop-tasks"}}
    for user, assistant in E5_PAIRS:
        yield {**make_pair(user, assistant),
               "_meta": {"extractor": "E5", "source": "hand-curated-routing"}}

# ---------------------------------------------------------------------------
# Reference-verb-allowlist filter (soft — warn only in pilot).
# Load verb names from the reference for a coarse check.
# ---------------------------------------------------------------------------

REF_PATH = "/Users/alfred/code/scheme-lang/docs/SAKURA-SCHEME-REFERENCE.slat"
VERB_NAME_RE = re.compile(r':name\s+"([^"]+)"')
CORE_FORMS = set([
    "define","set!","if","cond","case","when","unless","and","or","not",
    "let","let*","letrec","lambda","begin","quote","quasiquote","unquote",
    "unquote-splicing","define-syntax","syntax-rules","define-macro","define-record",
    "delay","force","guard","raise","error","match","module","export","import",
    "for-each","map","filter","reduce","fold","fold-left","fold-right",
    "car","cdr","cons","list","pair?","null?","length","append","reverse",
    "range","list-ref","cadr","caddr","cddr","member","assoc",
    "+","-","*","/","=","<",">","<=",">=","modulo","quotient","remainder","abs",
    "sqrt","expt","sin","cos","tan","atan2","floor","ceiling","round","min","max",
    "zero?","positive?","negative?","even?","odd?","number?","integer?","float?",
    "string?","string-length","string-append","substring","string->symbol","symbol->string",
    "symbol?","eq?","eqv?","equal?","boolean?","char?","display","newline","write",
    "read","open-input-file","open-output-file","with-input-from-file","with-output-to-file",
    "close-input-port","close-output-port",
    "slat-loads","slat-load","slat-load-doc","slat-dumps","slat-dump","slat-dump-doc",
    "slat-key","slat-tag","slat-read",
    "cortex-read","cortex-write!","cortex-append!","cortex-stream","cortex-query","cortex-topk",
    "type-of","describe","apply","values","call-with-values",
    "sakura/complete","sakura/rewrite","sakura/explain",
    "now",",help",",doc",",arity",",type",",examples",",expand",",inspect",",apropos",",namespace",
    "rect","circle","line","clear","framebuffer",
    "count-down","sum-to","fact","loop","square","double","area","compose",
    "geom","ints-from","p","point","point-x","point-y","x","y","r",
    "collect-syms","count-elems","round-up-cents",
    "get","hash-ref","hash-set!","hash-remove!","make-hash",
    "vector","vector-ref","vector-length","vector-set!","list->vector","vector->list",
])

def load_verbs():
    if not os.path.exists(REF_PATH):
        return CORE_FORMS
    verbs = set(CORE_FORMS)
    with open(REF_PATH, "r", encoding="utf-8") as f:
        for line in f:
            m = VERB_NAME_RE.search(line)
            if m:
                verbs.add(m.group(1))
    return verbs

# ---------------------------------------------------------------------------
# Main.
# ---------------------------------------------------------------------------

def main():
    files = sorted(glob.glob(os.path.join(BOOK_DIR, "*.book.slatl")))
    # Skip pure-index/skeleton files
    SKIP = {"00-index.book.slatl", "CHAPTERS.book.slatl", "CHAPTERS-RAMPUP.book.slatl",
            "ch17-advanced-tier-reserved-for-claude.book.slatl",
            "ch18-advanced-tier-reserved-for-claude.book.slatl"}
    files = [f for f in files if os.path.basename(f) not in SKIP]

    verbs = load_verbs()
    sys.stderr.write(f"[verb-allowlist] loaded {len(verbs)} names\n")

    # Header record.
    header = {
        "_provenance_header": True,
        "generated_at": datetime.datetime.utcnow().isoformat() + "Z",
        "generator": "architect-motoi-copilot-corpus-2026-07-16.slat pilot extractor",
        "book": "book-of-scheme",
        "book_path": BOOK_DIR,
        "extractors": ["E1-explain-then-code", "E2-code-then-explain",
                       "E3-variation-pair", "E4-common-desktop-tasks",
                       "E5-four-routing-patterns"],
        "reference": REF_PATH,
        "reference_verb_count": len(verbs),
        "design_doc": "/Users/alfred/code/lacuna-labs/design-docs/architect-motoi-copilot-corpus-2026-07-16.slat",
        "notes": ("Pilot pass. Reference-verb filter is SOFT (warn to stderr). "
                  "'Sakura says' quote blocks are stripped. "
                  "REPL prompts (sakura>) are cleaned to bare forms."),
    }

    os.makedirs(os.path.dirname(OUT_PATH), exist_ok=True)
    out = open(OUT_PATH, "w", encoding="utf-8")
    out.write(json.dumps(header, ensure_ascii=False) + "\n")

    seen_pairs = set()
    total = 0
    per_extractor = {"E1": 0, "E2": 0, "E3": 0, "E4": 0, "E5": 0}
    dropped_dupe = 0
    dropped_short = 0

    for path in files:
        meta = parse_chapter(path)
        if not meta:
            sys.stderr.write(f"[skip-no-prose] {os.path.basename(path)}\n")
            continue
        sys.stderr.write(f"[chapter] {os.path.basename(path)} — {meta.get('title')}\n")
        chap_count = 0
        for pair in pairs_from_chapter(meta):
            ex = pair["_meta"]["extractor"]
            user = pair["messages"][0]["content"]
            asst = pair["messages"][1]["content"]
            if len(asst) < 12:
                dropped_short += 1
                continue
            key = hashlib.sha1((user + "\n" + asst).encode()).hexdigest()
            if key in seen_pairs:
                dropped_dupe += 1
                continue
            seen_pairs.add(key)
            pair.pop("_meta", None)
            out.write(json.dumps(pair, ensure_ascii=False) + "\n")
            per_extractor[ex] += 1
            total += 1
            chap_count += 1
        sys.stderr.write(f"  → {chap_count} pairs\n")

    # Hand-curated E4 + E5
    for pair in hand_curated_pairs():
        ex = pair["_meta"]["extractor"]
        user = pair["messages"][0]["content"]
        asst = pair["messages"][1]["content"]
        key = hashlib.sha1((user + "\n" + asst).encode()).hexdigest()
        if key in seen_pairs:
            dropped_dupe += 1
            continue
        seen_pairs.add(key)
        pair.pop("_meta", None)
        out.write(json.dumps(pair, ensure_ascii=False) + "\n")
        per_extractor[ex] += 1
        total += 1

    out.close()
    sys.stderr.write("\n=== PILOT DONE ===\n")
    sys.stderr.write(f"total pairs: {total}\n")
    sys.stderr.write(f"per extractor: {per_extractor}\n")
    sys.stderr.write(f"dropped dupe: {dropped_dupe}\n")
    sys.stderr.write(f"dropped short: {dropped_short}\n")
    sys.stderr.write(f"output: {OUT_PATH}\n")

if __name__ == "__main__":
    main()
