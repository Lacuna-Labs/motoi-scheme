"""ONLY THE OWNER CAN APPROVE (the owner's review, 2026-10-18) — the press is proof of a key, never a name someone claims.

Tonight a worker approved a card as "claude" and a test approved two as "alfred": the approve path trusted whatever `who`
the caller said. Every law ends in "the owner's press", so the press must be unforgeable by local processes acting in his
name. Filing a petition stays open to everyone; DECIDING one (yes or no) needs this proof.

  ~/.lacuna/owner-key           32 random bytes, hex, mode 600, created once. Only the owner's terminal reads it (the CLI
                                signs with it); the jail, the foreman and every worker are denied it by their sandbox.
  ~/.lacuna/owner-devices.json  the paired devices (the desk, the phone), 600. Each holds its own secret; the file keeps
                                only a salt and a hash — the secret is derived from the owner key, so the file alone signs
                                nothing, and rotating the key unpairs every device.
  ~/.lacuna/owner-pairing.json  the one waiting pairing phrase (`lacuna pair`), hashed, 10 minutes, five tries.

A press carries   X-Lacuna-Owner:   hex HMAC-SHA256(secret, "<petition id>:<yes|no>:<unix seconds>")
                  X-Lacuna-Owner-T: those seconds (within 120 s of now)
                  X-Lacuna-Device:  the device's name (absent = signed with the owner key itself)
The raw key never travels. A signature is good once. The audit records decided_by: owner-key | device:<name>.
"""
from __future__ import annotations

import hashlib
import hmac
import json
import os
import re
import secrets
import threading
import time
from pathlib import Path

from fastapi import APIRouter, Request

from . import core

WINDOW_S = 120
PAIR_TRIES = 5
REFUSED = "only the owner's press approves; filing a card is fine"
router = APIRouter()
_lock = threading.RLock()
_used: dict[str, float] = {}          # signatures already spent → when (a replay is refused)


def _home() -> Path:
    return Path(core.LACUNA_HOME)       # read at call time: tests move it


def key_file() -> Path:
    return _home() / "owner-key"


def devices_file() -> Path:
    return _home() / "owner-devices.json"


def pairing_file() -> Path:
    return _home() / "owner-pairing.json"


def _write_private(p: Path, text: str) -> None:
    """Write a 600 file atomically (mode set before any content lands)."""
    p.parent.mkdir(parents=True, exist_ok=True)
    tmp = p.with_name(f".{p.name}.{os.getpid()}.tmp")
    with open(tmp, "w") as f:
        os.chmod(tmp, 0o600)
        f.write(text)
    os.replace(tmp, p)


def key() -> bytes:
    """The owner key, created once (32 random bytes, hex on disk, 600)."""
    p = key_file()
    with _lock:
        if not p.exists():
            _write_private(p, secrets.token_hex(32) + "\n")
        return bytes.fromhex(p.read_text().strip())


def sign(secret: bytes, pid: str, approve: bool, t: int) -> str:
    return hmac.new(secret, f"{pid}:{'yes' if approve else 'no'}:{int(t)}".encode(), hashlib.sha256).hexdigest()


def _read_json(p: Path) -> dict:
    try:
        d = json.loads(p.read_text())
        return d if isinstance(d, dict) else {}
    except (OSError, ValueError):
        return {}


def devices() -> dict:
    return _read_json(devices_file()).get("devices") or {}


def _save_devices(d: dict) -> None:
    _write_private(devices_file(), json.dumps({"devices": d}, indent=1))


def device_secret(name: str, salt: str) -> bytes:
    return bytes.fromhex(hmac.new(key(), f"device:{name}:{salt}".encode(), hashlib.sha256).hexdigest())


def _phrase_hash(phrase: str) -> str:
    return hashlib.sha256(" ".join(re.split(r"[\s\-_.,]+", str(phrase or "").strip().lower())).encode()).hexdigest()


def check(pid: str, approve: bool, proof: dict | None) -> tuple[str | None, str]:
    """(decided_by, "") when the press is the owner's; (None, why) when it is not."""
    proof = proof or {}
    sig, t, dev = str(proof.get("sig") or "").strip().lower(), proof.get("t"), str(proof.get("device") or "").strip()
    if not sig or t in (None, ""):
        return None, REFUSED
    try:
        t = int(float(t))
    except (TypeError, ValueError):
        return None, REFUSED
    now = time.time()
    if abs(now - t) > WINDOW_S:
        return None, f"{REFUSED} (this press is stale: signed {int(now - t)} s ago, the limit is {WINDOW_S} s)"
    if dev:
        d = devices().get(dev)
        if not d:
            return None, f"{REFUSED} (the device {dev!r} is not paired, or was revoked — pair it again)"
        secret = device_secret(dev, d.get("salt", ""))
        if hashlib.sha256(secret).hexdigest() != d.get("check"):
            return None, f"{REFUSED} (the device {dev!r} was paired under an older owner key — pair it again)"
        by = f"device:{dev}"
    else:
        secret, by = key(), "owner-key"
    if not hmac.compare_digest(sign(secret, pid, approve, t), sig):
        return None, REFUSED
    with _lock:
        for s, at in list(_used.items()):
            if now - at > 2 * WINDOW_S:
                del _used[s]
        if sig in _used:
            return None, f"{REFUSED} (this press was already used)"
        _used[sig] = now
    if dev:
        with _lock:
            all_ = devices()
            if dev in all_:
                all_[dev]["last_used"] = now
                _save_devices(all_)
    return by, ""


def pair(phrase: str, name: str) -> dict:
    """Exchange the one-time phrase `lacuna pair` printed for this device's own secret (shown once, kept by the device)."""
    with _lock:
        pend = _read_json(pairing_file())
        if not pend.get("hash") or time.time() > float(pend.get("until") or 0):
            pairing_file().unlink(missing_ok=True)
            return {"ok": False, "why": "no pairing is waiting — run `lacuna pair` at the owner's terminal (a phrase lasts 10 minutes)"}
        if not hmac.compare_digest(_phrase_hash(phrase), pend["hash"]):
            pend["tries"] = int(pend.get("tries") or 0) + 1
            if pend["tries"] >= PAIR_TRIES:
                pairing_file().unlink(missing_ok=True)
                return {"ok": False, "why": "wrong phrase five times — that phrase is gone; run `lacuna pair` again"}
            _write_private(pairing_file(), json.dumps(pend))
            return {"ok": False, "why": "that is not the phrase — check the six words at the terminal"}
        pairing_file().unlink(missing_ok=True)
    base = re.sub(r"[^a-z0-9-]+", "-", str(name or "device").lower()).strip("-")[:20] or "device"
    with _lock:
        all_ = devices()
        n, i = base, 2
        while n in all_:
            n, i = f"{base}-{i}", i + 1
        salt = secrets.token_hex(16)
        secret = device_secret(n, salt)
        all_[n] = {"salt": salt, "check": hashlib.sha256(secret).hexdigest(), "created": time.time(), "last_used": None}
        _save_devices(all_)
    core.audit(f"device:{n}", "owner.paired", device=n)
    return {"ok": True, "device": n, "secret": secret.hex()}


def revoke(name: str) -> bool:
    with _lock:
        all_ = devices()
        if name not in all_:
            return False
        del all_[name]
        _save_devices(all_)
    return True


@router.post("/api/owner/pair")
def pair_route(body: dict):
    return pair(str(body.get("phrase") or ""), str(body.get("device") or ""))


@router.get("/api/owner/devices")
def devices_route():
    return [{"device": n, "created": d.get("created"), "last_used": d.get("last_used")} for n, d in devices().items()]


# ── A PAIRED DEVICE PAIRS ANOTHER (the owner, 2026-10-18: "give me the ability to fetch that Lacuna token thing from
# this interface … I may be on my phone … now I'm stuck"). A device already paired (its press signed on "pair-mint")
# makes the same one-time six words `lacuna pair` makes, good for 10 minutes; the new device types them once. Nothing
# unpaired can make one, and Lacuna's sandbox cannot sign.
_MINT_WORDS = ("acorn amber anchor apple arrow aspen atlas autumn badge bamboo banjo barley basil beacon berry birch "
               "blossom bramble breeze brook cactus candle canyon cedar chalk cherry cider clover cobalt comet coral "
               "cosmos cotton crane cricket crystal daisy delta dune ember falcon fern fiddle fjord flint forest fox "
               "garnet ginger glacier granite harbor hazel heron honey indigo island ivory jade jasmine juniper kettle "
               "lagoon lantern lark lemon lily linen lotus maple marble meadow mint moss nectar nutmeg oak ocean olive "
               "orchid otter pebble pepper pine plum poppy prairie quartz quill raven reed river robin saffron sage "
               "sequoia shell silver sparrow spruce stone summit thistle thyme tulip velvet violet walnut willow wren").split()


def mint_phrase(proof: dict | None) -> dict:
    import secrets as _s
    by, why = check("pair-mint", True, proof)
    if not by:
        return {"ok": False, "why": why}
    phrase = " ".join(_s.choice(_MINT_WORDS) for _ in range(6))
    with _lock:
        _write_private(pairing_file(), json.dumps({"hash": _phrase_hash(phrase), "until": time.time() + 600, "tries": 0}))
    from .core import audit
    audit(by, "owner.pair-minted")
    return {"ok": True, "phrase": phrase, "minutes": 10, "by": by}


# THE FIRST PAIRING FROM THE DESK (burn-down 1.5 A10; the owner had to open the terminal, and macOS stopped python): the desk on
# THIS Mac asks; the six words appear in a native dialog on this Mac's screen — never in the answer, so no program reading the
# API (Claude included) is handed them; a person reads them and types them once. Only from the Mac itself (loopback).
def show_phrase_on_screen() -> dict:
    import secrets as _s
    import subprocess
    phrase = " ".join(_s.choice(_MINT_WORDS) for _ in range(6))
    with _lock:
        _write_private(pairing_file(), json.dumps({"hash": _phrase_hash(phrase), "until": time.time() + 600, "tries": 0}))
    msg = f"Lacuna pairing words (10 minutes):\n\n{phrase}\n\nType them once on the device you are pairing."
    subprocess.Popen(["/usr/bin/osascript", "-e", f'display dialog "{msg}" with title "Lacuna" buttons {{"Done"}} default button "Done" giving up after 600'],
                     stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    from .core import audit
    audit("desk", "owner.pair-shown-on-screen")
    return {"ok": True, "shown": "the six words are on this Mac's screen, in a Lacuna dialog — good for 10 minutes"}


@router.post("/api/owner/pair/show")
def pair_show_route(request: Request):
    host = request.client.host if request.client else ""
    if host not in ("127.0.0.1", "::1", "localhost"):
        return {"ok": False, "why": "the words appear only on the Mac itself — use this key at the Mac, or a paired device's 'pair another'"}
    return show_phrase_on_screen()
