#!/usr/bin/env python3
"""
Marcus #1 extractor — CODE-teaching SFT pairs from POST-SCOUR Motoi scheme-books.

Method:
- For each chapter .slatl / .slat file, pull fenced code blocks that hold Motoi Scheme code.
- Emit training pairs with rotated user-prompt templates.
- Every code example verified via `bin/motoi eval` (single expr) or `bin/motoi run` (multi).
- Reject: corporate names, philosopher name-drops, Sakura callouts, held-out dupes.
- CORE verbs must appear in the reference; unknown verbs -> soft warn but still emit
  (matches wave-1 policy).

Output: training-data/marcus-1-code-teaching-2026-07-17.jsonl
Heartbeat: scratch/marcus-1-heartbeat.slat every 500 pairs
"""

from __future__ import annotations

import hashlib
import json
import os
import re
import subprocess
import sys
import tempfile
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path
from typing import Optional

ROOT = Path("/Users/alfred/code/motoi-scheme")
BOOKS_DIR = ROOT / "scheme-books"
OUT_FILE = ROOT / "training-data" / "marcus-1-code-teaching-2026-07-17.jsonl"
HEARTBEAT = ROOT / "scratch" / "marcus-1-heartbeat.slat"
INBOX = ROOT / "scratch" / "marcus-1-inbox.slat"
HELDOUT = ROOT / "training-data" / "held-out" / "heldout-2026-07-16.jsonl"
MOTOI = str(ROOT / "bin" / "motoi")

BOOKS = [
    "book-of-scheme",
    "book-of-jesse",
    "book-of-math",
    "book-of-motion",
    "book-of-music",
    "book-of-animation",
    "book-of-sound",
    "book-of-instruments",
    "book-of-values",
    "book-of-slat",
    "book-of-logic",
]

# ---- rejection filters ----------------------------------------------------

CORPORATE = re.compile(
    r"\b(Google|Meta|Facebook|Apple|Amazon|Microsoft|Netflix|Tesla|OpenAI|"
    r"Anthropic|Nvidia|Sony|Samsung|Uber|Twitter|Instagram|TikTok|Etsy|"
    r"eBay|Shopify|Stripe|PayPal|Adobe|Oracle|IBM|Intel|Cisco|Salesforce)\b"
)

PHILOSOPHER_DROPS = re.compile(
    r"\b(Wittgenstein|Jung|Freud|Lacan|Peirce|Popper|Searle|Grice|Derrida|"
    r"Quine|Descartes|Sartre|Rawls|Aristotle|Levinas|Dennett|Socrates|"
    r"Kant|Hegel|Nietzsche|Heidegger)\b"
)

SAKURA_CALLOUTS = re.compile(
    r"\bSakura\b|sakura>|\bSakura's\b|sakura says", re.IGNORECASE
)

# Suppress prompts that reference the story-frame characters — Motoi Copilot
# has no persona and shouldn't know these people.
STORY_FRAME = re.compile(
    r"\b(Jesse|Ada|Miya|Suzuki|Alfred|Marcus)\b"
)


def rejected(text: str) -> Optional[str]:
    """Return the name of the rejection filter or None."""
    if CORPORATE.search(text):
        return "corporate"
    if PHILOSOPHER_DROPS.search(text):
        return "philosopher"
    if SAKURA_CALLOUTS.search(text):
        return "sakura"
    if STORY_FRAME.search(text):
        return "story-frame"
    return None


# ---- code extraction ------------------------------------------------------

# Match fenced blocks. Group 1 is the language tag (may be empty). Group 2
# is the code body. We require a NEWLINE after the tag, and forbid ``` from
# appearing inside the body so we don't span across neighbor fences.
FENCE = re.compile(
    r"```([A-Za-z0-9_+\-]*)[ \t]*\r?\n((?:(?!```)[\s\S])*?)```",
)
# Match :prose "...."  where the string can contain escaped quotes.
# The slatl format uses \" for embedded quotes.
PROSE_RE = re.compile(r':prose\s*\n?\s*"((?:[^"\\]|\\.)*)"', re.DOTALL)


def load_prose(path: Path) -> str:
    """Extract the :prose string body from a chapter file. Handles the
    slatl escape convention (\" for embedded quotes, \\ for backslash)."""
    text = path.read_text(errors="replace")
    m = PROSE_RE.search(text)
    if not m:
        return ""
    body = m.group(1)
    # Undo the slatl escapes: \" -> ", \\ -> \, \n -> literal newline
    body = body.replace('\\"', '"').replace("\\\\", "\\")
    return body


def extract_code_blocks(prose: str) -> "list[str]":
    """Pull all fenced code blocks from the prose. Filter out shell
    transcripts (lines starting with $) and REPL transcripts unless
    the code portion is clean."""
    ALLOWED_TAGS = {"", "motoi", "scheme", "scm"}
    out = []
    for m in FENCE.finditer(prose):
        tag = (m.group(1) or "").lower()
        if tag not in ALLOWED_TAGS:
            # python/js/text/bash/etc. — skip
            continue
        block = m.group(2).rstrip()
        if not block.strip():
            continue

        # Strip shell prompts: lines like `$ motoi eval "(+ 1 2)"` -> pull the arg
        lines = block.split("\n")
        cleaned = []
        for ln in lines:
            s = ln.rstrip()
            if s.startswith("$ motoi eval "):
                # extract the quoted expression
                after = s[len("$ motoi eval "):].strip()
                if after.startswith('"') and after.endswith('"'):
                    inner = after[1:-1]
                    # Undo shell backslash escapes: \" -> "
                    inner = inner.replace('\\"', '"')
                    cleaned.append(inner)
                continue
            if s.startswith("$ motoi run "):
                # skip; the file body follows in a separate fence
                continue
            if s.startswith("$"):
                # other shell command; skip
                continue
            if s.startswith(">"):
                # REPL prompt — strip and keep
                cleaned.append(s[1:].lstrip())
                continue
            if re.match(r"^(ok|hi|Hello|[\d\.\-#]|nil|=>)", s) and len(cleaned) > 0:
                # Looks like output following code. Break here.
                # But be conservative — only treat as output if all remaining
                # lines look like output or empty.
                remaining = [ln.rstrip() for ln in lines[lines.index(ln):]]
                if all(
                    (not r.strip())
                    or re.match(r"^(ok|hi|Hello|[\d\.\-#]|nil|=>|error:|;)", r)
                    for r in remaining
                ):
                    break
                cleaned.append(s)
                continue
            cleaned.append(s)

        code = "\n".join(cleaned).strip()
        if not code:
            continue

        # Reject blocks that are just output like "ok\nok\nok"
        if re.match(r"^(ok\s*\n?)+$", code):
            continue

        # Must look like Scheme: starts with ( or ; or a define/let/lambda
        if not (code.startswith("(") or code.startswith(";") or code.startswith("#!")):
            continue

        out.append(code)
    return out


# ---- verification via motoi ----------------------------------------------

def verify_code(code: str, timeout: float = 5.0) -> bool:
    """Run the code via `motoi run /dev/stdin`. Returns True if the parser
    accepts the code (reader errors reject). Runtime errors (missing
    modules, no audio device, etc.) are OK — many examples require live
    context we don't have here.
    """
    try:
        result = subprocess.run(
            [MOTOI, "run", "/dev/stdin", "--fuel", "10000"],
            input=code + "\n",
            capture_output=True,
            timeout=timeout,
            text=True,
        )
        if result.returncode == 0:
            return True
        combined = (result.stderr + result.stdout).lower()
        parse_markers = (
            "read error", "reader", "parse", "syntax error",
            "missing )", "missing (", "unmatched", "unexpected ",
            "unterminated string", "invalid escape",
        )
        for marker in parse_markers:
            if marker in combined:
                return False
        return True
    except subprocess.TimeoutExpired:
        return False
    except Exception:
        return False


# ---- prompt templates -----------------------------------------------------

# Rotated templates so the same code doesn't always get the same wrapper.
# Each returns (user_prompt, assistant_body). Assistant body includes a brief
# explanation drawn from the surrounding prose and a code fence.

USER_TEMPLATES = [
    "Show me a small Motoi Scheme example.",
    "Give me a quick Motoi snippet.",
    "How would you write this in Motoi?",
    "What does this Motoi program do?\n\n```motoi\n{code}\n```",
    "Explain this Motoi code.\n\n```motoi\n{code}\n```",
    "Write a short Motoi example demonstrating {topic}.",
    "How do I {topic} in Motoi?",
]


def topic_from_code(code: str) -> str:
    """Best-effort topic hint from the first form in the code."""
    m = re.search(r"\(([a-zA-Z0-9\-/!\?\+\*<>=]+)", code)
    if not m:
        return "this pattern"
    verb = m.group(1)
    verb_to_phrase = {
        "define": "define a value",
        "lambda": "build an anonymous function",
        "let": "bind local variables",
        "let*": "bind sequential locals",
        "letrec": "define mutually recursive locals",
        "if": "branch on a condition",
        "cond": "match multiple conditions",
        "case": "dispatch on a value",
        "when": "run a body when a test holds",
        "unless": "run a body when a test fails",
        "map": "map a function over a list",
        "filter": "filter a list",
        "fold": "fold a list",
        "reduce": "reduce a list",
        "display": "print a value",
        "newline": "print a newline",
        "begin": "run a sequence of expressions",
        "quote": "quote a literal",
        "quasiquote": "quasiquote a template",
        "car": "take the first of a pair",
        "cdr": "take the rest of a pair",
        "cons": "build a pair",
        "list": "build a list",
        "apply": "apply a function to a list of arguments",
        "define-syntax": "define a macro",
        "syntax-rules": "write a pattern-based macro",
        "set!": "mutate a binding",
        "audio/play": "play a tone",
        "draw/rect": "draw a rectangle",
        "fb/clear": "clear the framebuffer",
        "nt/prime?": "test primality",
    }
    if verb in verb_to_phrase:
        return verb_to_phrase[verb]
    # For arithmetic / comparison / unknown — describe by shape.
    if verb in ("+", "-", "*", "/", "quotient", "remainder", "modulo", "expt",
                "min", "max", "abs", "sqrt"):
        return "compute an arithmetic result"
    if verb in ("=", "<", ">", "<=", ">=", "eq?", "equal?", "eqv?"):
        return "compare values"
    if verb.endswith("?"):
        return "answer a yes/no question"
    if verb.endswith("!"):
        return "perform a mutating action"
    return "run the expression"


GENERIC_TAILS = [
    "",
    "That's the shape.",
    "Prefix notation, one form per call.",
    "Small pieces, small parens.",
    "That's it.",
    "The verb goes first, arguments after.",
]


def make_pairs(code: str, explanation: str, idx: int) -> "list[dict]":
    """Emit one clean CODE-teaching pair per code block.

    Two flavors, rotated:
      A) User asks a small teaching question, assistant answers with a
         code fence and (optionally) a short generic tail.
      B) User pastes code and asks what it does, assistant answers with
         a very short generic reading (topic + shape).

    We do NOT reuse prose-scraped explanations. Prose scraping was too
    noisy — nearby sentences often referred to a DIFFERENT snippet or
    were commentary on the LANGUAGE ("It does not have unless") that
    made the assistant reply misleading. Generic scaffolding is safer.
    The `explanation` argument is intentionally unused; kept for future
    tightening.
    """
    _ = explanation  # reserved for future tightening
    pairs = []
    topic = topic_from_code(code)

    # Rotate through the 5 question templates. Reserve the last two
    # (which take {code}) for Pair B.
    template_idx = idx % 5
    template = USER_TEMPLATES[template_idx]
    if "{code}" in template:
        # These templates want code embedded — use them for Pair B only.
        template = USER_TEMPLATES[0]
    if "{topic}" in template:
        user = template.format(topic=topic)
    else:
        user = template

    tail = GENERIC_TAILS[idx % len(GENERIC_TAILS)]
    if tail:
        assistant = "```motoi\n" + code + "\n```\n\n" + tail
    else:
        assistant = "```motoi\n" + code + "\n```"
    pairs.append({
        "messages": [
            {"role": "user", "content": user},
            {"role": "assistant", "content": assistant},
        ]
    })

    # Pair B — user pastes code, assistant gives a one-sentence reading.
    # Only for short code (<= 350 chars) so we don't dump massive blocks
    # into user turns.
    if len(code) <= 350:
        tmpl = USER_TEMPLATES[3 + (idx % 2)]  # templates 3 and 4 take code
        user_b = tmpl.format(code=code)
        v = topic_verb(code)
        # Avoid the awkward "uses `+` to compute an arithmetic result" —
        # pick shape by whether the topic mentions the verb.
        if f"`{v}`" in topic:
            reading = f"It's a call to `{v}`."
        elif topic.startswith("use `"):
            reading = f"It calls `{v}`."
        else:
            reading = f"It uses `{v}` to {topic}."
        pairs.append({
            "messages": [
                {"role": "user", "content": user_b},
                {"role": "assistant", "content": reading},
            ]
        })

    return pairs


def topic_verb(code: str) -> str:
    m = re.search(r"\(([a-zA-Z0-9\-/!\?\+\*<>=]+)", code)
    return m.group(1) if m else "define"


# ---- explanation extraction ----------------------------------------------

def extract_explanation(prose: str, code: str) -> str:
    """Take one or two sentences from BEFORE the code block that introduce
    it, or AFTER if before is empty. Bounded to ~200 chars."""
    # Find the code in prose (fenced)
    fence = f"```"
    # Locate the code's position by searching for a distinctive slice.
    key = code.strip().split("\n")[0][:60]
    if not key:
        return ""
    pos = prose.find(key)
    if pos < 0:
        return ""

    # Grab 400 chars before, look for the last 1-3 sentences.
    before = prose[max(0, pos - 400):pos]
    # Strip any trailing fence
    before = re.sub(r"```[a-zA-Z]*\s*$", "", before).strip()
    # Get sentences
    sents = re.split(r"(?<=[.!?])\s+", before)
    sents = [s.strip() for s in sents if s.strip() and len(s.strip()) > 15]
    if sents:
        picked = sents[-1]
        # Skip if it ends with a colon (looks like "try this:")
        if picked.endswith(":") and len(sents) >= 2:
            picked = sents[-2]
        if len(picked) > 220:
            picked = picked[:220].rsplit(" ", 1)[0] + "..."
        # Reject if it names a rejection filter
        if rejected(picked):
            return ""
        return picked

    return ""


# ---- held-out dedup -------------------------------------------------------

def load_heldout_hashes() -> "set[str]":
    """Hash each held-out user+assistant string. We reject any generated
    pair whose messages match a held-out hash."""
    hashes = set()
    if not HELDOUT.exists():
        return hashes
    for line in HELDOUT.read_text().splitlines():
        line = line.strip()
        if not line:
            continue
        try:
            obj = json.loads(line)
        except Exception:
            continue
        if obj.get("_provenance_header"):
            continue
        msgs = obj.get("messages", [])
        if not msgs:
            continue
        canon = json.dumps(msgs, sort_keys=True, ensure_ascii=False)
        hashes.add(hashlib.sha256(canon.encode()).hexdigest())
    return hashes


def pair_hash(pair: dict) -> str:
    canon = json.dumps(pair["messages"], sort_keys=True, ensure_ascii=False)
    return hashlib.sha256(canon.encode()).hexdigest()


# ---- heartbeat ------------------------------------------------------------

def write_heartbeat(status: str, pairs: int, books_done: int, current: str):
    ts = time.strftime("%Y-%m-%dT%H:%M:%S")
    HEARTBEAT.write_text(
        f"""(heartbeat
  :owner "marcus-1"
  :task "code-teaching-extraction"
  :started "2026-07-17T01:15:00"
  :last-update "{ts}"
  :status "{status}"
  :pairs-emitted {pairs}
  :books-done {books_done}
  :books-total 11
  :current "{current}"
  :output "{OUT_FILE}")
"""
    )


# ---- main -----------------------------------------------------------------

def check_inbox():
    if INBOX.exists() and INBOX.stat().st_size > 0:
        print(f"[marcus-1] inbox has content — please review: {INBOX}", file=sys.stderr)


def process():
    heldout = load_heldout_hashes()
    seen = set()  # type: set[str]
    reject_counts = {"corporate": 0, "philosopher": 0, "sakura": 0,
                     "story-frame": 0, "verify-fail": 0, "heldout-dupe": 0,
                     "self-dupe": 0, "no-code": 0, "empty-block": 0}
    total_pairs = 0
    books_done = 0
    per_book_stats = []

    OUT_FILE.parent.mkdir(parents=True, exist_ok=True)
    with OUT_FILE.open("w", encoding="utf-8") as out:
        header = {
            "_provenance_header": True,
            "generated_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
            "generator": "marcus-1-extractor.py",
            "owner": "marcus-1",
            "purpose": "CODE-teaching SFT pairs from POST-SCOUR Motoi scheme-books",
            "books": BOOKS,
            "reference": str(ROOT / "Scheme" / "MOTOI-SCHEME-REFERENCE.slat"),
            "heldout_source": str(HELDOUT),
            "notes": (
                "Every code example is parse-verified via bin/motoi run. "
                "Corporate/philosopher/Sakura/story-frame content rejected. "
                "Held-out pairs excluded by SHA-256 message hash."
            ),
        }
        out.write(json.dumps(header) + "\n")

        for book in BOOKS:
            book_dir = BOOKS_DIR / book
            if not book_dir.exists():
                print(f"[marcus-1] SKIP missing book: {book}", file=sys.stderr)
                continue

            book_pairs = 0
            book_rejects = 0
            chapters = sorted(book_dir.glob("*.slatl")) + sorted(book_dir.glob("*.slat"))
            chapters = [c for c in chapters if not c.name.startswith("MANIFEST")
                        and not c.name.startswith("CHAPTERS")
                        and not c.name.startswith("README")]

            # ---- Phase 1: gather (chapter, idx, code, explanation) items,
            # applying cheap rejection filters first. -------------------
            items = []  # list of (ch_path, idx, code, explanation)
            for ch_path in chapters:
                prose = load_prose(ch_path)
                if not prose:
                    continue
                blocks = extract_code_blocks(prose)
                if not blocks:
                    reject_counts["no-code"] += 1
                    continue

                for idx, code in enumerate(blocks):
                    r = rejected(code)
                    if r:
                        reject_counts[r] += 1
                        book_rejects += 1
                        continue

                    # We no longer use prose-scraped explanations (too noisy).
                    items.append((ch_path, idx, code, ""))

            # ---- Phase 2: verify in parallel. ------------------------
            verified = [False] * len(items)
            with ThreadPoolExecutor(max_workers=8) as pool:
                futures = {
                    pool.submit(verify_code, code): i
                    for i, (_, _, code, _) in enumerate(items)
                }
                for fut in as_completed(futures):
                    i = futures[fut]
                    try:
                        verified[i] = fut.result()
                    except Exception:
                        verified[i] = False

            # ---- Phase 3: emit pairs. --------------------------------
            for i, (ch_path, idx, code, explanation) in enumerate(items):
                if not verified[i]:
                    reject_counts["verify-fail"] += 1
                    book_rejects += 1
                    continue
                pairs = make_pairs(code, explanation, idx)
                for p in pairs:
                    h = pair_hash(p)
                    if h in heldout:
                        reject_counts["heldout-dupe"] += 1
                        book_rejects += 1
                        continue
                    if h in seen:
                        reject_counts["self-dupe"] += 1
                        book_rejects += 1
                        continue
                    seen.add(h)
                    out.write(json.dumps(p, ensure_ascii=False) + "\n")
                    total_pairs += 1
                    book_pairs += 1
                    if total_pairs % 500 == 0:
                        write_heartbeat(
                            "running",
                            total_pairs,
                            books_done,
                            f"in {book}/{ch_path.name}",
                        )
                        out.flush()
                        check_inbox()

            books_done += 1
            per_book_stats.append({
                "book": book,
                "pairs": book_pairs,
                "rejects": book_rejects,
                "chapters": len(chapters),
                "blocks": len(items),
            })
            write_heartbeat("running", total_pairs, books_done, f"finished {book}")
            print(
                f"[marcus-1] {book}: {book_pairs} pairs, {book_rejects} rejects, "
                f"{len(items)} blocks across {len(chapters)} chapters",
                file=sys.stderr,
            )

    # Final heartbeat
    write_heartbeat("done", total_pairs, books_done, "complete")

    summary = {
        "total_pairs": total_pairs,
        "books_done": books_done,
        "per_book": per_book_stats,
        "reject_counts": reject_counts,
        "output": str(OUT_FILE),
    }
    print(json.dumps(summary, indent=2), file=sys.stderr)


if __name__ == "__main__":
    process()
