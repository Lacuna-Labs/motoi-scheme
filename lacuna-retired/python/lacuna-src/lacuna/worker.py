"""Lacuna workers — Lacuna as foreman, workers as forked subprocesses.

A worker is a long-lived child process the operator names and lets the
foreman watch. Workers can:
  - Run a one-shot command and exit
  - Stay alive listening on a port (a watcher / poller)
  - Stay alive doing background work (log shipper, file watcher)

Files:
  ~/.lacuna/workers.json   — registry: [{name, pid, cmd, listen_port,
                              started_at, log_path}]
  ~/.lacuna/logs/workers/  — per-worker log files (`<name>.log`)

Liveness is checked on demand via `os.kill(pid, 0)` — no Unix socket
heartbeat in v1 (deferred to v2).

Permission tier: EXEC_USER for spawn(), WRITE_LOCAL for the registry.
"""
from __future__ import annotations

import json
import os
import signal
import subprocess
import time
from dataclasses import dataclass, asdict
from pathlib import Path
from typing import Optional

from . import log as _log


REGISTRY = Path.home() / ".lacuna" / "workers.json"
LOG_DIR = Path.home() / ".lacuna" / "logs" / "workers"


@dataclass
class Worker:
    name: str
    pid: int
    cmd: list[str]
    listen_port: Optional[int]
    started_at: float
    log_path: str
    cwd: str

    def is_alive(self) -> bool:
        try:
            os.kill(self.pid, 0)
            return True
        except (OSError, ProcessLookupError):
            return False


def _ensure_dirs() -> None:
    REGISTRY.parent.mkdir(parents=True, exist_ok=True)
    LOG_DIR.mkdir(parents=True, exist_ok=True)


def _read_registry() -> list[Worker]:
    if not REGISTRY.exists():
        return []
    try:
        data = json.loads(REGISTRY.read_text())
        return [Worker(**w) for w in data]
    except (json.JSONDecodeError, TypeError):
        return []


def _write_registry(workers: list[Worker]) -> None:
    _ensure_dirs()
    REGISTRY.write_text(json.dumps([asdict(w) for w in workers], indent=2))


def list_workers(prune: bool = True) -> list[dict]:
    """Return current registry as dicts. When prune=True (default), removes
    dead workers from the registry as a side effect."""
    workers = _read_registry()
    live: list[Worker] = []
    pruned = 0
    for w in workers:
        if w.is_alive():
            live.append(w)
        else:
            pruned += 1
    if prune and pruned:
        _write_registry(live)
        try:
            _log.info("worker", f"pruned {pruned} dead worker(s)",
                      ctx={"pruned": pruned})
        except Exception:
            pass
    return [asdict(w) for w in live]


def get_worker(name: str) -> Optional[Worker]:
    """Find a worker by name. Returns None if absent or dead."""
    for w in _read_registry():
        if w.name == name and w.is_alive():
            return w
    return None


def spawn(name: str, cmd: list[str], listen_port: Optional[int] = None,
          cwd: Optional[str] = None) -> dict:
    """Spawn a worker. Returns {ok, pid, log, error}.

    The worker runs in its own process group (start_new_session=True) so
    the foreman can SIGTERM the group cleanly.

    `name` must be unique among live workers.
    """
    _ensure_dirs()

    if get_worker(name) is not None:
        return {"ok": False, "error": f"worker '{name}' already running"}

    log_path = LOG_DIR / f"{name}.log"
    log_fd = open(log_path, "a", buffering=1)

    try:
        proc = subprocess.Popen(
            cmd,
            stdin=subprocess.DEVNULL,
            stdout=log_fd,
            stderr=subprocess.STDOUT,
            start_new_session=True,
            cwd=cwd or os.getcwd(),
        )
    except (FileNotFoundError, OSError) as e:
        log_fd.close()
        return {"ok": False, "error": f"spawn failed: {e}"}

    worker = Worker(
        name=name,
        pid=proc.pid,
        cmd=cmd,
        listen_port=listen_port,
        started_at=time.time(),
        log_path=str(log_path),
        cwd=cwd or os.getcwd(),
    )

    workers = [w for w in _read_registry() if w.name != name and w.is_alive()]
    workers.append(worker)
    _write_registry(workers)

    try:
        _log.info("worker", f"spawned worker '{name}' pid={proc.pid}",
                  ctx={"name": name, "pid": proc.pid, "cmd": cmd, "listen_port": listen_port})
    except Exception:
        pass

    # Brief settle wait
    time.sleep(0.4)
    return {"ok": True, "pid": proc.pid, "log": str(log_path),
            "alive": worker.is_alive()}


def kill(name: str, timeout: float = 3.0) -> dict:
    """SIGTERM a worker by name; SIGKILL after timeout. Removes from registry."""
    worker = get_worker(name)
    if worker is None:
        # Maybe it died already — clean up the registry
        workers = [w for w in _read_registry() if w.name != name]
        _write_registry(workers)
        return {"ok": True, "reason": "not-running"}

    try:
        os.killpg(os.getpgid(worker.pid), signal.SIGTERM)
    except (ProcessLookupError, PermissionError) as e:
        workers = [w for w in _read_registry() if w.name != name]
        _write_registry(workers)
        return {"ok": True, "reason": f"already-gone: {e}"}

    deadline = time.time() + timeout
    while worker.is_alive() and time.time() < deadline:
        time.sleep(0.2)

    if worker.is_alive():
        try:
            os.killpg(os.getpgid(worker.pid), signal.SIGKILL)
        except (ProcessLookupError, PermissionError):
            pass
        time.sleep(0.3)

    workers = [w for w in _read_registry() if w.name != name]
    _write_registry(workers)

    try:
        _log.info("worker", f"killed worker '{name}' pid={worker.pid}",
                  ctx={"name": name, "pid": worker.pid})
    except Exception:
        pass

    return {"ok": True, "pid": worker.pid}


def tail(name: str, n: int = 20) -> list[str]:
    """Return the last n lines of a worker's log."""
    log_path = LOG_DIR / f"{name}.log"
    if not log_path.exists():
        return []
    try:
        size = log_path.stat().st_size
        if size < 1_000_000:
            lines = log_path.read_text(errors="replace").splitlines()
        else:
            with log_path.open("rb") as f:
                f.seek(max(0, size - 64_000))
                lines = f.read().decode(errors="replace").splitlines()[1:]
        return lines[-n:]
    except OSError:
        return []
