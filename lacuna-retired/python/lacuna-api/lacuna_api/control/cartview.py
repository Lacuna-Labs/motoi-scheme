"""THE CARTS APP'S FEED (the owner, 2026-10-18: "give me the ability to run my own carts and give me cart view with the
carts have a flowchart … the artifact from the output … who participated").

  GET  /api/carts                 every cart: Lacuna's own (.sks in ~/lacuna-world/carts) and the jail's worker classes;
                                  each with what it does, its verbs, minds, judgment points, leases, done-condition, a
                                  FLOWCHART (nodes, edges) and its last runs
  GET  /api/carts/run/{cart}/{id} one run's artifact: steps, what it made, the minds that took part, the outcome
  POST /api/carts/{name}/run      run a Lacuna cart now: its trial, then an approval card (the same path as an exam start)

The flowchart of a .sks cart is read from its program, not guessed: start → each hand it reads → the event that
answers → each mind it asks (with its answers) → judgment points (need-brain) → reports → done. A worker class's
flowchart is its fixed workflow (work.CLASS_STEPS). Read-only except the run, which files a card.
"""
from __future__ import annotations

import json
import os
import re
import time
from pathlib import Path


def _world() -> Path:
    return Path(os.environ.get("LACUNA_WORLD") or Path.home() / "lacuna-world")


def flow_of_program(src: str) -> dict:
    """The cart's flowchart from its Scheme: a node per act, in the order the program runs them."""
    nodes, edges = [], []

    def add(nid: str, kind: str, label: str, after: str | None) -> str:
        if not any(n["id"] == nid for n in nodes):
            nodes.append({"id": nid, "kind": kind, "label": label})
        if after and not any(e["a"] == after and e["b"] == nid for e in edges):
            edges.append({"a": after, "b": nid})
        return nid

    last = add("start", "start", "start", None)
    for op in dict.fromkeys(re.findall(r"\(hand\s+'([\w-]+)", src)):
        last = add(f"hand:{op}", "hand", f"read · {op}", last)
    if re.search(r"\(on\s+'hand", src):
        last = add("on:hand", "event", "the read comes back", last)
    for job in dict.fromkeys(re.findall(r"\(mind\s+'([\w-]+)", src)):
        at = src.find(f"(mind-job '{job}")                          # its declaration (the ask may hold brackets)
        labels = re.search(r":labels\s+\(([^)]*)\)", src[at:at + 2400]) if at >= 0 else None
        m = add(f"mind:{job}", "mind", f"ask a mind · {job}", last)
        last = add("on:mind", "event", "the mind answers", m)
        for lab in (labels.group(1).split() if labels else [])[:6]:
            add(f"ans:{lab}", "answer", lab, last)
    for point in dict.fromkeys(re.findall(r"\(need-brain\s+'([\w-]+)", src)):
        add(f"brain:{point}", "judgment", f"ask the 26B · {point}", "ans:new-thing" if any(n["id"] == "ans:new-thing" for n in nodes) else last)
    for kind in dict.fromkeys(re.findall(r"\(report\s+'([\w-]+)", src)):
        src_node = {"bug": "ans:real-error", "new-thing": "ans:new-thing"}.get(kind)
        add(f"report:{kind}", "report", f"report · {kind}", src_node if any(n["id"] == src_node for n in nodes) else last)
    if "(done" in src:
        add("done", "done", "done", last)
    for t in dict.fromkeys(re.findall(r"\(after\s+(\d+)", src)):
        add(f"after:{t}", "timer", f"timeout · {int(t) // 60} min", "start")
    return {"nodes": nodes, "edges": edges}


def _header(name: str, program: str) -> dict:
    try:
        from . import foreman
        t = foreman.call("POST", "/check", {"program": program}, timeout=20)
        return {**(t.get("cart") or {}), "trial": "passed" if t.get("ok") else "; ".join(map(str, t.get("problems") or [t.get("why")]))[:200]}
    except Exception as e:  # noqa: BLE001 — the foreman is down: the cart still shows, its trial unknown
        return {"trial": f"the foreman did not answer ({e.__class__.__name__})"}


def _runs(cart_names: list, n: int = 6) -> list:
    out = []
    for c in cart_names:
        d = _world() / "artifacts" / c
        for f in sorted(d.glob("*.slat"), key=lambda p: p.stat().st_mtime, reverse=True)[:n] if d.is_dir() else []:
            r = parse_artifact(f.read_text(errors="replace"))
            out.append({"cart": c, "id": f.stem, "outcome": r.get("outcome", {}).get("is"), "reason": r.get("outcome", {}).get("reason", "")[:200],
                        "started": r.get("run", {}).get("started"), "ended": r.get("run", {}).get("ended"), "minds": r.get("minds", {}).get("used", [])})
    return sorted(out, key=lambda r: r.get("started") or "", reverse=True)[:n]


_FORM = re.compile(r'^\((\w+)\s+(.*)\)\s*$')
_KV = re.compile(r':([\w-]+)\s+("(?:[^"\\]|\\.)*"|\([^)]*\)|[^\s)]+)')


def parse_artifact(text: str) -> dict:
    """One run's .slat artifact → {run, steps, made, minds, outcome} (the jail's artifact.py format)."""
    out: dict = {"steps": []}
    for line in text.splitlines():
        m = _FORM.match(line.strip())
        if not m:
            continue
        kv = {}
        for k, v in _KV.findall(m.group(2)):
            if v.startswith('"'):
                kv[k] = v[1:-1].replace('\\"', '"')
            elif v.startswith("("):
                kv[k] = re.findall(r'"((?:[^"\\]|\\.)*)"', v)
            else:
                kv[k] = v
        if m.group(1) == "step":
            out["steps"].append(kv)
        else:
            out[m.group(1)] = kv
    return out


def carts() -> dict:
    rows = []
    for f in sorted((_world() / "carts").glob("*.sks")):
        program = f.read_text(errors="replace")
        h = _header(f.stem, program)
        rows.append({"name": f.stem, "kind": "cart", "does": h.get("does") or "", "verbs": (h.get("agent") or {}).get("verbs") or h.get("verbs") or [],
                     "minds": list((h.get("minds") or {}).keys()) if isinstance(h.get("minds"), dict) else h.get("minds") or [],
                     "judgment": h.get("judgment") or [], "touches": h.get("touches") or [], "done": h.get("done") or "",
                     "trial": h.get("trial"), "runnable": h.get("trial") == "passed", "flow": flow_of_program(program),
                     "mind_detail": h.get("minds") if isinstance(h.get("minds"), dict) else {}, "exam": h.get("exam"), "acts": h.get("acts") or [],
                     "runs": _runs([f.stem] + [c for c in _exam_carts_named(f.stem)])})
    # INTERFACE CARTS (lacuna-home/src/hand/deskCart.js): they work the desk in the browser; their runs are the hand's
    # recorded scenarios. They touch only the desk, so the owner's click on the desk is their run key.
    for f in sorted((_world() / "carts" / "desk").glob("*.sks")):
        program = f.read_text(errors="replace")
        does = re.search(r'\(does \. "([^"]*)"', program)
        rows.append({"name": f.stem, "kind": "interface cart", "does": does.group(1) if does else "", "verbs": [], "minds": [],
                     "judgment": [], "touches": ["the desk"], "done": "", "trial": "passed", "runnable": True, "surface": "desk",
                     "flow": flow_of_program(program), "runs": _desk_runs(f.stem), "mind_detail": {}, "acts": []})
    from .work import CLASS_STEPS
    for cls, steps in CLASS_STEPS.items():
        names = [s for s, _ in steps]
        flow = {"nodes": [{"id": "start", "kind": "start", "label": "brief"}] + [{"id": f"s{i}", "kind": "step", "label": s} for i, s in enumerate(names)],
                "edges": [{"a": "start", "b": "s0"}] + [{"a": f"s{i}", "b": f"s{i + 1}"} for i in range(len(names) - 1)]}
        rows.append({"name": cls, "kind": "worker class", "does": _class_says(cls), "verbs": [], "minds": ["lacuna-worker-lite"], "judgment": [],
                     "touches": [], "done": names[-1], "trial": "built in", "runnable": False, "flow": flow, "runs": _runs(_cards_of_class(cls))})
    return {"carts": rows}


def _desk_runs(name: str, n: int = 6) -> list:
    """an interface cart's runs: the hand's scenarios named `cart · <name>` (~/lacuna-world/artifacts/desk/*.scenario.json)"""
    out = []
    for f in sorted((_world() / "artifacts" / "desk").glob("*.scenario.json"), key=lambda p: p.stat().st_mtime, reverse=True)[:200]:
        try:
            for sc in json.loads(f.read_text()) if f.read_text().lstrip().startswith("[") else [json.loads(f.read_text())]:
                if sc.get("name") == f"cart · {name}":
                    bad = [st.get("label") for st in sc.get("steps") or [] if not st.get("ok")]
                    out.append({"cart": name, "id": str(sc.get("at")), "outcome": "done" if sc.get("ok") else "failed",
                                "reason": ("all steps held" if not bad else "failed at: " + ", ".join(map(str, bad[:3]))),
                                "started": time.strftime("%Y-%m-%dT%H:%M:%S", time.localtime(sc.get("at") or 0)), "minds": []})
        except (OSError, ValueError):
            continue
    return sorted(out, key=lambda r: r["started"], reverse=True)[:n]


def desk_program(name: str) -> dict:
    f = _world() / "carts" / "desk" / f"{name}.sks"
    if not re.fullmatch(r"[\w-]{1,60}", name) or not f.exists():
        return {"ok": False, "why": f"no interface cart {name}"}
    return {"ok": True, "name": name, "program": f.read_text(errors="replace")}


def _class_says(cls: str) -> str:
    try:
        from . import tell
        return tell.CLASSES.get(cls, cls)
    except Exception:  # noqa: BLE001
        return cls


def _exam_carts_named(name: str) -> list:
    try:
        from . import home_cards
        return [f"exam-{i['id']}" for i in home_cards.exam().get("items", []) if i.get("cart") == name]
    except Exception:  # noqa: BLE001
        return []


def _cards_of_class(cls: str) -> list:
    out = [cls] if (_world() / "artifacts" / cls).is_dir() else []
    try:
        from . import home_cards
        out += [f"exam-{e}" for e, (c, _) in home_cards.EXAM_WORKERS.items() if c == cls]
    except Exception:  # noqa: BLE001
        pass
    return out


def run_record(cart: str, rid: str) -> dict:
    if not re.fullmatch(r"[\w.-]{1,80}", cart) or not re.fullmatch(r"[\w.-]{1,80}", rid):
        return {"ok": False, "why": "not a cart or run name"}
    f = _world() / "artifacts" / cart / f"{rid}.slat"
    if not f.exists():
        return {"ok": False, "why": f"no artifact {cart}/{rid}"}
    return {"ok": True, **parse_artifact(f.read_text(errors="replace"))}


def run_now(name: str, who: str, dry: bool = False) -> dict:
    """Run one of Lacuna's carts now: its trial, then an approval card (spawn-cart, the exam's own path, no exam row)."""
    f = _world() / "carts" / f"{name}.sks"
    if not re.fullmatch(r"[\w-]{1,60}", name) or not f.exists():
        return {"ok": False, "why": f"no cart {name}"}
    program = f.read_text(errors="replace")
    from . import chat, foreman
    t = foreman.call("POST", "/check", {"program": program}, timeout=30)
    if not t.get("ok"):
        return {"ok": False, "why": "the cart did not pass its trial: " + "; ".join(map(str, t.get("problems") or [t.get("why")]))[:300]}
    header = t.get("cart") or {}
    lines = program.strip().splitlines()
    shown = "\n".join(lines[:16]) + (f"\n… {len(lines) - 16} more lines" if len(lines) > 16 else "")
    acts = header.get("acts") or []
    how = (" — DRY: each act says what it would do, nothing changes" if dry else
           f" — it will ACT: {', '.join(acts)} (this press covers this run only)" if acts else "")
    return chat.file_petition("spawn-cart", None, f"run the cart {name}{how}", who,
                              args={"cart": name, "exam": None, "program": program, "shown": shown, "header": header, "asked_by": who, "dry": bool(dry)})
