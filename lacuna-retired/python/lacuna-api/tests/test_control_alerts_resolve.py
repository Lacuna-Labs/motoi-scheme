"""A condition that ended clears its own alert (review, 2026-09-25).

Alerts are edge-triggered and were kept open until a person acked them: when dev
caught up to HEAD, six `drift:branch:dev` lines stayed open saying dev ran a sha
it no longer ran. Now a drift that ends, or a watchdog that says healthy again,
resolves its alert with the reason; a drift whose value changes supersedes its
earlier line, so there is one open line per key.
"""

from __future__ import annotations

import pytest

from lacuna_api.control import drift, health, workers


@pytest.fixture
def clean(monkeypatch):
    monkeypatch.setattr(workers, "_notify", lambda *a, **k: None)
    with workers._lock:
        del workers._alerts[:]
    for k in [k for k in list(workers._state) if k.startswith(("drift:", "wd:"))]:
        del workers._state[k]
    yield
    with workers._lock:
        del workers._alerts[:]


def _open(key):
    return [a for a in workers.alerts() if a["key"] == key and not a["acked"]]


def test_a_drift_that_ends_resolves_its_alert_and_a_new_value_supersedes(clean, monkeypatch):
    rows = [{"id": "branch:dev", "service": "dev-api", "value": "aaaa/bbbb", "detail": "dev runs aaaa but dev is at bbbb"}]
    monkeypatch.setattr(drift, "check", lambda: list(rows))
    workers._eval_drift()
    assert len(_open("drift:branch:dev")) == 1
    rows[0] = {**rows[0], "value": "aaaa/cccc", "detail": "dev runs aaaa but dev is at cccc"}
    workers._eval_drift()
    assert len(_open("drift:branch:dev")) == 1, "one open line per key"
    assert [a for a in workers.alerts() if a["key"] == "drift:branch:dev" and a["acked"]][0]["resolved"].startswith("superseded")
    rows.clear()
    workers._eval_drift()
    assert _open("drift:branch:dev") == []
    cleared = [a for a in workers.alerts() if a["key"] == "drift:branch:dev"]
    assert all(a["acked"] for a in cleared) and cleared[0]["resolved"] == "the condition ended"


def test_a_watchdog_that_says_healthy_again_resolves_its_alert(clean, monkeypatch):
    word = [{"name": "watch.disk", "level": "error", "summary": "disk full", "where": "api"}]
    monkeypatch.setattr(health, "watchdogs", lambda env: list(word) if env == "dev" else [])
    workers._eval_watchdogs()
    assert len(_open("wd:dev:watch.disk")) == 1
    word[0] = {**word[0], "level": "info", "summary": "18 GB free"}
    workers._eval_watchdogs()
    assert _open("wd:dev:watch.disk") == []
