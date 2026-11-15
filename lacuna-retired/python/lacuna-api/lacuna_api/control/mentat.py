"""MENTAT OBSERVABILITY — why the cart ranker shows a cart, or does not (2026-10-08).

Mentat ranks the carts in the Curator app. The dev API (:5051, the anonymous operator) answers questions about that
ranking under /api/mentat/observe; this module carries them to the console SERVER-SIDE (the page never calls :5051
itself, so there is no CORS and the Door stays the only way in). Read-only: every call is a GET. QA (:5050) is never
asked — the customer's server is not a laboratory.

It also feeds THE STANDING CHECK into the watcher's minute pass (workers.SECTIONS → `section`): the curator's own
/health names what is wrong (a signal firing on zero objects for seven days, a cart never shown, a no-signal share
above zero) and each alert is said ONCE through raise_alert, cleared through resolve_alert when it ends. When the
curator API does not answer, the line says UNKNOWN — never green.
"""
from __future__ import annotations

import json
import os
import threading
import time
import urllib.error
import urllib.parse
import urllib.request
from typing import Optional

from fastapi import APIRouter, HTTPException
from fastapi.responses import Response

BASE = os.environ.get("LACUNA_MENTAT_URL", "http://127.0.0.1:5051/api/mentat/observe")
TIMEOUT_S = 10.0
FRESH_S = 60.0                      # the standing check is asked at most once a minute, however often the page looks

router = APIRouter()

# what each view may carry through to the curator; anything else is dropped, never forwarded
PARAMS = {
    "board": ("shop", "category", "band", "flag", "limit"),
    "list": ("shop", "category", "band", "flag", "offset", "limit"),
    "impressions": ("shop", "cart", "object", "limit"),
    "objects": ("shop",),
    "explain": ("cart", "object", "shop", "impression"),
    "right-time": ("shop",),
    "health": (),
}


class Unreachable(Exception):
    """The curator API did not answer, or answered something that is not the Mentat observe surface."""


def _url(path: str, params: Optional[dict] = None) -> str:
    q = {k: v for k, v in (params or {}).items() if v not in (None, "")}
    return f"{BASE}{path}" + (f"?{urllib.parse.urlencode(q)}" if q else "")


def _get(path: str, params: Optional[dict] = None, timeout: float = TIMEOUT_S) -> tuple[int, bytes, str]:
    """One GET to the curator. Returns (status, body, content type); raises Unreachable when nothing answers."""
    try:
        with urllib.request.urlopen(_url(path, params), timeout=timeout) as r:
            return r.status, r.read(), r.headers.get("Content-Type", "")
    except urllib.error.HTTPError as e:
        return e.code, e.read() or b"", e.headers.get("Content-Type", "") if e.headers else ""
    except Exception as e:                                            # noqa: BLE001
        raise Unreachable(f"{e.__class__.__name__}: {e}"[:200]) from None


def ask(path: str, params: Optional[dict] = None) -> dict:
    """A JSON question. A curator error keeps its status; no answer at all is a 502 that says why."""
    try:
        status, body, _ = _get(path, params)
    except Unreachable as e:
        raise HTTPException(502, {"why": f"the curator API (dev, :5051) did not answer: {e}", "unreachable": True})
    try:
        data = json.loads(body.decode() or "{}")
    except Exception:
        data = None
    if status == 404 and not (isinstance(data, dict) and data.get("ok") is False):
        why = (data or {}).get("detail") if isinstance(data, dict) else None
        raise HTTPException(404, {"why": f"the curator API has no {path} ({why or 'not found'})"})
    if status >= 400 or not isinstance(data, dict):
        why = (data or {}).get("why") or (data or {}).get("detail") if isinstance(data, dict) else None
        raise HTTPException(status if status >= 400 else 502, {"why": str(why or f"the curator answered {status}")[:300]})
    return data


def _pick(view: str, given: dict) -> dict:
    return {k: given[k] for k in PARAMS[view] if given.get(k) not in (None, "")}


# ── the routes the console reads ─────────────────────────────────────────────────────────────────────────────────


@router.get("/api/mentat/board")
def board(shop: str = "", category: str = "", band: str = "", flag: str = "", limit: Optional[int] = None):
    """The board: counts for every list (`lists.*.count`), the first few names of each, the first carts."""
    lim = max(1, min(limit, 200)) if limit else None
    return ask("/board", _pick("board", {"shop": shop, "category": category, "band": band, "flag": flag, "limit": lim}))


LISTS = ("never_fire", "never_shown", "failing", "carts")


@router.get("/api/mentat/list/{name}")
def paged_list(name: str, shop: str = "", category: str = "", band: str = "", flag: str = "", offset: int = 0, limit: int = 100):
    """One of the board's lists, a page at a time: {name, count, offset, limit, items}."""
    if name not in LISTS:
        raise HTTPException(404, {"why": f"no list named {name}; the lists are {', '.join(LISTS)}"})
    return ask(f"/list/{name}", _pick("list", {"shop": shop, "category": category, "band": band, "flag": flag,
                                                "offset": max(0, offset), "limit": max(1, min(limit, 200))}))


@router.get("/api/mentat/cart/{slug}")
def cart(slug: str):
    return ask(f"/cart/{urllib.parse.quote(slug, safe='')}")


@router.get("/api/mentat/signal/{sid}")
def signal(sid: str):
    return ask(f"/signal/{urllib.parse.quote(sid, safe='')}")


@router.get("/api/mentat/impressions")
def impressions(shop: str = "", cart: str = "", object: str = "", limit: int = 50):
    return ask("/impressions", _pick("impressions", {"shop": shop, "cart": cart, "object": object, "limit": max(1, min(limit, 500))}))


@router.get("/api/mentat/objects")
def objects(shop: str = ""):
    return ask("/objects", _pick("objects", locals()))


@router.get("/api/mentat/explain")
def explain(cart: str, object: str, shop: str = "", impression: str = ""):
    return ask("/explain", _pick("explain", {"cart": cart, "object": object, "shop": shop, "impression": impression}))


@router.get("/api/mentat/right-time")
def right_time(shop: str = ""):
    return ask("/right-time", _pick("right-time", locals()))


@router.get("/api/mentat/export")
def export(format: str = "csv"):
    """The curator's export file, passed through as a download (jsonl or csv only)."""
    if format not in ("csv", "jsonl"):
        raise HTTPException(422, {"why": "format is csv or jsonl"})
    try:
        status, body, ctype = _get("/export", {"format": format}, timeout=60)
    except Unreachable as e:
        raise HTTPException(502, {"why": f"the curator API (dev, :5051) did not answer: {e}", "unreachable": True})
    if status >= 400:
        raise HTTPException(status, {"why": f"the curator answered {status} for the export"})
    name = f"mentat-observe-{time.strftime('%Y%m%d-%H%M')}.{format}"
    return Response(body, media_type=ctype or ("text/csv" if format == "csv" else "application/x-ndjson"),
                    headers={"Content-Disposition": f'attachment; filename="{name}"'})


@router.get("/api/mentat/status")
def status():
    """The standing check's line: ok · warn · error · unknown, its alerts, and when it was asked."""
    return check()


# ── THE STANDING CHECK ───────────────────────────────────────────────────────────────────────────────────────────

_last: dict = {"t": 0.0, "v": None}
_lock = threading.Lock()


def check(max_age: float = FRESH_S) -> dict:
    """Ask the curator's /health (at most once a minute). An answer that cannot be read is UNKNOWN, never ok."""
    with _lock:
        if _last["v"] is not None and time.time() - _last["t"] < max_age:
            return dict(_last["v"])
    now = time.time()
    try:
        status_, body, _ = _get("/health", timeout=6)
        data = json.loads(body.decode() or "{}") if status_ < 400 else None
        if not isinstance(data, dict) or data.get("ok") is not True or not isinstance(data.get("alerts"), list):
            why = f"the curator answered {status_}" + (" without the Mentat health routes" if status_ == 404 else "")
            raise Unreachable(why)
        alerts = [a for a in data["alerts"] if isinstance(a, dict) and a.get("id")]
        levels = {a.get("level") for a in alerts}
        state = "error" if "error" in levels else "warn" if "warn" in levels else "ok"
        v = {"state": state, "reachable": True, "checked_at": data.get("checked_at") or now, "asked_at": now,
             "alerts": alerts, "why": None}
    except Unreachable as e:
        v = {"state": "unknown", "reachable": False, "checked_at": None, "asked_at": now, "alerts": [],
             "why": f"the Mentat health check on the curator API (dev, :5051) could not be read: {e}"}
    except Exception as e:                                            # noqa: BLE001 — a bad body is unknown too
        v = {"state": "unknown", "reachable": False, "checked_at": None, "asked_at": now, "alerts": [],
             "why": f"the Mentat health answer could not be read: {e.__class__.__name__}"}
    with _lock:
        _last.update(t=now, v=v)
    return dict(v)


def subject_words(subject, most: int = 6, count: Optional[int] = None) -> str:
    """What an alert is about, in a few words: one name, or the first few of a list and how many more. `subject` may
    be only the head of the list; `count` is the true total, and "more" is counted from it, never from the head."""
    if not subject:
        return ""
    if isinstance(subject, (list, tuple)):
        names = [str(x) for x in subject][:most]
        total = count if isinstance(count, int) and count >= len(names) else len(subject)
        more = f" and {total - len(names):,} more" if total > len(names) else ""
        return f" ({', '.join(names)}{more})"
    return f" ({str(subject)[:120]})"


def evaluate(raise_alert, resolve_alert, state: dict, v: Optional[dict] = None):
    """The minute's word on Mentat, edge-triggered like every other alert: each condition is said once, cleared
    when it ends. `state` is the watcher's said-once memory (keys under `mentat:` survive a restart)."""
    v = v or check()
    reach_key = "mentat:reach"
    was = state.get(reach_key, True)
    state[reach_key] = v["reachable"]
    if not v["reachable"]:
        if was:
            raise_alert(reach_key, "warn", "Mentat check: UNKNOWN", v["why"] + " — Lacuna › Mentat cannot say whether the carts are healthy",
                        notify=False)
        return                       # unknown is not clear: the open alerts stay open until an answer says otherwise
    if not was:
        resolve_alert(reach_key, "the curator API answers the Mentat health check again")
    before = set(state.get("mentat:open") or [])
    now_open = {}
    for a in v["alerts"]:
        now_open[f"mentat:{a['id']}"] = a
    for key, a in now_open.items():
        if key not in before:
            level = a.get("level") if a.get("level") in ("error", "warn", "info") else "warn"
            raise_alert(key, level, f"Mentat · {a.get('text') or a['id']}"[:160],
                        f"{a.get('text') or a['id']}{subject_words(a.get('subject'), count=a.get('count'))} — Lacuna › Mentat shows why", notify=level == "error")
    for key in before - set(now_open):
        resolve_alert(key, "the Mentat health check no longer names it")
    state["mentat:open"] = sorted(now_open)


def section():
    """The watcher's minute pass calls this (workers.SECTIONS); a raise here is caught by workers._guarded."""
    from . import workers
    evaluate(workers.raise_alert, workers.resolve_alert, workers._state)
