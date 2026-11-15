"""ROOMS — accounts inside a card (the owner, 2026-10-18 night; LACUNA-DESK-LAWS §1A.2): "rooms may have things already
going on, configurations already done, activities being done … one room would be release testing … if I want to do a
test, I make my own room, and a human should be able to do the same".

A card that holds ongoing work keeps its rooms in ~/lacuna-world/rooms/<card>.json:
  {rooms: [{id, name, about, made_by, made_at, items: [{id, name, kind, vars, made_by, made_at}]}]}
  an ITEM is the thing the room holds — a configured Caliper test (vars: mode, preset, target), an exam item, …
Seeded once per card: Caliper → "release testing" (test A passive, test B full — the dev web, curator-dev);
Exam → "agent development" (the E1–E10 of the exam).
Making a room or an item changes only this file (a container, no act); RUNNING an item is still its card's own path
(Caliper's run files a card — the owner's press). Rooms are searchable by name and by what they hold.

  GET  /api/rooms/{card}                      the rooms, with their items
  POST /api/rooms/{card}                      {name, about?}               → a new room
  POST /api/rooms/{card}/{room}/items         {name, kind, vars}           → a new item in the room
  GET  /api/rooms-search?q=                   rooms and items whose names or vars say q, on every card
"""
from __future__ import annotations

import json
import os
import re
import threading
import time
from pathlib import Path

from fastapi import APIRouter, HTTPException

router = APIRouter()
_lock = threading.Lock()
CARDS = {"s-caliper", "s-exam", "s-battery", "s-cicd"}

SEED = {
    "s-caliper": [{"id": "release-testing", "name": "release testing", "about": "the tests a release must pass",
                   "items": [{"id": "test-a", "name": "test A · passive", "kind": "caliper", "vars": {"mode": "passive", "preset": "curator-dev", "target": "dev web"}},
                             {"id": "test-b", "name": "test B · full", "kind": "caliper", "vars": {"mode": "full", "preset": "curator-dev", "target": "dev web"}}]}],
    "s-exam": [{"id": "agent-development", "name": "agent development", "about": "the test every agent takes",
                "items": [{"id": f"E{i}", "name": f"E{i}", "kind": "exam", "vars": {}} for i in range(1, 11)]}],
}


def _dir() -> Path:
    return Path(os.environ.get("LACUNA_WORLD") or Path.home() / "lacuna-world") / "rooms"


def _slug(name: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", str(name).lower()).strip("-")[:40] or "room"


def load(card: str) -> dict:
    p = _dir() / f"{card}.json"
    try:
        return json.loads(p.read_text())
    except (OSError, ValueError):
        now = time.time()
        d = {"rooms": [{**r, "made_by": "lacuna", "made_at": now, "items": [{**it, "made_by": "lacuna", "made_at": now} for it in r["items"]]}
                       for r in SEED.get(card, [])]}
        if d["rooms"]:
            save(card, d)
        return d


def save(card: str, d: dict) -> None:
    p = _dir() / f"{card}.json"
    p.parent.mkdir(parents=True, exist_ok=True)
    tmp = p.with_suffix(".tmp")
    tmp.write_text(json.dumps(d, indent=1))
    tmp.replace(p)


def _card(card: str) -> str:
    if card not in CARDS:
        raise HTTPException(404, f"{card} keeps no rooms")
    return card


@router.get("/api/rooms/{card}")
def r_rooms(card: str) -> dict:
    return load(_card(card))


@router.post("/api/rooms/{card}")
def r_make(card: str, body: dict) -> dict:
    from .core import audit
    name = str((body or {}).get("name") or "").strip()[:60]
    if not name:
        return {"ok": False, "why": "a room needs a name"}
    with _lock:
        d = load(_card(card))
        rid = _slug(name)
        if any(r["id"] == rid for r in d["rooms"]):
            return {"ok": False, "why": f"there is already a room {name!r}"}
        d["rooms"].append({"id": rid, "name": name, "about": str(body.get("about") or "")[:160], "made_by": "owner", "made_at": time.time(), "items": []})
        save(card, d)
    audit("owner", "room.made", card=card, room=rid)
    return {"ok": True, "room": rid}


@router.post("/api/rooms/{card}/{room}/items")
def r_item(card: str, room: str, body: dict) -> dict:
    from .core import audit
    name = str((body or {}).get("name") or "").strip()[:60]
    if not name:
        return {"ok": False, "why": "an item needs a name"}
    vars_ = body.get("vars") if isinstance(body.get("vars"), dict) else {}
    with _lock:
        d = load(_card(card))
        r = next((x for x in d["rooms"] if x["id"] == room), None)
        if not r:
            return {"ok": False, "why": f"no room {room}"}
        iid = _slug(name)
        if any(i["id"] == iid for i in r["items"]):
            return {"ok": False, "why": f"the room already holds {name!r}"}
        r["items"].append({"id": iid, "name": name, "kind": str(body.get("kind") or "item"), "vars": {str(k)[:24]: str(v)[:80] for k, v in vars_.items()},
                           "made_by": "owner", "made_at": time.time()})
        save(card, d)
    audit("owner", "room.item", card=card, room=room, item=iid)
    return {"ok": True, "item": iid}


@router.get("/api/rooms-search")
def r_search(q: str = "") -> dict:
    k = q.strip().lower()
    hits = []
    for card in sorted(CARDS):
        for r in load(card).get("rooms", []):
            if not k or k in r["name"].lower() or k in r.get("about", "").lower():
                hits.append({"card": card, "room": r["id"], "name": r["name"], "what": "room"})
            for it in r.get("items", []):
                if k and (k in it["name"].lower() or k in json.dumps(it.get("vars", {})).lower()):
                    hits.append({"card": card, "room": r["id"], "item": it["id"], "name": it["name"], "what": "item"})
    return {"hits": hits[:40]}
