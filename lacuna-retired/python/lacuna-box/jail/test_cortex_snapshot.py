"""The cortex's snapshot on a cadence (P-2026-11-01-cortex-snapshot-per-write): remembers inside COMPACT_EVERY_S take no
snapshot, the first one past it takes one, the held store's input ending writes what waits, and a batch's end (a reindex,
the repair) snapshots at once. python3 -m pytest test_cortex_snapshot.py

The store is a fake with the real store's surface that remember uses (put_node, get_node, put_edge, compact); the clock is
a fake. Measured on the box 2026-11-01: the snapshot 388 MB, 5 rewrites in 300 s at one a remember."""
import io
import json
import os
import sys

sys.path.insert(0, os.path.dirname(__file__))
import cortex  # noqa: E402


class Store:
    def __init__(self):
        self.nodes, self.edges, self.compacts = {}, [], 0

    def put_node(self, kind, key, props):
        self.nodes[(kind, key)] = props

    def get_node(self, kind, key):
        p = self.nodes.get((kind, key))
        return {"key": key, "props": p} if p is not None else None

    def put_edge(self, *a):
        self.edges.append(a)

    def compact(self):
        self.compacts += 1


def _setup(monkeypatch, t0=1000.0):
    clock = {"t": t0}
    store = Store()
    monkeypatch.setattr(cortex.time, "time", lambda: clock["t"])
    monkeypatch.setattr(cortex, "_open", lambda: store)
    monkeypatch.setattr(cortex, "_snap", {"t": t0, "dirty": False}, raising=False)   # raising=False: the old module had none
    return clock, store


def test_remembers_inside_the_cadence_take_no_snapshot_and_the_first_past_it_takes_one(monkeypatch):
    clock, store = _setup(monkeypatch)
    for i in range(10):                          # ten lessons in a minute: the sentry-watch climbs of 2026-11-01
        clock["t"] += 6
        assert cortex.remember("lesson", f"climb-{i}", {"text": "climbed"})["ok"]
    assert store.compacts == 0 and cortex._snap["dirty"], "ten writes, no 388 MB rewrite"
    clock["t"] = 1000.0 + cortex.COMPACT_EVERY_S
    cortex.remember("lesson", "climb-10", {"text": "climbed"})
    assert store.compacts == 1 and not cortex._snap["dirty"]
    assert len([k for k in store.nodes if k[0] == "lesson"]) == 11, "every node landed at once"


def test_the_held_stores_input_ending_writes_what_waits_and_a_due_snapshot_follows_an_answer(monkeypatch):
    clock, store = _setup(monkeypatch)
    req = lambda key: json.dumps({"argv": ["remember", "fact", key, json.dumps({"text": "x"})], "body": ""}) + "\n"
    out = io.StringIO()
    monkeypatch.setattr(cortex.sys, "stdin", io.StringIO(req("a") + req("b")))
    monkeypatch.setattr(cortex.sys, "stdout", out)
    cortex.serve()
    answers = [json.loads(json.loads(l)["answer"]) for l in out.getvalue().splitlines()]
    assert [a["ok"] for a in answers] == [True, True]
    assert store.compacts == 1, "one snapshot, at the end of the input"
    clock["t"] += cortex.COMPACT_EVERY_S + 1
    cortex._snap["dirty"] = True
    monkeypatch.setattr(cortex.sys, "stdin", io.StringIO(json.dumps({"argv": ["counts"], "body": ""}) + "\n"))
    monkeypatch.setattr(cortex.sys, "stdout", io.StringIO())
    cortex.serve()
    assert store.compacts == 2, "a due snapshot follows the next answer"


def test_a_batch_end_snapshots_at_once(monkeypatch):
    clock, store = _setup(monkeypatch)
    cortex._wrote(store, now=True)
    assert store.compacts == 1
    cortex._flush(store)
    assert store.compacts == 1, "nothing waits: no second snapshot"
