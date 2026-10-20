# Book of Your Own Dialect — DEPTH-EXPANSION pass (contract)

The book is fully drafted and every file grades **0 FAIL** (264 runnable blocks), but it
lands ~49k words ≈ ~123 pages. The requirement is **over 300 pages**. This pass grows
each chapter to the full depth standard **by adding real teaching content**, not padding.

Read `scratch/book-of-your-own-dialect-OUTLINE.md` first — it is still the governing
contract (through-line, non-negotiables, chapter list). This file adds the depth targets.

## The target
- **Each chapter → ~6,000–7,000 words of prose** (currently most are ~2,000–3,400).
  Roughly **2.5–3× your current chapters.**
- **Each chapter → 14–20 runnable ```scheme fences** (many are at 8–13 now; add more).
- **Appendices → grow proportionally** (B the phrasebook is the VOLUME appendix — push it
  hardest; the others 1.5–2×).
- Net effect across 16 ch + 8 app should clear **300 pages**.

## HOW to expand (this is the whole point — read carefully)
**Add distinct material. Never pad.** Every added paragraph must carry a NEW idea, a NEW
worked case, or a NEW angle. Concretely, per chapter, add some mix of:
1. **More worked runnable examples** — new verbs, new scenarios, each fence a fresh case
   that still grades 0 FAIL. Breadth of coverage is real content.
2. **More live dialogues** — additional probe/recover/pushback exchanges with DIFFERENT
   verbs and DIFFERENT phrasings (the register/tone axis is your variety engine).
3. **More contrast pairs** — forward⇄reverse, this-not-that, swapped-verb catches, each a
   distinct instance.
4. **Deeper prose on the WHY** — the reasoning behind each move, edge cases, when-it-does
   /doesn't apply. Explanation is legitimate depth; restating the same sentence is not.
5. **Broader enumeration where the chapter is a catalog** (ch5 languages, ch6 verb probes,
   app A/B/C tables) — cover MORE targets, not the same ones at length.

## HARD constraints (unchanged, non-negotiable)
- **0 FAIL.** Run `python3 scratch/run-chapter.py <file>` before reporting. Every runnable
  ```scheme fence is real working Motoi (R7RS-small + SRFI-1/13/125/27 + real Motoi libs
  incl. verified cortex verbs). Not-mine verbs (`import`, `fold-left`, `mapcar`, invented
  names) appear ONLY in prose/inline code as the thing being examined.
- **NO Curator / Sakura / Lacuna** anywhere. Grep before reporting.
- **NO phrase-lock.** Vary wording fully; no fill-in-the-blank templates. This is the
  reason padding is banned — repeated scaffolding with a swapped noun is poison.
- **Cortex signatures are exact:** `cortex/prune` is keyword-driven —
  `(cortex/prune :min-salience s)` / `(:keep n)` / `(:older-than ms)`, NEVER a bare float.
  `cortex/topk n` is RECENCY-ranked (newest first), not salience-ranked. Salience is set
  via `:salience` keyword on `cortex/remember`/`cortex/record` (default 0.5). `cortex/write`
  is always 0.5. Store persists across runs. NO `cortex/remind` verb — a reminder is
  remember-then-recall. (Verified against `lib/ai/cortex.js`.)
- **Grow, don't discard.** Keep all existing prose and fences; expand around them.
- **Do NOT touch MANIFEST.book.slatl** — the orchestrator reconciles numbering last.
- Format mirrors ch01: one `(chapter …)` s-expr, same header keys, `:prose "…"` with
  `\"`-escaped internal quotes, code in ```scheme fences.

## File assignments (same split, expand your own files in place — filenames unchanged)
- **Zain** — ch01, new-what-motoi-actually-is, ch02-check-the-reference,
  new-the-standards-boundary, ch06-i-am-not-that-language + appendix-a, appendix-c.
- **Marcus** — ch05-do-you-have-verb-x, ch03-hallucination-recovery,
  ch04-swapped-pairs-and-reversals, new-deduce-induct-abduct-then-verify,
  new-debugging-from-the-real-error + appendix-e, appendix-f, appendix-g.
- **Priya** — new-the-console-remembers, new-preseeded-local-memory,
  new-reminders-and-not-repeating, new-honest-null-as-signal, new-putting-it-together
  + appendix-b (push hardest — the VOLUME appendix), appendix-d, appendix-h.
- (ch07-pushback-reasoning-remembering is already at target shape — orchestrator holds it.)

Report per file: final word count + block count + `0 FAIL` confirmation.
