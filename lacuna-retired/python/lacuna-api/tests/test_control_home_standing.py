"""THE STANDING ORDER NAMES ONLY CARDS THAT STAND (lane L1; MAIL C10, C11; CARDS-2.0 R12): Release and CI/CD folded into
Build, Watchdogs into Telemetry; home.STANDING keeps none of the folded ids, and keeps the card each folded into."""
from __future__ import annotations


def test_standing_keeps_no_folded_card(lacuna_home):
    from lacuna_api.control import home
    assert not {"s-release", "s-cicd", "s-watchdogs", "s-terminal"} & set(home.STANDING)
    assert {"s-build", "s-telemetry"} <= set(home.STANDING)
    assert len(home.STANDING) == len(set(home.STANDING))
