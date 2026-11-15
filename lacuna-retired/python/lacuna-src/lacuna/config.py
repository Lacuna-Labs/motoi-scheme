"""Config + state-directory layout for Lacuna.

Two layers, both rooted at ~/.lacuna/:

1. **Paths** — directories Lacuna writes to (logs, trash, cron, projects DB).
   Stable since v1; `Paths.init()` is idempotent.

2. **YAML config (v2.2.6+)** — declarative configuration loaded from
   ~/.lacuna/lacuna.yaml + ~/.lacuna/team.yaml + ~/.lacuna/playbooks/*.yaml.
   Defaults ship in lacuna-src/lacuna/config_defaults/. `lacuna config init`
   copies them to ~/.lacuna/. The YAML format is the contract; Python is
   the runtime. New orchestration tasks ship as new YAML, not new code.

Why YAML (not TOML, not JSON):
- TOML was the v1 choice. Turned out we need block scalars (multi-line
  prompts), nested arrays of objects, and human-comfortable comments —
  all friendlier in YAML.
- JSON's unfriendly to hand-edit; we want operators editing this.
- pyyaml ships the safe loader; that's what we use.

Precedence rules (env > YAML > hardcoded):
- LACUNA_LLM_BACKEND in env overrides backends.precedence in YAML.
- LACUNA_LOCAL_MODEL overrides ollama.models.chat.
- If ~/.lacuna/lacuna.yaml is missing, hardcoded defaults apply
  (precedence = local → deepseek → anthropic → openai → echo).
"""
from __future__ import annotations

import os
import shutil
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any


STATE_DIR_NAME = ".lacuna"


# ── Paths (stable v1 layout, widened with YAML config files) ─────────────────

@dataclass(frozen=True)
class Paths:
    root:           Path
    config:         Path           # legacy TOML — read-only fallback
    yaml_main:      Path           # ~/.lacuna/lacuna.yaml
    yaml_team:      Path           # ~/.lacuna/team.yaml
    playbooks_dir:  Path           # ~/.lacuna/playbooks/
    db:             Path
    logs_dir:       Path
    log_file:       Path
    trash_dir:      Path
    cron_dir:       Path
    projects_file:  Path
    rag_db:         Path

    @classmethod
    def init(cls) -> "Paths":
        home = Path.home()
        root = home / STATE_DIR_NAME
        paths = cls(
            root=root,
            config=root / "config.toml",
            yaml_main=root / "lacuna.yaml",
            yaml_team=root / "team.yaml",
            playbooks_dir=root / "playbooks",
            db=root / "projects.db",
            logs_dir=root / "logs",
            log_file=root / "logs" / "lacuna.log",
            trash_dir=root / "trash",
            cron_dir=root / "cron",
            projects_file=root / "projects.json",
            rag_db=root / "rag.db",
        )
        for d in (root, paths.logs_dir, paths.trash_dir, paths.cron_dir, paths.playbooks_dir):
            d.mkdir(parents=True, exist_ok=True)
        return paths


# ── YAML config (v2.2.6+) ────────────────────────────────────────────────────

_HAS_YAML = False
try:
    import yaml  # type: ignore
    _HAS_YAML = True
except ImportError:
    pass


@dataclass
class OllamaConfig:
    enabled: bool = True
    url: str = "http://localhost:11434"
    models: dict[str, str] = field(default_factory=lambda: {
        "chat":  "qwen2.5:3b-instruct",
        "embed": "nomic-embed-text",
    })
    auto_pull_on_install: bool = True


@dataclass
class BackendsConfig:
    precedence: list[str] = field(default_factory=lambda: [
        "local", "deepseek", "anthropic", "openai", "echo",
    ])


@dataclass
class CopilotConfig:
    """Copilot mode: a more-capable LLM steers Lacuna.

    When enabled, Lacuna's own role becomes the executor — translating
    copilot instructions into shell commands, file edits, and API calls.
    When disabled, Lacuna spawns its own anonymous team (see TeamConfig).
    """
    enabled: bool = False
    provider: str | None = None        # "claude" | "openai" | null
    endpoint: str | None = None        # for self-hosted bridges


@dataclass
class TeamConfig:
    """Persona roster source + anonymous-team behavior."""
    roster_file: str = "team.yaml"
    anonymous_enabled: bool = True
    anonymous_name_seed: int | None = None


@dataclass
class PlaybooksConfig:
    dir: str = "playbooks"
    allowlist: list[str] = field(default_factory=list)


@dataclass
class LacunaConfig:
    version:    int = 1
    ollama:     OllamaConfig    = field(default_factory=OllamaConfig)
    backends:   BackendsConfig  = field(default_factory=BackendsConfig)
    copilot:    CopilotConfig   = field(default_factory=CopilotConfig)
    team:       TeamConfig      = field(default_factory=TeamConfig)
    playbooks:  PlaybooksConfig = field(default_factory=PlaybooksConfig)


def _from_dict(cls, data: dict[str, Any]):
    """Shallow dict → dataclass.  Tolerates missing keys; drops unknown ones."""
    if not data:
        return cls()
    fields = {f.name for f in cls.__dataclass_fields__.values()}
    kwargs = {k: v for k, v in data.items() if k in fields}
    return cls(**kwargs)


def load_config(yaml_path: Path | None = None) -> LacunaConfig:
    """Load ~/.lacuna/lacuna.yaml. Returns defaults on missing/invalid YAML.

    Env-var overrides (applied last):
      LACUNA_LLM_BACKEND  — single forced backend (overrides precedence)
      LACUNA_LOCAL_URL    — overrides ollama.url
      LACUNA_LOCAL_MODEL  — overrides ollama.models.chat
    """
    paths = Paths.init()
    yaml_path = yaml_path or paths.yaml_main
    cfg = LacunaConfig()

    if _HAS_YAML and yaml_path.exists():
        try:
            with yaml_path.open("r", encoding="utf-8") as fh:
                raw = yaml.safe_load(fh) or {}
        except Exception:
            return cfg  # malformed YAML → defaults; lacuna config validate surfaces it
        # Reconstruct nested dataclasses
        cfg = LacunaConfig(
            version=raw.get("version", 1),
            ollama=_from_dict(OllamaConfig, raw.get("ollama", {})),
            backends=_from_dict(BackendsConfig, raw.get("backends", {})),
            copilot=_from_dict(CopilotConfig, raw.get("copilot", {})),
            team=_from_dict(TeamConfig, raw.get("team", {})),
            playbooks=_from_dict(PlaybooksConfig, raw.get("playbooks", {})),
        )

    # Env overrides
    forced = os.environ.get("LACUNA_LLM_BACKEND", "").strip()
    if forced:
        # Place forced first; keep the rest as fallback
        rest = [b for b in cfg.backends.precedence if b != forced]
        cfg.backends.precedence = [forced] + rest
    if os.environ.get("LACUNA_LOCAL_URL"):
        cfg.ollama.url = os.environ["LACUNA_LOCAL_URL"]
    if os.environ.get("LACUNA_LOCAL_MODEL"):
        cfg.ollama.models["chat"] = os.environ["LACUNA_LOCAL_MODEL"]

    return cfg


def write_default_configs(force: bool = False) -> dict[str, Path]:
    """Copy bundled defaults to ~/.lacuna/. Used by `lacuna config init`.

    Returns: {file_logical_name: written_path} for the files actually
    written (skipped existing files unless `force=True`).
    """
    paths = Paths.init()
    defaults_dir = Path(__file__).resolve().parent / "config_defaults"
    written: dict[str, Path] = {}

    for src_name, dst in [
        ("lacuna.yaml", paths.yaml_main),
        ("team.yaml",   paths.yaml_team),
    ]:
        src = defaults_dir / src_name
        if not src.exists():
            continue
        if dst.exists() and not force:
            continue
        shutil.copy2(src, dst)
        written[src_name] = dst

    # Playbook defaults — copy each into ~/.lacuna/playbooks/
    pb_src = defaults_dir / "playbooks"
    if pb_src.exists():
        for src in pb_src.glob("*.yaml"):
            dst = paths.playbooks_dir / src.name
            if dst.exists() and not force:
                continue
            shutil.copy2(src, dst)
            written[f"playbooks/{src.name}"] = dst

    return written


def validate_config(yaml_path: Path | None = None) -> list[str]:
    """Return a list of validation error strings (empty on success)."""
    if not _HAS_YAML:
        return ["pyyaml not installed; install with: pip install pyyaml"]
    paths = Paths.init()
    yaml_path = yaml_path or paths.yaml_main
    if not yaml_path.exists():
        return [f"no config at {yaml_path} — run `lacuna config init`"]
    errors: list[str] = []
    try:
        with yaml_path.open("r", encoding="utf-8") as fh:
            raw = yaml.safe_load(fh) or {}
    except yaml.YAMLError as e:
        return [f"YAML parse error in {yaml_path}: {e}"]

    if not isinstance(raw, dict):
        return [f"top-level YAML must be a mapping, got {type(raw).__name__}"]

    # Cross-check known keys
    known_top = {"version", "ollama", "backends", "copilot", "team", "playbooks"}
    for k in raw:
        if k not in known_top:
            errors.append(f"unknown top-level key: {k}")

    # backends.precedence sanity
    precedence = raw.get("backends", {}).get("precedence", [])
    valid_backends = {"local", "deepseek", "anthropic", "openai", "echo"}
    for b in precedence:
        if b not in valid_backends:
            errors.append(f"backends.precedence: unknown backend '{b}' (valid: {sorted(valid_backends)})")

    # ollama.url shape
    url = raw.get("ollama", {}).get("url", "")
    if url and not (url.startswith("http://") or url.startswith("https://")):
        errors.append(f"ollama.url must start with http:// or https://, got {url!r}")

    return errors
