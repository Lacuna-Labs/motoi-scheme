"""The cloud seat's chat and its sight (2026-10-27): it answers through one cloud call with no shell; it sees only the views the
owner switched on in Settings; with none on it sees only the question and the talk. The cloud call is stood in; cloud_kinds is real."""
import json

from lacuna_api.control import cloud, cloud_kinds


def test_no_switch_no_view(tmp_path, monkeypatch):
    # spec: law 11 (fail closed) · class: L · sre: what did the cloud seat see?
    seen = {}
    monkeypatch.setattr(cloud, "ask", lambda kind, head, body, **k: seen.update(kind=kind, body=body) or {"ok": True, "text": "fine"})
    r = cloud_kinds.chat("how is the box?", [], sight=lambda: cloud_kinds.sight_block(str(tmp_path)))
    assert r["ok"] and r["text"] == "fine" and r["sight"] is False
    assert seen["kind"] == "chat" and "VIEWS OF THE BOX" not in seen["body"] and "how is the box?" in seen["body"]


def test_the_floor_view_when_switched_on_and_only_it(tmp_path, monkeypatch):
    (tmp_path / "cloud-sight.json").write_text(json.dumps({"floor": True, "inbox": False}))
    floor = {"minds": [{"id": "e4b", "holds": True}], "foreman": {"lag_ms": 0, "living": 3},
             "workers": [{"name": "cart backup", "panel": {"state": "running"}}]}
    v = cloud_kinds.sight_block(str(tmp_path), read_floor=lambda: floor)
    assert "THE FLOOR" in v and "e4b (lit)" in v and "cart backup: running" in v and "INBOX" not in v


def test_a_refusal_reaches_the_owner_in_words(monkeypatch):
    monkeypatch.setattr(cloud, "ask", lambda *a, **k: {"ok": False, "why": "refused 503: high demand"})
    r = cloud_kinds.chat("hello", [], sight=lambda: "")
    assert r["ok"] is False and "503" in r["why"] and r["text"] == ""


def test_cloud_lacuna_files_orders_from_its_answer():
    """2026-10-27: Cloud Lacuna commands the minds: an ORDER line becomes a work order; at most three; a bad mind is ignored."""
    sent = []
    out = cloud_kinds.file_orders("Do this:\nORDER e4b: write a test for door/visitor.mjs that checks 404s\nORDER 26b: plan\nORDER 12b: fix the null in floor.mjs line 40, add a test",
                                  post=lambda m, g: sent.append((m, g)) or {"ok": True, "order": f"wo-{len(sent)}"})
    assert [m for m, _ in sent] == ["e4b", "12b"] and out == ["wo-1 for the E4B", "wo-2 for the 12B"]
