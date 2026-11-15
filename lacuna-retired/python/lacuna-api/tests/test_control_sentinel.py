"""The sentinel: the first look is the baseline; a new network listener, launch item or remote login alerts ONCE, by
name; something accepted joins the baseline. It never acts on what it finds."""
import importlib


def test_new_things_alert_once_by_name(tmp_path, monkeypatch):
    monkeypatch.setenv("LACUNA_HOME", str(tmp_path))
    import lacuna_api.control.sentinel as s
    importlib.reload(s)
    box = {"listeners": {"1138/network": "Python"}, "agents": {"/a.plist": "x"}, "logins": {"alfred@console": "Oct 16"}}
    monkeypatch.setattr(s, "snapshot", lambda: {**{k: dict(v) for k, v in box.items()}, "at": 0})
    said = []
    alert = lambda key, level, title, body: said.append((key, level))  # noqa: E731
    assert s.check(alert) == [] and said == []                    # first look: the baseline
    box["listeners"]["4444/network"] = "nc"
    box["agents"]["/Users/x/Library/LaunchAgents/evil.plist"] = "/tmp/evil"
    box["logins"]["root@10.0.0.9"] = "Oct 18"
    s._last[0] = 0
    s.check(alert)
    assert ("sentinel:prog:nc/network", "error") in said and len(said) == 3
    s._last[0] = 0
    s.check(alert)
    assert len(said) == 3                                           # once, not every five minutes
    assert s.accept("port:4444/network")["ok"]
    assert "4444/network" in s._load()["listeners"]


def test_a_kernel_picked_loopback_port_is_not_news_but_a_network_one_is():
    # spec: the inbox pokes of 2026-10-27 (ports 55117, 49442: test servers) · class: W (noise) · sre: is this page actionable?
    from lacuna_api.control import sentinel
    base = {"listeners": {}, "agents": {}, "logins": {}}
    now = {"listeners": {"55117/local": "node", "8091/local": "lme", "55118/network": "node"}, "agents": {}, "logins": {}}
    ids = {f["id"] for f in sentinel.diff(base, now)}
    assert "port:55117/local" not in ids
    assert "port:8091/local" in ids and "port:55118/network" in ids


def test_one_program_on_many_ports_is_one_alert_by_its_whole_name_and_a_press_accepts_them_all(tmp_path, monkeypatch):
    # spec: video E2 (2026-10-31: "Antigravi is listening on :41214", ×3 → ×4 in seconds, "the fix is a terminal command")
    monkeypatch.setenv("LACUNA_HOME", str(tmp_path))
    import lacuna_api.control.sentinel as s
    importlib.reload(s)
    box = {"listeners": {"1138/local": "node"}, "agents": {}, "logins": {}}
    monkeypatch.setattr(s, "snapshot", lambda: {**{k: dict(v) for k, v in box.items()}, "at": 0})
    said = []
    alert = lambda key, level, title, body: said.append((key, level, body))  # noqa: E731
    s.check(alert)
    box["listeners"].update({"46409/local": "Antigravity", "46414/local": "Antigravity", "46415/local": "language_server"})
    s._last[0] = 0
    s.check(alert)
    assert sorted(k for k, _, _ in said) == ["sentinel:prog:Antigravity/local", "sentinel:prog:language_server/local"]
    body = dict((k, b) for k, _, b in said)["sentinel:prog:Antigravity/local"]
    assert body.startswith("Antigravity is listening on :46409, :46414 (local)") and "press" in body and "lacuna sentinel" not in body
    assert s.accept("prog:Antigravity/local") == {"ok": True, "accepted": "prog:Antigravity/local", "ports": 2}
    assert {"46409/local", "46414/local"} <= set(s._load()["listeners"])


def test_lsof_s_whole_name_is_read_with_its_spaces(monkeypatch):
    from lacuna_api.control import sentinel
    out = "COMMAND PID USER FD TYPE DEVICE SIZE/OFF NODE NAME\nDiscord\\x20Helper 75393 alfred 30u IPv4 0x1 0t0 TCP 127.0.0.1:6463 (LISTEN)\n"
    seen = []
    monkeypatch.setattr(sentinel, "_run", lambda args, timeout=20: seen.append(args) or out)
    assert sentinel.listeners() == {"6463/local": "Discord Helper"}
    assert seen[0][:3] == ["lsof", "+c", "0"]

