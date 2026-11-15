"""Telemetry alerts are quiet: said once on the edge, cleared when the fault ends; a resumed errand is said once per boot."""
from lacuna_api.control import telemetry as t


def _quiet(monkeypatch, **over):
    base = {"sakura": lambda m=0: {"turns": 0}, "routes": lambda m=0, e=None: [], "carts": lambda h=0: {"stuck_running": []},
            "posters": lambda: {"baking": False, "log_quiet_s": 0, "remaining": 0},
            "battery_latest": lambda: {"finished": False}, "errands": lambda: {"booted": "b1", "came_back_after_boot": []}}
    base.update(over)
    for k, v in base.items():
        monkeypatch.setattr(t, k, v)


def test_sakura_fault_is_said_once_and_clears(monkeypatch):
    said, cleared, state = [], [], {}
    sick = {"turns": 6, "tool_calls": 6, "tool_errors": 4, "empty_replies": 0, "tool_errors_by_tool": {"x": 4}}
    _quiet(monkeypatch, sakura=lambda m=0: sick)
    for _ in range(3):
        t.evaluate(lambda k, *a, **kw: said.append(k), lambda k, why: cleared.append(k), state)
    assert said == ["tel:sakura"]
    _quiet(monkeypatch)
    t.evaluate(lambda k, *a, **kw: said.append(k), lambda k, why: cleared.append(k), state)
    assert cleared == ["tel:sakura"]


def test_a_few_tool_errors_in_many_turns_stay_quiet(monkeypatch):
    said, state = [], {}
    _quiet(monkeypatch, sakura=lambda m=0: {"turns": 50, "tool_calls": 45, "tool_errors": 3, "empty_replies": 0})
    t.evaluate(lambda k, *a, **kw: said.append(k), lambda k, why: None, state)
    assert said == []


def test_resumed_errand_is_announced_once_per_boot(monkeypatch):
    said, state = [], {}
    back = {"booted": "b2", "came_back_after_boot": [{"name": "posters", "goal": "bake"}]}
    _quiet(monkeypatch, errands=lambda: back)
    t.evaluate(lambda k, *a, **kw: said.append(k), lambda k, why: None, state)
    t.evaluate(lambda k, *a, **kw: said.append(k), lambda k, why: None, state)
    assert said == ["tel:resumed:b2"]


def test_strict_is_an_honest_null_naming_its_source_when_no_summary_is_there(monkeypatch, tmp_path):
    monkeypatch.setattr(t, "HONEST", tmp_path / "honest-count")
    s = t.strict()
    assert s["summaries"] == 0 and "carts" not in s
    assert s["source"].endswith("honest-count/*.summary.json")
    assert "lost 2026-10-24" in s["why"]
