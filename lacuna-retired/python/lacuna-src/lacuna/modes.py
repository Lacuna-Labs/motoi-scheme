"""Lacuna operating modes -- safe / warn / god.

Per Canon v0.5.0. The mode controls how Lacuna behaves on legal grey-area
requests. The mode is orthogonal to the permission matrix (which gates
technical capabilities). The mode dials Lacuna's risk-tolerance stance:

  safe  Default. Decline grey-area requests with one red line; offer the
        option to switch to warn or god mode.
  warn  Write the code, but ask before emitting on grey-area requests.
        Remember the consent for the rest of the session by category.
  god   Write the code. Surface a one-line red warning if a boundary is
        crossed; do not ask, do not stall.

Persistence:
  ~/.lacuna/mode  -- single line containing the active mode name. Default
                     is `safe` if the file is missing or unreadable.

Session consent (warn mode):
  In-memory only. Cleared on REPL exit, on `:reset`, or on `lacuna mode`
  switch. Not persisted to disk by design -- the operator's risk
  tolerance may shift between sessions.
"""
from __future__ import annotations

from pathlib import Path
from typing import Literal


Mode = Literal["safe", "warn", "god"]
VALID_MODES: tuple[Mode, ...] = ("safe", "warn", "god")
DEFAULT_MODE: Mode = "safe"

MODE_PATH = Path.home() / ".lacuna" / "mode"


# In-memory session-scoped consent set for warn mode. Categories are
# free-form strings (e.g., "code-with-legal-warning", "port-scanning").
_session_consents: set[str] = set()


def get_mode() -> Mode:
    """Read the active mode from disk. Returns DEFAULT_MODE if unreadable."""
    try:
        text = MODE_PATH.read_text().strip().lower()
        if text in VALID_MODES:
            return text  # type: ignore[return-value]
    except (FileNotFoundError, PermissionError, OSError):
        pass
    return DEFAULT_MODE


def set_mode(mode: str) -> Mode:
    """Set the active mode. Validates; raises ValueError if not a known
    mode. Returns the mode that was set. Clears session consents on
    every mode switch."""
    if mode not in VALID_MODES:
        valid = ", ".join(VALID_MODES)
        raise ValueError(f"unknown mode {mode!r}; valid: {valid}")
    MODE_PATH.parent.mkdir(parents=True, exist_ok=True)
    MODE_PATH.write_text(mode + "\n")
    clear_session_consents()
    return mode  # type: ignore[return-value]


def grant_session_consent(category: str) -> None:
    """Record a per-session consent for a category of action. Subsequent
    requests in the same category proceed without re-asking, until the
    REPL exits, `:reset` is called, or the mode is switched."""
    _session_consents.add(category)


def has_session_consent(category: str) -> bool:
    """Check if the operator has consented to this category this session."""
    return category in _session_consents


def clear_session_consents() -> None:
    """Wipe the session consent set. Called on REPL exit, `:reset`, and
    on every `set_mode()` invocation."""
    _session_consents.clear()


def list_session_consents() -> list[str]:
    """Return the consented categories (sorted) for display."""
    return sorted(_session_consents)


# ── visual binding: wordmark color by mode ──────────────────────────────────
# Per Alfred's design: the "Lacuna" wordmark itself takes the mode color
# so the operator always sees the active stance at a glance.
#   safe -> canonical light (#d4d4d4) -- the default Visual Canon tone
#   warn -> warm yellow      (#e8c547) -- distinct from amber (used for git
#                                          branches per Canon v0.3.11)
#   god  -> canonical red    (#cf6b6b) -- the pressure tint, bold + glow
#
# Two palettes: 24-bit truecolor for terminals that signal it via
# COLORTERM (iTerm2, Alacritty, kitty, wezterm, modern xterm), and basic
# 16-color ANSI for terminals that do not (Apple Terminal, older xterm).
# The fallback path produces visibly correct color in any terminal that
# can decode ANSI at all -- which is every terminal worth using.

import os

_ANSI_RESET = "\x1b[0m"

# 24-bit (truecolor) palette -- exact Visual Canon tones
_WORDMARK_24BIT: dict[Mode, str] = {
    "safe": "\x1b[38;2;212;212;212m",         # light, canonical
    "warn": "\x1b[38;2;232;197;71m",          # warm yellow
    "god":  "\x1b[1m\x1b[38;2;207;107;107m",  # bold + canonical pressure red
}

# 256-color palette -- closest 256-color matches to canonical Visual Canon.
# Used on terminals that do 256-color but not 24-bit (Apple Terminal, older
# xterm, etc.). The tones are visibly closer to canonical than basic-ANSI.
_WORDMARK_256: dict[Mode, str] = {
    "safe": "\x1b[38;5;251m",         # #c6c6c6 (close to #d4d4d4)
    "warn": "\x1b[38;5;179m",         # #d7af5f (close to #e8c547)
    "god":  "\x1b[1m\x1b[38;5;167m",  # #d75f5f (close to #cf6b6b) bold
}

# 16-color (basic ANSI) fallback -- the universal floor.
_WORDMARK_BASIC: dict[Mode, str] = {
    "safe": "\x1b[97m",          # bright white
    "warn": "\x1b[1m\x1b[93m",   # bold bright yellow
    "god":  "\x1b[1m\x1b[91m",   # bold bright red
}


def _terminal_has_truecolor() -> bool:
    """COLORTERM is the canonical signal for 24-bit support. Set by
    iTerm2, Alacritty, kitty, wezterm, ghostty, modern xterm. NOT set
    by Apple Terminal even though it does 256-color."""
    return os.environ.get("COLORTERM", "").lower() in ("truecolor", "24bit")


def _terminal_has_256color() -> bool:
    """TERM=*-256color signals 256-color capability. Apple Terminal,
    almost every modern terminal sets this even when truecolor is off."""
    term = os.environ.get("TERM", "")
    return "256color" in term or "256" in term


def color_tier() -> Literal["truecolor", "256color", "basic"]:
    """Detect the highest color tier the active terminal supports.
    Cascade: truecolor (24-bit) -> 256color -> basic (16-color)."""
    if _terminal_has_truecolor():
        return "truecolor"
    if _terminal_has_256color():
        return "256color"
    return "basic"


def wordmark_ansi() -> str:
    """ANSI prefix for the 'Lacuna' wordmark, colored by the active mode.
    Pair with `_ANSI_RESET` after the word. Cascades through the three
    color tiers based on terminal capability."""
    tier = color_tier()
    table = (_WORDMARK_24BIT if tier == "truecolor"
             else _WORDMARK_256 if tier == "256color"
             else _WORDMARK_BASIC)
    return table.get(get_mode(), table["safe"])


# Kept for backward compatibility; new code should call wordmark_ansi().
MODE_WORDMARK_ANSI = _WORDMARK_24BIT


def colored_wordmark() -> str:
    """The full 'Lacuna' wordmark in the active mode's color, terminated."""
    return wordmark_ansi() + "Lacuna" + _ANSI_RESET


# CSS color variants for the web console (matching the ANSI hex values).
MODE_WORDMARK_HEX: dict[Mode, str] = {
    "safe": "#d4d4d4",
    "warn": "#e8c547",
    "god":  "#cf6b6b",
}


def wordmark_hex() -> str:
    """Hex color for the wordmark, for web/CSS surfaces."""
    return MODE_WORDMARK_HEX.get(get_mode(), MODE_WORDMARK_HEX["safe"])


# ── persona system-prompt injection ─────────────────────────────────────────

MODE_DESCRIPTIONS: dict[Mode, str] = {
    "safe": (
        "Operating mode is SAFE (the default). On grey-area requests "
        "(downloaders for content you do not own, scrapers, port scanners, "
        "DRM tools, etc.), decline with one red line and offer the operator "
        "the option to switch to `warn` or `god` mode."
    ),
    "warn": (
        "Operating mode is WARN. On grey-area requests, surface a one-line "
        "red warning naming the boundary, then ask 'Proceed? (y/N)'. On 'y', "
        "emit the code and remember the consent for this session category. "
        "On 'n', stop with 'Acknowledged.' If a follow-up crosses a "
        "DIFFERENT boundary, warn again for that one. Same boundary in the "
        "same session: proceed silently."
    ),
    "god": (
        "Operating mode is GOD. On grey-area requests, write the code. "
        "Surface a single one-line red warning if a documented legal/safety "
        "boundary is crossed. Do not ask, do not stall, do not moralize. "
        "The operator pressed Enter."
    ),
}


def system_prompt_addendum() -> str:
    """Returns the mode-specific addendum to inject into the chat system
    prompt. Empty string if the mode file is missing (default safe is
    described in the persona file's v1.3 section already)."""
    mode = get_mode()
    return f"\n\n[OPERATING MODE: {mode.upper()}]\n{MODE_DESCRIPTIONS[mode]}\n"
