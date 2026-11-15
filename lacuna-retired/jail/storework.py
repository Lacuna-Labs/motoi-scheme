"""storework — the shop and cart work Claude does, for Lacuna, through the broker (2026-10-12, the owner: "wire it up
correctly to do all of the work that you were doing").

    box store live  <dev|qa> <shop>              live pieces (one per eBay item) on that API
    box store pull  <dev|qa> <shop>              eBay is the truth: pull the shop (background job)
    box carts run   <dev|qa> <shop> <slug>[,<slug>…] [item ids…]   run carts over the shop's live pieces (background)
    box carts staged <dev|qa> <shop>             what waits in the renames review, with failed checks named
    box carts accept <dev|qa> <shop> passing     accept every staged row that passed (failed rows stay for review)
    box carts send  <dev|qa> <shop> [ok=<the owner's words>]   send accepted rows to eBay (background)
    box carts verify <dev|qa> <shop>             eBay's own copy vs ours, every piece sent (background)
    box sale status <shop>                       the QA shop's markdown sale
    box sale end    <shop> ok=<the owner's words>        back it up, end it (eBay: a sale runs a day first)
    box sale restore <shop> [days] ok=<the owner's words>  the same sale again, [days] past its old end
    box store job <id> · box store jobs        a background job's log · the recent ones

Laws, enforced here: QA is her live shops — every QA write (send, sale end/restore) needs ok=… quoting the owner, and
the owner gets a push before it runs. Dev uses the eBay sandbox (sbx-<shop>), never production. Prices are never sent
by the carts; a sale restore re-creates only what was backed up.
"""
from __future__ import annotations

import json
import os
import re
import subprocess
import time
import urllib.request

HOME = os.path.expanduser("~")
TOOLS = f"{HOME}/code/curator/tools/carts"
QA_API_DIR = f"{HOME}/code/curator-qa/curator-api"
JOBS = f"{HOME}/lacuna-world/jobs/store"
API = {"dev": "http://127.0.0.1:5051", "qa": "http://127.0.0.1:5050"}
APP = {"dev": "http://127.0.0.1:3000/", "qa": "http://127.0.0.1:3100/"}
SHOP = re.compile(r"^[a-z0-9-]{3,40}$")
SLUG = re.compile(r"^[a-z0-9-]{3,80}(,[a-z0-9-]{3,80})*$")


def _login(env: str, shop: str) -> str:
    return shop if env == "qa" or shop.startswith("sbx-") else f"sbx-{shop}"


def _get(env: str, path: str):
    with urllib.request.urlopen(API[env] + path, timeout=60) as r:
        return json.load(r)


def _post(env: str, path: str, body=None, timeout=60):
    req = urllib.request.Request(API[env] + path, method="POST", data=json.dumps(body or {}).encode(),
                                 headers={"Content-Type": "application/json"})
    with urllib.request.urlopen(req, timeout=timeout) as r:
        return json.load(r)


def _notify(words: str) -> None:
    body = json.dumps({"title": "Lacuna", "body": words[:400], "level": "info"}).encode()
    req = urllib.request.Request("http://127.0.0.1:1138/api/notify/send", data=body,
                                 headers={"Content-Type": "application/json", "X-Lacuna-Who": "lacuna-companion"})
    try:
        urllib.request.urlopen(req, timeout=10).read()
    except Exception:  # noqa: BLE001
        pass


def _bg(name: str, cmd: list[str], *, cwd: str | None = None, env_extra: dict | None = None, shell: str | None = None) -> str:
    os.makedirs(JOBS, exist_ok=True)
    jid = time.strftime("%m%d-%H%M%S-") + name
    log = open(f"{JOBS}/{jid}.log", "w")
    log.write(f"$ {shell or ' '.join(cmd)}\n"); log.flush()
    env = dict(os.environ, PATH="/opt/homebrew/bin:/usr/bin:/bin", **(env_extra or {}))
    subprocess.Popen(["/bin/bash", "-c", shell] if shell else cmd, cwd=cwd, stdout=log, stderr=subprocess.STDOUT,
                     stdin=subprocess.DEVNULL, start_new_session=True, env=env)
    return f"started job {jid} — `box store job {jid}` reads it"


def _qa_python(script_args: str) -> str:
    return (f"cd {QA_API_DIR} && set -a && . ./.env && set +a && PYTHONPATH=. .venv/bin/python -W ignore {script_args} "
            f"2>&1 | grep -v '^stores.ebay'")


def _ensure_qa_app() -> None:
    try:
        urllib.request.urlopen(APP["qa"] + "healthz", timeout=3).read()
        return
    except Exception:  # noqa: BLE001
        pass
    subprocess.Popen(["/bin/bash", "-c", f"cd {HOME}/code/curator/curator-web && CURATOR_API_TARGET=http://127.0.0.1:5050 "
                      "npx vite --port 3100 --strictPort --host 127.0.0.1"], stdout=open(f"{JOBS}/vite-qa.log", "a"),
                     stderr=subprocess.STDOUT, start_new_session=True,
                     env=dict(os.environ, PATH="/opt/homebrew/bin:/usr/bin:/bin"))
    for _ in range(30):
        time.sleep(2)
        try:
            urllib.request.urlopen(APP["qa"] + "healthz", timeout=3).read()
            return
        except Exception:  # noqa: BLE001
            continue


def _ok(words: list[str]) -> str | None:
    for i, w in enumerate(words):
        if w.startswith("ok="):
            return " ".join([w[3:]] + words[i + 1:]).strip() or None
    return None


def handle(words: list[str]) -> str:
    if not words:
        return __doc__
    area, rest = words[0], words[1:]
    os.makedirs(JOBS, exist_ok=True)
    if area == "store" and rest[:1] == ["job"] and len(rest) == 2 and re.match(r"^[0-9a-z-]+$", rest[1]):
        rest = rest[1:]
        p = f"{JOBS}/{rest[0]}.log"
        return open(p).read()[-6000:] if os.path.exists(p) else "no such job"
    if area == "store" and rest == ["jobs"]:
        return "\n".join(sorted(f[:-4] for f in os.listdir(JOBS) if f.endswith(".log"))[-15:]) or "no jobs yet"
    if area == "sale":
        if len(rest) < 2 or not SHOP.match(rest[1]) or rest[0] not in ("status", "end", "restore"):
            return __doc__
        action, shop = rest[0], rest[1]
        if action == "status":
            return subprocess.run(["/bin/bash", "-c", _qa_python(f"{TOOLS}/sale.py status {shop}")],
                                  capture_output=True, text=True, timeout=120).stdout[-3000:]
        said = _ok(rest[2:])
        if not said:
            return f"a sale {action} on {shop} changes her live shop: say it with ok=<the owner's words> (he must have said so)"
        days = next((w for w in rest[2:] if w.isdigit()), "") if action == "restore" else ""
        _notify(f"Lacuna is going to {action} the {shop} sale — you said: {said[:120]}")
        return _bg(f"sale-{action}-{shop}", [], shell=_qa_python(f"{TOOLS}/sale.py {action} {shop} {days}"))
    if area not in ("store", "carts") or len(rest) < 3 or rest[1] not in API or not SHOP.match(rest[2]):
        return __doc__
    verb, env, shop = rest[0], rest[1], _login(rest[1], rest[2])
    if area == "store" and verb == "live":
        items = _get(env, f"/api/stores/anonymous/ebay/listings?account={shop}&limit=2000").get("items") or []
        live = {str(x.get("platform_listing_id")) for x in items if x.get("state") == "published" and x.get("platform_listing_id")}
        return f"{shop} on {env}: {len(live)} live pieces ({len(items)} records)"
    if area == "store" and verb == "pull":
        body = json.dumps({"operator_id": "anonymous", "force": True, "full": True, "wait": True, "account": shop})
        return _bg(f"pull-{env}-{shop}", [], shell=f"curl -s -m 1200 -X POST {API[env]}/api/stores/ebay/sync "
                   f"-H 'Content-Type: application/json' -d '{body}' | head -c 600")
    if area == "carts" and verb == "run" and len(rest) >= 4 and SLUG.match(rest[3]):
        ids = [i for i in rest[4:] if re.match(r"^[A-Za-z0-9-]+$", i)]
        if env == "qa":
            _ensure_qa_app()
        if ids:   # named pieces only: the tray's own runner over those ids
            return _bg(f"carts-{env}-{shop}", [], shell=f"cd {TOOLS} && APP={APP[env]} IDS={','.join(ids)} "
                       f"node run-carts.mjs {shop} {rest[3].replace(',', ' ')}")
        return _bg(f"carts-{env}-{shop}", [], shell=f"cd {TOOLS} && APP={APP[env]} node run-carts.mjs {shop} {rest[3].replace(',', ' ')}")
    if area == "carts" and verb == "staged":
        d = _get(env, f"/api/stores/anonymous/ebay/revisions?account={shop}")
        rows = [r for r in d.get("items") or [] if r.get("status") == "proposed"]
        fails = [r for r in rows if "fail" in (r.get("check") or {}).values()]
        lines = [f"{shop} on {env}: {d.get('counts')}", f"{len(rows)} waiting · {len(fails)} failed a check:"]
        for r in fails[:15]:
            why = [f for f in r.get("facts_missing") or [] if "checker" in f][:1]
            lines.append(f"  {r['listing_id']} {str(r['new'].get('title'))[:60]} — {why[0][:90] if why else ''}")
        return "\n".join(lines)
    if area == "carts" and verb == "accept" and rest[3:4] == ["passing"]:
        d = _get(env, f"/api/stores/anonymous/ebay/revisions?account={shop}")
        n = 0
        for r in d.get("items") or []:
            if r.get("status") == "proposed" and "fail" not in (r.get("check") or {}).values():
                req = urllib.request.Request(f"{API[env]}/api/stores/anonymous/ebay/revisions/{r['listing_id']}?account={shop}",
                                             method="PATCH", data=b'{"status":"accepted"}', headers={"Content-Type": "application/json"})
                urllib.request.urlopen(req, timeout=30).read(); n += 1
        return f"accepted {n} passing rows on {shop} ({env}); failed rows stay for review"
    if area == "carts" and verb == "send":
        if env == "qa":
            said = _ok(rest[3:])
            if not said:
                return "sending to QA writes her live eBay listings: say it with ok=<the owner's words> (he must have said so)"
            _notify(f"Lacuna is sending the accepted renames on {shop} to eBay — you said: {said[:120]}")
        return _bg(f"send-{env}-{shop}", [], shell=f"curl -s -m 7200 -X POST "
                   f"'{API[env]}/api/stores/anonymous/ebay/revisions/send?account={shop}&kind=renames' | "
                   "python3 -I -c \"import json,sys;d=json.load(sys.stdin);print(d.get('counts'),d.get('revisions'))\"")
    if area == "carts" and verb == "verify":
        return _bg(f"verify-{env}-{shop}", [], shell=f"cd {TOOLS} && API={API[env]} SINCE=0 python3 -I verify-ebay.py {shop}")
    return __doc__
