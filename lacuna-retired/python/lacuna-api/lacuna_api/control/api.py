"""The control plane's routes — everything on :1138. HTTP under /api, live streams under /ws, the page at /.

Who acted is carried by the `X-Lacuna-Who` header (alfred · claude); the console sends `alfred`, the CLI whoever runs
it. Acts on HER things (QA, her iPad) need `confirm: true` — the console's confirm dialog, pressed by a person.
"""
from __future__ import annotations

import asyncio
import json
import time
import re
import urllib.request
from typing import Optional

from fastapi import APIRouter, Header, HTTPException, Request, WebSocket, WebSocketDisconnect
from pydantic import BaseModel

from . import core, battery, boot, chat, deploys, docs, drill, errors, health, mentat, minds_roles, modelwatch, owner, services, telemetry, terminal, upkeep, workers

router = APIRouter()
router.include_router(__import__(f"{__package__}.agents_live", fromlist=["router"]).router)  # /api/agents/working — who works now, honestly (agents_live.py)
router.include_router(mentat.router)     # /api/mentat/* — the cart ranker, observed (control/mentat.py)
router.include_router(__import__(f"{__package__}.desk_seen", fromlist=["router"]).router)  # /api/desk/seen — notices land on the open desk first
router.include_router(__import__(f"{__package__}.automations", fromlist=["router"]).router)  # /api/automations — every cart live (automations.py)
router.include_router(__import__(f"{__package__}.cortex_view", fromlist=["router"]).router)  # /api/cortex/* — the Cortex card (cortex_view.py)
router.include_router(__import__(f"{__package__}.factory", fromlist=["router"]).router)  # /api/factory/* — the Factory's parts
router.include_router(__import__(f"{__package__}.security_view", fromlist=["router"]).router)  # /api/security* — the report and the sentinel's life
router.include_router(__import__(f"{__package__}.caliper_run", fromlist=["router"]).router)  # /api/caliper/run — the run key (a card)
router.include_router(__import__(f"{__package__}.claude_chat", fromlist=["router"]).router)  # /api/claude/* — Claude's chat (owner only)
router.include_router(__import__(f"{__package__}.rooms", fromlist=["router"]).router)  # /api/rooms/* — rooms as accounts inside a card
router.include_router(__import__(f"{__package__}.audio_view", fromlist=["router"]).router)  # /api/audio/* — podcasts and radio (dev API catalogs)
router.include_router(__import__(f"{__package__}.artifacts", fromlist=["router"]).router)  # /api/carts/{name}/artifact — a cart's newest artifact (B9)
router.include_router(__import__(f"{__package__}.exam_attempt", fromlist=["router"]).router)  # /api/exam/{item}/attempt — a failed item's attempt (B6)
router.include_router(__import__(f"{__package__}.cicd_cls", fromlist=["router"]).router)  # /api/cicd/cls — the gap as change lists (B10)
router.include_router(__import__(f"{__package__}.sakura_brain", fromlist=["router"]).router)  # /api/sakura/brain — Sakura's brain switch
router.include_router(__import__(f"{__package__}.proof", fromlist=["router"]).router)  # /api/proof — the Lacuna proof (W35.1)
router.include_router(__import__(f"{__package__}.release_run", fromlist=["router"]).router)  # /api/release/run — the release cart, live (D24)
router.include_router(__import__(f"{__package__}.cloud", fromlist=["router"]).router)  # /api/cloud — the cloud seat (status, budget, ledger)
router.include_router(__import__(f"{__package__}.plans", fromlist=["router"]).router)  # /api/plans — the cloud's plans, live
router.include_router(__import__(f"{__package__}.wake", fromlist=["router"]).router)
router.include_router(owner.router)      # /api/owner/* — pairing a device for the owner's press (control/owner.py)
router.include_router(minds_roles.router)  # /api/minds/roles — trained minds in service, versions, history (minds_roles.py)
router.include_router(__import__(f"{__package__}.sysmap", fromlist=["router"]).router)  # /api/map/* — the MAP's feed (sysmap.py)


def _who(h: Optional[str]) -> str:
    return (h or "alfred").strip().lower()[:24] or "alfred"


def _owner_press(pid: str, sig: Optional[str], t: Optional[str], device: Optional[str], card: str) -> str:
    """THE CUSTOMER'S SIDE IS THE OWNER'S PRESS (2026-10-19: promote ran on any POST; install and release took a bare
    confirm=true from any caller). A direct call must carry the owner key's signature over `pid` (the CLI signs at his
    terminal, bin/lacuna_owner.py) — anything else is refused and told which card to file instead."""
    from . import owner
    by, why = owner.check(pid, True, {"sig": sig, "t": t, "device": device})
    if not by:
        raise HTTPException(403, {"why": f"{why} — or file the {card} card: only the owner's press runs it", "petition": card})
    return by


class Act(BaseModel):
    confirm: bool = False


class Release(BaseModel):
    confirm: bool = False
    skip_pass: bool = False


class Build(BaseModel):
    ref: str


class Ask(BaseModel):
    text: str
    session: str = "console"
    model: Optional[str] = None
    card: Optional[str] = None         # the open card's id (s-telemetry …): its lean lane (chat.card_lane)
    context: Optional[str] = None      # where the owner stands on the desk (the card, the room, the message he came from)
    thinking_level: Optional[str] = None


class Decide(BaseModel):
    approve: bool


def _svc(name: str):
    if name not in services.SERVICES:
        raise HTTPException(404, f"no service named {name}")


@router.get("/api/self")
def self_check():
    """Lacuna's own health: the worker heartbeat, its database, its logs, launchd."""
    workers.ensure()
    age = time.time() - upkeep.beat["t"] if upkeep.beat["t"] else None
    db = core.LACUNA_HOME / "errors.db"
    ld = services._launchd("ai.lacunalabs.lacuna")
    return {"ok": age is not None and age < 30, "heartbeat_age_s": round(age, 1) if age is not None else None,
            "passes": upkeep.beat["passes"], "db_mb": round(db.stat().st_size / 1e6, 1) if db.exists() else 0,
            "launchd": ld, "logs": upkeep.sizes(), "model": modelwatch.state()}


@router.post("/api/logs/rotate")
def logs_rotate(x_lacuna_who: Optional[str] = Header(None)):
    return {"rotated": upkeep.rotate_all(_who(x_lacuna_who)), "sizes": upkeep.sizes()}


@router.get("/api/overview")
def overview():
    workers.ensure()
    return {"t": time.time(), "services": services.all_status(), "disk": health.disk(), "memory": health.memory(),
            "alerts": workers.alerts(20), "errors": errors.summary(24), "drift": workers.drift_now(), "petitions": [p for p in chat.petitions() if p["state"] == "waiting"],
            "jobs": core.jobs(8)}


@router.get("/api/services")
def svc_list():
    return services.all_status()


@router.post("/api/services/{name}/{action}")
def svc_act(name: str, action: str, body: Act = Act(), x_lacuna_who: Optional[str] = Header(None)):
    _svc(name)
    fn = {"start": services.start, "stop": services.stop, "restart": services.restart, "supervise": services.supervise}.get(action)
    if not fn:
        raise HTTPException(404, f"no action {action}")
    # THE CUSTOMER'S SIDE IS NEVER ONE TAP AWAY (2026-10-19: the rack sent confirm=true by itself, so one press stopped
    # her server): it starts, stops and restarts only through its card (qa-start · qa-stop · qa-restart), the owner's press
    if services.SERVICES[name].get("hers") and action != "supervise":
        raise HTTPException(403, {"why": f"{name} is the customer's server: file the qa-{action} card — only the owner's press runs it",
                                  "petition": f"qa-{action}"})
    try:
        return fn(name, _who(x_lacuna_who), confirm=body.confirm)
    except services.NeedsConfirm as e:
        raise HTTPException(409, {"needs_confirm": True, "why": str(e)})
    except PermissionError as e:
        raise HTTPException(403, str(e))


@router.get("/api/services/{name}/explain")
def svc_explain(name: str):
    _svc(name)
    return services.explain(name)


@router.get("/api/services/{name}/log")
def svc_log(name: str, lines: int = 200):
    _svc(name)
    return {"name": name, "text": services.tail(name, lines)}


@router.get("/api/health")
def health_all():
    return health.snapshot()


@router.get("/api/disk/eaters")
def disk_eaters(refresh: bool = False):
    return health.eaters(refresh)


@router.post("/api/tell")
def tell_route(body: dict):
    """Say what you expect: the desk reads it into a plan and starts the worker (LACUNA-1.3 §18)."""
    from . import tell
    who = (body or {}).get("who") or "alfred"
    out = tell.tell(str((body or {}).get("words") or ""), who=who, start=bool((body or {}).get("start", True)))
    core.audit(who, "tell", words=str((body or {}).get("words") or "")[:300], ok=out.get("ok"), id=out.get("id"))
    return out


@router.get("/api/result/{wid}")
def result_route(wid: str):
    from . import tell
    return tell.result(wid)


@router.get("/api/limits")
def limits_route():
    from . import tell
    return tell.limits()


# THE DESK'S FOREMAN ROUTES MOVED TO THE DOOR (2026-11-06, lane python-out-1): GET /api/foreman, /tree, the reads (runs · agents ·
# coast · sentry · mail · net · broker · box), /contracts/<run>, POST /cards/<card>/<verb>, the workers' thoughts · talk · interrupt are
# lacuna-node/frontend/foreman-desk.mjs. agent_talk.py stays: the chat, the swarm and the desk's nav still call its functions.


@router.post("/api/foreman/event")
def foreman_event(msg: dict, x_lacuna_who: Optional[str] = Header(None)):
    """What a foreman sends UP: reports, crashes, graves, need-brain, ask."""
    from . import foreman
    if not _who(x_lacuna_who).startswith("foreman:"):
        raise HTTPException(403, "only a foreman reports here")
    r = foreman.receive(msg)
    if r.get("dropped"):
        raise HTTPException(401, f"dropped ({r['dropped']}): {r['why']}")   # the foreman keeps it queued and re-seals it
    return r


@router.post("/api/foreman/propose")
def foreman_propose(body: dict, x_lacuna_who: Optional[str] = Header(None)):
    """Propose a worker: a permission card shows its program; only the person's yes loads it."""
    from . import foreman
    if not str(body.get("program") or "").strip():
        raise HTTPException(422, "a worker needs a program")
    return foreman.propose(str(body.get("name") or "worker")[:60], str(body["program"]), str(body.get("why") or ""),
                           "act" if body.get("tier") == "act" else "watch", _who(x_lacuna_who))


@router.post("/api/foreman/act-now")
def foreman_act_now(body: dict, x_foreman_token: Optional[str] = Header(None)):
    """lacuna-executor' escalated door (3.0 §11, P3): an act outside the checkout, after the foreman confirmed the owner's press.
    Only with the foreman's token; the act runs as a job and the job id is the answer. Python until P7."""
    from . import foreman, acts
    tok = foreman._token()
    if not tok or x_foreman_token != tok:
        raise HTTPException(401, "only the hands bring an escalated act here")
    op = str(body.get("op") or "")
    if not op:
        raise HTTPException(422, "an act names its op")
    return acts.run_escalated(str(body.get("worker") or ""), str(body.get("cart") or ""), op, list(body.get("args") or []),
                              str(body.get("who") or "owner")[:40], str(body.get("ticket") or ""))


@router.post("/api/foreman/mind")
def foreman_mind(body: dict, x_foreman_token: Optional[str] = Header(None)):
    """A foreman's small-mind question (the foreman talks only to Lacuna): only with its token, only a box-allowed model."""
    from . import foreman
    tok = foreman._token()
    if not tok or x_foreman_token != tok:
        raise HTTPException(401, "only a foreman asks a small mind here")
    return foreman.mind(body)


@router.post("/api/foreman/cascade")
def foreman_cascade(body: dict, x_foreman_token: Optional[str] = Header(None)):
    """A cascade's record from a foreman (B50): an escalation, or a shadow row; kept under ~/lacuna-world/cascade."""
    from . import cascade, foreman
    tok = foreman._token()
    if not tok or x_foreman_token != tok:
        raise HTTPException(401, "only a foreman keeps cascade records here")
    r = cascade.keep(str(body.get("kind") or ""), body.get("record"))
    if not r.get("ok"):
        raise HTTPException(422, r["why"])
    return r


# ── THE EXAM (§37.1): ten burndown items handed to the carts ─────────────────────────────────────────────────────────
@router.get("/api/exam")
def exam_status():
    from . import home_cards
    return home_cards.exam()


@router.post("/api/exam/{item}/start")
def exam_start(item: str, x_lacuna_who: Optional[str] = Header(None)):
    """Its cart is tried, then put on a permission card: it runs on the owner's yes."""
    from . import carts
    who = _who(x_lacuna_who)
    core.audit(who, "exam.start", item=item)
    return carts.start(item, who)


@router.post("/api/exam/{item}/stop")
def exam_stop(item: str, x_lacuna_who: Optional[str] = Header(None)):
    from . import carts
    who = _who(x_lacuna_who)
    core.audit(who, "exam.stop", item=item)
    return carts.stop(item, who)


# ── THE FORGE (§41): Lacuna trains its own small minds; every start is a permission card ───────────────────────────────
@router.get("/api/forge")
def forge_status():
    from . import forge
    return forge.summary()


@router.post("/api/forge/{verb}")
def forge_verb(verb: str, body: dict, x_lacuna_who: Optional[str] = Header(None)):
    """forge-pairs · forge-train · forge-eval · forge-propose → a permission card; the yes runs it (forge_verbs.decided)."""
    from . import forge_verbs
    who = _who(x_lacuna_who)
    core.audit(who, f"forge.{verb}", specialist=body.get("specialist"))
    return forge_verbs.petition(verb, body.get("specialist"), who, str(body.get("reason") or ""))


@router.post("/api/foreman/workers/{wid}/event")
def foreman_send(wid: str, body: dict):
    from . import foreman
    return foreman.call("POST", f"/workers/{wid}/event", {"kind": body.get("kind"), "value": body.get("value")})


@router.delete("/api/foreman/workers/{wid}")
def foreman_stop(wid: str, x_lacuna_who: Optional[str] = Header(None)):
    from . import foreman
    core.audit(_who(x_lacuna_who), "foreman.stop", worker=wid)
    return foreman.stop(wid)


@router.get("/api/home")
def home_snapshot():
    """Lacuna's home: one read of the box for its standing cards."""
    from . import home
    return home.snapshot()


@router.get("/api/home/series")
def home_series(names: str = "disk_free_gb,mem_available_gb", hours: float = 6):
    from . import home
    return home.series([n for n in names.split(",") if n][:12], hours)


@router.get("/api/home/map")
def home_map():
    """The desk map for Lacuna: apps → rooms → actions (what each does, owner-only or not), the connectors, the nav ops."""
    from . import home
    return home.desk_map()


@router.post("/api/home/scenario")
def home_scenario(sc: dict):
    """Lacuna's desk move as its Caliper hand played it, kept as a replayable scenario (artifacts/desk/<date>)."""
    from . import home
    return home.keep_scenario(sc)


@router.post("/api/owner/pair-phrase")
def owner_pair_phrase(x_lacuna_owner: Optional[str] = Header(None), x_lacuna_owner_t: Optional[str] = Header(None),
                      x_lacuna_device: Optional[str] = Header(None)):
    """A paired device makes the six words for pairing another (owner.mint_phrase): signed, or refused."""
    from fastapi.responses import JSONResponse
    from . import owner
    r = owner.mint_phrase({"sig": x_lacuna_owner, "t": x_lacuna_owner_t, "device": x_lacuna_device})
    return r if r.get("ok") else JSONResponse(r, status_code=403)


@router.get("/api/release/board")
def release_board_route():
    """dev · QA · iPad as they are now, and the release cards pending (release_board.py)."""
    from . import release_board
    return release_board.board()


@router.get("/api/devices")
def devices_list():
    """Every running thing in one rack: services, launchd jobs, Loam (devices.py)."""
    from . import devices
    return devices.devices()


@router.get("/api/devices/agent/{label}/log")
def devices_agent_log(label: str, lines: int = 40):
    from . import devices
    return devices.agent_log(label, lines)


@router.post("/api/devices/agent/{label}/kick")
def devices_kick(label: str, x_lacuna_who: Optional[str] = Header(None)):
    from . import devices
    who = _who(x_lacuna_who)
    if who in ("lacuna", "home-lacuna"):
        raise HTTPException(403, "only a person kicks from the rack")
    return devices.kick(label, who)


@router.get("/api/eye")
def eye_list(watch: bool = False):
    """Caliper's eyes: what each watches, its frame's age, SigLIP's verdict (eye.py); watch=1 keeps them awake."""
    from . import eye
    return eye.eyes(watch)


@router.post("/api/web/open")
def web_open_route(body: dict, x_lacuna_who: Optional[str] = Header(None)):
    """The Web card: open an address in the desk's own browser tab (eye.web_open)."""
    from . import eye
    return eye.web_open(str((body or {}).get("url") or ""), _who(x_lacuna_who))


@router.post("/api/eye/start")
def eye_start():
    from . import eye
    return eye.start()


@router.get("/api/eye/frame/{eid}")
def eye_frame(eid: str):
    from fastapi.responses import FileResponse
    from . import eye
    f = eye.frame(eid)
    if not f:
        raise HTTPException(404, "no frame yet")
    return FileResponse(str(f), media_type="image/jpeg", headers={"Cache-Control": "no-store"})


@router.post("/api/eye/{eid}/steer")
def eye_steer(eid: str, body: dict, x_lacuna_who: Optional[str] = Header(None)):
    from . import eye
    return eye.steer(eid, str(body.get("do") or ""), str(body.get("arg") or ""), _who(x_lacuna_who))


@router.get("/api/broker")
def broker_state():
    """WHO IS AT THE DESK, truthfully (2026-10-22): the resident brain, the small minds, free memory, the desk's intent and
    whether reality matches it. The debug/watchdog read."""
    from . import broker
    return broker.state()


@router.post("/api/broker")
def broker_set(body: dict, x_lacuna_who: Optional[str] = Header(None)):
    """The owner's desk: {mode: auto|lock, model} records the intent; {switch: true, model} performs the swap now."""
    from . import broker
    who = _who(x_lacuna_who)
    if body.get("switch") and body.get("model"):
        return broker.switch_to(str(body["model"]), who)
    return broker.set_desk(str(body.get("mode") or "auto"), str(body.get("model") or "auto"), who)


@router.get("/api/ai")
def ai_state():
    """The box's memory as the AI sees it, and every model with whether it can load now (ai_control.py)."""
    from . import ai_control
    return ai_control.state()


@router.get("/api/ai/brains")
def ai_brains():
    """THE BRAINS AND THE LIBRARY (2026-10-20): every model that can be Lacuna's brain — Ollama's big Gemmas and any .gguf in
    ~/lacuna-world/models/brains — each with the profile switch-brain.sh would apply; which one runs; and the 8-bit library of helper bases."""
    import json as _j, re as _re
    from pathlib import Path as _P
    home = _P.home()
    profiles = _j.loads((home / "code/lacuna/lacuna-box/brain/brain-profiles.json").read_text())["profiles"]
    prof = lambda t: next((p["name"] for p in profiles if _re.search(p["match"], t.lower())), "default")   # noqa: E731
    try:
        active = _j.loads((home / ".lacuna/brain-profile.json").read_text())
    except (OSError, ValueError):
        active = {}
    out = []
    lib = home / ".ollama/models/manifests/registry.ollama.ai/library"
    for fam in ("gemma4", "gemma3"):
        for m in sorted((lib / fam).glob("*")) if (lib / fam).is_dir() else []:
            tag = f"{fam}:{m.name}"
            try:
                size = sum(l["size"] for l in _j.loads(m.read_text())["layers"] if l["mediaType"].endswith("image.model"))
            except (OSError, ValueError, KeyError):
                size = 0
            if size > 3e9:                                   # a brain, not a helper
                out.append({"id": tag, "kind": "ollama", "size_gb": round(size / 1e9, 1), "profile": prof(tag), "active": active.get("brain") == tag})
    for g in sorted((home / "lacuna-world/models/brains").glob("*.gguf")):
        out.append({"id": str(g), "kind": "gguf", "size_gb": round(g.stat().st_size / 1e9, 1), "profile": prof(g.stem), "active": active.get("file") == str(g)})
    from . import chat as _c
    try:
        tags = {m["name"].removesuffix(":latest"): m for m in _j.loads(urllib.request.urlopen(f"{_c.OLLAMA_BACK}/api/tags", timeout=5).read())["models"]}
    except Exception:  # noqa: BLE001
        tags = {}
    library = [{"base": b, "for": w, "installed": b in tags, "size_gb": round(tags[b]["size"] / 1e9, 2) if b in tags else None} for b, w in _c.LIBRARY_BASES.items()]
    return {"brains": out, "active": {k: active.get(k) for k in ("brain", "name", "abilities", "size_gb")}, "library": library,
            "drop_folder": "~/lacuna-world/models/brains"}


@router.post("/api/ai/{what}")
def ai_act(what: str, body: dict | None = None, x_lacuna_who: Optional[str] = Header(None)):
    """The owner's control over the AI: brain-restart · minds-unload · talk {model, text}. A person only."""
    from . import ai_control
    who = _who(x_lacuna_who)
    if who in ("lacuna", "home-lacuna"):
        raise HTTPException(403, "only a person controls the AI from here")
    if what == "brain-restart":
        return ai_control.restart_brain(who)
    if what == "minds-unload":
        return ai_control.unload_minds(who)
    if what == "library-pull":                          # one 8-bit base for the helpers' library, downloaded once (a job)
        from .core import start_job
        from . import chat as _c
        tag = str((body or {}).get("tag") or "")
        if tag not in _c.LIBRARY_BASES:
            raise HTTPException(400, f"the library takes only its 8-bit bases: {', '.join(_c.LIBRARY_BASES)}")
        j = start_job("library", f"download {tag} (8-bit) into the library", ["/bin/zsh", "-c", f"OLLAMA_HOST=127.0.0.1:11435 ollama pull {tag}"], who)
        return {"ok": True, "job": j.id, "said": f"downloading {tag} once; follow it on its chip"}
    if what in ("brain-switch", "brain-back"):          # THE OWNER SWITCHES THE BRAIN (2026-10-20): download once, unload the old, load, prove
        from pathlib import Path as _P
        from .core import start_job
        tag = str((body or {}).get("tag") or (body or {}).get("path") or "gemma4:12b-it-qat")
        script = str(_P.home() / "code/lacuna/lacuna-box/brain/switch-brain.sh")
        args = ["--back"] if what == "brain-back" else [tag]
        j = start_job("brain", f"switch the brain {'back' if what == 'brain-back' else 'to ' + tag}", ["/bin/zsh", script, *args], who)
        return {"ok": True, "job": j.id, "said": f"switching the brain {'back' if what == 'brain-back' else 'to ' + tag}: "
                "the download (if any) then ~2 minutes with no brain; follow it on its chip or in Work"}
    if what == "talk":
        b = body or {}
        return ai_control.talk(str(b.get("model") or ""), str(b.get("text") or ""), who)
    raise HTTPException(404, "brain-restart · minds-unload · brain-switch · brain-back · talk")


@router.post("/api/forge/pantheon/{name}/propose")
def forge_pantheon_propose(name: str, x_lacuna_who: Optional[str] = Header(None)):
    """A card to put a pantheon mind in service — refused under 90% one-shot (pantheon_view.propose)."""
    from . import pantheon_view
    return pantheon_view.propose(name, _who(x_lacuna_who))


@router.get("/api/carts")
def carts_list():
    """Every cart and worker class: plan, flowchart, last runs (cartview.py)."""
    from . import cartview
    return cartview.carts()


@router.get("/api/carts/run/{cart}/{rid}")
def cart_run(cart: str, rid: str):
    from . import cartview
    return cartview.run_record(cart, rid)


@router.post("/api/triggers")
def triggers_arm(body: dict, x_lacuna_who: Optional[str] = Header(None)):
    """file the card that arms a trigger (the owner's press writes it)"""
    from . import chat, triggers
    why = triggers.valid(body or {})
    if why:
        return {"ok": False, "why": why}
    spec = {k: body[k] for k in ("id", "cart", "when", "dry") if k in body}
    return chat.file_petition("trigger-arm", None, f"arm the trigger {spec['id']} → {spec['cart']}", _who(x_lacuna_who), args=spec)


@router.post("/api/triggers/{tid}/off")
def triggers_off(tid: str, x_lacuna_who: Optional[str] = Header(None)):
    from . import triggers
    return triggers.disarm(tid, _who(x_lacuna_who))


@router.post("/api/carts/generate")
def cart_generate(body: dict, x_lacuna_who: Optional[str] = Header(None)):
    """The owner's words → a watch cart, tried by the foreman, in the carts folder (cart_gen.py). A person only."""
    from . import cart_gen
    who = _who(x_lacuna_who)
    if who.startswith("foreman:") or who in ("lacuna", "home-lacuna"):
        raise HTTPException(403, "a person asks for a cart here")
    return cart_gen.generate(str(body.get("name") or ""), str(body.get("text") or ""), who)


@router.get("/api/carts/desk/{name}")
def cart_desk_program(name: str):
    """An interface cart's program, for the desk to run in the browser (hand/deskCart.js)."""
    from . import cartview
    return cartview.desk_program(name)


@router.post("/api/carts/{name}/run")
def cart_run_now(name: str, dry: bool = False, x_lacuna_who: Optional[str] = Header(None)):
    """Run a cart now: its trial, then an approval card (?dry=1: its acts only say what they would do)."""
    from . import cartview
    return cartview.run_now(name, _who(x_lacuna_who), dry)




@router.get("/api/swarm/link")
def swarm_link(a: str, b: str):
    """What two agents said to each other lately (swarm.link)."""
    from . import swarm
    return swarm.link(a, b)


@router.post("/api/swarm/stop/{nid}")
def swarm_stop(nid: str, x_lacuna_who: Optional[str] = Header(None)):
    """Stop one agent on the owner's word (swarm.stop); Lacuna cannot call this on itself (its tools do not reach it)."""
    from . import swarm
    who = _who(x_lacuna_who)
    if who in ("lacuna", "home-lacuna"):
        raise HTTPException(403, "only a person stops an agent from the swarm")
    from . import agent_talk
    agent_talk._remember(who, "stopped", nid, "from its chip")          # Lacuna learns on its next turn that the owner did it
    if nid.startswith("errand:") or (__import__("pathlib").Path.home() / "lacuna-world" / "jobs" / nid).is_dir():       # a card or errand: really end its process
        from . import finished
        return finished.kill_job(nid)
    return swarm.stop(nid, who)


@router.get("/api/swarm")
def swarm_route():
    """Every agent on the box as one picture: bubbles, clusters, mailboxes and the messages in flight (swarm.py)."""
    from . import swarm
    return swarm.swarm()


@router.get("/api/minds/live")
def minds_live():
    """The gateway's live minds (GET :11434/lacuna/minds) for the desk's Minds view — the page never reaches :11434 itself."""
    from . import foreman
    try:
        with urllib.request.urlopen(f"{foreman.GATEWAY}/lacuna/minds", timeout=2) as r:
            return json.loads(r.read().decode() or "{}")
    except Exception as e:  # noqa: BLE001 — a gateway that does not answer is said, never a 500
        return {"ok": False, "why": f"the gateway did not answer: {e.__class__.__name__}"}


@router.get("/api/home/board")
def home_board(screen: Optional[str] = None):
    """The cards Lacuna put down on its home, in order, and what it last said; `screen` (big | phone) says which desk
    is reading — the link's sign of life — and the answer carries the screens that are up."""
    from . import home
    home.seen_screen(screen)
    return {**home.board(), "screens": home.screens()}


@router.post("/api/home/board")
def home_board_act(op: dict, x_lacuna_who: Optional[str] = Header(None), x_lacuna_owner: Optional[str] = Header(None),
                   x_lacuna_owner_t: Optional[str] = Header(None), x_lacuna_device: Optional[str] = Header(None)):
    """place · move · remove · focus · say · clear, and the nav ops (open-app · slide · back · forward · side-by-side ·
    point-at · home) — Lacuna's hands on its own home (and the page's, for move/remove)."""
    from . import home, owner
    if op.get("op") in home.NAV_OPS and op.get("screen") == "big":
        # driving the big screen is the paired owner's alone: the op is signed like a press (nonce, single use);
        # anyone else is refused quietly — the board is answered, unchanged
        by, _why = owner.check(f"nav:{op.get('nonce') or ''}", True, {"sig": x_lacuna_owner, "t": x_lacuna_owner_t, "device": x_lacuna_device})
        if not by or not op.get("nonce"):
            return {**home.board(), "refused": "not a paired device"}
    return home.act(op, _who(x_lacuna_who))


@router.get("/api/skills")
def skills_route(kind: str | None = None, ask: str = ""):
    """What Lacuna can do (every skill, its size and record) — or, with kind, the ≤3 it would load for that job."""
    from . import skills
    if kind:
        return {"kind": kind, "pick": skills.pick(kind, ask)}
    return {"skills": skills.list_skills(), "words": skills.words()}


@router.get("/api/disk/plan")
def disk_plan():
    """The owner's list, now: the files that may go, their total, the biggest eaters (read-only)."""
    from . import diskguard
    p = diskguard.plan()
    return {**p, "words": diskguard.words(p)}


@router.post("/api/disk/clean")
def disk_clean(body: dict):
    """Delete exactly the planned files — only with the owner's confirmation in the body."""
    from . import diskguard
    out = diskguard.clean(bool((body or {}).get("confirm")))
    core.audit((body or {}).get("who") or "alfred", "disk.clean", **{k: v for k, v in out.items() if k != "disk"})
    return out


@router.post("/api/errors/{cls}/mute")
def errors_mute(cls: str, hours: float = 24):
    """B12: quiet one error class for a while (still recorded; no signal)"""
    from . import errors as _e
    return _e.mute(cls, hours)


@router.get("/api/errors/summary")
def err_summary(hours: float = 24):
    return errors.summary(hours)


@router.get("/api/errors/classes")
def err_classes(env: Optional[str] = None, level: Optional[str] = None, category: Optional[str] = None,
                hours: float = 24, q: Optional[str] = None, limit: int = 300):
    return errors.classes(env, level, category, hours, limit, q)


@router.get("/api/errors/series")
def err_series(hours: float = 24, bucket: int = 15):
    return errors.series_errors(hours, bucket)


@router.get("/api/telemetry")
def telemetry_read(part: Optional[str] = None):
    """What Lacuna reads (telemetry.py): apis · routes · sakura · carts · strict · posters · battery, or all."""
    try:
        return telemetry.read(part)
    except KeyError:
        raise HTTPException(404, f"no telemetry part {part!r}; parts: {', '.join(telemetry.PARTS)}")


@router.get("/api/telemetry/broken")
def telemetry_broken():
    return telemetry.broken()


@router.get("/api/metrics/routes")
def metrics_routes(hours: float = 24, env: Optional[str] = None):
    return errors.series_routes(hours, env)


@router.get("/api/metrics/series")
def metrics_series(name: str, hours: float = 24):
    return workers.series(name, hours)


@router.get("/api/logs")
def logs(env: Optional[str] = None, level: Optional[str] = None, q: Optional[str] = None, after: float = 0, limit: int = 300, quiet: bool = False):
    return errors.recent_lines(env, level, q, after, min(limit, 2000), quiet)


@router.websocket("/ws/logs")
async def ws_logs(ws: WebSocket):
    """The live tail: every new line matching the filters the page sends ({env, level, q})."""
    from .guard import ws_allowed
    if not ws_allowed(ws):
        await ws.close(code=4403)
        return
    await ws.accept()
    filt: dict = {}
    last = time.time() - 120
    try:
        while True:
            try:
                msg = await asyncio.wait_for(ws.receive_text(), timeout=1.0)
                filt = json.loads(msg or "{}")
                last = time.time() - float(filt.get("back", 120))
            except asyncio.TimeoutError:
                pass
            rows = errors.recent_lines(filt.get("env") or None, filt.get("level") or None, filt.get("q") or None, last, 500, bool(filt.get("quiet")))
            if rows:
                last = rows[-1]["t"]
                await ws.send_text(json.dumps(rows))
    except (WebSocketDisconnect, RuntimeError):
        return


@router.websocket("/ws/terminal")
async def ws_terminal(ws: WebSocket):
    await terminal.serve(ws)


@router.get("/api/deploys")
def deploy_list():
    return {"versions": deploys.versions(), "builds": deploys.builds()}


@router.get("/api/packages")
def packages_now():
    """The package (dev ahead of main), what QA runs, and what her iPad has — one read for the Ship view."""
    p = deploys.packages()
    d = deploys.device("lacuna")
    p["ipad_running_build"] = d.get("build") if d.get("ok") else None
    p["ipad_note"] = None if d.get("ok") else d.get("why")
    return p


@router.post("/api/deploys/promote")
def deploy_promote(body: Act = Act(), build: bool = False, x_lacuna_who: Optional[str] = Header(None), x_lacuna_owner: Optional[str] = Header(None),
                   x_lacuna_owner_t: Optional[str] = Header(None), x_lacuna_device: Optional[str] = Header(None)):
    _owner_press("promote-and-build" if build else "promote", x_lacuna_owner, x_lacuna_owner_t, x_lacuna_device, "promote-and-build" if build else "promote")
    """dev → QA (toolbox/promote.sh). HERS: refused without an explicit confirm from the person pressing it."""
    if not body.confirm:
        raise HTTPException(409, {"needs_confirm": True, "why": "promoting restarts the customer's server — confirm it"})
    return deploys.promote(_who(x_lacuna_who), build=build)


@router.post("/api/deploys/build")
def deploy_build(body: Build, x_lacuna_who: Optional[str] = Header(None)):
    try:
        return deploys.build(body.ref, _who(x_lacuna_who))
    except ValueError as e:
        raise HTTPException(400, str(e))


@router.post("/api/deploys/simulator")
def deploy_sim(x_lacuna_who: Optional[str] = Header(None)):
    return deploys.simulator(_who(x_lacuna_who))


@router.post("/api/deploys/{build_id}/install")
def deploy_install(build_id: str, body: Act = Act(), x_lacuna_who: Optional[str] = Header(None), x_lacuna_owner: Optional[str] = Header(None),
                   x_lacuna_owner_t: Optional[str] = Header(None), x_lacuna_device: Optional[str] = Header(None)):
    _owner_press(f"install:{build_id}", x_lacuna_owner, x_lacuna_owner_t, x_lacuna_device, "deploy-ipad")
    out = deploys.deploy(build_id, _who(x_lacuna_who), body.confirm)
    if out.get("needs_confirm"):
        raise HTTPException(409, out)
    return out


@router.delete("/api/deploys/{build_id}")
def deploy_remove(build_id: str, x_lacuna_who: Optional[str] = Header(None)):
    return deploys.remove(build_id, _who(x_lacuna_who))


@router.get("/api/deploys/device")
def deploy_device(x_lacuna_who: Optional[str] = Header(None)):
    return deploys.device(_who(x_lacuna_who))


@router.post("/api/tests/{suite}")
def tests_start(suite: str, x_lacuna_who: Optional[str] = Header(None)):
    if suite not in battery.SUITES:
        raise HTTPException(404, suite)
    return battery.start_suite(suite, _who(x_lacuna_who))


@router.get("/api/docs")
def docs_index():
    return docs.index()


@router.get("/api/docs/search")
def docs_search(q: str):
    return docs.search(q, 30)


@router.get("/api/docs/{doc_id}")
def docs_read(doc_id: str):
    if doc_id not in docs.DOCS:
        raise HTTPException(404, doc_id)
    return docs.read(doc_id)


# ── THE BOOT, THE CHECKS, THE WATCHDOGS, THE DRILLS, THE NOTICES (DiRT pass, 2026-09-25) ─────────────────────────
@router.get("/api/release")
def release_status():
    """The latest release and its four steps."""
    return deploys.release_status()


@router.post("/api/release")
def release_start(body: Release, x_lacuna_who: Optional[str] = Header(None), x_lacuna_owner: Optional[str] = Header(None),
                  x_lacuna_owner_t: Optional[str] = Header(None), x_lacuna_device: Optional[str] = Header(None)):
    """dev → QA → her iPad, one job. HERS: the owner key's signature over "release" (`lacuna release --yes` signs it)."""
    _owner_press("release", x_lacuna_owner, x_lacuna_owner_t, x_lacuna_device, "release")
    r = deploys.release(_who(x_lacuna_who), body.confirm, body.skip_pass)
    if r.get("needs_confirm"):
        raise HTTPException(409, {"why": r["why"], "needs_confirm": True})
    return r


@router.get("/api/boot")
def boot_report():
    """What came back after the last reboot (or restart of Lacuna), and which agents would not survive one."""
    return boot.report()


@router.post("/api/checks/run")
def checks_run(x_lacuna_who: Optional[str] = Header(None)):
    """The minute's pass, now — 'kick the watchdogs': sample, evaluate, drift; says what it raised."""
    who = _who(x_lacuna_who)
    core.audit(who, "checks.run")
    before = {a["key"] for a in workers.alerts(200)}
    workers.sample()
    workers.evaluate()
    after = workers.alerts(200)
    return {"ok": True, "raised": [a for a in after if a["key"] not in before], "alerts": len([a for a in after if not a.get("acked")]),
            "drift": workers.drift_now()}


# THE WATCHDOGS MOVED TO THE DOOR (2026-11-06, lane python-out-2): GET /api/watchdogs and POST
# /api/watchdogs/{name}/kick are lacuna-node/frontend/watchdogs.mjs. health.watchdogs stays: the workers' alerts and the
# snapshot read it. watchdog_kick stays a function, no longer a route: the card verb `watchdog-kick` (card_verbs.py)
# calls it when the owner presses yes on its petition; it leaves with the petitions.
def watchdog_kick(name: str, x_lacuna_who: Optional[str] = None):
    """B11: run one DEV watchdog's probe now (the dev API's POST /watch/{name}/kick). QA's dogs are never kicked here."""
    import re as _re
    import urllib.request as _u
    n = name.removeprefix("watch.")
    if not _re.fullmatch(r"[\w.-]{1,60}", n):
        raise HTTPException(400, "a watchdog's name")
    core.audit(_who(x_lacuna_who), "watchdog.kick", name=n)
    try:
        with _u.urlopen(_u.Request(f"http://127.0.0.1:5051/watch/{n}/kick", b"", method="POST"), timeout=30) as r:
            d = json.loads(r.read())
        return {"ok": True, "said": f"kicked: {n} is {d.get('state')}" + (f" — {d['detail']}" if d.get("detail") else "")}
    except Exception as e:  # noqa: BLE001
        return {"ok": False, "why": f"the dev API did not take the kick ({e.__class__.__name__}: {str(e)[:120]})"}


@router.post("/api/desk/press/{pid}")
def desk_press(pid: str, body: dict | None = None):
    """Take the owner to one card's yes/no on every desk he has open (the board's nav op: the inbox, focused on it)."""
    from . import desk_nav
    return {"said": desk_nav.take_to_press(pid, str((body or {}).get("say") or ""))}


@router.get("/api/self-repair")
def self_repair_state(fast: bool = True):
    """What each self-repair's check says now, and the newest repairs (self_repair.py, playbook P-SELF)."""
    from . import self_repair
    return {"checks": self_repair.check(fast=fast), "recent": self_repair.history(20)}


@router.post("/api/self-repair/{what}")
def self_repair_act(what: str, x_lacuna_who: Optional[str] = Header(None)):
    """One repair on our own side, only if its check fails now (Lacuna or a person; never the customer's side)."""
    from . import self_repair
    return self_repair.repair(what, _who(x_lacuna_who))


@router.post("/api/work-order")
def work_order_file(body: dict, x_lacuna_who: Optional[str] = Header(None)):
    """Files the work-order card; the owner's one press starts it (N hours, 0.5–24)."""
    from . import chat
    hours = max(0.5, min(24.0, float((body or {}).get("hours") or 24)))
    return chat.file_petition("work-order", f"{hours:g}", f"work on your own for {hours:g} h", _who(x_lacuna_who))


@router.get("/api/drills")
def drills_list():
    return {"running": drill.running(), "history": drill.history(), "kinds": list(drill.KINDS)}


@router.post("/api/drills/{kind}/{name}")
def drills_run(kind: str, name: str):
    """A live drill breaks a service: it goes through the press now (lane L2, MAIL 252), never this bare route."""
    raise HTTPException(403, {"why": f"a live drill is a press: file the petition `drill` with args {{kind: {kind[:20]}, name: {name[:40]}}} "
                                     "(POST /api/petitions); this route no longer drills"})


@router.get("/api/notify")
def notify_channels():
    return workers.notify_channels()


@router.post("/api/notify/test")
def notify_test(x_lacuna_who: Optional[str] = Header(None)):
    who = _who(x_lacuna_who)
    core.audit(who, "notify.test")
    return workers.notify_test()


class NotifySend(BaseModel):
    key: str = ""
    level: str = "info"
    title: str = ""
    body: str = ""


@router.post("/api/notify/send")
def notify_send(body: NotifySend, x_lacuna_who: Optional[str] = Header(None)):
    """Another service raises an SRE alert through Lacuna (product notices never come here: the two lanes, 2026-10-07).

    Since the owner's ruling 7 (2026-11-02, LACUNA-1.0-FINALE.md §1) an alert notifies no one: it is a row of the alerts
    ledger, read by the telemetry card. The answer names no channel.
    """
    title, text = (body.title or "").strip(), (body.body or "").strip()
    if not title or not text:
        raise HTTPException(422, {"why": "a notice needs a title and a body"})
    if body.level not in ("info", "warn"):
        raise HTTPException(422, {"why": f"level is info or warn, not {body.level!r}"})
    key = (body.key or "").strip() or f"send:{title[:60]}"
    who = _who(x_lacuna_who)
    quieted = time.time() - workers._notified.get(title, 0.0) < workers.NOTIFY_QUIET_S
    core.audit(who, "notify.send", key=key, level=body.level, title=title, quieted=quieted)
    workers.raise_alert(key, body.level, title, text)
    return {"ok": True, "key": key, "quieted": quieted, "channels": [], "telemetry": True, "quiet_s": workers.NOTIFY_QUIET_S}


@router.get("/api/alerts")
def alerts_list():
    return workers.alerts(200)


@router.post("/api/alerts/ack")
def alerts_ack(key: Optional[str] = None):
    if key and str(key).startswith("notice:"):          # a notice has its own store (notices.py)
        from . import notices
        notices.ack(key)
    else:
        workers.ack(key)
    return {"ok": True}


@router.post("/api/chat")
def chat_ask(body: Ask, x_lacuna_who: Optional[str] = Header(None)):
    return chat.ask(body.text, _who(x_lacuna_who), body.session, body.model, context=body.context, card=body.card)


# THE OWNER'S HAND ON ANY AGENT MOVED TO THE DOOR (2026-11-06, lane python-out-2): POST /api/agents/control is
# lacuna-node/frontend/agents-control.mjs in the work area. chat.agents stays for Lacuna's own `agents` tool.


@router.post("/api/chat/stop")
def chat_stop():
    """The stop of a turn this API runs (the cloud seat's): the door answers /api/chat/stop and forwards it here only while
    such a turn is in flight (lacuna-node/frontend/desk-turn.mjs)."""
    return chat.request_stop()


@router.post("/api/chat/stream")
async def chat_stream(body: Ask, x_lacuna_who: Optional[str] = Header(None)):
    """The chat as it happens (server-sent events): a `step` per tool the model calls (a proposal carries its id so the
    page can show Approve), then the `answer`. The model runs in a worker thread; the page never waits on a blank."""
    import queue as _queue
    import threading as _threading
    from fastapi.responses import StreamingResponse
    q: _queue.Queue = _queue.Queue()
    who = _who(x_lacuna_who)

    def work():
        try:
            r = chat.ask(body.text, who, body.session, body.model, context=body.context, card=body.card,
                         thinking_level=body.thinking_level, on_step=lambda st: q.put({"type": "step", **st}), on_event=q.put)
            q.put({"type": "answer", "text": r.get("answer") or "", "ok": r.get("ok", False), "ms": r.get("ms"),
                   "capped": bool(r.get("capped")), "model": r.get("model"), "mode": r.get("mode"), "thinking": r.get("thinking") or "",
                   "seen": r.get("seen"), "tokens": r.get("tokens")})
        except Exception as exc:                                  # noqa: BLE001
            q.put({"type": "answer", "text": f"The chat failed: {exc.__class__.__name__}", "ok": False})
        q.put(None)
    _threading.Thread(target=work, daemon=True).start()

    async def events():
        # A KEEPALIVE EVERY 8 s (2026-10-19, "Lacuna dies mid chat"): while the brain reads a long prompt or a long tool result
        # nothing is sent for 20–60 s, and a proxy, Safari or the iPad drops a silent connection as dead. An SSE comment line
        # (": ping") keeps the stream alive and the page knows it is still connected. The turn itself runs in its own thread
        # and stores its answer either way.
        loop = asyncio.get_running_loop()

        def nxt():
            try:
                return q.get(timeout=8)
            except _queue.Empty:
                return "ping"
        while True:
            item = await loop.run_in_executor(None, nxt)
            if item is None:
                break
            if item == "ping":
                yield ": ping\n\n"
                continue
            yield f"data: {json.dumps(item, default=str)}\n\n"
    return StreamingResponse(events(), media_type="text/event-stream", headers={"Cache-Control": "no-store", "X-Accel-Buffering": "no"})


@router.get("/api/chat/models")
def chat_models():
    return {"default": chat.MODEL, "available": chat.models()}


@router.get("/api/petitions")
def petitions_list():
    return chat.petitions()


@router.post("/api/petitions")
def petitions_file(body: dict, x_lacuna_who: Optional[str] = Header(None)):
    """A person's button on the desk files a contract (restart QA, promote, the release …): the permission card that
    comes up states exactly what will happen, and only its yes runs it."""
    who = _who(x_lacuna_who)
    args = body.get("args") if isinstance(body.get("args"), dict) else None   # the card's structured ask (C3: ticket-file, broker-load)
    return chat.file_petition(str(body.get("action") or ""), body.get("build"), str(body.get("reason") or f"pressed by {who} on the desk"), who, args=args)


@router.post("/api/petitions/{pid}")
def petitions_decide(pid: str, body: Decide, x_lacuna_who: Optional[str] = Header(None), x_lacuna_owner: Optional[str] = Header(None),
                     x_lacuna_owner_t: Optional[str] = Header(None), x_lacuna_device: Optional[str] = Header(None)):
    """Only the owner's press decides (control/owner.py): a signed X-Lacuna-Owner, never the X-Lacuna-Who it claims."""
    from fastapi.responses import JSONResponse
    r = chat.decide(pid, body.approve, _who(x_lacuna_who), {"sig": x_lacuna_owner, "t": x_lacuna_owner_t, "device": x_lacuna_device})
    return JSONResponse(r, status_code=403) if r.get("refused_press") else r
