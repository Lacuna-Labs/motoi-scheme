#!/usr/bin/env python3
"""right-size-motoi-corpus-2026-07-16.py
The Engineer — Motoi right-size lane 2026-07-16

Cull sakura-dip CODE (44,248 -> 30,000) and CURRICULUM (18,166 -> 5,000)
by quality signal; DROP all sakura-dip PERSONA (101,068) per Alfred rule
("Motoi doesn't use voice"); MERGE + DEDUPE refusal sources (sakura-dip 367
+ wave-3 2,577 + w02 297 = 3,241 -> 3,000 best-of); ASSEMBLE final corpus.

HARD RULES:
- NO deletes; archive under _archive/sakura-dip-cull-2026-07-16/
- Held-out contract enforced: pairs with `held_out: true` NEVER enter train
- Provenance preserved on every record via _selection metadata
- Balanced final ~50k pairs (no PERSONA except RESPONSE-SHAPE 2,081)
"""
import json, os, re, hashlib, sys, random
from pathlib import Path
from collections import Counter, defaultdict

random.seed(20260716)

ROOT       = Path('/Users/alfred/code/motoi-scheme')
TRAIN_DIR  = ROOT / 'training-data'
ARCH_DIR   = ROOT / '_archive' / 'sakura-dip-cull-2026-07-16'
ARCH_DIR.mkdir(parents=True, exist_ok=True)

CODE_SRC       = TRAIN_DIR / 'sakura-dip-code-2026-07-16.jsonl'
CURRIC_SRC     = TRAIN_DIR / 'sakura-dip-curriculum-2026-07-16.jsonl'
PERSONA_SRC    = TRAIN_DIR / 'sakura-dip-persona-2026-07-16.jsonl'
DIP_REFUSAL    = TRAIN_DIR / 'sakura-dip-refusal-2026-07-16.jsonl'
W3_REFUSAL     = TRAIN_DIR / 'wave-3-refusal-2026-07-16.jsonl'
W02_DONTS      = TRAIN_DIR / 'salvage-w02-book-of-donts-2026-07-16.jsonl'
RESPONSE_SHAPE = TRAIN_DIR / 'response-shape-2026-07-16.jsonl'
HELDOUT_FILE   = TRAIN_DIR / 'held-out' / 'heldout-2026-07-16.jsonl'

VERB_LIST = json.load(open('/tmp/motoi-reference-verbs.json'))
MOTOI_VERBS = set(VERB_LIST)

# Kid/hobbyist common non-motoi Scheme forms we should still count as OK
R7RS_EXTRAS = {
    'define','lambda','let','let*','letrec','if','cond','when','unless','begin',
    'and','or','not','set!','define-record-type','define-syntax','case','do',
    'quote','quasiquote','unquote','unquote-splicing','apply','map','for-each',
    'filter','fold','fold-left','fold-right','reduce','list','cons','car','cdr',
    'caar','cadr','cdar','cddr','null?','pair?','symbol?','number?','string?',
    'procedure?','boolean?','vector?','equal?','eq?','eqv?','=','<','>','<=','>=',
    '+','-','*','/','modulo','remainder','quotient','abs','min','max','expt',
    'sqrt','floor','ceiling','round','truncate','exact','inexact','string','string?',
    'string-length','string-ref','string-append','substring','number->string',
    'string->number','symbol->string','string->symbol','vector','make-vector',
    'vector-length','vector-ref','vector-set!','vector->list','list->vector',
    'length','reverse','append','list-ref','list-tail','assoc','assq','assv',
    'member','memq','memv','let-values','let*-values','delay','force','error',
    'guard','with-exception-handler','raise','parameterize','dynamic-wind',
    'call/cc','call-with-current-continuation','call-with-values','values',
    'display','write','newline','read','write-string','read-line','read-char',
    'peek-char','eof-object?','write-char','make-string','string-copy',
    'string-fill!','string-map','string-for-each','char?','char->integer',
    'integer->char','char-upcase','char-downcase','char-upper-case?',
    'char-lower-case?','char-alphabetic?','char-numeric?','char-whitespace?',
    'zero?','positive?','negative?','odd?','even?','make-list','iota','sort',
    'take','drop','last','first','second','third','fourth','fifth',
    'lambda','define-values','set-car!','set-cdr!','let-syntax','letrec-syntax',
    'define-library','import','include','include-ci',
}
OK_VERBS = MOTOI_VERBS | R7RS_EXTRAS

CODE_FENCE_RE  = re.compile(r'```(?:motoi|scheme)?\n(.*?)```', re.DOTALL)
SYMBOL_RE      = re.compile(r'[A-Za-z][A-Za-z0-9\-\?!/\*\+<>=]*')
SAKURA_BRAND   = re.compile(r'\b(?:Sakura|sakura|Curator|Lacuna|Cortex|cortex)\b')
FORBIDDEN_BRAND_IN_TEXT = re.compile(r'\b(?:Sakura|Curator|Lacuna)\b')  # kept out of Motoi

# ---------- helpers ----------

def read_jsonl(path):
    header = None
    recs = []
    with open(path) as f:
        for i, line in enumerate(f, 1):
            line = line.strip()
            if not line: continue
            obj = json.loads(line)
            if obj.get('_provenance_header'):
                header = obj
                continue
            obj['_line_no'] = i
            recs.append(obj)
    return header, recs

def write_jsonl(path, header, recs):
    with open(path, 'w') as f:
        if header:
            f.write(json.dumps(header, ensure_ascii=False) + '\n')
        for r in recs:
            # strip our internal helper key
            r2 = {k: v for k, v in r.items() if k != '_line_no'}
            f.write(json.dumps(r2, ensure_ascii=False) + '\n')

def messages_of(rec):
    return rec.get('messages') or []

def pair_hash(rec):
    msgs = messages_of(rec)
    u = ''
    a = ''
    for m in msgs:
        if m.get('role') == 'user':
            u = m.get('content','')
        elif m.get('role') == 'assistant':
            a = m.get('content','')
    txt = (u.strip() + '\x1f' + a.strip()).encode('utf-8')
    return hashlib.sha256(txt).hexdigest()

def user_text(rec):
    for m in messages_of(rec):
        if m.get('role') == 'user': return m.get('content','')
    return ''

def assistant_text(rec):
    for m in messages_of(rec):
        if m.get('role') == 'assistant': return m.get('content','')
    return ''

def scheme_parses(code):
    """Cheap: parentheses balance; must be non-empty and not trivially broken."""
    if not code: return False
    depth = 0
    in_str = False
    esc = False
    for ch in code:
        if esc: esc = False; continue
        if ch == '\\' and in_str: esc = True; continue
        if ch == '"': in_str = not in_str; continue
        if in_str: continue
        if ch == '(': depth += 1
        elif ch == ')':
            depth -= 1
            if depth < 0: return False
    return depth == 0

def code_verbs_ok_ratio(code):
    """Ratio of function-call heads that appear in OK_VERBS or R7RS-ish."""
    if not code: return 0.0
    # Extract (verb ...) heads
    heads = re.findall(r'\(([A-Za-z][A-Za-z0-9\-\?!/\*\+<>=]*)', code)
    if not heads: return 0.0
    ok = sum(1 for h in heads if h in OK_VERBS)
    return ok / len(heads)

def extract_code_blocks(text):
    return CODE_FENCE_RE.findall(text or '')

# ---------- CODE scoring ----------

def score_code(rec):
    """Higher = better keep."""
    u = user_text(rec)
    a = assistant_text(rec)
    if not a: return -100
    # (d) no leftover Sakura branding in ASSISTANT text
    brand_penalty = -50 if FORBIDDEN_BRAND_IN_TEXT.search(a) else 0
    # extract code
    blocks = extract_code_blocks(a)
    # (c) explanation length: prose portion (assistant text minus code)
    prose = re.sub(r'```.*?```', '', a, flags=re.DOTALL).strip()
    prose_len_ok = 10 if len(prose) >= 40 else 0
    if not blocks:
        # code-labeled but no code fence — probably weak; still keep but low
        return -20 + prose_len_ok + brand_penalty
    code = '\n'.join(blocks)
    # (a) parses
    parses = 20 if scheme_parses(code) else -20
    # (b) verb-in-motoi ratio
    ratio = code_verbs_ok_ratio(code)
    verb_score = int(ratio * 30)  # 0..30
    # code length preference: 50..2000 chars is sweet spot
    L = len(code)
    if L < 30: len_score = -20
    elif L > 3000: len_score = -10
    else: len_score = 15
    # provenance signal: verb_swaps + fence_swaps in _prov shows successful rewrite
    prov = rec.get('_prov', {}) or {}
    prov_score = min(int(prov.get('verb_swaps', 0)), 10) + min(int(prov.get('fence_swaps', 0)), 5)
    # user text present?
    user_score = 5 if u.strip() else 0
    return parses + verb_score + len_score + prose_len_ok + brand_penalty + prov_score + user_score

# ---------- CURRICULUM scoring ----------

STEM_CS_WORDS = re.compile(
    r'\b(program|function|variable|loop|algorithm|scheme|lisp|code|compile|parse|'
    r'math|number|integer|fraction|prime|geometry|triangle|angle|square|cube|'
    r'physics|energy|force|motion|velocity|acceleration|electron|atom|molecule|'
    r'biology|cell|dna|neuron|photosynthesis|chemistry|reaction|acid|base|'
    r'computer|memory|cpu|byte|bit|binary|hex|graph|tree|list|stack|queue|hash|'
    r'recursion|iteration|induction|proof|theorem|derivative|integral|matrix|vector|'
    r'set|logic|boolean|probability|statistic|calculus|algebra|equation|'
    r'sound|frequency|wave|amplitude|pitch|note|color|light|pixel|render|'
    r'earth|planet|star|galaxy|orbit|moon|sun|weather|storm|ocean|mountain|'
    r'ecosystem|species|evolution|habitat)\b', re.I)

FANON_PHILOSOPHER = re.compile(
    r'\b(Fanon|Frantz|Nietzsche|Hegel|Kant|Marx|Foucault|Derrida|Lacan|Freud|Jung|'
    r'Wittgenstein|Peirce|Popper|Searle|Grice|Quine|Descartes|Sartre|Rawls|'
    r'Aristotle|Levinas|Dennett|Heidegger|Husserl|Deleuze|Guattari|Adorno)\b')

def score_curriculum(rec):
    a = assistant_text(rec)
    u = user_text(rec)
    if not a: return -100
    # (d) no Sakura/Curator/Lacuna brand-leak
    brand_penalty = -50 if FORBIDDEN_BRAND_IN_TEXT.search(a) else 0
    # philosopher name-drops (Motoi shouldn't teach these — persona-heavy Sakura material)
    philosopher_penalty = -30 if FANON_PHILOSOPHER.search(a) or FANON_PHILOSOPHER.search(u) else 0
    # length signal
    L = len(a)
    if L < 60: len_score = -20
    elif L > 4000: len_score = -10
    else: len_score = 10
    # STEM/CS hits — prioritize
    stem_hits = len(STEM_CS_WORDS.findall(a))
    stem_score = min(stem_hits * 3, 40)
    # user text present
    user_score = 5 if u.strip() else 0
    # code fence bonus (some curriculum has code)
    code_bonus = 5 if extract_code_blocks(a) else 0
    return len_score + stem_score + brand_penalty + philosopher_penalty + user_score + code_bonus

# ---------- REFUSAL best-of ----------

def score_refusal(rec):
    a = assistant_text(rec)
    u = user_text(rec)
    if not a or not u: return -100
    L = len(a)
    # Prefer short, direct refusals (30..400 chars)
    if L < 15: len_score = -10
    elif L > 800: len_score = -20
    elif 30 <= L <= 400: len_score = 20
    else: len_score = 5
    # No brand leak
    brand_penalty = -50 if FORBIDDEN_BRAND_IN_TEXT.search(a) else 0
    # No preaching markers
    preach = re.search(r"\b(as an ai|i am an ai|i cannot|as a language model|i'm not able)\b", a, re.I)
    preach_penalty = -30 if preach else 0
    # Warmth / concreteness — hint from mentioning a trusted person (mom/dad/teacher/friend/coach)
    trusted = re.search(r'\b(mom|dad|mama|papa|parent|teacher|coach|friend|doctor|nurse|counselor|therapist|neighbor|aunt|uncle|grandma|grandpa|sister|brother)\b', a, re.I)
    trusted_bonus = 8 if trusted else 0
    return len_score + brand_penalty + preach_penalty + trusted_bonus

# ---------- CULL ----------

def cull(source_path, arch_path, target_n, scorer, label, heldout_hashes=None):
    print(f'[{label}] reading {source_path.name}')
    header, recs = read_jsonl(source_path)
    print(f'[{label}] loaded {len(recs)} pairs')
    # Held-out safety: BOTH the flag AND content-hash match against held-out set
    held = [r for r in recs if r.get('held_out')]
    if held:
        print(f'[{label}] WARNING: {len(held)} held_out flagged pairs detected — filtering')
    pool_step1 = [r for r in recs if not r.get('held_out')]
    if heldout_hashes:
        content_leaked = [r for r in pool_step1 if pair_hash(r) in heldout_hashes]
        if content_leaked:
            print(f'[{label}] WARNING: {len(content_leaked)} pairs match held-out CONTENT — filtering (contract is content-based)')
        pool = [r for r in pool_step1 if pair_hash(r) not in heldout_hashes]
    else:
        pool = pool_step1
        content_leaked = []
    # Dedupe within source
    seen = set()
    deduped = []
    for r in pool:
        h = pair_hash(r)
        if h in seen: continue
        seen.add(h)
        deduped.append(r)
    dropped_dup = len(pool) - len(deduped)
    print(f'[{label}] deduped: dropped {dropped_dup} duplicates -> {len(deduped)}')
    # Score
    scored = [(scorer(r), r) for r in deduped]
    scored.sort(key=lambda x: (-x[0], x[1].get('_line_no', 0)))
    target = min(target_n, len(scored))
    kept = [r for s, r in scored[:target]]
    archived = [r for s, r in scored[target:]]
    # Attach a lightweight selection tag on kept
    for r in kept:
        r.setdefault('_selection', {})
        r['_selection']['kept_by'] = f'right-size-motoi-2026-07-16/{label}'
    for r in archived:
        r.setdefault('_selection', {})
        r['_selection']['archived_by'] = f'right-size-motoi-2026-07-16/{label}'
        # store the score for later audit
    # Archive
    arch_header = {
        '_provenance_header': True,
        'generator': 'right-size-motoi-corpus-2026-07-16.py',
        'generated_at': '2026-07-16',
        'source': str(source_path),
        'archived_reason': f'{label}: right-sized from {len(recs)} to {target_n} keep; rest preserved here',
        'dedupe_removed': dropped_dup,
        'held_out_filtered': len(held),
        'no_deletes_policy': True,
        'audience': 'engineer',
        'confidentiality': 'internal',
        'dialect': 'motoi',
        'training_eligible': False,  # archived = out of pool
    }
    write_jsonl(arch_path, arch_header, archived)
    print(f'[{label}] archived {len(archived)} -> {arch_path}')
    return header, kept, {
        'input': len(recs),
        'held_out_flag_filtered': len(held),
        'held_out_content_filtered': len(content_leaked),
        'dedupe_removed': dropped_dup,
        'kept': len(kept),
        'archived': len(archived),
    }

# ---------- MAIN ----------

def load_heldout_hashes():
    """Load content-hashes of every held-out pair. Contract is content-based."""
    hashes = set()
    with open(HELDOUT_FILE) as f:
        for line in f:
            line = line.strip()
            if not line: continue
            o = json.loads(line)
            if o.get('_provenance_header'): continue
            hashes.add(pair_hash(o))
    return hashes

def main():
    stats = {}
    HELDOUT_HASHES = load_heldout_hashes()
    print(f'[HELDOUT] loaded {len(HELDOUT_HASHES)} content-hashes of held-out pairs')

    # 1. CODE cull
    code_hdr, code_kept, s = cull(
        CODE_SRC,
        ARCH_DIR / 'code-not-selected.jsonl',
        target_n=30000,
        scorer=score_code,
        label='CODE',
        heldout_hashes=HELDOUT_HASHES,
    )
    stats['CODE'] = s

    # 2. CURRICULUM cull
    curric_hdr, curric_kept, s = cull(
        CURRIC_SRC,
        ARCH_DIR / 'curriculum-not-selected.jsonl',
        target_n=5000,
        scorer=score_curriculum,
        label='CURRICULUM',
        heldout_hashes=HELDOUT_HASHES,
    )
    stats['CURRICULUM'] = s

    # 3. PERSONA drop-and-archive (all 101k)
    print('[PERSONA] reading sakura-dip persona file (dropping all per Alfred rule)')
    persona_hdr, persona_recs = read_jsonl(PERSONA_SRC)
    persona_arch = ARCH_DIR / 'persona-dropped-per-alfred-rule.jsonl'
    arch_hdr = {
        '_provenance_header': True,
        'generator': 'right-size-motoi-corpus-2026-07-16.py',
        'generated_at': '2026-07-16',
        'source': str(PERSONA_SRC),
        'archived_reason': "Motoi doesn't use voice — Alfred rule. All PERSONA dip pairs archived for possible future Sakura reuse.",
        'dropped_all': True,
        'no_deletes_policy': True,
        'audience': 'engineer',
        'confidentiality': 'internal',
        'dialect': 'motoi',
        'training_eligible': False,
    }
    for r in persona_recs:
        r.setdefault('_selection', {})
        r['_selection']['archived_by'] = 'right-size-motoi-2026-07-16/PERSONA-drop-all'
    write_jsonl(persona_arch, arch_hdr, persona_recs)
    stats['PERSONA'] = {
        'input': len(persona_recs),
        'kept': 0,
        'archived': len(persona_recs),
        'reason': 'Alfred-rule: Motoi has no persona/voice bucket',
    }
    print(f'[PERSONA] archived {len(persona_recs)} pairs -> {persona_arch}')

    # 4. REFUSAL merge (dip 367 + wave-3 2577 + w02-refusal 297 = 3241) -> 3000
    print('[REFUSAL] merging three refusal sources')
    all_refusal = []
    dip_hdr, dip_recs = read_jsonl(DIP_REFUSAL)
    for r in dip_recs:
        r.setdefault('_refusal_src', 'sakura-dip')
        all_refusal.append(r)
    w3_hdr, w3_recs = read_jsonl(W3_REFUSAL)
    for r in w3_recs:
        r.setdefault('_refusal_src', 'wave-3-refusal')
        all_refusal.append(r)
    w02_hdr, w02_recs = read_jsonl(W02_DONTS)
    w02_refusal = [r for r in w02_recs if r.get('family') == 'refusal']
    for r in w02_refusal:
        r.setdefault('_refusal_src', 'salvage-w02-donts')
        all_refusal.append(r)
    print(f'[REFUSAL] pool: dip={len(dip_recs)} w3={len(w3_recs)} w02-refusal={len(w02_refusal)} total={len(all_refusal)}')
    # Held-out filter (flag + content-hash)
    held = [r for r in all_refusal if r.get('held_out')]
    pool_step1 = [r for r in all_refusal if not r.get('held_out')]
    content_leaked_refusal = [r for r in pool_step1 if pair_hash(r) in HELDOUT_HASHES]
    pool = [r for r in pool_step1 if pair_hash(r) not in HELDOUT_HASHES]
    print(f'[REFUSAL] held_out flag filtered: {len(held)}; content-hash filtered: {len(content_leaked_refusal)}; pool now {len(pool)}')
    # Dedupe (prefer wave-3-refusal source for tie because it was gen-scripted with care)
    src_rank = {'wave-3-refusal': 0, 'salvage-w02-donts': 1, 'sakura-dip': 2}
    pool.sort(key=lambda r: src_rank.get(r.get('_refusal_src'), 9))
    seen = set()
    deduped = []
    for r in pool:
        h = pair_hash(r)
        if h in seen: continue
        seen.add(h)
        deduped.append(r)
    dropped_dup = len(pool) - len(deduped)
    print(f'[REFUSAL] deduped: dropped {dropped_dup} -> {len(deduped)}')
    # Score & pick top 3000
    scored = [(score_refusal(r), r) for r in deduped]
    scored.sort(key=lambda x: (-x[0], src_rank.get(x[1].get('_refusal_src'), 9)))
    target = min(3000, len(scored))
    refusal_kept = [r for s, r in scored[:target]]
    refusal_arch_recs = [r for s, r in scored[target:]]
    # Archive not-selected refusal (came from multiple sources — keep provenance)
    arch_hdr = {
        '_provenance_header': True,
        'generator': 'right-size-motoi-corpus-2026-07-16.py',
        'generated_at': '2026-07-16',
        'sources': [str(DIP_REFUSAL), str(W3_REFUSAL), str(W02_DONTS)],
        'archived_reason': 'REFUSAL best-of: 3,241 input dedupe/scored, kept top 3,000',
        'held_out_filtered': len(held),
        'dedupe_removed': dropped_dup,
        'no_deletes_policy': True,
        'audience': 'engineer',
        'confidentiality': 'internal',
        'dialect': 'motoi',
        'training_eligible': False,
    }
    for r in refusal_kept:
        r.setdefault('_selection', {})
        r['_selection']['kept_by'] = 'right-size-motoi-2026-07-16/REFUSAL'
    for r in refusal_arch_recs:
        r.setdefault('_selection', {})
        r['_selection']['archived_by'] = 'right-size-motoi-2026-07-16/REFUSAL'
    write_jsonl(ARCH_DIR / 'refusal-not-selected.jsonl', arch_hdr, refusal_arch_recs)
    stats['REFUSAL'] = {
        'input': len(all_refusal),
        'held_out_flag_filtered': len(held),
        'held_out_content_filtered': len(content_leaked_refusal),
        'dedupe_removed': dropped_dup,
        'kept': len(refusal_kept),
        'archived': len(refusal_arch_recs),
        'by_source': dict(Counter(r.get('_refusal_src','?') for r in refusal_kept)),
    }
    print(f'[REFUSAL] kept {len(refusal_kept)} archived {len(refusal_arch_recs)}')

    # 5. RESPONSE-SHAPE (keep all non-held-out, no dip; also filter content-matches to held-out)
    print('[RESPONSE-SHAPE] loading response-shape file')
    rs_hdr, rs_recs = read_jsonl(RESPONSE_SHAPE)
    held_rs_flag = [r for r in rs_recs if r.get('held_out')]
    rs_step1 = [r for r in rs_recs if not r.get('held_out')]
    rs_content_leaked = [r for r in rs_step1 if pair_hash(r) in HELDOUT_HASHES]
    rs_kept = [r for r in rs_step1 if pair_hash(r) not in HELDOUT_HASHES]
    for r in rs_kept:
        r.setdefault('_selection', {})
        r['_selection']['kept_by'] = 'right-size-motoi-2026-07-16/RESPONSE-SHAPE'
    stats['RESPONSE-SHAPE'] = {
        'input': len(rs_recs),
        'held_out_flag_filtered': len(held_rs_flag),
        'held_out_content_filtered': len(rs_content_leaked),
        'kept': len(rs_kept),
        'archived': 0,
    }
    print(f'[RESPONSE-SHAPE] loaded {len(rs_recs)}, held_out flag {len(held_rs_flag)}, held_out content {len(rs_content_leaked)}, kept {len(rs_kept)} (pre-dedupe)')

    # 6. Assemble final corpus
    print('[ASSEMBLE] building final Motoi corpus')
    final_path = TRAIN_DIR / 'motoi-copilot-final-corpus-2026-07-16.jsonl'
    final_hdr = {
        '_provenance_header': True,
        'generator': 'right-size-motoi-corpus-2026-07-16.py',
        'generated_at': '2026-07-16',
        'purpose': 'Motoi Copilot FINAL right-sized training corpus (~50k pairs)',
        'seed': 20260716,
        'doctrine': "Balanced data at the end. Don't over-pull then cull down to 20%. Motoi doesn't use voice — no PERSONA. RESPONSE-SHAPE (2,081) preserved as the only stylistic voice.",
        'composition_target': {
            'CODE': 30000,
            'CURRICULUM': 5000,
            'REFUSAL': 3000,
            'RESPONSE-SHAPE': 2081,
            'PERSONA': 0,
            'GENERAL-REPLAY': 0,
        },
        'held_out_contract': 'Every pair with `held_out`:true excluded. See training-data/held-out/README.slat.',
        'archived_sources': str(ARCH_DIR),
        'audience': 'trainer',
        'confidentiality': 'internal',
        'dialect': 'motoi',
        'training_eligible': True,
        'owner': 'The Engineer',
        'tags': ['motoi', 'copilot', 'final', 'right-sized', 'balanced', '2026-07-16'],
    }
    # Interleave-tag by bucket
    def tag(recs, bucket):
        for r in recs:
            r.setdefault('_selection', {})
            r['_selection']['bucket'] = bucket
        return recs
    all_final = []
    all_final += tag(code_kept, 'CODE')
    all_final += tag(curric_kept, 'CURRICULUM')
    all_final += tag(refusal_kept, 'REFUSAL')
    all_final += tag(rs_kept, 'RESPONSE-SHAPE')
    # Final dedupe (cross-bucket safety)
    seen = set()
    deduped_final = []
    cross_dupes = 0
    for r in all_final:
        h = pair_hash(r)
        if h in seen: cross_dupes += 1; continue
        seen.add(h)
        deduped_final.append(r)
    print(f'[ASSEMBLE] final dedupe: cross-bucket dupes dropped: {cross_dupes}')
    # Held-out cross-check (both flag AND content-hash)
    heldout_flag_leaked = sum(1 for r in deduped_final if r.get('held_out'))
    heldout_content_leaked = sum(1 for r in deduped_final if pair_hash(r) in HELDOUT_HASHES)
    if heldout_flag_leaked or heldout_content_leaked:
        print(f'[ASSEMBLE] FATAL: flag-leaked={heldout_flag_leaked} content-leaked={heldout_content_leaked}. ABORT.')
        sys.exit(2)
    heldout_leaked = heldout_flag_leaked + heldout_content_leaked
    random.shuffle(deduped_final)
    write_jsonl(final_path, final_hdr, deduped_final)
    print(f'[ASSEMBLE] wrote {len(deduped_final)} pairs -> {final_path}')

    # Stats dump
    final_by_bucket = Counter(r.get('_selection',{}).get('bucket','?') for r in deduped_final)
    stats['FINAL'] = {
        'path': str(final_path),
        'total': len(deduped_final),
        'by_bucket': dict(final_by_bucket),
        'cross_bucket_dedupe': cross_dupes,
        'heldout_leaked': heldout_leaked,
    }
    # Write stats file for the report
    with open(ROOT / 'scratch' / 'right-size-stats-2026-07-16.json', 'w') as f:
        json.dump(stats, f, indent=2)
    print('[DONE] stats written to scratch/right-size-stats-2026-07-16.json')
    return stats

if __name__ == '__main__':
    main()
