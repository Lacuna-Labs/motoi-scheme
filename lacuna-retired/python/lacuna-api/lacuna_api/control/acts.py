"""ACTS — a cart's hands that change things (CARTS-ARE-THE-WORK §2.4; the owner, 2026-10-18: "a script becomes a hand").

A read is `hand` (hands.py, any cart). An act is `act`, and three locks hold it:
  1. the cart's header names the act: (acts . (pass promote-build install-ipad)) — the foreman refuses any other;
  2. the run was started by the owner's press (carts.spawn → grant): a run Lacuna started by itself holds no act;
  3. QA and her iPad are behind (2) every time: no grant outlives its run.
A run may be DRY (the run's args `dry`): every act answers what it WOULD do and touches nothing — the exam's way, and
the way to try a new cart.

Each act starts a job (core.start_job, the same jobs the console shows) and answers its id at once; the cart follows it
with the read `(hand 'job ID)` until it ends. One release-kind job at a time, as before.

  grant(worker, who, header, dry)   kept in ~/.lacuna/cart-grants.json, dropped when the cart retires
  do(worker, op, args)              → {ok, job | would | why}
"""
from __future__ import annotations

import json
import time
from pathlib import Path

from .core import LACUNA_HOME, audit, start_job

GRANTS = LACUNA_HOME / "cart-grants.json"
REPO = Path.home() / "code" / "curator"
TOOLBOX = Path(__file__).resolve().parents[3] / "toolbox"
OWNER = ("owner-key", "alfred")


def _load() -> dict:
    try:
        return json.loads(GRANTS.read_text())
    except (OSError, ValueError):
        return {}


def _save(g: dict) -> None:
    GRANTS.parent.mkdir(parents=True, exist_ok=True)
    GRANTS.write_text(json.dumps(g, indent=1))


def grant(worker: str, who: str, header: dict, dry: bool) -> None:
    if not worker:
        return
    g = _load()
    g[worker] = {"who": who, "acts": list(header.get("acts") or []), "dry": bool(dry), "cart": header.get("name"), "at": time.time()}
    _save(g)


def drop(worker: str) -> None:
    g = _load()
    if g.pop(str(worker), None) is not None:
        _save(g)


def _newest_build() -> str | None:
    from . import deploys
    b = deploys.builds()
    return b[0].get("dir") or b[0].get("path") if b else None


def _busy() -> str | None:
    from .core import jobs
    for j in jobs(20):
        if j.get("running") and j.get("kind") in ("release", "promote", "deploy", "build", "pass"):
            return f"a {j['kind']} job is already running ({j['title']})"
    return None


# op → (what it does in words, the command); the words are what a dry run answers
def _plan(op: str, args: list) -> tuple[str, list] | None:
    if op == "pass":
        return "runs the workflow pass on the simulator (tools/workflow/pass.sh)", ["/bin/bash", str(REPO / "tools" / "workflow" / "pass.sh")]
    if op == "promote-build":
        return "promotes dev → QA and builds for the iPad (toolbox/promote.sh --build)", ["/bin/bash", str(TOOLBOX / "promote.sh"), "--build"]
    if op == "narrow-tests":                 # never the cart's words in a shell: the list is recomputed here
        from . import release_steps
        return release_steps.narrow_cmd(release_steps.sort()["unit_tests"])
    if op == "install-ipad":
        d = _kept_dir(args[0]) if args and args[0] else _newest_build()
        return (f"installs the build {d} on her iPad (toolbox/install-ipad.sh)", ["/bin/bash", str(TOOLBOX / "install-ipad.sh"), str(d)]) if d else None
    if op == "cut":                          # the release cart's cut (lane C11): tag dev's head beta-VERSION, stage its build
        from .release_run import VERSION
        from . import deploys
        v = args[0] if args else ""
        if not VERSION.fullmatch(v or ""):
            return None
        out = deploys.BUILDS / f"{time.strftime('%Y%m%d-%H%M%S')}-beta-{v}"
        return (f"tags dev's head beta-{v} and stages its build at {out.name} (toolbox/cut.sh)", ["/bin/bash", str(TOOLBOX / "cut.sh"), v, str(out)])
    return None


def _kept_dir(name: str) -> str | None:
    """A kept build named by its id (the roll back names one) → its folder; anything else (a path, a build not kept) → None."""
    from . import deploys
    return str(deploys.BUILDS / name) if any(b.get("id") == name and b.get("ok") for b in deploys.builds()) else None


KIND = {"pass": "pass", "promote-build": "promote", "install-ipad": "deploy", "narrow-tests": "tests", "cut": "build"}


NOTHING = {"narrow-tests": "no unit test names the changed code", "install-ipad": "no kept build to install by that name",
           "cut": "a cut names its version as x.y.z"}


def _check_in_args(args: list) -> dict | None:
    """(act 'check-in MESSAGE PATH …) — only paths the sorter sees changed right now; never a secret, never scratch"""
    from . import release_steps
    flat = []
    for a in args:                           # (act 'check-in "msg" paths) sends the path list as one argument
        flat.extend(a if isinstance(a, list) else [a])
    args = flat
    if len(args) < 2:
        return None
    kinds = {p: release_steps.kind_of(p) for _, p in release_steps.changed()}
    paths = [str(p) for p in args[1:] if kinds.get(str(p)) not in (None, "secret", "scratch")]
    return {"message": str(args[0]), "paths": paths} if paths else None


def _press(worker: str, g: dict, op: str, args: list, words: str) -> dict:
    """A step on the customer's side (or a commit) waits for the owner's press EACH TIME — the run's own press is not enough."""
    from . import chat
    r = chat.file_petition("cart-step", None, f"the cart {g['cart']} reached {op}", f"cart:{g['cart']}",
                           args={"worker": worker, "op": op, "args": args, "cart": g["cart"], "words": words})
    return {"ok": True, "waiting": r.get("petition"), "said": f"{op} waits for the owner's press (card {r.get('petition')})"}


def pressed(a: dict, approve: bool, who: str) -> dict:
    """The owner answered a cart-step card: the act runs now, or the cart hears no — as its `act` event either way."""
    from . import foreman
    out = run_now(str(a.get("worker")), str(a.get("op")), list(a.get("args") or []), who) if approve else \
        {"ok": False, "why": f"the owner declined {a.get('op')}"}
    foreman.call("POST", f"/workers/{a.get('worker')}/event", {"kind": "act", "value": {"op": a.get("op"), **out}}, timeout=30)
    return out


def do(worker: str, op: str, args: list | None = None) -> dict:
    g = _load().get(str(worker))
    if not g:
        return {"ok": False, "why": "this run was not started by the owner's press: it holds no act"}
    if op not in g["acts"]:
        return {"ok": False, "why": f"the cart's header does not name the act {op}"}
    if op == "clean-listed":                 # the owner's own list (diskguard): his press on this run is the confirmation
        from . import diskguard
        if g["dry"]:
            p = diskguard.plan()
            return {"ok": True, "dry": True, "would": f"would clear {len(p['files'])} file(s), {p['total_gb']} GB, all on the owner's list"}
        audit(f"cart:{g['cart']}", "act", op=op, approved_by=g["who"])
        return {"ok": True, **diskguard.clean(True)}
    if op in ("forge-pairs", "forge-train", "forge-eval", "forge-propose"):
        # THE FORGE FROM A CART (the owner, 2026-10-19: "it mentioned needed verbs for 4-7, make those verbs"): the act files
        # the Forge's own card (forge_verbs.petition) — the work order answers pairs/train/eval; propose waits for the owner
        from . import forge_verbs
        spec = str((args or ["sentry"])[0])
        if g["dry"]:
            return {"ok": True, "dry": True, "would": f"would file {op} for {spec}"}
        audit(f"cart:{g['cart']}", "act", op=op, specialist=spec, approved_by=g["who"])
        return forge_verbs.petition(op, spec, f"cart:{g['cart']}", f"the {g['cart']} cart, step {op}")
    from . import release_steps
    if op == "check-in":
        ci = _check_in_args(list(args or [])[:80])
        if not ci:
            return {"ok": False, "why": "a check-in names a message and changed paths that are not scratch or secrets"}
        if g["dry"]:
            return {"ok": True, "dry": True, "would": f"would commit {len(ci['paths'])} path(s) to dev: {ci['message'][:72]}"}
        return _press(worker, g, op, [ci["message"], *ci["paths"]], f"commits {len(ci['paths'])} path(s) to dev — {ci['message'][:72]}")
    plan = _plan(op, [str(a) for a in (args or [])][:2])
    if not plan and op == "install-ipad" and g["dry"]:
        return {"ok": True, "dry": True, "would": "installs the build promote-build makes on her iPad (toolbox/install-ipad.sh)"}
    if not plan:
        return {"ok": False, "why": NOTHING.get(op, f"no act {op}")}
    words, cmd = plan
    if g["dry"]:
        audit(f"cart:{g['cart']}", "act.dry", op=op)
        return {"ok": True, "dry": True, "would": words}
    if op in release_steps.PRESSED:
        return _press(worker, g, op, [str(a) for a in (args or [])][:2], words)
    return run_now(worker, op, args or [], g["who"])


def run_now(worker: str, op: str, args: list, who: str) -> dict:
    g = _load().get(str(worker))
    if not g:
        return {"ok": False, "why": "the run has ended: it holds no act"}
    if op == "check-in":
        from . import checkin
        ci = _check_in_args(list(args))
        return checkin.commit(ci, who) if ci else {"ok": False, "why": "the paths changed since the card was filed"}
    plan = _plan(op, [str(a) for a in args][:2])
    if not plan:
        return {"ok": False, "why": NOTHING.get(op, f"no act {op}")}
    words, cmd = plan
    busy = _busy()
    if busy:
        return {"ok": False, "why": busy}
    audit(f"cart:{g['cart']}", "act", op=op, approved_by=who)
    j = start_job(KIND[op], f"{g['cart']}: {words}", cmd, f"cart:{g['cart']} (pressed by {who})", cwd=REPO)
    return {"ok": True, "job": j.to_dict().get("id"), "said": words}


def run_escalated(worker: str, cart: str, op: str, args: list, who: str, ticket: str = "") -> dict:
    """THE ESCALATED DOOR (3.0 §11, P3): an act that leaves the run's checkout, sent by lacuna-executor AFTER the foreman confirmed the
    owner's press on its ticket. The foreman is the authority on what the cart's header holds: a worker it spawned itself has no
    grant row here yet, so one is written from the act it names, then `run_now` runs it as a job. Python until P7."""
    g = _load()
    if str(worker) not in g:
        grant(str(worker), who, {"name": str(cart or worker), "acts": [op], "touches": []}, dry=False)
    out = run_now(str(worker), op, list(args or []), who)
    out["ticket"] = ticket
    return out

