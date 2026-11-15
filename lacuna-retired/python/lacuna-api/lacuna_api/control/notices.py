"""NOTICES — the messages that are not cards (the owner, 2026-10-21: "purple for 'lacuna is talking to you',
amber for warnings and notifications, red is 'there's a problem' … the button color becomes the highest level
color in the mailbox").

  post(level, text, title="", ref="")   lacuna · notice · problem
  unread(limit)                         rows the desk's inbox merges beside its alerts (key `notice:<id>`)
  ack(key)                              the desk answered it; it never comes back
"""
from __future__ import annotations

import json
import re
import time
import uuid

from .core import LACUNA_HOME, audit

FILE = LACUNA_HOME / "notices.jsonl"
LEVELS = ("lacuna", "notice", "problem")


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


def post(level: str, text: str, title: str = "", ref: str = "") -> dict:
    level = level if level in LEVELS else "notice"
    n = {"id": uuid.uuid4().hex[:10], "at": time.time(), "level": level,
         "title": (title or text)[:80], "body": str(text)[:600], "ref": ref, "acked": False}
    try:
        with FILE.open("a") as f:
            f.write(json.dumps(n) + "\n")
    except OSError:
        return n
    audit("lacuna", "notice.post", level=level, title=n["title"][:80])
    return n


def unread(limit: int = 8) -> list[dict]:
    rows = [{"key": f"notice:{n['id']}", "level": n["level"], "title": n["title"], "body": n["body"],
             "t": n["at"], "acked": False} for n in _read() if not n.get("acked")]
    return rows[-limit:][::-1]


def _sig(n: dict) -> str:
    """What makes two notices the same: the title and the message, without times, numbers or ids."""
    body = str(n.get("body") or "")
    try:
        body = str(json.loads(body).get("msg") or body)
    except (ValueError, AttributeError):
        pass
    return f"{n.get('title', '')}|" + re.sub(r"[0-9a-f]{6,}|\d+", "#", body)[:200]


def ack(key: str) -> None:
    """An ack clears the notice AND every unacked copy of it (2026-10-27: 437 copies of one fence error; each ack showed the next,
    so the owner could not clear his inbox)."""
    nid = str(key or "").removeprefix("notice:")
    rows, hit = _read(), False
    sig = next((_sig(n) for n in rows if n.get("id") == nid), None)
    for n in rows:
        if n.get("id") == nid or (sig is not None and not n.get("acked") and _sig(n) == sig):
            n["acked"], hit = True, True
    if hit:
        try:
            FILE.write_text("\n".join(json.dumps(r) for r in rows) + "\n")
        except OSError:
            pass
