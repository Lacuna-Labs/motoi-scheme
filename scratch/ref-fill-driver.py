#!/usr/bin/env python3
"""ref-fill-driver.py — honest-null-aware coverage counter + lane partitioner.

Counts per-verb program coverage in scheme/reference/*.slat where an
honest-null slot (`:X-program #f`, `:X-composition #f`, or `:honest-null "..."`)
counts as FILLED (it is a positive fact, not absence — doctrine 2026-07-22).

Uses balanced-paren extraction for row sections (the old regex lookahead
`(?=\\s+:row|\\s+\\))` misses verbs that close with `)))` on one line).

Usage:
  python3 ref-fill-driver.py            # report coverage
  python3 ref-fill-driver.py --lanes N  # also emit _status/lane-batches-next.json
"""
from __future__ import annotations
import json, re, sys
from pathlib import Path
from collections import defaultdict

REPO = Path('/Users/alfred/code/motoi-scheme')
REF = REPO / 'scheme' / 'reference'
STATUS = REPO / '_status'

DOMAIN_MAP = {  # file-prefix keywords -> team
    'linalg': 'cauchy', 'geom': 'cauchy', 'calc': 'cauchy', 'math': 'cauchy',
    'complex': 'cauchy', 'ops': 'cauchy', 'nt': 'cauchy', 'phys': 'cauchy',
    'topo': 'cauchy', 'alg': 'cauchy', 'matrix': 'cauchy', 'vector': 'cauchy',
    'const': 'cauchy', 'stats': 'cauchy', 'logic': 'cauchy', 'core': 'cauchy',
    'predicate': 'cauchy', 'number': 'cauchy',
    'hash': 'curry', 'list': 'curry', 'string': 'curry', 'io': 'curry',
    'bytevector': 'curry', 'char': 'curry', 'higher-order': 'curry',
    'ai': 'curry', 'text': 'curry', 'pattern': 'curry', 'artifact': 'curry',
    'symbol': 'curry', 'assoc': 'curry', 'sort': 'curry', 'random': 'curry',
    'curve': 'bezier', 'entity': 'bezier', 'easing': 'bezier',
    'motion': 'bezier', 'tick': 'bezier', 'audio': 'bezier', 'part': 'bezier',
    'synth': 'bezier', 'juggle': 'bezier', 'animation': 'bezier',
    'sprite': 'bezier', 'time': 'bezier', 'transport': 'bezier',
    'note': 'bezier', 'fb': 'bezier', 'font': 'bezier', 'color': 'bezier',
    'game': 'kleene', 'world': 'kleene', 'plot': 'kleene', 'scene': 'kleene',
    'system': 'kleene', 'cortex': 'kleene', 'introspection': 'kleene',
    'eng': 'kleene', 'input': 'kleene', 'runtime': 'kleene',
    'loading': 'kleene', 'prefab': 'kleene', 'weather': 'kleene',
    'prose': 'kleene', 'plt': 'kleene',
}


def extract_verb_forms(text):
    forms, i = [], 0
    while i < len(text):
        if text.startswith('(verb', i) and (i == 0 or text[i - 1] == '\n'):
            depth = 0; ins = False; esc = False; j = i
            while j < len(text):
                c = text[j]
                if ins:
                    if esc: esc = False
                    elif c == '\\': esc = True
                    elif c == '"': ins = False
                else:
                    if c == '"': ins = True
                    elif c == '(': depth += 1
                    elif c == ')':
                        depth -= 1
                        if depth == 0:
                            j += 1
                            break
                j += 1
            forms.append(text[i:j])
            i = j
        else:
            i += 1
    return forms


def balanced_section(text, key):
    """Extract the balanced (...) group following `:key` — regex-free."""
    m = re.search(re.escape(key) + r'\s*\(', text)
    if not m:
        return None
    start = m.end() - 1
    depth = 0; ins = False; esc = False; j = start
    while j < len(text):
        c = text[j]
        if ins:
            if esc: esc = False
            elif c == '\\': esc = True
            elif c == '"': ins = False
        else:
            if c == '"': ins = True
            elif c == '(': depth += 1
            elif c == ')':
                depth -= 1
                if depth == 0:
                    return text[start:j + 1]
        j += 1
    return None


PROG_RE = re.compile(r':(?:eng-program|math-program|cs-program|program)\s+"')
PROG_NULL_RE = re.compile(r':(?:eng-program|math-program|cs-program|program)\s+#f')
COMP_RE = re.compile(r':(?:eng-composition|math-composition|cs-composition|composition)\s+"')
COMP_NULL_RE = re.compile(r':(?:eng-composition|math-composition|cs-composition|composition)\s+#f')
HN_RE = re.compile(r':honest-null\s+"')
CODE_RE = re.compile(r':code\s+"')


def count_verb(v):
    real = null = 0
    ex = balanced_section(v, ':examples')
    if ex:
        real += len(CODE_RE.findall(ex))
    r2 = balanced_section(v, ':row-2-audit')
    if r2:
        real += len(PROG_RE.findall(r2))
        null += len(PROG_NULL_RE.findall(r2)) + len(HN_RE.findall(r2))
    r3 = balanced_section(v, ':row-3-dimension')
    if r3:
        real += len(CODE_RE.findall(r3))
        null += len(HN_RE.findall(r3))
    r4 = balanced_section(v, ':row-4-proof')
    if r4:
        real += len(PROG_RE.findall(r4))
        null += len(PROG_NULL_RE.findall(r4)) + len(HN_RE.findall(r4))
    r5 = balanced_section(v, ':row-5-emergence')
    if r5:
        real += len(COMP_RE.findall(r5))
        null += len(COMP_NULL_RE.findall(r5)) + len(HN_RE.findall(r5))
    return real, null


def domain_of(fname):
    stem = re.sub(r'^\d+[a-z]?-', '', fname.replace('.slat', ''))
    for key, team in DOMAIN_MAP.items():
        if stem == key or stem.startswith(key):
            return team
    return 'kleene'  # default: world-runtime catches strays


def main():
    lanes_n = 0
    if '--lanes' in sys.argv:
        lanes_n = int(sys.argv[sys.argv.index('--lanes') + 1])

    per_file = defaultdict(list)   # file -> [(verb, real, null, total)]
    all_verbs = []
    for path in sorted(REF.glob('*.slat')):
        for v in extract_verb_forms(path.read_text()):
            nm = re.search(r':name\s+"([^"]+)"', v)
            if not nm:
                continue
            real, null = count_verb(v)
            total = real + null
            per_file[path.name].append((nm.group(1), real, null, total))
            all_verbs.append(total)

    n = len(all_verbs)
    at15 = sum(1 for t in all_verbs if t >= 15)
    print(f'Verbs total: {n}')
    print(f'At 15+ (honest-null-aware): {at15} ({at15*100/max(1,n):.1f}%)')
    print(f'Under 15: {n - at15}')

    under_by_file = {}
    for f, verbs in per_file.items():
        under = [(v, t) for (v, r, nl, t) in verbs if t < 15]
        if under:
            under_by_file[f] = under
    print(f'Files with under-15 verbs: {len(under_by_file)}')
    for f in sorted(under_by_file, key=lambda f: -len(under_by_file[f]))[:15]:
        print(f'  {f:<40s} {len(under_by_file[f])} under')

    if lanes_n:
        # one file per lane, disjoint files, cap PER_LANE verbs/lane.
        # big files get revisited across waves (this wave takes the first slice).
        PER_LANE = 12
        files = sorted(under_by_file.items(), key=lambda kv: -len(kv[1]))
        lanes = []
        remaining_total = 0
        for f, under in files:
            names = [v for v, _ in under]
            remaining_total += len(names)
            if len(lanes) < lanes_n:
                slice_names = names[:PER_LANE]
                lanes.append({
                    'lane': len(lanes) + 1,
                    'team': domain_of(f),
                    'file': f,
                    'verbs': slice_names,
                    'count': len(slice_names),
                    'file_remaining': len(names) - len(slice_names),
                })
        out = {
            'generated': __import__('datetime').datetime.now().isoformat(timespec='seconds'),
            'under15_total': n - at15,
            'per_lane_cap': PER_LANE,
            'lanes': lanes,
        }
        outp = STATUS / 'lane-batches-next.json'
        outp.write_text(json.dumps(out, indent=2))
        assigned = sum(L['count'] for L in lanes)
        print(f'\nWave plan: {assigned} verbs across {len(lanes)} lanes '
              f'(1 file/lane, cap {PER_LANE}/lane) -> {outp}')
        print(f'Under-15 remaining after this wave: ~{(n - at15) - assigned}')
        for L in lanes:
            tail = f'  (+{L["file_remaining"]} left in file)' if L['file_remaining'] else ''
            print(f'  lane {L["lane"]:>2d} [{L["team"]:<6s}] {L["count"]:>2d} verbs · {L["file"]}{tail}')


if __name__ == '__main__':
    main()
