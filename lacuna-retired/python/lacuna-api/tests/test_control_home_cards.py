"""The desk's AGENTS and EXAM cards (LACUNA-1.3-DESIGN §36–§37.1): tolerant reads of files other jobs are still writing."""
from __future__ import annotations

import json

import pytest

from lacuna_api.control import home, home_cards


@pytest.fixture
def world(tmp_path, monkeypatch):
    monkeypatch.setenv("LACUNA_WORLD", str(tmp_path))
    monkeypatch.setattr(home_cards, "running_minds", lambda: {"reported": False, "names": []})
    return tmp_path


def _tiers(world, doc):
    p = world / "bench" / "agents" / "tiers.json"
    p.parent.mkdir(parents=True, exist_ok=True)
    p.write_text(json.dumps(doc))


def test_agents_benching_when_no_tiers(world):
    a = home_cards.agents()
    assert a["state"] == "benching" and a["rows"] == []


def test_agents_reads_a_list_of_rows_with_missing_fields(world):
    _tiers(world, {"minds": [{"model": "gemma3:270m", "job": "signal->label", "score": "19/20", "ms": 420,
                              "failures": [{"signal": "vite: hmr", "right": "noise", "got": "new-thing"}]},
                             {"mind": "gemma3:1b"}]})
    rows = home_cards.agents()["rows"]
    small = next(r for r in rows if r["mind"] == "gemma3:270m")
    assert small["score"] == "19/20" and small["seconds"] == 0.42 and small["failures"][0]["got"] == "new-thing"
    bare = next(r for r in rows if r["mind"] == "gemma3:1b")
    assert bare["score"] == "—" and bare["seconds"] is None and bare["failures"] == []


def test_agents_reads_rows_keyed_by_job(world, monkeypatch):
    _tiers(world, {"updated": "2026-10-18T09:00", "jobs": {"command->verb": {"model": "functiongemma", "score": 0.9, "seconds": 1.2,
                                                                             "served_by": "llama.cpp"}}})
    monkeypatch.setattr(home_cards, "running_minds", lambda: {"reported": True, "names": ["functiongemma"]})
    a = home_cards.agents()
    r = a["rows"][0]
    assert (r["job"], r["score"], r["served_by"], r["running"]) == ("command->verb", "90%", "llama.cpp", True)
    assert a["updated"] == "2026-10-18T09:00"


def test_agents_survives_a_torn_file(world):
    p = world / "bench" / "agents" / "tiers.json"
    p.parent.mkdir(parents=True)
    p.write_text('{"minds": [')
    assert home_cards.agents()["state"] == "benching"


def test_running_minds_tolerates_no_answer(monkeypatch):
    monkeypatch.setattr(home_cards, "MINDS_URL", "http://127.0.0.1:9/lacuna/minds")
    assert home_cards.running_minds() == {"reported": False, "names": []}


def test_exam_init_writes_ten_waiting_items_once(world):
    p = home_cards.exam_init()
    doc = json.loads(p.read_text())
    assert [i["id"] for i in doc["items"]] == [f"E{n}" for n in range(1, 11)]
    assert {i["state"] for i in doc["items"]} == {"waiting"} and doc["started"] is None
    doc["items"][0]["state"] = "press"
    p.write_text(json.dumps(doc))
    home_cards.exam_init()
    assert json.loads(p.read_text())["items"][0]["state"] == "press"


def test_exam_scores_press_and_done(world):
    p = home_cards.exam_init()
    doc = json.loads(p.read_text())
    doc["items"][0].update(state="press", minutes=12.5, brain_seconds=40, petition="p123")
    doc["items"][4].update(state="done", minutes=3)
    doc["items"][7].update(state="bogus")
    doc["items"] = doc["items"][:9]                   # E10 missing: it still shows, waiting
    p.write_text(json.dumps(doc))
    e = home_cards.exam()
    assert (e["press"], e["done"], e["passed"], e["minutes"], e["brain_seconds"]) == (1, 1, 2, 15.5, 40)
    assert e["items"][0]["petition"] == "p123" and e["items"][7]["state"] == "waiting" and e["items"][9]["id"] == "E10"


def test_exam_absent_shows_all_ten_waiting(world):
    e = home_cards.exam()
    assert not e["present"] and len(e["items"]) == 10 and e["passed"] == 0


def test_the_desk_is_apps_lacuna_first():
    assert home.STANDING[0] == "s-lacuna" and home.STANDING.index("s-forge") + 1 == 2 and home.STANDING.index("s-exam") + 1 == 7
    assert {"s-caliper", "s-telemetry"} <= set(home.STANDING) and "s-ipad" not in home.STANDING


def test_telemetry_lists_customers_from_data_never_a_name_in_code(world, monkeypatch, tmp_path):
    monkeypatch.setenv("LACUNA_HOME", str(tmp_path))
    h = {"apis": {"dev": {"label": "dev API", "up": True}, "qa": {"label": "the customer's server", "up": True, "healthz": {"version": "2.1", "sha": "abc"}}}}
    rows = home.customers(h, {"device": "D1"})
    assert [(r["id"], r["label"], r["up"], r["version"], r["device"]) for r in rows] == [("qa", "the customer's server", True, "2.1", {"device": "D1"})]
    (tmp_path / "customers.json").write_text('[{"id": "c1", "label": "Shop One", "api": "qa"}]')
    assert [(r["id"], r["label"], r["sha"]) for r in home.customers(h, {})] == [("c1", "Shop One", "abc")]


def test_caliper_reads_reports_acts_and_scenarios(monkeypatch, tmp_path):
    from lacuna_api.control import caliper
    (tmp_path / "r" / "caliper-reports").mkdir(parents=True)
    (tmp_path / "r" / "caliper-reports" / "caliper-report.json").write_text(
        '{"score": 833, "grade": "B", "ran_at": "2026-06-22", "categories": {"lint": {"score": 29, "max": 50, "reason": "warns=21"}}}')
    (tmp_path / "b" / "20261018-030729").mkdir(parents=True)
    (tmp_path / "b" / "20261018-030729" / "act-caliper.json").write_text('{"status": "green", "numbers": {"squares": 224}}')
    (tmp_path / "c" / "scenarios").mkdir(parents=True)
    (tmp_path / "c" / "scenarios" / "smoke.ts").write_text("")
    monkeypatch.setenv("LACUNA_CALIPER_ROOTS", f"reports={tmp_path / 'r'};battery={tmp_path / 'b'};caliper={tmp_path / 'c'}")
    s = caliper.summary()
    assert s["reports"][0]["score"] == 833 and s["reports"][0]["categories"][0] == {"name": "lint", "score": 29, "max": 50, "reason": "warns=21"}
    assert s["acts"] == [{"run": "20261018-030729", "status": "green", "numbers": {"squares": 224}, "reds": []}]
    assert s["scenarios"] == ["scenarios/smoke.ts"]
