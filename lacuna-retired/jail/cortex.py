#!/usr/bin/env python3
"""LACUNA'S CORTEX — the memory that is not a transcript (LACUNA-2.0-DESIGN §5, 2026-10-16).

The same Rust graph store the product runs (`cortex_py.Store`), opened on Lacuna's own directory with Lacuna's own
sealing key, so what the family says stays on this Mac and stays unreadable at rest. Three shapes, each a node with
provenance, linked by typed edges:

    fact      one sourced statement          {"text", "source", "at", "by"}
    episode   what happened in one step or one conversation
                                             {"text", "card", "step", "files", "verdict", "at", "by"}
    decision  a ruling and its why           {"text", "why", "at", "by"}
    person · place · thing · card            the nouns the above are `about`

Edges: `about` (fact/episode/decision → noun), `supersedes` (newer fact → older), `contradicts`, `used-by`
(fact → episode), `in` (episode → card). A new fact never overwrites an old one: it links `supersedes`, and recall
returns the newest with its trail.

Recall is key + meaning: an exact key wins; otherwise the query is embedded (nomic-embed-text through Ollama, the
768-d space the product's cortex uses) and the top-k by cosine per kind come back with their neighbors one hop out.
Small on purpose: the brains this serves are sharp with ten facts and lost in a graph walk.

Run by the broker (outside the jail — it holds the key); the `cortex` tool inside the jail speaks to it:

    cortex remember <kind> <key> <json-props> [about=<kind>/<key> …] [supersedes=<key>]
    cortex recall <words…> [--kind fact|episode|decision] [--k 8] [--since <iso>]
    cortex episode <card> <step> <json>        a step's summary, linked `in` its card
    cortex show <kind> <key>                   one node and its edges
    cortex counts · cortex reindex · cortex dedupe-proposals (the repair of 2026-10-31; run until left is 0)
    cortex repair <slug> <verdict> <namespace> '<json {fix, diff}>'   a fix that PASSED strict → the repair book
    cortex repairs <verdict> [namespace]                               the fixes that worked for that verdict before

Standard library + cortex_py (the product's venv). Never prints the key. Never phones home.
"""
from __future__ import annotations

import datetime as dt
import json
import os
import re
import sys
import time
import urllib.request

HOME = os.path.expanduser("~")
DIR = f"{HOME}/lacuna-world/cortex"
KEY_FILE = f"{HOME}/.lacuna/secrets/cortex-key"
VENV_SITE = f"{HOME}/code/curator/curator-api/.venv/lib/python3.12/site-packages"
OLLAMA = "http://127.0.0.1:11434"
EMBED_MODEL = "nomic-embed-text"                      # the embedder before the switch below existed
# THE EMBEDDER IS A SETTING (2026-10-18): ~/.lacuna/embed.json {"model": …} — EmbeddingGemma once it is on the box (the
# owner: "let's go with EmbeddingGemma and extend the Cortex properly"). The store records which model its vectors came
# from (~/.lacuna/cortex/embed-model); when the setting and the store disagree, recall uses words until `reindex`
# re-embeds EVERY node with the new model — two models' vectors are never compared.
EMBED_FILE = os.path.expanduser("~/.lacuna/embed.json")
INDEXED_FILE = os.path.expanduser("~/.lacuna/cortex/embed-model")
PREFIXES = {"nomic-embed-text": {"query": "", "document": ""},
            "embeddinggemma": {"query": "task: search result | query: ", "document": "title: none | text: "}}


def embed_model() -> str:
    try:
        return json.load(open(EMBED_FILE)).get("model") or EMBED_MODEL
    except (OSError, ValueError):
        return EMBED_MODEL


def indexed_model() -> str:
    try:
        return open(INDEXED_FILE).read().strip() or EMBED_MODEL
    except OSError:
        return EMBED_MODEL                                 # every vector so far was made by the old embedder
KINDS = ("fact", "episode", "decision", "person", "place", "thing", "card", "preference", "repair", "lesson",
         "note", "summary")   # its own notes and its condensed conversations live in the graph too (2026-10-19)
_store = None

# THE SNAPSHOT ON A CADENCE (2026-11-01, P-2026-11-01-cortex-snapshot-per-write). "Lacuna's store is small, so every write
# snapshots" (2026-10-16) stopped being true: the snapshot is 388 MB (5,680 nodes, 1.38 M edges); a snapshot at every
# remember wrote ~22 GB an hour, held the broker's one lock 3-5 s a write (the desk's recall timed out behind it), and froze
# the API, which parsed each new snapshot. A remember lands in the event log at once (its node and edges are durable there);
# the snapshot that makes a vector durable is taken at most every COMPACT_EVERY_S while the store is held open, and when the
# held store's input ends; a process for one call snapshots before it exits, as before. A vector lost to a crash between two
# snapshots is embedded again by `reindex`.
COMPACT_EVERY_S = 300
_snap = {"t": time.time(), "dirty": False}


def _wrote(s, now: bool = False) -> None:
    """A write landed: the snapshot is taken now when `now` or when the last is COMPACT_EVERY_S old, else later."""
    _snap["dirty"] = True
    if now or time.time() - _snap["t"] >= COMPACT_EVERY_S:
        _flush(s)


def _flush(s) -> None:
    """The snapshot, when a write is waiting for one (snapshot + truncate of the log: `compact`)."""
    if _snap["dirty"]:
        s.compact()
    _snap.update(t=time.time(), dirty=False)


def _open():
    global _store
    if _store is not None:
        return _store
    if not os.environ.get("CURATOR_CORTEX_KEY"):
        with open(KEY_FILE) as f:
            os.environ["CURATOR_CORTEX_KEY"] = f.read().strip()
    if VENV_SITE not in sys.path:
        sys.path.insert(0, VENV_SITE)
    import cortex_py  # the product's Rust store

    os.makedirs(DIR, exist_ok=True)
    _store = cortex_py.Store(DIR)
    return _store


def now_iso() -> str:
    return dt.datetime.now().isoformat(timespec="seconds")


def embed(text: str, timeout: int = 90, tries: int = 2, role: str = "document", model: str | None = None) -> list[float] | None:
    """One 768-d vector, or None when the embedder is away (recall then falls back to keys and words)."""
    model = model or embed_model()
    text = (PREFIXES.get(model) or {}).get(role, "") + text
    body = json.dumps({"model": model, "prompt": text[:4000], "keep_alive": "24h"}).encode()
    for attempt in range(1, tries + 1):   # the first call after a quiet spell loads the embedder (a few seconds)
        try:
            req = urllib.request.Request(f"{OLLAMA}/api/embeddings", data=body, headers={"Content-Type": "application/json"})
            with urllib.request.urlopen(req, timeout=timeout) as r:
                v = json.load(r).get("embedding")
            return v if isinstance(v, list) and len(v) == 768 else None
        except Exception:
            if attempt == tries:
                return None
            time.sleep(2)
    return None


def slug(words: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", words.lower()).strip("-")[:80] or "x"


# ── writes ─────────────────────────────────────────────────────────────────────────────────────────────────────────

def remember(kind: str, key: str, props: dict, about: list[tuple[str, str]] = (), supersedes: str | None = None,
             by: str = "lacuna") -> dict:
    if kind not in KINDS:
        return {"ok": False, "error": f"kind must be one of {', '.join(KINDS)}"}
    s = _open()
    # A NESTED VALUE IS NOT A REFUSAL (2026-10-21: the sentry's episode carried {"counts": {...}} and the store refused the
    # whole write — "values must be None, bool, int, float, or str" — which every caller then had to discover. Flatten it
    # here, once, for every writer: a dict or a list becomes its JSON, the rest passes through.
    props = {k: (v if v is None or isinstance(v, (str, int, float, bool)) else json.dumps(v, ensure_ascii=False))
             for k, v in dict(props or {}).items()}
    props.setdefault("at", now_iso())
    props.setdefault("by", by)
    s.put_node(kind, key, props)
    # A WRITE NEVER WAITS ON AN EMBEDDING (1.3, 2026-10-17): with the GPU busy (a battery on the local brains) an episode
    # write took minutes and held every other memory call behind it. The node lands now; its vector is filled by
    # `reindex` (the runner calls it when the lease is free), and recall finds it by its words meanwhile.
    for ak, akey in about:
        if (ak, akey) == (kind, key):
            continue   # a thing is not about itself
        if s.get_node(ak, akey) is None:
            s.put_node(ak, akey, {"name": akey, "at": props["at"], "by": by})
        s.put_edge("about", kind, key, ak, akey, {"ts": time.time()})
    if supersedes and s.get_node(kind, supersedes) is not None:
        s.put_edge("supersedes", kind, key, kind, supersedes, {"ts": time.time()})
    # ★ THE VECTOR LIVES IN THE SNAPSHOT (measured 2026-10-16): nodes and edges ride the event log and survive the
    # process; an embedding is only durable after `compact()` (snapshot + truncate), taken on the cadence above
    _wrote(s)
    return {"ok": True, "kind": kind, "key": key}


def episode(card: str, step: str, props: dict, by: str = "lacuna") -> dict:
    key = f"{slug(card)}/{slug(step)}/{int(time.time())}"
    props = dict(props or {})
    props.update({"card": card, "step": step})
    out = remember("episode", key, props, about=[("card", slug(card))], by=by)
    if out.get("ok"):
        _open().put_edge("in", "episode", key, "card", slug(card), {"ts": time.time()})
    return out


# ── the repair book: what fixed which verdict, so the next brain starts from a known fix (2.0 §5, the learning
#    apparatus: the memory learns while the brains work; nothing trains) ───────────────────────────────────────────

def repair(slug: str, verdict: str, namespace: str, fix: str, diff: str, by: str = "lacuna") -> dict:
    """One repair that PASSED strict: the symptom (verdict class), the cart's namespace, the fix in words, the diff."""
    key = f"{slug}/{int(time.time())}"
    props = {"text": f"{verdict} on a {namespace} cart was fixed by: {fix}", "slug": slug, "verdict": verdict,
             "namespace": namespace, "fix": fix, "diff": diff[:4000], "source": f"strict pass, card by {by}"}
    out = remember("repair", key, props, about=[("thing", f"verdict:{verdict}"), ("thing", f"namespace:{namespace}")], by=by)
    return out


def lesson(topic: str, text: str, by: str = "lacuna") -> dict:
    """A mistake worth not making twice (B24): what was tried and what went wrong, under a topic (worker-writing,
    repair:<verdict>, …). Keyed by its words, so the same lesson is kept once, not a thousand times."""
    import hashlib
    key = f"{topic}/{hashlib.sha1(text.strip().lower().encode()).hexdigest()[:12]}"
    s = _open()
    if s.get_node("lesson", key):
        n = s.get_node("lesson", key)
        n["props"]["seen"] = int(n["props"].get("seen", 1)) + 1
        n["props"]["last"] = now_iso()
        s.put_node("lesson", key, n["props"])
        return {"ok": True, "key": key, "seen": n["props"]["seen"]}
    return remember("lesson", key, {"text": text[:500], "topic": topic, "seen": 1, "last": now_iso(), "source": "a failed try"}, by=by)


def lessons_for(topic: str, k: int = 8) -> list[dict]:
    """The lessons of a topic, the most often learned first."""
    s = _open()
    try:
        rows = [n["props"] for n in s.nodes_of_kind("lesson") if str(n["props"].get("topic", "")).startswith(topic)]
    except Exception:
        return []
    rows.sort(key=lambda p: (-int(p.get("seen", 1)), str(p.get("last", ""))), reverse=False)
    return rows[:k]


def repairs_for(verdict: str, namespace: str | None = None, k: int = 3) -> list[dict]:
    """The fixes that worked for this verdict before — same namespace first, then any."""
    s = _open()
    rows = []
    try:
        for n in s.nodes_of_kind("repair"):
            p = n["props"]
            if p.get("verdict") == verdict:
                rows.append((0 if p.get("namespace") == namespace else 1, str(p.get("at", "")), p))
    except Exception:
        return []
    rows.sort(key=lambda r: (r[0], r[1]), reverse=False)
    rows.sort(key=lambda r: r[0])
    return [r[2] for r in rows[:k]]


# ── reads ──────────────────────────────────────────────────────────────────────────────────────────────────────────

def _superseded(s) -> set[tuple[str, str]]:
    return {(e["to_kind"], e["to_key"]) for e in s.edges() if e.get("kind") == "supersedes"}


def _neighbors(s, kind: str, key: str) -> list[dict]:
    out = []
    for e in s.edges():
        if e["from_kind"] == kind and e["from_key"] == key:
            out.append({"edge": e["kind"], "to": f"{e['to_kind']}/{e['to_key']}"})
        elif e["to_kind"] == kind and e["to_key"] == key:
            out.append({"edge": e["kind"], "from": f"{e['from_kind']}/{e['from_key']}"})
    return out[:12]


def recall(query: str, kind: str | None = None, k: int = 8, since: str | None = None) -> dict:
    s = _open()
    kinds = [kind] if kind else ["decision", "fact", "episode", "preference", "person", "thing", "place"]
    old = _superseded(s)
    hits: list[dict] = []
    # an exact key wins
    for kd in kinds:
        n = s.get_node(kd, query)
        if n:
            hits.append({"kind": kd, "key": query, "props": n["props"], "score": 1.0, "why": "key"})
    # recall waits 4 s at most for meaning; words carry it otherwise — and when the store's vectors came from another
    # model than the setting (a switch not yet re-indexed), meaning sits out: words carry it until reindex
    v = embed(query, timeout=4, tries=1, role="query") if indexed_model() == embed_model() else None
    if v:
        for kd in kinds:
            try:
                for node, score in s.vector_topk(v, kd, k):
                    if (kd, node["key"]) in old or any(h["key"] == node["key"] and h["kind"] == kd for h in hits):
                        continue
                    hits.append({"kind": kd, "key": node["key"], "props": node["props"], "score": round(float(score), 3), "why": "meaning"})
            except Exception:
                pass
    # BY ITS WORDS (1.3): an unembedded node, or no embedder — the query's words against the node's text, newest first
    words = {w for w in re.findall(r"[a-z0-9]{3,}", query.lower())}
    if words:
        for kd in kinds:
            try:
                for node in s.nodes_of_kind(kd):
                    if (kd, node["key"]) in old or any(h["key"] == node["key"] and h["kind"] == kd for h in hits):
                        continue
                    if v and s.get_embedding(kd, node["key"]) is not None:
                        continue                 # meaning already judged this one
                    text = (str(node["props"].get("text") or node["props"].get("name") or "") + " " + node["key"]).lower()
                    have = sum(1 for w in words if w in text)
                    if have and have / len(words) >= 0.5:
                        hits.append({"kind": kd, "key": node["key"], "props": node["props"],
                                     "score": round(0.45 + 0.4 * have / len(words), 3), "why": "words"})
            except Exception:
                pass
    if not v and not hits:
        # no embedder and no words in common: the newest of each kind
        for kd in kinds:
            try:
                for node in sorted(s.nodes_of_kind(kd), key=lambda n: str(n["props"].get("at", "")), reverse=True)[:k]:
                    if (kd, node["key"]) not in old:
                        hits.append({"kind": kd, "key": node["key"], "props": node["props"], "score": 0.0, "why": "recent"})
            except Exception:
                pass
    if since:
        hits = [h for h in hits if str(h["props"].get("at", "")) >= since]
    # by relevance, a decision nudged up a little, the irrelevant dropped (a port question is not a delisting rule)
    if v:
        hits = [h for h in hits if h["why"] == "key" or h["score"] >= 0.45]
    hits.sort(key=lambda h: (-(h["score"] + (0.05 if h["kind"] == "decision" else 0.0)), str(h["props"].get("at", ""))))
    hits = hits[:k]
    for h in hits:
        h["links"] = _neighbors(s, h["kind"], h["key"])
    return {"ok": True, "query": query, "hits": hits, "embedded": v is not None}


MAYBE_SAME = 0.9          # EmbeddingGemma cosine at which a new fact and an older one are probably about the same thing
# THE REINDEX'S BUDGET (P-2026-10-31-cortex-proposal-loop): the broker waits 120 s for one call, then kills the held store and
# tries again; a vector persists only at `compact` (cortex-core storage.rs `set_embedding`), so a killed run kept every edge it
# wrote and none of its vectors, and the next run embedded the same nodes again. A run now stops embedding at the budget,
# compacts and says how many nodes are left; the next run (the runner's ten minutes) goes on from there.
REINDEX_BUDGET_S = 45
PROPOSAL = "maybe-supersedes"
# a run that finishes writes its answer here, so a watchdog can see the last good run (sre/watchdogs.slat
# lacuna.cortex.reindex.01: no good run in 1 h is a page; the runner logged 186 failures and nothing read them)
REINDEXED_FILE = os.path.expanduser("~/.lacuna/cortex/reindexed")


def _proposed(s) -> set:
    """The pairs already proposed, read once per run: (kind, from-key, to-key)."""
    try:
        return {(e.get("from_kind"), e.get("from_key"), e.get("to_key")) for e in s.edges(PROPOSAL)}
    except Exception:
        return set()


def _propose_links(s, kind: str, node: dict, v: list, seen: set | None = None) -> int:
    """A new fact next to a near-identical older one: a PROPOSED `maybe-supersedes` edge with its score — never the real
    `supersedes`, which a person or the brain confirms (the cortex roll-up, C6: the graph keeps itself current). A pair in
    `seen` is never proposed again (the store's `put_edge` appends: 1,353,395 edges over 5,578 pairs by 2026-10-31).
    Returns the edges written."""
    at = str((node.get("props") or {}).get("at") or "")
    try:
        near = s.vector_topk(v, kind, 4)
    except Exception:
        return 0
    made = 0
    for other, score in near:
        if other.get("key") == node["key"] or score < MAYBE_SAME:
            continue
        pair = (kind, node["key"], other["key"])
        if seen is not None and pair in seen:
            continue
        if str((other.get("props") or {}).get("at") or "") < at:
            s.put_edge(PROPOSAL, kind, node["key"], kind, other["key"], {"ts": time.time(), "score": round(float(score), 3)})
            made += 1
            if seen is not None:
                seen.add(pair)
    return made


def reindex(budget_s: float = REINDEX_BUDGET_S, clock=time.monotonic) -> dict:
    """Embed the nodes with words and no vector until the budget is spent, then snapshot; `left` is what the next run takes
    up. After an embedder switch, EVERY node is re-embedded with the new model in one run (no budget: a switch is not
    resumable), and only then does the store say which model its vectors are."""
    s = _open()
    t0 = clock()
    done = left = proposed = 0
    model = embed_model()
    switching = indexed_model() != model
    seen = None if switching else _proposed(s)
    for kd in KINDS:
        try:
            nodes = s.nodes_of_kind(kd)
        except Exception:
            continue
        for n in nodes:
            text = str(n["props"].get("text") or n["props"].get("name") or "")
            if not text or (not switching and s.get_embedding(kd, n["key"]) is not None):
                continue
            if not switching and clock() - t0 >= budget_s:
                left += 1
                continue
            v = embed(f"{kd}: {text}", model=model)
            if switching and not v:
                return {"ok": False, "embedded": done, "why": f"{model} did not answer — the switch waits; recall keeps using words"}
            if v:
                s.set_embedding(kd, n["key"], v)
                done += 1
                if kd in ("fact", "lesson") and not switching:
                    proposed += _propose_links(s, kd, n, v, seen)
    _wrote(s, now=True)
    if switching:
        os.makedirs(os.path.dirname(INDEXED_FILE), exist_ok=True)
        open(INDEXED_FILE, "w").write(model)
    out = {"ok": True, "embedded": done, "left": left, "proposed": proposed, "model": model, "switched": switching,
           "s": round(clock() - t0, 1)}
    try:
        os.makedirs(os.path.dirname(REINDEXED_FILE), exist_ok=True)
        with open(REINDEXED_FILE, "w") as f:
            f.write(json.dumps({**out, "at": now_iso()}) + "\n")
    except OSError:
        pass   # the marker is for the watchdog; the run itself succeeded
    return out


def dedupe_proposals(budget_s: float = REINDEX_BUDGET_S, clock=time.monotonic) -> dict:
    """THE REPAIR of P-2026-10-31-cortex-proposal-loop: one `maybe-supersedes` edge per pair, its highest score and its
    latest time kept, every copy deleted. The most repeated pairs go first; it stops at the budget, compacts and says how
    many pairs are left (run it again). A run killed between a pair's delete and its put loses that one proposal, never a
    node or a confirmed edge."""
    s = _open()
    t0 = clock()
    groups: dict = {}
    for e in s.edges(PROPOSAL):
        k = (e.get("from_kind"), e.get("from_key"), e.get("to_kind"), e.get("to_key"))
        p = e.get("props") or {}
        g = groups.setdefault(k, [0, 0.0, 0.0])
        g[0] += 1
        g[1] = max(g[1], float(p.get("score") or 0))
        g[2] = max(g[2], float(p.get("ts") or 0))
    copies = sorted(((k, g) for k, g in groups.items() if g[0] > 1), key=lambda kg: -kg[1][0])
    repaired = removed = 0
    for (fk, fkey, tk, tkey), (count, score, ts) in copies:
        if clock() - t0 >= budget_s:
            break
        s.del_edge(PROPOSAL, fk, fkey, tk, tkey)
        s.put_edge(PROPOSAL, fk, fkey, tk, tkey, {"ts": ts, "score": round(score, 3)})
        repaired += 1
        removed += count - 1
    _wrote(s, now=True)
    return {"ok": True, "pairs": len(groups), "repaired": repaired, "left": len(copies) - repaired, "removed": removed,
            "s": round(clock() - t0, 1)}


def show(kind: str, key: str) -> dict:
    s = _open()
    n = s.get_node(kind, key)
    return {"ok": n is not None, "node": n, "links": _neighbors(s, kind, key) if n else []}


def counts() -> dict:
    n, e = _open().counts()
    return {"ok": True, "nodes": n, "edges": e}


# ── the words a brain speaks ───────────────────────────────────────────────────────────────────────────────────────

def render(hits: list[dict]) -> str:
    """Recall as the lines a window carries: one per hit, newest facts, decisions marked."""
    lines = []
    for h in hits:
        p = h["props"]
        text = p.get("text") or p.get("name") or json.dumps(p)[:200]
        tag = {"decision": "DECISION", "fact": "fact", "episode": "episode", "preference": "prefers"}.get(h["kind"], h["kind"])
        at = str(p.get("at", ""))[:10]
        extra = f" — why: {p['why']}" if h["kind"] == "decision" and p.get("why") else ""
        lines.append(f"- [{tag} · {at} · {p.get('source') or p.get('by') or '?'}] {text}{extra}")
    return "\n".join(lines)


# ── THE GRAPH READS (2026-10-18, the cortex roll-up C3): the Rust store's own graph operations, as answers ─────────────
def _node_line(n: dict, extra: dict | None = None) -> dict:
    p = n.get("props") or {}
    return {"kind": n.get("kind"), "key": n.get("key"), "at": p.get("at"), "text": str(p.get("text") or p.get("name") or "")[:300], **(extra or {})}


def pointing_at(kind: str, key: str, k: int = 20) -> dict:
    """the reverse edges: everything that points AT this node (runs in a cart, decisions about a card, lessons on a mind)"""
    s = _open()
    out = []
    seen = set()
    for e in s.edges(to_kind=kind, to_key=key):
        mark = (e.get("kind"), e["from_kind"], e["from_key"])
        if mark in seen:
            continue                                            # the same edge written twice is one edge
        seen.add(mark)
        n = s.get_node(e["from_kind"], e["from_key"])
        if n:
            out.append(_node_line(n, {"edge": e.get("kind")}))
    out.sort(key=lambda r: str(r.get("at") or ""), reverse=True)
    return {"ok": True, "of": f"{kind}/{key}", "n": len(out), "pointing": out[:k]}


def like(kind: str, key: str, k: int = 6, among: str | None = None) -> dict:
    """the nearest nodes by meaning to this one (its EmbeddingGemma vector), itself left out"""
    s = _open()
    if s.get_node(kind, key) is None:                           # the proof found this read saying "no vector" of a node that was never there
        return {"ok": False, "why": f"there is no node {kind}/{key}"}
    v = s.get_embedding(kind, key)
    if v is None:
        return {"ok": False, "why": f"{kind}/{key} has no vector yet (the reindex fills it)"}
    if isinstance(v, (bytes, bytearray)):                       # the store keeps it packed: 768 little-endian floats
        import struct
        v = list(struct.unpack(f"<{len(v) // 4}f", v))
    rows = []
    for kd in ([among] if among else KINDS):
        try:
            rows += [(n, sc) for n, sc in s.vector_topk(v, kd, k + 1) if not (n.get("kind") == kind and n.get("key") == key)]
        except Exception:
            continue
    rows.sort(key=lambda t: -t[1])
    return {"ok": True, "like": f"{kind}/{key}", "near": [_node_line(n, {"score": round(sc, 3)}) for n, sc in rows[:k]]}


def arrived_since(when: str, k: int = 40) -> dict:
    """what arrived after a moment (an ISO time, or '6h' / '30m'), newest first, across every kind"""
    m = re.fullmatch(r"(\d+)([hm])", when or "")
    if m:
        delta = dt.timedelta(hours=int(m.group(1))) if m.group(2) == "h" else dt.timedelta(minutes=int(m.group(1)))
        when = (dt.datetime.now() - delta).isoformat(timespec="seconds")
    s = _open()
    out = []
    for kd in KINDS:
        try:
            out += [_node_line(n) for n in s.nodes_of_kind(kd) if str((n.get("props") or {}).get("at") or "") >= when]
        except Exception:
            continue
    out.sort(key=lambda r: str(r.get("at") or ""), reverse=True)
    return {"ok": True, "since": when, "n": len(out), "arrived": out[:k]}


def fading(half_life_h: float = 24.0, k: int = 20) -> dict:
    """the links going cold (§25.9's outer band): each `about` edge weighs 0.5^(age / half-life) by its own ts; the
    coldest first. (The store's decayed_edges answered nothing on these edges, 2026-10-18 — the arithmetic is done here.)"""
    s = _open()
    now, hl = time.time(), half_life_h * 3600.0
    rows = []
    for e in s.edges(kind="about"):
        ts = float((e.get("props") or {}).get("ts") or 0)
        if ts:
            rows.append((0.5 ** ((now - ts) / hl), e))
    rows.sort(key=lambda t: t[0])
    out = []
    for w, e in rows[:k]:
        n = s.get_node(e["from_kind"], e["from_key"])
        if n:
            out.append(_node_line(n, {"weight": round(w, 4), "about": f"{e['to_kind']}/{e['to_key']}"}))
    return {"ok": True, "half_life_h": half_life_h, "fading": out}


def trail(kind: str, key: str, hops: int = 2) -> dict:
    """the breadcrumbs: what this node supersedes, what it is about, what it was in — two hops out"""
    s = _open()
    nodes = s.traverse(kind, key, ["supersedes", "about", "in", "used-by", "contradicts"], hops)
    return {"ok": True, "from": f"{kind}/{key}", "trail": [_node_line(n) for n in nodes][:40]}


def dump(limit: int = 1500) -> dict:
    """the whole graph, small: every node (kind, key, time, its words cut) and every edge (kind, ends, time) — the Cortex
    card draws it and replays it through time"""
    s = _open()
    nodes = []
    for kd in (*KINDS, "lesson"):
        try:
            for n in s.nodes_of_kind(kd):
                p = n.get("props") or {}
                nodes.append({"id": f"{kd}/{n['key']}", "kind": kd, "at": p.get("at"), "text": str(p.get("text") or p.get("name") or n["key"])[:160]})
        except Exception:
            continue
    seen = {n["id"] for n in nodes}
    edges = [{"kind": e.get("kind"), "a": f"{e['from_kind']}/{e['from_key']}", "b": f"{e['to_kind']}/{e['to_key']}", "ts": (e.get("props") or {}).get("ts"),
              "score": (e.get("props") or {}).get("score")} for e in s.edges()]
    edges = [e for e in edges if e["a"] in seen and e["b"] in seen]
    nodes = {n["id"]: n for n in nodes}.values()
    return {"ok": True, "nodes": list(nodes)[:limit], "edges": edges[: limit * 3]}


def _kk(word: str) -> tuple[str, str]:
    if "/" not in word:
        raise ValueError(f"name a node as kind/key, not {word!r}")
    return tuple(word.split("/", 1))  # type: ignore[return-value]


def handle(words: list[str], body: bytes = b"") -> str:
    """The broker's door: `cortex …` words in, one JSON line (or rendered lines) out."""
    try:
        if not words:
            return json.dumps({"ok": False, "error": __doc__.split("\n\n")[0]})
        verb, rest = words[0], words[1:]
        if verb == "counts":
            return json.dumps(counts())
        if verb == "reindex":
            return json.dumps(reindex())
        if verb == "dedupe-proposals":   # the repair of P-2026-10-31-cortex-proposal-loop; bounded, run until left is 0
            return json.dumps(dedupe_proposals())
        if verb == "lesson" and len(rest) >= 2:
            return json.dumps(lesson(rest[0], " ".join(rest[1:])))
        if verb == "lessons" and rest:
            rows = lessons_for(rest[0])
            return "\n".join(f"- ({r.get('seen', 1)}×) {r.get('text')}" for r in rows) or "(no lessons yet)"
        if verb == "embedder":
            return json.dumps({"setting": embed_model(), "indexed": indexed_model(),
                               "meaning_in_recall": embed_model() == indexed_model()})
        if verb == "forget" and len(rest) == 2:
            # one node out of the store (a probe, a wrong fact) — kept in the broker's log as the record of the forgetting
            s_ = _open()
            if s_.get_node(rest[0], rest[1]) is None:
                return json.dumps({"ok": False, "why": f"no {rest[0]} {rest[1]}"})
            s_.del_node(rest[0], rest[1])
            return json.dumps({"ok": True, "forgot": f"{rest[0]}/{rest[1]}"})
        if verb == "dump":
            return json.dumps(dump(), ensure_ascii=False)
        if verb == "pointing-at" and rest:
            return json.dumps(pointing_at(*_kk(rest[0])), ensure_ascii=False)
        if verb == "like" and rest:
            return json.dumps(like(*_kk(rest[0]), k=int(rest[1]) if len(rest) > 1 and rest[1].isdigit() else 6), ensure_ascii=False)
        if verb == "since" and rest:
            return json.dumps(arrived_since(rest[0]), ensure_ascii=False)
        if verb == "fading":
            return json.dumps(fading(float(rest[0]) if rest else 24.0), ensure_ascii=False)
        if verb == "trail" and rest:
            return json.dumps(trail(*_kk(rest[0])), ensure_ascii=False)
        if verb == "show" and len(rest) == 2:
            return json.dumps(show(rest[0], rest[1]))
        if verb == "remember" and len(rest) >= 3:
            kind, key = rest[0], rest[1]
            about, sup, tail = [], None, []
            for w in rest[2:]:
                if w.startswith("about=") and "/" in w:
                    ak, akey = w[6:].split("/", 1); about.append((ak, akey))
                elif w.startswith("supersedes="):
                    sup = w[11:]
                else:
                    tail.append(w)
            raw = " ".join(tail) if tail else body.decode("utf-8", "replace")
            props = json.loads(raw) if raw.strip().startswith("{") else {"text": raw}
            return json.dumps(remember(kind, key, props, about, sup))
        if verb == "episode" and len(rest) >= 3:
            raw = " ".join(rest[2:])
            props = json.loads(raw) if raw.strip().startswith("{") else {"text": raw}
            return json.dumps(episode(rest[0], rest[1], props))
        if verb == "repair" and len(rest) >= 4:
            # cortex repair <slug> <verdict> <namespace> <json {fix, diff}>
            raw = " ".join(rest[3:]) or body.decode("utf-8", "replace")
            j = json.loads(raw) if raw.strip().startswith("{") else {"fix": raw, "diff": ""}
            return json.dumps(repair(rest[0], rest[1], rest[2], str(j.get("fix", "")), str(j.get("diff", ""))))
        if verb == "repairs" and rest:
            # cortex repairs <verdict> [namespace]
            rows = repairs_for(rest[0], rest[1] if len(rest) > 1 else None)
            if not rows:
                return "(no repair of that verdict remembered yet)"
            return "\n\n".join(f"- [{r.get('namespace')} · {str(r.get('at', ''))[:10]} · {r.get('slug')}] {r.get('fix')}\n```diff\n{str(r.get('diff', ''))[:1200]}\n```" for r in rows)
        if verb == "recall" and rest:
            kind, k, since, q = None, 8, None, []
            i = 0
            while i < len(rest):
                if rest[i] == "--kind" and i + 1 < len(rest): kind = rest[i + 1]; i += 2; continue
                if rest[i] == "--k" and i + 1 < len(rest): k = int(rest[i + 1]); i += 2; continue
                if rest[i] == "--since" and i + 1 < len(rest): since = rest[i + 1]; i += 2; continue
                q.append(rest[i]); i += 1
            out = recall(" ".join(q), kind, k, since)
            return render(out["hits"]) if out["hits"] else "(nothing remembered about that yet)"
        return json.dumps({"ok": False, "error": "usage: " + __doc__.split("the `cortex` tool inside the jail speaks to it:")[1].split("Standard library")[0].strip()})
    except Exception as e:  # noqa: BLE001 — the door never crashes the broker
        return json.dumps({"ok": False, "error": f"{e.__class__.__name__}: {e}"[:300]})


def _stdin_body() -> bytes:
    """A piped body, or nothing — never a blocking read on an idle pipe (a background run hung on it, 2026-10-16)."""
    import select
    try:
        if sys.stdin.isatty():
            return b""
        ready, _, _ = select.select([sys.stdin], [], [], 0.2)
        return sys.stdin.buffer.read() if ready else b""
    except Exception:
        return b""


def serve() -> None:
    """THE STORE HELD OPEN (the cortex roll-up C11): one long-lived process for the broker, the Rust store opened once —
    a request is one JSON line in ({"argv": [...], "body": "<base64>"}), one JSON line out ({"answer": "..."}). The broker
    is the store's only writer, so holding it open is safe; a process per call cost ~60 ms of start-up each time."""
    import base64
    for line in sys.stdin:
        try:
            req = json.loads(line)
            body = base64.b64decode(req.get("body") or "")
            ans = handle([str(a) for a in req.get("argv") or []], body)
        except Exception as e:  # noqa: BLE001
            ans = json.dumps({"ok": False, "error": f"serve: {e.__class__.__name__}: {e}"[:300]})
        sys.stdout.write(json.dumps({"answer": ans}) + "\n")
        sys.stdout.flush()
        if _snap["dirty"] and time.time() - _snap["t"] >= COMPACT_EVERY_S:
            _flush(_open())   # after the answer: the caller never waits on a snapshot that came due
    if _snap["dirty"]:
        _flush(_open())       # the broker closed the store's input: what waits is written before the process ends


if __name__ == "__main__":
    if sys.argv[1:] == ["--serve"]:
        serve()
    else:
        out = handle(sys.argv[1:], _stdin_body())
        if _snap["dirty"]:
            _flush(_open())    # a process for one call snapshots before it exits (the old way's durability)
        print(out)
        try:                                   # AN ANSWER THAT SAYS NO MUST EXIT NON-ZERO (2026-10-21): it printed
            failed = json.loads(out).get("ok") is False   # {"ok": false} and exited 0, so every caller's check was a lie
        except (ValueError, AttributeError):
            failed = False
        sys.exit(1 if failed else 0)
