"""SMALL MINDS — the small Gemmas served by llama.cpp beside the brain, started on demand (2026-10-18).

Ollama runs the small Gemmas fine but cannot decode under a GBNF grammar, and a foreman's small mind is fenced BY its
grammar (design §36: a verb outside the grammar cannot be emitted). So the gateway serves each small Gemma from its own
`llama-server`, reading the very GGUF Ollama pulled (no second copy of the weights): started on the first request, kept
warm while it is used, stopped after it sits idle. Two guards keep it from crowding the 26B on a 32 GB box: at most
MIND_MAX servers at once, and none starts unless the memory left after loading stays above MIND_MEM_FLOOR_MB.
A model llama.cpp cannot load is remembered and served by Ollama instead (the response header says so).
"""
from __future__ import annotations

import hashlib
import json
import os
import signal
import socket
import struct
import subprocess
import threading
import time
import urllib.request

import gguf_mend

HERE = os.path.dirname(os.path.abspath(__file__))
LLAMA_SERVER = os.environ.get("LLAMA_SERVER", "/opt/homebrew/bin/llama-server")      # the brain plist's binary
OLLAMA_MODELS = os.path.expanduser(os.environ.get("OLLAMA_MODELS", "~/.ollama/models"))
MINDS_HOME = os.path.expanduser(os.environ.get("MINDS_HOME", "~/.lacuna/minds"))
LOGS = os.path.expanduser("~/.lacuna/logs")
FIRST_PORT = int(os.environ.get("MIND_FIRST_PORT", "8092"))                           # 8091 is the brain
MIND_MAX = int(os.environ.get("MIND_MAX", "3"))
IDLE_S = float(os.environ.get("MIND_IDLE_S", str(10 * 60)))
FLOOR = int(os.environ.get("MIND_MEM_FLOOR_MB", "512")) * 2**20
SLOT_CTX = 8192                                                                       # per slot; two slots
# the box's profile says which small Gemmas may be an agent's mind here (box-minds.json, beside this file): with the 26B
# loaded, agents stop at 2B; a reserved model is refused with its reason, never served
PROFILE_PATH = os.environ.get("MIND_PROFILE", os.path.join(HERE, "box-minds.json"))
# the CURRENT brain is not configuration: switch-brain.sh writes it to ~/.lacuna/brain-profile.json and never to the tracked
# box-minds.json (order §1.5, 2026-11-06); its fields override the box file's
BRAIN_PROFILE_PATH = os.environ.get("MIND_BRAIN_PROFILE", os.path.expanduser("~/.lacuna/brain-profile.json"))
BRAIN_FIELDS = ("brain", "brain_files", "brain_kv_gb", "max_params_b", "workhorse")   # the same five as the foreman's cascade.mjs


def profile() -> dict:
    try:
        with open(PROFILE_PATH) as f:
            p = json.load(f)
    except (OSError, ValueError):
        p = {"agent_minds": ["functiongemma", "gemma3:270m-it-qat", "gemma3:1b-it-qat"], "reserved": {}}
    try:
        with open(BRAIN_PROFILE_PATH) as f:
            bp = json.load(f)
    except (OSError, ValueError):
        bp = {}
    if bp.get("file") and not bp.get("brain_files"):           # a profile written before 2026-11-06 names its one file
        bp["brain_files"] = [bp["file"]]
    p.update({k: bp[k] for k in BRAIN_FIELDS if bp.get(k) is not None})
    return p


SMALL_NAMES = os.environ.get("MIND_NAMES", ",".join(profile().get("agent_minds", [])))


def weight(name: str) -> float:
    """GB of the small-mind budget a model takes: measured from its own files (weights + projector + working margin, the
    same estimate the memory guard uses); box-minds.json `weights_gb` only overrides a model it names."""
    over = profile().get("weights_gb", {})
    if name in over or canon(name) in over:
        return float(over.get(name) or over.get(canon(name)))
    res = resolve(name)
    return round(need_bytes(res) / 2**30, 2) if res else 1.0


def total_ram_gb() -> float:
    try:
        return int(subprocess.run(["sysctl", "-n", "hw.memsize"], capture_output=True, text=True, timeout=5).stdout) / 2**30
    except (OSError, ValueError, subprocess.SubprocessError):
        return 0.0


def brain_gb() -> float:
    """The brain's footprint: its own model files (the GGUF + projector the brain plist loads) plus its KV cache."""
    p = profile()
    files = [os.path.expanduser(f) for f in p.get("brain_files", [])]
    size = sum(os.path.getsize(f) for f in files if os.path.exists(f)) / 2**30
    return size + float(p.get("brain_kv_gb", 3))


def mind_budget() -> float:
    """GB the small minds may share beside the brain, COMPUTED from this box (the owner, 2026-10-18: "algorithmic by
    memory … so if we ever increase, we never have to hard-code it"): total RAM − the brain − a reserve for macOS, the
    apps and the dev stack (box-minds.json `reserve_gb`). A number in `mind_budget_gb` pins it instead."""
    p = profile()
    if isinstance(p.get("mind_budget_gb"), (int, float)):
        return float(p["mind_budget_gb"])
    return max(0.0, round(total_ram_gb() - brain_gb() - float(p.get("reserve_gb", 10)), 1))


def reserved_why(name: str) -> str | None:
    """Why this box keeps a model out of the agents' reach, or None when it may be a mind."""
    r = profile().get("reserved", {})
    return r.get(name) or r.get(canon(name))

# Google's sampling for every Gemma card we saved (temperature 1.0, top_k 64, top_p 0.95); a caller's own value wins
GEMMA_SAMPLING = {"temperature": 1.0, "top_k": 64, "top_p": 0.95}
# Ollama writes Gemma GGUFs without `add_space_prefix`, and llama.cpp's default (true) puts a space after every special
# token, which garbles the prompt; FunctionGemma also ends a call with <start_function_response> (id 50), which Ollama
# lists as an end token and llama.cpp does not, and its blob carries no chat template at all.
FAMILIES = {
    "functiongemma": {"template": os.path.join(HERE, "functiongemma.jinja"), "special": True,
                      "overrides": "tokenizer.ggml.add_space_prefix=bool:false,tokenizer.ggml.eot_token_id=int:50"},
    "gemma3": {"overrides": "tokenizer.ggml.add_space_prefix=bool:false"},
    "shieldgemma": {"overrides": "tokenizer.ggml.add_space_prefix=bool:false"},
    "gemma4": {},
}


def canon(name: str | None) -> str:
    n = str(name or "")
    return n if ":" in n else n + ":latest"


def family(name: str) -> str:
    r = role_entry(name)
    return (r.get("family") or "gemma3") if r else canon(name).split(":")[0].split("/")[-1]


def role_entry(name: str | None) -> dict | None:
    """A trained mind in service under its role's name (box-minds.json `roles`: {"sentry": {"model": <GGUF path or a
    served name>, "version": "v3", "previous": "v2", "family": "gemma3"}}) — the forge's promote writes it (roles.py)."""
    roles = profile().get("roles") or {}
    r = roles.get(str(name or "").removesuffix(":latest"))
    return r if isinstance(r, dict) and r.get("model") else None


def manifest_path(name: str) -> str:
    repo, tag = canon(name).split(":", 1)
    if "/" not in repo:
        repo = "library/" + repo
    return os.path.join(OLLAMA_MODELS, "manifests", "registry.ollama.ai", repo, tag)


def resolve(name: str) -> dict | None:
    """The GGUF (and vision projector) Ollama keeps for a model name, from its manifest — or None if not pulled. A role
    resolves to its current version; a path to a .gguf file is served as it is (a trained mind: its own file)."""
    r = role_entry(name)
    if r:
        name = r["model"]
    path = os.path.expanduser(str(name or "").removesuffix(":latest"))
    if path.endswith(".gguf"):
        try:
            size = os.path.getsize(path)
        except OSError:
            return None
        return {"model": {"path": path, "size": size, "digest": "file-" + hashlib.sha256(path.encode()).hexdigest()[:16]}}
    try:
        with open(manifest_path(name)) as f:
            layers = json.load(f).get("layers") or []
    except (OSError, ValueError):
        return None
    out = {}
    for layer in layers:
        kind = layer.get("mediaType", "").rsplit(".", 1)[-1]
        if kind in ("model", "projector") and kind not in out:
            blob = os.path.join(OLLAMA_MODELS, "blobs", layer["digest"].replace(":", "-"))
            out[kind] = {"path": blob, "size": int(layer.get("size") or 0), "digest": layer["digest"]}
    if "model" in out and out.get("projector") and (name in TEXT_ONLY() or canon(name) in TEXT_ONLY()):
        out.pop("projector")                     # text-only on this box: the eyes/ears part never loads beside the brain
    return out if "model" in out else None


def TEXT_ONLY() -> list:
    """Agent minds served WITHOUT their vision/audio projector (box-minds.json `text_only`): E2B's text model is 3.26 GB,
    its projector 0.92 GB — text-only it fits the budget beside the 26B with room for one tiny mind (the owner,
    2026-10-18: never two big minds resident; the reserve stays)."""
    return list(profile().get("text_only") or [])


def small_names(brain_names: set) -> list:
    """The small minds this box has pulled; a name the brain answers for (the owner's one-brain rule) is not one."""
    out = []
    for n in [*(s.strip() for s in SMALL_NAMES.split(",") if s.strip()), *(profile().get("roles") or {})]:
        if n in brain_names or canon(n) in brain_names:
            continue
        if resolve(n):
            out.append(canon(n))
    return out


def available_bytes() -> int:
    """Memory macOS can hand out without swapping: free + inactive + speculative + purgeable pages (vm_stat)."""
    try:
        text = subprocess.run(["/usr/bin/vm_stat"], capture_output=True, text=True, timeout=5).stdout
    except (OSError, subprocess.SubprocessError):
        return 0
    page = int(text.split("page size of", 1)[1].split()[0]) if "page size of" in text else 16384
    pages = 0
    for line in text.splitlines():
        key, _, val = line.partition(":")
        if key.strip() in ("Pages free", "Pages inactive", "Pages speculative", "Pages purgeable"):
            pages += int(val.strip().rstrip(".") or 0)
    return pages * page


def need_bytes(res: dict) -> int:
    """Weights + projector + a margin for the small KV cache and compute buffers."""
    return res["model"]["size"] + (res.get("projector") or {}).get("size", 0) + 384 * 2**20


def port_free(port: int) -> bool:
    with socket.socket() as s:
        try:
            s.bind(("127.0.0.1", port))
            return True
        except OSError:
            return False


def rss_bytes(pid: int) -> int:
    try:
        out = subprocess.run(["/bin/ps", "-o", "rss=", "-p", str(pid)], capture_output=True, text=True, timeout=5).stdout
        return int(out.strip() or 0) * 1024
    except (OSError, ValueError, subprocess.SubprocessError):
        return 0


class Refused(Exception):
    """A small mind was not started, for a reason a person can read (memory, the server limit)."""


class CannotLoad(Exception):
    """llama.cpp could not load this model; Ollama serves it instead."""


class Mind:
    def __init__(self, name: str, port: int, proc, now: float):
        self.name, self.port, self.proc = name, port, proc
        self.last_used, self.in_flight = now, 0

    @property
    def url(self) -> str:
        return f"http://127.0.0.1:{self.port}"

    def alive(self) -> bool:
        return self.proc.poll() is None


# G18 ONE BASE, MANY ADAPTERS (Sprint 2, measured 2026-10-19): the forge's LoRA adapters (mlx_lora_to_gguf.py) load into
# their base's one server, unapplied; a request names its adapter and only that one is applied. The 270M alone: 404 MB;
# with six adapters: 498 MB — ~15 MB a specialist, where six servers would hold 2.4 GB.
ADAPTERS = os.path.expanduser(os.environ.get("LACUNA_ADAPTERS", "~/lacuna-world/forge/adapters/gguf"))
LOADED: dict[str, list[str]] = {}                   # model → the adapter files its running server loaded, in order


def adapters_for(name: str) -> list[str]:
    d = os.path.join(ADAPTERS, canon(name).replace(":", "-"))
    try:
        return sorted(os.path.join(d, f) for f in os.listdir(d) if f.endswith(".gguf"))
    except OSError:
        return []


def adapter_id(name: str, adapter: str) -> int | None:
    """The server's index of an adapter by its name (the file's stem), as the running server loaded them."""
    for i, f in enumerate(LOADED.get(canon(name), LOADED.get(name, []))):
        if os.path.basename(f).removesuffix(".gguf") == adapter:
            return i
    return None


class Pool:
    """The running small servers. `clock`, `spawn`, `ready` and `memory` are seams the tests replace."""

    def __init__(self, clock=time.monotonic, spawn=None, ready=None, memory=available_bytes):
        self.clock, self.memory = clock, memory
        self.spawn = spawn or self._spawn
        self.ready = ready or self._ready
        self.minds: dict[str, Mind] = {}
        self.cannot: dict[str, str] = {}             # canon name → why llama.cpp refused it (served by Ollama instead)
        self.lock = threading.Lock()
        self.starting: dict[str, threading.Lock] = {}
        self.pending: set = set()                     # names being started right now (they count against MIND_MAX)

    # ── what callers use ──
    def acquire(self, name: str) -> Mind:
        """A warm server for this mind, started if needed; the caller must `release` it when the answer is sent."""
        name = canon(name)
        if name in self.cannot:
            raise CannotLoad(self.cannot[name])
        with self.lock:
            gate = self.starting.setdefault(name, threading.Lock())
        with gate:                                    # two first requests start ONE server
            with self.lock:
                m = self.minds.get(name)
                if m and m.alive():
                    m.in_flight += 1
                    m.last_used = self.clock()
                    return m
                self.minds.pop(name, None)
            m = self._start(name)
            with self.lock:
                m.in_flight += 1
                m.last_used = self.clock()
                self.minds[name] = m
            return m

    def release(self, m: Mind):
        with self.lock:
            m.in_flight = max(0, m.in_flight - 1)
            m.last_used = self.clock()

    def reap(self) -> list:
        """Stop every mind idle longer than IDLE_S (or dead); returns the names stopped."""
        gone = []
        with self.lock:
            for name, m in list(self.minds.items()):
                if not m.alive() or (m.in_flight == 0 and self.clock() - m.last_used > IDLE_S):
                    self._stop(m)
                    del self.minds[name]
                    gone.append(name)
            if gone:
                self._remember_pids()
        return gone

    def listing(self) -> list:
        now = self.clock()
        with self.lock:
            return [{"name": m.name, "port": m.port, "pid": m.proc.pid, "idle_s": round(now - m.last_used, 1),
                     "in_flight": m.in_flight, "rss": rss_bytes(m.proc.pid), "served_by": "llama.cpp"}
                    for m in self.minds.values() if m.alive()]

    def stop_all(self):
        with self.lock:
            for m in self.minds.values():
                self._stop(m)
            self.minds.clear()

    # ── starting and stopping ──
    def _start(self, name: str) -> Mind:
        res = resolve(name)
        if not res:
            raise CannotLoad(f"{name} is not pulled into Ollama's store")
        with self.lock:
            live = [m for m in self.minds.values() if m.alive()]
            budget = mind_budget()
            # the box's budget beside the brain (box-minds.json), in GB: two tiny + a 1B, two 1Bs, or an E2B (+ a tiny)
            while sum(weight(m.name) for m in live) + sum(weight(n) for n in self.pending) + weight(name) > budget:
                idle = sorted((m for m in live if m.in_flight == 0), key=lambda m: m.last_used)
                if not idle:
                    raise Refused(f"the small minds' budget on this box ({budget:g} GB) is in use; {name} waits for one to finish")
                self._stop(idle[0])                   # make room: the longest-idle mind goes first
                del self.minds[idle[0].name]
                live.remove(idle[0])
            self.pending.add(name)
        try:
            need, have = need_bytes(res), self.memory()
            if have - need < FLOOR:
                raise Refused(f"{name} needs about {need >> 20} MB and only {have >> 20} MB is free; starting it would "
                              f"leave less than {FLOOR >> 20} MB beside the brain, so it was not started")
            port = self._free_port()
            proc = self.spawn(name, res, port)
            if not self.ready(proc, port):
                reason = self._why(name, proc)
                self.cannot[name] = reason
                raise CannotLoad(reason)
            self._remember_pids(extra=proc.pid)
            return Mind(name, port, proc, self.clock())
        finally:
            with self.lock:
                self.pending.discard(name)

    def _free_port(self) -> int:
        taken = {m.port for m in self.minds.values()}
        p = FIRST_PORT
        while p in taken or not port_free(p):
            p += 1
        return p

    def model_file(self, res: dict) -> str:
        """Ollama's blob, or its mended clone when llama.cpp would refuse the blob's vocabulary (see gguf_mend)."""
        blob = res["model"]["path"]
        mended = os.path.join(MINDS_HOME, "mended", res["model"]["digest"].replace(":", "-") + ".gguf")
        if os.path.exists(mended):
            return mended
        try:
            if gguf_mend.needs_mend(gguf_mend.read_layout(blob)):
                gguf_mend.mend(blob, mended)
                return mended
        except (OSError, ValueError, struct.error):
            pass
        return blob

    def _spawn(self, name: str, res: dict, port: int):
        adapters = adapters_for(name)
        LOADED[name] = adapters
        fam = FAMILIES.get(family(name), {})
        argv = [LLAMA_SERVER, "-m", self.model_file(res), "--alias", name, "-c", str(SLOT_CTX * 2), "--parallel", "2",
                "-ngl", "99", "-fa", "on", "--jinja", "--host", "127.0.0.1", "--port", str(port)]
        if res.get("projector"):
            argv += ["--mmproj", res["projector"]["path"]]
        if fam.get("template"):
            argv += ["--chat-template-file", fam["template"]]
        if fam.get("special"):
            argv += ["--special"]
        if fam.get("overrides"):
            argv += ["--override-kv", fam["overrides"]]
        if adapters:                                 # G18: every specialist of this base, loaded and not applied
            argv += ["--lora", ",".join(adapters), "--lora-init-without-apply"]
        os.makedirs(LOGS, exist_ok=True)
        log = open(os.path.join(LOGS, f"mind-{name.replace(':', '-')}.log"), "w")    # one run's log, never grows
        return subprocess.Popen(argv, stdout=log, stderr=subprocess.STDOUT, stdin=subprocess.DEVNULL,
                                start_new_session=True)

    def _ready(self, proc, port: int, wait_s: float = 90) -> bool:
        end = time.monotonic() + wait_s
        while time.monotonic() < end:
            if proc.poll() is not None:
                return False
            try:
                with urllib.request.urlopen(f"http://127.0.0.1:{port}/health", timeout=2) as r:
                    if json.load(r).get("status") == "ok":
                        return True
            except (OSError, ValueError):
                pass
            time.sleep(0.3)
        self._kill(proc)
        return False

    def _why(self, name: str, proc) -> str:
        self._kill(proc)
        try:
            with open(os.path.join(LOGS, f"mind-{name.replace(':', '-')}.log")) as f:
                errs = [ln.strip() for ln in f if " E " in ln or "error" in ln.lower()]
        except OSError:
            errs = []
        return f"llama.cpp could not load {name}" + (f": {errs[0][:200]}" if errs else "")

    def _stop(self, m: Mind):
        self._kill(m.proc)

    # ── orphans: a gateway restart must not leave small servers holding memory nobody can reach ──
    def _remember_pids(self, extra: int | None = None):
        pids = [m.proc.pid for m in self.minds.values() if m.alive()] + ([extra] if extra else [])
        try:
            os.makedirs(MINDS_HOME, exist_ok=True)
            with open(os.path.join(MINDS_HOME, "pids.json"), "w") as f:
                json.dump(pids, f)
        except OSError:
            pass

    @staticmethod
    def stop_orphans() -> int:
        """At start-up: stop small servers a previous gateway left behind (only llama-servers on our ports)."""
        try:
            with open(os.path.join(MINDS_HOME, "pids.json")) as f:
                pids = json.load(f)
        except (OSError, ValueError):
            return 0
        n = 0
        for pid in pids:
            cmd = subprocess.run(["/bin/ps", "-o", "command=", "-p", str(pid)], capture_output=True, text=True).stdout
            if "llama-server" in cmd and "--port 8091" not in cmd:          # never the brain
                try:
                    os.kill(pid, signal.SIGTERM)
                    n += 1
                except OSError:
                    pass
        return n

    @staticmethod
    def _kill(proc):
        if proc.poll() is not None:
            return
        try:
            proc.send_signal(signal.SIGTERM)
            proc.wait(timeout=10)
        except Exception:                             # a stuck server is killed outright: it must not hold memory
            try:
                proc.kill()
            except OSError:
                pass

