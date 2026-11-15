"""THE CLOUD SEAT — Google's models as one more rung of Lacuna's ladder, for work that carries no customer data (the owner,
2026-10-19: "it's really for long running big tasks or things like that where we need advice … if it's offline, then it's
handled locally … go design that").

The cloud PROPOSES; the box DECIDES. Every answer is checked here before it is used — a cart by the foreman's trial, a
plan by the tests, a judgment by agreement with the local vote — and a cloud that is down, out of credit or refusing is
simply a rung that is not there: the work stays local, nothing waits.

  KINDS (what is sent, and how — the payload is BUILT BY CODE from local reads, never free text from a model)
    cart-draft      the 26B failed a cart's trial three times → the cart brief, the owner's words, the trial's last
                    problems → a draft, tried by the foreman                                         (fast: Flash)
    second-opinion  the local judge split → the question and its facts → yes/no + why; it may only CONFIRM the local
                    majority (then the act goes on); anything else goes to the owner, as before      (Flash, thinking medium)
    review          a cart's program + its run record → the faults a reviewer would name             (fast: Flash)
    plan            a big file's outline (G16) + a goal → numbered steps for the box to carry out    (Flash, thinking high)

  THE GUARDS
    scrub           secrets and keys out, always; a payload that names customer data (buyer, ship-to, address,
                    receipt, e-mail …) is REFUSED, never trimmed
    one try         a refusal or an error is never retried: the seat RESTS (402 credits gone: 6 h; 429: 15 min; else
                    5 min) and says why on /api/cloud — the box's law against loops on outside sites
    budget          calls per day per model, and 2 s between calls
    ledger          every call: kind, model, bytes out, a hash of what left, tokens, cached tokens, seconds, outcome
                    (~/.lacuna/cloud-ledger.jsonl; /api/cloud shows it)
    cache           the fixed head (the brief, the grammar, the rules) is always FIRST and byte-identical, so Google's
                    implicit prefix cache serves it (cachedContentTokenCount says so in the ledger)

  ask(kind, head, body)   → {ok, text, model, cached, secs} or {ok: False, why, resting?}
"""
from __future__ import annotations

import hashlib
import json
import re
import threading
import time
import urllib.error
import urllib.request
from pathlib import Path

from fastapi import APIRouter

router = APIRouter()
HOME = Path.home()
KEYS = (HOME / ".curator-dev" / "secrets" / "gemini-free-key.txt", HOME / ".curator-dev" / "secrets" / "google-key.txt")
API = "https://generativelanguage.googleapis.com/v1beta/models"
# measured on the free key 2026-10-19 (one fixed 4.2k-token head): Flash thinking at its default spent 2,877 thinking tokens
# for a 118-token cart — 28 s; at thinkingLevel "low" the same cart came back in 3.1 s. Gemma 4 31B: 58 s, then a 500.
# Pro: no free quota (429). So every kind runs on Flash, at the thinking its work needs; the trial checks the fast ones.
MODEL = {"chat": "gemini-3.8-flash", "wiki": "gemini-3.8-flash", "merge": "gemini-3.8-flash", "mocks": "gemini-3.8-flash", "cart-draft": "gemini-3.8-flash", "review": "gemini-3.8-flash", "second-opinion": "gemini-3.8-flash", "plan": "gemini-3.8-flash"}
THINK = {"chat": "medium", "wiki": "low", "merge": "medium", "mocks": "low", "cart-draft": "low", "review": "low", "second-opinion": "medium", "plan": "high"}
PER_DAY = {"gemini-3.8-flash": 200}
GAP_S = 2.0
CUSTOMER = re.compile(r"\b(buyer|ship[_ -]?to|shipping[_ ]address|street|zip ?code|postal|receipt[_ ]?id|order[_ ]?id|customer|"
                      r"first[_ ]name|last[_ ]name|phone|e-?mail)\b|[\w.+-]+@[\w-]+\.[\w.]+", re.I)
SECRET = re.compile(r"AIza[0-9A-Za-z_-]{30,}|sk-[A-Za-z0-9_-]{20,}|Bearer\s+[A-Za-z0-9._-]{16,}|\b[A-Fa-f0-9]{40,}\b|"
                    r"-----BEGIN [A-Z ]+KEY-----[\s\S]*?-----END [A-Z ]+KEY-----")

_lock = threading.Lock()
_state = {"rest_until": 0.0, "why": None, "last": 0.0}


def _ledger() -> Path:
    from .core import LACUNA_HOME
    return Path(LACUNA_HOME) / "cloud-ledger.jsonl"


def _key() -> str | None:
    for p in KEYS:
        try:
            k = p.read_text().strip()
            if k:
                return k
        except OSError:
            continue
    return None


def _owner_allows_customer_words() -> bool:
    try:
        return json.loads((HOME / ".lacuna" / "cloud-sight.json").read_text()).get("allow_customer_words") is True
    except (OSError, ValueError):
        return False


def scrub(text: str) -> tuple[str | None, str | None]:
    """(the text with secrets removed, None) — or (None, why) when it names customer data: refused, never trimmed."""
    m = CUSTOMER.search(text or "")
    if m:
        return None, f"the payload names customer data ({m.group(0)!r}) — the cloud seat never carries it"
    return SECRET.sub("<secret>", text or ""), None


def _today_count(model: str) -> int:
    day = time.strftime("%Y-%m-%d")
    try:
        return sum(1 for ln in _ledger().read_text().splitlines()[-3000:] if f'"day": "{day}"' in ln and f'"model": "{model}"' in ln)
    except OSError:
        return 0


def _note(row: dict) -> None:
    try:
        with _ledger().open("a") as f:
            f.write(json.dumps({"t": round(time.time(), 1), "day": time.strftime("%Y-%m-%d"), **row}) + "\n")
    except OSError:
        pass


def _gen_cfg(model: str, kind: str, temperature: float, max_out: int) -> dict:
    """Gemma 4 answers 400 "Thinking level is not supported for this model" to a thinkingLevel (2026-10-19, tested); it
    thinks by default and returns its thoughts as parts marked thought. Gemini models take the level."""
    cfg = {"temperature": temperature, "maxOutputTokens": max_out}
    if not model.startswith("gemma"):
        cfg["thinkingConfig"] = {"thinkingLevel": THINK.get(kind, "low")}
    return cfg


def _rest(code: int | None, why: str, secs: float | None = None) -> None:
    secs = secs or (6 * 3600 if code == 402 else 900 if code == 429 else 300)
    _state.update(rest_until=time.time() + secs, why=why)


LEARNED = Path.home() / ".lacuna" / "cloud-limits.json"


def _next_reset() -> float:
    """Seconds to the next midnight Pacific — when Google's per-day free-tier counts start again."""
    from datetime import datetime, timedelta
    from zoneinfo import ZoneInfo
    now = datetime.now(ZoneInfo("America/Los_Angeles"))
    return (now.replace(hour=0, minute=0, second=5, microsecond=0) + timedelta(days=1) - now).total_seconds()


def learn_429(model: str, body: str) -> tuple[float, str]:
    """(seconds to rest, what was learned) from a 429's own words: WHICH quota (per minute · per day · tokens · requests),
    its value, and Google's retryDelay. Written to ~/.lacuna/cloud-limits.json, so the daily budget is what Google says
    it is, not what we guessed (2026-10-19: the seat assumed 200 a day; forum reports put Flash's free tier at 20 and
    Gemma's at 14,400, and limits move)."""
    try:
        d = json.loads(body)
    except ValueError:
        return 900, "a 429 whose body could not be read"
    viol, retry = [], None
    for det in (d.get("error") or {}).get("details") or []:
        if str(det.get("@type", "")).endswith("QuotaFailure"):
            viol += det.get("violations") or []
        if str(det.get("@type", "")).endswith("RetryInfo"):
            m = re.match(r"([\d.]+)s", str(det.get("retryDelay", "")))
            retry = float(m.group(1)) if m else None
    day = any("perday" in (v.get("quotaId", "") + v.get("quotaMetric", "")).lower().replace("_", "").replace(" ", "") for v in viol)
    try:
        cur = json.loads(LEARNED.read_text())
    except (OSError, ValueError):
        cur = {}
    m = cur.setdefault(model, {})
    for v in viol:
        m[v.get("quotaId") or v.get("quotaMetric") or "quota"] = {"value": v.get("quotaValue"), "metric": v.get("quotaMetric"),
                                                                "dimensions": v.get("quotaDimensions"), "seen": time.strftime("%Y-%m-%d %H:%M")}
    try:
        LEARNED.write_text(json.dumps(cur, indent=1))
    except OSError:
        pass
    secs = _next_reset() if day else max(65.0, (retry or 0) + 5)
    said = ", ".join(f"{v.get('quotaId') or v.get('quotaMetric')}={v.get('quotaValue')}" for v in viol) or "no quota named"
    return secs, f"{'per-day' if day else 'per-minute'} limit hit ({said})"


def learned_per_day(model: str) -> int | None:
    try:
        for qid, v in (json.loads(LEARNED.read_text()).get(model) or {}).items():
            if "perday" in qid.lower().replace("_", "").replace(" ", "") and "request" in qid.lower() and str(v.get("value") or "").isdigit():
                return int(v["value"])
    except (OSError, ValueError):
        pass
    return None


def ask(kind: str, head: str, body: str, *, max_out: int = 4000, temperature: float = 0.2, send=None, public_doc: bool = False, model: str | None = None) -> dict:
    """One call, one try. `head` is the fixed part (first, byte-stable: cached); `body` the variable part; `model` the owner's pick for the chat."""
    model = model or MODEL.get(kind)
    if not model:
        return {"ok": False, "why": f"no cloud kind {kind}"}
    import os
    if os.environ.get("LACUNA_NO_CLOUD") and send is None:      # tests (conftest) and any run that must stay on the box
        return {"ok": False, "why": "the cloud seat is off here (LACUNA_NO_CLOUD)"}
    with _lock:
        if time.time() < _state["rest_until"]:
            return {"ok": False, "resting": True, "why": f"the cloud seat rests until {time.strftime('%H:%M', time.localtime(_state['rest_until']))}: {_state['why']}"}
        cap = learned_per_day(model) or PER_DAY.get(model, 50)       # Google's own number once a 429 has told us
        if _today_count(model) >= cap:
            return {"ok": False, "why": f"today's {model} budget is spent ({cap})"}
        wait = GAP_S - (time.time() - _state["last"])
        if wait > 0:
            time.sleep(wait)
        _state["last"] = time.time()
    # E4: a marketplace's PUBLIC documentation names buyers and e-mails as fields; only the mocks kind, reading a page from
    # ~/lacuna-world/public-docs by code, skips the customer-word refusal — the secret scrub runs for every kind
    # THE OWNER'S WORD (2026-10-27: "tell the scrub I approve it all"): for the chat, when ~/.lacuna/cloud-sight.json says
    # allow_customer_words, the customer-word refusal is lifted; secrets are ALWAYS taken out (law 7), whatever is allowed
    allow = kind == "chat" and _owner_allows_customer_words()
    text, why = (SECRET.sub("<secret>", head + "\n\n" + body), None) if (public_doc and kind == "mocks") or allow else scrub(head + "\n\n" + body)
    if text is None:
        _note({"kind": kind, "model": model, "ok": False, "why": why})
        return {"ok": False, "why": why}
    key = _key()
    if not key:
        return {"ok": False, "why": "no Google key on the box"}
    req = {"contents": [{"role": "user", "parts": [{"text": text}]}],
           "generationConfig": _gen_cfg(model, kind, temperature, max_out)}
    sha = hashlib.sha256(text.encode()).hexdigest()[:12]
    t0 = time.time()
    try:
        r = (send or _send)(model, req, key)
    except urllib.error.HTTPError as e:
        msg = e.read()[:6000].decode(errors="replace").replace(key, "<key>")
        why = "the project's prepaid credits are gone (AI Studio → the project → billing)" if e.code == 402 else f"refused {e.code}: {msg[:160]}"
        secs = None
        if e.code == 429:
            secs, learned = learn_429(model, msg)
            why = f"429: {learned}; resting {int(secs // 60)} min"
        _rest(e.code, why, secs)
        _note({"kind": kind, "model": model, "bytes": len(text), "sha": sha, "ok": False, "code": e.code, "why": why[:200]})
        return {"ok": False, "why": why, "resting": True}
    except (OSError, ValueError) as e:
        _rest(None, f"no answer ({e.__class__.__name__})")
        _note({"kind": kind, "model": model, "bytes": len(text), "sha": sha, "ok": False, "why": e.__class__.__name__})
        return {"ok": False, "why": f"the cloud did not answer ({e.__class__.__name__})", "resting": True}
    u = r.get("usageMetadata") or {}
    parts = ((r.get("candidates") or [{}])[0].get("content") or {}).get("parts") or []
    out = "".join(p.get("text", "") for p in parts if not p.get("thought"))
    row = {"kind": kind, "model": model, "bytes": len(text), "sha": sha, "ok": True, "in": u.get("promptTokenCount"),
           "cached": u.get("cachedContentTokenCount", 0), "out": u.get("candidatesTokenCount"), "secs": round(time.time() - t0, 2)}
    _note(row)
    return {"ok": True, "text": out, "model": model, "cached": row["cached"], "secs": row["secs"]}


def _send(model: str, req: dict, key: str) -> dict:
    url = f"{API}/{model}:generateContent"   # the key rides in a header, never in the URL (law 7: a URL lands in logs)
    with urllib.request.urlopen(urllib.request.Request(url, json.dumps(req).encode(), {"content-type": "application/json", "x-goog-api-key": key}), timeout=180) as r:
        return json.load(r)


def status() -> dict:
    rows = []
    try:
        rows = [json.loads(x) for x in _ledger().read_text().splitlines()[-200:]]
    except (OSError, ValueError):
        pass
    day = time.strftime("%Y-%m-%d")
    today = [r for r in rows if r.get("day") == day]
    return {"key": bool(_key()), "resting": time.time() < _state["rest_until"], "why": _state["why"],
            "rest_until": _state["rest_until"] or None, "models": MODEL, "budget": PER_DAY,
            "learned": (lambda: json.loads(LEARNED.read_text()) if LEARNED.exists() else {})(),
            "tokens_today": {"in": sum(r.get("in") or 0 for r in today), "out": sum(r.get("out") or 0 for r in today)},
            "today": {m: sum(1 for r in today if r.get("model") == m) for m in PER_DAY},
            "ok_today": sum(1 for r in today if r.get("ok")), "cached_tokens_today": sum(r.get("cached") or 0 for r in today),
            "last": rows[-12:][::-1]}


@router.get("/api/cloud")
def r_status() -> dict:
    return status()


# ── STREAMED PLANNING WITH A FALLBACK CHAIN (2026-10-19, the owner: "see what the cloud one is thinking as it's planning") ──
# CLOUD LACUNA IS GEMINI FLASH (the owner, 2026-10-19: "use Gemini Flash for both Cloud Lacuna chat and work"): the quick, strong mind for
# second opinions and for planning; Gemma 4 31B is the fallback if Flash rests or refuses (a 503 from one must not stall the other), and
# is the BULK WORKER — plentiful (about 15,000 a day reported), a little slower, good enough: Lacuna farms grunt work out to it (`farm`).
PLAN_MODELS = ["gemini-3.8-flash", "gemma-4-31b-it"]
FARM_MODELS = ["gemma-4-31b-it", "gemma-4-26b-a4b-it"]
RESERVE = {}                                              # no reserve now: Flash is first; Gemma has the count to spare
_model_rest: dict = {}


def ask_stream(kind: str, head: str, body: str, on_event, models: list[str] | None = None, max_out: int = 8000) -> dict:
    """One planning call, streamed: `on_event({"type": "thought"|"text", "text"})` as the cloud writes. A refusal (429 · 503 ·
    403 · 400) rests THAT model and the next in the chain is tried once; nothing is retried on the same model."""
    import os
    if os.environ.get("LACUNA_NO_CLOUD"):
        return {"ok": False, "why": "the cloud seat is off here (LACUNA_NO_CLOUD)"}
    allow = _owner_allows_customer_words() and kind == "chat"
    text, why = (SECRET.sub("<secret>", head + "\n\n" + body), None) if allow else scrub(head + "\n\n" + body)
    if text is None:
        _note({"kind": kind, "ok": False, "why": why})
        return {"ok": False, "why": why}
    key = _key()
    if not key:
        return {"ok": False, "why": "no Google key on the box"}
    tried = []
    for model in models or PLAN_MODELS:
        if time.time() < _model_rest.get(model, 0):
            tried.append(f"{model} rests until {time.strftime('%H:%M', time.localtime(_model_rest[model]))}")
            continue
        cap = learned_per_day(model) or PER_DAY.get(model)
        if cap and _today_count(model) >= cap - (RESERVE.get(model, 0) if model != (models or PLAN_MODELS)[0] else 0):
            tried.append(f"{model}: today's count is spent or reserved for quick asks ({cap})")
            continue
        with _lock:
            wait = GAP_S - (time.time() - _state["last"])
            if wait > 0:
                time.sleep(wait)
            _state["last"] = time.time()
        req = {"contents": [{"role": "user", "parts": [{"text": text}]}], "generationConfig": _gen_cfg(model, kind, 0.2, max_out)}
        url = f"{API}/{model}:streamGenerateContent?alt=sse"   # the key rides in a header, never in the URL (law 7)
        t0, out, usage = time.time(), [], {}
        try:
            with urllib.request.urlopen(urllib.request.Request(url, json.dumps(req).encode(), {"content-type": "application/json", "x-goog-api-key": key}), timeout=300) as r:
                for raw in r:
                    line = raw.decode(errors="replace").strip()
                    if not line.startswith("data:"):
                        continue
                    try:
                        j = json.loads(line[5:])
                    except ValueError:
                        continue
                    usage = j.get("usageMetadata") or usage
                    for p in ((j.get("candidates") or [{}])[0].get("content") or {}).get("parts") or []:
                        if p.get("text"):
                            on_event({"type": "thought" if p.get("thought") else "text", "text": p["text"], "model": model})
                            if not p.get("thought"):
                                out.append(p["text"])
        except urllib.error.HTTPError as e:
            msg = e.read()[:6000].decode(errors="replace").replace(key, "<key>")
            if e.code == 429:
                secs, learned = learn_429(model, msg)
                _model_rest[model] = time.time() + secs
                tried.append(f"{model}: {learned}")
            else:
                _model_rest[model] = time.time() + (60 if e.code == 503 else 600)
                tried.append(f"{model}: refused {e.code}")
            _note({"kind": kind, "model": model, "bytes": len(text), "ok": False, "code": e.code, "why": tried[-1][:200]})
            continue
        except (OSError, ValueError) as e:
            tried.append(f"{model}: no answer ({e.__class__.__name__})")
            _model_rest[model] = time.time() + 60
            continue
        _note({"kind": kind, "model": model, "bytes": len(text), "ok": True, "in": usage.get("promptTokenCount"),
               "cached": usage.get("cachedContentTokenCount", 0), "out": usage.get("candidatesTokenCount"), "secs": round(time.time() - t0, 2)})
        return {"ok": True, "text": "".join(out), "model": model, "secs": round(time.time() - t0, 1), "tried": tried}
    return {"ok": False, "why": "; ".join(tried) or "no cloud model available", "tried": tried}
