"""THE GRAPH IS THE CONTEXT (Sprint 2, Phase 3: G11 + G12; Gemini's "code as state", kept 2026-10-19).

A model handed a chat history guesses; a model handed the thing itself reads. Two reads, both code:
  card_lines(card)     G11 — a card's neighbourhood in the cortex, breadth-first from `card/<id>`: what points at it
                       (decisions with their why, episodes, facts), newest first, one line each. A card turn carries it.
  cart_record(name)    G12 — a cart's run record from its artifacts: runs, how each ended, how long, the last thing said.
                       A hand (`(hand 'cart-record "release")`), so carts, repairs and judgments read a cart's history,
                       never assume it.
"""
from __future__ import annotations

from datetime import datetime
from pathlib import Path


def card_lines(card: str | None, k: int = 6) -> list[str]:
    if not card:
        return []
    from . import hands
    rows = []
    for node in {f"card/{card}", f"card/{card.removeprefix('s-')}"}:      # the desk card and its cart (s-release · release)
        r = hands.do("pointing-at", [node])
        rows += ((r.get("result") or {}).get("pointing") or []) if r.get("ok") else []
    rows = sorted(rows, key=lambda n: str(n.get("at") or ""), reverse=True)[:k]
    return [f"{str(n.get('at') or '')[:16]} {n.get('kind')}: {str(n.get('text') or n.get('key'))[:180]}" for n in rows]


def _t(s: str | None) -> float | None:
    try:
        return datetime.fromisoformat(str(s)).timestamp()
    except (TypeError, ValueError):
        return None


def cart_record(name: str, last: int = 12) -> dict:
    from . import artifacts
    d = artifacts.root() / str(name)
    if not d.is_dir() or "/" in str(name) or ".." in str(name):
        return {"cart": name, "runs": 0, "why": "no artifacts for this cart"}
    runs = []
    for f in sorted(d.glob("*.slat"), key=lambda p: p.stat().st_mtime, reverse=True)[:last]:
        forms = artifacts._jail().parse_lines(f.read_text(errors="replace"))
        run = next((x for x in forms if x["kind"] == "run"), {})
        out = next((x for x in forms if x["kind"] == "outcome"), {})
        a, b = _t(run.get("started")), _t(run.get("ended"))
        runs.append({"id": run.get("id") or f.stem, "ended": run.get("ended"), "outcome": out.get("is") or out.get("outcome") or "?",
                     "said": str(out.get("reason") or out.get("said") or "")[:160], "secs": round(b - a) if a and b else None})
    ends = [r["outcome"] for r in runs]
    secs = [r["secs"] for r in runs if r["secs"] is not None]
    return {"cart": name, "runs": len(runs), "done": ends.count("done"), "stopped": len(ends) - ends.count("done"),
            "mean_secs": round(sum(secs) / len(secs)) if secs else None, "last": runs[0] if runs else None, "recent": runs[:5]}


DEF = {".py": r"^\s*(?:async\s+)?(?:def|class)\s+([A-Za-z_][\w]*)\s*(\([^)]*\))?",
       ".js": r"^\s*(?:export\s+)?(?:default\s+)?(?:async\s+)?(?:function\s*\*?\s*([A-Za-z_$][\w$]*)\s*(\([^)]*\))|(?:const|let)\s+([A-Za-z_$][\w$]*)\s*=\s*(?:async\s*)?\(?([^)=]*)\)?\s*=>)",
       ".sks": r"^\s*\((?:define|on)\s+\(?'?([^\s()]+)([^)\n]*)"}
DEF[".jsx"] = DEF[".mjs"] = DEF[".ts"] = DEF[".js"]


def outline(path: str, limit: int = 120) -> dict:
    """G16 — a source file as its definitions (name, arguments, line), not its text: what the 26B is handed instead of a
    whole file. Read only, inside ~/code and ~/lacuna-world."""
    import re
    p = Path(str(path)).expanduser()
    if not p.is_absolute():                                 # "curator/curator-api/…" means under ~/code (2026-10-19)
        p = Path.home() / "code" / p
    p = p.resolve()
    roots = (Path.home() / "code", Path.home() / "lacuna-world")
    if not any(str(p).startswith(str(r.resolve()) + "/") for r in roots) or not p.is_file():
        return {"ok": False, "why": "a file inside ~/code or ~/lacuna-world"}
    rx = DEF.get(p.suffix)
    if not rx:
        return {"ok": False, "why": f"no outline for {p.suffix} files"}
    out = []
    for i, line in enumerate(p.read_text(errors="replace").splitlines(), 1):
        m = re.match(rx, line)
        if m:
            g = [x for x in m.groups() if x is not None]
            out.append(f"{i}: {g[0]}{(' ' + g[1].strip()) if len(g) > 1 and g[1].strip() else ''}")
            if len(out) >= limit:
                break
    return {"ok": True, "file": str(p), "lines": len(p.read_text(errors="replace").splitlines()), "defs": out}
