"""THE BRIEF — what Lacuna is handed with a question, so it knows HOW before it starts (2026-10-19, the owner: "she doesn't
know how to do anything … lots of context and the right ones at the right time so it doesn't have to check").

Measured before this file: the right playbook WAS found (CART-REPAIR at 0.71, IPAD-INSTALL-FAILED at 0.83), but what
rode was ten 900-character fragments — a steps table cut after row 1, the same journal line three times — and nothing
about the cart he named. She held step 1 of a procedure and none of the object it was about. One builder now, in order:

  procedure  the best playbook or skill WHOLE (up to two, PROC_CHARS) — the steps, the If-not column, the roll back
  things     what the question NAMES, read from the source: a cart → its files, its last strict verdict (reasons, the
             acts that were gaps), its last repair attempts (the workshop log) and its cortex trail; a worker or job id
             → its last log lines; a playbook name (P-XXX) → that playbook
  memory     the cortex's lessons, decisions and facts on the words — newest first, the noise kinds dropped
  records    what is left of the search, one copy each, the sources already loaded whole skipped
  then       WHEN the question names a time ("yesterday", "last night", "on the 18th", "Oct 17", "3 days ago", "last
             week"): what happened in that window — the cortex since then and our own talk on those days, by meaning
  which?     when the words fit SEVERAL things (three carts called *-notify, two workers), the candidates are listed and
             Lacuna asks which one before acting

Everything is LOADED, never unloaded: a turn carries what it needs fresh, and the next turn builds its own. The rules
for what rides (and how much) are the constants below; working.md tells Lacuna how to read a brief.

  build(text, card=None) → str (the tagged blocks, '' when nothing fits)
"""
from __future__ import annotations

import json
import re
import time
from pathlib import Path

HOME = Path.home()
CURATOR = HOME / "code" / "curator"
WORLD = HOME / "lacuna-world"
PLAYBOOKS = WORLD / "playbooks"
SKILLS = HOME / "code" / "lacuna" / "lacuna-box" / "pi-agent" / "skills"
STRICT = CURATOR / "scratch" / "honest-count" / "runs-all-strict1.json"
WORKSHOP_LOG = HOME / ".lacuna" / "workshop" / "log.jsonl"
NOTES = WORLD / "notes"
TASK_NOTE = "active-task.md"      # the standing task, in her own words: the md half of the hybrid (the cortex is the other half)
TASK_CHARS = 1400
TASK_FRESH_H = 72

# SIZED FOR THIS BOX (2026-10-19, measured): at ~25k tokens of context the 26B writes 10 tok/s, at a few thousand 34 —
# every character here is paid again on every token written, so the brief carries the procedure and little else
PROC_MIN = 0.55          # a playbook or skill this close to the question is loaded whole
PROC_CHARS = 6000        # the most procedure text one turn carries (two playbooks of the usual size); the 10-21 cut reverted 2026-10-23
THING_CHARS = 2500
MEMORY_K = 8
MEMORY_CHARS = 1500
RECORD_CHARS = 1500
NOISE = re.compile(r"compacted \(threshold\)|No prior history|^\s*\*\*\d+ prior steps\*\*", re.I)
SLUG = re.compile(r"\b[a-z0-9]+(?:-[a-z0-9]+){1,8}\b")
WORKER = re.compile(r"\bw-[a-z0-9-]{4,40}\b")
PLAYBOOK_ID = re.compile(r"\bP-[A-Z]{2,12}\b")

_strict: dict = {"t": 0.0, "d": {}}

KINDS = [
    # the SRE problems (INTEGRATION-NIGHT-2026-10-27 step 7): each brings its playbook; specific before general; the same
    # table as brain/brief.mjs's, the same order
    (re.compile(r"\brelease\w*\b.{0,40}\b(stuck|hung|hangs?|stall\w*|not (moving|finishing|done)|frozen)\b|\b(stuck|hung|stalled)\b.{0,40}\brelease\b", re.I), ("lacuna/RELEASE-STUCK",)),
    (re.compile(r"\b(roll ?back|revert|undo (the|a|that|this) (deploy\w*|release|change)|put the old (one|build|version) back|go back to the last (build|release|version))\b", re.I), ("lacuna/ROLLBACK",)),
    (re.compile(r"\bpromot\w*\b.{0,30}\b(fail\w*|broke|error\w*)\b", re.I), ("lacuna/PROMOTE-FAILED",)),
    (re.compile(r"\b(release|ship (it|the build|a build|to (qa|prod\w*))|cut a (build|release)|promote)\b", re.I), ("lacuna/RELEASE", "skill/release-engineering")),
    (re.compile(r"\b(hot ?fix|urgent fix|emergency fix|fix (it )?in prod\w*)\b", re.I), ("lacuna/HOTFIX",)),
    (re.compile(r"\b(fix (the|this|a|that) (bug|code|test)|failing tests?|patch (the|this|a)|code (fix|change)|refactor\w*)\b", re.I), ("lacuna/CODE-SHIP", "skill/code-workshop")),
    (re.compile(r"\b(error spike|errors? (are |is )?(spik|climb|jump|pil)\w*|spike in (the )?(errors|logs|5\d\d)|lots of errors|error rate)\b", re.I), ("lacuna/ERROR-SPIKE",)),
    (re.compile(r"\b(watchdogs?|red (light|row|watchdog|alert)|alert(s|ing)?|alarms?)\b", re.I), ("lacuna/WATCHDOG-RED",)),
    (re.compile(r"\bqa\b.{0,30}\b(down|not answering|dead|unreachable|offline|broken)\b", re.I), ("lacuna/QA-DOWN",)),
    (re.compile(r"\bcards?\b.{0,30}\b(stuck|frozen|won'?t (move|open|close)|not moving|hung)\b", re.I), ("lacuna/STUCK-CARD",)),
    (re.compile(r"\b(loop(s|ing)?|over and over|keeps (doing|repeating|trying)|repeats? (itself|forever)|same (thing|step) (again|over))\b", re.I), ("lacuna/STUCK-AND-LOOPING",)),
    (re.compile(r"\bcarts?\b.{0,40}\b(fail\w*|broke\w*|repair\w*|fix\w*|strict)\b", re.I), ("lacuna/CART-REPAIR", "skill/cart-repair")),
    (re.compile(r"\b(queue|work list|jobs?)\b.{0,40}\b(stuck|pil(e|ing) up|not (moving|running)|backed up)\b", re.I), ("lacuna/JOB-QUEUE",)),
    (re.compile(r"\b(disk|drive|storage|out of (room|space)|free space|space (left|free)|(disk|drive) (is )?full)\b", re.I), ("lacuna/DISK",)),
    (re.compile(r"\bmerge conflicts?\b", re.I), ("lacuna/MERGE-CONFLICT",)),
    (re.compile(r"\b(rate.?limit\w*|429|blocked us|cut us off|banned|too many requests)\b", re.I), ("lacuna/OUTSIDE-SITE",)),
    (re.compile(r"\btools?\b.{0,30}\b(error\w*|fail\w*|broke\w*)\b", re.I), ("lacuna/TOOL-ERRORS",)),
    (re.compile(r"\b(backups?|back up|snapshots?|restore (the|a|from))\b", re.I), ("lacuna/BACKUP",)),
    (re.compile(r"\b(page (me|him|the owner)|paging|push notification)\b", re.I), ("lacuna/PAGING",)),
    # the Lacuna SRE skill (2026-10-31): the same row as brain/brief.mjs's, at the same place
    (re.compile(r"\b(lacuna(?:'s| is| itself| (?:code|codebase|repo|tree|box))|foreman|the door|the hands|the engine|lme)\b.{0,40}\b(down|broke\w*|crash\w*|fail\w*|hang\w*|stuck|dead|not (?:working|answering|starting|running|up)|maintain\w*|repair\w*|fix\w*|debug\w*)\b|\b(fix\w*|maintain\w*|repair\w*|debug\w*|chang\w*|work(?:ing)? on)\b.{0,30}\b(lacuna|foreman|the door|the hands|the engine|lme)\b", re.I), ("skill/lacuna-sre",)),
    # the Lacuna protocol and the Reference Manual 1.0 (CL-REFMAN; the final fixup plan 5.1): the owner's turns come here, so the
    # minds learn the verbs from the playbook (shell commands they hold) and the protocol skill; the same words as brain/brief.mjs
    (re.compile(r"\b(lacuna protocol|lvm|vm sessions?|refuse forms?|answer types?|reference manual|refman(?:-1\.0)?|verb manual|which verbs?|what verbs?|a verb'?s (?:args|arguments|signature)|scheme verbs?)\b|\(\s*(?:help|describe|manual|apropos)\b", re.I),
     ("lacuna/REFERENCE-MANUAL", "skill/lacuna-protocol")),
    # building for Lacuna (the final fixup plan 5.3): words about writing code, a game or an app bring the SDK's skill
    (re.compile(r"\b(write (?:the |some |a )?code|javascript|a module|build (?:a|an|the) (?:game|tool|app|page|cart)|make (?:a|an) (?:game|app|tool)|game|sdk|three\.?js|phaser|capsule)\b", re.I), ("skill/lacuna-sdk",)),
    (re.compile(r"\b(agent team|team of agents|design a team|design an? (agent|team)|swarm|sentry team|remote sentry|phone agent|bot (for|on) (a|my|the)|train a mind for|new team|team designs?|external (bot|agent|sentry))\b", re.I),
     ("lacuna/AGENT-TEAMS", "skill/agent-teams")),
    (re.compile(r"\b(embedding|embeddings|cortex|remember|recall|by meaning|rag)\b", re.I), ("skill/embeddings-and-cortex",)),
    (re.compile(r"\b(agent types?|kinds? of (agents?|bots?|helpers?)|dispatcher|sentry|eye|siglip)\b", re.I), ("lacuna/AGENT-TYPES",)),
    (re.compile(r"\b(brain|which model|what model|4b|e4b|12b|26b|31b|swap|bring (?:out|in|back)|send (?:it|the \w+) back|8-bit|8 bit|q8|quantiz\w*|library|helper mind|make a helper|new helper)\b", re.I), ("lacuna/BRAINS-AND-LIBRARY",)),
    (re.compile(r"\b(what (is|are|'s) running|running now|stop (it|the|that)|pause|resume|start (it|them) again|daemons?|agents?)\b", re.I), ("lacuna/AGENTS",)),
    (re.compile(r"\b(worker|workers|daemon|bot|bots|watcher|factory|spawn|foreman|scheme|erlang|put a brain|a brain in)\b", re.I), ("lacuna/WORKER-FACTORY",)),
    (re.compile(r"\b(where is|where are|where do|what can you|orientation|restart(ed)?|reboot(ed)?|your parts|what are you made)\b", re.I), ("lacuna/ORIENTATION",)),
    (re.compile(r"\b(torch|tokenizer|gguf export|export failed|doctor|broke|broken|fails?|failed|failing)\b.{0,60}\b(forge|train\w*|model|mind|export|errand)\b|\b(forge|train\w*|model|mind|export|errand)\b.{0,60}\b(torch|tokenizer|fails?|failed|failing|broke|broken)\b", re.I), ("lacuna/FORGE-DOCTOR",)),
    (re.compile(r"\b(forge|train(s|ed|ing)?|fine-?tun\w*|specialist|sentry|pairs|weights?|base model|gguf|safetensors|checkpoint|"
                r"hugging ?face|270m|functiongemma|gemma-?3|adapter|mlx)\b", re.I), ("lacuna/FORGE-RUN",)),
]


# WORK, BREAK, CHAT (the owner's ruling 4, docs/RULINGS.slat 2026-10-26-r4; the same words and lines as brain/brief.mjs)
SRE_RULES = 19            # the SRE problems' rules: the first entries of KINDS
_MODE_SET = re.compile(r"^\s*/(work|break|chat)\b", re.I)
_WORK_WORDS = re.compile(r"\b(fix|repair|restart|release|deploy|ship|roll ?back|revert|check|look at|investigate|debug|run|rerun|build|install|patch|review|kill|stop|start|status|logs?|alerts?|errors?|failing|failed|broken|stuck|why (is|did|does|are)|what('?s| is) (wrong|failing|broken|running))\b", re.I)
_BREAK_WORDS = re.compile(r"\b(take a break|let'?s (pause|stop|take five|rest)|break time|done for now|enough for (now|tonight)|back later)\b", re.I)
_CHAT_WORDS = re.compile(r"^\s*(hey|hi|hello|yo|thanks|thank you|good (morning|night|evening|afternoon)|how are you|what'?s up|lol|haha)\b", re.I)
MODE_LINES = {
    "work": '<mode name="work">Work: the answer first, then what ran and what it showed, with the numbers; active voice; the playbook\'s steps in order; one call before every claim about the box.</mode>',
    "break": '<mode name="break">Break: the work is paused. Talk; make no call unless Alfred asks for one; when he is back, say where the work stood.</mode>',
    "chat": '<mode name="chat">Talk: as yourself, easy and brief. Nothing is done on the box unless Alfred asks.</mode>',
}


def work_mode_of(text: str, prev: str = "chat") -> str:
    """The turn's work mode from its words: /work, /break, /chat; an SRE problem or a request on the box is work; a pause is
    break; a greeting is chat; anything else keeps the last mode (an abstain keeps the mode)."""
    t = str(text or "")
    m = _MODE_SET.match(t)
    if m:
        return m.group(1).lower()
    if any(rx.search(t) for rx, _ in KINDS[:SRE_RULES]) or _WORK_WORDS.search(t):
        return "work"
    if _BREAK_WORDS.search(t):
        return "break"
    if _CHAT_WORDS.match(t):
        return "chat"
    return prev


def _read(p: Path, n: int) -> str:
    try:
        t = p.read_text(errors="replace")
    except OSError:
        return ""
    return t if len(t) <= n else t[:n].rsplit("\n", 1)[0] + "\n… (cut; the whole file is " + str(p) + ")"


def _path_of(src: str) -> Path | None:
    """The file a RAG source id names (rag.sources keys: skill/<name> · lacuna/<STEM> · eng/<stem>)."""
    from . import rag
    for k, _t, p in rag.sources():
        if k == src:
            return p
    return None


def _is_procedure(src: str) -> bool:
    if src.startswith("skill/"):
        return True
    if src.startswith("lacuna/"):
        p = _path_of(src)
        return bool(p and p.parent == PLAYBOOKS and p.stem not in ("README",))
    return False


def _strict_runs() -> dict:
    try:
        m = STRICT.stat().st_mtime
        if m != _strict["t"]:
            _strict.update(t=m, d=json.loads(STRICT.read_text()))
    except (OSError, ValueError):
        pass
    return _strict["d"]


def _cart(slug: str) -> str | None:
    files = [p for p in (CURATOR / "carts" / "automations" / slug / f"{slug}.sks",
                         CURATOR / "curator-web" / "public" / "automations" / "cart" / f"{slug}.sks",
                         WORLD / "carts" / f"{slug}.sks") if p.exists()]
    if not files:
        return None
    lines = [f"cart {slug}", "files: " + " · ".join(str(p) for p in files)]
    d = _strict_runs()
    run = d.get(slug) or d.get(f"{slug}/{slug}.sks")
    if isinstance(run, dict):
        gaps = sorted({f"{a.get('verb')} ({a.get('kind')})" for a in run.get("acts") or []
                       if a.get("kind") in ("fixture-gap", "missing", "refused", "error") or a.get("routed") == "empty"})
        lines.append(f"strict run on record (runs-all-strict1.json): {run.get('outcome')}" + (f", ended on {run['endedOn']}" if run.get("endedOn") else "")
                     + (f", {run['escalateKind']}: {run.get('escalateDetail')}" if run.get("escalateKind") else ""))
        if run.get("reasons"):
            lines.append("reasons: " + "; ".join(str(r) for r in run["reasons"])[:600])
        if gaps:
            lines.append("acts that had nothing to read: " + ", ".join(gaps)[:500])
    try:                                           # what the cortex already knows of this cart (repair outcomes, lessons)
        from . import lacuna_cortex
        past = [str(h)[:220] for h in (lacuna_cortex.recall(f"cart-{slug}", k=3, timeout=1.5) or []) if slug in str(h)]
        if past:
            lines.append("from your cortex:\n  " + "\n  ".join(past))
    except Exception:  # noqa: BLE001
        pass
    tries = []
    try:
        with WORKSHOP_LOG.open("rb") as f:
            f.seek(0, 2)
            f.seek(max(0, f.tell() - 400_000))
            for ln in f.read().decode(errors="replace").splitlines()[1:]:
                if slug in ln:
                    try:
                        e = json.loads(ln)
                    except ValueError:
                        continue
                    tries.append(f"{e.get('t') or e.get('when') or ''} {e.get('task')} {e.get('step')}: "
                                 + str(e.get("outcome") or e.get("checks") or e.get("why") or "")[:160])
    except OSError:
        pass
    verdicts = sorted({v for t in tries for v in re.findall(r"strict:[a-z-]+", t)})
    if verdicts:
        lines.append("the strict checker's latest verdicts: " + ", ".join(verdicts) + " — the cart-repair skill's verdict table says the fix")
    if tries:
        lines.append(f"repair attempts ({len(tries)}, newest last):\n  " + "\n  ".join(tries[-5:]))
    return "\n".join(lines)


def _worker(wid: str) -> str | None:
    for base in (HOME / ".lacuna" / "logs" / "workers", WORLD / "jobs" / wid):
        for p in ([base / f"{wid}.log"] if base.name == "workers" else sorted(base.glob("*.log")) if base.is_dir() else []):
            if p.exists():
                tail = p.read_text(errors="replace").splitlines()[-12:]
                return f"{wid} ({p}), last lines:\n  " + "\n  ".join(x[:200] for x in tail)
    return None


def _things(text: str, skip_src: set) -> list[str]:
    out, seen = [], set()
    for slug in SLUG.findall(text or ""):
        if slug in seen or len(out) >= 3:
            continue
        seen.add(slug)
        c = _cart(slug)
        if c:
            out.append(c)
    for wid in WORKER.findall(text or ""):
        w = _worker(wid)
        if w:
            out.append(w)
    for pid in PLAYBOOK_ID.findall(text or ""):
        for p in PLAYBOOKS.glob("*.md"):
            head = p.read_text(errors="replace")[:200]
            if pid in head and f"lacuna/{p.stem}" not in skip_src:
                out.append(f"playbook {pid} ({p}):\n" + _read(p, 6000))
                skip_src.add(f"lacuna/{p.stem}")
                break
    return out


MONTHS = {m: i for i, m in enumerate(("jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"), 1)}


def when(text: str, now: float | None = None) -> tuple[float, float, str] | None:
    """(start, end, words) of the time the question names, or None. Local days."""
    now = now or time.time()
    lt = time.localtime(now)
    day0 = time.mktime((lt.tm_year, lt.tm_mon, lt.tm_mday, 0, 0, 0, 0, 0, -1))
    t = (text or "").lower()
    m = re.search(r"\b(\d+)\s+days?\s+ago\b", t)
    if m:
        a = day0 - int(m.group(1)) * 86400
        return a, a + 86400, m.group(0)
    if re.search(r"\byesterday\b|\blast night\b", t):
        return day0 - 86400, day0 + (6 * 3600 if "night" in t else 0), "yesterday"
    if re.search(r"\bthis morning\b|\btoday\b|\bearlier\b", t):
        return day0, now, "today"
    if re.search(r"\blast week\b|\bthis week\b", t):
        return day0 - 7 * 86400, now, "the last 7 days"
    m = re.search(r"\b(\d{4})-(\d{2})-(\d{2})\b", t)
    if m:
        a = time.mktime((int(m.group(1)), int(m.group(2)), int(m.group(3)), 0, 0, 0, 0, 0, -1))
        return a, a + 86400, m.group(0)
    m = re.search(r"\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?\s+(\d{1,2})\b", t) or \
        re.search(r"\bon the (\d{1,2})(?:st|nd|rd|th)\b", t)
    if m:
        mon, d = (MONTHS[m.group(1)], int(m.group(2))) if m.lastindex == 2 else (lt.tm_mon, int(m.group(1)))
        a = time.mktime((lt.tm_year, mon, d, 0, 0, 0, 0, 0, -1))
        if a > now:
            a = time.mktime((lt.tm_year - 1, mon, d, 0, 0, 0, 0, 0, -1))
        return a, a + 86400, m.group(0)
    return None


def _then(text: str, card: str | None) -> list[str]:
    w = when(text)
    if not w:
        return []
    a, b, words = w
    out = [f"the window: {words} = {time.strftime('%a %b %d %H:%M', time.localtime(a))} → {time.strftime('%a %b %d %H:%M', time.localtime(b))}"]
    try:
        from . import lacuna_cortex
        for h in lacuna_cortex.recall(f"{card or ''} {text}", k=12, timeout=2.0, since=time.strftime("%Y-%m-%d", time.localtime(a))) or []:
            if not NOISE.search(str(h)):
                out.append(f"cortex: {str(h)[:260]}")
    except Exception:  # noqa: BLE001
        pass
    try:
        from . import rag
        for h in rag.search(text, k=30, min_score=0.40, sources_in={"conversation", "journal"}):
            m = re.match(r"\[(\d{4}-\d{2}-\d{2} \d{2}:\d{2})\]", h["text"])
            if m:
                ts = time.mktime(time.strptime(m.group(1), "%Y-%m-%d %H:%M"))
                if a <= ts < b:
                    out.append(f"{h['title']}: {h['text'][:300]}")
    except Exception:  # noqa: BLE001
        pass
    seen, uniq = set(), []
    for x in out:
        k = re.sub(r"\[[^\]]*\]|\W+", " ", x.lower())[-160:]
        if k not in seen:
            seen.add(k)
            uniq.append(x)
    return uniq[:18] if len(uniq) > 1 else []


def _carts_like(text: str) -> list[str]:
    """Cart slugs the words point at without naming one exactly: 'the notify cart', 'that alt text one'."""
    names = [p.name for p in (CURATOR / "carts" / "automations").iterdir() if p.is_dir()] if (CURATOR / "carts" / "automations").is_dir() else []
    words = [w for w in re.findall(r"[a-z0-9]{3,}", (text or "").lower()) if w not in ("cart", "carts", "the", "fix", "repair", "that", "one", "this", "and", "for")]
    if not words or not re.search(r"\bcarts?\b", text or "", re.I):
        return []
    scored = sorted(((sum(1 for w in words if w in n), n) for n in names), reverse=True)
    top = [n for sc, n in scored if sc and sc == scored[0][0]]
    return top[:8]


def _memory(text: str, card: str | None) -> list[str]:
    from . import lacuna_cortex
    q = f"{card or ''} {text}".strip()
    got, seen = [], set()
    for kind in ("lesson", "decision", None):
        try:
            hits = lacuna_cortex.recall(q, kind=kind, k=MEMORY_K, timeout=2.0)
        except Exception:  # noqa: BLE001 — no memory this turn; the turn goes on
            hits = []
        for h in hits or []:
            s = str(h)
            if NOISE.search(s):
                continue
            key = re.sub(r"\W+", " ", s.lower())[:90]
            if key in seen:
                continue
            seen.add(key)
            got.append(s[:320])
    out, used = [], 0
    for s in got:
        if used + len(s) > MEMORY_CHARS:
            break
        out.append(s)
        used += len(s)
    return out


def ledger(minutes: float = 90) -> str:
    """WHERE I AM AND WHAT I DID (2026-10-20, the owner: "it remembers what we talked about but not what it did 30 min ago"):
    `<task>` is the standing task note she keeps in notes/active-task.md — read fresh every turn, never searched for, so a
    long job survives a cut reply, a restart and a stack of "continue"; `<did>` is the tool steps of the last `minutes`,
    straight from the conversation log. Both are small, exact and the same shape every turn (they ride at the tail)."""
    from . import memory
    out = []
    p = NOTES / TASK_NOTE
    try:
        if p.exists() and time.time() - p.stat().st_mtime < TASK_FRESH_H * 3600:
            body = p.read_text(errors="replace").strip()
            if body and not re.search(r"^\s*status:\s*(done|complete|closed|cancel)", body, re.I | re.M):
                cut = body if len(body) <= TASK_CHARS else body[:TASK_CHARS].rsplit("\n", 1)[0] + f"\n… (cut; whole note: {p})"
                out.append(f'<task note="your standing task, from {p.name} — edit that note as steps finish; it outranks your memory of it">\n{cut}\n</task>')
    except OSError:
        pass
    did = memory.work_lines(minutes)
    if did:
        out.append(f'<did note="what you ran in the last {int(minutes)} min, oldest first — a failed step says why">\n' + "\n".join(did) + "\n</did>")
    return "\n\n".join(out)


def build(text: str, card: str | None = None) -> str:
    from . import rag
    t0 = time.time()
    try:
        hits = rag.search(text, k=24)
    except Exception:  # noqa: BLE001
        hits = []
    # PROCEDURE: the best playbook/skill sources, whole
    best: dict[str, float] = {}
    for h in hits:
        if _is_procedure(h["src"]):
            best[h["src"]] = max(best.get(h["src"], 0), h["score"])
    procs, loaded, used = [], set(), 0
    # A KIND OF JOB BRINGS ITS PROCEDURE (2026-10-20: "train the sentry" loaded the forge skill but not P-FORGE-RUN, and "find the base
    # weights" loaded nothing — she invented `forge train --specialist …`, looked for weights in ~/.forge, which her shell cannot read,
    # decided they were missing and "downloaded" them in prose). The words of the job pick the playbook, as a named cart picks CART-REPAIR.
    for rx, srcs in KINDS:
        if rx.search(text):
            for src in srcs:
                if src in loaded or used > PROC_CHARS - 1200:
                    continue
                p = _path_of(src)
                body = _read(p, PROC_CHARS - used) if p else ""
                if len(body) >= 200:
                    procs.append(f"— {src} ({p}), for this kind of job:\n{body}")
                    loaded.add(src)
                    used += len(body)
    for src, sc in sorted(best.items(), key=lambda kv: -kv[1])[:2]:
        if sc < PROC_MIN or (procs and sc < max(best.values()) - 0.05):
            continue
        p = _path_of(src)
        body = _read(p, PROC_CHARS - used) if p else ""
        if len(body) < 200:
            continue
        procs.append(f"— {src} ({p}), match {sc:.2f}:\n{body}")
        loaded.add(src)
        used += len(body)
    things = _things(text, loaded)
    which = []
    if not any(t.startswith("cart ") for t in things):
        like = _carts_like(text)
        if len(like) == 1:
            c = _cart(like[0])
            if c:
                things.append(c)
        elif len(like) > 1:
            which = like
    then = _then(text, card)
    # A NAMED THING BRINGS ITS PROCEDURE: a cart's name drowns "repair" in the search, so a cart in the question loads
    # the cart playbook and skill by kind, not by luck (2026-10-19: "fix the cart custom-order-accept-notify" loaded none)
    if any(t.startswith("cart ") for t in things):
        for src in ("lacuna/CART-REPAIR", "skill/cart-repair"):
            if src in loaded or used > PROC_CHARS - 1500:
                continue
            p = _path_of(src)
            body = _read(p, PROC_CHARS - used) if p else ""
            if len(body) >= 200:
                procs.append(f"— {src} ({p}), for the cart named:\n{body}")
                loaded.add(src)
                used += len(body)
    memory = _memory(text, card)
    # RECORDS: one copy each, nothing from a source already loaded whole
    recs, seen, used = [], set(), 0
    for h in hits:
        if h["src"] in loaded:
            continue
        key = re.sub(r"\W+", " ", h["text"].lower())[:120]
        if key in seen:
            continue
        seen.add(key)
        t = h["text"].strip()
        if used + len(t) > RECORD_CHARS:
            break
        recs.append(f"— {h['title']} ({h['loc']}, {h['score']:.2f}):\n{t}")
        used += len(t)
    blocks = []
    if procs:
        blocks.append("<procedure note=\"the playbook or skill for this, WHOLE — follow its steps and its If-not column; "
                      "say which one you follow\">\n" + "\n\n".join(procs) + "\n</procedure>")
    if things:
        blocks.append("<things note=\"what the question names, read from the source just now\">\n" + "\n\n".join(things)[:THING_CHARS]
                      + "\n</things>")
    if which:
        blocks.append("<which note=\"the words fit more than one cart — ASK the owner which one before you act; offer these\">\n"
                      + "\n".join(f"- {n}" for n in which) + "\n</which>")
    if then:
        blocks.append("<then note=\"what happened in the time the question names — the cortex and our talk in that window; say the dates\">\n"
                      + "\n".join(then)[:2500] + "\n</then>")
    if memory:
        blocks.append("<memory note=\"your cortex: lessons, decisions, facts — newest first; live data outranks it\">\n"
                      + "\n".join(f"- {m}" for m in memory) + "\n</memory>")
    if recs:
        blocks.append("<records note=\"more of your documents and past talk, found by meaning; say where it came from\">\n"
                      + "\n\n".join(recs) + "\n</records>")
    try:
        from .core import audit
        audit("lacuna", "brief.built", procedures=sorted(loaded), things=len(things), memory=len(memory), records=len(recs),
              ms=int((time.time() - t0) * 1000))
    except Exception:  # noqa: BLE001
        pass
    return "\n\n".join(blocks)
