"""SAKURA'S BRAIN, ON THE DESK (the owner, 2026-10-19: "add the … Max and … API switcher"). The one word in
~/lacuna-world/brain chooses the brain for Sakura's chat and every cart: max · api · local · cloud (playbook P-SBRAIN).
Read here; flipped only through Curator's own `tools/brain` (its guards: a key for api and cloud, the brain up for local).

  GET  /api/sakura/brain          {mode, ready: {max, api, local, cloud}, why}
  POST /api/sakura/brain {mode}   a person's press flips it (Lacuna does not flip it on its own)
"""
from __future__ import annotations

import subprocess
import urllib.request
from pathlib import Path

from fastapi import APIRouter, Header, HTTPException

router = APIRouter()
HOME = Path.home()
SWITCH = HOME / "lacuna-world" / "brain"
TOOL = HOME / "code" / "curator" / "tools" / "brain"
MODES = ("max", "api", "local", "cloud")


def _up(url: str) -> bool:
    try:
        with urllib.request.urlopen(url, timeout=3) as r:
            return r.status == 200
    except Exception:  # noqa: BLE001
        return False


def state() -> dict:
    try:
        mode = SWITCH.read_text().strip() or "max"
    except OSError:
        mode = "max"
    ready = {"max": True, "api": (HOME / ".curator-secrets" / "SAKURA_API_KEY").is_file(),
             "local": _up("http://127.0.0.1:8091/health"),
             "cloud": (HOME / ".curator-dev" / "secrets" / "sakura-cloud-free-key.txt").is_file()}
    why = {"api": None if ready["api"] else "no API key at ~/.curator-secrets/SAKURA_API_KEY",
           "local": None if ready["local"] else "Lacuna's brain is not answering",
           "cloud": None if ready["cloud"] else "no cloud key"}
    return {"mode": mode, "ready": ready, "why": {k: v for k, v in why.items() if v}}


@router.get("/api/sakura/brain")
def r_state() -> dict:
    return state()


@router.post("/api/sakura/brain")
def r_flip(body: dict, x_lacuna_who: str | None = Header(None)) -> dict:
    from .core import audit
    who = x_lacuna_who or "alfred"
    if who in ("lacuna", "home-lacuna") or who.startswith(("foreman:", "cart:")):
        raise HTTPException(403, "Sakura's brain is flipped by a person")
    mode = str((body or {}).get("mode") or "")
    if mode not in MODES:
        raise HTTPException(400, f"one of {', '.join(MODES)}")
    p = subprocess.run(["/bin/bash", str(TOOL), mode], capture_output=True, text=True, timeout=30)
    audit(who, "sakura.brain", mode=mode, ok=p.returncode == 0)
    return {"ok": p.returncode == 0, "said": (p.stdout or p.stderr).strip()[-200:], **state()}
