"""THE WAKE MANAGER — a finished job is a chip on the floor and the desk, with the facts; never a turn in the owner's conversation.

Owns: the diff of the working feed (what finished), each event's facts from its record, the event's chip (a desk alert: the inbox, the
floor's `alert.raise`, the telemetry card), and `GET /api/wake`. Refuses: a turn of any kind for a finished thing (order §1.13a,
2026-11-06: 15 `[foreman:press]` system turns about finished workers reached ~/.lacuna/conversation.jsonl, each answered "already retired"
or "Nothing needs me" — law 14, the two lanes: the floor's events are the floor's, the owner's talk is his); an eval run's event (law 8).
Implements: the owner's 2026-10-20 chip ("it should be a chip from over on my corner I can open, read, and do stuff with").
Invariants: an event is chipped once (the same ref with the same outcome is one event). Faults: none; a source that will not answer is said.

THE RULES THAT KEEP IT HONEST
  · Nothing is put into a turn, running or not. An event is chipped when it is noticed; it waits in a queue (kept on disk) for DEBOUNCE_S so a
    second notice of the same thing is one event, then settles: it leaves the queue with one audit row (`wake.floor`).
  · The chip is facts the box read — what ended, how it ended, how long it ran, the tail of its output — never what the result "means".
  · The owner's press on a card and a landed plan are chips too (chat._after_press, plans._land): nothing gives Lacuna a turn.

WHAT FINISHES: a worker that left the foreman, a job (core.jobs), an errand (jobs/<name>), a queue item or task (workqueue, task_runner) —
found by diffing what agents_live.working() lists, every SCAN_S. A watcher between two ticks is alive, not finished.

  post(kind, ref, title, outcome, detail)   add one event and chip it (also used by code that knows a job just ended)
  scan()                                    diff the working feed → events
  pending() · settle() · start()
"""
from __future__ import annotations

import json
import os
import re
import threading
import time
from pathlib import Path

from fastapi import APIRouter

from .core import LACUNA_HOME, audit

router = APIRouter()

SCAN_S = 4.0
DEBOUNCE_S = 4.0
TAIL_LINES, TAIL_CHARS = 6, 500
FILE = LACUNA_HOME / "wake-pending.json"
# the foreman's runs ledger: a retired worker's own end (the done-check's outcome and why) is read here, never its state's word
RUNS_LEDGER = Path(os.environ.get("LACUNA_RUNS_LEDGER") or Path.home() / "lacuna-world" / "foreman" / "ledger" / "runs.slat")
COUNTED = ("worker", "job", "errand", "task")        # kinds that end; chat and brain slots do not

_lock = threading.Lock()
_pending: list[dict] = []
_known: dict[str, dict] = {}
_started = False
_loaded = False


def _save() -> None:
    try:
        FILE.write_text(json.dumps(_pending))
    except OSError:
        pass


def _load() -> None:
    global _loaded
    if _loaded:
        return
    _loaded = True
    try:
        _pending.extend(json.loads(FILE.read_text()))
    except (OSError, ValueError):
        pass


def pending() -> list[dict]:
    with _lock:
        _load()
        return list(_pending)


def post(kind: str, ref: str, title: str, outcome: str, detail: str = "", ran_s: float | None = None) -> bool:
    """One thing finished. The same ref with the same outcome is one event, however many places notice it."""
    by = _owner_did(ref)
    if by:                                      # THE OWNER STOPPED IT (2026-10-20: "if i stop the agent it should know it was me")
        outcome = f"{outcome} — the owner {by} it himself; do not restart or repair it unless he asks"
    with _lock:
        _load()
        if any(e["ref"] == ref and e["outcome"] == outcome for e in _pending):
            return False
        _pending.append({"t": time.time(), "kind": kind, "ref": ref, "title": str(title)[:120], "outcome": outcome, "detail": str(detail)[:TAIL_CHARS], "ran_s": ran_s})
        _save()
    audit("lacuna", "wake.event", kind=kind, ref=ref, outcome=outcome)
    _chip(kind, ref, title, outcome, detail, ran_s)
    return True


def _owner_did(ref: str) -> str:
    """'stopped' / 'cancelled the job' / 'paused' when a person did that to `ref` in the last 15 minutes, else ''."""
    try:
        from . import agent_talk
        key = str(ref).split(":")[-1]
        for r in reversed(agent_talk.recent(30)):
            line = str(r.get("line") or "")
            if time.time() - r.get("t", 0) < 900 and key and key in line and not line.startswith("lacuna"):
                return next((w for w in ("cancelled the job", "stopped", "paused") if w in line), "stopped")
    except Exception:  # noqa: BLE001
        pass
    return ""


def ended_word(outcome: str) -> str:
    """The one word for how a thing ended, from its record (video B9, 2026-10-31: a job the owner paused read "finished · paused after
    4.8 h"): failed, paused, stopped, finished only when the record says it passed or exited 0, and "ended" when the record does not say."""
    o = str(outcome or "")
    if re.search(r"fail|crash|error|killed|exit [1-9]|timed? ?out|lost", o, re.I):
        return "failed"
    if re.search(r"\bpaus|\bparked\b|\bon hold\b", o, re.I):
        return "paused"
    if re.search(r"stopp|cancel", o, re.I):
        return "stopped"
    if re.search(r"\bpass|\bdone|\bfinished|exit 0|sealed", o, re.I):
        return "finished"
    return "ended"


def _chip(kind: str, ref: str, title: str, outcome: str, detail: str, ran_s) -> None:
    """THE OWNER SEES IT AS A CHIP, NOT AS WORDS IN HIS CHAT (2026-10-20: "I don't like the new messages from the system … it looks like what I
    said. It should be a chip from over on my corner I can open, read, and do stuff with. Like go to the training"). Every event is a desk
    alert: green when it ended well, red when it failed. The desk's arrival chip shows it mid-screen and folds it into the inbox, where it
    opens to the facts with "open" (the forge's runs, the worker, the queue) and "ack". No phone ping: the desk is the channel."""
    try:
        from .workers import raise_alert
        name = str(title or ref)
        where = "forge" if re.match(r"(errand:)?(forge|pantheon)", ref) else "work" if ref.startswith(("work:", "task:")) else "job"
        bad = bool(re.search(r"fail|crash|error|stopp|killed|exit [1-9]|timed? ?out|lost", str(outcome), re.I))
        ran = f" after {_dur(ran_s)}" if ran_s else ""
        raise_alert(f"{where}:{ref}", "error" if bad else "done", f"{name} {ended_word(outcome)}{ran}",
                    f"{kind} {name} — {outcome}{ran}." + (f" Its output ends: {detail}" if detail else ""), notify=False)
    except Exception:  # noqa: BLE001 — the desk did not take the chip; the wake.event audit row keeps the event
        pass


# ── what finished, and how ───────────────────────────────────────────────────────────────────────────────────────────
def _tail(text: str) -> str:
    lines = [ln.rstrip() for ln in str(text or "").splitlines() if ln.strip()][-TAIL_LINES:]
    return " | ".join(lines)[-TAIL_CHARS:]


def _read_tail(p: Path) -> str:
    try:
        return _tail(p.read_text(errors="replace"))
    except OSError:
        return ""


def _facts(ref: str, item: dict) -> tuple[str, str, str]:
    """(title, outcome, detail) from the source of record for this ref — never from what a model said about it."""
    kind = item.get("kind")
    try:
        if kind == "errand":
            name = re.sub(r"[^A-Za-z0-9._-]", "", ref.split(":", 1)[1])
            d = Path.home() / "lacuna-world" / "jobs" / name
            tail = _read_tail(d / "run.log") or _read_tail(d / "notes.md")
            out = "ended"
            if name.startswith("forge"):
                try:
                    from . import chat
                    tail = (str(chat.call_tool("forge", {"op": "status"}, "lacuna")).splitlines() or [""])[0][:300] + " | " + tail
                except Exception:  # noqa: BLE001
                    pass
            return name, out, tail
        if kind == "job":
            from . import core
            j = core.job(ref)
            if j:
                return j.title, ("done (exit 0)" if j.code == 0 else f"failed (exit {j.code})" if j.code is not None else "ended"), _tail(core.job_tail(ref, 12))
        if kind == "task" and ref.split(":", 1)[0] in ("work", "task"):
            from . import workqueue
            iid = ref.split(":", 1)[1]
            it = next((i for i in workqueue.load()["items"] if i.get("id") == iid), None)
            if it:
                return f"{iid} {it.get('title')}", str(it.get("state")), _tail(str(it.get("review") or it.get("note") or it.get("result") or ""))
        if kind == "worker":
            from . import foreman
            w = next((x for x in (foreman.workers().get("workers") or []) if x.get("id") == ref), {})
            last = (w.get("reports") or [None])[-1]
            # the run's own end, not the worker's state: "retired" read as a green "finished" for a run its done-check failed
            # (wave 1's integration re-run, 2026-11-01: w-8895fe failed, and the desk said "finished after 38s")
            end = run_end(ref)
            outcome = f"{end['outcome']}: {end.get('why') or ''}".rstrip(": ") if end.get("outcome") else str(w.get("state") or "gone")
            return str(w.get("name") or end.get("run") or ref), outcome[:300], _tail(json.dumps(last.get("data"), default=str) if isinstance(last, dict) else "")
    except Exception as e:  # noqa: BLE001 — a source that will not answer is said, not guessed
        return str(item.get("what") or ref), "ended", f"(its record could not be read: {e.__class__.__name__})"
    return str(item.get("what") or ref), "ended", ""


def run_end(wid: str) -> dict:
    """A run's row in the foreman's ledger (its outcome, its why, its run key), read by the one reader from the ledger's last 256 KB;
    {} when no row names it. The line is found by its id, then read as a form: the id must be the row's own, never a match in text."""
    from .slatwire import loads_body, read
    try:
        with open(RUNS_LEDGER, "rb") as fh:
            fh.seek(0, 2)
            fh.seek(max(0, fh.tell() - 262144))
            lines = fh.read().decode("utf-8", "replace").splitlines()
    except OSError:
        return {}
    for line in reversed(lines):
        if wid not in line:
            continue
        try:
            f = read(line)
            row = loads_body(f[1]) if isinstance(f, list) and len(f) == 2 and f[0] == "run" else None
        except ValueError:
            continue
        if isinstance(row, dict) and row.get("id") == wid:
            return row
    return {}


ROUTINE = re.compile(r"ipad-verify|-watch$|^watch-|heartbeat|continuity|ci-guard|sentinel|repo-drift|mem-watch|forge-steward", re.I)
BAD = re.compile(r"fail|crash|error|stopp|killed|exit [1-9]|timed? ?out|lost", re.I)


def worth(item: dict, outcome: str, ran_s: float | None) -> bool:
    """WHAT IS WORTH A CHIP (the first live wake, 2026-10-20 10:04, was a four-second routine verifier, and she invented work for it): a failure
    always; a routine watcher or verifier never when it ended well; anything that ran under 15 s and ended well never; the rest — a forge
    run, a queue item, a job someone asked for — yes. An eval run never wakes anyone, failed or not (P4, 2026-10-25: 135 eval-soak
    notices in the owner's thread, each answered "Nothing needs me"); the eval's own runner reads its results."""
    if ":eval:" in " ".join(str(item.get(k) or "") for k in ("id", "name", "what")):
        return False
    if BAD.search(str(outcome)):
        return True
    if ROUTINE.search(str(item.get("what") or "")) or ROUTINE.search(str(item.get("id") or "")):
        return False
    return not (ran_s is not None and ran_s < 15)


def scan() -> int:
    """Diff the working feed against the last scan: what left every list (working · watching · stalled) has finished."""
    try:
        from . import agents_live
        w = agents_live.working()
    except Exception:  # noqa: BLE001
        return 0
    alive = {x["id"] for k in ("working", "watching", "stalled") for x in (w.get(k) or [])}
    running = {x["id"]: x for x in (w.get("working") or []) if x.get("kind") in COUNTED}
    n = 0
    first = not _known and not getattr(scan, "_ran", False)
    scan._ran = True
    if not first:
        for ref, item in list(_known.items()):
            if ref in alive:
                continue
            title, outcome, detail = _facts(ref, item)
            ran = (time.time() - float(item["since"])) if item.get("since") else None
            # an eval run never reaches the owner's desk, whichever record names it (law 8; a work order's run says so in its key)
            if not worth(item, outcome, ran) or ":eval:" in str(title):
                continue
            n += int(post(item.get("kind") or "task", ref, title, outcome, detail, ran))
    _known.clear()
    _known.update(running)
    return n


# ── the chip settles ─────────────────────────────────────────────────────────────────────────────────────────────────────
def _dur(s) -> str:
    if not s:
        return ""
    s = int(s)
    return f"{s}s" if s < 90 else f"{round(s / 60)} min" if s < 5400 else f"{s / 3600:.1f} h"


def settle() -> int:
    """The events past DEBOUNCE_S leave the queue: each was chipped when it was noticed (the desk's inbox, the floor's alert, the telemetry
    card), so settling is one audit row and never a turn. Returns how many settled."""
    with _lock:
        _load()
        now = time.time()
        done = [e for e in _pending if now - e["t"] >= DEBOUNCE_S]
        if not done:
            return 0
        _pending[:] = [e for e in _pending if now - e["t"] < DEBOUNCE_S]
        _save()
    audit("lacuna", "wake.floor", n=len(done), refs=[e["ref"] for e in done])
    return len(done)


def _loop() -> None:
    last = 0.0
    while True:
        time.sleep(1.0)
        try:
            if time.time() - last >= SCAN_S:
                last = time.time()
                scan()
            settle()
        except Exception as e:  # noqa: BLE001 — the manager never dies on one bad pass
            audit("lacuna", "wake.error", error=f"{e.__class__.__name__}: {e}"[:200])


def start() -> None:
    global _started
    if _started or os.environ.get("LACUNA_NO_WORKERS") == "1" or LACUNA_HOME != Path.home() / ".lacuna":
        return                                      # never from a test home: a second thread importing beside a reload deadlocks the import lock
    _started = True
    threading.Thread(target=_loop, name="lacuna-wake", daemon=True).start()


@router.get("/api/wake")
def r_wake() -> dict:
    """What waits to settle and what the manager is watching (for the desk and the playbook); a finished thing is a chip, never a turn."""
    return {"pending": pending(), "watching": sorted(_known), "running": _started,
            "road": "a finished thing is a chip on the desk and the floor; it never takes a turn"}
