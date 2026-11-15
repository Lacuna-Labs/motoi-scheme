"""TELL — say what you expect; Lacuna knows what to do (LACUNA-1.3-DESIGN §0, §18).

    lacuna tell "fix the cart listing-accessibility-alt-text-gap-auditor"
    → the desk reads the sentence into a PLAN (a fixed schema, so a small brain cannot answer with prose where a form
      belongs): what kind of work, its inputs, the skills, the limits — and says back, in plain words, what it will do;
    → the plan becomes a supervised worker (the foreman) under the owner's LIMITS;
    → `lacuna result <id>` reads the worker's taxonomy report; `lacuna usage` adds up what the work spent.

The same door serves Claude (the MCP tool `lacuna_tell`) and the phone. A sentence the desk cannot place is answered
with a question, never a guess. Work outside Lacuna's bounds (QA, production, a release) is refused with the reason —
those are the owner's press.
"""
from __future__ import annotations

import json
import os
import subprocess
import time
import urllib.request
from pathlib import Path

HOME = Path.home()
LIMITS_FILE = HOME / ".lacuna" / "limits.json"
USAGE = HOME / "lacuna-world" / "ledger" / "usage.jsonl"
FOREMAN = HOME / ".lacuna" / "jail" / "workers" / "foreman.py"
JOBS = HOME / "lacuna-world" / "jobs"
OLLAMA = "http://127.0.0.1:11434"

LIMITS = {
    "_": "The owner's limits on Lacuna's work. A card that would pass one is refused or paused with the number. Lacuna "
         "reads this file; it never edits it.",
    "per_card": {"wall_min": 120, "brain_min": 60, "rounds": 5, "claude_calls": 0, "web_pages": 40},
    "per_day": {"brain_hours": 12, "claude_calls": 0, "cards": 60, "web_pages": 400},
    "never": ["QA's server (:5050) or its home", "production (Fly)", "her iPad", "a release or a promote (the owner's press)",
              "main or dev branches (Lacuna works on lacuna/*)", "secrets", "root"],
}

CLASSES = {
    "repair": "fix one cart so the strict checker passes (inputs: slug)",
    "fetch": "look something up on the web and bring back sourced facts (inputs: ask)",
    "echo": "say the brief back (a test of the line)",
    "docs": "write the README of one folder from the code's own words, on its own branch (inputs: path)",
    "codemap": "map a package: what lives where, its entry points, who imports whom — CODEMAP.md through the docs gate "
               "(inputs: path, e.g. curator-api/curator_api/stores)",
    "testfix": "make one failing Curator test pass with the smallest change, then a merge card "
               "(inputs: test — the test file's repo path; name — the test, optional)",
    "disk-steward": "clean up Lacuna's own retired or merged worktrees (never anything else) and list the rest for the owner "
                    "(inputs: dry — true to only list)",
    "recall-check": "prove the cortex gives a worker's report back when asked by meaning (inputs: worker — an id, optional)",
}

PLAN_SCHEMA = {
    "type": "object",
    "properties": {
        "understood": {"type": "boolean"},
        "class": {"type": "string", "enum": list(CLASSES) + ["none"]},
        "inputs": {"type": "object"},
        "say": {"type": "string"},
        "question": {"type": "string"},
    },
    "required": ["understood", "class", "inputs", "say"],
}


def limits() -> dict:
    if not LIMITS_FILE.exists():
        LIMITS_FILE.parent.mkdir(parents=True, exist_ok=True)
        LIMITS_FILE.write_text(json.dumps(LIMITS, indent=2))
    try:
        return json.loads(LIMITS_FILE.read_text())
    except (OSError, ValueError):
        return LIMITS


def usage(day: str | None = None) -> dict:
    """What Lacuna's work spent today (or on `day`, YYYY-MM-DD): per class and seat, minutes, tokens, pages, Claude calls."""
    day = day or time.strftime("%Y-%m-%d")
    out = {"day": day, "workers": 0, "brain_min": 0.0, "tokens_in": 0, "tokens_out": 0, "pages": 0, "claude_calls": 0,
           "by_class": {}, "by_seat": {}}
    try:
        lines = USAGE.read_text().splitlines()
    except OSError:
        lines = []
    for ln in lines:
        try:
            r = json.loads(ln)
        except ValueError:
            continue
        if time.strftime("%Y-%m-%d", time.localtime(r.get("at", 0))) != day:
            continue
        out["workers"] += 1
        bm = (r.get("brain_seconds") or 0) / 60
        out["brain_min"] += bm
        for k in ("tokens_in", "tokens_out", "pages", "claude_calls"):
            out[k] += int(r.get(k) or 0)
        c = out["by_class"].setdefault(r.get("class") or "?", {"workers": 0, "brain_min": 0.0})
        c["workers"] += 1
        c["brain_min"] += bm
        s = out["by_seat"].setdefault(r.get("seat") or "-", {"brain_min": 0.0})
        s["brain_min"] += bm
    out["brain_min"] = round(out["brain_min"], 1)
    lim = limits().get("per_day") or {}
    out["against_limits"] = {"brain_hours": f"{round(out['brain_min'] / 60, 2)} of {lim.get('brain_hours')}",
                             "cards": f"{out['workers']} of {lim.get('cards')}",
                             "web_pages": f"{out['pages']} of {lim.get('web_pages')}",
                             "claude_calls": f"{out['claude_calls']} of {lim.get('claude_calls')}"}
    return out


def _desk() -> dict:
    box = json.load(open(HOME / ".lacuna" / "box.json"))
    return box["seats"]["desk"]


def read_plan(sentence: str) -> dict:
    """The desk reads the sentence into a plan — schema-bound, no thinking, the seat's own context (no reload)."""
    seat = _desk()
    system = ("You are Lacuna, the SRE and resident of this Mac, working with Alfred and Claude at Lacuna Labs. Turn the "
              "person's sentence into a plan. Classes you can start now:\n"
              + "\n".join(f"- {k}: {v}" for k, v in CLASSES.items())
              + "\nIf the sentence names a cart, its slug is the lowercase-dashed name. If you cannot place the sentence in "
                "a class, set understood false, class none, and ask ONE short question in `question`. `say` is one or two "
                "plain sentences to the person: what you will do. Never promise anything outside the class.")
    ka = seat.get("keep_alive")
    body = {"model": seat["model"], "stream": False, "think": False, "format": PLAN_SCHEMA, "keep_alive": "10m" if ka in (None, "", "24h", "-1", -1) else ka,
            "options": {"num_ctx": int(seat.get("ctx", 65536)), "temperature": 0.1, "num_predict": 600},
            "messages": [{"role": "system", "content": system}, {"role": "user", "content": sentence}]}
    req = urllib.request.Request(f"{OLLAMA}/api/chat", data=json.dumps(body).encode(), headers={"Content-Type": "application/json"})
    with urllib.request.urlopen(req, timeout=180) as r:
        return json.loads(json.load(r)["message"]["content"])


def refused(sentence: str) -> str | None:
    s = sentence.lower()
    for words, why in ((("release", "promote", "deploy to qa", "her ipad"), "a release reaches QA and the iPad — that is the owner's press"),
                       (("production", "fly deploy", "prod"), "production is never Lacuna's to touch"),
                       (("rm -rf", "delete the", "wipe", "drop table"), "Lacuna does not destroy; tell me what you want gone and why")):
        if any(w in s for w in words):
            return why
    return None


def tell(sentence: str, who: str = "alfred", start: bool = True) -> dict:
    why = refused(sentence)
    if why:
        return {"ok": False, "say": f"I won't do that: {why}.", "refused": True}
    plan = read_plan(sentence)
    if not plan.get("understood") or plan.get("class") in (None, "none"):
        return {"ok": False, "say": plan.get("question") or plan.get("say") or "What would you like me to do?", "plan": plan}
    lim = limits().get("per_card") or {}
    today = usage()
    if today["workers"] >= int((limits().get("per_day") or {}).get("cards", 60)):
        return {"ok": False, "say": f"I've started {today['workers']} jobs today — that's my limit. It resets tomorrow, or raise it in limits.json."}
    cls, inputs = plan["class"], plan.get("inputs") or {}
    if cls == "repair":
        inputs.setdefault("rounds", min(5, int(lim.get("rounds", 5))))
    out = {"ok": True, "say": plan.get("say"), "plan": plan}
    if start:
        args = ["python3", str(FOREMAN), "spawn", cls, sentence, "--inputs", json.dumps(inputs),
                "--max-wall", f"{int(lim.get('wall_min', 120))}m"]
        p = subprocess.run(args, capture_output=True, text=True, timeout=60)
        wid = (p.stdout or "").strip()
        if p.returncode != 0 or not wid.startswith("w-"):
            return {"ok": False, "say": f"I could not start it: {(p.stderr or p.stdout)[-200:]}", "plan": plan}
        out["id"] = wid
        out["say"] = f"{plan.get('say')} (job {wid} — `lacuna result {wid}`)"
    return out


def result(wid: str) -> dict:
    d = JOBS / wid
    try:
        rep = json.loads((d / "report.json").read_text())
    except (OSError, ValueError):
        rep = None
    try:
        st = json.loads((d / "state.json").read_text())
    except (OSError, ValueError):
        st = {}
    tail = ""
    try:
        tail = "".join((d / "run.log").read_text().splitlines(True)[-6:])
    except OSError:
        pass
    return {"id": wid, "state": st.get("state"), "note": st.get("note"), "report": rep, "log": tail}
