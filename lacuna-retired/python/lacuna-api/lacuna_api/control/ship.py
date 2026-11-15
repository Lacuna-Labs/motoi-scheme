"""SHIP — Lacuna writes code on its own branch, commits it, pushes it to GitHub, and asks for the merge (the owner,
2026-10-19: "give it all the tools it will need to write, push, and release code to its own branch in github").

Where: Lacuna's own clone, ~/lacuna-world/repos/lacuna (its `origin` is the owner's working copy, ~/code/lacuna; the
remote `github` is the public repository). It writes there with `shell`, then:

  ship status                the branch, what changed, ahead/behind main, the remotes
  ship branch NAME           start (or return to) `lacuna/NAME`, cut from the newest main
  ship commit MESSAGE        stage and commit everything that changed — after the secret scan
  ship push                  push the current branch to GitHub (never main, never dev, never forced)
  ship propose               put a card on the desk: the branch, its diff, the compare link — the owner merges

The walls (code, not words): a branch must start with `lacuna/`; main, master, dev and release branches are refused for
every op; a push is never forced; a diff holding a secret (a key, a token, a private key, an .env or .pem file) is
refused before the commit; every op is audited with who asked. MERGING INTO MAIN IS THE OWNER'S PRESS — the card's
link opens GitHub's compare page; Lacuna cannot merge. The push runs outside the jail (the API holds the owner's git
access); it fails fast (BatchMode, 20 s) rather than hang when the key is not available.
"""
from __future__ import annotations

import os
import re
import subprocess
import time
from pathlib import Path

HOME = Path.home()
CLONE = HOME / "lacuna-world" / "repos" / "lacuna"
GITHUB = "git@github.com:Lacuna-Labs/lacuna.git"
COMPARE = "https://github.com/Lacuna-Labs/lacuna/compare/main...{branch}?expand=1"
PREFIX = "lacuna/"
PROTECTED = re.compile(r"^(main|master|dev|develop|release.*|production|prod)$|^refs/", re.I)
NAME = re.compile(r"^[a-z0-9][a-z0-9._-]{0,60}$")
SECRET_PATH = re.compile(r"(^|/)(\.env[^/]*|secrets?|.*\.pem|.*\.p12|.*\.key|id_rsa.*|id_ed25519.*|credentials.*|owner-key|\.claude)(/|$)", re.I)
SECRET_TEXT = re.compile(r"sk-ant-[\w-]{10,}|sk-[A-Za-z0-9]{32,}|AKIA[0-9A-Z]{16}|-----BEGIN [A-Z ]*PRIVATE KEY-----|"
                         r"xox[bap]-[\w-]{10,}|ghp_[A-Za-z0-9]{30,}|gho_[A-Za-z0-9]{30,}|AIza[0-9A-Za-z_-]{30,}")
ENV = {**os.environ, "GIT_TERMINAL_PROMPT": "0", "GIT_PAGER": "cat",
       "GIT_SSH_COMMAND": "ssh -o BatchMode=yes -o ConnectTimeout=20 -o StrictHostKeyChecking=accept-new",
       "GIT_AUTHOR_NAME": "Lacuna", "GIT_AUTHOR_EMAIL": "lacuna@mac-studio.local",
       "GIT_COMMITTER_NAME": "Lacuna", "GIT_COMMITTER_EMAIL": "lacuna@mac-studio.local"}


def _git(*args: str, timeout: int = 60) -> tuple[int, str]:
    try:
        p = subprocess.run(["git", "-C", str(CLONE), "-c", "core.hooksPath=/dev/null", *args], capture_output=True, text=True,
                           timeout=timeout, env=ENV)
        return p.returncode, (p.stdout + p.stderr).strip()
    except (OSError, subprocess.SubprocessError) as e:
        return 1, f"{e.__class__.__name__}: {e}"


def _branch() -> str:
    return _git("rev-parse", "--abbrev-ref", "HEAD")[1]


def _own(branch: str) -> str | None:
    """None when `branch` is one Lacuna may write and push; else why not."""
    if PROTECTED.match(branch):
        return f"{branch} is protected: Lacuna never writes or pushes it — only the owner merges into it"
    if not branch.startswith(PREFIX):
        return f"Lacuna's branches start with {PREFIX} (this one is {branch}); `ship branch NAME` starts one"
    return None


def _ensure() -> str | None:
    if not (CLONE / ".git").exists():
        return f"Lacuna's clone is missing ({CLONE})"
    code, out = _git("remote")
    if "github" not in out.split():
        _git("remote", "add", "github", GITHUB)
    return None


def _scan() -> str | None:
    """Refuse a change that holds a secret: by path (.env, keys) and by what the added lines say."""
    code, names = _git("status", "--porcelain")
    for ln in names.splitlines():
        path = ln[3:].strip().strip('"')
        if SECRET_PATH.search(path):
            return f"{path} looks like a secret or a key file — not committed"
    _git("add", "-N", ".")
    _, diff = _git("diff", "HEAD", "--unified=0", timeout=120)
    for ln in diff.splitlines():
        if ln.startswith("+") and not ln.startswith("+++") and SECRET_TEXT.search(ln):
            return "an added line holds what looks like a key or token — not committed; remove it and try again"
    return None


def do(op: str, arg: str, who: str) -> dict:
    from .core import audit
    why = _ensure()
    if why:
        return {"ok": False, "why": why}
    audit(who, f"ship.{op}", arg=str(arg)[:120], branch=_branch())
    if op == "status":
        _git("fetch", "origin", "--quiet", timeout=60)
        b = _branch()
        _, ab = _git("rev-list", "--left-right", "--count", f"origin/main...{b}")
        behind, ahead = (ab.split() + ["?", "?"])[:2]
        _, st = _git("status", "--short")
        _, rem = _git("remote", "-v")
        return {"ok": True, "branch": b, "mine": _own(b) is None, "ahead_of_main": ahead, "behind_main": behind,
                "changed": st.splitlines()[:40], "remotes": sorted({ln.split()[0] + " " + ln.split()[1] for ln in rem.splitlines()}),
                "can_push": _own(b) is None}
    if op == "branch":
        name = re.sub(r"[^a-z0-9._-]+", "-", str(arg).lower().removeprefix(PREFIX)).strip("-")[:60]
        if not NAME.match(name):
            return {"ok": False, "why": "name the branch in lowercase words: ship branch fix-notify-cart"}
        full = PREFIX + name
        _git("fetch", "origin", "--quiet", timeout=60)
        code, _ = _git("rev-parse", "--verify", "--quiet", full)
        if code == 0:
            code, out = _git("checkout", full)
        else:
            base = "origin/main" if _git("rev-parse", "--verify", "--quiet", "origin/main")[0] == 0 else "main"
            code, out = _git("checkout", "-b", full, base)
        return {"ok": code == 0, "branch": full, "said": out[-300:]}
    b = _branch()
    refused = _own(b)
    if refused:
        return {"ok": False, "refused": refused}
    if op == "commit":
        msg = str(arg).strip()
        if len(msg) < 8:
            return {"ok": False, "why": "say what changed in a line: ship commit \"cart notify: emit an empty table\""}
        bad = _scan()
        if bad:
            return {"ok": False, "refused": bad}
        _git("add", "-A")
        code, out = _git("commit", "-m", msg + f"\n\nWritten by Lacuna, asked by {who}.")
        return {"ok": code == 0, "said": out[-400:], "branch": b}
    if op == "push":
        code, out = _git("push", "--set-upstream", "github", f"{b}:{b}", timeout=90)
        if code:
            out += "\n(if this says Permission denied: the API's user has no GitHub key; the owner adds one, or pushes the branch himself)"
        return {"ok": code == 0, "said": out[-500:], "branch": b, "compare": COMPARE.format(branch=b)}
    if op == "propose":
        _, stat = _git("diff", "--stat", "origin/main...HEAD")
        _, log = _git("log", "--oneline", "origin/main..HEAD")
        from . import home
        home.act({"op": "place", "id": f"ship-{int(time.time()) % 1_000_000}", "kind": "note", "title": f"merge {b}?",
                  "block": {"kind": "note", "text": f"Lacuna asks for a merge of {b} into main.\n\n{log}\n\n{stat}\n\n"
                            f"Compare and merge: {COMPARE.format(branch=b)}"}}, who="lacuna")
        return {"ok": True, "said": "a card is on the desk with the diff and the compare link; the merge is the owner's", "compare": COMPARE.format(branch=b)}
    return {"ok": False, "why": "ship does: status · branch NAME · commit MESSAGE · push · propose"}
