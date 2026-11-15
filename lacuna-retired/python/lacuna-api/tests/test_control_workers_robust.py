"""THE WATCHER SURVIVES ITS OWN DISK (L2, 2026-09-25).

Seen on this Mac: a full disk. `core.audit` raised ENOSPC from the except-handlers that call it, the raise escaped
`_loop`, and the watcher thread died exactly when it was needed. Now the watcher's audit never raises, a pass is
guarded as a whole, and an alert reaches the person BEFORE the disk is asked to record it.
"""
from __future__ import annotations

import threading

from lacuna_api.control import errors, workers


def _enospc(*a, **k):
    raise OSError(28, "No space left on device")


def test_a_pass_on_a_full_disk_does_not_raise(monkeypatch, lacuna_home):
    monkeypatch.setattr(errors, "ingest_once", _enospc)             # sqlite cannot write
    monkeypatch.setattr(workers, "_audit_raw", _enospc)             # nor can the audit log
    monkeypatch.setattr(workers, "sample", _enospc)
    monkeypatch.setattr(workers, "evaluate", _enospc)
    state = {"last_min": 0.0, "last_day": 0.0, "last_hour": 0.0, "last_model": 0.0}
    workers._pass(state)                                            # every section fails; nothing escapes
    assert state["last_min"] > 0                                    # and the pass still advanced its clocks


def test_the_loop_thread_outlives_a_full_disk(monkeypatch, lacuna_home):
    monkeypatch.setattr(errors, "ingest_once", _enospc)
    monkeypatch.setattr(workers, "_audit_raw", _enospc)
    monkeypatch.setattr(workers, "sample", lambda: None)
    monkeypatch.setattr(workers, "evaluate", lambda: None)
    passes = []
    def counted(state):
        # the pass itself now does real work (queue, leases, foreman reads) that can block for seconds under a busy suite; what this test
        # proves is the LOOP: a pass that raises ENOSPC, with the audit write failing too, must not end the thread
        passes.append(1)
        if len(passes) >= 3:
            raise SystemExit                                        # the only way out of a while-True in a test
        raise OSError(28, "No space left on device")
    monkeypatch.setattr(workers, "_pass", counted)
    monkeypatch.setattr(workers.time, "sleep", lambda s: None)
    died = []
    t = threading.Thread(target=workers._loop, daemon=True)
    orig = threading.excepthook
    threading.excepthook = lambda a: died.append(a.exc_type.__name__)
    try:
        t.start(); t.join(30)       # the first pass now does real work (queue, workshop heal); 3 s was its budget before
    finally:
        threading.excepthook = orig
    assert len(passes) == 3, (passes, died)                                 # it kept going after the first failing pass
    assert died == ["SystemExit"]                                   # and left only when the test told it to


def test_an_alert_lands_in_memory_when_the_disk_is_full_and_notifies_no_one(monkeypatch, lacuna_home):
    """A full disk is the alert that must land: it is kept in memory before the disk is asked. Since the owner's ruling 7
    (2026-11-02, LACUNA-1.0-FINALE.md §1) no alert is heard: it notifies no one, even when its caller asks."""
    order = []
    monkeypatch.setattr(workers, "_notify", lambda title, body: order.append("notify"))
    def audit_then_fail(*a, **k):
        order.append("audit"); raise OSError(28, "No space left on device")
    monkeypatch.setattr(workers, "_audit_raw", audit_then_fail)
    workers.raise_alert("disk:low", "error", "disk is full", "0 bytes free", notify=True)
    assert order == ["audit"]
    assert workers.alerts()[0]["key"] == "disk:low"


def test_the_sentinel_brings_a_dead_worker_back_and_says_so(monkeypatch, lacuna_home):
    """Phase 13 (2026-09-25): a dead watcher used to come back only when a request arrived."""
    said = []
    monkeypatch.setattr(workers, "raise_alert", lambda key, level, title, body="", notify=True: said.append(key))
    monkeypatch.setattr(workers, "_audit_raw", lambda *a, **k: None)
    monkeypatch.setattr(workers, "_loop", lambda: None)             # a worker that ends at once = "dead"
    monkeypatch.setattr(workers, "_thread", None)
    ticks = {"n": 0}
    def sleep(s):
        ticks["n"] += 1
        if ticks["n"] > 1:
            raise SystemExit
    monkeypatch.setattr(workers.time, "sleep", sleep)
    t = threading.Thread(target=workers._sentinel_loop, daemon=True)
    orig = threading.excepthook; threading.excepthook = lambda a: None
    try:
        t.start(); t.join(30)       # the first pass now does real work (queue, workshop heal); 3 s was its budget before
    finally:
        threading.excepthook = orig
    assert said == ["watcher:restarted"]
    assert workers._thread is not None


def test_an_imessage_address_is_put_in_the_form_messages_wants():
    from lacuna_api.control.workers import _e164
    assert _e164("917-721-5826") == "+19177215826"
    assert _e164("9177215826") == "+19177215826"
    assert _e164("19177215826") == "+19177215826"
    assert _e164("+19177215826") == "+19177215826"
    assert _e164("alfred@example.com") == "alfred@example.com"
    assert _e164("") == ""
