"""review — the seven roles read a diff before it asks for the owner's merge (LACUNA-1.3-DESIGN §5, B13; the roles:
docs/lacuna-engineering.md — Architect, Engineer, Release Lead, SRE, Quality Lead, Security Lead, Product Lead).

Code first, then the brain. The deterministic gates are vetoes no model can talk past:
  Architect  — the diff stays inside what the task said it would touch (its carts' folders, or the folder it documents)
  Quality    — a passing check is on record for the branch's current head
  Security   — no key, token or secret-looking text in the added lines; no file outside the repo
  Release    — the diff is small (≤ 400 changed lines)
Then ONE brain call, schema-bound, where each role signs or vetoes with one sentence. A single veto stops it; all seven
signing files the merge as a contract — a permission card on the desk that shows what will merge, and only the owner's
yes runs the workshop's safe merge (compare-and-swap on dev; refuses a dirty tree).

  inputs: task (a workshop task) · why (what the change is for)
"""
from __future__ import annotations

import json
import os
import re
import subprocess
import time
import urllib.request

HOME = os.path.expanduser("~")
TOOLS = f"{HOME}/lacuna-world/tools"
OLLAMA = "http://127.0.0.1:11434"
ROLES = ["Architect", "Engineer", "Release Lead", "SRE", "Quality Lead", "Security Lead", "Product Lead"]
SECRET = re.compile(r"(sk-[A-Za-z0-9]{16,}|ghp_[A-Za-z0-9]{20,}|AKIA[0-9A-Z]{16}|-----BEGIN [A-Z ]*PRIVATE KEY|"
                    r"(?i:api[_-]?key|secret|password|token)\s*[:=]\s*['\"][^'\"]{12,})")
SCHEMA = {"type": "object", "required": ["roles"], "properties": {"roles": {"type": "array", "minItems": 7, "maxItems": 7, "items": {
    "type": "object", "required": ["role", "verdict", "sentence"],
    "properties": {"role": {"type": "string", "enum": ROLES}, "verdict": {"type": "string", "enum": ["sign", "veto"]},
                   "sentence": {"type": "string"}}}}}}


def sh(args, timeout=300, stdin=None):
    p = subprocess.run(args, capture_output=True, text=True, timeout=timeout, input=stdin)
    return p.returncode, (p.stdout or "") + (p.stderr or "")


def gates(st: dict, diff: str) -> list[str]:
    vetoes = []
    files = re.findall(r"^\+\+\+ b/(\S+)", diff, re.M)
    allowed = [f"carts/automations/{c}/" for c in st.get("carts") or []] + [f"curator-web/src/scheme/carts/"]
    if st.get("carts") and any(not any(f.startswith(a) for a in allowed) for f in files):
        vetoes.append("Architect: the diff touches files outside its carts — " + ", ".join(f for f in files if not any(f.startswith(a) for a in allowed))[:300])
    if not st.get("passed") or st.get("checked_head") != st.get("head"):
        vetoes.append("Quality Lead: no passing check on record for the branch's current head")
    added = "\n".join(l for l in diff.splitlines() if l.startswith("+") and not l.startswith("+++"))
    if SECRET.search(added):
        vetoes.append("Security Lead: an added line looks like a key or secret")
    changed = sum(1 for l in diff.splitlines() if (l.startswith("+") or l.startswith("-")) and not l.startswith(("+++", "---")))
    if changed > 400:
        vetoes.append(f"Release Lead: {changed} changed lines — split it")
    if not files:
        vetoes.append("Release Lead: the diff is empty")
    return vetoes


def brain(w, task: str, why: str, diff: str) -> list[dict]:
    box = json.load(open(f"{HOME}/.lacuna/box.json"))
    seat = box["seats"]["worker"]
    system = ("You are seven reviewers of one change, each with a veto: " + "; ".join(
        f"{r} ({c})" for r, c in zip(ROLES, ["will the design hold — boundaries, naming", "is it built right — the code itself",
                                              "is it small and shippable", "will it stay up — what happens at 3 a.m.",
                                              "is it correct — does the check prove it", "is it safe — secrets, privileges",
                                              "does it solve the right problem"])) +
              ". Each role signs or vetoes with ONE plain sentence about THIS diff. Veto only for a concrete fault you can "
              "point at in the diff; a sign says what you checked. A change that only restores a cart to working, keeping its "
              "verb calls, with the strict check passing, is usually signable.")
    user = f"Task: {task}\nWhat it is for: {why}\n\nThe diff:\n{diff[:14000]}"
    body = {"model": seat["model"], "stream": False, "think": False, "format": SCHEMA,
            "options": {"num_predict": 900, "temperature": 0.2},
            "messages": [{"role": "system", "content": system}, {"role": "user", "content": user}]}
    t0 = time.time()
    req = urllib.request.Request(f"{OLLAMA}/api/chat", data=json.dumps(body).encode(), headers={"Content-Type": "application/json"})
    import lane
    with lane.background(), urllib.request.urlopen(req, timeout=300) as r:
        out = json.load(r)
    w.spend(brain_seconds=time.time() - t0, tokens_in=int(out.get("prompt_eval_count") or 0),
            tokens_out=int(out.get("eval_count") or 0), seat="worker")
    return json.loads(out["message"]["content"]).get("roles") or []


def run(w):
    task = str(w.inputs.get("task") or "").strip()
    why = str(w.inputs.get("why") or w.job.get("brief") or "")[:300]
    _, st_out = sh([f"{TOOLS}/box", "work", "status", task], timeout=120)
    try:
        st = json.loads(st_out)
    except ValueError:
        return {"ok": False, "said": f"no task {task}: {st_out[-160:]}", "outputs": []}
    _, diff = sh([f"{TOOLS}/box", "work", "diff", task], timeout=120)
    w.progress(f"reviewing {task}: the gates")
    vetoes = gates(st, diff)
    roles = []
    if not vetoes:
        w.progress("the seven roles read the diff")
        roles = brain(w, task, why, diff)
        vetoes = [f"{r['role']}: {r['sentence']}" for r in roles if r.get("verdict") == "veto"]
    signed = not vetoes
    if signed:
        # the merge is a contract: a permission card on the desk; the owner's yes runs the workshop's safe merge
        sh([f"{TOOLS}/box", "work", "propose-merge", task, why.replace(" ", "_")[:200]], timeout=60)
    return {"ok": signed, "said": (f"{task}: all seven signed — a merge card is on the desk" if signed
                                   else f"{task}: vetoed — " + " | ".join(vetoes)[:600]),
            "roles": roles, "vetoes": vetoes, "task": task, "outputs": [],
            "handoff": {"next": "the owner's press" if signed else "repair"},
            "anti_taxonomy": ["merged nothing", "changed nothing"]}
