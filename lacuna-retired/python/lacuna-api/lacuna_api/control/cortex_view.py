"""THE CORTEX CARD'S FEED (the owner, 2026-10-18: "Map then becomes insight into the entire cortex itself … maybe a three-
dimensional map … it's going to be beautiful. And so you're going to call that cortex").

What Lacuna can recall, by meaning: every chunk of its index (rag.py — manuals, Curator's and Lacuna's own docs, skills,
the playbook, the journal, every turn), laid out in 3D by cortex_cloud_build.py (topics as nebulae, related topics
near each other), and the recall itself made visible: a question lights the chunks Lacuna would read for it.

  GET /api/cortex/cloud           {n, k, points: [x, y, z, topic, kind, h], topics: […], kinds, built}  (rebuilt in the
                                  background when the index has grown since; the last one is answered meanwhile)
  GET /api/cortex/recall?q=…[&card=s-forge]  the chunks a question recalls, best first, each with `at` (when it was said or
                                  written, ms, or null); with card, that card's area first
  GET /api/cortex/chunk/{h}       one chunk's words
  GET /api/cortex/freq            {freq: {h: times recalled in 7 days}, max} — the stars' frequency lighting
"""
from __future__ import annotations

import json
import subprocess
import threading
import time
from pathlib import Path

from fastapi import APIRouter

from . import rag

router = APIRouter()
CLOUD = rag.RAG_DIR / "cloud.json"
PY = Path.home() / "lacuna-world" / "forge" / ".venv" / "bin" / "python"        # numpy lives there; the API stays light
BUILD = Path(__file__).with_name("cortex_cloud_build.py")
_building = threading.Lock()


def _stale() -> bool:
    try:
        return not CLOUD.exists() or rag.VECTORS.stat().st_mtime > CLOUD.stat().st_mtime + 60
    except OSError:
        return False


def _build(wait: bool = False) -> None:
    # with no cloud at all, a request waits for the build already running (up to 2 min) instead of answering empty
    if not _building.acquire(blocking=wait, timeout=120 if wait else -1):
        return
    try:
        tmp = CLOUD.with_suffix(".tmp")
        subprocess.run([str(PY), str(BUILD), str(rag.VECTORS), str(tmp)], capture_output=True, timeout=300)
        if tmp.exists():
            tmp.replace(CLOUD)
    finally:
        _building.release()


@router.get("/api/cortex/cloud")
def cloud() -> dict:
    if _stale():
        if CLOUD.exists():
            threading.Thread(target=_build, name="cortex-cloud", daemon=True).start()
        else:
            _build(wait=True)
    try:
        d = json.loads(CLOUD.read_text())
        d["built"] = CLOUD.stat().st_mtime
        d["indexing"] = _stale()
        return d
    except (OSError, ValueError):
        return {"n": 0, "points": [], "topics": [], "kinds": [], "why": "the index is still being built"}


@router.get("/api/cortex/freq")
def freq(days: float = 7.0) -> dict:
    """B2: how often each memory was recalled lately — the Cortex lights its stars by it."""
    f = rag.recall_freq(days)
    return {"days": days, "freq": f, "max": max(f.values(), default=0), "recalled": len(f)}


def _at_ms(t: float | None) -> int | None:
    """When a hit was said or written, in ms (the Node route's unit), or None when no record says: its age rides with it (order §1.13c)."""
    return None if t is None else int(t * 1000)


@router.get("/api/cortex/recall")
def recall(q: str = "", k: int = 16, card: str = "") -> dict:
    t0 = time.time()
    hits = rag.search(q, k=max(1, min(40, k)), min_score=0.4, card=card or None)   # a drawer's question: its card's area first (CARDS-2.0 §8.3)
    out = [{"h": rag._h(h["src"], h["text"])[:12], "score": h["score"], "title": h["title"], "loc": h["loc"], "text": h["text"][:600],
            "at": _at_ms(rag._when(h, t0))} for h in hits]
    return {"q": q, "hits": out, "ms": int((time.time() - t0) * 1000), "rides": rag.MIN_SCORE, "loading": not rag._ready.is_set()}


@router.get("/api/cortex/chunk/{h}")
def chunk(h: str) -> dict:
    rag._load()
    with rag._lock:
        r = next((c for c in rag._chunks if c["h"].startswith(h)), None)
    return {"ok": True, "h": h, "src": r["src"], "title": r["title"], "loc": r["loc"], "text": r["text"]} if r else {"ok": False, "why": f"no chunk {h}"}


@router.get("/api/cortex/graph/{op}")
def graph(op: str, a: str = "", b: str = "") -> dict:
    """Lacuna's graph cortex, read: memory · pointing-at · like · since · fading · trail (hands.py, the same reads carts use)"""
    from . import hands
    if op not in ("memory", "pointing-at", "like", "since", "fading", "trail"):
        return {"ok": False, "why": "memory · pointing-at · like · since · fading · trail"}
    return hands.do(op, [x for x in (a, b) if x])


@router.get("/api/cortex/graph-all")
def graph_all() -> dict:
    """Lacuna's whole memory graph for the Cortex card: nodes with their times, edges with theirs (the time scrubber replays it)"""
    from . import lacuna_cortex
    r = lacuna_cortex._call(["dump"], timeout=15)
    return r if isinstance(r, dict) and r.get("ok") else {"ok": False, "nodes": [], "edges": [], "why": str(r)[:200]}


@router.get("/api/cortex/summary")
def summary() -> dict:
    """The Cortex card's tile: counts only (the cloud itself is ~0.5 MB — never polled by a tile)"""
    try:
        d = json.loads(CLOUD.read_text())
    except (OSError, ValueError):
        return {"n": 0, "k": 0, "kinds": {}, "indexing": True}
    kinds: dict = {}
    for p in d.get("points") or []:
        kinds[p[4]] = kinds.get(p[4], 0) + 1
    return {"n": d.get("n", 0), "k": d.get("k", 0), "kinds": kinds, "indexing": _stale()}
