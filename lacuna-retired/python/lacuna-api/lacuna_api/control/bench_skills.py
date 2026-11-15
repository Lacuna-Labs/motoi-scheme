"""THE BENCH, v2 — beyond our tools: TRIAGE of our real incidents, SCRIPTING (Python · JavaScript · bash) and
REASONING. His ask, 2026-09-24: "let them run the tests maybe expanded for our use cases and general scripting Python,
js, bash. And intelligence. And can it be tooled for our use."

  · triage     the incident as we lived it → does the answer name the cause (graded on the words that name it)
  · scripting  the code is RUN against test cases — in a macOS sandbox (sandbox-exec: no network, no writes outside
               its own temp folder), with a timeout, so a model's wrong script can never touch the Studio
  · reasoning  short problems with exact answers
The ops/tool section is bench.py (TASKS, graded on the right tool through Lacuna's own jail).
"""
from __future__ import annotations

import json
import os
import re
import shutil
import subprocess
import tempfile
import time
import urllib.request

from .chat import OLLAMA

TRIAGE = [
    ("The iPad logs 12 x `cortex.reingest walk.failed: ebay-244293865011 — Load failed` (TypeError, 55 ms) on every launch. "
     "The page is served from 127.0.0.1 with COOP/COEP (cross-origin isolated). Likely cause, and where would you look?",
     [["cors", "cross-origin", "coep", "isolat", "origin"]]),
    ("The Studio's free disk fell from 44 GB to 15 GB in two days, while we rebuilt the iPad app in the simulator many "
     "times. The app loads a Core ML model at launch. What is filling the disk?", [["core ml", "coreml", "e5rt", "compiled", "cache"]]),
    ("QA's /healthz reports sha 0d2a70aa81, but the `main` branch is at 8c03f3c93c. What does that mean, and what should "
     "happen next?", [["restart", "old code", "stale", "behind", "outdated", "not running"]]),
    ("A reingest walk read the same 12 photographs 633 times in 20 seconds while the app was at rest; the device has no "
     "embedder, so no vector is written. What is the bug?", [["vector", "never", "counted", "done", "loop", "retry", "requeue", "skip"]]),
    ("On the iPad the page went solid white and stayed white until the app was force-quit. There was memory pressure just "
     "before. What happened, and what should the app do?", [["webcontent", "terminat", "killed", "crash", "process"], ["reload"]]),
    ("The live view showed a broken image after switching from one page to another; both pages stream the same camera's "
     "MJPEG from one video socket. What is the likely bug?", [["two", "both", "concurrent", "interleav", "same socket", "reader"]]),
]

SCRIPTING = [
    ("python", "Write a Python function `count_levels(lines)` that takes a list of JSON strings, each with a \"level\" key, "
     "and returns a dict counting each level. Malformed lines are ignored. Reply with one ```python block only.",
     "from solution import count_levels\n"
     "assert count_levels(['{\"level\":\"warn\"}','{\"level\":\"warn\"}','{\"level\":\"error\"}','not json']) == {'warn': 2, 'error': 1}\n"
     "assert count_levels([]) == {}\nprint('ok')"),
    ("python", "Write a Python function `template_of(s)` that replaces every hexadecimal run of 8 or more characters with "
     "`<hex>` and then every remaining run of digits with `<n>`. Reply with one ```python block only.",
     "from solution import template_of\n"
     "assert template_of('ebay-244293865011 failed in 55 ms') == 'ebay-<hex> failed in <n> ms' or template_of('ebay-244293865011 failed in 55 ms') == 'ebay-<n> failed in <n> ms'\n"
     "assert template_of('sha 0d2a70aa81 at port 5050') == 'sha <hex> at port <n>'\nprint('ok')"),
    ("javascript", "Write a JavaScript function `dedupeBySha(items)` that keeps the first item for each `sha` field, in the "
     "original order, and export it with `module.exports = { dedupeBySha }`. Reply with one ```javascript block only.",
     "const { dedupeBySha } = require('./solution.js');\n"
     "const r = dedupeBySha([{sha:'a',n:1},{sha:'b',n:2},{sha:'a',n:3}]);\n"
     "if (JSON.stringify(r) !== JSON.stringify([{sha:'a',n:1},{sha:'b',n:2}])) { console.log('bad', JSON.stringify(r)); process.exit(1) }\nconsole.log('ok')"),
    ("javascript", "Write a JavaScript function `parseRange(header)` that parses an HTTP Range header like `bytes=100-199` "
     "into `{start: 100, end: 199}`; `bytes=500-` gives `{start: 500, end: null}`; anything else returns null. Export it with "
     "`module.exports = { parseRange }`. Reply with one ```javascript block only.",
     "const { parseRange } = require('./solution.js');\nconst eq=(a,b)=>JSON.stringify(a)===JSON.stringify(b);\n"
     "if(!eq(parseRange('bytes=100-199'),{start:100,end:199})||!eq(parseRange('bytes=500-'),{start:500,end:null})||parseRange('items=1-2')!==null){console.log('bad');process.exit(1)}\nconsole.log('ok')"),
    ("bash", "Write a bash script that takes a directory as $1 and prints the NAMES (basename only) of the regular files in it "
     "larger than 1 MB, one per line, largest first. Reply with one ```bash block only.",
     "mkdir -p d && head -c 3000000 /dev/zero > d/big && head -c 2000000 /dev/zero > d/mid && head -c 10 /dev/zero > d/small\n"
     "out=$(bash solution.sh d | tr '\\n' ' ')\n[ \"$out\" = \"big mid \" ] && echo ok || { echo \"bad: $out\"; exit 1; }"),
    ("bash", "Write a bash script that counts, across every *.log file under the directory $1 (recursively), the lines that "
     "contain the word ERROR, and prints just the number. Reply with one ```bash block only.",
     "mkdir -p l/a && printf 'ERROR x\\nok\\nERROR y\\n' > l/one.log && printf 'ERROR z\\n' > l/a/two.log && printf 'ERROR no\\n' > l/a/skip.txt\n"
     "out=$(bash solution.sh l | tr -d ' \\n')\n[ \"$out\" = \"3\" ] && echo ok || { echo \"bad: $out\"; exit 1; }"),
]

REASONING = [
    ("A take stops at 8 equal points around a full circle. How many degrees between stops? Answer with the number only.", ["45"]),
    ("A turntable turns 0.09 seconds per degree. How many seconds for one full turn? Answer with the number only, one decimal.", ["32.4"]),
    ("Alice is older than Bob. Bob is older than Cara. Who is the youngest? One word.", ["cara"]),
    ("What is 17 times 23? Number only.", ["391"]),
    ("A log file rotates when it reaches 50 MB. It starts at 0 and grows 3 MB every hour. After how many whole hours does it first rotate? Number only.", ["17"]),
    ("A shop has 1,284 listings; 5% have no photo. How many listings have no photo? Round to the nearest whole number. Number only.", ["64"]),
]

SANDBOX = """(version 1)
(allow default)
(deny network*)
(deny file-write*)
(allow file-write* (subpath "{tmp}") (subpath "/private{tmp}") (literal "/dev/null") (literal "/dev/zero"))
"""


def plain(model: str, prompt: str, timeout: float = 240, job: str = "code") -> tuple[str, float]:
    """one answer, no tools — for scripting and reasoning"""
    from .chat import profile, NUM_CTX
    prof = profile(model, job)     # each model in its best mode for this job (chat.PROFILES) — the way Lacuna runs it
    body = {"model": model, "messages": [{"role": "system", "content": "Answer concisely and exactly as asked."},
                                         {"role": "user", "content": prompt}],
            "stream": False, "keep_alive": "10m", "think": prof["think"], "options": {"num_ctx": NUM_CTX, **prof["options"]}}
    t0 = time.time()
    req = urllib.request.Request(f"{OLLAMA}/api/chat", data=json.dumps(body).encode(), headers={"Content-Type": "application/json"})
    try:
        with urllib.request.urlopen(req, timeout=timeout) as r:
            msg = json.loads(r.read().decode()).get("message") or {}
        return (msg.get("content") or ""), time.time() - t0
    except Exception as e:
        return f"(no answer: {e.__class__.__name__})", time.time() - t0


def code_block(text: str, lang: str) -> str:
    alias = {"python": "python|py", "javascript": "javascript|js|node", "bash": "bash|sh|shell"}[lang]
    m = re.search(rf"```(?:{alias})\s*\n(.*?)```", text, re.S) or re.search(r"```\w*\s*\n(.*?)```", text, re.S)
    return (m.group(1) if m else text).strip() + "\n"


def run_code(lang: str, code: str, test: str) -> tuple[bool, str]:
    tmp = tempfile.mkdtemp(prefix="lacuna-bench-")
    try:
        name = {"python": "solution.py", "javascript": "solution.js", "bash": "solution.sh"}[lang]
        open(os.path.join(tmp, name), "w").write(code)
        runner = {"python": ["python3", "-I", "test.py"], "javascript": ["node", "test.js"], "bash": ["bash", "test.sh"]}[lang]
        open(os.path.join(tmp, runner[-1]), "w").write(test if lang != "python" else "import sys; sys.path.insert(0, '.')\n" + test)
        prof = os.path.join(tmp, "sb.sb")
        open(prof, "w").write(SANDBOX.replace("{tmp}", tmp))
        p = subprocess.run(["sandbox-exec", "-f", prof, *runner], cwd=tmp, capture_output=True, text=True, timeout=15)
        out = (p.stdout + p.stderr).strip()
        return p.returncode == 0 and out.endswith("ok"), out[-160:]
    except subprocess.TimeoutExpired:
        return False, "timed out"
    finally:
        shutil.rmtree(tmp, ignore_errors=True)


def run(model: str) -> dict:
    from . import chat
    out = {"triage": [], "scripting": [], "reasoning": []}
    for q, groups in TRIAGE:
        t0 = time.time()
        r = chat.ask(q, who="claude", session=f"bench2-{model}-{t0}", model=model, dry=True, job="triage")
        a = (r.get("answer") or "").lower()
        ok = all(any(k in a for k in g) for g in groups)
        out["triage"].append({"q": q[:70], "ok": ok, "s": round(time.time() - t0, 1), "called": [t["tool"] for t in r.get("trace") or []], "answer": a[:300]})
    for lang, prompt, test in SCRIPTING:
        text, s = plain(model, prompt, job="code")
        ok, why = run_code(lang, code_block(text, lang), test)
        out["scripting"].append({"lang": lang, "q": prompt[:60], "ok": ok, "s": round(s, 1), "why": why})
    for q, want in REASONING:
        text, s = plain(model, q, job="reason")
        a = re.sub(r"[^\w.]", " ", text.lower())
        ok = any(re.search(rf"(^|\s){re.escape(w)}(\s|$)", a) for w in want)
        out["reasoning"].append({"q": q[:60], "ok": ok, "s": round(s, 1), "answer": text[:80]})
    return out
