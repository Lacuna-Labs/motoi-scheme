"""SELF.slat — Lacuna opens its eyes (LACUNA-1.3-DESIGN §37.3, B49).

At start (and at most every ten minutes after, when the chat builds a prompt) Lacuna writes ~/lacuna-world/SELF.slat
from the LIVE system, never from memory: what carts are and which it has, its Scheme and slat and where the grammars
live, its agents' verbs, its minds' tiers, its hands, what is running, what the last runs say, its limits and its laws.
The file is the head of the chat's system prompt, so it knows its powers from its first thought.

Every form names its source, so a wrong line can be traced to the file or reader that said it. The whole stays under
~3,000 tokens (MAX_CHARS): it is read on every question, and Ollama cuts an overflowing prompt from the top.
"""
from __future__ import annotations

import fcntl
import json
import urllib.request
import os
import re
import shutil
import threading
import time
from pathlib import Path

from . import artifacts, hands

HOME = Path.home()
REPO = Path(__file__).resolve().parents[3]                      # ~/code/lacuna
VERBS = REPO / "lacuna-foreman" / "verbs.json"
GRAMMARS = HOME / "code" / "sakura-scheme" / "grammar"
LANE_LOCK = HOME / "lacuna-world" / "locks" / "brain-bg.lock"   # the jail's lane.py: one background brain call at a time
MAX_CHARS = 11_000                                              # ~3,000 tokens at ~3.7 characters a token
REFRESH_S = 600
DISK_STOP = 0.05                                                # downloads stop below this (diskguard.THRESHOLD)
_LOCK = threading.Lock()

LAWS = [
    "Every change to a repo, a shop or the customer's side ends on a permission card; the owner's yes runs it, never mine.",
    "Below 5% free disk, downloads stop (diskguard); I clean only what I made, and list the rest for the owner.",
    "I never touch QA, the iPad or the customer's data; QA and the customer's side are proposed (petition), never done.",
    "Workers have no file, shell or socket verb: reads go through hands, changes through ask.",
    "Leases: what one cart holds, another waits for; I never share what another holds.",
    "Every run leaves its artifact (artifacts/<cart>/<run>.slat); I read INDEX.slat first to know what happened while away.",
]


def path() -> Path:
    return Path(os.environ.get("LACUNA_SELF", HOME / "lacuna-world" / "SELF.slat"))


def carts_dir() -> Path:
    return Path(os.environ.get("LACUNA_CARTS", HOME / "lacuna-world" / "carts"))


def tiers_file() -> Path:
    return Path(os.environ.get("LACUNA_TIERS", HOME / "lacuna-world" / "bench" / "agents" / "tiers.json"))


def _form(kind: str, fields: dict) -> str:
    return artifacts._jail().form(kind, fields)       # protocol.py's serializer: one slat line


def _short(p: Path) -> str:
    return str(p).replace(str(HOME), "~", 1)


# ── the sections, each from its live source ────────────────────────────────────────────────────────────────────

def carts() -> list[str]:
    d = carts_dir()
    rows = []
    for f in sorted(d.glob("*.sks")) if d.is_dir() else []:
        try:
            head = f.read_text(errors="replace")[:4000]
        except OSError:
            continue
        name = re.search(r"\(lacuna-cart\s+'([\w-]+)", head)
        does = re.search(r'\(does\s*\.\s*"([^"]*)"', head)
        done = re.search(r'\(done\s*\.\s*"([^"]*)"', head)
        rows.append(_form("cart", {"name": name.group(1) if name else f.stem, "does": (does.group(1) if does else "")[:160],
                                   "done": (done.group(1) if done else "")[:120]}))
    lines = [_form("carts", {"source": _short(d) + "/*.sks", "count": len(rows),
                             "are": "A cart is one Scheme file the 26B writes once and the owner approves once: a header "
                                    "(agents, minds, judgment points, done-condition) and a body of foreman verbs. It runs "
                                    "with no brain in the loop except at its judgment points, and leaves an artifact."})]
    return lines + rows[:20]


def scheme() -> list[str]:
    gram = sorted(p.name for p in GRAMMARS.glob("*.gbnf")) if GRAMMARS.is_dir() else []
    return [_form("scheme", {"source": _short(GRAMMARS), "is": "Lacuna Scheme = the Sakura Scheme core (~/code/sakura-scheme, "
                             "a library, never a copy) + the foreman's verbs", "slat": "line-oriented S-expression data: one "
                             "form per line; briefs, reports, artifacts and this file are slat", "grammars": gram,
                             "slat_grammar": _short(GRAMMARS / "slat-line.gbnf"),
                             "packed": "zstd is our format for text at rest: the Motoi and Sakura corpora (~/motoi-corpus, "
                             "~/.forge, ~/fold-snapshots) are FILE.zst, each listed in that folder's ZPACK.slat; read lines with "
                             "the read-zst hand, or zstd -dc --long=27 FILE.zst | head"})]


def verbs() -> list[str]:
    try:
        rows = json.loads(VERBS.read_text()).get("verbs") or []
    except (OSError, ValueError):
        return [_form("verbs", {"source": _short(VERBS), "unread": "verbs.json did not read"})]
    by: dict = {}
    for v in rows:
        by.setdefault(str(v.get("tier") or "?"), []).append(str(v.get("name")))
    return [_form("verbs", {"source": _short(VERBS), "count": len(rows), **{f"tier_{t}": names for t, names in sorted(by.items())}})]


BOX_MINDS = HOME / "code" / "lacuna" / "lacuna-box" / "brain" / "box-minds.json"


def box_minds() -> list[str]:
    """Which small Gemmas may be an agent's mind on this box: configuration, never a guess (the owner, 2026-10-18)."""
    try:
        p = json.loads(BOX_MINDS.read_text())
    except (OSError, ValueError):
        return []
    live = {}
    try:                                                   # the budget is computed by the gateway from the box itself
        with urllib.request.urlopen("http://127.0.0.1:11434/lacuna/minds", timeout=3) as r:
            live = json.load(r)
    except (OSError, ValueError):
        pass
    return [_form("box-minds", {"source": _short(BOX_MINDS) + " + the gateway's /lacuna/minds", "box": p.get("box"),
                                "cap_b": p.get("max_params_b"), "may_use": p.get("agent_minds"),
                                "workhorse": p.get("workhorse"), "never": p.get("reserved"),
                                "budget_gb": live.get("budget_gb"), "weights_gb": live.get("weights_gb"),
                                "in_use_gb": live.get("in_use_gb"),
                                "you_choose": "pick the mix of minds for a job within budget_gb (e.g. two tiny + a 1B, "
                                              "or an E2B and a tiny); the gateway only refuses what does not fit"})]


def minds() -> list[str]:
    f = tiers_file()
    try:
        t = json.loads(f.read_text())
    except (OSError, ValueError):
        return [_form("minds", {"source": _short(f), "tiers": "benching", "say": "no tier table yet; the 26B does the "
                                "thinking, small minds get a job only where their bench holds"})]
    text = json.dumps(t, ensure_ascii=False, separators=(",", ":"))
    return [_form("minds", {"source": _short(f), "tiers": text[:1200]})]


def hands_line() -> list[str]:
    return [_form("hands", {"source": "lacuna_api/control/hands.py OPS", "ops": sorted(hands.OPS),
                            "logs": sorted(hands.LOGS), "senses": "none running yet (eye and ear are B44)"})]


def _foreman_workers() -> list[dict]:
    from . import foreman
    r = foreman.call("GET", "/workers", timeout=2)
    if not r.get("ok", True) and "workers" not in r:
        return [{"name": "(the foreman did not answer)", "state": r.get("why", "")}]
    return r.get("workers") or []


def _job_workers() -> list[dict]:
    from .home import _foreman          # the desk's own reader of the jail's foreman.py
    return _foreman().workers(False)


def running() -> list[str]:
    fw, jw = [], []
    if os.environ.get("LACUNA_SELF_LIVE") == "0":      # the tests: no reach into the live foreman or the real jobs
        return [_form("running", {"source": "not read (LACUNA_SELF_LIVE=0)", "foreman_workers": [], "job_workers": []})]
    try:
        fw = [f"{w.get('name')} {w.get('state')}" for w in _foreman_workers()][:12]
    except Exception as e:  # noqa: BLE001 — a reader that fails is said, never fatal to the prompt
        fw = [f"(unread: {type(e).__name__})"]
    try:
        live = ("spawned", "briefed", "executing", "reporting")         # a crashed one is said by its artifact instead
        jw = [f"{w.get('id')} {w.get('state')}" for w in _job_workers() if w.get("state") in live][:12]
    except Exception as e:  # noqa: BLE001
        jw = [f"(unread: {type(e).__name__})"]
    return [_form("running", {"source": "foreman :1139 /workers + ~/lacuna-world/jobs (jail foreman.py)",
                              "foreman_workers": fw, "job_workers": jw})]


def runs() -> list[str]:
    try:
        lines = artifacts.index_lines(8)
    except Exception:  # noqa: BLE001
        lines = []
    return [_form("runs", {"source": _short(artifacts.root() / "INDEX.slat"), "count": len(lines),
                           "read": "the latest run per cart, newest first; `runs` reads one in full"})] + lines


def _lane() -> str:
    try:
        with open(LANE_LOCK, "a+") as f:
            try:
                fcntl.flock(f, fcntl.LOCK_EX | fcntl.LOCK_NB)
            except BlockingIOError:
                return "held"
            fcntl.flock(f, fcntl.LOCK_UN)
            return "free"
    except OSError:
        return "unknown"


def limits() -> list[str]:
    from . import health
    u = shutil.disk_usage("/System/Volumes/Data" if os.path.exists("/System/Volumes/Data") else "/")
    pct = round(100 * u.free / u.total, 1)
    try:
        mem = health.memory()
    except Exception:  # noqa: BLE001
        mem = {}
    return [_form("limits", {"source": "disk_usage · vm_stat (health.memory) · " + _short(LANE_LOCK),
                             "disk_total_gb": round(u.total / 1e9), "disk_free_gb": round(u.free / 1e9, 1), "disk_free_pct": pct,
                             "downloads": ("STOPPED (under 5% free)" if u.free / u.total < DISK_STOP else
                                           f"allowed — they stop only under 5% free (~{round(u.total * DISK_STOP / 1e9)} GB); now {pct}%"),
                             "disk_note": "read this minute; an older 'downloads stopped' in memory is from when the disk was at 2.8%",
                             "memory_available_gb": mem.get("available_gb"), "memory_pressure": mem.get("pressure"),
                             "brain_lane": _lane(), "brain_lane_is": "one background brain call at a time; the "
                             "person's conversation always has the other slot"})]


def laws() -> list[str]:
    return [_form("laws", {"source": "LACUNA-1.3-DESIGN §32, §37.3; diskguard.py", "are": LAWS})]


def battery() -> list[str]:
    """C1: the newest True State battery RUN itself — its reds and which acts are red — so an answer never quotes a
    cart's older summary of it (battery-shepherd said 14–17 reds while the run had 21)"""
    from . import battery_view
    rs = [r for r in battery_view.runs(5).get("runs", []) if not r.get("cut")]
    if not rs:
        return [_form("battery", {"newest-run": "none", "source": str(battery_view.ROOT), "unread": "no True State battery run on disk; the next battery run writes one"})]   # an honest null names its source (desk laws 5.2)
    r = rs[0]
    red = [k for k, v in (r.get("acts") or {}).items() if v == "red"]
    return [_form("battery", {"newest-run": r["run"], "state": "running" if r.get("live") else "passed" if r.get("pass") else "red",
                              "reds": r.get("reds"), "red-acts": red, "source": "the run's own record (not a cart's summary)"})]


def waiting() -> list[str]:
    """the cards waiting on the owner's press, read now from the petitions themselves — never from memory (the soak,
    2026-10-19: asked "which cards wait", Lacuna named a card from yesterday's journal that was no longer waiting)"""
    from . import chat
    w = [p for p in chat.petitions() if p.get("state") == "waiting"]
    return [_form("waiting", {"count": len(w), "cards": [f"{p['id']} {p['action']}: {str(p.get('reason') or '')[:80]}" for p in w[:8]],
                              "source": "the petitions, this minute"})]


def claude_tasks() -> list[str]:
    """the tasks Claude left (~/lacuna-world/tasks/from-claude.json), each with its state, read now — not from memory"""
    from . import claude_tasks as _ct
    d = _ct.tasks()
    return [_form("claude-tasks", {"given-by": "Claude", "left": d["left"], "source": "~/lacuna-world/tasks/from-claude.json",
                                   "tasks": [f"{t['id']} {t['state']}: {t['title']}" for t in d["tasks"]],
                                   "how": "start one with start_claude_task when the owner says so; it shows on the Agents screen",
                                   "note": "these ten ARE the tasks Claude left; answer from this list — an older plan in memory (the Forge) is not one of them"})]


SECTIONS = (("carts", carts), ("scheme", scheme), ("verbs", verbs), ("minds", minds), ("hands", hands_line),
            ("box-minds", box_minds), ("running", running), ("runs", runs), ("limits", limits), ("battery", battery), ("waiting", waiting), ("claude-tasks", claude_tasks), ("laws", laws))


# G3 (Sprint 2, measured 2026-10-19): the head is the brain's cached prefix, so it carries only what changes when the
# system changes (carts, verbs, hands, laws) — never a clock. A `written` stamp and the live numbers at character 0 made
# every first question after ten quiet minutes re-read ~13k tokens (29 s). The live sections ride at the turn's tail.
LIVE = ("box-minds", "running", "runs", "limits", "battery", "waiting", "claude-tasks")


def live(only: set | None = None) -> str:
    """What runs and what is left, read now — for the tail of a turn, never the head. `only` picks the sections."""
    out = []
    for name, fn in SECTIONS:
        if name in LIVE and (only is None or name in only):
            try:
                out += fn()
            except Exception as e:  # noqa: BLE001
                out.append(_form(name, {"unread": f"{type(e).__name__}: {e}"[:200]}))
    return "\n".join(out)


def build() -> str:
    out = [_form("self", {"name": "Lacuna", "source": "the live system",
                          "is": "This is me: what I am and what I have. What runs now and what is left ride with each question (NOW).",
                          "sections": [n for n, _ in SECTIONS if n not in LIVE]})]
    for name, fn in SECTIONS:
        if name in LIVE:
            continue
        try:
            out += fn()
        except Exception as e:  # noqa: BLE001 — one unreadable source leaves a line that says so, not a missing head
            out.append(_form(name, {"unread": f"{type(e).__name__}: {e}"[:200]}))
    text = ""
    for ln in out:                                       # the bound: whole lines only, the laws never cut
        if len(text) + len(ln) + 1 > MAX_CHARS and not ln.startswith("(laws"):
            continue
        text += ln + "\n"
    return text


def write() -> str:
    text = build()
    p = path()
    p.parent.mkdir(parents=True, exist_ok=True)
    tmp = p.with_name(p.name + f".{os.getpid()}.tmp")
    tmp.write_text(text)
    os.replace(tmp, p)
    return text


def head(max_age: float = REFRESH_S) -> str:
    """SELF.slat's text for the prompt: rewritten when older than ten minutes, else read as it is."""
    p = path()
    with _LOCK:
        try:
            if p.exists() and time.time() - p.stat().st_mtime < max_age:
                return p.read_text()
            if p.exists():                                   # unchanged text is not rewritten: the head's bytes stay put
                fresh = build()
                if fresh == p.read_text():
                    os.utime(p)
                    return fresh
            return write()
        except Exception:  # noqa: BLE001 — the prompt goes on without its head rather than fail the turn
            try:
                return p.read_text()
            except OSError:
                return ""


def start() -> None:
    """At API start: written in the background, so a slow foreman never holds the port."""
    threading.Thread(target=lambda: head(max_age=0), daemon=True, name="self-portrait").start()
