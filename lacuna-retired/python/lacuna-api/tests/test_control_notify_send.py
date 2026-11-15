"""POST /api/notify/send raises another service's SRE alert through Lacuna (product notices never come here: 2026-10-07).

Since the owner's ruling 7 (2026-11-02, LACUNA-1.0-FINALE.md §1) it notifies no one: the alert is kept for the desk's reads,
audited as notify.send, and answered with no channel; an empty title or body is refused with 422.
"""

from __future__ import annotations

import pytest


@pytest.fixture
def sent(app_client, monkeypatch):
    from lacuna_api.control import workers
    calls = []
    monkeypatch.setattr(workers, "_notify_now", lambda t, b: calls.append((t, b)) or ["banner"])
    monkeypatch.setattr(workers.threading, "Thread", lambda target, args=(), **k: type("T", (), {"start": lambda s: target(*args)})())
    workers._notified.clear()
    with workers._lock:
        del workers._alerts[:]
    return app_client, calls, workers


def test_send_raises_an_alert_and_notifies_no_one(sent):
    c, calls, workers = sent
    r = c.post("/api/notify/send", json={"key": "t:1", "level": "warn", "title": "QA is down", "body": "the QA server answers 502"})
    assert r.status_code == 200, r.text
    assert r.json()["channels"] == [] and r.json()["telemetry"] is True
    assert calls == []
    assert workers.alerts()[0]["key"] == "t:1"


def test_a_repeat_notifies_no_one_either(sent):
    c, calls, _ = sent
    c.post("/api/notify/send", json={"key": "t:2", "title": "Same", "body": "one"})
    r = c.post("/api/notify/send", json={"key": "t:2", "title": "Same", "body": "two"})
    assert r.json()["channels"] == [] and calls == []


@pytest.mark.parametrize("payload", [{"title": "", "body": "x"}, {"title": "x", "body": "  "}, {"title": "x", "body": "y", "level": "loud"}])
def test_empty_words_or_a_bad_level_are_refused(sent, payload):
    c, calls, _ = sent
    assert c.post("/api/notify/send", json=payload).status_code == 422
    assert calls == []
