"""THE RELEASE is one job with four steps; the stepper is read off its own lines; it needs a person's press."""
import importlib


def load(tmp_path, monkeypatch):
    monkeypatch.setenv("LACUNA_HOME", str(tmp_path))
    monkeypatch.setenv("LACUNA_NO_WORKERS", "1")
    import lacuna_api.control.core as core
    importlib.reload(core)
    import lacuna_api.control.deploys as deploys
    importlib.reload(deploys)
    return core, deploys


def test_a_release_needs_a_person(tmp_path, monkeypatch):
    core, deploys = load(tmp_path, monkeypatch)
    r = deploys.release("claude", confirm=False)
    assert r["ok"] is False and r["needs_confirm"]


def test_the_stepper_reads_the_job_lines(tmp_path, monkeypatch):
    core, deploys = load(tmp_path, monkeypatch)
    log = "\n".join(["release: 1/4 the workflow pass — the core apps", "release:   ✓ podcast", "release: 1/4 certified",
                     "release: 2/4 promote dev → QA and build for the iPad", "release:   promote: main → abc", "release: 2/4 QA promoted; build 2026.0926.0101 archived at x",
                     "release: 3/4 install build 2026.0926.0101 on the iPad"])
    monkeypatch.setattr(deploys, "all_jobs", lambda n=40: [{"id": "20260926-010101-abcdef", "kind": "release", "title": "release", "running": True}])
    monkeypatch.setattr(deploys.core if hasattr(deploys, "core") else __import__("lacuna_api.control.core", fromlist=["job_tail"]), "job_tail", lambda jid, n=200: log, raising=False)
    import lacuna_api.control.core as c
    monkeypatch.setattr(c, "job_tail", lambda jid, n=200: log)
    st = deploys.release_status()
    states = [s["state"] for s in st["steps"]]
    assert states == ["done", "done", "running", "waiting"]
    assert st["done"] is None and st["stopped"] is None


def test_a_stopped_release_marks_the_step_failed(tmp_path, monkeypatch):
    core, deploys = load(tmp_path, monkeypatch)
    log = "release: 1/4 the workflow pass\nrelease: STOPPED — the workflow pass did not certify"
    monkeypatch.setattr(deploys, "all_jobs", lambda n=40: [{"id": "20260926-010101-abcdef", "kind": "release", "title": "release", "running": False, "code": 1}])
    import lacuna_api.control.core as c
    monkeypatch.setattr(c, "job_tail", lambda jid, n=200: log)
    st = deploys.release_status()
    assert st["steps"][0]["state"] == "failed" and "did not certify" in st["stopped"]
    assert [s["state"] for s in st["steps"][1:]] == ["waiting", "waiting", "waiting"]
