"""THE TERMINAL TAB — a real shell for the operator, over a WebSocket on :1138.

His, 2026-09-24: *"a tab with a terminal."* A login zsh in a pseudo-terminal, bridged byte for byte to xterm.js in the
page. It is the operator's — the console binds 127.0.0.1 only — and it is never offered to the model: the model acts
through the toolbox (chat.py), not a shell.
"""
from __future__ import annotations

import asyncio
import fcntl
import json
import os
import pty
import signal
import struct
import termios

from fastapi import WebSocket, WebSocketDisconnect

from .core import audit


def _resize(fd: int, rows: int, cols: int):
    try:
        fcntl.ioctl(fd, termios.TIOCSWINSZ, struct.pack("HHHH", rows, cols, 0, 0))
    except Exception:
        pass


async def serve(ws: WebSocket):
    from .guard import local, origin_ok
    # a real shell is never offered off this Mac — AND never to a page from elsewhere on it: any web page could
    # open ws://127.0.0.1:1138/ws/terminal and had a login zsh (L1, proved live 2026-09-25 after the guard's own
    # fix — this route checked loopback itself and never asked the Door's origin rule)
    if not local(ws.client.host if ws.client else None) or not origin_ok(ws.headers.get("origin")):
        await ws.close(code=4403)
        return
    await ws.accept()
    pid, fd = pty.fork()
    if pid == 0:                                   # the child: a login shell in the home directory
        os.chdir(os.path.expanduser("~"))
        env = {**os.environ, "TERM": "xterm-256color", "LACUNA_TERMINAL": "1", "DISABLE_UPDATE_PROMPT": "true", "DISABLE_AUTO_UPDATE": "true"}  # no omz question eats the first key
        os.execvpe("/bin/zsh", ["/bin/zsh", "-l"], env)
    audit("alfred", "terminal.open", pid=pid)
    loop = asyncio.get_running_loop()
    q: asyncio.Queue = asyncio.Queue()

    def readable():
        try:
            data = os.read(fd, 65536)
        except OSError:
            data = b""
        q.put_nowait(data)
    loop.add_reader(fd, readable)

    async def pump_out():
        while True:
            data = await q.get()
            if not data:
                break
            await ws.send_bytes(data)

    out_task = asyncio.create_task(pump_out())
    try:
        while True:
            msg = await ws.receive()
            if msg.get("type") == "websocket.disconnect":
                break
            if msg.get("bytes") is not None:
                os.write(fd, msg["bytes"])
            elif msg.get("text"):
                t = msg["text"]
                if t.startswith("{"):
                    try:
                        j = json.loads(t)
                        if j.get("resize"):
                            _resize(fd, int(j["rows"]), int(j["cols"]))
                            continue
                    except Exception:
                        pass
                os.write(fd, t.encode())
    except WebSocketDisconnect:
        pass
    finally:
        loop.remove_reader(fd)
        out_task.cancel()
        try:
            os.kill(pid, signal.SIGHUP)
        except ProcessLookupError:
            pass
        try:
            os.close(fd)
            os.waitpid(pid, os.WNOHANG)
        except Exception:
            pass
        audit("alfred", "terminal.close", pid=pid)
