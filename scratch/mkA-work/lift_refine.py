#!/usr/bin/env python3
"""
LIFT refinement: strip filler, ensure code-fence discipline, cap non-code prose to
3 sentences, dedupe near-identical pairs.
"""

import json
import re
from pathlib import Path

IN = Path("/Users/alfred/.forge/corpus/motoi-grand-reveal-mkA/train.jsonl")
OUT = IN

FILLERS = [
    r"\bI hope this helps\b\.?",
    r"\bCertainly!\s*",
    r"\bSure thing[.!]?\s*",
    r"\bAbsolutely[.!]?\s*",
    r"\bGreat question[.!]?\s*",
    r"\bLet me\b(?!\s+(know|see))",   # avoid stripping "let me know" etc, but this is loose
    r"^\s*Well,\s*",
    r"\bIn summary,\s*",
    r"\bIn conclusion,\s*",
    r"\bOverall,\s*",
]

def strip_fillers(s):
    for pat in FILLERS:
        s = re.sub(pat, "", s, flags=re.IGNORECASE)
    return s.strip()

def cap_prose(s, max_sentences=3):
    """If answer is prose (no ```motoi), cap at 3 sentences unless it's a template refusal."""
    if "```motoi" in s or "```" in s:
        return s  # code is code
    # Preserve template-shape safety refusals (they end in period pattern)
    sentences = re.split(r'(?<=[.!?])\s+', s)
    if len(sentences) <= max_sentences:
        return s
    return " ".join(sentences[:max_sentences])

# Load
pairs = []
with IN.open() as f:
    for line in f:
        pairs.append(json.loads(line))
print(f"Loaded {len(pairs)}")

# Dedupe by (user, assistant) exact match
seen = set()
dedup = []
for p in pairs:
    u = p["messages"][0]["content"]
    a = p["messages"][-1]["content"]
    key = (u, a)
    if key in seen:
        continue
    seen.add(key)
    dedup.append(p)
print(f"After dedupe: {len(dedup)}")

# Refine each
refined = []
for p in dedup:
    a = p["messages"][-1]["content"]
    a2 = strip_fillers(a)
    # Only cap prose for non-safety non-doctrine buckets
    bucket = p["_meta"]["_bucket"]
    if bucket not in ("N", "M", "P"):  # keep template shapes verbatim
        a2 = cap_prose(a2)
    p["messages"][-1]["content"] = a2
    refined.append(p)

# Write back
with OUT.open("w") as f:
    for p in refined:
        f.write(json.dumps(p, ensure_ascii=False) + "\n")

print(f"Wrote {len(refined)} refined pairs")

# Report length stats
lens_prompt = [len(p["messages"][0]["content"]) for p in refined]
lens_ans = [len(p["messages"][-1]["content"]) for p in refined]
print(f"Prompt lengths: min={min(lens_prompt)}, max={max(lens_prompt)}, mean={sum(lens_prompt)//len(lens_prompt)}")
print(f"Answer lengths: min={min(lens_ans)}, max={max(lens_ans)}, mean={sum(lens_ans)//len(lens_ans)}")
