#!/usr/bin/env python3
"""abel-gen1.py — emit reference records 1-8 for 52-predicate.slat.

Every code string is pulled verbatim from the batch files under /tmp/sn/,
each of which was executed by abel-run.py before this ran. Nothing is
retyped, so nothing can drift between what was measured and what is written.
"""
import glob, io, sys

S = {}
for path in sorted(glob.glob('/tmp/sn/batch*.txt')):
    for block in open(path).read().split('\n%%\n'):
        block = block.strip()
        if not block or not block.startswith('#'):
            continue
        name, _, body = block.partition('\n')
        S[name[1:].strip()] = body.strip()


def q(s):
    return s.replace('\\', '\\\\').replace('"', '\\"').replace('\n', '\\n')


def c(key):
    return q(S[key])


def strlist(items):
    return ' '.join('"%s"' % q(i) for i in items)


def emit(r):
    o = io.StringIO()
    w = o.write
    w('\n(verb\n')
    w('  :name "%s" :std "%s"\n' % (q(r['name']), q(r.get('std', 'R7RS-small'))))
    w('  :library "predicate"\n')
    w('  :tier "core"\n')
    w('  :kind "pure"\n')
    w('  :signature "%s"\n' % q(r['signature']))
    w('  :summary "%s"\n' % q(r['summary']))
    w('  :explanation "%s"\n' % q(r['explanation']))
    w('  :examples (\n')
    for tier, key, note in r['examples']:
        w('    (:dialect "motoi" :tier "%s" :code "%s" :note "%s")\n' % (tier, c(key), q(note)))
    w('  )\n')
    w('  :caveats (%s)\n' % strlist(r['caveats']))
    w('  :usecases (%s)\n' % strlist(r['usecases']))
    w('  :related (%s)\n' % strlist(r['related']))
    w('  :learn (:concept "%s" :prerequisites (%s) :progression "%s")\n'
      % (q(r['learn'][0]), strlist(r['learn'][1]), q(r['learn'][2])))
    w('  :provenance "%s"\n' % q(r['provenance']))
    if r.get('status'):
        w('  :status "%s"\n' % q(r['status']))
    a = r['row2']
    w('  :row-2-audit (\n')
    w('    (:eng-program "%s"\n' % c(a['eng']))
    w('     :math-program "%s"\n' % c(a['math']))
    w('     :cs-program "%s"\n' % c(a['cs']))
    w('     :problem "%s"\n' % q(a['problem']))
    w('     :explanation "%s"\n' % q(a['explanation']))
    w('     :meta "%s")\n' % q(a['meta']))
    w('    (:eng "%s"\n' % q(a['lens'][0]))
    w('     :math "%s"\n' % q(a['lens'][1]))
    w('     :cs "%s"))\n' % q(a['lens'][2]))
    d = r['row3']
    w('  :row-3-dimension (\n')
    w('    (:setup "%s"\n' % q(d['setup']))
    w('     :rungs (')
    for i, (dom, key) in enumerate(d['rungs']):
        pre = '' if i == 0 else '\n             '
        w('%s(:domain "%s" :code "%s")' % (pre, q(dom), c(key)))
    w(')\n')
    w('     :explanation "%s"\n' % q(d['explanation']))
    w('     :meta "%s")\n' % q(d['meta']))
    w('    (:eng "%s"\n' % q(d['lens'][0]))
    w('     :math "%s"\n' % q(d['lens'][1]))
    w('     :cs "%s"))\n' % q(d['lens'][2]))
    p = r['row4']
    w('  :row-4-proof (\n')
    w('    (:eng-program "%s"\n' % c(p['eng']))
    w('     :math-program "%s"\n' % c(p['math']))
    w('     :cs-program "%s"\n' % c(p['cs']))
    w('     :claim "%s"\n' % q(p['claim']))
    w('     :invariant "%s"\n' % q(p['invariant']))
    w('     :meta "%s")\n' % q(p['meta']))
    w('    (:eng "%s"\n' % q(p['lens'][0]))
    w('     :math "%s"\n' % q(p['lens'][1]))
    w('     :cs "%s"))\n' % q(p['lens'][2]))
    e = r['row5']
    w('  :row-5-emergence (\n')
    w('    (:eng-composition "%s"\n' % c(e['eng']))
    w('     :math-composition "%s"\n' % c(e['math']))
    w('     :cs-composition "%s"\n' % c(e['cs']))
    w('     :base "%s"\n' % q(e['base']))
    w('     :emergent "%s"\n' % q(e['emergent']))
    w('     :meta "%s")\n' % q(e['meta']))
    w('    (:eng "%s"\n' % q(e['lens'][0]))
    w('     :math "%s"\n' % q(e['lens'][1]))
    w('     :cs "%s"))\n' % q(e['lens'][2]))
    w(')\n')
    return o.getvalue()


PROV = 'measured against the live engine 2026-08-02; reference record added 2026-08-02'

RECORDS = [
{
 'name': 'eq?',
 'signature': '(eq? a b) -> boolean',
 'summary': 'The identity test: #t when a and b are the same object, or the same atom. R7RS-small 6.1.',
 'explanation': "The cheapest rung of the three-rung equality ladder, and in Motoi eq? and eqv? are literally the same procedure -- both names are bound to one function in the engine. R7RS-small permits that, because it leaves eq?'s answer on numbers and characters UNSPECIFIED rather than requiring #f, so making the two agree is conformant and spares the learner a distinction with no observable meaning here. What eq? answers #t for: the same object; two symbols with the same name; two numbers of equal value; two characters; the booleans; and -- because Motoi strings are immutable host values, so string-set! raises -- two strings with the same characters. What it answers #f for: two SEPARATELY BUILT aggregates. (eq? (list 1) (list 1)) is #f, and so is the same test on two vectors, even though both sides print identically. That single #f is the whole reason equal? exists. Two measured departures from the standard you must know before you rely on them. First, (eq? '() '()) answers #f in Motoi, although R7RS-small requires #t for two empty lists -- so test emptiness with null?, never with eq?. Second, (eq? 2 2.0) answers #t, because Motoi has no distinct inexact integer: 2.0 reads as the very same object as 2.",
 'examples': [
   ('novice', 'eq-nov', '#t -- two occurrences of one symbol are the same object.'),
   ('intermediate', 'eq-int', "(#t #f #t #f) -- symbols yes; two freshly built lists NO; two equal strings yes (Motoi strings are immutable values); two empty lists NO, which is the departure from R7RS."),
   ('expert', 'eq-exp', '(waiting working unknown) -- symbol dispatch, the job eq? is built for.'),
 ],
 'caveats': [
   "(eq? (list 1) (list 1)) is #f. Two lists that print the same are not the same object; reach for equal?.",
   "(eq? '() '()) is #f in Motoi. R7RS-small 6.1 requires #t for the empty list. Use null? to test emptiness -- it is #t for every empty list.",
   "(eq? 2 2.0) is #t. R7RS leaves eq? on numbers unspecified, so this is conformant, but a program that relies on it will behave differently on a Scheme with a real inexact integer.",
   '(eq? "abc" "abc") is #t. R7RS leaves this unspecified; Motoi picks value equality because its strings are immutable.',
   'eq? and eqv? are the same procedure in Motoi. Anything true of one is true of the other.',
   'Arity is not checked: (eq? 1) answers #f rather than raising.',
 ],
 'usecases': ['Dispatching on a symbolic tag or state name.', 'Testing whether two names denote one interned symbol.', 'Cheap membership over a list of symbols.'],
 'related': ['eqv?', 'equal?', 'null?', 'symbol?', 'not'],
 'learn': ('Identity versus structure: eq? asks whether two expressions denote ONE thing, not whether two things look alike.',
           ['symbol?', 'null?'],
           'Meet eq? on symbols first, where it is exact and cheap. Then meet equal? on lists, where eq? deliberately answers #f. Learn eqv? last -- in Motoi it is the same procedure as eq?, so it adds a name, not a behaviour.'),
 'provenance': 'R7RS-small 6.1; ' + PROV,
 'status': 'needs-alfred',
 'row2': {
   'eng': 'eq-r2-eng', 'math': 'eq-r2-math', 'cs': 'eq-r2-cs',
   'problem': "The operator is writing a state machine whose states and events are symbols. Candidates: eq? (identity on symbols -- exact, one comparison), equal? (also correct here, but it pays for a deep structural walk on every branch and would additionally answer #t for a LIST that happened to print like the tag), and string comparison after symbol->string (allocates a string per test and throws away the interning the reader already did). For symbolic tags the tags ARE identities, so eq? is not merely faster, it is the honest statement of the question.",
   'explanation': 'eng: a two-state machine driven by symbol events. math: counting occurrences of one symbol in a bag. cs: an association list walked with eq? on the key -- the classic symbol table.',
   'meta': 'Why eq? and not equal?: equal? asks "do these have the same shape and contents", which is a strictly weaker question. When the answer you need is "is this THE state named run", weakening the question invites a value that merely resembles the tag to pass.',
   'lens': ["A state machine that dispatches on identity cannot be fooled by a lookalike; the log line names the exact symbol that fired.",
            "eq? on an interned symbol set is the equality of that set: each name denotes exactly one element.",
            "O(1). The reader interns symbols, so identity is a single comparison -- no walk, no allocation."],
 },
 'row3': {
   'setup': 'Asking whether two names refer to one and the same thing, rather than to two things that merely look alike.',
   'rungs': [('symbols in a program', 'eq-r3-a'),
             ('labelled loading bays on a workshop floor', 'eq-r3-b'),
             ('the Kronecker delta on an index set', 'eq-r3-c')],
   'explanation': "In a program, two occurrences of 'stone name one interned symbol, so eq? is #t. On a workshop floor, bay-3 written on two work orders means one physical bay -- the label is an identity, not a description. In mathematics the Kronecker delta is exactly this predicate with 1 and 0 in place of #t and #f: it is 1 when the indices are the same index. All three share a single move: comparing labels drawn from a set where each label names exactly one element.",
   'meta': 'Identity comparison is only meaningful over a namespace where names are unique. Where names may be re-used, identity stops answering the question and structure has to.',
 },
 'lens_unused': None,
},
]
# (row 3 lens + rows 4/5 are attached below, per record, to keep the table readable)

RECORDS[0]['row3']['lens'] = [
  "Bay labels are unique by construction, which is what licenses comparing them by identity instead of by description.",
  "The Kronecker delta is the characteristic function of the diagonal of a set crossed with itself.",
  "Interning is the implementation that makes name identity and name equality coincide.",
]
RECORDS[0]['row4'] = {
  'eng': 'eq-r4-eng', 'math': 'eq-r4-math', 'cs': 'eq-r4-cs',
  'claim': 'eq? is reflexive on every value (including an aggregate compared with itself), symmetric on every pair of values, and implies eqv? -- trivially so in Motoi, where they are one procedure. Reflexivity holds even for the empty list: it is TWO separately read empty lists that answer #f, never one compared with itself.',
  'invariant': 'For all x. eq?(x, x) = #t; for all a b. eq?(a, b) = eq?(b, a); for all a b. eq?(a, b) implies eqv?(a, b)',
  'meta': 'What would falsify it: a value that is not eq? to itself, a pair that answers differently when the arguments are swapped, or a pair that is eq? but not eqv?. The reflexive program deliberately includes the empty list and a string, the two values whose behaviour surprises people.',
  'lens': ["Reflexivity is what lets a cache compare a stored object against itself without a deep walk.",
           "Reflexive plus symmetric plus transitive makes eq? an equivalence relation; the implication chain orders the three relations by refinement.",
           "eq? implies eqv? holds by construction here -- one function, two names -- so the test documents the binding rather than probing it."],
}
RECORDS[0]['row5'] = {
  'eng': 'eq-r5-eng', 'math': 'eq-r5-math', 'cs': 'eq-r5-cs',
  'base': 'eq? answers whether two values are the same object or the same atom.',
  'emergent': "eng: an association-list lookup keyed by symbol -- the symbol table, the oldest data structure in Lisp. math: a duplicate-free set over symbols, built by asking eq? against everything already kept. cs: a dispatch table that turns a tag into an action, with an explicit no-handler branch.",
  'meta': 'The composition is eq? plus a list. What emerges is the symbol-table family: put eq? in a lookup loop and you get a table; put it in an accumulator guard and you get a set; put it in a cond and you get dispatch. Same predicate, three containers.',
  'lens': ["A dispatch table with a named no-handler branch fails loudly instead of silently doing nothing.",
           "Deduplication by eq? realises the quotient of a list by the identity relation.",
           "Linear scan is the right structure at this size; the same shape backed by a hash table is what a symbol table becomes when it grows."],
}


def main():
    out = ''.join(emit(r) for r in RECORDS)
    sys.stdout.write(out)


if __name__ == '__main__':
    main()
