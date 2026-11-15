"""The exam items run by Lacuna's jail worker classes (E5 recall-check, E7 codemap, E8 disk-steward, E9 testfix), the
battery hands (battery-last, battery-status, codemap) and the `run-battery` petition — nothing runs before the yes."""
from __future__ import annotations

import importlib
import json
import os
import subprocess
from pathlib import Path

import pytest

from lacuna_api.control import hands, home_cards


@pytest.fixture
def world(tmp_path, monkeypatch):
    monkeypatch.setenv("LACUNA_WORLD", str(tmp_path / "world"))
    monkeypatch.setenv("LACUNA_HOME", str(tmp_path / "home"))
    monkeypatch.setenv("LACUNA_NO_WORKERS", "1")
    (tmp_path / "world" / "carts").mkdir(parents=True)
    import lacuna_api.control.core as core
    importlib.reload(core)
    import lacuna_api.control.chat as chat
    importlib.reload(chat)
    from lacuna_api.control import battery, carts
    importlib.reload(battery)
    importlib.reload(chat)
    return {"path": tmp_path, "chat": chat, "carts": carts, "battery": battery}


# ── the exam's mapping ──────────────────────────────────────────────────────────────────────────────────────────────
def test_the_four_items_point_at_their_worker_classes(world):
    assert {e: c for e, (c, _) in home_cards.EXAM_WORKERS.items()} == {
        "E1": "repair", "E2": "repair", "E3": "repair", "E4": "repair", "E6": "docs",
        "E5": "recall-check", "E7": "codemap", "E8": "disk-steward", "E9": "testfix"}
    assert home_cards.EXAM_WORKERS["E1"][1]["goal"] == "narrow" and "goal" not in home_cards.EXAM_WORKERS["E3"][1]
    assert home_cards.EXAM_WORKERS["E7"][1]["path"] == "curator-api/curator_api/stores"
    assert home_cards.EXAM_WORKERS["E9"][1]["test"] == "curator-api/tests/test_shop_series_pinned.py"
    rows = {i["id"]: i for i in home_cards.exam()["items"]}
    assert rows["E8"]["class"] == "disk-steward" and rows["E10"]["class"] is None
    p = home_cards.exam_init()
    assert {r["id"]: r["class"] for r in json.loads(p.read_text())["items"]}["E9"] == "testfix"
    from lacuna_api.control import tell
    for cls, _ in home_cards.EXAM_WORKERS.values():          # the planner and the jail's foreman know every one
        assert cls in tell.CLASSES
    jail = Path(__file__).resolve().parents[2] / "lacuna-box" / "jail" / "workers"
    text = (jail / "foreman.py").read_text()
    for cls, _ in home_cards.EXAM_WORKERS.values():
        assert f'"{cls}"' in text and (jail / "classes" / f"{cls.replace('-', '_')}.py").exists()


def test_start_files_a_spawn_job_card_and_runs_nothing(world, monkeypatch):
    carts, chat = world["carts"], world["chat"]
    ran = []
    monkeypatch.setattr(subprocess, "run", lambda *a, **k: ran.append(a) or pytest.fail("nothing runs before the yes"))
    r = carts.start("8", "alfred")
    assert r["petition"] and r["exam"] == "E8" and r["cart"]["worker_class"] == "disk-steward"
    p = next(x for x in chat.petitions() if x["id"] == r["petition"])
    assert p["action"] == "spawn-job" and p["args"]["inputs"] == {"exam": "E8"}
    assert "disk-steward worker for exam E8" in p["effect"] and "your press" in p["effect"]
    assert carts.item("E8")["petition"] == r["petition"] and carts.item("E8")["state"] == "waiting"
    assert not ran


def test_the_yes_spawns_the_jail_worker_and_the_row_runs(world, monkeypatch, press):
    carts, chat = world["carts"], world["chat"]
    r = carts.start("E9", "alfred")
    seen = []

    class P:
        returncode, stdout, stderr = 0, "w-testfix-1018-120000\n", ""
    monkeypatch.setattr(subprocess, "run", lambda args, **k: seen.append(args) or P())
    out = chat.decide(r["petition"], True, "alfred", press(r["petition"], True))
    assert out["ok"] and out["petition"]["result"]["worker"] == "w-testfix-1018-120000"
    # the spawn by its words, never by its place: another thread's command can come first (P-2026-11-02-a-test-measured-the-live-disk)
    args = next(a for a in seen if a[2:4] == ["spawn", "testfix"])
    assert "--inputs" in args
    inputs = json.loads(args[args.index("--inputs") + 1])
    assert inputs["exam"] == "E9" and inputs["test"].endswith("test_shop_series_pinned.py")
    row = carts.item("E9")
    assert row["state"] == "running" and row["worker"] == "w-testfix-1018-120000"


def test_a_declined_job_card_runs_nothing(world, monkeypatch, press):
    carts, chat = world["carts"], world["chat"]
    r = carts.start("E7", "alfred")
    monkeypatch.setattr(subprocess, "run", lambda *a, **k: pytest.fail("a no runs nothing"))
    chat.decide(r["petition"], False, "alfred", press(r["petition"], False))
    assert "declined by alfred" in carts.item("E7")["said"] and carts.item("E7")["state"] == "waiting"


def test_a_spawn_job_the_code_did_not_write_is_refused(world):
    chat = world["chat"]
    assert chat.file_petition("spawn-job", None, "x", "lacuna", args={"exam": "E8", "class": "testfix"})["ok"] is False
    assert chat.file_petition("spawn-job", None, "x", "lacuna", args={"exam": "E1", "class": "docs"})["ok"] is False


def test_a_written_cart_still_wins_over_the_worker(world, monkeypatch):
    carts = world["carts"]
    (world["path"] / "world" / "carts" / "disk-steward.sks").write_text("(lacuna-cart 'disk-steward '())\n")
    from lacuna_api.control import foreman
    monkeypatch.setattr(foreman, "call", lambda *a, **k: {"ok": False, "problems": ["trial says no"]})
    r = carts.start("E8", "alfred")
    assert r["ok"] is False and r["fix_first"] == ["trial says no"]


# ── the run-battery petition ────────────────────────────────────────────────────────────────────────────────────────
def test_run_battery_is_a_petition_and_only_the_yes_starts_it(world, monkeypatch, press):
    chat, battery = world["chat"], world["battery"]
    started = []
    monkeypatch.setattr(battery, "start_true_state", lambda who: started.append(who) or {"ok": True, "run": "20261018-120000"})
    r = chat.file_petition("run-battery", None, "the morning's reds", "lacuna")
    assert r["ok"] and "True State battery" in r["if_approved"] and not started
    out = chat.decide(r["petition"], True, "alfred", press(r["petition"], True))
    assert started == ["alfred"] and out["petition"]["result"]["run"] == "20261018-120000"
    assert "run-battery" in chat.TOOLS["petition"]._tool["props"]["action"]["enum"]


def test_start_true_state_answers_the_new_run_id(world, monkeypatch, tmp_path):
    battery = world["battery"]
    repo = tmp_path / "curator"
    (repo / "tools" / "battery").mkdir(parents=True)
    runs = repo / "scratch" / "battery" / "true-state"
    script = repo / "tools" / "battery" / "true-state.sh"
    script.write_text(f'#!/bin/bash\nmkdir -p "{runs}/20261018-120000"\nsleep 1\n')
    monkeypatch.setattr(battery, "TRUE_STATE_SH", script)
    monkeypatch.setattr(battery, "TRUE_STATE_RUNS", runs)
    monkeypatch.setattr(battery, "REPO", repo)
    monkeypatch.setattr(battery, "STARTED", tmp_path / "started.jsonl")
    monkeypatch.setattr(hands, "TRUE_STATE", runs)
    r = battery.start_true_state("alfred", wait_s=10)
    assert r["ok"] and r["run"] == "20261018-120000", r
    rec = json.loads((tmp_path / "started.jsonl").read_text().splitlines()[-1])
    assert rec["run"] == "20261018-120000" and rec["pid"]


# ── the battery hands ───────────────────────────────────────────────────────────────────────────────────────────────
REPORT = """# true-state battery — RED · 1/2 acts green

| act | verdict |
|---|---|

## What went red

- **counts-ui** — etsy · Info · 1376: active key 296 ≠ stateCounts 588
- **shops** — etsy · Info · 1194: the room is not in the card's menu

## Next
"""


def make_runs(root: Path) -> None:
    done = root / "20261018-030729"
    (done / "shots").mkdir(parents=True)
    (done / "shots" / "1194x834-etsy-info.png").write_bytes(b"png")
    (done / "verdict.json").write_text(json.dumps({"pass": False, "acts": {"counts-ui": "red", "shops": "red", "reads": "green"}}))
    (done / "report.md").write_text(REPORT)
    (root / "20261018-090000").mkdir()                       # a newer one, still going (no verdict)


def test_battery_last_reads_the_latest_verdict_reds_and_shots(tmp_path, monkeypatch):
    make_runs(tmp_path)
    monkeypatch.setattr(hands, "TRUE_STATE", tmp_path)
    monkeypatch.setattr(hands, "STARTED", tmp_path / "none.jsonl")
    r = hands.do("battery-last", [])
    assert r["ok"]
    got = r["result"]
    assert got["run"] == "20261018-030729" and got["pass"] is False and got["acts"]["shops"] == "red"
    assert got["reds"] == ["counts-ui — etsy · Info · 1376: active key 296 ≠ stateCounts 588",
                           "shops — etsy · Info · 1194: the room is not in the card's menu"]
    assert got["shots"] == [str(tmp_path / "20261018-030729" / "shots" / "1194x834-etsy-info.png")]
    assert got["newer"]["run"] == "20261018-090000" and got["newer"]["done"] is False and got["newer"]["running"] is True


def test_battery_status_running_then_done_and_refuses_a_path(tmp_path, monkeypatch):
    make_runs(tmp_path)
    monkeypatch.setattr(hands, "TRUE_STATE", tmp_path)
    started = tmp_path / "started.jsonl"
    started.write_text(json.dumps({"run": "20261018-090000", "pid": 2 ** 22 + 12345}) + "\n")   # no such process
    monkeypatch.setattr(hands, "STARTED", started)
    r = hands.do("battery-status", ["20261018-090000"])["result"]
    assert r["done"] is False and r["running"] is False and "stopped without a verdict" in r["note"]
    started.write_text(json.dumps({"run": "20261018-090000", "pid": os.getpid()}) + "\n")
    assert hands.do("battery-status", ["20261018-090000"])["result"]["running"] is True
    r = hands.do("battery-status", ["20261018-030729"])["result"]
    assert r["done"] and len(r["reds"]) == 2 and r["shot_count"] == 1
    for bad in ("../x", "20261018-030729/../../etc", ""):
        assert hands.do("battery-status", [bad])["ok"] is False
    assert hands.do("battery-status", ["20991231-000000"])["ok"] is False


def test_codemap_hand_reads_a_packages_map_by_name(tmp_path, monkeypatch):
    home = tmp_path
    repo = home / "code" / "curator"
    (repo / "curator-api" / "curator_api" / "stores").mkdir(parents=True)
    subprocess.run(["git", "init", "-q", str(repo)], check=True)
    (repo / "curator-api" / "curator_api" / "stores" / "CODEMAP.md").write_text("# Codemap — stores\n")
    subprocess.run(["git", "-C", str(repo), "add", "."], check=True)
    (home / "lacuna-world" / "worktrees").mkdir(parents=True)
    monkeypatch.setattr(hands, "HOME", home)
    r = hands.do("codemap", ["stores"])
    assert r["ok"] and r["result"]["where"] == "dev" and r["result"]["text"].startswith("# Codemap")
    assert hands.do("codemap", ["control"])["ok"] is False
    assert hands.do("codemap", ["../../etc"])["ok"] is False
