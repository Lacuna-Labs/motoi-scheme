"""THE JUDGMENT — how the 26B answers a cart's yes-or-no (the owner's Google advice, kept 2026-10-19: B8 sample several and
vote before an act; B9 the token's own probability as certainty; B10 the brain's reasoning kept in the cortex as a why).

A judgment point in a cart is a question with two answers. One sample of a language model is one draw: it can land
wrong with confidence. So:
  1. ASK N TIMES (3) at a working temperature, each answer a first word (yes|no) and one sentence why.
  2. CERTAINTY of each draw = the probability the model put on its first word (yes and its spellings, or no and its) —
     read from the token's log-probabilities, not from what the model says about itself.
  3. THE VOTE: the majority answer, its mean certainty. A split vote, or a mean certainty under FLOOR, is NOT an
     answer: the cart's question goes to the owner as a card (foreman._ask_owner), with the votes beside it.
  4. THE WHY: the decision is written to the cortex — a `decision` node with the question, the answer, the votes,
     the certainty and the reasons, about the cart — so "why did the release stop?" is a read, later.

  judge(question, facts, about)  → {ok, yes, certain, certainty, votes, why, answers}
"""
from __future__ import annotations

import json
import math
import time
import urllib.request

BRAIN = "http://127.0.0.1:11434/v1/chat/completions"   # through the gateway: the background slot, its own warm lane (kvring)
N, FLOOR, TEMP = 3, 0.80, 0.7
YES, NO = {"yes", "y"}, {"no", "n"}


RULE = ("You judge one yes-or-no question for an automated system. Answer with exactly one word first, yes or no. "
        "Then a new line and one sentence: why. Judge only from the facts given and the laws stated in the question.")


def _draw(prompt: str, timeout: int = 120) -> dict:
    # G3: the fixed rule is the system turn (cached once for every judgment); the question and its facts come after it
    body = {"model": "lacuna-worker-lite", "messages": [{"role": "system", "content": RULE}, {"role": "user", "content": prompt}], "max_tokens": 80, "temperature": TEMP, "logprobs": True,
            "top_logprobs": 5, "chat_template_kwargs": {"enable_thinking": False}}
    req = urllib.request.Request(BRAIN, json.dumps(body).encode(), {"content-type": "application/json", "X-Lacuna-Lane": "background",
                                                                    "X-Lacuna-Prefix": "judge"})
    with urllib.request.urlopen(req, timeout=timeout) as r:
        c = json.loads(r.read())["choices"][0]
    text = (c.get("message") or {}).get("content") or ""
    toks = ((c.get("logprobs") or {}).get("content") or [])
    first = next((t for t in toks if t.get("token", "").strip()), None)
    p_yes = p_no = 0.0
    for alt in (first or {}).get("top_logprobs") or []:
        w = alt.get("token", "").strip().lower().strip(".,:")
        p = math.exp(alt.get("logprob", -99))
        p_yes += p if w in YES else 0
        p_no += p if w in NO else 0
    word = text.strip().split(None, 1)[0].lower().strip(".,:") if text.strip() else ""
    ans = True if word in YES else False if word in NO else None
    cert = (p_yes if ans else p_no) / ((p_yes + p_no) or 1) * min(1.0, p_yes + p_no) if ans is not None else 0.0
    why = text.strip().split("\n", 1)[1].strip() if "\n" in text.strip() else text.strip()[len(word):].strip(" .:-")
    return {"yes": ans, "certainty": round(cert, 3), "why": why[:300]}


def judge(question: str, facts: object = None, about: str | None = None, n: int = N, draw=_draw) -> dict:
    # G4: the facts first, the question last — a long middle is where a model loses the thread
    prompt = (f"Facts: {json.dumps(facts, ensure_ascii=False)[:2500] if facts is not None else 'none given'}\n\n"
              f"Question: {question}\n\nyes or no, then why.")
    answers = []
    for _ in range(n):
        try:
            answers.append(draw(prompt))
        except (OSError, ValueError, KeyError, IndexError) as e:
            answers.append({"yes": None, "certainty": 0.0, "why": f"no answer ({e.__class__.__name__})"})
    yes = sum(1 for a in answers if a["yes"] is True)
    no = sum(1 for a in answers if a["yes"] is False)
    major = yes > no
    side = [a for a in answers if a["yes"] is major]
    mean = round(sum(a["certainty"] for a in side) / len(side), 3) if side else 0.0
    unanimous = len(side) == n
    certain = unanimous and mean >= FLOOR
    second = None
    if not certain and yes + no:
        # THE CLOUD SEAT: a split vote asks Gemma 4 31B once; it may only CONFIRM the local majority (cloud_kinds.py)
        try:
            from . import cloud_kinds
            second = cloud_kinds.second_opinion(question, facts, major)
            certain = bool(second.get("confirmed")) and len(side) * 2 > n
        except Exception:  # noqa: BLE001 — no second opinion is the owner's card, as before
            second = None
    out = {"ok": True, "yes": major, "certain": certain, "certainty": mean, "votes": {"yes": yes, "no": no, "unread": n - yes - no},
           "why": (side[0]["why"] if side else ""), "answers": answers, "second": second,
           "said": (f"{'yes' if major else 'no'} — {yes} yes / {no} no, certainty {mean:.2f}"
                    + (f"; confirmed by the cloud's second opinion ({second.get('model')})" if second and second.get("confirmed") and certain
                       else "" if certain else f"; not certain enough to act alone (needs {n}/{n} and ≥ {FLOOR}, or the cloud's confirmation)"))}
    _keep(question, about, out)
    return out


def _keep(question: str, about: str | None, out: dict) -> None:
    """B10: the brain's reasoning, a decision node in the cortex — never lost with the chat window. The cortex holds
    flat values only (str · number · bool), so the votes are written as words."""
    try:
        from . import lacuna_cortex
        key = f"judge-{time.strftime('%Y%m%d-%H%M%S')}"
        r = lacuna_cortex.remember("decision", key, {"text": f"{'YES' if out['yes'] else 'NO'} ({out['votes']['yes']}–{out['votes']['no']}) — {out['why'][:160]} — asked: {question[:200]}", "why": out["why"],
                                                 "votes": f"{out['votes']['yes']} yes / {out['votes']['no']} no / {out['votes']['unread']} unread", "certainty": out["certainty"], "certain": out["certain"],
                                                 "by": "the 26B (judge.py)", "at": time.strftime("%Y-%m-%dT%H:%M:%S")},
                               about=[about] if about else None)
        if not r.get("ok"):
            from .core import audit
            audit("lacuna", "judge.keep-failed", why=str(r.get("error"))[:200])
    except Exception:  # noqa: BLE001 — the cortex is kept best-effort; the judgment stands without it
        pass
