"""Tests for lacuna/llm.py — backend selection + persona prompt load."""
import pytest


@pytest.fixture(autouse=True)
def clean_env(monkeypatch):
    """Scrub process env so auto-detection is deterministic."""
    for k in ("LACUNA_LLM_BACKEND", "LACUNA_LLM_MODEL",
              "DEEPSEEK_API_KEY", "ANTHROPIC_API_KEY", "OPENAI_API_KEY"):
        monkeypatch.delenv(k, raising=False)


def test_load_persona_prompt_basic_shape():
    """Persona loads, is non-trivial, and contains the expected
    behavioral anchors. The specific safety-keyword list shifted with
    Canon v0.4.1's warmth-band rewrite; test_persona_lacuna.py is the
    definitive persona-content test."""
    from lacuna.llm import load_persona_prompt
    txt = load_persona_prompt()
    assert len(txt) > 500, "persona text too short"
    lower = txt.lower()
    assert "lacuna" in lower
    assert "operator" in lower


def test_echo_fallback_when_no_keys(tmp_path):
    from lacuna.llm import select_backend
    b = select_backend(env_file=tmp_path / "nope.env")
    assert b.info.name == "echo"


def test_echo_reply_is_deterministic(tmp_path):
    from lacuna.llm import select_backend
    b = select_backend(env_file=tmp_path / "nope.env")
    reply = b.chat("system", [{"role": "user", "content": "hi"}])
    assert "echo" in reply.lower()


def test_auto_selects_deepseek(monkeypatch, tmp_path):
    monkeypatch.setenv("DEEPSEEK_API_KEY", "sk-fake-deepseek")
    from lacuna.llm import select_backend
    b = select_backend(env_file=tmp_path / "nope.env")
    assert b.info.name == "deepseek"
    assert b.info.model == "deepseek-chat"


def test_auto_selects_anthropic_when_only_anthropic(monkeypatch, tmp_path):
    monkeypatch.setenv("ANTHROPIC_API_KEY", "sk-ant-fake")
    from lacuna.llm import select_backend
    b = select_backend(env_file=tmp_path / "nope.env")
    assert b.info.name == "anthropic"


def test_auto_selects_openai_when_only_openai(monkeypatch, tmp_path):
    monkeypatch.setenv("OPENAI_API_KEY", "sk-openai-fake")
    from lacuna.llm import select_backend
    b = select_backend(env_file=tmp_path / "nope.env")
    assert b.info.name == "openai"


def test_forced_backend_wins_when_available(monkeypatch, tmp_path):
    """If LACUNA_LLM_BACKEND is set and the key is present, it beats auto-order."""
    monkeypatch.setenv("LACUNA_LLM_BACKEND", "anthropic")
    monkeypatch.setenv("DEEPSEEK_API_KEY", "sk-fake")   # would otherwise win
    monkeypatch.setenv("ANTHROPIC_API_KEY", "sk-ant")
    from lacuna.llm import select_backend
    b = select_backend(env_file=tmp_path / "nope.env")
    assert b.info.name == "anthropic"


def test_forced_backend_falls_back_when_key_missing(monkeypatch, tmp_path):
    """LACUNA_LLM_BACKEND=anthropic but no key → fall back to auto."""
    monkeypatch.setenv("LACUNA_LLM_BACKEND", "anthropic")
    monkeypatch.setenv("DEEPSEEK_API_KEY", "sk-fake")
    from lacuna.llm import select_backend
    b = select_backend(env_file=tmp_path / "nope.env")
    assert b.info.name == "deepseek"


def test_model_override(monkeypatch, tmp_path):
    monkeypatch.setenv("DEEPSEEK_API_KEY", "sk-fake")
    monkeypatch.setenv("LACUNA_LLM_MODEL", "deepseek-reasoner")
    from lacuna.llm import select_backend
    b = select_backend(env_file=tmp_path / "nope.env")
    assert b.info.model == "deepseek-reasoner"


def test_env_file_provides_keys(monkeypatch, tmp_path):
    """Keys can come from an .env file — simulates the-api/.env."""
    env = tmp_path / ".env"
    env.write_text('DEEPSEEK_API_KEY="sk-from-file"\n')
    # Ensure no process-env DEEPSEEK key interferes
    from lacuna.llm import select_backend
    b = select_backend(env_file=env)
    assert b.info.name == "deepseek"


def test_forced_echo(monkeypatch, tmp_path):
    monkeypatch.setenv("LACUNA_LLM_BACKEND", "echo")
    monkeypatch.setenv("DEEPSEEK_API_KEY", "sk-fake")
    from lacuna.llm import select_backend
    b = select_backend(env_file=tmp_path / "nope.env")
    assert b.info.name == "echo"


# ── describe_backend: the diagnostic payload for /ctl/llm-status ─────────

def test_describe_reports_no_backend_when_empty(tmp_path):
    from lacuna.llm import describe_backend
    d = describe_backend(env_file=tmp_path / "nope.env")
    assert d["backend"] == "echo"
    assert d["key_source"] == "none"
    assert d["key_prefix"] is None
    assert d["shadowed"] is False


def test_describe_reports_env_file_source(tmp_path):
    env = tmp_path / ".env"
    env.write_text('DEEPSEEK_API_KEY="sk-2274fromfile-12345678901234567890"\n')
    from lacuna.llm import describe_backend
    d = describe_backend(env_file=env)
    assert d["backend"] == "deepseek"
    assert d["key_source"] == "env-file"
    assert d["shadowed"] is False
    assert d["key_prefix"].startswith("sk-22")
    assert "…" in d["key_prefix"]


def test_describe_reports_process_env_source(monkeypatch, tmp_path):
    monkeypatch.setenv("DEEPSEEK_API_KEY", "sk-from-shell-9999999999999")
    from lacuna.llm import describe_backend
    d = describe_backend(env_file=tmp_path / "nope.env")
    assert d["backend"] == "deepseek"
    assert d["key_source"] == "process-env"
    assert d["shadowed"] is False


def test_describe_detects_shadowing(monkeypatch, tmp_path):
    """The bug Alfred hit: .env has the new key, shell has stale old key."""
    env = tmp_path / ".env"
    env.write_text('DEEPSEEK_API_KEY="sk-NEW-topped-up-1234567890"\n')
    monkeypatch.setenv("DEEPSEEK_API_KEY", "sk-OLD-stale-export-9999")
    from lacuna.llm import describe_backend
    d = describe_backend(env_file=env)
    assert d["backend"] == "deepseek"
    assert d["key_source"] == "process-env"
    assert d["shadowed"] is True
    assert "unset DEEPSEEK_API_KEY" in d["shadow_note"]
    # Should be reporting the SHELL key prefix (what's actually in flight),
    # not the .env one. That's the point — "what does the server see?"
    assert "OLD" in d["key_prefix"] or d["key_prefix"].startswith("sk-OLD")


def test_describe_carries_last_http_status(monkeypatch, tmp_path):
    monkeypatch.setenv("DEEPSEEK_API_KEY", "sk-fake-9999")
    from lacuna.llm import describe_backend, _http_hint
    _http_hint(402, "deepseek")
    d = describe_backend(env_file=tmp_path / "nope.env")
    assert d["last_http_status"] == 402
    assert d["last_http_at"] is not None


def test_mask_key_formatting():
    from lacuna.llm import mask_key
    assert mask_key("sk-2274b30abc123xyz")[:6] == "sk-227"
    assert mask_key("sk-2274b30abc123xyz").endswith("3xyz")
    assert "…" in mask_key("sk-2274b30abc123xyz")
    assert mask_key("") == ""
