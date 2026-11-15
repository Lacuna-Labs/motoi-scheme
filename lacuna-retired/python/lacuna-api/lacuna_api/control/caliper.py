"""CALIPER ON THE DESK (the owner, 2026-10-18: Caliper becomes an app). Read only: Caliper's own report outputs and the
battery's Caliper act — what was scored, when, against what — and its scenarios. A run is never started from here: the
desk's "run" key files the battery petition (a permission card), and only the owner's yes runs it.

  summary()  {"reports": [{path, score, grade, mode, target, preset, ran_at, version, commit, categories:[{name, score, max,
             reason}], top_issues}], "acts": [{run, status, numbers, reds}], "scenarios": [name…]}

Where it reads (CALIPER_ROOTS, overridable for tests): every caliper-reports/caliper-report.json one level under each
root, the newest Caliper act of the True State battery runs, and the scenario files in Caliper's own repo.
"""
from __future__ import annotations

import json
import os
from pathlib import Path

CODE = Path.home() / "code"


def _roots() -> dict:
    env = os.environ.get("LACUNA_CALIPER_ROOTS")      # "reports=a:b;battery=c;caliper=d" — tests point it at a tmp dir
    if env:
        out = {}
        for part in env.split(";"):
            k, _, v = part.partition("=")
            out[k] = [Path(x) for x in v.split(":") if x]
        return out
    return {"reports": [CODE / "curator", CODE / "curator" / "curator-web", CODE / "caliper"],
            "battery": [CODE / "curator" / "scratch" / "battery" / "true-state"],
            "caliper": [CODE / "caliper"]}


def _read(p: Path):
    try:
        return json.loads(p.read_text())
    except (OSError, ValueError):
        return None


def _report(p: Path) -> dict | None:
    d = _read(p)
    if not isinstance(d, dict) or "score" not in d:
        return None
    cats = [{"name": k, "score": v.get("score"), "max": v.get("max"), "reason": (v.get("reason") or "")[:120]}
            for k, v in (d.get("categories") or {}).items() if isinstance(v, dict)]
    return {"path": str(p), "score": d.get("score"), "grade": d.get("grade"), "mode": d.get("mode"), "target": d.get("target"),
            "preset": d.get("preset"), "ran_at": d.get("ran_at"), "version": d.get("version"), "commit": d.get("commit"),
            "categories": cats, "top_issues": [str(x)[:160] for x in (d.get("top_issues") or [])][:5]}


def reports() -> list[dict]:
    """Every Caliper report we can find, newest first: each project's last one, and Lacuna's own runs (its history)."""
    out = []
    for root in _roots().get("reports", []):
        r = _report(root / "caliper-reports" / "caliper-report.json")
        if r:
            out.append(r)
    default = [] if os.environ.get("LACUNA_CALIPER_ROOTS") else [Path.home() / "lacuna-world" / "scratch" / "caliper"]
    for root in _roots().get("history", default):
        for p in sorted(root.glob("*/caliper-report.json")) if root.is_dir() else []:
            r = _report(p)
            if r:
                out.append(r)
    seen, uniq = set(), []                               # "last" is a copy of the newest run: one report per run
    for r in out:
        k = (r.get("ran_at"), r.get("score"), r.get("target"))
        if k not in seen:
            seen.add(k)
            uniq.append(r)
    return sorted(uniq, key=lambda r: str(r.get("ran_at") or ""), reverse=True)


def live() -> bool:
    """A Caliper run is going right now (its process is up)."""
    import subprocess
    try:
        return bool(subprocess.run(["pgrep", "-f", "caliper score|caliper/dist|caliper-run"], capture_output=True, timeout=3).stdout.strip())
    except (OSError, subprocess.TimeoutExpired):
        return False


def acts(n: int = 6) -> list[dict]:
    out = []
    for root in _roots().get("battery", []):
        try:
            runs = sorted((d for d in root.iterdir() if d.is_dir()), reverse=True)
        except OSError:
            continue
        for run in runs:
            d = _read(run / "act-caliper.json")
            if isinstance(d, dict):
                out.append({"run": run.name, "status": d.get("status"), "numbers": d.get("numbers") or {},
                            "reds": [str(x)[:160] for x in (d.get("reds") or [])][:4]})
            if len(out) >= n:
                break
    return out


def scenarios() -> list[str]:
    names = []
    for root in _roots().get("caliper", []):
        for sub in ("scenarios", "presets"):
            try:
                names += sorted(f"{sub}/{p.name}" for p in (root / sub).iterdir() if not p.name.startswith(".") and (p.is_file() or sub == "presets"))
            except OSError:
                pass
    return names[:40]


def summary() -> dict:
    return {"reports": reports(), "acts": acts(), "scenarios": scenarios(), "live": live()}
