"""Slat reader — parses one slat line into a Python dict.

Slat is newline-delimited S-expressions. One complete ``(form ...)`` per
line. This module's job is: tokenize, parse, and canonicalize.

Public surface
--------------

:func:`loads` — parse one slat line.
:func:`load` — stream lines from a file-like object.

Design notes
------------

* One line = one top-level form. Newlines inside a form are rejected.
* Keywords (``:foo``) become dict keys. The keyword+next-value pattern is
  folded into a mapping during parse.
* Positional (non-keyword) elements after the head symbol are collected
  under ``_positional``.
* Nested forms with a leading symbol become dicts too (recursive).
* Bare lists (``(1 2 3)`` with no leading symbol) remain lists.
* The head symbol of a canonical form goes into ``_form``.
* Comments (``;`` to EOL, ``#| ... |#`` block) are captured into the
  containing form's ``_comment`` key.
* Structural sharing: ``#0=(...)`` labels, ``#0#`` references. Optional.

Tolerant mode (default): a malformed line yields
``{"_form": "_bad-line", "raw": <str>, "error": <str>}``. Strict mode
raises :class:`SlatSyntaxError`.
"""

from __future__ import annotations

from dataclasses import dataclass
from fractions import Fraction
from typing import Any, Iterable, Iterator


class SlatSyntaxError(ValueError):
    """Raised in strict mode on any parse failure."""


@dataclass(frozen=True)
class SlatValue:
    """Typed wrapper for values that JSON can't represent natively.

    Used for symbols, rationals, and chars in-memory. The writer knows
    how to emit them; the JSONL converter serializes them via a
    ``_type`` tagged object.
    """

    kind: str  # "symbol" | "rational" | "char"
    value: Any


# ---------------------------------------------------------------------------
# Tokenizer
# ---------------------------------------------------------------------------


_LPAREN = "("
_RPAREN = ")"
_STRING = "STR"
_SYMBOL = "SYM"
_KEYWORD = "KW"
_INT = "INT"
_FLOAT = "FLT"
_RATIONAL = "RAT"
_CHAR = "CHR"
_BOOL = "BOOL"
_NIL = "NIL"
_COMMENT = "CMT"
_LABEL_DEF = "LDEF"  # #0=
_LABEL_REF = "LREF"  # #0#


def _tokenize(src: str) -> list[tuple[str, Any]]:
    """Turn a slat line into a flat token stream."""

    tokens: list[tuple[str, Any]] = []
    i = 0
    n = len(src)

    while i < n:
        c = src[i]

        # whitespace (newlines inside a form are illegal — caller checks)
        if c in " \t":
            i += 1
            continue
        if c in "\r\n":
            raise SlatSyntaxError("newline inside form (slat lines are single-line)")

        # parens
        if c == "(":
            tokens.append((_LPAREN, None))
            i += 1
            continue
        if c == ")":
            tokens.append((_RPAREN, None))
            i += 1
            continue

        # line comment
        if c == ";":
            j = i + 1
            while j < n and src[j] not in "\r\n":
                j += 1
            tokens.append((_COMMENT, src[i + 1 : j].strip()))
            i = j
            continue

        # block comment #| ... |#
        if c == "#" and i + 1 < n and src[i + 1] == "|":
            j = i + 2
            depth = 1
            while j < n and depth > 0:
                if j + 1 < n and src[j] == "#" and src[j + 1] == "|":
                    depth += 1
                    j += 2
                elif j + 1 < n and src[j] == "|" and src[j + 1] == "#":
                    depth -= 1
                    j += 2
                else:
                    j += 1
            if depth != 0:
                raise SlatSyntaxError("unterminated block comment")
            tokens.append((_COMMENT, src[i + 2 : j - 2].strip()))
            i = j
            continue

        # string
        if c == '"':
            j = i + 1
            buf: list[str] = []
            while j < n:
                ch = src[j]
                if ch == "\\" and j + 1 < n:
                    esc = src[j + 1]
                    buf.append(
                        {
                            "n": "\n",
                            "t": "\t",
                            "r": "\r",
                            '"': '"',
                            "\\": "\\",
                        }.get(esc, esc)
                    )
                    j += 2
                    continue
                if ch == '"':
                    j += 1
                    break
                buf.append(ch)
                j += 1
            else:
                raise SlatSyntaxError("unterminated string")
            tokens.append((_STRING, "".join(buf)))
            i = j
            continue

        # boolean / nil / char / label
        if c == "#":
            if i + 1 >= n:
                raise SlatSyntaxError("dangling #")
            nxt = src[i + 1]
            if nxt == "t":
                tokens.append((_BOOL, True))
                i += 2
                continue
            if nxt == "f":
                tokens.append((_BOOL, False))
                i += 2
                continue
            if nxt == "\\":
                # char: #\a #\space #\newline
                j = i + 2
                while j < n and src[j] not in " \t()":
                    j += 1
                name = src[i + 2 : j]
                mapped = {
                    "space": " ",
                    "newline": "\n",
                    "tab": "\t",
                    "return": "\r",
                }.get(name, name)
                if len(mapped) != 1:
                    raise SlatSyntaxError(f"unknown char literal #\\{name}")
                tokens.append((_CHAR, mapped))
                i = j
                continue
            # #0= or #0#  (structural sharing)
            j = i + 1
            while j < n and src[j].isdigit():
                j += 1
            if j > i + 1 and j < n and src[j] in "=#":
                label = int(src[i + 1 : j])
                if src[j] == "=":
                    tokens.append((_LABEL_DEF, label))
                    i = j + 1
                    continue
                if src[j] == "#":
                    tokens.append((_LABEL_REF, label))
                    i = j + 1
                    continue
            raise SlatSyntaxError(f"unknown # sequence at pos {i}")

        # nil
        if src.startswith("nil", i) and (i + 3 == n or src[i + 3] in " \t()"):
            tokens.append((_NIL, None))
            i += 3
            continue

        # keyword :foo
        if c == ":":
            j = i + 1
            while j < n and src[j] not in " \t()":
                j += 1
            if j == i + 1:
                raise SlatSyntaxError("empty keyword")
            tokens.append((_KEYWORD, src[i + 1 : j]))
            i = j
            continue

        # number or symbol
        j = i
        while j < n and src[j] not in " \t()":
            j += 1
        raw = src[i:j]
        i = j

        num = _try_parse_number(raw)
        if num is not None:
            tokens.append(num)
        else:
            tokens.append((_SYMBOL, raw))

    return tokens


def _try_parse_number(raw: str) -> tuple[str, Any] | None:
    """Return an ``(_INT, int)`` / ``(_FLOAT, float)`` / ``(_RATIONAL, Fraction)`` token if raw is numeric, else None."""

    if not raw:
        return None
    # rational: <int>/<int>
    if "/" in raw:
        parts = raw.split("/")
        if len(parts) == 2 and _is_int_lit(parts[0]) and _is_int_lit(parts[1]):
            return (_RATIONAL, Fraction(int(parts[0]), int(parts[1])))
    if _is_int_lit(raw):
        return (_INT, int(raw))
    try:
        return (_FLOAT, float(raw))
    except ValueError:
        return None


def _is_int_lit(raw: str) -> bool:
    if not raw:
        return False
    s = raw[1:] if raw[0] in "+-" else raw
    return s.isdigit() and len(s) > 0


# ---------------------------------------------------------------------------
# Parser
# ---------------------------------------------------------------------------


def _parse(tokens: list[tuple[str, Any]]) -> Any:
    """Parse a token stream into the raw tree (lists + primitives)."""

    labels: dict[int, Any] = {}
    pos = [0]

    def read_one() -> Any:
        if pos[0] >= len(tokens):
            raise SlatSyntaxError("unexpected end of input")
        tag, val = tokens[pos[0]]
        pos[0] += 1

        if tag == _LPAREN:
            items: list[Any] = []
            while pos[0] < len(tokens) and tokens[pos[0]][0] != _RPAREN:
                items.append(read_one())
            if pos[0] >= len(tokens):
                raise SlatSyntaxError("unclosed paren")
            pos[0] += 1  # consume )
            return items
        if tag == _RPAREN:
            raise SlatSyntaxError("unexpected )")
        if tag == _LABEL_DEF:
            child = read_one()
            labels[val] = child
            return child
        if tag == _LABEL_REF:
            if val not in labels:
                raise SlatSyntaxError(f"unknown label #{val}#")
            return labels[val]
        if tag == _STRING:
            return val
        if tag == _SYMBOL:
            return SlatValue("symbol", val)
        if tag == _KEYWORD:
            return _Keyword(val)
        if tag == _INT:
            return val
        if tag == _FLOAT:
            return val
        if tag == _RATIONAL:
            return SlatValue("rational", val)
        if tag == _CHAR:
            return SlatValue("char", val)
        if tag == _BOOL:
            return val
        if tag == _NIL:
            return None
        if tag == _COMMENT:
            return _Comment(val)
        raise SlatSyntaxError(f"unknown token {tag}")

    top = read_one()
    if pos[0] != len(tokens):
        # allow trailing whitespace-only tokens; here they're gone already
        raise SlatSyntaxError("garbage after form")
    return top


# Sentinels used during parsing only.
class _Keyword:
    __slots__ = ("name",)

    def __init__(self, name: str) -> None:
        self.name = name


class _Comment:
    __slots__ = ("text",)

    def __init__(self, text: str) -> None:
        self.text = text


# ---------------------------------------------------------------------------
# Canonicalization — raw tree → dict / list / value
# ---------------------------------------------------------------------------


def _canonicalize(node: Any) -> Any:
    """Turn parse output into user-facing shapes.

    A list whose head is a symbol and whose tail alternates
    keyword/value becomes a dict with ``_form`` = head symbol name.
    A list with no keywords stays a list. Comments are collected into
    ``_comment`` on the enclosing form.
    """

    if isinstance(node, list):
        # first: recurse-canonicalize each child (except keywords, which
        # we consume in pairs below).
        children = list(node)

        # extract comments; they attach to the *containing* form
        clean: list[Any] = []
        comments: list[str] = []
        for c in children:
            if isinstance(c, _Comment):
                comments.append(c.text)
            else:
                clean.append(c)

        # detect head symbol
        head_name: str | None = None
        if clean and isinstance(clean[0], SlatValue) and clean[0].kind == "symbol":
            head_name = clean[0].value
            rest = clean[1:]
        else:
            rest = clean

        # walk rest: keyword/value pairs → dict entries; else positional
        result: dict[str, Any] = {}
        positional: list[Any] = []
        idx = 0
        while idx < len(rest):
            item = rest[idx]
            if isinstance(item, _Keyword) and idx + 1 < len(rest):
                key = item.name
                val = _canonicalize(rest[idx + 1])
                result[key] = val
                idx += 2
                continue
            positional.append(_canonicalize(item))
            idx += 1

        if head_name is None and not result and not comments:
            # a bare list — no head symbol, no keywords
            return positional

        out: dict[str, Any] = {}
        if head_name is not None:
            out["_form"] = head_name
        out.update(result)
        if positional:
            out["_positional"] = positional
        if comments:
            out["_comment"] = comments if len(comments) > 1 else comments[0]
        return out

    if isinstance(node, SlatValue):
        return node
    if isinstance(node, _Keyword):
        # bare keyword outside a pair → symbolic value
        return SlatValue("keyword", node.name)
    if isinstance(node, _Comment):
        return {"_form": "_comment", "text": node.text}
    return node


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------


def loads(line: str, strict: bool = False) -> dict:
    """Parse one slat line.

    :param line: the raw slat line (no trailing newline required).
    :param strict: if True, raise :class:`SlatSyntaxError` on failure;
        otherwise return a ``_bad-line`` sentinel.
    :returns: a dict describing the form.
    """

    text = line.strip()
    if not text:
        if strict:
            raise SlatSyntaxError("empty line")
        return {"_form": "_bad-line", "raw": line, "error": "empty line"}

    # allow the ;;;slat 1.0 shebang line silently
    if text.startswith(";;;slat"):
        return {"_form": "_shebang", "text": text.lstrip(";").strip()}

    # a bare comment-only line
    if text.startswith(";") or (text.startswith("#|") and text.endswith("|#")):
        try:
            tokens = _tokenize(text)
        except SlatSyntaxError as e:
            if strict:
                raise
            return {"_form": "_bad-line", "raw": line, "error": str(e)}
        comments = [t[1] for t in tokens if t[0] == _COMMENT]
        return {"_form": "_comment", "text": comments[0] if len(comments) == 1 else comments}

    try:
        tokens = _tokenize(text)
        # Strip any trailing comment tokens after the last )
        trailing_comments: list[str] = []
        while tokens and tokens[-1][0] == _COMMENT:
            trailing_comments.append(tokens.pop()[1])
        tree = _parse(tokens)
        out = _canonicalize(tree)
        if trailing_comments and isinstance(out, dict):
            trailing_comments.reverse()
            existing = out.get("_comment")
            if existing is None:
                out["_comment"] = (
                    trailing_comments[0] if len(trailing_comments) == 1 else trailing_comments
                )
            else:
                if not isinstance(existing, list):
                    existing = [existing]
                out["_comment"] = existing + trailing_comments
    except SlatSyntaxError as e:
        if strict:
            raise
        return {"_form": "_bad-line", "raw": line, "error": str(e)}

    if not isinstance(out, dict):
        # top-level must be a form
        if strict:
            raise SlatSyntaxError("top-level form must be a list")
        return {"_form": "_bad-line", "raw": line, "error": "top-level not a form"}

    return out


def load(stream: Iterable[str], strict: bool = False) -> Iterator[dict]:
    """Stream slat records from a file-like object or line iterable."""

    for raw in stream:
        line = raw.rstrip("\n")
        if not line.strip():
            continue
        yield loads(line, strict=strict)
