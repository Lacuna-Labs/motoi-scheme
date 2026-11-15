"""HEALTHY MEANS ANSWERED, CORRECTLY (L6, 2026-09-25).

"Up" used to be a TCP accept (a wedged uvicorn still accepts in the kernel) and `_http_ok` took any 200–499, so a
half-mounted app answering 404 on /healthz passed. Now the health route must answer 200, and say status ok when it
speaks JSON; the watcher says DOWN after two misses, back after one hit.
"""
from __future__ import annotations

import http.server
import json
import socket
import threading

import pytest

from lacuna_api.control import services, workers


class _H(http.server.BaseHTTPRequestHandler):
    answer = (200, b'{"status":"ok"}')

    def do_GET(self):
        code, body = self.answer
        self.send_response(code); self.send_header("Content-Type", "application/json"); self.end_headers()
        self.wfile.write(body)

    def log_message(self, *a):
        pass


@pytest.fixture
def server():
    srv = http.server.HTTPServer(("127.0.0.1", 0), _H)
    t = threading.Thread(target=srv.serve_forever, daemon=True); t.start()
    yield srv
    srv.shutdown()


def test_http_ok_reads_the_answer(server):
    url = f"http://127.0.0.1:{server.server_port}/healthz"
    _H.answer = (200, b'{"status":"ok"}');       assert services._http_ok(url) is True
    _H.answer = (200, b'{"status":"degraded"}'); assert services._http_ok(url) is False
    _H.answer = (200, b'plain text');            assert services._http_ok(url) is True
    _H.answer = (404, b'{"detail":"Not Found"}'); assert services._http_ok(url) is False
    _H.answer = (503, b'');                      assert services._http_ok(url) is False
    assert services._http_ok(None) is None


def test_listening_is_not_answering(monkeypatch):
    s = socket.socket(); s.bind(("127.0.0.1", 0)); s.listen(8)          # accepts in the kernel, never answers
    port = s.getsockname()[1]
    monkeypatch.setitem(services.SERVICES, "wedged", {"port": port, "health": f"http://127.0.0.1:{port}/healthz", "title": "Wedged"})
    try:
        assert services._listening(port) is True
        assert services.answering("wedged") is False
    finally:
        s.close()


def test_down_is_said_after_two_misses_and_back_after_one_hit(monkeypatch, lacuna_home, tmp_path):
    said = []
    monkeypatch.setattr(workers, "_SAID", tmp_path / "alert-state.json"); monkeypatch.setattr(workers, "_saved", "")
    workers._state.clear()
    monkeypatch.setattr(workers, "raise_alert", lambda key, level, title, body="", notify=True: said.append((key, level)))
    monkeypatch.setattr(workers, "WATCHED_SERVICES", ("dev-api",))
    up = {"v": True}
    monkeypatch.setattr(services, "answering", lambda name: up["v"])
    workers._eval_services(); assert said == []
    up["v"] = False
    workers._eval_services(); assert said == []                          # one miss: a restart, not an outage
    workers._eval_services(); assert said == [("svc:dev-api", "error")]  # two: DOWN
    workers._eval_services(); assert len(said) == 1                      # said once
    up["v"] = True
    workers._eval_services(); assert said[-1] == ("svc:dev-api", "info") # one hit: back
