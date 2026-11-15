#!/usr/bin/env python3
"""THE GPU LEASE — one file says who may load something big (LACUNA-2.0-DESIGN §6, 2026-10-16).

~/.lacuna/jail/gpu-lease = {"holder": "painter|bake|bench|battery|card:<name>|alfred", "since", "expires", "why"}.
The painter, a poster bake, the bench, the battery and a worker step each `take` before loading and `release`
after; a lease that outlives `expires` is dead. `lease status` is what `box status` prints and what the desk says
when asked "can you draw me a picture right now". The old `gpu-busy` flag is honored as a lease held by "posters".

    lease status · lease take HOLDER [--for 2h] [--why words] · lease release HOLDER · lease wait HOLDER [--max 3h]

NAMED LEASES (LACUNA-1.3-DESIGN §37.3, B48): the same rule for anything else a run touches — a repo, a branch, a cart, a
log, the brain lane. A Lacuna cart declares (touches . ("repo:curator" "log:dev-api")) and takes each before it starts;
a second run wanting one waits or picks other work, never shares. One file per thing under ~/.lacuna/jail/leases/, the
same {holder, since, expires, why}, so a holder that dies cannot wedge the box: its lease simply runs out. "gpu" is the
GPU lease above.
    lease status --on THING · lease take HOLDER --on THING [--for 2h] · lease release HOLDER --on THING
Standard library. Runs in or out of the jail (the file is under ~/.lacuna/jail, which the jail may write? no — so
inside the jail it goes through the broker: `box lease …`).
"""
from __future__ import annotations

import datetime as dt
import fcntl
import json
import os
import re
import sys
import time

HOME = os.path.expanduser("~")
LEASE = f"{HOME}/.lacuna/jail/gpu-lease"
BUSY = f"{HOME}/.lacuna/jail/gpu-busy"      # the 1.0 flag the poster bake still raises


def seconds(span: str) -> int:
    m = re.fullmatch(r"\s*(\d+)\s*([smhd])\s*", span or "")
    return int(m.group(1)) * {"s": 1, "m": 60, "h": 3600, "d": 86400}[m.group(2)] if m else 7200


def current() -> dict | None:
    try:
        with open(LEASE) as f:
            j = json.load(f)
        if float(j.get("expires", 0)) > time.time():
            return j
    except (OSError, ValueError):
        pass
    if os.path.exists(BUSY):
        return {"holder": "posters", "since": os.path.getmtime(BUSY), "expires": time.time() + 3600, "why": "the poster bake (gpu-busy flag)"}
    return None


def status() -> str:
    j = current()
    if not j:
        return "GPU: free"
    left = int(float(j["expires"]) - time.time())
    since = dt.datetime.fromtimestamp(float(j["since"])).strftime("%H:%M")
    return f"GPU: leased to {j['holder']} since {since}, about {left // 60} min left{(' — ' + j['why']) if j.get('why') else ''}"


def take(holder: str, span: str = "2h", why: str = "") -> str:
    j = current()
    if j and j["holder"] != holder:
        return f"no: {status()}"
    with open(LEASE, "w") as f:
        json.dump({"holder": holder, "since": (j or {}).get("since", time.time()), "expires": time.time() + seconds(span), "why": why}, f)
    return f"ok: {holder} holds the GPU for {span}"


def release(holder: str) -> str:
    j = current()
    if j and j["holder"] != holder and holder != "alfred":
        return f"no: {status()}"
    try:
        os.unlink(LEASE)
    except OSError:
        pass
    return "GPU: free"


def wait(holder: str, span: str = "3h", want: str = "2h") -> str:
    deadline = time.time() + seconds(span)
    while time.time() < deadline:
        if take(holder, want).startswith("ok"):
            return f"ok: {holder} holds the GPU"
        time.sleep(30)
    return f"gave up after {span}: {status()}"


def leases_dir() -> str:
    return os.environ.get("LACUNA_LEASES", f"{HOME}/.lacuna/jail/leases")


def _thing_file(thing: str) -> str:
    return os.path.join(leases_dir(), re.sub(r"[^A-Za-z0-9_.:@-]+", "-", str(thing)).strip("-.")[:100] + ".json")


def held(thing: str) -> dict | None:
    """Who holds a named thing now, or None (an expired lease is nobody's)."""
    if thing == "gpu":
        return current()
    try:
        with open(_thing_file(thing)) as f:
            j = json.load(f)
        return j if float(j.get("expires", 0)) > time.time() else None
    except (OSError, ValueError):
        return None


def take_on(thing: str, holder: str, span: str = "2h", why: str = "") -> str:
    """Take (or renew) a named thing. Checked and written under one lock: two takers at once, one wins."""
    if thing == "gpu":
        return take(holder, span, why)
    os.makedirs(leases_dir(), exist_ok=True)
    with open(os.path.join(leases_dir(), ".lock"), "a+") as lk:
        fcntl.flock(lk, fcntl.LOCK_EX)
        try:
            j = held(thing)
            if j and j["holder"] != holder:
                return f"no: {thing} is held by {j['holder']}{(' — ' + j['why']) if j.get('why') else ''}"
            tmp = _thing_file(thing) + f".{os.getpid()}.tmp"
            with open(tmp, "w") as f:
                json.dump({"thing": thing, "holder": holder, "since": (j or {}).get("since", time.time()),
                           "expires": time.time() + seconds(span), "why": why}, f)
            os.replace(tmp, _thing_file(thing))
            return f"ok: {holder} holds {thing} for {span}"
        finally:
            fcntl.flock(lk, fcntl.LOCK_UN)


def release_on(thing: str, holder: str) -> str:
    if thing == "gpu":
        return release(holder)
    j = held(thing)
    if j and j["holder"] != holder and holder != "alfred":
        return f"no: {thing} is held by {j['holder']}"
    try:
        os.unlink(_thing_file(thing))
    except OSError:
        pass
    return f"{thing}: free"


def handle(words: list[str]) -> str:
    def flag(name, default=None):
        return words[words.index(name) + 1] if name in words and words.index(name) + 1 < len(words) else default
    on = flag("--on")
    if on:
        if not words or words[0] == "status":
            j = held(on)
            return f"{on}: held by {j['holder']}" if j else f"{on}: free"
        if words[0] == "take" and len(words) >= 2:
            return take_on(on, words[1], flag("--for", "2h"), " ".join(words[words.index("--why") + 1:]) if "--why" in words else "")
        if words[0] == "release" and len(words) >= 2:
            return release_on(on, words[1])
    if not words or words[0] == "status":
        return status()
    if words[0] == "take" and len(words) >= 2:
        why = " ".join(words[words.index("--why") + 1:]) if "--why" in words else ""
        return take(words[1], flag("--for", "2h"), why)
    if words[0] == "release" and len(words) >= 2:
        return release(words[1])
    if words[0] == "wait" and len(words) >= 2:
        return wait(words[1], flag("--max", "3h"), flag("--for", "2h"))
    return __doc__.split("\n\n")[0]


if __name__ == "__main__":
    print(handle(sys.argv[1:]))
