"""TRAINED MINDS IN SERVICE, VERSIONED AND REVERSIBLE (the owner's review, 2026-10-18; LACUNA-1.3-DESIGN §41).

An approved forge-propose used to be only a line in forge-decisions.jsonl. Now the yes makes it real, and every step can
be undone:

  ~/.lacuna/minds/trained/<role>/<version>/   the GGUF + manifest.json (base, pairs set, eval numbers incl. the reality
                                              gold set when measured, date). A version is never overwritten.
  box-minds.json `roles`                      {"sentry": {"model": <GGUF path>, "version": "v3", "previous": "v2",
                                              "family": "gemma3"}} — the gateway serves a role's current version under the
                                              role's name (lacuna-box/brain/minds.py resolve()).
  ~/lacuna-world/forge/roles.jsonl            the history: promote · auto-rollback · rollback, who, from → to, what it said.

  put_in_service(args, who)   the owner-approved propose: install the forge's GGUF as the next version, then promote.
  promote(role, version)      write the role (keeping previous), restart ONLY the gateway, a smoke call to the role; when
                              it does not answer, roll back by itself and say so.
  rollback(role)              back to `previous` (`lacuna minds rollback <role>`, or a forge-rollback card — owner-signed).

LACUNA_BOX_MINDS moves box-minds.json, LACUNA_GATEWAY_URL the gateway, LACUNA_GATEWAY_LABEL its launchd label ("" = do not
restart: the tests). Tests never touch the live files.
"""
from __future__ import annotations

import json
import os
import re
import shutil
import subprocess
import time
import urllib.request
from pathlib import Path

from fastapi import APIRouter

from . import forge

router = APIRouter()


def box_minds() -> Path:
    return Path(os.environ.get("LACUNA_BOX_MINDS") or Path.home() / "code/lacuna/lacuna-box/brain/box-minds.json")


def trained_dir() -> Path:
    return forge.lacuna_home() / "minds" / "trained"


def history_file() -> Path:
    return forge.world() / "forge" / "roles.jsonl"


def gateway_url() -> str:
    return os.environ.get("LACUNA_GATEWAY_URL", "http://127.0.0.1:11434")


def _profile() -> dict:
    try:
        return json.loads(box_minds().read_text())
    except (OSError, ValueError):
        return {}


def roles() -> dict:
    return _profile().get("roles") or {}


def _set_role(role: str, entry: dict | None) -> None:
    p = _profile()
    rs = dict(p.get("roles") or {})
    if entry:
        rs[role] = entry
    else:
        rs.pop(role, None)
    p["roles"] = rs
    tmp = box_minds().with_name(f".{box_minds().name}.{os.getpid()}.tmp")
    tmp.write_text(json.dumps(p, indent=2) + "\n")
    os.replace(tmp, box_minds())


def history(n: int = 50) -> list[dict]:
    try:
        rows = history_file().read_text().splitlines()[-n:]
    except OSError:
        return []
    out = []
    for ln in rows:
        try:
            out.append(json.loads(ln))
        except ValueError:
            pass
    return out


def _note(role: str, event: str, who: str, frm, to, said: str) -> None:
    history_file().parent.mkdir(parents=True, exist_ok=True)
    with open(history_file(), "a") as f:
        f.write(json.dumps({"t": time.time(), "role": role, "event": event, "by": who, "from": frm, "to": to, "said": said}) + "\n")


def manifest(role: str, version: str) -> dict | None:
    try:
        return json.loads((trained_dir() / role / version / "manifest.json").read_text())
    except (OSError, ValueError):
        return None


def _family(base: str) -> str:
    b = str(base or "").lower()
    return "functiongemma" if "functiongemma" in b else "gemma4" if re.search(r"gemma-?4", b) else "gemma3"


def install(role: str, gguf: str, facts: dict) -> str:
    """The next version of a role: its own folder with the GGUF and the manifest. Never overwrites one."""
    src = Path(gguf).expanduser()
    if not src.is_file():
        raise FileNotFoundError(f"no GGUF at {src}")
    root = trained_dir() / role
    root.mkdir(parents=True, exist_ok=True)
    n = 1 + max([int(m.group(1)) for d in root.iterdir() if (m := re.fullmatch(r"v(\d+)", d.name))] or [0])
    d = root / f"v{n}"
    d.mkdir()                                            # exists → FileExistsError: a version is never overwritten
    try:
        os.link(src, d / src.name)                       # same disk: no second copy of the weights
    except OSError:
        shutil.copyfile(src, d / src.name)
    man = {"role": role, "version": d.name, "gguf": src.name, "source": str(src), "date": time.strftime("%Y-%m-%dT%H:%M:%S"),
           "family": _family(facts.get("base")), **facts}
    (d / "manifest.json").write_text(json.dumps(man, indent=1, default=str))
    return d.name


def restart_gateway() -> str:
    """Restart ONLY the brain gateway (the brain itself and Ollama keep running), and wait for it to answer."""
    label = os.environ.get("LACUNA_GATEWAY_LABEL", "ai.lacunalabs.brain-gateway")
    if not label:
        return "no gateway restart (LACUNA_GATEWAY_LABEL is empty)"
    subprocess.run(["/bin/launchctl", "kickstart", "-k", f"gui/{os.getuid()}/{label}"], capture_output=True, timeout=30)
    for _ in range(60):
        try:
            with urllib.request.urlopen(gateway_url() + "/api/version", timeout=2):
                return "the gateway restarted"
        except OSError:
            time.sleep(0.5)
    return "the gateway restarted but did not answer within 30 s"


def smoke(role: str) -> tuple[bool, str]:
    """One short call to the role by its name, through the gateway: an answer is a pass."""
    body = json.dumps({"model": role, "stream": False, "messages": [{"role": "user", "content": "Say ok."}],
                       "options": {"num_predict": 8}}).encode()
    req = urllib.request.Request(gateway_url() + "/api/chat", data=body, headers={"Content-Type": "application/json"})
    try:
        with urllib.request.urlopen(req, timeout=180) as r:
            out = json.loads(r.read().decode() or "{}")
    except (OSError, ValueError) as e:
        return False, f"{e.__class__.__name__}: {e}"[:200]
    if not isinstance(out.get("message"), dict):
        return False, str(out.get("error") or "no message in the answer")[:200]
    return True, "it answered"


def _entry(role: str, version: str, previous) -> dict:
    man = manifest(role, version) or {}
    return {"model": str(trained_dir() / role / version / man.get("gguf", "")), "version": version, "previous": previous,
            "family": man.get("family", "gemma3")}


def promote(role: str, version: str, who: str) -> dict:
    before = roles().get(role)
    _set_role(role, _entry(role, version, (before or {}).get("version")))
    restart_gateway()
    ok, why = smoke(role)
    if ok:
        said = f"{role} {version} is in service (previous {(before or {}).get('version') or 'none'}); the smoke call answered"
        _note(role, "promote", who, (before or {}).get("version"), version, said)
        return {"ok": True, "role": role, "version": version, "said": said}
    _set_role(role, before)                              # the role as it was, or no trained mind at all
    restart_gateway()
    back = (before or {}).get("version") or "no trained mind (the untrained one serves)"
    said = f"{role} {version} did not answer its smoke call ({why}) — rolled back to {back} by itself"
    _note(role, "auto-rollback", who, version, (before or {}).get("version"), said)
    return {"ok": False, "role": role, "version": version, "rolled_back": True, "said": said}


def can_rollback(role: str) -> str | None:
    cur = roles().get(role)
    if not cur:
        return f"no trained {role} is in service"
    if not cur.get("previous") or not manifest(role, cur["previous"]):
        return f"{role} {cur.get('version')} has no previous version to go back to"
    return None


def rollback(role: str, who: str) -> dict:
    why = can_rollback(role)
    if why:
        return {"ok": False, "said": why}
    cur = roles()[role]
    to = cur["previous"]
    earlier = next((h.get("from") for h in reversed(history(500)) if h.get("role") == role and h.get("event") == "promote"
                    and h.get("to") == to), None)
    _set_role(role, _entry(role, to, earlier))
    restart_gateway()
    ok, said_smoke = smoke(role)
    said = f"{role} is back on {to} (from {cur['version']})" + ("; the smoke call answered" if ok else
                                                                  f"; but its smoke call failed: {said_smoke}")
    _note(role, "rollback", who, cur["version"], to, said)
    return {"ok": ok, "role": role, "version": to, "said": said}


def put_in_service(args: dict, who: str) -> dict:
    """The owner-approved forge-propose: the forge's exported GGUF becomes the role's next version, then promote."""
    role = str(args.get("specialist") or "")
    if args.get("pantheon"):                       # a pantheon mind (pantheon_view.propose): its assembly result, its Q8
        return _put_pantheon(role, str(args["pantheon"]), args, who)
    spec = forge.BY_ID.get(role)
    mine = [r for r in forge.results() if r["specialist"] == role]
    raw = {}
    if mine:
        try:
            raw = json.loads((forge.forge_dir() / "results" / mine[-1]["file"]).read_text())
        except (OSError, ValueError):
            raw = {}
    gguf = raw.get("gguf") or args.get("model")
    if not spec or not gguf or not str(gguf).endswith(".gguf") or not Path(str(gguf)).expanduser().is_file():
        return {"ok": False, "said": f"nothing was put in service: the trained {role} has no exported GGUF file ({gguf or 'none'})"}
    facts = {"base": raw.get("model") or raw.get("base"), "pairs": {"set": spec.get("pairs"), "n": raw.get("train_pairs")},
             "eval": {"set": raw.get("held_out"), "before": args.get("before") or raw.get("untrained"),
                      "after": args.get("after") or raw.get("trained")},
             "gold": raw.get("gold") or raw.get("reality") or "not measured", "result_file": mine[-1]["file"] if mine else None,
             "approved_by": who}
    version = install(role, str(gguf), facts)
    return promote(role, version, who)


def _put_pantheon(role: str, name: str, args: dict, who: str) -> dict:
    try:
        raw = json.loads((forge.forge_dir() / "results" / "pantheon" / f"{name}.json").read_text())
    except (OSError, ValueError):
        return {"ok": False, "said": f"nothing was put in service: {name} has no assembly result"}
    gguf = raw.get("gguf_q8") or raw.get("gguf")
    if not gguf or not Path(str(gguf)).expanduser().is_file():
        return {"ok": False, "said": f"nothing was put in service: {name}'s Q8 file is missing ({gguf or 'none'})"}
    facts = {"base": raw.get("base"), "pairs": {"set": f"p-{name}", "n": raw.get("pairs")},
             "eval": {"set": f"held-out {raw.get('held_out')}", "before": raw.get("untrained"), "after": raw.get("q8") or raw.get("trained")},
             "gold": "not measured", "result_file": f"pantheon/{name}.json", "approved_by": who}
    return promote(role, install(role, str(gguf), facts), who)


@router.get("/api/minds/roles")
def roles_route():
    return {"roles": roles(), "history": history(50)}
