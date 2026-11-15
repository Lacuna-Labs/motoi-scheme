"""LACUNA'S HOME — what its region shows, and the board it places cards on (LACUNA-1.3-DESIGN §4, the owner 2026-10-18:
"Lacuna opens up a thing and says, hey, take a look at this, and opens up the right graph in the right place at the
right time").

  snapshot()        one read of the box for the home: services, telemetry (each customer's server and device, read only),
                    disk, memory, the brain, alerts, workers, reports, today's spend, Caliper — the desk's apps draw from it
  series(names)     the sampled metrics (disk, memory, each service up), thinned to ≤ 240 points for a chart
  board / act()     the cards LACUNA put down: {id, kind, title, block, w, h, links}. Ops: place · move (next to a card)
                    · remove · focus · say · clear. Kept in ~/.lacuna/home-board.json, so a reload shows the same room.

  agents / exam     the AGENTS card (minds by tier, which run now) and the EXAM card (E1–E10) — home_cards.py reads them.
  forge             the FORGE app (forge.py: its rooms are the tasks — Sentry W1, Worker W2); the LACUNA app reads /api/watch
                    (its own output) and holds the chat (/api/chat/stream) and its settings.
  caliper           the CALIPER app (caliper.py): its reports, the battery's Caliper act, its scenarios.
  telemetry         the TELEMETRY app: the customers (customers.json, or one per customer-side API), each one's server,
                    device, builds and watchdogs — no customer's name is ever in the code; labels come from the data.

THE EXAM'S FILE (§37.1), ~/lacuna-world/exam/state.json — the carts write it, the desk only reads it:
  {"started": iso|null,
   "items": [{"id": "E1", "title": str, "cart": str, "state": "waiting|running|press|done|failed", "worker": id|null,
              "minutes": n, "brain_seconds": n, "minds": [model…], "said": "one line", "petition": id|null}]}
  "press" = waiting on the owner's press (its card is the petition, in the inbox; the desk "may I?" card is off since 2026-10-20, chat.CONTRACT_CARDS); E5/E8/E10 pass at "done".

A card's block is the turn protocol's (curator-web sakuraChat/blocks/PROTOCOL.md) — chart, choices, term, tiles … — so
what Lacuna shows here, Sakura can show in her chat, and the other way round.
"""
from __future__ import annotations

import importlib.util
import json
import os
import threading
import time
import urllib.request
from pathlib import Path

from . import caliper, forge, handbook, health, home_cards, mode, reports, skills, tell
from .workers import alerts, series as _series
from . import notices

def _board_file() -> Path:
    """~/.lacuna/home-board.json — or under LACUNA_HOME (tests never touch the live desk)."""
    return Path(os.environ.get("LACUNA_HOME") or Path.home() / ".lacuna") / "home-board.json"


FOREMAN = Path.home() / ".lacuna" / "jail" / "workers" / "foreman.py"
_LOCK = threading.Lock()
MAX_CARDS = 24
# the desk's APPS, in the order the desk numbers them (§42: cards are applications); the artifacts that come out of them
# follow. ONE list: the page orders by it and the chat's point_at counts by it, so "card 3" is the same app to a person
# and to Lacuna. A forge task's own card id (s-forge-sentry …) opens the Forge app at that task's room.
# the desk's home order (§44: Lacuna, Forge, Chat, Telemetry, Minds, Agents, Exam, then the rest, the unwired last) —
# the same order as lacuna-home/src/apps/deskmap.js, which the desk map (GET /api/home/map) is built from
STANDING = ["s-lacuna", "s-forge", "s-chat", "s-telemetry", "s-minds", "s-agents", "s-exam", "s-map", "s-handbook", "s-services",
            "s-caliper", "s-watch", "s-errors", "s-battery", "s-system", "s-security", "s-reports", "s-dirt",
            "s-build", "s-mocks", "s-ingest", "s-eyes", "s-devices", "s-carts", "s-work"]   # Release, CI/CD → Build; Watchdogs → Telemetry (R12)
DESK_MAP = Path(__file__).resolve().parent.parent / "console" / "home" / "deskmap.json"
# the nav ops (§44, the owner 08:40: "Lacuna knows the menus … This is its screen"): what Lacuna sends to move the
# owner's view; the desk follows b["nav"] live (it polls the board). Each op: the args it keeps.
NAV_OPS = {"open-app": ("app", "room"), "slide": ("app", "panel", "args"), "back": (), "forward": (),
           "side-by-side": ("a", "b"), "point-at": ("app", "element"), "home": (),
           # the agent ops: the desk plays the choreography (node lights → thoughts slide in → the ask down the wire → the
           # reply up into the stream); with `reply` given the desk only plays it, without it the targeted desk asks
           "thoughts": ("worker",), "talk": ("worker", "text", "reply", "by_name"), "interrupt": ("worker", "mode", "done"),
           # the INBOX (the owner, 2026-10-18: "a message queue I can go to quickly and address Lacuna's requests"):
           # everything waiting on him, in one sliding panel; `say` is Lacuna's line on top of it
           "inbox": ("open", "say", "focus")}      # focus: one card's id — the inbox opens ON it, its yes/no in front of him


def _foreman():
    spec = importlib.util.spec_from_file_location("lacuna_foreman", FOREMAN)
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


def _loaded() -> list[dict]:
    try:
        with urllib.request.urlopen("http://127.0.0.1:11434/api/ps", timeout=2) as r:
            # (Ollama's `size` counts the window and runtime, not the memory-mapped weights — so name the model instead)
            return [{"name": m["name"].removesuffix(":latest"), "params": (m.get("details") or {}).get("parameter_size"),
                     "quant": (m.get("details") or {}).get("quantization_level"), "ctx": m.get("context_length"),
                     "family": (m.get("details") or {}).get("family"), "until": m.get("expires_at")}
                    for m in json.load(r).get("models", [])]
    except (OSError, ValueError):
        return []


_IPAD: dict = {"t": 0.0, "v": {}, "busy": False}


def _read_ipad() -> None:
    """The device read, off the request's thread: devicectl can take 10 s or more when the iPad sleeps, and the home read
    stood still for it once a minute (the CI's brain-down test, 11-01: /api/home in 10.4 s)."""
    from . import deploys
    try:
        d = deploys.device("home")
        pk = deploys.packages()
        kept = deploys.builds()[:3]
        _IPAD["v"] = {"device": d.get("device") if d.get("ok") else None, "build": d.get("build"),
                      "device_why": None if d.get("ok") else d.get("why"),
                      "behind": (pk.get("waiting_on_dev_not_on_qa") or {}).get("count"),
                      "kept": [b.get("id") for b in kept]}
    except Exception as e:  # noqa: BLE001
        _IPAD["v"] = {"device_why": f"{e.__class__.__name__}"}
    _IPAD["t"] = time.time()
    _IPAD["busy"] = False


def ipad(h: dict) -> dict:
    """The customer-side server and its device, read only: the device and its build, the kept builds, how far QA is
    behind dev, QA's watchdogs that are not fine. The device is read on a thread of its own, a minute apart, and the home
    answers with the last read at once; a test or a scratch home never asks her iPad."""
    live = Path(os.environ.get("LACUNA_HOME") or Path.home() / ".lacuna") == Path.home() / ".lacuna"
    if not live:
        _IPAD["v"] = _IPAD["v"] or {"device_why": "not read from a test or a scratch home"}
    elif time.time() - _IPAD["t"] > 60 and not _IPAD["busy"]:
        _IPAD["busy"] = True
        threading.Thread(target=_read_ipad, name="home-ipad", daemon=True).start()
        _IPAD["v"] = _IPAD["v"] or {"device_why": "reading the iPad"}
    wd = [{"name": w.get("name", "").removeprefix("watch."), "level": w.get("level"), "summary": (w.get("summary") or "")[:160],
           "age_s": w.get("age_s")} for w in ((h.get("watchdogs") or {}).get("qa") or []) if w.get("level") in ("warn", "error")]
    return {**_IPAD["v"], "watchdogs": wd[:6]}


def _customers_file() -> Path:
    return Path(os.environ.get("LACUNA_HOME") or Path.home() / ".lacuna") / "customers.json"


def customers(h: dict, device: dict) -> list[dict]:
    """TELEMETRY's list: the customer accounts, from data — ~/.lacuna/customers.json ([{id, label, api}]) when it is
    there, else one per customer-side API the health read knows (every API but dev), labeled by that API. Each carries
    its server's health and, for the one the device serves, the device read."""
    apis = h.get("apis") or {}
    try:
        rows = [r for r in json.loads(_customers_file().read_text()) if isinstance(r, dict) and r.get("id")]
    except (OSError, ValueError, TypeError):
        rows = [{"id": k, "label": (v.get("label") or k), "api": k} for k, v in apis.items() if k != "dev"]
    out = []
    for r in rows:
        a = apis.get(r.get("api") or r["id"]) or {}
        hz = a.get("healthz") or {}
        out.append({"id": r["id"], "label": r.get("label") or r["id"], "api": r.get("api") or r["id"], "up": a.get("up"),
                    "version": hz.get("version"), "sha": hz.get("sha"), "error": a.get("error"),
                    "device": device if (r.get("api") or r["id"]) == "qa" else {}})
    return out


def snapshot() -> dict:
    handbook.ensure()                        # the handbook's slat follows its .md (a stat, unless it changed)
    h = health.snapshot()
    try:
        ws = _foreman().workers(include_done=True)[:12]
    except Exception:  # noqa: BLE001 — the home stands without the workers
        ws = []
    return {
        "t": time.time(),
        "disk": h.get("disk"), "memory": h.get("memory"), "swap": _safe(health.swap, {"total_mb": 0, "used_mb": 0}),
        "apis": {k: {"label": v.get("label"), "up": v.get("up"), "port": v.get("port"),
                     "version": (v.get("healthz") or {}).get("version"), "sha": (v.get("healthz") or {}).get("sha"),
                     "error": v.get("error")} for k, v in (h.get("apis") or {}).items()},
        "brain": _loaded(),
        "alerts": ([a for a in alerts(30) if not a.get("acked")] + notices.unread())[:8],
        "workers": ws,
        "reports": reports.runs(10),
        "record": reports.record_words(),
        "usage": tell.usage(),
        "mode": mode.get(),
        "limits": tell.limits(),
        "skills": len(skills.list_skills()),
        "standing": STANDING,
        "ipad": (dev := ipad(h)),
        "telemetry": {"customers": customers(h, dev)},
        "caliper": _safe(caliper.summary, {"reports": [], "acts": [], "scenarios": []}),
        "agents": _safe(home_cards.agents, {"state": "benching", "rows": [], "running": {"reported": False, "names": []}}),
        "exam": _safe(home_cards.exam, {"present": False, "items": []}),
        "forge": _safe(forge.summary, {"present": False, "specialists": [], "now": "the forge could not be read"}),
    }


def _safe(fn, empty: dict) -> dict:
    try:
        return fn()
    except Exception as e:  # noqa: BLE001 — a half-written file never takes the home down
        return {**empty, "why": e.__class__.__name__}


def series(names: list[str], hours: float = 6, points: int = 240) -> dict:
    out = {}
    for n in names:
        rows = _series(n, hours)
        step = max(1, len(rows) // points)
        out[n] = [[r["t"], r["v"]] for r in rows[::step]]
    return out


def desk_map() -> dict:
    """The desk map (apps → rooms → actions, the connectors, the nav ops), as the desk's build wrote it."""
    try:
        return json.loads(DESK_MAP.read_text())
    except (OSError, ValueError):
        return {"version": 0, "apps": [{"id": a, "n": i + 1} for i, a in enumerate(STANDING)], "connectors": [],
                "ops": {k: {"args": list(v)} for k, v in NAV_OPS.items()}, "why": "the desk is not built (npm run build in lacuna-home)"}


# THE LINK (the owner, 09:10: the phone linked to the Studio; driving the big screen is its first use): two builds of one desk — the big screen (watch, work) and the phone (mostly talking).
# Each desk says what it is on every board read (?screen=big|phone); a nav op names the screen that follows it.
_SCREENS: dict[str, float] = {}
SCREEN_FRESH_S = 30


def seen_screen(role: str | None) -> None:
    if role in ("big", "phone"):
        _SCREENS[role] = time.time()


def screens() -> dict:
    now = time.time()
    return {r: round(now - t) for r, t in _SCREENS.items() if now - t < SCREEN_FRESH_S}


def screen_for(op: dict, who: str) -> str:
    """the screen a nav op is for: as named; Lacuna's own "let me show you" goes to the big screen when one is up (else
    the phone); anything else, every screen"""
    s = op.get("screen")
    if s in ("big", "phone", "all"):
        return s
    if who == "lacuna":
        return "big" if "big" in screens() else "phone"
    return "all"


def keep_scenario(sc: dict) -> dict:
    """One of Lacuna's desk moves as its Caliper hand played it (Caliper's scenario shape: {name, target, viewport,
    steps:[{kind, args, label, ok}], ok}), appended to ~/lacuna-world/artifacts/desk/<date>.scenario.json — replayable."""
    if not isinstance(sc, dict) or not isinstance(sc.get("steps"), list):
        return {"ok": False, "why": "a scenario is {name, steps:[…]}"}
    d = home_cards.world() / "artifacts" / "desk"
    d.mkdir(parents=True, exist_ok=True)
    f = d / f"{time.strftime('%Y-%m-%d')}.scenario.json"
    with _LOCK:
        try:
            rows = json.loads(f.read_text())
        except (OSError, ValueError):
            rows = []
        rows.append({"name": str(sc.get("name") or "desk")[:120], "target": sc.get("target") or "/home/", "viewport": sc.get("viewport"),
                     "steps": sc["steps"][:160], "ok": bool(sc.get("ok")), "at": sc.get("at") or time.time()})
        f.write_text(json.dumps(rows[-500:], ensure_ascii=False, indent=1))
    return {"ok": True, "file": str(f), "n": len(rows)}


def _nav_refused(kind: str, op: dict) -> str | None:
    apps = set(STANDING)
    if kind in ("open-app", "slide", "point-at") and op.get("app") not in apps:
        return f"no app {op.get('app')!r} on the desk"
    if kind == "slide" and not str(op.get("panel") or "").strip():
        return "slide needs a panel (action:<key> | room:<key> | result)"
    if kind in ("thoughts", "talk", "interrupt") and not str(op.get("worker") or "").strip():
        return f"{kind} needs a worker"
    if kind == "talk" and not str(op.get("text") or "").strip():
        return "talk needs text"
    if kind == "interrupt" and op.get("mode") not in ("pause", "resume", "stop"):
        return "interrupt mode is pause | resume | stop"
    if kind == "side-by-side" and (op.get("a") not in apps or op.get("b") not in apps or op.get("a") == op.get("b")):
        return "side-by-side needs two different apps"
    return None


def board() -> dict:
    try:
        return json.loads(_board_file().read_text())
    except (OSError, ValueError):
        return {"cards": [], "said": [], "focus": None, "rev": 0}


def act(op: dict, who: str = "lacuna") -> dict:
    """One change to the board. Returns the board."""
    with _LOCK:
        b = board()
        cards = b["cards"]
        kind = op.get("op")
        if kind == "place":
            cid = op.get("id") or f"l{int(time.time() * 1000) % 10_000_000}"
            card = {"id": cid, "kind": op.get("kind") or (op.get("block") or {}).get("kind") or "note",
                    "title": op.get("title") or "", "block": op.get("block") or {}, "w": int(op.get("w") or 420),
                    "h": int(op.get("h") or 280), "links": op.get("links") or [], "by": who, "at": time.time()}
            cards[:] = [c for c in cards if c["id"] != cid] + [card]
            del cards[:-MAX_CARDS]
            if op.get("focus", True):
                b["focus"], b["focus_at"] = cid, time.time()
        elif kind == "move":                      # "move that card next to that one": order is the packer's input
            me = next((c for c in cards if c["id"] == op.get("id")), None)
            if me:
                cards.remove(me)
                at = next((i for i, c in enumerate(cards) if c["id"] == op.get("near")), len(cards) - 1)
                cards.insert(at + 1, me)
        elif kind == "remove":
            cards[:] = [c for c in cards if c["id"] != op.get("id")]
        elif kind == "focus":
            b["focus"] = op.get("id")
            b["focus_at"] = time.time()           # a page opened soon after still gets the eye (the forge's "open it for me")
        elif kind == "say":
            b["said"] = (b.get("said") or [])[-5:] + [str(op.get("text") or "")[:400]]
            # who said it, for the desk's presence badge (Lacuna, Claude, or a person); a say may carry an ask (a card id)
            b["voices"] = (b.get("voices") or [])[-7:] + [{"by": who, "text": str(op.get("text") or "")[:400], "at": time.time(),
                                                           **({"ask": str(op["ask"])[:40]} if op.get("ask") else {})}]
        elif kind in NAV_OPS:
            bad = _nav_refused(kind, op)
            if bad:
                return {**b, "refused": bad}
            b["nav"] = {"op": kind, **{k: op[k] for k in NAV_OPS[kind] if op.get(k) not in (None, "")}, "screen": screen_for(op, who),
                        "seq": int((b.get("nav") or {}).get("seq") or 0) + 1, "at": time.time(), "by": who}
        elif kind == "clear":
            cards.clear()
            b["focus"] = None
        b.setdefault("presence", {})[str(who or "?")[:24]] = time.time()      # who is at the desk: the last act of each
        b["rev"] = int(b.get("rev") or 0) + 1
        _board_file().write_text(json.dumps(b, ensure_ascii=False))
        return b
