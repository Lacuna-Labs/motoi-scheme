"""COMMITMENTS — what Lacuna said it would do, remembered (2026-10-22).

A promise is a write, not a hope. When a turn ends on "I'll do X", it lands here, rides the next turn's prompt at the
bottom, and resolves when a later turn claims it done. Small on purpose: a few open promises, deduped, so the model is
anchored by what it actually committed to — never a ledger that runs away.
"""
from __future__ import annotations

import json
import re
import time

from .core import LACUNA_HOME, audit

FILE = LACUNA_HOME / "commitments.jsonl"
_SENT = re.compile(r"[.!?]\s+")


def _read() -> list[dict]:
    out = []
    try:
        for line in FILE.read_text().splitlines():
            try:
                out.append(json.loads(line))
            except ValueError:
                pass
    except OSError:
        pass
    return out


def _norm(s: str) -> str:
    return re.sub(r"\W+", " ", str(s)).lower().strip()


def record(text: str, by: str = "lacuna") -> dict | None:
    line = _SENT.split(str(text).strip(), 1)[0][:200].strip()
    if not line or not re.search(r"\bi'?ll\b|\bI will\b|next|then|when you'?re ready|tomorrow", line, re.I):
        return None
    key = _norm(line)
    rows = _read()
    if any(_norm(r.get("text") or "") == key and r.get("status") == "open" for r in rows):
        return None                                   # said it already; never double-list
    n = {"id": str(int(time.time() * 1000)), "text": line, "at": time.time(), "by": by, "status": "open"}
    with FILE.open("a") as f:
        f.write(json.dumps(n) + "\n")
    audit("lacuna", "commit", text=line[:120])
    return n


def open_items(limit: int = 4) -> list[dict]:
    return [r for r in _read() if r.get("status") == "open"][-limit:][::-1]


def lines(limit: int = 4) -> list[str]:
    return [r["text"] for r in open_items(limit)]


def resolve(text: str) -> int:
    """A turn claimed it did something: close the open commitments whose words it names (coarse, but honest)."""
    norm = _norm(text)
    if not norm:
        return 0
    rows, n, changed = _read(), 0, False
    for r in rows:
        if r.get("status") != "open":
            continue
        words = [w for w in _norm(r.get("text") or "").split() if len(w) > 2]
        if len(words) >= 2 and any(f"{words[i]} {words[i + 1]}" in norm for i in range(len(words) - 1)):
            r["status"], r["done_at"], n, changed = "done", time.time(), n + 1, True
    if changed:
        FILE.write_text("\n".join(json.dumps(r) for r in rows) + "\n")
    return n
