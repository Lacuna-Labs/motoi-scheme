"""WRITING SLAT UNDER ITS GRAMMAR (2026-10-18) — the brain writes a worker in Lacuna Scheme itself, decoding under
sakura-scheme/grammar/worker.gbnf, so the program reads before anyone runs it.

The brain is llama.cpp behind the gateway (lacuna-box/brain): Ollama's API with our `grammar` field, which llama.cpp
honors token by token (if the brain is ever rolled back to Ollama the field is ignored and the trial still judges).
Its instructions — the SONG — are written from lacuna-foreman/verbs.json, the one description of a worker's verbs: the
verbs, how to build words, and examples that pass their own trial (the foreman's tests prove it). The foreman's trial
then judges the program (it loads; every handler and timer survives a sample); its problems go back for the next try.
"""
from __future__ import annotations

import json
import re
import time
import urllib.request
from pathlib import Path

GATEWAY = "http://127.0.0.1:11434"
GRAMMAR = Path.home() / "code" / "sakura-scheme" / "grammar" / "worker.gbnf"
VERBS = Path.home() / "code" / "lacuna" / "lacuna-foreman" / "verbs.json"
FENCE = re.compile(r"^```[a-z]*\n|\n```$")


CORTEX = Path.home() / "lacuna-world" / "tools" / "cortex"


def _cortex(*args: str) -> str:
    import subprocess
    try:
        return subprocess.run([str(CORTEX), *args], capture_output=True, text=True, timeout=30).stdout.strip()
    except (OSError, subprocess.SubprocessError):
        return ""


def song() -> str:
    """The worker reference, written from verbs.json (kept warm in the brain's prompt cache: the same text every time)."""
    v = json.loads(VERBS.read_text())
    lines = ["You write ONE worker for Lacuna's foreman, in Lacuna Scheme (Sakura Scheme), as program text only — no prose,",
             "no fences. A worker runs on its own, without you: it watches, remembers, reports. Its verbs, all of them:"]
    for x in v["verbs"]:
        if x["tier"] == "watch" and x["name"] not in ("display", "newline", "my-name"):
            extra = f" Metrics: {', '.join(x['metrics'])}." if x.get("metrics") else ""
            lines.append(f"  {x['form']} — {x['does']}{extra}")
    lines += ["Plus Scheme itself: define, lambda, let, let*, if, when, unless, cond, and, or, not, =, <, >, +, -, *, /,",
              "list, car, cdr, cons, length, for-each, map, filter, assq, string-append, number->string, string->number.",
              v["words"], "Examples that pass their trial:"]
    for ex in v["examples"]:
        lines += [f";; {ex['what']}", ex["program"]]
    cart = v.get("cart")
    if cart:                                    # a Lacuna cart (§37.2) is a worker that says what it is first
        lines += ["A LACUNA CART is a worker whose FIRST form is its header (lacuna-cart 'name '(…)):", *[f"  - {r}" for r in cart["rules"]],
                  ";; a cart", cart["example"]]
    learned = _cortex("lessons", "worker-writing")
    if learned and "no lessons" not in learned:
        lines += ["Lessons from your own earlier mistakes (do not repeat them):", learned]
    return "\n".join(lines)


def _seat() -> dict:
    try:
        return json.loads((Path.home() / ".lacuna" / "box.json").read_text())["seats"]["worker"]
    except (OSError, ValueError, KeyError):
        return {"model": "lacuna-worker-lite"}


def write_worker(what: str, trial, tries: int = 3) -> dict:
    """The brain writes a worker for `what` under worker.gbnf; `trial(program)` judges; problems go into the next try."""
    seat, grammar = _seat(), GRAMMAR.read_text()
    notes, t0, program, last = "", time.time(), "", {}
    for n in range(1, tries + 1):
        msgs = [{"role": "system", "content": song()},
                {"role": "user", "content": f";; {what}" + (f"\n;; your last program failed its trial: {notes}\n;; write it again, fixed" if notes else "")}]
        body = {"model": seat["model"], "stream": False, "think": False, "grammar": grammar, "messages": msgs,
                "options": {"num_predict": 900, "temperature": 0.2}}
        req = urllib.request.Request(f"{GATEWAY}/api/chat", data=json.dumps(body).encode(), headers={"Content-Type": "application/json"})
        try:
            with urllib.request.urlopen(req, timeout=180) as r:
                out = json.load(r)
            program = FENCE.sub("", (out.get("message") or {}).get("content", "").strip()).strip()
            if out.get("done_reason") == "length":       # cut off mid-program: the trial would only say "missing )"
                notes = "it ran past the length and was cut off — write it SHORTER, under 20 lines, with sort-by and take"
                continue
        except (OSError, ValueError) as e:
            notes = f"the answer could not be read ({e.__class__.__name__})"
            continue
        last = trial(program) or {}
        if last.get("ok"):
            return {"ok": True, "program": program, "tries": n, "seconds": round(time.time() - t0, 1)}
        notes = " | ".join(last.get("problems") or ["it did not pass"])
        for p in (last.get("problems") or [])[:3]:            # a mistake worth not making twice (B24)
            _cortex("lesson", "worker-writing", str(p)[:300])
    return {"ok": False, "program": program, "problems": last.get("problems") or [notes], "tries": tries,
            "seconds": round(time.time() - t0, 1)}
