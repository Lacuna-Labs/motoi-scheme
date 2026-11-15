"""Error intelligence: one class per kind of error, whatever ids and numbers it carries; the three early warnings."""
import json
import time

import pytest


@pytest.fixture
def E(tmp_path, monkeypatch):
    monkeypatch.setenv("LACUNA_HOME", str(tmp_path))
    import importlib
    import lacuna_api.control.core as core
    importlib.reload(core)
    import lacuna_api.control.errors as errors
    importlib.reload(errors)
    return errors


def line(t, level, frm, action, summary, where="api"):
    return json.dumps({"t": t, "where": where, "from": frm, "action": action, "level": level, "summary": summary})


def test_ids_and_numbers_do_not_split_a_class(E):
    a, _ = E.fingerprint("qa", "api", "stores.ebay", "publish", "error", "listing 0394cad8-4a02-413e-a313-bbdf433fd13a refused (status 409) after 1532 ms")
    b, _ = E.fingerprint("qa", "api", "stores.ebay", "publish", "error", "listing 11111111-2222-3333-4444-555555555555 refused (status 500) after 12 ms")
    assert a == b
    c, _ = E.fingerprint("dev", "api", "stores.ebay", "publish", "error", "listing x refused")
    assert c != a                                      # dev and QA are different places


def test_thirty_thousand_of_one_kind_is_one_class_with_a_count(E):
    now = time.time()
    E.ingest_lines("qa", "stream", [line(now - i, "error", "stores.ebay", "publish", f"listing {i} refused after {i} ms") for i in range(300)])
    rows = E.classes(env="qa")
    assert len(rows) == 1 and rows[0]["count"] == 300 and rows[0]["category"] == "shops"


def test_new_rising_returned(E):
    now = time.time()
    E.ingest_lines("dev", "stream", [line(now - 60, "warn", "app.memory", "pressure", "iOS reported memory pressure", where="pod")])
    E.ingest_lines("dev", "stream", [line(now - 20 * 3600 + i, "error", "watch.camera", "degraded", "the camera went away") for i in range(2)]
                   + [line(now - 100 - i, "error", "watch.camera", "degraded", "the camera went away") for i in range(12)])
    E.ingest_lines("dev", "stream", [line(now - 10 * 3600, "error", "cortex.door", "failed", "embed failed"),
                                     line(now - 30, "error", "cortex.door", "failed", "embed failed")])
    sig = {r["subsystem"]: r["signal"] for r in E.classes(env="dev")}
    assert sig["app.memory"] == "new"
    assert sig["watch.camera"] == "rising"
    assert sig["cortex.door"] == "returned"


def test_info_lines_are_not_classes_but_route_timings_are_kept(E):
    now = time.time()
    E.ingest_lines("qa", "stream", [json.dumps({"t": now, "where": "api", "from": "api.routes.stores", "action": "route", "level": "info",
                                                "summary": "GET x -> 200", "fields": {"ms": 12, "status": 200}})])
    assert E.classes(env="qa") == []
    assert E.series_routes(env="qa")[0]["n"] == 1


def test_device_files_are_read_by_the_utc_day(tmp_path, monkeypatch):
    """The API writes telemetry/<device>/<UTC day>.jsonl; after 8 PM Eastern that is tomorrow's date locally."""
    import time
    from lacuna_api.control import errors
    home = tmp_path / "h"
    now = time.gmtime()
    monkeypatch.setattr(errors.time, "gmtime", lambda *a: now)
    utc_day = time.strftime("%Y-%m-%d", now)
    f = home / "telemetry" / "ipad" / f"{utc_day}.jsonl"
    f.parent.mkdir(parents=True)
    f.write_text("")
    monkeypatch.setitem(errors.ENVS, "dev", {"port": 1, "home": home, "label": "t"})
    monkeypatch.setitem(errors.ENVS, "qa", {"port": 2, "home": tmp_path / "none", "label": "t"})
    assert any(p == f for _, _, p in errors.sources())
