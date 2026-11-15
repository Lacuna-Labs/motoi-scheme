"""Lacuna drives its desk: each tool sends the right op; talking to a bot is real and played on screen; nothing approves."""
from lacuna_api.control import agent_talk, desk_nav, home


def test_tools_send_the_nav_ops(monkeypatch):
    sent = []
    monkeypatch.setattr(home, "act", lambda op, who="lacuna": sent.append(op) or {})
    from lacuna_api.control import chat
    monkeypatch.setitem(chat._CURRENT, "text", "")                 # nobody asked to move the screen: nothing moves (2026-10-20)
    assert desk_nav.open_app({"app": "s-forge"}, "lacuna").startswith("not moved")
    monkeypatch.setitem(chat._CURRENT, "text", "open the forge and show it beside minds")
    desk_nav.open_app({"app": "s-forge", "room": "sentry"}, "lacuna")
    desk_nav.side_by_side({"a": "s-forge", "b": "s-minds"}, "lacuna")
    desk_nav.desk_home({}, "lacuna")
    assert [o["op"] for o in sent] == ["open-app", "side-by-side", "home"]
    assert sent[0]["room"] == "sentry"


def test_talking_to_a_bot_is_real_and_played(monkeypatch):
    sent = []
    monkeypatch.setattr(home, "act", lambda op, who="lacuna": sent.append(op) or {})
    monkeypatch.setattr(agent_talk, "talk", lambda w, t, who: {"reply": "I watch memory", "by": "program"})
    monkeypatch.setattr(agent_talk, "tree", lambda: {"nodes": [{"id": "w-1", "name": "worker-one"}]})
    out = desk_nav.talk_to_bot({"worker": "w-1", "text": "what are you doing?"}, "lacuna")
    assert "I watch memory" in out
    assert sent[-1] == {"op": "talk", "worker": "w-1", "text": "what are you doing?", "reply": "I watch memory", "by_name": "lacuna"}


def test_no_desk_tool_can_approve():
    names = [t[0] for t in desk_nav.TOOLS]
    assert not any("approve" in n and n != "show_approval" for n in names)
    assert ".decide(" not in open(desk_nav.__file__).read()          # no path to the owner's press


def test_a_bot_is_found_by_its_name(monkeypatch):
    monkeypatch.setattr(agent_talk, "tree", lambda: {"nodes": [{"id": "w-cd2e05", "name": "mem-watch"}]})
    assert desk_nav._resolve("mem_watch") == "w-cd2e05"
    assert desk_nav._resolve("the mem watch bot") == "w-cd2e05"
    assert desk_nav._resolve("w-cd2e05") == "w-cd2e05"


def test_open_inbox_sends_the_inbox_op_and_counts(monkeypatch):
    from lacuna_api.control import chat
    sent = []
    monkeypatch.setattr(home, "act", lambda op, who="lacuna": sent.append(op) or {})
    monkeypatch.setattr(chat, "petitions", lambda: [{"id": "a", "state": "waiting"}, {"id": "b", "state": "waiting"},
                                                    {"id": "c", "state": "waiting"}, {"id": "d", "state": "approved"}])
    out = desk_nav.open_inbox({}, "lacuna")
    assert sent == [{"op": "inbox", "open": True, "say": "3 things need you — here they are"}]
    assert out.startswith("done") and "3 waiting" in out
    assert "open_inbox" in [t[0] for t in desk_nav.TOOLS]
    assert "open_inbox" in chat.pick_tools("what is waiting on me in the inbox?")


def test_the_inbox_op_lands_on_the_board(monkeypatch, tmp_path):
    monkeypatch.setattr(home, "_board_file", lambda: tmp_path / "board.json")
    b = home.act({"op": "inbox", "open": True, "say": "two things need you"}, who="lacuna")
    assert b["nav"]["op"] == "inbox" and b["nav"]["open"] is True and b["nav"]["say"] == "two things need you"
    assert b["nav"]["by"] == "lacuna" and "refused" not in b
