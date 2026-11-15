"""Structured logger. Three outputs in parallel:

  Operator-facing (Unix-conventional location):
    macOS:  ~/Library/Logs/Lacuna/lacuna.log
    Linux:  $XDG_STATE_HOME/lacuna/lacuna.log (default ~/.local/state/lacuna/lacuna.log)

  Internal (private to Lacuna's introspection — audit, ML data, replay):
    ~/.lacuna/logs/lacuna.log         human-readable text
    ~/.lacuna/logs/lacuna.log.jsonl   NDJSON structured — toolkit calls,
                                      session events, the trace we keep for
                                      our own behavior

The split: Unix people find Lacuna's logs where Unix people expect logs to
be (Library/Logs on Mac, XDG state on Linux). Lacuna's own audit trail and
the data we feed back into our own ML stays inside the dot-directory and
isn't surfaced to standard log-rotation tooling.

Levels (filterable via LACUNA_LOG_LEVEL env or lacuna.yaml):
  DEBUG < INFO < OK < WARN < ERROR

Event taxonomy (component/event):
  cli/boot            process start
  cli/command         subcommand dispatched
  daemon/start        daemon spawned
  daemon/stop         daemon terminated
  worker/spawn        worker forked
  worker/died         worker process exited unexpectedly
  toolkit/<fn>        deterministic toolkit function call (audit)
  perms/grant         operator granted a permission tier+scope
  perms/refuse        operator denied a permission request
  env/start           environment start attempt
  env/stop            environment stop attempt
  build/gate          pipeline gate result
  trash/send          file sent to trash
  error               caught exception (any component)
"""
from __future__ import annotations

import json
import os
import platform
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Optional

# Level ordering: lower number = lower priority. Filter cutoff is set by
# LACUNA_LOG_LEVEL env or by the application via set_flags().
_LEVELS = {"DEBUG": 10, "INFO": 20, "OK": 25, "WARN": 30, "ERROR": 40}

_QUIET = False
_VERBOSE = False
_LEVEL_CUTOFF = _LEVELS["INFO"]   # default surface threshold
_LOG_FILE:  Optional[Path] = None
_JSONL_FILE: Optional[Path] = None
_OPERATOR_LOG: Optional[Path] = None  # ~/Library/Logs/... or XDG state
_VERSION = "unknown"


def operator_log_path() -> Path:
    """Where Unix-conventional log lives for this OS.

    macOS uses ~/Library/Logs/Lacuna/lacuna.log per Apple's User Log
    Directories convention. Linux honors XDG_STATE_HOME (default
    ~/.local/state) per the XDG Base Directory Spec.
    """
    if platform.system() == "Darwin":
        return Path.home() / "Library" / "Logs" / "Lacuna" / "lacuna.log"
    state = os.environ.get("XDG_STATE_HOME") or str(Path.home() / ".local" / "state")
    return Path(state) / "lacuna" / "lacuna.log"


def _resolve_level(name: str | None = None) -> int:
    """Pick the cutoff from explicit name, then env, then default INFO."""
    candidate = (name or os.environ.get("LACUNA_LOG_LEVEL") or "INFO").upper().strip()
    return _LEVELS.get(candidate, _LEVELS["INFO"])


def set_flags(quiet: bool, verbose: bool, level: str | None = None) -> None:
    """quiet/verbose are stderr controls. `level` filters what gets written
    to disk; defaults to env LACUNA_LOG_LEVEL or INFO."""
    global _QUIET, _VERBOSE, _LEVEL_CUTOFF
    _QUIET = quiet
    _VERBOSE = verbose
    if verbose:
        _LEVEL_CUTOFF = _LEVELS["DEBUG"]
    else:
        _LEVEL_CUTOFF = _resolve_level(level)


def init_file(log_file: Path, version: str = "unknown") -> None:
    """Initialize the log surface.

    `log_file` is the INTERNAL location (~/.lacuna/logs/lacuna.log).
    The operator-facing location is computed per-OS and tee'd to.
    """
    global _LOG_FILE, _JSONL_FILE, _OPERATOR_LOG, _VERSION
    _VERSION = version
    _LOG_FILE = log_file
    _JSONL_FILE = log_file.with_suffix(".jsonl")
    log_file.parent.mkdir(parents=True, exist_ok=True)

    # Set up the operator-facing log too. Best-effort — if we can't write
    # to ~/Library/Logs, just fall back to internal-only.
    op = operator_log_path()
    try:
        op.parent.mkdir(parents=True, exist_ok=True)
        # Touch it so it exists even before the first write
        op.touch(exist_ok=True)
        _OPERATOR_LOG = op
    except OSError:
        _OPERATOR_LOG = None

    # Pick up env-based level on init in case no one called set_flags
    if _LEVEL_CUTOFF == _LEVELS["INFO"]:
        _level_from_env = _resolve_level()
        # Don't downgrade if set_flags already raised verbose
        if _level_from_env != _LEVELS["INFO"]:
            globals()["_LEVEL_CUTOFF"] = _level_from_env


def _now() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def _write(level: str, component: str, msg: str,
           event: str = "", ctx: dict[str, Any] | None = None) -> None:
    # Filter by configured cutoff
    if _LEVELS.get(level, 100) < _LEVEL_CUTOFF:
        return

    ts = _now()
    text_line = f"[{ts}] lacuna[{component}] {level}: {msg}"

    # Internal text log (~/.lacuna/logs/lacuna.log)
    if _LOG_FILE is not None:
        try:
            with _LOG_FILE.open("a") as f:
                f.write(text_line + "\n")
        except OSError:
            pass

    # Operator-facing log (~/Library/Logs/Lacuna or XDG state)
    if _OPERATOR_LOG is not None:
        try:
            with _OPERATOR_LOG.open("a") as f:
                f.write(text_line + "\n")
        except OSError:
            pass

    # Internal JSONL log — audit, ML data, replay
    if _JSONL_FILE is not None:
        record = {
            "ts": ts,
            "v": _VERSION,
            "level": level,
            "component": component,
            "event": event or level.lower(),
            "msg": msg,
            "ctx": ctx or {},
        }
        try:
            with _JSONL_FILE.open("a") as f:
                f.write(json.dumps(record) + "\n")
        except OSError:
            pass

    if _VERBOSE or level in ("ERROR", "WARN"):
        if not _QUIET:
            print(text_line, file=sys.stderr)


def info(component: str, msg: str,
         event: str = "", ctx: dict[str, Any] | None = None) -> None:
    _write("INFO", component, msg, event=event, ctx=ctx)


def warn(component: str, msg: str,
         event: str = "", ctx: dict[str, Any] | None = None) -> None:
    _write("WARN", component, msg, event=event, ctx=ctx)


def error(component: str, msg: str,
          event: str = "", ctx: dict[str, Any] | None = None) -> None:
    _write("ERROR", component, msg, event=event, ctx=ctx)


def debug(component: str, msg: str,
          event: str = "", ctx: dict[str, Any] | None = None) -> None:
    # _write() filters by _LEVEL_CUTOFF; DEBUG only writes when verbose
    # (set_flags raises cutoff to DEBUG) or LACUNA_LOG_LEVEL=DEBUG.
    _write("DEBUG", component, msg, event=event, ctx=ctx)


def ok(component: str, msg: str,
       event: str = "", ctx: dict[str, Any] | None = None) -> None:
    _write("OK", component, msg, event=event, ctx=ctx)


def parse_jsonl(log_file: Path, tail: int = 50) -> list[dict]:
    """Read last `tail` entries from the JSONL log. Returns [] if missing."""
    jsonl = log_file.with_suffix(".jsonl")
    if not jsonl.exists():
        return []
    lines = jsonl.read_text().splitlines()
    entries = []
    for line in lines[-tail:]:
        line = line.strip()
        if not line:
            continue
        try:
            entries.append(json.loads(line))
        except json.JSONDecodeError:
            pass
    return entries


def format_entries(entries: list[dict], as_yaml: bool = False) -> str:
    """Format structured log entries for human display.

    as_yaml=True: YAML document stream (---\\n key: value\\n...)
    as_yaml=False: compact columnar text
    """
    if not entries:
        return "(no structured log entries)"

    lines = []
    for e in entries:
        ts = e.get("ts", "?")[-8:-1]  # HH:MM:SS from ISO string
        level = e.get("level", "?")[:5].ljust(5)
        comp  = e.get("component", "?")
        event = e.get("event", "")
        msg   = e.get("msg", "")
        ctx   = e.get("ctx", {})

        if as_yaml:
            lines.append("---")
            lines.append(f"ts:        {e.get('ts', '?')}")
            lines.append(f"level:     {e.get('level', '?')}")
            lines.append(f"component: {comp}")
            lines.append(f"event:     {event}")
            lines.append(f"msg:       {msg}")
            if ctx:
                lines.append("ctx:")
                for k, v in ctx.items():
                    lines.append(f"  {k}: {v}")
        else:
            ctx_str = "  " + "  ".join(f"{k}={v}" for k, v in ctx.items()) if ctx else ""
            tag = f"{comp}/{event}" if event else comp
            lines.append(f"[{ts}] {level} {tag:<30}  {msg}{ctx_str}")

    return "\n".join(lines)
