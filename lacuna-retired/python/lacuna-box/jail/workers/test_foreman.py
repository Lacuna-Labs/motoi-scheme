"""A worker is spawned, briefed, run, reported and retired; a crash is a crash (no runner: run.py is called directly)."""
import json
import os
import subprocess
import sys

HERE = os.path.dirname(__file__)


def test_a_worker_lives_and_reports(tmp_path, monkeypatch):
    monkeypatch.setenv("LACUNA_JOBS", str(tmp_path))
    monkeypatch.setenv("LACUNA_USAGE", str(tmp_path / "usage.jsonl"))
    monkeypatch.setenv("LACUNA_ARTIFACTS", str(tmp_path / "artifacts"))
    env = {**os.environ}
    out = subprocess.run([sys.executable, f"{HERE}/foreman.py", "spawn", "echo", "say hi", "--card", "t"], capture_output=True, text=True, env=env)
    wid = out.stdout.strip()
    assert wid.startswith("w-echo-"), out.stderr
    rc = subprocess.run([sys.executable, f"{HERE}/run.py", wid], env=env, capture_output=True, text=True).returncode
    assert rc == 0
    rep = json.load(open(tmp_path / wid / "report.json"))
    assert rep["said"] == "echo: say hi" and rep["kind"] == "report" and rep["class"] == "echo"
    st = json.load(open(tmp_path / wid / "state.json"))
    assert [h["state"] for h in st["history"]] == ["spawned", "briefed", "executing", "executing", "reporting", "retired"]
    assert json.loads((tmp_path / "usage.jsonl").read_text().splitlines()[-1])["class"] == "echo"
    # the run left its artifact (§37.3): under its card, with an INDEX line naming it done
    art = (tmp_path / "artifacts" / "t" / f"{wid}.slat").read_text()
    assert art.startswith("(run ") and '(outcome :is "done"' in art
    assert wid in (tmp_path / "artifacts" / "INDEX.slat").read_text()


def test_a_crash_is_said(tmp_path, monkeypatch):
    monkeypatch.setenv("LACUNA_JOBS", str(tmp_path))
    monkeypatch.setenv("LACUNA_ARTIFACTS", str(tmp_path / "artifacts"))
    env = {**os.environ}
    wid = subprocess.run([sys.executable, f"{HERE}/foreman.py", "spawn", "echo", "boom", "--inputs", '{"crash": true}'],
                         capture_output=True, text=True, env=env).stdout.strip()
    rc = subprocess.run([sys.executable, f"{HERE}/run.py", wid], env=env, capture_output=True, text=True).returncode
    assert rc == 1
    assert json.load(open(tmp_path / wid / "state.json"))["state"] == "crashed"
    # a crash still leaves its artifact, and it says why it stopped
    art = (tmp_path / "artifacts" / "echo" / f"{wid}.slat").read_text()
    assert '(outcome :is "stopped"' in art


def test_spawned_job_is_one_the_runner_starts(tmp_path, monkeypatch):
    """The runner ticks only jobs whose job.json state is "on" — a spawned worker must be one (it sat 'waiting' forever)."""
    env = {**os.environ, "LACUNA_JOBS": str(tmp_path)}
    wid = subprocess.run([sys.executable, f"{HERE}/foreman.py", "spawn", "echo", "say hi"], capture_output=True, text=True,
                         env=env).stdout.strip()
    job = json.load(open(tmp_path / wid / "job.json"))
    assert job["state"] == "on" and job["run"].endswith(wid)
