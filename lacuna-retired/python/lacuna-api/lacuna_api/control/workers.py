"""THE WORKERS — the loop that keeps watching while nobody is looking.

  · every 2 s   read what is new in every log and telemetry stream (errors.ingest_once)
  · every 60 s  sample disk, memory, services up (the graphs' series) and evaluate the ALERT EDGES
  · daily       prune old events

Past 500 lines by reason: one loop and its timed sections, each guarded so a raise in one never ends the loop; it retires
with the Python API (N1.6).

ALERTS are edge-triggered (the API watchdogs' rule): a condition that stays true is said ONCE; it is said again only
when it clears and returns, or when a class's signal changes. Each alert goes to the console's alert bar and a macOS
notification; iMessage to his phone is wired and off until LACUNA_IMESSAGE_TO is set.
"""
from __future__ import annotations

import json
import os
import subprocess
import threading
import time
from pathlib import Path
from typing import Optional

from . import drift, errors, fence, health, mentat, modelwatch, services, telemetry, upkeep
from .core import LACUNA_HOME
from .core import audit as _audit_raw


def audit(who: str, action: str, **detail):
    """The watcher's audit NEVER raises. On a full disk (seen here) `core.audit` raises ENOSPC from the
    except-handlers that call it, the exception escapes `_loop`, and the watcher thread dies exactly when
    it is needed most (L2, 2026-09-25). A record that cannot be written is dropped; the watch goes on."""
    try:
        return _audit_raw(who, action, **detail)
    except Exception:
        return None

_alerts: list[dict] = []
_drift_now: list[dict] = []
_state: dict[str, object] = {}
_lock = threading.Lock()
_started = False
WATCHED_SERVICES = ("dev-api", "qa-api", "lacuna")


# ★ WHERE A NOTICE GOES (DiRT pass, 2026-09-25: "updates and notifications"). Three channels, each on when it is set:
#   · the macOS banner on the Studio (always);
#   · iMessage to a number or Apple ID (`imessage` in ~/.lacuna/notify.json, or LACUNA_IMESSAGE_TO) — his phone;
#   · an ntfy topic (`ntfy` in notify.json: "https://ntfy.sh/<topic>" or a self-hosted URL) — any phone with the app.
# notify.json is read on every notice, so a channel set from the console or by hand takes effect at once.
NOTIFY_FILE = LACUNA_HOME / "notify.json"


def _e164(to: str) -> str:
    """Messages wants a number as +1XXXXXXXXXX (or an Apple ID as typed): 917-721-5826, 9177215826 and 19177215826
    all failed silently on 2026-09-26; +19177215826 went through. An address with an @ is left alone."""
    t = (to or "").strip()
    if not t or "@" in t or t.startswith("+"):
        return t
    digits = "".join(ch for ch in t if ch.isdigit())
    if len(digits) == 10:
        return "+1" + digits
    if len(digits) == 11 and digits.startswith("1"):
        return "+" + digits
    return t


def notify_channels() -> dict:
    cfg: dict = {}
    try:
        cfg = json.loads(NOTIFY_FILE.read_text()) if NOTIFY_FILE.exists() else {}
    except Exception:
        cfg = {}
    im = _e164(cfg.get("imessage") or os.environ.get("LACUNA_IMESSAGE_TO") or "")
    nt = (cfg.get("ntfy") or os.environ.get("LACUNA_NTFY") or "").strip()
    return {"banner": True, "imessage": im, "ntfy": nt, "file": str(NOTIFY_FILE), "quiet_s": NOTIFY_QUIET_S}


def _notify_now(title: str, body: str):
    ch = notify_channels()
    sent = ["banner"]
    try:
        # AppleScript reads "\"" and "\\" but not JSON's \uXXXX: an em dash in the title came out as a syntax error
        # (-2741) and no iMessage went, 2026-09-26 — the text goes through as UTF-8 (ensure_ascii=False)
        subprocess.run(["osascript", "-e", f'display notification {json.dumps(body[:220], ensure_ascii=False)} with title {json.dumps("Lacuna — " + title, ensure_ascii=False)}'],
                       timeout=5, capture_output=True)
    except Exception:
        pass
    if ch["imessage"]:
        script = f'tell application "Messages" to send {json.dumps("Lacuna — " + title + ": " + body[:300], ensure_ascii=False)} to buddy {json.dumps(ch["imessage"], ensure_ascii=False)} of (service 1 whose service type is iMessage)'
        try:
            # the first send from a new Lacuna process makes macOS ask, on the Studio's screen, whether this process may
            # drive Messages; the call blocks until that is answered — long enough for a hand to reach the OK
            r = subprocess.run(["osascript", "-e", script], timeout=40, capture_output=True, text=True)
            if r.returncode == 0:
                sent.append("imessage")
            else:
                # the reason is kept (the audit, and `lacuna notify test` shows it): Messages not signed in, a number in
                # the wrong form, or macOS refusing Lacuna's process the Automation right to drive Messages (-1743)
                why = (r.stderr or r.stdout or "").strip()[-200:]
                audit("lacuna", "notify.imessage.failed", to=ch["imessage"], why=why)
                sent.append(f"imessage:failed ({why or 'no reason given'})")
        except Exception as e:
            audit("lacuna", "notify.imessage.failed", to=ch["imessage"], why=e.__class__.__name__)
            sent.append(f"imessage:failed ({e.__class__.__name__})")
    if ch["ntfy"]:
        try:
            import urllib.request as _ur
            req = _ur.Request(ch["ntfy"], data=body[:600].encode(), headers={"Title": ("Lacuna — " + title).encode("ascii", "ignore").decode(), "Priority": "high" if "DOWN" in title or "failed" in title else "default"})
            with _ur.urlopen(req, timeout=8):
                sent.append("ntfy")
        except Exception:
            sent.append("ntfy:failed")
    return sent


def notify_test() -> dict:
    """One notice down every channel, now — no quiet window, so a person can see it land."""
    sent = _notify_now("test", f"this is Lacuna at {time.strftime('%H:%M')}; the channels work")
    return {"ok": True, "sent": sent, "channels": notify_channels()}


# a notification is sent from its own thread — osascript takes up to 5 s + 10 s, and it used to run INSIDE the
# watcher's loop, so a burst of N alerts stalled ingest by 15·N s (L24, 2026-09-25). And the same title is not
# said again within NOTIFY_QUIET_S: a service that crash-loops made a DOWN/back pair every minute.
NOTIFY_QUIET_S = 300
_notified: dict[str, float] = {}


def _notify(title: str, body: str):
    from . import desk_seen                                    # the open desk hears it first; the channels wait (desk_seen.py)
    if desk_seen.fresh():
        audit("lacuna", "notify.held-for-desk", title=title[:120])
        return
    now = time.time()
    with _lock:
        if now - _notified.get(title, 0.0) < NOTIFY_QUIET_S:
            return
        _notified[title] = now
    threading.Thread(target=_notify_now, args=(title, body), name="lacuna-notify", daemon=True).start()


# THE ALERTS LEDGER (the owner's ruling 7 of 2026-11-02, docs/LACUNA-1.0-FINALE.md §1, D13): an alert notifies no one; it is a row
# of ~/lacuna-world/sre/alerts.slat, which the telemetry card reads (tools/sre/alerts.mjs is the reader). Only the live home
# writes it: a test, a clone or a scratch home never touches the live world.
ALERTS_LEDGER = Path(os.environ.get("LACUNA_ALERTS") or Path.home() / "lacuna-world" / "sre" / "alerts.slat")
_LEDGER_LEVEL = {"error": "alert", "warn": "warn", "clear": "clear"}
# THE HOLD (2026-11-06, E14 row 19; sre-09: 1,015 rows, a mock marketplace's warn and clear 31 s apart): a raise is written only
# once its condition has held FOR_S, as the alert's `(for …)` says; a clear inside the hold writes neither row. FOR_S 0 writes at
# once (a test's). Curator's dogs (`wd:*`, `mentat:*`) are `(product curator)`: the telemetry card shows Lacuna's by default.
FOR_S = 300
CURATOR_KEYS = ("wd:", "mentat:")
_held: dict = {}                                               # key → {timer, lv, what, at}: a raise not yet written
_written: dict = {}                                            # key → the level on the ledger, so its clear is written too
_RANK = {"warn": 1, "alert": 2}


def _row(key: str, lv: str, what: str, at: float, for_s: Optional[int]) -> Optional[str]:
    q = lambda v: json.dumps(str(v), ensure_ascii=False)      # a slat string: the quote and the backslash escaped
    source = "watchdog" if key.startswith("watchdog:") else "worker" if key.startswith("worker") else "api"
    product = "curator" if key.startswith(CURATOR_KEYS) else "lacuna"
    held = f" (for {for_s})" if for_s else ""
    line = (f"(alert (at {q(time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime(at)))}) (product {product}) (source {source}) "
            f"(key {q(key)}) (level {lv}){held} (what {q(str(what)[:200])}))\n")
    try:
        ALERTS_LEDGER.parent.mkdir(parents=True, exist_ok=True)
        with open(ALERTS_LEDGER, "a", encoding="utf-8") as f:
            f.write(line)
    except OSError:
        return None
    return line


def _flush(key: str) -> None:
    with _lock:
        h = _held.pop(key, None)
        if h is None:
            return
        _written[key] = h["lv"]
    _row(key, h["lv"], h["what"], h["at"], FOR_S)


def _ledger(key: str, level: str, what: str) -> Optional[str]:
    """One row of the alerts ledger, or None: an info is not an alert, and only the live home writes. A raise waits FOR_S and
    is written then, stamped with when it began; a raise inside the hold updates what it will say; a higher level on the ledger
    is written at once, the same level again is not; a clear is written only for a raise on the ledger."""
    lv = _LEDGER_LEVEL.get(level)
    if not lv or LACUNA_HOME != Path.home() / ".lacuna" and "LACUNA_ALERTS" not in os.environ:
        return None
    now = time.time()
    with _lock:
        if lv == "clear":
            h = _held.pop(key, None)
            if h is not None:
                h["timer"].cancel()                            # the episode ended inside its hold: no row at all
                return None
            if _written.pop(key, None) is None:
                return None
            for_s = None
        elif key in _written:
            if _RANK[lv] <= _RANK[_written[key]]:
                return None                                    # the episode is on the ledger at this level already
            _written[key] = lv
            for_s = FOR_S or None
        elif key in _held:
            h = _held[key]
            if _RANK[lv] >= _RANK[h["lv"]]:
                h.update(lv=lv, what=what)
            return None
        elif FOR_S <= 0:
            _written[key] = lv
            for_s = None
        else:
            t = threading.Timer(FOR_S, _flush, (key,))
            t.daemon = True
            _held[key] = {"timer": t, "lv": lv, "what": what, "at": now}
            t.start()
            return None
    return _row(key, lv, what, now, for_s)


def raise_alert(key: str, level: str, title: str, body: str, notify: bool = False):
    """An alert: kept for the desk's reads, a row in the alerts ledger, never a notice (ruling 7: `notify` is kept for its
    callers and does nothing)."""
    a = {"key": key, "level": level, "title": title, "body": body, "t": time.time(), "acked": False}
    with _lock:
        _alerts.insert(0, a)
        del _alerts[300:]
    _ledger(key, level, title)
    audit("lacuna", "alert", key=key, level=level, title=title)
    if level in ("error", "warn"):                               # into the graph cortex: newest supersedes the last
        from . import arrivals
        arrivals.alerted(key, level, title, body)


def resolve_alert(key: str, why: str) -> int:
    """A condition that ended clears its own alerts: they are acked with the reason and the time.

    Alerts are edge-triggered and were kept open until a person acked them, so a drift that
    ended when dev caught up to HEAD left six open lines saying dev ran a sha it no longer
    ran (review, 2026-09-25). Returns how many it cleared.
    """
    n = 0
    with _lock:
        for a in _alerts:
            if a["key"] == key and not a["acked"]:
                a["acked"] = True
                a["resolved"] = why
                a["resolved_t"] = time.time()
                n += 1
    if n:
        audit("lacuna", "alert.resolved", key=key, why=why, cleared=n)
        _ledger(key, "clear", why)
    return n


def drift_now() -> list[dict]:
    return list(_drift_now)


def alerts(limit: int = 100) -> list[dict]:
    with _lock:
        return list(_alerts[:limit])


def ack(key: Optional[str] = None):
    with _lock:
        for a in _alerts:
            if key is None or a["key"] == key:
                a["acked"] = True


# ★ SAID ONCE SURVIVES A RESTART (2026-09-24). The edges lived only in memory, so every restart of Lacuna said every
# standing drift and every signalled error class again (with a notification). What has been said is kept on disk.
_SAID = LACUNA_HOME / "alert-state.json"
# what survives a restart: not only the drift/class memory, but every edge — so a service that is DOWN when Lacuna
# comes back is not "first seen" again and forgotten (L4, 2026-09-25)
_KEPT = ("drift:", "cls:", "svc:", "wd:", "disk:", "mem:", "ingest:", "mentat:", "fence.", "tel:", "sentinel:")
_saved: str = ""


def _load_said():
    try:
        _state.update({k: v for k, v in json.loads(_SAID.read_text()).items() if k.startswith(_KEPT)})
    except Exception:
        pass


def _save_said():
    global _saved
    blob = json.dumps({k: v for k, v in _state.items() if k.startswith(_KEPT)}, sort_keys=True)
    if blob != _saved:
        tmp = _SAID.with_suffix(".tmp")
        tmp.write_text(blob)
        tmp.replace(_SAID)
        _saved = blob


def _edge(key: str, value, baseline="__unseen__") -> bool:
    """True when `value` differs from what we last saw for `key` (and remembers it).

    `baseline` is what a healthy machine reads: with one, the FIRST observation is compared against it,
    so a service already down, a disk already full, when Lacuna starts is said at once — before, the first
    look only remembered, and a standing outage was never reported at all (L4, 2026-09-25)."""
    prev = _state.get(key, baseline)
    _state[key] = value
    return prev != "__unseen__" and prev != value


def _guarded(section: str, fn):
    """One check failing is one check failing — never the rest of the minute (L5, 2026-09-25). A raise is
    audited, said once as an alert (an edge on the section), and cleared when the check answers again."""
    try:
        fn()
        if _edge(f"check:{section}", True, baseline=True):
            raise_alert(f"check:{section}", "info", f"watcher check {section} answers again", "", notify=False)
    except Exception as e:                                            # noqa: BLE001
        audit("lacuna", f"evaluate.{section}.error", error=f"{e.__class__.__name__}: {e}"[:200])
        if _edge(f"check:{section}", False, baseline=True):
            raise_alert(f"check:{section}", "error", f"watcher check {section} FAILED",
                        f"{e.__class__.__name__}: {e}"[:200] + " — this check is blind until it answers again")


def _eval_services():
    # ANSWERING, not merely listening (L6): /healthz must say ok. Two misses in a row before DOWN is said — one slow
    # answer during a restart is not an outage — and one hit brings it back.
    for name in WATCHED_SERVICES:
        hit = services.answering(name)
        misses = 0 if hit else min(2, _state.get(f"svc:{name}:misses", 0) + 1)
        _state[f"svc:{name}:misses"] = misses
        up = hit or misses < 2
        if _edge(f"svc:{name}", up, baseline=True):
            title = services.SERVICES[name]["title"]
            if up:
                raise_alert(f"svc:{name}", "info", f"{title} is back", f"{title} answers on :{services.SERVICES[name]['port']} again")
            else:
                raise_alert(f"svc:{name}", "error", f"{title} is DOWN", f"nothing answers on :{services.SERVICES[name]['port']} — open Lacuna › Control")


def _eval_classes():
    # error classes: new / rising / returned, errors (and rising warnings)
    for r in errors.classes(since_h=2, limit=400):
        sig = r["signal"]
        if not sig or (r["level"] == "warn" and sig != "rising"):
            continue
        key = f"cls:{r['id']}:{sig}"
        if key in _state:
            continue
        _state[key] = time.time()
        raise_alert(key, "error" if r["level"] == "error" else "warn",
                    f"{sig.upper()} {r['level']} · {r['env']} · {r['category']}",
                    f"{r['subsystem']} {r['action']}: {r['template'][:160]} — {r['last_hour']} in the last hour",
                    notify=r["level"] == "error")


def _eval_ingest():
    # lines the ingest could not read (L3): said once when they start, cleared when they stop
    b = errors.bad_lines()
    bad = b["count"] > _state.get("ingest:bad-seen", 0)
    _state["ingest:bad-seen"] = b["count"]
    if _edge("ingest:bad", bad, baseline=False) and bad:
        raise_alert("ingest:bad", "warn", "telemetry lines Lacuna cannot read",
                    f"{b['count']} so far — last: {b['last']}", notify=False)


def _eval_watchdogs():
    for env in ("dev", "qa"):
        for w in health.watchdogs(env):
            if not w["name"].startswith("watch."):
                continue
            bad = w["level"] in ("warn", "error")
            key = f"wd:{env}:{w['name']}"
            edge = _edge(key, bad, baseline=False)
            if edge and bad:
                raise_alert(key, w["level"], f"watchdog {w['name']} ({env})", str(w["summary"])[:200])
            elif edge and not bad:
                resolve_alert(key, f"the watchdog says {w['level']} again: {str(w['summary'])[:80]}")


def _eval_drift():
    # drift — what Lacuna believes vs what the machine does
    now_drift = {r["id"]: r for r in drift.check()}
    for k, r in now_drift.items():
        if _edge(f"drift:{k}", r["value"]) or f"drift:{k}:said" not in _state:
            _state[f"drift:{k}:said"] = True
            # the same drift with a new value (dev advanced again) supersedes its earlier line: one open line per key
            resolve_alert(f"drift:{k}", f"superseded: now {r['value']}")
            raise_alert(f"drift:{k}", "warn", f"drift · {r['service']}", r["detail"])
    for k in [k for k in list(_state) if k.startswith("drift:") and not k.endswith(":said") and k[6:] not in now_drift and _state[k] is not None]:
        _state[k] = None
        _state.pop(f"{k}:said", None)
        resolve_alert(k, "the condition ended")
    _drift_now[:] = list(now_drift.values())


def _eval_disk():
    d = health.disk()
    if _edge("disk:low", d["low"], baseline=False) and d["low"]:
        raise_alert("disk:low", "error", "disk under 15 GB", f"{d['free_gb']} GB free — Lacuna › Control › Disk shows what eats it")
    # THE 5 % LINE (the owner, 2026-10-17; 10 % until 2026-10-18): every download stops at once, a plan of the owner's list
    # is written, he is told
    from . import diskguard
    g = diskguard.low(d)                            # the SAME reading the watcher took (one source of truth per pass)
    if _edge("disk:tenpct", g["low"], baseline=False) and g["low"]:
        stopped = diskguard.stop_downloads()
        p = diskguard.plan()
        top = ", ".join(f"{c['path']} {c['gb']} GB" for c in (p.get("culprits") or [])[:3])
        raise_alert("disk:tenpct", "error", f"disk under 5% ({g['free_pct']}% free) — downloads stopped",
                    # the disk leads (2026-10-27: the bar showed "stopped 0 download(s)", which reads as no problem at all)
                    f"disk at {g['free_pct']}% free; " + (f"{len(stopped)} download(s) stopped. " if stopped else "no download was running. ") +
                    f"Biggest eaters: {top}. Your list can free {p['total_gb']} GB: run `lacuna disk clean` and press Enter.")
        audit("lacuna", "disk.tenpct", free_pct=g["free_pct"], stopped=stopped, plan_gb=p["total_gb"])


def _eval_memory():
    m = health.memory()
    if _edge("mem:critical", m["pressure"] == "critical", baseline=False) and m["pressure"] == "critical":
        raise_alert("mem:critical", "error", "memory pressure critical", f"{m['available_gb']} GB available")


# ★ A RELEASE SAYS WHEN IT IS DONE (his, 2026-09-26: "it can ask us when we're done"): a release, promote, build or
# deploy job that finished since the last look is said once — to the bar, the phone and every notice channel.
# SAID ONCE, ACROSS RESTARTS (2026-10-19: the same "promote … stopped" came back after every restart — the set lived in
# memory only): the job ids already said are kept on disk.
_SEEN_FILE = LACUNA_HOME / "jobs-said.json"
try:
    _jobs_seen: set[str] = set(json.loads(_SEEN_FILE.read_text()))
except Exception:  # noqa: BLE001
    _jobs_seen = set()


def _eval_jobs():
    from .core import jobs as _jobs, job_tail
    for j in _jobs(20):
        if j.get("running") or j.get("kind") not in ("release", "promote", "deploy", "build") or j["id"] in _jobs_seen:
            continue
        _jobs_seen.add(j["id"])
        try:
            _SEEN_FILE.write_text(json.dumps(sorted(_jobs_seen)[-400:]))
        except OSError:
            pass
        if time.time() - (j.get("finished") or j.get("started") or 0) > 3600:
            continue                                       # old news from before this watcher started
        ok = j.get("code") == 0
        last = [l for l in job_tail(j["id"], 60).splitlines() if l.strip() and not l.startswith("[exit")][-1:] or [""]
        raise_alert(f"job:{j['id']}", "info" if ok else "error", f"{j['title']} — {'done' if ok else 'stopped'}",
                    (last[0][:220] if last else ""), notify=True)


SECTIONS = (("services", _eval_services), ("classes", _eval_classes), ("ingest", _eval_ingest), ("jobs", _eval_jobs),
            ("watchdogs", _eval_watchdogs), ("drift", _eval_drift), ("disk", _eval_disk), ("memory", _eval_memory),
            ("mentat", mentat.section), ("fence", fence.section), ("telemetry", telemetry.section),
            ("forge", lambda: __import__("lacuna_api.control.forge_verbs", fromlist=["section"]).section()),
            ("sentinel", lambda: __import__("lacuna_api.control.sentinel", fromlist=["check"]).check(raise_alert)),
            ("triggers", lambda: __import__("lacuna_api.control.triggers", fromlist=["section"]).section()))


def evaluate():
    for name, fn in SECTIONS:
        _guarded(name, fn)
    # forget old per-class keys so a class can alert again after six hours
    cut = time.time() - 6 * 3600
    for k in [k for k, v in _state.items() if k.startswith("cls:") and isinstance(v, float) and v < cut]:
        _state.pop(k, None)
    try:
        _save_said()
    except Exception as e:                                            # noqa: BLE001
        audit("lacuna", "said.save.error", error=f"{e.__class__.__name__}: {e}"[:200])


def sample():
    d = health.disk()
    m = health.memory()
    ups = {n: services._listening(s["port"]) for n, s in services.SERVICES.items()}
    c = errors.db()
    c.execute("CREATE TABLE IF NOT EXISTS samples (t REAL, name TEXT, value REAL)")
    now = time.time()
    rows = [(now, "disk_free_gb", d["free_gb"]), (now, "mem_available_gb", m["available_gb"]),
            (now, "mem_pressure", {"normal": 1, "warning": 2, "critical": 4}.get(m["pressure"], 0))]
    try:                                                        # swap kept as a series too (the hunt, H21: "no samples yet")
        sw = health.swap() if hasattr(health, "swap") else None
        if sw and sw.get("used_mb") is not None:
            rows.append((now, "swap_used_gb", round(sw["used_mb"] / 1024, 2)))
    except Exception:  # noqa: BLE001
        pass
    rows += [(now, f"up:{n}", 1.0 if u else 0.0) for n, u in ups.items()]
    with errors._lock:
        c.executemany("INSERT INTO samples VALUES (?,?,?)", rows)
        c.execute("DELETE FROM samples WHERE t < ?", (now - 14 * 86400,))


def series(name: str, hours: float = 24) -> list[dict]:
    c = errors.db()
    c.execute("CREATE TABLE IF NOT EXISTS samples (t REAL, name TEXT, value REAL)")
    with errors._lock:
        rows = c.execute("SELECT t, value FROM samples WHERE name=? AND t >= ? ORDER BY t", (name, time.time() - hours * 3600)).fetchall()
    return [{"t": t, "v": v} for t, v in rows]


def _bundles_to_keep(names: list[str], hourly: int = 3, daily: int = 3) -> set[str]:
    """Retention for lacuna-world-YYYYMMDD-HHMM.bundle names: the newest `hourly`, plus the newest per calendar day for the newest `daily` days."""
    ordered = sorted(names)
    keep = set(ordered[-hourly:])
    newest_per_day: dict[str, str] = {}
    for n in ordered:
        newest_per_day[n[len("lacuna-world-"):][:8]] = n
    for day in sorted(newest_per_day)[-daily:]:
        keep.add(newest_per_day[day])
    return keep


def _snapshot_world() -> None:
    """THE WORLD, SNAPSHOT HOURLY (2026-10-19: a stray `rm -rf ~` erased ~/lacuna-world and only the 03:45 backup was left):
    commit what changed in ~/lacuna-world, then a git bundle of it into ~/Lacuna-Backups (outside the world), 12 kept."""
    import subprocess
    world, out = Path.home() / "lacuna-world", Path.home() / "Lacuna-Backups" / "world-hourly"
    if not (world / ".git").exists():
        return
    # ONCE AN HOUR, NEVER FROM A TEST OR A RESTART (2026-10-20: every watcher pass that started with its clocks at zero — each API restart,
    # each test run — wrote a 1.2 GB bundle: 31 GB in an afternoon, the disk at 97%, and the pass blocked for two minutes)
    if LACUNA_HOME != Path.home() / ".lacuna" or os.environ.get("LACUNA_NO_SNAPSHOT"):
        return
    out.mkdir(parents=True, exist_ok=True)
    newest = max((f.stat().st_mtime for f in out.glob("lacuna-world-*.bundle")), default=0)
    if time.time() - newest < 50 * 60:
        return
    subprocess.run(["git", "-C", str(world), "add", "-A"], capture_output=True, timeout=120)
    subprocess.run(["git", "-C", str(world), "commit", "-q", "-m", "hourly: the world as it stands", "--no-verify"],
                   capture_output=True, timeout=120)
    dest = out / f"lacuna-world-{time.strftime('%Y%m%d-%H%M')}.bundle"   # minutes: two runs in one hour collided on a lock
    r = subprocess.run(["git", "-C", str(world), "bundle", "create", str(dest), "--all"], capture_output=True, text=True, timeout=600)
    if r.returncode:
        raise_alert("backup:world-hourly", "warn", "the hourly snapshot of ~/lacuna-world failed", (r.stderr or "")[-300:], notify=False)
        return
    keep = _bundles_to_keep([f.name for f in out.glob("lacuna-world-*.bundle")])      # 3 hourly + 3 daily (each is ~1.2 GB)
    for old in out.glob("lacuna-world-*.bundle"):
        if old.name not in keep:
            old.unlink(missing_ok=True)
    audit("lacuna", "world.snapshot", bundle=dest.name, mb=round(dest.stat().st_size / 1e6, 1))


def _profile_of(path: Path) -> dict:
    """The provisioning profile embedded in a build, decoded (`security cms -D`), or {} when it cannot be read."""
    import plistlib
    raw = subprocess.run(["security", "cms", "-D", "-i", str(path)], capture_output=True, timeout=20).stdout
    try:
        return plistlib.loads(raw) if raw else {}
    except Exception:  # noqa: BLE001  — an unreadable profile is no profile: the watch does nothing and says nothing
        return {}


def _ipad_profile_watch() -> None:
    """THE IPAD APP NEVER EXPIRES ON HER (2026-10-19: a free-team profile lasts 7 days; on the 8th the iPad says "app not
    available"). The newest kept build's profile is read every hour. A profile renews only at a build after it expires
    (2026-11-01: eleven rebuilds in its last 36 h kept the profile of 10-26; on 10-26 the build two minutes past the old
    one's end took a new one), so 36 h out Lacuna says once when the app stops, and past the expiry it rebuilds the same
    commit and installs it once: a job like any other (Work, the stuck watch, its log). Once per profile: the mark names
    the profile by its UUID, never by the build's path, which every rebuild changes (P-2026-11-01-ipad-refresh-loop: the
    path rebuilt and reinstalled it on her iPad every hour). Never from a test, a clone or a scratch home, the world
    snapshot's guard: a test's pass read the live builds with a scratch mark and started a real build and install."""
    if LACUNA_HOME != Path.home() / ".lacuna":
        return
    builds = sorted((LACUNA_HOME / "builds").glob("*-main-*/CuratorShell.app/embedded.mobileprovision"))
    if not builds:
        return
    prof = builds[-1]
    p = _profile_of(prof)
    exp, uuid = p.get("ExpirationDate"), p.get("UUID")
    if not exp or not uuid:
        return
    # plistlib's dates are naive UTC; `timestamp()` on a naive date reads local time and put every expiry 5 h late (EST)
    from datetime import timezone
    end_s = (exp if exp.tzinfo else exp.replace(tzinfo=timezone.utc)).timestamp()
    left_h = (end_s - time.time()) / 3600
    if left_h > 36:
        return
    mark = LACUNA_HOME / "ipad-refresh.json"
    try:
        done = json.loads(mark.read_text())
    except Exception:  # noqa: BLE001
        done = {}
    phase = "expired" if left_h <= 0 else "soon"
    if done.get(phase) == uuid:
        return
    ends = time.strftime("%Y-%m-%d %H:%M UTC", time.gmtime(end_s))
    if phase == "soon":
        done.update(soon=uuid, t=time.time())
        mark.write_text(json.dumps(done))
        raise_alert("ipad:profile", "warn", f"the iPad's app profile expires in {left_h:.0f} h ({ends})",
                    "a rebuild before then keeps the same profile; Lacuna rebuilds main and installs it once, right after it "
                    "expires (the app is unavailable on her iPad until that install lands)", notify=True)
        return
    from .core import start_job
    sha = prof.parent.parent.name.split("-main-")[-1]
    outdir = LACUNA_HOME / "builds" / f"{time.strftime('%Y%m%d-%H%M%S')}-main-{sha}"
    tool = Path(__file__).resolve().parents[3] / "toolbox"
    j = start_job("build", "the iPad's profile expired: rebuild main once to take a new profile and install it (ipad-refresh)",
                  ["/bin/bash", "-c", f'export DEVELOPER_DIR=/Applications/Xcode.app/Contents/Developer; bash "{tool}/build-ipad.sh" main "{outdir}" '
                                      f'&& bash "{tool}/install-ipad.sh" "{outdir}"'], "lacuna:ipad-refresh")
    done.update(expired=uuid, job=j.id, t=time.time())
    mark.write_text(json.dumps(done))
    raise_alert("ipad:profile", "warn", f"the iPad's app profile expired at {ends}: Lacuna is rebuilding main once and installing it",
                f"job {j.id}; the same commit ({sha}); if the iPad then asks, trust the developer in Settings → General → "
                "VPN & Device Management", notify=True)


def _loop():
    """The watcher's thread. Nothing that happens in one pass may end it: every section has its own guard
    and `_pass` itself is guarded, so a raise anywhere is one audit line and the next pass two seconds on."""
    state = {"last_min": 0.0, "last_day": 0.0, "last_hour": 0.0, "last_model": 0.0}
    while True:
        try:
            _pass(state)
        except Exception as e:
            audit("lacuna", "pass.error", error=f"{e.__class__.__name__}: {e}"[:200])
        time.sleep(2)


def _pass(state: dict):
    last_min, last_day, last_hour, last_model = state["last_min"], state["last_day"], state["last_hour"], state["last_model"]
    if True:
        upkeep.beat["t"] = time.time()
        upkeep.beat["passes"] += 1
        try:
            errors.ingest_once()
        except Exception as e:
            audit("lacuna", "ingest.error", error=f"{e.__class__.__name__}: {e}"[:200])
        now = time.monotonic()   # the cadences ride a clock that never steps backwards (L29); the heartbeat above is wall time
        if now - last_min >= 60:
            last_min = now
            for fn in (sample, evaluate):
                try:
                    fn()
                except Exception as e:
                    audit("lacuna", f"{fn.__name__}.error", error=f"{e.__class__.__name__}: {e}"[:200])
            try:                                     # THE WORK QUEUE: one item after another while it is on (workqueue.py)
                from . import workqueue
                workqueue.tick()
            except Exception as e:
                audit("lacuna", "work.error", error=f"{e.__class__.__name__}: {e}"[:200])
            try:                                     # a job past its kind's usual time is said, with where (stuck.py)
                from . import stuck
                stuck.check(raise_alert, resolve_alert)
            except Exception as e:
                audit("lacuna", "stuck.error", error=f"{e.__class__.__name__}: {e}"[:200])
        # the model Lacuna thinks with, every 20 s (modelwatch.py: alive · present · answers; restarts Ollama when it
        # stops). Its own cadence, not the minute pass: the check is a 2 s version ping, and at 1/min the drill took
        # 100 s to call Ollama down — two misses at 20 s say it in ~40 s.
        if now - last_model >= 20:
            last_model = now
            try:
                from .chat import MODEL
                modelwatch.check(MODEL, raise_alert)
            except Exception as e:
                audit("lacuna", "modelwatch.error", error=f"{e.__class__.__name__}: {e}"[:200])
        if now - last_hour >= 3600:
            last_hour = now
            def _condense():                                # the hour's talk, condensed into the cortex (condense.py)
                from . import condense as _c
                _c.condense()
            def _in_thread(fn):                             # the snapshot is a 1 GB git bundle (2 minutes): never on the watcher's own thread
                threading.Thread(target=fn, name=f"hourly-{fn.__name__}", daemon=True).start()
            # the hour's acts reach the live box (the world's bundle, her iPad, the cortex): never from a test, a clone or a
            # scratch home (P-2026-11-01-ipad-refresh-loop; each act keeps its own guard as well)
            live = LACUNA_HOME == Path.home() / ".lacuna"
            for fn in ((lambda: _in_thread(_snapshot_world), _ipad_profile_watch, _condense) if live else ()):   # what bit us on 2026-10-19, watched every hour
                try:
                    fn()
                except Exception as e:
                    audit("lacuna", f"{fn.__name__}.error", error=f"{e.__class__.__name__}: {e}"[:200])
            try:
                for r in upkeep.rotate_all():
                    raise_alert(f"rotate:{r['path']}", "info", "log rotated", f"{r['path']} ({r['bytes'] // 1_000_000} MB) archived", notify=False)
                upkeep.own_files()
            except Exception as e:
                audit("lacuna", "upkeep.error", error=f"{e.__class__.__name__}: {e}"[:200])
        if now - last_day >= 86400:
            last_day = now
            try:
                errors.prune()
            except Exception:
                pass
        state.update(last_min=last_min, last_day=last_day, last_hour=last_hour, last_model=last_model)


_thread: Optional[threading.Thread] = None


def start():
    global _started, _thread
    if os.environ.get("LACUNA_NO_WORKERS") == "1":
        return
    if _thread is not None and _thread.is_alive():
        return
    if _started:
        audit("lacuna", "workers.restarted", note="the worker thread had died; a request brought it back")
    _started = True
    _load_said()
    _thread = threading.Thread(target=_loop, name="lacuna-workers", daemon=True)
    _thread.start()
    _start_sentinel()
    try:                                         # finished jobs wake Lacuna, between turns (control/wake.py)
        from . import wake as _wake
        _wake.start()
    except Exception as e:  # noqa: BLE001
        audit("lacuna", "wake.start-failed", error=f"{e.__class__.__name__}: {e}"[:160])
    # the boot report: what came back after a reboot or a restart of the console (control/boot.py)
    try:
        from . import boot as _boot
        _boot.start(raise_alert)
    except Exception as e:
        audit("lacuna", "boot.error", error=f"{e.__class__.__name__}: {e}"[:200])


# ★ A WATCHER FOR THE WATCHER (phase 13, 2026-09-25). `ensure()` brought a dead worker thread back only when a
# REQUEST arrived — at 3 a.m. with nobody on the console, a dead watcher stayed dead. The sentinel is its own thread:
# every 30 s it reads the heartbeat; a worker that has not beaten in 90 s, or is not alive, is started again and the
# restart is SAID. launchd's KeepAlive covers the process; this covers the thread inside it.
SENTINEL_EVERY_S = 30
SENTINEL_STALE_S = 90
_sentinel: Optional[threading.Thread] = None


def _sentinel_loop():
    global _thread
    while True:
        time.sleep(SENTINEL_EVERY_S)
        try:
            dead = _thread is None or not _thread.is_alive()
            age = time.time() - float(upkeep.beat.get("t") or 0)
            if dead or age > SENTINEL_STALE_S:
                why = "the worker thread is dead" if dead else f"no heartbeat for {int(age)} s"
                audit("lacuna", "workers.sentinel", why=why)
                if not dead:
                    continue      # alive but silent: a long ingest pass; say it, do not kill a live thread
                _thread = threading.Thread(target=_loop, name="lacuna-workers", daemon=True)
                _thread.start()
                raise_alert("watcher:restarted", "warn", "Lacuna's watcher was restarted", why + " — started again by the sentinel", notify=False)
        except Exception as e:                                        # noqa: BLE001 — the sentinel itself never dies
            audit("lacuna", "sentinel.error", error=f"{e.__class__.__name__}: {e}"[:200])


def _start_sentinel():
    global _sentinel
    if _sentinel is not None and _sentinel.is_alive():
        return
    _sentinel = threading.Thread(target=_sentinel_loop, name="lacuna-sentinel", daemon=True)
    _sentinel.start()


def ensure():
    """Called on every request: a dead worker thread is started again (the watcher must not quietly stop watching)."""
    if _started and (_thread is None or not _thread.is_alive()):
        start()
