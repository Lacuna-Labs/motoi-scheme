"""THE RELEASE RUN, LIVE (D24; the owner, 2026-10-19: "it by itself to be able to do a release with all of its context and
all of the buttons and all of the graphs"). The release cart's newest run as the Release card draws it.

  GET  /api/release/run      the seven steps (done · now · press · stopped · ahead), the judgments with their votes and
                             reasons, the lines the cart reported, the card it waits on, dry or real, how long
  POST /api/release/cart     {dry, mode, version, target} files the card to start the release cart (carts.start_named) —
                             the owner's press runs it; nothing runs before it
THE MODES (CARDS-2.0 §6.14, lane C11, 2026-10-24): cut (tag dev's head beta-VERSION, stage its build) · push (the battery,
then the promote) · skip-tests (the promote without the battery, recorded as one) · rollback (install the named kept
build). The mode and its one argument are checked here and written into the cart's two mode lines (`with_mode`); an
unknown mode is refused in one sentence. Each filing is a row in the world's ledger (ledger/releases.jsonl) saying what
it was; the run's outcome stays the foreman's record (law 6). GET /api/release/run lists the modes as `modes`.
Refuses: a mode it does not know, a cut without an x.y.z version, a roll back to a build that is not kept or is already
on her iPad, `skip_tests` on any mode but skip-tests. Invariants (§18): "an act from the desk is a press ticket or a
foreman route". Faults (§16): none.
"""
from __future__ import annotations

import json
import re
import time

from fastapi import APIRouter, Header
from pydantic import BaseModel

router = APIRouter()
STEPS = [("read", "read the tree"), ("judge", "judge the unsure"), ("tests", "narrow tests"), ("check-in", "check in to dev"),
         ("pass", "the workflow pass"), ("cut", "tag + stage"), ("promote-build", "promote + build"), ("install-ipad", "her iPad")]
MODES = ("cut", "push", "skip-tests", "rollback")
MODE_WORDS = {"cut": "cut {arg}: tag dev's head and stage its build", "push": "test, then push",
              "skip-tests": "skip tests and push: NO BATTERY", "rollback": "roll back her iPad to the kept build {arg}"}
MODE_LINE, ARG_LINE = "(define release-mode 'push)", '(define release-arg "")'
VERSION = re.compile(r"\d{1,4}\.\d{1,4}\.\d{1,4}")
BUILD_ID = re.compile(r"[\w.\-]{1,80}")
# the steps each mode walks (release.sks); a step outside its mode's path is not drawn
PATH = {"push": ("read", "judge", "tests", "check-in", "pass", "promote-build", "install-ipad"),
        "skip-tests": ("read", "judge", "tests", "check-in", "pass", "promote-build", "install-ipad"),
        "cut": ("read", "judge", "tests", "check-in", "cut"), "rollback": ("install-ipad",)}


def with_mode(program: str, mode: str, arg: str = "") -> str | None:
    """The cart's program with its two mode lines written; None when the cart has no mode lines and the mode is not push.
    Only a checked mode and a checked argument reach here (r_start): the argument matches VERSION or BUILD_ID."""
    if MODE_LINE not in program or ARG_LINE not in program:
        return program if mode == "push" else None
    return program.replace(MODE_LINE, f"(define release-mode '{mode})", 1).replace(ARG_LINE, f'(define release-arg "{arg}")', 1)


def _ledger_path():
    from .home_cards import world
    return world() / "ledger" / "releases.jsonl"


def ledger(n: int = 10) -> list[dict]:
    """The newest filings, newest first: what each key filed (mode, its argument, who, the card)."""
    try:
        rows = [json.loads(x) for x in _ledger_path().read_text().splitlines()[-n:] if x.strip()]
    except (OSError, ValueError):
        return []
    return rows[::-1]


def _record(row: dict) -> None:
    p = _ledger_path()
    p.parent.mkdir(parents=True, exist_ok=True)
    with p.open("a") as f:                       # append only: a row is never rewritten
        f.write(json.dumps(row) + "\n")


def _newest() -> dict | None:
    from . import foreman
    r = foreman.call("GET", "/workers", None, timeout=5)
    ws = r.get("workers") if isinstance(r, dict) else r
    mine = [w for w in (ws or []) if w.get("name") == "release"]
    if not mine:
        return None
    w = max(mine, key=lambda x: (x.get("state") == "running", x.get("started") or 0))
    d = foreman.call("GET", f"/workers/{w['id']}", None, timeout=5)
    return d.get("worker") or d


def run() -> dict:
    from . import chat
    w = _newest()
    waiting = [p for p in chat.petitions() if p.get("state") == "waiting" and p.get("action") in ("cart-step", "spawn-cart")
               and ((p.get("args") or {}).get("cart") == "release")]
    if not w:
        return {"hold": hold(), "state": "none", "modes": list(MODES), "mode": None, "ledger": ledger(),
                "steps": [{"key": k, "label": l, "state": "ahead"} for k, l in STEPS if k in PATH["push"]], "waiting": waiting}
    reps = w.get("reports") or []
    said = lambda kind: [str((x.get("data") or [""])[0]) for x in reps if x.get("kind") == kind]   # noqa: E731
    mode = (said("mode") or ["push"])[-1]
    skipped = set(said("skip"))
    started = [s.removeprefix("starting ") for s in said("step") if s.startswith("starting ")]
    now = started[-1] if started else None
    summary = (said("summary") or [None])[-1]
    stopped_at = summary.split(":")[0].removeprefix("stopped at ").strip() if summary and summary.startswith("stopped at") else None
    press = next((p for p in waiting if p.get("action") == "cart-step" and (p.get("args") or {}).get("worker") == w.get("id")), None)
    said_in: dict[str, list[str]] = {}         # what each step said, in the order the cart said it
    cur = None
    for x in reps:
        line = str((x.get("data") or [""])[0])
        if x.get("kind") == "step" and line.startswith("starting "):
            cur = line.removeprefix("starting ")
        elif cur and x.get("kind") in ("would", "press", "step", "sorted", "untested", "red"):
            said_in.setdefault(cur, []).append(line)
    steps = []
    for k, label in STEPS:
        if k not in PATH.get(mode, PATH["push"]):
            continue
        if k in skipped:
            st = "skipped"
        elif k == stopped_at:
            st = "stopped"
        elif k in started and k != now:
            st = "done"
        elif k == now:
            ended = w.get("state") != "running"
            st = ("press" if press and (press.get("args") or {}).get("op") == k
                  else "done" if summary and not stopped_at else "stopped" if ended else "now")
        else:
            st = "ahead"
        steps.append({"key": k, "label": label, "state": st, "said": said_in.get(k, [])[-3:]})
    judged = []
    for line in said("judged"):
        verdict, _, why = line.partition(" — ")
        keep = verdict.startswith("release ")
        judged.append({"path": verdict.removeprefix("release ").removeprefix("leave out "), "keep": keep, "why": why})
    return {"hold": hold(), "modes": list(MODES), "mode": mode, "ledger": ledger(), "state": w.get("state"), "id": w.get("id"), "by": w.get("by"), "started": w.get("started"),
            "dry": any(x.get("kind") == "would" for x in reps) or "dry" in str(w.get("by") or ""), "now": now,
            "summary": summary or (None if w.get("state") == "running" else f"stopped at {now or 'the start'}"),
            "steps": steps,
            "sorted": (said("sorted") or [None])[-1], "judged": judged, "reds": said("red"),
            "lines": [f"{x.get('kind')} · {str((x.get('data') or [''])[0])[:200]}" for x in reps[-20:]],
            "press": {"id": press["id"], "op": (press.get("args") or {}).get("op"), "words": (press.get("args") or {}).get("words")} if press else None,
            "waiting": [{"id": p["id"], "action": p["action"]} for p in waiting], "at": time.time(),
            # a promote/release job past its usual time (stuck.py): the card says so and offers the unstick
            "stuck": _stuck_jobs()}


def _stuck_jobs() -> list[dict]:
    try:
        from . import stuck
        return [{**r, "said": stuck.words(r)} for r in stuck.stuck() if r["overdue"] and r["kind"] in ("promote", "release", "build", "pass")]
    except Exception:  # noqa: BLE001
        return []


@router.get("/api/release/run")
def r_run() -> dict:
    return run()


class Start(BaseModel):
    dry: bool = False
    mode: str = "push"
    version: str = ""
    target: str = ""
    skip_tests: bool = False


def _hold_file():
    from .core import LACUNA_HOME
    from pathlib import Path
    return Path(LACUNA_HOME) / "release-hold.json"


def hold() -> dict | None:
    """B13: a hold on the release — while it stands, a real release does not start (a dry run still may)."""
    import json
    try:
        return json.loads(_hold_file().read_text())
    except (OSError, ValueError):
        return None


class Hold(BaseModel):
    on: bool = True
    why: str = ""


@router.post("/api/release/hold")
def r_hold(body: Hold, x_lacuna_who: str | None = Header(None)) -> dict:
    import json
    from .core import audit
    who = x_lacuna_who or "alfred"
    audit(who, "release.hold", on=body.on, why=body.why[:200])
    if body.on:
        _hold_file().write_text(json.dumps({"by": who, "why": body.why[:200] or "held from the Release card", "t": time.time()}))
        return {"ok": True, "said": "the release is held: a real release will not start until the hold is lifted"}
    _hold_file().unlink(missing_ok=True)
    return {"ok": True, "said": "the hold is lifted"}


@router.get("/api/release/hold")
def r_hold_get() -> dict:
    return {"hold": hold()}


def _checked(body: Start) -> tuple[str, str | None]:
    """(the mode's one argument, or None) and why not — every refusal is one sentence."""
    mode = body.mode
    if mode not in MODES:
        return "", f"the release cart has no mode {mode[:40]!r}: it takes cut, push, skip-tests or rollback"
    if body.skip_tests and mode != "skip-tests":
        return "", "skip_tests belongs to the skip-tests mode only: press skip tests and push"
    if mode == "cut":
        return (body.version, None) if VERSION.fullmatch(body.version or "") else ("", f"a cut names its version as x.y.z, not {body.version[:40]!r}")
    if mode == "rollback":
        from . import deploys
        from .release_board import board
        kept = {b["id"]: b for b in deploys.builds() if b.get("ok")}
        if not BUILD_ID.fullmatch(body.target or "") or body.target not in kept:
            return "", f"a roll back names a kept build, and {body.target[:80]!r} is not one"
        on = (board().get("ipad") or {}).get("id")
        if on == body.target:
            return "", f"her iPad already runs {body.target}: there is nothing to roll back to"
        return body.target, None
    return "", None


@router.post("/api/release/cart")
def r_start(body: Start, x_lacuna_who: str | None = Header(None)) -> dict:
    from . import carts
    from .core import audit
    who = x_lacuna_who or "alfred"
    arg, why = _checked(body)
    if why:
        return {"ok": False, "why": why, "mode": body.mode}
    words = MODE_WORDS[body.mode].format(arg=arg)
    r = carts.start_named("release", who, body.dry, f"{'a dry run of ' if body.dry else ''}the release cart · {words}, from the Build card",
                          mode=body.mode, arg=arg)
    if r.get("petition") and r.get("filed"):        # a new card (an old one re-offered is already in the ledger)
        row = {"t": time.time(), "mode": body.mode, "words": words, "dry": body.dry, "who": who, "petition": r["petition"],
               "skip_tests": body.mode == "skip-tests", **({"version": arg} if body.mode == "cut" else {}),
               **({"target": arg} if body.mode == "rollback" else {})}
        _record(row)
        audit(who, "release.file", mode=body.mode, arg=arg, dry=body.dry, petition=r["petition"])
    return {**r, "mode": body.mode}
