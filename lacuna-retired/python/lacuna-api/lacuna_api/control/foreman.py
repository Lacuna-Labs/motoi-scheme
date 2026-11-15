"""FOREMEN, from Lacuna's side (LACUNA-1.3-DESIGN §32, B33).

Lacuna orchestrates; a foreman (lacuna-foreman/, 127.0.0.1:1139 on the Studio) runs workers — slat programs on the
Erlang model. Here: the client (with the foreman's token), and what Lacuna does with what comes UP from a foreman:

  report        kept (the desk's Foremen card reads it); a report of kind `alert` raises one of Lacuna's alerts
  crashed       kept; graved → an alert ("a worker was buried") and its parent heard already
  need-brain    Lacuna thinks (its chat, on the one brain) and sends the answer DOWN as the worker's `brain` event
  ask           a permission card on the desk; the person's yes or no goes DOWN as the worker's `answer` event
  cart-retired  a Lacuna cart ended: its artifact, its leases, its exam row (carts.py)

A worker's small mind is asked through here too (mind(), POST /api/foreman/mind): the foreman talks only to Lacuna, and
Lacuna sends the question to the gateway only for a model this box lets an agent have (box-minds.json), or the 26B as a
cascade's last rung in the background lane. The cascade's records come up too (cascade.py, POST /api/foreman/cascade).

Every message to or from a foreman is a signed protocol form (slatwire.py, §36 B43): events going DOWN are sealed here
in `call`, what comes UP is opened in `receive` — unsigned, forged, replayed or malformed ones are dropped and counted.

Spawning a worker always goes through a contract: Lacuna (or a person) proposes the program, a permission card shows
it, and only the yes loads it. Code that runs on its own is code a person saw first.
"""
from __future__ import annotations

import json
import re
import threading
import time
import urllib.request
from pathlib import Path

from . import card_verbs, maker_verbs

URL = "http://127.0.0.1:1139"
TOKEN_FILE = Path.home() / ".lacuna" / "foreman-token"
EVENTS = Path.home() / ".lacuna" / "foreman-events.jsonl"


def _token() -> str:
    try:
        return TOKEN_FILE.read_text().strip()
    except OSError:
        return ""


def call(method: str, path: str, body: dict | None = None, timeout: float = 10) -> dict:
    if method == "POST" and path.startswith("/workers/") and path.endswith("/event") and body is not None:
        # an event is a message to a worker: sealed for this hop. kind/value stay beside it for a foreman that has not
        # restarted onto the protocol yet; a foreman that has reads only the signed form.
        from . import slatwire
        body = {**body, **slatwire.seal(_token(), "lacuna", path.split("/")[2], str(body.get("kind") or "event"), body.get("value"))}
    req = urllib.request.Request(URL + path, method=method, data=json.dumps(body).encode() if body is not None else None,
                                 headers={"Content-Type": "application/json", "X-Foreman-Token": _token()})
    try:
        with urllib.request.urlopen(req, timeout=timeout) as r:
            return json.loads(r.read().decode() or "{}")
    except urllib.error.HTTPError as e:
        try:
            return json.loads(e.read().decode())
        except ValueError:
            return {"ok": False, "why": f"the foreman answered {e.code}"}
    except OSError as e:
        return {"ok": False, "why": f"the foreman is not answering ({e.__class__.__name__})"}


def workers() -> dict:
    return call("GET", "/workers")


def stop(wid: str) -> dict:
    return call("DELETE", f"/workers/{wid}")


def spawn_now(name: str, program: str, tier: str = "watch", by: str = "lacuna") -> dict:
    return call("POST", "/workers", {"name": name, "program": program, "tier": tier, "by": by})


def propose(name: str, program: str, why: str, tier: str, who: str) -> dict:
    """A contract to load a worker: the card shows the program; only the yes spawns it (chat.decide → run_pending)."""
    from . import chat
    t = call("POST", "/check", {"program": program})
    if not t.get("ok"):
        # the brain fixes its own program before a person is asked (a dry run in a scratch supervisor)
        return {"ok": False, "fix_first": t.get("problems") or [t.get("why")],
                "say": "the program did not pass its trial — fix these and propose it again"}
    lines = program.strip().splitlines()
    shown = "\n".join(lines[:14]) + (f"\n… {len(lines) - 14} more lines" if len(lines) > 14 else "")
    return chat.file_petition("spawn-worker", None, why or f"asked by {who}", who,
                              args={"name": name, "tier": tier, "program": program, "shown": shown, "asked_by": who})


def forge_effect(action: str, args: dict) -> str:
    """The Forge card's petitions say what their yes does (forge_jobs.py)."""
    from . import forge_jobs
    return forge_jobs.effect(action, args)


def decided(action: str, args: dict, approve: bool, who: str) -> dict:
    """The person answered a foreman contract (chat.decide calls this; the petition kept the args on disk)."""
    if action in maker_verbs.VERBS:                  # the Arcade and the Factory (lane L3): a playbook run, or the summon for claude
        return maker_verbs.decided(action, args, approve, who, call)
    if action == "spawn-worker":
        return spawn_now(args["name"], args["program"], args.get("tier", "watch"), by=who) if approve else {"ok": True, "declined": True}
    if action == "spawn-cart":
        from . import carts
        return carts.spawn(args, who) if approve else carts.declined(args, who)
    if action == "cart-step":
        from . import acts
        return acts.pressed(args, approve, who)
    if action == "check-in":
        from . import checkin
        return checkin.commit(args, who) if approve else {"ok": True, "declined": True}
    if action == "caliper-run":
        from . import caliper_run
        return caliper_run.start(str(args.get("mode") or "passive"), who, args.get("room"), args.get("item")) if approve else {"ok": True, "declined": True}
    if action in ("forge-job", "forge-resume", "forge-exam"):   # the Forge card (lane F2): start by kind · resume from a park · sit the exam
        from . import forge_jobs
        return forge_jobs.decided(action, args, approve, who, call)
    if action == "ticket-file":                       # the Agents card's "file a bug": one act, through the foreman's playbook
        if not approve:
            return {"ok": True, "declined": True}
        t = {k: args.get(k) for k in ("kind", "priority", "key", "title", "evidence", "filer") if args.get(k) is not None}
        key = str(t.get("key") or "")[:40]
        b = {"1": [{"state": "open"}], "2": [t], "3": [{"state": "open"}], "4": [{"to": "desk", "ticket": key, "text": f"a bug filed from the agent card: {str(t.get('title') or '')[:200]}"}]}
        return call("POST", "/playbooks/agent-bug/run", {"bindings": b, "pressed": True, "shadow": False, "by": who})
    if action == "kill":                              # the System card's kill (lane C8): the hands' act through the process-kill playbook
        if not approve:
            return {"ok": True, "declined": True}
        pid, name = str(args.get("pid") or ""), str(args.get("name") or "")
        if not re.fullmatch(r"[1-9]\d{0,6}", pid) or int(pid) < 2 or not name or len(name) > 60:
            return {"ok": False, "why": "a kill names one process: a pid of 2 or more and its name as the card showed it"}
        row = {"pid": int(pid), "name": name, **({"up_s": args["up_s"]} if isinstance(args.get("up_s"), (int, float)) else {})}
        b = {"1": [], "2": [row], "3": [], "4": [{"to": "desk", "ticket": f"kill:{pid}", "text": f"the owner's kill of {name} (pid {pid}) ran; its receipt says how it ended"}]}
        return call("POST", "/playbooks/process-kill/run", {"bindings": b, "pressed": True, "shadow": False, "by": who})
    if action == "draw":                              # the Gallery's paint it (lane C12): the hands' act through the gallery-draw playbook
        if not approve:
            return {"ok": True, "declined": True}
        from .chat import draw_args
        d = draw_args(args)
        if d is None:
            return {"ok": False, "why": "a draw names a brief of 1–2,000 characters and schnell's four controls: size 512 · 768 · 1024, steps 1–4, seed, count 1 · 2 · 4"}
        wall = {"path": str(Path.home() / "lacuna-world" / "runs"), "glob": "draw-*.slat"}
        b = {"1": [wall], "2": [d], "3": [wall], "4": [{"to": "desk", "ticket": f"draw:{d['seed']}", "text": f"the owner's draw ran: {d['brief'][:160]}; its receipt says what was painted"}]}
        return call("POST", "/playbooks/gallery-draw/run", {"bindings": b, "pressed": True, "shadow": False, "by": who})
    if action == "broker-load":                       # "wake the picked one": the gateway's warm-up starts its weights (one try)
        if not approve:
            return {"ok": True, "declined": True}
        model = str(args.get("model") or args.get("weights") or "")
        if not model:
            return {"ok": False, "why": "the card named no weights to load"}
        b = call("GET", "/broker")
        if (b.get("avail_mb") or 0) < 1024:
            return {"ok": False, "why": f"the broker reads {b.get('avail_mb')} MB free; under 1,024 MB nothing is loaded (the wall)"}
        import json as _json
        import urllib.request as _ur
        try:
            req = _ur.Request("http://127.0.0.1:11434/api/generate", data=_json.dumps({"model": model, "prompt": "", "stream": False}).encode(),
                              headers={"Content-Type": "application/json"})
            with _ur.urlopen(req, timeout=60) as r:
                out = _json.loads(r.read() or b"{}")
            return {"ok": "error" not in out, "said": f"{model} {'is loaded' if 'error' not in out else 'did not load: ' + str(out.get('error'))[:120]}"}
        except OSError as e:
            return {"ok": False, "why": f"the gateway did not answer ({e.__class__.__name__}); one try, then this sentence"}
    if action in card_verbs.VERBS:                    # the lead's cards (lane L2): watchdog-kick · drill · kick-run · sit-exam · leave-shadow
        return card_verbs.decided(action, args, approve, who, call)
    if action == "sentinel-accept":
        from . import sentinel
        return sentinel.accept(str(args.get("id"))) if approve else {"ok": True, "declined": True}
    if action == "trigger-arm":
        from . import triggers
        return triggers.arm({k: args[k] for k in ("id", "cart", "when", "dry") if k in args}, who) if approve else {"ok": True, "declined": True}
    if action == "worker-asks":
        if args.get("as_brain"):             # the owner stood in for the brain at a judgment point
            return call("POST", f"/workers/{args['worker']}/event", {"kind": "brain", "value": {"by": "owner", "yes": bool(approve), "what": args.get("what")}})
        return call("POST", f"/workers/{args['worker']}/event", {"kind": "answer", "value": {"yes": bool(approve), "what": args.get("what")}})
    return {"ok": False, "why": f"no foreman action {action}"}


# ── what comes up ───────────────────────────────────────────────────────────────────────────────────────────────────
def recent(limit: int = 60) -> list[dict]:
    try:
        lines = EVENTS.read_text().splitlines()[-limit:]
    except OSError:
        return []
    out = []
    for ln in lines:
        try:
            out.append(json.loads(ln))
        except ValueError:
            pass
    return out[::-1]


def receive(msg: dict) -> dict:
    from . import slatwire
    opened = slatwire.open_(_token(), msg)
    if opened["ok"] and opened["msg"]["to"] != "lacuna":
        opened = slatwire._drop("malformed", "addressed to someone else")
    if not opened["ok"]:
        return {"ok": False, "dropped": opened["drop"], "why": opened["why"]}
    msg = opened["msg"]["body"]                     # only what was signed is read; the plain JSON beside it is ignored
    with EVENTS.open("a") as f:
        f.write(json.dumps(msg, ensure_ascii=False) + "\n")
    kind, w, data = msg.get("kind"), msg.get("worker") or {}, msg.get("data") or {}
    from .workers import raise_alert
    if kind == "report" and w.get("name") == "watchdog-sweep" and data.get("kind") in ("warn", "alert", "clear"):
        watchdog_report(data)
    elif kind == "report" and data.get("kind") == "alert":
        words = " ".join(str(x) for x in data.get("data") or [])
        raise_alert(f"worker:{w.get('name')}", "warn", f"the worker {w.get('name')} says", words[:300])
    elif kind == "child-graved" and not w.get("parent"):
        raise_alert(f"worker-graved:{w.get('name')}", "warn", f"the worker {w.get('name')} was buried",
                    f"three crashes in five minutes — last: {str(data.get('why'))[:200]}")
    elif kind == "hand":
        threading.Thread(target=_hand, args=(w, data), name="foreman-hand", daemon=True).start()
    elif kind == "need-brain":
        _ration(w, data)
    elif kind == "act":
        threading.Thread(target=_act, args=(w, data), name="foreman-act", daemon=True).start()
    elif kind == "cart-retired":
        from . import carts
        try:
            carts.retired(w, data)
        except Exception as e:  # noqa: BLE001 — the event is kept in EVENTS; the desk shows it even if a write failed
            raise_alert(f"cart:{w.get('name')}", "warn", f"the cart {w.get('name')} ended but its artifact was not written",
                        f"{e.__class__.__name__}: {str(e)[:200]}")
    elif kind == "ask":
        from . import chat
        chat.file_petition("worker-asks", None, f"the worker {w.get('name')} asks", f"foreman:{w.get('name')}",
                           args={"worker": w.get("id"), "what": data.get("what")})
    return {"ok": True}


# AN ACT RUNS ONCE (design §45.3, 2026-10-19): the foreman re-sends an act whose answer did not come in time, with
# `retry_of` naming the first ticket. Re-running it could do the thing twice (two cards, two writes), so every act's answer
# is kept by its ticket; a re-send of a done act gets the kept answer, and one still in flight is not started again.
from .core import LACUNA_HOME  # noqa: E402
ACTS_DONE = LACUNA_HOME / "acts-done.json"
_acts_lock = threading.Lock()
_acts_inflight: set[str] = set()


def _acts_done() -> dict:
    try:
        return json.loads(ACTS_DONE.read_text())
    except (OSError, ValueError):
        return {}


def _act(w: dict, data: dict) -> None:
    """A cart's act (acts.py): only a named act, only on a run the owner pressed; answered as its `act` event."""
    from . import acts
    wid = str(w.get("id"))
    first = f"{wid}:{data.get('retry_of') or data.get('ticket')}"
    with _acts_lock:
        kept = _acts_done().get(first)
        busy = first in _acts_inflight
        if kept is None and not busy:
            _acts_inflight.add(first)
    if kept is not None or busy:
        out = kept if kept is not None else {"ok": False, "why": "the first ask of this act is still running; its answer comes on that ticket"}
        call("POST", f"/workers/{wid}/event", {"kind": "act", "value": {"ticket": data.get("ticket"), "op": data.get("op"), **out,
                                                                        "replayed": kept is not None}}, timeout=30)
        return
    try:
        out = acts.do(wid, str(data.get("op")), data.get("args") or [])
        with _acts_lock:
            done = _acts_done()
            done[first] = out if len(json.dumps(out, default=str)) < 20_000 else {"ok": out.get("ok"), "why": "(kept short)"}
            ACTS_DONE.write_text(json.dumps(dict(list(done.items())[-500:]), default=str))
    finally:
        with _acts_lock:
            _acts_inflight.discard(first)
    call("POST", f"/workers/{wid}/event", {"kind": "act", "value": {"ticket": data.get("ticket"), "op": data.get("op"), **out}}, timeout=30)


def _hand(w: dict, data: dict) -> None:
    """A worker's read, done here (READ ONLY, inside ~/code and ~/lacuna-world), answered as its `hand` event."""
    from . import hands
    out = _fit(hands.do(data.get("op"), data.get("args") or []))
    r = call("POST", f"/workers/{w.get('id')}/event", {"kind": "hand", "value": {"ticket": data.get("ticket"), "op": data.get("op"), **out}},
             timeout=30)
    if r.get("ok") is False and not r.get("dropped"):
        # the answer did not land (too big, the worker gone): it hears that, never silence
        call("POST", f"/workers/{w.get('id')}/event", {"kind": "hand", "value": {"ticket": data.get("ticket"), "op": data.get("op"),
             "ok": False, "why": f"the answer could not be delivered: {str(r.get('why'))[:160]}"}}, timeout=10)


HAND_BYTES = 200_000      # under the protocol's 256 KB body: a hand's lines are trimmed oldest-first to fit


def _fit(out: dict) -> dict:
    res = out.get("result")
    if not (isinstance(res, dict) and isinstance(res.get("lines"), list)):
        return out
    lines, cut = list(res["lines"]), 0
    while lines and len(json.dumps(lines, ensure_ascii=False).encode()) > HAND_BYTES:
        drop = max(1, len(lines) // 10)
        lines, cut = lines[drop:], cut + drop
    return {**out, "result": {**res, "lines": lines, **({"trimmed": cut} if cut else {})}} if cut else out


# ── THE BRAIN'S RATION (the owner, 2026-10-18: "can an LLM survive that?") — one brain serves everyone, so workers get it
#    one at a time, the same question inside ten minutes gets the kept answer, a worker asks at most once in five
#    minutes, and a person's conversation always goes first (a worker's turn waits while a chat turn is running).
_BRAIN = threading.Semaphore(1)
_ASKED: dict[str, float] = {}             # worker id → when it last asked
_KEPT: dict[str, tuple[float, str]] = {}  # question → (when, answer)
COOLDOWN_S, KEEP_S = 300, 600


def _ration(w: dict, data: dict) -> None:
    now = time.time()
    q = _qkey(data)
    kept = _KEPT.get(q)
    if kept and now - kept[0] < KEEP_S:
        call("POST", f"/workers/{w.get('id')}/event", {"kind": "brain", "value": kept[1]})
        return
    # a yes-or-no judgment is three short draws (judge.py), not a conversation: one point after another runs without the wait
    if not YESNO.search(str(data.get("question") or "")) and now - _ASKED.get(w.get("id"), 0) < COOLDOWN_S:
        call("POST", f"/workers/{w.get('id')}/event", {"kind": "brain-busy", "value": int(COOLDOWN_S - (now - _ASKED[w.get('id')]))})
        return
    _ASKED[w.get("id")] = now
    if not _brain_up():
        _ask_owner(w, data, "the brain is down")
        return
    threading.Thread(target=_think, args=(w, data), name="foreman-brain", daemon=True).start()


def _qkey(data: dict) -> str:
    """the same question about different facts is a different question (one path after another, one red after another)"""
    return str(data.get("question") or "") + "\x00" + json.dumps(data.get("facts"), sort_keys=True, ensure_ascii=False)[:2000]


def _brain_up() -> bool:
    import urllib.request
    try:
        with urllib.request.urlopen("http://127.0.0.1:8091/health", timeout=2) as r:
            return r.status == 200
    except Exception:  # noqa: BLE001
        return False


def _ask_owner(w: dict, data: dict, why: str) -> None:
    """A cart never stalls on the brain (CARTS-ARE-THE-WORK §2.3): its judgment point goes to the owner as a card, and
    his yes or no comes back to the cart as its `brain` event, {by: owner, yes}."""
    from . import chat
    q = str(data.get("question") or "")
    facts = "; ".join(str(x) for x in (data.get("facts") or []))[:300]
    chat.file_petition("worker-asks", None, f"the cart {w.get('name')} needs a judgment ({why}), so it asks you", f"foreman:{w.get('name')}",
                       args={"worker": w.get("id"), "what": f"{data.get('topic') or 'judgment'}: {q}" + (f" — {facts}" if facts else ""), "as_brain": True})


def _lane():
    """The background lane (lacuna-box/jail/workers/lane.py): one slot of the brain for all background work."""
    import importlib.util
    spec = importlib.util.spec_from_file_location("lacuna_lane", str(Path.home() / ".lacuna" / "jail" / "workers" / "lane.py"))
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


# brain-seconds per worker, for a cart's artifact and its exam row (carts.retired takes them)
_BRAIN_S: dict[str, float] = {}


def brain_seconds(wid: str) -> float:
    return _BRAIN_S.pop(str(wid), 0.0)


def _think(w: dict, data: dict) -> None:
    from . import chat
    with _BRAIN:
        while getattr(chat, "ACTIVE_TURNS", 0) > 0:      # a person is talking: they go first
            time.sleep(1)
        try:
            with _lane().background():
                t0 = time.time()
                try:
                    _think_now(w, data)
                finally:
                    _BRAIN_S[str(w.get("id"))] = _BRAIN_S.get(str(w.get("id")), 0.0) + time.time() - t0
        except TimeoutError:
            _ask_owner(w, data, "the brain is busy")


YESNO = re.compile(r"\byes\b.{0,40}\bno\b", re.I | re.S)


def _think_now(w: dict, data: dict) -> None:
    from . import chat
    if YESNO.search(str(data.get("question") or "")):
        # a yes-or-no judgment (B8–B10, judge.py): three draws, a unanimous and certain vote acts; anything less is the owner's
        from . import judge
        j = judge.judge(str(data.get("question")), data.get("facts"), about=f"card/{w.get('name')}")
        if not j["certain"]:
            data = {**data, "facts": [*(data.get("facts") or []), f"the brain was not sure: {j['said']} — {j['why']}"]}
            _ask_owner(w, data, f"the brain was not sure ({j['votes']['yes']} yes / {j['votes']['no']} no, certainty {j['certainty']:.2f})")
            return
        value = {"by": "brain", "yes": j["yes"], "certainty": j["certainty"], "votes": j["votes"], "why": j["why"], "answer": j["said"] + " — " + j["why"]}
        _KEPT[_qkey(data)] = (time.time(), value)
        call("POST", f"/workers/{w.get('id')}/event", {"kind": "brain", "value": value})
        return
    q = (f"One of your foreman's workers ({w.get('name')}) asks for your judgment. Answer in two sentences at most, "
         f"plainly, as an instruction it can act on.\nQuestion: {data.get('question')}\nFacts: {json.dumps(data.get('facts'))[:2000]}")
    try:
        r = chat.ask(q, who=f"foreman:{w.get('name')}", session="foreman")
        answer = r.get("answer") or ""
    except Exception as e:  # noqa: BLE001 — the worker hears the failure, never silence
        answer = f"(the brain could not answer: {e.__class__.__name__})"
    answer = answer.replace("-- Lacuna", "").strip()[:1500]
    _KEPT[_qkey(data)] = (time.time(), answer)
    call("POST", f"/workers/{w.get('id')}/event", {"kind": "brain", "value": answer})


# ── THE SMALL MIND, asked for a foreman (§36, §37.2) ────────────────────────────────────────────────────────────────
GATEWAY = "http://127.0.0.1:11434"
BOX_MINDS = Path(__file__).resolve().parents[3] / "lacuna-box" / "brain" / "box-minds.json"


def _box() -> dict:
    try:
        return json.loads(BOX_MINDS.read_text())
    except (OSError, ValueError):
        return {"agent_minds": ["functiongemma"], "reserved": {}}


def allowed_minds() -> set[str]:
    """The small minds this box lets an agent have, never a reserved one (gemma4:e4b swapped the box 11 GB deep)."""
    box = _box()
    canon = lambda m: str(m).removesuffix(":latest")  # noqa: E731
    reserved = {canon(m) for m in box.get("reserved") or {}}
    return {canon(m) for m in box.get("agent_minds") or []} - reserved


def last_rung() -> str:
    """The cascade's last rung (B50): the 26B, named in box-minds.json."""
    return str(_box().get("last_rung") or "lacuna-worker-lite").removesuffix(":latest")


def _certainty(out: dict):
    """The gateway's token certainty when it gives one (B52: top level, or inside the message); None is unknown."""
    for v in (out.get("certainty"), (out.get("message") or {}).get("certainty")):
        if isinstance(v, (int, float)) and not isinstance(v, bool) and 0 <= v <= 1:
            return float(v)
    return None


def _ask_small(req: dict, timeout: int) -> dict:
    r = urllib.request.Request(f"{GATEWAY}/api/chat", data=json.dumps(req).encode(),
                               headers={"Content-Type": "application/json", "X-Lacuna-Lane": "background", "X-Lacuna-Prefix": "small-mind"})
    with urllib.request.urlopen(r, timeout=timeout) as resp:
        return json.load(resp)


def mind(body: dict) -> dict:
    """One question to one small mind, under the job's grammar. The model must be on the box's list — the foreman's
    choice is checked again here, so no worker reaches a reserved model through its mind. The one exception is the
    cascade's last rung: the 26B, asked only as a rung (`cascade`), under the same grammar, and always in the background
    lane (the gateway keeps the other slot for a person). In shadow mode the box's reading at that step comes back too."""
    model = str(body.get("model") or "").removesuffix(":latest")
    maker = body.get("job") == "maker"                # the Arcade's and the Factory's maker (lane L3): the named model, files out
    rung = (bool(body.get("cascade")) or maker) and model == last_rung()
    if model not in allowed_minds() and not rung:
        return {"ok": False, "why": f"{model or 'no model'} is not a mind this box lets an agent have ({', '.join(sorted(allowed_minds()))})"}
    # B7: a mind is never handed a job above its horizon (box-minds.json `horizon`): too long a prompt is refused, said
    hz = (_box().get("horizon") or {}).get(model) or {}
    est = (len(str(body.get("system") or "")) + len(str(body.get("prompt") or ""))) // 4
    if hz.get("max_in") and est > hz["max_in"] and not rung:
        return {"ok": False, "why": f"the job is above {model}'s horizon: ~{est} tokens handed, {hz['max_in']} at most ({hz.get('job')}) — "
                                    f"narrow the slice, or give the job to a bigger mind", "above_horizon": True}
    req = {"model": model if ":" in model else f"{model}:latest", "stream": False, "think": False,
           **({"adapter": str(body["adapter"])} if body.get("adapter") else {}),       # G18: the job's specialist
           "grammar": body.get("grammar"), "options": {"temperature": 0, "num_predict": maker_verbs.MIND["num_predict"] if maker else 160},
           "messages": [{"role": "system", "content": str(body.get("system") or "")[:4000]},
                        {"role": "user", "content": str(body.get("prompt") or "")[:maker_verbs.MIND["prompt"] if maker else 6000]}]}
    t0 = time.time()
    n = int(body.get("vote") or 0) if not rung else 0
    try:
        if n > 1:
            # G9 THE VOTE: n seeded draws at a working temperature; the majority's answer, its share as the certainty. No
            # majority is no answer — the job hears it unread, never a coin toss passed off as a label
            outs = [_ask_small({**req, "options": {**req["options"], "temperature": 0.7, "seed": 11 + i}}, 50) for i in range(n)]
            texts = [((o.get("message") or {}).get("content") or "").strip() for o in outs]
            top = max(set(texts), key=texts.count)
            agree = texts.count(top)
            if agree * 2 <= n:
                return {"ok": False, "why": f"the vote split ({', '.join(sorted(set(texts)))[:200]})", "vote": {"n": n, "agree": agree}}
            out = {"message": {"content": top}, "certainty": round(agree / n, 3)}
        else:
            out = _ask_small(req, maker_verbs.MIND["timeout"] if maker else 280 if rung else 50)
    except (OSError, ValueError) as e:
        return {"ok": False, "why": f"the small mind did not answer ({e.__class__.__name__})"}
    ans = {"ok": True, "text": ((out.get("message") or {}).get("content") or "").strip(), "model": model,
           "seconds": round(time.time() - t0, 2), "certainty": _certainty(out), **({"vote": {"n": n}} if n > 1 else {})}
    if body.get("shadow"):
        from . import cascade
        ans["box"] = cascade.box_now()
    return ans


def _pairs(x) -> dict:
    """An association list as the foreman sends it ({k: v}, or [[k, v], …]) as a dict; anything else is empty."""
    if isinstance(x, dict):
        return x
    if isinstance(x, list):
        return {str(p[0]): p[1] for p in x if isinstance(p, (list, tuple)) and len(p) == 2}
    return {}


def watchdog_report(data: dict) -> str:
    """The watchdog sweep's report (its cart, CL-H17: a warn when a row turns red, an alert at 3 h red, a clear when green again)
    as a row of the alerts ledger keyed by the watchdog (LACUNA-1.0-FINALE.md D13); it notifies no one. Returns the key."""
    from .workers import raise_alert, resolve_alert
    row = _pairs((data.get("data") or [None])[0])
    name = str(row.get("row") or row.get("name") or "?")
    key = f"watchdog:{name}"
    what = f"{name} ({row.get('mode') or 'red'}): {row.get('reading') or 'no reading'}"[:200]
    if data.get("kind") == "clear":
        resolve_alert(key, f"{name} is green again")
    else:
        raise_alert(key, "error" if data.get("kind") == "alert" else "warn", what, what)
    return key
