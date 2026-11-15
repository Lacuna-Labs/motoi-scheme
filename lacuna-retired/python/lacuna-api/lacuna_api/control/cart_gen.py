"""THE CART GENERATOR (the owner, 2026-10-18: "you give in plain text, the 26B takes it, wraps it in some code, bundles it,
here's your cart, bam. You give it a name and send that motherfucker off").

  POST /api/carts/generate {name, text}  → {ok, name, program, trial, tries, file}

1. The 26B (the person's lane: he is waiting) is handed what a cart is — the header, the verbs, every read a cart may
   ask (hands_api.OPS and hands.OPS), two real carts as patterns — and his words. It answers with one .sks.
2. The foreman TRIES it (/check: loads, every handler survives a sample, every hand exists). Problems go back to the
   26B, at most three rounds (the fix-first loop the foreman's propose already uses).
3. It lands in ~/lacuna-world/carts/<name>.sks — a new name only, never over an existing cart — and the Automations card
   shows it with its run key (the owner's press).
A generated cart is a WATCH cart: it reads and reports. Acts and `ask` are refused here; a cart that changes things is
written on purpose, by a person or by Claude, and reviewed.
"""
from __future__ import annotations

import json
import re
import time
import urllib.request
from pathlib import Path

GATEWAY = "http://127.0.0.1:11434"
MODEL = "lacuna-worker-lite"
NAME = re.compile(r"^[a-z][a-z0-9-]{1,40}$")
TRIES = 3


def _world() -> Path:
    import os
    return Path(os.environ.get("LACUNA_WORLD") or Path.home() / "lacuna-world")


LAST_CERTAINTY: dict = {}


def _ask(messages: list, max_tokens: int = 1800, temperature: float = 0.2) -> str:
    # G15: the ACT decode, with the model's certainty returned (lacuna-box/brain/certainty.py)
    body = json.dumps({"model": MODEL, "messages": messages, "stream": False, "think": False, "profile": "act",
                       "options": {"temperature": temperature, "num_predict": max_tokens}}).encode()
    req = urllib.request.Request(f"{GATEWAY}/api/chat", data=body, headers={"Content-Type": "application/json", "X-Lacuna-Lane": "background", "X-Lacuna-Prefix": "cart-gen"})
    with urllib.request.urlopen(req, timeout=600) as r:
        got = json.loads(r.read())
    LAST_CERTAINTY.clear()
    LAST_CERTAINTY.update(got.get("lacuna_certainty") or {})
    return ((got.get("message") or {}).get("content") or "").strip()


def _program(text: str) -> str:
    m = re.search(r"```(?:scheme|lisp|sks)?\s*\n(.*?)```", text, re.S)
    out = (m.group(1) if m else text).strip()
    i = out.find("(lacuna-cart")
    return out[i:] if i > 0 and not out[:i].strip().startswith(";") else out


def nearest_carts(text: str, k: int = 2) -> list[str]:
    """EmbeddingGemma's CODE-RETRIEVAL view (its own prompt for it): the real watch carts whose programs are nearest to
    the owner's words — the generator starts from the closest working cart, not a blank page (the cortex roll-up, C6)"""
    from . import rag
    files = [f for f in sorted((_world() / "carts").glob("*.sks")) if "(tier . watch)" in f.read_text(errors="replace")]
    if not files:
        return []
    try:
        q = rag.embed([text], kind="task: code retrieval | query: ")
        docs = rag.embed([f"title: {f.stem} | text: {f.read_text(errors='replace')[:3000]}" for f in files])
    except Exception:  # noqa: BLE001
        q, docs = None, None
    if not q or not docs:
        return ["repo-drift", "watchdog-stale"]
    import math
    ranked = sorted(zip(files, docs), key=lambda t: -math.sumprod(q[0], t[1]))
    return [f.stem for f, _ in ranked[:k]]


def brief(text: str = "") -> str:
    """What a cart is, for the 26B: the header, the watch verbs, every read, the two nearest real carts."""
    from . import hands, hands_api
    reads = "\n".join(f"  (hand '{op} …) — {w}" for op, (_, w, _) in hands_api.OPS.items())
    reads += "\n" + "\n".join(f"  (hand '{op} …)" for op in hands.OPS)
    patterns = ""
    for n in (nearest_carts(text) if text else ["repo-drift", "watchdog-stale"]):
        f = _world() / "carts" / f"{n}.sks"
        if f.exists():
            patterns += f"\n;; ── a real cart: {n}.sks ──\n" + f.read_text()
    return f"""You write Lacuna CARTS: small Scheme programs the foreman runs. Answer with ONE cart in a ```scheme block, nothing else.

A cart opens with its header, as data:
(lacuna-cart 'name
  '((does . "what it does, one sentence")
    (agent . ((tier . watch) (verbs . (on hand report remember recall after done))))
    (minds . ((label . ((job . signal->label) (labels . (a b c)) (untrusted . #t)))))   ; only if it needs a small mind
    (touches . ())
    (done . "when it is finished, one sentence")))

Rules:
- tier is watch. Verbs you may use: on hand report remember recall after done every subscribe mind-job mind. Never act, ask, spawn or need-brain.
- (define (start) …) runs once. A read is (hand 'op args…); its answer arrives as (on 'hand (lambda (r) …)) with
  (get r 'ok #f), (get r 'op 'none) and (get r 'result '()). Use (case (get r 'op 'none) ((op1) …) ((op2) …)) for several reads.
- (report 'kind "words") says something to the owner. (done "words") ends the cart, always, on every path.
- (get x 'key default) reads a field. Helpers: filter, for-each, map, length, append, list-ref, member, string-append,
  number->string, round, equal?, null?, pair?. Build strings with string-append and number->string, never format.
- Every path must end in (done …), and a cart that waits must also have (after 1800 (lambda () (done "stopped waiting"))).

The reads a cart may ask (each answers JSON as Scheme data):
{reads}
{patterns}"""


def skeleton(v, depth: int = 0):
    """a read's real answer, cut to its shape: keys kept, lists to their first item, strings shortened"""
    if isinstance(v, dict):
        return {k: skeleton(x, depth + 1) for k, x in list(v.items())[:14]} if depth < 4 else "…"
    if isinstance(v, list):
        return [skeleton(v[0], depth + 1), f"… {len(v)} items"] if v else []
    if isinstance(v, str):
        return v[:60]
    return v


def shapes(names: list) -> str:
    """live samples of the reads a cart will use — the 26B writes against what (get r 'result …) really holds"""
    from . import hands, hands_api
    out = []
    for op in names[:5]:
        if op not in hands_api.OPS and op not in hands.OPS:
            continue
        args = {"service": ["dev-api"], "service-log": ["dev-api", "5"], "recall": ["release"], "port": ["1138"], "knn": ["inbox-route", "the dev API is down"], "memory": ["release"], "pointing-at": ["thing/dev-api"], "like": ["fact/dev-api-port"], "trail": ["thing/dev-api"], "git-status": [str(Path.home() / "code" / "lacuna")]}.get(op, [])
        r = hands.do(op, args)
        if r.get("ok"):
            call = "(hand '" + op + "".join(' "' + a + '"' for a in args) + ")"
            out.append(call + " → (get r 'result) is:\n" + json.dumps(skeleton(r["result"]), ensure_ascii=False)[:1500])
    return "\n\n".join(out)


def _tried(answer: str, name: str) -> tuple[str, dict]:
    from . import foreman
    program = _program(answer)
    program = re.sub(r"^\(lacuna-cart\s+'[\w-]+", f"(lacuna-cart '{name}", program, count=1)
    if re.search(r"\((act|ask|spawn|need-brain)\s", program):
        return program, {"ok": False, "problems": ["a generated cart reads and reports only: take out act, ask, spawn and need-brain"]}
    return program, foreman.call("POST", "/check", {"program": program}, timeout=60)


def generate(name: str, text: str, who: str) -> dict:
    name = str(name or "").strip().lower()
    if not NAME.match(name):
        return {"ok": False, "why": "a cart's name is a short lowercase word with dashes, like disk-watch"}
    f = _world() / "carts" / f"{name}.sks"
    if f.exists():
        return {"ok": False, "why": f"there is already a cart called {name}: choose another name"}
    if not str(text or "").strip():
        return {"ok": False, "why": "say what the cart should do"}
    from . import foreman
    from .core import audit
    t0 = time.time()
    # DYNAMIC CONTEXT: first the reads it needs (names only), then their real answers' shapes, then the writing
    from . import hands, hands_api
    try:
        pick = _ask([{"role": "user", "content": "A cart must: " + text.strip()[:800] + "\nWhich of these reads does it need? Answer only a JSON list of names.\n"
                      + ", ".join(list(hands_api.OPS) + list(hands.OPS))}], max_tokens=80)
        names = [n for n in json.loads(re.search(r"\[.*?\]", pick, re.S).group(0)) if isinstance(n, str)]
    except (OSError, ValueError, AttributeError):
        names = []
    real = shapes(names)
    msgs = [{"role": "system", "content": brief(text)},
            {"role": "user", "content": f"Write the cart '{name}'. What it should do, in the owner's words:\n{text.strip()[:1500]}"
             + (f"\n\nTHE REAL ANSWERS of the reads it needs, sampled now — read exactly these fields (through (get r 'result '())):\n{real}" if real else "")}]
    program, trial = "", {}
    for n in range(1, TRIES + 1):
        try:
            answer = _ask(msgs)
        except OSError as e:
            return {"ok": False, "why": f"the brain did not answer ({e.__class__.__name__})", "tries": n}
        if LAST_CERTAINTY.get("confused"):
            # G5: the model was choosing among several paths — one more draw, and the surer one is kept
            first, sure1 = answer, dict(LAST_CERTAINTY)
            answer = _ask(msgs, temperature=0.5)
            if (LAST_CERTAINTY.get("mean") or 9) > (sure1.get("mean") or 9):
                answer = first
        program, trial = _tried(answer, name)
        if not trial.get("ok") and n > 1:
            # G8 BEST OF N, the trial as the judge: after a refusal, a second, freer draw of the same fix; the first that
            # passes is kept (the fixed draw first, so a pass needs no gamble)
            try:
                alt_program, alt_trial = _tried(_ask(msgs, temperature=0.7), name)
            except OSError:
                alt_trial = {}
            if alt_trial.get("ok"):
                program, trial = alt_program, alt_trial
                audit(who, "cart.generate.best-of-2", name=name, try_n=n)
        if trial.get("ok"):
            break
        msgs += [{"role": "assistant", "content": f"```scheme\n{program}\n```"},
                 {"role": "user", "content": "The foreman's trial refused it:\n- " + "\n- ".join(map(str, trial.get("problems") or [trial.get("why")]))
                  + "\nFix exactly these and answer with the whole cart again."}]
    if not trial.get("ok"):
        # THE CLOUD SEAT (cloud.py): three local tries refused → one draft from the cloud, tried by the same foreman
        from . import cloud_kinds
        c = cloud_kinds.cart_draft(name, text, trial.get("problems") or [trial.get("why")])
        if c.get("ok"):
            program, trial = c["program"], c["trial"]
            audit(who, "cart.generate.cloud", name=name, model=c.get("model"))
    audit(who, "cart.generate", name=name, ok=bool(trial.get("ok")), tries=n, secs=round(time.time() - t0))
    if not trial.get("ok"):
        return {"ok": False, "name": name, "program": program, "trial": trial, "tries": n,
                "why": "it did not pass its trial in three tries: " + "; ".join(map(str, trial.get("problems") or [trial.get("why")]))[:400]}
    header = f";; {name} — generated {time.strftime('%Y-%m-%d %H:%M')} from the owner's words by the 26B (cart_gen.py), tried by the foreman.\n;; Asked: {text.strip()[:300]}\n\n"
    f.write_text(header + program + "\n")
    return {"ok": True, "name": name, "program": program, "trial": {"ok": True}, "tries": n, "file": str(f), "secs": round(time.time() - t0), "reads": names}
