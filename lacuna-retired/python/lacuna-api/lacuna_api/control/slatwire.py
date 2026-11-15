"""THE FOREMAN PROTOCOL, from Lacuna's side (LACUNA-1.3-DESIGN §36, B43; the other half: lacuna-foreman/protocol.mjs).

Every message between Lacuna and a foreman is ONE slat form, signed for its hop with HMAC-SHA256 keyed by the foreman
token (~/.lacuna/foreman-token):

    {"slat": '(msg (v 1) (from "lacuna") (to "w-1") (kind answer) (at 1760000000.2) (nonce "…") (body <data>))',
     "sig":  hex HMAC-SHA256(token, slat)}

The signature covers the exact text, so nothing is canonicalized: verify the bytes, then read them. A body is JSON in
slat: strings, numbers, #t/#f, `null`, a list ( … ), an object (@ ("key" value) …). Unsigned, forged, stale, replayed
or malformed messages are dropped and counted in DROPS (the desk shows them).
"""
from __future__ import annotations

import hashlib
import hmac
import math
import re
import secrets
import threading
import time

VERSION, WINDOW_S, MAX_BYTES = 1, 120, 256_000
DROPS = {"unsigned": 0, "forged": 0, "stale": 0, "replayed": 0, "malformed": 0}
_SEEN: dict[str, float] = {}
_LOCK = threading.Lock()
_KIND = re.compile(r"^[A-Za-z][A-Za-z0-9:_-]{0,59}$")


def _str(s: str) -> str:
    return '"' + s.replace("\\", "\\\\").replace('"', '\\"').replace("\n", "\\n").replace("\r", "\\r").replace("\t", "\\t") + '"'


def dumps(v, depth: int = 0) -> str:
    if depth > 24:
        raise ValueError("the body is nested too deep")
    if v is None:
        return "null"
    if v is True:
        return "#t"
    if v is False:
        return "#f"
    if isinstance(v, (int, float)):
        if isinstance(v, float) and not math.isfinite(v):
            return "null"                          # what JSON would say for NaN, and what the foreman does too
        return repr(v) if isinstance(v, float) else str(v)
    if isinstance(v, str):
        return _str(v)
    if isinstance(v, (list, tuple)):
        return "(" + " ".join(dumps(x, depth + 1) for x in v) + ")"
    if isinstance(v, dict):
        return "(@" + "".join(f" ({_str(str(k))} {dumps(x, depth + 1)})" for k, x in v.items()) + ")"
    return _str(str(v))


# ── the reader: data only (a list, a string, a number, #t/#f, a symbol) — nothing here is ever run ────────────────────
_TOKEN = re.compile(r'\s*(?:(\()|(\))|"((?:[^"\\]|\\.)*)"|([^\s()"]+))')
_ESC = {"n": "\n", "r": "\r", "t": "\t", '"': '"', "\\": "\\"}


class Sym(str):
    """A symbol, told apart from a string."""


def _atom(t: str):
    if t == "#t":
        return True
    if t == "#f":
        return False
    try:
        return int(t) if re.fullmatch(r"-?\d+", t) else float(t) if re.fullmatch(r"-?\d+(\.\d+)?([eE][-+]?\d+)?", t) else Sym(t)
    except ValueError:
        return Sym(t)


def read(text: str):
    pos, stack, out = 0, [[]], None
    while pos < len(text):
        m = _TOKEN.match(text, pos)
        if not m or m.end() == pos:
            if text[pos:].strip():
                raise ValueError("unreadable text")
            break
        pos = m.end()
        if m.group(1):
            stack.append([])
        elif m.group(2):
            if len(stack) < 2:
                raise ValueError("an unmatched )")
            done = stack.pop()
            stack[-1].append(done)
        elif m.group(3) is not None:
            stack[-1].append(re.sub(r"\\(.)", lambda e: _ESC.get(e.group(1), e.group(1)), m.group(3)))
        else:
            stack[-1].append(_atom(m.group(4)))
    if len(stack) != 1 or len(stack[0]) != 1:
        raise ValueError("a message is exactly one form")
    out = stack[0][0]
    return out


def loads_body(f, depth: int = 0):
    if depth > 24:
        raise ValueError("nested too deep")
    if isinstance(f, Sym):
        if f == "null":
            return None
        raise ValueError(f"a body holds no symbols ({f})")
    if isinstance(f, list):
        if f and isinstance(f[0], Sym) and f[0] == "@":
            o = {}
            for pair in f[1:]:
                if not (isinstance(pair, list) and len(pair) == 2 and isinstance(pair[0], str) and not isinstance(pair[0], Sym)):
                    raise ValueError('an object entry is ("key" value)')
                o[pair[0]] = loads_body(pair[1], depth + 1)
            return o
        return [loads_body(x, depth + 1) for x in f]
    return f


# ── seal / open ─────────────────────────────────────────────────────────────────────────────────────────────────────
def _mac(key: str, text: str) -> str:
    return hmac.new(key.encode(), text.encode(), hashlib.sha256).hexdigest()


def seal(key: str, frm: str, to: str, kind: str, body, at: float | None = None) -> dict:
    if not _KIND.match(str(kind)):
        raise ValueError(f"'{kind}' is not a message kind")
    slat = (f"(msg (v {VERSION}) (from {_str(frm)}) (to {_str(to)}) (kind {kind}) (at {repr(float(at if at is not None else time.time()))})"
            f" (nonce {_str(secrets.token_hex(12))}) (body {dumps(body)}))")
    return {"slat": slat, "sig": _mac(key, slat)}


def _drop(kind: str, why: str) -> dict:
    with _LOCK:
        DROPS[kind] += 1
    return {"ok": False, "drop": kind, "why": why}


def open_(key: str, env: dict, now: float | None = None) -> dict:
    """→ {"ok": True, "msg": {...}} or {"ok": False, "drop": kind, "why": …} (counted)."""
    slat, sig = (env or {}).get("slat"), (env or {}).get("sig")
    if not isinstance(slat, str) or not slat:
        return _drop("unsigned", "not a protocol message (no slat form)")
    if not isinstance(sig, str) or not sig:
        return _drop("unsigned", "the message is not signed")
    if len(slat) > MAX_BYTES:
        return _drop("malformed", "the message is too large")
    if not key or not hmac.compare_digest(_mac(key, slat), sig.lower()):
        return _drop("forged", "the signature does not match")
    try:
        f = read(slat)
        fields = ["v", "from", "to", "kind", "at", "nonce", "body"]
        if not (isinstance(f, list) and f and f[0] == Sym("msg") and isinstance(f[0], Sym) and len(f) == len(fields) + 1):
            raise ValueError("not (msg …)")
        o = {}
        for i, name in enumerate(fields):
            x = f[i + 1]
            if not (isinstance(x, list) and len(x) == 2 and isinstance(x[0], Sym) and x[0] == name):
                raise ValueError(f"field {i + 1} must be ({name} …)")
            o[name] = x[1]
        if o["v"] != VERSION or not isinstance(o["kind"], Sym) or not isinstance(o["at"], (int, float)) \
                or not all(isinstance(o[k], str) and not isinstance(o[k], Sym) for k in ("from", "to", "nonce")):
            raise ValueError("the fields have the wrong types")
        msg = {"from": o["from"], "to": o["to"], "kind": str(o["kind"]), "at": float(o["at"]), "nonce": o["nonce"],
               "body": loads_body(o["body"])}
    except (ValueError, IndexError, TypeError) as e:
        return _drop("malformed", str(e)[:200])
    now = time.time() if now is None else now
    if abs(now - msg["at"]) > WINDOW_S:
        return _drop("stale", "outside the time window")
    with _LOCK:
        for n, at in list(_SEEN.items()):
            if abs(now - at) > WINDOW_S:
                del _SEEN[n]
        if msg["nonce"] in _SEEN:
            replay = True
        else:
            replay = False
            _SEEN[msg["nonce"]] = msg["at"]
    if replay:
        return _drop("replayed", "this message was already delivered")
    return {"ok": True, "msg": msg}
