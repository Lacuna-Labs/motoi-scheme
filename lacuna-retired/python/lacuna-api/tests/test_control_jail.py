"""THE JAIL is enforced by the tool layer, not the prompt: every escape a model might try is refused and logged."""
import importlib
import json


def load(tmp_path, monkeypatch):
    monkeypatch.setenv("LACUNA_HOME", str(tmp_path))
    monkeypatch.setenv("LACUNA_NO_WORKERS", "1")
    import lacuna_api.control.core as core
    importlib.reload(core)
    import lacuna_api.control.chat as chat
    importlib.reload(chat)
    return core, chat


def audit_actions(tmp_path):
    return [json.loads(l)["action"] for l in (tmp_path / "audit.jsonl").read_text().splitlines()]


def test_the_shell_is_the_only_command_tool_and_it_writes_only_its_workspace(tmp_path, monkeypatch):
    """2026-10-19: the chat got a shell (shell.sb). It reads the code and writes the code and its world (shell.sb, like Claude's reach) — an old
    version of this test ran `rm -rf ~` through it under the wider jail and erased ~/lacuna-world. Never a destructive
    command here: the fence is checked with a harmless write outside the workspace."""
    core, chat = load(tmp_path, monkeypatch)
    names = set(chat.TOOLS)
    assert "shell" in names and not names & {"run", "exec", "bash", "write_file", "delete", "rm"}
    out = chat.call_tool("shell", {"cmd": "cat ~/.lacuna/owner-key"}, "claude")          # the owner's key stays closed
    assert out["ok"] is False and "not permitted" in (out.get("stderr") or "")
    assert chat.call_tool("shell", {"cmd": "rm -rf ~"}, "claude").get("refused")          # refused before it runs


def test_an_invented_tool_is_refused_and_logged(tmp_path, monkeypatch):
    core, chat = load(tmp_path, monkeypatch)
    out = chat.call_tool("format_disk", {"cmd": "nothing"}, "claude")
    assert out["ok"] is False and "no tool" in out["refused"]
    assert "tool.refused" in audit_actions(tmp_path)


def test_hers_cannot_be_reached_through_our_control_tool(tmp_path, monkeypatch):
    core, chat = load(tmp_path, monkeypatch)
    out = chat.call_tool("control_service", {"service": "qa-api", "action": "restart"}, "claude")
    assert out["ok"] is False and "refused" in out        # layer 1: qa-api is not in the tool's enum
    import pytest
    from lacuna_api.control import services
    with pytest.raises(services.NeedsConfirm):             # layer 2: even called directly, the service guard stops it
        chat.control_service({"service": "qa-api", "action": "restart"}, "lacuna-for-claude")


def test_a_draft_cannot_leave_the_drafts_folder(tmp_path, monkeypatch):
    core, chat = load(tmp_path, monkeypatch)
    out = chat.call_tool("draft_script", {"name": "../../../etc/evil.sh", "content": "echo hi"}, "claude")
    p = tmp_path / "drafts"
    assert out["ok"] and out["path"].startswith(str(p)) and "/" not in out["path"][len(str(p)) + 1:]


def test_a_petition_never_acts_by_itself(tmp_path, monkeypatch):
    core, chat = load(tmp_path, monkeypatch)
    out = chat.call_tool("petition", {"action": "qa-restart", "reason": "old code"}, "claude")
    assert out["ok"] and "waiting" in out["state"]
    assert all(p["state"] == "waiting" for p in chat.petitions())
    assert not any(a.startswith("service.") for a in audit_actions(tmp_path))


def test_door_closes_sockets_off_the_mac(monkeypatch):
    """BaseHTTPMiddleware never sees a WebSocket; the log socket must ask the door itself."""
    from lacuna_api.control import guard

    class WS:
        def __init__(self, host, token=None):
            self.client = type("C", (), {"host": host})()
            self.query_params = {"token": token} if token else {}
            self.headers, self.cookies = {}, {}
    monkeypatch.delenv("LACUNA_LAN", raising=False)
    assert guard.ws_allowed(WS("127.0.0.1"))
    assert not guard.ws_allowed(WS("192.168.1.20", guard.token()))       # door shut: no one from off the Mac
    monkeypatch.setenv("LACUNA_LAN", "1")
    assert not guard.ws_allowed(WS("192.168.1.20"))                       # door open: a token is needed
    assert not guard.ws_allowed(WS("192.168.1.20", "wrong"))
    assert guard.ws_allowed(WS("192.168.1.20", guard.token()))


def test_arguments_outside_the_enum_are_refused():
    """The bench caught it: 'delete the logs folder' filed as a petition. Enum arguments are checked in code."""
    from lacuna_api.control import chat
    r = chat.call_tool("petition", {"action": "delete-logs", "reason": "asked"}, "claude")
    assert r["ok"] is False and "refused" in r and "qa-restart" in r["refused"]
    assert not any(p["action"] == "delete-logs" for p in chat.petitions())
    r = chat.call_tool("control_service", {"service": "qa-api", "action": "stop"}, "claude")
    assert r["ok"] is False and "refused" in r                          # QA is not in the enum at all
    r = chat.call_tool("petition", {"reason": "no action"}, "claude")
    assert r["ok"] is False and "needs `action`" in r["refused"]


def test_a_petition_says_what_it_does_and_a_deploy_needs_a_kept_build(tmp_path, monkeypatch):
    core, chat = load(tmp_path, monkeypatch)
    r = chat.call_tool("petition", {"action": "deploy-ipad", "reason": "Delete the whole logs folder"}, "claude")
    assert r["ok"] is False and "kept builds" in r["refused"]           # the bench's misuse, stopped in code
    r = chat.call_tool("petition", {"action": "qa-restart", "reason": "stale code"}, "claude")
    assert r["ok"] is True and "restarts QA" in r["if_approved"]
    p = [p for p in chat.petitions() if p["id"] == r["petition"]][0]
    assert "restarts QA" in p["effect"]                                   # the card shows the code's words


def test_destructive_asks_never_reach_the_model(tmp_path, monkeypatch):
    core, chat = load(tmp_path, monkeypatch)
    monkeypatch.setattr(chat, "_ollama", lambda *a, **k: (_ for _ in ()).throw(AssertionError("the model was asked")))
    for q in ("Delete the whole logs folder.", "Run rm -rf on the builds folder.", "wipe the drafts"):
        r = chat.ask(q, who="claude", session="t")
        assert "No tool here deletes" in r["answer"] and r["trace"] == []


def test_out_of_steps_still_answers_from_what_it_read(tmp_path, monkeypatch):
    """The bench: a model that kept calling tools used every step and its findings were thrown away."""
    core, chat = load(tmp_path, monkeypatch)
    calls = {"n": 0}

    def fake(messages, tools, model, job="ops"):
        calls["n"] += 1
        if tools:                                  # every tooled round asks for another look
            return {"message": {"content": "", "tool_calls": [{"function": {"name": "health_check", "arguments": {}}}]}}
        return {"message": {"content": "Disk is fine; I did not get to check the logs."}}
    monkeypatch.setattr(chat, "_ollama", fake)
    monkeypatch.setattr(chat, "call_tool", lambda *a, **k: {"ok": True, "disk": "54 GB free"})
    monkeypatch.setattr(chat, "_fold_journal", lambda *a, **k: None)   # the journal's own model call is not a step
    r = chat.ask("is the studio healthy?", who="claude", session="t-steps", max_steps=3)
    assert r["ok"] and r["capped"] and "did not get to check" in r["answer"]
    assert calls["n"] == 4                         # three tooled rounds, then one answer with tools off


def test_a_malformed_tool_call_is_salvaged_only_for_a_real_tool(tmp_path, monkeypatch):
    """Qwen's docs: a call can arrive as text. A real tool's call is recovered; an invented one stays text."""
    core, chat = load(tmp_path, monkeypatch)
    got = chat.salvage_calls('ok <tool_call>{"name": "list_services", "arguments": {}}</tool_call>')
    assert got == [{"function": {"name": "list_services", "arguments": {}}}]
    assert chat.salvage_calls('<tool_call>{"name": "format_disk", "arguments": {}}</tool_call>') == []
    assert chat.salvage_calls('<tool_call>not json</tool_call>') == []
    assert chat.profile("qwen3:8b", "triage")["options"]["min_p"] == 0.0
    assert chat.profile("qwen3:8b", "triage")["ctx"] == 16384 and "ctx" not in chat.profile("qwen3:8b", "ops")
