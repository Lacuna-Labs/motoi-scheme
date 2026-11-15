"""CALIPER'S EYE STREAM (the owner, 2026-10-18: "can I see what the SigLIP is seeing … in multiples … and tell it where
to go"). The desk's eye wall calls these; the eye runs only while someone watches (a heartbeat; 2 minutes idle and the
shooter and judge exit, giving their memory back).

  GET  /api/eye                  the eyes: id, what it watches, its frame's age, SigLIP's verdict; keeps the eye awake
  POST /api/eye/start            wake the eye: default targets when none are set, shooter (lacuna-box/eye/shooter.mjs,
                                 headless browser + simctl) and judge (judge.py, SigLIP zero-shot) started if not running
  GET  /api/eye/frame/{id}       the newest frame (jpeg)
  POST /api/eye/{id}/steer       {do: goto|click|back, arg} — the owner's direction, carried out before the next frame
"""
from __future__ import annotations

import json
import os
import re
import subprocess
import time
from pathlib import Path

DIR = Path.home() / ".lacuna" / "eye"
BOX = Path(__file__).resolve().parents[3] / "lacuna-box" / "eye"
NODE = "/opt/homebrew/bin/node"
PY = str(Path.home() / "code" / "curator" / "curator-api" / ".venv" / "bin" / "python")
DEFAULT = [{"id": "web-home", "kind": "web", "url": "http://127.0.0.1:3000/"},
           {"id": "web-info", "kind": "web", "url": "http://127.0.0.1:3000/"}]


def _beat() -> None:
    DIR.mkdir(parents=True, exist_ok=True)
    (DIR / "heartbeat").write_text(str(time.time()))


def _running(pattern: str) -> bool:
    return bool(subprocess.run(["pgrep", "-f", pattern], capture_output=True).stdout.strip())


def start() -> dict:
    _beat()
    tf = DIR / "targets.json"
    if not tf.exists():
        targets = list(DEFAULT)
        if subprocess.run(["xcrun", "simctl", "list", "devices", "booted"], capture_output=True, text=True).stdout.count("Booted"):
            targets.append({"id": "simulator", "kind": "sim"})
        tf.write_text(json.dumps(targets))
    log = open(Path.home() / ".lacuna" / "logs" / "eye.log", "a")
    started = []
    if not _running("eye/shooter.mjs"):
        subprocess.Popen([NODE, str(BOX / "shooter.mjs")], stdout=log, stderr=log, start_new_session=True)
        started.append("shooter")
    if not _running("eye/judge.py"):
        subprocess.Popen([PY, str(BOX / "judge.py")], stdout=log, stderr=log, start_new_session=True)
        started.append("judge")
    return {"ok": True, "started": started}


def _read(p: Path, d):
    try:
        return json.loads(p.read_text())
    except (OSError, ValueError):
        return d


def eyes(watch: bool = False) -> dict:
    if watch:                                         # only the open wall keeps the eye awake; the tile only reads
        _beat()
    out = []
    for t in _read(DIR / "targets.json", []):
        f = DIR / f"{t['id']}.jpg"
        st = _read(DIR / f"{t['id']}.state.json", {})
        out.append({"id": t["id"], "kind": t.get("kind"), "watching": st.get("url") or t.get("url") or "the simulator",
                    "age_s": round(time.time() - f.stat().st_mtime, 1) if f.exists() else None, "did": st.get("did"),
                    "error": st.get("error"), "verdict": _read(DIR / f"{t['id']}.verdict.json", None)})
    return {"eyes": out, "running": {"shooter": _running("eye/shooter.mjs"), "judge": _running("eye/judge.py")}}


def frame(eid: str) -> Path | None:
    if not re.fullmatch(r"[\w-]{1,40}", eid):
        return None
    f = DIR / f"{eid}.jpg"
    return f if f.exists() else None


def steer(eid: str, do: str, arg: str, who: str) -> dict:
    from .core import audit
    if do not in ("goto", "click", "back", "tap", "type", "key", "wheel") or not re.fullmatch(r"[\w-]{1,40}", eid):
        return {"ok": False, "why": "steer is goto · click · back · tap · type · key · wheel on a known eye"}
    with open(DIR / "steer.jsonl", "a") as f:
        f.write(json.dumps({"id": eid, "do": do, "arg": str(arg)[:200]}) + "\n")
    audit(who, "eye.steer", eye=eid, do=do, arg=str(arg)[:80])
    return {"ok": True, "said": f"{eid}: {do} {arg}".strip()}


def web_open(url: str, who: str) -> dict:
    """THE WEB CARD (the walk, W22: "a page that can be open … Lacuna with access to the web can take me to websites and
    open them, and I can browse them right there"): one browser tab of our own, the eye named `web`. A page is fetched
    ONCE per address the owner (or Lacuna) goes to — frames are pictures of the page already open, never re-fetches
    (the outside-sites rule: one try, no retry loop)."""
    from .core import audit
    u = str(url or "").strip()
    if not re.match(r"^https?://", u):
        u = "https://" + u
    if not re.fullmatch(r"https?://[^\s]{3,500}", u):
        return {"ok": False, "why": "that is not an address"}
    DIR.mkdir(parents=True, exist_ok=True)
    tf = DIR / "targets.json"
    targets = [t for t in _read(tf, []) if t.get("id") != "web"] or list(DEFAULT)
    had = any(t.get("id") == "web" for t in _read(tf, []))
    targets.append({"id": "web", "kind": "web", "url": u})
    tf.write_text(json.dumps(targets))
    if had:                                            # the tab is open: go there in it
        steer("web", "goto", u, who)
    audit(who, "web.open", url=u[:200])
    start()
    return {"ok": True, "url": u}
