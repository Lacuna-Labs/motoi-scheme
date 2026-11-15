"""P5 (2026-10-25): the cortex never stores a token; a slug or a hash is not one."""
import json

from lacuna_api.control import rag


def test_redact_keeps_slugs_and_hashes_and_scrubs_keys():
    assert rag._redact("https://x/home/?token=Zq7Xw2Vb9Kp4Lm8Nt3Rs6Yh1Ud5Fg0Je&y=1")[0] == "https://x/home/?token=[redacted]&y=1"
    assert rag._redact("Authorization: Bearer abcDEF123456ghiJKL")[0] == "Authorization: Bearer [redacted]"
    slug = "listing-silver-turquoise-ring-size-7-handmade-vintage"
    assert rag._redact(slug) == (slug, 0)
    assert rag._redact("sha256-" + "a" * 64)[1] == 0


def test_the_load_scrubs_old_rows_in_memory(tmp_path, monkeypatch):
    vec = tmp_path / "vectors-x.jsonl"
    monkeypatch.setattr(rag, "RAG_DIR", tmp_path); monkeypatch.setattr(rag, "VECTORS", vec); monkeypatch.setattr(rag, "GONE", vec.with_suffix(".gone"))
    e = rag._pack([0.1] * 768)
    vec.write_text(json.dumps({"h": "c1", "src": "conversation", "title": "t", "loc": "", "text": "url ?token=Zq7Xw2Vb9Kp4Lm8Nt3Rs6Yh1Ud5Fg0Je", "e": e}) + "\n")
    monkeypatch.setattr(rag, "_loaded", False)
    rag._by_hash.clear(); rag._chunks.clear()
    rag._load_sync()
    assert "Zq7X" not in rag._chunks[0]["text"]
    rag._by_hash.clear(); rag._chunks.clear()
