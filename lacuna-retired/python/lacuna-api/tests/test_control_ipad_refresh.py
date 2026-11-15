"""THE IPAD PROFILE WATCH (workers._ipad_profile_watch; P-2026-11-01-ipad-refresh-loop). Owns the tests that the watch never
builds or installs from a test, a clone or a scratch home, and a pass from one runs none of the hour's acts; that 36 h out
it says once when the app stops and rebuilds nothing, whatever new build path a rebuild makes; that past the profile's end
it rebuilds once, and a rebuild that kept the old profile or a build with a new one starts nothing more; that a profile's
date (naive UTC, as plistlib gives it) is read as UTC on a box in another zone; and that the suite refuses any process that
names the real build or install tools. Refuses: a real `security`, a real job, the live home (the box is tmp_path; the
profile decode is answered at the process boundary, so the code under test runs whole). The modules are imported inside
each fixture and test: an app_client test imports every lacuna_api module again, and a stand-in set on the old module never
reaches the code (P-2026-11-01-wake-test-stale-module; on 11-01 this file's first draft started two real builds that way)."""
import json
import os
import plistlib
import subprocess
import time
from datetime import datetime, timedelta, timezone
from pathlib import Path

import pytest

SHA = "0c9481871d"


def _ends_in(hours: float) -> datetime:
    """A profile's ExpirationDate as plistlib gives it: naive, in UTC."""
    return (datetime.now(timezone.utc) + timedelta(hours=hours)).replace(tzinfo=None)


@pytest.fixture
def box(monkeypatch, tmp_path):
    """A box whose home is tmp_path: its live home, its kept builds, each build's profile, the jobs and alerts captured."""
    from lacuna_api.control import core, workers
    live = tmp_path / ".lacuna"
    live.mkdir()
    monkeypatch.setattr(Path, "home", classmethod(lambda cls: tmp_path))
    monkeypatch.setattr(workers, "LACUNA_HOME", live)
    profiles, jobs, alerts = {}, [], []
    real_run = subprocess.run

    def run(argv, *a, **k):   # `security cms -D -i <profile>` answers the build's stand-in profile; anything else runs
        if argv[:4] == ["security", "cms", "-D", "-i"]:
            name = Path(argv[4]).parent.parent.name
            body = plistlib.dumps(profiles[name]) if name in profiles else b""
            return subprocess.CompletedProcess(argv, 0 if body else 1, stdout=body, stderr=b"")
        return real_run(argv, *a, **k)
    monkeypatch.setattr(subprocess, "run", run)

    class Job:
        def __init__(self, n):
            self.id = f"job-{n}"

    def start_job(kind, title, cmd, who, cwd=None, env=None):
        jobs.append({"kind": kind, "title": title, "cmd": cmd, "who": who})
        return Job(len(jobs))
    monkeypatch.setattr(core, "start_job", start_job)
    monkeypatch.setattr(workers, "raise_alert", lambda key, level, title, body, notify=True: alerts.append(title))

    def build(stamp: str, uuid: str, hours: float) -> Path:
        prof = tmp_path / ".lacuna" / "builds" / f"{stamp}-main-{SHA}" / "CuratorShell.app" / "embedded.mobileprovision"
        prof.parent.mkdir(parents=True, exist_ok=True)
        prof.write_bytes(b"stand-in")
        profiles[f"{stamp}-main-{SHA}"] = {"UUID": uuid, "ExpirationDate": _ends_in(hours)}
        return prof
    return {"w": workers, "live": live, "build": build, "jobs": jobs, "alerts": alerts}


def test_a_scratch_home_never_builds_or_installs(box, monkeypatch, tmp_path):
    # the live builds hold a profile 25 h from its end; a test's pass runs the watch from its own home, with no mark
    box["build"]("20261101-152449", "u-1", 25)
    scratch = tmp_path / "scratch-home"
    scratch.mkdir()
    monkeypatch.setattr(box["w"], "LACUNA_HOME", scratch)
    box["w"]._ipad_profile_watch()
    box["build"]("20261101-160000", "u-1", -1)
    box["w"]._ipad_profile_watch()
    assert box["jobs"] == [], "a test started a real build and an install on her iPad"
    assert box["alerts"] == [] and not (scratch / "ipad-refresh.json").exists()


def test_a_pass_from_a_scratch_home_runs_none_of_the_hours_acts(monkeypatch, lacuna_home):
    # the robust tests run the whole pass with its clocks at zero; the hour's acts reach the live box and stay home
    from lacuna_api.control import condense, errors, workers
    called = []
    monkeypatch.setattr(errors, "ingest_once", lambda *a, **k: None)
    monkeypatch.setattr(workers, "sample", lambda *a, **k: None)
    monkeypatch.setattr(workers, "evaluate", lambda *a, **k: None)
    monkeypatch.setattr(workers, "_snapshot_world", lambda: called.append("snapshot"))
    monkeypatch.setattr(workers, "_ipad_profile_watch", lambda: called.append("ipad"))
    monkeypatch.setattr(condense, "condense", lambda *a, **k: called.append("condense"))
    state = {"last_min": 0.0, "last_day": 0.0, "last_hour": 0.0, "last_model": 0.0}
    workers._pass(state)
    time.sleep(0.2)   # the snapshot would run on a thread of its own
    assert called == [] and state["last_hour"] > 0


def test_36_h_out_it_says_once_and_rebuilds_nothing_whatever_the_path(box):
    box["build"]("20261101-145750", "u-1", 25)
    box["w"]._ipad_profile_watch()
    box["w"]._ipad_profile_watch()
    assert box["jobs"] == [], "a rebuild before the end keeps the same profile (eleven did on 11-01)"
    assert len(box["alerts"]) == 1 and "expires in 25 h" in box["alerts"][0]
    box["build"]("20261101-152449", "u-1", 25)   # a build of the same commit lands: a new path, the same profile
    box["w"]._ipad_profile_watch()
    assert box["jobs"] == [] and len(box["alerts"]) == 1


def test_past_its_end_it_rebuilds_once_and_nothing_more(box):
    box["build"]("20261102-170000", "u-1", -1)
    box["w"]._ipad_profile_watch()
    box["w"]._ipad_profile_watch()
    assert len(box["jobs"]) == 1, box["jobs"]
    job = box["jobs"][0]
    assert job["who"] == "lacuna:ipad-refresh" and "expired" in job["title"]
    assert f'build-ipad.sh" main "{box["live"] / "builds"}' in job["cmd"][2] and "install-ipad.sh" in job["cmd"][2]
    box["build"]("20261102-171500", "u-1", -1)    # the rebuild kept the old profile: said once, never retried
    box["w"]._ipad_profile_watch()
    box["build"]("20261102-180000", "u-2", 168)   # a build with a new profile, 7 days out: quiet
    box["w"]._ipad_profile_watch()
    assert len(box["jobs"]) == 1 and len(box["alerts"]) == 1
    assert json.loads((box["live"] / "ipad-refresh.json").read_text())["expired"] == "u-1"


def test_a_profile_past_its_end_in_utc_reads_expired_in_any_zone(box):
    old = os.environ.get("TZ")
    os.environ["TZ"] = "America/New_York"
    time.tzset()
    try:
        box["build"]("20261102-170000", "u-1", -1)   # read as local time, this date sits 4 h ahead and the watch only warns
        box["w"]._ipad_profile_watch()
        assert len(box["jobs"]) == 1, box["alerts"]
    finally:
        if old is None:
            os.environ.pop("TZ", None)
        else:
            os.environ["TZ"] = old
        time.tzset()


def test_the_suite_refuses_a_process_that_names_the_real_build_or_install_tools():
    from lacuna_api.control import core
    from conftest import DeviceReached, _TOOLBOX
    # an echo, so a missing guard prints a path and starts nothing
    with pytest.raises(DeviceReached):
        core.start_job("build", "a test's build", ["/bin/echo", str(_TOOLBOX / "install-ipad.sh")], "test")
    with pytest.raises(DeviceReached):
        subprocess.run(["/bin/echo", "tools/env/ota-ipad.sh"], capture_output=True)
    assert subprocess.run(["/bin/echo", "build-ipad.sh"], capture_output=True).returncode == 0, "a stand-in's name alone runs"
