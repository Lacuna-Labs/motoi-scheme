"""THE SENTINEL — attack awareness (the owner, 2026-10-17: "attack awareness and notification").

What an intruder leaves behind on a Mac is mostly NEW: a program listening on a port, a launch agent or daemon that
starts it again, a login that is not the owner's. The sentinel keeps a baseline of what is normal on this box
(~/.lacuna/sentinel-baseline.json), compares every five minutes, and raises ONE alert per new thing, naming it — the
port and the program, the plist's path and what it runs, the login's user and from where. It watches and tells; it never
kills, deletes or blocks anything (that is the owner's call, P7 in the playbooks). A thing the owner says is fine joins
the baseline (`lacuna sentinel accept <id>`).
"""
from __future__ import annotations

import glob
import json
import os
import plistlib
import re
import subprocess
import time
from pathlib import Path

BASELINE = Path(os.environ.get("LACUNA_HOME") or Path.home() / ".lacuna") / "sentinel-baseline.json"
EVERY_S = 300
_last = [0.0]
AGENT_DIRS = [str(Path.home() / "Library" / "LaunchAgents"), "/Library/LaunchAgents", "/Library/LaunchDaemons"]


def _run(args: list[str], timeout: int = 20) -> str:
    try:
        return subprocess.run(args, capture_output=True, text=True, timeout=timeout).stdout
    except (OSError, subprocess.SubprocessError):
        return ""


def listeners() -> dict[str, str]:
    """port → program, for every TCP listener (all addresses). The program's whole name (`+c 0`: lsof cuts it at 9 characters
    by default, and the owner read "Antigravi is listening", video E2); lsof writes a space as `\\x20`."""
    out = {}
    for line in _run(["lsof", "+c", "0", "-nP", "-iTCP", "-sTCP:LISTEN"]).splitlines()[1:]:
        parts = line.split()
        if len(parts) >= 9:
            addr = parts[8]
            port = addr.rsplit(":", 1)[-1]
            where = "local" if addr.startswith(("127.", "[::1]", "localhost")) else "network"
            out[f"{port}/{where}"] = parts[0].replace("\\x20", " ")
    return out


def agents() -> dict[str, str]:
    """plist path → what it runs."""
    out = {}
    for d in AGENT_DIRS:
        for p in glob.glob(os.path.join(d, "*.plist")):
            try:
                with open(p, "rb") as f:
                    pl = plistlib.load(f)
                prog = pl.get("Program") or " ".join((pl.get("ProgramArguments") or [])[:3])
            except Exception:  # noqa: BLE001 — unreadable is itself worth a look, but not an alert storm
                prog = "(unreadable)"
            out[p] = str(prog)[:200]
    return out


def logins() -> dict[str, str]:
    """user@from → when, for current logins (who)."""
    out = {}
    for line in _run(["who"]).splitlines():
        parts = line.split()
        if parts:
            m = re.search(r"\(([^)]+)\)", line)
            out[f"{parts[0]}@{m.group(1) if m else 'console'}"] = " ".join(parts[2:4])
    return out


def snapshot() -> dict:
    return {"listeners": listeners(), "agents": agents(), "logins": logins(), "at": time.time()}


def _load() -> dict | None:
    try:
        return json.loads(BASELINE.read_text())
    except (OSError, ValueError):
        return None


def _kernel_picked(k: str) -> bool:
    """A loopback listener on the dynamic range (49152–65535) is a port the kernel picked for a test or dev server (port 0):
    the render gate, vitest, a probe. Not an intruder's mark; it paged the owner for each one (2026-10-27). A listener on the
    network on any port still alerts, as does a fixed loopback port."""
    port, _, where = k.partition("/")
    return where == "local" and port.isdigit() and int(port) >= 49152


def diff(base: dict, now: dict) -> list[dict]:
    new = []
    for k, prog in now["listeners"].items():
        if k not in base["listeners"] and not _kernel_picked(k):
            new.append({"id": f"port:{k}", "what": f"{prog} is listening on :{k.split('/')[0]} ({k.split('/')[1]})",
                        "level": "error" if k.endswith("/network") else "warn"})
    for p, prog in now["agents"].items():
        if p not in base["agents"]:
            new.append({"id": f"agent:{p}", "what": f"a new launch item {p} runs: {prog}", "level": "error"})
    for u in now["logins"]:
        if u not in base["logins"] and not u.endswith("@console"):
            new.append({"id": f"login:{u}", "what": f"a login: {u}", "level": "error"})
    return new


def check(raise_alert) -> list[dict]:
    """Every five minutes: the first run writes the baseline; later runs alert once per new thing."""
    if time.time() - _last[0] < EVERY_S:
        return []
    _last[0] = time.time()
    now = snapshot()
    base = _load()
    if base is None:
        BASELINE.write_text(json.dumps(now, indent=1))
        return []
    found = diff(base, now)
    seen = set(base.get("alerted", []))
    fresh = [f for f in found if f["id"] not in seen]
    # one alert per program and place, its new ports listed (video E2: one program's ports counted ×3, ×4 in seconds), and the
    # owner's answer is a press on the Security card ("this is mine"), never a command to type
    by_prog: dict[str, list[dict]] = {}
    for f in fresh:
        if f["id"].startswith("port:"):
            by_prog.setdefault(f"{now['listeners'][f['id'][5:]]}/{f['id'].rsplit('/', 1)[1]}", []).append(f)
    for key, group in by_prog.items():
        prog, _, where = key.rpartition("/")
        ports = ", ".join(":" + g["id"][5:].split("/")[0] for g in group)
        raise_alert(f"sentinel:prog:{key}", "error" if where == "network" else "warn", "something new on the box",
                    f"{prog} is listening on {ports} ({where}) — if it is yours, press \"this is mine\" on the Security card")
        seen.update(g["id"] for g in group)
    for f in fresh:
        if f["id"].startswith("port:"):
            continue
        raise_alert(f"sentinel:{f['id']}", f["level"], "something new on the box",
                    f["what"] + " — if it is yours, press \"this is mine\" on the Security card")
        seen.add(f["id"])
    base["alerted"] = sorted(seen)
    BASELINE.write_text(json.dumps(base, indent=1))
    return found


def accept(item_id: str) -> dict:
    """The owner says it is fine: it joins the baseline. `prog:<program>/<where>` accepts every port the program listens on there."""
    base = _load() or snapshot()
    now = snapshot()
    kind, _, key = item_id.partition(":")
    if kind == "prog":
        prog, _, where = key.rpartition("/")
        ports = [k for k, p in now["listeners"].items() if p == prog and k.endswith("/" + where)]
        if not ports:
            return {"ok": False, "why": f"no {prog} listening ({where}) on the box now"}
        for k in ports:
            base["listeners"][k] = now["listeners"][k]
        gone = {f"port:{k}" for k in ports}
        base["alerted"] = [a for a in base.get("alerted", []) if a not in gone]
        BASELINE.write_text(json.dumps(base, indent=1))
        return {"ok": True, "accepted": item_id, "ports": len(ports)}
    table = {"port": "listeners", "agent": "agents", "login": "logins"}.get(kind)
    if not table or key not in now[table]:
        return {"ok": False, "why": f"no {item_id} on the box now"}
    base[table][key] = now[table][key]
    base["alerted"] = [a for a in base.get("alerted", []) if a != item_id]
    BASELINE.write_text(json.dumps(base, indent=1))
    return {"ok": True, "accepted": item_id}
