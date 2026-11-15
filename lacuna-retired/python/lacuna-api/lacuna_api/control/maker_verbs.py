"""THE MAKERS' PRESS VERBS (lane L3, 2026-10-24; LACUNA-CARDS-2.0 §6.16 Arcade, §6.21 Factory).

Owns: the effect sentence and the decided road of the five maker petitions the Arcade and the Factory file —
  arcade-make     {words, maker, id?, name?, refine?}   a game made (or refined) by a playbook run of arcade-make
  factory-make    {words, maker, id?, name?, refine?}   a product made by a playbook run of factory-make
  factory-exam    {id}                                   the product's fixtures sat at L2 (playbook factory-exam)
  arcade-bundle   {id}                                   the game's bundle record cut (playbook arcade-bundle)
  factory-bundle  {id}                                   the product's bundle record cut after a passed exam (playbook factory-bundle)
and the maker job's settings for the mind door (`foreman.mind`: 8,192 tokens, 280 s, the named model).
The maker `claude` is a seat, not a mind: its brief goes to Claude by the threads door's summon, one try, and nothing runs
(law 9: Claude's words are never pairs).
Refuses (one sentence each, at filing and again at the press): no words or over 2,000 characters; a maker outside
12b · 26b · claude; the 12B while it is not a mind this box lets an agent have (box-minds.json, ruling L3-R3); an id that is
not a plain lower-case name. A decline runs nothing. Never retries (law 10).
Invariants (design §18): "an act from the desk is a press ticket or a foreman route"; "a claim is not a record" (the run's
outcome is the foreman's done-check; this file says only that the run started, with its id). Faults (§16): none raised.
"""
from __future__ import annotations

import json
import re
import secrets
import threading
import urllib.request

VERBS = ("arcade-make", "factory-make", "factory-exam", "arcade-bundle", "factory-bundle")
MAKERS = ("12b", "26b", "claude")
TWELVE = "gemma4:12b-it-q8_0"                         # the 12B's tag (docs/minds/GEMMA-4-12B-ENGINEERING-MANUAL.md)
ID = re.compile(r"^[a-z0-9][a-z0-9-]{0,63}$")
WORDS_MAX = 2000
KIND = {"arcade-make": "arcade", "factory-make": "factory", "factory-exam": "factory", "arcade-bundle": "arcade", "factory-bundle": "factory"}
NOUN = {"arcade": "game", "factory": "product"}
SHELF = {"arcade": "~/lacuna-world/arcade/games", "factory": "~/lacuna-world/factory/products"}
DOOR = "http://127.0.0.1:1138"
MIND = {"num_predict": 8192, "timeout": 280, "prompt": 30000}   # the maker job on the mind door


def background(fn) -> None:
    """Runs the summon beside the press (Claude answers in minutes); tests replace it with a direct call."""
    threading.Thread(target=fn, name="maker-summon", daemon=True).start()


def model_of(maker: str) -> str | None:
    """The model a maker names on this box: the 26B is the brain's last rung; the 12B by its tag; Claude is no model."""
    from . import foreman
    return foreman.last_rung() if maker == "26b" else TWELVE if maker == "12b" else None


def slug(words: str) -> str:
    """A new item's id: its first words as a slug and four hex characters."""
    base = "-".join(re.findall(r"[a-z0-9]+", words.lower())[:4])[:40].strip("-") or "item"
    return f"{base}-{secrets.token_hex(2)}"


def why_not(action: str, a: dict) -> str | None:
    """Why a maker petition is refused, or None when its args hold."""
    if action not in VERBS:
        return f"{action} is not a maker verb"
    if action.endswith("-make"):
        words = str(a.get("words") or "").strip()
        maker = str(a.get("maker") or "")
        if not words:
            return f"say the {NOUN[KIND[action]]} you want: a maker takes words"
        if len(words) > WORDS_MAX:
            return f"the words are {len(words)} characters; the most is {WORDS_MAX}"
        if maker not in MAKERS:
            return f"the maker is one of {' · '.join(MAKERS)}, not '{maker[:20]}'"
        if maker == "12b":
            from . import foreman
            if TWELVE not in foreman.allowed_minds():
                return "the 12B is not a mind this box lets an agent have (box-minds.json; ruling L3-R3): pick 26b or claude"
        if a.get("id") is not None and not ID.match(str(a.get("id"))):
            return "an id is lower-case letters, digits and hyphens, 64 at most"
        return None
    if not ID.match(str(a.get("id") or "")):
        return f"name the {NOUN[KIND[action]]}: an id of lower-case letters, digits and hyphens"
    return None


def effect(action: str, a: dict) -> str:
    """What the owner's yes does, written by code from the args; `refuses: …` when the args do not hold."""
    no = why_not(action, a)
    if no:
        return f"refuses: {no}"
    kind = KIND[action]
    noun = NOUN[kind]
    if action.endswith("-make"):
        words = str(a.get("words")).strip()
        if a.get("maker") == "claude":
            return (f"files the brief for a {noun} (\"{words[:160]}\") to Claude's seat by the threads door's summon, one try; nothing runs on "
                    "the box, and Claude's words are never pairs (law 9)")
        what = f"refines the {noun} {a['id']}" if a.get("refine") and a.get("id") else f"makes a new {noun}"
        rules = ("C13's rules: its files, the kit, ≤ 2 MB, no network, stays in its pane" if kind == "arcade"
                 else "C13's rules with fixtures.json as its entry: its files, ≤ 2 MB, no network")
        return (f"{what}: \"{words[:160]}\", by the {a['maker'].upper()} — a playbook run ({action}, 5 units): the brief, one try at the "
                f"maker, the files written into {SHELF[kind]}/<id>/ under the jail, the folder read back by lstat, then the done-check "
                f"({rules}); only the check says made, and a {noun} that fails stays on the shelf as failed")
    if action == "factory-exam":
        return (f"sits product {a['id']}'s fixtures at L2: its code in one J0 child per fixture (no network, no write), the comparison by "
                "the hands, .exam.slat written; the done-check folds it (L2, 90 % of the fixtures); one try")
    tail = ("only after its exam passed (X1's mayBundle)" if kind == "factory"
            else "only when the game passes its files check; sending it to the phone stays owed (no verb reaches the iOS shell)")
    return (f"cuts the bundle record of {noun} {a['id']}: every file by part (code, agents, weights, playbooks, manuals) with its sha256 "
            f"and bytes into .bundle.slat, {tail}; one try")


def bindings(action: str, a: dict, who: str) -> tuple[dict, str]:
    """The playbook's bindings by step, and the item's id."""
    kind = KIND[action]
    if action.endswith("-make"):
        words = str(a.get("words")).strip()
        iid = str(a.get("id") or slug(words))
        name = str(a.get("name") or " ".join(words.split()[:4]))[:60]
        maker = str(a.get("maker"))
        return ({"1": [{"kind": kind, "id": iid, "name": name, "words": words, "maker": maker, "refine": bool(a.get("refine") and a.get("id"))}],
                 "2": [{"model": model_of(maker)}],
                 "3": [{"kind": kind, "id": iid, "name": name, "maker": maker}],
                 "4": [{"kind": kind, "id": iid}],
                 "5": [{"to": "desk", "ticket": f"{kind}:{iid}"[:40], "text": f"the {maker.upper()}'s run for the {NOUN[kind]} {iid} ended; its check says if it is made"}]}, iid)
    iid = str(a["id"])
    act = {"id": iid} if action == "factory-exam" else {"kind": kind, "id": iid}
    return ({"1": [{"kind": kind, "id": iid}], "2": [act], "3": [{"kind": kind, "id": iid}],
             "4": [{"to": "desk", "ticket": f"{action}:{iid}"[:40], "text": f"{action} for {iid} ended; its done-check says how"}]}, iid)


def summon(kind: str, words: str, who: str) -> dict:
    """The maker `claude`: the brief to Claude by the threads door's summon on the card's thread. One try, never again."""
    body = {"thread": f"card:{kind}", "card": kind, "turns": [],
            "words": f"Make a {NOUN[kind]} for the {kind.title()} (CARDS-2.0 §6.{16 if kind == 'arcade' else 21}; the {kind}-maker skill): {words}"}
    req = urllib.request.Request(f"{DOOR}/api/threads/claude/summon", data=json.dumps(body).encode(), method="POST",
                                 headers={"Content-Type": "application/json"})
    try:
        with urllib.request.urlopen(req, timeout=600) as r:
            d = json.loads(r.read() or b"{}")
        return {"ok": bool(d.get("ok")), "receipt": d.get("receipt"), "why": d.get("why")}
    except OSError as e:
        return {"ok": False, "why": f"the threads door did not take the summon ({e.__class__.__name__}); one try"}


def decided(action: str, a: dict, approve: bool, who: str, call) -> dict:
    """The owner's answer carried out: a playbook run on the foreman, or the summon for the maker `claude`."""
    if not approve:
        return {"ok": True, "declined": True}
    no = why_not(action, a)
    if no:
        return {"ok": False, "why": no}
    kind = KIND[action]
    if action.endswith("-make") and a.get("maker") == "claude":
        from .core import audit
        words = str(a.get("words")).strip()
        background(lambda: audit(who, "maker.summon", kind=kind, result=summon(kind, words, who)))
        return {"ok": True, "said": f"the brief went to Claude's seat by the threads door's summon (one try); nothing runs on the box; "
                                    f"the answer lands in the card:{kind} thread"}
    b, iid = bindings(action, a, who)
    r = call("POST", f"/playbooks/{action}/run", {"bindings": b, "pressed": True, "shadow": False, "by": who})
    return {**r, "id": iid} if isinstance(r, dict) else {"ok": False, "why": "the foreman gave no answer", "id": iid}
