"""LACUNA REMEMBERS: one conversation on disk across surfaces and restarts; a journal; recall by words."""
import importlib
import json


def load(tmp_path, monkeypatch):
    monkeypatch.setenv("LACUNA_HOME", str(tmp_path))
    monkeypatch.setenv("LACUNA_NO_WORKERS", "1")
    import lacuna_api.control.core as core
    importlib.reload(core)
    import lacuna_api.control.memory as memory
    importlib.reload(memory)
    return memory


def test_turns_from_every_surface_are_one_conversation_and_survive_a_restart(tmp_path, monkeypatch):
    memory = load(tmp_path, monkeypatch)
    memory.remember("user", "[Alfred] restart the tunnel when it wedges", "alfred", "dock")
    memory.remember("assistant", "Noted, Alfred. -- Lacuna", "lacuna", "dock")
    memory.remember("user", "[Alfred] what did I say about the tunnel?", "alfred", "cli")
    assert [m["role"] for m in memory.recent()] == ["user", "assistant", "user"]
    # a restart: the module reloads and reads the log back
    memory2 = load(tmp_path, monkeypatch)
    assert len(memory2.recent()) == 3
    assert "tunnel" in memory2.recent()[0]["content"]


def test_recall_finds_older_turns_and_journal_notes_by_their_words(tmp_path, monkeypatch):
    memory = load(tmp_path, monkeypatch)
    for i in range(60):
        memory.remember("user", f"[Alfred] filler {i}", "alfred", "dock")
    memory.remember("user", "[Alfred] the Foldio turntable spins the wrong way", "alfred", "dock")
    for i in range(80):          # the window moves in blocks (E1): it holds 2n–3n turns, so the old turn needs more after it
        memory.remember("assistant", f"filler answer {i}", "lacuna", "dock")
    assert not any("Foldio" in m["content"] for m in memory.recent())        # out of the window
    memory.journal_add("the Foldio turntable should spin clockwise by default")
    r = memory.recall("foldio turntable")
    assert r["ok"] and r["turns"] and "Foldio" in r["turns"][0]["said"]
    assert r["journal"] and "clockwise" in r["journal"][0]
    assert memory.recall("nothing-like-this")["turns"] == []


def test_the_window_and_the_fold_bookkeeping(tmp_path, monkeypatch):
    memory = load(tmp_path, monkeypatch)
    for i in range(30):
        memory.remember("user", f"[Alfred] q{i}", "alfred", "dock"); memory.remember("assistant", f"a{i}", "lacuna", "dock")
    assert len(memory.recent()) == 2 * memory.RECENT
    old = memory.needs_journal()
    assert old and old[0]["content"] == "[Alfred] q0"
    memory.mark_journaled(old[-1]["t"])
    assert memory.needs_journal() == []
    assert (tmp_path / "conversation.jsonl").exists()
    assert len((tmp_path / "conversation.jsonl").read_text().splitlines()) == 60


def test_forget_all_is_his_hand_and_is_audited(tmp_path, monkeypatch):
    memory = load(tmp_path, monkeypatch)
    memory.remember("user", "x", "alfred", "dock"); memory.journal_add("y")
    memory.forget_all("alfred")
    assert memory.recent() == [] and memory.journal_tail() == ""
    acts = [json.loads(l)["action"] for l in (tmp_path / "audit.jsonl").read_text().splitlines()]
    assert "memory.cleared" in acts


def test_the_conversation_is_paged_newest_last(tmp_path, monkeypatch):
    memory = load(tmp_path, monkeypatch)
    for i in range(45):
        memory.remember("user", f"[Alfred] q{i}", "alfred", "dock"); memory.remember("assistant", f"a{i}", "lacuna", "dock")
    last = memory.page(None, 30)
    assert len(last["turns"]) == 30 and last["turns"][-1]["content"] == "a44" and last["more"] is True
    earlier = memory.page(last["turns"][0]["t"], 30)
    assert len(earlier["turns"]) == 30 and earlier["turns"][-1]["content"] == "a29" and earlier["more"] is True
    first = memory.page(earlier["turns"][0]["t"], 30)
    assert len(first["turns"]) == 30 and first["turns"][0]["content"] == "[Alfred] q0" and first["more"] is False


def test_a_new_voice_starts_a_fresh_window(tmp_path, monkeypatch):
    """Turns said before the prompt last changed do not ride in the window (they stay on disk and under recall)."""
    from lacuna_api.control import memory
    monkeypatch.setattr(memory, "CONVERSATION", tmp_path / "c.jsonl")
    monkeypatch.setattr(memory, "_turns", [])
    memory.remember("user", "hey", "alfred", "dock")
    memory.remember("assistant", "services: all up. -- Lacuna", "lacuna", "dock")
    memory._turns[0]["t"], memory._turns[1]["t"] = 100.0, 101.0
    monkeypatch.setattr(memory, "voice_since", lambda: 200.0)
    assert memory.recent() == []
    memory._turns[1]["t"] = 201.0                # an assistant turn alone never leads the window
    assert memory.recent() == []
    memory.remember("user", "hey again", "alfred", "dock")
    assert [m["content"] for m in memory.recent()] == ["hey again"]


def test_a_card_window_never_carries_the_foremans_turns_or_a_leaked_thought(tmp_path, monkeypatch):
    """2026-10-27: "hello" from the E4B's card was answered as the foreman's standing task, and leaked thought rode as words."""
    memory = load(tmp_path, monkeypatch)
    memory.remember("user", "[foreman:press] continue your standing task", "foreman", "foreman")
    memory.remember("assistant", "Thinking Process: 1. Analyze the Request: stop reading", "lacuna", "foreman")
    memory.remember("user", "what is the weather", "alfred", "home")
    memory.remember("assistant", "Thinking Process:\n1. **Analyze** the ask… It is sunny.", "lacuna", "home")
    memory.remember("user", "hello", "alfred", "card:s-agents")
    texts = [m["content"] for m in memory.recent(card="s-agents")]
    assert not any("standing task" in t for t in texts)
    assert not any(t.startswith("Thinking Process") for t in texts)
    assert any("hello" in t for t in texts)
    assert not any("weather" in t for t in texts)   # a leaked answer leaves with the question it answered (the window never holds half a pair)
