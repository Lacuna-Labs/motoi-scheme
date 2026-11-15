"""Lacuna carts from Lacuna's side (LACUNA-1.3-DESIGN §37.1–§37.3, B45/B47/B48): the exam row's states, the leases two
carts never share, the artifact a retired cart leaves, and `lacuna exam`."""
from __future__ import annotations

import importlib.machinery
import importlib.util
import json
from pathlib import Path

import pytest

from lacuna_api.control import artifacts, carts, chat, foreman, home_cards

REPO = Path(__file__).resolve().parents[2]
HEADER = {"name": "log-watch", "exam": "E10", "tier": "watch", "verbs": ["on", "hand", "report", "done"],
          "judgment": ["new-thing"], "touches": ["log:dev-api"], "done": "one pass",
          "minds": {"label": {"job": "signal->label", "model": "functiongemma", "why": "no tiers.json yet — the box's workhorse"}}}


@pytest.fixture
def world(tmp_path, monkeypatch):
    monkeypatch.setenv("LACUNA_WORLD", str(tmp_path))
    monkeypatch.setenv("LACUNA_LEASES", str(tmp_path / "leases"))
    monkeypatch.setenv("LACUNA_ARTIFACTS", str(tmp_path / "artifacts"))
    monkeypatch.setattr(artifacts, "_MOD", None)
    (tmp_path / "carts").mkdir()
    (tmp_path / "carts" / "log-watch.sks").write_text("(lacuna-cart 'log-watch '((does . \"x\") (done . \"y\")))\n(done \"y\")\n")
    calls, petitions = [], []

    def call(method, path, body=None, timeout=10):
        calls.append((method, path, body))
        if path == "/check":
            return {"ok": True, "problems": [], "cart": HEADER}
        if path == "/workers" and method == "POST":
            return {"ok": True, "worker": {"id": f"w-{len(calls)}", "name": body["name"]}}
        if method == "DELETE":
            return {"ok": True}
        return {"ok": False, "why": "no such door"}

    def file_petition(action, build, reason, who, dry=False, args=None):
        petitions.append({"action": action, "args": args, "who": who})
        return {"ok": True, "petition": f"p{len(petitions)}", "filed": action}

    monkeypatch.setattr(foreman, "call", call)
    monkeypatch.setattr(chat, "file_petition", file_petition)
    return {"path": tmp_path, "calls": calls, "petitions": petitions}


def row(eid):
    return carts.item(eid)


def record(wid, outcome="done", said="one pass done: 500 lines read", **kw):
    return {"record": {"id": wid, "cart": "log-watch", "class": "lacuna-cart", "exam": "E10", "asked": "reads the log",
                       "touches": ["log:dev-api"], "started": "2026-10-18T09:00:00", "ended": "2026-10-18T09:03:00",
                       "steps": [{"name": "load", "status": "done", "why": "header read", "at": "09:00:00"}],
                       "made": {"bugs": ["Traceback: boom"]}, "minds": ["functiongemma"], "minutes": 3.0,
                       "outcome": outcome, "reason": said, "said": said, **kw}}


def test_start_tries_the_cart_then_waits_on_a_card(world):
    r = carts.start("10", "alfred")
    assert r["petition"] == "p1" and r["exam"] == "E10"
    p = world["petitions"][0]
    assert p["action"] == "spawn-cart" and p["args"]["exam"] == "E10" and p["args"]["header"]["touches"] == ["log:dev-api"]
    assert world["calls"][0][1] == "/check"
    assert not any(c[1] == "/workers" for c in world["calls"])          # nothing runs before the yes
    assert row("E10")["state"] == "waiting" and row("E10")["petition"] == "p1"
    assert "yes" in row("E10")["said"]


def test_start_refuses_an_unknown_item_and_a_cart_not_written(world):
    assert carts.start("E11", "alfred")["ok"] is False
    r = carts.start("E1", "alfred")                     # no cart file: its jail worker class runs it (a spawn-job card)
    assert r["cart"]["worker_class"] == "repair"


def test_the_yes_takes_the_leases_runs_it_and_the_record_moves_the_row_to_done(world):
    carts.start("E10", "alfred")
    args = world["petitions"][0]["args"]
    out = foreman.decided("spawn-cart", args, True, "alfred")
    wid = out["worker"]["id"]
    r = row("E10")
    assert r["state"] == "running" and r["worker"] == wid and r["minds"] == ["functiongemma"]
    assert carts.lease().held("log:dev-api")["holder"] == "cart:log-watch:E10"
    assert json.loads((world["path"] / "exam" / "state.json").read_text())["started"]
    foreman._BRAIN_S[wid] = 4.24
    done = carts.retired({"id": wid, "name": "log-watch"}, record(wid))
    r = row("E10")
    assert r["state"] == "done" and r["minutes"] == 3.0 and r["brain_seconds"] == 4.2 and r["said"].startswith("one pass done")
    assert carts.lease().held("log:dev-api") is None                   # given back
    text = Path(done["artifact"]).read_text()
    assert '(outcome :is "done"' in text and "Traceback: boom" in text
    a = artifacts.latest("log-watch")
    assert a["outcome"]["is"] == "done" and a["minds"]["brain_seconds"] == 4.2
    assert any(x["cart"] == "log-watch" for x in artifacts.index())


def test_two_carts_on_the_same_thing_one_waits_none_collide(world):
    carts.start("E10", "alfred")
    args = world["petitions"][0]["args"]
    first = foreman.decided("spawn-cart", args, True, "alfred")
    second = foreman.decided("spawn-cart", {**args, "exam": "E5", "cart": "battery-reds-to-fixes"}, True, "alfred")
    assert first["ok"] and second["ok"] is False and "held by cart:log-watch:E10" in second["waits"]
    assert sum(1 for c in world["calls"] if c[1] == "/workers") == 1
    assert "waits" in row("E5")["said"] and row("E5")["state"] == "waiting"


def test_a_stop_from_the_desk_ends_failed_with_who_and_gives_the_leases_back(world):
    carts.start("E10", "alfred")
    out = foreman.decided("spawn-cart", world["petitions"][0]["args"], True, "alfred")
    wid = out["worker"]["id"]
    assert carts.stop("E10", "alfred")["ok"]
    assert world["calls"][-1] == ("DELETE", f"/workers/{wid}?by=alfred", None)
    carts.retired({"id": wid}, record(wid, outcome="stopped", said="stopped by alfred"))
    assert row("E10")["state"] == "failed" and row("E10")["said"] == "stopped by alfred"
    assert carts.lease().held("log:dev-api") is None
    assert carts.stop("E10", "alfred")["ok"] is False                  # not running any more


def test_a_declined_card_says_so_and_runs_nothing(world):
    carts.start("E10", "alfred")
    foreman.decided("spawn-cart", world["petitions"][0]["args"], False, "alfred")
    assert "declined by alfred" in row("E10")["said"] and row("E10")["state"] == "waiting"
    assert not any(c[1] == "/workers" for c in world["calls"])


def test_receive_routes_a_retired_cart(world, monkeypatch):
    seen = []
    monkeypatch.setattr(carts, "retired", lambda w, d: seen.append((w, d)))
    from lacuna_api.control import slatwire
    monkeypatch.setattr(slatwire, "open_", lambda tok, msg: {"ok": True, "msg": {"to": "lacuna", "body": msg}})
    monkeypatch.setattr(foreman, "EVENTS", world["path"] / "events.jsonl")
    foreman.receive({"kind": "cart-retired", "worker": {"id": "w-1", "name": "log-watch"}, "data": record("w-1")})
    assert seen and seen[0][1]["record"]["outcome"] == "done"


def test_the_mind_door_allows_only_the_box_minds(monkeypatch):
    assert "gemma4:e4b" not in foreman.allowed_minds() and "functiongemma" in foreman.allowed_minds()
    assert foreman.mind({"model": "gemma4:e4b"})["ok"] is False
    assert foreman.mind({"model": "lacuna-worker-lite"})["ok"] is False


def test_the_chat_tool_starts_an_item_by_its_number(world):
    assert "permission card" in carts.exam_tool({"op": "start", "item": "10"}, "alfred")
    assert "E10" in carts.exam_tool({"op": "status"}, "alfred")
    assert "exam" in chat.pick_tools("start exam item 10")


def _cli():
    loader = importlib.machinery.SourceFileLoader("lacuna_cli", str(REPO / "bin" / "lacuna-py"))   # the Python command (E7: bin/lacuna is the Node one)
    spec = importlib.util.spec_from_loader("lacuna_cli", loader)
    mod = importlib.util.module_from_spec(spec)
    loader.exec_module(mod)
    return mod


def test_cli_exam_status_start_stop(world, monkeypatch, capsys):
    cli = _cli()
    sent = []

    def call(method, path, body=None, timeout=300):
        sent.append((method, path))
        if path == "/api/exam":
            return home_cards.exam()
        if path.endswith("/start"):
            return carts.start(path.split("/")[3], "alfred")
        return {"ok": True, "exam": "E10", "worker": "w-1"}

    monkeypatch.setattr(cli, "call", call)
    cli.main(["exam"])
    out = capsys.readouterr().out
    assert "0 of 10 at your press" in out and "E10" in out and "log-watch" in out
    cli.main(["exam", "start", "E10"])
    assert "permission card (p1)" in capsys.readouterr().out
    cli.main(["exam", "stop", "E10"])
    assert sent[-1] == ("POST", "/api/exam/E10/stop")
    with pytest.raises(SystemExit):
        cli.main(["exam", "frobnicate"])


def test_a_hushed_foreman_makes_the_yes_wait_for_calm_with_its_leases_held(world, monkeypatch):
    carts.start("E10", "alfred")
    args = world["petitions"][0]["args"]
    answers = [{"ok": False, "why": "not now — the foreman is hushed: the box's load is 25.9"},
               {"ok": False, "why": "not now — the foreman is hushed: the box's load is 20.1"},
               {"ok": True, "worker": {"id": "w-calm", "name": "log-watch"}}]
    monkeypatch.setattr(carts, "_load_cart", lambda *a: answers.pop(0))
    waits = []
    monkeypatch.setattr(carts.threading, "Thread", lambda target, args, **kw: waits.append((target, args)) or type("T", (), {"start": lambda s: None})())
    out = foreman.decided("spawn-cart", args, True, "alfred")
    assert out["waiting"] and "waits for the foreman to be calm" in row("E10")["said"] and row("E10")["state"] == "waiting"
    assert carts.lease().held("log:dev-api")["holder"] == "cart:log-watch:E10"     # still its, while it waits
    target, targs = waits[0]
    target(*targs, every_s=0)
    assert row("E10")["state"] == "running" and row("E10")["worker"] == "w-calm"


def test_a_hand_answer_too_big_for_the_protocol_is_trimmed_oldest_first():
    out = foreman._fit({"ok": True, "result": {"source": "dev-api", "lines": [f"{i} " + "x" * 490 for i in range(600)]}})
    lines = out["result"]["lines"]
    assert out["result"]["trimmed"] > 0 and lines[-1].startswith("599 ")
    assert len(json.dumps(lines).encode()) <= foreman.HAND_BYTES
    small = {"ok": True, "result": {"lines": ["a", "b"]}}
    assert foreman._fit(small) is small
