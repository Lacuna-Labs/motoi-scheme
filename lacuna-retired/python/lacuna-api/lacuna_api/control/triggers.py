"""TRIGGERS — standing conditions and schedules that start carts (the cortex roll-up C8; CORTEX-ENGINEERING §25.3: "the
cortex is the place where you put the triggers — so we don't burden the LLM with always trying to do stuff"; the owner,
2026-10-18: "the CI/CD card … it runs like a cron, basically. It's just always on … you could change the release schedule").

A trigger is one line in ~/lacuna-world/triggers.json:
  {id, cart, when: {read, path, op, value} | {every: "6h"} | {at: "03:00"}, dry, armed_by, armed_at, enabled}
  read · path   one of the box's reads (hands.py / hands_api.py) and a dotted path into its answer: disk · disk.free_pct
  op · value    < <= > >= == != against a number (or a word)
Evaluated every minute by the watcher. A condition FIRES when it turns true (edge, not level) and re-arms when it turns
false; a schedule fires at its time. A firing is a fact in the graph cortex ("trigger <id> fired: <evidence>") and:
  · a WATCH cart (reads and reports only) runs at once — its trigger was armed by the owner's press, which covers it
  · an ACT cart (release, cleanup) files its card — every act is still the owner's press, every time
Arming (creating or enabling) a trigger is itself a card: `POST /api/triggers` files `trigger-arm`; the yes writes it.
GET /api/triggers is the door's (lacuna-node/frontend/triggers-read.mjs, 2026-11-06, finale §3.12); the switch-off stays here
beside section(), which rewrites the same file every minute.
"""
from __future__ import annotations

import json
import os
import re
import threading
import time
from pathlib import Path

OPS = {"<": lambda a, b: a < b, "<=": lambda a, b: a <= b, ">": lambda a, b: a > b, ">=": lambda a, b: a >= b,
       "==": lambda a, b: a == b, "!=": lambda a, b: a != b}
_lock = threading.RLock()     # section() holds it across check(), which seeds under it too
_state: dict[str, dict] = {}            # id → {was: bool, last: t, value}
MIN_GAP_S = 600                         # a condition that flickers fires at most every ten minutes


def _world() -> Path:
    return Path(os.environ.get("LACUNA_WORLD") or Path.home() / "lacuna-world")


def path() -> Path:
    return _world() / "triggers.json"


def load() -> list[dict]:
    try:
        return json.loads(path().read_text()).get("triggers", [])
    except (OSError, ValueError):
        return []


def save(rows: list[dict]) -> None:
    p = path()
    tmp = p.with_suffix(".tmp")
    tmp.write_text(json.dumps({"_": __doc__.split("\n\n")[0], "triggers": rows}, indent=1))
    tmp.replace(p)


def _dig(d, dotted: str):
    for part in dotted.split("."):
        if isinstance(d, dict):
            d = d.get(part)
        elif isinstance(d, list) and part.isdigit():
            d = d[int(part)] if int(part) < len(d) else None
        else:
            return None
    return d


def _secs(every: str) -> float:
    m = re.fullmatch(r"(\d+)\s*([mhd])", str(every or "").strip())
    return int(m.group(1)) * {"m": 60, "h": 3600, "d": 86400}[m.group(2)] if m else 0


def check(t: dict, now: float | None = None) -> tuple[bool, str]:
    """(fires now?, the evidence in words) — pure but for the read"""
    now = now or time.time()
    w = t.get("when") or {}
    with _lock:     # seed `last` from the last fire on disk, so a boot does not re-fire an every/at trigger
        st = _state.setdefault(t["id"], {"was": False, "last": float((t.get("history") or [{}])[-1].get("at", 0.0))})
    if w.get("every"):
        due = now - st["last"] >= _secs(w["every"])
        return due, f"every {w['every']}"
    if w.get("at"):
        hh, mm = (int(x) for x in str(w["at"]).split(":"))
        lt = time.localtime(now)
        today = time.mktime((lt.tm_year, lt.tm_mon, lt.tm_mday, hh, mm, 0, 0, 0, -1))
        due = now >= today and st["last"] < today
        return due, f"at {w['at']}"
    from . import hands
    r = hands.do(str(w.get("read")), [str(a) for a in (w.get("args") or [])])
    if not r.get("ok"):
        return False, f"the read {w.get('read')} did not answer: {r.get('why')}"
    v = _dig(r.get("result"), str(w.get("path") or ""))
    want = w.get("value")
    try:
        holds = OPS[w.get("op", ">")](float(v), float(want))
    except (TypeError, ValueError, KeyError):
        holds = OPS.get(w.get("op", "=="), OPS["=="])(str(v), str(want))
    fires = holds and not st["was"] and now - st["last"] >= MIN_GAP_S
    st["was"] = holds
    st["value"] = v
    return fires, f"{w.get('read')}.{w.get('path')} = {v} ({w.get('op')} {want})"


def fire(t: dict, evidence: str) -> dict:
    from . import arrivals, cartview, lacuna_cortex
    _state.setdefault(t["id"], {})["last"] = time.time()
    arrivals._later(lacuna_cortex.remember, "fact", f"trigger-{t['id']}-{int(time.time())}",
                    {"text": f"trigger {t['id']} fired: {evidence} → the cart {t['cart']}", "trigger": t["id"]},
                    about=[f"card/cart:{t['cart']}"])
    f = _world() / "carts" / f"{t['cart']}.sks"
    if not f.exists():
        return {"ok": False, "why": f"no cart {t['cart']}"}
    program = f.read_text(errors="replace")
    acts = bool(re.search(r"\(acts\s*\.", program))
    if acts or not t.get("standing", True):
        # an ACT cart: the trigger files its card; the owner's press runs it (every time)
        r = cartview.run_now(t["cart"], f"trigger:{t['id']}", bool(t.get("dry")))
        return {"ok": True, "filed": r.get("petition"), "evidence": evidence}
    # a WATCH cart under an armed trigger: it runs now (the owner's press armed this trigger)
    from . import carts, foreman
    trial = foreman.call("POST", "/check", {"program": program}, timeout=30)
    if not trial.get("ok"):
        return {"ok": False, "why": "the cart did not pass its trial"}
    r = carts.spawn({"cart": t["cart"], "exam": None, "program": program, "header": trial.get("cart") or {}, "dry": False},
                    f"trigger:{t['id']} (armed by {t.get('armed_by')})")
    return {"ok": bool(r.get("ok")), "ran": t["cart"], "evidence": evidence}


def section() -> None:
    """the watcher's minute: every enabled trigger checked; the ones that fire, fired (and written in their history)"""
    rows = load()
    changed = False
    for t in rows:
        if not t.get("enabled", True):
            continue
        with _lock:
            fires, evidence = check(t)
        t["seen"] = {"at": time.time(), "evidence": evidence}
        if fires:
            out = fire(t, evidence)
            t.setdefault("history", []).append({"at": time.time(), "evidence": evidence, **{k: out.get(k) for k in ("filed", "ran", "why")}})
            t["history"] = t["history"][-20:]
        changed = True
    if changed:
        save(rows)


def arm(spec: dict, who: str) -> dict:
    """the owner's yes on a `trigger-arm` card: the trigger is written, enabled"""
    rows = [r for r in load() if r.get("id") != spec.get("id")]
    rows.append({**spec, "armed_by": who, "armed_at": time.time(), "enabled": True})
    save(rows)
    return {"ok": True, "armed": spec.get("id")}


def disarm(tid: str, who: str) -> dict:
    """turning one off needs no press: stopping is always allowed"""
    rows = load()
    for r in rows:
        if r.get("id") == tid:
            r["enabled"] = False
            r["disarmed_by"], r["disarmed_at"] = who, time.time()
    save(rows)
    return {"ok": True, "disarmed": tid}


def valid(spec: dict) -> str | None:
    if not re.fullmatch(r"[a-z0-9-]{2,40}", str(spec.get("id") or "")):
        return "a trigger's id is a short lowercase word with dashes"
    if not (_world() / "carts" / f"{spec.get('cart')}.sks").exists():
        return f"there is no cart {spec.get('cart')}"
    w = spec.get("when") or {}
    if not (w.get("every") and _secs(w["every"]) >= 600) and not w.get("at") and not (w.get("read") and w.get("op") in OPS):
        return "when is {every: '6h'} (at least 10m), {at: '03:00'}, or {read, path, op, value}"
    return None
