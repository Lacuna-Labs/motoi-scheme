"""THE DESK IS LACUNA'S SCREEN (the owner, 2026-10-18: "Lacuna knows the menus and can tell me what the thing is that
it's talking about … it just opens up the window, says, hey, take a look at this … you need to approve this, and it goes
right to the approval box"). Lacuna Desk §2: Lacuna drives the view with the same ops the owner's taps make; the desk
plays them with Lacuna's Caliper hand and marks "Lacuna opened this".

  open_app      an app, at a room                         ("look at the forge")
  slide_to      the next panel in an app's chain           (an action's form, its result, a worker's thoughts)
  side_by_side  two apps that talk to each other, together ("the forge beside the minds")
  show_approval a waiting card, in front of him: the inbox opens on it, yes/no ready
  talk_to_bot   ask one of its bots something, on screen   (the reply comes back up the wire; he sees it)
  interrupt_bot pause / resume / stop a bot, on screen
  open_inbox    the inbox: everything waiting on him, in one queue ("three things need you — here they are")
  desk_home     back to the apps
  desk_map      the desk's own map: apps → rooms → actions → connectors (read; one source with the screen)

Each op goes to the big screen when one is up, else the phone (home.act decides); nothing here approves anything.
"""
from __future__ import annotations

import re

import json

from . import agent_talk, home

APP = {"type": "string", "description": "the app's id, e.g. s-forge, s-minds, s-telemetry, s-agents (see desk_map)"}


def _op(op: dict) -> str:
    try:
        r = home.act(op, who="lacuna")
    except Exception as e:  # noqa: BLE001 — a refused op is said in words, never raised into the turn
        return f"the desk refused it: {str(e)[:200]}"
    return "done — it's on the screen" if not (isinstance(r, dict) and r.get("error")) else f"the desk said: {r['error']}"


_MOVE = re.compile(r"\b(open|show|go( to)?|take me|bring( it)? up|pull( it)? up|switch|navigate|put .{0,20} (up|on (the )?screen)|side by side|slide)\b", re.I)


def _asked_to_move() -> bool:
    """HIS SCREEN IS HIS (the owner, 2026-10-20: "something makes me jump from chat to agents automatically … stop it"): Lacuna changes the
    screen only when the words of the turn she is answering ask for it — never from a wake, a plan or her own idea of where to look."""
    try:
        from . import chat
        return bool(_MOVE.search(str(chat._CURRENT.get("text") or "")))
    except Exception:  # noqa: BLE001
        return False


def _stay(app) -> str:
    return (f"not moved: the owner did not ask to change screens. Say where it is in words instead (\"it's on the {app} card\"); "
            "he opens it himself.")


def open_app(a: dict, who: str) -> str:
    if not _asked_to_move():
        return _stay(a.get("app"))
    return _op({"op": "open-app", "app": a.get("app"), "room": a.get("room")})


def slide_to(a: dict, who: str) -> str:
    if not _asked_to_move():
        return _stay(a.get("app"))
    return _op({"op": "slide", "app": a.get("app"), "panel": a.get("panel"), "args": a.get("args") or {}})


def side_by_side(a: dict, who: str) -> str:
    if not _asked_to_move():
        return _stay(f"{a.get('a')} and {a.get('b')}")
    return _op({"op": "side-by-side", "a": a.get("a"), "b": a.get("b")})


def show_approval(a: dict, who: str) -> str:
    """The card he must answer, in front of him: its app opens and the eye goes to the card (it is never pressed here)."""
    from . import chat
    pid = str(a.get("id") or "")
    p = next((q for q in chat.petitions() if q["id"] == pid), None)
    if not p:
        return f"no card {pid!r} is waiting"
    # the yes/no in front of him, every time: the inbox opens ON the card (2026-10-19: pointing at a contract element in
    # its app missed on the 1.5 cards, which draw no such element)
    return take_to_press(pid, str(a.get("say") or ""))


def _resolve(name_or_id: str) -> str:
    """A bot by its id or its name, the way a person (or the model) says it: "mem-watch", "mem_watch", "the memory watcher"."""
    w = str(name_or_id or "").strip()
    if agent_talk.valid_id(w) and any(n.get("id") == w for n in (agent_talk.tree().get("nodes") or [])):
        return w
    key = "".join(ch for ch in w.lower() if ch.isalnum())
    for n in agent_talk.tree().get("nodes") or []:
        nm = "".join(ch for ch in str(n.get("name", "")).lower() if ch.isalnum())
        if nm and (nm == key or nm in key or key in nm):
            return n["id"]
    return w


def talk_to_bot(a: dict, who: str) -> str:
    """Ask one of its bots something; the reply is real (the bot's own mind or program), and the desk plays it."""
    wid, text = _resolve(a.get("worker")), str(a.get("text") or "")
    r = agent_talk.talk(wid, text, "lacuna")
    _op({"op": "talk", "worker": wid, "text": text, "reply": r.get("reply", ""), "by_name": "lacuna"})
    return json.dumps(r)[:600]


def interrupt_bot(a: dict, who: str) -> str:
    wid, mode = _resolve(a.get("worker")), str(a.get("mode") or "")
    r = agent_talk.interrupt(wid, mode, "lacuna")
    _op({"op": "interrupt", "worker": wid, "mode": mode, "done": True})
    return json.dumps(r)[:400]


def open_inbox(a: dict, who: str) -> str:
    """The owner's inbox, open in front of him: every card waiting on him, oldest first, its yes/no on each row."""
    from . import chat
    n = sum(1 for p in chat.petitions() if p.get("state") == "waiting")
    say = str(a.get("say") or "").strip()[:200] or (f"{n} thing{'s' if n != 1 else ''} need{'s' if n == 1 else ''} you — here they are" if n else "")
    focus = str(a.get("focus") or "").strip()[:12]
    if focus and not any(p.get("id") == focus and p.get("state") == "waiting" for p in chat.petitions()):
        return f"refused: no waiting card {focus}"
    r = _op({"op": "inbox", "open": True, **({"say": say} if say else {}), **({"focus": focus} if focus else {})})
    return f"{r} · {n} waiting on him" if r.startswith("done") else r


def take_to_press(pid: str, say: str = "") -> str:
    """Take the owner straight to ONE card's yes/no (the owner, 2026-10-19: "use Marionette and take me right to the yes no
    screen"): the desk opens the inbox on that card, named by its id, with Lacuna's line on top."""
    return open_inbox({"focus": pid, "say": say or f"card {pid} — yes or no"}, "lacuna")


def desk_home(a: dict, who: str) -> str:
    return _op({"op": "home"})


def desk_map(a: dict, who: str) -> str:
    try:
        m = json.loads(home.DESK_MAP.read_text())
    except (OSError, ValueError):
        return "the desk map is not built yet"
    apps = [{"id": x["id"], "name": x["name"], "rooms": [r["key"] for r in x.get("rooms", [])],
             "actions": [c["key"] for c in x.get("actions", [])]} for x in m.get("apps", [])]
    return json.dumps({"apps": apps, "connectors": [[c["a"], c["b"]] for c in m.get("connectors", [])]})[:3500]


TOOLS = (
    ("open_app", "OPEN AN APP on your desk (your screen) at a room, so the owner sees what you are talking about — "
                 "e.g. the forge when you speak of training, telemetry when an upload stopped.",
     {"app": APP, "room": {"type": "string"}}, ["app"], open_app),
    ("slide_to", "Slide the next panel in an app's chain: an action's form, its result, or a worker's thoughts "
                 "(panel: app | room:<k> | action:<k> | result | thoughts:<worker id>).",
     {"app": APP, "panel": {"type": "string"}, "args": {"type": "object"}}, ["app", "panel"], slide_to),
    ("side_by_side", "Put two apps side by side to show what one is doing to the other (forge beside minds, battery "
                     "beside errors).", {"a": APP, "b": APP}, ["a", "b"], side_by_side),
    ("show_approval", "Put a waiting permission card in front of the owner: the inbox opens ON that card, its yes/no "
                      "ready. Name its id when you ask him. You never press it; he does.", {"id": {"type": "string"}, "say": {"type": "string"}}, ["id"], show_approval),
    ("talk_to_bot", "Ask one of your bots (a worker or agent) something — 'what are you doing?' — on screen; its own "
                    "mind or program answers.", {"worker": {"type": "string", "description": "its id or its name"}, "text": {"type": "string"}},
     ["worker", "text"], talk_to_bot),
    ("interrupt_bot", "Pause, resume or stop one of your bots, on screen.",
     {"worker": {"type": "string"}, "mode": {"type": "string", "enum": ["pause", "resume", "stop"]}},
     ["worker", "mode"], interrupt_bot),
    ("open_inbox", "Open the owner's INBOX: every card, question and alert waiting on him, in one queue with yes/no on each. Name a card's id in `focus` to open the inbox ON that card (when you ask him to press one, take him to it).", {"say": {"type": "string", "description": "your one line on top, e.g. 'three things need you'"}, "focus": {"type": "string", "description": "one waiting card's id, e.g. fe9fc1ff"}}, [], open_inbox),
    ("desk_home", "Take the owner's view back to all the apps.", {}, [], desk_home),
    ("desk_map", "Read your desk's map: every app, its rooms and actions, and which apps feed which.", {}, [], desk_map),
)


def work_history(a: dict, who: str) -> str:
    """Its own work, looked back on: per card the decisions and attempts (when, class, outcome, reason, minutes), and
    each worker class's record — so it can say what it was doing at a time, and why (work.tree)."""
    from . import work
    hours = float(a.get("hours") or 24)
    t = work.tree(hours)
    card = str(a.get("card") or "")
    cards = [c for c in t["cards"] if not card or card in c["card"]][:8]
    out = {"cards": [{"card": c["card"], "last": c["last"], "nodes": [{k: n.get(k) for k in ("type", "at", "who", "what", "said", "class", "outcome", "reason", "minutes")} for n in c["nodes"][-6:]]} for c in cards],
           "perf": [{k: q[k] for k in ("class", "runs", "done", "rate", "minutes")} for q in t["perf"][:8]]}
    return json.dumps(out)[:3500]


def open_web(a: dict, who: str) -> str:
    """the Web card at an address: the owner browses it there (eye.web_open — fetched once, never retried)"""
    from . import eye
    r = eye.web_open(str(a.get("url") or ""), who or "lacuna")
    if not r.get("ok"):
        return r.get("why") or "that page did not open"
    _op({"op": "open-app", "app": "s-web"})
    return f"opened {r['url']} on the Web card"


TOOLS = TOOLS + (
    ("open_web", "OPEN A WEB PAGE on the owner's desk, on the Web card (our own browser tab): he sees it and browses it "
                 "there. One address, opened once — say why you are showing it.",
     {"url": {"type": "string", "description": "the address, e.g. https://example.com/page"}}, ["url"], open_web),
    ("work_history", "Look back at your own WORK: per card, who decided what and when, each attempt (class, outcome, reason, "
                     "minutes), and each worker class's success rate. Use it to answer 'what were you doing at …', 'why did "
                     "that fail', 'how long does this kind of job take'.",
     {"hours": {"type": "number", "description": "how far back, default 24"}, "card": {"type": "string", "description": "a card or exam id to narrow to"}},
     [], work_history),
)
