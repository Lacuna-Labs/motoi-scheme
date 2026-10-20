# Reference debt opened by the compliance build

Engine changed; these reference records now print something else. Fix AFTER the
engine settles (Zain's complex literals and Abel's macro hygiene are still in
flight and will move more).

## `with-exception-handler` — 17 records in `26-exception.slat`

R7RS §6.11: `raise` is non-continuable, so when the handler RETURNS a secondary
exception is raised — the handler's value is NOT the value of
with-exception-handler. Motoi returned it until 2026-08-03.

Affected `:name` groups: `error-object-message` (1), `error-object-irritants`
(2), `with-exception-handler` (3), `error-object-type` (3), `read-error?` (3),
`file-error?` (4), `last-error` (1).

The rewrite is the same in every case: a snippet that used
with-exception-handler to PRODUCE a recovery value must use `guard`, which is
the R7RS verb for that job. Keep one with-exception-handler record that teaches
the secondary raise deliberately, and one that uses `raise-continuable` (whose
handler value DOES come back to the raise point).

Reproduce with: `python3 scratch/verify-reference-notes.py 26-exception.slat`

Assigned to Priya, in flight.

## `17-complex.slat` — the unit imaginary is spelled wrong

Flagged by Zain, lines 46 and 92. The records spell the unit imaginary `i` and
the fourth-root orbit `(1 i -1 -i 1)`. `i` on its own is a SYMBOL, not a number,
in every Scheme — §7.1.1 requires the sign. Once Zain's writer lands the correct
spelling is `0+i` and `(1 0+i -1 0-i 1)`.

Not yet assigned. Do it after the base.js/r7rs-small.js complex patches land,
because that is what changes the printed form.

# Engine work queued, not yet applied

## `scratch/ZAIN-BASE-REQUESTS.md` — 8 patches, all verified

Zain owns the reader and the printer; these 8 land in `lib/base/r7rs-small.js`
(A1–A3) and `src/base.js` (B1–B7), which Marcus holds while he builds mutable
strings. Apply them when he is out of the files — applying during his refactor
races him.

A3 alone carries ~20 assertions: `_renderForWrite` prints `Infinity+Infinityi`
and `NaN-NaNi`, and prints `1+2i` for what should be `1.0+2.0i`.

Zain's own harness re-verifies all 8 at env level: `node
scratch/zain-verify-base-requests.mjs` (pass 44, fail 0 when applied).

Still broken and deliberately NOT requested, because it is arithmetic rather
than lexing: `+ - * /` and `sqrt` over complex numbers (chibi lines 903, 1016,
1017).

