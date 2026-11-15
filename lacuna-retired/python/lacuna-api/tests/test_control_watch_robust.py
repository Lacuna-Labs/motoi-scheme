"""THE WATCHER NEVER GOES QUIET (L3 · L4 · L5, 2026-09-25).

Three ways it used to: one unreadable telemetry line rolled every ingest pass back forever; a service already down
when Lacuna started was never said (the first look only remembered); one check raising skipped every check after
it, every minute. Each is a test here instead of a discovery.
"""
from __future__ import annotations

import json
import time

import pytest

from lacuna_api.control import errors, health, services, telemetry, workers


@pytest.fixture
def quiet(monkeypatch, lacuna_home, tmp_path):
    """A machine with nothing wrong, said-state in a tmp file, alerts captured, the errands read from a temp world."""
    said = []
    monkeypatch.setattr(telemetry, "JOBS", tmp_path / "jobs")    # never the live ~/lacuna-world/jobs (C10 MAIL; L1)
    monkeypatch.setattr(workers, "_SAID", tmp_path / "alert-state.json")
    monkeypatch.setattr(workers, "_saved", "")
    workers._state.clear(); workers._alerts.clear()
    monkeypatch.setattr(workers, "raise_alert", lambda key, level, title, body="", notify=True: said.append((key, level, title)))
    monkeypatch.setattr(workers.drift, "check", lambda: [])
    monkeypatch.setattr(errors, "classes", lambda **k: [])
    monkeypatch.setattr(errors, "bad_lines", lambda: {"count": 0, "last": "", "t": 0.0})
    monkeypatch.setattr(health, "watchdogs", lambda env: [])
    monkeypatch.setattr(health, "disk", lambda: {"low": False, "free_gb": 50})
    monkeypatch.setattr(health, "memory", lambda: {"pressure": "normal", "available_gb": 9})
    monkeypatch.setattr(services, "_listening", lambda port: True)
    monkeypatch.setattr(services, "answering", lambda name: True)
    return said


# ── L3 · one bad line is one bad line ────────────────────────────────────────────────────────────
def test_a_poison_line_is_skipped_and_the_good_ones_land(monkeypatch, lacuna_home, tmp_path):
    p = tmp_path / "stream.jsonl"
    now = time.time()
    good = json.dumps({"t": now, "from": "watch.disk", "action": "x", "level": "error", "summary": "disk gone"})
    p.write_text("".join(l + "\n" for l in [good, "123", json.dumps({"t": "yesterday"}), good]))
    monkeypatch.setattr(errors, "sources", lambda: [("dev", "stream", p)])
    monkeypatch.setattr(errors, "DB_PATH", tmp_path / "errors.db"); monkeypatch.setattr(errors, "_db", None)   # its own database
    n = errors.ingest_once()
    assert n == 2
    b = errors.bad_lines()
    assert b["count"] >= 2 and "stream.jsonl" in b["last"]
    assert errors.ingest_once() == 0                       # the offset moved past the poison; nothing re-raises


# ── L4 · a standing outage is said at start ───────────────────────────────────────────────────────
def test_a_service_already_down_at_start_is_said_on_the_first_look(quiet, monkeypatch):
    monkeypatch.setattr(services, "answering", lambda name: False)
    monkeypatch.setattr(health, "disk", lambda: {"low": True, "free_gb": 2.0})
    workers.evaluate()
    workers.evaluate()                                     # a service is DOWN after two misses (L6)
    keys = {k for k, _, _ in quiet}
    assert {f"svc:{n}" for n in workers.WATCHED_SERVICES} <= keys
    assert "disk:low" in keys
    # said once: the second look adds nothing
    before = len(quiet)
    workers.evaluate()
    assert len(quiet) == before


def test_a_healthy_start_says_nothing(quiet):
    workers.evaluate()
    assert quiet == []


def test_every_edge_survives_a_restart(quiet, monkeypatch):
    monkeypatch.setattr(services, "answering", lambda name: False)
    workers.evaluate(); workers.evaluate()
    assert any(k.startswith("svc:") for k, _, _ in quiet)
    quiet.clear()
    workers._state.clear()                                 # a restart
    workers._load_said()
    workers.evaluate()
    assert quiet == [], "the standing outage was said AGAIN after a restart"


# ── L5 · one failing check never blinds the rest ─────────────────────────────────────────────────
def test_one_raising_check_skips_nothing_else(quiet, monkeypatch):
    monkeypatch.setattr(health, "watchdogs", lambda env: (_ for _ in ()).throw(OSError("stream unreadable")))
    monkeypatch.setattr(health, "disk", lambda: {"low": True, "free_gb": 2.0})
    workers.evaluate()
    keys = [k for k, _, _ in quiet]
    assert "check:watchdogs" in keys                       # the failure itself is said…
    assert "disk:low" in keys                              # …and the checks after it still ran
    assert (workers._SAID).exists()                        # and the said-state was still written
    # the check answering again is said once, as info
    quiet.clear()
    monkeypatch.setattr(health, "watchdogs", lambda env: [])
    workers.evaluate()
    assert [k for k, level, _ in quiet if k == "check:watchdogs"] == ["check:watchdogs"]
    assert [level for k, level, _ in quiet if k == "check:watchdogs"] == ["info"]


# ── L19 · "returned" survives a burst ────────────────────────────────────────────────────────────
def test_a_class_back_after_six_hours_reads_returned_even_in_a_burst(monkeypatch, lacuna_home, tmp_path):
    monkeypatch.setattr(errors, "DB_PATH", tmp_path / "errors.db"); monkeypatch.setattr(errors, "_db", None)   # its own database
    now = time.time()
    ev = lambda t: {"t": t, "source": "api", "level": "error", "subsystem": "stores", "action": "sync", "summary": "eBay refused", "fields": None}
    errors.record("dev", ev(now - 7 * 3600))                 # seen, then quiet
    errors.record("dev", ev(now - 30))                       # back…
    errors.record("dev", ev(now - 5))                        # …in a burst of two lines
    mine = [r for r in errors.classes(since_h=24, limit=50) if r["action"] == "sync"]
    assert mine and mine[0]["signal"] == "returned", mine
