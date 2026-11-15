"""Lacuna CLI entry point. `lacuna --help` enumerates subcommands."""
from __future__ import annotations

import argparse
import sys
import time
from pathlib import Path

from . import __version__, log, trash
from .config import Paths


def _print_fortune() -> None:
    import random
    lines = [
        "Mind the gaps.",
        "The flower is spinning. The work is happening. Breathe.",
        "Credit, where credit is due.",
        "Science before sentiment.",
        "Every commit is a hypothesis.",
        "The map is not the territory; the audit is.",
    ]
    print(random.choice(lines))


def _cmd_trash(args: argparse.Namespace) -> int:
    sub = getattr(args, "trash_cmd", None)
    if sub is None:
        print("usage: lacuna trash <subcommand>", file=sys.stderr)
        print("  subcommands: list / rm / restore / purge / empty", file=sys.stderr)
        return 2
    if sub == "list":
        entries = trash.list_all()
        if not entries:
            print("trash is empty.")
            return 0
        print(f"{len(entries)} entries in trash:")
        for e in entries:
            date = e.trashed_at[:10] if len(e.trashed_at) >= 10 else "?"
            print(f"  {date}  {e.id}  {e.original_path}")
        return 0
    if sub == "rm":
        p = Path(args.path)
        if not (p.exists() or p.is_symlink()):
            print(f"no such path: {p}", file=sys.stderr)
            return 1
        if p.is_symlink():
            kind = trash.EntryKind.SYMLINK
        elif p.is_dir():
            kind = trash.EntryKind.DIRECTORY
        else:
            kind = trash.EntryKind.FILE
        entry = trash.send_to_trash(p, kind=kind, reason="lacuna trash rm")
        print(f"→ trashed as {entry.id} ({entry.trashed_path})")
        return 0
    if sub == "restore":
        try:
            entry = trash.restore(args.id)
        except Exception as e:
            print(f"restore failed: {e}", file=sys.stderr)
            return 1
        print(f"← restored to {entry.original_path}")
        return 0
    if sub == "purge":
        n = trash.purge_old()
        print(f"purged {n} expired entries.")
        return 0
    if sub == "empty":
        if not args.force:
            print("refusing: `lacuna trash empty` requires --force", file=sys.stderr)
            return 2
        n = trash.empty_all()
        print(f"emptied trash ({n} entries gone).")
        return 0
    return 2



def _repo_root() -> Path:
    """Walk up from this file to find the repo root (has VERSION)."""
    p = Path(__file__).resolve()
    for candidate in [p, *p.parents]:
        if (candidate / "VERSION").exists():
            return candidate
    return Path(__file__).resolve().parents[2]


def _cmd_review(_args: argparse.Namespace) -> int:
    """Pre-PR gate: tests + safedelete audit + TODO scan + style hint."""
    import subprocess
    root = _repo_root()
    ok = True

    print("🔍 [review] pre-PR gate running…")
    print()

    # 1. Tests (fast)
    result = subprocess.run(
        [sys.executable, "-m", "pytest", str(root / "lacuna-src" / "tests"), "-q", "--tb=line"],
        capture_output=True, text=True,
    )
    summary = next(
        (l for l in reversed(result.stdout.splitlines()) if "passed" in l or "failed" in l),
        result.stdout[-80:] if result.stdout else "no output",
    )
    if result.returncode == 0:
        print(f"  ✓ tests: {summary}")
    else:
        print(f"  ✗ tests: {summary}")
        ok = False

    # 2. safe-delete audit
    audit = root / "lacuna-src" / "scripts" / "audit-safedelete.sh"
    if audit.exists():
        r = subprocess.run(["bash", str(audit), "--quiet"], capture_output=True, text=True, cwd=str(root))
        if r.returncode == 0:
            print("  ✓ safedelete: clean")
        else:
            print(f"  ✗ safedelete: {r.stdout.strip()[:80]}")
            ok = False
    else:
        print("  · safedelete: audit script not found — skipped")

    # 3. TODO without B-ticket
    r = subprocess.run(
        ["git", "diff", "--unified=0", "HEAD"],
        capture_output=True, text=True, cwd=str(root),
    )
    import re as _re
    bare_todos = [
        l.strip() for l in r.stdout.splitlines()
        if l.startswith("+")
        and _re.search(r"#\s*TODO(?!\s*B\d)", l)
        and '"# TODO"' not in l and "'# TODO'" not in l
    ]
    if bare_todos:
        print(f"  ⚠ {len(bare_todos)} TODO(s) without B-ticket in diff:")
        for t in bare_todos[:3]:
            print(f"    {t[:80]}")
        # advisory only
    else:
        print("  ✓ todos: none without B-ticket")

    # 4. Branch check
    r = subprocess.run(["git", "branch", "--show-current"], capture_output=True, text=True, cwd=str(root))
    branch = r.stdout.strip()
    if branch in ("main", "master"):
        print(f"  ⚠ on branch '{branch}' — submit from a feature branch")
    else:
        print(f"  ✓ branch: {branch}")

    print()
    if ok:
        print("  ✓ gate green — ready for `lacuna submit`")
        return 0
    else:
        print("  ✗ gate red — fix failures above before submitting")
        return 1


def _cmd_submit(args: argparse.Namespace) -> int:
    """Local commit gate: REVIEW must pass, then git commit.

    SUBMIT seals work locally. Use PUSH to send it upstream.
    """
    import subprocess
    root = _repo_root()

    # 1. Must have staged changes
    r = subprocess.run(["git", "diff", "--cached", "--stat"], capture_output=True, text=True, cwd=str(root))
    if not r.stdout.strip():
        print("✗ nothing staged — `git add` your changes first.", file=sys.stderr)
        return 1

    # 2. REVIEW gate (silent fast-path)
    print("🔍 [submit] running review gate…")
    review_rc = _cmd_review(args)
    if review_rc != 0:
        print("✗ review failed — fix above before committing.", file=sys.stderr)
        return 1
    print()

    # 3. Commit — open editor if no -m given
    msg = getattr(args, "message", None)
    cmd = ["git", "commit"]
    if msg:
        cmd += ["-m", msg]
    result = subprocess.run(cmd, cwd=str(root))
    if result.returncode == 0:
        print()
        print("  ✓ committed locally — run PUSH when ready to share.")
    return result.returncode


def _cmd_push(args: argparse.Namespace) -> int:
    """Push to remote and open a PR if gh is available.

    PUSH sends upstream. Pre-push hook re-runs tests. Gate must stay green.
    """
    import subprocess
    root = _repo_root()

    # 1. Push
    print("🚀 [push] pushing to origin…")
    r = subprocess.run(["git", "push", "origin", "HEAD"], cwd=str(root))
    if r.returncode != 0:
        return r.returncode

    # 2. PR — best-effort, not a hard gate
    gh = subprocess.run(["which", "gh"], capture_output=True, text=True)
    if gh.returncode == 0:
        branch = subprocess.run(
            ["git", "branch", "--show-current"], capture_output=True, text=True, cwd=str(root)
        ).stdout.strip()
        if branch in ("main", "master"):
            print("  · on main — no PR opened (direct push)")
        else:
            title = getattr(args, "title", None)
            cmd = ["gh", "pr", "create", "--fill"]
            if title:
                cmd += ["--title", title]
            subprocess.run(cmd, cwd=str(root))
    else:
        print("  · gh not installed — PR not opened.")
        print("    fix: brew install gh && gh auth login")
    return 0


def _cmd_stop(env: str) -> int:
    import os, signal
    root = _repo_root()
    for name in (f".project-{env}.pid", ".project.pid"):
        pid_file = root / name
        if pid_file.exists():
            try:
                pid = int(pid_file.read_text().strip())
                os.killpg(os.getpgid(pid), signal.SIGTERM)
                pid_file.unlink(missing_ok=True)  # noqa: safe-delete — pid files are process bookkeeping, not user data
                print(f"✓ stopped the-api [{env}] pid={pid}")
                return 0
            except (ProcessLookupError, ValueError):
                pid_file.unlink(missing_ok=True)  # noqa: safe-delete — pid files are process bookkeeping, not user data
                print(f"process already gone — cleaned up")
                return 0
            except Exception as e:
                print(f"stop failed: {e}", file=sys.stderr)
                return 1
    print(f"no pid file found — is project running?", file=sys.stderr)
    return 1


def _cmd_status(as_json: bool) -> int:
    import json, os, socket
    # Default Lacuna ports per environment. Overridable via LACUNA_PORT_<ENV>.
    default_ports = {"dev": 1138, "test": 1139, "prod": 1140}
    results = {}
    for env_name in ("dev", "test"):
        port = int(os.environ.get(f"LACUNA_PORT_{env_name.upper()}", default_ports[env_name]))
        try:
            with socket.create_connection(("127.0.0.1", port), timeout=0.3):
                results[env_name] = {"status": "up", "port": port}
        except OSError:
            results[env_name] = {"status": "down", "port": port}
    if as_json:
        print(json.dumps(results, indent=2))
    else:
        for env_name, info in results.items():
            icon = "✓" if info["status"] == "up" else "✗"
            print(f"  {icon} {env_name:<6} localhost:{info['port']}  [{info['status']}]")
    return 0


def _cmd_logs(args: argparse.Namespace) -> int:
    from .config import Paths
    from . import log as log_mod
    paths = Paths.init()
    n = getattr(args, "tail", 50)
    as_yaml = getattr(args, "yaml", False)
    entries = log_mod.parse_jsonl(paths.log_file, tail=n)
    if not entries:
        print(f"(no structured log at {paths.log_file.with_suffix('.jsonl')})")
        print("hint: structured logging starts on next lacuna invocation")
        return 0
    print(log_mod.format_entries(entries, as_yaml=as_yaml))
    return 0


def _cmd_ml(args: argparse.Namespace) -> int:
    """ML engine controls — status and training data ingestion."""
    sub = getattr(args, "ml_cmd", None)
    if sub is None:
        print("usage: lacuna ml <subcommand>", file=sys.stderr)
        print("  subcommands: status / ingest", file=sys.stderr)
        return 2

    if sub == "status":
        import json as _json
        root = _repo_root()
        state_file = root / ".ml-state.json"
        if not state_file.exists():
            print("ML engine: no state file found.")
            print("  model:    not initialized")
            print("  training: never run")
            print("  ingest:   0 examples queued")
            print()
            print("hint: run `lacuna ml ingest hallmark 50` to queue examples")
            return 0
        state = _json.loads(state_file.read_text())
        print("ML engine status:")
        print(f"  model:    {state.get('model_version', 'none')}")
        print(f"  accuracy: {state.get('val_accuracy', 'n/a')}")
        print(f"  training: {state.get('training_state', 'idle')}")
        print(f"  last run: {state.get('last_run', 'never')}")
        print(f"  queued:   {state.get('queued_examples', 0)} examples")
        return 0

    if sub == "ingest":
        import datetime as _dt, json as _json
        root = _repo_root()
        data_type = getattr(args, "data_type", "hallmark")
        count = getattr(args, "count", 10)
        state_file = root / ".ml-state.json"
        state = {}
        if state_file.exists():
            try:
                state = _json.loads(state_file.read_text())
            except Exception:
                pass
        current = state.get("queued_examples", 0)
        state["queued_examples"] = current + count
        state["last_ingest"] = _dt.datetime.now(_dt.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
        state["ingest_type"] = data_type
        state.setdefault("training_state", "idle")
        state.setdefault("model_version", "none")
        state_file.write_text(_json.dumps(state, indent=2))
        print(f"queued {count} {data_type!r} examples for ingestion.")
        print(f"total queued: {state['queued_examples']}")
        print("note: actual training requires ML engine runtime (v2.0 milestone)")
        return 0

    print(f"unknown ml subcommand: {sub}", file=sys.stderr)
    return 2


def _load_atlas_summary(root) -> str:
    """Compress the Hallmark Atlas into a one-line-per-maker brief for the prompt."""
    try:
        import sys as _sys
        ml = root / "project-ml"
        if str(ml) not in _sys.path:
            _sys.path.insert(0, str(ml))
        from project_ml.hallmark_atlas import load_entries
        entries = load_entries()
    except Exception:
        return "(Hallmark Atlas unavailable)"
    lines = []
    for e in entries:
        years = e.active_years.get("start")
        end = e.active_years.get("end") or "present"
        glyphs = ", ".join(e.hallmark.glyphs[:4]) if e.hallmark.glyphs else ""
        lines.append(f"- {e.maker_name} ({years}–{end}) [{e.id}] · {glyphs}")
    return "\n".join(lines)


def _build_system_prompt(root, status: dict | None) -> str:
    """Assemble the operator-facing system prompt: Lacuna persona + live state.

    Lacuna's domain is computer-things only. Domain-specific knowledge bases
    (e.g. product Atlases) are NOT injected here; they belong to whatever
    sibling product surface owns them.
    """
    from . import llm as _llm
    persona = _llm.load_persona_prompt("lacuna")
    state_block = ""
    if status:
        state_block = (
            f"\n## System state snapshot (from /ctl/status)\n"
            f"- version: {status.get('version')}\n"
            f"- uptime: {status.get('uptime_seconds', 0)}s\n"
            f"- listings in DB: {status.get('listings_count', 0)}\n"
            f"- errors in log: {status.get('error_count', 0)}\n"
        )
    return f"{persona}\n{state_block}"


def _load_ctl_status(port: int = 5050) -> dict | None:
    """Try to read /ctl/status from the running API. None if unreachable."""
    import urllib.request, json as _json
    try:
        with urllib.request.urlopen(f"http://127.0.0.1:{port}/ctl/status", timeout=1) as r:
            return _json.loads(r.read())
    except Exception:
        return None


def _cmd_chat(_args: argparse.Namespace) -> int:
    """Conversational attribution / listing assistant — Atlas-aware, safety-first.

    LLM backend picked by lacuna.llm.select_backend():
      · LACUNA_LLM_BACKEND env var forces a choice (deepseek/anthropic/openai/echo)
      · otherwise auto-detects based on which *_API_KEY is set
      · falls back to echo (offline) if nothing is configured

    Safety rails (racism refuse, anger pause) fire locally before any API call.
    Conversation persists to ~/.lacuna/sessions.jsonl as chat-turn events.
    """
    import readline  # noqa: F401 — enables line editing in input()
    from . import state as _state
    from . import persona as _persona
    from . import llm as _llm

    root = _repo_root()
    status = _load_ctl_status()
    system_prompt = _build_system_prompt(root, status)
    env_file = root / "the-api" / ".env"
    backend = _llm.select_backend(env_file)

    # Header with mood + backend — persona.compute_mood derives from state.
    mood = _persona.compute_mood(status or {})
    print()
    print(f"  {mood.emoji}  lacuna chat")
    print(f"     mood: {mood.label} — {mood.note}")
    print(f"     backend: {backend.info.note}")
    if backend.info.name == "echo":
        print(f"     (set DEEPSEEK_API_KEY / ANTHROPIC_API_KEY / OPENAI_API_KEY for real replies)")
    print(f"     Hallmark Atlas loaded · /help for commands · /exit to quit")
    print()

    messages: list[dict] = []
    turn = 0

    def _log(role: str, content: str) -> None:
        _state.log_session_event("chat-turn", role=role, content=content)

    def _refresh_mood():
        """Re-read ctl/status each turn so mood tracks state changes."""
        s = _load_ctl_status()
        return s, _persona.compute_mood(s or {})

    def _print_reply(icon: str, text: str):
        """Render Lacuna's reply. Multi-line responses wrap and indent nicely."""
        lines = text.split("\n")
        print(f"  {icon}  lacuna: {lines[0]}")
        for line in lines[1:]:
            print(f"              {line}")
        print()

    try:
        while True:
            try:
                query = input("  you: ").strip()
            except EOFError:
                break
            if not query:
                continue
            if query.lower() in ("/exit", ":exit", "exit", "quit", "q", "/quit"):
                break

            # ── REPL meta-commands (colon-prefix, distinct from /slash) ────
            if query == ":tools":
                from . import toolkit as _tk
                print()
                print("  Toolkit functions (deterministic, < 100ms each):")
                for d in _tk.describe():
                    print(f"    {d['name']:18s} {d['signature']}")
                    if d['doc']:
                        print(f"      {d['doc']}")
                print()
                continue
            if query == ":perms":
                from . import perms as _perms
                print()
                print("  Live permission grants:")
                grants = _perms.list_grants()
                if not grants:
                    print("    (none — only READ_LOCAL is auto-granted)")
                else:
                    for g in grants:
                        ttl = "permanent" if g.expires_at == -1 else (
                            "single-use" if g.expires_at == 0 else
                            f"{int(g.expires_at - __import__('time').time())}s left"
                        )
                        print(f"    {g.tier.name:14s} {g.scope:30s}  {ttl}")
                print()
                continue

            turn += 1
            _log("user", query)
            status, mood = _refresh_mood()

            # ── safety rails (always, regardless of backend) ────────────────
            if _persona.detect_racism(query):
                reply = "I don't respond to racist stuff."
                _print_reply("🚫", reply)
                _log("assistant", reply)
                continue

            if _persona._is_angry(query):
                import random
                reason = random.choice(_persona._BREAK_REASONS)
                reply = f"I hear you — want to take ten? Could be {reason}. I'll still be here."
                _print_reply("🌿", reply)
                _log("assistant", reply)
                continue

            # ── local slash-commands first ──────────────────────────────────
            if query.startswith("/"):
                state_for_persona = dict(status or {})
                state_for_persona["message_count"] = turn
                r = _persona.respond(query, state_for_persona)
                if r.kind in ("command", "normal", "refuse", "break"):
                    if r.text == "__CLEAR__":
                        messages.clear()
                        turn = 0
                        print("\x1b[2J\x1b[H", end="")
                        print(f"  {mood.emoji}  lacuna chat — cleared.\n")
                        _log("assistant", "[cleared]")
                        continue
                    icon = r.icon if r.icon else mood.emoji
                    _print_reply(icon, r.text)
                    _log("assistant", r.text)
                    continue

            # ── no reasoning → honest fallback ───────────────────────────────
            # ── LLM turn — backend was chosen at startup ────────────────────
            messages.append({"role": "user", "content": query})
            reply = backend.chat(system_prompt, messages)
            messages.append({"role": "assistant", "content": reply})
            _print_reply(mood.emoji, reply)
            _log("assistant", reply)

    except KeyboardInterrupt:
        print()
    print(f"\n  {mood.emoji}  lacuna: bye.")
    return 0


def _cmd_build_app(args: argparse.Namespace) -> int:
    """Build a sibling product native app (iOS/macOS) via xcodebuild."""
    import subprocess
    env_name = getattr(args, "env", "dev") or "dev"
    platform = getattr(args, "platform", "macos") or "macos"
    root = _repo_root()
    app_dir = root / "project-app"

    if not app_dir.exists():
        print(f"project-app/ not found at {app_dir}", file=sys.stderr)
        print("run: lacuna scaffold app  (coming in v2.0 tooling)", file=sys.stderr)
        return 1

    # Detect xcodebuild
    xcode = subprocess.run(["which", "xcodebuild"], capture_output=True, text=True)
    if xcode.returncode != 0:
        print("xcodebuild not found — install Xcode from the Mac App Store", file=sys.stderr)
        return 1

    scheme_map = {"ios": "siblingApp-iOS", "macos": "siblingApp-macOS", "all": "siblingApp"}
    scheme = scheme_map.get(platform, "siblingApp-macOS")

    config_map = {"dev": "Debug", "test": "Debug", "prod": "Release"}
    config = config_map.get(env_name, "Debug")

    dest_map = {
        "ios": "platform=iOS Simulator,name=iPhone 15 Pro",
        "macos": "platform=macOS",
    }
    dest = dest_map.get(platform, "platform=macOS")

    print(f"🚀 [build-app] env={env_name} platform={platform} config={config}")
    print(f"   scheme: {scheme}")
    print()

    xcproj = next(app_dir.glob("*.xcodeproj"), None)
    xcworkspace = next(app_dir.glob("*.xcworkspace"), None)
    pkg = app_dir / "Package.swift"

    if xcworkspace:
        cmd = ["xcodebuild", "-workspace", str(xcworkspace), "-scheme", scheme,
               "-configuration", config, "-destination", dest, "build"]
    elif xcproj:
        cmd = ["xcodebuild", "-project", str(xcproj), "-scheme", scheme,
               "-configuration", config, "-destination", dest, "build"]
    elif pkg.exists():
        cmd = ["swift", "build", "-c", "debug" if config == "Debug" else "release"]
    else:
        print("no .xcodeproj, .xcworkspace, or Package.swift found in project-app/", file=sys.stderr)
        return 1

    result = subprocess.run(cmd, cwd=str(app_dir))
    return result.returncode


def _cmd_version(_args: argparse.Namespace) -> int:
    print(f"lacuna {__version__}")
    print(f"python {sys.version.split()[0]}")
    return 0


def _cmd_ask(args: argparse.Namespace) -> int:
    """Ask the running Lacuna a question. Relays its answer in team voice.

    Topics it can answer without network:
      errors | status | pilot | listings | db | boot
    """
    import json as _json
    import urllib.error
    import urllib.request
    from . import state as _state

    topic = (getattr(args, "topic", "") or "").lower().strip()
    port = getattr(args, "port", 5050)
    base = f"http://127.0.0.1:{port}"

    def _fetch(path: str) -> dict | None:
        try:
            with urllib.request.urlopen(f"{base}{path}", timeout=2) as r:
                return _json.loads(r.read())
        except (urllib.error.URLError, OSError):
            return None

    banner = f"  🗣  Lacuna says (port {port}):"
    print()
    print(banner)
    print()

    status = _fetch("/ctl/status")
    if status is None:
        # Running server is unreachable; fall back to file-based state.
        print(f"     🚀 Kwame (🟢 REL) — I can't reach the API on {base}.")
        print(f"        Either nothing's up, or you want a different port (try --port N).")
        errors = _state.recent_errors(10)
        last = _state.last_boot()
        if last:
            print(f"     🐛 Devi (🟣 Bug Hunting) — last boot was {last.get('ts')} "
                  f"on port {last.get('port')}.")
        if errors:
            print(f"     🐛 Devi — but I still have {len(errors)} recent error(s) in my log:")
            for e in errors[:3]:
                print(f"        · [{e['ts']}] {e['source']}: {e['message']}")
        else:
            print(f"     🐛 Devi — error log is empty.")
        return 1

    if topic in ("", "status", "health"):
        hrs = status["uptime_seconds"] // 3600
        mins = (status["uptime_seconds"] % 3600) // 60
        print(f"     🚀 Kwame — v{status['version']}, env={status['env']}, pid={status['pid']}.")
        print(f"        Up for {hrs}h {mins}m. {status['listings_count']} listing(s) in the DB "
              f"({status['db_size_bytes']} bytes).")

        # Companion processes (Vite, etc.) — if any are down, surface it
        companions = status.get("companions", {})
        down = [name for name, info in companions.items() if info.get("status") == "down"]
        up = [name for name, info in companions.items() if info.get("status") == "up"]
        if up:
            print(f"     🔵 Marcus — companions up: {', '.join(up)}.")
        if down:
            print(f"     ⚠  Priya — companions DOWN: {', '.join(down)}.")
            print(f"        (probably want to restart the web dev server — `npm run dev` in the-web)")

        if status["error_count"]:
            print(f"     🐛 Devi — {status['error_count']} recent error(s). "
                  f"Run `lacuna ask errors` for the list.")
        else:
            print(f"     🐛 Devi — error log is clean.")
        if status["pilot"] != "human":
            print(f"     🏗 Architect — current pilot: {status['pilot']}.")
        return 0

    if topic == "errors":
        errs = _fetch("/ctl/errors?limit=20") or {"errors": []}
        items = errs.get("errors", [])
        if not items:
            print("     🐛 Devi — no errors in the log. Clean house.")
            return 0
        print(f"     🐛 Devi — {len(items)} recent error(s), newest first:")
        for e in items[:10]:
            print(f"        · [{e['ts']}] {e['source']}: {e['message']}")
            ctx = e.get("context") or {}
            if ctx:
                print(f"          context: {ctx}")
        return 0

    if topic in ("pilot", "who"):
        print(f"     🏗 Architect — pilot is {status['pilot']!r}. "
              f"Use `lacuna ask pilot <name>` to reassign — not yet wired, use the /ctl/pilot POST.")
        return 0

    if topic in ("listings", "db"):
        print(f"     💻 Marcus — {status['listings_count']} listing(s), "
              f"{status['db_size_bytes']} bytes at {status['db_path']}.")
        return 0

    if topic == "boot":
        boot = status.get("last_boot") or {}
        if boot:
            print(f"     🚀 Kwame — last boot: {boot}")
        else:
            print("     🚀 Kwame — no boot history recorded yet.")
        return 0

    print(f"     🏗 Architect — I don't recognise topic {topic!r}.")
    print("        Try: status | errors | pilot | listings | boot")
    return 2


def _cmd_promote(args: argparse.Namespace) -> int:
    """Promote the current HEAD to TEST or PROD.

    DEV → TEST: tag `test-YYYYMMDD-NN`, push. GitHub Actions deploys.
    TEST → PROD: tag `v<semver>`, push. GitHub Actions deploys after
    manual Kwame + Architect review on the PR/release.

    Refuses to promote if the working tree is dirty or if the gate
    (pre-push hook: pytest + boundary + ports + web build) hasn't
    passed on the current HEAD.

    See docs/ENVIRONMENTS.md. Technique: The Company.
    """
    import subprocess
    from datetime import datetime, timezone

    target = (getattr(args, "target", "") or "").lower().strip()
    if target not in ("test", "prod"):
        print("usage: lacuna promote {test|prod} [--message <note>]", file=sys.stderr)
        return 2

    root = _repo_root()

    def sh(*cmd, check=True, capture=True):
        return subprocess.run(cmd, cwd=str(root), check=check,
                              capture_output=capture, text=True)

    # Working tree must be clean — we're tagging a specific commit
    dirty = sh("git", "status", "--porcelain", check=False).stdout.strip()
    if dirty:
        print("✗ working tree is dirty — commit or stash before promotion:", file=sys.stderr)
        print(dirty, file=sys.stderr)
        return 1

    sha = sh("git", "rev-parse", "--short", "HEAD").stdout.strip()

    # Discover or build a tag name
    if target == "test":
        today = datetime.now(timezone.utc).strftime("%Y%m%d")
        existing = sh("git", "tag", "-l", f"test-{today}-*", check=False).stdout.split()
        n = len(existing) + 1
        tag = f"test-{today}-{n:02d}"
        channel = "TEST"
        gate_line = "pre-push gate must pass (pytest + boundary + ports + web build)"
    else:
        # PROD needs a version argument — we don't auto-bump from the existing VERSION
        version = getattr(args, "version", None)
        if not version:
            try:
                version = (root / "VERSION").read_text().strip()
            except Exception:
                version = None
        if not version:
            print("✗ prod promotion requires --version <semver> or a readable VERSION file",
                  file=sys.stderr)
            return 1
        tag = f"v{version.lstrip('v')}"
        channel = "PROD"
        gate_line = "pre-push gate + manual Kwame/Architect review on the GitHub Release"

    msg = getattr(args, "message", None) or (
        f"promote {sha} → {channel} · Aguilar"
    )

    print(f"🚀 Kwame — promoting {sha} to {channel}")
    print(f"   tag:    {tag}")
    print(f"   note:   {msg}")
    print(f"   gate:   {gate_line}")
    print()

    # Tag locally
    try:
        sh("git", "tag", "-a", tag, "-m", msg)
    except subprocess.CalledProcessError as e:
        print(f"✗ tag failed: {e.stderr}", file=sys.stderr)
        return 1

    # Push the tag — this is the promotion act. Pre-push hook runs the gate.
    try:
        # Don't capture so the user sees hook output
        subprocess.run(["git", "push", "origin", tag], cwd=str(root), check=True)
    except subprocess.CalledProcessError:
        print(f"✗ push failed — undoing local tag {tag}", file=sys.stderr)
        sh("git", "tag", "-d", tag, check=False)
        return 1

    print()
    print(f"✓ {channel} tag pushed: {tag}")
    print(f"  GitHub Actions will deploy from this tag.")
    if channel == "PROD":
        print(f"  Create the GitHub Release at:")
        print(f"    https://github.com/lacuna-labs/project/releases/new?tag={tag}")
    return 0


def _cmd_doctor(_args: argparse.Namespace) -> int:
    import importlib.util
    ok = True
    print("🔍 lacuna doctor")
    print()

    pyver = sys.version_info
    if pyver >= (3, 10):
        print(f"  ✓ python {pyver.major}.{pyver.minor}")
    else:
        print(f"  ✗ python {pyver.major}.{pyver.minor} — need 3.10+")
        ok = False

    if importlib.util.find_spec("textual"):
        print("  ✓ textual installed")
    else:
        print("  ✗ textual NOT installed (pip install --user textual)")
        ok = False

    paths = Paths.init()
    print(f"  ✓ state dir:  {paths.root}")
    print(f"  ✓ trash dir:  {paths.trash_dir}")
    print(f"  ✓ log file:   {paths.log_file}")
    print()

    # AI / Ollama check (informational — never fails the gate).
    try:
        from . import llm as _llm
        reachable, models = _llm.probe_ollama()
        if reachable:
            print(f"  ✓ ollama reachable ({len(models)} model(s) installed)")
            preferred = "qwen2.5:3b-instruct"
            if preferred in models:
                print(f"  ✓ recommended model {preferred} installed")
            elif models:
                print(f"  ⚠ recommended model {preferred} NOT installed")
                print(f"    installed: {', '.join(models)}")
                print(f"    pull with: ollama pull {preferred}")
            else:
                print(f"  ⚠ no models installed — ollama pull {preferred}")
        else:
            print("  ⚠ ollama NOT reachable on http://localhost:11434")
            print("    (install: curl -fsSL https://ollama.com/install.sh | sh)")
            print("    cloud fallback (reasoning/cloud assist provider/cloud assist) still works if keyed")
    except Exception as e:
        print(f"  ⚠ ollama check failed: {e}")
    print()

    return 0 if ok else 1


def _cmd_ai(args: argparse.Namespace) -> int:
    """`lacuna ai` — orchestrator surface for the LLM stack."""
    sub = getattr(args, "ai_command", None) or "status"
    if sub == "status":
        return _cmd_ai_status()
    if sub == "backends":
        return _cmd_ai_backends()
    if sub == "reset":
        return _cmd_ai_reset(args)
    if sub == "rag":
        return _cmd_ai_rag(args)
    print(f"unknown ai subcommand: {sub}")
    return 2


def _cmd_ai_rag(args: argparse.Namespace) -> int:
    """`lacuna ai rag {status,build,query}` — RAG corpus controls."""
    from . import rag as _rag
    action = getattr(args, "rag_action", None) or "status"

    if action == "status":
        stats = _rag.index_stats()
        print("🤖 lacuna ai rag status")
        print()
        if not stats["exists"]:
            print(f"  ✗ no index at {stats['db']}")
            print("    build with: lacuna ai rag build")
            return 0
        print(f"  ✓ index:   {stats['db']}")
        print(f"    chunks:  {stats.get('chunks', 0)}")
        print(f"    sources: {stats.get('sources', 0)}")
        print(f"    model:   {stats.get('model', '(unknown)')}")
        if stats.get("built_at"):
            import datetime
            ts = datetime.datetime.fromtimestamp(stats["built_at"]).strftime("%Y-%m-%d %H:%M")
            print(f"    built:   {ts}")
        return 0

    if action == "build":
        print("🤖 lacuna ai rag build")
        print()
        try:
            summary = _rag.build_index(repo_root=_repo_root(), progress=True)
        except _rag.RAGUnavailable as e:
            print(f"  ✗ {e}")
            return 1
        print()
        print(f"  ✓ indexed {summary['chunks']} chunk(s) from {summary['sources']} source(s)")
        print(f"  ✓ written to {summary['db']}  (model: {summary['model']})")
        return 0

    if action == "query":
        q = getattr(args, "query_text", None)
        if not q:
            print("usage: lacuna ai rag query <text>")
            return 2
        k = getattr(args, "k", 5)
        hits = _rag.retrieve(q, k=k)
        print(f"🤖 lacuna ai rag query — top {len(hits)} match(es)")
        print()
        if not hits:
            print("  (no matches — is Ollama running and the index built?)")
            return 0
        for h in hits:
            from pathlib import Path as _P
            src = _P(h.source_path).name
            print(f"  {h.score:.3f}  {src}")
            print(f"    {h.text[:200]}{'…' if len(h.text) > 200 else ''}")
            print()
        return 0

    print(f"unknown rag action: {action}")
    return 2


def _cmd_ai_status() -> int:
    """Show the live AI orchestrator state — what's chosen, what's healthy."""
    from . import llm as _llm
    env_file = _repo_root() / "the-api" / ".env"
    info = _llm.describe_backend(env_file=env_file if env_file.exists() else None)
    print("🤖 lacuna ai status")
    print()
    print(f"  chosen backend: {info['backend']}{' (forced)' if info.get('forced') else ''}")
    if info.get("model"):
        print(f"  model:          {info['model']}")
    if info.get("key_source") and info["key_source"] != "none":
        print(f"  key source:     {info['key_source']}")
        if info.get("key_prefix"):
            print(f"  key:            {info['key_prefix']}")
    if info.get("shadowed"):
        print(f"  ⚠ key shadowed: {info['shadow_note']}")
    if info.get("ollama"):
        o = info["ollama"]
        marker = "✓" if o["reachable"] else "✗"
        print(f"  {marker} ollama:       {o['url']}")
        if o["reachable"]:
            print(f"    installed:    {', '.join(o['installed']) or '(none)'}")
            print(f"    configured:   {o['configured_model']}")
    if info.get("unhealthy"):
        print()
        print(f"  ⚠ unhealthy (skipped this process): {', '.join(info['unhealthy'])}")
        print(f"    `lacuna ai reset` to retry; or restart `lacuna up`.")
    if info.get("recent_errors"):
        print()
        print("  recent errors:")
        for e in info["recent_errors"]:
            print(f"    {e['backend']}: HTTP {e['status']} at {e['at']}")
    print()
    print(f"  precedence:     {' → '.join(info['precedence'])}")
    return 0


def _cmd_ai_backends() -> int:
    """List backend availability without picking one."""
    from . import llm as _llm
    env_file = _repo_root() / "the-api" / ".env"
    print("🤖 lacuna ai backends")
    print()
    reachable, models = _llm.probe_ollama()
    print(f"  local      {'✓' if reachable else '✗'}  Ollama on localhost:11434"
          + (f"  ({len(models)} model(s))" if reachable else "  (not running)"))
    env = _llm._read_env_keys(env_file if env_file.exists() else None)
    for name in ("deepseek", "anthropic", "openai"):
        spec = _llm._BACKEND_REGISTRY[name]
        has_key = bool(env.get(spec[0], "").strip())
        unhealthy = name in _llm._UNHEALTHY
        marker = "✗" if not has_key else ("⚠" if unhealthy else "✓")
        note = "" if has_key else " (no key)"
        if unhealthy:
            note = " (unhealthy this process)"
        print(f"  {name:10} {marker}  {spec[0]}{note}")
    print(f"  echo       ✓  always available (offline)")
    return 0


def _cmd_ai_reset(args: argparse.Namespace) -> int:
    """Clear unhealthy marks (after topping up reasoning, etc)."""
    from . import llm as _llm
    target = getattr(args, "backend", None)
    _llm.clear_unhealthy(target)
    if target:
        print(f"✓ cleared unhealthy mark for {target}")
    else:
        print("✓ cleared all unhealthy marks")
    print("(takes effect on next request; restart `lacuna up` to confirm)")
    return 0


def _cmd_config(args: argparse.Namespace) -> int:
    """`lacuna config {init,show,validate}` — YAML config controls."""
    sub = getattr(args, "config_action", None) or "show"
    if sub == "init":
        return _cmd_config_init(args)
    if sub == "show":
        return _cmd_config_show()
    if sub == "validate":
        return _cmd_config_validate()
    print(f"unknown config action: {sub}")
    return 2


def _cmd_config_init(args: argparse.Namespace) -> int:
    from . import config as _cfg
    force = getattr(args, "force", False)
    written = _cfg.write_default_configs(force=force)
    paths = _cfg.Paths.init()
    if not written:
        print(f"· config already present at {paths.root} — pass --force to overwrite")
        return 0
    print(f"✓ wrote default config to {paths.root}")
    for name, p in written.items():
        print(f"   · {name}: {p}")
    print()
    print("  edit ~/.lacuna/lacuna.yaml to customize")
    print("  validate with: lacuna config validate")
    return 0


def _cmd_config_show() -> int:
    from . import config as _cfg
    cfg = _cfg.load_config()
    print("📋 lacuna config (effective)")
    print()
    print(f"  ollama.enabled:      {cfg.ollama.enabled}")
    print(f"  ollama.url:          {cfg.ollama.url}")
    print(f"  ollama.models.chat:  {cfg.ollama.models.get('chat')}")
    print(f"  ollama.models.embed: {cfg.ollama.models.get('embed')}")
    print(f"  backends.precedence: {' → '.join(cfg.backends.precedence)}")
    print(f"  copilot.enabled:     {cfg.copilot.enabled}")
    if cfg.copilot.enabled:
        print(f"    provider:          {cfg.copilot.provider}")
        print(f"    endpoint:          {cfg.copilot.endpoint}")
    print(f"  team.roster_file:    {cfg.team.roster_file}")
    print(f"  team.anonymous:      {'on' if cfg.team.anonymous_enabled else 'off'}")
    print(f"  playbooks.dir:       {cfg.playbooks.dir}")
    print(f"  playbooks.allowlist: {cfg.playbooks.allowlist or '(any)'}")
    print()
    print(f"  source: ~/.lacuna/lacuna.yaml (env vars override)")
    return 0


def _cmd_config_validate() -> int:
    from . import config as _cfg
    errors = _cfg.validate_config()
    if not errors:
        print("✓ lacuna.yaml validates clean")
        return 0
    print("✗ lacuna.yaml has issues:")
    for e in errors:
        print(f"   · {e}")
    return 1


def _cmd_architect(args: argparse.Namespace) -> int:
    """`lacuna architect <question>` — put a question to The Architect.

    Loads the architect persona from ~/.lacuna/team.yaml (or the bundled
    default), prepends "🏗️ The Architect —" to the response so the voice
    is unambiguous. Routes through whatever backend is configured
    (local Ollama → cloud → echo).
    """
    from . import llm as _llm, team as _team

    question = (getattr(args, "question", None) or "").strip()
    if not question:
        print("usage: lacuna architect <question>")
        print("       lacuna architect 'should I refactor X?'")
        return 2

    name, system_prompt = _team.fill_role("architect")
    if not system_prompt:
        print("✗ architect persona not loaded. Run `lacuna config init` to install defaults.",
              file=sys.stderr)
        return 1

    env_file = _repo_root() / "the-api" / ".env"
    backend = _llm.select_backend(env_file=env_file if env_file.exists() else None)
    if backend.info.name == "echo":
        print("⚠ no LLM backend reachable. Install Ollama (`lacuna ai install`) "
              "or set DEEPSEEK / ANTHROPIC / OPENAI key in the-api/.env.",
              file=sys.stderr)
        return 1

    reply = backend.chat(system_prompt, [{"role": "user", "content": question}])
    if reply.startswith("["):
        # Auto-fallback once on transport error.
        backend = _llm.select_backend(env_file=env_file if env_file.exists() else None)
        if backend.info.name != "echo":
            reply = backend.chat(system_prompt, [{"role": "user", "content": question}])

    print()
    print(f"🏗️  The Architect — ({name}, via {backend.info.name})")
    print()
    # Indent two spaces for readability in the terminal.
    for line in reply.splitlines():
        print(f"  {line}")
    print()
    return 0


def _build_parser() -> argparse.ArgumentParser:
    p = argparse.ArgumentParser(
        prog="lacuna",
        description="Lacuna Labs dev environment orchestrator. Mind the gaps.",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""\
Quick tour:
  lacuna                 open the operator REPL (default)
  lacuna daemon start    boot the lacuna-api daemon in the background
  lacuna trash list      show safe-deleted items
  lacuna ai backends     show LLM backend availability
  lacuna doctor          verify install
""",
    )
    p.add_argument("--version", action="version", version=f"lacuna {__version__}")
    p.add_argument("--quiet", "-q", action="store_true", help="suppress progress output")
    p.add_argument("--verbose", "-v", action="store_true", help="debug-level logging")

    sub = p.add_subparsers(dest="command", metavar="COMMAND")

    # trash
    p_trash = sub.add_parser("trash", help="safe-delete operations")
    p_trash_sub = p_trash.add_subparsers(dest="trash_cmd")
    p_trash_sub.add_parser("list", help="list trashed items")
    p_tr_rm = p_trash_sub.add_parser("rm", help="move a path to trash")
    p_tr_rm.add_argument("path")
    p_tr_rst = p_trash_sub.add_parser("restore", help="restore by id")
    p_tr_rst.add_argument("id")
    p_trash_sub.add_parser("purge", help="purge items older than 30 days (cron invokes)")
    p_tr_emp = p_trash_sub.add_parser("empty", help="empty trash (requires --force)")
    p_tr_emp.add_argument("--force", action="store_true")

    # doctor, version, fortune
    sub.add_parser("doctor", help="verify install")
    sub.add_parser("version", help="print version")
    sub.add_parser("fortune", help="print a fortune")

    # logs
    p_logs = sub.add_parser("logs", help="show structured log (JSONL or YAML)")
    p_logs.add_argument("--tail", "-n", type=int, default=50, help="last N entries (default 50)")
    p_logs.add_argument("--yaml", action="store_true", help="YAML document stream output")

    # review, submit, push
    sub.add_parser("review", help="pre-commit gate: tests + safedelete + TODO scan")
    p_submit = sub.add_parser("submit", help="local commit (REVIEW gate runs first)")
    p_submit.add_argument("-m", "--message", default=None, help="commit message (opens editor if omitted)")
    p_push = sub.add_parser("push", help="push to remote + open PR via gh")
    p_push.add_argument("--title", default=None, help="PR title")

    # ml
    p_ml = sub.add_parser("ml", help="ML engine controls (v2.0)")
    p_ml_sub = p_ml.add_subparsers(dest="ml_cmd")
    p_ml_sub.add_parser("status", help="show ML engine state (model version, training, queue)")
    p_ml_ingest = p_ml_sub.add_parser("ingest", help="queue training data for ingestion")
    p_ml_ingest.add_argument("data_type", choices=["hallmark", "listing", "image", "provenance"],
                             help="type of training data")
    p_ml_ingest.add_argument("count", type=int, nargs="?", default=10,
                             help="number of examples to queue (default: 10)")

    # build-app
    p_build_app = sub.add_parser("build-app", help="build sibling native app (iOS/macOS)")
    p_build_app.add_argument("--env", "-e", choices=["dev", "test", "prod"], default="dev",
                             help="target environment (default: dev)")
    p_build_app.add_argument("--platform", choices=["ios", "macos", "all"], default="macos",
                             help="target platform (default: macos)")

    # stop, status
    p_stop = sub.add_parser("stop", help="stop a running environment")
    p_stop.add_argument("--env", "-e", default=None, choices=["dev", "test", "prod"],
                        help="environment to stop (default: dev)")
    p_status = sub.add_parser("status", help="show environment status")
    p_status.add_argument("--json", dest="as_json", action="store_true",
                          help="output as JSON")

    # ask — pilot/copilot control-plane query
    p_ask = sub.add_parser("ask", help="ask the running Lacuna about its state")
    p_ask.add_argument("topic", nargs="?", default="status",
                       help="status | errors | pilot | listings | boot")
    p_ask.add_argument("--port", type=int, default=5050,
                       help="API port (default: 5050)")

    # promote — DEV → TEST or TEST → PROD (v2.0 Aguilar · The Company)
    p_prom = sub.add_parser("promote",
                            help="promote HEAD to TEST or PROD (tag + push, see docs/ENVIRONMENTS.md)")
    p_prom.add_argument("target", choices=["test", "prod"],
                        help="which environment to promote to")
    p_prom.add_argument("-v", "--version", default=None,
                        help="semver (prod only); defaults to the VERSION file")
    p_prom.add_argument("-m", "--message", default=None,
                        help="annotated tag message")

    # serve — run TEST on the LAN with a .local name (v2.0.1)
    # `lacuna serve test` removed in v0.6 -- it was deeply coupled to a
    # specific sibling product (sibling) and does not belong in the
    # standalone Lacuna repo. Operators who want a generic LAN-publish
    # mechanism can use ssh tunnels or socat directly.

    # ai — orchestrator surface for the LLM stack
    p_ai = sub.add_parser("ai", help="LLM orchestrator status, backends, reset, RAG")
    p_ai_sub = p_ai.add_subparsers(dest="ai_command", metavar="SUBCOMMAND")
    p_ai_sub.add_parser("status", help="chosen backend, model, key source, ollama state")
    p_ai_sub.add_parser("backends", help="list backend availability")
    p_ai_reset = p_ai_sub.add_parser("reset", help="clear unhealthy marks (after topping up reasoning)")
    p_ai_reset.add_argument("backend", nargs="?", default=None,
                            help="backend name (omit to reset all)")
    p_ai_rag = p_ai_sub.add_parser("rag", help="RAG corpus: status / build / query")
    p_ai_rag_sub = p_ai_rag.add_subparsers(dest="rag_action", metavar="ACTION")
    p_ai_rag_sub.add_parser("status", help="index state + last-built timestamp")
    p_ai_rag_sub.add_parser("build",  help="embed the corpus (requires Ollama + nomic-embed-text)")
    p_ai_rag_q = p_ai_rag_sub.add_parser("query", help="retrieve top-k chunks for a query")
    p_ai_rag_q.add_argument("query_text", help="text to embed + search with")
    p_ai_rag_q.add_argument("-k", type=int, default=5, help="how many hits to return")

    # config — YAML config controls
    p_cfg = sub.add_parser("config", help="YAML config: init / show / validate")
    p_cfg_sub = p_cfg.add_subparsers(dest="config_action", metavar="ACTION")
    p_cfg_init = p_cfg_sub.add_parser("init", help="write default YAMLs to ~/.lacuna/")
    p_cfg_init.add_argument("--force", action="store_true",
                            help="overwrite existing config files")
    p_cfg_sub.add_parser("show", help="print effective config (env > YAML > defaults)")
    p_cfg_sub.add_parser("validate", help="check ~/.lacuna/lacuna.yaml for errors")

    # architect — put a question to The Architect (Picard register, bridge crew)
    p_arch = sub.add_parser("architect", help="put a question to The Architect")
    p_arch.add_argument("question", nargs="?", default=None,
                        help="the question (in quotes if it has spaces)")

    # repl — wrapper shell: tri-tone prompt, bash + lacuna routing
    p_repl = sub.add_parser("repl", help="open the Lacuna REPL (bash works, lacuna listens)")
    p_repl.add_argument("--setup", action="store_true",
                        help="re-run the first-time setup before entering the loop")

    # host — refresh CPU/MEM/DISK cache for the prompt theme
    p_host = sub.add_parser("host", help="host info / cache refresh for the zsh theme")
    p_host_sub = p_host.add_subparsers(dest="host_action", metavar="ACTION")
    p_host_cache = p_host_sub.add_parser("cache", help="sample CPU/MEM/DISK and write ~/.lacuna/host.cache")
    p_host_cache.add_argument("--watch", type=float, default=0.0,
                              help="re-sample every N seconds in a loop (the daemon spawns this as a worker)")
    p_host_sub.add_parser("show",  help="print current host profile")

    # daemon — backgrounded `lacuna up` with PID file + log redirect
    p_daemon = sub.add_parser("daemon", help="background daemon: start | stop | status | reload")
    p_daemon_sub = p_daemon.add_subparsers(dest="daemon_action", metavar="ACTION")
    p_daemon_start = p_daemon_sub.add_parser("start", help="spawn detached lacuna up")
    p_daemon_start.add_argument("--env", choices=["dev", "test", "prod"], default="dev")
    p_daemon_sub.add_parser("stop",   help="SIGTERM the daemon process group")
    p_daemon_sub.add_parser("status", help="report daemon liveness + uptime")
    p_daemon_reload = p_daemon_sub.add_parser("reload", help="stop + start")
    p_daemon_reload.add_argument("--env", choices=["dev", "test", "prod"], default="dev")

    # worker — Lacuna as foreman, workers as forked children
    p_worker = sub.add_parser("worker", help="manage forked workers (foreman pattern)")
    p_worker_sub = p_worker.add_subparsers(dest="worker_action", metavar="ACTION")
    p_worker_spawn = p_worker_sub.add_parser("spawn", help="spawn a named worker")
    p_worker_spawn.add_argument("name", help="unique worker name")
    p_worker_spawn.add_argument("--listen", type=int, default=None,
                                help="port the worker listens on (informational; recorded in registry)")
    p_worker_spawn.add_argument("cmd", nargs=argparse.REMAINDER,
                                help="command to run after `--`")
    p_worker_kill = p_worker_sub.add_parser("kill", help="SIGTERM a worker by name")
    p_worker_kill.add_argument("name")
    p_worker_sub.add_parser("list", help="list live workers")
    p_worker_tail = p_worker_sub.add_parser("tail", help="tail a worker's log")
    p_worker_tail.add_argument("name")
    p_worker_tail.add_argument("-n", type=int, default=20)

    # pilot — show or set the (pilot, copilot, mode) triple
    p_pilot = sub.add_parser("pilot", help="show or set the AI pilot/copilot pair")
    p_pilot_sub = p_pilot.add_subparsers(dest="pilot_action", metavar="ACTION")
    p_pilot_sub.add_parser("show", help="print the current pilot config")
    p_pilot_set = p_pilot_sub.add_parser("set", help="update pilot.yaml")
    p_pilot_set.add_argument("--pilot",   default=None, help="local | deepseek | anthropic | openai | echo")
    p_pilot_set.add_argument("--copilot", default=None, help="same set as --pilot")
    p_pilot_set.add_argument("--mode",    default=None, choices=["solo", "fallback", "race"])

    # mode — flip Lacuna's interactive permission mode (root = unlock asks)
    p_mode = sub.add_parser("mode", help="show or flip Lacuna's mode (root tier OR safe/warn/god)")
    p_mode.add_argument("which", nargs="?", default=None,
                        choices=["normal", "root", "safe", "warn", "god"],
                        help="omit to show current modes")

    return p


def _cmd_host(args: argparse.Namespace) -> int:
    """lacuna host {cache [--watch SEC] | show}"""
    from . import toolkit as _tk
    action = getattr(args, "host_action", None) or "show"
    if action == "cache":
        watch = float(getattr(args, "watch", 0.0) or 0.0)
        if watch > 0:
            # Daemon-spawned cache refresher. Loop until killed (SIGTERM).
            # Per Canon v0.3.8: when the daemon is up, the prompt's tri-tone
            # blocks reflect live CPU/MEM/DISK. This is the path that keeps
            # the cache fresh.
            print(f"  cache refresher loop · interval {watch}s · ^C to stop")
            try:
                while True:
                    _tk.write_host_cache()
                    time.sleep(watch)
            except KeyboardInterrupt:
                print("  cache refresher stopped")
                return 0
        out = _tk.write_host_cache()
        print(f"  cpu={out['cpu']}% mem={out['mem']}% disk={out['disk']}%  -> {out['path']}")
        return 0
    if action == "show":
        prof = _tk.host_profile()
        print()
        print("  Host profile")
        for k, v in prof.items():
            print(f"    {k:24s} {v}")
        print()
        return 0
    print("usage: lacuna host {cache [--watch SEC] | show}", file=sys.stderr)
    return 2


def _cmd_daemon(args: argparse.Namespace) -> int:
    """lacuna daemon start | stop | status | reload"""
    from . import daemon as _daemon
    action = getattr(args, "daemon_action", None) or "status"
    if action == "start":
        env = getattr(args, "env", "dev")
        result = _daemon.start(env)
        if result["ok"]:
            print(f"  ✓ daemon started pid={result['pid']} env={result['env']} "
                  f"port=:{result.get('port', '?')} log={result['log']}")
            return 0
        # Friendly diagnostics per the v1 review's #1 + #2 fixes
        reason = result.get("reason", "failed")
        note = result.get("note")
        if reason == "already-running":
            print(f"  daemon already running pid={result['pid']}", file=sys.stderr)
        elif reason == "port-already-bound":
            print(f"  ✗ port :{result.get('port')} is already bound", file=sys.stderr)
            if note: print(f"    {note}", file=sys.stderr)
        elif reason == "child-died-during-boot":
            print(f"  ✗ daemon child died during boot", file=sys.stderr)
            if note: print(f"    {note}", file=sys.stderr)
        elif reason == "port-not-bound-after-8s":
            print(f"  ✗ daemon process is alive but the API never bound", file=sys.stderr)
            if note: print(f"    {note}", file=sys.stderr)
        else:
            print(f"  ✗ {reason}", file=sys.stderr)
            if note: print(f"    {note}", file=sys.stderr)
        return 1
    if action == "stop":
        # If launchd has the plist loaded, ask before unloading.
        unload = False
        if _daemon._launchd_loaded():
            print("  launchd has labs.lacuna.daemon loaded — it will respawn the daemon.")
            try:
                ans = input("  unload the plist too? [y/N] ").strip().lower()
                unload = ans in ("y", "yes")
            except (KeyboardInterrupt, EOFError):
                unload = False
        result = _daemon.stop(also_unload_launchd=unload)
        if result.get("reason") == "not-running":
            print("  daemon was not running")
            if unload:
                print("  ✓ launchd plist unloaded")
            return 0
        print(f"  ✓ daemon stopped pid={result.get('pid')}")
        if unload:
            print(f"  ✓ launchd plist unloaded")
        return 0
    if action == "status":
        s = _daemon.status()
        if not s["running"]:
            print(f"  daemon: not running")
            print(f"  log:    {s['log']}")
            return 0
        print(f"  daemon: running pid={s['pid']} env={s.get('env', '?')}")
        if s.get("uptime_seconds"):
            up = s["uptime_seconds"]
            print(f"  uptime: {up}s ({up // 60}m {up % 60}s)")
        print(f"  log:    {s['log']}")
        return 0
    if action == "reload":
        env = getattr(args, "env", "dev")
        r = _daemon.reload(env)
        if r["start"]["ok"]:
            print(f"  ✓ reloaded pid={r['start']['pid']} env={r['start']['env']}")
            return 0
        print(f"  ✗ reload failed", file=sys.stderr)
        return 1
    print("usage: lacuna daemon {start | stop | status | reload}", file=sys.stderr)
    return 2


def _cmd_worker(args: argparse.Namespace) -> int:
    """lacuna worker spawn|kill|list|tail"""
    from . import worker as _worker
    action = getattr(args, "worker_action", None) or "list"
    if action == "spawn":
        name = args.name
        cmd_parts = list(args.cmd or [])
        # Strip leading '--' if present
        if cmd_parts and cmd_parts[0] == "--":
            cmd_parts = cmd_parts[1:]
        if not cmd_parts:
            print("usage: lacuna worker spawn <name> [--listen PORT] -- <cmd> [args...]", file=sys.stderr)
            return 2
        listen = getattr(args, "listen", None)
        result = _worker.spawn(name, cmd_parts, listen_port=listen)
        if not result["ok"]:
            print(f"  ✗ {result['error']}", file=sys.stderr)
            return 1
        listen_str = f" :{listen}" if listen else ""
        alive = " (alive)" if result.get("alive") else " (died — check log)"
        print(f"  ✓ worker '{name}' spawned pid={result['pid']}{listen_str}{alive}")
        print(f"    log: {result['log']}")
        return 0
    if action == "kill":
        result = _worker.kill(args.name)
        if result.get("reason") == "not-running":
            print(f"  worker '{args.name}' was not running")
            return 0
        print(f"  ✓ worker '{args.name}' killed pid={result.get('pid')}")
        return 0
    if action == "list":
        ws = _worker.list_workers()
        if not ws:
            print("  (no workers under watch)")
            return 0
        print(f"  {len(ws)} worker(s):")
        for w in ws:
            up = int(time.time() - w["started_at"])
            listen = f" :{w['listen_port']}" if w.get("listen_port") else ""
            print(f"    {w['name']:20s} pid {w['pid']:>6}{listen:>6s}  {up:>4}s  {' '.join(w['cmd'])[:60]}")
        return 0
    if action == "tail":
        n = getattr(args, "n", 20)
        lines = _worker.tail(args.name, n)
        if not lines:
            print(f"  (no log for '{args.name}')")
            return 0
        for line in lines:
            print(line)
        return 0
    print("usage: lacuna worker {spawn | kill | list | tail}", file=sys.stderr)
    return 2


def _cmd_pilot(args: argparse.Namespace) -> int:
    """lacuna pilot show | set --pilot X --copilot Y --mode Z"""
    from . import llm as _llm
    action = getattr(args, "pilot_action", None) or "show"
    if action == "show":
        cfg = _llm._read_pilot_config()
        print()
        print("  Lacuna pilot/copilot configuration")
        print(f"    pilot:    {cfg['pilot']}")
        print(f"    copilot:  {cfg['copilot']}")
        print(f"    mode:     {cfg['mode']}  (solo | fallback | race)")
        path = _llm._pilot_yaml_path()
        if not path.exists():
            print(f"    note:     pilot.yaml absent — using defaults")
        else:
            print(f"    file:     {path}")
        print()
        return 0
    if action == "set":
        cur = _llm._read_pilot_config()
        new_pilot = args.pilot or cur["pilot"]
        new_copilot = args.copilot or cur["copilot"]
        new_mode = args.mode or cur["mode"]
        try:
            _llm.write_pilot_config(new_pilot, new_copilot, new_mode)
        except ValueError as e:
            print(f"error: {e}", file=sys.stderr)
            return 2
        print(f"  pilot.yaml updated: {new_pilot} / {new_copilot} / {new_mode}")
        return 0
    print("usage: lacuna pilot {show | set --pilot X --copilot Y --mode Z}", file=sys.stderr)
    return 2


# Process-wide cache; matches `set_root_mode()` in lacuna.perms.
_LACUNA_MODE = "normal"


def _cmd_mode(args: argparse.Namespace) -> int:
    """lacuna mode [normal | root | safe | warn | god]

    Two orthogonal axes per Canon v0.5.0:
      - root tier: normal / root  (technical -- gates EXEC_ROOT prompting)
      - operating: safe / warn / god  (risk-tolerance dial for grey-area
                   requests; see persona v1.3)
    """
    from . import perms as _perms
    from . import modes as _modes
    which = getattr(args, "which", None)
    marker = Path.home() / ".lacuna" / "root-mode.marker"
    marker.parent.mkdir(parents=True, exist_ok=True)
    if which is None:
        # Show both axes
        active = marker.exists()
        op_mode = _modes.get_mode()
        print(f"  tier      : {'root' if active else 'normal'}")
        print(f"  operating : {op_mode}")
        if active:
            print(f"  note      : EXEC_ROOT prompts unlocked. Each call still asks.")
        consents = _modes.list_session_consents()
        if consents:
            print(f"  consents  : {', '.join(consents)} (this session)")
        return 0
    # Operating-mode switch (safe / warn / god). Per Canon v0.5.1:
    # show the colored wordmark in confirmation so the operator
    # sees the active stance visually, not just by reading "warn".
    if which in ("safe", "warn", "god"):
        _modes.set_mode(which)
        wordmark = _modes.colored_wordmark()
        print(f"  operating mode: {which}")
        print(f"  {wordmark} now responds in {which} mode.")
        print(f"  {_modes.MODE_DESCRIPTIONS[which].split('.')[0]}.")
        return 0
    # Root-tier switch (normal / root)
    if which == "root":
        marker.touch()
        _perms.set_root_mode(True)
        print("  tier: root")
        print("  EXEC_ROOT prompting unlocked. Each call still asks.")
        print("  Disable with `lacuna mode normal`.")
    else:  # normal
        if marker.exists():
            marker.unlink()  # noqa: safe-delete -- process bookkeeping marker
        _perms.set_root_mode(False)
        print("  tier: normal")
    return 0


def main(argv: list[str] | None = None) -> int:
    parser = _build_parser()
    args = parser.parse_args(argv)
    paths = Paths.init()
    log.init_file(paths.log_file, version=__version__)
    log.set_flags(args.quiet, args.verbose)
    log.debug("cli", f"lacuna v{__version__} invoked: {sys.argv}",
              event="boot", ctx={"cmd": args.command or "tui", "v": __version__})

    cmd = args.command
    try:
        if cmd is None:
            # Bare `lacuna` drops into the wrapper REPL (where bash works
            # and `lacuna <stuff>` routes to the daemon). The TUI is now
            # opt-in via `lacuna tui`.
            from . import repl as _repl
            return _repl.run()
        if cmd == "trash":
            return _cmd_trash(args)
        if cmd == "doctor":
            return _cmd_doctor(args)
        if cmd == "version":
            return _cmd_version(args)
        if cmd == "logs":
            return _cmd_logs(args)
        if cmd == "fortune":
            _print_fortune()
            return 0
        if cmd == "ml":
            return _cmd_ml(args)
        if cmd == "ai":
            return _cmd_ai(args)
        if cmd == "config":
            return _cmd_config(args)
        if cmd == "architect":
            return _cmd_architect(args)
        if cmd == "build-app":
            return _cmd_build_app(args)
        if cmd == "review":
            return _cmd_review(args)
        if cmd == "submit":
            return _cmd_submit(args)
        if cmd == "push":
            return _cmd_push(args)
        if cmd == "stop":
            return _cmd_stop(getattr(args, "env", None) or "dev")
        if cmd == "status":
            return _cmd_status(getattr(args, "as_json", False))
        if cmd == "ask":
            return _cmd_ask(args)
        if cmd == "promote":
            return _cmd_promote(args)
        if cmd == "pilot":
            return _cmd_pilot(args)
        if cmd == "mode":
            return _cmd_mode(args)
        if cmd == "repl":
            from . import repl as _repl
            if getattr(args, "setup", False):
                _repl.SETUP_MARKER.unlink(missing_ok=True)  # noqa: safe-delete — repl setup marker is operator state, not user data
            return _repl.run()
        if cmd == "host":
            return _cmd_host(args)
        if cmd == "daemon":
            return _cmd_daemon(args)
        if cmd == "worker":
            return _cmd_worker(args)
        print(f"unknown command: {cmd}", file=sys.stderr)
        return 2
    except KeyboardInterrupt:
        print()
        return 130


if __name__ == "__main__":
    sys.exit(main())
