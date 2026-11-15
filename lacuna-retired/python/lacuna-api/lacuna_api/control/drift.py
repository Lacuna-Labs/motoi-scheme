"""DRIFT — the places where what Lacuna believes and what the machine does can come apart.

His, 2026-09-24: *"make sure we don't have drift."* Checked every minute by the workers; any mismatch is an alert, and the
Control tab lists them:

  · PORTS     — each service's port here vs the port its own start script uses (tools/env/*.sh `PORT="${…:-NNNN}"`).
  · AGENTS    — each supervised service's LaunchAgent on disk vs what `supervise` would write today.
  · CODE      — each running Curator API's commit vs the branch it should be on (dev → `dev`, QA → `main`), and whether
                the source on disk changed after it started (its own code.fresh watchdog).
"""
from __future__ import annotations

import re
import time
from pathlib import Path

from . import health, services
from .core import REPO, run

BRANCH_FOR = {"dev": "dev", "qa": "main"}
QA_LINKS = ("curator-api/.env", "curator-api/.venv", "tools/speech-helper/.build", "curator-web/public/transcripts")
TREE_FOR = {"dev": None, "qa": "QA_TREE"}     # QA's own checkout must itself sit on main, clean


def _script_port(script: Path) -> int | None:
    try:
        m = re.search(r'PORT="\$\{\w+:-(\d+)\}"', script.read_text())
        return int(m.group(1)) if m else None
    except Exception:
        return None


def ports() -> list[dict]:
    out = []
    for name, s in services.SERVICES.items():
        cmd = s.get("cmd") or []
        script = next((Path(c) for c in cmd if str(c).endswith(".sh")), None)
        if not script:
            continue
        want = _script_port(script)
        if want is not None and want != s["port"]:
            out.append({"kind": "port", "service": name, "id": f"port:{name}", "value": f"{s['port']}/{want}", "detail": f"Lacuna watches :{s['port']} but {script.name} serves :{want}"})
    return out


def agents() -> list[dict]:
    out = []
    for name, s in services.SERVICES.items():
        if not s.get("cmd"):
            continue
        plist = services.AGENTS / f"{s['label']}.plist"
        if not plist.exists():
            continue
        text = plist.read_text()
        missing = [a for a in s["cmd"] if a not in text]
        if missing:
            out.append({"kind": "agent", "service": name, "id": f"agent:{name}", "value": ",".join(missing), "detail": f"its LaunchAgent does not run what Lacuna would ({', '.join(missing)[:120]}) — press Supervise again to rewrite it"})
    return out


def code() -> list[dict]:
    out = []
    for env, br in BRANCH_FOR.items():
        a = health.api_cached(env)
        sha = (a.get("healthz") or {}).get("sha")
        if not sha:
            continue
        rc, head = run(["git", "-C", str(REPO), "rev-parse", "--short=10", br], timeout=5)
        head = head.strip()
        if rc == 0 and head and not head.startswith(sha[:10]) and not sha.startswith(head[:10]):
            out.append({"kind": "code", "service": f"{env}-api", "id": f"branch:{env}", "value": f"{sha[:10]}/{head[:10]}", "detail": f"the {env} API is running commit {sha[:10]}, but branch `{br}` has moved on to {head[:10]} — a restart of the {env} API picks it up"})
    # QA's checkout: on main, at main's commit, nothing edited in it (a hand edit there is a hotfix nobody promoted)
    from .core import QA_TREE
    if QA_TREE.exists():
        rc, head = run(["git", "-C", str(QA_TREE), "rev-parse", "--abbrev-ref", "HEAD"], timeout=5)
        rc2, dirty = run(["git", "-C", str(QA_TREE), "status", "--porcelain", "--untracked-files=no"], timeout=5)
        if rc == 0 and head.strip() != "main":
            out.append({"kind": "code", "service": "qa-api", "id": "qa-tree:branch", "value": head.strip(), "detail": f"QA's checkout is on `{head.strip()}`, not main"})
        if rc2 == 0 and dirty.strip():
            out.append({"kind": "code", "service": "qa-api", "id": "qa-tree:dirty", "value": str(len(dirty.splitlines())), "detail": f"QA's checkout has {len(dirty.splitlines())} edited file(s) — promote through dev, never edit her server's tree"})
        # the untracked things QA's checkout borrows from the dev tree (git never brings them). Each one missing broke
        # something without a single error: the transcriber's build (podcast.ear), the transcript shelf (her podcast
        # card empty — workflow pass, 2026-09-25). Linked, never copied: one copy of each secret, one shelf.
        for rel in QA_LINKS:
            if not (QA_TREE / rel).exists():
                out.append({"kind": "code", "service": "qa-api", "id": f"qa-tree:link:{rel}", "value": "missing",
                            "detail": f"QA's checkout has no {rel} — `ln -s {REPO / rel} {QA_TREE / rel}`"})
    for env in BRANCH_FOR:
        for w in health.watchdogs(env):
            if w["name"] == "watch.code.fresh" and w["level"] in ("warn", "error"):
                out.append({"kind": "code", "service": f"{env}-api", "id": f"fresh:{env}", "value": "stale", "detail": f"{env}: {str(w['summary'])[:400]}"})
    return out


# ★ LACUNA WATCHES ITSELF (2026-09-26, 16:14). Its own token fix was committed at 03:56:11; the process had started at
# 03:55:57 — fourteen seconds earlier — and ran the old code for thirteen hours, so every request from his phone was
# a 500 and the console drew a blank pane. Lacuna said "drift" about the dev API all day and nothing about itself.
# The same rule now applies to the watcher: the commit it started on, and every source file's time, against now.
LACUNA_REPO = Path(__file__).resolve().parents[3]
_STARTED_AT = time.time()
_STARTED_SHA = ""
try:
    _rc0, _sha0 = run(["git", "-C", str(LACUNA_REPO), "rev-parse", "--short=10", "HEAD"], timeout=5)
    _STARTED_SHA = _sha0.strip() if _rc0 == 0 else ""
except Exception:  # noqa: BLE001 — no git, no self check; the others still run
    _STARTED_SHA = ""


def self_code() -> list[dict]:
    """Lacuna's own drift: the repo moved past the commit it started on, or a source file changed under it."""
    out = []
    # the road, never a launchd command to type (video E3, 2026-10-31: the advice was `launchctl kickstar…`, under a label retired
    # since; a restart goes through the registry's command, which refuses while the owner's turn runs)
    kick = 'lacuna restart lacuna.legacy-api --why "it runs old code"'
    if _STARTED_SHA:
        rc, head = run(["git", "-C", str(LACUNA_REPO), "rev-parse", "--short=10", "HEAD"], timeout=5)
        head = head.strip()
        if rc == 0 and head and head != _STARTED_SHA:
            out.append({"kind": "code", "service": "lacuna", "id": "lacuna:self", "value": f"{_STARTED_SHA}/{head}",
                        "detail": f"Lacuna itself is running commit {_STARTED_SHA}, but its repo has moved on to {head} — `{kick}` picks it up (its own token fix sat unrun for 13 h once, and the phone got 500s)"})
            return out
    changed = 0
    try:
        for f in (LACUNA_REPO / "lacuna-api" / "lacuna_api").rglob("*.py"):
            if f.stat().st_mtime > _STARTED_AT + 1:
                changed += 1
    except OSError:
        changed = 0
    if changed:
        out.append({"kind": "code", "service": "lacuna", "id": "lacuna:fresh", "value": str(changed),
                    "detail": f"Lacuna's source changed after it started ({changed} file(s)) — it is not running the code on disk; `{kick}` picks it up"})
    return out


def check() -> list[dict]:
    rows = []
    for fn in (ports, agents, code, self_code):
        try:
            rows += fn()
        except Exception as e:
            rows.append({"kind": "check", "service": fn.__name__, "id": f"check:{fn.__name__}", "value": "failed", "detail": f"the {fn.__name__} check failed: {e.__class__.__name__}"})
    return rows
