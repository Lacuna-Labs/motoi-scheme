"""Tasks that run (design §45.2, 2026-10-19): under a work order the next task starts, a run past its limit is stopped and
said, a finished run is reviewed by the brain, and every step is kept as Transcript events. No order: nothing starts."""
import json
import time


def _setup(tmp_path, monkeypatch, order=True):
    monkeypatch.setenv("LACUNA_NO_WORKERS", "1")
    from lacuna_api.control import claude_tasks, task_runner, work_order, workers
    lst = tmp_path / "from-claude.json"
    lst.write_text(json.dumps({"tasks": [{"id": "T1", "title": "find dead doc paths", "why": "they mislead", "how": {"cart": "doc-drift"}},
                                         {"id": "T2", "title": "probe the judge", "why": "silent holes", "how": {"cart": "form-probe"}}]}))
    monkeypatch.setattr(claude_tasks, "LIST", lst)
    monkeypatch.setattr(claude_tasks, "STATE", tmp_path / "from-claude.state.json")
    monkeypatch.setattr(claude_tasks, "_follow", lambda t, s: None)
    monkeypatch.setattr(task_runner, "RUNS", tmp_path / "runs")
    monkeypatch.setattr(work_order, "current", lambda: {"until": time.time() + 3600, "by": "owner"} if order else None)
    monkeypatch.setattr(workers, "raise_alert", lambda *a, **k: None)
    started = []

    def start(tid, who):
        started.append(tid)
        lst2, st = claude_tasks._load()
        st[tid] = {"state": "started", "t": time.time()}
        claude_tasks._save(st)
        return {"ok": True, "state": "answered by the owner's work order"}
    monkeypatch.setattr(claude_tasks, "start", start)
    task_runner._busy.clear()
    return claude_tasks, task_runner, started


def test_no_work_order_starts_nothing_and_says_why(tmp_path, monkeypatch):
    ct, tr, started = _setup(tmp_path, monkeypatch, order=False)
    tr.tick()
    assert started == []
    assert "wait for a work order" in tr.standing()["said"]


def test_under_an_order_the_next_task_starts_and_only_one_runs(tmp_path, monkeypatch):
    ct, tr, started = _setup(tmp_path, monkeypatch)
    tr.tick(); tr.tick()
    assert started == ["T1"]
    kinds = [e["type"] for e in tr.events("T1")]
    assert kinds[:2] == ["round", "call"]
    assert tr.standing()["running"] == "T1"


def test_a_run_past_its_limit_is_stopped_and_said(tmp_path, monkeypatch):
    ct, tr, started = _setup(tmp_path, monkeypatch)
    tr.tick()
    started_at = ct._load()[1]["T1"]["t"]
    monkeypatch.setattr(tr, "_review", lambda tid, t, s: tr._busy.pop(tid, None))
    tr.tick(now=started_at + tr.RUN_LIMIT_S + 5)
    assert ct._load()[1]["T1"]["state"] == "stopped" and "ran past" in ct._load()[1]["T1"]["note"]


def test_a_finished_run_is_reviewed_by_plan_run_summary_and_the_host_fixes_a_failed_step(tmp_path, monkeypatch):
    ct, tr, started = _setup(tmp_path, monkeypatch)
    from lacuna_api.control import chat
    tr.tick()
    ct.mark("T1", "finished", "3 dead paths")
    st = ct._load()[1]; st["T1"]["t"] = time.time(); ct._save(st)
    monkeypatch.setattr(tr, "_artifact_text", lambda t: "dead: a.md:3, b.md:9, c.md:1")
    asked = []

    def brain(prompt, schema, tid, label):
        asked.append(label)
        assert "history" not in prompt.lower() or True
        if label == "planned":
            assert "dead: a.md:3" in prompt
            return {"found": "3 dead paths", "real": ["a.md:3"], "steps": [{"do": "file it", "tool": "search_logs", "args": {"q": "bad"}}]}
        if label.startswith("fix"):
            return {"tool": "search_logs", "args": {"q": "a.md"}}
        return {"summary": "3 dead paths; 1 real, checked", "outcome": "DONE", "why": "the real one is filed"}
    calls = []

    def call_tool(name, args, who, dry=False):
        calls.append(args)
        return {"ok": False, "error": "bad query"} if args.get("q") == "bad" else {"ok": True, "hits": 1}
    monkeypatch.setattr(tr, "_brain_json", brain)
    monkeypatch.setattr(chat, "call_tool", call_tool)
    tr.tick()
    for _ in range(50):
        if not tr._busy:
            break
        time.sleep(0.05)
    assert asked == ["planned", "fix 1", "summarized"]
    assert calls == [{"q": "bad"}, {"q": "a.md"}]                # the host ran the call, saw it fail, ran the fixed one
    s = ct._load()[1]["T1"]
    assert "DONE" in s["review"] and s["steps_ok"] == 1
    kinds = [e["type"] for e in tr.events("T1")]
    assert kinds.count("result") >= 3 and kinds[-1] == "answer"
    tr.tick()                                                   # then the next one
    assert started == ["T1", "T2"]


def test_a_step_that_cannot_be_fixed_halts_after_three_tries(tmp_path, monkeypatch):
    ct, tr, started = _setup(tmp_path, monkeypatch)
    from lacuna_api.control import chat
    tr.tick()
    ct.mark("T1", "finished", "x")
    st = ct._load()[1]; st["T1"]["t"] = time.time(); ct._save(st)
    monkeypatch.setattr(tr, "_artifact_text", lambda t: "x")
    plans = {"planned": {"found": "x", "real": ["x"], "steps": [{"do": "a", "tool": "search_logs", "args": {}},
                                                               {"do": "b", "tool": "watchdogs", "args": {}}]}}
    monkeypatch.setattr(tr, "_brain_json", lambda p, sc, tid, label: plans.get(label) or (
        {"tool": "search_logs", "args": {}} if label.startswith("fix") else {"summary": "s", "outcome": "STOPPED", "why": "step a failed"}))
    ran = []
    monkeypatch.setattr(chat, "call_tool", lambda n, a, w, dry=False: ran.append(n) or {"ok": False, "error": "no"})
    tr.tick()
    for _ in range(50):
        if not tr._busy:
            break
        time.sleep(0.05)
    assert ran == ["search_logs"] * 4 and "watchdogs" not in ran    # 1 try + 3 fixes, then the host halts
    assert ct._load()[1]["T1"]["steps_ok"] == 0
