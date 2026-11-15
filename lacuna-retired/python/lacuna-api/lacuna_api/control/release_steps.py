"""THE RELEASE'S OWN STEPS (playbooks/RELEASE.md, P-REL 1.0) — what the release cart reads and does that no other cart does.

  sort()                 A3: every changed path in the curator repo, sorted BY RULE — ours (code · test · doc),
                         generated, scratch — and the paths no rule decides (unsure), for the 26B's judgment, one by one.
                         Each piece of code is paired with the unit tests that name it; the subject line is drafted.
  narrow_cmd(paths)      the unit tests for what changed (vitest / pytest), as one job — before anything is committed
  PRESSED                the steps that need the owner's press EACH TIME, even inside a run he started:
                         check-in (commits to dev) · promote-build (QA, the customer's server) · install-ipad (her iPad)

A rule that sorts a path is code; the 26B is asked only where code cannot decide (CARTS-ARE-THE-WORK §2: the brain only
at judgment points). An unsure path the 26B does not clearly call ours is left out, and named in the report.
"""
from __future__ import annotations

import fnmatch
import re
import subprocess
from pathlib import Path

REPO = Path.home() / "code" / "curator"
PRESSED = ("check-in", "promote-build", "install-ipad", "cut")     # cut: a tag and a staged build (lane C11)

SCRATCH = ("scratch/*", "*/scratch/*", "*.log", "*.tmp", "*.bak", "*.orig", "tmp/*", ".remember/*")
GENERATED = ("*.generated.*", "*.generated", "carts/verb-tag-coverage.json", "*/dist/*", "*.min.js", "*.lock")
SECRET = re.compile(r"(^|/)(\.env[^/]*|secrets?/|.*\.pem$|.*(token|apikey|api_key|password)[^/]*$)", re.I)
CODE = (".js", ".jsx", ".ts", ".tsx", ".py", ".mjs", ".css", ".sks", ".rs", ".swift", ".sh", ".json", ".html")


def _git(*a: str) -> str:
    return subprocess.run(["git", "-C", str(REPO), *a], capture_output=True, text=True, timeout=60).stdout


def changed() -> list[tuple[str, str]]:
    """(status, path) for every change, untracked folders opened to their files"""
    out = []
    for ln in _git("status", "--porcelain", "--untracked-files=all").splitlines():
        if len(ln) > 3:
            out.append((ln[:2].strip() or "M", ln[3:].split(" -> ")[-1].strip('"')))
    return out


def kind_of(path: str) -> str:
    if SECRET.search(path):
        return "secret"
    if any(fnmatch.fnmatch(path, g) for g in SCRATCH):
        return "scratch"
    if any(fnmatch.fnmatch(path, g) for g in GENERATED):
        return "generated"
    name = Path(path).name
    if "/tests/" in f"/{path}" or re.search(r"(\.test|\.spec|_test)\.\w+$|^test_", name):
        return "test"
    if path.startswith("docs/") or path.endswith(".md"):
        return "doc"
    if path.endswith(CODE):
        return "code"
    return "unsure"


def tests_for(path: str, changed_tests: list[str]) -> list[str]:
    stem = Path(path).stem.replace(".generated", "")
    mine = [t for t in changed_tests if stem.lower() in Path(t).name.lower()]
    if mine:
        return mine
    found = [p for p in _git("ls-files", f"*{stem}.test.*", f"*{stem}.spec.*", f"*test_{stem}.py").splitlines() if p][:3]
    return found


def sort() -> dict:
    rows = changed()
    by: dict[str, list] = {"code": [], "test": [], "doc": [], "generated": [], "scratch": [], "secret": [], "unsure": []}
    for st, p in rows:
        by[kind_of(p)].append(p)
    unit = [t for t in by["test"] if not re.search(r"playwright|e2e", t)]
    paired = {p: tests_for(p, by["test"]) for p in by["code"]}
    areas = sorted({p.split("/")[1] if p.startswith(("curator-web/src/", "curator-api/")) and p.count("/") > 1 else p.split("/")[0] for p in by["code"] + by["test"] + by["doc"]})
    ours = by["code"] + by["test"] + by["doc"]
    subject = (f"release: {', '.join(areas[:4])}{' …' if len(areas) > 4 else ''}")[:56] if ours or by["generated"] or by["unsure"] else ""
    return {"branch": _git("branch", "--show-current").strip(), "ours": ours, **by, "tests": paired,
            "unit_tests": sorted({t for ts in paired.values() for t in ts} | set(unit)), "untested": [p for p, ts in paired.items() if not ts and not p.endswith((".css", ".json", ".html"))],
            "subject": subject, "count": len(rows)}


def narrow_cmd(tests: list[str]) -> tuple[str, list] | None:
    web = [t.removeprefix("curator-web/") for t in tests if t.startswith("curator-web/") and re.search(r"\.(test|spec)\.[jt]sx?$", t)]
    py = [t.removeprefix("curator-api/") for t in tests if t.startswith("curator-api/") and t.endswith(".py")]
    parts = []
    if web:
        parts.append(f"cd {REPO}/curator-web && npx vitest run {' '.join(web)}")
    if py:
        parts.append(f"cd {REPO}/curator-api && ./.venv/bin/python -m pytest -q -p no:cacheprovider {' '.join(py)}")
    if not parts:
        return None
    return (f"runs the unit tests for what changed ({len(web) + len(py)} file(s))", ["/bin/bash", "-lc", " && ".join(parts)])
