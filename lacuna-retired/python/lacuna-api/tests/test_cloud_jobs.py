"""E2–E4: the cloud's narrow jobs build their payloads from local reads, draft (never apply), and keep the guards."""
import importlib

import pytest


def _kinds(monkeypatch, tmp_path, seen):
    ck = importlib.import_module("lacuna_api.control.cloud_kinds")
    monkeypatch.setattr(ck.Path if hasattr(ck, "Path") else importlib.import_module("pathlib").Path, "home", lambda: tmp_path)
    monkeypatch.setattr(ck.cloud, "ask", lambda kind, head, body, **kw: seen.append((kind, body, kw)) or {"ok": True, "text": "ANSWER", "model": "m"})
    return ck


def test_wiki_sends_the_outline_not_the_code(monkeypatch, tmp_path):
    seen = []
    ck = _kinds(monkeypatch, tmp_path, seen)
    src = tmp_path / "code" / "m.py"
    src.parent.mkdir(parents=True)
    src.write_text('"""A module that counts."""\n\ndef count(x):\n    secret_inner_line = 42\n    return x\n')
    r = ck.wiki(str(src))
    kind, body, _ = seen[0]
    assert kind == "wiki" and "A module that counts." in body and "count" in body and "secret_inner_line" not in body
    assert "lacuna-world/cloud-drafts/wiki" in r["draft"]


def test_merge_reads_conflicts_and_refuses_outside(monkeypatch, tmp_path):
    seen = []
    ck = _kinds(monkeypatch, tmp_path, seen)
    f = tmp_path / "code" / "c.py"
    f.parent.mkdir(parents=True, exist_ok=True)
    f.write_text("a = 1\n<<<<<<< HEAD\nb = 2\n=======\nb = 3\n>>>>>>> other\n")
    r = ck.merge(str(f))
    assert r["conflicts"] == 1 and "OURS:\nb = 2" in seen[0][1] and "THEIRS:\nb = 3" in seen[0][1]
    with pytest.raises(ValueError):
        ck.merge("/etc/hosts")


def test_mocks_only_reads_public_docs(monkeypatch, tmp_path):
    seen = []
    ck = _kinds(monkeypatch, tmp_path, seen)
    assert "save the public page" in ck.mocks("etsy", "missing.html")["why"]
    (tmp_path / "lacuna-world" / "public-docs").mkdir(parents=True)
    (tmp_path / "lacuna-world" / "public-docs" / "etsy.html").write_text("GET /shops/{id} returns buyer_email")
    ck.mocks("etsy", "etsy.html")
    assert seen[0][0] == "mocks" and seen[0][2].get("public_doc") is True
    with pytest.raises(ValueError):
        ck.mocks("etsy", "../secrets.txt")


def test_public_doc_skips_customer_words_for_mocks_only(monkeypatch):
    cloud = importlib.import_module("lacuna_api.control.cloud")
    got = []
    send = lambda model, req, key: got.append(req) or {"candidates": [{"content": {"parts": [{"text": "{}"}]}}]}
    monkeypatch.setitem(cloud._state, "rest_until", 0)
    monkeypatch.setattr(cloud, "_key", lambda: "k")
    monkeypatch.setattr(cloud, "GAP_S", 0)
    r = cloud.ask("mocks", "H", "the buyer_email field", send=send, public_doc=True)
    assert r["ok"] is True
    r2 = cloud.ask("review", "H", "the buyer email field", send=send, public_doc=True)
    assert r2["ok"] is False and "customer data" in r2["why"]
