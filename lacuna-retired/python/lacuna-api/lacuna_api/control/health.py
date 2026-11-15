"""HEALTH — the Studio at a glance: both APIs, the disk (and what eats it), memory, the watchdogs' latest word.

Deep checks and the watchdogs are READ from what the services already say — nothing here pokes a service harder than
its own /healthz. The disk's known eaters are the ones that filled it this month (Core ML compile cache, dead simulator
containers, old training runs, package caches), measured in the background because `du` is slow.
"""
from __future__ import annotations

import json
import shutil
import threading
import time
import urllib.request
from pathlib import Path
from typing import Optional

from .core import ENVS, HOME, LACUNA_HOME, run

EATERS = {
    "Simulator devices": HOME / "Library/Developer/CoreSimulator/Devices",
    "Xcode DerivedData": HOME / "Library/Developer/Xcode/DerivedData",
    "iOS device support": HOME / "Library/Developer/Xcode/iOS DeviceSupport",
    "Forge runs + corpus": HOME / ".forge",
    "Local models (Ollama)": HOME / ".ollama/models",
    "uv cache": HOME / ".cache/uv",
    "Hugging Face cache": HOME / ".cache/huggingface",
    "npm cache": HOME / ".npm",
    "Lacuna builds": LACUNA_HOME / "builds",
    "QA telemetry": HOME / ".curator/telemetry",
    "Dev telemetry": HOME / ".curator-dev/telemetry",
}
_eaters: dict = {"at": 0, "sizes": {}}
_measuring = threading.Lock()      # one sweep at a time: every desk poll during a minutes-long sweep had started another (2026-10-19: six du of one folder, load 11)


def _measure_eaters():
    if not _measuring.acquire(blocking=False):
        return
    try:
        _sweep()
    finally:
        _measuring.release()


def _sweep():
    sizes = {}
    for name, p in EATERS.items():
        if not p.exists():
            continue
        code, out = run(["du", "-sk", str(p)], timeout=300)
        try:
            sizes[name] = int(out.split()[0]) * 1024
        except Exception:
            continue
    _eaters.update({"at": time.time(), "sizes": sizes})


def eaters(refresh: bool = False) -> dict:
    # the folders it measures are the live box's: a test, a clone or a scratch home never measures them, so no sweep's `du`
    # runs under a test (P-2026-11-02-a-test-measured-the-live-disk)
    if LACUNA_HOME != Path.home() / ".lacuna":
        return dict(_eaters)
    if (refresh or time.time() - _eaters["at"] > 1800) and not _measuring.locked():
        threading.Thread(target=_measure_eaters, daemon=True).start()
    return dict(_eaters)


def disk() -> dict:
    u = shutil.disk_usage("/")
    return {"total": u.total, "used": u.used, "free": u.free, "free_gb": round(u.free / 1e9, 1), "low": u.free < 15e9}


def memory() -> dict:
    code, out = run(["sysctl", "-n", "hw.memsize", "kern.memorystatus_vm_pressure_level"], timeout=5)
    parts = out.split()
    total = int(parts[0]) if parts and parts[0].isdigit() else 0
    level = int(parts[1]) if len(parts) > 1 and parts[1].isdigit() else 0
    code, vm = run(["vm_stat"], timeout=5)
    page = 16384
    vals = {}
    for ln in vm.splitlines():
        if ":" in ln:
            k, v = ln.split(":", 1)
            v = v.strip().rstrip(".")
            if v.isdigit():
                vals[k.strip()] = int(v) * page
    free = vals.get("Pages free", 0) + vals.get("Pages inactive", 0) + vals.get("Pages speculative", 0)
    return {"total": total, "available": free, "available_gb": round(free / 1e9, 1),
            "pressure": {1: "normal", 2: "warning", 4: "critical"}.get(level, "normal" if level in (0, 1) else str(level))}


def swap() -> dict:
    """Swap in use, from `sysctl vm.swapusage` ("total = 2048.00M  used = 1024.50M  free = …"); 0 when there is none."""
    code, out = run(["sysctl", "-n", "vm.swapusage"], timeout=5)
    vals = {}
    for k in ("total", "used", "free"):
        try:
            v = out.split(f"{k} = ", 1)[1].split()[0]
            vals[k] = float(v[:-1]) * {"K": 1 / 1024, "M": 1, "G": 1024}.get(v[-1], 1 / 2**20)
        except (IndexError, ValueError):
            vals[k] = 0.0
    return {"total_mb": round(vals["total"], 1), "used_mb": round(vals["used"], 1)}


def _get_json(url: str, timeout: float = 4) -> tuple[Optional[dict], Optional[str]]:
    try:
        with urllib.request.urlopen(url, timeout=timeout) as r:
            return json.loads(r.read().decode() or "{}"), None
    except Exception as e:
        return None, f"{e.__class__.__name__}: {e}"[:160]


FENCE_ENV = next(e for e, v in ENVS.items() if v["port"] == 5051)   # the dev API: only it carries the fence line


def _failure_words(f) -> str:
    if isinstance(f, dict):
        return str(f.get("text") or f.get("why") or f.get("name") or f.get("id") or json.dumps(f))
    return str(f)


def fence_verdict(up: bool, report, err: Optional[str] = None) -> dict:
    """The dev API's production fence, as one line: `ok` (every part holds), `bad` (a part is false, or the report
    cannot be read while the API answers), or `unknown` (the API is down, so nothing can be said either way)."""
    if not up:
        return {"state": "unknown", "text": "Production fence: not read (the dev API is down)", "failures": []}
    if not isinstance(report, dict):
        why = f"report missing ({err})" if err else "report missing"
        return {"state": "bad", "text": f"Production fence: {why}", "failures": [why]}
    if report.get("applies") is False:
        why = f"the API says the fence does not apply (instance {report.get('instance') or '?'})"
        return {"state": "bad", "text": f"Production fence: {why}", "failures": [why]}
    if report.get("ok") is not True:
        fails = [_failure_words(f) for f in (report.get("failures") or [])] or ["the report says not ok, naming no part"]
        return {"state": "bad", "text": "Production fence: " + "; ".join(fails), "failures": fails}
    return {"state": "ok", "text": f"Production fence: {report.get('summary') or 'every part holds'}", "failures": []}


def fence(port: int, up: bool) -> tuple[Optional[dict], dict]:
    """GET /api/fence (read-only, unauthenticated) and its verdict. A 404 (an API not yet restarted) is `bad` while up."""
    if not up:
        return None, fence_verdict(False, None)
    report, err = _get_json(f"http://127.0.0.1:{port}/api/fence", timeout=3)
    return report, fence_verdict(True, report, err)


def api(env: str) -> dict:
    port = ENVS[env]["port"]
    hz, err = _get_json(f"http://127.0.0.1:{port}/healthz")
    out = {"env": env, "label": ENVS[env]["label"], "port": port, "up": hz is not None, "error": err, "healthz": hz}
    if env == FENCE_ENV:
        out["fence"], out["fence_line"] = fence(port, hz is not None)
    if hz is not None:
        st, _ = _get_json(f"http://127.0.0.1:{port}/api/stores/status?operator_id=anonymous", timeout=6)
        out["stores"] = st
        cam, _ = _get_json(f"http://127.0.0.1:{port}/api/studio/camera/status")
        out["camera"] = cam
        tt, _ = _get_json(f"http://127.0.0.1:{port}/api/studio/turntable/status")
        out["turntable"] = tt
    return out


def watchdogs(env: str, scan_bytes: int = 3_000_000) -> list[dict]:
    """Each watchdog's latest word, read off the stream's tail: the API's `watch.*` probes and the app's `app.*`."""
    p = ENVS[env]["home"] / "telemetry" / "stream.jsonl"
    if not p.exists():
        return []
    with open(p, "rb") as f:
        f.seek(max(0, p.stat().st_size - scan_bytes))
        chunk = f.read().decode("utf-8", "replace").splitlines()[1:]
    latest: dict[str, dict] = {}
    for ln in chunk:
        try:
            j = json.loads(ln)
        except Exception:
            continue
        # a line that parses but is not an object (a bare number, a string) is a poison line, not a word:
        # one such line blinded this check for hours on 2026-09-25 (the chaos test's own `123`)
        if not isinstance(j, dict):
            continue
        frm = str(j.get("from") or "")
        if not (frm.startswith("watch.") or frm.startswith("app.") or frm.startswith("conn.")):
            continue
        # a watchdog's word comes from the API's own process: a device row (`where` = the app) that borrows a
        # `watch.*`/`conn.*` name cannot overwrite it (L8, 2026-09-25)
        if (frm.startswith("watch.") or frm.startswith("conn.")) and (j.get("where") or "api") != "api":
            continue
        t = j.get("t")
        latest[frm] = {"name": frm, "where": j.get("where"), "action": j.get("action"), "level": j.get("level"),
                       "summary": j.get("summary"), "t": t,
                       # how old the word is. The probes are EDGE-TRIGGERED (they speak on a change), so an old
                       # healthy word is normal; whether the process behind it is alive is `services.answering`
                       "age_s": (round(time.time() - float(t)) if isinstance(t, (int, float)) else None)}
    out = sorted(latest.values(), key=lambda r: (r["level"] != "error", r["level"] != "warn", r["name"]))
    return out


_api_cache: dict = {}


def api_cached(env: str, max_age: float = 20.0) -> dict:
    """The APIs are asked at most every 20 s, however often the page refreshes."""
    hit = _api_cache.get(env)
    if hit and time.time() - hit[0] < max_age:
        return hit[1]
    v = api(env)
    _api_cache[env] = (time.time(), v)
    return v


def snapshot() -> dict:
    return {"t": time.time(), "disk": disk(), "memory": memory(), "eaters": eaters(),
            "apis": {e: api_cached(e) for e in ENVS}, "watchdogs": {e: watchdogs(e) for e in ENVS}}
