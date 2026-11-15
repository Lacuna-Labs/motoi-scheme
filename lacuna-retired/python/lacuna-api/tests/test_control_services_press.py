"""SERVICES ON THE PRESS ROAD (LACUNA-CARDS-2.0 §6.8, lane C8, 2026-10-24).

The System card files the petition each service row names and the owner's press runs it: QA through its own qa-* card,
ours through act:control_service, the door never. The rack lists every ai.lacunalabs.* label launchd holds, so the
services window matches launchctl. Nothing here starts, stops or reads a live service: launchctl and the sockets are
answered by the test.
"""
from __future__ import annotations

from lacuna_api.control import devices, services


def test_ours_take_act_control_service():
    for name in services.OURS:
        for action in services.ACTIONS:
            assert services.press_road(name, action) == {"action": "act:control_service", "args": {"service": name, "action": action}}


def test_qa_takes_its_own_card_and_the_door_takes_none():
    assert services.press_road("qa-api", "restart") == {"action": "qa-restart"}
    assert services.press_road("qa-api", "stop") == {"action": "qa-stop"}
    assert "launchd keeps it up" in services.press_road("lacuna", "restart")["why"]
    assert "why" in services.press_road("dev-api", "supervise")
    assert "why" in services.press_road("nope", "start")


def test_every_service_row_names_a_road_or_why(monkeypatch):
    monkeypatch.setattr(services, "_launchd", lambda label: {"loaded": True, "state": "running", "pid": 7, "last_exit": 0})
    monkeypatch.setattr(services, "_listening", lambda port: False)
    monkeypatch.setattr(services, "_keeps_alive", lambda label: True)
    for name in services.SERVICES:
        row = services.status(name)
        assert row["label"] == services.SERVICES[name]["label"]
        assert row["comes_back"] is True
        assert set(row["press"]) == set(services.ACTIONS)
        assert all(("action" in r) != ("why" in r) for r in row["press"].values())
    monkeypatch.setattr(services, "_keeps_alive", lambda label: False)
    assert services.status("dev-api")["comes_back"] is False, "loaded without KeepAlive does not come back"


def test_the_door_row_names_the_label_launchd_holds():
    assert services.SERVICES["lacuna"]["label"] == "ai.lacunalabs.lacuna-door"


LAUNCHCTL = "\n".join(["PID\tStatus\tLabel", "7936\t0\tai.lacunalabs.lacuna-py", "987\t0\tai.lacunalabs.curator-dev-tunnel",
                       "981\t0\tai.lacunalabs.dev-api", "977\t0\tai.lacunalabs.vite", "980\t0\tai.lacunalabs.qa-api",
                       "997\t0\tai.lacunalabs.curator-speech-helper", "75178\t-9\tai.lacunalabs.lacuna-door",
                       "7277\t0\tai.lacunalabs.brain-gateway", "-\t0\tai.lacunalabs.sale-cycle", "81448\t0\tai.lacunalabs.foreman",
                       "67244\t-15\tai.lacunalabs.world-broker", "54243\t0\tai.lacunalabs.hands", "7087\t0\tai.lacunalabs.brain",
                       "-\t0\tcom.apple.something"]) + "\n"


def test_the_rack_lists_every_lacunalabs_label_launchd_holds(monkeypatch):
    class Done:
        stdout = LAUNCHCTL
    monkeypatch.setattr(devices.subprocess, "run", lambda *a, **k: Done())
    monkeypatch.setattr(devices, "_loam", lambda: {"up": False})
    monkeypatch.setattr(services, "all_status", lambda: [{"name": n, "label": s["label"]} for n, s in services.SERVICES.items()])
    d = devices.devices()
    shown = {a["label"] for a in d["agents"]} | {s["label"] for s in d["studio"]}
    held = {line.split("\t")[2] for line in LAUNCHCTL.splitlines()[1:] if "\tai.lacunalabs." in line}
    assert held - shown == set(), f"launchd holds labels the rack does not list: {sorted(held - shown)}"
    by = {a["label"]: a for a in d["agents"]}
    assert by["ai.lacunalabs.hands"]["pid"] == 54243
    assert by["ai.lacunalabs.lacuna-door"]["kickable"] is False
    assert by["ai.lacunalabs.sale-cycle"]["up"] is True and by["ai.lacunalabs.sale-cycle"]["periodic"] is True
