"""Lacuna daemon — backgrounded lacuna-api with PID file and log redirect.

Spawns `python -m uvicorn lacuna_api.app:app` in a detached subprocess so
the operator's terminal stays free.

Files (all under $LACUNA_HOME, default ~/.lacuna/):
  lacuna.pid               PID of the spawned uvicorn child
  daemon.json              metadata: pid, env, started_at, port
  logs/daemon.log          combined stdout+stderr from the child

Public CLI: `lacuna daemon start|stop|status|reload [--env dev|test]`.
"""
from __future__ import annotations

import json
import os
import signal
import socket
import subprocess
import sys
import time
import urllib.error
import urllib.request
from pathlib import Path
from typing import Optional

from . import log as _log


DEFAULT_PORTS = {"dev": 1138, "test": 1139, "prod": 1140}


def _lacuna_home() -> Path:
    return Path(os.environ.get("LACUNA_HOME", Path.home() / ".lacuna"))


def _pid_file() -> Path:
    return _lacuna_home() / "lacuna.pid"


def _log_file() -> Path:
    return _lacuna_home() / "logs" / "daemon.log"


def _meta_file() -> Path:
    return _lacuna_home() / "daemon.json"


# Backwards-compat exports for any code/tests that imported the old constants.
PID_FILE = _pid_file()
LOG_FILE = _log_file()
META_FILE = _meta_file()


def _ensure_dirs() -> None:
    _pid_file().parent.mkdir(parents=True, exist_ok=True)
    _log_file().parent.mkdir(parents=True, exist_ok=True)


def _is_running(pid: int) -> bool:
    """Cheap liveness check — signal 0 doesn't actually deliver, just probes."""
    try:
        os.kill(pid, 0)
        return True
    except (OSError, ProcessLookupError):
        return False


def _port_listening(port: int, host: str = "127.0.0.1", timeout: float = 0.3) -> bool:
    """TCP-connect probe. Detects any process bound to the port,
    including foreground starts done outside the daemon."""
    try:
        with socket.create_connection((host, port), timeout=timeout):
            return True
    except OSError:
        return False


def _build_spawn_cmd(env: str, port: int) -> list[str]:
    """The command line `start()` runs to bring up the API. Extracted so
    tests can monkeypatch it with a stub process without rewiring the
    rest of the spawn machinery."""
    return [
        sys.executable, "-m", "uvicorn",
        "lacuna_api.app:app",
        "--host", "127.0.0.1",
        "--port", str(port),
    ]


def _resolve_port(env: str) -> int:
    """Pick the API port. Order: LACUNA_PORT_<ENV> env var, DEFAULT_PORTS table."""
    override = os.environ.get(f"LACUNA_PORT_{env.upper()}")
    if override:
        try:
            return int(override)
        except ValueError:
            pass
    return DEFAULT_PORTS.get(env, DEFAULT_PORTS["dev"])


def _wait_for_api(port: int, deadline_sec: float = 8.0) -> bool:
    """Poll /healthz until 200, or until deadline. Returns True on success."""
    end = time.time() + deadline_sec
    while time.time() < end:
        try:
            with urllib.request.urlopen(f"http://127.0.0.1:{port}/healthz", timeout=0.5) as r:
                if r.status == 200:
                    return True
        except (urllib.error.URLError, OSError):
            pass
        time.sleep(0.25)
    return False


def read_pid() -> Optional[int]:
    """Return the daemon PID if the file exists and the process is alive,
    else None (cleans up stale pid file if process is gone)."""
    p = _pid_file()
    if not p.exists():
        return None
    try:
        pid = int(p.read_text().strip())
    except (ValueError, OSError):
        return None
    if not _is_running(pid):
        try:
            p.unlink()  # noqa: safe-delete — pid file is process bookkeeping
        except OSError:
            pass
        return None
    return pid


def status() -> dict:
    """Return {running, pid, uptime_seconds, env, port, log}."""
    pid = read_pid()
    if pid is None:
        return {"running": False, "pid": None, "log": str(_log_file())}
    meta = {}
    if _meta_file().exists():
        try:
            meta = json.loads(_meta_file().read_text())
        except json.JSONDecodeError:
            pass
    started = meta.get("started_at")
    uptime = int(time.time() - started) if started else None
    return {
        "running": True,
        "pid": pid,
        "env": meta.get("env"),
        "port": meta.get("api_port"),
        "started_at": started,
        "uptime_seconds": uptime,
        "log": str(_log_file()),
    }


def start(env: str = "dev") -> dict:
    """Spawn lacuna-api uvicorn in a detached session.

    Idempotency: refuses to spawn if (a) a recorded daemon PID is alive,
    or (b) the API port is already bound by something else (e.g., a
    foreground start outside the daemon).

    On spawn, polls /healthz for up to 8 seconds before reporting ok.
    Returns {ok: False, reason: 'child-died-during-boot' | 'port-not-
    bound-after-8s', ...} if the spawn produced a process but the API
    never responded.
    """
    _ensure_dirs()

    api_port = _resolve_port(env)

    existing = read_pid()
    if existing is not None:
        return {"ok": False, "reason": "already-running", "pid": existing,
                "note": "daemon registered in lacuna.pid"}

    if _port_listening(api_port):
        return {"ok": False, "reason": "port-already-bound",
                "port": api_port,
                "note": (f"something is already listening on :{api_port}. "
                         f"That might be a foreground uvicorn you forgot "
                         f"about. Find it with: lsof -nP -iTCP:{api_port} -sTCP:LISTEN")}

    cmd = _build_spawn_cmd(env, api_port)

    child_env = os.environ.copy()
    child_env["LACUNA_ENV"] = env
    child_env["LACUNA_PORT"] = str(api_port)

    log_fd = open(_log_file(), "a", buffering=1)

    try:
        proc = subprocess.Popen(
            cmd,
            stdin=subprocess.DEVNULL,
            stdout=log_fd,
            stderr=subprocess.STDOUT,
            start_new_session=True,
            cwd=str(Path.cwd()),
            env=child_env,
        )
    except (FileNotFoundError, OSError) as e:
        log_fd.close()
        return {"ok": False, "reason": f"spawn-failed: {e}"}

    _pid_file().write_text(str(proc.pid))
    _meta_file().write_text(json.dumps({
        "pid": proc.pid,
        "env": env,
        "started_at": time.time(),
        "cmd": cmd,
        "log": str(_log_file()),
        "api_port": api_port,
    }))

    try:
        _log.info("daemon", f"daemon started pid={proc.pid} env={env}",
                  ctx={"pid": proc.pid, "env": env, "cmd": cmd, "port": api_port})
    except Exception:
        pass

    api_up = _wait_for_api(api_port, deadline_sec=8.0)
    still_alive = _is_running(proc.pid)

    if api_up:
        # Spawn the host-cache refresher so the zsh prompt's tri-tone
        # blocks stay live. Best-effort; failure does not take down the
        # daemon (the prompt just shows stale blocks).
        try:
            from . import worker as _worker
            lacuna_bin = _find_lacuna()
            if lacuna_bin:
                cache_cmd = [lacuna_bin, "host", "cache", "--watch", "2"]
            else:
                cache_cmd = [sys.executable, "-m", "lacuna", "host", "cache", "--watch", "2"]
            _worker.spawn("host-cache", cache_cmd)
        except Exception as e:
            try:
                _log.warn("daemon", f"host-cache worker spawn failed: {e}")
            except Exception:
                pass

        return {"ok": True, "pid": proc.pid, "env": env, "port": api_port,
                "log": str(_log_file())}

    if not still_alive:
        # Child died during boot. Clean up so retry is unblocked.
        try:
            _pid_file().unlink(missing_ok=True)  # noqa: safe-delete — stale pid cleanup
            _meta_file().unlink(missing_ok=True)  # noqa: safe-delete — stale meta cleanup
        except OSError:
            pass
        return {"ok": False, "reason": "child-died-during-boot",
                "log": str(_log_file()),
                "note": f"check {_log_file()} for the traceback"}

    # Process is alive but API didn't bind in 8s. Leave PID/meta so the
    # operator can investigate; report honestly.
    return {"ok": False, "reason": "port-not-bound-after-8s",
            "pid": proc.pid, "log": str(_log_file()),
            "note": f"the wrapper is alive but :{api_port} never bound. "
                    f"check the log; consider `lacuna daemon stop` and retry"}


def _launchd_loaded() -> bool:
    """Return True if labs.lacuna.daemon plist is loaded in launchctl."""
    try:
        r = subprocess.run(["launchctl", "list", "labs.lacuna.daemon"],
                           capture_output=True, text=True, timeout=2)
        return r.returncode == 0
    except (FileNotFoundError, subprocess.TimeoutExpired):
        return False


def _launchd_unload() -> bool:
    """Unload the plist if loaded. Returns True on success."""
    plist = Path.home() / "Library" / "LaunchAgents" / "labs.lacuna.daemon.plist"
    if not plist.exists():
        return False
    try:
        r = subprocess.run(["launchctl", "unload", str(plist)],
                           capture_output=True, text=True, timeout=3)
        return r.returncode == 0
    except (FileNotFoundError, subprocess.TimeoutExpired):
        return False


def stop(timeout: float = 5.0, also_unload_launchd: bool = False) -> dict:
    """Send SIGTERM to the daemon's process group, then SIGKILL after timeout.

    Reaps workers too via process-group kill.

    If `also_unload_launchd` is True, unloads the launchd plist first so
    it doesn't respawn the daemon we're trying to stop.
    """
    if also_unload_launchd and _launchd_loaded():
        _launchd_unload()

    # Reap the host-cache worker first; other workers go via the
    # process-group SIGTERM below.
    try:
        from . import worker as _worker
        _worker.kill("host-cache")
    except Exception:
        pass

    pid = read_pid()
    if pid is None:
        return {"ok": True, "reason": "not-running"}

    try:
        os.killpg(os.getpgid(pid), signal.SIGTERM)
    except (ProcessLookupError, PermissionError) as e:
        try:
            _pid_file().unlink()  # noqa: safe-delete — stale pid cleanup
        except OSError:
            pass
        return {"ok": True, "reason": f"already-gone: {e}"}

    deadline = time.time() + timeout
    while _is_running(pid) and time.time() < deadline:
        time.sleep(0.2)

    if _is_running(pid):
        try:
            os.killpg(os.getpgid(pid), signal.SIGKILL)
        except (ProcessLookupError, PermissionError):
            pass
        time.sleep(0.5)

    try:
        _pid_file().unlink()  # noqa: safe-delete — pid file is process bookkeeping
    except OSError:
        pass

    try:
        _log.info("daemon", f"daemon stopped pid={pid}", ctx={"pid": pid})
    except Exception:
        pass

    return {"ok": True, "pid": pid}


def reload(env: str = "dev") -> dict:
    """Stop + start. Returns combined result."""
    stop_result = stop()
    time.sleep(0.5)
    start_result = start(env)
    return {"stop": stop_result, "start": start_result}


def _find_lacuna() -> Optional[str]:
    """Locate the `lacuna` executable on PATH."""
    from shutil import which
    return which("lacuna")
