"""THE CART BOOK — every cart, seen (the owner, 2026-10-19: "let her see all carts, know how to test them in the mock shop, and how
to repair them. That and training 1Bs should be her thing.").

There are 10,896 carts under ~/code/curator/carts/automations/<slug>/ and the last strict run (scratch/honest-count/
runs-all-strict1.json) judged 10,881 of them: about 1,000 work, about 9,800 do not. She had no way to LIST them — only to ask
about one whose name she already knew. This is the door:

  summary               how many carts, by verdict, and which repair cards are open
  find WORDS            carts whose name or header holds every word, each with its verdict
  failing [VERDICT] [N] the carts that fail (that verdict), the easiest first — a cart whose only gap is one the checker names
  show SLUG             its files, header, verdict, the acts that had nothing to read, repair cards and attempts, and how to test it

Read only. Repairing is the card tool (`card repair SLUG`) and the playbook CART-REPAIR; testing on the mock shop is CART-TEST.
"""
from __future__ import annotations

import json
import re
import time
from pathlib import Path

CURATOR = Path.home() / "code" / "curator"
ROOT = CURATOR / "carts" / "automations"
RUNS = CURATOR / "scratch" / "honest-count" / "runs-all-strict1.json"
WORK = Path.home() / "lacuna-world" / "work"
GOOD = ("strict:works", "strict:works-model")
# the verdicts nearest a pass first: a repair card exists for exactly these (card repair)
EASY = ("strict:no-table", "strict:table-misaligned", "strict:no-one-liner", "strict:no-artifact", "strict:not-done", "strict:empty-context")
_c: dict = {"t": 0.0, "runs": {}}


def _runs() -> dict:
    try:
        m = RUNS.stat().st_mtime
        if m != _c["t"]:
            _c.update(t=m, runs=json.loads(RUNS.read_text()))
    except (OSError, ValueError):
        pass
    return _c["runs"]


def _cls(slug: str) -> str:
    return ((_runs().get(slug) or {}).get("verdict") or {}).get("cls") or "unjudged"


def _slugs() -> list[str]:
    try:
        return sorted(p.name for p in ROOT.iterdir() if p.is_dir())
    except OSError:
        return []


def _header(slug: str, n: int = 6) -> str:
    p = ROOT / slug / f"{slug}.sks"
    try:
        lines = [ln.strip() for ln in p.read_text(errors="replace").splitlines()[:40] if ln.strip().startswith(";;")]
    except OSError:
        return ""
    return " ".join(ln.lstrip("; ").strip() for ln in lines[:n])[:260]


def _card(slug: str) -> dict | None:
    import hashlib
    short = (f"repair-{slug}" if len(f"repair-{slug}") <= 40 else f"repair-{slug}"[:33].rstrip("-") + "-" + hashlib.sha1(slug.encode()).hexdigest()[:6])
    for name in (short, f"repair-{slug[:50]}", f"repair-{slug}"):
        c = WORK / name / "CARD.md"
        if c.exists():
            t = c.read_text(errors="replace")
            m = re.search(r"steps_taken: (\d+)", t)
            plan = re.findall(r"^- \[( |x)\]", t, re.M)
            return {"card": name, "steps": int(m.group(1)) if m else 0, "plan_done": f"{plan.count('x')}/{len(plan)}"}
    return None


def summary() -> dict:
    by: dict[str, int] = {}
    for s in _slugs():
        by[_cls(s)] = by.get(_cls(s), 0) + 1
    cards = sorted(p.parent.name for p in WORK.glob("repair-*/CARD.md"))
    return {"ok": True, "carts": sum(by.values()), "working": sum(by.get(g, 0) for g in GOOD),
            "by_verdict": dict(sorted(by.items(), key=lambda kv: -kv[1])), "repair_cards": cards,
            "strict_run": time.strftime("%Y-%m-%d %H:%M", time.localtime(_c["t"])) if _c["t"] else None,
            "next": "`carts failing strict:no-table 10` lists the nearest to a pass; `card repair <slug>` starts one (playbook CART-REPAIR)"}


def find(words: str, n: int = 20) -> dict:
    ws = [w for w in re.findall(r"[a-z0-9]{2,}", (words or "").lower())]
    if not ws:
        return {"ok": False, "why": "give me a word or two of a cart's name or what it does"}
    out = []
    for s in _slugs():
        hay = s.replace("-", " ")
        if all(w in hay for w in ws) or (len(ws) > 1 and all(w in hay + " " + _header(s, 3).lower() for w in ws)):
            out.append({"slug": s, "verdict": _cls(s), "file": str(ROOT / s / f"{s}.sks"), **({"repair_card": c["card"]} if (c := _card(s)) else {})})
            if len(out) >= n:
                break
    return {"ok": True, "found": out, "n": len(out), **({} if out else {"why": "no cart name holds all of those words; try fewer"})}


def _gaps(slug: str) -> int:
    """How many of the cart's acts had nothing to read in the mock (a fixture gap): a cart with any can never pass there, so it is not
    the one to start with (2026-10-19: the first repair picked one, and no edit could have made it pass)."""
    return sum(1 for a in (_runs().get(slug) or {}).get("acts") or [] if a.get("kind") in ("fixture-gap", "missing") or a.get("routed") == "empty")


def failing(verdict: str = "", n: int = 15) -> dict:
    want = verdict.strip()
    pool = [s for s in _slugs() if (_cls(s) == want if want else _cls(s) in EASY)]
    size = lambda s: (ROOT / s / f"{s}.sks").stat().st_size if (ROOT / s / f"{s}.sks").exists() else 10**9    # noqa: E731
    pool.sort(key=lambda s: (_gaps(s) > 0, EASY.index(_cls(s)) if _cls(s) in EASY else 9, size(s)))
    return {"ok": True, "verdict": want or "the near-pass verdicts", "total": len(pool),
            "carts": [{"slug": s, "verdict": _cls(s), "gaps": _gaps(s), "file": str(ROOT / s / f"{s}.sks"), **({"repair_card": c["card"]} if (c := _card(s)) else {})} for s in pool[: max(1, min(40, n))]],
            "note": "carts with no fixture gaps first (a gap means the mock has nothing for one of its reads, so it cannot pass there), then the nearest verdict, then the smallest"}


def show(slug: str) -> dict:
    slug = re.sub(r"[^a-z0-9-]", "", (slug or "").lower())
    p = ROOT / slug / f"{slug}.sks"
    if not p.exists():
        return {"ok": False, "why": f"no cart {slug!r}", "try": find(slug.replace("-", " "), 6).get("found")}
    run = _runs().get(slug) or {}
    gaps = sorted({f"{a.get('verb')} ({a.get('kind')})" for a in run.get("acts") or []
                   if a.get("kind") in ("fixture-gap", "missing", "refused", "error") or a.get("routed") == "empty"})
    v = run.get("verdict") or {}
    return {"ok": True, "slug": slug, "files": [str(p)] + [str(q) for q in (ROOT / slug).glob("*") if q != p][:4],
            "bytes": p.stat().st_size, "header": _header(slug, 10), "verdict": v.get("cls") or "unjudged",
            "verdict_detail": {k: v.get(k) for k in v if k != "cls"} or None, "reasons": run.get("reasons") or [],
            "acts_with_nothing_to_read": gaps[:12], "repair_card": _card(slug),
            "to_repair": f"card repair {slug}   (then read the card; playbook CART-REPAIR)",
            "to_test": "an edited cart: `box work check <task>` (strict verdict). On the mock shop: `box carts run dev <sbx-shop> " + slug + "` "
                       "(playbook CART-TEST) — then `box carts staged dev <sbx-shop>` to read what it proposed"}


def gaps(n: int = 12) -> dict:
    """Which reads the carts make that the mock shop cannot answer, most-blocking first, each with the route that backs it and the file
    to change (2026-10-19: "make the data it will need in the mock shop"). A cart with a gap cannot pass strict however it is edited, so
    this is the list of MOCK DATA to build: for each verb, make its backing route answer from realistic seed data on a dev branch."""
    count: dict[str, set] = {}
    for slug, run in _runs().items():
        for a in run.get("acts") or []:
            if a.get("kind") in ("fixture-gap", "missing") or a.get("routed") == "empty":
                count.setdefault(a.get("verb") or "?", set()).add(slug)
    try:
        backings = (CURATOR / "curator-web" / "src" / "scheme" / "runtime" / "verbBackings.js").read_text()
    except OSError:
        backings = ""
    api = CURATOR / "curator-api" / "curator_api" / "routes" / "verb_backings"
    out = []
    for verb, slugs in sorted(count.items(), key=lambda kv: -len(kv[1]))[: max(1, min(40, n))]:
        m = re.search(r"'" + re.escape(verb) + r"':\s*'([^']+)'", backings)
        route = m.group(1) if m else None
        handler = None
        if route:
            for f in sorted(api.glob("*.py")):
                try:
                    if route.split("/api/verbs/")[-1] in f.read_text(errors="replace") or route in f.read_text(errors="replace"):
                        handler = str(f)
                        break
                except OSError:
                    pass
        out.append({"verb": verb, "carts_blocked": len(slugs), "route": route, "handler_file": handler,
                    "example_carts": sorted(slugs)[:3]})
    return {"ok": True, "verbs_with_gaps": len(count), "top": out,
            "how": "playbook MOCK-DATA: pick the top verb, read its handler, give the mock realistic data on a branch (box work new …), run the carts it blocks"}
