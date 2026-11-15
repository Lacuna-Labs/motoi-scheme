"""THE DESK'S HANDS — what Lacuna's chat may do on its home (http://:1138/home/), the same moves Sakura makes on hers.

  show_card   put a card down: a chart of the box's metrics, a note, a question with keys, a web page, a terminal's
              report — and the eye goes to it ("take a look at this")
  point_at    send the eye to a card by its number ("card 3") or id
  tidy_desk   move a card next to another, take one away, or clear Lacuna's own cards (the standing ones stay)

A card's block is the shared turn protocol (curator-web sakuraChat/blocks/PROTOCOL.md). Metrics are the sampled names
the home knows (disk_free_gb, mem_available_gb, mem_pressure, up:<service>).
"""
from __future__ import annotations

import json
import time

from . import home

METRICS = ["disk_free_gb", "mem_available_gb", "mem_pressure", "up:dev-api", "up:qa-api", "up:vite", "up:lacuna", "up:tunnel",
           "up:speech-helper"]
COLORS = ["#00e5ff", "#ff2d95", "#b6ff00", "#ffb000", "#8c7bff", "#9aa0a6"]

SHOW = {
    "kind": {"type": "string", "enum": ["chart", "note", "choices", "page", "term"]},
    "title": {"type": "string"},
    "metrics": {"type": "array", "items": {"type": "string", "enum": METRICS}, "description": "chart: which series"},
    "hours": {"type": "number", "description": "chart: how far back (default 6)"},
    "text": {"type": "string", "description": "note: the words; term: the lines, newline-separated"},
    "url": {"type": "string", "description": "page: the address"},
    "ask": {"type": "string", "description": "choices: the question"},
    "options": {"type": "array", "items": {"type": "string"}, "description": "choices: the keys, e.g. [\"Yes\", \"Not now\"]"},
    "near": {"type": "string", "description": "the id of a card this one belongs beside; a wire joins them"},
}


def show_card(a: dict, who: str) -> str:
    kind = a.get("kind") or "note"
    title = (a.get("title") or kind)[:60]
    block: dict = {"kind": kind}
    w, h = 420, 280
    if kind == "chart":
        names = [m for m in (a.get("metrics") or []) if m in METRICS][:4] or ["disk_free_gb"]
        data = home.series(names, float(a.get("hours") or 6), 180)
        block["chart"] = {"kind": "line", "title": title, "xFormat": "time", "series": [
            {"name": n, "color": COLORS[i % len(COLORS)], "points": [[t * 1000, v] for t, v in data.get(n, [])]} for i, n in enumerate(names)]}
        w, h = 640, 320
    elif kind == "note":
        block["lines"] = str(a.get("text") or "").split("\n")[:40]
        h = min(520, 120 + 22 * len(block["lines"]))
    elif kind == "choices":
        block.update(ask=a.get("ask") or title, choices=[{"id": str(i), "label": o, "say": o, "act": i == 0}
                                                          for i, o in enumerate((a.get("options") or ["Yes", "Not now"])[:6])])
        h = 200
    elif kind == "page":
        url = str(a.get("url") or "")
        if not url.startswith(("https://", "http://")):
            return "a page card needs a full web address"
        block["url"] = url
        w, h = 860, 620
    elif kind == "term":
        block.update(lines=str(a.get("text") or "").split("\n")[-400:], rc=None)
        w, h = 760, 360
    near = a.get("near")
    b = home.act({"op": "place", "kind": kind, "title": title, "block": block, "w": w, "h": h,
                  "links": [near] if near else [], "id": f"l{int(time.time() * 1000) % 10_000_000}"}, who="lacuna")
    n = _number(b, b["cards"][-1]["id"])
    return f"shown: card {n} ({kind} — {title}) is on the desk and has the eye"


def _number(b: dict, cid: str) -> str:
    """Standing cards come first on the desk (numbered by home.STANDING), Lacuna's own after them."""
    for i, c in enumerate(b.get("cards") or []):
        if c["id"] == cid:
            return str(len(home.STANDING) + i + 1)
    return "?"


def point_at(a: dict, who: str) -> str:
    target = str(a.get("card") or "").strip().lower().removeprefix("card").strip().removeprefix("c-")
    b = home.board()
    cid = target
    if target.isdigit():
        n = int(target)
        k = len(home.STANDING)
        own = b.get("cards") or []
        cid = home.STANDING[n - 1] if 1 <= n <= k else (own[n - k - 1]["id"] if 0 <= n - k - 1 < len(own) else "")
    if not cid:
        return f"there is no card {target}"
    home.act({"op": "focus", "id": cid}, who="lacuna")
    return f"the eye is on {cid}"


def tidy_desk(a: dict, who: str) -> str:
    op = a.get("op")
    if op == "clear":
        home.act({"op": "clear"}, who="lacuna")
        return "cleared my cards; the standing ones stay"
    if op in ("move", "remove"):
        home.act({"op": op, "id": a.get("card"), "near": a.get("near")}, who="lacuna")
        return f"{op}d {a.get('card')}"
    return "tidy_desk takes op: move | remove | clear"


# ── THE FOREMAN'S WORKERS (§32): the brain as a task manager — it programs workers, it does not drive each step ─────────
SPAWN = {
    "name": {"type": "string", "description": "a short name, e.g. dev-errors-watch"},
    "what": {"type": "string", "description": "in plain words, exactly what the worker should watch or do and when it "
             "should report — the program is written for you under a grammar and tried before anyone is asked"},
}


def spawn_worker(a: dict, who: str) -> str:
    from . import foreman, slat_gen
    what = str(a.get("what") or a.get("why") or "")
    w = slat_gen.write_worker(what, lambda prog: foreman.call("POST", "/check", {"program": prog}, timeout=30))
    if not w.get("ok"):
        return ("could not write a worker that passes its trial in " + str(w.get("tries")) + " tries: "
                + " | ".join(w.get("problems") or []) + ". Say plainly what you tried.")
    out = foreman.propose(str(a.get("name") or "worker")[:60], w["program"], what, "watch", who)
    if out.get("fix_first"):
        return "NOT PROPOSED — the trial found: " + " | ".join(out["fix_first"]) + ". Fix the program and call spawn_worker again."
    return ("a permission card with the program is on the desk; the worker loads when the owner says yes"
            if out.get("petition") else f"could not propose it: {out}")


def list_workers(a: dict, who: str) -> str:
    from . import foreman
    r = foreman.workers()
    if not r.get("ok"):
        return f"the foreman is not answering: {r.get('why')}"
    # every field read with .get: a worker the foreman restored from disk carries no depth (KeyError 'depth', 2026-10-19 —
    # seen first in the chat's new tool block)
    rows = [f"{w.get('id')} · {w.get('name')} · {w.get('state')} · depth {w.get('depth', 0)} · last: {(w.get('reports') or [{}])[-1].get('kind', '—')} "
            f"{(w.get('reports') or [{}])[-1].get('data', '')}" for w in r.get("workers", [])[:30]]
    return "\n".join(rows) or "no workers yet"


def tell_worker(a: dict, who: str) -> str:
    from . import foreman
    return json.dumps(foreman.call("POST", f"/workers/{a.get('id')}/event", {"kind": a.get("kind"), "value": a.get("value")}))


def stop_worker(a: dict, who: str) -> str:
    from . import foreman
    return json.dumps(foreman.stop(str(a.get("id"))))
