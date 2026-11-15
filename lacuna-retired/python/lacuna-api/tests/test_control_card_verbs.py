"""The lead's owed press verbs (lane L2, 2026-10-24; card_verbs.py): watchdog-kick, run-battery {act}, drill, kick-run, sit-exam,
leave-shadow. For each: the petition is filed and nothing runs; the owner's press runs the right thing once; a decline runs
nothing; a bad arg is one sentence and is not filed. Nothing here touches ~/lacuna-world or ~/.lacuna (LACUNA_HOME and
LACUNA_EXAM_DIR point at tmp; the foreman, the dev API, the drill module and the exam runner are stand-ins)."""
from __future__ import annotations

import importlib
import json

import pytest


@pytest.fixture
def lead(tmp_path, monkeypatch):
    monkeypatch.setenv("LACUNA_WORLD", str(tmp_path / "world"))
    monkeypatch.setenv("LACUNA_HOME", str(tmp_path / "home"))
    monkeypatch.setenv("LACUNA_NO_WORKERS", "1")
    monkeypatch.setenv("LACUNA_EXAM_DIR", str(tmp_path / "exam"))
    import lacuna_api.control.core as core
    importlib.reload(core)
    import lacuna_api.control.chat as chat
    importlib.reload(chat)
    from lacuna_api.control import battery, card_verbs, foreman
    importlib.reload(battery)
    importlib.reload(chat)
    monkeypatch.setattr(card_verbs, "background", lambda fn: fn())     # the drill's thread, run in line so the test sees it
    monkeypatch.setattr(chat, "_after_press", lambda p, pid, approve: None)   # no queue tick after the press: it would outlive the test
    calls = []
    monkeypatch.setattr(foreman, "call", lambda m, p, b=None, timeout=10: calls.append((m, p, b)) or FOREMAN.get((m, p), {"ok": True}))
    return {"chat": chat, "battery": battery, "verbs": card_verbs, "foreman": foreman, "calls": calls, "tmp": tmp_path}


FOREMAN: dict = {}


def _sent(lead):
    """What the verbs asked the foreman (the press's own queue tick reads GET /workers beside it: not a verb's call)."""
    return [c for c in lead["calls"] if c[:2] != ("GET", "/workers")]


def _file_and_press(lead, press, action, args, approve=True):
    chat = lead["chat"]
    r = chat.file_petition(action, None, "from the card", "eval:card-verbs", args=args)
    assert r["ok"] and r["petition"], r
    out = chat.decide(r["petition"], approve, "alfred", press(r["petition"], approve))
    return r, out["petition"]


# ── watchdog-kick ───────────────────────────────────────────────────────────────────────────────────────────────────
def test_watchdog_kick_files_then_kicks_one_dev_dog_once(lead, press, monkeypatch):
    from lacuna_api.control import api
    kicked = []
    monkeypatch.setattr(api, "watchdog_kick", lambda name, who=None: kicked.append(name) or {"ok": True, "said": f"kicked: {name} is ok"})
    r = lead["chat"].file_petition("watchdog-kick", None, "kick", "eval:card-verbs", args={"name": "watch.mock.ebay"})
    assert r["ok"] and "kicks the dev watchdog mock.ebay once" in r["if_approved"] and "QA" in r["if_approved"] and not kicked
    out = lead["chat"].decide(r["petition"], True, "alfred", press(r["petition"], True))
    assert kicked == ["mock.ebay"] and out["petition"]["result"]["said"] == "kicked: mock.ebay is ok"


def test_watchdog_kick_refuses_a_bad_name_and_a_decline_runs_nothing(lead, press, monkeypatch):
    from lacuna_api.control import api
    kicked = []
    monkeypatch.setattr(api, "watchdog_kick", lambda name, who=None: kicked.append(name) or {"ok": True})
    r = lead["chat"].file_petition("watchdog-kick", None, "kick", "eval:card-verbs", args={"name": "../../etc"})
    assert r == {"ok": False, "refused": r["refused"]} and ". " not in r["refused"] and "dev watchdog" in r["refused"]
    _, p = _file_and_press(lead, press, "watchdog-kick", {"name": "watch.mock.ebay"}, approve=False)
    assert p["state"] == "declined" and kicked == []


# ── run-battery {act} ───────────────────────────────────────────────────────────────────────────────────────────────
def test_run_battery_with_an_act_runs_that_act_alone(lead, press, monkeypatch):
    started = []
    monkeypatch.setattr(lead["battery"], "start_true_state", lambda who, acts=None: started.append((who, acts)) or {"ok": True, "run": "r1"})
    r = lead["chat"].file_petition("run-battery", None, "one act", "eval:card-verbs", args={"act": "counts-api"})
    assert r["ok"] and "ONE act only: counts" in r["if_approved"] and not started
    lead["chat"].decide(r["petition"], True, "alfred", press(r["petition"], True))
    assert started == [("alfred", "counts")]


def test_run_battery_refuses_a_webkit_act_and_without_an_act_runs_the_whole_battery(lead, press, monkeypatch):
    started = []
    monkeypatch.setattr(lead["battery"], "start_true_state", lambda who, acts=None: started.append(acts) or {"ok": True})
    r = lead["chat"].file_petition("run-battery", None, "one act", "eval:card-verbs", args={"act": "transfer-ui"})
    assert r["ok"] is False and "WebKit act runs only with the whole battery" in r["refused"]
    _file_and_press(lead, press, "run-battery", None)
    assert started == [None]


def test_start_true_state_passes_the_act_to_the_script(lead, monkeypatch, tmp_path):
    battery = lead["battery"]
    seen = {}
    monkeypatch.setattr(battery, "TRUE_STATE_SH", tmp_path / "true-state.sh")
    (tmp_path / "true-state.sh").write_text("#!/bin/bash\n")
    monkeypatch.setattr(battery, "TRUE_STATE_RUNS", tmp_path / "runs")
    monkeypatch.setattr(battery, "STARTED", tmp_path / "started.jsonl")

    class Job:
        id, pid, log, code = "j1", 1, tmp_path / "log", 0
    monkeypatch.setattr(battery, "start_job", lambda kind, title, cmd, who, cwd=None, env=None: seen.update(env=env, title=title) or Job())
    battery.start_true_state("alfred", wait_s=0.1, acts="matrix")
    assert seen["env"] == {"ACTS": "matrix", "UI": "0"} and "matrix alone" in seen["title"]
    assert battery.start_true_state("alfred", acts="reads")["ok"] is False


# ── drill ───────────────────────────────────────────────────────────────────────────────────────────────────────────
def test_drill_files_then_drills_once_on_the_press(lead, press, monkeypatch):
    from lacuna_api.control import drill
    ran = []
    monkeypatch.setattr(drill, "running", lambda: {})
    monkeypatch.setattr(drill, "drill", lambda kind, name, who, alerts_fn=None, raise_alert=None: ran.append((kind, name, who)) or {"ok": True})
    r = lead["chat"].file_petition("drill", None, "drill", "eval:card-verbs", args={"kind": "kill", "name": "dev-api"})
    assert r["ok"] and "SIGKILL to its process on :5051" in r["if_approved"] and not ran
    out = lead["chat"].decide(r["petition"], True, "alfred", press(r["petition"], True))
    assert ran == [("kill", "dev-api", "alfred")] and out["petition"]["result"]["started"] == "kill dev-api"


def test_drill_refuses_the_customer_side_lacuna_a_bad_kind_and_a_second_drill(lead, press, monkeypatch):
    from lacuna_api.control import drill
    ran = []
    monkeypatch.setattr(drill, "drill", lambda *a, **k: ran.append(a) or {"ok": True})
    for args, word in (({"kind": "kill", "name": "qa-api"}, "customer's side"), ({"kind": "kill", "name": "lacuna"}, "CLI"),
                       ({"kind": "nuke", "name": "dev-api"}, "kill · bootout"), ({"kind": "kill", "name": "tunnel"}, "her doors"),
                       ({"kind": "bootout", "name": "foreman"}, "not on its list")):
        r = lead["chat"].file_petition("drill", None, "drill", "eval:card-verbs", args=args)
        assert r["ok"] is False and word in r["refused"], r
    monkeypatch.setattr(drill, "running", lambda: {"kind": "bootout", "service": "foreman"})
    _, p = _file_and_press(lead, press, "drill", {"kind": "kill", "name": "dev-api"})
    assert p["result"] == {"ok": False, "why": "a drill is already running: bootout foreman"} and ran == []


def test_the_bare_drill_route_answers_403_naming_the_petition(lead):
    from fastapi import HTTPException
    from lacuna_api.control import api
    with pytest.raises(HTTPException) as e:
        api.drills_run("kill", "dev-api")
    assert e.value.status_code == 403 and "petition `drill`" in e.value.detail["why"]


# ── kick-run ────────────────────────────────────────────────────────────────────────────────────────────────────────
def test_kick_run_sends_the_held_would_kick_once(lead, press, monkeypatch):
    FOREMAN[("GET", "/sentry")] = {"ok": True, "runs": [{"id": "w-ab12cd", "would": ["you said it ran; no receipt closes it"]}]}
    try:
        r, p = _file_and_press(lead, press, "kick-run", {"run": "w-ab12cd", "text": "you said it ran; no receipt closes it"})
    finally:
        FOREMAN.clear()
    assert "sends the sentry's kick to run w-ab12cd once" in r["if_approved"]
    sent = [c for c in _sent(lead) if c[0] == "POST"]
    assert len(sent) == 1 and sent[0][1] == "/workers/w-ab12cd/event" and sent[0][2]["kind"] == "kick"
    assert sent[0][2]["value"]["text"] == "you said it ran; no receipt closes it" and p["result"]["said"].startswith("kicked w-ab12cd")


def test_kick_run_refuses_a_run_with_no_would_kick_and_sends_nothing(lead, press):
    FOREMAN[("GET", "/sentry")] = {"ok": True, "runs": [{"id": "w-ab12cd", "would": []}]}
    try:
        _, p = _file_and_press(lead, press, "kick-run", {"run": "w-ab12cd"})
        _, q = _file_and_press(lead, press, "kick-run", {"run": "w-gone"})
    finally:
        FOREMAN.clear()
    assert "no kick without a verdict" in p["result"]["why"] and "no living run w-gone" in q["result"]["why"]
    assert not [c for c in _sent(lead) if c[0] == "POST"]
    assert lead["chat"].file_petition("kick-run", None, "k", "eval:card-verbs", args={"run": "a b"})["ok"] is False


# ── sit-exam ────────────────────────────────────────────────────────────────────────────────────────────────────────
def test_sit_exam_starts_the_runner_once_on_the_press(lead, press, monkeypatch):
    from lacuna_api.control import forge_jobs
    argv = []
    monkeypatch.setattr(forge_jobs, "_start_exam", lambda a: argv.append(a) or 4242)
    r = lead["chat"].file_petition("sit-exam", None, "sit", "eval:card-verbs", args={"exam": "w1-signal-label-l0", "model": "gemma3:270m"})
    assert r["ok"] and "the sentry's exam" in r["if_approved"] and not argv
    out = lead["chat"].decide(r["petition"], True, "alfred", press(r["petition"], True))
    assert len(argv) == 1 and argv[0][2].endswith("tools/exam/exams/w1-signal-label-l0.slat") and argv[0][3:5] == ["--quant", "gemma3:270m"]
    assert out["petition"]["result"]["started"] == 4242 and out["petition"]["result"]["agent"] == "sentry"


def test_sit_exam_refuses_an_unknown_exam_and_a_bad_tag(lead):
    chat = lead["chat"]
    assert "no exam named" in chat.file_petition("sit-exam", None, "s", "eval:card-verbs", args={"exam": "../x", "model": "gemma3:270m"})["refused"]
    assert "weights' tag" in chat.file_petition("sit-exam", None, "s", "eval:card-verbs", args={"exam": "w1-signal-label-l0", "model": "-rf"})["refused"]


# ── leave-shadow ────────────────────────────────────────────────────────────────────────────────────────────────────
def _sitting(lead, name, *, n, ok, at, underpowered=False):
    d = lead["tmp"] / "exam"
    d.mkdir(exist_ok=True)
    (d / f"{name}.json").write_text(json.dumps({"exam": {"id": "w1", "role": {"who": "sentry"}}, "who": "base/1b@0", "in-role": True, "at": at,
                                                "result": {"n": n, "pass": [ok, "why"], "underpowered": underpowered}, "rows": []}))


def test_leave_shadow_refuses_without_a_passing_sitting_and_tells_the_foreman_nothing(lead, press):
    _sitting(lead, "s1", n=39, ok=None, at="2026-10-24T09:26", underpowered=True)
    r, p = _file_and_press(lead, press, "leave-shadow", {"agent": "sentry"})
    assert "refused unless its newest in-role sitting passed" in r["if_approved"]
    assert p["result"]["ok"] is False and "stays in shadow" in p["result"]["why"] and "s1" in p["result"]["why"]
    assert _sent(lead) == []


def test_leave_shadow_with_a_passing_sitting_asks_the_foreman_once_and_undo_needs_no_gate(lead, press):
    _sitting(lead, "s1", n=39, ok=None, at="2026-10-24T09:26", underpowered=True)
    _sitting(lead, "s2", n=240, ok=True, at="2026-10-25T09:00")
    _file_and_press(lead, press, "leave-shadow", {"agent": "sentry"})
    assert _sent(lead) == [("POST", "/sentry/mode", {"mode": "live", "pressed": True, "sitting": "s2", "by": "alfred"})]
    lead["calls"].clear()
    _file_and_press(lead, press, "leave-shadow", {"agent": "sentry", "undo": True})
    assert _sent(lead) == [("POST", "/sentry/mode", {"mode": "shadow", "by": "alfred"})]
    assert lead["chat"].file_petition("leave-shadow", None, "l", "eval:card-verbs", args={"agent": "herald"})["ok"] is False


def test_a_decline_runs_none_of_the_five(lead, press):
    for action, args in (("kick-run", {"run": "w-ab12cd"}), ("leave-shadow", {"agent": "sentry", "undo": True}),
                         ("sit-exam", {"exam": "w1-signal-label-l0", "model": "gemma3:270m"})):
        _, p = _file_and_press(lead, press, action, args, approve=False)
        assert p["state"] == "declined"
    assert _sent(lead) == []
