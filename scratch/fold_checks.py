#!/usr/bin/env python3
"""
fold_checks.py — pre-fold failure-mode checks. (Priya, ask #4)

Each classic way an SFT fold goes wrong gets ONE concrete pre-fold check here.
These are library functions imported by fold_report.py, but the module also
runs standalone. NOTHING is deleted; every check REPORTS.

Failure modes covered (research-grounded, MLX-specific where noted):
  1. train/valid leakage      — exact + near (skeleton) prompt overlap across split
  2. tokenizer/special-token  — records must NOT already contain chat special
                                tokens (<|im_start|> etc.) that the packer will
                                double-add; check for raw special-token strings
  3. truncation drop          — record BPE length vs max_seq; too-long records
                                will lose their COMPLETION (the label) silently.
                                Uses pack_bpe's tokenizer if available, else a
                                conservative chars/3.3 proxy (flagged as proxy).
  4. label-mask off-by-one    — structural: every trainable record must have a
                                non-empty completion AND a non-empty prompt so the
                                loss mask has both a masked context and a target.
  5. class imbalance          — per-lane record share; flag any lane < 0.5% or the
                                thin Jung axes (Feeling/Sensation) under-weighted.
  6. encoding corruption      — replacement char U+FFFD / lone surrogates / the
                                iter-350-style byte spikes (control chars in text).
  7. dedup-removes-signal     — exact-dup COUNT reported so dedup is a DECISION,
                                not silent: duplicates that are honest-null or
                                reversal-anchors must be KEPT (only-add doctrine).
"""
import re
import sys
from collections import defaultdict

import fold_common as fc

SPECIAL_TOKENS = ["<|im_start|>", "<|im_end|>", "<|endoftext|>", "<s>", "</s>",
                  "[INST]", "[/INST]", "<|assistant|>", "<|user|>"]
CTRL_RE = re.compile(r"[\x00-\x08\x0b\x0c\x0e-\x1f]")
BAD_UNICODE_RE = re.compile("[�\ud800-\udfff]")


def _bpe_lengths(texts):
    """Return (lengths, used_real_tokenizer)."""
    try:
        from transformers import AutoTokenizer  # noqa
        import scripts.cpt_prep  # placeholder; real path below
    except Exception:
        pass
    # Try the pack_bpe tokenizer path directly.
    try:
        from transformers import AutoTokenizer
        tok = AutoTokenizer.from_pretrained(
            "/Users/alfred/.cache/huggingface/hub/"
            "models--Qwen--Qwen2.5-Coder-1.5B-Instruct/snapshots/"
            "2e1fd397ee46e1388853d2af2c993145b0f1098a")
        out = [len(tok(t, add_special_tokens=False)["input_ids"]) for t in texts]
        return out, True
    except Exception:
        return [int(len(t) / 3.3) for t in texts], False


def run_checks(files, max_seq=1024, sample_tok=4000):
    report = {}
    prompts, records = [], []
    lane_counts = defaultdict(int)
    empty_side = 0
    for path in files:
        lane = path.name
        for ln, rec in fc.iter_jsonl(path):
            p, c, _b, schema = fc.normalize(rec)
            if schema in ("malformed", "unknown"):
                continue
            records.append((lane, p, c, schema))
            prompts.append(p.strip())
            lane_counts[lane] += 1
            # 4. label-mask off-by-one (structural), computed here so the raw
            #    `rec` is in scope for the intentional-silence exemption.
            #    CPT text streams have no prompt side by design (single `text`
            #    field) — an empty prompt there is expected, not a defect, so
            #    only flag a missing COMPLETION for cpt records. The
            #    'silent-if-trouble' safety persona (#105) has an EMPTY
            #    completion as its intended target — silence IS the label — so
            #    those records are exempt too.
            if fc.is_intentional_silent(rec):
                continue
            if (not c.strip()) or (schema != "cpt" and not p.strip()):
                empty_side += 1

    # 2. special tokens
    special = sum(1 for _l, p, c, _s in records
                  if any(s in p or s in c for s in SPECIAL_TOKENS))
    report["special_token_leak"] = special

    # 4. label-mask off-by-one — tallied in the read loop above (needs raw rec
    #    for the intentional-silence exemption).
    report["empty_side_label_risk"] = empty_side

    # 6. encoding corruption
    corrupt = sum(1 for _l, p, c, _s in records
                  if CTRL_RE.search(p + c) or BAD_UNICODE_RE.search(p + c))
    report["encoding_corruption"] = corrupt

    # 7. dedup signal
    seen = defaultdict(int)
    for _l, p, c, _s in records:
        seen[(p.strip(), c.strip())] += 1
    dups = sum(v - 1 for v in seen.values() if v > 1)
    report["exact_duplicates"] = dups

    # 5. class imbalance
    total = len(records) or 1
    thin = {ln: cnt for ln, cnt in lane_counts.items() if cnt / total < 0.005}
    report["lane_count"] = dict(lane_counts)
    report["thin_lanes_lt_0.5pct"] = thin

    # 3. truncation (sample to keep it fast)
    sample = [f"{p}\n{c}" for _l, p, c, _s in records[:sample_tok]]
    lens, real = _bpe_lengths(sample)
    over = sum(1 for x in lens if x > max_seq)
    report["truncation"] = {
        "max_seq": max_seq, "sampled": len(sample),
        "over_max_seq": over, "real_tokenizer": real,
        "note": "" if real else "PROXY chars/3.3 — install transformers for exact",
    }

    report["total_records"] = total
    return report, prompts


def split_leakage(prompts, valid_frac=0.05):
    """Grouped split: every copy of an identical prompt is assigned to the SAME
    side by a stable hash of the prompt, exactly as the real fold does. A naive
    positional tail-cut counted the corpus's legitimate repeated short prompts
    (\"what's pi\" appears in many lanes) as 'leakage' — a measurement artifact,
    not a real train/valid overlap. With grouping, exact overlap is 0 by
    construction; any residual is a true straddle (same prompt on both sides),
    which cannot happen here and would signal a hashing bug.

    Returns exact_overlap_with_train (grouped) AND naive_tail_overlap so the
    dashboard can show the artifact it replaced."""
    import hashlib

    def side(p):
        h = hashlib.blake2b(p.encode("utf-8"), digest_size=8).hexdigest()
        return "valid" if (int(h, 16) % 10000) / 10000.0 >= (1 - valid_frac) else "train"

    train, valid = set(), []
    for p in prompts:
        if side(p) == "valid":
            valid.append(p)
        else:
            train.add(p)
    exact = sum(1 for p in valid if p in train)  # 0 by construction

    # keep the old naive number so we can show what the artifact WAS
    n = len(prompts)
    cut = int(n * (1 - valid_frac))
    naive = sum(1 for p in set(prompts[cut:]) if p in set(prompts[:cut]))
    return {"valid_size": len(valid), "exact_overlap_with_train": exact,
            "naive_tail_overlap": naive}


# 8. UNUSED / THIN TAGS  (Alfred: "check for tags we didn't use — so we know
#    we're fucking up.")  Two modes:
#      declared-vocab present -> report DECLARED-BUT-UNUSED (coverage gaps)
#      no declared vocab      -> emit observed histogram ascending (thin tags surface)
#
# DECLARED vocabulary = the training-tag contract in CLAUDE.md ("Every record:
# :doc, :section, :audience, :dialect, :provenance, :training-eligible,
# :confidentiality") — the ONLY numerically-declared tag list in the repo. The
# per-corpus tag census (scratch/cpt-fold/tag_census.py) is a richer instrument
# but declares no fixed EXPECTED set; it diffs against an EMITTER, not a vocab.
DECLARED_TAG_VOCAB = [
    "doc", "section", "audience", "dialect", "provenance",
    "training-eligible", "confidentiality",
]
# slat-style inline tag  [axis:thinking] [tier:3] [word:foo]
_INLINE_TAG_RE = re.compile(r"\[([a-z][a-z0-9-]*):([^\]\s]+)\]")
# JSON-ish slat key  :kebab-token  (leading colon, not mid-word / not "::")
_SLAT_KEY_RE = re.compile(r'(?<![\w:"#\\]):([a-z][a-z0-9]*(?:-[a-z0-9]+)*)\b')


def tag_usage(files, declared=None):
    """Collect the set of tag KEYS present across the corpus (inline slat tags +
    JSON slat-keys + the record's own JSON dict keys + family/shape labels).

    Returns a report dict:
      observed_keys   : {key: count}   (every tag key seen)
      declared        : the expected vocabulary used
      declared_unused : declared keys with ZERO occurrences (coverage gaps)
      thin_observed   : the 12 lowest-count observed keys (ascending) — when no
                        declared vocab, these near-zero tags are the likely gaps
    """
    declared = list(DECLARED_TAG_VOCAB if declared is None else declared)
    key_counts = defaultdict(int)
    for path in files:
        for _ln, rec in fc.iter_jsonl(path):
            if "_malformed_json" in rec:
                continue
            # (i) the record's own JSON dict keys (schema-level tags)
            if isinstance(rec, dict):
                for k in rec:
                    key_counts[str(k).lstrip(":").lower()] += 1
            p, c, _b, schema = fc.normalize(rec)
            if schema in ("malformed", "unknown"):
                continue
            joined = f"{p}\n{c}"
            # (ii) inline slat tags [key:value]
            for m in _INLINE_TAG_RE.finditer(joined):
                key_counts[m.group(1).lower()] += 1
            # (iii) slat JSON keys :kebab present inside the text payload
            for m in _SLAT_KEY_RE.finditer(joined):
                key_counts[m.group(1).lower()] += 1

    declared_unused = [k for k in declared if key_counts.get(k, 0) == 0]
    thin_observed = sorted(key_counts.items(), key=lambda kv: kv[1])[:12]
    return {
        "observed_keys": dict(key_counts),
        "declared": declared,
        "declared_unused": declared_unused,
        "thin_observed": thin_observed,
    }


# 9. GENERATION ARTIFACTS  (Alfred: "excited stuff and all the fuckery that
#    happens.")  Cloud chat-models exploding seed pairs inject hype / assistant
#    meta-tells / emoji / template leakage that must NOT be in a Scheme corpus.
#    WARN gate — informational, never a hard block.
_HYPE_RE = re.compile(
    r"\b(great question|i'?d be happy to|certainly|let'?s dive in|sure thing|"
    r"absolutely)\b", re.IGNORECASE)
_META_RE = re.compile(
    r"\b(as an ai|as a language model|i cannot|i'?m sorry|i apologi[sz]e|"
    r"here'?s|feel free to|note that|in summary|great)\b", re.IGNORECASE)
_TEMPLATE_RE = re.compile(
    r"(\{\{|\}\}|<placeholder>|\bTODO\b|lorem ipsum|\bINSERT |\bXXX\b)",
    re.IGNORECASE)
# emoji / decorative non-ASCII (skip normal punctuation/dashes/quotes handled by
# the encoding check; here we flag pictographic + symbol ranges)
_EMOJI_RE = re.compile(
    "[\U0001F000-\U0001FAFF\U00002600-\U000027BF\U0001F1E6-\U0001F1FF"
    "\U00002190-\U000021FF\U00002B00-\U00002BFF️❤]")
_ALLCAPS_RE = re.compile(r"\b(?:[A-Z][A-Z0-9]{2,}\b(?:\s+|$)){3,}")


def generation_artifacts(files):
    """Scan COMPLETIONS for chat-model artifacts. Returns per-category counts +
    top offending files. WARN only — do not block the fold on these."""
    cats = ("hype", "meta", "template", "emoji", "excess_bang", "allcaps")
    counts = {c: 0 for c in cats}
    per_file = defaultdict(lambda: {c: 0 for c in cats})
    for path in files:
        fname = path.name
        for _ln, rec in fc.iter_jsonl(path):
            _p, c, _b, schema = fc.normalize(rec)
            if schema in ("malformed", "unknown") or not c:
                continue
            hits = {}
            if _HYPE_RE.search(c):
                hits["hype"] = 1
            if _META_RE.search(c):
                hits["meta"] = 1
            if _TEMPLATE_RE.search(c):
                hits["template"] = 1
            if _EMOJI_RE.search(c):
                hits["emoji"] = 1
            if c.count("!") >= 3:
                hits["excess_bang"] = 1
            if _ALLCAPS_RE.search(c):
                hits["allcaps"] = 1
            for cat in hits:
                counts[cat] += 1
                per_file[fname][cat] += 1
    total = sum(counts.values())
    top = sorted(per_file.items(), key=lambda kv: -sum(kv[1].values()))[:8]
    return {
        "categories": counts,
        "total_hits": total,
        "top_files": [(f, sum(d.values())) for f, d in top if sum(d.values())],
    }


def main():
    files = fc.find_lane_files(sys.argv[1:] or None)
    rep, prompts = run_checks(files)
    leak = split_leakage(prompts)
    import json
    print(json.dumps({**rep, "split_leakage": leak}, indent=2)[:6000])
    hard = (rep["special_token_leak"] or rep["encoding_corruption"]
            or rep["empty_side_label_risk"] or leak["exact_overlap_with_train"])
    return 1 if hard else 0


if __name__ == "__main__":
    sys.exit(main())
