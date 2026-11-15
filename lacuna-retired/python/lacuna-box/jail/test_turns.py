"""Heavy jobs take turns and need their memory; light jobs never wait (python3 -m pytest test_turns.py)."""
import os
import sys

sys.path.insert(0, os.path.dirname(__file__))
import lease  # noqa: E402
import turns  # noqa: E402


def test_light_jobs_never_wait():
    assert turns.may_start({"name": "x"}, memory=lambda: 0.1) == (True, "")


def test_a_heavy_job_waits_for_memory_then_takes_the_lane_and_a_second_waits(tmp_path, monkeypatch):
    monkeypatch.setattr(lease, "leases_dir", lambda: str(tmp_path))
    a = {"name": "forge-sft", "heavy": True, "needs_gb": 4, "max_run": "1h"}
    b = {"name": "calibration", "heavy": True, "needs_gb": 2}
    ok, why = turns.may_start(a, memory=lambda: 3.0)
    assert not ok and "needs 6.0 GB" in why
    assert turns.may_start(a, memory=lambda: 9.0) == (True, "")
    ok, why = turns.may_start(b, memory=lambda: 9.0)
    assert not ok and "forge-sft" in why
    turns.done(a)
    assert turns.may_start(b, memory=lambda: 9.0) == (True, "")
