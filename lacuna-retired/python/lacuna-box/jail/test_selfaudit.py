"""The self-audit catches the machinery failing — starting with the one that actually happened (2026-10-11).

Run: cd ~/.lacuna/jail && python3 -m pytest -q test_selfaudit.py   (or: python3 test_selfaudit.py)
"""
from __future__ import annotations

import datetime as dt

from jobrunner import seconds, when
from selfaudit import audit, runner_audit

NOW = dt.datetime(2026, 10, 11, 12, 49).timestamp()
H = 3600


def iso(t: float) -> str:
    return dt.datetime.fromtimestamp(t).isoformat(timespec="minutes")


def posters_job(**kw) -> dict:
    return {"name": "posters", "kind": "work", "state": "on", "every": "15m", "checkin": "30m",
            "created": iso(NOW - 8.5 * H), **kw}


def test_the_night_it_happened_eight_hours_without_a_check_in_is_caught():
    # exactly the record the broken scheduler left: 34 runs, latest start 13 min ago, no check-in, no first_started
    rs = {"runs": 34, "started": NOW - 13 * 60, "ended": NOW - 12 * 60, "last_exit": 0, "pid": None}
    found = audit(posters_job(), rs, NOW, seconds, when)
    assert "checkin-late" in found and "never checked in" in found["checkin-late"]


def test_a_healthy_repeating_errand_has_no_findings():
    rs = {"runs": 34, "started": NOW - 5 * 60, "first_started": NOW - 8.5 * H, "last_checkin": NOW - 20 * 60, "pid": None}
    assert audit(posters_job(), rs, NOW, seconds, when) == {}


def test_a_repeating_errand_that_stopped_being_started_is_caught():
    rs = {"runs": 10, "started": NOW - 2 * H, "first_started": NOW - 8 * H, "last_checkin": NOW - 10 * 60, "pid": None}
    assert "run-late" in audit(posters_job(), rs, NOW, seconds, when)


def test_an_errand_never_started_is_caught():
    job = posters_job(created=iso(NOW - 30 * 60))
    assert "never-started" in audit(job, {}, NOW, seconds, when)


def test_a_reminder_that_never_went_out_is_caught():
    job = {"name": "r", "kind": "remind", "state": "on", "at": iso(NOW - H)}
    assert "reminder-late" in audit(job, {}, NOW, seconds, when)


def test_paused_errands_promise_nothing():
    assert audit(posters_job(state="paused"), {"runs": 1, "started": NOW - 9 * H}, NOW, seconds, when) == {}


def test_a_silent_runner_is_named():
    assert "last ticked" in runner_audit({"tick": NOW - 10 * 60}, NOW)
    assert runner_audit({"tick": NOW - 30}, NOW) == ""


if __name__ == "__main__":
    for name, fn in list(globals().items()):
        if name.startswith("test_"):
            fn()
            print("ok ", name)
