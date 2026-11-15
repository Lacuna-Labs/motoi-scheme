"""AN EXAM ITEM'S ATTEMPT (burn-down 1.5 B6; the owner: "the exam doesn't do anything"). A failed item opens what its
worker actually did: the report (verdict before → after, minutes, brain-seconds, the hand-off), each round (its verdict,
what the worker said it fixed), and the DIFF of the last round's program against the cart it started from.

  GET /api/exam/{item}/attempt   read only; nothing outside ~/lacuna-world/jobs and the item's own worktree is opened
"""
from __future__ import annotations

import difflib
import json
import re
import subprocess
from pathlib import Path

from fastapi import APIRouter

router = APIRouter()


def _world() -> Path:
    from .cartview import _world as w
    return w()


def _json(p: Path) -> dict:
    try:
        return json.loads(p.read_text())
    except (OSError, ValueError):
        return {}


def attempt(item: str) -> dict:
    from . import home_cards
    it = next((x for x in home_cards.exam().get("items") or [] if x.get("id") == item), None)
    if not it:
        return {"ok": False, "why": f"no exam item {item}"}
    worker = str(it.get("worker") or "")
    if not re.fullmatch(r"w-[\w-]{1,60}", worker):
        return {"ok": False, "why": f"{item} has not run yet", "item": item}
    job = _world() / "jobs" / worker
    rep = _json(job / "report.json")
    rounds = []
    for p in sorted((job / "rounds").glob("*.json")):
        r = _json(p)
        rounds.append({"n": p.stem, "verdict": r.get("verdict"), "detail": r.get("detail"), "why": (r.get("why") or "")[:300]})
    diff, file = "", None
    lasts = sorted((job / "rounds").glob("*.sks"))
    touched = (rep.get("touched") or [None])[0]
    task = str(rep.get("task") or "")
    if lasts and touched and re.fullmatch(r"[\w.-]{1,80}", task):
        wt = _world() / "worktrees" / task
        before = subprocess.run(["git", "-C", str(wt), "show", f"HEAD:{touched}"], capture_output=True, text=True, timeout=10).stdout
        after = lasts[-1].read_text(errors="replace")
        diff = "".join(difflib.unified_diff(before.splitlines(True), after.splitlines(True), "before", f"round {lasts[-1].stem}", n=2))[:12000]
        file = touched
    return {"ok": True, "item": item, "title": it.get("title"), "state": it.get("state"), "worker": worker,
            "said": rep.get("said") or it.get("said"), "verdict": rep.get("verdict"), "minutes": rep.get("minutes"),
            "brain_seconds": (rep.get("usage") or {}).get("brain_seconds"), "handoff": rep.get("handoff"),
            "rounds": rounds, "file": file, "diff": diff}


@router.get("/api/exam/{item}/attempt")
def r_attempt(item: str) -> dict:
    try:
        return attempt(item)
    except Exception as e:  # noqa: BLE001 — a read never raises
        return {"ok": False, "why": str(e)}
