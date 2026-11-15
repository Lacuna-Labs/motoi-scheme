"""SMALL MINDS' WORDS — what changes between the brain's request and a small Gemma's (2026-10-18).

Two things, both from Google's model cards (~/lacuna-world/reference/models/):
- sampling: every Gemma card says temperature 1.0, top_k 64, top_p 0.95; applied only where the caller set nothing
  (grammar and selection jobs send temperature 0, and that stands);
- FunctionGemma's prompt: the `developer` turn must open with "You are a model that can do function calling with the
  following functions" (the card's "essential system prompt") followed by each tool as
  `<start_function_declaration>declaration:NAME{description:<escape>…<escape>,parameters:{…}}<end_function_declaration>`;
  a call comes back as `<start_function_call>call:NAME{key:<escape>value<escape>}<end_function_call>`. Ollama's blob
  has no chat template, so the gateway writes this text itself and parses the calls back into Ollama's `tool_calls`.

And one thing every small mind's answer carries back (design §40.1, the first lens): its own **certainty**. llama.cpp
returns the probability of each token it chose; the answer says the lowest (`certainty`) and the mean
(`certainty_mean`) over its content tokens, and the weakest token (`certainty_weakest`). A label chosen at 0.31 is a
guess, and the cascade passes a guess up. A caller that sends `logprobs: true` (and `top_logprobs: N`, or
`options.n_probs`) also gets each token in Ollama's `logprobs` shape.
"""
from __future__ import annotations

import json
import math
import re

from minds import GEMMA_SAMPLING, family

ESSENTIAL = "You are a model that can do function calling with the following functions"
ESC = "<escape>"
TAIL = re.compile(r"(<start_function_response>|<end_of_turn>|<eos>|<end_function_call>)+\s*$")
SPECIAL = re.compile(r"^\s*<[^<>\s]+>\s*$")         # <end_of_turn>, <escape>, <start_function_call> …: no content
CONTENT = re.compile(r"\w")                            # a content token carries a letter or a digit
JSON_VALUE = re.compile(r'"\s*:\s*("(?:[^"\\]|\\.)*"|[^,\s{}\[\]"]+)')
ALTERNATIVES = 8                                        # alternatives asked per token, to see what the grammar refused
CALL = re.compile(r"<start_function_call>call:([\w.\-]+)(\{.*?\})(?:<end_function_call>|$)", re.S)


# ── FunctionGemma's value notation: keys bare, strings fenced by <escape>, schema types in capitals ──
def encode(v, key: str = "") -> str:
    if isinstance(v, dict):
        return "{" + ",".join(f"{k}:{encode(x, k)}" for k, x in v.items()) + "}"
    if isinstance(v, (list, tuple)):
        return "[" + ",".join(encode(x) for x in v) + "]"
    if isinstance(v, bool):
        return "true" if v else "false"
    if v is None:
        return "null"
    if isinstance(v, (int, float)):
        return json.dumps(v)
    s = str(v)
    return ESC + (s.upper() if key == "type" else s) + ESC


def declaration(tool: dict) -> str:
    fn = tool.get("function") or tool
    body = {"description": fn.get("description") or ""}
    if fn.get("parameters"):
        body["parameters"] = fn["parameters"]
    return f"<start_function_declaration>declaration:{fn.get('name')}{encode(body)}<end_function_declaration>"


def decode(text: str):
    """Parse one value of the notation back; returns (value, rest)."""
    text = text.lstrip()
    if text.startswith(ESC):
        end = text.index(ESC, len(ESC))
        return text[len(ESC):end], text[end + len(ESC):]
    if text.startswith("{"):
        out, text = {}, text[1:]
        while text.lstrip() and not text.lstrip().startswith("}"):
            before = len(text)
            key, _, text = text.lstrip().partition(":")
            out[key.strip()], text = decode(text)
            text = text.lstrip()
            text = text[1:] if text.startswith(",") else text
            if len(text) >= before:                    # no progress: a malformed answer must fail, never spin forever
                raise ValueError("malformed call: a field did not advance")
        return out, text.lstrip()[1:]
    if text.startswith("["):
        out, text = [], text[1:]
        while text.lstrip() and not text.lstrip().startswith("]"):
            before = len(text)
            v, text = decode(text)
            out.append(v)
            text = text.lstrip()
            text = text[1:] if text.startswith(",") else text
            if len(text) >= before:
                raise ValueError("malformed call: a list item did not advance")
        return out, text.lstrip()[1:]
    m = re.match(r"[^,}\]]*", text)
    raw = m.group(0).strip()
    try:
        return json.loads(raw), text[m.end():]
    except ValueError:
        return raw, text[m.end():]


def parse_calls(text: str) -> tuple[str, list]:
    """FunctionGemma's answer → (the words outside any call, Ollama-style tool_calls)."""
    calls = []
    for name, args in CALL.findall(text or ""):
        try:
            val, _ = decode(args)
        except (ValueError, IndexError):
            val = {"_raw": args}
        calls.append({"function": {"name": name, "arguments": val if isinstance(val, dict) else {"value": val}}})
    words = CALL.sub("", text or "")
    return TAIL.sub("", words).strip() if calls else TAIL.sub("", words), calls


def _functiongemma_messages(msgs: list, tools: list) -> list:
    """Tools into the developer turn; earlier calls and their results into the turns Google's format expects."""
    names, out = {}, []
    system = [m for m in msgs if m.get("role") == "system"]
    dev = "\n".join(str(m.get("content") or "") for m in system)
    if tools:
        dev = (dev + "\n" if dev else "") + ESSENTIAL + "".join(declaration(t) for t in tools)
    if dev:
        out.append({"role": "system", "content": dev})
    for m in msgs:
        role = m.get("role")
        if role == "system":
            continue
        if role == "assistant" and m.get("tool_calls"):
            text = m.get("content") or ""
            for c in m["tool_calls"]:
                fn = c.get("function") or {}
                args = fn.get("arguments")
                try:
                    args = json.loads(args) if isinstance(args, str) else (args or {})
                except ValueError:
                    args = {}
                names[c.get("id")] = fn.get("name")
                text += f"<start_function_call>call:{fn.get('name')}{encode(args)}<end_function_call>"
            out.append({"role": "assistant", "content": text})
        elif role == "tool":
            name = m.get("name") or m.get("tool_name") or names.get(m.get("tool_call_id")) or "result"
            try:
                val = json.loads(m.get("content") or "")
            except ValueError:
                val = None
            val = val if isinstance(val, dict) else {"result": m.get("content") or ""}
            out.append({"role": "tool", "content": f"<start_function_response>response:{name}{encode(val)}"
                                                  "<end_function_response>"})
        else:
            out.append(m)
    return out


# ── certainty: the probability of each token the mind chose ──
def top_n(body: dict) -> int:
    """How many alternatives per token the caller asked to see (0: none; llama.cpp gives at most 20)."""
    n = body.get("top_logprobs") or (body.get("options") or {}).get("n_probs") or 0
    try:
        return max(0, min(20, int(n)))
    except (TypeError, ValueError):
        return 0


def _chosen_p(e: dict) -> float:
    """The probability of the chosen token among what the decoder could choose. llama.cpp reports the model's own
    distribution, before the grammar; at temperature 0 the chosen token is the likeliest one the grammar allowed, so
    every likelier token was refused, and p(chosen) / (1 − p(refused)) is a floor on its share of what was allowed."""
    p = math.exp(e["logprob"])
    higher = sum(math.exp(t["logprob"]) for t in e.get("top_logprobs") or []
                 if isinstance(t.get("logprob"), (int, float)) and t["logprob"] > e["logprob"] and t.get("token") != e.get("token"))
    return min(1.0, p / (1.0 - higher)) if higher < 1.0 else p


def _value_spans(text: str) -> list:
    """Character spans of the JSON values in an answer (keys and punctuation are the schema's, not the mind's)."""
    return [m.span(1) for m in JSON_VALUE.finditer(text)]


def certainty(entries, json_values: bool = False) -> dict:
    """llama.cpp's per-token entries ({token, logprob, top_logprobs}) → the lowest and mean probability over the
    content tokens (special marks, whitespace and punctuation carry no meaning and are left out; under a JSON schema
    only the values' tokens count, since the keys are forced)."""
    ok = [e for e in entries or [] if isinstance(e, dict) and isinstance(e.get("logprob"), (int, float))]
    spans, at, keep = (_value_spans("".join(e.get("token") or "" for e in ok)) if json_values else None), 0, []
    for e in ok:
        tok = e.get("token") or ""
        inside = spans is None or any(a < at + len(tok) and at < b for a, b in spans)
        at += len(tok)
        if inside and CONTENT.search(tok) and not SPECIAL.match(tok):
            keep.append((_chosen_p(e), tok))
    if not keep:
        return {}
    low = min(keep)
    return {"certainty": round(low[0], 4), "certainty_mean": round(sum(p for p, _ in keep) / len(keep), 4),
            "certainty_weakest": low[1], "certainty_tokens": len(keep)}


def scored(entries, body: dict) -> dict:
    """The certainty fields for an answer, plus Ollama-style `logprobs` when the caller asked for them."""
    out = certainty(entries, json_values=bool(body.get("format")))
    if body.get("logprobs") and entries:
        out["logprobs"] = [{"token": e.get("token"), "logprob": e.get("logprob"),
                            "top_logprobs": [{"token": t.get("token"), "logprob": t.get("logprob")}
                                             for t in (e.get("top_logprobs") or [])[:top_n(body)]]} for e in entries]
    return out


def shape(req: dict, body: dict, name: str) -> dict:
    """The brain's OpenAI-style request (gateway.to_openai) adjusted for one small Gemma."""
    # certainty on every call: it costs nothing (§40.1); the alternatives show what the grammar refused
    req = dict(req, model=name, logprobs=True, top_logprobs=max(ALTERNATIVES, top_n(body)))
    opts = body.get("options") or {}
    for k, v in GEMMA_SAMPLING.items():
        if k not in opts:
            req[k] = v
    if family(name) == "functiongemma":
        req["messages"] = _functiongemma_messages(req.get("messages") or [], req.pop("tools", None) or [])
        req.pop("chat_template_kwargs", None)
    return req


def finish(out: dict, name: str, body: dict | None = None) -> dict:
    """An Ollama-style answer from a small Gemma, with FunctionGemma's calls lifted into `tool_calls` and its
    certainty added (gateway.from_openai keeps llama.cpp's per-token entries under `_logprobs` for this)."""
    entries = out.pop("_logprobs", None)
    msg = out.get("message")
    if not isinstance(msg, dict):
        return out
    out.update(scored(entries, body or {}))
    if family(name) == "functiongemma":
        words, calls = parse_calls(msg.get("content") or "")
        msg["content"] = words
        if calls:
            msg["tool_calls"] = calls
    else:
        msg["content"] = TAIL.sub("", msg.get("content") or "")
    return out
