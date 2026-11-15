"""LLM backend abstraction for Lacuna chat.

Lacuna's chat behavior is defined by `persona_prompt.md`; the backend is
pluggable. v2.2 adds local-first routing via Ollama so reasoning 402s stop
mattering. Cloud is fallback only.

Supported backends
    local       — Ollama on localhost:11434 (cloud assist-compatible API)
                  uses LACUNA_LOCAL_MODEL (default: the open base:3b-instruct;
                  fallback prefers any installed the open base tag, then gemma)
                  no key required
    google      — Google AI Studio (Generative Language API). Supports the
                  Gemma family (free on the AI Studio free tier) and cloud assist.
                  Default model: gemma-3-27b-it.
                  requires GOOGLE_API_KEY
    deepseek    — api.deepseek.com, model deepseek-chat
                  requires DEEPSEEK_API_KEY
    anthropic   — api.anthropic.com, model claude-haiku/sonnet
                  requires ANTHROPIC_API_KEY
    openai      — api.openai.com, model gpt-4o-mini
                  requires OPENAI_API_KEY
    echo        — local echo (no network) — useful for offline dev +
                  as the fallback when nothing else is available

Env controls
    LACUNA_LLM_BACKEND    — if set, explicitly forces the backend choice
                            (local | google | deepseek | anthropic | openai | echo)
    LACUNA_LLM_MODEL      — override the default model id for the chosen
                            backend
    LACUNA_LOCAL_URL      — Ollama URL (default http://localhost:11434)
    LACUNA_LOCAL_MODEL    — Ollama model tag (default the open base:3b-instruct)
    <BACKEND>_API_KEY     — key for that cloud backend

Auto-detection precedence when LACUNA_LLM_BACKEND is not set:
    1. local             → Ollama if reachable on LACUNA_LOCAL_URL
    2. DEEPSEEK_API_KEY  → deepseek (Lacuna prefers deepseek's reasoning
                            tier; google sits behind as second cloud)
    3. GOOGLE_API_KEY    → google (Gemma free, used as cloud fallback)
    4. ANTHROPIC_API_KEY → anthropic
    5. OPENAI_API_KEY    → openai
    6. echo (offline)

Auto-fallback on 402 / 429
    A backend that returns 402 (out of credits) or 429 (rate limited)
    is marked unhealthy for the rest of the process. select_backend()
    skips unhealthy backends and tries the next in precedence — the
    user gets a real answer instead of an error string. /ctl/llm-status
    still surfaces the 402 history so the operator can see what happened.

Why this exists
    Alfred wanted deep reasoning, ChatGPT, reasoning pluggable. v2.2 adds local
    so the same machine that runs sibling can answer chat without a
    cloud round-trip — and so reasoning 402 stops blocking the pipeline.
"""
from __future__ import annotations

import json
import os
import ssl
import urllib.error
import urllib.request
from dataclasses import dataclass
from pathlib import Path


_PROMPT_PATH = Path(__file__).resolve().parent / "persona_prompt.md"


def trim_for_local(system: str, budget_chars: int = 6000) -> str:
    """Cap a system prompt to fit Ollama's prompt-eval window on CPU.

    Prompt-eval rate for a 3B model on Intel-Mac CPU is roughly 200-1000
    tok/s depending on KV cache state; Ollama's own server timeout is
    10 minutes. The Lacuna v1 persona is ~5k tokens and can blow past
    that timeout cold. Trimming at a paragraph boundary preserves the
    top-of-file sections (Protocol, Voice register, Output discipline)
    that carry the operational register, dropping later quality-of-life
    sections.

    Used by LocalOllamaBackend and the boot-time warmup hook so both
    sides share the same prompt prefix and Ollama can hit the KV cache
    on the first operator turn.
    """
    if budget_chars <= 0 or len(system) <= budget_chars:
        return system
    cut = system.rfind("\n\n", 0, budget_chars)
    return system[:cut] if cut > 0 else system[:budget_chars]


def load_persona_prompt(name: str | None = None) -> str:
    """Load a persona system prompt.

    Resolution order:
      1. If `name` is given and `personas/{name}.md` exists, return it.
      2. Else if `personas/lacuna.md` exists (v1 sealed persona), return it.
      3. Else fall back to legacy `persona_prompt.md`.
      4. Else return the inline safety stub.
    """
    here = _PROMPT_PATH.parent
    if name:
        named = here / "personas" / f"{name}.md"
        if named.exists():
            return named.read_text()
    sealed = here / "personas" / "lacuna.md"
    if sealed.exists():
        return sealed.read_text()
    if _PROMPT_PATH.exists():
        return _PROMPT_PATH.read_text()
    return (
        "You are Lacuna, the operator daemon. "
        "Refuse off-domain requests. The chat-avatar prefix is your "
        "speaker label; do not append a sign-off (per Canon v0.3.13)."
    )


def _ssl_ctx() -> ssl.SSLContext:
    """macOS stdlib ssl lacks CA bundle; prefer certifi when available."""
    try:
        import certifi
        return ssl.create_default_context(cafile=certifi.where())
    except ImportError:
        return ssl.create_default_context()


# ── backend interface ────────────────────────────────────────────────────────

@dataclass
class BackendInfo:
    name: str          # "local" | "deepseek" | "anthropic" | "openai" | "echo"
    model: str
    available: bool
    note: str = ""     # human-readable explanation


class Backend:
    info: BackendInfo

    def chat(self, system: str, messages: list[dict]) -> str:
        """Take a system prompt + conversation history, return the reply."""
        raise NotImplementedError

    def chat_stream(self, system: str, messages: list[dict]):
        """Yield reply tokens as they arrive. Default: yield the full chat()
        result as one token (subclasses override for true streaming)."""
        yield self.chat(system, messages)


# ── echo (offline fallback) ──────────────────────────────────────────────────

class EchoBackend(Backend):
    def __init__(self) -> None:
        self.info = BackendInfo(
            name="echo", model="local",
            available=True,
            note="no LLM keys found — running offline echo fallback",
        )

    def chat(self, system: str, messages: list[dict]) -> str:
        if not messages:
            return "(echo) nothing to say."
        last = messages[-1]["content"]
        return (
            f"(echo) I heard: {last!r}\n"
            f"No LLM key is configured, so I'm repeating you back. "
            f"Set DEEPSEEK_API_KEY (or ANTHROPIC_API_KEY / OPENAI_API_KEY) to unlock real replies."
        )


# ── Local (Ollama) ───────────────────────────────────────────────────────────

# Local Ollama timeout. Cold-load of a Gemma 4B model on Intel-Mac CPU
# can hit 9 minutes (operator's box, 2026-04-28). Once warm, calls return
# in seconds. Generous timeout so first-hit cold-loads don't trip the
# unhealthy fallback into a paid cloud backend.
LOCAL_TIMEOUT_S = 600


class LocalOllamaBackend(Backend):
    """Talk to a local Ollama daemon over its native /api/chat endpoint.

    Uses /api/chat (not /v1/chat/completions). The cloud assist-compat shim
    silently drops the `options` field, which forces Ollama's default
    4096-token context. The native endpoint honors options.num_ctx, so
    we can ask for an 8k window.

    Why we cap the system prompt: the open base 2.5-3B on Intel-Mac CPU prompt-evals
    at roughly 200-1000 tok/s depending on cache state. The Lacuna v1
    persona is ~5k tokens, which can take 10+ minutes to evaluate cold —
    long enough that Ollama's own 10-min server timeout fires before
    generation starts. The compact budget here keeps the prompt-eval
    floor under a minute on CPU, and the persona's top sections
    (Protocol, Voice register, Output discipline) carry the operational
    register; later sections (Domain catalog, Off-domain redirects) are
    quality-of-life that the local model can manage without. Cloud
    backends get the full persona — they have no eval budget problem.
    Override via LACUNA_LOCAL_PERSONA_CHARS.

    No key. No cloud round-trip. Falls back to a higher-tier backend if
    Ollama isn't running (the reachability check happens in select_backend
    via probe_ollama, so we only construct this backend when we know it
    answers).
    """

    NUM_CTX = 8192
    NUM_PREDICT = 256
    # ~6000 chars ≈ 1500 tokens — captures the persona prelude through
    # output-discipline + shells. Anything above the first `## Domain`
    # heading is preserved.
    DEFAULT_PERSONA_CHARS = 6000

    def __init__(self, base_url: str, model: str) -> None:
        self._base = base_url.rstrip("/")
        self.info = BackendInfo(name="local", model=model, available=True,
                                note=f"Ollama · {model}")

    @property
    def url(self) -> str:
        return f"{self._base}/api/chat"

    def _trim_system(self, system: str) -> str:
        """Delegate to module-level `trim_for_local` so the warmup hook
        and chat path share one truncation policy. Override budget via
        LACUNA_LOCAL_PERSONA_CHARS."""
        try:
            budget = int(os.environ.get("LACUNA_LOCAL_PERSONA_CHARS",
                                        self.DEFAULT_PERSONA_CHARS))
        except ValueError:
            budget = self.DEFAULT_PERSONA_CHARS
        return trim_for_local(system, budget)

    def _build_payload(self, system: str, messages: list[dict], *, stream: bool) -> bytes:
        return json.dumps({
            "model": self.info.model,
            "messages": [{"role": "system", "content": self._trim_system(system)}] + messages,
            "stream": stream,
            "options": {
                "num_ctx": self.NUM_CTX,
                "num_predict": self.NUM_PREDICT,
            },
        }).encode()

    def chat(self, system: str, messages: list[dict]) -> str:
        req = urllib.request.Request(
            self.url, data=self._build_payload(system, messages, stream=False),
            headers={"Content-Type": "application/json"},
        )
        try:
            with urllib.request.urlopen(req, timeout=LOCAL_TIMEOUT_S) as resp:
                data = json.loads(resp.read())
            _http_hint(200, "local")
            return (data.get("message") or {}).get("content", "").strip()
        except urllib.error.HTTPError as e:
            return f"[local {e.code}] {_http_hint(e.code, 'local')}"
        except Exception as e:
            # Timeout or socket error — mark unhealthy so the retry loop in
            # /ctl/chat skips local and lands on the next backend.
            _UNHEALTHY.add("local")
            return f"[local connection error] {e}"

    def chat_stream(self, system: str, messages: list[dict]):
        """Stream tokens from Ollama's native /api/chat endpoint.

        Each line is a JSON object with shape
        ``{"message": {"content": "..."}, "done": bool}``. First-token
        typically <1s on this Mac; total reply time roughly the same as
        chat() but the operator sees output incrementally.

        On error: yields a single bracket-prefixed error string and marks
        local unhealthy (matches chat() semantics).
        """
        req = urllib.request.Request(
            self.url, data=self._build_payload(system, messages, stream=True),
            headers={"Content-Type": "application/json"},
        )
        try:
            with urllib.request.urlopen(req, timeout=LOCAL_TIMEOUT_S) as resp:
                for raw_line in resp:
                    line = raw_line.decode(errors="replace").strip()
                    if not line:
                        continue
                    try:
                        chunk = json.loads(line)
                    except json.JSONDecodeError:
                        continue
                    delta = (chunk.get("message") or {}).get("content")
                    if delta:
                        yield delta
                    if chunk.get("done"):
                        break
            _http_hint(200, "local")
        except urllib.error.HTTPError as e:
            yield f"[local {e.code}] {_http_hint(e.code, 'local')}"
        except Exception as e:
            _UNHEALTHY.add("local")
            yield f"[local connection error] {e}"


def probe_ollama(base_url: str | None = None, timeout: float = 1.5) -> tuple[bool, list[str]]:
    """Cheap reachability check: GET /api/tags lists installed models.

    Returns (reachable, [model_tag,...]).  Used by select_backend() to
    decide whether to construct LocalOllamaBackend.
    """
    base = (base_url or os.environ.get("LACUNA_LOCAL_URL") or "http://localhost:11434").rstrip("/")
    try:
        with urllib.request.urlopen(f"{base}/api/tags", timeout=timeout) as resp:
            data = json.loads(resp.read())
        models = [m.get("name") for m in data.get("models", []) if m.get("name")]
        return True, models
    except Exception:
        return False, []


# ── reasoning ─────────────────────────────────────────────────────────────────

class DeepSeekBackend(Backend):
    URL = "https://api.deepseek.com/v1/chat/completions"

    def __init__(self, key: str, model: str = "deepseek-chat") -> None:
        self._key = key
        self.info = BackendInfo(name="deepseek", model=model, available=True,
                                note=f"reasoning · {model}")

    def chat(self, system: str, messages: list[dict]) -> str:
        payload = json.dumps({
            "model": self.info.model,
            "messages": [{"role": "system", "content": system}] + messages,
            "max_tokens": 512,
            "stream": False,
        }).encode()
        req = urllib.request.Request(
            self.URL, data=payload,
            headers={"Content-Type": "application/json",
                     "Authorization": f"Bearer {self._key}"},
        )
        try:
            with urllib.request.urlopen(req, timeout=10, context=_ssl_ctx()) as resp:
                data = json.loads(resp.read())
            _http_hint(200, "deepseek")  # record success
            return data["choices"][0]["message"]["content"].strip()
        except urllib.error.HTTPError as e:
            return f"[deepseek {e.code}] {_http_hint(e.code, 'deepseek')}"
        except Exception as e:
            return f"[deepseek connection error] {e}"

    def chat_stream(self, system: str, messages: list[dict]):
        """Stream tokens from reasoning (cloud assist-compatible SSE)."""
        payload = json.dumps({
            "model": self.info.model,
            "messages": [{"role": "system", "content": system}] + messages,
            "max_tokens": 512,
            "stream": True,
        }).encode()
        req = urllib.request.Request(
            self.URL, data=payload,
            headers={"Content-Type": "application/json",
                     "Authorization": f"Bearer {self._key}"},
        )
        try:
            with urllib.request.urlopen(req, timeout=30, context=_ssl_ctx()) as resp:
                for raw_line in resp:
                    line = raw_line.decode(errors="replace").strip()
                    if not line.startswith("data:"):
                        continue
                    payload_str = line[len("data:"):].strip()
                    if payload_str == "[DONE]":
                        break
                    try:
                        chunk = json.loads(payload_str)
                    except json.JSONDecodeError:
                        continue
                    delta = chunk.get("choices", [{}])[0].get("delta", {}).get("content")
                    if delta:
                        yield delta
            _http_hint(200, "deepseek")
        except urllib.error.HTTPError as e:
            yield f"[deepseek {e.code}] {_http_hint(e.code, 'deepseek')}"
        except Exception as e:
            yield f"[deepseek connection error] {e}"


# ── cloud assist provider ────────────────────────────────────────────────────────────────

class AnthropicBackend(Backend):
    URL = "https://api.anthropic.com/v1/messages"
    # Default model — Alfred's system context says current family is deep reasoning.6/7.
    # claude-haiku-4-5-20251001 is the small model, good default for chat cost.
    DEFAULT_MODEL = "claude-haiku-4-5-20251001"

    def __init__(self, key: str, model: str | None = None) -> None:
        self._key = key
        model = model or self.DEFAULT_MODEL
        self.info = BackendInfo(name="anthropic", model=model, available=True,
                                note=f"cloud assist provider · {model}")

    def chat(self, system: str, messages: list[dict]) -> str:
        payload = json.dumps({
            "model": self.info.model,
            "system": system,
            "max_tokens": 512,
            "messages": messages,  # cloud assist provider expects only user/assistant turns
        }).encode()
        req = urllib.request.Request(
            self.URL, data=payload,
            headers={
                "Content-Type": "application/json",
                "x-api-key": self._key,
                "anthropic-version": "2023-06-01",
            },
        )
        try:
            with urllib.request.urlopen(req, timeout=10, context=_ssl_ctx()) as resp:
                data = json.loads(resp.read())
            _http_hint(200, "anthropic")
            blocks = data.get("content", [])
            out = "".join(b.get("text", "") for b in blocks if b.get("type") == "text")
            return out.strip() or "(anthropic returned an empty response)"
        except urllib.error.HTTPError as e:
            return f"[anthropic {e.code}] {_http_hint(e.code, 'anthropic')}"
        except Exception as e:
            return f"[anthropic connection error] {e}"


# ── Google AI Studio (Gemma + cloud assist) ────────────────────────────────────────

class GoogleGeminiBackend(Backend):
    """Talk to Google AI Studio (Generative Language API).

    Supports both the Gemma family (open-weights, free on Google's free tier)
    and the cloud assist family. Default model is a recent Gemma; override via
    LACUNA_LLM_MODEL or by passing model= directly.

    Free-tier reality: rate-limited (≈15 RPM for many Gemma/cloud assist models,
    no daily cap). Above that → 429, which our auto-fallback marks unhealthy
    and routes around. Limits are Google's; they change.
    """

    URL_TEMPLATE  = "https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent"
    DEFAULT_MODEL = "gemma-3-27b-it"

    def __init__(self, key: str, model: str | None = None) -> None:
        self._key = key
        model = model or self.DEFAULT_MODEL
        self.info = BackendInfo(
            name="google", model=model, available=True,
            note=f"Google AI Studio · {model}",
        )

    def chat(self, system: str, messages: list[dict]) -> str:
        url = self.URL_TEMPLATE.format(model=self.info.model)
        # Map our role-tagged messages to Google's contents shape.
        # Their API uses "user" and "model"; we squash assistant -> model.
        contents = [
            {
                "role":  "user" if m.get("role") == "user" else "model",
                "parts": [{"text": m.get("content", "")}],
            }
            for m in messages if m.get("content")
        ]
        body = {"contents": contents}
        if system:
            body["systemInstruction"] = {"parts": [{"text": system}]}
        payload = json.dumps(body).encode()
        req = urllib.request.Request(
            f"{url}?key={urllib.parse.quote(self._key)}",
            data=payload,
            headers={"Content-Type": "application/json"},
        )
        try:
            with urllib.request.urlopen(req, timeout=20, context=_ssl_ctx()) as resp:
                data = json.loads(resp.read())
            _http_hint(200, "google")
            candidates = data.get("candidates") or []
            if not candidates:
                return "(google returned no candidates)"
            parts = candidates[0].get("content", {}).get("parts", []) or []
            text = "".join(p.get("text", "") for p in parts).strip()
            return text or "(google returned empty text)"
        except urllib.error.HTTPError as e:
            return f"[google {e.code}] {_http_hint(e.code, 'google')}"
        except Exception as e:
            return f"[google connection error] {e}"


# ── cloud assist ───────────────────────────────────────────────────────────────────

class OpenAIBackend(Backend):
    URL = "https://api.openai.com/v1/chat/completions"
    DEFAULT_MODEL = "gpt-4o-mini"

    def __init__(self, key: str, model: str | None = None) -> None:
        self._key = key
        model = model or self.DEFAULT_MODEL
        self.info = BackendInfo(name="openai", model=model, available=True,
                                note=f"cloud assist · {model}")

    def chat(self, system: str, messages: list[dict]) -> str:
        payload = json.dumps({
            "model": self.info.model,
            "messages": [{"role": "system", "content": system}] + messages,
            "max_tokens": 512,
        }).encode()
        req = urllib.request.Request(
            self.URL, data=payload,
            headers={"Content-Type": "application/json",
                     "Authorization": f"Bearer {self._key}"},
        )
        try:
            with urllib.request.urlopen(req, timeout=10, context=_ssl_ctx()) as resp:
                data = json.loads(resp.read())
            _http_hint(200, "openai")
            return data["choices"][0]["message"]["content"].strip()
        except urllib.error.HTTPError as e:
            return f"[openai {e.code}] {_http_hint(e.code, 'openai')}"
        except Exception as e:
            return f"[openai connection error] {e}"


# ── public entrypoint ────────────────────────────────────────────────────────

_BACKEND_REGISTRY = {
    "google":    ("GOOGLE_API_KEY",    GoogleGeminiBackend),
    "deepseek":  ("DEEPSEEK_API_KEY",  DeepSeekBackend),
    "anthropic": ("ANTHROPIC_API_KEY", AnthropicBackend),
    "openai":    ("OPENAI_API_KEY",    OpenAIBackend),
}

# Hardcoded fallback precedence — used when ~/.lacuna/lacuna.yaml is missing
# AND no env override is set. The YAML config (loaded in _config_precedence())
# takes priority. v2.2: local first so reasoning 402s don't block the pipeline.
# Alfred 2026-04-28: lacuna prefers deepseek as primary cloud — its reasoning
# tier is well-suited to lacuna's SRE/operator surface. Google sits behind
# as a second cloud (free fallback if deepseek 402s or rate-limits).
_DEFAULT_PRECEDENCE = ("local", "deepseek", "google", "anthropic", "openai")


def _config_precedence() -> tuple[str, ...]:
    """Read backends.precedence from ~/.lacuna/lacuna.yaml when available.

    Strips the trailing 'echo' (treated as implicit final fallback). Strips
    unknown backend names so a user typo doesn't crash select_backend().
    """
    try:
        from .config import load_config
        cfg = load_config()
    except Exception:
        return _DEFAULT_PRECEDENCE
    valid = {"local", "deepseek", "anthropic", "openai"}
    out = [b for b in cfg.backends.precedence if b in valid]
    return tuple(out) if out else _DEFAULT_PRECEDENCE


# Track the last HTTP status each backend saw. Populated by _http_hint().
# Lets /ctl/llm-status surface "backend X last returned N" without an
# extra round-trip to the provider.
_LAST_RESULT: dict[str, dict] = {}

# Backends that returned 402/429 this process — skipped by select_backend
# until the process restarts.  Operator-visible via /ctl/llm-status.
_UNHEALTHY: set[str] = set()


def _http_hint(code: int, backend_name: str | None = None) -> str:
    if backend_name:
        from datetime import datetime, timezone
        _LAST_RESULT[backend_name] = {
            "status": code,
            "at": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        }
        # 402 (out of credits) and 429 (rate limit) → mark unhealthy so the
        # next select_backend() call skips this backend.  Cleared by process
        # restart, or by clear_unhealthy() if the operator tops up.
        if code in (402, 429):
            _UNHEALTHY.add(backend_name)
    if code == 401: return "invalid key"
    if code == 402: return "out of credits — top up the account"
    if code == 403: return "forbidden — the account may not have access to this model"
    if code == 429: return "rate-limited — slow down and retry"
    if code >= 500: return "provider error — try again shortly"
    return f"HTTP {code}"


def clear_unhealthy(backend_name: str | None = None) -> None:
    """Reset 402/429 marks. Operator command — used by `lacuna ai reset`."""
    if backend_name is None:
        _UNHEALTHY.clear()
    else:
        _UNHEALTHY.discard(backend_name)


def unhealthy_backends() -> list[str]:
    """Names of backends currently skipped due to 402/429."""
    return sorted(_UNHEALTHY)


def last_result_for(backend_name: str) -> dict | None:
    """Return the last HTTP outcome for this backend, if any have been recorded."""
    return _LAST_RESULT.get(backend_name)


def _read_env_file(env_file: Path | None) -> dict[str, str]:
    """Just the .env file contents — no os.environ merge."""
    result: dict[str, str] = {}
    if env_file and env_file.exists():
        for line in env_file.read_text().splitlines():
            line = line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            k, _, v = line.partition("=")
            result[k.strip()] = v.strip().strip('"').strip("'")
    return result


def _read_env_keys(env_file: Path | None = None) -> dict[str, str]:
    """Merged view — os.environ wins. Used by select_backend to decide."""
    merged = _read_env_file(env_file)
    merged.update({k: v for k, v in os.environ.items() if v})
    return merged


def resolve_key(var_name: str, env_file: Path | None = None) -> dict | None:
    """Return info about where the key for `var_name` came from, if set.

    {source: "process-env" | "env-file", value: str, length: int,
     shadowed: bool}  — shadowed=True when both sources have a value AND
    they differ (common 402 cause for Alfred: stale shell export beats
    fresh .env value).
    """
    file_keys = _read_env_file(env_file)
    process_val = os.environ.get(var_name, "").strip()
    file_val    = (file_keys.get(var_name) or "").strip()

    if process_val:
        shadowed = bool(file_val) and file_val != process_val
        return {
            "source":   "process-env",
            "value":    process_val,
            "length":   len(process_val),
            "shadowed": shadowed,
        }
    if file_val:
        return {
            "source":   "env-file",
            "value":    file_val,
            "length":   len(file_val),
            "shadowed": False,
        }
    return None


def mask_key(value: str) -> str:
    """Render a key like 'sk-2274…8b30' — first 6 + last 4, middle masked."""
    if not value:
        return ""
    if len(value) <= 12:
        return value[:3] + "…" + value[-2:]
    return value[:6] + "…" + value[-4:]


def select_backend(env_file: Path | None = None) -> Backend:
    """Pick a backend per env config. See module docstring for rules.

    v2.2 precedence: local → deepseek → anthropic → openai → echo.
    Skips any backend currently marked unhealthy (402/429 this process).
    """
    env = _read_env_keys(env_file)
    forced = env.get("LACUNA_LLM_BACKEND", "").lower().strip()
    model_override = env.get("LACUNA_LLM_MODEL") or None

    def _build(name: str) -> Backend | None:
        if name in _UNHEALTHY:
            return None
        if name == "echo":
            return EchoBackend()
        if name == "local":
            base = env.get("LACUNA_LOCAL_URL") or "http://localhost:11434"
            # Default local model: the open base family (Alfred, 2026-04-28 — reverted
            # from a brief gemma3 default after CPU-only Intel Mac inference
            # benchmarks. See lacuna-engineering case-study CS-003.) If the
            # configured tag isn't pulled, fallback prefers any installed
            # the open base, then gemma, then anything installed.
            model = (env.get("LACUNA_LOCAL_MODEL")
                     or model_override
                     or "qwen2.5:3b-instruct")
            reachable, installed = probe_ollama(base)
            if not reachable:
                return None
            if installed and model not in installed:
                preferred = (
                    [m for m in installed if "qwen" in m.lower()]
                    or [m for m in installed if "gemma" in m.lower()]
                )
                model = preferred[0] if preferred else installed[0]
            return LocalOllamaBackend(base, model)
        spec = _BACKEND_REGISTRY.get(name)
        if not spec:
            return None
        key_name, cls = spec
        key = env.get(key_name, "").strip()
        if not key:
            return None
        try:
            return cls(key, model_override) if model_override else cls(key)
        except TypeError:
            return cls(key)

    if forced:
        backend = _build(forced)
        if backend:
            return backend

    for name in _config_precedence():
        b = _build(name)
        if b:
            return b
    return EchoBackend()


@dataclass
class PilotPair:
    """A (pilot, copilot, mode) configuration. Modes:
      - solo:     only pilot answers; copilot ignored
      - fallback: pilot answers; if pilot errors, copilot answers
      - race:     both run in parallel; first usable response wins
    """
    pilot: Backend
    copilot: Backend | None
    mode: str  # "solo" | "fallback" | "race"


def _pilot_yaml_path() -> Path:
    return Path(os.environ.get("LACUNA_HOME", Path.home() / ".lacuna")) / "pilot.yaml"


def _read_pilot_config() -> dict:
    """Read ~/.lacuna/pilot.yaml. Returns defaults if missing or unreadable."""
    defaults = {"pilot": "local", "copilot": "deepseek", "mode": "fallback"}
    path = _pilot_yaml_path()
    if not path.exists():
        return defaults
    try:
        # Tiny YAML parser for our 3-line file — avoid PyYAML dependency
        result = dict(defaults)
        for line in path.read_text(errors="replace").splitlines():
            line = line.strip()
            if not line or line.startswith("#"):
                continue
            if ":" in line:
                k, _, v = line.partition(":")
                result[k.strip()] = v.strip().strip("'\"")
        return result
    except Exception:
        return defaults


def write_pilot_config(pilot: str, copilot: str, mode: str) -> None:
    """Write pilot.yaml. Validates inputs against known backends and modes."""
    valid_backends = {"local", "deepseek", "anthropic", "openai", "echo"}
    valid_modes = {"solo", "fallback", "race"}
    if pilot not in valid_backends:
        raise ValueError(f"unknown pilot backend: {pilot}")
    if copilot not in valid_backends:
        raise ValueError(f"unknown copilot backend: {copilot}")
    if mode not in valid_modes:
        raise ValueError(f"unknown mode: {mode} (valid: {', '.join(sorted(valid_modes))})")
    path = _pilot_yaml_path()
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(
        "# ~/.lacuna/pilot.yaml — Lacuna pilot/copilot configuration.\n"
        "# Edit via `lacuna pilot set --pilot X --copilot Y --mode Z` or here.\n"
        f"pilot: {pilot}\n"
        f"copilot: {copilot}\n"
        f"mode: {mode}\n"
    )


def select_pilot_pair(env_file: Path | None = None) -> PilotPair:
    """Build the pilot/copilot pair from ~/.lacuna/pilot.yaml.

    If a configured backend is unreachable (e.g., local with no Ollama),
    silently substitute the global precedence chain's choice.
    """
    cfg = _read_pilot_config()
    env = _read_env_keys(env_file)
    forced = env.get("LACUNA_LLM_BACKEND", "").lower().strip()
    if forced:
        # Forced backend overrides pilot config — solo mode with no copilot
        return PilotPair(select_backend(env_file), None, "solo")

    def _build(name: str) -> Backend | None:
        # Reuse the per-name builder logic (mirrors select_backend's _build)
        if name in _UNHEALTHY:
            return None
        if name == "echo":
            return EchoBackend()
        if name == "local":
            base = env.get("LACUNA_LOCAL_URL") or "http://localhost:11434"
            model = env.get("LACUNA_LOCAL_MODEL") or "qwen2.5:0.5b"
            reachable, installed = probe_ollama(base)
            if not reachable:
                return None
            if installed and model not in installed:
                preferred = (
                    [m for m in installed if "qwen" in m.lower()]
                    or [m for m in installed if "gemma" in m.lower()]
                )
                model = preferred[0] if preferred else installed[0]
            return LocalOllamaBackend(base, model)
        spec = _BACKEND_REGISTRY.get(name)
        if not spec:
            return None
        key_name, cls = spec
        key = env.get(key_name, "").strip()
        if not key:
            return None
        return cls(key)

    pilot = _build(cfg["pilot"]) or select_backend(env_file)
    copilot = _build(cfg["copilot"]) if cfg["mode"] != "solo" else None
    return PilotPair(pilot=pilot, copilot=copilot, mode=cfg["mode"])


def describe_backend(env_file: Path | None = None) -> dict:
    """Full status payload for /ctl/llm-status. Never touches the network."""
    env = _read_env_keys(env_file)
    forced = env.get("LACUNA_LLM_BACKEND", "").lower().strip()
    model_override = env.get("LACUNA_LLM_MODEL") or None

    # Which backend would select_backend() pick right now?
    # Mirrors select_backend() — including unhealthy-skip and local-probe.
    chosen_name = None
    if forced and forced not in _UNHEALTHY:
        if forced == "echo":
            chosen_name = "echo"
        elif forced == "local":
            reachable, _ = probe_ollama(env.get("LACUNA_LOCAL_URL"))
            if reachable:
                chosen_name = "local"
        else:
            spec = _BACKEND_REGISTRY.get(forced)
            if spec and env.get(spec[0]):
                chosen_name = forced
    if not chosen_name:
        for name in _config_precedence():
            if name in _UNHEALTHY:
                continue
            if name == "local":
                reachable, _ = probe_ollama(env.get("LACUNA_LOCAL_URL"))
                if reachable:
                    chosen_name = "local"
                    break
                continue
            spec = _BACKEND_REGISTRY[name]
            if env.get(spec[0]):
                chosen_name = name
                break
    chosen_name = chosen_name or "echo"

    # Build a recent-errors list across all backends — visible regardless of
    # which one is currently chosen. The 402 from reasoning that triggered an
    # auto-fall-through still shows up here so the operator can act on it.
    recent_errors = []
    for bname, last in sorted(_LAST_RESULT.items()):
        if last.get("status") and last.get("status") >= 400:
            recent_errors.append({"backend": bname, **last})

    info = {
        "backend":          chosen_name,
        "forced":           bool(forced) and chosen_name == forced,
        "model":            None,
        "key_source":       "none",
        "key_prefix":       None,
        "key_length":       0,
        "shadowed":         False,
        "shadow_note":      None,
        "last_http_status": None,
        "last_http_at":     None,
        "unhealthy":        sorted(_UNHEALTHY),
        "recent_errors":    recent_errors,
        "precedence":       list(_config_precedence()) + ["echo"],
        "ollama":           None,   # filled if local is in play
    }

    if chosen_name == "local":
        base = env.get("LACUNA_LOCAL_URL") or "http://localhost:11434"
        model = (env.get("LACUNA_LOCAL_MODEL")
                 or model_override
                 or "qwen2.5:3b-instruct")
        reachable, installed = probe_ollama(base)
        info["ollama"] = {
            "reachable": reachable,
            "url":       base,
            "installed": installed,
            "configured_model": model,
        }
        info["model"] = model
        info["key_source"] = "local"
    elif chosen_name != "echo":
        spec = _BACKEND_REGISTRY[chosen_name]
        key_var, cls = spec
        resolved = resolve_key(key_var, env_file)
        if resolved:
            info["key_source"] = resolved["source"]
            info["key_prefix"] = mask_key(resolved["value"])
            info["key_length"] = resolved["length"]
            info["shadowed"]   = resolved["shadowed"]
            if resolved["shadowed"]:
                info["shadow_note"] = (
                    f"Your shell env has {key_var} exported. That value is "
                    f"being used — not the one in the-api/.env. Run "
                    f"`unset {key_var}` and restart `lacuna up` to use the "
                    f".env value, or update your shell export."
                )
        # Resolve the model the backend would use
        try:
            instance = cls(resolved["value"], model_override) if resolved and model_override \
                       else (cls(resolved["value"]) if resolved else None)
            if instance:
                info["model"] = instance.info.model
        except Exception:
            pass

    last = _LAST_RESULT.get(chosen_name)
    if last:
        info["last_http_status"] = last.get("status")
        info["last_http_at"]     = last.get("at")
    elif recent_errors:
        # Chosen backend has no record (e.g. fell back to echo because the
        # configured cloud backend went 402). Surface the most-recent error
        # so the operator sees it without diving into recent_errors.
        most_recent = max(recent_errors, key=lambda e: e.get("at") or "")
        info["last_http_status"] = most_recent.get("status")
        info["last_http_at"]     = most_recent.get("at")

    return info
