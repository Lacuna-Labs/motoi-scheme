"""THE RELEASE BOARD (the owner, 2026-10-18: "a drag and drop interface here for promoting and releasing … so I could be
like, oh no, I don't want to put that there"). Three lanes, each what is really there now:

  dev    curator's dev branch: its head, and how far it is ahead of main
  QA     the QA tree (~/code/curator-qa): its head and its subject
  iPad   the newest build kept for the iPad: its sha, build number, version, when
Plus the cards already pending for promote or release. A drop on the desk files the card (promote: dev → QA; release:
dev → QA → the iPad); its approval is the owner's press, inline. Read-only here.
"""
from __future__ import annotations

import subprocess
import time

from .core import QA_TREE, REPO


def _git(repo, *args) -> str:
    try:
        return subprocess.run(["git", "-C", str(repo), *args], capture_output=True, text=True, timeout=15).stdout.strip()
    except (OSError, subprocess.TimeoutExpired):
        return ""


def board() -> dict:
    from . import chat, deploys
    dev = {"sha": _git(REPO, "rev-parse", "--short", "dev"), "subject": _git(REPO, "log", "-1", "--format=%s", "dev")[:120],
           "when": _git(REPO, "log", "-1", "--format=%ct", "dev"), "ahead_of_main": _git(REPO, "rev-list", "--count", "main..dev"),
           "recent": [l[:100] for l in _git(REPO, "log", "-8", "--format=%h %s", "dev").splitlines()]}
    qa = {"sha": _git(QA_TREE, "rev-parse", "--short", "HEAD"), "subject": _git(QA_TREE, "log", "-1", "--format=%s")[:120],
          "when": _git(QA_TREE, "log", "-1", "--format=%ct")}
    qa["behind_dev"] = _git(REPO, "rev-list", "--count", f"{qa['sha']}..dev") if qa["sha"] else ""
    kept = deploys.builds()
    ipad = {**(kept[0] if kept else {}), "kept": len(kept)}
    pending = [{"id": p["id"], "action": p["action"], "reason": (p.get("reason") or "")[:120], "t": p.get("t")}
               for p in chat.petitions() if p.get("state") == "waiting" and (p.get("action") in ("promote", "promote-and-build", "release", "deploy-ipad", "check-in", "cart-step")
                   or (p.get("action") == "spawn-cart" and (p.get("args") or {}).get("cart") == "release"))]
    return {"dev": dev, "qa": qa, "ipad": ipad, "pending": pending, "gap": gap(qa["sha"]), "at": time.time()}


def _area(path: str) -> str:
    """where a file lives, in the words of the product: web · shops, api · stores, docs, carts, the iPad …"""
    p = path.split("/")
    if p[0] == "curator-web" and len(p) > 2:
        sub = p[3] if p[2] in ("components", "surface") and len(p) > 4 else p[2]
        return f"web · {sub.split('.')[0]}"
    if p[0] == "curator-api" and len(p) > 2:
        return f"api · {p[2].split('.')[0]}" if p[1] == "curator_api" else f"api · {p[1]}"
    if p[0] in ("docs", "docs-site"):
        return "docs"
    if p[0] in ("curator-ipad", "curator-app"):
        return "the iPad app"
    if p[0] in ("carts", "scheme-carts", "sakura-scheme", "scheme-lang"):
        return "carts & Scheme"
    if p[0] in ("tests", "tools", "scripts"):
        return p[0]
    return p[0]


def gap(qa_sha: str) -> dict:
    """what a promote would carry: the commits between QA and dev, by AREA (where most of each commit's files live),
    each area with its count, its newest and a few subjects — the release's contents at a glance"""
    from collections import Counter
    if not qa_sha:
        return {"areas": [], "total": 0}
    raw = _git(REPO, "log", "--name-only", "--format=@@%h\t%ct\t%s", f"{qa_sha}..dev")
    areas: dict[str, dict] = {}
    total = 0
    for block in raw.split("@@")[1:]:
        lines = [x for x in block.splitlines() if x.strip()]
        if not lines:
            continue
        head = lines[0].split("\t", 2)
        if len(head) < 3:
            continue
        total += 1
        h, t, subj = head
        files = lines[1:]
        area = Counter(_area(f) for f in files).most_common(1)[0][0] if files else ("merges" if subj.startswith("Merge ") else "other")
        a = areas.setdefault(area, {"area": area, "n": 0, "newest": 0, "files": 0, "subjects": []})
        a["n"] += 1
        a["files"] += len(files)
        a["newest"] = max(a["newest"], int(t or 0))
        if len(a["subjects"]) < 4:
            a["subjects"].append(f"{h} {subj[:90]}")
    out = sorted(areas.values(), key=lambda a: -a["n"])
    big = out[:11]
    rest = out[11:]
    if rest:
        big.append({"area": f"{len(rest)} more areas", "n": sum(a["n"] for a in rest), "files": sum(a["files"] for a in rest),
                    "newest": max(a["newest"] for a in rest), "subjects": [x for a in rest[:4] for x in a["subjects"][:1]]})
    return {"areas": big, "total": total}
