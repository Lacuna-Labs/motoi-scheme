"""LACUNA'S CORTEX, from the API — the Rust graph store (cortex_py.Store over curator/cortex-rs: datoms, four indexes,
`supersedes` so the newest fact wins with its trail), opened by the broker with Lacuna's own sealing key
(lacuna-box/jail/cortex.py). The API never holds the key: it speaks the broker's one-line protocol on its unix socket.

The owner, 2026-10-18: "The point of the cortex was to be able to be a contextual switch that from which an LLM can ask
questions about its state right now, hotly, really, really fucking fast" — and "it's not a sham … not just a KV store".

  remember(kind, key, props, about=[], supersedes=None)   fact · episode · decision (and the nouns they are about)
  episode(card, step, props)                               a step's summary, linked `in` its card
  recall(words, kind=None, k=6, timeout=4)                 key + meaning; newest with its trail; [] when slow or down
Every call is bounded: a chat turn never waits on the cortex longer than its timeout.
"""
from __future__ import annotations

import json
import os
import socket


def _sock() -> str:
    """This home's broker socket, read at each call. Bound to the real home at import, it let the API suite's remember
    calls reach the live broker and write test facts over Lacuna's memory (P-2026-11-01-tests-wrote-the-live-cortex); a
    test's throwaway LACUNA_HOME holds no socket, so every call there answers that the cortex did not answer."""
    return os.path.join(os.environ.get("LACUNA_HOME") or os.path.expanduser("~/.lacuna"), "jail", "broker.sock")


def _call(argv: list[str], timeout: float = 6.0) -> dict:
    body = json.dumps(argv).encode()
    s = socket.socket(socket.AF_UNIX, socket.SOCK_STREAM)
    s.settimeout(timeout)
    try:
        s.connect(_sock())
        s.sendall(f"cortex-argv {len(body)}\n".encode() + body)
        out = b""
        while True:
            chunk = s.recv(65536)
            if not chunk:
                break
            out += chunk
    except OSError as e:
        return {"ok": False, "error": f"the cortex did not answer ({e.__class__.__name__})"}
    finally:
        s.close()
    text = out.decode(errors="replace").strip()
    try:
        return json.loads(text)
    except ValueError:
        # recall answers in lines ("- [kind · date · source] words"): the text is the answer
        return {"ok": bool(text) and not text.lower().startswith(("error", "refused")), "text": text}


def remember(kind: str, key: str, props: dict, about: list[str] | None = None, supersedes: str | None = None) -> dict:
    # the cortex reads about=<kind>/<key>; a bare name is a thing (a bare one was glued onto the JSON and broke it, 2026-10-19)
    argv = ["remember", kind, key, json.dumps(props, ensure_ascii=False)] + [f"about={a if '/' in a else 'thing/' + a}" for a in (about or [])]
    if supersedes:
        argv.append(f"supersedes={supersedes}")
    return _call(argv)


def episode(card: str, step: str, props: dict) -> dict:
    return _call(["episode", card, step, json.dumps(props, ensure_ascii=False)])


def recall(words: str, kind: str | None = None, k: int = 6, timeout: float = 4.0, since: str | None = None) -> list:
    argv = ["recall", *str(words or "").split()[:40], "--k", str(k)] + (["--kind", kind] if kind else []) + (["--since", since] if since else [])
    r = _call(argv, timeout=timeout)
    if isinstance(r, list):
        return r
    if isinstance(r, dict) and r.get("text"):
        return [ln[2:].strip() for ln in r["text"].splitlines() if ln.startswith("- ")][:k]
    return r.get("hits") or [] if isinstance(r, dict) else []


def counts() -> dict:
    return _call(["counts"])
