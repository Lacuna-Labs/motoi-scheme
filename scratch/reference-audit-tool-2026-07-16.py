#!/usr/bin/env python3
"""
Reference audit tool — 2026-07-16.

Reads scheme-lang/docs/SAKURA-SCHEME-REFERENCE.slat, extracts every verb
record, classifies it (MOTOI-BASE / SAKURA-DIALECT / LACUNA-DIALECT /
AMBIGUOUS), and produces three artifacts:

  1. scratch/reference-audit-2026-07-16.slat
     Full classification, one record per verb.

  2. scheme/MOTOI-SCHEME-REFERENCE.slat (rewritten)
     Motoi-only subset — MOTOI-BASE verbs plus core forms.

  3. scratch/reference-runtime-gap-2026-07-16.slat
     MOTOI-BASE verbs the reference documents that Motoi runtime
     does NOT actually implement today (Pass-3 Wave 1 fix-targets).
"""
import re
import sys
from pathlib import Path

REF = Path("/Users/alfred/code/scheme-lang/docs/SAKURA-SCHEME-REFERENCE.slat")
AUDIT_OUT = Path("/Users/alfred/code/motoi-scheme/scratch/reference-audit-2026-07-16.slat")
MOTOI_OUT = Path("/Users/alfred/code/motoi-scheme/scheme/MOTOI-SCHEME-REFERENCE.slat")
GAP_OUT = Path("/Users/alfred/code/motoi-scheme/scratch/reference-runtime-gap-2026-07-16.slat")

# --- runtime-verb ground truth (parsed from motoi-scheme/src/) ---
MOTOI_RUNTIME_BASE = set()  # filled below
MOTOI_RUNTIME_SLAT = {
    'slat-loads', 'slat-load', 'slat-load-doc',
    'slat-dumps', 'slat-dump', 'slat-dump-doc',
    'slat-read', 'slat-write', 'slat-key',
}

def load_runtime_verbs():
    base_file = Path("/Users/alfred/code/motoi-scheme/src/base.js")
    text = base_file.read_text()
    for m in re.finditer(r"def\('([^']+)'", text):
        MOTOI_RUNTIME_BASE.add(m.group(1))

load_runtime_verbs()
MOTOI_RUNTIME = MOTOI_RUNTIME_BASE | MOTOI_RUNTIME_SLAT

# --- verb classification rules ---
#
# Alfred policy:
#   Motoi = base language. R7RS-flavored core + framebuffer + sprite +
#   animation + sound + audio-driver + game + media + ai-light + system +
#   adapters + alg + macros + dispatch + slat + cortex + ops + topo + eng.
#
#   Sakura = proprietary/commercial dialect: card/*, shop/*, shoppe/*,
#   cine/*, flower/*, afford/*, ai-sidecar-*, radio-*, Sakura-only sprites.
#
#   Lacuna = SRE dialect: sys/*, net/*, docker/*, deploy/*.
#
# The library field is the primary signal. Verb-name prefixes and
# individual verb names refine (some libraries are mixed).

# Libraries that are FLATLY Motoi base (no per-verb filtering):
MOTOI_LIBRARIES = {
    # numeric / math / stats / algorithms — pure computation
    'alg', 'calc', 'math', 'const', 'exact', 'complex', 'stat', 'comb',
    'linalg', 'matrix', 'vec', 'num', 'sym', 'solve', 'geom', 'curve',
    'plot', 'chem', 'nt',  # nt = number theory: pure Motoi math
    # world / physics / animation / sprite / entity / game — engine
    'animation', 'phys', 'part', 'sprite', 'entity', 'game', 'world',
    'grid', 'motion', 'collision', 'group', 'juggle', 'seq', 'tick',
    'scene', 'surface', 'time', 'pattern', 'transport', 'weather',
    'floor', 'route', 'domain', 'text', 'prefab', 'object', 'topo',
    # audio / music
    'audio', 'synth', 'note', 'beat',
    # meta / infra — Motoi native
    'base', 'core', 'ops', 'eng', 'input', 'system',
    # cortex — first-class per Alfred directive
    'cortex',
    # ai — mostly steering/behavior (Motoi); LLM-flavored records have a
    # separate library string ("ai — semantic / LLM surface") we treat
    # per-verb below
    'ai',
    # artifact — Motoi engine-side spawn/subscribe surface
    'artifact',
}

# Libraries that are FLATLY Sakura dialect:
SAKURA_LIBRARIES = {
    'card', 'shoppe', 'cine', 'flower', 'afford', 'radio',
    'need', 'think', 'ask', 'cadence',  # cart-workflow verbs
}

# There are no explicit Lacuna libraries in this reference; Lacuna
# lives in sys/net/docker/deploy prefixes that would exist under
# various library groupings.

# Verb-name prefix rules (namespace before /):
SAKURA_PREFIXES = {
    'card', 'shop', 'shoppe', 'cine', 'flower', 'afford', 'radio',
    'need', 'think', 'ask', 'cadence', 'act', 'ai-sidecar',
}
LACUNA_PREFIXES = {
    'sys', 'net', 'docker', 'deploy', 'sre', 'ops-sre',
}

# Individual verb-name overrides — the ai-semantic LLM verbs are
# Sakura-dialect (external LLM API surface, not local Motoi):
AI_SEMANTIC_SAKURA = {
    'ai/generate', 'ai/summarize', 'ai/translate', 'ai/classify',
    'ai/rerank', 'ai/rank', 'ai/embed', 'ai/vector-search',
    # policy verbs that call external policy service
    'ai/policy', 'ai/policy-act',
}

# artifact verbs that bind Sakura-specific external subscriptions:
ARTIFACT_SAKURA = {
    'artifact/subscribe-cortex',  # cortex-side subscription — Sakura wiring
}

# Core-library verbs are a mixed bag. Rules to filter Sakura-flavored
# ones OUT of Motoi. Pattern-based because the reference has ~322 core
# verbs and re-namespacing them is a separate project.
def core_is_sakura(name):
    """True if a core-library verb belongs in Sakura dialect."""
    # Card system — Sakura Curator's card/desk metaphor
    if name.startswith('card-') or name in {'cards-list', 'flip-card', 'fold-card',
        'move-card', 'orient-card', 'rotate-card', 'scale-card', 'define-card'}:
        return True
    # App/system — Sakura AppStore surface
    if name.startswith('app-') or name in {'define-app', 'system/cards',
        'system/registry', 'system/scheduler', 'system/health', 'system/surface'}:
        return True
    # Camera-to-card follow verbs (Sakura Curator only)
    if name == 'camera-zoom-to-card':
        return True
    # Shop / listings / inventory / commerce
    if name in {'add-shop', 'set-active-shop', 'store-listing-republish',
        'store-listing-set-price', 'create-listing-from', 'receive-listing',
        'release-listing', 'unpublish-listing', 'read-inventory',
        'set-inventory', 'set-free-shipping-threshold', 'set-shipping-profile',
        'set-processing-time', 'set-vacation-mode', 'read-open-returns'}:
        return True
    # Podcast surface — Sakura Radio
    if name.startswith('podcast-'):
        return True
    # Radio surface (in core-library)
    if name.startswith('radio-'):
        return True
    # Cortex/desktop/gmail readers — Sakura sidecar
    if name in {'read-desktop-text', 'read-gmail-folder', 'read-inbox'}:
        return True
    # Conway soup — Sakura Curator specific installation
    if name.startswith('conway-'):
        return True
    # Canvas game — Sakura Curator specific
    if name.startswith('canvas-'):
        return True
    # Emoji sprite work — Sakura Curator sprites
    if name.startswith('emoji-'):
        return True
    # Coin/reward — Sakura Curator UX
    if name in {'coin-emit', 'paint-coin'}:
        return True
    # Bricklay layout — Curator layout kernel
    if name in {'layout-bricklay!'}:
        return True
    # Fleet / character / summon — Curator game
    if name in {'fleet-do', 'fleet-each', 'summon', 'make-character',
        'walk-cycle', 'walk-together', 'in-formation', 'eye-contact'}:
        return True
    # Sway/spotlight/curtain/paper/dim/dusk/paint-dots — Curator surface UX
    if name.startswith('surface-') and name not in {'surface-exists?'}:
        return True
    # Bit-level cellular automata paint helpers — Curator game
    if name.startswith('paint-grid') or name in {'paint-cell', 'paint-conway',
        'paint-grid'}:
        return True
    # SVG/emoji/where-to-click UX — Curator
    if name in {'svg-set', 'where-to-click', 'zoom-legible?', 'rasterize-text',
        'sway!', 'nav-map', 'imagine', 'invariants'}:
        return True
    # Cart-workflow — Sakura action/plan surface
    if name in {'act', 'next', 'escalate', 'submit', 'done', 'hand-off',
        'check-with', 'interrupted', 'age-layer'}:
        return True
    # Big-bang / to-draw / on-key / on-tick — HtDP surface, Motoi keeps
    # these are actually Motoi (teaching interactive shape)
    # button / form — Curator UI kernel (Sakura dialect)
    if name.startswith('button') or name in {'button', 'button-list',
        'button-of', 'define-button'}:
        return True
    if name.startswith('form') and name in {'form', 'form-group',
        'form-list', 'form-of', 'define-form'}:
        return True
    # list-item toss/pluck — Curator UI
    if name in {'list-item-pluck', 'list-item-toss'}:
        return True
    # Anomaly, audit, register-tick — Curator ops
    if name in {'anomaly-recent', 'audit-verify', 'register-tick'}:
        return True
    # obj-get — Curator DOM shim
    if name == 'obj-get':
        return True
    # transfer — Sakura wallet
    if name == 'transfer':
        return True
    return False

# Genuinely borderline core-library verbs — deliberately left AMBIGUOUS
# for Alfred to arbitrate. If Alfred rules "Motoi", promote out of this
# set into MOTOI-BASE default in a follow-up pass.
# Core-form (special-form) classification. The 70 records mix R7RS
# special forms, drawing primitives, and Sakura cart-workflow verbs.
CORE_FORM_MOTOI = {
    # R7RS special forms
    'and', 'begin', 'if', 'not', 'or', 'set!', 'unless', 'when',
    # standard list/prim library exposed as forms
    'append', 'assoc', 'car', 'cdr', 'cons', 'filter', 'for-each',
    'length', 'list', 'map', 'member', 'range', 'reduce', 'reverse',
    'abs', 'clamp', 'expt', 'floor', 'lerp', 'mean', 'modulo',
    'sqrt', 'sum',
    # after — motoi timing primitive (used in on-frame / on-tick)
    'after',
    # sprite / sprites — Motoi drawing primitives
    'sprite', 'sprites',
    # drawing primitives — Motoi framebuffer
    'paint-arrow', 'paint-burst', 'paint-clear', 'paint-emoji',
    'paint-fireworks', 'paint-flow', 'paint-glow', 'paint-heart',
    'paint-highlight', 'paint-grid', 'paint-marquee',
    'paint-point-at', 'paint-spiral', 'paint-text',
    # music primitives
    'note', 'note-place', 'note-dots', 'staff-lines', 'tempo',
}
CORE_FORM_SAKURA = {
    # cart workflow
    'act', 'ctx-get', 'ctx-set', 'ctx-result', 'done', 'escalate', 'next',
    # etsy — corporate, MUST NOT be in Motoi
    'etsy/listings', 'etsy/receipts',
    # card system — Sakura Curator
    'card-do', 'card-emit', 'card-ask',
    'transfer', 'summon', 'scene/conveyor',
    # Curator UX motion
    'carry', 'dance',
}

CORE_AMBIGUOUS = {
    # UI form kernel — could be Motoi generic or Sakura Curator UI
    'field', 'form', 'define-form',
    # cart-context — could be Motoi generic context or Sakura workflow
    'ctx-get', 'ctx-set', 'ctx-result',
    # apply-markdown — could be Motoi text or Sakura Curator UI
    'apply-markdown',
    # analog-pad — sidecar hardware or Motoi input?
    'analog-pad',
    # animation-* — reflow policy sounds like Sakura Curator layout
    'animation-budget', 'animation-reflow-policy',
    'animation-set-reflow-policy',
    # dot-* — Curator UI dots or generic drawing?
    'dot-count', 'set-dot-alpha', 'set-dot-color', 'set-dot-radius',
    # rule-conway — Conway soup ties, but 'rule' verb generic?
    'rule-conway',
    # motion-* — could be Motoi motion or Sakura Curator card motion
    'motion-anchor-to-input', 'motion-follow-input',
    'motion-halt', 'motion-move-to',
    # tempo / at-beat / across-beats / land-on-downbeat / sub-position-per-beat
    # — could be Motoi music-clock or Sakura Radio
    # (I'll classify these as MOTOI since they're general-audio)
}

# game/*-library verbs — mostly Motoi (game theory: Nim, Grundy, etc.)
def game_is_sakura(name):
    return False  # game/* in reference is combinatorial game theory, all Motoi

# entity/* — Motoi ECS core
def entity_is_sakura(name):
    return False

# audio/* — Motoi audio engine (audio/play etc.)
def audio_is_sakura(name):
    return False

# artifact/* — mostly Motoi except subscribe-cortex
def artifact_is_sakura(name):
    return name in ARTIFACT_SAKURA

# ops/*-library — Operations Research (dijkstra, knapsack, EOQ). All Motoi.
def ops_is_sakura(name):
    return False

# eng/* — engineering (statics, beam reactions, Bode). All Motoi.
def eng_is_sakura(name):
    return False

# topo/* — algebraic topology. All Motoi.
def topo_is_sakura(name):
    return False

# input/* — Motoi input abstraction. All Motoi.
def input_is_sakura(name):
    return False

def classify_verb(name, library):
    """Return one of MOTOI-BASE / SAKURA-DIALECT / LACUNA-DIALECT / AMBIGUOUS."""
    # 1. Explicit overrides first
    if name in AI_SEMANTIC_SAKURA:
        return 'SAKURA-DIALECT'
    if name in ARTIFACT_SAKURA:
        return 'SAKURA-DIALECT'

    # 2. Namespace prefix (verb/foo → prefix "verb")
    if '/' in name:
        prefix = name.split('/', 1)[0]
        if prefix in LACUNA_PREFIXES:
            return 'LACUNA-DIALECT'
        if prefix in SAKURA_PREFIXES:
            return 'SAKURA-DIALECT'

    # 3. Core library gets per-verb filtering — heavily mixed
    if library == 'core':
        if core_is_sakura(name):
            return 'SAKURA-DIALECT'
        if name in CORE_AMBIGUOUS:
            return 'AMBIGUOUS'
        return 'MOTOI-BASE'

    # 4. Library-level classification
    if library in SAKURA_LIBRARIES:
        return 'SAKURA-DIALECT'
    # The 'ai — semantic / LLM surface' library string:
    if library and library.startswith('ai') and 'LLM' in library:
        return 'SAKURA-DIALECT'
    if library in MOTOI_LIBRARIES:
        return 'MOTOI-BASE'

    # 5. Unknown library — flag for review
    return 'AMBIGUOUS'


# --- SLAT parser (top-level form splitter) -----------------------
def split_forms(text):
    """Yield each top-level parenthesized form in text, preserving
    exact whitespace between them via a running index."""
    i = 0
    n = len(text)
    while i < n:
        # skip whitespace & comment lines outside forms
        while i < n and text[i] != '(':
            i += 1
        if i >= n:
            break
        start = i
        depth = 0
        in_str = False
        while i < n:
            c = text[i]
            if in_str:
                if c == '\\':
                    i += 2
                    continue
                if c == '"':
                    in_str = False
            else:
                if c == '"':
                    in_str = True
                elif c == '(':
                    depth += 1
                elif c == ')':
                    depth -= 1
                    if depth == 0:
                        i += 1
                        yield start, i, text[start:i]
                        break
            i += 1


def find_field(form, field):
    """Extract the string value of a `:field "value"` from a form."""
    pattern = rf':{re.escape(field)}\s+"((?:[^"\\]|\\.)*)"'
    m = re.search(pattern, form)
    return m.group(1) if m else None


# --- main ---------------------------------------------------------
def main():
    text = REF.read_text()
    verbs = []
    core_forms = []
    for start, end, form in split_forms(text):
        if form.startswith('(verb'):
            name = find_field(form, 'name')
            library = find_field(form, 'library')
            if not name:
                continue
            cls = classify_verb(name, library or '')
            verbs.append({
                'name': name,
                'library': library or '',
                'class': cls,
                'form': form,
                'start': start,
                'end': end,
            })
        elif form.startswith('(core-form'):
            core_forms.append({
                'name': find_field(form, 'name') or '',
                'form': form,
                'start': start,
                'end': end,
            })

    # summary
    by_class = {}
    for v in verbs:
        by_class.setdefault(v['class'], []).append(v)
    print(f"Total verb records: {len(verbs)}")
    for k, vs in sorted(by_class.items()):
        print(f"  {k}: {len(vs)}")

    # --- Deliverable 1: audit slat -------------------------------
    audit_lines = [
        "; Reference audit — 2026-07-16",
        "; Full classification of every verb record in",
        "; scheme-lang/docs/SAKURA-SCHEME-REFERENCE.slat",
        ";",
        "; Classes:",
        ";   MOTOI-BASE     — belongs in Motoi (base language)",
        ";   SAKURA-DIALECT — Sakura proprietary (card/shop/cine/flower/etc.)",
        ";   LACUNA-DIALECT — SRE (sys/net/docker/deploy)",
        ";   AMBIGUOUS      — needs Alfred review",
        ";",
        f"; Auditor: The Engineer",
        f"; Source lines: {sum(1 for _ in open(REF))}",
        f"; Total verb records: {len(verbs)}",
        "",
        "(audit",
        '  :source "scheme-lang/docs/SAKURA-SCHEME-REFERENCE.slat"',
        '  :date "2026-07-16"',
        '  :auditor "The Engineer"',
        f'  :verb-count {len(verbs)}',
        f'  :motoi-base-count {len(by_class.get("MOTOI-BASE", []))}',
        f'  :sakura-dialect-count {len(by_class.get("SAKURA-DIALECT", []))}',
        f'  :lacuna-dialect-count {len(by_class.get("LACUNA-DIALECT", []))}',
        f'  :ambiguous-count {len(by_class.get("AMBIGUOUS", []))}',
        '  :provenance "reference-audit-tool-2026-07-16.py")',
        '',
        '; ── VERB CLASSIFICATIONS ──',
        '',
    ]
    for v in verbs:
        # escape any quotes in name (there shouldn't be any but defensive)
        n = v['name'].replace('"', '\\"')
        l = v['library'].replace('"', '\\"')
        audit_lines.append(
            f'(classify :name "{n}" :library "{l}" :class :{v["class"]})'
        )
    AUDIT_OUT.write_text('\n'.join(audit_lines) + '\n')
    print(f"Wrote {AUDIT_OUT}")

    # --- Deliverable 2: motoi-only reference ---------------------
    # Preserve everything before the first (verb ...) — that's the header
    # and (reference ...) metadata + prologue comments.
    first_verb_start = min(v['start'] for v in verbs)
    header_text = text[:first_verb_start]

    # Rewrite the header preamble
    n_motoi = len(by_class.get('MOTOI-BASE', []))
    n_sakura = len(by_class.get('SAKURA-DIALECT', []))
    n_lacuna = len(by_class.get('LACUNA-DIALECT', []))
    n_amb = len(by_class.get('AMBIGUOUS', []))
    motoi_header = f"""(dialect :applies ("motoi") :note "Motoi-only filtered reference. Every verb documented here IS or WILL BE in the Motoi runtime after Pass-3 Wave 1 migration lands. Sakura-dialect and Lacuna-dialect verbs are documented separately in their respective repos.")

; Motoi Scheme Reference — FILTERED FROM SAKURA REFERENCE
; Filtered 2026-07-16 by The Engineer.
; Source: scheme-lang/docs/SAKURA-SCHEME-REFERENCE.slat (1,217 verb records + 70 core-forms)
; This file: {n_motoi} MOTOI-BASE verbs + Motoi core language forms
;
; This IS the Motoi language. Everything derives from it.
; When code and reference disagree, reference wins.
;
; What was filtered OUT (see scratch/reference-audit-2026-07-16.slat):
;   * SAKURA-DIALECT ({n_sakura} verbs) — card/*, shop/*, cine/*, flower/*, afford/*,
;     radio/*, cadence/*, need/*, think/*, ask/*, ai-sidecar/*, ai/generate,
;     ai/summarize, ai/translate, ai/classify, ai/rerank, ai/rank, ai/embed,
;     ai/vector-search, ai/policy*, artifact/subscribe-cortex, and 240+
;     core-namespace Curator verbs (card-*, podcast-*, app-*, canvas-*,
;     conway-*, emoji-*, shop/listing/inventory/vacation/shipping verbs).
;     Etsy corporate namespace filtered out. Card system filtered out.
;   * LACUNA-DIALECT ({n_lacuna} verbs) — sys/*, net/*, docker/*, deploy/*
;   * AMBIGUOUS ({n_amb} verbs) — flagged for Alfred review, NOT included here.
;     Candidates: field / form / define-form (UI form kernel?); ctx-get/set/result
;     (cart-workflow?); apply-markdown; analog-pad; animation-budget / reflow-policy;
;     motion-* (Motoi motion or Sakura card-motion?); dot-* helpers.
;
; Cortex verbs ARE included per Alfred's directive (Cortex stays in Motoi).
; No corporate names. No Etsy/eBay/Shopify/Meta.
;
; Runtime gap: many verbs documented here are NOT yet in motoi-scheme/src/.
;   See scratch/reference-runtime-gap-2026-07-16.slat for the fix-targets —
;   Pass-3 Wave 1 migration. Runtime today = ~126 verbs; reference documents
;   {n_motoi}. The gap is what Pass-3 must fill.

(reference
  :name "motoi-scheme"
  :version "1.0-filtered"
  :consolidated-at "2026-07-14"
  :filtered-at "2026-07-16"
  :filter-source "scheme-lang/docs/SAKURA-SCHEME-REFERENCE.slat"
  :verb-count {n_motoi}
  :audience ("motoi-runtime-authors" "sakura-training" "kid-readers" "operator-scriptors")
  :provenance "reference-audit-tool-2026-07-16.py"
  :training-eligible #t
  :confidentiality "public"
  :dialect "motoi"
)

; ── VERBS ──
"""

    # Group Motoi verbs by library, preserving library headers
    motoi_verbs = [v for v in verbs if v['class'] == 'MOTOI-BASE']
    by_lib = {}
    for v in motoi_verbs:
        by_lib.setdefault(v['library'], []).append(v)

    # Hard-rule sanitizer for corporate names in verb records too.
    # Preserves record semantics while stripping Etsy/eBay/Shopify/etc.
    def sanitize(form_text):
        substitutions = [
            ('curator-web/src/', 'motoi/examples/'),
            ('curator-web/', 'motoi/'),
            ('etsy/listings', 'shop/listings'),
            ('etsy/receipts', 'shop/receipts'),
            ('etsy/reprice', 'shop/reprice'),
            ('etsy/ledger', 'shop/ledger'),
            ('etsy/age-distribution', 'shop/age-distribution'),
            ('carts/etsy/', 'carts/shop/'),
            ('ebay', 'shop-b'),
            ('eBay', 'ShopB'),
            ('Etsy', 'Shop'),
            ('Shopify', 'Shop-C'),
            ('shopify', 'shop-c'),
            ('etsy', 'shop-a'),
        ]
        for old, new in substitutions:
            form_text = form_text.replace(old, new)
        return form_text

    body = [motoi_header]
    for lib in sorted(by_lib.keys()):
        vs = by_lib[lib]
        body.append(f'')
        body.append(f'; ─── library: {lib} ({len(vs)} verbs) ───')
        body.append('')
        for v in vs:
            body.append(sanitize(v['form']))
            body.append('')

    # Filter the 70 core-form records by Motoi/Sakura membership. The
    # source mixes R7RS special forms (Motoi) with Sakura-specific card
    # verbs re-tagged as "core-form" (transfer, summon, scene/conveyor,
    # etsy/*, ctx-*, card-*).
    motoi_core_forms = [cf for cf in core_forms
                        if cf['name'] in CORE_FORM_MOTOI]
    sakura_core_forms = [cf for cf in core_forms
                         if cf['name'] in CORE_FORM_SAKURA]
    unclassified = [cf for cf in core_forms
                    if cf['name'] not in CORE_FORM_MOTOI
                    and cf['name'] not in CORE_FORM_SAKURA]
    body.append('')
    body.append(f'; ── CORE LANGUAGE FORMS ({len(motoi_core_forms)} forms) ──')
    body.append('; Motoi core forms — R7RS special forms + language-level primitives')
    body.append(';   (paint-*, sprite, note, tempo). These are the LANGUAGE, not')
    body.append(';   library verbs.')
    body.append(';')
    body.append(f'; Filtered from source: {len(core_forms)} total core-form records →')
    body.append(f';   {len(motoi_core_forms)} Motoi ({len(sakura_core_forms)} Sakura excluded,')
    body.append(f';   {len(unclassified)} unclassified retained here for safety review)')
    body.append('')
    for cf in motoi_core_forms:
        body.append(sanitize(cf['form']))
        body.append('')
    if unclassified:
        body.append(f'; ── UNCLASSIFIED CORE-FORMS ({len(unclassified)}) — retained pending review ──')
        for cf in unclassified:
            body.append(f'; UNCLASSIFIED: {cf["name"]}')
            body.append(cf['form'])
            body.append('')

    MOTOI_OUT.write_text('\n'.join(body))
    print(f"Wrote {MOTOI_OUT} ({len(motoi_verbs)} verbs, {len(core_forms)} core forms)")

    # --- Deliverable 3: runtime gap -------------------------------
    gap_verbs = []
    for v in motoi_verbs:
        # Strip library-prefix to get the raw name; runtime may register
        # either `verb-name` (no prefix) or `library/verb-name`. Check both.
        n = v['name']
        raw = n.split('/', 1)[1] if '/' in n else n
        if n in MOTOI_RUNTIME:
            continue
        if raw in MOTOI_RUNTIME:
            continue
        gap_verbs.append(v)

    gap_lines = [
        "; Reference-vs-runtime gap — 2026-07-16",
        "; ",
        "; Motoi verbs that the reference documents but the Motoi runtime",
        "; (motoi-scheme/src/) does NOT currently implement. These are the",
        "; Pass-3 Wave-1 fix-targets — Alfred's `play` example fits here.",
        ";",
        "; Filtering: MOTOI-BASE class only (Sakura- and Lacuna-dialect",
        "; verbs are expected to be absent from Motoi runtime).",
        ";",
        "; Runtime source of truth (2026-07-16):",
        f";   base.js: {len(MOTOI_RUNTIME_BASE)} verbs",
        f";   slat-verbs.js: {len(MOTOI_RUNTIME_SLAT)} verbs",
        f";   total: {len(MOTOI_RUNTIME)} verbs actually implemented",
        ";",
        f"; Reference MOTOI-BASE count: {len(motoi_verbs)}",
        f"; Runtime-implemented among those: {len(motoi_verbs) - len(gap_verbs)}",
        f"; GAP (documented but not implemented): {len(gap_verbs)}",
        "",
        "(gap-report",
        '  :date "2026-07-16"',
        '  :auditor "The Engineer"',
        f'  :runtime-verb-count {len(MOTOI_RUNTIME)}',
        f'  :reference-motoi-verb-count {len(motoi_verbs)}',
        f'  :gap-count {len(gap_verbs)}',
        '  :fix-target "Pass-3 migration Wave 1+"',
        '  :purpose "Alfred flagged play/* as a documented-but-missing verb; every verb below is a candidate for the same class of bug.")',
        '',
        '; ── MISSING VERBS ──',
        '',
    ]
    # Group missing by library for readability
    missing_by_lib = {}
    for v in gap_verbs:
        missing_by_lib.setdefault(v['library'], []).append(v)
    for lib in sorted(missing_by_lib.keys()):
        vs = missing_by_lib[lib]
        gap_lines.append(f'; --- library {lib} ({len(vs)} missing) ---')
        for v in vs:
            n = v['name'].replace('"', '\\"')
            l = v['library'].replace('"', '\\"')
            gap_lines.append(
                f'(missing :name "{n}" :library "{l}" :fix-in "Pass-3 Wave 1")'
            )
        gap_lines.append('')

    GAP_OUT.write_text('\n'.join(gap_lines))
    print(f"Wrote {GAP_OUT}")

    # --- summary for the caller ---
    print("\n=== SUMMARY ===")
    print(f"Reference records: {len(verbs)}")
    print(f"  MOTOI-BASE:     {len(by_class.get('MOTOI-BASE', []))}")
    print(f"  SAKURA-DIALECT: {len(by_class.get('SAKURA-DIALECT', []))}")
    print(f"  LACUNA-DIALECT: {len(by_class.get('LACUNA-DIALECT', []))}")
    print(f"  AMBIGUOUS:      {len(by_class.get('AMBIGUOUS', []))}")
    print(f"Motoi reference verbs written: {len(motoi_verbs)}")
    print(f"Runtime gap: {len(gap_verbs)}")
    # Top-10 ambiguous by name
    print("\nTop ambiguous (sample):")
    for v in by_class.get('AMBIGUOUS', [])[:15]:
        print(f"  {v['name']}  (library={v['library']!r})")

if __name__ == '__main__':
    main()
