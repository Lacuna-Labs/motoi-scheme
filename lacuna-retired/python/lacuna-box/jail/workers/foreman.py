#!/usr/bin/env python3
"""THE FOREMAN — Lacuna's workers as supervised jobs (LACUNA-1.3-DESIGN §1; the Big Forge Plan, Part III).

A worker is an errand the runner already supervises — it survives reboots, resumes when interrupted, retries with
backoff and is marked failed when it keeps failing — plus three things the runner did not have: a CLASS (what kind of
work), a BRIEF in its mailbox (what to do, in JSON or slat), and a REPORT at the end (what it did, touched, left
behind, how sure, what's next — the taxonomy report), filed into the cortex so the next pick can learn from it.

    foreman spawn <class> "<words>" [--card NAME] [--inputs JSON] [--max-wall 15m] [--retries 3] [--seat SEAT]
    foreman list [--all]          every worker: id · class · state · minutes · the last line
    foreman show <id>             the brief, the state, the report
    foreman kill <id>             stop it (the runner treats it like any other exit)

The six states (state.json, written by run.py and read back here): spawned → briefed → executing → reporting →
retired; crashed → (the runner's retry) → spawned, or → grave when the runner gives up (its retries spent).
Workers live at ~/lacuna-world/jobs/w-<class>-<stamp>/ beside the other errands; the runner starts them INSIDE the
jail. Standard library only.
"""
from __future__ import annotations

import argparse
import datetime as dt
import json
import os
import signal
import sys
import time

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import protocol  # noqa: E402

HOME = os.path.expanduser("~")
JOBS = os.environ.get("LACUNA_JOBS", f"{HOME}/lacuna-world/jobs")
HERE = os.path.dirname(os.path.abspath(__file__))
CLASSES = ("repair", "fetch", "review", "gate", "image", "devbox", "codemap", "docs", "think", "echo",
           "disk-steward", "testfix", "recall-check")


def stamp() -> str:
    return dt.datetime.now().strftime("%m%d-%H%M%S")


def wdir(wid: str) -> str:
    return os.path.join(JOBS, wid)


def read(path: str, default):
    try:
        with open(path) as f:
            return json.load(f)
    except (OSError, ValueError):
        return default


def write(path: str, obj) -> None:
    tmp = path + ".tmp"
    with open(tmp, "w") as f:
        json.dump(obj, f, indent=2, ensure_ascii=False)
    os.replace(tmp, path)


def set_state(wid: str, state: str, **extra) -> dict:
    st = read(f"{wdir(wid)}/state.json", {"history": []})
    st["state"] = state
    st["at"] = time.time()
    st.update(extra)
    st.setdefault("history", []).append({"state": state, "at": st["at"]})
    write(f"{wdir(wid)}/state.json", st)
    return st


def spawn(cls: str, words: str, *, card: str | None = None, inputs: dict | None = None, max_wall: str = "15m",
          retries: int = 3, seat: str | None = None, constraints: dict | None = None) -> str:
    if cls not in CLASSES:
        raise SystemExit(f"no worker class {cls!r} — the classes are {', '.join(CLASSES)}")
    wid = f"w-{cls}-{stamp()}"
    if os.path.exists(os.path.join(JOBS, wid)):        # two spawns in one second (2026-10-18): a suffix, never a crash
        wid = f"{wid}-{os.urandom(2).hex()}"
    d = wdir(wid)
    os.makedirs(d, exist_ok=False)
    msg = protocol.brief(f"b-{wid[2:]}", wid, cls, words, card=card, inputs=inputs,
                         constraints={**({"seat": seat} if seat else {}), **(constraints or {})})
    with open(f"{d}/mailbox.jsonl", "a") as f:
        f.write(json.dumps(msg, ensure_ascii=False) + "\n")
    job = {
        "name": wid, "kind": "work", "goal": f"worker {cls}: {words}", "worker": cls,
        "run": f"python3 {HERE}/run.py {wid}", "every": None, "at": None, "checkin": "30m",
        "max_run": max_wall, "retries": retries, "tell_when_done": False, "heartbeat_timeout": max_wall,
        "expires": "7d", "deadline": None, "state": "on", "created": dt.datetime.now().isoformat(timespec="minutes"),
        **({"card": card} if card else {}),
    }
    write(f"{d}/job.json", job)
    set_state(wid, "spawned", cls=cls)
    return wid


def workers(include_done: bool = False) -> list[dict]:
    out = []
    for name in sorted(os.listdir(JOBS)) if os.path.isdir(JOBS) else []:
        if not name.startswith("w-"):
            continue
        job = read(f"{wdir(name)}/job.json", {})
        st = read(f"{wdir(name)}/state.json", {})
        state = st.get("state") or "spawned"
        if job.get("state") == "failed" and state not in ("retired",):
            state = "grave"
        if not include_done and state in ("retired", "grave") and time.time() - (st.get("at") or 0) > 6 * 3600:
            continue
        rep = read(f"{wdir(name)}/report.json", {})
        first = (st.get("history") or [{}])[0].get("at") or st.get("at") or time.time()
        out.append({"id": name, "class": job.get("worker"), "state": state, "card": job.get("card"),
                    "minutes": round(((st.get("at") or time.time()) - first) / 60, 1),
                    "line": rep.get("said") or st.get("note") or job.get("goal", "")[:120]})
    return out


def kill(wid: str) -> str:
    rs = read(f"{wdir(wid)}/.runner.json", {})
    pid = rs.get("pid")
    if pid:
        try:
            os.killpg(pid, signal.SIGTERM)
        except OSError:
            try:
                os.kill(pid, signal.SIGTERM)
            except OSError:
                pass
    set_state(wid, "crashed", note="stopped by request")
    return f"{wid}: stopped"


def main(argv: list[str]) -> int:
    ap = argparse.ArgumentParser(prog="foreman", description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = ap.add_subparsers(dest="verb", required=True)
    s = sub.add_parser("spawn")
    s.add_argument("cls")
    s.add_argument("words")
    s.add_argument("--card")
    s.add_argument("--inputs")
    s.add_argument("--max-wall", default="15m")
    s.add_argument("--retries", type=int, default=3)
    s.add_argument("--seat")
    ls = sub.add_parser("list")
    ls.add_argument("--all", action="store_true")
    sh = sub.add_parser("show")
    sh.add_argument("id")
    k = sub.add_parser("kill")
    k.add_argument("id")
    a = ap.parse_args(argv)
    if a.verb == "spawn":
        print(spawn(a.cls, a.words, card=a.card, inputs=json.loads(a.inputs) if a.inputs else None,
                    max_wall=a.max_wall, retries=a.retries, seat=a.seat))
    elif a.verb == "list":
        rows = workers(a.all)
        if not rows:
            print("no workers")
        for r in rows:
            print(f"{r['id']:<28} {r['class'] or '?':<8} {r['state']:<10} {r['minutes']:>6} min  {r['line'][:90]}")
    elif a.verb == "show":
        d = wdir(a.id)
        print(json.dumps({"brief": [json.loads(l) for l in open(f"{d}/mailbox.jsonl")] if os.path.exists(f"{d}/mailbox.jsonl") else [],
                          "state": read(f"{d}/state.json", {}), "report": read(f"{d}/report.json", None)}, indent=2, ensure_ascii=False))
    elif a.verb == "kill":
        print(kill(a.id))
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
