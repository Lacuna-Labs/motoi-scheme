"""THE WORK ORDER — one press, and Lacuna works on its own for a while (the owner, 2026-10-19: "I need to leave my house.
I keep having to look at my phone because every 20 minutes this thing keeps asking me questions … I want to be able to
send it off to do tasks"). The owner presses ONE card (`work-order`, N hours). Until it ends, a card Lacuna files on OUR
side is answered at once in his name, audited and listed:

  spawn-job     its workers (repairs, docs, tests)                                        → yes
  spawn-cart    a cart whose acts touch neither QA nor her iPad                           → yes
  merge         a worker's branch into dev (the workshop's safe merge, its review passed) → yes
  check-in      named paths committed to dev                                              → yes
  worker-asks   a judgment the brain split on: its own majority answers (2 of 3); a tie waits for him
NEVER under a work order: qa-* · deploy-ipad · promote · promote-and-build · release · cart steps that promote or install
· forge put-in-service · the forge's pairs, training and eval (D14, 2026-11-02) — those still wait for his press. `end()` stops it early.
GET /api/work-order and POST /api/work-order/end are the door's (lacuna-node/frontend/work-queue.mjs, 2026-11-06, finale §3.12);
the press that starts one (POST /api/work-order) files its petition here.
"""
from __future__ import annotations

import json
import os
import re
import time
from pathlib import Path

from .core import LACUNA_HOME, audit

# A test may set FILE; otherwise the path is read at each call, not at import, so a test's LACUNA_HOME holds its own order
# (2026-11-01: a work queue switched on in one test left a 24 h order in the session's home, and it answered a later test's
# forge card before its press; the audit's own path follows the same rule, core._audit_file).
FILE: Path | None = None


def _file() -> Path:
    return FILE or Path(os.environ.get("LACUNA_HOME") or LACUNA_HOME) / "work-order.json"
# THE FORGE WAITS (2026-11-02, LACUNA-1.0-FINALE.md D14): a forge card loads a mind on the GPU beside the live desk, and an ON queue
# answered its own retrain of the sentry (a stale standing task, video B3) at 01:16 with no press; the forge's cards are not answered
# by a work order until the owner or the lead decides them
COVERED = ("spawn-job", "spawn-cart", "merge", "check-in", "worker-asks")
CUSTOMER_ACTS = ("promote-build", "install-ipad", "pass")       # a cart that names these is never self-approved


def current() -> dict | None:
    try:
        d = json.loads(_file().read_text())
    except (OSError, ValueError):
        return None
    return d if time.time() < float(d.get("until") or 0) else None


def start(hours: float, by: str) -> dict:
    hours = max(0.5, min(24.0, float(hours or 24)))                 # 24 h by default (the owner, 2026-10-19)
    d = {"until": time.time() + hours * 3600, "by": by, "hours": hours, "started": time.time(), "answered": []}
    _file().write_text(json.dumps(d))
    audit(by, "work-order.start", hours=hours)
    try:
        from .chat import cx
        cx("decision", "owner-extended-permissions", {"text": f"{by} let me work on my own for {hours:g} h (until {time.strftime('%H:%M', time.localtime(d['until']))}): workers, carts, check-ins, merges into dev and forge steps are answered; releases, QA and prod still wait for him."}, ["thing/owner"])
    except Exception:  # noqa: BLE001
        pass
    return {"ok": True, "said": f"Lacuna works on its own for {hours:g} h (until {time.strftime('%H:%M', time.localtime(d['until']))}); "
                                "QA, her iPad, promote and release still wait for you"}


def end(by: str) -> dict:
    d = current()
    _file().unlink(missing_ok=True)
    audit(by, "work-order.end")
    return {"ok": True, "said": "the work order ended: every card waits for you again", "answered": len((d or {}).get("answered") or [])}


def covers(p: dict) -> dict | None:
    """{approve, by, why} when the work order answers this card now; None when it waits for the owner."""
    d = current()
    if not d or p.get("action") not in COVERED:
        return None
    a = p.get("args") or {}
    if p["action"] == "spawn-cart" and set((a.get("header") or {}).get("acts") or []) & set(CUSTOMER_ACTS):
        return None
    approve, why = True, f"{p['action']} on our side"
    if p["action"] == "worker-asks":
        m = re.search(r"(\d+) yes / (\d+) no", str(p.get("reason") or ""))
        if not m or m.group(1) == m.group(2):
            return None                                  # no clear majority: it waits for him
        approve = int(m.group(1)) > int(m.group(2))
        why = f"its own vote ({m.group(1)} yes / {m.group(2)} no)"
    d.setdefault("answered", []).append({"id": p.get("id"), "action": p["action"], "approve": approve, "t": time.time(),
                                         "what": str(p.get("reason") or "")[:120]})
    _file().write_text(json.dumps(d))
    audit("lacuna", "work-order.answered", id=p.get("id"), card=p["action"], approve=approve)   # not action=: audit's own argument (it threw, 2026-10-19)
    return {"approve": approve, "by": f"work-order ({d.get('by')})", "why": why}
