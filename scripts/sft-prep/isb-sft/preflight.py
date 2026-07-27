"""Preflight gates — hard-fail before training. Alfred sees the failure.

Each gate is a boolean check with a human-readable failure message. All
gates must PASS for training to fire.
"""
from __future__ import annotations

from collections import Counter


BLOOM_LEVELS = ("remember", "understand", "apply", "analyze", "evaluate", "create")
PHILOSOPHERS = (
    "wittgenstein-late-aspect",
    "wittgenstein-early",
    "peirce-abduction",
    "popper-evidence",
    "aristotle-nous",
    "aristotle-syllogism",
    "lacan-reversal",
    "lacan-metonymy",
    "jung-cross-axis",
)


def gate_min_total(pairs: list[dict], threshold: int = 50000) -> tuple[bool, str]:
    n = len(pairs)
    if n < threshold:
        return False, f"total pairs {n:,} < threshold {threshold:,}"
    return True, f"total pairs {n:,} >= {threshold:,}"


def gate_bloom_coverage(pairs: list[dict], min_per_level: int = 500) -> tuple[bool, str]:
    c = Counter(p["tags"].get("bloom") for p in pairs)
    missing = [b for b in BLOOM_LEVELS if c[b] < min_per_level]
    if missing:
        return False, f"Bloom levels below {min_per_level}: {missing}"
    return True, f"all 6 Bloom levels >= {min_per_level} pairs each"


def gate_philosopher_coverage(pairs: list[dict], min_per_phil: int = 200) -> tuple[bool, str]:
    c = Counter(p["tags"].get("philosopher") for p in pairs)
    active = [ph for ph in PHILOSOPHERS if c[ph] >= min_per_phil]
    if len(active) < 6:
        return False, f"only {len(active)}/9 philosopher-shapes >= {min_per_phil} pairs"
    return True, f"{len(active)}/9 philosopher-shapes active (>= {min_per_phil} each)"


def gate_substrate_coverage(pairs: list[dict]) -> tuple[bool, str]:
    c = Counter(p["tags"].get("substrate") for p in pairs)
    required = ("reference", "graph", "book", "cart")
    missing = [s for s in required if c[s] == 0]
    if missing:
        return False, f"missing substrates: {missing}"
    return True, f"all 4 substrates present: {dict(c)}"


def gate_concept_dedup(pairs: list[dict], max_ratio: float = 0.3) -> tuple[bool, str]:
    c = Counter()
    for p in pairs:
        c[p["tags"].get("concept") or p["tags"].get("cart") or p["tags"].get("book")] += 1
    top = c.most_common(1)[0]
    ratio = top[1] / len(pairs)
    if ratio > max_ratio:
        return (
            False,
            f"concept '{top[0]}' dominates: {top[1]:,} pairs = {ratio*100:.1f}% (> {max_ratio*100:.0f}%)",
        )
    return True, f"top concept '{top[0]}' at {top[1]:,} pairs = {ratio*100:.1f}%"


def gate_no_consecutive_runs(pairs: list[dict], max_run: int = 5) -> tuple[bool, str]:
    """No more than max_run consecutive pairs with same concept-tag."""
    from interleave import concept_of

    run_start = 0
    worst_run = 0
    worst_concept = ""
    for i in range(1, len(pairs)):
        if concept_of(pairs[i]) == concept_of(pairs[i - 1]) and concept_of(pairs[i]):
            run = i - run_start + 1
            if run > worst_run:
                worst_run = run
                worst_concept = concept_of(pairs[i])
        else:
            run_start = i
    if worst_run > max_run:
        return False, f"longest consecutive run: {worst_run} of '{worst_concept}' (> {max_run})"
    return True, f"longest consecutive run: {worst_run} <= {max_run}"


def gate_pair_shape(pairs: list[dict]) -> tuple[bool, str]:
    """Every pair has non-empty user + motoi + bloom + philosopher tags."""
    bad = 0
    for p in pairs:
        if not p.get("user") or not p.get("motoi"):
            bad += 1
            continue
        t = p.get("tags", {})
        if not t.get("bloom") or not t.get("philosopher") or not t.get("substrate"):
            bad += 1
    if bad:
        return False, f"{bad} pairs missing required fields (user/motoi/bloom/philosopher/substrate)"
    return True, "all pairs well-formed"


ALL_GATES = [
    ("min-total", gate_min_total),
    ("bloom-coverage", gate_bloom_coverage),
    ("philosopher-coverage", gate_philosopher_coverage),
    ("substrate-coverage", gate_substrate_coverage),
    ("concept-dedup", gate_concept_dedup),
    ("no-consecutive-runs", gate_no_consecutive_runs),
    ("pair-shape", gate_pair_shape),
]


def run_preflight(pairs: list[dict]) -> tuple[bool, list[tuple[str, bool, str]]]:
    results = []
    all_pass = True
    for name, gate in ALL_GATES:
        ok, msg = gate(pairs)
        results.append((name, ok, msg))
        if not ok:
            all_pass = False
    return all_pass, results
