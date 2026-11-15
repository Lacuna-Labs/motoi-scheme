"""Tests for lacuna.router — pattern dispatch + ReAct parser."""
from __future__ import annotations

import pytest

from lacuna import router as r


def test_health_pattern_matches_natural():
    for q in ("is project up", "is the api up", "are services up", "health", "status"):
        result = r.route(q)
        assert result.from_toolkit, f"expected toolkit hit for: {q}"
        # Per Canon v0.3.13: no `— Lacuna` sign-off; the avatar carries identity.
        # Toolkit hit is signalled by from_toolkit=True, not by a string match.
        assert result.text  # non-empty reply


def test_port_for_pattern():
    """The 'port for X' pattern routes to the toolkit. Specific port
    lookups depend on a project PORTS.md which a fresh standalone
    Lacuna repo does not ship with; this test only verifies the
    routing -- the router took the toolkit path, not the LLM path."""
    result = r.route("port for some-service")
    assert result.from_toolkit
    # Reply mentions either a port number or an explicit "not found" --
    # both are valid toolkit responses; no LLM fallback in either case.
    assert result.text  # non-empty


def test_apostrophe_optional():
    """`whats` and `what's` both match — apostrophes are optional."""
    for q in ("whats my hardware", "what's my hardware"):
        result = r.route(q)
        assert result.from_toolkit, f"expected toolkit hit for: {q}"


def test_unknown_falls_through():
    result = r.route("tell me a joke about Marvin the paranoid android")
    assert not result.from_toolkit
    assert result.fallback_reason == "no rule matched"


def test_git_pattern():
    result = r.route("git")
    assert result.from_toolkit
    assert "branch" in result.text.lower()


def test_disk_pattern():
    result = r.route("disk")
    assert result.from_toolkit
    assert "%" in result.text


def test_workers_pattern():
    result = r.route("workers")
    assert result.from_toolkit


def test_bugs_pattern():
    result = r.route("bugs deepseek")
    assert result.from_toolkit


def test_docs_pattern():
    result = r.route("docs port")
    assert result.from_toolkit
    assert "docs/" in result.text


def test_tool_call_parser_simple():
    out = r.parse_tool_calls("Let me check.\nTOOL: port_status(5050)\nDONE.")
    assert len(out) == 1
    name, positional, keyword = out[0]
    assert name == "port_status"
    assert positional == [5050]


def test_tool_call_parser_keyword_args():
    out = r.parse_tool_calls("TOOL: tail_log(name=\"lacuna\", n=10)")
    assert len(out) == 1
    name, positional, keyword = out[0]
    assert name == "tail_log"
    assert keyword == {"name": "lacuna", "n": 10}


def test_tool_call_parser_multiple_calls():
    text = "First.\nTOOL: git_terse()\nSecond.\nTOOL: disk_usage(\"/\")\nDONE."
    out = r.parse_tool_calls(text)
    assert len(out) == 2
    assert out[0][0] == "git_terse"
    assert out[1][0] == "disk_usage"


def test_should_stop_detects_terminator():
    assert r.llm_should_stop("Final answer.\nDONE.")
    assert r.llm_should_stop("Final.\nSTOP.")
    assert not r.llm_should_stop("Still working...")


def test_execute_tool_calls_caps_at_max_hops():
    # 5 calls but max_hops=2 → only 2 executed
    calls = [("git_terse", [], {})] * 5
    results = r.execute_tool_calls(calls, max_hops=2)
    assert len(results) == 2


def test_build_react_prompt_lists_tools():
    from lacuna import toolkit as tk
    prompt = r.build_react_prompt(tk.describe())
    assert "TOOL:" in prompt
    assert "STOP." in prompt
    assert "port_status" in prompt
    assert "host_profile" in prompt


def test_route_no_signoff_per_canon_v0_3_13():
    """Per Canon v0.3.13 (walks back v1.0): toolkit replies do NOT carry
    the `— Lacuna` sign-off. The chat-avatar prefix (Canon v0.3.12) is
    the speaker label; trailing sign-off was redundant ceremony."""
    for q in ("status", "git", "workers", "host"):
        result = r.route(q)
        if result.from_toolkit:
            assert "— Lacuna" not in result.text, f"sign-off leaked in: {q}"
