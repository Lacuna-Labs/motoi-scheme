"""The Agents card's two keys (CARDS-2.0 §6.3, lane C3; the lead's integration 2026-10-24): "file a bug" and "wake the picked
one" file petitions that carry their args through the route; the press runs ticket-file through the foreman's agent-bug
playbook and broker-load through the gateway's warm-up under the broker's wall; a decline runs nothing."""


def test_the_route_keeps_the_cards_args(monkeypatch, lacuna_home):
    from lacuna_api.control import api, chat
    seen = {}
    monkeypatch.setattr(chat, "file_petition", lambda action, build, reason, who, dry=False, args=None: seen.update(action=action, args=args) or {"ok": True})
    api.petitions_file({"action": "ticket-file", "reason": "bug", "args": {"priority": "P2", "key": "agent-bug:herald"}}, "eval:petitions")
    assert seen == {"action": "ticket-file", "args": {"priority": "P2", "key": "agent-bug:herald"}}


def test_ticket_file_runs_the_agent_bug_playbook_pressed(monkeypatch, lacuna_home):
    from lacuna_api.control import foreman   # imported after the fixture points the package at a scratch home
    calls = []
    monkeypatch.setattr(foreman, "call", lambda m, p, b=None, timeout=10: calls.append((m, p, b)) or {"ok": True, "run": "w-1"})
    out = foreman.decided("ticket-file", {"priority": "P2", "key": "agent-bug:herald", "title": "stuck", "evidence": ["contract r-1"]}, True, "alfred")
    assert out["ok"] and calls[0][1] == "/playbooks/agent-bug/run"
    assert calls[0][2]["pressed"] is True and calls[0][2]["bindings"]["2"][0]["key"] == "agent-bug:herald" and calls[0][2]["bindings"]["4"][0]["to"] == "desk"
    assert foreman.decided("ticket-file", {"key": "x"}, False, "alfred") == {"ok": True, "declined": True}


def test_broker_load_refuses_under_the_wall_and_names_no_model(monkeypatch, lacuna_home):
    from lacuna_api.control import foreman
    monkeypatch.setattr(foreman, "call", lambda m, p, b=None, timeout=10: {"ok": True, "avail_mb": 512})
    assert "wall" in foreman.decided("broker-load", {"model": "gemma3:270m"}, True, "alfred")["why"]
    assert "named no weights" in foreman.decided("broker-load", {"agent": "herald"}, True, "alfred")["why"]
