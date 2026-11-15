"""Session persistence — vim-swap-style continuity for the Lacuna REPL.

Each REPL invocation writes a per-session JSONL at `~/.lacuna/sessions/`.
On clean exit, the file gets a final `closed` event. If the process dies
hard (laptop crash, kill -9, SSH disconnect), the file has no `closed`
marker — Lacuna sees it on next startup and offers to resume.

The recorded events are enough to reconstruct visual context (last N
turns) when resuming. The model's internal state is NOT persisted (it's
stateless); but conversation history is, and that's what the operator
needs to pick up where they left off.

Storage:
  ~/.lacuna/sessions/<id>.jsonl     id = ISO timestamp + 4-char hex
  ~/.lacuna/sessions/active.txt     pointer to the current session id
                                    (cleaned on close)

Event taxonomy:
  opened    {ts, event, id, cwd, user, version}
  operator  {ts, event, content}      — each typed line
  lacuna    {ts, event, content}      — Lacuna's reply (toolkit or LLM)
  exec      {ts, event, command, rc}  — each shell exec
  closed    {ts, event, summary}      — clean exit marker
"""
from __future__ import annotations

import json
import os
import secrets
import time
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional


SESSIONS_DIR = Path.home() / ".lacuna" / "sessions"
ACTIVE_PTR   = SESSIONS_DIR / "active.txt"


def _now_iso() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def _now_id() -> str:
    """Session id = local-time slug + 4 hex chars. Sortable + unique."""
    stamp = datetime.now().strftime("%Y-%m-%dT%H-%M-%S")
    return f"{stamp}-{secrets.token_hex(2)}"


@dataclass
class Session:
    id: str
    path: Path
    opened_at: str

    def append(self, event: str, **fields) -> None:
        """Best-effort append. Failure is silent — REPL continues even if
        we can't write the session log."""
        try:
            self.path.parent.mkdir(parents=True, exist_ok=True)
            with self.path.open("a", encoding="utf-8") as f:
                rec = {"ts": _now_iso(), "event": event, **fields}
                f.write(json.dumps(rec, ensure_ascii=False) + "\n")
        except OSError:
            pass

    def close(self, reason: str = "normal") -> None:
        """Write the closed marker. Idempotent — safe to call multiple times."""
        self.append("closed", reason=reason)
        try:
            if ACTIVE_PTR.exists():
                ACTIVE_PTR.unlink()  # noqa: safe-delete — pointer file is process bookkeeping
        except OSError:
            pass


def open_new() -> Session:
    """Open a fresh session. Writes the `opened` event + active pointer."""
    SESSIONS_DIR.mkdir(parents=True, exist_ok=True)
    sid = _now_id()
    path = SESSIONS_DIR / f"{sid}.jsonl"
    s = Session(id=sid, path=path, opened_at=_now_iso())
    s.append("opened",
             id=sid,
             cwd=os.getcwd(),
             user=os.environ.get("USER", "?"),
             pid=os.getpid())
    try:
        ACTIVE_PTR.write_text(sid)
    except OSError:
        pass
    return s


def open_resumed(sid: str) -> Optional[Session]:
    """Re-open an existing session for continuation. Appends a `resumed`
    event so the file's history shows the resumption."""
    path = SESSIONS_DIR / f"{sid}.jsonl"
    if not path.exists():
        return None
    s = Session(id=sid, path=path, opened_at=_now_iso())
    s.append("resumed", cwd=os.getcwd(), user=os.environ.get("USER", "?"), pid=os.getpid())
    try:
        ACTIVE_PTR.write_text(sid)
    except OSError:
        pass
    return s


def list_unterminated() -> list[dict]:
    """Scan the sessions dir for files with no `closed` event. Sorted
    newest-first. Returns [{id, path, opened_at, lines, last_event_ts,
    operator_count, lacuna_count, last_operator_line}].

    A session is unterminated iff:
      - the file exists
      - no line contains `"event": "closed"`
    """
    if not SESSIONS_DIR.exists():
        return []
    out: list[dict] = []
    for p in sorted(SESSIONS_DIR.glob("*.jsonl"), reverse=True):
        try:
            text = p.read_text(errors="replace")
        except OSError:
            continue
        lines = [ln for ln in text.splitlines() if ln.strip()]
        if not lines:
            continue
        if any('"closed"' in ln for ln in lines):
            continue
        # Parse summary
        opened_at = None
        operator_count = 0
        lacuna_count = 0
        last_op_line = None
        last_event_ts = None
        for ln in lines:
            try:
                rec = json.loads(ln)
            except json.JSONDecodeError:
                continue
            ev = rec.get("event")
            if ev == "opened":
                opened_at = rec.get("ts")
            elif ev == "operator":
                operator_count += 1
                last_op_line = rec.get("content", "")
            elif ev == "lacuna":
                lacuna_count += 1
            last_event_ts = rec.get("ts") or last_event_ts
        out.append({
            "id": p.stem,
            "path": str(p),
            "opened_at": opened_at,
            "last_event_ts": last_event_ts,
            "lines": len(lines),
            "operator_count": operator_count,
            "lacuna_count": lacuna_count,
            "last_operator_line": (last_op_line[:60] if last_op_line else None),
        })
    return out


def replay_summary(sid: str, n_turns: int = 10) -> list[dict]:
    """Return the last n turns of a session for visual replay on resume.
    Each entry is {role, content, ts}. Trims to n_turns total events of
    type operator/lacuna (executions and meta events excluded)."""
    path = SESSIONS_DIR / f"{sid}.jsonl"
    if not path.exists():
        return []
    try:
        text = path.read_text(errors="replace")
    except OSError:
        return []
    out: list[dict] = []
    for ln in text.splitlines():
        ln = ln.strip()
        if not ln:
            continue
        try:
            rec = json.loads(ln)
        except json.JSONDecodeError:
            continue
        ev = rec.get("event")
        if ev in ("operator", "lacuna"):
            out.append({"role": ev, "content": rec.get("content", ""), "ts": rec.get("ts")})
    return out[-n_turns:]


def delete(sid: str) -> bool:
    """Delete a session file. Returns True on success."""
    path = SESSIONS_DIR / f"{sid}.jsonl"
    if not path.exists():
        return False
    try:
        path.unlink()  # noqa: safe-delete — operator-initiated session cleanup
        return True
    except OSError:
        return False


def prune_old(keep_recent: int = 50) -> int:
    """Keep the N most recent CLOSED sessions; delete older ones.
    Unterminated sessions are NEVER pruned (they're the resume targets)."""
    if not SESSIONS_DIR.exists():
        return 0
    closed_files = []
    for p in SESSIONS_DIR.glob("*.jsonl"):
        try:
            text = p.read_text(errors="replace")
        except OSError:
            continue
        if any('"closed"' in ln for ln in text.splitlines()):
            closed_files.append(p)
    if len(closed_files) <= keep_recent:
        return 0
    closed_files.sort(key=lambda p: p.stat().st_mtime)
    to_delete = closed_files[:len(closed_files) - keep_recent]
    n = 0
    for p in to_delete:
        try:
            p.unlink()  # noqa: safe-delete — closed session beyond keep_recent
            n += 1
        except OSError:
            pass
    return n
