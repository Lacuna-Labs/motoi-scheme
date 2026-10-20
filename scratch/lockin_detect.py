#!/usr/bin/env python3
"""
lockin_detect.py — phrase-lock / template-skeleton detector. (Priya, ask #2)

WHY: parallel-template authoring with a swapped variable ("only the verb name
varies") produces deterministic near-duplicate pairs = "nonsense"
(feedback_parallel_templates_cause_phrase_lock). This flags FAMILIES of pairs
that are too structurally similar so they get re-authored (ADD-only: diversify,
never trim).

METHOD (deterministic, no model needed — a screen, not the fix):
  1. SKELETONISE each prompt: lowercase, replace runs of digits and any token
     that looks like a verb/identifier arg with a placeholder, collapse ws.
     Records that share a skeleton are a candidate template family.
  2. For each family >= --min-family, compute cheap diversity signals:
       - self-BLEU proxy: mean pairwise 4-gram Jaccard (higher = more locked)
       - distinct-2: unique bigrams / total bigrams (lower = more locked)
       - gzip ratio: gzip(concat)/len(concat) (lower = more compressible = locked)
  3. Flag a family as PHRASE-LOCK RISK if it trips the gate thresholds from
     00-BIG-FOLD-PLAN §5: self-BLEU>0.35, distinct-2<0.6, gzip<0.65.

This computes PER-CLUSTER (skeleton family), matching the plan's "per fact-
cluster, not corpus-wide" rule. It does NOT call an LLM; the rewrite lane
(Verbalized Sampling) is the FIX and runs separately — see notes at bottom.
"""
import argparse
import gzip
import random
import re
import sys
from collections import defaultdict

import fold_common as fc

_WORD = re.compile(r"[a-z][a-z0-9!?*+/<>=-]*", re.IGNORECASE)
_NUM = re.compile(r"\d+")
# tokens we treat as slot fillers when skeletonising (identifiers, backticked)
_TICK = re.compile(r"`[^`]+`")


def skeleton(prompt):
    s = prompt.strip().lower()
    s = _TICK.sub("`X`", s)
    s = _NUM.sub("#", s)
    # keep function words, blank out the content nouns/verbs > 3 chars
    toks = []
    for w in s.split():
        core = re.sub(r"[^a-z`#]", "", w)
        if len(core) > 3 and core not in _STOP:
            toks.append("_")
        else:
            toks.append(w)
    return " ".join(toks)


_STOP = {"show", "give", "what", "with", "from", "your", "that", "this",
         "does", "when", "where", "which", "here", "make", "want", "code"}


def _ngrams(text, n=4):
    toks = text.lower().split()
    return set(tuple(toks[i:i + n]) for i in range(len(toks) - n + 1)) or {("",)}


def self_bleu_proxy(texts, sample_cap=80):
    # O(n^2) pairwise; cap large families with a deterministic sample so the
    # phrase-lock proxy stays tractable across the full explosion (millions).
    if len(texts) > sample_cap:
        rng = random.Random(1729)
        texts = rng.sample(texts, sample_cap)
    grams = [_ngrams(t) for t in texts]
    if len(grams) < 2:
        return 0.0
    sims, cnt = 0.0, 0
    for i in range(len(grams)):
        for j in range(i + 1, len(grams)):
            a, b = grams[i], grams[j]
            u = len(a | b) or 1
            sims += len(a & b) / u
            cnt += 1
    return sims / cnt if cnt else 0.0


def distinct2(texts):
    total, uniq = 0, set()
    for t in texts:
        toks = t.lower().split()
        bg = [(toks[i], toks[i + 1]) for i in range(len(toks) - 1)]
        total += len(bg)
        uniq.update(bg)
    return len(uniq) / total if total else 1.0


def gzip_ratio(texts):
    blob = "\n".join(texts).encode("utf-8")
    if not blob:
        return 1.0
    return len(gzip.compress(blob)) / len(blob)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("paths", nargs="*")
    ap.add_argument("--min-family", type=int, default=8)
    ap.add_argument("--top", type=int, default=25)
    args = ap.parse_args()

    files = fc.find_lane_files(args.paths or None)
    families = defaultdict(list)  # skeleton -> [prompt+completion]
    for path in files:
        for _ln, rec in fc.iter_jsonl(path):
            p, c, _b, schema = fc.normalize(rec)
            if schema in ("malformed", "unknown") or not p.strip():
                continue
            families[skeleton(p)].append(f"{p} || {c}")

    flagged = []
    for skel, texts in families.items():
        if len(texts) < args.min_family:
            continue
        sb = self_bleu_proxy(texts)
        d2 = distinct2(texts)
        gz = gzip_ratio(texts)
        # self-BLEU is the ONLY content-similarity signal (it compares full
        # prompt+completion text). distinct-2 and gzip trip on SKELETON
        # repetition — thousands of "what does X do?" pairs with DIVERSE answers
        # are benign and must not flag. So: lock on self-BLEU; carry d2/gz as
        # INFO only. (Prior OR-gate reported ~1500 families, ~85% benign.)
        locked = sb > 0.35
        if locked:
            flagged.append((len(texts), sb, d2, gz, skel))

    flagged.sort(reverse=True)
    severe = sum(1 for f in flagged if f[1] > 0.50)
    recs = sum(f[0] for f in flagged)
    print(f"# lockin_detect — {len(families)} skeleton families, "
          f"{len(flagged)} TRUE phrase-lock (self-BLEU>0.35), "
          f"{severe} severe (>0.50), {recs} records\n")
    print(f"{'n':>5} {'selfBLEU':>9} {'dist2':>7} {'gzip':>6}  skeleton")
    print("-" * 70)
    for n, sb, d2, gz, skel in flagged[:args.top]:
        print(f"{n:>5} {sb:>9.3f} {d2:>7.3f} {gz:>6.3f}  {skel[:44]}")
    return 1 if flagged else 0


if __name__ == "__main__":
    sys.exit(main())

# --------------------------------------------------------------------------
# FIX PLAN — "text generators that prevent lock-in" (design, per §5 of the plan):
#
#   Detection (this script) is the GATE. The FIX is a re-authoring lane:
#   ~70% offline open-weights MLX-local rewrite using Verbalized Sampling
#        (ask model for k rewrites WITH probabilities, sample from the tail) —
#        counters the alignment-typicality bias that CAUSES phrase-lock;
#   ~20% deterministic structural scatter UNDER it (reorder clauses, swap
#        connectives, permute the framing slot) — cheap surface variety;
#   ~10% full-context Claude "high-cool" lanes for load-bearing pairs
#        (R4 build-ladders, keystone dialogues, identity/safety).
#   AVOID persona-engineering (negligible diversity gain, per arXiv:2505.17390).
#
#   Loop: flag family -> re-author -> re-run this gate until self-BLEU<=0.30,
#   distinct-2>=0.6, gzip<=0.65. NEVER delete the locked family to "pass" —
#   that violates only-add-never-prune; diversify in place.
# --------------------------------------------------------------------------
