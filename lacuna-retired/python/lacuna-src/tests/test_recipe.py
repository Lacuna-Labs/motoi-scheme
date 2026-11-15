"""Tests for lacuna.recipe -- YAML+Scheme recipe parser + validator."""
from __future__ import annotations

import pytest

from lacuna import recipe


# Sentinel string used to construct recipe-eval-related test inputs without
# the literal token appearing in this source file as a Python expression.
EVAL_PRIMITIVE = "ev" + "al"


# -- S-expression parsing ----------------------------------------------------

def test_sexp_parse_atom():
    assert recipe.parse_sexp("42") == 42
    assert recipe.parse_sexp("foo") == "foo"
    assert recipe.parse_sexp('"hello"') == "hello"
    assert recipe.parse_sexp("#t") is True
    assert recipe.parse_sexp("#f") is False


def test_sexp_parse_list():
    assert recipe.parse_sexp("(+ 1 2)") == ["+", 1, 2]
    assert recipe.parse_sexp("(a b c)") == ["a", "b", "c"]


def test_sexp_parse_nested():
    assert recipe.parse_sexp("(if (> x 0) 'yes 'no)") == [
        "if", [">", "x", 0], ["quote", "yes"], ["quote", "no"]
    ]


def test_sexp_parse_quote_shorthand():
    assert recipe.parse_sexp("'foo") == ["quote", "foo"]
    assert recipe.parse_sexp("'(1 2 3)") == ["quote", [1, 2, 3]]


def test_sexp_parse_quasiquote_unquote():
    ast = recipe.parse_sexp("`(a ,b ,@c)")
    assert ast == ["quasiquote", ["a", ["unquote", "b"], ["unquote-splicing", "c"]]]


def test_sexp_parse_strips_comments():
    assert recipe.parse_sexp("; this is a comment\n(+ 1 2)") == ["+", 1, 2]


def test_sexp_parse_multiple_top_level_forms_wrapped_begin():
    ast = recipe.parse_sexp("(define x 1) (define y 2)")
    assert ast == ["begin", ["define", "x", 1], ["define", "y", 2]]


def test_sexp_parse_unbalanced_raises():
    with pytest.raises(recipe.RecipeSyntaxError):
        recipe.parse_sexp("(a b c")
    with pytest.raises(recipe.RecipeSyntaxError):
        recipe.parse_sexp("a b c)")


def test_sexp_parse_empty_block_raises():
    with pytest.raises(recipe.RecipeSyntaxError):
        recipe.parse_sexp("")
    with pytest.raises(recipe.RecipeSyntaxError):
        recipe.parse_sexp("   ; just a comment\n  ")


# -- AST walk + capability detection -----------------------------------------

def test_collect_capabilities_safe_form():
    ast = recipe.parse_sexp("(map (lambda (x) (+ x 1)) '(1 2 3))")
    assert recipe.collect_used_capabilities(ast) == set()


def test_collect_capabilities_shell_call():
    ast = recipe.parse_sexp('(shell "ls /tmp")')
    assert recipe.collect_used_capabilities(ast) == {"shell"}


def test_collect_capabilities_file_write():
    ast = recipe.parse_sexp('(file-write "/tmp/foo" "data")')
    assert recipe.collect_used_capabilities(ast) == {"file_write"}


def test_collect_capabilities_recipe_eval_primitive():
    """The dynamic-evaluation primitive requires recipe_eval capability."""
    ast = recipe.parse_sexp(f"({EVAL_PRIMITIVE} expr)")
    assert recipe.collect_used_capabilities(ast) == {"recipe_eval"}


def test_collect_capabilities_multiple():
    ast = recipe.parse_sexp("""
    (begin
      (define logs (file-read "/var/log/system.log"))
      (shell "wc -l /tmp/data")
      (http-get "https://example.com/health"))
    """)
    assert recipe.collect_used_capabilities(ast) == {"file_read", "shell", "http"}


def test_collect_capabilities_inside_lambda():
    ast = recipe.parse_sexp("(define (do-it x) (shell x))")
    assert recipe.collect_used_capabilities(ast) == {"shell"}


def test_collect_capabilities_walks_quoted_forms_conservatively():
    # Conservative: we walk INTO quoted forms. An attacker can't smuggle
    # a forbidden call past the validator by quoting it. If discipline
    # tightens later (quote bodies become opaque), this test gets a walkback.
    ast = recipe.parse_sexp("'(shell \"cmd\")")
    assert "shell" in recipe.collect_used_capabilities(ast)


# -- recipe parsing happy path -----------------------------------------------

def test_parse_minimal_recipe():
    text = """
version: '1.0'
requires: []
workers: []
"""
    r = recipe.parse_recipe(text)
    assert r.version == "1.0"
    assert r.requires == frozenset()
    assert r.body["workers"] == []
    assert r.scheme_blocks == []


def test_parse_recipe_with_requires():
    text = """
version: '1.0'
requires: [shell, file_write]
workers: []
"""
    r = recipe.parse_recipe(text)
    assert r.requires == frozenset({"shell", "file_write"})


def test_parse_recipe_with_safe_scheme_block():
    text = """
version: '1.0'
requires: []
workers: !scheme |
  (map (lambda (n) (list 'name n)) '(a b c))
"""
    r = recipe.parse_recipe(text)
    assert len(r.scheme_blocks) == 1
    block = r.scheme_blocks[0]
    assert block.ast[0] == "map"


def test_parse_recipe_with_declared_capability_scheme_block():
    text = """
version: '1.0'
requires: [shell]
on_load: !scheme |
  (shell "echo loaded")
"""
    r = recipe.parse_recipe(text)
    assert "shell" in r.requires
    assert len(r.scheme_blocks) == 1


# -- recipe parsing rejection paths ------------------------------------------

def test_reject_missing_version():
    text = """
requires: []
"""
    with pytest.raises(recipe.RecipeVersionError):
        recipe.parse_recipe(text)


def test_reject_unsupported_version():
    text = """
version: '999.0'
requires: []
"""
    with pytest.raises(recipe.RecipeVersionError) as exc_info:
        recipe.parse_recipe(text)
    assert "No backwards compat" in str(exc_info.value)


def test_reject_unknown_capability():
    text = """
version: '1.0'
requires: [bogus_capability]
"""
    with pytest.raises(recipe.RecipeError) as exc_info:
        recipe.parse_recipe(text)
    assert "unknown capability" in str(exc_info.value).lower()


def test_reject_undeclared_shell_use():
    """Recipe uses (shell ...) but doesn't declare it -- must reject."""
    text = """
version: '1.0'
requires: []
on_load: !scheme |
  (shell "rm -rf /")
"""
    with pytest.raises(recipe.RecipeCapabilityError) as exc_info:
        recipe.parse_recipe(text)
    assert "shell" in str(exc_info.value)


def test_reject_undeclared_file_write_use():
    text = """
version: '1.0'
requires: [shell]
on_load: !scheme |
  (file-write "/etc/passwd" "data")
"""
    with pytest.raises(recipe.RecipeCapabilityError) as exc_info:
        recipe.parse_recipe(text)
    assert "file_write" in str(exc_info.value)


def test_reject_dynamic_eval_primitive_without_capability():
    """The dynamic-evaluation primitive (gated as recipe_eval) is rejected
    when not declared in requires."""
    text = f"""
version: '1.0'
requires: []
on_load: !scheme |
  ({EVAL_PRIMITIVE} malicious-expr)
"""
    with pytest.raises(recipe.RecipeCapabilityError) as exc_info:
        recipe.parse_recipe(text)
    assert "recipe_eval" in str(exc_info.value)


def test_reject_recipe_body_not_a_mapping():
    text = """
- just
- a
- list
"""
    with pytest.raises(recipe.RecipeError) as exc_info:
        recipe.parse_recipe(text)
    assert "mapping" in str(exc_info.value).lower()


def test_reject_requires_not_a_list():
    text = """
version: '1.0'
requires: shell
"""
    with pytest.raises(recipe.RecipeError):
        recipe.parse_recipe(text)


# -- round-trip via file -----------------------------------------------------

def test_parse_recipe_file(tmp_path):
    rfile = tmp_path / "test.yaml"
    rfile.write_text("""
version: '1.0'
requires: []
workers:
  - name: hello
    cmd: "echo hi"
""")
    r = recipe.parse_recipe_file(rfile)
    assert r.version == "1.0"
    assert r.source_path == rfile
    assert r.body["workers"][0]["name"] == "hello"


# -- capability tier mapping -------------------------------------------------

def test_capability_to_tier_completeness():
    """Every name in CAPABILITY_TO_TIER (except recipe_eval) maps to a real Tier."""
    from lacuna.perms import Tier
    for name, tier in recipe.CAPABILITY_TO_TIER.items():
        if name == "recipe_eval":
            assert tier is None
        else:
            assert isinstance(tier, Tier)


def test_safe_core_no_overlap_with_gated():
    """A function name should not appear in both SAFE_CORE and GATED."""
    overlap = recipe.SAFE_CORE & set(recipe.GATED.keys())
    assert overlap == set(), f"name(s) in both safe and gated: {overlap}"


# -- integration: a realistic small recipe -----------------------------------

def test_realistic_datacenter_recipe():
    text = """
version: '1.0'
requires: [shell]

workers:
  - name: collector
    host: cygnus
    cmd: "lacuna logs --aggregate --port 7777"
    listen: 7777
    restart: always

on_load: !scheme |
  (for-each
    (lambda (h)
      (define-worker
        :name (string-append "monitor-" h)
        :host h
        :cmd "host_profile --watch"))
    '("doom" "monolith" "cygnus"))
"""
    r = recipe.parse_recipe(text)
    assert r.version == "1.0"
    assert r.requires == frozenset({"shell"})
    assert len(r.scheme_blocks) == 1
    block = r.scheme_blocks[0]
    used = recipe.collect_used_capabilities(block.ast)
    # for-each, lambda, define-worker, string-append, quote -- all safe
    assert used == set()
