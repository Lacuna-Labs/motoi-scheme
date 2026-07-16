"""Slat writer — emits Python dicts as slat lines.

Public surface
--------------

:func:`dumps` — one dict → one slat line (no trailing newline).
:func:`dump` — iterable of dicts → slat stream on a file.
:func:`dumps_pretty` — multi-line pretty printer for humans (NOT
line-safe; do not persist).

Round-trip
----------

For any dict :data:`d` produced by :func:`~forge.corpus.slat_reader.loads`,
``loads(dumps(d)) == d`` — modulo :class:`fractions.Fraction`
normalization and structural-sharing expansion.
"""

from __future__ import annotations

from fractions import Fraction
from typing import Any, Iterable, TextIO

from .reader import SlatValue


_KEY_ORDER_HINTS = ("_form", "id", "ts", "kind", "from", "to")


def _emit(value: Any) -> str:
    if value is None:
        return "nil"
    if value is True:
        return "#t"
    if value is False:
        return "#f"
    if isinstance(value, SlatValue):
        if value.kind == "symbol":
            return str(value.value)
        if value.kind == "keyword":
            return f":{value.value}"
        if value.kind == "rational":
            f = value.value
            return f"{f.numerator}/{f.denominator}"
        if value.kind == "char":
            ch = value.value
            mapped = {" ": "space", "\n": "newline", "\t": "tab", "\r": "return"}
            return f"#\\{mapped.get(ch, ch)}"
        raise ValueError(f"unknown SlatValue kind: {value.kind}")
    if isinstance(value, Fraction):
        return f"{value.numerator}/{value.denominator}"
    if isinstance(value, bool):  # narrower than int check
        return "#t" if value else "#f"
    if isinstance(value, int):
        return str(value)
    if isinstance(value, float):
        # Keep round-trip-friendly repr
        return repr(value)
    if isinstance(value, str):
        return _emit_string(value)
    if isinstance(value, list):
        return "(" + " ".join(_emit(x) for x in value) + ")"
    if isinstance(value, dict):
        return _emit_form(value)
    raise TypeError(f"cannot emit {type(value).__name__}")


def _emit_string(s: str) -> str:
    escaped = (
        s.replace("\\", "\\\\")
        .replace('"', '\\"')
        .replace("\n", "\\n")
        .replace("\r", "\\r")
        .replace("\t", "\\t")
    )
    return f'"{escaped}"'


def _emit_form(d: dict) -> str:
    parts: list[str] = []

    head = d.get("_form")
    if head is not None:
        parts.append(str(head))

    # order: hinted keys first, then the rest alphabetically
    keys = list(d.keys())
    keys_sorted = sorted(
        (k for k in keys if k not in {"_form", "_positional", "_comment"}),
        key=lambda k: (_KEY_ORDER_HINTS.index(k) if k in _KEY_ORDER_HINTS else 999, k),
    )

    for k in keys_sorted:
        parts.append(f":{k}")
        parts.append(_emit(d[k]))

    for p in d.get("_positional", []):
        parts.append(_emit(p))

    if "_comment" in d:
        comments = d["_comment"]
        if isinstance(comments, list):
            for c in comments:
                parts.append(f";{c}")
        else:
            # inline comments at end are legal but ugly; use block form
            parts.append(f"#|{comments}|#")

    return "(" + " ".join(parts) + ")"


def dumps(obj: dict) -> str:
    """Emit one slat line for the given form dict."""

    return _emit_form(obj)


def dump(objs: Iterable[dict], stream: TextIO, shebang: bool = True) -> None:
    """Write an iterable of forms to a stream, one per line."""

    if shebang:
        stream.write(";;;slat 1.0\n")
    for obj in objs:
        stream.write(dumps(obj))
        stream.write("\n")


def dumps_pretty(obj: dict, indent: int = 2) -> str:
    """Human-friendly multi-line rendering. NOT slat-line-safe.

    Use for reading; never persist. The reader will reject multi-line
    forms.
    """

    return _pretty(obj, indent, 0)


def _pretty(value: Any, indent: int, depth: int) -> str:
    pad = " " * (indent * depth)
    inner_pad = " " * (indent * (depth + 1))

    if isinstance(value, dict):
        head = value.get("_form")
        pairs: list[tuple[str, Any]] = []
        for k in value:
            if k in {"_form", "_positional", "_comment"}:
                continue
            pairs.append((k, value[k]))

        opening = "(" + (str(head) if head else "")
        lines = [opening]
        for k, v in pairs:
            lines.append(f"{inner_pad}:{k} {_pretty(v, indent, depth + 1).lstrip()}")
        for p in value.get("_positional", []):
            lines.append(f"{inner_pad}{_pretty(p, indent, depth + 1).lstrip()}")
        if "_comment" in value:
            c = value["_comment"]
            if isinstance(c, list):
                for x in c:
                    lines.append(f"{inner_pad}; {x}")
            else:
                lines.append(f"{inner_pad}; {c}")
        # close on its own line if we expanded
        if len(lines) == 1:
            return f"{pad}{opening})"
        return "\n".join([lines[0], *lines[1:], f"{pad})"]) if depth == 0 else "\n".join(lines) + f"\n{pad})"

    return pad + _emit(value)
