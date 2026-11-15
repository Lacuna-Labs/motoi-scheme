"""THE ARMS' HANDS (LACUNA-1.3-DESIGN §32) — what a foreman's worker may LOOK at, done by Lacuna on its behalf.

A worker cannot touch the disk (the foreman's sandbox refuses it, by design). It asks for one operation by name —
`(hand 'repos)`, `(hand 'git-status "~/code/curator")` — and Lacuna answers it here, READ ONLY, inside the allowed roots,
and sends the result back as the worker's `hand` event. Anything that would change a repo is an `(ask …)`: a permission
card, the person's yes, and then Lacuna's own tools on its own branch.

    repos                      every git repo one level under ~/code: branch, dirty files, ahead/behind, last commit, size
    git-status PATH            branch, dirty files (first 50), stashes, ahead/behind its upstream
    git-log PATH [N]           the last N commits (≤ 30): sha, date, subject
    branches PATH              local branches: last commit date, merged into dev/main or not
    disk-usage PATH            the biggest children (≤ 25), sizes in MB
    files PATH GLOB            matching files (≤ 200), sizes
    tail-log SOURCE [N]        the last N lines (≤ 2,000) of one of our own logs, by name: dev-api, vite, foreman, jobs,
                               brain, brain-gateway, l2-daemon-dev, loam-dev (never QA's or the customer's)
    read-zst PATH [N] [SKIP]   N lines (≤ 500) of a zstd-packed file, after SKIP lines — our corpora are kept as .zst
    battery-last               the latest True State battery run: its verdict (acts green/red), its reds, its shots
    battery-status RUN         one run by its id (the folder's stamp): running or done; reds and shots when done
    codemap NAME               the CODEMAP.md of a package by its folder name (dev's, or the newest on a Lacuna branch)

Starting the battery is not a hand (hands only look): it is the petition `run-battery`, the owner's yes.
"""
from __future__ import annotations

import fnmatch
import json
import os
import re
import subprocess
import time
from pathlib import Path

HOME = Path.home()
ROOTS = [HOME / "code", HOME / "lacuna-world"]
CORPORA = [HOME / "motoi-corpus", HOME / ".forge", HOME / "fold-snapshots"]   # read-zst only: the packed training text
SKIP = {"node_modules", ".venv", "venv", "__pycache__", ".git", "dist", "target", ".next", "build"}


def _path(p: str) -> Path:
    """Inside an allowed root, symlinks resolved, or a refusal."""
    q = Path(os.path.expanduser(str(p or ""))).resolve()
    if not any(q == r or r in q.parents for r in ROOTS):
        raise PermissionError(f"{p} is outside what a worker may look at (~/code, ~/lacuna-world)")
    if not q.exists():
        raise FileNotFoundError(f"{p} does not exist")
    return q


def _git(repo: Path, *args: str, timeout: int = 20) -> str:
    r = subprocess.run(["git", "-C", str(repo), *args], capture_output=True, text=True, timeout=timeout)
    return r.stdout.rstrip() if args[:1] == ("status",) else r.stdout.strip()   # porcelain's first column is meaningful


def _du_mb(p: Path, timeout: int = 60) -> float:
    r = subprocess.run(["du", "-sk", str(p)], capture_output=True, text=True, timeout=timeout)
    try:
        return round(int(r.stdout.split()[0]) / 1024, 1)
    except (ValueError, IndexError):
        return 0.0


def git_status(path: str) -> dict:
    repo = _path(path)
    dirty = [l for l in _git(repo, "status", "--porcelain").splitlines() if l.strip()]
    ab = _git(repo, "rev-list", "--left-right", "--count", "@{upstream}...HEAD")
    behind, ahead = (ab.split() + ["?", "?"])[:2] if ab else ("—", "—")
    return {"repo": str(repo), "branch": _git(repo, "branch", "--show-current"), "dirty": len(dirty), "dirty_files": dirty[:50],
            "stashes": len([l for l in _git(repo, "stash", "list").splitlines() if l]), "ahead": ahead, "behind": behind}


def repos() -> list[dict]:
    out = []
    for d in sorted((HOME / "code").iterdir()):
        if not (d / ".git").exists() or d.is_symlink():
            continue
        try:
            s = git_status(str(d))
            last = _git(d, "log", "-1", "--format=%ct|%s")
            t, _, subj = last.partition("|")
            out.append({"name": d.name, "branch": s["branch"], "dirty": s["dirty"], "ahead": s["ahead"], "behind": s["behind"],
                        "stashes": s["stashes"], "last_commit_days": round((time.time() - int(t or 0)) / 86400, 1) if t else None,
                        "last_subject": subj[:80]})
        except (subprocess.SubprocessError, OSError, ValueError) as e:
            out.append({"name": d.name, "error": e.__class__.__name__})
    return out


def git_log(path: str, n: int = 10) -> list[dict]:
    repo = _path(path)
    rows = _git(repo, "log", f"-{max(1, min(30, int(n)))}", "--format=%h|%cs|%s").splitlines()
    return [dict(zip(("sha", "date", "subject"), r.split("|", 2))) for r in rows]


def branches(path: str) -> list[dict]:
    repo = _path(path)
    merged = set()
    for base in ("dev", "main"):
        merged |= {b.strip(" *+") for b in _git(repo, "branch", "--merged", base).splitlines()}
    rows = _git(repo, "for-each-ref", "--sort=-committerdate", "--format=%(refname:short)|%(committerdate:unix)", "refs/heads").splitlines()
    out = []
    for r in rows[:200]:
        name, _, t = r.partition("|")
        out.append({"branch": name, "days": round((time.time() - int(t or 0)) / 86400, 1), "merged": name in merged})
    return out


def disk_usage(path: str) -> list[dict]:
    root = _path(path)
    kids = [c for c in root.iterdir() if not c.is_symlink()][:400]
    sized = sorted(({"path": str(c), "mb": _du_mb(c)} for c in kids), key=lambda x: -x["mb"])
    return sized[:25]


def files(path: str, glob: str = "*") -> list[dict]:
    root = _path(path)
    out = []
    for dirpath, dirnames, filenames in os.walk(root):
        dirnames[:] = [d for d in dirnames if d not in SKIP]
        for f in filenames:
            if fnmatch.fnmatch(f, glob):
                p = Path(dirpath) / f
                try:
                    out.append({"path": str(p), "kb": round(p.stat().st_size / 1024, 1)})
                except OSError:
                    continue
                if len(out) >= 200:
                    return out
    return out


LOGS = {n: HOME / ".lacuna" / "logs" / f"{n}.log"
        for n in ("dev-api", "vite", "foreman", "jobs", "brain", "brain-gateway", "l2-daemon-dev", "loam-dev")}


def tail_log(source: str, n: int = 200) -> dict:
    """A log by NAME, never by path: a worker reading the outside world (the log-watch cart) gets lines as data, and the
    names keep it to our own dev side — QA's and the customer's logs are not on the list."""
    p = LOGS.get(str(source))
    if not p:
        raise ValueError(f"no log '{source}' — a worker may read: {', '.join(LOGS)}")
    if not p.exists():
        raise FileNotFoundError(f"the {source} log has not been written yet")
    r = subprocess.run(["tail", "-n", str(max(1, min(2000, int(n)))), str(p)], capture_output=True, text=True, timeout=20)
    return {"source": source, "lines": [l[:500] for l in r.stdout.splitlines() if l.strip()]}


def read_zst(path: str, n: int = 50, skip: int = 0) -> dict:
    """zstd is our format for text at rest (the owner, 2026-10-18), so a packed corpus is still readable: streamed, never
    unpacked to disk, and only the lines asked for."""
    p = Path(os.path.expanduser(str(path or ""))).resolve()
    if not any(r in p.parents for r in ROOTS + CORPORA):
        raise PermissionError(f"{path} is outside what a worker may read (~/code, ~/lacuna-world, the corpora)")
    if not p.exists():
        raise FileNotFoundError(f"{path} does not exist")
    if p.suffix != ".zst":
        raise ValueError(f"{path} is not a .zst file")
    n, skip = max(1, min(500, int(n))), max(0, int(skip))
    z = subprocess.Popen(["zstd", "-dc", "--long=27", str(p)], stdout=subprocess.PIPE, stderr=subprocess.DEVNULL, text=True)
    lines = []
    try:
        for i, line in enumerate(z.stdout):
            if i >= skip:
                lines.append(line.rstrip("\n")[:2000])
            if len(lines) >= n:
                break
    finally:
        z.kill()
    return {"path": str(p), "skip": skip, "lines": lines}


# ── THE TRUE STATE BATTERY, read (§38 morning-triage's hands; tools/battery/true-state.sh writes the runs) ────────────
TRUE_STATE = HOME / "code" / "curator" / "scratch" / "battery" / "true-state"
STARTED = Path(os.environ.get("LACUNA_HOME") or HOME / ".lacuna") / "battery-true-state.jsonl"      # battery.start_true_state's record: run → pid, log
RUN_ID = re.compile(r"^\d{8}-\d{6}$")


def _reds(run: Path) -> list[str]:
    """The run's reds in its report's own words (the '## What went red' bullets), or the acts the verdict calls red."""
    try:
        text = (run / "report.md").read_text(errors="replace")
        part = text.split("## What went red", 1)[1].split("\n## ", 1)[0]
        reds = [re.sub(r"\*\*", "", l[2:]).strip() for l in part.splitlines() if l.startswith("- ")]
        if reds:
            return reds[:200]
    except (OSError, IndexError):
        pass
    v = _verdict(run) or {}
    return [f"{a} — red" for a, c in (v.get("acts") or {}).items() if c == "red"]


def _verdict(run: Path) -> dict | None:
    try:
        return json.loads((run / "verdict.json").read_text())
    except (OSError, ValueError):
        return None


def _started(run_id: str) -> dict:
    try:
        rows = [json.loads(l) for l in STARTED.read_text().splitlines() if l.strip()]
    except (OSError, ValueError):
        return {}
    return next((r for r in reversed(rows) if r.get("run") == run_id), {})


def _alive(pid) -> bool:
    try:
        os.kill(int(pid), 0)
        return True
    except (OSError, TypeError, ValueError):
        return False


def _run_view(run: Path) -> dict:
    v = _verdict(run)
    shots = sorted(str(p) for p in (run / "shots").glob("*.png")) if (run / "shots").is_dir() else []
    out = {"run": run.name, "path": str(run), "done": v is not None}
    if v is None:
        rec = _started(run.name)
        quiet = time.time() - max((p.stat().st_mtime for p in run.iterdir()), default=run.stat().st_mtime)
        out["running"] = _alive(rec.get("pid")) if rec.get("pid") else quiet < 600
        out["note"] = ("running" if out["running"] else "stopped without a verdict") + f"; last write {int(quiet)} s ago"
        if rec.get("log"):
            out["log"] = rec["log"]
        out["shots_so_far"] = len(shots)
        return out
    out.update({"pass": bool(v.get("pass")), "acts": v.get("acts") or {}, "reds": _reds(run),
                "report": str(run / "report.md") if (run / "report.md").exists() else None,
                "shots": shots[:200], "shot_count": len(shots)})
    return out


def battery_last() -> dict:
    """The newest True State run that has a verdict (a run still going is named beside it)."""
    runs = sorted((p for p in TRUE_STATE.iterdir() if p.is_dir() and RUN_ID.match(p.name)), reverse=True) if TRUE_STATE.is_dir() else []
    if not runs:
        raise FileNotFoundError("no True State battery run yet (scratch/battery/true-state is empty)")
    done = next((r for r in runs if _verdict(r) is not None), None)
    out = _run_view(done) if done else {"run": None, "done": False}
    if runs[0] != done:
        out["newer"] = _run_view(runs[0])
    return out


def battery_status(run_id: str) -> dict:
    if not RUN_ID.match(str(run_id or "")):
        raise ValueError(f"a run id is the folder's stamp, like 20261018-030729 — not {run_id!r}")
    run = TRUE_STATE / run_id
    if not run.is_dir():
        raise FileNotFoundError(f"no True State run {run_id}")
    return _run_view(run)


def codemap(name: str) -> dict:
    """A package's CODEMAP.md by its folder's name: dev's tree first, then the newest Lacuna worktree that has one."""
    name = str(name or "").strip().strip("/")
    if not re.fullmatch(r"[A-Za-z0-9_.-]+(/[A-Za-z0-9_.-]+)*", name):
        raise ValueError("name a package folder, like stores or curator_api/stores")
    found = []
    for root in [HOME / "code" / "curator"] + sorted((HOME / "lacuna-world" / "worktrees").glob("codemap-*"),
                                                      key=lambda p: p.stat().st_mtime, reverse=True):
        r = subprocess.run(["git", "-C", str(root), "ls-files", "--", "*CODEMAP.md"], capture_output=True, text=True, timeout=20)
        hits = [l for l in r.stdout.splitlines() if l.endswith(f"{name}/CODEMAP.md") or l == f"{name}/CODEMAP.md"]
        if root.name != "curator":                       # a worktree's map may not be committed yet: look on disk too
            hits += [str(p.relative_to(root)) for p in root.glob(f"**/{name}/CODEMAP.md") if "node_modules" not in p.parts]
        found += [(root, h) for h in dict.fromkeys(hits)]
        if found:
            break
    if not found:
        raise FileNotFoundError(f"no CODEMAP.md for {name} on dev or on a Lacuna branch yet")
    root, rel = found[0]
    text = (root / rel).read_text(errors="replace")
    return {"name": name, "path": str(root / rel), "where": "dev" if root.name == "curator" else f"lacuna-{root.name} (not merged)",
            "text": text[:20000], "cut": len(text) > 20000}


def job(job_id: str = "") -> dict:
    """One job's state and its last lines — how a cart follows an act it started (acts.py)."""
    from .core import job as _job, job_tail
    j = _job(str(job_id))
    if not j:
        raise ValueError(f"no job {job_id}")
    d = j.to_dict()
    return {"id": d.get("id"), "kind": d.get("kind"), "running": d.get("running"), "ok": d.get("ok"), "code": d.get("code"),
            "lines": job_tail(str(job_id), 40).splitlines()[-40:]}


def _graph(*argv):
    """Lacuna's graph cortex (the Rust store, through the broker): its own reads, answered as data"""
    from . import lacuna_cortex
    r = lacuna_cortex._call([str(a) for a in argv], timeout=8)
    if isinstance(r, dict) and r.get("text") is not None and "ok" in r and len(r) == 2:
        return {"lines": [ln[2:] for ln in r["text"].splitlines() if ln.startswith("- ")]}
    if isinstance(r, dict) and r.get("ok") is False:
        raise ValueError(str(r.get("error") or r.get("why"))[:300])
    return r


def port(n: str = "") -> dict:
    """a TCP port on this Mac: is something listening, which program (the Factory's "read this port")"""
    if not str(n).isdigit() or not 0 < int(n) < 65536:
        raise ValueError("a port is a number, 1–65535")
    out = subprocess.run(["lsof", "-nP", f"-iTCP:{int(n)}", "-sTCP:LISTEN"], capture_output=True, text=True, timeout=10).stdout.splitlines()[1:]
    rows = [{"program": ln.split()[0], "pid": ln.split()[1], "address": ln.split()[8]} for ln in out if len(ln.split()) >= 9]
    return {"port": int(n), "listening": bool(rows), "by": rows[:4]}


def knn(mind: str = "", *words):
    """THE VOTE (forge/knn.py, PLAYBOOK F9): a label by the nearest labeled pairs, EmbeddingGemma's classification view —
    no trained model; Herald holds 95.7% this way. Answers {label, confidence}."""
    import subprocess
    if not re.fullmatch(r"[a-z0-9-]{1,40}", mind or ""):
        raise ValueError("name the mind, like inbox-route")
    forge = Path.home() / "lacuna-world" / "forge"
    p = subprocess.run([str(forge / ".venv" / "bin" / "python"), str(forge / "knn.py"), "vote", mind, " ".join(words)[:1500]],
                       capture_output=True, text=True, timeout=60, cwd=str(forge))
    try:
        out = json.loads(p.stdout.strip().splitlines()[-1])
    except (ValueError, IndexError) as e:
        raise ValueError(f"the vote did not answer: {(p.stderr or p.stdout)[-200:]}") from e
    return {"mind": mind, "label": str(out["label"]), "confidence": round(float(out["confidence"]), 3)}


def memory(*words):            return _graph("recall", *" ".join(words).split(), "--k", "8")
def pointing_at(node):         return _graph("pointing-at", node)
def like(node, k="6"):         return _graph("like", node, k)
def since(when="6h"):          return _graph("since", when)
def fading(half_life_h="24"):  return _graph("fading", half_life_h)
def trail(node):               return _graph("trail", node)


def find(name: str = "", limit: str | int = 30) -> dict:
    """Every tracked file whose path holds NAME (case-insensitive), as full paths: the repos under ~/code by `git ls-files`
    and ~/lacuna-world by a walk. The brain guessed paths ("shopkeeper/judge/signals.py") and had no way to look one up
    (2026-10-19); this is the look-up. Read only."""
    import subprocess
    needle = str(name or "").strip().lower()
    if len(needle) < 3:
        return {"ok": False, "why": "find needs at least 3 characters of a file name"}
    out: list[str] = []
    code = Path.home() / "code"
    for repo in sorted(p for p in code.iterdir() if (p / ".git").exists()):
        try:
            ls = subprocess.run(["git", "-C", str(repo), "ls-files"], capture_output=True, text=True, timeout=20).stdout.splitlines()
        except Exception:  # noqa: BLE001
            continue
        out += [str(repo / f) for f in ls if needle in f.lower()]
    world = Path.home() / "lacuna-world"
    for dirpath, dirnames, filenames in os.walk(world):
        dirnames[:] = [d for d in dirnames if d not in SKIP and d != "worktrees" and not d.startswith(".")]   # old checkouts mislead
        out += [str(Path(dirpath) / f) for f in filenames if needle in str(Path(dirpath) / f).lower()]
    n = int(limit or 30)
    return {"ok": True, "found": len(out), "paths": out[:n], **({"more": len(out) - n} if len(out) > n else {})}


OPS = {"find": find, "job": job, "port": port, "knn": knn, "memory": memory, "pointing-at": pointing_at, "like": like, "since": since, "fading": fading, "trail": trail, "repos": lambda *a: repos(), "git-status": git_status, "git-log": git_log, "branches": branches,
       "disk-usage": disk_usage, "files": files,
       "tail-log": tail_log, "read-zst": read_zst,
       "battery-last": lambda *a: battery_last(), "battery-status": battery_status, "codemap": codemap,
       "release-sort": lambda *a: __import__("lacuna_api.control.release_steps", fromlist=["sort"]).sort(),
       "cart-record": lambda name="", *a: __import__("lacuna_api.control.graphctx", fromlist=["cart_record"]).cart_record(name),
       "outline": lambda path="", *a: __import__("lacuna_api.control.graphctx", fromlist=["outline"]).outline(path)}


def do(op: str, args: list) -> dict:
    """C19: every hand call is timed (cart_reads.note_hand), so the slowest verbs are named from what really ran"""
    from . import cart_reads
    t0 = time.time()
    out = _do(op, args)
    cart_reads.note_hand(str(op), time.time() - t0, bool(out.get("ok")))
    return out


def _do(op: str, args: list) -> dict:
    from . import hands_api, cart_reads        # the box's verbs read through Lacuna's own API (hands_api.OPS)
    if str(op) in cart_reads.OPS and str(op) not in OPS:
        try:
            return {"ok": True, "result": cart_reads.OPS[str(op)](*[str(a) for a in (args or [])][:2])}
        except (ValueError, OSError, TypeError) as e:
            return {"ok": False, "why": str(e)[:300]}
    if str(op) in hands_api.OPS and str(op) not in OPS:
        try:
            return {"ok": True, "result": hands_api.do(str(op), [str(a) for a in (args or [])][:3])}
        except (ValueError, OSError) as e:
            return {"ok": False, "why": str(e)[:300]}
    fn = OPS.get(str(op))
    if not fn:
        return {"ok": False, "why": f"no hand '{op}' — a worker may use: {', '.join(OPS)}"}
    try:
        return {"ok": True, "result": fn(*[str(a) for a in (args or [])][:3])}
    except (PermissionError, FileNotFoundError, ValueError, TypeError) as e:
        return {"ok": False, "why": str(e)[:300]}
    except subprocess.TimeoutExpired:
        return {"ok": False, "why": "it took too long"}
