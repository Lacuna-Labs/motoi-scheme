"""The pure parts of codemap (E7), testfix (E9) and recall-check (E5); run.py moving an exam row."""
import json
import os
import sys
import time

sys.path.insert(0, os.path.dirname(__file__))
from classes import codemap, recall_check, testfix  # noqa: E402


# ── codemap ─────────────────────────────────────────────────────────────────────────────────────────────────────────
def make_pkg(tmp_path):
    top = tmp_path / "curator-api" / "curator_api"
    pkg = top / "stores"
    (pkg / "sub").mkdir(parents=True)
    (top / "__init__.py").write_text("")
    (pkg / "__init__.py").write_text('"""Stores — the connection layer."""\nfrom . import a\n')
    (pkg / "a.py").write_text('"""A does the first thing."""\nfrom .sub import c\n\ndef go():\n    """Go."""\n')
    (pkg / "b.py").write_text('import os\nfrom curator_api.stores import a\nif __name__ == "__main__":\n    pass\n')
    (pkg / "sub" / "__init__.py").write_text("")
    (pkg / "sub" / "c.py").write_text('"""C, deep inside."""\nfrom ..a import go\nfrom ... import stores\n')
    (pkg / "test_a.py").write_text("def test_x():\n    pass\n")
    (pkg / "__pycache__").mkdir()
    (pkg / "__pycache__" / "junk.py").write_text("")
    return pkg


def test_codemap_surveys_every_subfolder_and_leaves_tests_out(tmp_path):
    pkg = make_pkg(tmp_path)
    rows = codemap.survey(str(pkg))
    assert [r["path"] for r in rows] == ["__init__.py", "a.py", "b.py", "sub/__init__.py", "sub/c.py"]
    assert rows[1]["doc"] == "A does the first thing." and rows[1]["defines"] == ["go"]
    assert rows[2]["main"] is True
    assert codemap.import_root(str(pkg)) == (str(tmp_path / "curator-api"), "curator_api.stores")


def test_codemap_import_scan_resolves_relative_and_absolute_imports(tmp_path):
    pkg = make_pkg(tmp_path)
    rows = codemap.survey(str(pkg))
    edges = codemap.import_map(str(pkg), rows)
    assert edges["__init__.py"] == ["a.py"]
    assert edges["a.py"] == ["sub/__init__.py", "sub/c.py"]
    assert edges["b.py"] == ["__init__.py", "a.py"]
    assert edges["sub/c.py"] == ["__init__.py", "a.py"]
    t = codemap.tables(rows, edges)
    assert "| `sub/c.py` | C, deep inside. |" in t
    assert "## Who imports whom" in t and "| `a.py` | sub/__init__.py, sub/c.py | 3: __init__.py, b.py, sub/c.py |" in t
    assert "b.py" in codemap.entry_points(rows, edges)


def test_codemap_names_the_paths_the_gate_would_refuse(tmp_path):
    rows = codemap.survey(str(make_pkg(tmp_path)))
    text = "See `a.py`, `sub/c.py`, `sub/`, `ghost.py`, `nowhere/x.py`, `curator_api.stores` and `https://x.y/z.py`."
    assert codemap.unknown_paths(text, rows) == ["ghost.py", "nowhere/x.py"]
    assert codemap.petition_of("a merge card for lacuna-x is on the desk (petition ab12cd34)") == "ab12cd34"
    assert codemap.petition_of("a merge card for lacuna-x is on the desk (petition None)") is None


# ── testfix ─────────────────────────────────────────────────────────────────────────────────────────────────────────
def test_testfix_knows_where_a_test_lives_and_how_it_runs():
    assert testfix.side_of("curator-api/tests/test_shop_series_pinned.py") == "api"
    assert testfix.side_of("curator-web/src/lib/shopSeries.test.jsx") == "web"
    assert testfix.side_of("curator-api/curator_api/stores/sync.py") is None
    assert testfix.side_of("docs/x.test.js") is None
    cmd, cwd = testfix.command("api", "curator-api/tests/test_x.py", "test_y")
    assert cmd[-1] == "tests/test_x.py::test_y" and cwd == "curator-api" and "no:cacheprovider" in cmd
    cmd, cwd = testfix.command("web", "curator-web/src/lib/a.test.js", "does a thing")
    assert cmd[1:] == ["run", "src/lib/a.test.js", "-t", "does a thing"] and cwd == "curator-web"


def test_testfix_never_writes_a_fixture_or_outside_the_code():
    for bad in ("curator-api/tests/fixtures/shop_series_pinned.json", "curator-web/src/__snapshots__/a.test.js.snap",
                "curator-api/tests/fixtures/helper.py", "../etc/passwd.py", "/abs/x.py", "tools/env/x.py",
                "curator-web/public/x.js", "curator-api/data.jsonl", "curator-api/README.md"):
        assert testfix.allowed(bad), bad
    for good in ("curator-api/curator_api/stores/virtual/ebay_metrics.py", "curator-api/tests/test_shop_series_pinned.py",
                 "curator-web/src/lib/shopSeries.js"):
        assert testfix.allowed(good) is None, good


def test_testfix_follows_imports_and_finds_real_clock_reads(tmp_path):
    api = tmp_path / "curator-api"
    (api / "tests").mkdir(parents=True)
    (api / "curator_api" / "stores" / "virtual").mkdir(parents=True)
    (api / "curator_api" / "__init__.py").write_text("")
    (api / "curator_api" / "stores" / "__init__.py").write_text("from . import virtual\n")
    (api / "curator_api" / "stores" / "virtual" / "__init__.py").write_text("from .metrics import days\n")
    (api / "curator_api" / "stores" / "virtual" / "metrics.py").write_text(
        "import time\nfrom datetime import datetime, UTC\n\ndef days():\n    # datetime.now() in a comment is not a read\n"
        "    return datetime.now(UTC).date()\n\ndef ok():\n    return time.time()\n")
    (api / "tests" / "test_x.py").write_text("import time\nfrom curator_api import stores\nNOW = 1\n")
    reach = testfix.py_closure(str(tmp_path), "curator-api/tests/test_x.py")
    assert "curator-api/curator_api/stores/virtual/metrics.py" in reach
    reads = testfix.clock_reads(str(tmp_path), reach)
    assert reads == ["curator-api/curator_api/stores/virtual/metrics.py:6: return datetime.now(UTC).date()"]
    assert testfix.candidates("", str(tmp_path), "curator-api/tests/test_x.py", reads) == [
        "curator-api/curator_api/stores/virtual/metrics.py"]


def test_testfix_reads_the_files_a_failure_names(tmp_path):
    wt = str(tmp_path)
    (tmp_path / "curator-api" / "curator_api").mkdir(parents=True)
    (tmp_path / "curator-api" / "curator_api" / "m.py").write_text("x = 1\n")
    (tmp_path / "curator-web" / "src" / "lib").mkdir(parents=True)
    (tmp_path / "curator-web" / "src" / "lib" / "a.js").write_text("")
    out = (f'  File "{wt}/curator-api/curator_api/m.py", line 3, in f\n'
           f'  File "/usr/lib/python3/site-packages/x.py", line 1\n'
           f'  File "/elsewhere/curator_api/m.py", line 1\n'
           " ❯ src/lib/a.js:12:4\n")
    assert testfix.named_files(out, wt) == ["curator-api/curator_api/m.py", "curator-web/src/lib/a.js"]


# ── recall-check ────────────────────────────────────────────────────────────────────────────────────────────────────
def test_recall_asks_by_meaning_never_by_id():
    rep = {"id": "r-docs-1018-052311", "worker": "w-docs-1018-052311", "class": "docs",
           "said": "curator-api/curator_api/control/README.md written on lacuna-docs-x (4,210 chars, 12 entries); docs gate passed"}
    q = recall_check.meaning_query(rep)
    assert "1018" not in q and "w-docs" not in q and "/" not in q and q
    assert q.split()[0] == "docs" and "written" in q and "gate" in q
    assert recall_check.ids_of(rep) == ["w-docs-1018-052311", "r-docs-1018-052311"]
    out = "- [episode · 2026-10-18 · worker report] docs worker w-docs-1018-052311: README written\n- [fact · …] other"
    assert recall_check.found(out, recall_check.ids_of(rep)).startswith("- [episode")
    assert recall_check.found("(nothing remembered about that yet)", recall_check.ids_of(rep)) is None


def test_recall_picks_the_newest_report_but_never_its_own(tmp_path):
    for i, wid in enumerate(("w-docs-1", "w-fetch-2", "w-recall-check-3")):
        d = tmp_path / wid
        d.mkdir()
        (d / "report.json").write_text(json.dumps({"worker": wid, "said": "something"}))
        os.utime(d / "report.json", (time.time() + i, time.time() + i))
    assert recall_check.newest_report(str(tmp_path), "w-recall-check-3")["worker"] == "w-fetch-2"


# ── run.py: an exam item's row moves when its worker retires ────────────────────────────────────────────────────────
def test_a_retired_worker_moves_its_exam_row(tmp_path, monkeypatch):
    import run
    exam = tmp_path / "state.json"
    exam.write_text(json.dumps({"started": None, "items": [
        {"id": "E7", "state": "running", "cart": "docs-sweep"}, {"id": "E8", "state": "waiting"}]}))
    monkeypatch.setattr(run, "EXAM", str(exam))

    class W:
        id, dir, started = "w-codemap-1", str(tmp_path), time.time() - 120
        inputs = {"exam": "e7"}
        usage = {"brain_seconds": 42.0, "seat": None}
    run.move_exam(W, {"ok": True, "said": "mapped", "petitions": ["ab12"]})
    rows = {r["id"]: r for r in json.loads(exam.read_text())["items"]}
    assert rows["E7"]["state"] == "press" and rows["E7"]["petition"] == "ab12" and rows["E7"]["worker"] == "w-codemap-1"
    assert rows["E7"]["minutes"] == 2.0 and rows["E7"]["brain_seconds"] == 42.0
    assert rows["E8"] == {"id": "E8", "state": "waiting"}
    assert run.exam_state({"ok": True}) == "done" and run.exam_state({"ok": False, "petitions": ["x"]}) == "failed"
    W.inputs = {}
    run.move_exam(W, {"ok": False})                               # no exam item: nothing moves
    assert json.loads(exam.read_text())["items"][0]["state"] == "press"


# ── testfix's clock: "passes on any date" ───────────────────────────────────────────────────────────────────────────
def test_the_shifted_clock_moves_real_reads_and_leaves_a_tests_own_patch(tmp_path):
    import subprocess
    (tmp_path / "pkg").mkdir()
    (tmp_path / "pkg" / "__init__.py").write_text("")
    (tmp_path / "pkg" / "fragile.py").write_text(
        "import time\nfrom datetime import date, datetime, timezone\n\n"
        "def today():\n    return datetime.now(timezone.utc).date()\n\n"
        "def by_patch():\n    return time.strftime('%Y-%m-%d', time.gmtime(time.time()))\n")
    (tmp_path / "test_fragile.py").write_text(
        "import datetime as dt, time, pytest\n\n"
        "@pytest.fixture\ndef lazy():\n    from pkg import fragile\n    return fragile\n\n"
        "def test_real(lazy):\n    assert lazy.today() == dt.datetime.now(dt.timezone.utc).date()\n\n"
        "def test_patched(lazy, monkeypatch):\n    monkeypatch.setattr(time, 'time', lambda: 0.0)\n"
        "    assert lazy.by_patch() == '1970-01-01'\n")
    plugins = os.path.join(os.path.dirname(__file__), "plugins")

    def go(days):
        env = {**os.environ, "TESTFIX_SHIFT_DAYS": str(days), "TESTFIX_ROOT": str(tmp_path), "PYTHONPATH": plugins}
        p = subprocess.run([sys.executable, "-m", "pytest", "-q", "-p", "no:cacheprovider", "-p", "testfix_shiftclock",
                            "test_fragile.py"], cwd=tmp_path, env=env, capture_output=True, text=True)
        return p.stdout
    assert "2 passed" in go(0)
    out = go(3)                                                  # the real read moves; the test's own patch still wins
    assert "1 failed, 1 passed" in out and "test_real" in out


def test_rerecord_takes_only_a_named_switch():
    assert testfix.rerecord_env({"SHOP_SERIES_PIN_WRITE": "1"}) == {"SHOP_SERIES_PIN_WRITE": "1"}
    assert testfix.rerecord_env({"PATH": "/tmp", "x;rm": "1", "LD_PRELOAD": "a", "PYTHONPATH": "/x", "DYLD_X": "1",
                                 "TESTFIX_SHIFT_DAYS": "9", "NODE_OPTIONS": "-r x", "HOME": "/"}) == {}
    assert testfix.rerecord_env({"bad name": "1", "OK_NAME": "v" * 30}) == {}
    assert testfix.rerecord_env("SHOP=1") == {}
    assert testfix.any_date("/nowhere", "web", "curator-web/src/a.test.js")[0] is True
