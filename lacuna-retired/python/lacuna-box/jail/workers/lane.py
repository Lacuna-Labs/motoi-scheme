"""THE BACKGROUND LANE (2026-10-18) — the one brain has two slots (OLLAMA_NUM_PARALLEL=2). Every background use of it —
a repair round, a fetch read, a worker's need-brain, a check-in — holds this lock for the length of ONE call, so the
background never holds more than one slot and a person's conversation always finds the other free. Per call, not per
job: a long repair and a worker's question take turns instead of one starving the other.
The lock lives in Lacuna's world (the jail may write there; the API and the runner may too)."""
from __future__ import annotations

import fcntl
import os
import time
from contextlib import contextmanager

LOCK = os.path.expanduser("~/lacuna-world/locks/brain-bg.lock")


@contextmanager
def background(max_wait: float = 900.0):
    os.makedirs(os.path.dirname(LOCK), exist_ok=True)
    f = open(LOCK, "a+")
    t0 = time.time()
    while True:
        try:
            fcntl.flock(f, fcntl.LOCK_EX | fcntl.LOCK_NB)
            break
        except BlockingIOError:
            if time.time() - t0 > max_wait:
                f.close()
                raise TimeoutError("the background lane stayed busy")
            time.sleep(0.5)
    try:
        yield time.time() - t0
    finally:
        fcntl.flock(f, fcntl.LOCK_UN)
        f.close()
