"""THE WORK VIEW'S FEED — what Lacuna is running and what each piece of work INTENDS (the owner, 2026-10-18: "a cart work
view … we need to see what its intent is, like what it's doing in its workflow. So not just freewheel things").

GET /api/work → {items, at}. One item per piece of work on the box now (or finished in the last 30 minutes):
  {id, kind: worker · cart · errand, title (the intent, one line), why (the card or exam it serves), state,
   steps: [{name, state: done · now · todo}], now (its last note), waiting (why it is not moving, when it is not),
   runs, minutes, mind}
A jail worker's steps are its class's fixed workflow (CLASS_STEPS), placed by its last progress note; a foreman cart's
are its declared plan (what it does, its judgment points, its done-condition); an errand's are its own sub-jobs when it
names them (the pantheon line), else run → check-in → done check. Status words follow AFH 33-337. Read-only.
"""
from __future__ import annotations

import json
import os
import re
import time
from pathlib import Path

RECENT_S = 30 * 60
# each jail worker class's workflow, in order, and the words in its progress note that mean it reached a step
CLASS_STEPS = {
    "repair": [("make worktree", r"making the worktree"), ("read cart", r"reading|the cart"), ("quick check", r"before:"),
               ("model round", r"round|asking"), ("strict check", r"live|strict check|work check"), ("merge card", r"merge|passes")],
    "docs": [("survey folder", r"survey|reading"), ("write README", r"writing|README"), ("docs gate", r"gate"), ("merge card", r"merge")],
    "codemap": [("survey package", r"survey|reading"), ("write CODEMAP", r"CODEMAP"), ("docs gate", r"gate"), ("merge card", r"merge")],
    "testfix": [("make worktree", r"worktree"), ("run test", r"running|failing|before"), ("fix round", r"round"),
                ("rerun test", r"rerun|passes|still failing"), ("merge card", r"merge")],
    "disk-steward": [("list worktrees", r"list|found"), ("remove retired", r"removed"), ("report", r"kept|report")],
    "recall-check": [("write report", r"report"), ("ask cortex", r"asked|recall"), ("compare", r"answered|found")],
}


def _world() -> Path:
    return Path(os.environ.get("LACUNA_WORLD") or Path.home() / "lacuna-world")


def _read(p: Path, default):
    try:
        return json.loads(p.read_text())
    except (OSError, ValueError):
        return default


def _lines(p: Path, n: int = 30) -> list:
    try:
        rows = p.read_text(errors="replace").splitlines()[-n:]
    except OSError:
        return []
    out = []
    for r in rows:
        try:
            out.append(json.loads(r))
        except ValueError:
            continue
    return out


def place(steps: list, note: str, finished: bool, failed: bool) -> list:
    """The class's steps marked done/now/todo from the last note (the furthest step whose words appear)."""
    at = 0
    for i, (_, pat) in enumerate(steps):
        if re.search(pat, note or "", re.I):
            at = i
    if finished and not failed:
        return [{"name": s, "state": "done"} for s, _ in steps]
    return [{"name": s, "state": "done" if i < at else ("failed" if failed else "now") if i == at else "todo"}
            for i, (s, _) in enumerate(steps)]


def _workers() -> list:
    out, now = [], time.time()
    for d in sorted(_world().glob("jobs/w-*")):
        st = _read(d / "state.json", {})
        state = st.get("state") or "?"
        if state not in ("executing", "briefed", "spawned", "waiting") and now - float(st.get("at") or 0) > RECENT_S:
            continue
        brief = next((m for m in reversed(_lines(d / "mailbox.jsonl")) if m.get("kind") == "brief"), {}) or {}
        job = brief.get("job") or {}
        cls = job.get("class") or d.name.split("-")[1]
        prog = _read(d / "progress.json", {}) or {}
        journal = _lines(d / "journal.jsonl")
        runs = max([int(e.get("run") or 0) for e in journal if e.get("event") == "start"] or [0])
        busy = [e for e in journal[-4:] if e.get("event") == "exit" and e.get("code") == 75]
        rep = _read(d / "report.json", {}) or {}
        failed = state in ("crashed", "failed") or rep.get("ok") is False
        hist = st.get("history") or []
        started = hist[0]["at"] if hist else st.get("at") or now
        out.append({"id": d.name, "kind": "worker", "title": job.get("brief") or f"{cls} worker", "why": brief.get("card") or "",
                    "state": state, "steps": place(CLASS_STEPS.get(cls, [("run", r".")]), prog.get("note", ""), bool(prog.get("finished")), failed),
                    "now": str(rep.get("said") or prog.get("note") or "")[:220], "class": cls,
                    "result": "failed" if failed else ("done" if state == "retired" else ""),
                    "waiting": "the brain is busy (background lane); retries every 5 min" if busy and state in ("briefed", "executing") else "",
                    "runs": runs, "minutes": round(((st.get("at") or now) if state not in ("executing", "briefed") else now) / 60 - started / 60, 1)})
    return out


def _carts() -> list:
    out = []
    try:
        from . import agent_talk
        nodes = agent_talk.tree().get("nodes") or []
    except Exception:  # noqa: BLE001 — the foreman may be down: the rest of the work still shows
        return out
    now = time.time()
    for n in nodes:
        rec = n.get("cart") or {}
        if not rec and n.get("kind") != "agent":
            continue
        if n.get("state") != "running" and now - float(n.get("started") or 0) > RECENT_S:
            continue
        header = rec.get("header") or {}
        plan = [header.get("does") or n.get("name")] + [f"judgment: {j}" for j in header.get("judgment") or []] + [f"done when: {header.get('done') or 'its done-condition holds'}"]
        running = n.get("state") == "running"
        out.append({"id": n["id"], "kind": "cart", "title": header.get("does") or rec.get("asked") or n.get("name"), "why": rec.get("exam") or "",
                    "state": n.get("state"), "now": str(n.get("last_line") or "")[:220], "waiting": "", "runs": 1 + int(n.get("restarts") or 0),
                    "steps": [{"name": s[:80], "state": ("now" if i == 0 else "todo") if running else "done"} for i, s in enumerate(plan)],
                    "mind": (n.get("mind") or {}).get("model"), "minutes": round((now - float(n.get("started") or now)) / 60, 1)})
    return out


def _errands() -> list:
    out = []
    for f in sorted(_world().glob("jobs/*/job.json")):
        if f.parent.name.startswith("w-"):
            continue
        job = _read(f, {})
        rs = _read(f.parent / ".runner.json", {})
        if job.get("state") != "on" or not (rs.get("pid") or job.get("every")):
            continue
        prog = _read(f.parent / "progress.json", {}) or {}
        steps = [{"name": "run", "state": "now" if rs.get("pid") else "done"}, {"name": "check-in", "state": "todo"}, {"name": "done check", "state": "todo"}]
        if job["name"] in ("pantheon-pairs", "pantheon-line"):
            steps = _pantheon_steps(job["name"])
        out.append({"id": f"errand:{job['name']}", "kind": "errand", "title": job.get("goal") or job["name"], "why": job["name"],
                    "state": "running" if rs.get("pid") else f"next run {'every ' + job['every'] if job.get('every') else 'scheduled'}",
                    "steps": steps, "now": str(prog.get("note") or "")[:220], "waiting": rs.get("waiting") or "", "runs": int(rs.get("runs") or 0),
                    "minutes": None, "heavy": bool(job.get("heavy"))})
    return out


def _pantheon_steps(name: str) -> list:
    forge = _world() / "forge"
    try:
        minds = [m["name"] for m in json.loads((forge / "pantheon.json").read_text())["minds"]]
    except (OSError, ValueError, KeyError):
        return []
    out, now_set = [], False
    for m in minds:
        done = (forge / "data" / f"p-{m}" / "DONE").exists() if name == "pantheon-pairs" else (forge / "results" / "pantheon" / f"{m}.json").exists()
        st = "done" if done else ("now" if not now_set else "todo")
        now_set = now_set or st == "now"
        out.append({"name": m, "state": st})
    return out


def _latest_per_card(items: list) -> list:
    """One row per card: the newest run; the earlier runs of the same card become a count on it."""
    seen, out = {}, []
    for it in sorted(items, key=lambda x: x["id"], reverse=True):
        k = it.get("why") or it["id"]
        if k in seen:
            seen[k]["earlier"] = seen[k].get("earlier", 0) + 1
            continue
        seen[k] = it
        out.append(it)
    return out


def work() -> dict:
    items = _carts() + _latest_per_card(_workers()) + _errands()
    rank = {"executing": 0, "running": 0, "briefed": 1, "spawned": 1, "waiting": 1}
    items.sort(key=lambda x: (rank.get(x["state"], 2), x["id"]))
    return {"items": items, "at": time.time()}


# ── WORK AS A DECISION TREE (the owner, 2026-10-18: "work is like a decision tree … we want to go see the workers and
# what they're doing, their failures, their successes, and what Lacuna chose and decided based on that … so we can judge
# the performance of them, because that's data we need … to know what to train") ──────────────────────────────────────
def _artifact_runs() -> list:
    from .cartview import parse_artifact
    out = []
    for d in sorted((_world() / "artifacts").glob("*")):
        if not d.is_dir():
            continue
        for f in d.glob("*.slat"):
            r = parse_artifact(f.read_text(errors="replace"))
            run, oc, minds = r.get("run", {}), r.get("outcome", {}), r.get("minds", {})
            out.append({"card": d.name, "id": f.stem, "class": run.get("class") or d.name, "started": run.get("started") or "",
                        "ended": run.get("ended") or "", "outcome": oc.get("is") or "?", "reason": (oc.get("reason") or "")[:200],
                        "minutes": float(minds.get("minutes") or 0), "brain_s": float(minds.get("brain-seconds") or 0),
                        "minds": minds.get("used") or [], "steps": len(r.get("steps") or [])})
    return out


def tree(hours: float = 48) -> dict:
    """{cards: [{card, nodes: [decision | attempt, in time order]}], perf: [{class, runs, done, stopped, rate, minutes,
    brain_s}]} — a card's branch: the decision that started it, each attempt and its outcome, the decision after."""
    import time as _t
    from . import chat
    since = _t.time() - hours * 3600
    iso = lambda t: _t.strftime("%Y-%m-%dT%H:%M:%S", _t.localtime(t))  # noqa: E731
    cards: dict = {}
    for p in chat.petitions():
        if p.get("t", 0) < since:
            continue
        a = p.get("args") or {}
        card = f"exam-{a['exam']}" if a.get("exam") else (a.get("cart") or p.get("build") or p.get("action"))
        who = "Lacuna" if str(p.get("by", "")).startswith("lacuna") else "owner" if p.get("by") in ("alfred", "home") else str(p.get("by"))
        cards.setdefault(card, []).append({"type": "decision", "at": iso(p["t"]), "who": who, "what": p.get("action"),
                                           "said": (p.get("reason") or "")[:160], "state": p.get("state"), "decided_by": p.get("decided_by")})
    runs = [r for r in _artifact_runs() if r["started"] >= iso(since)]
    for r in runs:
        cards.setdefault(r["card"], []).append({"type": "attempt", "at": r["started"], **r})
    out = []
    for card, nodes in cards.items():
        nodes.sort(key=lambda n: n["at"])
        last = next((n for n in reversed(nodes) if n["type"] == "attempt"), None)
        out.append({"card": card, "nodes": nodes[-14:], "last": last["outcome"] if last else "no attempt yet", "at": nodes[-1]["at"]})
    out.sort(key=lambda c: c["at"], reverse=True)
    perf = {}
    for r in runs:
        q = perf.setdefault(r["class"], {"class": r["class"], "runs": 0, "done": 0, "stopped": 0, "minutes": 0.0, "brain_s": 0.0})
        q["runs"] += 1
        q["done" if r["outcome"] == "done" else "stopped"] += 1
        q["minutes"] += r["minutes"]
        q["brain_s"] += r["brain_s"]
    for q in perf.values():
        q["rate"] = round(q["done"] / q["runs"], 2) if q["runs"] else 0
        q["minutes"] = round(q["minutes"] / max(1, q["runs"]), 1)
        q["brain_s"] = round(q["brain_s"] / max(1, q["runs"]))
    return {"cards": out[:40], "perf": sorted(perf.values(), key=lambda q: -q["runs"]), "lacuna": lacuna_record(hours)}


def lacuna_record(hours: float = 48) -> dict:
    """Lacuna's own record: its calls to the brain (rate, time, by hour) and how often a small mind climbed to it."""
    import os as _os
    import time as _t
    home = _os.environ.get("LACUNA_HOME") or _os.path.expanduser("~/.lacuna")
    since = _t.time() - hours * 3600
    calls = [c for c in _lines(Path(home) / "calls.jsonl", 20000) if c.get("t", 0) >= since]
    ms = sorted(c["ms"] for c in calls if c.get("ok"))
    pct = lambda q: ms[min(len(ms) - 1, int(q * len(ms)))] if ms else None  # noqa: E731
    hours_n = int(hours)
    by_hour = [{"calls": 0, "fails": 0} for _ in range(hours_n)]
    for c in calls:
        i = min(hours_n - 1, int((c["t"] - since) // 3600))
        by_hour[i]["calls"] += 1
        by_hour[i]["fails"] += 0 if c.get("ok") else 1
    iso = _t.strftime("%Y-%m-%dT%H:%M:%S", _t.localtime(since))
    def _after(e):                                   # escalations carry an ISO time ("at") or seconds ("t")
        v = e.get("t") or e.get("at") or 0
        return str(v) >= iso if isinstance(v, str) else float(v) >= since
    climbs = [e for e in _lines(_world() / "cascade" / "escalations.jsonl", 20000) if _after(e)]
    return {"calls": len(calls), "fails": sum(1 for c in calls if not c.get("ok")), "p50_ms": pct(0.5), "p95_ms": pct(0.95),
            "by_hour": by_hour, "climbs": len(climbs)}


def brief() -> str:
    """Lacuna's own work, in work mode, for the head of every conversation (the owner, 2026-10-18: "I want to … see what
    it's working on and tell how far along it is and talk to it about what it's working on, and it tells me how long it
    will take"). Running work with its step and an estimate; the pantheon line's progress; at most ~1,200 characters."""
    import json as _j
    lines = []
    # THE RELEASE FIRST (the owner, 2026-10-19: the answer said "Release: step 1/2" while it stood at the promote)
    try:
        from . import release_run
        rr = release_run.run()
        if rr.get("state") == "running":
            done_steps = [x["label"] for x in rr.get("steps") or [] if x["state"] == "done"]
            lines.append(f"- the release ({'dry run' if rr.get('dry') else 'real'}): now at {rr.get('now')}"
                         + (f", waiting for the owner's press on card {rr['press']['id']}" if rr.get("press") else "")
                         + f"; done: {', '.join(done_steps) or 'nothing yet'}")
    except Exception:  # noqa: BLE001
        pass
    try:                                             # a job past its usual time is said first, with where (stuck.py)
        from . import stuck
        for r in stuck.stuck():
            if r["overdue"]:
                lines.append(f"- STUCK: {stuck.words(r)}")
    except Exception:  # noqa: BLE001
        pass
    try:                                             # the tasks Claude left, by state
        from . import claude_tasks
        ct = claude_tasks.tasks()["tasks"]
        by = {}
        for t in ct:
            by.setdefault(t["state"], []).append(t["id"])
        lines.append("- Claude's ten tasks: " + "; ".join(f"{k} {', '.join(v)}" for k, v in by.items())
                     + (f". Next queued: {next(t['id'] + ' ' + t['title'] for t in ct if t['state'] == 'queued')}" if by.get("queued") else ""))
    except Exception:  # noqa: BLE001
        pass
    try:
        w = work()["items"]
    except Exception:  # noqa: BLE001
        w = []
    perf = {}
    try:
        perf = {q["class"]: q for q in tree(72)["perf"]}
    except Exception:  # noqa: BLE001
        pass
    for it in [x for x in w if x["state"] in ("running", "executing", "briefed", "waiting") and not str(x["id"]).startswith("errand:pantheon")][:6]:
        steps = it.get("steps") or []
        done = sum(1 for s in steps if s["state"] == "done")
        now = next((s["name"] for s in steps if s["state"] == "now"), "")
        est = ""
        q = perf.get(it.get("class") or "")
        if q and q.get("minutes") and it.get("minutes") is not None:
            left = max(1, round(q["minutes"] - it["minutes"]))
            est = f" ~{left} min left (its class averages {q['minutes']} min)"
        who = str(it.get("why") or it.get("id"))
        what = {"errand": "an errand", "cart": "a cart", "worker": "a worker", "job": "a job"}.get(str(it.get("kind")), str(it.get("kind") or "work"))
        lines.append(f"- {who} ({what}): {it['title'][:110]} — now: {now or it['state']}, step {done + 1} of {len(steps) or 1}{est}"
                     + (f"; waiting for: {it['waiting'][:80]}" if it.get("waiting") else ""))
    try:
        pan = _j.loads((_world() / "forge" / "pantheon.json").read_text())["minds"]
        writing = []
        for m in pan:
            if m.get("later"):
                continue
            d = _world() / "forge" / "data" / f"p-{m['name']}"
            kept = sum(1 for _ in open(d / "kept.jsonl")) if (d / "kept.jsonl").exists() else 0
            if not (d / "DONE").exists():
                at = (d / "kept.jsonl").stat().st_mtime if (d / "kept.jsonl").exists() else 0
                writing.append((m.get("title") or m["name"], kept, m.get("target") or 0, at))
        if writing:
            t, k, n, _ = max(writing, key=lambda x: x[3])            # the one being written now: its file moved last
            rest = sum(max(0, b - a) for _, a, b, _ in writing)
            lines.append(f"- the pantheon: writing pairs for {t} ({k}/{n}); {len(writing)} minds still writing, ~{max(1, round(rest / 7))} min of pairs left at ~7 kept a minute; training follows on the line")
    except (OSError, ValueError, KeyError):
        pass
    if not lines:
        return "YOUR WORK NOW: nothing running."
    return ("YOUR WORK NOW (from Work, live; answer 'what are you doing / how far / how long' from this, in work mode):\n"
            + "\n".join(lines))[:1200]
