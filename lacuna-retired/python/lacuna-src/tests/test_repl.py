"""Tests for lacuna.repl -- pure chat REPL helpers.

The interactive run() loop is exercised manually; here we cover the
pure helpers (path shortening, tone mapping, host cache reading, color
detection). The cd / shell-exec helpers were removed in the v0.6
chat-only rewrite -- the REPL is no longer a wrapper shell. See
docs/lacuna-engineering.md and the new repl.py module docstring.
"""
from __future__ import annotations

import os
import time
from pathlib import Path

import pytest

from lacuna import repl


def test_short_path_keeps_short():
    assert repl._short_path("/a/b") == "/a/b"


def test_short_path_collapses_deep():
    """Absolute paths split with leading empty string before the slash; that's
    why parts[0]=='' and the output starts with '/'. Function trades the
    middle for ellipsis."""
    out = repl._short_path("/a/b/c/d/e/f")
    assert out.endswith("/e/f")
    assert "..." in out


def test_short_path_substitutes_home(monkeypatch, tmp_path):
    monkeypatch.setattr(Path, "home", classmethod(lambda cls: tmp_path))
    sub = str(tmp_path / "projects" / "foo")
    out = repl._short_path(sub)
    assert out.startswith("~")


def test_tone_low_returns_light():
    assert repl._tone(0) == repl._LIGHT
    assert repl._tone(49) == repl._LIGHT


def test_tone_mid():
    assert repl._tone(50) == repl._MID
    assert repl._tone(89) == repl._MID


def test_tone_dark():
    assert repl._tone(90) == repl._DARK
    assert repl._tone(94) == repl._DARK


def test_tone_red_pressure():
    # In the chat-only rewrite the pressure-tint ANSI moved from _RED
    # to _ROSE (canonical naming; same #cf6b6b tone). Tolerate both.
    pressure = getattr(repl, "_ROSE", None) or getattr(repl, "_RED", None)
    assert repl._tone(95) == pressure
    assert repl._tone(100) == pressure


def test_read_host_cache_missing_returns_zeros(tmp_path, monkeypatch):
    monkeypatch.setattr(Path, "home", classmethod(lambda cls: tmp_path))
    assert repl._read_host_cache() == (0, 0, 0)


def test_read_host_cache_parses_three(tmp_path, monkeypatch):
    monkeypatch.setattr(Path, "home", classmethod(lambda cls: tmp_path))
    cache = tmp_path / ".lacuna" / "host.cache"
    cache.parent.mkdir(parents=True)
    cache.write_text("cpu=42 mem=15 disk=88\n")
    assert repl._read_host_cache() == (42, 15, 88)


def test_read_host_cache_stale_returns_zeros(tmp_path, monkeypatch):
    monkeypatch.setattr(Path, "home", classmethod(lambda cls: tmp_path))
    cache = tmp_path / ".lacuna" / "host.cache"
    cache.parent.mkdir(parents=True)
    cache.write_text("cpu=42 mem=15 disk=88\n")
    # Make the file 60s old
    old = time.time() - 60
    os.utime(cache, (old, old))
    assert repl._read_host_cache() == (0, 0, 0)


def test_supports_truecolor(monkeypatch):
    monkeypatch.setenv("COLORTERM", "truecolor")
    assert repl._supports_truecolor() is True
    monkeypatch.setenv("COLORTERM", "")
    assert repl._supports_truecolor() is False
    monkeypatch.setenv("COLORTERM", "256color")
    assert repl._supports_truecolor() is False


def test_render_chat_avatar_includes_lacuna(monkeypatch):
    """Avatar is mark + Lacuna word per Canon v0.3.12."""
    monkeypatch.setenv("COLORTERM", "truecolor")
    avatar = repl._render_chat_avatar()
    assert "Lacuna" in avatar


def test_convo_history_starts_empty():
    repl._convo_reset()
    assert repl._CONVO_HISTORY == []


def test_convo_reset_clears():
    repl._CONVO_HISTORY.append({"role": "user", "content": "hello"})
    repl._convo_reset()
    assert repl._CONVO_HISTORY == []


def test_convo_trim_drops_oldest_pairs_over_budget():
    repl._convo_reset()
    big = "x" * 4000
    for _ in range(3):
        repl._CONVO_HISTORY.append({"role": "user", "content": big})
        repl._CONVO_HISTORY.append({"role": "assistant", "content": big})
    repl._convo_trim()
    total = sum(len(m["content"]) for m in repl._CONVO_HISTORY)
    assert total <= repl._CONVO_BUDGET_CHARS
    repl._convo_reset()


def test_short_path_trivial():
    """The short_path helper survives the rewrite (regression check)."""
    assert "/" in repl._short_path("/")
