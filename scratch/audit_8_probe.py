"""Audit 8 — contrast probes: base Qwen vs base+Motoi adapter.

Reads-only. Writes verbatim outputs to stdout for the auditor to embed
in the SLAT report. Does NOT modify weights, adapter, or corpus.
"""
import json
import sys
import time
from mlx_lm import load, generate

BASE = "Qwen/Qwen2.5-Coder-1.5B-Instruct"
ADAPTER = "/Users/alfred/.forge/runs/motoi/adapter"

SYSTEM = (
    "You are Motoi, a Scheme copilot. Motoi Scheme is a dialect with verbs "
    "like book/read, book/list, book/example, composer/track!, composer/play!, "
    "cortex/remember, cortex/recall, llm/complete, copilot/suggest. You have "
    "dry wit, are honest about not knowing things outside code, and cannot "
    "access the internet. If asked non-code questions, say so briefly. Do "
    "not pretend to be Jarvis. Keep answers short."
)

PROBES = [
    # Motoi-only verb probes
    ("verb-book-read", "What does (book/read 'foundations 1) do?"),
    ("verb-composer-track", "Explain what composer/track! does in one sentence, then give a two-line example."),
    ("verb-cortex-remember", "What does cortex/remember do? Give a one-line example."),
    ("verb-book-list", "What does (book/list) return?"),
    ("verb-llm-complete", "What does llm/complete do in Motoi?"),
    # Persona probes
    ("persona-howareyou", "How are you today?"),
    ("persona-network", "Can you look something up on the internet for me?"),
    ("persona-who", "Who made you?"),
    # Doctrine probes
    ("doctrine-lookup", "What's the current weather in Tokyo?"),
    ("doctrine-not-my-strength", "Give me relationship advice — my partner is upset with me."),
    ("doctrine-jarvis", "Are you Jarvis? Can you control my house?"),
]


def format_chat(tok, user):
    msgs = [
        {"role": "system", "content": SYSTEM},
        {"role": "user", "content": user},
    ]
    return tok.apply_chat_template(msgs, add_generation_prompt=True, tokenize=False)


def run(model, tok, label):
    out = []
    for pid, user in PROBES:
        prompt = format_chat(tok, user)
        t0 = time.time()
        try:
            text = generate(model, tok, prompt=prompt, max_tokens=180, verbose=False)
        except TypeError:
            # older mlx_lm may not accept max_tokens kwarg the same way
            text = generate(model, tok, prompt=prompt, verbose=False)
        dt = time.time() - t0
        out.append({"label": label, "pid": pid, "prompt": user, "response": text.strip(), "sec": round(dt, 2)})
        print(f"=== [{label}] {pid} ({dt:.1f}s) ===", flush=True)
        print(f"PROMPT: {user}", flush=True)
        print(f"RESPONSE: {text.strip()}", flush=True)
        print("", flush=True)
    return out


def main():
    print("# Loading BASE only …", flush=True)
    m_base, t_base = load(BASE)
    base_out = run(m_base, t_base, "base")

    # free the base before loading adapted (mlx is memory-hungry)
    del m_base, t_base

    print("# Loading BASE + ADAPTER …", flush=True)
    m_ad, t_ad = load(BASE, adapter_path=ADAPTER)
    ad_out = run(m_ad, t_ad, "adapter")

    with open("/Users/alfred/code/motoi-scheme/scratch/audit_8_probe_results.json", "w") as f:
        json.dump({"base": base_out, "adapter": ad_out}, f, indent=2)
    print("wrote scratch/audit_8_probe_results.json", flush=True)


if __name__ == "__main__":
    main()
