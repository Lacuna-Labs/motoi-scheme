"""PLANS — Lacuna hands a big job to Cloud Lacuna, keeps talking, and is told when the plan is back (the owner, 2026-10-19:
"it says 'one sec, handing this to the cloud', it can continue talking to us, we can see what the cloud one is thinking as it's
planning, and when it comes back it tells us first — two turns: an update, then it does the work").

  start(goal, context, who)   begins at once and returns {plan_id}; the planning runs in a thread
  the thread                  builds the packet (who Lacuna is, its tools, the brief for the goal — playbooks, the things the
                              goal names, memory; any line naming customer data is DROPPED), then streams cloud.ask_stream
                              (Gemma 4 31B first, Gemini Flash as the fallback) and writes every thought and word to
                              ~/lacuna-world/plans/<id>.json as it comes — the Agents screen shows it live
  when the plan lands         it is kept as the note plan-<id> and a cortex fact, and it is a chip on the desk (the inbox, the
                              floor's `alert.raise`, the telemetry card): its BLUF and its note, red when it failed; never a
                              turn (order §1.13a and the lead's ruling, 2026-11-06: the `[foreman:plan]` turns reached the
                              owner's conversation log). The owner begins it at the desk ("begin plan p-…").

  POST /api/plans             a plan begun; its reads, GET /api/plans and /api/plans/<id>, are the door's
                              (lacuna-node/frontend/plans-read.mjs, 2026-11-06, lane python-out-2)
"""
from __future__ import annotations

import json
import re
import threading
import time
from pathlib import Path

from fastapi import APIRouter

from .core import audit

DIR = Path.home() / "lacuna-world" / "plans"
router = APIRouter()
_lock = threading.Lock()
PACKET_CHARS = 36_000          # ~9k tokens: under Gemma's ~15,000-tokens-a-minute free-tier line


def _file(pid: str) -> Path:
    return DIR / f"{re.sub(r'[^a-z0-9-]', '', pid)}.json"


def _save(rec: dict) -> None:
    DIR.mkdir(parents=True, exist_ok=True)
    with _lock:
        _file(rec["id"]).write_text(json.dumps(rec, ensure_ascii=False))


def get(pid: str) -> dict | None:
    try:
        return json.loads(_file(pid).read_text())
    except (OSError, ValueError):
        return None


def listing(n: int = 20) -> list[dict]:
    DIR.mkdir(parents=True, exist_ok=True)
    out = []
    for p in sorted(DIR.glob("*.json"), key=lambda p: -p.stat().st_mtime)[:n]:
        try:
            out.append(json.loads(p.read_text()))
        except ValueError:
            pass
    return out


HEAD = ("You are Cloud Lacuna, the planner for Lacuna: a Gemma 4 26B agent on a 32 GB Mac Studio that keeps a shop app's "
        "servers and its automation carts (.sks, keyword-tagged S-expressions) working in dev and QA, and trains its own small "
        "Gemma minds. Lacuna does the work with the tools listed; you plan it. Answer in this order: QUESTIONS (only if the "
        "goal is ambiguous — the exact question for the owner, with 2-3 options), BLUF (one line starting `BLUF:`), STEPS (a "
        "numbered list: Do — the tool and its arguments · Expect — the evidence · If not — the next move), RISKS, VERIFY. "
        "Use the playbooks you are given; never invent tools or paths. Releases, QA restarts and merges into main are the "
        "owner's press: plan up to the card. Be concrete and short.")


def _packet(goal: str, context: str) -> str:
    from . import brief, chat, cloud, self_portrait
    parts = []
    try:
        parts.append("WHO LACUNA IS:\n" + self_portrait.head(max_age=6 * 3600)[:4000])
    except Exception:  # noqa: BLE001
        pass
    parts.append("LACUNA'S TOOLS: " + ", ".join(sorted(chat.TOOLS)))
    try:
        parts.append("THE BRIEF FOR THIS GOAL (playbooks, the things it names, memory):\n" + brief.build(goal)[:14000])
    except Exception:  # noqa: BLE001
        pass
    if context:
        parts.append("LACUNA ADDS:\n" + str(context)[:6000])
    kept = [ln for ln in "\n\n".join(parts).splitlines() if not cloud.CUSTOMER.search(ln)]    # customer words never leave the box
    return "\n".join(kept)[:PACKET_CHARS]


def _bluf(text: str) -> str:
    m = re.search(r"BLUF:?\**\s*(.+)", text)
    return (m.group(1) if m else text.strip().splitlines()[0] if text.strip() else "")[:300]


def start(goal: str, context: str, who: str) -> dict:
    from . import cloud
    goal = " ".join(str(goal or "").split())
    if not goal:
        return {"ok": False, "why": "name the goal"}
    if cloud.CUSTOMER.search(goal):
        return {"ok": False, "why": "the goal names customer data; say it without names, addresses or order ids"}
    pid = f"p-{int(time.time()) % 10_000_000}"
    rec = {"id": pid, "goal": goal[:400], "state": "planning", "by": who, "started": time.time(), "model": None,
           "thinking": "", "text": "", "tried": []}
    _save(rec)
    audit(who, "plan.start", plan=pid, goal=goal[:200])
    threading.Thread(target=_run, args=(rec, context), name=f"plan-{pid}", daemon=True).start()
    return {"ok": True, "plan_id": pid, "said": "Cloud Lacuna is planning it. Tell the owner in one line, keep talking, and he can watch "
            "it think in Agents → every mind, live → plans. When it lands it is a chip on his desk, and he says when to begin."}


def _run(rec: dict, context: str) -> None:
    from . import cloud
    last = [0.0]

    def on(ev: dict) -> None:
        rec["model"] = ev.get("model") or rec["model"]
        rec["thinking" if ev["type"] == "thought" else "text"] += ev["text"]
        if time.time() - last[0] > 1.0:
            last[0] = time.time()
            _save(rec)

    try:
        r = cloud.ask_stream("plan", HEAD, f"GOAL: {rec['goal']}\n\n{_packet(rec['goal'], context)}", on)
    except Exception as e:  # noqa: BLE001 — a plan that crashed says so; it never leaves the screen on "thinking"
        r = {"ok": False, "why": f"{e.__class__.__name__}: {e}"}
    rec.update(state="done" if r.get("ok") and rec["text"].strip() else "failed", ended=time.time(), model=r.get("model") or rec["model"],
               tried=r.get("tried") or [], why=r.get("why") if not r.get("ok") else None)
    _save(rec)
    audit(rec["by"], "plan.end", plan=rec["id"], ok=rec["state"] == "done", model=rec["model"])
    try:
        _land(rec)
    except Exception as e:  # noqa: BLE001
        audit("lacuna", "plan.land.failed", plan=rec["id"], why=str(e)[:160])


def _land(rec: dict) -> None:
    from . import chat, lacuna_cortex
    from .workers import raise_alert
    pid, goal = rec["id"], rec["goal"]
    if rec["state"] == "failed":
        raise_alert(f"work:plan-{pid}", "error", f"plan {pid} failed", f"The cloud plan for \"{goal}\" could not be made: {rec.get('why')}.",
                    notify=False)
        return
    chat.notes({"op": "write", "topic": f"plan-{pid}", "text": f"GOAL: {goal}\n\n{rec['text']}"}, "lacuna")
    lacuna_cortex.remember("fact", f"plan-{pid}", {"text": f"plan for {goal}: {_bluf(rec['text'])}", "note": f"plan-{pid}", "model": rec["model"]},
                           ["thing/plans"])
    raise_alert(f"work:plan-{pid}", "done", f"plan {pid} is back", f"Cloud Lacuna's plan for \"{goal}\" (note plan-{pid}, made by "
                f"{rec['model']}). BLUF: {_bluf(rec['text'])}", notify=False)


@router.post("/api/plans")
def r_start(body: dict) -> dict:
    """The owner (or the desk) asks for a plan directly: {goal, context?}."""
    return start(str((body or {}).get("goal") or ""), str((body or {}).get("context") or ""), "alfred")
