"""End-to-end verification of Cloud Lacuna wiring, context injection, SRE blueprint, and 3 chat contexts."""
import json
from pathlib import Path
from lacuna_api.control import cloud, cloud_kinds, chat


def test_cloud_lacuna_primer_names_the_chat_surfaces_and_the_laws():
    """Cloud Lacuna's primer names the three chat surfaces and the laws, and no subsystem the code lacks."""
    assert "3 chat surfaces" in cloud_kinds.PRIMER
    assert "the brain never executes" in cloud_kinds.PRIMER
    assert "GIMBAL" not in cloud_kinds.PRIMER
    assert "Octave" not in cloud_kinds.PRIMER


def test_sight_block_injects_sre_blueprint_and_notes(tmp_path, monkeypatch):
    """Verify that sight_block injects CLOUD-LACUNA.md and SRE-RETROSPECTIVE-AND-BLUEPRINT.md."""
    # Write mock cloud-sight.json
    (tmp_path / "cloud-sight.json").write_text(json.dumps({
        "floor": False,
        "inbox": False,
        "handoff": False,
        "code": False,
    }))
    
    view = cloud_kinds.sight_block(str(tmp_path))
    assert "YOUR NOTES (CLOUD-LACUNA.md)" in view
    assert "SRE RETROSPECTIVE AND BLUEPRINT (Lacuna 2.0)" in view


def test_cloud_kinds_chat_streaming(monkeypatch):
    """Verify that cloud_kinds.chat streams tokens via on_event when supplied."""
    events = []
    
    def mock_ask_stream(kind, head, body, on_event, models=None, max_out=8000):
        on_event({"type": "thought", "text": "Evaluating system state..."})
        on_event({"type": "text", "text": "All 15 SRE upgrades verified and healthy."})
        return {"ok": True, "text": "All 15 SRE upgrades verified and healthy.", "model": "gemini-3.8-flash"}

    monkeypatch.setattr(cloud, "ask_stream", mock_ask_stream)
    
    r = cloud_kinds.chat(
        "Status report",
        history=[{"role": "user", "text": "check system"}],
        on_event=events.append,
        sight=lambda: "MOCK VIEW",
    )
    
    assert r["ok"] is True
    assert "All 15 SRE upgrades verified" in r["text"]
    assert len(events) == 2
    assert events[0] == {"type": "thought", "text": "Evaluating system state..."}
    assert events[1] == {"type": "token", "text": "All 15 SRE upgrades verified and healthy."}


def test_chat_ask_cloud_lacuna_model_routing(monkeypatch):
    """Verify that chat.ask routes model='cloud-lacuna' through cloud_kinds.chat."""
    called = {}
    
    def mock_cloud_chat(text, history, on_step=None, on_event=None, who="alfred", **kwargs):
        called["text"] = text
        called["who"] = who
        return {"ok": True, "text": "GIMBAL-1.0 active at 325ns.", "model": "gemini-3.8-flash"}

    monkeypatch.setattr(cloud_kinds, "chat", mock_cloud_chat)
    
    r = chat.ask("Actuate status", "alfred", "agents-card", model="cloud-lacuna")
    assert r["ok"] is True
    assert r["model"] == "cloud-lacuna"
    assert "GIMBAL-1.0 active" in r["answer"]
    assert called["text"] == "Actuate status"
