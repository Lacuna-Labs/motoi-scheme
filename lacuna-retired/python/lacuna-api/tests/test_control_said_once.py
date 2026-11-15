"""A standing condition is said ONCE — and still once after Lacuna restarts."""
import os

os.environ.setdefault("LACUNA_NO_WORKERS", "1")


def test_drift_is_said_once_across_a_restart(tmp_path, monkeypatch):
    from lacuna_api.control import workers
    monkeypatch.setattr(workers, "_SAID", tmp_path / "alert-state.json")
    monkeypatch.setattr(workers, "_saved", "")
    row = {"kind": "code", "service": "qa-api", "id": "branch:qa", "value": "aaa/bbb", "detail": "qa runs aaa"}
    monkeypatch.setattr(workers.drift, "check", lambda: [row])
    monkeypatch.setattr(workers.errors, "classes", lambda **k: [])
    monkeypatch.setattr(workers.health, "watchdogs", lambda env: [])
    monkeypatch.setattr(workers.health, "disk", lambda: {"low": False, "free_gb": 50})
    monkeypatch.setattr(workers.health, "memory", lambda: {"pressure": "normal", "available_gb": 9})
    monkeypatch.setattr(workers.services, "_listening", lambda port: True)
    monkeypatch.setattr(workers.services, "_http_ok", lambda url: True)        # a slow live service is not this test's
    monkeypatch.setattr(workers.fence, "check", lambda: {"state": "ok", "text": "", "failures": []})
    monkeypatch.setattr(workers.telemetry, "evaluate", lambda *a, **k: None)   # the live box's telemetry is not this test's
    from lacuna_api.control import sentinel                                     # nor the live box's new listeners
    monkeypatch.setattr(sentinel, "check", lambda raise_alert: [])
    said = []
    monkeypatch.setattr(workers, "raise_alert", lambda key, *a, **k: said.append(key))
    workers._state.clear()
    workers.evaluate()
    workers.evaluate()
    assert said == ["drift:branch:qa"]
    workers._state.clear()          # a restart: memory gone, the file stays
    workers._load_said()
    workers.evaluate()
    assert said == ["drift:branch:qa"]
    row["value"] = "ccc/bbb"         # it changed: say it again
    workers.evaluate()
    assert said == ["drift:branch:qa", "drift:branch:qa"]
