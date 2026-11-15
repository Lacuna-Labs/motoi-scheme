"""THE BOOT REPORT says once what came back; a DRILL breaks only our side and times the return."""
import importlib
import json


def load(tmp_path, monkeypatch):
    monkeypatch.setenv("LACUNA_HOME", str(tmp_path))
    monkeypatch.setenv("LACUNA_NO_WORKERS", "1")
    import lacuna_api.control.core as core
    importlib.reload(core)
    import lacuna_api.control.services as services
    importlib.reload(services)
    import lacuna_api.control.boot as boot
    importlib.reload(boot)
    import lacuna_api.control.drill as drill
    importlib.reload(drill)
    return core, services, boot, drill


def test_the_boot_report_names_what_came_back_and_what_did_not(tmp_path, monkeypatch):
    core, services, boot, drill = load(tmp_path, monkeypatch)
    monkeypatch.setattr(boot, "WAIT_S", 1)
    monkeypatch.setattr(boot, "uptime_s", lambda: 120.0)                       # inside the reboot window
    monkeypatch.setattr(services, "answering", lambda n: n in ("dev-api", "vite", "tunnel", "speech-helper"))
    monkeypatch.setattr(services, "_launchd", lambda label: {"loaded": True})
    alerts = []
    boot._run(lambda key, level, title, body, notify=True: alerts.append((key, level, title, body)))
    rep = boot.report()
    assert rep["done"] and rep["kind"] == "reboot"
    assert set(rep["up"]) == {"dev-api", "vite", "tunnel", "speech-helper"} and rep["down"] == ["qa-api"]
    assert any(k == "boot:down" and "qa-api" in body for k, _, _, body in alerts)
    saved = json.loads((tmp_path / "boot.json").read_text())
    assert saved["down"] == ["qa-api"]
    acts = [json.loads(l)["action"] for l in (tmp_path / "audit.jsonl").read_text().splitlines()]
    assert "boot.report" in acts


def test_a_drill_never_touches_her_side_and_refuses_lacuna_itself(tmp_path, monkeypatch):
    core, services, boot, drill = load(tmp_path, monkeypatch)
    out = drill.drill("kill", "qa-api", "claude")
    assert "refused" in out and "never the customer's side" in out["refused"]
    acts = [json.loads(l)["action"] for l in (tmp_path / "audit.jsonl").read_text().splitlines()]
    assert "drill.refused" in acts
    assert drill.drill("kill", "lacuna", "claude")["ok"] is False
    assert drill.drill("nuke", "dev-api", "claude")["ok"] is False


def test_a_kill_drill_times_the_return_and_records_it(tmp_path, monkeypatch):
    core, services, boot, drill = load(tmp_path, monkeypatch)
    killed = []
    state = {"pid": 4242, "alive": True}
    monkeypatch.setattr(services, "_launchd", lambda label: {"loaded": True})
    monkeypatch.setattr(services, "_pid_on", lambda port: state["pid"])
    monkeypatch.setattr(services, "answering", lambda n: state["alive"])

    def fake_kill(pid, sig):
        killed.append((pid, sig)); state["alive"] = False; state["pid"] = 4343
        # launchd "restarts" it a moment later
        import threading
        threading.Timer(0.3, lambda: state.__setitem__("alive", True)).start()
    monkeypatch.setattr(drill.os, "kill", fake_kill)
    monkeypatch.setattr(drill, "_pid_alive", lambda pid: state["alive"])
    monkeypatch.setattr(services, "_listening", lambda port: state["alive"])
    monkeypatch.setattr(drill, "WAIT_S", 5)
    raised = []
    out = drill.drill("kill", "dev-api", "claude", alerts_fn=lambda: [], raise_alert=lambda *a, **k: raised.append(a))
    assert killed and killed[0][0] == 4242
    assert out["ok"] is True and out["back_s"] is not None and 0.3 <= out["back_s"] < 5 and out["down_after_s"] is not None
    assert out["launchd_restarted"] is True and out["new_pid"] == 4343
    rows = drill.history()
    assert rows and rows[0]["service"] == "dev-api" and rows[0]["ok"] is True
    assert raised and raised[0][1] == "info"


def test_agents_say_who_would_not_survive_a_reboot(tmp_path, monkeypatch):
    core, services, boot, drill = load(tmp_path, monkeypatch)
    import plistlib
    agents = tmp_path / "agents"; agents.mkdir()
    monkeypatch.setattr(services, "AGENTS", agents)
    (agents / "ai.lacunabs.x.plist").write_bytes(plistlib.dumps({"Label": "x", "RunAtLoad": False}))
    for name, s in services.SERVICES.items():
        (agents / f"{s['label']}.plist").write_bytes(plistlib.dumps({"Label": s["label"], "RunAtLoad": name != "vite", "KeepAlive": True}))
    monkeypatch.setattr(services, "_launchd", lambda label: {"loaded": True})
    ag = boot.agents()
    assert ag["dev-api"]["comes_back_after_reboot"] is True
    assert ag["vite"]["comes_back_after_reboot"] is False and ag["vite"]["run_at_load"] is False
