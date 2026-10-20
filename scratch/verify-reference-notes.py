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
DUMP = os.environ.get('NOTE_DUMP', '/tmp/ref-note-mismatches.tsv')

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

# A snippet that is not a bare expression can still be checkable, provided it
# emits exactly once and that emit is the whole of its output. `(define x 41)`
# prints nothing and `(display v)` prints v raw, so stdout is unambiguously the
# claimed value. Two emits, or a port redirect, and the mapping stops being
# one-to-one — those stay skipped.
EMITTER_RE = re.compile(r'\((display|write|write-char|write-string|write-u8|write-shared|write-simple)[\s)]')
PORT_RE = re.compile(r'port|with-output-to|current-output')


def single_emit(code):
    """The emitter when the snippet's stdout is one display/write, else None."""
    if PORT_RE.search(code):
        return None
    emits = EMITTER_RE.findall(code)
    if len(emits) == 1 and emits[0] in ('display', 'write'):
        return emits[0]
    return None


# A written number, in the order §7.1.1 spells it: an unsigned real is an
# integer, a rational, or a decimal with an optional exponent; a real adds a
# sign; a complex adds a signed imaginary tail. The infinities and NaN are
# written with a mandatory sign and so are listed separately.
# A trailing point is deliberately NOT part of the grammar here: `2.` is a legal
# Scheme number, but in a note the point is almost always the end of a sentence,
# and accepting it read `7.` as a claim of seven-point-nothing.
_UREAL_RE = r'(?:\d+/\d+|\d+(?:\.\d+)?(?:[eE][+-]?\d+)?|\.\d+(?:[eE][+-]?\d+)?)'
_REAL_RE = r'(?:[+-]?' + _UREAL_RE + r'|[+-](?:inf\.0|nan\.0))'
# The magnitude of the imaginary tail may be absent — `+i` IS the unit
# imaginary — but its sign never is.
_IMAG_RE = r'(?:[+-](?:' + _UREAL_RE + r'|inf\.0|nan\.0)?i)'
_NUM_RE = r'(?:' + _REAL_RE + _IMAG_RE + r'?|' + _IMAG_RE + r')'


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
        # Consume ADJACENT groups, not just the first. A loop that displays each
        # entry prints `(a 1)(b 2)` with nothing between them, and the note
        # spells the claim the same way; stopping at the first `)` read that as
        # a claim of `(a 1)` and called a correct record a mismatch. Only
        # directly-abutting groups join — a space means the next group is prose.
        depth, j, in_str, esc, end = 0, 0, False, False, None
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
                        end = j + 1
                        if s.startswith('(', end) or s.startswith('#(', end):
                            j += 1
                            continue
                        break
            j += 1
        if end is None:
            return None
        return s[:end] if _claim_ends_cleanly(s, end) else None
    m = re.match(r'(#t|#f|#\\\S)(?![\w-])', s)
    if m:
        return m.group(1)
    # The number branch has to know the WHOLE numeric grammar, not just
    # integers and one decimal point. `1.0+0.0i — modulus 1` was read as a
    # claim of `1`: `\d+` took the 1, `\.\d+` was backtracked away, and the `.`
    # of `.0` passed as the separator. That turned a correct record into a
    # mismatch. Exponents did the same to `-2+2.449...e-16i`.
    m = re.match(r'(' + _NUM_RE + r')(?:\s*[—.,;]|\s*$)', s)
    if m:
        return m.group(1)
    return None


def normalize(v):
    """Compare on shape, not on incidental spacing."""
    return re.sub(r'\s+', ' ', v.strip())


def render(datum, emitter, tmp, env=None):
    """What Motoi prints when it displays/writes this datum, or None.

    A note spells its claim the way the value is written in source — `("123"
    "45")` — but `display` strips those quotes and prints `(123 45)`. Rather
    than reimplement display in Python, hand the claim back to the interpreter
    and compare print to print.
    """
    with open(tmp, 'w') as f:
        f.write(f"({emitter} '{datum})")
    try:
        r = subprocess.run([MOTOI_BIN, 'run', tmp], capture_output=True,
                           timeout=20, cwd=ROOT, text=True, env=env or CHILD_ENV)
        if r.returncode != 0 or re.search(r'^\s*error:', r.stdout + r.stderr, re.M):
            return None
        return r.stdout
    except Exception:
        return None
    finally:
        try: os.unlink(tmp)
        except OSError: pass


def run_one(args):
    idx, name, code, note, claim, mode = args
    # Every example gets its OWN empty MOTOI_HOME, not just its own filename.
    # Cortex and verb-stats persist under $MOTOI_HOME, so one shared sandbox let
    # each example read back what earlier ones wrote — `(length (cortex/query
    # ...))` climbed across identical code within a single run. A per-example
    # home makes the snippet its own only writer, which is what a reader
    # following along in a fresh session actually has.
    with tempfile.TemporaryDirectory(prefix='motoi-notes-') as home:
        env = {**os.environ, 'MOTOI_HOME': home}
        tmp = os.path.join(home, f'note-{idx}.scm')
        with open(tmp, 'w') as f:
            f.write(code)
        try:
            r = subprocess.run([MOTOI_BIN, 'run', tmp], capture_output=True,
                               timeout=20, cwd=ROOT, text=True, env=env)
            out = (r.stdout + r.stderr).strip()
            if r.returncode != 0 or re.search(r'^\s*error:', out, re.M):
                return (name, code, claim, out, 'ERROR')
        except Exception as e:
            return (name, code, claim, f'<{e}>', 'ERROR')
        if mode != 'bare':
            if len(out.splitlines()) > 1:
                # More than one line means something else printed too, so stdout
                # is no longer a one-to-one reading of the claim. Honest skip.
                return (name, code, claim, out, 'AMBIGUOUS')
            if normalize(out) != normalize(claim):
                shown = render(claim, mode,
                               os.path.join(home, f'claim-{idx}.scm'), env)
                if shown is None:
                    return (name, code, claim, out, 'AMBIGUOUS')
                return (name, code, claim, out,
                        'OK' if normalize(out) == normalize(shown) else 'MISMATCH')
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
                if not code or claim is None:
                    skipped += 1
                    continue
                if NOT_BARE.search(code) or '\n' in code:
                    mode = single_emit(code)
                    if mode is None:
                        skipped += 1
                        continue
                else:
                    mode = 'bare'
                jobs.append((len(jobs), f'{os.path.basename(path)}:{name}', code, note, claim, mode))

    if not jobs:
        print(f'no checkable claims matched. (skipped {skipped} prose/non-bare notes)')
        return 0

    with ThreadPoolExecutor(max_workers=8) as ex:
        results = list(ex.map(run_one, jobs))

    ambiguous = [r for r in results if r[4] == 'AMBIGUOUS']
    results = [r for r in results if r[4] != 'AMBIGUOUS']
    skipped += len(ambiguous)
    bad = [r for r in results if r[4] != 'OK']
    with open(DUMP, 'w') as f:
        for name, code, claim, out, status in bad:
            f.write(f'{status}\t{name}\t{code[:160]!r}\tclaimed={claim[:80]!r}\tactual={out.splitlines()[0][:80]!r}\n')

    # The TSV above truncates for reading. A repair needs the whole code and the
    # whole output verbatim, so NOTE_JSONL dumps them untruncated when asked.
    jsonl = os.environ.get('NOTE_JSONL')
    if jsonl:
        import json as _json
        with open(jsonl, 'w') as f:
            for name, code, claim, out, status in bad:
                f.write(_json.dumps({'status': status, 'name': name, 'code': code,
                                     'claimed': claim, 'actual': out}) + '\n')

    n_emit = sum(1 for j in jobs if j[5] != 'bare')
    print(f'claims checked    : {len(results)}  (bare {len(jobs) - n_emit} + single-emit {n_emit})')
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
