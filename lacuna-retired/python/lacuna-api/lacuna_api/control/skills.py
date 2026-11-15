"""SKILLS — Lacuna knows what it can do, and picks what a job needs (LACUNA-1.3-DESIGN §13).

A skill is a folder in ~/.lacuna/pi-agent/skills/<name>/ with a SKILL.md whose front matter names it and says what it
is for. `skills list` reads them all (name · what it carries · its size in tokens · the kinds of work it is for · how
work went when it was loaded); `skills pick` chooses AT MOST THREE for a job — by the job's kind first, then by the
words of the ask against each skill's description — so a window carries what the work needs and nothing else (2026
skills research: curated skills help; a pile of them hurts). A skill a worker loaded is written into the usage ledger,
so the list can say how work went with it.
"""
from __future__ import annotations

import json
import re
import time
from pathlib import Path

SKILLS = Path.home() / ".lacuna" / "pi-agent" / "skills"
USAGE = Path.home() / "lacuna-world" / "ledger" / "usage.jsonl"
# the kinds of work each skill is known for (front matter `for:` wins when a skill declares it)
KINDS = {
    "repair": ["sakura-scheme", "cart-repair", "curator-carts"],
    "code": ["codebase-guide", "curator-code", "python-house", "code-workshop", "curator-suites"],
    "box": ["sre-box", "reliability", "lacuna-foremen", "sre-principles", "mac-house", "curator-watchdogs"],
    "release": ["release-engineering", "curator-release-prep", "deploy", "curator-true-state-battery", "caliper"],
    "talk": ["reliability", "context-discipline", "the-desk"],
    "chat": ["reliability", "context-discipline", "the-desk"],
    "battery": ["curator-true-state-battery", "curator-cart-drill", "curator-sim-and-dev-api", "curator-watchdogs"],
    "fetch": ["errands"],
    "docs": ["curator-map", "curator-code"],
    "codemap": ["curator-map", "curator-code"],
    "testfix": ["curator-code", "python-house", "curator-suites"],
    "disk-steward": ["sre-box", "mac-house"],
    "recall-check": ["lacuna-foremen"],
}


def _front(text: str) -> dict:
    m = re.match(r"^---\s*\n(.*?)\n---", text, re.S)
    out: dict = {}
    if m:
        for line in m.group(1).splitlines():
            if ":" in line:
                k, v = line.split(":", 1)
                out[k.strip()] = v.strip()
    return out


def _record() -> dict:
    """skill → {jobs, ok} from the usage ledger (workers write the skills they loaded and whether the job ended ok)."""
    rec: dict = {}
    try:
        for ln in USAGE.read_text().splitlines():
            r = json.loads(ln)
            for s in r.get("skills") or []:
                x = rec.setdefault(s, {"jobs": 0, "ok": 0, "last": 0})
                x["jobs"] += 1
                x["ok"] += 1 if r.get("ok") else 0
                x["last"] = max(x["last"], r.get("at") or 0)
    except (OSError, ValueError):
        pass
    return rec


def list_skills() -> list[dict]:
    rec = _record()
    out = []
    for d in sorted(SKILLS.iterdir()) if SKILLS.exists() else []:
        f = d / "SKILL.md"
        if not f.exists():
            continue
        text = f.read_text(errors="replace")
        fm = _front(text)
        size = sum(p.stat().st_size for p in d.rglob("*") if p.is_file())
        kinds = [k for k, names in KINDS.items() if d.name in names] or [x.strip() for x in fm.get("for", "").split(",") if x.strip()]
        r = rec.get(d.name) or {}
        out.append({"name": d.name, "what": (fm.get("description") or "")[:220], "tokens": round(size / 4),
                    "for": kinds, "jobs": r.get("jobs", 0),
                    "pass_rate": round(r["ok"] / r["jobs"], 2) if r.get("jobs") else None,
                    "last_used": time.strftime("%Y-%m-%d", time.localtime(r["last"])) if r.get("last") else None})
    return out


def pick(kind: str, ask: str = "", k: int = 3) -> list[str]:
    """At most k skills for a job: its kind's skills first, then the best word-matches of the ask; never more than k."""
    have = {s["name"]: s for s in list_skills()}
    chosen = [n for n in KINDS.get(kind, []) if n in have][:k]
    if len(chosen) < k and ask:
        words = set(re.findall(r"[a-z]{4,}", ask.lower()))
        scored = sorted(((sum(1 for wd in words if wd in (s["what"] + " " + n).lower()), n) for n, s in have.items()
                         if n not in chosen), reverse=True)
        chosen += [n for score, n in scored if score >= 2][: k - len(chosen)]
    return chosen


def words() -> str:
    rows = list_skills()
    lines = [f"I have {len(rows)} skills ({sum(r['tokens'] for r in rows):,} tokens if all were loaded — I load at most three):"]
    for r in rows:
        rate = f" · {r['jobs']} job(s), {int(r['pass_rate'] * 100)}% ok" if r["jobs"] else ""
        lines.append(f"  {r['name']:<28} {r['tokens']:>6} tok  for {', '.join(r['for']) or '—'}{rate}")
    return "\n".join(lines)
