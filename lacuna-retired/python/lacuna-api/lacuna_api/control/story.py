"""WHO I AM, WHAT I DID, WHAT I AM DOING, WHAT THEY ASK (the owner, 2026-10-19: "a personality comes from remembering things
from yesterday. who was I? what have I done? what am I doing? what are they asking. make it sharper there — as sharp as a
tack in remembering and becoming").

Every turn carries this block, built from the record and never from the model's guess:
  WHO       one line: what Lacuna is on this box
  YESTERDAY · TODAY   the journal's own pages for the last two days (what it wrote down as it went)
  DONE      the work queue's finished items with what each found, the releases' last outcomes
  NOW       what runs this minute (the queue's item, the working agents), and what waits on the owner
  ASKED     the owner's last asks from ANY card or the phone, with their times — so "it" and "that" resolve
Cached STORY_S, so a burst of turns reads it once. Cut to STORY_CHARS; the newest wins.
"""
from __future__ import annotations

import json
import time
from pathlib import Path

STORY_S = 90
STORY_CHARS = 6000
_cache: dict = {"t": 0.0, "text": ""}


def _journal(day: str, n: int = 1600) -> str:
    p = Path.home() / "lacuna-world" / "journal" / f"{day}.md"
    try:
        t = p.read_text(errors="replace").strip()
    except OSError:
        return ""
    return t[-n:] if len(t) > n else t


def _done() -> list[str]:
    out = []
    try:
        from . import workqueue
        items = [i for i in workqueue.load()["items"] if i.get("state") in ("done", "stopped", "failed") and i.get("ended")]
        for i in sorted(items, key=lambda x: x.get("ended") or 0)[-6:]:
            words = str(i.get("review") or i.get("note") or "").replace("\n", " ")
            out.append(f"{time.strftime('%a %H:%M', time.localtime(i['ended']))} {i['id']} {i['state']}: {i['title'][:70]} — {words[:220]}")
    except Exception:  # noqa: BLE001
        pass
    try:
        from .core import jobs
        for j in [j for j in jobs(30) if j.get("kind") in ("release", "promote", "build", "deploy") and not j.get("running")][:3]:
            out.append(f"{time.strftime('%a %H:%M', time.localtime(j.get('started') or 0))} {j['kind']} {'ok' if j.get('code') == 0 else 'stopped'}: {j['title'][:80]}")
    except Exception:  # noqa: BLE001
        pass
    return out


def _now() -> list[str]:
    out = []
    try:
        from . import workqueue
        st = workqueue.standing()
        out.append(f"work queue {'ON' if st['on'] else 'OFF'}: {st['said']}")
    except Exception:  # noqa: BLE001
        pass
    try:
        from . import agents_live
        w = agents_live.working()
        out.append(f"agents: {w['said']}" + "".join(f"; {x['what'][:60]}" for x in w["working"][:4]))
    except Exception:  # noqa: BLE001
        pass
    try:
        from . import chat
        waiting = [p for p in chat.petitions() if p.get("state") == "waiting"]
        if waiting:
            out.append(f"{len(waiting)} card(s) wait on the owner: " + "; ".join(f"{p['id']} {str(p.get('reason'))[:50]}" for p in waiting[:4]))
    except Exception:  # noqa: BLE001
        pass
    return out


def _asked(n: int = 10) -> list[str]:
    out = []
    try:
        from . import memory
        memory._load()
        turns = [t for t in memory._turns if t.get("role") == "user"][-n:]
        for t in turns:
            words = str(t.get("content") or "")
            words = words.split("] ", 1)[-1] if words.startswith("[") else words
            words = words.split("\n\n(asked from", 1)[0].replace("\n", " ").strip()   # the desk's stock tail is not the ask
            out.append(f"{time.strftime('%a %H:%M', time.localtime(t.get('t') or 0))} ({str(t.get('session') or 'chat').replace('card:', '')}): {words[:160]}")
    except Exception:  # noqa: BLE001
        pass
    return out


def block() -> str:
    """The <you> block for this turn (cached STORY_S)."""
    if time.time() - _cache["t"] < STORY_S and _cache["text"]:
        return _cache["text"]
    today = time.strftime("%Y-%m-%d")
    yday = time.strftime("%Y-%m-%d", time.localtime(time.time() - 86400))
    parts = ["WHO: Lacuna — the Studio's own agent (the 26B on this Mac), with Cloud Lacuna as a thinking partner and Claude as "
             "a teammate; you run workers (dumb and smart), foremen and the work queue, and you keep a journal."]
    for label, day in (("YESTERDAY", yday), ("TODAY", today)):
        j = _journal(day)
        if j:
            parts.append(f"{label} ({day}), your journal:\n{j}")
    d = _done()
    if d:
        parts.append("WHAT YOU HAVE DONE (newest last):\n" + "\n".join(f"- {x}" for x in d))
    nw = _now()
    if nw:
        parts.append("WHAT YOU ARE DOING NOW:\n" + "\n".join(f"- {x}" for x in nw))
    a = _asked()
    if a:
        parts.append("WHAT THE OWNER ASKED LATELY (any card, oldest first — 'it' and 'that' usually mean the newest):\n" + "\n".join(f"- {x}" for x in a))
    text = "\n\n".join(parts)
    if len(text) > STORY_CHARS:
        text = text[-STORY_CHARS:]
    _cache.update(t=time.time(), text=text)
    return text
