"""TASKS THAT RUN (design §45.2; the owner, 2026-10-19: "the whole thing is a dud right now … do it and the goal is to make
it useful").

Ten tasks sat `queued` all morning: starting one filed a card, the work order (which answers such cards) had ended, and
nothing ever started the next one or read what a finished one found. This is the one loop that does that, every minute
in the workers' pass:

  1. NEXT — under a live work order, with nothing of ours running, the next queued task starts (claude_tasks.start; the
     order answers its card at once, so the cart or the exam worker spawns).
  2. FOLLOW — its own run ends it (claude_tasks._follow reads the run's artifact). A task past RUN_LIMIT_S is stopped
     here and said, never left "started" for hours.
  3. REVIEW — a state machine, not a chat: PLAN (what it found, what is real, ≤ 4 steps; JSON forced) → RUN (this code
     calls each tool and checks it; ≤ 3 fixes a step, then halt) → SUMMARY (JSON forced). Fresh context each call.
     Every phase streams as Transcript events (round · thinking · token · call · result · note · answer).
  4. THE NEXT ONE — and so on until the list is done or the order ends.

Every event is kept, one JSON line each, in ~/lacuna-world/tasks/runs/<id>.jsonl (the Agents card draws it with
gl/Transcript.jsx: GET /api/tasks/claude/<id>/events). With no work order the loop does nothing and the card says so,
with the key that files one: the order is the owner's press, never Lacuna's.

The task brain is a config: TASK_MODEL (env LACUNA_TASK_MODEL), the resident 26B unless the owner names another seat.
"""
from __future__ import annotations

import json
import os
import threading
import time
from pathlib import Path

from .core import audit

RUNS = Path.home() / "lacuna-world" / "tasks" / "runs"
RUN_LIMIT_S = 45 * 60
TASK_MODEL = os.environ.get("LACUNA_TASK_MODEL") or "gemma4:e4b-it-qat"       # the 4B model (the helpers' workhorse)
_lock = threading.Lock()
_busy: dict[str, float] = {}                                    # task id → when its review started (one at a time)


def _log(tid: str, ev: dict) -> None:
    RUNS.mkdir(parents=True, exist_ok=True)
    with open(RUNS / f"{tid}.jsonl", "a") as f:
        f.write(json.dumps({**ev, "t": time.time()}, default=str) + "\n")


def events(tid: str, since: float = 0) -> list[dict]:
    p = RUNS / f"{tid}.jsonl"
    if not p.exists():
        return []
    out = []
    for line in p.read_text(errors="replace").splitlines():
        try:
            e = json.loads(line)
        except ValueError:
            continue
        if float(e.get("t") or 0) > since:
            out.append(e)
    return out[-600:]


def _artifact_text(t: dict) -> str:
    """What the run left: its artifact (the run's frame — steps, outcome) AND its reports, which hold the findings. The
    artifact format keeps no reports (measured 2026-10-19: doc-drift's artifact said "checked" while its 15 missing paths
    lived only in the worker's reports), so they are read back: the copy kept at retirement (carts.retired), else the
    foreman's record of the worker."""
    import re as _re
    from . import artifacts
    key = t["how"].get("cart") or f"exam-{t['how'].get('exam')}"
    a = artifacts.latest(key)
    text = str((a or {}).get("text") or "")
    m = _re.search(r':id "(w-[0-9a-z-]+)"', text)
    reps = []
    if m:
        side = RUNS.parent / "reports" / f"{m.group(1)}.json"
        try:
            reps = json.loads(side.read_text())
        except (OSError, ValueError):
            try:
                from . import foreman
                d = foreman.call("GET", f"/workers/{m.group(1)}", None, timeout=10)
                reps = (d.get("worker") or d).get("reports") or []
            except Exception:  # noqa: BLE001
                reps = []
    if reps:
        text += "\n\nREPORTS (what the run found):\n" + "\n".join(
            f"- {r.get('kind')}: {' '.join(str(x) for x in (r.get('data') or []))}"[:300] for r in reps[-80:])
    return text


# THE REVIEW IS A STATE MACHINE, NOT A CHAT (the owner's brief, 2026-10-19: "agents are built as State Machines, not
# continuous chat loops … split planning from doing … the host decides, not the model … wipe the history each step").
# Three bounded brain calls, each in a FRESH context (no chat history; the goal, the step, the results so far), each forced
# into a JSON schema (the gateway passes Ollama's `format` to llama.cpp's grammar; measured 3.1 s for a plan); the tools
# are run by THIS code, which checks each result and decides what comes next. A failed step is re-asked as "this call
# failed with <error>; give the fixed call", at most FIX_TRIES times, then the task halts and says where.
# READS ONLY. A task's review checks and reports; it starts and files nothing (W1 filed a PROMOTE card through `petition`,
# W2's re-run asked the Forge for training pairs through `forge` — a card for the owner nobody asked for, 2026-10-19).
# What needs doing becomes a real item in its summary, and the owner (or the queue) makes it work.
TASK_TOOLS = ["search_logs", "watchdogs", "error_summary", "runs", "work_history", "recall", "journal", "health_check",
              "list_services", "explain_service", "web_search", "read_page", "list_workers", "job_log", "release_status", "hand",
              "shell", "ipad", "ask_cloud", "forge", "exam", "claude_tasks", "petition"]   # given back (the owner, 2026-10-19)
MAX_STEPS = 4
FIX_TRIES = 3


def _brain_json(prompt: str, schema: dict, tid: str, label: str) -> dict:
    """One bounded call, a fresh context, the answer forced into `schema`; its thinking and words are kept as events."""
    import urllib.request
    from . import chat
    body = json.dumps({"model": TASK_MODEL or chat.MODEL, "messages": [{"role": "user", "content": prompt}], "stream": False,
                       "think": False, "format": schema, "keep_alive": chat.KEEP_ALIVE,
                       "options": {"num_ctx": 16384, "temperature": 0.2}}).encode()
    t0 = time.time()
    req = urllib.request.Request(f"{chat.OLLAMA}/api/chat", data=body,
                                 headers={"Content-Type": "application/json", "X-Lacuna-Prefix": "background"})
    with urllib.request.urlopen(req, timeout=240) as r:
        msg = (json.loads(r.read()).get("message") or {})
    if msg.get("thinking"):
        _log(tid, {"type": "thinking", "text": msg["thinking"]})
    try:
        out = json.loads(msg.get("content") or "{}")
    except ValueError:
        out = {}
    _log(tid, {"type": "note", "label": label, "text": f"{label} in {time.time() - t0:.1f} s"})
    return out


def _ok(out) -> bool:
    """A step worked only if NOTHING in its answer says it did not: a hand answers {"ok": true, "result": {"ok": false, "why":
    …}} when the read itself failed (W1, 2026-10-19: four "✓" steps that had all failed)."""
    if not isinstance(out, dict):
        return out is not None
    if out.get("refused") or out.get("ok") is False or out.get("error"):
        return False
    inner = out.get("result")
    return _ok(inner) if isinstance(inner, dict) and ("ok" in inner or "error" in inner or "refused" in inner) else True


def _tools_line(names: list[str]) -> str:
    from . import chat
    rows = []
    for n in names:
        f = chat.TOOLS.get(n)
        if not f:
            continue
        props = ", ".join(f"{k}{'' if k in f._tool['required'] else '?'}" for k in (f._tool.get("props") or {}))
        rows.append(f"- {n}({props}): {str(f._tool['desc'])[:140]}")
    return "\n".join(rows)


def _review(tid: str, t: dict, s: dict) -> None:
    """PLAN → RUN each step (the host calls the tool and checks it; ≤ FIX_TRIES fixes) → SUMMARY. Every phase streams events."""
    from . import chat, claude_tasks
    tools = [n for n in TASK_TOOLS if n in chat.TOOLS]
    goal = f"Task {tid}: {t['title']}. Why it matters: {t['why']}."
    try:
        body = _artifact_text(t)[:8000] or "(the run left no artifact)"
        _log(tid, {"type": "round", "n": 0, "why": "plan — what the run found, and the steps to check it"})
        plan = _brain_json(
            f"{goal}\nIts run ended {s.get('state')}: {s.get('note') or 'no reason given'}.\n\nWHAT THE RUN LEFT:\n{body}\n\n"
            f"TOOLS YOU MAY USE (each step is ONE call):\n{_tools_line(tools)}\n\n"
            f"Say what the run found (numbers), which items are real, and at most {MAX_STEPS} steps that check or act on the "
            "real ones. No step if nothing is real; what needs a person goes in `real`, said plainly. "
            # THE GRADER'S QUESTIONS, asked first (W1/W2 grades, 2026-10-19: the review copied the first rows as "real", and
            # took 18/18 as proof while the probe was blind to 6 of the judge's 14 problems)
            "A row is real only when it needs action — give the reason in the row (a dated history doc, a planned file, a "
            "file that moved and still exists are NOT the same as one that is gone). A clean or perfect score proves only "
            "what was tested: in `found`, say what this run could NOT have caught (what it never looked at, its coverage "
            "line, platforms, cases) — that gap is itself a real item.",
            {"type": "object", "required": ["found", "real", "steps"], "properties": {
                "found": {"type": "string"}, "real": {"type": "array", "items": {"type": "string"}, "maxItems": 8},
                "steps": {"type": "array", "maxItems": MAX_STEPS, "items": {"type": "object", "required": ["do", "tool", "args"], "properties": {
                    "do": {"type": "string"}, "tool": {"type": "string", "enum": tools}, "args": {"type": "object"}}}}}},
            tid, "planned")
        _log(tid, {"type": "token", "text": f"Found: {plan.get('found', '—')}\nReal: {'; '.join(plan.get('real') or []) or 'nothing'}"})
        results = []
        for k, step in enumerate((plan.get("steps") or [])[:MAX_STEPS]):
            tool, args, tries = step.get("tool"), step.get("args") or {}, 0
            while True:
                cid = f"s{k}t{tries}"
                _log(tid, {"type": "call", "id": cid, "tool": tool, "args": args})
                t0 = time.time()
                out = chat.call_tool(tool, args, "lacuna:tasks") if tool in tools else {"ok": False, "error": f"{tool} is not a task tool"}
                ok = _ok(out)
                _log(tid, {"type": "result", "id": cid, "tool": tool, "ok": ok, "ms": int((time.time() - t0) * 1000),
                           "text": chat._result_text(out)})
                if ok or tries >= FIX_TRIES:
                    break
                tries += 1
                _log(tid, {"type": "round", "n": tries, "why": f"step {k + 1} failed — fix {tries} of {FIX_TRIES}"})
                fix = _brain_json(
                    f"{goal}\nStep {k + 1}: {step.get('do')}\nThe call {tool}({json.dumps(args)}) failed with:\n"
                    f"{chat._result_text(out, 1200)}\n\nTOOLS:\n{_tools_line(tools)}\n\nGive the one fixed call for this step.",
                    {"type": "object", "required": ["tool", "args"], "properties": {"tool": {"type": "string", "enum": tools}, "args": {"type": "object"}}},
                    tid, f"fix {tries}")
                tool, args = fix.get("tool") or tool, fix.get("args") or {}
            results.append({"step": step.get("do"), "tool": tool, "ok": ok, "out": chat._result_text(out, 1500)})
            if not ok:
                break                                       # the host halts: a step that cannot be fixed ends the run, said
        _log(tid, {"type": "round", "n": 9, "why": "summary — from the plan and what each step returned"})
        summ = _brain_json(
            f"{goal}\nFOUND: {plan.get('found')}\nREAL: {plan.get('real')}\nSTEPS AND RESULTS:\n{json.dumps(results)[:9000]}\n\n"
            "Write the owner's summary in at most 8 short lines: what was found (numbers), what was done, what is left and "
            "who must do it, and what the run could not have caught. Say only what a step's result shows — never that a "
            "check was done when its step failed. outcome DONE when every real item was checked or filed and every gap is "
            "named; STOPPED otherwise, with why.",
            {"type": "object", "required": ["summary", "outcome", "why"], "properties": {
                "summary": {"type": "string"}, "outcome": {"type": "string", "enum": ["DONE", "STOPPED"]}, "why": {"type": "string"}}},
            tid, "summarized")
        words = f"{summ.get('summary', '').strip()}\n{summ.get('outcome', 'STOPPED')}: {summ.get('why', '')}".strip()
        _log(tid, {"type": "answer", "text": words, "ok": summ.get("outcome") == "DONE"})
        lst, st = claude_tasks._load()
        st.setdefault(tid, {}).update(review=words[:2000], reviewed=time.time(), steps_ok=sum(r["ok"] for r in results),
                                      steps=len(results))
        claude_tasks._save(st)
        from . import workers
        workers.raise_alert(f"claude-task:{tid}:review", "done" if summ.get("outcome") == "DONE" else "warn",
                            f"{tid} {summ.get('outcome', 'reviewed')}: {t['title']}", words[:600], notify=True)
    except Exception as e:  # noqa: BLE001 — a review that fails is said, and the loop goes on
        _log(tid, {"type": "answer", "text": f"the review failed: {e.__class__.__name__}: {e}"[:300], "ok": False})
        audit("lacuna", "task.review-failed", task=tid, error=f"{e.__class__.__name__}"[:80])
        try:
            lst, st = claude_tasks._load()
            st.setdefault(tid, {}).update(reviewed=time.time(), review=f"the review failed: {e.__class__.__name__}")
            claude_tasks._save(st)
        except Exception:  # noqa: BLE001
            pass
    finally:
        with _lock:
            _busy.pop(tid, None)


def tick(now: float | None = None) -> dict:
    """One pass: follow the started task, review a finished one, start the next under a live order. Returns what it did."""
    from . import claude_tasks, work_order
    now = now or time.time()
    did: dict = {"order": bool(work_order.current())}
    rows = claude_tasks.tasks()["tasks"]                      # tasks() also follows each started task to its end
    lst, st = claude_tasks._load()
    for t in rows:
        s = st.get(t["id"]) or {}
        if s.get("state") == "started" and now - float(s.get("t") or now) > RUN_LIMIT_S:
            claude_tasks.mark(t["id"], "stopped", f"ran past {RUN_LIMIT_S // 60} min with no end from its run — stopped and said")
            _log(t["id"], {"type": "result", "id": "run", "tool": "its run", "ok": False, "text": f"no end after {RUN_LIMIT_S // 60} min"})
            did["stopped"] = t["id"]
            s = {**s, "state": "stopped"}
        if s.get("state") in ("finished", "stopped") and not s.get("reviewed") and s.get("t"):
            with _lock:
                if t["id"] in _busy or _busy:
                    continue
                _busy[t["id"]] = now
            _log(t["id"], {"type": "result", "id": "run", "tool": "its run", "ok": s.get("state") == "finished", "text": s.get("note") or s.get("state")})
            threading.Thread(target=_review, args=(t["id"], t, s), name=f"task-review-{t['id']}", daemon=True).start()
            did["reviewing"] = t["id"]
            return did
    if not did["order"]:
        return did
    if any((st.get(t["id"]) or {}).get("state") == "started" for t in rows) or _busy:
        return did
    nxt = next((t for t in rows if (st.get(t["id"]) or {}).get("state", "queued") == "queued"), None)
    if not nxt:
        return did
    _log(nxt["id"], {"type": "round", "n": 0, "why": None})
    _log(nxt["id"], {"type": "call", "id": "run", "tool": f"start {next(iter(nxt['how'].values()))}", "args": nxt["how"]})
    r = claude_tasks.start(nxt["id"], "lacuna:tasks")
    if not r.get("ok"):
        _log(nxt["id"], {"type": "result", "id": "run", "tool": "start", "ok": False, "text": str(r.get("why") or r)[:600]})
        claude_tasks.mark(nxt["id"], "stopped", f"it could not start: {r.get('why') or r.get('state')}")
    did["started"] = nxt["id"]
    return did


def standing() -> dict:
    """What the Agents card says about the queue: running, waiting for an order, or done."""
    from . import claude_tasks, work_order
    rows = claude_tasks.tasks()["tasks"]
    left = [t["id"] for t in rows if t["state"] == "queued"]
    now_t = next((t for t in rows if t["state"] == "started"), None)
    order = work_order.current()
    if now_t:
        said = f"working on {now_t['id']}: {now_t['title']}"
    elif _busy:
        said = f"reading what {next(iter(_busy))} found"
    elif left and not order:
        said = f"{len(left)} tasks wait for a work order — press 'work on your own 24 h' and they run one after another"
    elif left:
        said = f"next: {left[0]}"
    else:
        said = "every task has run"
    return {"said": said, "left": left, "running": now_t["id"] if now_t else None, "reviewing": next(iter(_busy), None),
            "order": order}
