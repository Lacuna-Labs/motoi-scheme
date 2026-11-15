"""THE FORGE'S VERBS (LACUNA-1.3-DESIGN §41) — forge-pairs · forge-train · forge-eval · forge-propose, and forge-stop — and
the watcher that opens the forge card by itself.

  petition(verb, specialist, who)   every start is a PERMISSION CARD (chat.file_petition); nothing runs before the yes.
                                    pairs/train/eval resume the matching Lacuna errand on the yes (the errands tool's own
                                    `resume` — the runner starts it within a minute); train refuses while another
                                    training runs (one at a time, §41). propose asks "put <model> in service as <role>"
                                    with the before/after numbers, and only for a mind that beats the untrained one.
  decided(action, args, yes, who)   the owner's press (chat.decide calls it, `who` = owner-key | device:<name>). A
                                    propose's yes is recorded in ~/.lacuna/forge-decisions.jsonl AND made real by
                                    minds_roles.put_in_service: the role's next version, the gateway restarted, a smoke
                                    call, an automatic rollback when it fails. forge-rollback's yes goes back a version.
  stop(who)                         forge-stop: every forge errand that is on → the errands tool's `stop` (the runner kills
                                    the running work within a minute). No card: stopping is always allowed.
  section()                         the watcher's minute check (workers.SECTIONS): what happened comes OUT of its task's
                                    card as a small linked note; when a training STARTS and when an eval FINISHES the eye
                                    also goes to that card (desk.point_at), once each — kept in ~/.lacuna/forge-seen.json
                                    so a restart does not say it again.
  tool(a, who)                      the chat's `forge` tool.
"""
from __future__ import annotations

import json

from .core import audit
from pathlib import Path
import os
import subprocess
import time

from . import forge

VERBS = ("pairs", "train", "eval", "propose", "rollback")
ACTIONS = tuple(f"forge-{v}" for v in VERBS)
NOTE_EVERY_S = 300          # a writer's progress note becomes a message at most every five minutes per task
KEEP_MESSAGES = 8


_MODEL_TO_SPEC = {
    "270m": "sentry", "gemma-3-270m": "sentry", "gemma-3-270m-it": "sentry", "gemma3:270m": "sentry", "w1": "sentry",
    "1b": "worker", "gemma-3-1b": "worker", "gemma-3-1b-it": "worker", "gemma3:1b": "worker", "w2": "worker",
}


def _spec(x) -> dict | None:
    k = str(x or "").strip().lower()
    k = _MODEL_TO_SPEC.get(k, k)
    return next((s for s in forge.SPECIALISTS if not s.get("later") and (s["id"] == k or k in s["keys"])), None)


def _pct(v) -> str:
    return "—" if v is None else f"{round(v * 100)}%"


def _ms(v) -> str:
    return "—" if v is None else f"{round(v)} ms"


def numbers(ev: dict | None) -> str:
    if not ev:
        return "no eval yet"
    b, a = ev.get("before") or {}, ev.get("after") or {}
    lat = (f", latency {_ms(b.get('latency_ms'))} → {_ms(a.get('latency_ms'))}"
           if b.get("latency_ms") is not None or a.get("latency_ms") is not None else "")
    return f"{ev.get('set') or 'the held-out set'}: accuracy {_pct(b.get('accuracy'))} → {_pct(a.get('accuracy'))}{lat}"


def _errand_for(verb: str, spec: dict) -> str | None:
    names = {"pairs": [spec["pairs"]], "train": forge.train_errands(spec["id"]),
             "eval": [f"forge-eval-{spec['id']}", "forge-eval"]}[verb]
    return next((n for n in names if n and forge.errand(n)["present"]), None)


def effect(action: str, a: dict) -> str:
    """The words on the card — written by code from the arguments, never by the model."""
    name, verb = a.get("name") or a.get("specialist"), action.removeprefix("forge-")
    if verb == "propose":
        return (f"puts {a.get('model')} in service as {name}'s mind — {a.get('role')}. {a.get('numbers')}. "
                "Your yes installs it as the role's next version (the one before is kept), restarts only the brain gateway "
                "and asks the role a smoke call; if it does not answer, it rolls back by itself.")
    if verb == "rollback":
        return (f"returns {name} from {a.get('from')} to {a.get('to')}: box-minds.json's role goes back, the brain gateway "
                "restarts, and the role must answer a smoke call.")
    words = {"pairs": f"writes {name}'s training pairs (the errand {a.get('errand')}): the 26B answers, each pair kept only "
                      "if its machine check passes",
             "train": f"TRAINS {name} (the errand {a.get('errand')}) on MLX — heavy: one training at a time, under the "
                      "memory guard; it may take the box's spare memory for its whole run",
             "eval": f"evaluates {name}, trained against untrained, on its held-out set (the errand {a.get('errand')})"}
    return words[verb]


def petition(verb: str, specialist, who: str, reason: str = "") -> dict:
    from . import chat
    verb = str(verb or "").removeprefix("forge-")
    if verb not in VERBS:
        return {"ok": False, "refused": f"the forge's verbs are {', '.join(VERBS)} (and stop)"}
    spec = _spec(specialist)
    if not spec:
        return {"ok": False, "refused": "name a specialist: " + ", ".join(s["id"] for s in forge.SPECIALISTS if not s.get("later"))}
    args = {"verb": verb, "specialist": spec["id"], "name": spec["name"], "role": spec["role"]}
    if verb == "rollback":
        from . import minds_roles
        why = minds_roles.can_rollback(spec["id"])
        if why:
            return {"ok": False, "refused": why}
        cur = minds_roles.roles()[spec["id"]]
        args.update({"from": cur.get("version"), "to": cur.get("previous")})
    elif verb == "propose":
        row = next(r for r in forge.summary()["specialists"] if r["id"] == spec["id"])
        if row["beats"] is not True:
            return {"ok": False, "refused": f"{spec['name']} cannot be proposed: "
                    + ("there is no eval yet" if not row["eval"] else f"it does not beat the untrained mind ({numbers(row['eval'])})")}
        args.update(model=row["model"] or f"the trained {spec['name']}", numbers=numbers(row["eval"]),
                    before=(row["eval"] or {}).get("before"), after=(row["eval"] or {}).get("after"))
    else:
        name = _errand_for(verb, spec)
        if not name:
            return {"ok": False, "refused": f"there is no forge errand for {verb} {spec['name']} yet — the forge is still "
                    "being set up; nothing was filed"}
        args["errand"] = name
    return chat.file_petition(f"forge-{verb}", None, reason or f"{verb} {spec['name']}, asked by {who}", who, args=args)


def _errand(cmd: str, name: str) -> dict:
    """The errands tool's own path (resume / stop) — the runner acts within a minute."""
    tool = forge.world() / "tools" / "errands"
    try:
        p = subprocess.run([str(tool), cmd, name], capture_output=True, text=True, timeout=20)
    except (OSError, subprocess.SubprocessError) as e:
        return {"ok": False, "said": f"{e.__class__.__name__}: {e}"[:200]}
    return {"ok": p.returncode == 0, "said": (p.stdout or p.stderr).strip()[:300]}


def decided(action: str, args: dict, approve: bool, who: str) -> dict:
    verb = action.removeprefix("forge-")
    if verb == "propose":
        row = {"t": time.time(), "specialist": args.get("specialist"), "model": args.get("model"), "role": args.get("role"),
               "approved": bool(approve), "by": who, "before": args.get("before"), "after": args.get("after"),
               "applied": False}
        p = forge.lacuna_home() / "forge-decisions.jsonl"
        p.parent.mkdir(parents=True, exist_ok=True)
        out = {"ok": True, "recorded": row}
        if approve:                                      # the yes is made real: a new version of the role, reversibly
            from . import minds_roles
            out = {**minds_roles.put_in_service(args, who), "recorded": row}
            row["applied"], row["said"] = out["ok"], out.get("said")
            _say(args, out.get("said"))
        with p.open("a") as f:
            f.write(json.dumps(row) + "\n")
        return out
    if not approve:
        return {"ok": True, "declined": True}
    if verb == "rollback":
        from . import minds_roles
        out = minds_roles.rollback(str(args.get("specialist")), who)
        _say(args, out.get("said"))
        return out
    if verb == "train":
        busy = [r["name"] for r in forge.summary()["specialists"] if r["train"]["running"]]
        if busy:
            return {"ok": False, "said": f"not started — {', '.join(busy)} is training now; one training at a time"}
        kept = _reopen(str(args.get("specialist") or ""))
        _rearm(str(args.get("errand") or ""))
        out = _errand("resume", str(args.get("errand")))
        if kept and isinstance(out, dict):
            out["said"] = f"the earlier result ({', '.join(kept)}) is kept in results/before-retrain-*; " + str(out.get("said") or "")
        return out
    return _errand("resume", str(args.get("errand")))


def _rearm(errand: str) -> None:
    """The runner never restarts a ONCE errand whose last run exited 0 (jobrunner.tick_work: `if last and not every and last_exit == 0: return`),
    so a resume of a finished forge-sft did nothing. Clearing its last exit and its wait lets the next tick start it (the heavy gate still decides
    when there is memory for it)."""
    import re as _re
    p = forge.world() / "jobs" / _re.sub(r"[^A-Za-z0-9._-]", "", errand) / ".runner.json"
    try:
        rs = json.loads(p.read_text())
    except (OSError, ValueError):
        return
    rs.pop("not_before", None)
    rs["last_exit"] = None
    tmp = p.with_suffix(".tmp")
    tmp.write_text(json.dumps(rs, indent=1))
    tmp.replace(p)


def _reopen(specialist: str) -> list[str]:
    """A TRAIN THE OWNER APPROVED MUST TRAIN (2026-10-20: his yes on "train Sentry" resumed an errand that found its result file already there,
    counted itself done and did nothing). The specialist's old result moves to results/before-retrain-<date>/ — kept, never deleted — so
    the runner sees the job as ready again and trains on the pairs as they are now."""
    import shutil
    from . import forge_results
    moved: list[str] = []
    dest = forge.forge_dir() / "results" / f"before-retrain-{time.strftime('%Y%m%d-%H%M')}"
    for r in forge_results.results():
        if r.get("specialist") != specialist or not r.get("file"):
            continue
        src = forge.forge_dir() / "results" / r["file"]
        if src.exists():
            dest.mkdir(parents=True, exist_ok=True)
            shutil.move(str(src), str(dest / r["file"]))
            moved.append(r["file"])
    return moved


def _say(args: dict, words) -> None:
    """What a propose or a rollback did, out of its task's card (a failed smoke call included)."""
    if words:
        try:
            _message(f"s-forge-{args.get('specialist')}", str(words))
        except Exception:  # noqa: BLE001 — the result stands on the permission card even if the desk is down
            pass


def stop(who: str) -> dict:
    on = [e["name"] for e in forge.errands() if e.get("state") == "on"]
    out = {n: _errand("stop", n) for n in on}
    return {"ok": all(r["ok"] for r in out.values()), "stopped": [n for n, r in out.items() if r["ok"]],
            "said": "nothing in the forge is on" if not on else "; ".join(f"{n}: {r['said']}" for n, r in out.items())}


# ── "open it for me": the watcher's transitions ────────────────────────────────────────────────────────────────────────
def _seen_file():
    return forge.lacuna_home() / "forge-seen.json"


def transitions(s: dict, seen: dict) -> list[tuple[str, str, str, bool]]:
    """(key, sentence, task card, open it?) for what happened and was not said yet: a training that started and an eval
    that finished open the task's card; pairs finished and the writers' progress notes (at most one per task per
    NOTE_EVERY_S) are messages out of it."""
    out = []
    for r in s["specialists"]:
        t, ev, p, card = r["train"], r["eval"], r["pairs"], r["card"]
        if t["running"]:
            bits = ", ".join(b for b in (t.get("base"), (t.get("method") or "").upper()) if b)
            out.append((f"train:{r['id']}:{t.get('run') or str(t.get('errand')) + ':' + str(t.get('started'))}",
                        f"Started training {r['name']}{f' ({bits})' if bits else ''}.", card, True))
        if ev:
            out.append((f"eval:{r['id']}:{ev['file']}:{ev['mtime']}", f"Evaluated {r['name']} — {numbers(ev)}.", card, True))
        if p.get("kept") and p.get("state") == "done" and not p.get("running"):
            out.append((f"pairs:{r['id']}:{p['kept']}", f"{r['name']}'s pairs are written: {p['kept']} kept"
                        + (f", {p['dropped']} dropped" if p.get("dropped") else "") + ".", card, False))
        if p.get("note") and time.time() - float(seen.get(f"lastnote:{r['id']}", 0)) >= NOTE_EVERY_S:
            out.append((f"note:{r['id']}:{p['note']}", f"{r['name']}'s pairs: {p.get('kept') or 0} kept — {p['note']}", card, False))
    first = not seen.get("_init")
    return [x for x in out if x[0] not in seen and not (first and x[0].split(":")[0] in ("eval", "pairs"))]


def _message(card: str, words: str) -> None:
    """A small note OUT of its task card (linked: the desk clusters it beside the card, a wire joins them); a task keeps
    its newest KEEP_MESSAGES on the board."""
    from . import home
    pre = f"fm-{card.removeprefix('s-forge-')}-"
    home.act({"op": "place", "id": f"{pre}{int(time.time() * 1000) % 10_000_000}", "kind": "note", "title": "forge",
              "block": {"lines": [words]}, "w": 380, "h": 120, "links": [card], "focus": False}, who="lacuna")
    mine = [c["id"] for c in home.board().get("cards") or [] if c["id"].startswith(pre)]
    for cid in mine[:-KEEP_MESSAGES]:
        home.act({"op": "remove", "id": cid}, who="lacuna")


def section() -> list[str]:
    from . import desk, home
    try:
        seen = json.loads(_seen_file().read_text())
    except (OSError, ValueError):
        seen = {}
    s = forge.summary()
    fired = transitions(s, seen)
    if not seen.get("_init"):                      # the first look: what is already on disk is old news, not said
        seen["_init"] = time.time()
        for k, *_ in transitions(s, {"_init": 1}):
            if k.split(":")[0] in ("eval", "pairs"):
                seen[k] = time.time()
    for k, words, card, opens in fired:
        seen[k] = time.time()
        if k.startswith("note:"):
            seen[f"lastnote:{k.split(':')[1]}"] = time.time()
        _message(card, words)
        if opens:                                  # said on the desk; never moves the owner's screen (2026-10-20: "stop it jumping me to the agent window")
            home.act({"op": "say", "text": words}, who="lacuna")
    _seen_file().parent.mkdir(parents=True, exist_ok=True)
    _seen_file().write_text(json.dumps(dict(sorted(seen.items(), key=lambda kv: -float(kv[1]))[:300])))
    return [w for _, w, _, _ in fired]


# ── the chat's tool ────────────────────────────────────────────────────────────────────────────────────────────────────
TOOL = {"op": {"type": "string", "enum": ["status", "runs", "minds", "doctor", "repair", "pairs", "train", "eval", "propose", "rollback", "stop"]},
        "what": {"type": "string", "enum": ["tokenizer", "spm", "export", "lease"], "description": "repair: which fault the doctor named"},
        "base": {"type": "string", "description": "repair tokenizer/spm: a base in forge/weights (e.g. gemma-3-1b-it)"},
        "run": {"type": "string", "description": "repair export: the run's model folder the doctor named"},
        "specialist": {"type": "string", "description": "specialist role to train: 'sentry' (W1 log triage, uses 270M) or 'worker' (W2 command router, uses 1B)"},
        "reason": {"type": "string"}}

# A CALL THAT IS ALMOST RIGHT RUNS (2026-10-21: the 12B asked for `op=run` — an op that does not exist — and for no op at
# all, 54 refusals in the audit): the words it reaches for are read as the op it meant, and an op it cannot know says the list.
_OP_ALIASES = {"run": "train", "start": "train", "begin": "train", "launch": "train",
               "write-pairs": "pairs", "pairs-write": "pairs", "evaluate": "eval", "serve": "propose", "put-in-service": "propose"}


def tool(a: dict, who: str) -> str:
    raw = str(a.get("op") or "status").strip().lower()
    op = _OP_ALIASES.get(raw, raw)
    if op not in TOOL["op"]["enum"]:
        return (f"`{raw}` is not a forge op. It can do only: {', '.join(TOOL['op']['enum'])}. "
                "To train a mind: op=train specialist=sentry (or worker) — that files a permission card; nothing runs until "
                f"the owner's yes.\n{forge.summary()['now']}")
    if op == "stop":
        r = stop(who)
        return f"stopped {', '.join(r['stopped'])} — the runner ends the work within a minute" if r["stopped"] else r["said"]
    if op == "doctor":                             # every class of forge fault, checked; changes nothing (forge/doctor.py)
        return doctor_words()
    if op == "repair":                             # one local repair the doctor named: tokenizer · spm · export · lease
        return repair(str(a.get("what") or ""), str(a.get("base") or ""), str(a.get("run") or ""), who)
    if op == "runs":                               # what trains now and every run's record (forge_runs.py)
        from . import forge_runs
        return forge_runs.runs_words()
    if op == "minds":                              # the inventory of minds and the four steps that make one
        from . import forge_runs
        return forge_runs.minds_words()
    if op in VERBS:
        spec_arg = a.get("specialist") or a.get("name") or a.get("model") or a.get("role") or a.get("target")
        r = petition(op, spec_arg, who, str(a.get("reason") or ""))
        return (f"a permission card is on the desk ({r['petition']}): {r['if_approved']}" if r.get("petition")
                else str(r.get("refused") or r.get("why") or r))
    s = forge.summary()
    lines = [s["now"]]
    for r in s["specialists"]:
        if r["later"] and r["state"] == "later":
            continue
        p, t = r["pairs"], r["train"]
        lines.append(f"{r['name']} ({r['work']}): {r['state']} · pairs kept {p.get('kept') if p.get('kept') is not None else '—'}"
                     f"{' dropped ' + str(p.get('dropped')) if p.get('dropped') else ''} · step {t.get('step') or '—'}"
                     f"{' loss ' + format(t['last'], '.3f') if t.get('last') is not None else ''} · {numbers(r['eval'])}")
    return "\n".join(lines)


# ── THE DOCTOR AND ITS REPAIRS (2026-10-20: torch missing, a bad 1B tokenizer, tokenizer.model lost, runs written over, a lease
# held by a paused errand — each found by hand; now found by `forge op=doctor` and fixed by `forge op=repair`, all local, all kept) ──
OLLAMA_OF = {"gemma-3-270m-it": "gemma3/270m", "gemma-3-1b-it": "gemma3/1b", "functiongemma-270m-it": "functiongemma/latest"}


def _venv() -> str:
    return str(forge.forge_dir() / ".venv" / "bin" / "python")


def doctor() -> dict:
    import subprocess
    p = subprocess.run([_venv(), str(forge.forge_dir() / "doctor.py")], capture_output=True, text=True, timeout=300, cwd=str(forge.forge_dir()))
    try:
        return json.loads(p.stdout)
    except ValueError:
        return {"ok": False, "checks": [{"name": "doctor", "ok": False, "said": (p.stderr or p.stdout)[-300:], "fix": "the forge's Python itself is broken: ./setup-venv.sh in ~/lacuna-world/forge"}]}


def doctor_words() -> str:
    d = doctor()
    bad = [c for c in d["checks"] if not c["ok"]]
    head = f"forge doctor: {len(d['checks']) - len(bad)} of {len(d['checks'])} checks pass."
    return head + ("\n" + "\n".join(f"- {c['name']}: {c['said']}\n  fix: {c['fix']}" for c in bad) if bad else " Nothing to fix.")


def repair(what: str, base: str, run: str, who: str) -> str:
    import shutil
    import subprocess
    w = forge.forge_dir() / "weights"
    if what in ("tokenizer", "spm") and not (w / base).is_dir():
        return f"no base {base!r} in forge/weights: " + ", ".join(sorted(p.name for p in w.iterdir() if p.is_dir()))
    if what == "tokenizer":
        fam = base.split("-it")[0].rsplit("-", 1)[0]                     # gemma-3-1b-it → gemma-3: the family shares one tokenizer
        src = next((p for p in sorted(w.iterdir()) if p.is_dir() and p.name != base and p.name.startswith(fam) and (p / "tokenizer.json").exists()), None)
        if not src:
            return f"no other base of the {fam} family to take a tokenizer from"
        keep = w / base / f"broken-tokenizer-{time.strftime('%Y%m%d-%H%M')}"
        keep.mkdir(exist_ok=True)
        for f in ("tokenizer.json", "tokenizer_config.json"):
            if (w / base / f).exists():
                shutil.copy(w / base / f, keep / f)
            shutil.copy(src / f, w / base / f)
        audit(who, "forge.repair", what="tokenizer", base=base, source=src.name)
        return f"{base}: tokenizer.json and tokenizer_config.json now from {src.name} (same family, same vocabulary); the old ones are in {keep.name}/. Run `forge op=doctor` to prove it loads."
    if what == "spm":
        tag = OLLAMA_OF.get(base)
        if not tag:
            return f"no Ollama model is known for {base}; add it to forge_verbs.OLLAMA_OF"
        man = Path.home() / ".ollama/models/manifests/registry.ollama.ai/library" / tag
        try:
            digest = next(l["digest"] for l in json.loads(man.read_text())["layers"] if l["mediaType"].endswith("image.model"))
        except (OSError, ValueError, StopIteration):
            return f"Ollama has no {tag} on this box (no manifest); the tokenizer.model cannot be rebuilt without it"
        blob = Path.home() / ".ollama/models/blobs" / digest.replace(":", "-")
        p = subprocess.run([_venv(), str(forge.forge_dir() / "spm_from_gguf.py"), str(blob), str(w / base)], capture_output=True, text=True, timeout=600, cwd=str(forge.forge_dir()))
        audit(who, "forge.repair", what="spm", base=base, ok=p.returncode == 0)
        return (p.stdout.strip()[-200:] or "rebuilt") if p.returncode == 0 else f"spm_from_gguf failed: {(p.stderr or p.stdout)[-300:]}"
    if what == "export":
        rd = Path(run).expanduser()
        if not (rd / "config.json").exists():
            return f"{run} is not a trained model folder (no config.json); `forge op=doctor` names the right one"
        name = f"{rd.parent.name}-{rd.name.removeprefix('model-') or time.strftime('%Y%m%d-%H%M')}"
        base = next((b for b in OLLAMA_OF if rd.parent.name.startswith(b)), "")
        code = ("import forge_sft, os, json, sys\n"
                f"out = forge_sft.export_gguf({str(rd)!r}, {name!r}, print, os.path.join(forge_sft.WEIGHTS, {base!r}))\n"
                "print('OUT=' + str(out))")
        p = subprocess.run([_venv(), "-c", code], capture_output=True, text=True, timeout=1200, cwd=str(forge.forge_dir()))
        out = next((ln[4:] for ln in p.stdout.splitlines() if ln.startswith("OUT=")), "None")
        if out == "None":
            return "export failed: " + (p.stdout + p.stderr)[-400:] + " — run `forge op=doctor` (tokenizer.model? torch?)"
        for f in (forge.forge_dir() / "results").glob("*.json"):            # the result of this run now points at its GGUF
            try:
                d = json.loads(f.read_text())
            except ValueError:
                continue
            if str(d.get("run_dir") or "") == str(rd) or f.stem == rd.parent.name:
                d["gguf"] = out
                f.write_text(json.dumps(d, indent=1))
        audit(who, "forge.repair", what="export", run=str(rd), out=out)
        return f"GGUF → {out} (not in service; `forge op=propose` puts it there on the owner's press, and only at 90% on gold)"
    if what == "lease":
        import sys as _s
        _s.path.insert(0, str(Path.home() / "code/lacuna/lacuna-box/jail"))
        import lease as _lease
        h = _lease.held("heavy")
        if not h:
            return "no heavy lease is held"
        holder = str(h.get("holder") or "")
        try:
            pid = json.loads((forge.world() / "jobs" / holder / ".runner.json").read_text()).get("pid")
            os.kill(int(pid), 0)
            return f"not freed: {holder} holds it and is running (pid {pid})"
        except Exception:  # noqa: BLE001
            pass
        said = _lease.release_on("heavy", holder)
        audit(who, "forge.repair", what="lease", holder=holder)
        return f"freed the heavy lease {holder} held while running nothing ({said}); the next heavy job starts on the runner's next tick"
    return "repair what=tokenizer|spm|export|lease — the doctor names which"
