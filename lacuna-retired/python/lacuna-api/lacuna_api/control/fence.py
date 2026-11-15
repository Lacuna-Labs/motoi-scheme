"""THE FENCE — the dev API's production fence, watched once a minute.

The dev API reports, read-only, whether it is fenced off production (`GET :5051/api/fence`: eBay sandbox, the wire
fence, no production logins or keyset, QA writes blocked). Lacuna says it ONCE when the fence is not proven — a part
false, or no report while the API answers — and clears the alert when every part holds again. A dev API that is down
says nothing either way: the services check already reports it, and an open fence alert stays open until an answer.
Only the dev API is asked; QA is never touched for this.
"""
from __future__ import annotations

from typing import Optional

from . import health
from .core import ENVS

KEY = "fence.dev"


def check() -> dict:
    port = ENVS[health.FENCE_ENV]["port"]
    hz, _ = health._get_json(f"http://127.0.0.1:{port}/healthz")
    _, v = health.fence(port, hz is not None)
    return v


def evaluate(raise_alert, resolve_alert, state: dict, v: Optional[dict] = None):
    v = v or check()
    if v["state"] == "unknown":
        return
    bad = v["state"] == "bad"
    said = state.get(KEY)                      # the failures last said, or None when green
    if bad:
        words = "; ".join(v["failures"])
        if said != words:
            resolve_alert(KEY, f"superseded: {words}"[:120])
            raise_alert(KEY, "error", "Dev production fence is not proven",
                        f"{words} — Lacuna › Control › The two APIs shows the fence line")
            state[KEY] = words
    elif said is not None:
        resolve_alert(KEY, "every part of the dev API's production fence holds again")
        state[KEY] = None


def section():
    """The watcher's minute pass calls this (workers.SECTIONS); a raise here is caught by workers._guarded."""
    from . import workers
    evaluate(workers.raise_alert, workers.resolve_alert, workers._state)
