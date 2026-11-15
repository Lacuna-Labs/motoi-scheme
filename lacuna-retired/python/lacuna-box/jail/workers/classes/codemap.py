"""codemap — what lives where in one package (LACUNA-1.3-DESIGN §37 cart 7, B22; the exam's E7).

docs.py writes a folder's README from what its files say of themselves; a codemap is the same survey taken over the
whole package, every subfolder down, plus a STATIC import scan (who imports whom inside the package — read from the
code's import lines, never by running it). The 26B writes the map's top from the survey: what the package is for, its
areas, its entry points. The program writes the two tables that must be exact: every module with its own one-line
purpose, and the import edges. CODEMAP.md lands beside the package on Lacuna's branch (lacuna-codemap-<pkg>), is
committed and judged through `work check` — the docs gate refuses a map that names a path the tree lacks — and a
passing map files its merge card (the owner's press).

  inputs:  path (a package under ~/code/curator, e.g. "curator-api/curator_api/stores") · max_files (400)
"""
from __future__ import annotations

import ast
import json
import os
import re
import subprocess
import time
import urllib.request

from classes import docs as _docs

HOME = os.path.expanduser("~")
REPO = f"{HOME}/code/curator"
TOOLS = f"{HOME}/lacuna-world/tools"
OLLAMA = "http://127.0.0.1:11434"
SKIP = {"node_modules", "__pycache__", ".git", "dist", "build", "fixtures", "__snapshots__", ".venv"}
JS_EXT = (".js", ".jsx", ".mjs", ".ts", ".tsx")
TICKED = re.compile(r"`([^`\s]+)`")


def sh(args, timeout=300, stdin=None):
    try:
        p = subprocess.run(args, capture_output=True, text=True, timeout=timeout, input=stdin)
        return p.returncode, (p.stdout or "") + (p.stderr or "")
    except subprocess.TimeoutExpired:
        return 124, f"timed out after {timeout} s"


def is_test(name: str) -> bool:
    return name.startswith("test_") or name.endswith("_test.py") or ".test." in name or ".spec." in name or name == "conftest.py"


def import_root(folder: str) -> tuple[str, str]:
    """(the folder Python imports from, the package's dotted name): climb while the parent is a package too."""
    parts, d = [], folder
    while os.path.exists(os.path.join(d, "__init__.py")):
        parts.insert(0, os.path.basename(d))
        d = os.path.dirname(d)
    return d, ".".join(parts)


def survey(folder: str, max_files: int = 400) -> list[dict]:
    """Every code module in the package (tests left out), each with what it says of itself — docs.py's reading, taken
    down every subfolder. `path` is relative to the package folder."""
    rows = []
    for dirpath, dirnames, filenames in os.walk(folder):
        dirnames[:] = sorted(d for d in dirnames if d not in SKIP and not d.startswith(".")
                             and not os.path.islink(os.path.join(dirpath, d)))
        for name in sorted(filenames):
            p = os.path.join(dirpath, name)
            if not name.endswith(_docs.CODE) or is_test(name) or os.path.islink(p):
                continue
            try:
                text = open(p, encoding="utf-8", errors="replace").read()
            except OSError:
                continue
            doc, names = (_docs._py(text) if name.endswith(".py") else _docs._sks(text) if name.endswith(".sks")
                          else _docs._js(text))
            rows.append({"path": os.path.relpath(p, folder), "lines": text.count("\n") + 1,
                         "doc": doc.strip().split("\n")[0][:160] if doc else "",
                         "defines": [n.split(" — ")[0] for n in names[:6]],
                         "main": "__name__ == \"__main__\"" in text or "__name__ == '__main__'" in text,
                         "router": bool(re.search(r"\bAPIRouter\(|\bBlueprint\(|\bexpress\.Router\(", text)),
                         "_text": text})
            if len(rows) >= max_files:
                return rows
    return rows


def _py_targets(rel: str, text: str, pkg: str) -> list[str]:
    """Dotted modules a Python file imports, relative imports resolved against its own package."""
    try:
        tree = ast.parse(text)
    except SyntaxError:
        return []
    sub = os.path.dirname(rel).replace(os.sep, ".")
    here = f"{pkg}.{sub}" if sub else pkg            # the package this file is in (an __init__ is in its own folder's)
    out = []
    for n in ast.walk(tree):
        if isinstance(n, ast.Import):
            out += [a.name for a in n.names]
        elif isinstance(n, ast.ImportFrom):
            if n.level:
                base = here.split(".")
                base = base[: len(base) - (n.level - 1)] if n.level > 1 else base
                mod = ".".join(base + ([n.module] if n.module else []))
            else:
                mod = n.module or ""
            out.append(mod)
            out += [f"{mod}.{a.name}" for a in n.names if a.name != "*"]
    return out


def _py_file(dotted: str, pkg: str, folder: str) -> str | None:
    if dotted != pkg and not dotted.startswith(pkg + "."):
        return None
    rest = dotted[len(pkg):].lstrip(".").replace(".", os.sep)
    for cand in (rest + ".py", os.path.join(rest, "__init__.py")):
        if cand and os.path.isfile(os.path.join(folder, cand)):
            return os.path.normpath(cand)
    return None


def _js_targets(rel: str, text: str, folder: str) -> list[str]:
    out = []
    for spec in re.findall(r"""(?:import\s[^'"]*?from\s*|import\s*\(\s*|require\(\s*|^import\s*)['"](\.{1,2}/[^'"]+)['"]""", text, re.M):
        base = os.path.normpath(os.path.join(os.path.dirname(rel), spec))
        for cand in (base, *[base + e for e in JS_EXT], *[os.path.join(base, "index" + e) for e in JS_EXT]):
            if os.path.isfile(os.path.join(folder, cand)):
                out.append(cand)
                break
    return out


def import_map(folder: str, rows: list[dict]) -> dict[str, list[str]]:
    """module → the modules of THIS package it imports (static: its import lines, never a run)."""
    root, pkg = import_root(folder)
    known = {r["path"] for r in rows}
    edges: dict[str, list[str]] = {}
    for r in rows:
        rel, text = r["path"], r.get("_text") or ""
        if rel.endswith(".py") and pkg:
            hits = [_py_file(t, pkg, folder) for t in _py_targets(rel, text, pkg)]
        elif rel.endswith(JS_EXT):
            hits = _js_targets(rel, text, folder)
        else:
            hits = []
        edges[rel] = sorted({h for h in hits if h and h in known and h != rel})
    return edges


def entry_points(rows: list[dict], edges: dict[str, list[str]]) -> list[str]:
    """Where a reader starts, by evidence: a main, a router, the package's own __init__/index, and the most-imported."""
    by: dict[str, int] = {}
    for ts in edges.values():
        for t in ts:
            by[t] = by.get(t, 0) + 1
    out = [r["path"] for r in rows if r["main"] or r["router"] or r["path"] in ("__init__.py", "index.js", "index.ts")]
    out += [p for p, _ in sorted(by.items(), key=lambda kv: -kv[1])[:6]]
    seen, keep = set(), []
    for p in out:
        if p not in seen:
            seen.add(p)
            keep.append(p)
    return keep[:20]


def packet(rel: str, rows: list[dict], edges: dict[str, list[str]], cap: int = 40000) -> str:
    folders = sorted({os.path.dirname(r["path"]) for r in rows if os.path.dirname(r["path"])})
    lines = [f"Package: {rel} — {len(rows)} modules, {len(folders)} subfolders: {', '.join(f + '/' for f in folders) or 'none'}",
             "Entry-point evidence: " + ", ".join(entry_points(rows, edges)), "", "Modules (path · lines · what it says of itself · defines):"]
    for r in rows:
        lines.append(f"- {r['path']} · {r['lines']} · {r['doc'] or '(says nothing)'} · {', '.join(r['defines'][:4])}")
    text = "\n".join(lines)
    return text[:cap]


def tables(rows: list[dict], edges: dict[str, list[str]]) -> str:
    """The exact half of the map, written by code: every module's own one line, and the import edges."""
    by: dict[str, list[str]] = {}
    for src, ts in edges.items():
        for t in ts:
            by.setdefault(t, []).append(src)
    out = ["## Modules", "", "| module | what it says it does |", "|---|---|"]
    for r in rows:
        out.append(f"| `{r['path']}` | {(r['doc'] or '(its file says nothing about itself)').replace('|', '/')} |")
    out += ["", "## Who imports whom", "",
            "From a static scan of the import lines inside this package (nothing was run). Only modules with an edge are listed.",
            "", "| module | imports (here) | imported by |", "|---|---|---|"]
    for r in rows:
        mine, theirs = edges.get(r["path"]) or [], sorted(by.get(r["path"]) or [])
        if not mine and not theirs:
            continue
        a = ", ".join(mine[:8]) + (f" +{len(mine) - 8}" if len(mine) > 8 else "")
        b = f"{len(theirs)}: " + ", ".join(theirs[:5]) + (" …" if len(theirs) > 5 else "") if theirs else "—"
        out.append(f"| `{r['path']}` | {a or '—'} | {b} |")
    return "\n".join(out) + "\n"


def unknown_paths(text: str, rows: list[dict]) -> list[str]:
    """Backticked names that look like paths but are none of the package's modules or folders — the docs gate's rule,
    checked before the commit so the brain hears it while it can still fix it."""
    have = {r["path"] for r in rows}
    have |= {os.path.dirname(r["path"]) for r in rows if os.path.dirname(r["path"])}
    bad = []
    for m in TICKED.finditer(text):
        name = m.group(1).rstrip("/")
        if "/" not in name and not re.search(r"\.(py|js|jsx|mjs|ts|tsx|sh|sks|md|json)$", name):
            continue
        if "*" in name or "://" in name or name.startswith(("~", "/")):
            continue
        if name not in have and name.lstrip("./") not in have:
            bad.append(name)
    return sorted(set(bad))


def write(w, rel: str, pkt: str, fix: list[str] | None = None) -> str:
    box = json.load(open(f"{HOME}/.lacuna/box.json"))
    seat = box["seats"]["worker"]
    system = ("You write the top of CODEMAP.md for one package of a codebase, in plain American English, from the survey "
              "below (every module, what its own docstring says, what it defines). Write exactly these parts: the title line "
              f"'# Codemap — {rel}'; one paragraph saying what the package is for; '## What lives where' — the package's areas "
              "(its subfolders, and families of modules that share a prefix or a job), each a short paragraph or a bullet "
              "naming its modules in backticks; '## Entry points' — where a reader starts, from the entry-point evidence. "
              "Name a module ONLY by its path exactly as the survey writes it (relative to the package, e.g. `ebay/client.py`), "
              "in backticks. Never invent a module, a folder or a behavior the survey does not state. Do NOT write a table of "
              "every module or of imports — the program appends those. No marketing words.")
    user = pkt + (f"\n\nYour last draft named these as files, and they are not in the package: {', '.join(fix)}. "
                  "Use only paths from the survey." if fix else "")
    ka = seat.get("keep_alive")
    body = {"model": seat["model"], "stream": False, "think": False, "keep_alive": "10m" if ka in (None, "", "24h", "-1", -1) else ka,
            "options": {"num_ctx": int(seat.get("ctx", 65536)), "num_predict": 3000, "temperature": 0.2},
            "messages": [{"role": "system", "content": system}, {"role": "user", "content": user}]}
    t0 = time.time()
    req = urllib.request.Request(f"{OLLAMA}/api/chat", data=json.dumps(body).encode(), headers={"Content-Type": "application/json"})
    import lane
    with lane.background(), urllib.request.urlopen(req, timeout=900) as r:
        out = json.load(r)
    w.spend(brain_seconds=time.time() - t0, tokens_in=int(out.get("prompt_eval_count") or 0),
            tokens_out=int(out.get("eval_count") or 0), seat="worker")
    return (out.get("message") or {}).get("content", "").strip()


def petition_of(out: str) -> str | None:
    m = re.search(r"petition (\w+)\)", out or "")
    return m.group(1) if m and m.group(1) != "None" else None


def run(w):
    rel = str(w.inputs.get("path") or "").strip().strip("/")
    folder = os.path.realpath(os.path.join(REPO, rel))
    if not rel or not folder.startswith(REPO + "/") or not os.path.isdir(folder):
        return {"ok": False, "said": f"no package {rel!r} under the curator repo", "outputs": []}
    w.skills = ["curator-map", "curator-code"]
    w.progress(f"surveying {rel}, every subfolder")
    rows = survey(folder, int(w.inputs.get("max_files", 400)))
    if not rows:
        return {"ok": False, "said": f"{rel} has no code modules to map", "outputs": []}
    edges = import_map(folder, rows)
    n_edges = sum(len(v) for v in edges.values())
    w.progress(f"{len(rows)} modules, {n_edges} import edges — the 26B writes the map's top")
    pkt = packet(rel, rows, edges)
    top, bad = "", None
    for attempt in (1, 2):
        top = write(w, rel, pkt, bad)
        bad = unknown_paths(top, rows)
        if not bad:
            break
        w.progress(f"draft {attempt} named {len(bad)} path(s) that are not in the package: {', '.join(bad[:5])}")
    if len(top) < 200 or "## What lives where" not in top:
        return {"ok": False, "said": f"the map's top came back too thin to keep ({len(top)} chars)", "outputs": []}
    text = (top.rstrip() + "\n\n" + tables(rows, edges) +
            "\n_Written by Lacuna: the top by the 26B from the code's own docstrings; the tables by a static scan. "
            "Review before merging._\n")
    slug = re.sub(r"[^a-z0-9]+", "-", rel.lower()).strip("-")[-30:].strip("-")
    task = f"codemap-{slug}"[:40].strip("-")
    _, out = sh([f"{TOOLS}/box", "work", "new", task, f"why=codemap_of_{slug}"], timeout=1200)
    _, st_out = sh([f"{TOOLS}/box", "work", "status", task], timeout=120)
    try:
        st = json.loads(st_out)
    except ValueError:
        st = {}
    head = str(st.get("head") or "")
    if not head or head.startswith("fatal") or not st.get("worktree"):
        return {"ok": False, "said": f"no usable worktree for {task}: {(out + ' ' + head)[-240:]}", "outputs": []}
    sh([f"{TOOLS}/box", "work", "add", task, rel], timeout=600)
    _, out = sh([f"{TOOLS}/box", "work", "put", task, f"{rel}/CODEMAP.md"], timeout=120, stdin=text)
    if "wrote" not in out:
        return {"ok": False, "said": f"could not write the codemap: {out[-200:]}", "outputs": []}
    _, porcelain = sh(["git", "-C", st["worktree"], "status", "--porcelain"], timeout=120)
    changed = [l[3:].strip() for l in porcelain.splitlines()
               if len(l) > 3 and l[2] == " " and not l[3:].strip().startswith("curator-web/node_modules")]
    only_map = bool(changed) and all(c.endswith("CODEMAP.md") for c in changed)
    gate, petitions = "not checked", []
    if only_map:
        w.progress("committing the map; the docs gate judges every path it names")
        _, ck = sh([f"{TOOLS}/box", "work", "check", task], timeout=600)
        try:
            dg = next(c for c in json.loads(ck)["checks"] if c["name"].startswith("docs gate"))
            gate = "passed" if dg["ok"] else f"refused — names {', '.join(sum(dg['missing'].values(), []))}"
        except (ValueError, KeyError, StopIteration):
            gate = f"did not answer: {ck[-160:]}"
        if gate.startswith("refused"):             # deterministic first: the names the tree lacks go, then one recheck
            from docs import strip_missing
            missing = sum(dg["missing"].values(), [])
            text = strip_missing(text, missing)
            w.progress(f"the gate refused {len(missing)} name(s); removed them and checking again")
            sh([f"{TOOLS}/box", "work", "put", task, f"{rel}/CODEMAP.md"], timeout=120, stdin=text)
            _, ck = sh([f"{TOOLS}/box", "work", "check", task], timeout=600)
            try:
                dg = next(c for c in json.loads(ck)["checks"] if c["name"].startswith("docs gate"))
                gate = ("passed after removing " + ", ".join(missing)) if dg["ok"] else f"refused — names {', '.join(sum(dg['missing'].values(), []))}"
            except (ValueError, KeyError, StopIteration):
                gate = f"did not answer: {ck[-160:]}"
    ok = only_map and gate.startswith("passed")
    if ok:
        _, pm = sh([f"{TOOLS}/box", "work", "propose-merge", task, f"the_codemap_of_{slug}_passed_the_docs_gate"], timeout=60)
        pid = petition_of(pm)
        if pid:
            petitions.append(pid)
        w.progress(pm.strip()[:200])
    return {"ok": ok, "said": f"{rel}/CODEMAP.md on lacuna-{task}: {len(rows)} modules, {n_edges} import edges; docs gate {gate}"
            + ("; a merge card is on the desk" if petitions else "")
            + ("" if only_map else f" — but the diff touches {changed}"),
            "task": task, "branch": f"lacuna-{task}", "petitions": petitions,
            "outputs": [{"path": f"{rel}/CODEMAP.md", "kind": "doc"}], "confidence": 0.7,
            "handoff": {"next": "the owner's press" if petitions else "review"},
            "anti_taxonomy": ["changed no code", "ran nothing it mapped", "invented nothing the survey does not state"]}
