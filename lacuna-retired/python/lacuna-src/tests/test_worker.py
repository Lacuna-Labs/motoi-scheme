"""Tests for lacuna.worker — foreman + worker model."""
from __future__ import annotations

import os
import time
from pathlib import Path

import pytest

from lacuna import worker


@pytest.fixture
def isolated_workers(tmp_path, monkeypatch):
    """Redirect worker registry + log dir to tmp."""
    monkeypatch.setattr(worker, "REGISTRY", tmp_path / "workers.json")
    monkeypatch.setattr(worker, "LOG_DIR", tmp_path / "logs" / "workers")
    return tmp_path


def test_list_empty_when_no_registry(isolated_workers):
    assert worker.list_workers() == []


def test_get_worker_missing_returns_none(isolated_workers):
    assert worker.get_worker("nonexistent") is None


def test_kill_when_not_running_is_idempotent(isolated_workers):
    out = worker.kill("ghost")
    assert out["ok"] is True
    assert out.get("reason") == "not-running"


def test_spawn_then_list(isolated_workers):
    """Spawn a sleep, list, kill — full round trip."""
    out = worker.spawn("test-sleeper", ["/bin/sleep", "5"])
    assert out["ok"], f"spawn failed: {out}"
    assert out["alive"] is True

    workers = worker.list_workers()
    assert len(workers) == 1
    assert workers[0]["name"] == "test-sleeper"
    assert workers[0]["pid"] > 0

    # Cleanup
    kill_out = worker.kill("test-sleeper")
    assert kill_out["ok"] is True


def test_spawn_duplicate_name_rejected(isolated_workers):
    out1 = worker.spawn("dup", ["/bin/sleep", "5"])
    assert out1["ok"]
    out2 = worker.spawn("dup", ["/bin/sleep", "5"])
    assert not out2["ok"]
    assert "already running" in out2["error"]
    worker.kill("dup")


def test_spawn_failure_returns_error(isolated_workers):
    """Spawning a non-existent command returns an error, doesn't crash."""
    out = worker.spawn("nope", ["/this/definitely/does/not/exist"])
    assert not out["ok"]
    assert "error" in out


def test_tail_returns_lines_after_spawn(isolated_workers):
    """The /bin/echo command writes to the worker log."""
    worker.spawn("echo-test", ["/bin/sh", "-c", "echo hello world; echo line 2"])
    time.sleep(0.5)  # let it run
    lines = worker.tail("echo-test", 5)
    assert any("hello world" in l for l in lines), f"got: {lines}"
    # Cleanup — already exited but registry might have the dead entry
    worker.list_workers(prune=True)


def test_list_prunes_dead_workers(isolated_workers):
    """A spawned-and-exited worker should be pruned on next list()."""
    worker.spawn("brief", ["/bin/sh", "-c", "exit 0"])
    time.sleep(0.5)  # let it die
    workers = worker.list_workers(prune=True)
    # Should be empty since brief exited
    assert all(w["name"] != "brief" for w in workers)


def test_listen_port_recorded_in_registry(isolated_workers):
    out = worker.spawn("listener", ["/bin/sleep", "5"], listen_port=7878)
    assert out["ok"]
    workers = worker.list_workers()
    assert len(workers) == 1
    assert workers[0].get("listen_port") == 7878
    worker.kill("listener")
