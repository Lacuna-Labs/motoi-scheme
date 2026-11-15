"""The work queue (2026-10-19, "we just never made a work queue"): SLAT records in order; on/off; one item at a time;
a cart item ends by its run and its review; a goal becomes a card; start/stop/pause/up/down/drop; nothing starts while off."""
import time

import pytest


@pytest.fixture
def wq(tmp_path, monkeypatch):
    monkeypatch.setenv("LACUNA_NO_WORKERS", "1")
    from lacuna_api.control import carts, task_runner, work_order, workqueue
    monkeypatch.setattr(workqueue, "WORK", tmp_path / "work")
    monkeypatch.setattr(workqueue, "QUEUE", tmp_path / "work" / "QUEUE.slat")
    monkeypatch.setattr(workqueue, "JOBS", tmp_path / "jobs")
    monkeypatch.setattr(task_runner, "RUNS", tmp_path / "runs")
    workqueue._review_busy.clear()                     # module state another test can leave behind
    (tmp_path / "carts").mkdir()
    monkeypatch.setattr(workqueue.Path, "home", classmethod(lambda cls: tmp_path))   # carts/<ref>.sks under the fake home
    (tmp_path / "lacuna-world" / "carts").mkdir(parents=True)
    for c in ("doc-drift", "form-probe"):
        (tmp_path / "lacuna-world" / "carts" / f"{c}.sks").write_text("(lacuna-cart 'x)")
    orders = {"on": None}
    monkeypatch.setattr(work_order, "current", lambda: orders["on"])
    monkeypatch.setattr(work_order, "start", lambda h, by: orders.update(on={"by": by}) or {"ok": True})
    monkeypatch.setattr(work_order, "end", lambda by: orders.update(on=None) or {"ok": True})
    started = []
    monkeypatch.setattr(carts, "start_named", lambda name, who, dry=False, why="": started.append(name) or {"ok": True, "petition": "p1", "state": "answered by the owner's work order"})
    monkeypatch.setattr(workqueue.threading, "Thread", lambda target, args=(), name=None, daemon=None: type("T", (), {"start": lambda self: target(*args)})())
    return workqueue, started, orders, task_runner


def test_nothing_starts_while_the_queue_is_off(wq):
    w, started, orders, tr = wq
    w.add("dead doc paths", "owner", kind="cart", ref="doc-drift")
    w.tick()
    assert started == [] and "OFF" in w.standing()["said"]


def test_on_stands_a_work_order_and_runs_one_item_at_a_time_in_order(wq):
    w, started, orders, tr = wq
    w.add("one", "owner", kind="cart", ref="doc-drift")
    w.add("two", "owner", kind="cart", ref="form-probe")
    w.switch(True, "owner")
    w.tick(); w.tick()
    assert orders["on"] == {"by": "owner"} and started == ["doc-drift"]
    q = w.load()
    assert [i["state"] for i in q["items"]] == ["running", "queued"]
    assert "(item :id \"W1\"" in w.QUEUE.read_text()            # SLAT on disk, one form a line


def test_a_cart_item_ends_by_its_run_then_its_review_then_the_next_starts(wq, monkeypatch):
    w, started, orders, tr = wq
    w.add("one", "owner", kind="cart", ref="doc-drift"); w.add("two", "owner", kind="cart", ref="form-probe")
    w.switch(True, "owner")
    monkeypatch.setattr(w, "_artifact_after", lambda it: {"id": "w-1", "outcome": {"is": "done", "reason": "15 missing"}})

    def review(tid, t, s):
        tr._log(tid, {"type": "answer", "text": "15 dead paths, 8 real\nDONE: listed", "ok": True})
    monkeypatch.setattr(tr, "_review", review)
    w.tick()                                    # started W1 → (follow) → reviewing → review runs → done
    w.tick(); w.tick()
    items = {i["id"]: i for i in w.load()["items"]}
    assert items["W1"]["state"] == "done" and "DONE" in items["W1"]["review"]
    assert started == ["doc-drift", "form-probe"]


def test_hands_reorder_pause_stop_and_drop(wq):
    w, started, orders, tr = wq
    for n in ("a", "b", "c"):
        w.add(n, "owner", kind="cart", ref="doc-drift")
    w.hand("W3", "up", "owner")
    assert [i["id"] for i in w.load()["items"]] == ["W1", "W3", "W2"]
    w.hand("W2", "start", "owner")
    assert w.load()["items"][0]["id"] == "W2"
    w.hand("W1", "pause", "owner"); w.hand("W3", "stop", "owner"); w.hand("W2", "drop", "owner")
    st = {i["id"]: i["state"] for i in w.load()["items"]}
    assert st == {"W1": "paused", "W3": "stopped"}


def test_a_goal_becomes_a_card_and_ends_when_its_card_is_done(wq, monkeypatch):
    w, started, orders, tr = wq
    calls = []
    monkeypatch.setattr(w, "_draft_card", lambda it: {"ok": True, "name": "note-w1", "plan": {"plan": ["a", "b"]}, "said": "written"})
    monkeypatch.setattr(w, "_card_state", lambda name, state: calls.append((name, state)))
    w.add("write a note on the box", "owner")
    w.switch(True, "owner")
    w.tick()
    it = w.load()["items"][0]
    assert it["state"] == "running" and it["ref"] == "note-w1" and calls == [("note-w1", "on")]
    (w.JOBS / "note-w1").mkdir(parents=True)
    (w.JOBS / "note-w1" / "job.json").write_text('{"state": "done"}')
    w.tick()
    assert w.load()["items"][0]["state"] == "done"


def test_an_item_past_its_limit_is_stopped_and_the_queue_moves_on(wq, monkeypatch):
    w, started, orders, tr = wq
    w.add("one", "owner", kind="cart", ref="doc-drift"); w.add("two", "owner", kind="cart", ref="form-probe")
    w.switch(True, "owner")
    monkeypatch.setattr(w, "_artifact_after", lambda it: None)
    monkeypatch.setattr(w, "_stop_running", lambda it, by: None)
    w.tick(now=time.time() + w.RUN_LIMIT_S + 60)
    w.tick()
    st = [i["state"] for i in w.load()["items"]]
    assert st[0] == "stopped" and "ran past" in w.load()["items"][0]["note"] and started == ["doc-drift", "form-probe"]


def test_the_work_order_answers_a_card_without_throwing(tmp_path, monkeypatch):
    """covers() threw on its own audit line (action= is audit's argument), so the order never answered one card."""
    import json as _j
    import time as _t
    from lacuna_api.control import work_order
    monkeypatch.setattr(work_order, "FILE", tmp_path / "work-order.json")
    work_order.FILE.write_text(_j.dumps({"until": _t.time() + 3600, "by": "owner", "answered": []}))
    ans = work_order.covers({"id": "p1", "action": "spawn-cart", "args": {"header": {"acts": []}}, "reason": "W1"})
    assert ans and ans["approve"] is True
    assert work_order.covers({"id": "p2", "action": "spawn-cart", "args": {"header": {"acts": ["promote-build"]}}}) is None


def test_a_start_that_throws_fails_the_item_and_says_why(wq, monkeypatch):
    w, started, orders, tr = wq
    from lacuna_api.control import carts
    monkeypatch.setattr(carts, "start_named", lambda *a, **k: (_ for _ in ()).throw(TypeError("boom")))
    w.add("one", "owner", kind="cart", ref="doc-drift")
    w.switch(True, "owner")
    it = w.load()["items"][0]
    assert it["state"] == "failed" and "boom" in it["note"]


def test_the_queue_lock_is_held_on_disk_and_a_dead_holders_is_taken(wq):
    """The door (work-queue.mjs) writes QUEUE.slat too: every save here holds QUEUE.slat.lock; a lock older than 60 s is a dead
    holder's and is taken; a live one blocks (class: R, a lost update between two writers)."""
    import os
    w, started, orders, tr = wq
    lock = w.QUEUE.parent / "QUEUE.slat.lock"
    with w._lock:
        assert lock.is_dir()
        with w._lock:                                    # reentrant within the process
            assert lock.is_dir()
        assert lock.is_dir()
    assert not lock.exists()
    lock.mkdir(parents=True)
    os.utime(lock, (time.time() - 120, time.time() - 120))
    w.add("one", "owner", kind="cart", ref="doc-drift")
    assert not lock.exists() and w.load()["items"][0]["id"] == "W1"


# spec: P-2026-11-01-tests-wrote-the-live-queue · class: M (a test writes outside its scratch) · technique: the paths read
# under a test's environment and under none · method: workqueue's and work_order's places resolved at the call, never at
# import · sre: can a press decided in a test tick or save the live ~/lacuna-world/work/QUEUE.slat, or start the live order?
def test_the_queue_and_the_work_order_follow_the_world_and_home_of_the_moment(tmp_path, monkeypatch):
    from lacuna_api.control import work_order, workqueue
    monkeypatch.setenv("LACUNA_WORLD", str(tmp_path / "w1"))
    monkeypatch.setenv("LACUNA_HOME", str(tmp_path / "h1"))
    assert workqueue._queue() == tmp_path / "w1" / "work" / "QUEUE.slat" and workqueue._jobs() == tmp_path / "w1" / "jobs"
    assert work_order._file() == tmp_path / "h1" / "work-order.json"
    monkeypatch.setenv("LACUNA_WORLD", str(tmp_path / "w2"))               # a thread that outlives its test reads the next one's
    assert workqueue._queue() == tmp_path / "w2" / "work" / "QUEUE.slat"
    monkeypatch.delenv("LACUNA_WORLD")
    monkeypatch.setattr(workqueue.Path, "home", classmethod(lambda cls: tmp_path / "home"))
    assert workqueue._queue() == tmp_path / "home" / "lacuna-world" / "work" / "QUEUE.slat"   # the live default, read at the call
