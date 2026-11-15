"""The control plane's ground: where things are, who did what, and long jobs that outlive a request.

Lacuna Beta (2026-09-24): one address, 127.0.0.1:1138, for everything the Studio runs. This module holds the three
things every other part leans on — PATHS (the Curator repo, dev's and QA's homes, Lacuna's own), the AUDIT log (every
action, with who asked: alfred · claude · lacuna), and JOBS (a build, a battery run, a test suite: a subprocess with its
own log file, polled by the page).
"""
from __future__ import annotations

import json
import re
import os
import signal
import subprocess
import threading
import time
import uuid
from dataclasses import dataclass, field
from pathlib import Path
from typing import Optional

HOME = Path.home()
LACUNA_HOME = Path(os.environ.get("LACUNA_HOME", HOME / ".lacuna"))
REPO = Path(os.environ.get("LACUNA_CURATOR_REPO", HOME / "code" / "curator"))
ENV_DIR = REPO / "tools" / "env"
# ★ QA RUNS FROM ITS OWN CHECKOUT OF `main` (his go, 2026-09-25). QA and dev used to start from the SAME working tree,
# so an edit on dev changed her server's code under her (QA's code.fresh fired on exactly that). Now QA is a git
# worktree on `main` — it changes only when a package is PROMOTED (fast-forward main, restart QA). Its `.env` and
# `.venv` are symlinks to the dev tree's (secrets live in one place; the venv has no editable install, verified).
QA_TREE = Path(os.environ.get("LACUNA_QA_TREE", HOME / "code" / "curator-qa"))
BATTERY = REPO / "tools" / "battery" / "stage"
RUNS = REPO / "scratch" / "battery" / "runs"

# The two environments — his words: "the dev API" (:5051, ~/.curator-dev) and QA (:5050, ~/.curator — HERS).
ENVS = {
    "dev": {"port": 5051, "home": HOME / ".curator-dev", "label": "dev API"},
    "qa": {"port": 5050, "home": HOME / ".curator", "label": "QA (the customer's server)"},
}

for d in ("logs", "jobs", "builds", "drafts", "work"):
    (LACUNA_HOME / d).mkdir(parents=True, exist_ok=True)

_audit_lock = threading.Lock()


def _audit_file() -> Path:
    """Read at each call, not at import: a test's LACUNA_HOME holds its audit even in a module imported before it was set
    (2026-10-18: forge tests' petitions landed in the live audit.jsonl as alfred's)."""
    return Path(os.environ.get("LACUNA_HOME") or LACUNA_HOME) / "audit.jsonl"


def audit(who: str, action: str, **detail) -> dict:
    """Append one line to ~/.lacuna/audit.jsonl — the record of every act, with who asked for it."""
    row = {"t": time.time(), "who": who or "unknown", "action": action, **detail}
    with _audit_lock:
        _audit_file().parent.mkdir(parents=True, exist_ok=True)
        with open(_audit_file(), "a") as f:
            f.write(json.dumps(row, default=str) + "\n")
    return row


def run(cmd: list[str], timeout: float = 20, cwd: Optional[Path] = None, env: Optional[dict] = None) -> tuple[int, str]:
    """A short command, its exit code and output. Never raises."""
    try:
        p = subprocess.run(cmd, capture_output=True, text=True, timeout=timeout, cwd=str(cwd) if cwd else None,
                           env={**os.environ, **(env or {})})
        return p.returncode, (p.stdout or "") + (p.stderr or "")
    except subprocess.TimeoutExpired:
        return 124, f"timed out after {timeout:.0f} s"
    except Exception as e:
        return 127, f"{e.__class__.__name__}: {e}"


@dataclass
class Job:
    id: str
    kind: str
    title: str
    cmd: list[str]
    who: str
    started: float = field(default_factory=time.time)
    ended: Optional[float] = None
    code: Optional[int] = None
    pid: Optional[int] = None

    @property
    def log(self) -> Path:
        return LACUNA_HOME / "jobs" / f"{self.id}.log"

    def to_dict(self) -> dict:
        return {"id": self.id, "kind": self.kind, "title": self.title, "who": self.who, "started": self.started,
                "ended": self.ended, "code": self.code, "running": self.ended is None, "cmd": " ".join(self.cmd)}


_jobs: dict[str, Job] = {}
_jobs_lock = threading.Lock()


# ★ A JOB OUTLIVES LACUNA (2026-09-24). Jobs lived only in the process, so restarting the console forgot a build that
# was still running. Now each job's meta is on disk (~/.lacuna/jobs/<id>.json) and the command runs under a tiny wrapper
# that writes its own exit code (<id>.code) — so a job that finishes while Lacuna is down still reports how it ended.
def _meta_path(job_id: str) -> Path:
    return LACUNA_HOME / "jobs" / f"{job_id}.json"


def _code_path(job_id: str) -> Path:
    return LACUNA_HOME / "jobs" / f"{job_id}.code"


def _save(job: Job):
    _meta_path(job.id).write_text(json.dumps({"id": job.id, "kind": job.kind, "title": job.title, "cmd": job.cmd, "who": job.who,
                                              "started": job.started, "pid": job.pid}))


def _pid_alive(pid: Optional[int]) -> bool:
    if not pid:
        return False
    try:
        os.kill(pid, 0)
        return True
    except (ProcessLookupError, PermissionError):
        return False


def _settle(job: Job) -> Job:
    """Fill in the end of a job from disk when this process did not see it end."""
    if job.ended is None:
        cp = _code_path(job.id)
        if cp.exists():
            try:
                job.code = int(cp.read_text().strip() or 1)
            except ValueError:
                job.code = 1
            job.ended = cp.stat().st_mtime
        elif not _pid_alive(job.pid):
            job.code, job.ended = -1, time.time()     # gone with no exit code: say so, never "running" for ever
    return job


def start_job(kind: str, title: str, cmd: list[str], who: str, cwd: Optional[Path] = None, env: Optional[dict] = None) -> Job:
    """A long command in the background with its own log; the page follows it by id."""
    job = Job(id=time.strftime("%Y%m%d-%H%M%S-") + uuid.uuid4().hex[:6], kind=kind, title=title, cmd=cmd, who=who)
    with open(job.log, "w") as logf:
        logf.write(f"$ {' '.join(cmd)}\n")
    code_file = str(_code_path(job.id))
    wrapped = ["/bin/bash", "-c", '"$@" >>"$LACUNA_JOB_LOG" 2>&1; c=$?; echo "[exit $c]" >>"$LACUNA_JOB_LOG"; echo $c >"$LACUNA_JOB_CODE"', "job", *cmd]
    proc = subprocess.Popen(wrapped, stdin=subprocess.DEVNULL, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
                            cwd=str(cwd) if cwd else None, start_new_session=True,
                            env={**os.environ, **(env or {}), "LACUNA_JOB_LOG": str(job.log), "LACUNA_JOB_CODE": code_file})
    job.pid = proc.pid
    _save(job)
    with _jobs_lock:
        _jobs[job.id] = job
    audit(who, f"job.start.{kind}", job=job.id, title=title)

    def wait():
        proc.wait()
        _settle(job)
        audit(who, f"job.end.{kind}", job=job.id, code=job.code)
    threading.Thread(target=wait, daemon=True).start()
    return job


def _load_jobs():
    for p in sorted((LACUNA_HOME / "jobs").glob("*.json"))[-200:]:
        try:
            m = json.loads(p.read_text())
        except Exception:
            continue
        if m["id"] in _jobs:
            continue
        _jobs[m["id"]] = _settle(Job(id=m["id"], kind=m["kind"], title=m["title"], cmd=m["cmd"], who=m["who"],
                                     started=m["started"], pid=m.get("pid")))


def jobs(limit: int = 40) -> list[dict]:
    with _jobs_lock:
        _load_jobs()
        return [_settle(j).to_dict() for j in sorted(_jobs.values(), key=lambda j: j.started, reverse=True)[:limit]]


def job(job_id: str) -> Optional[Job]:
    with _jobs_lock:
        _load_jobs()
        j = _jobs.get(job_id)
        return _settle(j) if j else None


JOB_ID = re.compile(r"^\d{8}-\d{6}-[0-9a-f]{6}$")


def job_tail(job_id: str, lines: int = 200) -> str:
    """The last lines of ONE job's log. An absolute path used to reset the join and read any *.log on disk — a
    tool result the model reads carries device-written text, so that was a way to steer it into files (L13,
    2026-09-25). A job id has one shape; anything else reads nothing."""
    if not isinstance(job_id, str) or not JOB_ID.fullmatch(job_id):
        return ""
    j = _jobs.get(job_id)
    p = j.log if j else LACUNA_HOME / "jobs" / f"{job_id}.log"
    if not p.exists():
        return ""
    return "\n".join(p.read_text(errors="replace").splitlines()[-lines:])


def cancel_job(job_id: str, who: str) -> bool:
    j = _jobs.get(job_id)
    if not j or j.ended is not None or not j.pid:
        return False
    try:
        os.killpg(os.getpgid(j.pid), signal.SIGTERM)
    except Exception:
        return False
    audit(who, "job.cancel", job=job_id)
    return True
