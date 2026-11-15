"""TALKABLE WORKERS, from Lacuna's side (the owner, 2026-10-18: "Any spawned agent, I can talk to it … I can interrupt
one of them, and Lacuna knows what I'm doing").

The foreman keeps the tree, each worker's thought ring, and answers a talk (lacuna-foreman/talk.mjs). Here:

  tree()        the desk's tree: every worker as a node, and the foreman's last 200 events
  thoughts()    one worker's ring, newest last
  talk()        the owner's words go DOWN as a signed (talk …) message (slatwire); the reply comes back {reply, by}
  interrupt()   pause | resume | stop | park — not owner-signed (stopping our own bot is safe), but every one is audited with who

LACUNA KNOWS: every talk and interrupt is audited (audit.jsonl) and kept in owner-acts.jsonl; Lacuna's next chat turn
carries the ones it has not seen yet as one information line (take_note, called from chat._ask).
"""
from __future__ import annotations

import json
import os
import re
import time
from pathlib import Path

from . import core

MODES = ("pause", "resume", "stop", "park")   # park (lane F2): a pausable job checkpoints and exits; the broker decides
_ID = re.compile(r"^[A-Za-z0-9_-]{1,40}$")
KEEP_S, NOTE_LINES = 6 * 3600, 6


def _home() -> Path:
    return Path(os.environ.get("LACUNA_HOME") or core.LACUNA_HOME)


def _acts() -> Path:
    return _home() / "owner-acts.jsonl"


def valid_id(wid: str) -> bool:
    return bool(_ID.match(str(wid or "")))


def tree() -> dict:
    from . import foreman
    r = foreman.call("GET", "/tree")
    if not r.get("ok"):
        return {"nodes": [], "events": [], "why": r.get("why") or "the foreman did not answer"}
    return {"nodes": r.get("nodes") or [], "events": (r.get("events") or [])[-200:]}


def thoughts(wid: str, n: int = 50) -> dict:
    from . import foreman
    n = max(1, min(200, int(n or 50)))
    r = foreman.call("GET", f"/workers/{wid}/thoughts?n={n}")
    if not r.get("ok"):
        return {"items": [], "why": r.get("why") or "the foreman did not answer"}
    return {"items": r.get("items") or []}


def _name(wid: str) -> str:
    for nd in tree()["nodes"]:
        if nd.get("id") == wid:
            return str(nd.get("name") or wid)
    return wid


def talk(wid: str, text: str, who: str) -> dict:
    """The owner's words to one worker → {ok, reply, by} (or {ok: False, why})."""
    from . import foreman, slatwire
    text = str(text or "").strip()[:1000]
    if not text:
        return {"ok": False, "why": "say something"}
    env = slatwire.seal(foreman._token(), "lacuna", wid, "talk", {"text": text, "who": who})
    r = foreman.call("POST", f"/workers/{wid}/talk", env, timeout=120)
    if not r.get("ok"):
        core.audit(who, "foreman.talk-failed", worker=wid, text=text[:300], why=str(r.get("why"))[:200])
        return {"ok": False, "why": r.get("why") or "the foreman did not answer"}
    reply, by = str(r.get("reply") or ""), str(r.get("by") or "program")
    name = _name(wid)
    core.audit(who, "foreman.talk", worker=wid, name=name, text=text[:500], reply=reply[:500], by=by)
    _remember(who, "talked to", name, f"“{text[:200]}” — it answered: {reply[:200]}")
    return {"ok": True, "reply": reply, "by": by}


def interrupt(wid: str, mode: str, who: str) -> dict:
    from . import foreman
    if mode not in MODES:
        return {"ok": False, "why": f"mode is one of {', '.join(MODES)}"}
    name = _name(wid)
    r = foreman.call("POST", f"/workers/{wid}/interrupt", {"mode": mode, "by": who})
    core.audit(who, f"foreman.{mode}", worker=wid, name=name, ok=bool(r.get("ok")), ids=r.get("ids"), why=r.get("why"))
    if not r.get("ok"):
        return {"ok": False, "why": r.get("why") or "the foreman did not answer"}
    kids = len(r.get("ids") or []) - 1
    _remember(who, {"pause": "paused", "resume": "resumed", "stop": "stopped", "park": "parked"}[mode], name,
              f"with its {kids} child worker{'s' if kids > 1 else ''}" if kids > 0 else "")
    return {"ok": True, "mode": mode, "ids": r.get("ids") or []}


# ── what Lacuna's chat sees next turn ─────────────────────────────────────────────────────────────────────────────
def _remember(who: str, did: str, name: str, words: str) -> None:
    person = "the owner" if who in ("alfred", "owner") else who
    line = f"{person} {did} {name}" + (f": {words}" if words else "")
    try:
        _acts().parent.mkdir(parents=True, exist_ok=True)
        with _acts().open("a") as f:
            f.write(json.dumps({"t": time.time(), "line": line}, ensure_ascii=False) + "\n")
    except OSError:
        pass


def recent(limit: int = 20) -> list[dict]:
    try:
        rows = [json.loads(x) for x in _acts().read_text().splitlines()[-limit:] if x.strip()]
    except (OSError, ValueError):
        return []
    return rows


def take_note() -> str:
    """The owner's acts on workers that Lacuna's chat has not seen yet, as one line; marks them seen."""
    seen_file = _home() / "owner-acts.seen"
    try:
        seen = float(seen_file.read_text().strip() or 0)
    except (OSError, ValueError):
        seen = 0.0
    now = time.time()
    rows = [r for r in recent(50) if r.get("t", 0) > seen and now - r.get("t", 0) < KEEP_S]
    if not rows:
        return ""
    try:
        seen_file.write_text(str(rows[-1]["t"]))
    except OSError:
        pass
    return "; ".join(r["line"] for r in rows[-NOTE_LINES:])
