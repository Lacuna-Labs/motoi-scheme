"""THE SWARM — every agent on the box in one picture, for the desk's Agents view (the owner, 2026-10-18: "clusters of
whoever is working together … connected with streams going between them in real time … all of the Erlang data
features, mailboxes … Lacuna is going to be the biggest bubble of them all").

GET /api/swarm → {nodes, edges, flows, at}
  nodes  {id, name, kind, cluster, state, size, mail, last, mind?, card?, talk}   kind: lacuna · brain · mind · foreman ·
         worker · agent · errand · exam. `size` is how big its bubble is (Lacuna largest); `mail` its mailbox: queued
         messages not yet answered (a jail worker's briefs without a report; a foreman worker's unread events);
         `talk` says whether the desk can talk to it and pause/stop it (the foreman's workers) or only watch it.
  edges  {a, b, kind}   supervises · runs-on · works-for
  flows  {a, b, kind, t}  messages in the last 90 s: spawns, talks, reports, briefs, a mind's request in flight —
         what the desk draws as streams between bubbles
Read-only and cheap: files and the foreman's own lists, never a model.
"""
from __future__ import annotations

import json
import os
import re
import time
from pathlib import Path

RECENT_S = 30 * 60          # a finished jail worker stays on the map this long
FLOW_S = 90                 # a message is drawn as a stream this long


def _world() -> Path:
    return Path(os.environ.get("LACUNA_WORLD") or Path.home() / "lacuna-world")


def _read(p: Path, default):
    try:
        return json.loads(p.read_text())
    except (OSError, ValueError):
        return default


def _lines(p: Path, n: int = 40) -> list:
    try:
        rows = p.read_text(errors="replace").splitlines()[-n:]
    except OSError:
        return []
    out = []
    for r in rows:
        try:
            out.append(json.loads(r))
        except ValueError:
            continue
    return out


def _foreman() -> tuple[list, list, list]:
    nodes, edges, flows = [], [], []
    try:
        from . import agent_talk
        tree = agent_talk.tree()
    except Exception:  # noqa: BLE001 — the foreman may be down: the swarm still draws the rest
        return nodes, edges, flows
    now = time.time()
    live = [n for n in tree.get("nodes") or [] if n.get("state") not in ("retired", "stopped", "graved")
            or now - float(n.get("started") or 0) < RECENT_S]
    nodes.append({"id": "foreman", "name": "foreman", "sub": "studio", "kind": "foreman", "cluster": "foreman", "state": "running",
                  "size": 32, "mail": 0, "last": f"{len(live)} workers", "talk": False})
    edges.append({"a": "lacuna", "b": "foreman", "kind": "supervises"})
    for n in live:
        wid = n["id"]
        # FOUR KINDS, NEVER BLURRED (the owner, 2026-10-19: "make sure there is a difference between agents, foremen, smart
        # workers, function lacunas (change the name)"): a worker WITH a mind of its own is a SMART WORKER; a worker that is
        # only its Scheme program (no LLM) is a RUNNER. Lacuna and Cloud Lacuna are the AGENTS; the foreman supervises.
        smart = bool((n.get("mind") or {}).get("model")) or bool((n.get("tools") or {}).get("mind") or (n.get("tools") or {}).get("mind-job"))
        nodes.append({"id": wid, "name": n.get("name") or wid, "kind": "smart-worker" if smart else "runner",
                      "sub": "smart worker" if smart else "runner", "cluster": "foreman",
                      "state": n.get("state"), "size": 20 if n.get("state") == "running" else 12, "mail": 0,
                      "last": str(n.get("last_line") or "")[:160], "mind": (n.get("mind") or {}).get("model"), "talk": True,
                      # the project it is on, named by its tag in the swarm (the owner, 2026-10-19)
                      "work": f"{n.get('name') or 'a cart'} · {str(n.get('now') or n.get('state') or '')[:28]}",
                      # everything the foreman knows of it (§45.3), for its card's state tab: introspection, all of it
                      **{k: n.get(k) for k in ("pending", "beat_age_s", "missed_beats", "steps", "tools", "timers", "subs",
                                               "packet", "checkpoint_t", "resumed_from", "stall_reason", "minds_in_flight") if n.get(k) not in (None, [], {})}})
        edges.append({"a": n.get("parent") or "foreman", "b": wid, "kind": "supervises"})
        if (n.get("mind") or {}).get("model"):
            edges.append({"a": wid, "b": "mind:" + n["mind"]["model"], "kind": "runs-on"})
    for e in tree.get("events") or []:                      # the foreman's own acts: it spawns and stops, downward
        if now - float(e.get("t") or 0) < FLOW_S and e.get("id") and e.get("kind") in ("spawn", "stop", "resume", "restarted"):
            flows.append({"a": "foreman", "b": e["id"], "kind": e.get("kind"), "t": e["t"]})
    # THE MAIL, THE WAY IT TRAVELS (the owner, 2026-10-19: "I think the messages are going in the wrong direction"): each
    # running worker's ring says it — mail-out goes UP (worker → foreman → Lacuna: a hand, a report, a question), mail-in
    # comes DOWN (Lacuna → foreman → worker: an answer, a subscribed reading). Measured, never drawn for show.
    try:
        from . import agent_talk
        for n in live:
            if n.get("state") != "running":
                continue
            for x in (agent_talk.thoughts(n["id"], 12) or {}).get("items") or []:
                t = float(x.get("t") or 0)
                if now - t >= FLOW_S:
                    continue
                k = str(x.get("kind") or "")
                if k == "mail-out" or k == "report":
                    flows += [{"a": n["id"], "b": "foreman", "kind": k, "t": t}, {"a": "foreman", "b": "lacuna", "kind": k, "t": t + 0.2}]
                elif k == "mail-in":
                    # A SUBSCRIBED READING COMES FROM THE FOREMAN'S OWN SAMPLER, NOT FROM LACUNA (2026-10-19, the owner: "is Lacuna REALLY
                    # talking to the foreman?" — measured: in 24 h Lacuna called the foreman ~5 times; the foreman logged 451 reports and
                    # 356 hand calls). A reading like `mem_available_gb 2.7` is drawn foreman → worker only; the first hop from Lacuna is
                    # drawn only for an ANSWER (to a hand or a question the worker sent up), which Lacuna's hands really gave.
                    if re.fullmatch(r"[a-z_.]+ -?[\d.]+( .*)?", str(x.get("text") or "").strip()):
                        flows.append({"a": "foreman", "b": n["id"], "kind": "reading", "t": t})
                    else:
                        flows += [{"a": "lacuna", "b": "foreman", "kind": k, "t": t - 0.2}, {"a": "foreman", "b": n["id"], "kind": k, "t": t}]
    except Exception:  # noqa: BLE001 — the swarm stands without its mail
        pass
    # THE FOREMAN'S OWN LOG IS THE REAL UP-TRAFFIC (2026-10-19, the owner: "doesn't the foreman ever talk to Lacuna?" — measured: in
    # 24 h the foreman logged 356 `hand` calls, 451 reports and 16 brain requests, almost all from cart workers that retire in
    # seconds, so a ring read from RUNNING workers never saw them): each logged hand / report / brain request in the last 90 s is a
    # real message foreman → Lacuna (a worker asking Lacuna's hands, or reporting), and worker → foreman when that worker is on the map
    try:
        ids = {n["id"] for n in nodes}
        for ln in _lines(Path.home() / ".lacuna" / "foreman-events.jsonl", 120):
            try:
                ev = json.loads(ln) if isinstance(ln, str) else ln
            except ValueError:
                continue
            at = float(ev.get("at") or 0)
            if now - at >= FLOW_S or ev.get("kind") not in ("hand", "report", "need-brain", "act"):
                continue
            wid = (ev.get("worker") or {}).get("id")
            if wid in ids:
                flows.append({"a": wid, "b": "foreman", "kind": ev["kind"], "t": at})
            flows.append({"a": "foreman", "b": "lacuna", "kind": ev["kind"], "t": at + 0.1})
    except Exception:  # noqa: BLE001
        pass
    return nodes, edges, flows


def _jail() -> tuple[list, list, list]:
    nodes, edges, flows = [], [], []
    now = time.time()
    for d in sorted(_world().glob("jobs/w-*")):
        st = _read(d / "state.json", {})
        at = float(st.get("at") or 0)
        state = st.get("state") or "?"
        if state not in ("executing", "briefed", "spawned", "waiting") and now - at > RECENT_S:
            continue
        mail = _lines(d / "mailbox.jsonl")
        briefs = [m for m in mail if m.get("kind") == "brief"]
        reports = [m for m in mail if m.get("kind") == "report"]
        job = (briefs[-1].get("job") if briefs else {}) or {}
        card = (briefs[-1].get("card") if briefs else "") or ""
        rep = _read(d / "report.json", {}) or {}
        # its mood, for the desk's behaviours: turned away by a busy brain → waiting; no progress for 20 min → stuck
        busy = [e for e in _lines(d / "journal.jsonl", 6) if e.get("event") == "exit" and e.get("code") == 75]
        try:
            quiet = now - (d / "progress.json").stat().st_mtime
        except OSError:
            quiet = 0
        if state in ("executing", "briefed") and busy:
            state = "waiting"
        elif state == "executing" and quiet > 20 * 60:
            state = "stuck"
        nodes.append({"id": d.name, "name": job.get("class") or "worker", "sub": state, "kind": "worker",
                      "cluster": card or "jail", "state": state, "size": 22 if state == "executing" else 13,
                      "mail": max(0, len(briefs) - len(reports)), "last": str(rep.get("said") or job.get("brief") or "")[:160],
                      "card": card, "talk": False, "work": f"{card or 'jail'} · {str(job.get('brief') or job.get('class') or '')[:28]}"})
        edges.append({"a": card if card.startswith("exam-") else "lacuna", "b": d.name, "kind": "works-for"})
        try:
            if now - (d / "mailbox.jsonl").stat().st_mtime < FLOW_S:
                # THE DIRECTION IS THE LAST MESSAGE'S (2026-10-19, the owner: "I think it's going the wrong way"): the mailbox holds briefs
                # (Lacuna → worker) AND reports (worker → Lacuna); every change used to be drawn as a brief going down, so a
                # worker's report flowed the wrong way
                last_kind = (mail[-1].get("kind") if mail else "message")
                up = last_kind in ("report", "answer", "progress")
                flows.append({"a": d.name if up else "lacuna", "b": "lacuna" if up else d.name, "kind": last_kind, "t": now})
            if now - (d / "progress.json").stat().st_mtime < FLOW_S:
                flows.append({"a": d.name, "b": "lacuna", "kind": "thinking", "t": now})
        except OSError:
            pass
    exams = sorted({n["card"] for n in nodes if n.get("card", "").startswith("exam-")})
    for c in exams:
        nodes.append({"id": c, "name": c.replace("exam-", "job "), "sub": "a card's job", "kind": "exam", "cluster": c, "state": "running",
                      "size": 26, "mail": 0, "last": "", "talk": False})
        edges.append({"a": "lacuna", "b": c, "kind": "supervises"})
    return nodes, edges, flows


def _errands() -> tuple[list, list, list]:
    nodes, edges, flows = [], [], []
    now = time.time()
    for d in sorted(_world().glob("jobs/*/job.json")):
        if d.parent.name.startswith("w-"):
            continue
        job = _read(d, {})
        rs = _read(d.parent / ".runner.json", {})
        if job.get("state") != "on" or not rs.get("pid"):
            continue
        prog = _read(d.parent / "progress.json", {}) or {}
        nodes.append({"id": f"errand:{job['name']}", "name": job["name"], "kind": "errand", "cluster": "errands",
                      "state": "running", "size": 18 if job.get("heavy") else 14, "mail": 0,
                      "last": str(prog.get("note") or job.get("goal") or "")[:160], "talk": False,
                      "work": f"{job['name']} · {str(prog.get('step') or 'running')[:20]}",   # its NAME on the tag, its goal on the card
                      "does": str(job.get("goal") or "")[:200]})
        edges.append({"a": "lacuna", "b": f"errand:{job['name']}", "kind": "supervises"})
        try:
            if now - (d.parent / "progress.json").stat().st_mtime < FLOW_S:
                flows.append({"a": f"errand:{job['name']}", "b": "lacuna", "kind": "progress", "t": now})
        except OSError:
            pass
    return nodes, edges, flows


def _minds() -> tuple[list, list, list]:
    nodes, edges, flows = [], [], []                          # Lacuna IS the 26B: no separate brain node
    try:                                                      # the gateway's live minds (as /api/minds/live reads them)
        import urllib.request
        from . import foreman
        with urllib.request.urlopen(f"{foreman.GATEWAY}/lacuna/minds", timeout=2) as r:
            live = json.loads(r.read().decode() or "{}")
    except Exception:  # noqa: BLE001 — a gateway that does not answer: only the brain is drawn
        live = {}
    chatter = _mind_chatter()
    for m in (live or {}).get("minds") or []:
        mid = "mind:" + str(m.get("name", "")).removesuffix(":latest")
        key = str(m.get("name", "")).removesuffix(":latest")
        said = chatter.get(key) or {}
        busy = int(m.get("in_flight") or 0)
        last = ("answering now · " if busy else "") + (f"{said['n']} asked this hour · last: {said['line']}" if said
                                                       else f"{mind_does(key)} · quiet {int((m.get('idle_s') or 0) // 60)} min")
        nodes.append({"id": mid, "name": mind_name(key), "sub": f"{weight(key)} · {key}", "kind": "mind", "cluster": "minds",
                      "state": "working" if busy else "running", "does": mind_does(key),
                      "size": 12 + min(10, int((m.get("rss") or 0) / 2 ** 28)) + min(6, int(said.get("n") or 0) // 5), "mail": busy,
                      "last": last, "talk": False})
        # (who asks a mind is drawn in swarm() from the cascade log — the worker whose cart asked, never Lacuna by default)
    return nodes, edges, flows


WEIGHT = {"functiongemma": "270M", "gemma3:270m": "270M", "sentry": "270M", "gemma3:1b": "1B", "gemma3:1b-it-q8_0": "1B", "gemma4:e2b": "E2B",
          "gemma4:e2b-it-q8_0": "E2B", "gemma4:e4b-it-q8_0": "E4B", "gemma4:12b-it-q8_0": "12B",
          "gemma4:e4b": "E4B", "embeddinggemma": "300M", "lacuna-worker-lite": "12B", "gemma4:26b": "26B"}


def weight(model: str | None) -> str:
    """A mind is named by its size (the owner: "we know they're all Gemmas"): 270M, 1B, 26B."""
    m = str(model or "").removesuffix(":latest")
    return WEIGHT.get(m) or (m.split(":")[-1].upper() if ":" in m else "")


# THE SMALL MINDS BY WHAT THEY DO (the owner, 2026-10-19: "get their right name … their message is generic … make their chatter
# meaningful … clear and concise names … let them show what they're doing"). A name says the job; the model is the sub-line.
MINDS = {
    "functiongemma": ("Switchboard", "turns a request into one call — a verb, a label — or says nothing fits"),
    "sentry": ("Sentry", "reads a log line and labels it: real, noise, recovered — trained here, v1"),
    "gemma3:270m": ("Triage", "names a red: regression, flaky, environment, or the test is wrong"),
    "gemma3:1b": ("Clerk", "short sorting and summaries a worker hands it"),
    "gemma3:1b-it-q8_0": ("Clerk", "short sorting and summaries a worker hands it"),
    "gemma4:e2b-it-q8_0": ("Scout", "the step up when a 270M is unsure — reads more, still small"),
    "gemma4:e4b-it-q8_0": ("Workhorse", "the helpers' workhorse: a page, a log window, a short plan"),
    "gemma4:e2b": ("Scout", "the step up when a 270M is unsure — reads more, still small"),
    "gemma4:e4b": ("Desk", "reserved: experiments and Sakura's training"),
    "embeddinggemma": ("Librarian", "turns words into vectors so the cortex can recall them"),
    "shieldgemma": ("Shield", "screens untrusted text before a worker reads it"),
}


def mind_name(model: str | None) -> str:
    m = str(model or "").removesuffix(":latest")
    return (MINDS.get(m) or MINDS.get(m.split(":")[0]) or (m.split(":")[0], ""))[0]


def mind_does(model: str | None) -> str:
    m = str(model or "").removesuffix(":latest")
    return (MINDS.get(m) or MINDS.get(m.split(":")[0]) or ("", "a small mind"))[1]


def _mind_chatter(hours: float = 1.0) -> dict:
    """What each small mind really did lately, from the cascade's own log (every question, which mind answered, for which
    cart): {model: {n, last_t, line}} — the line a person reads, never 'idle 241 s' alone."""
    out: dict = {}
    p = _world() / "cascade" / "escalations.jsonl"
    try:
        rows = p.read_text(errors="replace").splitlines()[-400:]
    except OSError:
        return out
    since = time.time() - hours * 3600
    for line in rows:
        try:
            r = json.loads(line)
            t = time.mktime(time.strptime(str(r.get("at"))[:19], "%Y-%m-%dT%H:%M:%S"))
        except Exception:  # noqa: BLE001
            continue
        for g in r.get("rungs") or []:
            m = str(g.get("model") or "")
            if not m or t < since:
                continue
            o = out.setdefault(m, {"n": 0, "last_t": 0, "line": ""})
            o["n"] += 1
            if t >= o["last_t"]:
                ans = g.get("answer")
                o["last_t"] = t
                o["line"] = (f"{r.get('job')} for {r.get('cart')}: {str(ans)[:40]}" + (f" ({float(g['certainty']):.0%} sure)" if g.get("certainty") else "")
                             if ans else f"{r.get('job')} for {r.get('cart')}: passed it up — {str(g.get('climbed') or 'unsure')[:60]}")
    return out


def _wire(now: float, ids: set) -> list:
    """THE WIRE: real messages between agents, from the records that are written when they happen (2026-10-19, the owner: "find a way
    this is done, for all of them, so we can see the flow right"). Only what is logged is drawn, in the direction it went:
      · every model call (the gateway's minds-live.jsonl): a worker or the foreman asking a small mind, and the mind's answer back;
        a background call on the 26B is the foreman asking Lacuna's brain, and the answer back;
      · Lacuna's own tool calls to the foreman (spawn · tell · stop a worker) and to Cloud Lacuna (ask_cloud, plan) — down — and a
        plan coming back — up;
    The foreman's hands, reports and brain requests and each worker's ring are read in _foreman; mailboxes and progress in
    _jail and _errands. Nothing here is invented: a node that is not on the map just gets no trail."""
    out = []
    home = Path.home() / ".lacuna"
    for r in _lines(home / "minds-live.jsonl", 200):
        t = float(r.get("t") or 0)
        if now - t >= FLOW_S:
            continue
        model = str(r.get("model") or "")
        big = "worker-lite" in model or "gemma4:26b" in model
        mid = "mind:" + model.split(":")[0]
        if r.get("who") == "person" or str(r.get("lane") or "").startswith("chat-"):
            continue                                              # the owner talking to Lacuna: Lacuna IS the 26B
        if big:
            out += [{"a": "foreman", "b": "lacuna", "kind": "brain", "t": t - (r.get("ms") or 0) / 1000}, {"a": "lacuna", "b": "foreman", "kind": "answer", "t": t}]
        elif mid in ids:
            out += [{"a": "foreman", "b": mid, "kind": "ask", "t": t - (r.get("ms") or 0) / 1000}, {"a": mid, "b": "foreman", "kind": "answer", "t": t}]
    tool_to = {"tell_worker": "foreman", "stop_worker": "foreman", "spawn_worker": "foreman", "ask_cloud": "cloud-lacuna", "plan": "cloud-lacuna"}
    for r in _lines(home / "audit.jsonl", 400):
        t = float(r.get("t") or 0)
        act = str(r.get("action") or "")
        if now - t < FLOW_S and r.get("who") == "lacuna" and act.startswith("tool.") and act[5:] in tool_to and tool_to[act[5:]] in ids:
            out.append({"a": "lacuna", "b": tool_to[act[5:]], "kind": act[5:], "t": t})
    try:
        for p in (_world() / "plans").glob("*.json"):
            rec = _read(p, {}) or {}
            if now - float(rec.get("ended") or 0) < FLOW_S and "cloud-lacuna" in ids:
                out.append({"a": "cloud-lacuna", "b": "lacuna", "kind": "plan-back", "t": float(rec["ended"])})
            if now - float(rec.get("started") or 0) < FLOW_S and "cloud-lacuna" in ids:
                out.append({"a": "lacuna", "b": "cloud-lacuna", "kind": "plan", "t": float(rec["started"])})
    except OSError:
        pass
    return out


def _jobs(nodes: list) -> tuple[list, list, list]:
    """THE JOB WATCHER (the owner, 2026-10-19: "show me them doing a release … the jobs happening"): every job running now,
    and the ones that ended in the last ten minutes (they fade), tied to the cart worker that started it — a job titled
    "release: …" hangs off the running `release` worker — with progress flowing while it runs."""
    from .core import jobs
    out_n, out_e, out_f = [], [], []
    now = time.time()
    by_name, cluster_of = {}, {}
    for n in nodes:
        cluster_of[n["id"]] = n.get("cluster")
        if n.get("state") == "running" and n.get("kind") in ("agent", "worker", "smart-worker", "runner"):
            by_name.setdefault(n.get("name"), n["id"])
    for j in jobs(30):
        ended = j.get("ended")
        try:
            old = now - float(ended or 0) > 600 or now - float(j.get("started") or 0) > 3600
        except (TypeError, ValueError):
            old = True
        if not j.get("running") and old:
            continue
        cart = str(j.get("title") or "").split(":", 1)[0].strip()
        jid = f"job:{j['id']}"
        state = "running" if j.get("running") else ("done" if j.get("code") in (0, None) else "failed")
        parent = by_name.get(cart) or "lacuna"
        out_n.append({"id": jid, "name": f"{j.get('kind')} job", "sub": state, "kind": "errand",
                      "job_info": {"title": j.get("title"), "command": " ".join(str(c) for c in (j.get("cmd") or []))[:300],
                                   "started_by": j.get("who"), "started": j.get("started"), "ended": j.get("ended"), "exit": j.get("code")},
                      "cluster": cluster_of.get(parent) if parent != "lacuna" else "jobs",        # beside the worker that runs it
                      "state": state if state != "done" else "retired", "size": 16 if j.get("running") else 10, "mail": 0,
                      "last": str(j.get("title") or "")[:160], "talk": False, "job": j["id"],
                      "work": f"{cart or 'a job'} · {j.get('kind')}" if j.get("running") else None})
        out_e.append({"a": parent, "b": jid, "kind": "runs"})
        if j.get("running"):
            out_f.append({"a": jid, "b": parent, "kind": "progress", "t": now})
    return out_n, out_e, out_f


def swarm() -> dict:
    nodes = [{"id": "lacuna", "name": "Lacuna", "sub": "here", "kind": "lacuna", "cluster": "lacuna", "state": "running", "size": 58,
              "mail": 0, "last": "", "talk": True}]
    try:                                                     # Lacuna's own task: the release it is running, at its stage
        from . import release_run
        rr = release_run.run()
        if rr.get("state") == "running":
            stage = rr.get("now") or "starting"
            waits = " (waits for your press)" if rr.get("press") else ""
            nodes[0].update(work=f"release · {stage}{waits}", last=f"running the release: {stage}{waits}")
    except Exception:  # noqa: BLE001 — the swarm stands without the release's word
        pass
    edges, flows = [], []
    # CLOUD LACUNA (burn-down 1.5 B5): the cloud seat in the swarm, beside Lacuna; larger and lit while it is answering (a call
    # in the last minute), quiet when resting — its last kind of work on its line
    try:
        from . import cloud
        st = cloud.status()
        last = (st.get("last") or [{}])[0]
        recent = bool(last) and time.time() - float(last.get("t") or 0) < 60
        nodes.append({"id": "cloud-lacuna", "name": "Cloud Lacuna", "sub": "the cloud seat", "kind": "lacuna", "cluster": "lacuna",
                      "state": "running" if recent else ("resting" if st.get("resting") else "idle"), "size": 74 if recent else 66, "pin": "right",   # bigger than Lacuna (58): it is seen (2026-10-19)
                      "mail": 0, "last": f"{last.get('kind', '')} · {'answered' if last.get('ok') else 'refused'}" if last else "no calls yet", "talk": True})
        edges.append({"a": "lacuna", "b": "cloud-lacuna", "kind": "asks"})
        if recent:
            flows.append({"a": "lacuna", "b": "cloud-lacuna", "kind": last.get("kind") or "asks", "t": last.get("t")})
    except Exception:  # noqa: BLE001 — the swarm stands without its cloud seat
        pass
    for part in (_minds, _foreman, _jail, _errands):
        n, e, f = part()
        nodes += n
        edges += e
        flows += f
    # LACUNA DIRECTS THE FOREMAN (the owner, 2026-10-19: "if Lacuna is the one that spawned them … let Lacuna be the one
    # talking to the controller … show me that"): a line Lacuna → foreman, dots on it while the foreman's workers run
    if any(n["id"] == "foreman" for n in nodes):
        edges.append({"a": "lacuna", "b": "foreman", "kind": "directs"})
        # (no standing "directs" stream: the dots on this line are the real mail, drawn in _foreman — 2026-10-19)
    # WHO ASKED A SMALL MIND (2026-10-19, "check traffic flow"): the cascade log names the cart; its running worker sent the
    # question (worker → mind) and got the answer back (mind → worker). A cart with no live node asks through Lacuna.
    try:
        now = time.time()
        p = _world() / "cascade" / "escalations.jsonl"
        by_name: dict = {}                                     # the cart's worker: a running one first, else its recent run
        for n in sorted((n for n in nodes if n.get("cluster") == "foreman" and n["id"] != "foreman"), key=lambda n: n.get("state") == "running"):
            by_name[n.get("name")] = n["id"]
        for line in p.read_text(errors="replace").splitlines()[-200:]:
            r = json.loads(line)
            t = time.mktime(time.strptime(str(r.get("at"))[:19], "%Y-%m-%dT%H:%M:%S"))
            if now - t >= FLOW_S:
                continue
            asker = by_name.get(r.get("cart")) or "lacuna"
            for g in r.get("rungs") or []:
                mid = "mind:" + str(g.get("model") or "")
                flows.append({"a": asker, "b": mid, "kind": f"asks · {r.get('job')}", "t": t})
                if g.get("answer"):
                    flows.append({"a": mid, "b": asker, "kind": "answers", "t": t + float(g.get("ms") or 0) / 1000})
    except Exception:  # noqa: BLE001 — the swarm stands without the cascade's traffic
        pass
    flows += _wire(time.time(), {n["id"] for n in nodes})        # every logged message between agents, in the direction it went (2026-10-19)
    n, e, f = _jobs(nodes)                                     # the jobs the carts started (the pass, tests, builds), tied to them
    nodes += n
    edges += e
    flows += f
    ids = {n["id"] for n in nodes}
    for e in edges:                                           # a mind an agent names but that is not loaded: drawn small
        for k in ("a", "b"):
            if e[k] not in ids and e[k].startswith("mind:"):
                nodes.append({"id": e[k], "name": mind_name(e[k][5:]), "sub": f"{weight(e[k][5:])} · {e[k][5:]}", "kind": "mind", "cluster": "minds", "state": "idle", "size": 9,
                              "mail": 0, "last": f"not loaded · {mind_does(e[k][5:])}", "does": mind_does(e[k][5:]), "talk": False})
                ids.add(e[k])
    edges = [e for e in edges if e["a"] in ids and e["b"] in ids]
    flows = [f for f in flows if f["a"] in ids and f["b"] in ids]
    return {"nodes": nodes, "edges": edges, "flows": flows, "at": time.time()}


# ── a link between two agents: what they are saying, and stopping it (the owner, 2026-10-18: "I can click on the link
# and see what they're talking about. And then I can stop that from happening") ──────────────────────────────────────
def _said_by(nid: str, n: int = 12) -> list:
    """The latest messages one agent sent or received, as lines: a jail worker's mailbox, a foreman worker's events."""
    out = []
    d = _world() / "jobs" / nid
    if nid.startswith("w-") and d.is_dir() and (d / "mailbox.jsonl").exists():
        for m in _lines(d / "mailbox.jsonl", n):
            words = (m.get("job") or {}).get("brief") or m.get("said") or m.get("text") or m.get("kind")
            out.append({"t": m.get("t"), "from": m.get("from") or m.get("worker") or nid, "to": m.get("to") or "lacuna", "kind": m.get("kind"), "said": str(words)[:240]})
        prog = _read(d / "progress.json", {}) or {}
        if prog.get("note"):
            out.append({"t": None, "from": nid, "to": "lacuna", "kind": "progress", "said": str(prog["note"])[:240]})
        return out[-n:]
    try:
        from . import agent_talk
        for e in (agent_talk.tree().get("events") or [])[-200:]:
            if e.get("id") == nid:
                out.append({"t": e.get("t"), "from": "foreman", "to": nid, "kind": e.get("kind"), "said": str(e.get("why") or "")[:240]})
    except Exception:  # noqa: BLE001
        pass
    return out[-n:]


def link(a: str, b: str) -> dict:
    """Both ends of a link and what passed between them, newest last."""
    msgs = sorted(_said_by(a) + _said_by(b), key=lambda m: m.get("t") or 0)
    return {"a": a, "b": b, "messages": msgs[-20:]}


def stop(nid: str, who: str) -> dict:
    """Stop one agent by the owner's word: a foreman worker through the foreman, a jail worker through the jail's
    foreman. Lacuna itself and the foreman are not stopped from here."""
    import re as _re
    import subprocess
    from .core import audit
    if nid in ("lacuna", "foreman") or not _re.fullmatch(r"[\w:.-]{1,80}", nid):
        return {"ok": False, "why": f"{nid} is not stopped from the swarm"}
    if nid.startswith("errand:"):                     # an errand SLEEPS: switched off (it stays off) and its runner stopped
        import json as _json
        import os as _os
        import signal as _sig
        d = _world() / "jobs" / nid.split(":", 1)[1]
        job = _read(d / "job.json", None)
        if not job:
            return {"ok": False, "why": f"no errand {nid}"}
        job["state"] = "off"
        (d / "job.json").write_text(_json.dumps(job, indent=1))
        pid = (_read(d / ".runner.json", {}) or {}).get("pid")
        try:
            if pid:
                _os.kill(int(pid), _sig.SIGTERM)
        except (OSError, ValueError):
            pass
        audit(who, "swarm.sleep", errand=nid, pid=pid)
        return {"ok": True, "said": f"{job.get('name')} is asleep: switched off and its runner stopped (wake it by setting it on)"}
    if nid.startswith("w-") and (_world() / "jobs" / nid).is_dir():
        p = subprocess.run(["python3", str(Path.home() / ".lacuna" / "jail" / "workers" / "foreman.py"), "kill", nid],
                           capture_output=True, text=True, timeout=30)
        audit(who, "swarm.stop", worker=nid, said=(p.stdout or p.stderr)[-200:])
        return {"ok": p.returncode == 0, "said": (p.stdout or p.stderr).strip()[-200:]}
    from . import agent_talk
    r = agent_talk.interrupt(nid, "stop", who)
    audit(who, "swarm.stop", worker=nid, said=str(r)[:200])
    return r
