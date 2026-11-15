"""THE FACTORY'S PARTS (THE-FABRIC-1.0 §7; the owner, 2026-10-18: "a packageable bot that can be trained and put together from
a grocery list … new ones become available once we train other new ones"). Every part a bot can be built from, read from
what is REAL on the box — never a list kept by hand:

  minds    the trained edges (forge/pantheon.json + results): each with its job, answers, its one-shot score against
           the 90% mark, whether it serves, and whether the vote (EmbeddingGemma nearness, no training) holds it
  senses   the eye (SigLIP on screens), nearness (EmbeddingGemma), the ear (owed: E2B audio)
  reads    every box read (hands.py, hands_api.py)            acts      every act (acts.py) — the owner's press each run
  browser  every interface verb (deskCart.js)                  memory    the graph cortex's reads
  programs every real cart, to start a bot from
  places   where a bot may live: this Mac (the foreman here); the phone, another computer, the cloud — designed, they need
           the remote foreman (not built; said so)
  GET /api/factory/parts
"""
from __future__ import annotations

import json
import os
from pathlib import Path

from fastapi import APIRouter

router = APIRouter()
VOTES = {"inbox-route": 0.957, "triage-red": 0.84, "sentry-log": 0.75, "pick-hand": 0.667, "yes-safe-remove": 0.633, "yes-done": 0.45}   # forge/knn.py eval, 2026-10-18


def _world() -> Path:
    return Path(os.environ.get("LACUNA_WORLD") or Path.home() / "lacuna-world")


def parts() -> dict:
    from . import acts, hands, hands_api, reference
    minds = []
    try:
        pan = json.loads((_world() / "forge" / "pantheon.json").read_text())["minds"]
        roles = json.loads((Path.home() / "code/lacuna/lacuna-box/brain/box-minds.json").read_text()).get("roles") or {}
        for m in pan:
            res = _world() / "forge" / "results" / "pantheon" / f"{m['name']}.json"
            r = json.loads(res.read_text()) if res.exists() else {}
            score = r.get("q8") or r.get("trained")
            minds.append({"id": m["name"], "name": m.get("title") or m["name"], "kind": m.get("kind"), "base": m.get("base"),
                          "does": m.get("ask"), "answers": list((m.get("labels") or m.get("options") or {}).keys()),
                          "score": score, "serves": str(m.get("title", "")).lower() in roles, "vote": VOTES.get(m["name"]),
                          "ready": bool((score and score >= 0.9) or (VOTES.get(m["name"], 0) >= 0.9) or str(m.get("title", "")).lower() in roles)})
    except (OSError, ValueError):
        pass
    reads = [{"id": op, "does": w, "example": ex} for op, (_, w, ex) in hands_api.OPS.items()]
    reads += [{"id": op, "does": ((getattr(fn, "__doc__", "") or "a read").strip().split("\n")[0])[:160], "example": f"(hand '{op} …)"}
              for op, fn in hands.OPS.items() if op not in ("memory", "pointing-at", "like", "since", "fading", "trail", "knn")]
    memory = [{"id": op, "does": d} for op, d in (("memory", "recall with the newest-wins trail"), ("pointing-at", "everything that points at a node"),
              ("like", "the nearest memories by meaning"), ("since", "what arrived after a moment"), ("fading", "links going cold"), ("trail", "the breadcrumbs of a node"))]
    acts_ = []
    for op in ("pass", "promote-build", "install-ipad", "clean-listed"):
        plan = acts._plan(op, ["<build>"]) if op != "clean-listed" else ("clears the files on the owner's disk list", [])
        acts_.append({"id": op, "does": plan[0] if plan else op, "press": True})
    browser = [{"id": k, "does": v[1], "form": v[0]} for k, v in reference.BROWSER.items()]
    programs = [{"id": f.stem, "does": (__import__("re").search(r'\(does \. "([^"]*)"', f.read_text(errors="replace")) or [None, ""])[1]}
                for f in sorted((_world() / "carts").glob("*.sks"))]
    senses = [{"id": "eye", "does": "SigLIP looks at a screen and says what it sees (zero-shot labels)", "ready": True},
              {"id": "nearness", "does": "EmbeddingGemma: how near two things are in meaning — routing, recall, seen-before", "ready": True},
              {"id": "ear", "does": "hears a voice note — E2B's native audio (owed: not yet served here)", "ready": False}]
    places = [{"id": "here", "name": "this Mac", "does": "the foreman on the Studio", "ready": True},
              {"id": "phone", "name": "the phone", "does": "a bot on the owner's phone — needs the remote foreman", "ready": False},
              {"id": "computer", "name": "another computer", "does": "a bot on a laptop or a server — needs the remote foreman", "ready": False},
              {"id": "cloud", "name": "the cloud", "does": "an E2B node — needs the remote foreman", "ready": False},
              {"id": "lacuna", "name": "a Lacuna there", "does": "the bot brings a bigger Lacuna to the machine and joins it — needs the remote foreman", "ready": False}]
    return {"minds": minds, "senses": senses, "reads": reads, "memory": memory, "acts": acts_, "browser": browser,
            "programs": programs, "places": places}


@router.get("/api/factory/parts")
def r_parts() -> dict:
    return parts()
