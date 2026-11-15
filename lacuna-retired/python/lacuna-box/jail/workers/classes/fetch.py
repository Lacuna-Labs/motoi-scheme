"""fetch — Lacuna's own web hand: search, read, extract, remember (LACUNA-1.3-DESIGN §17, B10).

Like a crawler service, but ours and polite: Lacuna's `web.search` (no key) and `web.read` (one page as text, capped,
never a private address, every redirect checked) — the same fenced tools the console's chat uses. Then the resident
brain reads each page for the ask and hands back FACTS WITH THEIR QUOTES (schema-bound); a claim with no quote from the
page is dropped. Each kept fact goes into the cortex with its URL as source, and the report answers the ask in two
sentences with how sure it is.

  inputs:  ask (required) · results (5) · read (4) · fields (optional: names of values to pull, e.g. ["price","title"])
  bounds:  the card's web_pages limit · no logins, no forms, no CAPTCHA (never) · a polite pace between pages
"""
from __future__ import annotations

import importlib.util
import json
import os
import subprocess
import sys
import time
import types
import urllib.request

HOME = os.path.expanduser("~")
TOOLS = f"{HOME}/lacuna-world/tools"
WEB = f"{HOME}/code/lacuna/lacuna-api/lacuna_api/control/web.py"
OLLAMA = "http://127.0.0.1:11434"
PACE_S = 1.5
# a page that is a bot check, not the page: skipped and SAID, never got around (no CAPTCHA defeat, ever)
WALLS = ("checking your browser", "verify you are human", "are you a robot", "captcha", "access denied",
         "enable javascript", "please enable cookies", "unusual traffic", "request unsuccessful", "pardon our interruption")


def wall(text: str) -> bool:
    t = text[:1500].lower()
    return len(text.strip()) < 300 or any(w in t for w in WALLS)


def _web(w):
    """Lacuna's fenced web tools, loaded with the worker's own audit (the API's core is not in the jail)."""
    pkg = types.ModuleType("lacuna_web_pkg")
    pkg.__path__ = []
    core = types.ModuleType("lacuna_web_pkg.core")
    core.audit = lambda who, action, **kw: w.progress(f"{action}: {json.dumps(kw)[:160]}")
    sys.modules["lacuna_web_pkg"], sys.modules["lacuna_web_pkg.core"] = pkg, core
    spec = importlib.util.spec_from_file_location("lacuna_web_pkg.web", WEB)
    mod = importlib.util.module_from_spec(spec)
    sys.modules["lacuna_web_pkg.web"] = mod
    spec.loader.exec_module(mod)
    return mod


FACTS = {"type": "object", "properties": {"facts": {"type": "array", "items": {"type": "object", "properties": {
    "claim": {"type": "string"}, "quote": {"type": "string"}, "values": {"type": "object"}}, "required": ["claim", "quote"]}}},
    "required": ["facts"]}
ANSWER = {"type": "object", "properties": {"answer": {"type": "string"}, "confidence": {"type": "number"}},
          "required": ["answer", "confidence"]}


def ask_model(w, schema: dict, system: str, user: str, cap: int = 1500) -> dict:
    box = json.load(open(f"{HOME}/.lacuna/box.json"))
    seat = box["seats"]["worker"]
    ka = seat.get("keep_alive")
    body = {"model": seat["model"], "stream": False, "think": False, "format": schema, "keep_alive": "10m" if ka in (None, "", "24h", "-1", -1) else ka,
            "options": {"num_ctx": int(seat.get("ctx", 65536)), "temperature": 0.1, "num_predict": cap},
            "messages": [{"role": "system", "content": system}, {"role": "user", "content": user}]}
    t0 = time.time()
    req = urllib.request.Request(f"{OLLAMA}/api/chat", data=json.dumps(body).encode(), headers={"Content-Type": "application/json"})
    import lane
    with lane.background(), urllib.request.urlopen(req, timeout=300) as r:
        out = json.load(r)
    w.spend(brain_seconds=time.time() - t0, tokens_in=int(out.get("prompt_eval_count") or 0),
            tokens_out=int(out.get("eval_count") or 0), seat="worker")
    return json.loads(out["message"]["content"])


def run(w):
    ask = (w.inputs.get("ask") or w.job.get("brief") or "").strip()
    if not ask:
        return {"ok": False, "said": "no question was asked (inputs.ask)", "outputs": []}
    fields = w.inputs.get("fields") or []
    limit_pages = int(w.constraints.get("max_pages") or w.inputs.get("read", 4))
    web = _web(w)
    w.progress(f"searching: {ask}")
    found = web.search(ask, who=w.id, limit=int(w.inputs.get("results", 10)))
    results = found.get("results") or []
    if not results:
        return {"ok": False, "said": f"the search found nothing for: {ask} ({found.get('why') or 'no results'})", "outputs": []}
    kept, read, sources, walled = [], 0, [], []
    for r in results:
        if read >= limit_pages or w.over():
            break
        url = r.get("url") or r.get("href")
        if not url:
            continue
        time.sleep(PACE_S)                                  # a polite pace: one page at a time, never a burst
        page = web.read(url, who=w.id, chars=9000)
        read += 1
        w.spend(pages=1)
        text = page.get("text") or ""
        if not text or wall(text):
            walled.append(url.split("/")[2] if "//" in url else url)
            w.progress(f"{walled[-1]} showed a bot check, not the page — skipped (never got around)")
            read -= 1                                       # a wall is not a page read: the next result gets the turn
            continue
        sources.append(url)
        sysmsg = ("You read one web page for a question. Return only facts the page itself states, each with an exact quote "
                  "from the page (copy the words, under 200 characters). No quote, no fact. At most 8 facts, the ones that answer the "
                  "question best. " + (f"Pull these values when the page states them: "
                                                                          f"{', '.join(fields)}." if fields else ""))
        try:
            got = ask_model(w, FACTS, sysmsg, f"Question: {ask}\n\nPage ({url}):\n{text[:8000]}", cap=3000)
        except (OSError, ValueError) as e:                   # a cut or broken answer costs this page, never the job
            w.progress(f"{url[:60]}: the answer could not be read ({type(e).__name__}) — next page")
            continue
        for f in got.get("facts") or []:
            q = (f.get("quote") or "").strip()
            flat = " ".join(text.lower().split())
            if q and " ".join(q.lower().split())[:60] in flat:  # the quote must really be on the page
                kept.append({**f, "url": url})
        w.progress(f"read {url[:80]} — {len(kept)} sourced fact(s) so far", done=read, total=limit_pages)
    if not kept:
        why = f"; {len(walled)} site(s) showed a bot check instead ({', '.join(sorted(set(walled)))})" if walled else ""
        return {"ok": False, "said": f"read {read} page(s); none stated anything quotable about: {ask}{why}", "outputs": [],
                "sources": sources, "walled": walled}
    ans = ask_model(w, ANSWER, "Answer the question in at most two sentences from these sourced facts only; say how sure "
                    "you are (0–1). If the facts disagree, say so.",
                    f"Question: {ask}\n\nFacts:\n" + "\n".join(f"- {k['claim']} (\"{k['quote'][:160]}\" — {k['url']})" for k in kept[:30]),
                    cap=400)
    for i, k in enumerate(kept[:20]):                       # each fact into the cortex, its URL the source
        key = f"web-{w.id[2:]}-{i}"
        subprocess.run([f"{TOOLS}/cortex", "remember", "fact", key,
                        json.dumps({"text": k["claim"], "quote": k["quote"][:400], "source": k["url"], "ask": ask, "by": w.id})],
                       capture_output=True, text=True, timeout=60)
    return {"ok": True, "said": ans.get("answer", ""), "confidence": ans.get("confidence"), "facts": kept[:20],
            "sources": sources, "walled": walled, "outputs": [{"kind": "facts", "count": len(kept)}],
            "anti_taxonomy": ["no logins, no forms", "read only", "every fact quoted from its page"]}
