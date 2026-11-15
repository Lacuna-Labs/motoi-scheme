"""The check-in card (playbooks/RELEASE.md §2): pathspec only, dev only, never a secret."""
import subprocess

from lacuna_api.control import checkin


def _repo(tmp_path, branch="dev"):
    g = lambda *a: subprocess.run(["git", "-C", str(tmp_path), *a], check=True, capture_output=True)  # noqa: E731
    g("init", "-q", "-b", branch)
    g("config", "user.email", "t@t"); g("config", "user.name", "t")
    (tmp_path / "a.js").write_text("1"); (tmp_path / "b.js").write_text("1")
    g("add", "."); g("commit", "-qm", "seed")
    (tmp_path / "a.js").write_text("2"); (tmp_path / "b.js").write_text("2")
    return g


def test_refuses_secrets_and_escapes():
    assert "secret" in checkin.check({"paths": [".env"], "message": "x"})
    assert "secret" in checkin.check({"paths": ["ops/secrets/k"], "message": "x"})
    assert "inside the repo" in checkin.check({"paths": ["../x"], "message": "x"})
    assert "72" in checkin.check({"paths": ["a.js"], "message": "x" * 73})
    assert checkin.check({"paths": [], "message": "x"})
    assert checkin.check({"paths": ["a.js"], "message": "fix: a"}) is None


def test_commits_only_named_paths_on_dev(tmp_path, monkeypatch):
    _repo(tmp_path)
    monkeypatch.setattr(checkin, "REPO", tmp_path)
    monkeypatch.setattr(checkin, "audit", lambda *a, **k: None)
    r = checkin.commit({"paths": ["a.js"], "message": "a: two"}, "owner")
    assert r["ok"] and r["files"] == ["a.js"]
    st = subprocess.run(["git", "-C", str(tmp_path), "status", "--porcelain"], capture_output=True, text=True).stdout
    assert "b.js" in st and "a.js" not in st          # b stays uncommitted


def test_refuses_any_branch_but_dev(tmp_path, monkeypatch):
    _repo(tmp_path, "main")
    monkeypatch.setattr(checkin, "REPO", tmp_path)
    r = checkin.commit({"paths": ["a.js"], "message": "a"}, "owner")
    assert not r["ok"] and "not dev" in r["why"]
