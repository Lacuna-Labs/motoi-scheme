"""KILLING A JOB FOR REAL (the owner, 2026-10-19: "let me kill a job — I tried to and it didn't die").

The finished-work list (GET /api/work/finished), STOP EVERYTHING (POST /api/work/stop-all) and POST /api/jobs/<name>/kill
are the Node door's (lacuna-node/frontend/work-finished.mjs and jobs.mjs, 2026-11-06, finale §3.12); what stays here is the kill
the swarm's stop and the chat's tools call.
"""
from __future__ import annotations

import json
import re
import subprocess
import time
from pathlib import Path

from .core import audit

HOME = Path.home()


# ── KILLING A JOB FOR REAL (the owner, 2026-10-19: "let me kill a job — I tried to and it didn't die") ────────────────────────────
# A card's step is a process the jobs runner started (`zsh -c cd jobs/<name> && cardstep …`, pid in jobs/<name>/.runner.json). Pausing
# a card, or the swarm's stop, never touched that process: it ran on, up to 25 minutes. kill_job pauses the card (so the runner does
# not start it again) and ends the process: its children first, then it, TERM then KILL after 3 s. Its model request dies with its
# socket (the gateway hangs up on the brain).
def _alive(pid: int) -> bool:
    try:
        import os
        os.kill(pid, 0)
        return True
    except OSError:
        return False


def kill_job(name: str) -> dict:
    import os
    import signal
    name = re.sub(r"[^A-Za-z0-9._-]", "", (name or "").removeprefix("errand:"))
    jobdir = HOME / "lacuna-world" / "jobs" / name
    if not jobdir.is_dir():
        return {"ok": False, "why": f"no job named {name!r}"}
    try:
        subprocess.run([str(HOME / "lacuna-world" / "tools" / "task"), "pause", name], capture_output=True, text=True, timeout=20)
    except (OSError, subprocess.SubprocessError):
        pass
    try:
        pid = int(json.loads((jobdir / ".runner.json").read_text()).get("pid") or 0)
    except (OSError, ValueError):
        pid = 0
    if not pid or not _alive(pid):
        return {"ok": True, "said": f"{name} is paused; no process was running", "killed": False}
    subprocess.run(["pkill", "-TERM", "-P", str(pid)], capture_output=True, timeout=10)
    try:
        os.kill(pid, signal.SIGTERM)
    except OSError:
        pass
    for _ in range(6):
        time.sleep(0.5)
        if not _alive(pid):
            break
    else:
        subprocess.run(["pkill", "-KILL", "-P", str(pid)], capture_output=True, timeout=10)
        try:
            os.kill(pid, signal.SIGKILL)
        except OSError:
            pass
    dead = not _alive(pid)
    try:                                              # a killed step must not keep the GPU lease for its full term (2026-10-19: the next card waited 20 min on it)
        subprocess.run([str(HOME / "lacuna-world" / "tools" / "lease"), "release", f"card:{name}"], capture_output=True, text=True, timeout=10)
    except (OSError, subprocess.SubprocessError):
        pass
    audit("alfred", "job.kill", job=name, pid=pid, dead=dead)
    return {"ok": dead, "killed": dead, "said": f"{name} {'stopped' if dead else 'would not die'} (pid {pid}); the card is paused, resume it with `task resume {name}`"}
