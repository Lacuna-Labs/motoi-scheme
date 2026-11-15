"""Lacuna toolkit — deterministic ops functions.

The MRKL principle (Karpas et al., AI21 2022): the model is a glue layer
over a deterministic toolkit. These functions are pure Python, never call
the LLM, and target <100ms each.

Every public function logs a structured event to lacuna.log.jsonl so the
operator can audit the toolkit's calls.

All functions return JSON-serializable dicts or list-of-dicts. Errors are
returned in-band (`{"error": "..."}`) rather than raised — the caller
(router or LLM) inspects the result.
"""
from __future__ import annotations

import json
import os
import platform
import re
import socket
import subprocess
import time
from dataclasses import dataclass
from pathlib import Path
from typing import Any

from . import log as _log


# ── helpers ──────────────────────────────────────────────────────────────────

def _audit(fn_name: str, args: dict, result_summary: dict) -> None:
    """Append a structured event for this toolkit call."""
    try:
        _log.info("toolkit", fn_name, ctx={"args": args, "result": result_summary})
    except Exception:
        # Audit must never crash the call. Drop silently if log subsystem
        # isn't initialized yet (e.g., called outside a CLI context).
        pass


def _repo_root() -> Path:
    """Walk up from this file to the project repo root.

    A repo root is identified by the presence of a VERSION file plus
    a `.git` directory or the lacuna-src/ tree itself. Works for the
    standalone Lacuna repo and any sibling project that shares the
    same convention. No hard-coded sibling-product names."""
    here = Path(__file__).resolve()
    for p in [here, *here.parents]:
        if (p / "VERSION").exists() and (
            (p / ".git").exists() or (p / "lacuna-src").exists()
        ):
            return p
    return Path.cwd()


# ── ports / processes / sockets ──────────────────────────────────────────────

def port_status(port: int) -> dict:
    """Is a port bound? Return {port, status: 'listen'|'free'|'busy'|'error',
    pid, command} when discoverable.

    Uses lsof on macOS/Linux. <50ms typical.
    """
    args = {"port": port}
    try:
        result = subprocess.run(
            ["lsof", "-nP", "-iTCP:%d" % port, "-sTCP:LISTEN"],
            capture_output=True, text=True, timeout=2,
        )
        if result.returncode != 0 or not result.stdout.strip():
            out = {"port": port, "status": "free"}
            _audit("port_status", args, out)
            return out
        lines = result.stdout.strip().splitlines()
        if len(lines) < 2:
            out = {"port": port, "status": "free"}
            _audit("port_status", args, out)
            return out
        # Header + first listener row
        cols = lines[1].split()
        out = {
            "port": port,
            "status": "listen",
            "command": cols[0] if cols else None,
            "pid": int(cols[1]) if len(cols) > 1 and cols[1].isdigit() else None,
            "user": cols[2] if len(cols) > 2 else None,
        }
        _audit("port_status", args, {"status": "listen", "pid": out["pid"]})
        return out
    except FileNotFoundError:
        out = {"port": port, "status": "error", "error": "lsof not found"}
        _audit("port_status", args, out)
        return out
    except subprocess.TimeoutExpired:
        out = {"port": port, "status": "error", "error": "lsof timeout"}
        _audit("port_status", args, out)
        return out


def process_grep(name: str) -> list[dict]:
    """Return matching processes by name. <100ms typical.

    Each entry: {pid, ppid, command, cpu_pct, rss_kb}.
    """
    args = {"name": name}
    try:
        result = subprocess.run(
            ["ps", "-axo", "pid,ppid,%cpu,rss,comm,command"],
            capture_output=True, text=True, timeout=2,
        )
        if result.returncode != 0:
            _audit("process_grep", args, {"count": 0, "error": "ps failed"})
            return []
        lines = result.stdout.strip().splitlines()[1:]  # skip header
        matches = []
        needle = name.lower()
        for line in lines:
            if needle not in line.lower():
                continue
            parts = line.split(None, 5)
            if len(parts) < 6:
                continue
            try:
                matches.append({
                    "pid": int(parts[0]),
                    "ppid": int(parts[1]),
                    "cpu_pct": float(parts[2]),
                    "rss_kb": int(parts[3]),
                    "comm": parts[4],
                    "command": parts[5][:200],  # truncate long cmdlines
                })
            except (ValueError, IndexError):
                continue
        _audit("process_grep", args, {"count": len(matches)})
        return matches[:50]  # cap to keep result small
    except Exception as e:
        _audit("process_grep", args, {"error": str(e)})
        return []


# ── files / logs ─────────────────────────────────────────────────────────────

# Known logs the operator might want to tail. Names map to real paths.
_LOG_REGISTRY = {
    "lacuna":   Path.home() / ".lacuna" / "logs" / "lacuna.log.jsonl",
    "errors":   Path.home() / ".lacuna" / "errors.jsonl",
    "sessions": Path.home() / ".lacuna" / "sessions.jsonl",
    "daemon":   Path.home() / ".lacuna" / "logs" / "daemon.log",
    "lacuna-text": Path.home() / ".lacuna" / "logs" / "lacuna.log",  # human-readable text variant
}


def tail_log(name: str, n: int = 20) -> list[str]:
    """Return the last n lines of a known log. Empty list if log missing."""
    args = {"name": name, "n": n}
    path = _LOG_REGISTRY.get(name)
    if path is None:
        # Allow direct path passthrough for ad-hoc operator queries
        if Path(name).exists():
            path = Path(name)
        else:
            _audit("tail_log", args, {"error": "unknown log"})
            return []
    if not path.exists():
        _audit("tail_log", args, {"lines": 0, "exists": False})
        return []
    try:
        # Cheap tail: read whole file if <1MB, else seek
        size = path.stat().st_size
        if size < 1_000_000:
            lines = path.read_text(errors="replace").splitlines()
        else:
            with path.open("rb") as f:
                f.seek(max(0, size - 64_000))
                tail = f.read().decode(errors="replace")
                lines = tail.splitlines()[1:]  # drop possibly-truncated first
        result = lines[-n:]
        _audit("tail_log", args, {"lines": len(result)})
        return result
    except Exception as e:
        _audit("tail_log", args, {"error": str(e)})
        return []


def recent_errors(n: int = 10) -> list[dict]:
    """Return the last n errors from ~/.lacuna/errors.jsonl as parsed dicts."""
    args = {"n": n}
    path = _LOG_REGISTRY["errors"]
    if not path.exists():
        _audit("recent_errors", args, {"count": 0})
        return []
    try:
        out = []
        for line in path.read_text(errors="replace").splitlines()[-n:]:
            try:
                out.append(json.loads(line))
            except json.JSONDecodeError:
                continue
        _audit("recent_errors", args, {"count": len(out)})
        return out
    except Exception as e:
        _audit("recent_errors", args, {"error": str(e)})
        return []


# ── filesystem / disk ────────────────────────────────────────────────────────

def disk_usage(path: str = "/") -> dict:
    """Return {path, total_bytes, used_bytes, free_bytes, used_pct} for the
    filesystem containing path. <10ms."""
    args = {"path": path}
    try:
        st = os.statvfs(path)
        total = st.f_blocks * st.f_frsize
        free = st.f_bavail * st.f_frsize
        used = total - free
        out = {
            "path": path,
            "total_bytes": total,
            "used_bytes": used,
            "free_bytes": free,
            "used_pct": round(100.0 * used / total, 1) if total > 0 else 0.0,
        }
        _audit("disk_usage", args, {"used_pct": out["used_pct"]})
        return out
    except FileNotFoundError:
        out = {"path": path, "error": "path not found"}
        _audit("disk_usage", args, out)
        return out


# ── git ──────────────────────────────────────────────────────────────────────

def git_terse(repo: str | None = None) -> dict:
    """Return {branch, ahead, behind, dirty_count, last_commit} for a repo.
    Defaults to the project repo root."""
    args = {"repo": repo}
    cwd = Path(repo) if repo else _repo_root()
    out: dict[str, Any] = {"repo": str(cwd)}
    try:
        # branch
        b = subprocess.run(
            ["git", "branch", "--show-current"],
            capture_output=True, text=True, timeout=2, cwd=cwd,
        )
        out["branch"] = b.stdout.strip() or "(detached)"

        # ahead/behind versus upstream — best-effort
        ab = subprocess.run(
            ["git", "rev-list", "--left-right", "--count", "@{u}...HEAD"],
            capture_output=True, text=True, timeout=2, cwd=cwd,
        )
        if ab.returncode == 0 and ab.stdout.strip():
            parts = ab.stdout.strip().split()
            out["behind"] = int(parts[0]) if len(parts) > 0 else 0
            out["ahead"] = int(parts[1]) if len(parts) > 1 else 0

        # dirty count (modified + untracked)
        st = subprocess.run(
            ["git", "status", "--porcelain"],
            capture_output=True, text=True, timeout=2, cwd=cwd,
        )
        out["dirty_count"] = len([l for l in st.stdout.splitlines() if l.strip()])

        # last commit subject
        lc = subprocess.run(
            ["git", "log", "-1", "--pretty=format:%h %s"],
            capture_output=True, text=True, timeout=2, cwd=cwd,
        )
        out["last_commit"] = lc.stdout.strip() if lc.returncode == 0 else None

        _audit("git_terse", args, {"branch": out["branch"], "dirty": out["dirty_count"]})
        return out
    except Exception as e:
        out["error"] = str(e)
        _audit("git_terse", args, out)
        return out


# ── docs / bugs / project knowledge ──────────────────────────────────────────

def docs_lookup(topic: str) -> list[dict]:
    """Search docs/*.md headings + first paragraphs for topic. Returns matches
    [{path, heading, snippet, score}, ...]."""
    args = {"topic": topic}
    root = _repo_root()
    docs_dir = root / "docs"
    if not docs_dir.exists():
        _audit("docs_lookup", args, {"count": 0})
        return []
    needle = topic.lower()
    matches: list[dict] = []
    for md in sorted(docs_dir.glob("*.md")):
        try:
            text = md.read_text(errors="replace")
        except Exception:
            continue
        # Check headings
        for line in text.splitlines():
            if line.startswith("#") and needle in line.lower():
                matches.append({
                    "path": str(md.relative_to(root)),
                    "heading": line.lstrip("# ").strip(),
                    "snippet": "",
                    "score": 2,
                })
        # Body match (one entry per file even if multiple hits)
        if needle in text.lower():
            idx = text.lower().find(needle)
            snippet = text[max(0, idx - 60):idx + 140].replace("\n", " ")
            matches.append({
                "path": str(md.relative_to(root)),
                "heading": md.stem,
                "snippet": snippet,
                "score": 1,
            })
    matches.sort(key=lambda m: -m["score"])
    out = matches[:10]
    _audit("docs_lookup", args, {"count": len(out)})
    return out


def bug_search(query: str) -> list[dict]:
    """Search BUGS.md for query. Returns matches with section headers + bug
    body snippet."""
    args = {"query": query}
    root = _repo_root()
    bugs = root / "BUGS.md"
    if not bugs.exists():
        _audit("bug_search", args, {"count": 0})
        return []
    text = bugs.read_text(errors="replace")
    needle = query.lower()
    matches: list[dict] = []
    # Bugs are typically headed with "### B<N>" — split on that
    sections = re.split(r"(?m)^### ", text)
    for sec in sections[1:]:  # skip preamble
        if needle in sec.lower():
            head, _, rest = sec.partition("\n")
            matches.append({
                "id": head.strip().split()[0] if head.strip() else "?",
                "title": head.strip(),
                "snippet": rest[:300].replace("\n", " ").strip(),
            })
    out = matches[:5]
    _audit("bug_search", args, {"count": len(out)})
    return out


# ── ports lookup (PORTS.md) ──────────────────────────────────────────────────

# Cached on first read; PORTS.md doesn't change often.
_PORTS_CACHE: dict[str, int] | None = None


def _load_ports() -> dict[str, int]:
    global _PORTS_CACHE
    if _PORTS_CACHE is not None:
        return _PORTS_CACHE
    out: dict[str, int] = {}
    root = _repo_root()
    ports_md = root / "docs" / "PORTS.md"
    if not ports_md.exists():
        _PORTS_CACHE = out
        return out
    text = ports_md.read_text(errors="replace")
    # Look for table rows like "| **<port>** | **A sibling product** ..." with
    # bold or unbolded numeric port + label, e.g. the-api dev row.
    for m in re.finditer(r"\|\s*\*?\*?(\d{2,5})\*?\*?\s*\|\s*\*?\*?([^|]+?)\*?\*?\s*\|", text):
        port = int(m.group(1))
        label = m.group(2).strip().lower()
        # Pull a service-ish keyword from the label
        for token in re.findall(r"[a-z][a-z0-9-]+", label):
            if token in ("the", "a", "an", "of", "for", "to", "and", "or", "is"):
                continue
            out.setdefault(token, port)
    _PORTS_CACHE = out
    return out


def port_for(service: str) -> int | None:
    """Look up the canonical port for a service name from docs/PORTS.md.
    Returns None if not found."""
    args = {"service": service}
    ports = _load_ports()
    needle = service.lower().strip()
    out = ports.get(needle)
    if out is None:
        # Try fuzzy match
        for key, port in ports.items():
            if needle in key or key in needle:
                out = port
                break
    _audit("port_for", args, {"port": out})
    return out


# ── service health (composite) ───────────────────────────────────────────────

def service_health(env: str = "dev") -> dict:
    """Composite health for an env: {env, api: {port, status}, web: {port, status},
    ollama: {port, status}}.

    Port defaults: API on :5050 (Lacuna daemon), web on :3000 (sibling
    web app, conventional). The .serve module that previously sourced
    these was removed in v0.6 (it was sibling-specific); the constants
    inline here are the canonical Lacuna defaults.
    """
    DEFAULT_WEB_PORT = 3000
    DEFAULT_API_PORT = 5050
    try:
        from .up import DEFAULT_PORTS
    except ImportError:
        DEFAULT_PORTS = {}
    args = {"env": env}
    api_port = DEFAULT_PORTS.get(env, DEFAULT_API_PORT) if env != "dev" else DEFAULT_API_PORT
    web_port = DEFAULT_WEB_PORT
    ollama_port = 11434  # Ollama daemon — not in PORTS.md (third-party)

    out = {
        "env": env,
        "api": port_status(api_port),
        "web": port_status(web_port),
        "ollama": port_status(ollama_port),
    }
    _audit("service_health", args, {
        "api": out["api"]["status"],
        "web": out["web"]["status"],
        "ollama": out["ollama"]["status"],
    })
    return out


# ── host profile ─────────────────────────────────────────────────────────────

def write_host_cache(path: Path | None = None) -> dict:
    """Sample CPU / MEM / DISK and write a one-line cache file the prompt
    theme reads. Cheap (<50 ms). No LLM call.

    Format: `cpu=NN mem=NN disk=NN` on a single line. The theme reads this
    via awk; daemon should refresh every ~2s for live prompt feedback.
    """
    cache = path or (Path.home() / ".lacuna" / "host.cache")
    cache.parent.mkdir(parents=True, exist_ok=True)

    # CPU: macOS uses `top -l 1 -n 0` for instant load, but it's slow.
    # Cheaper: read 1-min loadavg and divide by core count for rough %.
    cpu_pct = 0
    try:
        load1, _, _ = os.getloadavg()
        cores = os.cpu_count() or 1
        cpu_pct = max(0, min(100, int(round(100 * load1 / cores))))
    except (OSError, AttributeError):
        pass

    # MEM: macOS via vm_stat, Linux via /proc/meminfo
    mem_pct = 0
    try:
        if platform.system() == "Darwin":
            r = subprocess.run(["vm_stat"], capture_output=True, text=True, timeout=1)
            stats: dict[str, int] = {}
            for line in r.stdout.splitlines():
                if ":" in line:
                    k, _, v = line.partition(":")
                    v = v.strip().rstrip(".")
                    if v.isdigit():
                        stats[k.strip()] = int(v)
            free = stats.get("Pages free", 0)
            inactive = stats.get("Pages inactive", 0)
            speculative = stats.get("Pages speculative", 0)
            active = stats.get("Pages active", 0)
            wired = stats.get("Pages wired down", 0)
            total = free + inactive + speculative + active + wired
            used = active + wired
            if total > 0:
                mem_pct = max(0, min(100, int(round(100 * used / total))))
        else:
            with open("/proc/meminfo") as f:
                info = {}
                for line in f:
                    parts = line.split()
                    if len(parts) >= 2:
                        info[parts[0].rstrip(":")] = int(parts[1])
            total = info.get("MemTotal", 1)
            avail = info.get("MemAvailable", info.get("MemFree", 0))
            mem_pct = max(0, min(100, int(round(100 * (total - avail) / total))))
    except Exception:
        pass

    # DISK: home partition
    disk_pct = 0
    try:
        d = disk_usage(str(Path.home()))
        disk_pct = int(d.get("used_pct", 0))
    except Exception:
        pass

    cache.write_text(f"cpu={cpu_pct} mem={mem_pct} disk={disk_pct}\n")
    return {"cpu": cpu_pct, "mem": mem_pct, "disk": disk_pct, "path": str(cache)}


def host_profile() -> dict:
    """Return {arch, cores_physical, cores_logical, ram_gb, has_avx2,
    macos_version, model_recommendation}."""
    args: dict = {}
    out: dict[str, Any] = {
        "arch": platform.machine(),
        "platform": platform.system(),
    }
    try:
        # macOS-specific probes
        if platform.system() == "Darwin":
            ncpu = subprocess.run(["sysctl", "-n", "hw.ncpu"], capture_output=True, text=True, timeout=1)
            pcpu = subprocess.run(["sysctl", "-n", "hw.physicalcpu"], capture_output=True, text=True, timeout=1)
            mem = subprocess.run(["sysctl", "-n", "hw.memsize"], capture_output=True, text=True, timeout=1)
            avx2 = subprocess.run(["sysctl", "-n", "hw.optional.avx2_0"], capture_output=True, text=True, timeout=1)
            ver = subprocess.run(["sw_vers", "-productVersion"], capture_output=True, text=True, timeout=1)
            out["cores_logical"] = int(ncpu.stdout.strip()) if ncpu.stdout.strip().isdigit() else None
            out["cores_physical"] = int(pcpu.stdout.strip()) if pcpu.stdout.strip().isdigit() else None
            mem_bytes = int(mem.stdout.strip()) if mem.stdout.strip().isdigit() else 0
            out["ram_gb"] = round(mem_bytes / 1024 / 1024 / 1024, 1) if mem_bytes else None
            out["has_avx2"] = avx2.stdout.strip() == "1"
            out["macos_version"] = ver.stdout.strip() if ver.stdout.strip() else None
        else:
            # Linux: best-effort
            try:
                with open("/proc/cpuinfo") as f:
                    cpuinfo = f.read()
                out["has_avx2"] = "avx2" in cpuinfo.lower()
                out["cores_logical"] = cpuinfo.count("processor\t:")
            except Exception:
                pass
            try:
                with open("/proc/meminfo") as f:
                    for line in f:
                        if line.startswith("MemTotal:"):
                            kb = int(line.split()[1])
                            out["ram_gb"] = round(kb / 1024 / 1024, 1)
                            break
            except Exception:
                pass

        # Recommendation per the plan's per-machine table
        out["model_recommendation"] = _recommend_model(out)
    except Exception as e:
        out["error"] = str(e)

    _audit("host_profile", args, {
        "arch": out.get("arch"),
        "cores": out.get("cores_physical"),
        "ram_gb": out.get("ram_gb"),
        "avx2": out.get("has_avx2"),
        "rec": out.get("model_recommendation"),
    })
    return out


def _recommend_model(profile: dict) -> str:
    """Map host profile to a recommended chat model (matches LACUNA-ONE plan)."""
    arch = profile.get("arch", "")
    cores = profile.get("cores_physical", 0) or 0
    ram = profile.get("ram_gb", 0) or 0
    avx2 = bool(profile.get("has_avx2"))

    if arch == "arm64":
        return "qwen2.5:7b-instruct" if ram >= 16 else "qwen2.5:3b-instruct"
    if arch in ("x86_64", "amd64"):
        if not avx2:
            return "echo (no AVX2 — local inference not viable)"
        if cores >= 6:
            return "qwen2.5:3b-instruct"
        return "qwen2.5:0.5b"  # this Mac
    return "qwen2.5:0.5b"  # safe default


# ── workers (delegates to lacuna.worker — implemented in §4.7) ───────────────

def worker_list() -> list[dict]:
    """Return the foreman's view of running workers. Stub until §4.7 ships
    lacuna.worker; returns empty list."""
    _audit("worker_list", {}, {"count": 0, "stubbed": True})
    try:
        from . import worker as _worker
        return _worker.list_workers()
    except ImportError:
        return []


# ── public registry — used by the router and by `:tools` in the REPL ────────

REGISTRY = {
    "port_status":    port_status,
    "process_grep":   process_grep,
    "tail_log":       tail_log,
    "recent_errors":  recent_errors,
    "disk_usage":     disk_usage,
    "git_terse":      git_terse,
    "docs_lookup":    docs_lookup,
    "bug_search":     bug_search,
    "port_for":       port_for,
    "service_health": service_health,
    "host_profile":   host_profile,
    "worker_list":    worker_list,
}


def call(name: str, *args, **kwargs) -> Any:
    """Dispatch a toolkit function by name. Returns {error: ...} on unknown."""
    fn = REGISTRY.get(name)
    if fn is None:
        return {"error": f"unknown toolkit function: {name}"}
    try:
        return fn(*args, **kwargs)
    except TypeError as e:
        return {"error": f"bad args for {name}: {e}"}


def describe() -> list[dict]:
    """Return a list of {name, signature, doc} for all toolkit functions.
    Used by the REPL ':tools' command and by the router for ReAct prompts."""
    import inspect
    out = []
    for name, fn in sorted(REGISTRY.items()):
        sig = str(inspect.signature(fn))
        doc = (fn.__doc__ or "").strip().splitlines()[0] if fn.__doc__ else ""
        out.append({"name": name, "signature": sig, "doc": doc})
    return out
