"""docs — Lacuna writes the README of one folder of the codebase (LACUNA-1.3-DESIGN B23, "the test will be getting the
document writers").

It reads cheaply and from the code's own words: every file's name, size, top docstring or leading comment, and the names
it defines or exports — never whole files (the brain's window stays small and the answer stays true to what the code
says of itself). The brain writes the README from that survey: what the folder is for, a table of its files, the entry
points, how it connects. The README lands on Lacuna's own branch (lacuna-docs-<folder>) in its own worktree; a check
proves nothing but that README changed; the merge is the owner's press.

  inputs:  path (a folder under ~/code/curator, e.g. "curator-api/curator_api/control") · max_files (40)
"""
from __future__ import annotations

import ast
import json
import os
import re
import subprocess
import time
import urllib.request

HOME = os.path.expanduser("~")
REPO = f"{HOME}/code/curator"
TOOLS = f"{HOME}/lacuna-world/tools"
OLLAMA = "http://127.0.0.1:11434"
CODE = (".py", ".js", ".jsx", ".mjs", ".ts", ".tsx", ".sh", ".sks")


def sh(args, timeout=300, stdin=None):
    p = subprocess.run(args, capture_output=True, text=True, timeout=timeout, input=stdin)
    return p.returncode, (p.stdout or "") + (p.stderr or "")


def _py(text: str) -> tuple[str, list[str]]:
    try:
        tree = ast.parse(text)
    except SyntaxError:
        return "", []
    doc = (ast.get_docstring(tree) or "").strip()
    names = []
    for n in tree.body:
        if isinstance(n, (ast.FunctionDef, ast.AsyncFunctionDef, ast.ClassDef)) and not n.name.startswith("_"):
            d = (ast.get_docstring(n) or "").strip().split("\n")[0][:110]
            names.append(f"{n.name}{' — ' + d if d else ''}")
    return doc, names


def _js(text: str) -> tuple[str, list[str]]:
    head = []
    for line in text.splitlines()[:40]:
        s = line.strip()
        if s.startswith("//") or s.startswith("*") or s.startswith("/*"):
            head.append(re.sub(r"^(//+|/\*+|\*+/?)\s?", "", s))
        elif head and s:
            break
    names = re.findall(r"^export\s+(?:default\s+)?(?:async\s+)?(?:function\*?|class|const|let)\s+([A-Za-z0-9_$]+)", text, re.M)
    return "\n".join(head).strip(), names[:20]


def _sks(text: str) -> tuple[str, list[str]]:
    head = [l.lstrip(";").strip() for l in text.splitlines()[:30] if l.strip().startswith(";")]
    return "\n".join(head).strip(), re.findall(r"^\(define \(?([a-z0-9-]+)", text, re.M)[:20]


def survey(folder: str, max_files: int) -> list[dict]:
    rows = []
    for name in sorted(os.listdir(folder)):
        p = os.path.join(folder, name)
        if name.startswith(".") or name in ("node_modules", "__pycache__") or os.path.islink(p):
            continue
        if os.path.isdir(p):
            rows.append({"name": name + "/", "kind": "folder", "files": len(os.listdir(p))})
            continue
        if not name.endswith(CODE) or "test" in name.lower():
            continue
        try:
            text = open(p, encoding="utf-8", errors="replace").read()
        except OSError:
            continue
        doc, names = _py(text) if name.endswith(".py") else _sks(text) if name.endswith(".sks") else _js(text)
        rows.append({"name": name, "lines": text.count("\n") + 1, "doc": doc[:700], "defines": names[:14]})
        if len(rows) >= max_files:
            break
    return rows


def write(w, folder_rel: str, rows: list[dict]) -> str:
    box = json.load(open(f"{HOME}/.lacuna/box.json"))
    seat = box["seats"]["worker"]
    system = ("You write the README.md of one folder of a codebase, in plain American English, from what its files say "
              "about themselves (below). Sections: a one-paragraph summary of what the folder is for; '## Files' — a table "
              "| file | what it does | (one line each, every file listed); '## Entry points' — where a reader should start; "
              "'## How it connects' — what it calls and what calls it, ONLY as far as the survey shows; '## Notes' only if "
              "something is clearly unfinished. Never invent behavior the survey does not state; when a file says little, say "
              "little. No marketing words. End with the line: '_Written by Lacuna from the code's own docstrings; review "
              "before merging._'")
    user = f"Folder: {folder_rel}\n\nSurvey (JSON):\n" + json.dumps(rows, ensure_ascii=False)[:24000]
    body = {"model": seat["model"], "stream": False, "think": False,
            "options": {"num_predict": 2400, "temperature": 0.2},
            "messages": [{"role": "system", "content": system}, {"role": "user", "content": user}]}
    t0 = time.time()
    req = urllib.request.Request(f"{OLLAMA}/api/chat", data=json.dumps(body).encode(), headers={"Content-Type": "application/json"})
    import lane
    with lane.background(), urllib.request.urlopen(req, timeout=600) as r:
        out = json.load(r)
    w.spend(brain_seconds=time.time() - t0, tokens_in=int(out.get("prompt_eval_count") or 0),
            tokens_out=int(out.get("eval_count") or 0), seat="worker")
    return (out.get("message") or {}).get("content", "").strip()


def strip_missing(text: str, missing: list) -> str:
    """The README without the names the tree lacks: a table row or bullet naming one goes; a sentence keeps its words,
    the name marked as not in the tree (no backticks, so it is never read as a real path)."""
    out = []
    for line in text.splitlines():
        hit = [m for m in missing if f"`{m}`" in line]
        if hit and re.match(r"\s*(\||[-*] )", line):
            continue
        for m in hit:
            line = line.replace(f"`{m}`", f"{m} (not in this tree)")
        out.append(line)
    return "\n".join(out) + "\n"


def run(w):
    rel = str(w.inputs.get("path") or "").strip().strip("/")
    folder = os.path.realpath(os.path.join(REPO, rel))
    if not rel or not folder.startswith(REPO + "/") or not os.path.isdir(folder):
        return {"ok": False, "said": f"no folder {rel!r} under the curator repo", "outputs": []}
    w.skills = ["curator-code", "curator-map"]
    w.progress(f"reading {rel}")
    rows = survey(folder, int(w.inputs.get("max_files", 40)))
    if not rows:
        return {"ok": False, "said": f"{rel} has no code files to describe", "outputs": []}
    w.progress(f"{len(rows)} entries surveyed — writing the README")
    text = write(w, rel, rows)
    if len(text) < 200 or "## Files" not in text:
        return {"ok": False, "said": f"the README came back too thin to keep ({len(text)} chars)", "outputs": []}
    slug = re.sub(r"[^a-z0-9]+", "-", rel.lower()).strip("-")[-26:]
    task = f"docs-{slug}"[:40]
    code, out = sh([f"{TOOLS}/box", "work", "new", task, f"why=README_for_{slug}"], timeout=1200)
    _, st_out = sh([f"{TOOLS}/box", "work", "status", task], timeout=120)
    try:
        st = json.loads(st_out)
    except ValueError:
        st = {}
    head = str(st.get("head") or "")
    if not head or head.startswith("fatal") or not st.get("worktree"):
        # "exists" is not enough: a dropped task can leave a bare folder that is no checkout (2026-10-18)
        return {"ok": False, "said": f"no usable worktree for {task}: {(out + ' ' + head)[-240:]}", "outputs": []}
    sh([f"{TOOLS}/box", "work", "add", task, rel], timeout=600)
    code, out = sh([f"{TOOLS}/box", "work", "put", task, f"{rel}/README.md"], timeout=120, stdin=text)
    if "wrote" not in out:
        return {"ok": False, "said": f"could not write the README: {out[-200:]}", "outputs": []}
    # what changed, NEW files included (`git diff` never lists an untracked file — the first run judged itself wrong)
    wt = st["worktree"]
    _, st = sh(["git", "-C", wt, "status", "--porcelain"], timeout=120)
    changed = [l[3:].strip() for l in st.splitlines()
               if len(l) > 3 and l[2] == " " and not l[3:].strip().startswith("curator-web/node_modules")]   # git's own warnings are not files
    only_readme = bool(changed) and all(c.endswith("README.md") for c in changed)
    # committed and judged through the workshop's one door: the docs gate refuses a README that names a file the tree
    # lacks (the first two READMEs sat uncommitted, and named files their stale branch did not have — 2026-10-18)
    gate = "not checked"
    if only_readme:
        w.progress("committing and checking the README")
        _, ck = sh([f"{TOOLS}/box", "work", "check", task], timeout=600)
        try:
            dg = next(c for c in json.loads(ck)["checks"] if c["name"].startswith("docs gate"))
            gate = "passed" if dg["ok"] else f"refused — names {', '.join(sum(dg['missing'].values(), []))}"
        except (ValueError, KeyError, StopIteration):
            gate = f"did not answer: {ck[-160:]}"
        if gate.startswith("refused"):
            # deterministic first (2026-10-18: the 26B named routes/verb_backings.py, which the tree lacks): rows and
            # bullets that name a missing file go; any other mention is marked, never left as a real path; one recheck
            missing = sum(dg["missing"].values(), [])
            text = strip_missing(text, missing)
            w.progress(f"the gate refused {len(missing)} name(s); removed them and checking again")
            sh([f"{TOOLS}/box", "work", "put", task, f"{rel}/README.md"], timeout=120, stdin=text)
            _, ck = sh([f"{TOOLS}/box", "work", "check", task], timeout=600)
            try:
                dg = next(c for c in json.loads(ck)["checks"] if c["name"].startswith("docs gate"))
                gate = ("passed after removing " + ", ".join(missing)) if dg["ok"] else f"refused — names {', '.join(sum(dg['missing'].values(), []))}"
            except (ValueError, KeyError, StopIteration):
                gate = f"did not answer: {ck[-160:]}"
    ok = only_readme and gate.startswith("passed")
    return {"ok": ok, "said": f"{rel}/README.md written on lacuna-{task} ({len(text)} chars, {len(rows)} entries); docs gate {gate}"
            + ("" if only_readme else f" — but the diff touches {changed}"),
            "task": task, "branch": f"lacuna-{task}", "outputs": [{"path": f"{rel}/README.md", "kind": "doc"}],
            "confidence": 0.7, "handoff": {"next": "review"}, "anti_taxonomy": ["changed no code", "invented nothing the survey does not state"]}
