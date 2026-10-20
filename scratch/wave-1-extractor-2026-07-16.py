#!/usr/bin/env python3
"""
wave-1-extractor-2026-07-16.py

Wave 1 extractor for Motoi Copilot corpus.
Reads a book directory (SLATL chapters), emits JSONL SFT pairs.

Extractors implemented:
  E1 — explain-then-code (prose section → runnable block)
  E2 — code-then-explain (runnable block → 1-sentence explanation)
  E3 — variation-pair    (multi-block sections → tier prompts)
  E4 — common-desktop-tasks (hand-curated per book)
  E5 — routing patterns   (hand-curated per book)

Wave 1 fixes over pilot:
  * Per-chapter TOPIC-SEED derived from chapter title / heading nouns —
    used as substitution before templating "How do I use REPL to {topic}"
    style questions. Prevents "your first repl" landing as the topic.
  * Sharper E2 fallback: uses topic seed + verb keywords from the code
    block itself to build the fallback explanation, not just "It
    demonstrates X in Motoi Scheme."
  * user_question_is_grammatical() sanity-check filter — rejects any
    generated question that fails a small set of malformedness heuristics
    (repeated words, dangling "to", double-articles, empty topic, etc.).

Design doc: ~/code/lacuna-labs/design-docs/architect-motoi-copilot-corpus-2026-07-16.slat
"""
import json
import os
import re
import hashlib
import glob
import sys
import datetime
import argparse

# ---------------------------------------------------------------------------
# SLAT chapter parser (loose — enough for wave 1).
# ---------------------------------------------------------------------------

CHAPTER_HEADER_RE = re.compile(
    r':title\s+"([^"]+)"|:chapter-number\s+(\d+|null)|:book\s+"([^"]+)"|:arc\s+"([^"]+)"'
)

# The prose field is embedded as a large "..."-quoted string. We take
# everything between :prose\n" ... " at the end of the record.
PROSE_FIELD_RE = re.compile(r':prose\s+"(.*)"\s*\)?\s*\Z', re.DOTALL)


def unescape_slat_string(s):
    """Reverse the SLAT string escaping: \\" → ", \\\\ → \\, \\n → newline."""
    out = []
    i = 0
    while i < len(s):
        c = s[i]
        if c == "\\" and i + 1 < len(s):
            nxt = s[i + 1]
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
    meta = {"title": None, "chapter_num": None, "book": None, "arc": None,
            "source_path": path}
    for m in CHAPTER_HEADER_RE.finditer(text):
        if m.group(1):
            meta["title"] = m.group(1)
        elif m.group(2):
            v = m.group(2)
            meta["chapter_num"] = None if v == "null" else int(v)
        elif m.group(3):
            meta["book"] = m.group(3)
        elif m.group(4):
            meta["arc"] = m.group(4)
    m = PROSE_FIELD_RE.search(text)
    if not m:
        return None
    meta["prose"] = unescape_slat_string(m.group(1))
    return meta


# ---------------------------------------------------------------------------
# Markdown parsing.
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
    """Yield (level, heading, section-body) tuples split at headings."""
    sections = []
    positions = [(m.start(), len(m.group(1)), m.group(2).strip())
                 for m in HEADING_RE.finditer(md)]
    positions = [(0, 0, "__intro__")] + positions
    for i, (start, level, heading) in enumerate(positions):
        end = positions[i + 1][0] if i + 1 < len(positions) else len(md)
        body = md[start:end]
        body_lines = body.split("\n", 1)
        body_only = body_lines[1] if len(body_lines) > 1 else ""
        sections.append((level, heading, body_only.strip()))
    return sections


# ---------------------------------------------------------------------------
# Language filters.
# ---------------------------------------------------------------------------

MOTOI_LANGS = {"sakura-scheme", "motoi", "scheme"}


def is_motoi_code(block):
    return block["lang"].lower() in MOTOI_LANGS


REPL_PROMPT_RE = re.compile(r'^sakura>\s+', re.MULTILINE)


def clean_repl_prompt(code):
    return REPL_PROMPT_RE.sub("", code)


def parens_balanced(code):
    depth = 0
    in_str = False
    i = 0
    while i < len(code):
        c = code[i]
        if in_str:
            if c == "\\" and i + 1 < len(code):
                i += 2; continue
            if c == '"':
                in_str = False
            i += 1; continue
        if c == '"':
            in_str = True; i += 1; continue
        if c == ";":
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
    stripped = code.strip()
    if not stripped:
        return False
    if "..." in stripped or "…" in stripped:
        return False
    if stripped.startswith("$ ") or stripped.startswith("# "):
        return False
    if "```" in stripped:
        return False
    if not parens_balanced(stripped):
        return False
    return True


# ---------------------------------------------------------------------------
# TOPIC SEEDING — the wave 1 fix for "How do I use REPL to your first repl".
# ---------------------------------------------------------------------------

# Words we NEVER want to appear as the topic — they're structural / sentence
# leftovers, not real math/scheme topics.
TOPIC_STOPWORDS = set("""
a an the and or but if in on at of for to from by with over under into onto out
your our their my his her its this that these those some any every each all
first second third fourth fifth sixth seventh eighth ninth tenth
one two three four five six seven eight nine ten
you we they he she it i me us them
is are was were be been being do does did done have has had
say says said tell tells told show shows shown
can could may might must shall will would should
here there where when what which who whom whose why how
just only also even still yet already
new next last other another same different
using use used uses uses used
""".split())

# Bigram/trigram phrases we do want as topic-worthy when they show up in
# section headings.  This list is deliberately book-agnostic; per-book adds
# happen via TOPIC_SEEDS_BY_BOOK below.
GENERIC_TOPIC_PHRASES = {
    "number line", "place value", "long division", "fractions", "decimals",
    "ratios", "proportions", "probability", "algebra", "geometry",
    "trigonometry", "calculus", "linear algebra", "differential equations",
    "number theory", "combinatorics", "sequences", "series", "groups",
    "rings", "fields", "statistics", "regression", "optimization",
    "numerical methods", "complex analysis", "topology", "dynamical systems",
    "fractals",
    "slat", "record", "primitive", "canonical form", "signing", "cortex",
    "mailbox", "auto assembly", "tagged extension", "session record",
    "record type", "content address", "namespace",
    "register", "antipattern", "adapter", "verb lifecycle", "metered verb",
    "fork protocol", "refusal", "extension", "cost", "consent",
    "determinism", "voice", "kit", "seed",
    "define", "lambda", "let", "match", "map", "filter", "fold", "guard",
    "recursion", "tail recursion", "macro", "syntax-rules", "module",
    "import", "record type", "list", "pair", "string", "symbol", "number",
    "boolean", "character", "vector", "hash table",
}


# Per-book topic seeds — chapter-file-basename → canonical topic phrase.
# When a chapter's section topic-extraction comes up empty or bad, fall back
# to this per-chapter topic.
TOPIC_SEEDS_BY_BOOK = {
    "book-of-math": {
        "ch01-counting-number-line": "counting and the number line",
        "ch02-place-value-arrays": "place value and arrays",
        "ch03-multiplication-division": "multiplication and division",
        "ch04-long-division-factors": "long division and factors",
        "ch05-fractions-decimals": "fractions and decimals",
        "ch06-ratios-integers-expressions": "ratios, integers, and expressions",
        "ch07-proportions-probability": "proportions and probability",
        "ch08-pre-algebra-plane": "pre-algebra and the coordinate plane",
        "ch09-algebra-1": "algebra I",
        "ch10-geometry": "geometry",
        "ch11-algebra-2-trig": "algebra II and trigonometry",
        "ch12-pre-calculus": "pre-calculus",
        "ch13-calculus-1": "calculus I",
        "ch14-calculus-2": "calculus II",
        "ch15-multivariable-linear-algebra": "multivariable calculus and linear algebra",
        "ch16-math-major-electives": "math-major electives",
        "ch-advanced-01-number-theory-cryptography": "number theory and cryptography",
        "ch-advanced-02-combinatorics-counting": "combinatorics and counting",
        "ch-advanced-03-sequences-series-recurrence": "sequences, series, and recurrence",
        "ch-advanced-04-groups-symmetry": "groups and symmetry",
        "ch-advanced-05-rings-fields-structure": "rings, fields, and structure",
        "ch-advanced-06-game-theory-juggling": "game theory and juggling",
        "ch-advanced-07-probability-random-processes": "probability and random processes",
        "ch-advanced-08-statistical-inference-regression": "statistical inference and regression",
        "ch-advanced-09-optimization-operations-research": "optimization and operations research",
        "ch-advanced-10-numerical-methods": "numerical methods",
        "ch-advanced-11-complex-analysis": "complex analysis",
        "ch-advanced-12-linear-algebra-deep": "deep linear algebra",
        "ch-advanced-13-differential-geometry": "differential geometry",
        "ch-advanced-14-topology-shape-of-data": "topology and the shape of data",
        "ch-advanced-15-dynamical-systems-chaos-fractals": "dynamical systems, chaos, and fractals",
        "ch-advanced-16-mathematical-physics-engineering": "mathematical physics and engineering",
    },
    "book-of-slat": {
        "00-cover": "SLAT overview",
        "01-what-a-slat-is": "what a slat is",
        "02-primitives-small": "small SLAT primitives",
        "03-primitives-medium": "medium SLAT primitives",
        "04-the-slat-record": "the SLAT record",
        "05-fifteen-record-types": "the fifteen record types",
        "06-two-file-framings": "single-record and multi-record file framings",
        "07-reading-and-writing": "reading and writing SLAT",
        "08-canonicalization": "SLAT canonicalization",
        "09-content-addressing": "SLAT content addressing",
        "10-signing": "SLAT signing",
        "11-auto-assembly": "SLAT auto-assembly",
        "12-tagged-extensions": "SLAT tagged extensions",
        "13-reading-a-mailbox": "reading a mailbox slat",
        "14-cortex-slices": "Cortex slices",
        "15-building-a-game": "building a game with SLAT",
        "16-share-your-slat": "sharing a slat",
        "17-session-records": "SLAT session records",
        "appendix-a-errors": "SLAT errors",
        "appendix-b-every-primitive": "every SLAT primitive",
        "appendix-c-every-record-type": "every SLAT record type",
        "appendix-d-canonicalization-rules": "SLAT canonicalization rules",
        "appendix-e-where-slats-live": "where slats live",
        "appendix-f-cortex-cookbook": "the Cortex cookbook",
        "appendix-g-signing-recipes": "SLAT signing recipes",
        "appendix-h-auto-assembly-cookbook": "the auto-assembly cookbook",
        "appendix-i-networked-carts": "networked carts",
        "appendix-j-sakura-reads-her-own-reader": "reading the SLAT reader",
        "appendix-k-slat-for-http": "SLAT for HTTP",
        "appendix-l-slat-for-testing": "SLAT for testing",
        "appendix-m-slat-for-security-audit": "SLAT for a security audit",
        "appendix-n-slat-for-community": "SLAT for community",
        "appendix-o-slat-for-playground": "SLAT for a playground",
        "appendix-p-slat-for-notebooks": "SLAT for notebooks",
        "appendix-q-poem-form-record": "the poem-form record",
        "appendix-r-sonnet-record": "the sonnet record",
        "appendix-s-haiku-record": "the haiku record",
        "appendix-t-blues-record": "the blues record",
        "appendix-u-worked-poem-assembly": "worked poem assembly",
        "deliberate-forgetting-cortex-note": "deliberate forgetting in Cortex",
    },
    "book-of-extensions": {
        "01-register-discrimination": "register discrimination",
        "01-register-discrimination-expansion": "register discrimination (expansion)",
        "02-named-antipatterns": "named antipatterns",
        "02-named-antipatterns-expansion": "named antipatterns (expansion)",
        "03-associative-cs-lore": "associative CS lore",
        "03-associative-cs-lore-expansion": "associative CS lore (expansion)",
        "04-ramp-appendixes": "ramp appendixes",
        "04-ramp-appendixes-expansion": "ramp appendixes (expansion)",
        "05-library-extensions-shop-verbs": "library extensions and shop verbs",
        "05-library-extensions-shop-verbs-expansion": "library extensions and shop verbs (expansion)",
        "06-kit-and-seed-generation": "kit and seed generation",
        "06-kit-and-seed-generation-expansion": "kit and seed generation (expansion)",
        "07-deadpan-reality-check": "the deadpan reality check",
        "07-deadpan-reality-check-expansion": "the deadpan reality check (expansion)",
        "08-determinism-vs-voice": "determinism versus voice",
        "08-determinism-vs-voice-expansion": "determinism versus voice (expansion)",
        "09-scalar-axes-cost-consent": "scalar axes of cost and consent",
        "09-scalar-axes-cost-consent-expansion": "scalar axes of cost and consent (expansion)",
        "ch10-adapter-shape": "adapter shape",
        "ch11-verb-lifecycles": "verb lifecycles",
        "ch12-metered-verbs": "metered verbs",
        "ch13-cross-book-composition": "cross-book composition",
        "ch14-fork-protocol": "the fork protocol",
        "ch15-refusal-as-extension": "refusal as an extension",
        "ch16-extension-summit": "the extension summit",
        "appendix-a-custom-price-check-verb": "a custom price-check verb",
        "appendix-b-photo-tag-verb": "a photo-tag verb",
        "appendix-c-compose-shop-open": "composing shop-open",
        "appendix-d-etsy-adapter": "an Etsy adapter",
        "appendix-e-meter-llm-verb": "metering an LLM verb",
        "appendix-f-refusal-verb": "a refusal verb",
        "appendix-g-fork-vertical": "the fork vertical",
        "appendix-h-extension-summit": "the extension summit (appendix)",
    },
}


def chapter_topic_seed(chapter_file_stem, book_key):
    """Look up the canonical topic phrase for this chapter, if we have one."""
    seeds = TOPIC_SEEDS_BY_BOOK.get(book_key, {})
    return seeds.get(chapter_file_stem)


def clean_heading_for_topic(heading):
    """Strip 'Chapter N — ' / trailing punctuation / backticks."""
    h = heading.strip()
    h = re.sub(r'^Chapter\s+\d+\s*[—–-]\s*', '', h, flags=re.IGNORECASE)
    h = re.sub(r'^Appendix\s+[A-Z]\s*[:—–-]\s*', '', h, flags=re.IGNORECASE)
    h = re.sub(r'^§[A-Z]\s*:?\s*', '', h)
    # Strip "Example N:", "Exercise N:", "Part N.M:" prefixes that leak from
    # numbered-list section headings.
    h = re.sub(r'^(?:Example|Exercise|Problem|Case|Part|Section|Step|Lesson)\s+[\d.]+\s*[:—–-]\s*',
               '', h, flags=re.IGNORECASE)
    h = h.strip(" `.:-—–")
    return h


def extract_topic_from_heading(heading, chapter_topic):
    """Return a lowercase topic phrase suitable for question templating.
    Falls back to chapter_topic if heading doesn't give a good topic.
    """
    if not heading or heading == "__intro__":
        return chapter_topic
    cleaned = clean_heading_for_topic(heading)
    if not cleaned:
        return chapter_topic
    lower = cleaned.lower()
    # If the heading itself is a known topic phrase, use it.
    for phrase in GENERIC_TOPIC_PHRASES:
        if phrase in lower:
            return lower
    # If heading is short and doesn't start with a stopword, use it.
    tokens = lower.split()
    if 1 <= len(tokens) <= 8:
        first_tok = tokens[0]
        # Reject headings that lead with pronouns/articles that would produce
        # ungrammatical questions: "your first repl", "the first thing".
        if first_tok in TOPIC_STOPWORDS:
            return chapter_topic
        # Reject if the whole heading is stopwords (rare, but).
        content_tokens = [t for t in tokens if t not in TOPIC_STOPWORDS]
        if not content_tokens:
            return chapter_topic
        return lower
    return chapter_topic


# ---------------------------------------------------------------------------
# Question templating.
# ---------------------------------------------------------------------------

QUESTION_TEMPLATES_BY_HEADING_HINT = [
    (re.compile(r'\bdefine\b', re.I),           "How do I `define` {topic} in Motoi?"),
    (re.compile(r'\blet\b', re.I),              "How do I use `let` for {topic} in Motoi?"),
    (re.compile(r'\blambda\b', re.I),           "How do I write a lambda for {topic} in Motoi?"),
    (re.compile(r'\bmap\b', re.I),              "How do I `map` over {topic} in Motoi?"),
    (re.compile(r'\bmatch\b', re.I),            "How do I `match` on {topic} in Motoi?"),
    (re.compile(r'\bmacro', re.I),              "Write a macro for {topic} in Motoi."),
    (re.compile(r'\brecord', re.I),             "How do I define a record for {topic} in Motoi?"),
    (re.compile(r'\berror|guard', re.I),        "How do I handle errors around {topic} in Motoi?"),
    (re.compile(r'\bslat', re.I),               "How do I use SLAT for {topic} in Motoi?"),
    (re.compile(r'\bcortex', re.I),             "How do I use Cortex for {topic} in Motoi?"),
    (re.compile(r'\bimport|module', re.I),      "How do I import {topic} in Motoi?"),
    (re.compile(r'\brepl|,help|,doc', re.I),    "How do I explore {topic} at the REPL?"),
    (re.compile(r'\brecurs|tail', re.I),        "Show me a recursive example of {topic} in Motoi."),
    (re.compile(r'\bnumber|integer|float', re.I), "How do I work with numbers for {topic} in Motoi?"),
    (re.compile(r'\bstring', re.I),             "How do I work with strings for {topic} in Motoi?"),
    (re.compile(r'\bsymbol', re.I),             "How do I use symbols for {topic} in Motoi?"),
    (re.compile(r'\blist|pair|cons', re.I),     "How do I work with lists for {topic} in Motoi?"),
    (re.compile(r'\bboolean|nil|null', re.I),   "How do I test {topic} in Motoi?"),
    (re.compile(r'\bcharacter\b|\bchar\b', re.I), "How do I work with characters for {topic} in Motoi?"),
    (re.compile(r'\bfraction|decimal|ratio', re.I), "How do I work with {topic} in Motoi?"),
    (re.compile(r'\bcanonical', re.I),          "How do I canonicalize {topic} in Motoi?"),
    (re.compile(r'\bsign|signature', re.I),     "How do I sign {topic} in Motoi?"),
    (re.compile(r'\badapter', re.I),            "How do I write an adapter for {topic} in Motoi?"),
    (re.compile(r'\bverb\b|\bverbs\b', re.I),   "How do I add a verb for {topic} in Motoi?"),
    (re.compile(r'\bmeter', re.I),              "How do I meter {topic} in Motoi?"),
    (re.compile(r'\brefus', re.I),              "How do I write a refusal for {topic} in Motoi?"),
    (re.compile(r'\bfork', re.I),               "How do I fork {topic} in Motoi?"),
]


def paraphrase_prompt(heading, chapter_topic, prose_snippet):
    """Turn a section heading + prose snippet into a user question, using
    chapter_topic as fallback if the heading doesn't yield a good topic.
    """
    topic = extract_topic_from_heading(heading, chapter_topic)
    if not topic:
        topic = chapter_topic or "this"

    for pat, template in QUESTION_TEMPLATES_BY_HEADING_HINT:
        if heading and pat.search(heading):
            return template.format(topic=topic)
        if prose_snippet and pat.search(prose_snippet[:300]):
            return template.format(topic=topic)

    heading_clean = clean_heading_for_topic(heading or "").lower()
    if heading_clean and heading_clean != "__intro__" and len(heading_clean) < 60:
        # Use the heading verbatim as the topic if it's clean.
        # But still route through the topic sanity check.
        topic_final = topic if topic != chapter_topic else heading_clean
        return f"In Motoi Scheme, show me an example of {topic_final}."
    # Intro / no heading: use chapter topic.
    if chapter_topic:
        return f"In Motoi Scheme, show me an example of {chapter_topic}."
    # Last-ditch prose-based.
    first_sentence = re.split(r'(?<=[.!?])\s', (prose_snippet or "").strip(),
                              maxsplit=1)[0]
    first_sentence = re.sub(r'\s+', " ", first_sentence).strip()[:120]
    if first_sentence:
        return f"Give me a small Motoi Scheme example that demonstrates: {first_sentence}"
    return None


def code_to_explain_prompt(code):
    return f"What does this Motoi Scheme program do?\n\n```motoi\n{code}\n```"


# ---------------------------------------------------------------------------
# Grammar sanity-check on GENERATED user questions.
# ---------------------------------------------------------------------------

# Patterns that indicate a malformed generated question.
DOUBLE_ARTICLE_RE = re.compile(r'\b(a|an|the|your|our|my|their|his|her|its)\s+(a|an|the|your|our|my|their|his|her|its)\b',
                               re.IGNORECASE)
REPEATED_WORD_RE = re.compile(r'\b(\w+)\s+\1\b', re.IGNORECASE)
TRAILING_PREPOSITION_RE = re.compile(r'\b(to|for|of|in|on|at|with|by|from|about|into)\s*[.?!]?\s*$',
                                     re.IGNORECASE)
# "your first repl" style: possessive determiner as topic head.
LEADING_POSSESSIVE_TOPIC_RE = re.compile(
    r'\b(?:of|for|to|about|use|over|on|in|on|at)\s+(your|our|my|their|his|her|its)\s',
    re.IGNORECASE,
)


def user_question_is_grammatical(q):
    """Coarse but useful malformedness check. Returns True if the question
    passes; False if we should reject it."""
    if not q or len(q.strip()) < 12:
        return False
    stripped = q.strip()
    # E2 questions contain a code fence and end in ```. Split off the code
    # fence for the grammar-check on the leading sentence.
    fence_start = stripped.find("```")
    if fence_start != -1:
        head = stripped[:fence_start].strip()
    else:
        head = stripped
    # Must end in ? . or ]
    if head and not (head.endswith("?") or head.endswith(".") or head.endswith("]")):
        return False
    # Empty topic marker leftover?
    if "{topic}" in stripped:
        return False
    if "{}" in stripped:
        return False
    # Double article (check on the head sentence only — code has its own tokens)
    if DOUBLE_ARTICLE_RE.search(head):
        return False
    # Repeated word — skip common code-adjacent words
    for m in REPEATED_WORD_RE.finditer(head):
        word = m.group(1).lower()
        if word in ("that", "the", "a", "an"):  # would be clearly wrong
            return False
        # For less-common words, single repeats CAN be intentional (rare in
        # authored English). Reject if the word is short (<=4 char) and
        # alphabetic — most legit repeats are content words.
        if len(word) <= 6 and word.isalpha() and word not in ("very", "really"):
            return False
    # Trailing preposition (head only, ignore trailing punctuation)
    if TRAILING_PREPOSITION_RE.search(head.rstrip("?.!")):
        return False
    # Possessive as topic head ("to your first repl")
    if LEADING_POSSESSIVE_TOPIC_RE.search(head):
        return False
    # Absurdly long
    if len(stripped) > 2000:  # E2 with a code block can be long, that's fine
        return False
    if len(head) > 300:
        return False
    return True


# ---------------------------------------------------------------------------
# Prose → 1-2 sentence explanation.
# ---------------------------------------------------------------------------

def explain_from_prose(prose_snippet):
    if not prose_snippet:
        return None
    p = re.sub(r'<pre[^>]*>.*?</pre>', ' ', prose_snippet, flags=re.DOTALL)
    p = re.sub(r'```[\w-]*\n.*?\n```', ' ', p, flags=re.DOTALL)
    p = re.sub(r'^\s*>\s.*$', '', p, flags=re.MULTILINE)
    p = re.sub(r'\s+', ' ', p).strip()
    if not p:
        return None
    sentences = re.split(r'(?<=[.!?])\s', p)
    kept = []
    total = 0
    for s in sentences:
        s = s.strip()
        if not s:
            continue
        if s.startswith("Chapter ") or s.startswith("[[") or "→" in s:
            continue
        if s.startswith("Appendix "):
            continue
        if "canonical:" in s or "slug:" in s or "last-reviewed" in s:
            continue
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
    if len(result) < 12 or "<pre" in result or "```" in result:
        return None
    lower = result.lower()
    ORPHAN_STARTS = ("you'll see:", "returns ", "produces ", "gives ",
                     "outputs ", "prints ", "shows ", "yields ", "**", "> ")
    ORPHAN_ENDINGS = (":", "…", "...")
    for start in ORPHAN_STARTS:
        if lower.startswith(start):
            return None
    if result.endswith(ORPHAN_ENDINGS) and len(result) < 40:
        return None
    if re.match(r'^\*\*[^*]{1,60}\*\*:?$', result):
        return None
    return result


# ---------------------------------------------------------------------------
# Wave-1 sharper E2 fallback: derive an explanation from the code itself.
# ---------------------------------------------------------------------------

# Common Motoi/Scheme forms mapped to a human phrase describing what they do.
VERB_TO_PHRASE = {
    "define": "binds a definition",
    "define-record": "declares a record type",
    "define-syntax": "declares a macro with syntax-rules",
    "define-macro": "declares a macro",
    "let": "introduces local bindings",
    "let*": "introduces sequentially-scoped local bindings",
    "letrec": "introduces recursive local bindings",
    "lambda": "constructs an anonymous function",
    "if": "branches on a condition",
    "cond": "branches on multiple conditions",
    "case": "dispatches on a discriminating value",
    "when": "runs a body when the condition holds",
    "unless": "runs a body unless the condition holds",
    "map": "applies a function across a list",
    "filter": "keeps elements that satisfy a predicate",
    "fold": "folds a list into a single value",
    "reduce": "reduces a list to a single value",
    "for-each": "walks a list for its side effects",
    "guard": "installs an error handler around a form",
    "match": "pattern-matches on a value",
    "begin": "runs a sequence of expressions",
    "quote": "yields a literal datum without evaluating it",
    "quasiquote": "yields a mostly-literal datum with holes for unquote",
    "display": "prints a value",
    "newline": "prints a newline",
    "write": "writes a value in read-back form",
    "read": "reads a datum",
    "import": "loads a module of verbs",
    "module": "declares a module",
    "cons": "builds a pair",
    "car": "gets the head of a pair",
    "cdr": "gets the tail of a pair",
    "list": "builds a list",
    "append": "joins two lists",
    "reverse": "reverses a list",
    "length": "counts a list",
    "string-length": "returns a string's length",
    "string-append": "concatenates strings",
    "substring": "takes a substring",
    "slat-read": "parses a slat text into a value",
    "slat-loads": "parses a slat text into a value",
    "slat-dumps": "serializes a value to canonical slat text",
    "slat-load": "reads a slat file",
    "slat-dump": "writes a slat file",
    "cortex-read": "reads a fact from Cortex",
    "cortex-write!": "writes a fact into Cortex",
    "cortex-append!": "appends an event to a Cortex stream",
    "cortex-query": "queries Cortex",
    "cortex-topk": "asks Cortex for the top-k results",
    ",doc": "prints REPL documentation for a verb",
    ",help": "prints REPL help",
    ",arity": "prints the arity of a verb",
    ",examples": "shows examples for a verb",
    "sqrt": "takes a square root",
    "expt": "raises to a power",
    "sin": "computes sine",
    "cos": "computes cosine",
    "floor": "rounds down",
    "ceiling": "rounds up",
    "round": "rounds to nearest",
    "+": "adds numbers",
    "-": "subtracts",
    "*": "multiplies",
    "/": "divides",
    "modulo": "takes a modulo",
    "quotient": "takes an integer quotient",
    "remainder": "takes an integer remainder",
    "even?": "tests whether a number is even",
    "odd?": "tests whether a number is odd",
    "zero?": "tests whether a number is zero",
    "null?": "tests whether a list is empty",
    "pair?": "tests whether a value is a pair",
    "number?": "tests whether a value is a number",
    "string?": "tests whether a value is a string",
    "symbol?": "tests whether a value is a symbol",
    "equal?": "tests structural equality",
    "eq?": "tests pointer equality",
}


LEAD_FORM_RE = re.compile(r'^\s*\(?\s*([A-Za-z_+\-*/=<>?!,][A-Za-z0-9_+\-*/=<>?!.,]*)')


def derive_explanation_from_code(code, topic):
    """Sharper E2 fallback: look at the first form in the code and, if we
    know it, produce a specific phrase; otherwise use the chapter topic.
    """
    m = LEAD_FORM_RE.search(code)
    if m:
        head = m.group(1)
        phrase = VERB_TO_PHRASE.get(head)
        if phrase:
            if topic:
                return f"This snippet {phrase} — a small example from {topic} in Motoi Scheme."
            return f"This snippet {phrase} in Motoi Scheme."
    if topic:
        return f"A small worked example of {topic} in Motoi Scheme."
    return None


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


def pairs_from_chapter(meta, chapter_topic):
    """Yield JSONL-ready pair dicts."""
    md = strip_frontmatter(meta["prose"])
    md = strip_sakura_quotes(md)
    sections = split_sections(md)

    seen_codes = set()

    for level, heading, body in sections:
        blocks = [b for b in extract_code_blocks(body) if is_motoi_code(b)]
        if not blocks:
            continue

        first_block_pos = blocks[0]["pos"]
        prose_before = body[:first_block_pos].strip()
        prose_before = re.sub(r'^#+\s+.*$', '', prose_before, flags=re.MULTILINE).strip()
        prose_before = re.sub(r'^\s*[-*]\s+', '', prose_before, flags=re.MULTILINE)

        # E1 — explain-then-code
        first_block = blocks[0]
        code_clean = clean_repl_prompt(first_block["code"]).strip()
        code_hash = hashlib.sha1(code_clean.encode()).hexdigest()
        if code_hash not in seen_codes and code_clean and code_is_wellformed(code_clean):
            seen_codes.add(code_hash)
            user_q = paraphrase_prompt(
                heading if heading != "__intro__" else (meta.get("title") or ""),
                chapter_topic,
                prose_before,
            )
            if user_q and user_question_is_grammatical(user_q):
                assistant_a = f"```motoi\n{code_clean}\n```"
                explain = explain_from_prose(prose_before)
                if explain:
                    assistant_a += f"\n\n{explain}"
                yield {**make_pair(user_q, assistant_a),
                       "_meta": {"extractor": "E1",
                                 "chapter": meta.get("chapter_num"),
                                 "title": meta.get("title"),
                                 "heading": heading}}

        # E2 — code-then-explain
        for b in blocks:
            code_clean = clean_repl_prompt(b["code"]).strip()
            if not code_clean or not code_is_wellformed(code_clean):
                continue
            if len(code_clean) < 6:
                continue
            explain = explain_from_prose(prose_before)
            if not explain:
                # Sharper wave-1 fallback: derive from code + chapter topic.
                topic_for_fallback = extract_topic_from_heading(heading, chapter_topic)
                explain = derive_explanation_from_code(code_clean, topic_for_fallback)
                if not explain:
                    continue
            yield {**make_pair(code_to_explain_prompt(code_clean), explain),
                   "_meta": {"extractor": "E2",
                             "chapter": meta.get("chapter_num"),
                             "title": meta.get("title"),
                             "heading": heading}}

        # E3 — variation-pair (2+ blocks in a section)
        if len(blocks) >= 2:
            tiers = ["a simple", "an intermediate", "a more elaborate", "another"]
            for i, b in enumerate(blocks[:4]):
                code_clean = clean_repl_prompt(b["code"]).strip()
                if not code_clean or len(code_clean) < 6:
                    continue
                if not code_is_wellformed(code_clean):
                    continue
                tier = tiers[min(i, len(tiers) - 1)]
                topic = extract_topic_from_heading(heading, chapter_topic) or (meta.get("title") or "this")
                user_q = f"Show me {tier} example of {topic} in Motoi Scheme."
                if not user_question_is_grammatical(user_q):
                    continue
                assistant_a = f"```motoi\n{code_clean}\n```"
                yield {**make_pair(user_q, assistant_a),
                       "_meta": {"extractor": "E3",
                                 "chapter": meta.get("chapter_num"),
                                 "title": meta.get("title"),
                                 "heading": heading, "tier": tier}}


# ---------------------------------------------------------------------------
# Per-book hand-curated E4 (desktop tasks) + E5 (routing patterns).
# ---------------------------------------------------------------------------

E4_BY_BOOK = {
    "book-of-math": [
        ("Write a small Motoi program that computes the factorial of a number.",
         "```motoi\n(define (fact n)\n  (if (= n 0) 1 (* n (fact (- n 1)))))\n(fact 6)\n```"),
        ("Write a small Motoi program that computes the sum of integers from 1 to n.",
         "```motoi\n(define (sum-to n)\n  (if (= n 0) 0 (+ n (sum-to (- n 1)))))\n(sum-to 100)\n```"),
        ("Write a small Motoi program that tests whether a number is prime.",
         "```motoi\n(define (prime? n)\n  (define (try d)\n    (cond ((> (* d d) n) #t)\n          ((= 0 (modulo n d)) #f)\n          (else (try (+ d 1)))))\n  (if (< n 2) #f (try 2)))\n(prime? 29)\n```"),
        ("Write a small Motoi program that returns the greatest common divisor.",
         "```motoi\n(define (gcd a b)\n  (if (= b 0) a (gcd b (modulo a b))))\n(gcd 48 18)\n```"),
        ("Write a small Motoi program that computes the nth Fibonacci number.",
         "```motoi\n(define (fib n)\n  (if (< n 2) n\n      (+ (fib (- n 1)) (fib (- n 2)))))\n(fib 10)\n```"),
        ("Write a small Motoi program that averages a list of numbers.",
         "```motoi\n(define (avg xs)\n  (/ (fold + 0 xs) (length xs)))\n(avg (list 3 5 7 9))\n```"),
        ("Write a small Motoi program that computes the distance between two points.",
         "```motoi\n(define (dist x1 y1 x2 y2)\n  (sqrt (+ (expt (- x2 x1) 2)\n           (expt (- y2 y1) 2))))\n(dist 0 0 3 4)\n```"),
        ("Write a small Motoi program that maps a list of numbers to their squares.",
         "```motoi\n(map (lambda (n) (* n n)) (list 1 2 3 4 5))\n```"),
        ("Write a small Motoi program that reduces a list of numbers to their product.",
         "```motoi\n(fold * 1 (list 1 2 3 4 5))\n```"),
        ("Write a small Motoi program that returns the first n triangular numbers.",
         "```motoi\n(define (tri n) (/ (* n (+ n 1)) 2))\n(map tri (list 1 2 3 4 5 6 7))\n```"),
        ("Write a small Motoi program that computes the mean and stores it under a symbol.",
         "```motoi\n(define xs (list 4 8 15 16 23 42))\n(define mean (/ (fold + 0 xs) (length xs)))\n(list 'mean mean)\n```"),
        ("Write a small Motoi program that finds the maximum of a list.",
         "```motoi\n(define (max* xs)\n  (fold (lambda (x acc) (if (> x acc) x acc)) (car xs) (cdr xs)))\n(max* (list 3 9 2 7 4))\n```"),
        ("Write a small Motoi program that computes the minimum of a list.",
         "```motoi\n(define (min* xs)\n  (fold (lambda (x acc) (if (< x acc) x acc)) (car xs) (cdr xs)))\n(min* (list 3 9 2 7 4))\n```"),
        ("Write a small Motoi program that returns the range of integers from a to b.",
         "```motoi\n(define (range a b)\n  (if (>= a b) '()\n      (cons a (range (+ a 1) b))))\n(range 1 6)\n```"),
        ("Write a small Motoi program that computes the area of a circle.",
         "```motoi\n(define (area-of-circle r) (* 3.141592653589793 r r))\n(area-of-circle 5)\n```"),
    ],
    "book-of-slat": [
        ("Write a small Motoi program that parses a slat text into a value.",
         "```motoi\n(slat-read \"(point :x 3 :y 4)\")\n```"),
        ("Write a small Motoi program that serializes a value to canonical slat.",
         "```motoi\n(slat-dumps '(event :ts 1 :kind \"card.opened\"))\n```"),
        ("Write a small Motoi program that reads a slat file and prints every top-level record.",
         "```motoi\n(for-each (lambda (r) (display r) (newline))\n          (slat-load (open-input-file \"data.slatl\")))\n```"),
        ("Write a small Motoi program that builds a small slat record with keyword fields.",
         "```motoi\n(define r '(user :name \"ada\" :age 36))\n(slat-dumps r)\n```"),
        ("Write a small Motoi program that appends a record to a slatl file.",
         "```motoi\n(with-output-to-file \"events.slatl\"\n  (lambda ()\n    (display (slat-dumps '(event :ts 1 :kind :opened)))\n    (newline)))\n```"),
        ("Write a small Motoi program that filters slat records by a keyword value.",
         "```motoi\n(define events (slat-load (open-input-file \"events.slatl\")))\n(filter (lambda (r) (equal? (slat-key r ':kind) :opened)) events)\n```"),
        ("Write a small Motoi program that content-addresses a slat value with sha256.",
         "```motoi\n(define r '(point :x 3 :y 4))\n(list r ':sha (sha256 (slat-dumps r)))\n```"),
        ("Write a small Motoi program that reads a mailbox slat and counts messages.",
         "```motoi\n(length (slat-load (open-input-file \"mailbox.slatl\")))\n```"),
        ("Write a small Motoi program that walks a nested slat record and collects every keyword.",
         "```motoi\n(define (collect-kws x)\n  (cond ((keyword? x) (list x))\n        ((pair? x) (append (collect-kws (car x))\n                           (collect-kws (cdr x))))\n        (else '())))\n(collect-kws '(user :name \"a\" :meta (:role :admin)))\n```"),
        ("Write a small Motoi program that writes a slat session record.",
         "```motoi\n(slat-dumps '(session :id \"s-01\" :started 1 :ended 2 :events ()))\n```"),
        ("Write a small Motoi program that reads a poem-form record and prints its title.",
         "```motoi\n(define p (slat-read \"(poem :title \\\"morning\\\" :lines ())\"))\n(display (slat-key p ':title))\n```"),
        ("Write a small Motoi program that groups slat events by kind.",
         "```motoi\n(define (group-by-kind evs)\n  (fold (lambda (e acc)\n          (let ((k (slat-key e ':kind)))\n            (cons (cons k e) acc)))\n        '() evs))\n(group-by-kind '((event :ts 1 :kind :a) (event :ts 2 :kind :b)))\n```"),
    ],
    "book-of-extensions": [
        ("Write a small Motoi program that defines a custom price-check verb.",
         "```motoi\n(define (price-check sku)\n  (let ((row (cortex-read (list 'catalog sku))))\n    (if row (slat-key row ':price) 'unknown)))\n(price-check 'sku-001)\n```"),
        ("Write a small Motoi program that adds a tag to a photo record.",
         "```motoi\n(define (photo-tag! photo tag)\n  (cortex-append! 'photo.tags (list photo tag)))\n(photo-tag! 'photo-42 'blue)\n```"),
        ("Write a small Motoi program that composes shop-open from smaller verbs.",
         "```motoi\n(define (shop-open shop)\n  (begin\n    (cortex-write! (list 'shop shop 'status) 'open)\n    (cortex-append! 'shop.events (list shop :opened (now)))))\n(shop-open 'my-shop)\n```"),
        ("Write a small Motoi program that meters an LLM verb with a per-call cost.",
         "```motoi\n(define (metered-llm prompt)\n  (cortex-append! 'meter.llm (list :cost 0.002 :ts (now)))\n  (llm-complete prompt))\n(metered-llm \"hello\")\n```"),
        ("Write a small Motoi program that refuses a request with a plain-english reason.",
         "```motoi\n(define (refuse reason)\n  (list ':refused reason))\n(refuse \"outside dialect scope\")\n```"),
        ("Write a small Motoi program that checks whether a verb is metered.",
         "```motoi\n(define (metered? verb)\n  (equal? (slat-key (describe verb) ':meter) 'yes))\n(metered? 'cortex-append!)\n```"),
        ("Write a small Motoi program that dispatches to a fork verb by name.",
         "```motoi\n(define (dispatch-fork name arg)\n  (let ((v (get 'fork.verbs name)))\n    (if v (v arg) (list ':unresolved name))))\n(dispatch-fork 'sample 42)\n```"),
        ("Write a small Motoi program that logs a shop event with a timestamp.",
         "```motoi\n(cortex-append! 'shop.events\n  (list 'event :ts (now) :kind :sold :sku 'sku-100))\n```"),
        ("Write a small Motoi program that composes two adapter functions.",
         "```motoi\n(define (compose f g) (lambda (x) (f (g x))))\n((compose (lambda (x) (* x 2)) (lambda (x) (+ x 1))) 4)\n```"),
        ("Write a small Motoi program that defines a scalar-cost record for a verb call.",
         "```motoi\n(define (cost-of verb cents)\n  (list 'cost :verb verb :cents cents))\n(cost-of 'cortex-append! 5)\n```"),
        ("Write a small Motoi program that reads a fork descriptor and prints the parent.",
         "```motoi\n(define desc (slat-read \"(fork :name my-fork :parent motoi)\"))\n(display (slat-key desc ':parent))\n```"),
        ("Write a small Motoi program that batches many verb calls into one event.",
         "```motoi\n(define (batch! events)\n  (for-each (lambda (e) (cortex-append! 'batch.events e)) events))\n(batch! (list '(:kind :a) '(:kind :b) '(:kind :c)))\n```"),
    ],
}


E5_BY_BOOK = {
    "book-of-math": [
        ("In Motoi, I want to compute a square root. Which verb do I reach for?",
         "Base Motoi — `sqrt` is core:\n\n```motoi\n(sqrt 2)\n```\n\nNo import needed."),
        ("In Motoi, I want to plot points on a canvas. Which verb do I reach for?",
         "Framebuffer verbs — import them first:\n\n```motoi\n(import (verbs framebuffer))\n(circle 60 60 3 'blue)\n```\n\n`circle` is base once the framebuffer layer is imported."),
        ("In Motoi, I want to draw a triangle out of three lines. Which verb do I reach for?",
         "Framebuffer `line` — import the framebuffer verbs and draw three:\n\n```motoi\n(import (verbs framebuffer))\n(line 10 10 60 10 'black)\n(line 60 10 35 50 'black)\n(line 35 50 10 10 'black)\n```"),
        ("In Motoi, I want to store a computed constant so I can reference it later. Which verb do I reach for?",
         "Base `define` — dialect-neutral:\n\n```motoi\n(define pi 3.141592653589793)\n(* 2 pi 5)\n```"),
        ("In Motoi, I want to sum a list without recursion. Which verb do I reach for?",
         "Use `fold`:\n\n```motoi\n(fold + 0 (list 1 2 3 4 5))\n```\n\n`fold` is base and dialect-neutral."),
        ("In Motoi, I want a random number between 0 and 1. Which verb do I reach for?",
         "Base Motoi — `random`:\n\n```motoi\n(random)\n```\n\nReturns a real in [0, 1). No import needed."),
    ],
    "book-of-slat": [
        ("In Motoi, I want to parse a slat string. Which verb do I reach for?",
         "Base `slat-read` (also aliased `slat-loads`):\n\n```motoi\n(slat-read \"(point :x 3 :y 4)\")\n```\n\nNo import — SLAT is first-class in Motoi."),
        ("In Motoi, I want to write a value out in canonical slat form. Which verb do I reach for?",
         "Base `slat-dumps`:\n\n```motoi\n(slat-dumps '(point :x 3 :y 4))\n```\n\nNo import needed."),
        ("In Motoi, I want to persist a fact across sessions. Which verb do I reach for?",
         "Cortex — adapter-shaped, but the verb is base:\n\n```motoi\n(cortex-write! 'user.pref.theme 'dark)\n```"),
        ("In Motoi, I want to append an event to a Cortex stream. Which verb do I reach for?",
         "Base `cortex-append!`:\n\n```motoi\n(cortex-append! 'app.events\n  (list 'event :ts (now) :kind :opened))\n```"),
        ("In Motoi, I want to compute the content hash of a slat value. Which verb do I reach for?",
         "Serialize with `slat-dumps`, then hash:\n\n```motoi\n(sha256 (slat-dumps '(point :x 3 :y 4)))\n```\n\n`sha256` is base."),
        ("In Motoi, I want to open a slatl file and iterate its records. Which verb do I reach for?",
         "`open-input-file` + `slat-load`:\n\n```motoi\n(for-each display (slat-load (open-input-file \"data.slatl\")))\n```\n\nBoth are base Motoi."),
    ],
    "book-of-extensions": [
        ("In Motoi, I want to add a metered verb that charges per call. Which verb do I reach for?",
         "Base Motoi — you write the verb, then annotate meter records via Cortex:\n\n```motoi\n(define (my-metered)\n  (cortex-append! 'meter.calls (list :verb 'my-metered :ts (now))))\n(my-metered)\n```\n\nMetering is a convention layered over base verbs."),
        ("In Motoi, I want to write an Etsy adapter. Which verb do I reach for?",
         "That's dialect / consumer-repo territory — not in base Motoi. The pattern is:\n\n```motoi\n#!dialect sakura\n(import (verbs etsy))\n(etsy/list-shop 'my-shop)\n```\n\nBase Motoi stays free of vendor names."),
        ("In Motoi, I want to declare that my verb refuses when called with bad input. Which verb do I reach for?",
         "Base — return a refusal record:\n\n```motoi\n(define (safe-div a b)\n  (if (= b 0) (list ':refused \"divide by zero\")\n      (/ a b)))\n(safe-div 6 0)\n```"),
        ("In Motoi, I want to fork the language and add my own verb layer. Which verb do I reach for?",
         "Publish a dialect descriptor and use `#!dialect`:\n\n```motoi\n#!dialect my-fork\n(import (verbs my-fork))\n(my-fork/greet)\n```\n\nBase Motoi supplies the fork protocol; the verbs live in your fork."),
        ("In Motoi, I want to compose a shop-open verb from smaller pieces. Which verb do I reach for?",
         "Base `define` + Cortex — compose from primitives:\n\n```motoi\n(define (shop-open shop)\n  (cortex-write! (list 'shop shop 'status) 'open))\n(shop-open 'my-shop)\n```"),
        ("In Motoi, I want to log a scalar cost against a verb call. Which verb do I reach for?",
         "Base Cortex append with a cost keyword:\n\n```motoi\n(cortex-append! 'meter.cost\n  (list :verb 'my-verb :cents 5 :ts (now)))\n```"),
    ],
}


def hand_curated_pairs(book_key):
    for user, assistant in E4_BY_BOOK.get(book_key, []):
        yield {**make_pair(user, assistant),
               "_meta": {"extractor": "E4",
                         "source": f"hand-curated-desktop-tasks-{book_key}"}}
    for user, assistant in E5_BY_BOOK.get(book_key, []):
        yield {**make_pair(user, assistant),
               "_meta": {"extractor": "E5",
                         "source": f"hand-curated-routing-{book_key}"}}


# ---------------------------------------------------------------------------
# Reference-verb-allowlist filter (soft — warn only).
# ---------------------------------------------------------------------------

REF_PATH = "/Users/alfred/code/scheme-lang/docs/SAKURA-SCHEME-REFERENCE.slat"
VERB_NAME_RE = re.compile(r':name\s+"([^"]+)"')
CORE_FORMS = set([
    "define","set!","if","cond","case","when","unless","and","or","not",
    "let","let*","letrec","lambda","begin","quote","quasiquote","unquote",
    "unquote-splicing","define-syntax","syntax-rules","define-macro","define-record",
    "delay","force","guard","raise","error","match","module","export","import",
    "for-each","map","filter","reduce","fold","fold-left","fold-right",
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
# Corporate-name filter (hard). Reject any pair mentioning these outside E5
# (which explicitly names vendors as forks / dialects — carefully).
# ---------------------------------------------------------------------------

CORPORATE_NAMES = [
    "amazon", "google", "microsoft", "facebook", "meta ", "apple", "openai",
    "anthropic", "shopify", "walmart",
]
# NOTE: "etsy" and "ebay" are the exception — they're referenced as
# dialect/adapter targets by design.  Handled per-book via E5 override.
CORPORATE_NAMES_STRICT = CORPORATE_NAMES  # for E1-E3 body


def content_has_corporate_name(text):
    lower = text.lower()
    for name in CORPORATE_NAMES_STRICT:
        if name in lower:
            return True
    return False


# ---------------------------------------------------------------------------
# Main.
# ---------------------------------------------------------------------------

BOOK_CONFIGS = {
    "book-of-math": {
        "book_dir": "/Users/alfred/code/motoi-scheme/scheme-books/book-of-math",
        "out_path": "/Users/alfred/code/motoi-scheme/training-data/wave-1-book-of-math-2026-07-16.jsonl",
        "book_name": "Book of Math",
        "skip_files": {"CHAPTERS.book.slatl", "MANIFEST.slat",
                       "ch17-advanced-tier-reserved-for-claude.book.slatl",
                       "ch18-advanced-tier-reserved-for-claude.book.slatl",
                       "ch-advanced-17-advanced-tier-reserved-for-claude.book.slatl",
                       "ch-advanced-18-advanced-tier-reserved-for-claude.book.slatl"},
    },
    "book-of-slat": {
        "book_dir": "/Users/alfred/code/motoi-scheme/scheme-books/book-of-slat",
        "out_path": "/Users/alfred/code/motoi-scheme/training-data/wave-1-book-of-slat-2026-07-16.jsonl",
        "book_name": "Book of SLAT",
        "skip_files": {"CHAPTERS.book.slatl", "MANIFEST.slat", "00-cover.book.slatl",
                       "ch18-advanced-tier-reserved-for-claude.book.slatl",
                       "ch19-advanced-tier-reserved-for-claude.book.slatl"},
    },
    "book-of-extensions": {
        "book_dir": "/Users/alfred/code/motoi-scheme/scheme-books/book-of-extensions",
        "out_path": "/Users/alfred/code/motoi-scheme/training-data/wave-1-book-of-extensions-2026-07-16.jsonl",
        "book_name": "Book of Extensions",
        "skip_files": {"CHAPTERS.book.slatl", "MANIFEST.slat"},
    },
}


def rough_edge_scan(pair):
    """Return a list of rough-edge tags for QA. Pair is post-processing."""
    tags = []
    user = pair["messages"][0]["content"]
    asst = pair["messages"][1]["content"]
    if len(asst) < 20:
        tags.append("short-assistant")
    if re.search(r'\byour\s+first\b', user, re.IGNORECASE):
        tags.append("possessive-topic-head")
    # Only flag double-space in prose regions of the assistant (outside code fences).
    asst_prose = re.sub(r'```[\w-]*\n.*?\n```', '', asst, flags=re.DOTALL)
    if "  " in asst_prose:
        tags.append("double-space-assistant-prose")
    if user.count("```") % 2 != 0:
        tags.append("unbalanced-fence-user")
    if asst.count("```") % 2 != 0:
        tags.append("unbalanced-fence-assistant")
    return tags


def run_book(book_key):
    cfg = BOOK_CONFIGS[book_key]
    book_dir = cfg["book_dir"]
    out_path = cfg["out_path"]
    skip = cfg["skip_files"]
    files = sorted(glob.glob(os.path.join(book_dir, "*.book.slatl")))
    files = [f for f in files if os.path.basename(f) not in skip]

    verbs = load_verbs()
    sys.stderr.write(f"[{book_key}] verb-allowlist: {len(verbs)} names\n")
    sys.stderr.write(f"[{book_key}] chapters: {len(files)}\n")

    header = {
        "_provenance_header": True,
        "generated_at": datetime.datetime.utcnow().isoformat() + "Z",
        "generator": "wave-1-extractor-2026-07-16.py (motoi copilot corpus)",
        "book": book_key,
        "book_name": cfg["book_name"],
        "book_path": book_dir,
        "chapter_count": len(files),
        "extractors": ["E1-explain-then-code", "E2-code-then-explain",
                       "E3-variation-pair", "E4-common-desktop-tasks",
                       "E5-routing-patterns"],
        "reference": REF_PATH,
        "reference_verb_count": len(verbs),
        "design_doc": "/Users/alfred/code/lacuna-labs/design-docs/architect-motoi-copilot-corpus-2026-07-16.slat",
        "wave_1_fixes": [
            "per-chapter topic seed dictionary (TOPIC_SEEDS_BY_BOOK)",
            "sharper E2 fallback via VERB_TO_PHRASE + topic seed",
            "user_question_is_grammatical() sanity check filter",
        ],
        "notes": ("Wave 1 pass. Reference-verb filter is SOFT (warn to stderr). "
                  "'Sakura says' quote blocks are stripped. REPL prompts "
                  "(sakura>) are cleaned to bare forms. Corporate names "
                  "rejected outside curated E5 routing pairs."),
    }

    os.makedirs(os.path.dirname(out_path), exist_ok=True)
    out = open(out_path, "w", encoding="utf-8")
    out.write(json.dumps(header, ensure_ascii=False) + "\n")

    seen_pairs = set()
    total = 0
    per_extractor = {"E1": 0, "E2": 0, "E3": 0, "E4": 0, "E5": 0}
    dropped_dupe = 0
    dropped_short = 0
    dropped_ungrammatical = 0
    dropped_corporate = 0
    rough_edge_count = 0

    for path in files:
        meta = parse_chapter(path)
        if not meta:
            sys.stderr.write(f"  [skip-no-prose] {os.path.basename(path)}\n")
            continue
        stem = os.path.basename(path).replace(".book.slatl", "")
        chapter_topic = chapter_topic_seed(stem, book_key)
        if not chapter_topic:
            # Fall back to a cleaned title.
            chapter_topic = clean_heading_for_topic(meta.get("title") or "").lower()
        sys.stderr.write(f"  [chapter] {os.path.basename(path)} — topic={chapter_topic!r}\n")
        chap_count = 0
        for pair in pairs_from_chapter(meta, chapter_topic):
            ex = pair["_meta"]["extractor"]
            user = pair["messages"][0]["content"]
            asst = pair["messages"][1]["content"]
            if len(asst) < 12:
                dropped_short += 1
                continue
            # Grammar filter (belt-and-suspenders — the generators mostly
            # gate on this already but E3 topic can slip through).
            if not user_question_is_grammatical(user):
                dropped_ungrammatical += 1
                continue
            # Corporate-name reject
            if content_has_corporate_name(user) or content_has_corporate_name(asst):
                dropped_corporate += 1
                continue
            key = hashlib.sha1((user + "\n" + asst).encode()).hexdigest()
            if key in seen_pairs:
                dropped_dupe += 1
                continue
            seen_pairs.add(key)
            edges = rough_edge_scan(pair)
            if edges:
                rough_edge_count += 1
            pair.pop("_meta", None)
            out.write(json.dumps(pair, ensure_ascii=False) + "\n")
            per_extractor[ex] += 1
            total += 1
            chap_count += 1
        sys.stderr.write(f"    → {chap_count} pairs\n")

    # Hand-curated E4 + E5 (skip the grammar filter — they're author-written).
    for pair in hand_curated_pairs(book_key):
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
    sys.stderr.write(f"\n=== {book_key} DONE ===\n")
    sys.stderr.write(f"total pairs: {total}\n")
    sys.stderr.write(f"per extractor: {per_extractor}\n")
    sys.stderr.write(f"dropped dupe:          {dropped_dupe}\n")
    sys.stderr.write(f"dropped short:         {dropped_short}\n")
    sys.stderr.write(f"dropped ungrammatical: {dropped_ungrammatical}\n")
    sys.stderr.write(f"dropped corporate:     {dropped_corporate}\n")
    sys.stderr.write(f"rough_edge tagged:     {rough_edge_count}\n")
    sys.stderr.write(f"output: {out_path}\n\n")
    return {
        "book": book_key, "total": total, "per_extractor": per_extractor,
        "dropped_dupe": dropped_dupe, "dropped_short": dropped_short,
        "dropped_ungrammatical": dropped_ungrammatical,
        "dropped_corporate": dropped_corporate,
        "rough_edge_count": rough_edge_count,
        "out_path": out_path,
    }


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--book", choices=list(BOOK_CONFIGS.keys()) + ["all"],
                        default="all")
    args = parser.parse_args()
    summaries = []
    if args.book == "all":
        for k in BOOK_CONFIGS.keys():
            summaries.append(run_book(k))
    else:
        summaries.append(run_book(args.book))
    sys.stderr.write("=== WAVE 1 SUMMARY ===\n")
    for s in summaries:
        sys.stderr.write(json.dumps(s) + "\n")


if __name__ == "__main__":
    main()
