"""THE DISK GUARD — Lacuna as a good resident of the box (the owner, 2026-10-17):

  "a 10% warning. So when we hit 10%, Lacuna is awakened to notify us … that it's stopping whatever downloads it is
   doing … every one of them immediately, even if we told it to do them … coming up with a culprit … and its ability
   to just press enter is all it needs … Not that it judges, we are going to give it a pre-thing list … absolutely
   hard limit. It's not going to decide that. We're going to decide that."

The line moved to 5 % (the owner, 2026-10-18: "We're going to have to make that rule 5%").

At under 5 % free: every download on the box stops (Lacuna's fetch workers and the known download commands), the
owner is told, and a PLAN is written — the files on the owner's list, their total, and the box's biggest eaters as the
likely culprit. `lacuna disk clean` shows the plan and deletes exactly those files after one Enter. Nothing off the
list is ever touched; the list is the owner's file (~/.lacuna/disk-rules.json), seeded once from RULES below.
"""
from __future__ import annotations

import json
import os
import shutil
import signal
import subprocess
import time
from pathlib import Path

HOME = Path.home()
RULES_FILE = HOME / ".lacuna" / "disk-rules.json"
PLAN_FILE = HOME / ".lacuna" / "disk-plan.json"
THRESHOLD = 0.05                                     # under 5 % free (was 10 % until 2026-10-18)

# THE OWNER'S LIST, seeded into RULES_FILE once; after that the file is his and this is only the first copy.
VIDEO = [".mov", ".mp4", ".m4v", ".webm", ".mkv", ".avi"]
RULES = {
    "_": "The owner's list of what may go when the disk is under 5% free. Lacuna deletes these and nothing else, and only "
         "after the owner's Enter. Edit freely; Lacuna never edits this file.",
    "rules": [
        {"what": "everything in the Trash", "where": ["~/.Trash"], "match": "*", "older_than_days": 0},
        {"what": "videos older than a week on the Desktop", "where": ["~/Desktop"], "match": VIDEO, "older_than_days": 7},
        {"what": "videos older than a week in Movies", "where": ["~/Movies"], "match": VIDEO, "older_than_days": 7},
        {"what": "videos older than a week in scratch", "where": ["~/code/curator/scratch", "~/lacuna-world/scratch",
                                                                  "~/lacuna-world/work"], "match": VIDEO, "older_than_days": 7,
         "recursive": True},
        {"what": "half-downloaded model files", "where": ["~/.ollama/models/blobs"], "match": "partial", "older_than_days": 0},
    ],
}
# the downloads that stop at 5 % (command-line words, matched on the process's arguments)
DOWNLOADS = ["ollama pull", "huggingface-cli download", "hf download", "git lfs pull", "wget ", "curl -o", "curl -O",
             "yt-dlp", "aria2c", "brew fetch", "brew install"]


def rules() -> list[dict]:
    if not RULES_FILE.exists():
        RULES_FILE.parent.mkdir(parents=True, exist_ok=True)
        RULES_FILE.write_text(json.dumps(RULES, indent=2))
    try:
        return json.loads(RULES_FILE.read_text()).get("rules") or []
    except (OSError, ValueError):
        return RULES["rules"]


def low(reading: dict | None = None) -> dict:
    """Under 5 % free? From a reading already taken (health.disk(): total and free bytes) or a fresh one."""
    if reading is not None:
        total, free = reading.get("total"), reading.get("free")
        if not total or free is None:                    # a reading without the totals cannot say "under 5 %"
            return {"free_gb": reading.get("free_gb"), "free_pct": None, "low": False}
    else:
        u = shutil.disk_usage("/System/Volumes/Data" if os.path.exists("/System/Volumes/Data") else "/")
        total, free = u.total, u.free
    return {"free_gb": round(free / 1e9, 1), "free_pct": round(100 * free / total, 1), "low": free / total < THRESHOLD}


def _matches(p: Path, match, now: float, days: float) -> bool:
    try:
        st = p.stat()
    except OSError:
        return False
    if days and now - st.st_mtime < days * 86400:
        return False
    if match == "*":
        return True
    if match == "partial":                            # an ollama blob whose name is not a full sha256 is a broken download
        n = p.name
        return n.startswith("sha256-") and len(n) != len("sha256-") + 64
    return p.suffix.lower() in match


def plan() -> dict:
    """The files on the owner's list, now: [{path, gb, rule}] and the total."""
    now, files, blocked = time.time(), [], []
    for r in rules():
        for where in r.get("where") or []:
            root = Path(os.path.expanduser(where))
            if not root.exists():
                continue
            try:
                it = list(root.rglob("*") if r.get("recursive") else root.iterdir())
            except PermissionError:
                # macOS privacy: the Trash (and some folders) need Full Disk Access — said, never guessed around
                blocked.append(f"{where}: Lacuna may not read it (System Settings › Privacy › Full Disk Access)")
                continue
            for p in it:
                try:
                    if p.is_symlink() or (not p.is_file() and r.get("match") != "*"):
                        continue
                    if _matches(p, r.get("match"), now, float(r.get("older_than_days") or 0)):
                        size = p.stat().st_size if p.is_file() else _du(p)
                        files.append({"path": str(p), "gb": round(size / 1e9, 3), "rule": r.get("what")})
                except OSError:
                    continue
    files.sort(key=lambda f: -f["gb"])
    out = {"at": time.time(), "disk": low(), "files": files, "total_gb": round(sum(f["gb"] for f in files), 2), "blocked": blocked}
    try:
        from . import health
        sizes = (health.eaters() or {}).get("sizes") or {}
        if not sizes:                                   # nothing measured yet: measure now (du, a few seconds)
            health._measure_eaters()                     # noqa: SLF001
            sizes = (health.eaters() or {}).get("sizes") or {}
        out["culprits"] = [{"path": k, "gb": round(v / 1e9, 1)} for k, v in sorted(sizes.items(), key=lambda kv: -kv[1])[:6]]
    except Exception:  # noqa: BLE001 — the plan stands without the eaters
        out["culprits"] = []
    PLAN_FILE.write_text(json.dumps(out, indent=1))
    return out


def _du(p: Path) -> int:
    total = 0
    for q in p.rglob("*"):
        try:
            if q.is_file() and not q.is_symlink():
                total += q.stat().st_size
        except OSError:
            pass
    return total


def stop_downloads() -> list[str]:
    """Every download on the box, stopped now — even one the owner asked for (his rule). Returns what was stopped."""
    stopped = []
    try:
        ps = subprocess.run(["ps", "-axo", "pid=,user=,args="], capture_output=True, text=True, timeout=10).stdout
    except (OSError, subprocess.SubprocessError):
        return stopped
    me = os.getpid()
    for line in ps.splitlines():
        parts = line.strip().split(None, 2)
        if len(parts) < 3 or not parts[0].isdigit() or int(parts[0]) == me:
            continue
        args = parts[2]
        if any(w in args for w in DOWNLOADS):
            try:
                os.kill(int(parts[0]), signal.SIGTERM)
                stopped.append(args[:140])
            except OSError:
                pass
    for job in (HOME / "lacuna-world" / "jobs").glob("w-fetch-*/.runner.json"):   # Lacuna's own web workers
        try:
            pid = json.loads(job.read_text()).get("pid")
            if pid:
                os.kill(int(pid), signal.SIGTERM)
                stopped.append(f"fetch worker {job.parent.name}")
        except (OSError, ValueError):
            pass
    return stopped


def clean(confirmed: bool) -> dict:
    """Delete exactly the files in the plan just shown — only with the owner's confirmation."""
    if not confirmed:
        return {"ok": False, "why": "the owner's Enter is the only thing that deletes"}
    p = json.loads(PLAN_FILE.read_text()) if PLAN_FILE.exists() else plan()
    allowed = {f["path"] for f in plan()["files"]}      # re-checked against the list NOW: nothing new slips in
    gone, freed = [], 0.0
    for f in p.get("files") or []:
        if f["path"] not in allowed:
            continue
        path = Path(f["path"])
        try:
            if path.is_dir():
                shutil.rmtree(path)
            else:
                path.unlink()
            gone.append(f["path"])
            freed += f["gb"]
        except OSError:
            continue
    return {"ok": True, "deleted": len(gone), "freed_gb": round(freed, 2), "disk": low()}


def words(p: dict) -> str:
    lines = [f"disk: {p['disk']['free_gb']} GB free ({p['disk']['free_pct']}%)"]
    if p.get("culprits"):
        lines.append("the biggest eaters: " + "; ".join(str(c.get("path") or c.get("name") or c)[:60] + f" {c.get('gb', '')} GB"
                                                       for c in p["culprits"][:4]))
    lines.append(f"on your list: {len(p['files'])} file(s), {p['total_gb']} GB")
    for b in p.get("blocked") or []:
        lines.append(f"  (not read: {b})")
    for f in p["files"][:12]:
        lines.append(f"  {f['gb']:>7} GB  {f['path']}   ({f['rule']})")
    if len(p["files"]) > 12:
        lines.append(f"  … and {len(p['files']) - 12} more")
    return "\n".join(lines)
