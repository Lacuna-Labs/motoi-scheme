"""The Lacuna reference (reference.py): the system talking about itself, in Motoi's SLAT schema."""
from lacuna_api.control import reference


def test_records_are_slat_lines_with_a_tag_and_keys():
    line = reference.rec("act", name="pass", summary="runs the pass", raises=["a", "b"])
    assert line == '(act :name "pass" :summary "runs the pass" :raises ("a" "b"))'


def test_the_manual_names_every_kind_of_thing(tmp_path, monkeypatch):
    monkeypatch.setenv("LACUNA_WORLD", str(tmp_path))
    out = reference.write()
    text = (tmp_path / "reference" / "LACUNA-REFERENCE.slat").read_text()
    assert out["records"] > 60
    for tag in ("(verb ", "(hand ", "(act ", "(browser-verb "):
        assert tag in text
    assert "(schema :version" in text
