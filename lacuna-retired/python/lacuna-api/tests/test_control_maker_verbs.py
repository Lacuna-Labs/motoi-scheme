"""The makers' press verbs (lane L3, 2026-10-24; maker_verbs.py): arcade-make, factory-make, factory-exam, arcade-bundle,
factory-bundle. For each: the petition is filed and nothing runs; the owner's yes starts its playbook once, pressed, with the
bindings by step; a decline runs nothing; a bad arg is one sentence and is not filed. The maker `claude` reaches no foreman:
its brief goes to Claude by the threads door's summon, one try. The mind door gives the maker job its tokens, its wait and
the 26B. Nothing here touches ~/lacuna-world or ~/.lacuna (LACUNA_HOME is tmp; the foreman, the door and the gateway are
stand-ins). Session: eval:l3-makers."""
from __future__ import annotations

import importlib
import json

import pytest

WHO = "eval:l3-makers"


@pytest.fixture
def mk(tmp_path, monkeypatch):
    monkeypatch.setenv("LACUNA_HOME", str(tmp_path / "home"))
    monkeypatch.setenv("LACUNA_NO_WORKERS", "1")
    import lacuna_api.control.core as core
    importlib.reload(core)
    import lacuna_api.control.chat as chat
    importlib.reload(chat)
    from lacuna_api.control import foreman, maker_verbs
    monkeypatch.setattr(maker_verbs, "background", lambda fn: fn())
    monkeypatch.setattr(foreman, "last_rung", lambda: "lacuna-worker-lite")
    monkeypatch.setattr(foreman, "allowed_minds", lambda: {"gemma3:1b-it-q8_0", "gemma4:e2b-it-q8_0"})
    calls = []
    monkeypatch.setattr(foreman, "call", lambda m, p, b=None, timeout=10: calls.append((m, p, b)) or {"ok": True, "run": "w-abc123"})
    return {"chat": chat, "foreman": foreman, "verbs": maker_verbs, "calls": calls}


def test_the_five_verbs_are_foreman_actions_with_sentences_written_by_code(mk):
    chat, v = mk["chat"], mk["verbs"]
    assert set(v.VERBS) <= set(chat.FOREMAN_ACTIONS)
    e = chat._foreman_effect("arcade-make", {"words": "a catching game", "maker": "26b"})
    assert e.startswith('makes a new game: "a catching game", by the 26B — a playbook run (arcade-make, 5 units)')
    assert "~/lacuna-world/arcade/games/<id>/" in e and "only the check says made" in e and "no network" in e
    assert chat._foreman_effect("arcade-make", {"words": "faster", "maker": "26b", "id": "catch", "refine": True}).startswith("refines the game catch")
    assert "fixtures.json as its entry" in chat._foreman_effect("factory-make", {"words": "count errors", "maker": "26b"})
    assert "Claude's seat" in chat._foreman_effect("arcade-make", {"words": "chess", "maker": "claude"})
    assert "L2" in chat._foreman_effect("factory-exam", {"id": "tally"})
    assert "mayBundle" in chat._foreman_effect("factory-bundle", {"id": "tally"})
    assert "owed" in chat._foreman_effect("arcade-bundle", {"id": "catch"})
    assert chat._card_of({"action": "arcade-make", "args": {}}) == ["s-arcade"]
    assert chat._card_of({"action": "factory-exam", "args": {}}) == ["s-factory"]


@pytest.mark.parametrize("action,args,why", [
    ("arcade-make", {"words": " ", "maker": "26b"}, "a maker takes words"),
    ("arcade-make", {"words": "x" * 2001, "maker": "26b"}, "the most is 2000"),
    ("arcade-make", {"words": "snake", "maker": "gpt"}, "12b · 26b · claude"),
    ("arcade-make", {"words": "snake", "maker": "12b"}, "ruling L3-R3"),
    ("factory-make", {"words": "tally", "maker": "26b", "id": "Bad Id"}, "lower-case"),
    ("factory-exam", {"id": "../x"}, "name the product"),
    ("arcade-bundle", {}, "name the game"),
])
def test_a_bad_arg_is_one_sentence_and_is_not_filed(mk, action, args, why):
    r = mk["chat"].file_petition(action, None, "pressed on the card", WHO, args=args)
    assert r["ok"] is False and why in r["refused"]
    assert mk["chat"].petitions() == [] or all(p["action"] != action for p in mk["chat"].petitions())
    assert mk["calls"] == []


def test_filing_runs_nothing_and_the_yes_starts_arcade_make_once_pressed(mk):
    chat, fm = mk["chat"], mk["foreman"]
    r = chat.file_petition("arcade-make", None, "pressed on the Arcade", WHO, args={"words": "a catching game with a paddle", "maker": "26b"})
    assert r["ok"] and r["petition"] and mk["calls"] == []
    out = fm.decided("arcade-make", {"words": "a catching game with a paddle", "maker": "26b"}, True, WHO)
    assert out["ok"] and out["run"] == "w-abc123" and out["id"].startswith("a-catching-game-with-")
    (m, path, body), = mk["calls"]
    assert (m, path) == ("POST", "/playbooks/arcade-make/run") and body["pressed"] is True and body["shadow"] is False
    b = body["bindings"]
    assert b["1"][0] == {"kind": "arcade", "id": out["id"], "name": "a catching game with", "words": "a catching game with a paddle", "maker": "26b", "refine": False}
    assert b["2"] == [{"model": "lacuna-worker-lite"}], "the 26B is the brain's last rung"
    assert b["3"][0]["id"] == b["4"][0]["id"] == out["id"] and b["5"][0]["to"] == "desk" and len(b["5"][0]["ticket"]) <= 40
    assert fm.decided("arcade-make", {"words": "x", "maker": "26b"}, False, WHO) == {"ok": True, "declined": True}
    assert len(mk["calls"]) == 1, "a decline reaches no foreman"


def test_a_refine_keeps_the_id_and_the_product_verbs_start_their_playbooks(mk):
    fm = mk["foreman"]
    fm.decided("arcade-make", {"words": "make it faster", "maker": "26b", "id": "catch", "refine": True}, True, WHO)
    assert mk["calls"][0][2]["bindings"]["1"][0]["id"] == "catch" and mk["calls"][0][2]["bindings"]["1"][0]["refine"] is True
    fm.decided("factory-exam", {"id": "tally"}, True, WHO)
    fm.decided("factory-bundle", {"id": "tally"}, True, WHO)
    fm.decided("arcade-bundle", {"id": "catch"}, True, WHO)
    paths = [c[1] for c in mk["calls"][1:]]
    assert paths == ["/playbooks/factory-exam/run", "/playbooks/factory-bundle/run", "/playbooks/arcade-bundle/run"]
    exam = mk["calls"][1][2]["bindings"]
    assert exam["2"] == [{"id": "tally"}] and exam["1"] == exam["3"] == [{"kind": "factory", "id": "tally"}]
    assert mk["calls"][2][2]["bindings"]["2"] == [{"kind": "factory", "id": "tally"}]
    assert "lower-case" in fm.decided("factory-exam", {"id": "Tally!"}, True, WHO)["why"] and len(mk["calls"]) == 4


def test_the_maker_claude_reaches_no_foreman_and_summons_claude_once(mk, monkeypatch):
    fm, v = mk["foreman"], mk["verbs"]
    sent = []

    class Answer:
        def __enter__(self):
            return self

        def __exit__(self, *a):
            return False

        def read(self):
            return json.dumps({"ok": True, "receipt": "summon-1"}).encode()

    def urlopen(req, timeout=0):
        sent.append((req.full_url, json.loads(req.data), timeout))
        return Answer()
    monkeypatch.setattr(v.urllib.request, "urlopen", urlopen)
    out = fm.decided("arcade-make", {"words": "chess with a clock", "maker": "claude"}, True, WHO)
    assert out["ok"] and "summon" in out["said"] and "nothing runs" in out["said"]
    assert mk["calls"] == [], "Claude is a seat: no playbook, no mind"
    (url, body, _), = sent
    assert url == "http://127.0.0.1:1138/api/threads/claude/summon" and body["thread"] == "card:arcade" and "chess with a clock" in body["words"]

    def refuse(req, timeout=0):
        sent.append("again")
        raise OSError("door down")
    monkeypatch.setattr(v.urllib.request, "urlopen", refuse)
    r = v.summon("factory", "count errors", WHO)
    assert r["ok"] is False and "one try" in r["why"] and sent.count("again") == 1


def test_the_mind_door_gives_the_maker_job_its_tokens_its_wait_and_the_26b(mk, monkeypatch):
    fm = mk["foreman"]
    asked = []
    monkeypatch.setattr(fm, "_box", lambda: {})
    monkeypatch.setattr(fm, "_ask_small", lambda req, timeout: asked.append((req, timeout)) or {"message": {"content": "=== FILE index.html ===\n"}})
    r = fm.mind({"model": "lacuna-worker-lite", "job": "maker", "system": "s", "prompt": "p" * 20000})
    assert r["ok"] and r["text"].startswith("=== FILE")
    req, timeout = asked[0]
    assert req["options"]["num_predict"] == 8192 and timeout == 280 and len(req["messages"][1]["content"]) == 20000
    assert fm.mind({"model": "lacuna-worker-lite", "job": "gist", "prompt": "p"})["ok"] is False, "the 26B is no other job's mind"
    fm.mind({"model": "gemma3:1b-it-q8_0", "job": "gist", "prompt": "p" * 9000})
    assert asked[1][0]["options"]["num_predict"] == 160 and asked[1][1] == 50 and len(asked[1][0]["messages"][1]["content"]) == 6000
