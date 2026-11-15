"""THE FORGE CARD'S PETITIONS (lane F2, 2026-10-24; LACUNA-CARDS-2.0 §6.5, §9.3 steps 2, 5, 6; LACUNA-MINDS-1.0 §4.5).

Owns: the effect sentence and the decided road of three foreman petitions the Forge card files —
  forge-job      start a job by kind: on yes, the foreman spawns the forge-job cart with its pausable header and the
                 owner's yes presses its one act (`forge train <kind> <base> <pairs>`), so one press starts one job
  forge-resume   a resume from a park: on yes, the foreman's interrupt `{mode: resume, pressed: true, diff}`; the broker
                 resumes only with this press and records the diff hash the owner saw
  forge-exam     sit the exam after a job: on yes, the exam runner sits the kind's exam once, against the weights' tag
Refuses: a kind that is not a job-class word, a base the forge does not train, a pair count outside 1–100,000, a worker id
that is not the foreman's, a diff that is not a hash, an exam for a kind with no exam file, an exam with no weights' tag.
A decline runs nothing. Never retries (law 10): one spawn, one press per act ticket, one exam run.
Invariants (design §18): "an act from the desk is a press ticket or a foreman route"; "a claim is not a record" (the exam's
numbers are the runner's file, never this module's words). Faults (§16): none raised here; a refusal is a sentence.
"""
from __future__ import annotations

import re
import subprocess
from pathlib import Path

REPO = Path(__file__).resolve().parents[3]
EXAMS = REPO / "tools" / "exam" / "exams"
EXAM_FOR = {"signal->label": "w1-signal-label-l0.slat", "command->verb": "w2-command-verb-l0.slat"}
NEED_MB = {"270m": 2048, "functiongemma": 2048, "1b": None, "e2b": None, "e4b": None}   # broker.mjs JOB_BASES
KIND = re.compile(r"^[a-z][a-z0-9-]{0,30}(->[a-z][a-z0-9-]{0,30})?$")
WORKER = re.compile(r"^w-[A-Za-z0-9_-]{1,38}$")
HASH = re.compile(r"^[0-9a-f]{8,64}$")
TAG = re.compile(r"^[A-Za-z0-9][\w.:/-]{0,80}$")
MIND = re.compile(r"^[a-z0-9][a-z0-9-]*/[a-z0-9][a-z0-9-]*@\d+$")   # agent/base@version (MINDS §3.1)


def job_of(a: dict) -> tuple[dict | None, str | None]:
    """The job's fields from the card's args, checked; (job, None) or (None, the refusal)."""
    kind, base = str(a.get("kind") or ""), str(a.get("base") or "").lower()
    if not KIND.match(kind):
        return None, f"'{kind[:40]}' is not a job kind"
    if base not in NEED_MB:
        return None, f"the forge trains {' · '.join(NEED_MB)}, not '{base[:20]}'"
    try:
        pairs = int(a.get("pairs"))
    except (TypeError, ValueError):
        return None, "the job names its pair count (the corpus room's)"
    if not 1 <= pairs <= 100_000:
        return None, f"{pairs} pairs is outside 1–100,000"
    minutes = a.get("minutes")
    eta = int(float(minutes) * 60) if isinstance(minutes, (int, float)) and minutes > 0 else None
    return {"kind": kind, "base": base, "pairs": pairs, "eta_s": eta, "need_mb": NEED_MB[base]}, None


def program(j: dict) -> str:
    """The forge-job cart: a pausable header (MINDS §4.5); one act starts the trainer (the hands answer its pid, run dir and
    worker; a `waiting` reply is the act waiting on its press, never a failed start: the press sends it again, F5); every
    30 s the `forge-job` read says whether it ended: done on its exit 0, waiting while it is parked, stopped on anything
    else; a pressed resume asks the act again from the parked checkpoint."""
    need = f" (memory-mb . {j['need_mb']})" if j["need_mb"] else ""
    eta = f" (eta-s . {j['eta_s']})" if j["eta_s"] else ""
    k, b, n = j["kind"], j["base"], j["pairs"]
    return (f"(lacuna-cart 'forge-job '((does . \"trains the {b} for {k} on {n} pairs (a Forge job by kind)\") (done . \"the trainer answered exit 0\")\n"
            f"  (agent . ((tier . act) (verbs . (on act hand every report remember recall stop))))\n  (acts . (forge))\n"
            f"  (pausable . #t) (checkpoint-every . 100){need} (priority . 5) (base . {b}) (kind . {k}){eta}))\n"
            f"(define (start) (act 'forge \"train\" \"{k}\" \"{b}\" {n}))\n"
            f"(on 'act (lambda (r) (if (get r 'waiting) #f (if (get (get r 'rows) 'started)\n"
            f"  (begin (remember 'job (get (get r 'rows) 'job)) (report 'started (get (get r 'rows) 'pid)))\n"
            f"  (begin (report 'trainer (get r 'exit)) (stop))))))\n"
            f"(every 30 (lambda () (if (recall 'job) (hand 'forge-job (recall 'job)) #f)))\n"
            f"(on 'hand (lambda (r) (if (get (get r 'rows) 'ended)\n"
            f"  (if (number? (get (get (get r 'rows) 'exit) 'parked_at)) (report 'parked (get (get (get r 'rows) 'exit) 'parked_at))\n"
            f"    (if (eqv? (get (get (get r 'rows) 'exit) 'exit) 0) (done \"the trainer answered exit 0\") (stop)))\n"
            f"  (report 'step (get (get r 'rows) 'step)))))\n"
            f"(on 'resume (lambda (r) (act 'forge \"train\" \"{k}\" \"{b}\" {n} (get r 'checkpoint))))\n")


def effect(action: str, a: dict) -> str:
    """What the yes does, written by code from the args (never the asker's words)."""
    if action == "forge-job":
        j, no = job_of(a)
        if no:
            return f"nothing: {no}"
        park = "the 26B parks for the job and the E2B face fronts the desk" if a.get("parks_26b") else "the 26B stays"
        mins = f"about {a.get('minutes')} min" if a.get("minutes") else "minutes unmeasured"
        return (f"starts one forge job: trains the {j['base']} for {j['kind']} on {j['pairs']} pairs, {a.get('steps') or '?'} steps, {mins}; "
                f"{park}; it runs as a pausable foreman worker (pause, park and resume on the Forge card) and its exam waits on its own press")
    if action == "forge-resume":
        return (f"resumes {str(a.get('worker'))[:40]} from its checkpoint as a new trainer process; the diff you saw ({str(a.get('diff'))[:16]}) "
                "is recorded on its contract")
    return (f"sits the {str(a.get('kind'))[:40]} exam once for the {str(a.get('base'))[:20]} that {str(a.get('run'))[:40]} trained, against "
            f"{str(a.get('quant') or 'the weights the Weights card names')[:80]}; the sitting lands on the Exam card")


def _start_exam(argv: list[str]) -> int:
    """One exam run in the background (its own deadline in the runner); the pid, never a wait."""
    return subprocess.Popen(argv, cwd=str(REPO), stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, start_new_session=True).pid


def decided(action: str, a: dict, approve: bool, who: str, call, start_exam=_start_exam) -> dict:
    """The owner answered a Forge petition. `call` is foreman.call (the token's road)."""
    if not approve:
        return {"ok": True, "declined": True}
    if action == "forge-job":
        j, no = job_of(a)
        if no:
            return {"ok": False, "why": no}
        r = call("POST", "/workers", {"name": f"forge-job {j['base']} {j['kind']}"[:60], "program": program(j), "tier": "act", "by": who})
        w = r.get("worker") or {}
        if not r.get("ok") or not w.get("id"):
            return {"ok": False, "why": r.get("why") or "the foreman did not spawn the job"}
        pressed = [t["ticket"] for t in w.get("pending") or [] if t.get("kind") in ("act", "press")
                   and call("POST", "/press", {"ticket": t["ticket"], "by": who}).get("ok")]
        return {"ok": bool(pressed), "worker": w["id"], "pressed": pressed,
                **({} if pressed else {"why": "the job spawned but its act ticket was not pressed"})}
    if action == "forge-resume":
        wid, diff = str(a.get("worker") or ""), str(a.get("diff") or "")
        if not WORKER.match(wid) or not HASH.match(diff):
            return {"ok": False, "why": "a resume names the foreman worker and the diff's hash"}
        r = call("POST", f"/workers/{wid}/interrupt", {"mode": "resume", "by": who, "pressed": True, "diff": diff})
        if not r.get("ok"):
            return r
        # the resume asks the trainer again from the checkpoint: the owner's yes on the resume is that act's press too
        w = (call("GET", f"/workers/{wid}") or {}).get("worker") or {}
        r["pressed"] = [t["ticket"] for t in w.get("pending") or [] if t.get("kind") in ("act", "press") and t.get("op") == "forge"
                        and call("POST", "/press", {"ticket": t["ticket"], "by": who}).get("ok")]
        return r
    kind, quant = str(a.get("kind") or ""), str(a.get("quant") or "")
    if kind not in EXAM_FOR:
        return {"ok": False, "why": f"no exam file for {kind[:40]} yet ({' · '.join(EXAM_FOR)} have one); nothing sat"}
    if not TAG.match(quant):
        return {"ok": False, "why": "the exam names the trained weights' tag (the Weights card row); nothing sat"}
    argv = ["/opt/homebrew/bin/node", str(REPO / "tools" / "exam" / "exam.mjs"), str(EXAMS / EXAM_FOR[kind]), "--quant", quant, "--deadline", "900"]
    if MIND.match(str(a.get("mind") or "")):
        argv += ["--mind", str(a["mind"])]
    return {"ok": True, "started": start_exam(argv), "exam": EXAM_FOR[kind], "quant": quant}
