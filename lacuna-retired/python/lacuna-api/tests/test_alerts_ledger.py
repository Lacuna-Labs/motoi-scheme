"""The API's alerts are rows of the alerts ledger and never a notice (the owner's ruling 7, 2026-11-02, D13).

spec: LACUNA-1.0-FINALE.md §1 ruling 7; workers.raise_alert, resolve_alert · class: a notice sent where the ruling says none ·
technique: the ledger pointed at a scratch file, the notice recorded · method: the real workers module · sre: does any alert still
reach a phone, and does every alert land where the telemetry card reads it?
"""
import time

import pytest

from lacuna_api.control import workers


@pytest.fixture(autouse=True)
def no_hold(monkeypatch):
    """The ledger's state is the module's: each test starts with nothing held or written, and with no hold unless it sets one."""
    workers._held.clear()
    workers._written.clear()
    monkeypatch.setattr(workers, "FOR_S", 0)
    yield
    for h in list(workers._held.values()):
        h["timer"].cancel()
    workers._held.clear()
    workers._written.clear()


def test_an_alert_is_a_row_and_a_resolve_is_a_clear_and_nothing_notifies(tmp_path, monkeypatch):
    ledger = tmp_path / "alerts.slat"
    monkeypatch.setenv("LACUNA_ALERTS", str(ledger))
    monkeypatch.setattr(workers, "ALERTS_LEDGER", ledger)
    sent = []
    monkeypatch.setattr(workers, "_notify_now", lambda t, b: sent.append(t))
    workers.raise_alert("disk:low", "error", "the disk is 4 % free", "body", notify=True)
    workers.raise_alert("note:1", "info", "a note", "body")
    assert workers.resolve_alert("disk:low", "the disk is 12 % free") == 1
    rows = ledger.read_text().splitlines()
    assert len(rows) == 2 and "(level alert)" in rows[0] and '(key "disk:low")' in rows[0] and "(level clear)" in rows[1]
    assert sent == []


def test_a_scratch_home_writes_no_row_to_the_live_world(monkeypatch):
    monkeypatch.delenv("LACUNA_ALERTS", raising=False)
    assert workers._ledger("k", "error", "x") is None


def test_the_watchdog_sweeps_reports_are_rows_keyed_by_the_watchdog(tmp_path, monkeypatch):
    from lacuna_api.control import foreman
    ledger = tmp_path / "alerts.slat"
    monkeypatch.setenv("LACUNA_ALERTS", str(ledger))
    monkeypatch.setattr(workers, "ALERTS_LEDGER", ledger)
    row = [["row", "box.disk.free.01"], ["name", "box.disk.free.01"], ["mode", "red"], ["reading", "4.9 % free"]]
    assert foreman.watchdog_report({"kind": "warn", "data": [row]}) == "watchdog:box.disk.free.01"
    foreman.watchdog_report({"kind": "alert", "data": [row]})
    foreman.watchdog_report({"kind": "clear", "data": [{"row": "box.disk.free.01"}]})
    rows = ledger.read_text().splitlines()
    assert [("(level warn)" in r, "(level alert)" in r, "(level clear)" in r) for r in rows] == [(True, False, False), (False, True, False), (False, False, True)]
    assert all("(source watchdog)" in r and '(key "watchdog:box.disk.free.01")' in r for r in rows)



def test_a_raise_waits_its_hold_a_flap_writes_nothing_and_curators_dogs_are_curators(tmp_path, monkeypatch):
    """spec: E14 §5 row 19 (sre-09: 1,015 rows; a mock marketplace's warn and clear 31 s apart; every row `(product lacuna)`,
    Curator's `wd:*` and `mentat:*` among them) · class: a ledger that records flaps as alerts · technique: a hold of 0.3 s on a
    scratch ledger · method: a raise cleared inside its hold writes no row; one that holds is written once, stamped with when it
    began and its `(for …)`; a repeat writes nothing, a higher level at once, the clear once; Curator's keys are Curator's
    (red before: four rows for the flap and the repeats, every one lacuna) · sre: is every row on the ledger an episode worth a
    look, and the owner's product's?"""
    ledger = tmp_path / "alerts.slat"
    monkeypatch.setenv("LACUNA_ALERTS", str(ledger))
    monkeypatch.setattr(workers, "ALERTS_LEDGER", ledger)
    monkeypatch.setattr(workers, "FOR_S", 0.3)
    workers._ledger("wd:dev:watch.mock.etsy", "warn", "the mock shop does not answer")
    workers._ledger("wd:dev:watch.mock.etsy", "clear", "it answers")
    t0 = time.time()
    workers._ledger("disk:low", "warn", "the disk is 9 % free")
    workers._ledger("disk:low", "warn", "the disk is 8 % free")
    workers._ledger("mentat:reach", "warn", "the shop's API does not answer")
    time.sleep(0.6)
    rows = ledger.read_text().splitlines() if ledger.exists() else []
    assert len(rows) == 2, rows
    disk = next(r for r in rows if '"disk:low"' in r)
    assert "(product lacuna)" in disk and "(level warn) (for 0.3)" in disk and "the disk is 8 % free" in disk
    assert disk.startswith(f'(alert (at "{time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime(t0))}")')
    assert "(product curator)" in next(r for r in rows if '"mentat:reach"' in r)
    workers._ledger("disk:low", "warn", "again")
    workers._ledger("disk:low", "error", "the disk is 4 % free")
    workers._ledger("disk:low", "clear", "the disk is 12 % free")
    rows = ledger.read_text().splitlines()
    assert ["(level alert)" in r for r in rows[2:]] == [True, False] and "(level clear)" in rows[3] and len(rows) == 4
