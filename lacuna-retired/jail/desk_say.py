"""desk_say — a problem said on the desk in Lacuna's voice (the owner, 2026-10-18: "I want it to be able to tell me if
it has a problem"). The desk's presence badge shows the line beside the push. Never raises."""
from __future__ import annotations

import json
import urllib.request


def say(words: str, log=print) -> None:
    body = json.dumps({"op": "say", "text": words[:400]}).encode()
    req = urllib.request.Request("http://127.0.0.1:1138/api/home/board", data=body,
                                 headers={"Content-Type": "application/json", "X-Lacuna-Who": "lacuna"})
    try:
        urllib.request.urlopen(req, timeout=5).read()
    except Exception as e:  # noqa: BLE001 — the desk may be down; the push still went
        log(f"desk say failed: {e}")


def push(words: str, state_file: str, read_json, write_json, now, log, per_hour: int) -> bool:
    """A push to the owner's phone through Lacuna's notify, at most `per_hour` an hour (the rest are held, and said)."""
    state = read_json(state_file, {})
    recent = [t for t in state.get("pushes", []) if now() - t < 3600]
    if len(recent) >= per_hour:
        log(f"push held (budget spent): {words[:120]!r}")
        return False
    body = json.dumps({"title": "Lacuna", "body": words[:400], "level": "info", "key": f"lacuna-job:{words[:40]}"}).encode()
    req = urllib.request.Request("http://127.0.0.1:1138/api/notify/send", data=body,
                                 headers={"Content-Type": "application/json", "X-Lacuna-Who": "lacuna-jobs"})
    try:
        urllib.request.urlopen(req, timeout=10).read()
    except Exception as e:  # noqa: BLE001
        log(f"push failed: {e}")
        return False
    state["pushes"] = recent + [now()]
    write_json(state_file, state)
    log(f"pushed: {words[:120]!r}")
    return True
