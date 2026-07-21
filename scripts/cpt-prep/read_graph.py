"""Read Motoi axis-graph .slat files as node records.

Nodes span multiple lines and open with '(node ' at column 0.
This reader buffers until paren-balanced and extracts common fields.

Not a full SLAT parser — targeted field extraction for CPT prep.
"""
from __future__ import annotations
import re
from pathlib import Path
from typing import Iterator


def _paren_delta(text: str, in_string: bool) -> tuple[int, bool]:
    """String-aware paren counter. Returns (delta, new_in_string).

    Skips parens inside "..." strings. Handles backslash escapes.
    Ignores line comments starting with ';' at any depth.
    """
    delta = 0
    i = 0
    n = len(text)
    while i < n:
        c = text[i]
        if in_string:
            if c == "\\" and i + 1 < n:
                i += 2
                continue
            if c == '"':
                in_string = False
            i += 1
            continue
        if c == '"':
            in_string = True
            i += 1
            continue
        if c == ";":
            # rest of line is comment
            return delta, in_string
        if c == "(":
            delta += 1
        elif c == ")":
            delta -= 1
        i += 1
    return delta, in_string


def iter_node_blocks(path: Path) -> Iterator[str]:
    """Yield each (node ...) record as a raw string. String-aware."""
    buf = []
    depth = 0
    in_node = False
    in_string = False
    for line in path.open(encoding="utf-8", errors="replace"):
        stripped = line.lstrip()
        if not in_node:
            if stripped.startswith("(node") and (len(stripped) == 5 or not stripped[5].isalnum()):
                in_node = True
                buf = [line]
                d, in_string = _paren_delta(line, False)
                depth = d
                if depth == 0:
                    yield "".join(buf)
                    in_node = False
                    buf = []
                    in_string = False
            continue
        buf.append(line)
        d, in_string = _paren_delta(line, in_string)
        depth += d
        if depth <= 0 and not in_string:
            yield "".join(buf)
            in_node = False
            buf = []
            in_string = False


# ---------------------------------------------------------------------------
# Field extractors
# ---------------------------------------------------------------------------

def _find_field_span(block: str, field: str) -> tuple[int, int] | None:
    """Find start/end index of a top-level field's value.

    A "top-level" field is one whose ':name' appears at depth 1 inside the
    outer (node ...). We track paren depth from the outer '(' and grab the
    value that follows the keyword.
    """
    # Look for ' :field ' or '\n :field ' (with whitespace)
    for m in re.finditer(rf"[\s(]:{re.escape(field)}\b\s*", block):
        # Verify this occurrence is at outer node depth (depth 1)
        prefix = block[: m.start() + 1]  # include the leading whitespace/(
        depth = prefix.count("(") - prefix.count(")")
        if depth != 1:
            continue
        value_start = m.end()
        # Value can be: a string, symbol, keyword, list, number, boolean.
        # Determine end by scanning until we hit a keyword at depth 1 or
        # the closing paren of the node.
        i = value_start
        n = len(block)
        val_depth = 0
        in_string = False
        started = False
        while i < n:
            c = block[i]
            if not started:
                if c.isspace():
                    i += 1
                    continue
                started = True
                start_i = i
            if in_string:
                if c == "\\":
                    i += 2
                    continue
                if c == '"':
                    in_string = False
                    i += 1
                    if val_depth == 0:
                        return (start_i, i)
                    continue
                i += 1
                continue
            if c == '"':
                in_string = True
                i += 1
                continue
            if c == "(":
                val_depth += 1
                i += 1
                continue
            if c == ")":
                val_depth -= 1
                i += 1
                if val_depth == 0:
                    return (start_i, i)
                if val_depth < 0:
                    # We've exited the outer node
                    return (start_i, i - 1)
                continue
            if val_depth == 0 and c.isspace():
                # atom value ended
                return (start_i, i)
            if val_depth == 0 and c == ":":
                # next keyword at same depth
                return (start_i, i)
            i += 1
        return (start_i, n)
    return None


def get_field_raw(block: str, field: str) -> str | None:
    span = _find_field_span(block, field)
    if span is None:
        return None
    return block[span[0] : span[1]].strip()


def get_string(block: str, field: str) -> str | None:
    """Return the value of a :field that is a string, without quotes."""
    raw = get_field_raw(block, field)
    if raw is None:
        return None
    if raw.startswith('"') and raw.endswith('"'):
        return raw[1:-1]
    return raw


def get_symbol(block: str, field: str) -> str | None:
    """Return the value of a :field that is a bare symbol (e.g. :category :animal)."""
    raw = get_field_raw(block, field)
    if raw is None:
        return None
    return raw.lstrip(":").strip()


def get_list_of_strings(block: str, field: str) -> list[str]:
    """Return a list of strings from a :field like (\"a\" \"b\" \"c\")."""
    raw = get_field_raw(block, field)
    if raw is None:
        return []
    return re.findall(r'"([^"\\]*(?:\\.[^"\\]*)*)"', raw)


# Convenience: known node facets we care about for CPT prep
NODE_FACETS = [
    "id", "canonical", "axis", "tier", "subchar",
    "definition", "examples", "example-dialogue",
    "used-in-programs-as", "appears-in-corpus",
    "cross-refs-books", "cross-refs-graph", "associations",
    "distributional-neighbors", "oppositions", "cross-axis-bridge-score",
    "freq", "doc-freq", "tf-idf", "context-entropy", "idf",
    "category", "sensory-description", "where-found",
    "size-scale", "kid-familiarity",
    "definition-technical", "example-in-scheme", "example-in-world",
    "prerequisites", "appears-in-books",
    "principle-kind", "short-scenario", "antipattern-scenario",
    "related-verbs", "motoi-behavior", "related-books",
    "register-kind", "motoi-uses-when", "contrast-register",
    "related-principles",
    "surrounding-words", "context-of-use", "relations",
    "provenance", "kid-friendly", "training-eligible",
    "dialect", "audience", "content-rating", "confidentiality",
]


def parse_node(block: str) -> dict[str, str | None]:
    """Extract known facets from a node block. Values are RAW slat strings."""
    out: dict[str, str | None] = {}
    for f in NODE_FACETS:
        v = get_field_raw(block, f)
        if v is not None:
            out[f] = v
    return out


if __name__ == "__main__":
    import sys
    path = Path(sys.argv[1])
    count = 0
    tier_counts: dict[str, int] = {}
    for block in iter_node_blocks(path):
        node = parse_node(block)
        tier = node.get("tier", "?").strip('"')
        tier_counts[tier] = tier_counts.get(tier, 0) + 1
        count += 1
    print(f"Nodes: {count}")
    for t, n in sorted(tier_counts.items()):
        print(f"  tier {t}: {n}")
