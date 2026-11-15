"""Lacuna's HTTP surface for the web console.

Routes:
  GET  /healthz                    — liveness probe
  GET  /ctl/status                 — pid, uptime, recent errors, host info
  GET  /ctl/errors                 — recent captured errors
  POST /ctl/errors/clear           — clear the error log
  POST /ctl/pilot                  — record who's driving (claude/chatgpt/etc)
  GET  /ctl/host                   — host telemetry (cpu/mem/disk)
  GET  /ctl/llm-status             — current LLM backend + key provenance
  GET  /ctl/ai/backends            — per-backend availability matrix
  POST /ctl/ai/reset               — clear 402/429 unhealthy marks
  GET  /ctl/pilot-config           — read ~/.lacuna/pilot.yaml
  POST /ctl/pilot-config           — write ~/.lacuna/pilot.yaml
  GET  /ctl/ai/rag                 — RAG index stats
  GET  /ctl/config                 — effective Lacuna YAML config
  GET  /ctl/playbooks              — list available playbooks
  GET  /ctl/playbooks/{name}       — dry-run a single playbook
  POST /ctl/chat                   — operator ↔ Lacuna chat surface

To run:
  python -m uvicorn lacuna_api.app:app --host 127.0.0.1 --port 1138
"""
from __future__ import annotations

import json
import os
import socket
import time
import urllib.error
import urllib.request
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, StreamingResponse
from pydantic import BaseModel

from lacuna import llm as lacuna_llm
from lacuna import state as lacuna_state
from . import VERSION


ENV  = os.environ.get("LACUNA_ENV",  "dev")
HOST = os.environ.get("LACUNA_HOST", "127.0.0.1")
PORT = int(os.environ.get("LACUNA_PORT", "1138"))


def _lacuna_home() -> Path:
    """Lacuna's persistent state directory. Override via LACUNA_HOME."""
    return Path(os.environ.get("LACUNA_HOME", Path.home() / ".lacuna"))


def _env_file() -> Path | None:
    """The .env file lacuna-api reads for keys / overrides.

    Default: $LACUNA_HOME/.env. Override via LACUNA_ENV_FILE.
    """
    override = os.environ.get("LACUNA_ENV_FILE")
    if override:
        p = Path(override)
        return p if p.exists() else None
    p = _lacuna_home() / ".env"
    return p if p.exists() else None


def _probe_port(port: int, host: str = "127.0.0.1", timeout: float = 0.2) -> bool:
    """Return True if `host:port` accepts a TCP connection."""
    try:
        with socket.create_connection((host, port), timeout=timeout):
            return True
    except OSError:
        return False


def _warm_ollama_on_boot() -> None:
    """Best-effort: load the model AND prime its KV cache with the persona
    so the operator's first turn skips prompt-eval entirely.

    The Lacuna persona is ~5k tokens. Prompt-eval on CPU is ~3 tok/s, so
    re-evaluating the persona on every turn would cost ~25 minutes. Ollama
    caches KV state when the system prompt of a new request matches a
    recent one, so we send a one-shot `/api/chat` with the real persona
    here. After that, subsequent operator turns reuse the cached state
    and only pay for the user message + the response.

    Pinning (`keep_alive: -1`) overrides Ollama's default 5-minute idle
    unload, so quiet periods don't re-trigger cold-load.

    Failure is silent — operator falls back to normal cold-load if the
    warmup couldn't run (Ollama down, no the open base tag installed, etc.).
    """
    base = os.environ.get("LACUNA_LOCAL_URL", "http://localhost:11434")
    canonical = os.environ.get("LACUNA_LOCAL_MODEL", "qwen2.5:3b-instruct")
    try:
        with urllib.request.urlopen(f"{base}/api/tags", timeout=2) as r:
            tags = json.loads(r.read()).get("models", [])
        names = [m["name"] for m in tags]
        # Match `lacuna.llm.select_backend` precedence: prefer the canonical
        # tag (the open base:3b-instruct by default; overridable via
        # LACUNA_LOCAL_MODEL), then any other the open base, then gemma, then the
        # first installed. Pinning the canonical model means lacuna.llm's
        # chat path uses the exact tag we warmed.
        if canonical in names:
            model = canonical
        else:
            model = (
                next((n for n in names if "qwen" in n.lower()), None)
                or next((n for n in names if "gemma" in n.lower()), None)
                or (names[0] if names else None)
            )
        if not model:
            return
        # Real persona prompt — this populates Ollama's prompt-eval KV
        # cache so the operator's first turn skips ingestion. Trim to the
        # local-backend budget so the warmup's prefix matches what
        # LocalOllamaBackend will send and the KV cache hits. If loading
        # the persona fails, fall back to a model-only warmup (load
        # weights but don't pre-fill KV).
        try:
            persona = lacuna_llm.trim_for_local(lacuna_llm.load_persona_prompt())
        except Exception:
            persona = ""
        body = json.dumps({
            "model": model,
            "messages": (
                [{"role": "system", "content": persona},
                 {"role": "user", "content": "ready"}]
                if persona else
                [{"role": "user", "content": "ready"}]
            ),
            "stream": False,
            "options": {"num_ctx": 8192, "num_predict": 1},
            "keep_alive": -1,    # pin in RAM until Ollama restarts
        }).encode()
        req = urllib.request.Request(
            f"{base}/api/chat", data=body,
            headers={"Content-Type": "application/json"},
        )
        # Patient timeout: cold-load + persona prompt-eval can be slow on
        # CPU (~30-60s for the 5k-token persona).
        with urllib.request.urlopen(req, timeout=600):
            pass
    except (urllib.error.URLError, OSError, ValueError):
        # Silent: cold-load happens on first operator turn instead.
        pass


@asynccontextmanager
async def _lifespan(app):
    """App lifespan: kick off Ollama model warmup on boot so first-turn
    latency is fast (model already resident) instead of cold-load slow.

    Replaces the deprecated `@app.on_event("startup")` hook. The warmup
    thread is daemon=True so it doesn't block uvicorn shutdown.
    """
    import threading as _threading
    from .control import stacks as _stacks          # `kill -INFO <pid>`: every thread's Python stack to the log (a stall's cause)
    _stacks.arm()
    # The model is loaded on demand, not at boot (Lacuna Beta 2026-09-24: the Studio's 32 GB is shared with both APIs
    # and the simulator). LACUNA_WARMUP=1 restores the boot warm-up.
    if os.environ.get("LACUNA_WARMUP") == "1":
        _threading.Thread(
            target=_warm_ollama_on_boot, daemon=True, name="ollama-warmup"
        ).start()
    from .control import owner_first as _owner_first
    _owner_first.recover()                          # a trainer an earlier API paused for the owner's turn goes on
    from .control import workers as _workers
    _workers.start()
    from .control import rag as _rag                 # the meaning index: built in the background, refreshed every 5 min
    _rag.start()
    # SELF.slat (LACUNA-1.3-DESIGN §37.3, B49): Lacuna writes itself from the live system before its first thought
    from .control import self_portrait as _self_portrait
    _self_portrait.start()
    yield


app = FastAPI(
    title="lacuna-api",
    version=VERSION,
    description="Lacuna's web/console HTTP surface — /ctl/* endpoints.",
    docs_url="/docs",
    redoc_url="/redoc",
    lifespan=_lifespan,
)

# Lacuna web console runs on :2001 in dev. Add others if you stand up other UIs.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:2001"],
    allow_methods=["*"],
    allow_headers=["*"],
)

_BOOT_TS = time.time()

lacuna_state.log_session_event("boot", source="lacuna-api", version=VERSION,
                                env=ENV, port=PORT, pid=os.getpid())


@app.exception_handler(Exception)
async def _capture_unhandled(request: Request, exc: Exception) -> JSONResponse:
    """Any unhandled exception → ~/.lacuna/errors.jsonl + 500 response."""
    lacuna_state.log_exception(
        "lacuna-api",
        exc,
        context={"path": str(request.url.path), "method": request.method},
    )
    return JSONResponse(
        status_code=500,
        content={"detail": f"{type(exc).__name__}: {exc}", "path": str(request.url.path)},
    )


@app.exception_handler(HTTPException)
async def _capture_http_error(request: Request, exc: HTTPException) -> JSONResponse:
    if exc.status_code >= 500:
        lacuna_state.log_error(
            "lacuna-api",
            f"HTTP {exc.status_code}: {exc.detail}",
            context={"path": str(request.url.path), "method": request.method},
        )
    return JSONResponse(status_code=exc.status_code, content={"detail": exc.detail})


# ── liveness ────────────────────────────────────────────────────────────────

@app.get("/healthz", tags=["ops"])
def healthz() -> dict:
    return {"ok": True, "service": "lacuna-api", "version": VERSION}


# ── /ctl/status ─────────────────────────────────────────────────────────────

@app.get("/ctl/status", tags=["ctl"])
def ctl_status() -> dict:
    """What is Lacuna right now? state, uptime, recent errors, companions."""
    errors = lacuna_state.recent_errors(5)
    last_boot = lacuna_state.last_boot()
    state_cache = lacuna_state.read_state()

    uptime_s = int(time.time() - _BOOT_TS)

    companions = {
        "ollama": {"port": 11434, "status": "up" if _probe_port(11434) else "down"},
        "web":    {"port": 2001,  "status": "up" if _probe_port(2001)  else "down"},
    }

    cwd = os.getcwd()
    git_branch = None
    try:
        import subprocess as _sp
        r = _sp.run(["git", "branch", "--show-current"],
                    capture_output=True, text=True, timeout=0.3, cwd=cwd)
        if r.returncode == 0 and r.stdout.strip():
            git_branch = r.stdout.strip()
    except Exception:
        pass

    user = ""
    hostname = ""
    try:
        import getpass as _gp
        import platform as _pl
        user = _gp.getuser()
        hostname = _pl.node().split(".")[0]
    except Exception:
        pass

    return {
        "version": VERSION,
        "service": "lacuna-api",
        "env": ENV,
        "host": HOST,
        "port": PORT,
        "pid": os.getpid(),
        "uptime_seconds": uptime_s,
        "pilot": state_cache.get("pilot", "human"),
        "last_boot": last_boot,
        "recent_errors": errors,
        "error_count": len(errors),
        "companions": companions,
        "cwd": cwd,
        "git_branch": git_branch,
        "user": user,
        "hostname": hostname,
    }


# ── errors ─────────────────────────────────────────────────────────────────

@app.get("/ctl/errors", tags=["ctl"])
def ctl_errors(limit: int = 50) -> dict:
    """Recent captured errors with tracebacks. Newest-first."""
    errors = lacuna_state.recent_errors(limit)
    return {"count": len(errors), "errors": errors}


@app.post("/ctl/errors/clear", tags=["ctl"])
def ctl_clear_errors() -> dict:
    n = lacuna_state.clear_errors()
    return {"cleared": n}


# ── pilot ──────────────────────────────────────────────────────────────────

class PilotRequest(BaseModel):
    pilot: str  # 'claude' | 'chatgpt' | 'deepseek' | 'human' | etc.


@app.post("/ctl/pilot", tags=["ctl"])
def ctl_set_pilot(body: PilotRequest) -> dict:
    """Record who's driving."""
    lacuna_state.set_pilot(body.pilot)
    lacuna_state.log_session_event("pilot-connect", pilot=body.pilot)
    return {"pilot": body.pilot, "ok": True}


# ── host ───────────────────────────────────────────────────────────────────

@app.get("/ctl/host", tags=["ctl"])
def ctl_host() -> dict:
    """Live host telemetry. Reads $LACUNA_HOME/host.cache (refreshed by daemon)."""
    cache = _lacuna_home() / "host.cache"
    out = {"cpu": 0, "mem": 0, "disk": 0, "stale": True}
    if cache.exists():
        try:
            age = time.time() - cache.stat().st_mtime
            text = cache.read_text(errors="replace").strip()
            for token in text.split():
                if "=" in token:
                    k, v = token.split("=", 1)
                    if k in out and v.isdigit():
                        out[k] = int(v)
            out["stale"] = age > 30
            out["age_seconds"] = round(age, 1)
        except OSError:
            pass
    return out


# ── llm ────────────────────────────────────────────────────────────────────

@app.get("/ctl/llm-status", tags=["ctl"])
def ctl_llm_status() -> dict:
    """Current LLM backend + key provenance. Pure introspection — no network."""
    return lacuna_llm.describe_backend(_env_file())


@app.get("/ctl/ai/backends", tags=["ctl"])
def ctl_ai_backends() -> dict:
    env = lacuna_llm._read_env_keys(_env_file())
    reachable, models = lacuna_llm.probe_ollama()
    backends = [{
        "name": "local",
        "available": reachable,
        "note": (f"Ollama · {len(models)} model(s)" if reachable else "Ollama not running"),
        "details": {"installed_models": models} if reachable else {},
    }]
    for name in ("deepseek", "anthropic", "openai"):
        spec = lacuna_llm._BACKEND_REGISTRY[name]
        has_key = bool(env.get(spec[0], "").strip())
        unhealthy = name in lacuna_llm._UNHEALTHY
        backends.append({
            "name": name,
            "available": has_key and not unhealthy,
            "note": ("no key" if not has_key else
                     "unhealthy this process (402/429)" if unhealthy else
                     "ready"),
            "details": {},
        })
    backends.append({"name": "echo", "available": True, "note": "always (offline)", "details": {}})
    return {"backends": backends}


@app.post("/ctl/ai/reset", tags=["ctl"])
def ctl_ai_reset(body: dict | None = None) -> dict:
    """Clear unhealthy marks (402/429). Pass {'backend': name} to clear one."""
    target = (body or {}).get("backend") if body else None
    before = sorted(lacuna_llm._UNHEALTHY)
    lacuna_llm.clear_unhealthy(target)
    after = sorted(lacuna_llm._UNHEALTHY)
    cleared = [b for b in before if b not in after]
    return {"cleared": cleared, "still_unhealthy": after}


# ── pilot-config (~/.lacuna/pilot.yaml) ────────────────────────────────────

@app.get("/ctl/pilot-config", tags=["ctl"])
def ctl_pilot_config() -> dict:
    cfg = lacuna_llm._read_pilot_config()
    return {
        "pilot": cfg["pilot"],
        "copilot": cfg["copilot"],
        "mode": cfg["mode"],
        "valid_backends": ["local", "deepseek", "anthropic", "openai", "echo"],
        "valid_modes": ["solo", "fallback", "race"],
    }


class PilotConfigRequest(BaseModel):
    pilot: str
    copilot: str
    mode: str


@app.post("/ctl/pilot-config", tags=["ctl"])
def ctl_pilot_config_set(body: PilotConfigRequest) -> dict:
    try:
        lacuna_llm.write_pilot_config(body.pilot, body.copilot, body.mode)
    except ValueError as e:
        return {"ok": False, "error": str(e)}
    return {"ok": True, "pilot": body.pilot, "copilot": body.copilot, "mode": body.mode}


# ── rag / config / playbooks ───────────────────────────────────────────────

@app.get("/ctl/ai/rag", tags=["ctl"])
def ctl_ai_rag_status() -> dict:
    try:
        from lacuna import rag as lacuna_rag
    except ImportError:
        return {"exists": False, "note": "lacuna.rag not importable"}
    return lacuna_rag.index_stats()


@app.get("/ctl/config", tags=["ctl"])
def ctl_config() -> dict:
    try:
        from lacuna import config as lacuna_cfg
    except ImportError:
        return {"available": False}
    cfg = lacuna_cfg.load_config()
    return {
        "available": True,
        "ollama":   {"enabled": cfg.ollama.enabled, "url": cfg.ollama.url, "models": cfg.ollama.models},
        "backends": {"precedence": cfg.backends.precedence},
        "copilot":  {"enabled": cfg.copilot.enabled, "provider": cfg.copilot.provider},
        "team":     {"roster_file": cfg.team.roster_file, "anonymous_enabled": cfg.team.anonymous_enabled},
        "playbooks": {"dir": cfg.playbooks.dir, "allowlist": cfg.playbooks.allowlist},
    }


@app.get("/ctl/playbooks", tags=["ctl"])
def ctl_playbooks() -> dict:
    try:
        from lacuna import playbooks as lacuna_pb
    except ImportError:
        return {"playbooks": []}
    return {"playbooks": lacuna_pb.list_playbooks()}


@app.get("/ctl/playbooks/{name}", tags=["ctl"])
def ctl_playbook_detail(name: str) -> dict:
    try:
        from lacuna import playbooks as lacuna_pb
    except ImportError:
        raise HTTPException(status_code=503, detail="lacuna.playbooks not importable")
    plan = lacuna_pb.dry_run(name)
    if not plan.get("ok"):
        raise HTTPException(status_code=404, detail=plan.get("error", "playbook not found"))
    return plan


# ── /ctl/chat — operator ↔ Lacuna chat ─────────────────────────────────────

class CtlChatMessage(BaseModel):
    role: str
    content: str


class CtlChatRequest(BaseModel):
    messages: list[CtlChatMessage]


@app.post("/ctl/chat", tags=["ctl"])
def ctl_chat(body: CtlChatRequest):
    """Operator chat. Uses Lacuna's persona + Lacuna's llm pipeline.

    Auto-fallback: if a backend errors (402/429 mark + bracket-prefixed reply),
    re-select once. The bracket-marker means lacuna.llm has already updated
    _UNHEALTHY, so the next select_backend() will skip the bad backend.
    """
    if not body.messages:
        return {"role": "assistant", "content": "(empty conversation)", "cards": []}

    env_file = _env_file()
    system = lacuna_llm.load_persona_prompt()
    history = [{"role": m.role, "content": m.content} for m in body.messages
               if m.role in ("user", "assistant")]

    backend = lacuna_llm.select_backend(env_file)
    reply = None
    fellback_from = None
    for _attempt in range(2):
        reply = backend.chat(system, history)
        if not (reply.startswith("[") and "]" in reply[:20]):
            break
        # error reply — try the next backend in precedence
        fellback_from = backend.info.name
        backend = lacuna_llm.select_backend(env_file)
        if backend.info.name == fellback_from:
            break  # nothing else to try

    if fellback_from and backend.info.name != fellback_from:
        reply = f"{reply}\n\n*(switched to {backend.info.name} — {fellback_from} unavailable)*"

    return {"role": "assistant", "content": reply, "cards": []}


# ── LACUNA BETA — the Studio's control plane on this same port (2026-09-24) ─────────────────────────────────────────
# /api/* and /ws/* are the control plane (lacuna_api/control/); / is the console page (lacuna_api/console/). Mounted
# last so every route above keeps priority.
from fastapi.staticfiles import StaticFiles as _StaticFiles  # noqa: E402

from .control.api import router as _control_router  # noqa: E402

from .control.guard import Door as _Door  # noqa: E402

app.add_middleware(_Door)
# the console's own files are always revalidated: a phone that kept an old module beside a new one broke the chat
# (Chrome on iOS, 2026-09-26); the vendored libraries never change and keep their long cache
@app.middleware("http")
async def _console_no_cache(request, call_next):
    resp = await call_next(request)
    path = request.url.path
    if (path.startswith("/js/") or path in ("/", "/index.html", "/app.css", "/manifest.json")) and "/vendor/" not in path:
        resp.headers["Cache-Control"] = "no-cache"
    return resp


app.include_router(_control_router)
from .control.desk_reads import router as _desk_reads_router; app.include_router(_desk_reads_router)  # noqa: E402,E702
# the house typefaces for Lacuna's home: Curator's own folder, read in place (one copy of every font, never two)
_FONTS = Path.home() / "code" / "curator" / "curator-web" / "public" / "fonts"
if _FONTS.is_dir():
    app.mount("/fonts", _StaticFiles(directory=str(_FONTS)), name="fonts")
app.mount("/", _StaticFiles(directory=str(Path(__file__).parent / "console"), html=True), name="console")
