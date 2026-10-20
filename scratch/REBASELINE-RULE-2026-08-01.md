# Test rebaseline decision rule — 2026-08-01

The Motoi suite is **506 pass / 94 fail / 600** (`node --test --test-reporter=tap`;
the default `spec` reporter on Node 26 prints no tally, which is why this looked
like "just failing").

We are taking it to green. **Green is the gate for every other language change.**

## Why this matters more than it looks

A red suite gates nothing. That is not an abstraction — it is the documented cause
of a real, repeated bug: `lib/game/misc.js:33` carries a dated comment
("BUG-2 fix, 2026-07-17: every random-* verb routes through this helper so
`with-seed` covers ALL of them"). SRFI-27 landed 2026-07-26 and reintroduced the
exact same defect, because a 94-red suite could not catch it. That is the **third**
occurrence of that bug class.

So the danger in this task is not "tests still fail." The danger is
**rebaselining a real regression into green** and losing the fourth catch.

## The rule — classify EVERY failing test into exactly one bucket

### 1. STALE-BY-DESIGN → update the test
The thing under test was **deliberately** changed or removed. You must cite the
evidence: an attic path, a git commit, a dated comment, or a doc.

Known design changes already confirmed:
- **`const/*` are values now, not nullary functions.** `./bin/motoi eval "const/pi"`
  → `3.141592653589793`. Tests asserting `typeof === 'function'` and calling
  `env.vars.get('const/pi')()` are stale. The value form is correct and better.
- **Seven modules were ripped as Curator verbs on 2026-07-25** and archived to
  `scratch/attic/curator-verbs-ripped-2026-07-25/game/`: `camera.js` `entity.js`
  `game-instances.js` `motion.js` `part.js` `prefab.js` `scene.js`.

  **DO NOT assume a whole file is stale because it names a ripped module.**
  The rip was partial — some verbs were re-homed and are still live:
  - `entity/spawn` → live (`#t`)
  - `scene/load` → live (`#t`)
  - `camera/scale`, `prefab/make`, `part/attach`, `motion/apply`, `game/step`,
    `sprite` → unbound

  Probe **each verb individually**: `./bin/motoi eval "(procedure? VERB)"`.

### 2. LIVE REGRESSION → fix the CODE, never the test
The thing under test should work and does not. **Fix `src/` or `lib/`.**
Do not touch the assertion. If fixing it is out of scope for your lane, leave the
test failing and report it — a known-red test is worth more than a green lie.

### 3. UNCLEAR → stop and report
You cannot find evidence either way. **Do not guess, do not delete, do not skip.**
Report it to the lead with what you found. An honest null beats a fabricated call.

## Hard constraints

- **No deletes. Ever.** (repo CLAUDE.md). If a test must go, move it under a dated
  `_archive/` subdir — do not `rm`. Prefer rewriting the assertion over removing it.
- **Never `git stash`.** It silently reverted an edit in a prior session.
- **No `--force`, no `--no-verify`. No commits** unless Alfred says so.
- **Do not mass-rewrite assertions to match current behavior.** That is the exact
  failure mode this rule exists to prevent. Every edit needs a stated reason.
- **Stay in your lane's files.** Lanes are file-disjoint by design so we can run
  them concurrently in one tree.
- Verify from the repo root `/Users/alfred/code/motoi-scheme`. A wrong cwd has
  produced false zeros and stray-worktree tallies before. There are ~40 stale
  worktrees under `.claude/worktrees/` — **ignore them**, never edit or count them.

## How to verify your lane

```
cd /Users/alfred/code/motoi-scheme
node --test --test-reporter=tap tests/YOUR-FILE.test.mjs 2>&1 | tail -12
```

## What to report back

A table: test name | bucket (1/2/3) | evidence | what you changed.
Plus an explicit count of bucket-2 regressions found — that number is the real
product of this pass.
