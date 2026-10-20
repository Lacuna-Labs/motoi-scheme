# -*- coding: utf-8 -*-
"""Emitter for hand-authored 39-list records. Every :code/:program string here
was executed first; see scratch/zain/p*.scm for the probe transcripts."""
import sys

def esc(s):
    return s.replace('\\','\\\\').replace('"','\\"').replace('\n','\\n')

def S(k, v):   return '%s "%s"' % (k, esc(v))
def L(k, xs):  return '%s (%s)' % (k, " ".join('"%s"' % esc(x) for x in xs))

def emit(r):
    o = ['(verb']
    o.append('  :name "%s" :std "%s"' % (r['name'], r['std']))
    o.append('  :library "list"')
    o.append('  :tier "%s"' % r.get('tier','core'))
    o.append('  :kind "%s"' % r.get('kind','pure'))
    o.append('  ' + S(':signature', r['signature']))
    o.append('  ' + S(':summary', r['summary']))
    o.append('  ' + S(':explanation', r['explanation']))
    o.append('  :examples (')
    for tier, code, note in r['examples']:
        o.append('    (:dialect "motoi" :tier "%s" :code "%s" :note "%s")' % (tier, esc(code), esc(note)))
    o.append('  )')
    o.append('  ' + L(':caveats', r['caveats']))
    o.append('  ' + L(':usecases', r['usecases']))
    o.append('  ' + L(':related', r['related']))
    o.append('  :learn (:concept "%s" :prerequisites (%s) :progression "%s")' % (
        esc(r['concept']), " ".join('"%s"' % x for x in r['prereq']), esc(r['progression'])))
    if r.get('status'): o.append('  :status "%s"' % r['status'])
    o.append('  ' + S(':provenance', r['provenance']))
    a = r['row2']
    o.append('  :row-2-audit (')
    o.append('    (' + S(':eng-program', a['eng']))
    o.append('     ' + S(':math-program', a['math']))
    o.append('     ' + S(':cs-program', a['cs']))
    o.append('     ' + S(':problem', a['problem']))
    o.append('     ' + S(':explanation', a['explanation']))
    o.append('     ' + S(':meta', a['meta']) + ')')
    o.append('    (' + S(':eng', a['l-eng']))
    o.append('     ' + S(':math', a['l-math']))
    o.append('     ' + S(':cs', a['l-cs']) + '))')
    b = r['row3']
    o.append('  :row-3-dimension (')
    o.append('    (' + S(':setup', b['setup']))
    rg = b['rungs']
    o.append('     :rungs ((:domain "%s" :code "%s")' % (esc(rg[0][0]), esc(rg[0][1])))
    o.append('             (:domain "%s" :code "%s")' % (esc(rg[1][0]), esc(rg[1][1])))
    o.append('             (:domain "%s" :code "%s"))' % (esc(rg[2][0]), esc(rg[2][1])))
    o.append('     ' + S(':explanation', b['explanation']))
    o.append('     ' + S(':meta', b['meta']))
    o.append('    )')
    o.append('    (' + S(':eng', b['l-eng']))
    o.append('     ' + S(':math', b['l-math']))
    o.append('     ' + S(':cs', b['l-cs']) + '))')
    c = r['row4']
    o.append('  :row-4-proof (')
    o.append('    (' + S(':eng-program', c['eng']))
    o.append('     ' + S(':math-program', c['math']))
    o.append('     ' + S(':cs-program', c['cs']))
    o.append('     ' + S(':claim', c['claim']))
    o.append('     ' + S(':invariant', c['invariant']))
    o.append('     ' + S(':meta', c['meta']))
    o.append('    )')
    o.append('    (' + S(':eng', c['l-eng']))
    o.append('     ' + S(':math', c['l-math']))
    o.append('     ' + S(':cs', c['l-cs']) + '))')
    d = r['row5']
    o.append('  :row-5-emergence (')
    o.append('    (' + S(':eng-composition', d['eng']))
    o.append('     ' + S(':math-composition', d['math']))
    o.append('     ' + S(':cs-composition', d['cs']))
    o.append('     ' + S(':base', d['base']))
    o.append('     ' + S(':emergent', d['emergent']))
    o.append('     ' + S(':emergent-name', d['emergent-name']))
    o.append('     ' + S(':meta', d['meta']))
    o.append('    )')
    o.append('    (' + S(':eng', d['l-eng']))
    o.append('     ' + S(':math', d['l-math']))
    o.append('     ' + S(':cs', d['l-cs']) + '))')
    o.append(')')
    return "\n".join(o)

def main(records, names):
    print("\n\n".join(emit(records[n]) for n in names))
