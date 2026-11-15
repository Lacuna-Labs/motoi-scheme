"""hands_api — THE BOX'S VERBS a cart reads through Lacuna's own API (the owner, 2026-10-18: "at least 25 … useful
utilities that need to happen inside of the system using Scheme, so that they can use the API more and less of using the
other system"). Each is a READ — `(hand 'disk)`, `(hand 'service "dev-api")` — answered by the same route the desk reads,
trimmed to what a cart can hold. Nothing here changes anything; a change is an act (acts.py).

The table is the reference: op · route · what it answers. lacuna-reference.py writes each into the reference manual.
"""
from __future__ import annotations

import json
import re
import urllib.parse
import urllib.request

API = "http://127.0.0.1:1138"
SAFE = re.compile(r"^[\w.:@/-]{1,120}$")

# op: (route with {0} {1} for args, what it answers, example)
OPS: dict[str, tuple[str, str, str]] = {
    "overview":      ("/api/overview", "the box at a glance: services, disk, memory, alerts", "(hand 'overview)"),
    "disk":          ("/api/disk/plan", "free space and the disk plan: what may be cleared, by rule", "(hand 'disk)"),
    "disk-eaters":   ("/api/disk/eaters", "the biggest folders, by size", "(hand 'disk-eaters)"),
    "services":      ("/api/services", "every service: up or down, pid, port", "(hand 'services)"),
    "service":       ("/api/services/{0}/explain", "one service: why it is up or down, in words", "(hand 'service \"dev-api\")"),
    "service-log":   ("/api/services/{0}/log?lines={1}", "a service's last lines", "(hand 'service-log \"dev-api\" 40)"),
    "watchdogs":     ("/api/watchdogs", "every watchdog's last word on dev and QA, with its age", "(hand 'watchdogs)"),
    "alerts":        ("/api/alerts", "the open alerts", "(hand 'alerts)"),
    "errors":        ("/api/errors/summary", "error classes: new, rising, returned", "(hand 'errors)"),
    "jobs":          ("/api/jobs", "the recent jobs: kind, title, running, ok", "(hand 'jobs)"),
    "carts":         ("/api/automations", "every cart: state, cast, fit, retries, last runs", "(hand 'carts)"),
    "cart-run":      ("/api/carts/run/{0}/{1}", "one run's artifact: steps, minds, outcome", "(hand 'cart-run \"release\" \"20261018-…\")"),
    "builds":        ("/api/deploys", "the iPad builds kept for a deploy", "(hand 'builds)"),
    "release-board": ("/api/release/board", "dev · QA · the iPad: each lane's commit and the gaps", "(hand 'release-board)"),
    "release":       ("/api/release", "the last release and its four steps", "(hand 'release)"),
    "health":        ("/api/health", "every health check, dev and QA (QA is read, never touched)", "(hand 'health)"),
    "mocks":         ("/api/desk/mocks", "the mock marketplaces and L2 daemons: up or down", "(hand 'mocks)"),
    "devices":       ("/api/devices", "the rack: services, launchd agents, periodic jobs, Loam", "(hand 'devices)"),
    "escalations":   ("/api/cascade/report", "where minds climbed: per job, which rung accepted, unheld", "(hand 'escalations)"),
    "minds":         ("/api/forge/pantheon", "every mind: pairs, scores against the 90% mark", "(hand 'minds)"),
    "roles":         ("/api/minds/roles", "the minds in service and their versions", "(hand 'roles)"),
    "recall":        ("/api/cortex/recall?q={0}&k=8", "what the cortex recalls for a question, by meaning", "(hand 'recall \"why did the release stop\")"),
    "work":          ("/api/work", "what is running and how far along", "(hand 'work)"),
    "battery-runs":  ("/api/battery/runs", "the True State runs: each act green or red", "(hand 'battery-runs)"),
    "caliper":       ("/api/caliper", "Caliper's reports and scores", "(hand 'caliper)"),
    "eye":           ("/api/eye", "the eyes: which surfaces are watched, their last frames", "(hand 'eye)"),
    "sentinel":      ("/api/sentinel", "what the sentinel sees that is not accepted", "(hand 'sentinel)"),
    "petitions":     ("/api/petitions", "cards waiting on the owner's press", "(hand 'petitions)"),
    "owner-here":    ("/api/desk/seen", "is the owner's desk open now (and on which screen)", "(hand 'owner-here)"),
    "brain":         ("/api/ai", "the brain and the small minds: loaded, room left", "(hand 'brain)"),
    "usage":         ("/api/usage", "the brain's use today: calls, seconds, by lane", "(hand 'usage)"),
    "drills":        ("/api/drills", "DiRT drills: running, history", "(hand 'drills)"),
}
LIMIT = 60_000          # characters: a cart holds a summary, not a dump


def _trim(v, depth: int = 0):
    if isinstance(v, list):
        return [_trim(x, depth + 1) for x in v[:40]]
    if isinstance(v, dict):
        return {k: _trim(x, depth + 1) for k, x in list(v.items())[:60]} if depth < 5 else "…"
    if isinstance(v, str):
        return v[:800]
    return v


def do(op: str, args: list) -> dict:
    route, _, _ = OPS[op]
    vals = [urllib.parse.quote(str(a), safe="") for a in args]
    if any(not SAFE.match(str(a)) for a in args if op != "recall"):
        raise ValueError(f"{op}: an argument may hold only letters, digits and . : @ / - _")
    need = len(re.findall(r"\{\d\}", route))
    if len(vals) < need:
        if op == "service-log" and len(vals) == 1:
            vals.append("40")
        else:
            raise ValueError(f"{op} needs {need} argument(s): {OPS[op][2]}")
    path = route.format(*vals)
    req = urllib.request.Request(API + path, headers={"X-Lacuna-Who": "foreman:hand"})
    with urllib.request.urlopen(req, timeout=60) as r:
        out = _trim(json.loads(r.read()))
    s = json.dumps(out)
    return out if len(s) <= LIMIT else {"trimmed": True, "head": s[:LIMIT]}
