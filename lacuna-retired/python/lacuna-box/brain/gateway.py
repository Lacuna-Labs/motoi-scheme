#!/usr/bin/env python3
"""THE BRAIN GATEWAY — one front door for the box's one brain (2026-10-18).
Over 500 lines by reason: one handler class (Door) answers every route of the brain and the small minds and translates
Ollama's chat for llama-server; it retires with order §3.17, and until then the translation moves to chat_wire.py.

Measured on the Studio, same weights both ways (Gemma 4 26B Q4_K_M), the brain moved from Ollama's runner to
llama.cpp's server: n-gram speculative decoding writes an edit (a cart returned with a change) at 234 tok/s against 27
(8.6×); two streams at once 66 tok/s against 56; a warm prompt in 0.14 s against 0.45; and llama.cpp decodes under OUR
grammar (sakura-scheme/grammar/*.gbnf), which Ollama cannot. Every caller on the box speaks Ollama's API on :11434 —
Lacuna's chat, its workers, the runner, Pi, the cart daemons — so the move changes NONE of them: this gateway answers
on :11434 in Ollama's words, sends the brain's requests to llama-server (:8091), everything else to Ollama (:11435).

  POST /api/chat       brain → /v1/chat/completions (tools, JSON schemas, our `grammar` field, thinking on/off,
                       streaming as Ollama's NDJSON); other models → Ollama
  POST /api/generate   brain: an empty prompt is the warm-up (answered at once); a prompt becomes one chat turn
  GET  /api/ps         Ollama's list, with the brain added (it is resident in llama-server)
  /v1/*                brain → llama-server as is (Pi speaks this); others → Ollama
  GET  /api/tags       Ollama's list, each model marked with where it is served (`served_by`)
  GET  /lacuna/minds   the small minds running now (name, port, pid, idle seconds, rss)
  everything else      → Ollama

Small minds (minds.py): the small Gemmas this box has pulled (FunctionGemma, Gemma 3 270M …) are served by their own
llama-server, started on demand from Ollama's own GGUF and stopped when idle, so they too decode under our grammars;
one llama.cpp cannot load falls back to Ollama. Every answer names its server in the `X-Lacuna-Served-By` header, and
a small mind's answer carries its `certainty` (minds_words.py: the lowest chosen-token probability, design §40.1).

Rollback: `brain/rollback.sh`. Each lane's warm head is kept across lane switches: kvring.py (X-Lacuna-Prefix).
"""
from __future__ import annotations

import json
import os
import re
import signal
import sys
import threading
import time
import urllib.error
import urllib.request
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import hangup  # noqa: E402
import minds  # noqa: E402
import kvring  # noqa: E402
import seed  # noqa: E402
import live  # noqa: E402
from wire import CHANNEL, _calls, _clean, from_openai, to_openai  # noqa: E402,F401
import minds_words  # noqa: E402

LISTEN = int(os.environ.get("GATEWAY_PORT", "11434"))
BRAIN = os.environ.get("BRAIN_URL", "http://127.0.0.1:8091")
# the engine that holds the brain's port, as every answer names it (X-Lacuna-Served-By): the LME after the 2026-10-27 cut-over
SERVED_BRAIN = ("LME" if os.environ.get("BRAIN_ENGINE") == "lme" else "llama.cpp") + " (the brain, :" + BRAIN.rsplit(":", 1)[-1].rstrip("/") + ")"
GONE = [0]                                                               # abandoned requests hung up on, since start
BRAIN_SLOTS = int(os.environ.get("BRAIN_SLOTS", "2"))                     # llama-server --parallel (the brain plist)
BACKGROUND = threading.BoundedSemaphore(max(1, BRAIN_SLOTS - 1))          # one slot is always a person's
PERSON_GAP_S = float(os.environ.get("BRAIN_PERSON_GAP_S", "20"))
_PERSON = threading.Condition()
_PERSON_STATE = {"n": 0, "last": 0.0}


def _person_wait(limit_s: float) -> None:
    """Hold a background request until no person's turn is running or just ran (PERSON FIRST)."""
    end = time.time() + limit_s
    with _PERSON:
        while time.time() < end:
            quiet = time.time() - _PERSON_STATE["last"]
            if _PERSON_STATE["n"] == 0 and quiet >= PERSON_GAP_S:
                return
            _PERSON.wait(timeout=max(0.5, PERSON_GAP_S - quiet if _PERSON_STATE["n"] == 0 else 5))
BG_WAIT_S = float(os.environ.get("BRAIN_BG_WAIT_S", "1800"))
OLLAMA = os.environ.get("OLLAMA_BACK_URL", "http://127.0.0.1:11435")
# one brain (the owner, 2026-10-17: "local hits that same Gemma 26"): Sakura's local mode asks for gemma4:e4b by name for
# quick talk — answered by the resident 26B, never a second model loaded beside it on a 32 GB box
BRAIN_NAMES = {"lacuna-worker-lite", "lacuna-worker-lite:latest", "gemma4:26b", "gemma4:26b-a4b", "gemma4:12b", "gemma4:12b-it-q8_0", "gemma4:e4b",
               "gemma4:e4b-it", "gemma4:e4b-it-qat", "lacuna-desk", "lacuna-desk:latest", "curator-cart", "curator-cart:latest"}
_FACTS: dict = {"tag": None, "v": None}


def brain_facts() -> dict:
    """THE RESIDENT BRAIN, AS IT IS (2026-10-27: the facts were a constant, "25.2B Q4_K_M", left from the 26B's seat, so the desk
    said 25.2b while the E4B served): the profile names the tag (~/.lacuna/brain-profile.json); Ollama's /api/show says its
    size and quantization; read once per tag. Unread: the family alone, never a guess."""
    try:
        with open(os.path.expanduser("~/.lacuna/brain-profile.json")) as f:
            tag = json.load(f).get("brain")
    except (OSError, ValueError):
        tag = None
    if tag and _FACTS["tag"] == tag and _FACTS["v"]:
        return _FACTS["v"]
    v = {"family": "gemma4", "format": "gguf", "tag": tag}
    try:
        req = urllib.request.Request(OLLAMA + "/api/show", data=json.dumps({"model": tag}).encode(), headers={"content-type": "application/json"})
        with urllib.request.urlopen(req, timeout=3) as r:
            d = (json.load(r).get("details") or {})
        v.update({k: d[k] for k in ("family", "parameter_size", "quantization_level") if d.get(k)})
    except (OSError, ValueError):
        pass
    _FACTS.update(tag=tag, v=v)
    return v
POOL = minds.Pool()
SMALL: set = set()                    # filled at start-up and on every /api/tags (the small minds this box has pulled)


def current_brain_tag() -> str:
    """The tag the engine holds now, from its own profile (~/.lacuna/brain-profile.json, written by every swap)."""
    try:
        with open(os.path.expanduser("~/.lacuna/brain-profile.json")) as f:
            return str(json.load(f).get("brain") or "")
    except (OSError, ValueError):
        return ""


def is_brain(model: str | None) -> bool:
    # the names above, and whatever the engine holds now by its full tag (2026-11-04: "gemma4:26b-a4b-it-qat" was not in the
    # list, so every 26B turn went to Ollama, loaded a second copy and ran the GPU out of memory)
    m = str(model or "")
    return m in BRAIN_NAMES or (bool(m) and m == current_brain_tag())


def is_small(model: str | None) -> bool:
    return bool(model) and not is_brain(model) and minds.canon(model) in SMALL


def refresh_small():
    SMALL.clear()
    SMALL.update(minds.small_names(BRAIN_NAMES))


def served_by(name: str) -> str:
    """Where a model's requests go — the desk shows it beside each name."""
    if is_brain(name):
        return SERVED_BRAIN
    if is_small(name):
        why = POOL.cannot.get(minds.canon(name))
        return f"ollama ({why})" if why else "llama.cpp (small mind, started on demand)"
    return "ollama"


def header_safe(text: str) -> str:
    return re.sub(r"[^\x20-\x7e]", "?", text)[:300]


# ── Ollama's chat → the OpenAI-style chat llama-server speaks ──────────────────────────────────────────────────────
# ── the door ─────────────────────────────────────────────────────────────────────────────────────────────────────────
class Door(BaseHTTPRequestHandler):
    protocol_version = "HTTP/1.1"

    def log_message(self, fmt, *a):          # quiet: the brain's own log has the detail
        pass

    def _body(self) -> bytes:
        n = int(self.headers.get("Content-Length") or 0)
        return self.rfile.read(n) if n else b""

    def _send(self, code: int, obj, ctype="application/json"):
        data = obj if isinstance(obj, (bytes, bytearray)) else json.dumps(obj).encode()
        self.send_response(code)
        self.send_header("Content-Type", ctype)
        self.send_header("Content-Length", str(len(data)))
        self._served_header()
        self.end_headers()
        self.wfile.write(data)

    def _served_header(self):
        if getattr(self, "served", None):
            self.send_header("X-Lacuna-Served-By", header_safe(self.served))

    def _pass(self, base: str, raw: bytes, method: str):
        """Forward as is, streaming the answer through (Ollama's NDJSON or an SSE stream)."""
        headers = {k: v for k, v in self.headers.items() if k.lower() in ("content-type", "authorization", "accept")}
        req = urllib.request.Request(base + self.path, data=raw if method == "POST" else None, method=method, headers=headers)
        try:
            up = urllib.request.urlopen(req, timeout=3600)
        except urllib.error.HTTPError as e:
            return self._send(e.code, e.read() or b"{}")
        except OSError as e:
            return self._send(502, {"error": f"{base} is not answering ({e.__class__.__name__})"})
        stop = hangup.when_gone(self.connection, up, GONE)   # the caller left → the brain stops
        self.send_response(up.status)
        self.send_header("Content-Type", up.headers.get("Content-Type", "application/json"))
        self.send_header("Transfer-Encoding", "chunked")
        self._served_header()
        self.end_headers()
        try:
            while True:
                chunk = up.read1(65536) if hasattr(up, "read1") else up.read(65536)
                if not chunk:
                    break
                self.wfile.write(b"%x\r\n%s\r\n" % (len(chunk), chunk))
                self.wfile.flush()
            self.wfile.write(b"0\r\n\r\n")
        except (BrokenPipeError, ConnectionResetError, OSError, ValueError):
            pass
        finally:
            stop()
            up.close()

    def do_GET(self):
        self.served = "gateway" if self.path.startswith(("/health", "/lacuna/", "/api/ps", "/api/tags")) else "ollama"
        if self.path.startswith("/api/ps"):
            try:
                with urllib.request.urlopen(OLLAMA + "/api/ps", timeout=5) as r:
                    ps = json.load(r)
            except OSError:
                ps = {"models": []}
            try:
                with urllib.request.urlopen(BRAIN + "/health", timeout=3) as r:
                    up = json.load(r).get("status") == "ok"
            except OSError:
                up = False
            if up:
                ps["models"] = [{"name": "lacuna-worker-lite:latest", "model": "lacuna-worker-lite:latest", "size": 0,
                                 "details": brain_facts(), "context_length": 65536, "expires_at": "resident (llama-server)",
                                 "server": "llama.cpp"}] + [m for m in ps.get("models", []) if not is_brain(m.get("name"))]
            ps["models"] = ps.get("models", []) + [{"name": m["name"], "model": m["name"], "size": m["rss"],
                                                    "expires_at": f"idle {m['idle_s']} s of {minds.IDLE_S:.0f}",
                                                    "server": f"llama.cpp :{m['port']}"} for m in POOL.listing()]
            return self._send(200, ps)
        if self.path.startswith("/health"):
            return self._send(200, {"status": "ok", "gateway": True})
        if self.path.startswith("/lacuna/kv"):
            return self._send(200, kvring.stats())
        if self.path.startswith("/lacuna/minds"):
            return self._send(200, {"minds": POOL.listing(), "small": sorted(SMALL), "cannot_load": POOL.cannot,
                                    "max": minds.MIND_MAX, "idle_s": minds.IDLE_S,
                                    "profile": minds.profile(), "budget_gb": minds.mind_budget(),
                                    "weights_gb": {n: minds.weight(n) for n in sorted(SMALL)},
                                    "abandoned_hung_up": GONE[0], "in_use_gb": round(sum(minds.weight(m["name"]) for m in POOL.listing()), 2)})
        if self.path.startswith("/api/tags"):
            return self._tags()
        return self._pass(OLLAMA, b"", "GET")

    def _tags(self):
        try:
            with urllib.request.urlopen(OLLAMA + "/api/tags", timeout=10) as r:
                tags = json.load(r)
        except (OSError, ValueError) as e:
            return self._send(502, {"error": f"Ollama is not answering ({e.__class__.__name__})"})
        refresh_small()
        running = {m["name"]: m["port"] for m in POOL.listing()}
        for m in tags.get("models") or []:
            m["served_by"] = served_by(m.get("name"))
            if minds.canon(m.get("name")) in running:
                m["running_port"] = running[minds.canon(m.get("name"))]
        return self._send(200, tags)

    def do_POST(self):
        raw = self._body()
        try:
            body = json.loads(raw or b"{}")
        except ValueError:
            body = {}
        model = body.get("model")
        self.served = SERVED_BRAIN if is_brain(model) else "ollama"
        why = None if is_brain(model) else minds.reserved_why(str(model or ""))
        if why and self.path.startswith(("/api/chat", "/api/generate", "/v1/chat/", "/v1/completions")):
            # the box's profile keeps this model out of reach (box-minds.json): refused with its reason, never loaded
            return self._send(403, {"error": f"{model} is not an agent's mind on this box — {why}"})
        if is_small(model) and self.path.startswith(("/api/chat", "/api/generate", "/v1/chat/", "/v1/completions")):
            return self._small(body, raw)
        if is_brain(model) and self.path.startswith(("/api/chat", "/api/generate", "/v1/")):
            # ONE SLOT PER LANE (2026-10-18, measured in brain.log: the pantheon's pair writing cycled through both slots and
            # evicted the owner's 10k-token cached head, so his next turn re-read 3.5k–5.7k tokens, 10–22 s, before a word):
            # a person always lands on slot 0, background work on the others, and each keeps its own prompt cache
            body["_slot"] = 0 if self._person() else (BRAIN_SLOTS - 1 if BRAIN_SLOTS > 1 else None)
            self.lane = kvring.key(self.headers.get("X-Lacuna-Prefix"))           # G1: the lane's warm head, kept (kvring.py)
            # ONE MIND FOR EVERY CARD (2026-10-19, the owner: "wiping its mind for the card context doesn't work. just load
            # the card context"): every person turn shares one prompt head, so the person's slot never swaps lanes — a
            # swap restored a state the SWA brain could not resume from (cache_n 0 on 31 of 46 restores) and seed.py
            # keeps the checkpoint where the newest message starts
            self.did = {} if body["_slot"] == 0 else kvring.switch(body["_slot"], self.lane)
            if not self._person():
                # PERSON FIRST (2026-10-19, measured: alone the 26B writes 33 tok/s; beside a background decode the owner's
                # turn got 8.5): no background request STARTS while a person's turn is in flight or within PERSON_GAP_S of
                # its last request (a turn's tool runs sit between its model rounds). It waits; it is never dropped.
                _person_wait(BG_WAIT_S)
                # background work takes at most BRAIN_SLOTS-1 of the brain's slots, so a person's turn always finds one
                # free (2026-10-18: both slots held by background calls timed the owner's question out after 5 min)
                if not BACKGROUND.acquire(timeout=BG_WAIT_S):
                    return self._send(503, {"error": "the brain's background lane is full; try again shortly"})
                try:
                    return self._to_brain(body, raw)
                finally:
                    BACKGROUND.release()
            with _PERSON:
                _PERSON_STATE["n"] += 1
            try:
                return self._to_brain(body, raw)
            finally:
                with _PERSON:
                    _PERSON_STATE["n"] -= 1
                    _PERSON_STATE["last"] = time.time()
                    _PERSON.notify_all()
        if isinstance(body, dict) and self.path.startswith(("/api/chat", "/api/generate", "/api/embed")):
            if body.get("keep_alive") in (None, "", "24h", "-1", -1):
                body["keep_alive"] = "10m"
                raw = json.dumps(body).encode()
        return self._pass(OLLAMA, raw, "POST")

    def _person(self) -> bool:
        """A person's turn: only Lacuna's own chat says so (X-Lacuna-Lane: person). Everything else — Pi's /v1 terminal,
        agents, workers, benches — is background (2026-10-19: a Pi window sent 22k-token turns on the person's slot and
        the owner's chat queued behind it until it timed out: "I cannot reach my model")."""
        lane = (self.headers.get("X-Lacuna-Lane") or "").strip().lower()
        return lane == "person"

    def _to_brain(self, body: dict, raw: bytes):
        if self.path.startswith("/v1/"):
            if body.get("messages") is not None and body.get("id_slot") is None:
                # CACHE_PREFIX ALWAYS (2026-10-21): the old guard skipped cache_prompt entirely when there is one slot, so every
                # round re-read the whole prompt. id_slot only when the brain has more than one.
                _out = {k: v for k, v in body.items() if k != "_slot"}
                _out["cache_prompt"] = True
                if body.get("_slot") is not None:
                    _out["id_slot"] = body["_slot"]
                raw = json.dumps(_out).encode()
            return self._pass(BRAIN, raw, "POST")
        if self.path.startswith("/api/generate"):
            if not body.get("prompt"):                                    # the warm-up: the brain is always resident
                return self._send(200, {"model": body.get("model"), "response": "", "done": True, "done_reason": "load"})
            msgs = ([{"role": "system", "content": body["system"]}] if body.get("system") else []) + [{"role": "user", "content": body["prompt"]}]
            chat = {**body, "messages": msgs, "stream": False}
            out = self._brain_chat(chat)
            if isinstance(out, dict) and "message" in out:
                out["response"] = out["message"].get("content", "")
            return self._send(200, out)
        if body.get("stream", True):
            return self._brain_stream(body)
        return self._send(200, self._brain_chat(body))

    def do_DELETE(self):
        self.served = "ollama"
        return self._pass(OLLAMA, self._body(), "DELETE")

    # ── small minds ──────────────────────────────────────────────────────────────────────────────────────────────────
    def _small(self, body: dict, raw: bytes):
        name = minds.canon(body.get("model"))
        try:
            m = POOL.acquire(name)
        except minds.CannotLoad as e:
            lost = "; its grammar was NOT applied" if body.get("grammar") else ""
            self.served = f"ollama (fallback: {e}{lost})"
            return self._pass(OLLAMA, raw, "POST")
        except minds.Refused as e:
            self.served = "none (refused)"
            return self._send(503, {"error": str(e)})
        self.served = f"llama.cpp :{m.port} ({name})"
        try:
            if self.path.startswith("/v1/"):
                return self._pass(m.url, raw, "POST")
            if self.path.startswith("/api/generate"):
                return self._send(200, self._small_generate(body, m.url, name))
            out = minds_words.finish(self._brain_chat(body, m.url, name), name, body)
            if not body.get("stream", True) or "error" in out:
                return self._send(200 if "error" not in out else 502, out)
            return self._send_as_stream(out)
        finally:
            POOL.release(m)

    def _small_generate(self, body: dict, base: str, name: str) -> dict:
        if not body.get("prompt"):                                        # the warm-up: acquiring it started it
            return {"model": name, "response": "", "done": True, "done_reason": "load"}
        if body.get("raw"):                                               # a prompt already in the model's own turns
            o = body.get("options") or {}
            req = {"prompt": body["prompt"], "n_predict": int(o.get("num_predict") or -1), "cache_prompt": True,
                   "n_probs": max(1, minds_words.top_n(body))}          # the chosen tokens' probabilities: certainty
            req.update({k: o.get(k, v) for k, v in minds.GEMMA_SAMPLING.items()})
            for k in ("seed", "stop", "min_p", "repeat_penalty"):
                if k in o:
                    req[k] = o[k]
            if body.get("grammar"):
                req["grammar"] = body["grammar"]
            elif isinstance(body.get("format"), dict):
                req["json_schema"] = body["format"]
            try:
                with urllib.request.urlopen(urllib.request.Request(base + "/completion", data=json.dumps(req).encode(),
                                            headers={"Content-Type": "application/json"}), timeout=600) as r:
                    d = json.load(r)
            except (urllib.error.HTTPError, OSError) as e:
                return {"error": f"{name} did not answer ({e.__class__.__name__})"}
            return {"model": name, "response": minds_words.TAIL.sub("", d.get("content") or ""), "done": True,
                    "done_reason": "stop", "eval_count": d.get("tokens_predicted", 0),
                    **minds_words.scored(d.get("completion_probabilities"), body)}
        msgs = ([{"role": "system", "content": body["system"]}] if body.get("system") else []) + \
            [{"role": "user", "content": body["prompt"]}]
        out = minds_words.finish(self._brain_chat({**body, "messages": msgs, "stream": False}, base, name), name, body)
        if "message" in out:
            out["response"] = out["message"].get("content", "")
        return out

    def _send_as_stream(self, out: dict):
        """A small mind answers in well under a second; it is sent as Ollama's stream in two lines (words, then done)."""
        msg = out.get("message") or {}
        lines = [{"model": out.get("model"), "message": {"role": "assistant", "content": msg.get("content", "")}, "done": False},
                 {**out, "message": {**msg, "content": ""}}]
        data = b"".join(json.dumps(x).encode() + b"\n" for x in lines)
        self._send(200, data, "application/x-ndjson")

    # ── the brain ────────────────────────────────────────────────────────────────────────────────────────────────────
    def _brain_chat(self, body: dict, base: str = BRAIN, small: str | None = None) -> dict:
        req = to_openai({**body, "stream": False})
        if not small and req.get("messages"):
            self.did = {**(getattr(self, "did", None) or {}), **seed.seed(base, req)}     # seed.py: read only the newest message
        if small:
            req = minds_words.shape(req, body, small)
            if body.get("adapter"):                  # G18: this request's specialist, applied for it alone
                i = minds.adapter_id(small, str(body["adapter"]))
                if i is None:
                    return {"error": f"{small} has no adapter {body['adapter']} loaded"}
                req["lora"] = [{"id": i, "scale": 1.0}]
        t0 = time.time()
        try:
            r = urllib.request.urlopen(urllib.request.Request(base + "/v1/chat/completions", data=json.dumps(req).encode(),
                                                              headers={"Content-Type": "application/json"}), timeout=3600)
            got = json.load(r)
            if not small:
                kvring.note(body.get("_slot"), getattr(self, "lane", None), got.get("timings") or {}, getattr(self, "did", {}))
            out = from_openai(got, body.get("model"), t0)
            m = (out.get("message") or {}) if isinstance(out, dict) else {}
            live.note(model=str(small or body.get("model")), lane=getattr(self, "lane", None) or (small and "small-mind"),
                      who=self.headers.get("X-Lacuna-Lane") or self.headers.get("X-Lacuna-Prefix"), slot=body.get("_slot"), body=req,
                      said=m.get("content") or "", thought=m.get("thinking") or "", calls=m.get("tool_calls"),
                      ms=int((time.time() - t0) * 1000), tokens=(got.get("usage") or {}).get("completion_tokens"))
            return out
        except urllib.error.HTTPError as e:
            return {"error": f"the brain refused: {e.read()[:300].decode('utf-8', 'replace')}"}
        except OSError as e:
            return {"error": f"the brain is not answering ({e.__class__.__name__})"}

    def _brain_stream(self, body: dict):
        """llama-server's SSE → Ollama's NDJSON: content as it comes, tool calls gathered and sent whole at the end."""
        req = to_openai({**body, "stream": True})
        req["stream_options"] = {"include_usage": True}
        # HEADERS FIRST (2026-10-20, measured: a stop pressed while the seed read the prompt waited 8–17 s, because the caller had no
        # response to hang up on until the seed and the brain's first byte were done). The answer is promised at once; a brain that
        # then fails says so in the stream's one closing line ({"error", "done": true}).
        self.send_response(200)
        self.send_header("Content-Type", "application/x-ndjson")
        self.send_header("Transfer-Encoding", "chunked")
        self._served_header()
        self.end_headers()
        self.wfile.flush()
        said, thought = [], []

        def emit(obj):
            m = obj.get("message") or {}
            if m.get("content"):
                said.append(m["content"])
            if m.get("thinking"):
                thought.append(m["thinking"])
            line = json.dumps(obj).encode() + b"\n"
            self.wfile.write(b"%x\r\n%s\r\n" % (len(line), line))
            self.wfile.flush()

        if req.get("messages"):
            self.did = {**(getattr(self, "did", None) or {}), **seed.seed(BRAIN, req)}    # seed.py: read only the newest message
        t0, model = time.time(), body.get("model")
        try:
            up = urllib.request.urlopen(urllib.request.Request(BRAIN + "/v1/chat/completions", data=json.dumps(req).encode(),
                                                               headers={"Content-Type": "application/json"}), timeout=3600)
        except (urllib.error.HTTPError, OSError) as e:
            try:
                emit({"model": model, "error": f"the brain is not answering ({e.__class__.__name__})", "done": True, "done_reason": "error"})
                self.wfile.write(b"0\r\n\r\n")
            except OSError:
                pass
            return
        stop = hangup.when_gone(self.connection, up, GONE)   # the caller left → the brain stops

        calls: dict[int, dict] = {}
        usage, finish, head_seen, pending = {}, "stop", False, ""
        probs: list = []                                      # G5: each token's top log-probabilities, when asked for
        try:
            for raw in up:
                line = raw.decode("utf-8", "replace").strip()
                if not line.startswith("data:"):
                    continue
                data = line[5:].strip()
                if data == "[DONE]":
                    break
                ev = json.loads(data)
                if ev.get("usage"):
                    usage = ev["usage"]
                if ev.get("timings"):
                    kvring.note(body.get("_slot"), getattr(self, "lane", None), ev["timings"], getattr(self, "did", {}))
                for ch in ev.get("choices") or []:
                    probs.extend((ch.get("logprobs") or {}).get("content") or [])
                    d = ch.get("delta") or {}
                    finish = ch.get("finish_reason") or finish
                    for tc in d.get("tool_calls") or []:
                        slot = calls.setdefault(tc.get("index", 0), {"name": "", "arguments": ""})
                        fn = tc.get("function") or {}
                        slot["name"] += fn.get("name") or ""
                        slot["arguments"] += fn.get("arguments") or ""
                    if d.get("reasoning_content"):
                        emit({"model": model, "message": {"role": "assistant", "content": "", "thinking": d["reasoning_content"]}, "done": False})
                    text = d.get("content") or ""
                    if text:
                        if not head_seen:                  # hold the first words until the channel mark can be judged
                            pending += text
                            if len(pending) < 24 and "<" in pending:
                                continue
                            text, head_seen = _clean(pending), True
                        if text:
                            emit({"model": model, "message": {"role": "assistant", "content": text}, "done": False})
            if pending and not head_seen and _clean(pending):
                emit({"model": model, "message": {"role": "assistant", "content": _clean(pending)}, "done": False})
            final = {"model": model, "message": {"role": "assistant", "content": ""}, "done": True, "done_reason": finish,
                     "total_duration": int((time.time() - t0) * 1e9), "prompt_eval_count": usage.get("prompt_tokens", 0),
                     "eval_count": usage.get("completion_tokens", 0)}
            if probs:
                import certainty
                final["lacuna_certainty"] = certainty.measure(probs)
            if calls:
                final["message"]["tool_calls"] = _calls([{"function": c} for _, c in sorted(calls.items())])
            emit(final)
            self.wfile.write(b"0\r\n\r\n")
            live.note(model=str(model), lane=getattr(self, "lane", None), who=self.headers.get("X-Lacuna-Lane"), slot=body.get("_slot"),
                      body=req, said="".join(said), thought="".join(thought), calls=final["message"].get("tool_calls"),
                      ms=int((time.time() - t0) * 1000), tokens=usage.get("completion_tokens"))
        except (BrokenPipeError, ConnectionResetError, OSError, ValueError):
            pass
        finally:
            stop()
            up.close()


def _reaper(every_s: float = 30):
    while True:
        time.sleep(every_s)
        for name in POOL.reap():
            print(f"small mind {name} stopped after {minds.IDLE_S:.0f} s idle", flush=True)


def _quit(*_):
    POOL.stop_all()                   # a restart must not leave small servers holding memory nobody can reach
    os._exit(0)


def main():
    n = minds.Pool.stop_orphans()
    refresh_small()
    signal.signal(signal.SIGTERM, _quit)
    signal.signal(signal.SIGINT, _quit)
    threading.Thread(target=_reaper, daemon=True).start()
    srv = ThreadingHTTPServer(("127.0.0.1", LISTEN), Door)
    srv.daemon_threads = True
    print(f"brain gateway on 127.0.0.1:{LISTEN} → brain {BRAIN}, others {OLLAMA}; small minds on llama.cpp: "
          f"{', '.join(sorted(SMALL)) or 'none'}" + (f" ({n} orphaned servers stopped)" if n else ""), flush=True)
    srv.serve_forever()


if __name__ == "__main__":
    main()
