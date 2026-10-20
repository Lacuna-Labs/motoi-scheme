# Book claim repair — the shared contract

You are repairing stale/wrong `;; => <claim>` annotations in `scheme-books/`.
Read this whole file before you touch anything.

## Why this exists

The language was certified R7RS-conformant ~12 times by a gate that only checked
whether an example RAN, never whether it was CORRECT. That produced 85 wrong
claims in the corpus source and cost a whole training run. **You are the
correction.** Every repair you make must be grounded in something that would
FAIL if you were wrong — never in what looks plausible.

## The authority order (not negotiable)

1. **`scheme/reference/*.slat` IS the language.** When the book and the
   reference disagree, the reference wins.
2. **The engine decides values.** `MOTOI_HOME=/tmp/mx ./bin/motoi eval "<expr>"`.
   Never write a value you have not seen the engine print.
3. R7RS-small, then a SRFI, then Motoi-own. Never redefine a standard name.

## The three shapes you will find, and what each means

**(a) The book's CLAIM is stale.** The code is right, the engine is right, the
annotation is old. → Splice in the engine's actual output. Keep any trailing
prose gloss, but fix stale numbers inside it too.

**(b) The book's CALL is wrong.** The claim states the correct mathematical
answer but the code invokes the verb with the wrong argument order or arity, so
the engine returns something meaningless. This is the most common case in the
math/OR chapters. → Check `:signature` in the reference, FIX THE CALL, then
splice the value the corrected call actually produces. Two already found:
  - `ops/markov-step` is `(pi P k)`, the book had `(P pi)`.
  - `ops/johnson` takes `((id . ((m1 . _) (m2 . _))) ...)`, not flat alists.

**(c) The ENGINE is wrong** — a silent-wrong: an answer-shaped nothing like
`()`, `0`, `(0 0)`, `#f`, `nan`, or a raw `[object Object]` that never raises.
→ **DO NOT touch the book.** Fix the engine if the reference clearly specifies
the behavior, or write the case to `scratch/needs-alfred-<yourname>.md` and move
on. Never "fix" the reference to match the code.

Deciding between (b) and (c): read the reference record's `:signature`,
`:contract` and `:examples`. Run the reference's OWN example. If the
reference's example works and the book's doesn't, it is (b). If the
reference's own example also returns junk, it is (c).

## Hard rules

- **No fabrication.** If you cannot ground it, log `:status "needs-alfred"` and
  stop. A confident guess here is the exact failure that cost the last run.
- **No deletes, ever.** Archive under a dated `_archive/`.
- **Never `git stash`** — it silently reverted an edit in a past session. Use
  `git show HEAD:path > /tmp/pristine` to see the original.
- Do not commit. Do not push. Do not `--force`, do not `--no-verify`.
- Do not touch `~/code/scheme-carts` — not a git repo, edits are unrecoverable.
- Back up each file you edit as `<file>.bak-<timestamp>` before the first write.
- Work only on the files in YOUR assigned list. Other agents hold the others.

## Verify before you report

Run these and paste the real numbers:

```
node --test --test-reporter=tap tests/*.test.mjs tests/**/*.test.mjs | grep -E '^# (pass|fail)'
```
Baseline is **859 pass / 0 fail**. It must still be that.

For your own files, re-check your claims by running the block. Do not report
"done" from a proxy — name the check that would have failed if you were wrong.

## Report back

Under 300 words: how many claims fixed by shape (a)/(b)/(c), the file list, any
engine bug you found and did not fix, and the suite numbers.
