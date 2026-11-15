"""End-to-end coverage of the /ctl/* surface that lacuna-web depends on.

These tests boot the FastAPI app via TestClient (no real network) and
assert each endpoint's contract: shape of the response, that obvious
errors are surfaced as HTTP errors not silent 200s, and that state
operations round-trip through ~/.lacuna/.
"""
from __future__ import annotations

import json
from pathlib import Path


# ── liveness ────────────────────────────────────────────────────────────────

def test_healthz(app_client):
    r = app_client.get("/healthz")
    assert r.status_code == 200
    body = r.json()
    assert body["ok"] is True
    assert body["service"] == "lacuna-api"
    assert "version" in body


# ── /ctl/status ─────────────────────────────────────────────────────────────

def test_ctl_status_shape(app_client):
    r = app_client.get("/ctl/status")
    assert r.status_code == 200
    body = r.json()
    # Required fields per the lacuna-web contract.
    for key in ("version", "service", "env", "host", "port", "pid",
                "uptime_seconds", "pilot", "recent_errors", "error_count",
                "companions", "cwd", "git_branch", "user", "hostname"):
        assert key in body, f"missing {key!r} in /ctl/status"
    assert body["service"] == "lacuna-api"
    assert isinstance(body["recent_errors"], list)
    assert isinstance(body["companions"], dict)


def test_ctl_status_companions_shape(app_client):
    r = app_client.get("/ctl/status")
    body = r.json()
    for name, info in body["companions"].items():
        assert "port" in info
        assert "status" in info
        assert info["status"] in ("up", "down")


# ── /ctl/errors round-trip ─────────────────────────────────────────────────

def test_ctl_errors_empty_on_fresh_home(app_client):
    r = app_client.get("/ctl/errors")
    assert r.status_code == 200
    assert r.json() == {"count": 0, "errors": []}


def test_ctl_errors_round_trip(app_client, lacuna_home):
    # Seed an error directly via state module.
    from lacuna import state as lacuna_state
    lacuna_state.log_error("test", "boom", context={"flavor": "regression"})

    r = app_client.get("/ctl/errors")
    body = r.json()
    assert body["count"] == 1
    assert body["errors"][0]["message"] == "boom"
    assert body["errors"][0]["context"]["flavor"] == "regression"


def test_ctl_errors_clear(app_client, lacuna_home):
    from lacuna import state as lacuna_state
    lacuna_state.log_error("test", "first")
    lacuna_state.log_error("test", "second")

    r = app_client.post("/ctl/errors/clear")
    assert r.status_code == 200
    assert r.json() == {"cleared": 2}

    r2 = app_client.get("/ctl/errors")
    assert r2.json()["count"] == 0


# ── /ctl/pilot ──────────────────────────────────────────────────────────────

def test_ctl_set_pilot_round_trip(app_client):
    r = app_client.post("/ctl/pilot", json={"pilot": "claude"})
    assert r.status_code == 200
    assert r.json() == {"pilot": "claude", "ok": True}

    status = app_client.get("/ctl/status").json()
    assert status["pilot"] == "claude"


def test_ctl_set_pilot_validates_body(app_client):
    r = app_client.post("/ctl/pilot", json={})
    assert r.status_code == 422  # pydantic validation


# ── /ctl/host (cache parser) ────────────────────────────────────────────────

def test_ctl_host_no_cache(app_client):
    r = app_client.get("/ctl/host")
    assert r.status_code == 200
    body = r.json()
    assert body["stale"] is True
    assert body["cpu"] == 0


def test_ctl_host_reads_cache(app_client, lacuna_home):
    cache = lacuna_home / "host.cache"
    cache.write_text("cpu=42 mem=73 disk=18")
    r = app_client.get("/ctl/host")
    body = r.json()
    assert body["cpu"] == 42
    assert body["mem"] == 73
    assert body["disk"] == 18
    assert "age_seconds" in body


def test_ctl_host_ignores_garbage_tokens(app_client, lacuna_home):
    """A malformed cache should not crash the endpoint — silent fallback."""
    cache = lacuna_home / "host.cache"
    cache.write_text("cpu=abc mem= 73 garbage disk=99")
    r = app_client.get("/ctl/host")
    assert r.status_code == 200
    body = r.json()
    assert body["disk"] == 99
    assert body["cpu"] == 0  # garbage value ignored


# ── /ctl/llm-status ─────────────────────────────────────────────────────────

def test_ctl_llm_status_shape(app_client):
    r = app_client.get("/ctl/llm-status")
    assert r.status_code == 200
    body = r.json()
    for key in ("backend", "forced", "model", "key_source", "key_prefix",
                "key_length", "shadowed", "unhealthy", "recent_errors",
                "precedence", "ollama"):
        assert key in body
    assert body["backend"] in ("local", "deepseek", "anthropic", "openai", "echo")


# ── /ctl/ai/backends ────────────────────────────────────────────────────────

def test_ctl_ai_backends_lists_all(app_client):
    r = app_client.get("/ctl/ai/backends")
    assert r.status_code == 200
    body = r.json()
    names = {b["name"] for b in body["backends"]}
    assert names == {"local", "deepseek", "anthropic", "openai", "echo"}


def test_ctl_ai_backends_echo_always_available(app_client):
    body = app_client.get("/ctl/ai/backends").json()
    echo = next(b for b in body["backends"] if b["name"] == "echo")
    assert echo["available"] is True


# ── /ctl/ai/reset ───────────────────────────────────────────────────────────

def test_ctl_ai_reset_clears_unhealthy(app_client):
    from lacuna import llm as lacuna_llm
    lacuna_llm._UNHEALTHY.add("deepseek")
    lacuna_llm._UNHEALTHY.add("anthropic")

    r = app_client.post("/ctl/ai/reset", json={})
    assert r.status_code == 200
    body = r.json()
    assert "deepseek" in body["cleared"]
    assert "anthropic" in body["cleared"]
    assert lacuna_llm._UNHEALTHY == set()


def test_ctl_ai_reset_targeted(app_client):
    from lacuna import llm as lacuna_llm
    lacuna_llm._UNHEALTHY = {"deepseek", "anthropic"}

    r = app_client.post("/ctl/ai/reset", json={"backend": "deepseek"})
    body = r.json()
    assert body["cleared"] == ["deepseek"]
    assert "anthropic" in body["still_unhealthy"]


# ── /ctl/pilot-config ──────────────────────────────────────────────────────

def test_ctl_pilot_config_defaults_when_absent(app_client):
    r = app_client.get("/ctl/pilot-config")
    body = r.json()
    assert body["pilot"] == "local"
    assert body["copilot"] == "deepseek"
    assert body["mode"] == "fallback"


def test_ctl_pilot_config_round_trip(app_client):
    r = app_client.post("/ctl/pilot-config",
                        json={"pilot": "deepseek", "copilot": "openai", "mode": "race"})
    assert r.status_code == 200
    assert r.json()["ok"] is True

    r2 = app_client.get("/ctl/pilot-config").json()
    assert r2["pilot"] == "deepseek"
    assert r2["copilot"] == "openai"
    assert r2["mode"] == "race"


def test_ctl_pilot_config_rejects_unknown_backend(app_client):
    r = app_client.post("/ctl/pilot-config",
                        json={"pilot": "claude4", "copilot": "openai", "mode": "race"})
    body = r.json()
    assert body["ok"] is False
    assert "unknown pilot" in body["error"].lower()


def test_ctl_pilot_config_rejects_unknown_mode(app_client):
    r = app_client.post("/ctl/pilot-config",
                        json={"pilot": "local", "copilot": "openai", "mode": "warp"})
    body = r.json()
    assert body["ok"] is False
    assert "unknown mode" in body["error"].lower()


# ── /ctl/ai/rag, /ctl/config, /ctl/playbooks ───────────────────────────────
# These import lacuna.{rag,config,playbooks} lazily. Cover the not-importable
# fallback path; live behavior is exercised by the modules' own tests.

def test_ctl_ai_rag_handles_missing_module(app_client, monkeypatch):
    import sys
    monkeypatch.setitem(sys.modules, "lacuna.rag", None)
    r = app_client.get("/ctl/ai/rag")
    body = r.json()
    # Either it imported fine and returned stats, or it surfaced the
    # not-importable note. Both are acceptable; what we don't allow is a 500.
    assert r.status_code == 200


def test_ctl_config_returns_payload(app_client):
    r = app_client.get("/ctl/config")
    assert r.status_code == 200
    body = r.json()
    assert "available" in body


def test_ctl_playbooks_lists(app_client):
    r = app_client.get("/ctl/playbooks")
    assert r.status_code == 200
    body = r.json()
    assert "playbooks" in body
    assert isinstance(body["playbooks"], list)


# ── /ctl/chat — operator chat with backend fallback ────────────────────────

def test_ctl_chat_empty_messages(app_client):
    r = app_client.post("/ctl/chat", json={"messages": []})
    assert r.status_code == 200
    assert r.json()["content"] == "(empty conversation)"


def test_ctl_chat_echo_when_no_backend(app_client, monkeypatch):
    """With no API keys + ollama unreachable, echo backend answers."""
    # Force ollama unreachable.
    from lacuna import llm as lacuna_llm
    monkeypatch.setattr(lacuna_llm, "probe_ollama", lambda *a, **kw: (False, []))
    # Strip API keys.
    for k in ("DEEPSEEK_API_KEY", "ANTHROPIC_API_KEY", "OPENAI_API_KEY",
             "LACUNA_LLM_BACKEND"):
        monkeypatch.delenv(k, raising=False)

    r = app_client.post("/ctl/chat",
                        json={"messages": [{"role": "user", "content": "hi"}]})
    assert r.status_code == 200
    body = r.json()
    assert body["role"] == "assistant"
    assert "(echo)" in body["content"]
    assert body["cards"] == []


def test_ctl_chat_fallback_on_bracket_error(app_client, monkeypatch):
    """When the chosen backend returns a [error]-prefixed reply (the
    convention `lacuna.llm` uses for 402/429/etc), select_backend should
    re-pick. Verify the retry loop runs by counting select_backend calls."""
    from lacuna import llm as lacuna_llm

    call_count = {"n": 0}
    fake_backends = [
        type("B1", (), {"info": type("I", (), {"name": "deepseek"})(),
                        "chat": lambda self, s, m: "[deepseek 402] out of credits"})(),
        type("B2", (), {"info": type("I", (), {"name": "echo"})(),
                        "chat": lambda self, s, m: "real reply"})(),
    ]

    def fake_select(*a, **kw):
        i = min(call_count["n"], len(fake_backends) - 1)
        call_count["n"] += 1
        return fake_backends[i]

    monkeypatch.setattr(lacuna_llm, "select_backend", fake_select)
    monkeypatch.setattr(lacuna_llm, "load_persona_prompt", lambda *a, **kw: "system")

    r = app_client.post("/ctl/chat",
                        json={"messages": [{"role": "user", "content": "hi"}]})
    body = r.json()
    assert "real reply" in body["content"]
    assert "switched to echo" in body["content"]
    assert call_count["n"] == 2
