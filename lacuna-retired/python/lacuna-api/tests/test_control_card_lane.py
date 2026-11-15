"""A card's lean machine (chat.card_lane) and the desk's heartbeat (desk_seen): the owner, 2026-10-18."""
import time

from lacuna_api.control import chat, desk_seen


def test_inside_its_card_the_turn_is_lean():
    lane, tools = chat.card_lane("why are the watchdogs stale", "s-telemetry")
    assert lane == "lean"
    assert "watchdogs" in tools and "forge" not in tools


def test_a_question_past_the_card_reaches_out():
    assert chat.card_lane("what is the weather in Phoenix", "s-telemetry")[0] == "reach"
    assert chat.card_lane("how is the forge training going", "s-telemetry")[0] == "reach"


def test_no_card_no_lane():
    assert chat.card_lane("hello", None) == ("none", None)
    assert chat.card_lane("hello", "s-chat") == ("none", None)


def test_the_desk_heartbeat_holds_the_banners(tmp_path, monkeypatch):
    monkeypatch.setattr(desk_seen, "SEEN", tmp_path / "desk-seen.json")
    assert desk_seen.fresh() is False
    import json, time
    desk_seen.SEEN.write_text(json.dumps({"t": time.time(), "screen": "phone"}))   # the door writes it (desk-reads.mjs)
    assert desk_seen.fresh() is True and desk_seen.state()["screen"] == "phone"
    (tmp_path / "desk-seen.json").write_text('{"t": %f, "screen": "desk"}' % (time.time() - 200))
    assert desk_seen.fresh() is False


def test_a_card_keeps_its_own_turns_and_the_conversation(monkeypatch):
    from lacuna_api.control import memory
    monkeypatch.setattr(memory, "_turns", [
        {"t": 10, "role": "user", "content": "how hot is it outside", "session": "home"},
        {"t": 11, "role": "assistant", "content": "about 38 degrees", "session": "home"},
        {"t": 12, "role": "user", "content": "why did E7 fail", "session": "card:s-exam"},
        {"t": 13, "role": "assistant", "content": "the docs gate refused a path", "session": "card:s-exam"}])
    monkeypatch.setattr(memory, "_load", lambda: None)
    monkeypatch.setattr(memory, "voice_since", lambda: 0)
    # 2026-10-19: a card alone forgot everything said elsewhere ("like it was just born"); it carries the conversation too
    assert [m["content"] for m in memory.recent(card="s-exam")] == ["how hot is it outside", "about 38 degrees", "why did E7 fail", "the docs gate refused a path"]
    assert len(memory.recent()) == 4


def test_a_cards_older_turns_fold_into_one_line_each(monkeypatch):
    from lacuna_api.control import memory
    turns = []
    for i in range(memory.RECENT + 2):      # sized from the constant: the window must hold every pair
        turns += [{"t": 1000 + i * 2, "role": "user", "content": f"question {i}. more words here", "session": "card:s-exam"},
                  {"t": 1001 + i * 2, "role": "assistant", "content": f"answer {i}. and a long explanation that goes on", "session": "card:s-exam"}]
    monkeypatch.setattr(memory, "_turns", turns)
    monkeypatch.setattr(memory, "_load", lambda: None)
    monkeypatch.setattr(memory, "voice_since", lambda: 0)
    out = memory.recent(card="s-exam")
    assert len(out) == memory.NOW_BAND
    assert "EARLIER IN THIS CARD" in out[0]["content"] and "question 0" in out[0]["content"] and "long explanation" not in out[0]["content"]
