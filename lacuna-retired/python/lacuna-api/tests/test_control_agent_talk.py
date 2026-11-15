"""Talkable workers from Lacuna's side (agent_talk.py), as the Python chat, the swarm and the desk's nav still call it: the
tree and thoughts pass through; a talk goes down signed as (talk …) and comes back {reply, by}; pause/resume/stop are audited
with who; and Lacuna's next chat turn hears of it. The desk's routes over these (GET /api/foreman/tree, the thoughts, POST talk
and interrupt) moved to the door on 2026-11-06 (lacuna-node/frontend/foreman-desk.mjs, its test foreman-desk.test.mjs)."""
from __future__ import annotations

import json

import pytest

from lacuna_api.control import agent_talk, foreman, slatwire


@pytest.fixture
def fake_foreman(monkeypatch):
    sent = []
    nodes = [{"id": "w-1", "name": "mem-watch", "kind": "worker", "tier": "watch", "mind": None, "state": "running",
              "parent": None, "started": 1.0, "restarts": 0, "last_line": None}]

    def call(method, path, body=None, timeout=10):
        sent.append((method, path, body))
        if path == "/tree":
            return {"ok": True, "nodes": nodes, "events": [{"t": 1, "kind": "spawn", "id": "w-1", "why": "by lacuna"}] * 250}
        if path.startswith("/workers/w-1/thoughts"):
            return {"ok": True, "items": [{"t": 1, "kind": "mail-in", "text": "mem 7.5"}]}
        if path == "/workers/w-1/talk":
            opened = slatwire.open_("tok", body)
            assert opened["ok"] and opened["msg"]["kind"] == "talk" and opened["msg"]["to"] == "w-1"
            return {"ok": True, "reply": f"I heard: {opened['msg']['body']['text']}", "by": "program"}
        if path == "/workers/w-1/interrupt":
            return {"ok": True, "ids": ["w-1", "w-2"]} if body["mode"] != "resume" else {"ok": False, "why": "the worker is running"}
        return {"ok": False, "why": "the foreman is not answering (URLError)"}

    monkeypatch.setattr(foreman, "call", call)
    monkeypatch.setattr(foreman, "_token", lambda: "tok")
    return sent


def _audit():
    return [json.loads(x) for x in (agent_talk._home() / "audit.jsonl").read_text().splitlines()]


def test_tree_and_thoughts_pass_through(fake_foreman):
    t = agent_talk.tree()
    assert t["nodes"][0]["name"] == "mem-watch" and len(t["events"]) == 200
    assert agent_talk.thoughts("w-1", 5) == {"items": [{"t": 1, "kind": "mail-in", "text": "mem 7.5"}]}
    assert ("GET", "/workers/w-1/thoughts?n=5", None) in fake_foreman
    assert not agent_talk.valid_id("../x")


def test_talk_is_signed_audited_and_lacuna_hears_it_once(fake_foreman):
    assert agent_talk.talk("w-1", "what are you doing?", "alfred") == {"ok": True, "reply": "I heard: what are you doing?", "by": "program"}
    row = [a for a in _audit() if a["action"] == "foreman.talk"][-1]
    assert row["who"] == "alfred" and row["name"] == "mem-watch" and row["text"] == "what are you doing?"
    note = agent_talk.take_note()
    assert note.startswith("the owner talked to mem-watch: “what are you doing?”")
    assert agent_talk.take_note() == ""                      # seen once, then not again
    assert agent_talk.talk("w-1", " ", "alfred") == {"ok": False, "why": "say something"}
    assert "foreman" in agent_talk.talk("w-9", "hi", "alfred")["why"]


def test_interrupts_are_audited_with_who(fake_foreman):
    assert agent_talk.interrupt("w-1", "pause", "alfred")["ids"] == ["w-1", "w-2"]
    assert agent_talk.interrupt("w-1", "stop", "alfred")["ok"]
    assert not agent_talk.interrupt("w-1", "resume", "alfred")["ok"]
    assert not agent_talk.interrupt("w-1", "explode", "alfred")["ok"]
    acts = [(a["action"], a["who"], a["ok"]) for a in _audit() if a["action"].startswith("foreman.") and a["action"] != "foreman.talk"]
    assert acts == [("foreman.pause", "alfred", True), ("foreman.stop", "alfred", True), ("foreman.resume", "alfred", False)]
    assert ("POST", "/workers/w-1/interrupt", {"mode": "pause", "by": "alfred"}) in fake_foreman
    assert agent_talk.take_note() == "the owner paused mem-watch: with its 1 child worker; the owner stopped mem-watch: with its 1 child worker"


def test_the_chat_turn_carries_the_line(fake_foreman, monkeypatch):
    from lacuna_api.control import chat  # noqa: PLC0415
    agent_talk.interrupt("w-1", "pause", "alfred")
    seen = {}

    def fake_ollama(messages, *a, **k):
        seen["turn"] = messages[-1]["content"]
        raise RuntimeError("stop here")

    monkeypatch.setattr(chat, "machine_note", lambda: "")
    monkeypatch.setattr(chat, "_ollama", fake_ollama, raising=False)
    try:
        chat._ask("what is the status of mem-watch", "alfred", "console", "m", 1, False, "ops", None, None)   # a greeting is the quick tier: it carries nothing
    except Exception:  # noqa: BLE001 — only the turn it built matters here
        pass
    assert "for your information, not a question: the owner paused mem-watch" in seen.get("turn", "")
