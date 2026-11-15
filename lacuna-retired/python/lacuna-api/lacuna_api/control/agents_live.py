"""WHO IS WORKING, HONESTLY (design §45.4 "the count"; the owner, 2026-10-19: "is lacuna doing work? or stuck? i cant tell
because the agent count is always 2. it's always those 2").

The Agents tile counted foreman workers whose state said "running" — one of them a zombie for 8 hours (`ci-guard`: no
pending reply, no timer, no subscription; nothing could wake it), the other a watcher. Chat turns, tasks, jobs and errands
never counted. Here, an agent counts when it is DOING something now:

  task      a task Claude left, running or being reviewed (task_runner.py)
  chat      a person's turn in flight (chat.ACTIVE_TURNS)
  job       a job whose process lives (core.jobs: the promote, the pass, a build)
  errand    an errand whose runner holds a live pid right now
  worker    a foreman worker that is running AND alive: it heard or did something within STALL_S, or it holds a timer or a
            subscription that will wake it. One that is neither is STALLED (§45.3, the zombie law) — listed apart, never
            counted. When the foreman reports `pending`/`timers`/`subs`/`beat_age_s` (§45.3), those are read first.

  brain     each of the brain's slots that is processing, with what it holds (2026-10-19: card warms held the person's
            slot for minutes and nothing on the Agents screen said so: "agents doesn't tell me what it's doing")

  working() → {count, working: [{id, kind, what, since}], watching, stalled, idle_since, said}
  A watcher (waiting on a timer or a subscription) is listed as watching: alive, not counted as work.

The desk's reads (GET /api/agents/working, /activity, /voices, /traffic, /output/{aid}) are the door's since 2026-11-06
(lacuna-node/frontend/agents-live.mjs, agents-voices.mjs); working() and activity() stay here for this API's own callers (wake.py,
story.py, the chat's tools).
"""
from __future__ import annotations


def _brain_slots() -> list:
    """What each busy brain slot is doing: the lane it last served (brain-cache.jsonl) and its tokens so far."""
    import urllib.request
    rows = []
    try:
        with urllib.request.urlopen("http://127.0.0.1:8091/slots", timeout=2) as r:
            slots = json.load(r)
    except Exception:  # noqa: BLE001 — a brain that does not answer is the Brain card's to say
        return rows
    last = {}
    try:
        with open(Path.home() / ".lacuna" / "brain-cache.jsonl", "rb") as f:
            f.seek(0, 2)
            f.seek(max(0, f.tell() - 8000))
            for line in f.read().decode(errors="replace").splitlines()[1:]:
                try:
                    e = json.loads(line)
                    last[e.get("slot")] = e.get("lane")
                except ValueError:
                    pass
    except OSError:
        pass
    for sl in slots:
        if not sl.get("is_processing"):
            continue
        sid = sl.get("id")
        lane = last.get(sid) or "unknown lane"
        nt = (sl.get("next_token") or [{}])[0] if isinstance(sl.get("next_token"), list) else (sl.get("next_token") or {})
        rows.append({"id": f"brain:slot{sid}", "kind": "brain",
                     "what": f"brain slot {sid} ({'person' if sid == 0 else 'background'}) busy: {lane}"
                             + (f", {nt.get('n_decoded')} tokens written" if nt.get("n_decoded") else "")})
    return rows

import json
import re
import re
import os
import time
from pathlib import Path

from fastapi import APIRouter

router = APIRouter()
STALL_S = 15 * 60
_last_work = {"t": time.time()}


def _proc_has(pid, name: str) -> bool:
    """The process with this pid is really THIS job's (its command line names the job). A saved pid that the OS gave to something else, or
    a step that was told to stop and is still winding down, must not show as the job working (2026-10-19: ghost chips)."""
    try:
        import subprocess
        out = subprocess.run(["ps", "-o", "command=", "-p", str(int(pid))], capture_output=True, text=True, timeout=3).stdout
        return name in out
    except (OSError, ValueError, Exception):  # noqa: BLE001
        return True                                       # cannot tell: believe the pid (the old behaviour)


def _pid_alive(pid) -> bool:
    try:
        os.kill(int(pid), 0)
        return True
    except (OSError, TypeError, ValueError):
        return False


def _worker_alive(w: dict, now: float) -> tuple[str, str]:
    """('working' | 'watching' | 'stalled', why) for a running foreman worker — by the foreman's own fields when it has
    them (§45.3), else by its ring. Waiting on a reply is work; waiting on a timer or a subscription is watching."""
    if w.get("beat_age_s") is not None or w.get("pending") is not None:
        if w.get("pending"):
            return "working", f"waits on {len(w['pending'])} repl{'y' if len(w['pending']) == 1 else 'ies'}"
        if w.get("timers") or w.get("subs") or w.get("minds_in_flight"):
            if w.get("minds_in_flight"):
                return "working", f"asks {w['minds_in_flight']} small mind{'s' if w['minds_in_flight'] > 1 else ''}"
            return "watching", "waits on " + ("a timer" if w.get("timers") else "a subscription")
        if w.get("beat_age_s") is not None and float(w["beat_age_s"]) < 60:
            return "working", "working"
        return "stalled", w.get("stall_reason") or "nothing pending, nothing could wake it"
    if w.get("subscriptions"):
        return "watching", "waits on a subscription"
    try:
        from . import agent_talk
        items = (agent_talk.thoughts(w["id"], 1) or {}).get("items") or []
        last = float(items[-1].get("t") or 0) if items else float(w.get("started") or 0)
        ring = str(items[-1].get("text") or "") if items else ""
    except Exception:  # noqa: BLE001
        last, ring = float(w.get("started") or now), ""
    if now - last < STALL_S:
        return "working", "working"
    mins = int((now - last) // 60)
    return "stalled", f"silent {mins} min; last: {ring[:80] or 'nothing'}"


def working() -> dict:
    now = time.time()
    out, stalled, watching = [], [], []
    try:                                     # the work queue's item, running or being reviewed (workqueue.py)
        from . import workqueue
        wq = workqueue.standing()
        if wq.get("running"):
            out.append({"id": f"work:{wq['running']}", "kind": "task", "what": wq["said"]})
    except Exception:  # noqa: BLE001
        pass
    try:
        from . import task_runner
        q = task_runner.standing()
        if q.get("running"):
            out.append({"id": f"task:{q['running']}", "kind": "task", "what": q["said"]})
        if q.get("reviewing"):
            out.append({"id": f"task:{q['reviewing']}", "kind": "task", "what": f"reading what {q['reviewing']} found"})
    except Exception:  # noqa: BLE001
        pass
    try:
        from . import chat
        if getattr(chat, "ACTIVE_TURNS", 0) > 0:
            out.append({"id": "chat", "kind": "chat", "what": f"{chat.ACTIVE_TURNS} turn{'s' if chat.ACTIVE_TURNS > 1 else ''} in flight"})
    except Exception:  # noqa: BLE001
        pass
    out.extend(_brain_slots())
    try:
        from .core import jobs
        for j in jobs(40):
            if j.get("running"):
                out.append({"id": j["id"], "kind": "job", "what": j.get("title"), "since": j.get("started")})
    except Exception:  # noqa: BLE001
        pass
    for rj in (Path.home() / "lacuna-world" / "jobs").glob("*/.runner.json"):
        try:
            r = json.loads(rj.read_text())
        except (OSError, ValueError):
            continue
        if r.get("pid") and _pid_alive(r["pid"]) and _proc_has(r["pid"], rj.parent.name):
            out.append({"id": f"errand:{rj.parent.name}", "kind": "errand", "what": rj.parent.name, "since": r.get("started")})
    try:
        from . import foreman
        for w in (foreman.workers().get("workers") or []):
            if w.get("state") != "running":
                continue
            how, why = _worker_alive(w, now)
            row = {"id": w["id"], "kind": "worker", "what": f"{w.get('name')} · {why}", "since": w.get("started")}
            {"working": out, "watching": watching, "stalled": stalled}[how].append(row)
    except Exception:  # noqa: BLE001
        pass
    if out:
        _last_work["t"] = now
    else:                                    # idle since the newest END of any work: a job, a chat answer, a task event
        ends = [_last_work.get("seen", 0)]
        try:
            from .core import jobs
            ends += [float(j.get("ended") or 0) for j in jobs(40) if j.get("code") != -1]   # -1: gone, end unknown (stamped now)
        except Exception:  # noqa: BLE001
            pass
        try:
            from . import memory
            ends += [float(t.get("t") or 0) for t in (memory.page(None, 1).get("turns") or [])]
        except Exception:  # noqa: BLE001
            pass
        for p in (Path.home() / "lacuna-world" / "tasks" / "runs").glob("*.jsonl"):
            ends.append(p.stat().st_mtime)
        _last_work["seen"] = max(ends)
        _last_work["t"] = max(ends) or _last_work["t"]
    tail = (f" · {len(watching)} watching" if watching else "") + (f" · {len(stalled)} stalled" if stalled else "")
    said = (f"{len(out)} working" if out else f"idle since {time.strftime('%H:%M', time.localtime(_last_work['t']))}") + tail
    return {"count": len(out), "working": out, "watching": watching, "stalled": stalled,
            "idle_since": None if out else _last_work["t"], "said": said, "at": now}


@router.get("/api/minds/live")
def r_minds_live(n: int = 60, model: str | None = None) -> dict:
    """Every model call through the gateway, newest first (lacuna-box/brain/live.py): who asked, the model, what went in,
    what it thought, what it said, its tools, its time — the 26B and every small mind alike."""
    p = Path.home() / ".lacuna" / "minds-live.jsonl"
    rows = []
    try:
        with open(p, "rb") as f:
            f.seek(0, 2)
            f.seek(max(0, f.tell() - 1_500_000))
            for ln in f.read().decode(errors="replace").splitlines()[1:]:
                try:
                    rows.append(json.loads(ln))
                except ValueError:
                    pass
    except OSError:
        pass
    if model:
        rows = [r for r in rows if model in str(r.get("model"))]
    rows = rows[-max(1, min(400, n)):][::-1]
    return {"calls": rows, "by_model": {m: sum(1 for r in rows if r.get("model") == m) for m in {r.get("model") for r in rows}}}


# ── ONE LIST OF WHAT IS REALLY RUNNING (the owner, 2026-10-19: "the chips are out of whack … a chip glowing that I can't do anything to, that
# comes and goes with the brain, and when I ask the story is different") ───────────────────────────────────────────────────────────────
_LEASE = {"t": 0.0, "text": ""}


def _lease_text() -> str:
    if time.time() - _LEASE["t"] > 8:
        try:
            import subprocess
            _LEASE.update(t=time.time(), text=subprocess.run([str(Path.home() / "lacuna-world" / "tools" / "lease"), "status"], capture_output=True, text=True, timeout=5).stdout.strip())
        except Exception:  # noqa: BLE001
            _LEASE.update(t=time.time(), text="")
    return _LEASE["text"]


def _diagnose(name: str, since: float | None, plan_done: int, steps: int) -> list[str]:
    """WHY IS IT SLOW OR STUCK, in plain words (the owner, 2026-10-19: "it's stuck, find out why"): the things that actually made the repair card
    stand still — a GPU lease held by something else, a step with no tool activity, a failed write to the card, a plan with nothing done — read
    from the lease, the step's log and the card, never guessed."""
    out = []
    now = time.time()
    lease = _lease_text()
    m = re.search(r"leased to (\S+) since (\S+).*?about (\d+) min left", lease)
    if m and f"card:{name}" != m.group(1):
        out.append(f"waiting for the GPU: it is leased to {m.group(1)} for about {m.group(3)} more minutes")
    card = Path.home() / "lacuna-world" / "work" / name
    logs = sorted((card / "steps").glob("*.log")) if (card / "steps").is_dir() else []
    if logs:
        age = (now - logs[-1].stat().st_mtime) / 60
        if age > 5:
            out.append(f"no tool activity for {age:.0f} min — the model is thinking, or the brain is busy with you")
        text = logs[-1].read_text(errors="replace")
        errs = re.findall(r"(?m)^← (Could not find the exact text[^\n]*|[^\n]*(?:refused|error|Error)[^\n]{0,60})", text)
        if errs:
            out.append("its last write failed: " + errs[-1][:110] + (" — it was editing CARD.md with an exact-match edit; it should use `card fact/done/next/log`" if "exact text" in errs[-1] else ""))
    elif since and (now - since) > 180 and not (m and f"card:{name}" != m.group(1)):
        out.append("started but has not made a tool call yet")
    if since and (now - since) > 600 and plan_done == 0:
        out.append(f"{(now - since) / 60:.0f} min in and no plan item is done yet")
    if not out:
        out.append("nothing wrong found: it is working")
    return out


def _card_detail(name: str) -> dict:
    """What a running card is, in words: the cart it repairs, which step, what it did last, how far its plan is."""
    card = Path.home() / "lacuna-world" / "work" / name / "CARD.md"
    if not card.exists():
        return {}
    t = card.read_text(errors="replace")
    field = lambda k: (re.search(rf"^{k}: (.*)$", t, re.M) or [None, ""])[1]    # noqa: E731
    goal = field("goal")
    m = re.search(r"Repair the cart (\S+)", goal)
    plan = re.findall(r"^- \[( |x)\]", t, re.M)
    last = []
    logs = sorted((card.parent / "steps").glob("*.log"))
    if logs:
        for ln in logs[-1].read_text(errors="replace").splitlines()[-40:]:
            mm = re.match(r"→ (\w+) (.{0,110})", ln)
            if mm:
                last.append(f"{mm.group(1)} {mm.group(2)}")
    steps = int(field("steps_taken") or 0)
    started = None
    try:
        started = json.loads((Path.home() / "lacuna-world" / "jobs" / name / ".runner.json").read_text()).get("started")
    except (OSError, ValueError):
        pass
    return {"label": f"repairing {m.group(1)}" if m else name, "goal": goal[:300], "plan": f"{plan.count('x')}/{len(plan)} plan items done",
            "step": f"step {steps + 1}", "last": last[-3:], "card": name, "diagnosis": _diagnose(name, started, plan.count("x"), steps),
            "kickable": True,
            "what": f"step {steps + 1} · " + (f"last: {last[-1][:70]}" if last else "starting: reading the cart and the skill")}


def activity() -> dict:
    """Everything that is really working now, verified — a task, a worker, a job, a card's step, a plan Cloud Lacuna is making — each with a
    plain label, what it is doing, since when, for whom, whether it can be stopped, and where it is done. The chips, the Work Queue panel and
    Lacuna's own `running` tool all read THIS, so they cannot tell different stories. The brain's own slots are infrastructure, not work: not listed."""
    w = working()
    items = []
    for x in w.get("working") or []:
        if x["kind"] in ("chat", "brain"):
            continue
        it = {"id": x["id"], "kind": x["kind"], "label": str(x.get("what") or x["kind"]).split(" · ")[0][:40], "what": str(x.get("what") or ""),
              "since": x.get("since"), "state": "running", "who": x["kind"], "stoppable": x["kind"] in ("errand", "worker"),
              "where": {"app": "s-agents", "room": "calls"} if x["kind"] in ("worker", "errand", "agent") else {"app": "s-work", "room": "all"}}
        if x["kind"] == "errand":
            d = _card_detail(x["id"].removeprefix("errand:"))
            if d:
                it.update(d)
                it["where"] = {"app": "s-work", "room": "all"}
                it["who"] = "a repair card"
        items.append(it)
    for x in w.get("stalled") or []:
        items.append({"id": x["id"], "kind": "worker", "label": f"{str(x.get('what') or 'worker').split(' · ')[0][:30]}", "what": str(x.get("what") or "") + " — stalled: it has stopped answering",
                      "since": x.get("since"), "state": "stalled", "who": "worker", "stoppable": True, "where": {"app": "s-agents", "room": "calls"}})
    try:
        from . import plans
        for p in plans.listing(6):
            if p.get("state") == "planning":
                items.append({"id": p["id"], "kind": "plan", "label": "planning", "what": f"Cloud Lacuna is planning: {p.get('goal')}", "since": p.get("started"), "state": "running",
                              "who": p.get("model") or "Cloud Lacuna", "stoppable": False, "where": {"app": "s-agents", "room": "calls"}})
    except Exception:  # noqa: BLE001
        pass
    return {"items": items, "at": time.time(), "said": f"{len(items)} thing(s) running" if items else "nothing is running"}


_BAD_SINCE: dict = {}
_ALERTED: dict = {}


def watch_cards(now: float | None = None) -> list[str]:
    """STUCK RAISES ITSELF (the owner, 2026-10-19: "this job is stuck … make sure it doesn't happen"): every minute, each running card whose diagnosis
    names a problem for 15 minutes running raises ONE alert per hour — "<label> is stuck: <why>" — which also lands in the cortex as
    `fact/notice-…` with the playbooks, so the Kick button, the chat and Lacuna's `running` all have the same reason."""
    now = now or time.time()
    raised = []
    try:
        for it in activity()["items"]:
            diag = it.get("diagnosis") or []
            key = it["id"]
            bad = [d for d in diag if not d.startswith("nothing wrong")]
            if not bad:
                _BAD_SINCE.pop(key, None)
                continue
            first = _BAD_SINCE.setdefault(key, now)
            if now - first >= 15 * 60 and now - _ALERTED.get(key, -1e18) >= 3600:
                _ALERTED[key] = now
                from . import workers
                workers.raise_alert(f"card-stuck:{key}", "warn", f"{it['label']} is stuck", "; ".join(bad)[:400], notify=False)
                raised.append(key)
        for k in [k for k in _BAD_SINCE if k not in {i["id"] for i in activity()["items"]}]:
            _BAD_SINCE.pop(k, None)
    except Exception:  # noqa: BLE001 — a watch never breaks the tick
        pass
    return raised


def _lease_holder() -> tuple[str | None, str]:
    text = _lease_text()
    m = re.search(r"leased to (\S+)", text)
    return (m.group(1) if m else None), text


def card_alive(name: str) -> bool:
    """Is this card's step really running: a saved pid that is alive AND is this job's own process."""
    try:
        pid = json.loads((Path.home() / "lacuna-world" / "jobs" / name / ".runner.json").read_text()).get("pid")
    except (OSError, ValueError):
        return False
    return bool(pid) and _pid_alive(pid) and _proc_has(pid, name)


def reap_stale_lease() -> str | None:
    """THE CARD LOCK, CLEARED WHEN IT IS DEAD (the owner, 2026-10-19: "if you can get around the card lock, do it now"): the GPU lease is held by
    `card:<name>`; if that card has NO live process the lease is stale — its step was killed or crashed — and everything behind it waits out the
    lease's whole term (20 minutes on 2026-10-19). Release it. A live holder is never touched; neither is a lease held by the painter, a bake or a bench."""
    holder, _ = _lease_holder()
    if not holder or not holder.startswith("card:"):
        return None
    name = holder.removeprefix("card:")
    if card_alive(name):
        return None
    try:
        import subprocess
        subprocess.run([str(Path.home() / "lacuna-world" / "tools" / "lease"), "release", holder], capture_output=True, text=True, timeout=10)
        _LEASE["t"] = 0.0
        from .core import audit
        audit("lacuna", "lease.reaped", holder=holder)
        return holder
    except Exception:  # noqa: BLE001
        return None
