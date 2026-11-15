"""Rotation: a log over the limit is archived (gzip) and cut back in place; only KEEP archives are kept."""
import gzip
import importlib


def test_rotate_archives_and_truncates_in_place(tmp_path, monkeypatch):
    monkeypatch.setenv("LACUNA_HOME", str(tmp_path))
    import lacuna_api.control.core as core
    importlib.reload(core)
    import lacuna_api.control.upkeep as up
    importlib.reload(up)
    log = tmp_path / "logs" / "dev-api.log"
    log.write_text("x" * 3000)
    f = open(log, "a")                                  # a writer holding the file open, like a server
    assert up.rotate(log, limit_mb=0.001)
    f.write("after\n"); f.flush()
    assert log.read_text().endswith("after\n") and len(log.read_text()) < 100   # same file, cut back, still written
    arch = list((log.parent / "archive").glob("dev-api.log.*.gz"))
    assert len(arch) == 1 and gzip.open(arch[0]).read() == b"x" * 3000
    assert up.rotate(log, limit_mb=50) is None           # under the limit: untouched
