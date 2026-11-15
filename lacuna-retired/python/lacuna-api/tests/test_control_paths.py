"""A NAME IS NOT A PATH (L12 · L13, 2026-09-25).

`remove("..")` passed the old checks (exists first, a pattern that allowed dots) and would have removed ~/.lacuna
whole; `job_log` joined any string under jobs/ and an absolute one reset the join, so a tool result could read any
*.log on disk. A build id and a job id each have one shape now, and nothing else is looked up.
"""
from __future__ import annotations

import pytest

from lacuna_api.control import core, deploys


@pytest.mark.parametrize("bad", ["..", ".", "../", "%2E%2E", "/etc", "a/b", "..builds", ""])
def test_remove_refuses_anything_that_is_not_a_build_id(lacuna_home, monkeypatch, bad):
    builds = lacuna_home / "builds"; builds.mkdir()
    (builds / "2026.0925.0951").mkdir()
    (lacuna_home / "token").write_text("t")
    monkeypatch.setattr(deploys, "BUILDS", builds)
    assert deploys.remove(bad, "test")["ok"] is False
    assert (lacuna_home / "token").exists()
    assert (builds / "2026.0925.0951").exists()


def test_remove_takes_one_build_inside_the_folder(lacuna_home, monkeypatch):
    builds = lacuna_home / "builds"; builds.mkdir()
    (builds / "2026.0925.0951").mkdir(); (builds / "2026.0925.0622").mkdir()
    monkeypatch.setattr(deploys, "BUILDS", builds)
    monkeypatch.setattr(deploys, "audit", lambda *a, **k: None)
    assert deploys.remove("2026.0925.0951", "test")["ok"] is True
    assert not (builds / "2026.0925.0951").exists() and (builds / "2026.0925.0622").exists()


def test_job_tail_reads_only_a_job_id(lacuna_home, tmp_path, monkeypatch):
    jobs = lacuna_home / "jobs"; jobs.mkdir()
    (jobs / "20260925-120000-abc123.log").write_text("line one\nline two\n")
    secret = tmp_path / "secret.log"; secret.write_text("LACUNA_TOKEN=abc123\n")
    monkeypatch.setattr(core, "LACUNA_HOME", lacuna_home)
    assert core.job_tail("20260925-120000-abc123", 1) == "line two"
    for bad in (str(secret), str(secret)[:-4], "../../" + secret.name, "20260925-120000-abc123/../../x", ""):
        assert core.job_tail(bad) == "", bad
