"""A cart never stalls on the brain: its judgment point goes to the owner (CARTS-ARE-THE-WORK §2.3)."""
from lacuna_api.control import chat, foreman


def test_brain_down_asks_the_owner_and_his_answer_comes_back_as_the_brain(monkeypatch):
    filed, sent = [], []
    monkeypatch.setattr(foreman, "_brain_up", lambda: False)
    monkeypatch.setattr(chat, "file_petition", lambda *a, **k: filed.append((a, k)) or {"ok": True, "petition": "p1"})
    monkeypatch.setattr(foreman, "call", lambda m, path, body=None, **k: sent.append((path, body)) or {"ok": True})
    foreman._ASKED.clear()
    foreman._ration({"id": "w1", "name": "release"}, {"question": "a new kind of red: stop the release?", "facts": ["E7 red"]})
    assert filed and filed[0][0][0] == "worker-asks" and filed[0][1]["args"]["as_brain"] is True
    foreman.decided("worker-asks", filed[0][1]["args"], True, "alfred")
    assert sent[-1] == ("/workers/w1/event", {"kind": "brain", "value": {"by": "owner", "yes": True, "what": filed[0][1]["args"]["what"]}})
