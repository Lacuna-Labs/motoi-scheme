#!/usr/bin/env python3
"""
fold_common.py — shared record reader for the Motoi SFT fold sweeps (Priya).

Every fold-prep script imports this so they agree on:
  - how a JSONL file is read (skipping `_provenance_header` lines),
  - how a heterogeneous record is normalised to (prompt, completion, code_blocks),
  - which banned tokens leak into the Motoi corpus,
  - where the interpreter lives.

NO fabrication: if a record shape is unknown, it is reported as `unknown_schema`,
never silently coerced. This module DELETES NOTHING.

Record schemas seen on disk (2026-07-30):
  A. {"shape","instruction","response","code_blocks":[...]}      (prototype shapes)
  B. {"messages":[{"role","content"},...]}                        (graph/*, marcus)
  C. {"instruction"/"prompt"/"question", "output"/"response"/"completion"/"answer"}
  D. {"_provenance_header": true, ...}  -> SKIP (metadata, not a training pair)
"""
import json
import os
import re
from pathlib import Path

REPO = Path(__file__).resolve().parent.parent
MOTOI = REPO / "bin" / "motoi"

# Doctrine: Motoi corpus must not leak these. Word-boundary matched, case-insensitive.
# "Alfred Borden" is the ONE allowed name (scrub-wall), so we exempt that exact phrase.
BANNED_TOKENS = [
    "Curator", "Sakura", "Weave-recipe",
    "Jarvis",  # persona-wall leak seen in Mk1
]
# NOT banned (Alfred, 2026-07-30): "Lacuna" / "Lacuna Labs" — Lacuna Labs is the
# authorship ORG now stamped on the corpus (":authored-by \"Alfred Borden, Lacuna
# Labs\""), and bare "Lacuna" dialect/relationship mentions are kept as taught
# context. Filter removed on Alfred's call.
# NOT banned (verified 2026-07-30):
#   Cortex — shipped Motoi subsystem (lib/ai/cortex.js, 14 wired verbs); the
#            model MUST know it. Was a false positive (597 legit hits).
#   Qwen   — KEEP per doctrine: appears only in honest-null refusal pairs
#            ("what's the Qwen tokenizer diff? Don't know.") and the AI Tech
#            Cards. No "I am Qwen" identity claim present. Good training signal.
# Crew-persona names that must not leak into Motoi's voice (extend as Alfred flags).
# NOTE: word-boundary matched in fold_sweep to avoid false positives like
#   "Cauchy-Schwarz" (math), "Architecture" (contains "Architect"), "curry" (fn).
# Those collision-prone tokens are DELIBERATELY EXCLUDED here; flag by review if
# they appear as a *persona* ("the Architect said"), not as domain vocabulary.
# NOT banned (verified 2026-07-30): "Kleene" — every corpus hit is the REAL
# mathematician Stephen Kleene (Kleene-Rosser paradox, mu-recursive functions,
# Kleene realizability), a preserved real figure. It was a false positive: the
# collision was with an agent codename ("Team Kleene") that only lived in drive
# logs, never in the corpus. "Abel Sussman" stays banned as the exact crew-persona
# phrase — it does NOT collide with the real Gerald Sussman / Niels Abel apart.
BANNED_NAMES = ["Priya", "Korra", "Zain", "Abel Sussman"]
ALLOWED_NAME_PHRASES = ["Alfred Borden", "Built by Alfred Borden"]

# `:status "needs-alfred"` placeholders must never train.
NEEDS_ALFRED_RE = re.compile(r':status\s+"needs-alfred"|needs-alfred', re.IGNORECASE)


def iter_jsonl(path):
    """Yield (lineno, record_dict) for each JSON line. Skips provenance headers.

    Malformed JSON lines yield (lineno, {"_malformed_json": raw}).
    """
    with open(path, "r", encoding="utf-8", errors="surrogatepass") as fh:
        for lineno, raw in enumerate(fh, 1):
            raw = raw.rstrip("\n")
            if not raw.strip():
                continue
            try:
                rec = json.loads(raw)
            except (json.JSONDecodeError, UnicodeError):
                yield lineno, {"_malformed_json": raw}
                continue
            if isinstance(rec, dict) and rec.get("_provenance_header"):
                continue
            yield lineno, rec


def normalize(rec):
    """Return (prompt, completion, code_blocks, schema) for a record.

    schema in {"shapes","messages","flat","malformed","unknown"}.
    prompt/completion are "" when the schema can't supply them.
    code_blocks is a list of raw code strings (may be empty).
    """
    if "_malformed_json" in rec:
        return "", "", [], "malformed"

    # A. shapes prototype
    if "instruction" in rec and "response" in rec and "shape" in rec:
        blocks = rec.get("code_blocks") or _fenced(rec.get("response", ""))
        return rec["instruction"], rec["response"], blocks, "shapes"

    # B. messages
    if isinstance(rec.get("messages"), list):
        msgs = rec["messages"]
        user = " ".join(m.get("content", "") for m in msgs if m.get("role") == "user")
        asst = " ".join(m.get("content", "") for m in msgs if m.get("role") == "assistant")
        blocks = _fenced(asst)
        if rec.get("_verified_output") is not None and not blocks:
            pass
        return user, asst, blocks, "messages"

    # C. flat instruction/output style
    p = rec.get("instruction") or rec.get("prompt") or rec.get("question") or ""
    c = (rec.get("output") or rec.get("response") or rec.get("completion")
         or rec.get("answer") or "")
    if p or c:
        blocks = rec.get("code_blocks") or _fenced(c) or _fenced(p)
        return p, c, blocks, "flat"

    # D. CPT text stream — pretraining substrate (cpt-stream, cpt-manifest,
    #    axis-*, code-fim, book-text, reference text). Single `text` field (or
    #    axis-tagged text). Not an SFT pair: no prompt side by design. Valid.
    txt = rec.get("text")
    if isinstance(txt, str) and txt.strip():
        return "", txt, _fenced(txt), "cpt"

    return "", "", [], "unknown"


def is_intentional_silent(rec):
    """True when an EMPTY completion is the intended target, not a missing label.

    The 'silent-if-trouble' safety persona (bucket `hacker-mode-silent`, task
    #105) teaches Motoi to say NOTHING for certain inputs — silence IS the
    lesson. Such records must not be counted as empty-completion defects.
    """
    if not isinstance(rec, dict):
        return False
    meta = rec.get("_meta")
    if isinstance(meta, dict) and "silent" in str(meta.get("bucket", "")).lower():
        return True
    return False


_FENCE_RE = re.compile(r"```(?:scheme|lisp|motoi|scm)?\s*\n(.*?)```", re.DOTALL)


def _fenced(text):
    if not text:
        return []
    return [m.strip() for m in _FENCE_RE.findall(text) if m.strip()]


def paren_balanced(code):
    """True if () [] balanced ignoring ; comments, "..." strings, #\\char, |...|.
    Returns (balanced_bool, depth_delta)."""
    depth = 0
    i, n = 0, len(code)
    in_str = False
    in_bar = False
    while i < n:
        ch = code[i]
        if in_str:
            if ch == "\\":
                i += 2
                continue
            if ch == '"':
                in_str = False
            i += 1
            continue
        if in_bar:
            if ch == "|":
                in_bar = False
            i += 1
            continue
        if ch == ";":
            while i < n and code[i] != "\n":
                i += 1
            continue
        if ch == '"':
            in_str = True
            i += 1
            continue
        if ch == "|":
            in_bar = True
            i += 1
            continue
        if ch == "#" and i + 1 < n and code[i + 1] == "\\":
            i += 3  # skip #\x char literal
            continue
        if ch in "([":
            depth += 1
        elif ch in ")]":
            depth -= 1
            if depth < 0:
                return False, depth
        i += 1
    return (depth == 0 and not in_str and not in_bar), depth


def looks_like_full_program(code):
    """Heuristic: a code block is runnable-as-program if it is a balanced
    top-level form (starts with '(' after trim) and not a bare fragment."""
    s = code.strip()
    if not s.startswith("("):
        return False
    bal, _ = paren_balanced(s)
    return bal


def find_lane_files(roots=None):
    """Return jsonl files that look like authored training pairs (not headers)."""
    if roots is None:
        roots = [REPO / "training-data",
                 Path.home() / ".forge" / "corpus" / "motoi-v8-partial",
                 REPO / "scratch" / "sft-plans"]
    files = []
    for r in roots:
        r = Path(r)
        if r.is_dir():
            files.extend(sorted(r.rglob("*.jsonl")))
        elif r.is_file() and r.suffix == ".jsonl":
            files.append(r)
    # skip Sakura mirrors + backups + sidecar index files (cpt-manifest is a
    # pointer-index for cpt-stream: doc_idx/axis/tier/word/provenance, no text —
    # metadata, not a training record).
    def _keep(f):
        n = f.name
        if ".bak" in n or n.startswith("sakura-"):
            return False
        if "manifest" in n.lower():
            return False
        # CPT pretraining substrate is NOT an SFT lane. It lives in a `cpt-*`
        # dir (e.g. training-data/cpt-mk2/: cpt-stream, axis-*, book-text,
        # code-fim, reference.jsonl). After the old SFT was archived, this dir
        # was the only thing left under training-data/, so find_lane_files was
        # scanning pretraining text as if it were training pairs and every
        # dashboard flag (emoji/excess-bang/leakage) was CPT content, not SFT.
        # Exclude by parent dir so no cpt file is ever discovered as a lane.
        # (Alfred, 2026-07-30. The fold is SFT-only; CPT was Mk3, done.)
        if any(part.lower().startswith("cpt-") or part.lower() == "cpt"
               for part in f.parts):
            return False
        # Held-out eval prompts (answer-less by design) must NOT enter the
        # training fold — training on the exam poisons the eval. Kept on disk
        # for evaluation; just not discovered as a training lane. (Alfred,
        # 2026-07-30.)
        if "eval" in n.lower():
            return False
        # Same reason for the held-out set: a `held-out/` dir or `heldout*`
        # file is the exam. `find_lane_files` filtered "eval" but NOT "held-out"
        # so heldout-2026-07-16.jsonl (990 rows) was silently training. Exclude
        # by filename OR parent-dir. Per-record held_out:true rows embedded in
        # OTHER lanes are caught by the fold_report held-out gate, not here.
        if "heldout" in n.lower() or "held-out" in n.lower():
            return False
        if any("held-out" in part.lower() or part.lower() == "held_out"
               for part in f.parts):
            return False
        return True
    return [f for f in files if _keep(f)]
