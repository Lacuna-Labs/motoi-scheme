"""pantheon_view — the Forge app's view of the pantheon (lacuna-world/forge): each mind's pairs, training state and
scores against the 80% pass mark. Read-only."""
from __future__ import annotations

# THE PASS MARK (the owner, 2026-10-18: "what if we did 90%?"): a mind enters service at 90% on its held-out pairs or
# not at all; narrow the job until it does — more minds, each narrower
PASS_MARK = 0.9


def pantheon() -> dict:
    """The pantheon as the Forge app draws it (forge/pantheon.json, data/p-*, results/pantheon/*): per mind its title,
    base, job, pairs kept of target, whether its pairs are done, its scores (untrained, trained, Q8 as served), and
    what it is doing now: writing pairs · waiting to train · training · scored · later."""
    import json as _j
    from pathlib import Path as _P
    f = _P.home() / "lacuna-world" / "forge"
    try:
        minds = _j.loads((f / "pantheon.json").read_text())["minds"]
    except (OSError, ValueError, KeyError):
        return {"minds": [], "why": "no pantheon.json"}
    lock = f / "runs" / ".training.lock"
    training = ""
    try:
        training = lock.read_text()[:200] if lock.exists() else ""
    except OSError:
        pass
    out = []
    for m in minds:
        d = f / "data" / f"p-{m['name']}"
        kept = 0
        try:
            kept = sum(1 for _ in open(d / "kept.jsonl"))
        except OSError:
            pass
        done = (d / "DONE").exists()
        res = None
        try:
            res = _j.loads((f / "results" / "pantheon" / f"{m['name']}.json").read_text())
        except (OSError, ValueError):
            pass
        state = ("later" if m.get("later") else "scored" if res else "training" if m["name"] in training
                 else "waiting to train" if done else "writing pairs")
        out.append({"name": m["name"], "title": m.get("title") or m["name"], "base": m["base"], "kind": m["kind"], "ask": m["ask"],
                    "kept": kept, "target": m.get("target"), "done": done, "state": state,
                    "untrained": (res or {}).get("untrained"), "trained": (res or {}).get("trained"), "q8": (res or {}).get("q8"),
                    "pass": bool(res and max((res.get("trained") or 0), (res.get("q8") or 0)) >= PASS_MARK)})
    return {"minds": out, "pass_mark": PASS_MARK}


def propose(name: str, who: str) -> dict:
    """Put a pantheon mind in service, on the owner's press: only at or above the pass mark, one-shot, as llama.cpp serves
    it (the Q8 score). The card's yes goes through forge_verbs.decided → minds_roles.put_in_service (pantheon branch)."""
    import json as _json
    from . import chat
    from .forge import forge_dir
    try:
        raw = _json.loads((forge_dir() / "results" / "pantheon" / f"{name}.json").read_text())
    except (OSError, ValueError):
        return {"ok": False, "refused": f"{name} has no assembly result yet"}
    score = max(raw.get("q8") or 0, 0) or raw.get("trained") or 0
    if score < PASS_MARK:
        return {"ok": False, "refused": f"{name} scored {round(score * 100)}% one-shot; it serves at {round(PASS_MARK * 100)}% — train more or split it"}
    spec = next((m for m in _json.loads((forge_dir() / "pantheon.json").read_text())["minds"] if m["name"] == name), {})
    role = str(spec.get("title") or name).lower()
    return chat.file_petition("forge-propose", None, f"put {spec.get('title') or name} in service", who,
                              args={"specialist": role, "pantheon": name, "name": spec.get("title") or name, "role": spec.get("ask", "")[:120],
                                    "model": raw.get("gguf_q8"), "before": raw.get("untrained"), "after": score,
                                    "numbers": f"one-shot {round((raw.get('untrained') or 0) * 100)}% untrained → {round(score * 100)}% as served (Q8, {raw.get('held_out')} held-out)"})
