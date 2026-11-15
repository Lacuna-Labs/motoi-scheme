"""THE TASKS CLAUDE LEFT (the owner, 2026-10-19: "what task did Claude give you? … ready to start on one? … when it's done,
it sends a notification … it can mark it as finished"). The list lives in ~/lacuna-world/tasks/from-claude.json; each
task names HOW it runs (a cart, or an exam item's worker). Its state is kept beside it (from-claude.state.json):
queued → started (card filed, or answered by a work order) → finished / stopped, read from the task's own newest
run (artifacts); a finished or stopped task raises a notice on the desk once, with its words.

  tasks()             every task with its state and note (the hand / the chat tool `claude_tasks`)
  start(id, who)      starts it: the cart's card or the exam item's job card (a work order answers it at once)
  mark(id, state, note)  Lacuna (or the owner) marks it by hand: finished · stopped · queued
"""
from __future__ import annotations

import json
import time
from pathlib import Path

LIST = Path.home() / "lacuna-world" / "tasks" / "from-claude.json"
STATE = LIST.with_name("from-claude.state.json")


def _load() -> tuple[dict, dict]:
    try:
        lst = json.loads(LIST.read_text())
    except (OSError, ValueError):
        lst = {"tasks": []}
    try:
        st = json.loads(STATE.read_text())
    except (OSError, ValueError):
        st = {}
    return lst, st


def _save(st: dict) -> None:
    STATE.write_text(json.dumps(st, indent=1))


def _follow(t: dict, s: dict) -> None:
    """a started task becomes finished or stopped when its own newest run (after it started) says so"""
    if s.get("state") != "started":
        return
    from . import artifacts
    key = t["how"].get("cart") or f"exam-{t['how'].get('exam')}"
    a = artifacts.latest(key)
    if not a:
        return
    from .cartview import parse_artifact
    r = parse_artifact(a.get("text") or "")
    started = str((r.get("run") or {}).get("started") or "")
    if started and started >= time.strftime("%Y-%m-%dT%H:%M:%S", time.localtime(s.get("t", 0))):
        oc = r.get("outcome") or {}
        if oc.get("is"):
            s["state"] = "finished" if oc["is"] == "done" else "stopped"
            s["note"] = str(oc.get("reason") or "")[:300]
            s["ended"] = time.time()
            try:
                from . import workers
                workers.raise_alert(f"claude-task:{t['id']}:end", "done" if s["state"] == "finished" else "warn",
                                    f"Lacuna {s['state']} {t['id']}: {t['title']}", s["note"], notify=True)
            except Exception:  # noqa: BLE001
                pass


def tasks() -> dict:
    lst, st = _load()
    out = []
    items = None                                       # Work, read once and only when a task is running
    for t in lst.get("tasks") or []:
        s = st.setdefault(t["id"], {"state": "queued"})
        _follow(t, s)
        live = None
        if s.get("state") == "started":                # what it is doing this minute: its worker's line, from Work
            key = t["how"].get("cart") or f"exam {t['how'].get('exam')}"
            if items is None:
                try:
                    from . import work
                    items = work.work()["items"]
                except Exception:  # noqa: BLE001 — the list still reads without its live lines
                    items = []
            it = next((x for x in items if key == x.get("title") or key in str(x.get("why") or "") or key in str(x.get("id") or "")), None)
            if it:
                step = next((x["name"] for x in it.get("steps") or [] if x["state"] == "now"), it["state"])
                raw = str(it.get("now") or "")                 # the worker's last line, when it is words and not a payload
                now = f"{step}: {raw}" if raw and "{" not in raw and raw != step else step
                live = {"id": it["id"], "now": str(now)[:140], "waiting": it.get("waiting"), "state": it["state"]}
        out.append({**t, **s, "live": live})
    _save(st)
    return {"given_by": lst.get("given_by"), "note": lst.get("note"), "tasks": out,
            "left": sum(1 for x in out if x["state"] == "queued")}


def start(tid: str, who: str) -> dict:
    lst, st = _load()
    t = next((x for x in lst.get("tasks") or [] if x["id"] == tid), None)
    if not t:
        return {"ok": False, "why": f"no task {tid}"}
    from . import carts
    if t["how"].get("cart"):
        r = carts.start_named(t["how"]["cart"], who, False, f"{tid}: {t['title']} (a task Claude left)")
    else:
        from . import home_cards
        it = next((i for i in home_cards.exam().get("items") or [] if i["id"] == t["how"]["exam"]), {"title": t["title"]})
        r = carts.start_job(t["how"]["exam"], it, who)
    prev = st.get(tid) or {}
    again = prev.get("state") in ("started", "stopped")          # a restart is remembered, and said
    st[tid] = {"state": "started", "t": time.time(), "card": r.get("petition"), "restarts": int(prev.get("restarts") or 0) + (1 if again else 0),
               "note": (f"restarted by {who} at {time.strftime('%H:%M')} — " if again else "") + str(r.get("state") or r.get("why") or "")}
    _save(st)
    try:
        from . import workers
        workers.raise_alert(f"claude-task:{tid}:start", "start", f"Lacuna started {tid}: {t['title']}",
                            f"{t['title']} — watch it on the Agents screen. {st[tid]['note']}"[:300], notify=False)
    except Exception:  # noqa: BLE001
        pass
    return {"ok": bool(r.get("petition") or r.get("ok")), "task": tid, **{k: r[k] for k in ("petition", "state", "why") if k in r}}


def mark(tid: str, state: str, note: str = "") -> dict:
    if state not in ("finished", "stopped", "queued"):
        return {"ok": False, "why": "finished · stopped · queued"}
    _lst, st = _load()
    st[tid] = {**st.get(tid, {}), "state": state, "note": note[:300], "ended": time.time()}
    _save(st)
    return {"ok": True, "said": f"{tid} marked {state}"}
