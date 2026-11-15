"""Tests for lacuna.modes -- safe / warn / god operating modes."""
from __future__ import annotations

import pytest

from lacuna import modes


@pytest.fixture(autouse=True)
def isolated_mode_path(tmp_path, monkeypatch):
    """Redirect mode storage to a temp file per test."""
    monkeypatch.setattr(modes, "MODE_PATH", tmp_path / "mode")
    modes.clear_session_consents()
    yield
    modes.clear_session_consents()


def test_default_mode_is_safe():
    assert modes.get_mode() == "safe"


def test_set_mode_safe():
    assert modes.set_mode("safe") == "safe"
    assert modes.get_mode() == "safe"


def test_set_mode_warn():
    modes.set_mode("warn")
    assert modes.get_mode() == "warn"


def test_set_mode_god():
    modes.set_mode("god")
    assert modes.get_mode() == "god"


def test_set_mode_rejects_unknown():
    with pytest.raises(ValueError):
        modes.set_mode("yolo")


def test_set_mode_persists_to_disk():
    modes.set_mode("warn")
    assert modes.MODE_PATH.read_text().strip() == "warn"


def test_set_mode_clears_session_consents():
    modes.grant_session_consent("test-category")
    assert modes.has_session_consent("test-category")
    modes.set_mode("warn")
    assert not modes.has_session_consent("test-category")


def test_session_consent_grant_and_check():
    assert not modes.has_session_consent("foo")
    modes.grant_session_consent("foo")
    assert modes.has_session_consent("foo")


def test_session_consent_idempotent():
    modes.grant_session_consent("bar")
    modes.grant_session_consent("bar")
    assert modes.list_session_consents() == ["bar"]


def test_clear_session_consents():
    modes.grant_session_consent("a")
    modes.grant_session_consent("b")
    modes.clear_session_consents()
    assert modes.list_session_consents() == []


def test_list_session_consents_sorted():
    modes.grant_session_consent("zebra")
    modes.grant_session_consent("alpha")
    modes.grant_session_consent("middle")
    assert modes.list_session_consents() == ["alpha", "middle", "zebra"]


def test_get_mode_falls_back_on_missing_file():
    # Fresh monkeypatched path; file does not exist
    assert not modes.MODE_PATH.exists()
    assert modes.get_mode() == "safe"


def test_get_mode_falls_back_on_corrupt_content():
    modes.MODE_PATH.parent.mkdir(parents=True, exist_ok=True)
    modes.MODE_PATH.write_text("not-a-valid-mode\n")
    assert modes.get_mode() == "safe"


def test_system_prompt_addendum_includes_mode():
    modes.set_mode("warn")
    addendum = modes.system_prompt_addendum()
    assert "WARN" in addendum
    assert "Proceed?" in addendum


def test_system_prompt_addendum_safe_mode():
    modes.set_mode("safe")
    addendum = modes.system_prompt_addendum()
    assert "SAFE" in addendum
    assert "decline" in addendum.lower()


def test_system_prompt_addendum_god_mode():
    modes.set_mode("god")
    addendum = modes.system_prompt_addendum()
    assert "GOD" in addendum
    assert "do not ask" in addendum.lower()


# ── wordmark color binding (Canon v0.5.1) ───────────────────────────────────

def test_wordmark_ansi_safe_mode(monkeypatch):
    """Three-tier cascade: truecolor -> 256-color -> basic."""
    modes.set_mode("safe")
    # Truecolor
    monkeypatch.setenv("COLORTERM", "truecolor")
    monkeypatch.setenv("TERM", "xterm-256color")
    assert modes.wordmark_ansi() == "\x1b[38;2;212;212;212m"
    # 256-color (truecolor off, 256-color TERM set)
    monkeypatch.setenv("COLORTERM", "")
    monkeypatch.setenv("TERM", "xterm-256color")
    assert modes.wordmark_ansi() == "\x1b[38;5;251m"
    # Basic (no truecolor, no 256-color)
    monkeypatch.setenv("COLORTERM", "")
    monkeypatch.setenv("TERM", "xterm")
    assert modes.wordmark_ansi() == "\x1b[97m"


def test_wordmark_ansi_warn_mode(monkeypatch):
    modes.set_mode("warn")
    monkeypatch.setenv("COLORTERM", "truecolor")
    assert "232;197;71" in modes.wordmark_ansi()  # warm yellow truecolor
    monkeypatch.setenv("COLORTERM", "")
    monkeypatch.setenv("TERM", "xterm-256color")
    assert "38;5;179" in modes.wordmark_ansi()  # warm gold 256
    monkeypatch.setenv("TERM", "xterm")
    assert "93" in modes.wordmark_ansi()  # bright yellow basic


def test_wordmark_ansi_god_mode(monkeypatch):
    modes.set_mode("god")
    monkeypatch.setenv("COLORTERM", "truecolor")
    ansi = modes.wordmark_ansi()
    assert "\x1b[1m" in ansi
    assert "207;107;107" in ansi
    monkeypatch.setenv("COLORTERM", "")
    monkeypatch.setenv("TERM", "xterm-256color")
    ansi = modes.wordmark_ansi()
    assert "\x1b[1m" in ansi
    assert "38;5;167" in ansi  # 256-color reddish
    monkeypatch.setenv("TERM", "xterm")
    ansi = modes.wordmark_ansi()
    assert "\x1b[1m" in ansi
    assert "91" in ansi


def test_color_tier_detection(monkeypatch):
    """color_tier() reflects terminal capability."""
    monkeypatch.setenv("COLORTERM", "truecolor")
    assert modes.color_tier() == "truecolor"
    monkeypatch.setenv("COLORTERM", "")
    monkeypatch.setenv("TERM", "xterm-256color")
    assert modes.color_tier() == "256color"
    monkeypatch.setenv("TERM", "xterm")
    assert modes.color_tier() == "basic"


def test_colored_wordmark_includes_lacuna_text_and_reset():
    modes.set_mode("warn")
    word = modes.colored_wordmark()
    assert "Lacuna" in word
    assert word.endswith("\x1b[0m")


def test_wordmark_hex_per_mode():
    modes.set_mode("safe");  assert modes.wordmark_hex() == "#d4d4d4"
    modes.set_mode("warn");  assert modes.wordmark_hex() == "#e8c547"
    modes.set_mode("god");   assert modes.wordmark_hex() == "#cf6b6b"
