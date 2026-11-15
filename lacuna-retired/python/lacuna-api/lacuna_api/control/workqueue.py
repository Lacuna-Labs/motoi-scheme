"""THE WORK QUEUE (the owner, 2026-10-19: "we can use slatl work queues and scheme to keep them busy. and the llm can do it.
… a work queue we expose in the "work" card and on the command line as tasks in a queue for "work" which it can stop and
start … we just never made a work queue").

Everything a queue needs was built — the foreman and its workers (carts in Scheme, message passing), the durable card
(`task`/`card`: a goal, a plan, a done check, one fresh step at a time by `cardstep`, through crashes and reboots), the
state machine that reviews a run (task_runner: plan → run → summary, JSON forced, fresh context). There was no queue in
front of them. This is it.

THE QUEUE IS A FILE OF SLAT RECORDS: ~/lacuna-world/work/QUEUE.slat, one form a line, in order —
    (queue :on #f :by "owner" :since 1792…)
    (item :id "W3" :kind "cart" :ref "doc-drift" :title "…" :goal "…" :state "queued" :by "claude" :t 1792… …)
An item is one of:
    cart    a Lacuna cart (~/lacuna-world/carts/<ref>.sks) — a foreman worker runs it
    exam    an exam item's jail worker (carts.start_job)
    card    a durable card (~/lacuna-world/work/<ref>/CARD.md) — `cardstep` steps it until its done check passes
    goal    words only — the brain drafts its card (plan + a done check, JSON forced), and it runs as a card
States: queued → running → reviewing → done | stopped | failed; paused (a person's hand) and back.

THE RUNNER (tick, every minute in the workers' pass, and at once after any press): while the queue is ON, the first queued
item starts when none runs. A cart/exam item ends by its run's artifact, then its review (task_runner._review: what it
found, its steps, its summary — events kept as gl/Transcript reads them). A card item ends by its job's state (done /
dropped / paused). RUN_LIMIT_S bounds any one item; an item past it is stopped and said, and the queue moves on.

TURNING THE QUEUE ON is the owner's act (the Work card's key, `lacuna work on`): it stands a work order for 24 h if none
stands, so the queue's own cards (spawn-cart, spawn-job) are answered by it — never a release act (CUSTOMER_ACTS).

THE DOORS ARE THE NODE DOOR'S (2026-11-06, finale §3.12): `GET|POST /api/work/queue`, `/on`, `/off`, `/<id>/<op>` and
`/<id>/events` are `lacuna-node/frontend/work-queue.mjs`, with the router profile of each item. What stays here is the runner (the
minute tick, the start, the follow, the review) and the chat's queue tools; both sides hold the lock directory `QUEUE.slat.lock`.
"""
from __future__ import annotations

import json
import os
import re
import subprocess
import threading
import time
from pathlib import Path

from fastapi import HTTPException

from .core import audit

# The world's places are read at each call, not at import, through LACUNA_WORLD as forge.world() reads it (2026-11-01: an
# owner's press decided in a test started the press tick on its own thread, and that tick read and saved the LIVE
# ~/lacuna-world/work/QUEUE.slat, bound here at import, while the test's own world was elsewhere). A test may set WORK, QUEUE
# or JOBS.
WORK: Path | None = None
QUEUE: Path | None = None
TOOLS = Path.home() / "lacuna-world" / "tools"
JOBS: Path | None = None


def _world() -> Path:
    return Path(os.environ.get("LACUNA_WORLD") or Path.home() / "lacuna-world")


def _work() -> Path:
    return WORK or _world() / "work"


def _queue() -> Path:
    return QUEUE or _work() / "QUEUE.slat"


def _jobs() -> Path:
    return JOBS or _world() / "jobs"
RUN_LIMIT_S = 45 * 60
CARD_LIMIT_S = 4 * 3600
KINDS = ("cart", "exam", "card", "goal")
class _QueueLock:
    """The queue's lock across processes (2026-11-06, finale §3.12): the door's `work-queue.mjs` answers the queue's routes and
    writes QUEUE.slat too, so every load-change-save here also holds the directory `QUEUE.slat.lock` the door makes; reentrant
    within this process (a thread lock and a depth); a holder older than 60 s is taken as dead."""

    def __init__(self) -> None:
        self._t = threading.RLock()
        self._depth = 0

    def __enter__(self):
        self._t.acquire()
        self._depth += 1
        if self._depth == 1:
            lock = Path(str(_queue()) + ".lock")
            lock.parent.mkdir(parents=True, exist_ok=True)
            while True:
                try:
                    lock.mkdir()
                    break
                except FileExistsError:
                    try:
                        if time.time() - lock.stat().st_mtime > 60:
                            lock.rmdir()
                            continue
                    except OSError:
                        continue
                    time.sleep(0.05)
        return self

    def __exit__(self, *exc) -> None:
        self._depth -= 1
        if self._depth == 0:
            try:
                Path(str(_queue()) + ".lock").rmdir()
            except OSError:
                pass
        self._t.release()


_lock = _QueueLock()
_review_busy: set[str] = set()


# ── SLAT, one form a line ────────────────────────────────────────────────────────────────────────────────────────────
def _atom(v) -> str:
    if v is True:
        return "#t"
    if v is False:
        return "#f"
    if v is None:
        return "nil"
    if isinstance(v, (int, float)):
        return repr(round(v, 3) if isinstance(v, float) else v)
    return '"' + str(v).replace("\\", "\\\\").replace('"', '\\"').replace("\n", "\\n") + '"'


def _form(head: str, d: dict) -> str:
    return "(" + head + "".join(f" :{k} {_atom(v)}" for k, v in d.items() if v is not None) + ")"


_TOKEN = re.compile(r':([a-z_-]+)\s+("(?:[^"\\]|\\.)*"|#t|#f|nil|-?\d+(?:\.\d+)?)')


def _parse(line: str) -> tuple[str, dict] | None:
    m = re.match(r"\((\w+)", line.strip())
    if not m:
        return None
    d = {}
    for k, v in _TOKEN.findall(line):
        if v.startswith('"'):
            d[k] = re.sub(r'\\(.)', lambda mm: {"n": "\n"}.get(mm.group(1), mm.group(1)), v[1:-1])
        elif v in ("#t", "#f"):
            d[k] = v == "#t"
        elif v == "nil":
            d[k] = None
        else:
            d[k] = float(v) if "." in v else int(v)
    return m.group(1), d


def load() -> dict:
    head, items = {"on": False}, []
    try:
        for line in _queue().read_text().splitlines():
            p = _parse(line)
            if not p:
                continue
            if p[0] == "queue":
                head = {"on": False, **p[1]}
            elif p[0] == "item":
                items.append(p[1])
    except OSError:
        pass
    return {"head": head, "items": items}


def save(q: dict) -> None:
    _work().mkdir(parents=True, exist_ok=True)
    lines = [";; THE WORK QUEUE — one SLAT form a line, in order (control/workqueue.py). Edit by the Work card or `lacuna work`.",
             _form("queue", q["head"])] + [_form("item", it) for it in q["items"]]
    tmp = _queue().with_suffix(".tmp")
    tmp.write_text("\n".join(lines) + "\n")
    tmp.replace(_queue())
    _mirror(q)


def _next_id(q: dict) -> str:
    n = max([int(str(i.get("id", "W0"))[1:] or 0) for i in q["items"] if re.fullmatch(r"W\d+", str(i.get("id")))] + [0])
    return f"W{n + 1}"


def _find(q: dict, iid: str) -> dict:
    it = next((i for i in q["items"] if i.get("id") == iid), None)
    if not it:
        raise HTTPException(404, f"no item {iid}")
    return it


# ── adding ───────────────────────────────────────────────────────────────────────────────────────────────────────────
def add(title: str, by: str, goal: str = "", kind: str = "goal", ref: str = "", at: str = "end", why: str = "", waits_for: str = "") -> dict:
    kind = kind if kind in KINDS else "goal"
    if kind == "cart" and not (Path.home() / "lacuna-world" / "carts" / f"{ref}.sks").exists():
        return {"ok": False, "why": f"there is no cart {ref}"}
    if kind == "card" and not (_work() / ref / "CARD.md").exists():
        return {"ok": False, "why": f"there is no card {ref}"}
    with _lock:
        q = load()
        it = {"id": _next_id(q), "kind": kind, "ref": ref or None, "title": title.strip()[:160], "goal": (goal or title)[:1200],
              "why": why[:300] or None, "state": "queued", "by": by, "t": time.time(), "waits_for": (waits_for or "")[:24] or None}
        if at == "top":
            q["items"].insert(next((k for k, i in enumerate(q["items"]) if i["state"] == "queued"), len(q["items"])), it)
        else:
            q["items"].append(it)
        on = bool(q["head"].get("on"))
        save(q)
    audit(by, "work.add", item=it["id"], kind=kind, ref=ref, title=title[:80])
    said = f"{it['id']} queued: {it['title']}"
    if not on:                              # A QUEUED ITEM IN AN OFF QUEUE IS A DEAD END (2026-10-21: "W25 queued … Nothing runs")
        said += (" — but the QUEUE IS OFF: nothing will run it and no finish will wake you until someone turns the queue on "
                 "(`work op=queue on`, or the Work card). For a forge job the right verb is `forge op=train specialist=…`.")
    return {"ok": True, "item": it, "said": said, "queue_on": on}


def seed_from_claude(by: str = "claude") -> int:
    """Claude's ten tasks (claude_tasks) into the queue once, as cart and exam items — one list, not two."""
    from . import claude_tasks
    with _lock:
        q = load()
        have = {i.get("from") for i in q["items"]}
    n = 0
    for t in claude_tasks.tasks()["tasks"]:
        if t["id"] in have or t["state"] != "queued":
            continue
        kind, ref = ("cart", t["how"]["cart"]) if t["how"].get("cart") else ("exam", t["how"].get("exam"))
        r = add(f"{t['id']}: {t['title']}", by, t["why"], kind, ref, why=t["why"])
        if r.get("ok"):
            with _lock:
                q = load()
                _find(q, r["item"]["id"])["from"] = t["id"]
                save(q)
            n += 1
    return n


# ── the switch and the hands ─────────────────────────────────────────────────────────────────────────────────────────
def switch(on: bool, by: str) -> dict:
    from . import work_order
    with _lock:
        q = load()
        q["head"].update(on=bool(on), by=by, since=time.time())
        if on and not work_order.current():
            work_order.start(24, by)
            q["head"]["order_by_queue"] = True
        save(q)
    if not on and q["head"].get("order_by_queue"):
        work_order.end(by)
    audit(by, "work.queue." + ("on" if on else "off"))
    threading.Thread(target=tick, name="work-tick", daemon=True).start()
    return {"ok": True, "said": "the queue is ON: items run one after another" if on else "the queue is OFF: what runs finishes, nothing new starts"}


def stop_all(by: str) -> dict:
    """The owner said stop (2026-10-19: "let it stop the tasks … it seems to be on rails with the 10 things you gave it;
    i have my own plans"). The queue goes OFF, what runs is stopped, every queued item is paused — kept, never deleted,
    and none resumes until someone presses resume or start."""
    switch(False, by)
    with _lock:
        q = load()
        n = 0
        for it in q["items"]:
            if it.get("state") in ("running", "reviewing"):
                _stop_running(it, by)
                it.update(state="paused", note=f"stopped mid-run by {by}; resume to go on")
                n += 1
            elif it.get("state") == "queued":
                it["state"] = "paused"
                n += 1
        save(q)
    audit(by, "work.stop_all", items=n)
    return {"ok": True, "said": f"the queue is OFF and {n} item(s) are paused; nothing starts until the owner says so"}


def hand(iid: str, op: str, by: str) -> dict:
    with _lock:
        q = load()
        it = _find(q, iid)
        k = q["items"].index(it)
        if op in ("up", "down"):
            j = k - 1 if op == "up" else k + 1
            if 0 <= j < len(q["items"]):
                q["items"][k], q["items"][j] = q["items"][j], q["items"][k]
            said = f"{iid} moved {op}"
        elif op == "pause":
            if it["kind"] in ("card", "goal") and it.get("ref"):
                _card_state(it["ref"], "paused")
            it["state"] = "paused"
            said = f"{iid} paused"
        elif op == "resume":
            if it["kind"] in ("card", "goal") and it.get("ref") and it.get("started"):
                _card_state(it["ref"], "on")
                it["state"] = "running"
            else:
                it["state"] = "queued"
            said = f"{iid} resumed"
        elif op == "start":
            it["state"] = "queued"
            q["items"].remove(it)
            q["items"].insert(0, it)
            said = f"{iid} goes next"
        elif op in ("stop", "drop"):
            if it["state"] in ("running", "reviewing"):
                _stop_running(it, by)
            if op == "drop":
                q["items"].remove(it)
            else:
                it.update(state="stopped", ended=time.time(), note=f"stopped by {by}")
            said = f"{iid} {op}ped"
        else:
            raise HTTPException(400, "start · stop · pause · resume · up · down · drop")
        save(q)
    audit(by, f"work.{op}", item=iid)
    threading.Thread(target=tick, name="work-tick", daemon=True).start()
    return {"ok": True, "said": said}


def _card_state(name: str, state: str) -> None:
    subprocess.run([str(TOOLS / "task"), "pause" if state == "paused" else "resume", name], capture_output=True, timeout=30)


def _stop_running(it: dict, by: str) -> None:
    try:
        if it["kind"] in ("card", "goal") and it.get("ref"):
            _card_state(it["ref"], "paused")
        elif it.get("run"):
            from . import foreman
            foreman.call("DELETE", f"/workers/{it['run']}?by={by}", None, timeout=10)
    except Exception:  # noqa: BLE001
        pass


# ── the runner ───────────────────────────────────────────────────────────────────────────────────────────────────────
def _log(it: dict, ev: dict) -> None:
    from . import task_runner
    task_runner._log(it["id"], ev)


def _artifact_after(it: dict) -> dict | None:
    """The run of this item's cart/exam that started after the item did, from its artifact (cartview.parse_artifact)."""
    from . import artifacts
    from .cartview import parse_artifact
    key = it["ref"] if it["kind"] == "cart" else f"exam-{it['ref']}"
    a = artifacts.latest(key)
    if not a:
        return None
    r = parse_artifact(a.get("text") or "")
    started = str((r.get("run") or {}).get("started") or "")
    if started and started >= time.strftime("%Y-%m-%dT%H:%M:%S", time.localtime(float(it.get("started") or 0) - 5)):
        return {**r, "id": (r.get("run") or {}).get("id")}
    return None


def _card_job(name: str) -> dict:
    try:
        return json.loads((_jobs() / name / "job.json").read_text())
    except (OSError, ValueError):
        return {}


def _cart_slug(it: dict) -> str | None:
    """The cart a repair item is about: its ref, or a slug in its title/goal that is a real cart (carts/automations/<slug>)."""
    root = Path.home() / "code" / "curator" / "carts" / "automations"
    words = f"{it.get('ref') or ''} {it.get('title') or ''} {it.get('goal') or ''}"
    if not re.search(r"\b(repair|fix|mend|strict)\b", words, re.I):
        return None
    for slug in re.findall(r"\b[a-z0-9]+(?:-[a-z0-9]+){1,8}\b", words):
        if (root / slug).is_dir():
            return slug
    return None


def _draft_card(it: dict) -> dict:
    """A goal becomes a card. A CART REPAIR is the card tool's own `card repair <slug>` (2026-10-19: the brain's free-text card for
    "Repair custom-order-accept-notify" had `npm test` as its done check and no cart skill — its worker spent 25 minutes
    searching a sandbox with no node_modules and was refused twice): the worktree, the strict checker as the done check, the
    cart-repair plan. Anything else: the brain drafts its name, kind, plan and done check (JSON forced), `task new` writes it."""
    from . import task_runner
    slug = _cart_slug(it)
    if slug:
        r = subprocess.run([str(TOOLS / "task"), "repair", slug], capture_output=True, text=True, timeout=700)
        import hashlib
        name = f"repair-{slug}" if len(f"repair-{slug}") <= 40 else f"repair-{slug}"[:33].rstrip("-") + "-" + hashlib.sha1(slug.encode()).hexdigest()[:6]      # = tools/card task_name
        if (Path.home() / "lacuna-world" / "work" / name / "CARD.md").exists():
            return {"ok": True, "name": name, "plan": {"kind": "cart", "plan": ["cart repair by the card tool"]}, "said": (r.stdout or r.stderr).strip()[-300:]}
    plan = task_runner._brain_json(
        f"Turn this goal into a durable work card for Lacuna.\nGOAL: {it['goal']}\n\n"
        "Give: a short name (lowercase, dashes); the kind (cart: a Scheme cart · code: a code change on a branch · box: the "
        "machine · think: writing); 2-6 plan items, each one fresh step a worker can finish in under 20 minutes; and a "
        "done_check — ONE shell command that exits 0 only when the goal is truly met (for writing: test -s report.md && "
        "grep -q <a word the report must hold> report.md). Never touch QA, production, main or secrets.",
        {"type": "object", "required": ["name", "kind", "plan", "done_check"], "properties": {
            "name": {"type": "string"}, "kind": {"type": "string", "enum": ["cart", "code", "box", "think"]},
            "plan": {"type": "array", "minItems": 2, "maxItems": 6, "items": {"type": "string"}},
            "done_check": {"type": "string"}}}, it["id"], "drafted its card")
    name = re.sub(r"[^a-z0-9]+", "-", str(plan.get("name") or it["id"]).lower()).strip("-")[:40] or it["id"].lower()
    name = f"{name}-{it['id'].lower()}"
    r = subprocess.run([str(TOOLS / "task"), "new", name, "--goal", it["goal"], "--done", str(plan.get("done_check") or "false"),
                        "--kind", plan.get("kind") or "think", "--plan", "|".join(plan.get("plan") or [])],
                       capture_output=True, text=True, timeout=60)
    return {"ok": r.returncode == 0, "name": name, "plan": plan, "said": (r.stdout or r.stderr).strip()[-400:]}


def _start(it: dict) -> dict:
    """Start one item; returns fields to merge into it."""
    from . import carts
    _log(it, {"type": "round", "n": 0, "why": None})
    _log(it, {"type": "call", "id": "start", "tool": f"start {it['kind']}", "args": {"ref": it.get("ref"), "goal": it["goal"][:200]}})
    if it["kind"] == "cart":
        r = carts.start_named(it["ref"], "lacuna:work", False, f"{it['id']}: {it['title']} (the work queue)")
    elif it["kind"] == "exam":
        from . import home_cards
        ex = next((i for i in home_cards.exam().get("items") or [] if i["id"] == it["ref"]), {"title": it["title"]})
        r = carts.start_job(it["ref"], ex, "lacuna:work")
    else:
        if it["kind"] == "goal" and not it.get("ref"):
            d = _draft_card(it)
            _log(it, {"type": "result", "id": "draft", "tool": "task new", "ok": d["ok"], "text": json.dumps(d["plan"], indent=1) + "\n" + d["said"]})
            if not d["ok"]:
                return {"state": "failed", "ended": time.time(), "note": f"its card could not be written: {d['said'][:200]}"}
            it["ref"] = d["name"]
        _card_state(it["ref"], "on")
        r = {"ok": True, "state": f"card {it['ref']} handed to its runner"}
    ok = bool(r.get("ok") or r.get("petition"))
    _log(it, {"type": "result", "id": "start", "tool": f"start {it['kind']}", "ok": ok,
              "text": str(r.get("state") or r.get("said") or r.get("why") or r)[:800]})
    if not ok:
        return {"state": "failed", "ended": time.time(), "note": str(r.get("why") or r)[:300]}
    return {"state": "running", "started": time.time(), "card": r.get("petition"), "ref": it.get("ref"),
            "note": str(r.get("state") or "")[:200]}


def _follow(it: dict, now: float) -> dict:
    """Fields to merge when a running item has moved: its run ended, or its time ran out."""
    limit = CARD_LIMIT_S if it["kind"] in ("card", "goal") else RUN_LIMIT_S
    if now - float(it.get("started") or now) > limit:
        _stop_running(it, "lacuna:work")
        _log(it, {"type": "result", "id": "run", "tool": "its run", "ok": False, "text": f"no end after {limit // 60} min — stopped"})
        return {"state": "stopped", "ended": now, "note": f"ran past {limit // 60} min — stopped and said"}
    if it["kind"] in ("card", "goal"):
        st = _card_job(it["ref"]).get("state")
        if st in ("done", "dropped"):
            _log(it, {"type": "result", "id": "run", "tool": f"card {it['ref']}", "ok": st == "done", "text": f"the card is {st}"})
            return {"state": "done" if st == "done" else "stopped", "ended": now, "note": f"card {st}"}
        return {}
    a = _artifact_after(it)
    if not a:
        return {}
    oc = (a.get("outcome") or {})
    _log(it, {"type": "result", "id": "run", "tool": f"{it['kind']} {it['ref']}", "ok": oc.get("is") == "done",
              "text": f"{oc.get('is')}: {oc.get('reason') or ''}"})
    return {"state": "reviewing", "run": a.get("id"), "outcome": oc.get("is"), "note": str(oc.get("reason") or "")[:300]}


def _review(iid: str) -> None:
    from . import task_runner
    try:
        with _lock:
            it = dict(_find(load(), iid))
        t = {"id": iid, "title": it["title"], "why": it.get("why") or it["goal"], "how": {it["kind"] if it["kind"] == "cart" else "exam": it["ref"]}}
        task_runner._review(iid, t, {"state": "finished" if it.get("outcome") == "done" else "stopped", "note": it.get("note")})
        words = next((e.get("text") for e in reversed(task_runner.events(iid)) if e.get("type") == "answer"), "")
        with _lock:
            q = load()
            _find(q, iid).update(state="done" if "DONE" in str(words) else "stopped", ended=time.time(), review=str(words)[:1500])
            save(q)
    except Exception as e:  # noqa: BLE001
        audit("lacuna", "work.review-failed", item=iid, error=e.__class__.__name__)
        with _lock:
            q = load()
            _find(q, iid).update(state="stopped", ended=time.time(), note=f"its review failed: {e.__class__.__name__}")
            save(q)
    finally:
        _review_busy.discard(iid)


def _card_of(it: dict) -> str | None:
    """The state of the card this job waits for: waiting · approved · declined · None (no card, or none known)."""
    pid = it.get("waits_for")
    if not pid:
        return None
    try:
        from . import chat
        p = chat._petitions.get(pid)
    except Exception:  # noqa: BLE001
        return "waiting"
    return (p or {}).get("state") if p else "waiting"


def ranked(q: dict) -> list[dict]:
    """THE QUEUE BY APPROVALS (the owner, 2026-10-20: "keep jobs in queue … prioritize them based on approvals"): the queued jobs that may run
    now, in order — jobs whose card the owner approved first, then jobs that need no card, in the order they were added. A job whose card
    still waits is not offered; a job whose card was declined is stopped here, said, and never offered."""
    ready, plain = [], []
    for it in q["items"]:
        if it.get("state") != "queued":
            continue
        st = _card_of(it)
        if st == "declined":
            it.update(state="stopped", ended=time.time(), note=f"the owner declined its card {it.get('waits_for')}")
        elif st in ("waiting", "pending"):
            continue
        elif st == "approved":
            ready.append(it)
        else:
            plain.append(it)
    return ready + plain


_mirrored: dict = {}


def _mirror(q: dict) -> None:
    """Each job is a node in the cortex (fact job-W<n>: title, state, the card it waits for, its priority), written when its state changes,
    so `cortex recall job-W3` and the brief find the queue after a reboot or a long talk."""
    try:
        from .chat import cx
        for it in q["items"]:
            sig = (it.get("state"), it.get("waits_for"), _card_of(it))
            if _mirrored.get(it.get("id")) == sig:
                continue
            _mirrored[it.get("id")] = sig
            cx("fact", f"job-{it.get('id')}", {"text": f"{it.get('id')} {it.get('title')} — {it.get('state')}"
                                               + (f", waits for card {it.get('waits_for')} ({sig[2]})" if it.get("waits_for") else ""),
                                               "state": it.get("state"), "waits_for": it.get("waits_for") or "", "card": sig[2] or ""}, ["thing/queue"])
    except Exception:  # noqa: BLE001
        pass


def tick(now: float | None = None) -> dict:
    try:
        from . import agents_live
        agents_live.reap_stale_lease()              # a lease held by a card with no live process is freed at once (it cost a card 20 minutes)
        agents_live.watch_cards()                   # a running card with a problem for 15 min raises one alert an hour
    except Exception:  # noqa: BLE001
        pass
    now = now or time.time()
    did: dict = {}
    with _lock:
        q = load()
        changed = False
        for it in q["items"]:
            if it["state"] == "running":
                m = _follow(it, now)
                if m:
                    it.update(m)
                    changed = True
                    did["moved"] = it["id"]
            if it["state"] == "reviewing" and it["id"] not in _review_busy:
                _review_busy.add(it["id"])
                threading.Thread(target=_review, args=(it["id"],), name=f"work-review-{it['id']}", daemon=True).start()
                did["reviewing"] = it["id"]
        if changed:
            save(q)
        busy = any(i["state"] in ("running", "reviewing") for i in q["items"])
        if not q["head"].get("on") or busy:
            return did
        # IT WORKS WITHOUT BEING TOLD (the owner, 2026-10-19: "can it do work without a prompt? … if not make work that way"):
        # an ON queue keeps its own work order standing — this minute timer, in the launchd-kept API, is the wake
        from . import work_order
        if not work_order.current():
            work_order.start(24, "the work queue (on)")
            q["head"]["order_by_queue"] = True
        order = ranked(q)
        nxt = order[0] if order else None
        if not nxt:
            save(q)                                   # a declined job was stopped in ranked(): keep it
            return did
        nxt["state"] = "running"                      # claimed under the lock: a second tick never starts it twice
        nxt["started"] = now
        save(q)
    try:
        m = _start(nxt)
    except Exception as e:  # noqa: BLE001 — a start that throws fails the item, said; it never leaves it "running" mute
        audit("lacuna", "work.start-failed", item=nxt["id"], error=f"{e.__class__.__name__}: {e}"[:200])
        _log(nxt, {"type": "result", "id": "start", "tool": f"start {nxt['kind']}", "ok": False, "text": f"{e.__class__.__name__}: {e}"[:600]})
        m = {"state": "failed", "ended": time.time(), "note": f"its start threw {e.__class__.__name__}: {str(e)[:160]}"}
    with _lock:
        q = load()
        _find(q, nxt["id"]).update(m)
        save(q)
    did["started"] = nxt["id"]
    return did


def standing() -> dict:
    q = load()
    run = next((i for i in q["items"] if i["state"] in ("running", "reviewing")), None)
    left = [i for i in q["items"] if i["state"] == "queued"]
    if run:
        said = f"{'reviewing' if run['state'] == 'reviewing' else 'working on'} {run['id']}: {run['title']}"
    elif left and not q["head"].get("on"):
        said = f"{len(left)} item{'s' if len(left) > 1 else ''} queued — the queue is OFF; turn it on and they run one after another"
    elif left:
        said = f"next: {left[0]['id']}: {left[0]['title']}"
    else:
        said = "the queue is empty"
    return {"on": bool(q["head"].get("on")), "said": said, "running": run["id"] if run else None, "left": len(left)}
