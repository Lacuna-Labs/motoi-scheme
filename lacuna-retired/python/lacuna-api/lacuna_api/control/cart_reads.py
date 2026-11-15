"""THE READS OF THE LAST SIX CARTS (Sprint 2, Phase 5: C17–C22; 2026-10-19). Each is a hand — read only — so the cart
that uses it stays a watch cart and runs on its own when its trigger fires. None of them changes anything.

  scripts        C17 every drafted script (~/.lacuna/drafts) against the box's forbidden patterns, with its verdict
  doc-drift      C18 file paths our docs name in `backticks` that no longer exist
  hand-times     C19 the slowest hands (verbs) by p50/p95, from every hand call's timing (hands.do records it)
  ui-times       C20 the desk's own frame times (p50/p95, long frames), from what the desk reports
  box-cost       C21 one score for how loaded the box is: load per core, memory free, the brain's slots in use
  cold-links     C22 the cortex's links going cold (the `fading` read), as pruning candidates — pruning is the owner's
"""
from __future__ import annotations

import json
import os
import re
import time
from pathlib import Path

HOME = Path.home()
TIMES = None            # tests set these; otherwise they follow LACUNA_HOME (never the live home from a test)
UI = None


def _times() -> Path:
    from .core import LACUNA_HOME
    return TIMES or Path(os.environ.get("LACUNA_HOME") or LACUNA_HOME) / "hand-times.jsonl"


def _ui() -> Path:
    from .core import LACUNA_HOME
    return UI or Path(os.environ.get("LACUNA_HOME") or LACUNA_HOME) / "ui-times.jsonl"

FORBIDDEN = [
    (r"\brm\s+-[a-z]*r[a-z]*f?\s+(/|~|\$HOME)(\s|$|/\s*$)", "removes the home or the root"),
    (r"(curl|wget)[^|\n]*\|\s*(ba|z)?sh\b", "pipes a download into a shell"),
    (r"\bsudo\b", "asks for root"),
    (r"~/\.curator(?!-dev)|/\.curator/(?!.*-dev)", "writes the customer's side (~/.curator is QA's)"),
    (r"git\s+push\s+[^\n]*(--force|-f\b)", "force-pushes"),
    (r"git\s+push\s+[^\n]*\bmain\b", "pushes main (main moves only by promote)"),
    (r"launchctl\s+(kickstart|bootout|unload|stop)[^\n]*(qa-api|l2-daemon-qa|curator-dev-tunnel)", "touches QA's services"),
    (r"\b(mkfs|dd\s+if=)", "writes a disk"),
    (r"chmod\s+(-R\s+)?777", "opens permissions to everyone"),
    (r"while\s+(true|:)[^\n]*;\s*do[^\n]*(curl|wget)", "a retry loop against a site (one try, then stop)"),
    (r"(cat|less|head|tail)\s+[^\n]*(secrets/|\.env\b|owner-key|hf-token)", "reads a secret"),
]


def scripts() -> dict:
    d = HOME / ".lacuna" / "drafts"
    rows = []
    for p in sorted(d.glob("*")) if d.is_dir() else []:
        if not p.is_file():
            continue
        text = p.read_text(errors="replace")
        bad = [why for rx, why in FORBIDDEN if re.search(rx, text)]
        rows.append({"file": p.name, "ok": not bad, "why": bad})
    return {"drafts": len(rows), "refused": sum(1 for r in rows if not r["ok"]), "rows": rows}


def _known_paths() -> list[str]:
    import subprocess
    out = []
    for repo in (HOME / "code" / "lacuna", HOME / "code" / "curator", HOME / "code" / "sakura-scheme"):
        r = subprocess.run(["git", "-C", str(repo), "ls-files"], capture_output=True, text=True, timeout=60)
        out += [f"{repo.name}/{x}" for x in r.stdout.splitlines()]
    w = HOME / "lacuna-world"
    for p in w.rglob("*"):
        if p.is_file() and "worktrees" not in p.parts and "jobs" not in p.parts and len(out) < 400000:
            out.append("lacuna-world/" + str(p.relative_to(w)))
    return out


def doc_drift(limit: int = 40) -> dict:
    """a path a doc names is drift when NO file the repos or the world hold ends with it (docs name paths relative to
    a package: control/hands.py is lacuna-api/lacuna_api/control/hands.py)"""
    rx = re.compile(r"`((?:[\w.-]+/)+[\w.-]+\.(?:py|js|jsx|mjs|ts|sks|md|json|sh|gbnf))`")
    known = _known_paths()
    tails = set()
    for k in known:
        parts = k.split("/")
        for i in range(len(parts)):
            tails.add("/".join(parts[i:]))
    gone = []
    for doc in sorted((HOME / "code" / "lacuna" / "docs").glob("*.md")):
        for m in sorted(set(rx.findall(doc.read_text(errors="replace")))):
            if m.startswith(("~", "/")) or "<" in m or "*" in m or m in tails:
                continue
            gone.append({"doc": doc.name, "names": m})
    return {"missing": len(gone), "rows": gone[:limit], "known_files": len(known)}


def note_hand(op: str, secs: float, ok: bool) -> None:
    try:
        with _times().open("a") as f:
            f.write(json.dumps({"t": round(time.time()), "op": op, "ms": round(secs * 1000), "ok": ok}) + "\n")
    except OSError:
        pass


def _pct(xs: list, q: float):
    xs = sorted(xs)
    return xs[min(len(xs) - 1, int(q * len(xs)))] if xs else None


def hand_times(hours: float = 24) -> dict:
    since = time.time() - hours * 3600
    by: dict[str, list] = {}
    try:
        for ln in _times().read_text().splitlines()[-20000:]:
            r = json.loads(ln)
            if r["t"] >= since:
                by.setdefault(r["op"], []).append(r["ms"])
    except (OSError, ValueError):
        pass
    rows = sorted(({"op": op, "calls": len(ms), "p50_ms": _pct(ms, 0.5), "p95_ms": _pct(ms, 0.95)} for op, ms in by.items()),
                  key=lambda r: -(r["p95_ms"] or 0))
    return {"hours": hours, "ops": len(rows), "slowest": rows[:10]}


def ui_times(hours: float = 24) -> dict:
    since = time.time() - hours * 3600
    rows = []
    try:
        rows = [r for r in (json.loads(x) for x in _ui().read_text().splitlines()[-5000:]) if r["t"] >= since]
    except (OSError, ValueError):
        pass
    by: dict[str, list] = {}
    for r in rows:
        by.setdefault(r.get("card") or "home", []).append(r)
    cards = sorted(({"card": c, "samples": len(rs), "p95_ms": _pct([r["p95"] for r in rs if r.get("p95") is not None], 0.5),
                     "long_frames": sum(r.get("long") or 0 for r in rs)} for c, rs in by.items()), key=lambda r: -(r["p95_ms"] or 0))
    return {"hours": hours, "samples": len(rows), "cards": cards[:10]}


def box_cost() -> dict:
    """0 (idle) … 1 (saturated): load per core, memory used, the brain's slots busy — the governor's one number"""
    load = os.getloadavg()[0] / max(1, os.cpu_count() or 1)
    from . import health
    m = health.memory()
    free = (m.get("available_gb") or 0) / max(1, (m.get("total_gb") or 32))
    busy = 0.0
    try:
        import urllib.request
        with urllib.request.urlopen("http://127.0.0.1:8091/slots", timeout=2) as r:
            slots = json.load(r)
        busy = sum(1 for s in slots if s.get("is_processing")) / max(1, len(slots))
    except Exception:  # noqa: BLE001
        pass
    cost = round(min(1.0, 0.4 * min(1.0, load) + 0.4 * (1 - free) + 0.2 * busy), 3)
    return {"cost": cost, "load_per_core": round(load, 2), "memory_free": round(free, 2), "brain_busy": round(busy, 2),
            "advice": "defer background work" if cost >= 0.75 else "room for background work" if cost < 0.5 else "one thing at a time"}


def cold_links(hours: str = "48") -> dict:
    from . import hands
    r = hands.do("fading", [hours])
    res = r.get("result") if r.get("ok") else None
    rows = (res.get("fading") or res.get("links") or []) if isinstance(res, dict) else (res or [])
    return {"cold": len(rows), "rows": rows[:20], "note": "candidates only — the broker prunes on the owner's press"}


def eye_tree(target: str = "web", limit: str = "120") -> dict:
    """G17: the page the eye holds, as its parts (shooter.mjs <id>.tree.json) — role, words, box as fractions; act on one
    with the eye's steer `pick N`. The picture (<id>.jpg) is for when the tree cannot decide."""
    import re as _re
    if not _re.fullmatch(r"[a-z0-9-]{1,40}", str(target)):
        raise ValueError("a target's id: letters, digits, dashes")
    p = HOME / ".lacuna" / "eye" / f"{target}.tree.json"
    try:
        d = json.loads(p.read_text())
    except (OSError, ValueError):
        return {"target": target, "els": [], "why": "the eye holds no tree for this target (is its wall open?)"}
    els = d.get("els") or []
    return {"target": target, "url": d.get("url"), "age_s": round(time.time() - (d.get("at") or 0)), "count": len(els),
            "els": [{"n": i, **e} for i, e in enumerate(els[: int(limit)])]}


def form_probe() -> dict:
    """Synthetic listings through the Shopkeeper's judge (~/lacuna-world/tools/form_probe.py, in Curator's own venv):
    each case breaks one listing one known way; a case that does not raise its signal — or raises one an honest null
    should not — is a mismatch. Pure: the judge reads no store, no network, no model."""
    import subprocess
    py = HOME / "code" / "curator" / "curator-api" / ".venv" / "bin" / "python"
    r = subprocess.run([str(py), str(HOME / "lacuna-world" / "tools" / "form_probe.py")], capture_output=True, text=True, timeout=120)
    if r.returncode:
        raise ValueError(f"the probe did not run: {(r.stderr or r.stdout)[-300:]}")
    d = json.loads(r.stdout)
    return {"cases": d["cases"], "held": d["held"], "mismatches": [x for x in d["rows"] if not x["ok"]],
            "signals": d.get("signals"), "untested": d.get("untested") or [],     # coverage: what no case asks for
            "untested-line": ", ".join(d.get("untested") or []) or "none"}


def cloud_review(cart: str = "") -> dict:
    from . import cloud_kinds
    return cloud_kinds.review(cart)


def cloud_plan(path: str = "", goal: str = "") -> dict:
    from . import cloud_kinds
    return cloud_kinds.plan(path, goal) if goal else cloud_kinds.plan(path)


def cloud_wiki(path: str = "") -> dict:
    from . import cloud_kinds
    return cloud_kinds.wiki(path)


def cloud_merge(path: str = "") -> dict:
    from . import cloud_kinds
    return cloud_kinds.merge(path)


def cloud_mocks(platform: str = "", doc: str = "") -> dict:
    from . import cloud_kinds
    return cloud_kinds.mocks(platform, doc)


def self_repair_check() -> dict:
    from . import self_repair
    return {"checks": self_repair.check(), "recent": self_repair.history(10)}


OPS = {"self-repair-check": self_repair_check, "cloud-wiki": cloud_wiki, "cloud-merge": cloud_merge, "cloud-mocks": cloud_mocks, "cloud-review": cloud_review, "cloud-plan": cloud_plan, "form-probe": form_probe, "eye-tree": eye_tree, "scripts": scripts, "doc-drift": doc_drift, "hand-times": hand_times, "ui-times": ui_times, "box-cost": box_cost, "cold-links": cold_links}
