"""C23 — the model's watchdog: two misses = down and one alert, never a kick (D2: launchd restarts a crash), back = one alert, missing model = named fix,
the hourly probe only when nothing real answered, and never on the worker thread."""
import threading

import pytest

from lacuna_api.control import modelwatch as mw


@pytest.fixture
def box(monkeypatch):
    monkeypatch.setattr(mw, "_busy", lambda: False)        # the live brain's slots never decide a test
    for k, v in {"up": None, "misses": 0, "last_kick": 0.0, "kicks": 0, "present": None, "last_ok": 0.0, "probe_t": 0.0,
                 "calls": 0, "fails": 0}.items():
        monkeypatch.setitem(mw._s, k, v)
    b = {"up": True, "models": ["qwen3:8b"], "alerts": [], "runs": [], "probes": 0}

    def get(path, timeout):
        if not b["up"]:
            raise OSError("connection refused")
        return {"version": "0.12"} if path == "/api/version" else {"models": [{"name": n} for n in b["models"]]}
    monkeypatch.setattr(mw, "_get", get)
    monkeypatch.setattr(mw, "_health", lambda url: b["up"])          # the brain's and the gateway's own /health
    monkeypatch.setattr(mw, "run", lambda cmd, timeout=0: (b["runs"].append(cmd[1]), (0, ""))[1])
    monkeypatch.setattr(mw, "audit", lambda *a, **k: None)

    def probe(model):
        b["probes"] += 1
        b["probe_thread"] = threading.current_thread().name
        return True, 800, None
    monkeypatch.setattr(mw, "_probe", probe)
    b["alert"] = lambda key, level, title, body: b["alerts"].append((key, level))
    return b


def _join():
    for t in threading.enumerate():
        if t.name == "lacuna-model-probe":
            t.join(2)


def test_one_miss_is_not_down_two_are_and_it_never_kicks(box):
    mw.check("qwen3:8b", box["alert"]); _join()
    box["up"] = False
    mw.check("qwen3:8b", box["alert"])
    assert box["alerts"][-1:] != [("model:up", "error")] and box["runs"] == []
    mw.check("qwen3:8b", box["alert"])
    assert ("model:up", "error") in box["alerts"] and box["runs"] == []
    mw.check("qwen3:8b", box["alert"])                     # no second alert, and still no kick (D2)
    assert box["runs"] == [] and box["alerts"].count(("model:up", "error")) == 1
    box["up"] = True
    mw.check("qwen3:8b", box["alert"])
    assert box["alerts"][-1] == ("model:up", "info") and mw.state()["up"] is True


def test_a_missing_model_is_named_once_and_never_pulled(box):
    box["models"] = ["gemma4:e4b"]
    mw.check("qwen3:8b", box["alert"]); mw.check("qwen3:8b", box["alert"])
    assert box["alerts"] == [("model:present", "error")] and box["runs"] == []


def test_the_probe_runs_only_when_nothing_answered_and_off_the_worker_thread(box):
    mw.record(True, 1200)                                   # a real conversation just answered
    mw.check("qwen3:8b", box["alert"]); _join()
    assert box["probes"] == 0
    mw._s["last_ok"] = 0.0
    mw.check("qwen3:8b", box["alert"]); _join()
    assert box["probes"] == 1 and box["probe_thread"] == "lacuna-model-probe"
    mw.check("qwen3:8b", box["alert"]); _join()
    assert box["probes"] == 1                               # once an hour, not once a pass


def test_a_held_model_is_not_kicked(box, monkeypatch, tmp_path):
    """L23 (2026-09-25): an Ollama he booted out to free memory was brought back within ~40 s. `hold-model` in
    LACUNA_HOME says leave it down; the watch still says DOWN once, and kicks nothing."""
    monkeypatch.setattr(mw, "LACUNA_HOME", tmp_path)
    (tmp_path / "hold-model").write_text("")
    mw.check("qwen3:8b", box["alert"]); _join()
    box["up"] = False
    mw.check("qwen3:8b", box["alert"]); mw.check("qwen3:8b", box["alert"])
    assert ("model:up", "error") in box["alerts"]
    assert box["runs"] == []
    (tmp_path / "hold-model").unlink()
    monkeypatch.setitem(mw._s, "last_kick", 0.0)
    mw.check("qwen3:8b", box["alert"])
    assert box["runs"] == [], "the hold lifted, the watch still never kicks (D2: launchd restarts a crash)"
