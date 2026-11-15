"""The errand laws hold: verified done, stalls, expiry, verbatim failures, the digest (2026-10-11).

Run: cd ~/.lacuna/jail && python3 test_errandlaws.py
"""
from __future__ import annotations

import datetime as dt
import json
import os
import tempfile
import time

import errandlaws as law
from jobrunner import read_json, seconds, when

WORLD = os.path.expanduser("~/lacuna-world/workspace")     # the done check runs in the jail: use a folder it may read


def iso(t: float) -> str:
    return dt.datetime.fromtimestamp(t).isoformat(timespec="minutes")


def errand_dir() -> str:
    return tempfile.mkdtemp(dir=WORLD, prefix=".lawtest-")


def test_done_is_a_check_that_passes_not_exit_zero():
    d = errand_dir()
    ok, said = law.verify_done(d, {"done_check": "test -f result.txt || { echo 'no result.txt yet'; exit 1; }"})
    assert not ok and "no result.txt" in said
    open(f"{d}/result.txt", "w").write("x")
    assert law.verify_done(d, {"done_check": "test -f result.txt"})[0]
    assert law.verify_done(d, {})[0]                      # no check declared: the exit is trusted


def test_alive_but_silent_is_stalled():
    d = errand_dir()
    open(f"{d}/progress.json", "w").write("{}")
    old = time.time() - 3600
    os.utime(f"{d}/progress.json", (old, old))
    assert law.stalled(d, {"heartbeat_timeout": "20m"}, {"started": old}, seconds)
    open(f"{d}/heartbeat", "w").write("")                 # a fresh mark → alive
    assert not law.stalled(d, {"heartbeat_timeout": "20m"}, {"started": old}, seconds)


def test_repeating_errands_expire_and_deadlines_hold():
    week_ago = iso(time.time() - 8 * 86400)
    assert "expired" in law.expired({"every": "15m", "created": week_ago}, seconds, when)
    assert law.expired({"every": "15m", "created": week_ago, "expires": "never"}, seconds, when) == ""
    assert law.expired({"every": "15m", "created": week_ago, "renewed": iso(time.time())}, seconds, when) == ""
    assert "deadline" in law.expired({"deadline": iso(time.time() - 60)}, seconds, when)
    assert law.expired({"created": week_ago}, seconds, when) == ""          # one-shot errands do not expire


def test_failures_are_kept_verbatim():
    d = errand_dir()
    open(f"{d}/run.log", "w").write("── 01:00 start ──\nold ok\n── 02:00 start ──\nTraceback (most recent call last):\nValueError: bad row 17\n")
    out = law.failure_excerpt(d)
    assert "ValueError: bad row 17" in out and "old ok" not in out


def test_the_digest_names_what_needs_the_owner():
    jobs = tempfile.mkdtemp()
    for name, state in (("fox", "on"), ("cats", "done"), ("bake", "failed")):
        os.makedirs(f"{jobs}/{name}")
        json.dump({"name": name, "state": state}, open(f"{jobs}/{name}/job.json", "w"))
    json.dump({"done": 3, "total": 9}, open(f"{jobs}/fox/progress.json", "w"))
    text = law.digest(jobs, read_json, {})
    assert "fox 3/9" in text and "cats" in text and "NEEDS YOU: bake (failed)" in text


def test_a_repair_waits_while_the_gpu_is_busy_and_respects_its_budget():
    d = errand_dir()
    job = {"name": "x", "max_repairs": 1}
    assert law.start_repair(d, job, {"repairs": 1}, "stuck", "n") == ""          # budget spent
    if os.path.exists(law.GPU_BUSY):
        assert "waiting" in law.start_repair(d, job, {}, "stuck", "n")


def test_a_failed_done_check_is_retried_not_left_waiting_forever():
    # 2026-10-11: the runner recorded exit 0 although the check failed, and never ran the errand again
    import jobrunner as jr
    d = errand_dir()
    open(f"{d}/.exit", "w").write("0\n")
    open(f"{d}/notes.md", "w").write("")
    job = {"name": "drill", "run": "true", "done_check": "test -f ok.txt"}
    rs = {"pid": 999999, "boot": jr.boot_time(), "started": time.time() - 60, "runs": 1}
    starts = []
    jr.start, real = (lambda *a, **k: starts.append(a[-1])), jr.start
    try:
        jr.tick_work(d, job, rs)                          # the run ended: check fails → a failure, not "done"
        assert rs["last_exit"] == 1 and rs["fails"] == 1 and job.get("state") != "done"
        rs["not_before"] = 0
        jr.tick_work(d, job, rs)                          # the backoff passed → it runs again
        assert starts, "the errand was never rerun"
    finally:
        jr.start = real


if __name__ == "__main__":
    import shutil
    for name, fn in list(globals().items()):
        if name.startswith("test_"):
            fn()
            print("ok ", name)
    for d in os.listdir(WORLD):
        if d.startswith(".lawtest-"):
            shutil.rmtree(os.path.join(WORLD, d))
