"""TELEMETRY LACUNA READS — the numbers that say whether the work is healthy (2026-10-11).

The owner: "Get the correct telemetry you should be collecting, and make sure Lacuna can read that telemetry and solve
problems." Each reader returns a small, plain dict a model can read; `broken()` folds them into one answer to
"what's broken?". Every reader is read-only and opens the Curator's databases with mode=ro.

  apis      dev :5051 and QA :5050 — answering, sha, latency
  routes    error rate by route (5xx), from the API's own route lines (errors.db `paths`)
  sakura    the Sakura harness: turns, latency, tool errors, empty replies (~/.curator-dev/sakura/turns.jsonl)
  carts     cart runs on dev (run_events.db `runs`): outcomes, stuck runs, the slugs that stop most
  strict    the strict cart checker's newest summary (scratch/honest-count/*.summary.json) and its change
  posters   the poster bake: queued, on disk, remaining, baking, last log line
  battery   the newest battery pass: finished, acts, acts with problems
  errands   Lacuna's errands (~/lacuna-world/jobs): which are on, which came back by themselves after the last boot —
            a resurrected long job (the poster bake after the 10-11 reboot) is ANNOUNCED, never silent

ALERTS (section `telemetry`, every minute, edge-triggered, said once): only real faults, never a work-in-progress
count. Sakura failing (≥5 turns in 30 min and ≥30 % tool errors or ≥3 empty replies); a route failing (≥10 calls in
15 min, ≥50 % 5xx); a cart run stuck in `running` over an hour; the poster bake alive but silent 30 min; a battery
pass that finished with problems. Each clears itself when the condition ends.
"""
from __future__ import annotations

import json
import os
import sqlite3
import statistics
import time
import urllib.request
from pathlib import Path

from .core import ENVS, HOME, REPO

SAKURA_TURNS = HOME / ".curator-dev" / "sakura" / "turns.jsonl"
RUN_EVENTS = HOME / ".curator-dev" / "run_events.db"
HONEST = REPO / "scratch" / "honest-count"
POSTER_DIR = REPO / "curator-web" / "public" / "automations" / "poster"
POSTER_TODO = REPO / "scratch" / "cart-fix" / "posters-todo.json"
POSTER_LOGS = HOME / ".lacuna" / "logs"            # posters.log, posters-top250.log …: the bake writes the newest
POSTER_PID = HOME / ".lacuna" / "jail" / "posters.pid"
JOBS = HOME / "lacuna-world" / "jobs"


def boot_time() -> float | None:
    import re
    import subprocess
    try:
        out = subprocess.run(["/usr/sbin/sysctl", "-n", "kern.boottime"], capture_output=True, text=True, timeout=5).stdout
        return float(re.search(r"sec = (\d+)", out).group(1))
    except Exception:                                                 # noqa: BLE001
        return None


def _ro(path: Path) -> sqlite3.Connection:
    return sqlite3.connect(f"file:{path}?mode=ro", uri=True, timeout=3)


def _tail_lines(path: Path, max_bytes: int = 2_000_000) -> list[str]:
    try:
        with open(path, "rb") as f:
            f.seek(0, os.SEEK_END)
            size = f.tell()
            f.seek(max(0, size - max_bytes))
            return f.read().decode("utf-8", "replace").splitlines()[1 if size > max_bytes else 0:]
    except OSError:
        return []


def _pct(arr: list[float], q: float):
    if not arr:
        return None
    a = sorted(arr)
    return a[min(len(a) - 1, int(len(a) * q))]


# ── readers ─────────────────────────────────────────────────────────────────────────────────────────────────────
def apis() -> dict:
    out = {}
    for env, e in ENVS.items():
        t0 = time.time()
        try:
            with urllib.request.urlopen(f"http://127.0.0.1:{e['port']}/healthz", timeout=4) as r:
                j = json.loads(r.read().decode() or "{}")
            out[env] = {"answering": True, "ms": int((time.time() - t0) * 1000), "sha": str(j.get("sha") or "")[:10],
                        "status": j.get("status") or j.get("ok")}
        except Exception as ex:                                       # noqa: BLE001
            out[env] = {"answering": False, "why": f"{ex.__class__.__name__}: {ex}"[:160]}
    return out


def routes(minutes: int = 60, env: str | None = None, top: int = 10) -> list[dict]:
    """Routes by 5xx count over the last `minutes` (dev and QA), worst first; only routes that failed at least once."""
    from . import errors
    since = int((time.time() - minutes * 60) // 60)
    sql = "SELECT env, path, SUM(n), SUM(err) FROM paths WHERE minute >= ?"
    args: list = [since]
    if env:
        sql += " AND env=?"
        args.append(env)
    with errors._lock:
        rows = errors.db().execute(sql + " GROUP BY env, path HAVING SUM(err) > 0 ORDER BY SUM(err) DESC LIMIT ?",
                                   args + [top]).fetchall()
    return [{"env": e, "route": p, "calls": n, "errors_5xx": er, "error_rate": round(er / n, 2) if n else None}
            for e, p, n, er in rows]


def sakura(minutes: int = 24 * 60) -> dict:
    """The Sakura harness over the last `minutes`: counts and latency only — never what anyone said."""
    cut = time.time() - minutes * 60
    turns = []
    for line in _tail_lines(SAKURA_TURNS):
        try:
            j = json.loads(line)
        except ValueError:
            continue
        if float(j.get("t") or 0) >= cut:
            turns.append(j)
    if not turns:
        return {"window_min": minutes, "turns": 0, "last_turn": None}
    total = [float((t.get("ms") or {}).get("total") or 0) for t in turns if (t.get("ms") or {}).get("total")]
    first = [float((t.get("ms") or {}).get("first_word") or 0) for t in turns if (t.get("ms") or {}).get("first_word")]
    steps = [s for t in turns for s in (t.get("steps") or [])]
    bad_tools: dict[str, int] = {}
    for s in steps:
        if s.get("ok") is False:
            bad_tools[str(s.get("tool"))] = bad_tools.get(str(s.get("tool")), 0) + 1
    empty = sum(1 for t in turns if not str(t.get("reply") or "").strip())
    return {"window_min": minutes, "turns": len(turns), "last_turn": time.strftime("%H:%M", time.localtime(turns[-1]["t"])),
            "first_word_ms_p50": _pct(first, .5), "total_ms_p50": _pct(total, .5), "total_ms_p95": _pct(total, .95),
            "tool_calls": len(steps), "tool_errors": sum(bad_tools.values()), "tool_errors_by_tool": bad_tools,
            "empty_replies": empty, "brains": sorted({str(t.get("provenance") or "?")[:40] for t in turns})}


def carts(hours: int = 24, top: int = 8) -> dict:
    """Cart runs on dev over the last `hours` (the run spine). An escalate is often an honest stop (no shop
    connected); `stuck` are runs still `running` an hour after they started — that is a fault."""
    since_ms = int((time.time() - hours * 3600) * 1000)
    try:
        c = _ro(RUN_EVENTS)
        by = dict(c.execute("SELECT outcome, COUNT(*) FROM runs WHERE started_at >= ? GROUP BY outcome", (since_ms,)))
        stops = c.execute("SELECT slug, COALESCE(stop_family, stop_cause, ''), COUNT(*) FROM runs WHERE started_at >= ? "
                          "AND outcome NOT IN ('done','running') GROUP BY slug ORDER BY 3 DESC LIMIT ?",
                          (since_ms, top)).fetchall()
        stuck = c.execute("SELECT slug, run_id, started_at FROM runs WHERE outcome='running' AND started_at >= ? "
                          "AND started_at < ?", (since_ms, int((time.time() - 3600) * 1000))).fetchall()
        last = c.execute("SELECT MAX(started_at) FROM runs").fetchone()[0]
        c.close()
    except sqlite3.Error as e:
        return {"error": f"run_events.db: {e}"}
    return {"window_h": hours, "by_outcome": by, "stops_most": [{"slug": s, "why": w, "runs": n} for s, w, n in stops],
            "stuck_running": [{"slug": s, "run": r, "started": time.strftime("%m-%d %H:%M", time.localtime(t / 1000))}
                              for s, r, t in stuck],
            "last_run": time.strftime("%m-%d %H:%M", time.localtime(last / 1000)) if last else None}


def strict(top: int = 8) -> dict:
    """The strict cart checker: the newest summary, its biggest failure classes, and works vs the summary before it."""
    sums = sorted(HONEST.glob("*.summary.json"), key=lambda p: p.stat().st_mtime, reverse=True)
    if not sums:
        # THE HONEST NULL (C10, 2026-10-24; docs/review/POSTMORTEMS.md, the scratch folders moved and emptied): the
        # checker's counts were lost with scratch/honest-count; nothing is shown as a count until it runs again
        return {"summaries": 0, "source": str(HONEST / "*.summary.json"),
                "why": "no strict summary: the checker's counts in scratch/honest-count were lost 2026-10-24; "
                       "they return when the strict checker runs again"}

    def one(p: Path) -> dict:
        j = json.loads(p.read_text())
        cls = j.get("cls") or {}
        works = sum(v for k, v in cls.items() if k in ("strict:works", "strict:works-model"))
        return {"file": p.name, "at": j.get("at"), "carts": sum(cls.values()), "strict_works": works,
                "verdicts": j.get("verdicts"), "top_failures": dict(sorted(((k, v) for k, v in cls.items()
                                                                        if "works" not in k), key=lambda x: -x[1])[:top])}
    newest = one(sums[0])
    full = [p for p in sums if p.name.startswith("runs-all")]
    newest["full_run"] = one(full[0]) if full and full[0] != sums[0] else None
    return newest


def posters() -> dict:
    try:
        queue = json.loads(POSTER_TODO.read_text())
    except (OSError, ValueError):
        queue = []
    on_disk = {p.stem for p in POSTER_DIR.glob("*.webp")} if POSTER_DIR.exists() else set()
    pid = None
    try:
        pid = int(POSTER_PID.read_text().strip())
        os.kill(pid, 0)
    except (OSError, ValueError):
        pid = None
    last, age = None, None
    logs = sorted(POSTER_LOGS.glob("posters*.log"), key=lambda q: q.stat().st_mtime)
    if logs:
        tail = _tail_lines(logs[-1], 4000)
        last = f"{logs[-1].name}: " + (tail[-1][:200] if tail else "")
        age = int(time.time() - logs[-1].stat().st_mtime)
    return {"queued": len(queue), "remaining": sum(1 for s in queue if s not in on_disk), "on_disk": len(on_disk),
            "baking": bool(pid), "log_quiet_s": age, "last_line": last}


def battery_latest() -> dict:
    from . import battery
    try:
        ps = battery.passes()
    except Exception as e:                                            # noqa: BLE001
        return {"error": f"{e.__class__.__name__}: {e}"[:160]}
    if not ps:
        return {"passes": 0}
    p = ps[0]
    bad = [r["name"] for r in p["runs"] if (r.get("page_errors") or 0) > 0 or (r.get("tel_errors") or 0) > 0 or r.get("act_error")]
    return {"log": p["log"], "began": p["began"], "finished": p["finished"], "acts": len(p["runs"]),
            "acts_with_problems": bad[:12], "problems": p["problems"]}


def errands() -> dict:
    """Every errand that is on, and the ones that started again by themselves since the machine booted (the runner
    resumes an interrupted run, and a periodic errand — like the poster watcher — restarts its job). The data is the
    runner's own files, read as data."""
    boot = boot_time()
    on, since_boot = [], []
    for jf in sorted(JOBS.glob("*/job.json")):
        try:
            job = json.loads(jf.read_text())
        except (OSError, ValueError):
            continue
        try:
            rs = json.loads((jf.parent / ".runner.json").read_text())
        except (OSError, ValueError):
            rs = {}
        if job.get("state") not in ("on", "paused") or job.get("kind") == "remind":
            continue
        row = {"name": job.get("name") or jf.parent.name, "goal": (job.get("goal") or "")[:160], "state": job.get("state"),
               "every": job.get("every"), "runs": rs.get("runs", 0), "interrupted": rs.get("interrupted", 0),
               "running": bool(rs.get("pid")),
               "last_start": time.strftime("%m-%d %H:%M", time.localtime(rs["started"])) if rs.get("started") else None,
               "first_started": time.strftime("%m-%d %H:%M", time.localtime(rs["first_started"])) if rs.get("first_started") else None}
        on.append(row)
        if boot and (rs.get("started") or 0) >= boot:
            since_boot.append(row)
    return {"booted": time.strftime("%m-%d %H:%M", time.localtime(boot)) if boot else None, "on": on,
            "came_back_after_boot": since_boot}


PARTS = {"apis": apis, "routes": routes, "sakura": sakura, "carts": carts, "strict": strict, "posters": posters,
         "battery": battery_latest, "errands": errands}


def read(part: str | None = None) -> dict:
    if part:
        if part not in PARTS:
            raise KeyError(part)
        return {part: PARTS[part]()}
    out = {}
    for k, fn in PARTS.items():
        try:
            out[k] = fn()
        except Exception as e:                                        # noqa: BLE001
            out[k] = {"error": f"{e.__class__.__name__}: {e}"[:160]}
    return out


def broken() -> dict:
    """"What's broken?" — every reader and the open alerts, folded into plain findings, worst first."""
    from . import workers
    t = read()
    found: list[str] = []
    for env, a in t["apis"].items():
        if not a.get("answering"):
            found.append(f"{ENVS[env]['label']} is NOT answering ({a.get('why')})")
    for r in t["routes"][:5] if isinstance(t["routes"], list) else []:
        if r["error_rate"] and r["error_rate"] >= .2:
            found.append(f"{r['env']} route {r['route']} fails {int(r['error_rate'] * 100)}% ({r['errors_5xx']}/{r['calls']} in the last hour)")
    s = t["sakura"]
    if s.get("tool_errors"):
        found.append(f"Sakura: {s['tool_errors']} tool errors in {s['turns']} turns today ({s['tool_errors_by_tool']})")
    if s.get("empty_replies"):
        found.append(f"Sakura: {s['empty_replies']} empty replies today")
    c = t["carts"]
    if c.get("stuck_running"):
        found.append(f"{len(c['stuck_running'])} cart runs stuck in running: {[x['slug'] for x in c['stuck_running'][:5]]}")
    p = t["posters"]
    if p.get("baking") and (p.get("log_quiet_s") or 0) > 1800:
        found.append(f"the poster bake is alive but its log has been quiet {p['log_quiet_s'] // 60} min")
    b = t["battery"]
    if b.get("finished") and b.get("problems"):
        found.append(f"the last battery pass ({b['log']}) finished with {b['problems']} problem acts: {b['acts_with_problems'][:5]}")
    e = t.get("errands") or {}
    for r in e.get("came_back_after_boot") or []:
        found.append(f"after the boot at {e['booted']}, the errand '{r['name']}' came back by itself ({r['goal'] or 'no goal'}; "
                     f"run {r['runs']}, started first {r['first_started']}){' — it restarted the poster bake' if r['name'] == 'posters' and p.get('baking') else ''}"
                     " — pause it in the chat if it should not run")
    open_alerts = [f"{a['level']}: {a['title']}" for a in workers.alerts(60) if not a.get("acked") and a["level"] in ("error", "warn")]
    st = t["strict"]
    return {"findings": found or ["nothing is broken in the telemetry"], "open_alerts": open_alerts[:12],
            "strict_carts": {k: (st.get("full_run") or st).get(k) for k in ("file", "at", "carts", "strict_works", "top_failures")},
            "poster_bake": {k: p.get(k) for k in ("remaining", "on_disk", "baking")}}


# ── alerts: real faults only ─────────────────────────────────────────────────────────────────────────────────────
def evaluate(raise_alert, resolve_alert, state: dict) -> None:
    def edge(key: str, bad: bool, level: str, title: str, body: str):
        was = state.get(key, False)
        state[key] = bad
        if bad and not was:
            raise_alert(key, level, title, body)
        elif was and not bad:
            resolve_alert(key, "it ended")

    s = sakura(30)
    n = s.get("turns") or 0
    sick = n >= 5 and ((s.get("tool_errors") or 0) >= max(2, 0.3 * (s.get("tool_calls") or 0)) or (s.get("empty_replies") or 0) >= 3)
    edge("tel:sakura", sick, "error", "Sakura is failing turns",
         f"{n} turns in 30 min: {s.get('tool_errors')} tool errors {s.get('tool_errors_by_tool')}, {s.get('empty_replies')} empty replies")

    for env in ENVS:
        bad = [r for r in routes(15, env) if r["calls"] >= 10 and (r["error_rate"] or 0) >= .5]
        edge(f"tel:route:{env}", bool(bad), "error", f"{env}: a route is failing",
             "; ".join(f"{r['route']} {r['errors_5xx']}/{r['calls']} 5xx" for r in bad[:4]))

    stuck = carts(24).get("stuck_running") or []
    edge("tel:carts:stuck", bool(stuck), "warn", "cart runs stuck in running",
         f"{len(stuck)} runs over an hour: {[x['slug'] for x in stuck[:5]]}")

    p = posters()
    edge("tel:posters:silent", bool(p["baking"] and (p["log_quiet_s"] or 0) > 1800), "warn", "the poster bake went quiet",
         f"alive, but its log has not moved in {(p['log_quiet_s'] or 0) // 60} min; {p['remaining']} remaining")

    e = errands()
    back = e.get("came_back_after_boot") or []
    key = f"tel:resumed:{e.get('booted')}"
    if back and not state.get(key):
        state[key] = True     # said once per boot, with a push: a resurrected long job is announced
        raise_alert(key, "warn", "errands came back after the reboot",
                    "; ".join(f"{r['name']} ({r['goal'][:80]})" for r in back[:5]) + " — pause one in the family chat if it should not run")

    b = battery_latest()
    key = f"tel:battery:{b.get('log')}:{b.get('began')}"
    if b.get("finished") and b.get("problems") and not state.get(key):
        state[key] = True
        raise_alert(key, "warn", f"battery pass {b['log']} finished with problems",
                    f"{b['problems']} of {b['acts']} acts: {b['acts_with_problems'][:6]}")


def section():
    """The watcher's minute pass calls this (workers.SECTIONS)."""
    from . import workers
    evaluate(workers.raise_alert, workers.resolve_alert, workers._state)
