"""CHANGE LISTS (burn-down 1.5 B10; the owner: "change lists the way Google does — TAP"). The commits between QA and dev,
grouped the way a reviewer reads them: inside one working session (a 45-minute quiet ends it), the commits that name
the same thing — the words before the subject's colon ("hello base", "gallery"), else their area; merges together —
are one CL. Each CL says what it touched (areas, files, tests) and its
commits; the whole gap rolls up into the build a promote would carry. Read only.

  GET /api/cicd/cls   {cls: [{id, title, prefix, n, files, tests, areas, first, last, commits: [{sha, t, subject}]}],
                       total, build: {cls, commits, files}}
"""
from __future__ import annotations

from collections import Counter

from fastapi import APIRouter

from .core import QA_TREE, REPO
from .release_board import _area, _git

router = APIRouter()
SESSION_GAP_S = 45 * 60


def _key(c: dict) -> str:
    if c["subject"].startswith("Merge "):
        return "merges"
    head, sep, _ = c["subject"].partition(":")
    if sep and len(head) <= 40:
        return " ".join(head.strip().lower().split()[:2])
    return Counter(_area(f) for f in c["files"]).most_common(1)[0][0] if c["files"] else "other"


def cls(limit: int = 600) -> dict:
    qa = _git(QA_TREE, "rev-parse", "--short", "HEAD")
    if not qa:
        return {"cls": [], "total": 0, "build": {"cls": 0, "commits": 0, "files": 0}, "why": "no QA tree"}
    raw = _git(REPO, "log", "--reverse", "--name-only", "--format=@@%h\t%ct\t%s", f"-{limit}", f"{qa}..dev")
    commits = []
    for block in raw.split("@@")[1:]:
        lines = [x for x in block.splitlines() if x.strip()]
        head = lines[0].split("\t", 2) if lines else []
        if len(head) == 3:
            commits.append({"sha": head[0], "t": int(head[1]), "subject": head[2][:160], "files": lines[1:]})
    # a working SESSION ends at a 45-minute quiet; inside one, commits that name the same thing (the words before the
    # subject's colon, else their area; merges together) are one CL, wherever they fall in the session's order
    out: list[dict] = []
    session: dict[str, dict] = {}
    last_t = None
    for c in commits:                                   # oldest first
        if last_t is not None and c["t"] - last_t > SESSION_GAP_S:
            session = {}
        last_t = c["t"]
        p = _key(c)
        cl = session.get(p)
        if cl is None:
            cl = session[p] = {"prefix": p, "first": c["t"], "last": c["t"], "commits": []}
            out.append(cl)
        cl["commits"].append(c); cl["last"] = c["t"]
    rows = []
    for cl in out:
        files = {f for c in cl["commits"] for f in c["files"]}
        areas = Counter(_area(f) for f in files)
        first = cl["commits"][0]
        rows.append({"id": first["sha"], "prefix": cl["prefix"], "n": len(cl["commits"]),
                     "title": first["subject"] if len(cl["commits"]) == 1 else f"{cl['prefix']} · {len(cl['commits'])} commits · {first['subject'][:60]}",
                     "files": len(files), "tests": sum(1 for f in files if "/tests/" in f or f.startswith("tests/") or ".test." in f),
                     "areas": [a for a, _ in areas.most_common(3)], "first": cl["first"], "last": cl["last"],
                     "commits": [{"sha": c["sha"], "t": c["t"], "subject": c["subject"]} for c in cl["commits"]]})
    rows.sort(key=lambda r: -r["last"])                 # newest CL first
    return {"cls": rows, "total": len(commits),
            "build": {"cls": len(rows), "commits": len(commits), "files": len({f for c in commits for f in c["files"]})}}


@router.get("/api/cicd/cls")
def r_cls() -> dict:
    try:
        return cls()
    except Exception as e:  # noqa: BLE001 — a read never raises
        return {"cls": [], "total": 0, "why": str(e)}
