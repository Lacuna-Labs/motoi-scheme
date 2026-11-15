"""RAG corpus — retrieval-augmented generation over a sibling product/Lacuna corpus.

Shipped in v2.2.5. Makes /api/chat and /ctl/chat cite the actual project
context — research/silver-pipeline-handoff.md, memory files, docs/, the
Hallmark Atlas, recent CHANGELOG/HANDOFF — when answering.

Architecture:
    embeddings  — Ollama's /api/embeddings with model 'nomic-embed-text'
                  (274 MB, 768-dim, embedding-dedicated). NO torch or
                  sentence-transformers dependency; reuses the same local
                  daemon that serves chat.
    storage     — raw SQLite + numpy BLOBs. Cosine search via numpy dot
                  on load. ~1000 chunks = fits in memory comfortably.
                  No sqlite-vec dep.
    chunking    — ~256-token chunks, 32-token overlap. Simple paragraph/
                  sentence split; good enough for English tech prose.

Why no sentence-transformers: that stack pulls torch (~2 GB) and is
overkill when Ollama is already running locally. The "nomic-embed-text"
Ollama model was built for this use case.

Fallback: if Ollama isn't running OR the index doesn't exist, retrieve()
returns []; chat works without augmentation. build_index() raises a clean
error with the install command.
"""
from __future__ import annotations

import json
import os
import re
import sqlite3
import time
import urllib.error
import urllib.request
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Iterable


DEFAULT_RAG_DB     = Path.home() / ".lacuna" / "rag.db"
DEFAULT_EMBED_MODEL = "nomic-embed-text"
CHUNK_TARGET_CHARS = 1024    # ~256 tokens at ~4 chars/token
CHUNK_OVERLAP_CHARS = 128
TOP_K_DEFAULT      = 5
DIST_THRESHOLD     = 0.40    # cosine distance floor — chunks beyond are noise

_HAS_NUMPY = False
try:
    import numpy as np  # type: ignore
    _HAS_NUMPY = True
except ImportError:
    pass


class RAGUnavailable(RuntimeError):
    """Raised when RAG dependencies or resources are missing."""


def _require_numpy() -> None:
    if not _HAS_NUMPY:
        raise RAGUnavailable(
            "numpy not installed — RAG cosine search requires it. "
            "Install with: pip install numpy"
        )


# ── Corpus enumeration ───────────────────────────────────────────────────────

def corpus_sources(repo_root: Path) -> list[Path]:
    """Enumerate the files Lacuna's brain should know about.

    Priority (high → low):
      research/*.md                — pipeline handoff, future papers
      the-api/.../project_persona.md
      lacuna-src/.../persona_prompt.md
      project-ml/.../hallmark_atlas.json
      memory/*.md                  — project facts, voice register, Alfred's prefs
      docs/BOUNDARIES.md, docs/ENVIRONMENTS.md, docs/PORTS.md, docs/ARCHITECTURE-v2.2.md,
      docs/AI-LACUNA-LOCAL.md
      STATE.md, PROTOCOL.md        — current state, team, conventions
      CHANGELOG.md, HANDOFF.md     — recent decisions (embedded whole; chunker
                                     splits by H1/H2 so each entry is its own
                                     retrievable unit)
    """
    sources: list[Path] = []

    # research/
    for p in sorted((repo_root / "research").glob("*.md")):
        sources.append(p)

    # persona prompts
    for rel in [
        "the-api/project_api/project_persona.md",
        "lacuna-src/lacuna/persona_prompt.md",
    ]:
        p = repo_root / rel
        if p.exists():
            sources.append(p)

    # Hallmark Atlas JSON — one chunk per entry, handled in chunk_file
    atlas = repo_root / "project-ml" / "project_ml" / "hallmark_atlas.json"
    if atlas.exists():
        sources.append(atlas)

    # memory/
    mem_dir = Path.home() / ".claude" / "projects" / "-Users-alfred-code-project-the-project-tree" / "memory"
    if mem_dir.exists():
        for p in sorted(mem_dir.glob("*.md")):
            if p.name == "MEMORY.md":
                continue   # index only; individual memories are richer
            sources.append(p)

    # docs/
    for doc in [
        "docs/BOUNDARIES.md", "docs/ENVIRONMENTS.md", "docs/PORTS.md",
        "docs/ARCHITECTURE-v2.2.md", "docs/AI-LACUNA-LOCAL.md", "docs/WORKFLOW.md",
    ]:
        p = repo_root / doc
        if p.exists():
            sources.append(p)

    # top-level state + protocol
    for rel in ["STATE.md", "PROTOCOL.md", "CHANGELOG.md", "HANDOFF.md"]:
        p = repo_root / rel
        if p.exists():
            sources.append(p)

    return sources


# ── Chunking ─────────────────────────────────────────────────────────────────

@dataclass
class Chunk:
    source_path: str
    chunk_idx:   int
    text:        str


def chunk_file(path: Path) -> list[Chunk]:
    """Split file into ~CHUNK_TARGET_CHARS-char chunks with CHUNK_OVERLAP_CHARS overlap.

    Special case: Hallmark Atlas JSON — one chunk per maker entry.
    """
    text = path.read_text(encoding="utf-8", errors="replace")

    if path.suffix == ".json" and "hallmark_atlas" in path.name:
        try:
            data = json.loads(text)
        except json.JSONDecodeError:
            return [Chunk(str(path), 0, text[:CHUNK_TARGET_CHARS])]
        entries = data.get("entries") if isinstance(data, dict) else data
        if not isinstance(entries, list):
            return [Chunk(str(path), 0, text[:CHUNK_TARGET_CHARS])]
        chunks = []
        for i, entry in enumerate(entries):
            # Format the entry in prose so the embedding captures semantics
            maker = entry.get("maker_name", "?")
            aliases = ", ".join(entry.get("maker_aliases", []) or [])
            origin = entry.get("origin", {}) or {}
            city = origin.get("city") or ""
            country = origin.get("country") or ""
            tradition = ", ".join(entry.get("tradition_tags", []) or [])
            years = entry.get("active_years", {}) or {}
            hallmark = entry.get("hallmark", {}) or {}
            glyphs = ", ".join(hallmark.get("glyphs", []) or [])
            desc = hallmark.get("description", "")
            sources_list = entry.get("sources", []) or []
            cite = "; ".join(
                f"{s.get('author') or s.get('title', '')}{f' ({s['year']})' if s.get('year') else ''}"
                for s in sources_list
            )
            prose = (
                f"Hallmark Atlas entry: {maker}"
                + (f" (also known as {aliases})" if aliases else "")
                + f". Origin: {city}, {country}."
                + (f" Tradition: {tradition}." if tradition else "")
                + (f" Active {years.get('start', '?')}–{years.get('end') or 'present'}." if years else "")
                + (f" Hallmark: {desc}" if desc else "")
                + (f" Glyphs: {glyphs}." if glyphs else "")
                + (f" Sources: {cite}." if cite else "")
            )
            chunks.append(Chunk(str(path) + f"#{entry.get('id', i)}", i, prose))
        return chunks

    # Prose — chunk by paragraph, target size
    paragraphs = re.split(r"\n\s*\n", text)
    chunks = []
    buf = ""
    idx = 0
    for p in paragraphs:
        p = p.strip()
        if not p:
            continue
        if len(buf) + len(p) + 2 < CHUNK_TARGET_CHARS:
            buf += ("\n\n" + p) if buf else p
        else:
            if buf:
                chunks.append(Chunk(str(path), idx, buf))
                idx += 1
            # Overlap handling
            overlap = buf[-CHUNK_OVERLAP_CHARS:] if len(buf) > CHUNK_OVERLAP_CHARS else ""
            buf = (overlap + "\n\n" + p) if overlap else p
    if buf:
        chunks.append(Chunk(str(path), idx, buf))
    return chunks


# ── Ollama embeddings ────────────────────────────────────────────────────────

def _ollama_embed(text: str, *, base_url: str | None = None, model: str = DEFAULT_EMBED_MODEL) -> list[float]:
    """Call Ollama /api/embeddings.  Returns a list of floats."""
    base = (base_url or os.environ.get("LACUNA_LOCAL_URL") or "http://localhost:11434").rstrip("/")
    payload = json.dumps({"model": model, "prompt": text}).encode()
    req = urllib.request.Request(
        f"{base}/api/embeddings",
        data=payload,
        headers={"Content-Type": "application/json"},
    )
    with urllib.request.urlopen(req, timeout=30) as resp:
        data = json.loads(resp.read())
    emb = data.get("embedding")
    if not isinstance(emb, list):
        raise RAGUnavailable(f"unexpected embeddings response: {data!r}")
    return emb


# ── Index build ──────────────────────────────────────────────────────────────

_SCHEMA = """
CREATE TABLE IF NOT EXISTS rag_chunks (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    source_path   TEXT NOT NULL,
    chunk_idx     INTEGER NOT NULL,
    chunk_text    TEXT NOT NULL,
    embedding     BLOB NOT NULL,
    model         TEXT NOT NULL,
    created_at    REAL NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_rag_source ON rag_chunks(source_path);
"""


def _open_db(db_path: Path) -> sqlite3.Connection:
    db_path.parent.mkdir(parents=True, exist_ok=True)
    con = sqlite3.connect(db_path)
    con.row_factory = sqlite3.Row
    con.executescript(_SCHEMA)
    return con


def build_index(
    repo_root: Path | None = None,
    *,
    db_path: Path | None = None,
    model: str = DEFAULT_EMBED_MODEL,
    base_url: str | None = None,
    progress: bool = False,
) -> dict:
    """Embed the corpus and write to SQLite.  Returns summary dict.

    Destructive: wipes existing chunks before rewriting.  For incremental
    updates, drop rows for a single source first, then call the
    single-file variant _embed_file (unexported for now — v2.2.5 stays
    simple; incremental is a v2.2.5.1 concern).
    """
    _require_numpy()
    from . import llm as _llm
    reachable, installed = _llm.probe_ollama(base_url)
    if not reachable:
        raise RAGUnavailable(
            "Ollama isn't reachable on localhost:11434. "
            "Install: `curl -fsSL https://ollama.com/install.sh | sh`, "
            f"then `ollama pull {model}`."
        )
    if installed and model not in installed:
        raise RAGUnavailable(
            f"Embedding model {model} not installed. "
            f"Installed: {installed}. "
            f"Pull with: `ollama pull {model}`."
        )

    repo_root = repo_root or Path(__file__).resolve().parents[2]
    db_path = db_path or DEFAULT_RAG_DB

    sources = corpus_sources(repo_root)
    con = _open_db(db_path)
    con.execute("DELETE FROM rag_chunks")

    total_chunks = 0
    for src in sources:
        chunks = chunk_file(src)
        for c in chunks:
            emb = _ollama_embed(c.text, base_url=base_url, model=model)
            arr = np.asarray(emb, dtype=np.float32)
            # L2-normalize so cosine = dot product
            n = float(np.linalg.norm(arr))
            if n > 0:
                arr = arr / n
            con.execute(
                "INSERT INTO rag_chunks (source_path, chunk_idx, chunk_text, embedding, model, created_at) "
                "VALUES (?, ?, ?, ?, ?, ?)",
                (c.source_path, c.chunk_idx, c.text, arr.tobytes(), model, time.time()),
            )
            total_chunks += 1
        if progress:
            print(f"  ✓ {src.relative_to(repo_root) if src.is_relative_to(repo_root) else src.name}: {len(chunks)} chunk(s)")
    con.commit()
    con.close()

    return {"sources": len(sources), "chunks": total_chunks, "db": str(db_path), "model": model}


# ── Retrieval ────────────────────────────────────────────────────────────────

@dataclass
class Retrieved:
    source_path: str
    chunk_idx:   int
    text:        str
    score:       float   # cosine similarity in [-1, 1]; 1 = identical


def retrieve(
    query: str,
    *,
    k: int = TOP_K_DEFAULT,
    db_path: Path | None = None,
    base_url: str | None = None,
    model: str = DEFAULT_EMBED_MODEL,
    min_similarity: float = 1.0 - DIST_THRESHOLD,
) -> list[Retrieved]:
    """Top-k chunks for the query. Empty list if index missing or Ollama down."""
    if not _HAS_NUMPY:
        return []
    db_path = db_path or DEFAULT_RAG_DB
    if not db_path.exists():
        return []
    # Embed query
    try:
        q_emb = _ollama_embed(query, base_url=base_url, model=model)
    except Exception:
        return []
    q = np.asarray(q_emb, dtype=np.float32)
    qn = float(np.linalg.norm(q))
    if qn > 0:
        q = q / qn

    con = _open_db(db_path)
    cur = con.execute(
        "SELECT source_path, chunk_idx, chunk_text, embedding FROM rag_chunks"
    )
    # Score all; keep top-k.  For ~1000 chunks this is sub-millisecond.
    rows = cur.fetchall()
    con.close()
    if not rows:
        return []

    emb_mat = np.stack(
        [np.frombuffer(r["embedding"], dtype=np.float32) for r in rows],
        axis=0,
    )
    scores = emb_mat @ q   # both sides L2-normalized → cosine similarity
    order = np.argsort(-scores)[:k]
    out: list[Retrieved] = []
    for idx in order:
        score = float(scores[idx])
        if score < min_similarity:
            continue
        r = rows[int(idx)]
        out.append(Retrieved(
            source_path=r["source_path"],
            chunk_idx=int(r["chunk_idx"]),
            text=r["chunk_text"],
            score=score,
        ))
    return out


def format_context(chunks: Iterable[Retrieved]) -> str:
    """Render retrieved chunks as a system-prompt context section."""
    lines = []
    for c in chunks:
        src = Path(c.source_path).name
        lines.append(f"[{src}]\n{c.text}")
    if not lines:
        return ""
    return "## Retrieved context\n\n" + "\n\n---\n\n".join(lines)


def index_stats(db_path: Path | None = None) -> dict[str, Any]:
    """Quick status read for `lacuna ai rag status`."""
    db_path = db_path or DEFAULT_RAG_DB
    if not db_path.exists():
        return {"exists": False, "db": str(db_path)}
    con = _open_db(db_path)
    try:
        row = con.execute(
            "SELECT COUNT(*) AS n, COUNT(DISTINCT source_path) AS s, "
            "       MIN(created_at) AS first, MAX(created_at) AS last, "
            "       model FROM rag_chunks GROUP BY model"
        ).fetchone()
    finally:
        con.close()
    if not row:
        return {"exists": True, "db": str(db_path), "chunks": 0}
    return {
        "exists": True,
        "db":     str(db_path),
        "chunks": int(row["n"]),
        "sources": int(row["s"]),
        "model":  row["model"],
        "built_at": row["last"],
    }
