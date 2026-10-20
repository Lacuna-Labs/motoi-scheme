#!/usr/bin/env python3
"""Scrub Lacuna-eng persona/authorship leaks from the fold corpus.

Alfred 2026-07-30: "I don't want drivel about Priya and Marcus and any lacuna
eng talk on who wrote what anywhere. That's a leak." KEEP everything about the
AI world (Claude, Anthropic, Qwen, Weave, open-weights). PRESERVE real figures
(Claude Shannon, Gerald Sussman, Guy Steele). Identity anchor = "Built by
Alfred Borden of Lacuna Labs in Brooklyn, New York."

Run with no args = DRY RUN (writes scratch/scrub-review.txt, no file changes).
Run with --apply = rewrite corpus files in place (snapshot already taken).
"""
import sys, json, re
sys.path.insert(0, 'scratch')
import fold_common as fc

APPLY = "--apply" in sys.argv

# Lacuna-eng persona / agent roster (the leak). NOT real-world figures.
# Used by CONTEXTUAL rules (parens/dated/possessive/section-ref) where the
# surrounding syntax proves it is an authorship attribution, not a real name.
PERSONAS = ["Jess", "Priya", "Marcus", "Zain", "Zane", "Korra", "Sujin",
            "Architect", "Aiko", "Kofi", "Kwame", "Nkechi", "Remy", "Tomas",
            "Nair", "Tanaka", "Asante", "Laurent"]
# BARE-token drop is dangerous (deletes the word with no proof of context), so
# it runs on a RESTRICTED list. Excluded from bare-drop because they collide
# with real-world figures / code data that must survive:
#   "Tomas"  -> Tomas Mikolov (word2vec, real AI-history fact Alfred wants kept)
#   "Tanaka" -> appears only as (lastName . "Tanaka") sample data in a code demo
#   "Nair"/"Laurent"/"Asante"/"Kwame"/"Nkechi"/"Aiko"/"Remy"/"Kofi"/"Sujin"
#            -> only ever appear inside full-name/attribution contexts here;
#               keep them contextual-only to avoid nuking real names elsewhere.
BARE_DROP = ["Jess", "Priya", "Marcus", "Zain", "Zane", "Korra", "Architect"]
# Full-name forms handled first.
FULLNAMES = ["Priya Nair", "Aiko Tanaka", "Soo-Jin Park", "Kofi Asante",
             "Remy Laurent", "Abel Sussman", "Soo-Jin"]

# Real figures to protect from any edit (masked before scrub, restored after).
WHITELIST = ["Claude Shannon", "Claude E. Shannon", "Claude Elwood Shannon",
             "Gerald Sussman", "Gerald Jay Sussman", "Guy Steele",
             "Guy L. Steele", "Steele and Sussman", "Sussman and Steele",
             "Tomas Mikolov", "Mikolov", "Niels Henrik Abel", "Niels Abel",
             "Abel and Galois", "Galois"]

# Narrative uses of a persona name as a fictional character (NOT an authorship
# leak). Auto-dropping these breaks prose, so we protect + flag them for Alfred.
NARRATIVE_RE = re.compile(
    r'\b(?:call(?:ed)?\s+(?:her|him|it)|named|name\s+(?:is|was))\s+'
    r'(?:' + '|'.join(PERSONAS) + r')\b', re.I)

def mask(s):
    holds = {}
    for i, w in enumerate(WHITELIST):
        tok = f"\x00WL{i}\x00"
        if w in s:
            s = s.replace(w, tok); holds[tok] = w
    # protect narrative character-name phrases (fictional characters, not leaks)
    for j, m in enumerate(list(dict.fromkeys(NARRATIVE_RE.findall(s)))):
        tok = f"\x00NR{j}\x00"
        s = s.replace(m, tok); holds[tok] = m
    return s, holds

def unmask(s, holds):
    for tok, w in holds.items():
        s = s.replace(tok, w)
    return s

def scrub_text(s):
    orig = s
    s, holds = mask(s)
    P = '|'.join(PERSONAS + ["Abel"])
    # 1) full names -> drop
    for fn in FULLNAMES:
        s = re.sub(r'\b' + re.escape(fn) + r'\b', '', s)
    # 2) owner/docs-team attribution field:  "owner: docs-team (Jess)",
    #    "owner: docs-team (Lane 7 + Priya)"  -> "owner: docs-team"
    s = re.sub(r'(owner:[ \t]*docs-team)[ \t]*\([^)]*(?:' + P + r')[^)]*\)',
               r'\1', s)
    # 3) "Scoured 2026-07-17 (Jess):" attribution prefix -> drop
    s = re.sub(r'\bScoured[ \t]+\d{4}-\d{2}-\d{2}[ \t]*\([^)]*(?:' + P +
               r')[^)]*\)[ \t]*:?[ \t]*', '', s)
    # 4) "by Priya (Lacuna Eng)" authorship credit -> drop
    s = re.sub(r'\bby[ \t]+(?:' + P + r')[ \t]*\(Lacuna Eng\)[ \t]*', '', s)
    # 5) section attribution:  "per Priya 14.1", "Jess 12.3", "(Jess 12.4 #17)"
    s = re.sub(r'(?:\bper[ \t]+)?\b(?:' + P +
               r')[ \t]+\d+\.\d+(?:[ \t]*#\d+)?', '', s)
    # 6) parenthetical attributions:  "(Jess)"  "( Marcus )"
    s = re.sub(r'\s*\(\s*(?:' + P + r')\s*\)', '', s)
    # 7) dated authorship:  "Architect 2026-06-22:"  "Marcus 2026-07-17 -"
    s = re.sub(r'\b(?:' + P + r')\b[ \t]+\d{4}-\d{2}-\d{2}\s*[:\-—]\s*', '', s)
    # 8) possessive:  "Priya's gate" -> "the gate"
    s = re.sub(r"\b(?:" + P + r")'s\s+", 'the ', s)
    # 9) hyphen descriptors:  "Priya-style" -> "the style"
    s = re.sub(r'\b(?:' + P + r')-(style|shape|note|pattern)\b', r'the \1', s)
    # 10) leftover "+ Priya)" inside a compound paren -> ")"
    s = re.sub(r'[ \t]*\+[ \t]*(?:' + P + r')[ \t]*\)', ')', s)
    # 11) bare standalone persona tokens (RESTRICTED list) -> drop
    s = re.sub(r'\b(?:' + '|'.join(BARE_DROP) + r')\b', '', s)
    # tidy artifacts from removals
    s = re.sub(r'\(\s*\)', '', s)          # empty parens
    s = re.sub(r'[ \t]{2,}', ' ', s)        # double spaces
    s = re.sub(r'\s+([,.;:])', r'\1', s)    # space before punct
    s = unmask(s, holds)
    return s, (s != orig)

def walk(v):
    """Recursively scrub all string values. Returns (new, n_changes)."""
    n = 0
    if isinstance(v, str):
        new, ch = scrub_text(v)
        return new, (1 if ch else 0)
    if isinstance(v, dict):
        out = {}
        for k, x in v.items():
            nv, c = walk(x); out[k] = nv; n += c
        return out, n
    if isinstance(v, list):
        out = []
        for x in v:
            nv, c = walk(x); out.append(nv); n += c
        return out, n
    return v, 0

import collections

def residual_hits(a):
    """Persona names still present in scrubbed text `a`, minus protected forms.
    Whitelist real figures + narrative characters are masked during scrub, but
    `a` here is post-unmask, so re-exclude them before counting."""
    hits = []
    for name in PERSONAS + ["Abel"]:
        for m in re.finditer(r'.{0,40}\b' + name + r'\b.{0,40}', a):
            ctx = m.group(0)
            # skip protected real-figure / narrative / code-data contexts
            if any(w in ctx for w in WHITELIST): continue
            if NARRATIVE_RE.search(ctx): continue
            if re.search(r'"\s*\.\s*\\?"?' + name, ctx): continue  # alist data
            hits.append((name, ctx))
    return hits

def main():
    files = fc.find_lane_files()
    review = open("scratch/scrub-review.txt", "w")
    resid = open("scratch/scrub-residual.txt", "w")
    tot_lines = 0; tot_changed = 0; files_changed = 0
    resid_counter = collections.Counter()
    for f in files:
        lines = open(f, errors="replace").read().splitlines()
        out_lines = []; changed_here = 0
        for ln in lines:
            if not ln.strip():
                out_lines.append(ln); continue
            try:
                o = json.loads(ln)
            except Exception:
                out_lines.append(ln); continue
            new, nch = walk(o)
            if nch:
                changed_here += 1; tot_changed += 1
                b = json.dumps(o, ensure_ascii=False)
                a = json.dumps(new, ensure_ascii=False)
                # before -> after snippet, anchored on the first persona hit
                for name in PERSONAS + ["Abel"]:
                    mb = re.search(r'.{0,35}\b' + name + r'\b.{0,35}', b)
                    if mb:
                        review.write(f"[{f.name}] {name}\n")
                        review.write(f"  BEFORE: {mb.group(0)[:110]}\n")
                        ma = re.search(r'.{0,35}\b' + name + r'\b.{0,35}', a)
                        review.write(f"  AFTER : {ma.group(0)[:110] if ma else '(removed)'}\n")
                        break
                out_lines.append(a)
                for name, ctx in residual_hits(a):
                    resid_counter[name] += 1
                    resid.write(f"[{f.name}] {name}: ...{ctx.strip()}...\n")
            else:
                out_lines.append(ln)
            tot_lines += 1
        if changed_here:
            files_changed += 1
            if APPLY:
                open(f, "w").write("\n".join(out_lines) + "\n")
    review.close(); resid.close()
    mode = "APPLIED" if APPLY else "DRY RUN"
    print(f"[{mode}] scanned {tot_lines:,} records across {len(files)} files")
    print(f"[{mode}] records changed: {tot_changed:,} across {files_changed} files")
    print(f"[{mode}] before/after snippets -> scratch/scrub-review.txt")
    print(f"[{mode}] RESIDUAL persona hits after scrub (should be ~0 real leaks):")
    if resid_counter:
        for name, c in resid_counter.most_common():
            print(f"         {name:<12} {c}")
    else:
        print("         none")
    print(f"[{mode}] residual detail -> scratch/scrub-residual.txt")

if __name__ == "__main__":
    main()
