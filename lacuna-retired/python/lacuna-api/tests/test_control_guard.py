"""THE DOOR keeps a page from elsewhere out (L1/L18, 2026-09-25).

A page open in his browser is a loopback client too. Before this, `new WebSocket("ws://127.0.0.1:1138/ws/terminal")`
from any site got a login zsh, and a cross-site simple POST (no preflight) could ack alerts and stop services.
Now any request or socket that names a foreign Origin is refused; the console's own origin and tools that send
no Origin (curl, the CLI) are admitted.
"""
from __future__ import annotations

import pytest
from fastapi import FastAPI, WebSocket
from starlette.testclient import TestClient

from lacuna_api.control.guard import Door, origin_ok, ws_allowed


def _app():
    app = FastAPI()
    app.add_middleware(Door)
    hits = []

    @app.post("/api/services/dev-api/stop")
    def stop():
        hits.append("stop")
        return {"ok": True}

    @app.get("/api/self")
    def me():
        return {"ok": True}

    @app.websocket("/ws/terminal")
    async def term(ws: WebSocket):
        if not ws_allowed(ws):
            await ws.close(code=4403)
            return
        await ws.accept()
        await ws.send_text("shell")
        await ws.close()

    app.state.hits = hits
    return app


@pytest.mark.parametrize("origin, ok", [
    (None, True),                              # a tool, not a page
    ("http://127.0.0.1:1138", True),           # the console
    ("http://localhost:1138", True),
    ("http://[::1]:1138", True),
    ("https://evil.example", False),
    ("http://127.0.0.1.evil.example", False),  # a look-alike host
    ("http://127.0.0.1:3000", False),         # vite on this Mac is another site (L6)
    ("http://localhost:4174", False),
    ("http://localhost", False),               # no port is not the console either
    ("null", False),                           # a sandboxed or file: page
])
def test_origin_ok(origin, ok):
    assert origin_ok(origin) is ok


def test_a_cross_site_post_is_refused_and_does_nothing(lacuna_home):
    app = _app()
    c = TestClient(app, client=("127.0.0.1", 5555))
    r = c.post("/api/services/dev-api/stop", headers={"Origin": "https://evil.example", "Content-Type": "text/plain"})
    assert r.status_code == 403
    assert app.state.hits == []
    # the console itself, and a tool with no Origin, still act
    assert c.post("/api/services/dev-api/stop", headers={"Origin": "http://127.0.0.1:1138"}).status_code == 200
    assert c.post("/api/services/dev-api/stop").status_code == 200
    assert app.state.hits == ["stop", "stop"]


def test_a_foreign_page_gets_no_terminal(lacuna_home):
    app = _app()
    c = TestClient(app, client=("127.0.0.1", 5555))
    from starlette.websockets import WebSocketDisconnect
    with pytest.raises(WebSocketDisconnect):
        with c.websocket_connect("/ws/terminal", headers={"Origin": "https://evil.example"}) as ws:
            ws.receive_text()
    with c.websocket_connect("/ws/terminal", headers={"Origin": "http://127.0.0.1:1138"}) as ws:
        assert ws.receive_text() == "shell"


def test_a_foreign_page_cannot_even_read(lacuna_home):
    c = TestClient(_app(), client=("127.0.0.1", 5555))
    assert c.get("/api/self", headers={"Origin": "https://evil.example"}).status_code == 403
    assert c.get("/api/self").status_code == 200


def test_the_real_terminal_route_refuses_a_foreign_page(app_client):
    """The route checked loopback itself and never asked the origin rule: a page from anywhere got a zsh (found
    live after the guard's fix, 2026-09-25)."""
    from starlette.websockets import WebSocketDisconnect
    with pytest.raises(WebSocketDisconnect):
        with app_client.websocket_connect("/ws/terminal", headers={"Origin": "https://evil.example"}) as ws:
            ws.receive()


def test_through_the_door_the_consoles_own_lan_name_is_its_own_origin():
    """his phone reaches the console as mac-studio.local:1138; the page it gets names that as its origin (2026-09-25)"""
    from lacuna_api.control import guard
    assert guard.origin_ok("http://mac-studio.local:1138", "mac-studio.local:1138") is True
    assert guard.origin_ok("http://mac-studio.local:1138", "mac-studio.local") is True
    assert guard.origin_ok("http://mac-studio.local:1138", "other-mac.local:1138") is False      # not the host it was reached as
    assert guard.origin_ok("http://mac-studio.local:3000", "mac-studio.local:1138") is False     # another site on the same Mac
    assert guard.origin_ok("http://evil.example:1138", "mac-studio.local:1138") is False
    assert guard.origin_ok("http://127.0.0.1:1138", "mac-studio.local:1138") is True             # loopback is always its own


def test_a_token_with_a_curly_quote_is_refused_not_a_crash():
    """his phone sent the token wrapped in a pasted curly quote; compare_digest on str raised (2026-09-26)"""
    from lacuna_api.control import guard
    assert guard.token_ok("abc123", "abc123") is True
    assert guard.token_ok("“abc123”", "abc123") is True          # the pasted quotes are trimmed
    assert guard.token_ok(" abc123 ", "abc123") is True
    assert guard.token_ok("abc12—3", "abc123") is False          # a dash inside is not the token, and no exception
    assert guard.token_ok("", "abc123") is False


def test_the_phones_https_door_is_the_consoles_own_origin():
    from lacuna_api.control.guard import origin_ok
    assert origin_ok("https://mac-studio.local:8443", "mac-studio.local:8443")
    assert origin_ok("https://localhost:8443", "localhost:8443")
    assert not origin_ok("http://mac-studio.local:8443", "mac-studio.local:8443")      # the door is https only
    assert not origin_ok("https://evil.example:8443", "mac-studio.local:8443")         # another site on the same port
    assert not origin_ok("http://127.0.0.1:3000", "127.0.0.1:1138")                    # vite is another site
