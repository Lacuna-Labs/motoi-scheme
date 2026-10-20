#!/usr/bin/env python3
"""
Pass 2 — cleanup + guarded persona-prose swap.

1. Collapse dialect defaults: :applies ("motoi" "motoi") -> ("motoi"); rewrite
   the boilerplate dialect :note to a Motoi-only note.
2. Remaining unquoted identifier tags sakura-<id> -> motoi-<id> (a fixed list).
3. Guarded persona-prose swap: on any line in a NON-graph corpus file that does
   NOT already contain "motoi" (case-insensitive) and does NOT contain a
   "sakura/" namespaced verb, replace the standalone word Sakura/sakura (incl.
   possessive) with Motoi/motoi, case-preserved. Lines that mention motoi are
   left untouched (they are contrast lines -> handled by hand).

Graphs are excluded entirely (concept-node surgery is separate).
Run with --apply to write; default dry-run.
"""
import os, re, sys, io

ROOT = "/Users/alfred/code/motoi-scheme"
CORPUS_DIRS = ["scheme-books", "scheme", "words"]   # graphs handled separately
EXTS = (".slat", ".slatl", ".md")
APPLY = "--apply" in sys.argv

DIALECT_NOTE = ('(dialect :applies ("motoi") '
                ':note "Applies to Motoi. Per-record :dialect overrides where a '
                'record is specific to one surface.")')

IDENT_TAGS = [
    "sakura-teaching", "sakura-canonical", "sakura-token", "sakura-endpoint",
    "sakura-substrate", "sakura-emergency-canonical", "sakura-preservation",
    "sakura-training-manual", "sakura-reasoning-routes", "sakura-corpus",
    "sakura-persona", "sakura-parallel", "sakura-community", "sakura-cart",
    "sakura-arm", "sakura-mention", "sakura-dialect", "sakura-training",
    "sakura-model", "sakura-side", "sakura-team", "sakura-thread",
    "sakura-voice-persona", "sakura-l1", "sakura-verified-phase",
]

APPLIES_RE = re.compile(r'\(dialect :applies \("motoi" "motoi"\)[^\n]*?\)\s*$', re.M)
# fallback simpler collapse if the note text differs
APPLIES2_RE = re.compile(r':applies \("motoi" "motoi"\)')

WORD_RE = re.compile(r'\b([Ss])akura\b')

def has_verb_ns(line):
    return bool(re.search(r'sakura/', line))

def swap_word(line):
    def repl(m):
        return ("M" if m.group(1) == "S" else "m") + "otoi"
    return WORD_RE.sub(repl, line)

def process(text):
    n = 0
    # 1. dialect collapse
    text, k = APPLIES_RE.subn(DIALECT_NOTE, text); n += k
    text, k = APPLIES2_RE.subn(':applies ("motoi")', text); n += k
    # 2. identifier tags (quoted or unquoted)
    for t in IDENT_TAGS:
        m = t.replace("sakura", "motoi")
        text, k = re.subn(re.escape(t), m, text); n += k
    # 3. guarded persona-prose swap, per line
    out = []
    for line in text.split("\n"):
        if "sakura" in line.lower() and "motoi" not in line.lower() and not has_verb_ns(line):
            new = swap_word(line)
            if new != line:
                n += len(WORD_RE.findall(line))
            out.append(new)
        else:
            out.append(line)
    text = "\n".join(out)
    return text, n

def main():
    total = 0; changed = 0
    for d in CORPUS_DIRS:
        for dp, _, fs in os.walk(os.path.join(ROOT, d)):
            if any(x in dp for x in ("/scratch", "/_archive", "/node_modules", "/.git")):
                continue
            for fn in fs:
                if not fn.endswith(EXTS):
                    continue
                p = os.path.join(dp, fn)
                with io.open(p, encoding="utf-8", errors="replace") as f:
                    text = f.read()
                new, n = process(text)
                if n and new != text:
                    total += n; changed += 1
                    if APPLY:
                        with io.open(p, "w", encoding="utf-8") as f:
                            f.write(new)
    print(f"{'APPLIED' if APPLY else 'DRY-RUN'} pass2: {total} changes across {changed} files")

if __name__ == "__main__":
    main()
