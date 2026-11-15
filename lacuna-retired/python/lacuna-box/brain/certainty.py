"""CERTAINTY — the model's own uncertainty, read from its token probabilities (Sprint 2, G5 + G15; 2026-10-19).

A request with "profile": "act" (a cart, a patch, a label that leads to an act) decodes with the ACT settings — a low
temperature and a strong min-p, so a token far below the best is never drawn (the real form of "logit clamping") — and
asks for each token's top-5 log-probabilities. From them each token's ENTROPY is measured (the top five, renormalised with
the rest of the mass as one more outcome): low means the model was sure, high means it was choosing among several. The
answer carries `lacuna_certainty`: the mean and the peak entropy, and the longest RUN of uncertain tokens. A long run is
the model losing its way (Gemini's "entropy spike"); the caller draws once more with fresh context, or hands it up.

  ACT                       the decode settings for acting
  measure(logprob_rows)     → {mean, peak, run, confused}
"""
from __future__ import annotations

import math

ACT = {"temperature": 0.2, "min_p": 0.1, "top_k": 40}
DRY = {"dry_multiplier": 0.8, "dry_base": 1.75, "dry_allowed_length": 2}
HIGH = 1.0        # nats: about three near-equal choices
RUN = 5           # this many uncertain tokens in a row is the model losing its way
MEAN = 0.5        # first calibration (2026-10-19, three probes): a known task 0.25–0.32, an invented cart 0.56; every act
                  # draw is logged (~/.lacuna/certainty.jsonl) so the line is re-drawn from real cart work


def entropy(top: list[dict]) -> float:
    ps = [math.exp(t.get("logprob", -99)) for t in top or []]
    rest = max(0.0, 1.0 - sum(ps))
    return -sum(p * math.log(p) for p in ps + [rest] if p > 1e-12)


def measure(rows: list[dict]) -> dict:
    hs = [entropy(r.get("top_logprobs") or []) for r in rows or [] if (r.get("token") or "").strip()]
    if not hs:
        return {}
    run = best = 0
    for h in hs:
        run = run + 1 if h > HIGH else 0
        best = max(best, run)
    mean = sum(hs) / len(hs)
    out = {"tokens": len(hs), "mean": round(mean, 3), "peak": round(max(hs), 3), "run": best, "confused": best >= RUN or mean >= MEAN}
    try:
        import json, os, time
        with open(os.path.expanduser("~/.lacuna/certainty.jsonl"), "a") as f:
            f.write(json.dumps({"t": round(time.time(), 1), **out}) + "\n")
    except OSError:
        pass
    return out
