"""E6's desk reads: the security report (life + what is new) and the Caliper run key (a card; the target is the dev web
and never an argument). The DiRT targets are the door's (lacuna-node/test/drill-targets.test.mjs)."""
import importlib


def test_security_report_says_the_sentinels_life_and_what_is_new(tmp_path, monkeypatch):
    monkeypatch.setenv("LACUNA_HOME", str(tmp_path))
    import lacuna_api.control.sentinel as s
    importlib.reload(s)
    from lacuna_api.control import security_view
    importlib.reload(security_view)
    box = {"listeners": {"1138/network": "Python", "8091/local": "llama"}, "agents": {}, "logins": {}, "at": 0}
    monkeypatch.setattr(s, "snapshot", lambda: {k: (dict(v) if isinstance(v, dict) else v) for k, v in box.items()})
    assert security_view.report()["life"]["state"] == "not started"
    s.check(lambda *a: None)                                          # the first look is the baseline
    box["listeners"]["4444/network"] = "nc"
    r = security_view.report()
    assert r["life"]["state"] == "awake" and r["counts"]["network"] == 2 and r["counts"]["not_accepted"] == 1
    assert r["listeners"][0]["scope"] == "network"                    # the network ones first
    assert [x for x in r["listeners"] if x["port"] == "4444"][0]["known"] is False


def test_caliper_run_targets_the_dev_web_only(tmp_path, monkeypatch):
    from lacuna_api.control import caliper_run
    assert caliper_run.TARGET.startswith("http://127.0.0.1:3000")
    monkeypatch.setattr(caliper_run, "STATE", tmp_path / "s.json")
    monkeypatch.setattr(caliper_run, "CALIPER", tmp_path / "missing.js")
    assert caliper_run.start("passive", "owner")["ok"] is False      # not built: says so, starts nothing
    assert caliper_run.r_file({"mode": "loud"})["ok"] is False
    r = caliper_run.r_file({"mode": "passive", "dry": True})
    assert r["dry_run"] and "dev web" in r["if_approved"] and "never QA or production" in r["if_approved"]


def test_the_customers_server_is_never_one_tap_away(monkeypatch):
    from fastapi.testclient import TestClient

    from lacuna_api.app import app
    from lacuna_api.control import services
    called = []
    for k in ("start", "stop", "restart"):
        monkeypatch.setattr(services, k, lambda *a, **kw: called.append(a) or {"ok": True})
    c = TestClient(app, client=("127.0.0.1", 50000))
    for act in ("stop", "restart", "start"):
        r = c.post(f"/api/services/qa-api/{act}", json={"confirm": True})
        assert r.status_code == 403 and r.json()["detail"]["petition"] == f"qa-{act}"
    assert called == []                                   # nothing ran: the card is the only road


def test_promote_install_release_need_the_owner_key(monkeypatch):
    from fastapi.testclient import TestClient

    from lacuna_api.app import app
    from lacuna_api.control import deploys, owner
    ran = []
    monkeypatch.setattr(deploys, "promote", lambda *a, **k: ran.append("promote") or {"ok": True, "job": {}})
    monkeypatch.setattr(deploys, "deploy", lambda *a, **k: ran.append("deploy") or {"ok": True})
    monkeypatch.setattr(deploys, "release", lambda *a, **k: ran.append("release") or {"ok": True, "job": {"id": "x"}})
    c = TestClient(app, client=("127.0.0.1", 50000))
    assert c.post("/api/deploys/promote", json={"confirm": True}).status_code == 403
    assert c.post("/api/deploys/b1/install", json={"confirm": True}).status_code == 403
    assert c.post("/api/release", json={"confirm": True}).status_code == 403
    assert ran == []                                      # a bare confirm is no press
    import time
    t = int(time.time())
    r = c.post("/api/release", json={"confirm": True}, headers={"X-Lacuna-Owner": owner.sign(owner.key(), "release", True, t), "X-Lacuna-Owner-T": str(t)})
    assert r.status_code == 200 and ran == ["release"]    # the owner key's signature is the press
