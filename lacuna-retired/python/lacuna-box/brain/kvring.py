"""THE KV RING — each lane's warm head, kept (Sprint 2, G1/G1b; measured on the Studio 2026-10-19).

A slot of the brain keeps the KV of the last prompt it read; the next prompt that starts the same way reads only its new
tail. Two lanes sharing a slot (the general chat, the Release card's lane, the judge …) evict each other, and a person's
next turn re-reads the whole head: 2.3k tokens cost 3.6–4.0 s; a 10k head about 16 s.

So each request names its lane (X-Lacuna-Prefix). When a slot changes lanes, the lane leaving is SAVED to disk and the
lane arriving is RESTORED (llama-server /slots/N?action=save|restore). Measured: save 44 ms, restore 25 ms, and the
restored lane answered in 0.47 s against 3.6 s cold (2,340 of 2,352 tokens from cache). A saved state is ~82 KB per token,
so the ring keeps the newest files under a budget (LACUNA_KV_GB, default 4) and never writes below the disk line.

The brain loads no vision projector: llama-server refuses slot save/restore (and cache reuse) for a multimodal model, and
nothing on the box sends the brain images (the eye is SigLIP, eye/judge.py).

  switch(slot, lane)     before a request: save the slot's lane if it is leaving, restore the arriving lane if kept
  note(slot, lane, tm)   after: one line of timings into ~/.lacuna/brain-cache.jsonl (prompt_n, cache_n, prompt_ms)
"""
from __future__ import annotations

import json
import os
import re
import shutil
import threading
import time
import urllib.request

BRAIN = os.environ.get("BRAIN_URL", "http://127.0.0.1:8091")
DIR = os.path.expanduser(os.environ.get("LACUNA_KV_DIR", "~/.lacuna/kv"))
BUDGET = float(os.environ.get("LACUNA_KV_GB", "4")) * 1e9
DISK_LINE = 0.05                      # the box's line: nothing is written when the disk is under 5% free
FRESH_S = 600                         # a lane saved in the last ten minutes is not written again
LOG = os.path.expanduser(os.environ.get("LACUNA_BRAIN_CACHE", "~/.lacuna/brain-cache.jsonl"))   # a staged gateway keeps its own
_lane: dict[int, str] = {}            # slot → the lane whose KV it holds
_lock = {0: threading.Lock(), 1: threading.Lock(), 2: threading.Lock(), 3: threading.Lock()}


def key(raw: str | None) -> str | None:
    k = re.sub(r"[^a-z0-9:._-]+", "-", (raw or "").strip().lower())[:60].strip("-")
    return k or None


def _file(lane: str) -> str:
    return os.path.join(DIR, lane.replace(":", "_") + ".bin")


def _slot(slot: int, action: str, lane: str) -> dict:
    req = urllib.request.Request(f"{BRAIN}/slots/{slot}?action={action}", json.dumps({"filename": os.path.basename(_file(lane))}).encode(),
                                 {"Content-Type": "application/json"})
    try:
        with urllib.request.urlopen(req, timeout=30) as r:
            return json.load(r)
    except Exception as e:  # noqa: BLE001 — a cache miss is never an error for the person: the brain just reads the head
        return {"error": e.__class__.__name__}


def _room() -> bool:
    try:
        u = shutil.disk_usage(DIR)
        return u.free / u.total > DISK_LINE
    except OSError:
        return False


def _trim() -> None:
    files = sorted((os.path.join(DIR, f) for f in os.listdir(DIR) if f.endswith(".bin")), key=os.path.getmtime, reverse=True)
    total = 0
    for f in files:
        total += os.path.getsize(f)
        if total > BUDGET:
            try:
                os.remove(f)
            except OSError:
                pass


def switch(slot: int | None, lane: str | None) -> dict:
    """Make the slot hold `lane`'s head. Answers what it did: {saved, restored} (for the log)."""
    did = {}
    if slot is None or not lane:
        return did
    os.makedirs(DIR, exist_ok=True)
    with _lock.setdefault(slot, threading.Lock()):
        leaving = _lane.get(slot)
        if leaving == lane:
            return did
        if leaving and _room():
            f = _file(leaving)
            if not os.path.exists(f) or time.time() - os.path.getmtime(f) > FRESH_S:
                r = _slot(slot, "save", leaving)
                did["saved"] = leaving if "n_saved" in r else f"failed: {r.get('error')}"
                _trim()
        if os.path.exists(_file(lane)):
            r = _slot(slot, "restore", lane)
            did["restored"] = lane if "n_restored" in r else f"failed: {r.get('error')}"
            if "n_restored" in r:
                os.utime(_file(lane))                     # the ring keeps what is used
        _lane[slot] = lane
    return did


def note(slot: int | None, lane: str | None, timings: dict, did: dict) -> None:
    try:
        with open(LOG, "a") as f:
            f.write(json.dumps({"t": round(time.time(), 1), "slot": slot, "lane": lane, "prompt_n": timings.get("prompt_n"),
                                "cache_n": timings.get("cache_n"), "prompt_ms": round(timings.get("prompt_ms") or 0), **did}) + "\n")
    except OSError:
        pass


def stats(last: int = 400) -> dict:
    """per lane: turns, the mean share of the prompt read from cache, the mean prompt time — the Phase 1 number"""
    try:
        rows = [json.loads(x) for x in open(LOG).read().splitlines()[-last:]]
    except (OSError, ValueError):
        rows = []
    by: dict[str, list] = {}
    for r in rows:
        by.setdefault(r.get("lane") or "-", []).append(r)
    out = {}
    for lane, rs in by.items():
        hit = [r["cache_n"] / max(1, (r["cache_n"] or 0) + (r["prompt_n"] or 0)) for r in rs if r.get("cache_n") is not None]
        out[lane] = {"turns": len(rs), "cached": round(sum(hit) / len(hit), 3) if hit else None,
                     "prompt_ms": round(sum(r.get("prompt_ms") or 0 for r in rs) / len(rs)), "restored": sum(1 for r in rs if r.get("restored"))}
    files = [f for f in os.listdir(DIR) if f.endswith(".bin")] if os.path.isdir(DIR) else []
    return {"lanes": out, "ring": {"files": len(files), "gb": round(sum(os.path.getsize(os.path.join(DIR, f)) for f in files) / 1e9, 2)}}
