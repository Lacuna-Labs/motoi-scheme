"""ship.py's walls: protected and foreign branches are refused, secrets are not committed, a push is never forced."""
import subprocess

from lacuna_api.control import ship


def _repo(tmp_path, monkeypatch):
    subprocess.run(["git", "init", "-q", "-b", "main", str(tmp_path)], check=True)
    for k, v in (("user.name", "t"), ("user.email", "t@t")):
        subprocess.run(["git", "-C", str(tmp_path), "config", k, v], check=True)
    (tmp_path / "a.txt").write_text("a\n")
    subprocess.run(["git", "-C", str(tmp_path), "add", "-A"], check=True)
    subprocess.run(["git", "-C", str(tmp_path), "commit", "-qm", "init"], check=True)
    monkeypatch.setattr(ship, "CLONE", tmp_path)
    monkeypatch.setattr("lacuna_api.control.core.audit", lambda *a, **k: None, raising=False)


def test_only_lacuna_branches_are_ours():
    assert ship._own("lacuna/fix-cart") is None
    for b in ("main", "dev", "master", "release-2", "feature/x", "refs/heads/main"):
        assert ship._own(b)


def test_main_is_refused_for_commit_and_push(tmp_path, monkeypatch):
    _repo(tmp_path, monkeypatch)
    (tmp_path / "b.txt").write_text("b\n")
    assert ship.do("commit", "something changed here", "t").get("refused")
    assert ship.do("push", "", "t").get("refused")


def test_a_secret_is_not_committed_and_a_clean_change_is(tmp_path, monkeypatch):
    _repo(tmp_path, monkeypatch)
    assert ship.do("branch", "try-it", "t")["branch"] == "lacuna/try-it"
    (tmp_path / ".env").write_text("X=1\n")
    assert "secret" in ship.do("commit", "add an env file now", "t")["refused"]
    (tmp_path / ".env").unlink()
    (tmp_path / "k.py").write_text("T = 'ghp_" + "a" * 36 + "'\n")
    assert "key or token" in ship.do("commit", "add a token to the file", "t")["refused"]
    (tmp_path / "k.py").write_text("T = 1\n")
    r = ship.do("commit", "set T to one in k.py", "t")
    assert r["ok"], r
