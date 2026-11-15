"""THE WORKER PROTOCOL — what Lacuna and its workers say to each other (LACUNA-1.3-DESIGN §1; the Big Forge Plan,
Part III, 2026-07-09: "Every worker speaks both").

A message is a JSON object OR a slat form — one S-expression, the shape the Sakura Scheme carts use — and the reader
tells them apart by the first byte: `{` is JSON, `(` is slat, anything else is refused. Every message has the other
form and they round-trip: `parse(dumps_slat(m)) == m` and `parse(json.dumps(m)) == m`.

    (brief :id "b-3f2a" :from lacuna :to repair-1
           :job (:class repair :brief "Fix the cart X." :constraints (:max-wall-sec 900 :max-rounds 3)))

The head symbol is the message's `kind`. `:key value` pairs become a dict; a bare list stays a list; strings are
quoted; `#t`/`#f` are booleans; integers and decimals are numbers; any other word is a symbol, kept as a string. Small
on purpose — enough to round-trip the protocol, not a Scheme (the carts' interpreter is the real one).

Kinds: brief · progress · report · need-runtime · child-graved. Standard library only (it runs inside the jail).
"""
from __future__ import annotations

import json
import re
from typing import Any

KINDS = {"brief", "progress", "report", "need-runtime", "child-graved"}
REQUIRED = {
    "brief": ("id", "to", "job"),
    "progress": ("id", "worker"),
    "report": ("id", "worker", "brief_id", "class"),
    "need-runtime": ("id", "worker", "runtime"),
    "child-graved": ("id", "worker"),
}

_TOKEN = re.compile(r'\s*(?:(\()|(\))|"((?:[^"\\]|\\.)*)"|([^\s()"]+))')


class ProtocolError(ValueError):
    """A message that is neither JSON nor slat, or lacks what its kind needs."""


# ── slat → Python ──────────────────────────────────────────────────────────────────────────────────────────────

def _tokens(text: str) -> list[tuple[str, Any]]:
    out, pos = [], 0
    while pos < len(text):
        if text[pos:].strip() == "":
            break
        m = _TOKEN.match(text, pos)
        if not m or m.end() == pos:
            raise ProtocolError(f"slat: cannot read near {text[pos:pos + 20]!r}")
        pos = m.end()
        if m.group(1):
            out.append(("(", None))
        elif m.group(2):
            out.append((")", None))
        elif m.group(3) is not None:
            out.append(("str", json.loads('"' + m.group(3) + '"')))
        else:
            out.append(("atom", m.group(4)))
    return out


def _atom(word: str) -> Any:
    if word == "#t":
        return True
    if word == "#f":
        return False
    if word in ("nil", "null"):
        return None
    if re.fullmatch(r"-?\d+", word):
        return int(word)
    if re.fullmatch(r"-?\d+\.\d*", word):
        return float(word)
    return word


def _read(toks: list[tuple[str, Any]], i: int) -> tuple[Any, int]:
    kind, val = toks[i]
    if kind == "(":
        items, i = [], i + 1
        while i < len(toks) and toks[i][0] != ")":
            item, i = _read(toks, i)
            items.append(item)
        if i >= len(toks):
            raise ProtocolError("slat: a ( was never closed")
        return _shape(items), i + 1
    if kind == ")":
        raise ProtocolError("slat: a ) with no (")
    if kind == "str":
        return {"__str__": val}, i + 1
    return _atom(val), i + 1


def _plain(v: Any) -> Any:
    return v["__str__"] if isinstance(v, dict) and set(v) == {"__str__"} else v


def _shape(items: list) -> Any:
    """A list of `:key value` pairs is a dict; anything else stays a list."""
    if items and len(items) % 2 == 0 and all(isinstance(items[k], str) and items[k].startswith(":") for k in range(0, len(items), 2)):
        return {items[k][1:].replace("-", "_"): _plain(items[k + 1]) for k in range(0, len(items), 2)}
    return [_plain(x) for x in items]


def parse_slat(text: str) -> dict:
    toks = _tokens(text)
    if not toks or toks[0][0] != "(":
        raise ProtocolError("slat: a message is one form, starting with (")
    if len(toks) < 2 or toks[1][0] != "atom":
        raise ProtocolError("slat: the form must start with its kind")
    head = toks[1][1]
    body_toks = [("(", None)] + toks[2:]
    body, end = _read(body_toks, 0)
    if end != len(body_toks):
        raise ProtocolError("slat: one message per form")
    if body == []:
        body = {}
    if not isinstance(body, dict):
        raise ProtocolError("slat: after the kind, only :key value pairs")
    return {"kind": head, **body}


# ── Python → slat ──────────────────────────────────────────────────────────────────────────────────────────────

def _s(v: Any) -> str:
    if v is True:
        return "#t"
    if v is False:
        return "#f"
    if v is None:
        return "nil"
    if isinstance(v, (int, float)):
        return repr(v)
    if isinstance(v, str):
        return json.dumps(v, ensure_ascii=False)
    if isinstance(v, dict):
        return "(" + " ".join(f":{k.replace('_', '-')} {_s(x)}" for k, x in v.items()) + ")"
    if isinstance(v, (list, tuple)):
        return "(" + " ".join(_s(x) for x in v) + ")"
    return json.dumps(str(v))


def dumps_slat(msg: dict) -> str:
    kind = msg.get("kind")
    if kind not in KINDS:
        raise ProtocolError(f"unknown kind {kind!r}")
    rest = {k: v for k, v in msg.items() if k != "kind"}
    return f"({kind}" + "".join(f" :{k.replace('_', '-')} {_s(v)}" for k, v in rest.items()) + ")"


# ── either form ────────────────────────────────────────────────────────────────────────────────────────────────

def parse(text: str) -> dict:
    """One message, JSON or slat, checked against its kind."""
    t = (text or "").lstrip()
    if t.startswith("{"):
        try:
            msg = json.loads(t)
        except ValueError as e:
            raise ProtocolError(f"json: {e}") from e
    elif t.startswith("("):
        msg = parse_slat(t)
    else:
        raise ProtocolError("a message is JSON ({…}) or slat ((…)); this is neither")
    check(msg)
    return msg


def check(msg: dict) -> dict:
    kind = msg.get("kind")
    if kind not in KINDS:
        raise ProtocolError(f"unknown kind {kind!r}")
    missing = [k for k in REQUIRED[kind] if msg.get(k) in (None, "")]
    if missing:
        raise ProtocolError(f"a {kind} needs {', '.join(missing)}")
    return msg


def brief(id: str, to: str, cls: str, words: str, *, card: str | None = None, constraints: dict | None = None,
          inputs: dict | None = None, frm: str = "lacuna") -> dict:
    job: dict[str, Any] = {"class": cls, "brief": words}
    if constraints:
        job["constraints"] = constraints
    if inputs:
        job["inputs"] = inputs
    m = {"kind": "brief", "id": id, "from": frm, "to": to, "job": job}
    if card:
        m["card"] = card
    return check(m)
