"""The dev API's production fence: one line on the console, one alert when it is not proven.

Green when every part holds; red (and `fence.dev` raised once) when a part is false, or when the report cannot be
read while the dev API answers — a 404 from an API not yet restarted counts as missing. A dev API that is down says
nothing either way. QA (5050) is never asked for the fence.
"""
from __future__ import annotations

from lacuna_api.control import fence, health

GOOD = {"instance": "dev", "applies": True, "ok": True, "ebay": "sandbox", "failures": [],
        "summary": "eBay sandbox · wire fence on (14 production hosts blocked) · 0 production logins"}
BAD = {**GOOD, "ok": False, "failures": ["wire fence off", "production keyset present"]}


def _serve(monkeypatch, fence_answer, up=True):
    """Fake the curator APIs: healthz answers when `up`; /api/fence answers `fence_answer` (None = a 404)."""
    asked = []

    def get(url, timeout=4):
        asked.append(url)
        if url.endswith("/healthz"):
            return ({"ok": True} if up else None), (None if up else "URLError: refused")
        if url.endswith("/api/fence"):
            return (fence_answer, None) if fence_answer is not None else (None, "HTTPError: HTTP Error 404: Not Found")
        return {}, None

    monkeypatch.setattr(health, "_get_json", get)
    return asked


class _Bar:
    def __init__(self):
        self.raised, self.resolved, self.state = [], [], {}

    def raise_alert(self, key, level, title, body, notify=True):
        self.raised.append((key, level, title, body))

    def resolve_alert(self, key, why):
        self.resolved.append((key, why))

    def run(self):
        fence.evaluate(self.raise_alert, self.resolve_alert, self.state)


def test_green_when_every_part_holds(monkeypatch):
    asked = _serve(monkeypatch, GOOD)
    out = health.api("dev")
    assert out["fence_line"]["state"] == "ok"
    assert out["fence_line"]["text"] == f"Production fence: {GOOD['summary']}"
    assert not any(":5050" in u for u in asked)
    bar = _Bar()
    bar.run()
    assert bar.raised == [] and bar.resolved == []


def test_red_and_one_alert_when_a_part_is_false(monkeypatch):
    _serve(monkeypatch, BAD)
    line = health.api("dev")["fence_line"]
    assert line["state"] == "bad"
    assert line["text"] == "Production fence: wire fence off; production keyset present"
    bar = _Bar()
    bar.run()
    bar.run()                                     # a condition that stays true is said once
    assert [(k, lv, t) for k, lv, t, _ in bar.raised] == [("fence.dev", "error", "Dev production fence is not proven")]
    assert "wire fence off" in bar.raised[0][3]
    _serve(monkeypatch, GOOD)                     # green again: the alert clears itself
    bar.run()
    assert bar.resolved[-1][0] == "fence.dev" and bar.state["fence.dev"] is None


def test_red_when_the_report_is_missing_while_up(monkeypatch):
    _serve(monkeypatch, None)                     # the route 404s: an API not yet restarted
    line = health.api("dev")["fence_line"]
    assert line["state"] == "bad" and "report missing" in line["text"]
    bar = _Bar()
    bar.run()
    assert len(bar.raised) == 1 and "report missing" in bar.raised[0][3]


def test_nothing_said_while_the_dev_api_is_down(monkeypatch):
    asked = _serve(monkeypatch, None, up=False)
    out = health.api("dev")
    assert out["up"] is False and out["fence_line"]["state"] == "unknown"
    assert not any(u.endswith("/api/fence") for u in asked)
    bar = _Bar()
    bar.run()
    assert bar.raised == [] and bar.resolved == []


def test_qa_carries_no_fence_line(monkeypatch):
    asked = _serve(monkeypatch, GOOD)
    assert "fence_line" not in health.api("qa")
    assert not any(u.endswith("/api/fence") for u in asked)
