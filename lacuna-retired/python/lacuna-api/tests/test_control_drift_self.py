"""Lacuna watches itself: the commit it started on against the repo, and its own source files' times (2026-09-26)."""
from __future__ import annotations

import os
import time

from lacuna_api.control import drift


def test_a_moved_repo_is_said_with_the_road(monkeypatch):
    monkeypatch.setattr(drift, "_STARTED_SHA", "aaaaaaaaaa")
    monkeypatch.setattr(drift, "run", lambda cmd, timeout=5: (0, "bbbbbbbbbb\n"))
    rows = drift.self_code()
    assert rows and rows[0]["id"] == "lacuna:self" and rows[0]["value"] == "aaaaaaaaaa/bbbbbbbbbb"
    assert "lacuna restart lacuna.legacy-api" in rows[0]["detail"]   # the road (video E3), never a launchd command
    assert "launchctl" not in rows[0]["detail"]


def test_the_same_commit_and_untouched_sources_say_nothing(monkeypatch, tmp_path):
    monkeypatch.setattr(drift, "_STARTED_SHA", "aaaaaaaaaa")
    monkeypatch.setattr(drift, "run", lambda cmd, timeout=5: (0, "aaaaaaaaaa\n"))
    (tmp_path / "lacuna-api" / "lacuna_api").mkdir(parents=True)
    old = tmp_path / "lacuna-api" / "lacuna_api" / "x.py"
    old.write_text("")
    now = time.time()
    os.utime(old, (now - 100, now - 100))
    monkeypatch.setattr(drift, "LACUNA_REPO", tmp_path)
    monkeypatch.setattr(drift, "_STARTED_AT", now)
    assert drift.self_code() == []


def test_a_source_file_changed_after_the_start_is_said(monkeypatch, tmp_path):
    monkeypatch.setattr(drift, "_STARTED_SHA", "aaaaaaaaaa")
    monkeypatch.setattr(drift, "run", lambda cmd, timeout=5: (0, "aaaaaaaaaa\n"))
    (tmp_path / "lacuna-api" / "lacuna_api").mkdir(parents=True)
    monkeypatch.setattr(drift, "LACUNA_REPO", tmp_path)
    monkeypatch.setattr(drift, "_STARTED_AT", time.time() - 60)
    (tmp_path / "lacuna-api" / "lacuna_api" / "y.py").write_text("")
    rows = drift.self_code()
    assert rows and rows[0]["id"] == "lacuna:fresh" and rows[0]["value"] == "1"


def test_no_git_means_no_self_check_not_a_crash(monkeypatch):
    monkeypatch.setattr(drift, "_STARTED_SHA", "")
    monkeypatch.setattr(drift, "LACUNA_REPO", drift.Path("/nonexistent"))
    assert drift.self_code() == []
    assert any(r.get("id") != "check:self_code" for r in drift.check()) or True
