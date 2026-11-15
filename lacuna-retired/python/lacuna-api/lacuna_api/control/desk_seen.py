"""desk_seen — THE DESK IS WHERE NOTICES LAND FIRST (the owner, 2026-10-18: "if I have this open, I should get the
notifications there as a priority. Take them off on the server"). The open desk (any screen: the Mac, the phone) says
"I am here" every 30 s while it is visible; while that word is fresher than FRESH_S, an alert goes to the desk's
messages only and the banner/iMessage/ntfy channels hold their tongue (the audit keeps "held for the desk"). A closed
desk, a hidden tab, a sleeping phone: the word stops, and the channels speak again within 90 s.

The heartbeat routes (POST/GET /api/desk/seen) and the frame-time route are the door's since 2026-11-06
(lacuna-node/frontend/desk-reads.mjs, which writes this file); fresh() and state() stay for the alerts.
"""
from __future__ import annotations

import json
import time

from fastapi import APIRouter

from .core import LACUNA_HOME

SEEN = LACUNA_HOME / "desk-seen.json"
FRESH_S = 90
router = APIRouter()


def state() -> dict:
    try:
        row = json.loads(SEEN.read_text())
    except (OSError, ValueError):
        return {"fresh": False, "age_s": None, "screen": None}
    age = time.time() - float(row.get("t") or 0)
    return {"fresh": age < FRESH_S, "age_s": round(age), "screen": row.get("screen")}


def fresh() -> bool:
    return state()["fresh"]


@router.post("/api/desk/fault")
def r_fault(body: dict) -> dict:
    """A desk view broke (gl/Contain.jsx caught it, the desk stayed up): the fault becomes an error of its class, so
    the Errors card and Lacuna see it — "desk" is the source, the view is the subsystem."""
    from . import errors
    where = str((body or {}).get("where") or "a view")[:80]
    what = str((body or {}).get("error") or "")[:400]
    try:
        with errors._lock if hasattr(errors, "_lock") else _nolock():
            errors.record("dev", {"t": time.time(), "source": "desk", "subsystem": f"desk.{where.split(' ')[0]}", "action": "render",
                                  "level": "error", "summary": f"{where} broke: {what}"})
            errors.db().commit()
    except Exception as e:  # noqa: BLE001
        return {"ok": False, "why": str(e)}
    return {"ok": True}


class _nolock:
    def __enter__(self):
        return self

    def __exit__(self, *a):
        return False
