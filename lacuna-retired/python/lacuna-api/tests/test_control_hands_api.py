"""The box's verbs read through Lacuna's own API (hands_api.py): every op has a route, words and an example; args are checked."""
import pytest

from lacuna_api.control import hands, hands_api


def test_at_least_25_reads_each_with_route_words_example():
    assert len(hands_api.OPS) >= 25
    for op, (route, words, example) in hands_api.OPS.items():
        assert route.startswith("/api/") and words and example.startswith(f"(hand '{op}")


def test_a_missing_or_unsafe_argument_is_refused_in_words(monkeypatch):
    assert hands.do("service", [])["ok"] is False
    r = hands.do("service", ["dev-api; rm -rf /"])
    assert r["ok"] is False and "argument" in r["why"]


def test_a_read_answers_through_the_api(monkeypatch):
    class R:
        def __enter__(self): return self
        def __exit__(self, *a): return False
        def read(self): return b'{"fresh": true, "screen": "phone"}'
    seen = []
    monkeypatch.setattr(hands_api.urllib.request, "urlopen", lambda req, timeout=0: seen.append(req.full_url) or R())
    assert hands.do("owner-here", []) == {"ok": True, "result": {"fresh": True, "screen": "phone"}}
    assert seen == ["http://127.0.0.1:1138/api/desk/seen"]
