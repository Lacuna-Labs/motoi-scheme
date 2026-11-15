"""THE LEAD'S OWED PRESS VERBS (lane L2, 2026-10-24).

Owns: the effect sentence and the decided road of five foreman petitions the lead's cards file —
  watchdog-kick  {name}            Telemetry: on yes, one dev watchdog's probe now (api.watchdog_kick → the dev API :5051)
  drill          {kind, name}      DiRT: on yes, the live drill (drill.drill) on a thread; its row lands in drills.jsonl
  kick-run       {run, text?}      the sentry rail: on yes, the would-kick the run holds is sent once as a signed `kick` event
  sit-exam       {exam, model, mind?}  Exam: on yes, tools/exam/exam.mjs sits one exam in role against one weights tag
  leave-shadow   {agent, undo?}    the sentry rail: on yes, the foreman records the sentry's mode (live only after its exam)
Refuses (one sentence each, at filing and again at the press): a watchdog name outside [\\w.-]{1,60}; a drill kind outside
kill · bootout, a service not ours, the customer's side, Lacuna itself, a second drill while one runs; a run id outside
[\\w.-]{1,40}, a run that is not living, a run with no would-kick behind it (SENTRY S-2); an exam that is not a file under
tools/exam/exams/, a weights tag outside forge_jobs.TAG; an agent other than the sentry, and live without a passing in-role
sitting of n ≥ 200 (SENTRY §5; design §9: "until then shadow"). A decline runs nothing. Never retries (law 10).
Implements: LACUNA-CARDS-2.0 §6.1 (the sentry rail), §6.6 (sit), §6.11 (kick one dog), §6.13 (the live drill); LACUNA-SENTRY-1.0
§3 step 6, §5; MAIL lines 213, 250, 252 (the run-battery act lives in chat.py and battery.py).
Invariants (design §18): "an act from the desk is a press ticket or a foreman route"; "a claim is not a record" (a started
drill or sitting says started, with its id; the record is the callee's file). Faults (§16): none raised; a refusal is a sentence.
"""
from __future__ import annotations

import json
import os
import re
import threading
from pathlib import Path

VERBS = ("watchdog-kick", "drill", "kick-run", "sit-exam", "leave-shadow")
DOG = re.compile(r"^[\w.-]{1,60}$")
RUN = re.compile(r"^[\w.-]{1,40}$")
EXAM_ID = re.compile(r"^[a-z0-9][a-z0-9-]{0,60}$")
SHADOWED = ("sentry",)                                # the agents that have a shadow (SENTRY §5); one today
GATE_N = 200                                          # SENTRY §5, MINDS §7 L3: ≥ 200 slices before it serves


def background(fn) -> None:
    """Runs one press's long call beside the press (a drill takes up to 120 s); tests replace it with a direct call."""
    threading.Thread(target=fn, name="card-verb", daemon=True).start()


def _dog(a: dict) -> str | None:
    n = str(a.get("name") or "").removeprefix("watch.")
    return n if DOG.match(n) else None


def _drill_no(a: dict) -> str | None:
    """Why a drill petition is refused, or None when its kind and service may be drilled."""
    from . import drill, services
    kind, name = str(a.get("kind") or ""), str(a.get("name") or "")
    if kind not in drill.KINDS:
        return f"a drill is one of {' · '.join(drill.KINDS)}, not '{kind[:20]}'"
    from .drill_targets import DARK, NEVER
    s, never = services.SERVICES.get(name), {DARK.get(n, (n,))[0] for n in NEVER}
    if s and (s["hers"] or name in never):
        return "never the customer's side: QA, the iPad and her doors are not drilled"
    if name == "lacuna":
        return "Lacuna drills itself from the CLI (`lacuna drill self`), never from its own press"
    if not s:
        ours = " · ".join(k for k, v in services.SERVICES.items() if not v["hers"] and k not in never and k != "lacuna")
        return f"the drill module drills {ours}; '{name[:40]}' is not on its list (services.py)"
    return None


def _exam(a: dict) -> tuple[Path | None, str]:
    """The exam file and the agent its role names, or (None, the refusal)."""
    from . import forge_jobs
    eid, model = str(a.get("exam") or ""), str(a.get("model") or "")
    f = forge_jobs.EXAMS / f"{eid}.slat"
    if not EXAM_ID.match(eid) or not f.is_file():
        return None, f"no exam named '{eid[:60]}' under tools/exam/exams/"
    if not forge_jobs.TAG.match(model):
        return None, "a sitting names the weights' tag it sits on (the Exam card's pick)"
    m = re.search(r'\(role\s+\(who\s+"?([\w-]+)', f.read_text(errors="replace"))
    return f, m.group(1) if m else "no agent"


def exam_dir() -> Path:
    """Where the exam runner writes its sittings (exam.mjs resultsDir)."""
    return Path(os.environ.get("LACUNA_EXAM_DIR") or Path.home() / "lacuna-world" / "exam" / "results")


def passing_sitting(agent: str) -> tuple[str | None, str]:
    """The agent's newest in-role sitting, if it passed with n ≥ 200 and is not underpowered: (id, why) or (None, why not)."""
    rows = []
    for p in exam_dir().glob("*.json") if exam_dir().is_dir() else []:
        try:
            d = json.loads(p.read_text())
        except (OSError, ValueError):
            continue
        if isinstance(d, dict) and ((d.get("exam") or {}).get("role") or {}).get("who") == agent and d.get("in-role") is True:
            rows.append((str(d.get("at") or ""), p.stem, d.get("result") or {}))
    if not rows:
        return None, f"the {agent} has no in-role sitting on the record"
    _, sid, r = max(rows, key=lambda x: x[:2])
    verdict = r.get("pass") if isinstance(r.get("pass"), list) else [r.get("pass")]
    ok, why = (verdict + [None, None])[:2]                # the runner writes (pass #t|#f|null "why")
    if ok is True and not r.get("underpowered") and isinstance(r.get("n"), int) and r["n"] >= GATE_N:
        return sid, f"sitting {sid} passed"
    return None, f"its newest in-role sitting {sid} does not pass ({str(why or 'no pass')[:160]}; n {r.get('n')}, the bar is ≥ {GATE_N})"


def effect(action: str, a: dict) -> str:
    """The contract the owner reads, written by code from the card's args; a bad arg makes the sentence a refusal."""
    if action == "watchdog-kick":
        n = _dog(a)
        if not n:
            return "refuses: a watchdog kick names one dev watchdog (letters, digits, dot, dash; ≤ 60)"
        return (f"kicks the dev watchdog {n} once: the dev API (:5051) runs its probe now and says its state; QA's watchdogs "
                "are never kicked; one try")
    if action == "drill":
        no = _drill_no(a)
        if no:
            return f"refuses: {no}"
        from . import services
        s = services.SERVICES[str(a["name"])]
        how = (f"SIGKILL to its process on :{s['port']}" if a["kind"] == "kill"
               else f"launchctl bootout of {s['label']}, then bootstrap from its plist")
        return (f"breaks {s['title']} on purpose: {how}; launchd must bring it back within 120 s, and the seconds until it "
                "answers again are recorded in the drill history and on the DiRT card; a drill that does not come back is an "
                "alert; never QA or the iPad; one drill at a time, never re-sent")
    if action == "kick-run":
        run = str(a.get("run") or "")
        if not RUN.match(run):
            return "refuses: a kick names one living run"
        said = f" (\"{str(a.get('text'))[:160]}\")" if a.get("text") else ""
        return (f"sends the sentry's kick to run {run} once: the claim with no receipt{said} goes to the run as a signed kick "
                "event; only a run that holds a would-kick verdict is kicked; the sentry stays in its mode")
    if action == "sit-exam":
        f, agent = _exam(a)
        if f is None:
            return f"refuses: {agent}"
        mind = f" as {a['mind']}" if a.get("mind") else ""
        return (f"sits {f.stem} (the {agent}'s exam) in role on {str(a['model'])[:80]}{mind}: tools/exam/exam.mjs asks the gateway "
                "once per item at temperature 0, no retry; the sitting is written to the exam results as today and the Exam "
                "card draws it")
    if action == "leave-shadow":
        agent = str(a.get("agent") or "")
        if agent not in SHADOWED:
            return f"refuses: only the {' · '.join(SHADOWED)} has a shadow"
        if a.get("undo"):
            return f"puts the {agent} back in shadow: verdicts and would-kicks are written and nothing is sent; the foreman records the change"
        return (f"takes the {agent} out of shadow: its claim-without-receipt verdicts become kicks the foreman sends; refused "
                f"unless its newest in-role sitting passed with n ≥ {GATE_N}; the foreman records the change, and undo puts it back")
    return f"no card verb {action}"


def decided(action: str, a: dict, approve: bool, who: str, call, start_exam=None) -> dict:
    """The owner answered one of the five petitions. `call` is foreman.call (the token's road); `start_exam` a test's stand-in."""
    if not approve:
        return {"ok": True, "declined": True}
    if action == "watchdog-kick":
        n = _dog(a)
        if not n:
            return {"ok": False, "why": "a watchdog kick names one dev watchdog"}
        from . import api
        return api.watchdog_kick(n, who)
    if action == "drill":
        no = _drill_no(a)
        from . import drill
        if no or drill.running():
            return {"ok": False, "why": no or f"a drill is already running: {drill.running().get('kind')} {drill.running().get('service')}"}
        kind, name = str(a["kind"]), str(a["name"])

        def go() -> None:
            from . import workers
            drill.drill(kind, name, who, alerts_fn=workers.alerts, raise_alert=workers.raise_alert)
        background(go)
        return {"ok": True, "started": f"{kind} {name}", "said": f"the drill {kind} {name} started; GET /api/drills follows it and its row is the record"}
    if action == "kick-run":
        run = str(a.get("run") or "")
        if not RUN.match(run):
            return {"ok": False, "why": "a kick names one living run"}
        row = next((r for r in (call("GET", "/sentry").get("runs") or []) if r.get("id") == run), None)
        if row is None:
            return {"ok": False, "why": f"no living run {run}: nothing to kick"}
        would = [str(x) for x in row.get("would") or []]
        if not would:
            return {"ok": False, "why": f"run {run} holds no would-kick: no kick without a verdict behind it (SENTRY S-2)"}
        text = str(a.get("text")) if str(a.get("text") or "") in would else would[-1]
        r = call("POST", f"/workers/{run}/event", {"kind": "kick", "value": {"kind": "claim-without-receipt", "text": text, "missed": 1,
                                                                                "promise": None, "by": who, "pressed": True}})
        return {**r, "ok": r.get("ok") is not False, "said": f"kicked {run}: {text[:160]}" if r.get("ok") is not False else r.get("why")}
    if action == "sit-exam":
        f, agent = _exam(a)
        if f is None:
            return {"ok": False, "why": agent}
        from . import forge_jobs
        argv = ["/opt/homebrew/bin/node", str(forge_jobs.REPO / "tools" / "exam" / "exam.mjs"), str(f), "--quant", str(a["model"]), "--deadline", "900"]
        if forge_jobs.MIND.match(str(a.get("mind") or "")):
            argv += ["--mind", str(a["mind"])]
        pid = (start_exam or forge_jobs._start_exam)(argv)
        return {"ok": True, "started": pid, "exam": f.stem, "agent": agent, "model": str(a["model"]),
                "said": f"the {agent} sits {f.stem} on {a['model']} (pid {pid}); the sitting lands on the Exam card"}
    if action == "leave-shadow":
        agent = str(a.get("agent") or "")
        if agent not in SHADOWED:
            return {"ok": False, "why": f"only the {' · '.join(SHADOWED)} has a shadow"}
        if a.get("undo"):
            return call("POST", "/sentry/mode", {"mode": "shadow", "by": who})
        sid, why = passing_sitting(agent)
        if not sid:
            return {"ok": False, "why": f"the {agent} stays in shadow: {why}"}
        return call("POST", "/sentry/mode", {"mode": "live", "pressed": True, "sitting": sid, "by": who})
    return {"ok": False, "why": f"no card verb {action}"}
