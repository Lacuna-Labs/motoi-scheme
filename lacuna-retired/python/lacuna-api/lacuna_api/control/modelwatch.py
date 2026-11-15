"""THE MODEL'S WATCHDOG (C23, 2026-09-25) — Lacuna watches the thing it thinks with.

His: "watchdogs for the model itself". Lacuna's model runs in Ollama (:11434, launchd `ai.lacunalabs.ollama`). If Ollama
dies, the tabs still work but the chat and the triage go quiet; nobody would notice until they asked a question. So:

  · ALIVE — every 20 s (workers._loop) it asks Ollama `/api/version` (2 s, costs nothing: no model is loaded for it).
    Two misses in a row = down: an alert, and nothing else (D2, 2026-10-25: launchd's KeepAlive restarts a crash; a kick
    here undid the broker's stops and could kill a 26B still loading); the first answer after that raises "back".
  · PRESENT — the model Lacuna uses (chat.MODEL) must be in `/api/tags`. Missing = an alert that names the fix
    (`ollama pull …`). It is NEVER pulled automatically: ~5 GB onto a disk that has been full before.
  · ANSWERS — real conversations record their own latency and failures (`record`, called by chat._ollama). Only when
    nothing has answered for an hour does the watchdog ask the model one token itself, with keep_alive 30 s, so the
    ~5 GB of weights leave memory again straight after (his law: idle must be zero). A probe slower than 90 s is an
    alert too — a model that answers in two minutes is down for a person waiting on it.

Everything the watchdog knows is `state()`, which /api/self returns under "model".
"""
from __future__ import annotations

import json
import os
import threading
import time
import urllib.request
from typing import Callable

from .core import LACUNA_HOME, audit, run

OLLAMA = os.environ.get("LACUNA_OLLAMA", "http://127.0.0.1:11434")
PROBE_AFTER_S = 3600      # ask the model ourselves only when nothing real has answered for this long
SLOW_S = 90

_lock = threading.Lock()
_s = {"up": None, "misses": 0, "last_kick": 0.0, "kicks": 0, "version": None, "present": None,
      "last_ok": 0.0, "last_ms": None, "last_error": None, "last_error_t": 0.0, "calls": 0, "fails": 0, "probe_t": 0.0}


def _health(url: str) -> bool:
    try:
        with urllib.request.urlopen(url, timeout=3) as r:
            return r.status == 200
    except Exception:  # noqa: BLE001
        return False


def _get(path: str, timeout: float) -> dict:
    with urllib.request.urlopen(f"{OLLAMA}{path}", timeout=timeout) as r:
        return json.loads(r.read().decode() or "{}")


def record(ok: bool, ms: int, error: str | None = None):
    """Every real call to the model reports here (chat._ollama) — the cheapest proof that it answers."""
    try:                                         # kept, so Work can show Lacuna's own record (rate, time) over days
        with open(os.path.join(os.environ.get("LACUNA_HOME") or str(LACUNA_HOME), "calls.jsonl"), "a") as f:
            f.write(json.dumps({"t": round(time.time(), 1), "ok": bool(ok), "ms": int(ms), **({"err": (error or "")[:120]} if not ok else {})}) + "\n")
    except OSError:
        pass
    with _lock:
        _s["calls"] += 1
        if ok:
            _s["last_ok"], _s["last_ms"] = time.time(), ms
        else:
            _s["fails"] += 1
            _s["last_error"], _s["last_error_t"] = (error or "")[:200], time.time()


def _probe(model: str) -> tuple[bool, int, str | None]:
    """One token from the model, in the smallest window Ollama allows.

    ★ A PROBE IS NOT A THIRD MODEL (2026-10-16). With no `num_ctx` this request loaded the probed weights at the
    server default (32K, 9.4 GB) — a *separate* runner from the desk's 16K one — and every hour it evicted whatever
    was resident (43 "predicted to exceed available memory, evicting" in one night). A 2K window is enough to say
    "ok", and `keep_alive: 0` gives the memory straight back.
    """
    body = json.dumps({"model": model, "prompt": "Say ok.", "stream": False, "think": False, "keep_alive": 0,
                       "options": {"num_predict": 1, "num_ctx": 2048}}).encode()
    t0 = time.time()
    try:
        req = urllib.request.Request(f"{OLLAMA}/api/generate", data=body, headers={"Content-Type": "application/json"})
        with urllib.request.urlopen(req, timeout=180) as r:
            json.loads(r.read().decode())
        return True, int((time.time() - t0) * 1000), None
    except Exception as e:
        return False, int((time.time() - t0) * 1000), f"{e.__class__.__name__}: {e}"[:200]


def check(model: str, alert: Callable, kick: bool = True) -> dict:
    """One pass. `alert(key, level, title, body)` is workers.raise_alert (passed in: workers imports this module)."""
    now = time.time()
    # THE BRAIN ITSELF, not the gateway's pass-through (2026-10-18: /api/version is answered by Ollama even when the 26B
    # on llama.cpp is dead, so a dead brain was never noticed and the kick went to Ollama): the brain's own /health on
    # :8091 and the gateway's /health on :11434; the one that is down is the one restarted
    brain_ok = _health("http://127.0.0.1:8091/health")
    gate_ok = _health("http://127.0.0.1:11434/health")
    up = brain_ok and gate_ok
    _s["down_part"] = None if up else ("ai.lacunalabs.brain" if not brain_ok else "ai.lacunalabs.brain-gateway")
    was = _s["up"]
    if up:
        _s["misses"] = 0
        if was is False:
            alert("model:up", "info", "Lacuna's model is back", "The brain and its gateway answer again.")
        _s["up"] = True
    else:
        _s["misses"] += 1
        if _s["misses"] >= 2 and was is not False:
            _s["up"] = False
            alert("model:up", "error", "Lacuna's model is DOWN",
                  f"{'The brain (llama.cpp :8091)' if _s.get('down_part') == 'ai.lacunalabs.brain' else 'The brain gateway (:11434)'} does not answer — the chat and the triage are quiet; the desk still works. launchd restarts a crash; a stop by the broker or the owner stays.")
        # NO KICK (D2, 2026-10-25): launchd's KeepAlive restarts a crashed brain, gateway or Ollama on its own; a stop that is
        # not a crash is the broker's (a swap, the forge's park) or the owner's, and a kick here undid it or killed a 26B still
        # loading its weights (the audit: three kicks at a booted-out brain on 10-25). The watch says DOWN once and records.
        return state()

    try:
        names = [m["name"] for m in _get("/api/tags", 4).get("models", [])]
        present = model in names or f"{model}:latest" in names
        if not present and model in ("lacuna-worker-lite", "lacuna", "lacuna:latest", "gemma4:12b"):
            # THE BRAIN IS NOT AN OLLAMA MODEL (2026-10-20: "lacuna-worker-lite is missing" fired after every restart): it is llama-server on
            # :8091 under that alias, so a healthy llama-server is the model being present
            import urllib.request as _u
            with _u.urlopen("http://127.0.0.1:8091/health", timeout=3) as r:
                present = r.status == 200
    except Exception:
        present = None
    if present is False and _s["present"] is not False:
        alert("model:present", "error", f"Lacuna's model {model} is missing", f"Ollama runs but has no {model} — `ollama pull {model}` brings it back (~5 GB)")
    if present and _s["present"] is False:
        alert("model:present", "info", f"{model} is back", "Ollama has the model again")
    _s["present"] = present

    if present and now - max(_s["last_ok"], _s["probe_t"]) >= PROBE_AFTER_S:
        _s["probe_t"] = now
        # on its own thread: loading the weights takes seconds and a sick model up to 180 s, and this pass runs on the
        # worker thread whose heartbeat /api/self reads — the watcher must never look dead because the model is slow
        threading.Thread(target=_probe_and_judge, args=(model, alert), name="lacuna-model-probe", daemon=True).start()
    return state()


def _busy() -> bool:
    """The brain's own slots (llama-server /slots): a slot processing is the brain WORKING — a probe would only queue behind
    it and time out (2026-10-19: 'does not answer' raised at 180 s while a task's review held the slot)."""
    try:
        import json as _j
        import urllib.request
        with urllib.request.urlopen("http://127.0.0.1:8091/slots", timeout=3) as r:
            return any(s.get("is_processing") for s in _j.loads(r.read()))
    except Exception:  # noqa: BLE001 — no slots answer: judge as before
        return False


def _probe_and_judge(model: str, alert: Callable):
    if _busy():                                  # busy is not broken: no probe, no alarm; the next pass looks again
        audit("lacuna", "model.probe.skipped", why="the brain is working (a slot is processing)")
        _s["last_ok"] = time.time()
        return
    ok, ms, err = _probe(model)
    record(ok, ms, err)
    audit("lacuna", "model.probe", ok=ok, ms=ms, error=err)
    if not ok:
        alert("model:answers", "error", f"{model} does not answer", f"Ollama is up but the model failed: {err}")
    elif ms > SLOW_S * 1000:
        alert("model:answers", "warn", f"{model} is slow", f"one token took {ms / 1000:.0f} s (over {SLOW_S} s)")


def state() -> dict:
    with _lock:
        s = dict(_s)
    t = time.time()
    return {"up": s["up"], "version": s["version"], "present": s["present"], "misses": s["misses"], "kicks": s["kicks"],
            "last_answer_ago_s": round(t - s["last_ok"]) if s["last_ok"] else None, "last_ms": s["last_ms"],
            "calls": s["calls"], "fails": s["fails"], "last_error": s["last_error"],
            "last_error_ago_s": round(t - s["last_error_t"]) if s["last_error_t"] else None}
