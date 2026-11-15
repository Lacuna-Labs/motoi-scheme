"""ERRAND LAWS — what the best long-running agent harnesses do, applied to Lacuna's errands (2026-10-11).

From the research (Anthropic "effective harnesses for long-running agents" and the multi-agent research system; Manus
"context engineering"; Temporal activity timeouts; LangGraph durable execution; Claude Code scheduled tasks):

  done_check   "done" is a CHECK that passes, never exit 0 or a count reaching its total — premature victory is the
               failure mode they name first. A job.json `done_check` command runs inside the jail; until it exits 0,
               the errand is not done.
  plan.md      the agent's own plan, rewritten every step and read first on every run; the check-in and the repair
               see it, so the goal never falls out of the window.
  heartbeat    a live pid is not health: a running errand must leave a mark (progress.json, run.log or a `heartbeat`
               file) at least every `heartbeat_timeout` (default 20m) or it is called stalled and restarted.
  expiry       repeating errands expire after `expires` (default 7d from creation; renew with `errands renew`); any
               errand may carry an absolute `deadline`. Nothing loops forever unnoticed.
  journal      an append-only journal.jsonl of every runner event — start, exit, interruption, stall, check-in,
               repair, done — for replay and for the morning digest.
  failures     kept verbatim: the last lines of the failing run go into notes.md and the check-in, so nobody
               repeats the same mistake from a tidied summary.
  repair       when a check-in says stuck or failing, the WORKING agent (Pi, in the jail) is woken with the errand
               rebuilt from its files and a fixed startup routine — not just a small model commenting. Budgeted:
               `max_repairs` (default 2), one at a time, 30 minutes each, never while the poster bake has the GPU.
  digest       one morning push a day: what is running, what finished, failed or expired, and any self-audit finding.
"""
from __future__ import annotations

import datetime as dt
import json
import os
import signal
import subprocess
import time

HOME = os.path.expanduser("~")
PROFILE = f"{HOME}/.lacuna/jail/lacuna.sb"
GPU_BUSY = f"{HOME}/.lacuna/jail/gpu-busy"
JAIL_PATH = f"{HOME}/lacuna-world/tools:{HOME}/.local/bin:/opt/homebrew/bin:/usr/bin:/bin:/usr/sbin:/sbin"
LACUNA_PI = f"{HOME}/.local/bin/lacuna-pi"
REPAIR_MINUTES = 30


def journal(job_dir: str, event: str, **facts) -> None:
    with open(f"{job_dir}/journal.jsonl", "a") as f:
        f.write(json.dumps({"t": round(time.time(), 1), "at": dt.datetime.now().isoformat(timespec="seconds"),
                            "event": event, **facts}) + "\n")


def last_mark(job_dir: str) -> float:
    """When the errand last showed a sign of life: the newest of its progress, log and heartbeat files."""
    marks = [os.path.getmtime(p) for p in (f"{job_dir}/progress.json", f"{job_dir}/run.log", f"{job_dir}/heartbeat")
             if os.path.exists(p)]
    return max(marks) if marks else 0.0


def stalled(job_dir: str, job: dict, rs: dict, seconds) -> bool:
    limit = seconds(job.get("heartbeat_timeout") or "20m") or 1200
    started = rs.get("started") or time.time()
    return time.time() - max(last_mark(job_dir), started) > limit


def expired(job: dict, seconds, when) -> str:
    deadline = when(job.get("deadline"))
    if deadline and time.time() > deadline:
        return f"passed its deadline ({job['deadline']})"
    if job.get("every") and job.get("expires") != "never":
        created = when(job.get("renewed") or job.get("created")) or time.time()
        life = seconds(job.get("expires") or "7d") or 7 * 86400
        if time.time() > created + life:
            return f"expired — repeating errands live {job.get('expires') or '7d'} unless renewed (`errands renew`)"
    return ""


def failure_excerpt(job_dir: str, lines: int = 8) -> str:
    """The failing run's own last lines, verbatim (from the last start marker on)."""
    try:
        log = open(f"{job_dir}/run.log", errors="replace").read()
    except OSError:
        return ""
    run = log.rsplit("── ", 1)[-1]
    return "\n".join(run.strip().splitlines()[-lines:])


def verify_done(job_dir: str, job: dict) -> tuple[bool, str]:
    """Run the errand's done_check inside the jail. No check declared → trust the exit (and say so in the notes)."""
    check = job.get("done_check")
    if not check:
        return True, ""
    try:
        r = subprocess.run(["/usr/bin/sandbox-exec", "-f", PROFILE, "/bin/zsh", "-c", f"cd {json.dumps(job_dir)} && {check}"],
                           capture_output=True, text=True, timeout=300,
                           env={"HOME": HOME, "PATH": JAIL_PATH, "LANG": "en_US.UTF-8", "TMPDIR": "/tmp"})
        out = ((r.stdout or "") + (r.stderr or "")).strip()[-600:]
        return r.returncode == 0, out
    except subprocess.TimeoutExpired:
        return False, "the done check took longer than 5 minutes"


def plan_text(job_dir: str, lines: int = 40) -> str:
    try:
        return "".join(open(f"{job_dir}/plan.md", errors="replace").readlines()[:lines]).strip()
    except OSError:
        return ""


# ── repair: wake the working agent ────────────────────────────────────────────────────────────────────────────────────
REPAIR_PROMPT = """You are Lacuna, resuming a background errand that your check-in says is {status}: "{note}".
You have no memory of it beyond its folder. Startup routine — do these in order:
1. cd {job_dir} and read job.json, plan.md, the end of notes.md, the end of run.log, progress.json.
2. Say in one line what the errand is for and what went wrong (quote the error).
3. Fix the cause with the smallest change inside this folder (the command, the script, the data). Do not start the
   errand's long work yourself — the runner reruns it within a minute of your fix.
4. Rewrite plan.md: what is done, what is next, what you changed and why.
5. `errands note {name} "repair: <what you found and changed>"`. If you cannot fix it, say exactly why in that note
   and stop — the owner will be told.
Work only inside {job_dir}. Be brief."""


def repair_running(rs: dict) -> bool:
    pid = rs.get("repair_pid")
    if not pid:
        return False
    try:
        os.kill(pid, 0)
    except OSError:
        rs["repair_pid"] = None
        return False
    if time.time() - rs.get("repair_started", 0) > REPAIR_MINUTES * 60:
        try:
            os.killpg(pid, signal.SIGTERM)
        except OSError:
            pass
        rs["repair_pid"] = None
        return False
    return True


def start_repair(job_dir: str, job: dict, rs: dict, status: str, note: str) -> str:
    """Start Pi (in its jail, through its own launcher) on this errand. Returns words for the notes, or '' if not now."""
    if repair_running(rs) or job.get("self_repair") is False:
        return ""
    if rs.get("repairs", 0) >= int(job.get("max_repairs", 2)):
        return ""
    if os.path.exists(GPU_BUSY):
        return "a repair is waiting — the deeper mind is resting while the GPU is busy"
    prompt = REPAIR_PROMPT.format(status=status, note=note.replace('"', "'"), job_dir=job_dir, name=job["name"])
    log = open(f"{job_dir}/repair.log", "a")
    log.write(f"\n── {dt.datetime.now():%Y-%m-%d %H:%M} repair ({status}) ──\n")
    log.flush()
    p = subprocess.Popen([LACUNA_PI, "-p", prompt], cwd=job_dir, stdout=log, stderr=subprocess.STDOUT,
                         start_new_session=True, env={"HOME": HOME, "PATH": JAIL_PATH, "LANG": "en_US.UTF-8"})
    rs.update(repair_pid=p.pid, repair_started=time.time(), repairs=rs.get("repairs", 0) + 1)
    journal(job_dir, "repair", status=status, pid=p.pid)
    return f"woke the working agent to repair it (repair {rs['repairs']} of {job.get('max_repairs', 2)}; see repair.log)"


# ── the morning digest ────────────────────────────────────────────────────────────────────────────────────────────────
def digest_due(state: dict, hour: int = 8) -> bool:
    today = dt.date.today().isoformat()
    return dt.datetime.now().hour >= hour and state.get("digest_day") != today


def digest(jobs_dir: str, read_json, findings: dict) -> str:
    since = time.time() - 86400
    running, finished, failed = [], [], []
    for name in sorted(os.listdir(jobs_dir)):
        job = read_json(f"{jobs_dir}/{name}/job.json", None)
        if not job or job.get("kind") == "remind":
            continue
        p = read_json(f"{jobs_dir}/{name}/progress.json", {})
        changed = os.path.getmtime(f"{jobs_dir}/{name}/job.json")
        state = job.get("state", "on")
        prog = f" {p.get('done')}/{p.get('total')}" if p.get("total") else ""
        if state == "on":
            running.append(name + prog)
        elif changed > since and state == "done":
            finished.append(name)
        elif changed > since and state in ("failed", "expired"):
            failed.append(f"{name} ({state})")
    parts = []
    if running:
        parts.append("running: " + ", ".join(running))
    if finished:
        parts.append("finished: " + ", ".join(finished))
    if failed:
        parts.append("NEEDS YOU: " + ", ".join(failed))
    if findings:
        parts.append("self-audit: " + "; ".join(f"{n}: {', '.join(w.values())}" for n, w in findings.items()))
    return "Good morning — errands. " + (" · ".join(parts) if parts else "Nothing running, nothing failed.")
