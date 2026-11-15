"""ERROR INTELLIGENCE — every warning and error on the Studio, reduced to classes, with trends.

His, 2026-09-24: *"we are going to need the ability to spot bugs before they happen. If there's a series of errors coming
in, it needs to know what those errors are and we need to categorize them… we got 30,000 of these types of errors."*

What it reads, for BOTH environments (dev ~/.curator-dev, QA ~/.curator):
  · telemetry/stream.jsonl — the API's and the app's (pod) channels: {t, where, from, action, level, summary, fields}
  · telemetry/{ipad,studio}/YYYY-MM-DD.jsonl — each device's own trace: {t, source, session, build, level, scene, action…}
  · logs/api.out — uvicorn's text: tracebacks and ERROR lines

What it makes: a FINGERPRINT per line (env · where · subsystem · action · level · the summary with ids, numbers, paths and
quoted text stripped), an ERROR CLASS per fingerprint (count, first, last, device, a sample), a CATEGORY (shops, transfer,
app health, watchdog, studio, cortex, audio, graph, api…), and three EARLY WARNINGS — the burn-rate idea from the SRE
manual applied per class:
  · NEW       first seen in the last hour, never before
  · RISING    ≥ 5 in the last hour and ≥ 3× its own 24-hour hourly average
  · RETURNED  seen again after ≥ 6 hours of quiet
Route timings (api.routes · route) are also rolled into per-minute request counts and p95 for the graphs.
Everything is plain code — no model. SQLite at ~/.lacuna/errors.db; offsets remembered, so a restart resumes.
"""
from __future__ import annotations

import hashlib
import json
import re
import sqlite3
import threading
import time
from pathlib import Path
from typing import Iterable, Optional

from .core import ENVS, LACUNA_HOME

DB_PATH = LACUNA_HOME / "errors.db"
KEEP_DAYS = 14
RETURN_GAP_S = 6 * 3600   # a class quiet this long and back is "returned"
_lock = threading.RLock()
_db: Optional[sqlite3.Connection] = None


def db() -> sqlite3.Connection:
    global _db
    if _db is None:
        _db = sqlite3.connect(str(DB_PATH), check_same_thread=False, isolation_level=None)
        _db.execute("PRAGMA journal_mode=WAL")
        _db.executescript("""
        CREATE TABLE IF NOT EXISTS offsets (path TEXT PRIMARY KEY, ino INTEGER, pos INTEGER);
        CREATE TABLE IF NOT EXISTS classes (id TEXT PRIMARY KEY, env TEXT, level TEXT, source TEXT, subsystem TEXT, action TEXT,
            template TEXT, category TEXT, count INTEGER, first REAL, last REAL, prev_last REAL, device TEXT, sample TEXT);
        CREATE TABLE IF NOT EXISTS events (t REAL, class TEXT, env TEXT);
        CREATE INDEX IF NOT EXISTS ev_t ON events(t);
        CREATE INDEX IF NOT EXISTS ev_c ON events(class, t);
        CREATE TABLE IF NOT EXISTS routes (minute INTEGER, env TEXT, n INTEGER, err INTEGER, ms TEXT, PRIMARY KEY(minute, env));
        CREATE TABLE IF NOT EXISTS paths (minute INTEGER, env TEXT, path TEXT, n INTEGER, err INTEGER, PRIMARY KEY(minute, env, path));
        CREATE TABLE IF NOT EXISTS lines (t REAL, env TEXT, source TEXT, level TEXT, subsystem TEXT, action TEXT, summary TEXT, class TEXT);
        CREATE INDEX IF NOT EXISTS ln_t ON lines(t);
        """)
    return _db


# ── the fingerprint ─────────────────────────────────────────────────────────────────────────────────────────────
_SUBS = [
    (re.compile(r"[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}", re.I), "<uuid>"),
    (re.compile(r"\b[0-9a-f]{12,}\b", re.I), "<hex>"),
    (re.compile(r"https?://\S+"), "<url>"),
    (re.compile(r"(/[\w.\-@]+){2,}"), "<path>"),
    (re.compile(r"'[^']{0,120}'|\"[^\"]{0,120}\"|“[^”]{0,120}”|‘[^’]{0,120}’"), "<q>"),
    (re.compile(r"\b\d+(\.\d+)?\s?(ms|s|MB|GB|KB|px|%)\b"), "<n\\2>"),
    (re.compile(r"\b\d[\d,.:]*\b"), "<n>"),
    (re.compile(r"\s+"), " "),
]


def template_of(text: str) -> str:
    t = str(text or "")[:400]
    for rx, rep in _SUBS:
        t = rx.sub(rep, t)
    return t.strip()


CATEGORIES = [
    ("watchdog", ("watch.", "watchdog", "conn.", "code.fresh", "keepalive")),
    ("app health", ("app.", "crash", "memory", "stall", "leak")),
    ("shops", ("stores", "ebay", "etsy", "shop", "listing", "mentat", "marketplace", "virtual")),
    ("transfer & sync", ("transfer", "sync", "copy", "landing")),
    ("studio", ("studio", "camera", "turntable", "foldio", "gallery", "ingest", "upload")),
    ("cortex", ("cortex", "collection", "door", "reingest", "embed", "vision")),
    ("audio", ("podcast", "radio", "speech", "audio", "ear", "music")),
    ("graph & desk", ("graph", "cgl", "camera-stage", "desk", "surface", "layout", "organize", "scene")),
    ("api", ("api.", "route", "uvicorn", "http", "server")),
    ("telemetry", ("telemetry", "logbus")),
]


def category_of(*words: str) -> str:
    w = " ".join(x for x in words if x).lower()
    for name, keys in CATEGORIES:
        if any(k in w for k in keys):
            return name
    return "other"


def fingerprint(env: str, source: str, subsystem: str, action: str, level: str, summary: str) -> tuple[str, str]:
    tpl = template_of(summary)
    key = "|".join([env, source, subsystem or "", action or "", level, tpl])
    return hashlib.sha1(key.encode()).hexdigest()[:16], tpl


# ── reading the sources ─────────────────────────────────────────────────────────────────────────────────────────
def sources() -> list[tuple[str, str, Path]]:
    """(env, kind, path) for every file worth reading today — the stream, today's and yesterday's device files, api.out."""
    out = []
    # the API names device files by the UTC day (telemetry_ingest.day_file uses gmtime): after 8 PM here that is
    # already tomorrow, so read today and yesterday in UTC — and local, for any writer that uses local time
    now = time.time()
    days = {time.strftime("%Y-%m-%d", f(now - back)) for f in (time.gmtime, time.localtime) for back in (0, 86400)}
    for env, e in ENVS.items():
        home = e["home"]
        out.append((env, "stream", home / "telemetry" / "stream.jsonl"))
        for dev in ("ipad", "studio"):
            for d in days:
                out.append((env, dev, home / "telemetry" / dev / f"{d}.jsonl"))
        out.append((env, "apilog", home / "logs" / "api.out"))
        # a service Lacuna supervises writes its console to ~/.lacuna/logs/<env>-api.log (the LaunchAgent's
        # StandardOutPath) — a traceback there is as real as one in api.out
        out.append((env, "apilog", LACUNA_HOME / "logs" / f"{env}-api.log"))
    return [s for s in out if s[2].exists()]


_TRACE_RX = re.compile(r"^(Traceback|ERROR|CRITICAL|\w+Error:|\w+Exception:)")


def _parse(env: str, kind: str, line: str) -> Optional[dict]:
    if kind == "apilog":
        if not _TRACE_RX.match(line):
            return None
        return {"t": time.time(), "source": "api-log", "level": "error", "subsystem": "uvicorn", "action": "log", "summary": line.strip()}
    try:
        j = json.loads(line)
    except Exception:
        return None
    if kind == "stream":
        return {"t": float(j.get("t") or time.time()), "source": j.get("where") or "api", "level": (j.get("level") or "info").lower(),
                "subsystem": j.get("from") or "", "action": j.get("action") or "", "summary": j.get("summary") or "",
                "fields": j.get("fields")}
    return {"t": float(j.get("t") or time.time()), "source": kind, "level": (j.get("level") or "info").lower(),
            "subsystem": j.get("scene") or "", "action": j.get("action") or "", "summary": j.get("summary") or j.get("action") or "",
            "fields": j.get("fields"), "session": j.get("session"), "build": j.get("build")}


def _route(env: str, ev: dict):
    """api.routes · route: one request's timing, rolled into the minute."""
    f = ev.get("fields") or {}
    ms, status = f.get("ms"), f.get("status")
    if not isinstance(ms, (int, float)):
        return
    minute = int(ev["t"] // 60)
    c = db()
    row = c.execute("SELECT n, err, ms FROM routes WHERE minute=? AND env=?", (minute, env)).fetchone()
    n, err, arr = (row[0], row[1], json.loads(row[2])) if row else (0, 0, [])
    n += 1
    err += 1 if isinstance(status, int) and status >= 500 else 0
    if len(arr) < 400:
        arr.append(round(float(ms), 1))
    c.execute("INSERT OR REPLACE INTO routes VALUES (?,?,?,?,?)", (minute, env, n, err, json.dumps(arr)))
    # by route too (telemetry.routes: "which route is failing?"); the path is the API's template, never an id
    path = str(f.get("path") or "?")[:160]
    bad = 1 if isinstance(status, int) and status >= 500 else 0
    c.execute("INSERT INTO paths VALUES (?,?,?,1,?) ON CONFLICT(minute, env, path) DO UPDATE SET n=n+1, err=err+?",
              (minute, env, path, bad, bad))


def record(env: str, ev: dict):
    """One parsed line: a warning/error becomes an event of its class; a route timing feeds the minute."""
    if ev.get("action") == "route" and str(ev.get("subsystem", "")).startswith("api.routes"):
        _route(env, ev)
    lvl = ev["level"]
    c = db()
    if lvl in ("warn", "warning", "error", "critical", "fatal"):
        lvl = "error" if lvl in ("error", "critical", "fatal") else "warn"
        cid, tpl = fingerprint(env, ev["source"], ev["subsystem"], ev["action"], lvl, ev["summary"])
        row = c.execute("SELECT count, last FROM classes WHERE id=?", (cid,)).fetchone()
        sample = json.dumps({k: ev.get(k) for k in ("summary", "fields", "session", "build")}, default=str)[:2000]
        device = ev.get("source")
        if row:
            # `prev_last` is the last sighting BEFORE A QUIET GAP — it used to move on every event, so a class that
            # came back after six hours in a burst of two lines never read "returned" (L19, 2026-09-25)
            c.execute("UPDATE classes SET count=count+1, prev_last=CASE WHEN ? - last >= ? THEN last ELSE prev_last END, "
                      "last=MAX(last, ?), sample=? WHERE id=?", (ev["t"], RETURN_GAP_S, ev["t"], sample, cid))
        else:
            c.execute("INSERT INTO classes VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
                      (cid, env, lvl, ev["source"], ev["subsystem"], ev["action"], tpl,
                       category_of(ev["subsystem"], ev["action"], ev["source"], tpl), 1, ev["t"], ev["t"], None, device, sample))
        c.execute("INSERT INTO events VALUES (?,?,?)", (ev["t"], cid, env))
        cls = cid
    else:
        cls = None
    c.execute("INSERT INTO lines VALUES (?,?,?,?,?,?,?,?)", (ev["t"], env, ev["source"], lvl, ev["subsystem"], ev["action"], str(ev["summary"])[:500], cls))


def ingest_once(max_lines: int = 20000) -> int:
    """Read what is new in every source since last time (offsets kept; a rotated file starts over)."""
    n = 0
    bad, bad_last = 0, ""
    with _lock:
        c = db()
        c.execute("BEGIN")
        try:
            for env, kind, path in sources():
                st = path.stat()
                row = c.execute("SELECT ino, pos FROM offsets WHERE path=?", (str(path),)).fetchone()
                pos = row[1] if row and row[0] == st.st_ino and row[1] <= st.st_size else 0
                if row is None and st.st_size > 2_000_000:
                    pos = st.st_size - 2_000_000      # a first read starts from the recent end, not from months back
                with open(path, "r", errors="replace") as f:
                    f.seek(pos)
                    if pos and row is None:
                        f.readline()                  # the recent end starts mid-line: skip to the next whole one
                        pos = f.tell()
                    while n < max_lines:
                        line = f.readline()
                        if not line:
                            break
                        if not line.endswith("\n"):
                            break                     # a half-written line waits for the next pass
                        pos = f.tell()
                        # ★ ONE BAD LINE IS ONE BAD LINE (L3, 2026-09-25). A valid-JSON non-object (`123`) or a
                        # non-numeric `t` used to raise here, roll the whole pass back, leave the offset where it
                        # was, and raise again every 2 s — all ingestion stopped for good, with only an audit
                        # line to say so. Now the line is skipped and counted; the pass goes on.
                        try:
                            ev = _parse(env, kind, line)
                            if ev:
                                record(env, ev)
                                n += 1
                        except Exception as e:                               # noqa: BLE001
                            bad += 1
                            bad_last = f"{path.name}: {e.__class__.__name__}: {e}"[:200]
                c.execute("INSERT OR REPLACE INTO offsets VALUES (?,?,?)", (str(path), st.st_ino, pos))
            c.execute("COMMIT")
        except Exception:
            c.execute("ROLLBACK")
            raise
    if bad:
        _bad_lines["count"] += bad
        _bad_lines["last"] = bad_last
        _bad_lines["t"] = time.time()
    return n


# lines ingest could not read, kept for the watcher (workers.evaluate says it once when it starts happening)
_bad_lines = {"count": 0, "last": "", "t": 0.0}


def bad_lines() -> dict:
    return dict(_bad_lines)


def prune():
    cut = time.time() - KEEP_DAYS * 86400
    with _lock:
        c = db()
        c.execute("DELETE FROM events WHERE t < ?", (cut,))
        c.execute("DELETE FROM lines WHERE t < ?", (time.time() - 3 * 86400,))
        c.execute("DELETE FROM routes WHERE minute < ?", (int(cut // 60),))


# ── reading the classes ─────────────────────────────────────────────────────────────────────────────────────────
def _counts(cid: str, now: float) -> tuple[int, int]:
    c = db()
    h1 = c.execute("SELECT COUNT(*) FROM events WHERE class=? AND t>=?", (cid, now - 3600)).fetchone()[0]
    h24 = c.execute("SELECT COUNT(*) FROM events WHERE class=? AND t>=?", (cid, now - 86400)).fetchone()[0]
    return h1, h24


def signal_of(row: dict, h1: int, h24: int, now: float) -> Optional[str]:
    if row["first"] >= now - 3600 and h1 >= 1:
        return "new"
    if h1 >= 5 and h1 >= 3 * max(1.0, h24 / 24.0):
        return "rising"
    if row.get("prev_last") and row["last"] - row["prev_last"] >= RETURN_GAP_S and row["last"] >= now - 3600:
        return "returned"
    return None


def classes(env: Optional[str] = None, level: Optional[str] = None, category: Optional[str] = None,
            since_h: float = 24, limit: int = 200, q: Optional[str] = None) -> list[dict]:
    now = time.time()
    with _lock:
        c = db()
        sql = "SELECT id, env, level, source, subsystem, action, template, category, count, first, last, prev_last, device, sample FROM classes WHERE last >= ?"
        args: list = [now - since_h * 3600]
        for col, val in (("env", env), ("level", level), ("category", category)):
            if val:
                sql += f" AND {col}=?"
                args.append(val)
        if q:
            sql += " AND (template LIKE ? OR subsystem LIKE ?)"
            args += [f"%{q}%", f"%{q}%"]
        sql += " ORDER BY last DESC LIMIT ?"
        args.append(limit)
        cols = ["id", "env", "level", "source", "subsystem", "action", "template", "category", "count", "first", "last", "prev_last", "device", "sample"]
        rows = [dict(zip(cols, r)) for r in c.execute(sql, args).fetchall()]
        for r in rows:
            h1, h24 = _counts(r["id"], now)
            r["last_hour"], r["last_day"] = h1, h24
            r["signal"] = signal_of(r, h1, h24, now)
            if r["id"] in _muted(now):                         # B12: the owner muted it — it still counts, it no longer signals
                r["signal"], r["muted"] = "muted", True
            try:
                r["sample"] = json.loads(r["sample"])
            except Exception:
                pass
    order = {"new": 0, "rising": 1, "returned": 2, None: 3, "muted": 4}
    rows.sort(key=lambda r: (order[r["signal"]], 0 if r["level"] == "error" else 1, -r["last_day"]))
    return rows


def _mute_file():
    from .core import LACUNA_HOME
    return LACUNA_HOME / "errors-muted.json"


def _muted(now: float) -> set:
    try:
        return {k for k, until in json.loads(_mute_file().read_text()).items() if until > now}
    except (OSError, ValueError):
        return set()


def mute(cls: str, hours: float = 24) -> dict:
    """B12: one error class quiet for `hours` — it is still recorded and counted; it raises no new/rising signal"""
    try:
        m = json.loads(_mute_file().read_text())
    except (OSError, ValueError):
        m = {}
    m[str(cls)] = time.time() + max(0.25, min(168.0, float(hours))) * 3600
    _mute_file().write_text(json.dumps(m))
    return {"ok": True, "muted": cls, "hours": hours}


def summary(since_h: float = 24) -> dict:
    rows = classes(since_h=since_h, limit=2000)
    by_cat: dict[str, dict] = {}
    for r in rows:
        b = by_cat.setdefault(r["category"], {"classes": 0, "events": 0, "errors": 0})
        b["classes"] += 1
        b["events"] += r["last_day"]
        b["errors"] += r["last_day"] if r["level"] == "error" else 0
    return {"classes": len(rows), "events_24h": sum(r["last_day"] for r in rows),
            "signals": {s: sum(1 for r in rows if r["signal"] == s) for s in ("new", "rising", "returned")},
            "by_category": by_cat, "top": rows[:12]}


def series_errors(hours: float = 24, bucket_min: int = 15) -> list[dict]:
    """Events per bucket per category — the stacked graph."""
    now = time.time()
    with _lock:
        rows = db().execute("SELECT e.t, c.category, c.level FROM events e JOIN classes c ON c.id=e.class WHERE e.t >= ?",
                            (now - hours * 3600,)).fetchall()
    b: dict[tuple[int, str], int] = {}
    for t, cat, _lvl in rows:
        k = int(t // (bucket_min * 60)) * bucket_min * 60
        b[(k, cat)] = b.get((k, cat), 0) + 1
    return [{"t": k, "category": cat, "n": n} for (k, cat), n in sorted(b.items())]


def series_routes(hours: float = 24, env: Optional[str] = None) -> list[dict]:
    now = time.time()
    with _lock:
        sql = "SELECT minute, env, n, err, ms FROM routes WHERE minute >= ?"
        args: list = [int((now - hours * 3600) // 60)]
        if env:
            sql += " AND env=?"
            args.append(env)
        rows = db().execute(sql + " ORDER BY minute", args).fetchall()
    out = []
    for minute, e, n, err, ms in rows:
        arr = sorted(json.loads(ms) or [0])
        p95 = arr[min(len(arr) - 1, int(len(arr) * 0.95))]
        out.append({"t": minute * 60, "env": e, "n": n, "err": err, "p95": p95})
    return out


ROUTINE = ("route", "vitals", "keepalive.skipped", "keepalive.ok", "open-ledger", "talking-to")


def recent_lines(env: Optional[str] = None, level: Optional[str] = None, q: Optional[str] = None,
                 after: float = 0, limit: int = 300, quiet: bool = False) -> list[dict]:
    """Recent lines; `quiet` hides the routine ones (a 2xx request, a vitals tick, a keep-alive skip) — never a warning."""
    with _lock:
        sql = "SELECT t, env, source, level, subsystem, action, summary, class FROM lines WHERE t > ?"
        args: list = [after]
        if quiet:
            sql += f" AND NOT (level='info' AND action IN ({','.join('?' * len(ROUTINE))}))"
            args += list(ROUTINE)
        if env:
            sql += " AND env=?"
            args.append(env)
        if level:
            sql += " AND level=?" if level != "problems" else " AND level IN ('warn','error')"
            if level != "problems":
                args.append(level)
        if q:
            sql += " AND (summary LIKE ? OR subsystem LIKE ? OR action LIKE ?)"
            args += [f"%{q}%"] * 3
        rows = db().execute(sql + " ORDER BY t DESC LIMIT ?", args + [limit]).fetchall()
    cols = ["t", "env", "source", "level", "subsystem", "action", "summary", "class"]
    return [dict(zip(cols, r)) for r in reversed(rows)]


def ingest_lines(env: str, kind: str, lines: Iterable[str]) -> int:
    """For tests and replays: feed raw lines through the same path."""
    n = 0
    with _lock:
        for ln in lines:
            ev = _parse(env, kind, ln)
            if ev:
                record(env, ev)
                n += 1
    return n
