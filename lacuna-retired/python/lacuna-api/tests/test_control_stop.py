"""STOP ends a running command within a second and a turn at its next step; small talk is the quick tier."""
import importlib
import threading
import time

import pytest

from lacuna_api.control import chat


def test_small_talk_is_quick_and_machine_talk_is_not():
    for t in ("hi", "Hello!", "thanks", "how are you doing today?", "good morning"):
        assert chat.is_quick(t), t
    for t in ("did you see those two alarms?", "check", "fix the notify cart", "what is the disk at", "restart dev"):
        assert not chat.is_quick(t), t


def test_stop_kills_a_running_command_within_a_second(tmp_path, monkeypatch):
    monkeypatch.setattr("pathlib.Path.home", lambda: tmp_path)
    (tmp_path / ".lacuna" / "jail").mkdir(parents=True)
    (tmp_path / ".lacuna" / "jail" / "shell.sb").write_text("(version 1)\n(allow default)\n")
    chat._STOP.clear()
    box = {}

    def run():
        try:
            box["r"] = chat.shell({"cmd": "sleep 30", "timeout": 60}, "t")
        except chat.Stopped:
            box["stopped"] = time.time()

    th = threading.Thread(target=run); th.start()
    time.sleep(1.2)
    t0 = time.time(); chat.request_stop(); th.join(5)
    assert box.get("stopped") and box["stopped"] - t0 < 2, box
    chat._STOP.clear()


def test_a_turn_ends_with_where_it_was_when_stopped(tmp_path, monkeypatch):
    monkeypatch.setattr(chat.memory, "remember", lambda *a, **k: None)
    monkeypatch.setattr(chat, "_ask", lambda *a, **k: (_ for _ in ()).throw(chat.Stopped()))
    out = chat.ask("do the long thing", who="alfred")
    assert out["stopped"] and "stopped" in out["answer"].lower()
    assert chat._TURN.acquire(blocking=False)      # the turn lock was released
    chat._TURN.release()


def _scripted(monkeypatch, replies):
    """A turn whose model answers from a script: a message with tool_calls, or plain words."""
    it, seen = iter(replies), []

    def fake(messages, tools, model, job="ops"):
        seen.append(messages[-1]["content"] if messages[-1]["role"] == "user" else "(tool)")
        return {"message": next(it)}
    monkeypatch.setattr(chat, "_ollama", fake)
    monkeypatch.setattr(chat, "call_tool", lambda name, args, who, dry=False: {"ok": True, "carts": ["a", "b"]})
    monkeypatch.setattr(chat.memory, "remember", lambda *a, **k: None)
    monkeypatch.setattr(chat.memory, "recent", lambda n=20: [])
    monkeypatch.setattr(chat.memory, "journal_tail", lambda n=8: "")
    monkeypatch.setattr(chat, "machine_note", lambda: "")
    monkeypatch.setattr(chat.threading, "Thread", lambda *a, **k: type("T", (), {"start": lambda self: None})())
    return seen


def test_a_turn_that_says_what_it_will_do_next_carries_on_instead_of_ending(monkeypatch):
    call = {"content": "", "tool_calls": [{"function": {"name": "health_check", "arguments": {}}}]}
    seen = _scripted(monkeypatch, [call,
                                   {"content": "I found two carts. I'll start by looking at the first one."},
                                   {"content": "The first one ends without a table. Do you want me to fix that one, or look at the second?"}])
    out = chat.ask("find an easy broken cart to fix", who="alfred")
    assert len(seen) == 3 and seen[-1] == "Go on — do that now."
    assert out["answer"].startswith("The first one ends without a table")


def test_a_finished_report_or_a_question_ends_the_turn(monkeypatch):
    call = {"content": "", "tool_calls": [{"function": {"name": "health_check", "arguments": {}}}]}
    seen = _scripted(monkeypatch, [call, {"content": "I found two carts. Which one should I take?"}])
    out = chat.ask("find a broken cart", who="alfred")
    assert len(seen) == 2 and out["answer"].startswith("I found two carts")


def test_thinking_that_arrives_as_words_goes_to_thinking_not_to_the_reply():
    st = {"mode": "lead", "buf": ""}
    out = []
    for c in ["thou", "ght\nThe owner wants a cart. ", "I should look.<chan", "nel|>", "Found three carts."]:
        out += chat._split_thought(c, st)
    kinds = "".join("T" if k == "thinking" else "A" for k, _ in out)
    said = "".join(p for k, p in out if k == "text")
    thought = "".join(p for k, p in out if k == "thinking")
    assert "The owner wants a cart." in thought and "Found three carts." in said and "thought" not in said.lower() and "<" not in said
    # an answer that merely starts with the word is an answer
    st = {"mode": "lead", "buf": ""}
    out = chat._split_thought("Thought you'd ask that. Yes.", st)
    assert out == [("text", "Thought you'd ask that. Yes.")]


def test_a_stopped_turn_says_how_far_it_got_and_remembers_it(monkeypatch):
    wrote = []
    monkeypatch.setattr(chat, "cx", lambda kind, key, props, about=None: wrote.append((kind, key, props["text"])))
    monkeypatch.setattr(chat.memory, "remember", lambda *a, **k: None)
    monkeypatch.setattr(chat, "_ask", lambda *a, **k: (chat._LAST_TRACE.__setitem__(0, [{"tool": "shell", "args": {"cmd": "ls"}}, {"tool": "carts", "args": {"op": "show"}}]), (_ for _ in ()).throw(chat.Stopped()))[1])
    out = chat.ask("fix the cart", who="alfred")
    assert "shell ×1" in out["answer"] and "carts ×1" in out["answer"]
    assert wrote and wrote[0][0] == "fact" and wrote[0][1] == "interrupted-latest" and "fix the cart" in wrote[0][2]
    assert chat._INTERRUPT["text"]
    chat._INTERRUPT["text"] = ""


def test_a_stopped_turn_is_kept_as_the_rooms_line_never_the_minds(monkeypatch):
    """The finale §10 row 4: the stop template was kept as Lacuna's words (who lacuna, "Done, I've stopped."); it is the room's."""
    kept = []
    monkeypatch.setattr(chat, "cx", lambda *a, **k: None)
    keep = lambda role, content, who="", session="", steps=None: kept.append((role, content, who))  # noqa: E731
    monkeypatch.setattr(chat.memory, "remember", keep)
    monkeypatch.setattr(importlib.import_module("lacuna_api.control.memory"), "remember", keep)   # the module the stop path imports (a test may reload it)
    monkeypatch.setattr(chat, "_ask", lambda *a, **k: (chat._LAST_TRACE.__setitem__(0, [{"tool": "shell", "args": {"cmd": "ls"}}]), (_ for _ in ()).throw(chat.Stopped()))[1])
    out = chat.ask("fix the cart", who="alfred")
    said = [r for r in kept if r[0] == "assistant"]
    assert out["stopped"] and said and [r[2] for r in said] == ["system:stop"], kept
    assert said[0][1] == out["answer"] == "Stopped at Alfred's word; the turn had run shell ×1; the last was shell {'cmd': 'ls'}. Say go on to pick it up."
    chat._INTERRUPT["text"] = ""
