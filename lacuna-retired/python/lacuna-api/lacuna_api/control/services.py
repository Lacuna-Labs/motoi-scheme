"""The Studio's services — status, start, stop, restart, their logs, and WHY a start failed.

His, 2026-09-24: *"make sure it can start and stop both dev and QA servers… If we can't start the service, [it] should be
able to tell why."* Two kinds of service, one surface:

  · SUPERVISED — a launchd agent owns it (KeepAlive: a crash or a reboot brings it back). Start = bootstrap + kickstart,
    stop = bootout (it stays stopped until started), restart = kickstart -k.
  · HAND-STARTED — a process somebody launched (the way dev and QA were run until now). Stop = SIGTERM the process on
    its port (SIGKILL after 10 s); start = the service's own script, detached, logging to ~/.lacuna/logs/<name>.log.
    `supervise` turns a hand-started service into a supervised one (writes its LaunchAgent).

QA and anything that reaches her iPad are HERS: every act on them needs `confirm=True` (the console's button, pressed
by a person). A start that does not come up is answered with the log's last lines and the runbook's likely cause.

THE PRESS ROAD (LACUNA-CARDS-2.0 §6.8, lane C8, 2026-10-24): the desk never calls start, stop or restart directly; it
files the petition `press_road` names and the owner's signed press runs it (chat.decide). Each status row carries its
`press` (per action, the petition body, or {"why"} when no press runs it) and `comes_back` (launchd holds the label
and its plist says KeepAlive, so a crash or a kill brings it back). Refuses: a road for the door (launchd keeps it up; it never stops itself) and for `supervise`
(a desk record, not an act). Invariants (§18): "an act from the desk is a press ticket or a foreman route".
"""
from __future__ import annotations

import json
import os
import re
import signal
import socket
import time
import urllib.request
from pathlib import Path
from typing import Optional

from .core import ENV_DIR, LACUNA_HOME, QA_TREE, REPO, audit, run

UID = os.getuid()
AGENTS = Path.home() / "Library" / "LaunchAgents"

SERVICES: dict[str, dict] = {
    "dev-api": {"title": "Dev API", "port": 5051, "health": "http://127.0.0.1:5051/healthz", "label": "ai.lacunalabs.dev-api",
                "cmd": ["/bin/bash", str(ENV_DIR / "dev-api.sh")], "cwd": REPO, "hers": False,
                "about": "our server — the simulator points here (~/.curator-dev)"},
    "qa-api": {"title": "QA API", "port": 5050, "health": "http://127.0.0.1:5050/healthz", "label": "ai.lacunalabs.qa-api",
               "cmd": ["/bin/bash", str(QA_TREE / "tools" / "env" / "qa-api.sh")], "cwd": QA_TREE, "hers": True,   # her own checkout of main
               "about": "The customer's server — the iPad points here (~/.curator)"},
    "vite": {"title": "Web dev server", "port": 3000, "health": "http://127.0.0.1:3000/", "label": "ai.lacunalabs.vite",
             "cmd": [str(REPO / "curator-web" / "node_modules" / ".bin" / "vite"), "--port", "3000"], "cwd": REPO / "curator-web",
             "hers": False, "about": "vite, a browser tab — proxies to QA"},
    "tunnel": {"title": "Cloudflare tunnel", "port": 20241, "health": None, "label": "ai.lacunalabs.curator-dev-tunnel",
               "cmd": None, "cwd": None, "hers": False, "about": "the Studio's public road"},
    "speech-helper": {"title": "Speech helper", "port": 8765, "health": None, "label": "ai.lacunalabs.curator-speech-helper",
                      "cmd": None, "cwd": None, "hers": False, "about": "on-device transcription for the podcast"},
    "lacuna": {"title": "Lacuna (this console)", "port": 1138, "health": "http://127.0.0.1:1138/healthz", "label": "ai.lacunalabs.lacuna-door",
               "cmd": None, "cwd": None, "hers": False, "about": "the control plane itself — always up"},
}

# THE RUNBOOK'S LIKELY CAUSES — a failed start's log is matched against these, first hit wins (SRE_MANUAL §7).
HINTS = [
    (r"address already in use|Errno 48", "the port is already held by another process — stop that process (or it is already running)"),
    (r"Refusing", "the script's own guard refused (dev will not become QA, and never writes into the customer's home) — read its line above"),
    (r"ModuleNotFoundError|No module named", "the Python environment is missing a package — the service's .venv needs `uv pip install`"),
    (r"No such file or directory: '?\.env|\.env: No such file", "the service's .env is missing (curator-api/.env)"),
    (r"PermissionError|Operation not permitted", "macOS refused a file or port — check the path's owner, or Full Disk Access"),
    (r"database is locked|disk I/O error|No space left", "the disk or a database is jammed — check free space (Disk tab) first"),
    (r"Traceback", "the service crashed on start — the last lines of the traceback say where"),
]


def _listening(port: int) -> bool:
    try:
        with socket.create_connection(("127.0.0.1", port), timeout=0.4):
            return True
    except OSError:
        return False


def _pid_on(port: int) -> Optional[int]:
    code, out = run(["lsof", "-tiTCP:%d" % port, "-sTCP:LISTEN"], timeout=5)
    for tok in out.split():
        if tok.isdigit():
            return int(tok)
    return None


def _http_ok(url: Optional[str]) -> Optional[bool]:
    """Healthy means ANSWERED, CORRECTLY: a 200, and when the body is JSON with a `status`, that status is "ok".
    Before 2026-09-25 any 200–499 passed, so a half-mounted app answering 404 on /healthz read healthy (L6)."""
    if not url:
        return None
    try:
        with urllib.request.urlopen(url, timeout=3) as r:
            if r.status != 200:
                return False
            body = r.read(4096)
    except Exception:
        return False
    try:
        d = json.loads(body)
    except Exception:
        return True                       # not JSON: a 200 is the whole answer
    return not (isinstance(d, dict) and "status" in d and d.get("status") != "ok")


def answering(name: str) -> bool:
    """Up AND answering its health route (a wedged uvicorn still accepts in the kernel — listening is not answering)."""
    s = SERVICES[name]
    if not _listening(s["port"]):
        return False
    return _http_ok(s.get("health")) is not False


def _launchd(label: str) -> dict:
    code, out = run(["launchctl", "print", f"gui/{UID}/{label}"], timeout=5)
    if code != 0:
        return {"loaded": False}
    state = re.search(r"\n\s*state = (\S+)", out)
    pid = re.search(r"\n\s*pid = (\d+)", out)
    last = re.search(r"last exit code = (-?\d+)", out)
    return {"loaded": True, "state": state.group(1) if state else None, "pid": int(pid.group(1)) if pid else None,
            "last_exit": int(last.group(1)) if last else None}


def log_path(name: str) -> Path:
    return LACUNA_HOME / "logs" / f"{name}.log"


ACTIONS = ("start", "restart", "stop")
OURS = ("dev-api", "vite", "tunnel", "speech-helper")        # chat.py control_service's own list: the act the press runs


def _keeps_alive(label: str) -> bool:
    """The label's LaunchAgent says KeepAlive (true, or a non-empty dict of conditions); an unreadable plist says no."""
    import plistlib
    try:
        k = plistlib.loads((AGENTS / f"{label}.plist").read_bytes()).get("KeepAlive")
    except Exception:  # noqa: BLE001 — no plist, or one Python's reader refuses: claim nothing
        return False
    return bool(k)


def press_road(name: str, action: str) -> dict:
    """The petition a desk key files for one service act: {"action", "args"?} for POST /api/petitions, or {"why"} when
    no press runs it. QA takes its own card (qa-<action>, the customer's side); ours take act:control_service."""
    if name not in SERVICES or action not in ACTIONS:
        return {"why": f"no press road for {action} on {name}"}
    if name == "lacuna":
        return {"why": "the frontend is never stopped from itself: launchd keeps it up and brings it back"}
    if SERVICES[name]["hers"]:
        return {"action": f"qa-{action}"}
    if name not in OURS:
        return {"why": f"{name} has no act behind its press yet"}
    return {"action": "act:control_service", "args": {"service": name, "action": action}}


def status(name: str) -> dict:
    s = SERVICES[name]
    ld = _launchd(s["label"])
    up = _listening(s["port"])
    pid = _pid_on(s["port"]) if up else None
    health = _http_ok(s["health"]) if up else False
    return {"name": name, "title": s["title"], "about": s["about"], "port": s["port"], "hers": s["hers"],
            "up": up, "healthy": health if s["health"] else up, "pid": pid,
            "supervised": ld.get("loaded", False), "launchd": ld, "label": s["label"],
            "comes_back": bool(ld.get("loaded")) and _keeps_alive(s["label"]),
            "press": {a: press_road(name, a) for a in ACTIONS},
            "can_supervise": s["cmd"] is not None, "log": str(log_path(name)) if s["cmd"] else None}


_cache: dict = {"t": 0.0, "rows": None}


def all_status(max_age: float = 3.0) -> list[dict]:
    """Every service's status — cached for a few seconds so however many pages are open, the services feel nothing."""
    if _cache["rows"] is not None and time.time() - _cache["t"] < max_age:
        return _cache["rows"]
    rows = [status(n) for n in SERVICES]
    _cache.update({"t": time.time(), "rows": rows})
    return rows


def _invalidate():
    _cache["rows"] = None


class NeedsConfirm(Exception):
    pass


def _guard(name: str, confirm: bool):
    if name not in SERVICES:
        raise KeyError(name)
    if name == "lacuna":
        raise PermissionError("the console does not stop itself — launchd keeps it up; use `launchctl kickstart -k`")
    if SERVICES[name]["hers"] and not confirm:
        raise NeedsConfirm(f"{SERVICES[name]['title']} is the customer's server — a person has to confirm this")


def tail(name: str, lines: int = 60) -> str:
    p = log_path(name)
    if not p.exists():
        return ""
    return "\n".join(p.read_text(errors="replace").splitlines()[-lines:])


def explain(name: str) -> dict:
    """Why a service is not up: the log's last lines and the runbook's likely cause."""
    text = tail(name, 80)
    ld = SERVICES[name]["label"] and _launchd(SERVICES[name]["label"])
    cause = next((why for pat, why in HINTS if re.search(pat, text)), None)
    if not cause and ld and ld.get("loaded") and ld.get("last_exit") not in (None, 0):
        cause = f"launchd ran it and it exited with {ld['last_exit']}"
    if not cause and not text:
        cause = "no log yet — it was never started from here"
    return {"name": name, "cause": cause or "no known cause in the log — read the last lines", "log": text[-4000:]}


def _wait_up(name: str, seconds: float) -> bool:
    end = time.time() + seconds
    while time.time() < end:
        if _listening(SERVICES[name]["port"]) and _http_ok(SERVICES[name]["health"]) is not False:
            return True
        time.sleep(0.5)
    return False


def start(name: str, who: str, confirm: bool = False, wait_s: float = 60) -> dict:
    _guard(name, confirm)
    s = SERVICES[name]
    if _listening(s["port"]):
        return {"ok": True, "already": True, **status(name)}
    audit(who, "service.start", service=name)
    _invalidate()
    ld = _launchd(s["label"])
    plist = AGENTS / f"{s['label']}.plist"
    if ld.get("loaded"):
        run(["launchctl", "kickstart", f"gui/{UID}/{s['label']}"], timeout=10)
    elif plist.exists():
        run(["launchctl", "bootstrap", f"gui/{UID}", str(plist)], timeout=10)
    elif s["cmd"]:
        with open(log_path(name), "a") as logf:
            logf.write(f"\n=== start {time.strftime('%Y-%m-%d %H:%M:%S')} by {who} ===\n")
            logf.flush()
            import subprocess
            subprocess.Popen(s["cmd"], stdout=logf, stderr=subprocess.STDOUT, cwd=str(s["cwd"]) if s["cwd"] else None,
                             start_new_session=True, env={**os.environ, "PATH": os.environ.get("PATH", "") + ":/opt/homebrew/bin:/usr/local/bin"})
    else:
        return {"ok": False, "why": f"{s['title']} has no start command and no LaunchAgent on file"}
    ok = _wait_up(name, wait_s)
    _invalidate()
    out = {"ok": ok, **status(name)}
    if not ok:
        out["explain"] = explain(name)
        audit(who, "service.start.failed", service=name, cause=out["explain"]["cause"])
    return out


def stop(name: str, who: str, confirm: bool = False) -> dict:
    _guard(name, confirm)
    s = SERVICES[name]
    audit(who, "service.stop", service=name)
    _invalidate()
    ld = _launchd(s["label"])
    if ld.get("loaded"):
        run(["launchctl", "bootout", f"gui/{UID}/{s['label']}"], timeout=15)
    pid = _pid_on(s["port"])
    if pid:
        try:
            os.kill(pid, signal.SIGTERM)
        except ProcessLookupError:
            pass
        end = time.time() + 10
        while time.time() < end and _listening(s["port"]):
            time.sleep(0.3)
        if _listening(s["port"]):
            try:
                os.kill(pid, signal.SIGKILL)
            except ProcessLookupError:
                pass
            time.sleep(0.5)
    _invalidate()
    return {"ok": not _listening(s["port"]), **status(name)}


def restart(name: str, who: str, confirm: bool = False) -> dict:
    _guard(name, confirm)
    ld = _launchd(SERVICES[name]["label"])
    if ld.get("loaded"):
        audit(who, "service.restart", service=name)
        run(["launchctl", "kickstart", "-k", f"gui/{UID}/{SERVICES[name]['label']}"], timeout=15)
        ok = _wait_up(name, 60)
        out = {"ok": ok, **status(name)}
        if not ok:
            out["explain"] = explain(name)
        return out
    stop(name, who, confirm)
    return start(name, who, confirm)


PLIST = """<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
  <key>Label</key><string>{label}</string>
  <key>ProgramArguments</key><array>{args}</array>
  <key>WorkingDirectory</key><string>{cwd}</string>
  <key>EnvironmentVariables</key><dict><key>PATH</key><string>/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin</string><key>HOME</key><string>{home}</string></dict>
  <key>RunAtLoad</key><true/>
  <key>KeepAlive</key><dict><key>SuccessfulExit</key><false/></dict>
  <key>ThrottleInterval</key><integer>10</integer>
  <key>StandardOutPath</key><string>{log}</string>
  <key>StandardErrorPath</key><string>{log}</string>
</dict></plist>
"""


def supervise(name: str, who: str, confirm: bool = False) -> dict:
    """Put a hand-started service under launchd: it comes back after a crash or a reboot. The running process is
    stopped and the agent starts it — for QA that is a restart of her server, so it needs a confirm."""
    _guard(name, confirm)
    s = SERVICES[name]
    if not s["cmd"]:
        return {"ok": False, "why": "already a launchd service"}
    from xml.sax.saxutils import escape
    args = "".join(f"<string>{escape(a)}</string>" for a in s["cmd"])
    plist = AGENTS / f"{s['label']}.plist"
    plist.write_text(PLIST.format(label=s["label"], args=args, cwd=escape(str(s["cwd"])), home=str(Path.home()), log=escape(str(log_path(name)))))
    audit(who, "service.supervise", service=name, plist=str(plist))
    stop(name, who, confirm)
    run(["launchctl", "bootstrap", f"gui/{UID}", str(plist)], timeout=10)
    ok = _wait_up(name, 60)
    out = {"ok": ok, **status(name)}
    if not ok:
        out["explain"] = explain(name)
    return out
