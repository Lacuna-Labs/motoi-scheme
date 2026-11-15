"""THE WIRE — Ollama's chat words ↔ llama-server's OpenAI words, for the gateway (moved out of gateway.py, 2026-10-19)."""
from __future__ import annotations

import json
import re
import time

CHANNEL = re.compile(r"^\s*(<\|?channel\|?>\s*\w*\s*)?(<\|?channel\|?>)?")


def _clean(text: str) -> str:
    """Gemma's thinking-channel marks are special tokens no grammar governs: they go, the words stay."""
    return CHANNEL.sub("", text or "", count=1).lstrip("\n") if text else ""


def to_openai(body: dict) -> dict:
    msgs, calls_seen, open_calls = [], 0, []   # open_calls: [(id, name)] not yet answered, in call order
    for m in body.get("messages") or []:
        role = m.get("role")
        content = m.get("content") or ""
        if m.get("images"):
            parts = [{"type": "text", "text": content}] if content else []
            parts += [{"type": "image_url", "image_url": {"url": f"data:image/png;base64,{img}"}} for img in m["images"]]
            content = parts
        out = {"role": role, "content": content}
        if role == "assistant" and m.get("tool_calls"):
            out["tool_calls"] = []
            for c in m["tool_calls"]:
                fn = c.get("function") or {}
                args = fn.get("arguments")
                out["tool_calls"].append({"id": f"call_{calls_seen}", "type": "function",
                                          "function": {"name": fn.get("name"), "arguments": args if isinstance(args, str) else json.dumps(args or {})}})
                open_calls.append((f"call_{calls_seen}", fn.get("name")))
                calls_seen += 1
        if role == "tool":
            # a tool message answers the k-th OPEN call by position (or the first open call with its tool_name): with N >= 2
            # calls in one round every answer used to carry the LAST call's id (2026-10-23, lacuna-node chat-template test)
            if m.get("tool_call_id"):
                out["tool_call_id"] = m["tool_call_id"]
                open_calls = [c for c in open_calls if c[0] != m["tool_call_id"]]
            else:
                pick = next((c for c in open_calls if m.get("tool_name") and c[1] == m["tool_name"]), open_calls[0] if open_calls else None)
                out["tool_call_id"] = pick[0] if pick else f"call_{max(0, calls_seen - 1)}"
                if pick:
                    open_calls.remove(pick)
        msgs.append(out)
    o = body.get("options") or {}
    req = {"model": "lacuna-worker-lite", "messages": msgs, "stream": bool(body.get("stream", True))}
    think = body.get("think")
    req["chat_template_kwargs"] = {"enable_thinking": bool(think) and think not in ("false", "none")}
    if body.get("think_budget") is not None:      # chat.py THINK_BUDGET: thinking stays on (the cached head), its length is capped
        req["thinking_budget_tokens"] = int(body["think_budget"])
    if body.get("tools"):
        req["tools"] = body["tools"]
    fmt = body.get("format")
    if fmt == "json":
        req["response_format"] = {"type": "json_object"}
    elif isinstance(fmt, dict):
        req["response_format"] = {"type": "json_schema", "json_schema": {"name": "answer", "schema": fmt}}
    if body.get("grammar"):                       # ours: a GBNF text (sakura-scheme/grammar) — llama.cpp decodes under it
        req["grammar"] = body["grammar"]
    if body.get("_slot") is not None:             # the lane's own slot: its cached prompt is never another lane's victim
        req["id_slot"] = int(body["_slot"])
    if (o.get("num_predict") or 0) > 0:
        req["max_tokens"] = int(o["num_predict"])
    for k_in, k_out in (("temperature", "temperature"), ("top_p", "top_p"), ("top_k", "top_k"), ("min_p", "min_p"),
                        ("presence_penalty", "presence_penalty"), ("frequency_penalty", "frequency_penalty"),
                        ("seed", "seed"), ("stop", "stop"), ("repeat_penalty", "repeat_penalty")):
        if k_in in o:
            req[k_out] = o[k_in]
    if body.get("profile") == "act":            # G15: the ACT decode, and the token probabilities to judge it by (certainty.py)
        import certainty
        for k, v in certainty.ACT.items():
            req.setdefault(k, v)
        req["logprobs"], req["top_logprobs"] = True, 5
    if body.get("dry"):                          # G6: the DRY sampler against a repeated path
        import certainty
        req.update(certainty.DRY)
    req["cache_prompt"] = True
    return req


def _calls(oc: list) -> list:
    out = []
    for c in oc or []:
        fn = c.get("function") or {}
        args = fn.get("arguments")
        try:
            args = json.loads(args) if isinstance(args, str) else (args or {})
        except ValueError:
            args = {"_raw": args}
        out.append({"function": {"name": fn.get("name"), "arguments": args}})
    return out


def from_openai(r: dict, model: str, t0: float) -> dict:
    ch = (r.get("choices") or [{}])[0]
    m = ch.get("message") or {}
    u, tm = r.get("usage") or {}, r.get("timings") or {}
    msg = {"role": "assistant", "content": _clean(m.get("content") or "")}
    if m.get("reasoning_content"):
        msg["thinking"] = m["reasoning_content"]
    if m.get("tool_calls"):
        msg["tool_calls"] = _calls(m["tool_calls"])
    lp = {"_logprobs": (ch.get("logprobs") or {}).get("content") or []} if ch.get("logprobs") else {}
    if lp.get("_logprobs"):
        import certainty
        lp["lacuna_certainty"] = certainty.measure(lp["_logprobs"])
    return {**lp, "model": model, "created_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()), "message": msg, "done": True,
            "done_reason": ch.get("finish_reason") or "stop", "total_duration": int((time.time() - t0) * 1e9),
            "prompt_eval_count": u.get("prompt_tokens", 0), "eval_count": u.get("completion_tokens", 0),
            "prompt_eval_duration": int((tm.get("prompt_ms") or 0) * 1e6), "eval_duration": int((tm.get("predicted_ms") or 0) * 1e6)}


