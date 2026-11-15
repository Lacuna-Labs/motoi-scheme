"""A cart's acts (acts.py): only a named act, only on a run the owner pressed; a dry run touches nothing."""
from lacuna_api.control import acts


def test_no_grant_no_act(tmp_path, monkeypatch):
    monkeypatch.setattr(acts, "GRANTS", tmp_path / "g.json")
    assert "owner's press" in acts.do("w-1", "pass", [])["why"]


def test_an_act_the_header_does_not_name_is_refused(tmp_path, monkeypatch):
    monkeypatch.setattr(acts, "GRANTS", tmp_path / "g.json")
    acts.grant("w-1", "owner-key", {"name": "release", "acts": ["pass"]}, dry=True)
    assert "does not name" in acts.do("w-1", "install-ipad", [])["why"]


def test_a_dry_run_says_what_it_would_do_and_starts_nothing(tmp_path, monkeypatch):
    monkeypatch.setattr(acts, "GRANTS", tmp_path / "g.json")
    started = []
    monkeypatch.setattr(acts, "start_job", lambda *a, **k: started.append(a))
    acts.grant("w-1", "owner-key", {"name": "release", "acts": ["pass", "clean-listed"]}, dry=True)
    r = acts.do("w-1", "pass", [])
    assert r["ok"] and r["dry"] and "workflow pass" in r["would"] and not started


def test_the_grant_ends_with_the_run(tmp_path, monkeypatch):
    monkeypatch.setattr(acts, "GRANTS", tmp_path / "g.json")
    acts.grant("w-1", "owner-key", {"name": "release", "acts": ["pass"]}, dry=False)
    acts.drop("w-1")
    assert acts.do("w-1", "pass", [])["ok"] is False
