"""TURNS — heavy jobs take turns (the owner, 2026-10-18: memory is this box's real ceiling; the swap filled three times
the night training, the calibration matrix, the battery and the exam all wanted the box at once).

A job that says `"heavy": true` in its job.json runs only while it holds the one heavy lane (a named lease, so a crashed
holder's turn expires by itself), and only when the box has the memory it says it needs (`"needs_gb": 4`). Otherwise
it waits, and says in one line whose turn it is or how much memory is missing. Light jobs never wait here.
"""
from __future__ import annotations

import subprocess

import lease

LANE = "heavy"
AVAILABLE_FLOOR_GB = 2.0          # what a heavy job may never take the box below, on top of its own needs


def available_gb() -> float:
    """Free + inactive + speculative pages: what macOS can hand out without swapping. Same reading as Lacuna's metric."""
    try:
        out = subprocess.run(["vm_stat"], capture_output=True, text=True, timeout=10).stdout
    except (OSError, subprocess.SubprocessError):
        return 0.0
    page = 16384
    pages = {}
    for line in out.splitlines():
        if "page size of" in line:
            page = int(line.split("page size of")[1].split()[0])
        elif ":" in line:
            k, v = line.split(":", 1)
            try:
                pages[k.strip()] = int(v.strip().rstrip("."))
            except ValueError:
                pass
    free = sum(pages.get(k, 0) for k in ("Pages free", "Pages inactive", "Pages speculative"))
    return round(free * page / 2**30, 1)


def may_start(job: dict, memory=available_gb) -> tuple[bool, str]:
    """(True, "") when this job may start now; else (False, the one line that says why it waits)."""
    if not job.get("heavy"):
        return True, ""
    need = float(job.get("needs_gb") or 0) + AVAILABLE_FLOOR_GB
    have = memory()
    if have < need:
        return False, f"waits its turn: needs {need:.1f} GB free, the box has {have:.1f} GB"
    said = lease.take_on(LANE, job["name"], span=str(job.get("max_run") or "3h"), why=str(job.get("goal") or "")[:120])
    if said.startswith("no:"):
        return False, "waits its turn: " + said[4:].strip()
    return True, ""


def done(job: dict) -> None:
    """A heavy job that stopped running gives its turn back (a no-op for light jobs and for a lane it does not hold)."""
    if job.get("heavy"):
        held = lease.held(LANE)
        if held and held.get("holder") == job["name"]:
            lease.release_on(LANE, job["name"])
