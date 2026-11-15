"""Persistent state for Lacuna — lives in ~/.lacuna/.

Three append-only logs + one state file:
  ~/.lacuna/state.json         — latest known state (version, pilot, last_boot)
  ~/.lacuna/errors.jsonl       — every captured error, newest-last
  ~/.lacuna/sessions.jsonl     — every boot / shutdown event, newest-last
  ~/.lacuna/logs/lacuna.jsonl  — structured general log (already used by TUI)

All writes are line-append where possible — cheap, safe across crashes.
state.json is the only file that gets rewritten, and it's non-critical (just a
cache of the latest values).
"""
from __future__ import annotations

import json
import os
import time
import traceback
from datetime import datetime, timezone
from pathlib import Path
from typing import Any


# ── paths ────────────────────────────────────────────────────────────────────

def _home() -> Path:
    return Path(os.environ.get("LACUNA_HOME", Path.home() / ".lacuna"))


def state_path() -> Path:
    return _home() / "state.json"

def errors_path() -> Path:
    return _home() / "errors.jsonl"

def sessions_path() -> Path:
    return _home() / "sessions.jsonl"


def _ensure_home() -> Path:
    home = _home()
    home.mkdir(parents=True, exist_ok=True)
    return home


def _now() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


# ── state.json ───────────────────────────────────────────────────────────────

def read_state() -> dict[str, Any]:
    """Return the latest state, or an empty dict if nothing has been written."""
    p = state_path()
    if not p.exists():
        return {}
    try:
        return json.loads(p.read_text())
    except (OSError, json.JSONDecodeError):
        return {}


def write_state(updates: dict[str, Any]) -> dict[str, Any]:
    """Merge updates into state.json and return the new state."""
    _ensure_home()
    current = read_state()
    current.update(updates)
    state_path().write_text(json.dumps(current, indent=2))
    return current


# ── errors.jsonl ─────────────────────────────────────────────────────────────

def log_error(
    source: str,
    message: str,
    *,
    traceback_text: str | None = None,
    context: dict[str, Any] | None = None,
) -> None:
    """Append one error entry. source is free-form (e.g. 'api', 'tui')."""
    _ensure_home()
    entry = {
        "ts": _now(),
        "source": source,
        "message": message,
        "traceback": traceback_text,
        "context": context or {},
    }
    with errors_path().open("a") as f:
        f.write(json.dumps(entry) + "\n")


def log_exception(source: str, exc: BaseException, context: dict[str, Any] | None = None) -> None:
    """Convenience: log an Exception with its traceback."""
    tb = "".join(traceback.format_exception(type(exc), exc, exc.__traceback__))
    log_error(source, f"{type(exc).__name__}: {exc}", traceback_text=tb, context=context)


def recent_errors(n: int = 20) -> list[dict[str, Any]]:
    """Return the last n errors, newest-first."""
    p = errors_path()
    if not p.exists():
        return []
    lines = p.read_text().splitlines()
    out: list[dict[str, Any]] = []
    for line in lines[-n:]:
        try:
            out.append(json.loads(line))
        except json.JSONDecodeError:
            continue
    out.reverse()
    return out


def clear_errors() -> int:
    """Clear the error log. Returns how many entries were removed."""
    p = errors_path()
    if not p.exists():
        return 0
    count = sum(1 for _ in p.read_text().splitlines())
    p.write_text("")
    return count


# ── sessions.jsonl ───────────────────────────────────────────────────────────

def log_session_event(event: str, **kwargs: Any) -> None:
    """Append one session event. event is e.g. 'boot', 'shutdown', 'pilot-connect'."""
    _ensure_home()
    entry = {"ts": _now(), "event": event, **kwargs}
    with sessions_path().open("a") as f:
        f.write(json.dumps(entry) + "\n")


def last_boot() -> dict[str, Any] | None:
    """Return the most recent 'boot' event, or None."""
    p = sessions_path()
    if not p.exists():
        return None
    last = None
    for line in p.read_text().splitlines():
        try:
            entry = json.loads(line)
            if entry.get("event") == "boot":
                last = entry
        except json.JSONDecodeError:
            continue
    return last


# ── pilot / copilot ──────────────────────────────────────────────────────────

def set_pilot(pilot: str) -> None:
    """Record who's driving (e.g. 'claude', 'chatgpt', 'deepseek', 'human')."""
    write_state({"pilot": pilot, "pilot_since": _now()})


def get_pilot() -> str:
    return read_state().get("pilot", "human")
