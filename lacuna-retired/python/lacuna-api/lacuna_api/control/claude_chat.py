"""CLAUDE'S CHAT ON THE DESK (the owner, 2026-10-18: "where's my Claude chat? … I have Claude up there in the corner. What
if I could talk to him … he's hot loaded with what's going on … I can do all my Claude coding from this interface … I'll be
able to switch between the API or this one, different models"; "How many tokens are we using for Claude? How far is
Claude's context?").

Two engines, one stream:
  code   Claude Code itself, headless (`claude -p --output-format stream-json`), in ~/code, on the owner's own login
         (his plan): files, the shell, agents — Claude Code's own permission mode decides what runs without asking
         (plan · default · acceptEdits; never bypass from here). A conversation resumes by its session id.
  api    the Messages API with the dev key (~/.curator-dev/secrets/ANTHROPIC_API_KEY, read here, never sent anywhere
         but Anthropic, never shown): talk only, no tools.
HOT-LOADED: every turn carries the desk as it stands (the open card, alerts, presses waiting, workers running, the
ledger's head) as an appended system prompt — what is going on, not a transcript.
THE METER: each turn's usage comes back — tokens in (with cache reads), out, cost when the engine says it, and how full
the context is against the model's window.

OWNER ONLY. This is a shell on this Mac by another name. On the Mac's own desk (loopback, the console's origin) it
answers; from anywhere else (the phone's https door, the LAN) every turn must carry the paired device's signature over
"claude:<sha256(text)[:16]>" (owner.py's press scheme) — a token alone is not enough.

  POST /api/claude/say      {text, engine, model, session?, permission?, card?}  → text/event-stream of JSON events:
                            {kind: start|text|tool|agent|tool-done|done|error, …}
  POST /api/claude/stop     {run}       ends a running turn
  GET  /api/claude/state    engines, models, the runs going now, recent sessions with their meters
"""
from __future__ import annotations

import hashlib
import json
import os
import subprocess
import threading
import time
import urllib.request
import uuid
from pathlib import Path

from fastapi import APIRouter, Request
from fastapi.responses import JSONResponse, StreamingResponse

from .core import LACUNA_HOME, audit

router = APIRouter()

CLAUDE = os.environ.get("LACUNA_CLAUDE_BIN") or "/opt/homebrew/bin/claude"
CWD = Path.home() / "code"
SESSIONS = LACUNA_HOME / "claude-chat.json"
KEY_FILE = Path.home() / ".curator-dev" / "secrets" / "ANTHROPIC_API_KEY"
MODELS = {   # id → (name, context window in tokens)
    "claude-opus-5-5": ("Opus 5.5", 1_000_000),
    "claude-sonnet-5-5": ("Sonnet 5.5", 1_000_000),
    "claude-haiku-4-5-20251001": ("Haiku 4.5", 200_000),
    "claude-fable-5-1": ("Fable 5.1", 1_000_000),
}
PERMISSIONS = ("plan", "default", "acceptEdits")
_runs: dict[str, subprocess.Popen] = {}
_lock = threading.Lock()


# ── who may speak ────────────────────────────────────────────────────────────────────────────────────────────────────

def allowed(request: Request, text: str) -> tuple[bool, str]:
    from . import owner
    from .guard import local, origin_ok, token_ok, token
    if not origin_ok(request.headers.get("origin"), request.headers.get("host")):
        return False, "only the console's own page may talk to Claude"
    if local(request.client.host if request.client else None):
        return True, "this Mac"
    got = request.headers.get("x-lacuna-token") or request.cookies.get("lacuna_token")
    if got and token_ok(got, token()):
        return True, "ingress token"
    pid = "claude:" + hashlib.sha256(text.encode()).hexdigest()[:16]
    by, why = owner.check(pid, True, {"sig": request.headers.get("x-lacuna-owner"), "t": request.headers.get("x-lacuna-owner-t"),
                                      "device": request.headers.get("x-lacuna-device")})
    return (True, by) if by else (False, f"Claude's chat off this Mac needs a paired device: {why}")


# ── the desk, hot-loaded ─────────────────────────────────────────────────────────────────────────────────────────────

# video B12 (2026-10-31): this session reads the same memory and records the lead's sessions write, so it said "I landed
# W1.1–W1.6" for work it never did. First person only with a ticket: other sessions' work is said as the record says it.
RECORD_RULE = ("Your memory and the repository hold work that other sessions did (the lead's and the lanes'), not this one. "
               "Say it as the record says it, with its date and its age: \"the record says W1.1 landed at 01:20, 10 h ago\". "
               "Say \"I\" only for what this session did, with its run, ticket or commit.")


def desk_context(card: str | None) -> str:
    """What is going on, in a few lines — the owner's desk as it stands right now."""
    lines = [f"You are Claude, talking with the owner from the Lacuna desk (Lacuna Labs' control plane on his Mac Studio, "
             f"http://127.0.0.1:1138/home/). Now: {time.strftime('%Y-%m-%d %H:%M %Z')}."]
    if card:
        lines.append(f"He has the card {card} open.")
    try:
        from . import chat, workers
        waiting = [p for p in chat.petitions() if p.get("state") == "waiting"]
        lines.append(f"Waiting on his press: {len(waiting)}" + (": " + "; ".join(f"{p['id']} {p['action']}" for p in waiting[:5]) if waiting else ""))
        al = workers.alerts(8)
        if al:
            lines.append("Recent alerts: " + "; ".join(f"[{a.get('level')}] {a.get('title')}" for a in al[:6]))
    except Exception:  # noqa: BLE001
        pass
    try:
        from . import foreman
        fm = foreman.call("GET", "/tree", timeout=2)
        run = [n for n in (fm.get("nodes") or []) if n.get("state") == "running"]
        lines.append(f"Lacuna's foreman: {len(run)} running" + (": " + ", ".join(n.get("name", "?") for n in run[:8]) if run else ""))
    except Exception:  # noqa: BLE001
        pass
    led = sorted((Path.home() / "code" / "lacuna" / "docs").glob("LEDGER-*.md"))
    if led:
        heads = [ln.strip("# ").strip() for ln in led[-1].read_text(errors="replace").splitlines() if ln.startswith("## ")][:6]
        lines.append(f"The work ledger ({led[-1].name}) sections: " + " | ".join(heads))
    lines.append("Rules that hold here: dev never reaches production; QA, her iPad and ~/.curator are read-only unless he asks; "
                 "releases and promotes are his press; never sign with the owner key or approve a card yourself; commit by pathspec.")
    lines.append(RECORD_RULE)
    return "\n".join(lines)


# ── sessions and the meter ───────────────────────────────────────────────────────────────────────────────────────────

def _load() -> dict:
    try:
        return json.loads(SESSIONS.read_text())
    except (OSError, ValueError):
        return {"sessions": {}}


def _save(d: dict) -> None:
    SESSIONS.parent.mkdir(parents=True, exist_ok=True)
    tmp = SESSIONS.with_suffix(".tmp")
    tmp.write_text(json.dumps(d, indent=1))
    tmp.replace(SESSIONS)


def meter(model: str, usage: dict) -> dict:
    """tokens in this turn's context (input + cache reads + cache writes), out, and how full the window is"""
    u = usage or {}
    ctx = int(u.get("input_tokens") or 0) + int(u.get("cache_read_input_tokens") or 0) + int(u.get("cache_creation_input_tokens") or 0)
    window = MODELS.get(model, ("", 200_000))[1]
    return {"context": ctx, "out": int(u.get("output_tokens") or 0), "cached": int(u.get("cache_read_input_tokens") or 0),
            "window": window, "full": round(ctx / window, 4) if window else None}


def _remember(sid: str, engine: str, model: str, text: str, m: dict, cost: float | None, extra: dict | None = None) -> None:
    with _lock:
        d = _load()
        s = d["sessions"].setdefault(sid, {"id": sid, "engine": engine, "model": model, "title": text[:80], "started": time.time(),
                                           "turns": 0, "tokens_out": 0, "cost": 0.0})
        s.update({"last": time.time(), "model": model, "meter": m, "turns": s.get("turns", 0) + 1,
                  "tokens_out": s.get("tokens_out", 0) + m.get("out", 0), "cost": round((s.get("cost") or 0) + (cost or 0), 4), **(extra or {})})
        _save(d)


# ── the engines ──────────────────────────────────────────────────────────────────────────────────────────────────────

def _ev(**k) -> bytes:
    return (json.dumps(k, default=str) + "\n").encode()


def _code(run: str, text: str, model: str, session: str | None, permission: str, ctx: str):
    """Claude Code headless: its stream-json events, folded into the desk's few kinds"""
    cmd = [CLAUDE, "-p", "--output-format", "stream-json", "--verbose", "--model", model, "--permission-mode", permission,
           "--append-system-prompt", ctx]
    if session:
        cmd += ["--resume", session]
    env = {**os.environ, "PATH": f"/opt/homebrew/bin:/usr/local/bin:{os.environ.get('PATH', '/usr/bin:/bin')}"}
    p = subprocess.Popen(cmd, cwd=CWD, stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True, env=env, start_new_session=True)
    with _lock:
        _runs[run] = p
    p.stdin.write(text)
    p.stdin.close()
    sid, agents = session, {}
    try:
        for line in p.stdout:
            try:
                e = json.loads(line)
            except ValueError:
                continue
            t = e.get("type")
            if t == "system" and e.get("subtype") == "init":
                sid = e.get("session_id") or sid
                yield _ev(kind="start", run=run, session=sid, model=e.get("model") or model, tools=len(e.get("tools") or []))
            elif t == "assistant":
                for c in (e.get("message") or {}).get("content") or []:
                    if c.get("type") == "text" and c.get("text"):
                        yield _ev(kind="text", text=c["text"])
                    elif c.get("type") == "tool_use":
                        name = c.get("name")
                        inp = c.get("input") or {}
                        if name in ("Task", "Agent"):
                            agents[c.get("id")] = inp.get("description") or inp.get("subagent_type") or "an agent"
                            yield _ev(kind="agent", id=c.get("id"), what=agents[c.get("id")], running=len(agents))
                        else:
                            yield _ev(kind="tool", id=c.get("id"), name=name, what=_brief(name, inp))
            elif t == "user":
                for c in (e.get("message") or {}).get("content") or []:
                    if isinstance(c, dict) and c.get("type") == "tool_result":
                        done_agent = agents.pop(c.get("tool_use_id"), None)
                        yield _ev(kind="tool-done", id=c.get("tool_use_id"), error=bool(c.get("is_error")), agent=bool(done_agent), running=len(agents))
            elif t == "result":
                sid = e.get("session_id") or sid
                m = meter(model, e.get("usage") or {})
                _remember(sid or run, "code", model, text, m, e.get("total_cost_usd"), {"permission": permission})
                yield _ev(kind="done", session=sid, meter=m, cost=e.get("total_cost_usd"), turns=e.get("num_turns"),
                          ms=e.get("duration_ms"), error=e.get("is_error"), result=(e.get("result") or "")[:200] if e.get("is_error") else None)
        p.wait(timeout=10)
        if p.returncode not in (0, None) and p.returncode != -15:
            err = (p.stderr.read() or "")[-600:]
            if err.strip():
                yield _ev(kind="error", why=err.strip())
    finally:
        with _lock:
            _runs.pop(run, None)


def _brief(name: str, inp: dict) -> str:
    for k in ("command", "file_path", "path", "pattern", "url", "query", "description", "prompt"):
        if inp.get(k):
            return f"{k}: {str(inp[k])[:140]}"
    return json.dumps(inp)[:140]


def _api(run: str, text: str, model: str, session: str | None, ctx: str):
    """the Messages API, streamed: talk only. The conversation is kept here (the API keeps none)."""
    try:
        key = KEY_FILE.read_text().strip()
    except OSError:
        yield _ev(kind="error", why="no API key on this Mac (~/.curator-dev/secrets/ANTHROPIC_API_KEY)")
        return
    sid = session or f"api-{uuid.uuid4().hex[:10]}"
    hist_file = LACUNA_HOME / "claude-api" / f"{sid}.json"
    try:
        hist = json.loads(hist_file.read_text())
    except (OSError, ValueError):
        hist = []
    hist.append({"role": "user", "content": text})
    yield _ev(kind="start", run=run, session=sid, model=model, tools=0)
    body = json.dumps({"model": model, "max_tokens": 8000, "system": ctx, "messages": hist[-40:], "stream": True}).encode()
    req = urllib.request.Request("https://api.anthropic.com/v1/messages", data=body, method="POST",
                                 headers={"x-api-key": key, "anthropic-version": "2023-06-01", "content-type": "application/json"})
    out, usage = [], {}
    try:
        with urllib.request.urlopen(req, timeout=300) as r:          # one call, no retry (the outside-sites rule)
            for raw in r:
                line = raw.decode("utf-8", "replace").strip()
                if not line.startswith("data:"):
                    continue
                e = json.loads(line[5:])
                if e.get("type") == "message_start":
                    usage.update((e.get("message") or {}).get("usage") or {})
                elif e.get("type") == "content_block_delta" and (e.get("delta") or {}).get("text"):
                    out.append(e["delta"]["text"])
                    yield _ev(kind="text", text=e["delta"]["text"], delta=True)
                elif e.get("type") == "message_delta":
                    usage.update(e.get("usage") or {})
    except Exception as ex:  # noqa: BLE001
        yield _ev(kind="error", why=f"the API refused or failed once: {str(ex)[:300]} — not retried")
        return
    hist.append({"role": "assistant", "content": "".join(out)})
    hist_file.parent.mkdir(parents=True, exist_ok=True)
    hist_file.write_text(json.dumps(hist))
    m = meter(model, usage)
    _remember(sid, "api", model, text, m, None)
    yield _ev(kind="done", session=sid, meter=m, cost=None, turns=1)


# ── the routes ───────────────────────────────────────────────────────────────────────────────────────────────────────

@router.post("/api/claude/say")
async def r_say(request: Request):
    body = await request.json()
    text = str(body.get("text") or "").strip()
    if not text:
        return JSONResponse({"ok": False, "why": "say something"}, status_code=400)
    ok, by = allowed(request, text)
    if not ok:
        return JSONResponse({"ok": False, "why": by}, status_code=403)
    engine = "api" if body.get("engine") == "api" else "code"
    model = body.get("model") if body.get("model") in MODELS else "claude-opus-5-5"
    permission = body.get("permission") if body.get("permission") in PERMISSIONS else "default"
    session = str(body.get("session") or "") or None
    run = uuid.uuid4().hex[:10]
    audit(by, "claude.say", engine=engine, model=model, permission=permission, session=session, chars=len(text))
    ctx = desk_context(body.get("card"))
    gen = _code(run, text, model, session, permission, ctx) if engine == "code" else _api(run, text, model, session, ctx)
    return StreamingResponse(gen, media_type="application/x-ndjson", headers={"cache-control": "no-store", "x-accel-buffering": "no"})


@router.post("/api/claude/stop")
async def r_stop(request: Request):
    body = await request.json()
    ok, by = allowed(request, f"stop:{body.get('run')}")
    if not ok:
        return JSONResponse({"ok": False, "why": by}, status_code=403)
    with _lock:
        p = _runs.get(str(body.get("run")))
    if not p:
        return {"ok": False, "why": "no such run going"}
    try:
        os.killpg(p.pid, 15)
    except OSError:
        p.terminate()
    audit(by, "claude.stop", run=body.get("run"))
    return {"ok": True}


@router.get("/api/claude/state")
def r_state() -> dict:
    d = _load()
    sess = sorted(d.get("sessions", {}).values(), key=lambda s: s.get("last") or 0, reverse=True)[:20]
    return {"engines": {"code": Path(CLAUDE).exists(), "api": KEY_FILE.exists()},
            "models": [{"id": k, "name": v[0], "window": v[1]} for k, v in MODELS.items()],
            "permissions": list(PERMISSIONS), "running": list(_runs.keys()), "sessions": sess}


@router.get("/api/claude/context")
def r_context(card: str | None = None) -> dict:
    """exactly what the next turn will carry as the desk (the shaper's "show what Claude reads")"""
    return {"text": desk_context(card or None)}
