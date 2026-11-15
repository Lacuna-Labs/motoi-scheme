"""DEVICES — every running thing in one rack, with its controls (the owner, 2026-10-18: "How many servers do I have
running? Which ones are they? What's going on with Loam? … the ability to just kick one, stop it, start it").

  GET  /api/devices                 {studio: [...services...], agents: [...launchd jobs...], loam: {...}}
  POST /api/devices/agent/{label}/kick   restart one launchd job (the owner's word; QA's own jobs are refused here —
                                         QA is restarted through Services, which asks for its confirmation)
Services (dev API, QA API, vite, the tunnel, speech, Lacuna) keep their own routes (/api/services/{name}/{action}).
"""
from __future__ import annotations

import os
import re
import subprocess
import time
import urllib.request

AGENTS = [("ai.lacunalabs.brain", "Inference HTTP (retiring)"), ("ai.lacunalabs.brain-gateway", "Model router"), ("ai.lacunalabs.ollama", "Small-model server"),
          ("ai.lacunalabs.foreman", "the foreman"), ("ai.lacunalabs.lacuna-jobs", "Scheduler"), ("ai.lacunalabs.loam-dev", "Loam (dev)"),
          ("ai.lacunalabs.l2-daemon-dev", "L2 daemon · dev"), ("ai.lacunalabs.l2-daemon-qa", "L2 daemon · QA"),
          ("ai.lacunalabs.desk-https", "Edge proxy"), ("ai.lacunalabs.painter", "the painter"), ("ai.lacunalabs.wikipedia", "Wikipedia mirror"),
          ("ai.lacunalabs.curator-dev-tunnel", "dev tunnel"), ("ai.lacunalabs.backup", "Backup"), ("ai.lacunalabs.checkup", "checkup"),
          # every ai.lacunalabs.* label launchctl holds is listed (lanes C7, C8, 2026-10-24: the door and the hands drew "unlisted")
          ("ai.lacunalabs.lacuna-door", "Frontend (:1138)"), ("ai.lacunalabs.hands", "Executor"), ("ai.lacunalabs.lacuna-py", "Legacy API (:1137)"),
          ("ai.lacunalabs.world-broker", "Sandbox broker"), ("ai.lacunalabs.sale-cycle", "sale cycle")]
# never kicked from this rack: the customer's side; the door and the API (a kick cuts the owner's turn: services' press road)
NOT_HERE = {"ai.lacunalabs.l2-daemon-qa", "ai.lacunalabs.lacuna-door", "ai.lacunalabs.lacuna-py"}
PERIODIC = {"ai.lacunalabs.lacuna-jobs", "ai.lacunalabs.backup", "ai.lacunalabs.checkup", "ai.lacunalabs.sale-cycle"}   # they run, then exit


def _launchd() -> dict:
    out = subprocess.run(["launchctl", "list"], capture_output=True, text=True, timeout=5).stdout
    rows = {}
    for line in out.splitlines()[1:]:
        p = line.split("\t")
        if len(p) == 3:
            rows[p[2]] = {"pid": None if p[0] == "-" else int(p[0]), "last_exit": p[1]}
    return rows


def _loam() -> dict:
    try:
        with urllib.request.urlopen("http://127.0.0.1:7717/loam-health", timeout=2) as r:
            import json
            h = json.loads(r.read().decode())
        with urllib.request.urlopen("http://127.0.0.1:7717/metrics", timeout=2) as r:
            m = {k: float(v) for k, v in re.findall(r"^(loam_\w+) ([\d.]+)$", r.read().decode(), re.M)}
        return {"up": True, **h, "uptime_s": m.get("loam_uptime_seconds"), "store": "~/.curator-dev/loam/loam.redb",
                "talks_to": ["the dev API (curator_api/loam_engine.py)"]}
    except Exception as e:  # noqa: BLE001
        return {"up": False, "why": e.__class__.__name__}


def devices() -> dict:
    from . import services
    ld = _launchd()
    agents = []
    for label, name in AGENTS:
        r = ld.get(label)
        if r is None:
            continue
        agents.append({"label": label, "name": name, "up": bool(r["pid"]) or label in PERIODIC, "periodic": label in PERIODIC,
                       "pid": r["pid"], "last_exit": r["last_exit"],
                       "kickable": label not in NOT_HERE})
    return {"studio": services.all_status(), "agents": agents, "loam": _loam(), "at": time.time()}


def kick(label: str, who: str) -> dict:
    from .core import audit
    if label in NOT_HERE or label not in dict(AGENTS):
        return {"ok": False, "why": f"{label} is not kicked from the rack"}
    p = subprocess.run(["launchctl", "kickstart", "-k", f"gui/{os.getuid()}/{label}"], capture_output=True, text=True, timeout=20)
    audit(who, "devices.kick", label=label, code=p.returncode)
    return {"ok": p.returncode == 0, "said": f"{dict(AGENTS)[label]} restarted" if p.returncode == 0 else p.stderr[-200:]}


def agent_log(label: str, lines: int = 40) -> dict:
    """The last lines of one listed agent's log — the path its own plist names; nothing else is ever opened."""
    if label not in dict(AGENTS):
        return {"ok": False, "why": f"{label} is not one of the rack's agents", "text": ""}
    plist = os.path.expanduser(f"~/Library/LaunchAgents/{label}.plist")
    for key in ("StandardErrorPath", "StandardOutPath"):
        p = subprocess.run(["plutil", "-extract", key, "raw", plist], capture_output=True, text=True, timeout=5).stdout.strip()
        if p and os.path.isfile(p):
            with open(p, "rb") as f:
                f.seek(max(0, os.path.getsize(p) - 64000))
                tail = f.read().decode(errors="replace").splitlines()[-max(1, min(lines, 400)):]
            return {"ok": True, "name": label, "path": p, "text": "\n".join(tail)}
    return {"ok": False, "why": "its plist names no log", "text": ""}
