"""REPORTS — everything that reported to Lacuna, in one place (LACUNA-1.3-DESIGN §6, B11).

Two streams, one list, newest first: the battery and the pass (each run appends a line to ~/.lacuna/reports/index.jsonl
and keeps latest-<kind>.md) and Lacuna's own workers (each job's report.json under ~/lacuna-world/jobs). The surface
draws this list; `lacuna reports` says it; `lacuna reports last <kind>` reads the newest of a kind in full.
GET /api/reports (and its day report) is the door's (lacuna-node/frontend/reports.mjs, 2026-11-06, finale §3.12); these
functions stay for the chat's reports tool and the home.
"""
from __future__ import annotations

import json
import time
from pathlib import Path

HOME = Path.home()
INDEX = HOME / ".lacuna" / "reports" / "index.jsonl"
JOBS = HOME / "lacuna-world" / "jobs"


def runs(limit: int = 40) -> list[dict]:
    out = []
    try:
        for ln in INDEX.read_text().splitlines():
            try:
                r = json.loads(ln)
            except ValueError:
                continue
            out.append({"kind": r.get("kind"), "at": r.get("at"), "verdict": r.get("verdict"), "score": r.get("score"),
                        "reds": r.get("reds"), "path": r.get("report"), "said": f"{r.get('kind')} {r.get('score')} ({r.get('verdict')})"})
    except OSError:
        pass
    for d in JOBS.glob("w-*") if JOBS.exists() else []:
        f = d / "report.json"
        if not f.exists():
            continue
        try:
            r = json.loads(f.read_text())
        except (OSError, ValueError):
            continue
        out.append({"kind": "worker:" + d.name.split("-")[1], "id": d.name, "at": f.stat().st_mtime,
                    "verdict": "green" if r.get("ok") else "red", "said": (r.get("said") or "")[:240],
                    "minutes": r.get("minutes"), "path": str(f)})
    out.sort(key=lambda r: -(r.get("at") or 0))
    return out[:limit]


def last(kind: str) -> dict:
    for r in runs(400):
        if (r.get("kind") or "").startswith(kind):
            text = ""
            try:
                text = Path(r["path"]).read_text()[:20000] if r.get("path") else ""
            except OSError:
                text = "(the report file is gone — it lived in a temporary folder)"
            return {**r, "text": text}
    return {"kind": kind, "said": f"no {kind} report yet"}


def words(limit: int = 12) -> str:
    rows = runs(limit)
    if not rows:
        return "nothing has reported yet"
    return "\n".join(f"{time.strftime('%m-%d %H:%M', time.localtime(r['at'] or 0))}  {r['kind']:<16} "
                     f"{(r.get('verdict') or ''):<6} {r['said'][:110]}" for r in rows)


def record() -> dict:
    """What each kind of worker has actually done (B8): passes / runs and the median minutes, from the workers' own
    reports — the evidence Lacuna estimates from and picks a grade by, never a guess."""
    import statistics
    by: dict = {}
    for d in JOBS.glob("w-*") if JOBS.exists() else []:
        f = d / "report.json"
        if not f.exists():
            continue
        try:
            r = json.loads(f.read_text())
        except (OSError, ValueError):
            continue
        cls = d.name.split("-")[1]
        x = by.setdefault(cls, {"runs": 0, "ok": 0, "minutes": []})
        x["runs"] += 1
        x["ok"] += 1 if r.get("ok") else 0
        if isinstance(r.get("minutes"), (int, float)):
            x["minutes"].append(float(r["minutes"]))
    return {cls: {"runs": x["runs"], "ok": x["ok"], "pass_rate": round(x["ok"] / x["runs"], 2) if x["runs"] else None,
                  "median_min": round(statistics.median(x["minutes"]), 1) if x["minutes"] else None}
            for cls, x in sorted(by.items())}


def record_words() -> str:
    r = record()
    return " · ".join(f"{c} {v['ok']}/{v['runs']}" + (f" ~{v['median_min']} min" if v["median_min"] is not None else "")
                      for c, v in r.items()) or "no worker has reported yet"
