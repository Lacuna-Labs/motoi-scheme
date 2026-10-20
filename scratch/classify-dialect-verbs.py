#!/usr/bin/env python3
# Classify every reference verb :name into Motoi-native vs Curator-dialect.
# Two-stage: broad dialect regex, minus an explicit NATIVE allowlist for real
# math/stdlib names the broad regex catches as false positives.
# Usage: python3 scratch/classify-dialect-verbs.py
import re, os, glob, collections

REF_DIR = os.path.join(os.path.dirname(__file__), '..', 'scheme', 'reference')

# Curator-dialect tells: stateful audio/game-loop/graphics/UI/input/entity vocab
# that belongs in a consumer repo, not Motoi's dialect-neutral reference.
DIALECT = re.compile(
    r'audio|beat|frame|camera|paint|sprite|\bcard|scene|surface|\bentity/|'
    r'\bmotion/|sound|\bfx\b|anim|render|blit|\bdraw|canvas|\bgame/|arc-between|'
    r'in-formation|on-key|on-frame|on-message|on-event|register-tick|spawn|'
    r'\bfb/|\bui/|\binput/|\bworld/|player|tile|tween|dot-|to-draw',
    re.I)

# Names the broad regex flags but which are REAL math / R7RS / stdlib (native).
NATIVE_ALLOW = set()
NATIVE_RE = re.compile(
    r'identity$|'                       # identity, alg/identity, alg/perm-identity
    r'input-string|input-port|input-from-string|'  # R7RS string ports
    r'game/nim|game/grundy|game/mex|game/surreal|game/temperature|'
    r'game/wythoff|game/star-n|game/to-real|game/ttt|'  # combinatorial game theory
    r'easing/|'                         # easing curves = real functions
    r'surface-integral|surface-revolution|surface-graph|surface-normal|'
    r'surface$|cone-surface|cylinder-surface|sphere-surface|frenet-frame|'  # diff geom
    r'angle-between',                   # geometry
    re.I)

NAME_RE = re.compile(r':name\s+"([^"]+)"')

def is_dialect(n):
    return bool(DIALECT.search(n)) and not NATIVE_RE.search(n)

per_chapter = collections.OrderedDict()
dialect_names = collections.OrderedDict()

for path in sorted(glob.glob(os.path.join(REF_DIR, '*.slat'))):
    ch = os.path.basename(path)
    with open(path, encoding='utf-8') as f:
        names = NAME_RE.findall(f.read())
    d = [n for n in names if is_dialect(n)]
    per_chapter[ch] = (len(names), len(d))
    if d:
        dialect_names[ch] = d

tot_all = tot_d = 0
print(f"{'chapter':24} {'verbs':>6} {'dialect':>8}")
for ch, (a, d) in per_chapter.items():
    tot_all += a; tot_d += d
    if d:
        print(f"{ch:24} {a:6} {d:8}")
print(f"\nTOTAL verbs={tot_all}  true-dialect={tot_d}  native={tot_all-tot_d}")
print("\n=== true-dialect verb names per chapter ===")
for ch, d in dialect_names.items():
    print(f"\n--- {ch} ({len(d)}) ---")
    print("  " + "  ".join(sorted(set(d))))
