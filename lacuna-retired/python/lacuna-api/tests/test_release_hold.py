"""B13: a hold on the release stops a real release from any door; a dry run still starts."""
import importlib


def test_hold_refuses_a_real_release(tmp_path, monkeypatch):
    # resolve the modules as they are NOW (another test reloads them; a stale handle would patch the wrong one)
    rr = importlib.import_module("lacuna_api.control.release_run")
    carts = importlib.import_module("lacuna_api.control.carts")
    foreman = importlib.import_module("lacuna_api.control.foreman")
    monkeypatch.setattr("lacuna_api.control.release_run._hold_file", lambda: tmp_path / "release-hold.json")
    monkeypatch.setattr(carts, "carts_dir", lambda: tmp_path)
    monkeypatch.setattr(foreman, "call", lambda *a, **k: {"ok": False, "why": "no foreman in a test"})
    (tmp_path / "release.sks").write_text("; a cart")
    rr.r_hold(rr.Hold(on=True, why="waiting on the battery"), "alfred")
    r = carts.start_named("release", "alfred", dry=False)
    assert r["ok"] is False and "held" in r["why"]
    assert "held" not in str(carts.start_named("release", "alfred", dry=True).get("why"))
    rr.r_hold(rr.Hold(on=False), "alfred")
    assert rr.hold() is None
