"""THE AGENTS AND EXAM CARDS' DATA (LACUNA-1.3-DESIGN §36–§37.1) — read only, tolerant of files another job is still writing.

  agents()      the minds' tiers from ~/lacuna-world/bench/agents/tiers.json (absent → state "benching"), and which small
                minds run now (GET :11434/lacuna/minds — a 404 or no answer is "not reported"). The live agents themselves
                come to the page from /api/foreman (the foreman card's own path), not from here.
  exam()        E1–E10 from ~/lacuna-world/exam/state.json (schema in home.py), with the score line's numbers.
  exam_init()   writes the initial state.json — all ten items waiting — if there is none.

LACUNA_WORLD moves ~/lacuna-world (tests never read the live world).
"""
from __future__ import annotations

import json
import os
import urllib.request
from pathlib import Path

MINDS_URL = "http://127.0.0.1:11434/lacuna/minds"
STATES = ("waiting", "running", "press", "done", "failed")
# §37.1: the ten items and their carts. An item passes at "press" (waiting on your press) or "done" (E5, E8 and E10 pass by
# being done; a merged item is done too).
EXAM = [
    ("E1", "narrow refund-rate-dashboard-build (104,966 bytes)", "heavy-context-narrower"),
    ("E2", "narrow cross-marketplace-photo-coherence (746,652 bytes)", "heavy-context-narrower"),
    ("E3", "repair fake-review-detect (strict:no-table)", "strict-cart-loop"),
    ("E4", "repair custom-order-accept-notify (strict fails)", "strict-cart-loop"),
    ("E5", "prove cortex recall finds a worker's report", "battery-reds-to-fixes"),
    ("E6", "a README for a package that has none", "docs-sweep"),
    ("E7", "the codemap of curator-api/curator_api/stores", "docs-sweep"),
    ("E8", "clean its own retired worktrees", "disk-steward"),
    ("E9", "the date-fragile shop-series test", "battery-reds-to-fixes"),
    ("E10", "read a day of the dev API's log, file what is real", "log-watch"),
]
# The items whose cart is not written yet run on one of Lacuna's jail worker classes (lacuna-box/jail/workers/classes):
# the cart's job, done by its worker. `lacuna exam start` files a spawn-job card for them; the worker moves its own row
# when it retires (run.py move_exam). A cart file, once written, wins (carts.start).
EXAM_WORKERS = {
    # the first ten carts (docs/DAEMONS-1.0.md §1b): every exam item now has a runner — narrowing and strict repair are
    # the repair class's two goals, a README is the docs class
    "E1": ("repair", {"slug": "refund-rate-dashboard-build", "goal": "narrow"}),
    "E2": ("repair", {"slug": "cross-marketplace-photo-coherence", "goal": "narrow"}),
    "E3": ("repair", {"slug": "fake-review-detect"}),
    "E4": ("repair", {"slug": "custom-order-accept-notify"}),
    "E6": ("docs", {"path": "curator-api/curator_api/verbs"}),
    "E5": ("recall-check", {}),
    "E7": ("codemap", {"path": "curator-api/curator_api/stores"}),
    "E8": ("disk-steward", {}),
    "E9": ("testfix", {"test": "curator-api/tests/test_shop_series_pinned.py",
                       "name": "test_build_series_is_byte_equal_on_the_fixture_shops",
                       "why": "the pinned payload depends on today's date: a stage reads the real clock past the test's "
                              "patched time.time, so the test fails on any day but the one it was recorded",
                       "rerecord": {"SHOP_SERIES_PIN_WRITE": "1"}}),     # the test's own documented re-record switch
}


def world() -> Path:
    return Path(os.environ.get("LACUNA_WORLD") or Path.home() / "lacuna-world")


def _read(p: Path):
    try:
        return json.loads(p.read_text())
    except (OSError, ValueError):
        return None


def _num(v):
    try:
        return float(v) if v is not None and v != "" else None
    except (TypeError, ValueError):
        return None


def _score(r: dict) -> tuple[str, float | None]:
    """'19/20', {right, of}, a fraction 0..1 or a percent — shown as words, kept as a fraction for the sort."""
    s = r.get("score", r.get("pass"))
    right, of = r.get("right", r.get("passed")), r.get("of", r.get("cases", r.get("total")))
    if isinstance(s, dict):
        right, of, s = s.get("right", s.get("passed")), s.get("of", s.get("total")), None
    if isinstance(s, str) and "/" in s:
        right, _, of = s.partition("/")
        s = None
    if _num(right) is not None and _num(of):
        return f"{int(_num(right))}/{int(_num(of))}", _num(right) / _num(of)
    f = _num(s)
    if f is None:
        return "—", None
    f = f / 100 if f > 1 else f
    return f"{round(f * 100)}%", f


def _fail(f) -> dict:
    if not isinstance(f, dict):
        return {"case": str(f)[:200], "want": None, "got": None}
    return {"case": str(f.get("case") or f.get("signal") or f.get("input") or f.get("ask") or f.get("id") or "")[:200],
            "want": f.get("right", f.get("want", f.get("expected"))), "got": f.get("got", f.get("said", f.get("answer")))}


def _row(r: dict, job: str | None = None) -> dict:
    score, frac = _score(r)
    secs = _num(r.get("seconds", r.get("sec", r.get("s"))))
    if secs is None and _num(r.get("ms")) is not None:
        secs = _num(r.get("ms")) / 1000
    fails = r.get("failures", r.get("fails", r.get("misses"))) or []
    return {"mind": str(r.get("mind") or r.get("model") or r.get("name") or "?"),
            "job": str(r.get("job") or r.get("job_class") or r.get("class") or job or "—"),
            "tier": r.get("tier"), "score": score, "frac": frac, "seconds": secs,
            "served_by": r.get("served_by") or r.get("server") or r.get("via") or r.get("runtime"),
            "held": r.get("held", r.get("holds")),
            "failures": [_fail(f) for f in (fails if isinstance(fails, list) else [])][:40]}


def tiers(doc) -> list[dict]:
    """Rows from whatever shape tiers.json takes: a list of rows; {minds|rows|tiers: [...]}; or {jobs: {job: row|[rows]}}."""
    if isinstance(doc, list):
        return [_row(r) for r in doc if isinstance(r, dict)]
    if not isinstance(doc, dict):
        return []
    for k in ("minds", "rows", "tiers", "results"):
        if isinstance(doc.get(k), list):
            return [_row(r) for r in doc[k] if isinstance(r, dict)]
    out = []
    jobs = doc.get("jobs") if isinstance(doc.get("jobs"), dict) else doc
    for job, v in jobs.items():
        for r in (v if isinstance(v, list) else [v]):
            if isinstance(r, dict):
                out.append(_row(r, job))
    return out


def running_minds() -> dict:
    try:
        with urllib.request.urlopen(MINDS_URL, timeout=1) as r:
            d = json.load(r)
    except (OSError, ValueError):
        return {"reported": False, "names": []}
    rows = d.get("minds", d.get("models", [])) if isinstance(d, dict) else d
    names = [str(m.get("name") or m.get("model") or m.get("mind")) if isinstance(m, dict) else str(m) for m in (rows or [])]
    return {"reported": True, "names": [n.removesuffix(":latest") for n in names if n and n != "None"]}


def agents() -> dict:
    p = world() / "bench" / "agents" / "tiers.json"
    doc = _read(p)
    rows = tiers(doc) if doc is not None else []
    run = running_minds()
    for r in rows:
        r["running"] = r["mind"].removesuffix(":latest") in run["names"]
    rows.sort(key=lambda r: (r["job"], -(r["frac"] or 0), r["seconds"] or 1e9))
    return {"state": "ready" if doc is not None else "benching", "updated": (doc or {}).get("updated") if isinstance(doc, dict) else None,
            "rows": rows[:40], "running": run}


def _item(i: dict, base: tuple) -> dict:
    st = i.get("state") if i.get("state") in STATES else "waiting"
    return {"id": base[0], "title": str(i.get("title") or base[1]), "cart": str(i.get("cart") or base[2]), "state": st,
            "worker": i.get("worker"), "minutes": _num(i.get("minutes")) or 0, "brain_seconds": _num(i.get("brain_seconds")) or 0,
            "minds": [str(m) for m in (i.get("minds") or [])][:6], "said": str(i.get("said") or "")[:200],
            "petition": i.get("petition"), "class": (EXAM_WORKERS.get(base[0]) or (None,))[0]}


def exam() -> dict:
    doc = _read(world() / "exam" / "state.json")
    have = {i.get("id"): i for i in ((doc or {}).get("items") or []) if isinstance(i, dict)} if isinstance(doc, dict) else {}
    items = [_item(have.get(b[0]) or {}, b) for b in EXAM]
    press = sum(1 for i in items if i["state"] == "press")
    done = sum(1 for i in items if i["state"] == "done")
    return {"present": doc is not None, "started": (doc or {}).get("started") if isinstance(doc, dict) else None, "items": items,
            "press": press, "done": done, "passed": press + done,
            "running": sum(1 for i in items if i["state"] == "running"), "failed": sum(1 for i in items if i["state"] == "failed"),
            "minutes": round(sum(i["minutes"] for i in items), 1), "brain_seconds": round(sum(i["brain_seconds"] for i in items))}


def exam_init() -> Path:
    p = world() / "exam" / "state.json"
    if not p.exists():
        p.parent.mkdir(parents=True, exist_ok=True)
        p.write_text(json.dumps({"started": None, "items": [
            {"id": e, "title": t, "cart": c, "state": "waiting", "worker": None, "minutes": 0, "brain_seconds": 0, "minds": [],
             "said": "", "petition": None, "class": (EXAM_WORKERS.get(e) or (None,))[0]} for e, t, c in EXAM]}, indent=1) + "\n")
    return p
