# CPT ZERO Plan — Addendum (2026-08-07, per Alfred's expansion)

The original plan (`CPT-ZERO-READINESS-PLAN-2026-08-07.md`) said the 288-verb reference documentation gap was *SFT-authoring, not CPT-blocking*. **Alfred has reversed this.** Reference completion is now CPT-blocking. Also added: a two-pass words-review lane. Full delta below.

## Scope additions

1. **Reference completion is now CPT-blocking.** Every reference verb currently in `scratch/FULL-GAP.json` must be documented with a full **15-grid** (per `[[project_reference_lane_sft_design]]` R1 5-row × 3-column format):
   - 243 undocumented verbs × 15 rows = 3,645 new reference rows
   - 45 under-documented verbs × delta-to-15 rows = ~150 new rows
   - Total: **~3,800 new reference rows**
2. **Words-review, TWO passes** — Alfred: *"review of the words before the code and after the code to make sure that it makes sense."*
   - **Before-code pass:** for every book chapter and reference chapter, Haiku sub-agent reads the prose and flags any block where the words don't describe what the engine actually does *right now*.
   - **After-code pass:** same sweep after Marcus lands the engine fixes.
   - Flags feed the splice list. If a flag survives after-code and can't be re-authored mechanically, it goes to quarantine.
3. **No STOP/PING boundaries** except:
   - The 3 language design calls (complex numbers / mutable strings / full ports) — Alfred-only decisions.
   - **DONE** — "CPT ready to fire, all four gates green, tree committed, real BPE pack count is X."
   - Anything Korra flags as scope creep beyond this plan.

## Sub-agent roster + tier ladder

- **Motoi Architect (this agent) — Opus.** Holds ledger, polls mailbox, spawns sub-agents, only pings Alfred at the boundaries above.
- **Marcus — Sonnet.** Engine (`src/reader.js`, `src/interp.js`, `src/macro.js`, `lib/base/*`). Finishes remaining conformance buckets.
- **Abel Sussman — Sonnet.** Correctness/idempotency. Runs the four gates, diffs, applies splices with byte-identical anchoring.
- **Priya — Sonnet.** TDD gate. Full repo suite green, commit, then fires `emit_cpt_v5.py` → `pack_bpe.py --target 4096`.
- **Korra — Haiku.** Scope-creep watcher. Refuses any request to touch carts, word-books, SLAT daemon during this walk.
- **Reference-Author — Haiku, batched.** 15-grid authoring for the 288 verbs. Cache the pattern template + example verbs as stable prefix; batch 20 verbs/call.
- **Words-Review — Haiku, batched.** Reads chapter prose, flags mismatch against engine behavior. Cache the engine-behavior summary as stable prefix.

## Cost cap

Realistic upper bound with caching + batching: **~$15**. Alfred authorized "some spend" and does not want a full stop mid-run. If Architect projects >$30 before completion, Korra pauses and Architect writes an OUTBOX entry with the delta — Alfred decides.

## Cache discipline

- Every Haiku sub-agent call MUST use `cache_control: ephemeral` on stable prefix blocks (system prompt, pattern template, engine spec summary, plan file excerpts).
- Fresh delta per call = only the specific verb/chapter/block being processed.
- Batching: 20 items per call for Haiku authoring/review sweeps.

## Order (superseding §6 of the base plan)

1. **Abel** — re-run all four gates against HEAD+worktree. Log delta vs Aug 4 numbers to OUTBOX. No PING (numbers only informational, Architect proceeds).
2. **Words-Review sub-agents (Haiku, batched)** — before-code sweep of every book + reference chapter. Flags appended to splice list.
3. **Marcus** — reader lexeme buckets (READ-*), then num-exactness, n-ary compare, RANGE-ARG, small buckets.
4. **Marcus** — write summary of the 3 language design decisions (complex/mutable/ports) to OUTBOX. **PING Alfred here.** Architect waits for Alfred's decisions before proceeding.
5. **Abel** — re-run four gates, regenerate repair list from fresh gates.
6. **Abel** — apply book + reference splices (mechanical, positional-escape aware).
7. **Reference-Author sub-agents (Haiku, batched)** — author 15-grid for 288 undocumented verbs.
8. **Abel** — quarantine non-deterministic rows (12 book + 609 fold + any surviving flags).
9. **Abel** — fold repair (3,768 rows from interpreter output).
10. **Words-Review sub-agents (Haiku, batched)** — after-code sweep. Any surviving flag → back to Abel for splice, or quarantine.
11. **Priya** — full repo suite `node --test tests/`, must be green. Commit tree.
12. **Priya** — fire `emit_cpt_v5.py`, then `pack_bpe.py --target 4096`. Report real BPE count to OUTBOX.
13. **Architect** — write "READY TO FIRE CPT — pack count X, tokens Y" to OUTBOX. **PING Alfred.**

## Communication

- **Mailbox:** `~/code/motoi-scheme/scratch/ARCHITECT-MAILBOX.md`. Architect polls at the top of every iteration. Reads INBOX, appends to OUTBOX.
- **PushNotification** on the 2 real PING moments only.
- No status chatter. No pre-emptive "hey I started step 3" pings. Alfred said: *"I don't need to send the architect off and then come back with, by the way, I wasn't able to get done after I lost, like, ten percent of my tokens for the week. Please stop doing that, and then please get something done."*
