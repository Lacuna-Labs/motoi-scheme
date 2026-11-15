"""THE BATTERY, SEEN (the owner, 2026-10-18: "I want battery to show me what the fuck it's doing"). The True State runs in
curator's scratch/battery/true-state: per run its acts (green · red), the reds of each, its pass, whether it is still
running (no verdict yet), and how many screenshots Caliper took.

  runs(n)   {runs: [{run, live, pass, acts: {name: status}, reds: n, shots: n}], acts: [names]}, for the self-portrait.
  The routes (/api/battery/runs, /act, /shots, /shot) are the door's: lacuna-node/frontend/battery.mjs (2026-11-06, finale §3.12).
"""
from __future__ import annotations

import json
import time
from pathlib import Path

ROOT = Path.home() / "code" / "curator" / "scratch" / "battery" / "true-state"


def _read(p: Path, d):
    try:
        return json.loads(p.read_text())
    except (OSError, ValueError):
        return d


def _fresh(d: Path) -> bool:
    """A run with no verdict is LIVE only while its folder still moves (10 min); an old one without a verdict was cut short."""
    try:
        return time.time() - max(p.stat().st_mtime for p in [d, *d.iterdir()]) < 600
    except (OSError, ValueError):
        return False


def runs(n: int = 20) -> dict:
    out, names = [], []
    for d in sorted((x for x in ROOT.iterdir() if x.is_dir()), reverse=True)[:n] if ROOT.is_dir() else []:
        verdict = _read(d / "verdict.json", None)
        acts = {}
        reds = 0
        for f in sorted(d.glob("act-*.json")):
            a = _read(f, {})
            name = f.stem[4:]
            acts[name] = a.get("status") or "?"
            reds += len(a.get("reds") or [])
            if name not in names:
                names.append(name)
        shots = d / "shots"
        out.append({"run": d.name, "live": verdict is None and _fresh(d), "pass": (verdict or {}).get("pass"), "acts": acts, "reds": reds, "cut": verdict is None and not _fresh(d),
                    "shots": len(list(shots.glob("*.png"))) if shots.is_dir() else 0})
    return {"runs": out, "acts": sorted(names)}

