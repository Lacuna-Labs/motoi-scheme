#!/usr/bin/env python3
"""Kleene: emit SRFI-13 reference records into 60-string.slat with machine-correct escaping."""
import subprocess, tempfile, os, sys

ROOT = '/Users/alfred/code/motoi-scheme'
MOTOI = ROOT + '/bin/motoi'

def esc(s):
    return s.replace('\\', '\\\\').replace('"', '\\"').replace('\n', '\\n')

def run(code):
    with tempfile.NamedTemporaryFile('w', suffix='.scm', delete=False, dir=ROOT+'/scratch/kleene') as f:
        f.write(code + '\n'); p = f.name
    try:
        r = subprocess.run([MOTOI, 'run', p], capture_output=True, text=True, timeout=60)
        return r.returncode, (r.stdout + r.stderr).strip()
    finally:
        os.unlink(p)

def L(*xs):
    return '\n'.join(xs)

def emit(v):
    o = []
    o.append('(verb')
    o.append('  :name "%s" :std "SRFI-13"' % v['name'])
    o.append('  :library "string"')
    o.append('  :tier "core"')
    o.append('  :kind "pure"')
    o.append('  :signature "%s"' % esc(v['signature']))
    o.append('  :summary "%s"' % esc(v['summary']))
    o.append('  :explanation "%s"' % esc(v['explanation']))
    o.append('  :examples (')
    for tier, code, note in v['examples']:
        o.append('    (:dialect "motoi" :tier "%s" :code "%s" :note "%s")' % (tier, esc(code), esc(note)))
    o.append('  )')
    o.append('  :caveats (%s)' % ' '.join('"%s"' % esc(c) for c in v['caveats']))
    o.append('  :usecases (%s)' % ' '.join('"%s"' % esc(c) for c in v['usecases']))
    o.append('  :related (%s)' % ' '.join('"%s"' % esc(c) for c in v['related']))
    o.append('  :learn (:concept "%s" :prerequisites (%s) :progression "%s")' % (
        esc(v['learn'][0]), ' '.join('"%s"' % esc(p) for p in v['learn'][1]), esc(v['learn'][2])))
    o.append('  :provenance "%s"' % esc(v['provenance']))
    r2 = v['row2']
    o.append('  :row-2-audit (')
    o.append('    (:eng-program "%s"' % esc(r2['eng']))
    o.append('     :math-program "%s"' % esc(r2['math']))
    o.append('     :cs-program "%s"' % esc(r2['cs']))
    o.append('     :problem "%s"' % esc(r2['problem']))
    o.append('     :explanation "%s"' % esc(r2['explanation']))
    o.append('     :meta "%s")' % esc(r2['meta']))
    o.append('    (:eng "%s"' % esc(r2['c_eng']))
    o.append('     :math "%s"' % esc(r2['c_math']))
    o.append('     :cs "%s")' % esc(r2['c_cs']))
    o.append(')')
    r3 = v['row3']
    o.append('  :row-3-dimension (')
    o.append('    (:setup "%s"' % esc(r3['setup']))
    o.append('     :rungs ((:domain "%s" :code "%s")' % (esc(r3['rungs'][0][0]), esc(r3['rungs'][0][1])))
    o.append('             (:domain "%s" :code "%s")' % (esc(r3['rungs'][1][0]), esc(r3['rungs'][1][1])))
    o.append('             (:domain "%s" :code "%s"))' % (esc(r3['rungs'][2][0]), esc(r3['rungs'][2][1])))
    o.append('     :explanation "%s"' % esc(r3['explanation']))
    o.append('     :meta "%s")' % esc(r3['meta']))
    o.append('    (:eng "%s"' % esc(r3['c_eng']))
    o.append('     :math "%s"' % esc(r3['c_math']))
    o.append('     :cs "%s"))' % esc(r3['c_cs']))
    r4 = v['row4']
    o.append('  :row-4-proof (')
    o.append('    (:eng-program "%s"' % esc(r4['eng']))
    o.append('     :math-program "%s"' % esc(r4['math']))
    o.append('     :cs-program "%s"' % esc(r4['cs']))
    o.append('     :claim "%s"' % esc(r4['claim']))
    o.append('     :invariant "%s"' % esc(r4['invariant']))
    o.append('     :meta "%s")' % esc(r4['meta']))
    o.append('    (:eng "%s"' % esc(r4['c_eng']))
    o.append('     :math "%s"' % esc(r4['c_math']))
    o.append('     :cs "%s")' % esc(r4['c_cs']))
    o.append(')')
    r5 = v['row5']
    o.append('  :row-5-emergence (')
    o.append('    (:eng-composition "%s"' % esc(r5['eng']))
    o.append('     :math-composition "%s"' % esc(r5['math']))
    o.append('     :cs-composition "%s"' % esc(r5['cs']))
    o.append('     :base "%s"' % esc(r5['base']))
    o.append('     :emergent "%s"' % esc(r5['emergent']))
    o.append('     :meta "%s")' % esc(r5['meta']))
    o.append('    (:eng "%s"' % esc(r5['c_eng']))
    o.append('     :math "%s"' % esc(r5['c_math']))
    o.append('     :cs "%s")' % esc(r5['c_cs']))
    o.append(')')
    o.append(')')
    return '\n'.join(o)

def programs(v):
    out = []
    for tier, code, note in v['examples']:
        out.append(('ex-' + tier, code))
    for row, keys in (('row2', ('eng','math','cs')), ('row4', ('eng','math','cs')), ('row5', ('eng','math','cs'))):
        for k in keys:
            out.append((row + '-' + k, v[row][k]))
    for i, (d, c) in enumerate(v['row3']['rungs']):
        out.append(('row3-rung%d' % (i+1), c))
    return out

def check(verbs):
    bad = 0; total = 0
    for v in verbs:
        for label, code in programs(v):
            total += 1
            rc, out = run(code)
            if rc != 0:
                bad += 1
                print('FAIL %s %s\n   %s\n   %s' % (v['name'], label, code.replace('\n','  '), out))
    print('checked %d programs, %d failed' % (total, bad))
    return bad
