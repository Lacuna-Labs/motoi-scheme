"""The health sweep never measures the live box in a test (P-2026-11-02-a-test-measured-the-live-disk).

spec: health.eaters's live-home guard (the conftest's scratch LACUNA_HOME) · class: a test reading outside its scratch (pattern 13) · technique: the sweep
forced, its thread joined, every command it ran recorded · method: the real health module, subprocess.run patched to record ·
sre: can a test's patched subprocess.run see a command a thread of the live code ran on the real home?
"""
import subprocess
import threading

from lacuna_api.control import health


def test_the_sweep_runs_no_command_on_the_live_home(monkeypatch):
    ran = []
    monkeypatch.setattr(subprocess, "run", lambda args, **k: ran.append(args) or subprocess.CompletedProcess(args, 0, "0\t-\n", ""))
    health._eaters["at"] = 0
    before = set(threading.enumerate())
    health.eaters(refresh=True)
    for t in set(threading.enumerate()) - before:
        t.join(timeout=10)
    assert not [a for a in ran if a and a[0] == "du"], ran
