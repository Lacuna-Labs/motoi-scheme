"""THE SECURITY CARD'S REPORT (the owner, 2026-10-18: "Security: a report, the sentinel's life (wake)"). From sentinel.py:
  GET  /api/security          the sentinel's LIFE (when it last looked, how often, awake or asleep) and its REPORT — every
                              listener now (port, program, reachable from the network or only this Mac), every launch item
                              and login, and what is NOT in the baseline, by kind, each with the words to accept it
  POST /api/security/wake     the sentinel looks NOW (its next five-minute look comes early); answers what it found
  POST /api/security/accept   {id} files the card "this is mine" — the owner's press puts it in the baseline
The sentinel watches and tells; it never kills, deletes or blocks (that is the owner's call).
"""
from __future__ import annotations

import time

from fastapi import APIRouter

from . import sentinel

router = APIRouter()


def report() -> dict:
    now = sentinel.snapshot()
    base = sentinel._load() or {"listeners": {}, "agents": {}, "logins": {}}
    new = sentinel.diff(base, now)
    last = sentinel._last[0]
    age = time.time() - last if last else None
    listeners = [{"port": k.split("/")[0], "scope": k.split("/")[1], "program": p, "known": k in base.get("listeners", {})}
                 for k, p in sorted(now["listeners"].items(), key=lambda kv: (kv[0].split("/")[1] != "network", int(kv[0].split("/")[0]) if kv[0].split("/")[0].isdigit() else 0))]
    return {
        "life": {"last_look": last or None, "age_s": round(age) if age is not None else None, "every_s": sentinel.EVERY_S,
                 "state": "awake" if age is not None and age < sentinel.EVERY_S * 2 else "asleep" if age is not None else "not started"},
        "counts": {"listeners": len(now["listeners"]), "network": sum(1 for k in now["listeners"] if k.endswith("/network")),
                   "launch_items": len(now["agents"]), "logins": len(now["logins"]), "not_accepted": len(new)},
        "new": new, "listeners": listeners, "logins": list(now["logins"].keys()),
        "baseline_at": base.get("at"),
    }


@router.get("/api/security")
def r_report() -> dict:
    return report()


@router.post("/api/security/wake")
def r_wake() -> dict:
    from .workers import raise_alert
    sentinel._last[0] = 0.0
    found = sentinel.check(raise_alert)
    return {"ok": True, "looked_at": time.time(), "new": found}


@router.post("/api/security/accept")
def r_accept(body: dict) -> dict:
    from . import chat
    item = str((body or {}).get("id") or "")
    if ":" not in item:
        return {"ok": False, "why": "name what to accept, like port:8443/network"}
    return chat.file_petition("sentinel-accept", None, f"{item} is mine — put it in the sentinel's baseline", "alfred",
                              dry=bool((body or {}).get("dry")), args={"id": item})
