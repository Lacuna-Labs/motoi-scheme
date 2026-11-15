"""P3 — the escalated door: lacuna-executor brings a pressed act; a worker the foreman spawned gets its grant row and the act runs as a job."""
from lacuna_api.control import acts


def test_run_escalated_grants_then_runs(monkeypatch, tmp_path):
    store = {}
    monkeypatch.setattr(acts, "_load", lambda: dict(store))
    monkeypatch.setattr(acts, "_save", lambda g: store.update(g))
    monkeypatch.setattr(acts, "grant", lambda worker, who, header, dry: store.__setitem__(worker, {"cart": header["name"], "acts": header["acts"], "who": who}))
    calls = []
    monkeypatch.setattr(acts, "run_now", lambda worker, op, args, who: calls.append((worker, op, args, who)) or {"ok": True, "job": "j-1", "said": "bundled"})
    out = acts.run_escalated("w-1", "backup", "bundle", [], "owner", "w-1-act-1")
    assert store["w-1"]["cart"] == "backup" and store["w-1"]["acts"] == ["bundle"]
    assert calls == [("w-1", "bundle", [], "owner")]
    assert out["ok"] and out["job"] == "j-1" and out["ticket"] == "w-1-act-1"


def test_run_escalated_keeps_an_existing_grant(monkeypatch):
    store = {"w-2": {"cart": "release", "acts": ["promote"]}}
    monkeypatch.setattr(acts, "_load", lambda: dict(store))
    monkeypatch.setattr(acts, "grant", lambda *a, **k: (_ for _ in ()).throw(AssertionError("no second grant")))
    monkeypatch.setattr(acts, "run_now", lambda worker, op, args, who: {"ok": False, "why": "the box is busy"})
    out = acts.run_escalated("w-2", "release", "promote", ["qa"], "owner")
    assert out == {"ok": False, "why": "the box is busy", "ticket": ""}
