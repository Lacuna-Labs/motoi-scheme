"""LACUNA'S MAP — "Obsidian's graph view, but every node real and every edge meaning something" (the owner, 2026-10-18).

The desk draws it; this is its feed (read-only, localhost only, kept 5 s):

  GET /api/map/graph                  → {nodes:[{id, kind, label, app, meta}], edges:[{from, to, kind, weight, live}], at, sources}
  GET /api/map/events?since=<t>       → [{t, from, to, kind}]  the pulses since t, oldest first, for the animation
  GET /api/map/history?hours=6&step=60 → {steps:[{t, nodes:{kind:n}, edges:{kind:n}, events:{kind:n}}]} for the scrubber

Node ids are "<kind>:<key>". Node kinds: app · service · brain · mind · agent · cart · job · repo · branch · artifact · doc ·
fact (a cortex node, by key and kind — never its encrypted value) · customer · petition · owner · log · more (a folded tail).
Edge kinds, only real relations: spawned · runs-on · calls · reads · wrote · feeds · depends · about · waits-on · serves.
weight = the pulses on that edge in the last 15 min; live = one in the last 60 s. The readers are sysmap_sources.py.
"""
from __future__ import annotations

import json
import threading
import time
from collections import Counter

from fastapi import APIRouter

from . import sysmap_sources as src

router = APIRouter()

TTL_S = 5.0
WEIGHT_S = 15 * 60
LIVE_S = 60
EVENT_WINDOW_S = 6 * 3600
MAX_NODES = 1500
CAPS = {"fact": 200, "agent": 200, "job": 150, "branch": 80, "artifact": 80, "doc": 80, "mind": 40, "petition": 60,
        "customer": 40, "cart": 80, "repo": 60, "log": 30}
DEPENDS = [("vite", "qa-api")]           # SERVICES' own words: vite "proxies to QA"
PETITION_APP = [("forge-", "s-forge"), ("spawn-worker", "s-agents"), ("worker-asks", "s-agents"), ("spawn-cart", "s-agents"),
                ("spawn-job", "s-exam"), ("qa-restart", "s-services"), ("act:", "s-lacuna")]
HISTORY_KEEP_S = 48 * 3600

_LOCK = threading.Lock()
_CACHE: dict = {"t": 0.0, "graph": None, "events": []}


class _G:
    def __init__(self):
        self.nodes: dict[str, dict] = {}
        self.edges: dict[tuple, dict] = {}
        self.sources: dict[str, str] = {}

    def node(self, kind: str, key: str, label: str | None = None, app: str | None = None, **meta) -> str:
        nid = f"{kind}:{key}"
        if nid not in self.nodes:
            self.nodes[nid] = {"id": nid, "kind": kind, "label": (label or key)[:120], "app": app, "meta": meta}
        return nid

    def edge(self, a: str, b: str, kind: str) -> None:
        if a != b:
            self.edges.setdefault((a, b, kind), {"from": a, "to": b, "kind": kind, "weight": 0, "live": False})


def _source(g: _G, name: str, fn):
    try:
        fn(g)
        g.sources.setdefault(name, "ok")
    except Exception as e:  # noqa: BLE001 — one broken source is said, the map still draws
        g.sources[name] = f"{e.__class__.__name__}: {e}"[:160]


# ── the sources, as nodes and their static edges ─────────────────────────────────────────────────────────────────────
def _apps(g: _G):
    a = src.apps()
    for r in a["apps"]:
        g.node("app", r["id"], r["name"], r["id"], wired=r["wired"])
    for w in a["wires"]:
        g.edge(f"app:{w['a']}", f"app:{w['b']}", "feeds")


def _services(g: _G):
    for s in src.service_rows():
        g.node("service", s["name"], s["title"], "s-services", port=s["port"], up=s["up"], hers=s["hers"])
    for a, b in DEPENDS:
        g.edge(f"service:{a}", f"service:{b}", "depends")


def _minds(g: _G, brain_ref: dict):
    box = src.box_minds()
    live = src.gateway_minds()
    prof = (live or {}).get("profile") or box
    brain = src.canon(prof.get("brain") or prof.get("last_rung") or "lacuna-worker-lite")
    rung = src.canon(prof.get("last_rung") or "lacuna-worker-lite")
    brain_ref.update(brain=brain, aliases={brain, rung, "lacuna-worker-lite"})
    gw = g.node("service", "brain-gateway", "Brain gateway", "s-minds", port=11434, up=live is not None)
    b = g.node("brain", brain, brain, "s-minds", aliases=sorted({rung} - {brain}))
    g.edge(gw, b, "calls")
    loaded = {src.canon(m.get("name") or m.get("model")) if isinstance(m, dict) else src.canon(m) for m in (live or {}).get("minds") or []}
    small = {src.canon(m) for m in (live or {}).get("small") or []}
    allowed = {src.canon(m) for m in prof.get("agent_minds") or []}
    reserved = {src.canon(m) for m in prof.get("reserved") or {}}
    for m in sorted((loaded | small | allowed | reserved) - brain_ref["aliases"]):
        nid = g.node("mind", m, m, "s-minds", loaded=m in loaded, pulled=m in small, allowed=m in allowed, reserved=m in reserved)
        if m in loaded:
            g.edge(gw, nid, "calls")
    if live is None:
        g.sources["gateway"] = "the gateway did not answer (box-minds.json only)"


def mind_id(model, brain_ref: dict) -> str:
    m = src.canon(model)
    return f"brain:{brain_ref['brain']}" if m in brain_ref.get("aliases", ()) else f"mind:{m}"


def _agents(g: _G):
    tree = src.foreman_tree()
    if tree is None:
        g.sources["foreman"] = "the foreman did not answer (its recent events only)"
    rows = list((tree or {}).get("workers") or [])
    seen = {w.get("id") for w in rows}
    cutoff = time.time() - EVENT_WINDOW_S
    for e in src.foreman_events():                  # workers that came and went lately (retired ones keep their place)
        w = e.get("worker") or {}
        if w.get("id") and w.get("id") != "-" and w["id"] not in seen and (e.get("at") or 0) > cutoff:
            seen.add(w["id"])
            rows.append({**w, "state": "retired" if e.get("kind") in ("retired", "cart-retired") else "seen"})
    for w in rows:
        g.node("agent", w["id"], w.get("name") or w["id"], "s-agents", state=w.get("state"), tier=w.get("tier"),
               depth=w.get("depth"), by=w.get("by"))
    for w in rows:
        if w.get("parent"):
            g.edge(f"agent:{w['parent']}", f"agent:{w['id']}", "spawned")
        for c in w.get("children") or []:
            g.edge(f"agent:{w['id']}", f"agent:{c.get('id') if isinstance(c, dict) else c}", "spawned")
        if f"cart:{w.get('name')}" in g.nodes:
            g.edge(f"cart:{w['name']}", f"agent:{w['id']}", "spawned")


def _carts(g: _G):
    for c in src.carts():
        g.node("cart", c["name"], c["name"], "s-exam", does=c["does"])


def _jobs(g: _G, brain_ref: dict):
    for j in sorted(src.jobs(), key=lambda j: -(j["busy"] or j["created"] or 0)):
        nid = g.node("job", j["name"], j["name"], "s-agents", state=j["state"], job_kind=j["kind"], worker=j["worker"], busy=j["busy"])
        if j.get("model"):
            g.edge(nid, mind_id(j["model"], brain_ref), "runs-on")
        elif j.get("worker"):                       # a jail worker thinks with the brain
            g.edge(nid, f"brain:{brain_ref['brain']}", "runs-on")


def _repos(g: _G):
    for r in src.repos():
        g.node("repo", r, r, "s-release")
    br = src.lacuna_branches()
    repo = f"repo:{src.core.REPO.name}"
    for b in sorted(br, key=lambda b: -(b["t"] or 0)):
        nid = g.node("branch", b["name"], b["name"], "s-release", t=b["t"])
        g.edge(repo, nid, "spawned")


def _artifacts(g: _G):
    jobs = [n[4:] for n in g.nodes if n.startswith("job:")]
    branches = [n[7:] for n in g.nodes if n.startswith("branch:")]
    for a in src.artifacts():
        if not a.get("id"):
            continue
        nid = g.node("artifact", a["id"], f"{a.get('cart')} · {a.get('outcome')}", None, cart=a.get("cart"),
                     outcome=a.get("outcome"), when=a.get("when"), said=(a.get("said") or "")[:240])
        maker = next((f"job:{j}" for j in jobs if a["id"] == j or a["id"].startswith(j + "-")), None)
        maker = maker or (f"agent:{a['id']}" if f"agent:{a['id']}" in g.nodes else None)
        maker = maker or (f"cart:{a.get('cart')}" if f"cart:{a.get('cart')}" in g.nodes else None)
        if maker:
            g.edge(maker, nid, "wrote")
            g.nodes[nid]["app"] = g.nodes[maker]["app"]
            for b in branches:
                if b in (a.get("said") or ""):
                    g.edge(maker, f"branch:{b}", "wrote")
    for j in src.jobs():
        for b in branches:
            if b in j["text"]:
                g.edge(f"job:{j['name']}", f"branch:{b}", "wrote")


def _docs(g: _G):
    for d in src.docs():
        nid = g.node("doc", d["id"], d["id"], "s-handbook")
        if d["id"] in ("HANDBOOK", "OWNER-HANDBOOK"):
            g.edge("app:s-handbook", nid, "reads")


def _customers(g: _G):
    ports = {k: v["port"] for k, v in src.core.ENVS.items()}
    svc_by_port = {s["port"]: s["name"] for s in src.service_rows() if s.get("port")}
    for c in src.customers():
        nid = g.node("customer", c["id"], c["label"], "s-telemetry", api=c["api"])
        s = svc_by_port.get(ports.get(c["api"]))
        if s:
            g.edge(f"service:{s}", nid, "serves")


def _petitions(g: _G):
    owner = g.node("owner", "owner", "the owner", None)
    for p in src.petitions():
        act = str(p.get("action") or "")
        app = next((a for pre, a in PETITION_APP if act.startswith(pre)), "s-lacuna")
        nid = g.node("petition", p["id"], act or p["id"], app, by=p.get("by"), t=p.get("t"), effect=str(p.get("effect") or "")[:200])
        g.edge(nid, owner, "waits-on")
        g.edge(nid, f"app:{app}", "waits-on")


def _cortex(g: _G):
    cx = src.cortex()
    names = {}
    for nid, n in g.nodes.items():                   # the words a cortex key may name a known node by
        if n["kind"] in ("job", "agent", "cart", "service", "repo", "branch", "artifact", "mind", "brain", "doc", "customer"):
            names.setdefault(nid.split(":", 1)[1], nid)
    longnames = [k for k in names if len(k) >= 6]
    top = sorted(cx["nodes"].items(), key=lambda kv: -kv[1])[:CAPS["fact"] * 2]
    keep = {}
    for (kind, key), t in top:
        label = "a person" if kind == "person" else key        # no one's name rides on the map
        keep[(kind, key)] = g.node("fact", f"{kind}/{key}", label, None, cortex_kind=kind, t=t or None)

    def subject(key: str):
        if key in names:
            return names[key]
        for part in key.replace(":", "/").split("/"):
            if part in names:
                return names[part]
        return next((names[k] for k in longnames if k in key), None)

    for (kind, key), nid in keep.items():
        s = subject(key)
        if s:
            g.edge(nid, s, "about")
    for fk, fkey, tk, tkey, kind in cx["edges"]:
        a = keep.get((fk, fkey))
        if a and kind == "about":
            b = keep.get((tk, tkey)) or subject(tkey)
            if b:
                g.edge(a, b, "about")


# ── the pulses ──────────────────────────────────────────────────────────────────────────────────────────────────────
def _hand_target(op: str, args: list) -> str | None:
    if op == "tail-log" and args:
        return f"log:{args[0]}"
    if args and isinstance(args[0], str):
        p = args[0].replace(str(src.code_dir()) + "/", "").replace("~/code/", "")
        return f"repo:{p.strip('/').split('/')[0]}" if p and not p.startswith("/") else None
    return None


def build_events(brain_ref: dict, now: float) -> list[dict]:
    cut = now - EVENT_WINDOW_S
    ev: list[dict] = []
    for e in src.foreman_events():
        t, w, k = float(e.get("at") or 0), e.get("worker") or {}, e.get("kind")
        if t < cut or not w.get("id") or w["id"] == "-":
            continue
        me = f"agent:{w['id']}"
        d = e.get("data") or {}
        if k == "hand":
            to = _hand_target(str(d.get("op") or ""), list(d.get("args") or []))
            if to:
                ev.append({"t": t, "from": me, "to": to, "kind": "reads"})
        elif k == "report":
            ev.append({"t": t, "from": me, "to": "app:s-agents", "kind": "feeds"})
        elif k in ("cart-retired", "retired"):
            ev.append({"t": t, "from": me, "to": f"artifact:{w['id']}", "kind": "wrote"})
        elif k in ("spawned", "spawn", "started"):
            ev.append({"t": t, "from": f"agent:{w['parent']}" if w.get("parent") else "app:s-agents", "to": me, "kind": "spawned"})
    for r in src.escalations():
        t = src.iso_t(r.get("at"), utc=True)
        if not t or t < cut:
            continue
        prev = None
        for rung in r.get("rungs") or []:
            m = mind_id(rung.get("model"), brain_ref)
            ev.append({"t": t, "from": prev or f"cart:{r.get('cart')}", "to": m, "kind": "calls"})
            prev = m
    for a in src.audit_rows():
        t, act = float(a.get("t") or 0), a.get("action")
        if t < cut:
            continue
        if act == "chat.ask":
            ev.append({"t": t, "from": "app:s-chat", "to": mind_id(a.get("model") or "lacuna-worker-lite", brain_ref), "kind": "calls"})
        elif act == "petition.filed" and isinstance(a.get("petition"), dict):
            ev.append({"t": t, "from": f"petition:{a['petition'].get('id')}", "to": "owner:owner", "kind": "waits-on"})
    for j in src.jobs():
        if j["busy"] and j["busy"] > cut and j.get("worker") and j.get("state") == "on":
            ev.append({"t": j["busy"], "from": f"job:{j['name']}", "to": f"brain:{brain_ref['brain']}", "kind": "runs-on"})
    ev.sort(key=lambda e: e["t"])
    return ev


# ── assembly ────────────────────────────────────────────────────────────────────────────────────────────────────────
def _fold(g: _G) -> None:
    """Each kind past its cap (and the whole past MAX_NODES) folds its oldest into one "N more" node; edges follow."""
    moved: dict[str, str] = {}
    by_kind: dict[str, list[str]] = {}
    for nid, n in g.nodes.items():
        by_kind.setdefault(n["kind"], []).append(nid)
    budget = MAX_NODES - len(by_kind)
    for kind, ids in by_kind.items():
        cap = min(CAPS.get(kind, 400), max(1, budget))
        if len(ids) > cap:
            more = f"more:{kind}"
            for nid in ids[cap:]:
                moved[nid] = more
            g.nodes[more] = {"id": more, "kind": "more", "label": f"{len(ids) - cap} more {kind}s",
                             "app": g.nodes[ids[0]]["app"], "meta": {"of": kind, "n": len(ids) - cap}}
            ids = ids[:cap]
        budget -= len(ids)
    for nid in moved:
        g.nodes.pop(nid, None)
    edges: dict[tuple, dict] = {}
    for (a, b, k), e in g.edges.items():
        a, b = moved.get(a, a), moved.get(b, b)
        if a in g.nodes and b in g.nodes and a != b:
            edges.setdefault((a, b, k), {**e, "from": a, "to": b})
    g.edges = edges


def _weigh(g: _G, events: list[dict], now: float) -> None:
    for e in events:
        if e["t"] < now - WEIGHT_S or e["from"] not in g.nodes or e["to"] not in g.nodes:
            continue
        row = g.edges.setdefault((e["from"], e["to"], e["kind"]), {"from": e["from"], "to": e["to"], "kind": e["kind"], "weight": 0, "live": False})
        row["weight"] += 1
        row["live"] = row["live"] or e["t"] >= now - LIVE_S


def build() -> tuple[dict, list[dict]]:
    now = time.time()
    g, brain_ref = _G(), {"brain": "lacuna-worker-lite", "aliases": {"lacuna-worker-lite"}}
    _source(g, "apps", _apps)
    _source(g, "services", _services)
    _source(g, "minds", lambda g: _minds(g, brain_ref))
    _source(g, "carts", _carts)
    _source(g, "agents", _agents)
    _source(g, "jobs", lambda g: _jobs(g, brain_ref))
    _source(g, "repos", _repos)
    _source(g, "artifacts", _artifacts)
    _source(g, "docs", _docs)
    _source(g, "customers", _customers)
    _source(g, "petitions", _petitions)
    _source(g, "cortex", _cortex)
    try:
        events = build_events(brain_ref, now)
    except Exception as e:  # noqa: BLE001
        g.sources["events"] = f"{e.__class__.__name__}: {e}"[:160]
        events = []
    for e in events:                                 # a log a worker read is a real node (a service's log is the service)
        if e["to"].startswith("log:"):
            name = e["to"][4:]
            if f"service:{name}" in g.nodes:
                e["to"] = f"service:{name}"
            elif e["t"] >= now - WEIGHT_S:
                g.node("log", name, f"{name} log", "s-watch")
    _fold(g)
    _weigh(g, events, now)
    graph = {"nodes": list(g.nodes.values()), "edges": list(g.edges.values()), "at": now, "sources": g.sources}
    _remember(graph, now)
    return graph, events


def _cached() -> tuple[dict, list[dict]]:
    with _LOCK:
        if _CACHE["graph"] is None or time.time() - _CACHE["t"] > TTL_S:
            _CACHE["graph"], _CACHE["events"] = build()
            _CACHE["t"] = time.time()
        return _CACHE["graph"], _CACHE["events"]


def counts(graph: dict) -> dict:
    return {"nodes": dict(Counter(n["kind"] for n in graph["nodes"])), "edges": dict(Counter(e["kind"] for e in graph["edges"]))}


# ── the scrubber's history: one row of counts a minute, kept 48 h in LACUNA_HOME/map-history.jsonl ─────────────────
def _history_file():
    return src.lhome() / "map-history.jsonl"


def _remember(graph: dict, now: float, every: float = 60) -> None:
    p = _history_file()
    try:
        if p.exists() and now - p.stat().st_mtime < every:
            return
        p.parent.mkdir(parents=True, exist_ok=True)
        with p.open("a") as f:
            f.write(json.dumps({"t": round(now, 3), **counts(graph)}) + "\n")
        if p.stat().st_size > 2_000_000:
            rows = [r for r in src._jsonl(p.read_text()) if r.get("t", 0) > now - HISTORY_KEEP_S]
            p.write_text("".join(json.dumps(r) + "\n" for r in rows))
    except OSError:
        pass


def history(hours: float = 6, step: float = 60) -> dict:
    hours = max(0.1, min(float(hours), 48.0))
    step = max(10.0, float(step))
    now = time.time()
    start = now - hours * 3600
    n = min(int(hours * 3600 // step) + 1, 2000)
    step = hours * 3600 / max(n - 1, 1) if n == 2000 else step
    rows = [r for r in src._jsonl(_history_file().read_text()) if r.get("t", 0) >= start - step] if _history_file().exists() else []
    _, events = _cached()
    steps = []
    ri = 0
    last = None
    for i in range(n):
        t = start + i * step
        while ri < len(rows) and rows[ri]["t"] <= t:
            last = rows[ri]
            ri += 1
        evc = Counter(e["kind"] for e in events if t - step < e["t"] <= t)
        steps.append({"t": round(t, 1), "nodes": (last or {}).get("nodes"), "edges": (last or {}).get("edges"), "events": dict(evc)})
    return {"hours": hours, "step": step, "from": start, "to": now, "steps": steps}


# ── the routes ──────────────────────────────────────────────────────────────────────────────────────────────────────
@router.get("/api/map/graph")
def map_graph():
    return _cached()[0]


@router.get("/api/map/events")
def map_events(since: float = 0, limit: int = 500):
    _, events = _cached()
    return [e for e in events if e["t"] > since][-max(1, min(int(limit), 2000)):]


@router.get("/api/map/history")
def map_history(hours: float = 6, step: float = 60):
    return history(hours, step)
