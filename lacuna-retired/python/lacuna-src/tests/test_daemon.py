"""Tests for lacuna.daemon — backgrounded lacuna-api wrapper."""
from __future__ import annotations

import json
import os
import time
from pathlib import Path

import pytest

from lacuna import daemon


# ── fixture: redirect $LACUNA_HOME so daemon files land in tmp ────────────

@pytest.fixture
def isolated_daemon(tmp_path, monkeypatch):
    """Redirect daemon files to tmp via LACUNA_HOME."""
    home = tmp_path / ".lacuna"
    home.mkdir()
    monkeypatch.setenv("LACUNA_HOME", str(home))
    return home


# ── pure utility functions ─────────────────────────────────────────────────

def test_lacuna_home_honors_env(isolated_daemon):
    assert daemon._lacuna_home() == isolated_daemon


def test_path_helpers_under_lacuna_home(isolated_daemon):
    assert daemon._pid_file()  == isolated_daemon / "lacuna.pid"
    assert daemon._log_file()  == isolated_daemon / "logs" / "daemon.log"
    assert daemon._meta_file() == isolated_daemon / "daemon.json"


def test_resolve_port_defaults():
    assert daemon._resolve_port("dev") == 1138
    assert daemon._resolve_port("test") == 1139
    assert daemon._resolve_port("prod") == 1140


def test_resolve_port_unknown_env_falls_back_to_dev():
    assert daemon._resolve_port("staging") == 1138


def test_resolve_port_env_override(monkeypatch):
    monkeypatch.setenv("LACUNA_PORT_DEV", "1234")
    assert daemon._resolve_port("dev") == 1234


def test_resolve_port_invalid_override_falls_back(monkeypatch):
    monkeypatch.setenv("LACUNA_PORT_DEV", "not-a-number")
    assert daemon._resolve_port("dev") == 1138


def test_build_spawn_cmd_uses_uvicorn():
    cmd = daemon._build_spawn_cmd("dev", 1138)
    assert "uvicorn" in cmd
    assert "lacuna_api.app:app" in cmd
    assert "1138" in cmd
    # must be the current python interpreter
    import sys
    assert cmd[0] == sys.executable


def test_is_running_self():
    """The current process is always running."""
    assert daemon._is_running(os.getpid()) is True


def test_is_running_nonexistent():
    """A very-unlikely PID should not look alive."""
    assert daemon._is_running(999999) is False


# ── pid bookkeeping ────────────────────────────────────────────────────────

def test_read_pid_returns_none_when_no_file(isolated_daemon):
    assert daemon.read_pid() is None


def test_read_pid_cleans_stale_file(isolated_daemon):
    """A pid file pointing at a non-existent PID is cleaned up."""
    daemon._pid_file().parent.mkdir(parents=True, exist_ok=True)
    daemon._pid_file().write_text("999999")
    assert daemon.read_pid() is None
    assert not daemon._pid_file().exists()


def test_read_pid_returns_alive_pid(isolated_daemon):
    """If the PID file points at a live process, read_pid returns it."""
    daemon._pid_file().parent.mkdir(parents=True, exist_ok=True)
    daemon._pid_file().write_text(str(os.getpid()))
    assert daemon.read_pid() == os.getpid()


def test_read_pid_handles_corrupt_file(isolated_daemon):
    daemon._pid_file().parent.mkdir(parents=True, exist_ok=True)
    daemon._pid_file().write_text("not-a-number")
    assert daemon.read_pid() is None


# ── status ────────────────────────────────────────────────────────────────

def test_status_when_not_running(isolated_daemon):
    s = daemon.status()
    assert s["running"] is False
    assert s["pid"] is None
    assert "log" in s


def test_status_when_running_includes_meta(isolated_daemon):
    daemon._pid_file().parent.mkdir(parents=True, exist_ok=True)
    daemon._pid_file().write_text(str(os.getpid()))
    daemon._meta_file().write_text(json.dumps({
        "pid": os.getpid(),
        "env": "dev",
        "started_at": time.time() - 5,
        "api_port": 1138,
    }))
    s = daemon.status()
    assert s["running"] is True
    assert s["pid"] == os.getpid()
    assert s["env"] == "dev"
    assert s["port"] == 1138
    assert s["uptime_seconds"] is not None
    assert s["uptime_seconds"] >= 4


# ── stop idempotency ───────────────────────────────────────────────────────

def test_stop_when_not_running_is_idempotent(isolated_daemon):
    out = daemon.stop()
    assert out["ok"] is True
    assert out.get("reason") == "not-running"


# ── start: spawn machinery (using a stub, not real uvicorn) ───────────────

def test_start_then_stop_round_trip(isolated_daemon, monkeypatch):
    """Spawn a stub `sleep` instead of uvicorn so we exercise the spawn /
    pid / stop machinery without booting the real API."""
    # Replace the uvicorn invocation with a long-running sleep.
    monkeypatch.setattr(daemon, "_build_spawn_cmd",
                        lambda env, port: ["/bin/sh", "-c", "sleep 30"])
    # Pretend the API came up (the stub doesn't bind).
    monkeypatch.setattr(daemon, "_wait_for_api", lambda port, deadline_sec=8.0: True)
    monkeypatch.setattr(daemon, "_port_listening", lambda port, **_: False)
    # Don't actually try to spawn the host-cache worker.
    monkeypatch.setattr(daemon, "_find_lacuna", lambda: None)
    import lacuna.worker as _worker
    monkeypatch.setattr(_worker, "spawn", lambda name, cmd: {"ok": False, "reason": "test"})

    result = daemon.start("dev")
    assert result["ok"], f"start failed: {result}"
    pid = result["pid"]
    assert pid > 0
    assert result["env"] == "dev"
    assert result["port"] == 1138

    s = daemon.status()
    assert s["running"] is True
    assert s["pid"] == pid

    out = daemon.stop(timeout=2.0)
    assert out["ok"] is True

    time.sleep(0.3)
    s = daemon.status()
    assert s["running"] is False


def test_start_refuses_when_already_running(isolated_daemon, monkeypatch):
    """If a daemon's already recorded as running, start refuses."""
    daemon._pid_file().parent.mkdir(parents=True, exist_ok=True)
    daemon._pid_file().write_text(str(os.getpid()))  # ourselves — guaranteed alive

    result = daemon.start("dev")
    assert result["ok"] is False
    assert result["reason"] == "already-running"
    assert result["pid"] == os.getpid()


def test_start_refuses_when_port_already_bound(isolated_daemon, monkeypatch):
    """If the port is bound (e.g., a foreground uvicorn), start refuses."""
    monkeypatch.setattr(daemon, "_port_listening", lambda port, **_: True)
    result = daemon.start("dev")
    assert result["ok"] is False
    assert result["reason"] == "port-already-bound"
    assert result["port"] == 1138


def test_start_test_env_uses_test_port(isolated_daemon, monkeypatch):
    monkeypatch.setattr(daemon, "_build_spawn_cmd",
                        lambda env, port: ["/bin/sh", "-c", "sleep 30"])
    monkeypatch.setattr(daemon, "_wait_for_api", lambda port, deadline_sec=8.0: True)
    monkeypatch.setattr(daemon, "_port_listening", lambda port, **_: False)
    monkeypatch.setattr(daemon, "_find_lacuna", lambda: None)
    import lacuna.worker as _worker
    monkeypatch.setattr(_worker, "spawn", lambda name, cmd: {"ok": False, "reason": "test"})

    result = daemon.start("test")
    try:
        assert result["ok"], f"start failed: {result}"
        assert result["port"] == 1139
    finally:
        daemon.stop(timeout=2.0)


def test_start_reports_child_died_during_boot(isolated_daemon, monkeypatch):
    """If the spawned process exits before the API binds, start() reports
    it and cleans up the pid/meta files for retry."""
    monkeypatch.setattr(daemon, "_build_spawn_cmd",
                        lambda env, port: ["/bin/sh", "-c", "exit 1"])
    monkeypatch.setattr(daemon, "_wait_for_api", lambda port, deadline_sec=8.0: False)
    monkeypatch.setattr(daemon, "_port_listening", lambda port, **_: False)

    result = daemon.start("dev")
    assert result["ok"] is False
    # Either child-died-during-boot (process gone) or port-not-bound (rare race).
    assert result["reason"] in ("child-died-during-boot", "port-not-bound-after-8s")


# ── reload ────────────────────────────────────────────────────────────────

def test_reload_when_not_running(isolated_daemon, monkeypatch):
    """Reload on a cold daemon = stop (no-op) + start. The start half is
    covered by other tests; here we just check the result shape."""
    monkeypatch.setattr(daemon, "_build_spawn_cmd",
                        lambda env, port: ["/bin/sh", "-c", "sleep 30"])
    monkeypatch.setattr(daemon, "_wait_for_api", lambda port, deadline_sec=8.0: True)
    monkeypatch.setattr(daemon, "_port_listening", lambda port, **_: False)
    monkeypatch.setattr(daemon, "_find_lacuna", lambda: None)
    import lacuna.worker as _worker
    monkeypatch.setattr(_worker, "spawn", lambda name, cmd: {"ok": False, "reason": "test"})

    result = daemon.reload("dev")
    try:
        assert "stop" in result
        assert "start" in result
        assert result["stop"]["ok"] is True
        assert result["start"]["ok"] is True
    finally:
        daemon.stop(timeout=2.0)
