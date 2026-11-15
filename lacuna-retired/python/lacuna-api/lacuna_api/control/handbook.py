"""THE HANDBOOK — the owner's "search it when I forget" document (docs/OWNER-HANDBOOK.md), on the desk and as data.

  parse(md)    [{id, n, title, level, lines:[str], steps:[{text, done}], rows:[[cell…]]}] — one per heading
  to_slat(md)  the handbook as slat (one form per line, the way every artifact here is): (handbook …) once, then a
               (section …) per heading, a (step …) per list item (with :done for a checklist box), a (row …) per
               table row, a (text …) per paragraph line — so Lacuna reads it as data and Chat answers from it
  ensure()     writes ~/lacuna-world/HANDBOOK.slat when the .md is newer (or the slat is missing); returns its path
GET /api/handbook and /api/handbook/find are the door's (lacuna-node/frontend/handbook.mjs, 2026-11-06, finale §3.12); these
functions stay for the home, which keeps the slat fresh.
"""
from __future__ import annotations

import os
import re
from pathlib import Path

LACUNA = Path(__file__).resolve().parents[3]


def md_path() -> Path:
    return Path(os.environ.get("LACUNA_HANDBOOK") or LACUNA / "docs" / "OWNER-HANDBOOK.md")


def slat_path() -> Path:
    return Path(os.environ.get("LACUNA_HANDBOOK_SLAT") or Path.home() / "lacuna-world" / "HANDBOOK.slat")


_H = re.compile(r"^(#{1,6})\s+(.*)$")
_LI = re.compile(r"^\s*(?:[-*]|\d+\.)\s+(?:\[( |x|X)\]\s+)?(.*)$")
_SEP = re.compile(r"^\|?\s*:?-{2,}")


def _slug(t: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", t.lower()).strip("-")[:48] or "section"


def parse(md: str) -> list[dict]:
    secs: list[dict] = []
    cur = {"id": "top", "n": None, "title": "", "level": 0, "lines": [], "steps": [], "rows": []}
    for raw in md.splitlines():
        m = _H.match(raw)
        if m:
            secs.append(cur)
            title = m.group(2).strip()
            num = re.match(r"^(\d+(?:\.\d+)*)\.?\s", title)
            cur = {"id": _slug(title), "n": num.group(1) if num else None, "title": title, "level": len(m.group(1)),
                   "lines": [], "steps": [], "rows": []}
            continue
        if raw.strip() in ("", "---"):
            continue
        cur["lines"].append(raw)
        if raw.lstrip().startswith("|"):
            if not _SEP.match(raw.strip().lstrip("|").strip()) and not re.fullmatch(r"\|[\s|:-]*\|?", raw.strip()):
                cur["rows"].append([c.strip() for c in raw.strip().strip("|").split("|")])
            continue
        li = _LI.match(raw)
        if li:
            cur["steps"].append({"text": li.group(2).strip(), "done": None if li.group(1) is None else li.group(1).lower() == "x"})
        elif raw.startswith("      ") and cur["steps"]:          # a list item's wrapped line
            cur["steps"][-1]["text"] += " " + raw.strip()
    secs.append(cur)
    return [s for s in secs if s["title"] or s["lines"]]


def _q(s) -> str:
    return '"' + str(s).replace("\\", "\\\\").replace('"', '\\"') + '"'


def to_slat(md: str, source: str = "") -> str:
    secs = parse(md)
    title = next((s["title"] for s in secs if s["level"] == 1), "handbook")
    out = [f"(handbook :title {_q(title)} :source {_q(source)} :sections ({' '.join(_q(s['id']) for s in secs if s['level'] >= 2)}))"]
    for s in secs:
        if s["level"] < 2:
            continue
        num = f" :n {_q(s['n'])}" if s["n"] else ""
        out.append(f"(section :id {_q(s['id'])}{num} :title {_q(s['title'])} :level {s['level']})")
        for st in s["steps"]:
            done = "" if st["done"] is None else f" :done {'true' if st['done'] else 'false'}"
            out.append(f"(step :in {_q(s['id'])} :text {_q(st['text'])}{done})")
        for r in s["rows"]:
            out.append(f"(row :in {_q(s['id'])} :cells ({' '.join(_q(c) for c in r)}))")
        for ln in s["lines"]:
            if not ln.lstrip().startswith("|") and not _LI.match(ln) and not ln.startswith("      "):
                out.append(f"(text :in {_q(s['id'])} :line {_q(ln.strip())})")
    return "\n".join(out) + "\n"


def ensure() -> Path | None:
    src, dst = md_path(), slat_path()
    try:
        if not src.exists():
            return None
        if not dst.exists() or dst.stat().st_mtime < src.stat().st_mtime:
            dst.parent.mkdir(parents=True, exist_ok=True)
            tmp = dst.with_suffix(".slat.tmp")
            tmp.write_text(to_slat(src.read_text(errors="replace"), str(src)))
            tmp.replace(dst)
        return dst
    except OSError:
        return None

