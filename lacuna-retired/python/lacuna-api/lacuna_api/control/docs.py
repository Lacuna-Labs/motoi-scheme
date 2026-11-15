"""RUNBOOKS — the manuals Lacuna works from, served to the page (and to the model as its reference)."""
from __future__ import annotations

from pathlib import Path

from .core import REPO

LACUNA = Path(__file__).resolve().parents[3]
DOCS = {
    # the owner's handbook first: "how do I pair again?" is answered from it (handbook.py keeps its slat beside it)
    "handbook": ("Lacuna — the owner's handbook", LACUNA / "docs" / "OWNER-HANDBOOK.md"),
    "sre-manual": ("SRE manual (runbook)", REPO / "SRE_MANUAL.md"),
    "sre": ("SRE — SLOs, alarms, the battery", REPO / "docs" / "eng" / "SRE.md"),
    "monitoring": ("Monitoring spec", REPO / "docs" / "eng" / "MONITORING-SPEC.md"),
    "environments": ("Environments", REPO / "docs" / "eng" / "ENVIRONMENTS.md"),
    "ports": ("Ports", REPO / "docs" / "eng" / "PORTS.md"),
    "env-scripts": ("tools/env — how each server starts", REPO / "tools" / "env" / "README.md"),
    "lacuna": ("Lacuna Beta — the design", REPO / "docs" / "eng" / "LACUNA-BETA-1.0.md"),
    "lacuna-runbook": ("Lacuna — its own runbook", LACUNA / "RUNBOOK.md"),
    "ipad": ("iPad engineering", REPO / "docs" / "eng" / "IPAD-ENGINEERING-1.0.md"),
    "claude": ("Repository law (CLAUDE.md)", REPO / "CLAUDE.md"),
}


def index() -> list[dict]:
    return [{"id": k, "title": t, "path": str(p), "exists": p.exists()} for k, (t, p) in DOCS.items()]


def read(doc_id: str) -> dict:
    t, p = DOCS[doc_id]
    return {"id": doc_id, "title": t, "path": str(p), "text": p.read_text(errors="replace") if p.exists() else ""}


def search(q: str, limit: int = 12) -> list[dict]:
    """Plain search over the manuals — the model's reference and the page's find box."""
    q = q.lower().strip()
    hits = []
    for k, (title, p) in DOCS.items():
        if not p.exists():
            continue
        lines = p.read_text(errors="replace").splitlines()
        for i, ln in enumerate(lines):
            if q and q in ln.lower():
                hits.append({"doc": k, "title": title, "line": i + 1, "text": " ".join(lines[max(0, i - 1): i + 3])[:400]})
                if len(hits) >= limit:
                    return hits
    return hits
