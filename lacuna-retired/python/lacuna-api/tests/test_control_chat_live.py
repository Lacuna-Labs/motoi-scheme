"""KNOW WHEN TO THINK, and the stream: the mode is chosen from the words; a streamed call yields thinking and tokens."""
import importlib
import io
import json


def load(tmp_path, monkeypatch):
    monkeypatch.setenv("LACUNA_HOME", str(tmp_path))
    monkeypatch.setenv("LACUNA_NO_WORKERS", "1")
    import lacuna_api.control.core as core
    importlib.reload(core)
    import lacuna_api.control.chat as chat
    importlib.reload(chat)
    return chat


def test_the_mode_is_chosen_from_the_words(tmp_path, monkeypatch):
    chat = load(tmp_path, monkeypatch)
    assert chat.choose_mode("restart the tunnel") == "fast"
    assert chat.choose_mode("is QA up?") == "fast"
    assert chat.choose_mode("hey") == "fast"
    assert chat.choose_mode("what's up") == "fast"
    assert chat.choose_mode("how are you doing?") == "fast"      # E1 (2026-10-18): fast unless the words ask for thought — the think switch broke the cached head
    assert chat.choose_mode("i like you") == "fast"
    assert chat.choose_mode("why did the promote stop last night?") == "deep"
    assert chat.choose_mode("how do you feel about apples?") == "deep"
    assert chat.choose_mode("should we release tonight or wait?") == "deep"
    assert chat.choose_mode("x " * 200) == "deep"


def test_a_streamed_call_yields_thinking_then_tokens_then_the_whole(tmp_path, monkeypatch):
    chat = load(tmp_path, monkeypatch)
    chunks = [{"message": {"thinking": "he asks "}}, {"message": {"thinking": "how I am"}}, {"message": {"content": "Fine, "}},
              {"message": {"content": "Alfred."}}, {"message": {"content": "", "tool_calls": []}, "done": True}]

    class R(io.BytesIO):
        def __enter__(self): return self
        def __exit__(self, *a): return False
    monkeypatch.setattr(chat.urllib.request, "urlopen", lambda req, timeout=0: R("".join(json.dumps(c) + "\n" for c in chunks).encode()))
    monkeypatch.setattr(chat.modelwatch, "record", lambda *a, **k: None)
    seen = []
    out = chat._ollama_stream([{"role": "user", "content": "hi"}], [], "qwen3:8b", "ops", seen.append)
    assert [e["type"] for e in seen] == ["thinking", "thinking", "token", "token", "usage"]
    assert out["message"]["content"] == "Fine, Alfred." and out["message"]["thinking"] == "he asks how I am"
    assert "tool_calls" not in out["message"]
