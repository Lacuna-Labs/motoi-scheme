"""Order §1.13c (2026-11-06): a recalled record carries its age. The recall route answers `at` (ms, or None when no record
says) beside each hit, as the Node route does, so the desk's recall lines say how old a record is (video B3: a stale recall
was said as the present). Failure class: a claim without its date."""
import time

from lacuna_api.control import cortex_view, rag


def test_each_recalled_hit_carries_when_it_was_said_or_written(monkeypatch):
    monkeypatch.setattr(rag, "search", lambda q, k=16, min_score=0.4, card=None: [
        {"src": "journal", "title": "journal", "loc": "2026-10-19", "text": "[2026-10-19 01:00] the desk ran on the L1 8B reasoner", "score": 0.6},
        {"src": "lacuna/DISK", "title": "disk", "loc": "x", "text": "a row with no path has no time", "score": 0.5}])
    r = cortex_view.recall("what does the desk run on", 8)
    said = (time.mktime(time.strptime("2026-10-19", "%Y-%m-%d")) + 43200) * 1000
    assert [h["at"] for h in r["hits"]] == [int(said), None]
