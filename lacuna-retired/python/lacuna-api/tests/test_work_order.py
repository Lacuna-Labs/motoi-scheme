"""The work order answers Lacuna's own cards on our side — never QA, her iPad, promote or release — and a split
judgment by its own clear majority only."""
import importlib


def _wo(monkeypatch, tmp_path):
    wo = importlib.import_module("lacuna_api.control.work_order")
    monkeypatch.setattr(wo, "FILE", tmp_path / "wo.json")
    monkeypatch.setattr(wo, "audit", lambda *a, **k: None)
    return wo


def test_nothing_is_answered_without_an_order(monkeypatch, tmp_path):
    wo = _wo(monkeypatch, tmp_path)
    assert wo.covers({"action": "spawn-job", "id": "a"}) is None


def test_our_side_is_answered_the_customer_side_never(monkeypatch, tmp_path):
    wo = _wo(monkeypatch, tmp_path)
    wo.start(2, "owner-key")
    assert wo.covers({"action": "spawn-job", "id": "a"})["approve"] is True
    assert wo.covers({"action": "merge", "id": "b"})["approve"] is True
    for act in ("qa-restart", "deploy-ipad", "promote", "promote-and-build", "release", "cart-step", "forge-propose", "forge-train", "forge-pairs", "forge-eval"):
        assert wo.covers({"action": act, "id": "c"}) is None
    assert wo.covers({"action": "spawn-cart", "id": "d", "args": {"header": {"acts": ["check-in", "promote-build"]}}}) is None
    assert wo.covers({"action": "spawn-cart", "id": "e", "args": {"header": {"acts": ["clean-listed"]}}})["approve"] is True


def test_a_split_judgment_follows_a_clear_majority_only(monkeypatch, tmp_path):
    wo = _wo(monkeypatch, tmp_path)
    wo.start(1, "owner-key")
    assert wo.covers({"action": "worker-asks", "id": "f", "reason": "needs a judgment (2 yes / 1 no, certain 0.6)"})["approve"] is True
    assert wo.covers({"action": "worker-asks", "id": "g", "reason": "needs a judgment (1 yes / 2 no)"})["approve"] is False
    assert wo.covers({"action": "worker-asks", "id": "h", "reason": "needs a judgment (the brain did not answer)"}) is None


def test_it_ends(monkeypatch, tmp_path):
    wo = _wo(monkeypatch, tmp_path)
    wo.start(1, "owner-key")
    wo.end("owner-key")
    assert wo.covers({"action": "spawn-job", "id": "i"}) is None
