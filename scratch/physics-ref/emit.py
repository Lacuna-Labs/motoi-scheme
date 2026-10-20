#!/usr/bin/env python3
"""emit.py — render the verified programs in programs.py into .slat verb
records and append/splice them into the reference chapters.

Run verify.py first. This script does not invent a single program; every
:code / :program / :composition string comes out of programs.py.
"""
import os, sys, re
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from programs import ALL

ROOT = '/Users/alfred/code/motoi-scheme'
REF = f'{ROOT}/scheme/reference'
PROV = "motoi-scheme/lib/game/world.js"
NOTE = ("Bound in lib/game/world.js over the one live entity store on "
        "2026-08-02. The name was implemented in lib/game/game.js against a "
        "second, id-keyed store and went unbound when that installer was "
        "dropped from installCore in the 2026-07-25 Curator rip; Alfred ruled "
        "the physics should work, so it was re-wired over the live world "
        "rather than by re-installing the dead duplicate store.")


def esc(s):
    return (s.replace('\\', '\\\\').replace('"', '\\"').replace('\n', '\\n'))


def nul(row, lens):
    return row.get(f'{lens}-null') or row.get(f'{lens}_null')


def prog(v, key):
    return '"' + esc(ALL[v][key]) + '"'


def lst(items):
    return '(' + ' '.join('"' + esc(i) + '"' for i in items) + ')'


def render(v, m):
    P = ALL[v]
    ex = m['examples']
    def field(name, key):
        val = m.get(key)
        if val is None:
            return ''
        return f'  :{name} "{esc(val)}"\n'

    def pslot(label, key, fallback_null=None):
        if key in P:
            return f'     :{label} {prog(v, key)}\n'
        if not fallback_null:
            raise SystemExit(
                f'{v}: no program for {key} and no honest-null reason supplied')
        return f'     :{label} (:honest-null "{esc(fallback_null)}")\n'

    out = []
    out.append('(verb\n')
    out.append(f'  :name "{v}" :std "Motoi"\n')
    out.append(f'  :library "{m["library"]}"\n')
    out.append(f'  :kind "{m["kind"]}"\n')
    out.append('  :dialect "motoi"\n')
    out.append(f'  :audience "{m["audience"]}"\n')
    out.append(f'  :doc "{esc(m["doc"])}"\n')
    out.append(f'  :section "{esc(m["section"])}"\n')
    out.append(f'  :signature "{esc(m["signature"])}"\n')
    out.append(f'  :arity "{m["arity"]}"\n')
    out.append(f'  :contract "{esc(m["contract"])}"\n')
    out.append('  :status "landed"\n')
    out.append(f'  :status-note "{esc(NOTE)}"\n')
    out.append('  :since "2026-08-02"\n')
    out.append(f'  :provenance "{PROV}"\n')
    out.append('  :training-eligible #t\n')
    out.append('  :confidentiality "public"\n')
    out.append(f'  :summary "{esc(m["summary"])}"\n')
    out.append(f'  :explanation "{esc(m["explanation"])}"\n')
    out.append('  :examples (\n')
    for tier, key in (('novice', 'ex-novice'), ('intermediate', 'ex-intermediate'),
                      ('expert', 'ex-expert')):
        out.append(f'    (:dialect "motoi" :tier "{tier}" :code {prog(v, key)} '
                   f':note "{esc(ex[tier])}")\n')
    out.append('  )\n')
    out.append(f'  :caveats {lst(m["caveats"])}\n')
    out.append(f'  :drawbacks {lst(m["drawbacks"])}\n')
    out.append(f'  :usecases {lst(m["usecases"])}\n')
    out.append(f'  :related {lst(m["related"])}\n')
    lr = m['learn']
    out.append(f'  :learn (:concept "{esc(lr["concept"])}" '
               f':prerequisites {lst(lr["prerequisites"])} '
               f':progression "{esc(lr["progression"])}")\n')

    r2 = m['row2']
    out.append('  :row-2-audit (\n')
    out.append(f'    (:problem "{esc(r2["problem"])}"\n')
    out.append(pslot('eng-program', 'r2-eng', nul(r2, 'eng')))
    out.append(pslot('math-program', 'r2-math', nul(r2, 'math')))
    out.append(pslot('cs-program', 'r2-cs', nul(r2, 'cs')))
    out.append(f'     :explanation "{esc(r2["explanation"])}"\n')
    out.append(f'     :meta "{esc(r2["meta"])}")\n')
    out.append(f'    (:eng "{esc(r2["eng"])}"\n')
    out.append(f'     :math "{esc(r2["math"])}"\n')
    out.append(f'     :cs "{esc(r2["cs"])}"))\n')

    r3 = m['row3']
    out.append('  :row-3-dimension (\n')
    out.append(f'    (:setup "{esc(r3["setup"])}"\n')
    out.append('     :rungs (\n')
    for dom, key in r3['rungs']:
        out.append(f'       (:domain "{dom}" :code {prog(v, key)})\n')
    out.append('     )\n')
    out.append(f'     :explanation "{esc(r3["explanation"])}"\n')
    out.append(f'     :meta "{esc(r3["meta"])}")\n')
    out.append(f'    (:eng "{esc(r3["eng"])}"\n')
    out.append(f'     :math "{esc(r3["math"])}"\n')
    out.append(f'     :cs "{esc(r3["cs"])}"))\n')

    r4 = m['row4']
    out.append('  :row-4-proof (\n')
    out.append(f'    (:claim "{esc(r4["claim"])}"\n')
    out.append(pslot('eng-program', 'r4-eng', nul(r4, 'eng')))
    out.append(pslot('math-program', 'r4-math', nul(r4, 'math')))
    out.append(pslot('cs-program', 'r4-cs', nul(r4, 'cs')))
    out.append(f'     :invariant "{esc(r4["invariant"])}"\n')
    out.append(f'     :meta "{esc(r4["meta"])}")\n')
    out.append(f'    (:eng "{esc(r4["eng"])}"\n')
    out.append(f'     :math "{esc(r4["math"])}"\n')
    out.append(f'     :cs "{esc(r4["cs"])}"))\n')

    r5 = m['row5']
    out.append('  :row-5-emergence (\n')
    out.append(f'    (:base "{esc(r5["base"])}"\n')
    out.append(pslot('eng-composition', 'r5-eng', nul(r5, 'eng')))
    out.append(pslot('math-composition', 'r5-math', nul(r5, 'math')))
    out.append(pslot('cs-composition', 'r5-cs', nul(r5, 'cs')))
    out.append(f'     :emergent "{esc(r5["emergent"])}"\n')
    out.append(f'     :meta "{esc(r5["meta"])}")\n')
    out.append(f'    (:eng "{esc(r5["eng"])}"\n')
    out.append(f'     :math "{esc(r5["math"])}"\n')
    out.append(f'     :cs "{esc(r5["cs"])}"))\n')
    out.append(')\n')
    return ''.join(out)


if __name__ == '__main__':
    from meta import META, ORDER_WORLD, ORDER_ENTITY, ON_COLLISION_META

    world_txt = '\n'.join(render(v, META[v]) for v in ORDER_WORLD)
    entity_txt = '\n'.join(render(v, META[v]) for v in ORDER_ENTITY)
    oc_txt = render('on-collision', ON_COLLISION_META)

    # ── 72-world.slat: append the physics vocabulary ────────────────────
    p = f'{REF}/72-world.slat'
    src = open(p).read()
    banner = (
        '\n;; ═══ the physics/* vocabulary — 8 verbs ═══\n'
        ';;\n'
        ';; physics/* is the kid-facing NAME for the world/* integrator, not a\n'
        ';; second physics. physics/step delegates to world/step; physics/gravity!\n'
        ';; is the scalar form of world/gravity!. They live in this chapter\n'
        ';; because lib/game/world.js is what provides them and world/step is what\n'
        ';; runs them; chapter 50 (library phys) is symbolic physics — quantities,\n'
        ';; dimensions, Lagrangians — and is a different subject entirely.\n'
        ';;\n'
        ';; Ripped 2026-07-25 with installGame, re-wired 2026-08-02 over the one\n'
        ';; live entity store. See tests/text-easing-motion.test.mjs for the gate\n'
        ';; that keeps binding and documentation in step.\n\n'
    )
    src = src.rstrip('\n') + '\n\n' + banner + world_txt
    src = src.replace('(dialect :applies ("motoi") :note "Library world — 44 verbs.")',
                      '(dialect :applies ("motoi") :note "Library world — 52 verbs (44 world/* + the 8-verb physics/* vocabulary over the same integrator).")')
    src = src.replace('(chapter :number "72" :library "world" :verb-count 44 :training-eligible #t)',
                      '(chapter :number "72" :library "world" :verb-count 52 :training-eligible #t)')
    src = src.replace(';;; 44 verbs in this library. Read chapter 00-intro.slat first.',
                      ';;; 52 verbs in this library. Read chapter 00-intro.slat first.')
    open(p, 'w').write(src)
    print(f'72-world.slat: appended {len(ORDER_WORLD)} records')

    # ── 24-entity.slat: append the name-or-handle verbs ─────────────────
    p = f'{REF}/24-entity.slat'
    src = open(p).read()
    banner = (
        '\n;; ═══ the name-or-handle entity verbs — 4 verbs ═══\n'
        ';;\n'
        ';; These four take EITHER a handle or an entity name (a symbol or a\n'
        ';; string matched against the entity kind), because a learner following\n'
        ';; the physics/* vocabulary has a name in hand, not a handle. The\n'
        ';; handle-only siblings (entity/set-vel!, entity/move!) are unchanged.\n'
        ';;\n'
        ';; Ripped 2026-07-25 with installGame, re-wired 2026-08-02 over the one\n'
        ';; live entity store in lib/game/world.js.\n\n'
    )
    src = src.rstrip('\n') + '\n\n' + banner + entity_txt
    src = src.replace('(dialect :applies ("motoi") :note "Library entity — 50 verbs.")',
                      '(dialect :applies ("motoi") :note "Library entity — 54 verbs.")')
    src = src.replace('(chapter :number "24" :library "entity" :verb-count 50 :training-eligible #t)',
                      '(chapter :number "24" :library "entity" :verb-count 54 :training-eligible #t)')
    src = src.replace(';;; 51 verbs in this library. Read chapter 00-intro.slat first.',
                      ';;; 54 verbs in this library. Read chapter 00-intro.slat first.')
    open(p, 'w').write(src)
    print(f'24-entity.slat: appended {len(ORDER_ENTITY)} records')

    # ── 28-game.slat: replace the on-collision record in place ──────────
    p = f'{REF}/28-game.slat'
    src = open(p).read()
    i = src.index('(verb\n  :name "on-collision"')
    # walk to the balanced close of that record
    depth, j, in_str, esc_c = 0, i, False, False
    while j < len(src):
        c = src[j]
        if in_str:
            if esc_c: esc_c = False
            elif c == '\\': esc_c = True
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
    src = src[:i] + oc_txt.rstrip('\n') + src[j:]
    open(p, 'w').write(src)
    print('28-game.slat: on-collision record replaced')

    # ── MANIFEST.slat: chapter verb counts + total ──────────────────────
    p = f'{REF}/MANIFEST.slat'
    src = open(p).read()
    src = src.replace(':file "72-world.slat" :library "world" :verb-count 44',
                      ':file "72-world.slat" :library "world" :verb-count 52')
    src = src.replace(':file "24-entity.slat" :library "entity" :verb-count 50',
                      ':file "24-entity.slat" :library "entity" :verb-count 54')
    src = src.replace(':chapter-count 87 :verb-count 1218',
                      ':chapter-count 87 :verb-count 1230')
    open(p, 'w').write(src)
    print('MANIFEST.slat: verb counts updated (72→52, 24→54, total→1230)')
