"""THE BOOT REPORT — after a reboot, or a restart of Lacuna, it says ONCE what came back and what did not.

His (2026-09-25): "make sure it can recover from a reboot and it has all the tools necessary to do its job."
launchd brings every kept service back on its own; nobody was watching whether it did. When Lacuna starts it waits
(up to WAIT_S) for every service it keeps, then writes one report — which came back and how fast, which did not —
to ~/.lacuna/boot.json, the audit, the alert bar (an alert if anything stayed down) and the phone. It also reads every
LaunchAgent's plist: a service without RunAtLoad would not come back after a reboot, and the report says so before the
reboot proves it. The machine's own uptime tells a reboot from a restart of the console.
"""
from __future__ import annotations

import json
import plistlib
import threading
import time
from pathlib import Path

from .core import LACUNA_HOME, audit, run
from . import services

BOOT = LACUNA_HOME / "boot.json"
WAIT_S = 150
REBOOT_WINDOW_S = 900          # Lacuna starting inside this much uptime = the machine rebooted
_report: dict = {"done": False}
_lock = threading.Lock()


def uptime_s() -> float | None:
    """Seconds since the machine booted (kern.boottime)."""
    code, out = run(["sysctl", "-n", "kern.boottime"], timeout=5)
    if code != 0:
        return None
    try:
        sec = int(out.split("sec = ")[1].split(",")[0])
        return max(0.0, time.time() - sec)
    except Exception:
        return None


def agents() -> dict[str, dict]:
    """Every kept service's LaunchAgent as launchd would read it at boot: RunAtLoad, KeepAlive, and whether it is loaded."""
    out: dict[str, dict] = {}
    for name, s in services.SERVICES.items():
        p = services.AGENTS / f"{s['label']}.plist"
        row: dict = {"label": s["label"], "plist": p.exists(), "run_at_load": None, "keep_alive": None, "loaded": services._launchd(s["label"]).get("loaded", False)}
        if p.exists():
            d = None
            try:
                d = plistlib.loads(p.read_bytes())
            except Exception:
                # a plist Apple's parser takes and Python's does not (a `--` inside an XML comment, found 2026-09-25):
                # ask the system's own reader, the one launchd agrees with
                code, out = run(["plutil", "-convert", "json", "-o", "-", str(p)], timeout=5)
                try:
                    d = json.loads(out) if code == 0 else None
                except Exception:
                    d = None
            if d is None:
                row["error"] = "unreadable plist"
            else:
                row["run_at_load"] = bool(d.get("RunAtLoad"))
                ka = d.get("KeepAlive")
                row["keep_alive"] = ka if isinstance(ka, (bool, dict)) else bool(ka)
        row["comes_back_after_reboot"] = bool(row["plist"] and row["run_at_load"] and row["loaded"])
        out[name] = row
    return out


def _run(raise_alert):
    t0 = time.time()
    up_at = uptime_s()
    rebooted = up_at is not None and up_at < REBOOT_WINDOW_S
    pending = [n for n in services.SERVICES if n != "lacuna"]
    back: dict[str, float] = {}
    while pending and time.time() - t0 < WAIT_S:
        for n in list(pending):
            try:
                if services.answering(n):
                    back[n] = round(time.time() - t0, 1)
                    pending.remove(n)
            except Exception:
                pass
        time.sleep(2)
    ag = agents()
    wont = [n for n, r in ag.items() if not r["comes_back_after_reboot"] and n != "lacuna"]
    # the errands that are on resume BY THEMSELVES within a minute (the runner): the report names them, so a long job
    # that comes back after a reboot (the poster bake, 2026-10-11) is announced, never silent
    try:
        from . import telemetry
        resuming = [f"{r['name']}: {r['goal']}" for r in telemetry.errands()["on"] if r["state"] == "on"]
    except Exception:                                                 # noqa: BLE001
        resuming = []
    rep = {"at": t0, "kind": "reboot" if rebooted else "restart", "uptime_s": None if up_at is None else round(up_at),
           "up": back, "down": pending, "took_s": round(time.time() - t0, 1), "agents": ag, "not_kept_for_reboot": wont,
           "errands_resuming": resuming, "done": True}
    with _lock:
        _report.clear()
        _report.update(rep)
    try:
        BOOT.parent.mkdir(parents=True, exist_ok=True)
        BOOT.write_text(json.dumps(rep, indent=1))
    except Exception:
        pass
    audit("lacuna", "boot.report", kind=rep["kind"], up=list(back), down=pending, took_s=rep["took_s"], not_kept=wont)
    what = "after the reboot" if rebooted else "after Lacuna restarted"
    if pending:
        raise_alert("boot:down", "error", what, f"{', '.join(pending)} did not come back within {WAIT_S} s; up: {', '.join(back) or 'nothing'}", notify=True)
    else:
        raise_alert("boot:ok", "info", what, f"everything is up ({', '.join(f'{n} {s}s' for n, s in back.items())})"
                    + (f"; errands resuming by themselves: {'; '.join(resuming)[:300]}" if resuming else ""), notify=rebooted)
    if wont:
        raise_alert("boot:not-kept", "warn", "would not survive a reboot", f"{', '.join(wont)}: no LaunchAgent with RunAtLoad, or not loaded — `lacuna svc supervise <name>`", notify=False)


def start(raise_alert):
    """Called once when the watcher starts; the wait runs beside it, never inside it."""
    with _lock:
        _report.clear()
        _report.update({"done": False, "at": time.time(), "kind": None})
    threading.Thread(target=_run, args=(raise_alert,), name="lacuna-boot", daemon=True).start()


def report() -> dict:
    with _lock:
        if _report.get("done"):
            return dict(_report)
        pending = dict(_report)
    if BOOT.exists():
        try:
            last = json.loads(BOOT.read_text())
            return {**last, "previous": True, "waiting": not pending.get("done", True)}
        except Exception:
            pass
    return pending
