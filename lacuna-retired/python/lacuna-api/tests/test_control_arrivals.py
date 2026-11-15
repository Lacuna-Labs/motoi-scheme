"""Arrival is the cortex's act (arrivals.py): runs, climbs, presses and alerts reach the graph, never blocking."""
import time

from lacuna_api.control import arrivals, lacuna_cortex


def _capture(monkeypatch):
    got = []
    monkeypatch.setattr(lacuna_cortex, "remember", lambda *a, **k: got.append(("remember", a, k)) or {"ok": True})
    monkeypatch.setattr(lacuna_cortex, "episode", lambda *a, **k: got.append(("episode", a, k)) or {"ok": True})
    return got


def _wait(got, n):
    for _ in range(100):
        if len(got) >= n:
            return
        time.sleep(0.02)


def test_a_run_becomes_an_episode_in_its_cart(monkeypatch):
    got = _capture(monkeypatch)
    arrivals.run_ended("release", "w-1", {"outcome": {"is": "stopped", "reason": "a red, not flaky"}})
    _wait(got, 1)
    assert got[0][0] == "episode" and got[0][1][0] == "cart:release" and "stopped" in got[0][1][2]["text"]


def test_an_alert_supersedes_the_last_of_its_kind(monkeypatch):
    got = _capture(monkeypatch)
    arrivals._last_alert.clear()
    arrivals.alerted("disk:low", "warn", "disk low", "8% free")
    time.sleep(1.1)
    arrivals.alerted("disk:low", "warn", "disk low", "7% free")
    for _ in range(100):                                             # the writes ride a shared background thread: wait for both of ours
        alerts = [g for g in got if g[1][1].startswith('alert-disk')]
        if len(alerts) >= 2:
            break
        time.sleep(0.05)
    alerts = [g for g in got if g[1][1].startswith('alert-disk')]       # the notice-<kind> fact beside each is the newest-by-name copy
    first, second = sorted(alerts, key=lambda g: g[1][1])
    assert second[2]["supersedes"] == first[1][1]


def test_a_press_is_a_decision_with_its_why(monkeypatch):
    got = _capture(monkeypatch)
    arrivals.pressed("p1", "spawn-cart", True, "owner-key", "run the release", "release")
    _wait(got, 1)
    kind, key, props = got[0][1][:3]
    assert kind == "decision" and key == "press-p1" and props["why"] == "run the release" and "yes" in props["text"]
