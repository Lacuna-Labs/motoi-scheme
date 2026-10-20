#!/usr/bin/env python3
"""draft_records.py — draft reference-manual verb records with a LOCAL model.

Priya, 2026-08-03. Deliverable 3 of the pairs work.

No network. No paid API. Runs mlx_lm against a locally cached model.

    python3 scratch/pairs/draft_records.py --all
    python3 scratch/pairs/draft_records.py --verbs 'take!,append!' --model qwen
    python3 scratch/pairs/draft_records.py --all --force        # re-draft

Every prompt carries:
  1. the house rules, stated as rules
  2. THREE real records from scheme/reference/ as style exemplars
  3. the verb's spec-pack file (in-repo evidence only)

THE HARD RULE, enforced twice — once in the prompt and once in
`scrub_notes()` after generation, because a prompt is not a gate:

    NO PRINTED VALUES. Every :note in an :examples pair is rewritten to the
    literal string PENDING-ENGINE. What a form PRINTS is decided by running
    it on the cons-cell engine, which does not exist yet. A later
    deterministic script fills these in from real stdout.

Models (both already in ~/.cache/huggingface/hub):
  mistral — mlx-community/Mistral-Small-3.2-24B-Instruct-2506-4bit  (default;
            repo has NO chat_template, so we frame [INST] ... [/INST] by hand)
  qwen    — mlx-community/Qwen3-Coder-30B-A3B-Instruct-4bit
"""

import argparse
import os
import re
import sys
import time

ROOT = '/Users/alfred/code/motoi-scheme'
PAIRS = os.path.join(ROOT, 'scratch/pairs')
SPEC_PACK = os.path.join(PAIRS, 'spec-pack')
DRAFTS = os.path.join(PAIRS, 'drafts')

MODELS = {
    'mistral': 'mlx-community/Mistral-Small-3.2-24B-Instruct-2506-4bit',
    'qwen': 'mlx-community/Qwen3-Coder-30B-A3B-Instruct-4bit',
}

# Exemplars: (chapter file, verb name). Picked for three different shapes —
# a pure SRFI-1 list verb, a pure higher-order verb, and a mutator whose
# record is mostly about a divergence, which is what ours all are.
EXEMPLARS = [
    ('scheme/reference/39-list.slat', 'last-pair'),
    ('scheme/reference/33-higher-order.slat', 'fold'),
    ('scheme/reference/26-exception.slat', 'error-object-type'),
]


# ── record extraction (balanced-paren, string-aware) ──────────────────────
def extract_records(text, tag='(verb'):
    records, i, n = [], 0, len(text)
    while i < n:
        if (i == 0 or text[i - 1] == '\n') and text.startswith(tag, i):
            depth, in_str, esc, j = 0, False, False, i
            while j < n:
                c = text[j]
                if in_str:
                    if esc:
                        esc = False
                    elif c == '\\':
                        esc = True
                    elif c == '"':
                        in_str = False
                else:
                    if c == '"':
                        in_str = True
                    elif c == '(':
                        depth += 1
                    elif c == ')':
                        depth -= 1
                        if depth == 0:
                            j += 1
                            break
                j += 1
            records.append(text[i:j])
            i = j
        else:
            i += 1
    return records


def load_exemplar(rel, name):
    with open(os.path.join(ROOT, rel), encoding='utf-8') as f:
        for rec in extract_records(f.read()):
            m = re.search(r':name\s+"([^"]+)"', rec)
            if m and m.group(1) == name:
                return rec
    raise SystemExit('exemplar not found: %s in %s' % (name, rel))


def safe_name(verb):
    return verb.replace('!', '-bang').replace('*', '-star')


# ── the one rule that must not break ──────────────────────────────────────
NOTE_RX = re.compile(r'(:note\s+)"(?:[^"\\]|\\.)*"')


def scrub_notes(text):
    """Force every :note to the literal placeholder. Belt and braces.

    Returns (scrubbed, n_replaced, n_that_were_not_already_pending).
    """
    hits = NOTE_RX.findall(text)
    already = len(re.findall(r':note\s+"PENDING-ENGINE"', text))
    out = NOTE_RX.sub(lambda m: m.group(1) + '"PENDING-ENGINE"', text)
    return out, len(hits), len(hits) - already


# ── prompt ────────────────────────────────────────────────────────────────
RULES = """You are drafting one record for the Motoi Scheme reference manual.
The reference IS the language: when the code and the reference disagree, the
reference wins. These records are the training corpus for a model, so a wrong
sentence is expensive.

CONTEXT YOU MUST WRITE INTO THE RECORD
Motoi is being changed right now. Today a proper list is a flat JavaScript
array and only an improper list is a real Pair object, so (cdr x) allocates a
fresh copy, (eq? (cdr x) (cdr x)) is #f, set-cdr! on a proper list has nowhere
to write, and circular lists cannot exist. The owner has chosen full R7RS
compatibility: real cons cells everywhere. You are documenting the verb as it
WILL be once cons cells land -- the correct semantics -- not as the array
engine behaves today.

THE LESSON EVERY DESTRUCTIVE RECORD MUST TEACH
For any verb whose name ends in `!`: the `!` means the argument's cells are
reused, the original binding must be considered destroyed, and the return value
is the only thing a caller may rely on. The :explanation must make that point
IN YOUR OWN WORDS, specific to this verb -- which cells this verb reuses and
what the caller's old variable reads afterwards. It must also name the failure
mode: a caller keeps using the variable it passed in because the call seemed to
work, and reads a list that has been cut, relinked or overwritten under it. On
an implementation that quietly returns a fresh list instead, that bug is
invisible, which is why it went uncaught.

HARD RULES
1. NEVER write a printed value. You do not know what any form prints, because
   the engine that would print it does not exist yet. Every :note field must
   be exactly: :note "PENDING-ENGINE"   -- nothing else, ever.
2. Do not invent specification text. Everything you assert about the verb's
   contract must come from the SPEC PACK below. If the spec pack says there is
   no evidence for something, say so in the record rather than filling it in.
3. Write :code that DEMONSTRATES THE MUTATION. The whole point of `!` is that
   the argument is destroyed, and that is exactly what a fresh-list
   implementation hides. Bind the argument to a name, call the verb, then look
   at the ORIGINAL NAME as well as the result. Use eq? where the spec pack's
   conformance suite uses eq?.
4. Output ONE (verb ...) s-expression and nothing else. No prose before it,
   no markdown fences, no commentary after it.

FIELD ORDER, exactly:
  :name :std :library :tier :kind :signature
  :summary :explanation :examples :caveats :drawbacks :usecases :related
  :learn :provenance
  :row-2-audit :row-3-dimension :row-4-proof :row-5-emergence

FIELD JOBS
  :summary      one sentence, what it does and what it costs you.
  :explanation  one dense paragraph. Why the verb exists, when to reach for it,
                what its neighbour verbs are and why they are wrong here, and
                for a `!` verb the destroyed-binding lesson above.
  :examples     3 to 5 pairs, each (:dialect "motoi" :tier "novice"|
                "intermediate"|"expert" :code "..." :note "PENDING-ENGINE").
  :caveats      3 to 6 strings. Real hazards, not restatements of :summary.
  :drawbacks    2 to 4 strings. What you GIVE UP by choosing this verb.
  :usecases     2 to 4 strings. Concrete jobs.
  :related      4 to 7 verb names, as strings.
  :learn        (:concept "..." :prerequisites (...) :progression "...")
  :provenance   cite the standard and the in-repo file:line from the spec pack.
  rows 2-5      each carries the three-discipline lens :eng :math :cs, in the
                same shape as the exemplars. Match the exemplars; do not
                invent new field names.

TONE
Plain, direct, technical. Short declarative sentences. No marketing, no
exclamation marks, no emoji, no second person cheerleading. Name the failure
mode. The exemplars are the voice; match them.

THREE THINGS THAT RUIN A DRAFT
a. Copying sentences out of these instructions into the record. The rules are
   for you. The record is for a reader who has never seen them.
b. Copying content out of the exemplars. Take the SHAPE and the VOICE from
   them. Rows 3, 4 and 5 must be about THIS verb's shape. If an exemplar
   talks about a caboose or an extremum or a catamorphism and this verb has
   nothing to do with those, do not mention them.
c. Naming a verb that does not exist. Every name in :related and every verb
   called in a :code block must be one you have seen in the exemplars or in
   the spec pack, or a plain R7RS core verb (car cdr cons list length append
   reverse eq? equal? null? pair? display newline define let let* let-values
   lambda map filter if and or not).

Restating the spec is not good enough. The spec says WHAT. This record must
say WHY the verb exists, WHEN to reach for it and not its neighbour, and what
goes wrong when someone gets it slightly wrong."""


def build_prompt(verb, spec_text, exemplars):
    ex = '\n\n'.join(
        '=== EXEMPLAR %d (real record, copy this voice and shape) ===\n%s' % (i + 1, e)
        for i, e in enumerate(exemplars))
    return (
        RULES
        + '\n\n' + ex
        + '\n\n=== SPEC PACK for `%s` (the ONLY authority; in-repo evidence only) ===\n' % verb
        + spec_text
        + '\n\n=== YOUR TASK ===\n'
        + 'Write the reference record for `%s`. ' % verb
        + 'One (verb ...) s-expression, nothing else. '
        + 'Every :note is exactly "PENDING-ENGINE".\n'
    )


def frame(model_key, prompt, tokenizer):
    if model_key == 'mistral':
        # No chat_template in this repo — manual [INST] framing.
        return '<s>[INST] ' + prompt + ' [/INST]'
    msgs = [{'role': 'user', 'content': prompt}]
    return tokenizer.apply_chat_template(msgs, tokenize=False, add_generation_prompt=True)


def clean(raw):
    """Strip fences/chatter and keep the first balanced (verb ...) form."""
    raw = raw.strip()
    raw = re.sub(r'^```[a-zA-Z]*\n', '', raw)
    raw = raw.replace('```', '')
    recs = extract_records(raw)
    if recs:
        return recs[0]
    i = raw.find('(verb')
    return raw[i:] if i >= 0 else raw


def degenerate(rec, window=12):
    """Catch the repetition loop before it reaches disk."""
    sents = [s.strip() for s in re.split(r'(?<=[.!?])\s+', rec) if len(s.strip()) > 30]
    for i in range(len(sents) - window):
        if len(set(sents[i:i + window])) <= 2:
            return True
    return len(rec) > 40000


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--model', default='mistral', choices=sorted(MODELS))
    ap.add_argument('--verbs', default='')
    ap.add_argument('--all', action='store_true')
    ap.add_argument('--max-tokens', type=int, default=3600)
    ap.add_argument('--temp', type=float, default=0.4)
    ap.add_argument('--rep-penalty', type=float, default=1.05)
    ap.add_argument('--force', action='store_true')
    args = ap.parse_args()

    if args.all:
        verbs = sorted(
            open(os.path.join(SPEC_PACK, f), encoding='utf-8').readline()
            .strip().split('— ')[-1]
            for f in os.listdir(SPEC_PACK) if f.endswith('.slatl'))
    else:
        verbs = [v.strip() for v in args.verbs.split(',') if v.strip()]
    if not verbs:
        raise SystemExit('nothing to do: pass --all or --verbs')

    os.makedirs(DRAFTS, exist_ok=True)
    exemplars = [load_exemplar(rel, name) for rel, name in EXEMPLARS]

    from mlx_lm import load, generate
    from mlx_lm.sample_utils import make_sampler, make_logits_processors
    repo = MODELS[args.model]
    sys.stderr.write('loading %s ...\n' % repo)
    model, tokenizer = load(repo)
    sampler = make_sampler(temp=args.temp)
    # Qwen3-Coder degenerates into a sentence-repetition loop on this prompt
    # at temp 0.3 with no penalty (observed 2026-08-03, `append!`, 17k chars of
    # one sentence). Keep the penalty on for both models.
    procs = make_logits_processors(repetition_penalty=args.rep_penalty,
                                   repetition_context_size=256)

    for verb in verbs:
        out_path = os.path.join(DRAFTS, safe_name(verb) + '.slat')
        if os.path.exists(out_path) and not args.force:
            sys.stderr.write('skip (exists): %s\n' % verb)
            continue
        spec_path = os.path.join(SPEC_PACK, safe_name(verb) + '.slatl')
        if not os.path.exists(spec_path):
            sys.stderr.write('NO SPEC PACK for %s — skipping\n' % verb)
            continue
        spec_text = open(spec_path, encoding='utf-8').read()

        t0 = time.time()
        raw = generate(model, tokenizer,
                       prompt=frame(args.model, build_prompt(verb, spec_text, exemplars),
                                    tokenizer),
                       max_tokens=args.max_tokens, sampler=sampler,
                       logits_processors=procs, verbose=False)
        rec = clean(raw)
        if degenerate(rec):
            sys.stderr.write('DEGENERATE output for %s — not written. Re-run it.\n' % verb)
            continue
        rec, n_notes, n_scrubbed = scrub_notes(rec)
        header = (';;; DRAFT — %s\n'
                  ';;; Generated %s by scratch/pairs/draft_records.py (model: %s).\n'
                  ';;; NOT REVIEWED until an editor signs it. Every :note is the\n'
                  ';;; literal placeholder PENDING-ENGINE and is filled later by a\n'
                  ';;; deterministic script that runs the snippet on the cons-cell\n'
                  ';;; engine and takes stdout. %d notes, %d scrubbed by the guard.\n\n'
                  % (verb, time.strftime('%Y-%m-%d'), repo, n_notes, n_scrubbed))
        with open(out_path, 'w', encoding='utf-8') as f:
            f.write(header + rec + '\n')
        sys.stderr.write('%-22s %5.1fs  %5d chars  notes=%d scrubbed=%d\n'
                         % (verb, time.time() - t0, len(rec), n_notes, n_scrubbed))


if __name__ == '__main__':
    main()
