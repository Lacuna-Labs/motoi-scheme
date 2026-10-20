#!/usr/bin/env python3
"""Flag the artifact/save · /cite · /delete divergence in 05-artifact.slat.

NOT fixed — flagged. Two authorities disagree and neither is a typo:

  * Chapter 05 says (header line 6, every :signature, every :summary, every
    row-4 :claim and :invariant) that all four artifact verbs are async and
    return ('pending msg), with the outcome arriving on an artifact-* event.

  * lib/system/artifact.js carries "Doctrine (Alfred, LOCK): perm
    'artifact-write' + ~/motoi/artifacts/" dated 2026-07-16 — six days BEFORE
    the chapter was authored — and implements save/cite/delete as a
    synchronous on-disk API returning a path string / a citation alist / a
    boolean.

The chapter's contract is not implementable headless: the event bus it
depends on is artifact/on-event, which src/base.js installs as a
browser-only stub that throws outside the DOM. artifact/list — the one verb
in this chapter that really is a DOM verb — already concedes this; every one
of its snippets is wrapped in (guard (exn (#t 'pending)) ...).

Choosing between the two changes the public API, so it is Alfred's call, not
mine. Recording the measured behaviour and the question; leaving the six
row-4 snippets red rather than inventing a value that turns them green.
"""
import sys

P = 'scheme/reference/05-artifact.slat'
s = open(P).read()

NOTE = (
    'DIVERGENCE — NOT a typo, needs a ruling. This chapter documents %(verb)s as '
    'async: :signature says "-> pair", the summary and every row say it returns '
    "('pending msg) and delivers the outcome on an artifact-%(evt)s event. "
    'lib/system/artifact.js implements it synchronously against ~/motoi/artifacts/ '
    'under an in-code "Doctrine (Alfred, LOCK)" dated 2026-07-16 — six days before '
    'this chapter was authored (2026-07-22). Measured headless on 2026-08-02: '
    '%(measured)s. The async contract cannot be honoured headless because the event '
    'bus it needs (artifact/on-event) is a browser-only stub in src/base.js that '
    'throws outside the DOM; artifact/list, the one genuine DOM verb here, already '
    'concedes this by wrapping every snippet in (guard (exn (#t \'pending)) ...). '
    'Which contract is canonical decides the public API, so it is not an editor\'s '
    'call. The row-4 proofs below assert the async contract and therefore FAIL '
    'today; they are left as authored rather than rewritten to whichever answer '
    'happens to be green. %(extra)s'
)

FLAGS = [
    ('artifact/cite', dict(
        verb='artifact/cite', evt='cite',
        measured="(artifact/cite 'a-42) returns #f when nothing is saved under that "
                 "name, and the alist ((:name a-42) (:path <abs path>) (:size 5) "
                 "(:mtime 1785704270764)) when there is. Never a pair whose car is "
                 "'pending, so (car (artifact/cite id)) raises on the #f",
        extra="Note also that :mtime is wall-clock, so no example may assert it.")),
    ('artifact/delete', dict(
        verb='artifact/delete', evt='delete',
        measured="(artifact/delete 'a-42) returns #t when the file existed and was "
                 "removed, #f when it did not. A boolean, never a pair, so "
                 "(car (artifact/delete id)) raises",
        extra="")),
    ('artifact/save', dict(
        verb='artifact/save', evt='save',
        measured="the implementation takes TWO arguments, (artifact/save name content), "
                 "and returns the absolute path written or #f on failure. Every example "
                 "in this record passes ONE argument — the options alist the :signature "
                 "specifies — so `content` is undefined and the write fails: "
                 "(artifact/save (list (cons 'kind 'x) (cons 'payload 'y))) returns #f "
                 "and stores nothing",
        extra="This is the sharper half of the divergence: the save examples do not "
              "merely mis-describe their return value, they silently persist nothing. "
              "The arity is part of what needs ruling — options-alist per the reference, "
              "or name+content per the code.")),
]

bad = 0
for verb, fields in FLAGS:
    anchor = '(verb :name "%s" :std "Motoi" :library "artifact" :tier "core" :kind "state-change"' % verb
    n = s.count(anchor)
    print(n, verb)
    if n != 1:
        bad += 1
        continue
    note = NOTE % fields
    s = s.replace(anchor, anchor + '\n  :status "needs-alfred"\n  :status-note "%s"' % note.replace('"', '\\"'))

# Chapter header: the blanket async doctrine is true of artifact/list only.
hdr_a = (';;; Doctrine: artifact verbs are async — return a \'pending marker; the resulting\n'
         ';;; event carries the outcome. Compose with event handlers, not synchronous binding.')
hdr_b = (';;; Doctrine: artifact verbs are async — return a \'pending marker; the resulting\n'
         ';;; event carries the outcome. Compose with event handlers, not synchronous binding.\n'
         ';;;\n'
         ';;; CAVEAT (2026-08-02): that doctrine holds for artifact/list, which src/base.js\n'
         ';;; installs as a DOM surface verb. It does NOT describe artifact/save, /cite or\n'
         ';;; /delete, which lib/system/artifact.js implements synchronously against\n'
         ';;; ~/motoi/artifacts/. Those three carry :status "needs-alfred"; read their\n'
         ';;; :status-note before trusting anything in their rows.')
if s.count(hdr_a) != 1:
    print('!! chapter header not found')
    bad += 1
else:
    s = s.replace(hdr_a, hdr_b)

if bad:
    print(f'!! {bad} patterns did not match exactly once — nothing written')
    sys.exit(1)
open(P, 'w').write(s)
print('written')
