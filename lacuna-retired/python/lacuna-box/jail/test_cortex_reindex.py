"""The cortex's reindex finishes inside the broker's wait, never proposes a pair twice, and the repair leaves one proposal
per pair (P-2026-10-31-cortex-proposal-loop). python3 -m pytest test_cortex_reindex.py

The store is a fake with the real store's two properties that made the loop: a vector persists only at `compact`
(cortex-core storage.rs `set_embedding`), and `put_edge` appends. The embedder is a fake that costs 80 ms on a fake clock
(measured on the box 2026-10-31: 0.08 s a call)."""
import os
import sys
import tempfile

sys.path.insert(0, os.path.dirname(__file__))
import cortex  # noqa: E402


class Clock:
    def __init__(self):
        self.t = 0.0

    def __call__(self):
        return self.t


class Store:
    """The cortex store's surface the reindex and the repair use."""

    def __init__(self, facts):
        self.nodes = {"fact": [{"key": k, "props": {"text": f"fact {k}", "at": at}} for k, at in facts]}
        self.vectors, self.pending, self.edge_rows, self.compacts, self.full_scans = {}, {}, [], 0, 0

    def kinds(self):
        return list(self.nodes.keys())

    def get_node(self, kind, key):
        return next((n for n in self.nodes.get(kind, []) if n["key"] == key), None)

    def nodes_of_kind(self, kind):
        return list(self.nodes.get(kind, []))

    def get_embedding(self, kind, key):
        return self.vectors.get((kind, key))

    def set_embedding(self, kind, key, v):
        self.pending[(kind, key)] = v        # a vector persists only at compact

    def compact(self):
        self.vectors.update(self.pending)
        self.pending.clear()
        self.compacts += 1

    def put_edge(self, kind, fk, fkey, tk, tkey, props=None):
        self.edge_rows.append({"kind": kind, "from_kind": fk, "from_key": fkey, "to_kind": tk, "to_key": tkey, "props": dict(props or {})})

    def edges(self, kind=None, from_kind=None, from_key=None, to_kind=None, to_key=None):
        if kind is None and from_kind is None and to_kind is None:
            self.full_scans += 1
        return [
            dict(e) for e in self.edge_rows
            if (kind is None or e["kind"] == kind)
            and (from_kind is None or e["from_kind"] == from_kind)
            and (from_key is None or e["from_key"] == from_key)
            and (to_kind is None or e["to_kind"] == to_kind)
            and (to_key is None or e["to_key"] == to_key)
        ]

    def del_edge(self, kind, fk, fkey, tk, tkey):
        self.edge_rows = [e for e in self.edge_rows if (e["kind"], e["from_kind"], e["from_key"], e["to_kind"], e["to_key"]) != (kind, fk, fkey, tk, tkey)]

    def vector_topk(self, v, kind, k):
        # every fact is near every other (the drift notices were 0.976 apart): the older ones come back
        return [(n, 0.976) for n in self.nodes.get(kind, [])][:k]


def wire(monkeypatch, store, clock, cost=0.08):
    def embed(text, **_):
        clock.t += cost
        return [0.1] * 768
    monkeypatch.setattr(cortex, "_open", lambda: store)
    monkeypatch.setattr(cortex, "embed", embed)
    monkeypatch.setattr(cortex, "REINDEXED_FILE", os.path.join(tempfile.mkdtemp(), "reindexed"))   # never the live marker
    monkeypatch.setattr(cortex, "embed_model", lambda: "embeddinggemma")
    monkeypatch.setattr(cortex, "indexed_model", lambda: "embeddinggemma")


def test_a_reindex_stops_at_its_budget_compacts_and_the_next_run_goes_on(monkeypatch, tmp_path):
    # 1,712 facts without a vector cost 137 s at 80 ms: past the broker's 120 s, the old run was killed every time
    store, clock = Store([(f"alert-drift-{i:04d}", f"2026-10-30T{i % 24:02d}") for i in range(1712)]), Clock()
    wire(monkeypatch, store, clock)
    marker = tmp_path / "reindexed"
    monkeypatch.setattr(cortex, "REINDEXED_FILE", str(marker))
    first = cortex.reindex(budget_s=45, clock=clock)
    assert '"embedded": 563' in marker.read_text(), "a run that finishes leaves its answer for the watchdog"
    assert first["ok"] and first["s"] <= 45.1
    assert first["embedded"] == 563 and first["left"] == 1712 - 563
    assert len(store.vectors) == 563, "what the run embedded is kept: it compacted inside the budget"
    runs = 1
    while cortex.reindex(budget_s=45, clock=clock)["left"]:
        runs += 1
    assert len(store.vectors) == 1712 and runs <= 4


def test_a_pair_already_proposed_is_never_proposed_again(monkeypatch):
    store, clock = Store([("a", "2026-10-30T02"), ("b", "2026-10-30T01"), ("c", "2026-10-30T00")]), Clock()
    wire(monkeypatch, store, clock)
    store.put_edge("maybe-supersedes", "fact", "a", "fact", "b", {"ts": 1.0, "score": 0.976})   # a killed run's edge
    r = cortex.reindex(budget_s=45, clock=clock)
    pairs = [(e["from_key"], e["to_key"]) for e in store.edges("maybe-supersedes")]
    assert sorted(pairs) == [("a", "b"), ("a", "c"), ("b", "c")], "each pair once; a→b was not written again"
    assert r["proposed"] == 2
    # the old failure, replayed: vectors lost (no compact reached), the same nodes embedded again — still no new edge
    store.vectors.clear()
    cortex.reindex(budget_s=45, clock=clock)
    assert len(store.edges("maybe-supersedes")) == 3


def test_the_repair_keeps_one_proposal_per_pair_the_most_repeated_first_within_its_budget(monkeypatch):
    store, clock = Store([]), Clock()
    wire(monkeypatch, store, clock)
    for n, pair in ((5, ("x", "y")), (3, ("y", "z")), (1, ("x", "z"))):
        for i in range(n):
            store.put_edge("maybe-supersedes", "fact", pair[0], "fact", pair[1], {"ts": float(i), "score": 0.9 + i / 100})
    store.put_edge("about", "fact", "x", "thing", "dev-api", {"ts": 1.0})     # never touched
    r = cortex.dedupe_proposals(budget_s=45, clock=clock)
    assert (r["pairs"], r["repaired"], r["left"], r["removed"]) == (3, 2, 0, 6)
    kept = {(e["from_key"], e["to_key"]): e["props"] for e in store.edges("maybe-supersedes")}
    assert kept[("x", "y")] == {"ts": 4.0, "score": 0.94}, "the latest time and the highest score"
    assert len(store.edges("about")) == 1 and store.compacts == 1
    # a budget already spent repairs nothing, says what is left, and still compacts
    for _ in range(2):
        store.put_edge("maybe-supersedes", "fact", "x", "fact", "y", {"ts": 9.0, "score": 0.99})
    clock.t = 100.0
    late = cortex.dedupe_proposals(budget_s=0, clock=clock)
    assert (late["repaired"], late["left"]) == (0, 1) and store.compacts == 2


def test_recall_and_dump_query_edges_by_index_and_never_scan_all_proposals(monkeypatch):
    """4.2: recall() and dump() query s.edges(...) by index instead of scanning 1.38M maybe-supersedes edges."""
    store, clock = Store([("a", "2026-10-30T02"), ("b", "2026-10-30T01")]), Clock()
    store.nodes["thing"] = [{"key": "cortex", "props": {"name": "cortex", "at": "2026-10-30T02"}}]
    wire(monkeypatch, store, clock)
    store.put_edge("supersedes", "fact", "a", "fact", "b", {"ts": 2.0})
    store.put_edge("about", "fact", "a", "thing", "cortex", {"ts": 2.0})
    store.put_edge("maybe-supersedes", "fact", "a", "fact", "b", {"ts": 1.0, "score": 0.95})
    r = cortex.recall("fact a", kind="fact")
    assert r["ok"] and [h["key"] for h in r["hits"]] == ["a"]
    assert r["hits"][0]["links"] == [{"edge": "supersedes", "to": "fact/b"}, {"edge": "about", "to": "thing/cortex"}]
    d = cortex.dump()
    assert d["ok"] and len(d["edges"]) == 2
    assert store.full_scans == 0, "recall() and dump() never call unindexed s.edges()"
