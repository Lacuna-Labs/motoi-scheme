"""THE OWNER'S TURN COMES FIRST (2026-10-20, measured: a 767-token answer took 210 s — the forge was training the 1B on the same GPU with 4 GB
in swap, and the brain wrote 3.4–4.5 tokens a second instead of 16). While a person's turn runs, a training in flight is paused (SIGSTOP:
it keeps its memory and its place, it only stops asking the GPU for work) and it resumes the moment the turn ends (SIGCONT). The paused
pids are written down first, so an API that dies mid-turn resumes them when it starts again; a pause never outlives PAUSE_MAX_S.

  pause()  → the pids it paused        resume()  → resumes what it paused        recover()  → at boot: resume anything left paused
"""
from __future__ import annotations

import json
import os
import signal
import subprocess
import threading
import time
from pathlib import Path

from .core import LACUNA_HOME, audit

HEAVY = ("forge_sft.py", "mlx_lm", "forge/train")       # the trainers: the forge's runner and anything MLX-LM it starts
PAUSE_MAX_S = 600
_FILE = LACUNA_HOME / "paused-for-owner.json"
_lock = threading.Lock()
_held: dict = {"pids": [], "t": 0.0}


def _trainers() -> list[int]:
    try:
        out = subprocess.run(["ps", "-axo", "pid=,args="], capture_output=True, text=True, timeout=5).stdout
    except Exception:  # noqa: BLE001
        return []
    me = os.getpid()
    pids = []
    for ln in out.splitlines():
        pid, _, args = ln.strip().partition(" ")
        if pid.isdigit() and int(pid) != me and "python" in args.lower() and any(h in args for h in HEAVY) and "/bin/zsh" not in args:
            pids.append(int(pid))
    return pids


def _signal(pids: list[int], sig) -> list[int]:
    done = []
    for p in pids:
        try:
            os.kill(p, sig); done.append(p)
        except OSError:
            pass
    return done


def pause() -> list[int]:
    with _lock:
        if _held["pids"]:
            return _held["pids"]
        pids = _trainers()
        if not pids:
            return []
        try:
            _FILE.write_text(json.dumps({"pids": pids, "t": time.time()}))
        except OSError:
            return []                                     # unwritten, never paused: a crash must not leave a trainer stopped
        _held.update(pids=_signal(pids, signal.SIGSTOP), t=time.time())
        audit("lacuna", "owner-first.paused", pids=_held["pids"])
        threading.Timer(PAUSE_MAX_S, resume).start()      # a turn that never ends never holds the trainer past this
        return _held["pids"]


def resume() -> list[int]:
    with _lock:
        pids, _held["pids"] = _held["pids"], []
        done = _signal(pids, signal.SIGCONT) if pids else []
        try:
            _FILE.unlink()
        except OSError:
            pass
        if done:
            audit("lacuna", "owner-first.resumed", pids=done, held_s=round(time.time() - _held["t"], 1))
        return done


def recover() -> list[int]:
    """At boot: a trainer an earlier API paused and never resumed goes on."""
    try:
        pids = json.loads(_FILE.read_text()).get("pids") or []
    except (OSError, ValueError):
        return []
    done = _signal(pids, signal.SIGCONT)
    try:
        _FILE.unlink()
    except OSError:
        pass
    return done


def held() -> dict:
    return {"paused": list(_held["pids"]), "since": _held["t"] if _held["pids"] else None}
