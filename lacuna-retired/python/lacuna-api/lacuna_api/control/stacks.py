"""THE STALL'S STACK (lane F5-A, unit A.10's live finding, 2026-11-01).

Owns one hook: `kill -INFO <pid>` writes every thread's Python stack to the API's stderr (`~/.lacuna/logs/console-py.log`). The
dump runs in C without the GIL, so a stalled API still answers it. Why: from 08:29Z to 08:44Z on 2026-11-01 the API's event loop
waited 6–13 s for the GIL eight times, behind a pool thread inside one large `json.loads` (two macOS `sample` captures), and a
native sample cannot name the Python function. SIGINFO because its default is to discard: a process without the hook ignores
the signal, where SIGUSR1's default ends the API.

Refuses: any other signal; a second arm; a platform without SIGINFO (it arms nothing and says so by returning False).
Implements: the postmortem P-2026-11-01-hangups-read-as-resets, action item `prevent` (find the stall's cause).
"""
from __future__ import annotations

import faulthandler
import signal
import sys

_armed = False


def arm() -> bool:
    """Arms the hook once. Returns True when this call armed it; False when it was armed already or there is no SIGINFO."""
    global _armed
    if _armed or not hasattr(signal, "SIGINFO"):
        return False
    faulthandler.register(signal.SIGINFO, file=sys.stderr, all_threads=True, chain=False)
    _armed = True
    return True
