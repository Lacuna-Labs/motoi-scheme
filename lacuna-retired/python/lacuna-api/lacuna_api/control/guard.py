"""THE DOOR — who may reach :1138.

The console listens on 127.0.0.1 (the launchd agent's --host). His phone can reach it only when he opens the door:
set LACUNA_LAN=1 and bind 0.0.0.0. Then every request that is not from this Mac must carry the token in
~/.lacuna/token (made on first use, readable only by him) — as `?token=` once (a cookie keeps it) or the
`X-Lacuna-Token` header. THE TERMINAL IS NEVER OFFERED OFF THE MACHINE, token or not: it is a real shell.
"""
from __future__ import annotations

import os
import secrets

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import JSONResponse, PlainTextResponse

from .core import LACUNA_HOME

LOOPBACK = {"127.0.0.1", "::1", "localhost"}
CONSOLE_PORT = int(os.environ.get("LACUNA_PORT") or 1138)
DESK_HTTPS_PORT = int(os.environ.get("LACUNA_DESK_HTTPS_PORT") or 8443)   # our own Caddy door for the phone's mic (desk-https)
INGRESS_OCTAVE_PORT = 4096                                                # Octave 4096 clean ingress (lacuna.local:4096)
ALLOWED_PORTS = {CONSOLE_PORT, DESK_HTTPS_PORT, INGRESS_OCTAVE_PORT}

# THE BROWSER'S OWN DOOR. A page in his browser is a loopback client too, and a page from anywhere can open a
# WebSocket or send a simple POST at 127.0.0.1:1138 — the terminal is a login shell, the POSTs stop services.
# So a request that names an Origin is admitted only when that origin IS the console (proved 2026-09-25: a page
# from evil.example got a zsh). No Origin at all is a tool, not a page (curl, the CLI, websocat) — admitted.
def origin_ok(origin: str | None, own: str | None = None) -> bool:
    """`own` is the request's own Host header: through the Door his phone reaches the console as
    mac-studio.local:1138, and the page it gets names THAT as its origin — the same site, admitted (2026-09-25)."""
    if not origin:
        return True
    from urllib.parse import urlsplit
    try:
        u = urlsplit(origin)
    except ValueError:
        return False
    host = (u.hostname or "").strip("[]").lower()
    # the console's own port only: a page served by anything else on this Mac
    # (vite :3000, a preview :4174, a notebook) is another site (L6, 2026-09-25)
    # … and our own https doors for the phone (Caddy on 8443 and 4096 → this console): its pages are the console's pages.
    # ports 8443 and 4096 are TLS doors only: plain http is refused
    if u.port in (DESK_HTTPS_PORT, INGRESS_OCTAVE_PORT) and u.scheme != "https":
        return False
    door = u.scheme == "https" and (u.port in (DESK_HTTPS_PORT, INGRESS_OCTAVE_PORT))
    if u.scheme not in ("http", "https") or (u.port not in ALLOWED_PORTS and not door):
        return False
    if host in LOOPBACK:
        return True
    own_host = (own or "").split(":")[0].strip("[]").lower()
    return bool(own_host) and host == own_host and own_host not in LOOPBACK


def token() -> str:
    p = LACUNA_HOME / "token"
    if not p.exists():
        p.write_text(secrets.token_urlsafe(24))
        os.chmod(p, 0o600)
    return p.read_text().strip()


def token_ok(got: str, want: str) -> bool:
    """A constant-time match on bytes; stray quotes, spaces and dashes around a pasted token are trimmed, and a token
    that still is not ASCII is simply wrong — never an exception."""
    try:
        g = (got or "").strip().strip("\"'“”‘’ ").encode("utf-8")
        w = (want or "").encode("utf-8")
        return bool(g) and secrets.compare_digest(g, w)
    except Exception:
        return False


def local(host: str | None) -> bool:
    return (host or "") in LOOPBACK


def ws_allowed(ws) -> bool:
    """The same door for a WebSocket — BaseHTTPMiddleware never sees those, so each socket asks here itself."""
    if not origin_ok(ws.headers.get("origin"), ws.headers.get("host")):
        return False
    if local(ws.client.host if ws.client else None):
        return True
    if os.environ.get("LACUNA_LAN") != "1":
        return False
    got = ws.query_params.get("token") or ws.headers.get("x-lacuna-token") or ws.cookies.get("lacuna_token")
    return bool(got) and token_ok(got, token())


class Door(BaseHTTPMiddleware):
    async def dispatch(self, request, call_next):
        host = request.client.host if request.client else None
        # a page from elsewhere may READ nothing and DO nothing here: any request that names a foreign
        # origin is refused before the loopback check (a cross-site simple POST needs no preflight)
        if not origin_ok(request.headers.get("origin"), request.headers.get("host")):
            return PlainTextResponse("Lacuna answers only its own console.", status_code=403)
        if local(host):
            return await call_next(request)
        if os.environ.get("LACUNA_LAN") != "1":
            return PlainTextResponse("Lacuna answers only on this Mac.", status_code=403)
        if request.url.path.startswith("/ws/terminal"):
            return PlainTextResponse("The terminal is only offered on the Studio itself.", status_code=403)
        want = token()
        got = request.query_params.get("token") or request.headers.get("x-lacuna-token") or request.cookies.get("lacuna_token")
        # compared as BYTES: a token pasted on a phone arrived with a curly quote in it and `compare_digest` on str
        # raised on the non-ASCII character — every request from his phone was a 500, not a 401 (2026-09-26)
        if not got or not token_ok(got, want):
            return JSONResponse({"detail": "a token is needed from off this Mac — open the link from `door.sh open` once; a pasted token with a quote or a dash in it is not the token"}, status_code=401)
        resp = await call_next(request)
        if request.query_params.get("token"):
            resp.set_cookie("lacuna_token", want, httponly=True, samesite="strict", max_age=90 * 86400)
        return resp
