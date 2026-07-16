"""Slat ↔ JSONL round-trip converter.

Slat can express symbols, keywords, rationals, and chars — none of
which JSON has native syntax for. To preserve them across the JSONL
boundary, we tag them as JSON objects::

    symbol   → {"_type": "symbol", "value": "foo"}
    keyword  → {"_type": "keyword", "value": "foo"}
    rational → {"_type": "rational", "num": 1, "denom": 3}
    char     → {"_type": "char", "value": "a"}

Comments ride along on the containing form via ``_comment``.

Structural sharing (``#0=``, ``#0#``) is expanded to inline copies on
JSON export; a re-import will re-emit inline. Callers that need share
preservation should serialize through slat directly.

Public surface
--------------

:func:`slat_to_jsonl` — stream slat records to JSON lines.
:func:`jsonl_to_slat` — stream JSON lines to slat lines.
:func:`round_trip_verify` — parse, round-trip, and diff.
"""

from __future__ import annotations

import json
from fractions import Fraction
from typing import Any, Iterable, Iterator

from .reader import SlatSyntaxError, SlatValue, load, loads
from .writer import dumps


# ---------------------------------------------------------------------------
# dict-with-SlatValues → JSON-safe dict
# ---------------------------------------------------------------------------


def _json_encode(value: Any) -> Any:
    if isinstance(value, SlatValue):
        if value.kind == "symbol":
            return {"_type": "symbol", "value": value.value}
        if value.kind == "keyword":
            return {"_type": "keyword", "value": value.value}
        if value.kind == "rational":
            f: Fraction = value.value
            return {"_type": "rational", "num": f.numerator, "denom": f.denominator}
        if value.kind == "char":
            return {"_type": "char", "value": value.value}
        raise ValueError(f"unknown SlatValue kind: {value.kind}")
    if isinstance(value, Fraction):
        return {"_type": "rational", "num": value.numerator, "denom": value.denominator}
    if isinstance(value, dict):
        return {k: _json_encode(v) for k, v in value.items()}
    if isinstance(value, list):
        return [_json_encode(v) for v in value]
    return value


def _json_decode(value: Any) -> Any:
    if isinstance(value, dict) and "_type" in value and set(value.keys()) - {"_type", "value", "num", "denom"} == set():
        t = value["_type"]
        if t == "symbol":
            return SlatValue("symbol", value["value"])
        if t == "keyword":
            return SlatValue("keyword", value["value"])
        if t == "rational":
            return SlatValue("rational", Fraction(value["num"], value["denom"]))
        if t == "char":
            return SlatValue("char", value["value"])
    if isinstance(value, dict):
        return {k: _json_decode(v) for k, v in value.items()}
    if isinstance(value, list):
        return [_json_decode(v) for v in value]
    return value


# ---------------------------------------------------------------------------
# Stream converters
# ---------------------------------------------------------------------------


def slat_to_jsonl(slat_stream: Iterable[str], strict: bool = False) -> Iterator[str]:
    """Emit JSON lines equivalent to the given slat stream."""

    for rec in load(slat_stream, strict=strict):
        yield json.dumps(_json_encode(rec), ensure_ascii=False)


def jsonl_to_slat(jsonl_stream: Iterable[str], strict: bool = False) -> Iterator[str]:
    """Emit slat lines equivalent to the given JSON-lines stream."""

    for raw in jsonl_stream:
        line = raw.rstrip("\n")
        if not line.strip():
            continue
        try:
            obj = json.loads(line)
        except json.JSONDecodeError as e:
            if strict:
                raise SlatSyntaxError(f"bad json line: {e}") from e
            yield dumps({"_form": "_bad-line", "raw": line, "error": str(e)})
            continue
        decoded = _json_decode(obj)
        if not isinstance(decoded, dict):
            # wrap a bare list/scalar in a synthetic form
            decoded = {"_form": "_value", "_positional": [decoded]}
        if "_form" not in decoded:
            decoded = {"_form": "record", **decoded}
        yield dumps(decoded)


# ---------------------------------------------------------------------------
# Round-trip check
# ---------------------------------------------------------------------------


def round_trip_verify(slat_stream: Iterable[str]) -> tuple[bool, list[dict]]:
    """Parse → JSON → slat → parse and diff against the original.

    Returns ``(True, [])`` on success, else ``(False, [diffs])``.
    Each diff is ``{"index": i, "orig": ..., "rt": ...}``.
    """

    lines = [ln for ln in slat_stream if ln.strip()]
    originals = [loads(ln) for ln in lines]
    # slat → jsonl → slat
    jsonl_lines = list(slat_to_jsonl(lines))
    slat_again = list(jsonl_to_slat(jsonl_lines))
    round_tripped = [loads(ln) for ln in slat_again]

    diffs: list[dict] = []
    for i, (orig, rt) in enumerate(zip(originals, round_tripped)):
        if orig != rt:
            diffs.append({"index": i, "orig": orig, "rt": rt})
    if len(originals) != len(round_tripped):
        diffs.append(
            {
                "index": -1,
                "orig": f"len={len(originals)}",
                "rt": f"len={len(round_tripped)}",
            }
        )
    return (not diffs, diffs)
