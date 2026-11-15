"""DEPLOYS — the versions we have, the builds we kept, and putting one on her iPad (or rolling back).

His, 2026-09-24: *"deploy over the air to the iPad… check which runs we have… roll back to an older version… click
through versions that we have built to push to the iPad… kick the QA server."*

  · VERSIONS  — the git tags (beta-1.0, beta-1.0.1, …) plus `dev` and `main` as they stand.
  · BUILDS    — every build is ARCHIVED under ~/.lacuna/builds/<id>/ (the signed app + meta.json: ref, sha, build stamp,
                version, origin). A deploy installs an archived build; a rollback is a deploy of an older one — nothing
                is rebuilt under pressure.
  · DEPLOY    — her iPad over the air (toolbox/install-ipad.sh) — needs a person's confirm, always.
  · SIMULATOR — tools/env/make-studio.sh from the working tree (our own device; no confirm).
"""
from __future__ import annotations

import json
import urllib.request
import os
import re
import shutil
import time
from pathlib import Path
from typing import Optional

from .core import jobs as all_jobs, LACUNA_HOME, REPO, audit, run, start_job

TOOLBOX = Path(__file__).resolve().parents[3] / "toolbox"
XCODE = {"DEVELOPER_DIR": "/Applications/Xcode.app/Contents/Developer"}
BUILDS = LACUNA_HOME / "builds"


def versions() -> list[dict]:
    code, out = run(["git", "-C", str(REPO), "for-each-ref", "--sort=-creatordate",
                     "--format=%(refname:short)|%(objectname:short=10)|%(creatordate:unix)|%(subject)", "refs/tags"], timeout=10)
    rows = []
    for ln in out.splitlines():
        parts = ln.split("|", 3)
        if len(parts) == 4 and re.match(r"^beta-", parts[0]):   # only the iPad-era releases can be built for her iPad
            rows.append({"ref": parts[0], "sha": parts[1], "t": int(parts[2] or 0), "subject": parts[3][:140], "kind": "tag"})
    for br in ("dev", "main"):
        code, out = run(["git", "-C", str(REPO), "log", "-1", "--format=%h|%ct|%s", br], timeout=10)
        if code == 0 and out.strip():
            sha, t, subj = (out.strip().split("|", 2) + ["", ""])[:3]
            rows.insert(0, {"ref": br, "sha": sha, "t": int(t or 0), "subject": subj[:140], "kind": "branch"})
    return rows


def builds() -> list[dict]:
    out = []
    for d in sorted(BUILDS.glob("*"), reverse=True):
        m = d / "meta.json"
        if not m.exists():
            continue
        try:
            meta = json.loads(m.read_text())
        except Exception:
            continue
        meta["id"] = d.name
        meta["ok"] = (d / "CuratorShell.app").exists()
        out.append(meta)
    return out


def build(ref: str, who: str) -> dict:
    """Build `ref` (a tag, a branch, or 'working') for her iPad and archive it. A job; the page follows its log."""
    if not re.match(r"^[\w.\-/]+$", ref):
        raise ValueError("a ref is letters, numbers, dots, dashes and slashes")
    bid = time.strftime("%Y%m%d-%H%M%S-") + ref.replace("/", "_")
    j = start_job("build", f"build {ref} for the iPad", ["/bin/bash", str(TOOLBOX / "build-ipad.sh"), ref, str(BUILDS / bid)], who, cwd=REPO)
    return {"job": j.to_dict(), "build": bid}


def deploy(build_id: str, who: str, confirm: bool) -> dict:
    """Install an archived build on her iPad over the air. HERS — a person confirms, every time."""
    if not confirm:
        return {"ok": False, "needs_confirm": True, "why": "installing on the iPad needs a person to press Deploy"}
    d = BUILDS / build_id
    if not (d / "CuratorShell.app").exists():
        return {"ok": False, "why": f"no archived build {build_id}"}
    meta = json.loads((d / "meta.json").read_text())
    audit(who, "deploy.ipad", build=build_id, ref=meta.get("ref"), sha=meta.get("sha"))
    pin_build(build_id)   # a build that went to her iPad is a rollback target: the keep never prunes it (L25)
    j = start_job("deploy", f"install {meta.get('ref')} ({meta.get('build')}) on the iPad", ["/bin/bash", str(TOOLBOX / "install-ipad.sh"), str(d)], who, cwd=REPO)
    return {"ok": True, "job": j.to_dict()}


def packages() -> dict:
    """WHAT IS READY TO GO WHERE (read-only): the package on dev that QA does not have, what QA runs, what her iPad
    has, and the builds we keep. The model reads this when he says "got a new package" — it answers from facts."""
    code, log = run(["git", "-C", str(REPO), "log", "--format=%h %s", "main..dev"], timeout=10)
    commits = [l for l in log.splitlines() if l.strip()] if code == 0 else []
    _, main = run(["git", "-C", str(REPO), "rev-parse", "--short=10", "main"], timeout=5)
    _, dev = run(["git", "-C", str(REPO), "rev-parse", "--short=10", "dev"], timeout=5)
    qa = None
    try:
        with urllib.request.urlopen("http://127.0.0.1:5050/healthz", timeout=3) as r:
            qa = str(json.loads(r.read().decode()).get("sha") or "")[:10] or None
    except Exception:
        qa = None
    # FIELD NAMES SAY WHAT A THING IS (the first live answer mixed "her iPad runs" with "a build we keep"): an 8B model
    # reads names more than structure, so each fact carries its own meaning in its key.
    kept = [{"build_id": b.get("id"), "version": b.get("version"), "commit": b.get("sha"), "made": b.get("created")} for b in builds()[:5]]
    return {"waiting_on_dev_not_on_qa": {"count": len(commits), "commits": commits[:20]},
            "main_commit": main.strip(), "dev_commit": dev.strip(),
            "qa_is_running_commit": qa, "qa_matches_main": bool(qa and qa == main.strip()[:10]),
            "archived_builds_NOT_installed_anywhere_yet": kept}


def promote(who: str, build: bool = False) -> dict:
    """dev → QA through toolbox/promote.sh (gate → fast-forward main → restart QA → verify, rolling back if QA does not
    come up). HERS — called only from an approved proposal. A job; its log carries a `promote:` line per step."""
    audit(who, "promote.start", build=build)
    cmd = ["/bin/bash", str(TOOLBOX / "promote.sh")] + (["--build"] if build else [])
    j = start_job("promote", "promote dev → QA" + (" and build for the iPad" if build else ""), cmd, who, cwd=REPO)
    return {"ok": True, "job": j.to_dict()}


def release(who: str, confirm: bool, skip_pass: bool = False) -> dict:
    """THE ONE PATH dev → QA → her iPad as one job (toolbox/release.sh): the workflow pass, promote --build, install,
    and her iPad's own word that it runs the build. HERS — a person confirms, every time."""
    if not confirm:
        return {"ok": False, "needs_confirm": True, "why": "a release reaches the customer's server and the iPad — a person presses Release"}
    for j in all_jobs(20):
        if j.get("running") and j.get("kind") in ("release", "promote", "deploy", "build"):
            return {"ok": False, "why": f"a {j['kind']} job is already running ({j['title']}) — one at a time"}
    audit(who, "release.start", skip_pass=skip_pass)
    cmd = ["/bin/bash", str(TOOLBOX / "release.sh")] + (["--skip-pass"] if skip_pass else [])
    j = start_job("release", "release dev → QA → the iPad" + (" (pass skipped)" if skip_pass else ""), cmd, who, cwd=REPO)
    return {"ok": True, "job": j.to_dict()}


STEP = re.compile(r"^release: (?:(\d)/4 (.*)|(DONE.*)|(STOPPED.*))$")


def release_status() -> dict:
    """The latest release job and its stepper, read off its own `release:` lines."""
    latest = next((j for j in all_jobs(40) if j.get("kind") == "release"), None)
    if not latest:
        return {"job": None, "steps": []}
    from .core import job_tail
    steps = {n: {"n": n, "title": t, "state": "waiting"} for n, t in enumerate(("the workflow pass", "promote + build", "install on the iPad", "the iPad reports it"), 1)}
    done = stopped = None
    for ln in job_tail(latest["id"], 400).splitlines():
        m = STEP.match(ln.strip())
        if not m:
            continue
        if m.group(1):
            n = int(m.group(1)); text = m.group(2)
            steps[n]["state"] = "done" if re.match(r"(certified|SKIPPED|QA promoted|installed)", text) else "running"
            steps[n]["said"] = text[:160]
            for k in range(1, n):
                if steps[k]["state"] == "running":
                    steps[k]["state"] = "done"
        elif m.group(3):
            done = m.group(3)[6:].strip(" —")
        elif m.group(4):
            stopped = m.group(4)[9:].strip(" —")
    if done:
        for st in steps.values():
            st["state"] = "done"
    elif stopped:
        for st in steps.values():
            if st["state"] == "running":
                st["state"] = "failed"; st["said"] = stopped[:200]
    elif not latest.get("running"):
        for st in steps.values():
            if st["state"] == "running":
                st["state"] = "failed"
    return {"job": latest, "steps": list(steps.values()), "done": done, "stopped": stopped}


def simulator(who: str) -> dict:
    """Rebuild and reinstall the app in the Studio's simulator from the working tree (our device — no confirm)."""
    j = start_job("simulator", "build + install the simulator app (working tree)", ["/bin/bash", str(REPO / "tools" / "env" / "make-studio.sh")], who, cwd=REPO)
    return {"ok": True, "job": j.to_dict()}


def device(who: str) -> dict:
    """What build her iPad reports right now (read-only; asks the device over the network)."""
    # devicectl lives in Xcode, not the Command Line Tools — without DEVELOPER_DIR, `xcrun` answers "unable to find
    # utility devicectl" and this said "not on the network" for an iPad that was right there (found 2026-09-25)
    code, out = run(["xcrun", "devicectl", "list", "devices"], timeout=20, env=XCODE)
    pinned = os.environ.get("LACUNA_IPAD_UDID", "").strip()   # HER iPad, named (L30) — never "the first iPad listed"
    m = re.search(re.escape(pinned) if pinned else r"[0-9A-Fa-f]{8}-[0-9A-Fa-f]{4}-[0-9A-Fa-f]{4}-[0-9A-Fa-f]{4}-[0-9A-Fa-f]{12}",
                  "\n".join(l for l in out.splitlines() if re.search(r"ipad", l, re.I) and re.search(r"paired|connected|available", l, re.I)))
    if not m:
        return {"ok": False, "why": "the iPad is not on the network (asleep, away, or off Wi-Fi)"}
    code, apps = run(["xcrun", "devicectl", "device", "info", "apps", "--device", m.group(0)], timeout=30, env=XCODE)
    ver = next((l.split()[-1] for l in apps.splitlines() if "ai.lacunalabs.curator" in l), None)
    return {"ok": True, "device": m.group(0), "build": ver}


BUILD_ID = re.compile(r"^\d{4}\.\d{4}\.\d{4}$|^[0-9A-Za-z][\w.\-]{0,79}$")


PINNED = LACUNA_HOME / "pinned-builds.json"   # the builds that were ever installed on her iPad (newest last)


def pinned_builds() -> list[str]:
    try:
        rows = json.loads(PINNED.read_text())
        return [str(r) for r in rows] if isinstance(rows, list) else []
    except Exception:
        return []


def pin_build(build_id: str) -> None:
    rows = [r for r in pinned_builds() if r != build_id] + [build_id]
    try:
        PINNED.write_text(json.dumps(rows[-4:]))   # the last four installs are enough to roll back to
    except Exception:
        pass


def remove(build_id: str, who: str) -> dict:
    """Remove ONE archived build. `..` used to pass — the exists-check ran first and the pattern allowed dots —
    and `DELETE /api/deploys/%2E%2E` would rmtree(~/.lacuna) (L12, 2026-09-25). The name is checked whole, and
    the path it resolves to must sit directly inside the builds folder."""
    if not isinstance(build_id, str) or not BUILD_ID.fullmatch(build_id) or build_id in (".", ".."):
        return {"ok": False, "why": "not a build id"}
    d = (BUILDS / build_id)
    if not d.exists() or d.resolve().parent != BUILDS.resolve() or not d.is_dir():
        return {"ok": False, "why": "no such build"}
    shutil.rmtree(d)
    audit(who, "build.remove", build=build_id)
    return {"ok": True}
