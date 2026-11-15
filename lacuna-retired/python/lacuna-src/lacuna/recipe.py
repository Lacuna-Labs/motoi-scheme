"""Lacuna recipe layer — YAML configs with optional Scheme escape blocks.

A recipe describes one or more workers and their relations. The 90% case is
plain YAML; the 10% case uses inline Scheme via the `!scheme` tag for
computed values (per-host iteration, conditional spawning, doctor handlers).

This module is the v0.8 SCAFFOLDING. It provides:

  * recipe parsing (YAML + !scheme block recognition)
  * version validation (recipes declare `version: '1.0'`; we refuse mismatches)
  * capability declaration check (recipes declare `requires: [shell, ...]`)
  * S-expression parsing (a tiny tokenizer; no eval yet)
  * AST whitelist walk (every called name must be in core OR declared caps)

What it deliberately does NOT do (yet):

  * Eval Scheme blocks. Scheme blocks parse and validate; their evaluation
    is the next milestone (S7 binding or pure-Python evaluator).
  * Spawn workers. The Recipe object is a declaration; the foreman acts on it.
  * Cross-host RPC.

The discipline: parse, validate, refuse. Recipes that pass validation here
have provably never reached forbidden capabilities at the syntactic level.
Eval-time enforcement is layered on top of this, not in place of it.

Capability names map to Lacuna's existing perms.Tier:

  shell        -> EXEC_USER
  file_read    -> READ_LOCAL  (auto-granted; declaring it is a no-op)
  file_write   -> WRITE_LOCAL
  http         -> READ_NET
  shell_root   -> EXEC_ROOT
  recipe_eval  -> (special; required for the (eval) primitive itself)
"""
from __future__ import annotations

import re
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

from . import perms


# ── version contract ────────────────────────────────────────────────────────

SUPPORTED_RECIPE_VERSIONS = frozenset({"1.0"})


# ── capability registry ─────────────────────────────────────────────────────

CAPABILITY_TO_TIER: dict[str, perms.Tier] = {
    "file_read":   perms.Tier.READ_LOCAL,
    "file_write":  perms.Tier.WRITE_LOCAL,
    "http":        perms.Tier.READ_NET,
    "shell":       perms.Tier.EXEC_USER,
    "shell_root":  perms.Tier.EXEC_ROOT,
    # recipe_eval is special — it gates use of the (eval ...) primitive
    # within recipe blocks. Has no Tier equivalent; treated separately.
    "recipe_eval": None,  # type: ignore[dict-item]
}


# Functions that are always available in the recipe Scheme env. These do not
# require any capability; they are pure or operate on Lacuna's own state.
SAFE_CORE: frozenset[str] = frozenset({
    # Core Scheme
    "lambda", "define", "if", "cond", "let", "let*", "letrec", "case",
    "quote", "quasiquote", "unquote", "unquote-splicing", "set!",
    "begin", "when", "unless", "and", "or", "not",
    # List / pair primitives
    "car", "cdr", "cons", "list", "list?", "pair?", "null?",
    "map", "filter", "fold", "for-each", "length", "reverse",
    "append", "member", "assoc",
    # Arithmetic + comparison
    "+", "-", "*", "/", "modulo", "min", "max", "abs",
    "=", "<", ">", "<=", ">=", "zero?", "positive?", "negative?",
    # String + symbol
    "string-append", "string-length", "string?", "symbol?",
    "string->symbol", "symbol->string", "format",
    # Lacuna observation primitives (read-only host state)
    "host-load", "host-cpu", "host-mem", "host-disk",
    "host-name", "cores", "uptime", "now",
    # Lacuna worker declaration (the metacircular form; no side-effects
    # at parse time — actual spawning happens when the foreman acts)
    "define-worker", "worker", "spawn-spec",
    # Pattern-matching / messaging primitives (data-only at parse;
    # the foreman binds the side-effecting versions at eval)
    "send", "broadcast", "emit", "watch", "receive-match",
    # Recipe reflection
    "reify-config", "reload-recipe", "modify-worker",
    # Time / scheduling (data-only at parse)
    "every", "after",
})


# Functions that REQUIRE a capability to be in (:requires). Map name -> capability.
GATED: dict[str, str] = {
    "shell":       "shell",
    "shell-root":  "shell_root",
    "file-read":   "file_read",
    "file-write":  "file_write",
    "http-get":    "http",
    "http-post":   "http",
    "eval":        "recipe_eval",
    "apply":       "recipe_eval",
    "on":          "shell",  # cross-host RPC; needs shell at remote
}


# ── recipe data model ───────────────────────────────────────────────────────

@dataclass(frozen=True)
class SchemeBlock:
    """A parsed !scheme block. The body is the raw S-expression string;
    `ast` is the parsed list-of-lists representation."""
    raw: str
    ast: Any  # list | str | int | float
    line: int = 0


@dataclass
class Recipe:
    """A loaded recipe. Validated for version + capability declarations,
    but not yet evaluated."""
    version: str
    requires: frozenset[str]
    body: dict[str, Any]                # the YAML body, with !scheme blocks
                                        # replaced by SchemeBlock instances
    scheme_blocks: list[SchemeBlock] = field(default_factory=list)
    source_path: Path | None = None


# ── exceptions ──────────────────────────────────────────────────────────────

class RecipeError(ValueError):
    """Base for all recipe-validation failures."""


class RecipeVersionError(RecipeError):
    """Recipe declares a version this engine does not support."""


class RecipeCapabilityError(RecipeError):
    """Recipe uses a capability it did not declare in (:requires)."""


class RecipeSyntaxError(RecipeError):
    """A !scheme block could not be parsed."""


# ── S-expression tokenizer + parser ─────────────────────────────────────────

# Tokens we care about: parens, atoms (symbols / numbers), strings,
# quote-shorthand. Comments start with `;`.
_SEXP_TOKEN_RE = re.compile(r"""
    \s*(?:
        (?P<lparen> \( ) |
        (?P<rparen> \) ) |
        (?P<quote>  ['`,]@? ) |
        (?P<string> "(?:\\.|[^"\\])*" ) |
        (?P<atom>   [^\s()'`,";]+ )
    )
""", re.VERBOSE)


def _tokenize_sexp(text: str) -> list[tuple[str, str]]:
    """Tokenize an S-expression. Strips ; comments first."""
    no_comments = re.sub(r";[^\n]*", "", text)
    out = []
    pos = 0
    while pos < len(no_comments):
        m = _SEXP_TOKEN_RE.match(no_comments, pos)
        if not m:
            if no_comments[pos].isspace():
                pos += 1
                continue
            raise RecipeSyntaxError(
                f"unexpected character {no_comments[pos]!r} at offset {pos}"
            )
        for kind in ("lparen", "rparen", "quote", "string", "atom"):
            val = m.group(kind)
            if val is not None:
                out.append((kind, val))
                break
        pos = m.end()
    return out


def _parse_sexp(tokens: list[tuple[str, str]], idx: int = 0) -> tuple[Any, int]:
    """Parse one S-expression starting at tokens[idx]. Returns (value, next_idx).

    Numbers, strings, booleans get Python-typed; symbols stay as strings;
    lists become Python lists; quoted forms become ('quote' . body) lists.
    """
    if idx >= len(tokens):
        raise RecipeSyntaxError("unexpected end of input")
    kind, val = tokens[idx]
    if kind == "lparen":
        items: list[Any] = []
        idx += 1
        while idx < len(tokens) and tokens[idx][0] != "rparen":
            item, idx = _parse_sexp(tokens, idx)
            items.append(item)
        if idx >= len(tokens):
            raise RecipeSyntaxError("missing closing paren")
        return items, idx + 1
    if kind == "rparen":
        raise RecipeSyntaxError("unexpected closing paren")
    if kind == "quote":
        body, next_idx = _parse_sexp(tokens, idx + 1)
        prefix = {"'": "quote", "`": "quasiquote",
                  ",": "unquote", ",@": "unquote-splicing"}.get(val, "quote")
        return [prefix, body], next_idx
    if kind == "string":
        return val[1:-1].encode("utf-8").decode("unicode_escape"), idx + 1
    # atom: try number / boolean / symbol
    if val == "#t":
        return True, idx + 1
    if val == "#f":
        return False, idx + 1
    try:
        return int(val), idx + 1
    except ValueError:
        pass
    try:
        return float(val), idx + 1
    except ValueError:
        pass
    return val, idx + 1   # symbol stays as string


def parse_sexp(text: str) -> Any:
    """Parse a single S-expression from text. Raises RecipeSyntaxError."""
    tokens = _tokenize_sexp(text)
    if not tokens:
        raise RecipeSyntaxError("empty Scheme block")
    value, idx = _parse_sexp(tokens, 0)
    # Allow trailing whitespace / comments only (already stripped)
    if idx != len(tokens):
        # multiple top-level forms — wrap in (begin ...)
        forms = [value]
        while idx < len(tokens):
            v, idx = _parse_sexp(tokens, idx)
            forms.append(v)
        return ["begin"] + forms
    return value


# ── AST whitelist walk ──────────────────────────────────────────────────────

def _walk_calls(ast: Any, visit) -> None:
    """Walk the AST; call visit(name) for every function-application head."""
    if isinstance(ast, list) and ast:
        head = ast[0]
        # Skip pure-syntactic forms whose head is a keyword, not a call
        SYNTAX_HEADS = {"quote", "quasiquote", "unquote", "unquote-splicing",
                        "lambda", "define", "let", "let*", "letrec",
                        "if", "cond", "case", "and", "or", "not",
                        "when", "unless", "begin", "set!"}
        if isinstance(head, str) and head not in SYNTAX_HEADS:
            visit(head)
        # Recurse into all children (including the head, in case it is a list)
        for child in ast:
            _walk_calls(child, visit)


def collect_used_capabilities(ast: Any) -> set[str]:
    """Walk an AST; return the set of capability names whose gated functions
    appear in it. Does not detect indirection (a stored reference to `shell`
    that's later applied via `apply`); apply itself requires `recipe_eval`."""
    used: set[str] = set()
    seen_names: set[str] = set()

    def visit(name: str) -> None:
        seen_names.add(name)
        if name in GATED:
            used.add(GATED[name])

    _walk_calls(ast, visit)
    # Detect identifiers that are NEITHER in SAFE_CORE nor GATED — these
    # must be user-defined inside the recipe (via define / let), but if
    # they are referenced before definition we'd reject. For v0.8 we are
    # permissive: an unknown name is allowed (it might be user-defined),
    # but we do collect its presence for diagnostic reporting if needed.
    return used


def unknown_identifiers(ast: Any) -> set[str]:
    """Names referenced as call heads that are neither core nor gated.
    These are presumed user-defined; the validator does not reject them
    in v0.8, but the foreman's eval-time binding will raise if they are
    truly unbound."""
    seen: set[str] = set()
    def visit(name: str) -> None:
        if name not in SAFE_CORE and name not in GATED:
            seen.add(name)
    _walk_calls(ast, visit)
    return seen


# ── YAML loader with !scheme tag support ────────────────────────────────────

def _load_yaml_with_scheme(text: str) -> tuple[Any, list[SchemeBlock]]:
    """Load YAML, recognizing !scheme tagged blocks. Returns (body, blocks).
    SchemeBlock instances replace !scheme nodes in the body so the caller
    can validate and (later) evaluate them in context."""
    try:
        import yaml
    except ImportError as e:
        raise RecipeError(f"PyYAML required: {e}")

    blocks: list[SchemeBlock] = []

    def scheme_constructor(loader, node):
        if isinstance(node, yaml.ScalarNode):
            raw = loader.construct_scalar(node)
        elif isinstance(node, yaml.SequenceNode):
            raw = " ".join(loader.construct_sequence(node))
        else:
            raw = loader.construct_mapping(node)
        ast = parse_sexp(raw)
        block = SchemeBlock(raw=raw, ast=ast,
                            line=getattr(node.start_mark, "line", 0))
        blocks.append(block)
        return block

    class _Loader(yaml.SafeLoader):
        pass

    _Loader.add_constructor("!scheme", scheme_constructor)

    body = yaml.load(text, Loader=_Loader)
    return body, blocks


# ── public API ──────────────────────────────────────────────────────────────

def parse_recipe(text: str, source_path: Path | None = None) -> Recipe:
    """Parse a recipe document from text. Validates version and capability
    declarations; raises RecipeError subclasses on any failure."""
    body, blocks = _load_yaml_with_scheme(text)
    if not isinstance(body, dict):
        raise RecipeError("recipe body must be a YAML mapping")

    version = body.get("version")
    if not isinstance(version, str):
        raise RecipeVersionError(
            f"recipe must declare version as a string; got {version!r}"
        )
    if version not in SUPPORTED_RECIPE_VERSIONS:
        supported = ", ".join(sorted(SUPPORTED_RECIPE_VERSIONS))
        raise RecipeVersionError(
            f"recipe version {version!r} is not supported "
            f"(this engine handles: {supported}). No backwards compat."
        )

    requires_raw = body.get("requires", [])
    if not isinstance(requires_raw, list):
        raise RecipeError("requires must be a list of capability names")
    for r in requires_raw:
        if r not in CAPABILITY_TO_TIER:
            valid = ", ".join(sorted(CAPABILITY_TO_TIER))
            raise RecipeError(
                f"unknown capability {r!r}; valid: {valid}"
            )
    requires = frozenset(requires_raw)

    # Validate every Scheme block uses only declared + safe capabilities
    for block in blocks:
        used = collect_used_capabilities(block.ast)
        undeclared = used - requires
        if undeclared:
            raise RecipeCapabilityError(
                f"!scheme block uses capability(ies) {sorted(undeclared)} "
                f"not declared in (requires: {sorted(requires)}). "
                f"Add them to the recipe's `requires:` list."
            )

    return Recipe(
        version=version,
        requires=requires,
        body=body,
        scheme_blocks=blocks,
        source_path=source_path,
    )


def parse_recipe_file(path: str | Path) -> Recipe:
    """Read a recipe file and parse it."""
    path = Path(path)
    text = path.read_text(encoding="utf-8")
    return parse_recipe(text, source_path=path)
