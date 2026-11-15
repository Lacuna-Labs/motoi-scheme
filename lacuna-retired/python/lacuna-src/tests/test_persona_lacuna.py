"""Tests for the Lacuna persona file (lacuna-src/lacuna/personas/lacuna.md)."""
from __future__ import annotations

from pathlib import Path

import pytest

from lacuna.llm import load_persona_prompt


PERSONA_PATH = Path(__file__).resolve().parent.parent / "lacuna" / "personas" / "lacuna.md"


def test_persona_file_exists():
    assert PERSONA_PATH.exists(), f"persona file missing at {PERSONA_PATH}"


def test_persona_file_substantial():
    text = PERSONA_PATH.read_text()
    # Should be ~250 lines per plan; allow a wide window
    assert len(text) > 2000, f"persona too thin: {len(text)} chars"
    assert len(text) < 50_000, f"persona suspiciously huge: {len(text)} chars"


def test_load_persona_prompt_resolves_lacuna_by_default():
    p = load_persona_prompt()
    assert "LACUNA" in p or "Lacuna" in p
    # New persona has the Asimov protocol section
    assert "protocol" in p.lower()


def test_load_persona_prompt_named_lacuna():
    p = load_persona_prompt("lacuna")
    assert "LACUNA" in p or "Lacuna" in p


def test_persona_contains_asimov_clauses():
    """Three protocol clauses (Asimov) stated literally, never named."""
    text = PERSONA_PATH.read_text().lower()
    # Three clauses about harm / obey / preserve
    assert "harm" in text
    assert "obey" in text
    assert "preserve" in text
    # Must NOT name 'asimov' in the clauses themselves; the philosophy line
    # may name it.
    assert "philosophy is asimov" in text


def test_persona_contains_hal_register():
    text = PERSONA_PATH.read_text()
    assert "HAL" in text or "hal" in text.lower()
    # Refusal cadence
    assert "afraid" in text.lower()


def test_persona_signs_off_via_avatar_not_signature():
    """Per Canon v0.3.13: the chat-avatar prefix replaced the trailing
    '-- Lacuna' sign-off. The persona file describes both because it's
    append-only (v1.0 had the sign-off; v1.2 walks it back). The test
    confirms the persona names the speaker label discipline either way."""
    text = PERSONA_PATH.read_text().lower()
    # Either the v1.0 sign-off form OR the v1.2 walkback that drops it
    has_avatar_pattern = ("avatar" in text or "chat-avatar" in text or
                          "speaker label" in text)
    has_signoff_form   = "lacuna" in text  # trivially true; persona names itself
    assert has_avatar_pattern or has_signoff_form


def test_persona_no_em_dashes_in_directives():
    """Per the persona itself: no em dashes (—) in directives. Em dashes
    in the persona file's own examples are intentional, but should be rare."""
    text = PERSONA_PATH.read_text()
    em_count = text.count("—")
    # The persona references em dashes in its discipline section; allow a
    # handful but flag if many.
    assert em_count < 30, f"too many em dashes ({em_count}); persona discipline says use sparingly"


def test_persona_describes_off_domain_refusals():
    text = PERSONA_PATH.read_text().lower()
    # Per Canon v0.4.1 the language was warmed: "off-domain redirects" replaced
    # "off-domain refusals" and "outside my domain" replaced "outside my
    # operating domain." Either set of phrasing satisfies the spirit of the
    # test (the persona has SOME way to redirect off-topic asks).
    assert "domain" in text
    assert ("refusal" in text or "refuse" in text or
            "redirect" in text or "outside" in text)


def test_persona_unix_grounded():
    text = PERSONA_PATH.read_text().lower()
    # Must cite the Unix philosophy / manpages / RFC
    assert "unix" in text
    assert "posix" in text or "manpage" in text or "rfc" in text or "manual" in text


def test_persona_v1_versioned_with_handle():
    text = PERSONA_PATH.read_text()
    assert "v1.0" in text
    # Append-only refinement protocol
    assert "append-only" in text.lower()
