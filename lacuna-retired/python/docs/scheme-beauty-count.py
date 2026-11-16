# Counts tokens for each comparison with the Gemma 3 1B tokenizer.
import json, sys
from tokenizers import Tokenizer
tok = Tokenizer.from_file(sys.argv[1]); d = json.load(open(sys.argv[2]))
n = lambda s: len(tok.encode(s, add_special_tokens=False).ids)
a = sum(n(x + "\n") for x in d["log"]["today"]); b = sum(n(x + "\n") for x in d["log"]["proposed"])
print(f"log: {d['log']['n']} lines; today {a} tokens; proposed {b} ({(b - a) / a * 100:+.1f} %); stage duplicated the line in {d['log']['dupStage']}")
c = sum(n(x) for x in d["carts"]["comments"]); h = sum(n(x) for x in d["carts"]["headers"])
print(f"carts: {d['carts']['n']}; leading comment blocks {c} tokens over {d['carts']['commentLines']} lines; header forms {h} tokens")
for x, y in d["pairs"]:
    print(f"  {n(x):3d} -> {n(y):3d}  {x[:70]}  =>  {y[:60]}")
