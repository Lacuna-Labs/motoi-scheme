"""THE REGISTER IS HELD AT THE SEAM (2026-09-28): a line asked of her gets no tools; a banned phrase is sent back once;
a closing offer is trimmed; a web search reads its top page itself."""
import importlib
import json


def load(tmp_path, monkeypatch):
    monkeypatch.setenv("LACUNA_HOME", str(tmp_path))
    monkeypatch.setenv("LACUNA_NO_WORKERS", "1")
    import lacuna_api.control.core as core
    importlib.reload(core)
    import lacuna_api.control.chat as chat
    importlib.reload(chat)
    return chat


def test_a_line_asked_of_her_is_personal_and_one_about_the_machine_is_not(tmp_path, monkeypatch):
    chat = load(tmp_path, monkeypatch)
    for q in ("how's it going?", "How are you doing tonight?", "you good?", "i like talking to you", "how do you feel about apples?"):
        assert chat.is_personal(q), q
    for q in ("how's it going with QA?", "how are the watchdogs?", "what's going on with the machine?", "restart the tunnel"):
        assert not chat.is_personal(q), q


def test_a_closing_offer_is_trimmed_and_a_lone_sentence_is_kept(tmp_path, monkeypatch):
    chat = load(tmp_path, monkeypatch)
    a, t = chat.trim_offer("Fine tonight, Alfred. The shift has been quiet. Want me to check the logs? -- Lacuna")
    assert t and a == "Fine tonight, Alfred. The shift has been quiet. -- Lacuna"
    a, t = chat.trim_offer("What's next? -- Lacuna")
    assert not t and a == "What's next? -- Lacuna"
    a, t = chat.trim_offer("Apples are fine. I'd take a Honeycrisp. -- Lacuna")
    assert not t


def test_a_personal_line_keeps_the_one_tool_set_and_a_banned_phrase_is_asked_again(tmp_path, monkeypatch):
    chat = load(tmp_path, monkeypatch)
    seen = []
    answers = iter(["I don't have feelings, but apples are fine. -- Lacuna", "Apples? I'd take a Honeycrisp over most things. -- Lacuna"])

    def fake(messages, tools, model, job="ops"):
        seen.append((len(tools), messages[-1]["content"]))
        return {"message": {"content": next(answers)}}
    monkeypatch.setattr(chat, "_ollama", fake)
    monkeypatch.setattr(chat.memory, "remember", lambda *a, **k: None)
    monkeypatch.setattr(chat.memory, "recent", lambda n=20: [])
    monkeypatch.setattr(chat.memory, "journal_tail", lambda n=8: "")
    monkeypatch.setattr(chat, "machine_note", lambda: "")
    monkeypatch.setattr(chat.threading, "Thread", lambda *a, **k: type("T", (), {"start": lambda self: None})())
    out = chat.ask("how do you feel about apples?", dry=True)
    assert seen[0][0] == len(chat.head_tool_specs())   # one tool set every turn: the cached head never moves (2026-10-19)
    assert len(seen) == 2 and "phrase you never use" in seen[1][1]
    assert out["answer"].startswith("Apples? I'd take a Honeycrisp")


def test_web_search_reads_its_top_page(tmp_path, monkeypatch):
    chat = load(tmp_path, monkeypatch)
    monkeypatch.setattr(chat.web, "search", lambda q, who: {"results": [{"title": "t", "url": "https://x.test/a", "snippet": "s"}]})
    monkeypatch.setattr(chat.web, "read", lambda url, who: {"ok": True, "url": url, "text": "the page says the Dodgers won"})
    r = chat.web_search({"query": "world series"}, "alfred")
    assert r["top_page"]["url"] == "https://x.test/a" and "Dodgers" in r["top_page"]["text"]
    assert "top_page" in r["note"]


def test_curly_quotes_and_a_lowercase_signoff_still_count(tmp_path, monkeypatch):
    chat = load(tmp_path, monkeypatch)
    assert chat._BANNED.search(chat._plain("i don\u2019t have feelings, but apples are fine"))
    a, t = chat.trim_offer("both apis are up. would you like me to check the logs? -- lacuna")
    assert t and a == "both apis are up. -- lacuna"


def test_what_she_wrote_stands_and_is_never_sent_back_to_retract(tmp_path, monkeypatch):
    """2026-10-19: a regex on her wording used to send "you described the machine without looking" and "you said you acted
    without a tool" back to her, and she retracted her own text. One model call now; her words are the answer."""
    chat = load(tmp_path, monkeypatch)
    seen = []

    def fake(messages, tools, model, job="ops"):
        seen.append(messages[-1]["content"])
        return {"message": {"content": "everything's running smoothly here, no alerts. -- lacuna"}}
    monkeypatch.setattr(chat, "_ollama", fake)
    monkeypatch.setattr(chat.memory, "remember", lambda *a, **k: None)
    monkeypatch.setattr(chat.memory, "recent", lambda n=20: [])
    monkeypatch.setattr(chat.memory, "journal_tail", lambda n=8: "")
    monkeypatch.setattr(chat, "machine_note", lambda: "")
    monkeypatch.setattr(chat.threading, "Thread", lambda *a, **k: type("T", (), {"start": lambda self: None})())
    out = chat.ask("how's it going?", dry=True)
    assert len(seen) == 1
    assert out["answer"].startswith("everything's running smoothly")


def test_canned_lines_do_not_ride_in_her_history(tmp_path, monkeypatch):
    from lacuna_api.control import memory
    m = __import__("importlib").reload(memory)
    monkeypatch.setattr(m, "voice_since", lambda: 0)
    monkeypatch.setattr(m, "_load", lambda: None)
    monkeypatch.setattr(m, "_turns", [
        {"role": "user", "content": "[o] fix it", "t": 1}, {"role": "assistant", "content": "Done — see the desk", "t": 2},
        {"role": "user", "content": "[o] which cart?", "t": 3}, {"role": "assistant", "content": "I did not take any action. I misspoke.", "t": 4},
        {"role": "user", "content": "[o] hello", "t": 5}, {"role": "assistant", "content": "Hi there.", "t": 6}], raising=False)
    got = [x["content"] for x in m.recent()]
    assert got == ["[o] hello", "Hi there."]


def test_a_first_line_that_echoes_the_question_is_dropped(tmp_path, monkeypatch):
    chat = load(tmp_path, monkeypatch)
    assert chat._strip_echo("how's it going?", "how's it going?  \nquiet night. -- Lacuna") == "quiet night. -- Lacuna"
    assert chat._strip_echo("how's it going?", "quiet night. -- Lacuna") == "quiet night. -- Lacuna"
    assert chat._MACHINE_TALK.search("the studio\u2019s running smooth".replace("\u2019", "'"))


def test_the_hand_over_a_deep_turn_goes_to_the_deep_model_and_a_quick_turn_stays(tmp_path, monkeypatch):
    # the owner, 2026-10-11: "the 8B does most of the work … the 27B as a coder that takes over, like a handover"
    chat = load(tmp_path, monkeypatch)
    used = []

    def fake(messages, tools, model, job="ops"):
        used.append((model, job))
        return {"message": {"content": "Done. -- Lacuna"}}
    monkeypatch.setattr(chat, "_ollama", fake)
    monkeypatch.setattr(chat, "MODEL", "quick-8b")
    monkeypatch.setattr(chat, "MODEL_DEEP", "deep-27b")
    monkeypatch.setattr(chat.memory, "remember", lambda *a, **k: None)
    monkeypatch.setattr(chat.memory, "recent", lambda n=20: [])
    monkeypatch.setattr(chat.memory, "journal_tail", lambda n=8: "")
    monkeypatch.setattr(chat, "machine_note", lambda: "")
    monkeypatch.setattr(chat.threading, "Thread", lambda *a, **k: type("T", (), {"start": lambda self: None})())
    chat.ask("write me a python function that parses this log", dry=True, job="code")
    chat.ask("what's up?", dry=True, job="ops")
    chat.ask("write it anyway", dry=True, job="code", model="pinned-model")
    assert used[0][0] == "deep-27b"
    assert used[1] == ("quick-8b", "ops") or used[1][0] == "quick-8b"
    assert used[-1][0] == "pinned-model"     # a model the caller names is never swapped


def test_the_same_read_twice_in_a_turn_is_not_run_again(tmp_path, monkeypatch):
    """The walk, 2026-10-27: `watchdogs` five times in one turn. The second identical call is answered "same as before"."""
    chat = load(tmp_path, monkeypatch)
    ran = []
    call = {"function": {"name": "watchdogs", "arguments": {"name": "backup.fresh"}}}
    replies = iter([{"message": {"content": "", "tool_calls": [call]}}, {"message": {"content": "", "tool_calls": [call]}},
                    {"message": {"content": "backup.fresh is stale: the newest backup is 95.8 h old. Run the nightly. -- Lacuna"}}])
    monkeypatch.setattr(chat, "_ollama", lambda messages, tools, model, job="ops": next(replies))
    monkeypatch.setattr(chat, "call_tool", lambda name, args, who, dry=False: ran.append(name) or {"ok": True, "rows": [1]})
    monkeypatch.setattr(chat.memory, "remember", lambda *a, **k: None)
    monkeypatch.setattr(chat.memory, "recent", lambda n=20: [])
    monkeypatch.setattr(chat.memory, "journal_tail", lambda n=8: "")
    monkeypatch.setattr(chat, "machine_note", lambda: "")
    monkeypatch.setattr(chat.threading, "Thread", lambda *a, **k: type("T", (), {"start": lambda self: None})())
    out = chat.ask("a watchdog went red, which one?", dry=True)
    assert ran == ["watchdogs"]
    assert out["trace"][1]["result"]["same_as_before"] is True
