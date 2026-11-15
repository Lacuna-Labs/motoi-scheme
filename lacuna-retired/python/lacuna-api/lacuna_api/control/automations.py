"""AUTOMATIONS — every cart, live: who does what, where (the owner, 2026-10-18: "you make an automations card where these
carts are available, and then you show the workflow and the brains and who's doing what and what's working where";
CARTS-ARE-THE-WORK-1.0 §7).

  GET /api/automations   {brain, carts: [{…cart (cartview), cast: [mind…], live: {…} | null, manual: [run…]}], kinds}

Per cart:
  cast    each mind it holds: its job, the model that answers (a pantheon role in service, or the class's pick, or the
          26B), why, and the role's one-shot score against the 90% mark; the brain when the cart names judgment points
  live    the foreman's process running it now: its state, its steps (the latest lit on the flowchart), its brain
          seconds, what its minds were asked, dropped, failed; null when it is not running
  manual  the same kind of work done another way (the brain or a script by hand: the job history), beside the cart's runs
Read-only. Each part degrades alone: a foreman that does not answer leaves `live` null and says so.
"""
from __future__ import annotations

import time
import urllib.request

from fastapi import APIRouter

router = APIRouter()
PASS_MARK = 0.9
# the job history's kinds → the cart that does that work (a manual release is compared with release.sks)
MANUAL_KIND = {"release": "release", "promote": "release", "battery": "battery-shepherd", "disk": "cleanup", "nightly": "cleanup"}


def _brain_up() -> bool:
    try:
        with urllib.request.urlopen("http://127.0.0.1:8091/health", timeout=1.5) as r:
            return r.status == 200
    except Exception:  # noqa: BLE001
        return False


def _scores() -> dict:
    """role name (the title, lowercased) → {score, pass, state, model}"""
    try:
        from . import pantheon_view
        out = {}
        for m in pantheon_view.pantheon().get("minds", []):
            sc = max((m.get("trained") or 0), (m.get("q8") or 0)) or None
            out[str(m.get("title") or m.get("name")).lower()] = {"score": sc, "pass": bool(sc and sc >= PASS_MARK), "state": m.get("state"), "mind": m.get("name")}
        return out
    except Exception:  # noqa: BLE001
        return {}


def _live() -> tuple[dict, str | None]:
    try:
        from . import foreman
        d = foreman.workers()
    except Exception as e:  # noqa: BLE001
        return {}, f"the foreman did not answer ({e.__class__.__name__})"
    by = {}
    for w in d.get("workers") or []:
        if w.get("state") in ("retired", "grave", "stopped", "done"):
            continue                                   # a finished process lingers in the foreman's list; it is not running
        c = w.get("cart") or {}
        key = c.get("name") or w.get("name")
        steps = c.get("steps") or []
        by[key] = {"worker": w.get("id"), "state": w.get("state"), "started": w.get("started"), "by": w.get("by"),
                   "steps": steps[-12:], "now": steps[-1]["name"] if steps else (w.get("last") or None),
                   "brain": c.get("brain") or 0, "mind": w.get("mind") or {}, "crashes": w.get("crashes", 0),
                   "skip_why": w.get("skip_why"), "reports": (w.get("reports") or [])[-5:], "is_cart": bool(c)}
    return by, None


def _manual() -> dict:
    try:
        from . import core
        out: dict = {}
        for j in core.jobs(80):
            cart = MANUAL_KIND.get(str(j.get("kind") or ""))
            if cart:
                out.setdefault(cart, []).append({"id": j.get("id"), "title": j.get("title"), "started": j.get("started"),
                                                  "ended": j.get("ended"), "ok": j.get("ok"), "who": j.get("who"), "how": "by hand"})
        return {k: v[:8] for k, v in out.items()}
    except Exception:  # noqa: BLE001
        return {}


def automations() -> dict:
    from . import cartview
    carts = cartview.carts().get("carts", [])
    scores = _scores()
    live, live_why = _live()
    manual = _manual()
    brain = _brain_up()
    from . import cart_fit
    climbs = cart_fit.climbs()
    running = [c.get("mind_detail") or {} for c in carts if live.get(c["name"])]
    rows = []
    for c in carts:
        cast = []
        for job, m in (c.get("mind_detail") or {}).items():
            role = m.get("role") or (m.get("model") if str(m.get("model") or "").lower() in scores else None)
            sc = scores.get(str(role or "").lower()) if role else None
            cast.append({"job": job, "class": m.get("job"), "model": m.get("model"), "why": m.get("why"), "role": role,
                         "score": (sc or {}).get("score"), "pass": (sc or {}).get("pass"), "rungs": m.get("rungs") or [],
                         **(climbs.get(f"{c['name']}|{job}") or {"climbs": 0, "due": False})})
        if c.get("kind") == "worker class":
            cast.append({"job": "all of it", "class": "brain", "model": "lacuna-worker-lite", "why": "a worker class is the brain working alone", "role": None})
        if c.get("judgment"):
            cast.append({"job": "judgment: " + ", ".join(map(str, c["judgment"])), "class": "brain", "model": "lacuna-worker-lite",
                         "why": "only at these points; the owner answers when the brain is down or busy", "role": None, "up": brain})
        others = [m for m, cc in zip(running, [x for x in carts if live.get(x["name"])]) if cc["name"] != c["name"]]
        fit = cart_fit.fit(c.get("mind_detail") or {}, others) if c.get("kind") == "cart" else None
        rows.append({**c, "cast": cast, "fit": fit, "live": live.get(c["name"]), "manual": manual.get(c["name"], [])})
    known = {r["name"] for r in rows}
    loose = [{"name": k, **v} for k, v in live.items() if k not in known]       # workers running that are not carts
    return {"at": time.time(), "brain": {"up": brain}, "carts": rows, "workers": loose, "live_why": live_why,
            "manual_only": {k: v for k, v in manual.items() if k not in known}, "pass_mark": PASS_MARK}


@router.get("/api/automations")
def r_automations() -> dict:
    return automations()
