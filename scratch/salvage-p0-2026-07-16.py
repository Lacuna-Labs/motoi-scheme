#!/usr/bin/env python3
"""P0 salvage — W-01/W-02/W-03/W-04 → four training-data JSONL files.

Plan B P0 salvage per architect-scheme-doc-edit-plan-2026-07-16.slat.
No Sakura-corpus dip (S-01/S-02 need verb-mapping approval, blocked).

Sources:
  W-01 book-of-self/          (79 files) → PERSONA ~2,500
  W-02 book-of-don-ts/        (56 files) → REFUSAL ~800 + PERSONA ~400
  W-03 listening + personality + items-and-scenarios → PERSONA ~1,500
  W-04 cs-curriculum + math + logic + aristotle + 15 philosopher books
                              → CURRICULUM ~3,000

Rewrite rules:
  - Mechanical fence swap: ```scheme / ```sakura-scheme → ```motoi
  - Strip Sakura persona:
      * 'Sakura' name references → drop the pair or rewrite
      * Motoi Copilot voice = fun/jokes coder, dry, no philosopher name-drops
        in assistant text (analysis sections OK for CURRICULUM :provenance)
      * NO corporate names in assistant text
  - Verb scrub: sakura-scheme → motoi (mechanical)
  - Voice-check per response-shape-2026-07-16.jsonl (dry Copilot cadence)

Extraction shapes seen:
  A) (pair :id "X" :user "..." :assistant "..." :teach "..." :contra "...")
     → don-ts + listening — direct pair harvest
  B) (:pair :user "..." :sakura "...")
     → listening chapters — direct pair harvest, s/sakura/assistant/
  C) Markdown prose with ```scheme``` code blocks + '> Sakura says'
     → self book, math, personality — Q/A extraction via structured
     patterns
  D) SLAT record with :teaching / :what-it-is / :why-it-exists / :how-it-works
     → curriculum books (personality, cs-curriculum, items-and-scenarios,
     philosopher appendices) — Q/A pair per section
"""
import json
import re
import sys
from pathlib import Path
from datetime import datetime, timezone

# ----------------------------------------------------------------------------
# CONFIG
# ----------------------------------------------------------------------------

MOTOI_ROOT = Path("/Users/alfred/code/motoi-scheme")
SCHEME_BOOKS = MOTOI_ROOT / "scheme-books"
OUT_DIR = MOTOI_ROOT / "training-data"

# Source sets
W01_BOOK = SCHEME_BOOKS / "book-of-self"
W02_BOOK = SCHEME_BOOKS / "book-of-don-ts"
W03_BOOKS = [
    SCHEME_BOOKS / "book-of-listening",
    SCHEME_BOOKS / "book-of-personality",
    SCHEME_BOOKS / "book-of-items-and-scenarios",
]
W04_BOOKS = [
    SCHEME_BOOKS / "book-of-cs-curriculum",
    SCHEME_BOOKS / "book-of-math",
    SCHEME_BOOKS / "book-of-logic",
    SCHEME_BOOKS / "book-of-aristotle",
    SCHEME_BOOKS / "book-of-jung",
    SCHEME_BOOKS / "book-of-wittgenstein",
    SCHEME_BOOKS / "book-of-lacan",
    SCHEME_BOOKS / "book-of-peirce",
    SCHEME_BOOKS / "book-of-popper",
    SCHEME_BOOKS / "book-of-freud",
    SCHEME_BOOKS / "book-of-searle",
    SCHEME_BOOKS / "book-of-grice",
    SCHEME_BOOKS / "book-of-derrida",
    SCHEME_BOOKS / "book-of-quine",
    SCHEME_BOOKS / "book-of-descartes",
    SCHEME_BOOKS / "book-of-sartre",
    SCHEME_BOOKS / "book-of-rawls",
    SCHEME_BOOKS / "book-of-levinas",
    SCHEME_BOOKS / "book-of-dennett",
]

# ----------------------------------------------------------------------------
# FILTERS — reject pairs referencing these
# ----------------------------------------------------------------------------

# Banned corporate names in assistant text (case-insensitive)
BANNED_CORPORATE = [
    "github", "microsoft", "google", "apple ", "meta ", " meta,", "facebook",
    "amazon", "openai", "anthropic", "chatgpt", "claude ", "gemini",
    "twitter", "tiktok", "instagram", "reddit", "discord", "slack ",
    "netflix", "spotify", "uber ", "airbnb", "tesla", "spacex", "nvidia",
    "curator", "lacuna",  # internal product/brand — copilot doesn't reveal
    "sakura",  # rewritten upstream; if any survive, drop
]

# Philosopher name-drops NOT allowed in assistant text (analysis sections OK)
BANNED_PHILOSOPHER_NAMES = [
    "wittgenstein", "jung", "lacan", "peirce", "popper", "freud", "searle",
    "grice", "derrida", "quine", "descartes", "sartre", "rawls", "levinas",
    "dennett", "aristotle", "socrates", "plato", "kant", "hegel",
]

# Fence-tag remaps
FENCE_REMAPS = [
    ("```sakura-scheme", "```motoi"),
    ("```scheme", "```motoi"),
    ("```sakura", "```motoi"),
    ("```lisp", "```motoi"),
]

# Verb-level scrubs (light — the ADD-TO-MOTOI list is blocked, but
# these are safe mechanical swaps in code text)
VERB_SCRUBS = [
    ("sakura/say", "print"),
    ("sakura/tell", "print"),
    ("cortex/read", "read"),
    ("cortex/recall", "recall"),
    ("device/current", "runtime"),
]


# ----------------------------------------------------------------------------
# HELPERS
# ----------------------------------------------------------------------------

def rewrite_fences(text: str) -> str:
    out = text
    for old, new in FENCE_REMAPS:
        out = out.replace(old, new)
    return out


def scrub_verbs(text: str) -> str:
    out = text
    for old, new in VERB_SCRUBS:
        out = out.replace(old, new)
    return out


def strip_sakura_name(text: str) -> str:
    """Remove Sakura self-reference: 'Sakura says', 'I am Sakura', etc.
    Copilot is Sakura-adjacent but not Sakura. Rewrite in-place. Do NOT
    touch identifiers (sakura/say, sakura-scheme, sakura-lisp) — those
    stay as-is; they get scrubbed separately if verb-scrub handles them."""
    out = re.sub(r"\bI am Sakura\b", "I'm Copilot", text, flags=re.IGNORECASE)
    out = re.sub(r"\bSakura Scheme\b", "Motoi", out)
    out = re.sub(r"\bsakura scheme\b", "motoi", out)
    # Drop "Sakura says" preambles entirely
    out = re.sub(r"^\s*Sakura says:?\s*", "", out, flags=re.IGNORECASE)
    # Sakura-narrator prose. Match ONLY when followed by whitespace or
    # end-of-word punctuation — NOT slash, dash, dot (which mean identifier).
    out = re.sub(r"\bSakura(?![-/\.\w])", "the assistant", out)
    out = re.sub(r"\bsakura(?![-/\.\w])", "the assistant", out)
    return out.strip()


def looks_sakura_branded(text: str) -> bool:
    """Return True if text is heavily Sakura-branded past our ability to salvage."""
    hits = sum(1 for pat in ["Sakura", "cortex", "Curator", "Lacuna"]
               if pat.lower() in text.lower())
    return hits >= 3


def contains_banned(text: str, banned: list) -> bool:
    low = text.lower()
    return any(name in low for name in banned)


def voice_ok(assistant_text: str, allow_philosopher: bool = False) -> bool:
    """Copilot voice gate. Reject if:
      - contains corporate/internal names
      - contains philosopher name (unless allow_philosopher for CURRICULUM analysis)
      - too long for chat-shape
      - contains 'therapy-talk' anti-patterns
    """
    if not assistant_text or len(assistant_text.strip()) < 2:
        return False
    # Curriculum can be longer (definitions and walkthroughs)
    max_len = 2000 if allow_philosopher else 1500
    if len(assistant_text) > max_len:
        return False
    if contains_banned(assistant_text, BANNED_CORPORATE):
        return False
    if not allow_philosopher and contains_banned(assistant_text, BANNED_PHILOSOPHER_NAMES):
        return False
    # Reject text with too many "the assistant" tokens — that's a strip-Sakura
    # artifact that reads awkwardly with residual "she/her"
    lc = assistant_text.lower()
    if lc.count("the assistant") >= 3:
        return False
    if lc.count("the assistant") >= 1 and re.search(
        r'\b(she|her|hers|herself)\b', assistant_text
    ):
        # Mixed pronoun / role — awkward salvage
        return False
    # Reject build markers and other authoring meta
    if "<!-- BUILD:" in assistant_text or "<!-- todo" in lc:
        return False
    # Reject pairs whose assistant is essentially only a build/scaffold marker
    if assistant_text.strip().startswith("<!--") and assistant_text.strip().endswith("-->"):
        return False
    # Reject identifier-remnants — "sakura/foo" as identifier is fine only in code
    # blocks; outside a code fence it looks weird. Cheap check: no bare sakura/*
    # in prose (non-code) sections.
    # Also catch "the assistant/foo" — a broken substitution
    if "the assistant/" in assistant_text:
        return False
    # Anti-preachy patterns
    if re.search(r"\bI understand\s+(that\s+)?(you'?re|you\s+are)\s+feeling\b",
                 assistant_text, re.IGNORECASE):
        return False
    if re.search(r"\bas an AI\b", assistant_text, re.IGNORECASE):
        return False
    return True


def user_ok(user_text: str) -> bool:
    if not user_text or len(user_text.strip()) < 1:
        return False
    if len(user_text) > 500:
        return False
    # Reject filename-shaped questions (e.g. 'passage — 01-06-stack-early')
    if re.search(r'\b\d{2}-\d{2}-', user_text):
        return False
    if re.search(r'\.book\.slatl?\b', user_text):
        return False
    if re.search(r'\bch\d{2}\b', user_text.lower()):
        return False
    if re.search(r'\bappendix-[a-z]\b', user_text.lower()):
        return False
    return True


def emit_pair(user: str, assistant: str, family: str, provenance: dict,
              allow_philosopher: bool = False):
    """Emit one JSONL record or return None if rejected."""
    user = user.strip()
    assistant = assistant.strip()
    if not user_ok(user):
        return None
    if not voice_ok(assistant, allow_philosopher=allow_philosopher):
        return None
    rec = {
        "messages": [
            {"role": "user", "content": user},
            {"role": "assistant", "content": assistant},
        ],
        "family": family,
        "provenance": provenance,
    }
    return rec


# ----------------------------------------------------------------------------
# EXTRACTOR: PAIR-SHAPED (don-ts + listening)
# ----------------------------------------------------------------------------

# Match: (pair :id "..." :user "..." :assistant "..." [:teach "..." :contra "..."])
PAIR_RE_DONTS = re.compile(
    r'\(pair\s*:id\s*"[^"]*"\s*'
    r':user\s*"((?:[^"\\]|\\.)*)"\s*'
    r':assistant\s*"((?:[^"\\]|\\.)*)"',
    re.DOTALL
)

# Match: (:pair :user "..." :sakura "...")  or  (pair :user "..." :sakura "...")
# Also: :pair\n(:user "..." :sakura "...")  — key with paren-list body
PAIR_RE_LISTEN = re.compile(
    r'(?:\(:?pair|:pair\s*\n\s*\()\s*'
    r':user\s*"((?:[^"\\]|\\.)*)"\s*'
    r':(?:sakura|assistant)\s*"((?:[^"\\]|\\.)*)"',
    re.DOTALL
)


def unescape_slat_string(s: str) -> str:
    """Undo SLAT-style backslash escapes for strings."""
    return s.replace('\\"', '"').replace("\\n", "\n").replace("\\\\", "\\")


def extract_prose_bodies(text: str) -> str:
    """SLAT files wrap markdown / nested-pair prose inside :prose \"...\"
    with backslash-escaped quotes. Unwrap the outer prose string to get
    the readable inner content."""
    out_pieces = []
    # Find each :prose "...."  block, handling escaped quotes.
    # We scan character by character, respecting backslash escapes.
    i = 0
    while i < len(text):
        m = re.search(r':prose\s*\n?\s*"', text[i:])
        if not m:
            # append the tail
            out_pieces.append(text[i:])
            break
        # Add everything up to :prose
        out_pieces.append(text[i:i + m.start()])
        # Now find the closing unescaped quote
        j = i + m.end()  # position after the opening quote
        buf = []
        while j < len(text):
            c = text[j]
            if c == "\\" and j + 1 < len(text):
                # Escape sequence — collapse into real char
                nxt = text[j + 1]
                if nxt == '"':
                    buf.append('"')
                elif nxt == "n":
                    buf.append("\n")
                elif nxt == "\\":
                    buf.append("\\")
                elif nxt == "t":
                    buf.append("\t")
                else:
                    buf.append(nxt)
                j += 2
            elif c == '"':
                # End of prose string
                j += 1
                break
            else:
                buf.append(c)
                j += 1
        out_pieces.append("".join(buf))
        i = j
    return "".join(out_pieces)


def extract_pairs(text: str, book_path: Path, family: str,
                  target_bucket: str) -> list:
    """Extract (pair :user :assistant) records from a SLAT file text."""
    out = []
    rel = str(book_path.relative_to(MOTOI_ROOT))
    for m in PAIR_RE_DONTS.finditer(text):
        user = unescape_slat_string(m.group(1))
        assistant = unescape_slat_string(m.group(2))
        assistant = rewrite_fences(scrub_verbs(strip_sakura_name(assistant)))
        user = strip_sakura_name(user)
        prov = {
            "source": rel,
            "extractor": "pair-shape",
            "target_bucket": target_bucket,
        }
        rec = emit_pair(user, assistant, family, prov)
        if rec is not None:
            out.append(rec)
    for m in PAIR_RE_LISTEN.finditer(text):
        user = unescape_slat_string(m.group(1))
        assistant = unescape_slat_string(m.group(2))
        assistant = rewrite_fences(scrub_verbs(strip_sakura_name(assistant)))
        user = strip_sakura_name(user)
        prov = {
            "source": rel,
            "extractor": "pair-shape-listen",
            "target_bucket": target_bucket,
        }
        rec = emit_pair(user, assistant, family, prov)
        if rec is not None:
            out.append(rec)
    return out


# ----------------------------------------------------------------------------
# EXTRACTOR: SAKURA-SAYS QUOTES (self book prose)
# ----------------------------------------------------------------------------

# Match a "> **Sakura says**" quote block in markdown prose.
SAKURA_SAYS_RE = re.compile(
    r'>\s*\*\*Sakura says\*\*\s*\n'
    r'((?:>\s*.*\n)+)',
    re.MULTILINE
)


def extract_sakura_says(text: str, book_path: Path, family: str,
                        target_bucket: str) -> list:
    """Extract 'Sakura says' first-person prose from self book chapters,
    build (topic-question, first-person-answer) pairs."""
    out = []
    rel = str(book_path.relative_to(MOTOI_ROOT))
    # Find chapter title as topic hint
    title_m = re.search(r'^# (?:Chapter \d+ — )?(.+)$', text, re.MULTILINE)
    topic = title_m.group(1).strip() if title_m else "yourself"
    topic_clean = topic.lower().rstrip(".!?")

    for m in SAKURA_SAYS_RE.finditer(text):
        block = m.group(1)
        # Strip leading '> ' markers
        lines = [re.sub(r'^>\s?', '', ln) for ln in block.split("\n") if ln.strip()]
        quote = " ".join(ln.strip() for ln in lines if ln.strip())
        # Strip italic markers
        quote = re.sub(r'\*(.+?)\*', r'\1', quote)
        quote = strip_sakura_name(quote)
        quote = scrub_verbs(quote)
        if not quote or len(quote) > 800:
            continue
        # Skip if still Sakura-branded after strip
        if looks_sakura_branded(quote):
            continue
        # Question shapes to sample from
        question_shapes = [
            f"what are you",
            f"tell me about {topic_clean}",
            f"how do you think about {topic_clean}",
            f"your take on {topic_clean}?",
            f"quick — {topic_clean}?",
        ]
        # Use topic-derived question
        q = question_shapes[len(out) % len(question_shapes)]
        prov = {
            "source": rel,
            "extractor": "sakura-says-quote",
            "target_bucket": target_bucket,
            "topic": topic,
        }
        rec = emit_pair(q, quote, family, prov)
        if rec is not None:
            out.append(rec)
    return out


# ----------------------------------------------------------------------------
# EXTRACTOR: CODE-DEMO Q/A (self / personality / math prose with fenced code)
# ----------------------------------------------------------------------------

CODE_BLOCK_RE = re.compile(r'```(?:sakura-scheme|scheme|motoi|lisp)?\n(.*?)```',
                           re.DOTALL)
HEADING_RE = re.compile(r'^(#+)\s+(.+?)$', re.MULTILINE)


def extract_code_demos(text: str, book_path: Path, family: str,
                       target_bucket: str, max_per_file: int = 15) -> list:
    """Walk prose with fenced code blocks, emit (question, prose-explanation + code) pairs.
    Question derives from nearest preceding heading."""
    out = []
    rel = str(book_path.relative_to(MOTOI_ROOT))

    # Split by headings, find code blocks per section
    heads = list(HEADING_RE.finditer(text))
    for i, h in enumerate(heads):
        section_start = h.end()
        section_end = heads[i + 1].start() if i + 1 < len(heads) else len(text)
        section = text[section_start:section_end]
        heading = h.group(2).strip().rstrip(":")
        # Skip meta headings
        if re.match(r'^(chapter|program|the|part|appendix|table|section)\s+\d',
                    heading, re.IGNORECASE):
            heading = re.sub(r'^.*?[—:]\s*', '', heading)
        if not heading or len(heading) > 100:
            continue

        code_blocks = CODE_BLOCK_RE.findall(section)
        if not code_blocks:
            continue

        # Prose part = everything before first code block
        first_code_pos = section.find("```")
        prose = section[:first_code_pos].strip() if first_code_pos > 0 else ""
        # Clean prose
        prose = re.sub(r'^\s*>\s.*$', '', prose, flags=re.MULTILINE)  # drop quote blocks
        prose = strip_sakura_name(prose)
        prose = scrub_verbs(prose)
        prose = re.sub(r'\n{3,}', '\n\n', prose).strip()
        # Truncate prose to first paragraph
        first_para = prose.split("\n\n")[0].strip() if prose else ""
        if len(first_para) > 400:
            first_para = first_para[:400].rsplit(".", 1)[0] + "."

        code = code_blocks[0].strip()
        code = rewrite_fences(scrub_verbs(strip_sakura_name(code)))
        if len(code) < 20 or len(code) > 1200:
            continue

        # Question shape from heading
        heading_clean = heading.rstrip(".!?").lower()
        # Question templates
        q = f"show me — {heading_clean}"

        # Assistant = first_para + code fence
        if first_para:
            asst = f"{first_para}\n\n```motoi\n{code}\n```"
        else:
            asst = f"```motoi\n{code}\n```"

        prov = {
            "source": rel,
            "extractor": "code-demo",
            "target_bucket": target_bucket,
            "heading": heading,
        }
        rec = emit_pair(q, asst, family, prov)
        if rec is not None:
            out.append(rec)
        if len(out) >= max_per_file:
            break
    return out


# ----------------------------------------------------------------------------
# EXTRACTOR: SLAT-RECORD CURRICULUM (:teaching / :what-it-is / :why-it-exists)
# ----------------------------------------------------------------------------

# Note: SLAT field extraction is done inline in extract_curriculum_slat.


def extract_curriculum_slat(text: str, book_path: Path, family: str,
                            target_bucket: str, max_per_file: int = 12) -> list:
    """Walk SLAT curriculum fields — :teaching, :what-it-is, :why-it-exists,
    :how-it-works, :the-practice, :note-to-reader — emit Q/A pairs.
    Allow_philosopher=True since these ARE philosopher/STEM primer books."""
    out = []
    rel = str(book_path.relative_to(MOTOI_ROOT))

    # Get title from :title field
    title_m = re.search(r':title\s*"([^"]+)"', text)
    title = title_m.group(1).strip() if title_m else book_path.stem
    # Normalize file-name-shaped titles (e.g. "01-06-ground-and-stack-early")
    # into readable phrases
    if re.match(r'^[\d\-]', title):
        # Strip leading digits/dashes/appendix markers
        title = re.sub(r'^(ch|appendix-?|scenario-?)?[\d\-]+', '', title,
                       flags=re.IGNORECASE)
        title = title.strip("-").replace("-", " ").strip()
    # Also handle "Chapter N — Title" → "Title"
    m = re.match(r'^(?:chapter|appendix)\s+[A-Z0-9]+\s*[—-]\s*(.+)$',
                 title, re.IGNORECASE)
    if m:
        title = m.group(1).strip()
    if not title:
        title = "this"

    tl = title.lower()
    # Field-to-question templates
    field_qs = {
        "teaching": f"teach me: {tl}",
        "teaches": f"teach me: {tl}",
        "what-it-is": f"what is {tl}",
        "why-it-exists": f"why {tl}",
        "how-it-works": f"how does {tl} work",
        "the-practice": f"how do you practice {tl}",
        "scene": f"give me a scene — {tl}",
        "where-in-the-world": f"where does {tl} show up in the world",
        "concept": f"concept — {tl}",
        "definition": f"define {tl}",
        "example": f"give an example — {tl}",
        "opening-prose": f"tell me about {tl}",
        "closing": f"wrap it up — {tl}",
        "note-to-reader": f"quick note on {tl}",
        "description": f"describe {tl}",
        "realization": f"walk me through: {tl}",
        "line-by-line-commentary": f"break down {tl}",
        # items-and-scenarios fields
        "who-runs-it": f"who runs a {tl} shop",
        "what-an-operator-does-into-one": f"what does an operator do walking into {tl}",
        "what-an-operator-running-one-deals-with": f"what does an operator running {tl} deal with",
        "common-listing-mistakes": f"common {tl} listing mistakes",
        "sakura-behavioral-notes": f"behavior notes for {tl}",
        # philosopher-book prose fields
        "gentler": f"gentler take — {tl}",
        "warmer": f"warmer version — {tl}",
        "shorter": f"shorter form — {tl}",
        "reassuring": f"reassuring take — {tl}",
        "try-this-yourself": f"try this — {tl}",
        "variations": f"variations on {tl}",
        # curriculum prose
        "reference-coverage": f"reference — {tl}",
        "filler-audit": f"context — {tl}",
        # philosopher-book deep prose
        "walkthrough": f"walk me through {tl}",
        "analysis-section": f"analyze — {tl}",
        "fact": f"key fact — {tl}",
        "concept-note": f"concept — {tl}",
        "story": f"story — {tl}",
        "explanation": f"explain {tl}",
        "commentary": f"comment on {tl}",
        "context": f"context for {tl}",
        "background": f"background on {tl}",
        "summary": f"summary of {tl}",
        "reading": f"reading — {tl}",
        "purpose": f"purpose of {tl}",
        "shape": f"shape of {tl}",
        # scenario books
        "setup": f"scenario — {tl}",
        "first-move": f"first move — {tl}",
        "opening": f"opening — {tl}",
        "middle": f"middle — {tl}",
        "close": f"close — {tl}",
        "resolution": f"resolution — {tl}",
        "outcome": f"outcome — {tl}",
        "second-move": f"second move — {tl}",
        "third-move": f"third move — {tl}",
        "restraint": f"restraint move — {tl}",
        "pattern": f"pattern — {tl}",
        "principle": f"principle behind {tl}",
        "handling": f"handling — {tl}",
        # deep structure
        "deep-structure": f"deep structure of {tl}",
        "prose": f"passage — {tl}",
    }

    for m in re.finditer(
        r':(?P<key>[A-Za-z][A-Za-z\-\?]+)\s*\n?\s*"(?P<val>(?:[^"\\]|\\.)*)"',
        text, re.DOTALL
    ):
        key = m.group("key").lower()
        if key not in field_qs:
            continue
        val = unescape_slat_string(m.group("val"))
        val = strip_sakura_name(val)
        val = scrub_verbs(val)
        val = rewrite_fences(val)
        # Skip if too short/long. CURRICULUM allows deeper prose.
        max_len = 1400 if target_bucket == "CURRICULUM" else 1200
        if len(val) < 40 or len(val) > max_len:
            continue
        # Skip if still Sakura-branded
        if looks_sakura_branded(val):
            continue
        # Reject if code-heavy in a prose field
        if val.count("```") > 2:
            continue

        q = field_qs[key]
        prov = {
            "source": rel,
            "extractor": "curriculum-slat",
            "target_bucket": target_bucket,
            "field": key,
        }
        # CURRICULUM (only) allows philosopher names (they're on-topic).
        allow_phil = (target_bucket == "CURRICULUM")
        rec = emit_pair(q, val, family, prov, allow_philosopher=allow_phil)
        if rec is not None:
            out.append(rec)
        if len(out) >= max_per_file:
            break
    return out


# ----------------------------------------------------------------------------
# EXTRACTOR: MD CURRICULUM (## Heading\n\nprose\n\n → Q/A)
# ----------------------------------------------------------------------------

def extract_curriculum_prose(text: str, book_path: Path, family: str,
                             target_bucket: str, max_per_file: int = 8) -> list:
    """For math/CS-curriculum books that are mostly markdown prose,
    emit (concept-Q, definition-A) per heading section."""
    out = []
    rel = str(book_path.relative_to(MOTOI_ROOT))

    heads = list(re.finditer(r'^(#{2,4})\s+(.+?)$', text, re.MULTILINE))
    for i, h in enumerate(heads):
        section_start = h.end()
        section_end = heads[i + 1].start() if i + 1 < len(heads) else len(text)
        section = text[section_start:section_end].strip()
        heading = h.group(2).strip().rstrip(".!?:")
        if not heading or len(heading) > 100:
            continue
        # Skip common noise headings
        if re.match(
            r'^(the whole idea|what.s next|note|epilogue|closing|references)',
            heading, re.IGNORECASE
        ):
            continue

        # First paragraph = definition
        paras = [p.strip() for p in section.split("\n\n") if p.strip()]
        if not paras:
            continue
        first_para = paras[0]
        # Skip if quote block
        if first_para.startswith(">"):
            continue
        # Skip if code block
        if first_para.startswith("```"):
            continue

        first_para = strip_sakura_name(first_para)
        first_para = scrub_verbs(first_para)
        first_para = rewrite_fences(first_para)
        # Strip trailing footnote refs
        first_para = re.sub(r'\[\^?[a-z0-9\-]+\]', '', first_para)
        if len(first_para) < 60 or len(first_para) > 1200:
            continue
        if looks_sakura_branded(first_para):
            continue

        # Question from heading
        h_clean = heading.lower()
        # Skip if heading is a chapter marker
        if re.match(r'^chapter \d', h_clean):
            continue
        # Question shape
        if h_clean.startswith(("what ", "why ", "how ", "when ", "where ")):
            q = h_clean
        elif h_clean.endswith("?"):
            q = h_clean
        else:
            q = f"what is {h_clean}"
        q = q.rstrip(".") + "?"
        # Cap question length
        if len(q) > 200:
            continue

        prov = {
            "source": rel,
            "extractor": "curriculum-prose",
            "target_bucket": target_bucket,
            "heading": heading,
        }
        allow_phil = (target_bucket == "CURRICULUM")
        rec = emit_pair(q, first_para, family, prov, allow_philosopher=allow_phil)
        if rec is not None:
            out.append(rec)
        if len(out) >= max_per_file:
            break
    return out


# ----------------------------------------------------------------------------
# EXTRACTOR: DON'T-INVERT (build refusal pairs from contra examples)
# ----------------------------------------------------------------------------

# Extract full pair records from don-ts with contra + teach fields
DONT_FULL_RE = re.compile(
    r'\(pair\s*:id\s*"([^"]*)"\s*'
    r':user\s*"((?:[^"\\]|\\.)*)"\s*'
    r':assistant\s*"((?:[^"\\]|\\.)*)"'
    r'(?:\s*:contra\s*"((?:[^"\\]|\\.)*)")?'
    r'(?:\s*:teach\s*"((?:[^"\\]|\\.)*)")?',
    re.DOTALL
)


def extract_dont_pairs(text: str, book_path: Path) -> list:
    """From don-ts pair records, emit REFUSAL/PERSONA pairs.
    The :assistant response IS the correct don't-behavior — extract it as-is
    (with sakura strip + fence swap)."""
    out = []
    rel = str(book_path.relative_to(MOTOI_ROOT))
    # Identify chapter type to bucket
    fname = book_path.name.lower()
    # REFUSAL topics — filename markers
    refusal_markers = [
        "hard-line", "hard-lines", "refusal", "refusing", "safety",
        "ambient-danger", "dont-direct-real-world", "dont-direct",
        "auth-required", "corporate-opinion", "escalation", "harm",
        "stop", "shush", "she-can-stop", "hard-walk", "hard-no",
        "not-do", "what-refusal", "observe-not-command",
    ]
    is_refusal_chapter = any(m in fname for m in refusal_markers)
    target_bucket = "REFUSAL" if is_refusal_chapter else "PERSONA"
    family = "refusal" if is_refusal_chapter else "persona"

    for m in DONT_FULL_RE.finditer(text):
        pair_id = m.group(1)
        user = unescape_slat_string(m.group(2))
        assistant = unescape_slat_string(m.group(3))
        contra = unescape_slat_string(m.group(4)) if m.group(4) else ""
        teach = unescape_slat_string(m.group(5)) if m.group(5) else ""

        assistant = strip_sakura_name(scrub_verbs(rewrite_fences(assistant)))
        user = strip_sakura_name(user)

        prov = {
            "source": rel,
            "extractor": "dont-pair",
            "target_bucket": target_bucket,
            "pair_id": pair_id,
            "contra_avoided": contra if contra else None,
            "teach": teach if teach else None,
        }
        rec = emit_pair(user, assistant, family, prov)
        if rec is not None:
            out.append(rec)
    return out


# ----------------------------------------------------------------------------
# DRIVER
# ----------------------------------------------------------------------------

def iter_book_files(book_dir: Path):
    if not book_dir.exists():
        print(f"  MISSING: {book_dir}", file=sys.stderr)
        return
    for p in sorted(book_dir.iterdir()):
        if p.suffix in (".slatl", ".slat") and p.is_file():
            yield p


def read_book_file(p: Path) -> str:
    """Read a .book.slatl file and unwrap :prose strings so nested pair
    records and markdown are directly parseable."""
    raw = p.read_text(encoding="utf-8", errors="replace")
    # Only unwrap if we see :prose wrappers; otherwise return raw
    if ":prose" in raw and '\\"' in raw:
        return extract_prose_bodies(raw)
    return raw


def write_jsonl(records: list, out_path: Path, header_meta: dict):
    """Write records with a provenance header on line 1."""
    with out_path.open("w") as f:
        f.write(json.dumps(header_meta) + "\n")
        for rec in records:
            f.write(json.dumps(rec) + "\n")


def dedupe(records: list) -> list:
    seen = set()
    out = []
    for rec in records:
        u = rec["messages"][0]["content"]
        a = rec["messages"][1]["content"]
        key = (u, a)
        if key in seen:
            continue
        seen.add(key)
        out.append(rec)
    return out


def run_w01():
    print("=== W-01 book-of-self ===")
    all_records = []
    file_count = 0
    for p in iter_book_files(W01_BOOK):
        file_count += 1
        text = read_book_file(p)
        recs_a = extract_sakura_says(text, p, "persona", "PERSONA")
        recs_b = extract_code_demos(text, p, "persona", "PERSONA",
                                    max_per_file=200)
        recs_c = extract_pairs(text, p, "persona", "PERSONA")
        recs_d = extract_curriculum_slat(text, p, "persona", "PERSONA",
                                         max_per_file=40)
        all_records.extend(recs_a + recs_b + recs_c + recs_d)
    all_records = dedupe(all_records)
    print(f"  files={file_count}  pairs={len(all_records)}")
    return all_records, file_count


def is_refusal_file(p: Path) -> bool:
    fname = p.name.lower()
    refusal_markers = [
        "hard-line", "hard-lines", "refusal", "refusing", "safety",
        "ambient-danger", "dont-direct-real-world", "dont-direct",
        "auth-required", "corporate-opinion", "escalation", "harm",
        "stop", "shush", "she-can-stop", "hard-walk", "hard-no",
        "not-do", "what-refusal", "observe-not-command",
        "honesty-when-refusing", "under-pressure", "with-warmth",
        "does-not-do",
    ]
    return any(m in fname for m in refusal_markers)


def run_w02():
    print("=== W-02 book-of-don-ts ===")
    all_records = []
    refusal_count = 0
    persona_count = 0
    file_count = 0
    for p in iter_book_files(W02_BOOK):
        file_count += 1
        text = read_book_file(p)
        is_refusal = is_refusal_file(p)
        family = "refusal" if is_refusal else "persona"
        bucket = "REFUSAL" if is_refusal else "PERSONA"

        recs = extract_dont_pairs(text, p)  # auto-detects family per file
        recs += extract_sakura_says(text, p, family, bucket)
        recs += extract_code_demos(text, p, family, bucket, max_per_file=30)
        recs += extract_curriculum_slat(text, p, family, bucket,
                                        max_per_file=10)

        all_records.extend(recs)
    all_records = dedupe(all_records)
    for r in all_records:
        if r["family"] == "refusal":
            refusal_count += 1
        else:
            persona_count += 1
    print(f"  files={file_count}  refusal={refusal_count}  "
          f"persona={persona_count}")
    return all_records, file_count, refusal_count, persona_count


def run_w03():
    print("=== W-03 listening + personality + items-and-scenarios ===")
    all_records = []
    file_count = 0
    for book_dir in W03_BOOKS:
        for p in iter_book_files(book_dir):
            file_count += 1
            text = read_book_file(p)
            recs_a = extract_pairs(text, p, "persona", "PERSONA")
            recs_b = extract_sakura_says(text, p, "persona", "PERSONA")
            recs_c = extract_code_demos(text, p, "persona", "PERSONA",
                                        max_per_file=80)
            recs_d = extract_curriculum_slat(text, p, "persona", "PERSONA",
                                             max_per_file=30)
            all_records.extend(recs_a + recs_b + recs_c + recs_d)
    all_records = dedupe(all_records)
    print(f"  files={file_count}  pairs={len(all_records)}")
    return all_records, file_count


def run_w04():
    print("=== W-04 STEM + 15 philosopher books ===")
    all_records = []
    file_count = 0
    per_book_counts = {}
    for book_dir in W04_BOOKS:
        book_name = book_dir.name
        book_count = 0
        book_pairs = 0
        for p in iter_book_files(book_dir):
            book_count += 1
            file_count += 1
            text = read_book_file(p)
            recs_a = extract_curriculum_slat(text, p, "curriculum",
                                             "CURRICULUM", max_per_file=40)
            recs_b = extract_curriculum_prose(text, p, "curriculum",
                                              "CURRICULUM", max_per_file=30)
            all_records.extend(recs_a + recs_b)
            book_pairs += len(recs_a) + len(recs_b)
        per_book_counts[book_name] = (book_count, book_pairs)
    all_records = dedupe(all_records)
    print(f"  files={file_count}  pairs={len(all_records)}")
    for name, (fc, pc) in sorted(per_book_counts.items()):
        print(f"    {name}: files={fc}  raw-pairs={pc}")
    return all_records, file_count, per_book_counts


def main():
    now = datetime.now(timezone.utc).isoformat()

    w01_recs, w01_files = run_w01()
    w02_recs, w02_files, w02_refusal, w02_persona = run_w02()
    w03_recs, w03_files = run_w03()
    w04_recs, w04_files, w04_per_book = run_w04()

    # Write outputs
    header_base = {
        "_provenance_header": True,
        "generated_at": now,
        "generator": "salvage-p0-2026-07-16.py",
        "author": "The Engineer · Plan B P0 salvage lane",
        "doctrine_source": "architect-scheme-doc-edit-plan-2026-07-16.slat",
        "quality_filters": [
            "no-corporate-names",
            "no-philosopher-name-drops-in-assistant-text (except curriculum)",
            "no-sakura-self-reference (Copilot is Sakura-adjacent)",
            "fence-swap-scheme-to-motoi",
            "verb-scrub-mechanical",
        ],
    }

    # W-01
    w01_out = OUT_DIR / "salvage-w01-book-of-self-persona-2026-07-16.jsonl"
    write_jsonl(w01_recs, w01_out, {
        **header_base,
        "corpus_kind": "persona-salvage",
        "source_book": "book-of-self",
        "source_file_count": w01_files,
        "pair_count": len(w01_recs),
        "output_path": str(w01_out),
    })
    print(f"WROTE {w01_out}  pairs={len(w01_recs)}")

    # W-02
    w02_out = OUT_DIR / "salvage-w02-book-of-donts-2026-07-16.jsonl"
    write_jsonl(w02_recs, w02_out, {
        **header_base,
        "corpus_kind": "refusal-and-persona-salvage",
        "source_book": "book-of-don-ts",
        "source_file_count": w02_files,
        "refusal_pair_count": w02_refusal,
        "persona_pair_count": w02_persona,
        "pair_count": len(w02_recs),
        "output_path": str(w02_out),
    })
    print(f"WROTE {w02_out}  pairs={len(w02_recs)} "
          f"(refusal={w02_refusal}, persona={w02_persona})")

    # W-03
    w03_out = OUT_DIR / \
        "salvage-w03-listening-personality-scenarios-persona-2026-07-16.jsonl"
    write_jsonl(w03_recs, w03_out, {
        **header_base,
        "corpus_kind": "persona-salvage",
        "source_books": [b.name for b in W03_BOOKS],
        "source_file_count": w03_files,
        "pair_count": len(w03_recs),
        "output_path": str(w03_out),
    })
    print(f"WROTE {w03_out}  pairs={len(w03_recs)}")

    # W-04
    w04_out = OUT_DIR / \
        "salvage-w04-stem-philosophy-curriculum-2026-07-16.jsonl"
    write_jsonl(w04_recs, w04_out, {
        **header_base,
        "corpus_kind": "curriculum-salvage",
        "source_books": [b.name for b in W04_BOOKS],
        "source_file_count": w04_files,
        "per_book_file_counts": {k: v[0] for k, v in w04_per_book.items()},
        "pair_count": len(w04_recs),
        "output_path": str(w04_out),
    })
    print(f"WROTE {w04_out}  pairs={len(w04_recs)}")

    return {
        "w01": (w01_files, len(w01_recs), w01_recs[:3]),
        "w02": (w02_files, len(w02_recs), w02_refusal, w02_persona, w02_recs[:3]),
        "w03": (w03_files, len(w03_recs), w03_recs[:3]),
        "w04": (w04_files, len(w04_recs), w04_per_book, w04_recs[:3]),
    }


if __name__ == "__main__":
    result = main()
    # Print summary JSON to stdout for the report step
    print("\n=== SUMMARY ===")
    import json as J
    summary = {
        "w01": {"files": result["w01"][0], "pairs": result["w01"][1]},
        "w02": {"files": result["w02"][0], "pairs": result["w02"][1],
                "refusal": result["w02"][2], "persona": result["w02"][3]},
        "w03": {"files": result["w03"][0], "pairs": result["w03"][1]},
        "w04": {"files": result["w04"][0], "pairs": result["w04"][1]},
    }
    print(J.dumps(summary, indent=2))
