#!/usr/bin/env python3
"""verify-reference-notes.py — check what a snippet PRINTS against what its note CLAIMS.

verify-reference-records.py only checks that a snippet runs. That is not enough.
`string-trim` shipped for two weeks documented as both-end trimming while the
engine did both-end trimming and SRFI-13 said left-only: every snippet ran, every
snippet was wrong, and the harness was green the whole time. A gate that cannot
tell "hello" from "hello   " cannot certify a reference.

This asserts the subset that is machine-checkable without guessing:

  - the record field must be an `:examples` entry carrying both `:code` and `:note`
  - the code must be a BARE expression (no define/display/newline) so the CLI
    auto-prints exactly one value
  - the note must OPEN with a self-delimiting literal — "str", 123, #t, #f,
    (list ...), #(vec ...), #\\c — which is the authoring convention in this
    reference ("\\"hello\\" — the leading spaces go.")

Anything failing those three is SKIPPED, not failed. A skip is honest: it means
the claim is prose and a human has to read it. Better a small checked set than a
large guessed one.

Usage:
    python3 scratch/verify-reference-notes.py                    # all chapters
    python3 scratch/verify-reference-notes.py 60-string.slat     # named chapters
    python3 scratch/verify-reference-notes.py --verb string-trim # one verb

Exit code is the number of MISMATCHes, capped at 250, so it can gate a commit.
Reports only — it never edits a chapter.
"""

import os, re, sys, subprocess, tempfile
from concurrent.futures import ThreadPoolExecutor

ROOT = '/Users/alfred/code/motoi-scheme'
REF_DIR = f'{ROOT}/scheme/reference'
MOTOI_BIN = f'{ROOT}/bin/motoi'
DUMP = '/tmp/marcus-63393-notes.tsv'

# See the note in verify-reference-records.py: cortex/* snippets write to the
# real user store unless MOTOI_HOME redirects the tree.
SANDBOX_HOME = tempfile.mkdtemp(prefix='motoi-notes-home-')
CHILD_ENV = {**os.environ, 'MOTOI_HOME': SANDBOX_HOME}



def extract_records(text, tag='(verb'):
    """Balanced-paren record slicer that respects string literals."""
    records, i, n = [], 0, len(text)
    while i < n:
        if (i == 0 or text[i - 1] == '\n') and text.startswith(tag, i):
            start, depth, in_str, esc, j = i, 0, False, False, i
            while j < n:
                c = text[j]
                if in_str:
                    if esc: esc = False
                    elif c == '\\': esc = True
                    elif c == '"': in_str = False
                else:
                    if c == '"': in_str = True
                    elif c == '(': depth += 1
                    elif c == ')':
                        depth -= 1
                        if depth == 0:
                            j += 1
                            break
                j += 1
            records.append(text[start:j])
            i = j
        else:
            i += 1
    return records


def unescape(s):
    out, i, n = [], 0, len(s)
    while i < n:
        c = s[i]
        if c == '\\' and i + 1 < n:
            nxt = s[i + 1]
            out.append({'n': '\n', 't': '\t', 'r': '\r', '"': '"', '\\': '\\'}.get(nxt, '\\' + nxt))
            i += 2
        else:
            out.append(c)
            i += 1
    return ''.join(out)


# An `:examples` entry, which is the only place :code and :note sit together.
EXAMPLE_RE = re.compile(
    r':code\s+"((?:[^"\\]|\\.)*)"\s*:note\s+"((?:[^"\\]|\\.)*)"')

# Forms that print via side effect, or bind, rather than yielding one value.
NOT_BARE = re.compile(r'\((?:define|display|newline|write|begin|let\b|set!)')


def _claim_ends_cleanly(s, end):
    """True when what follows the literal reads as commentary, not continuation.

    Without this, `(3+4i) x (1+2i) = -5 + 10i.` is mistaken for a claim that the
    snippet prints `(3+4i)` — the note is a derivation whose FIRST term happens
    to be parenthesised. A claim is followed by nothing, or by a separator.
    """
    rest = s[end:].lstrip()
    return rest == '' or rest[0] in '—-.,;:('


def leading_literal(note):
    """The claimed value at the head of a note, or None if the note is prose.

    Self-delimiting only. A bare symbol or number followed by prose is too easy
    to misread as a claim, so numbers are accepted only when the note is
    entirely that number or the number is followed by a separator.
    """
    s = note.strip()
    if not s:
        return None
    if s.startswith('"'):
        j, esc = 1, False
        while j < len(s):
            if esc: esc = False
            elif s[j] == '\\': esc = True
            elif s[j] == '"':
                return s[:j + 1] if _claim_ends_cleanly(s, j + 1) else None
            j += 1
        return None
    if s.startswith('(') or s.startswith('#('):
        depth, j, in_str, esc = 0, 0, False, False
        while j < len(s):
            c = s[j]
            if in_str:
                if esc: esc = False
                elif c == '\\': esc = True
                elif c == '"': in_str = False
            else:
                if c == '"': in_str = True
                elif c == '(': depth += 1
                elif c == ')':
                    depth -= 1
                    if depth == 0:
                        return s[:j + 1] if _claim_ends_cleanly(s, j + 1) else None
            j += 1
        return None
    m = re.match(r'(#t|#f|#\\\S)(?![\w-])', s)
    if m:
        return m.group(1)
    m = re.match(r'(-?\d+(?:/\d+|\.\d+)?)(?:\s*[—.,;]|\s*$)', s)
    if m:
        return m.group(1)
    return None


def normalize(v):
    """Compare on shape, not on incidental spacing."""
    return re.sub(r'\s+', ' ', v.strip())


def run_one(args):
    idx, name, code, note, claim = args
    tmp = f'/tmp/marcus-63393-note-{idx}.scm'
    with open(tmp, 'w') as f:
        f.write(code)
    try:
        r = subprocess.run([MOTOI_BIN, 'run', tmp], capture_output=True,
                           timeout=20, cwd=ROOT, text=True, env=CHILD_ENV)
        out = (r.stdout + r.stderr).strip()
        if r.returncode != 0 or re.search(r'^\s*error:', out, re.M):
            return (name, code, claim, out, 'ERROR')
    except Exception as e:
        return (name, code, claim, f'<{e}>', 'ERROR')
    finally:
        try: os.unlink(tmp)
        except OSError: pass
    return (name, code, claim, out,
            'OK' if normalize(out) == normalize(claim) else 'MISMATCH')


def main():
    argv = list(sys.argv[1:])
    only_verb = None
    if '--verb' in argv:
        k = argv.index('--verb')
        only_verb = argv[k + 1]
        del argv[k:k + 2]

    files = ([f'{REF_DIR}/{a}' if not a.startswith('/') else a for a in argv]
             if argv else
             [f'{REF_DIR}/{f}' for f in sorted(os.listdir(REF_DIR))
              if f.endswith('.slat') and f != 'MANIFEST.slat'])

    jobs, skipped = [], 0
    for path in files:
        if not os.path.exists(path):
            print(f'!! no such chapter: {path}')
            continue
        text = open(path).read()
        for rec in extract_records(text):
            m = re.search(r':name\s+"([^"]+)"', rec)
            name = m.group(1) if m else '<unnamed>'
            if only_verb and name != only_verb:
                continue
            for cm in EXAMPLE_RE.finditer(rec):
                code, note = unescape(cm.group(1)).strip(), unescape(cm.group(2))
                claim = leading_literal(note)
                if not code or claim is None or NOT_BARE.search(code) or '\n' in code:
                    skipped += 1
                    continue
                jobs.append((len(jobs), f'{os.path.basename(path)}:{name}', code, note, claim))

    if not jobs:
        print(f'no checkable claims matched. (skipped {skipped} prose/non-bare notes)')
        return 0

    with ThreadPoolExecutor(max_workers=8) as ex:
        results = list(ex.map(run_one, jobs))

    bad = [r for r in results if r[4] != 'OK']
    with open(DUMP, 'w') as f:
        for name, code, claim, out, status in bad:
            f.write(f'{status}\t{name}\t{code[:160]!r}\tclaimed={claim[:80]!r}\tactual={out.splitlines()[0][:80]!r}\n')

    print(f'claims checked    : {len(results)}')
    print(f'  MATCH           : {len(results) - len(bad)}')
    print(f'  MISMATCH        : {sum(1 for r in bad if r[4] == "MISMATCH")}')
    print(f'  ERROR           : {sum(1 for r in bad if r[4] == "ERROR")}')
    print(f'skipped (prose)   : {skipped}')
    print(f'full table        : {DUMP}')
    for name, code, claim, out, status in bad[:40]:
        print(f'\n--- [{status}] {name}\n    {code[:88]}\n    claimed: {claim[:100]}\n    actual : {(out.splitlines()[0] if out else "(no output)")[:100]}')
    if len(bad) > 40:
        print(f'\n... and {len(bad) - 40} more')
    return min(sum(1 for r in bad if r[4] == 'MISMATCH'), 250)


if __name__ == '__main__':
    sys.exit(main())
