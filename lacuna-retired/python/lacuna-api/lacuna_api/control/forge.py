"""THE FORGE, READ (LACUNA-1.3-DESIGN §40–§41; the owner, 2026-10-18: "finally Forge has a home") — what the forge card
and GET /api/forge show. Read only: the forge (~/lacuna-world/forge) and its errands (~/lacuna-world/jobs/forge-*) are
written by other hands while this reads them, so every piece may be missing, half-written or in a layout still forming.

  summary()     {now, started, doc, specialists:[row…], errands:[…], waiting:[…]} — one read for the card
  specialist()  one row: pairs written / kept / dropped (by which check), the training run (base, method, step, the loss
                series, minutes, peak memory and swap seen), the eval (trained vs untrained per held-out set: accuracy and
                latency), the exported model, the state chip

WHAT IT READS (whatever exists; nothing is required; the forge's layout as of 2026-10-18, older shapes tolerated):
  forge/STARTED · forge/FORGE.md         begun (a line per training start) · its notes (the first line is the subtitle)
  jobs/forge-pairs-w1|w2, jobs/forge-sft  the errands: job.json state, .runner.json pid (= running), progress.json, run.log
  forge/data/w1|w2/                      votes.jsonl / targets.jsonl (a row with a label/answer is kept, else its `why` is
                                         the check that dropped it) · DONE {kept, train, test} · or kept/train/test.jsonl
  forge/runs/<model>-w1|w2/train.log     "step 10/400 loss 2.31 … swap 1.2 GB" (or MLX's "Iter 10: Train loss …"); a
                                         pilot then the real run (the step goes back: a new series); "chose lora"
  forge/results/<model>-w1|w2.json       {model, job, mode, steps, held_out, untrained:{accuracy,n}, trained:{…}, wins,
                                         gguf} — or {specialist, set, before|after:{accuracy, latency_ms}, model}
LACUNA_WORLD moves ~/lacuna-world; LACUNA_HOME moves ~/.lacuna (decisions: forge-decisions.jsonl). Tests never read live.
"""
from __future__ import annotations

import json
import os
import re
import time
from pathlib import Path

from .forge_results import beats, results  # forge/results/*.json (its own module; it reads through this one)

SPECIALISTS = [
    {"id": "sentry", "name": "Sentry", "work": "W1", "job": "log triage: a line → noise · real-error · regression · new · recovered",
     "role": "log triage (W1)", "keys": ("w1", "sentry"), "pairs": "forge-pairs-w1"},
    {"id": "worker", "name": "Worker", "work": "W2", "job": "command → one agent verb, or nothing fits",
     "role": "the switchboard (W2)", "keys": ("w2", "worker"), "pairs": "forge-pairs-w2"},
    {"id": "conductor", "name": "Conductor", "work": "—", "job": "later", "role": "conductor", "keys": ("conductor",), "pairs": None,
     "later": True},
]
BY_ID = {s["id"]: s for s in SPECIALISTS}
MAX_FILES, MAX_POINTS = 400, 240             # a forge that grows a million files is read in bounded slices


def world() -> Path:
    return Path(os.environ.get("LACUNA_WORLD") or Path.home() / "lacuna-world")


def forge_dir() -> Path:
    return world() / "forge"


def jobs_dir() -> Path:
    return world() / "jobs"


def lacuna_home() -> Path:
    return Path(os.environ.get("LACUNA_HOME") or Path.home() / ".lacuna")


def _read(p: Path):
    try:
        return json.loads(p.read_text())
    except (OSError, ValueError):
        return None


def _num(v):
    try:
        return float(v) if v is not None and v != "" and not isinstance(v, bool) else None
    except (TypeError, ValueError):
        return None


def _i(v):
    return int(v) if v is not None else None


def _first(d: dict, *keys):
    for k in keys:
        if isinstance(d, dict) and d.get(k) not in (None, ""):
            return d[k]
    return None


def _tail(p: Path, n: int = 400, cap: int = 200_000) -> list[str]:
    try:
        with p.open("rb") as f:
            f.seek(0, 2)
            size = f.tell()
            f.seek(max(0, size - cap))
            return f.read().decode("utf-8", "replace").splitlines()[-n:]
    except OSError:
        return []


def _lines(p: Path) -> int:
    try:
        with p.open("rb") as f:
            return sum(1 for ln in f if ln.strip())
    except OSError:
        return 0


def _keyed(text: str, spec: dict) -> bool:
    t = text.lower()
    return any(re.search(rf"(^|[^a-z0-9]){re.escape(k)}([^a-z0-9]|$)", t) for k in spec["keys"])


# ── errands ────────────────────────────────────────────────────────────────────────────────────────────────────────────
def errand(name: str) -> dict:
    d = jobs_dir() / name
    job = _read(d / "job.json")
    if not isinstance(job, dict):
        return {"name": name, "present": False}
    rs = _read(d / ".runner.json") or {}
    prog = _read(d / "progress.json")
    return {"name": name, "present": True, "state": job.get("state", "on"), "goal": str(job.get("goal") or "")[:200],
            "running": bool(rs.get("pid")) and job.get("state", "on") == "on", "started": rs.get("started"),
            "runs": rs.get("runs", 0), "last_exit": rs.get("last_exit"),
            "progress": prog if isinstance(prog, dict) else {}, "run": str(job.get("run") or "")[:400],
            "tail": [ln[:240] for ln in _tail(d / "run.log", 6)]}


def errands() -> list[dict]:
    try:
        names = sorted(p.name for p in jobs_dir().iterdir() if p.name.startswith("forge") and (p / "job.json").exists())
    except OSError:
        names = []
    return [errand(n) for n in names]


def train_errands(spec_id: str) -> list[str]:
    return [f"forge-sft-{spec_id}", "forge-sft"]


# ── pairs ──────────────────────────────────────────────────────────────────────────────────────────────────────────────
def _spec_dirs(spec: dict) -> list[Path]:
    out = []
    root = forge_dir()
    for parent in (root, root / "pairs", root / "data", root / "runs"):
        try:
            out += [p for p in parent.iterdir() if p.is_dir() and _keyed(p.name, spec)]
        except OSError:
            pass
    return out


def _files(d: Path, pattern: str) -> list[Path]:
    try:
        return sorted(d.rglob(pattern))[:MAX_FILES]
    except OSError:
        return []


def _drops_into(by: dict, src) -> None:
    if isinstance(src, dict):
        for k, v in src.items():
            if _num(v) is not None:
                by[str(k)] = by.get(str(k), 0) + int(_num(v))


def pairs(spec: dict) -> dict:
    """Pairs written, kept and dropped (by which machine check) for one specialist."""
    by: dict[str, int] = {}
    kept = written = None
    job = errand(spec["pairs"]) if spec.get("pairs") else {"present": False}
    p = job.get("progress") or {}
    for d in _spec_dirs(spec):
        votes = [f for f in _files(d, "*.jsonl") if re.match(r"(votes|targets|answers|labels)", f.name)]
        if votes:                                  # the writers' own state: a row with a label/answer is kept, else why
            k = n = 0
            for f in votes:
                for ln in _tail(f, 50_000, 20_000_000):
                    try:
                        r = json.loads(ln)
                    except ValueError:
                        continue
                    if not isinstance(r, dict):
                        continue
                    n += 1
                    if r.get("label") or r.get("answer"):
                        k += 1
                    else:
                        why = re.split(r"[:;]", str(_first(r, "why", "check", "dropped_by") or "unnamed"))[0].strip()[:40]
                        by[why] = by.get(why, 0) + 1
            kept, written = float(k), float(n)
        done = _read(d / "DONE")
        if isinstance(done, dict) and _num(done.get("kept")) is not None:
            kept = _num(done["kept"])
        for f in _files(d, "*.json"):
            if f.name in ("stats.json", "summary.json", "pairs.json"):
                s = _read(f) or {}
                kept = kept if kept is not None else _num(_first(s, "kept", "pairs_kept"))
                written = written if written is not None else _num(_first(s, "written", "total", "pairs"))
                if not by:
                    _drops_into(by, _first(s, "dropped_by", "drops", "by_check"))
        if kept is None:
            n = sum(_lines(f) for f in _files(d, "*.jsonl") if re.match(r"(kept|pairs|train|valid|test)", f.name))
            kept = float(n) if n else None
        if not by:
            for f in _files(d, "dropped*.jsonl"):
                for ln in _tail(f, 5000, 2_000_000):
                    try:
                        r = json.loads(ln)
                    except ValueError:
                        continue
                    k = str(_first(r, "check", "dropped_by", "why", "reason") or "unnamed")[:40] if isinstance(r, dict) else "unnamed"
                    by[k] = by.get(k, 0) + 1
    if p and kept is None:                         # nothing on disk yet: the errand's own words, when it names them
        kept = _num(_first(p, "kept", "pairs_kept"))
        written = _num(_first(p, "written", "pairs"))
        if not by:
            _drops_into(by, _first(p, "dropped_by", "drops", "by_check"))
    dropped = _num(p.get("dropped")) if p and p.get("dropped") is not None else None
    if dropped is None and by:
        dropped = float(sum(by.values()))
    if written is None and kept is not None:
        written = kept + (dropped or 0)
    return {"errand": spec.get("pairs"), "present": job.get("present", False), "state": job.get("state"),
            "running": job.get("running", False), "written": _i(written), "kept": _i(kept), "dropped": _i(dropped),
            "dropped_by": dict(sorted(by.items(), key=lambda kv: -kv[1])[:6]), "total": _i(_num(p.get("total"))) if p else None,
            "note": str(p.get("note") or "")[:160] if p else ""}


# ── training ───────────────────────────────────────────────────────────────────────────────────────────────────────────
TRAIN = re.compile(r"Iter\s+(\d+):\s*Train loss\s+([\d.]+)", re.I)
VAL = re.compile(r"Iter\s+(\d+):\s*Val loss\s+([\d.]+)", re.I)
STEP = re.compile(r"\bstep\s*[=:]?\s*(\d+)(?:/(\d+))?\b.*?\bloss\s*[=:]?\s*([\d.]+)", re.I)
CHOSE = re.compile(r"\bchose\s+(lora|dora|qlora|full)\b", re.I)
MEM = re.compile(r"Peak mem\s+([\d.]+)\s*GB", re.I)
SWAP = re.compile(r"swap\D{0,20}([\d.]+)\s*(GB|MB|G|M)\b", re.I)
BASE = re.compile(r"((?:function)?gemma[\w.:/-]*)", re.I)
METHOD = re.compile(r"\b(lora|dora|qlora|full)\b", re.I)


def parse_log(lines: list[str]) -> dict:
    """MLX-LM's training lines (and a plain 'step N … loss X') → the loss series, peak memory and swap seen."""
    train, val, mem, swap, base, method, total, chose = [], [], None, None, None, None, None, None
    for ln in lines:
        m = TRAIN.search(ln)
        pt = [int(m.group(1)), float(m.group(2))] if m else None
        if not m and not VAL.search(ln) and (st := STEP.search(ln)):
            pt = [int(st.group(1)), float(st.group(3))]
            total = int(st.group(2)) if st.group(2) else total
        if pt:
            if train and pt[0] <= train[-1][0]:    # the step went back: a new run (a pilot, then the real one) starts
                train = []
            train.append(pt)
        v = VAL.search(ln)
        if v:
            val.append([int(v.group(1)), float(v.group(2))])
        if (mm := MEM.search(ln)):
            mem = max(mem or 0.0, float(mm.group(1)))
        if (sw := SWAP.search(ln)):
            g = float(sw.group(1)) / (1024 if sw.group(2).upper().startswith("M") else 1)
            swap = max(swap or 0.0, g)
        if base is None and (b := BASE.search(ln)):
            base = b.group(1).rstrip(".,:;")
        if (mt := METHOD.search(ln)):
            method = mt.group(1).lower()
        if (ch := CHOSE.search(ln)):
            chose = ch.group(1).lower()
    base = re.sub(r"-w\d+$", "", base) if base else base
    return {"loss": _thin(train), "val": _thin(val), "peak_mem_gb": mem, "swap_gb": swap, "base": base,
            "method": chose or method, "total": total}


def _thin(pts: list) -> list:
    step = max(1, len(pts) // MAX_POINTS)
    out = pts[::step]
    if pts and out[-1] != pts[-1]:
        out.append(pts[-1])
    return out


def _segment(lines: list[str], spec: dict) -> list[str]:
    """A shared log: the lines after one that names this specialist, until another is named (none named: all)."""
    named = [s for s in SPECIALISTS if any(_keyed(ln, s) for ln in lines)]
    if not named:
        return lines
    out, mine = [], False
    for ln in lines:
        hit = [s for s in SPECIALISTS if _keyed(ln, s)]
        if hit:
            mine = spec in hit
        if mine:
            out.append(ln)
    return out


def _current(lines: list[str], said: str | None) -> str:
    """Whom a shared forge-sft trains now: progress.json's word, else the last named in its log, else W1 (§40.3)."""
    if said in BY_ID:
        return said
    for ln in reversed(lines):
        hit = [s for s in SPECIALISTS if _keyed(ln, s)]
        if hit:
            return hit[0]["id"]
    return SPECIALISTS[0]["id"]


def _born(f: Path) -> float:
    try:
        st = f.stat()
        return getattr(st, "st_birthtime", st.st_ctime)
    except OSError:
        return 0.0


def _mtime(f: Path) -> float:
    try:
        return f.stat().st_mtime
    except OSError:
        return 0.0


def training(spec: dict) -> dict:
    run = None
    for name in train_errands(spec["id"]):
        e = errand(name)
        if e["present"]:
            run = e
            break
    mine = False
    own = sorted((f for d in _spec_dirs(spec) for f in _files(d, "*.log")[:8]), key=_mtime)
    fresh = lambda fs: any(time.time() - _mtime(f) < 600 for f in fs)  # noqa: E731
    lines = _tail(own[-1], 6000, 1_500_000) if own else []      # its own run's log: forge/runs/<model>-<job>/train.log
    if run:
        raw = _tail(jobs_dir() / run["name"] / "run.log", 6000, 1_500_000)
        if not own:
            lines = _segment(raw, spec)
        others = [f for s in SPECIALISTS if s is not spec for d in _spec_dirs(s) for f in _files(d, "*.log")[:8]]
        # a shared trainer that is only WAITING (for pairs, weights, memory) trains nobody: it is training this one when
        # this one's run log is being written — or, with no run logs at all, when its own lines carry loss for this one
        mine = run["name"] != "forge-sft" or fresh(own) or (not own and not others and bool(parse_log(lines)["loss"])
                                                            and _current(raw, (run.get("progress") or {}).get("specialist")) == spec["id"])
    got = parse_log(lines)
    if own or not got["loss"]:   # the run's folder is <model>-<job>; a shared errand's waiting lines name untrained models
        got["base"], got["method"] = (re.sub(r"-w\d+$", "", own[-1].parent.name), got["method"]) if own else (None, None)
    p = (run or {}).get("progress") or {}
    if p and (p.get("specialist") in (None, spec["id"])):
        got["base"] = p.get("base") or got["base"]
        got["method"] = p.get("method") or got["method"]
    step = got["loss"][-1][0] if got["loss"] else _i(_num(p.get("step")))
    minutes = None
    if run and run.get("started"):
        minutes = round((time.time() - float(run["started"])) / 60, 1) if run.get("running") else None
    running = bool(run and run.get("running") and mine)
    return {"errand": (run or {}).get("name"), "present": bool(run), "running": running, "state": (run or {}).get("state"),
            "started": (run or {}).get("started"), "run": f"{own[-1].parent.name}@{int(_born(own[-1]))}" if own else None, "step": step, "total": got.pop("total") or _i(_num(_first(p, "iters", "steps"))),
            "minutes": minutes, **got, "last": got["loss"][-1][1] if got["loss"] else _num(p.get("loss"))}


# ── the owner's decisions ──────────────────────────────────────────────────────────────────────────────────────────────
def decisions() -> list[dict]:
    try:
        rows = (lacuna_home() / "forge-decisions.jsonl").read_text().splitlines()
    except OSError:
        return []
    out = []
    for ln in rows[-200:]:
        try:
            out.append(json.loads(ln))
        except ValueError:
            pass
    return out


def waiting() -> list[dict]:
    try:
        from . import chat
        return [{"id": p["id"], "action": p["action"], "effect": p["effect"][:240], "specialist": (p.get("args") or {}).get("specialist")}
                for p in chat.petitions() if p["state"] == "waiting" and str(p["action"]).startswith("forge-")]
    except Exception:  # noqa: BLE001 — the card stands without the petitions
        return []


# ── one row, and the whole ─────────────────────────────────────────────────────────────────────────────────────────────
def specialist(spec: dict, res: list[dict], asks: list[dict], decided: list[dict]) -> dict:
    pr = pairs(spec) if spec.get("pairs") else {"present": False}
    tr = training(spec)
    mine = [r for r in res if r["specialist"] == spec["id"]]
    ev = next((r for r in reversed(mine) if r["after"] or r["before"]), None)
    last = mine[-1] if mine else None
    if not tr["loss"] and last and last["loss"]:
        tr["loss"] = last["loss"]
    for k in ("base", "method", "peak_mem_gb", "swap_gb", "minutes"):
        if tr.get(k) is None and last and last.get(k) is not None:
            tr[k] = last[k]
    won = beats(ev)
    dec = next((d for d in reversed(decided) if d.get("specialist") == spec["id"]), None)
    ask = [a for a in asks if a.get("specialist") == spec["id"]]
    model = next((r["model"] for r in reversed(mine) if r.get("model")), None)
    if spec.get("later") and not (mine or tr["loss"]):
        state = "later"
    elif ask:
        state = "your press"
    elif dec and dec.get("approved"):
        state = "in service (decided)"
    elif tr["running"]:
        state = "training"
    elif pr.get("running"):
        state = "writing pairs"
    elif ev:
        state = "wins" if won else "loses" if won is False else "evaluated"
    elif tr["loss"]:
        state = "trained"
    elif pr.get("kept"):
        state = "pairs ready"
    else:
        state = "not started"
    return {"id": spec["id"], "name": spec["name"], "work": spec["work"], "job": spec["job"], "role": spec["role"],
            "later": bool(spec.get("later")), "state": state, "pairs": pr, "train": tr, "eval": ev, "beats": won,
            "model": model, "petitions": ask, "decision": dec, "card": f"s-forge-{spec['id']}", "doing": _doing(state, pr, tr, ev, won)}


def _doing(state: str, pr: dict, tr: dict, ev, won) -> str:
    """The task card's one line: what this specialist's forge is doing now."""
    if state == "training":
        return f"training — step {tr.get('step') or 0}{'/' + str(tr['total']) if tr.get('total') else ''}" + \
            (f", loss {tr['last']:.3f}" if tr.get("last") is not None else "")
    if state == "writing pairs":
        return f"writing pairs — {pr.get('kept') or 0} kept" + (f" of {pr['written']} voted" if pr.get("written") else "")
    if ev:
        return f"evaluated — it {'beats' if won else 'does not beat' if won is False else 'was measured against'} the untrained mind"
    return {"your press": "waiting on your press", "in service (decided)": "you put it in service (recorded)",
            "pairs ready": f"{pr.get('kept')} pairs ready — waiting for training", "later": "later"}.get(state, "not started")


def _now(rows: list[dict], asks: list[dict], started: bool) -> str:
    for r in rows:
        t = r["train"]
        if t["running"]:
            bits = [b for b in (t.get("base"), (t.get("method") or "").upper() or None) if b]
            step = f" — step {t['step']}" if t.get("step") else ""
            loss = f", loss {t['last']:.3f}" if t.get("last") is not None else ""
            return f"Training {r['name']}{' (' + ', '.join(bits) + ')' if bits else ''}{step}{loss}."
    for r in rows:
        if r["pairs"].get("running"):
            k = r["pairs"].get("kept")
            return f"Writing {r['name']}'s training pairs{f' — {k} kept so far' if k is not None else ''}."
    if asks:
        return f"Waiting on your press: {asks[0]['effect'][:140]}"
    done = [r for r in rows if r["eval"]]
    if done:
        r = done[-1]
        return f"Idle. Last: {r['name']} evaluated — it {'beats' if r['beats'] else 'does not beat' if r['beats'] is False else 'was measured against'} the untrained mind."
    return "Idle — no pairs written, no training run yet." if not started else "Started — nothing is running right now."


def summary() -> dict:
    root = forge_dir()
    started = (root / "STARTED").exists()
    doc = ""
    try:
        doc = next((ln.lstrip("# ").strip() for ln in (root / "FORGE.md").read_text().splitlines() if ln.strip()), "")[:160]
    except OSError:
        pass
    res, asks, dec = results(), waiting(), decisions()
    rows = [specialist(s, res, asks, dec) for s in SPECIALISTS]
    return {"t": time.time(), "present": root.exists(), "started": started, "doc": doc, "now": _now(rows, asks, started),
            "specialists": rows, "errands": [{k: e.get(k) for k in ("name", "present", "state", "running", "tail")} for e in errands()],
            "waiting": asks, "busy": any(r["train"]["running"] for r in rows)}

