"""The desk's read-only routes (control/desk_reads.py): every one answers JSON from a tmp LACUNA_HOME and never raises."""
from __future__ import annotations

import pytest

from lacuna_api.control import desk_reads as dr


@pytest.fixture
def logs(lacuna_home):
    d = lacuna_home / "logs"
    d.mkdir(exist_ok=True)
    return d


# ── per-model logs ──

def test_minds_logs_lists_minds_and_roles(logs):
    (logs / "mind-gemma3-270m.log").write_text("a\nb\n")
    (logs / "brain-gateway.log").write_text("g\n")
    (logs / "ollama.log").write_text("o\n")
    (logs / "qa-api.log").write_text("never listed\n")
    rows = {r["name"]: r for r in dr.minds_logs()["logs"]}
    assert set(rows) == {"mind-gemma3-270m.log", "brain-gateway.log", "ollama.log"}
    assert rows["mind-gemma3-270m.log"]["model"] == "gemma3-270m" and rows["mind-gemma3-270m.log"]["bytes"] == 4
    assert rows["brain-gateway.log"]["model"] == "gateway" and rows["ollama.log"]["model"] == "ollama"
    assert isinstance(rows["ollama.log"]["mtime"], float)


def test_minds_logs_empty_without_a_logs_dir(lacuna_home):
    assert dr.minds_logs() == {"logs": []}


def test_minds_log_tail_is_the_last_n_lines_cut_to_400(logs):
    big = "".join(f"line {i}\n" for i in range(50_000)) + ("x" * 1000) + "\n"
    (logs / "brain.log").write_text(big)
    out = dr.minds_log("brain.log", 5)
    assert out["name"] == "brain.log" and len(out["lines"]) == 5
    assert out["lines"][:4] == ["line 49996", "line 49997", "line 49998", "line 49999"]
    assert out["lines"][-1] == "x" * 400


def test_minds_log_refuses_anything_not_listed(logs):
    (logs / "mind-a.log").write_text("ok\n")
    (logs / "qa-api.log").write_text("secret\n")
    for bad in ("qa-api.log", "../sentinel-baseline.json", "/etc/passwd", "mind-a.log/../qa-api.log", "nope.log"):
        out = dr.minds_log(bad)
        assert out["ok"] is False and out["lines"] == []


def test_minds_log_routes(app_client, logs):
    (logs / "mind-m.log").write_text("one\ntwo\nthree\n")
    assert app_client.get("/api/minds/logs").json()["logs"][0]["name"] == "mind-m.log"
    assert app_client.get("/api/minds/logs/mind-m.log?n=2").json() == {"name": "mind-m.log", "lines": ["two", "three"]}
    assert app_client.get("/api/minds/logs/..%2Fsentinel-baseline.json").json().get("ok") is not True
    assert app_client.get("/api/minds/logs/qa-api.log").json()["ok"] is False


# ── Caliper ──

def test_caliper_route(app_client, monkeypatch):
    from lacuna_api.control import caliper
    monkeypatch.setattr(caliper, "summary", lambda: {"reports": [], "acts": [], "scenarios": []})
    assert app_client.get("/api/caliper").json() == {"reports": [], "acts": [], "scenarios": []}
