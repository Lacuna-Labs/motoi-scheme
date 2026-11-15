"""SYS — the box, read exactly (the owner, 2026-10-21: "Lacuna has strange understandings of system info … it thinks
sometimes it's below the 10GB threshold or 10% threshold. Make it 15GB hard").

One read-only tool so the brain never guesses about the machine it runs on: the disk (free, and the 15 GB line), memory
(available, pressure), swap, the brain it is running (model, profile, slots, context) and its thresholds. Every number
here is the same one the alerts use — `health.py`, not a second opinion.
"""
from __future__ import annotations

import json
import os

from . import health

SCHEMA = {"what": {"type": "string", "enum": ["all", "disk", "memory", "swap", "brain"],
                   "description": "all (default) · disk · memory · swap · brain"}}


def tool(a: dict, who: str) -> str:
    what = str(a.get("what") or "all").lower()
    out: dict = {}
    if what in ("all", "disk"):
        d = health.disk()
        out["disk"] = {"free_gb": d["free_gb"], "total_gb": round(d["total"] / 1e9, 1),
                       "used_gb": round(d["used"] / 1e9, 1),
                       "low": d["low"], "low_threshold_gb": 15,
                       "line": f"{d['free_gb']} GB free; the alert line is 15 GB (hard)"}
    if what in ("all", "memory"):
        m = health.memory()
        out["memory"] = {"available_gb": m["available_gb"], "total_gb": round(m["total"] / 1e9, 1),
                         "pressure": m["pressure"]}
    if what in ("all", "swap"):
        try:
            out["swap_mb"] = health.swap()
        except Exception:  # noqa: BLE001 — swap is a nicety, never a reason to fail the read
            pass
    if what in ("all", "brain"):
        try:
            from . import chat
            p = chat.brain_profile()
            out["brain"] = {"name": p.get("name"), "kind": p.get("kind"), "think": {k: p.get("chat", {}).get(k) for k in
                            ("think_fast", "think_deep", "think_after")}, "abilities": str(p.get("abilities") or "")[:300],
                            "ctx": (p.get("llama") or {}).get("-c"), "slots": (p.get("llama") or {}).get("--parallel")}
        except Exception:  # noqa: BLE001
            pass
    try:
        out["load"] = [round(x, 2) for x in os.getloadavg()]
    except OSError:
        pass
    out["read_at"] = __import__("time").strftime("%Y-%m-%d %H:%M")
    return json.dumps(out, indent=1)


# ── THE LOGS IT CANNOT OTHERWISE READ (2026-10-22): a whitelist of the box's own logs, newest lines last.
LOGS = {"dev-api": "logs/dev-api.log", "qa-api": "logs/qa-api.log", "lacuna": "logs/lacuna.log",
        "brain": "logs/brain.log", "gateway": "logs/brain-gateway.log", "sentry": "logs/sentry.log",
        "jobs": "logs/jobs.log", "broker": "logs/broker.log", "foreman": "logs/foreman.log"}
LOGS_SCHEMA = {"name": {"type": "string", "enum": sorted(LOGS), "description": "which log"},
               "n": {"type": "integer", "description": "how many lines, newest last (default 40, max 200)"}}


def logs(a: dict, who: str) -> str:
    from .core import LACUNA_HOME
    name = str(a.get("name") or "dev-api")
    rel = LOGS.get(name)
    if not rel:
        return f"known logs: {', '.join(sorted(LOGS))}"
    try:
        n = max(1, min(int(a.get("n") or 40), 200))
    except (TypeError, ValueError):
        n = 40
    try:
        lines = (LACUNA_HOME / rel).read_text(errors="replace").splitlines()[-n:]
    except OSError:
        return f"no log at {rel}"
    body = "\n".join(lines)[-6000:]
    return body or f"{rel} is empty"
