"""repair — fix one cart so the strict checker passes (LACUNA-1.3-DESIGN §14, B4).

The first repair card (10-16) spent twelve 25-minute steps grepping the web app and never edited the cart. This class
is the v0.5 rule made concrete: DETERMINISTIC FIRST, THE MODEL IS THE ESCAPE HATCH. The program — not the model —
makes the worktree, reads the cart, runs the checker, gathers what worked before, and checks every answer; the model
does exactly one thing per round: given the packet, hand back the whole corrected cart.

  inputs:  slug (required) · rounds (3) · full (true: the live strict check after a quick pass)
  rounds:  quick check (~7 s, canned model answers) → the model's whole new cart (schema-bound JSON) → quick check …
  end:     the live strict check (`work check`) when the quick one passes; the fix into the repair book when it lands
Never deletes a verb call, never invents shop data (the cart-repair rules, said in the packet and checked here).
"""
from __future__ import annotations

import json
import os
import re
import subprocess
import time

from errors import NotNow

HOME = os.path.expanduser("~")
TOOLS = f"{HOME}/lacuna-world/tools"
REPO = f"{HOME}/code/curator"
SKILLS = f"{HOME}/.lacuna/pi-agent/skills"
BASELINE = f"{REPO}/scratch/honest-count/runs-all-strict1.json"
OLLAMA = "http://127.0.0.1:11434"

# THE ANSWER IS THE CART ITSELF (2026-10-18): raw program text under the language's own grammar, its first line
# ";; fix: <one sentence>". JSON made the brain escape every newline and quote, so the answer stopped matching the cart
# in the prompt and the n-gram drafter (an edit at 234 tok/s against 27) had nothing to copy.
GRAMMAR = os.path.expanduser("~/code/sakura-scheme/grammar/program.gbnf")
FIX = re.compile(r"^\s*;+\s*fix:\s*(.*)$", re.I | re.M)


def sh(args: list[str], timeout: int = 300, stdin: str | None = None) -> tuple[int, str]:
    try:
        p = subprocess.run(args, capture_output=True, text=True, timeout=timeout, input=stdin)
        return p.returncode, (p.stdout or "") + (p.stderr or "")
    except subprocess.TimeoutExpired:
        return 124, f"timed out after {timeout} s"


def seat_of(name: str) -> dict:
    box = json.load(open(f"{HOME}/.lacuna/box.json"))
    s = dict(box["seats"].get(name) or box["seats"]["worker"])
    s["name"] = name if name in box["seats"] else "worker"
    return s


class Overtime(Exception):
    """A round that ran past its wall."""


def ask(w, seat: dict, system: str, user: str, grammar_text: str | None = None) -> dict:
    """One schema-bound answer from a seat: the seat's own ctx (a different num_ctx reloads the model), its keep-alive,
    no thinking, JSON that must parse. Brain time and tokens go to the worker's usage."""
    import urllib.request
    try:
        grammar = grammar_text or open(GRAMMAR).read()
    except OSError:
        grammar = None                                   # the trial still judges; only the guarantee is lost
    body = {"model": seat["model"], "stream": False, "think": seat.get("thinking") == "high",
            **({"grammar": grammar} if grammar and seat.get("thinking") != "high" else {}),
            "keep_alive": seat.get("keep_alive", "30m"),
            # a thinking budget Gemma does not have built in: the answer AND its thoughts stop at the seat's cap
            "options": {"num_ctx": int(seat.get("ctx", 32768)), "temperature": 0.2,
                        "num_predict": int(seat.get("max_out", 10240 if seat.get("thinking") == "high" else 6144))},
            "messages": [{"role": "system", "content": system}, {"role": "user", "content": user}]}
    body["stream"] = True
    # streamed, so a round has a WALL (the seat's round_s): thoughts that run long are cut and the round is said to have
    # run out of time — never a socket timeout that crashes the worker (w-repair-1018-002122 did, at 600 s)
    wall = float(seat.get("round_s", 480))
    t0, text, stats = time.time(), [], {}
    req = urllib.request.Request(f"{OLLAMA}/api/chat", data=json.dumps(body).encode(), headers={"Content-Type": "application/json"})
    import lane
    try:
        with lane.background(), urllib.request.urlopen(req, timeout=120) as r:
            for line in r:
                ev = json.loads(line)
                text.append((ev.get("message") or {}).get("content") or "")
                if ev.get("done"):
                    stats = ev
                    break
                if time.time() - t0 > wall:
                    raise Overtime(f"the {seat['name']} ran past {int(wall)} s on one round")
    finally:
        w.spend(brain_seconds=time.time() - t0, tokens_in=int(stats.get("prompt_eval_count") or 0),
                tokens_out=int(stats.get("eval_count") or 0), seat=seat["name"])
    out = "".join(text).strip()
    m = FIX.search(out[:600])
    why = m.group(1).strip() if m else ""
    program = FIX.sub("", out, count=1).lstrip("\n") if m else out
    return {"sks": program, "why": why}


def quick(task: str) -> dict:
    code, out = sh([f"{TOOLS}/box", "work", "quick", task], timeout=600)
    try:
        return json.loads(out)
    except ValueError:
        return {"ok": False, "carts": [], "why": out[-400:]}


def grammar(w=None) -> str:
    parts = []
    if w is not None:
        w.skills = ["sakura-scheme", "cart-repair"]
    for name in ("sakura-scheme", "cart-repair"):
        try:
            txt = open(f"{SKILLS}/{name}/SKILL.md").read()
            parts.append(re.sub(r"^---.*?---\s*", "", txt, flags=re.S)[:3500])
        except OSError:
            pass
    return "\n\n".join(parts)


def neighbors(slug: str, k: int = 2) -> list[tuple[str, str]]:
    """Two carts of the same namespace that pass strict today — real, working examples of the shape."""
    try:
        base = json.load(open(BASELINE))
    except (OSError, ValueError):
        return []
    ns = slug.split("-")[0]
    good = [s for s, v in base.items() if s != slug and s.startswith(ns + "-")
            and ((v.get("verdict") or {}).get("cls") in ("strict:works", "strict:works-model"))]
    out = []
    for s in sorted(good, key=lambda x: os.path.getsize(f"{REPO}/carts/automations/{x}/{x}.sks")
                    if os.path.exists(f"{REPO}/carts/automations/{x}/{x}.sks") else 1e9)[:k]:
        try:
            out.append((s, open(f"{REPO}/carts/automations/{s}/{s}.sks").read()[:6000]))
        except OSError:
            pass
    return out


def book(verdict: str) -> str:
    code, out = sh([f"{TOOLS}/cortex", "repairs", verdict], timeout=60)
    text = out.strip()[:3000] if code == 0 else ""
    _, learned = sh([f"{TOOLS}/cortex", "lessons", f"repair:{verdict}"], timeout=60)     # B24: its own past mistakes
    if learned.strip() and "no lessons" not in learned:
        text += "\n\nMistakes made before on this verdict (do not repeat them):\n" + learned.strip()[:1500]
    return text


def verbs_of(src: str) -> list[str]:
    return sorted(set(re.findall(r"\(act\s+'([a-z0-9-]+/[a-z0-9/-]+)", src)))


INDEX = f"{REPO}/curator-web/src/scheme/generated/verb-index.json"
DEVDATA = f"{REPO}/scratch/honest-count/devdata.json"
HONEST = f"{REPO}/scratch/honest-count"
# what each strict verdict asks for, in one sentence (curator-web/src/scheme/executeAllCarts.strict.js)
MEANING = {
    "strict:no-table": "the run must end with at least one (table rows cols) whose rows hold REAL content — a row of '—' or "
                       "empty cells does not count; rows come from what the verbs answered",
    "strict:no-one-liner": "the run must queue a one-liner (envelope-queue … :one-liner \"…\") that says what it found",
    "strict:no-done": "every path must end in (done); a model step is not a finish",
    "strict:empty-context": "the model step must be handed real data (what a verb answered), not an empty read",
    "strict:unwired-verb": "a verb the cart calls is not backed in production — use a real, wired verb",
}


def registry() -> dict:
    try:
        return {r["name"]: r for r in json.load(open(INDEX))["rows"]}
    except (OSError, ValueError, KeyError):
        return {}


_WORKING: dict | None = None


def working_verbs() -> dict:
    """verb → how many strict-passing carts call it: the verbs that ANSWER today (a name in the registry may be unwired)."""
    global _WORKING
    if _WORKING is not None:
        return _WORKING
    out: dict = {}
    try:
        base = json.load(open(BASELINE))
    except (OSError, ValueError):
        base = {}
    for s, v in base.items():
        if (v.get("verdict") or {}).get("cls") not in ("strict:works", "strict:works-model"):
            continue
        try:
            for vb in verbs_of(open(f"{REPO}/carts/automations/{s}/{s}.sks").read()):
                out[vb] = out.get(vb, 0) + 1
        except OSError:
            continue
    _WORKING = out
    return out


def nearest_working(v: str, k: int = 12) -> list[str]:
    work = working_verbs()
    toks = {t for t in re.split(r"[/-]", v) if len(t) > 3} | {t.rstrip("s") for t in re.split(r"[/-]", v) if len(t) > 3}
    scored = sorted(((sum(1 for t in toks if t in n), work[n], n) for n in work), reverse=True)
    return [f"{n} ({c} passing carts)" for sc, c, n in scored if sc > 0][:k]


def verb_report(src: str) -> tuple[str, list[str]]:
    """Each verb the cart calls: real or not; an unknown one with the nearest real verbs by name."""
    reg = registry()
    lines, unknown = [], []
    for v in verbs_of(src):
        r = reg.get(v)
        if r:
            lines.append(f"  {v} — real ({r.get('doc') or 'no doc'})")
            continue
        unknown.append(v)
        toks = set(re.split(r"[/-]", v)) | {t.rstrip("s") for t in re.split(r"[/-]", v)}
        near = sorted((n for n in reg if any(t and len(t) > 3 and t in n for t in toks)), key=len)[:10]
        lines.append(f"  {v} — NOT A VERB (the checker answers it with nothing real). Verbs that ANSWER today (passing carts "
                     f"call them), nearest first: {', '.join(nearest_working(v)) or 'none — '+', '.join(near)}")
    return "\n".join(lines) or "  (no verb calls)", unknown


def what_it_made(task: str, slug: str) -> str:
    """What the last quick run produced: block kinds, the table's columns and first rows, the verbs as the checker saw them."""
    try:
        f = sorted((x for x in os.listdir(HONEST) if x.startswith(f"runs-lacuna-{task}-quick") and x.endswith(".json")
                    and not x.endswith(".summary.json")))[-1]
        v = json.load(open(f"{HONEST}/{f}")).get(slug) or {}
    except (OSError, ValueError, IndexError):
        return "(no run recorded)"
    out = [f"  blocks: {(v.get('artifact') or {}).get('kinds')} · real table: {(v.get('artifact') or {}).get('realTable')}"]
    for blk in v.get("render") or []:
        if isinstance(blk, list) and blk and isinstance(blk[0], dict) and blk[0].get("sym") == "table" and len(blk) > 2:
            out.append(f"  table columns: {blk[2]}")
            out.append(f"  first rows: {json.dumps(blk[1][:3], ensure_ascii=False)[:500]}")
    out.append(f"  verbs as the checker saw them: {[(a.get('verb'), a.get('kind'), a.get('routed')) for a in v.get('acts') or []]}")
    # the runtime's own words for why it stopped: four narrowing rounds wrote `(take 100 xs)` blind to "take: expected a
    # proper list, got the number 100" — the checker had said it every time (2026-10-18)
    said = [r for r in v.get("reasons") or [] if not str(r).startswith("model-step")]
    if said:
        out.append("  the run said, last first: " + " · ".join(str(r)[:220] for r in reversed(said[-4:])))
    if v.get("escalateKind"):
        det = v.get("escalateDetail")
        name = ""
        try:
            d = json.loads(det) if isinstance(det, str) else det
        except ValueError:
            d = det
        if isinstance(d, list):                          # the detail is sometimes a list of the stopped acts
            d = next((x for x in d if isinstance(x, dict)), {})
        name = (d.get("verb") or d.get("name") or "") if isinstance(d, dict) else str(d or "")[:60]
        words = {"unbound-name": f"the interpreter stopped: the name `{name}` is not defined — define it (define/let) or use "
                                 f"a builtin; never use a name the cart does not bind"}.get(v["escalateKind"], f"the run stopped: {v['escalateKind']} {det}")
        out.append(f"  {words}")
    return "\n".join(out)


def history(slug: str, me: str, k: int = 6) -> str:
    """The run-history block (W37 g): what earlier repairs of THIS cart tried, round by round, and how each ended — so a
    round never repeats a fix the checker already refused."""
    jobs = os.path.join(HOME, "lacuna-world", "jobs")
    seen = []
    try:
        dirs = sorted((d for d in os.listdir(jobs) if d.startswith("w-repair-") and d != me), reverse=True)
    except OSError:
        return ""
    for d in dirs:
        try:
            if slug not in json.load(open(os.path.join(jobs, d, "job.json"))).get("goal", ""):
                continue
            rd = os.path.join(jobs, d, "rounds")
            for f in sorted(x for x in os.listdir(rd) if x.endswith(".json")):
                r = json.load(open(os.path.join(rd, f)))
                seen.append(f"  {d[9:]} round {f[:2]}: tried \"{str(r.get('why') or '')[:160]}\" → {r.get('verdict')} ({str(r.get('detail') or '')[:100]})")
        except (OSError, ValueError):
            continue
        if len(seen) >= k:
            break
    return "\n".join(seen[:k])


def data_shape() -> str:
    """One listing as the dev data holds it — the fields a cart's shop reads can really use."""
    try:
        x = json.load(open(DEVDATA))["listings"][0]
    except (OSError, ValueError, KeyError, IndexError):
        return "(no dev data)"
    keep = {k: x[k] for k in ("id", "platform", "state", "title", "quantity", "views", "num_favorers", "thumb") if k in x}
    keep["ebay_fields"] = {k: x.get("ebay_fields", {}).get(k) for k in ("title", "price", "quantity", "photos", "sku")}
    return json.dumps(keep, ensure_ascii=False)[:900]


def run(w):
    slug = w.inputs.get("slug")
    if not slug:
        return {"ok": False, "said": "no cart was named (inputs.slug)", "outputs": []}
    rounds_max = int(w.inputs.get("rounds", 3))
    # a task name is ≤ 40 (the workshop's rule): r- + the slug's head + a day-hour-minute stamp
    task = w.inputs.get("task") or ("r-" + re.sub(r"[^a-z0-9]+", "-", slug)[:28].strip("-") + "-" + time.strftime("%d%H%M"))
    w.progress(f"making the worktree {task} for {slug}")
    # several workers started at once share one repository: git's index.lock ("File exists") is a wait, not a worktree
    # (2026-10-18: three exam workers read that "exists" as success and found no cart)
    for _ in range(6):
        code, out = sh([f"{TOOLS}/box", "work", "new", task, slug, f"why=repair_{slug}"], timeout=300)
        if "index.lock" not in out and "Another git process" not in out:
            break
        time.sleep(20)
    if not os.path.isdir(f"{HOME}/lacuna-world/worktrees/{task}/carts"):   # the broker answers refusals in words, exit 0
        return {"ok": False, "said": f"the worktree could not be made: {out[-200:]}", "outputs": []}
    path = f"{HOME}/lacuna-world/worktrees/{task}/carts/automations/{slug}/{slug}.sks"
    try:
        src0 = open(path).read()
    except OSError:
        return {"ok": False, "said": f"the cart {slug} is not in the worktree", "outputs": []}
    w.touched.append(f"carts/automations/{slug}/{slug}.sks")
    calls0 = verbs_of(src0)
    real0 = [v for v in calls0 if v in registry()]

    # NARROW (B40): the cart passes, but hands the model too much — the goal is the same verdict with a context under
    # max_bytes, narrowed in code (filter, keep-fields, take), every verb call kept
    narrow = w.inputs.get("goal") == "narrow"
    target = int(w.inputs.get("max_bytes") or 8000)

    def passes(qq: dict) -> bool:
        r0 = (qq.get("carts") or [{}])[0]
        return bool(qq.get("ok")) and (not narrow or int(r0.get("ctx_bytes") or 0) <= target)

    q = quick(task)
    row = (q.get("carts") or [{}])[0]
    before = row.get("verdict")
    bytes0 = int(row.get("ctx_bytes") or 0)
    w.progress(f"before: {before} ({row.get('detail')})" + (f" · the model is handed {bytes0:,} bytes (target {target:,})" if narrow else ""))
    if passes(q):
        return {"ok": True, "said": f"{slug} already passes the quick check ({before})" + (f" at {bytes0:,} bytes" if narrow else "")
                + "; nothing to do", "verdict": {"before": before, "after": before}, "outputs": [], "confidence": 0.9}

    seat = seat_of(w.constraints.get("seat") or "worker")
    lease_key = f"worker:{w.id}"
    code, out = sh([f"{TOOLS}/lease", "take", lease_key, "--for", "30m", "--why", f"repair {slug}"], timeout=30)
    if code != 0 or "taken" not in out.lower() and "yours" not in out.lower() and "ok" not in out.lower():
        raise NotNow(f"the GPU is someone else's: {out.strip()[:120]}")
    system = ("You repair one Sakura Scheme cart so the strict checker passes. Answer with the WHOLE corrected cart as "
              "program text — nothing else, no fences — whose first line is ';; fix: <one sentence saying what you changed>'. "
              "Copy every line you do not change exactly as it is. Keep every verb call the cart makes "
              "(never delete a call to a REAL verb to make it pass; a verb marked NOT A VERB must be replaced by a real one), never invent shop data, change as little as you can, keep "
              "the header and comments.\n\n" + grammar(w))
    book_txt = book(before or "")
    past = history(slug, w.id)
    examples = "\n\n".join(f";; a passing cart of the same kind: {s}\n{t}" for s, t in neighbors(slug))
    # G6 + G7 (verbgram.py): the cart's grammar names only verbs that answer — today's working verbs, the real ones, the
    # cart's own slash names — never its dead verbs, never one a round was refused for (the loop breaker)
    import verbgram
    dead = {v for v in calls0 if v not in registry()}
    allowed = (set(working_verbs()) | set(registry()) | verbgram.slash_symbols(src0)) - dead
    try:
        base_g = open(GRAMMAR).read()
    except OSError:
        base_g = ""
    banned: set[str] = set()
    src, after, why, rounds = src0, before, "", 0
    q: dict = {"ok": False}
    try:
        for rounds in range(1, rounds_max + 1):
            if w.over():
                break
            reasons = "; ".join(row.get("reasons") or []) or "(none given)"
            vrep, unknown = verb_report(src)
            user = (f"The cart {slug} fails the strict checker: {row.get('verdict')} — {MEANING.get(row.get('verdict') or '', '')}. "
                    f"Detail: {row.get('detail')}; reasons: {reasons}.\n\n"
                    f"What the last run produced:\n{what_it_made(task, slug)}\n\n"
                    f"The verbs the cart calls:\n{vrep}\n\n"
                    f"One listing as the shop data holds it (what a listing verb answers with):\n{data_shape()}\n\n"
                    f"Fixes that worked for this verdict before:\n{book_txt or '(none yet)'}\n\n"
                    + (f"Earlier repairs of THIS cart and how they ended (never repeat a fix that did not pass):\n{past}\n\n" if past else "")
                    + f"{examples}\n\nThe cart now:\n{src}\n\nReturn the whole corrected cart.")
            if narrow:
                cur = int(row.get("ctx_bytes") or bytes0)
                user = (f"The cart {slug} passes the strict checker, but its model step is handed {cur:,} bytes — whole row "
                        f"lists the model does not need. Narrow it IN CODE before the model call so the step is handed under "
                        f"{target:,} bytes: filter the rows to the ones the question is about, keep only the fields it needs "
                        f"(the cart may already define keep-fields), cap long lists with take. This Scheme's own signatures: "
                        f"(take lst n) — the LIST first, then the count; (assq 'k row) is the PAIR (k . v), its value is "
                        f"(cdr (assq 'k row)). Keep every verb call, keep the "
                        f"strict verdict, keep the model's instruction text, change nothing else.\n\n"
                        f"One listing as the shop data holds it (the fields that exist):\n{data_shape()}\n\n"
                        f"Fixes that worked before:\n{book_txt or '(none yet)'}\n\nThe cart now:\n{src}\n\n"
                        "Return the whole narrowed cart.")
            w.progress(f"round {rounds}: asking the {seat['name']} ({seat['model']})")
            try:
                ans = ask(w, seat, system, user, verbgram.narrowed(base_g, allowed - banned) if base_g else None)
            except (Overtime, OSError, ValueError) as e:      # a long, cut or unparsable answer is a failed round, said
                w.progress(f"round {rounds}: no answer — {type(e).__name__}: {str(e)[:120]}")
                row = {"verdict": row.get("verdict"), "detail": row.get("detail"),
                       "reasons": ["your last answer ran out of time or was not valid JSON — think less, return the cart"]}
                continue
            new = str(ans.get("sks") or "")
            why = str(ans.get("why") or "")[:300]
            lost = [v for v in real0 if v not in verbs_of(new)]   # a verb that is not real may be replaced
            work = working_verbs()
            guessed = [v for v in verbs_of(new) if v not in work and v not in verbs_of(src0)]
            banned |= set(guessed)                           # a refused verb is never offered again in this run
            if guessed and not lost and new.strip():
                w.progress(f"round {rounds}: refused before running — {', '.join(guessed)} answers for no passing cart")
                sh([f"{TOOLS}/cortex", "lesson", f"repair:{before}", f"guessed the verb {guessed[0]}, which no passing cart calls — pick from the verbs that answer today"], timeout=30)
                row = {"verdict": row.get("verdict"), "detail": row.get("detail"),
                       "reasons": [f"you called {', '.join(guessed)}, which no passing cart calls — it will not answer. Use a "
                                   f"verb from the 'ANSWER today' list: {', '.join(nearest_working(guessed[0], 8))}"]}
                continue
            if not new.strip() or lost:
                row = {"verdict": row.get("verdict"), "detail": row.get("detail"),
                       "reasons": [f"your answer dropped the verb call(s) {', '.join(lost)} — keep every (act …)" if lost
                                   else "your answer was empty — return the whole cart"]}
                continue
            open(path, "w").write(new if new.endswith("\n") else new + "\n")
            src = new
            q = quick(task)
            row = (q.get("carts") or [{}])[0]
            after = row.get("verdict")
            w.progress(f"round {rounds}: {after}")
            # every attempt kept beside the worker — what it tried and what the checker said — the memory of its mistakes
            os.makedirs(f"{w.dir}/rounds", exist_ok=True)
            open(f"{w.dir}/rounds/{rounds:02d}.sks", "w").write(new)
            json.dump({"verdict": after, "detail": row.get("detail"), "why": why, "made": what_it_made(task, slug)},
                      open(f"{w.dir}/rounds/{rounds:02d}.json", "w"), indent=1, ensure_ascii=False)
            if passes(q):
                break
            if after and after != before and str(after) not in ("None",):
                sh([f"{TOOLS}/cortex", "lesson", f"repair:{before}", f"a round on {slug} turned {before} into {after}: {why[:160]}"], timeout=30)
    finally:
        sh([f"{TOOLS}/lease", "release", lease_key], timeout=30)

    if not passes(q):
        open(path, "w").write(src0)        # an unfixed cart goes back as it was: no half-repair left in the worktree
        return {"ok": False, "said": f"{slug}: still {after} after {rounds} round(s) — {row.get('detail')}",
                "verdict": {"before": before, "after": after}, "rounds": rounds, "task": task, "outputs": [],
                "confidence": 0.3, "handoff": {"next": "deep", "reason": f"{rounds} rounds on the {seat['name']} did not pass"},
                "anti_taxonomy": ["left the cart as it was", "did not touch dev"]}

    final = after
    if w.inputs.get("full", True):
        w.progress("the quick check passes — the live strict check (minutes)")
        code, out = sh([f"{TOOLS}/box", "work", "check", task], timeout=1500)
        try:
            res = json.loads(out)
            carts = [c for ch in res.get("checks", []) for c in ch.get("carts", [])]
            final = (carts[0] if carts else {}).get("verdict") or final
            passed = bool(res.get("passed"))
        except ValueError:
            passed = False
            final = f"the live check did not answer: {out[-160:]}"
    else:
        passed = True
    _, diff = sh([f"{TOOLS}/box", "work", "diff", task], timeout=120)
    if passed:
        sh([f"{TOOLS}/cortex", "repair", slug, str(before), slug.split("-")[0], json.dumps({"fix": why, "diff": diff[-3000:]})], timeout=60)
    return {"ok": passed, "said": f"{slug}: {before} → {final} in {rounds} round(s) on the {seat['name']} — {why}",
            "verdict": {"before": before, "after": final}, "rounds": rounds, "task": task, "branch": f"lacuna-{task}",
            "outputs": [{"path": f"carts/automations/{slug}/{slug}.sks", "kind": "cart"}], "confidence": 0.8 if passed else 0.5,
            "handoff": {"next": "review" if passed else "deep"}, "anti_taxonomy": ["kept every verb call", "did not touch dev"]}
