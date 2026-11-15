"""Lacuna's MAP feed (control/sysmap.py): every source missing, partial or broken still draws; edges are only real ones."""
from __future__ import annotations

import json
import time

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from lacuna_api.control import sysmap
from lacuna_api.control import sysmap_sources as src


@pytest.fixture
def world(tmp_path, lacuna_home, monkeypatch):
    w = tmp_path / "world"
    w.mkdir(exist_ok=True)
    monkeypatch.setenv("LACUNA_HOME", str(lacuna_home))
    monkeypatch.setenv("LACUNA_CODE_DIR", str(tmp_path / "code"))
    monkeypatch.setattr(src, "foreman_tree", lambda: None)
    monkeypatch.setattr(src, "gateway_minds", lambda: None)
    monkeypatch.setattr(src, "lacuna_branches", lambda: [])
    monkeypatch.setattr(src, "service_rows", lambda: [
        {"name": n, "title": n, "port": p, "up": True, "hers": n == "qa-api"}
        for n, p in (("dev-api", 5051), ("qa-api", 5050), ("vite", 3000), ("lacuna", 1138))])
    src._FILES.clear()
    src._CORTEX.update(t=0.0, v=None)
    sysmap._CACHE.update(t=0.0, graph=None, events=[])
    return w


def _ids(g, kind):
    return {n["id"] for n in g["nodes"] if n["kind"] == kind}


def _edge(g, a, b, kind):
    return next((e for e in g["edges"] if e["from"] == a and e["to"] == b and e["kind"] == kind), None)


def test_nothing_there_still_draws(world):
    g, ev = sysmap.build()
    assert len(_ids(g, "app")) >= 15 and "service:qa-api" in _ids(g, "service")
    assert _ids(g, "brain") and "owner:owner" in _ids(g, "owner")
    assert ev == [] and not _ids(g, "job") and not _ids(g, "fact")
    assert "gateway" in g["sources"] and "foreman" in g["sources"]
    assert _edge(g, "service:vite", "service:qa-api", "depends")
    assert all(e["kind"] in {"spawned", "runs-on", "calls", "reads", "wrote", "feeds", "depends", "about", "waits-on", "serves"}
               for e in g["edges"])


def _fill(w, lh, now):
    (w / "carts").mkdir()
    (w / "carts" / "log-sentry.sks").write_text(";; x\n(lacuna-cart 'log-sentry\n  '((does . \"reads the log\")))\n")
    j = w / "jobs" / "w-docs-1"
    j.mkdir(parents=True)
    (j / "job.json").write_text(json.dumps({"name": "w-docs-1", "kind": "work", "state": "on", "worker": "docs",
                                            "goal": "write docs on lacuna-docs-x", "created": "2026-10-18T06:15"}))
    (w / "artifacts").mkdir()
    (w / "artifacts" / "INDEX.slat").write_text('(latest :cart "docs" :id "w-docs-1-4d9f" :outcome "stopped" :when "x" :said "on lacuna-docs-x")\n')
    utc = time.strftime("%Y-%m-%dT%H:%M:%S", time.gmtime(now - 10))
    (w / "cascade").mkdir()
    (w / "cascade" / "escalations.jsonl").write_text(json.dumps({"at": utc, "cart": "log-sentry", "rungs": [
        {"model": "functiongemma"}, {"model": "lacuna-worker-lite"}]}) + "\n")
    ev = [{"at": now - 20, "kind": "hand", "worker": {"id": "w-1", "name": "log-sentry"}, "data": {"op": "tail-log", "args": ["dev-api", 150]}},
          {"at": now - 900 * 3, "kind": "report", "worker": {"id": "w-1", "name": "log-sentry"}, "data": {}},
          "not json"]
    (lh / "foreman-events.jsonl").write_text("\n".join(e if isinstance(e, str) else json.dumps(e) for e in ev) + "\n")
    (lh / "audit.jsonl").write_text(json.dumps({"t": now - 5, "action": "petition.filed", "petition": {"id": "p1"}}) + "\n")
    (lh / "petitions.json").write_text(json.dumps({"p1": {"id": "p1", "action": "forge-train", "state": "waiting"},
                                                   "p2": {"id": "p2", "action": "qa-restart", "state": "approved"}}))
    (lh / "customers.json").write_text(json.dumps([{"id": "acct-7", "label": "Shop Seven", "api": "qa"}]))


def test_every_source_draws_real_edges(world, lacuna_home, monkeypatch):
    now = time.time()
    _fill(world, lacuna_home, now)
    monkeypatch.setattr(src, "foreman_tree", lambda: {"workers": [
        {"id": "w-1", "name": "log-sentry", "parent": None, "children": [{"id": "w-2"}], "state": "running"},
        {"id": "w-2", "name": "helper", "parent": "w-1", "children": [], "state": "running"}]})
    monkeypatch.setattr(src, "gateway_minds", lambda: {"minds": [{"name": "functiongemma:latest"}], "small": ["gemma3:1b"],
                                                       "profile": {"brain": "gemma4:26b", "last_rung": "lacuna-worker-lite"}})
    monkeypatch.setattr(src, "lacuna_branches", lambda: [{"name": "lacuna-docs-x", "t": now}])
    monkeypatch.setattr(src, "_cortex_since", lambda: {"ok": True, "since": "24h", "n": 2, "arrived": [
        {"kind": "card", "key": "w-docs-1", "at": "2026-10-18T07:00:00", "text": "the words are dropped"},
        {"kind": "person", "key": "someone-real", "at": "2026-10-18T06:00:00", "text": "a name"}]})
    g, ev = sysmap.build()
    assert _edge(g, "agent:w-1", "agent:w-2", "spawned") and _edge(g, "cart:log-sentry", "agent:w-1", "spawned")
    assert _edge(g, "job:w-docs-1", "brain:gemma4:26b", "runs-on")
    assert _edge(g, "job:w-docs-1", "artifact:w-docs-1-4d9f", "wrote") and _edge(g, "job:w-docs-1", "branch:lacuna-docs-x", "wrote")
    calls = _edge(g, "cart:log-sentry", "mind:functiongemma", "calls")
    assert calls["weight"] == 1 and calls["live"] is True
    assert _edge(g, "mind:functiongemma", "brain:gemma4:26b", "calls")          # the cascade's climb
    assert _edge(g, "service:brain-gateway", "mind:functiongemma", "calls")
    reads = _edge(g, "agent:w-1", "service:dev-api", "reads")
    assert reads["live"] and reads["weight"] == 1
    assert _edge(g, "petition:p1", "owner:owner", "waits-on")["live"] and _edge(g, "petition:p1", "app:s-forge", "waits-on")
    assert "petition:p2" not in _ids(g, "petition")
    cust = next(n for n in g["nodes"] if n["id"] == "customer:acct-7")
    assert cust["label"] == "Shop Seven" and _edge(g, "service:qa-api", "customer:acct-7", "serves")
    assert _edge(g, "fact:card/w-docs-1", "job:w-docs-1", "about")
    assert all("someone-real" not in n["label"] for n in g["nodes"])           # a person rides by kind, never by name
    assert all("words are dropped" not in json.dumps(n) for n in g["nodes"])   # the cortex's words never ride the map
    assert all(e["t"] > now - sysmap.EVENT_WINDOW_S for e in ev)


def test_the_brain_is_read_from_the_brain_profile_when_the_gateway_is_silent(world, lacuna_home, tmp_path, monkeypatch):
    # order §1.5: switch-brain.sh writes the current brain to ~/.lacuna/brain-profile.json, never the tracked box-minds.json
    box = tmp_path / "box-minds.json"
    box.write_text(json.dumps({"brain": "gemma4:e4b-it-qat", "agent_minds": []}))
    monkeypatch.setenv("LACUNA_BOX_MINDS", str(box))
    (lacuna_home / "brain-profile.json").write_text(json.dumps({"brain": "gemma4:12b-it-qat", "brain_kv_gb": 2}))
    g, _ = sysmap.build()
    assert "brain:gemma4:12b-it-qat" in _ids(g, "brain")
    assert src.box_minds()["brain_kv_gb"] == 2


def test_broken_sources_are_said(world, lacuna_home):
    (world / "jobs" / "bad").mkdir(parents=True)
    (world / "jobs" / "bad" / "job.json").write_text("{not json")
    (world / "cortex").mkdir()
    (world / "cortex" / "cortex.snap").write_text("garbage")
    (lacuna_home / "petitions.json").write_text("[1, 2")
    (lacuna_home / "foreman-events.jsonl").write_text("\x00\x01\n{}\n")
    g, ev = sysmap.build()
    assert not _ids(g, "job") and not _ids(g, "fact") and not _ids(g, "petition") and ev == []


# P-2026-11-01-cortex-snapshot-per-write: the map parsed the cortex's 388 MB snapshot in one json.loads at each rewrite and
# froze the API 6-7 s; it asks the cortex instead, at most once a minute, and a test's home has no broker to ask
def test_the_cortex_is_asked_once_a_minute_and_its_snapshot_never_read(world, monkeypatch):
    (world / "cortex").mkdir()
    (world / "cortex" / "cortex.snap").write_text(json.dumps({"nodes": [   # a good snapshot the map must never open
        {"kind": "card", "key": "from-the-snapshot", "props": {"at": {"t": "str", "v": "2026-11-01T04:00:00"}}}], "edges": []}))
    asked = []
    monkeypatch.setattr(src, "_cortex_since", lambda: asked.append(1) or {"ok": True, "arrived": [
        {"kind": "lesson", "key": "climb-1", "at": "2026-11-01T04:21:24", "text": "x"}]})
    assert src.cortex() == {"nodes": {("lesson", "climb-1"): src.iso_t("2026-11-01T04:21:24")}, "edges": []}
    assert src.cortex()["nodes"] and asked == [1], "asked once inside the minute"
    assert not any("cortex" in k for k in src._FILES), "the snapshot was never read"
    assert ("card", "from-the-snapshot") not in src.cortex()["nodes"]
    src._CORTEX["t"] = 0.0   # the minute is up
    monkeypatch.setattr(src, "_cortex_since", lambda: {"ok": False, "error": "the cortex did not answer (FileNotFoundError)"})
    assert src.cortex() == {"nodes": {}, "edges": []}, "no answer is no facts"


def test_a_tests_home_has_no_broker_to_ask(world):
    r = src._cortex_since()
    assert r.get("ok") is False and "did not answer" in r.get("error", "")


def test_long_tails_fold(world, monkeypatch):
    for i in range(300):
        d = world / "jobs" / f"j{i:03d}"
        d.mkdir(parents=True)
        (d / "job.json").write_text(json.dumps({"name": f"j{i:03d}", "state": "done"}))
    monkeypatch.setattr(sysmap, "MAX_NODES", 120)
    g, _ = sysmap.build()
    more = next(n for n in g["nodes"] if n["id"] == "more:job")
    assert len(g["nodes"]) <= 120 and more["meta"]["n"] == 300 - len(_ids(g, "job"))
    ids = {n["id"] for n in g["nodes"]}
    assert all(e["from"] in ids and e["to"] in ids for e in g["edges"])


def test_routes(world, lacuna_home):
    now = time.time()
    _fill(world, lacuna_home, now)
    app = FastAPI()
    app.include_router(sysmap.router)
    c = TestClient(app)
    g = c.get("/api/map/graph").json()
    assert set(g) >= {"nodes", "edges", "at"} and all(set(n) >= {"id", "kind", "label", "app", "meta"} for n in g["nodes"])
    assert all(set(e) >= {"from", "to", "kind", "weight", "live"} for e in g["edges"])
    evs = c.get("/api/map/events", params={"since": now - 15}).json()
    assert evs and all(e["t"] > now - 15 and set(e) == {"t", "from", "to", "kind"} for e in evs)
    assert c.get("/api/map/events", params={"since": now + 1}).json() == []
    h = c.get("/api/map/history", params={"hours": 1, "step": 600}).json()
    assert len(h["steps"]) == 7 and h["steps"][-1]["nodes"]["app"] >= 15
    assert (lacuna_home / "map-history.jsonl").exists()
