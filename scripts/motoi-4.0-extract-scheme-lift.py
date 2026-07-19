#!/usr/bin/env python3
"""
motoi-4.0-extract-scheme-lift.py — Motoi 4.0 coverage lane (Ada, 2026-07-18).

Extract Scheme-lift training pairs for Motoi 4.0. Six extraction passes:

1. verb-recall  — "what does X do?" -> :summary paragraph
2. verb-use     — "run (X args)" -> assistant returns the result (from :note)
3. verb-example — "show me an example of X" -> code + note
4. verb-contrast — for close-cousin verb pairs: "X vs Y?" (from :related)
5. book-* — recall/explain/use pairs from Book of R7RS Recipes chapters
6. composition-multi-step — from the capstones in each chapter

Emits to:
  ~/.forge/corpus/motoi-v6-partial/scheme-lift.jsonl

Provenance chain on every pair: :from-book, :chapter/:section, :extract-method.
Every pair is deterministic (no randomness in extraction).
"""

from __future__ import annotations
import json
import re
import sys
import hashlib
from pathlib import Path
from datetime import datetime, timezone
from collections import defaultdict

REF = Path("/Users/alfred/code/motoi-scheme/scheme/MOTOI-SCHEME-REFERENCE.slat")
BOOKS_DIR = Path("/Users/alfred/code/motoi-scheme/scheme-books")
OUT_DIR = Path.home() / ".forge/corpus/motoi-v6-partial"
OUT_DIR.mkdir(parents=True, exist_ok=True)
OUT_JSONL = OUT_DIR / "scheme-lift.jsonl"

GEN_AT = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
SYSTEM_PROMPT = "You are Motoi, a Scheme copilot. Answer with clean, correct Scheme code."

# ─────────────────────────────────────────────────────────────────────
# SLAT parse helpers (shared with reference-example-extractor.py)
# ─────────────────────────────────────────────────────────────────────

def unescape(s: str) -> str:
    out = []
    i = 0
    n = len(s)
    while i < n:
        c = s[i]
        if c == '\\' and i + 1 < n:
            nxt = s[i+1]
            m = {'n': '\n', 't': '\t', 'r': '\r', '"': '"', '\\': '\\'}.get(nxt, nxt)
            out.append(m)
            i += 2
        else:
            out.append(c)
            i += 1
    return "".join(out)


def kw_string(form: str, key: str):
    pat = rf':{re.escape(key)}\s+"((?:[^"\\]|\\.)*)"'
    m = re.search(pat, form)
    return unescape(m.group(1)) if m else None


def extract_examples_body(verb_form: str):
    m = re.search(r':examples\s*\(', verb_form)
    if not m:
        return None
    open_idx = m.end() - 1
    depth = 0
    in_str = False
    i = open_idx
    n = len(verb_form)
    while i < n:
        c = verb_form[i]
        if in_str:
            if c == '\\': i += 2; continue
            if c == '"': in_str = False
        else:
            if c == '"': in_str = True
            elif c == '(': depth += 1
            elif c == ')':
                depth -= 1
                if depth == 0:
                    return verb_form[open_idx+1:i]
        i += 1
    return None


def split_toplevel_forms(text: str, tag: str | None = None):
    """Yield each top-level (form ...) — optionally filtered to (tag ...)."""
    i = 0
    n = len(text)
    while i < n:
        while i < n and text[i] != '(':
            i += 1
        if i >= n: break
        start = i
        depth = 0
        in_str = False
        while i < n:
            c = text[i]
            if in_str:
                if c == '\\': i += 2; continue
                if c == '"': in_str = False
            else:
                if c == '"': in_str = True
                elif c == '(': depth += 1
                elif c == ')':
                    depth -= 1
                    if depth == 0:
                        i += 1
                        form = text[start:i]
                        if tag is None or form.startswith(f'({tag}'):
                            yield form
                        break
            i += 1


def parse_examples(examples_body: str):
    """Return list of {dialect, tier, code, note}."""
    results = []
    # Walk with paren-balance to find each nested form
    for form in split_toplevel_forms(examples_body):
        d = {
            'dialect': kw_string(form, 'dialect'),
            'tier': kw_string(form, 'tier'),
            'code': kw_string(form, 'code'),
            'note': kw_string(form, 'note') or '',
        }
        if d['code']:
            results.append(d)
    return results


def kw_list_of_strings(form: str, key: str):
    """Extract a :key (\"x\" \"y\" ...) list of strings."""
    pat = rf':{re.escape(key)}\s*\('
    m = re.search(pat, form)
    if not m:
        return None
    open_idx = m.end() - 1
    depth = 0
    in_str = False
    i = open_idx
    n = len(form)
    while i < n:
        c = form[i]
        if in_str:
            if c == '\\': i += 2; continue
            if c == '"': in_str = False
        else:
            if c == '"': in_str = True
            elif c == '(': depth += 1
            elif c == ')':
                depth -= 1
                if depth == 0:
                    body = form[open_idx+1:i]
                    return [unescape(s) for s in re.findall(r'"((?:[^"\\]|\\.)*)"', body)]
        i += 1
    return None


# ─────────────────────────────────────────────────────────────────────
# Load reference verbs
# ─────────────────────────────────────────────────────────────────────

def load_verbs():
    """Return list of dicts with keys: name, library, summary, examples, related, signature."""
    text = REF.read_text()
    verbs = []
    for form in split_toplevel_forms(text, 'verb'):
        name = kw_string(form, 'name')
        if not name:
            continue
        body = extract_examples_body(form)
        examples = parse_examples(body) if body else []
        verbs.append({
            'name': name,
            'library': kw_string(form, 'library') or '',
            'summary': kw_string(form, 'summary') or '',
            'explanation': kw_string(form, 'explanation') or '',
            'signature': kw_string(form, 'signature') or '',
            'examples': examples,
            'related': kw_list_of_strings(form, 'related') or [],
            'provenance': kw_string(form, 'provenance') or '',
        })
    return verbs


# ─────────────────────────────────────────────────────────────────────
# Pair emitters
# ─────────────────────────────────────────────────────────────────────

def make_pair(user, assistant, bucket, verb=None, provenance=None):
    return {
        'messages': [
            {'role': 'system', 'content': SYSTEM_PROMPT},
            {'role': 'user', 'content': user},
            {'role': 'assistant', 'content': assistant},
        ],
        'meta': {
            'bucket': bucket,
            'verb': verb,
            'provenance': provenance,
        },
    }


def phash(text: str) -> str:
    return hashlib.sha256(text.encode()).hexdigest()[:12]


# 1. verb-recall pairs (what does X do?)
RECALL_TEMPLATES = [
    "what does {verb} do?",
    "what's {verb}?",
    "explain {verb}.",
    "what is {verb} for?",
    "tell me about {verb}.",
    "describe {verb}.",
]

def emit_recall_pairs(verbs):
    pairs = []
    for i, v in enumerate(verbs):
        if not v['summary']:
            continue
        # 2 pairs per verb, rotating templates
        for j in range(2):
            template = RECALL_TEMPLATES[(i + j) % len(RECALL_TEMPLATES)]
            user = template.format(verb=v['name'])
            assistant = f"`{v['name']}` — {v['summary']}"
            pairs.append(make_pair(
                user, assistant,
                bucket='verb-recall',
                verb=v['name'],
                provenance={
                    'reference-file': 'scheme/MOTOI-SCHEME-REFERENCE.slat',
                    'verb': v['name'],
                    'library': v['library'],
                    'source-field': 'summary',
                    'template-index': j,
                    'extract-method': 'summary-template-rotation',
                    'summary-hash': phash(v['summary']),
                },
            ))
    return pairs


# 2. verb-use pairs (run (X args) => result from :note)
def emit_use_pairs(verbs):
    """Extract 'run this' / 'what does this return' from examples where the
    :note explicitly states a return value. Very conservative — only extract
    when the note matches a KNOWN shape that we can confidently attribute:

    Shape A: whole-note IS the result (ends with period or nothing):
      "5.", "#t.", "(1 2 3).", "\"hello\".", "'foo."

    Shape B: "returns X." or "returns X" — take X.

    Skip anything ambiguous."""
    pairs = []

    # Shape A: note is EXACTLY a single result token (with optional trailing period)
    # Result forms:
    #   #t / #f
    #   integer / decimal / rational
    #   "string"
    #   (list ...)
    #   'symbol
    #   #(vector ...)
    #   #u8(bytevector ...)
    shape_a = re.compile(
        r'^(#[tf]|'                           # #t #f
        r'-?\d+(?:\.\d+)?(?:e[-+]?\d+)?(?:/\d+)?|'  # numbers
        r'"(?:[^"\\]|\\.)*"|'                 # strings
        r'\'[a-zA-Z][a-zA-Z0-9_?!<>*+/=.-]*|' # 'symbol
        r'\((?:[^()"]|"(?:[^"\\]|\\.)*")*\)|'  # single-paren list (no nesting)
        r'#\((?:[^()"]|"(?:[^"\\]|\\.)*")*\)|' # vector
        r'#u8\([^)]*\)'                        # bytevector
        r')\s*\.?\s*$'
    )
    # Shape B: "returns X." or "-> X" or "=> X"
    shape_b = re.compile(
        r'(?:returns?|->|=>)\s+'
        r'(#[tf]|'
        r'-?\d+(?:\.\d+)?(?:e[-+]?\d+)?(?:/\d+)?|'
        r'"(?:[^"\\]|\\.)*"|'
        r'\'[a-zA-Z][a-zA-Z0-9_?!<>*+/=.-]*|'
        r'\((?:[^()"]|"(?:[^"\\]|\\.)*")*\)|'
        r'#\((?:[^()"]|"(?:[^"\\]|\\.)*")*\)|'
        r'#u8\([^)]*\)'
        r')\b'
    )

    for v in verbs:
        for i, ex in enumerate(v['examples']):
            code = ex['code'].strip()
            note = ex['note'].strip()
            if not note:
                continue
            # Multi-line codes are complex; skip for use-pair extraction
            if '\n' in code:
                continue

            result = None
            m = shape_a.match(note)
            if m:
                result = m.group(1)
            else:
                m = shape_b.search(note)
                if m:
                    result = m.group(1)

            if not result:
                continue
            # Two prompt shapes
            user_a = f"run {code}"
            user_b = f"what does {code} return?"
            assistant = result
            pairs.append(make_pair(
                user_a, assistant,
                bucket='verb-use',
                verb=v['name'],
                provenance={
                    'reference-file': 'scheme/MOTOI-SCHEME-REFERENCE.slat',
                    'verb': v['name'],
                    'library': v['library'],
                    'source-field': 'examples',
                    'example-index': i,
                    'tier': ex['tier'],
                    'extract-method': 'run-code-return-from-note',
                    'code-hash': phash(code),
                },
            ))
            pairs.append(make_pair(
                user_b, assistant,
                bucket='verb-use',
                verb=v['name'],
                provenance={
                    'reference-file': 'scheme/MOTOI-SCHEME-REFERENCE.slat',
                    'verb': v['name'],
                    'library': v['library'],
                    'source-field': 'examples',
                    'example-index': i,
                    'tier': ex['tier'],
                    'extract-method': 'what-returns-code-return-from-note',
                    'code-hash': phash(code),
                },
            ))
    return pairs


# 3. verb-example pairs (show me an example)
EXAMPLE_TEMPLATES = [
    ("Show me `{verb}` at the {tier} level.", "tiered"),
    ("Give me {an} {tier}-level example of `{verb}` in Motoi.", "tiered"),
    ("Write {an} {tier} Motoi example that uses `{verb}`.", "tiered"),
    ("Show me an example of `{verb}` in Motoi.", "untiered"),
    ("How do I use `{verb}` in Motoi? Show me code.", "untiered"),
    ("Give me an example of `{verb}`.", "untiered"),
]

def _an(w):
    return 'an' if w[:1].lower() in 'aeiou' else 'a'


def emit_example_pairs(verbs):
    """One 'example' pair per :examples entry, similar shape to
    reference-examples.jsonl but with explicit meta.provenance."""
    pairs = []
    for v in verbs:
        for i, ex in enumerate(v['examples']):
            code = ex['code'].strip()
            note = ex['note'].strip()
            tier = ex['tier'] or 'novice'
            # Pick template
            if tier:
                template_str, kind = EXAMPLE_TEMPLATES[i % 3]
                user = template_str.format(verb=v['name'], tier=tier, an=_an(tier))
            else:
                template_str, kind = EXAMPLE_TEMPLATES[3 + (i % 3)]
                user = template_str.format(verb=v['name'])
            assistant = f"```motoi\n{code}\n```"
            if note:
                assistant += f"\n\n{note}"
            pairs.append(make_pair(
                user, assistant,
                bucket='verb-example',
                verb=v['name'],
                provenance={
                    'reference-file': 'scheme/MOTOI-SCHEME-REFERENCE.slat',
                    'verb': v['name'],
                    'library': v['library'],
                    'source-field': 'examples',
                    'example-index': i,
                    'tier': tier,
                    'extract-method': 'reference-example-fenced',
                    'code-hash': phash(code),
                },
            ))
    return pairs


# 4. verb-contrast pairs (X vs Y from :related)
def emit_contrast_pairs(verbs):
    """For each verb, if it has related verbs and both summaries exist,
    emit a 'X vs Y?' pair. Deduplicate on pair-name-set.
    Cap to at most 3 related-verb contrasts per verb to keep density
    balanced against verb-recall / verb-use / verb-example."""
    by_name = {v['name']: v for v in verbs}
    seen = set()
    pairs = []
    for v in verbs:
        if not v['summary']:
            continue
        emitted_for_v = 0
        for other_name in v['related']:
            if emitted_for_v >= 3:
                break
            if other_name not in by_name:
                continue
            other = by_name[other_name]
            if not other['summary']:
                continue
            key = tuple(sorted([v['name'], other_name]))
            if key in seen:
                continue
            seen.add(key)
            user = f"{v['name']} vs {other_name}?"
            assistant = (
                f"`{v['name']}` — {v['summary']}\n"
                f"`{other_name}` — {other['summary']}"
            )
            pairs.append(make_pair(
                user, assistant,
                bucket='verb-contrast',
                verb=v['name'],
                provenance={
                    'reference-file': 'scheme/MOTOI-SCHEME-REFERENCE.slat',
                    'verb-a': v['name'],
                    'verb-b': other_name,
                    'source-field': 'summary + related',
                    'extract-method': 'related-cross-summary',
                },
            ))
            emitted_for_v += 1
    return pairs


# 5. book-* pairs (recall / explain / use from R7RS Recipes chapters)
def load_book_chapter(path: Path):
    text = path.read_text()
    prose = kw_string(text, 'prose') or ''
    title = kw_string(text, 'title') or ''
    chapter_num = None
    m = re.search(r':chapter-number\s+(\d+)', text)
    if m:
        chapter_num = int(m.group(1))
    return {'path': str(path), 'title': title, 'chapter': chapter_num, 'prose': prose}


def extract_code_blocks(prose: str):
    """Extract ``` ... ``` fenced blocks."""
    return re.findall(r'```(?:motoi)?\n(.*?)```', prose, re.DOTALL)


def extract_h2_sections(prose: str):
    """Split by ## headings; return [(heading, body)]."""
    sections = []
    parts = re.split(r'\n## ', prose)
    if not parts: return []
    # First part is pre-first-heading
    for i, part in enumerate(parts[1:], 1):
        head_end = part.find('\n')
        heading = part[:head_end].strip() if head_end != -1 else part.strip()
        body = part[head_end+1:] if head_end != -1 else ''
        sections.append((heading, body))
    return sections


def emit_book_pairs(book_name: str, chapters: list):
    """Emit book-recall + book-explain + book-use pairs from chapters."""
    pairs = []
    for ch in chapters:
        title = ch['title']
        chnum = ch['chapter']
        prose = ch['prose']
        # Extract fenced code blocks
        code_blocks = extract_code_blocks(prose)
        sections = extract_h2_sections(prose)

        # book-recall: "what does chapter N of {book_name} teach?" -> title
        pairs.append(make_pair(
            f"what does chapter {chnum} of the {book_name} teach?",
            f"Chapter {chnum} — {title}.",
            bucket='book-recall',
            verb=None,
            provenance={
                'book': book_name,
                'chapter': chnum,
                'source-file': ch['path'],
                'source-field': 'title',
                'extract-method': 'title-recall',
            },
        ))
        pairs.append(make_pair(
            f"what's the {book_name} chapter about {title.split(' — ')[0] if ' — ' in title else title[:20]}?",
            f"Chapter {chnum} — {title}.",
            bucket='book-recall',
            verb=None,
            provenance={
                'book': book_name,
                'chapter': chnum,
                'source-file': ch['path'],
                'source-field': 'title',
                'extract-method': 'topic-recall',
            },
        ))

        # book-explain: For each ## section, emit "what is X?" or "explain X"
        for heading, body in sections:
            # Skip "What's next" etc — take content-y sections
            if heading.lower() in ('what\'s next', 'alphabet', 'what next'):
                continue
            # Truncate body to first 2 paragraphs for a concise explanation
            paras = [p.strip() for p in body.split('\n\n') if p.strip()]
            if not paras:
                continue
            # Skip if body is a code block
            first_para = paras[0]
            if first_para.startswith('```'):
                continue
            # Use up to 2 non-code paragraphs
            explanation_paras = []
            for p in paras[:4]:
                if p.startswith('```') or p.startswith(';;'):
                    continue
                explanation_paras.append(p)
                if len(explanation_paras) >= 2:
                    break
            if not explanation_paras:
                continue
            explanation = '\n\n'.join(explanation_paras)
            # Skip too-long or too-short
            if len(explanation) < 50 or len(explanation) > 800:
                continue

            # Sanitize heading: strip trailing punctuation
            hclean = heading.rstrip('.,?!').strip()
            # Skip "Problem 1 — ..." style headings
            if hclean.lower().startswith(('problem ', 'capstone', 'alphabet of')):
                # These are worked examples — save for book-use
                continue

            # Emit book-explain pair
            user = f"what does '{hclean}' mean in the {book_name}?"
            assistant = explanation
            pairs.append(make_pair(
                user, assistant,
                bucket='book-explain',
                verb=None,
                provenance={
                    'book': book_name,
                    'chapter': chnum,
                    'source-file': ch['path'],
                    'source-field': 'prose',
                    'section-heading': hclean,
                    'extract-method': 'h2-section-first-paragraphs',
                    'prose-hash': phash(explanation),
                },
            ))

        # book-use: Take each fenced code block and emit "how do I ___?" -> code
        # Use surrounding context (previous heading) to describe the intent
        current_heading = title
        # Walk through prose looking for h2 and code blocks in sequence
        for match in re.finditer(r'(?:\n## ([^\n]+)\n)|(?:```(?:motoi)?\n(.*?)```)', prose, re.DOTALL):
            if match.group(1):
                current_heading = match.group(1).strip()
            elif match.group(2):
                code = match.group(2).strip()
                if not code:
                    continue
                # Skip trivial or output-only blocks
                if code.count('\n') == 0 and len(code) < 20:
                    continue
                # Skip pure output blocks (all lines start with ;;)
                if all(l.strip().startswith(';;') or not l.strip() for l in code.splitlines()):
                    continue
                # Extract just the code (drop ;; => lines) for the assistant reply
                code_lines = [l for l in code.splitlines() if not l.strip().startswith(';;')]
                clean_code = '\n'.join(code_lines).strip()
                if not clean_code or len(clean_code) < 20:
                    continue

                # Build user prompt from heading context
                hclean = current_heading.rstrip('.,?!').strip()
                if hclean.lower().startswith('problem '):
                    # "Problem N — description" -> extract description
                    parts = hclean.split(' — ', 1)
                    if len(parts) == 2:
                        hclean = parts[1]
                elif hclean.lower().startswith('capstone'):
                    parts = hclean.split(' — ', 1)
                    if len(parts) == 2:
                        hclean = parts[1]

                user = f"in Motoi, how do I: {hclean}?"
                assistant = f"```motoi\n{clean_code}\n```"
                pairs.append(make_pair(
                    user, assistant,
                    bucket='book-use',
                    verb=None,
                    provenance={
                        'book': book_name,
                        'chapter': chnum,
                        'source-file': ch['path'],
                        'source-field': 'prose-code-block',
                        'section-heading': current_heading,
                        'extract-method': 'contextual-code-lift',
                        'code-hash': phash(clean_code),
                    },
                ))
    return pairs


# 6. composition-multi-step pairs — build from R7RS Recipes capstones
def emit_composition_multi_step_pairs(chapters):
    """For each capstone in the R7RS Recipes chapters, emit a multi-step
    composition pair: user asks "walk me through X"; assistant gives the
    capstone code + explanation."""
    pairs = []
    for ch in chapters:
        prose = ch['prose']
        title = ch['title']
        chnum = ch['chapter']

        # Find the Capstone section
        cm = re.search(r'\n## Capstone[^\n]*\n(.*?)(?=\n## |\Z)', prose, re.DOTALL)
        if not cm:
            continue
        capstone_body = cm.group(1)

        # Extract capstone code + explanation
        code_blocks = re.findall(r'```(?:motoi)?\n(.*?)```', capstone_body, re.DOTALL)
        if not code_blocks:
            continue
        code = code_blocks[0].strip()
        # Get paragraphs of explanation (before and after first code block)
        parts = re.split(r'```(?:motoi)?\n.*?```', capstone_body, maxsplit=1, flags=re.DOTALL)
        pre = parts[0].strip() if parts else ''
        post = parts[1].strip() if len(parts) > 1 else ''

        # Truncate post to first 2 paragraphs
        post_paras = [p.strip() for p in post.split('\n\n') if p.strip() and not p.strip().startswith(';;')]
        post_short = '\n\n'.join(post_paras[:2])[:600]

        user = f"walk me through the capstone from chapter {chnum} of the Book of R7RS Recipes"
        assistant_parts = []
        if pre and len(pre) < 400:
            assistant_parts.append(pre)
        assistant_parts.append(f"```motoi\n{code}\n```")
        if post_short:
            assistant_parts.append(post_short)
        assistant = "\n\n".join(assistant_parts)

        pairs.append(make_pair(
            user, assistant,
            bucket='composition-multi-step',
            verb=None,
            provenance={
                'book': 'Book of R7RS Recipes',
                'chapter': chnum,
                'source-file': ch['path'],
                'source-field': 'capstone-section',
                'section-heading': 'Capstone',
                'extract-method': 'capstone-full-lift',
                'code-hash': phash(code),
            },
        ))

        # Also emit an alternate "solve X" prompt from the title
        clean_title = title.split(' — ')[-1] if ' — ' in title else title
        user2 = f"show me the capstone solution using {clean_title.lower()}"
        pairs.append(make_pair(
            user2, assistant,
            bucket='composition-multi-step',
            verb=None,
            provenance={
                'book': 'Book of R7RS Recipes',
                'chapter': chnum,
                'source-file': ch['path'],
                'source-field': 'capstone-section',
                'section-heading': 'Capstone',
                'extract-method': 'capstone-alternate-prompt',
                'code-hash': phash(code),
            },
        ))
    return pairs


# ─────────────────────────────────────────────────────────────────────
# Main
# ─────────────────────────────────────────────────────────────────────

def main():
    print("Loading verbs from reference...")
    verbs = load_verbs()
    print(f"  {len(verbs)} verbs loaded")

    # Load Book of R7RS Recipes chapters
    r7rs_book_dir = BOOKS_DIR / "book-of-r7rs-recipes"
    r7rs_chapters = []
    for p in sorted(r7rs_book_dir.glob("*.book.slatl")):
        r7rs_chapters.append(load_book_chapter(p))
    print(f"  {len(r7rs_chapters)} R7RS Recipes chapters loaded")

    # Also load Book of Sick Composition chapters (existing content)
    sick_dir = BOOKS_DIR / "book-of-sick-composition"
    sick_chapters = []
    for p in sorted(sick_dir.glob("*.book.slatl")):
        sick_chapters.append(load_book_chapter(p))
    print(f"  {len(sick_chapters)} Sick Composition chapters loaded")

    all_pairs = []

    # Pass 1: verb-recall (~1600 pairs @ 2/verb)
    print("\nPass 1: verb-recall pairs from :summary...")
    recall = emit_recall_pairs(verbs)
    all_pairs.extend(recall)
    print(f"  emitted {len(recall)} verb-recall pairs")

    # Pass 2: verb-use (~1000+ pairs from clean results)
    print("Pass 2: verb-use pairs from example :code + :note results...")
    use = emit_use_pairs(verbs)
    all_pairs.extend(use)
    print(f"  emitted {len(use)} verb-use pairs")

    # Pass 3: verb-example (~3500 pairs)
    print("Pass 3: verb-example pairs from :examples...")
    ex = emit_example_pairs(verbs)
    all_pairs.extend(ex)
    print(f"  emitted {len(ex)} verb-example pairs")

    # Pass 4: verb-contrast (~150 pairs from :related)
    print("Pass 4: verb-contrast pairs from :related...")
    contrast = emit_contrast_pairs(verbs)
    all_pairs.extend(contrast)
    print(f"  emitted {len(contrast)} verb-contrast pairs")

    # Pass 5: book-* pairs from R7RS Recipes
    print("Pass 5: book-* pairs from Book of R7RS Recipes...")
    book_r7rs = emit_book_pairs("Book of R7RS Recipes", r7rs_chapters)
    all_pairs.extend(book_r7rs)
    print(f"  emitted {len(book_r7rs)} book-* pairs (R7RS Recipes)")

    # Pass 5b: book-* pairs from Sick Composition
    print("Pass 5b: book-* pairs from Book of Sick Composition...")
    book_sick = emit_book_pairs("Book of Sick Composition", sick_chapters)
    all_pairs.extend(book_sick)
    print(f"  emitted {len(book_sick)} book-* pairs (Sick Composition)")

    # Pass 6: composition-multi-step from capstones
    print("Pass 6: composition-multi-step from capstones...")
    capstones = emit_composition_multi_step_pairs(r7rs_chapters + sick_chapters)
    all_pairs.extend(capstones)
    print(f"  emitted {len(capstones)} composition-multi-step pairs")

    # Write out
    print(f"\nTotal pairs: {len(all_pairs)}")
    with OUT_JSONL.open("w") as f:
        # Header
        header = {
            "_provenance_header": True,
            "generated_at": GEN_AT,
            "generator": "motoi-4.0-extract-scheme-lift.py (Ada motoi-4.0 lane)",
            "source-reference": str(REF),
            "source-book-r7rs": str(r7rs_book_dir),
            "source-book-sick": str(sick_dir),
            "system_prompt": SYSTEM_PROMPT,
            "note": "Motoi 4.0 Scheme lift. Provenance chain on every pair.",
        }
        f.write(json.dumps(header) + "\n")
        for p in all_pairs:
            f.write(json.dumps(p, ensure_ascii=False) + "\n")

    # Bucket distribution
    buckets = defaultdict(int)
    for p in all_pairs:
        buckets[p['meta']['bucket']] += 1
    print("\nBucket distribution:")
    for b, c in sorted(buckets.items()):
        print(f"  {b}: {c}")
    print(f"\nOutput: {OUT_JSONL}")
    print(f"Rows: {len(all_pairs) + 1} (incl. header)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
