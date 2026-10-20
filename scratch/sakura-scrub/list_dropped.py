#!/usr/bin/env python3
"""List every record the Sakura guard would drop, with source-identifying context."""
import re, sys
from pathlib import Path

HERE = Path(__file__).resolve()
CPT_PREP = HERE.parents[2] / "scripts" / "cpt-prep"
sys.path.insert(0, str(CPT_PREP))

import emit_cpt_v5 as E

_RE = re.compile(r'sakura', re.IGNORECASE)

dropped = []
for tag, fn in E.EMITTERS:
    for r in fn():
        txt = r.get("text", "")
        if _RE.search(txt):
            dropped.append((tag, r.get("type", "?"), r.get("shape", "?"),
                            r.get("substrate", "?"), txt))

print(f"TOTAL DROPPED: {len(dropped)}\n")
from collections import Counter
by_tag = Counter(t for t, *_ in dropped)
print("by emitter:", dict(by_tag), "\n")
for i, (tag, typ, shape, sub, txt) in enumerate(dropped):
    # show the sakura hits in context
    hits = [m.start() for m in _RE.finditer(txt)]
    ctxs = []
    for h in hits[:4]:
        ctxs.append(txt[max(0, h-40):h+46].replace("\n", "⏎"))
    print(f"[{i:03d}] tag={tag} type={typ} shape={shape} sub={sub} hits={len(hits)}")
    for c in ctxs:
        print(f"       …{c}…")
    print()
