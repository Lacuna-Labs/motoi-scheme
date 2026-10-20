#!/usr/bin/env python3
"""
scrub_sakura_curator.py — remove Sakura + Curator references from the Motoi fold.
(Alfred, 2026-07-30: "Remove Sakura and Curator references. Totally unnecessary.
Remove references to the products also — desktops and cards that have anything to
do with Sakura and her behavior.")

Doctrine: NO fabrication (we DELETE spans, never invent replacement prose), NO
silent loss (every dropped record is archived to a dated attic jsonl). Preserve
good teaching where the reference is incidental: rename code variables, neutralize
metadata paths, strip signifier-list tokens; only DROP records that are actually
ABOUT Sakura/Curator (identity, her behavior, the dialect/world) or whose prose
can't be salvaged without fabrication.

Per record, in order:
  T0  whole-record DROP  — [word:sakura/curator] self-definition, or a small
                           record centered on Sakura identity/behavior/dialect/
                           world, or Curator card/desktop/canvas behavior.
  T1  code rename        — inside ``` fences, `\bsakura\b` -> `hero` (keeps the
                           snippet valid Scheme; removes the persona name).
  T2  metadata neutralize— curator in file paths -> motoi; ~/.cortex/sakura ->
                           ~/.cortex/motoi; voice "sakura*" -> "motoi-teaching";
                           :dialect "sakura" -> "motoi"; dialect:applies (...
                           "sakura") -> drop "sakura"; sakura-*.slat[l] token drop.
  T3  signifier strip    — remove sakura/curator entries from comma signifier lists.
  T4  prose sentence-cut — split remaining prose on sentence bounds, drop any
                           sentence still naming sakura/curator. If that removes
                           >40% of the prose or empties the completion -> DROP.

Dry-run by default (reports + writes samples). Pass --apply to rewrite in place
(originals backed up to scratch/attic/<DATE>-sakura-curator-scrub/ first).
"""
import argparse
import json
import re
import shutil
import sys
from collections import Counter
from datetime import date
from pathlib import Path

import fold_common as fc

PAT = re.compile(r'(sakura|curator)', re.I)
FENCE = re.compile(r'```.*?```', re.S)
DATE = date.today().isoformat()
ATTIC = fc.REPO / "scratch" / "attic" / f"{DATE}-sakura-curator-scrub"

# --- record-level DROP signals (T0) ------------------------------------------
WORD_SELF = re.compile(r'\[word:(sakura|curator)\]', re.I)
ABOUT_SAKURA = re.compile(
    r"(are you sakura|same as sakura|sakura'?s (world|birthday|dialect|voice|"
    r"behaviou?r|mood)|sakura (dialect|world|scheme|character|the (assistant|"
    r"persona))|when sakura (sees|notices|decides|pauses|holds)|does sakura|"
    r"curator'?s (canvas|desktop|card|cart)|on curator'?s (canvas|desktop)|"
    r"curator (renders|card|desktop|canvas))", re.I)


def strip_fences(text):
    return FENCE.sub("", text)


def code_rename(text):
    def repl(m):
        return re.sub(r'\bsakura\b', 'hero', m.group(0))
    return FENCE.sub(repl, text)


def metadata_neutralize(text):
    t = text
    # file paths mentioning curator -> motoi (path-ish token: has a slash)
    t = re.sub(r'(?<=/)curator(?=/)', 'motoi', t)
    t = re.sub(r'code/curator\b', 'code/motoi', t)
    t = re.sub(r'~/\.cortex/sakura\b', '~/.cortex/motoi', t)
    t = re.sub(r'\bcurator:', 'motoi:', t)          # curator:artifact-cite event
    t = re.sub(r'voice\s+"sakura[^"]*"', 'voice "motoi-teaching"', t, flags=re.I)
    t = re.sub(r':dialect\s+"sakura"', ':dialect "motoi"', t, flags=re.I)
    # dialect:applies ("motoi" "sakura") -> ("motoi")
    t = re.sub(r'(dialect:applies\s*\(\s*"motoi")\s*"sakura"(\s*\))',
               r'\1\2', t, flags=re.I)
    t = re.sub(r'\(\s*"sakura"\s+"motoi"\s*\)', '("motoi")', t, flags=re.I)
    # provenance filenames sakura-<slug>.slat[l] -> drop the token
    t = re.sub(r'\bsakura-[a-z0-9-]+\.slatl?\b', '', t, flags=re.I)
    # bare sakura-emergency-canonical style slugs without extension in provenance
    t = re.sub(r'\bsakura-[a-z0-9-]*canonical\b', '', t, flags=re.I)
    return t


def signifier_strip(text):
    # comma lists: "..., sakura, ..." or trailing ", sakura." — drop the entry
    t = text
    t = re.sub(r',\s*(sakura|curator)\b', '', t, flags=re.I)
    t = re.sub(r'\b(sakura|curator)\s*,\s*', '', t, flags=re.I)
    return t


_SENT = re.compile(r'[^.!?\n]*[.!?\n]|\S[^.!?\n]*$')


def prose_sentence_cut(text):
    """Drop sentences that still name sakura/curator. Returns (newtext, cut_chars)."""
    kept, cut = [], 0
    for m in _SENT.finditer(text):
        s = m.group(0)
        if PAT.search(s):
            cut += len(s)
        else:
            kept.append(s)
    return "".join(kept), cut


# --- text-field handling per schema ------------------------------------------
def text_fields(rec):
    """Yield (getter, setter) for every training-text field of a raw record."""
    out = []
    if isinstance(rec.get("messages"), list):
        for i, msg in enumerate(rec["messages"]):
            if isinstance(msg, dict) and isinstance(msg.get("content"), str):
                def mk(i):
                    return (lambda: rec["messages"][i]["content"],
                            lambda v: rec["messages"][i].__setitem__("content", v))
                out.append(mk(i))
    for k in ("text", "instruction", "response", "output", "completion",
              "answer", "prompt", "question"):
        if isinstance(rec.get(k), str):
            def mk(k):
                return (lambda: rec[k], lambda v: rec.__setitem__(k, v))
            out.append(mk(k))
    return out


def _balanced_count(p, c):
    """How many fenced code blocks here are paren-balanced (rename-agnostic)."""
    return sum(1 for b in (fc._fenced(p) + fc._fenced(c)) if fc.paren_balanced(b)[0])


def scrub_record(rec):
    """Return ('keep'|'drop'|'modify', rec, note). rec mutated in place if modify."""
    p, c, _b, schema = fc.normalize(rec)
    joined = f"{p}\n{c}"
    if not PAT.search(joined):
        return "keep", rec, ""
    pre_balanced = _balanced_count(p, c)

    # T0 whole-record drop
    if WORD_SELF.search(joined):
        return "drop", rec, "word-self"
    non_code = strip_fences(joined)
    if len(non_code) < 700 and ABOUT_SAKURA.search(non_code):
        return "drop", rec, "about-sakura/curator"

    # T1..T4 on each field
    total_cut = 0
    for get, setv in text_fields(rec):
        v = get()
        if not PAT.search(v):
            continue
        v = code_rename(v)
        v = metadata_neutralize(v)
        v = signifier_strip(v)
        # only sentence-cut the non-code remainder that still has a hit
        if PAT.search(strip_fences(v)):
            # protect fenced code; cut only prose between fences
            parts, idx = [], 0
            for m in FENCE.finditer(v):
                pre = v[idx:m.start()]
                new_pre, cut = prose_sentence_cut(pre)
                total_cut += cut
                parts.append(new_pre)
                parts.append(m.group(0))
                idx = m.end()
            tail = v[idx:]
            new_tail, cut = prose_sentence_cut(tail)
            total_cut += cut
            parts.append(new_tail)
            v = "".join(parts)
        setv(v)

    # re-derive; if gutted or still contaminated -> drop
    p2, c2, _b2, _s2 = fc.normalize(rec)
    j2 = f"{p2}\n{c2}"
    orig_len = max(1, len(joined))
    if not c2.strip():
        return "drop", rec, "gutted-empty"
    # SFT pairs need a prompt side; if scrub gutted it (cpt has none by design,
    # exempt), the label mask has no context -> drop+archive rather than ship it.
    if schema != "cpt" and not p2.strip():
        return "drop", rec, "gutted-prompt-empty"
    if total_cut / orig_len > 0.40:
        return "drop", rec, "gutted->40pct"
    if PAT.search(j2):
        return "drop", rec, "residual-after-scrub"
    # never ship a block that scrubbing turned unbalanced: drop+archive instead
    if _balanced_count(p2, c2) < pre_balanced:
        return "drop", rec, "broke-code-block"
    return "modify", rec, "cleaned"


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--apply", action="store_true")
    ap.add_argument("--samples", type=int, default=20)
    args = ap.parse_args()

    files = fc.find_lane_files()
    actions = Counter()
    notes = Counter()
    per_file = Counter()
    samples = []
    dropped_by_file = {}

    if args.apply:
        ATTIC.mkdir(parents=True, exist_ok=True)

    for path in files:
        new_lines = []
        dropped = []
        changed = False
        # We must preserve provenance-header + blank + malformed lines verbatim.
        with open(path, "r", encoding="utf-8", errors="surrogatepass") as fh:
            raw_lines = fh.readlines()
        for raw in raw_lines:
            stripped = raw.rstrip("\n")
            if not stripped.strip():
                new_lines.append(raw)
                continue
            try:
                rec = json.loads(stripped)
            except Exception:
                new_lines.append(raw)          # keep malformed verbatim
                continue
            if isinstance(rec, dict) and rec.get("_provenance_header"):
                new_lines.append(raw)
                continue
            act, rec2, note = scrub_record(rec)
            actions[act] += 1
            if act == "keep":
                new_lines.append(raw)
            elif act == "drop":
                notes[note] += 1
                per_file[path.name] += 1
                dropped.append(stripped)
                changed = True
                if len(samples) < args.samples:
                    samples.append(("DROP/" + note, path.name, stripped[:400]))
            else:  # modify
                notes[note] += 1
                per_file[path.name] += 1
                out = json.dumps(rec2, ensure_ascii=False)
                new_lines.append(out + "\n")
                changed = True
                if len(samples) < args.samples:
                    samples.append(("MODIFY", path.name, out[:400]))

        if changed and args.apply:
            # backup original
            bkp = ATTIC / path.name
            shutil.copy2(path, bkp)
            with open(path, "w", encoding="utf-8") as fh:
                fh.writelines(new_lines)
            if dropped:
                with open(ATTIC / (path.name + ".dropped"), "w",
                          encoding="utf-8") as fh:
                    fh.write("\n".join(dropped) + "\n")
            dropped_by_file[path.name] = len(dropped)

    print("=" * 64)
    print(f" SCRUB SAKURA/CURATOR — {'APPLIED' if args.apply else 'DRY-RUN'}")
    print("=" * 64)
    print("actions:", dict(actions))
    print("notes  :", dict(notes.most_common()))
    print("\nrecords touched per file (top 15):")
    for fn, n in per_file.most_common(15):
        print(f"  {n:5} {fn}")
    print(f"\nsamples ({len(samples)}):")
    for kind, fn, s in samples:
        print(f"\n[{kind}] {fn}")
        print("  " + s.replace("\n", " ")[:360])
    if args.apply:
        print(f"\nbackups + .dropped archives in: {ATTIC}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
