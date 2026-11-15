"""A worker's hands read only what they may: logs by name, never a path; nothing outside ~/code and ~/lacuna-world."""
from lacuna_api.control import hands


def test_tail_log_reads_a_named_log(tmp_path, monkeypatch):
    log = tmp_path / "dev-api.log"
    log.write_text("one\ntwo\nthree\n")
    monkeypatch.setitem(hands.LOGS, "dev-api", log)
    r = hands.do("tail-log", ["dev-api", "2"])
    assert r == {"ok": True, "result": {"source": "dev-api", "lines": ["two", "three"]}}


def test_tail_log_refuses_anything_not_on_the_list():
    for bad in ("qa-api", "../../etc/passwd", "/var/log/system.log"):
        r = hands.do("tail-log", [bad])
        assert r["ok"] is False and "may read" in r["why"]


def test_a_path_outside_the_roots_is_refused():
    r = hands.do("files", ["/etc", "*"])
    assert r["ok"] is False and "outside" in r["why"]


def test_read_zst_streams_lines_and_refuses_the_rest(tmp_path, monkeypatch):
    import subprocess
    src = tmp_path / "c.jsonl"
    src.write_text("".join(f'{{"n": {i}}}\n' for i in range(100)))
    subprocess.run(["zstd", "-q", "--long=27", str(src), "-o", str(tmp_path / "c.jsonl.zst")], check=True)
    monkeypatch.setattr(hands, "CORPORA", [tmp_path])
    r = hands.do("read-zst", [str(tmp_path / "c.jsonl.zst"), "3", "10"])
    assert r == {"ok": True, "result": {"path": str((tmp_path / "c.jsonl.zst").resolve()), "skip": 10,
                                        "lines": ['{"n": 10}', '{"n": 11}', '{"n": 12}']}}
    assert hands.do("read-zst", [str(src)])["ok"] is False                       # not a .zst
    assert hands.do("read-zst", ["/etc/hosts.zst"])["ok"] is False               # outside the roots
