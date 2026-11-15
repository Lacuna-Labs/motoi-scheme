#!/usr/bin/env python3
"""RUN ARTIFACTS — every run leaves a slat record of what it did (LACUNA-1.3-DESIGN §37.3, B47).

    ~/lacuna-world/artifacts/<cart-or-class>/<run-id>.slat    one run: asked, steps, made, minds, outcome
    ~/lacuna-world/artifacts/INDEX.slat                       one line per cart: its latest run

The 26B reads INDEX first, then the artifact it needs, so it knows what happened while it was away without anyone
telling it. Steps are not reported by hand: one adapter at the end of a run (and on a crash) reads what the worker
already wrote — run.log's progress lines, state.json, report.json — so no class has to learn a new call.

An artifact is line-oriented slat (one form per line, the slat-line grammar), written with protocol.py's own
serializer and read back with its reader. Writes are atomic (temp + rename) and the index is updated under a file
lock, so two runs finishing at once both land. Standard library only, Python 3.9 (it runs inside the jail).

    python3 artifact.py leave <worker-id>     write one run's artifact (run.py calls leave() itself)
    python3 artifact.py backfill              every finished worker under jobs/ that has no artifact yet
"""
from __future__ import annotations

import fcntl
import json
import os
import re
import sys
import time

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import protocol  # noqa: E402

HOME = os.path.expanduser("~")
FINISHED = ("retired", "crashed", "grave")
_CTRL = re.compile(r"[\x00-\x1f\x7f]+")
_STOPPED = re.compile(r"\bno answer\b|\bfailed\b|\bcould not\b|\brefused\b|\btimed out\b|\bovertime\b|\bvetoed\b", re.I)
_SKIPPED = re.compile(r"\bskip|\balready\b", re.I)
_MIND = re.compile(r"asking the (\w[\w-]*) \(([^)]+)\)")


def root() -> str:
    # read at call time, so a test (or the API) can point it elsewhere
    return os.environ.get("LACUNA_ARTIFACTS", f"{HOME}/lacuna-world/artifacts")


def jobs() -> str:
    return os.environ.get("LACUNA_JOBS", f"{HOME}/lacuna-world/jobs")


def line(words, n: int = 240) -> str:
    """One line, no control characters: the slat-line grammar allows only \\n-style escapes, and a step is one line."""
    return _CTRL.sub(" ", str(words or "")).strip()[:n]


def safe(name: str) -> str:
    return re.sub(r"[^A-Za-z0-9_.-]+", "-", str(name or "unknown")).strip(".-")[:80] or "unknown"


def form(kind: str, fields: dict) -> str:
    """One slat line `(kind :k v …)`, through protocol.py's serializer (its kinds are the protocol's; these are records)."""
    return f"({kind}" + "".join(f" :{k.replace('_', '-')} {protocol._s(v)}" for k, v in fields.items()) + ")"


def _read(path: str, default):
    try:
        with open(path) as f:
            return json.load(f)
    except (OSError, ValueError):
        return default


def _write(path: str, text: str) -> None:
    os.makedirs(os.path.dirname(path), exist_ok=True)
    tmp = f"{path}.{os.getpid()}.tmp"
    with open(tmp, "w") as f:
        f.write(text)
    os.replace(tmp, path)


# ── what a run did, read from what it already wrote ─────────────────────────────────────────────────────────────

def steps_from_log(text: str, outcome: str) -> list[dict]:
    """run.log's progress lines ("HH:MM:SS words") are the steps. A line saying it got no answer or failed is a step
    that stopped; "already"/"skip" is skipped; the last step of a run that stopped carries the stop."""
    out = []
    for ln in (text or "").splitlines():
        m = re.match(r"^(\d\d:\d\d:\d\d) (.+)$", ln)
        if not m:
            continue
        words = m.group(2)
        head, _, rest = words.partition(":") if ":" in words[:60] else ("", "", "")
        name = head.strip() if head else " ".join(words.split()[:3])
        status = "stopped" if _STOPPED.search(words) else "skipped" if _SKIPPED.search(words) else "done"
        out.append({"name": line(name, 60), "status": status, "why": line(rest.strip() or words), "at": m.group(1)})
    if out and outcome == "stopped" and out[-1]["status"] == "done":
        out[-1]["status"] = "stopped"
    return out


def minds_from(log: str, usage: dict) -> list[str]:
    found = []
    for _, model in _MIND.findall(log or ""):
        if model not in found:
            found.append(model)
    seat = (usage or {}).get("seat")
    if not found and seat:
        found.append(f"seat:{seat}")
    return found


def outcome_of(rep: dict | None, state: dict, job: dict) -> tuple[str, str]:
    """done · press (waiting on the owner) · stopped, and the reason in a line."""
    if rep:
        nxt = str(((rep.get("handoff") or {}).get("next")) or "")
        if rep.get("ok"):
            if "press" in nxt or "owner" in nxt:
                return "press", line(f"waiting on the owner: {nxt}")
            return "done", line(rep.get("said") or "done")
        return "stopped", line(rep.get("said") or "the class said no")
    st = state.get("state") or "spawned"
    if job.get("state") == "failed" and st != "retired":
        return "stopped", line(f"grave: its retries spent — {state.get('note') or 'no word'}")
    return "stopped", line(state.get("note") or f"ended {st} with no report")


def made_of(rep: dict | None) -> dict:
    rep = rep or {}
    branches = [rep["branch"]] if rep.get("branch") else []
    files = [o["path"] for o in rep.get("outputs") or [] if isinstance(o, dict) and o.get("path")]
    files += [t for t in rep.get("touched") or [] if t not in files]
    petitions = list(rep.get("petitions") or [])
    if rep.get("class") == "review" and rep.get("ok") and rep.get("task"):
        petitions.append(f"merge {rep['task']}")       # review's yes IS a merge card on the desk (review.py)
    bugs = list(rep.get("bugs") or [])
    return {"branches": branches, "petitions": petitions, "bugs": bugs, "files": files[:40]}


def record(wid: str, usage: dict | None = None, crash: str | None = None) -> dict | None:
    """Everything one run's artifact says, from its folder. None while it is still running (nothing to record)."""
    d = os.path.join(jobs(), wid)
    if not os.path.isdir(d):
        return None
    job = _read(f"{d}/job.json", {})
    state = _read(f"{d}/state.json", {})
    rep = _read(f"{d}/report.json", None)
    if crash:
        state = {**state, "state": "crashed", "note": crash}
    if not rep and (state.get("state") not in FINISHED) and job.get("state") != "failed":
        return None
    brief, asked = {}, ""
    try:
        with open(f"{d}/mailbox.jsonl") as f:
            first = next((l for l in f if l.strip()), "")
        brief = protocol.parse(first) if first else {}
        asked = (brief.get("job") or {}).get("brief") or ""
    except (OSError, protocol.ProtocolError, StopIteration):
        asked = job.get("goal", "")
    try:
        with open(f"{d}/run.log", errors="replace") as f:
            log = f.read()[-200_000:]
    except OSError:
        log = ""
    usage = usage or (rep or {}).get("usage") or {}
    hist = state.get("history") or []
    started = (hist[0].get("at") if hist else None) or state.get("at") or os.path.getmtime(d)
    ended = state.get("at") or time.time()
    outcome, reason = outcome_of(rep, state, job)
    cls = (brief.get("job") or {}).get("class") or job.get("worker") or wid.split("-")[1]
    inputs = (brief.get("job") or {}).get("inputs") or {}
    cart = safe(inputs.get("cart") or brief.get("card") or job.get("card") or cls)
    minutes = (rep or {}).get("minutes")
    return {
        "id": wid, "cart": cart, "class": cls, "asked": line(asked, 400),
        "started": time.strftime("%Y-%m-%dT%H:%M:%S", time.localtime(started)),
        "ended": time.strftime("%Y-%m-%dT%H:%M:%S", time.localtime(ended)),
        "steps": steps_from_log(log, outcome), "made": made_of(rep),
        "minds": minds_from(log, usage), "seat": usage.get("seat"),
        "minutes": round(float(minutes if isinstance(minutes, (int, float)) else (ended - started) / 60), 2),
        "brain_seconds": round(float(usage.get("brain_seconds") or 0), 1),
        "outcome": outcome, "reason": reason, "said": line((rep or {}).get("said") or reason, 200),
    }


# ── writing it down ────────────────────────────────────────────────────────────────────────────────────────────

def dumps(r: dict) -> str:
    lines = [form("run", {"id": r["id"], "cart": r["cart"], "class": r["class"], "asked": r["asked"],
                          "started": r["started"], "ended": r["ended"]})]
    lines += [form("step", {"name": s["name"], "status": s["status"], "why": s["why"], "at": s["at"]}) for s in r["steps"]]
    lines.append(form("made", r["made"]))
    lines.append(form("minds", {"used": r["minds"], "seat": r["seat"], "minutes": r["minutes"],
                                "brain_seconds": r["brain_seconds"]}))
    lines.append(form("outcome", {"is": r["outcome"], "reason": r["reason"]}))
    return "\n".join(lines) + "\n"


def parse_lines(text: str) -> list[dict]:
    """Each line one form, read by protocol.py's reader; a line that does not read is skipped, never fatal."""
    out = []
    for ln in (text or "").splitlines():
        if ln.strip().startswith("("):
            try:
                out.append(protocol.parse_slat(ln))
            except protocol.ProtocolError:
                continue
    return out


def index_path() -> str:
    return os.path.join(root(), "INDEX.slat")


def update_index(r: dict) -> None:
    """INDEX.slat keeps the newest run per cart. Under an exclusive lock: two runs finishing at once both land, and
    an older run backfilled later never replaces a newer one."""
    os.makedirs(root(), exist_ok=True)
    with open(os.path.join(root(), ".index.lock"), "a+") as lk:
        fcntl.flock(lk, fcntl.LOCK_EX)
        try:
            rows = {}
            try:
                with open(index_path()) as f:
                    rows = {x.get("cart"): x for x in parse_lines(f.read()) if x.get("cart")}
            except OSError:
                pass
            old = rows.get(r["cart"])
            if old and str(old.get("when") or "") > r["ended"]:
                return
            rows[r["cart"]] = {"kind": "latest", "cart": r["cart"], "id": r["id"], "outcome": r["outcome"],
                               "when": r["ended"], "said": r["said"]}
            text = "".join(form("latest", {k: v for k, v in x.items() if k != "kind"}) + "\n"
                           for _, x in sorted(rows.items()))
            _write(index_path(), text)
        finally:
            fcntl.flock(lk, fcntl.LOCK_UN)


def leave(wid: str, usage: dict | None = None, crash: str | None = None) -> str | None:
    """Write one run's artifact and its index line. Returns the path, or None if the run has not finished."""
    r = record(wid, usage=usage, crash=crash)
    if r is None:
        return None
    path = os.path.join(root(), r["cart"], f"{safe(wid)}.slat")
    _write(path, dumps(r))
    update_index(r)
    return path


def leave_record(r: dict) -> str:
    """A run that did not live under jobs/ — a Lacuna cart in the foreman (§37.2) — hands in its record whole: the same
    artifact format, the same index. Every field is made one line here, whatever the sender wrote."""
    made = r.get("made") or {}
    rec = {"id": safe(r.get("id")), "cart": safe(r.get("cart") or r.get("class")), "class": line(r.get("class") or "cart", 60),
           "asked": line(r.get("asked"), 400), "started": line(r.get("started"), 25), "ended": line(r.get("ended"), 25),
           "steps": [{"name": line(s.get("name"), 60), "status": s.get("status") if s.get("status") in ("done", "skipped", "stopped") else "done",
                      "why": line(s.get("why")), "at": line(s.get("at"), 12)} for s in (r.get("steps") or []) if isinstance(s, dict)],
           "made": {k: [line(x, 200) for x in (made.get(k) or [])][:40] for k in ("branches", "petitions", "bugs", "files")},
           "minds": [line(m, 60) for m in (r.get("minds") or [])], "seat": r.get("seat"),
           "minutes": round(float(r.get("minutes") or 0), 2), "brain_seconds": round(float(r.get("brain_seconds") or 0), 1),
           "outcome": r.get("outcome") if r.get("outcome") in ("done", "press", "stopped") else "stopped",
           "reason": line(r.get("reason")), "said": line(r.get("said") or r.get("reason"), 200)}
    path = os.path.join(root(), rec["cart"], f"{rec['id']}.slat")
    _write(path, dumps(rec))
    update_index(rec)
    return path


def backfill() -> list[str]:
    done = []
    for name in sorted(os.listdir(jobs())) if os.path.isdir(jobs()) else []:
        if not name.startswith("w-"):
            continue
        r = record(name)
        if r is None or os.path.exists(os.path.join(root(), r["cart"], f"{safe(name)}.slat")):
            continue
        p = leave(name)
        if p:
            done.append(p)
    return done


# ── reading it back (the API's control/artifacts.py loads this module, so there is one reader) ───────────────────

def index() -> list[dict]:
    try:
        with open(index_path()) as f:
            return parse_lines(f.read())
    except OSError:
        return []


def find(run_id: str) -> str | None:
    rid = safe(run_id)
    base = root()
    for cart in sorted(os.listdir(base)) if os.path.isdir(base) else []:
        p = os.path.join(base, cart, f"{rid}.slat")
        if os.path.isfile(p):
            return p
    return None


def read(run_id: str) -> dict | None:
    p = find(run_id)
    if not p:
        return None
    with open(p) as f:
        text = f.read()
    forms = parse_lines(text)
    out: dict = {"path": p, "text": text, "steps": []}
    for x in forms:
        k = x.pop("kind", None)
        if k == "step":
            out["steps"].append(x)
        elif k in ("run", "made", "minds", "outcome"):
            out[k] = x
    return out


def main(argv: list) -> int:
    if argv[:1] == ["leave"] and len(argv) == 2:
        print(leave(argv[1]) or "not finished — no artifact yet")
    elif argv[:1] == ["backfill"]:
        for p in backfill():
            print(p)
    else:
        print(__doc__)
        return 2
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
