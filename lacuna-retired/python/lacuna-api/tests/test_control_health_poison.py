"""The watchdogs reader survives a poison line.

On 2026-09-25 the chaos test appended a bare `123` to the dev telemetry
stream. `json.loads` happily returned an int, the reader called `.get` on
it, and the watchdogs check was blind for hours — the alert said so, and
nothing else did. A line that parses but is not an object is skipped
like a line that does not parse.
"""

from __future__ import annotations

import json
import time

from lacuna_api.control import health


def test_a_bare_number_line_does_not_blind_the_watchdogs(tmp_path, monkeypatch):
    home = tmp_path / "curator-dev"
    (home / "telemetry").mkdir(parents=True)
    monkeypatch.setitem(health.ENVS, "dev", {**health.ENVS["dev"], "home": home})
    good = {
        "t": time.time(),
        "where": "api",
        "from": "watch.disk",
        "action": "state",
        "level": "info",
        "summary": "healthy",
    }
    lines = ["123", '"a string"', "[1, 2]", "not json at all", json.dumps(good)]
    (home / "telemetry" / "stream.jsonl").write_text(
        "header\n" + "\n".join(lines) + "\n", encoding="utf-8"
    )
    rows = health.watchdogs("dev")
    assert [r["name"] for r in rows] == ["watch.disk"]
    assert rows[0]["summary"] == "healthy"
