"""LACUNA'S MODE — how much it does before asking (the owner, 2026-10-17: "escalation privileges like Claude's … auto
mode is the default … controllable through Pi").

  auto  (default) — inside its bounds it acts, then says what it did: restart a dev service, start a worker, fix on its
                    branch. The "never yours" list does not move in any mode.
  ask             — every act that changes something waits for a yes (a choices card on its home, a question in Pi).

Kept in ~/.lacuna/mode.json; Pi's router and the home both read it; only a person sets it (the page or `lacuna mode`).
GET and POST /api/mode are the door's (lacuna-node/frontend/mode.mjs, 2026-11-06, finale §3.12); get() stays for the chat
and the home.
"""
from __future__ import annotations

import json
import os
import time
from pathlib import Path

def _file() -> Path:
    return Path(os.environ.get("LACUNA_HOME") or Path.home() / ".lacuna") / "mode.json"


MODES = ("auto", "ask")


def get() -> dict:
    try:
        d = json.loads(_file().read_text())
        if d.get("mode") in MODES:
            return d
    except (OSError, ValueError):
        pass
    return {"mode": "auto", "since": None, "by": None}


def set_mode(mode: str, who: str) -> dict:
    if mode not in MODES:
        raise ValueError(f"mode is one of {', '.join(MODES)}")
    d = {"mode": mode, "since": time.time(), "by": who}
    _file().write_text(json.dumps(d))
    return d
