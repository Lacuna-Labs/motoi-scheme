"""F5 (CARDS-2.0 §9.3 step 4): a Forge job the hands started by kind (`<forge runs>/job-<worker>/`) is a live run in
GET /api/forge/runs while its trainer runs or is paused, named by its foreman worker; a parked or ended job is not.
The trainer is a real process named forge_sft.py (a sleeper); the world and the runs dir are tmp dirs."""
from __future__ import annotations

import os
import signal
import subprocess
import sys
import time


def _trainer(tmp_path, run_dir):
    script = tmp_path / "forge_sft.py"
    script.write_text("import time\ntime.sleep(60)\n")
    p = subprocess.Popen([sys.executable, str(script), "job", "--kind", "signal->label", "--run-dir", str(run_dir)])
    time.sleep(0.3)
    return p


def test_a_job_the_hands_started_is_live_by_its_worker_and_paused_by_ps(tmp_path, monkeypatch, lacuna_home):
    from lacuna_api.control import forge_runs
    root = tmp_path / "runs"
    run = root / "job-w-abc123"
    run.mkdir(parents=True)
    (run / "train.log").write_text("10:00:00 job signal->label on 270m: stand-in · 100 steps\n10:00:02 step 26/100 loss 1.9000 2 s swap 0.0 GB\n")
    (root / "job-w-dead01").mkdir()                       # no trainer: parked or ended, never live
    (root / "job-w-dead01" / "train.log").write_text("10:00:00 step 5/100 loss 2.0\n")
    monkeypatch.setenv("LACUNA_WORLD", str(tmp_path / "world"))
    monkeypatch.setenv("LACUNA_FORGE_JOBS", str(root))
    p = _trainer(tmp_path, run)
    try:
        live = forge_runs.runs()["live"]
        assert [(x["worker"], x["state"], x["step"]["step"], x["step"]["of"]) for x in live] == [("w-abc123", "running", 26, 100)]
        assert live[0]["pid"] == p.pid and live[0]["errand"] == "job-w-abc123"
        os.kill(p.pid, signal.SIGSTOP)
        time.sleep(0.2)
        assert forge_runs.runs()["live"][0]["state"] == "paused"
        os.kill(p.pid, signal.SIGCONT)
        assert "TRAINING NOW: job-w-abc123" in forge_runs.runs_words()
    finally:
        p.kill()
        p.wait()
    assert forge_runs.runs()["live"] == [], "the trainer gone: the job is not live"
