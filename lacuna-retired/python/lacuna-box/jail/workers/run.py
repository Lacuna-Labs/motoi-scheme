#!/usr/bin/env python3
"""run.py <worker-id> — one worker's life, started by the runner inside the jail (LACUNA-1.3-DESIGN §1).

briefed (the mailbox read) → executing (the class's `run(w)`) → reporting (the taxonomy report written, filed in the
cortex) → retired. An exception is `crashed`: the runner retries the job (its own backoff) and gives up after its
retries — the foreman then reads it as `grave`. Exit 75 when the class says the GPU is someone else's (the runner's
"not now"). Usage (brain-minutes, tokens, pages, Claude calls) is added up as the class works and written beside the
report and into ~/.lacuna/usage.jsonl, the ledger `lacuna usage` reads.
"""
from __future__ import annotations

import importlib
import json
import os
import subprocess
import sys
import time
import traceback

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import artifact  # noqa: E402
import foreman  # noqa: E402
import protocol  # noqa: E402
from errors import NotNow  # noqa: E402

HOME = os.path.expanduser("~")
TOOLS = f"{HOME}/lacuna-world/tools"
USAGE = os.environ.get("LACUNA_USAGE", f"{HOME}/lacuna-world/ledger/usage.jsonl")   # inside its world: the jail writes nowhere else
TEMPFAIL = 75


class Worker:
    """What a class sees: its brief, a folder, a way to say progress, and the usage it spends."""

    def __init__(self, wid: str):
        self.id = wid
        self.dir = foreman.wdir(wid)
        lines = [l for l in open(f"{self.dir}/mailbox.jsonl") if l.strip()]
        self.brief = protocol.parse(lines[-1])
        self.job = self.brief["job"]
        self.inputs = self.job.get("inputs") or {}
        self.constraints = self.job.get("constraints") or {}
        self.card = self.brief.get("card")
        self.started = time.time()
        self.usage = {"brain_seconds": 0.0, "tokens_in": 0, "tokens_out": 0, "claude_calls": 0, "pages": 0, "seat": None}
        self.touched: list[str] = []

    def progress(self, words: str, done: int | None = None, total: int | None = None) -> None:
        foreman.set_state(self.id, "executing", note=words[:300])
        foreman.write(f"{self.dir}/progress.json", {"done": done, "total": total, "note": words[:300], "finished": False})
        with open(f"{self.dir}/run.log", "a") as f:
            f.write(f"{time.strftime('%H:%M:%S')} {words}\n")

    def spend(self, **kw) -> None:
        for k, v in kw.items():
            if k == "seat":
                self.usage["seat"] = v
            else:
                self.usage[k] = self.usage.get(k, 0) + v

    def over(self) -> str | None:
        """A constraint the work has passed, in words, or None."""
        wall = self.constraints.get("max_wall_sec")
        if wall and time.time() - self.started > wall:
            return f"passed its {int(wall // 60)} minutes"
        bmin = self.constraints.get("max_brain_min")
        if bmin and self.usage["brain_seconds"] / 60 > bmin:
            return f"passed its {bmin} brain-minutes"
        return None


def file_report(w: Worker, rep: dict) -> None:
    """The taxonomy report: written beside the worker, filed in the cortex as an episode, its usage in the ledger."""
    rep = {"kind": "report", "id": f"r-{w.id[2:]}", "worker": w.id, "brief_id": w.brief["id"], "class": w.job["class"],
           "card": w.card, "minutes": round((time.time() - w.started) / 60, 2), "usage": w.usage,
           "touched": sorted(set(w.touched)), **rep}
    protocol.check(rep)
    foreman.write(f"{w.dir}/report.json", rep)
    with open(f"{w.dir}/mailbox.jsonl", "a") as f:       # the report is a message too: the parent reads it here
        f.write(json.dumps(rep, ensure_ascii=False) + "\n")
    try:
        os.makedirs(os.path.dirname(USAGE), exist_ok=True)
        with open(USAGE, "a") as f:
            f.write(json.dumps({"at": time.time(), "worker": w.id, "class": w.job["class"], "card": w.card,
                                "minutes": rep["minutes"], "ok": bool(rep.get("ok")), "skills": getattr(w, "skills", []),
                                **w.usage}) + "\n")
    except OSError:
        pass
    text = f"{w.job['class']} worker {w.id}: {rep.get('said', '')}"[:1500]
    try:
        subprocess.run([f"{TOOLS}/cortex", "episode", w.card or w.id, f"report-{w.id}",
                        json.dumps({"text": text, "class": w.job["class"], "verdict": rep.get("verdict"),
                                    "ok": rep.get("ok"), "seat": w.usage.get("seat"), "minutes": rep["minutes"],
                                    "source": "worker report", "by": w.id}, ensure_ascii=False)],
                       capture_output=True, text=True, timeout=90)
    except (OSError, subprocess.SubprocessError):
        pass                                             # the report on disk stands; the cortex catches up on reindex


def leave_artifact(w, crash: str | None = None) -> None:
    """The run's slat artifact and its INDEX line (§37.3). Never the reason a run fails: the report on disk stands."""
    try:
        artifact.leave(w.id, usage=w.usage, crash=crash)
    except Exception as e:  # noqa: BLE001
        with open(f"{w.dir}/run.log", "a") as f:
            f.write(f"{time.strftime('%H:%M:%S')} artifact not written: {type(e).__name__}: {e}\n")


EXAM = os.environ.get("LACUNA_EXAM", f"{HOME}/lacuna-world/exam/state.json")


def exam_state(rep: dict) -> str:
    """press when the work ended on a card for the owner, done when it ended by itself, failed otherwise (§37.1)."""
    if not rep.get("ok"):
        return "failed"
    return "press" if rep.get("petitions") else "done"


def move_exam(w, rep: dict) -> None:
    """A worker started for an exam item (inputs.exam) moves its row when it retires — under the same lock the API's
    carts.exam_update takes, written whole (temp + rename). Never the reason a run fails."""
    eid = str(w.inputs.get("exam") or "").upper()
    if not eid or not eid[1:].isdigit() or eid[0] != "E":
        return
    try:
        import fcntl
        with open(os.path.splitext(EXAM)[0] + ".lock", "a+") as lk:
            fcntl.flock(lk, fcntl.LOCK_EX)
            try:
                doc = json.load(open(EXAM))
                row = next((r for r in doc.get("items") or [] if r.get("id") == eid), None)
                if row is None:
                    return
                seat = w.usage.get("seat")
                try:
                    model = json.load(open(f"{HOME}/.lacuna/box.json"))["seats"][seat]["model"] if seat else None
                except (OSError, ValueError, KeyError):
                    model = seat
                row.update({"state": exam_state(rep), "worker": w.id, "minutes": round((time.time() - w.started) / 60, 1),
                            "brain_seconds": round(float(w.usage.get("brain_seconds") or 0), 1),
                            "minds": [model] if model else [], "said": str(rep.get("said") or "")[:200],
                            "petition": (rep.get("petitions") or [None])[0]})
                tmp = f"{EXAM}.{os.getpid()}.tmp"
                with open(tmp, "w") as f:
                    f.write(json.dumps(doc, indent=1) + "\n")
                os.replace(tmp, EXAM)
            finally:
                fcntl.flock(lk, fcntl.LOCK_UN)
    except (OSError, ValueError) as e:
        with open(f"{w.dir}/run.log", "a") as f:
            f.write(f"{time.strftime('%H:%M:%S')} exam row not moved: {type(e).__name__}: {e}\n")


def main(wid: str) -> int:
    w = Worker(wid)
    foreman.set_state(wid, "briefed", cls=w.job["class"])
    try:
        mod = importlib.import_module(f"classes.{w.job['class'].replace('-', '_')}")   # disk-steward → disk_steward.py
    except ImportError as e:
        foreman.set_state(wid, "crashed", note=f"no class program: {e}")
        leave_artifact(w, crash=f"no class program: {e}")
        return 1
    foreman.set_state(wid, "executing")
    try:
        rep = mod.run(w) or {}
    except NotNow as e:
        foreman.set_state(wid, "briefed", note=str(e))
        return TEMPFAIL
    except Exception as e:  # noqa: BLE001 — a crash is said, kept, and retried by the runner
        foreman.set_state(wid, "crashed", note=f"{type(e).__name__}: {e}"[:300])
        with open(f"{w.dir}/run.log", "a") as f:
            f.write(traceback.format_exc())
        leave_artifact(w, crash=f"{type(e).__name__}: {e}"[:300])
        return 1
    foreman.set_state(wid, "reporting")
    file_report(w, rep)
    foreman.write(f"{w.dir}/progress.json", {"done": 1, "total": 1, "note": rep.get("said", "done")[:300], "finished": True})
    foreman.set_state(wid, "retired", note=rep.get("said", "")[:300])
    leave_artifact(w)
    move_exam(w, rep)
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1]))
