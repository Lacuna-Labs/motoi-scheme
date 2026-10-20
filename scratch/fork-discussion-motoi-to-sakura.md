# Moving Motoi Scheme → Sakura Scheme — the fork discussion

*Lacuna engineering, 2026-07-27. Synthesis of three research lanes. Findings only — nothing has been moved.*

---

## The headline: it's a homecoming, not a fork

All three lanes independently hit the same fact, and it changes the framing:

**Sakura is the parent. Motoi is the fork.**

- `sakura-scheme` was extracted from Curator on **2026-07-09** as the shared runtime.
- `motoi-scheme` was then extracted *from sakura-scheme* on **2026-07-16** — its git history literally bottoms out at commit *"Initial Motoi Scheme extraction from sakura-scheme"*, and its own CLAUDE.md says so.
- `THE-PLAN.md` §3.2 has **always** named `~/code/sakura-scheme/` as THE engine repo.

So "move Motoi over to become Sakura" is not a new invention and not a competition you're conceding — it's **promoting the more-finished fork's engine back onto the canonical repo it came from.** You were right: building Sakura up separately would have been rebuilding what Motoi already is.

**Fork or not fork? → NOT a fork. A MOVE (copy-in) + rename.** One language, one repo (`sakura-scheme`), Motoi's engine as the body, Sakura's name + consumers + verb surface as the skin.

---

## What each side actually brings

| | Motoi (`motoi-scheme`) | Sakura (`sakura-scheme`) |
|---|---|---|
| Role | The finished **engine** | The canonical **name + consumers** |
| Engine LOC | **6922** (repl 870, cli 480) | 5826 (repl 319, cli 175) |
| Extras | `core/` (322-verb partition), 17 loadable `modules/`, `rosetta/` compat, **LOCKED R7RS + SRFI-1/13/125/27** std-lib | dialect layer in-repo, live consumers, `bin/sakura-scheme`, 654 passing tests |
| Version / license | 0.75.0-beta, Apache-2.0 | 1.4.0, MIT |
| Verbs | ships `entity/ world/ game/ cortex/ synth/ sprite/…` | Marionette (197 slashed) + Dialect (~95 hyphenated) |

Same engine family — identical `makeBaseEnv(fuel)`, identical `env.define(name, fn, {perm})` contract, byte-identical `verbRegistry.js` header. Borrowing is already bidirectional (Sakura ported 4 Motoi modules on 2026-07-16). **The two interpreters have drifted ~160 lines apart and must be reconciled to one.**

---

## "Wire up her words" — where Sakura's verbs live (3 surfaces)

1. **Marionette** — `sakura-scheme/src/lib/marionette/`, **197 slashed verbs** (`card/spawn`, `entity/move!`, `world/step`), `installMarionette(env)`.
2. **Dialect** — `sakura-scheme/src/lib/dialect/`, **~95 hyphenated verbs** (`card-open`, `shop/*`, `flower/*`, `cortex/*`, `marketplace/*`), `installSakuraDialect(env, hooks)` — has a hooks seam for Curator's real backings.
3. **Curator live** — `curator/curator-web/src/scheme/`, the full-fat shipping copy: its own forked interp/reader/base/dispatch + **22 `*Verbs.js`** files.

"Wire her words" = author a Sakura **`dialect.slat`** with `:parent "motoi"` through the existing **Rosetta seam** (`motoi-scheme/rosetta/dialect.slat`): a deterministic, no-LLM adapter that binds every verb `:native | :reduced | :virtual | :break`. The seam already exists — it just needs Sakura's manifest authored.

---

## The one real hazard: namespace collision

The `env.define`/registry contract is identical, so installers drop in almost unchanged. **But** Motoi already ships the *same namespaces* Marionette does (`entity/* world/* game/* cortex/* synth/*`) with near-identical name sets — Motoi's game verbs look derived from Marionette in the first place. Under last-writer-wins `env.define`, **install order silently decides which implementation wins.** That is the core surgical decision, not an API problem.

---

## Why translation-first is cheap (the corpus is already Sakura-native)

Lane 3's most useful measurement:

- **Carts don't name the dialect — they call verbs.** `grep -ril motoi` across Curator's **1901** canonical `.sks` carts = **0** hits; 1366 already say "sakura". The 60 motoi mentions in motoi-scheme's own 87 carts are comment-only (`;; motoi run`). → **Carts run unchanged if the verb surface holds.**
- **Training corpus needs NO regen.** `grep -oic motoi` on the full 287 MB `train.jsonl` = **0**. It's already Sakura-native.
- **Books/reference are the real editing load:** 862/864 scheme-book files mention "motoi"; 244 use "Motoi Scheme" as the *language name*. Mechanical rename, but needs a human sift to keep persona-"Motoi" separate from language-"Motoi Scheme".

Marketplace carts are present and ready: `reconcile-sold (etsy, ebay)`, `anti-undercut-reprice`, `crosspost-listing`, `cross-post-ebay-to-google`. That's the Day-7 payoff waiting on the eBay/Etsy keys.

---

## Recommended mechanism

1. **Copy** Motoi's superset engine into `sakura-scheme` (do **NOT** `git filter-repo` — the two repos share zero commit ancestry, so there's nothing to graft; preserve Motoi's history by **tag + CHANGELOG** reference).
2. Keep Sakura's **name, `bin/sakura-scheme`, consumer pins, dialect layer**. Add a `motoi` bin alias for compat.
3. Reconcile the two drifted interpreters to **one**; adopt Motoi's LOCKED R7RS/SRFI std-lib as the base (this is the "some things get standardized" you meant).
4. Author Sakura's `dialect.slat` (`:parent "motoi"`) to bind her 3 verb surfaces onto the merged engine, with an explicit collision policy.
5. Ship as **`sakura-scheme` v1.5.0** — a minor, additive bump so the 3 consumers pinning `^1.4.0` (Curator, Lacuna, Gastronomy) keep working silently.
6. **Compat gate before carts:** all 87 motoi + 1901 Curator carts must run identically, or stop.

---

## Proposed ~1-week schedule (slow and careful, your pace)

| Day | Phase | Exit gate |
|---|---|---|
| 1 | Anchor flip — copy engine in, reconcile the two interp.js, pick base std-lib | `sakura-scheme` test suite (654) green + Motoi modules load |
| 2 | Verb parity — merge 3 verb surfaces, **resolve namespace collisions** per agreed policy | every verb resolves to exactly one intended impl |
| 3 | Doc/name rename — books, reference, site (persona vs language sift) | no stray language-name "Motoi Scheme"; persona "Motoi/Sakura" intact |
| **4** | **COMPAT GATE** | **87/87 + 1901/1901 carts identical, else halt** |
| 5–6 | Curator's 1901 carts under Sakura Scheme; collapse Curator's duplicate interpreter onto shared engine | Curator builds + runs; seal test passes |
| 7 | **eBay/Etsy live-key payoff** — marketplace carts run for real | a real listing round-trips |

---

## Decisions I need from you (the open questions all 3 lanes surfaced)

1. **Collision policy (the big one):** when Motoi and Marionette both define `entity/move!`, `world/step`, etc. — which implementation wins? (Motoi-native, Marionette, or case-by-case?)
2. **License:** confirm **MIT** for the unified repo? (Motoi is currently Apache-2.0; THE-PLAN says MIT.)
3. **Version:** land as **v1.5.0** minor/additive (keeps consumer pins working)?
4. **History:** OK to preserve Motoi's 22 commits by **tag + CHANGELOG** rather than grafting?
5. **Verb forms:** keep **both** hyphenated (`card-open`) and slashed (`card/open`) as aliases, or standardize one?
6. **Curator's forked interpreter:** collapse onto the shared engine **now (Days 5–6)** or defer?
7. **Persona vs language name:** does the *language* rename to "Sakura Scheme" while the *personas* (Motoi, Sakura) stay as characters? (Assumed yes.)
8. **Compat bar:** **byte-identical** cart output, or **semantic-identical**?
9. **dispatch.js carve-out:** both engines still hard-import Curator internals (pre-existing debt) — is finishing that carve-out inside the 1-week window, or separate?
10. **eBay/Etsy Day 7:** sandbox keys first, or straight to live?

Per-lane detail: `scratch/fork-lane1-language-move.md`, `fork-lane2-verbs-surgery.md`, `fork-lane3-editsites-schedule.md`.
