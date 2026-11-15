"""THE BROKER — who is resident, and who may hold the box (2026-10-22).

The basis: three allocators that do not talk to each other. launchd owns the brain (it cannot be evicted — it is not in
Ollama's pool); Ollama owns the small minds and evicts LRU, knowing nothing of a training about to start; the forge loads
MLX in its own process, knowing nothing of either. The broker is the one ledger and the one admission decision.

Its first job is the owner's: a TRUE "who is at the desk", and a switch you can trust. Then it grows into the real
scheduler (memory + bandwidth, Guaranteed/Burstable/BestEffort), which every later consumer hangs off.

  state()                 the truthful picture: the resident brain, the small minds, free/swap, the desk's intent, and
                          whether the intent matches reality
  choose(mode, model)     auto: a quick check picks the desk (a training or a tight box keeps the lighter brain)
  set_desk(mode, model)   lock a brain, or auto; records ~/.lacuna/desk.json
  switch_to(model)        the actual swap, in the background, behind a lock (the script restarts the brain: ~1 min)

The small desks (4B/2B) arrive with the role split — a small model cannot be "the desk" until the chat path can send a
turn to Ollama instead of the brain. Until then the selector offers the two brains and says so honestly.
"""
from __future__ import annotations

import json
import os
import subprocess
import time
import urllib.request
from pathlib import Path

from .core import LACUNA_HOME, audit

DESK = LACUNA_HOME / "desk.json"
OLLAMA = "http://127.0.0.1:11435"

CANDIDATES = {
    "26b": {"tag": "gemma4:26b-a4b-it-qat", "label": "26B MoE (QAT)", "gb": 16.0, "kind": "brain"},
    "31b": {"tag": "gemma4:31b-it-qat", "label": "31B dense (QAT)", "gb": 19.0, "kind": "brain"},
    "12b": {"tag": "gemma4:12b-it-qat", "label": "12B dense (QAT)", "gb": 7.2, "kind": "brain"},
    "4b": {"tag": "gemma3:4b-it-q8_0", "label": "4B dense", "gb": 4.3, "kind": "brain"},
    "2b": {"tag": "gemma4:e2b-it-qat", "label": "2B (QAT)", "gb": 4.3, "kind": "small"},
}


def _read(path: Path, default=None):
    try:
        return json.loads(path.read_text())
    except (OSError, ValueError):
        return default


def _free_gb() -> float:
    try:
        from . import health
        return float(health.memory().get("available_gb") or 0)
    except Exception:  # noqa: BLE001
        return 0.0


def _training() -> bool:
    try:
        from . import forge
        return bool(forge.summary().get("busy"))
    except Exception:  # noqa: BLE001
        return False


def _small_loaded() -> list[dict]:
    try:
        out = subprocess.run(["ollama", "ps"], capture_output=True, text=True, timeout=15,
                             env={**os.environ, "OLLAMA_HOST": OLLAMA}).stdout
        rows = []
        for line in out.splitlines()[1:]:
            parts = line.split()
            if len(parts) >= 5:
                rows.append({"name": parts[0], "size": " ".join(parts[2:4]), "until": " ".join(parts[5:]) or ""})
        return rows
    except Exception:  # noqa: BLE001
        return []


def _brain() -> dict:
    bp = _read(LACUNA_HOME / "brain-profile.json", {}) or {}
    return {"tag": bp.get("brain"), "name": bp.get("name"), "kind": bp.get("kind"), "gb": bp.get("size_gb")}


def desk_intent() -> dict:
    d = _read(DESK, None) or {"mode": "auto", "model": "auto"}
    return {"mode": d.get("mode") or "auto", "model": d.get("model") or "auto"}


LAST = LACUNA_HOME / "last-model.json"


def desk_model() -> str:
    """The name to SEND for the desk: the two brains are one alias, the small desks are Ollama tags."""
    mode = desk_intent()["mode"]
    target = choose(mode, desk_intent()["model"])
    cand = CANDIDATES.get(target, {})
    if cand.get("kind") == "brain":
        return "lacuna-worker-lite"          # the gateway maps the alias to whatever brain is resident
    return cand.get("tag") or "lacuna-worker-lite"


def label_of(serving: str) -> str:
    """A serving name → the model in words (26B MoE, 12B dense, 4B) for the swap block."""
    for c in CANDIDATES.values():
        if c["tag"] == serving:
            return c["label"]
    bp = _read(LACUNA_HOME / "brain-profile.json", {}) or {}
    for c in CANDIDATES.values():
        if c["tag"] == bp.get("brain"):
            return c["label"]
    return str(serving or "?")


def last_model() -> str | None:
    return (_read(LAST, {}) or {}).get("model")


def note_model(model: str) -> None:
    try:
        LAST.write_text(json.dumps({"model": model, "at": time.time()}))
    except OSError:
        pass


def choose(mode: str = "auto", model: str = "auto") -> str:
    if mode == "lock" and model in CANDIDATES:
        return model
    # AUTO: the quick checks. The 26B IS the desk by default — its own footprint leaves ~3-4 GB free, so free memory alone
    # must never count as "tight". Only a training in flight (which does not fit beside it) or a truly starved box
    # (< 2 GB, i.e. something else is holding the RAM) puts the lighter brain at the desk.
    if _training() or _free_gb() < 2.0:
        return "12b"
    return "26b"


def state() -> dict:
    brain = _brain()
    intent = desk_intent()
    target = choose(intent["mode"], intent["model"])
    cand = CANDIDATES.get(target, {})
    return {"desk": {**intent, "target": target, "label": cand.get("label"),
                     "matches": bool(cand.get("tag") and cand.get("tag") == brain.get("tag"))},
            "brain": brain, "small": _small_loaded(), "free_gb": round(_free_gb(), 1),
            "training": _training(), "candidates": CANDIDATES, "at": time.time()}


def set_desk(mode: str, model: str, who: str) -> dict:
    if mode not in ("auto", "lock"):
        return {"ok": False, "why": "mode is auto or lock"}
    if mode == "lock" and model not in CANDIDATES:
        return {"ok": False, "why": f"models: {', '.join(CANDIDATES)}"}
    rec = {"mode": mode, "model": model if mode == "lock" else "auto", "by": who, "at": time.time()}
    try:
        DESK.write_text(json.dumps(rec, indent=1))
    except OSError as e:
        return {"ok": False, "why": f"could not write the desk: {e}"}
    audit(who, "broker.desk", mode=mode, model=model)
    target = choose(mode, model)
    # A SMALL DESK IS REAL (2026-10-22): desk_model() returns its Ollama tag, so the turn goes through the gateway to it.
    return {"ok": True, "state": state(), "needs_switch": CANDIDATES[target]["tag"] != state()["brain"].get("tag")}


def switch_to(model: str, who: str) -> dict:
    """Retired (the final fixup plan 2.5, 2026-11-03): a swap runs only on the foreman's road (drain, release, load once, check),
    reached by the desk's swap keys (the door's POST /api/broker/swap) or /swap in chat. This ran switch-brain.sh outside it."""
    audit(who, "broker.switch.refused", model=model)
    return {"ok": False, "why": "the swap is the foreman's road now: use the desk's swap keys, or type /swap " + str(model) + " in chat"}
