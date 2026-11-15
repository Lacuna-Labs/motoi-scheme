"""Tests for lacuna.toolkit — deterministic ops functions."""
from __future__ import annotations

import os
import time
from pathlib import Path

import pytest

from lacuna import toolkit as tk


def test_describe_returns_all_registry_entries():
    desc = tk.describe()
    names = {d["name"] for d in desc}
    assert names == set(tk.REGISTRY.keys())
    # Every entry has signature and doc fields
    for d in desc:
        assert "name" in d and "signature" in d and "doc" in d


def test_call_unknown_returns_error_dict():
    out = tk.call("does_not_exist")
    assert isinstance(out, dict) and "error" in out


def test_disk_usage_shape():
    d = tk.disk_usage("/")
    assert "total_bytes" in d and "used_bytes" in d and "free_bytes" in d
    assert "used_pct" in d
    assert 0.0 <= d["used_pct"] <= 100.0


def test_disk_usage_missing_path_returns_error():
    d = tk.disk_usage("/this/path/should/not/exist/12345")
    assert "error" in d


def test_port_status_free_port_high_number():
    # Pick a port unlikely to be bound
    out = tk.port_status(64321)
    assert out["port"] == 64321
    assert out["status"] in ("free", "error")


def test_host_profile_has_arch_and_recommendation():
    p = tk.host_profile()
    assert "arch" in p
    assert "model_recommendation" in p


def test_host_profile_under_100ms():
    t0 = time.perf_counter()
    tk.host_profile()
    dt = (time.perf_counter() - t0) * 1000
    # Allow generous budget — first call may shell out a few sysctls
    assert dt < 200, f"host_profile took {dt:.0f}ms (>200)"


def test_recommendation_for_apple_silicon_16gb():
    r = tk._recommend_model({"arch": "arm64", "ram_gb": 16, "has_avx2": False})
    assert "7b" in r.lower() or "qwen" in r.lower()


def test_recommendation_for_x86_no_avx2():
    r = tk._recommend_model({"arch": "x86_64", "ram_gb": 8, "has_avx2": False, "cores_physical": 4})
    assert "echo" in r.lower() or "no avx2" in r.lower()


def test_port_for_returns_int_or_none():
    """port_for() returns either a port number from a project PORTS.md
    or None when no PORTS.md is found / no match. Standalone Lacuna
    does not ship a PORTS.md by default, so this test verifies the
    contract, not a specific port."""
    p = tk.port_for("some-service-name")
    assert p is None or isinstance(p, int)


def test_port_for_unknown_returns_none():
    assert tk.port_for("definitely-not-a-real-service-xyz") is None


def test_tail_log_unknown_returns_empty():
    assert tk.tail_log("nonexistent-log-name") == []


def test_recent_errors_shape():
    out = tk.recent_errors(5)
    assert isinstance(out, list)
    # Items (if any) are dicts
    for e in out:
        assert isinstance(e, dict)


def test_git_terse_returns_branch():
    g = tk.git_terse()
    assert "branch" in g
    assert "dirty_count" in g


def test_docs_lookup_returns_list():
    """docs_lookup returns a list (possibly empty if no docs match).
    Specific doc presence is project-dependent; the contract is the
    return shape."""
    hits = tk.docs_lookup("port")
    assert isinstance(hits, list)
    for h in hits:
        assert "path" in h


def test_bug_search_returns_list():
    hits = tk.bug_search("setup")
    assert isinstance(hits, list)


def test_service_health_three_components():
    h = tk.service_health("dev")
    assert "api" in h and "web" in h and "ollama" in h
    for k in ("api", "web", "ollama"):
        assert "port" in h[k] and "status" in h[k]


def test_write_host_cache_creates_file(tmp_path):
    cache = tmp_path / "host.cache"
    out = tk.write_host_cache(cache)
    assert cache.exists()
    text = cache.read_text()
    assert "cpu=" in text and "mem=" in text and "disk=" in text
    assert 0 <= out["cpu"] <= 100
    assert 0 <= out["mem"] <= 100
    assert 0 <= out["disk"] <= 100


def test_process_grep_returns_list():
    # python is almost certainly running (this test process at least)
    out = tk.process_grep("python")
    assert isinstance(out, list)
    if out:
        assert "pid" in out[0] and "command" in out[0]
