"""RAG — what Lacuna's notes and manuals say, found by MEANING, riding with the question (his, 2026-09-26: "let it also
have RAG and make it efficient and good").

What it is. Every manual Lacuna works from (docs.DOCS), every engineering document in the Curator set, its journal and
its whole conversation are cut into chunks, embedded once with nomic-embed-text on the box's own Ollama, and kept on disk
under ~/.lacuna/rag. A question is embedded the same way and the nearest chunks ride at the tail of the user's turn —
never the head: Ollama reuses its work on an unchanged prompt head, and a changing head would cost a full re-read of
the instructions and every tool schema on every question.

Why it is efficient (measured 2026-09-26 on the Studio):
  · nomic embeds 64 chunks in 1.08 s and one query in 25 ms; ~8,000 chunks index in about two minutes, once —
    a chunk is embedded once per (source, text) hash and re-used until the text changes;
  · the scan is `math.sumprod` over `array('f')` vectors: 8,000 × 768 in 81 ms, no numpy, no index server;
  · the vectors are unit length, so a dot product IS the cosine; a keyword touch (+0.03 per query word found in the
    chunk, capped) breaks ties toward the chunk that names what he named;
  · nothing rides for a greeting or an order (chat.py asks only for a question or an opinion), and never more than
    RIDE_CHARS of it;
  · the index is written by the door's walk, lacuna-node/frontend/rag-index.mjs (2026-11-06, finale order §3.12: the cut,
    the identities, the turns, the tombstones and the cluster cache moved to Node); this module reads it, and reads it
    again within REFRESH_S of the walk changing it.

THE CARDS' AREAS (LACUNA-CARDS-2.0 §8.3, lane W2, 2026-10-24): one kind per card, `card/<id>`. Every row of a card's
`cards/<folder>/glossary.slat` is one chunk, and every `(card-record …)` line the Node writer (lacuna-node/frontend/
cortex-areas.mjs) keeps under ~/.lacuna/cortex-areas/<id>.slat is one chunk, so the whole cortex holds what the drawer's
area holds. `search(card=…)` reads that card's kind first, then the rest.

What rides is marked as information, with its source, so the model cites "the SRE manual" or "your journal, 24 Sep"
rather than presenting it as its own memory. Nothing here decides anything; a search that cannot run returns nothing
and the model answers from its tools, as before.
"""
from __future__ import annotations

import base64
import hashlib
import json
import math
import os
import re
import struct
import threading
import time
import urllib.request
from array import array
from pathlib import Path

from .core import LACUNA_HOME, REPO, audit

try:                                   # P5 (2026-10-23): recall by meaning was 4 s in pure Python; one matmul is ~20 ms
    import numpy as _np
except ImportError:                    # the pure path stays as the fallback
    _np = None
_mat: dict = {"n": -1, "c": None, "v": None}   # the chunk vectors as matrices, rebuilt when the chunk count changes

OLLAMA = os.environ.get("LACUNA_OLLAMA", "http://127.0.0.1:11434")


def _embed_setting() -> str:
    """ONE embedder for Lacuna (~/.lacuna/embed.json, the same file the graph cortex reads): EmbeddingGemma since
    2026-10-18 (the owner: "I want all of the Google features"). Measured on our own chunks that night: MRR 0.80 at 768
    and 0.845 at 256, against nomic's 0.745."""
    try:
        return json.loads((LACUNA_HOME / "embed.json").read_text()).get("model") or "embeddinggemma"
    except (OSError, ValueError):
        return os.environ.get("LACUNA_EMBED_MODEL", "embeddinggemma")


EMBED_MODEL = _embed_setting()
RAG_DIR = LACUNA_HOME / "rag"
# one file per embedder: vectors of two models never share an index (a switch starts a fresh one; the old stays on disk)
EMBED_SPACE = f"{EMBED_MODEL.replace(':', '-')}-768"   # O-51: every new vector row names its embedding space; old rows gain it at the next rebuild
VECTORS = RAG_DIR / ("vectors.jsonl" if EMBED_MODEL == "nomic-embed-text" else f"vectors-{EMBED_MODEL.replace(':', '-')}.jsonl")
GONE = VECTORS.with_suffix(".gone")   # one tombstoned hash per line (D9)

# P5 (2026-10-25): nothing the cortex stores holds a token (law 7). The same shapes as lacuna-node/mind/redact.mjs: a token=
# value, a Bearer header, a vendor key prefix, a long run that mixes digits and both cases; a slug or a hash is not a key.
_SECRET = re.compile(r"(token=)([A-Za-z0-9_\-.]{16,})|(Bearer\s+)([A-Za-z0-9_\-.]{12,})|\b((?:sk|pk|rk)_(?:live|test)_[A-Za-z0-9]{12,}|ghp_[A-Za-z0-9]{20,}|xox[abp]-[A-Za-z0-9-]{20,})\b|\b([A-Za-z0-9_-]{40,})\b")


def _redact(text: str) -> tuple[str, int]:
    n = 0

    def one(m):
        nonlocal n
        run = m.group(6)
        if run and (sum(c.isdigit() for c in run) < 6 or sum(c.isupper() for c in run) < 4 or sum(c.islower() for c in run) < 4):
            return m.group(0)
        n += 1
        return (m.group(1) or m.group(3) or "") + "[redacted]"
    return _SECRET.sub(one, text or ""), n
COARSE = 256               # Matryoshka: EmbeddingGemma's first 256 dims are a vector of their own — search there first
RERANK = 64                # then the best 64 again at the full 768
# M3 (2026-10-25, the memory stream's recency): a hit's score gains up to RECENCY_W, halving every HALF_LIFE_D days; an ask
# that names a day ("yesterday", "today") brings that day's talk into the pool and puts it first (M0: "what did I ask you
# yesterday?" brought rows from six days back; a July list outranked today's decision)
RECENCY_W = 0.05
HALF_LIFE_D = 7.0
DAY_W = 0.25
CHUNK_CHARS = 900          # about 220 tokens: a paragraph or two, one idea
TOP_K = 10                 # more of what it knows rides (2026-10-19: 5 hits, 1,700 chars was a keyhole)
RIDE_CHARS = 7_000         # the most that rides with one question (the 26B has 65k of context)
MIN_SCORE = 0.48           # below this a chunk is noise (nomic cosine: related text ≈ 0.55–0.75, unrelated ≈ 0.3–0.45)
REFRESH_S = 300            # how often the search reads the index again when the Node walk has changed it
DOC_GLOB = REPO / "docs" / "eng"

_lock = threading.Lock()
_chunks: list[dict] = []           # {h, src, title, loc, text, v: array('f')}
_by_hash: dict[str, dict] = {}
_loaded = False
_ready = threading.Event()          # set when _load has the whole index in memory; search answers [] until then
_walker: threading.Thread | None = None
_embed = None                      # a test may set an embedder: fn(list[str]) -> list[list[float]]


# ── the embedder ───────────────────────────────────────────────────────────────────────────────────────────────────────


def _unit(v: list[float]) -> array:
    n = math.sqrt(sum(x * x for x in v)) or 1.0
    return array("f", [x / n for x in v])


def embed(texts: list[str], kind: str = "search_document") -> list[array] | None:
    """Unit vectors for `texts` (nomic wants its prefix), or None when Ollama does not answer."""
    if not texts:
        return []
    if _embed is not None:
        return [_unit(v) for v in _embed(texts)]
    if EMBED_MODEL.startswith("embeddinggemma"):
        # its own prompts (the model card, EMBEDDINGGEMMA manual §2.2: `task: search result | query: ` for a question, measured
        # neutral against `task: search query` on the recall set, tools/recall-eval, 2026-10-27; the card is the contract); a chunk arrives as "title: … | text: …" (the
        # caller passes it already shaped); other tasks pass their own prefix as `kind` ("task: clustering | query: ")
        pre = {"search_query": "task: search result | query: ", "search_document": ""}.get(kind, kind)
        inputs = [f"{pre}{t}" for t in texts]
    else:
        inputs = [f"{kind}: {t}" for t in texts]
    body = json.dumps({"model": EMBED_MODEL, "input": inputs, "keep_alive": "30m"}).encode()
    req = urllib.request.Request(f"{OLLAMA}/api/embed", data=body, headers={"Content-Type": "application/json"})
    try:
        with urllib.request.urlopen(req, timeout=120) as r:
            out = json.load(r).get("embeddings") or []
    except Exception as e:  # noqa: BLE001 — no embedder, no retrieval; the tools still answer
        audit("lacuna", "rag.embed-failed", error=e.__class__.__name__)
        return None
    return [_unit(v) for v in out] if len(out) == len(texts) else None


def _coarse(v: array) -> array:
    """the Matryoshka head: the first COARSE dims, unit length again"""
    return _unit(list(v[:COARSE]))


def _doc_text(r: dict) -> str:
    return f"title: {r.get('title') or 'none'} | text: {r['text']}" if EMBED_MODEL.startswith("embeddinggemma") else r["text"]


def _pack(v: array) -> str:
    return base64.b64encode(struct.pack(f"<{len(v)}e", *v)).decode()


def _unpack(s: str) -> array:
    raw = base64.b64decode(s)
    return array("f", struct.unpack(f"<{len(raw) // 2}e", raw))


# ── cutting ────────────────────────────────────────────────────────────────────────────────────────────────────────────


def _h(src: str, text: str) -> str:
    return hashlib.sha1(f"{src}\n{text}".encode("utf-8", "replace")).hexdigest()[:24]  # nosec B324 — a cache key


# ── the sources ────────────────────────────────────────────────────────────────────────────────────────────────────────


def sources() -> list[tuple[str, str, Path]]:
    """(source id, title, path) for every file that is indexed."""
    from . import docs
    out = [(k, t, p) for k, (t, p) in docs.DOCS.items()]
    seen = {p.resolve() for _, _, p in out if p.exists()}
    try:
        for p in sorted(DOC_GLOB.glob("*.md")):
            if p.resolve() in seen or "archived" in p.parts:
                continue
            out.append((f"eng/{p.stem}", p.stem.replace("-", " "), p))
    except OSError:
        pass
    # Lacuna's own design and its playbooks: what it is, how its carts and forge work (the owner, 2026-10-18)
    lac = Path(__file__).resolve().parents[3]
    world = Path(os.environ.get("LACUNA_WORLD") or Path.home() / "lacuna-world")
    for p in [*sorted((lac / "docs").glob("*.md")), world / "forge" / "PLAYBOOK.md", world / "SELF.slat", world / "HANDBOOK.slat",
              world / "reference" / "LACUNA-REFERENCE.slat", *sorted((world / "playbooks").glob("*.md")),
              *sorted((lac / "lacuna-box" / "pi-agent" / "skills").glob("*/SKILL.md")),
              # ITS OWN NOTES AND JOURNAL (2026-10-19: "it never knew how to do RAG over its own data"): what it writes, it can find
              *sorted((world / "notes").glob("*.md")), *sorted((world / "foreman" / "desk" / "notes").glob("*.md")),   # the desk's notes (the note verb, 2026-10-25); never notes/eval
              *sorted((world / "journal").glob("*.md"))[-30:]]:
        try:
            if p.exists() and p.resolve() not in seen:
                seen.add(p.resolve())
                key = f"skill/{p.parent.name}" if p.name == "SKILL.md" else f"lacuna/{p.stem}"
                out.append((key, p.parent.name + " skill" if p.name == "SKILL.md" else p.stem.replace("-", " "), p))
        except OSError:
            pass
    return out


def _tilde(p: Path) -> str:
    """A path the desk can read back: ~/… (2026-10-25, M0: a bare file name made the next read fail)."""
    s = str(p)
    home = str(Path.home())
    return "~" + s[len(home):] if s.startswith(home) else s


_PATHS: dict[str, str] = {}


def _full_loc(src: str, loc: str) -> str:
    """A stored row's bare `name.md:12` given its file's full path from the sources (rows indexed before the fix keep working)."""
    if "/" in loc or ":" not in loc:
        return loc
    if not _PATHS:
        try:
            _PATHS.update({k: _tilde(p) for k, _, p in sources()})
        except Exception:   # noqa: BLE001 — a loc stays as it was rather than fail a search
            return loc
    name, _, ln = loc.rpartition(":")
    full = _PATHS.get(src)
    return f"{full}:{ln}" if full and full.endswith("/" + name) else loc


# ── the index on disk ──────────────────────────────────────────────────────────────────────────────────────────────────


def _load():
    """Loads the index once. Heavy (minutes, GB): never on the request thread — `warm()` runs it in a daemon thread at boot
    (2026-10-23: a first recall after a restart wedged the API for minutes; the desk went dark behind the door)."""
    try:
        _load_sync()
    finally:
        _ready.set()


def warm() -> None:
    """Starts the index load in the background (idempotent)."""
    if _loaded:
        return
    threading.Thread(target=_load, name='rag-warm', daemon=True).start()


def _load_sync():
    global _loaded
    if _loaded:
        return
    _loaded = True
    if not VECTORS.exists():
        return
    tombs = _tombs()
    seen_journal: set[str] = set()
    dropped = 0
    scrubbed = 0
    try:
        # the load yields the GIL every 400 lines: without it the request loop starved for minutes behind this thread and the
        # door answered ECONNRESET (2026-10-24, measured: health 10 s+, 74% CPU)
        for i, ln in enumerate(VECTORS.read_text().splitlines()):
            if i % 400 == 0:
                time.sleep(0.003)
            try:
                rec = json.loads(ln)
                if rec.get("h") in tombs:
                    continue
                clean, k = _redact(rec.get("text", ""))
                if k:                              # P5: a token stored before the rule is scrubbed on load
                    rec["text"] = clean
                    scrubbed += k
                if rec.get("src") == "journal":    # D9: one row per journal line's words, whatever minute stamped it
                    words = re.sub(r"^\[[^\]]*\]\s*", "", rec.get("text", ""))
                    if words in seen_journal:
                        dropped += 1
                        continue
                    seen_journal.add(words)
                rec["v"] = _unpack(rec.pop("e"))
                rec["c"] = _coarse(rec["v"])
                _by_hash[rec["h"]] = rec
            except Exception:  # noqa: BLE001 — a bad line is skipped, never fatal
                continue
        _chunks[:] = list(_by_hash.values())
    except OSError:
        pass
    if dropped or scrubbed:
        audit("lacuna", "rag.load-clean", dropped=dropped, scrubbed=scrubbed, kept=len(_chunks))


def _tombs() -> set:
    """The tombstoned hashes (D9): chunks that left their file since the last rewrite."""
    try:
        return set(GONE.read_text().split())
    except OSError:
        return set()


# ── turns and notes ────────────────────────────────────────────────────────────────────────────────────────────────────


# ── the search ─────────────────────────────────────────────────────────────────────────────────────────────────────────

_WORD = re.compile(r"[a-z0-9][a-z0-9.\-_]{2,}")


_DAY = re.compile(r"\b(20\d\d-\d\d-\d\d)\b")
_MTIME: dict[str, tuple[float, float]] = {}   # src → (mtime, read at)


def _when(r: dict, now: float) -> float | None:
    """When a row was said or written, epoch seconds: a talk row's day, a document's modified time; None when unknown."""
    m = _DAY.search(str(r.get("loc") or "")) or _DAY.search(str(r.get("text") or "")[:24])
    if r.get("src") in ("conversation", "journal") and m:
        try:
            return time.mktime(time.strptime(m.group(1), "%Y-%m-%d")) + 43200
        except ValueError:
            return None
    path = _full_loc(r.get("src", ""), str(r.get("loc") or "")).rpartition(":")[0]
    if not path.startswith(("~", "/")):
        return None
    got = _MTIME.get(r["src"])
    if got and now - got[1] < 600:
        return got[0]
    try:
        mt = Path(path.replace("~", str(Path.home()), 1)).stat().st_mtime
    except OSError:
        return None
    _MTIME[r["src"]] = (mt, now)
    return mt


def recency(r: dict, now: float | None = None) -> float:
    """The recency bonus: RECENCY_W at age 0, halving every HALF_LIFE_D days; 0 when the row's time is unknown."""
    now = now or time.time()
    t = _when(r, now)
    return 0.0 if t is None else RECENCY_W * 0.5 ** (max(0.0, now - t) / 86400 / HALF_LIFE_D)


def asked_day(query: str, now: float | None = None) -> str | None:
    """The day an ask names, YYYY-MM-DD: today, yesterday, last night, this morning, or a date; None when it names none."""
    q = (query or "").lower()
    now = now or time.time()
    m = _DAY.search(q)
    if m:
        return m.group(1)
    if re.search(r"\byesterday\b|\blast night\b", q):
        return time.strftime("%Y-%m-%d", time.localtime(now - 86400))
    if re.search(r"\btoday\b|\bthis (morning|afternoon|evening)\b|\bearlier\b|\b(last|past) (day|24 hours)\b", q):
        return time.strftime("%Y-%m-%d", time.localtime(now))
    return None


def search(query: str, k: int = TOP_K, min_score: float = MIN_SCORE, sources_in: set[str] | None = None,
           card: str | None = None) -> list[dict]:
    """The chunks nearest to `query` by meaning (with a keyword touch), best first: {score, src, title, loc, text}.
    With `card` (a drawer's question, CARDS-2.0 §8.3): that card's kind `card/<id>` first (up to 4), then the rest."""
    if card:
        area = search(query, k=min(4, k), min_score=min_score, sources_in={f"card/{card.removeprefix('card/')}"})
        seen = {(h["src"], h["text"][:80]) for h in area}
        rest = [h for h in search(query, k=k, min_score=min_score, sources_in=sources_in) if (h["src"], h["text"][:80]) not in seen]
        return (area + rest)[:k]
    q = (query or "").strip()
    if not q:
        return []
    if not _ready.is_set():
        warm()                      # the index is still loading (or not asked for yet): answer nothing now, never block the loop
        return []
    qv = embed([q], kind="search_query")
    if not qv:
        return []
    qv = qv[0]
    words = {w for w in _WORD.findall(q.lower()) if len(w) > 3}
    with _lock:
        rows = list(_chunks)
    # two stages (Matryoshka): every chunk at 256 dims, then the best RERANK again at the full 768
    qc = _coarse(qv)
    pool = [r for r in rows if not sources_in or r["src"] in sources_in]
    if _np is not None and not sources_in and len(pool) > RERANK * 3 and all("c" in r for r in pool[:1]):
        # the numpy path: every chunk's coarse vector in one matrix (kept across calls), the best RERANK*3 by one product
        if _mat["n"] != len(rows):
            _mat["c"] = _np.asarray([list(r["c"]) for r in rows], dtype=_np.float32)
            _mat["n"] = len(rows)
        top = _np.argpartition(-(_mat["c"] @ _np.asarray(qc, dtype=_np.float32)), min(RERANK * 3, len(rows) - 1))[: RERANK * 3]
        pool = [rows[int(i)] for i in top]
    elif len(pool) > RERANK * 3 and all("c" in r for r in pool[:1]):
        pool = sorted(pool, key=lambda r: -math.sumprod(qc, r["c"]))[: RERANK * 3]
    day = asked_day(q)
    if day:   # an ask that names a day: that day's talk joins the pool, whatever its vector says (M3)
        have = {id(r) for r in pool}
        pool += [r for r in rows if r["src"] in ("conversation", "journal") and day in str(r.get("loc") or "")[:10] + str(r.get("text") or "")[:24]
                 and id(r) not in have][:200]
    now = time.time()
    scored: list[tuple[float, dict]] = []
    for r in pool:
        s = math.sumprod(qv, r["v"])
        notice = "foreman:press" in str(r.get("text") or "")[:60]   # a system notice is not the owner's talk (P4)
        on_day = bool(day) and not notice and r["src"] in ("conversation", "journal") and day in str(r.get("loc") or "")[:10] + str(r.get("text") or "")[:24]
        if s < min_score - 0.1 and not on_day:
            continue
        s += recency(r, now) + (DAY_W if on_day else 0.0) - (0.05 if notice else 0.0)
        if words:
            low = r["text"].lower()
            s += min(0.09, 0.03 * sum(1 for w in words if w in low))
        if s >= min_score:
            scored.append((s, r))
    scored.sort(key=lambda t: -t[0])
    out, seen = [], set()
    for s, r in scored:
        key = (r["src"], r["text"][:80])
        if key in seen:
            continue
        seen.add(key)
        out.append({"score": round(s, 3), "src": r["src"], "title": r["title"], "loc": _full_loc(r["src"], r["loc"]), "text": r["text"], "_h": r["h"][:12]})
        if len(out) >= k:
            break
    _note_recall([o.pop("_h") for o in out])
    return out


RECALLS = RAG_DIR / "recalls.jsonl"


def _note_recall(hs: list[str]) -> None:
    """B2: which memories were recalled, and when — the Cortex lights a star by how often it is read (recall_freq)."""
    if not hs:
        return
    try:
        with RECALLS.open("a") as f:
            f.write(json.dumps({"t": round(time.time()), "h": hs}) + "\n")
    except OSError:
        pass


def recall_freq(days: float = 7.0) -> dict[str, int]:
    """{chunk hash (12): times recalled in the last `days`} from the newest 20,000 recalls."""
    since = time.time() - days * 86400
    out: dict[str, int] = {}
    try:
        for ln in RECALLS.read_text().splitlines()[-20000:]:
            r = json.loads(ln)
            if r.get("t", 0) >= since:
                for h in r.get("h") or []:
                    out[h] = out.get(h, 0) + 1
    except (OSError, ValueError):
        pass
    return out


def ride(query: str, limit_chars: int = RIDE_CHARS) -> str:
    """What rides with a question: the best chunks, each headed by its source, within `limit_chars`; '' for none."""
    parts, used = [], 0
    for h in search(query):
        text = h["text"].strip()
        room = limit_chars - used - 40
        if room < 200:
            break
        if len(text) > room:
            text = text[:room].rsplit(" ", 1)[0] + " …"
        parts.append(f"— {h['title']} ({h['loc']}):\n{text}")
        used += len(text) + 40
    return "\n\n".join(parts)


def stats() -> dict:
    _load()
    with _lock:
        by = {}
        for r in _chunks:
            by[r["src"]] = by.get(r["src"], 0) + 1
        return {"indexed": len(_chunks), "sources": len(by), "file": str(VECTORS), "model": EMBED_MODEL}


# ── the walk ───────────────────────────────────────────────────────────────────────────────────────────────────────────


_seen_mtime = [0.0]


def _reload() -> None:
    """Reads the index again (the Node walk appended or compacted it)."""
    global _loaded
    with _lock:
        _by_hash.clear()
        _loaded = False
    _seen_mtime[0] = VECTORS.stat().st_mtime
    _load_sync()


def start() -> bool:
    """Read the index at boot and again when the Node walk changed it; the reference manual hourly (idempotent;
    LACUNA_NO_WORKERS=1 keeps tests quiet). The index is written by lacuna-node/frontend/rag-index.mjs (finale §3.12)."""
    global _walker
    if os.environ.get("LACUNA_NO_WORKERS") == "1" or (_walker is not None and _walker.is_alive()):
        return False

    def loop():
        # THE INDEX IS READ AT BOOT, NOT BY HIS FIRST QUESTION (2026-10-20, measured: 278k vectors, 19 s in pure Python, paid by the
        # owner's first real ask after every API restart — and a stop pressed then waited for it)
        try:
            _load()
        except Exception as e:  # noqa: BLE001
            audit("lacuna", "rag.load-failed", error=e.__class__.__name__)
        time.sleep(20)                          # boot first; the first question can still search what is on disk
        n = 0
        while True:
            if n % 12 == 0:                     # the reference manual is the system talking about itself: hourly
                try:
                    from . import reference
                    reference.write()
                except Exception as e:  # noqa: BLE001
                    audit("lacuna", "reference.write-failed", error=e.__class__.__name__)
            n += 1
            try:
                if VECTORS.exists() and VECTORS.stat().st_mtime > _seen_mtime[0]:
                    _reload()
            except Exception as e:  # noqa: BLE001
                audit("lacuna", "rag.reload-failed", error=e.__class__.__name__)
            time.sleep(REFRESH_S)

    _walker = threading.Thread(target=loop, name="lacuna-rag", daemon=True)
    _walker.start()
    return True


if os.environ.get("LACUNA_RAG_WARM") == "1":   # the API's plist sets it; tests and tools do not
    warm()
