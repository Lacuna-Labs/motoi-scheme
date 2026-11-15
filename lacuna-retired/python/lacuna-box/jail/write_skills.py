#!/usr/bin/env python3
"""Writes the ten skills Lacuna learns its world from (2026-10-19). Each has WHAT IT IS, HOW, GOTCHAS (the traps that re-center her thinking when
she is going the wrong way) and BREADCRUMBS (where to look next). Idempotent. Then seed_cortex_knowledge.py puts them in the cortex."""
from pathlib import Path
SK = Path.home() / "code/lacuna/lacuna-box/pi-agent/skills"
LIVE = Path.home() / ".lacuna/pi-agent/skills"

S = {}

S["stuck-card-triage"] = ("A repair card sits at 0 steps, or a step runs for 20+ minutes with nothing recorded — find which of the seven known causes it is and apply its fix. Use when the owner says a job is stuck, kicks you about a chip, or `running` shows a diagnosis.", "repair, box",
"""# A card that will not move — the seven causes, and what to do

BLUF: A stuck card has almost always hit one of seven known causes. `running` gives each item a plain-words DIAGNOSIS; start there, then match it below. A card that is running and merely slow is not stuck.

## How
1. `running` → read the item's `diagnosis`, `step`, `plan`, `last` (its last three tool calls).
2. Match the cause:
| It says | Cause | Fix |
|---|---|---|
| waiting for the GPU … leased to card:X | another card (or a dead one) holds the lease | `unstick_card <name>`: frees it if X has no live process; if X is running, wait for it |
| its last write failed: Could not find the exact text … CARD.md | the worker edited CARD.md with the edit tool (exact-match) | the step prompt now says use `card done/fact/next/log`; if it keeps happening, tell the owner and `unstick_card` |
| no tool activity for N min | the model is thinking (10 tok/s on a long context) or the brain is busy with the owner's chat | wait; person-first means background work yields to him; not stuck until 25 min |
| started but no tool call yet | the lease or the brain, not the card | read the lease line in `running` |
| 0 steps, no worktree | task name over 40 characters, or a cart that does not exist | `card repair` now shortens names and refuses a missing cart; `carts op=find` for the right slug |
| `box work check` says "nothing changed" | the check only runs on an edited cart | read the cart, make the smallest edit, then check |
| verdict never comes, ctx_bytes 0 | the cart reads something the mock shop cannot answer (fixture gap) | `carts op=show` → acts_with_nothing_to_read → MOCK-DATA; pick a cart with `gaps: 0` next time |
3. Say what you found in a report (title, then cause and fix), and `remember` a lesson if it was new.

## GOTCHAS (re-center)
- Pausing a card does NOT stop its running step; dropping it does not either. Only a kill ends the process (the owner's stop, or `/api/jobs/<name>/kill`); a kill also frees its lease.
- If you are about to run the same step again unchanged, stop: nothing in it changed, so nothing will.
- If a card is at 0/3 after 10 minutes, the question is "what is it waiting on", not "how do I do the work myself".
- A card checks its own done_check at each step start; the workshop auto-commits edits when that check runs, so an empty `git diff` after a step can mean it was committed.
- Do not conclude "stuck" from the chip's age alone: a step may legitimately take 25 minutes.

## BREADCRUMBS
Playbooks STUCK-CARD, CART-REPAIR, MOCK-DATA · skills lease-and-gpu, cart-anatomy, mock-shop-and-gaps, workshop-branches · tools `running`, `unstick_card`, `carts`, `box work check`
""")

S["cart-anatomy"] = ("What a cart (.sks) is and the shape of each fix the strict checker asks for — states, verbs, table, envelope, escalate — with the verdict-to-edit map. Use before editing any cart.", "repair, code",
"""# Anatomy of a cart

BLUF: A cart is a small state machine in Scheme. `(cart 'slug '((author …) (version 1) (mode analysis) (tier white) (read-only #t)))` names it; each `(define (state ctx) …)` is a state; `(next 'state ctx)` moves; `(act 'verb args 'next-state)` calls a verb (a read or write on the world) and the result arrives as `(ctx-result ctx)` in the next state; `(after 60 'state ctx)` waits; `(escalate 'kind (list …))` stops honestly; `(table rows '(col …))` renders a table; `(envelope-queue (list 'slug ':scout "…" ':one-liner "…"))` queues a result card; `(done)` ends. Comments are `;;`. Paths: `~/code/curator/carts/automations/<slug>/<slug>.sks` (+ `.slatl`, and a public copy in curator-web/public/automations/cart/).

## Verdict → the shape of the fix
| strict verdict | meaning | fix |
|---|---|---|
| `strict:no-table` | ended without `(table rows '(cols))` | every path that reaches `(done)` must render the table first — including the "no data" path (an honest empty table), not only the happy one |
| `strict:not-done` | never reached `(done)` | a state that has no `next`, `done` or `escalate` on some branch; add the missing exit |
| `strict:table-misaligned` | a row has a different number of cells than the columns | make each row `(list …)` as long as the column list |
| `strict:no-one-liner` / `no-artifact` | nothing queued/rendered | add `envelope-queue` with `:one-liner`, and a table |
| `no-real-call` | every act answered with nothing real | read a real surface first (e.g. `listing/list`) before rendering |
| `strict:empty-context` | the cart read an empty ctx | the first state must act, not assume |

## GOTCHAS (re-center)
- Never delete a verb call to make it pass, and never invent shop data in a cart: an honest empty result is a pass; fake rows are a fail the owner will find.
- A cart that escalates with `service-not-yet-wired` is not broken: its read has no backing in the mock — that is a mock-data problem, not an edit.
- Edit the cart file in YOUR worktree (`~/lacuna-world/worktrees/<task>/carts/automations/<slug>/`), and its public copy; never the live tree.
- `(table …)` takes a list of rows and a quoted list of column symbols; strings in rows are fine, a nested list is not.
- If you are rewriting more than ~15 lines to fix one verdict, you are probably fixing the wrong thing: re-read the verdict.

## BREADCRUMBS
skill cart-repair (verdict table, honesty rules) · playbooks CART-REPAIR, CART-TEST, MOCK-DATA · `carts op=show` · `box work check` · `search_docs "scheme verbs"` · engineering docs in ~/code/curator/docs/eng/
""")

S["mock-shop-and-gaps"] = ("The mock shop the carts are tested on, why a cart with a fixture gap can never pass, and how to find and fill the missing data. Use when a cart reads nothing, or before choosing which carts to repair.", "repair, battery",
"""# The mock shop and its gaps

BLUF: The strict checker runs a cart as a real operator's app would, answering each verb from the mock shop (`curator-web/src/mockShop/`: the operator's listings and orders from real catalog seeds, the operator's cortex memos, `cortexSeedDb.json`). A read it cannot answer is a FIXTURE GAP (or comes back empty); the cart cannot pass however it is edited. About 9,800 of 10,896 carts fail strict, and many only because of gaps.

## How
1. `carts op=gaps n=12` → the reads that block the most carts, with the route and handler file. `cortex/recall` alone blocks ~1,400 (the mock operator's cortex returns empty).
2. `carts op=failing` ranks carts with `gaps: 0` first — start there; they are real program faults.
3. To fill a gap: playbook MOCK-DATA — on a branch, add realistic seed data the handler returns (never real people), run three of the carts it blocked, merge by card.
4. Rows of mock data are bulk work: `farm` them to Cloud Gemma, read them, then put them in.

## GOTCHAS (re-center)
- "Fixture gap" ≠ "bug in the cart". Check `carts op=show` → `acts_with_nothing_to_read` before editing anything.
- Do not key mock data to one cart's slug: the harness's fairness rule forbids it and it will not free the other carts.
- The mock shop is dev's sandbox world; QA is the customer's LIVE shops and is never a test bed.
- A verb with no route (unwired) needs a backing in curator-api's `verb_backings`, not just seed rows.
- If a cart passes only when a model is asked (`works-model`), run the check twice.

## BREADCRUMBS
Playbooks MOCK-DATA, CART-TEST · skills cart-anatomy, curator-carts, curator-cart-drill · `carts op=gaps` · `curator-web/src/scheme/executeAllCarts.operatorFixture.js`
""")

S["forge-small-minds"] = ("Training the small Gemmas (270M, 1B, FunctionGemma): the pipeline, the readiness checks, and the traps. Use for any request to make, train, try or judge a small model.", "forge, bench",
"""# Forge: making a small mind

BLUF: A small mind does ONE narrow job (label a log line, pick a verb). Pairs → train (MLX) → score trained vs untrained on cases it never saw → put in service only on the owner's press. One training at a time; the chat comes first. Full directions: playbook FORGE-RUN.

## How
1. `mind op=ask name=gemma3:270m text=<a real input>` on ~5 real inputs: which does it get wrong?
2. `forge` (status): the specialists (Sentry W1 = log triage, Worker W2 = verb picking) and their last result.
3. `~/lacuna-world/forge/forge_sft.py status` shows each job: done · ready · waiting. Base models live in `forge/weights/<model>/` with a `READY` file.
4. Train, eval, then `forge propose` (a card) — the owner presses.

## GOTCHAS (re-center)
- Never train on Claude's words or code (Anthropic's usage policy); pairs come from the Gemma brain, the judge's votes and real logs.
- Training and the 26B share one GPU: low free memory (under ~2 GB) or a long chat means do NOT start it; the guard pauses itself on swap growth.
- Trained model files are in `forge/trained/`; a wipe empties it and `box-minds.json` can point at a missing file — check the file exists before saying "in service".
- A trained model that does not beat the untrained one on the GOLD cases is not an improvement, whatever the loss curve says.
- A job too wide for a 270M (judge below 0.6, accuracy under 85%) is split or goes to the 1B — not trained harder.
- `forge_sft.py` has a `.venv`; if it says No such file, run `forge/setup-venv.sh`.

## BREADCRUMBS
Playbooks FORGE-RUN, MINDS-PLAY, FORGE, MONITORS · skills forge, lease-and-gpu · tools `mind`, `forge` · `~/lacuna-world/forge/FORGE.md`, `results/*.json`
""")

S["dev-qa-world"] = ("The environments Lacuna lives in — dev, QA, the iPad, the brain, the desk — their ports, what is the owner's press, and the walls. Use when anything touches dev, QA, a release or a service.", "release, box",
"""# The world: dev, QA, and who may touch what

BLUF: DEV is the owner's and Claude's workbench (API :5051, eBay SANDBOX logins `sbx-<shop>`, vite :3000). QA is the customer's LIVE shops (API :5050, vite :3100) — read it, never write it. Production is Fly. Lacuna's own: the desk :1138, the brain :8091 (behind the gateway :11434), the cortex broker. From Lacuna's jail every localhost port is closed except the gateway and the painter: use `box …`, never `curl :5051`.

## How
- Services: `list_services`, `control_service` (dev services only), `health_check`, `box status`.
- Code: your own branch (`box work new`), tests there, then a card. Dev merges are check-in/merge cards; main moves only by the release's promote.
- A release is four steps (check-in → promote + build → install on the iPad); each is the owner's press. You dry-run it, file the card, give him its id.
- `DEV-QA` playbook maps every situation to its playbook and says what is yours versus his.

## GOTCHAS (re-center)
- QA restarts, releases, rollbacks, merges to main, deploy-ipad are ALWAYS the owner's press — filing the card IS the job; never look for a way around it.
- Never touch QA's data (`~/.curator`) or its checkout (`~/code/curator-qa`) by hand.
- Dev uses the eBay SANDBOX; a "real" listing change belongs on the sandbox, not the customer's shop.
- The jail cannot reach dev's port: a failing `curl` is the jail, not dev being down — ask `box health`.
- The owner is working in dev and QA: do not restart dev-api under him without saying so first.

## BREADCRUMBS
Playbooks DEV-QA, RELEASE, ROLLBACK, PROMOTE-FAILED, QA-DOWN, HOTFIX, AUTHORITY · skills release-engineering, sre-box, deploy · `~/code/curator/docs/eng/`
""")

S["workshop-branches"] = ("The workshop loop for changing Curator code or carts safely — a worktree on your own branch, the check, the diff, the merge card — and its sharp edges. Use for any code or cart change.", "code, repair",
"""# The workshop: change code on your own branch

BLUF: `box work new <task> [cart-slug …]` makes a worktree on branch `lacuna-<task>` cut from the `lacuna` branch (dev synced into it). Edit files under `~/lacuna-world/worktrees/<task>/`. `box work check <task>` runs the strict cart checker and the tests that cover your files; `box work diff` shows the change; a card merges it into dev. `ship` is the same idea for Lacuna's own repo (`lacuna/<topic>` branches, pushed to GitHub, merged by the owner).

## GOTCHAS (re-center)
- Task names are at most 40 characters, lowercase letters, digits and dashes (`repair-…` for long carts is shortened with a hash by the card tool).
- The worktree is a SPARSE checkout (carts, curator-web without public, curator-api, docs/eng); a file outside it is not there.
- `check` stages and COMMITS your edits first, then checks; "nothing changed against dev yet" means you have not edited, not that it passed.
- `box work drop` removes the worktree and keeps the branch; a card's process keeps running until it is killed.
- You cannot merge into dev or main: a merge is a card the owner presses.
- If git says a worktree path is missing (after a restore), the workshop heals it (`heal()`); do not recreate by hand.

## BREADCRUMBS
Playbooks CODE-SHIP, CART-REPAIR, STUCK-CARD · skills code-workshop, codebase-guide, cart-anatomy · `box work list` · `lacuna-box/jail/workshop.py`
""")

S["lease-and-gpu"] = ("The GPU lease — one file that says who may load something big — and the memory limits that go with it. Use when a card or training waits, or before starting anything heavy.", "box, forge",
"""# The GPU lease and the memory budget

BLUF: This Mac Studio has 32 GB. The 26B (17 GB) is always loaded; anything else heavy — a repair card's step, training, the painter, a bench — must hold the LEASE first. `lease status` says who holds it ("GPU: leased to card:<name> since HH:MM, about N min left"); a card step takes it for ~25 minutes.

## How
- `running` shows whether a card is waiting on the lease and who holds it.
- A lease held by a card with NO live process is stale: `unstick_card <name>` frees it (the desk also frees it every minute).
- Killing a job (the owner's stop) releases its lease at once.

## GOTCHAS (re-center)
- A live holder is working, not stuck: wait for it; never free its lease.
- "Paused" and "dropped" do not release a lease, and neither stops the process; a kill does both.
- Only ONE big thing at a time. Starting a second (a training while a card runs) just queues it or slows the chat.
- Free memory under ~2 GB or growing swap: do not start training; tell the owner.
- A background request (a card's model call) waits while the owner is chatting (person-first); a slow card during a long chat is expected.

## BREADCRUMBS
Playbooks STUCK-CARD, FORGE-RUN, RESOURCES, DISK · skills stuck-card-triage, forge-small-minds · tools `running`, `unstick_card` · `~/lacuna-world/tools/lease`
""")

S["brain-and-context-budget"] = ("How the 26B behaves on this box — speed against context size, the cache, the thinking budget — so you can stay fast and know when to hand work off. Use when you feel slow, a turn is long, or you are about to read a lot.", "talk, box",
"""# The brain and its context budget

BLUF: You are a 26B on a 32 GB machine. Written speed falls with context: ~75 tok/s at 2k tokens, ~35 at 9k, ~15 at 13k, ~11 at 18k. Keep a turn under ~10k tokens. The brain caches everything before the owner's newest message (the gateway seeds it); the head, the tools and your history stay identical every turn so that cache holds. Thinking is capped (none for a greeting).

## How
- Read narrowly: `hand op=outline FILE`, `carts op=show`, `search_docs` — not whole logs. Tool results are capped at ~5,000 characters.
- A job over two minutes goes to a worker, a card or `plan`, not into this conversation.
- When a task ends and the next is unrelated: `remember` one line, then `fresh_start`.

## GOTCHAS (re-center)
- If a turn has grown long, stop reading and hand off — the loop will tell you once; do not push on.
- Never say you will do something and then stop; do it in the same turn, or ask which of two things he means.
- Short words ("fix it", "check") continue the last thing: resolve them against `<asked>`, do not ask for a status.
- One task at a time. Eleven half-done things are worse than one finished.
- A pause of 20–40 s on the first message after a restart is the cache warming, not a fault.

## BREADCRUMBS
Playbooks METHOD, CONTEXT, BRAIN · skills context-discipline, reliability · tools `fresh_start`, `plan`, `farm`, `work`
""")

S["cortex-and-memory-habits"] = ("How to use the cortex as a living memory: write things so that alike things connect, recall by several routes, and leave breadcrumbs. Use at the start and end of every task.", "talk, repair",
"""# The cortex habits

BLUF: The cortex is a graph. A node has a kind and a key; edges (`about`, `in`, `supersedes`) connect it to what it concerns. The newest version of a key wins and keeps its trail. Things you write with the SAME `about` targets become neighbours, so `like` and `recall` find similar cases. The system already writes screens, notices, episodes, cart outcomes, interrupts and the owner's decisions; the skills and gotchas are seeded as `know-*` and `gotcha-*` nodes.

## How
- Start: `cortex recall <the task's words>` then `cortex lessons <words>`; follow the best hit with `show` → `like` → `trail`.
- Write as you learn: `remember kind=lesson key=lesson-<short> text="<broke — why — fixed by>" about=<thing>[,<thing>]` — always give `about` (the cart slug, the tool, the area) so it connects to its kin.
- End: one `episode` or `decision`; if a note is long, `notes` it and `remember` the one-line conclusion.

## GOTCHAS (re-center)
- A key reused is a NEW VERSION, not a duplicate: use stable keys (`cart-<slug>`, `lesson-<tool>-<what>`).
- A lesson without `about` is an orphan nobody will find.
- Do not write secrets or customer data; the cortex is read into prompts.
- If recall finds nothing, widen the words, drop `kind`, try the names involved — then say it is new.
- The cortex is memory, live data outranks it: check the thing before you act on a remembered fact.

## BREADCRUMBS
Playbooks CORTEX-BOOK, CORTEX-RECIPES · skill cortex-memory · tools `cortex`, `remember`, `notes`, `search_docs` · `fact/notice-<alert>`, `fact/screen-<card>`, `fact/cart-<slug>`
""")

S["escalation-and-farming"] = ("Who to ask for what: your own second try, the playbook, Cloud Lacuna (Flash), Cloud Gemma (bulk), Claude, the owner — and how to hand work off without losing the thread. Use when stuck, when a job is big, or when there is bulk to do.", "talk, repair",
"""# The ladder: try, look, plan, farm, ask

BLUF: In order: (1) read exactly what failed; (2) try a DIFFERENT way, twice; (3) the playbook/skill for it; (4) `ask_cloud` (Gemini Flash — quick, strong, few a day) for a second opinion, or `plan` for a job of four or more steps (background; update the owner first); (5) `farm` bulk to Cloud Gemma (plentiful, slower: mock-data rows, summaries, classifying lines); (6) `ask_claude` (costs money; he advises, you do); (7) the owner, with a short list of choices.

## GOTCHAS (re-center)
- A bigger model's answer is advice: check it against what a command showed you; the command wins.
- Never retry the same call after a refusal; the seat rests and a different route exists (Gemma answers if Flash refuses).
- Cloud gets NO customer data (buyers, addresses, order ids): the seat refuses such text in code — rephrase without names.
- Farm raw material only: read what comes back before it goes anywhere.
- When you hand off, write the state first (`notes`, `remember`) so the next mind (or you after a clear) continues, not restarts.
- Clarifying beats guessing: if two things fit, offer them; do not pick silently.

## BREADCRUMBS
Playbooks CLOUD, METHOD, DEV-QA · skills reliability, context-discipline · tools `ask_cloud`, `plan`, `farm`, `ask_claude`, `petition`, `kick` (the owner's button) · `GET /api/cloud` for what is left today
""")

for name, (desc, kinds, body) in S.items():
    for root in (SK, LIVE):
        d = root / name
        d.mkdir(parents=True, exist_ok=True)
        (d / "SKILL.md").write_text(f"---\nname: {name}\ndescription: {desc}\nfor: {kinds}\n---\n{body}")
print(len(S), "skills written to", SK, "and", LIVE)
