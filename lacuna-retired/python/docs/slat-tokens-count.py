# Counts tokens for each rendering with a Gemma tokenizer; prints totals and ratios against compact JSON.
import json, sys
from tokenizers import Tokenizer
tok = Tokenizer.from_file(sys.argv[1])
sets = json.load(open(sys.argv[2]))
print("tokenizer:", sys.argv[1].split("/bases/")[-1])
for name, s in sets.items():
    counts = {k: sum(len(tok.encode(t + "\n", add_special_tokens=False).ids) for t in v) for k, v in s.items() if isinstance(v, list)}
    base = counts["json-compact"]
    row = "  ".join(f"{k} {c} ({c / base:.2f}x)" for k, c in counts.items())
    print(f"{name} ({s['forms']} forms): {row}")
