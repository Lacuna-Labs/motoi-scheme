#!/usr/bin/env python3
"""Writes the two maps Lacuna reads to learn the code and the skills (the owner, 2026-10-19: "codebase, skills and playbooks — let it read
those to learn everything"): ~/lacuna-world/playbooks/CODEBASE.md (every module, screen and engineering doc, one line each, from the
files' own docstrings and headings) and SKILLS-INDEX.md (every skill and playbook with what it is for). Re-run after the code changes:
    python3 ~/code/lacuna/lacuna-box/jail/gen_codebase_guide.py
"""
import ast
import re
import time
from pathlib import Path

HOME = Path.home()
LAC, CUR = HOME / "code" / "lacuna", HOME / "code" / "curator"
OUT = HOME / "lacuna-world" / "playbooks"


def doc1(p: Path) -> str:
    try:
        d = ast.get_docstring(ast.parse(p.read_text(errors="replace")))
    except (SyntaxError, OSError):
        d = None
    if not d:
        return ""
    first = " ".join(d.strip().split("\n\n")[0].split())
    return first[:170]


def jsx1(p: Path) -> str:
    try:
        for ln in p.read_text(errors="replace").splitlines()[:12]:
            ln = ln.strip()
            if ln.startswith("//"):
                t = ln.lstrip("/ ").strip()
                if len(t) > 12:
                    return t[:170]
    except OSError:
        pass
    return ""


def heading1(p: Path) -> str:
    try:
        for ln in p.read_text(errors="replace").splitlines()[:30]:
            if ln.startswith("# "):
                return ln[2:].strip()[:150]
    except OSError:
        pass
    return ""


def table(rows, head=("file", "what it is")):
    return "\n".join([f"| {head[0]} | {head[1]} |", "|---|---|"] + [f"| `{a}` | {b.replace('|', '/')} |" for a, b in rows]) + "\n"


def codebase() -> str:
    out = ["# P-CODE · THE CODEBASE — every module, screen and engineering doc, one line each", "",
           f"BLUF: Generated {time.strftime('%Y-%m-%d %H:%M')} from the files' own docstrings and headings by `lacuna-box/jail/gen_codebase_guide.py`. "
           "Find the module that does a thing here, then read it whole with `shell` (`cat`) or `hand op=outline FILE`. Two repos: "
           "`~/code/lacuna` (you) and `~/code/curator` (the customer's app: dev :5051, QA :5050). Change code on your own branch (CODE-SHIP, `box work`).", "",
           "## Lacuna's control API (`~/code/lacuna/lacuna-api/lacuna_api/control/`)",
           table([(p.name, doc1(p)) for p in sorted((LAC / "lacuna-api" / "lacuna_api" / "control").glob("*.py")) if p.name != "__init__.py"]),
           "## Lacuna's desk, the screens (`~/code/lacuna/lacuna-home/src/apps/`)",
           table([(p.name, jsx1(p)) for p in sorted((LAC / "lacuna-home" / "src" / "apps").glob("*.jsx"))]),
           "## The desk's graphics and chat parts (`lacuna-home/src/gl/`)",
           table([(p.name, jsx1(p)) for p in sorted((LAC / "lacuna-home" / "src" / "gl").glob("*.jsx"))]),
           "## The brain, the jail and the box (`~/code/lacuna/lacuna-box/`)",
           table([(str(p.relative_to(LAC / "lacuna-box")), doc1(p)) for p in sorted(list((LAC / "lacuna-box" / "brain").glob("*.py")) + list((LAC / "lacuna-box" / "jail").glob("*.py"))) if not p.name.startswith("test_")]),
           "## Lacuna's own docs (`~/code/lacuna/docs/`)",
           table([(p.name, heading1(p)) for p in sorted((LAC / "docs").glob("*.md"))]),
           "## Curator's engineering docs (`~/code/curator/docs/eng/`) — the whole system's design",
           table([(p.name, heading1(p)) for p in sorted((CUR / "docs" / "eng").glob("*.md"))]),
           "## Curator's API routes and verb backings (`~/code/curator/curator-api/curator_api/routes/`)",
           table([(p.name, doc1(p)) for p in sorted((CUR / "curator-api" / "curator_api" / "routes").glob("*.py"))][:120]),
           "## Curator's Scheme runtime and mock shop (`~/code/curator/curator-web/src/`)",
           table([(str(p.relative_to(CUR / "curator-web" / "src")), jsx1(p)) for p in sorted(list((CUR / "curator-web" / "src" / "scheme").glob("*.js")) + list((CUR / "curator-web" / "src" / "mockShop").glob("*.js")))[:90]]),
           "## Related", "SKILLS-INDEX · UI-GUIDE · CART-REPAIR · CODE-SHIP · METHOD", ""]
    return "\n".join(out)


def skills() -> str:
    rows = []
    for p in sorted((LAC / "lacuna-box" / "pi-agent" / "skills").glob("*/SKILL.md")):
        t = p.read_text(errors="replace")
        m = re.search(r"^description:\s*(.+)$", t, re.M)
        rows.append((f"skill/{p.parent.name}", (m.group(1).strip().strip('"') if m else heading1(p))[:200]))
    books = []
    for p in sorted(OUT.glob("*.md")):
        if p.name in ("README.md", "SKILLS-INDEX.md", "CODEBASE.md"):
            continue
        t = p.read_text(errors="replace")
        m = re.search(r"^BLUF:\s*(.+)$", t, re.M)
        books.append((f"playbook/{p.stem}", (m.group(1).strip() if m else heading1(p))[:200]))
    return "\n".join(["# P-SKILLS · SKILLS AND PLAYBOOKS — what each is for, so you can pick the one that teaches the job", "",
                      f"BLUF: Generated {time.strftime('%Y-%m-%d %H:%M')}. A SKILL (`~/code/lacuna/lacuna-box/pi-agent/skills/<name>/SKILL.md`) is what to KNOW for a kind of work; a PLAYBOOK "
                      "(`~/lacuna-world/playbooks/<NAME>.md`) is HOW to do it, step by step, with what is yours and what waits for the owner. Both are plain files: "
                      "read the whole one with `shell` before a job you have not done; `search_docs` finds the passage. Write your own with `write_doc`. "
                      "Beyond these: CODEBASE (every module) and the engineering docs.", "",
                      "## Skills", table(rows, ("skill", "for")), "## Playbooks", table(books, ("playbook", "what it achieves")), "## Related", "CODEBASE · UI-GUIDE · METHOD", ""])


if __name__ == "__main__":
    (OUT / "CODEBASE.md").write_text(codebase())
    (OUT / "SKILLS-INDEX.md").write_text(skills())
    print("CODEBASE.md", (OUT / "CODEBASE.md").stat().st_size // 1024, "KB;", "SKILLS-INDEX.md", (OUT / "SKILLS-INDEX.md").stat().st_size // 1024, "KB")
