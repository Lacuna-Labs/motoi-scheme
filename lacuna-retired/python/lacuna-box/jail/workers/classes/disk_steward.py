"""disk-steward — Lacuna cleans up its OWN mess, and only its own (LACUNA-1.3-DESIGN §37 cart 6; the exam's E8).

It takes an inventory of what Lacuna made — the workshop's worktrees under ~/lacuna-world/worktrees, its scratch, its
jobs' folders, the strict checker's runs it asked for — with sizes (du). Then it removes ONLY the worktrees that pass
every one of these, each checked by code, never by a model:

  · OURS:    a direct child of the worktrees folder, not a link, whose workshop record (`box work status`) says it is
             that very folder on the branch lacuna-<its name> — the workshop made it for Lacuna, nobody else;
  · DONE:    merged (the record says so, or every commit of the task is in dev or lacuna), or retired (no worker on it
             and every worker that named it has ended, or nothing touched it for 7 days);
  · SAFE:    no worker is on it now, its tree is clean (no uncommitted work), and it is not waiting on the owner's
             merge (a passing check that is not merged yet).

The removal is the workshop's own `box work drop`, which takes the folder and KEEPS the branch. It never deletes a
branch, never touches a file outside a worktree it proved its own, and counts the bytes it freed. Everything else —
a folder with no record, a broken checkout, Lacuna's scratch — is listed in its report for the owner, untouched.

  inputs:  dry (false: true lists what it would remove and removes nothing) · stale_days (7)
"""
from __future__ import annotations

import json
import os
import re
import subprocess
import time

HOME = os.path.expanduser("~")
WORLD = f"{HOME}/lacuna-world"
ROOT = f"{WORLD}/worktrees"
REPO = f"{HOME}/code/curator"
TOOLS = f"{WORLD}/tools"
TASK_RX = re.compile(r"^[a-z0-9][a-z0-9-]{0,39}$")      # the workshop's own rule for a task name
LIVE = ("spawned", "briefed", "executing", "reporting")
# Lacuna's own scratch: listed with sizes for the owner, never removed by this worker
SCRATCH = [f"{WORLD}/scratch", f"{WORLD}/jobs", f"{WORLD}/artifacts", f"{WORLD}/ledger"]
RUNS = f"{REPO}/scratch/honest-count"                   # the strict checker's runs it asked for: runs-lacuna-*.json


def sh(args, timeout=120, stdin=None):
    try:
        p = subprocess.run(args, capture_output=True, text=True, timeout=timeout, input=stdin)
        return p.returncode, (p.stdout or "") + (p.stderr or "")
    except subprocess.TimeoutExpired:
        return 124, f"timed out after {timeout} s"


def du_kb(path: str) -> int:
    code, out = sh(["du", "-sk", path], timeout=600)
    try:
        return int(out.split()[0])
    except (ValueError, IndexError):
        return 0


# ── the pure rules (tested: they never select a path that is not Lacuna's) ────────────────────────────────────────────
def is_own(path: str, status: dict | None, root: str | None = None) -> tuple[bool, str]:
    """Lacuna's own worktree: a plain folder directly under the worktrees folder, named like a workshop task, whose
    workshop record says it is this folder on lacuna-<name>. Anything short of all of that is not its own."""
    root = root or ROOT
    name = os.path.basename(path.rstrip("/"))
    if os.path.dirname(os.path.normpath(path)) != os.path.normpath(root):
        return False, "not directly in the worktrees folder"
    if os.path.islink(path):
        return False, "a link, not a folder"
    if os.path.realpath(path) != os.path.join(os.path.realpath(root), name):
        return False, "resolves somewhere else"
    if not TASK_RX.match(name):
        return False, "not a workshop task's name"
    if not isinstance(status, dict) or status.get("task") != name:
        return False, "no workshop record for it"
    if os.path.normpath(str(status.get("worktree") or "")) != os.path.normpath(path):
        return False, f"its record points at {status.get('worktree')}"
    if status.get("branch") != f"lacuna-{name}":
        return False, f"its record's branch is {status.get('branch')}"
    return True, "the workshop made it for Lacuna"


def classify(row: dict, stale_days: float = 7) -> tuple[str, str]:
    """remove · keep · owner — and the one line that says why. Only an own, done, safe worktree is ever `remove`."""
    if not row.get("own"):
        return "owner", f"not Lacuna's to remove ({row.get('why_own') or 'no record'})"
    if row.get("live"):
        return "keep", f"a worker is on it ({row['live']})"
    if row.get("clean") is not True:
        return "keep", "it holds uncommitted work" if row.get("clean") is False else "its tree could not be read"
    if row.get("passed") and not row.get("merged"):
        return "keep", "a passing check waits on the owner's merge"
    if row.get("merged"):
        return "remove", f"merged ({row['merged']})"
    if row.get("finished"):
        return "remove", f"retired: every worker that named it has ended ({row['finished']})"
    days = row.get("days")
    if days is not None and days > stale_days:
        return "remove", f"retired: nothing touched it for {days:.0f} days"
    return "keep", f"in use: last touched {days if days is not None else '?'} days ago"


def plan(rows: list[dict], stale_days: float = 7) -> dict:
    out = {"remove": [], "keep": [], "owner": []}
    for r in rows:
        verdict, why = classify(r, stale_days)
        out[verdict].append({**r, "verdict": verdict, "why": why})
    return out


def jobs_by_task(jobs_dir: str) -> dict[str, list[dict]]:
    """task → the workers that named it (their report's task, or the task they were briefed with), with their state."""
    out: dict[str, list[dict]] = {}
    try:
        names = sorted(os.listdir(jobs_dir))
    except OSError:
        return out
    for n in names:
        if not n.startswith("w-"):
            continue
        d = os.path.join(jobs_dir, n)
        try:
            st = json.load(open(f"{d}/state.json"))
        except (OSError, ValueError):
            st = {}
        tasks = set()
        try:
            rep = json.load(open(f"{d}/report.json"))
            if rep.get("task"):
                tasks.add(str(rep["task"]))
        except (OSError, ValueError):
            pass
        try:
            first = json.loads(open(f"{d}/mailbox.jsonl").readline())
            t = ((first.get("job") or {}).get("inputs") or {}).get("task")
            if t:
                tasks.add(str(t))
        except (OSError, ValueError):
            pass
        try:
            job = json.load(open(f"{d}/job.json"))
        except (OSError, ValueError):
            job = {}
        state = st.get("state") or "spawned"
        if state == "crashed" and job.get("state") != "failed":
            state = "executing"                          # a crash the runner will retry is still someone's work
        for t in tasks:
            out.setdefault(t, []).append({"id": n, "state": state, "at": st.get("at") or 0})
    return out


# ── the reads (through the broker and git, read only) ──────────────────────────────────────────────────────────────
def status_of(name: str) -> dict | None:
    if not TASK_RX.match(name):
        return None
    _, out = sh([f"{TOOLS}/box", "work", "status", name], timeout=120)
    try:
        st = json.loads(out)
        return st if isinstance(st, dict) else None
    except ValueError:
        return None


def merged_where(name: str, status: dict) -> str | None:
    """Recorded merged, or every commit of the task (its Lacuna-Task trailer) reachable from dev or lacuna."""
    if status.get("merged"):
        return f"into dev {status['merged']}"
    branch = f"lacuna-{name}"
    _, shas = sh(["git", "-C", REPO, "log", "-n", "50", "--format=%H", f"--grep=^Lacuna-Task: {name}$", branch], timeout=120)
    shas = [s for s in shas.split() if re.fullmatch(r"[0-9a-f]{40}", s)]
    if not shas:
        return None                                       # a task that never committed has nothing merged
    for base in ("dev", "lacuna"):
        if all(sh(["git", "-C", REPO, "merge-base", "--is-ancestor", s, base], timeout=60)[0] == 0 for s in shas):
            return f"its {len(shas)} commit(s) are in {base}"
    return None


def clean_of(path: str) -> bool | None:
    code, out = sh(["git", "-C", path, "status", "--porcelain"], timeout=300)
    if code != 0:
        return None
    lines = [l for l in out.splitlines() if l.strip() and not l.startswith("warning")]
    left = [l for l in lines if not l[3:].strip().startswith(("curator-web/node_modules", "scratch/"))]
    return not left


def last_touched(path: str, name: str, workers: list[dict]) -> float:
    ts = []
    for p in (path, os.path.join(path, ".git")):
        try:
            ts.append(os.lstat(p).st_mtime)
        except OSError:
            pass
    _, ct = sh(["git", "-C", REPO, "log", "-1", "--format=%ct", f"--grep=^Lacuna-Task: {name}$", f"lacuna-{name}"], timeout=60)
    if ct.strip().isdigit():
        ts.append(float(ct.strip()))
    ts += [float(w["at"]) for w in workers if w.get("at")]
    return max(ts) if ts else 0.0


def row_for(path: str, by_task: dict, now: float) -> dict:
    name = os.path.basename(path)
    status = status_of(name) if TASK_RX.match(name) else None
    own, why_own = is_own(path, status)
    row = {"name": name, "path": path, "own": own, "why_own": why_own, "kb": du_kb(path)}
    if not own:
        return row
    workers = by_task.get(name) or []
    live = [w["id"] for w in workers if w["state"] in LIVE]
    row["live"] = ", ".join(live) if live else None
    row["clean"] = clean_of(path)
    row["passed"] = bool(status.get("passed"))
    row["merged"] = merged_where(name, status)
    row["finished"] = (f"{len(workers)} worker(s): " + ", ".join(w["id"] for w in workers[-3:])
                       if workers and not live else None)
    row["days"] = round((now - last_touched(path, name, workers)) / 86400, 1)
    return row


def inventory(by_task: dict, now: float, root: str | None = None) -> list[dict]:
    root = root or ROOT
    try:
        names = sorted(os.listdir(root))
    except OSError:
        return []
    return [row_for(os.path.join(root, n), by_task, now) for n in names if not n.startswith(".")]


def scratch() -> list[dict]:
    rows = [{"path": p, "kb": du_kb(p)} for p in SCRATCH if os.path.isdir(p)]
    try:
        runs = [os.path.join(RUNS, f) for f in os.listdir(RUNS) if f.startswith("runs-lacuna-")]
        rows.append({"path": f"{RUNS}/runs-lacuna-* ({len(runs)} files, in the curator repo: the owner's to clear)",
                     "kb": sum(os.path.getsize(f) for f in runs) // 1024})
    except OSError:
        pass
    return rows


def mb(kb: int) -> str:
    return f"{kb / 1024:,.0f} MB" if kb < 1024 * 1024 else f"{kb / 1024 / 1024:,.1f} GB"


def run(w):
    dry = str(w.inputs.get("dry", "")).lower() in ("1", "true", "yes")
    stale = float(w.inputs.get("stale_days", 7))
    w.skills = ["sre-box", "mac-house"]
    w.progress("reading who made each worktree (the workshop's records) and which workers named them")
    by_task = jobs_by_task(os.environ.get("LACUNA_JOBS", f"{WORLD}/jobs"))
    rows = inventory(by_task, time.time())
    p = plan(rows, stale)
    w.progress(f"{len(rows)} worktree folder(s): {len(p['remove'])} to remove, {len(p['keep'])} kept, "
               f"{len(p['owner'])} not Lacuna's (listed for the owner)")
    freed, removed, failed = 0, [], []
    for r in p["remove"]:
        if dry or w.over():
            break
        # proved again at the moment of removal: a record that changed since the inventory stops it
        st = status_of(r["name"])
        own, why = is_own(r["path"], st)
        if not own:
            failed.append(f"{r['name']}: no longer provably Lacuna's ({why})")
            continue
        _, out = sh([f"{TOOLS}/box", "work", "drop", r["name"]], timeout=600)
        if os.path.exists(r["path"]):
            failed.append(f"{r['name']}: still there after the drop — {out.strip()[-160:]}")
            continue
        freed += r["kb"]
        removed.append({"name": r["name"], "kb": r["kb"], "why": r["why"], "branch": f"lacuna-{r['name']}"})
        w.progress(f"removed {r['name']} ({mb(r['kb'])}) — {r['why']}; branch lacuna-{r['name']} kept")
        w.touched.append(r["path"])
    mine = scratch()
    said = ((f"would remove {len(p['remove'])} worktree(s), {mb(sum(r['kb'] for r in p['remove']))}" if dry else
             f"removed {len(removed)} of its own worktree(s), freed {mb(freed)} ({freed * 1024:,} bytes)")
            + f"; kept {len(p['keep'])}; {len(p['owner'])} folder(s) are not Lacuna's and wait for the owner"
            + (f"; {len(failed)} stopped: {failed[0]}" if failed else "") + "; no branch was deleted")
    return {"ok": not failed, "said": said, "freed_bytes": freed * 1024, "dry": dry,
            "removed": removed,
            "kept": [{"name": r["name"], "kb": r["kb"], "why": r["why"]} for r in p["keep"]],
            "for_the_owner": [{"path": r["path"], "kb": r["kb"], "why": r["why"]} for r in p["owner"]]
                             + [{"path": s["path"], "kb": s["kb"], "why": "Lacuna's own scratch — listed, never removed by this worker"}
                                for s in mine],
            "stopped": failed, "outputs": [],
            "confidence": 0.9, "handoff": {"next": None},
            "anti_taxonomy": ["deleted no branch", "touched nothing it could not prove its own", "removed no file outside a worktree"]}
