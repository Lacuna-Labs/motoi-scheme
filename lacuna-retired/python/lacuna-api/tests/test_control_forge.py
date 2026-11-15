"""THE FORGE CARD (LACUNA-1.3-DESIGN §40–§41): the reader tolerates a forge still forming; every verb is a permission
card; a propose's yes is recorded; the watcher opens the card once per training start and once per finished eval."""
from __future__ import annotations

import json
import time

import pytest

from lacuna_api.control import chat, forge, forge_verbs, home


@pytest.fixture(autouse=True)
def fresh_modules(monkeypatch):
    """The app_client fixture re-imports lacuna_api: use the modules that are live NOW, so a patch here is the one the
    code under test sees (a stale copy's petitions store is not the one forge.waiting reads)."""
    import importlib
    import sys
    for n in ("chat", "forge", "forge_verbs", "home"):
        monkeypatch.setattr(sys.modules[__name__], n, importlib.import_module(f"lacuna_api.control.{n}"))


@pytest.fixture
def world(tmp_path, monkeypatch):
    w = tmp_path / "w"
    monkeypatch.setenv("LACUNA_WORLD", str(w))
    monkeypatch.setenv("LACUNA_HOME", str(tmp_path / "lh"))
    (tmp_path / "lh").mkdir()
    monkeypatch.setattr(chat, "_petitions", {})
    monkeypatch.setattr(chat, "PETITIONS", tmp_path / "lh" / "petitions.json")
    return w


def _job(world, name, state="on", pid=None, progress=None, log=None, started=None):
    d = world / "jobs" / name
    d.mkdir(parents=True, exist_ok=True)
    (d / "job.json").write_text(json.dumps({"name": name, "state": state, "run": "python forge_sft.py --lora"}))
    (d / ".runner.json").write_text(json.dumps({"pid": pid, "started": started or time.time() - 120}))
    if progress is not None:
        (d / "progress.json").write_text(json.dumps(progress))
    if log is not None:
        (d / "run.log").write_text(log)


def _result(world, name, doc):
    d = world / "forge" / "results"
    d.mkdir(parents=True, exist_ok=True)
    (d / name).write_text(json.dumps(doc))


SFT_LOG = """training sentry: base gemma-3-270m-it, lora
Iter 1: Val loss 3.100, Val took 1.2s
Iter 10: Train loss 2.900, Learning Rate 1.000e-05, It/sec 3.1, Tokens/sec 900, Trained Tokens 1200, Peak mem 1.40 GB
Iter 20: Train loss 2.100, Learning Rate 1.000e-05, It/sec 3.1, Tokens/sec 900, Trained Tokens 2400, Peak mem 1.62 GB
swap used: 512 MB
"""


# ── the reader ─────────────────────────────────────────────────────────────────────────────────────────────────────
def test_nothing_there_yet_is_a_calm_card(world):
    s = forge.summary()
    assert s["present"] is False and s["started"] is False
    assert [r["state"] for r in s["specialists"]] == ["not started", "not started", "later"]
    assert s["now"].startswith("Idle")


def test_torn_files_never_take_the_card_down(world):
    _job(world, "forge-pairs-w1", progress=None)
    (world / "jobs" / "forge-pairs-w1" / "progress.json").write_text('{"kept": 3')
    _result(world, "torn.json", {})
    (world / "forge" / "results" / "torn.json").write_text("{")
    s = forge.summary()
    assert s["specialists"][0]["pairs"]["present"] is True and s["specialists"][0]["pairs"]["kept"] is None


def test_pairs_from_progress_with_drops_by_check(world):
    _job(world, "forge-pairs-w1", pid=123, progress={"done": 120, "kept": 100, "dropped": 20,
                                                      "dropped_by": {"three-of-three": 15, "traceback-never-noise": 5}})
    row = forge.summary()["specialists"][0]
    p = row["pairs"]
    assert (p["written"], p["kept"], p["dropped"]) == (120, 100, 20)
    assert p["dropped_by"] == {"three-of-three": 15, "traceback-never-noise": 5}
    assert row["state"] == "writing pairs" and "Writing Sentry's training pairs — 100 kept" in forge.summary()["now"]


def test_pairs_from_files_when_no_progress(world):
    d = world / "forge" / "pairs" / "w2-worker"
    d.mkdir(parents=True)
    (d / "kept.jsonl").write_text('{"a":1}\n{"a":2}\n{"a":3}\n')
    (d / "dropped.jsonl").write_text('{"check":"grammar"}\n{"check":"trial"}\n{"check":"grammar"}\nnot json\n')
    p = forge.summary()["specialists"][1]["pairs"]
    assert (p["kept"], p["dropped"], p["written"]) == (3, 3, 6) and p["dropped_by"] == {"grammar": 2, "trial": 1}


def test_training_reads_mlx_lines_from_a_shared_log(world):
    _job(world, "forge-sft", pid=99, log=SFT_LOG)
    s = forge.summary()
    t = s["specialists"][0]["train"]
    assert t["running"] and t["loss"] == [[10, 2.9], [20, 2.1]] and t["val"] == [[1, 3.1]]
    assert (t["peak_mem_gb"], t["swap_gb"], t["base"], t["method"]) == (1.62, 0.5, "gemma-3-270m-it", "lora")
    assert s["specialists"][1]["train"]["running"] is False             # the shared errand trains one at a time
    assert s["now"].startswith("Training Sentry (gemma-3-270m-it, LORA) — step 20, loss 2.100")


def test_result_shapes_and_the_beats_law(world):
    _result(world, "sentry-result.json", {"specialist": "sentry", "set": "w1-held-out", "model": "~/models/sentry-270m",
                                          "trained": {"accuracy": 0.91, "latency_ms": 40}, "untrained": {"accuracy": 58, "latency": 0.05}})
    _result(world, "both.json", {"worker": {"after": {"accuracy": 0.5}, "before": {"accuracy": 0.6}}})
    rows = forge.summary()["specialists"]
    assert rows[0]["state"] == "wins" and rows[0]["eval"]["before"] == {"accuracy": 0.58, "latency_ms": 50.0, "n": None}
    assert rows[0]["model"] == "~/models/sentry-270m"
    assert rows[1]["state"] == "loses" and rows[1]["beats"] is False


# ── the verbs: every start is a permission card ─────────────────────────────────────────────────────────────────────
def test_a_verb_without_its_errand_files_nothing(world):
    r = forge_verbs.petition("train", "sentry", "alfred")
    assert r["ok"] is False and "no forge errand" in r["refused"] and chat.petitions() == []


def test_train_files_a_card_and_the_yes_resumes_the_errand(world, monkeypatch, press):
    _job(world, "forge-sft", state="stopped")
    calls = []
    monkeypatch.setattr(forge_verbs, "_errand", lambda cmd, name: calls.append((cmd, name)) or {"ok": True, "said": "on"})
    r = forge_verbs.petition("forge-train", "w1", "alfred")
    assert r["petition"] and "TRAINS Sentry" in r["if_approved"] and calls == []           # nothing ran before the yes
    # 2026-10-20: a waiting card lights the inbox (GET /api/petitions); it no longer lands on the desk board as a "may I?" card
    assert not [c for c in home.board()["cards"] if c["id"] == f"contract-{r['petition']}"]
    assert next(q for q in chat.petitions() if q["id"] == r["petition"])["state"] == "waiting"
    out = chat.decide(r["petition"], True, "alfred", press(r["petition"], True))
    assert out["ok"] and calls == [("resume", "forge-sft")]


def test_train_refuses_while_another_trains(world, monkeypatch):
    _job(world, "forge-sft", pid=7, log=SFT_LOG)
    monkeypatch.setattr(forge_verbs, "_errand", lambda cmd, name: pytest.fail("must not resume"))
    r = forge_verbs.decided("forge-train", {"errand": "forge-sft", "specialist": "worker"}, True, "alfred")
    assert r["ok"] is False and "one training at a time" in r["said"]


def test_propose_only_a_winner_and_the_decision_is_recorded(world, press):
    _result(world, "w2.json", {"specialist": "worker", "after": {"accuracy": 0.5}, "before": {"accuracy": 0.6}})
    assert "does not beat" in forge_verbs.petition("propose", "worker", "alfred")["refused"]
    _result(world, "w1.json", {"specialist": "sentry", "model": "sentry-270m-lora", "set": "w1-held-out",
                               "after": {"accuracy": 0.9, "latency_ms": 30}, "before": {"accuracy": 0.6, "latency_ms": 35}})
    r = forge_verbs.petition("propose", "sentry", "alfred")
    assert "puts sentry-270m-lora in service as Sentry's mind" in r["if_approved"] and "60% → 90%" in r["if_approved"]
    assert forge.summary()["specialists"][0]["state"] == "your press"
    chat.decide(r["petition"], True, "alfred", press(r["petition"], True))
    d = forge.decisions()[-1]
    assert (d["specialist"], d["model"], d["approved"], d["applied"]) == ("sentry", "sentry-270m-lora", True, False)
    assert forge.summary()["specialists"][0]["state"] == "in service (decided)"


def test_stop_stops_every_forge_errand_that_is_on(world, monkeypatch):
    _job(world, "forge-sft", pid=7)
    _job(world, "forge-pairs-w2", state="done")
    calls = []
    monkeypatch.setattr(forge_verbs, "_errand", lambda cmd, name: calls.append((cmd, name)) or {"ok": True, "said": "stopped"})
    assert "stopped forge-sft" in forge_verbs.tool({"op": "stop"}, "alfred") and calls == [("stop", "forge-sft")]


def test_the_chat_knows_the_forge_tool(world):
    assert "forge" in chat.TOOLS and "forge" in chat.pick_tools("stop the forge")
    assert chat.call_tool("forge", {"op": "status"}, "alfred").startswith("Idle")
    assert chat.call_tool("forge", {"op": "teach"}, "alfred")["refused"]


# ── "open it for me": once per training start, once per finished eval ─────────────────────────────────────────────────
def test_the_card_opens_once_on_a_training_start_and_once_per_result(world):
    assert forge_verbs.section() == []                                   # first look, nothing happening
    _job(world, "forge-sft", pid=7, log=SFT_LOG, started=1000.0)
    assert forge_verbs.section() == ["Started training Sentry (gemma-3-270m-it, LORA)."]
    b = home.board()
    assert b["said"][-1].startswith("Started training Sentry") and b.get("focus") != "s-forge-sentry"   # said, never pulls his screen (2026-10-20)
    note = [c for c in b["cards"] if c["id"].startswith("fm-sentry-")]
    assert len(note) == 1 and note[0]["links"] == ["s-forge-sentry"] and note[0]["block"]["lines"][0].startswith("Started")
    assert forge_verbs.section() == []                                   # said once
    _result(world, "w1.json", {"specialist": "sentry", "after": {"accuracy": 0.9}, "before": {"accuracy": 0.6}})
    said = forge_verbs.section()
    assert len(said) == 1 and said[0].startswith("Evaluated Sentry — the held-out set: accuracy 60% → 90%")
    assert forge_verbs.section() == []


def test_a_result_already_there_at_the_first_look_is_old_news(world):
    _result(world, "w1.json", {"specialist": "sentry", "after": {"accuracy": 0.9}, "before": {"accuracy": 0.6}})
    assert forge_verbs.section() == []


def test_the_forge_is_one_app_its_tasks_are_rooms():
    assert home.STANDING.index("s-forge") + 1 == 2 and not any(s.startswith("s-forge-") for s in home.STANDING)


def test_a_test_can_never_write_the_live_lacuna():
    """The guard (conftest.never_the_live_lacuna): the forge's petitions once reached the live audit as alfred's."""
    from pathlib import Path
    import conftest
    with pytest.raises(conftest.LiveLacunaWrite):
        open(Path.home() / ".lacuna" / "audit.jsonl", "a")
    with pytest.raises(conftest.LiveLacunaWrite):
        (Path.home() / ".lacuna" / "petitions.json").write_text("{}")


# ── the forge's real layout (2026-10-18: data/w1|w2, runs/<model>-<job>/train.log, results/<model>-<job>.json) ──────────
def test_the_real_layout_pairs_training_and_result(world):
    w1, w2 = world / "forge" / "data" / "w1", world / "forge" / "data" / "w2"
    w1.mkdir(parents=True), w2.mkdir(parents=True)
    (w1 / "candidates.jsonl").write_text('{"id": "c1"}\n')
    (w1 / "votes.jsonl").write_text("\n".join(json.dumps(r) for r in [
        {"id": "a", "label": "noise", "why": "3/3 + hard rules"}, {"id": "b", "label": "real-error", "why": "3/3 + hard rules"},
        {"id": "c", "label": None, "why": "split: noise, new"}, {"id": "d", "label": None, "why": "hard rule: a traceback is never noise"}]) + "\n")
    (w2 / "targets.jsonl").write_text('{"id": "t1", "answer": {"name": "report"}, "why": "ok"}\n{"id": "t2", "answer": null, "why": "type; arg"}\n')
    _job(world, "forge-sft", pid=5, log="06:18:22 waiting: functiongemma-270m-it-w2 waits for the w2 pairs\n")
    run = world / "forge" / "runs" / "gemma-3-270m-it-w1"
    run.mkdir(parents=True)
    (run / "train.log").write_text("06:30:00 pilot full: step 10/60 loss 3.0000 4 s swap 0.4 GB\n"
                                   "06:31:00 pilot lora: step 10/60 loss 2.9000 4 s swap 0.4 GB\n06:31:30 chose lora ({'full': 2.8, 'lora': 2.7})\n"
                                   "06:32:00 step 10/400 loss 2.5000 5 s swap 0.6 GB\n06:33:00 step 20/400 loss 2.1000 9 s swap 0.7 GB\n")
    rows = forge.summary()["specialists"]
    s, wk = rows[0], rows[1]
    assert (s["pairs"]["kept"], s["pairs"]["written"], s["pairs"]["dropped"]) == (2, 4, 2)
    assert s["pairs"]["dropped_by"] == {"split": 1, "hard rule": 1}
    assert (wk["pairs"]["kept"], wk["pairs"]["dropped_by"]) == (1, {"type": 1})
    t = s["train"]
    assert t["running"] and t["loss"] == [[10, 2.5], [20, 2.1]] and (t["total"], t["method"], t["base"]) == (400, "lora", "gemma-3-270m-it")
    assert wk["train"]["running"] is False and wk["train"]["base"] is None and rows[2]["state"] == "later"
    (w1 / "DONE").write_text('{"kept": 1800, "train": 1620, "test": 180}')
    _result(world, "gemma-3-270m-it-w1.json", {"model": "gemma-3-270m-it", "job": "w1", "mode": "lora", "steps": 400, "held_out": 180,
                                               "untrained": {"n": 180, "accuracy": 0.41}, "trained": {"n": 180, "accuracy": 0.87},
                                               "wins": True, "gguf": "/x/trained/gemma-3-270m-it-w1.gguf"})
    s = forge.summary()["specialists"][0]
    assert s["pairs"]["kept"] == 1800 and s["beats"] is True and s["model"].endswith("w1.gguf")
    assert s["eval"]["set"] == "180 held-out pairs" and forge_verbs.numbers(s["eval"]).startswith("180 held-out pairs: accuracy 41% → 87%")


def test_progress_notes_come_out_of_their_task_at_most_every_five_minutes(world, monkeypatch):
    _job(world, "forge-pairs-w2", pid=3, progress={"done": 5, "total": 193, "note": "pass A: commands written (b-stop-1)"})
    assert forge_verbs.section() == ["Worker's pairs: 0 kept — pass A: commands written (b-stop-1)"]
    (world / "jobs" / "forge-pairs-w2" / "progress.json").write_text(json.dumps({"note": "pass A: commands written (b-run-1)"}))
    assert forge_verbs.section() == []                                   # within five minutes: no second message
    monkeypatch.setattr(forge_verbs, "NOTE_EVERY_S", 0)
    assert forge_verbs.section() == ["Worker's pairs: 0 kept — pass A: commands written (b-run-1)"]
    cards = [c for c in home.board()["cards"] if c["id"].startswith("fm-worker-")]
    assert len(cards) == 2 and all(c["links"] == ["s-forge-worker"] for c in cards) and home.board().get("focus") is None
    monkeypatch.setattr(forge_verbs, "KEEP_MESSAGES", 1)
    forge_verbs._message("s-forge-worker", "one more")
    assert [c["block"]["lines"] for c in home.board()["cards"] if c["id"].startswith("fm-worker-")] == [["one more"]]


def test_a_trainer_that_only_waits_trains_nobody(world):
    """Seen live 2026-10-18 06:31: forge-sft was running its wait loop ("waits for the w1 pairs") and the card said
    "training Sentry" and opened itself. Waiting is not training; a run log being written is."""
    _job(world, "forge-sft", pid=9, log="06:18:22 waiting: functiongemma-270m-it-w2 waits for the w2 pairs (data/w2/DONE); "
                                       "gemma-3-270m-it-w1 waits for the w1 pairs (data/w1/DONE)\n")
    assert [r["train"]["running"] for r in forge.summary()["specialists"]] == [False, False, False]
    assert forge_verbs.section() == []


def test_a_three_yardstick_result_is_read_gold_first(tmp_path):
    from lacuna_api.control import forge_results as R
    side = R._side({"gold": {"n": 39, "accuracy": 0.6923}, "held_out": {"n": 56, "accuracy": 0.7143}, "owner": "not filled yet"})
    assert side["accuracy"] == 0.6923 and side["yardstick"] == "gold"
