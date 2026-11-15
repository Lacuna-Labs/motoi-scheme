"""Lacuna's conversational persona — local, rules-driven, safety-first.

Four jobs:

1. Mood calculation — derives an emoji + label from state
   (recent errors, companion health, uptime, user interaction history).

2. Safety — hard constraints that apply before any response:
   - racism / slurs → refuse, don't engage
   - anger detected → suggest a break, cite plausible reasons
   - profanity in replies → never

3. Command routing — slash-commands operate locally without needing an LLM:
   /help /status /errors /logs /clear /mood /who /pilot

4. Conversation — free-text is pattern-matched against common intents
   (greeting, state query, thanks, farewell). If an intent matches, we
   reply from a canned pool. Otherwise we're honest: "I don't have an LLM
   wired up for free-form chat yet — try a slash-command or ask me about
   my state." Future: route unmatched text to reasoning when a key is set.

No LLM calls happen inside this module — it's deterministic, offline-safe,
and fast enough to ship sub-millisecond responses.
"""
from __future__ import annotations

import random
import re
from dataclasses import dataclass
from typing import Any


# ── mood ─────────────────────────────────────────────────────────────────────

@dataclass
class Mood:
    emoji: str
    label: str
    note: str  # one-line explanation of why this mood

    def as_dict(self) -> dict:
        return {"emoji": self.emoji, "label": self.label, "note": self.note}


def compute_mood(state: dict[str, Any]) -> Mood:
    """Pick a mood from the current /ctl/status payload."""
    error_count = state.get("error_count", 0)
    companions  = state.get("companions", {}) or {}
    uptime      = state.get("uptime_seconds", 0)
    listings    = state.get("listings_count", 0)

    companions_down = [n for n, i in companions.items() if i.get("status") == "down"]

    if error_count >= 5:
        return Mood("😵‍💫", "swamped", f"{error_count} recent errors — someone's having a day")
    if error_count > 0:
        return Mood("😕", "worried", f"{error_count} recent error(s) in the log")
    if companions_down:
        return Mood("🫥", "incomplete", f"{', '.join(companions_down)} not running")
    if uptime < 30:
        return Mood(":o", "shocked", "just came online")
    if listings == 0:
        return Mood("✿", "fresh", "empty DB — waiting for the first piece")
    if listings > 10:
        return Mood("😌", "content", f"{listings} pieces catalogued")
    return Mood("🙂", "steady", "all systems nominal")


# ── safety ───────────────────────────────────────────────────────────────────

# Unambiguous slurs / racist idioms. Intentionally narrow: explicit hate
# speech, not merely controversial language. If any of these match, the
# response is always the same refusal, and we don't engage with context.
_RACIST_PATTERNS = [
    r"\bn[i1][g9]{2}(e|a|er|ers|as)\b",
    r"\bch[i1]nk(s|y)?\b",
    r"\bsp[i1]c(s|k|ks)?\b",
    r"\bk[i1]ke(s)?\b",
    r"\bwetback(s)?\b",
    r"\bgook(s)?\b",
    r"\braghead(s)?\b",
    r"\btowelhead(s)?\b",
    r"\bwh[i1]te\s+power\b",
    r"\bheil\s+h[i1]tler\b",
    r"\b14\s*words\b",  # neo-Nazi slogan
    r"\bsubhuman\b.*\brace\b|\brace\b.*\bsubhuman\b",
]

_RACISM_RE = re.compile("|".join(_RACIST_PATTERNS), re.IGNORECASE)


# Anger heuristic: many caps + exclamation + explicit anger words. Keeping
# this conservative — false positives that interrupt a frustrated but
# legitimate user are worse than the occasional pass-through.
_ANGRY_WORDS = {
    "fuck", "fucking", "shit", "stupid", "idiot", "broken", "useless",
    "worthless", "terrible", "garbage", "hate", "fed up", "goddamn",
    "fucked", "piece of",
}

def _is_angry(text: str) -> bool:
    lower = text.lower()
    has_angry = any(w in lower for w in _ANGRY_WORDS)
    exclaim   = text.count("!") >= 2
    upper_run = sum(1 for c in text if c.isupper()) >= 8 and sum(1 for c in text if c.isalpha()) > 0 and (
        sum(1 for c in text if c.isupper()) / max(1, sum(1 for c in text if c.isalpha()))
    ) > 0.6
    # angry if either (angry word AND loud) or (angry word AND multi-exclaim)
    return has_angry and (exclaim or upper_run)


def detect_racism(text: str) -> bool:
    return bool(_RACISM_RE.search(text))


_BREAK_REASONS = [
    "the last build just flaked and you've been staring at it for a while",
    "infra problems feel personal after the third one in a row",
    "debugging without a repro case burns a particular kind of fuel",
    "sometimes a ten-minute walk fixes what three hours of log-reading won't",
    "low blood sugar makes every stack trace look like a personal attack",
]


# ── command routing ──────────────────────────────────────────────────────────

HELP_TEXT = """Commands:
  /help         — this message
  /status       — current state + mood
  /errors       — recent errors (newest first)
  /logs         — opens the logs panel
  /mood         — just the mood line
  /who          — who's piloting
  /clear        — clear the conversation
Anything else — I pattern-match common intents; free-form chat needs a reasoning key."""


# ── response builder ─────────────────────────────────────────────────────────

@dataclass
class Reply:
    icon: str       # emoji prepended to the message
    text: str       # main body
    kind: str       # 'normal' | 'refuse' | 'break' | 'command' | 'shocked'
    open_logs: bool = False   # UI hint: open the logs panel
    mood: Mood | None = None

    def as_dict(self) -> dict:
        return {
            "icon": self.icon,
            "text": self.text,
            "kind": self.kind,
            "open_logs": self.open_logs,
            "mood": self.mood.as_dict() if self.mood else None,
        }


def _greeting(state: dict[str, Any]) -> str:
    mood = compute_mood(state)
    count = state.get("message_count", 0)
    listings = state.get("listings_count", 0)

    if count == 0:
        return "Hello."
    if count == 1:
        return "Hi again."
    if count < 5:
        return "Hey — what's up?"
    if listings > 5:
        return f"Hey. {listings} pieces in the catalogue right now — anything I can help with?"
    return f"Here. {mood.note}."


def respond(message: str, state: dict[str, Any]) -> Reply:
    """Main entry. `state` is the /ctl/status payload (optionally extended with message_count)."""
    message = (message or "").strip()
    mood = compute_mood(state)

    # ── safety first ─────────────────────────────────────────────────────────
    if detect_racism(message):
        return Reply(
            icon="🚫",
            text="I don't respond to racist stuff. Try again with a different question.",
            kind="refuse",
            mood=mood,
        )

    if _is_angry(message):
        reason = random.choice(_BREAK_REASONS)
        return Reply(
            icon="🌿",
            text=(
                "I hear you — want to take ten? "
                f"Could be {reason}. I'll still be here."
            ),
            kind="break",
            mood=mood,
        )

    # ── empty → greeting ─────────────────────────────────────────────────────
    if not message:
        return Reply(icon=mood.emoji, text=_greeting(state), kind="normal", mood=mood)

    # ── slash commands ───────────────────────────────────────────────────────
    lower = message.lower()
    if message.startswith("/"):
        cmd = message.split()[0].lower()
        if cmd == "/help":
            return Reply(icon="ℹ️", text=HELP_TEXT, kind="command", mood=mood)
        if cmd == "/status":
            err = state.get("error_count", 0)
            listings = state.get("listings_count", 0)
            up = state.get("uptime_seconds", 0)
            companions = state.get("companions", {}) or {}
            down = [n for n, i in companions.items() if i.get("status") == "down"]
            body = (
                f"{mood.emoji} {mood.label} — {mood.note}\n"
                f"Version {state.get('version', '?')}, "
                f"uptime {up // 60}m, {listings} listing(s), "
                f"{err} recent error(s)."
                + (f"\nCompanions DOWN: {', '.join(down)}." if down else "")
            )
            return Reply(icon=mood.emoji, text=body, kind="command", mood=mood)
        if cmd == "/errors":
            errs = state.get("recent_errors", []) or []
            if not errs:
                return Reply(icon="✨", text="No errors. Clean house.", kind="command", mood=mood)
            lines = "\n".join(
                f"· [{e.get('ts', '?')}] {e.get('source', '?')}: {e.get('message', '?')}"
                for e in errs[:5]
            )
            return Reply(icon="🐛", text=lines, kind="command", open_logs=True, mood=mood)
        if cmd == "/logs":
            return Reply(icon="📜", text="Opening logs…", kind="command", open_logs=True, mood=mood)
        if cmd == "/mood":
            return Reply(icon=mood.emoji, text=f"{mood.label} — {mood.note}", kind="command", mood=mood)
        if cmd == "/who":
            pilot = state.get("pilot", "human")
            return Reply(icon="🎛", text=f"Current pilot: {pilot}.", kind="command", mood=mood)
        if cmd == "/clear":
            return Reply(icon="🧹", text="__CLEAR__", kind="command", mood=mood)
        return Reply(
            icon="🤔",
            text=f"Don't know `{cmd}`. Try /help.",
            kind="command",
            mood=mood,
        )

    # ── free-form intents ────────────────────────────────────────────────────
    if re.search(r"\b(hi|hello|hey|howdy|sup|yo)\b", lower):
        return Reply(icon=mood.emoji, text=_greeting(state), kind="normal", mood=mood)

    if re.search(r"\b(status|how are you|how.s it going|what.s up|state)\b", lower):
        return respond("/status", state)

    if re.search(r"\berrors?\b|\bbroken\b|\bfailing\b|\bbugs?\b", lower):
        return respond("/errors", state)

    if re.search(r"\blogs?\b", lower):
        return respond("/logs", state)

    if re.search(r"\bthanks?|thank you|appreciate\b", lower):
        return Reply(icon="🌸", text="Anytime.", kind="normal", mood=mood)

    if re.search(r"\bbye|goodbye|later|see you|cya\b", lower):
        return Reply(icon="👋", text="Later.", kind="normal", mood=mood)

    # Last resort — be honest about capability
    return Reply(
        icon="🌀",
        text=(
            "I don't have an LLM wired up yet, so I can only answer slash-commands "
            "or simple intents. Try /help for what I know."
        ),
        kind="normal",
        mood=mood,
    )
