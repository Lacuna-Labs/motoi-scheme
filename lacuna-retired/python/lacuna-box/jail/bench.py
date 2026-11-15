#!/usr/bin/env python3
"""THE BENCH — one brain + the kit, judged by the product's own strict checker (LACUNA-2.0-DESIGN §9, 2026-10-16).

    bench prepare [N]            the intent set: N held-out carts that pass strict today (spread over namespaces);
                                 each intent = the cart's title + summary + useful-when; its body is the gold, never shown
    bench run BRAIN [--n N]      take the GPU lease · for each intent: ask BRAIN for a cart (the sakura-scheme skill +
                                 two passing carts of the same namespace as examples) · paren check · write it into
                                 the bench worktree · ONE strict run over all of them · pass rate, seconds, tokens
    bench report                 every run so far, side by side

Results: ~/lacuna-world/workspace/bench/results/<date>-<brain>.json (+ .md). The intent set is for EVALUATION:
provenance on every row; nothing here trains anything.
Runs outside the jail (it needs the dev tree's checker); the worktree is a workshop task so Lacuna can read it.
"""
from __future__ import annotations

import datetime as dt
import json
import os
import random
import re
import socket
import sys
import time
import urllib.request

HOME = os.path.expanduser("~")
REPO = f"{HOME}/code/curator"
RUNS = f"{REPO}/scratch/honest-count/runs-all-strict1.json"
BENCH = f"{HOME}/lacuna-world/workspace/bench"
SKILL = f"{HOME}/.lacuna/pi-agent/skills/sakura-scheme/SKILL.md"
OLLAMA = "http://127.0.0.1:11434"
LEASE_TOOL = f"{HOME}/lacuna-world/tools/lease"
TASK = "bench"


def broker(line: str, timeout: int = 1200) -> str:
    s = socket.socket(socket.AF_UNIX, socket.SOCK_STREAM)
    s.settimeout(timeout)
    s.connect(f"{HOME}/.lacuna/jail/broker.sock")
    s.sendall(line.encode() + b"\n")
    s.shutdown(socket.SHUT_WR)
    out = b""
    while True:
        c = s.recv(65536)
        if not c:
            break
        out += c
    return out.decode("utf-8", "replace")


def cart_text(slug: str) -> str:
    try:
        with open(f"{REPO}/carts/automations/{slug}/{slug}.sks") as f:
            return f.read()
    except OSError:
        return ""


def header(text: str, key: str) -> str:
    m = re.search(rf"^;;~\s+{key}\s+(.*)$", text, re.M)
    return m.group(1).strip().strip('"') if m else ""


def namespace(text: str) -> str:
    m = re.search(r"\(act\s+'([a-z0-9\-]+)/", text)
    return m.group(1) if m else "doc"


def prepare(n: int = 24) -> None:
    runs = json.load(open(RUNS))
    works = [s for s, v in runs.items() if (v.get("verdict") or {}).get("cls") == "strict:works" and cart_text(s)]
    by_ns: dict[str, list[str]] = {}
    for s in works:
        by_ns.setdefault(namespace(cart_text(s)), []).append(s)
    by_ns = {k: v for k, v in by_ns.items() if len(v) >= 6 and k != "doc"}
    random.seed(20261016)
    per = max(1, n // len(by_ns))
    intents = []
    for ns, slugs in sorted(by_ns.items()):
        random.shuffle(slugs)
        held = slugs[:per]
        pool = [s for s in slugs if s not in held]
        for s in held:
            t = cart_text(s)
            # the two SHORTEST other passing carts of the namespace: examples that fit a small window
            ex = sorted(pool, key=lambda x: len(cart_text(x)))[:2]
            intents.append({"slug": s, "ns": ns, "title": header(t, "title"), "summary": header(t, "summary"),
                            "useful_when": header(t, "useful-when"), "trigger": header(t, "trigger") or "on-demand",
                            "mode": header(t, "mode") or "analysis", "examples": ex, "gold_lines": len(t.splitlines())})
    os.makedirs(BENCH, exist_ok=True)
    json.dump({"made": dt.datetime.now().isoformat(timespec="minutes"), "source": RUNS, "intents": intents},
              open(f"{BENCH}/intents.json", "w"), indent=1)
    print(f"{len(intents)} intents over {len(by_ns)} namespaces → {BENCH}/intents.json")
    for ns in sorted(by_ns):
        print(f"  {ns:<10} {sum(1 for i in intents if i['ns'] == ns)}")


def balanced(text: str) -> tuple[bool, str]:
    depth = 0
    in_str = False
    esc = False
    for ch in re.sub(r";[^\n]*", "", text):
        if in_str:
            if esc: esc = False
            elif ch == "\\": esc = True
            elif ch == '"': in_str = False
            continue
        if ch == '"': in_str = True
        elif ch == "(": depth += 1
        elif ch == ")":
            depth -= 1
            if depth < 0:
                return False, "a ) with no ("
    return depth == 0, "ok" if depth == 0 else f"{depth} ( left open"


def ask(model: str, system: str, user: str, ctx: int, think: bool) -> dict:
    body = {"model": model, "stream": False, "think": think, "keep_alive": "30m",
            "options": {"num_ctx": ctx, "temperature": 0.7, "top_p": 0.8, "num_predict": 4096},
            "messages": [{"role": "system", "content": system}, {"role": "user", "content": user}]}
    req = urllib.request.Request(f"{OLLAMA}/api/chat", data=json.dumps(body).encode(), headers={"Content-Type": "application/json"})
    t0 = time.time()
    with urllib.request.urlopen(req, timeout=1800) as r:
        j = json.load(r)
    return {"text": (j.get("message") or {}).get("content") or "", "seconds": round(time.time() - t0, 1),
            "prompt_tokens": j.get("prompt_eval_count"), "out_tokens": j.get("eval_count"),
            "tok_s": round(j["eval_count"] / (j["eval_duration"] / 1e9), 1) if j.get("eval_duration") else None}


def extract_sks(text: str) -> str:
    m = re.search(r"```(?:scheme|sks|lisp)?\s*\n(.*?)```", text, re.S)
    body = m.group(1) if m else text
    i = body.find(";;~")
    return body[i:].strip() + "\n" if i >= 0 else body.strip() + "\n"


def run(brain: str, n: int | None, ctx: int, think: bool) -> None:
    intents = json.load(open(f"{BENCH}/intents.json"))["intents"]
    if n:
        intents = intents[:n]
    tag = re.sub(r"[^a-z0-9]+", "", brain.lower())[:12]
    print(broker(f"lease wait bench --max 4h --for 3h"))
    try:
        skill = open(SKILL).read()
        # the worktree: one workshop task, reused
        wl = broker("work list")
        if TASK not in wl:
            print(broker(f"work new {TASK} why=the_bench_judges_brains"))
        path = f"{HOME}/lacuna-world/worktrees/{TASK}"
        rows = []
        slugs = []
        for i, it in enumerate(intents, 1):
            slug = f"bench-{tag}-{it['slug']}"[:80]
            examples = "\n\n".join(f"EXAMPLE — a passing cart ({e}):\n{cart_text(e)}" for e in it["examples"])
            system = ("You write Sakura Scheme carts for The Curator. Answer with ONE complete .sks file and nothing else, in a "
                      "```scheme block. Follow the skill and the examples exactly; invent no verbs.\n\n" + skill + "\n\n" + examples)
            user = (f"Write the cart `{slug}`.\n;;~ id must be {slug}; ;;~ author \"lacuna-bench\"; mode {it['mode']}; trigger {it['trigger']}.\n"
                    f"Title: {it['title']}\nWhat it does: {it['summary']}\nUseful when: {it['useful_when']}\n"
                    f"It must render one (table …) and end in (done), with an honest stop when the shop is not connected.")
            try:
                a = ask(brain, system, user, ctx, think)
            except Exception as e:  # noqa: BLE001
                rows.append({"slug": slug, "ns": it["ns"], "gen": "error", "error": str(e)[:200]})
                print(f"{i:>3}/{len(intents)} {slug}: ERROR {e}")
                continue
            sks = extract_sks(a["text"])
            ok, why = balanced(sks)
            d = f"{path}/carts/automations/{slug}"
            os.makedirs(d, exist_ok=True)
            with open(f"{d}/{slug}.sks", "w") as f:
                f.write(sks)
            slugs.append(slug)
            rows.append({"slug": slug, "ns": it["ns"], "gold": it["slug"], "lines": len(sks.splitlines()), "parens": why,
                         **{k: a[k] for k in ("seconds", "prompt_tokens", "out_tokens", "tok_s")}})
            print(f"{i:>3}/{len(intents)} {slug}: {len(sks.splitlines())} lines · parens {why} · {a['seconds']}s · {a['tok_s']} tok/s")
        # one strict run over every generated cart
        for s in slugs:
            broker(f"work add {TASK} {s}")
        print("strict checker over", len(slugs), "carts …")
        verdicts = broker(f"work check {TASK}", timeout=1800)
        try:
            vj = json.loads(verdicts)
        except ValueError:
            vj = {"raw": verdicts[-2000:]}
        by_slug = {}
        for chk in (vj.get("checks") or []):
            for r in chk.get("rows") or []:
                by_slug[r.get("slug")] = r
        for r in rows:
            v = by_slug.get(r["slug"]) or {}
            r["verdict"] = v.get("verdict")
            r["passes"] = bool(v.get("passes"))
            r["detail"] = (v.get("detail") or "")[:160] if isinstance(v.get("detail"), str) else v.get("detail")
        passed = sum(1 for r in rows if r.get("passes"))
        secs = sum(r.get("seconds") or 0 for r in rows)
        out = {"brain": brain, "ctx": ctx, "think": think, "at": dt.datetime.now().isoformat(timespec="minutes"),
               "n": len(rows), "passed": passed, "pass_rate": round(passed / max(1, len(rows)), 3),
               "gen_seconds": round(secs), "carts_per_hour": round(len(rows) / max(secs, 1) * 3600, 1),
               "by_ns": {ns: {"n": sum(1 for r in rows if r["ns"] == ns), "passed": sum(1 for r in rows if r["ns"] == ns and r.get("passes"))}
                         for ns in sorted({r["ns"] for r in rows})},
               "rows": rows, "checker_raw": vj if "raw" in vj else None}
        os.makedirs(f"{BENCH}/results", exist_ok=True)
        stamp = dt.datetime.now().strftime("%Y-%m-%d-%H%M")
        json.dump(out, open(f"{BENCH}/results/{stamp}-{tag}.json", "w"), indent=1)
        print(f"\n{brain}: {passed}/{len(rows)} pass strict ({out['pass_rate']:.0%}) · {out['carts_per_hour']} carts/hour of generation")
        for ns, v in out["by_ns"].items():
            print(f"  {ns:<10} {v['passed']}/{v['n']}")
    finally:
        print(broker("lease release bench"))


def report() -> None:
    files = sorted(f for f in os.listdir(f"{BENCH}/results") if f.endswith(".json")) if os.path.isdir(f"{BENCH}/results") else []
    if not files:
        return print("no runs yet")
    print(f"{'run':<34} {'brain':<22} {'pass':>9} {'carts/h':>8} {'ctx':>6}")
    for f in files:
        j = json.load(open(f"{BENCH}/results/{f}"))
        print(f"{f[:-5]:<34} {j['brain']:<22} {j['passed']:>3}/{j['n']:<3} {j['pass_rate']:>4.0%} {j['carts_per_hour']:>8} {j['ctx']:>6}")


if __name__ == "__main__":
    a = sys.argv[1:]
    if a[:1] == ["prepare"]:
        prepare(int(a[1]) if len(a) > 1 else 24)
    elif a[:1] == ["run"] and len(a) >= 2:
        n = int(a[a.index("--n") + 1]) if "--n" in a else None
        ctx = int(a[a.index("--ctx") + 1]) if "--ctx" in a else 32768
        run(a[1], n, ctx, "--think" in a)
    elif a[:1] == ["report"]:
        report()
    else:
        sys.exit(__doc__)
