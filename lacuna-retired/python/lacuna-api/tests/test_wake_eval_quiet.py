"""P4 (2026-10-25): an eval run never wakes the desk; order §1.13a (2026-11-06): no event speaks as a turn at all."""
from lacuna_api.control import wake


def test_an_eval_run_is_never_worth_a_wake_even_when_it_failed():
    assert wake.worth({"id": "run:desk:eval:soak:1792919995360", "what": "desk turn"}, "failed exit 30", 60) is False
    assert wake.worth({"id": "w-77", "name": "forge job", "what": "forge run"}, "failed exit 30", 60) is True


def test_no_road_to_a_system_turn_is_left():
    """A finished job, the owner's press and a landed plan are chips (wake._chip, chat._after_press, plans._land); the
    `[foreman:press]` and `[foreman:plan]` turns reached the owner's conversation log. Failure class: a wrong road."""
    import inspect
    from lacuna_api.control import chat, plans, wake
    assert not hasattr(chat, "system_turn")
    for fn in (chat._after_press, plans._land, wake.settle, wake.post):
        src = inspect.getsource(fn)
        assert "ask(" not in src and "system_turn" not in src, fn.__name__
