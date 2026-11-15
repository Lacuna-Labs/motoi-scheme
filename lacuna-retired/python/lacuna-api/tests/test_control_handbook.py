"""The handbook on the desk and as data: sections, the §0 checklist, tables as rows, the slat kept beside the .md."""
import os
import time

from lacuna_api.control import docs, handbook

MD = """# The handbook

*search it*

## 0. The demo

- [ ] **Pair** the phone (`lacuna pair`)
- [x] Approve a card
      on the desk

## 2. Your press

| You want | Do |
|---|---|
| See devices | `lacuna pair --list` |

1. At your terminal: `lacuna pair`.
"""


def _hb(tmp_path, monkeypatch):
    md = tmp_path / "HB.md"
    md.write_text(MD)
    monkeypatch.setenv("LACUNA_HANDBOOK", str(md))
    monkeypatch.setenv("LACUNA_HANDBOOK_SLAT", str(tmp_path / "world" / "HANDBOOK.slat"))
    return md


def test_parse_sections_checklist_and_rows():
    secs = {s["id"]: s for s in handbook.parse(MD)}
    demo = secs["0-the-demo"]
    assert demo["n"] == "0" and [(s["text"], s["done"]) for s in demo["steps"]] == [
        ("**Pair** the phone (`lacuna pair`)", False), ("Approve a card on the desk", True)]
    press = secs["2-your-press"]
    assert press["rows"] == [["You want", "Do"], ["See devices", "`lacuna pair --list`"]]
    assert press["steps"] == [{"text": "At your terminal: `lacuna pair`.", "done": None}]


def test_slat_is_one_form_per_line_and_regenerates_when_the_md_changes(tmp_path, monkeypatch):
    md = _hb(tmp_path, monkeypatch)
    p = handbook.ensure()
    lines = p.read_text().splitlines()
    assert lines[0].startswith('(handbook :title "The handbook"') and all(ln.startswith("(") and ln.endswith(")") for ln in lines)
    assert '(step :in "0-the-demo" :text "Approve a card on the desk" :done true)' in lines
    assert '(row :in "2-your-press" :cells ("See devices" "`lacuna pair --list`"))' in lines
    before = p.stat().st_mtime
    time.sleep(0.01)
    md.write_text(MD.replace("Approve a card", "Approve one card"))
    os.utime(md, (before + 5, before + 5))
    assert "Approve one card" in handbook.ensure().read_text()


def test_missing_handbook_says_so(tmp_path, monkeypatch):
    monkeypatch.setenv("LACUNA_HANDBOOK", str(tmp_path / "none.md"))
    assert handbook.ensure() is None                    # the read is the door's (handbook.mjs)


def test_chat_search_reads_the_handbook_first():
    assert next(iter(docs.DOCS)) == "handbook" and docs.DOCS["handbook"][1].name == "OWNER-HANDBOOK.md"
