"""RUN ARTIFACTS, read back (LACUNA-1.3-DESIGN §37.3, B47).

Every worker run leaves ~/lacuna-world/artifacts/<cart>/<run-id>.slat and a line in artifacts/INDEX.slat (the jail's
workers/artifact.py writes them). This is the reading side for the chat, the desk and SELF.slat: INDEX first (what
happened while I was away), then the one artifact a question needs. One reader: the jail module is loaded here by
path, so the slat it writes and the slat read back go through the same protocol.py.
"""
from __future__ import annotations

import importlib.util
import os
from pathlib import Path

HOME = Path.home()
# the repo's copy first (the API runs from the repo), the deployed jail's copy if the repo's is missing
_CANDIDATES = (Path(__file__).resolve().parents[3] / "lacuna-box" / "jail" / "workers" / "artifact.py",
               HOME / ".lacuna" / "jail" / "workers" / "artifact.py")
_MOD = None


def _jail():
    global _MOD
    if _MOD is None:
        path = next((p for p in _CANDIDATES if p.exists()), None)
        if path is None:
            raise FileNotFoundError("the jail's artifact.py is not on this machine")
        spec = importlib.util.spec_from_file_location("lacuna_artifact", path)
        mod = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(mod)
        _MOD = mod
    return _MOD


def root() -> Path:
    return Path(os.environ.get("LACUNA_ARTIFACTS", HOME / "lacuna-world" / "artifacts"))


def index() -> list[dict]:
    """One row per cart (or worker class): its latest run's id, outcome, when, and the line it said. Newest first."""
    rows = _jail().index()
    return sorted(rows, key=lambda r: str(r.get("when") or ""), reverse=True)


def read(run_id: str) -> dict | None:
    """One run's artifact: run, steps, made, minds, outcome (and the raw text). None if no run has that id."""
    return _jail().read(str(run_id or ""))


def latest(cart: str) -> dict | None:
    """The newest run of one cart or class, read in full."""
    want = str(cart or "").strip().lower()
    row = next((r for r in index() if str(r.get("cart") or "").lower() == want), None)
    return read(row["id"]) if row else None


def index_lines(limit: int = 12) -> list[str]:
    """INDEX.slat's own lines, newest first: what SELF.slat and the chat quote."""
    try:
        text = (root() / "INDEX.slat").read_text()
    except OSError:
        return []
    lines = [ln for ln in text.splitlines() if ln.startswith("(")]
    when = {ln: (_jail().parse_lines(ln) or [{}])[0].get("when") or "" for ln in lines}
    return sorted(lines, key=lambda ln: str(when[ln]), reverse=True)[:limit]


def words(cart: str | None = None, run_id: str | None = None) -> str:
    """The chat's answer: a run's steps when one is named, else every cart's latest line."""
    if run_id or cart:
        a = read(run_id) if run_id else latest(cart or "")
        if not a:
            return f"no artifact for {run_id or cart} — the carts with one: " + ", ".join(r.get("cart", "?") for r in index())
        run, out = a.get("run") or {}, a.get("outcome") or {}
        minds = a.get("minds") or {}
        made = a.get("made") or {}
        lines = [f"{run.get('id')} ({run.get('cart')}) asked: {run.get('asked')}",
                 f"outcome: {out.get('is')} — {out.get('reason')}",
                 f"{minds.get('minutes')} min, {minds.get('brain_seconds')} brain-seconds, minds: {', '.join(minds.get('used') or []) or 'none'}"]
        lines += [f"  {s.get('at', '')} {s.get('status')}: {s.get('name')} — {s.get('why')}" for s in a.get("steps") or []][-20:]
        bits = [f"{k}: {', '.join(v)}" for k, v in made.items() if v]
        lines.append("made: " + ("; ".join(bits) if bits else "nothing"))
        return "\n".join(lines)
    rows = index()
    if not rows:
        return "no run has left an artifact yet"
    return "\n".join(f"{r.get('when', '')}  {r.get('cart'):<10} {r.get('outcome'):<8} {r.get('id')}  {str(r.get('said') or '')[:140]}"
                     for r in rows)


from fastapi import APIRouter  # noqa: E402

router = APIRouter()


@router.get("/api/carts/{name}/artifact")
def r_latest(name: str) -> dict:
    """B9: the cart's newest artifact — what it made, who it used, how it ended — for the Factory's artifact key."""
    from .cartview import parse_artifact
    a = latest(name)
    if not a:
        return {"ok": False, "why": f"{name} has left no artifact yet"}
    return {"ok": True, "cart": name, **parse_artifact(a.get("text") or ""), "text": a.get("text") or ""}


@router.get("/api/tasks")
def r_tasks() -> dict:
    """The Agents screen's TASKS (the owner, 2026-10-19: "what it finished, what it didn't finish, where it stopped. You can
    restart tasks"): what runs now (work.py), every cart's newest run with its outcome and its last words (INDEX), and
    the work order if one stands."""
    from . import work, work_order
    rows = [r for r in index() if r.get("cart")]
    from . import claude_tasks
    from . import task_runner
    return {"live": work.work().get("items") or [], "done": rows, "order": work_order.current(), "claude": claude_tasks.tasks(),
            "queue": task_runner.standing()}


@router.get("/api/tasks/claude/{tid}/events")
def r_claude_events(tid: str, since: float = 0) -> dict:
    """A task's run as it happens (task_runner.py): Transcript events, oldest first, after `since`."""
    from . import task_runner
    return {"task": tid, "events": task_runner.events(tid, since), "at": __import__("time").time()}


@router.post("/api/tasks/claude/{tid}/start")
def r_claude_start(tid: str) -> dict:
    from . import claude_tasks
    return claude_tasks.start(tid.upper(), "alfred")
