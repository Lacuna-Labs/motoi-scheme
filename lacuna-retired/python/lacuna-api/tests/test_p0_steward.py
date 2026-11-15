"""S3: the steward reaches the API through the broker; the broker allows three more doors; the runner parks 12 busy runs."""
import importlib.util
import json
import os
import socket
import sys
import threading
import time

JAIL = os.path.expanduser("~/code/lacuna/lacuna-box/jail")
FORGE = os.path.expanduser("~/lacuna-world/forge")


def _load(name, path, extra):
    for p in extra:
        if p not in sys.path:
            sys.path.insert(0, p)
    spec = importlib.util.spec_from_file_location(name, path)
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


def test_broker_allows_three_and_refuses_the_rest():
    b = _load("broker_s3", f"{JAIL}/broker.py", [JAIL])
    assert b.hands_allowed("GET", "/api/forge/pantheon")
    assert b.hands_allowed("GET", "/api/automations")
    assert b.hands_allowed("POST", "/api/forge/pantheon/sentry/propose")
    assert not b.hands_allowed("POST", "/api/forge/pantheon/sentry/release")
    assert not b.hands_allowed("POST", "/api/forge/pantheon/../x/propose")
    assert not b.hands_allowed("DELETE", "/api/automations")
    assert not b.hands_allowed("POST", "/api/chat/say")
    assert not b.hands_allowed("POST", "/api/petitions/abc/decide")


def test_runner_parks_after_12_consecutive_75s(tmp_path, monkeypatch):
    j = _load("jobrunner_s3", f"{JAIL}/jobrunner.py", [JAIL])
    assert j.MAX_TEMPFAILS == 12
    finished = []
    monkeypatch.setattr(j, "finish", lambda d, job, rs, words, state="done": finished.append((state, words)))
    monkeypatch.setattr(j, "turns", type("T", (), {"done": staticmethod(lambda job: None)}))
    monkeypatch.setattr(j, "journal", lambda *a, **k: None)
    monkeypatch.setattr(j, "boot_time", lambda: "b")
    monkeypatch.setattr(j, "alive", lambda pid: False)
    monkeypatch.setattr(j, "start", lambda *a, **k: None)
    monkeypatch.setattr(j, "expired", lambda *a, **k: None)
    (tmp_path / ".exit").write_text("75\n")
    rs = {}
    for i in range(12):
        rs.update(pid=99, boot="b", started=time.time())
        j.tick_work(str(tmp_path), {"every": "1h"}, rs)
        assert (len(finished) == 0) == (i < 11)
    assert finished[0][0] == "failed" and rs["tempfails"] == 12
    # a non-75 exit resets the count
    rs.update(pid=99, boot="b", tempfails=5)
    (tmp_path / ".exit").write_text("0\n")
    j.tick_work(str(tmp_path), {"every": "1h"}, rs)
    assert rs["tempfails"] == 0


def test_steward_goes_through_the_socket(tmp_path, monkeypatch):
    st = _load("steward_s3", f"{FORGE}/steward.py", [FORGE])
    import tempfile
    sock = os.path.join(tempfile.mkdtemp(dir="/tmp"), "b.sock")
    seen = []
    srv = socket.socket(socket.AF_UNIX, socket.SOCK_STREAM)
    srv.bind(sock)
    srv.listen(1)

    def serve():
        c, _ = srv.accept()
        data = b""
        while chunk := c.recv(4096):
            data += chunk
        seen.append(data)
        c.sendall(b'{"minds": []}\n')
        c.close()

    t = threading.Thread(target=serve)
    t.start()
    monkeypatch.setattr(st, "SOCK", sock)
    assert st._get("/api/forge/pantheon") == {"minds": []}
    t.join()
    srv.close()
    assert seen[0].startswith(b"hands GET /api/forge/pantheon 0\n")
    assert not hasattr(st, "API")
