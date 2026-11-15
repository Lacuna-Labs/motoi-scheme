"""THE BATTERY & THE SUITES — what ran, what it said, and running it again from the console.

The battery (tools/battery/stage) plays acts on the dev API + the simulator; `run-release.sh` is the workflow pass
before any push to her iPad, `run3.sh` the full burn-in. Each pass appends to a log under scratch/battery/runs; each act
leaves a run folder with its act.json. This reads them into rows (act · speed · held memory · page errors · telemetry
errors · the act's own result) and starts new runs as jobs. The suites (web ~3 min, API ~45 min) run as jobs too.
GET /api/battery and POST /api/battery/{kind} are the door's (lacuna-node/frontend/battery.mjs, 2026-11-06, finale §3.12);
passes() and start_pass() stay for the chat's battery tool and telemetry's battery source.
"""
from __future__ import annotations

import json
import re
import time
from pathlib import Path

from .core import BATTERY, LACUNA_HOME, REPO, RUNS, audit, start_job

PASSES = {"release": "run-release.sh", "full": "run3.sh"}


def passes() -> list[dict]:
    """Every pass log (RUN1/2/3, RELEASE…), newest pass first, each with its runs parsed."""
    out = []
    for log in sorted(RUNS.glob("*.log"), key=lambda p: p.stat().st_mtime, reverse=True):
        if log.name == "iwdp.log":
            continue
        text = log.read_text(errors="replace").splitlines()
        starts = [i for i, l in enumerate(text) if re.match(r"^== .* begins", l)]
        if not starts:
            continue
        i0 = starts[-1]
        rows, name = [], None
        for l in text[i0:]:
            if l.startswith("== "):
                name = l[3:]
                continue
            if not l.strip() or name is None:
                continue
            try:
                j = json.loads(l)
                act = json.loads(j["act"]) if isinstance(j.get("act"), str) else (j.get("act") or {})
            except Exception:
                rows.append({"name": name, "raw": l[:300]})
                continue
            rows.append({"name": name, "held_mb": j.get("held_mb"), "page_errors": act.get("pageErrorCount") if isinstance(act, dict) else None,
                         "tel_errors": (j.get("telemetry") or {}).get("error"), "tel_warns": (j.get("telemetry") or {}).get("warn"),
                         "act_error": act.get("error") if isinstance(act, dict) else None,
                         "result": json.dumps(act)[:400] if isinstance(act, dict) else str(act)[:400]})
        over = any(re.match(r"^== .* over", l) for l in text[i0:])
        bad = sum(1 for r in rows if (r.get("page_errors") or 0) > 0 or (r.get("tel_errors") or 0) > 0 or r.get("act_error"))
        out.append({"log": log.name, "began": text[i0][3:], "finished": over, "runs": rows, "problems": bad})
    return out


def start_pass(kind: str, who: str) -> dict:
    script = PASSES.get(kind)
    if not script:
        raise ValueError(f"no pass named {kind}")
    j = start_job("battery", f"battery — {kind} pass", ["/bin/bash", str(BATTERY / script)], who, cwd=BATTERY)
    return {"ok": True, "job": j.to_dict()}


SUITES = {
    "web": (["npx", "vitest", "run", "--exclude", "**/collectionBalloon.cycle*", "--exclude", "**/collectionField.gr1*", "--reporter=dot"], REPO / "curator-web"),
    "api": ([str(REPO / "curator-api" / ".venv" / "bin" / "python"), "-m", "pytest", "-q", "-rfE", "-p", "no:cacheprovider"], REPO / "curator-api"),
}


def start_suite(kind: str, who: str) -> dict:
    cmd, cwd = SUITES[kind]
    env = {"PYTHONPATH": str(REPO / "curator-api")} if kind == "api" else None
    j = start_job("tests", f"{kind} test suite", cmd, who, cwd=cwd, env=env)
    return {"ok": True, "job": j.to_dict()}


# ── THE TRUE STATE BATTERY (tools/battery/true-state.sh) — started only by the petition `run-battery`, on the owner's yes ──
TRUE_STATE_SH = REPO / "tools" / "battery" / "true-state.sh"
TRUE_STATE_RUNS = REPO / "scratch" / "battery" / "true-state"
STARTED = LACUNA_HOME / "battery-true-state.jsonl"      # run → job, pid, log: the battery-status hand reads it
API_ACTS = ("carts", "cloning", "matrix", "notifications", "counts")   # api_acts.py ACTS: the acts true-state.sh runs alone (ACTS=)


def one_act(name: str) -> str | None:
    """The API act a card's pick names (`counts-api` is the counts act's verdict name), or None for any other act."""
    n = str(name or "").removesuffix("-api")
    return n if n in API_ACTS else None


def _runs() -> set[str]:
    return {p.name for p in TRUE_STATE_RUNS.iterdir() if p.is_dir()} if TRUE_STATE_RUNS.is_dir() else set()


def start_true_state(who: str, wait_s: float = 20.0, acts: str | None = None) -> dict:
    """Start the True State battery in the background in ~/code/curator and answer its run id (the folder the script
    makes in its first second). One at a time: a run still going is answered, not doubled. `acts` names one API act
    (one_act): the script runs it alone (ACTS=<act>, UI=0); None runs every act."""
    from . import hands
    newest = sorted(r for r in _runs() if hands.RUN_ID.match(r))[-1:]
    if newest:
        try:
            v = hands.battery_status(newest[0])
        except (OSError, ValueError):
            v = {}
        if not v.get("done") and v.get("running"):
            return {"ok": False, "why": f"a True State run is still going ({newest[0]}) — read it with battery-status",
                    "run": newest[0]}
    if not TRUE_STATE_SH.exists():
        return {"ok": False, "why": f"{TRUE_STATE_SH} is not on this machine"}
    before = _runs()
    one = one_act(acts) if acts else None
    if acts and not one:
        return {"ok": False, "why": f"'{str(acts)[:40]}' is not one of the acts the battery runs alone ({' · '.join(API_ACTS)})"}
    job = start_job("battery", f"True State battery (tools/battery/true-state.sh){f' · {one} alone' if one else ''}", ["/bin/bash", str(TRUE_STATE_SH)],
                    who, cwd=REPO, env={"ACTS": one, "UI": "0"} if one else None)
    run, t0 = None, time.time()
    while time.time() - t0 < wait_s:
        new = sorted(_runs() - before)
        if new:
            run = new[-1]
            break
        if job.code is not None:
            break
        time.sleep(0.5)
    rec = {"at": time.time(), "run": run, "job": job.id, "pid": job.pid, "log": str(job.log), "who": who}
    with open(STARTED, "a") as f:
        f.write(json.dumps(rec) + "\n")
    audit(who, "battery.true-state.start", run=run, job=job.id, act=one)
    if not run:
        return {"ok": job.code in (None, 0), "job": job.id, "log": str(job.log),
                "why": "the battery did not make its run folder yet — its log says why" if job.code is None
                else f"the battery stopped at once (exit {job.code}) — its log says why (the switches, the dev API)"}
    return {"ok": True, "run": run, "job": job.id, "log": str(job.log),
            "said": f"the True State battery is running as {run} (~20 min); battery-status {run} follows it"}
