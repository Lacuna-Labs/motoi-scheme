"""kvring: lane keys, the switch (save the leaving lane, restore the arriving one), the ring's budget."""
import os

import kvring


def test_key_is_safe():
    assert kvring.key(" Chat-General ") == "chat-general"
    assert "/" not in kvring.key("../../etc")
    assert kvring.key("") is None


def test_switch_saves_leaving_and_restores_kept(tmp_path, monkeypatch):
    monkeypatch.setattr(kvring, "DIR", str(tmp_path))
    calls = []

    def fake(slot, action, lane):
        calls.append((action, lane))
        if action == "save":
            open(kvring._file(lane), "wb").write(b"x")
            return {"n_saved": 1}
        return {"n_restored": 1}
    monkeypatch.setattr(kvring, "_slot", fake)
    kvring._lane.clear()
    assert kvring.switch(0, "a") == {}                       # nothing kept yet, nothing leaving
    assert kvring.switch(0, "a") == {}                       # same lane: nothing to do
    assert kvring.switch(0, "b") == {"saved": "a"}           # a leaves (saved); b was never kept
    assert kvring.switch(0, "a") == {"saved": "b", "restored": "a"}
    assert ("restore", "a") in calls


def test_ring_keeps_the_newest_under_budget(tmp_path, monkeypatch):
    monkeypatch.setattr(kvring, "DIR", str(tmp_path))
    monkeypatch.setattr(kvring, "BUDGET", 25)
    for i, n in enumerate((10, 10, 10)):
        f = tmp_path / f"l{i}.bin"
        f.write_bytes(b"x" * n)
        os.utime(f, (1000 + i, 1000 + i))
    kvring._trim()
    assert sorted(p.name for p in tmp_path.iterdir()) == ["l1.bin", "l2.bin"]
