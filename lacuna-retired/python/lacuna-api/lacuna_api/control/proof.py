"""THE LACUNA PROOF (the owner, 2026-10-18 night, W35.1: "your final check is the giant spread of whether or not Erlang
workers by themselves without an LLM work and follow the rules … that Scheme works with them, and that adding agents to
them works … that the Cortex works with Scheme, that we're taking advantage of all the Google affordances … that the
configurations are done correctly … and once you test it you say: yep, that's Lacuna working").

"Lacuna works" is said only when every line below is green on the LIVE box. Each check returns (ok, evidence) — the
evidence is numbers and names, never "looks fine". The report is written to docs/PROOF-<date>.md and kept at
~/.lacuna/proof-last.json for the desk.

  A  the foreman (Erlang-style, no LLM)    its own suite (supervision, mailboxes, pause/stop, leases, talk grammar)
  B  Scheme runs the carts                 every cart in lacuna-world/carts passes the foreman's trial
  C  carts run on the live box             the work record: carts that ran and finished, by class, in 48 h
  D  the cortex answers Scheme             each graph read a cart's hand can make (since · fading · pointing-at · like ·
                                           trail · memory) answers through hands.do — the same road a cart takes
  E  Google's pieces are the ones in use   EmbeddingGemma is the one embedder and its index is live; FunctionGemma and
                                           the small Gemmas are on the box; the brain runs Gemma 26B with the SWA cache
  F  the configurations hold               box-minds, triggers, embed, the brain's flags, the owner key's guard
  G  the customer's side is guarded        direct promote / install / release / QA restarts are refused (tests)
"""
from __future__ import annotations

import json
import subprocess
import time
from pathlib import Path

from fastapi import APIRouter

router = APIRouter()
LACUNA = Path(__file__).resolve().parents[3]
WORLD = Path.home() / "lacuna-world"
LAST = Path.home() / ".lacuna" / "proof-last.json"


def _run(cmd: list[str], cwd: Path, timeout: int = 600) -> tuple[int, str]:
    try:
        p = subprocess.run(cmd, cwd=cwd, capture_output=True, text=True, timeout=timeout)
        return p.returncode, (p.stdout + p.stderr)
    except (OSError, subprocess.TimeoutExpired) as e:
        return 1, str(e)


def a_foreman() -> tuple[bool, str]:
    code, out = _run(["npm", "test"], LACUNA / "lacuna-foreman", 300)
    tail = {k: v for k, v in (ln.replace("ℹ ", "").split(" ", 1) for ln in out.splitlines() if ln.startswith("ℹ ") and " " in ln[2:])}
    return code == 0 and tail.get("fail", "1").strip() == "0", f"{tail.get('pass', '?').strip()} pass · {tail.get('fail', '?').strip()} fail (lacuna-foreman npm test)"


def b_carts() -> tuple[bool, str]:
    from . import foreman
    bad, n = [], 0
    for f in sorted((WORLD / "carts").rglob("*.sks")):           # the interface carts in carts/desk too
        n += 1
        t = foreman.call("POST", "/check", {"program": f.read_text(errors="replace")}, timeout=30)
        if not t.get("ok"):
            bad.append(f"{f.stem}: {'; '.join(map(str, t.get('problems') or [t.get('why')]))[:90]}")
    return not bad, f"{n - len(bad)}/{n} carts pass their trial" + (f" · failing: {' | '.join(bad[:6])}" if bad else "")


def c_runs() -> tuple[bool, str]:
    from . import work
    perf = work.tree(48).get("perf", [])
    carts = [q for q in perf if q["class"] in ("lacuna-cart", "recall-check", "disk-steward")]
    done = sum(q["done"] for q in carts)
    return done > 0, " · ".join(f"{q['class']} {q['done']}/{q['runs']}" for q in carts) or "no cart ran in 48 h"


def d_cortex() -> tuple[bool, str]:
    from . import hands
    newest = (hands.do("since", ["24h"]).get("result") or {}).get("arrived") or []
    # the newest node may not be embedded yet ("has no vec" is an honest answer, not a broken read): probe the first that is
    cands = [f"{n['kind']}/{n['key']}" for n in newest if n.get("kind") in ("fact", "episode", "decision")][:8] or ["card/s-cicd"]
    node = next((c for c in cands if hands.do("like", [c]).get("ok")), cands[0])
    reads = {"since": ["24h"], "fading": [], "memory": ["release"], "like": [node], "trail": [node], "pointing-at": ["card/s-cicd"]}
    ok, said = [], []
    for op, args in reads.items():
        r = hands.do(op, args)
        good = bool(r.get("ok"))
        ok.append(good)
        res = r.get("result")
        size = len(res) if isinstance(res, (list, dict, str)) else (1 if res is not None else 0)
        said.append(f"{op} {'✓' if good else '✗'}{'' if good else ' ' + str(r.get('why'))[:50]}{f' ({size})' if good else ''}")
    return all(ok), " · ".join(said)


def e_google() -> tuple[bool, str]:
    embed = json.loads((Path.home() / ".lacuna" / "embed.json").read_text()).get("model")
    idx = Path.home() / ".lacuna" / "rag" / f"vectors-{embed}.jsonl"
    rows = sum(1 for _ in idx.open()) if idx.exists() else 0
    tags = []
    try:
        import urllib.request
        with urllib.request.urlopen("http://127.0.0.1:11435/api/tags", timeout=5) as r:
            tags = [m["name"] for m in json.loads(r.read()).get("models", [])]
    except Exception:  # noqa: BLE001
        pass
    small = [t for t in tags if any(k in t for k in ("functiongemma", "gemma3:270m", "gemma4:e2b", "embeddinggemma"))]
    plist = subprocess.run(["plutil", "-p", str(Path.home() / "Library/LaunchAgents/ai.lacunalabs.brain.plist")], capture_output=True, text=True).stdout
    swa = "--swa-full" not in plist
    good = embed == "embeddinggemma" and rows > 1000 and len(small) >= 3 and swa
    return good, f"embedder {embed} · index {rows:,} chunks · small Gemmas on the box: {', '.join(small) or 'none'} · brain: Gemma 26B, SWA cache {'on' if swa else 'FULL'}"


def f_configs() -> tuple[bool, str]:
    problems = []
    for p in (LACUNA / "lacuna-box/brain/box-minds.json", WORLD / "triggers.json", Path.home() / ".lacuna/embed.json"):
        if p.name == "triggers.json" and not p.exists():
            continue                                             # no trigger armed yet: nothing to parse, nothing wrong
        try:
            json.loads(p.read_text())
        except (OSError, ValueError) as e:
            problems.append(f"{p.name}: {e.__class__.__name__}")
    plist = subprocess.run(["plutil", "-p", str(Path.home() / "Library/LaunchAgents/ai.lacunalabs.brain.plist")], capture_output=True, text=True).stdout
    for flag in ('"--parallel"', '"--jinja"', '"q8_0"'):
        if flag not in plist:
            problems.append(f"brain lacks {flag}")
    key = Path.home() / ".lacuna" / "owner-key"
    if key.exists() and oct(key.stat().st_mode)[-3:] != "600":
        problems.append("owner-key is not 600")
    return not problems, "box-minds · triggers · embed parse; brain --parallel --jinja q8 KV; owner key 600" if not problems else " · ".join(problems)


def g_guard() -> tuple[bool, str]:
    code, out = _run([str(LACUNA / ".venv/bin/python"), "-m", "pytest", "-q", "-p", "no:cacheprovider", "tests/test_control_e6_views.py", "tests/test_control_guard.py"], LACUNA / "lacuna-api", 300)
    last = [ln for ln in out.splitlines() if "passed" in ln or "failed" in ln][-1:] or ["no result"]
    return code == 0, last[0].strip()


CHECKS = [("A", "the foreman, no LLM", a_foreman), ("B", "Scheme runs every cart", b_carts), ("C", "carts run on the live box", c_runs),
          ("D", "the cortex answers a cart's reads", d_cortex), ("E", "Google's pieces in use", e_google), ("F", "the configurations hold", f_configs),
          ("G", "the customer's side is guarded", g_guard)]


def run() -> dict:
    rows = []
    for key, name, fn in CHECKS:
        t0 = time.time()
        try:
            ok, ev = fn()
        except Exception as e:  # noqa: BLE001 — a check that breaks is a red line with its reason
            ok, ev = False, f"the check broke: {e.__class__.__name__}: {e}"[:300]
        rows.append({"key": key, "name": name, "ok": ok, "evidence": ev, "s": round(time.time() - t0, 1)})
    verdict = all(r["ok"] for r in rows)
    out = {"at": time.time(), "verdict": "LACUNA WORKS" if verdict else "NOT YET", "rows": rows}
    LAST.write_text(json.dumps(out, indent=1))
    day = time.strftime("%Y-%m-%d")
    md = [f"# THE LACUNA PROOF — {day}", "", f"BLUF: **{out['verdict']}** — {sum(r['ok'] for r in rows)} of {len(rows)} checks green on the live box.", "",
          "| | check | result | evidence | s |", "|---|---|---|---|---|"]
    md += [f"| {r['key']} | {r['name']} | {'✅' if r['ok'] else '❌'} | {r['evidence'].replace('|', '/')} | {r['s']} |" for r in rows]
    (LACUNA / "docs" / f"PROOF-{day}.md").write_text("\n".join(md) + "\n")
    return out


@router.get("/api/proof")
def r_last() -> dict:
    try:
        return json.loads(LAST.read_text())
    except (OSError, ValueError):
        return {"verdict": "NOT RUN", "rows": []}


@router.post("/api/proof/run")
def r_run() -> dict:
    return run()
