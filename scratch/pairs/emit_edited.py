#!/usr/bin/env python3
"""emit_edited.py -- the editor's pass over the Mistral drafts.

Priya, 2026-08-03.

The local model (Mistral-Small-3.2-24B, scratch/pairs/draft_records.py) drafts
the prose. This script is where I sign it. Everything that can be checked
against a file in this repo is authored HERE, not taken from the model:

  signature      derived from the pure twin's record in scheme/reference/
                 (39-list.slat, 33-higher-order.slat), or from the larceny
                 test body where there is no pure twin (circular-list,
                 pair-fold).
  examples       written to demonstrate the mutation, because that is the
                 whole point of a `!` verb and the thing the current
                 fresh-list implementation hides.
  row programs   written by hand and grounded in the conformance suite; the
                 model's versions were not balanced Scheme.
  caveats        every behavioural claim traces to a line range in
                 scratch/r7rs-conformance/larceny/list.sld.
  provenance     says what it actually rests on. It does not say "observed
                 runtime behaviour" -- nothing was run.

The model's contribution that survives is :summary, :explanation, :drawbacks,
:usecases and :learn, edited.

EVERY :note is the literal string PENDING-ENGINE. A printed value in a draft
is a value nobody ran. That rule does not bend.

Raw model output is preserved under drafts/_raw/ as provenance.
"""

import os
import sys

ROOT = '/Users/alfred/code/motoi-scheme'
OUT = os.path.join(ROOT, 'scratch/pairs/drafts')

PEND = 'PENDING-ENGINE'

# ---------------------------------------------------------------- helpers

def esc(s):
    return s.replace('\\', '\\\\').replace('"', '\\"').replace('\n', '\\n')


def S(key, val, indent=2):
    return '%s:%s "%s"' % (' ' * indent, key, esc(val))


def strlist(key, items, indent=2):
    pad = ' ' * indent
    inner = ('\n' + pad + '           ').join('"%s"' % esc(i) for i in items)
    return '%s:%s (%s)' % (pad, key, inner)


def examples(items):
    out = ['  :examples (']
    for tier, code in items:
        out.append('    (:dialect "motoi" :tier "%s"\n     :code "%s"\n     :note "%s")'
                   % (tier, esc(code), PEND))
    out.append('  )')
    return '\n'.join(out)


def row(name, body, lens):
    pad = '    '
    lines = ['  :%s (' % name]
    first = True
    for k, v in body:
        if k == 'rungs':
            rung = ['%s :rungs (' % pad]
            for d, c in v:
                rung.append('%s         (:domain "%s" :code "%s")' % (pad, esc(d), esc(c)))
            rung.append('%s )' % pad)
            lines.append('\n'.join(rung))
        else:
            lead = pad + ('(' if first else ' ')
            lines.append('%s:%s "%s"' % (lead, k, esc(v)))
        first = False
    lines[-1] = lines[-1] + ')'
    lines.append('%s(:eng "%s"\n%s :math "%s"\n%s :cs "%s")'
                 % (pad, esc(lens[0]), pad, esc(lens[1]), pad, esc(lens[2])))
    lines.append('  )')
    return '\n'.join(lines)


def record(v):
    parts = [
        '(verb',
        S('name', v['name']),
        S('std', v['std']),
        S('library', v['library']),
        S('tier', 'core'),
        S('kind', v['kind']),
        S('signature', v['signature']),
        S('summary', v['summary']),
        S('explanation', v['explanation']),
        examples(v['examples']),
        strlist('caveats', v['caveats']),
        strlist('drawbacks', v['drawbacks']),
        strlist('usecases', v['usecases']),
        strlist('related', v['related']),
        '  :learn (:concept "%s"\n          :prerequisites (%s)\n          :progression "%s")'
        % (esc(v['learn'][0]),
           ' '.join('"%s"' % p for p in v['learn'][1]),
           esc(v['learn'][2])),
        S('provenance', v['provenance']),
    ]
    if v.get('status'):
        parts.append(S('status', v['status']))
    parts.append(row('row-2-audit', v['r2'][0], v['r2'][1]))
    parts.append(row('row-3-dimension', v['r3'][0], v['r3'][1]))
    parts.append(row('row-4-proof', v['r4'][0], v['r4'][1]))
    parts.append(row('row-5-emergence', v['r5'][0], v['r5'][1]))
    parts.append(')')
    return '\n'.join(parts) + '\n'


HEADER = """;;; DRAFT -- %s
;;; Edited 2026-08-03 by Priya.
;;; %s
;;; Structure, examples, row programs, caveats and provenance are
;;; authored, not generated.
;;;
;;; Every :note is the literal placeholder %s. NOTHING in this
;;; file was run. The notes are filled by a deterministic script once the
;;; cons-cell engine lands. A printed value here would be a value nobody ran.
;;;
;;; Spec basis: ../spec-pack/%s -- read ../spec-pack/00-SOURCES.md first,
;;; the normative SRFI-1 text is NOT in this repo.

"""


def fname(n):
    return n.replace('!', '-bang')


def emit(verbs):
    os.makedirs(OUT, exist_ok=True)
    n = 0
    for v in verbs:
        f = fname(v['name'])
        path = os.path.join(OUT, f + '.slat')
        # Only claim a raw snapshot exists when the file is actually on disk.
        # The snapshot watcher started after the first drafts had already been
        # overwritten by an edit, so several verbs have no raw kept. Saying so
        # per-verb is cheaper than a footnote nobody reads.
        if os.path.exists(os.path.join(OUT, '_raw', f + '.slat')):
            raw = ('Prose seeded by the local model\n'
                   ';;; (mlx-community/Mistral-Small-3.2-24B-Instruct-2506-4bit via\n'
                   ';;; scratch/pairs/draft_records.py). Raw model output for this\n'
                   ';;; verb is kept verbatim at drafts/_raw/%s.slat.' % f)
        else:
            raw = ('AUTHORED, not model-seeded. The drafting batch\n'
                   ';;; (scratch/pairs/draft_records.py, see draft_run.log) skipped\n'
                   ';;; this verb because an edited draft already existed, so no raw\n'
                   ';;; model output for it survives. Claiming model provenance here\n'
                   ';;; would be provenance nobody can check.')
        txt = HEADER % (v['name'], raw, PEND, f + '.slatl') + record(v)
        assert PEND in txt
        with open(path, 'w', encoding='utf-8') as fh:
            fh.write(txt)
        n += 1
        print('wrote %s' % path)
    return n


if __name__ == '__main__':
    from verbs_table import VERBS
    which = sys.argv[1:]
    sel = [v for v in VERBS if not which or v['name'] in which]
    print('\n%d records written' % emit(sel))
