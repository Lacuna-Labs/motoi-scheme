"""THE HOME NEVER WAITS ON HER IPAD (the CI's brain-down test on 53db2333: /api/home in 10.4 s, devicectl asking a sleeping
iPad inside the read). The device is read on a thread of its own and the home answers at once with the last read; a test or a
scratch home never asks the device. The modules are imported inside each test (P-2026-11-01-wake-test-stale-module)."""
import time
from pathlib import Path


def test_a_scratch_home_never_asks_the_ipad(monkeypatch, lacuna_home):
    from lacuna_api.control import deploys, home
    asked = []
    monkeypatch.setattr(deploys, "device", lambda who: asked.append(who) or {"ok": True, "device": "x", "build": "b"})
    monkeypatch.setitem(home._IPAD, "t", 0.0)
    monkeypatch.setitem(home._IPAD, "v", {})
    out = home.ipad({})
    assert asked == [] and out["device_why"] == "not read from a test or a scratch home"


def test_the_live_home_answers_at_once_while_a_slow_device_is_read_on_its_own_thread(monkeypatch, tmp_path):
    from lacuna_api.control import deploys, home
    live = tmp_path / ".lacuna"
    live.mkdir()
    monkeypatch.setattr(Path, "home", classmethod(lambda cls: tmp_path))
    monkeypatch.setenv("LACUNA_HOME", str(live))
    monkeypatch.setattr(deploys, "device", lambda who: time.sleep(1.0) or {"ok": True, "device": "F021", "build": "2026.1101.1957"})
    monkeypatch.setattr(deploys, "packages", lambda: {})
    monkeypatch.setattr(deploys, "builds", lambda: [])
    monkeypatch.setitem(home._IPAD, "t", 0.0)
    monkeypatch.setitem(home._IPAD, "v", {})
    monkeypatch.setitem(home._IPAD, "busy", False)
    t0 = time.time()
    first = home.ipad({})
    assert time.time() - t0 < 0.3, "the home waited on the device"
    assert first["device_why"] == "reading the iPad"
    for _ in range(40):
        if home._IPAD["v"].get("build"):
            break
        time.sleep(0.05)
    assert home.ipad({})["build"] == "2026.1101.1957"
