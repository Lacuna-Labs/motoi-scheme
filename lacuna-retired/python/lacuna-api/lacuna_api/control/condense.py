"""THE CONVERSATION, CONDENSED INTO THE CORTEX (the owner, 2026-10-19: "give it a place to compress and condense convos in the
cortex and grab parts of it and related material").

The talk since the last condensing is folded into ONE `summary` node — what was talked about, what was decided, what is open,
the facts that came up, its time span — keyed `convo-<date>-<HHMM>`, linked `about` each topic, so `cortex recall` finds the
summary AND its neighbors (`cortex like summary/<key>`) bring the related material; `recall` (the words) and the time span
bring the exact turns back. Run every hour by the workers' pass, and on demand by the chat's `condense` tool.
"""
from __future__ import annotations

import json
import time

from .core import LACUNA_HOME, audit

MARK = LACUNA_HOME / "condensed.json"
MIN_TURNS = 4


def _since() -> float:
    try:
        return float(json.loads(MARK.read_text()).get("t") or 0)
    except Exception:  # noqa: BLE001
        return 0.0


def condense(force: bool = False) -> dict:
    from . import lacuna_cortex, memory, task_runner
    memory._load()
    t0 = _since() or (time.time() - 6 * 3600)
    turns = [t for t in memory._turns if float(t.get("t") or 0) > t0 and not str(t.get("session") or "").startswith("eval:")]
    if len(turns) < (1 if force else MIN_TURNS):
        return {"ok": True, "condensed": 0, "said": f"only {len(turns)} turn(s) since the last condensing"}
    text = "\n".join(f"{time.strftime('%H:%M', time.localtime(t['t']))} {'OWNER' if t['role'] == 'user' else 'LACUNA'}: "
                     f"{str(t.get('content') or '').split(chr(10) + chr(10) + '(asked from', 1)[0][:600]}" for t in turns[-120:])
    if hasattr(__import__(__package__ + ".modelwatch", fromlist=["_busy"]), "_busy") and \
            __import__(__package__ + ".modelwatch", fromlist=["_busy"])._busy() and not force:
        return {"ok": True, "condensed": 0, "said": "the brain is working; condensing next hour"}
    try:
        out = task_runner._brain_json(
        "Condense this stretch of conversation between the owner and you (Lacuna) into your long memory. Be concrete: names, "
        "numbers, files, carts. Topics are 2-6 short lowercase names of the things discussed.\n\n" + text[-12000:],
        {"type": "object", "required": ["summary", "topics", "decided", "open", "facts"], "properties": {
            "summary": {"type": "string"}, "topics": {"type": "array", "items": {"type": "string"}, "maxItems": 6},
            "decided": {"type": "array", "items": {"type": "string"}, "maxItems": 8},
            "open": {"type": "array", "items": {"type": "string"}, "maxItems": 8},
            "facts": {"type": "array", "items": {"type": "string"}, "maxItems": 8}}},
        "condense", "condensed")
    except Exception as e:  # noqa: BLE001 — a busy or slow brain: nothing is lost, the turns wait for the next hour
        return {"ok": False, "condensed": 0, "said": f"the brain did not answer ({e.__class__.__name__}); the talk waits for the next hour"}
    a, b = turns[0]["t"], turns[-1]["t"]
    key = f"convo-{time.strftime('%Y%m%d-%H%M', time.localtime(b))}"
    topics = [str(x).strip().lower()[:40] for x in (out.get("topics") or []) if str(x).strip()][:6]
    props = {"text": str(out.get("summary") or "")[:2000], "decided": out.get("decided") or [], "open": out.get("open") or [],
             "facts": out.get("facts") or [], "from": time.strftime("%Y-%m-%dT%H:%M", time.localtime(a)),
             "to": time.strftime("%Y-%m-%dT%H:%M", time.localtime(b)), "turns": len(turns)}
    r = lacuna_cortex.remember("summary", key, props, [f"thing/{t}" for t in topics])
    MARK.write_text(json.dumps({"t": b, "key": key}))
    audit("lacuna", "convo.condensed", key=key, turns=len(turns), topics=topics)
    return {"ok": bool(r.get("ok")), "key": f"summary/{key}", "turns": len(turns), "topics": topics, "summary": props["text"][:400]}
