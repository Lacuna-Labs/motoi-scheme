#!/usr/bin/env python3
"""run-chapter.py <book-file.slatl> [--fuel N]

Chapter-scoped runner for ONE book file — mirrors audit-books-v2.py's logic so a
crew agent can verify a single chapter in isolation while editing it.

Extracts every ```scheme / ```motoi fence inside :prose "..." records, in
document order, concatenates earlier blocks as a scoped prefix, and runs each
block. Pure fragments (a bare `...` surviving as CODE) are skipped for their own
run but still contribute their defines to the prefix. Blocks that show a REPL
prompt (sakura>/motoi>/>>>/$) are skipped.

Prints one line per block: PASS / FRAG / FAIL <first-error>. Exit code = number
of REAL failing blocks (0 == chapter clean).
"""
from __future__ import annotations
import re, sys
from pathlib import Path

REPO = Path('/Users/alfred/code/motoi-scheme')
sys.path.insert(0, str(REPO / 'scratch'))
import importlib.util
_spec = importlib.util.spec_from_file_location('aref', str(REPO / 'scratch' / 'audit-ref.py'))
aref = importlib.util.module_from_spec(_spec); _spec.loader.exec_module(aref)

PROMPT_RE = re.compile(r'^\s*(sakura>|motoi>|>>>|\$ )', re.M)
FENCE_RE = re.compile(r'```(scheme|motoi)\n(.*?)```', re.S)
PROSE_KEY_RE = re.compile(r':prose\s+"')
LINE_COMMENT = re.compile(r';[^\n]*')
STRING_LIT = re.compile(r'"(?:[^"\\]|\\.)*"')


def code_has_ellipsis(body: str) -> bool:
    stripped = STRING_LIT.sub('""', LINE_COMMENT.sub('', body))
    return '...' in stripped or 'ELLIPSIS' in stripped


def main():
    args = [a for a in sys.argv[1:] if not a.startswith('--')]
    fuel = None
    for a in sys.argv[1:]:
        if a.startswith('--fuel'):
            fuel = a.split('=')[-1] if '=' in a else None
    path = Path(args[0])
    text = path.read_text()
    blocks = []
    idx = 0
    for pm in PROSE_KEY_RE.finditer(text):
        prose, _ = aref.read_string_literal(text, pm.end() - 1)
        for lang, body in FENCE_RE.findall(prose):
            idx += 1
            if PROMPT_RE.search(body) or not body.strip():
                continue
            blocks.append({'key': f'{lang}-block-{idx}', 'code': body,
                           'fragment': code_has_ellipsis(body)})

    # Wire up fuel: if --fuel=N was given, monkey-patch run_one to pass it to motoi.
    if fuel:
        import subprocess
        _fuel = fuel
        def _run_one_with_fuel(code, timeout=30):
            try:
                r = subprocess.run([aref.MOTOI, 'run', '--fuel', _fuel, '/dev/stdin'],
                                   input=code, capture_output=True, text=True, timeout=timeout)
                return r.returncode, (r.stdout or ''), (r.stderr or '')
            except subprocess.TimeoutExpired:
                return -99, '', 'TIMEOUT'
        aref.run_one = _run_one_with_fuel

    prefix = []
    fails = 0
    for b in blocks:
        if b['fragment']:
            print(f"FRAG  {b['key']}")
            prefix.append(b['code'])
            continue
        scoped = ('\n'.join(prefix) + '\n' + b['code']) if prefix else b['code']
        rc, o, e = aref.run_one(scoped)
        cat, info = aref.classify(scoped, rc, o, e)
        if cat == 'ok':
            print(f"PASS  {b['key']}")
        else:
            fails += 1
            print(f"FAIL  {b['key']}  [{cat}] {info[:80]}")
        prefix.append(b['code'])
    print(f"--- {path.name}: {len(blocks)} blocks, {fails} FAIL ---")
    sys.exit(fails)


if __name__ == '__main__':
    main()
