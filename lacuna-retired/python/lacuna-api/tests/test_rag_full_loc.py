"""A recall hit names its file by a path the desk can read back (M0, 2026-10-25: a bare name made the next read fail)."""
from lacuna_api.control import rag


def test_old_bare_rows_get_their_path_from_the_sources(monkeypatch):
    monkeypatch.setattr(rag, "_PATHS", {"lacuna/CORTEX-KNOWLEDGE-LOOP": "~/code/lacuna/docs/CORTEX-KNOWLEDGE-LOOP.md"})
    assert rag._full_loc("lacuna/CORTEX-KNOWLEDGE-LOOP", "CORTEX-KNOWLEDGE-LOOP.md:278") == "~/code/lacuna/docs/CORTEX-KNOWLEDGE-LOOP.md:278"
    assert rag._full_loc("journal", "2026-10-19") == "2026-10-19"
    assert rag._full_loc("lacuna/OTHER", "OTHER.md:3") == "OTHER.md:3"
