"""Balance report — human-readable distribution across all dimensions.

Prints to stdout AND writes a copy to the run directory so Alfred can inspect
before approving the training fire.
"""
from __future__ import annotations

from collections import Counter
from pathlib import Path


def _pct(n: int, total: int) -> str:
    if not total:
        return "0.0%"
    return f"{100.0 * n / total:.1f}%"


def _bar(pct_str: str, width: int = 30) -> str:
    pct = float(pct_str.rstrip("%"))
    filled = int(width * pct / 100.0)
    return "#" * filled + "." * (width - filled)


def format_report(pairs: list[dict]) -> str:
    n = len(pairs)
    lines = []
    lines.append("=" * 74)
    lines.append(f"ISB-SFT balance report — {n:,} total pairs")
    lines.append("=" * 74)

    substrate = Counter(p["tags"].get("substrate") for p in pairs)
    lines.append("\n## substrate")
    for s, c in substrate.most_common():
        pct = _pct(c, n)
        lines.append(f"  {s:12} {c:>7,}  {pct:>7}  {_bar(pct)}")

    bloom = Counter(p["tags"].get("bloom") for p in pairs)
    lines.append("\n## Bloom's Taxonomy — 6 levels")
    bloom_order = ("remember", "understand", "apply", "analyze", "evaluate", "create")
    for b in bloom_order:
        c = bloom.get(b, 0)
        pct = _pct(c, n)
        lines.append(f"  {b:12} {c:>7,}  {pct:>7}  {_bar(pct)}")

    phil = Counter(p["tags"].get("philosopher") for p in pairs)
    lines.append("\n## Philosopher-shape overlay")
    for p, c in phil.most_common():
        pct = _pct(c, n)
        lines.append(f"  {p:30} {c:>7,}  {pct:>7}")

    shape = Counter(p["tags"].get("shape") for p in pairs)
    lines.append("\n## Shape (top 25)")
    for s, c in shape.most_common(25):
        pct = _pct(c, n)
        lines.append(f"  {s:32} {c:>7,}  {pct:>7}")

    lines.append("\n## Reference sub-metrics")
    ref = [p for p in pairs if p["tags"].get("substrate") == "reference"]
    if ref:
        rsub = Counter(p["tags"].get("shape") for p in ref)
        lines.append(f"  {len(ref):,} reference pairs; shape variety = {len(rsub)}")

    lines.append("\n## Graph sub-metrics")
    gr = [p for p in pairs if p["tags"].get("substrate") == "graph"]
    if gr:
        by_axis = Counter(p["tags"].get("axis") for p in gr)
        by_tier = Counter(p["tags"].get("tier") for p in gr)
        lines.append(f"  {len(gr):,} graph pairs")
        for a, c in by_axis.most_common():
            lines.append(f"    axis {a:10} {c:>7,}  {_pct(c, len(gr)):>7}")
        for t, c in sorted(by_tier.items()):
            lines.append(f"    tier T{t:>2}: {c:>7,}  {_pct(c, len(gr)):>7}")

    lines.append("\n## Book sub-metrics")
    bk = [p for p in pairs if p["tags"].get("substrate") == "book"]
    if bk:
        by_bt = Counter(p["tags"].get("book_type") for p in bk)
        by_book = Counter(p["tags"].get("book") for p in bk)
        lines.append(f"  {len(bk):,} book pairs across {len(by_book)} books")
        for bt, c in by_bt.most_common():
            lines.append(f"    book-type {bt:14} {c:>7,}  {_pct(c, len(bk)):>7}")

    lines.append("\n## Cart sub-metrics")
    ct = [p for p in pairs if p["tags"].get("substrate") == "cart"]
    if ct:
        by_cart = Counter(p["tags"].get("cart") for p in ct)
        lines.append(f"  {len(ct):,} cart pairs across {len(by_cart)} carts")
        lines.append(f"  mean pairs per cart: {len(ct)/len(by_cart):.1f}")

    concept = Counter(
        p["tags"].get("concept") or p["tags"].get("cart") or p["tags"].get("book")
        for p in pairs
    )
    lines.append("\n## Top 15 concepts by pair count")
    for c, cnt in concept.most_common(15):
        pct = _pct(cnt, n)
        lines.append(f"  {(c or '(none)')[:40]:40} {cnt:>7,}  {pct:>7}")

    total_concepts = len(concept)
    top500 = sum(cnt for c, cnt in concept.most_common(500))
    lines.append(f"\n## Zipfian check")
    lines.append(f"  total distinct concepts: {total_concepts:,}")
    lines.append(f"  top 500 concepts hold:   {top500:,} pairs  ({_pct(top500, n)})")

    lines.append("\n" + "=" * 74)
    return "\n".join(lines)


def write_report(pairs: list[dict], out_path: Path) -> None:
    out_path.write_text(format_report(pairs), encoding="utf-8")
