"""Test config — autouse fixtures for the whole pytest run.

Why this exists: v2.2 added Ollama-as-default-backend. When Alfred runs
`lacuna up`, Ollama answers on localhost:11434 and `select_backend` picks
`local` first. But the LLM tests were written before that change and
assume only-cloud-keys-or-echo behavior. Without intervention they all
fail when Ollama happens to be running on the dev box.

Fix: autouse fixture that stubs `lacuna.llm.probe_ollama` to return
`(False, [])`. Tests that want to assert the local-backend path explicitly
can monkeypatch it back. Same fixture also clears the in-process unhealthy
set so 402-detection tests don't poison each other.
"""
from __future__ import annotations

import pytest


@pytest.fixture(autouse=True)
def _stub_ollama_probe(monkeypatch):
    """By default, tests run as if Ollama is not installed.

    A specific test that wants to verify the local-backend path can call
    `monkeypatch.setattr('lacuna.llm.probe_ollama', lambda *a, **kw: (True, ['qwen2.5:3b-instruct']))`
    inside the test body to override.
    """
    try:
        from lacuna import llm as _llm
    except ImportError:
        return
    monkeypatch.setattr(_llm, "probe_ollama", lambda *a, **kw: (False, []))
    yield


@pytest.fixture(autouse=True)
def _clear_unhealthy():
    """Reset _UNHEALTHY between tests — they share module state."""
    try:
        from lacuna import llm as _llm
    except ImportError:
        yield
        return
    _llm._UNHEALTHY.clear()
    _llm._LAST_RESULT.clear()
    yield
    _llm._UNHEALTHY.clear()
    _llm._LAST_RESULT.clear()
