"""LACUNA CARTS, from Lacuna's side (LACUNA-1.3-DESIGN §37.1–§37.3; B45 the format, B47 artifacts, B48 leases).

A cart is ~/lacuna-world/carts/<name>.sks: a header the foreman reads before anything runs (lacuna-foreman/cart.mjs), then
plain Lacuna Scheme. Lacuna's part is everything with a disk or a person in it, because the foreman's sandbox has neither:

  start(item, who)    an exam item → its cart's file → the foreman's trial → a permission card (spawn-cart). Nothing runs
                      before the owner's yes; the exam row says it waits on that card.
  spawn(args, who)    the yes: take a lease on everything the header touches (refuse with who holds it), load the cart in
                      the foreman, the exam row goes running.
  retired(w, data)    the cart ended (done, stopped, buried): its run artifact is written by the jail's artifact.py (one
                      format for every run), its leases go back, its exam row moves to done · press · failed with its
                      minutes, brain-seconds and minds.
  stop(item, who)     the desk's or the CLI's stop: the foreman retires it and the artifact says who.

The exam's file is ~/lacuna-world/exam/state.json (schema: home.py; read by home_cards.exam()). Writes here are under a
lock and atomic, because the foreman's events and a person's command can land at once.
"""
from __future__ import annotations

import fcntl
import importlib.util
import json
import re
import os
import threading
import time
from pathlib import Path

from . import home_cards

LEASE_SPAN = "2h"           # a dead cart's leases run out by themselves; a live one renews nothing (one pass is short)


def carts_dir() -> Path:
    return Path(os.environ.get("LACUNA_CARTS") or home_cards.world() / "carts")


def _load(name: str, rel: str):
    """A jail module by path: the repo's copy first (the API runs from the repo), the deployed jail's if missing."""
    for p in (Path(__file__).resolve().parents[3] / "lacuna-box" / "jail" / rel, Path.home() / ".lacuna" / "jail" / rel):
        if p.exists():
            spec = importlib.util.spec_from_file_location(name, p)
            mod = importlib.util.module_from_spec(spec)
            spec.loader.exec_module(mod)
            return mod
    raise FileNotFoundError(f"the jail's {rel} is not on this machine")


def lease():
    return _load("lacuna_lease", "lease.py")


def eid_of(x) -> str | None:
    s = str(x or "").strip().upper().replace("ITEM", "").strip()
    s = f"E{s}" if s.isdigit() else s
    return s if s in {e for e, _, _ in home_cards.EXAM} else None


def item(eid: str) -> dict:
    return next(i for i in home_cards.exam()["items"] if i["id"] == eid)


def exam_update(eid: str, **fields) -> dict:
    """Change one exam row, under the file's lock; the first row to run stamps the exam's start."""
    p = home_cards.exam_init()
    with open(p.with_suffix(".lock"), "a+") as lk:
        fcntl.flock(lk, fcntl.LOCK_EX)
        try:
            try:
                doc = json.loads(p.read_text())
            except (OSError, ValueError):
                doc = {"started": None, "items": []}
            rows = doc.setdefault("items", [])
            row = next((r for r in rows if r.get("id") == eid), None)
            if row is None:
                base = next(b for b in home_cards.EXAM if b[0] == eid)
                row = {"id": eid, "title": base[1], "cart": base[2], "state": "waiting", "worker": None, "minutes": 0,
                       "brain_seconds": 0, "minds": [], "said": "", "petition": None}
                rows.append(row)
            row.update(fields)
            if fields.get("state") == "running" and not doc.get("started"):
                doc["started"] = time.strftime("%Y-%m-%dT%H:%M:%S")
            tmp = p.with_suffix(f".{os.getpid()}.tmp")
            tmp.write_text(json.dumps(doc, indent=1) + "\n")
            os.replace(tmp, p)
            return row
        finally:
            fcntl.flock(lk, fcntl.LOCK_UN)


# ── leases (B48) ────────────────────────────────────────────────────────────────────────────────────────────────────
def holder(cart: str, eid: str | None) -> str:
    return f"cart:{cart}:{eid or 'run'}"


def take_leases(touches: list, who: str, why: str) -> tuple[list, str | None]:
    """Every thing or none: one refused → the ones already taken go back, and the refusal names who holds it."""
    lm, took = lease(), []
    for t in [str(x) for x in touches or []]:
        out = lm.take_on(t, who, LEASE_SPAN, why)
        if not out.startswith("ok"):
            give_back(took, who)
            return [], out.removeprefix("no: ")
        took.append(t)
    return took, None


def give_back(touches: list, who: str) -> None:
    lm = lease()
    for t in touches or []:
        lm.release_on(str(t), who)


# ── the run ─────────────────────────────────────────────────────────────────────────────────────────────────────────
def start(x, who: str) -> dict:
    """An exam item handed to its cart: tried first, then a permission card. Only the yes loads it (spawn)."""
    eid = eid_of(x)
    if not eid:
        return {"ok": False, "why": f"there is no exam item {x} — the items are E1 to E10"}
    it = item(eid)
    if it["state"] == "running":
        return {"ok": False, "why": f"{eid} is already running as worker {it['worker']} — `lacuna exam stop {eid}` first"}
    # a second press while the first card is still pending is the same request, not a new one (2026-10-18: six presses
    # of the desk's "start an item" filed six E6 cards and ran six docs workers)
    from . import chat as _chat
    pend = next((p for p in _chat.petitions() if p.get("id") == it.get("petition") and p.get("state") == "waiting"), None)
    if pend:
        return {"ok": True, "petition": pend["id"], "exam": eid, "said": f"{eid}: approval card {pend['id']} already pending", "cart": {"name": it["cart"]}}
    path = carts_dir() / f"{it['cart']}.sks"
    if not path.exists() and eid in home_cards.EXAM_WORKERS:
        return start_job(eid, it, who)
    if not path.exists():
        return {"ok": False, "why": f"{eid} belongs to the cart {it['cart']}, which is not written yet ({path})"}
    program = path.read_text()
    from . import chat, foreman
    t = foreman.call("POST", "/check", {"program": program}, timeout=30)
    if not t.get("ok"):
        return {"ok": False, "fix_first": t.get("problems") or [t.get("why")], "why": "the cart did not pass its trial"}
    cart = t.get("cart") or {}
    if not cart:
        return {"ok": False, "why": f"{path.name} has no (lacuna-cart …) header — a cart says what it is first"}
    if cart.get("exam") and cart["exam"] != eid:
        return {"ok": False, "why": f"{path.name} says it is exam {cart['exam']}, not {eid}"}
    lines = program.strip().splitlines()
    shown = "\n".join(lines[:16]) + (f"\n… {len(lines) - 16} more lines" if len(lines) > 16 else "")
    r = chat.file_petition("spawn-cart", None, f"exam {eid}: {it['title']}", who,
                           args={"cart": it["cart"], "exam": eid, "program": program, "shown": shown, "header": cart, "asked_by": who})
    if r.get("petition"):
        exam_update(eid, petition=r["petition"], said="waiting for the owner's yes on the card")
    return {**r, "exam": eid, "cart": cart}


def start_named(name: str, who: str, dry: bool = False, why: str = "", mode: str | None = None, arg: str = "") -> dict:
    """A cart by its name (not an exam item): tried first, then the permission card for this run (spawn-cart).
    `mode` and `arg` are the release cart's (release_run.r_start checks both first): written into the program's two
    mode lines before the trial, so the press shows the program that will run."""
    path = carts_dir() / f"{name}.sks"
    if not re.fullmatch(r"[a-z][a-z0-9-]{1,40}", name or "") or not path.exists():
        return {"ok": False, "why": f"there is no cart {name}"}
    if name == "release" and not dry and mode != "rollback":   # B13: the hold stops a real release, from anywhere; a roll back stays open
        from .release_run import hold
        h = hold()
        if h:
            return {"ok": False, "why": f"the release is held ({h.get('why')}, by {h.get('by')}) — lift the hold first"}
    from . import chat
    pend = next((p for p in chat.petitions() if p.get("action") == "spawn-cart" and (p.get("args") or {}).get("cart") == name and p.get("state") == "waiting"), None)
    if pend and mode and ((pend.get("args") or {}).get("mode") or "push") != mode:
        return {"ok": False, "why": f"a card for the release cart's {(pend.get('args') or {}).get('mode') or 'push'} is already waiting ({pend['id']}): answer it first"}
    if pend:
        # a card already waiting is offered to a standing work order too — else a queue that re-asks finds it and stops
        # there for good (the work queue's W1, 2026-10-19)
        from . import work_order
        ans = work_order.covers(pend)
        if ans is not None:
            d = chat._decided(pend["id"], ans["approve"], "lacuna", ans["by"])
            return {"ok": True, "petition": pend["id"], "auto": True, "state": f"answered by the owner's work order: {ans['why']}",
                    "result": (d.get("petition") or {}).get("result")}
        return {"ok": True, "petition": pend["id"], "said": f"the card to run {name} is already waiting ({pend['id']})"}
    program = path.read_text()
    if mode:
        from .release_run import with_mode
        program = with_mode(program, mode, arg)
        if program is None:
            return {"ok": False, "why": f"the release cart on the box has no mode lines: it runs only a push, not {mode}"}
    from . import foreman
    t = foreman.call("POST", "/check", {"program": program}, timeout=30)
    if not t.get("ok"):
        return {"ok": False, "fix_first": t.get("problems") or [t.get("why")], "why": f"the cart {name} did not pass its trial"}
    lines = program.strip().splitlines()
    shown = "\n".join(lines[:16]) + (f"\n… {len(lines) - 16} more lines" if len(lines) > 16 else "")
    return chat.file_petition("spawn-cart", None, why or f"run the cart {name}{' (dry)' if dry else ''}", who,
                              args={"cart": name, "exam": None, "program": program, "shown": shown, "header": t.get("cart") or {},
                                    "asked_by": who, "dry": bool(dry), **({"mode": mode, "arg": arg} if mode else {})})


# ── an item run by one of Lacuna's jail worker classes (home_cards.EXAM_WORKERS) ─────────────────────────────────────
JAIL_FOREMAN = Path.home() / ".lacuna" / "jail" / "workers" / "foreman.py"


def job_args(eid: str) -> dict | None:
    cls, inputs = home_cards.EXAM_WORKERS.get(eid) or (None, None)
    if not cls:
        return None
    return {"exam": eid, "class": cls, "inputs": {**inputs, "exam": eid}}


def job_effect(a: dict) -> str | None:
    """The card's words for a spawn-job, written by code from the item and the class — never by a model."""
    from . import tell
    eid, cls = str(a.get("exam") or ""), str(a.get("class") or "")
    if eid not in home_cards.EXAM_WORKERS or home_cards.EXAM_WORKERS[eid][0] != cls:
        return None
    shown = ", ".join(f"{k}={v}" for k, v in (a.get("inputs") or {}).items() if k not in ("exam", "why")) or "no inputs"
    return (f"starts Lacuna's {cls} worker for exam {eid} — {tell.CLASSES.get(cls, cls)} ({shown}). It runs in the jail, "
            f"on its own branch when it writes code; anything that would merge comes back as its own card for your press.")


def start_job(eid: str, it: dict, who: str) -> dict:
    a = job_args(eid)
    from . import chat
    r = chat.file_petition("spawn-job", None, f"exam {eid}: {it['title']}", who, args={**a, "asked_by": who})
    if r.get("petition"):
        exam_update(eid, petition=r["petition"], said=f"waiting for the owner's yes on the card ({a['class']} worker)")
    return {**r, "exam": eid, "cart": {"name": a["class"], "worker_class": a["class"]}}


def spawn_job(args: dict, who: str) -> dict:
    """The owner said yes: the jail's foreman spawns the worker (the runner starts it inside the jail); the row runs."""
    import subprocess
    eid = str(args.get("exam") or "")
    a = job_args(eid)
    if not a or a["class"] != args.get("class"):
        return {"ok": False, "why": f"exam {eid} has no worker class {args.get('class')}"}
    from . import tell
    lim = tell.limits().get("per_card") or {}
    p = subprocess.run(["python3", str(JAIL_FOREMAN), "spawn", a["class"], f"exam {eid}: {item(eid)['title']}",
                        "--card", f"exam-{eid}", "--inputs", json.dumps(a["inputs"]),
                        "--max-wall", f"{int(lim.get('wall_min', 120))}m", "--retries", "1"],
                       capture_output=True, text=True, timeout=60)
    wid = (p.stdout or "").strip()
    if p.returncode != 0 or not wid.startswith("w-"):
        exam_update(eid, said=f"did not start: {(p.stderr or p.stdout)[-160:]}")
        return {"ok": False, "why": f"the worker did not start: {(p.stderr or p.stdout)[-200:]}"}
    exam_update(eid, state="running", worker=wid, minutes=0, brain_seconds=0, minds=[],
                said=f"{a['class']} worker running since {time.strftime('%H:%M')}")
    return {"ok": True, "worker": wid, "exam": eid, "said": f"{eid}: {a['class']} worker {wid} started"}


def spawn(args: dict, who: str) -> dict:
    """The owner said yes: leases, then the foreman, then the row."""
    eid, name, header = args.get("exam"), str(args.get("cart") or "cart"), args.get("header") or {}
    h = holder(name, eid)
    took, refused = take_leases(header.get("touches") or [], h, f"the cart {name}")
    if refused:
        if eid:
            exam_update(eid, said=f"waits: {refused}")
        return {"ok": False, "waits": refused, "why": f"the cart {name} waits — {refused}"}
    r = _load_cart(name, args, header, who)
    if "hushed" in str(r.get("why")):
        # the foreman is being gentle with a busy box (its manners): the yes stands, and the cart waits for calm with its
        # leases held — it is next in line for those things, not out of the line
        if eid:
            exam_update(eid, said=f"approved; waits for the foreman to be calm ({str(r.get('why'))[:120]})")
        threading.Thread(target=_when_calm, args=(name, args, header, who, eid, took, h), name=f"cart-wait-{name}", daemon=True).start()
        return {"ok": True, "waiting": True, "why": r.get("why")}
    return _granted(_started(r, eid, header, took, h), who, header, args)


def _granted(out: dict, who: str, header: dict, args: dict) -> dict:
    if out.get("ok") and header.get("acts"):            # the owner's press is on this run: its named acts may act (acts.py)
        from . import acts
        acts.grant((out.get("worker") or {}).get("id"), who, header, bool(args.get("dry")))
    return out


def _load_cart(name: str, args: dict, header: dict, who: str) -> dict:
    from . import foreman
    return foreman.call("POST", "/workers", {"name": name, "program": args.get("program") or "", "tier": header.get("tier") or "watch",
                                             "by": who})


def _when_calm(name, args, header, who, eid, took, h, every_s: float = 30, max_s: float = 1800) -> None:
    deadline = time.time() + max_s
    r = {"ok": False, "why": "never tried"}
    while time.time() < deadline:
        time.sleep(every_s)
        r = _load_cart(name, args, header, who)
        if "hushed" not in str(r.get("why")):
            break
    _granted(_started(r, eid, header, took, h), who, header, args)


def _started(r: dict, eid: str | None, header: dict, took: list, h: str) -> dict:
    if not r.get("ok"):
        give_back(took, h)
        if eid:
            exam_update(eid, said=f"did not start: {str(r.get('why'))[:160]}")
        return r
    w = r.get("worker") or {}
    if eid:
        exam_update(eid, state="running", worker=w.get("id"), minutes=0, brain_seconds=0,
                    minds=sorted({m.get("model") for m in (header.get("minds") or {}).values() if m.get("model")}),
                    said=f"running since {time.strftime('%H:%M')}")
    return r


OUTCOME_STATE = {"done": "done", "press": "press", "stopped": "failed"}


def retired(w: dict, data: dict) -> dict:
    """The cart's record came up: artifact, leases back, exam row moved."""
    rec = dict(data.get("record") or {})
    from . import acts as _acts
    _acts.drop(w.get("id"))                                 # no grant outlives its run
    from . import arrivals as _arr                          # the run, into the graph cortex (an episode in its cart)
    _arr.run_ended(str(w.get("name") or (data.get("record") or {}).get("cart") or "?"), str(w.get("id")), dict(data.get("record") or {}))
    from . import artifacts, foreman
    rec["id"] = rec.get("id") or w.get("id")
    rec["brain_seconds"] = round(float(rec.get("brain_seconds") or 0) + foreman.brain_seconds(rec["id"]), 1)
    path = artifacts._jail().leave_record(rec)
    try:                                                    # its reports (the findings) beside it: the artifact keeps none
        reps = (foreman.call("GET", f"/workers/{rec['id']}", None, timeout=10).get("worker") or {}).get("reports") or []
        if reps:
            from pathlib import Path as _P
            side = _P.home() / "lacuna-world" / "tasks" / "reports"
            side.mkdir(parents=True, exist_ok=True)
            (side / f"{rec['id']}.json").write_text(json.dumps(reps[-200:], default=str))
    except Exception:  # noqa: BLE001 — the record stands without them; the review asks the foreman instead
        pass
    eid = eid_of(rec.get("exam")) if rec.get("exam") else None
    give_back(rec.get("touches") or [], holder(str(rec.get("cart")), eid))
    if eid:
        exam_update(eid, state=OUTCOME_STATE.get(rec.get("outcome"), "failed"), worker=rec["id"],
                    minutes=rec.get("minutes") or 0, brain_seconds=rec["brain_seconds"], minds=rec.get("minds") or [],
                    said=str(rec.get("said") or rec.get("reason") or "")[:200])
    return {"ok": True, "artifact": path, "exam": eid}


def declined(args: dict, who: str) -> dict:
    if args.get("exam"):
        exam_update(args["exam"], said=f"the card was declined by {who}", petition=None)
    return {"ok": True, "declined": True}


def stop(x, who: str) -> dict:
    eid = eid_of(x)
    if not eid:
        return {"ok": False, "why": f"there is no exam item {x}"}
    it = item(eid)
    if it["state"] != "running" or not it.get("worker"):
        return {"ok": False, "why": f"{eid} is not running ({it['state']})"}
    if it.get("class") and (home_cards.world() / "jobs" / str(it["worker"])).is_dir():
        # one of the jail's workers, not the foreman's: the jail's foreman stops it (its process group), the row fails
        import subprocess
        p = subprocess.run(["python3", str(JAIL_FOREMAN), "kill", str(it["worker"])], capture_output=True, text=True, timeout=30)
        exam_update(eid, state="failed", said=f"stopped by {who}")
        return {"ok": p.returncode == 0, "exam": eid, "worker": it["worker"]}
    from urllib.parse import quote
    from . import foreman
    r = foreman.call("DELETE", f"/workers/{it['worker']}?by={quote(who)}")
    if r.get("ok") is False and "not answering" in str(r.get("why")):
        return r
    if not r.get("ok"):
        # the foreman no longer has it (a restart lost it): the row must not say running forever
        exam_update(eid, state="failed", said=f"stopped by {who}; the foreman had no living worker {it['worker']}")
    return {"ok": True, "exam": eid, "worker": it["worker"]}


# ── words for the CLI and the chat ──────────────────────────────────────────────────────────────────────────────────
def status_lines() -> list[str]:
    e = home_cards.exam()
    head = (f"{e['press']} of 10 at your press · {e['done']} done · {e['running']} running · {e['failed']} failed · "
            f"{e['minutes']} min · {e['brain_seconds']} brain-seconds")
    rows = [f"{i['id']:<4} {i['state']:<8} {i['cart']:<22} {i['minutes']:>6} min  {i['brain_seconds']:>5} bs  "
            f"{', '.join(i['minds']) or '—':<16} {i['said']}" for i in e["items"]]
    return [head, *rows]


def exam_tool(a: dict, who: str) -> str:
    """The chat's tool: 'start exam item 10', 'how is the exam going', 'stop E10'."""
    op = str(a.get("op") or "status").lower()
    if op == "start":
        r = start(a.get("item"), who)
        if r.get("petition"):
            return f"{r['exam']} is on a permission card for the owner ({r['petition']}); it runs the cart {r['cart'].get('name')} when they say yes"
        return "not started — " + (" | ".join(r.get("fix_first") or []) or str(r.get("why")))
    if op == "stop":
        r = stop(a.get("item"), who)
        return f"stopping {r['exam']} (worker {r['worker']}); its artifact will say stopped by {who}" if r.get("ok") else str(r.get("why"))
    return "\n".join(status_lines())
