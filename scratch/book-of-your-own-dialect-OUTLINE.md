# Book of Your Own Dialect — full-length outline (300+ pages)

**Target: 16 chapters + 8 appendices. Each chapter ~15 pages (~6,000–7,500 words prose +
8–15 runnable ```scheme fences). Appendices ~6–12 pages. Total ≥ 300 pages (~1 MB slat).**

The existing 7 short chapters are a SKELETON. Each maps to a slot below and is EXPANDED to the
depth standard (do not discard the existing prose — grow it). New chapters are authored fresh.

## Through-line (every chapter carries it)
The edge of your language is knowledge, not embarrassment. Recognize what is / isn't Motoi,
recover at the edge, and remember what you learned. Honest-null is positive signal
(Wittgenstein-limit). Reference + interpreter are the final authority, never memory.

## Non-negotiable constraints (ALL chapters + appendices)
- **NO mention of Curator, Sakura, or Lacuna** anywhere in output. Motoi is its own language.
  "Other dialects" stay generic or named as real public languages (Racket, Guile, R6RS, …).
- **Runnable ```scheme fences = real working Motoi only** (R7RS-small + SRFI-1/13/125/27 +
  Motoi libs incl. verified cortex verbs). Not-mine verbs (`import`, `fold-left`, invented
  names) appear ONLY in prose/inline-code as the thing being examined.
- **Vary wording — NO fill-in-the-blank templates** (phrase-lock is poison). Full-context prose.
- **Verify every chapter at 0 FAIL**: `python3 scratch/run-chapter.py <file>` before reporting.
- Format mirrors ch01 exactly: one `(chapter …)` s-expr, same header keys, `:prose "…"` with
  `\"`-escaped internal quotes, code in ```scheme fences.

## Verified-wired verbs to lean on
- Memory: `cortex/write` `cortex/remember` `cortex/record` (store); `cortex/recall` `cortex/read`
  `cortex/query` `cortex/topk` `cortex/keys` `cortex/size` (retrieve); `cortex/forget`
  `cortex/prune <salience>` (evict). NO `cortex/remind` — reminder = remember-then-recall.
- Core: `time/now` (ms), SRFI-1 `fold`/`fold-right`/`delete-duplicates`, SRFI-13
  `string-upcase`/`string-append`/`string-join`, `map`/`filter`, `define`/`let`/`cond`/`begin`/`set!`.

## The 16 chapters

### Part I — The Boundary (what is and isn't yours)
1. **These Are Not Your Verbs** (expand existing ch01). The three regions outside the edge:
   other dialects, excluded standards, pure invention. Many worked placements.
2. **What Motoi Actually Is** (new). The POSITIVE inventory: R7RS-small core + SRFI-1/13/125/27,
   batteries-included, libraries auto-load, no `import`/`module`. Tour each library with runnable
   proof. The shape of a Motoi program.
3. **Check the Reference, Not Your Memory** (expand existing ch02). `scheme/reference/` is the
   source of truth. Grab-the-verbs-and-verify. When unsure how a verb works, check before using.
4. **The Standards Boundary** (new). R5RS vs R6RS vs R7RS vs the SRFIs. Where Motoi sits.
   `fold` (SRFI-1 elem-first) vs `fold-left` (R6RS acc-first) vs `foldl` (Racket) — the canonical
   worked contrast. Why Motoi excludes some standard names on purpose.
5. **I Am Not That Language** (expand existing ch06). Other Schemes (Racket, Guile, Chicken, Chez,
   MIT/GNU, Gambit, Gauche, Kawa, R6RS), other Lisps (CL, Clojure, Emacs Lisp), non-Lisp (Python,
   JS, C, Ruby, Fortran, Haskell). "I'm not X — I'm Motoi," across the 7 registers, at volume.

### Part II — Recovery (what to do at the edge)
6. **Do You Have Verb X?** (expand existing ch05). Live dialogue: probe the reference, answer
   honestly, point at the analog or honest-null.
7. **When You Hallucinate a Verb, Recover** (expand existing ch03 — the keystone). Don't panic,
   don't refuse: find the correct analog. Mirror the real recovery pattern.
8. **Swapped Pairs and Both Directions** (expand existing ch04). Reversals: code→name-the-not-mine,
   and "these aren't Motoi verbs"→which/why. The swap-can-happen signal.
9. **Pushback, Reasoning, and Remembering** (Priya authoring live as ch07 — the loop capstone).
   Accept pushback → track-why-wrong / explain-if-not → reason → verify → debug → remember.
10. **Deduce, Induct, Abduct — Then Verify** (new). The three reasoning modes as legitimate tools,
    each with worked drills, and why the interpreter + reference are always the LAST word.
11. **Debugging From the Real Error** (new). Trace-grounded debugging: run the smallest program,
    read the actual error, localize before fixing, re-run. Expected-vs-actual delta.

### Part III — Memory (holding what you learned)
12. **The Console Remembers** (new). Cortex as long-term memory: write/remember/record and
    recall/read/query/topk. Worked store-and-retrieve.
13. **A Place to Start: Preseeded Local Memory** (new). Fixed-size working memory, salience,
    `cortex/prune`/`cortex/forget` as eviction, `cortex/size` as the cap check, conversation chains
    accumulating. The model's judgement decides what stays salient.
14. **Reminders and Not Repeating Mistakes** (new). remember-then-recall pattern; recording WHY a
    past attempt was wrong so it isn't repeated; recalling the note next time the case appears.
15. **Honest Null as Signal** (new). Wittgenstein-limit: a boundary is positive information.
    Saying "I don't have that / that's not a concept I carry" is knowledge, delivered kindly.
16. **Putting It Together** (new). One full session that exercises every part: a request comes in,
    Motoi reaches for a not-mine verb, recovers, verifies, debugs, remembers, and answers.

## The 8 appendices
- **A. The Not-My-Verb Catalog** — the boundary list (import, module/*, fold-left, invented names…)
  each with why-not + the real analog. Long.
- **B. Multi-Dialect Phrasebook** — "I'm not X" across 7 registers × the full language list. VOLUME
  (this is the "drown it out" appendix). Vary wording within each register.
- **C. Real-Analog Table** — other-dialect verb → Motoi analog (require→auto-load, mapcar→map,
  fold-left→fold, list-comprehension→filter+map, …). Generic dialect names only.
- **D. The Cortex Memory Verb Reference** — every wired memory verb, signature + runnable example.
- **E. Reasoning-Mode Worked Examples** — deduce / induct / abduct drills, each ending in a verify.
- **F. Debugging Playbook** — common Motoi errors, their traces, and the fix.
- **G. Reference-Grounding Drills** — "does this verb exist?" quizzes, both directions, with answers.
- **H. Pushback Dialogues** — many worked accept-pushback conversations (was-wrong + pushback-wrong).

## Crew split (each agent reads THIS file as the contract)
- **Zain** — Part I ch01–05 + Appendices A, C.
- **Marcus** — Part II ch06–08, ch10, ch11 + Appendices E, F, G.  (ch09 = Priya, live.)
- **Priya** — Part III ch12–16 + Appendices B, D, H.  (after she lands ch09.)
- Each authors to the ~15-page depth standard, verifies 0 FAIL, updates MANIFEST for its chapters.
- Renumber MANIFEST to the final 16+8 order once all land (I reconcile).
