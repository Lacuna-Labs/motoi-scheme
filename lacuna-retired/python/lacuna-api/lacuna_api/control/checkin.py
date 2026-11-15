"""CHECK-IN — the working tree's changes, committed to dev on the owner's press (playbooks/RELEASE.md §2; the owner,
2026-10-18: "it performs the check-in to get local and does a check-in to dev").

A `check-in` card names: the PATHS (pathspec only — never `add -A`), the MESSAGE (subject ≤72 chars), and the TESTS that
prove it. On the owner's yes this commits exactly those paths on dev in the curator repo. It refuses:
  · any branch but dev (main is the customer's — it moves only by promote)
  · a path outside the repo, or one that names a secret (.env, keys, tokens, secrets/, *.pem)
  · a subject longer than 72 characters, or an empty message
  · nothing to commit
"""
from __future__ import annotations

import re
import subprocess
from pathlib import Path

from .core import REPO, audit

SECRET = re.compile(r"(^|/)(\.env[^/]*|secrets?/|.*\.pem$|.*(token|apikey|api_key|password)[^/]*$)", re.I)


def _git(*a: str) -> subprocess.CompletedProcess:
    return subprocess.run(["git", "-C", str(REPO), *a], capture_output=True, text=True, timeout=120)


def check(args: dict) -> str | None:
    paths = [str(p).strip() for p in (args.get("paths") or []) if str(p).strip()]
    msg = str(args.get("message") or "").strip()
    if not paths:
        return "a check-in names its paths (pathspec only)"
    if not msg or len(msg.splitlines()[0]) > 72:
        return "a check-in's subject is 1–72 characters"
    for p in paths:
        if p.startswith("/") or ".." in Path(p).parts:
            return f"{p}: a path inside the repo, relative"
        if SECRET.search(p):
            return f"{p}: names a secret — never committed"
    return None


def effect(args: dict) -> str:
    paths = args.get("paths") or []
    return (f"commits {len(paths)} path(s) on dev in the curator repo — {', '.join(map(str, paths[:6]))}{' …' if len(paths) > 6 else ''} — "
            f"\"{str(args.get('message') or '').splitlines()[0][:72] if args.get('message') else ''}\"; tests named: {', '.join(map(str, (args.get('tests') or [])[:4])) or 'none'}")


def commit(args: dict, who: str) -> dict:
    why = check(args)
    if why:
        return {"ok": False, "why": why}
    branch = _git("rev-parse", "--abbrev-ref", "HEAD").stdout.strip()
    if branch != "dev":
        return {"ok": False, "why": f"the repo is on {branch!r}, not dev — a check-in goes to dev only"}
    paths = [str(p) for p in args["paths"]]
    add = _git("add", "--", *paths)
    if add.returncode:
        return {"ok": False, "why": add.stderr.strip()[:300]}
    staged = _git("diff", "--cached", "--name-only", "--", *paths).stdout.split()
    if not staged:
        return {"ok": False, "why": "nothing to commit in those paths"}
    msg = str(args["message"]).strip() + f"\n\nChecked in by Lacuna on the owner's press ({who})."
    c = _git("commit", "-q", "-m", msg, "--", *paths)
    if c.returncode:
        return {"ok": False, "why": (c.stderr or c.stdout).strip()[:400]}
    sha = _git("rev-parse", "--short", "HEAD").stdout.strip()
    audit(who, "check-in", sha=sha, paths=staged[:20])
    return {"ok": True, "sha": sha, "files": staged}
