"""Tests for lacuna/state.py — persistent ~/.lacuna/ state."""
import json
import pytest


@pytest.fixture(autouse=True)
def isolated_home(tmp_path, monkeypatch):
    """Redirect all state writes to tmp_path via LACUNA_HOME."""
    monkeypatch.setenv("LACUNA_HOME", str(tmp_path))
    yield tmp_path


def test_state_empty_when_no_file(isolated_home):
    from lacuna.state import read_state
    assert read_state() == {}


def test_state_write_and_read(isolated_home):
    from lacuna.state import read_state, write_state
    write_state({"version": "2.0.0-dev"})
    assert read_state()["version"] == "2.0.0-dev"


def test_state_merge(isolated_home):
    from lacuna.state import write_state, read_state
    write_state({"a": 1})
    write_state({"b": 2})
    s = read_state()
    assert s == {"a": 1, "b": 2}


def test_log_error_appends(isolated_home):
    from lacuna.state import log_error, recent_errors
    log_error("test", "first")
    log_error("test", "second")
    errs = recent_errors(10)
    assert len(errs) == 2
    # Newest-first ordering
    assert errs[0]["message"] == "second"
    assert errs[1]["message"] == "first"


def test_log_exception_captures_traceback(isolated_home):
    from lacuna.state import log_exception, recent_errors
    try:
        raise ValueError("boom")
    except ValueError as e:
        log_exception("test", e)
    errs = recent_errors(1)
    assert len(errs) == 1
    assert "ValueError: boom" in errs[0]["message"]
    assert errs[0]["traceback"] is not None
    assert "boom" in errs[0]["traceback"]


def test_clear_errors(isolated_home):
    from lacuna.state import log_error, clear_errors, recent_errors
    log_error("test", "one")
    log_error("test", "two")
    assert clear_errors() == 2
    assert recent_errors() == []


def test_log_session_event(isolated_home):
    from lacuna.state import log_session_event, last_boot
    log_session_event("boot", version="2.0.0-dev", port=5050)
    boot = last_boot()
    assert boot is not None
    assert boot["event"] == "boot"
    assert boot["version"] == "2.0.0-dev"


def test_last_boot_returns_most_recent(isolated_home):
    from lacuna.state import log_session_event, last_boot
    log_session_event("boot", port=5000)
    log_session_event("shutdown")
    log_session_event("boot", port=5050)  # most recent boot
    assert last_boot()["port"] == 5050


def test_pilot_default_is_human(isolated_home):
    from lacuna.state import get_pilot
    assert get_pilot() == "human"


def test_set_pilot(isolated_home):
    from lacuna.state import set_pilot, get_pilot, read_state
    set_pilot("claude")
    assert get_pilot() == "claude"
    assert "pilot_since" in read_state()
