"""THE OWNER'S CONTROL OVER THE AI (the owner, 2026-10-18: "It's not Lacuna's interface. It's not the LLM's interface.
It's mine. Give me that control over the AI … unload it and reload it … change models … talk to another AI … it
recommends to me that I can't load it because of memory constraints").

  GET  /api/ai              the box's memory as the AI sees it: the brain (up, its model, its share), the small minds
                            loaded and the room left for them, and every model on the box with whether it can load now
                            and, when not, why (reserved, over budget, needs the brain unloaded)
  POST /api/ai/brain/restart  restart the brain (its launchd job): Lacuna is unreachable for about a minute
  POST /api/ai/minds/unload   unload the small minds now (the gateway reloads one on its next request)
  POST /api/ai/talk         {model, text} → one answer from that model, through the gateway (its memory guard decides)
Only a person acts here (Lacuna's own calls are refused); every act is audited.
"""
from __future__ import annotations

import json
import os
import subprocess
import time
import urllib.request

GATEWAY = "http://127.0.0.1:11434"
OLLAMA = "http://127.0.0.1:11435"
BRAIN_LABEL = "ai.lacunalabs.brain"
BOX_GB = 32


def _get(url: str, timeout: float = 3) -> dict:
    try:
        with urllib.request.urlopen(url, timeout=timeout) as r:
            return json.loads(r.read().decode() or "{}")
    except Exception as e:  # noqa: BLE001 — a part that does not answer is said, never a 500
        return {"ok": False, "why": f"{e.__class__.__name__}"}


def state() -> dict:
    minds = _get(f"{GATEWAY}/lacuna/minds")
    tags = _get(f"{OLLAMA}/api/tags").get("models") or []
    prof = minds.get("profile") or {}
    from .core import LACUNA_HOME
    bp = {}
    try:                                    # the ACTIVE brain's full profile (name, kind, size_gb), not just its chat settings
        bp = json.loads((LACUNA_HOME / "brain-profile.json").read_text())
    except (OSError, ValueError):
        pass
    reserved = prof.get("reserved") or {}
    small = set(minds.get("small") or [])
    budget = float(minds.get("budget_gb") or 0)
    used = float(minds.get("in_use_gb") or 0)
    brain_up = bool(_get("http://127.0.0.1:8091/health").get("status"))
    models = []
    for t in tags:
        name = t.get("name") or ""
        gb = round((t.get("size") or 0) / 2 ** 30, 2)
        base = name.removesuffix(":latest")
        if name.startswith(("lacuna-worker-lite", "gemma4:26b")):
            fit, why = True, "this is the brain (always loaded)"
        elif base in reserved or name in reserved:
            fit, why = False, f"reserved: {reserved.get(base) or reserved.get(name)}"
        elif name in small or base in small:
            w = float((minds.get("weights_gb") or {}).get(name) or (minds.get("weights_gb") or {}).get(base) or gb)
            fit, why = (w <= budget - used + 0.01), (f"fits: {w:.2f} GB of {budget - used:.2f} GB free for small minds"
                                                     if w <= budget - used + 0.01 else f"over budget: {w:.2f} GB, {budget - used:.2f} GB free")
        elif "embed" in name:
            fit, why = True, "an embedder (vectors, not talk)"
        else:
            fit, why = False, f"{gb} GB beside the 26B: the box has room for {budget:.1f} GB of small minds; unload the brain first"
        models.append({"name": name, "gb": gb, "fits": fit, "why": why})
    models.sort(key=lambda m: (not m["fits"], m["gb"]))
    return {"box_gb": BOX_GB, "brain": {"model": bp.get("brain") or prof.get("brain"), "name": bp.get("name"), "kind": bp.get("kind"),
            "up": brain_up, "gb": bp.get("size_gb") or 19},
            "reserve_gb": prof.get("reserve_gb"), "small": {"budget_gb": budget, "in_use_gb": used, "loaded": minds.get("minds") or []},
            "models": models, "at": time.time()}


def restart_brain(who: str) -> dict:
    from .core import audit
    p = subprocess.run(["launchctl", "kickstart", "-k", f"gui/{os.getuid()}/{BRAIN_LABEL}"], capture_output=True, text=True, timeout=20)
    audit(who, "ai.brain.restart", code=p.returncode)
    return {"ok": p.returncode == 0, "said": "The brain is restarting. Lacuna answers again in about a minute." if p.returncode == 0 else p.stderr[-200:]}


def unload_minds(who: str) -> dict:
    """The small minds' llama-servers (ports 8092-8099) are stopped; the gateway starts one again when it is asked."""
    from .core import audit
    stopped = []
    for port in range(8092, 8100):
        out = subprocess.run(["lsof", "-tiTCP:%d" % port, "-sTCP:LISTEN"], capture_output=True, text=True, timeout=5).stdout.split()
        for pid in out:
            try:
                os.kill(int(pid), 15)
                stopped.append(port)
            except (OSError, ValueError):
                pass
    audit(who, "ai.minds.unload", ports=stopped)
    return {"ok": True, "said": f"Unloaded {len(stopped)} small mind(s)." if stopped else "No small mind was loaded."}


def talk(model: str, text: str, who: str) -> dict:
    """One answer from any model on the box, through the gateway and its memory guard (person lane)."""
    from .core import audit
    body = json.dumps({"model": model, "stream": False, "messages": [{"role": "user", "content": str(text)[:4000]}],
                       "options": {"num_predict": 600}}).encode()
    req = urllib.request.Request(f"{GATEWAY}/api/chat", data=body, headers={"Content-Type": "application/json", "X-Lacuna-Lane": "person", "X-Lacuna-Prefix": "ai-control"})
    t0 = time.time()
    try:
        with urllib.request.urlopen(req, timeout=300) as r:
            out = json.loads(r.read().decode())
        audit(who, "ai.talk", model=model)
        return {"ok": True, "model": model, "reply": (out.get("message") or {}).get("content", ""), "ms": int((time.time() - t0) * 1000)}
    except urllib.error.HTTPError as e:
        why = e.read().decode(errors="replace")[:300]
        return {"ok": False, "model": model, "why": f"the gateway refused it: {why}"}
    except Exception as e:  # noqa: BLE001
        return {"ok": False, "model": model, "why": f"{e.__class__.__name__}: {str(e)[:200]}"}
