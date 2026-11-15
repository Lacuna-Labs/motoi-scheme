"""THE DESK'S READS — small read-only routes for the desk's SRE apps (SRE-APPS "Gaps" 1–6, 2026-10-18).

Every route here is a GET that reads a file (or one dev-API URL) and answers JSON. None of them writes, runs, kills or
restarts anything, and none of them raises: a missing or unreadable file answers {"ok": false, "why": ...} or an empty
list. Paths resolve under LACUNA_HOME (default ~/.lacuna) at call time, so tests point them at a tmp dir.

    /api/minds/logs · /api/minds/logs/{name} · /api/caliper
/api/sentinel, /api/gpu-lease, /api/nightly, /api/jail/audit and /api/slo are the door's (lacuna-node/frontend/sre-reads.mjs,
2026-11-06, finale §3.12); the minds' logs wait for the reads area's live replay (lacuna-node/frontend/reads/minds.mjs).
"""
from __future__ import annotations

import os
from pathlib import Path

from fastapi import APIRouter

router = APIRouter()

LINE_MAX = 400
TAIL_MAX = 500
# the logs that are not one mind's own, and the role each one plays
ROLE_LOGS = {"brain.log": "brain", "brain-gateway.log": "gateway", "ollama.log": "ollama"}


def home() -> Path:
    return Path(os.environ.get("LACUNA_HOME") or Path.home() / ".lacuna")


def logs_dir() -> Path:
    return home() / "logs"


def _stat(p: Path) -> dict | None:
    try:
        st = p.stat()
    except OSError:
        return None
    return {"bytes": st.st_size, "mtime": st.st_mtime}


def tail(p: Path, n: int) -> list[str]:
    """The last n lines of p, read backwards from the end in blocks (a 40 MB log is never read whole). Each line is
    cut to LINE_MAX characters. A missing file is an empty list."""
    n = max(0, min(int(n), TAIL_MAX))
    if n == 0:
        return []
    try:
        with open(p, "rb") as f:
            f.seek(0, os.SEEK_END)
            end = f.tell()
            buf = b""
            pos = end
            while pos > 0 and buf.count(b"\n") <= n:
                step = min(65536, pos)
                pos -= step
                f.seek(pos)
                buf = f.read(step) + buf
    except OSError:
        return []
    lines = buf.decode("utf-8", "replace").splitlines()
    if pos > 0 and lines:
        lines = lines[1:]          # the first line of the block may be cut mid-way
    return [ln[:LINE_MAX] for ln in lines[-n:]]


# ── 1. per-model logs ────────────────────────────────────────────────────────────────────────────────────────────────

def log_files() -> dict[str, tuple[Path, str]]:
    """name → (path, model or role), for mind-*.log and the three role logs that exist."""
    out: dict[str, tuple[Path, str]] = {}
    d = logs_dir()
    try:
        minds = sorted(d.glob("mind-*.log"))
    except OSError:
        minds = []
    for p in minds:
        if p.is_file():
            out[p.name] = (p, p.name[len("mind-"):-len(".log")])
    for name, role in ROLE_LOGS.items():
        p = d / name
        if p.is_file():
            out[name] = (p, role)
    return out


def minds_logs() -> dict:
    rows = []
    for name, (p, model) in log_files().items():
        st = _stat(p)
        if st:
            rows.append({"name": name, "model": model, **st})
    return {"logs": rows}


def minds_log(name: str, n: int = 80) -> dict:
    """The tail of one listed log. The name must be one the listing gives — nothing else is ever opened."""
    files = log_files()
    if name not in files:
        return {"ok": False, "name": name, "why": "not one of the listed logs", "lines": []}
    return {"name": name, "lines": tail(files[name][0], n)}


@router.get("/api/minds/logs")
def r_minds_logs() -> dict:
    try:
        return minds_logs()
    except Exception as e:  # noqa: BLE001 — a read never raises
        return {"logs": [], "ok": False, "why": str(e)}


@router.get("/api/minds/logs/{name}")
def r_minds_log(name: str, n: int = 80) -> dict:
    try:
        return minds_log(name, n)
    except Exception as e:  # noqa: BLE001
        return {"ok": False, "name": name, "why": str(e), "lines": []}


# ── 2. Caliper ───────────────────────────────────────────────────────────────────────────────────────────────────────

@router.get("/api/caliper")
def r_caliper() -> dict:
    try:
        from . import caliper
        return caliper.summary()
    except Exception as e:  # noqa: BLE001
        return {"ok": False, "why": str(e)}
