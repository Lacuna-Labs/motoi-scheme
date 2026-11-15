"""DRILLS — DiRT for the Studio: break our own things on purpose and time the recovery (his, 2026-09-25: "an SRE DiRT
check on our Lacuna system to make sure we Mind The Gaps").

Three drills, OUR side only — QA and her iPad are never drilled, whatever the caller says:
  · kill <service>      SIGKILL the process on its port: launchd's KeepAlive must bring it back (a crash)
  · bootout <service>   `launchctl bootout` then `bootstrap` from its plist: the shape of a reboot, one agent at a time
  · self                the CLI's: `launchctl kickstart -k` Lacuna itself, then poll /api/self — measured from outside
Each drill records what happened (the pid, seconds until it answered again, whether launchd restarted it, whether the
watcher said anything) to ~/.lacuna/drills.jsonl and the audit; a drill that does not come back within WAIT_S is a
failed drill and an alert. A drill never runs while another is running, and never inside the watcher.
"""
from __future__ import annotations

import json
import os
import signal
import threading
import time

from .core import LACUNA_HOME, audit, run
from . import services

DRILLS = LACUNA_HOME / "drills.jsonl"
WAIT_S = 120
KINDS = ("kill", "bootout")
_lock = threading.Lock()
_running: dict = {}


def _row(**kw) -> dict:
    kw.setdefault("t", time.time())
    try:
        DRILLS.parent.mkdir(parents=True, exist_ok=True)
        with open(DRILLS, "a") as f:
            f.write(json.dumps(kw, default=str) + "\n")
    except Exception:
        pass
    return kw


def history(limit: int = 30) -> list[dict]:
    if not DRILLS.exists():
        return []
    rows = []
    for ln in DRILLS.read_text().splitlines()[-limit:]:
        try:
            rows.append(json.loads(ln))
        except Exception:
            continue
    return list(reversed(rows))


def running() -> dict:
    with _lock:
        return dict(_running)


def _wait_down(name: str, pid: int | None, seconds: float = 10.0) -> float | None:
    """seconds until the service is actually gone (its pid, or its port) — a kill is not a drill until it landed
    (the tunnel drill of 2026-09-25 read 'back in 0.0 s' off a socket that had not closed yet)."""
    t0 = time.time()
    while time.time() - t0 < seconds:
        gone = (pid is not None and not _pid_alive(pid)) or not services._listening(services.SERVICES[name]["port"])
        if gone:
            return round(time.time() - t0, 2)
        time.sleep(0.1)
    return None


def _pid_alive(pid: int) -> bool:
    try:
        os.kill(pid, 0)
        return True
    except ProcessLookupError:
        return False
    except PermissionError:
        return True


def _wait_back(name: str, t0: float, alerts_fn=None) -> tuple[float | None, bool]:
    """seconds until the service answers again (None = it did not), and whether the watcher raised an alert about it."""
    end = t0 + WAIT_S
    said = False
    back = None
    while time.time() < end:
        if alerts_fn and not said:
            try:
                said = any(a.get("key") == f"svc:{name}" and a.get("t", 0) >= t0 for a in alerts_fn())
            except Exception:
                pass
        if services.answering(name):
            back = round(time.time() - t0, 1)
            break
        time.sleep(0.5)
    return back, said


def drill(kind: str, name: str, who: str, alerts_fn=None, raise_alert=None) -> dict:
    if kind not in KINDS:
        return {"ok": False, "why": f"no drill named {kind} (kill, bootout)"}
    s = services.SERVICES.get(name)
    if not s:
        return {"ok": False, "why": f"no service named {name}"}
    if s["hers"]:
        audit(who, "drill.refused", kind=kind, service=name, why="hers")
        return {"ok": False, "refused": "never the customer's side: QA and the iPad are not drilled"}
    if name == "lacuna":
        return {"ok": False, "why": "Lacuna drills itself from the CLI: `lacuna drill self`"}
    with _lock:
        if _running:
            return {"ok": False, "why": f"a drill is already running: {_running.get('kind')} {_running.get('service')}"}
        _running.update({"kind": kind, "service": name, "t": time.time(), "who": who})
    try:
        ld = services._launchd(s["label"])
        if not ld.get("loaded"):
            return {"ok": False, "why": f"{s['title']} is not kept by launchd — nothing would bring it back; `lacuna svc supervise {name}` first"}
        pid = services._pid_on(s["port"])
        was_up = services.answering(name)
        audit(who, "drill.start", kind=kind, service=name, pid=pid, was_up=was_up)
        t0 = time.time()
        if kind == "kill":
            if not pid:
                return {"ok": False, "why": f"{s['title']} has no process on :{s['port']} to kill"}
            os.kill(pid, signal.SIGKILL)
        else:
            plist = services.AGENTS / f"{s['label']}.plist"
            if not plist.exists():
                return {"ok": False, "why": f"no plist on file for {s['label']}"}
            run(["launchctl", "bootout", f"gui/{services.UID}/{s['label']}"], timeout=15)
            time.sleep(1.0)
            run(["launchctl", "bootstrap", f"gui/{services.UID}", str(plist)], timeout=15)
        services._invalidate()
        down_after = _wait_down(name, pid)
        back, said = _wait_back(name, t0, alerts_fn)
        after = services._launchd(s["label"])
        new_pid = services._pid_on(s["port"])
        # launchd waits ThrottleInterval before it restarts a service that exited quickly — a slow return is often that
        throttle = None
        try:
            import plistlib
            throttle = plistlib.loads((services.AGENTS / f"{s['label']}.plist").read_bytes()).get("ThrottleInterval")
        except Exception:
            pass
        row = _row(kind=kind, service=name, who=who, pid=pid, new_pid=new_pid, down_after_s=down_after, back_s=back, throttle_s=throttle,
                   launchd_restarted=bool(after.get("loaded") and new_pid and new_pid != pid), watcher_said=said, ok=back is not None, was_up=was_up)
        audit(who, "drill.done", **{k: v for k, v in row.items() if k not in ("who",)})
        if raise_alert:
            if back is None:
                raise_alert(f"drill:{name}", "error", f"drill failed — {s['title']}", f"{kind}: it did not come back within {WAIT_S} s; start it: `lacuna svc start {name}`", notify=True)
            else:
                raise_alert(f"drill:{name}", "info", f"drill — {s['title']}", f"{kind}: back in {back} s (pid {pid} → {new_pid})", notify=False)
        services._invalidate()
        return {"ok": back is not None, **row}
    finally:
        with _lock:
            _running.clear()
