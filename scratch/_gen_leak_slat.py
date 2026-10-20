#!/usr/bin/env python3
"""Generate SLAT report from leak scan JSON."""
import json
from pathlib import Path

DATA = json.load(open("/tmp/leak_raw.json"))

def s(x, maxlen=180):
    """Escape+truncate for SLAT string."""
    if not x:
        return ""
    x = str(x).replace("\\", "\\\\").replace('"', '\\"').replace("\n", " ")
    if len(x) > maxlen:
        x = x[:maxlen-3] + "..."
    return x

def recommend(r):
    sev = r["severity"]
    fn = r["path"].lower()
    if sev == "severe":
        if "book-of-reason" in fn or "book-of-scheme" in fn or "book-of-reason-code" in fn:
            return "move-whole-file"
        if any(t in fn for t in ["etsy", "shoppe", "sakura", "shop-open",
                                  "price-check", "operator", "commercial-mode",
                                  "shop-verb", "photo-tag", "sakura-in-the-line",
                                  "hello-sakura", "fork-vertical", "fork-protocol",
                                  "metered-verb", "cross-book-composition",
                                  "cost-consent", "compose-shop"]):
            return "move-whole-file"
        return "surgical-strip-persona-then-keep-shell"
    if sev == "moderate":
        return "surgical-strip-persona"
    if sev == "minor":
        return "excise-mentions"
    if sev == "ambiguous":
        return "review-manually"
    return "leave"

def destination(r):
    return "_archive/sakura-only-moved-2026-07-16/curator-leaks-2026-07-16/"

out = []
out.append("(scan-result")
out.append('  :date "2026-07-16"')
out.append('  :scanner "Motoi Book Leak Scanner"')
out.append('  :scope "21 Motoi books, excluding _archive"')
out.append('  :method "regex-pattern-scan + per-file classification"')
out.append(f'  :books-scanned 21')
out.append(f'  :books-nonempty 20')
out.append(f'  :files-total {DATA["total_files"]}')

dist = DATA["distribution"]
leak_total = sum(v for k, v in dist.items() if k != "none")
out.append(f'  :files-with-leak {leak_total}')
out.append(f'  :severity-distribution (:none {dist.get("none",0)} :minor {dist.get("minor",0)} :moderate {dist.get("moderate",0)} :severe {dist.get("severe",0)} :ambiguous {dist.get("ambiguous",0)})')

# Per-book summaries
out.append('  :book-summaries')
out.append('    (')
for book, sm in sorted(DATA["book_summary"].items(), key=lambda kv: -kv[1]["leak_files"]):
    out.append(f'     (:book "{book}" :total-files {sm["total_files"]} :leak-files {sm["leak_files"]} :severe {sm["severe"]} :moderate {sm["moderate"]} :minor {sm["minor"]} :ambiguous {sm["ambiguous"]} :max-severity :{sm["max_severity"]})')
out.append('    )')

# Per-file entries — all with leak
out.append('  :per-file')
out.append('    (')
results = [r for r in DATA["results"] if r["severity"] != "none"]
# Sort by severity rank then by strong count
sev_rank = {"severe": 0, "moderate": 1, "minor": 2, "ambiguous": 3}
results.sort(key=lambda r: (sev_rank.get(r["severity"], 9), -r["strong"], -r["medium"], r["path"]))
for r in results:
    rec = recommend(r)
    dest = destination(r)
    sample = s(r["sample"])
    sample_label = s(r["sample_label"], 40)
    out.append(f'     (:book "{r["book"]}"')
    out.append(f'      :chapter "{r["chapter"]}"')
    out.append(f'      :severity :{r["severity"]}')
    out.append(f'      :strong-hits {r["strong"]} :medium-hits {r["medium"]} :weak-hits {r["weak"]}')
    out.append(f'      :sample-label "{sample_label}"')
    out.append(f'      :sample "{sample}"')
    out.append(f'      :recommend "{rec}"')
    out.append(f'      :destination "{dest}")')
out.append('    )')

# Notes
out.append('  :notes')
out.append('    ("book-extensions is empty (no files)."')
out.append('     "book-of-values is fully clean — the abstract money-not-a-scalar doctrine as expected."')
out.append('     "book-of-reason is 121/121 leaking (100%) — every chapter is Sakura-persona prompt-injection / adversarial-reasoning content. All chapters use sakura/* verbs and refer to \\"the operator\\", \\"Sakura\\", \\"her cortex\\". Whole book looks like a candidate to move to Sakura archive."'  )
out.append('     "book-of-reason-code is 39/39 leaking. Sample: ch15-sakura-in-the-line is explicit."')
out.append('     "book-of-scheme opens with ch01 titled hello-sakura-scheme, dialect :applies (\\"motoi\\" \\"sakura\\"), voice :sakura-teaching. Ramp-up chapters carry Sakura framing throughout."')
out.append('     "book-of-motion uses \\"Sakura\\" as the default entity name for animation demos (world/spawn \\"sakura\\" ...). ch02 velocity and ch13 style are the worst."')
out.append('     "book-of-music references \\"Curator-16\\" font, \\"Sakura Music Book\\", Sakura conducting."')
out.append('     "book-of-slat has \\"sakura-narrates: true\\" metadata + \\"Sakura says\\" callouts embedded in most chapter headers."')
out.append('     "book-of-instruments same pattern: \\"sakura-narrates: true\\" metadata + \\"instruments Sakura can voice\\" framing."')
out.append('     "book-of-extensions is a straight commerce/operator/etsy-adapter/metered-verbs book — probably belongs in Sakura archive as a whole."')
out.append('     "book-of-challenges ch10 orchestrating-tools uses etsy/shop-stats and quote-Sakura-quote commerce life framing — several other chapters heavy on shop verbs."')
out.append('     "Many files carry :source-path pointing to /Users/alfred/code/curator/BOOK/ — that alone is a rebrand-residue signal beyond the leak content."')
out.append('     "Suggested whole-book moves: book-of-reason, book-of-reason-code, book-of-extensions."')
out.append('     "Suggested surgical-strip books: book-of-motion, book-of-music, book-of-slat, book-of-instruments, book-of-scheme, book-of-challenges."'  )
out.append('     "Ambient rebrand needed on almost every file: \\"Sakura\\" -> Motoi persona-neutral, \\"sakura-narrates\\" header removal, \\"Curator-16\\" -> Motoi font name, source-path curator/BOOK/ retargeting."'  )
out.append('    ))')

print("\n".join(out))
