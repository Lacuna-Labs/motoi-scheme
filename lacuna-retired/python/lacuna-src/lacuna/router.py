"""Lacuna router — rule-first dispatch to the toolkit, LLM fallback for misses.

Architecture: MRKL routing layer (Karpas et al., AI21 2022). For predictable
ops queries the model is bypassed entirely — the regex table dispatches to
a toolkit function, the result is formatted in HAL register, the operator
gets the answer in <100ms with zero token cost.

Misses fall through to the LLM via select_pilot_pair() with toolkit context
pre-injected. The LLM may emit `TOOL: name(arg1, arg2)` lines to call further
toolkit functions; the router parses those, executes, and feeds the result
back. Max 3 tool hops per turn (ReAct guard rail).
"""
from __future__ import annotations

import json
import re
from dataclasses import dataclass
from typing import Any, Callable

from . import toolkit as _toolkit


# ── result envelope ──────────────────────────────────────────────────────────

@dataclass
class RouteResult:
    """What the router returns. `from_toolkit` is True when the rule matched
    and the LLM was bypassed entirely."""
    text: str
    from_toolkit: bool
    tool_calls: list[dict]              # [{name, args, result}, ...]
    fallback_reason: str | None = None  # set when LLM fallback is needed


# ── HAL-register formatters ──────────────────────────────────────────────────

def _fmt_health(h: dict) -> str:
    """One line per service. Terse. Sign as Lacuna."""
    rows = []
    for svc in ("api", "web", "ollama"):
        s = h.get(svc, {})
        port = s.get("port", "?")
        st = s.get("status", "?")
        if st == "listen":
            rows.append(f"{svc:7s} :{port}  up   pid {s.get('pid', '?')}")
        elif st == "free":
            rows.append(f"{svc:7s} :{port}  down")
        else:
            rows.append(f"{svc:7s} :{port}  {st}")
    body = "\n".join(rows)
    return f"```\n{body}\n```"


def _fmt_port(svc: str, port: int | None) -> str:
    if port is None:
        return f"No canonical port for `{svc}`. Check docs/PORTS.md."
    return f"`{svc}` is on port **{port}** (per docs/PORTS.md)."


def _fmt_log(name: str, lines: list[str]) -> str:
    if not lines:
        return f"No log named `{name}`, or it is empty."
    body = "\n".join(lines)
    return f"```\n{body}\n```"


def _fmt_errors(errs: list[dict]) -> str:
    if not errs:
        return "Error log is empty."
    rows = []
    for e in errs:
        ts = e.get("ts", "?")
        msg = e.get("message") or e.get("msg") or "?"
        rows.append(f"  {ts}  {str(msg)[:120]}")
    body = "\n".join(rows)
    return f"Last {len(errs)} errors:\n{body}"


def _fmt_git(g: dict) -> str:
    if g.get("error"):
        return f"git: {g['error']}"
    parts = [f"branch `{g.get('branch')}`"]
    if g.get("dirty_count"):
        parts.append(f"{g['dirty_count']} dirty file(s)")
    if "ahead" in g:
        parts.append(f"ahead {g['ahead']}, behind {g.get('behind', 0)}")
    if g.get("last_commit"):
        parts.append(f"last: `{g['last_commit']}`")
    return "  ".join(parts) + ""


def _fmt_disk(d: dict) -> str:
    if d.get("error"):
        return f"disk: {d['error']}"
    pct = d.get("used_pct", 0)
    free_gb = d.get("free_bytes", 0) / 1024 / 1024 / 1024
    note = ""
    if pct >= 95:
        note = "  I would advise pruning."
    elif pct >= 85:
        note = "  Pressure rising."
    return f"`{d['path']}` is {pct}% used. {free_gb:.1f} GB free.{note}"


def _fmt_processes(ps: list[dict], needle: str) -> str:
    if not ps:
        return f"No process matches `{needle}`."
    rows = [f"  pid {p['pid']:>6}  {p['cpu_pct']:>5.1f}%  {p['rss_kb']/1024:>5.0f}M  {p['command'][:60]}" for p in ps[:10]]
    body = "\n".join(rows)
    suffix = f"\n  ... ({len(ps) - 10} more)" if len(ps) > 10 else ""
    return f"{len(ps)} match(es) for `{needle}`:\n```\n{body}{suffix}\n```"


def _fmt_docs(hits: list[dict], topic: str) -> str:
    if not hits:
        return f"No docs/ entry matches `{topic}`."
    rows = [f"  - {h['path']} :: {h['heading']}" for h in hits[:6]]
    return f"Found in docs/:\n" + "\n".join(rows) + ""


def _fmt_bugs(hits: list[dict], query: str) -> str:
    if not hits:
        return f"No bug matches `{query}`."
    rows = [f"  - {h['title'][:120]}" for h in hits[:5]]
    return f"BUGS.md matches for `{query}`:\n" + "\n".join(rows) + ""


def _fmt_host(h: dict) -> str:
    if h.get("error"):
        return f"host: {h['error']}"
    arch = h.get("arch", "?")
    cores = h.get("cores_physical", "?")
    ram = h.get("ram_gb", "?")
    avx = "yes" if h.get("has_avx2") else "no"
    rec = h.get("model_recommendation", "?")
    return (
        f"This machine: `{arch}`, {cores} physical cores, {ram} GB RAM, AVX2 {avx}.\n"
        f"Recommended chat model: `{rec}`."
    )


def _fmt_workers(ws: list[dict]) -> str:
    if not ws:
        return "No workers under watch."
    rows = [f"  - {w.get('name')} pid {w.get('pid')} listen :{w.get('listen_port', '-')}" for w in ws]
    return f"Workers ({len(ws)}):\n" + "\n".join(rows) + ""


# ── pattern table ────────────────────────────────────────────────────────────

@dataclass
class Rule:
    pattern: re.Pattern
    handler: Callable[[re.Match, dict], RouteResult]
    label: str  # for debug / :rules


def _h_health(m: re.Match, _ctx: dict) -> RouteResult:
    env = _ctx.get("env", "dev")
    h = _toolkit.service_health(env)
    return RouteResult(_fmt_health(h), True, [{"name": "service_health", "args": {"env": env}, "result": h}])


def _h_port(m: re.Match, _ctx: dict) -> RouteResult:
    svc = m.group("svc").strip()
    p = _toolkit.port_for(svc)
    return RouteResult(_fmt_port(svc, p), True, [{"name": "port_for", "args": {"service": svc}, "result": p}])


def _h_log(m: re.Match, _ctx: dict) -> RouteResult:
    name = (m.groupdict().get("name") or "lacuna").strip()
    n_str = m.groupdict().get("n")
    n = int(n_str) if n_str and n_str.isdigit() else 20
    lines = _toolkit.tail_log(name, n)
    return RouteResult(_fmt_log(name, lines), True, [{"name": "tail_log", "args": {"name": name, "n": n}, "result": f"{len(lines)} lines"}])


def _h_errors(m: re.Match, _ctx: dict) -> RouteResult:
    errs = _toolkit.recent_errors(10)
    return RouteResult(_fmt_errors(errs), True, [{"name": "recent_errors", "args": {"n": 10}, "result": f"{len(errs)} entries"}])


def _h_git(m: re.Match, _ctx: dict) -> RouteResult:
    g = _toolkit.git_terse()
    return RouteResult(_fmt_git(g), True, [{"name": "git_terse", "args": {}, "result": g.get("branch")}])


def _h_disk(m: re.Match, _ctx: dict) -> RouteResult:
    d = _toolkit.disk_usage("/")
    return RouteResult(_fmt_disk(d), True, [{"name": "disk_usage", "args": {"path": "/"}, "result": d.get("used_pct")}])


def _h_processes(m: re.Match, _ctx: dict) -> RouteResult:
    needle = m.group("needle").strip()
    ps = _toolkit.process_grep(needle)
    return RouteResult(_fmt_processes(ps, needle), True, [{"name": "process_grep", "args": {"name": needle}, "result": f"{len(ps)} matches"}])


def _h_docs(m: re.Match, _ctx: dict) -> RouteResult:
    topic = m.group("topic").strip()
    hits = _toolkit.docs_lookup(topic)
    return RouteResult(_fmt_docs(hits, topic), True, [{"name": "docs_lookup", "args": {"topic": topic}, "result": f"{len(hits)} hits"}])


def _h_bugs(m: re.Match, _ctx: dict) -> RouteResult:
    query = m.group("query").strip()
    hits = _toolkit.bug_search(query)
    return RouteResult(_fmt_bugs(hits, query), True, [{"name": "bug_search", "args": {"query": query}, "result": f"{len(hits)} hits"}])


def _h_host(m: re.Match, _ctx: dict) -> RouteResult:
    h = _toolkit.host_profile()
    return RouteResult(_fmt_host(h), True, [{"name": "host_profile", "args": {}, "result": h.get("model_recommendation")}])


def _h_workers(m: re.Match, _ctx: dict) -> RouteResult:
    ws = _toolkit.worker_list()
    return RouteResult(_fmt_workers(ws), True, [{"name": "worker_list", "args": {}, "result": f"{len(ws)} workers"}])


# Order matters: more-specific patterns first.
RULES: list[Rule] = [
    Rule(re.compile(r"^\s*/?(?:is|are)\s+(?:the\s+)?(?:project|api|web|ollama|services?|stack)?\s*(?:up|running|alive)\??\s*$", re.I), _h_health, "health/up"),
    Rule(re.compile(r"^\s*/?(?:health|status|services?)\s*\??\s*$", re.I), _h_health, "health"),

    Rule(re.compile(r"^\s*/?(?:what(?:'?s|\s+is)\s+(?:the\s+)?)?port\s+(?:for|of)\s+(?P<svc>[\w.\-]+)\s*\??\s*$", re.I), _h_port, "port-for"),

    Rule(re.compile(r"^\s*/?tail\s+(?:the\s+)?(?:log\s+)?(?P<name>[\w.\-]+)?(?:\s+(?P<n>\d+))?\s*$", re.I), _h_log, "tail"),
    Rule(re.compile(r"^\s*/?logs?\s*$", re.I), _h_log, "logs"),

    Rule(re.compile(r"^\s*/?(?:recent\s+)?errors?\s*\??\s*$", re.I), _h_errors, "errors"),
    Rule(re.compile(r"^\s*/?what(?:'?s|\s+is)\s+broken\s*\??\s*$", re.I), _h_errors, "what's broken"),

    Rule(re.compile(r"^\s*/?(?:git\s+)?(?:status|branch|diff\s+stat)\s*\??\s*$", re.I), _h_git, "git"),
    Rule(re.compile(r"^\s*/?git\s*$", re.I), _h_git, "git-bare"),

    Rule(re.compile(r"^\s*/?disk(?:\s+usage)?\s*\??\s*$", re.I), _h_disk, "disk"),
    Rule(re.compile(r"^\s*/?(?:how\s+much\s+)?(?:disk|space)\s+(?:do\s+i\s+have|free|left)\s*\??\s*$", re.I), _h_disk, "disk-natural"),

    Rule(re.compile(r"^\s*/?(?:ps|processes?|find\s+process)\s+(?P<needle>.+?)\s*$", re.I), _h_processes, "processes"),

    Rule(re.compile(r"^\s*/?docs?\s+(?P<topic>.+?)\s*$", re.I), _h_docs, "docs"),
    Rule(re.compile(r"^\s*/?find\s+in\s+docs?\s+(?P<topic>.+?)\s*$", re.I), _h_docs, "docs-natural"),

    Rule(re.compile(r"^\s*/?bugs?\s+(?P<query>.+?)\s*$", re.I), _h_bugs, "bugs"),

    Rule(re.compile(r"^\s*/?(?:host|profile|machine|hardware|model)\s*\??\s*$", re.I), _h_host, "host"),
    Rule(re.compile(r"^\s*/?(?:what(?:'?s|\s+is)\s+(?:my\s+)?)?(?:hardware|machine|cpu)\s*\??\s*$", re.I), _h_host, "host-natural"),

    Rule(re.compile(r"^\s*/?workers?\s*\??\s*$", re.I), _h_workers, "workers"),
]


# ── public entry point ───────────────────────────────────────────────────────

def route(query: str, ctx: dict | None = None) -> RouteResult:
    """Try each rule in order. Return the first match's result. If no rule
    matches, return a RouteResult with from_toolkit=False signaling the
    caller should invoke the LLM."""
    ctx = ctx or {}
    for rule in RULES:
        m = rule.pattern.match(query)
        if m:
            try:
                return rule.handler(m, ctx)
            except Exception as e:
                # Toolkit call failed unexpectedly. Fall through to LLM but
                # record the attempt so the LLM has context.
                return RouteResult(
                    text="", from_toolkit=False, tool_calls=[],
                    fallback_reason=f"rule '{rule.label}' raised: {e}",
                )
    return RouteResult(
        text="", from_toolkit=False, tool_calls=[],
        fallback_reason="no rule matched",
    )


# ── ReAct loop helpers (used when LLM fallback engages) ──────────────────────

# Pattern: TOOL: name(arg1, arg2, key=value)
_TOOL_CALL_RE = re.compile(
    r"^\s*TOOL:\s*(?P<name>\w+)\s*\((?P<args>.*)\)\s*$",
    re.MULTILINE,
)

# Pattern: STOP. or DONE. — explicit tool-loop terminators (the model can use
# these to signal it has the answer and wants to stop iterating)
_STOP_RE = re.compile(r"^\s*(STOP|DONE)\.?\s*$", re.MULTILINE | re.I)


def parse_tool_calls(llm_output: str) -> list[tuple[str, list, dict]]:
    """Extract TOOL: name(args) calls from LLM output. Args are parsed as
    Python literals where possible, else passed as strings."""
    out: list[tuple[str, list, dict]] = []
    for m in _TOOL_CALL_RE.finditer(llm_output):
        name = m.group("name")
        raw = m.group("args").strip()
        positional: list = []
        keyword: dict = {}
        if raw:
            # naive split on commas not inside quotes/parens — sufficient
            # for our tool surface (numbers, short strings, ints)
            parts = _split_args(raw)
            for p in parts:
                p = p.strip()
                if "=" in p and not p.startswith(("'", '"')):
                    k, _, v = p.partition("=")
                    keyword[k.strip()] = _coerce(v.strip())
                else:
                    positional.append(_coerce(p))
        out.append((name, positional, keyword))
    return out


def _split_args(raw: str) -> list[str]:
    """Split on commas that aren't inside quotes."""
    parts: list[str] = []
    buf = []
    quote = None
    for ch in raw:
        if quote:
            buf.append(ch)
            if ch == quote:
                quote = None
        elif ch in "\"'":
            quote = ch
            buf.append(ch)
        elif ch == "," and not quote:
            parts.append("".join(buf))
            buf = []
        else:
            buf.append(ch)
    if buf:
        parts.append("".join(buf))
    return parts


def _coerce(s: str) -> Any:
    """Best-effort literal coercion."""
    s = s.strip()
    if (s.startswith('"') and s.endswith('"')) or (s.startswith("'") and s.endswith("'")):
        return s[1:-1]
    if s.lower() == "true":
        return True
    if s.lower() == "false":
        return False
    if s.lower() in ("none", "null"):
        return None
    if s.lstrip("-").isdigit():
        return int(s)
    try:
        return float(s)
    except ValueError:
        return s


def execute_tool_calls(calls: list[tuple[str, list, dict]], max_hops: int = 3) -> list[dict]:
    """Execute up to max_hops tool calls. Return [{name, args, result}, ...]."""
    results: list[dict] = []
    for name, positional, keyword in calls[:max_hops]:
        result = _toolkit.call(name, *positional, **keyword)
        # Truncate huge results so they don't blow context
        result_str = json.dumps(result, default=str) if not isinstance(result, str) else result
        if len(result_str) > 800:
            result_str = result_str[:800] + " ... (truncated)"
        results.append({
            "name": name,
            "args": {"positional": positional, "keyword": keyword},
            "result": result_str,
        })
    return results


def llm_should_stop(llm_output: str) -> bool:
    """True if the LLM emitted STOP. / DONE."""
    return bool(_STOP_RE.search(llm_output))


def build_react_prompt(toolkit_descriptions: list[dict]) -> str:
    """Build the system-prompt augmentation describing the toolkit + ReAct rules."""
    tools = "\n".join(
        f"  - {d['name']}{d['signature']}  — {d['doc']}"
        for d in toolkit_descriptions
    )
    return (
        "## Toolkit (deterministic, free)\n"
        "You have a deterministic toolkit. When the operator's question can be\n"
        "answered by a tool, emit ONE tool call per turn in this format:\n"
        "    TOOL: name(arg1, arg2)\n"
        "Then wait for the result line that begins `RESULT: ...`. Up to three\n"
        "tool hops per turn; after that, answer with what you have.\n"
        "When you have the answer, write it in the HAL office register and\n"
        "add `STOP.` on its own line. Do NOT add a `— Lacuna` sign-off; the\n"
        "speaker label (avatar) already identifies the voice.\n\n"
        "Available tools:\n"
        f"{tools}\n"
    )
