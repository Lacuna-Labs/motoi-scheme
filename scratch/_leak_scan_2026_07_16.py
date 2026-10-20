#!/usr/bin/env python3
"""Curator-operator leak scanner for Motoi books.
Read-only. Emits SLAT report to stdout.
"""
import os
import re
import json
from pathlib import Path
from collections import defaultdict

BOOKS_ROOT = Path("/Users/alfred/code/motoi-scheme/scheme-books")

BOOKS = [
    "book-extensions", "book-of-animation", "book-of-arcade-games",
    "book-of-challenges", "book-of-cs-curriculum", "book-of-extensions",
    "book-of-instruments", "book-of-jesse", "book-of-logic",
    "book-of-math", "book-of-motion", "book-of-music",
    "book-of-narrative-games", "book-of-one-shot", "book-of-reason",
    "book-of-reason-code", "book-of-scheme", "book-of-simulation-games",
    "book-of-slat", "book-of-sound", "book-of-values",
]

# Weighted patterns. Weight = severity contribution per match.
# 'strong' = clear Curator/persona; 'medium' = likely operator flow; 'weak' = commerce word.
PATTERNS = [
    # Strong: named products/personas/apps
    ("strong", r"\bsakura\b", "sakura persona"),
    ("strong", r"\bcurator\b", "curator app"),
    ("strong", r"\bhello[- ]?surface\b", "hellosurface"),
    ("strong", r"\blacuna labs\b", "lacuna labs"),
    ("strong", r"\betsy\b", "etsy"),
    ("strong", r"\bebay\b", "ebay"),
    ("strong", r"\bshopify\b", "shopify"),
    ("strong", r"\binstagram\b", "instagram"),
    ("strong", r"\bfacebook\b", "facebook"),
    ("strong", r"\bgoogle shopping\b", "google shopping"),
    ("strong", r"\bmeta ads\b", "meta ads"),
    # Strong: dialect verbs (namespace)
    ("strong", r"\bsakura/[a-z]", "sakura/ verb"),
    ("strong", r"\bshop/[a-z]", "shop/ verb"),
    ("strong", r"\bcard/[a-z]", "card/ verb"),
    ("strong", r"\bshoppe/[a-z]", "shoppe/ verb"),
    ("strong", r"\bradio/[a-z]", "radio/ verb"),
    ("strong", r"\bcine/[a-z]", "cine/ verb"),
    ("strong", r"\bflower/[a-z]", "flower/ verb"),
    ("strong", r"\bafford/[a-z]", "afford/ verb"),
    # Medium: operator flow
    ("medium", r"\boperator\b", "operator"),
    ("medium", r"\bshopkeeper\b", "shopkeeper"),
    ("medium", r"\bcommerce\b", "commerce"),
    ("medium", r"\bmarketplace\b", "marketplace"),
    ("medium", r"\blisting\b", "listing"),
    ("medium", r"\bsku\b", "sku"),
    ("medium", r"\bseller\b", "seller"),
    ("medium", r"\bbuyer\b", "buyer"),
    # Weak: could be legitimate abstract usage
    ("weak", r"\binventory\b", "inventory"),
    ("weak", r"\bcatalog\b", "catalog"),
    ("weak", r"\bcustomer\b", "customer"),
    ("weak", r"\bpricing\b", "pricing"),
    ("weak", r"\binvoice\b", "invoice"),
    ("weak", r"\breceipt\b", "receipt"),
    ("weak", r"\brefund\b", "refund"),
    ("weak", r"\bpayment\b", "payment"),
    ("weak", r"\bpurchase\b", "purchase"),
    ("weak", r"\bcart-buy\b", "cart-buy"),
    ("weak", r"\bfees\b", "fees"),
    ("weak", r"\btaxes\b", "taxes"),
    ("weak", r"\bcortex\b", "cortex"),  # cortex is Motoi runtime; count but soft
]

# Files whose SHAPE (title/first-500-lines mention) is entirely Curator-operator
def scan_file(path: Path):
    try:
        text = path.read_text(errors="replace")
    except Exception as e:
        return None
    lower = text.lower()
    counts = defaultdict(int)
    samples = defaultdict(list)
    for tier, pat, label in PATTERNS:
        for m in re.finditer(pat, lower):
            counts[label] += 1
            if len(samples[label]) < 2:
                # capture ~120 chars around match
                s, e = m.start(), m.end()
                snippet = text[max(0, s-60):min(len(text), e+60)].replace("\n", " ")
                samples[label].append(snippet.strip())
    return counts, samples, len(text)

def classify(counts, path_str, size):
    strong_labels = {"sakura persona", "curator app", "hellosurface", "lacuna labs",
                     "etsy", "ebay", "shopify", "instagram", "facebook",
                     "google shopping", "meta ads",
                     "sakura/ verb", "shop/ verb", "card/ verb", "shoppe/ verb",
                     "radio/ verb", "cine/ verb", "flower/ verb", "afford/ verb"}
    medium_labels = {"operator", "shopkeeper", "commerce", "marketplace",
                     "listing", "sku", "seller", "buyer"}
    weak_labels = {"inventory", "catalog", "customer", "pricing", "invoice",
                   "receipt", "refund", "payment", "purchase", "cart-buy",
                   "fees", "taxes"}
    # cortex is Motoi runtime — do not count toward severity
    strong = sum(counts.get(k, 0) for k in strong_labels)
    medium = sum(counts.get(k, 0) for k in medium_labels)
    weak = sum(counts.get(k, 0) for k in weak_labels)

    # Filename hints for known-Curator files
    fname_lower = path_str.lower()
    fname_curator_hint = any(t in fname_lower for t in [
        "etsy", "shop-open", "shoppe", "sakura", "curator", "commercial-mode",
        "shop-verb", "operator", "price-check", "photo-tag",
        "sakura-in-the-line",
    ])

    # Book-of-values commerce is abstract per user brief; downweight
    if "book-of-values" in path_str:
        weak = max(0, weak - 4)

    # book-of-narrative-games inventory = game state — downweight one 'inventory' file
    if "book-of-narrative-games" in path_str and "inventory" in fname_lower:
        weak = max(0, weak - 8)

    # Rule scoring
    if strong >= 40 or fname_curator_hint and strong >= 5:
        severity = "severe"
    elif strong >= 10:
        severity = "severe"
    elif strong >= 3 or medium >= 20:
        severity = "moderate"
    elif strong >= 1 or medium >= 3 or weak >= 8:
        severity = "minor"
    else:
        severity = "none"

    # Ambiguity: mostly weak signals in an otherwise abstract book
    if severity == "minor" and strong == 0 and medium <= 2:
        # weak-only in academic books → ambiguous (math/OR/simulation legit uses)
        if any(b in path_str for b in ["book-of-math", "book-of-logic",
                                        "book-of-simulation-games",
                                        "book-of-cs-curriculum",
                                        "book-of-narrative-games",
                                        "book-of-arcade-games"]):
            severity = "ambiguous"

    return severity, strong, medium, weak


def main():
    all_files = []
    per_book = defaultdict(list)
    for book in BOOKS:
        book_path = BOOKS_ROOT / book
        if not book_path.exists():
            continue
        for p in book_path.rglob("*"):
            if "_archive" in p.parts:
                continue
            if not p.is_file():
                continue
            if p.suffix not in (".slat", ".slatl", ".md"):
                continue
            all_files.append(p)
            per_book[book].append(p)

    results = []
    for p in all_files:
        r = scan_file(p)
        if r is None:
            continue
        counts, samples, size = r
        rel = str(p.relative_to(BOOKS_ROOT))
        book = p.relative_to(BOOKS_ROOT).parts[0]
        chapter = "/".join(p.relative_to(BOOKS_ROOT).parts[1:])
        severity, strong, medium, weak = classify(counts, rel, size)

        # Pick best sample
        sample_text = ""
        sample_label = ""
        for lbl in ["sakura persona", "curator app", "sakura/ verb", "shop/ verb",
                    "card/ verb", "shoppe/ verb", "etsy", "shopify", "ebay",
                    "operator", "shopkeeper", "commerce", "marketplace",
                    "listing", "sku", "inventory"]:
            if samples.get(lbl):
                sample_text = samples[lbl][0]
                sample_label = lbl
                break

        results.append({
            "book": book,
            "chapter": chapter,
            "path": rel,
            "severity": severity,
            "strong": strong,
            "medium": medium,
            "weak": weak,
            "sample": sample_text,
            "sample_label": sample_label,
            "counts": dict(counts),
        })

    # Distribution
    dist = defaultdict(int)
    for r in results:
        dist[r["severity"]] += 1

    # Per-book summary
    book_summary = {}
    for book in BOOKS:
        book_files = [r for r in results if r["book"] == book]
        leak_files = [r for r in book_files if r["severity"] not in ("none",)]
        severe_files = [r for r in book_files if r["severity"] == "severe"]
        moderate_files = [r for r in book_files if r["severity"] == "moderate"]
        minor_files = [r for r in book_files if r["severity"] == "minor"]
        ambiguous_files = [r for r in book_files if r["severity"] == "ambiguous"]
        max_sev = "none"
        for lvl in ("severe", "moderate", "minor", "ambiguous"):
            if any(r["severity"] == lvl for r in book_files):
                max_sev = lvl
                break
        book_summary[book] = {
            "total_files": len(book_files),
            "leak_files": len(leak_files),
            "severe": len(severe_files),
            "moderate": len(moderate_files),
            "minor": len(minor_files),
            "ambiguous": len(ambiguous_files),
            "max_severity": max_sev,
        }

    return {
        "total_files": len(all_files),
        "results": results,
        "distribution": dict(dist),
        "book_summary": book_summary,
    }


if __name__ == "__main__":
    out = main()
    print(json.dumps(out, indent=2))
