"""A JOB THAT IS STUCK IS SAID, WITH WHERE AND WHAT TO DO (the owner, 2026-10-19: "help it know when releases are stuck.
don't let it happen again").

The release of 2026-10-19 09:02 sat 40 minutes in its web tests: one test (MockShopCard → ShopWall ↔ loadShops) looped
inside a vitest worker at 100% CPU, the job's log said "testing …" the whole time, and the release card said "running".
Nothing on the desk knew that a promote takes ~6 minutes.

Every minute (workers._pass) each running job is held against ITS OWN KIND'S HISTORY — the jobs on disk with an exit
code: overdue past the largest of 3 × the median, 1.5 × the longest good run, and FLOOR_S; a kind with fewer than
MIN_HISTORY ended runs uses DEFAULT_S. An overdue job raises one alert (`stuck:<job id>`) that says how long, how long
it usually takes, how long its log has been quiet, and — when a vitest worker under it is burning CPU — WHICH TEST
(toolbox/vitest-hung.mjs). The alert clears itself when the job ends.

  GET /api/jobs/stuck and POST /api/jobs/{id}/unstick are the door's (lacuna-node/frontend/jobs.mjs, 2026-11-06, finale
  §3.12); history(), stuck(), words() and unstick() stay here for the minute pass (check) and the release run's card.

Lacuna unsticks a HUNG TEST on its own, once per job: the promote gate does the same act itself (web_run) and the act
can only make the gate stricter — a stopped test is a failure, never a pass. Everything else waits for a person.
"""
from __future__ import annotations

import json
import os
import statistics
import subprocess
import time
from pathlib import Path

from .core import LACUNA_HOME, audit, job, jobs

FLOOR_S = 15 * 60
DEFAULT_S = 60 * 60
MIN_HISTORY = 3
TOOLBOX = Path(__file__).resolve().parents[3] / "toolbox"
HUNG = TOOLBOX / "vitest-hung.mjs"
NODE = next((p for p in ("/opt/homebrew/bin/node", "/usr/local/bin/node") if os.path.exists(p)), "node")
_said: dict[str, float] = {}          # job id → when its alert was raised
_unstuck: set[str] = set()            # jobs Lacuna already unstuck on its own (once each)
_hist: dict = {"t": 0.0, "by": {}}


def history() -> dict[str, dict]:
    """kind → {n, median_s, longest_ok_s, limit_s}, from the ended jobs on disk (cached 10 min)."""
    if time.time() - _hist["t"] < 600 and _hist["by"]:
        return _hist["by"]
    runs: dict[str, list[tuple[float, bool]]] = {}
    for p in (LACUNA_HOME / "jobs").glob("*.json"):
        code = p.with_suffix(".code")
        try:
            m = json.loads(p.read_text())
            if not code.exists() or not m.get("started"):
                continue
            runs.setdefault(m.get("kind") or "?", []).append((code.stat().st_mtime - float(m["started"]), code.read_text().strip() == "0"))
        except Exception:  # noqa: BLE001 — one unreadable job never hides the rest
            continue
    by = {}
    for kind, rs in runs.items():
        took = [t for t, _ in rs if t > 0]
        good = [t for t, ok in rs if ok and t > 0]
        if len(took) < MIN_HISTORY:
            by[kind] = {"n": len(took), "median_s": None, "longest_ok_s": None, "limit_s": DEFAULT_S}
            continue
        med = statistics.median(took)
        lng = max(good) if good else max(took)
        by[kind] = {"n": len(took), "median_s": round(med), "longest_ok_s": round(lng),
                    "limit_s": round(max(3 * med, 1.5 * lng, FLOOR_S))}
    _hist.update(t=time.time(), by=by)
    return by


def _hot_tests(pid: int, kill: bool = False) -> list[dict]:
    """The vitest workers under <pid> burning CPU, each with the file and test it is in (vitest-hung.mjs)."""
    if not pid or not HUNG.exists():
        return []
    try:
        out = subprocess.run([NODE, str(HUNG), str(pid), *(["--kill"] if kill else [])], capture_output=True, text=True, timeout=90).stdout
    except Exception:  # noqa: BLE001
        return []
    found = []
    for line in out.splitlines():
        try:
            found.append(json.loads(line))
        except ValueError:
            continue
    return found


def _mins(s: float | None) -> str:
    return "?" if s is None else f"{s / 60:.0f} min"


def diagnose(r: dict) -> dict:
    """What an overdue job is stuck on: the hot test workers under it (opens each one's inspector once — not per poll)."""
    m = json.loads((LACUNA_HOME / "jobs" / f"{r['id']}.json").read_text())
    return {**r, "hung_tests": _hot_tests(int(m.get("pid") or 0))}


def stuck(diagnose_overdue: bool = False) -> list[dict]:
    """Every running job with its usual time; an overdue one carries what it is stuck on."""
    h = history()
    out = []
    for j in jobs(60):
        if not j.get("running"):
            continue
        k = h.get(j["kind"]) or {"n": 0, "median_s": None, "longest_ok_s": None, "limit_s": DEFAULT_S}
        ran = time.time() - float(j["started"])
        log = LACUNA_HOME / "jobs" / f"{j['id']}.log"
        quiet = time.time() - log.stat().st_mtime if log.exists() else None
        last = ""
        if log.exists():
            lines = [x for x in log.read_text(errors="replace").splitlines() if x.strip()]
            last = lines[-1][:200] if lines else ""
        row = {"id": j["id"], "kind": j["kind"], "title": j["title"], "ran_s": round(ran), "quiet_s": round(quiet) if quiet else None,
               "usual_s": k["median_s"], "limit_s": k["limit_s"], "history": k["n"], "overdue": ran > k["limit_s"], "last_line": last}
        out.append(diagnose(row) if row["overdue"] and diagnose_overdue else row)
    return out


def words(r: dict) -> str:
    """What the alert and Lacuna say about one overdue job — BLUF: where it is stuck and what to do, then the numbers."""
    hung = r.get("hung_tests") or []
    nums = (f"{r['kind']} has run {_mins(r['ran_s'])}, usually {_mins(r['usual_s'])} (limit {_mins(r['limit_s'])}); "
            f"log quiet {_mins(r['quiet_s'])}; last line: {r['last_line'][:120]}")
    if hung:
        names = "; ".join(f"{x.get('file') or 'a worker it could not read'} :: {x.get('test') or '?'}" for x in hung)
        return f"Stuck in a test: {names}. Unstick stops that worker; the file re-runs and a hang counts as a failure. {nums}."
    return f"{r['title'][:80]} is past its usual time and no test worker under it is hung. Read its log; if nothing moves, cancel it from its card. {nums}."


def check(raise_alert, resolve_alert) -> None:
    """The minute pass: raise one alert per overdue job, unstick a hung test once, clear alerts for jobs that ended."""
    running = set()
    for r in stuck():
        running.add(r["id"])
        if not r["overdue"] or r["id"] in _said:
            continue
        _said[r["id"]] = time.time()
        r = diagnose(r)
        raise_alert(f"stuck:{r['id']}", "warn", f"{r['kind']} stuck — {_mins(r['ran_s'])}, usually {_mins(r['usual_s'])}", words(r))
        if r.get("hung_tests") and r["id"] not in _unstuck:
            _unstuck.add(r["id"])
            done = unstick(r["id"], "lacuna")
            raise_alert(f"stuck:{r['id']}", "info", f"{r['kind']}: Lacuna stopped the hung test worker", done["said"], notify=False)
    for jid in [x for x in _said if x not in running]:
        _said.pop(jid, None)
        resolve_alert(f"stuck:{jid}", "the job ended")


def unstick(job_id: str, who: str) -> dict:
    j = job(job_id)
    if not j or j.ended is not None:
        return {"ok": False, "said": "that job is not running"}
    stopped = _hot_tests(int(j.pid or 0), kill=True)
    audit(who, "job.unstick", job=job_id, stopped=[f"{x.get('file')} :: {x.get('test')}" for x in stopped])
    if not stopped:
        return {"ok": False, "said": "no hung test worker under this job; if its log does not move, cancel it from its card"}
    return {"ok": True, "stopped": stopped,
            "said": "stopped " + "; ".join(f"{x.get('file')} :: {x.get('test')}" for x in stopped)
                    + " — vitest re-runs the file in a fresh worker; the gate counts a hang as a failure"}

