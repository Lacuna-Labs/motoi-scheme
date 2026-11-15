"""SELF-AUDIT — the errand runner checks ITSELF, by arithmetic, every tick (2026-10-11).

Why: the poster bake ran 8 hours without one check-in. The scheduler had a bug (its clock restarted with every run of a
repeating errand) and nothing noticed, because the only witness was the thing that was broken. The owner: "is it smart
enough to know it was doing that? Can we make it introspective?"

So this module never asks the scheduler whether it did its job. It reads what the runner RECORDED (.runner.json) and
compares it with what the errand PROMISED (job.json), using a looser rule than the scheduler's — twice the interval
plus two minutes. A finding means the machinery itself is off, not the work. The runner writes each finding into the
errand's notes once, pushes once per 12 hours, notes when it clears, and hands the findings to the check-in model so it
can talk about its own machinery. Standard library only; no side effects here — the runner acts on what this returns.
"""
from __future__ import annotations

from typing import Callable

GRACE = 120          # seconds of slack on top of twice the interval — a slow tick is not a finding


def _ago(s: float) -> str:
    s = int(s)
    return f"{s // 60} min" if s < 5400 else f"{s / 3600:.1f} h"


def audit(job: dict, rs: dict, now: float, seconds: Callable[[str | None], int | None],
          when: Callable[[str | None], float | None]) -> dict[str, str]:
    """{finding key: plain words} for one errand. Empty when its machinery is keeping its promises."""
    found: dict[str, str] = {}
    if job.get("state", "on") != "on":
        return found

    if job.get("kind") == "remind":
        at = when(job.get("at"))
        if at and now > at + 600:
            found["reminder-late"] = f"a reminder due {_ago(now - at)} ago never went out"
        return found

    runs = rs.get("runs", 0)
    # anchor on what the scheduler cannot move: the errand's creation time (job.json), or its first run if earlier
    anchors = [t for t in (rs.get("first_started"), when(job.get("created"))) if t]
    first = min(anchors) if anchors else rs.get("started")
    start_at = when(job.get("at"))
    if not runs:
        # promised to start (now, or at its time) but the runner never started it
        due = start_at or when(job.get("created"))
        if due and now - due > 2 * 60 + GRACE:
            found["never-started"] = f"I was set {_ago(now - due)} ago and have never been started"
        return found

    check = seconds(job.get("checkin", "15m"))
    if check:
        since = now - (rs.get("last_checkin") or first or now)
        if since > 2 * check + GRACE:
            found["checkin-late"] = (f"my check-ins are late — promised every {job.get('checkin', '15m')}, "
                                     f"the last was {_ago(since)} ago" if rs.get("last_checkin") else
                                     f"I have never checked in, though I promised every {job.get('checkin', '15m')} "
                                     f"and have been going {_ago(since)}")

    every = seconds(job.get("every"))
    running = bool(rs.get("pid"))
    if every and not running and rs.get("started") and now >= rs.get("not_before", 0):
        since = now - rs["started"]
        if since > 2 * every + GRACE:
            found["run-late"] = f"I promised to run every {job['every']}, and the last run started {_ago(since)} ago"

    if rs.get("interrupted", 0) >= 3:
        found["interrupted-often"] = f"I have been interrupted {rs['interrupted']} times — something keeps stopping me"

    if running and rs.get("started"):
        limit = seconds(job.get("max_run")) or 24 * 3600
        if now - rs["started"] > limit + 2 * 60 + GRACE:
            found["overran"] = f"this run is {_ago(now - rs['started'])} old, past its {job.get('max_run') or '24h'} limit"
    return found


def runner_audit(heartbeat: dict, now: float) -> str:
    """Words for a stale runner, read by anyone who looks (errands, the House screen, the phone strip)."""
    tick = heartbeat.get("tick")
    if not tick:
        return "the errand runner has never ticked"
    if now - tick > 180:
        return f"the errand runner last ticked {_ago(now - tick)} ago — nothing is being kept going"
    return ""
