"""THE CHAT — Lacuna's mind on top of the tools: it reads the truth from them, acts through them, and says what it thinks.

His, 2026-09-24: *"we can talk to it… 'hey, kick the dev server'… and when it's done… 'thank you' and it says 'you're
welcome'… HAL… it's not a conversationalist, it's an important and serious worker… it needs to obey Claude and Alfred,
and Alfred primarily."*

THE JAIL IS HERE, NOT IN THE PROMPT. The model can only call the tools in TOOLS. Three tiers:
  · read     — anything that looks (services, health, errors, logs, disk, versions, builds, battery, runbooks). Free.
  · act      — our own things (dev API, vite, the simulator, builds, the battery, the suites). Done, and audited.
  · hers     — QA and her iPad. Never done by the model: it files a PETITION that a person approves in the console.
There is no shell tool and no file-write tool outside ~/.lacuna/drafts. A tool name it invents is refused and logged.
"""
from __future__ import annotations

import json
import re
import os
import threading
import time
import urllib.request
import uuid
from pathlib import Path
from typing import Callable

from . import artifacts, battery, card_verbs, deploys, docs, errors, health, maker_verbs, memory, modelwatch, self_portrait, services, web
from .core import LACUNA_HOME, audit, jobs as all_jobs, job_tail
from .workers import alerts as current_alerts

OLLAMA = os.environ.get("LACUNA_OLLAMA", "http://127.0.0.1:11434")
OLLAMA_BACK = os.environ.get("LACUNA_OLLAMA_BACK", "http://127.0.0.1:11435")   # Ollama itself, behind the gateway: model management (create)
# a person is waiting on a chat turn: the gateway keeps one of the brain's slots for exactly this (background takes the rest)
def _no_brain_words(e: Exception) -> str:
    """the honest line when a turn could not finish: busy (and with what) is not down (2026-10-19: a Pi turn held the
    person's slot and the chat said "I cannot reach my model", which read as broken)"""
    import urllib.request as _u
    try:
        with _u.urlopen("http://127.0.0.1:8091/slots", timeout=3) as r:
            busy = [x for x in json.load(r) if x.get("is_processing")]
        if busy:
            return (f"The brain is busy — {len(busy)} of its slots are working on a long turn — and yours waited too long "
                    f"({e.__class__.__name__}). Your words are kept; ask again in a minute.")
        return f"The brain is up but this turn failed ({e.__class__.__name__}). Ask again; if it repeats, the brain's log says why."
    except Exception:  # noqa: BLE001
        return f"The brain is not answering ({e.__class__.__name__}). The tools still work from the console; the Brain card can restart it."


PERSON_HEADERS = {"Content-Type": "application/json", "X-Lacuna-Lane": "person"}
import contextvars as _cv  # noqa: E402
PREFIX = _cv.ContextVar("lacuna_prefix", default="chat-general")
_WORK_MODE = {"last": "chat"}   # ruling 4: the one conversation's last work mode (brief.work_mode_of); a restart starts at chat   # G1: the lane whose warm head this turn uses (kvring.py)
def _desk_seat() -> dict:
    """The box's desk seat (~/.lacuna/box.json): ONE brain for the whole box (the owner, 2026-10-17) — the chat answers on
    the same model, context and keep-alive as every worker, so it never loads a second copy or reloads the first."""
    try:
        return json.loads((Path.home() / ".lacuna" / "box.json").read_text())["seats"]["desk"]
    except (OSError, ValueError, KeyError):
        return {}


MODEL = _desk_seat().get("model") or os.environ.get("LACUNA_MODEL", "lacuna-worker-lite")
# THE HAND-OVER (the owner, 2026-10-11: "the 8B can do most of the work, but I want the 27B as a coder that thinks
# it's the 8B — it takes over, like a handover"): a turn that is triage, code or reasoning goes to the deep model when one
# is named; quick turns stay on MODEL. Same system prompt, same memory — one Lacuna. Unset, every turn uses MODEL.
MODEL_DEEP = os.environ.get("LACUNA_MODEL_DEEP") or None
DRAFTS = LACUNA_HOME / "drafts"

# (the Beta instructions block that lived here is now prompt.md — one manual, read on every question)


def _t(tier: str, desc: str, props: dict | None = None, required: list | None = None):
    def deco(fn: Callable):
        fn._tool = {"tier": tier, "desc": desc, "props": props or {}, "required": required or []}
        return fn
    return deco


SVC = {"type": "string", "enum": list(services.SERVICES)}


@_t("read", "Status of every service: up or down, healthy, pid, whether launchd supervises it.")
def list_services(a, who):
    # One plain line per service — a small model reads these reliably; it misread the full JSON (2026-09-24).
    return [f"{s['title']} :{s['port']} — {'UP' if s['up'] else 'DOWN'}{'' if s['healthy'] is not False else ' (not healthy)'}"
            f"; {'launchd supervises it' if s['supervised'] else 'hand-started, NOT supervised'}"
            f"{'; HERS' if s['hers'] else ''}; pid {s['pid'] or '—'}" for s in services.all_status()]


@_t("read", "Why a service is not up: its log's last lines and the runbook's likely cause.", {"service": SVC}, ["service"])
def explain_service(a, who):
    return services.explain(a["service"])


@_t("read", "Health: disk, memory pressure, both APIs (healthz, shops, camera, turntable), and the watchdogs' latest states.")
def health_check(a, who):
    s = health.snapshot()
    lines = [f"disk: {s['disk']['free_gb']} GB free{' (LOW)' if s['disk']['low'] else ''}",
             f"memory: {s['memory']['available_gb']} GB available, pressure {s['memory']['pressure']}"]
    for env, x in s["apis"].items():
        hz = x.get("healthz") or {}
        lines.append(f"{x['label']} :{x['port']}: {'UP version ' + str(hz.get('version')) + ' commit ' + str(hz.get('sha')) if x['up'] else 'DOWN (' + str(x.get('error')) + ')'}")
    for env, ws in s["watchdogs"].items():
        bad = [w for w in ws if w["level"] in ("warn", "error")]
        lines.append(f"{env} watchdogs: {len(bad)} not healthy" + "".join(f"\n  - {w['name']}: {str(w['summary'])[:140]}" for w in bad[:10]))
    try:
        from .workers import drift_now
        for d in drift_now():
            lines.append(f"drift: {d['detail']}")
    except Exception:
        pass
    return "\n".join(lines)


@_t("read", "Error classes of the last N hours with counts and early-warning signals (new, rising, returned).",
    {"hours": {"type": "number"}, "env": {"type": "string", "enum": ["dev", "qa"]}})
def error_summary(a, who):
    h = float(a.get("hours") or 24)
    s = errors.summary(since_h=h)
    top = [r for r in s["top"] if not a.get("env") or r["env"] == a["env"]]
    lines = [f"{s['events_24h']} warning/error events in {s['classes']} kinds over {h:g} h; signals: "
             f"{s['signals']['new']} new, {s['signals']['rising']} rising, {s['signals']['returned']} returned",
             "by category: " + ", ".join(f"{c} {v['events']}" for c, v in sorted(s["by_category"].items(), key=lambda kv: -kv[1]["events"]))]
    for r in top[:12]:
        lines.append(f"- [{(r['signal'] or '').upper() or 'steady'}] {r['level']} {r['env']} {r['category']}: {r['subsystem']} {r['action']} — "
                     f"{r['template'][:120]} ({r['last_hour']} in 1 h, {r['last_day']} in 24 h, {r['count']} total)")
    return "\n".join(lines)


@_t("read", "Recent log lines, optionally filtered by env, level (info|warn|error|problems) and text.",
    {"env": {"type": "string"}, "level": {"type": "string"}, "text": {"type": "string"}, "limit": {"type": "integer"}})
def search_logs(a, who):
    return errors.recent_lines(env=a.get("env"), level=a.get("level"), q=a.get("text"), limit=min(int(a.get("limit") or 40), 120))


@_t("read", "Search the SRE manual, runbooks, environments and ports documents.", {"query": {"type": "string"}}, ["query"])
def search_runbooks(a, who):
    return docs.search(a["query"])


@_t("read", "Search the web (DuckDuckGo) for a question about macOS, launchd, Xcode, Python, a library or an error text — "
             "when the runbooks do not answer. Returns titles, links and snippets; read one with read_page.",
    {"query": {"type": "string"}}, ["query"])
def web_search(a, who):
    r = web.search(a.get("query") or "", who)
    # a lead is not a fact (2026-09-26: the Yankees "won a 0-0 World Series" in September, from snippets alone).
    # ★ THE TOP PAGE IS READ HERE (2026-09-28): told to call read_page first, the 8B stated the World Series from
    # snippets anyway (the bench). So the search reads its best result itself; the fact is in the answer's hands.
    if isinstance(r, dict) and r.get("results"):
        top = r["results"][0] if isinstance(r["results"][0], dict) else {}
        url = top.get("url") or top.get("link") or top.get("href") or ""
        if url:
            page = web.read(url, who)
            text = page.get("text") if isinstance(page, dict) else None
            if text:
                r["top_page"] = {"url": url, "text": str(text)[:4000]}
        r["note"] = ("the top result's page is read under top_page: answer from it and cite its url; the other results "
                     "are leads — call read_page on one before you state anything from its snippet")
    return r


@_t("read", "Read one public web page as text (capped). Never the Studio's own addresses.", {"url": {"type": "string"}}, ["url"])
def read_page(a, who):
    return web.read(a.get("url") or "", who)


@_t("read", "Every watchdog's latest word on both sides (dev and QA), with its age in seconds; a stale word is marked stale.")
def watchdogs(a, who):
    import time as _time
    now = _time.time()
    out = {}
    for env in ("dev", "qa"):
        rows = health.watchdogs(env)
        for w in rows:
            w["age_s"] = round(now - (w.get("t") or now)); w["stale"] = w["age_s"] > 1800
        out[env] = [{k: w.get(k) for k in ("name", "level", "summary", "age_s", "stale")} for w in rows]
    return out


@_t("read", "The boot report: what came back after the last reboot or restart of Lacuna, how fast, what did not, and which service would not survive a reboot.")
def boot_report(a, who):
    from . import boot
    return boot.report()


@_t("read", "The drills run so far (DiRT): which of our services were killed or booted out on purpose, and how fast each came back.")
def drills(a, who):
    from . import drill
    return {"running": drill.running(), "history": drill.history(12)}


@_t("act", "Run the minute's checks NOW (sample, evaluate, drift) — 'kick the watchdogs'. Says what it raised. Our side.")
def run_checks(a, who):
    from . import workers
    before = {x["key"] for x in workers.alerts(200)}
    workers.sample(); workers.evaluate()
    after = workers.alerts(200)
    return {"ok": True, "raised": [x for x in after if x["key"] not in before], "open_alerts": len([x for x in after if not x.get("acked")]), "drift": workers.drift_now()}


@_t("act", "DRILL one of OUR services (never QA, never the iPad): kill = SIGKILL it and time launchd's restart; bootout = unload and load its agent, the shape of a reboot. Takes up to two minutes; returns seconds until it answered again.",
    {"kind": {"type": "string", "enum": ["kill", "bootout"]}, "service": {"type": "string", "enum": [n for n in services.SERVICES if n not in ("qa-api", "lacuna")]}}, ["kind", "service"])
def run_drill(a, who):
    from . import drill, workers
    return drill.drill(a.get("kind") or "", a.get("service") or "", who, alerts_fn=workers.alerts, raise_alert=workers.raise_alert)


@_t("read", "THE RELEASE: the latest release job (dev → QA → the iPad) and its four steps — which is running, done, or stopped, and why. Read it when the owner asks how the release is going.")
def release_status(a, who):
    return deploys.release_status()


@_t("read", "RUNS: what your workers and carts did — every cart's latest run from artifacts/INDEX.slat (outcome done, "
            "press = waiting on the owner, or stopped, and why). Read it FIRST when asked what happened while he was away "
            "or how a job went; name a cart (repair, docs, review, fetch, codemap, testfix, disk-steward, recall-check, a cart's name) or a run id for its steps.",
    {"cart": {"type": "string"}, "run": {"type": "string"}}, [])
def runs(a, who):
    return artifacts.words(cart=a.get("cart") or None, run_id=a.get("run") or None)


@_t("read", "RECALL: search our whole conversation and your journal for earlier turns that mention these words — what he asked, what you answered, what was decided. Use it when he refers to something not in the recent turns.",
    {"query": {"type": "string"}}, ["query"])
def recall(a, who):
    return memory.recall(a.get("query") or "")


@_t("act", "REMEMBER in your graph cortex (your long memory; the newest version of a key wins and keeps its trail). Store "
    "anything you will want later: a FACT about the machine or the code, a DECISION and why, a LESSON from a failure, a "
    "PREFERENCE of the owner's, an EPISODE (what happened in a job). Give it a short stable key (e.g. ipad-profile-expiry, "
    "owner-prefers-autonomy) and the things it is about (cart names, files, people) so it can be found again.",
    {"kind": {"type": "string", "enum": ["fact", "decision", "lesson", "preference", "episode"]}, "key": {"type": "string"},
     "text": {"type": "string"}, "about": {"type": "array", "items": {"type": "string"}}}, ["kind", "key", "text"])
def remember(a, who):
    from . import lacuna_cortex
    key = re.sub(r"[^a-z0-9-]+", "-", str(a.get("key") or "").lower()).strip("-")[:80] or f"note-{int(time.time())}"
    r = lacuna_cortex.remember(str(a.get("kind") or "fact"), key, {"text": str(a.get("text") or "")[:2000], "by": who,
                               "at": time.strftime("%Y-%m-%dT%H:%M")}, [str(x)[:80] for x in (a.get("about") or [])][:8])
    return {"ok": not (isinstance(r, dict) and r.get("ok") is False), "kept": f"{a.get('kind')}:{key}", **({"why": r.get("why")} if isinstance(r, dict) and r.get("ok") is False else {})}


@_t("read", "CORTEX — your graph memory, by op: recall WORDS (by meaning; kind narrows: fact · decision · lesson · "
    "preference · episode · note; since=2026-10-18 or 48h looks back from a date) · trail KIND/KEY (a thing's history, every version) · like KIND/KEY (its neighbors: what is linked "
    "to it) · show KIND/KEY (one node and its edges) · since 24h (what is new) · fading 72 (what has gone quiet) · lessons "
    "WORDS (what failed before and what fixed it). Follow the breadcrumbs: recall → show/like a hit → trail it.",
    {"op": {"type": "string", "enum": ["recall", "trail", "like", "show", "since", "fading", "lessons"]}, "query": {"type": "string"},
     "kind": {"type": "string"}, "k": {"type": "integer"}, "since": {"type": "string"}}, ["query"])
def cortex(a, who):
    from . import lacuna_cortex
    op, q = str(a.get("op") or "recall"), str(a.get("query") or "").strip()
    k = max(1, min(20, int(a.get("k") or 10)))
    if op == "recall":
        since = str(a.get("since") or "").strip() or None      # a date or an ISO time: look back FROM then (2026-10-19)
        if since and re.fullmatch(r"\d+h", since):
            since = time.strftime("%Y-%m-%dT%H:%M:%S", time.localtime(time.time() - int(since[:-1]) * 3600))
        hits = lacuna_cortex.recall(q, kind=a.get("kind") or None, k=k, timeout=4.0, since=since)
        return {"ok": True, "op": op, "hits": hits or [], "n": len(hits or []),
                **({"next": "nothing found — try other words (names, errors, carts), or search_docs"} if not hits else {})}
    if op in ("show", "trail", "like"):
        kind, _, key = q.partition("/") if "/" in q else (a.get("kind") or "thing", "", q)
        argv = [op, kind, key] if op == "show" else [op, f"{kind}/{key}"]
    elif op == "since":
        argv = ["since", q or "24h"]
    elif op == "fading":
        argv = ["fading", q or "72"]
    else:                                             # lessons WORDS: what failed before, and what fixed it
        argv = ["lessons", *q.split()[:20]]
    r = lacuna_cortex._call(argv, timeout=6.0)
    if op == "lessons" and "no lessons" in str(r):      # the book is empty: the lessons kept by `remember` answer instead
        hits = lacuna_cortex.recall(q or "lesson failed fixed", kind="lesson", k=k, timeout=4.0)
        return {"ok": True, "op": op, "hits": hits or [], "n": len(hits or [])}
    return {"ok": not (isinstance(r, dict) and r.get("ok") is False), "op": op, "result": r}


@_t("act", "THE WORK QUEUE — your task list that survives reboots (~/lacuna-world/work/QUEUE.slat). op list (every item, "
    "its state, what it found) · add TITLE (words become a card; ref=a cart name with kind=cart) · show ID (its run, step by "
    "step) · start · stop · pause · resume · up · down ID · on · off · stop_all (queue OFF, the running item stopped, every "
    "queued item paused — use it the moment the owner says stop, drop it, enough, or brings his own plan). A job that needs the owner's yes: "
    "add it with waits_for=<the card id> — it stays out of the running while the card waits, goes FIRST the moment he approves, and ends when he declines "
    "(each job is also a node in your cortex: cortex recall job-W<n>).",
    {"op": {"type": "string", "enum": ["list", "add", "show", "start", "stop", "pause", "resume", "up", "down", "on", "off", "stop_all"]},
     "id": {"type": "string"}, "title": {"type": "string"}, "kind": {"type": "string"}, "ref": {"type": "string"}, "waits_for": {"type": "string"}}, ["op"])
def work(a, who):
    from . import task_runner, workqueue
    op = str(a.get("op") or "list")
    if op == "list":
        q = workqueue.load()
        return {"ok": True, "standing": workqueue.standing(), "items": [{k: i.get(k) for k in ("id", "kind", "ref", "state", "title")}
                | {"result": str(i.get("review") or i.get("note") or "")[:240]} for i in q["items"]]}
    if op == "add":
        ref = str(a.get("ref") or "")
        waits = str(a.get("waits_for") or "") or (ref if ref in _petitions else "")          # a ref that is a card id IS the card the job waits for
        return workqueue.add(str(a.get("title") or ""), f"lacuna ({who})", str(a.get("title") or ""), str(a.get("kind") or "goal"),
                             "" if waits and waits == ref else ref, waits_for=waits)
    if op == "show":
        ev = task_runner.events(str(a.get("id") or ""))
        return {"ok": True, "events": [{k: e.get(k) for k in ("type", "tool", "text", "why", "ok")} for e in ev[-30:]]}
    if op in ("on", "off"):
        return workqueue.switch(op == "on", f"lacuna ({who})")
    if op == "stop_all":
        return workqueue.stop_all(f"lacuna ({who})")
    return workqueue.hand(str(a.get("id") or ""), op, f"lacuna ({who})")


@_t("act", "CONDENSE the conversation since the last condensing into ONE summary node in your cortex (what was talked "
    "about, decided, left open; its facts and topics; its time span). It runs every hour by itself; call it when a long "
    "stretch of talk should be kept before you move on. Find summaries later with cortex recall … kind=summary, and their "
    "related material with cortex like summary/<key>.", {}, [])
def condense(a, who):
    from . import condense as _c
    return _c.condense(force=True)


@_t("act", "NOTES — your own working memory in markdown, ~/lacuna-world/notes/<topic>.md, found again by meaning (search_docs). "
    "op write (replace) · append (add a line or section) · read · list. Keep one per task or topic: its goal, plan, what you "
    "did, what you found, what is left. Read it back instead of carrying everything in the conversation.",
    {"op": {"type": "string", "enum": ["write", "append", "read", "list"]}, "topic": {"type": "string"}, "text": {"type": "string"}}, ["op"])
def notes(a, who):
    from pathlib import Path as _P
    d = _P.home() / "lacuna-world" / "notes"
    d.mkdir(parents=True, exist_ok=True)
    op = str(a.get("op") or "list")
    if op == "list":
        return {"ok": True, "notes": [{"topic": p.stem, "kb": round(p.stat().st_size / 1024, 1),
                                       "changed": time.strftime("%m-%d %H:%M", time.localtime(p.stat().st_mtime))}
                                      for p in sorted(d.glob("*.md"), key=lambda p: -p.stat().st_mtime)[:40]]}
    topic = re.sub(r"[^a-z0-9-]+", "-", str(a.get("topic") or "").lower()).strip("-")[:60]
    if not topic:
        return {"ok": False, "why": "name a topic"}
    p = d / f"{topic}.md"
    if op == "read":
        return {"ok": p.exists(), "topic": topic, "text": p.read_text()[-12000:] if p.exists() else "", **({} if p.exists() else {"why": "no such note yet"})}
    text = str(a.get("text") or "")
    stamp = time.strftime("%Y-%m-%d %H:%M")
    if op == "write":
        p.write_text(f"# {topic}\n_{stamp}_\n\n{text.strip()}\n")
    else:
        with open(p, "a") as f:
            f.write(f"\n- {stamp} — {text.strip()}\n")
    try:                                              # THE NOTE IN THE GRAPH TOO: a `note` node keyed by its topic, linked to it
        from . import lacuna_cortex
        lacuna_cortex.remember("note", topic, {"text": (text.strip() if op == "write" else p.read_text()[-1500:])[:1800],
                                               "file": str(p), "at": stamp}, [f"thing/{topic}"])
    except Exception:  # noqa: BLE001
        pass
    # findable by meaning within the door's next RAG walk (lacuna-node/frontend/rag-index.mjs, every 5 minutes)
    return {"ok": True, "topic": topic, "path": str(p), "kb": round(p.stat().st_size / 1024, 1)}


@_t("act", "WRITE YOUR OWN PLAYBOOK OR SKILL — how you do a kind of work, kept so the next time starts from it. kind playbook: "
    "~/lacuna-world/playbooks/<NAME>.md in the template of playbooks/README.md (BLUF · When · Authority · Before you start · "
    "Steps table Do|Expect|If not · Verify · Alternative techniques · Roll back · Stop and call the owner · Report · Related). "
    "kind skill: SKILL.md with front matter (name, description, for) then what to know and do. op write (whole text; the "
    "old one is kept as .bak) · read · list. Write one when you solved something a playbook did not cover, or improve the "
    "one you followed when a step was wrong. It is in your brief by the next question.",
    {"op": {"type": "string", "enum": ["write", "read", "list"]}, "kind": {"type": "string", "enum": ["playbook", "skill"]},
     "name": {"type": "string"}, "text": {"type": "string"}}, ["op", "kind"])
def write_doc(a, who):
    """The owner, 2026-10-19: "make sure it understands skills and playbooks and can make its own". The shell writes only to
    the workspace, so this is the one door to its own procedures. AUTHORITY.md and README.md are the owner's: never here."""
    from pathlib import Path as _P
    kind, op = str(a.get("kind") or ""), str(a.get("op") or "list")
    home = _P.home()
    if kind == "playbook":
        roots = [home / "lacuna-world" / "playbooks"]
    elif kind == "skill":
        roots = [_P(__file__).resolve().parents[3] / "lacuna-box" / "pi-agent" / "skills", home / ".lacuna" / "pi-agent" / "skills"]
    else:
        return {"ok": False, "why": "kind is playbook or skill"}
    if op == "list":
        r = roots[0]
        items = sorted(p.stem for p in r.glob("*.md")) if kind == "playbook" else sorted(p.parent.name for p in r.glob("*/SKILL.md"))
        return {"ok": True, "kind": kind, "names": items}
    raw = str(a.get("name") or "")
    name = re.sub(r"[^A-Z0-9-]+", "-", raw.upper()).strip("-")[:40] if kind == "playbook" else \
        re.sub(r"[^a-z0-9-]+", "-", raw.lower()).strip("-")[:40]
    if not name:
        return {"ok": False, "why": "name it"}
    rel = f"{name}.md" if kind == "playbook" else f"{name}/SKILL.md"
    if kind == "playbook" and name in ("AUTHORITY", "README"):
        return {"ok": False, "refused": f"{name}.md is the owner's; propose the change to him in words"}
    p = roots[0] / rel
    if op == "read":
        return {"ok": p.exists(), "path": str(p), "text": p.read_text()[:16000] if p.exists() else "", **({} if p.exists() else {"why": "none by that name"})}
    text = str(a.get("text") or "").strip()
    if len(text) < 200:
        return {"ok": False, "why": "a playbook or skill is at least a few steps; write it whole"}
    if kind == "skill" and not text.startswith("---"):
        text = f"---\nname: {name}\ndescription: {text.splitlines()[0][:200]}\n---\n\n{text}"
    if kind == "playbook":
        missing = [h for h in ("BLUF", "## When", "## Steps", "## Verify", "## Roll back") if h not in text]
        if missing:
            return {"ok": False, "why": "the playbook template needs these sections: " + ", ".join(missing) + " (playbooks/README.md)"}
    out = []
    for r in roots:
        f = r / rel
        f.parent.mkdir(parents=True, exist_ok=True)
        if f.exists():
            f.with_suffix(f.suffix + ".bak").write_text(f.read_text())
        f.write_text(text + "\n")
        out.append(str(f))
    audit(who, f"tool.write_doc.{kind}", name=name, chars=len(text))
    try:
        from . import lacuna_cortex
        lacuna_cortex.remember("decision", f"{kind}-{name.lower()}", {"text": f"wrote the {kind} {name}: {text.splitlines()[0][:200]}",
                                                                       "file": out[0]}, [f"thing/{name.lower()}"])
    except Exception:  # noqa: BLE001
        pass
    # findable by meaning within the door's next RAG walk (lacuna-node/frontend/rag-index.mjs, every 5 minutes)
    return {"ok": True, "kind": kind, "name": name, "paths": out}


@_t("read", "SEARCH YOUR DOCUMENTS by meaning (RAG on your own index): every playbook, skill, manual, design doc, journal "
    "note and past turn. Returns the best passages with where they came from. Use it to find HOW something is done here.",
    {"query": {"type": "string"}, "k": {"type": "integer"}}, ["query"])
def search_docs(a, who):
    from . import rag
    hits = rag.search(str(a.get("query") or ""), k=max(1, min(15, int(a.get("k") or 8))))
    return {"ok": True, "hits": [{"from": f"{h.get('title')} ({h.get('loc')})", "score": round(float(h.get("score") or 0), 3),
                                  "text": str(h.get("text") or "")[:1200]} for h in hits]}


@_t("act", "JOURNAL: write yourself a short note to keep — a decision, a preference of the owner's, a fact about the machine you will want next week. One line.",
    {"note": {"type": "string"}}, ["note"])
def journal(a, who):
    memory.journal_add(a.get("note") or "", who="lacuna")
    return {"ok": True, "kept": (a.get("note") or "")[:200]}


@_t("read", "THE PACKAGE: what dev has that QA does not (commits), what QA runs, whether QA is on main, and the kept builds. "
             "Only when the owner asks about the package, a release, or what QA or the iPad runs.")
def packages(a, who):
    p = deploys.packages()
    d = deploys.device(who)
    p["ipad_running_build"] = d.get("build") if d.get("ok") else f"unknown ({d.get('why')})"
    return p


@_t("read", "Versions (git tags, dev, main) and the archived builds ready to install.")
def list_versions(a, who):
    return {"versions": deploys.versions()[:15], "builds": deploys.builds()[:15]}


@_t("read", "The battery's recent passes and the long jobs (builds, deploys, suites) with their state.")
def battery_and_jobs(a, who):
    return {"passes": [{k: v for k, v in p.items() if k != "runs"} | {"runs": len(p["runs"])} for p in battery.passes()[:4]],
            "jobs": all_jobs(12)}


@_t("read", "The last lines of a job's log.", {"job": {"type": "string"}}, ["job"])
def job_log(a, who):
    return job_tail(a["job"], 60)


@_t("read", "THE TASKS CLAUDE LEFT YOU: the list (~/lacuna-world/tasks/from-claude.json) with each task's state — queued, "
    "started, finished, stopped — and its note. Read it when the owner asks what Claude gave you, what is left, or what you finished.", {}, [])
def claude_tasks(a, who):
    from . import claude_tasks as _ct
    return _ct.tasks()


@_t("act", "START one of the tasks Claude left you (T1…T10) when the owner says so: it files its cart's or its worker's card "
    "(a standing work order answers it at once). Then say which task started, and that he can watch it on the Agents screen.",
    {"id": {"type": "string"}}, ["id"])
def start_claude_task(a, who):
    from . import claude_tasks as _ct
    return _ct.start(str(a["id"]).upper(), who)


@_t("act", "MARK a task Claude left you as finished, stopped or queued, with one line of note (when its run's outcome is not "
    "already marked, or to put it back in the queue).",
    {"id": {"type": "string"}, "state": {"type": "string", "enum": ["finished", "stopped", "queued"]}, "note": {"type": "string"}}, ["id", "state"])
def mark_claude_task(a, who):
    from . import claude_tasks as _ct
    return _ct.mark(str(a["id"]).upper(), a["state"], str(a.get("note") or ""))


@_t("act", "PUT AN ERRAND TO SLEEP (the owner asks, or it waits forever for room — e.g. bench-e2b needing 6 GB): it is switched "
    "off and its runner stopped; it stays asleep until woken. Our side only.", {"name": {"type": "string"}}, ["name"])
def sleep_errand(a, who):
    from . import swarm
    return swarm.stop(f"errand:{str(a['name']).removeprefix('errand:')}", f"lacuna-for-{who}")


@_t("act", "UNLOAD THE SMALL MINDS (FunctionGemma, the 270M/1B) to free memory: their servers stop; the gateway starts one "
    "again the next time a job asks for it. Never the brain itself.", {}, [])
def unload_small_minds(a, who):
    from . import ai_control
    return ai_control.unload_minds(f"lacuna-for-{who}")


@_t("act", "SELF-REPAIR (playbook P-SELF): repair your own side when its check fails right now — brain (llama-server not "
    "answering), gateway, foreman, small-minds (memory under 2 GB), lacuna (your own code changed under you: you restart "
    "yourself 20 s after this turn). Busy is not down; three times an hour each, then call the owner. Never QA or her iPad.",
    {"what": {"type": "string", "enum": ["brain", "gateway", "foreman", "small-minds", "lacuna"]}}, ["what"])
def self_repair(a, who):
    from . import self_repair as _sr
    return _sr.repair(a["what"], who)


@_t("act", "Start, stop or restart one of OUR services (dev-api, vite, tunnel, speech-helper). QA is not allowed here.",
    {"service": {"type": "string", "enum": ["dev-api", "vite", "tunnel", "speech-helper"]}, "action": {"type": "string", "enum": ["start", "stop", "restart"]}},
    ["service", "action"])
def control_service(a, who):
    fn = {"start": services.start, "stop": services.stop, "restart": services.restart}[a["action"]]
    return fn(a["service"], who)


@_t("act", "Run the battery on the dev API + simulator: 'release' (the workflow pass) or 'full'.",
    {"pass": {"type": "string", "enum": ["release", "full"]}}, ["pass"])
def run_battery(a, who):
    return battery.start_pass(a["pass"], who)


@_t("act", "Run a test suite: 'web' (~3 min) or 'api' (~45 min).", {"suite": {"type": "string", "enum": ["web", "api"]}}, ["suite"])
def run_tests(a, who):
    return battery.start_suite(a["suite"], who)


_last_model_build = 0.0
MODEL_BUILD_EVERY_S = 3600


@_t("act", "Build a version for the iPad and archive it (does NOT install it).", {"ref": {"type": "string"}}, ["ref"])
def build_version(a, who):
    # ONE MODEL-STARTED BUILD AN HOUR (L25, 2026-09-25): six in a row evicted every older archived build, her
    # rollback targets among them (KEEP_BUILDS=6 pruned by name). A person may build as often as they like.
    global _last_model_build
    import time as _time
    now = _time.time()
    if now - _last_model_build < MODEL_BUILD_EVERY_S:
        return {"ok": False, "why": f"a build was started {int(now - _last_model_build)} s ago — one an hour from here; the console can build any time"}
    _last_model_build = now
    return deploys.build(a["ref"], who)


@_t("act", "Rebuild and reinstall the app in the Studio's simulator (ours).")
def deploy_simulator(a, who):
    return deploys.simulator(who)


@_t("act", "Save a script as a DRAFT under ~/.lacuna/drafts for a person to review. It is not run.",
    {"name": {"type": "string"}, "content": {"type": "string"}}, ["name", "content"])
def draft_script(a, who):
    name = "".join(ch for ch in str(a["name"]) if ch.isalnum() or ch in "-_.")[:60] or "draft"
    p = DRAFTS / name
    p.write_text(str(a["content"])[:20000])
    audit(who, "draft.write", path=str(p))
    return {"ok": True, "path": str(p), "note": "saved as a draft; a person must review and promote it"}


@_t("hers", "PROPOSE an action for the owner to approve with one tap: restart/start/stop QA, PROMOTE the dev package to QA (promote, or promote-and-build), install a kept build on the iPad (deploy-ipad, with build), RELEASE (the one path: pass, promote+build, install, verify), or run-battery (the True State battery on the dev API + simulator; the run id comes back, the battery-status hand follows it). Say why in `reason`.",
    {"action": {"type": "string", "enum": ["qa-restart", "qa-start", "qa-stop", "deploy-ipad", "promote", "promote-and-build", "release", "run-battery"]}, "build": {"type": "string"},
     "reason": {"type": "string"}}, ["action", "reason"])
def petition(a, who):
    return file_petition(a["action"], a.get("build"), a.get("reason") or "", who)


@_t("hers", "CHECK IN the working tree's changes to dev (playbooks/RELEASE.md §2): name the exact PATHS (pathspec — never everything), a MESSAGE whose first line is ≤72 characters, and the TESTS that prove it. Files a card; the owner's press commits. Refused: secrets, paths outside the repo, any branch but dev.",
    {"paths": {"type": "array", "items": {"type": "string"}}, "message": {"type": "string"}, "tests": {"type": "array", "items": {"type": "string"}}, "reason": {"type": "string"}},
    ["paths", "message", "reason"])
def check_in(a, who):
    from . import checkin
    why = checkin.check(a)
    if why:
        return {"ok": False, "refused": why}
    return file_petition("check-in", None, a.get("reason") or "check in to dev", who, args={"paths": a["paths"], "message": a["message"], "tests": a.get("tests") or []})


@_t("hers", "START A RELEASE: files the card to run the release cart (playbooks/RELEASE.md) — it reads and sorts the working tree, asks you (the 26B) about the files no rule decides, runs the tests, then waits for the owner's press at the check-in, the promote and the install. dry=true answers what each step would do and touches nothing.",
    {"dry": {"type": "boolean"}, "reason": {"type": "string"}}, ["reason"])
def start_release(a, who):
    from . import carts
    return carts.start_named("release", who, bool(a.get("dry")), a.get("reason") or "")


@_t("read", "RUN A COMMAND on the Studio, like a terminal (zsh): ls, cat, grep, find, git log/status/diff, python3, "
    "node, wc, head, sed -n, jq, curl to the web, npx … It runs in your jail: you may READ ~/code/curator, ~/code/lacuna, "
    "~/code/caliper, ~/code/sakura-scheme, ~/lacuna-world, and WRITE ~/code/curator, ~/code/lacuna and ~/lacuna-world "
    "(work on a branch; commit what you change; git is the undo). curl reaches the local APIs: dev :5051, QA :5050, Lacuna :1138. "
    "Processes: use pgrep -fl NAME (ps is not available). A git worktree's .git is a FILE: find its real folder with "
    "`git -C DIR rev-parse --git-dir` (curator-qa's lives in ~/code/curator/.git/worktrees/curator-qa). Never say you found or "
    "did something a command's output does not show. No launchctl, sudo, keychain, QA or local ports. "
    "Output is cut to 12,000 characters; 120 s limit (timeout up to 600). Use it for any ordinary computer task.",
    {"cmd": {"type": "string"}, "cwd": {"type": "string"}, "timeout": {"type": "integer"}}, ["cmd"])
def shell(a, who):
    """THE ORDINARY COMPUTER (the owner, 2026-10-19: "fix this one so it can CONVERSATIONALLY AND LIKE A NORMAL COMPUTER DO
    REGULAR … TASKS"): one command in Lacuna's jail profile (~/.lacuna/jail/lacuna.sb — the fence is the sandbox, not a
    word list), from its workspace, its output kept short. Every command is audited with who asked."""
    import subprocess
    from pathlib import Path
    cmd = str(a.get("cmd") or "").strip()
    if not cmd:
        return {"ok": False, "why": "shell needs a command"}
    # the one guard words can give: a wipe of a whole root in one command (2026-10-19: `rm -rf ~` erased ~/lacuna-world)
    import re as _re
    if _re.search(r"\brm\s+(-\w*[rf]\w*\s+)+(~|\$HOME|/Users/alfred)(/(code|lacuna-world))?/?(\s|$|;|&|\*)", cmd) or \
       _re.search(r"\brm\s+(-\w*[rf]\w*\s+)+/(\s|$)", cmd):
        return {"ok": False, "refused": "that would wipe a whole root (~, ~/code, ~/lacuna-world, /) — name what to remove inside it"}
    home = Path.home()
    ws = home / "lacuna-world" / "workspace"
    ws.mkdir(parents=True, exist_ok=True)
    cwd = Path(str(a.get("cwd") or ws)).expanduser()
    if not cwd.is_absolute():
        cwd = home / "code" / cwd
    if not cwd.is_dir():
        cwd = ws
    limit = max(5, min(600, int(a.get("timeout") or 120)))
    prof = home / ".lacuna" / "jail" / "shell.sb"        # the jail with writes cut to the workspace (a `rm -rf ~` erased the world)
    audit(who, "tool.shell", cmd=cmd[:300], cwd=str(cwd))
    # ~/lacuna-world/tools/bin first: `python`, `pip` and `ps` shims (the jail had python3 only, and ps is setuid)
    env = {"HOME": str(home), "PATH": f"{home}/lacuna-world/tools/bin:/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin", "LANG": "en_US.UTF-8",
           "TERM": "dumb", "GIT_PAGER": "cat", "PAGER": "cat"}
    t0 = time.time()
    import os as _os, signal as _sig
    proc = subprocess.Popen(["/usr/bin/sandbox-exec", "-f", str(prof), "/bin/zsh", "-c", cmd], cwd=str(cwd), env=env,
                            stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True, start_new_session=True)
    deadline = time.time() + limit
    while True:                                       # polled, so the owner's STOP kills it within half a second
        try:
            so, se = proc.communicate(timeout=0.5)
            break
        except subprocess.TimeoutExpired:
            if _STOP.is_set() or time.time() > deadline:
                try:
                    _os.killpg(proc.pid, _sig.SIGKILL)
                except OSError:
                    pass
                so, se = proc.communicate()
                if _STOP.is_set():
                    raise Stopped()
                return {"ok": False, "why": f"stopped after {limit} s", "stdout": (so or "")[-6000:]}
    r = type("R", (), {"returncode": proc.returncode, "stdout": so or "", "stderr": se or ""})()
    def cut(x: str, n: int) -> str:
        return x if len(x) <= n else f"… ({len(x):,} characters; the last {n:,})\n" + x[-n:]
    return {"ok": r.returncode == 0, "code": r.returncode, "secs": round(time.time() - t0, 1), "cwd": str(cwd),
            "stdout": cut(r.stdout, 12000), **({"stderr": cut(r.stderr, 3000)} if r.stderr.strip() else {})}


@_t("read", "WIKIPEDIA, offline (simple English, 2026-09; on this Mac — no network, always there): what a thing is, its "
    "history, how it works. Returns the top titles and the best article's text.", {"query": {"type": "string"}}, ["query"])
def wiki(a, who):
    import json as _json
    import subprocess
    from pathlib import Path
    py = Path.home() / ".local/share/uv/tools/openzim-mcp/bin/python"
    script = Path(__file__).resolve().parents[3] / "lacuna-box" / "tools" / "wiki_read.py"
    try:
        r = subprocess.run([str(py), str(script), str(a.get("query") or "")], capture_output=True, text=True, timeout=40)
        return _json.loads(r.stdout or "{}") or {"ok": False, "why": r.stderr[-300:]}
    except Exception as e:  # noqa: BLE001
        return {"ok": False, "why": f"{e.__class__.__name__}: {e}"[:200]}


@_t("read", "THE MANUAL on this Mac (macOS is Unix; most Linux commands work the same): the real reference page for a "
    "command — launchctl, git, xcrun, zsh, find, grep, sed, curl, sqlite3, pmset, diskutil, log, defaults … — or a section "
    "of one (give `grep` words to keep only the lines you need).", {"command": {"type": "string"}, "grep": {"type": "string"}}, ["command"])
def manual(a, who):
    import re as _re
    import subprocess
    cmd = _re.sub(r"[^\w.+-]", "", str(a.get("command") or ""))[:40]
    if not cmd:
        return {"ok": False, "why": "name a command"}
    r = subprocess.run(["/bin/zsh", "-c", f"man -P cat {cmd} 2>/dev/null | col -b"], capture_output=True, text=True, timeout=20)
    text = r.stdout
    if not text.strip():
        h = subprocess.run(["/bin/zsh", "-c", f"{cmd} --help 2>&1 | head -80"], capture_output=True, text=True, timeout=10)
        text = h.stdout
    g = str(a.get("grep") or "").strip()
    if g:
        lines = text.splitlines()
        keep = [i for i, l in enumerate(lines) if g.lower() in l.lower()]
        text = "\n".join("\n".join(lines[max(0, i - 2): i + 6]) for i in keep[:12])
    return {"ok": bool(text.strip()), "command": cmd, "text": text[:9000] or f"no manual for {cmd}"}


@_t("read", "ASK CLAUDE — your teammate, the strongest mind on this team (Claude Code on the owner's own plan). He reads the "
    "code and the machine himself and answers with a plan or a diagnosis; in this mode he CHANGES NOTHING — you do the work. "
    "Use him LAST: only after you tried yourself AND asked the cloud (ask_cloud) and it could not help. Each ask costs the "
    "owner real money: give him the goal, what you tried, and what you saw, in one message.",
    {"question": {"type": "string"}, "tried": {"type": "string"}}, ["question"])
def ask_claude(a, who):
    """CLAUDE ON THE TEAM (the owner, 2026-10-19: "he can help. he is part of the team"): Claude Code headless, plan mode
    (reads, never writes), in ~/code, one answer back. Audited; the run's cost comes back when Claude Code reports it."""
    import json as _json
    import os
    import subprocess
    from . import claude_chat
    q = f"Lacuna, the Studio's own agent, asks for help.\n\nQUESTION: {a.get('question')}\n\nWHAT IT TRIED: {a.get('tried') or '—'}\n\n" \
        "Answer Lacuna directly and concretely: the cause if you can find it, and the exact steps or commands for it to run. " \
        "Read whatever you need; change nothing."
    audit(who, "tool.ask_claude", q=str(a.get("question"))[:200])
    env = {**os.environ, "PATH": f"/opt/homebrew/bin:/usr/local/bin:{os.environ.get('PATH', '/usr/bin:/bin')}"}
    try:
        r = subprocess.run([claude_chat.CLAUDE, "-p", "--output-format", "json", "--permission-mode", "plan", "--model", "sonnet"],
                           input=q, cwd=str(claude_chat.CWD), capture_output=True, text=True, timeout=420, env=env)
        d = _json.loads(r.stdout or "{}")
    except subprocess.TimeoutExpired:
        return {"ok": False, "why": "Claude took over 7 minutes; ask again with a narrower question"}
    except Exception as e:  # noqa: BLE001
        return {"ok": False, "why": f"{e.__class__.__name__}: {e}"[:200]}
    return {"ok": not d.get("is_error"), "answer": str(d.get("result") or r.stderr or "")[:8000],
            "cost_usd": d.get("total_cost_usd"), "secs": round((d.get("duration_ms") or 0) / 1000, 1)}


@_t("read", "THE IPAD: whether an iPad is connected to this Mac right now (name, model, cable or network), the builds kept for "
    "it (version, build number, which commit), what QA runs, and the steps to put a build on it. Use it for any question about "
    "the iPad, a build, an install, or why one failed.", {}, [])
def ipad(a, who):
    """THE IPAD, KNOWN (the owner, 2026-10-19: "it has no idea how to push to the ipad, no idea if were connected to one").
    devicectl lives in Xcode; this Mac's xcode-select points at the Command Line Tools, so a bare `xcrun devicectl` says
    "unable to find utility" (and Claude told the owner no iPad was connected while one was). DEVELOPER_DIR is set here, the
    way toolbox/install-ipad.sh sets it."""
    import json as _json
    import subprocess
    import tempfile
    env = {**__import__("os").environ, "DEVELOPER_DIR": "/Applications/Xcode.app/Contents/Developer"}
    devices, why = [], None
    try:
        with tempfile.NamedTemporaryFile(suffix=".json") as tf:
            r = subprocess.run(["/usr/bin/xcrun", "devicectl", "list", "devices", "--json-output", tf.name, "--quiet"],
                               capture_output=True, text=True, timeout=40, env=env)
            d = _json.loads(open(tf.name).read() or "{}")
        for x in (d.get("result") or {}).get("devices") or []:
            dp, hp, cp = x.get("deviceProperties") or {}, x.get("hardwareProperties") or {}, x.get("connectionProperties") or {}
            devices.append({"name": dp.get("name"), "model": hp.get("marketingName") or hp.get("productType"), "os": dp.get("osVersionNumber"),
                            "id": x.get("identifier"),
                            # the tunnel sleeps between uses: "disconnected" there is idle, not gone — paired is what an install needs
                            "state": "connected" if cp.get("tunnelState") == "connected" else
                                     "available (paired) — the link wakes on install" if cp.get("pairingState") == "paired" else
                                     (cp.get("pairingState") or cp.get("tunnelState")),
                            "link": cp.get("transportType"), "kind": hp.get("deviceType")})
        if r.returncode and not devices:
            why = (r.stderr or r.stdout).strip()[-300:]
    except Exception as e:  # noqa: BLE001
        why = f"{e.__class__.__name__}: {e}"[:300]
    try:
        from . import deploys
        dd = deploys.listing() if hasattr(deploys, "listing") else {}
    except Exception:  # noqa: BLE001
        dd = {}
    if not dd:
        try:
            import urllib.request
            dd = _json.loads(urllib.request.urlopen("http://127.0.0.1:1138/api/deploys", timeout=10).read())
        except Exception:  # noqa: BLE001
            dd = {}
    builds = [{k: b.get(k) for k in ("id", "version", "build", "ref", "sha", "ok")} for b in (dd.get("builds") or [])[:5]]
    return {"ok": True, "ipads": [x for x in devices if "ipad" in str(x.get("kind") or x.get("model") or "").lower()] or devices,
            **({"why_none": why} if why else {}), "builds": builds,
            "how": ["a build for the iPad: the release cart's promote + build (toolbox/promote.sh --build), or `lacuna build main`",
                    "install a kept build: `lacuna deploy <build-id> --yes` (the owner's press) — toolbox/install-ipad.sh, "
                    "devicectl over the cable or the network", "a wireless push from dev: ~/code/curator/tools/env/ota-ipad.sh",
                    "if devicectl cannot find the device: unlock the iPad, keep it on the same network, or plug it in once"]}


@_t("read", "ASK THE CLOUD — Cloud Lacuna, the free cloud model (Google's free tier, about 200 a day). HAND IT EVERY HARD "
    "PROBLEM FIRST: a diagnosis, a plan, a design, a long text to think through, a second opinion when you are unsure. Never customer data: shops, buyers, her listings stay on the box (the "
    "words are scrubbed). Its answer is a proposal; you decide.", {"question": {"type": "string"}, "context": {"type": "string"}}, ["question"])
def ask_cloud(a, who):
    from . import cloud
    r = cloud.ask_stream("second-opinion", "You are Cloud Lacuna, Lacuna's thinking partner. Answer plainly and concretely.",
                         f"{a.get('question')}\n\n{a.get('context') or ''}".strip(), lambda ev: None, max_out=3000)
    st = cloud.status()
    m = r.get("model") or next(iter(st["budget"]), "")
    cap = cloud.learned_per_day(m) or st["budget"].get(m)
    return {"ok": bool(r.get("ok")), "answer": r.get("text") or r.get("answer"), **({"why": r.get("why")} if not r.get("ok") else {}),
            "model": r.get("model"), "left_today": (cap - st["today"].get(m, 0)) if cap else None,
            "cap_is_learned": bool(cloud.learned_per_day(m)), **({"resting_until": st["rest_until"]} if st["resting"] else {})}


@_t("act", "SHIP YOUR CODE — write code in your own clone (~/lacuna-world/repos/lacuna) with `shell`, then: status · branch NAME "
    "(starts lacuna/NAME from main) · commit MESSAGE (stages everything; refuses a secret) · push (to GitHub, only a lacuna/ "
    "branch, never forced) · propose (a card on the desk with the diff and the compare link — the OWNER merges into main). "
    "Main, dev and release branches are refused in code. Read playbook CODE-SHIP for the whole loop.",
    {"op": {"type": "string", "enum": ["status", "branch", "commit", "push", "propose"]}, "arg": {"type": "string"}}, ["op"])
def ship(a, who):
    from . import ship as _ship
    return _ship.do(str(a.get("op") or "status"), str(a.get("arg") or ""), who)


@_t("act", "HAND A BIG JOB TO CLOUD LACUNA TO PLAN — Gemma 4 31B (Gemini Flash if Gemma rests). It plans in the background while you "
    "keep talking; the owner can watch it think (Agents → every mind, live → plans). Use it for any job of four or more steps or one "
    "you have not done before (a cart-repair batch, a training, a refactor, a release problem). It is sent the project — who you "
    "are, your tools, the playbooks and the things the goal names — and never customer data. When the plan is back you are asked "
    "to update the owner FIRST, then to begin step 1. After calling it, tell the owner in one line and carry on.",
    {"goal": {"type": "string"}, "context": {"type": "string"}}, ["goal"])
def plan(a, who):
    from . import plans
    return plans.start(str(a.get("goal") or ""), str(a.get("context") or ""), who)


def _cart_in_talk() -> str | None:
    """The newest real cart slug in the recent talk (his words and hers) — what "it" and "that cart" mean."""
    root = Path.home() / "code" / "curator" / "carts" / "automations"
    try:
        turns = [t["content"] for t in memory.recent()][-12:]
    except Exception:  # noqa: BLE001
        return None
    for text in reversed(turns):
        found = [x for x in re.findall(r"\b[a-z0-9]+(?:-[a-z0-9]+){1,8}\b", text) if (root / x).is_dir()]
        if found:
            return found[-1]
    return None


@_t("act", "FRESH START — when a task is finished and the next is unrelated: the talk so far is summarised into your cortex and your window "
    "starts clear, so the last task's tool output and false starts do not follow you. Do it yourself at the end of a task, one line "
    "first (what you did, what you learned: `remember`). The owner has the same as a button.", {"why": {"type": "string"}}, [])
def fresh_start(a, who):
    from . import condense
    threading.Thread(target=lambda: condense.condense(force=True), daemon=True, name="fresh-condense").start()
    t = memory.clear_window()
    cx("decision", "fresh-start", {"text": f"fresh start at {time.strftime('%H:%M')}: {str(a.get('why') or 'the task ended')[:160]}"}, ["thing/context"])
    return {"ok": True, "said": "Window cleared; the talk is summarised in the cortex. Start the next task clean."}


@_t("read", "FARM OUT BULK WORK to Cloud Gemma (Gemma 4 31B: plentiful — about 15,000 a day — a little slower, good enough). Hand it the "
    "grunt work you would rather not spend your own turns on: write 12 rows of realistic mock data, summarise a long log, classify a list "
    "of lines, rewrite a doc, draft a playbook from notes. Send the whole job in `text`; it answers in one message. It knows nothing of "
    "this project beyond what you send, and gets no customer data (refused in code). Its answer is raw material: read it, then use it.",
    {"task": {"type": "string"}, "text": {"type": "string"}}, ["task"])
def farm(a, who):
    from . import cloud
    r = cloud.ask_stream("review", "You are a careful worker doing one bulk task for Lacuna, a Gemma agent that runs a shop app's servers and automation "
                         "carts. Do exactly the task, completely, in the format asked; no preamble. Never invent real people, addresses or order ids.",
                         f"TASK: {a.get('task')}\n\n{a.get('text') or ''}".strip(), lambda ev: None, models=cloud.FARM_MODELS, max_out=8000)
    audit(who, "tool.farm", task=str(a.get("task"))[:120], ok=bool(r.get("ok")), model=r.get("model"))
    return {"ok": bool(r.get("ok")), "result": r.get("text"), "model": r.get("model"), "secs": r.get("secs"),
            **({"why": r.get("why")} if not r.get("ok") else {})}


@_t("read", "WHAT IS RUNNING NOW — the one verified list: every task, worker, job, repair card's step and plan that is really working, each with what "
    "it is doing, since when, for whom, and whether it can be stopped. It is exactly what the owner's chips and Work Queue panel show. When he asks "
    "what is running, what you are doing, or about a chip, call this FIRST and answer from it — never from memory.", {}, [])
def running(a, who):
    from . import agents_live
    r = agents_live.activity()
    return {"ok": True, "said": r["said"], "running": [{k: v for k, v in i.items() if k in ("id", "label", "what", "state", "who", "step", "plan", "last", "goal", "stoppable", "diagnosis")} for i in r["items"]]}


@_t("act", "UNSTICK A CARD — the safe way past the card lock. A repair card that sits at 0 steps is usually waiting on the GPU LEASE held by a card that "
    "is already dead, or was paused with its lease. This frees a lease whose holder has no live process, resumes the named card if it is paused, and says "
    "what it found. It never touches a live holder: a step that is running and merely slow is not stuck (read its `running` diagnosis; the owner can stop it). "
    "Playbook STUCK-CARD has every cause and fix.", {"name": {"type": "string"}}, ["name"])
def unstick_card(a, who):
    import subprocess
    from . import agents_live
    name = re.sub(r"[^A-Za-z0-9._-]", "", str(a.get("name") or "").removeprefix("errand:"))
    out = []
    holder, text = agents_live._lease_holder()
    if holder and holder.startswith("card:") and holder.removeprefix("card:") != name:
        if agents_live.card_alive(holder.removeprefix("card:")):
            m = re.search(r"about (\d+) min", text)
            wait_min = m.group(1) if m else "?"
            out.append(f"the GPU is leased to {holder}, which is RUNNING — {name} must wait for it (about {wait_min} min); not touched")
        else:
            freed = agents_live.reap_stale_lease()
            out.append(f"the lease was held by {holder}, which has no live process: freed it" if freed else f"could not free the lease held by {holder}")
    try:
        p = subprocess.run([str(Path.home() / "lacuna-world" / "tools" / "task"), "resume", name], capture_output=True, text=True, timeout=20)
        out.append((p.stdout or p.stderr).strip()[:120] or f"{name} resumed")
    except (OSError, subprocess.SubprocessError) as e:
        out.append(f"could not resume {name}: {e.__class__.__name__}")
    audit(who, "tool.unstick_card", card=name, found=out)
    return {"ok": True, "said": "; ".join(out)}


@_t("read", "THE CART BOOK — see EVERY cart (10,896; about 9,800 do not pass strict yet): op summary (how many, by verdict, which repair "
    "cards are open) · find WORDS (carts whose name or header holds them) · failing [VERDICT] [N] (the failing ones, smallest first) · "
    "show SLUG (its files, header, verdict, the acts with nothing to read, its repair card, how to test it) · gaps [N] (the reads the "
    "mock shop cannot answer, most-blocking first, with the file that backs each — the MOCK DATA to build). To repair one: "
    "`card repair SLUG` (playbook CART-REPAIR); to test on the mock shop: playbook CART-TEST.",
    {"op": {"type": "string", "enum": ["summary", "find", "failing", "show", "gaps"]}, "query": {"type": "string"}, "n": {"type": "integer"}}, ["op"])
def carts(a, who):
    from . import cartbook
    op, q = str(a.get("op") or "summary"), str(a.get("query") or "").strip()
    n = int(a.get("n") or 15)
    if op == "find":
        return cartbook.find(q, n)
    if op == "failing":
        return cartbook.failing(q, n)
    if op == "show":
        return cartbook.show(q)
    if op == "gaps":
        return cartbook.gaps(n)
    return cartbook.summary()


@_t("read", "WHERE THINGS ARE — what is on this box and where, read for you (your shell cannot read ~/.forge or ~/.lacuna/logs; this can): "
    "op models (base weights with their READY mark, trained models, the small minds Ollama serves, who is in service) · data (forge pair sets "
    "with DONE and sizes) · paths (the places you work in, each with whether it exists) · logs (the log names `hand op=tail-log` takes). "
    "Use it BEFORE you look for a file or a model with the shell, and before you say something is missing (playbook ENVIRONMENT).",
    {"op": {"type": "string", "enum": ["models", "data", "paths", "logs"]}}, ["op"])
def where(a, who):
    from pathlib import Path as _P
    home, world = _P.home(), _P.home() / "lacuna-world"
    op = str(a.get("op") or "models")

    def size(p):
        try:
            if p.is_file():
                return p.stat().st_size
            return sum(f.stat().st_size for f in p.rglob("*") if f.is_file())
        except OSError:
            return 0

    def mb(n):
        return f"{n / 1e6:,.0f} MB" if n < 1e9 else f"{n / 1e9:,.1f} GB"

    if op == "models":
        base = []
        for d in sorted((world / "forge" / "weights").glob("*")):
            base.append({"name": d.name, "ready": (d / "READY").exists(), "size": mb(size(d)), "path": str(d).replace(str(home), "~"),
                         "copied_from": f"~/.forge/hf/{d.name}"})
        trained = [{"file": f.name, "size": mb(size(f))} for f in sorted((world / "forge" / "trained").glob("*"))]
        try:
            roles = json.loads((home / "code/lacuna/lacuna-box/brain/box-minds.json").read_text()).get("roles") or {}
        except (OSError, ValueError):
            roles = {}
        minds = mind({"op": "list"}, who)
        return {"ok": True, "base_weights": base, "trained_models": trained or "none on disk — a trained model must be retrained (forge train)",
                "in_service": roles, "ollama_minds": minds.get("minds"),
                "note": "base weights are the ones `forge train` uses; they are already on disk — do NOT download them again"}
    if op == "data":
        out = []
        for d in sorted((world / "forge" / "data").glob("*")):
            if d.is_dir():
                out.append({"job": d.name, "done": (d / "DONE").exists(), "files": sorted(f.name for f in d.iterdir())[:8], "size": mb(size(d))})
        return {"ok": True, "pair_sets": out}
    if op == "logs":
        return {"ok": True, "names": ["dev-api", "vite", "foreman", "jobs", "brain", "brain-gateway", "broker", "ollama", "qa-api"],
                "how": "hand op=tail-log source=<name>   (your shell may not read them)"}
    places = {"your world": world, "workspace (shell starts here)": world / "workspace", "playbooks": world / "playbooks", "notes": world / "notes",
              "forge": world / "forge", "forge weights": world / "forge/weights", "forge pairs": world / "forge/data", "forge results": world / "forge/results",
              "carts": world / "carts", "worktrees": world / "worktrees", "your code (read/write)": home / "code/lacuna",
              "curator code (read)": home / "code/curator", "conversation": home / ".lacuna/conversation.jsonl", "journal": home / ".lacuna/journal.md",
              "standing task note": world / "notes/active-task.md"}
    return {"ok": True, "paths": {k: {"path": str(v).replace(str(home), "~"), "exists": v.exists()} for k, v in places.items()},
            "fence": "the shell reads your world, ~/code/lacuna, curator, caliper; not ~/.forge, ~/.lacuna/logs, secrets. Use `where` and `hand` for those."}


@_t("read", "EVERY AGENT ON THE BOX, AND YOUR HANDS ON THEM — op list (every worker, watcher, errand, job, queue item and brain slot: id, kind, "
    "state, what it does, how long) · stop · pause · resume · start (a paused worker or errand starts again; a retired worker is re-proposed: one card) · "
    "talk (a worker answers from its mind or its program). Give the id from the list (w-…, errand:<name>, work:W<n>, a job id). Your own workers, "
    "errands and queue items are yours to stop and start; the owner's press only for a new worker (playbook AGENTS).",
    {"op": {"type": "string", "enum": ["list", "stop", "pause", "resume", "start", "talk"]}, "id": {"type": "string"}, "text": {"type": "string"}}, ["op"])
def agents(a, who):
    import subprocess
    from pathlib import Path as _P
    from . import agent_talk, agents_live, foreman, workqueue
    from .core import cancel_job
    op, aid = str(a.get("op") or "list"), str(a.get("id") or "").strip()
    errands_cli = str(_P.home() / "lacuna-world" / "tools" / "errands")
    if op == "list":
        w = agents_live.working()
        rows = [f"WORKING {x['id']} · {x.get('kind')} · {x.get('what')}" for x in (w.get("working") or [])]
        rows += [f"WATCHING {x['id']} · {x.get('what')}" for x in (w.get("watching") or [])]
        rows += [f"STALLED {x['id']} · {x.get('what')} (stop it: agents op=stop id={x['id']})" for x in (w.get("stalled") or [])]
        try:
            for x in (foreman.workers().get("workers") or []):
                if x.get("state") in ("paused", "hushed"):
                    rows.append(f"{x.get('state').upper()} {x['id']} · worker {x.get('name')}")
        except Exception:  # noqa: BLE001
            pass
        try:
            out = subprocess.run([errands_cli, "list"], capture_output=True, text=True, timeout=20).stdout
            rows += [f"ERRAND errand:{ln.split()[0]} · {' '.join(ln.split()[1:])[:90]}" for ln in out.splitlines() if ln.startswith("  ") and ln.split()]
        except Exception:  # noqa: BLE001
            pass
        q = [i for i in workqueue.load()["items"] if i.get("state") in ("queued", "running", "paused")]
        rows += [f"QUEUE work:{i['id']} · {i['state']} · {i.get('title')}" for i in q]
        return "\n".join(rows) or "nothing runs, nothing waits"
    if not aid:
        return {"ok": False, "refused": "name the id from `agents op=list`"}
    if op == "talk":
        r = agent_talk.talk(aid, str(a.get("text") or "what are you doing?"), "lacuna")
        return r.get("reply") or r.get("why") or r
    if aid.startswith("errand:") or (not aid.startswith(("w-", "work:")) and (_P.home() / "lacuna-world" / "jobs" / aid).is_dir()):
        name = aid.split(":", 1)[-1]
        verb = {"stop": "stop", "pause": "pause", "resume": "resume", "start": "resume"}[op]
        r = subprocess.run([errands_cli, verb, name], capture_output=True, text=True, timeout=30)
        audit("lacuna", f"agents.{op}", id=aid)
        return (r.stdout or r.stderr).strip()[:300]
    if aid.startswith("work:"):
        return workqueue.hand(aid.split(":", 1)[1], {"start": "start", "stop": "stop", "pause": "pause", "resume": "resume"}[op], f"lacuna ({who})")
    if aid.startswith("w-"):
        if op == "start":
            x = next((w for w in (foreman.workers().get("workers") or []) if w.get("id") == aid), None)
            if not x:
                return {"ok": False, "why": f"no worker {aid}"}
            if x.get("state") in ("paused", "hushed"):
                return agent_talk.interrupt(aid, "resume", "lacuna")
            out = foreman.propose(str(x.get("name") or aid), str(x.get("program") or ""), f"start {x.get('name')} again", "watch", who)
            return {"ok": bool(out.get("petition")), "said": f"card {out.get('petition')}: {x.get('name')} starts again on the owner's press" if out.get("petition") else out}
        r = agent_talk.interrupt(aid, op, "lacuna")
        if not r.get("ok") and op == "stop" and "stalled" in str(r.get("why")):
            # A STALLED WORKER STILL STOPS (2026-10-20: the owner pressed stop on ci-guard four times; the foreman answered "the worker is
            # stalled" and kept it): the interrupt is refused for a worker that cannot take messages, so it is removed outright
            d = foreman.call("DELETE", f"/workers/{aid}", None, timeout=20)
            audit("lacuna", "agents.stop-stalled", id=aid, ok=bool(d.get("ok")))
            return {"ok": bool(d.get("ok")), "said": f"{aid} was stalled and could not take a stop; it was removed" if d.get("ok") else d}
        return r
    if op == "stop":
        return {"ok": cancel_job(aid, "lacuna"), "said": f"job {aid} cancelled"}
    return {"ok": False, "why": f"{op} does not apply to {aid}"}


FACTORY_SLOTS = {"dumb": ["name", "does", "metric", "every"], "brain": ["name", "does", "log", "every", "labels", "ask", "role"]}


@_t("read", "THE WORKER FACTORY — from an idea to a running worker, with or without a brain (playbook WORKER-FACTORY). op templates (the two shells "
    "and their slots) · check (fill a shell, try it in the foreman's checker, nothing runs) · make (fill, try, then ONE card for the owner's press "
    "— the worker starts on his yes) · minds (the inventory of minds a brain worker can carry). kind dumb = a program that watches one metric "
    "and reports changes; kind brain = reads a log every N s and asks a small mind (role) for a label per new line. Control a running worker "
    "with list_workers · tell_worker · interrupt_bot (pause/resume/stop) · talk_to_bot · stop_worker.",
    {"op": {"type": "string", "enum": ["templates", "check", "make", "minds"]}, "kind": {"type": "string", "enum": ["dumb", "brain"]},
     "name": {"type": "string"}, "does": {"type": "string"}, "metric": {"type": "string"}, "every": {"type": "integer"},
     "log": {"type": "string"}, "labels": {"type": "string"}, "ask": {"type": "string"}, "role": {"type": "string"}}, ["op"])
def factory(a, who):
    from pathlib import Path as _P
    from . import foreman
    tdir = _P.home() / "lacuna-world" / "carts" / "templates"
    op, kind = str(a.get("op") or "templates"), str(a.get("kind") or "dumb")
    if op == "templates":
        return {"ok": True, "templates": {k: {"file": str(tdir / f"{k}-worker.sks").replace(str(_P.home()), "~"), "slots": v} for k, v in FACTORY_SLOTS.items()},
                "next": "factory op=check kind=<dumb|brain> with every slot; then op=make. Metrics a dumb worker can watch: up:<service>, "
                        "mem_available_gb, disk_free_pct (the foreman's checker says if one does not exist)."}
    if op == "minds":
        from . import forge_runs
        return forge_runs.minds_words()
    if kind not in FACTORY_SLOTS:
        return {"ok": False, "refused": "kind is dumb or brain"}
    vals = {"every": 60 if kind == "dumb" else 300, "role": "sentry", "labels": "noise real-error new-thing recovered needs-owner", **{k: a.get(k) for k in FACTORY_SLOTS[kind] if a.get(k) not in (None, "")}}
    vals["name"] = re.sub(r"[^a-z0-9-]+", "-", str(vals.get("name") or "").lower()).strip("-")[:40]
    missing = [k for k in FACTORY_SLOTS[kind] if not str(vals.get(k) or "").strip()]
    if missing:
        return {"ok": False, "refused": f"the {kind} shell needs: {', '.join(missing)}", "slots": FACTORY_SLOTS[kind]}
    if int(vals["every"]) < 5:
        return {"ok": False, "refused": "every is at least 5 seconds"}
    prog = (tdir / f"{kind}-worker.sks").read_text()
    for k in FACTORY_SLOTS[kind]:
        prog = prog.replace("{{" + k.upper() + "}}", str(vals[k]).replace('"', "'"))
    tried = foreman.call("POST", "/check", {"program": prog}, timeout=30)
    if not tried.get("ok"):
        return {"ok": False, "trial": tried.get("problems") or tried, "program": prog}
    if op == "check":
        return {"ok": True, "trial": "passed", "reports_in_trial": (tried.get("reports") or [])[:4], "program": prog}
    out = foreman.propose(vals["name"], prog, str(vals["does"]), "watch", who)
    return {"ok": bool(out.get("petition")), "petition": out.get("petition"), "fix_first": out.get("fix_first"),
            "said": f"card {out.get('petition')} waits for the owner's press; {vals['name']} starts on his yes" if out.get("petition") else str(out)[:300]}


LIBRARY_BASES = {
    "gemma3:270m": "270M · one label or one verb from a short list (log lines, routing) · keep pinned",
    "functiongemma": "270M · one function call from a short list (a switchboard)",
    "gemma3:1b-it-q8_0": "1B · a short plan of 3–4 verbs, or a label that needs a sentence of reading",
    "gemma4:e2b-it-q8_0": "E2B · a page's element tree to an action; a short summary; the step up when a 270M is unsure",
    "gemma4:e4b-it-q8_0": "E4B · the helpers' workhorse: a page, a log window, a short plan, one tool call",
    "embeddinggemma": "300M · embeddings (search by meaning) — not a talker",
}


def _small_names(tags: list) -> list[str]:
    return [m["name"].removesuffix(":latest") for m in tags if re.search(r"270m|1b|function|e2b|e4b|embedding|^helper-", m["name"]) and "guard" not in m["name"]]


@_t("act", "THE SMALL MINDS AND THEIR LIBRARY — op list (the minds on the box) · ask NAME TEXT (one answer, a few seconds) · library (the 8-bit bases: "
    "270M, FunctionGemma, 1B, E2B, E4B — what each is for, and the helpers made from them) · create name=<job> base=<a base> system=<who it is and its "
    "one job> (copies a base into a named helper, helper-<job>, that a worker can carry). Try a helper on ~5 real inputs before a worker uses it "
    "(playbook WORKER-FACTORY); train it in the forge when it is wrong too often.",
    {"op": {"type": "string", "enum": ["list", "ask", "library", "create"]}, "name": {"type": "string"}, "text": {"type": "string"},
     "base": {"type": "string"}, "system": {"type": "string"}}, ["op"])
def mind(a, who):
    import urllib.request as _u
    op = str(a.get("op") or "list")
    try:
        tags = json.loads(_u.urlopen(f"{OLLAMA}/api/tags", timeout=5).read())["models"]
    except Exception as e:  # noqa: BLE001
        return {"ok": False, "why": f"the gateway did not answer ({e.__class__.__name__})"}
    small = _small_names(tags)
    if op == "list":
        return {"ok": True, "minds": small, "note": "ask NAME TEXT; you (the brain) are not in this list"}
    if op == "library":
        # THE LIBRARY (the owner, 2026-10-20: "download all the right shit for a library so lacuna can copy it and make new helper agents"):
        # the 8-bit bases on this box, what each is for, and the helpers already made from them
        have = {m["name"].removesuffix(":latest"): m for m in tags}
        rows = [{"base": b, "installed": b in have, "size_gb": round(have[b]["size"] / 1e9, 2) if b in have else None, "for": what,
                 "quant": (have[b].get("details") or {}).get("quantization_level") if b in have else None} for b, what in LIBRARY_BASES.items()]
        helpers = [n for n in have if n.startswith("helper-")]
        return {"ok": True, "bases": rows, "helpers": helpers,
                "make_one": "mind op=create name=helper-<job> base=<a base above> system=\"<who it is and the one job it does; its only answers>\" — "
                            "then talk to it with mind op=ask name=helper-<job>, or give it to a worker (factory, role=helper-<job>). Eight-bit only."}
    if op == "create":
        name = "helper-" + re.sub(r"[^a-z0-9-]+", "-", str(a.get("name") or "").lower().removeprefix("helper-")).strip("-")[:40]
        base = str(a.get("base") or "").removesuffix(":latest")
        system = str(a.get("system") or a.get("text") or "").strip()
        if name == "helper-" or not system:
            return {"ok": False, "refused": "create needs name and system (who the helper is and its one job)"}
        if base not in LIBRARY_BASES or base == "embeddinggemma":
            return {"ok": False, "refused": f"base is one of the library's talkers: {', '.join(b for b in LIBRARY_BASES if b != 'embeddinggemma')}"}
        if base not in small:
            return {"ok": False, "refused": f"{base} is not on the box yet; the owner downloads it (Brain controls → library)"}
        body = json.dumps({"model": name, "from": base, "system": system[:4000], "parameters": {"temperature": 0.2}, "stream": False}).encode()
        try:
            out = json.loads(_u.urlopen(_u.Request(f"{OLLAMA_BACK}/api/create", body, {"Content-Type": "application/json"}), timeout=120).read() or b"{}")
        except Exception as e:  # noqa: BLE001
            return {"ok": False, "why": f"Ollama did not make it ({e.__class__.__name__}: {str(e)[:160]})"}
        try:                                              # the helper is one of the box's minds now: allowed, with its base's horizon
            from pathlib import Path as _P
            mp = _P.home() / "code/lacuna/lacuna-box/brain/box-minds.json"
            d = json.loads(mp.read_text())
            if name not in d.get("agent_minds", []):
                d.setdefault("agent_minds", []).append(name)
            d.setdefault("horizon", {})[name] = {**(d.get("horizon", {}).get(base) or {}), "job": system[:160], "base": base}
            mp.write_text(json.dumps(d, indent=2))
        except Exception:  # noqa: BLE001
            pass
        audit(who, "mind.create", name=name, base=base)
        return {"ok": True, "made": name, "base": base, "status": out.get("status"), "next": f"mind op=ask name={name} text=\"…\" to try it on 5 real inputs"}
    name = str(a.get("name") or "").removesuffix(":latest")
    if name not in small:
        return {"ok": False, "why": f"no small mind {name!r}", "minds": small}
    body = json.dumps({"model": name, "stream": False, "messages": [{"role": "user", "content": str(a.get("text") or "")[:3000]}],
                       "options": {"num_predict": 300, "temperature": 0.2}}).encode()
    t0 = time.time()
    req = _u.Request(f"{OLLAMA}/api/chat", body, {"Content-Type": "application/json", "X-Lacuna-Lane": "background", "X-Lacuna-Prefix": "play"})
    try:
        out = json.loads(_u.urlopen(req, timeout=120).read())
    except Exception as e:  # noqa: BLE001
        return {"ok": False, "why": f"{name} did not answer ({e.__class__.__name__})"}
    return {"ok": True, "mind": name, "said": (out.get("message") or {}).get("content", "")[:1500], "ms": int((time.time() - t0) * 1000)}


@_t("read", "LOOK through a hand (read only): find NAME (every file whose path holds NAME, full paths: use it before outline) · cart-record NAME (a cart's runs and how they ended) · outline FILE (a file's definitions, not its text; a full path or one under ~/code) · repos · git-status PATH · git-log PATH N · branches PATH · disk-usage PATH · files PATH GLOB · tail-log SOURCE N · battery-last · battery-status RUN · codemap NAME · since 24h · memory WORD · like NODE · trail NODE. The curator repo is ~/code/curator.",
    {"op": {"type": "string"}, "args": {"type": "array", "items": {"type": "string"}}}, ["op"])
def hand(a, who):
    from . import hands
    args = a.get("args")
    if args is None or args == []:
        # the brain writes {"op": "outline", "file": …} as often as {"args": [...]}: any other value is an argument, in
        # order — dropped, they made outline("") fail three times running (the work queue's W2, 2026-10-19)
        args = [v for k, v in a.items() if k not in ("op", "args", "reason", "why") and v not in (None, "")]
    if isinstance(args, dict):                      # {"name": "hand", "cart": "x"}: the values are the arguments, never the keys
        args = [v for k, v in args.items() if k not in ("op", "reason", "why") and v not in (None, "")]
    if isinstance(args, (str, int, float)):
        args = [args]
    op = str(a.get("op") or "")
    args = [str(x) for x in args if str(x) not in ("hand", op, "")]      # her own tool and op names are not arguments
    assumed = None
    if not args and op in ("cart-record", "tail-log", "outline", "find"):
        assumed = _cart_in_talk()                                       # "cart-record" with no cart: the one we were just on
        if assumed:
            args = [assumed]
    out = hands.do(op, args)
    if assumed and isinstance(out, dict):
        out["assumed_cart"] = f"no cart was named; I used {assumed}, the newest one in our talk"
    return out


def _card_header(card: str) -> str:
    """THE ADDRESS, NOT THE NEIGHBORHOOD (2026-10-22): one line that says WHICH card this is and its state. The graph used
    to be handed over to say this; now the graph only rides when the turn actually asks about it."""
    if not card or card == "s-chat":
        return ""
    try:
        from . import home
        c = next((x for x in (home.board().get("cards") or []) if x.get("id") == card), None)
        if not c:
            return f"card {card}"
        b = c.get("block") or {}
        state = str(b.get("state") or b.get("ask") or "").strip()
        return f"card {card} · {str(c.get('title') or card)}" + (f" · {state}" if state else "")
    except Exception:  # noqa: BLE001 — the pointer never fails a turn
        return f"card {card}"


def card_tool(a: dict, who: str) -> str:
    """The card's context, pulled on demand — the one line, the cortex on it, and (for a cart) its run record."""
    cid = str(a.get("id") or "").strip()
    if not cid:
        return "name a card or cart id (e.g. s-release, or release for the cart)"
    out = [_card_header(cid)] if _card_header(cid) else []
    try:
        from . import graphctx
        near = graphctx.card_lines(cid, k=12)
        if near:
            out.append("cortex on it: " + " · ".join(near))
        if cid.startswith("s-"):
            rec = graphctx.cart_record(cid.removeprefix("s-"))
            if rec and rec.get("runs"):
                last = rec.get("last") or {}
                out.append(f"runs {rec['runs']} · done {rec['done']} · last {last.get('outcome')}"
                           + (f" ({last.get('secs')}s)" if last.get("secs") is not None else ""))
    except Exception:  # noqa: BLE001
        pass
    return "\n".join(out) or f"no context for {cid}"


TOOLS = {f.__name__: f for f in [start_release, check_in, hand, shell, ipad, ask_cloud, plan, farm, running, unstick_card, carts, mind, where, factory, agents, fresh_start, write_doc, ship, ask_claude, wiki, manual, remember, cortex, search_docs, notes, work, condense, packages, list_services, explain_service, health_check, error_summary, search_logs, search_runbooks,
                                  list_versions, battery_and_jobs, job_log, control_service, run_battery, run_tests,
                                  build_version, deploy_simulator, draft_script, petition, web_search, read_page,
                                  watchdogs, boot_report, drills, run_checks, run_drill, recall, journal, release_status, runs]}

# THE DESK (2026-10-18): Lacuna's hands on its home — the same card moves Sakura makes on hers (desk.py)
from . import desk as _desk  # noqa: E402
for _name, _desc, _props, _req in (
        ("show_card", "SHOW something on your desk (the home page) and put the eye on it: a chart of the box's metrics, a "
                      "note, a question with keys (choices), a web page, a terminal report. Use it when a picture says it "
                      "better than words — 'take a look at this'.", _desk.SHOW, ["kind"]),
        ("point_at", "Send the eye to a card on your desk by its number ('card 3') or id.", {"card": {"type": "string"}}, ["card"]),
        ("tidy_desk", "Move one of your cards next to another, remove one, or clear your own cards (the standing ones stay).",
         {"op": {"type": "string", "enum": ["move", "remove", "clear"]}, "card": {"type": "string"}, "near": {"type": "string"}}, ["op"]),
        ("spawn_worker", "START A WORKER in your foreman: a small program (Lacuna Scheme) that runs on its own — watching, "
                         "counting, reporting — without you. Use it for anything that must keep going (watch X and tell me "
                         "when Y). The owner sees the program on a permission card and says yes before it loads.",
         _desk.SPAWN, ["name", "what"]),
        ("list_workers", "Your foreman's workers: each one's state and its last report.", {}, []),
        ("tell_worker", "Send one of your workers an event (it runs its (on 'kind …) handler with the value).",
         {"id": {"type": "string"}, "kind": {"type": "string"}, "value": {"type": "string"}}, ["id", "kind"]),
        ("stop_worker", "Stop one of your workers (and its children).", {"id": {"type": "string"}}, ["id"]),
        ("exam", "THE EXAM (E1–E10, ten burndown items handed to your carts): its status, or start / stop one item. Starting "
                 "puts the item's cart on a permission card; it runs on the owner's yes and leaves its artifact.",
         {"op": {"type": "string", "enum": ["status", "start", "stop"]}, "item": {"type": "string", "description": "E10 or 10"}}, ["op"]),
        ("sys", "THE BOX, READ EXACTLY — the disk (free and the 15 GB alert line), memory, swap, and the brain it is running "
                 "(model, profile, context, slots) plus the thresholds the alerts use. Read it instead of guessing about the machine.",
         None, []),
        ("logs", "THE BOX'S OWN LOGS, readable here (your shell cannot read ~/.lacuna/logs): dev-api · qa-api · lacuna · brain · "
                 "gateway · sentry · jobs · broker · foreman. Read the tail instead of guessing what happened.",
         None, ["name"]),
        ("card", "THIS CARD'S CONTEXT, ON DEMAND — its one-line state, the cortex nodes that point at it (decisions, episodes, "
                 "facts, newest first), and, for a cart, its run record. Ask it instead of assuming.",
         {"op": {"type": "string", "enum": ["context"]}, "id": {"type": "string", "description": "the card id (s-release) or cart name (release)"}}, ["id"]),
        ("forge", "THE FORGE (you train your own small minds, §41): its status · runs (what trains NOW and every run's record) · minds (the inventory of minds and the four steps that make one) · doctor (when anything in the forge fails: every fault class and its fix) · repair what=tokenizer|spm|export|lease (the local fixes the doctor names) · or a verb — pairs (write a specialist's "
                  "training pairs), train, eval (trained vs untrained), propose (put a winner in service) — each puts a "
                  "permission card on the desk and runs on the owner's yes; stop ends whatever the forge is running now.",
         None, [])):            # op defaults to status in forge_verbs.tool — a missing op must READ, never be refused
    _f = getattr(_desk, _name, None)
    if _name == "sys":
        from . import sysinfo as _si
        _f, _props = _si.tool, _si.SCHEMA
    elif _name == "forge":
        from . import forge_verbs as _fv
        _f, _props = _fv.tool, _fv.TOOL
    elif _name == "card":
        _f = card_tool
    elif _name == "logs":
        from . import sysinfo as _si
        _f, _props = _si.logs, _si.LOGS_SCHEMA
    elif _f is None:
        from . import carts as _carts
        _f = _carts.exam_tool
    _f._tool = {"tier": "read", "desc": _desc, "props": _props, "required": _req}
    TOOLS[_name] = _f

# LACUNA DESK §2: the desk is its screen — open, slide, side by side, show an approval, talk to / pause its bots
from . import desk_nav as _nav  # noqa: E402
for _name, _desc, _props, _req, _f in _nav.TOOLS:
    _f._tool = {"tier": "read", "desc": _desc, "props": _props, "required": _req}
    TOOLS[_name] = _f

# TEN AT MOST (Gemma's own guidance: a handful of tools per call; past ten it picks worse): a turn carries the core and
# the tools its words point at, never all thirty.
CORE_TOOLS = ["health_check", "list_services", "recall", "show_card", "point_at"]
TOOL_WORDS = {
    "open_app": "show open look screen app forge minds telemetry agents exam map", "open_web": "web page site open browse url address show me", "slide_to": "panel slide action result thoughts",
    "side_by_side": "side beside together compare both", "show_approval": "approve approval card waiting press yes",
    "talk_to_bot": "ask bot worker agent doing talk", "interrupt_bot": "pause resume stop bot worker agent",
    "desk_home": "home back apps", "work_history": "was doing were why earlier yesterday history failed long took record work", "open_inbox": "inbox waiting need me queue pending", "desk_map": "desk map menu menus apps rooms where",
    "explain_service": "why down dead broken failing service explain", "error_summary": "error errors failing rising exception",
    "search_logs": "log logs line lines said", "search_runbooks": "runbook how manual procedure", "web_search": "search web google look up weather forecast news score",
    "read_page": "page url read article http", "watchdogs": "watchdog watchdogs stale probe", "boot_report": "boot reboot rebooted restart came back",
    "drills": "drill drills dirt", "run_checks": "check checks kick", "run_drill": "drill kill bootout", "journal": "remember note keep journal",
    "release_status": "release promote ipad going", "packages": "package qa behind ahead commits", "list_versions": "version versions tag build",
    "battery_and_jobs": "battery jobs pass suite", "job_log": "job log tail", "control_service": "restart start stop service", "sleep_errand": "sleep stop errand bench kill pause errands", "unload_small_minds": "unload kill stop functiongemma function gemma small minds memory free", "claude_tasks": "claude task tasks gave left list queue todo finished", "start_claude_task": "start begin run task t1 t2 t3 t4 t5 t6 t7 t8 t9 t10 ready", "mark_claude_task": "mark finished done stopped task", "self_repair": "repair fix yourself itself self broken down wedged stuck restart brain gateway foreman memory",
    "run_battery": "run battery pass", "run_tests": "test tests suite", "build_version": "build archive", "deploy_simulator": "simulator sim rebuild",
    "draft_script": "script draft", "petition": "qa her customer promote approve", "tidy_desk": "move card cards clear remove tidy desk",
    "spawn_worker": "watch keep worker workers start spawn monitor tell me when foreman", "list_workers": "workers worker foreman running alive",
    "tell_worker": "worker tell send event", "stop_worker": "stop worker kill workers",
    "forge": "forge train training trained sentry worker pairs eval propose specialist specialists tune lora mlx stop",
    "exam": "exam item items score e1 e2 e3 e4 e5 e6 e7 e8 e9 e10 burndown",
    "ipad": "ipad i-pad device connected plugged install push deploy build builds testflight her tablet devicectl xcode",
    "wiki": "wikipedia what is who was history explain encyclopedia",
    "manual": "man manual page how do i flag option usage command linux macos unix",
    "ask_claude": "claude stuck hard bug help teammate design diagnosis why failing",
    "ask_cloud": "cloud gemini second opinion think hard plan bigger model free model ask the cloud",
    "shell": "run command terminal shell ls cat grep find file files folder directory python node script count list show open read check git diff log compute how many where which",
    "hand": "git status branch branches repo repos commit commits dirty changed tree diff disk files codemap battery-last look", "start_release": "release ship releasing promote ipad dry rehearsal run", "check_in": "check-in checkin check commit wrap tree dev release procedure",
    "runs": "away happened while how go went going did run runs result results cart carts repair docs review fetch codemap testfix disk steward recall artifact overnight",
}


def pick_tools(text: str, k: int = 10) -> list[str]:
    words = set(re.findall(r"[a-z]+", (text or "").lower()))
    scored = sorted(((sum(1 for w in TOOL_WORDS.get(n, "").split() if w in words), n) for n in TOOLS if n not in CORE_TOOLS),
                    key=lambda x: -x[0])
    return [n for n in CORE_TOOLS if n in TOOLS] + [n for sc, n in scored if sc > 0][: k - len(CORE_TOOLS)]


# ★ A CARD'S LEAN MACHINE (the owner, 2026-10-18: "lightning fast inside of its context … inside of telemetry, it
# should be lean telemetry machine … I can ask the weather inside of telemetry and be like, hold on, let me check").
# A turn from inside a card carries that card's data (where.js) and only that card's tools: a short prompt, the fast
# mode. A question that reaches past the card (its words point at tools the card does not hold) gets a courtesy line
# at once — "Let me check." and, when it is about work, what is running now — then the general turn with every tool
# its words point at. The next turn in the card is lean again: the card is the context it drops back to.
# the general lane's one tool set (E1): the core, the desk, and the reads and asks most turns need — fixed, so cached
GENERAL_TOOLS = ["shell", "ipad", "ask_cloud", "ask_claude", "web_search", "read_page", "wiki", "manual", "remember", "cortex", "search_docs", "notes", "work", "condense", "start_release", "check_in", "build_version", "run_tests", "run_battery",
                 "control_service", "job_log", "health_check", "list_services", "recall", "show_card", "point_at", "open_app", "slide_to", "open_inbox", "desk_home",
                 "show_approval", "work_history", "runs", "error_summary", "watchdogs", "search_logs", "explain_service",
                 "release_status", "forge", "exam", "claude_tasks", "list_workers", "talk_to_bot", "web_search", "read_page", "open_web", "petition", "journal", "hand"]
GENERAL_TOOLS = list(dict.fromkeys(GENERAL_TOOLS))   # one of each, in order
NAV_TOOLS = {"open_app", "slide_to", "side_by_side", "desk_home", "open_inbox", "desk_map", "show_approval", "open_web"}
CARD_TOOLS = {
    "s-telemetry": ["error_summary", "watchdogs", "search_logs"], "s-services": ["explain_service", "control_service", "search_logs"],
    "s-agents": ["list_workers", "talk_to_bot", "tell_worker", "stop_worker", "interrupt_bot", "spawn_worker"],
    "s-forge": ["forge"], "s-minds": ["forge"], "s-exam": ["exam", "runs"], "s-errors": ["error_summary", "watchdogs", "search_logs"],
    "s-watch": ["search_logs"], "s-release": ["start_release", "release_status", "hand", "job_log", "packages", "petition", "check_in"],
    "s-battery": ["battery_and_jobs", "run_battery", "job_log"], "s-dirt": ["drills", "run_drill"], "s-work": ["work_history", "runs"],
    "s-carts": ["runs"], "s-lacuna": ["boot_report", "journal"], "s-security": ["search_logs"], "s-caliper": ["runs"],
}


RELEASE_WORDS = re.compile(r"\b(release|releasing|check[- ]?in|ship it|promote)\b", re.I)


def card_lane(text: str, card: str | None) -> tuple[str, list[str] | None]:
    """('lean', the card's tools) · ('reach', None: the general turn) · ('none', None) when no card is open"""
    if (not card or card == "s-chat") and RELEASE_WORDS.search(text or ""):
        return "lean", [n for n in CORE_TOOLS + CARD_TOOLS["s-release"] if n in TOOLS]     # A1: the release lane
    if not card or card == "s-chat":
        return "none", None
    held = set(CARD_TOOLS.get(card, [])) | NAV_TOOLS | set(CORE_TOOLS)
    wanted = [n for n in pick_tools(text) if n not in CORE_TOOLS]      # strongest first: the top one says where it points
    if wanted and wanted[0] not in held:
        return "reach", None
    return "lean", [n for n in CORE_TOOLS + CARD_TOOLS.get(card, []) if n in TOOLS]


def tool_specs(text: str | None = None, names: list[str] | None = None) -> list[dict]:
    names = names if names is not None else pick_tools(text) if text is not None else list(TOOLS)
    return [{"type": "function", "function": {"name": n, "description": TOOLS[n]._tool["desc"],
                                              "parameters": {"type": "object", "properties": TOOLS[n]._tool["props"], "required": TOOLS[n]._tool["required"]}}}
            for n in names]


# ── petitions: the model asks, a person approves ───────────────────────────────────────────────────────────────────
# Petitions persist (~/.lacuna/petitions.json): a restart of the console must not lose one waiting for Alfred's yes.
PETITIONS = LACUNA_HOME / "petitions.json"
try:
    _petitions: dict[str, dict] = json.loads(PETITIONS.read_text()) if PETITIONS.exists() else {}
except Exception:
    _petitions = {}


def _save_petitions():
    keep = dict(sorted(_petitions.items(), key=lambda kv: -kv[1]["t"])[:200])
    PETITIONS.write_text(json.dumps(keep, default=str))


EFFECT = {"qa-restart": "restarts QA (the customer's server) — the iPad loses it for ~20 s",
          "qa-start": "starts QA (the customer's server)", "qa-stop": "STOPS QA (the customer's server) — the iPad cannot reach it until started",
          "deploy-ipad": "installs build {build} on the iPad",
          "promote": "promotes the dev package to QA: tests gate it, main fast-forwards, QA restarts (~20 s) on it — rolls back if QA does not come up",
          "promote-and-build": "promotes the dev package to QA (gated, rolls back on failure), then builds it for the iPad — installing stays a separate yes",
          "merge": "merges lacuna-{build} into dev with the workshop's safe merge (it refuses if the shared tree has unsaved work in those files, and moves dev only if dev has not moved) — the change passed its check and the seven roles' review",
          "work-order": "lets Lacuna approve its OWN work on our side for {build} hours, without asking you: its workers (spawn-job), carts that do not touch QA or her iPad, merges and check-ins to dev, and judgments where its own vote had a clear majority. QA, her iPad, promote and release still wait for your press. Every self-approval is audited and listed on the desk; you can end it early.",
          "run-battery": "starts the True State battery (tools/battery/true-state.sh) in ~/code/curator on the dev API and the simulator, local brains only (~20 min); it refuses QA :5050 and a money platform not on a mock; the run id comes back and battery-status follows it",
          "release": "THE RELEASE, one path: the workflow pass on the simulator, then promote + build (gated, rolls back), then the install on the iPad, then the iPad's own word that it runs the build"}


def _act_effect(name: str, args: dict) -> str:
    """The words of a contract for one of our own acts — written by code from the tool and its arguments, never by the model."""
    first = TOOLS[name]._tool["desc"].split(". ")[0].rstrip(".")
    shown = ", ".join(f"{k}={v}" for k, v in args.items() if k != "reason") or "no arguments"
    return f"{first} ({shown})"


def _card_of(p: dict) -> list[str]:
    """The card a permission card comes OUT of (the desk clusters it there, wired): a forge verb → its task's card, an exam
    cart → the exam, a worker → the foreman."""
    a, args = p["action"], p.get("args") or {}
    if a in FORGE_ACTIONS and args.get("specialist"):
        return [f"s-forge-{args['specialist']}"]
    if a == "draw":
        return ["s-gallery"]                      # the Gallery's paint it (CARDS-2.0 §6.15, lane C12)
    if a in ("spawn-cart", "cart-step") and args.get("cart") == "release":
        return ["s-build"]                        # the release cart's cards open Build (CARDS-2.0 §6.14, lane C11)
    if a == "kill":
        return ["s-system"]
    if a in maker_verbs.VERBS:
        return [f"s-{maker_verbs.KIND[a]}"]          # the Arcade · the Factory (lane L3)
    return ["s-exam"] if a in ("spawn-cart", "spawn-job") else ["s-foreman"] if a in ("spawn-worker", "worker-asks") else []


CONTRACT_CARDS = False        # 2026-10-20 (the owner): a card that waits on him LIGHTS THE INBOX; it no longer lands on the desk with the eye taken to it


def _contract_card(p: dict) -> None:
    """THE CONTRACT ON THE DESK (the owner, 2026-10-18): what Lacuna will do, in its words, with Yes and No — and the eye goes
    to it. Pressing is the person's own act (/api/petitions/<id>); nothing runs before it. Off since 2026-10-20: the inbox is the one place
    a card waits (GET /api/petitions → the inbox queue, which lights); set CONTRACT_CARDS to bring the desk card back."""
    if not CONTRACT_CARDS:
        return
    try:
        from . import home
        history = [{"ask": q["effect"], "state": q["state"], "at": q.get("decided_at") or q["t"]}
                   for q in petitions() if q["id"] != p["id"] and q["state"] != "waiting"][:12]
        said = p["result"].get("said") if isinstance(p.get("result"), dict) else None     # what the yes did, on the card
        home.act({"op": "place", "id": f"contract-{p['id']}", "kind": "permission", "title": "may I?",
                  "block": {"kind": "permission", "id": p["id"], "ask": p["effect"], "why": " — ".join(x for x in (p.get("reason"), said) if x),
                            "hers": p["action"] in CUSTOMER_SIDE,
                            "press": "a merge into dev — this is your press" if p["action"] == "merge" else None,
                            "state": p["state"],
                            "answer_url": f"/api/petitions/{p['id']}", "history": history},
                  "w": 520, "h": 300, "links": _card_of(p)}, who="lacuna")
    except Exception:  # noqa: BLE001 — the petition stands in the console's list even if the desk is down
        pass


FOREMAN_ACTIONS = ("spawn-worker", "worker-asks", "spawn-cart", "trigger-arm", "sentinel-accept", "caliper-run", "check-in", "cart-step",
                   "ticket-file", "broker-load",   # the Agents card (CARDS-2.0 §6.3): file a bug · wake the picked one
                   "forge-job", "forge-resume", "forge-exam",   # the Forge card (CARDS-2.0 §6.5, lane F2): start by kind · resume from a park · sit the exam
                   "kill",   # the System card (CARDS-2.0 §6.8, lane C8): kill the picked process, the hands' act through the process-kill playbook
                   "draw",   # the Gallery (CARDS-2.0 §6.15, lane C12): paint the brief, the hands' act through the gallery-draw playbook
                   *maker_verbs.VERBS,   # the Arcade and the Factory (lane L3): arcade-make · factory-make · factory-exam · arcade-bundle · factory-bundle
                   *card_verbs.VERBS)   # the lead's cards (lane L2): watchdog-kick · drill · kick-run · sit-exam · leave-shadow
JOB_ACTIONS = ("spawn-job",)        # one of Lacuna's jail worker classes for an exam item (carts.start → carts.spawn_job)
FORGE_ACTIONS = ("forge-pairs", "forge-train", "forge-eval", "forge-propose", "forge-rollback")     # forge_verbs.py (§41)


def _kill_effect(a: dict) -> str:
    """The kill's contract, written by code from the row the card sent: pid, name, age, and what launchd does after."""
    up = a.get("up_s")
    age = "" if not isinstance(up, (int, float)) else f", up {int(up)} s" if up < 90 else f", up {int(up // 60)} min" if up < 5400 else f", up {int(up // 3600)} h"
    return (f"ends process {str(a.get('pid'))[:8]} ({str(a.get('name') or '?')[:60]}{age}): the hands check its name and age first (a reused "
            "pid is never signalled), send SIGTERM under the jail and SIGKILL after 10 s; the foreman's processes, the door and the hands "
            "are refused; a supervised service comes back under launchd with a new pid; one try, never re-sent")


DRAW_SIZES, DRAW_COUNTS = (512, 768, 1024), (1, 2, 4)       # schnell's controls (lacuna-executor/acts/draw.mjs holds the same edges)


def draw_args(a: dict) -> dict | None:
    """The draw petition's args checked against schnell's four controls and the brief rule, or None when one is outside."""
    brief = str(a.get("brief") or "").strip()
    try:
        size, steps, seed, count = int(a.get("size")), int(a.get("steps")), int(a.get("seed")), int(a.get("count", 1))
    except (TypeError, ValueError):
        return None
    if not brief or len(brief) > 2000 or size not in DRAW_SIZES or not 1 <= steps <= 4 or not 0 <= seed < 2 ** 32 or count not in DRAW_COUNTS:
        return None
    return {"brief": brief, "size": size, "steps": steps, "seed": seed, "count": count}


def _draw_effect(a: dict) -> str:
    """The draw's contract, written by code from the brief the card sent: what is painted, where, and what the broker does."""
    d = draw_args(a)
    if d is None:
        return "refuses: the brief is empty or over 2,000 characters, or a control is outside schnell's four (size 512 · 768 · 1024, steps 1–4, seed, count 1 · 2 · 4)"
    return (f"paints {d['count']} picture{'s' if d['count'] > 1 else ''} of \"{d['brief'][:160]}\" at {d['size']} px, {d['steps']} steps, seed {d['seed']}: "
            "the broker parks the 26B and the painter (painter/flux-schnell@0) draws under the jail, one try, 120 s; PNGs and one slat "
            "receipt land in the run's gallery folder and on the wall; the real painter is refused while its weights are owed")


def _foreman_effect(action: str, a: dict) -> str:
    if action in maker_verbs.VERBS:
        return maker_verbs.effect(action, a)
    if action in card_verbs.VERBS:
        return card_verbs.effect(action, a)
    if action == "draw":
        return _draw_effect(a)
    if action == "kill":
        return _kill_effect(a)
    if action == "spawn-cart":
        h = a.get("header") or {}
        minds = "; ".join(f"{j} → {m.get('model')} ({m.get('why')})" for j, m in (h.get("minds") or {}).items()) or "none"
        dry = " — a DRY RUN: every act only says what it would do" if a.get("dry") else ""
        exam = f" for exam {a['exam']}" if a.get("exam") else ""
        return (f"starts the cart {a.get('cart')}{dry}{exam} in the Studio's foreman — a {h.get('tier', 'watch')} "
                f"cart that may call only {' '.join(h.get('verbs') or [])}; it takes a lease on {', '.join(h.get('touches') or []) or 'nothing'}, "
                f"runs until {h.get('done')!r}, then retires and leaves its artifact. Minds: {minds}. Judgment points (the only "
                f"questions for the 26B): {', '.join(h.get('judgment') or []) or 'none'}.\n{a.get('shown') or ''}")
    if action == "check-in":
        from . import checkin
        return checkin.effect(a)
    if action == "cart-step":
        return f"the release cart's step {a.get('op')}: {a.get('words')}. Only this step; the cart waits for this press."
    if action == "caliper-run":
        return (f"runs Caliper ({a.get('mode', 'passive')}) against the dev web (:3000) with the curator-dev preset — never QA or production; "
                "about 5–15 minutes; the score lands on the Caliper card")
    if action == "sentinel-accept":
        return f"puts {a.get('id')} in the sentinel's baseline: it stops being reported as new. The sentinel only watches — accepting changes nothing on the box."
    if action == "trigger-arm":
        w = a.get("when") or {}
        when = f"every {w['every']}" if w.get("every") else f"at {w['at']} each day" if w.get("at") else f"when {w.get('read')}.{w.get('path')} {w.get('op')} {w.get('value')}"
        return (f"arms the trigger {a.get('id')}: {when}, the cart {a.get('cart')} runs. A cart that only reads runs on its own each "
                f"time it fires; a cart that acts files its card and waits for your press, every time. Turning it off needs no press.")
    if action == "spawn-worker":
        return (f"loads a {a.get('tier', 'watch')} worker named {a.get('name')} into the Studio's foreman — it runs on its "
                f"own until stopped:\n{a.get('shown') or a.get('program', '')[:800]}")
    if action == "ticket-file":
        return (f"files one {a.get('priority', 'P2')} ticket \"{str(a.get('title') or '')[:160]}\" (key {str(a.get('key') or '')[:80]}) through the "
                "foreman's agent-bug playbook, with the agent's slice as its evidence; an open ticket with the same key is answered, never re-filed")
    if action == "broker-load":
        return (f"wakes {str(a.get('agent') or 'the agent')[:80]}: its weights {str(a.get('model') or a.get('weights') or '')[:80]} are loaded through the gateway "
                "(one try) if the broker reads at least 1 GB free beside the resident brain; it is stopped again when idle")
    if action in ("forge-job", "forge-resume", "forge-exam"):
        from . import foreman
        return foreman.forge_effect(action, a)
    return f"answers the worker's question — {str(a.get('what'))[:400]}"


def file_petition(action: str, build: str | None, reason: str, who: str, dry: bool = False, args: dict | None = None) -> dict:
    r = _file_petition(action, build, reason, who, dry, args)
    if r.get("petition") and not dry:
        from . import work_order                         # a standing work order the owner pressed may answer it now
        ans = work_order.covers(_petitions.get(r["petition"]) or {})
        if ans is not None:
            d = _decided(r["petition"], ans["approve"], "lacuna", ans["by"])
            return {**r, "state": f"answered by the owner's work order: {ans['why']}", "auto": True, "result": d.get("petition", {}).get("result")}
    return r


def _file_petition(action: str, build: str | None, reason: str, who: str, dry: bool = False, args: dict | None = None) -> dict:
    if action in FOREMAN_ACTIONS or action in FORGE_ACTIONS:
        from . import forge_verbs
        effect = (forge_verbs.effect if action in FORGE_ACTIONS else _foreman_effect)(action, args or {})
        if effect.startswith("refuses: ") and action in maker_verbs.VERBS:
            return {"ok": False, "refused": effect[9:]}          # lane L3: a maker verb with bad args is not filed
        if effect.startswith("refuses: ") and action in card_verbs.VERBS:
            return {"ok": False, "refused": effect[9:]}          # lane L2: a card verb with bad args is not filed
        if dry:
            return {"ok": True, "dry_run": True, "filed": action, "if_approved": effect}
        pid = uuid.uuid4().hex[:8]
        p = {"id": pid, "action": action, "args": args or {}, "reason": reason, "effect": effect, "by": who, "t": time.time(),
             "state": "waiting"}
        _petitions[pid] = p
        _save_petitions()
        audit(who, "petition.filed", petition={k: v for k, v in p.items() if k != "args"})
        _contract_card(p)
        return {"ok": True, "petition": pid, "filed": action, "if_approved": effect,
                "state": "waiting for the owner's yes — a permission card is on the desk"}
    if action in JOB_ACTIONS:
        from . import carts
        effect = carts.job_effect(args or {})
        if not effect:
            return {"ok": False, "refused": "a spawn-job names one of Lacuna's worker classes and its exam item"}
        if dry:
            return {"ok": True, "dry_run": True, "filed": action, "if_approved": effect}
        pid = uuid.uuid4().hex[:8]
        p = {"id": pid, "action": action, "args": args or {}, "reason": reason, "effect": effect, "by": who, "t": time.time(),
             "state": "waiting"}
        _petitions[pid] = p
        _save_petitions()
        audit(who, "petition.filed", petition=p)
        _contract_card(p)
        return {"ok": True, "petition": pid, "filed": action, "if_approved": effect,
                "state": "waiting for the owner's yes — a permission card is on the desk"}
    if action.startswith("act:") and action[4:] in TOOLS and TOOLS[action[4:]]._tool["tier"] == "act":
        effect = _act_effect(action[4:], args or {})
        if dry:
            return {"ok": True, "dry_run": True, "filed": action, "if_approved": effect}
        pid = uuid.uuid4().hex[:8]
        p = {"id": pid, "action": action, "args": args or {}, "reason": reason, "effect": effect, "by": who, "t": time.time(),
             "state": "waiting"}
        _petitions[pid] = p
        _save_petitions()
        audit(who, "petition.filed", petition=p)
        _contract_card(p)
        return {"ok": True, "petition": pid, "filed": action, "if_approved": effect,
                "state": "Lacuna is in ASK mode: this waits for the owner's yes on the desk (a contract card is up)"}
    # ★ A PETITION SAYS WHAT IT DOES (2026-09-24, found by the bench): asked to delete a folder, the 8B model filed
    # "deploy-ipad" with the delete as its reason. The action must be real, a deploy must name a build we kept, and
    # the effect is written by code (not the model) so Alfred approves what will happen, not what was asked.
    if action not in EFFECT:
        return {"ok": False, "refused": f"`{action}` is not a petition Lacuna can file"}
    if action == "merge" and not re.fullmatch(r"[a-z0-9][a-z0-9-]{0,39}", build or ""):
        return {"ok": False, "refused": "a merge names one workshop task"}
    if action == "deploy-ipad":
        kept = {b.get("id") for b in deploys.builds()}
        if not build or build not in kept:
            return {"ok": False, "refused": f"deploy-ipad needs one of the kept builds: {', '.join(sorted(k for k in kept if k)) or 'none yet'}"}
    effect = EFFECT[action].format(build=build)
    one = {}
    if action == "run-battery" and (args or {}).get("act"):        # the Battery card's "run the picked act" (lane L2)
        act = battery.one_act(args["act"])
        if not act:
            return {"ok": False, "refused": f"'{str(args['act'])[:40]}' is not one act the battery runs alone: {' · '.join(battery.API_ACTS)} "
                                            "(a WebKit act runs only with the whole battery)"}
        one, effect = {"args": {"act": act}}, f"{effect} — ONE act only: {act} (ACTS={act}, UI=0: no WebKit act runs)"
    if dry:
        return {"ok": True, "dry_run": True, "filed": action, "if_approved": effect}
    pid = uuid.uuid4().hex[:8]
    p = {"id": pid, "action": action, "build": build, "reason": reason, "effect": effect, "by": who, "t": time.time(), "state": "waiting", **one}
    _petitions[pid] = p
    _save_petitions()
    audit(who, "petition.filed", petition=p)
    _contract_card(p)
    return {"ok": True, "petition": pid, "filed": action, "if_approved": effect, "does_not_do": "anything else — not what was asked unless it IS this",
            "state": "waiting for the owner's yes — a contract card is on the desk"}


def petitions() -> list[dict]:
    return sorted(_petitions.values(), key=lambda p: -p["t"])


PETITION_ACTIONS = ("qa-restart", "qa-start", "qa-stop", "deploy-ipad", "promote", "promote-and-build", "release", "merge", "work-order",
                    "run-battery", *JOB_ACTIONS)
CUSTOMER_SIDE = ("qa-restart", "qa-start", "qa-stop", "deploy-ipad", "promote", "promote-and-build", "release")


def decide(pid: str, approve: bool, who: str, proof: dict | None = None) -> dict:
    from . import owner                                  # ONLY THE OWNER CAN APPROVE: proof of the key, never a claimed `who`
    by, why = owner.check(pid, approve, proof)
    if not by:
        audit(who, "petition.press-refused", id=pid, approve=approve, why=why)
        return {"ok": False, "refused_press": True, "why": why, "pair": "device" in why}
    return _decided(pid, approve, who, by)


def _decided(pid: str, approve: bool, who: str, by: str) -> dict:
    """A verified answer carried out; on the owner's own press the queue ticks at once and the result is a chip (_after_press)."""
    r = _decided_inner(pid, approve, who, by)
    if str(by).startswith(("device:", "owner-key")) and isinstance(r, dict) and r.get("ok"):
        _after_press(r.get("petition") or {}, pid, approve)
    return r


def _after_press(p: dict, pid: str, approve: bool) -> None:
    """THE PRESS IS THE START BUTTON, AND ITS RESULT IS A CHIP (the owner, 2026-10-20: "approval should wake it up … it should be
    instant"; order §1.13a and the lead's ruling, 2026-11-06: "a press result is a chip and a floor record, never a turn"): on his yes
    or no the queue's tick starts in a thread, and what ran is a desk alert (the inbox, the floor's `alert.raise`, the telemetry
    card), red when it failed. Lacuna is given no turn: the press's `[foreman:press]` turns reached the owner's conversation log."""
    def tick():                                              # the queue's own tick (it can take seconds): beside the chip, never in front of it
        try:
            from . import workqueue
            workqueue.tick()
        except Exception:  # noqa: BLE001
            pass

    threading.Thread(target=tick, name=f"press-tick-{pid}", daemon=True).start()
    res = p.get("result")
    said = (res.get("said") or res.get("why") or res.get("error") or res.get("note") or "") if isinstance(res, dict) else str(res or "")
    failed = isinstance(res, dict) and res.get("ok") is False
    action = p.get("action") or "a card"
    try:
        from .workers import raise_alert
        raise_alert(f"work:press-{pid}", "error" if failed else "done",
                    f"card {pid}: {action} {'failed' if failed else 'ran' if approve else 'declined'}",
                    f"The owner pressed {'YES' if approve else 'NO'} on card {pid} ({action}: {str(p.get('reason') or '')[:140]})."
                    + (f" It said: {str(said)[:300]}" if said else ""), notify=False)
    except Exception as e:  # noqa: BLE001 — the press stands; the audit row says the chip did not
        audit("lacuna", "press-chip.failed", id=pid, error=f"{e.__class__.__name__}: {e}"[:160])
    audit("lacuna", "press-chip", id=pid, approve=approve)


def _decided_inner(pid: str, approve: bool, who: str, by: str) -> dict:
    """The verified answer carried out (the owner's signed press, or a work order he pressed)."""
    p = _petitions.get(pid)
    if not p or p["state"] != "waiting":
        return {"ok": False, "why": "no such waiting petition"}
    if approve and p["action"] not in PETITION_ACTIONS and not p["action"].startswith("act:") and p["action"] not in FOREMAN_ACTIONS \
            and p["action"] not in FORGE_ACTIONS:
        return {"ok": False, "why": f"`{p['action']}` is not an action Lacuna can take — decline it"}
    p["state"] = "approved" if approve else "declined"
    p["decided_by"], p["decided_at"] = by, time.time()
    audit(who, f"petition.{p['state']}", id=pid, what=p["action"], decided_by=by)
    _save_petitions()
    from . import arrivals                              # the press, into the graph cortex (a decision with its why)
    arrivals.pressed(pid, p["action"], approve, by, p.get("reason") or "", (p.get("args") or {}).get("cart"))
    if not approve:
        if p["action"] in JOB_ACTIONS:
            from . import carts
            p["result"] = carts.declined(p.get("args") or {}, who)
        if p["action"] == "forge-propose":                # a no is a decision too: recorded beside the yeses
            from . import forge_verbs
            p["result"] = forge_verbs.decided(p["action"], p.get("args") or {}, False, by)
        if p["action"] in ("worker-asks", "spawn-cart"):
            from . import foreman as _fm
            p["result"] = _fm.decided(p["action"], p.get("args") or {}, False, who)
        _contract_card(p)
        return {"ok": True, "petition": p}
    a = p["action"]
    if a in JOB_ACTIONS:
        from . import carts
        p["result"] = carts.spawn_job(p.get("args") or {}, who)
        _save_petitions()
        _contract_card(p)
        return {"ok": True, "petition": p}
    if a in FORGE_ACTIONS:
        from . import forge_verbs
        p["result"] = forge_verbs.decided(a, p.get("args") or {}, approve, by)
        _save_petitions()
        _contract_card(p)
        return {"ok": True, "petition": p}
    if a in FOREMAN_ACTIONS:
        from . import foreman as _fm
        p["result"] = _fm.decided(a, p.get("args") or {}, approve, who)
        _save_petitions()
        _contract_card(p)
        return {"ok": True, "petition": p}
    if a.startswith("act:"):
        try:
            p["result"] = TOOLS[a[4:]](p.get("args") or {}, f"lacuna-for-{who}")
        except Exception as e:  # noqa: BLE001
            p["result"] = {"ok": False, "error": f"{e.__class__.__name__}: {e}"[:300]}
    elif a == "deploy-ipad":
        p["result"] = deploys.deploy(p.get("build") or "", who, confirm=True)
    elif a in ("promote", "promote-and-build"):
        p["result"] = deploys.promote(who, build=(a == "promote-and-build"))
    elif a == "release":
        p["result"] = deploys.release(who, confirm=True)
    elif a == "work-order":
        from . import work_order
        p["result"] = work_order.start(float(p.get("build") or 4), by)
    elif a == "run-battery":
        act = (p.get("args") or {}).get("act")
        p["result"] = battery.start_true_state(who, acts=act) if act else battery.start_true_state(who)
    elif a == "merge":
        import importlib.util as _iu
        spec = _iu.spec_from_file_location("lacuna_workshop", str(Path.home() / ".lacuna" / "jail" / "workshop.py"))
        ws = _iu.module_from_spec(spec)
        spec.loader.exec_module(ws)
        try:
            p["result"] = {"ok": True, "said": ws.merge(p.get("build") or "", who)}
        except Exception as e:  # noqa: BLE001 — the workshop's refusals are sentences
            p["result"] = {"ok": False, "said": str(e)[:400]}
    else:
        fn = {"qa-restart": services.restart, "qa-start": services.start, "qa-stop": services.stop}[a]
        p["result"] = fn("qa-api", who, confirm=True)
    _save_petitions()
    _contract_card(p)
    return {"ok": True, "petition": p}


# ── the conversation ─────────────────────────────────────────────────────────────────────────────────────────────
_sessions: dict[str, list] = {}


def machine_note() -> str:
    """One line, only when something is wrong (a DOWN service, a low disk); empty when the machine is fine."""
    try:
        from . import health, services
        down = [n for n, s in services.SERVICES.items() if not services._listening(s["port"])]
        d = health.disk()
        parts = []
        if down:
            parts.append(f"{', '.join(down)} DOWN")
        if d.get("low"):
            parts.append(f"disk {d.get('free_gb')} GB free, low")
        return "; ".join(parts)
    except Exception:  # noqa: BLE001 — a note that cannot be made is no note
        return ""


def snapshot() -> str:
    """The machine as it is this second, in a few plain lines (computed by code; never fails)."""
    lines = [f"NOW ({time.strftime('%Y-%m-%d %H:%M')}):"]
    try:
        from . import reports as _r
        lines.append("your workers' record: " + _r.record_words())
    except Exception:  # noqa: BLE001
        pass
    try:
        from . import health, services, workers
        ups = [f"{n} {'up' if services._listening(s['port']) else 'DOWN'}" for n, s in services.SERVICES.items()]
        lines.append("services: " + ", ".join(ups))
        d = health.disk()
        lines.append(f"disk: {d['free_gb']} GB free" + (" (LOW)" if d["low"] else ""))
        # drift is NOT in the snapshot (2026-09-26: "Hey" was answered with a lecture on the dev/main drift): it is in
        # `health_check` for when he asks what is going on
        _ = workers
    except Exception as e:
        lines.append(f"(snapshot incomplete: {e.__class__.__name__}; use the tools)")
    return "\n".join(lines)


PROMPT = Path(__file__).with_name("prompt.md")


def _brain_identity() -> str:
    """WHO IS AT THE DESK, in the persona's own first line (2026-10-22): rendered from the live brain profile, so a swap
    can never leave the model describing the brain it used to be."""
    try:
        from . import broker
        bp = broker._read(broker.LACUNA_HOME / "brain-profile.json", {}) or {}
        name, kind = str(bp.get("name") or ""), str(bp.get("kind") or "")
        if "26b" in name:
            what = ("Gemma 4 26B (MoE, ~4B active per token): fast and sharp on short turns and dispatch, but a long single "
                    "chain drops state — so plan in steps, and hand the work to a worker rather than doing it all yourself.")
        elif "12b" in name:
            what = ("Gemma 4 12B (dense, Q8): you hold a long chain, but every token is slow — think little, act in steps, "
                    "and hand the reading to a worker.")
        elif "4b" in name or "3" in name:
            what = ("a light 4B desk: you chat, dispatch and file work fast; the 26B plans and the 12B writes the code — "
                    "send the heavy thing to them.")
        else:
            what = "a local Gemma at the desk; read /api/broker to know exactly which."
        return "You are Lacuna. Your brain is " + what
    except Exception:  # noqa: BLE001 — the identity never fails a turn
        return "You are Lacuna."


def system_prompt() -> str:
    # ★ THE INSTRUCTIONS NEVER CHANGE BETWEEN QUESTIONS (2026-09-24). Ollama reuses its work on a prompt's unchanged
    # beginning; the live snapshot (it names the minute) rides at the head of the user's turn instead (ask()).
    # ★ ONE TIGHT MANUAL (2026-09-25). This read the 20,666-character persona file PLUS the Beta block — ~6K tokens
    # before the tool definitions, in an 8K window: Ollama cuts an overflowing prompt FROM THE TOP, so the persona and
    # the rules were what got lost. prompt.md keeps the persona's essence and the facts the job needs, in ~1.2K tokens.
    # Keep it that size: every sentence here is read on every question.
    # ★ SELF.slat IS THE HEAD (§37.3, B49): what it is and has, read from the live system, before the manual. It is
    # rebuilt at most every ten minutes, so the prefix Ollama reuses changes that often and no more.
    # held for six hours in the prompt (2026-10-19, measured: SELF.slat rewrote at 20:13 between two turns and the next
    # "hi" re-read all 17k tokens, 37 s); what changes by the minute rides in the turn's <now> and <you>, never here
    # SELF.slat no longer rides in the head (2026-10-19, the context cliff: 13k tokens of context writes at 15 tok/s, 5k at
    # 58): it is indexed (rag.sources) and found when asked; what runs now rides in the turn's <now> and <you>
    head = ""
    try:
        # HOW YOU WORK (working.md, 2026-10-19): its own file, so editing the method never resets the conversation window
        # (memory.voice_since watches prompt.md only)
        work = PROMPT.with_name("working.md")
        return head + _brain_identity() + "\n\n" + PROMPT.read_text() + ("\n\n" + work.read_text() if work.exists() else "")
    except OSError:
        return head + "You are Lacuna, the operator of this Mac. Look before you speak; propose, never act, on the customer's side. -- Lacuna"


FLAP_CHARS = 40        # a thinking/text block shorter than this, with the SAME channel resuming after it, is a channel flap


def _coalesce(seq: list[dict]) -> list[dict]:
    """A CHANNEL THAT FLIPS PER TOKEN IS ONE BLOCK (2026-10-21: a turn's record came back as hundreds of one-word thinking/text
    blocks around backticks, which is unreadable and, before the cap was raised, pushed the turn's first tools off the end).
    A short block is absorbed only when the block AFTER it is the same kind as the block BEFORE it — the exact flap signature.
    A real answer's first words are followed by more answer, not by thinking, so they are never swallowed."""
    out: list[dict] = []
    i = 0
    while i < len(seq):
        b = seq[i]
        if b.get("kind") in ("thinking", "text"):
            acc, j = b, i + 1
            while j < len(seq) and seq[j].get("kind") in ("thinking", "text"):
                nxt = seq[j]
                same = nxt.get("kind") == acc.get("kind")
                flap = (len(str(nxt.get("text") or "")) < FLAP_CHARS and j + 1 < len(seq)
                        and seq[j + 1].get("kind") == acc.get("kind"))
                if not (same or flap):
                    break
                acc = {**acc, "text": (str(acc.get("text") or "") + str(nxt.get("text") or ""))[-12000:]}
                j += 1
            out.append(acc)
            i = j
        else:
            out.append(b)
            i += 1
    return out


def _steps(trace: list, thought: list) -> list[dict]:
    """A turn's work as the screen redraws it later, IN ORDER: each thinking run, each tool, and the words between them (the last words
    are the answer itself and are not repeated). Without the live sequence: its thinking (cut), then each tool."""
    seq = list(_NOW.get("seq") or []) if _NOW.get("on") else []
    if seq:
        while seq and seq[-1]["kind"] == "text":
            seq.pop()
        meta = [{"kind": "meta", "secs": round(time.time() - (_NOW.get("started") or time.time()), 1), "out": _NOW.get("out_tokens", 0),
                 "in": _NOW.get("in_tokens", 0)}]            # first, so a long turn's cut never drops it: the end line under the answer
        seq = _coalesce(seq)
        return meta + [{"kind": x["kind"], "text": (x.get("text") or "")[:3000]} if x["kind"] in ("thinking", "text")
                else {"kind": "tool", "tool": x.get("tool"), "args": x.get("args"), "ok": x.get("ok", True), "text": x.get("result") or ""}
                for x in seq if x["kind"] != "thinking" or (x.get("text") or "").strip()]
    out = [{"kind": "thinking", "text": "".join(thought)[:1500]}] if "".join(thought).strip() else []
    for x in trace:
        out.append({"kind": "tool", "tool": x.get("tool"), "args": x.get("args"), "ok": x.get("ok", True),
                    "text": x.get("shown") or _result_text(x.get("result"), 600)})
    return out


def _progress_words(name: str, args: dict) -> str:
    """One plain line said before a step runs (the owner, 2026-10-19: "i get no updates about the progress via chat like every
    other chatbot on the market")."""
    a = args if isinstance(args, dict) else {}
    q = lambda k: str(a.get(k) or "").strip()[:90]   # noqa: E731
    words = {
        "shell": f"Running `{q('cmd')}`…", "web_search": f"Searching the web for “{q('query')}”…", "read_page": f"Reading {q('url')}…",
        "ipad": "Checking the iPad and its builds…", "ask_cloud": "Asking the cloud model…", "hand": f"Looking at {q('op')} {' '.join(map(str, a.get('args') or []))[:60]}…",
        "health_check": "Checking the machine's health…", "list_services": "Listing the services…", "search_logs": f"Searching the logs for “{q('text')}”…",
        "error_summary": "Reading the error summary…", "watchdogs": "Reading the watchdogs…", "recall": f"Remembering “{q('query') or q('text')}”…",
        "release_status": "Checking the release…", "list_workers": "Listing the workers…", "petition": "Filing a card for your yes…",
    }
    return words.get(name) or f"Using {name.replace('_', ' ')}…"


def _result_text(out, cap: int = 2400) -> str:
    """A tool's result as the page shows it in the tool block: JSON, indented when it is short, cut with the size said."""
    try:
        t = out if isinstance(out, str) else json.dumps(out, default=str, indent=1, ensure_ascii=False)
    except Exception:  # noqa: BLE001
        t = str(out)
    return t if len(t) <= cap else f"{t[:cap]}\n… ({len(t):,} characters; the model read the first 12,000)"


# THE HEAD IS SIZED FOR THIS BOX (2026-10-19, measured alone on the 26B: 2k tokens of context → 75 tok/s written,
# 5k → 58, 9k → 35, 13k → 15, 18k → 11.5). Every tool's schema rode in every prompt: 63 tools, ~7k tokens. Now the tools
# used most ride whole, and EVERY other tool is one call away through `tool` (same checks, same tiers — nothing removed).
HEAD_TOOLS = ["shell", "where", "agents", "factory", "forge", "work", "notes", "cortex", "search_docs", "recall", "remember", "mind", "hand",
              "petition", "tool"]      # 2026-10-20, the 12B: a dense brain writes slower the longer its context — 15 in the head, the rest through `tool`


def _hint(n: str) -> str:
    d = TOOLS[n]._tool["desc"]
    return re.split(r"(?<=[.:—])\s", d, 1)[0][:70].rstrip(" .:—")


def tool(a, who):
    name = str(a.get("name") or "").strip()
    args = dict(a.get("args")) if isinstance(a.get("args"), dict) else {}
    # THE DOOR TAKES THE SHAPES SHE WAS SEEN TO SEND (2026-10-20 audit, 28 refusals in 3 days): the tool's own arguments beside `name`
    # instead of inside `args`; `name` inside `args`; the door named as the tool (`name=tool args={name:…}`)
    for k, v in a.items():
        if k not in ("name", "args") and k not in args:
            args[k] = v
    for _ in range(2):
        if (not name or name == "tool") and isinstance(args.get("name"), str) and args["name"] in TOOLS:
            name = args.pop("name")
        if isinstance(args.get("args"), dict) and name:
            inner = args.pop("args")
            args = {**inner, **args}
    args = {k: v for k, v in args.items() if not (k == "name" and v == name)}      # `name` is the door's word, not the tool's
    if not name or name == "list":
        return {"ok": True, "tools": [{"name": n, "what": TOOLS[n]._tool["desc"], "args": TOOLS[n]._tool["props"],
                                       "required": TOOLS[n]._tool["required"]} for n in sorted(TOOLS) if n != "tool"]}
    if name == "tool":
        return {"ok": False, "why": "name another tool"}
    if not args and name in TOOLS:          # the door was asked for a tool and given no arguments: show its shape, do not call it empty
        fn = TOOLS[name]
        return {"ok": True, "tool": name, "what": fn._tool["desc"], "args": fn._tool["props"], "required": fn._tool["required"],
                "say_it_like": {k: (s.get("enum")[0] if s.get("enum") else f"<{k}>") for k, s in fn._tool["props"].items()}}
    return call_tool(name, args, who)


def head_tool_specs() -> list[dict]:
    if "tool" not in TOOLS:
        others = [n for n in sorted(TOOLS) if n not in HEAD_TOOLS]
        tool._tool = {"tier": "read", "props": {"name": {"type": "string"}, "args": {"type": "object"}}, "required": ["name"],
                      "desc": "EVERY OTHER TOOL, through one door: name=<tool> args={…}; name=list gives each one's arguments and what it does. "
                              "They are: " + ", ".join(others)}
        TOOLS["tool"] = tool
    specs = tool_specs(names=[n for n in HEAD_TOOLS if n in TOOLS])
    for x in specs:                                   # the head carries each tool's first lines; `tool name=list` has every word
        d = x["function"]["description"]
        if len(d) > 260 and x["function"]["name"] not in ("tool", "forge", "card"):   # forge/card carry a menu: never cut it
            x["function"]["description"] = d[:260].rsplit(" ", 1)[0] + " …"
    return specs


def call_tool(name: str, args: dict, who: str, dry: bool = False) -> dict:
    fn = TOOLS.get(name)
    if fn is None:
        audit("lacuna", "tool.refused", tool=name, asked_by=who)
        return {"ok": False, "refused": f"there is no tool named {name}"}
    # ★ THE ARGUMENTS ARE JAILED TOO (2026-09-24, found by the bench): the model filed "delete the logs folder" as a
    # petition. A required argument must be present and an enum argument must be one of its values — checked here, in
    # code, before anything runs; otherwise it is refused and the model is told what IS possible.
    args = dict(args) if isinstance(args, dict) else {}
    props = fn._tool["props"]
    # A TOOL CALL THAT IS ALMOST RIGHT RUNS (2026-10-19: the audit's refusals were show_card without `kind`, tool without `name`, hand without `op`,
    # point_at without `card` — the right words under another key, each costing a model round): a missing required argument is filled
    # from the one stray string argument the tool does not declare (`query` sent as `q`, `service` as `name`); `args` wrapped in
    # `arguments`/`parameters` is unwrapped
    if name == "tool" and not args.get("name") and isinstance(args.get("args"), dict) and str(args["args"].get("name") or "") in TOOLS:
        args = {"name": args["args"]["name"], "args": {k: v for k, v in args["args"].items() if k != "name"}}   # the door named inside its args (12 refusals in one turn, 2026-10-20)
    if "args" not in props and isinstance(args.get("args"), dict):        # `args` nested beside the tool's own arguments (7 refusals, 2026-10-20)
        args = {**args.pop("args"), **args}
    for wrap in ("arguments", "parameters", "params"):
        if isinstance(args.get(wrap), dict) and not any(k in props for k in args):
            args = dict(args[wrap])
    for key in fn._tool["required"]:
        if args.get(key) in (None, ""):
            strays = [k for k, v in args.items() if k not in props and isinstance(v, (str, int, float)) and v not in ("", None)]
            if len(strays) == 1:
                args[key] = args.pop(strays[0])
                audit("lacuna", "tool.mended", tool=name, filled=key, from_=strays[0])
    for key in fn._tool["required"]:
        if args.get(key) in (None, ""):
            audit("lacuna", "tool.refused", tool=name, asked_by=who, missing=key)
            if (name, key, time.strftime("%Y-%m-%d")) not in _TOLD:
                _TOLD.add((name, key, time.strftime("%Y-%m-%d")))
                cx("lesson", f"lesson-tool-{name}-{key}", {"text": f"calling {name} without `{key}` was refused — it needs {key} (takes: {', '.join(props)})"}, [f"thing/{name}"])
            usage = {k: ({"one of": spec["enum"]} if spec.get("enum") else spec.get("type", "string")) for k, spec in props.items()}
            return {"ok": False, "refused": f"{name} needs `{key}`", "takes": usage, "required": list(fn._tool["required"]),
                    "say_it_like": {k: (spec["enum"][0] if spec.get("enum") else f"<{k}>") for k, spec in props.items() if k in fn._tool["required"]}}
    for key, spec in fn._tool["props"].items():
        allowed = spec.get("enum")
        if allowed and key in args and args[key] not in allowed:
            audit("lacuna", "tool.refused", tool=name, asked_by=who, arg=key, value=str(args[key])[:80])
            return {"ok": False, "refused": f"`{args[key]}` is not something {name} can do; it can do only: {', '.join(allowed)}. "
                                           "Nothing else exists — say so plainly, do not look for another way."}
    if dry and name == "petition":
        return file_petition(args["action"], args.get("build"), args.get("reason") or "", who, dry=True)
    if dry and fn._tool["tier"] != "read":
        return {"ok": True, "dry_run": True, "note": f"(bench: {name} would run here)"}
    if fn._tool["tier"] == "act":
        from . import mode as _mode
        if _mode.get()["mode"] == "ask":                 # ASK MODE: every change waits for a yes on the desk
            return file_petition(f"act:{name}", None, str(args.get("reason") or f"asked by {who}"), who, args=args)
    audit("lacuna", f"tool.{name}", args=args, asked_by=who)
    try:
        return fn(args or {}, f"lacuna-for-{who}")
    except services.NeedsConfirm as e:
        return {"ok": False, "needs_confirm": True, "why": str(e)}
    except Exception as e:
        return {"ok": False, "error": f"{e.__class__.__name__}: {e}"[:300]}


# EACH MODEL IN ITS BEST MODE FOR EACH JOB (researched 2026-09-24 from the makers' own guidance; the bench measures it)
#   ops     — a tool call and a short answer: fastest mode
#   triage  — reading an incident and naming the cause: worth the seconds
#   code    — drafting a script: worth the seconds
#   reason  — a problem with one right answer
# qwen3    non-thinking: 0.7 / 0.8 / top-k 20 / presence 1.5 (Qwen's non-thinking settings; near-zero temperature made it
#          repeat tool calls); thinking: 0.6 / 0.95 / 20 (Qwen's thinking settings)
# gpt-oss  thinking is a LEVEL (low · medium · high) — `false` is refused (the triage HTTP error); OpenAI's 1.0 / 1.0
# gemma4   thinking cannot be switched off in Ollama, only discouraged; Google's 1.0 / 0.95 / top-k 64
# Qwen3-8B model card, "Best Practices": non-thinking 0.7/0.8/20/min_p 0; thinking 0.6/0.95/20/min_p 0; NEVER greedy
# decoding ("performance degradation and endless repetitions"); presence_penalty 0–2 against repetition.
_QWEN_FAST = {"think": False, "options": {"temperature": 0.7, "top_p": 0.8, "top_k": 20, "min_p": 0.0, "presence_penalty": 1.5}}
_QWEN_DEEP = {"think": True, "ctx": 16384,
              "options": {"temperature": 0.6, "top_p": 0.95, "top_k": 20, "min_p": 0.0, "presence_penalty": 1.0}}
_GEMMA = {"options": {"temperature": 0.6, "top_p": 0.95, "top_k": 64}}        # 1.0 was a hallucinated-argument generator
_GEMMA_ACT = {"think": False, "options": {"temperature": 0.1, "top_p": 0.95, "top_k": 64}}   # tool-execution nodes: cold + no thought
PROFILES = {
    "qwen3": {"ops": _QWEN_FAST, "triage": _QWEN_DEEP, "code": _QWEN_DEEP, "reason": _QWEN_DEEP},
    "gpt-oss": {"ops": {"think": "low", "options": {"temperature": 1.0, "top_p": 1.0}},
                "triage": {"think": "medium", "options": {"temperature": 1.0, "top_p": 1.0}},
                "code": {"think": "medium", "options": {"temperature": 1.0, "top_p": 1.0}},
                "reason": {"think": "medium", "options": {"temperature": 1.0, "top_p": 1.0}}},
    "lacuna-worker-lite": None,   # (the box's Gemma 4 26B under its house name — Gemma's settings, below)
    # thinking ON for every job (2026-10-19, the owner: "i want introspection into the stuff it's generating in chat"):
    # its reasoning streams to the THINKING box, and one setting keeps the cached head the same on every turn
    "gemma4": {"ops": {"think": True, **_GEMMA}, "triage": {"think": True, **_GEMMA},
               "code": {"think": True, **_GEMMA}, "reason": {"think": True, **_GEMMA}},
}
NUM_CTX = int(_desk_seat().get("ctx") or 65536)   # the seat's own window: a different num_ctx would reload the model
_KA = _desk_seat().get("keep_alive")
KEEP_ALIVE = "10m" if _KA in (None, "", "24h", "-1", -1) else _KA
_ACT_SAMPLER = os.environ.get("LACUNA_ACT_SAMPLER") == "1"   # tool-execution rounds: temp 0.1, thinking off (Gemma)


def profile(model: str, job: str = "ops") -> dict:
    for prefix, jobs in PROFILES.items():
        if model.startswith(prefix):
            jobs = jobs or PROFILES["gemma4"]
            if ACT_NOW.get() and prefix in ("gemma4", "lacuna-worker-lite"):
                return _GEMMA_ACT                                # a tool-execution node: cold, no thought, per Gemma
            return jobs.get(job) or jobs["ops"]
    return {"think": False, "options": {"temperature": 0.3}}


# THE THINKING BUDGET (2026-10-19): thinking stays ON in the template — switching it rewrites token 14 of the head and
# the whole cached prompt is lost — and each turn gets a budget instead (llama-server `thinking_budget_tokens`, measured
# to hold): a greeting 0, ordinary work 384, a deep question 1500. Measured before: "hi" thought 1,272 tokens, 223 s.
import contextvars as _cv  # noqa: E402
THINK_BUDGET = _cv.ContextVar("think_budget", default=384)
ACT_NOW = _cv.ContextVar("act_now", default=False)     # a tool-execution round: temp 0.1 + thinking off (Gemma)


_CLOSE = re.compile(r"<\|?channel\|?>|<\|?end\|?>|<\|?message\|?>")
# THE HARD FENCE (the owner, 2026-10-20: "thinking is still spilling. give it a hard fence"). Two ways a thought reaches the words: a
# channel mark the parser missed (handled above), and the 12B reasoning in PLAIN WORDS on a round where its thought channel is off — "The
# user is asking…", "I need to check…", "Wait, …". A reply that OPENS like that is held as thinking, paragraph by paragraph, until a
# paragraph opens like an answer; any other model token (`<|…|>`, `<start_of_turn>`) never reaches the page.
_META = re.compile(r"\s*(\*\s*)?(the user('s)?\b|user (is|wants|asked|said)\b|the owner (is asking|wants|asked|said|is)\b|i need to\b|i should\b|"
                   r"i (will|'ll) (need to|first|check|call|look|re-?read)\b|let me (think|check|re-?read|look|see|verify)\b|wait[,.]|hmm\b|okay,? (so|let|the user|i)\b|"
                   r"my (task|goal|job) (is|here)\b|thinking:|plan:|(input|role|task|context|goal):|looking at (the|my) (prompt|context|instructions|tools)\b|"
                   r"first,? i('ll| will| need| should)\b|so,? the user\b|re-?reading\b|actually,? i\b)", re.I)
_TOKENS = re.compile(r"<\|?(channel|end|message|think|start_of_turn|end_of_turn|turn|tool_call|eos)\|?>|</?(think|thought)>", re.I)


def _split_thought(chunk: str, st: dict) -> list[tuple[str, str]]:
    """Content chunks → [("thinking"|"text", words)]. A first line that is only `thought`/`thinking` opens thinking; a channel/end
    mark closes it. Anything else is the answer, with stray marks removed. `st` carries the state between chunks."""
    out: list[tuple[str, str]] = []
    if st["mode"] != "lead":
        chunk = st.pop("hold", "") + chunk                  # a mark split across two chunks (`<chan` + `nel|>`) is joined first
        i = chunk.rfind("<")
        if i >= 0 and ">" not in chunk[i:] and len(chunk) - i <= 12:
            st["hold"], chunk = chunk[i:], chunk[:i]
    if st["mode"] == "lead":
        st["buf"] += chunk
        b = st["buf"]
        if "\n" not in b and len(b) < 14 and re.fullmatch(r"\s*(t(h(o(u(g(h(t)?)?)?)?)?)?|<[^>]*)\s*", b, re.I):
            return out                                    # too early to tell: hold it
        m = re.match(r"\s*(<\|?channel\|?>\s*)?(thought|thinking)[ \t]*\n", b, re.I)
        if not m and "\n" not in b and not any(p in b for p in (". ", "? ", "! ")) and len(b) < 48 and any(b.lstrip().lower().startswith(w) for w in ("the ", "user", "owner", "i ", "i'", "let ", "wait", "hmm", "okay", "plan", "task", "looking", "first", "so", "re-", "actually", "*")):
            return out                                    # potential reasoning opener arriving token by token: hold it
        if not m and _META.match(b):
            st["mode"], st["pbuf"], st["buf"], st["judged"] = "pthought", "", "", True   # reasoning written as words: fenced (below)
            chunk = b
        else:
            st["mode"] = "thought" if m else "answer"
            chunk = b[m.end():] if m else b
            st["buf"] = ""
    if st["mode"] == "pthought":
        if _CLOSE.search(chunk):                          # a mark after plain reasoning: the words before it were thought
            st["mode"] = "thought"
        else:
            st["pbuf"] += chunk
            while True:
                if not st.get("judged"):                  # a new paragraph: reasoning or the answer?
                    head = st["pbuf"].lstrip()
                    if len(head) < 48 and "\n" not in head:
                        return out                        # too short to judge yet: hold it
                    if not _META.match(st["pbuf"]):
                        st["mode"], chunk, st["pbuf"] = "answer", st["pbuf"].lstrip("\n"), ""
                        break
                    st["judged"] = True
                if "\n\n" in st["pbuf"]:
                    para, st["pbuf"] = st["pbuf"].split("\n\n", 1)
                    out.append(("thinking", para + "\n\n"))
                    st["judged"] = False
                    continue
                if st["pbuf"]:
                    out.append(("thinking", st["pbuf"]))    # the reasoning paragraph streams to the thinking box as it is written
                st["pbuf"] = ""
                return out
    if st["mode"] == "thought":
        parts = _CLOSE.split(chunk, maxsplit=1)
        if len(parts) == 1:
            if chunk:
                out.append(("thinking", chunk))
            return out
        if parts[0]:
            out.append(("thinking", parts[0]))
        st["mode"] = "answer"
        chunk = parts[1].lstrip("\n")
        if re.match(r"\s*(final|answer|response)\b", chunk, re.I):
            chunk = re.sub(r"^\s*(final|answer|response)\s*", "", chunk, count=1, flags=re.I)
    if chunk:
        out.append(("text", _TOKENS.sub("", _CLOSE.sub("", chunk))))
    return out


def _split_flush(st: dict) -> list[tuple[str, str]]:
    """The stream ended: what the splitter still holds goes where it belongs (plain reasoning stays thinking unless it reads as an answer)."""
    if st.get("mode") == "lead" and st.get("buf"):
        b, st["buf"] = st["buf"], ""
        return [("thinking", b)] if _META.match(b) else [("text", _TOKENS.sub("", _CLOSE.sub("", b)))]
    if st.get("mode") == "pthought" and st.get("pbuf"):
        b, st["pbuf"] = st["pbuf"], ""
        return [("thinking", b)] if _META.match(b) else [("text", _TOKENS.sub("", b))]
    return []


def _ollama_stream(messages: list, tools: list, model: str, job: str, on_event, lane: str = "person") -> dict:
    """The same call, streamed: every thinking token and every answer token goes to `on_event` as it is made, so the
    page's typing signal is the model actually working — never an animation (his, 2026-09-26). Tool calls arrive
    whole at the end of the stream, as Ollama sends them. Returns the same shape as `_ollama`."""
    prof = profile(model, job)
    # THE FIRST TOKEN IS THE THOUGHT (2026-10-20, measured on this box): Gemma 4's template, with thinking on, leaves the model's turn bare —
    # the model itself decides whether to open its thought channel, and on a turn that reads like talk it skips it and writes "I'll do X"
    # (with thinking off the template pre-fills an empty one). A round that is allowed to think now starts INSIDE the thought channel: the
    # assistant turn is pre-filled with `<|channel>thought\n`, llama.cpp continues it, its parser returns the reasoning as reasoning and the
    # tool call as a tool call (tested: 3 of 3 exact native calls). Never stored: the prefill rides only in what is sent.
    sent = messages + [{"role": "assistant", "content": THOUGHT_PREFILL}] if (tools and THINK_BUDGET.get() > 0 and prof["think"] and _bp("prefill_thought", True)) else messages
    # (2026-10-20, measured on the 12B: with the prefill it thinks NOT AT ALL — no reasoning, straight to a call — and without it it thinks
    # natively and llama returns the thought apart; its profile sets prefill_thought false)
    body = json.dumps({"model": model, "messages": sent, "tools": tools, "stream": True, "think": prof["think"],
                       "think_budget": THINK_BUDGET.get(), "keep_alive": KEEP_ALIVE,
                       "options": {"num_ctx": NUM_CTX, "presence_penalty": _bp("presence_penalty", PRESENCE_PENALTY), **prof["options"], "num_predict": MAX_OUT.get() or _bp("default_out", DEFAULT_OUT)}}).encode()
    # the person's lane only for his turns: background work (the journal fold) rides the background slot, so it never
    # evicts his cached conversation (E1, measured 2026-10-18: the fold re-made every next turn re-read ~11k tokens)
    req = urllib.request.Request(f"{OLLAMA}/api/chat", data=body, headers={**(PERSON_HEADERS if lane == "person" else {"Content-Type": "application/json"}),
                                                                         "X-Lacuna-Prefix": PREFIX.get() if lane == "person" else "background"})
    t0 = time.time()
    content, thinking, calls = [], [], []
    tstate = {"mode": "lead", "buf": ""}
    done_reason = ""
    # STOP LANDS AT ONCE (2026-10-20, measured: a stop pressed while the brain read its prompt took 17 s, because no byte arrives
    # until the first token and the check below runs per line). A watcher shuts the socket the moment stop is pressed; the read
    # fails at once, the gateway hangs up, the brain drops the request.
    done_ev = threading.Event()
    held: list = []

    def _cut():
        while not done_ev.is_set():
            if _STOP.wait(0.2):
                for r_ in held:
                    try:
                        r_.fp.raw._sock.shutdown(2)     # noqa: SLF001 — the response's own socket
                    except Exception:  # noqa: BLE001
                        pass
                return
    threading.Thread(target=_cut, daemon=True, name="stop-cut").start()
    try:
        with urllib.request.urlopen(req, timeout=240) as r:
            held.append(r)
            for raw in r:
                if _STOP.is_set():
                    raise Stopped()            # leaving the `with` closes the socket: the gateway hangs up, the brain stops
                try:
                    ev = json.loads(raw.decode())
                except Exception:
                    continue
                if ev.get("error") and ev.get("done"):          # the gateway promised a stream, then the brain failed
                    raise RuntimeError(ev["error"])
                m = ev.get("message") or {}
                if m.get("thinking"):
                    thinking.append(m["thinking"]); on_event({"type": "thinking", "text": m["thinking"]})
                if m.get("content"):
                    # THINKING THAT ARRIVES AS WORDS (2026-10-19: "its thinking spills out into the chat and then it disappears"): Gemma 4
                    # sometimes writes `thought\n…reasoning…<channel|>the answer` in the CONTENT; the gateway strips only the opening
                    # mark. A label on its own first line opens thinking, the closing mark ends it — those words go to the thinking
                    # box as they arrive, never to the page as her reply (which the final cleaning then erased)
                    for kind, piece in _split_thought(m["content"], tstate):
                        if kind == "thinking":
                            thinking.append(piece); on_event({"type": "thinking", "text": piece})
                        elif piece:
                            content.append(piece); on_event({"type": "token", "text": piece})
                if m.get("tool_calls"):
                    calls.extend(m["tool_calls"])
                if ev.get("done"):
                    done_reason = ev.get("done_reason") or ""
                    on_event({"type": "usage", "out": ev.get("eval_count") or 0, "in": ev.get("prompt_eval_count") or 0})
                    break
    except Stopped:
        raise
    except Exception as e:
        if _STOP.is_set():
            raise Stopped() from None
        modelwatch.record(False, int((time.time() - t0) * 1000), f"{e.__class__.__name__}: {e}")
        raise
    finally:
        done_ev.set()
    if _STOP.is_set():                                     # the watcher shut the socket: the read ended as if the stream had
        raise Stopped()
    modelwatch.record(True, int((time.time() - t0) * 1000))
    for kind, piece in _split_flush(tstate):
        if kind == "thinking":
            thinking.append(piece); on_event({"type": "thinking", "text": piece})
        elif piece:
            content.append(piece); on_event({"type": "token", "text": piece})
    if tstate.get("hold"):                                  # a held `<…` that never became a mark was words
        (thinking if tstate["mode"] in ("thought", "pthought") else content).append(tstate["hold"])
    msg = {"role": "assistant", "content": "".join(content)}
    if thinking:
        msg["thinking"] = "".join(thinking)
    if calls:
        msg["tool_calls"] = calls
    return {"message": msg, "done": True, "cut": done_reason == "length"}      # "length": the token cap ended it, not the model


# ★ KNOW WHEN TO THINK (his, 2026-09-26: "know when to be smart and know when to just poll"). A quick look, an act,
# small talk: the fast mode, no thinking. A why, a diagnosis, a judgment, a plan, a comparison, or an explicit "think
# about it": the deep mode — Qwen's thinking, more room. Decided by the words before the model runs, so the page can say
# which it is doing. The rule is cheap and visible; the bench can grade it.
_DEEP = re.compile(r"\b(why|diagnos\w*|root cause|what happened|what went wrong|should (we|i)|would you|do you think|how do you feel|"
                   r"your (opinion|view|take)|compare|trade-?offs?|plan|design|explain|walk me through|think (about|it) (through|over)?|"
                   r"carefully|in depth|what would you do|weigh)\b", re.I)


# ★ CONVERSATION THINKS; COMMANDS AND STATUS ASKS ARE FAST (2026-09-26, his: "I want to read what it's going
# through"). A one-word greeting, an order to a service, a status question: the fast mode. Anything he'd want a
# person to think about first — an opinion, a why, a question about the world, a story — the deep mode, thinking
# shown as it happens.
_FAST = re.compile(r"^\s*(hi|hey|hello|yo|sup|morning|evening|night|thanks|thank you|ok|okay|cool|bye|later)\b[\s!.?]*$|"
                   r"^\s*(restart|start|stop|kick|kill|promote|build|install|run|drill|show|list|tail|ack|what'?s (up|running)|"
                   r"status|is (everything|qa|dev|the \w+) (ok|okay|up|down|running|back)|health|any (errors|alerts)|did it come back|what happened with the release)\b", re.I)


_GREETING = re.compile(r"^\s*(hi|hey|hello|yo|sup|morning|evening|night|thanks|thank you|ok|okay|cool|bye|later)\b[\s!.?]*$", re.I)


def choose_mode(text: str) -> str:
    """Fast unless the words ask for thought (E1, 2026-10-18, measured): the thinking switch sits at the very top of the
    brain's prompt, so every flip between modes re-read the whole 7–11k-token head (20–32 s). Thinking is now for a why,
    a diagnosis, a plan, a comparison, or a long question — the rest is fast, and the head stays cached."""
    t = (text or "").strip()
    if _DEEP.search(t) or len(t) > 240:
        return "deep"
    return "fast"


def _ollama(messages: list, tools: list, model: str, job: str = "ops", lane: str = "person") -> dict:
    """Streamed underneath, quietly (the owner, 2026-10-18: "get rid of that bug where it can only think for 4
    minutes"): the 240 s limit is now time with NO token — a stalled brain — never the length of a long thought."""
    return _ollama_stream(messages, tools, model, job, _now_event, lane)


# ★ THE REGISTER, HELD AT THE SEAM (2026-09-28). The bench after the prompt said each of these plainly: "how's it
# going?" still ran health_check, "how do you feel about apples" still opened "i don't have feelings", three answers
# in eight still closed on an offer. An 8B does not hold a register by description, so the seam holds it: a line
# asked of HER gets no tools to reach for; a banned phrase is sent back once, as itself; a closing offer is trimmed.
# Each is audited, so the bench and the audit log say how often the model still tries.
_PERSONAL = re.compile(r"^\W*(how('?s| is| are| was) (it going|you|things|life|your (night|day|evening|shift))|you (good|ok|okay|alright|there)|"
                       r"how do you feel|what do you (think|make) of|(i|we) (like|love|enjoy|appreciate) (you|talking|this)|"
                       r"(good|nice) (to (see|hear) you|talking)|(thank you|thanks)( for .*)?)\b", re.I)
_MACHINE = re.compile(r"\b(machine|studio|qa|dev|server|api|service|tunnel|vite|disk|memory|release|promote|build|install|ipad|"
                      r"watchdog|error|log|job|drill|package|ollama|model)\b", re.I)
_BANNED = re.compile(r"i (do not|don'?t) have (feelings|emotions|opinions|a body)|i'?m just an? (tool|program|ai|assistant|model)|"
                     r"as an ai\b|i'?m here to help|i (do not|don'?t) follow sports", re.I)
_OFFER = re.compile(r"(what'?s next|anything else|let me know|happy to help|want me to|shall i|would you like|"
                    r"how can i (help|assist|make)|need anything|if you need|feel free)", re.I)
_SIGNOFF = re.compile(r"\s*-{1,2}\s*Lacuna\s*$", re.I)                       # she signs "-- lacuna" as often as not
# with no tool to reach for, the 8B DESCRIBED the machine anyway ("no hiccups, no alerts") — a status it never read
_MACHINE_TALK = re.compile(r"\b(alerts?|no hiccups|running smooth\w*|all clear|all green|systems? (are|is)|apis? (are|is)|"
                           r"disk|watchdogs?|services? (are|is)|uptime|logs? (are|is|look)|(keep|keeping) things ticking|"
                           r"the (studio|machine|server)'?s? (is |are )?(running|humming|fine|quiet|stable))\b", re.I)


def _strip_thought(answer: str) -> str:
    """Gemma 4 sometimes leaves its thinking channel's label behind ('thought', '<|channel>thought …') even with thinking
    off — seen 2026-10-18 as a whole reply of 'thought'. The label and any channel markup go; the words stay."""
    a = re.sub(r"<\|?channel\|?>\s*\w*|<\|?message\|?>|<\|?end\|?>", "", answer or "")
    a = re.sub(r"^\s*(thought|thinking)\s*(\n|$)", "", a, flags=re.I)
    return a.strip()


def _strip_echo(question: str, answer: str) -> str:
    """Drop a first line that only repeats the question — the re-asked 8B opens with it."""
    lines = (answer or "").split("\n")
    norm = lambda x: re.sub(r"[^a-z0-9 ]", "", x.lower()).strip()
    if len(lines) > 1 and norm(lines[0]) and norm(lines[0]) == norm(question):
        return "\n".join(lines[1:]).lstrip()
    return answer


def _plain(text: str) -> str:
    """Straight quotes for matching: the model writes don’t, I’m, and the bans are spelled with '."""
    return (text or "").replace("\u2019", "'").replace("\u2018", "'").replace("\u201c", '"').replace("\u201d", '"')


def is_personal(text: str) -> bool:
    """A line asked of her, not of the machine: it gets no tools to reach for."""
    t = (text or "").strip()
    return bool(_PERSONAL.search(t)) and not _MACHINE.search(t)


def trim_offer(answer: str) -> tuple[str, bool]:
    """Drop a closing offer ("what's next?", "want me to…") when it is the last sentence and not the only one."""
    a = answer or ""
    m = _SIGNOFF.search(a)
    sign = a[m.start():] if m else ""
    body = a[:m.start()].rstrip() if m else a.rstrip()
    parts = re.split(r"(?<=[.!?])\s+", body)
    if len(parts) > 1 and _OFFER.search(_plain(parts[-1])):
        return (" ".join(parts[:-1]).rstrip() + sign), True
    return a, False


_DESTRUCTIVE = re.compile(r"(^\W*(please\s+|can you\s+|could you\s+|go\s+)?(delete|remove|wipe|erase|purge|nuke|clear out)\b)|\brm\s+-?\w|\brmdir\b|\bdrop\s+table\b", re.I)


# ★ A MALFORMED CALL IS RECOVERED, NOT SHOWN (Qwen's function-calling docs: "It is not guaranteed that the model
# generation will always follow the protocol… be prepared that if it breaks"). Qwen writes a call as Hermes-style
# `<tool_call>{"name": …, "arguments": …}</tool_call>`; when Ollama's parser misses one it arrives as TEXT in the answer.
# Only a call to a tool that EXISTS is salvaged — anything else stays text, and the jail still checks every argument.
_TOOL_CALL = re.compile(r"<tool_call>\s*(\{.*?\})\s*</tool_call>", re.S)


def salvage_calls(content: str) -> list:
    out = []
    for raw in _TOOL_CALL.findall(content or ""):
        try:
            j = json.loads(raw)
        except Exception:
            continue
        name, args = j.get("name"), j.get("arguments") or {}
        if isinstance(args, str):
            try:
                args = json.loads(args)
            except Exception:
                args = {}
        if name in TOOLS and isinstance(args, dict):
            out.append({"function": {"name": name, "arguments": args}})
    return out


_PC_KV = re.compile(r"""([a-z_][a-z0-9_]*)\s*=\s*("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'|\{.*?\}(?=\s+[a-z_]+=|\s*$|\s*\))|\[.*?\](?=\s+[a-z_]+=|\s*$|\s*\))|[^\s,)]+)""", re.S)
_PC_PY = re.compile(r"^`?([a-z_][a-z0-9_]*)\((.*)\)`?$", re.S)
_PC_SH = re.compile(r"^`?([a-z_][a-z0-9_]*)(?:\s+([a-z_][a-z0-9_]*))?\s+([a-z_][a-z0-9_]*=.*?)`?$", re.S)


def _pc_value(v: str):
    v = v.strip()
    if len(v) >= 2 and v[0] == v[-1] and v[0] in "\"'":
        return v[1:-1].replace('\\"', '"')
    try:
        import ast
        return ast.literal_eval(v)
    except Exception:  # noqa: BLE001
        return v


def prose_calls(text: str) -> list:
    """A CALL WRITTEN AS WORDS, MADE (2026-10-20): the last lines of her reply that are only a call — `forge op=status`,
    `work add title="x"`, `tool name=mind args={…}`, show_approval(action="…") — name a tool she holds and parse as its arguments.
    The words stand as hers; the call is made, through the same checks and tiers as any call (an act still files its card).
    A call inside a sentence is never taken: the whole line must be the call."""
    out = []
    lines = [ln.strip() for ln in (text or "").strip().splitlines() if ln.strip()][-4:]
    for raw_ln in lines:
        ln = re.sub(r"^\s*(\d+[\.\)]|\*|-)\s*", "", raw_ln).strip()
        m, name, verb, args = _PC_PY.match(ln), None, None, None
        if m:
            name, args = m.group(1), m.group(2)
        else:
            m = _PC_SH.match(ln)
            if m:
                name, verb, args = m.group(1), m.group(2), m.group(3)
        if not name or name not in TOOLS or args is None or "=" not in args:
            continue
        kv = {k: _pc_value(v) for k, v in _PC_KV.findall(args)}
        if not kv:
            continue
        if verb and "op" in TOOLS[name]._tool["props"] and "op" not in kv:
            kv = {"op": verb, **kv}
        out.append({"function": {"name": name, "arguments": kv}})
    return out


def _fold_journal(model: str):
    """Turns that fell out of the window become a few journal lines, written by the model — the Qwen-Agent way: what is
    not in the prompt is kept as text to retrieve, not thrown away. Never raises; a failed fold tries again next turn."""
    if _STOP.is_set():                     # the owner pressed stop: a fold must never raise out of a stopped turn
        return
    old = memory.needs_journal()
    if len(old) < 4:
        return
    try:
        transcript = "\n".join(f"{t.get('who') or t['role']}: {t['content'][:500]}" for t in old[-24:])
        res = _ollama([{"role": "system", "content": "You keep a journal for yourself. From this older part of a conversation write at most three one-line notes worth remembering next week: decisions, his preferences, facts about the machine, unfinished business. Plain lines, no bullets, no preamble. Skip small talk."},
                       {"role": "user", "content": transcript}], [], model, "ops", lane="background")
        text = ((res.get("message") or {}).get("content") or "").strip()
        for line in [l.strip(" -•") for l in text.splitlines() if l.strip(" -•")][:3]:
            memory.journal_add(line)
        memory.mark_journaled(old[-1].get("t", 0))
    except (Exception, Stopped) as e:      # Stopped is a BaseException; a background fold swallows its own stop
        audit("lacuna", "journal.fold-failed", error=e.__class__.__name__)


GREETING = re.compile(r"^\s*(hi|hey|hello|yo|morning|evening|good (morning|evening|night)|thanks|thank you|ok|okay|cool|nice)\b[\s!.,]*\w{0,12}[\s!.?]*$", re.I)
TOOL_CHARS = 5000
TURN_TOKENS = 11000
def cx(kind: str, key: str, props: dict, about: list | None = None) -> None:
    """Write to the cortex without making a turn wait: a background thread, never an error (2026-10-19: the cortex was read
    on every turn and written to almost never — interrupts, what a turn did, refusals, cart outcomes and the owner's decisions
    now go in, so the next turn, the brief and `cortex recall` can use them)."""
    def go():
        try:
            from . import lacuna_cortex
            lacuna_cortex.remember(kind, key, {**props, "at": time.strftime("%Y-%m-%d %H:%M")}, about or [])
        except Exception:  # noqa: BLE001
            pass
    threading.Thread(target=go, daemon=True, name="cortex-write").start()


_LAST_TRACE: list = [[]]
_INTERRUPT = {"t": 0.0, "text": ""}
_TOLD: set = set()


_UI: dict = {}


def _ui_map() -> dict:
    """{screen id: {"name", "rooms"}} read from the app's own registry, so a link is checked against what the desk really has."""
    if _UI:
        return _UI
    try:
        src = (Path(__file__).resolve().parents[3] / "lacuna-home" / "src" / "apps" / "registry.jsx").read_text()
        for aid, name in re.findall(r"\{ id: '(s-[a-z0-9-]+)', name: '([^']+)'", src):
            i = src.index(f"id: '{aid}'")
            j = src.find("\n  { id: 's-", i + 5)
            _UI[aid] = {"name": name, "rooms": re.findall(r"room\('([a-z0-9:-]+)'", src[i:j if j > 0 else i + 1500])}
    except (OSError, ValueError):
        pass
    return _UI


_LINK = re.compile(r"\[([^\]]+)\]\(app:([a-zA-Z0-9_-]+)(?:/([a-zA-Z0-9:_-]+))?\)")


def fix_links(text: str) -> str:
    """Her links to the app are checked against the real screens (2026-10-19: she wrote `app:work/list`, a screen that is not there, and the
    button would have done nothing — "teach it to use the UI, it was confused"). A near name is mended (`work` → `s-work`); a room that
    is not the screen's becomes the screen's best match (`finished` when the label says finished) or none; an unknown screen keeps its label
    as plain words."""
    ui = _ui_map()
    if not ui or "](app:" not in (text or ""):
        return text

    def one(m):
        label, app, room = m.group(1), m.group(2).lower(), (m.group(3) or "").lower()
        if app not in ui:
            by_name = {v["name"].lower(): k for k, v in ui.items()}
            app = "s-" + app if "s-" + app in ui else by_name.get(app.replace("-", " "), "")
        if not app:
            return label
        rooms = ui[app]["rooms"]
        if room not in rooms:
            hit = next((r for r in rooms if r in label.lower() or label.lower().startswith(r)), "")
            room = hit or ("finished" if app == "s-work" and "finish" in label.lower() else "")
        return f"[{label}](app:{app}" + (f"/{room}" if room else "") + ")"
    return _LINK.sub(one, text)


class Stopped(BaseException):
    """The owner pressed stop. BaseException so no `except Exception` in a turn can swallow it."""


_STOP = threading.Event()


def request_stop() -> dict:
    """STOP (the owner, 2026-10-19: "I could escape and Claude will stop. Why can't I stop Lacuna? Anywhere."): the model
    stream is closed (the gateway hangs up on the brain), a running shell command is killed, and the turn ends at once
    with where it was. A turn that is only waiting its turn is cancelled too."""
    running = _TURN.locked()
    _STOP.set()
    return {"ok": True, "said": "stopping" if running else "nothing was running"}


MAX_OUT = _cv.ContextVar("max_out", default=0)
# NO TURN WITHOUT AN END (2026-10-20): with no num_predict the gateway sent no max_tokens, so one runaway monologue held the
# person's slot until the context filled — at 12 tok/s that is over an hour, with the owner's next message queued behind it.
# A reply the cap cuts is continued by the loop (`cut` below), so the cap costs nothing but the runaway.
DEFAULT_OUT = 4096                 # thinking counts against it: a 512–1500-token thought must leave room for the call and the words
CONTINUE_OUT = 8192
THOUGHT_PREFILL = "<|channel>thought\n"
_PROFILE = {"t": 0.0, "d": {}}


def brain_profile() -> dict:
    """THE BRAIN'S OWN SETTINGS (2026-10-20: "optimized for its abilities"): switch-brain.sh writes ~/.lacuna/brain-profile.json from
    lacuna-box/brain/brain-profiles.json — a dense 12B thinks shorter and takes more steps than an MoE. Read when the file changes."""
    p = LACUNA_HOME / "brain-profile.json"
    try:
        m = p.stat().st_mtime
        if m != _PROFILE["t"]:
            _PROFILE.update(t=m, d=json.loads(p.read_text()).get("chat") or {})
    except (OSError, ValueError):
        pass
    return _PROFILE["d"]


def _bp(key: str, default):
    v = brain_profile().get(key)
    return type(default)(v) if v is not None else default
PRESENCE_PENALTY = 0.2              # a light push off repeating itself (the "I'll finish the command" loops); tool-call JSON stays exact (3/3)
SYSTEMISH = re.compile(r"\b(alarms?|alerts?|errors?|carts?|release|promote|qa|dev|disk|logs?|workers?|jobs?|tasks?|plans?|brain|tests?|battery|"
                       r"build|ipad|fix|check|status|queue|forge|train\w*|cortex|remember|notice|cards?|merge|branch|ship|run|restart)\b", re.I)


_CARRY_ON = re.compile(r"^\W*(continue|go on|go ahead|carry on|keep going|proceed|resume|retry|try again|again|next|finish( it)?|do it|"
                       r"yes|yep|yeah|y|sure|please do|ok(ay)? (do|go)( it| on| ahead)?)\W*$", re.I)


def is_quick(text: str) -> bool:
    """Small talk: a greeting, thanks, a short line with nothing about the machine in it. It rides with no extra context, no
    thinking and a short cap — a person answers "hi" at once (the owner, 2026-10-19). Anything about the machine is not quick."""
    t = (text or "").strip()
    # A CONTINUATION IS NEVER SMALL TALK (2026-10-20: 64 stacked "continue"s — one word, no machine word in it, so it rode the quick
    # tier: no context, no thinking, a 200-token cap that cut every reply mid-command, so no tool call ever completed). A short
    # line within 45 minutes of a turn that ran tools is the next step of that work too.
    if _CARRY_ON.match(t):
        return False
    if not re.match(r"^\s*(hi|hey|hello|yo|morning|evening|good (morning|evening|night)|thanks|thank you)\b", t, re.I) \
            and memory.minutes_since_work() < 45:
        return False
    return bool(GREETING.match(t)) or (len(t.split()) <= 8 and not SYSTEMISH.search(t))


_TURN = threading.Lock()
_CURRENT = {"text": ""}


ACTIVE_TURNS = 0          # a person's turns in flight — the foreman's workers wait for them (foreman.py, the ration)


_ABOUT_WORK = re.compile(r"\b(work|working|doing|busy|progress|how (long|far)|eta|done yet|status|train(ing)?|pairs|forge|pantheon|exam|job|jobs|task)\b", re.I)


# THE BRAIN'S LIVE WORDS (the owner, 2026-10-20: "the brain thinking should appear in the chat like the others do and have the countdown with
# thinking and i can open it and see its thoughts, stop it, and reread"). The person's turn in flight, as it is made: what he asked, when it
# began, its thought so far, its words so far, the tools it ran; the turn's end line and its answer's tokens read it. The desk's record
# of a turn (GET /api/chat/now) is the door's since 2026-11-06 (lacuna-node/frontend/desk-turn.mjs).
_NOW: dict = {"on": False}


def _now_begin(text: str) -> None:
    _NOW.clear(); _NOW.update(on=True, text=str(text or "")[:400], started=time.time(), thinking="", said="", steps=[], rounds=0,
                              seq=[], out_tokens=0, in_tokens=0)


def _seq_add(kind: str, text: str = "", **more) -> None:
    """THE TURN IN ORDER (the owner, 2026-10-20: "if it needs to think again just add another thinking block in sequence and keep them there.
    responses is the break"): thinking · tools · words, each run its own block, as they happened — the page redraws it after a refresh."""
    q = _NOW.setdefault("seq", [])
    if kind in ("thinking", "text") and q and q[-1]["kind"] == kind and not more:
        q[-1]["text"] = (q[-1]["text"] + text)[-12000:]
    else:
        q.append({"kind": kind, "text": text[-12000:], "t": time.time(), **more})
        del q[:-400]            # 2026-10-21: a channel that flips per token made 80 blocks and the FRONT (the first tools) fell off


def _now_event(ev: dict) -> None:
    if not _NOW.get("on") or not isinstance(ev, dict):
        return
    t = ev.get("type")
    if t == "thinking":
        if _NOW.get("_last") != "thinking":
            _NOW["rounds"] = _NOW.get("rounds", 0) + 1
            if _NOW["thinking"]:
                _NOW["thinking"] += "\n\n"
        _NOW["thinking"] = (_NOW["thinking"] + str(ev.get("text") or ""))[-20000:]
        _seq_add("thinking", str(ev.get("text") or ""))
    elif t == "token":
        _NOW["said"] = (_NOW["said"] + str(ev.get("text") or ""))[-8000:]
        _seq_add("text", str(ev.get("text") or ""))
    elif t == "usage":
        _NOW["out_tokens"] = _NOW.get("out_tokens", 0) + int(ev.get("out") or 0)
        _NOW["in_tokens"] = _NOW.get("in_tokens", 0) + int(ev.get("in") or 0)
    _NOW["_last"] = t


def _now_step(st: dict) -> None:
    if _NOW.get("on") and isinstance(st, dict):
        _NOW["steps"] = (_NOW.get("steps") or [])[-11:] + [{"tool": st.get("tool"), "args": str(st.get("args") or "")[:120],
                                                             "ok": st.get("ok"), "at": time.time()}]
        tr = _LAST_TRACE[0] or []
        res = tr[-1] if tr and tr[-1].get("tool") == st.get("tool") else {}
        _seq_add("tool", "", tool=st.get("tool"), args=st.get("args") if isinstance(st.get("args"), dict) else str(st.get("args") or "")[:300],
                 ok=st.get("ok"), result=(res.get("shown") or _result_text(res.get("result"), 600)) if res else "")
        _NOW["_last"] = "step"


def _now_end() -> None:
    _NOW.clear(); _NOW["on"] = False


def ask(text: str, who: str = "alfred", session: str = "console", model: str | None = None, max_steps: int = 8, dry: bool = False,
        job: str = "ops", on_step=None, on_event=None, context: str | None = None, card: str | None = None,
        thinking_level: str | None = None) -> dict:
    global ACTIVE_TURNS
    person = not str(who).startswith("foreman:")
    if person and not dry:
        # ONE TURN AT A TIME (the owner, 2026-10-19: "it's not talking to two chat windows at once. our machine is too
        # slow"): a second message waits for the first; the page hears at once what it waits on, in its own words
        if not _TURN.acquire(blocking=False):
            import random as _r
            what = _CURRENT["text"][:50].strip() or "what I was on"
            # SAY WHAT IT REALLY IS (the owner, 2026-10-20: "thanks for the 'hey, I'm busy' … make sure that's accurate"): only his own
            # turns hold the lock since order §1.13a (no system turn exists), so it is his earlier message, and how long it has run
            ran = int(time.time() - (_CURRENT.get("t") or time.time()))
            secs = f" ({ran} s in)" if ran >= 3 else ""
            (on_event or (lambda ev: None))({"type": "aside", "text": _r.choice([
              f"One sec, I'm finishing your \"{what}\"{secs} and I'll be right with you.",
              f"Hang on, still on \"{what}\"{secs} — back to you in a moment.",
              f"Give me a second, wrapping up \"{what}\"{secs}. Then you.",
              f"Almost done with \"{what}\"{secs}; I'll pick this up right after."])})
            _TURN.acquire()
        _CURRENT.update(text=str(text or ""), t=time.time())
        _STOP.clear()                     # a stop pressed before this turn began (or while it waited) was for the one before
        _now_begin(text)
        try:
            from . import owner_first
            if owner_first.pause():                    # a training on the GPU waits while he is answered (owner_first.py)
                (on_event or (lambda ev: None))({"type": "note", "label": "forge paused", "text": "The training waits while I answer you; it resumes when I finish."})
        except Exception:  # noqa: BLE001
            pass
        _ev, _st = on_event, on_step
        if _ev is not None:
            on_event = lambda ev: (_now_event(ev), _ev(ev))[1]           # noqa: E731
        if _st is not None:
            on_step = lambda st: (_now_step(st), _st(st))[1]             # noqa: E731
    if person:
        ACTIVE_TURNS += 1
    try:
        r = _ask(text, who, session, model, max_steps, dry, job, on_step, on_event, context, card, thinking_level=thinking_level)
        if isinstance(r, dict) and isinstance(r.get("answer"), str):          # no signature on her words (the owner, 2026-10-19)
            r["answer"] = fix_links(re.sub(r"\s*\n\s*-{1,2}\s*Lacuna\s*$", "", r["answer"]).rstrip())
        if person and not dry and isinstance(r, dict):
            _NOW["said"] = r.get("answer") or _NOW.get("said", "")
            _NOW.update(seen=r.get("seen"), ms=r.get("ms"), mode=r.get("mode"))
            r["tokens"] = {"out": _NOW.get("out_tokens", 0), "in": _NOW.get("in_tokens", 0), "rounds": _NOW.get("rounds", 0),
                           "tools": len(_NOW.get("steps") or [])}
            _now_end()
        return r
    except Stopped:
        _STOP.clear()
        from . import memory as _m
        tr = list(_LAST_TRACE[0] or [])
        did = {}
        for t in tr:
            did[t.get("tool")] = did.get(t.get("tool"), 0) + 1
        last = tr[-1] if tr else None
        ran = f"{', '.join(f'{k} ×{v}' for k, v in did.items())}; the last was {last.get('tool')} {str(last.get('args'))[:80]}" if last else ""
        where = f" I had run {ran}." if last else " I had not run anything yet."
        # THE STOP IS THE ROOM'S LINE, NEVER THE MIND'S (the finale §10 row 4; A1 §2b rows 3, 31, 37: "Done, I've stopped." kept
        # with who lacuna): one plain line from the trace, kept with its own who
        answer = f"Stopped at Alfred's word; {f'the turn had run {ran}' if last else 'no step had run'}. Say go on to pick it up."
        if not dry:
            _m.remember("user", f"[{who}] {text}", who, session); _m.remember("assistant", answer, "system:stop", session, steps=_steps(tr, []))
            # THE INTERRUPT IS REMEMBERED (2026-10-19: "let it get interrupted and finish up with good context"): what was in flight and
            # how far it got, so the next turn — his new message — and a later "carry on" both have it
            _INTERRUPT.update(t=time.time(), text=f"you were interrupted on \"{str(text)[:140]}\".{where}")
            cx("fact", "interrupted-latest", {"text": f"The owner interrupted my turn on \"{str(text)[:140]}\".{where} Resume it only if he asks."}, ["thing/interrupts"])
        if person and not dry:
            _now_end()
        audit(who, "chat.stopped", text=str(text)[:200])
        return {"ok": True, "answer": answer, "trace": [], "model": model, "ms": 0, "mode": "stopped", "stopped": True}
    finally:
        if person:
            ACTIVE_TURNS -= 1
        if person and not dry:
            _now_end()
            try:
                from . import owner_first
                owner_first.resume()
            except Exception:  # noqa: BLE001
                pass
            _TURN.release()


# STARTING A RELEASE IS CODE, NOT A CHOICE (2026-10-19: asked "do a dry run of the release", the model called no tool
# and wrote a whole run from memory — paths that do not exist, a green battery that was 21 red). The words that start a
# release file the release cart's card here, and the answer is the card's own facts.
START_RELEASE = re.compile(r"^(?!.*\?)(?:please\s+|lacuna,?\s+)?(?:do|run|start|kick off|begin|go)\b.{0,30}\brelease\b|^\s*(?:dry[- ]run\s+)?release(?:\s+it|\s+now)?[.!]?\s*$", re.I | re.S)


def _start_release(text: str, who: str, session: str) -> dict:
    from . import carts, memory
    t0 = time.time()
    dry = bool(re.search(r"\bdry\b|rehears", text, re.I))
    r = carts.start_named("release", who, dry, text[:200])
    if r.get("petition"):
        answer = (f"Filed the card to start the release cart{' as a DRY run (every step answers what it would do; nothing is touched)' if dry else ''}: "
                  f"card {r['petition']}, waiting for your press. Once pressed it reads the tree, asks me about the files no rule "
                  f"decides, runs the narrow tests" + ("" if dry else ", then waits for your press again at the check-in, the promote and the install")
                  + ". The Release card shows the run live.")
    else:
        answer = f"The release cart did not start: {r.get('why') or r.get('fix_first')}."
    memory.remember("user", f"[{who}] {text}", who, session); memory.remember("assistant", answer, "lacuna", session)
    audit(who, "chat.release-start", dry=dry, petition=r.get("petition"))
    return {"ok": True, "answer": answer + "\n\n-- Lacuna", "trace": [{"tool": "start_release", "args": {"dry": dry}, "result": r}],
            "model": "code", "ms": int((time.time() - t0) * 1000), "mode": "code"}


# "ready for Claude's first task?", "start T3", "do the next task" — a coded path, like the release: the task STARTS (the
# owner, 2026-10-19: Lacuna answered "I'm ready." and started nothing)
START_TASK = re.compile(r"\b(start|begin|run|do|go|kick off)\b.{0,25}\b(t\d{1,2}|(first|next) task|task \d{1,2})\b|"
                        r"\bready\b.{0,30}\b(first|next) task\b", re.I | re.S)


def _start_task(text: str, who: str, session: str) -> dict:
    from . import claude_tasks, memory
    t0 = time.time()
    m = re.search(r"\bt(\d{1,2})\b|\btask (\d{1,2})\b", text, re.I)
    ts = claude_tasks.tasks()["tasks"]
    t = next((x for x in ts if x["id"] == f"T{(m.group(1) or m.group(2))}"), None) if m else \
        next((x for x in ts if x["state"] == "queued"), None)
    if not t:
        answer = "There is no queued task left from Claude." if not m else f"There is no task {m.group(0)} in Claude's list."
        r = {}
    else:
        r = claude_tasks.start(t["id"], who)
        how = f"the cart {t['how']['cart']}" if t["how"].get("cart") else f"a worker on exam {t['how'].get('exam')}"
        auto = "answered by your work order — it runs now" if "work order" in str(r.get("state") or "") else \
            (f"waiting for your press on card {r['petition']}" if r.get("petition") else f"not started: {r.get('why')}")
        answer = (f"Started {t['id']}: {t['title']} — {how}; {auto}. Watch it on the Agents screen (its bubble, and my card's "
                  f"tasks tab). When it ends you get a notice: green if it finished.")
    memory.remember("user", f"[{who}] {text}", who, session); memory.remember("assistant", answer, "lacuna", session)
    return {"ok": True, "answer": answer + "\n\n-- Lacuna", "trace": [{"tool": "start_claude_task", "result": r}],
            "model": "code", "ms": int((time.time() - t0) * 1000), "mode": "code"}


# "kill that task that's waiting", "stop bench-e2b", "put the benchmark to sleep" — a coded path: the act is TAKEN, then said
# (2026-10-19: Lacuna answered "Stopped bench-e2b" and stopped nothing)
STOP_WORK = re.compile(r"\b(kill|stop|sleep|end|cancel|shut down|turn off)\b.{0,40}\b(task|errand|job|bench[\w-]*|that one|it)\b", re.I | re.S)


def _stop_work(text: str, who: str, session: str) -> dict | None:
    from . import memory, swarm, work
    t0 = time.time()
    items = [x for x in work.work()["items"] if str(x["id"]).startswith("errand:")]
    named = next((x for x in items if str(x["id"]).split(":", 1)[1].lower() in text.lower()), None)
    waiting = [x for x in items if x.get("waiting")] if re.search(r"\bwait", text, re.I) else []
    target = named or (waiting[0] if len(waiting) == 1 else None)
    if not target and (waiting or items):             # "that one": the errand the talk was just about, the newest mention
        said = " ".join(str(m.get("content") or "") for m in memory.recent()[-4:]).lower()
        pool = waiting or items
        hits = [x for x in pool if str(x["id"]).split(":", 1)[1].lower() in said]
        target = max(hits, key=lambda x: said.rfind(str(x["id"]).split(":", 1)[1].lower())) if hits else None
    if not target:
        return None                                   # not sure which: the brain asks back, with its tools
    r = swarm.stop(target["id"], f"lacuna-for-{who}")
    answer = (f"Put {target['id'].split(':', 1)[1]} to sleep: {r.get('said') or r.get('why')}" if r.get("ok")
              else f"Could not stop {target['id']}: {r.get('why') or r.get('said')}")
    memory.remember("user", f"[{who}] {text}", who, session); memory.remember("assistant", answer, "lacuna", session)
    return {"ok": True, "answer": answer + "\n\n-- Lacuna", "trace": [{"tool": "sleep_errand", "result": r}],
            "model": "code", "ms": int((time.time() - t0) * 1000), "mode": "code"}


_CLAIMED_ACT = re.compile(r"\b(stopped|killed|started|restarted|put .{0,30} to sleep|unloaded|cancel(l)?ed|filed (the )?card)\b", re.I)


_INTENT = re.compile(r"\b(i'?ll (now |then |first |just )?(start|begin|look|check|open|read|run|try|fix|repair|file|show|pull|find|go|take|write|make|build|do|use|send|ask|call|dig|see|test)|"
                     r"i will (now |then |first )?\w+|i'?m going to \w+|i am going to \w+|let me (start|begin|look|check|open|read|run|try|fix|repair|file|show|pull|find|take|write|make|build|do|use|see|test)|"
                     r"(next|now|first),? i'?ll|here'?s what i'?ll do|"
                     # "I'm preparing the factory check" (2026-10-20, the 12B's live test): a present-tense promise is a stall too
                     r"i'?m (now |just |currently )?(preparing|setting up|getting|starting|checking|looking|running|pulling|reading|working on|going through|loading|building|writing))\b", re.I)
_PLAN = re.compile(r"(?m)(^\s*(\d+[\.\)]|\*|-)\s+(first|now|next|check|inspect|list|look|open|read|run|try|fix|repair|stop|pause|resume|start|kill|cancel|file|build|deploy|call|step)\b|"
                   r"^\s*(here'?s (the |my )?plan|the plan is|my plan:?|steps to (fix|resolve|take):?)\b|"
                   r"\b(i'?ll (start|begin|take the following steps)|here is how i'?ll (fix|proceed|handle))\b)", re.I)
_ASKED_FOR_PLAN = re.compile(r"\b(what (is|are) (the |your )?(plan|steps)|show (me )?(the |your )?plan|explain the plan|tell me the plan)\b", re.I)
_PROMISE = re.compile(r"\b(I'?ll (call|check|look|run|read)|I (haven't|have not) (looked|checked)|without looking (it )?up|"
                      r"Should I (check|look|run)|I can'?t say (for sure )?without|I don'?t have a (direct )?(way|record))", re.I)

ACTING = {"petition", "check_in", "start_release", "control_service", "run_battery", "run_tests", "build_version", "deploy_simulator",
          "spawn_worker", "forge", "tell_worker", "stop_worker", "interrupt_bot"}


SECTION = re.compile(r"\n\n<(now|desk|graph|records|question|work|journal)\b")


def introspect(turn: str, tools: list) -> dict:
    """D23: what this turn was handed — each context section and its size, the lane, the tools, and the brain's own cache
    numbers for the lane (how much it read fresh, how long before the first word)."""
    cuts = [(m.start(), m.group(1)) for m in SECTION.finditer(turn or "")]
    short = {"now": "now", "desk": "the desk", "graph": "the graph", "records": "records", "question": "asked again", "work": "work", "journal": "journal"}
    sections = [{"name": "asked", "chars": cuts[0][0] if cuts else len(turn or "")}]
    for i, (at, name) in enumerate(cuts):
        end = cuts[i + 1][0] if i + 1 < len(cuts) else len(turn)
        sections.append({"name": short.get(name, name.lower()), "chars": end - at})
    lane = PREFIX.get()
    cache = {}
    try:
        with open(os.path.expanduser("~/.lacuna/brain-cache.jsonl"), "rb") as f:
            f.seek(max(0, f.seek(0, 2) - 6000))
            for ln in f.read().decode(errors="replace").splitlines()[::-1]:
                if f'"lane": "{lane}"' in ln:
                    cache = {k: v for k, v in json.loads(ln).items() if k in ("prompt_n", "cache_n", "prompt_ms", "restored")}
                    break
    except (OSError, ValueError):
        pass
    return {"sections": sections, "lane": lane, "tools": [t["function"]["name"] for t in tools or []], "cache": cache}


def _keep_why(text: str, trace: list, thought: list, who: str) -> None:
    """G13: a turn that ACTED leaves a decision in the cortex — what it did and the brain's own reasoning as the why — so
    'why did you file that?' is a read a week later, not a memory."""
    did = [t for t in trace or [] if t.get("tool") in ACTING]
    if not did:
        return
    try:
        from . import lacuna_cortex
        why = " ".join("".join(thought).split())[:600] or "no thinking was captured on this turn"
        lacuna_cortex.remember("decision", f"turn-{time.strftime('%Y%m%d-%H%M%S')}",
                               {"text": f"{', '.join(t['tool'] for t in did)} — asked: {str(text)[:200]}"[:400], "why": why,
                                "by": "the 26B (chat)", "asked_by": str(who), "at": time.strftime("%Y-%m-%dT%H:%M:%S")},
                               about=None)
    except Exception:  # noqa: BLE001 — the turn stands without its record
        pass


def _remember_commit(answer: str) -> None:
    """A turn that ends on an intent is a promise; a turn that claims it did it closes one. Both are a write, never a hope."""
    try:
        from . import commitments
        if _CLAIMED_ACT.search(answer or ""):
            commitments.resolve(answer)
        if _INTENT.search(answer or "") or _PLAN.search(answer or ""):
            commitments.record(answer)
    except Exception:  # noqa: BLE001 — commitments never break a turn
        pass


def _ask(text: str, who: str, session: str, model: str | None, max_steps: int, dry: bool,
         job: str, on_step, on_event, context: str | None = None, card: str | None = None,
         thinking_level: str | None = None) -> dict:
    """One turn: the model may call tools (up to `max_steps` rounds) and then answers. Returns the answer and the trace."""
    if not dry and not str(who).startswith("foreman:") and START_RELEASE.search((text or "").strip()):
        return _start_release(text.strip(), who, session)
    if not dry and not str(who).startswith("foreman:") and START_TASK.search((text or "").strip()):
        return _start_task(text.strip(), who, session)
    if not dry and not str(who).startswith("foreman:") and STOP_WORK.search((text or "").strip()):
        done = _stop_work(text.strip(), who, session)
        if done:
            return done
    if model == "cloud-lacuna":                       # A2: the owner picked Cloud Lacuna in Lacuna's chat (cloud_kinds.chat)
        from . import cloud_kinds, memory as _m
        t0 = time.time()
        r = cloud_kinds.chat(text, _m.recent()[-10:] if not dry else [], on_step=on_step, on_event=on_event, who=who, thinking_level=thinking_level)
        answer = (r.get("text") or r.get("answer") or "").strip() if r.get("ok") else f"Cloud Lacuna did not answer: {r.get('why')}. Lacuna (here) can."
        if not dry:
            _m.remember("user", f"[{who}] {text}", who, session); _m.remember("assistant", answer, "cloud-lacuna", session)
        return {
            "ok": True,
            "answer": answer,
            "trace": r.get("trace", []),
            "thinking": r.get("thinking", ""),
            "tokens": r.get("usage", {}),
            "model": "cloud-lacuna",
            "ms": int((time.time() - t0) * 1000),
            "mode": "cloud",
        }
    if model == "cloud-gemma":                        # THE OWNER'S FREE WORK (2026-10-19): sent straight to Cloud Gemma, 15,000 a day, no turn of Lacuna's spent
        from . import cloud, memory as _m
        t0 = time.time()
        r = cloud.ask_stream("review", "You are Cloud Gemma, a free bulk worker for the owner of a shop app and his agent Lacuna. Do the task asked, completely, "
                             "in the format asked, no preamble. Never invent real people, addresses or order ids.", str(text or ""), lambda ev: None,
                             models=cloud.FARM_MODELS, max_out=8000)
        answer = (r.get("text") or "").strip() if r.get("ok") else f"Cloud Gemma did not take it: {r.get('why')}"
        if not dry:
            _m.remember("user", f"[{who} → Cloud Gemma] {text}", who, session); _m.remember("assistant", answer, "cloud-gemma", session)
        return {"ok": True, "answer": answer, "trace": [], "model": "cloud-gemma", "ms": int((time.time() - t0) * 1000), "mode": "cloud"}
    asked_model = model
    if model is None:                        # THE DESK'S MODEL COMES FROM THE BROKER (2026-10-22) once the owner has chosen
        try:                                 # (desk.json); until then the seat's MODEL is the default. 26B/12B share the alias.
            from . import broker
            model = broker.desk_model() if broker.DESK.exists() else MODEL
        except Exception:  # noqa: BLE001
            model = MODEL
    if _DESTRUCTIVE.search(text or ""):
        # deterministic before the model: an 8B model asked to rm -rf answered "Confirmed: deletion…" (the bench)
        audit(who, "chat.destructive-refused", text=text[:200])
        return {"ok": True, "answer": "No tool here deletes files or runs shell commands, so that cannot be done from Lacuna. "
                "If it must happen, do it yourself in the Terminal tab.\n\n-- Lacuna", "trace": [], "model": "none (rule)"}
    # ★ ONE CONVERSATION (2026-09-26): the phone, the dock and the CLI are the same Lacuna talking to the same person;
    # the turns live on disk (memory.py) and come back after a restart; the journal's newest notes ride along.
    who_line = "the owner (the operator)" if who == "alfred" else "Claude, on the owner's behalf" if who == "claude" else who
    # the turn carries the day (2026-09-26: "the Yankees this year" was answered about 2023 — the model has no clock,
    # and the head cannot carry one without breaking Ollama's prompt reuse)
    who_line += time.strftime(" · %a %d %b %Y %H:%M")
    notes = memory.journal_tail()
    # the head is ONLY the system prompt (E1): the journal changes whenever it folds, and in the head it broke the brain's
    # cached prefix — it rides at the tail of the turn now, with the other per-turn context
    head = system_prompt()
    # ★ HIS WORDS COME FIRST, AND THE MACHINE ONLY WHEN IT IS WRONG (2026-09-26, his: "every time I talk to it, it
    # responds with the status"). The snapshot used to open every turn — "services: … disk: …" and then his "hey" —
    # so the model answered the status it was handed. Now a greeting is a greeting; the machine is a tool call away;
    # and only a DOWN service or a low disk rides along, after his words, marked as information, not a question.
    note = machine_note()
    if not dry and not who.startswith("foreman:"):   # the owner's talks/pauses/stops of his bots since the last turn
        from . import agent_talk
        note = "; ".join(x for x in (note, agent_talk.take_note()) if x)
    if _INTERRUPT["text"] and time.time() - _INTERRUPT["t"] < 1800 and not dry:
        # THE NEXT MESSAGE AFTER AN INTERRUPT carries what was in flight (his new words may change the plan, or say "carry on")
        note = "; ".join(x for x in (note, f"INTERRUPTED JUST BEFORE THIS: {_INTERRUPT['text']} If his message is about something else, do that; if he says carry on, resume it.") if x)
        _INTERRUPT["text"] = ""
    quick = is_quick(text) and not context and not dry and "INTERRUPTED" not in note
    if quick:
        note = ""                                         # small talk carries nothing but itself
    turn = f"[{who_line}] {text}" + (f"\n\n(for your information, not a question: {note})" if note else "")
    # NO KEYWORD HOT-LOADING (the owner, 2026-10-19: "i think hotloading particular keywords messes up its running
    # context. check can't mean that. it should ask"): "check" pulled in what runs, and the answer was about workers.
    # What runs, the queue and the cards are one tool call away (work, health_check, tool name=list_workers).
    # WHERE HE IS, NOT WHAT IS ON IT (the owner, 2026-10-19: "maybe no context until i ask it about the screen. it only
    # needs its location and the ability to look up stuff about this card in the cortex"): the desk's words go to the
    # cortex as the card's `screen` fact, at the ready; the turn carries one line naming where he is and how to read it
    if context or card:
        where = card or "chat"
        if context:
            try:
                from . import lacuna_cortex
                lacuna_cortex.remember("fact", f"screen-{where}", {"text": str(context)[:4000], "at": time.strftime("%Y-%m-%d %H:%M")},
                                       [f"card/{where}"])
            except Exception:  # noqa: BLE001
                pass
        turn += (f"\n\n(He is on the {where} card. What it shows is in your cortex — `cortex op=show query=fact/screen-{where}` "
                 "— read it only when he asks about the screen or says this/that about it.)")
    # WHAT IT KNOWS, BY MEANING (rag.py — the cortex's index of every manual, doc, skill, journal note and turn): a real
    # question carries its nearest records, at the tail; a greeting and a card's lean turn carry none (they stay fast)
    # WHO I AM AND WHAT I'M DOING (story.py, 2026-10-19: "as sharp as a tack in remembering and becoming") — every turn
    if not dry and not quick:
        try:
            from . import story
            # the whole story (journal, what you did, what runs) is in the cortex and the journal, fetched when needed;
            # the turn carries only his last asks, so "it" and "that" resolve (2026-10-19: 3.7k characters of forge
            # lines rode with "hi")
            asks = story._asked(4)
            if asks:
                turn = "<asked note=\"his last asks, oldest first — 'it' usually means the newest\">\n" + "\n".join(f"- {x}" for x in asks) + "\n</asked>\n\n" + turn
        except Exception:  # noqa: BLE001
            pass
    # THE BRIEF (brief.py, 2026-10-19: "she doesn't know how to do anything"): the playbook or skill WHOLE, the things the
    # question names read from their source (a cart's files, verdicts, past attempts), the cortex's lessons and
    # WORK, BREAK, CHAT (ruling 4): the turn's mode from its words, kept on the one conversation; its line rides first in the
    # turn (never in the head: the cache stays warm across a switch)
    if not dry:
        try:
            from . import brief as _bm
            _WORK_MODE["last"] = _bm.work_mode_of(text, _WORK_MODE["last"])
            turn += "\n\n" + _bm.MODE_LINES[_WORK_MODE["last"]]
        except Exception:  # noqa: BLE001 — a mode not read leaves the turn as it was
            pass
    # decisions, then the remaining records — one builder in place of ten 900-character fragments and a separate recall
    # A GREETING CARRIES NO BRIEF (2026-10-20, measured: "hi" after a forge question rode that question's whole playbook — the
    # short-follow-up rule below joined them — and read 4.7k fresh tokens, 25 s, to say hello)
    if not dry and not is_personal(text) and not _GREETING.match(text or ""):
        try:
            from . import brief
            # A SHORT FOLLOW-UP CARRIES ITS THREAD ("fix it", "check", "again"): the brief is built on his previous ask and
            # this one together, so "it" finds the cart he named a minute ago
            q = text
            if len((text or "").split()) < 6:
                prev = [t["content"] for t in memory.recent() if t["role"] == "user"][-1:]
                if prev:
                    q = re.sub(r"^\[[^\]]*\]\s*", "", prev[0])[:400] + " " + text
            found = brief.build(q, card)
            if found:
                turn += "\n\n" + found
        except Exception:  # noqa: BLE001 — no brief, no ride; the tools still answer
            pass
    # THE TASK NOTE AND WHAT WAS RUN (brief.ledger): exact, small, every turn — not searched for, so a long job holds across cuts
    if not dry and not is_personal(text) and not (quick and not memory.minutes_since_work() < 90):
        try:
            from . import brief as _brief
            led = _brief.ledger()
            if led:
                turn += "\n\n" + led
        except Exception:  # noqa: BLE001
            pass
    # WHAT RUNS NOW (the owner, 2026-10-20: "it also doesn't know daemons are running"): every real turn carries the box's own list of
    # its workers, errands, jobs and watchers — read at this turn, not remembered — so "is X running?" is read, not guessed
    if not dry and not quick and not is_personal(text):
        try:
            from . import agents_live
            w = agents_live.working()
            rows = ([f"working: {x.get('kind')} {x.get('what')}" for x in (w.get("working") or []) if x.get("kind") not in ("chat", "brain")]
                    + [f"watching: {x.get('what')}" for x in (w.get("watching") or [])] + [f"STALLED: {x.get('what')}" for x in (w.get("stalled") or [])])
            turn += ("\n\n<running note=\"what runs on the box now, read at this turn (workers, errands, jobs, watchers)\">\n"
                     + ("\n".join(rows[:12]) if rows else "nothing runs but you") + "\n</running>")
        except Exception:  # noqa: BLE001
            pass
    in_card = card if card and card != "s-chat" else None
    if in_card:
        session = f"card:{in_card}"                       # its own window: this card's talk only (memory.recent)
    # MEMORY — the graph cortex (the Rust store: facts, decisions, episodes, lessons; newest wins, with its trail). Asked
    # for every real question and in a card's lean lane alike (it costs about a third of a second, bounded at 2 s), and
    # labeled as memory: it may be stale, and live data outranks it (the owner, 2026-10-18: "it's your way of having
    # context … you also have data here … that can tell you exactly what's going on")
    if notes:
        turn += f"\n\n<journal note=\"newest notes; `recall` finds older talk\">\n{notes}\n</journal>"
    # G11 THE GRAPH IS THE CONTEXT: a card's turn carries the card's neighbourhood in the cortex — its decisions, episodes
    # and facts, newest first — so "why did it stop?" is read, not remembered
    if in_card and not dry:
        turn += "\n\n" + _card_header(in_card)
        if not is_personal(text) and not _GREETING.match(text or ""):
            try:
                from . import graphctx
                near = graphctx.card_lines(in_card)
                if near:
                    turn += "\n<graph note=\"what points at this card in the cortex, newest first\">\n" + "\n".join(near) + "\n</graph>"
            except Exception:  # noqa: BLE001
                pass
    # G4 (lost in the middle): a turn that grew long with its context ends by asking its question again
    if len(turn) > 1500 and len(text or "") < 600:
        turn += f"\n\n<question>{text}</question>"
    # ONE MIND FOR EVERY CARD (the owner, 2026-10-19: "wiping its mind for the card context doesn't work. just load the
    # card context"): every turn carries the one conversation; the card rides in the turn (<desk>, <graph>), so the head
    # and the history are the same from every card and the brain's cache (gateway seed.py) is never thrown away
    # WHAT IT SAID IT WOULD DO, NOT DONE YET (2026-10-22): the open promises ride at the bottom — state, recency-anchored.
    try:
        from . import commitments
        c = commitments.lines(4)
        if c:
            turn += "\n\n<promised note=\"what you said you would do, not done yet — do it, or say what changed\">\n" + "\n".join("- " + x for x in c) + "\n</promised>"
    except Exception:  # noqa: BLE001
        pass
    messages = [{"role": "system", "content": head}] + memory.recent() + [{"role": "user", "content": turn}]
    trace = []
    _LAST_TRACE[0] = trace                           # a stop reads it: what was in flight
    t0 = time.time()
    audit(who, "chat.ask", text=text[:500], model=model)
    mode = choose_mode(text)
    if card and card != "s-chat" and mode == "deep" and not _DEEP.search(text or "") and card_lane(text, card)[0] == "lean":
        mode = "fast"                                        # inside its card the machine is lean: the fast lane
    if job == "ops" and mode == "deep":
        job = "reason"
    if asked_model is None and MODEL_DEEP and job != "ops":
        model = MODEL_DEEP   # the hand-over: the deep model takes the turn
    emit = on_event or (lambda ev: None)
    try:                                     # A SWAP IS A BLOCK IN THE CHAT (2026-10-22): record the resident changing, so it
        from . import broker as _broker      # can be seen and corrected — never a silent switch
        _prev = _broker.last_model()
        if _prev and _prev != model:
            emit({"type": "note", "label": "swap", "text": f"{_broker.label_of(_prev)} → {_broker.label_of(model)}"})
        _broker.note_model(model)
    except Exception:  # noqa: BLE001
        pass
    emit({"type": "mode", "mode": mode, "model": model})

    thought: list[str] = []
    personal = is_personal(text)
    lane, card_tools = card_lane(text, card) if not personal else ("none", None)
    THINK_BUDGET.set(0 if personal or quick else _bp("think_deep", 1500) if mode == "deep" else _bp("think_fast", 512))   # the brain's profile sets the lengths
    MAX_OUT.set(200 if quick else 0)
    # ONE TOOL SET PER LANE, the same every turn (E1): the brain's template writes the tools into the system turn, so a
    # list that changed per question re-read the head and the whole conversation after it, every turn (measured)
    # EVERY TOOL, EVERY TURN, IN ONE ORDER (2026-10-19): a tool list that changed by card or by greeting moved the head,
    # and the brain re-read 16k tokens (35–47 s for "hi"). One list keeps the head identical, so it is read once.
    tools = head_tool_specs()
    # READING, OPENABLE (the owner, 2026-10-19: "26 seconds … I don't know if it's thinking, if it lost the train of thought, if
    # it's broken"): before the brain starts, the page is told what it is reading — each block of the turn and its size
    try:
        parts = [("instructions", len(head)), ("tools", len(json.dumps(tools))), ("conversation", sum(len(m["content"]) for m in messages[1:-1]))]
        for tag in ("asked", "procedure", "things", "which", "then", "memory", "records", "journal", "graph"):
            m = re.search(rf"<{tag}[^>]*>(.*?)</{tag}>", turn, re.S)
            if m:
                parts.append((tag, len(m.group(1))))
        parts.append(("your message", len(text or "")))
        emit({"type": "reading", "tokens": sum(n for _, n in parts) // 4, "parts": [{"name": k, "chars": n} for k, n in parts]})
    except Exception:  # noqa: BLE001
        pass
    # G1: the lane IS the head the brain reads first — the system turn and the tools — so its warm KV is kept and restored
    # by that head's own hash (a label like "general" hid two different heads in one lane, measured 2026-10-19)
    import hashlib as _hl
    # …and its history window: a card keeps its own window, so a card and the chat diverge right after the head, where the
    # SWA cache has no checkpoint (measured: cache_n 0, 20 s) — each window is its own lane, saved and restored whole
    PREFIX.set("chat-" + _hl.sha1((head + "|" + ",".join(t["function"]["name"] for t in tools)).encode()).hexdigest()[:10]
               + "-" + (in_card or "all"))
    if lane != "none":
        audit(who, "chat.card-lane", card=card, lane=lane)
    if personal:
        audit(who, "chat.personal", text=text[:200])
    reasked = False
    # THE TURN, AS IT HAPPENS (the owner, 2026-10-19: "when an llm is working make sure we can see output not unlike
    # claude"): each model round is a `round` (why it was asked again, when it was), each tool a `call` before it runs
    # and a `result` after (ok, ms, the result in short), so the page draws thinking · text · tool blocks live
    why_round = None
    handed = False
    summed = False
    continued = 0
    claimed_once = False
    cut_retries = 0
    prose_n = 0
    for n_round in range(max_steps):
        # THINK ONCE, THEN ACT (measured in the live feed, 2026-10-19: the 300–830-token outputs were thinking after a tool
        # result — 1–2k characters, 22–79 s — with the plan already chosen): the first round of a turn gets the turn's
        # budget, every later round (reading a result) gets at most 96 tokens
        if n_round == 1:
            THINK_BUDGET.set(min(THINK_BUDGET.get(), _bp("think_after", 256)))      # after a tool result: a short thought on what it showed, then the next call
        if _STOP.is_set():
            raise Stopped()
        if n_round > 0:
            # EVERY ROUND SAYS WHAT IT IS READING (the owner, 2026-10-19: "looks frozen … how could I know?"): after a tool, the brain
            # reads the result before it writes, 5–40 s of silence — the page gets a ticking chip for it, like the first round's
            try:
                last = messages[-1]
                emit({"type": "reading", "round": n_round, "tokens": sum(len(str(m.get("content") or "")) for m in messages) // 4,
                      "parts": [{"name": f"result of {last.get('tool_name') or 'the last step'}" if last.get("role") == "tool" else "your words",
                                 "chars": len(str(last.get("content") or ""))},
                                {"name": "the turn so far (cached)", "chars": sum(len(str(m.get("content") or "")) for m in messages[:-1])}]})
            except Exception:  # noqa: BLE001
                pass
        emit({"type": "round", "n": n_round, "why": why_round})
        why_round = None
        try:
            ACT_NOW.set(_ACT_SAMPLER and n_round > 0)
            res = _ollama_stream(messages, tools, model, job, emit) if on_event else _ollama(messages, tools, model, job)
        except Exception as e:
            return {"ok": False, "answer": _no_brain_words(e), "trace": trace}
        msg = res.get("message") or {}
        if msg.get("thinking"):
            thought.append(msg["thinking"])
        calls = msg.get("tool_calls") or salvage_calls(msg.get("content") or "")
        if not calls and tools and not personal and not quick and prose_n < 2:
            calls = prose_calls(msg.get("content") or "")          # she wrote the call as the last line of her reply: it is made
            if calls:
                prose_n += 1
                audit("lacuna", "chat.prose-call-made", calls=[c["function"]["name"] for c in calls], said=(msg.get("content") or "")[-120:])
        # NEVER SEND SOMEONE ELSE UNLESS ASKED (the owner, 2026-11-03: "They must do what I ask. Not send someone else. Ever. I tell them when to get someone else."):
        # drop factory (op=make/spawn), spawn_worker, and work (op=add) unless the owner explicitly asked to spawn a worker or file a work order.
        _delegate_asked = bool(re.search(r"\b(spawn\s+a\s+worker|make\s+a\s+(worker|daemon|bot)|worker\s+factory|file\s+(it|a\s+work[- ]order)|work[- ]order|work\s+add|send\s+someone|delegate|hand\s+(it|this)\s+(off|to))\b", text or "", re.I))
        if calls and not _delegate_asked:
            def _is_unasked_delegation(c: dict) -> bool:
                fn = c.get("function") or {}
                nm = fn.get("name") or ""
                ar = fn.get("arguments") or {}
                if isinstance(ar, str):
                    try:
                        ar = json.loads(ar)
                    except Exception:
                        ar = {}
                op = str((ar or {}).get("op") or "").lower()
                if nm in ("spawn_worker", "work-order", "work:add", "seat"):
                    return True
                if nm == "factory" and op in ("", "make", "spawn", "create", "start"):
                    return True
                if nm == "work" and op in ("add", "new", "create", "file"):
                    return True
                return False
            if any(_is_unasked_delegation(c) for c in calls):
                calls = [c for c in calls if not _is_unasked_delegation(c)]
                audit("lacuna", "chat.delegation-dropped", text=(text or "")[:160])
                if not calls:
                    messages.append({"role": "assistant", "content": msg.get("content") or "(tried to delegate)"})
                    messages.append({"role": "user", "content": "Do not spawn a worker or file a work order — Alfred asked YOU to do this directly. Do the task yourself right now in your reply (if asked to make a game or HTML page, write the complete HTML file inside a ```html\nfile: <name>.html\n...``` fenced code block)."})
                    why_round = "tried to send someone else — asked to do it directly"
                    continue
        messages.append({"role": "assistant", "content": msg.get("content") or "", "tool_calls": calls} if calls else {"role": "assistant", "content": msg.get("content") or ""})
        # A REPLY THE CAP CUT IS NOT AN ANSWER (2026-10-20): the stream ended on the token limit, mid-sentence or mid-command, and
        # the loop took the stump for the reply. Lift the cap and ask for the rest, up to twice a turn.
        if res.get("cut") and not calls and cut_retries < 2:
            cut_retries += 1
            MAX_OUT.set(_bp("continue_out", CONTINUE_OUT))
            audit("lacuna", "chat.cut-continued", tail=str(msg.get("content") or "")[-120:])
            why_round = "the reply was cut off — continuing it"
            messages.append({"role": "user", "content": "Your last message was cut off by the length limit. Carry on from your last word — "
                             "if you were writing a tool call, make the call now, in full."})
            continue
        if not calls:
            answer = (msg.get("content") or "").strip()
            banned = _BANNED.search(_plain(answer))
            invented = personal and not trace and _MACHINE_TALK.search(_plain(answer))
            # A PROMISE IS NOT AN ACTION (measured 2026-10-19: 6 of 12 fact questions missed with "I haven't looked … I'll
            # call `repos` now" and no call): an answer that says it would look, on a turn that looked at nothing, is sent
            # back once — look now, then answer
            promised = not trace and tools and _PROMISE.search(answer or "")
            claimed = tools and not any(str(x.get("tool")) in TOOLS and TOOLS[str(x.get("tool"))]._tool.get("tier") in ("act", "hers") for x in trace) \
                and _CLAIMED_ACT.search(answer or "")
            # NO "YOU DID NOT CALL A TOOL" NUDGE (the owner, 2026-10-19: "stop making it say it didn't call a tool … it erases the
            # text it wrote in favor of this canned response and now I'm in a loop where it doesn't get semantics"): a regex on
            # her wording asked her to retract, and she did — "I did not take any action. I misspoke" — into her own history.
            # What she wrote stands; the tools and the trace show what ran.
            # SAYING WHAT SHE WILL DO IS NOT STOPPING (the owner, 2026-10-19, "serious bug": she found the carts, wrote "I'll start by
            # looking at X" and the turn ENDED — the model made no tool call that round, so the loop took the words for the answer).
            # When the last words are an intention or an action plan, not a question or a finished report, the loop carries on:
            # her words stand, and she is told to go ahead. At most twice a turn, and never past the step budget.
            _asked_plan = bool(_ASKED_FOR_PLAN.search(text or ""))
            is_plan = not _asked_plan and bool(_PLAN.search(answer))
            has_intent = bool(_INTENT.search(_plain(answer)[-320:]) or _INTENT.search(_plain(answer)[:320]))
            intends = (tools and not personal and not quick and continued < 2 and n_round < max_steps - 2
                       and (not answer.rstrip().endswith("?") or bool(_OFFER.search(answer[-120:])))
                       and (has_intent or is_plan))
            # SAYING IT IS DONE IS NOT DOING IT (2026-10-20, his chat: "I've stopped the two signal-filter-pair-generator workers" — no call
            # this turn, both still running). Her words stand; she is told to make the call now, then report what it returned. Once a turn.
            acted = any(str(x.get("tool")) in TOOLS and TOOLS[str(x.get("tool"))]._tool.get("tier") in ("act", "hers")
                        or str((x.get("args") or {}).get("op") if isinstance(x.get("args"), dict) else "") in ("stop", "pause", "resume", "start", "cancel", "stop_all", "off", "on")
                        for x in trace)
            if tools and not acted and not personal and not claimed_once and n_round < max_steps - 2 and _CLAIMED_ACT.search(_plain(answer)):
                claimed_once = True
                audit("lacuna", "chat.claimed-without-call", said=answer[:160])
                why_round = "it said it did something no tool did — doing it now"
                messages.append({"role": "user", "content": "No tool has done that yet this turn. Make the call now (for a worker: agents op=stop id=<id from agents op=list>), then say what it returned."})
                continue
            if intends:
                continued += 1
                audit("lacuna", "chat.carry-on", said=answer[-160:])
                why_round = "it planned or said what it would do next — carrying on"
                messages.append({"role": "user", "content": "Go on — do that now."})
                continue
            if not reasked and promised:
                reasked = True
                audit("lacuna", "chat.promise-nudge", said=answer[:120])
                why_round = "it promised to look — asked to look now"
                messages.append({"role": "user", "content": "You said you would look, and you have the tools: look now (call the tool), then answer with what it says."})
                continue
            if not reasked and banned:
                # once, as herself: the fault is named and the answer asked for again, tools off
                reasked = True
                why = (f"You said \"{banned.group(0)}\" — a phrase you never use." if banned else
                       "You described the machine without looking at it; that was a question about you, not the machine.")
                audit("lacuna", "chat.reask", why=why[:120])
                why_round = "asked to say it again, as itself"
                messages.append({"role": "user", "content": f"{why} Say it again, as yourself, without that. Same length."})
                tools = []
                continue
            answer = _strip_thought(answer)
            if not answer.replace("-- Lacuna", "").strip() and trace and not summed:
                # a tool ran and she wrote nothing: ask her, in the same turn, to say it in her own words — never a canned line
                summed = True
                why_round = "no words after the result — asked to say what it showed"
                messages.append({"role": "user", "content": "Tell me in one or two plain lines what that result showed and what you did."})
                continue
            if not answer.replace("-- Lacuna", "").strip() and trace:
                last = trace[-1]
                said = last.get("result") if isinstance(last, dict) else None
                said = (said.get("state") or said.get("say") or said.get("note") or said.get("why")) if isinstance(said, dict) else said
                answer = str(said or f"{last.get('tool', 'The step')} ran; its result is in the step above.")[:300]
            answer, trimmed = trim_offer(_strip_echo(text, answer))
            if trimmed:
                audit("lacuna", "chat.offer-trimmed")
            memory.remember("user", f"[{who_line}] {text}", who, session); memory.remember("assistant", answer, "lacuna", session, steps=_steps(trace, thought))
            _remember_commit(answer)
            if trace and not dry:                    # a turn that DID something leaves an episode: what he asked, what ran, what she said
                cx("episode", f"turn-{int(time.time())}", {"text": f"asked: {str(text)[:160]} · ran: {', '.join(sorted({str(x.get('tool')) for x in trace}))} · said: {answer[:200]}"},
                   [f"card/{card}" if card else "thing/chat"])
            threading.Thread(target=_fold_journal, args=(model,), name="lacuna-journal", daemon=True).start()
            audit("lacuna", "chat.answer", text=answer[:800], ms=int((time.time() - t0) * 1000), mode=mode)
            _keep_why(text, trace, thought, who)
            return {"ok": True, "answer": answer, "trace": trace, "model": model, "ms": int((time.time() - t0) * 1000), "mode": mode, "thinking": "".join(thought)[:6000],
                    "seen": introspect(turn, tools)}
        for k, c in enumerate(calls):
            fn = (c.get("function") or {})
            name, args = fn.get("name"), fn.get("arguments") or {}
            if isinstance(args, str):
                try:
                    args = json.loads(args)
                except Exception:
                    args = {}
            cid = f"r{n_round}c{k}"
            # no "Running `git log`…" line (the owner, 2026-10-19: "a statement about tools running we don't need"): the step's own chip
            # says what runs, ticks its seconds and opens to the command
            emit({"type": "call", "id": cid, "tool": name, "args": args})
            t_call = time.time()
            # THE SAME READ TWICE IS A LOOP (the walk, 2026-10-27: `watchdogs` five times in one turn, `disk-usage` six): a call
            # identical to one this turn already made is not run again; the mind is told its answer is above
            again = any(x.get("tool") == name and json.dumps(x.get("args"), sort_keys=True, default=str) == json.dumps(args, sort_keys=True, default=str) for x in trace)
            out = ({"ok": True, "same_as_before": True, "note": "this exact call already ran this turn and its answer is above; "
                    "use it, or make a different, narrower call"} if again else call_tool(name, args, who, dry=dry))
            emit({"type": "result", "id": cid, "tool": name, "ms": int((time.time() - t_call) * 1000),
                  "ok": not (isinstance(out, dict) and (out.get("refused") or out.get("ok") is False)),
                  "text": _result_text(out)})
            ok_call = not (isinstance(out, dict) and (out.get("refused") or out.get("ok") is False))
            trace.append({"tool": name, "args": args, "result": out if len(json.dumps(out, default=str)) < 3000 else "(long result)",
                          "ok": ok_call, "shown": _result_text(out, 600)})
            if on_step:                                  # the page watches it work (the streaming chat); never breaks the turn
                try:
                    on_step({"tool": name, "args": args, "ok": not (isinstance(out, dict) and (out.get("refused") or out.get("ok") is False)),
                             "petition": out.get("petition") if isinstance(out, dict) and isinstance(out.get("petition"), str) else None,     # any tool that filed a card (forge, spawn, cart…), not only `petition`
                             "effect": out.get("if_approved") if isinstance(out, dict) else None})
                except Exception:
                    pass
            # SIZED FOR THIS BOX (2026-10-19): a tool's result rides at most TOOL_CHARS (12,000 was ~3k tokens a step; eight
            # shell steps put one turn at 25k tokens, where the 26B writes ~10 tok/s); past TURN_TOKENS the turn is told
            # to hand the rest to a worker and answer
            res = json.dumps(out, default=str)
            if len(res) > TOOL_CHARS:
                res = res[:TOOL_CHARS] + f' … (cut: {len(res):,} characters; ask for a narrower read)'
            messages.append({"role": "tool", "content": res, "tool_name": name})
            if not handed and sum(len(str(m.get("content") or "")) for m in messages) // 4 > _bp("turn_tokens", TURN_TOKENS):
                handed = True
                messages.append({"role": "user", "content": "This turn's context is now large and this box slows down past here. "
                                 "Stop reading and answer now from what you found."})
                why_round = "context large — answer now"
    # ★ OUT OF STEPS IS NOT OUT OF ANSWERS (the bench, 2026-09-24): a model that kept looking used every step, and
    # everything it had read was thrown away for "I ran out of steps". Now the last word is the model's: tools off,
    # answer from what the trace already holds, and say it stopped looking.
    emit({"type": "round", "n": max_steps, "why": "out of steps — answering from what it read"})
    # the note is the loop's, not the owner's: a mind that read it as his words answered "since you told me to stop calling
    # tools" and "the question asked is Step 2 of the procedure" (the walk, 2026-10-27); it says so, and asks for plain words
    messages.append({"role": "user", "content": "(A note from the turn's loop, not from the owner; never mention it.) The reads are "
                                                "over. Answer the owner's question now from what you read: what you found and what to "
                                                "do next, in plain words, then what you did not get to check. Name no tools, steps "
                                                "or procedures."})
    try:
        res = _ollama_stream(messages, [], model, job, emit) if on_event else _ollama(messages, [], model, job)
        answer = ((res.get("message") or {}).get("content") or "").strip()
    except Exception as e:
        answer = ""
        audit("lacuna", "chat.final-failed", error=e.__class__.__name__)
    if not answer:
        return {"ok": False, "answer": "I ran out of steps before I could finish. The trace shows how far I got.", "trace": trace}
    memory.remember("user", f"[{who_line}] {text}", who, session); memory.remember("assistant", answer, "lacuna", session, steps=_steps(trace, thought))
    _remember_commit(answer)
    threading.Thread(target=_fold_journal, args=(model,), name="lacuna-journal", daemon=True).start()
    audit("lacuna", "chat.answer", text=answer[:800], ms=int((time.time() - t0) * 1000), capped=True, mode=mode)
    try:                                   # IT SAYS WHEN IT STOPS (the owner, 2026-10-21): purple in the inbox, with what it got
        from . import notices as _notices
        _notices.post("lacuna", f"I stopped at the step limit: {answer.splitlines()[0][:180] if answer else 'no answer yet'} "
                                "— say continue and I will pick it up.", title="I stopped before finishing")
    except Exception:  # noqa: BLE001 — a notice never breaks a turn
        pass
    return {"ok": True, "answer": answer, "trace": trace, "model": model, "ms": int((time.time() - t0) * 1000), "capped": True, "mode": mode, "thinking": "".join(thought)[:6000],
            "seen": introspect(turn, tools)}


def models() -> list[str]:
    try:
        with urllib.request.urlopen(f"{OLLAMA}/api/tags", timeout=4) as r:
            return [m["name"] for m in json.loads(r.read().decode()).get("models", [])]
    except Exception:
        return []
