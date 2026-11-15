#!/usr/bin/env python3
"""THE BROKER — Lacuna's only door from its jail to the box (2026-10-11).

The jail refuses every local port but Ollama's and every tmux socket (lacuna.sb), so the companion cannot drive the
console or a shell outside. This small server runs OUTSIDE the jail on a unix socket the profile admits
(~/.lacuna/jail/broker.sock) and answers a fixed list — nothing else:

  look:    status · health · svc · errors [dev|qa] · logs [dev|qa] [problems] · watchdogs · jobs · job <id>
           telemetry [apis|routes|sakura|carts|strict|posters|battery] · broken (the "what's broken?" digest)
           release (the latest release and what waits on dev) · builds (the rollback targets)
  restart: dev-api · vite · speech-helper · tunnel · lacuna · ollama (its own model server)
           qa-api → NOT here: QA is the customer's server; the owner confirms it in the family chat (F4, 2026-10-11)
  build:   rebuild sim — rebuild + reinstall the simulator app from the working tree (our device)
  code:    work new|add|put|show|check|diff|status|list|drop — the workshop (workshop.py): a worktree on lacuna/<task>;
           merging into dev is the owner's "merge it" in the family chat, never a broker verb
  jobs:    posters start | status | stop — bake the cart posters with Flux (the owner: "it could have taken care of the
           rendering of the Flux images, told us when it's done"); notify <words> — a push to the owner's phone

Every request runs the audited `lacuna` command (or `launchctl kickstart` for Ollama) with arguments built HERE from
the allowlist — the client sends words, never a command line. Each request is logged to ~/.lacuna/logs/broker.log.
Protocol: one line in ("restart dev-api"), the command's output back, then the connection closes.
"""
from __future__ import annotations

import datetime
import json
import urllib.error
import os
import re
import socket
import subprocess
import urllib.request

HOME = os.path.expanduser("~")
SOCK = f"{HOME}/.lacuna/jail/broker.sock"
LOG = f"{HOME}/.lacuna/logs/broker.log"
LACUNA = "/opt/homebrew/bin/lacuna"
UID = os.getuid()

RESTART = {"dev-api", "vite", "speech-helper", "tunnel", "lacuna"}
OWNERS = {"qa-api"}
import threading as _threading
CORTEX_LOCK = _threading.Lock()   # restarts the owner confirms in the family chat; the broker only says so


HANDS_ALLOWED = (("GET", "/api/home/board"), ("POST", "/api/home/board"), ("GET", "/api/home"),
                 ("GET", "/api/foreman"), ("POST", "/api/foreman/propose"), ("DELETE", "/api/foreman/workers/"),
                 ("POST", "/api/foreman/workers/"), ("GET", "/api/reports"), ("POST", "/api/petitions"),
                 ("GET", "/api/petitions"), ("GET", "/api/mode"), ("GET", "/api/skills"),
                 # S3 (2026-10-23): the forge steward's three doors; the propose door carries the mind's name.
                 ("GET", "/api/forge/pantheon"), ("GET", "/api/automations"),
                 ("POST", "/api/forge/pantheon/"))
_PROPOSE = re.compile(r"^/api/forge/pantheon/[A-Za-z0-9_.-]+/propose$")


def hands_allowed(method: str, path: str) -> bool:
    """True when `method path` is one of Lacuna's hands; a trailing-slash entry matches by prefix. Deciding a petition never is."""
    if ".." in path or re.search(r"/api/petitions/[^/]+", path):
        return False
    for m, pth in HANDS_ALLOWED:
        if method != m:
            continue
        if pth == "/api/forge/pantheon/":
            if _PROPOSE.match(path):
                return True
        elif path == pth or (pth.endswith("/") and path.startswith(pth)):
            return True
    return False


def plan(words: list[str]) -> list[str] | None:
    """The command for a request, built from the allowlist, or None when the request is not on it."""
    if not words:
        return None
    verb, rest = words[0], words[1:]
    env = [a for a in rest if a in ("dev", "qa")]
    if verb in ("status", "health", "svc", "watchdogs", "jobs") and not rest:
        return [LACUNA, verb]
    if verb == "errors" and len(env) == len(rest) <= 1:
        return [LACUNA, "errors"] + (["--env", env[0]] if env else [])
    if verb == "logs" and set(rest) <= {"dev", "qa", "problems"} and len(env) <= 1:
        return [LACUNA, "logs"] + (["--env", env[0]] if env else []) + (["--problems"] if "problems" in rest else [])
    if verb == "restart" and len(rest) == 1:
        name = rest[0]
        if name == "ollama":
            return ["/bin/launchctl", "kickstart", "-k", f"gui/{UID}/ai.lacunalabs.ollama"]
        if name in RESTART:
            return [LACUNA, "svc", "restart", name]
    if verb == "job" and len(rest) == 1 and rest[0].replace("-", "").isalnum():
        return [LACUNA, "job", rest[0]]
    if verb == "builds" and not rest:
        return [LACUNA, "builds"]
    if verb == "release" and not rest:
        return [LACUNA, "release"]
    return None


CURATOR = f"{HOME}/code/curator"
POSTERS_LOG = f"{HOME}/.lacuna/logs/posters.log"
POSTERS_PID = f"{HOME}/.lacuna/jail/posters.pid"
# the SHARED poster folder dev and QA serve live (curator-api routes/posters.py, 2026-10-12) — a bake needs no release
POSTER_OUT = f"{HOME}/.curator-posters"
GPU_BUSY = f"{HOME}/.lacuna/jail/gpu-busy"          # readable in the jail: the router keeps Lacuna on the 8B while set
TODO = f"{CURATOR}/scratch/cart-fix/posters-todo.json"


def _running() -> int | None:
    try:
        pid = int(open(POSTERS_PID).read().strip())
        os.kill(pid, 0)
        return pid
    except Exception:
        return None


def console(method: str, path: str) -> str:
    """Lacuna's console on :1138 (read verbs, and the simulator build) — the broker asks, the jail never can."""
    import urllib.request
    req = urllib.request.Request(f"http://127.0.0.1:1138{path}", method=method, data=b"" if method == "POST" else None,
                                 headers={"X-Lacuna-Who": "lacuna-companion"})
    try:
        with urllib.request.urlopen(req, timeout=60) as r:
            return r.read().decode()[:60000]
    except Exception as e:
        return f"the console did not answer: {e}"


def notify(words: str) -> str:
    import json
    import urllib.request
    body = json.dumps({"title": "Lacuna", "body": words[:400], "level": "info", "key": f"lacuna:{words[:40]}"}).encode()
    req = urllib.request.Request("http://127.0.0.1:1138/api/notify/send", data=body,
                                 headers={"Content-Type": "application/json", "X-Lacuna-Who": "lacuna-companion"})
    try:
        with urllib.request.urlopen(req, timeout=10) as r:
            return "sent: " + r.read().decode()[:200]
    except Exception as e:
        return f"could not send: {e}"


def posters(action: str) -> str:
    import json
    os.makedirs(POSTER_OUT, exist_ok=True)
    have = len([f for f in os.listdir(POSTER_OUT) if f.endswith(".webp")])
    todo = len(json.load(open(TODO))) if os.path.exists(TODO) else 0
    pid = _running()
    if action == "remaining":
        # for a job's check-in: how much of tonight's queue is still missing, machine-readable
        queue = json.load(open(TODO)) if os.path.exists(TODO) else []
        left = sum(1 for s in queue if not os.path.exists(f"{POSTER_OUT}/{s}.webp"))
        return json.dumps({"total": len(queue), "remaining": left, "baking": bool(pid)})
    if action == "status":
        tail = ""
        if os.path.exists(POSTERS_LOG):
            tail = "".join(open(POSTERS_LOG).readlines()[-3:])
        return (f"{'baking (pid ' + str(pid) + ')' if pid else 'not running'} · {have} posters on disk · {todo} were "
                f"queued tonight\n{tail}")
    if action == "stop":
        if not pid:
            return "not running"
        try:
            os.killpg(pid, 15)   # the painter too, not only the shell around it (it runs in its own session)
        except OSError:
            os.kill(pid, 15)
        for f in (POSTERS_PID, GPU_BUSY):
            if os.path.exists(f):
                os.unlink(f)
        return f"stopped (pid {pid}); {have} posters on disk"
    if action == "start":
        if pid:
            return f"already baking (pid {pid})"
        if not os.path.exists(TODO):
            return "no poster list (scratch/cart-fix/posters-todo.json) — ask Claude to build it"
        open(GPU_BUSY, "w").write("posters\n")
        for _m in ("lacuna-27b", "lacuna"): subprocess.run(["/opt/homebrew/bin/ollama", "stop", _m], capture_output=True, timeout=30)
        # the bake skips posters already on disk, so a stop and a start resume where it left off; when it ends it
        # clears the GPU flag and pushes the count to the owner's phone
        script = (f'cd "{CURATOR}" && SLUGS=$(python3 -c "import json;print(\',\'.join(json.load(open(\'{TODO}\'))))") && '
                  f'OUTDIR="{POSTER_OUT}" QUANTIZE=8 node scripts/bake-cart-posters.mjs --slugs "$SLUGS" >> "{POSTERS_LOG}" 2>&1; '
                  f'rm -f "{GPU_BUSY}" "{POSTERS_PID}"; '
                  f'N=$(ls "{POSTER_OUT}" | grep -c webp); '
                  f'curl -s -m 10 -H "Content-Type: application/json" -H "X-Lacuna-Who: lacuna-companion" '
                  f'-d "{{\\"title\\":\\"Lacuna\\",\\"body\\":\\"The posters are done — $N on disk.\\",\\"level\\":\\"info\\"}}" '
                  f'http://127.0.0.1:1138/api/notify/send > /dev/null')
        p = subprocess.Popen(["/bin/bash", "-c", script], start_new_session=True,
                             stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        open(POSTERS_PID, "w").write(str(p.pid))
        return f"baking started (pid {p.pid}); {have} on disk, {todo} queued; the 27B is resting until it's done"
    return "posters start | status | stop | remaining"


# ── THE BATTERY AND THE SIMULATOR (the owner, 2026-10-11: "it can open the simulator, close it, do stuff on the screen,
# run the battery… it's an SRE"). Dev and the simulator only; the probe's actions are fixed in the curator repo
# (tools/battery/simprobe.py) — the jail sends a word, never a script.
BATTERY_LOG = f"{HOME}/.lacuna/logs/battery.log"
BATTERY_PID = f"{HOME}/.lacuna/jail/battery.pid"
VENV_PY = f"{CURATOR}/curator-api/.venv/bin/python"
SIMPROBE = f"{CURATOR}/tools/battery/simprobe.py"


def _pid_alive(path: str) -> int | None:
    try:
        pid = int(open(path).read().strip())
        os.kill(pid, 0)
        return pid
    except Exception:
        return None


def battery(action: str) -> str:
    pid = _pid_alive(BATTERY_PID)
    tail = "".join(open(BATTERY_LOG).readlines()[-25:]) if os.path.exists(BATTERY_LOG) else ""
    if action == "status":
        return f"{'running (pid ' + str(pid) + ')' if pid else 'not running'}\n{tail}"
    if action == "stop":
        if not pid:
            return "not running"
        try:
            os.killpg(pid, 15)
        except Exception:
            os.kill(pid, 15)
        return f"stopped (pid {pid}) — the pass's own trap puts dev's shop data back"
    if action == "start":
        if pid:
            return f"already running (pid {pid})"
        if _running():
            return "the poster bake is running — the battery and the painter do not fit together; stop it first"
        env = {**os.environ, "DEVELOPER_DIR": "/Applications/Xcode.app/Contents/Developer"}
        script = (f'cd "{CURATOR}" && tools/workflow/pass.sh > "{BATTERY_LOG}" 2>&1; echo "exit=$?" >> "{BATTERY_LOG}"; '
                  f'rm -f "{BATTERY_PID}"; V=$(grep -E "passed" "{BATTERY_LOG}" | tail -1 | sed "s/^ *//"); '
                  f'curl -s -m 10 -H "Content-Type: application/json" -H "X-Lacuna-Who: lacuna-companion" '
                  f'-d "{{\\"title\\":\\"Lacuna\\",\\"body\\":\\"The battery is done: $V\\",\\"level\\":\\"info\\"}}" '
                  f'http://127.0.0.1:1138/api/notify/send > /dev/null')
        p = subprocess.Popen(["/bin/bash", "-c", script], start_new_session=True, env=env,
                             stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        open(BATTERY_PID, "w").write(str(p.pid))
        return f"battery started (pid {p.pid}) — about 45 minutes; `box battery status` reads its progress"
    return "battery start | status | stop"


def sim(words: list[str]) -> str:
    if words[:1] in (["look"], ["cards"], ["close"], ["restart"]) and len(words) == 1:
        args = words
    elif words[:1] == ["open"] and len(words) == 2:
        args = words
    else:
        return "sim look | cards | open <card-id> | close | restart"
    r = subprocess.run([VENV_PY, SIMPROBE, *args], capture_output=True, text=True, timeout=60)
    return (r.stdout or r.stderr or "(no answer)")[:8000]


_held = {"p": None}


def _cortex_held(argv: list, body: bytes, key: str):
    """THE STORE HELD OPEN (C11): one long-lived `cortex.py --serve` (the Rust store opened once); a dead or stuck one is
    started again; None when it cannot answer, and the caller falls back to a process for the call."""
    import base64, select
    for attempt in (1, 2):
        p = _held["p"]
        if p is None or p.poll() is not None:
            try:
                p = subprocess.Popen([os.path.expanduser("~/code/curator/curator-api/.venv/bin/python"),
                                      os.path.expanduser("~/.lacuna/jail/cortex.py"), "--serve"],
                                     stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=subprocess.DEVNULL,
                                     env={**os.environ, "CURATOR_CORTEX_KEY": key})
                _held["p"] = p
            except OSError:
                return None
        try:
            p.stdin.write((json.dumps({"argv": argv, "body": base64.b64encode(body or b"").decode()}) + "\n").encode())
            p.stdin.flush()
            ready, _, _ = select.select([p.stdout], [], [], 120)
            line = p.stdout.readline() if ready else b""
            if line:
                return json.loads(line).get("answer", "")
        except (OSError, ValueError):
            pass
        try:
            p.kill()
        except OSError:
            pass
        _held["p"] = None
    return None


def log(line: str) -> None:
    os.makedirs(os.path.dirname(LOG), exist_ok=True)
    with open(LOG, "a") as f:
        f.write(f"{datetime.datetime.now().isoformat(timespec='seconds')} {line}\n")


def watch_the_runner() -> None:
    """The watchdog's watchdog: the errand runner stamps a heartbeat every minute; if it stops, nothing else would
    notice (every errand goes quiet with it), so the broker — a separate, always-on process — pushes once an hour."""
    import json
    import time
    beat = f"{HOME}/lacuna-world/jobs/.heartbeat.json"
    last_push = 0.0
    while True:
        time.sleep(300)
        try:
            tick = json.load(open(beat)).get("tick", 0)
        except (OSError, ValueError):
            tick = 0
        silent = time.time() - tick
        if silent > 600 and time.time() - last_push > 3600:
            log(f"runner silent {int(silent // 60)} min — pushing")
            notify(f"The errand runner has been silent for {int(silent // 60)} minutes — errands are not being kept "
                   "going. Fix: launchctl kickstart -k gui/$(id -u)/ai.lacunalabs.lacuna-jobs")
            last_push = time.time()


def serve() -> None:
    if os.path.exists(SOCK):
        os.unlink(SOCK)
    s = socket.socket(socket.AF_UNIX, socket.SOCK_STREAM)
    s.bind(SOCK)
    os.chmod(SOCK, 0o600)
    s.listen(4)
    log("broker up")
    import threading as _th
    while True:
        conn, _ = s.accept()
        # ONE THREAD PER REQUEST (1.3, 2026-10-17): a slow request (a check, an embedding behind a busy GPU) held every
        # other one — `cortex counts` waited 23 s behind an episode write. Cortex writes share one lock (cortex_lock).
        _th.Thread(target=_serve_one, args=(conn,), daemon=True).start()


def _serve_one(conn) -> None:
    if True:
        with conn:
            try:
                head = b""
                while b"\n" not in head and len(head) < 2048:
                    chunk = conn.recv(2048)
                    if not chunk:
                        break
                    head += chunk
                line, _, body = head.partition(b"\n")
                raw = line.decode("utf-8", "replace").strip()
                words = raw.split()
                if words[:1] == ["work"]:
                    import importlib, workshop
                    importlib.reload(workshop)   # an edit to the workshop takes effect without a broker restart
                    if words[1:2] == ["put"] and len(words) == 5 and words[4].isdigit():
                        need = min(int(words[4]), 2_000_000)
                        while len(body) < need:
                            chunk = conn.recv(65536)
                            if not chunk:
                                break
                            body += chunk
                        words = words[:4]
                    log(f"work: {raw[:160]!r}")
                    conn.sendall((workshop.handle(words[1:], body) + "\n").encode()[:400_000])
                    return
                if words[:1] == ["hands"] and len(words) >= 3 and words[-1].isdigit():
                    # LACUNA'S HANDS FROM THE JAIL (2026-10-18): Pi may not reach :1138 or :1139 itself; these doors, and
                    # ONLY these, go through here: the desk's board, the foreman's workers, the reports, filing a permission
                    # card. Deciding a card (the person's press) is not on the list and never will be.
                    need = min(int(words[-1]), 200_000)
                    while len(body) < need:
                        chunk = conn.recv(65536)
                        if not chunk:
                            break
                        body += chunk
                    method, path = words[1].upper(), words[2]
                    ok = hands_allowed(method, path)
                    if not ok:
                        conn.sendall(b'{"ok": false, "why": "that door is not one of Lacuna\'s hands"}\n')
                        return
                    log(f"hands: {method} {path}")
                    try:
                        req = urllib.request.Request("http://127.0.0.1:1138" + path, method=method,
                                                     data=body[:need] if method in ("POST", "PUT") else None,
                                                     headers={"Content-Type": "application/json", "X-Lacuna-Who": "lacuna"})
                        with urllib.request.urlopen(req, timeout=180) as r:
                            conn.sendall(r.read()[:400_000] + b"\n")
                    except urllib.error.HTTPError as e:
                        conn.sendall(e.read()[:4000] + b"\n")
                    except Exception as e:  # noqa: BLE001
                        conn.sendall(json.dumps({"ok": False, "why": f"{e.__class__.__name__}"}).encode() + b"\n")
                    return
                if words[:1] == ["models"] and len(words) in (2, 3) and words[1] in ("load", "unload", "list"):
                    # THE DESK LOADS AND UNLOADS THE OTHERS (2.0 §4): by seat name, within the box profile, never a third big brain
                    try:
                        with open(os.path.expanduser("~/.lacuna/box.json")) as f:
                            box = json.load(f)
                        seats = box["seats"]
                        if words[1] == "list":
                            answer = subprocess.run(["/opt/homebrew/bin/ollama", "ps"], capture_output=True, text=True, timeout=10).stdout
                        else:
                            seat = words[2] if len(words) == 3 else ""
                            if seat not in seats:
                                answer = f"no seat {seat!r}; seats: {', '.join(seats)}"
                            elif words[1] == "unload":
                                subprocess.run(["/opt/homebrew/bin/ollama", "stop", seats[seat]["model"]], capture_output=True, timeout=30)
                                answer = f"{seat} ({seats[seat]['model']}) unloaded"
                            else:
                                big = [k for k, s in seats.items() if s["gb"] > 10 and k != seat]
                                ps = subprocess.run(["/opt/homebrew/bin/ollama", "ps"], capture_output=True, text=True, timeout=10).stdout
                                loaded_big = [k for k in big if seats[k]["model"] in ps]
                                if seats[seat]["gb"] > 10 and loaded_big and box.get("memory_rules", {}).get("one_big_at_a_time", True):
                                    answer = f"no: {', '.join(loaded_big)} is loaded and the box runs one big brain at a time — `box models unload {loaded_big[0]}` first, or wait for its step"
                                else:
                                    s = seats[seat]
                                    body = json.dumps({"model": s["model"], "prompt": "", "keep_alive": s.get("keep_alive", "30m"), "options": {"num_ctx": s.get("ctx", 32768)}}).encode()
                                    urllib.request.urlopen(urllib.request.Request("http://127.0.0.1:11434/api/generate", data=body, headers={"Content-Type": "application/json"}), timeout=600).read()
                                    answer = f"{seat} ({s['model']}) loaded for {s.get('keep_alive', '30m')}"
                    except Exception as e:  # noqa: BLE001
                        answer = f"models: {e.__class__.__name__}: {e}"
                    log(f"models: {raw[:80]!r} → {answer[:80]!r}")
                    conn.sendall((answer + "\n").encode())
                    return
                if words[:1] == ["open"] and len(words) == 2:
                    # "build me a dashboard … and it opens in Safari": only a page in Lacuna's world or a localhost URL
                    target = words[1]
                    okp = target.startswith(os.path.expanduser("~/lacuna-world/")) and target.endswith((".html", ".htm"))
                    oku = re.match(r"^http://(127\.0\.0\.1|localhost)(:\d+)?/", target) is not None
                    if okp or oku:
                        subprocess.run(["/usr/bin/open", "-a", "Safari", target], timeout=20)
                        answer = f"opened {target} in Safari"
                    else:
                        answer = "open takes a page under ~/lacuna-world/ or a localhost URL"
                    log(f"open: {target}")
                    conn.sendall((answer + "\n").encode())
                    return
                if words[:1] == ["lease"]:
                    import importlib, lease
                    importlib.reload(lease)
                    log(f"lease: {raw[:120]!r}")
                    conn.sendall((lease.handle(words[1:]) + "\n").encode())
                    return
                if words[:1] == ["cortex-argv"] and len(words) == 2 and words[1].isdigit():
                    # THE FRAMED FORM (2026-10-18): `cortex-argv <n>` then n bytes of a JSON argv. A repair's diff has
                    # newlines and a report can pass 2 KB: the one-line form tore both and the memory was lost silently.
                    need = min(int(words[1]), 4_000_000)
                    while len(body) < need:
                        chunk = conn.recv(65536)
                        if not chunk:
                            break
                        body += chunk
                    try:
                        argv = [str(a) for a in json.loads(body[:need].decode("utf-8", "replace"))]
                    except ValueError:
                        conn.sendall(b'{"ok": false, "error": "cortex-argv: the argv was not JSON"}\n')
                        return
                    words, body, raw = ["cortex", *argv], b"", "cortex " + " ".join(argv)[:200]
                if words[:1] == ["cortex"]:
                    # the Rust store is built for the product venv's Python (3.12); this broker runs the system one —
                    # so the cortex is a subprocess under that venv, holding Lacuna's own sealing key (never in the jail)
                    log(f"cortex: {raw[:120]!r}")
                    try:
                        with open(os.path.expanduser("~/.lacuna/secrets/cortex-key")) as kf:
                            key = kf.read().strip()
                        with CORTEX_LOCK:   # one writer at a time
                          answer = _cortex_held(words[1:], body, key)
                          if answer is None:   # the held store is not answering: the old way, a process for this call
                            out = subprocess.run([os.path.expanduser("~/code/curator/curator-api/.venv/bin/python"),
                                                  os.path.expanduser("~/.lacuna/jail/cortex.py"), *words[1:]],
                                                 input=body, capture_output=True, timeout=120,
                                                 env={**os.environ, "CURATOR_CORTEX_KEY": key})
                            answer = (out.stdout or out.stderr or b"").decode("utf-8", "replace").strip()
                    except Exception as e:  # noqa: BLE001
                        answer = json.dumps({"ok": False, "error": f"cortex: {e.__class__.__name__}: {e}"[:200]})
                    conn.sendall((answer + "\n").encode()[:400_000])
                    return
                if words[:1] in (["store"], ["carts"], ["sale"]):
                    import importlib, storework
                    importlib.reload(storework)   # like the workshop: an edit takes effect without a broker restart
                    log(f"store: {raw[:160]!r}")
                    conn.sendall((storework.handle(words) + "\n").encode()[:400_000])
                    return
                if words[:1] == ["telemetry"] and len(words) <= 2:
                    part = f"?part={words[1]}" if len(words) == 2 and words[1].isalpha() else ""
                    conn.sendall((console("GET", f"/api/telemetry{part}") + "\n").encode())
                    return
                if words == ["broken"]:
                    conn.sendall((console("GET", "/api/telemetry/broken") + "\n").encode())
                    return
                if words == ["rebuild", "sim"]:
                    log("rebuild sim")
                    conn.sendall((console("POST", "/api/deploys/simulator") + "\n").encode())
                    return
                if words[:1] == ["restart"] and words[1:] and words[1] in OWNERS:
                    log(f"asked the owner: {raw!r}")
                    conn.sendall(b"QA is the customer's server: the owner confirms that restart in the family chat "
                                 b"(Lacuna \xc2\xb7 House: 'restart qa', then 'confirm restart qa').\n")
                    return
                if words[:1] == ["posters"] and len(words) == 2:
                    log(f"posters {words[1]}")
                    conn.sendall((posters(words[1]) + "\n").encode())
                    return
                if words[:1] == ["battery"] and len(words) == 2:
                    log(f"battery {words[1]}")
                    conn.sendall((battery(words[1]) + "\n").encode())
                    return
                if words[:1] == ["sim"]:
                    log(f"sim: {raw[:80]!r}")
                    conn.sendall((sim(words[1:]) + "\n").encode())
                    return
                if words[:1] == ["notify"] and len(words) > 1:
                    log(f"notify: {raw[7:120]!r}")
                    conn.sendall((notify(raw[7:]) + "\n").encode())
                    return
                cmd = plan(words)
                if cmd is None:
                    log(f"refused: {raw[:120]!r}")
                    conn.sendall(b"not on the list. Ask for: status, health, svc, errors [dev|qa], logs [dev|qa] [problems], "
                                 b"watchdogs, jobs, job <id>, telemetry [part], broken, release, builds, rebuild sim, sim look|cards|open <id>|close|restart, battery start|status|stop, work ..., posters start|status|stop, notify <words>, store|carts|sale ... (box store for the list), or restart dev-api|vite|speech-helper|tunnel|lacuna|ollama\n")
                    return
                log(f"ran: {' '.join(cmd)}")
                r = subprocess.run(cmd, capture_output=True, text=True, timeout=120)
                out = (r.stdout or "") + (r.stderr or "") or "(no output)\n"
                if words == ["status"]:
                    # the box as the one on call sees it: who holds the GPU, what is loaded, how tight memory is (2.0 §6)
                    try:
                        import importlib, lease
                        importlib.reload(lease)
                        ps = subprocess.run(["/opt/homebrew/bin/ollama", "ps"], capture_output=True, text=True, timeout=10).stdout.splitlines()[1:]
                        loaded = ", ".join(f"{l.split()[0]} ({l.split()[2]} {l.split()[3]})" for l in ps if l.split()) or "nothing"
                        mp = subprocess.run(["/usr/bin/memory_pressure"], capture_output=True, text=True, timeout=10).stdout
                        free = next((l.split(":")[1].strip() for l in mp.splitlines() if "free percentage" in l), "?")
                        sw = subprocess.run(["/usr/sbin/sysctl", "-n", "vm.swapusage"], capture_output=True, text=True, timeout=10).stdout.strip()
                        used = sw.split("used = ")[1].split()[0] if "used = " in sw else "?"
                        out += f"\n{lease.status()}\nloaded: {loaded}\nmemory: {free} free · swap used {used}\n"
                    except Exception as e:  # noqa: BLE001
                        out += f"\n(lease/memory line unavailable: {e})\n"
                conn.sendall(out.encode()[:200_000])
            except Exception as e:  # one bad request never takes the broker down
                log(f"error: {e.__class__.__name__}: {e}")
                try:
                    conn.sendall(f"the broker could not do that: {e}\n".encode())
                except OSError:
                    pass


if __name__ == "__main__":
    import sys
    import threading
    sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
    threading.Thread(target=watch_the_runner, daemon=True).start()
    serve()
