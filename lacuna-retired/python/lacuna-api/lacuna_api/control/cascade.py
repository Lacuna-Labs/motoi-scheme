"""THE CASCADE, from Lacuna's side (LACUNA-1.3-DESIGN §40, B50): what the foreman's ladders leave behind.

The foreman climbs (lacuna-foreman/cascade.mjs); its sandbox writes only its own folder, so the records come up here
(POST /api/foreman/cascade) and Lacuna keeps them:

  ~/lacuna-world/cascade/escalations.jsonl   one line per job that climbed: its input slice, each rung's answer,
                                             certainty, ms and why it climbed, the accepting rung and its answer; a
                                             26B answer that held is flagged `candidate_pair`
  ~/lacuna-world/cascade/shadow.jsonl        shadow mode (the calibration pass): one line per rung per job, right or
                                             wrong against the 26B, ms, certainty, and the box's readings at that step

`box_now()` is the box's reading for a shadow step (available memory, swap used, load, whether the person's slot was
free), from Lacuna's own readers. `lacuna cascade report` (GET /api/cascade/report) is the door's: per job × model, n,
accuracy against the 26B, mean ms, mean certainty, a suggested threshold, and the memory and swap seen
(lacuna-node/frontend/cascade-report.mjs, 2026-11-06, finale §3.12).
"""
from __future__ import annotations

import json
import os
import threading
from pathlib import Path

DIR = Path.home() / "lacuna-world" / "cascade"


def _dir(base: Path | None = None) -> Path:
    """Where the records live: LACUNA_CASCADE when set (the tests' own folder), else ~/lacuna-world/cascade."""
    return base or Path(os.environ.get("LACUNA_CASCADE") or DIR)
FILES = {"escalation": "escalations.jsonl", "shadow": "shadow.jsonl"}
_lock = threading.Lock()


def _clip(v, depth: int = 0):
    """A record as it is kept: strings at most 2,000 characters, lists at most 40, nothing deeper than 5."""
    if depth > 5:
        return None
    if isinstance(v, str):
        return v[:2000]
    if isinstance(v, list):
        return [_clip(x, depth + 1) for x in v[:40]]
    if isinstance(v, dict):
        return {str(k)[:60]: _clip(x, depth + 1) for k, x in list(v.items())[:40]}
    return v if v is None or isinstance(v, (bool, int, float)) else str(v)[:200]


def keep(kind: str, record: dict, base: Path | None = None) -> dict:
    """One record from the foreman, appended to its file."""
    name = FILES.get(str(kind))
    if not name:
        return {"ok": False, "why": f"no cascade record kind {kind!r} — escalation or shadow"}
    if not isinstance(record, dict):
        return {"ok": False, "why": "a cascade record is an object"}
    d = _dir(base)
    d.mkdir(parents=True, exist_ok=True)
    line = json.dumps(_clip(record), ensure_ascii=False)
    with _lock, (d / name).open("a") as f:
        f.write(line + "\n")
    if kind == "escalation" and base is None:                # the climb, into the graph cortex (a lesson about the mind)
        from . import arrivals
        arrivals.climbed(record)
    return {"ok": True}


def box_now() -> dict:
    """The box at one shadow step: available memory, swap used, load average, and whether the person's slot was free
    (no chat turn of a person in flight)."""
    from . import health
    out: dict = {}
    try:
        out["available_gb"] = health.memory().get("available_gb")
    except Exception:  # noqa: BLE001 — a reading that fails is left out, never a failed answer
        pass
    try:
        out["swap_used_mb"] = health.swap().get("used_mb")
    except Exception:  # noqa: BLE001
        pass
    try:
        out["load1"] = round(os.getloadavg()[0], 2)
    except OSError:
        pass
    try:
        from . import chat
        out["person_slot_free"] = getattr(chat, "ACTIVE_TURNS", 0) == 0
    except Exception:  # noqa: BLE001
        pass
    return out
