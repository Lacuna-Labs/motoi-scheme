"""THE MAP'S SOURCES — one cheap, read-only reader per thing that exists (LACUNA-1.3-DESIGN §45; sysmap.py assembles).

Every reader returns plain data and never raises: a missing or broken source is an empty answer plus a line in
`why`. Files are read once per (mtime, size); the three live asks (the foreman on :1139, the gateway on :11434, the
cortex through the broker's socket) are localhost only, with a short timeout. Nothing here writes anything, and the map
shows a cortex node by its key and kind alone: the words in the cortex's answer are dropped.
"""
from __future__ import annotations

import calendar
import json
import os
import re
import subprocess
import time
import urllib.request
from pathlib import Path

from . import core, forge, home, services

_FILES: dict[str, tuple] = {}
_TAIL_BYTES = 400_000


def world() -> Path:
    return forge.world()


def lhome() -> Path:
    return Path(os.environ.get("LACUNA_HOME") or core.LACUNA_HOME)


def code_dir() -> Path:
    return Path(os.environ.get("LACUNA_CODE_DIR") or Path.home() / "code")


def lacuna_repo() -> Path:
    return Path(__file__).resolve().parents[3]


def _cached(path: Path, parse, tail: bool = False):
    """parse(text) once per (mtime, size) of the file; None when it is not there."""
    try:
        st = path.stat()
    except OSError:
        return None
    key = str(path)
    hit = _FILES.get(key)
    if hit and hit[0] == (st.st_mtime, st.st_size):
        return hit[1]
    try:
        with path.open("rb") as f:
            if tail and st.st_size > _TAIL_BYTES:
                f.seek(st.st_size - _TAIL_BYTES)
                f.readline()
            text = f.read().decode("utf-8", errors="replace")
        v = parse(text)
    except (OSError, ValueError):
        return None
    _FILES[key] = ((st.st_mtime, st.st_size), v)
    return v


def _jsonl(text: str) -> list[dict]:
    out = []
    for ln in text.splitlines():
        try:
            d = json.loads(ln)
        except ValueError:
            continue
        if isinstance(d, dict):
            out.append(d)
    return out


def _live_ok() -> bool:
    return os.environ.get("LACUNA_SELF_LIVE") != "0"


def _get(url: str, headers: dict | None = None, timeout: float = 0.8) -> dict | None:
    try:
        req = urllib.request.Request(url, headers=headers or {})
        with urllib.request.urlopen(req, timeout=timeout) as r:
            d = json.loads(r.read().decode() or "{}")
            return d if isinstance(d, dict) else None
    except (OSError, ValueError):
        return None


# ── apps and their wires ────────────────────────────────────────────────────────────────────────────────────────────
_APP = re.compile(r"\{\s*id:\s*'(s-[\w-]+)',\s*name:\s*'([^']+)'(.*?todo:\s*true)?")
_WIRE = re.compile(r"\{\s*a:\s*'(s-[\w-]+)',\s*b:\s*'(s-[\w-]+)'.*?label:\s*'([^']*)'")


def apps() -> dict:
    """The desk registry: the built deskmap.json when it is there, else the source deskmap.js, else home.STANDING."""
    built = _cached(getattr(home, "DESK_MAP", None) or Path(__file__).resolve().parent.parent / "console" / "home" / "deskmap.json", json.loads)
    if isinstance(built, dict) and built.get("apps"):
        return {"apps": [{"id": a["id"], "name": a.get("name") or a["id"][2:], "wired": a.get("wired", True)} for a in built["apps"]],
                "wires": [{"a": c["a"], "b": c["b"], "label": c.get("label") or ""} for c in built.get("connectors") or []]}
    src = _cached(lacuna_repo() / "lacuna-home" / "src" / "apps" / "deskmap.js", lambda t: t)
    named = {m.group(1): (m.group(2), not m.group(3)) for m in _APP.finditer(src or "")}
    rows = [{"id": a, "name": named.get(a, (a[2:].title(), True))[0], "wired": named.get(a, ("", True))[1]} for a in home.STANDING]
    wires = [{"a": m.group(1), "b": m.group(2), "label": m.group(3)} for m in _WIRE.finditer(src or "")]
    return {"apps": rows, "wires": wires}


# ── services, the gateway, the minds ────────────────────────────────────────────────────────────────────────────────
def service_rows() -> list[dict]:
    out = []
    for name, s in services.SERVICES.items():
        try:
            up = services._listening(s["port"]) if s.get("port") else None
        except OSError:
            up = None
        out.append({"name": name, "title": s.get("title") or name, "port": s.get("port"), "up": up, "hers": bool(s.get("hers"))})
    return out


def gateway_url() -> str:
    from . import foreman
    return os.environ.get("LACUNA_GATEWAY_URL") or foreman.GATEWAY


def box_minds() -> dict:
    from . import foreman
    p = Path(os.environ.get("LACUNA_BOX_MINDS") or foreman.BOX_MINDS)
    v = _cached(p, json.loads)
    v = dict(v) if isinstance(v, dict) else {}
    # the current brain lives in ~/.lacuna/brain-profile.json (switch-brain.sh, order §1.5); the box file is configuration
    bp = _cached(lhome() / "brain-profile.json", json.loads)
    if isinstance(bp, dict):
        v.update({k: bp[k] for k in ("brain", "brain_files", "brain_kv_gb") if bp.get(k) is not None})
    return v


def gateway_minds() -> dict | None:
    """GET :11434/lacuna/minds — None when the gateway does not answer."""
    return _get(f"{gateway_url()}/lacuna/minds") if _live_ok() else None


def canon(m) -> str:
    return str(m or "").removesuffix(":latest")


# ── the foreman: its workers, and what came up ──────────────────────────────────────────────────────────────────────
def foreman_tree() -> dict | None:
    if not _live_ok():
        return None
    from . import foreman
    d = foreman.call("GET", "/workers", timeout=0.8)
    return d if d.get("workers") is not None else None


def foreman_events() -> list[dict]:
    return _cached(lhome() / "foreman-events.jsonl", _jsonl, tail=True) or []


def audit_rows() -> list[dict]:
    return _cached(lhome() / "audit.jsonl", _jsonl, tail=True) or []


def escalations() -> list[dict]:
    d = Path(os.environ.get("LACUNA_CASCADE") or world() / "cascade")
    return _cached(d / "escalations.jsonl", _jsonl, tail=True) or []


def iso_t(s, utc: bool = False) -> float | None:
    """A number as is; an ISO stamp as local time (utc=True, or a trailing Z: as UTC — the cascade writes UTC)."""
    if isinstance(s, (int, float)):
        return float(s)
    txt = str(s or "")
    utc = utc or txt.endswith("Z")
    for fmt, n in (("%Y-%m-%dT%H:%M:%S", 19), ("%Y-%m-%dT%H:%M", 16)):
        try:
            tm = time.strptime(txt[:n], fmt)
        except ValueError:
            continue
        return float(calendar.timegm(tm)) if utc else time.mktime(tm)
    return None


# ── carts, jobs, artifacts ──────────────────────────────────────────────────────────────────────────────────────────
_CART = re.compile(r"\(lacuna-cart\s+'([\w-]+)")
_DOES = re.compile(r"\(does\s*\.\s*\"([^\"]*)\"")


def carts() -> list[dict]:
    out = []
    for p in sorted((world() / "carts").glob("*.sks")):
        head = _cached(p, lambda t: t[:4000]) or ""
        m = _CART.search(head)
        d = _DOES.search(head)
        out.append({"name": m.group(1) if m else p.stem, "does": (d.group(1) if d else "")[:200], "file": p.name})
    return out


def jobs() -> list[dict]:
    out = []
    for p in (world() / "jobs").glob("*/job.json"):
        j = _cached(p, json.loads)
        if not isinstance(j, dict):
            continue
        try:
            busy = max(f.stat().st_mtime for f in p.parent.iterdir() if f.is_file())
        except (OSError, ValueError):
            busy = None
        out.append({"name": j.get("name") or p.parent.name, "state": j.get("state"), "kind": j.get("kind"),
                    "worker": j.get("worker"), "model": j.get("model"), "created": iso_t(j.get("created")), "busy": busy,
                    "text": " ".join(str(j.get(k) or "") for k in ("goal", "run", "message"))[:2000]})
    return out


_LATEST = re.compile(r'\(latest\s+((?::\w+\s+"(?:[^"\\]|\\.)*"\s*)+)\)')
_PAIR = re.compile(r':(\w+)\s+"((?:[^"\\]|\\.)*)"')


def artifacts() -> list[dict]:
    root = Path(os.environ.get("LACUNA_ARTIFACTS") or world() / "artifacts")
    text = _cached(root / "INDEX.slat", lambda t: t) or ""
    return [dict(_PAIR.findall(m.group(1))) for m in _LATEST.finditer(text)]


# ── repos, branches, docs ───────────────────────────────────────────────────────────────────────────────────────────
_BR: dict = {"t": 0.0, "v": []}


def repos() -> list[str]:
    try:
        return sorted(d.name for d in code_dir().iterdir() if (d / ".git").exists() and not d.is_symlink())
    except OSError:
        return []


def lacuna_branches() -> list[dict]:
    """lacuna-* branches in the Curator repo (one git call, kept 60 s)."""
    if time.time() - _BR["t"] < 60:
        return _BR["v"]
    try:
        out = subprocess.run(["git", "-C", str(core.REPO), "for-each-ref", "--format=%(refname:short)|%(committerdate:unix)",
                              "refs/heads/lacuna-*"], capture_output=True, text=True, timeout=3).stdout
    except (OSError, subprocess.SubprocessError):
        out = ""
    rows = []
    for ln in out.splitlines():
        name, _, t = ln.partition("|")
        rows.append({"name": name, "t": float(t) if t.strip().isdigit() else None})
    _BR.update(t=time.time(), v=rows)
    return rows


def docs() -> list[dict]:
    rows = [{"id": p.stem, "path": str(p)} for p in sorted((lacuna_repo() / "docs").glob("*.md"))]
    hb = world() / "HANDBOOK.slat"
    if hb.exists():
        rows.append({"id": "HANDBOOK", "path": str(hb)})
    return rows


# ── the cortex (Lacuna's own), its newest facts by key and kind ─────────────────────────────────────────────────────
# Never the snapshot (2026-11-01, P-2026-11-01-cortex-snapshot-per-write): `cortex.snap` was 388 MB (5,680 nodes, 1.38
# million edges) and the cortex rewrites it at every remember(); its parse here was one `json.loads` that held the GIL
# 6-7 s and froze the whole API at each rewrite (two stack dumps, 09:13Z and 09:16Z). The cortex answers `since` in 0.11 s.
CORTEX_TTL_S = 60
_CORTEX: dict = {"t": 0.0, "v": None}


def _cortex_since() -> dict:
    """The cortex's own answer for what arrived in the last 24 h, newest first (its 40), through this home's broker."""
    from . import lacuna_cortex
    return lacuna_cortex._call(["since", "24h"], timeout=3.0)


def cortex() -> dict:
    """The newest facts as {(kind, key): t}, asked of the cortex at most once a CORTEX_TTL_S; empty when it does not answer."""
    if _CORTEX["v"] is not None and time.time() - _CORTEX["t"] < CORTEX_TTL_S:
        return _CORTEX["v"]
    try:
        r = _cortex_since()
    except Exception:  # noqa: BLE001 — a reader never raises: no answer is no facts
        r = {}
    rows = r.get("arrived") if isinstance(r, dict) and r.get("ok") else None
    nodes = {(n["kind"], n["key"]): iso_t(n.get("at")) or 0.0 for n in rows or []
             if isinstance(n, dict) and isinstance(n.get("kind"), str) and isinstance(n.get("key"), str)}
    _CORTEX.update(t=time.time(), v={"nodes": nodes, "edges": []})
    return _CORTEX["v"]


# ── customers and petitions ─────────────────────────────────────────────────────────────────────────────────────────
def customers() -> list[dict]:
    """From data: customers.json ([{id, label, api}]) when it is there, else one per customer-side API (every env but dev)."""
    rows = _cached(lhome() / "customers.json", json.loads)
    if isinstance(rows, list):
        return [{"id": str(r["id"]), "label": str(r.get("label") or r["id"]), "api": r.get("api") or r["id"]}
                for r in rows if isinstance(r, dict) and r.get("id")]
    return [{"id": k, "label": v.get("label") or k, "api": k} for k, v in core.ENVS.items() if k != "dev"]


def petitions() -> list[dict]:
    p = _cached(lhome() / "petitions.json", json.loads)
    rows = list(p.values()) if isinstance(p, dict) else p if isinstance(p, list) else []
    return [r for r in rows if isinstance(r, dict) and r.get("state") == "waiting" and r.get("id")]
