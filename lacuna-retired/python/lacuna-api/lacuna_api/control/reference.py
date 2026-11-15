"""THE LACUNA REFERENCE — the system talking about itself (the owner, 2026-10-18: "we should have a reference manual that works
just like that for Lacuna … the very understandings you were going to give MOTOI about its language, about itself, about
what ran, about what didn't, about how to build things … It's part of its RAG").

Written in Motoi's reference schema (~/code/motoi-scheme/Spec/MOTOI-SCHEME-REFERENCE-SCHEMA.slat): SLAT, one record per
line, a keyword tag first, every field `:key value`. It is generated from what is REAL on the box, never written by hand,
so it cannot drift from the system:

  (verb …)          every foreman verb (lacuna-foreman/verbs.json): its form, tier, what it does, the examples
  (hand …)          every read a cart may ask (hands.py, hands_api.py): its route, what it answers, an example
  (act …)           every act (acts.py): what it does; who may (a run the owner pressed)
  (browser-verb …)  every verb of an interface cart (lacuna-home/src/hand/deskCart.js)
  (mind …)          every small mind (forge/pantheon.json): its ask, answers, hard lines, score against the 90% mark
  (cart …)          every cart (cartview): what it does, minds, acts, judgment points, runs, how they ended
  (incident …)      the latest cart runs as narratives: what was asked, the steps, how it ended and why
  (correction …)    the latest retries (cascade escalations): the input, the small mind's wrong answer, the right one

Written to ~/lacuna-world/reference/LACUNA-REFERENCE.slat, re-written by the index's walk (rag.py) every hour; the walk
then embeds it, so "what does (act 'pass) do?" or "why did the release stop last time?" is a recall, not a guess.
"""
from __future__ import annotations

import json
import os
import time
from pathlib import Path

HEADER = """;; ═══════════════════════════════════════════════════════════════
;; THE LACUNA REFERENCE — the system talking about itself.
;; Generated from the live box (lacuna-api/lacuna_api/control/reference.py); never edit by hand.
;; Format: SLAT, after Motoi's reference schema — one record per line, a keyword tag first, every :key one value.
;; Taste, as Motoi's: SICP (small languages you can hold in your head), K&R (explained by working code), Quigley (show
;; the shell doing real work), the SRE Book (honesty about failure: every record says what it raises or how it ended).
;; If the software is lost, this file alone says what each verb, hand, act, mind and cart was, and how they went.
;; ═══════════════════════════════════════════════════════════════
(schema :version "1.0" :tags (verb hand act browser-verb mind cart incident correction) :source "the live box" :generated {at})
"""

BROWSER = {
    "tap": ("(tap sel [label])", "points at the element and taps it"), "click": ("(click sel [label])", "as tap, for a mouse"),
    "hover": ("(hover sel [label])", "points without tapping"), "type": ("(type sel text)", "types into a field"),
    "press": ("(press key [sel])", "presses a key (Enter, Escape, ArrowDown …)"), "scroll": ("(scroll sel dy)", "scrolls a panel"),
    "wait": ("(wait ms)", "waits"), "wait-for": ("(wait-for sel [ms])", "waits until it is visible; a step that fails if it never is"),
    "wait-gone": ("(wait-gone sel [ms])", "waits until it is gone"), "assert-visible": ("(assert-visible sel [label])", "checks it shows"),
    "assert-hidden": ("(assert-hidden sel [label])", "checks it does not show"), "assert-text": ("(assert-text sel words)", "checks its text holds the words"),
    "assert-count": ("(assert-count sel n)", "checks how many there are"), "read-text": ("(read-text sel [as])", "reads its text into the run's record"),
    "count": ("(count sel [as])", "counts them into the record"), "measure": ("(measure sel [as])", "its box (x y w h) into the record"),
    "open-app": ("(open-app id)", "opens a card"), "slide": ("(slide id panel)", "slides a card's panel in"), "room": ("(room id room)", "opens a room of a card"),
    "side-by-side": ("(side-by-side a b)", "two cards side by side"), "point-at": ("(point-at id [element])", "points the owner at something"),
    "back": ("(back)", "back"), "forward": ("(forward)", "forward"), "home": ("(home)", "the whole desk"), "inbox": ("(inbox)", "opens the messages"),
    "close-top": ("(close-top)", "closes the top panel"), "say": ("(say words)", "Lacuna says it on the desk"),
    "note": ("(note words)", "a line in the run's record"), "mark": ("(mark words)", "a named point in the record"),
}


def _world() -> Path:
    return Path(os.environ.get("LACUNA_WORLD") or Path.home() / "lacuna-world")


def q(v) -> str:
    """one SLAT value: a string, a number, a symbol list"""
    if v is None:
        return "#f"
    if isinstance(v, bool):
        return "#t" if v else "#f"
    if isinstance(v, (int, float)):
        return str(round(v, 3)) if isinstance(v, float) else str(v)
    if isinstance(v, (list, tuple)):
        return "(" + " ".join(q(x) for x in v) + ")"
    return json.dumps(str(v).replace("\n", " ")[:600], ensure_ascii=False)


def rec(tag: str, **kv) -> str:
    return f"({tag} " + " ".join(f":{k.replace('_', '-')} {q(v)}" for k, v in kv.items() if v not in (None, "", [])) + ")"


def lines() -> list[str]:
    out = []
    lac = Path(__file__).resolve().parents[3]
    try:
        vj = json.loads((lac / "lacuna-foreman" / "verbs.json").read_text())
        ex = vj.get("examples") or []
        for v in vj["verbs"]:
            uses = [e["what"] for e in ex if f"({v['name']} " in e.get("program", "")][:3]
            out.append(rec("verb", name=v["name"], library="foreman", signature=v.get("form"), tier=v.get("tier"),
                           summary=v.get("does"), usecases=uses, impl_status="live"))
        for e in ex:
            out.append(rec("example", what=e.get("what"), program=e.get("program")))
    except (OSError, ValueError, KeyError):
        pass
    from . import hands, hands_api
    for op, fn in hands.OPS.items():
        out.append(rec("hand", name=op, library="hands", summary=(getattr(fn, "__doc__", "") or "a read").strip().split("\n")[0], example=f"(hand '{op})"))
    for op, (route, words, example) in hands_api.OPS.items():
        out.append(rec("hand", name=op, library="hands-api", route=route, summary=words, example=example))
    from . import acts
    for op in ("pass", "promote-build", "install-ipad"):
        plan = acts._plan(op, ["<build>"])
        out.append(rec("act", name=op, summary=plan[0] if plan else op, may="only a cart whose header names it, on a run the owner pressed; a dry run says what it would do",
                       raises=["not named in the header", "not the owner's press", "another release-kind job is running"]))
    for name, (form, words) in BROWSER.items():
        out.append(rec("browser-verb", name=name, signature=form, summary=words, library="desk"))
    try:
        pan = json.loads((_world() / "forge" / "pantheon.json").read_text())["minds"]
        res = _world() / "forge" / "results" / "pantheon"
        for m in pan:
            r = {}
            if (res / f"{m['name']}.json").exists():
                r = json.loads((res / f"{m['name']}.json").read_text())
            score = r.get("q8") or r.get("trained")
            out.append(rec("mind", name=m["name"], title=m.get("title"), base=m.get("base"), kind=m.get("kind"), ask=m.get("ask"),
                           answers=list((m.get("labels") or m.get("options") or {}).keys()), boundaries=m.get("boundaries"),
                           carts=m.get("carts"), score=score, passes=bool(score and score >= 0.9), mark=0.9))
    except (OSError, ValueError, KeyError):
        pass
    try:
        from . import cartview
        for c in cartview.carts().get("carts", []):
            runs = c.get("runs") or []
            out.append(rec("cart", name=c["name"], kind=c.get("kind"), summary=c.get("does"), minds=c.get("minds"), acts=c.get("acts"),
                           judgment=c.get("judgment"), touches=c.get("touches"), done=c.get("done"), trial=c.get("trial"),
                           runs=len(runs), last_outcome=runs[0].get("outcome") if runs else None))
            for r in runs[:4]:
                out.append(rec("incident", cart=c["name"], run=r.get("id"), started=r.get("started"), outcome=r.get("outcome"),
                               reason=r.get("reason"), minds=r.get("minds")))
    except Exception:  # noqa: BLE001 — the foreman down leaves the carts out, not the manual
        pass
    try:
        esc = (_world() / "cascade" / "escalations.jsonl").read_text().splitlines()[-40:]
        for ln in esc:
            e = json.loads(ln)
            rungs = e.get("rungs") or []
            out.append(rec("correction", cart=e.get("cart"), job=e.get("job"), at=e.get("at"), input=(e.get("input") or {}).get("line") or e.get("input"),
                           wrong=[x.get("answer") for x in rungs[:-1]], right=rungs[-1].get("answer") if rungs else None,
                           why=[x.get("climbed") for x in rungs[:-1] if x.get("climbed")][:1]))
    except (OSError, ValueError):
        pass
    return out


def write() -> dict:
    d = _world() / "reference"
    d.mkdir(parents=True, exist_ok=True)
    body = lines()
    f = d / "LACUNA-REFERENCE.slat"
    tmp = f.with_suffix(".tmp")
    tmp.write_text(HEADER.replace("{at}", q(time.strftime("%Y-%m-%dT%H:%M"))) + "\n".join(body) + "\n")
    tmp.replace(f)
    return {"ok": True, "file": str(f), "records": len(body)}
