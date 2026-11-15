"""A stuck job is said (2026-10-19): the release sat 40 min in a hung web test and the desk said "running". A job past
its kind's usual time raises one alert with the time, the usual, the quiet log, and where; it clears when the job ends."""
import importlib
import json
import os
import time


def _ended(home, kind, i, took, code="0"):
    jd = home / "jobs"
    jd.mkdir(exist_ok=True)
    jid = f"20260101-0000{i:02d}-{i:06x}"
    started = time.time() - 10_000
    (jd / f"{jid}.json").write_text(json.dumps({"id": jid, "kind": kind, "title": kind, "cmd": [], "who": "t", "started": started, "pid": None}))
    c = jd / f"{jid}.code"
    c.write_text(code)
    os.utime(c, (started + took, started + took))


def _fresh(tmp_path, monkeypatch):
    monkeypatch.setenv("LACUNA_HOME", str(tmp_path))
    monkeypatch.setenv("LACUNA_NO_WORKERS", "1")
    import lacuna_api.control.core as core
    importlib.reload(core)
    import lacuna_api.control.stuck as stuck
    importlib.reload(stuck)
    return core, stuck


def test_the_limit_comes_from_the_kinds_own_history(tmp_path, monkeypatch):
    for i, took in enumerate([300, 360, 420, 500]):
        _ended(tmp_path, "promote", i, took)
    _ended(tmp_path, "promote", 9, 2800, code="1")                # today's 47-minute hang, a failure
    _ended(tmp_path, "rare", 10, 100)
    core, stuck = _fresh(tmp_path, monkeypatch)
    h = stuck.history()
    assert h["promote"]["n"] == 5 and h["promote"]["median_s"] == 420
    assert h["promote"]["limit_s"] == max(3 * 420, 1.5 * 500, stuck.FLOOR_S)   # the hang is not a "good run"
    assert h["rare"]["limit_s"] == stuck.DEFAULT_S                             # too little history: the default


def test_an_overdue_job_raises_one_alert_and_it_clears_when_the_job_ends(tmp_path, monkeypatch):
    for i, took in enumerate([300, 330, 360]):
        _ended(tmp_path, "promote", i, took)
    core, stuck = _fresh(tmp_path, monkeypatch)
    monkeypatch.setattr(stuck, "FLOOR_S", 1)
    j = core.start_job("promote", "release: promotes dev", ["/bin/bash", "-c", "echo testing e44917; sleep 30"], "t")
    time.sleep(0.5)
    stuck._hist.update(t=time.time(), by={"promote": {"n": 3, "median_s": 330, "longest_ok_s": 360, "limit_s": 0.2}})
    monkeypatch.setattr(stuck, "_hot_tests", lambda pid, kill=False: [{"pid": 1, "file": "src/X.test.jsx", "test": "loops"}])
    monkeypatch.setattr(stuck, "unstick", lambda jid, who: {"ok": True, "said": "stopped src/X.test.jsx :: loops"})
    raised, cleared = [], []
    alert = lambda key, level, title, body, notify=True: raised.append((key, level, title, body))   # noqa: E731
    stuck.check(alert, lambda key, why: cleared.append(key))
    stuck.check(alert, lambda key, why: cleared.append(key))      # a second pass says nothing new
    warn = [r for r in raised if r[1] == "warn"]
    assert len(warn) == 1 and warn[0][0] == f"stuck:{j.id}"
    body = warn[0][3]
    assert "usually 6 min" in body and "testing e44917" in body and "src/X.test.jsx :: loops" in body and "Unstick" in body
    assert any(r[1] == "info" and "stopped the hung test" in r[2] for r in raised)   # Lacuna unstuck it, once
    core.cancel_job(j.id, "t")
    time.sleep(1.0)
    stuck.check(alert, lambda key, why: cleared.append(key))
    assert cleared == [f"stuck:{j.id}"]


def test_a_job_inside_its_usual_time_is_not_stuck(tmp_path, monkeypatch):
    for i, took in enumerate([300, 330, 360]):
        _ended(tmp_path, "promote", i, took)
    core, stuck = _fresh(tmp_path, monkeypatch)
    j = core.start_job("promote", "release", ["/bin/bash", "-c", "sleep 5"], "t")
    rows = stuck.stuck()
    assert [r["id"] for r in rows] == [j.id] and rows[0]["overdue"] is False and rows[0]["usual_s"] == 330
    raised = []
    stuck.check(lambda *a, **k: raised.append(a), lambda *a: None)
    assert raised == []
    core.cancel_job(j.id, "t")
