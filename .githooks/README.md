# .githooks/ — Motoi Scheme repo git hooks

Repo-scoped git hooks. **Not global** — installing them touches only this
repository's `git config`.

## What's in here

- `pre-commit` — the **Motoi network-abstinence guard**. Enforces Alfred's
  durable doctrine (2026-07-17): *"Motoi cannot connect to networks. Ever."*
  Rejects:
  1. Any new/modified file under `lib/net/` other than the single allowed
     server file `lib/net/http-serve.js`. Files matching `lib/net/*-client.*`
     get a specialized "loam-flavored" rejection that points at
     `_archive-doctrine-violation-loam-client-2026-07-17/MANIFEST.slat`.
  2. Source lines under `lib/` or `src/` that shape like an HTTP CLIENT
     (`fetch(http…)`, `axios`, `node-fetch`, `http.request`,
     `net.createConnection`, `new WebSocket(…)`, remote URL string
     literals, etc.). Loopback URLs (`127.0.0.1`, `localhost`, `0.0.0.0`)
     are allowed. `lib/ai/llm.js` is exempt — approved local-LLM curl
     exception.

  Fast path: if no staged file touches `lib/net/`, `lib/`, or `src/`,
  the hook exits in under a single `git diff` call. Under 500ms on a
  normal commit.

## Install

Run once per clone:

```bash
bash scripts/install-hooks.sh
```

That script sets `git config core.hooksPath .githooks` — repo-scoped, no
global side effects.

To verify:

```bash
git config core.hooksPath   # should print: .githooks
```

## Bypass

`git commit --no-verify` bypasses **all** pre-commit hooks. Alfred's
`CLAUDE.md` says:

> No `--force`, no `--no-verify`.

Agents that reach for `--no-verify` are violating repo doctrine. Git does
not offer any way for a pre-commit hook to detect `--no-verify`; the hook
simply isn't invoked. This README is the only warning.

## Extending

Adding a new hook: drop it in this directory, `chmod +x`, done — `core.hooksPath`
picks it up automatically. Keep hooks fast (~500ms budget for pre-commit) and
document their doctrinal basis at the top of the file.
