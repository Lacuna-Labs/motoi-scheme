"""The Forge card's three petitions (CARDS-2.0 §6.5, §9.3; lane F2): forge-job, forge-resume and forge-exam are foreman
petitions whose effect is written by code; the yes of forge-job spawns the pausable forge-job cart and presses its one act;
the yes of forge-resume sends the foreman's resume with the press and the diff; the yes of forge-exam starts the exam
runner once; a decline runs nothing. The cart the yes spawns is loaded by the real Supervisor in a node child (the fake
host; nothing reaches the box). Session: eval:f2-petitions."""
import json
import subprocess
from pathlib import Path

JOB = {"kind": "signal->label", "base": "270m", "pairs": 206, "steps": 154, "minutes": 3, "parks_26b": False, "swap": "none"}
REPO = Path(__file__).resolve().parents[2]


def test_the_three_are_foreman_petitions_with_their_effect_from_code(monkeypatch, lacuna_home):
    from lacuna_api.control import chat
    assert {"forge-job", "forge-resume", "forge-exam"} <= set(chat.FOREMAN_ACTIONS)
    r = chat.file_petition("forge-job", None, "the estimate (eval:f2-petitions)", "alfred", dry=True, args=JOB)
    assert r["dry_run"] and "trains the 270m for signal->label on 206 pairs, 154 steps, about 3 min; the 26B stays" in r["if_approved"]
    assert "nothing: the forge trains" in chat.file_petition("forge-job", None, "x", "alfred", dry=True, args={**JOB, "base": "12b"})["if_approved"]
    assert "the diff you saw (0123456789abcdef)" in chat.file_petition("forge-resume", None, "x", "alfred", dry=True, args={"worker": "w-a1", "diff": "0123456789abcdef"})["if_approved"]
    assert "sits the signal->label exam once" in chat.file_petition("forge-exam", None, "x", "alfred", dry=True, args={"run": "w-a1", "base": "270m", "kind": "signal->label"})["if_approved"]


def test_forge_job_spawns_the_pausable_cart_and_presses_its_one_act(monkeypatch, lacuna_home):
    from lacuna_api.control import foreman
    calls = []

    def call(m, p, b=None, timeout=10):
        calls.append((m, p, b))
        if p == "/workers":
            return {"ok": True, "worker": {"id": "w-job1", "pending": [{"ticket": "w-job1-a1", "kind": "act", "op": "forge"}]}}
        return {"ok": True}
    monkeypatch.setattr(foreman, "call", call)
    out = foreman.decided("forge-job", JOB, True, "alfred")
    assert out == {"ok": True, "worker": "w-job1", "pressed": ["w-job1-a1"]}
    assert calls[0][2]["tier"] == "act" and "(pausable . #t)" in calls[0][2]["program"] and "(memory-mb . 2048)" in calls[0][2]["program"]
    assert calls[1] == ("POST", "/press", {"ticket": "w-job1-a1", "by": "alfred"})
    assert foreman.decided("forge-job", JOB, False, "alfred") == {"ok": True, "declined": True}
    assert "pair count" in foreman.decided("forge-job", {**JOB, "pairs": None}, True, "alfred")["why"]
    assert "outside" in foreman.decided("forge-job", {**JOB, "pairs": 0}, True, "alfred")["why"]
    assert "not a job kind" in foreman.decided("forge-job", {**JOB, "kind": "Rm -rf"}, True, "alfred")["why"]
    monkeypatch.setattr(foreman, "call", lambda m, p, b=None, timeout=10: {"ok": False, "why": "the foreman is hushed"})
    assert foreman.decided("forge-job", JOB, True, "alfred")["why"] == "the foreman is hushed"


def test_the_spawned_cart_names_its_trainer_waits_while_parked_and_is_done_on_exit_0():
    from lacuna_api.control import forge_jobs
    j, _ = forge_jobs.job_of(JOB)
    js = (f"import {{ makeSup }} from '{REPO}/test/conformance/fake-host.mjs';"
          f"const P = {json.dumps(forge_jobs.program(j))};"
          "const out = {}; const { h, s } = makeSup(); const w = s.spawn({ program: P });"
          "out.load = [w.state, w.last, w.pausable && [w.pausable.base, w.pausable.kind, w.pausable.etaS], w.pending.map((t) => [t.kind, t.op, t.args])];"
          "s.send(w.id, 'act', { ticket: w.pending[0].ticket, op: 'forge', exit: 0, rows: { pid: 4242, run_dir: '/runs/job-w1', job: w.id, started: true } });"
          "out.started = [w.state, w.pausable.pid, w.pausable.runDir, w.kv.job];"
          "s.send(w.id, 'hand', { op: 'forge-job', exit: 0, rows: { ended: false, step: 40 } });"
          "s.send(w.id, 'hand', { op: 'forge-job', exit: 0, rows: { ended: true, exit: { exit: 0, parked_at: 75 } } });"
          "out.parked = w.state;"
          "s.send(w.id, 'resume', { checkpoint: 'adapters/0000075_adapters.safetensors', step: 75 });"
          "out.resume = w.pending.filter((t) => t.kind === 'act').map((t) => t.args);"
          "s.send(w.id, 'hand', { op: 'forge-job', exit: 0, rows: { ended: true, exit: { exit: 0, steps: 154 } } });"
          "await new Promise((r) => setTimeout(r, 10)); out.done = [w.state, w.contract.exit, h.up.filter((u) => u.kind === 'exam-owed').length];"
          "const f = s.spawn({ program: P }); s.send(f.id, 'act', { ticket: f.pending[0].ticket, op: 'forge', exit: 12, why: 'not now' });"
          "await new Promise((r) => setTimeout(r, 10)); out.refused = [f.state, h.up.filter((u) => u.kind === 'exam-owed').length];"
          "console.log(JSON.stringify(out))")
    out = json.loads(subprocess.run(["node", "--input-type=module", "-e", js], capture_output=True, text=True, timeout=60, check=True).stdout)
    assert out["load"] == ["running", None, ["270m", "signal->label", 180], [["act", "forge", ["train", "signal->label", "270m", 206]]]]
    assert out["started"][0:3] == ["running", 4242, "/runs/job-w1"] and out["started"][3].startswith("w")
    assert out["parked"] == "running", "a parked trainer is waited on, never done"
    assert ["train", "signal->label", "270m", 206, "adapters/0000075_adapters.safetensors"] in out["resume"]
    assert out["done"] == ["retired", 0, 1], "done on the trainer's exit 0; the exam is owed to the press"
    assert out["refused"] == ["retired", 1], "a refused start stops and owes no exam"


def test_forge_resume_sends_the_press_and_the_diff_and_refuses_without_them(monkeypatch, lacuna_home):
    from lacuna_api.control import foreman
    calls = []
    monkeypatch.setattr(foreman, "call", lambda m, p, b=None, timeout=10: calls.append((m, p, b)) or {"ok": True, "from_park": 300})
    assert foreman.decided("forge-resume", {"worker": "w-a1", "diff": "0123456789abcdef"}, True, "alfred")["from_park"] == 300
    assert calls[0] == ("POST", "/workers/w-a1/interrupt", {"mode": "resume", "by": "alfred", "pressed": True, "diff": "0123456789abcdef"})
    calls.clear()

    def call(m, p, b=None, timeout=10):
        calls.append((m, p, b))
        if p == "/workers/w-a1":
            return {"ok": True, "worker": {"pending": [{"ticket": "w-a1-a9", "kind": "press", "op": "forge"}, {"ticket": "w-a1-h1", "kind": "hand", "op": "forge-job"}]}}
        return {"ok": True}
    monkeypatch.setattr(foreman, "call", call)
    out = foreman.decided("forge-resume", {"worker": "w-a1", "diff": "0123456789abcdef"}, True, "alfred")
    assert out["pressed"] == ["w-a1-a9"] and calls[-1] == ("POST", "/press", {"ticket": "w-a1-a9", "by": "alfred"})
    assert "diff's hash" in foreman.decided("forge-resume", {"worker": "w-a1", "diff": "not a hash"}, True, "alfred")["why"]
    assert "diff's hash" in foreman.decided("forge-resume", {"worker": "errand:x", "diff": "0123456789abcdef"}, True, "alfred")["why"]


def test_forge_exam_starts_the_runner_once_and_refuses_what_it_cannot_sit(monkeypatch, lacuna_home):
    from lacuna_api.control import forge_jobs, foreman
    started = []
    a = {"run": "w-a1", "base": "270m", "kind": "signal->label", "quant": "lacuna-sentry-270m:v1", "mind": "sentry/270m@1"}
    out = forge_jobs.decided("forge-exam", a, True, "alfred", foreman.call, start_exam=lambda argv: started.append(argv) or 4242)
    assert out == {"ok": True, "started": 4242, "exam": "w1-signal-label-l0.slat", "quant": "lacuna-sentry-270m:v1"}
    assert started[0][-4:] == ["--deadline", "900", "--mind", "sentry/270m@1"] and len(started) == 1
    assert "no exam file for yes-no" in forge_jobs.decided("forge-exam", {**a, "kind": "yes-no"}, True, "alfred", foreman.call)["why"]
    assert "weights' tag" in forge_jobs.decided("forge-exam", {**a, "quant": ""}, True, "alfred", foreman.call)["why"]
    assert forge_jobs.decided("forge-exam", a, False, "alfred", foreman.call) == {"ok": True, "declined": True}


def test_the_cart_waits_on_its_press_and_the_kernel_sends_an_early_press_with_the_act():
    """F5 (§9.3 step 3): the hands' `waiting` reply is the act waiting on its press, never a failed start; a press that lands
    before that reply is held for its ticket and the same ticket goes to the hands again, pressed (alive.mjs closeTicket)."""
    from lacuna_api.control import forge_jobs
    j, _ = forge_jobs.job_of(JOB)
    js = (f"import {{ makeSup }} from '{REPO}/test/conformance/fake-host.mjs';"
          f"import {{ press }} from '{REPO}/lacuna-foreman/intents.mjs';"
          f"const P = {json.dumps(forge_jobs.program(j))};"
          "const { h, s } = makeSup(); const w = s.spawn({ program: P }); const t = w.pending[0].ticket;"
          "press(s, t, 'alfred');"
          "s.send(w.id, 'act', { ticket: t, op: 'forge', waiting: 'forge waits on the owner\\'s press' });"
          "const sent = h.up.filter((u) => u.kind === 'act' && u.data.ticket === t);"
          "console.log(JSON.stringify({ state: w.state, sent: sent.length, pressed: sent.at(-1).data.pressed, kind: w.pending[0].kind }))")
    out = json.loads(subprocess.run(["node", "--input-type=module", "-e", js], capture_output=True, text=True, timeout=60, check=True).stdout)
    assert out == {"state": "running", "sent": 2, "pressed": True, "kind": "act"}
