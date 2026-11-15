"""testfix — make one failing Curator test pass with the smallest change (LACUNA-1.3-DESIGN §37 cart 2; the exam's E9).

repair.py's rule, for a test instead of a cart: DETERMINISTIC FIRST, THE MODEL IS THE ESCAPE HATCH. The program makes
the worktree (today's dev), runs the test there inside the jail, and gathers the packet: the test file, the run's own
failure text, the files the failure names, and — when the test is about time — every place the code it reaches reads
the real clock. The model does one thing per round: hand back the FULL new content of each file it changes
(schema-bound JSON). The program writes it with `work put`, runs the test again, and on a failure feeds the run's own
words back (the lesson from repair: always show the model what the runtime said). Up to three rounds. A pass runs the
whole test file, then `work check` (pytest / vitest related, in the jail, recorded outside it), then the merge card.
An unfixed worktree goes back as it was.

  inputs:  test (a test file under ~/code/curator, e.g. "curator-api/tests/test_shop_series_pinned.py") · name (the test
           function or vitest title; optional) · rounds (3) · why (what is wrong, in words; optional)
Never edits a fixture, a snapshot or a pinned expected value to make a test agree (refused here, by path).
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
PY = f"{REPO}/curator-api/.venv/bin/python"
VITEST = f"{REPO}/curator-web/node_modules/.bin/vitest"
SCHEMA = {"type": "object", "required": ["why", "files"], "properties": {
    "why": {"type": "string"},
    "files": {"type": "array", "minItems": 1, "maxItems": 4, "items": {
        "type": "object", "required": ["path", "content"],
        "properties": {"path": {"type": "string"}, "content": {"type": "string"}}}}}}
# reads of the REAL clock that a test's time patch (time.time, a fake timer) does not reach
CLOCK = re.compile(r"datetime\.(?:now|utcnow|today)\(|\bdate\.today\(|time\.(?:gmtime|localtime)\(\s*\)|"
                   r"time\.strftime\(\s*[\"'][^\"']*[\"']\s*\)|new Date\(\s*\)|Date\.now\(\)")
TIMEY = re.compile(r"time\.time|datetime|\bNOW\b|_now\b|freeze|useFakeTimers|setSystemTime|today", re.I)
FAILED_AT = re.compile(r"(?:File \"([^\"]+\.py)\", line \d+|(?:❯|at |\()\s*((?:src|curator-web/src)/[^\s:()]+\.(?:jsx?|tsx?|mjs)):\d+)")


def sh(args, timeout=300, stdin=None, cwd=None, env=None):
    try:
        p = subprocess.run(args, capture_output=True, text=True, timeout=timeout, input=stdin, cwd=cwd, env=env)
        return p.returncode, (p.stdout or "") + (p.stderr or "")
    except subprocess.TimeoutExpired:
        return 124, f"timed out after {timeout} s"
    except OSError as e:
        return 127, f"could not run it: {e}"


# ── the pure parts (tested) ───────────────────────────────────────────────────────────────────────────────────────
def side_of(test: str) -> str | None:
    """api · web · None — where a test lives decides how it runs."""
    if test.startswith("curator-api/") and test.endswith(".py") and os.path.basename(test).startswith("test_"):
        return "api"
    if test.startswith("curator-web/") and re.search(r"\.(test|spec)\.(jsx?|tsx?|mjs)$", test):
        return "web"
    return None


def command(side: str, test: str, name: str | None) -> tuple[list[str], str]:
    """The command and the folder (relative to the worktree) that run one test."""
    if side == "api":
        target = test[len("curator-api/"):] + (f"::{name}" if name else "")
        return [PY, "-m", "pytest", "-q", "-x", "-p", "no:cacheprovider", target], "curator-api"
    target = test[len("curator-web/"):]
    return [VITEST, "run", target, *(["-t", name] if name else [])], "curator-web"


def allowed(path: str) -> str | None:
    """None when the model may write this file; else the refusal in words."""
    p = os.path.normpath(path or "")
    if not p or p.startswith(("/", "..")) or "/../" in f"/{p}/":
        return "a path inside the repo, relative"
    if not (p.startswith("curator-api/") or p.startswith("curator-web/src/")):
        return "only curator-api/ and curator-web/src/ files"
    if re.search(r"(^|/)(fixtures|__snapshots__|snapshots|golden)(/|$)", p) or p.endswith((".json", ".snap", ".jsonl")):
        return "never a fixture, snapshot or pinned value — the code must change, not the expectation"
    if not p.endswith((".py", ".js", ".jsx", ".mjs", ".ts", ".tsx")):
        return "only code files"
    return None


def named_files(output: str, worktree: str) -> list[str]:
    """Repo-relative paths of the worktree's own files that the failure text names (tracebacks, vitest frames)."""
    out = []
    for m in FAILED_AT.finditer(output or ""):
        f = m.group(1) or m.group(2)
        if m.group(1):
            if not f.startswith(worktree + "/") or "/.venv/" in f or "site-packages" in f:
                continue
            rel = f[len(worktree) + 1:]
        else:
            rel = f if f.startswith("curator-web/") else f"curator-web/{f}"
        if rel not in out and os.path.isfile(os.path.join(worktree, rel)):
            out.append(rel)
    return out[:6]


def py_closure(worktree: str, test: str, limit: int = 400) -> list[str]:
    """The curator_api modules a Python test reaches, by a static walk of import lines (packages' __init__ included)."""
    api = os.path.join(worktree, "curator-api")
    seen, todo, out = set(), [test[len("curator-api/"):]], []
    while todo and len(out) < limit:
        rel = todo.pop(0)
        if rel in seen:
            continue
        seen.add(rel)
        try:
            tree = ast.parse(open(os.path.join(api, rel), encoding="utf-8", errors="replace").read())
        except (OSError, SyntaxError):
            continue
        if rel != test[len("curator-api/"):]:
            out.append(f"curator-api/{rel}")
        pkg = os.path.dirname(rel).replace(os.sep, ".")
        names = []
        for n in ast.walk(tree):
            if isinstance(n, ast.Import):
                names += [a.name for a in n.names]
            elif isinstance(n, ast.ImportFrom):
                if n.level:
                    parts = pkg.split(".") if pkg else []
                    parts = parts[: len(parts) - (n.level - 1)] if n.level > 1 else parts
                    mod = ".".join(parts + ([n.module] if n.module else []))
                else:
                    mod = n.module or ""
                names += [mod] + [f"{mod}.{a.name}" for a in n.names if a.name != "*"]
        for d in names:
            if not d.startswith("curator_api"):
                continue
            parts = d.split(".")
            for i in range(1, len(parts) + 1):           # a package's __init__ runs on the way to its module
                base = os.path.join(*parts[:i])
                for cand in (base + ".py", os.path.join(base, "__init__.py")):
                    if os.path.isfile(os.path.join(api, cand)) and cand not in seen:
                        todo.append(cand)
    return out


def clock_reads(worktree: str, files: list[str], cap: int = 30) -> list[str]:
    """`path:line: code` for every real-clock read in these files."""
    out = []
    for rel in files:
        try:
            lines = open(os.path.join(worktree, rel), encoding="utf-8", errors="replace").read().splitlines()
        except OSError:
            continue
        for i, l in enumerate(lines, 1):
            if CLOCK.search(l) and not l.lstrip().startswith(("#", "//", "*")):
                out.append(f"{rel}:{i}: {l.strip()[:160]}")
                if len(out) >= cap:
                    return out
    return out


def tail(output: str, n: int = 6000) -> str:
    return (output or "")[-n:]


# ── the run ─────────────────────────────────────────────────────────────────────────────────────────────────────────
def seat_of(name: str) -> dict:
    box = json.load(open(f"{HOME}/.lacuna/box.json"))
    s = dict(box["seats"].get(name) or box["seats"]["worker"])
    s["name"] = name if name in box["seats"] else "worker"
    return s


def ask(w, seat: dict, system: str, user: str, schema: dict | None = None, cap: int = 14000) -> dict:
    body = {"model": seat["model"], "stream": False, "think": False, "format": schema or SCHEMA,
            "keep_alive": seat.get("keep_alive", "30m"),
            "options": {"num_ctx": int(seat.get("ctx", 65536)), "temperature": 0.2, "num_predict": cap},
            "messages": [{"role": "system", "content": system}, {"role": "user", "content": user}]}
    t0 = time.time()
    req = urllib.request.Request(f"{OLLAMA}/api/chat", data=json.dumps(body).encode(), headers={"Content-Type": "application/json"})
    import lane
    out: dict = {}
    try:
        with lane.background(), urllib.request.urlopen(req, timeout=float(seat.get("round_s", 900))) as r:
            out = json.load(r)
    finally:
        w.spend(brain_seconds=time.time() - t0, tokens_in=int(out.get("prompt_eval_count") or 0),
                tokens_out=int(out.get("eval_count") or 0), seat=seat["name"])
    return json.loads(out["message"]["content"])


def read(worktree: str, rel: str, cap: int = 24000) -> str:
    try:
        return open(os.path.join(worktree, rel), encoding="utf-8", errors="replace").read()[:cap]
    except OSError:
        return ""


def candidates(failure: str, worktree: str, test: str, suspects: list[str], k: int = 12) -> list[str]:
    """The files that may hold the cause: the ones the failure names, then the ones that read the real clock."""
    out = [f for f in named_files(failure, worktree) if f != test]
    for s_ in suspects:
        f = s_.split(":", 1)[0]
        if f not in out and f != test:
            out.append(f)
    return out[:k]


PLUGINS = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "plugins")
SHIFTS = (1, -9, 40)                   # days the real clock is moved for "passes on any date" (a test's own patch still wins)
ENV_NAME = re.compile(r"^[A-Z][A-Z0-9_]{2,40}$")
RESERVED = ("PATH", "HOME", "PYTHON", "LD_", "DYLD_", "NODE", "TESTFIX_", "CI", "SHELL", "TMP", "USER", "VIRTUAL_ENV")


def rerecord_env(raw) -> dict:
    """The owner's switch for re-recording a pinned value (e.g. {"SHOP_SERIES_PIN_WRITE": "1"}): names and short values
    only — it reaches the test's own documented path, never a file the model writes."""
    if not isinstance(raw, dict):
        return {}
    return {str(k): str(v) for k, v in raw.items()
            if ENV_NAME.match(str(k)) and not str(k).startswith(RESERVED) and len(str(v)) <= 20}


def run_test(worktree: str, side: str, test: str, name: str | None, shift: float | None = None,
             extra: dict | None = None) -> tuple[bool, str]:
    cmd, sub = command(side, test, name)
    env = {"PATH": "/opt/homebrew/bin:/usr/bin:/bin:/usr/sbin:/sbin", "HOME": HOME, "CI": "1", **(extra or {})}
    if shift and side == "api":
        env.update({"TESTFIX_SHIFT_DAYS": str(shift), "TESTFIX_ROOT": os.path.join(worktree, sub), "PYTHONPATH": PLUGINS})
        cmd = cmd[:3] + ["-p", "testfix_shiftclock"] + cmd[3:]
    code, out = sh(cmd, timeout=900, cwd=os.path.join(worktree, sub), env=env)
    return code == 0, out


def any_date(worktree: str, side: str, test: str) -> tuple[bool, str]:
    """The whole test file with the real clock moved by each of SHIFTS days: it must pass on every one."""
    if side != "api":
        return True, "(the date check runs for Python tests only)"
    for d in SHIFTS:
        ok, out = run_test(worktree, side, test, None, shift=d)
        if not ok:
            return False, (f"It passes with today's clock but FAILS when the real clock reads {d:+d} days — some code still "
                           f"reads the real date past the test's patched clock:\n{tail(out, 4000)}")
    return True, f"passes with the real clock moved {', '.join(f'{d:+d}' for d in SHIFTS)} days"


def changed_files(worktree: str) -> set[str]:
    _, out = sh(["git", "-C", worktree, "status", "--porcelain"], timeout=300)
    return {l[3:].strip() for l in out.splitlines() if len(l) > 3 and not l[3:].strip().startswith(("curator-web/node_modules", "scratch/"))}


def run(w):
    test = str(w.inputs.get("test") or "").strip().strip("/")
    name = str(w.inputs.get("name") or "").strip() or None
    side = side_of(test)
    if not side or not os.path.isfile(os.path.join(REPO, test)):
        return {"ok": False, "said": f"no test file {test!r} under the curator repo (a curator-api/…/test_*.py or a "
                                     f"curator-web/….test.js)", "outputs": []}
    rounds_max = int(w.inputs.get("rounds", 3))
    w.skills = ["curator-code", "python-house", "curator-suites"]
    task = w.inputs.get("task") or ("t-" + re.sub(r"[^a-z0-9]+", "-", os.path.basename(test).lower())[:26].strip("-")
                                    + "-" + time.strftime("%d%H%M"))
    w.progress(f"making the worktree {task} from today's dev for {test}")
    for _ in range(6):                     # another worker holding the repository's index.lock is a wait, not a failure
        _, out = sh([f"{TOOLS}/box", "work", "new", task, f"why=make_{os.path.basename(test)}_pass"], timeout=1200)
        if "index.lock" not in out and "Another git process" not in out:
            break
        time.sleep(20)
    _, st_out = sh([f"{TOOLS}/box", "work", "status", task], timeout=120)
    try:
        st = json.loads(st_out)
    except ValueError:
        st = {}
    wt = str(st.get("worktree") or "")
    if not st.get("head") or str(st.get("head")).startswith("fatal") or not wt:
        return {"ok": False, "said": f"no usable worktree for {task}: {(out + ' ' + st_out)[-240:]}", "outputs": []}
    sh([f"{TOOLS}/box", "work", "add", task, test], timeout=600)
    reach = py_closure(wt, test) if side == "api" else []
    for rel in sorted({os.path.dirname(r) for r in reach})[:20]:       # the modules it imports (the sparse tree may lack them)
        if rel and not os.path.isdir(os.path.join(wt, rel)):
            sh([f"{TOOLS}/box", "work", "add", task, rel], timeout=600)

    w.progress(f"running {test}{'::' + name if name else ''} in the jail")
    passed, output = run_test(wt, side, test, name)
    if passed:                                           # passing today is not passing on any date
        passed, output = any_date(wt, side, test)
        if passed:
            return {"ok": True, "said": f"{test}{'::' + name if name else ''} already passes on today's dev and {output}; "
                                        "nothing to change", "task": task, "outputs": [], "confidence": 0.8,
                    "anti_taxonomy": ["changed nothing"]}
    before = tail(output, 400)
    test_text = read(wt, test, 30000)
    timey = bool(TIMEY.search(test_text))
    suspects = clock_reads(wt, reach) if timey else []
    w.progress(f"it fails ({len(output)} chars of output); {len(suspects)} real-clock read(s) in the code it reaches")
    seat = seat_of(w.constraints.get("seat") or "worker")
    system = ("You fix one failing test in a Python/JavaScript codebase with the SMALLEST change to the code under test. "
              "Answer JSON: `why` (one sentence: the cause and the fix) and `files` — for each file you change, its repo "
              "path and its FULL new content (every line, the unchanged ones copied exactly). Rules: change the code, never "
              "the test's expected values, fixtures or snapshots; keep every existing test; change as few files as you can "
              "(usually one). When the failure comes from the real date or clock leaking past the test's patched clock, "
              "make the code read the clock the test controls (e.g. time.time() in Python instead of datetime.now()), and "
              "ADD one small test to the test file that proves the result no longer depends on today's date.")
    originals: dict[str, str] = {}
    rerecorded: dict[str, str] = {}
    switch = rerecord_env(w.inputs.get("rerecord"))
    if switch:
        system += (f" The test's pinned value is re-recorded by the program through the test's own switch "
                   f"({', '.join(switch)}) after your change — so never write a fixture; make the code follow the test's "
                   "clock and the pin follows.")
    why, rounds, failure, date_words = "", 0, output, ""
    try:
        for rounds in range(1, rounds_max + 1):
            if w.over():
                break
            cands = candidates(failure, wt, test, suspects)
            parts = [f"The test: {test}" + (f" (the test `{name}`)" if name else ""),
                     (f"What is wrong, in the owner's words: {w.inputs['why']}" if w.inputs.get("why") else ""),
                     f"The run said (its own words, last lines):\n{tail(failure)}"]
            if suspects:
                parts.append("Places the code this test reaches read the REAL clock (a test that patches time.time does "
                             "not reach these):\n" + "\n".join(suspects))
            parts.append(f"The test file now ({test}):\n{test_text}")
            focus = cands[:1]
            if len(cands) > 1:                           # the cheap question first: which file holds the cause
                try:
                    got = ask(w, seat, "You read a failing test and its run. Pick the ONE file whose code causes the "
                              "failure. Answer JSON: file (one of the candidates) and why (one sentence).",
                              "\n\n".join(p for p in parts if p) + "\n\nCandidates:\n" + "\n".join(cands),
                              schema={"type": "object", "required": ["file", "why"], "properties": {
                                  "file": {"type": "string", "enum": cands}, "why": {"type": "string"}}}, cap=400)
                    focus = [got["file"]] if got.get("file") in cands else cands[:1]
                    w.progress(f"round {rounds}: the cause is in {focus[0]} — {str(got.get('why'))[:140]}")
                except (OSError, ValueError, KeyError, TimeoutError) as e:
                    w.progress(f"round {rounds}: the pick did not answer ({type(e).__name__}); showing {cands[0]}")
            for f in focus + [x for x in named_files(failure, wt) if x != test and x not in focus][:1]:
                body = read(wt, f, 30000)
                if body:
                    parts.append(f"The file {f}:\n{body}")
            user = "\n\n".join(p for p in parts if p) + "\n\nReturn the files to change."
            w.progress(f"round {rounds}: asking the {seat['name']} ({seat['model']})")
            try:
                ans = ask(w, seat, system, user)
            except (OSError, ValueError, KeyError, TimeoutError) as e:
                w.progress(f"round {rounds}: no answer — {type(e).__name__}: {str(e)[:120]}")
                failure = f"(your last answer could not be read: {type(e).__name__} — answer with the JSON only)\n" + failure
                continue
            why = str(ans.get("why") or "")[:300]
            refused = [(f.get("path"), allowed(str(f.get("path") or "")) or
                        (None if os.path.isfile(os.path.join(wt, os.path.normpath(str(f.get("path"))))) else
                         "only a file that exists (add a test to the test file, not a new file)"))
                       for f in ans.get("files") or []]
            refused = [(p, r) for p, r in refused if r]
            if refused:
                failure = "Refused before running: " + "; ".join(f"{p}: {r}" for p, r in refused) + "\n\n" + failure
                w.progress(f"round {rounds}: refused {refused[0][0]} — {refused[0][1]}")
                continue
            for f in ans.get("files") or []:
                rel = os.path.normpath(str(f["path"]))
                if rel not in originals:
                    originals[rel] = read(wt, rel, 10 ** 7)
                content = str(f.get("content") or "")
                _, put = sh([f"{TOOLS}/box", "work", "put", task, rel], timeout=120,
                            stdin=content if content.endswith("\n") else content + "\n")
                w.touched.append(rel)
                w.progress(f"round {rounds}: {put.strip()[:160]}")
            if test in originals:
                test_text = read(wt, test, 30000)
            os.makedirs(f"{w.dir}/rounds", exist_ok=True)
            json.dump({"why": why, "files": [f.get("path") for f in ans.get("files") or []]},
                      open(f"{w.dir}/rounds/{rounds:02d}.json", "w"), indent=1)
            passed, failure = run_test(wt, side, test, name)
            if not passed and switch:
                # the pinned value was recorded on another day: re-record it ONCE through the test's own switch, with
                # the new code, then judge it again — the date check below decides whether the new pin is honest
                before_rr = changed_files(wt)
                run_test(wt, side, test, name, extra=switch)
                for f in sorted(changed_files(wt) - before_rr - set(originals)):
                    rerecorded.setdefault(f, "")
                w.progress(f"round {rounds}: re-recorded through {', '.join(switch)}: {', '.join(rerecorded) or 'nothing changed'}")
                passed, failure = run_test(wt, side, test, name)
            if passed and name:                          # the one test passes: the whole file must too
                passed, failure = run_test(wt, side, test, None)
            if passed:
                passed, words = any_date(wt, side, test)
                if not passed:
                    failure = words
                date_words = words
            w.progress(f"round {rounds}: {'passes, on any date' if passed else 'still fails'}")
            if passed:
                break
            sh([f"{TOOLS}/cortex", "lesson", "testfix", f"a round on {os.path.basename(test)} did not pass: {why[:160]}"], timeout=30)
    finally:
        if not passed:                                   # an unfixed worktree goes back as it was: no half-fix left
            for rel, body in originals.items():
                sh([f"{TOOLS}/box", "work", "put", task, rel], timeout=120, stdin=body)
            for rel in rerecorded:                       # a re-recorded pin goes back to the committed one
                code, body = sh(["git", "-C", wt, "show", f"HEAD:{rel}"], timeout=60)
                if code == 0:
                    sh([f"{TOOLS}/box", "work", "put", task, rel], timeout=120, stdin=body)

    if not passed:
        return {"ok": False, "said": f"{test}: still failing after {rounds} round(s) — {tail(failure, 200).strip()}",
                "task": task, "rounds": rounds, "before": before, "outputs": [], "confidence": 0.3,
                "handoff": {"next": "deep", "reason": f"{rounds} rounds on the {seat['name']} did not pass"},
                "anti_taxonomy": ["left the worktree as it was", "did not touch dev"]}
    w.progress("the test passes in the jail — `work check` commits and judges it (recorded outside the jail)")
    _, ck = sh([f"{TOOLS}/box", "work", "check", task], timeout=1800)
    try:
        res = json.loads(ck)
        checked = bool(res.get("passed"))
        words = "; ".join(f"{c['name']} {'ok' if c['ok'] else 'FAILED'}" for c in res.get("checks") or [])
    except ValueError:
        checked, words = False, f"the check did not answer: {ck[-160:]}"
    petitions = []
    if checked:
        _, pm = sh([f"{TOOLS}/box", "work", "propose-merge", task, f"{os.path.basename(test)}_passes_again:_{why[:120]}".replace(" ", "_")], timeout=60)
        m = re.search(r"petition (\w+)\)", pm)
        if m and m.group(1) != "None":
            petitions.append(m.group(1))
    return {"ok": checked, "said": f"{test}: passes after {rounds} round(s) on the {seat['name']} — {why}; {date_words}"
            + (f"; re-recorded {', '.join(rerecorded)} through the test's own switch" if rerecorded else "")
            + f"; work check: {words}"
            + ("; a merge card is on the desk" if petitions else ""),
            "task": task, "branch": f"lacuna-{task}", "rounds": rounds, "before": before, "petitions": petitions,
            "outputs": [{"path": p, "kind": "code"} for p in originals] + [{"path": p, "kind": "pin"} for p in rerecorded],
            "confidence": 0.8 if checked else 0.5,
            "handoff": {"next": "the owner's press" if petitions else "review"},
            "anti_taxonomy": ["changed no fixture or expected value", "did not touch dev"]}
