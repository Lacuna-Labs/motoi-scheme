"""THE MINDS' LIVE FEED (the owner, 2026-10-19: "what are they doing? for who? can I see live output and thoughts? and even
the tiny 1Bs, I want to see all of it, all of them"). Every model call through the gateway — the 26B on either slot, each
small mind — leaves one line here when it ends: who asked (the lane and the X-Lacuna-Prefix), the model, the newest
message it was handed, what it thought, what it said, the tools it called, its time and tokens. On this box only
(~/.lacuna/minds-live.jsonl, kept to the newest KEEP lines); the Agents screen reads it (GET /api/minds/live).
"""
from __future__ import annotations

import json
import os
import threading
import time

FILE = os.path.expanduser("~/.lacuna/minds-live.jsonl")
KEEP = 2000
_lock = threading.Lock()
_n = [0]


def _last_in(body: dict) -> str:
    msgs = body.get("messages") or []
    for m in reversed(msgs):
        if m.get("role") in ("user", "tool"):
            c = m.get("content")
            return (c if isinstance(c, str) else json.dumps(c))[-1200:]
    return str(body.get("prompt") or "")[-1200:]


def note(*, model: str, lane: str | None, who: str | None, slot, body: dict, said: str, thought: str = "",
         calls: list | None = None, ms: int = 0, tokens: int | None = None) -> None:
    row = {"t": round(time.time(), 1), "model": model, "slot": slot, "lane": lane, "who": who, "in": _last_in(body),
           "thought": (thought or "")[-2000:], "said": (said or "")[-2000:],
           "calls": [c.get("function", c).get("name") if isinstance(c, dict) else str(c) for c in (calls or [])][:8],
           "ms": ms, "tokens": tokens}
    try:
        with _lock:
            with open(FILE, "a") as f:
                f.write(json.dumps(row, ensure_ascii=False) + "\n")
            _n[0] += 1
            if _n[0] % 200 == 0:
                lines = open(FILE).read().splitlines()[-KEEP:]
                with open(FILE, "w") as f:
                    f.write("\n".join(lines) + "\n")
    except OSError:
        pass
