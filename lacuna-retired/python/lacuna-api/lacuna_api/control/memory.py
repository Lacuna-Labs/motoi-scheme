"""LACUNA REMEMBERS — one conversation, on disk, across every surface and every restart (his, 2026-09-26: "make sure
it can recall conversations. I don't want it being a disembodied spirit").

What the Qwen team says (the Qwen3 model card and the Qwen-Agent framework): the model itself keeps nothing between
calls; memory is what you put back into the prompt. Keep the history as plain user/assistant turns and NEVER the
thinking content of earlier turns (their chat template drops it); give the window room (Qwen3-8B answers 32K
natively, Ollama's build 40K); and for anything older than the window, retrieve it — Qwen-Agent's memory is retrieval
over kept text, not a bigger prompt. So, here:
  · every turn, from the phone, the desktop dock or the CLI, lands in ~/.lacuna/conversation.jsonl — ONE conversation;
  · the last RECENT turns ride in the prompt verbatim (loaded from disk when Lacuna starts, so a restart forgets nothing);
  · older turns are folded into a JOURNAL of short notes the model writes for itself when the tail is trimmed
    (~/.lacuna/journal.md), and the newest notes ride in the prompt too;
  · `recall(query)` searches the whole conversation and the journal for what is not in the prompt.
Nothing here decides anything; it is the model's memory and the audit stays the record.
"""
from __future__ import annotations

import json
import re
import threading
import time

from .core import LACUNA_HOME, audit

CONVERSATION = LACUNA_HOME / "conversation.jsonl"
JOURNAL = LACUNA_HOME / "journal.md"
RECENT = 10             # messages kept verbatim (2026-10-19: sized under the context cliff; older talk is found by recall and the brief's <then>; the 10-21 cut to 6 reverted 2026-10-23: capability, not restriction)
JOURNAL_NOTES = 12      # newest journal notes carried in the prompt
_lock = threading.Lock()
_turns: list[dict] = []
_loaded = False


def _load():
    global _loaded
    if _loaded:
        return
    _loaded = True
    if not CONVERSATION.exists():
        return
    try:
        for ln in CONVERSATION.read_text().splitlines()[-4000:]:
            try:
                t = json.loads(ln)
                if isinstance(t, dict) and t.get("role") in ("user", "assistant"):
                    _turns.append(t)
            except Exception:
                continue
    except OSError:
        pass


def remember(role: str, content: str, who: str = "", session: str = "", steps: list | None = None):
    if role == "assistant" and "](app:" in str(content or ""):
        try:
            from . import chat as _c
            content = _c.fix_links(content)                      # a wrong screen id in a stored report would be a dead button on every reload
        except Exception:  # noqa: BLE001
            pass
    if role == "assistant":
        content = _RECORD_ECHO.sub("", str(content or ""))
    if role == "assistant":                                  # NO SIGNATURE (the owner, 2026-10-19): the sign-off is not kept
        content = re.sub(r"\s*\n\s*-{1,2}\s*Lacuna\s*$", "", str(content or "")).rstrip() if re.search(r"-{1,2}\s*Lacuna\s*$", str(content or "")) else content
    """One turn, to the log and the window. Only the final words — never a tool result, never the thinking. A session named
    `eval:…` is a measurement (a question set asked to measure Lacuna): it is answered like any turn and never kept, so a
    test never lands in the owner's chat."""
    if str(session or "").startswith("eval:"):
        return
    with _lock:
        _load()
        t = {"t": time.time(), "role": role, "content": (content or "")[:4000], "who": who, "session": session}
        if steps:                    # what the turn did, for the screen only (recent() hands the model role + content)
            t["steps"] = steps[:40]
        _turns.append(t)
        try:
            CONVERSATION.parent.mkdir(parents=True, exist_ok=True)
            with open(CONVERSATION, "a") as f:
                f.write(json.dumps(t) + "\n")
        except OSError:
            pass


def _window_file():
    from pathlib import Path
    return Path.home() / ".lacuna" / "window-since.json"


def clear_window() -> float:
    """A FRESH START (the owner, 2026-10-19: "it should check and dump dumb stuff from the last task, like a clear"): what rides in her
    window begins now. The turns stay on disk, in the journal, under `recall`, and (when condensed) as a summary in the cortex."""
    import json as _j
    t = time.time()
    try:
        _window_file().write_text(_j.dumps({"since": t}))
    except OSError:
        pass
    return t


def _window_since() -> float:
    import json as _j
    try:
        return float(_j.loads(_window_file().read_text()).get("since") or 0)
    except (OSError, ValueError):
        return 0.0


def voice_since() -> float:
    """When the voice last changed: the prompt file's modification time. Measured 2026-09-26: with twenty old
    status-dump answers in the window, a new prompt changed nothing — the model answered "hey" the way its own
    last twenty answers had. A new voice starts a fresh window; the old turns stay on disk, in the journal and
    under `recall`."""
    try:
        from pathlib import Path
        return max((Path(__file__).with_name("prompt.md")).stat().st_mtime, _window_since())
    except OSError:
        return _window_since()


NOW_BAND = 12                # turns a card keeps word for word (4 forgot mid-task, 2026-10-19); older ones fold into one line each


def _first_line(text: str, n: int = 140) -> str:
    t = " ".join(str(text or "").split())
    cut = t.split(". ")[0]
    return (cut if len(cut) <= n else cut[: n - 1] + "…")


# A LINE THAT ONLY LOOKS LIKE A TOOL CALL (2026-10-20): `forge op=status`, `work add title="x"`, `tool name=mind args={…}`. She wrote them
# as words at the end of a reply and made no call; replayed in the window they taught her to do it again (measured: native tool
# calls 1 turn in 9 with them in the history, 9 in 9 without). The log keeps them; the window does not show them.
_PROSE_CALL = re.compile(r"^[ \t]*(?:`[a-z_][a-z0-9_]*(?:[ \t]+[a-z_][a-z0-9_]*)?[ \t]+[a-z_][a-z0-9_]*=[^`\n]*`|`?[a-z_][a-z0-9_]*\([a-z_][a-z0-9_]*=[^\n]*\)`?)[ \t]*$\n?", re.M)
_CARRY_ON = re.compile(r"\]\s*(continue|go on|keep going|carry on|proceed|resume|try again|do it|yes|finish it)\W*$", re.I)


def _step_gist(s: dict) -> str:
    a = s.get("args") if isinstance(s.get("args"), dict) else {}
    arg = a.get("cmd") or a.get("query") or a.get("text") or " ".join(f"{k}={v}" for k, v in list(a.items())[:3])
    arg = " ".join(str(arg or "").split())[:110]
    return f"{s.get('tool')}{' `' + arg + '`' if arg else ''}{'' if s.get('ok', True) else ' (failed: ' + ' '.join(str(s.get('text') or '').split())[:80] + ')'}"


_RECORD_ECHO = re.compile(r"\s*\(record of this turn, not your words.*\Z", re.S)      # she copied an annotation of mine into her replies (2026-10-20); it never rides


def _tidy(turns: list[dict]) -> list[dict]:
    """WHAT RIDES IS WHAT HAPPENED (2026-10-20, the owner: "it remembers what we talked about but not what it did 30 min ago"):
    · a turn that ran tools carries a record of them after her words, so the window holds the work and not only the talk;
    · an empty reply is dropped with its question, and a run of "continue" keeps only the newest — 64 of them used to push every
      real turn out of a 10-turn window."""
    out: list[dict] = []
    for i, t in enumerate(turns):
        c = str(t.get("content") or "")
        if t["role"] == "assistant":
            c = _RECORD_ECHO.sub("", c)
            if not c.strip():
                if out and out[-1]["role"] == "user":
                    out.pop()
                continue
            c = _PROSE_CALL.sub("", c).rstrip() or c
            # WHAT SHE RAN DOES NOT RIDE AS HER WORDS (2026-10-20, measured: a "(record of this turn … ran: …)" line appended here was copied
            # into her next reply): the steps reach her in the turn's own <did> block (brief.ledger), not in her history
            out.append({**t, "content": c})
        else:
            if _CARRY_ON.search(c) and out and out[-1]["role"] == "user" and _CARRY_ON.search(str(out[-1].get("content") or "")):
                out.pop()
            out.append(t)
    return out


def minutes_since_work() -> float:
    """Minutes since the last turn that ran a tool (999 when none): a short line right after work is a continuation."""
    with _lock:
        _load()
        for t in reversed(_turns):
            if t["role"] == "assistant" and t.get("steps"):
                return (time.time() - t.get("t", 0)) / 60
    return 999.0


def work_lines(minutes: float = 90, limit: int = 12) -> list[str]:
    """The tool steps of the last `minutes`, oldest first, one line each with the clock time: the 'did' block."""
    now, out = time.time(), []
    with _lock:
        _load()
        for t in _turns:
            if t["role"] != "assistant" or now - t.get("t", 0) > minutes * 60:
                continue
            for s in t.get("steps") or []:
                if s.get("kind") == "tool":
                    out.append(f"{time.strftime('%H:%M', time.localtime(t.get('t', 0)))} {_step_gist(s)}")
    return out[-limit:]


LEAKED_THOUGHT = re.compile(r"^(?:Thinking Process:|Here'?s a thinking process|\*\*Thinking Process)", re.I)


def _not_his(t: dict) -> bool:
    """A turn that is not the owner's conversation: the foreman's own (its presses, Lacuna's standing task) or a test's (law 8)."""
    s = str(t.get("session") or "")
    return s == "foreman" or s.startswith("foreman:") or s.startswith("eval:")


def recent(n: int = RECENT, card: str | None = None) -> list[dict]:
    """The last n turns as chat messages (user/assistant), oldest first — what rides in the prompt. Turns said in
    an earlier voice (before the prompt last changed) do not ride; see voice_since().

    A CARD HAS ITS OWN WINDOW (the owner, 2026-10-18: "when I go to exam and I'm talking about why did it fail, it
    shouldn't be trying to remember what we were talking about with the weather … when I go back to chat, it should have
    all the context"): from inside a card, only that card's turns ride (session card:<id>); from Chat, all of them."""
    since = voice_since()
    with _lock:
        _load()
        # A CARD KEEPS THE CONVERSATION TOO (the owner, 2026-10-19: "it loses local context BIG TIME like it was just born" —
        # measured: from the desk's talk line the brain got 2 turns, from Agents 4, from Chat 46). A card's window is its
        # own turns AND the whole conversation's last RECENT turns, in time order — never the card's alone.
        if card:
            mine = [t for t in _turns if t.get("session") == f"card:{card}"]
            # never the foreman's own turns or a test's (2026-10-27: "hello" from the E4B's card was answered as the foreman's standing
            # task, "Stop reading… work add", because the foreman's press turn rode in the card's window)
            rest = [t for t in _turns[-RECENT:] if t.get("session") != f"card:{card}" and not _not_his(t)]
            pool = sorted(mine + rest, key=lambda t: t.get("t", 0))
        else:
            pool = [t for t in _turns if not _not_his(t)]
        pool = _tidy(pool)           # before the window is cut, so empty turns and repeats never count against its size
        # THE WINDOW MOVES IN BLOCKS (E1): its start only steps every n turns, so between steps each turn APPENDS to what
        # the brain has cached instead of shifting it (a window that slid one turn at a time re-read the history each turn)
        start = max(0, len(pool) - 2 * n)
        start -= start % max(1, n)
        tail = [t for t in pool[start:] if t.get("t", 0) >= since]
    # CANNED LINES DO NOT RIDE (2026-10-19): "Done — see the desk" and the retraction "I did not take any action. I misspoke"
    # were written by code, not by her, and she read them back as her own and looped on them. They and the question they
    # answered are left out of what she is handed (the conversation file keeps them).
    canned = re.compile(r"^(Done — see the desk|I did not take any action\.? I misspoke|Done — )", re.I)
    # AND NEITHER DOES A CLAIM WITH NO CALL (2026-10-21): the tool-calls skill measured native calls in 1 turn of 9 when the
    # history showed prose calls, 9 of 9 when it did not — she learns the narration from her own last turns. A turn that says
    # it started/stopped/queued something but carries no tool step is left out, with the question it answered.
    claimed = re.compile(r"\b(?:Nothing runs\b|I(?:'ve| have)?\s+(?:started|stopped|killed|restarted|queued|added|filed|began|"
                         r"launched|ran|trained)\b)", re.I)

    def _poison(t: dict) -> bool:
        if t.get("role") != "assistant":
            return False
        body = str(t.get("content") or "").strip()
        if canned.match(body):
            return True
        if LEAKED_THOUGHT.match(body):   # a thought that leaked into the words (the LME front's prefill bug, fixed 2026-10-27) never rides
            return True
        if not claimed.search(body):
            return False
        return not any(isinstance(s, dict) and s.get("kind") in ("tool", "call") for s in (t.get("steps") or []))

    clean, i = [], 0
    while i < len(tail):
        if _poison(tail[i]):
            if clean and clean[-1]["role"] == "user":
                clean.pop()
            i += 1
            continue
        clean.append(tail[i]); i += 1
    tail = clean
    if tail and tail[0]["role"] == "assistant":
        tail = tail[1:]
    if not card or len(tail) <= NOW_BAND:
        return [{"role": t["role"], "content": t["content"]} for t in tail]
    # BANDS (CORTEX-ENGINEERING §25.9, the roll-up C5): in a card, the last NOW_BAND turns ride word for word; the ones
    # before ride as one line each with their time — the link back is the time, and the graph cortex holds the rest
    older, now = tail[:-NOW_BAND], tail[-NOW_BAND:]
    lines = [f"{time.strftime('%H:%M', time.localtime(t.get('t', 0)))} {'you' if t['role'] == 'user' else 'Lacuna'}: "
             f"{_first_line(t['content'])}" for t in older]
    band = {"role": "user", "content": "(EARLIER IN THIS CARD, one line each — ask to open one if it matters:\n" + "\n".join(lines) + ")"}
    rest = [{"role": t["role"], "content": t["content"]} for t in now]
    if rest and rest[0]["role"] == "user":
        rest[0] = {"role": "user", "content": band["content"] + "\n\n" + rest[0]["content"]}
        return rest
    return [band, {"role": "assistant", "content": "Noted."}] + rest


def page(before: float | None = None, limit: int = 30) -> dict:
    """A page of the conversation for the screen, newest last: the `limit` turns before `before` (a turn's time), and
    whether there are older ones — the phone loads the last page and asks for earlier pages as he scrolls up."""
    with _lock:
        _load()
        turns = [t for t in _turns if before is None or t.get("t", 0) < before]
    take = turns[-limit:]
    return {"turns": [{"t": t.get("t"), "role": t["role"], "content": t["content"], "who": t.get("who", ""),
                       **({"steps": t["steps"]} if t.get("steps") else {})} for t in take],
            "more": len(turns) > len(take)}


def needs_journal(n: int = RECENT) -> list[dict]:
    """Turns that have fallen out of the window and are not yet in the journal (marked by `journaled`)."""
    with _lock:
        _load()
        if len(_turns) <= 2 * n:
            return []
        old = _turns[:-(2 * n)]
    return [t for t in old if not t.get("journaled")]


def mark_journaled(upto_t: float):
    with _lock:
        for t in _turns:
            if t.get("t", 0) <= upto_t:
                t["journaled"] = True


def journal_add(note: str, who: str = "lacuna"):
    note = re.sub(r"\s+", " ", (note or "")).strip()[:600]
    if not note:
        return
    try:
        JOURNAL.parent.mkdir(parents=True, exist_ok=True)
        with open(JOURNAL, "a") as f:
            f.write(f"- {time.strftime('%Y-%m-%d %H:%M')} · {note}\n")
    except OSError:
        pass
    audit(who, "journal.note", note=note[:200])


def journal_tail(n: int = JOURNAL_NOTES) -> str:
    if not JOURNAL.exists():
        return ""
    try:
        lines = [l for l in JOURNAL.read_text().splitlines() if l.startswith("- ")]
    except OSError:
        return ""
    return "\n".join(lines[-n:])


def all_turns() -> list[dict]:
    """Every turn on disk (the door's RAG walk, rag-index.mjs, reads the same file)."""
    with _lock:
        _load()
        return list(_turns)


def journal_lines() -> list[str]:
    try:
        return [ln for ln in JOURNAL.read_text().splitlines() if ln.startswith("- ")]
    except OSError:
        return []


def recall(query: str, limit: int = 12) -> dict:
    """The turns and journal notes that mention the words of `query` (all of them, any order), newest first."""
    words = [w for w in re.findall(r"[a-z0-9][a-z0-9.\-_]{1,}", (query or "").lower()) if len(w) > 2][:8]
    if not words:
        return {"ok": False, "why": "give me a word or two to look for"}
    hits: list[dict] = []
    with _lock:
        _load()
        turns = list(_turns)
    for t in reversed(turns):
        low = t.get("content", "").lower()
        if all(w in low for w in words):
            hits.append({"when": time.strftime("%Y-%m-%d %H:%M", time.localtime(t.get("t", 0))), "who": t.get("who") or t["role"], "said": t["content"][:400]})
            if len(hits) >= limit:
                break
    notes = []
    if JOURNAL.exists():
        try:
            for l in reversed(JOURNAL.read_text().splitlines()):
                if l.startswith("- ") and all(w in l.lower() for w in words):
                    notes.append(l[2:][:300])
                    if len(notes) >= 6:
                        break
        except OSError:
            pass
    meaning = []
    try:                                     # and by MEANING, over every manual, doc, skill, note and turn (rag.py)
        from . import rag
        meaning = [{"from": f"{h['title']} ({h['loc']})", "score": h["score"], "text": h["text"][:500]} for h in rag.search(query, k=5)]
    except Exception:  # noqa: BLE001
        pass
    return {"ok": True, "query": query, "turns": hits, "journal": notes, "by_meaning": meaning,
            "note": "" if hits or notes or meaning else "nothing in the conversation, the journal or the records is about that"}


def forget_all(who: str):
    """His hand only: the conversation and the journal, gone (the audit keeps its own record)."""
    with _lock:
        _turns.clear()
        for p in (CONVERSATION, JOURNAL):
            try:
                p.unlink()
            except OSError:
                pass
    audit(who, "memory.cleared")
