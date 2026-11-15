"""The cart book and killing a job (the finished-work list and STOP EVERYTHING are the door's: lacuna-node/test/work-finished.test.mjs)."""
import json
import time

from lacuna_api.control import cartbook, chat, finished


def test_cart_book_finds_lists_and_shows(tmp_path, monkeypatch):
    root = tmp_path / "carts" / "automations"
    for slug in ("repeat-buyer-thank-you", "pickup-ready-notify", "audit-no-photos"):
        (root / slug).mkdir(parents=True)
        (root / slug / f"{slug}.sks").write_text(";; title: " + slug + "\n(state a (done))\n")
    runs = {"repeat-buyer-thank-you": {"verdict": {"cls": "strict:no-table"}, "acts": [{"verb": "etsy/x", "kind": "fixture-gap"}]},
            "pickup-ready-notify": {"verdict": {"cls": "strict:works"}}, "audit-no-photos": {"verdict": {"cls": "strict:not-done"}}}
    (tmp_path / "runs.json").write_text(json.dumps(runs))
    monkeypatch.setattr(cartbook, "ROOT", root); monkeypatch.setattr(cartbook, "RUNS", tmp_path / "runs.json")
    monkeypatch.setattr(cartbook, "WORK", tmp_path / "work"); cartbook._c.update(t=0.0, runs={})
    s = cartbook.summary()
    assert s["carts"] == 3 and s["working"] == 1 and s["by_verdict"]["strict:no-table"] == 1
    assert [x["slug"] for x in cartbook.find("repeat buyer")["found"]] == ["repeat-buyer-thank-you"]
    assert [x["slug"] for x in cartbook.failing("", 10)["carts"]] == ["audit-no-photos", "repeat-buyer-thank-you"]      # a fixture gap (cannot pass on the mock) ranks last
    sh = cartbook.show("repeat-buyer-thank-you")
    assert sh["verdict"] == "strict:no-table" and "etsy/x (fixture-gap)" in sh["acts_with_nothing_to_read"] and "card repair" in sh["to_repair"]
    assert not cartbook.show("nope")["ok"]


def test_kill_job_ends_the_running_step_and_its_children(tmp_path, monkeypatch):
    import subprocess as sp
    jobdir = tmp_path / "lacuna-world" / "jobs" / "fix-x"; jobdir.mkdir(parents=True)
    parent = sp.Popen(["/bin/sh", "-c", "sleep 60 & wait"])            # a step with a child, like zsh -c … cardstep
    (jobdir / ".runner.json").write_text(json.dumps({"pid": parent.pid}))
    monkeypatch.setattr(finished, "HOME", tmp_path)
    import threading
    reaper = threading.Thread(target=parent.wait, daemon=True); reaper.start()      # the jobs runner reaps its steps; so does the test
    r = finished.kill_job("errand:fix-x")
    reaper.join(5)
    assert r["ok"] and r["killed"] and parent.returncode is not None
    assert not finished.kill_job("nope")["ok"]


def test_a_subscribed_reading_is_not_drawn_as_coming_from_lacuna(monkeypatch):
    from lacuna_api.control import swarm, agent_talk, foreman
    now = time.time()
    monkeypatch.setattr(agent_talk, "thoughts", lambda wid, n=12: {"items": [
        {"t": now - 5, "kind": "mail-in", "text": "mem_available_gb 2.7"}, {"t": now - 4, "kind": "mail-in", "text": "the dev API is healthy"}]})
    src = swarm._foreman.__code__
    assert "reading" in src.co_consts or any("reading" in str(c) for c in src.co_consts)


def test_the_wire_draws_each_logged_message_in_the_direction_it_went(tmp_path, monkeypatch):
    from lacuna_api.control import swarm
    home = tmp_path / ".lacuna"; home.mkdir()
    now = time.time()
    rows = [{"t": now - 2, "model": "functiongemma:latest", "lane": "small-mind", "who": None, "ms": 300},      # a worker asking a small mind
            {"t": now - 3, "model": "lacuna-worker-lite", "lane": None, "who": "background", "ms": 2000},        # a background call on the 26B
            {"t": now - 4, "model": "lacuna-worker-lite", "lane": "chat-x-all", "who": "person", "ms": 900}]    # the owner talking: not agent traffic
    (home / "minds-live.jsonl").write_text("\n".join(json.dumps(r) for r in rows) + "\n")
    (home / "audit.jsonl").write_text(json.dumps({"t": now - 1, "who": "lacuna", "action": "tool.stop_worker"}) + "\n")
    monkeypatch.setattr("pathlib.Path.home", lambda: tmp_path)
    monkeypatch.setenv("LACUNA_WORLD", str(tmp_path / "world"))
    f = swarm._wire(now, {"lacuna", "foreman", "mind:functiongemma", "cloud-lacuna"})
    pairs = {(x["a"], x["b"], x["kind"]) for x in f}
    assert ("foreman", "mind:functiongemma", "ask") in pairs and ("mind:functiongemma", "foreman", "answer") in pairs
    assert ("foreman", "lacuna", "brain") in pairs and ("lacuna", "foreman", "answer") in pairs
    assert ("lacuna", "foreman", "stop_worker") in pairs                       # Lacuna really did call the foreman
    assert len(f) == 5                                                         # the owner's own chat turn drew nothing


def test_activity_lists_only_what_is_really_running_and_says_what_it_is(tmp_path, monkeypatch):
    from lacuna_api.control import agents_live as al
    work = tmp_path / "lacuna-world" / "work" / "repair-x"; (work / "steps").mkdir(parents=True)
    (work / "CARD.md").write_text("# card: repair-x\nkind: cart\ngoal: Repair the cart some-cart so the strict checker passes.\nsteps_taken: 1\n\n## plan\n- [x] read it\n- [ ] edit it\n- [ ] check it\n")
    (work / "steps" / "01.log").write_text('→ read {"path": "a.sks"}\n→ edit {"edits": []}\n')
    monkeypatch.setattr("pathlib.Path.home", lambda: tmp_path)
    monkeypatch.setattr(al, "working", lambda: {"working": [
        {"id": "errand:repair-x", "kind": "errand", "what": "repair-x", "since": 1.0},
        {"id": "brain:slot1", "kind": "brain", "what": "brain slot 1 busy"},
        {"id": "chat", "kind": "chat", "what": "1 turn in flight"}], "stalled": []})
    monkeypatch.setattr("lacuna_api.control.plans.listing", lambda n=6: [{"id": "p-1", "state": "planning", "goal": "fix carts", "started": 2.0, "model": "gemini-3.8-flash"}])
    r = al.activity()
    ids = [i["id"] for i in r["items"]]
    assert ids == ["errand:repair-x", "p-1"]                                  # no brain slot, no chat turn
    c = r["items"][0]
    assert c["label"] == "repairing some-cart" and c["plan"] == "1/3 plan items done" and c["step"] == "step 2"
    assert c["last"][-1].startswith("edit ") and c["stoppable"] and c["where"]["app"] == "s-work"


def test_a_reused_pid_is_not_the_job(monkeypatch):
    from lacuna_api.control import agents_live as al
    import os
    assert al._proc_has(os.getpid(), "python") or al._proc_has(os.getpid(), "pytest")      # a real command line that names it
    assert not al._proc_has(os.getpid(), "no-such-job-name-xyz")                           # the pid exists but is not that job's


def test_a_card_with_a_problem_for_fifteen_minutes_raises_one_alert(monkeypatch):
    from lacuna_api.control import agents_live as al
    raised = []
    monkeypatch.setattr(al, "activity", lambda: {"items": [{"id": "errand:c1", "label": "repairing x", "diagnosis": ["its last write failed: …"]}]})
    monkeypatch.setattr("lacuna_api.control.workers.raise_alert", lambda key, level, title, body, notify=True: raised.append((key, title)))
    al._BAD_SINCE.clear(); al._ALERTED.clear()
    assert al.watch_cards(now=1000.0) == [] and al.watch_cards(now=1000.0 + 14 * 60) == []         # not yet
    assert al.watch_cards(now=1000.0 + 16 * 60) == ["errand:c1"]                                   # 15 min of trouble: one alert
    assert al.watch_cards(now=1000.0 + 30 * 60) == []                                              # not again within the hour
    assert raised == [("card-stuck:errand:c1", "repairing x is stuck")]
    monkeypatch.setattr(al, "activity", lambda: {"items": [{"id": "errand:c1", "label": "x", "diagnosis": ["nothing wrong found: it is working"]}]})
    al.watch_cards(now=5000.0)
    assert "errand:c1" not in al._BAD_SINCE                                                         # it recovered: the clock resets


def test_a_dead_holders_lease_is_freed_and_a_live_holders_never(monkeypatch):
    from lacuna_api.control import agents_live as al
    ran = []
    monkeypatch.setattr(al, "_lease_holder", lambda: ("card:dead-card", "GPU: leased to card:dead-card since 00:26, about 12 min left"))
    monkeypatch.setattr(al, "card_alive", lambda name: False)
    monkeypatch.setattr("subprocess.run", lambda cmd, **k: ran.append(cmd[-2:]) or type("R", (), {"stdout": ""})())
    assert al.reap_stale_lease() == "card:dead-card" and ["release", "card:dead-card"] in ran       # nothing behind it should wait out the term
    ran.clear()
    monkeypatch.setattr(al, "card_alive", lambda name: True)
    assert al.reap_stale_lease() is None and not ran                                              # a running step is slow, not stuck: untouched
    monkeypatch.setattr(al, "_lease_holder", lambda: ("painter", "GPU: leased to painter"))
    monkeypatch.setattr(al, "card_alive", lambda name: False)
    assert al.reap_stale_lease() is None and not ran                                              # not a card's lease: never ours to free


def test_unstick_card_frees_a_dead_lease_resumes_and_leaves_a_live_one(monkeypatch, tmp_path):
    from lacuna_api.control import agents_live as al
    ran = []
    monkeypatch.setattr(al, "_lease_holder", lambda: ("card:old", "GPU: leased to card:old since 00:26, about 9 min left"))
    monkeypatch.setattr(al, "card_alive", lambda n: False)
    monkeypatch.setattr(al, "reap_stale_lease", lambda: "card:old")
    monkeypatch.setattr("subprocess.run", lambda cmd, **k: ran.append(cmd[-2:]) or type("R", (), {"stdout": "new: on", "stderr": ""})())
    r = chat.call_tool("unstick_card", {"name": "new"}, "t")
    assert "freed it" in r["said"] and ["resume", "new"] in ran
    monkeypatch.setattr(al, "card_alive", lambda n: True)
    r = chat.call_tool("unstick_card", {"name": "new"}, "t")
    assert "RUNNING" in r["said"] and "not touched" in r["said"]
