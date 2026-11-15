"""UPKEEP — Lacuna keeps itself and the logs it watches from becoming the problem.

  · HEARTBEAT   the worker loop stamps every pass; /api/self says how long ago, and a dead worker thread is restarted
                by the next request (workers.ensure).
  · ROTATION    the SRE manual: "no automatic rotation today — the log grows until the volume is full". Every log Lacuna
                knows over ROTATE_MB is gzipped into <dir>/archive/<name>.<date>.gz and cut back IN PLACE (copy-truncate:
                the writer keeps its file handle); KEEP archives per file. The ingester's offsets reset on a smaller file.
  · OWN FILES   job logs older than 30 days are removed; the audit log is capped.
"""
from __future__ import annotations

import gzip
import shutil
import time
from pathlib import Path

from .core import ENVS, LACUNA_HOME, audit

ROTATE_MB = 50
KEEP = 14
beat = {"t": 0.0, "passes": 0}


def targets() -> list[Path]:
    out = list((LACUNA_HOME / "logs").glob("*.log"))
    for e in ENVS.values():
        h = e["home"]
        out += [h / "telemetry" / "stream.jsonl", h / "logs" / "api.out", h / "logs" / "dev-api.out", h / "logs" / "vite.out"]
    return [p for p in out if p.exists()]


def rotate(path: Path, who: str = "lacuna", limit_mb: float = ROTATE_MB) -> dict | None:
    size = path.stat().st_size
    if size < limit_mb * 1e6:
        return None
    arch = path.parent / "archive"
    arch.mkdir(exist_ok=True)
    dest = arch / f"{path.name}.{time.strftime('%Y%m%d-%H%M%S')}.gz"
    with open(path, "rb") as src, gzip.open(dest, "wb") as out:
        shutil.copyfileobj(src, out)
    with open(path, "r+b") as f:
        f.truncate(0)
    old = sorted(arch.glob(f"{path.name}.*.gz"))
    for p in old[:-KEEP]:
        p.unlink(missing_ok=True)
    audit(who, "logs.rotate", path=str(path), bytes=size, archive=str(dest))
    return {"path": str(path), "bytes": size, "archive": str(dest)}


def rotate_all(who: str = "lacuna") -> list[dict]:
    done = []
    for p in targets():
        try:
            r = rotate(p, who)
            if r:
                done.append(r)
        except Exception as e:
            audit(who, "logs.rotate.failed", path=str(p), error=f"{e.__class__.__name__}: {e}"[:200])
    return done


def own_files():
    cut = time.time() - 30 * 86400
    for p in (LACUNA_HOME / "jobs").glob("*"):
        try:
            if p.stat().st_mtime < cut:
                p.unlink()
        except FileNotFoundError:
            pass
    builds()
    a = LACUNA_HOME / "audit.jsonl"
    if a.exists() and a.stat().st_size > 20e6:
        rotate(a, "lacuna", limit_mb=20)


KEEP_BUILDS = 6


def builds():
    """Archived iPad builds are ~750 MB each: keep the newest six (enough to roll back), remove the rest."""
    d = LACUNA_HOME / "builds"
    from .deploys import pinned_builds
    keep = set(pinned_builds())   # ever installed on her iPad: never pruned by age (L25, 2026-09-25)
    old = [p for p in sorted([p for p in d.glob("*") if p.is_dir()], key=lambda p: p.name)[:-KEEP_BUILDS] if p.name not in keep]
    for p in old:
        shutil.rmtree(p, ignore_errors=True)
        audit("lacuna", "build.pruned", build=p.name)


def sizes() -> list[dict]:
    return [{"path": str(p), "mb": round(p.stat().st_size / 1e6, 1)} for p in targets()]
