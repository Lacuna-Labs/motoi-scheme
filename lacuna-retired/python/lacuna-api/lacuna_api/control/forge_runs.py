"""THE FORGE'S RUNS AND MINDS, READ FROM THE BOX (the owner, 2026-10-20: "forge never shows live trainings or records of runs. And I don't
know if the LLM has any introspection into this at all" · "let it understand the inventory of minds and how to make them").

  runs()     what trains NOW (the forge errands' own logs: model, step of total, loss, swap, the newest phase lines; and every Forge job
             the hands started by kind, `<forge runs>/job-<worker>/`, live while its trainer runs or is paused, its worker its id:
             F5, CARDS-2.0 §9.3 step 4) and the record of every finished run (forge/results/*.json and the kept folders beside
             it: before-retrain-*, before-wipe-*), newest first
  minds()    the inventory: every mind in the pantheon (forge/pantheon.json) and the two first specialists, with its base model, its job, its
             pairs, its best result and whether it serves — and the four steps that make one
  the chat's `forge op=runs` and `forge op=minds`; GET /api/forge/runs and /minds are the door's (lacuna-node/frontend/forge-reads.mjs,
  2026-11-06, finale §3.12).
Nothing here starts or stops anything.
"""
from __future__ import annotations

import json
import os
import re
import subprocess
import time
from pathlib import Path

STEP = re.compile(r"^(\d\d:\d\d:\d\d) \[([^\]]+)\] (?:(pilot \w+): )?step (\d+)/(\d+) loss ([\d.]+)(?: (\d+) s)?(?: swap ([\d.]+) GB)?")
PHASE = re.compile(r"^(\d\d:\d\d:\d\d) \[([^\]]+)\] (.+)$")
FORGE_ERRANDS = re.compile(r"^(forge|pantheon)", re.I)
JOB_DIR = re.compile(r"^job-(w-[A-Za-z0-9_-]{1,38})$")                       # forge-train.mjs jobDir: <runs>/job-<worker>
JOB_STEP = re.compile(r"^(\d\d:\d\d:\d\d) step (\d+)/(\d+) loss ([\d.]+)(?: (\d+) s)?(?: swap ([\d.]+) GB)?")   # forge_sft.py job's log line


def _world() -> Path:
    return Path(os.environ.get("LACUNA_WORLD") or Path.home() / "lacuna-world")


def _alive(pid) -> bool:
    try:
        os.kill(int(pid), 0)
        return True
    except (OSError, TypeError, ValueError):
        return False


def _tail(p: Path, n: int = 400) -> list[str]:
    try:
        with open(p, "rb") as f:
            f.seek(0, 2)
            f.seek(max(0, f.tell() - 120_000))
            return f.read().decode(errors="replace").splitlines()[-n:]
    except OSError:
        return []


def _live(errand: Path) -> dict | None:
    try:
        rs = json.loads((errand / ".runner.json").read_text())
    except (OSError, ValueError):
        rs = {}
    try:
        job = json.loads((errand / "job.json").read_text())
    except (OSError, ValueError):
        job = {}
    lines = _tail(errand / "run.log")
    started = next((i for i in range(len(lines) - 1, -1, -1) if lines[i].startswith("── ")), 0)
    run = lines[started:]
    step = None
    phases = []
    for ln in run:
        m = STEP.match(ln)
        if m:
            step = {"at": m.group(1), "model": m.group(2), "stage": m.group(3) or "train", "step": int(m.group(4)), "of": int(m.group(5)),
                    "loss": float(m.group(6)), "secs": int(m.group(7)) if m.group(7) else None, "swap_gb": float(m.group(8)) if m.group(8) else None}
        elif PHASE.match(ln) or "Error" in ln or "failed" in ln:
            phases.append(ln[:220])
    running = bool(rs.get("pid")) and _alive(rs.get("pid"))
    return {"errand": errand.name, "state": job.get("state"), "running": running, "waiting": rs.get("waiting"),
            "started": run[0][3:].split(" start")[0].strip() if run and run[0].startswith("── ") else None,
            "step": step, "phases": phases[-8:], "log": str(errand / "run.log").replace(str(Path.home()), "~")}


def _records() -> list[dict]:
    res = _world() / "forge" / "results"
    out = []
    for p in sorted(res.glob("*.json")) + sorted(res.glob("*/*.json")):
        try:
            d = json.loads(p.read_text())
        except (OSError, ValueError):
            continue
        if not isinstance(d, dict) or "headline" not in d:
            continue
        out.append({"file": str(p.relative_to(res)), "kept_in": p.parent.name if p.parent != res else "current", "model": d.get("model") or p.stem,
                    "headline": d.get("headline"), "steps": d.get("steps"), "method": d.get("method"), "at": p.stat().st_mtime,
                    "when": time.strftime("%Y-%m-%d %H:%M", time.localtime(p.stat().st_mtime))})
    return sorted(out, key=lambda r: -r["at"])


def _jobs_root() -> Path:
    """Where the hands start a Forge job by kind: `$LACUNA_FORGE_JOBS` (the hands' own variable), else the forge's runs dir."""
    env = os.environ.get("LACUNA_FORGE_JOBS")
    return Path(env) if env else (_world() / "forge" / "runs").resolve()


def _trainers() -> dict[str, tuple[int, str]]:
    """Every live forge trainer by its --run-dir: (pid, ps state). One `ps` per read; T in the state is a SIGSTOP (paused)."""
    try:
        out = subprocess.run(["/bin/ps", "-axo", "pid=,stat=,command="], capture_output=True, text=True, timeout=5).stdout
    except (OSError, subprocess.SubprocessError):
        return {}
    found = {}
    for ln in out.splitlines():
        parts = ln.split(None, 2)
        if len(parts) == 3 and "forge_sft.py job" in parts[2] and "--run-dir" in parts[2]:
            rest = parts[2].split("--run-dir", 1)[1].split()
            if rest:
                found[rest[0]] = (int(parts[0]), parts[1])
    return found


def _job(d: Path, trainers: dict) -> dict | None:
    """A Forge job the hands started (F5, CARDS-2.0 §9.3 step 4): live while its trainer runs (or is paused), from its own
    train.log; the foreman worker that runs it is its id. A parked or ended job is not live (its exit.json says why)."""
    m = JOB_DIR.match(d.name)
    t = trainers.get(str(d)) if m else None
    if not t:
        return None
    step, phases = None, []
    for ln in _tail(d / "train.log"):
        s = JOB_STEP.match(ln)
        if s:
            step = {"at": s.group(1), "model": None, "stage": "train", "step": int(s.group(2)), "of": int(s.group(3)), "loss": float(s.group(4)),
                    "secs": int(s.group(5)) if s.group(5) else None, "swap_gb": float(s.group(6)) if s.group(6) else None}
        elif PHASE.match(ln) or " job " in ln or "resumed" in ln:
            phases.append(ln[:220])
    paused = "T" in t[1]
    return {"errand": d.name, "worker": m.group(1), "state": "paused" if paused else "running", "running": True, "waiting": None,
            "started": None, "step": step, "phases": phases[-8:], "pid": t[0], "run_dir": str(d),
            "log": str(d / "train.log").replace(str(Path.home()), "~")}


def runs() -> dict:
    jobs = _world() / "jobs"
    live = [x for x in (_live(d) for d in sorted(jobs.glob("*")) if d.is_dir() and FORGE_ERRANDS.match(d.name)) if x and (x["running"] or x["step"] or x["phases"])]
    root, trainers = _jobs_root(), _trainers()
    started = [x for x in (_job(d, trainers) for d in sorted(root.glob("job-w-*")) if d.is_dir()) if x] if root.is_dir() else []
    from . import owner_first
    return {"live": [x for x in live if x["running"]] + started, "recent": [x for x in live if not x["running"]][:4], "records": _records()[:30],
            "paused_for_owner": owner_first.held()["paused"]}


def minds() -> dict:
    w = _world() / "forge"
    try:
        pantheon = json.loads((w / "pantheon.json").read_text()).get("minds") or []
    except (OSError, ValueError):
        pantheon = []
    recs = _records()
    try:
        roles = json.loads((Path.home() / "code/lacuna/lacuna-box/brain/box-minds.json").read_text()).get("roles") or {}
    except (OSError, ValueError):
        roles = {}
    weights = {d.name: (d / "READY").exists() for d in (w / "weights").glob("*") if d.is_dir()}
    out = []
    for m in pantheon:
        name, base = m.get("name"), m.get("base")
        data = w / "data" / f"p-{name}"
        best = next((r for r in recs if name and name.split("-")[0] in str(r["model"]) and r["kept_in"] == "current"), None)
        out.append({"name": name, "kind": m.get("kind"), "base": base, "base_ready": weights.get(base, False), "job": m.get("ask"),
                    "labels": list((m.get("labels") or {}).keys())[:8], "pairs_done": (data / "DONE").exists(), "pairs_target": m.get("target"),
                    "result": best["headline"] if best else None,
                    "serves": name in roles and Path(str((roles.get(name) or {}).get("model") or "")).exists()})
    for sp, model in (("sentry", "gemma-3-270m-it-w1"), ("worker", "functiongemma-270m-it-w2")):
        last = next((r for r in recs if model in str(r["file"])), None)
        out.append({"name": sp, "kind": "specialist (W1 log triage)" if sp == "sentry" else "specialist (W2 command → verb)", "base": model.rsplit("-", 1)[0],
                    "base_ready": weights.get(model.rsplit("-", 1)[0], False), "result": last["headline"] if last else None,
                    "result_kept_in": last["kept_in"] if last else None,
                    "serves": sp in roles and Path(str((roles.get(sp) or {}).get("model") or "")).exists()})      # a role whose file is gone is not served
    return {"minds": out, "base_weights": weights,
            "how_to_make_one": ["1 pairs — `forge op=pairs specialist=<name>` (a card): the Gemma brain writes and votes on pairs from real logs; never Claude's words",
                                "2 train — `forge op=train specialist=<name>` (a card): MLX on the base in forge/weights; watch it with `forge op=runs`",
                                "3 eval — the run scores untrained vs trained on the gold cases; the headline is in forge/results/<model>-<job>.json",
                                "4 serve — only at 90% on gold: `forge op=propose` (a card); the owner's press puts it in box-minds.json roles; `forge op=rollback` takes it back"],
            "rules": "90% on gold or it does not serve; one training at a time; memory-guarded; GGUF export needs torch in forge/.venv (installed 2026-10-20)."}


def runs_words() -> str:
    r = runs()
    lines = []
    for x in r["live"]:
        s = x["step"] or {}
        lines.append(f"TRAINING NOW: {x['errand']} · {s.get('model') or '?'} {s.get('stage', '')} step {s.get('step', '?')}/{s.get('of', '?')} loss {s.get('loss', '?')}"
                     f" · swap {s.get('swap_gb', '?')} GB · since {x.get('started') or '?'}")
    if not r["live"]:
        lines.append("Nothing trains now.")
    for x in r["recent"][:2]:
        if x.get("waiting"):
            lines.append(f"{x['errand']} waits: {x['waiting']}")
        if x["phases"]:
            lines.append(f"{x['errand']} last lines: " + " | ".join(p[9:120] for p in x["phases"][-3:]))
    lines.append("RECORDS (newest first):")
    lines += [f"- {q['when']} {q['file']}: {q['headline']}" for q in r["records"][:8]]
    return "\n".join(lines)


def minds_words() -> str:
    m = minds()
    rows = [f"- {x['name']} ({x.get('kind')}) base {x.get('base')}{'' if x.get('base_ready') else ' (base NOT ready)'} · "
            f"{'pairs done' if x.get('pairs_done') else 'pairs not done' if 'pairs_done' in x else ''} · result {x.get('result') or 'none'}"
            f"{' (kept in ' + x['result_kept_in'] + ')' if x.get('result_kept_in') not in (None, 'current') else ''} · {'SERVES' if x.get('serves') else 'not in service'}"
            for x in m["minds"]]
    return "MINDS ON THIS BOX:\n" + "\n".join(rows) + "\nHOW TO MAKE ONE:\n" + "\n".join(m["how_to_make_one"]) + "\nRULES: " + m["rules"]
