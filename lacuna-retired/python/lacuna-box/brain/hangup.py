"""HANG UP — the caller left, so the brain stops (the owner, 2026-10-18: "have it cancel abandoned requests so we don't
have them all queued up all crazy"). Three Pi windows quit mid-answer had kept both of the brain's slots busy, the brain
generating for no one while the next person waited.

A watcher on the caller's socket: the moment it closes (Pi quit, a tab closed, a worker killed), the upstream connection
is shut, and llama-server drops the request at its next step. The counter tells the desk how many were hung up on.
"""
from __future__ import annotations

import select
import socket
import threading


def when_gone(caller: socket.socket, up, counter: list) -> callable:
    """Watch `caller`; when it closes, shut `up`'s socket and count it. Returns stop(), called when the request ends."""
    done = threading.Event()

    def watch():
        while not done.is_set():
            try:
                readable, _, _ = select.select([caller], [], [], 1.0)
                if readable and caller.recv(1, socket.MSG_PEEK) == b"":
                    raise ConnectionResetError
            except (OSError, ValueError):
                if not done.is_set():
                    try:
                        up.fp.raw._sock.shutdown(socket.SHUT_RDWR)
                    except Exception:  # noqa: BLE001 — already closed is fine
                        pass
                    counter[0] += 1
                return

    threading.Thread(target=watch, daemon=True).start()
    return done.set
