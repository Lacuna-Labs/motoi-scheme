#!/usr/bin/env python3
"""
Motoi Reference Rebrand tool — 2026-07-16.

STEP 2  audit every :example field per verb record. Detect any Sakura
        dialect verb references. Rewrite to Motoi equivalents where a
        clean substitution exists; flag as "stuck" where it does not.

STEP 4  sweep residual "Sakura" text in prose fields (:explanation,
        :summary, :caveats, :drawbacks, :learn, :note, comments) and
        rewrite to "Motoi" where the reference is to the language
        (not to the Sakura character/dialect).

Anti-fabrication doctrine: NEVER invent Motoi equivalents. If the
Sakura verb has no clear equivalent in the audit set, we flag and skip.

Operates one-verb-at-a-time. Reads MOTOI-SCHEME-REFERENCE.slat, writes
the same file (in place), plus a stuck-examples report and a change log.
"""

import re
import sys
import json
from pathlib import Path

REF_PATH = Path("/Users/alfred/code/motoi-scheme/scheme/MOTOI-SCHEME-REFERENCE.slat")
AUDIT_PATH = Path("/Users/alfred/code/motoi-scheme/scratch/reference-audit-2026-07-16.slat")
STUCK_PATH = Path("/Users/alfred/code/motoi-scheme/scratch/_stuck-examples-2026-07-16.slat")
CHANGES_PATH = Path("/Users/alfred/code/motoi-scheme/scratch/_rebrand-changes-2026-07-16.json")


# --------------------------------------------------------------------------
# Load Sakura verb list from audit
# --------------------------------------------------------------------------

def load_sakura_verbs():
    """Return set of Sakura-dialect verb names."""
    text = AUDIT_PATH.read_text()
    pattern = re.compile(r'\(classify\s+:name\s+"([^"]+)"\s+:library\s+"([^"]+)"\s+:class\s+:SAKURA-DIALECT\)')
    verbs = set()
    for m in pattern.finditer(text):
        verbs.add(m.group(1))
    return verbs


def load_motoi_verbs():
    """Return set of Motoi-base verb names (accepted set for reference-check)."""
    text = AUDIT_PATH.read_text()
    pattern = re.compile(r'\(classify\s+:name\s+"([^"]+)"\s+:library\s+"([^"]+)"\s+:class\s+:MOTOI-BASE\)')
    return {m.group(1) for m in pattern.finditer(text)}


# --------------------------------------------------------------------------
# SLAT record splitter
# --------------------------------------------------------------------------
# Format: top-level records are (verb ...) or (core-form ...) etc, all
# starting flush against the left margin. Records span multiple lines.
# Records end at a line containing a lone `)` at column 0 OR followed by
# blank line + next `(top-form` opener.

def split_top_records(text):
    """
    Yield (start_line_idx, end_line_idx, record_text) tuples for every
    top-level (verb ...) or (core-form ...) or (reference ...) record.
    Line indices are 0-based, end is exclusive.
    """
    lines = text.split('\n')
    n = len(lines)
    i = 0
    while i < n:
        line = lines[i]
        # Skip blanks, comments, dialect
        if not line or line.startswith(';'):
            i += 1
            continue
        # Top-level open form?
        m = re.match(r'\((verb|core-form|reference|dialect|audit|classify)\b', line)
        if not m:
            i += 1
            continue
        start = i
        # Count parens to find the close
        depth = 0
        in_string = False
        j = i
        while j < n:
            for ch_idx, ch in enumerate(lines[j]):
                if in_string:
                    if ch == '\\':
                        # skip next char (we only care about paren tracking, so
                        # this is fine; but for simplicity, only skip escape
                        # right after \ in string).
                        continue
                    if ch == '"':
                        in_string = False
                elif ch == '"':
                    in_string = True
                elif ch == '(':
                    depth += 1
                elif ch == ')':
                    depth -= 1
                    if depth == 0:
                        end = j + 1
                        yield (start, end, '\n'.join(lines[start:end]))
                        i = end
                        break
            else:
                j += 1
                continue
            break
        else:
            # Unterminated; bail
            i = n


# --------------------------------------------------------------------------
# Verb-name extractor from a record
# --------------------------------------------------------------------------

VERB_NAME_RE = re.compile(r':name\s+"([^"]+)"')
LIB_RE = re.compile(r':library\s+"([^"]+)"')


def get_field(record, field):
    m = re.search(rf':{field}\s+"([^"]+)"', record)
    return m.group(1) if m else None


# --------------------------------------------------------------------------
# Example scanner — pull out :code fields
# --------------------------------------------------------------------------

# Each example is like:
# (:dialect "motoi" :tier "novice" :code "..." :note "...")
# The :code string is Scheme source, potentially with escapes.
# We want to find every verb name (symbol) in that code and check
# against the Sakura set.

# Symbol regex tuned for Scheme identifiers used in Motoi/Sakura:
# supports slashes (namespace), hyphens, ?, !, -, digits.
SYMBOL_RE = re.compile(r'(?<![A-Za-z0-9_?!\'-])([a-zA-Z][A-Za-z0-9_/?!\'-]*)')


def find_sakura_in_code(code, sakura_verbs):
    """Return set of Sakura verbs referenced in this code snippet."""
    # Un-escape SLAT string escapes (\n, \", \\)
    unescaped = code.encode('utf-8').decode('unicode_escape', errors='replace')
    found = set()
    for m in SYMBOL_RE.finditer(unescaped):
        sym = m.group(1)
        if sym in sakura_verbs:
            found.add(sym)
    return found


# --------------------------------------------------------------------------
# Example rewriter — deterministic substitutions
# --------------------------------------------------------------------------
# We deliberately DO NOT invent new verbs. Only a small set of Sakura verbs
# have direct Motoi equivalents that are safe to substitute. Everything
# else is flagged as "stuck" and left untouched.
#
# The primary rewrite class: :dialect "sakura" -> :dialect "motoi" for
# examples that don't reference any Sakura verbs.

# Whitelist: Sakura verb -> Motoi replacement. EMPTY by default per
# anti-fabrication doctrine. Add entries only after confirmation.
SAFE_VERB_SUBSTITUTIONS = {
    # (none — anti-fabrication)
}


DIALECT_RE = re.compile(r'(\(:dialect\s+)"sakura"')


def rewrite_example_dialect_tag(example_text):
    """Change :dialect "sakura" -> :dialect "motoi" in an example fragment."""
    return DIALECT_RE.sub(r'\1"motoi"', example_text)


# Match a single example tuple inside the :examples ( ... ) list.
# Example: (:dialect "..." :tier "..." :code "..." :note "...")
# Handles nested parens inside strings.
EXAMPLE_OPEN_RE = re.compile(r'\(:dialect\s+"')


def scan_examples_block(record_text, sakura_verbs):
    """
    Find the (:examples ( ... )) block. For each example tuple inside,
    return list of dicts {span_start, span_end, dialect, code, sakura_refs}.
    """
    # Locate :examples (
    m = re.search(r':examples\s*\(', record_text)
    if not m:
        return None, []
    # Find matching close paren for the outer examples list.
    start = m.end() - 1  # position of the (
    depth = 0
    in_str = False
    esc = False
    i = start
    while i < len(record_text):
        ch = record_text[i]
        if in_str:
            if esc:
                esc = False
            elif ch == '\\':
                esc = True
            elif ch == '"':
                in_str = False
        else:
            if ch == '"':
                in_str = True
            elif ch == '(':
                depth += 1
            elif ch == ')':
                depth -= 1
                if depth == 0:
                    end = i + 1
                    break
        i += 1
    else:
        return None, []

    examples_block = record_text[start:end]
    # Now within examples_block find each example tuple.
    tuples = []
    j = 0
    while j < len(examples_block):
        m2 = EXAMPLE_OPEN_RE.search(examples_block, j)
        if not m2:
            break
        tup_start = m2.start()
        # Find matching close of this tuple
        depth2 = 0
        in_str2 = False
        esc2 = False
        k = tup_start
        while k < len(examples_block):
            ch2 = examples_block[k]
            if in_str2:
                if esc2:
                    esc2 = False
                elif ch2 == '\\':
                    esc2 = True
                elif ch2 == '"':
                    in_str2 = False
            else:
                if ch2 == '"':
                    in_str2 = True
                elif ch2 == '(':
                    depth2 += 1
                elif ch2 == ')':
                    depth2 -= 1
                    if depth2 == 0:
                        tup_end = k + 1
                        break
            k += 1
        else:
            break
        tuple_text = examples_block[tup_start:tup_end]
        # Extract fields
        d_m = re.search(r':dialect\s+"([^"]*)"', tuple_text)
        c_m = re.search(r':code\s+"((?:[^"\\]|\\.)*)"', tuple_text)
        dialect = d_m.group(1) if d_m else None
        code = c_m.group(1) if c_m else ""
        sakura_refs = find_sakura_in_code(code, sakura_verbs)
        tuples.append({
            'block_offset': start + tup_start,
            'block_end': start + tup_end,
            'dialect': dialect,
            'code': code,
            'sakura_refs': sakura_refs,
            'text': tuple_text,
        })
        j = tup_end
    return (start, end), tuples


# --------------------------------------------------------------------------
# Prose sweep — residual "Sakura" language references
# --------------------------------------------------------------------------
# We only rewrite where "Sakura" refers to the language. We do NOT touch:
#   - the audience field "sakura-training" (persona, not language)
#   - Sakura character references (rare in reference, but preserve if any)
# Heuristic: within a verb record's prose fields, replace phrases:
#   "Sakura Scheme"     -> "Motoi Scheme"
#   "in Sakura"         -> "in Motoi"
#   "Sakura's"          -> "Motoi's"
#   "Sakura implementation" -> "Motoi implementation"
#   "Sakura version"    -> "Motoi version"
#   "Sakura is"         -> "Motoi is"
#   "Sakura snapshots"  -> "Motoi snapshots"
#   "Sakura has"        -> "Motoi has"
#   "Sakura uses"       -> "Motoi uses"
#   "Sakura groups"     -> "Motoi groups"
#   "Sakura runs"       -> "Motoi runs"
#   "Sakura reactive"   -> "Motoi reactive"
#   "Sakura provides"   -> "Motoi provides"
#   "Sakura standard"   -> "Motoi standard"
# We do the substitutions inside prose ONLY (excluding :audience list).

PROSE_SUBS = [
    (re.compile(r'Sakura Scheme'), 'Motoi Scheme'),
    (re.compile(r"Sakura's"), "Motoi's"),
    (re.compile(r'\bin Sakura\b'), 'in Motoi'),
    (re.compile(r'\bSakura is\b'), 'Motoi is'),
    (re.compile(r'\bSakura has\b'), 'Motoi has'),
    (re.compile(r'\bSakura uses\b'), 'Motoi uses'),
    (re.compile(r'\bSakura provides\b'), 'Motoi provides'),
    (re.compile(r'\bSakura snapshots\b'), 'Motoi snapshots'),
    (re.compile(r'\bSakura reactive\b'), 'Motoi reactive'),
    (re.compile(r'\bSakura implementation\b'), 'Motoi implementation'),
    (re.compile(r'\bSakura version\b'), 'Motoi version'),
    (re.compile(r'\bSakura groups\b'), 'Motoi groups'),
    (re.compile(r'\bSakura runs\b'), 'Motoi runs'),
    (re.compile(r'\bSakura standard\b'), 'Motoi standard'),
    (re.compile(r'\bSakura formation\b'), 'Motoi formation'),
    (re.compile(r"\bSakura's audio\b"), "Motoi's audio"),
    (re.compile(r'\bSakura audio\b'), 'Motoi audio'),
    (re.compile(r'\bSakura Scheme code\b'), 'Motoi Scheme code'),
    (re.compile(r'\bSakura verb\b'), 'Motoi verb'),
    (re.compile(r'\bSakura verbs\b'), 'Motoi verbs'),
    (re.compile(r'\bSakura interpreter\b'), 'Motoi interpreter'),
    (re.compile(r'\bSakura Scheme groups\b'), 'Motoi Scheme groups'),
]


def rewrite_prose_field(record_text, changes_out):
    """Apply PROSE_SUBS to the whole record text. Return new text."""
    new = record_text
    for rx, repl in PROSE_SUBS:
        new2, n = rx.subn(repl, new)
        if n > 0:
            changes_out.append({'pattern': rx.pattern, 'replacement': repl, 'count': n})
        new = new2
    return new


# --------------------------------------------------------------------------
# Per-record processor
# --------------------------------------------------------------------------

def process_verb_record(record_text, sakura_verbs):
    """
    Process one verb / core-form record.

    Returns dict:
        {
            'name': str,
            'library': str,
            'action': 'rewritten' | 'left-alone' | 'flagged-stuck' | 'dialect-only',
            'new_text': str,
            'stuck_examples': [ {tier, code, sakura_refs} ],
            'dialect_tag_flips': int,
            'prose_changes': [ ... ],
        }
    """
    name = get_field(record_text, 'name') or '?'
    library = get_field(record_text, 'library') or '?'
    kind = 'verb' if record_text.lstrip().startswith('(verb') else 'core-form'

    # Skip non-verb/core-form records
    if kind not in ('verb', 'core-form'):
        return {'name': name, 'library': library, 'action': 'skip',
                'new_text': record_text, 'stuck_examples': [], 'dialect_tag_flips': 0,
                'prose_changes': []}

    # Scan examples
    exam_span, tuples = scan_examples_block(record_text, sakura_verbs)

    stuck = []
    dialect_flips = 0
    new_text = record_text
    action = 'left-alone'

    if exam_span and tuples:
        # Process tuples in reverse to preserve offsets
        for tup in reversed(tuples):
            if tup['sakura_refs']:
                # Cannot safely rewrite (no fabrication) — flag & skip.
                stuck.append({
                    'verb': name,
                    'library': library,
                    'dialect_tag': tup['dialect'],
                    'code': tup['code'][:200],
                    'sakura_refs': sorted(tup['sakura_refs']),
                })
                action = 'flagged-stuck' if action != 'rewritten' else action
            else:
                # No Sakura refs. If dialect tag is "sakura", flip to "motoi".
                if tup['dialect'] == 'sakura':
                    new_tuple = rewrite_example_dialect_tag(tup['text'])
                    if new_tuple != tup['text']:
                        # Replace in new_text at absolute offset
                        s, e = tup['block_offset'], tup['block_end']
                        new_text = new_text[:s] + new_tuple + new_text[e:]
                        dialect_flips += 1
                        if action == 'left-alone':
                            action = 'rewritten'

    # Prose sweep
    prose_changes = []
    new_text = rewrite_prose_field(new_text, prose_changes)
    if prose_changes and action == 'left-alone':
        action = 'rewritten'

    return {
        'name': name,
        'library': library,
        'kind': kind,
        'action': action,
        'new_text': new_text,
        'stuck_examples': stuck,
        'dialect_tag_flips': dialect_flips,
        'prose_changes': prose_changes,
    }


# --------------------------------------------------------------------------
# Main
# --------------------------------------------------------------------------

def main():
    sakura_verbs = load_sakura_verbs()
    motoi_verbs = load_motoi_verbs()
    print(f"Loaded {len(sakura_verbs)} Sakura-dialect verb names.", file=sys.stderr)
    print(f"Loaded {len(motoi_verbs)} Motoi-base verb names.", file=sys.stderr)

    text = REF_PATH.read_text()

    # Sweep prose in non-record areas (comments, preamble, top-level dialect)
    # BUT ONLY within record contents (we already rewrote the preamble).
    records = list(split_top_records(text))
    print(f"Found {len(records)} top-level records.", file=sys.stderr)

    # Filter to verb + core-form
    processable = [r for r in records if r[2].lstrip().startswith(('(verb', '(core-form'))]
    print(f"Processing {len(processable)} verb/core-form records.", file=sys.stderr)

    summary = {
        'rewritten': 0,
        'left-alone': 0,
        'flagged-stuck': 0,
    }
    stuck_all = []
    change_log = []
    replacements = []  # (start, end, new_text)

    for start, end, record_text in processable:
        result = process_verb_record(record_text, sakura_verbs)
        act = result['action']
        summary[act] = summary.get(act, 0) + 1
        if result['stuck_examples']:
            stuck_all.extend(result['stuck_examples'])
        change_log.append({
            'name': result['name'],
            'library': result['library'],
            'kind': result['kind'],
            'action': act,
            'dialect_tag_flips': result['dialect_tag_flips'],
            'prose_changes': result['prose_changes'],
            'stuck_count': len(result['stuck_examples']),
        })
        if result['new_text'] != record_text:
            replacements.append((start, end, result['new_text']))

    # Apply replacements in reverse.
    lines = text.split('\n')
    for start, end, new_body in sorted(replacements, key=lambda x: x[0], reverse=True):
        lines[start:end] = new_body.split('\n')
    new_text_full = '\n'.join(lines)

    # Save reference
    REF_PATH.write_text(new_text_full)

    # Save stuck examples
    stuck_out_lines = [
        f'; Stuck examples — Sakura verbs with no clean Motoi substitution.',
        f'; Auto-generated 2026-07-16 by rebrand-tool.',
        f'; Total stuck examples: {len(stuck_all)}',
        f'; Total unique verbs affected: {len(set(s["verb"] for s in stuck_all))}',
        '',
        '(stuck-examples',
        f'  :count {len(stuck_all)}',
        f'  :date "2026-07-16"',
        f'  :source "rebrand-tool-2026-07-16.py"',
        f'  :doctrine "anti-fabrication — flag, do not invent"',
        f'  :audience ("engineer" "alfred-review")',
        f'  :dialect "motoi"',
        f'  :training-eligible #f',
        f'  :confidentiality "public"',
        f')',
        '',
    ]
    for s in stuck_all:
        code_esc = s['code'].replace('"', '\\"')
        refs_str = ' '.join(f'"{v}"' for v in s['sakura_refs'])
        stuck_out_lines.append(
            f'(stuck :verb "{s["verb"]}" :library "{s["library"]}" '
            f':dialect-tag "{s["dialect_tag"]}" :sakura-refs ({refs_str}) '
            f':code-snippet "{code_esc}")'
        )
    STUCK_PATH.write_text('\n'.join(stuck_out_lines) + '\n')

    # Save change log
    CHANGES_PATH.write_text(json.dumps({
        'summary': summary,
        'stuck_examples_total': len(stuck_all),
        'stuck_unique_verbs': sorted(set(s['verb'] for s in stuck_all)),
        'stuck_top_verbs': _top_stuck(stuck_all),
        'per_verb': change_log,
    }, indent=2))

    print(f"\nSummary:", file=sys.stderr)
    for k, v in summary.items():
        print(f"  {k}: {v}", file=sys.stderr)
    print(f"Stuck examples: {len(stuck_all)}", file=sys.stderr)
    print(f"Stuck unique Sakura verbs: {len(set(s['verb'] for s in stuck_all))}", file=sys.stderr)


def _top_stuck(stuck_all):
    from collections import Counter
    c = Counter()
    for s in stuck_all:
        for v in s['sakura_refs']:
            c[v] += 1
    return c.most_common(20)


if __name__ == '__main__':
    main()
