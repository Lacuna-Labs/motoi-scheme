"""A job outlives Lacuna: its end is known from disk even when the process that started it is gone."""
import importlib
import time


def test_a_job_that_ends_while_lacuna_forgot_it_still_reports_its_exit(tmp_path, monkeypatch):
    monkeypatch.setenv("LACUNA_HOME", str(tmp_path))
    import lacuna_api.control.core as core
    importlib.reload(core)
    j = core.start_job("test", "exit three", ["/bin/bash", "-c", "echo hello; exit 3"], "claude")
    time.sleep(1.5)
    core._jobs.clear()                                  # Lacuna restarted: nothing in memory
    rows = core.jobs()
    assert rows and rows[0]["id"] == j.id and rows[0]["code"] == 3 and rows[0]["running"] is False
    assert "hello" in core.job_tail(j.id) and "[exit 3]" in core.job_tail(j.id)


def test_petitions_survive_a_restart(tmp_path, monkeypatch):
    monkeypatch.setenv("LACUNA_HOME", str(tmp_path))
    monkeypatch.setenv("LACUNA_NO_WORKERS", "1")
    import lacuna_api.control.core as core
    importlib.reload(core)
    import lacuna_api.control.chat as chat
    importlib.reload(chat)
    p = chat.file_petition("qa-restart", None, "a test", "claude")["petition"]
    importlib.reload(chat)                              # a fresh process reads them back
    assert any(x["id"] == p and x["state"] == "waiting" for x in chat.petitions())


def test_ask_mode_files_a_contract_and_the_yes_runs_it(tmp_path, monkeypatch, press):
    """ASK mode (2026-10-18): an act becomes a contract on the desk; the person's yes runs exactly it — and the yes
    must not crash after marking itself approved (audit's own `action` argument once swallowed every approval)."""
    monkeypatch.setenv("LACUNA_HOME", str(tmp_path))
    monkeypatch.setenv("LACUNA_NO_WORKERS", "1")
    import lacuna_api.control.core as core
    importlib.reload(core)
    import lacuna_api.control.chat as chat
    importlib.reload(chat)
    from lacuna_api.control import home, mode
    ran = []
    fake = lambda a, who: ran.append(a) or {"ok": True, "did": "the thing"}  # noqa: E731
    fake._tool = {"tier": "act", "desc": "Do the thing. More words.", "props": {}, "required": []}
    monkeypatch.setitem(chat.TOOLS, "do_thing", fake)
    mode.set_mode("ask", "alfred")
    out = chat.call_tool("do_thing", {"x": 1}, "alfred")
    assert out["filed"] == "act:do_thing" and not ran
    pet = next(q for q in chat.petitions() if q["id"] == out["petition"])           # the inbox row; no desk card since 2026-10-20 (chat.CONTRACT_CARDS)
    assert pet["state"] == "waiting" and pet["effect"] == "Do the thing (x=1)"
    r = chat.decide(out["petition"], True, "alfred", press(out["petition"], True))
    assert r["ok"] and ran == [{"x": 1}] and r["petition"]["result"]["did"] == "the thing"
    assert next(q for q in chat.petitions() if q["id"] == out["petition"])["state"] == "approved"
    mode.set_mode("auto", "alfred")
    assert chat.call_tool("do_thing", {"x": 2}, "alfred")["did"] == "the thing"
