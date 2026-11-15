"""Lacuna status indicators -- persistent badges shown in the prompt.

Per Canon v0.5.2: when a subsystem is in a degraded state (graphics is
falling back to ASCII, the daemon is offline, the local LLM is not
reachable), the operator should see it in the prompt without having
to ask. Badges render at the end of the prompt's top line in dim
mid-grey, separated by middle-dot (`·`), only when the subsystem is
NOT in its preferred state. Healthy subsystems render nothing.

Placement convention follows the airline / tmux status-right / p10k
segment idiom: trailing-prompt position for "system tells me things
I should know."

Visual Canon discipline:
  - dim mid-grey (#888) for the "info" register, matching the persona
  - middle-dot separator matches the banner's existing `·` style
  - no chromatic hue (bare-Lacuna chrome stays tonal per v1.2.1)
  - yellow tint when actively degraded; red when failed
"""
from __future__ import annotations

import os
from pathlib import Path


# ANSI codes that work in both truecolor and basic terminals
_DIM       = "\x1b[38;5;251m"
_MID       = "\x1b[38;5;245m"
_YELLOW    = "\x1b[33m"
_RED       = "\x1b[31m"
_RESET     = "\x1b[0m"

# Middle-dot separator (canonical, matches banner pattern)
_SEP = " · "


def _has_truecolor() -> bool:
    return os.environ.get("COLORTERM", "").lower() in ("truecolor", "24bit")


def daemon_status() -> tuple[str, str] | None:
    """Daemon liveness badge. Only shown when the daemon is NOT reachable
    on its expected port. Healthy = no badge."""
    import socket
    try:
        sock = socket.create_connection(("127.0.0.1", 5050), timeout=0.05)
        sock.close()
        return None  # healthy, no badge
    except (OSError, socket.timeout):
        return ("daemon:offline", "warn")


def llm_status() -> tuple[str, str] | None:
    """Local LLM (Ollama) badge. Only shown when Ollama isn't reachable
    on its default port. The fallback ReAct path still works without
    Ollama, so this is informational, not blocking."""
    import socket
    try:
        sock = socket.create_connection(("127.0.0.1", 11434), timeout=0.05)
        sock.close()
        return None
    except (OSError, socket.timeout):
        return ("ai:offline", "info")


def mode_status() -> tuple[str, str] | None:
    """Operating-mode badge. Shows in the prompt only when the mode is
    NOT 'safe' (the default), so the operator is always aware they are
    operating in a non-default risk-tolerance stance."""
    try:
        from . import modes as _modes
        m = _modes.get_mode()
    except Exception:
        return None
    if m == "safe":
        return None
    severity = "warn" if m == "warn" else "fail"  # god -> red
    return (f"mode:{m}", severity)


def collect_badges() -> list[tuple[str, str]]:
    """Gather all currently-degraded badges. Order is stable for
    operator muscle memory: daemon -> ai -> mode."""
    badges = []
    for fn in (daemon_status, llm_status, mode_status):
        b = fn()
        if b is not None:
            badges.append(b)
    return badges


_SEVERITY_COLOR = {
    "ok":   _DIM,
    "info": _DIM,
    "warn": _YELLOW,
    "fail": _RED,
}


def render_badges() -> str:
    """Render the active badge string for the prompt's top line.
    Returns empty string when nothing is degraded.

    Each badge: ` · graphics:ascii` in the appropriate severity color,
    followed by reset. Joined together they extend the path/branch
    line without taking a new row."""
    badges = collect_badges()
    if not badges:
        return ""
    parts = []
    for label, severity in badges:
        color = _SEVERITY_COLOR.get(severity, _DIM)
        parts.append(f"{_DIM}{_SEP}{_RESET}{color}{label}{_RESET}")
    return "".join(parts)
