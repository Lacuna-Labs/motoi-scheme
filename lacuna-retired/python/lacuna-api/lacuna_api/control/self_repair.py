"""SELF-REPAIR — Lacuna fixes its own side of the box (the owner, 2026-10-19: "leave Lacuna with the ability to repair
itself … give it the self-repair playbook also, so it can fix things with itself"). Playbook: P-SELF (SELF-REPAIR.md).

A fixed menu. Each repair acts only when its CHECK fails right now (busy is not down: a brain answering /health with both
slots busy is never restarted), at most three times an hour each, and every act is audited and said on the desk. Nothing
here touches the customer's side: QA, her iPad and their data are not on the menu, and never will be.

  brain        llama-server :8091 — /health does not answer twice, 10 s apart          → launchctl kickstart -k the brain
  gateway      the brain gateway :11434 — its root does not answer twice              → kickstart the gateway
  foreman      the foreman — GET /health fails twice                                   → kickstart the foreman
  small-minds  memory under 2 GB free while small minds are loaded                     → stop the small minds' servers
  lacuna       Lacuna's own source changed under the running API (its code drift)      → a detached kickstart in 20 s,
                                                                                         after this turn has answered

  check()          every repair's check, now (a read — any cart may call it: the hand `self-repair-check`)
  repair(what, who) the repair, if its check fails and its hourly budget allows
"""
from __future__ import annotations

import json
import os
import subprocess
import time
import urllib.request
from pathlib import Path

from .core import LACUNA_HOME, audit

LEDGER = LACUNA_HOME / "self-repair.jsonl"
PER_HOUR = 3
LABEL = {"brain": "ai.lacunalabs.brain", "gateway": "ai.lacunalabs.brain-gateway", "foreman": "ai.lacunalabs.foreman",
         "lacuna": "ai.lacunalabs.lacuna"}


def _up(url: str, timeout: float = 5.0) -> bool:
    try:
        with urllib.request.urlopen(url, timeout=timeout) as r:
            return r.status < 500
    except Exception:  # noqa: BLE001
        return False


def _twice(url: str) -> bool:
    """down = no answer twice, 10 s apart (one slow answer under load is not down)"""
    if _up(url):
        return True
    time.sleep(10)
    return _up(url)


def _foreman_up() -> bool:
    from . import foreman
    for _ in range(2):
        try:
            r = foreman.call("GET", "/health", None, timeout=5)
            if isinstance(r, dict) and not r.get("error") and r.get("ok") is not False:
                return True
        except Exception:  # noqa: BLE001
            pass
        time.sleep(10)
    return False


def _memory_tight() -> tuple[bool, str]:
    from . import health
    m = health.memory()
    free = m.get("available_gb")
    loaded = subprocess.run(["lsof", "-tiTCP:8092-8099", "-sTCP:LISTEN"], capture_output=True, text=True, timeout=5).stdout.split()
    return (free is not None and free < 2.0 and bool(loaded)), f"{free} GB free, {len(loaded)} small mind(s) loaded"


def _code_drift() -> tuple[bool, str]:
    from . import drift
    d = drift.self_code()
    return bool(d), (d[0]["detail"] if d else "running the code on disk")


def check(fast: bool = False) -> dict:
    """Every repair's check now: {what: {ok, why}} — ok means nothing to repair. `fast` skips the 10 s second look."""
    probe = _up if fast else _twice
    out = {"brain": {"ok": probe("http://127.0.0.1:8091/health"), "why": "llama-server /health"},
           "gateway": {"ok": probe("http://127.0.0.1:11434/"), "why": "the gateway's root"},
           "foreman": {"ok": _foreman_up() if not fast else True, "why": "the foreman's /health"}}
    tight, words = _memory_tight()
    out["small-minds"] = {"ok": not tight, "why": words}
    drifted, words = _code_drift()
    out["lacuna"] = {"ok": not drifted, "why": words}
    return out


def _recent(what: str) -> int:
    since = time.time() - 3600
    try:
        return sum(1 for ln in LEDGER.read_text().splitlines()[-500:]
                   if (r := json.loads(ln)).get("what") == what and r.get("t", 0) >= since and r.get("acted"))
    except (OSError, ValueError):
        return 0


def _note(row: dict) -> None:
    try:
        with LEDGER.open("a") as f:
            f.write(json.dumps({"t": round(time.time(), 1), **row}) + "\n")
    except OSError:
        pass


def repair(what: str, who: str) -> dict:
    """The repair, only if its check fails now and it has not acted three times this hour."""
    if what not in ("brain", "gateway", "foreman", "small-minds", "lacuna"):
        return {"ok": False, "why": f"no self-repair named {what} (brain · gateway · foreman · small-minds · lacuna)"}
    c = check()[what]
    if c["ok"]:
        _note({"what": what, "who": who, "acted": False, "why": "its check passes"})
        return {"ok": True, "acted": False, "said": f"{what} is well ({c['why']}) — nothing to repair"}
    if _recent(what) >= PER_HOUR:
        _note({"what": what, "who": who, "acted": False, "why": "the hourly budget is spent"})
        return {"ok": False, "acted": False, "said": f"{what} has been repaired {PER_HOUR} times this hour and is still failing — "
                                                     "this needs the owner (P-SELF: stop and call)"}
    if what == "small-minds":
        from . import ai_control
        r = ai_control.unload_minds(f"self-repair:{who}")
        ok, said = bool(r.get("ok")), r.get("said")
    elif what == "lacuna":
        # never mid-turn: a detached kickstart after this turn has answered
        subprocess.Popen(["/bin/sh", "-c", f"sleep 20; launchctl kickstart -k gui/{os.getuid()}/{LABEL['lacuna']}"],
                         start_new_session=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        ok, said = True, "Lacuna restarts itself in 20 seconds to run the code on disk; the desk reconnects by itself"
    else:
        p = subprocess.run(["launchctl", "kickstart", "-k", f"gui/{os.getuid()}/{LABEL[what]}"], capture_output=True, text=True, timeout=30)
        ok, said = p.returncode == 0, (f"{what} restarted — it answers again in about a minute" if p.returncode == 0 else p.stderr[-200:])
    audit(f"self-repair:{who}", "self-repair", what=what, ok=ok, why=c["why"])
    _note({"what": what, "who": who, "acted": True, "ok": ok, "why": c["why"]})
    try:
        from . import workers
        workers.raise_alert(f"self-repair:{what}", "info", f"Lacuna repaired {what} by itself", said or "", notify=False)
    except Exception:  # noqa: BLE001 — the desk line is a courtesy; the audit is the record
        pass
    return {"ok": ok, "acted": True, "said": said}


def history(n: int = 20) -> list[dict]:
    try:
        return [json.loads(x) for x in LEDGER.read_text().splitlines()[-n:]][::-1]
    except (OSError, ValueError):
        return []
