"""THE CALIPER RUN KEY (the owner, 2026-10-18: "Caliper: a run key, with the approval in place"). The desk's key files
a `caliper-run` card; only the owner's yes starts it. The run measures the DEV web (the simulator's page, :3000) with
the curator-dev preset — never QA, never production (DEV CAN NEVER REACH PRODUCTION: the target is fixed here, not
an argument). The report lands in ~/lacuna-world/scratch/caliper/<stamp>/ where the Caliper card reads its history.
  POST /api/caliper/run   {mode: "passive" | "full", dry?}  files the card (passive = no active attack; full adds ZAP);
                          dry says what the card would say and files nothing
  GET  /api/caliper/run   the run now (pid, started, its log's last lines) or the last one
"""
from __future__ import annotations

import json
import subprocess
import time
from pathlib import Path

from fastapi import APIRouter

router = APIRouter()

TARGET = "http://127.0.0.1:3000/"                          # the dev web only: fixed, never an argument
CALIPER = Path.home() / "code" / "caliper" / "dist" / "cli" / "index.js"
PROJECT = Path.home() / "code" / "curator"                 # the graders read the project from here (curator-web/…)
OUT = Path.home() / "lacuna-world" / "scratch" / "caliper"
STATE = Path.home() / ".lacuna" / "caliper-run.json"
MODES = {"passive": "prod", "full": "dev"}                 # Caliper's words: prod = passive only · dev = full stack


def _state() -> dict:
    try:
        return json.loads(STATE.read_text())
    except (OSError, ValueError):
        return {}


def _alive(pid) -> bool:
    try:
        return bool(pid) and subprocess.run(["kill", "-0", str(pid)], capture_output=True).returncode == 0
    except OSError:
        return False


def status() -> dict:
    s = _state()
    log = Path(s["log"]) if s.get("log") else None
    tail = log.read_text(errors="replace").splitlines()[-8:] if log and log.exists() else []
    return {**s, "running": _alive(s.get("pid")), "tail": tail, "target": TARGET}


def start(mode: str, who: str, room: str | None = None, item: str | None = None) -> dict:
    """the owner's yes: one run at a time, in the background, its log beside its report"""
    if status().get("running"):
        return {"ok": False, "why": "a Caliper run is already going"}
    if not CALIPER.exists():
        return {"ok": False, "why": f"Caliper is not built ({CALIPER})"}
    stamp = time.strftime("%Y%m%d-%H%M%S")
    out = OUT / stamp
    out.mkdir(parents=True, exist_ok=True)
    log = out / "run.log"
    cmd = ["node", str(CALIPER), "run", "--preset", "curator-dev", "--mode", MODES.get(mode, "prod"), "--target", TARGET,
           "--out", str(out), "--artifact-dir", str(out / "raw")]
    with open(log, "w") as fh:
        p = subprocess.Popen(cmd, cwd=PROJECT, stdout=fh, stderr=subprocess.STDOUT, start_new_session=True)
    meta = {"pid": p.pid, "started": time.time(), "mode": mode, "by": who, "out": str(out), "log": str(log), "room": room, "item": item}
    STATE.write_text(json.dumps(meta))
    (out / "meta.json").write_text(json.dumps(meta))          # which room's test this run was (the windows read it)
    return {"ok": True, "pid": p.pid, "out": str(out)}


@router.get("/api/caliper/run")
def r_status() -> dict:
    return status()


@router.post("/api/caliper/run")
def r_file(body: dict) -> dict:
    from . import chat
    mode = str((body or {}).get("mode") or "passive")
    if mode not in MODES:
        return {"ok": False, "why": "mode is passive or full"}
    room, item = (body or {}).get("room"), (body or {}).get("item")
    what = f" — {room} · {item}" if room and item else ""
    return chat.file_petition("caliper-run", None, f"measure the dev web with Caliper ({mode}){what}", "alfred", dry=bool((body or {}).get("dry")),
                              args={"mode": mode, "room": room, "item": item})


@router.get("/api/caliper/tests")
def r_tests() -> dict:
    """each room test's newest run (its report's score, grade, categories) and the run going now — the windows' data"""
    out: dict[str, dict] = {}
    for d in sorted(OUT.glob("*/meta.json")) if OUT.is_dir() else []:
        try:
            m = json.loads(d.read_text())
        except (OSError, ValueError):
            continue
        key = f"{m.get('room')}/{m.get('item')}"
        rep = d.parent / "caliper-report.json"
        from . import caliper
        r = caliper._report(rep) if rep.exists() else None        # the same reading the Caliper card gives every report
        out[key] = {"started": m.get("started"), "mode": m.get("mode"), "report": r, "out": str(d.parent)}
    return {"tests": out, "now": status()}
