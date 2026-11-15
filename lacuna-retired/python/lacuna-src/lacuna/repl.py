"""Lacuna REPL -- pure chat surface. Mirrors the web console's UX.

Per Alfred's S20+ rewrite directive: the CLI REPL is a chat surface,
not a wrapper shell. Type a line, Lacuna replies; that is the entire
interaction. The discipline matches the web console at
http://localhost:2001/ -- same chat-avatar render, same prompt
structure, same conversation context, same voice.

Design principles (from the Lacuna DID v1.0 + canon series):

  1. The mark sets the tone. Avatar on its own line per Canon v0.3.12;
     body indented 2 spaces per Canon v0.4.1; soft-wrap at cols-2.
  2. Voice is italic-mid grey. No em-dashes. No sign-off (avatar
     carries identity per Canon v0.3.13).
  3. Three-mode operating stance per Canon v0.5.1: safe / warn / god.
     Wordmark color binds to active mode; visible immediately.
  4. Conversation context preserved across turns per Canon v0.5.0.
     :reset clears the running history.
  5. No shell exec, no cd built-in, no dangerous-command guard. Those
     belong in the operator's regular shell, not in Lacuna's chat
     surface. Operators who need shell open another terminal pane.
  6. Streaming responses paced at 50 cps per Doherty (1979) /
     Tognazzini -- "being written" feel without "streaming bytes."
  7. Card-without-borders render per Canon v0.3.15 + v0.3.17:
     word-buffered word-wrap, model-emitted newlines collapsed.

Built-in colon-commands (the only non-chat surface):

  :help          show help
  :tools         list deterministic toolkit functions
  :perms         show live permission grants
  :host          live CPU / MEM / DISK readout
  :mode [m]      show or set operating mode (safe / warn / god)
  :reset         clear conversation history + warn-mode consents
  :exit          leave (synonyms: exit, quit, q)

Everything else is sent to /ctl/chat as a chat turn.
"""
from __future__ import annotations

import json
import os
import sys
import urllib.error
import urllib.request
from pathlib import Path


# -- paths -------------------------------------------------------------------

REPL_HISTFILE = Path.home() / ".lacuna" / "repl_history"
SETUP_MARKER  = Path.home() / ".lacuna" / "repl-setup-done"


# -- ANSI palette (used everywhere; tone-only, no chromatic hue per DID) -----
_LIGHT = "\x1b[38;2;212;212;212m"   # canonical light  #d4d4d4
_MID   = "\x1b[38;2;136;136;136m"   # canonical mid    #888888
_DARK  = "\x1b[38;2;26;26;26m"      # canonical dark   #1a1a1a
_ROSE  = "\x1b[38;2;207;107;107m"   # pressure tint    #cf6b6b
_DIM   = "\x1b[38;5;251m"           # 256-friendly dim
_RESET = "\x1b[0m"
_ITALIC = "\x1b[3m"


# -- pacing (Canon v0.3.6 / v0.3.19) -----------------------------------------
_CHAR_PACE_SEC = 0.020      # 50 chars/sec; "being written" band
_SPINNER_GLYPH = "⠿"


# -- conversation state (Canon v0.5.0) ---------------------------------------
_CONVO_HISTORY: list[dict[str, str]] = []
_CONVO_BUDGET_CHARS = 6000


def _convo_trim() -> None:
    while _CONVO_HISTORY:
        total = sum(len(m.get("content", "")) for m in _CONVO_HISTORY)
        if total <= _CONVO_BUDGET_CHARS:
            return
        del _CONVO_HISTORY[:2]


def _convo_reset() -> None:
    _CONVO_HISTORY.clear()


# -- helpers used by tests + render -----------------------------------------

def _supports_truecolor() -> bool:
    return os.environ.get("COLORTERM", "").lower() in ("truecolor", "24bit")


def _short_path(cwd: str) -> str:
    home = str(Path.home())
    if cwd.startswith(home):
        cwd = "~" + cwd[len(home):]
    parts = cwd.split("/")
    if len(parts) > 4:
        return f"{parts[0]}/.../{parts[-2]}/{parts[-1]}"
    return cwd


def _tone(pct: int) -> str:
    if pct >= 95: return _ROSE
    if pct >= 90: return _DARK
    if pct >= 50: return _MID
    return _LIGHT


def _read_host_cache() -> tuple[int, int, int]:
    cache = Path.home() / ".lacuna" / "host.cache"
    if not cache.exists():
        return 0, 0, 0
    try:
        import time as _t
        if _t.time() - cache.stat().st_mtime > 30:
            return 0, 0, 0
        text = cache.read_text().strip()
        out = {"cpu": 0, "mem": 0, "disk": 0}
        for token in text.split():
            if "=" in token:
                k, v = token.split("=", 1)
                if k in out and v.isdigit():
                    out[k] = int(v)
        return out["cpu"], out["mem"], out["disk"]
    except Exception:
        return 0, 0, 0


_GIT_CACHE: dict = {}


def _git_branch_glyph(cwd: str) -> str:
    if cwd in _GIT_CACHE:
        return _GIT_CACHE[cwd]
    out = ""
    try:
        import subprocess as _sp
        r = _sp.run(["git", "branch", "--show-current"],
                    capture_output=True, text=True, timeout=0.3, cwd=cwd)
        if r.returncode == 0 and r.stdout.strip():
            out = f" {_DIM}on {_RESET}{_LIGHT}{r.stdout.strip()}{_RESET}"
    except Exception:
        out = ""
    if len(_GIT_CACHE) > 32:
        _GIT_CACHE.clear()
    _GIT_CACHE[cwd] = out
    return out


# -- prompt + avatar ---------------------------------------------------------

def _build_prompt(last_rc: int = 0) -> str:
    """Two-line prompt per Canon v0.3.12 + v0.4.1. Top line: place +
    branch + status badges. Cursor line: HH:MM at col 0, cursor at col 7.
    Avatar (mark + Lacuna word) appears ONLY on Lacuna's replies."""
    import time as _t
    cwd = os.getcwd()
    path = _short_path(cwd)
    branch = _git_branch_glyph(cwd)
    err = f" {_ROSE}×{_RESET}" if last_rc != 0 else ""
    time_str = _t.strftime("%H:%M")
    try:
        from . import status as _status
        badges = _status.render_badges()
    except Exception:
        badges = ""
    return f"\n{_DIM}{path}{_RESET}{branch}{err}{badges}\n{_DIM}{time_str}{_RESET}  "


def _render_chat_avatar() -> str:
    """The speaker label per Canon v0.3.12. Mark + wordmark; word color
    binds to the active operating mode per Canon v0.5.1."""
    if not _supports_truecolor():
        # Tones still bind to mode via 256/basic; word renders.
        try:
            from . import modes as _modes
            return f"██████  {_modes.colored_wordmark()}"
        except Exception:
            return "██████  Lacuna"
    blocks = (f"\x1b[38;2;212;212;212m██"
              f"\x1b[38;2;136;136;136m██"
              f"\x1b[38;2;26;26;26m██{_RESET}")
    try:
        from . import modes as _modes
        word = _modes.colored_wordmark()
    except Exception:
        word = f"{_LIGHT}Lacuna{_RESET}"
    return f"{blocks}  {word}"


# -- daemon liveness probe ---------------------------------------------------

def _daemon_port() -> int:
    """Resolve the running daemon's port from its meta file; fall back to the
    canonical dev default (1138) if the meta isn't available. Reading from
    meta keeps the REPL in lockstep with whatever port the daemon actually
    bound — no hardcoded port to drift out of sync with daemon.DEFAULT_PORTS.
    """
    try:
        meta_path = Path.home() / ".lacuna" / "daemon.json"
        if meta_path.exists():
            return int(json.loads(meta_path.read_text()).get("api_port", 1138))
    except Exception:
        pass
    return 1138


def _daemon_alive(port: int | None = None, timeout: float = 0.4) -> bool:
    """Probe /healthz; the daemon's only no-state ack route.

    Previous form probed /api/status which was a stale path from a
    pre-/ctl/* convention; lacuna-api now exposes /healthz + /ctl/*
    only, so /api/status returns 404 and we'd erroneously declare the
    daemon offline.
    """
    if port is None:
        port = _daemon_port()
    try:
        with urllib.request.urlopen(
            f"http://localhost:{port}/healthz", timeout=timeout
        ):
            return True
    except Exception:
        return False


# -- streaming chat (the load-bearing render path) ---------------------------

def _ctl_chat_stream(message: str, port: int | None = None) -> int:
    """POST to /ctl/chat with full conversation history. Render incremental
    deltas with the Canon v0.3.17 word-buffer algorithm: collapse model
    newlines to spaces; pre-word soft-wrap at cols-2; 4-space body
    indent (well, 2-space per Canon v0.4.1)."""
    import time as _t

    if port is None:
        port = _daemon_port()

    if not _daemon_alive(port):
        # Toolkit-only fallback (ReAct local). Daemon is the chat backend;
        # without it we do what the deterministic toolkit can do.
        return _route_locally(message)

    # Append user message; trim against budget
    _CONVO_HISTORY.append({"role": "user", "content": message})
    _convo_trim()
    body = json.dumps({"messages": list(_CONVO_HISTORY)}).encode()

    req = urllib.request.Request(
        f"http://localhost:{port}/ctl/chat",
        data=body,
        headers={"Accept": "text/event-stream", "Content-Type": "application/json"},
    )

    # Pre-first-token spinner; erased on first delta
    sys.stdout.write("  " + _DIM + _SPINNER_GLYPH + _RESET)
    sys.stdout.flush()
    first_delta = True

    # Word-buffer state for the streaming render
    try:
        import shutil as _sh
        _term_cols = _sh.get_terminal_size((80, 24)).columns
    except Exception:
        _term_cols = 80
    _wrap_width = max(20, _term_cols - 2)
    response_col = 0
    pending_word = ""
    assistant_buf: list[str] = []

    def _flush_word() -> None:
        nonlocal pending_word, response_col
        if not pending_word:
            return
        if response_col + len(pending_word) > _wrap_width:
            sys.stdout.write("\n  ")
            response_col = 2
        for c in pending_word:
            sys.stdout.write(c)
            sys.stdout.flush()
            response_col += 1
            _t.sleep(_CHAR_PACE_SEC)
        pending_word = ""

    try:
        with urllib.request.urlopen(req, timeout=60) as resp:
            # Daemon may return either SSE (Content-Type: text/event-stream)
            # or a single JSON object (Content-Type: application/json).
            # /ctl/chat today returns JSON; the SSE path below stays in
            # for forward-compat when the daemon grows a streaming variant.
            if "application/json" in resp.headers.get("Content-Type", "").lower():
                try:
                    payload = json.loads(resp.read())
                except json.JSONDecodeError:
                    payload = {}
                content = (payload.get("content") or "").strip()
                # Erase spinner; emit avatar; render content with the same
                # word-buffer / character-pacing animation the SSE path uses.
                sys.stdout.write("\b\b\b   \b\b\b")
                sys.stdout.write(_render_chat_avatar() + "\n  ")
                sys.stdout.write(_ITALIC + _MID)
                response_col = 2
                for ch in content:
                    if ch in ("\n", " ", "\t"):
                        _flush_word()
                        if response_col > 2 and response_col < _wrap_width:
                            sys.stdout.write(" ")
                            sys.stdout.flush()
                            response_col += 1
                            _t.sleep(_CHAR_PACE_SEC)
                    else:
                        pending_word += ch
                _flush_word()
                sys.stdout.write(_RESET + "\n")
                sys.stdout.flush()
                if content:
                    _CONVO_HISTORY.append({"role": "assistant", "content": content})
                    _convo_trim()
                return 0
            # SSE streaming path (forward-compat)
            for raw in resp:
                line = raw.decode(errors="replace").strip()
                if not line.startswith("data:"):
                    continue
                payload = line[5:].strip()
                if payload == "[DONE]":
                    _flush_word()
                    sys.stdout.write(_RESET + "\n")
                    sys.stdout.flush()
                    full_reply = "".join(assistant_buf).strip()
                    if full_reply:
                        _CONVO_HISTORY.append({"role": "assistant", "content": full_reply})
                        _convo_trim()
                    return 0
                try:
                    chunk = json.loads(payload)
                except json.JSONDecodeError:
                    continue
                if "delta" in chunk:
                    assistant_buf.append(chunk["delta"])
                    if first_delta:
                        # Erase spinner; emit avatar on its own line; drop
                        # to indented body line per Canon v0.4.1.
                        sys.stdout.write("\b\b\b   \b\b\b")
                        sys.stdout.write(_render_chat_avatar() + "\n  ")
                        sys.stdout.write(_ITALIC + _MID)
                        first_delta = False
                        response_col = 2
                    for ch in chunk["delta"]:
                        if ch in ("\n", " ", "\t"):
                            _flush_word()
                            if response_col > 2 and response_col < _wrap_width:
                                sys.stdout.write(" ")
                                sys.stdout.flush()
                                response_col += 1
                                _t.sleep(_CHAR_PACE_SEC)
                        else:
                            pending_word += ch
        # Stream closed without [DONE]; flush trailing word
        _flush_word()
        sys.stdout.write(_RESET + "\n")
        sys.stdout.flush()
        full_reply = "".join(assistant_buf).strip()
        if full_reply:
            _CONVO_HISTORY.append({"role": "assistant", "content": full_reply})
            _convo_trim()
        return 0
    except urllib.error.URLError as e:
        sys.stdout.write(_RESET)
        print(f"  {_DIM}daemon dropped: {e}. Toolkit-only fallback.{_RESET}",
              file=sys.stderr)
        return _route_locally(message)


def _route_locally(message: str) -> int:
    """Daemon-down path: deterministic toolkit only (no LLM)."""
    try:
        from . import router as _router
        result = _router.route(message)
    except Exception as e:
        print(f"  {_ROSE}router unavailable: {e}{_RESET}", file=sys.stderr)
        return 1
    if result.from_toolkit:
        # Render the toolkit answer with the avatar prefix for parity with
        # the LLM path. Body indented per the card.
        avatar = _render_chat_avatar()
        sys.stdout.write(f"  {avatar}\n  {_ITALIC}{_MID}")
        sys.stdout.write(result.text.strip())
        sys.stdout.write(f"{_RESET}\n")
        return 0
    print(f"  {_DIM}Daemon offline; that one needs the model. "
          f"Start with: lacuna daemon start{_RESET}")
    return 1


# -- greeting (Canon v0.3.18) ------------------------------------------------

def _print_greeting() -> None:
    """First reply Lacuna emits when the operator drops in. Mirrors the
    web console's connect-time greeting: avatar on its own line, indented
    body text in voice register. Picks from a small pool keyed on
    time-of-day + state (kept minimal here; the web's pool is canonical)."""
    import datetime as _dt
    avatar = _render_chat_avatar()
    sys.stdout.write(f"\n  {avatar}\n  {_ITALIC}{_MID}")

    hour = _dt.datetime.now().hour
    if hour < 5:    line = "Late hours. The fans are quiet. What did you come in for?"
    elif hour < 11: line = "Good morning. The host's calm. What can I help with?"
    elif hour < 17: line = "Hello. I'm here whenever you're ready."
    elif hour < 22: line = "Good evening. End of the day; what's left to clear?"
    else:           line = "Past hours. I'm here. Take your time."

    sys.stdout.write(line)
    sys.stdout.write(f"{_RESET}\n")


# -- colon-commands ----------------------------------------------------------

def _show_help() -> None:
    print(f"""
  {_DIM}Lacuna -- chat surface.{_RESET}

  {_DIM}Type any line to chat. Replies stream in voice register.{_RESET}

  {_DIM}Colon commands:{_RESET}
    :help            show this text
    :tools           list deterministic toolkit functions
    :perms           show live permission grants
    :host            live CPU / MEM / DISK readout
    :mode [m]        show or set operating mode (safe / warn / god)
    :reset           clear conversation history
    :exit            leave (synonyms: exit, quit, q)
""")


def _show_tools() -> None:
    try:
        from . import toolkit as _tk
    except Exception as e:
        print(f"  {_ROSE}toolkit unavailable: {e}{_RESET}")
        return
    print()
    print(f"  {_DIM}Toolkit functions (deterministic, < 100ms each):{_RESET}")
    for d in _tk.describe():
        print(f"    {d['name']:18s} {d['signature']}")
    print()


def _show_host() -> None:
    cpu, mem, disk = _read_host_cache()
    def label(p: int) -> str:
        if p >= 95: return "RED"
        if p >= 90: return "dark"
        if p >= 50: return "mid"
        return "light"
    print()
    print(f"  {_tone(cpu)}██{_RESET}  CPU   {cpu:>3}%  ({label(cpu)})")
    print(f"  {_tone(mem)}██{_RESET}  MEM   {mem:>3}%  ({label(mem)})")
    print(f"  {_tone(disk)}██{_RESET}  DISK  {disk:>3}%  ({label(disk)})")
    print()


def _show_perms() -> None:
    try:
        from . import perms as _perms
        import time as _t
    except Exception as e:
        print(f"  {_ROSE}perms unavailable: {e}{_RESET}")
        return
    print()
    print(f"  {_DIM}Live permission grants:{_RESET}")
    grants = _perms.list_grants()
    if not grants:
        print(f"    {_DIM}(none -- only READ_LOCAL is auto-granted){_RESET}")
    else:
        for g in grants:
            ttl = ("permanent" if g.expires_at == -1
                   else "single-use" if g.expires_at == 0
                   else f"{int(g.expires_at - _t.time())}s left")
            print(f"    {g.tier.name:14s} {g.scope:30s}  {ttl}")
    print()


def _handle_mode(rest: str) -> int:
    try:
        from . import modes as _modes
    except Exception as e:
        print(f"  {_ROSE}modes unavailable: {e}{_RESET}")
        return 1
    rest = rest.strip().lower()
    if not rest:
        print(f"  operating mode: {_modes.colored_wordmark()} {_DIM}({_modes.get_mode()}){_RESET}")
        consents = _modes.list_session_consents()
        if consents:
            print(f"  consents      : {_DIM}{', '.join(consents)} (this session){_RESET}")
        return 0
    try:
        _modes.set_mode(rest)
    except ValueError as e:
        print(f"  {_ROSE}{e}{_RESET}")
        return 1
    print(f"  {_modes.colored_wordmark()} now responds in {rest} mode.")
    return 0


# -- readline setup ----------------------------------------------------------

def _setup_readline() -> None:
    try:
        import readline
        REPL_HISTFILE.parent.mkdir(parents=True, exist_ok=True)
        if REPL_HISTFILE.exists():
            try:
                readline.read_history_file(REPL_HISTFILE)
            except Exception:
                pass
        readline.set_history_length(2000)
        import atexit
        atexit.register(_save_history)
    except ImportError:
        pass


def _save_history() -> None:
    try:
        import readline
        readline.write_history_file(REPL_HISTFILE)
    except Exception:
        pass


# -- main loop ---------------------------------------------------------------

def run() -> int:
    """Pure chat REPL. Mirrors the web console's UX. Returns the last
    chat-turn's exit code on exit."""
    _setup_readline()

    # Greeting -- the web console's contextual welcome. Per Canon v0.3.18
    # the web has a fuller pool; the CLI variant here is the minimal
    # working version. No multi-line system banner.
    _print_greeting()

    last_rc = 0
    while True:
        try:
            line = input(_build_prompt(last_rc))
        except (EOFError, KeyboardInterrupt):
            print()
            break

        line = line.rstrip("\n").strip()
        if not line:
            continue

        # Colon commands and exit synonyms
        if line in ("exit", ":exit", "quit", "q", ":quit"):
            break
        if line == ":help":
            _show_help();  last_rc = 0;  continue
        if line == ":tools":
            _show_tools();  last_rc = 0;  continue
        if line == ":perms":
            _show_perms();  last_rc = 0;  continue
        if line == ":host":
            _show_host();  last_rc = 0;  continue
        if line == ":reset":
            _convo_reset()
            try:
                from . import modes as _modes
                _modes.clear_session_consents()
            except Exception:
                pass
            print(f"  {_DIM}conversation history cleared.{_RESET}")
            last_rc = 0
            continue
        if line == ":mode" or line.startswith(":mode "):
            rest = line[5:] if line.startswith(":mode ") else ""
            last_rc = _handle_mode(rest)
            continue

        # Default path: send to chat
        last_rc = _ctl_chat_stream(line)

    return last_rc
