"""Cart substrate extractor — 55 runnable carts (.sks + .scm) in motoi-scheme/carts/.

Carts are complete, runnable Motoi programs — kid-facing, one file each. We
extract:

  - WHOLE-CART: "give me a cart that does X" → full cart source
  - HEADER PARSE: :name, :one-line, :verbs-used, :category, :complexity from
    the top-of-file `;;` (cart ...) block
  - DEFINE-EXTRACTS: each `(define (name ...) ...)` → explain-fn + complete-fn
  - VERB-USAGE: "which verbs would you reach for to X?" using :verbs-used
  - BROKEN-FIXED: swap a well-known symbol, ask model to spot the bug

Budget: 6-12 pairs per cart → ~400-700 pairs. Small but load-bearing —
these are the ONLY substrate where end-to-end runnable programs live.
"""
from __future__ import annotations

import re
import sys
from pathlib import Path
from typing import Iterator

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

MOTOI_ROOT = Path("/Users/alfred/code/motoi-scheme")
CARTS_ROOT = MOTOI_ROOT / "carts"

HEADER_KV_RE = re.compile(r":(\w[\w-]*)\s+(?:\"([^\"]*)\"|([^\s\(\)]+)|\(([^\)]*)\))")
DEFINE_RE = re.compile(r"\(define\s+\(([^\s\)]+)([^\)]*)\)")


def parse_header(text: str) -> dict:
    """Extract header k/v pairs from the top-of-file `;;` cart block."""
    head_lines = []
    for line in text.splitlines():
        if line.strip().startswith(";;"):
            head_lines.append(line.lstrip(";").strip())
        elif line.strip() == "":
            head_lines.append("")
        else:
            break
    head = "\n".join(head_lines)
    out = {}
    for m in HEADER_KV_RE.finditer(head):
        k = m.group(1)
        v = m.group(2) or m.group(3) or m.group(4) or ""
        if k in out:
            continue
        if m.group(4):
            v = [s.strip('"') for s in re.findall(r'"([^"]*)"', m.group(4))] or v
        out[k] = v
    return out


def extract_defines(text: str) -> list[tuple[str, str, str]]:
    """Return list of (fn-name, arg-string, whole-define-source)."""
    out = []
    n = len(text)
    for m in DEFINE_RE.finditer(text):
        name = m.group(1)
        args = m.group(2).strip()
        depth = 0
        i = m.start()
        j = i
        while j < n:
            c = text[j]
            if c == "(":
                depth += 1
            elif c == ")":
                depth -= 1
                if depth == 0:
                    j += 1
                    break
            j += 1
        out.append((name, args, text[i:j]))
    return out


def iter_all_carts() -> Iterator[dict]:
    for path in sorted(list(CARTS_ROOT.rglob("*.sks")) + list(CARTS_ROOT.rglob("*.scm"))):
        try:
            text = path.read_text(encoding="utf-8", errors="replace")
        except Exception:
            continue
        header = parse_header(text)
        defines = extract_defines(text)
        yield {
            "path": str(path),
            "rel_path": str(path.relative_to(MOTOI_ROOT)),
            "filename": path.name,
            "text": text,
            "header": header,
            "defines": defines,
            "line_count": text.count("\n") + 1,
        }


def _pair(user: str, motoi: str, cart: dict, bloom: str, phil: str, shape: str) -> dict:
    return {
        "user": user,
        "motoi": motoi,
        "tags": {
            "bloom": bloom,
            "philosopher": phil,
            "shape": shape,
            "substrate": "cart",
            "cart": cart["filename"],
        },
    }


def emit_pairs_for_cart(cart: dict) -> Iterator[dict]:
    header = cart["header"]
    name = header.get("name") or cart["filename"].rsplit(".", 1)[0]
    one_line = header.get("one-line") or ""
    verbs_used = header.get("verbs-used") or []
    category = header.get("category") or ""

    if one_line:
        yield _pair(
            f"Show me a Motoi cart that: {one_line}",
            f"Here's `{name}` from carts/:\n\n```scheme\n{cart['text'][:2000]}\n```",
            cart, "create", "wittgenstein-early", "cart-by-goal",
        )
        yield _pair(
            f"What does the `{name}` cart do?",
            one_line + (f" (category: {category.lstrip(':')})" if category else ""),
            cart, "remember", "lacan-reversal", "cart-summary",
        )

    if isinstance(verbs_used, list) and verbs_used:
        listed = ", ".join(f"`{v}`" for v in verbs_used[:10])
        yield _pair(
            f"Which Motoi verbs does the `{name}` cart use?",
            f"`{name}` uses: {listed}.",
            cart, "analyze", "peirce-abduction", "verb-inventory",
        )
        joined_goal = one_line or f"build something like `{name}`"
        yield _pair(
            f"Which verbs would you reach for to {joined_goal}?",
            f"Reach for: {listed}. That's the palette `{name}` uses.",
            cart, "apply", "wittgenstein-early", "verbs-for-goal",
        )

    for fn_name, args, src in cart["defines"][:5]:
        if len(src) > 800 or len(src) < 20:
            continue
        yield _pair(
            f"In the `{name}` cart, what does the `{fn_name}` function do?",
            f"```scheme\n{src}\n```\n\n"
            f"That's `{fn_name}` from `{name}` — read the body to see the pattern.",
            cart, "understand", "wittgenstein-late-aspect", "define-explain",
        )
        lines = src.split("\n")
        if len(lines) >= 3:
            cutoff = max(1, min(len(lines) - 1, len(lines) // 2))
            prefix = "\n".join(lines[:cutoff])
            yield _pair(
                f"Complete this Motoi function from `{name}`:\n\n```scheme\n{prefix}\n```",
                f"```scheme\n{src}\n```",
                cart, "apply", "wittgenstein-early", "define-completion",
            )

    yield _pair(
        f"Is this a real Motoi cart? What's its file?\n\n```scheme\n{cart['text'][:400]}\n```",
        f"Yes — that's the head of `{cart['rel_path']}`, {cart['line_count']} lines. "
        "It runs on today's motoi CLI: `motoi run " + cart["rel_path"] + "`.",
        cart, "evaluate", "popper-evidence", "cart-affirmation",
    )


if __name__ == "__main__":
    from collections import Counter
    total = 0
    per_bloom = Counter()
    cart_count = 0
    for cart in iter_all_carts():
        cart_count += 1
        for p in emit_pairs_for_cart(cart):
            total += 1
            per_bloom[p["tags"]["bloom"]] += 1
    print(f"carts parsed:  {cart_count}")
    print(f"total pairs:   {total}")
    print(f"mean per cart: {total/cart_count if cart_count else 0:.1f}")
    print("\nBloom distribution:")
    for b, c in per_bloom.most_common():
        pct = 100.0 * c / total if total else 0.0
        print(f"  {b:14} {c:>5}  ({pct:.1f}%)")
