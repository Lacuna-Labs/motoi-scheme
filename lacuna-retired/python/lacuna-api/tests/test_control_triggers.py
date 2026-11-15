"""Triggers (triggers.py): a condition fires on its EDGE, a schedule at its time; arming is the owner's card."""
import json

from lacuna_api.control import hands, triggers


def _world(tmp_path, monkeypatch):
    monkeypatch.setenv("LACUNA_WORLD", str(tmp_path))
    (tmp_path / "carts").mkdir()
    (tmp_path / "carts" / "disk-watch.sks").write_text("(lacuna-cart 'disk-watch '((does . \"x\") (done . \"y\")))")
    triggers._state.clear()


def test_a_condition_fires_once_when_it_turns_true_and_rearms_when_false(tmp_path, monkeypatch):
    _world(tmp_path, monkeypatch)
    free = {"v": 12}
    monkeypatch.setattr("lacuna_api.control.hands.do", lambda op, args: {"ok": True, "result": {"disk": {"free_pct": free["v"]}}})
    t = {"id": "low-disk", "cart": "disk-watch", "when": {"read": "disk", "path": "disk.free_pct", "op": "<", "value": 8}}
    assert triggers.check(t, 1000)[0] is False
    free["v"] = 7
    assert triggers.check(t, 2000)[0] is True
    triggers._state["low-disk"]["last"] = 2000
    assert triggers.check(t, 2100)[0] is False            # still true: no second firing
    free["v"] = 20
    assert triggers.check(t, 3000)[0] is False            # false again: re-armed
    free["v"] = 6
    assert triggers.check(t, 3100)[0] is True             # turned true again, past the ten-minute gap


def test_a_schedule_fires_at_its_time_once_a_day(tmp_path, monkeypatch):
    _world(tmp_path, monkeypatch)
    import time
    t = {"id": "nightly", "cart": "disk-watch", "when": {"at": "03:00"}}
    lt = time.localtime()
    at3 = time.mktime((lt.tm_year, lt.tm_mon, lt.tm_mday, 3, 0, 0, 0, 0, -1))
    assert triggers.check(t, at3 - 60)[0] is False
    assert triggers.check(t, at3 + 60)[0] is True


def test_arming_needs_a_valid_spec_and_writes_it(tmp_path, monkeypatch):
    _world(tmp_path, monkeypatch)
    assert "no cart" in triggers.valid({"id": "x1", "cart": "nope", "when": {"every": "1h"}})
    assert "at least 10m" in triggers.valid({"id": "x1", "cart": "disk-watch", "when": {"every": "1m"}})
    assert triggers.valid({"id": "x1", "cart": "disk-watch", "when": {"every": "1h"}}) is None
    triggers.arm({"id": "x1", "cart": "disk-watch", "when": {"every": "1h"}}, "owner-key")
    rows = json.loads((tmp_path / "triggers.json").read_text())["triggers"]
    assert rows[0]["enabled"] and rows[0]["armed_by"] == "owner-key"
    triggers.disarm("x1", "alfred")
    assert json.loads((tmp_path / "triggers.json").read_text())["triggers"][0]["enabled"] is False


def test_the_clock_survives_a_restart(tmp_path, monkeypatch):
    import time
    _world(tmp_path, monkeypatch)
    spec = {"id": "six-hourly", "cart": "disk-watch", "when": {"every": "6h"}}
    triggers.arm(spec, "owner-key")
    t = triggers.load()[0]
    now = time.time()
    assert triggers.check(t, now)[0] is True                       # never fired: due
    t.setdefault("history", []).append({"at": now})                # the fire, written to disk
    triggers.save([t])
    triggers._state.clear()                                        # the boot: _state is empty (a reload is order-dependent under pytest)
    t2 = triggers.load()[0]
    assert triggers.check(t2, now + 60)[0] is False                # last fire on disk: not due
    assert triggers.check(t2, now + 6 * 3600 + 1)[0] is True       # due after the interval
