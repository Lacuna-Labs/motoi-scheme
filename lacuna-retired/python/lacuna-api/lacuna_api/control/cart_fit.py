"""CART FIT — can this cart run now, beside what runs? (CARTS-ARE-THE-WORK §8.3; the owner, 2026-10-18: "You do a memory
validation. If this runs while I'm running, can this run? … that's a CART validation long before it runs").

  fit(minds, others)   minds = a cart header's {job: {model, rungs}}; others = the live carts' minds. The first rung of
                       each mind is what loads (a climb loads the next only when it must, and the 26B is the brain itself,
                       already loaded); each small model costs its weights + OVERHEAD_GB (llama.cpp's context and
                       buffers, measured 2026-10-18: a 0.27 GB Gemma takes 0.65 GB in use)
  climbs(days)         each cart × mind job: how many jobs climbed (retried on a bigger rung) — the retry board (§8.2)
"""
from __future__ import annotations

import json
import os
import time
from pathlib import Path

OVERHEAD_GB = 0.38
BRAIN = "lacuna-worker-lite"
DUE_CLIMBS = 20


def _sizes() -> tuple[dict, dict]:
    from . import ai_control
    st = ai_control.state()
    sizes = {str(m["name"]).removesuffix(":latest"): float(m.get("gb") or 0) for m in st.get("models") or []}
    return sizes, st


def _gb(model: str, sizes: dict) -> float:
    m = str(model or "").removesuffix(":latest")
    if m in sizes:
        return sizes[m]
    try:                                                   # a pantheon role: its GGUF on disk
        prof = json.loads((Path.home() / "code/lacuna/lacuna-box/brain/box-minds.json").read_text())
        p = ((prof.get("roles") or {}).get(m) or {}).get("model")
        if p and os.path.exists(p):
            return os.path.getsize(p) / 2**30
    except (OSError, ValueError):
        pass
    return 0.3                                             # an unknown small mind: a 270M's size, said as a guess


def need(minds: dict, sizes: dict) -> float:
    first = {str(m.get("model") or "").removesuffix(":latest") for m in (minds or {}).values()} - {BRAIN, ""}
    return round(sum(_gb(m, sizes) + OVERHEAD_GB for m in first), 2)


def fit(minds: dict, others: list[dict] | None = None) -> dict:
    try:
        sizes, st = _sizes()
    except Exception as e:  # noqa: BLE001
        return {"fits": None, "why": f"the box's memory could not be read ({e.__class__.__name__})"}
    small = st.get("small") or {}
    budget = float(small.get("budget_gb") or 0)
    used = float(small.get("in_use_gb") or 0)
    beside = sum(need(o, sizes) for o in others or [])
    n = need(minds, sizes)
    free = round(max(0.0, budget - used - beside), 2)
    if n == 0:
        return {"fits": True, "need_gb": 0, "free_gb": free, "why": "no small mind to load: the program and the brain only"}
    ok = n <= free
    why = (f"needs {n} GB beside the brain; {free} GB free for small minds" + (f" (with {beside:.2f} GB held by running carts)" if beside else "")
           + ("" if ok else " — it waits for room, or runs its minds one at a time"))
    return {"fits": ok, "need_gb": n, "free_gb": free, "why": why}


def climbs(days: int = 7) -> dict:
    """(cart, job) → {climbs, due, last} from the cascade's escalations over `days`."""
    f = Path(os.environ.get("LACUNA_WORLD") or Path.home() / "lacuna-world") / "cascade" / "escalations.jsonl"
    since = time.strftime("%Y-%m-%dT%H:%M:%S", time.localtime(time.time() - days * 86400))
    out: dict = {}
    try:
        lines = f.read_text().splitlines()
    except OSError:
        return out
    for ln in lines:
        try:
            r = json.loads(ln)
        except ValueError:
            continue
        if str(r.get("at") or "") < since:
            continue
        k = f"{r.get('cart') or '?'}|{r.get('job') or '?'}"
        row = out.setdefault(k, {"climbs": 0, "last": None})
        row["climbs"] += 1
        row["last"] = r.get("at")
    for row in out.values():
        row["due"] = row["climbs"] >= DUE_CLIMBS
    return out
