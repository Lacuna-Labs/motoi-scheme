"""VERB GRAMMAR — a cart's grammar that can only name verbs that are allowed (Sprint 2, G6 + G7; 2026-10-19).

program.gbnf lets any symbol through, so a model can write a verb that does not exist: three repair workers each spent a
round on `listings/media` before the trial refused it. Here the reader's grammar is narrowed at its one open door, the
symbol: a symbol WITH a slash (the verbs' shape: ns/name) must be one of an allowed list; every other symbol is as before.
Built per request, so the list can be:
  · a repair's: the verbs that answer today + the real verbs + the cart's own slash names − its dead verbs − the ones a
    past round was refused for (G6, the loop breaker)
  · a cart family's: only its partition's verbs (G7, verb partitioning at decode time — no training)

  narrowed(base_text, allowed) → the grammar text
"""
from __future__ import annotations

import json
import re

SYMBOL = re.compile(r"^symbol\s*::=.*$", re.M)
# a symbol without a slash: the reader's own classes, minus "/" (a lone "/" — division — stays a plain symbol)
PLAIN = r'''plainsym  ::= "/" | [^ \t\n\r();'"`,/] [^ \t\n\r();'"/]*'''
OK = re.compile(r"^[^\s();'\"`,]+$")


def narrowed(base: str, allowed: set[str] | list[str]) -> str:
    names = sorted({a for a in allowed if "/" in a and OK.match(a)})
    if not names:
        return base
    # one group: GBNF ends a rule at a newline unless it is inside parentheses, and a grammar llama.cpp cannot parse is
    # SILENTLY ignored (measured: the first build let `listings/media` through)
    # a PREFIX TREE, not a flat list: llama.cpp follows every alternative at once, and 4,000 flat names decoded at 0.5
    # tokens/s (measured); folded by shared prefixes, each step branches only on the next characters
    rules = f"symbol    ::= slashsym | plainsym\n{PLAIN}\nslashsym  ::= {_trie(names)}"
    return SYMBOL.sub(lambda m: rules, base, count=1)


def _trie(words: list[str]) -> str:
    root: dict = {}
    for w in words:
        node = root
        for ch in w:
            node = node.setdefault(ch, {})
        node[""] = {}                                   # the end of a word

    def emit(node: dict) -> str:
        alts = []
        for ch, child in sorted(node.items()):
            if ch == "":
                alts.append('""')
                continue
            run, cur = ch, child                        # fold a chain with one way on into one literal
            while len(cur) == 1 and "" not in cur:
                (c2, cur), = cur.items()
                run += c2
            alts.append(json.dumps(run) + ("" if cur == {"": {}} else " " + emit(cur)))
        return alts[0] if len(alts) == 1 else "(" + " | ".join(alts) + ")"
    return emit(root)


def slash_symbols(src: str) -> set[str]:
    """every slash symbol a cart names outside strings and comments"""
    tok = re.compile(r'"(?:\\.|[^"\\])*"|;[^\n]*|[^\s();\'"`,]+')
    return {t for t in tok.findall(src) if "/" in t and not t.startswith(('"', ";")) and not re.fullmatch(r"[+-]?[0-9./]+", t)}
