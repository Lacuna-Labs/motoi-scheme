"""Tests for lacuna.perms — permission matrix."""
from __future__ import annotations

import time
from pathlib import Path
from unittest.mock import patch

import pytest

from lacuna import perms


@pytest.fixture
def isolated_ledger(tmp_path, monkeypatch):
    """Redirect the grants ledger to a temp file for each test."""
    ledger = tmp_path / "grants.jsonl"
    monkeypatch.setattr(perms, "GRANTS_PATH", ledger)
    return ledger


def test_tier_ordering():
    assert perms.Tier.READ_LOCAL < perms.Tier.WRITE_LOCAL
    assert perms.Tier.WRITE_LOCAL < perms.Tier.READ_NET
    assert perms.Tier.READ_NET < perms.Tier.EXEC_USER
    assert perms.Tier.EXEC_USER < perms.Tier.EXEC_ROOT


def test_read_local_always_granted(isolated_ledger):
    g = perms.has_grant(perms.Tier.READ_LOCAL, "anywhere")
    assert g is not None
    assert g.granted_by == "auto"


def test_write_local_default_denied(isolated_ledger):
    assert perms.has_grant(perms.Tier.WRITE_LOCAL, "fs:/test") is None


def test_explicit_grant_appears_in_has_grant(isolated_ledger):
    perms.grant(perms.Tier.WRITE_LOCAL, "fs:/projects/foo", granted_by="test")
    g = perms.has_grant(perms.Tier.WRITE_LOCAL, "fs:/projects/foo")
    assert g is not None
    assert g.tier == perms.Tier.WRITE_LOCAL


def test_subpath_coverage(isolated_ledger):
    perms.grant(perms.Tier.WRITE_LOCAL, "fs:/projects/foo")
    g = perms.has_grant(perms.Tier.WRITE_LOCAL, "fs:/projects/foo/bar/baz")
    assert g is not None


def test_unrelated_scope_not_covered(isolated_ledger):
    perms.grant(perms.Tier.WRITE_LOCAL, "fs:/projects/foo")
    assert perms.has_grant(perms.Tier.WRITE_LOCAL, "fs:/elsewhere") is None


def test_higher_tier_grant_covers_lower_request(isolated_ledger):
    perms.grant(perms.Tier.EXEC_USER, "exec:test")
    # EXEC_USER grant covers a WRITE_LOCAL request on the same scope
    assert perms.has_grant(perms.Tier.WRITE_LOCAL, "exec:test") is not None


def test_lower_tier_grant_does_not_cover_higher_request(isolated_ledger):
    perms.grant(perms.Tier.WRITE_LOCAL, "fs:/test")
    # WRITE_LOCAL does NOT cover EXEC_USER
    assert perms.has_grant(perms.Tier.EXEC_USER, "fs:/test") is None


def test_wildcard_scope_covers_anything(isolated_ledger):
    perms.grant(perms.Tier.READ_NET, "*")
    assert perms.has_grant(perms.Tier.READ_NET, "net:any.example.com") is not None


def test_expired_grant_not_returned(isolated_ledger):
    # Manually create a grant that already expired
    expired = perms.Grant(
        tier=perms.Tier.WRITE_LOCAL,
        scope="fs:/expired",
        granted_at=time.time() - 7200,
        expires_at=time.time() - 3600,
        granted_by="test",
    )
    perms._append_grant(expired)
    assert perms.has_grant(perms.Tier.WRITE_LOCAL, "fs:/expired") is None


def test_permanent_grant_never_expires(isolated_ledger):
    perms._append_grant(perms.Grant(
        tier=perms.Tier.WRITE_LOCAL,
        scope="fs:/permanent",
        granted_at=time.time() - 999999,
        expires_at=-1,  # permanent marker
        granted_by="test",
    ))
    g = perms.has_grant(perms.Tier.WRITE_LOCAL, "fs:/permanent")
    assert g is not None and g.is_live()


def test_refusal_message_hal_register():
    """Per Canon v0.3.13: HAL cadence stays; sign-off does not (avatar
    carries identity in chat surfaces)."""
    msg = perms.refusal_message(perms.Tier.EXEC_ROOT, "exec:rm")
    assert "I'm afraid I can't allow that" in msg
    assert "EXEC_ROOT" in msg
    assert "— Lacuna" not in msg


def test_decorator_with_pre_grant_env(isolated_ledger, monkeypatch):
    monkeypatch.setenv("LACUNA_PRE_GRANT", "EXEC_USER")
    @perms.requires(perms.Tier.EXEC_USER, "exec:test", intent="unit-test")
    def runme():
        return 42
    assert runme() == 42


def test_decorator_denial_raises_permission_error(isolated_ledger, monkeypatch):
    monkeypatch.delenv("LACUNA_PRE_GRANT", raising=False)
    # No TTY → fail closed
    @perms.requires(perms.Tier.EXEC_USER, "exec:test")
    def runme():
        return "should not get here"
    with pytest.raises(PermissionError):
        runme()


def test_revoke_appends_marker(isolated_ledger):
    perms.grant(perms.Tier.WRITE_LOCAL, "fs:/r")
    assert perms.revoke(perms.Tier.WRITE_LOCAL, "fs:/r") is True
    # Note: revoke appends a marker but doesn't filter has_grant — that's a v2
    # cleanup. Live grants list should still show the grant; prune_expired
    # is the way to compact.


def test_list_grants_filters_expired(isolated_ledger):
    perms.grant(perms.Tier.WRITE_LOCAL, "fs:/live")
    perms._append_grant(perms.Grant(
        tier=perms.Tier.WRITE_LOCAL,
        scope="fs:/dead",
        granted_at=time.time() - 7200,
        expires_at=time.time() - 3600,
        granted_by="test",
    ))
    grants = perms.list_grants()
    scopes = {g.scope for g in grants}
    assert "fs:/live" in scopes
    assert "fs:/dead" not in scopes


def test_set_root_mode_flag():
    perms.set_root_mode(False)
    assert perms._ROOT_MODE_ACTIVE is False
    perms.set_root_mode(True)
    assert perms._ROOT_MODE_ACTIVE is True
    perms.set_root_mode(False)  # reset


def test_dynamic_scope_callable(isolated_ledger, monkeypatch):
    monkeypatch.setenv("LACUNA_PRE_GRANT", "WRITE_LOCAL")
    @perms.requires(perms.Tier.WRITE_LOCAL, lambda path: f"fs:{path}")
    def write_to(path: str) -> str:
        return f"wrote {path}"
    assert write_to("/some/path") == "wrote /some/path"
