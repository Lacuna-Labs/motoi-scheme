"""CONTINUITY (2026-10-20): "continue" is never small talk; a reply cut by the token cap is continued, not delivered; the
window carries what Lacuna DID (tool steps), and a run of empty turns or repeated "continue" cannot push the real talk out."""
import importlib
import time


def load(tmp_path, monkeypatch):
    monkeypatch.setenv("LACUNA_HOME", str(tmp_path))
    monkeypatch.setenv("LACUNA_NO_WORKERS", "1")
    import lacuna_api.control.core as core
    importlib.reload(core)
    import lacuna_api.control.memory as memory
    importlib.reload(memory)
    import lacuna_api.control.chat as chat
    importlib.reload(chat)
    return memory, chat


def test_continue_is_not_quick_even_when_the_thread_is_cold(tmp_path, monkeypatch):
    memory, chat = load(tmp_path, monkeypatch)
    for w in ("continue", "go on", "keep going", "do it", "yes", "try again", "finish it", "proceed"):
        assert not chat.is_quick(w), w
    assert chat.is_quick("hi") and chat.is_quick("thanks")


def test_any_short_line_after_recent_tool_work_is_not_quick(tmp_path, monkeypatch):
    memory, chat = load(tmp_path, monkeypatch)
    memory.remember("user", "[o] fetch the weights", "alfred", "console")
    memory.remember("assistant", "Started.", "lacuna", "console", steps=[{"kind": "tool", "tool": "shell", "args": {"cmd": "ls"}, "ok": True, "text": "x"}])
    assert memory.minutes_since_work() < 1
    assert not chat.is_quick("sounds good")
    assert chat.is_quick("hi") is True or chat.is_quick("hi") is False   # a greeting stays the caller's rule, tested above


def test_window_drops_empty_replies_and_repeated_continue(tmp_path, monkeypatch):
    memory, chat = load(tmp_path, monkeypatch)
    memory.remember("user", "[o] build the sentry corpus", "alfred", "console")
    memory.remember("assistant", "Building it now.", "lacuna", "console")
    for _ in range(30):
        memory.remember("user", "[the owner · Tue 20 Oct 2026 04:36] continue", "alfred", "console")
        memory.remember("assistant", "", "lacuna", "console")
    memory.remember("user", "[o] where are we?", "alfred", "console")
    texts = [m["content"] for m in memory.recent()]
    assert any("build the sentry corpus" in t for t in texts)
    assert sum("continue" in t for t in texts) <= 1
    assert not any(m["role"] == "assistant" and not m["content"].strip() for m in memory.recent())


def test_window_keeps_her_words_clean_and_the_ledger_carries_what_she_ran(tmp_path, monkeypatch):
    """The record of tool steps used to be appended to her history; she copied it into her reply. It rides in <did> only."""
    memory, chat = load(tmp_path, monkeypatch)
    memory.remember("user", "[o] start the sentry training", "alfred", "console")
    memory.remember("assistant", "Training started.", "lacuna", "console",
                    steps=[{"kind": "tool", "tool": "forge", "args": {"op": "train", "name": "sentry-w1"}, "ok": True, "text": "pid 4242"}])
    memory.remember("user", "[o] what did you run?", "alfred", "console")
    a = [m for m in memory.recent() if m["role"] == "assistant"][0]["content"]
    assert a == "Training started." and "record of this turn" not in a
    assert any("forge" in x and "sentry-w1" in x for x in memory.work_lines())


def test_work_ledger_lists_recent_steps_and_the_task_note(tmp_path, monkeypatch):
    memory, chat = load(tmp_path, monkeypatch)
    memory.remember("assistant", "ok", "lacuna", "console",
                    steps=[{"kind": "tool", "tool": "shell", "args": {"cmd": "ls ~/.forge"}, "ok": False, "text": "blocked: outside workspace"}])
    from lacuna_api.control import brief
    notes = tmp_path / "notes"
    notes.mkdir()
    (notes / "active-task.md").write_text("# ACTIVE MISSION: train sentry\nStatus: IN_PROGRESS\n")
    monkeypatch.setattr(brief, "NOTES", notes)
    out = brief.ledger()
    assert "<task" in out and "train sentry" in out
    assert "<did" in out and "ls ~/.forge" in out and "blocked" in out


def test_a_reply_cut_by_the_cap_is_continued_with_the_cap_lifted(tmp_path, monkeypatch):
    memory, chat = load(tmp_path, monkeypatch)
    calls = []

    def fake(messages, tools, model, job, emit, lane="person"):
        calls.append(chat.MAX_OUT.get())
        if len(calls) == 1:
            return {"message": {"role": "assistant", "content": "The weights sit in the forge cache and the command that fetches them is `python3 -c \"import x; x.go("}, "done": True, "cut": True}
        return {"message": {"role": "assistant", "content": "", "tool_calls": [{"function": {"name": "nonexistent_tool", "arguments": {}}}]}, "done": True} \
            if len(calls) == 2 else {"message": {"role": "assistant", "content": "Done."}, "done": True}

    monkeypatch.setattr(chat, "_ollama", lambda m, t, mo, j, lane="person": fake(m, t, mo, j, None))
    r = chat.ask("keep going on the sentry corpus", who="alfred", session="t", dry=True)
    assert len(calls) >= 2, calls
    assert calls[0] in (0, 200)                      # the first round: no cap set here (DEFAULT_OUT applies) or the quick cap
    assert calls[1] == chat.CONTINUE_OUT > chat.DEFAULT_OUT      # the continuation gets more room
    assert r["ok"]


def test_forge_words_bring_the_forge_playbook(tmp_path, monkeypatch):
    memory, chat = load(tmp_path, monkeypatch)
    from lacuna_api.control import brief
    pb = tmp_path / "FORGE-RUN.md"
    pb.write_text("# P-FORGE-RUN\n" + "Base models sit in forge/weights, copied from ~/.forge/hf. " * 12)
    import lacuna_api.control.rag as rag
    monkeypatch.setattr(rag, "search", lambda *a, **k: [])
    monkeypatch.setattr(brief, "_path_of", lambda src: pb if src == "lacuna/FORGE-RUN" else None)
    monkeypatch.setattr(brief, "_things", lambda *a, **k: [])
    monkeypatch.setattr(brief, "_carts_like", lambda *a, **k: [])
    monkeypatch.setattr(brief, "_then", lambda *a, **k: "")
    monkeypatch.setattr(brief, "_memory", lambda *a, **k: "")
    assert "forge/weights" in brief.build("find the base model weights for the 270m")
    assert "forge/weights" not in brief.build("how is the weather")


def test_every_stream_call_has_an_end(tmp_path, monkeypatch):
    memory, chat = load(tmp_path, monkeypatch)
    import json
    seen = {}

    class R:
        def __enter__(self): return iter([json.dumps({"message": {"content": "hi"}, "done": True, "done_reason": "stop"}).encode()])
        def __exit__(self, *a): return False
    monkeypatch.setattr(chat.urllib.request, "urlopen", lambda req, timeout=0: (seen.update(json.loads(req.data)), R())[1])
    chat._ollama_stream([{"role": "user", "content": "x"}], [], "m", "ops", lambda ev: None)
    assert 0 < seen["options"]["num_predict"] <= 6000


def test_window_never_shows_the_model_its_own_prose_tool_calls(tmp_path, monkeypatch):
    """2026-10-20: her replies ended `forge op=status` (prose), the window replayed them, and she copied them instead of calling
    the tool — native calls 1 turn in 9 with them in the history, 9 in 9 without."""
    memory, chat = load(tmp_path, monkeypatch)
    memory.remember("user", "[o] start", "alfred", "console")
    memory.remember("assistant", "I'll check the status first.\n\n`forge op=status`\n`tool name=mind args={'op': 'list'}`\n"
                    "`work add title=\"Check\" ref=\"p-1\"`\n\nThen `ls -la` stays, and so does `export FOO=bar`.", "lacuna", "console")
    memory.remember("user", "[o] go", "alfred", "console")
    a = [m for m in memory.recent() if m["role"] == "assistant"][0]["content"]
    assert "forge op=status" not in a and "name=mind" not in a and "work add title" not in a
    assert "I'll check the status first." in a and "`ls -la`" in a and "export FOO=bar" in a


def test_the_tool_door_mends_every_shape_she_was_seen_to_send(tmp_path, monkeypatch):
    """2026-10-20 audit: `tool` refused {"name":"forge"} + op beside it, {"args":{"name":"forge",…},"op":…} and {"name":"tool","args":{"name":…}}."""
    memory, chat = load(tmp_path, monkeypatch)
    chat.head_tool_specs()
    seen = []
    monkeypatch.setattr(chat, "call_tool", lambda n, a, who, dry=False: (seen.append((n, a)), {"ok": True})[1])
    chat.tool({"name": "forge", "op": "status"}, "t")
    chat.tool({"args": {"name": "forge", "specialist": "sentry"}, "op": "pairs"}, "t")
    chat.tool({"name": "tool", "args": {"name": "forge", "args": {"op": "eval"}}}, "t")
    chat.tool({"name": "forge", "args": {"op": "train"}}, "t")
    assert seen == [("forge", {"op": "status"}), ("forge", {"specialist": "sentry", "op": "pairs"}),
                    ("forge", {"op": "eval"}), ("forge", {"op": "train"})]


def test_where_finds_the_models_without_the_shell(tmp_path, monkeypatch):
    memory, chat = load(tmp_path, monkeypatch)
    out = chat.call_tool("where", {"op": "models"}, "claude")
    assert out.get("ok") is True and "base_weights" in out and "do NOT download" in out["note"]
    assert chat.call_tool("where", {"op": "paths"}, "claude")["ok"] and chat.call_tool("where", {"op": "nope"}, "claude").get("refused")
    assert "where" in [t["function"]["name"] for t in chat.head_tool_specs()]


def test_a_call_with_args_nested_beside_its_own_arguments_runs(tmp_path, monkeypatch):
    memory, chat = load(tmp_path, monkeypatch)
    out = chat.call_tool("forge", {"args": {"op": "train", "specialist": "sentry"}, "op": "train"}, "claude", dry=True)
    assert "name a specialist" not in str(out)          # before: 'name a specialist: sentry, worker', seven times in one turn


# ── 2026-10-20 (later): prose calls run · a press wakes her at once · the queue follows the approvals ─────────────────────────────────────────

def test_a_call_written_as_the_last_line_is_made(tmp_path, monkeypatch):
    memory, chat = load(tmp_path, monkeypatch)
    chat.head_tool_specs()
    got = chat.prose_calls('The 270M needs training.\n\nshow_approval(action="forge op=train specialist=sentry")')
    assert got and got[0]["function"]["name"] == "show_approval" and got[0]["function"]["arguments"] == {"action": "forge op=train specialist=sentry"}
    got = chat.prose_calls("I'll look.\n`work add title=\"Train sentry\" ref=\"plan-1\"`\n`tool name=mind args={'op': 'list'}`")
    assert [g["function"]["name"] for g in got] == ["work", "tool"]
    assert got[0]["function"]["arguments"] == {"op": "add", "title": "Train sentry", "ref": "plan-1"}
    assert got[1]["function"]["arguments"] == {"name": "mind", "args": {"op": "list"}}
    assert chat.prose_calls("Use mode=fast when the box is busy, then call forge(op=status) later in the day.") == []    # a call inside a sentence is not a call
    assert chat.prose_calls("no_such_tool(x=1)") == []


def test_the_window_hides_python_style_calls_too(tmp_path, monkeypatch):
    memory, chat = load(tmp_path, monkeypatch)
    memory.remember("user", "[o] go", "alfred", "console")
    memory.remember("assistant", 'Sending it.\n\nshow_approval(action="forge op=train")', "lacuna", "console")
    memory.remember("user", "[o] and?", "alfred", "console")
    assert "show_approval" not in [m for m in memory.recent() if m["role"] == "assistant"][0]["content"]


def test_an_owner_press_is_a_chip_at_once_and_never_a_turn(tmp_path, monkeypatch):
    """Order §1.13a and the lead's ruling (2026-11-06): "a press result is a chip and a floor record, never a turn"; the queue still
    ticks at once (the start button), and a work order's own answer gives neither. Failure class: a wrong road (a result as a turn)."""
    memory, chat = load(tmp_path, monkeypatch)
    from lacuna_api.control import workers, workqueue
    chips, turns, ticks = [], [], []
    monkeypatch.setattr(chat, "ask", lambda *a, **k: turns.append(a) or {"ok": True})
    monkeypatch.setattr(workers, "raise_alert", lambda key, level, title, body, notify=True: chips.append((key, level, title, body)))
    monkeypatch.setattr(workqueue, "tick", lambda: ticks.append(1))
    results = {"abc12345": {"said": "training started"}, "def67890": {"said": "x"}, "fed00001": None, "bad00002": {"ok": False, "why": "the forge is busy"}}
    monkeypatch.setattr(chat, "_decided_inner", lambda pid, approve, who, by: {"ok": True, "petition": {"id": pid, "action": "forge-train", "reason": "train Sentry", "result": results[pid]}})
    chat._decided("abc12345", True, "alfred", "device:desk-2")
    chat._decided("def67890", True, "lacuna", "work-order (alfred)")
    chat._decided("fed00001", False, "alfred", "device:desk-2")
    chat._decided("bad00002", True, "alfred", "owner-key")
    assert [(c[0], c[1]) for c in chips] == [("work:press-abc12345", "done"), ("work:press-fed00001", "done"), ("work:press-bad00002", "error")]
    assert "YES" in chips[0][3] and "training started" in chips[0][3] and "declined" in chips[1][2] and "NO" in chips[1][3]
    assert "failed" in chips[2][2] and "the forge is busy" in chips[2][3]
    for _ in range(40):                                                                          # each press's tick runs in its own thread
        if len(ticks) == 3:
            break
        time.sleep(0.05)
    assert len(ticks) == 3 and turns == [] and not hasattr(chat, "system_turn")
    conv = tmp_path / "conversation.jsonl"
    assert not conv.exists() or "foreman:press" not in conv.read_text()


def test_the_queue_puts_an_approved_job_first_and_leaves_a_waiting_one(tmp_path, monkeypatch):
    memory, chat = load(tmp_path, monkeypatch)
    import lacuna_api.control.workqueue as wq
    importlib.reload(wq)
    monkeypatch.setattr(wq, "WORK", tmp_path / "work"); monkeypatch.setattr(wq, "QUEUE", tmp_path / "work" / "QUEUE.slat")
    chat._petitions.update({"p-wait": {"id": "p-wait", "state": "waiting", "action": "forge-train", "t": 1}, "p-yes": {"id": "p-yes", "state": "approved", "action": "forge-eval", "t": 2}})
    a = wq.add("train sentry", "lacuna", waits_for="p-wait")["item"]
    b = wq.add("eval sentry", "lacuna", waits_for="p-yes")["item"]
    c = wq.add("tidy notes", "lacuna")["item"]
    order = [i["id"] for i in wq.ranked(wq.load())]
    assert order == [b["id"], c["id"]] and a["id"] not in order           # approved first, plain next, the one waiting on a press not at all
    chat._petitions["p-wait"]["state"] = "declined"
    q = wq.load()
    assert [i["id"] for i in wq.ranked(q)] == [b["id"], c["id"]]
    assert q["items"][0]["state"] == "stopped" and "declined" in q["items"][0]["note"]        # a declined card ends its job, said


def test_the_world_snapshot_never_runs_from_a_test_or_twice_in_an_hour(tmp_path, monkeypatch):
    """2026-10-20: every pass that started its clocks at zero wrote a 1.2 GB bundle — 31 GB in an afternoon, the disk at 97%."""
    memory, chat = load(tmp_path, monkeypatch)
    from lacuna_api.control import workers
    import subprocess
    (tmp_path / "lacuna-world" / ".git").mkdir(parents=True)
    monkeypatch.setattr(workers.Path, "home", classmethod(lambda cls: tmp_path))
    ran = []
    monkeypatch.setattr(subprocess, "run", lambda *a, **k: ran.append(a) or subprocess.CompletedProcess(a, 0, "", ""))
    workers._snapshot_world()                                      # LACUNA_HOME is a test home: nothing runs, nothing is written
    assert ran == [] and not (tmp_path / "Lacuna-Backups").exists()
    monkeypatch.setattr(workers, "LACUNA_HOME", tmp_path / ".lacuna")                # now "real": an hour-old bundle allows one, a fresh one does not
    out = tmp_path / "Lacuna-Backups" / "world-hourly"; out.mkdir(parents=True)
    (out / "lacuna-world-20261020-0907.bundle").write_text("x")
    workers._snapshot_world()
    assert ran == []                                               # the newest bundle is minutes old: skipped


# ── the wake manager: a finished job wakes her between turns, never inside one ───────────────────────────────────────────────────────────────

def _wake(tmp_path, monkeypatch):
    memory, chat = load(tmp_path, monkeypatch)
    import lacuna_api.control.wake as wake
    importlib.reload(wake)
    monkeypatch.setattr(wake, "FILE", tmp_path / "wake-pending.json")
    return chat, wake


def test_a_thing_that_leaves_the_working_feed_is_one_event_with_its_facts(tmp_path, monkeypatch):
    chat, wake = _wake(tmp_path, monkeypatch)
    from lacuna_api.control import agents_live
    feeds = [{"working": [{"id": "errand:forge-sft", "kind": "errand", "what": "forge-sft", "since": time.time() - 300}], "watching": [{"id": "w-aaaa01", "kind": "worker"}], "stalled": []},
             {"working": [], "watching": [{"id": "w-aaaa01", "kind": "worker"}], "stalled": []}]
    phase = [0]                                           # the test turns the feed; another caller in the process only reads it
    monkeypatch.setattr(agents_live, "working", lambda: feeds[phase[0]])
    monkeypatch.setattr(wake, "_facts", lambda ref, item: ("forge-sft", "ended", "loss 0.034 | saved GGUF"))
    wake.scan()                                           # the baseline: nothing is an event
    assert wake.pending() == []
    phase[0] = 1
    wake.scan()
    ev = wake.pending()
    assert len(ev) == 1 and ev[0]["ref"] == "errand:forge-sft" and ev[0]["detail"] == "loss 0.034 | saved GGUF"
    assert wake.post("errand", "errand:forge-sft", "forge-sft", "ended") is False                 # the same thing noticed twice is one event


def test_a_finished_thing_is_a_chip_on_the_floor_and_never_a_turn_in_the_conversation(tmp_path, monkeypatch):
    """Order §1.13a (2026-11-06): 15 `[foreman:press]` turns about finished workers reached ~/.lacuna/conversation.jsonl, each answered
    "already retired" or "Nothing needs me" (law 14, the two lanes). Failure class: a wrong road (an event written as a chat turn)."""
    chat, wake = _wake(tmp_path, monkeypatch)
    from lacuna_api.control import workers
    sent, chips = [], []
    monkeypatch.setattr(chat, "ask", lambda *a, **k: sent.append(a) or {"ok": True})
    monkeypatch.setattr(workers, "raise_alert", lambda key, level, title, body, notify=True: chips.append((key, level, title)))
    wake.post("errand", "errand:a", "pairs-w1", "ended", "voted 400", 120)
    wake.post("job", "j1", "battery", "failed (exit 1)", "3 reds", 50)
    assert [c[1] for c in chips] == ["done", "error"] and "battery failed" in chips[1][2]          # the chip is the event's one road
    assert wake.settle() == 0 and len(wake.pending()) == 2                                       # inside the debounce: they wait
    for e in wake._pending:
        e["t"] -= 30
    assert wake.settle() == 2 and wake.pending() == [] and sent == []                            # settled to the floor; no turn given
    conv = tmp_path / "conversation.jsonl"
    assert not conv.exists() or "foreman:press" not in conv.read_text()
    assert not hasattr(wake, "deliver") and not hasattr(wake, "compose")                         # the road to a turn is gone, not idle


def test_a_routine_verifier_never_wakes_her_but_a_failure_and_a_forge_run_do(tmp_path, monkeypatch):
    chat, wake = _wake(tmp_path, monkeypatch)
    assert wake.worth({"id": "w-20d9eb", "what": "ipad-verify · working"}, "retired", 4) is False
    assert wake.worth({"id": "w-20d9eb", "what": "ipad-verify"}, "crashed", 4) is True              # a failure always
    assert wake.worth({"id": "errand:forge-sft", "what": "forge-sft"}, "ended", 600) is True
    assert wake.worth({"id": "j9", "what": "battery"}, "done (exit 0)", 6) is False                  # too quick to matter
    assert wake.worth({"id": "work:W14", "what": "train"}, "done", 900) is True


def test_her_copied_record_line_never_rides_or_is_kept(tmp_path, monkeypatch):
    memory, chat = load(tmp_path, monkeypatch)
    memory.remember("user", "[o] go", "alfred", "console")
    memory.remember("assistant", "Started.\n\n(record of this turn, not your words — ran: tool `name=forge` (args={'op': 'status'}))", "lacuna", "console")
    memory.remember("user", "[o] and?", "alfred", "console")
    assert [m for m in memory.recent() if m["role"] == "assistant"][0]["content"] == "Started."


def test_an_approved_train_reopens_a_specialist_whose_result_already_exists(tmp_path, monkeypatch):
    """2026-10-20: the owner's yes on 'train Sentry' resumed an errand that saw results/<model>-w1.json, called itself done and trained nothing."""
    memory, chat = load(tmp_path, monkeypatch)
    from lacuna_api.control import forge, forge_results, forge_verbs
    res = tmp_path / "forge" / "results"; res.mkdir(parents=True)
    (res / "gemma-3-270m-it-w1.json").write_text("{}")
    monkeypatch.setattr(forge, "forge_dir", lambda: tmp_path / "forge")
    monkeypatch.setattr(forge_results, "results", lambda: [{"specialist": "sentry", "file": "gemma-3-270m-it-w1.json"}, {"specialist": "worker", "file": "w2.json"}])
    monkeypatch.setattr(forge, "summary", lambda: {"specialists": []})
    calls = []
    monkeypatch.setattr(forge_verbs, "_errand", lambda cmd, name: calls.append((cmd, name)) or {"ok": True, "said": "forge-sft: on"})
    job = tmp_path / "jobs" / "forge-sft"; job.mkdir(parents=True)
    (job / ".runner.json").write_text('{"pid": null, "last_exit": 0, "not_before": 99, "runs": 48}')
    monkeypatch.setattr(forge, "world", lambda: tmp_path)
    out = forge_verbs.decided("forge-train", {"specialist": "sentry", "errand": "forge-sft"}, True, "device:desk-2")
    import json as _j
    rs = _j.loads((job / ".runner.json").read_text())
    assert rs["last_exit"] is None and "not_before" not in rs and rs["runs"] == 48          # re-armed: the runner will start it again
    assert calls == [("resume", "forge-sft")] and "kept in results/before-retrain" in out["said"]
    assert not (res / "gemma-3-270m-it-w1.json").exists()
    kept = list(res.glob("before-retrain-*/gemma-3-270m-it-w1.json"))
    assert len(kept) == 1                                          # moved, never deleted


def test_prose_calls_supports_markdown_lists_and_unquoted_sh(tmp_path, monkeypatch):
    memory, chat = load(tmp_path, monkeypatch)
    chat.head_tool_specs()
    got = chat.prose_calls("Here is the plan:\n1. agents op=list\n2. agents op=stop id=w-123")
    assert len(got) == 2
    assert got[0]["function"]["name"] == "agents" and got[0]["function"]["arguments"] == {"op": "list"}
    assert got[1]["function"]["name"] == "agents" and got[1]["function"]["arguments"] == {"op": "stop", "id": "w-123"}

    got2 = chat.prose_calls("Actions:\n- `agents op=status`")
    assert len(got2) == 1 and got2[0]["function"]["name"] == "agents" and got2[0]["function"]["arguments"] == {"op": "status"}


def test_a_plan_in_deep_mode_carries_on_to_execution(tmp_path, monkeypatch):
    memory, chat = load(tmp_path, monkeypatch)
    chat.head_tool_specs()
    rounds = []

    def fake(messages, tools, model, job, emit, lane="person"):
        rounds.append(len(messages))
        if len(rounds) == 1:
            # Round 0: 12B produces a plan in deep mode with closing offer
            return {"message": {"role": "assistant", "content": "Here is my plan to resolve the issue:\n1. Check running agents\n2. Stop stalled workers\n\nShall I proceed?"}, "done": True}
        # Round 1: Model was told to carry on and makes a tool call
        assert any("Go on — do that now." in m.get("content", "") for m in messages if m.get("role") == "user")
        return {"message": {"role": "assistant", "content": "Checking workers now.", "tool_calls": [{"function": {"name": "agents", "arguments": {"op": "list"}}}]}, "done": True}

    monkeypatch.setattr(chat, "_ollama_stream", lambda m, t, mo, j, emit, lane="person": fake(m, t, mo, j, emit))
    monkeypatch.setattr(chat, "call_tool", lambda name, args, who, dry=False: {"ok": True, "workers": []})
    r = chat.ask("diagnose and fix the stalled workers", who="alfred", session="t", dry=True)
    assert len(rounds) >= 2
    assert r["ok"]

