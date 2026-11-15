#!/usr/bin/env python3
"""THE WORKSHOP — where Lacuna writes code without touching our work (2026-10-11).

The owner: "there has to be a way to do this jail where it can also write to the codebase without messing up our work."

  work new <task> [cart-slug …]   a git worktree of ~/code/curator on its own branch lacuna-<task>, cut from the lacuna branch, at
                                  ~/lacuna-world/worktrees/<task> (the one code place the jail may write). Sparse: the
                                  top-level files, curator-web (not public/), curator-api, the Scheme sources, and the
                                  named carts — never the 6 GB tree on a 97 % disk.
  work add <task> <cart-slug|path>  widen it (another cart, another folder)
  work put <task> <path> <n>      the next n bytes become that file (the family chat's way to write; Pi writes directly)
  work show <task> <path>         read a file from the worktree
  work check <task>               commit what changed (Lacuna as author, no hooks run), then test it:
                                  · carts → the STRICT checker (CANON250-BRIEF.md) on dev data, run from the DEV tree's
                                    checker against the worktree's carts, compared with the last full baseline
                                  · curator-web code → `vitest related`, INSIDE the jail
                                  · curator-api code → pytest on the matching tests, INSIDE the jail
                                  The result is kept OUTSIDE the jail (~/.lacuna/workshop/<task>.json), bound to the
                                  commit it tested, so Lacuna cannot write itself a pass.
  work diff <task>                the diff against dev (stat + patch)
  work list | status <task>       the tasks and where each stands
  work log                        the task log (task, branch, files, checks, outcome), newest last
  work drop <task>                remove the worktree (the branch stays for the record)

  merge <task>                    NOT on the broker. Only the family chat's console tool runs it, after the owner's own
                                  "merge it" (workshop.py merge <task> --by <who>); inside the jail it cannot write dev.

GUARANTEES (each enforced here, not by asking the model):
  · it writes only in its worktree: the jail admits ~/lacuna-world and nothing in ~/code; `put` refuses .., absolute
    paths, .git, symlinks and anything resolving outside the worktree;
  · git runs only with the worktree's own git dir named HERE (never the .git file Lacuna could rewrite), on the branch
    lacuna-<task>, with hooks off; no command it writes ever runs outside the jail;
  · no secrets: paths or contents that look like keys refuse the commit;
  · merging into dev needs a recorded passing check on the exact head, no conflict, and the shared tree's files that the
    merge touches clean and unstaged — the merge never touches the shared index beyond those files.
Every step is logged to ~/.lacuna/workshop/log.jsonl (task, branch, files, checks, outcome) for the lead to review.
"""
from __future__ import annotations

import datetime
import json
import os
import time
import shutil
import re
import subprocess
import sys
from pathlib import Path

HOME = Path.home()
REPO = HOME / "code" / "curator"
GIT_COMMON = REPO / ".git"
ROOT = HOME / "lacuna-world" / "worktrees"
STATE = HOME / ".lacuna" / "workshop"
JAIL = HOME / ".lacuna" / "jail" / "lacuna.sb"
BASELINE = REPO / "scratch" / "honest-count" / "runs-all-strict1.json"
DEVDATA = REPO / "scratch" / "honest-count" / "devdata.json"
TASK_RX = re.compile(r"^[a-z0-9][a-z0-9-]{0,39}$")
SLUG_RX = re.compile(r"^[a-z0-9][a-z0-9-]{0,120}$")
SECRET_PATH = re.compile(r"(^|/)(\.env[^/]*|secrets?|.*\.pem|.*\.p12|.*\.key|id_rsa.*|credentials.*|\.claude|\.git[^/]*)(/|$)", re.I)
SECRET_TEXT = re.compile(r"sk-ant-[\w-]{10,}|sk-[A-Za-z0-9]{32,}|AKIA[0-9A-Z]{16}|-----BEGIN [A-Z ]*PRIVATE KEY-----|"
                         r"xox[bap]-[\w-]{10,}|ghp_[A-Za-z0-9]{30,}")
SPARSE = ["/*", "!/*/", "/curator-web/", "!/curator-web/public/", "/curator-api/", "/sakura-scheme/", "/scheme-lang/",
          "/tools/env/", "/docs/eng/", "!.env*"]     # .env files never enter Lacuna's world (the jail cannot read them anyway)
AUTHOR = ["-c", "user.name=Lacuna", "-c", "user.email=lacuna@mac-studio.local"]


class No(Exception):
    """A refusal, said plainly."""


def now() -> str:
    return datetime.datetime.now().isoformat(timespec="seconds")


def log(task: str, step: str, **kw) -> None:
    STATE.mkdir(parents=True, exist_ok=True)
    with open(STATE / "log.jsonl", "a") as f:
        f.write(json.dumps({"at": now(), "task": task, "branch": f"lacuna-{task}", "step": step, **kw}) + "\n")


def rec(task: str) -> dict:
    try:
        return json.loads((STATE / f"{task}.json").read_text())
    except (OSError, ValueError):
        raise No(f"no task {task!r} — start one with: work new {task}")


def save(task: str, r: dict) -> None:
    STATE.mkdir(parents=True, exist_ok=True)
    (STATE / f"{task}.json").write_text(json.dumps(r, indent=1))


def run(cmd: list, cwd=None, timeout=600, env=None) -> tuple[int, str]:
    p = subprocess.run(cmd, cwd=cwd, capture_output=True, text=True, timeout=timeout, env=env)
    return p.returncode, (p.stdout or "") + (p.stderr or "")


def git(r: dict, *args, timeout=300) -> tuple[int, str]:
    """git in the task's worktree with ITS git dir, named from our record — never the .git file in the worktree."""
    return run(["git", "--git-dir", r["gitdir"], "--work-tree", r["path"], "-c", "core.hooksPath=/dev/null",
                "-c", "core.sparseCheckout=true", "-c", "core.sparseCheckoutCone=false", *args], cwd=r["path"], timeout=timeout)


def shared(*args, timeout=120) -> tuple[int, str]:
    return run(["git", "-C", str(REPO), "-c", "core.hooksPath=/dev/null", *args], timeout=timeout)


def task_ok(task: str) -> str:
    if not TASK_RX.match(task or ""):
        raise No("a task name is lowercase letters, digits and dashes (≤40), like fix-ads-roas-etsy")
    return task


def cart_paths(slug: str) -> list[str]:
    if not SLUG_RX.match(slug):
        raise No(f"not a cart slug: {slug!r}")
    return [f"/carts/automations/{slug}/", f"/curator-web/public/automations/cart/{slug}.sks"]


# ── the verbs ─────────────────────────────────────────────────────────────────────────────────────────────────────
# ── THE LACUNA BRANCH (his rule, 2026-10-16): one integration branch, `lacuna`, cut from dev. Every task branches from
# it and lands back on it; dev is merged INTO it (`work sync`) whenever Lacuna wants our latest; it never touches dev
# or main, and nothing of Lacuna's reaches dev except through Alfred's or Claude's merge. ───────────────────────────
INTEGRATION = "lacuna"


def heal() -> list[str]:
    """A worktree whose folder is gone must not block the next task (2026-10-19: after ~/lacuna-world was wiped and
    restored, git still held the `lacuna` branch in a vanished worktree, and every repair/testfix worker died on
    "cannot change to …/worktrees/…"). Prune git's dead registrations; move a task record whose folder is gone to
    STATE/stale/ (kept, never deleted) so `work new` can make it again — its branch is kept and continued."""
    shared("worktree", "prune")
    moved = []
    for f in STATE.glob("*.json"):
        try:
            r = json.loads(f.read_text())
        except (OSError, ValueError):
            continue
        if isinstance(r, dict) and r.get("path") and r.get("gitdir") and not Path(r["path"]).exists():
            (STATE / "stale").mkdir(parents=True, exist_ok=True)
            f.rename(STATE / "stale" / f.name)
            moved.append(r.get("task") or f.stem)
    if moved:
        log("_heal", "stale", tasks=moved)
    return moved


def ensure_integration() -> str:
    code, out = shared("rev-parse", "--verify", "--quiet", INTEGRATION)
    if code:
        code, out = shared("branch", INTEGRATION, "dev")
        if code:
            raise No(f"could not make the {INTEGRATION} branch: {out[-200:]}")
    return INTEGRATION


def sync() -> str:
    """dev → lacuna: bring our latest into Lacuna's branch (never the other way)."""
    heal()
    ensure_integration()
    code, out = shared("worktree", "list", "--porcelain")
    path = None
    for block in out.split("\n\n"):
        if f"branch refs/heads/{INTEGRATION}" in block:
            path = block.split("\n")[0].replace("worktree ", "").strip()
    if not path:
        path = str(ROOT / "_lacuna")
        code, out = shared("worktree", "add", path, INTEGRATION, timeout=900)   # 76k files: minutes, not seconds
        if code:
            raise No(f"could not check out {INTEGRATION}: {out[-200:]}")
    code, out = run(["git", "-C", path, "-c", "core.hooksPath=/dev/null", "merge", "--no-edit", "dev"], timeout=300)
    # proven, not printed: the first sync of 2026-10-18 listed its files yet left the branch where it was
    there, _ = run(["git", "-C", path, "merge-base", "--is-ancestor", "dev", "HEAD"])
    if there:
        raise No(f"{INTEGRATION} did not take dev (exit {code}): {out.strip()[-400:]}")
    return f"{INTEGRATION} has dev"


def land(task: str) -> str:
    """lacuna-<task> → lacuna, after `work check` passed. Lacuna's own landing; dev and main stay Alfred's."""
    r = rec(task_ok(task))
    checks = (r.get("last_check") or {})
    if not checks.get("ok"):
        raise No(f"{task} has no passing check on record — run `work check {task}` first")
    ensure_integration()
    code, out = shared("worktree", "list", "--porcelain")
    path = next((b.split("\n")[0].replace("worktree ", "").strip() for b in out.split("\n\n") if f"branch refs/heads/{INTEGRATION}" in b), None)
    if not path:
        sync()
        return land(task)
    code, out = run(["git", "-C", path, "-c", "core.hooksPath=/dev/null", "merge", "--no-edit", r["branch"]], timeout=300)
    if code:
        raise No(f"merge into {INTEGRATION} failed: {out[-400:]}")
    log(task, "land", onto=INTEGRATION)
    return f"{r['branch']} landed on {INTEGRATION}. Alfred or Claude merges {INTEGRATION} into dev after the gates."


def new(task: str, *carts: str, why: str = "") -> str:
    task_ok(task)
    heal()
    if (STATE / f"{task}.json").exists():
        raise No(f"task {task} exists — work status {task}, or work drop {task} first")
    path = ROOT / task
    ROOT.mkdir(parents=True, exist_ok=True)
    base_branch = ensure_integration()
    sync()                                  # a task starts from today's dev: `lacuna` sat 300 commits behind (2026-10-18)
    _, had = shared("rev-parse", "--verify", "--quiet", f"refs/heads/lacuna-{task}")
    if had.strip():                         # a dropped task's branch was kept: the new worktree continues it
        code, out = shared("worktree", "add", "--no-checkout", str(path), f"lacuna-{task}")
    else:
        code, out = shared("worktree", "add", "--no-checkout", "-b", f"lacuna-{task}", str(path), base_branch)
    if code:
        raise No(f"git would not make the worktree: {out.strip()[-300:]}")
    code, gd = run(["git", "-C", str(path), "rev-parse", "--absolute-git-dir"])   # trusted: we made it a moment ago
    r = {"task": task, "path": str(path), "gitdir": gd.strip(), "branch": f"lacuna-{task}", "carts": [],
         "created": now(), "why": why[:300]}
    if not r["gitdir"].startswith(str(GIT_COMMON / "worktrees")):
        raise No(f"unexpected git dir {r['gitdir']}")
    patterns = SPARSE + [p for s in carts for p in cart_paths(s)]
    r["carts"] = list(carts)
    os.makedirs(f"{r['gitdir']}/info", exist_ok=True)
    Path(f"{r['gitdir']}/info/sparse-checkout").write_text("\n".join(patterns) + "\n")
    code, out = git(r, "read-tree", "-mu", "HEAD")
    if code:
        raise No(f"checkout failed: {out[-300:]}")
    if had.strip():                         # a kept branch catches up with dev too, or its checks judge an old tree
        code, out = git(r, "-c", "core.hooksPath=/dev/null", *AUTHOR, "merge", "--no-edit", INTEGRATION, timeout=600)
        if code:
            git(r, "merge", "--abort")
            raise No(f"lacuna-{task} would not take today's dev cleanly: {out[-300:]}")
    # the tests use the dev tree's installed packages (read-only); never committed (see _stage)
    os.symlink(REPO / "curator-web" / "node_modules", path / "curator-web" / "node_modules")
    save(task, r)
    _, base = git(r, "rev-parse", "--short=10", "HEAD")
    log(task, "new", carts=list(carts), base=base.strip(), why=why[:300])
    return (f"worktree ready: {path}\nbranch lacuna-{task} from {INTEGRATION} {base.strip()}\n"
            + (f"carts: {', '.join(carts)}\n" if carts else "") + "write there, then: work check " + task)


def add(task: str, what: str) -> str:
    r = rec(task_ok(task))
    sp = Path(f"{r['gitdir']}/info/sparse-checkout")
    if SLUG_RX.match(what):
        pats = cart_paths(what)
        r["carts"] = sorted(set(r["carts"]) | {what})
    elif re.match(r"^[\w./-]+$", what) and ".." not in what:
        pats = ["/" + what.strip("/") + ("/" if not Path(what).suffix else "")]
    else:
        raise No("add a cart slug or a repo path")
    sp.write_text(sp.read_text() + "\n".join(pats) + "\n")
    code, out = git(r, "read-tree", "-mu", "HEAD")
    save(task, r)
    return out.strip() or f"added {what}"


def safe_path(r: dict, rel: str) -> Path:
    if not rel or rel.startswith("/") or ".." in Path(rel).parts or SECRET_PATH.search(rel):
        raise No(f"refused path {rel!r}")
    root = Path(r["path"]).resolve()
    p = (root / rel)
    for parent in [p, *p.parents]:
        if parent == root:
            break
        if parent.is_symlink():
            raise No(f"refused: {rel} goes through a link")
    if not str(p.resolve()).startswith(str(root) + "/"):
        raise No(f"refused: {rel} is outside the worktree")
    return p


def put(task: str, rel: str, data: bytes) -> str:
    r = rec(task_ok(task))
    p = safe_path(r, rel)
    if SECRET_TEXT.search(data.decode("utf-8", "replace")):
        raise No("refused: that text looks like a key")
    p.parent.mkdir(parents=True, exist_ok=True)
    p.write_bytes(data)
    log(task, "put", path=rel, bytes=len(data))
    return f"wrote {rel} ({len(data)} bytes)"


def show(task: str, rel: str) -> str:
    r = rec(task_ok(task))
    p = safe_path(r, rel)
    return p.read_text(errors="replace")[:60000] if p.exists() else f"(no file {rel} in the worktree)"


def _changed(r: dict) -> list[str]:
    code, out = git(r, "diff", "--name-only", "dev...HEAD")
    return [l for l in out.splitlines() if l.strip()] if code == 0 else []


def _stage(r: dict) -> list[str]:
    git(r, "add", "-A", "--", ".", ":!curator-web/node_modules", ":!scratch")
    _, names = git(r, "diff", "--cached", "--name-only")
    files = [n for n in names.splitlines() if n.strip()]
    for f in files:
        if SECRET_PATH.search(f):
            git(r, "reset", "-q")
            raise No(f"refused to commit {f}: it looks like a secret's place")
    _, patch = git(r, "diff", "--cached")
    if SECRET_TEXT.search(patch):
        git(r, "reset", "-q")
        raise No("refused to commit: the change contains text that looks like a key")
    return files


def jailed(cmd: list, cwd: str, timeout=900) -> tuple[int, str]:
    env = {"PATH": "/opt/homebrew/bin:/usr/bin:/bin:/usr/sbin:/sbin", "HOME": str(HOME), "CI": "1"}
    return run(["/usr/bin/sandbox-exec", "-f", str(JAIL), *cmd], cwd=cwd, timeout=timeout, env=env)


def strict(r: dict, slugs: list[str], quick: bool = False) -> list[dict]:
    """The strict checker of the DEV tree run over the WORKTREE's carts on dev data (no network, no QA).
    quick: the model's steps get the harness's canned answers instead of a live call — ~7 s a cart instead of ~10 min
    (measured 2026-10-17); the repair loop's inner check. Never recorded as a pass: only the live check lands."""
    tmp = STATE / f"{r['task']}{'.quick' if quick else ''}.only.json"
    tmp.write_text(json.dumps(slugs))
    tag = f"lacuna-{r['task']}{'-quick' if quick else ''}"
    env = {**os.environ, "CARTS_ROOT": f"{r['path']}/carts/automations", "CART_HONEST": "1", "CART_STRICT": "1",
           "CART_ACCOUNT": "all", ("CART_MODEL_ANSWERS" if quick else "CART_MODEL_LIVE"): "1",
           "CART_DEVDATA": str(DEVDATA), "CART_ONLY": str(tmp), "CART_OUT_TAG": tag}
    code, out = run([str(REPO / "curator-web/node_modules/.bin/vitest"), "run", "src/scheme/executeAllCarts.test.js"],
                    cwd=str(REPO / "curator-web"), timeout=900, env=env)
    try:
        runs = json.loads((REPO / f"scratch/honest-count/runs-{tag}.json").read_text())
    except (OSError, ValueError):
        return [{"slug": s, "verdict": "checker did not run", "passes": False, "tail": out[-600:]} for s in slugs]
    try:
        base = json.load(open(BASELINE))
    except (OSError, ValueError):
        base = {}
    rows = []
    for s in slugs:
        v = runs.get(s) or {}
        cls = (v.get("verdict") or {}).get("cls")
        rows.append({"slug": s, "verdict": cls, "detail": (v.get("verdict") or {}).get("detail"),
                     "before": ((base.get(s) or {}).get("verdict") or {}).get("cls"),
                     "passes": cls in ("strict:works", "strict:works-model"),
                     # how much the cart hands the model (the checker's ctxBytes, B40): the biggest model step
                     "ctx_bytes": max([a.get("ctxBytes") or 0 for a in (v.get("acts") or []) if a.get("kind") == "model"] or [0]),
                     "reasons": [x[:200] for x in (v.get("reasons") or [])[-2:]]})
    return rows


EXTS = r"(?:py|js|jsx|mjs|ts|tsx|sh|md|json|jsonl|sks|gbnf|css|html|toml|ya?ml|txt|plist|sb)"
PATHLIKE = re.compile(rf"`([A-Za-z0-9_.\-/]+\.{EXTS}|[A-Za-z0-9_.\-]+/[A-Za-z0-9_.\-/]*)`")


def docs_gate(root: Path, doc: str) -> list[str]:
    """B23's docs gate: every file or folder a doc names in backticks exists in the task's tree (git's tree at HEAD plus
    the work in the folder — Lacuna's worktrees are sparse, so the disk alone would lie), beside the doc or from the
    repo root. A README that invents a file is refused. Globs, URLs and absolute or home paths are not checked."""
    _, listing = run(["git", "-C", str(root), "ls-tree", "-r", "--name-only", "HEAD"], timeout=120)
    tracked = set(listing.splitlines())
    folders = {str(p) for f in tracked for p in Path(f).parents}
    here = Path(doc).parent
    text = (root / doc).read_text(errors="replace")
    gone = []
    for m in PATHLIKE.finditer(text):
        name = m.group(1).rstrip("/")
        if "*" in name or "://" in name or name.startswith(("~", "/")):
            continue
        # beside the doc, or from any folder above it (a package README names `cortex/knowledge.py` from its package root)
        hits = [str(base / name) for base in (here, *here.parents)]
        if not any(h in tracked or h in folders or (root / h).exists() for h in hits):
            gone.append(name)
    return sorted(set(gone))


def check(task: str) -> str:
    r = rec(task_ok(task))
    # the publisher's plain copy of each cart the task touches (CANON250-BRIEF: copy to public/automations/cart)
    for s in r["carts"]:
        src = Path(r["path"]) / f"carts/automations/{s}/{s}.sks"
        dst = Path(r["path"]) / f"curator-web/public/automations/cart/{s}.sks"
        if src.exists() and dst.parent.exists() and not src.is_symlink():
            dst.write_bytes(src.read_bytes())
    files = _stage(r)
    if files:
        code, out = git(r, *AUTHOR, "commit", "-q", "--no-verify", "-m",
                        f"lacuna-{task}: {r.get('why') or 'work in progress'}\n\nLacuna-Task: {task}")
        if code:
            raise No(f"commit failed: {out[-300:]}")
    changed = _changed(r)
    if not changed:
        # THE CHECK CANNOT RUN ON AN UNEDITED TASK (2026-10-19: the repair card's step 1 was "run box work check and quote the
        # verdict", and every attempt wandered for 25 minutes): say what the strict verdict IS today, from the last strict run,
        # and what to do — edit, then check
        base = []
        try:
            runs = json.loads(BASELINE.read_text())
            for slug in r.get("carts") or []:
                cls = ((runs.get(slug) or {}).get("verdict") or {}).get("cls")
                if cls:
                    base.append(f"{slug}: {cls}")
        except (OSError, ValueError):
            pass
        return ("nothing changed against dev yet — the check runs once the cart is edited. "
                + (f"Today's strict verdict (last strict run): {'; '.join(base)}. " if base else "")
                + "Read the cart, make the smallest edit that verdict names, then `box work check` again.")
    _, head = git(r, "rev-parse", "HEAD")
    results: dict = {"head": head.strip(), "at": now(), "files": changed, "checks": []}
    slugs = sorted({m.group(1) for f in changed for m in [re.match(r"carts/automations/([^/]+)/[^/]+\.sks$", f)] if m})
    if slugs:
        rows = strict(r, slugs)
        results["checks"].append({"name": "strict cart checker (dev data)", "ok": all(x["passes"] for x in rows), "carts": rows})
    web = [f[len("curator-web/"):] for f in changed if f.startswith("curator-web/src/") and re.search(r"\.(jsx?|tsx?)$", f)]
    if web:
        code, out = jailed([str(REPO / "curator-web/node_modules/.bin/vitest"), "related", "--run", "--no-cache", *web],
                           cwd=f"{r['path']}/curator-web")
        results["checks"].append({"name": "vitest related (in the jail)", "ok": code == 0, "tail": out[-1500:]})
    api = [f for f in changed if f.startswith("curator-api/") and f.endswith(".py")]
    if api:
        tests = sorted({t for f in api for t in (f"curator-api/tests/test_{Path(f).stem}.py",) if (Path(r["path"]) / t).exists()}
                       | {f for f in api if Path(f).name.startswith("test_")})
        if tests:
            code, out = jailed([str(REPO / "curator-api/.venv/bin/python"), "-m", "pytest", "-q", "-x", "-p", "no:cacheprovider",
                                *[t[len("curator-api/"):] for t in tests]], cwd=f"{r['path']}/curator-api")
            results["checks"].append({"name": "pytest (in the jail)", "ok": code == 0, "tests": tests, "tail": out[-1500:]})
    docs = [f for f in changed if f.endswith(".md")]
    if docs:
        missing = {f: docs_gate(Path(r["path"]), f) for f in docs}
        missing = {f: m for f, m in missing.items() if m}
        results["checks"].append({"name": "docs gate (every path a doc names exists)", "ok": not missing, "missing": missing})
    if not results["checks"]:
        results["checks"].append({"name": "no automated check covers these files", "ok": False,
                                  "why": "the owner reads the diff; merge stays refused until a check passes"})
    results["passed"] = all(c["ok"] for c in results["checks"])
    r["last_check"] = {"ok": results["passed"], "at": results["at"], "head": results["head"]}   # `work land` reads this
    r["check"] = results
    save(task, r)
    log(task, "check", head=results["head"][:10], files=changed, passed=results["passed"],
        checks=[{"name": c["name"], "ok": c["ok"], **({"carts": [(x["slug"], x["before"], x["verdict"]) for x in c["carts"]]}
                                                     if "carts" in c else {})} for c in results["checks"]])
    return json.dumps(results, indent=1)


def quick(task: str) -> str:
    """The inner check of a repair loop: the task's carts through the strict checker with canned model answers. JSON
    rows; nothing committed, nothing recorded — `check` is still the one that counts."""
    r = rec(task_ok(task))
    slugs = list(r.get("carts") or [])
    if not slugs:
        return json.dumps({"ok": False, "why": "this task names no cart"})
    rows = strict(r, slugs, quick=True)
    log(task, "quick", carts=[(x["slug"], x["verdict"]) for x in rows])
    return json.dumps({"ok": all(x.get("passes", False) for x in rows), "quick": True, "carts": rows}, indent=1)


def diff(task: str) -> str:
    r = rec(task_ok(task))
    _, stat = git(r, "diff", "--stat", "dev...HEAD")
    _, patch = git(r, "diff", "dev...HEAD", "--", ".", ":!curator-web/public")
    return (stat + "\n" + patch)[:24000]


def status(task: str) -> str:
    r = rec(task_ok(task))
    c = r.get("check") or {}
    _, head = git(r, "rev-parse", "--short=10", "HEAD")
    return json.dumps({"task": task, "branch": r["branch"], "worktree": r["path"], "carts": r["carts"],
                       "head": head.strip(), "checked_head": c.get("head", "")[:10], "passed": c.get("passed"),
                       "merged": r.get("merged")}, indent=1)


def tasks() -> str:
    out = []
    for p in sorted(STATE.glob("*.json")):
        try:
            r = json.loads(p.read_text())
            if not isinstance(r, dict) or "task" not in r:
                continue
            out.append(f"{r['task']}: {'merged ' + r['merged'] if r.get('merged') else 'check passed' if (r.get('check') or {}).get('passed') else 'open'}")
        except (ValueError, KeyError):
            continue
    return "\n".join(out) or "no tasks"


def drop(task: str) -> str:
    """The worktree goes, the branch stays, and the task's record is moved aside — so the name can be used again. A
    worktree already half gone (its folder left without a checkout) is pruned and its folder removed, never left stuck
    (2026-10-18: a stale folder made `new` say "exists" and a worker wrote into a folder that was no checkout)."""
    r = rec(task_ok(task))
    code, out = shared("worktree", "remove", "--force", r["path"])
    if code:
        shared("worktree", "prune")
        p = Path(r["path"])
        if p.exists() and ROOT in p.resolve().parents and not (p / ".git").exists():
            shutil.rmtree(p)
        out = f"the worktree was already broken — pruned and its folder removed; branch {r['branch']} kept"
    r["dropped"] = now()
    (STATE / f"{task}.json").rename(STATE / f"{task}.dropped-{int(time.time())}.json")
    log(task, "drop")
    return out.strip() or f"worktree removed; branch {r['branch']} kept"


def merge(task: str, by: str) -> str:
    """Into dev, for the owner only (his "merge it"). Builds the merge commit without the shared index, moves dev with a
    compare-and-swap, then refreshes ONLY the merged files in the shared tree."""
    r = rec(task_ok(task))
    c = r.get("check") or {}
    _, head = git(r, "rev-parse", "HEAD")
    head = head.strip()
    if not c.get("passed") or c.get("head") != head:
        raise No("refused: no passing check on the branch's current head — run work check first")
    _, cur = shared("symbolic-ref", "--short", "HEAD")
    if cur.strip() != "dev":
        raise No(f"refused: the shared tree is on {cur.strip()}, not dev")
    _, old = shared("rev-parse", "dev")
    old = old.strip()
    _, files = shared("diff", "--name-only", f"{old}...{head}")
    files = [f for f in files.splitlines() if f.strip()]
    _, dirty = shared("status", "--porcelain", "--", *files)
    if dirty.strip():
        raise No(f"refused: the shared tree has unsaved work in these files — the lanes' work comes first:\n{dirty[:800]}")
    code, tree = shared("merge-tree", "--write-tree", old, head)
    if code:
        raise No(f"refused: it conflicts with dev now — work check again after rebasing:\n{tree[:600]}")
    msg = (f"Merge lacuna-{task} into dev\n\n{r.get('why') or ''}\nChecks: "
           + "; ".join(f"{x['name']} {'ok' if x['ok'] else 'FAILED'}" for x in c["checks"])
           + f"\nMerged on the owner's word ({by}).\n\nLacuna-Task: {task}")
    code, new_sha = run(["git", "-C", str(REPO), *AUTHOR, "commit-tree", tree.splitlines()[0].strip(), "-p", old, "-p", head, "-m", msg])
    if code:
        raise No(f"commit-tree failed: {new_sha[-300:]}")
    new_sha = new_sha.strip()
    code, out = shared("update-ref", "-m", f"lacuna merge {task}", "refs/heads/dev", new_sha, old)
    if code:
        raise No(f"refused: dev moved while merging — try again: {out[-200:]}")
    present = set(run(["git", "-C", str(REPO), "ls-tree", "-r", "--name-only", new_sha, "--", *files])[1].split("\n"))
    keep = [f for f in files if f in present]
    gone = [f for f in files if f not in present]
    if keep:
        shared("checkout", new_sha, "--", *keep)
    if gone:
        shared("rm", "-q", "--ignore-unmatch", "--", *gone)
    r["merged"] = f"{new_sha[:10]} at {now()} by {by}"
    save(task, r)
    log(task, "merge", sha=new_sha[:10], files=files, by=by)
    return f"merged lacuna-{task} into dev as {new_sha[:10]} ({len(files)} files). The dev API does not hot-reload: restart it if the change is API code."


def propose_merge(task: str, why: str = "") -> str:
    """A reviewed task asks for the owner's merge: Lacuna files the contract (a permission card on the desk). Only his yes
    runs merge() below — the broker's own caller never can."""
    r = rec(task_ok(task))
    c = r.get("check") or {}
    if not c.get("passed"):
        raise No("no passing check on record — the review should not have signed")
    import urllib.request as _u
    body = json.dumps({"action": "merge", "build": task, "reason": why.replace("_", " ")[:300] or f"lacuna-{task} passed its check and its review"}).encode()
    req = _u.Request("http://127.0.0.1:1138/api/petitions", data=body, headers={"Content-Type": "application/json", "X-Lacuna-Who": "lacuna"})
    with _u.urlopen(req, timeout=20) as resp:
        out = json.loads(resp.read().decode() or "{}")
    log(task, "propose-merge", petition=out.get("petition"))
    return f"a merge card for lacuna-{task} is on the desk (petition {out.get('petition')})"


def handle(words: list[str], body: bytes = b"") -> str:
    """The broker's entry: `work <verb> …`."""
    if not words:
        return __doc__.split("GUARANTEES")[0]
    v, a = words[0], words[1:]
    # NO TASK NAMED → THE ONE THAT IS OPEN (2026-10-19: the repair worker typed `box work check` with no task, got the usage text and
    # sat for 20 minutes): check · quick · diff · status take the only open task when none is given; with several, they are listed
    if v in ("check", "quick", "diff", "status") and not a:
        open_tasks = sorted(f.stem for f in STATE.glob("*.json") if not f.name.endswith((".only.json", ".quick.only.json")) and ".dropped-" not in f.name
                            and f.stem not in ("log",))
        if len(open_tasks) == 1:
            a = [open_tasks[0]]
        elif open_tasks:
            return f"which task? {v} needs one of: {', '.join(open_tasks)} — e.g. `box work {v} {open_tasks[-1]}`"
    try:
        if v == "new" and a:
            return new(a[0], *[s for s in a[1:] if not s.startswith("why=")],
                       why=" ".join(s[4:] for s in a[1:] if s.startswith("why=")).replace("_", " "))
        if v == "add" and len(a) == 2:
            return add(*a)
        if v == "put" and len(a) == 2:     # the broker took the byte count off the line
            return put(a[0], a[1], body)
        if v == "propose-merge" and a:
            return propose_merge(a[0], " ".join(a[1:]))
        if v == "show" and len(a) == 2:
            return show(*a)
        if v == "check" and len(a) == 1:
            return check(a[0])
        if v == "quick" and len(a) == 1:
            return quick(a[0])
        if v == "diff" and len(a) == 1:
            return diff(a[0])
        if v == "status" and len(a) == 1:
            return status(a[0])
        if v == "sync":
            return sync()
        if v == "land" and len(a) == 1:
            return land(a[0])
        if v == "list":
            return tasks()
        if v == "log":     # the task log, newest last: what Lacuna did, for the lead to review and teach from
            try:
                return "".join((STATE / "log.jsonl").read_text().splitlines(True)[-40:])
            except OSError:
                return "no code tasks yet"
        if v == "drop" and len(a) == 1:
            return drop(a[0])
        return "work new <task> [slug …] [why=words_with_underscores] · add · put · show · check · diff · status · list · drop"
    except No as e:
        return str(e)


if __name__ == "__main__":
    # the family chat's console runs: workshop.py merge <task> --by <who>   (inside the jail this cannot write dev)
    if len(sys.argv) >= 3 and sys.argv[1] == "merge":
        by = sys.argv[sys.argv.index("--by") + 1] if "--by" in sys.argv else "unknown"
        try:
            print(merge(sys.argv[2], by))
        except No as e:
            print(e)
            sys.exit(2)
    else:
        print(handle(sys.argv[1:]))
