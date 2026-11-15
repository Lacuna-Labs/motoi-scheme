"""THE FORGE'S RESULTS, READ (forge.py's half for forge/results/*.json): a run's or an eval's numbers per specialist, in
whatever shape the forge writes them, and the law that a trained mind must beat the untrained one (§41)."""
from __future__ import annotations

from pathlib import Path

from . import forge as F     # read at call time (forge imports this module)


# ── results and evals ──────────────────────────────────────────────────────────────────────────────────────────────────
def _side(d) -> dict | None:
    if not isinstance(d, dict):
        return None
    # the trainer writes three yardsticks ({"gold": …, "held_out": …, "owner": …}); reality decides (§40): gold first
    for k in ("gold", "held_out"):
        if isinstance(d.get(k), dict) and d[k].get("accuracy") is not None:
            return {**_side(d[k]), "yardstick": k}
    acc = F._num(F._first(d, "accuracy", "acc", "score", "right_frac"))
    if acc is not None and acc > 1:
        acc = acc / 100
    lat = F._num(F._first(d, "latency_ms", "ms", "p50_ms"))
    if lat is None and F._num(F._first(d, "latency", "seconds", "latency_s")) is not None:
        lat = F._num(F._first(d, "latency", "seconds", "latency_s")) * 1000
    return {"accuracy": acc, "latency_ms": lat, "n": F._i(F._num(F._first(d, "n", "cases", "of")))} if acc is not None or lat is not None else None


def _result(d: dict, path: Path, spec_hint: str | None) -> dict | None:
    sid = str(F._first(d, "specialist", "mind", "role", "job", "name") or spec_hint or "").lower()
    spec = next((s for s in F.SPECIALISTS if s["id"] == sid or F._keyed(sid, s)), None) or \
        next((s for s in F.SPECIALISTS if F._keyed(path.name, s)), None)
    if not spec:
        return None
    after = _side(F._first(d, "trained", "after", "tuned"))
    before = _side(F._first(d, "untrained", "before", "base_model", "baseline"))
    model = F._first(d, "gguf", "export", "exported", "fused", "adapter", "path", "model")
    held = F._first(d, "set", "eval_set", "held_out")
    if (after or {}).get("yardstick") == "gold":                 # the card names the yardstick its numbers come from
        held = f"{(after or {}).get('n')} gold cases, labelled by what really happened"
    return {"specialist": spec["id"], "file": path.name, "mtime": F._mtime(path),
            "set": f"{int(held)} held-out pairs" if isinstance(held, (int, float)) and not isinstance(held, bool) else held,
            "wins": d.get("wins") if isinstance(d.get("wins"), bool) else None,
            "after": after, "before": before, "model": str(model) if model else None,
            "base": F._first(d, "base", "model"), "method": F._first(d, "method", "mode"), "steps": F._i(F._num(F._first(d, "steps", "iters"))),
            "minutes": F._num(F._first(d, "minutes")), "peak_mem_gb": F._num(F._first(d, "peak_mem_gb", "peak_mem")),
            "swap_gb": F._num(F._first(d, "swap_gb", "swap")),
            "loss": [p for p in (d.get("loss") or []) if isinstance(p, (list, tuple)) and len(p) == 2][-F.MAX_POINTS:]
            if isinstance(d.get("loss"), list) else []}


def results() -> list[dict]:
    out = []
    for f in F._files(F.forge_dir() / "results", "*.json"):
        d = F._read(f)
        if not isinstance(d, dict):
            continue
        r = _result(d, f, None)
        if r:
            out.append(r)
            continue
        for k, v in d.items():                                    # {sentry: {...}, worker: {...}}
            if isinstance(v, dict) and (r := _result(v, f, k)):
                out.append(r)
    return sorted(out, key=lambda r: r["mtime"])


def beats(r: dict | None) -> bool | None:
    """The law (§41): a trained mind goes into service only after it beats the one it replaces — on accuracy."""
    if not r or not r.get("after") or not r.get("before"):
        return r.get("wins") if r else None
    a, b = r["after"].get("accuracy"), r["before"].get("accuracy")
    return None if a is None or b is None else a > b
