"""The System card's kill (CARDS-2.0 §6.8, lane C8): the `kill` petition carries the row the card sent, its contract is
written by code (pid, name, age, what launchd does after), and the owner's yes runs the hands' `kill` act through the
foreman's process-kill playbook, pressed; a decline or a malformed row runs nothing. The processes' read (GET
/api/box/procs) is the door's, tested in lacuna-node/test/box-procs.test.mjs. Nothing here signals a process, reaches a
port, or touches ~/.lacuna (the foreman call is answered by the test). Session: eval:c8-kill."""


def test_the_kill_contract_names_pid_name_age_and_what_comes_back(lacuna_home):
    from lacuna_api.control import chat
    assert "kill" in chat.FOREMAN_ACTIONS
    e = chat._foreman_effect("kill", {"pid": 4411, "name": "Safari", "up_s": 3000})
    assert e.startswith("ends process 4411 (Safari, up 50 min)")
    assert "a supervised service comes back" in e and "never re-sent" in e and "foreman" in e
    assert chat._card_of({"action": "kill", "args": {}}) == ["s-system"]


def test_filing_a_kill_waits_for_the_owner(monkeypatch, lacuna_home):
    from lacuna_api.control import chat, foreman
    calls = []
    monkeypatch.setattr(foreman, "call", lambda *a, **k: calls.append(a) or {"ok": True})
    r = chat.file_petition("kill", None, "pressed on the System card: kill Safari (pid 4411)", "eval:c8-kill", args={"pid": 4411, "name": "Safari", "up_s": 3000})
    assert r["ok"] and r["petition"] and r["if_approved"].startswith("ends process 4411")
    assert calls == [], "filing runs nothing"


def test_the_yes_runs_the_process_kill_playbook_pressed(monkeypatch, lacuna_home):
    from lacuna_api.control import foreman
    calls = []
    monkeypatch.setattr(foreman, "call", lambda m, p, b=None, timeout=10: calls.append((m, p, b)) or {"ok": True, "run": "w-k1"})
    out = foreman.decided("kill", {"pid": 4411, "name": "Safari", "up_s": 3000}, True, "alfred")
    assert out["ok"] and calls[0][:2] == ("POST", "/playbooks/process-kill/run")
    b = calls[0][2]
    assert b["pressed"] is True and b["shadow"] is False
    assert b["bindings"]["2"] == [{"pid": 4411, "name": "Safari", "up_s": 3000}]
    assert b["bindings"]["4"][0]["ticket"] == "kill:4411"
    assert foreman.decided("kill", {"pid": 4411, "name": "Safari"}, False, "alfred") == {"ok": True, "declined": True}
    for bad in ({"pid": 1, "name": "launchd"}, {"pid": "12; rm", "name": "x"}, {"pid": 4411}, {"pid": 4411, "name": "x" * 61}):
        assert "names one process" in foreman.decided("kill", bad, True, "alfred")["why"]
    assert len(calls) == 1, "a decline or a malformed row reaches no foreman"
