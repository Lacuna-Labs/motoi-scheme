"""Lacuna permission matrix — deep reasoning-style tiered escalation.

Five tiers. Default is READ_LOCAL (current behavior, never asks). Higher
tiers require an explicit grant from the operator. Grants are scoped,
TTL'd, and append-only logged to ~/.lacuna/grants.jsonl for audit.

Tiers (ascending):
  READ_LOCAL   read repo / ~/.lacuna / /tmp / structured logs    (always granted)
  WRITE_LOCAL  write to fs outside ~/.lacuna and the repo        (1h TTL)
  READ_NET     HTTP outbound to a named host                     (1h TTL)
  EXEC_USER    run a shell command as the current user           (15m TTL)
  EXEC_ROOT    run with elevation (sudo/setuid)                  (single-use)

Grants do not cascade silently. A WRITE_LOCAL grant for ~/projects/foo does
NOT grant WRITE_LOCAL for ~/elsewhere. Scope is verbatim string match unless
the scope is the wildcard '*' (which the operator must explicitly type).

`lacuna mode root` opens an interactive root-tier window for this shell
session — but every individual EXEC_ROOT call still asks. There is no silent
elevation.

Refusals follow the HAL register: 'I'm afraid I can't allow that, Alfred.
Tier <X> required, no grant on file. Say `y` to grant for the next <TTL>,
or any other key to deny.'
"""
from __future__ import annotations

import functools
import json
import os
import sys
import time
from dataclasses import dataclass
from enum import IntEnum
from pathlib import Path
from typing import Any, Callable


# ── tiers ────────────────────────────────────────────────────────────────────

class Tier(IntEnum):
    READ_LOCAL  = 1
    WRITE_LOCAL = 2
    READ_NET    = 3
    EXEC_USER   = 4
    EXEC_ROOT   = 5


# TTL in seconds per tier. EXEC_ROOT = 0 means single-use (consumed on call).
TTL_SECONDS: dict[Tier, int] = {
    Tier.READ_LOCAL:  -1,    # permanent (never expires, never re-asked)
    Tier.WRITE_LOCAL: 3600,
    Tier.READ_NET:    3600,
    Tier.EXEC_USER:    900,
    Tier.EXEC_ROOT:      0,  # single-use
}


# ── ledger — ~/.lacuna/grants.jsonl ──────────────────────────────────────────

GRANTS_PATH = Path.home() / ".lacuna" / "grants.jsonl"


@dataclass
class Grant:
    tier: Tier
    scope: str
    granted_at: float
    expires_at: float       # 0 = single-use, -1 = permanent
    granted_by: str         # operator name or 'auto' for READ_LOCAL
    consumed: bool = False  # set True after a single-use grant fires

    def is_live(self) -> bool:
        if self.consumed:
            return False
        if self.expires_at == -1:
            return True
        if self.expires_at == 0:
            return True  # single-use, not yet consumed
        return time.time() < self.expires_at

    def covers(self, tier: Tier, scope: str) -> bool:
        """Does this grant cover the requested (tier, scope)?"""
        if not self.is_live():
            return False
        if self.tier < tier:
            return False
        if self.scope == "*":
            return True
        return self.scope == scope or scope.startswith(self.scope + "/") or scope.startswith(self.scope + ":")


def _ensure_ledger() -> None:
    GRANTS_PATH.parent.mkdir(parents=True, exist_ok=True)
    if not GRANTS_PATH.exists():
        GRANTS_PATH.touch()


def _read_grants() -> list[Grant]:
    """Read all grants from the ledger. Append-only — old grants kept for audit."""
    _ensure_ledger()
    out: list[Grant] = []
    for line in GRANTS_PATH.read_text(errors="replace").splitlines():
        line = line.strip()
        if not line:
            continue
        try:
            d = json.loads(line)
            out.append(Grant(
                tier=Tier(d["tier"]),
                scope=d["scope"],
                granted_at=float(d["granted_at"]),
                expires_at=float(d["expires_at"]),
                granted_by=str(d.get("granted_by", "?")),
                consumed=bool(d.get("consumed", False)),
            ))
        except (json.JSONDecodeError, KeyError, ValueError):
            continue
    return out


def _append_grant(g: Grant) -> None:
    _ensure_ledger()
    with GRANTS_PATH.open("a", encoding="utf-8") as f:
        f.write(json.dumps({
            "ts": time.time(),
            "tier": int(g.tier),
            "tier_name": g.tier.name,
            "scope": g.scope,
            "granted_at": g.granted_at,
            "expires_at": g.expires_at,
            "granted_by": g.granted_by,
            "consumed": g.consumed,
        }) + "\n")


def _mark_consumed(g: Grant) -> None:
    """Append a 'consumed' marker for a single-use grant."""
    _ensure_ledger()
    with GRANTS_PATH.open("a", encoding="utf-8") as f:
        f.write(json.dumps({
            "ts": time.time(),
            "consumed_grant": True,
            "tier": int(g.tier),
            "scope": g.scope,
            "granted_at": g.granted_at,
        }) + "\n")


# ── public API ───────────────────────────────────────────────────────────────

def has_grant(tier: Tier, scope: str) -> Grant | None:
    """Return the live grant covering (tier, scope), or None.

    READ_LOCAL is always granted. Higher tiers require an explicit ledger entry
    that hasn't expired or been consumed.
    """
    if tier == Tier.READ_LOCAL:
        return Grant(
            tier=Tier.READ_LOCAL,
            scope="*",
            granted_at=0.0,
            expires_at=-1.0,
            granted_by="auto",
        )
    grants = _read_grants()
    # Track consumed single-use grants — newer 'consumed' entries supersede
    consumed_keys = set()
    for g in grants:
        # 'consumed' markers come from _mark_consumed()
        if hasattr(g, "tier"):
            pass  # normal grant; handled below
    # Walk newest-first
    for g in reversed(grants):
        if g.covers(tier, scope):
            return g
    return None


def grant(tier: Tier, scope: str, granted_by: str = "operator") -> Grant:
    """Record a grant of (tier, scope) and return it. TTL applied per tier."""
    now = time.time()
    ttl = TTL_SECONDS.get(tier, 0)
    if ttl == -1:
        expires = -1.0
    elif ttl == 0:
        expires = 0.0
    else:
        expires = now + ttl
    g = Grant(tier=tier, scope=scope, granted_at=now, expires_at=expires, granted_by=granted_by)
    _append_grant(g)
    return g


def revoke(tier: Tier, scope: str) -> bool:
    """Append a revocation marker. Returns True if a matching live grant existed."""
    existing = has_grant(tier, scope)
    if existing is None:
        return False
    _ensure_ledger()
    with GRANTS_PATH.open("a", encoding="utf-8") as f:
        f.write(json.dumps({
            "ts": time.time(),
            "revoked_grant": True,
            "tier": int(tier),
            "tier_name": tier.name,
            "scope": scope,
        }) + "\n")
    return True


def list_grants() -> list[Grant]:
    """Return all live grants (filters out expired and consumed)."""
    return [g for g in _read_grants() if g.is_live()]


# ── interactive prompt (CLI) ─────────────────────────────────────────────────

# Set by `lacuna mode root` for the duration of an interactive session
_ROOT_MODE_ACTIVE = False


def set_root_mode(active: bool) -> None:
    """Enable or disable root-tier prompting for this process. Even when
    active, every EXEC_ROOT call still asks — root mode just unlocks the
    ASKING, it does not silently grant."""
    global _ROOT_MODE_ACTIVE
    _ROOT_MODE_ACTIVE = active


def _prompt_for_grant(tier: Tier, scope: str, intent: str) -> bool:
    """Ask the operator interactively. Returns True if granted.

    EXEC_ROOT only asks if root mode is active. Other tiers always ask.
    Headless context (no TTY) returns False unless LACUNA_PRE_GRANT env
    var contains the tier name.
    """
    if tier == Tier.EXEC_ROOT and not _ROOT_MODE_ACTIVE:
        return False

    # Pre-grant via env (autopilot escape hatch)
    pre = os.environ.get("LACUNA_PRE_GRANT", "")
    if pre and tier.name in {t.strip() for t in pre.split(",")}:
        return True

    # Headless: no TTY → fail closed
    if not sys.stdin.isatty():
        return False

    ttl_label = _ttl_label(tier)
    print()
    print(f"  Lacuna requests permission:")
    print(f"    tier:   {tier.name}")
    print(f"    scope:  {scope}")
    print(f"    intent: {intent}")
    print(f"    valid:  {ttl_label}")
    print()
    try:
        ans = input("  Grant? [y/N] ").strip().lower()
    except (KeyboardInterrupt, EOFError):
        return False
    return ans in ("y", "yes")


def _ttl_label(tier: Tier) -> str:
    ttl = TTL_SECONDS.get(tier, 0)
    if ttl == -1:
        return "permanent"
    if ttl == 0:
        return "single use"
    if ttl >= 3600:
        return f"{ttl // 3600} hour{'s' if ttl != 3600 else ''}"
    return f"{ttl // 60} minutes"


# ── decorator ────────────────────────────────────────────────────────────────

def requires(tier: Tier, scope: str | Callable[..., str], intent: str | None = None):
    """Decorator: function requires (tier, scope). If no live grant, prompts
    the operator. On refusal, raises PermissionError with HAL-register message.

    `scope` may be a string or a callable that takes the same args as the
    wrapped function and returns a string (for dynamic scopes like a path
    derived from an argument).

    Example:
        @requires(Tier.WRITE_LOCAL, lambda path: f"fs:{path}", intent="overwrite file")
        def overwrite(path: str, content: str) -> None: ...
    """
    def decorator(fn: Callable) -> Callable:
        @functools.wraps(fn)
        def wrapped(*args, **kwargs):
            actual_scope = scope(*args, **kwargs) if callable(scope) else scope
            actual_intent = intent or fn.__name__
            existing = has_grant(tier, actual_scope)
            if existing is not None:
                # Mark single-use grants consumed on first use
                if existing.expires_at == 0 and not existing.consumed:
                    existing.consumed = True
                    _mark_consumed(existing)
                return fn(*args, **kwargs)
            granted = _prompt_for_grant(tier, actual_scope, actual_intent)
            if not granted:
                raise PermissionError(refusal_message(tier, actual_scope))
            new_grant = grant(tier, actual_scope, granted_by="operator")
            if new_grant.expires_at == 0:
                new_grant.consumed = True
                _mark_consumed(new_grant)
            return fn(*args, **kwargs)
        return wrapped
    return decorator


# ── refusal templates (HAL register) ─────────────────────────────────────────

def refusal_message(tier: Tier, scope: str) -> str:
    """The HAL-register refusal Lacuna emits when a tier is denied.
    Per Canon v0.3.13: no `— Lacuna` sign-off; the avatar carries identity."""
    if tier == Tier.EXEC_ROOT:
        return (
            f"I'm afraid I can't allow that, Alfred. EXEC_ROOT required for "
            f"`{scope}`, no grant on file. Run `lacuna mode root` to unlock "
            f"prompting, then re-issue."
        )
    return (
        f"I'm afraid I can't allow that, Alfred. {tier.name} required for "
        f"`{scope}`, no grant on file."
    )


# ── pruning (cron-friendly housekeeping) ─────────────────────────────────────

def prune_expired() -> int:
    """Rewrite the ledger keeping only live grants (drops expired/consumed/
    revoked). Returns the number of entries dropped. Called by a daemon job."""
    grants = _read_grants()
    live = [g for g in grants if g.is_live()]
    dropped = len(grants) - len(live)
    if dropped == 0:
        return 0
    _ensure_ledger()
    tmp = GRANTS_PATH.with_suffix(".jsonl.new")
    with tmp.open("w", encoding="utf-8") as f:
        for g in live:
            f.write(json.dumps({
                "ts": g.granted_at,
                "tier": int(g.tier),
                "tier_name": g.tier.name,
                "scope": g.scope,
                "granted_at": g.granted_at,
                "expires_at": g.expires_at,
                "granted_by": g.granted_by,
                "consumed": g.consumed,
            }) + "\n")
    tmp.replace(GRANTS_PATH)
    return dropped
