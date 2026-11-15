"""An act runs once (design §45.3, 2026-10-19): a re-send with retry_of gets the kept answer, never a second run."""


def test_a_resent_act_is_answered_from_the_first_run(tmp_path, monkeypatch):
    from lacuna_api.control import acts, foreman
    monkeypatch.setattr(foreman, "ACTS_DONE", tmp_path / "acts-done.json")
    ran, sent = [], []
    monkeypatch.setattr(acts, "do", lambda wid, op, args: ran.append(op) or {"ok": True, "petition": "p9"})
    monkeypatch.setattr(foreman, "call", lambda m, path, body, timeout=10: sent.append(body["value"]) or {"ok": True})
    foreman._act({"id": "w-1"}, {"ticket": "t1", "op": "file-bug", "args": []})
    foreman._act({"id": "w-1"}, {"ticket": "t2", "op": "file-bug", "args": [], "retry_of": "t1"})
    assert ran == ["file-bug"]
    assert sent[1]["ticket"] == "t2" and sent[1]["replayed"] is True and sent[1]["petition"] == "p9"
