#!/usr/bin/env python3
"""
migrate_sakura.py — deterministic Sakura->Motoi token migration over the Motoi
training corpus. Handles the UNAMBIGUOUS token classes only (identifiers, paths,
slugs, install commands, version strings, provenance/audience tags, dialect
fields, and the "Sakura Scheme" language name). Bare persona "Sakura" in prose is
left for contextual editing (a separate pass) — this script never blind-swaps a
lone capitalized "Sakura" in running prose, to avoid nonsense like
"Motoi is a language. Motoi is a language."

Ground-truth Motoi identity:
  binary        motoi
  version       v0.75  (0.75.0-beta)
  invocation    motoi run / motoi eval / motoi repl / motoi version
  repo          motoi-scheme  (github.com/Lacuna-Labs/motoi-scheme)
  install       curl -sSL https://raw.githubusercontent.com/Lacuna-Labs/motoi-scheme/main/install.sh | bash

Read/modify in place. Prints per-file change counts + grand total.
Run with --apply to write; default is dry-run (counts only).
"""
import os, re, sys, io

ROOT = "/Users/alfred/code/motoi-scheme"
CORPUS_DIRS = ["scheme-books", "graphs", "scheme", "words"]
EXTS = (".slat", ".slatl", ".md")
EXCLUDE_PARTS = ("/scratch/", "/_archive/", "/node_modules/", "/.git/")

APPLY = "--apply" in sys.argv

INSTALL = ("curl -sSL https://raw.githubusercontent.com/Lacuna-Labs/"
           "motoi-scheme/main/install.sh | bash")

# Ordered rules. Each is (compiled_regex, replacement). Order matters: most
# specific first. All operate line-agnostic (whole file text).
RULES = []
def rule(pat, repl, flags=0):
    RULES.append((re.compile(pat, flags), repl))

# --- install commands (before generic) -------------------------------------
rule(r'brew install lacuna-labs/tap/sakura-scheme', INSTALL)
rule(r'brew install [a-z-]+/tap/sakura-scheme', INSTALL)

# --- version strings adjacent to sakura ------------------------------------
rule(r'sakura-scheme\s+1\.4\.0', 'motoi v0.75')
rule(r'sakura-scheme\s+v?1\.[0-9]+(\.[0-9]+)?', 'motoi v0.75')
rule(r'sakura-scheme --version\s*(?:->|→)\s*1\.4\.0', 'motoi version -> v0.75')
rule(r'sakura-scheme --version', 'motoi version')

# --- uppercase doc-title / reference identifiers ---------------------------
rule(r'SAKURA-SCHEME-REFERENCE', 'MOTOI-SCHEME-REFERENCE')
rule(r'SAKURA-SCHEME-1\.0', 'MOTOI-SCHEME-1.0')
rule(r'SAKURA-SCHEME', 'MOTOI-SCHEME')

# --- book / slug / path compound identifiers -------------------------------
rule(r'sakura-scheme-book-chapter', 'motoi-scheme-book-chapter')
rule(r'sakura-scheme-book', 'motoi-scheme-book')
rule(r'sakura-scheme-reference-schema', 'motoi-scheme-reference-schema')
rule(r'sakura-scheme-reference', 'motoi-scheme-reference')
rule(r'sakura-scheme-tutorial', 'motoi-scheme-tutorial')
rule(r'sakura-scheme-repl', 'motoi-scheme-repl')
rule(r"sakura-scheme-s-extras", 'motoi-scheme-s-extras')
rule(r'sakura-scheme-is', 'motoi-scheme-is')
rule(r'sakura-scheme-design', 'motoi-scheme-design')

# --- sakura-scheme as a shell command (backtick or followed by a subcmd) ---
rule(r'`sakura-scheme`', '`motoi`')
rule(r'\bsakura-scheme\s+(run|eval|repl|fmt|version|test|help)\b', r'motoi \1')

# --- sakura-scheme as a path segment ---------------------------------------
rule(r'sakura-scheme/', 'motoi-scheme/')

# --- language name (two-word / hyphen, capitalized) ------------------------
rule(r'Sakura Scheme', 'Motoi Scheme')
rule(r'Sakura-Scheme', 'Motoi-Scheme')

# --- remaining bare compound `sakura-scheme` -> repo/lang id ----------------
rule(r'\bsakura-scheme\b', 'motoi-scheme')

# --- provenance / audience / metadata quoted tags --------------------------
# specific known tag tokens
for a, b in [
    ("sakura-training", "motoi-training"),
    ("sakura-teaching", "motoi-teaching"),
    ("sakura-canonical", "motoi-canonical"),
    ("sakura-substrate", "motoi-substrate"),
    ("sakura-primitive-registry", "motoi-primitive-registry"),
    ("sakura-policy", "motoi-policy"),
    ("sakura-corpus", "motoi-corpus"),
    ("sakura-training-notes", "motoi-training-notes"),
]:
    rule(r'"%s"' % a, '"%s"' % b)
# bare quoted "sakura" / "sakuras" tag -> "motoi"
rule(r'"sakuras?"', '"motoi"')

# --- dialect fields --------------------------------------------------------
rule(r':applies\s*\(\s*"motoi"\s+"sakura"\s*\)', ':applies ("motoi")')
rule(r':applies\s*\(\s*"sakura"\s+"motoi"\s*\)', ':applies ("motoi")')
rule(r':dialect(\s+)"sakura"', r':dialect\1"motoi"')

def is_target(path):
    if not path.endswith(EXTS):
        return False
    p = "/" + path.replace(ROOT + "/", "")
    return not any(x in path for x in EXCLUDE_PARTS)

def main():
    total = 0
    changed_files = 0
    residual_files = {}
    for d in CORPUS_DIRS:
        base = os.path.join(ROOT, d)
        for dp, _, fs in os.walk(base):
            if any(x.strip("/") in dp.split(os.sep) for x in ("scratch", "_archive", "node_modules", ".git")):
                continue
            for fn in fs:
                path = os.path.join(dp, fn)
                if not is_target(path):
                    continue
                with io.open(path, encoding="utf-8", errors="replace") as f:
                    text = f.read()
                orig = text
                n = 0
                for rx, repl in RULES:
                    text, k = rx.subn(repl, text)
                    n += k
                if n:
                    total += n
                    changed_files += 1
                    if APPLY:
                        with io.open(path, "w", encoding="utf-8") as f:
                            f.write(text)
                # residual bare sakura after rules
                res = len(re.findall(r'sakura', text, re.IGNORECASE))
                if res:
                    residual_files[path.replace(ROOT + "/", "")] = res
    print(f"{'APPLIED' if APPLY else 'DRY-RUN'}: {total} substitutions across {changed_files} files")
    print(f"residual files still containing 'sakura' (any case): {len(residual_files)}")
    tot_res = sum(residual_files.values())
    print(f"residual 'sakura' occurrences: {tot_res}")
    for p, c in sorted(residual_files.items(), key=lambda kv: -kv[1])[:40]:
        print(f"   {c:4}  {p}")

if __name__ == "__main__":
    main()
