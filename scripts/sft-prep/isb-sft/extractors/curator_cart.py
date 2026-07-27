"""Curator cart extractor — 1,285 wired carts at ~/code/curator/curator-web/src/scheme/carts/.

Each Curator cart is richer than the 55-cart Motoi set: it carries
  - ;;~ header block (title/author/mode/flavor/id/trigger/touches/summary)
  - ;; DOC block (WHAT/TECHNIQUE/WHY/CONSTRAINT/CTX-INPUTS/IDEMPOTENCY/ERROR-GRAMMAR)
  - state functions each preceded by ;; WHAT/TECHNIQUE/WHY/CONSTRAINT
  - enumerated 'escalate error symbols

Per synthesis §6 Option C:
  cart-state-functions     ~12,850 canonical (1,285 wired × ~10 states each)
  cart-error-grammar       ~1,285
  cart-broken-fixed        ~2,500
  cart-doctrine            ~400

Emission budget: 12-18 pairs per Curator cart depending on state-function count.
Note: Curator carts use Sakura verbs (sakura/*, card/*, shop/*) that Motoi
doesn't run. Pairs frame the code AS SAKURA-FLAVORED PATTERN so the model
learns the doctrine + shape, not phantom verb bindings.
"""
from __future__ import annotations

import re
from pathlib import Path
from typing import Iterator

CURATOR_CARTS_ROOT = Path("/Users/alfred/code/curator/curator-web/src/scheme/carts")

TILDE_HEADER_RE = re.compile(r"^;;~\s+(\w+)\s+(.+?)\s*$", re.MULTILINE)
DOC_SECTION_RE = re.compile(
    r"^;;\s*(WHAT|WHY|WHY NOW|TECHNIQUE|CONSTRAINT|CONSTRAINTS?|CTX INPUTS?|IDEMPOTENCY|ERROR GRAMMAR|HONESTY):\s*\n((?:^;;.*\n)+)",
    re.MULTILINE,
)
STATE_FN_HEADER_RE = re.compile(
    r"((?:^;;\s+(?:WHAT|TECHNIQUE|WHY|CONSTRAINT):.*\n)+)"
    r"\(define\s+\((\w[\w\-!?]*)\s*([^\)]*)\)",
    re.MULTILINE,
)
ESCALATE_RE = re.compile(r"'([\w-]+)\s+(?:the )?", re.MULTILINE)


def parse_tilde_header(text: str) -> dict:
    out = {}
    for m in TILDE_HEADER_RE.finditer(text):
        k = m.group(1).lower()
        v = m.group(2).strip().strip('"')
        if k not in out:
            out[k] = v
    return out


def parse_doc_sections(text: str) -> dict:
    out = {}
    for m in DOC_SECTION_RE.finditer(text):
        section = m.group(1).lower().replace(" ", "_")
        body = m.group(2)
        cleaned = re.sub(r"^;;\s?", "", body, flags=re.MULTILINE).strip()
        if section not in out and len(cleaned) > 20:
            out[section] = cleaned[:800]
    return out


def extract_state_functions(text: str) -> list[dict]:
    """Extract (comment-block, fn-name, args, whole-body) for each state fn."""
    out = []
    n = len(text)
    for m in STATE_FN_HEADER_RE.finditer(text):
        header_block = m.group(1)
        fn_name = m.group(2)
        args = m.group(3).strip()
        parts = {}
        for line in header_block.splitlines():
            line = line.lstrip(";").strip()
            for key in ("WHAT:", "TECHNIQUE:", "WHY:", "CONSTRAINT:"):
                if line.startswith(key):
                    parts[key[:-1].lower()] = line[len(key):].strip()
        i = m.start() + len(header_block)
        depth = 0
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
        body = text[i:j].strip()
        if len(body) > 12 and len(body) < 1500:
            out.append({"fn": fn_name, "args": args, "what": parts.get("what", ""),
                        "technique": parts.get("technique", ""), "why": parts.get("why", ""),
                        "constraint": parts.get("constraint", ""), "body": body})
    return out


def extract_error_grammar(doc_sections: dict) -> list[tuple[str, str]]:
    eg = doc_sections.get("error_grammar", "")
    if not eg:
        return []
    out = []
    for line in eg.splitlines():
        m = re.match(r"'([\w-]+)\s+(.+)$", line.strip())
        if m:
            out.append((m.group(1), m.group(2).strip()))
    return out


def iter_all_curator_carts() -> Iterator[dict]:
    if not CURATOR_CARTS_ROOT.exists():
        return
    for path in sorted(CURATOR_CARTS_ROOT.rglob("*.sks")):
        try:
            text = path.read_text(encoding="utf-8", errors="replace")
        except Exception:
            continue
        rel = path.relative_to(CURATOR_CARTS_ROOT)
        yield {
            "path": str(path),
            "rel": str(rel),
            "filename": path.name,
            "cart_slug": path.stem,
            "namespace": rel.parts[0] if len(rel.parts) > 1 else "",
            "header": parse_tilde_header(text),
            "doc": parse_doc_sections(text),
            "states": extract_state_functions(text),
            "errors": extract_error_grammar(parse_doc_sections(text)),
            "text": text,
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
            "substrate": "curator_cart",
            "concept": f"curator/{cart['cart_slug']}",
            "cart": cart["filename"],
            "namespace": cart["namespace"],
        },
    }


def emit_pairs_for_curator_cart(cart: dict) -> Iterator[dict]:
    header = cart["header"]
    doc = cart["doc"]
    slug = cart["cart_slug"]
    title = header.get("title") or slug.replace("-", " ").title()
    summary = header.get("summary") or ""
    trigger = header.get("trigger") or ""
    mode = header.get("mode") or ""

    if summary:
        yield _pair(
            f"What does the Sakura cart `{slug}` do?",
            f"**{title}** — {summary}"
            + (f" (trigger: `{trigger}`)" if trigger else "")
            + (f" (mode: {mode})" if mode else ""),
            cart, "remember", "lacan-reversal", "curator-cart-summary",
        )
        yield _pair(
            f"Which Sakura cart handles: {summary}",
            f"`{slug}` — see `{cart['rel']}`.",
            cart, "remember", "lacan-reversal", "curator-cart-reverse",
        )

    if doc.get("what"):
        yield _pair(
            f"Explain what the Sakura cart `{slug}` actually does.",
            doc["what"],
            cart, "understand", "wittgenstein-late-aspect", "cart-what",
        )
    if doc.get("why") or doc.get("why_now"):
        why = doc.get("why") or doc.get("why_now")
        yield _pair(
            f"Why does the `{slug}` cart exist? What's the design rationale?",
            why,
            cart, "evaluate", "aristotle-nous", "cart-why",
        )
    if doc.get("technique"):
        yield _pair(
            f"How does the `{slug}` cart work — what's the technique?",
            doc["technique"],
            cart, "apply", "wittgenstein-early", "cart-technique",
        )
    if doc.get("constraint") or doc.get("constraints"):
        constraint = doc.get("constraint") or doc.get("constraints")
        yield _pair(
            f"What are the constraints on the `{slug}` cart? What must it NEVER do?",
            constraint,
            cart, "analyze", "peirce-abduction", "cart-constraint",
        )
    if doc.get("honesty"):
        yield _pair(
            f"How does `{slug}` handle failure or unavailability honestly?",
            doc["honesty"],
            cart, "evaluate", "sartre-authentic", "cart-honesty",
        )

    for entry in cart["states"][:12]:
        fn = entry["fn"]
        body = entry["body"]
        what = entry["what"]
        why = entry["why"]
        technique = entry["technique"]
        constraint = entry["constraint"]

        if what:
            yield _pair(
                f"In the `{slug}` cart, what does the `{fn}` state function do?",
                (
                    f"**{fn}** — {what}"
                    + (f"\n\nTechnique: {technique}" if technique else "")
                    + f"\n\n```scheme\n{body[:800]}\n```"
                ),
                cart, "understand", "wittgenstein-late-aspect", "state-fn-what",
            )
        if why:
            yield _pair(
                f"Why is `{fn}` in the `{slug}` cart shaped this way?",
                (
                    f"{why}"
                    + (f"\n\nConstraint: {constraint}" if constraint else "")
                    + f"\n\n```scheme\n{body[:600]}\n```"
                ),
                cart, "evaluate", "aristotle-nous", "state-fn-why",
            )
        lines = body.split("\n")
        if len(lines) >= 3 and len(body) < 800:
            cutoff = max(1, len(lines) // 2)
            prefix = "\n".join(lines[:cutoff])
            yield _pair(
                f"Complete this Sakura state function from `{slug}`:\n\n```scheme\n{prefix}\n```",
                f"```scheme\n{body}\n```",
                cart, "apply", "wittgenstein-early", "state-fn-complete",
            )

    for kind, desc in cart["errors"][:8]:
        yield _pair(
            f"In the `{slug}` cart, when does the `'{kind}` escalate fire?",
            f"`'{kind}` — {desc}",
            cart, "analyze", "peirce-abduction", "error-grammar-forward",
        )
        yield _pair(
            f"Which Sakura cart's error grammar names `'{kind}`? What does it mean?",
            f"`{slug}` — `'{kind}` means: {desc}. See `{cart['rel']}`.",
            cart, "remember", "lacan-reversal", "error-grammar-reverse",
        )


if __name__ == "__main__":
    from collections import Counter
    total = 0
    per_bloom = Counter()
    n = 0
    for cart in iter_all_curator_carts():
        n += 1
        for p in emit_pairs_for_curator_cart(cart):
            total += 1
            per_bloom[p["tags"]["bloom"]] += 1
    print(f"curator carts: {n}")
    print(f"total pairs:   {total}")
    print(f"mean per cart: {total/n if n else 0:.1f}")
    print("\nBloom:")
    for b, c in per_bloom.most_common():
        print(f"  {b:14} {c:>6}  ({100*c/total:.1f}%)")
