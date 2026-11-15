#!/usr/bin/env python3
"""THE JOB RUNNER — Lacuna's good old cron, and the reason it never forgets what it was doing (2026-10-11).

The owner: "if ever it forgets … it comes up, says: what was I doing? Oh, I was doing something, and it seems I was
rudely interrupted — and then it continues." Lacuna writes a job into its own world; this runner, OUTSIDE the jail,
wakes every minute (launchd StartInterval, and RunAtLoad after every reboot) and for each job:

  ~/lacuna-world/jobs/<name>/job.json   Lacuna writes it (the `errands` tool): goal, run, every, at, checkin, state
  ~/lacuna-world/jobs/<name>/notes.md   Lacuna's own notes AND the runner's — "where I left off"; the check-in reads it
  ~/lacuna-world/jobs/<name>/progress.json   the job's script writes {"done", "total", "note", "finished"}
  ~/lacuna-world/jobs/<name>/run.log    the script's output
  ~/lacuna-world/jobs/<name>/.runner.json   this runner's bookkeeping (pid, boot, starts, exits, check-ins)

  1. reminders ("tell me something in an hour") — at their time, a push to the owner's phone; then done;
  2. work — started INSIDE the jail (sandbox-exec, Lacuna's profile): a job can only do what Lacuna can do;
     a run that vanished without an exit (a reboot, a crash) is INTERRUPTED: noted, then resumed at once;
     exit 0 finishes a one-shot job (a repeating one waits for `every`); exit 75 means "not now, try in 5 min"
     (the GPU is busy); other exits retry with backoff, then the job is marked failed and the owner told;
     progress.json "finished": true ends a repeating job;
  3. check-ins — every `checkin` the quick model is woken with the job rebuilt from its files (goal, notes, progress,
     log tail) and answers fine / stuck / failing in a sentence; the sentence goes into notes.md, a "tell Alfred"
     becomes a push. A job whose progress did not move between two check-ins while running is stuck by arithmetic.

Pushes are rate-limited (6 an hour, all jobs together). Log: ~/.lacuna/logs/jobs.log. Standard library only.
"""
from __future__ import annotations

import datetime as dt
import glob
import json
import os
import sys
import re
import signal
import subprocess
import time
import turns
import desk_say
import urllib.request

from errandlaws import (digest, digest_due, expired, failure_excerpt, journal, plan_text, repair_running,
                        stalled, start_repair, verify_done)
from selfaudit import audit, runner_audit

HOME = os.path.expanduser("~")
JOBS = f"{HOME}/lacuna-world/jobs"
PROFILE = f"{HOME}/.lacuna/jail/lacuna.sb"
LOG = f"{HOME}/.lacuna/logs/jobs.log"
STATE = f"{HOME}/.lacuna/jobs-runner.json"
HEARTBEAT = f"{JOBS}/.heartbeat.json"           # stamped every tick: readers can tell a silent runner       # outside the world: the push budget Lacuna cannot reset
OLLAMA = "http://127.0.0.1:11434/api/chat"
def _desk_seat() -> dict:
    """THE ONE BRAIN (2026-10-17): the check-ins use the box's desk seat — its model AND its window, so a check-in never
    loads a second model nor reloads the first (`lacuna-desk` at 8K did both, and froze the runner nine minutes)."""
    try:
        with open(os.path.expanduser("~/.lacuna/box.json")) as f:
            return json.load(f)["seats"]["desk"]
    except (OSError, ValueError, KeyError):
        return {"model": "lacuna-worker-lite", "ctx": 65536}


CHECK_MODEL = _desk_seat().get("model", "lacuna-worker-lite")
CHECK_CTX = int(_desk_seat().get("ctx", 65536))
CHECK_WAIT_S = 90                  # a check-in that cannot get the brain in 90 s is arithmetic only — the runner never waits
TEMPFAIL = 75
MAX_TEMPFAILS = 12
PUSHES_PER_HOUR = 6
JAIL_PATH = f"{HOME}/lacuna-world/tools/bin:{HOME}/lacuna-world/tools:{HOME}/.local/bin:/opt/homebrew/bin:/usr/bin:/bin:/usr/sbin:/sbin"


def keep_desk_warm() -> None:
    """The desk is always on (2.0 §3): a one-token load with a day's keep_alive, only when it is not resident."""
    try:
        ps = subprocess.run(["/opt/homebrew/bin/ollama", "ps"], capture_output=True, text=True, timeout=10).stdout
        with open(f"{HOME}/.lacuna/box.json") as f:
            desk = json.load(f)["seats"]["desk"]
        if desk["model"] in ps:
            return
        body = json.dumps({"model": desk["model"], "prompt": "", "keep_alive": "24h", "options": {"num_ctx": desk.get("ctx", 16384)}}).encode()
        urllib.request.urlopen(urllib.request.Request("http://127.0.0.1:11434/api/generate", data=body,
                                                      headers={"Content-Type": "application/json"}), timeout=120).read()
        log(f"desk {desk['model']} warmed")
    except Exception as e:  # noqa: BLE001
        log(f"desk warm skipped: {e.__class__.__name__}: {e}")


def now() -> float:
    return time.time()


def stamp(t: float | None = None) -> str:
    return dt.datetime.fromtimestamp(t or now()).strftime("%Y-%m-%d %H:%M")


def log(line: str) -> None:
    os.makedirs(os.path.dirname(LOG), exist_ok=True)
    with open(LOG, "a") as f:
        f.write(f"{dt.datetime.now().isoformat(timespec='seconds')} {line}\n")


def seconds(span: str | None) -> int | None:
    """'15m' · '2h' · '1d' · '90s' → seconds."""
    m = re.fullmatch(r"\s*(\d+)\s*([smhd])\s*", span or "")
    return int(m.group(1)) * {"s": 1, "m": 60, "h": 3600, "d": 86400}[m.group(2)] if m else None


def when(at: str | None) -> float | None:
    try:
        return dt.datetime.fromisoformat(at).timestamp() if at else None
    except ValueError:
        return None


def read_json(path: str, default):
    try:
        with open(path) as f:
            return json.load(f)
    except (OSError, ValueError):
        return default


def write_json(path: str, obj) -> None:
    tmp = path + ".tmp"
    with open(tmp, "w") as f:
        json.dump(obj, f, indent=2)
    os.replace(tmp, path)


def boot_time() -> str:
    """A pid only means something within one boot — after a reboot every recorded pid is a stranger."""
    return subprocess.run(["/usr/sbin/sysctl", "-n", "kern.boottime"], capture_output=True, text=True).stdout.strip()


def alive(pid: int | None) -> bool:
    if not pid:
        return False
    try:
        os.kill(pid, 0)
        return True
    except OSError:
        return False


def note(job_dir: str, words: str) -> None:
    with open(f"{job_dir}/notes.md", "a") as f:
        f.write(f"\n- {stamp()} (runner) {words}\n")


def push(words: str) -> bool:
    """A push to the owner's phone, within the hour's budget (desk_say.push)."""
    return desk_say.push(words, STATE, read_json, write_json, now, log, PUSHES_PER_HOUR)


def tail(path: str, lines: int) -> str:
    try:
        with open(path, errors="replace") as f:
            return "".join(f.readlines()[-lines:])
    except OSError:
        return ""


# ── running a job inside the jail ─────────────────────────────────────────────────────────────────────────────────────
def start(job_dir: str, job: dict, rs: dict, why: str) -> None:
    ok, wait = turns.may_start(job)                   # heavy jobs take turns and need their memory (turns.py)
    if not ok:
        rs["not_before"], said, rs["waiting"] = now() + 60, rs.get("waiting"), wait
        return None if said == wait else note(job_dir, wait)
    exit_file = f"{job_dir}/.exit"
    if os.path.exists(exit_file):
        os.unlink(exit_file)
    script = f"cd {json.dumps(job_dir)} && {{ {job['run']} ; }} >> run.log 2>&1; echo $? > .exit"
    env = {"HOME": HOME, "PATH": JAIL_PATH, "LANG": "en_US.UTF-8", "LACUNA_JOB": job["name"], "TMPDIR": "/tmp"}
    with open(f"{job_dir}/run.log", "a") as f:
        f.write(f"\n── {stamp()} start ({why}) ──\n")
    p = subprocess.Popen(["/usr/bin/sandbox-exec", "-f", PROFILE, "/bin/zsh", "-c", script], cwd=job_dir, env=env,
                         start_new_session=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    rs.update(pid=p.pid, boot=boot_time(), started=now(), runs=rs.get("runs", 0) + 1)
    log(f"{job['name']}: started pid {p.pid} ({why})")
    journal(job_dir, "start", why=why, pid=p.pid, run=rs["runs"])


def stop_process(rs: dict) -> None:
    if alive(rs.get("pid")) and rs.get("boot") == boot_time():
        try:
            os.killpg(rs["pid"], signal.SIGTERM)
        except OSError:
            pass
    rs["pid"] = None


def finish(job_dir: str, job: dict, rs: dict, words: str, state: str = "done") -> None:
    job["state"] = state
    write_json(f"{job_dir}/job.json", job)
    note(job_dir, words)
    log(f"{job['name']}: {words}")
    if job.get("tell_when_done", True) or state == "failed":
        push(f"{job['name']}: {words}")
    if state in ("failed", "expired"):
        desk_say.say(f"Job {job['name']} {state}: {words[:200]} Work shows the run; a decision is needed.", log)



def tick_work(job_dir: str, job: dict, rs: dict) -> None:
    running = rs.get("pid") and rs.get("boot") == boot_time() and alive(rs["pid"])
    if running:
        limit = seconds(job.get("max_run")) or 24 * 3600
        if now() - rs.get("started", now()) > limit:
            stop_process(rs)
            rs["fails"] = rs.get("fails", 0) + 1
            note(job_dir, f"ran past its limit ({job.get('max_run') or '24h'}) — stopped it; will retry")
            journal(job_dir, "overran")
        elif stalled(job_dir, job, rs, seconds):
            stop_process(rs)
            rs["fails"] = rs.get("fails", 0) + 1
            rs["not_before"] = now() + 60
            note(job_dir, f"stalled — alive but no sign of work for {job.get('heartbeat_timeout') or '20m'} "
                          "(no progress, log or heartbeat); stopped it, restarting")
            journal(job_dir, "stalled")
        return

    if rs.get("pid"):                                   # it was running at the last look and is not now
        turns.done(job)
        exit_text = tail(f"{job_dir}/.exit", 1).strip()
        rs["pid"] = None
        rs["ended"] = now()
        if not exit_text:
            rs["interrupted"] = rs.get("interrupted", 0) + 1
            note(job_dir, "I was interrupted (a reboot or a crash) — picking up where I left off.")
            journal(job_dir, "interrupted")
            start(job_dir, job, rs, "resumed after an interruption")
            return
        code = int(exit_text) if exit_text.isdigit() else 1
        rs["last_exit"] = code
        journal(job_dir, "exit", code=code)
        progress = read_json(f"{job_dir}/progress.json", {})
        if code == 0 and (progress.get("finished") or not job.get("every")):
            ok, said = verify_done(job_dir, job)          # done is a check that passes, never exit 0 alone
            if ok:
                rs["fails"] = 0
                summary = progress.get("note") or (f"{progress.get('done')} of {progress.get('total')}"
                                                    if progress.get("total") else "finished")
                journal(job_dir, "done", verified=bool(job.get("done_check")))
                return finish(job_dir, job, rs, f"done — {summary}" + (" (verified)" if job.get("done_check") else ""))
            code = rs["last_exit"] = 1                     # a failed check IS a failed run — or the scheduler waits forever
            note(job_dir, f"the run said done, but the done check failed:\n```\n{said}\n```")
            journal(job_dir, "done-check-failed")
        if code != TEMPFAIL:
            rs["tempfails"] = 0
        if code == 0:
            rs["fails"] = 0
        elif code == TEMPFAIL:
            rs["not_before"] = now() + 300
            rs["tempfails"] = rs.get("tempfails", 0) + 1
            if rs["tempfails"] >= MAX_TEMPFAILS:     # S3: 12 busy-GPU runs in a row (1 h) is a stuck job, not a wait
                return finish(job_dir, job, rs, f"parked: exit {TEMPFAIL} (not now) {rs['tempfails']} times in a row; "
                                                "no run is scheduled until the owner restarts it", state="failed")
        else:
            rs["fails"] = rs.get("fails", 0) + 1
            rs["not_before"] = now() + 120 * rs["fails"]
            note(job_dir, f"run ended with exit {code} (try {rs['fails']} of {job.get('retries', 3)}). "
                          f"Its last lines, verbatim:\n```\n{failure_excerpt(job_dir)}\n```")
            if rs["fails"] == int(job.get("retries", 3)) - 1 and not repair_running(rs):
                words = start_repair(job_dir, job, rs, "failing", failure_excerpt(job_dir, 3))
                if words:
                    note(job_dir, words)
            if rs["fails"] >= int(job.get("retries", 3)):
                return finish(job_dir, job, rs, f"failed {rs['fails']} times in a row (last exit {code}) — "
                                                f"see run.log", state="failed")

    gone = expired(job, seconds, when)
    if gone:
        journal(job_dir, "expired", why=gone)
        return finish(job_dir, job, rs, gone, state="expired")
    if now() < rs.get("not_before", 0):
        return
    first = when(job.get("at"))
    if first and now() < first:
        return
    every = seconds(job.get("every"))
    last = rs.get("started")
    if last and every and now() - last < every and rs.get("last_exit") in (0, None):
        return
    if last and not every and rs.get("last_exit") == 0:
        return
    start(job_dir, job, rs, "scheduled" if last else "first run")


# ── the check-in: wake the quick mind with the job rebuilt from its own files ─────────────────────────────────────────
CHECKIN_PROMPT = """You are Lacuna — the desk, the one on call — checking on work another of your brains is doing. You have no
other memory of it: everything you know is below. Judge by outcome and output (counts moving, the card's checked items
and its `next`, errors in the log), not taste. "waiting" is normal (the GPU is leased, a retry is scheduled) and never
worth a message. THE BOX is context, not the job's fault: 8–14 GB of swap is this Studio's normal beside the 26B, so a
busy box with counts still moving is "waiting"; "failing" is only the job's own error or no progress for its heartbeat. Also judge your own machinery from SELF-KNOWLEDGE: were you woken when you promised?
Answer ONLY with JSON:
{"status": "fine" | "waiting" | "stuck" | "failing" | "done", "note": "one or two sentences for your notes",
 "tell_alfred": "" or "a short message ONLY when something is failing and he must act — almost always empty",
 "handoff": "" or "worker|worker-lite|deep — one reason, ONLY when a card's seat is clearly the wrong brain for its next item"}"""


def own_notes(job_dir: str) -> str:
    """The notes without old check-ins — a model shown its own past verdicts just repeats them; the last one stays."""
    lines = tail(f"{job_dir}/notes.md", 60).splitlines()
    checks = [l for l in lines if "(runner) check-in:" in l]
    kept = [l for l in lines if l.strip() and "(runner) check-in:" not in l][-15:]
    return "\n".join(kept + checks[-1:])


def box_now() -> str:
    """GPU lease · what is loaded · memory — the lines the desk reads before it judges a job (2.0 §6)."""
    try:
        import importlib, lease
        importlib.reload(lease)
        ps = subprocess.run(["/opt/homebrew/bin/ollama", "ps"], capture_output=True, text=True, timeout=10).stdout.splitlines()[1:]
        loaded = ", ".join(f"{l.split()[0]} {l.split()[2]}{l.split()[3]}" for l in ps if l.split()) or "nothing"
        mp = subprocess.run(["/usr/bin/memory_pressure"], capture_output=True, text=True, timeout=10).stdout
        free = next((l.split(":")[1].strip() for l in mp.splitlines() if "free percentage" in l), "?")
        sw = subprocess.run(["/usr/sbin/sysctl", "-n", "vm.swapusage"], capture_output=True, text=True, timeout=10).stdout
        used = sw.split("used = ")[1].split()[0] if "used = " in sw else "?"
        return f"{lease.status()} · loaded: {loaded} · memory {free} free · swap used {used}"
    except Exception as e:  # noqa: BLE001
        return f"(unknown: {e})"


def card_now(job: dict) -> str:
    try:
        with open(f"{job.get('card', '')}/CARD.md") as f:
            return f.read()[-3000:]
    except OSError:
        return "(not a card)"


def checkin(job_dir: str, job: dict, rs: dict) -> None:
    progress = read_json(f"{job_dir}/progress.json", {})
    moved = progress.get("done") != rs.get("checkin_done")
    running = bool(rs.get("pid"))
    if not running and now() < rs.get("not_before", 0):       # waiting on purpose (GPU busy, backoff): no model, no push
        rs.update(last_checkin=now(), checkin_status="waiting", stuck_count=0)
        note(job_dir, f"check-in: waiting — {progress.get('note') or 'a retry is scheduled'}")
        return
    facts = (f"JOB: {job['name']}\nGOAL: {job.get('goal', '')}\nCOMMAND: {job.get('run')}\n"
             f"SCHEDULE: every {job.get('every') or 'once'}; runs so far {rs.get('runs', 0)}; "
             f"running now: {running}; interrupted {rs.get('interrupted', 0)} times; failures in a row {rs.get('fails', 0)}\n"
             f"PROGRESS: {json.dumps(progress)}\n"
             f"PROGRESS MOVED SINCE LAST CHECK-IN: {moved}\n"
             f"SELF-KNOWLEDGE: check-ins promised every {job.get('checkin', '15m')}; this one comes "
             f"{int((now() - (rs.get('last_checkin') or rs.get('first_started') or now())) // 60)} min after "
             f"{'the last' if rs.get('last_checkin') else 'my first run'}; runs promised every {job.get('every') or 'once'}; "
             f"self-audit findings: {'; '.join(rs.get('audit', {}).get('words', {}).values()) or 'none'}\n"
             f"PLAN (plan.md):\n{plan_text(job_dir) or '(no plan written)'}\n"
             f"NOTES (latest last):\n{own_notes(job_dir)}\n"
             f"LOG TAIL:\n{tail(f'{job_dir}/run.log', 25)[-3000:]}\n"
             f"THE BOX NOW: {box_now()}\n"
             f"THE CARD (if this job is a card):\n{card_now(job)}")
    body = json.dumps({"model": CHECK_MODEL, "stream": False, "think": False, "format": "json",
                       "keep_alive": _desk_seat().get("keep_alive", "24h"),
                       "options": {"temperature": 0.3, "num_ctx": CHECK_CTX, "num_predict": 400},
                       "messages": [{"role": "system", "content": CHECKIN_PROMPT},
                                    {"role": "user", "content": facts}]}).encode()
    verdict = {"status": "fine", "note": "", "tell_alfred": ""}
    try:
        req = urllib.request.Request(OLLAMA, data=body, headers={"Content-Type": "application/json"})
        sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), "workers"))
        import lane
        with lane.background(max_wait=CHECK_WAIT_S), urllib.request.urlopen(req, timeout=CHECK_WAIT_S) as r:
            verdict.update(json.loads(json.load(r)["message"]["content"]))
    except Exception as e:
        verdict["note"] = f"(the brain was busy — this check-in is arithmetic only: {e.__class__.__name__})"
    if running and not moved and rs.get("checkin_done") is not None:
        verdict["status"] = "stuck"
        verdict["note"] = (verdict.get("note") or "") + " Progress has not moved since the last check-in."
    rs.update(last_checkin=now(), checkin_done=progress.get("done"), checkin_status=verdict.get("status"))
    if verdict.get("status") in ("stuck", "failing"):
        desk_say.say(f"Job {job['name']} is {verdict.get('status')}: {str(verdict.get('note') or '')[:200]}", log)
    journal(job_dir, "check-in", status=verdict.get("status"), note=(verdict.get("note") or "")[:200])
    if verdict.get("status") in ("stuck", "failing"):
        words = start_repair(job_dir, job, rs, verdict.get("status"), verdict.get("note") or "")
        if words:
            note(job_dir, words)
    hand = (verdict.get("handoff") or "").strip()
    if hand and job.get("card") and hand.split()[0].split("|")[0] in ("worker", "worker-lite", "deep", "desk"):
        try:
            cp = f"{job['card']}/CARD.md"
            with open(cp) as f:
                card = f.read()
            card = card.replace("\n## next", f"\nhandoff: {hand}\n\n## next", 1) if "handoff:" not in card else card
            with open(cp, "w") as f:
                f.write(card)
            note(job_dir, f"the desk ordered a handoff: {hand}")
        except OSError:
            pass
    note(job_dir, f"check-in: {verdict.get('status')} — {verdict.get('note', '').strip()}")
    log(f"{job['name']}: check-in {verdict.get('status')}")
    tell = (verdict.get("tell_alfred") or "").strip()
    stuck_twice = verdict.get("status") == "stuck" and rs.get("stuck_count", 0) >= 1
    rs["stuck_count"] = rs.get("stuck_count", 0) + 1 if verdict.get("status") == "stuck" else 0
    # a push only for real trouble — failing with a message, or stuck by arithmetic twice — and at most once an hour a job
    if ((verdict.get("status") == "failing" and tell) or stuck_twice) and now() - rs.get("last_push", 0) > 3600:
        if push(f"{job['name']}: {tell or verdict.get('note')}"):
            rs["last_push"] = now()


def tick_job(job_dir: str) -> None:
    job = read_json(f"{job_dir}/job.json", None)
    if not job or "name" not in job:
        return
    rs = read_json(f"{job_dir}/.runner.json", {})
    state = job.get("state", "on")
    try:
        if state in ("paused", "stopped"):
            if rs.get("pid"):
                stop_process(rs)
                note(job_dir, f"{state} — stopped the running work")
        elif state == "on" and job.get("kind") == "remind":
            at = when(job.get("at"))
            if at and now() >= at:
                ok = push(job.get("message") or job.get("goal") or "a reminder")
                job["state"] = "done"
                write_json(f"{job_dir}/job.json", job)
                note(job_dir, "reminder sent" if ok else "reminder could not be sent — will show in `errands`")
        elif state == "on" and job.get("run"):
            tick_work(job_dir, job, rs)
            every_check = seconds(job.get("checkin", "15m"))
            # the clock runs from the LAST CHECK-IN, else from the errand's FIRST run — never its latest start: a
            # repeating errand restarts every `every`, so a 30 min check-in on a 15 min errand never came (2026-10-11,
            # the poster bake went 8 hours without one)
            rs.setdefault("first_started", rs.get("started") or now())
            if (job.get("state") == "on" and every_check and rs.get("runs")
                    and now() - rs.get("last_checkin", rs["first_started"]) >= every_check):
                checkin(job_dir, job, rs)
        self_audit(job_dir, job, rs)
    finally:
        write_json(f"{job_dir}/.runner.json", rs)


def self_audit(job_dir: str, job: dict, rs: dict) -> None:
    """Compare what the errand promised with what the runner recorded; note, push and clear findings (selfaudit.py)."""
    found = audit(job, rs, now(), seconds, when)
    book = rs.setdefault("audit", {"since": {}, "pushed": {}, "words": {}})
    for key, words in found.items():
        if key not in book["since"]:
            book["since"][key] = now()
            note(job_dir, f"self-audit: {words}. Something is wrong with how I am being run, not with the work.")
            log(f"{job['name']}: self-audit {key} — {words}")
        if now() - book["pushed"].get(key, 0) > 12 * 3600 and push(f"{job['name']} (self-audit): {words}"):
            book["pushed"][key] = now()
    for key in [k for k in book["since"] if k not in found]:
        note(job_dir, f"self-audit: back on schedule ({key} cleared after {int((now() - book['since'][key]) // 60)} min)")
        log(f"{job['name']}: self-audit {key} cleared")
        del book["since"][key]
    book["words"] = found


def reindex_when_free() -> None:
    """Fill the vectors the cortex's writes skipped (1.3: a write never waits on an embedding) — only while no one holds
    the GPU lease, so it never competes with a card, a bake or a battery. Through the broker, like every cortex call."""
    try:
        lease = subprocess.run([f"{HOME}/lacuna-world/tools/lease", "status"], capture_output=True, text=True, timeout=30).stdout
        if "free" not in lease.lower():
            return
        out = subprocess.run([f"{HOME}/lacuna-world/tools/cortex", "reindex"], capture_output=True, text=True, timeout=600).stdout
        log(f"cortex reindex: {out.strip()[:160]}")
    except Exception as e:  # noqa: BLE001 — the next tick tries again
        log(f"cortex reindex skipped: {e.__class__.__name__}")


def main() -> None:
    os.makedirs(JOBS, exist_ok=True)
    for name in sorted(os.listdir(JOBS)):
        d = f"{JOBS}/{name}"
        if os.path.isdir(d) and not name.startswith("."):
            try:
                tick_job(d)
            except Exception as e:      # one broken job never stops the others
                log(f"{name}: runner error {e.__class__.__name__}: {e}")
    findings = {}
    for d in glob.glob(f"{JOBS}/*/.runner.json"):
        words = (read_json(d, {}).get("audit") or {}).get("words") or {}
        if words:
            findings[os.path.basename(os.path.dirname(d))] = words
    write_json(HEARTBEAT, {"tick": now(), "at": stamp(), "findings": findings})
    state = read_json(STATE, {})
    if now() - float(state.get("desk_warm_t", 0)) > 600:        # every ten minutes: the desk is always on
        keep_desk_warm()
        state["desk_warm_t"] = now()
        write_json(STATE, state)
    if now() - float(state.get("reindex_t", 0)) > 600:          # every ten minutes: memory gets its meaning
        state["reindex_t"] = now()
        write_json(STATE, state)
        reindex_when_free()
    if digest_due(state):
        if push(digest(JOBS, read_json, findings)):
            state = read_json(STATE, {})              # push() wrote its own bookkeeping into STATE
            state["digest_day"] = dt.date.today().isoformat()
            write_json(STATE, state)


if __name__ == "__main__":
    main()
