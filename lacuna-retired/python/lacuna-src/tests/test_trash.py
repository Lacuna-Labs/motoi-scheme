"""Regression tests for the trash module.

Run:
    cd lacuna-src && python -m pytest tests/ -v
"""
from __future__ import annotations

import os
import tempfile
from pathlib import Path

import pytest


@pytest.fixture
def isolated_home(monkeypatch, tmp_path):
    """Point HOME at a tempdir so ~/.lacuna/trash lands in isolation."""
    monkeypatch.setenv("HOME", str(tmp_path))
    # HOME env var is consulted by pathlib.Path.home() on unix
    yield tmp_path


def test_trash_and_restore_file(isolated_home):
    from lacuna import trash

    src = isolated_home / "important.txt"
    src.write_text("important content")

    entry = trash.send_to_trash(src, kind=trash.EntryKind.FILE, reason="test")
    assert not src.exists(), "source should be gone after trash"
    assert Path(entry.trashed_path).exists(), "trashed path should exist"

    restored = trash.restore(entry.id)
    assert Path(restored.original_path).exists()
    assert Path(restored.original_path).read_text() == "important content"


def test_trash_directory(isolated_home):
    from lacuna import trash

    d = isolated_home / "subdir"
    d.mkdir()
    (d / "a.txt").write_text("a")
    (d / "b.txt").write_text("b")

    entry = trash.send_to_trash(d, kind=trash.EntryKind.DIRECTORY)
    assert not d.exists()
    assert Path(entry.trashed_path).is_dir()


def test_trash_nonexistent_raises(isolated_home):
    from lacuna import trash

    with pytest.raises(FileNotFoundError):
        trash.send_to_trash(isolated_home / "does-not-exist")


def test_restore_refuses_to_overwrite(isolated_home):
    from lacuna import trash

    src = isolated_home / "file.txt"
    src.write_text("original")
    entry = trash.send_to_trash(src)

    # Re-create something at the same path
    src.write_text("new")

    with pytest.raises(FileExistsError):
        trash.restore(entry.id)


def test_list_all_reflects_state(isolated_home):
    from lacuna import trash

    initial = len(trash.list_all())

    f = isolated_home / "one.txt"
    f.write_text("x")
    trash.send_to_trash(f)

    assert len(trash.list_all()) == initial + 1
