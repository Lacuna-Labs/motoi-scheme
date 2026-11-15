"""P-SELF: a self-repair acts only when its check fails now, three times an hour at most, and never names the customer's
side. The checks and launchctl are faked."""
import importlib


def _sr(monkeypatch, tmp_path, ok):
    sr = importlib.import_module("lacuna_api.control.self_repair")
    monkeypatch.setattr(sr, "LEDGER", tmp_path / "sr.jsonl")
    monkeypatch.setattr(sr, "check", lambda fast=False: {w: {"ok": ok, "why": "faked"} for w in ("brain", "gateway", "foreman", "small-minds", "lacuna")})
    ran = []
    monkeypatch.setattr(sr.subprocess, "run", lambda cmd, **k: ran.append(cmd) or type("P", (), {"returncode": 0, "stderr": ""})())
    monkeypatch.setattr(sr, "audit", lambda *a, **k: None)
    return sr, ran


def test_a_well_brain_is_never_restarted(monkeypatch, tmp_path):
    sr, ran = _sr(monkeypatch, tmp_path, ok=True)
    r = sr.repair("brain", "lacuna")
    assert r["acted"] is False and not ran


def test_a_down_brain_is_restarted_three_times_an_hour_then_the_owner(monkeypatch, tmp_path):
    sr, ran = _sr(monkeypatch, tmp_path, ok=False)
    for _ in range(3):
        assert sr.repair("brain", "lacuna")["acted"] is True
    r = sr.repair("brain", "lacuna")
    assert r["acted"] is False and "owner" in r["said"] and len(ran) == 3
    assert all("ai.lacunalabs.brain" in c[-1] for c in ran)


def test_the_customer_side_is_not_on_the_menu(monkeypatch, tmp_path):
    sr, ran = _sr(monkeypatch, tmp_path, ok=False)
    for w in ("qa-api", "qa", "ipad", "l2-daemon-qa"):
        assert sr.repair(w, "lacuna")["ok"] is False
    assert not ran
