"""A pantheon mind goes in service only at 90% one-shot, as served (pantheon_view.propose; the owner, 2026-10-18)."""
import json

from lacuna_api.control import chat, forge, pantheon_view


def _world(tmp_path, monkeypatch, score):
    (tmp_path / "results" / "pantheon").mkdir(parents=True)
    (tmp_path / "results" / "pantheon" / "triage-red.json").write_text(json.dumps({"q8": score, "untrained": 0.4, "held_out": 40, "gguf_q8": "/x.gguf"}))
    (tmp_path / "pantheon.json").write_text(json.dumps({"minds": [{"name": "triage-red", "title": "Triage", "ask": "what kind of red"}]}))
    monkeypatch.setattr("lacuna_api.control.forge.forge_dir", lambda: tmp_path)


def test_under_ninety_is_refused(tmp_path, monkeypatch):
    _world(tmp_path, monkeypatch, 0.85)
    r = pantheon_view.propose("triage-red", "alfred")
    assert r["ok"] is False and "90%" in r["refused"]


def test_at_ninety_files_the_card_for_the_role(tmp_path, monkeypatch):
    _world(tmp_path, monkeypatch, 0.94)
    got = []
    monkeypatch.setattr("lacuna_api.control.chat.file_petition", lambda *a, **k: got.append((a, k)) or {"ok": True, "petition": "p"})
    pantheon_view.propose("triage-red", "alfred")
    a = got[0][1]["args"]
    assert got[0][0][0] == "forge-propose" and a["specialist"] == "triage" and a["pantheon"] == "triage-red"
