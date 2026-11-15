"""Team roster loader + anonymous-name generator.

Reads ~/.lacuna/team.yaml (or the bundled default if missing). Roles can
be referenced from playbooks via their `id`. When a role has no real
persona named AND copilot mode is off (see lacuna.yaml), the anonymous
generator picks a near-random name like "engineer-2742" so the slot is
filled but no real identity is impersonated.
"""
from __future__ import annotations

import random
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

from .config import Paths, _HAS_YAML


@dataclass
class Role:
    id:             str
    icon:           str = ""
    register:       str = ""
    real:           list[str] = field(default_factory=list)
    system_prompt:  str = ""


@dataclass
class TeamRoster:
    roles:                   list[Role]
    anonymous_prefixes:      list[str]
    anonymous_suffix_digits: int = 4


def load_roster(yaml_path: Path | None = None) -> TeamRoster:
    """Load team.yaml. Falls back to bundled default on missing/invalid."""
    paths = Paths.init()
    yaml_path = yaml_path or paths.yaml_team

    raw: dict[str, Any] = {}
    if _HAS_YAML and yaml_path.exists():
        import yaml  # type: ignore
        try:
            with yaml_path.open("r", encoding="utf-8") as fh:
                raw = yaml.safe_load(fh) or {}
        except Exception:
            raw = {}

    if not raw:
        # Read bundled default
        default = Path(__file__).resolve().parent / "config_defaults" / "team.yaml"
        if _HAS_YAML and default.exists():
            import yaml  # type: ignore
            with default.open("r", encoding="utf-8") as fh:
                raw = yaml.safe_load(fh) or {}

    roles_raw = raw.get("roles", []) or []
    # Bundled persona files live next to the YAML defaults (config_defaults/).
    # User-edited team.yaml in ~/.lacuna/ resolves system_prompt_file relative
    # to that ~/.lacuna directory; the bundled default resolves relative to
    # config_defaults/. Either way, the file path is just relative.
    yaml_dir = yaml_path.parent if yaml_path else (
        Path(__file__).resolve().parent / "config_defaults"
    )
    pkg_root = Path(__file__).resolve().parent

    def _load_prompt(spec: dict) -> str:
        # Inline prompt wins when both are set.
        inline = spec.get("system_prompt", "") or ""
        if inline:
            return inline
        rel = spec.get("system_prompt_file", "")
        if not rel:
            return ""
        # Try the YAML's own dir first, then the package root (so bundled
        # defaults under personas/ resolve cleanly).
        for base in (yaml_dir, pkg_root):
            candidate = base / rel
            if candidate.exists():
                try:
                    return candidate.read_text(encoding="utf-8")
                except OSError:
                    pass
        return ""

    roles = [
        Role(
            id=r.get("id", ""),
            icon=r.get("icon", ""),
            register=r.get("register", ""),
            real=list(r.get("real", []) or []),
            system_prompt=_load_prompt(r),
        )
        for r in roles_raw
        if r.get("id")
    ]

    pool = raw.get("anonymous_name_pool", {}) or {}
    return TeamRoster(
        roles=roles,
        anonymous_prefixes=list(pool.get("prefix", []) or []),
        anonymous_suffix_digits=int(pool.get("suffix_digits", 4)),
    )


def anonymous_name(role_id: str, *, roster: TeamRoster | None = None,
                   seed: int | None = None) -> str:
    """Generate a near-random anonymous identity for a role.

    Uses the role_id as the prefix when it's in the anonymous_name_pool;
    otherwise picks a random pool prefix. Suffix is N digits per the
    pool config (default 4 → 0000-9999 = ~10k unique identities).

    Deterministic when `seed` is set (paired with role_id) — same
    `(role_id, seed)` always produces the same name. Pass seed=None for
    fresh names per session.

    Examples:
        anonymous_name("engineering")  → "eng-2742" (random)
        anonymous_name("engineering", seed=42) → "eng-1583" (deterministic)
        anonymous_name("clay-pigeon")  → "smith-9012" (unknown role_id falls back)
    """
    if roster is None:
        roster = load_roster()
    rng = random.Random(seed if seed is None else hash((role_id, seed)))

    # Match by prefix similarity: "engineering" → "eng" if "eng" is in pool
    candidates = [p for p in roster.anonymous_prefixes
                  if role_id.startswith(p) or p in role_id.lower()]
    if candidates:
        prefix = candidates[0]
    elif roster.anonymous_prefixes:
        prefix = rng.choice(roster.anonymous_prefixes)
    else:
        prefix = "agent"

    digits = roster.anonymous_suffix_digits
    n = rng.randint(0, 10 ** digits - 1)
    return f"{prefix}-{n:0{digits}d}"


def _bundled_persona_prompt(role_id: str) -> str | None:
    """Read a bundled persona file under config_defaults/personas/<role_id>.md.

    Used to guarantee the architect persona always loads its full prompt,
    even when the user's ~/.lacuna/team.yaml is stale from an earlier
    `lacuna config init` (the YAML there may have an inline placeholder
    prompt). The bundled file is the contract; team.yaml just names who
    holds the seat.
    """
    candidates = [
        Path(__file__).resolve().parent / "personas" / f"{role_id}.md",
        Path(__file__).resolve().parent / "config_defaults" / "personas" / f"{role_id}.md",
    ]
    for p in candidates:
        if p.exists():
            try:
                return p.read_text(encoding="utf-8")
            except OSError:
                continue
    return None


# Roles whose prompt is OPERATOR-VOICE — sealed, always loaded from the bundled
# persona file regardless of what team.yaml says. Architect is the only one for now.
_SEALED_ROLES = {"architect"}


def fill_role(role_id: str, *, roster: TeamRoster | None = None,
              copilot_enabled: bool = False, anonymous_enabled: bool = True,
              seed: int | None = None) -> tuple[str, str]:
    """Pick an identity + system prompt for the given role.

    Resolution:
        1. role.real[0] if present (named persona — Alfred, etc.)
        2. anonymous_name(role_id) when anonymous_enabled and not copilot
        3. role_id itself (fallback) when neither applies

    For SEALED roles (architect): the system_prompt is always the bundled
    persona file. team.yaml names the seat-holder; the prompt is the contract.

    Returns (display_name, system_prompt).
    """
    roster = roster or load_roster()
    role = next((r for r in roster.roles if r.id == role_id), None)

    # Sealed-role prompt resolution — always the bundled file, even if YAML drifted.
    if role_id in _SEALED_ROLES:
        sealed = _bundled_persona_prompt(role_id)
        if sealed:
            display = (role.real[0] if role and role.real else role_id)
            return (display, sealed)

    if not role:
        return (role_id, "")
    if role.real:
        return (role.real[0], role.system_prompt)
    if anonymous_enabled and not copilot_enabled:
        return (anonymous_name(role_id, roster=roster, seed=seed),
                role.system_prompt)
    return (role_id, role.system_prompt)
