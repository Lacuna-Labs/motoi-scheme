"""brief.py: the time a question names, and a cart named loose enough to fit several."""
import time

from lacuna_api.control import brief


def test_when_reads_the_days_a_question_names():
    now = time.mktime((2026, 10, 19, 20, 0, 0, 0, 0, -1))
    a, b, w = brief.when("what did we do yesterday?", now)
    assert time.localtime(a).tm_mday == 18 and b - a == 86400
    a, _, _ = brief.when("what happened on the 18th", now)
    assert time.localtime(a).tm_mday == 18
    a, _, _ = brief.when("the oct 17 release", now)
    assert time.localtime(a).tm_mon == 10 and time.localtime(a).tm_mday == 17
    a, _, _ = brief.when("3 days ago", now)
    assert time.localtime(a).tm_mday == 16
    assert brief.when("fix the cart", now) is None


def test_a_loose_cart_name_lists_the_candidates(tmp_path, monkeypatch):
    for n in ("pickup-ready-notify", "preorder-shipped-notify", "listing-alt-text"):
        (tmp_path / "carts" / "automations" / n).mkdir(parents=True)
    monkeypatch.setattr(brief, "CURATOR", tmp_path)
    assert sorted(brief._carts_like("fix the notify cart")) == ["pickup-ready-notify", "preorder-shipped-notify"]
    assert brief._carts_like("fix the alt text cart") == ["listing-alt-text"]
    assert brief._carts_like("notify me") == []


SRE_CASES = [  # the same table as lacuna-node/test/brief-sre.test.mjs (the two doors' KINDS are one table)
    ("the disk is almost full", "lacuna/DISK"), ("the release has been stuck for an hour", "lacuna/RELEASE-STUCK"),
    ("roll back the last deploy", "lacuna/ROLLBACK"), ("errors are spiking in the logs", "lacuna/ERROR-SPIKE"),
    ("a watchdog went red", "lacuna/WATCHDOG-RED"), ("QA is down", "lacuna/QA-DOWN"),
    ("ship a hotfix for the login page", "lacuna/HOTFIX"), ("fix the bug in the parser", "lacuna/CODE-SHIP"),
    ("the card is stuck and will not move", "lacuna/STUCK-CARD"),
    ("the agent keeps doing the same thing over and over", "lacuna/STUCK-AND-LOOPING"),
    ("the cart fails its strict check", "lacuna/CART-REPAIR"), ("release the desk build to QA", "lacuna/RELEASE"),
    ("the promote step failed", "lacuna/PROMOTE-FAILED"), ("jobs are piling up in the queue", "lacuna/JOB-QUEUE"),
    ("git says there is a merge conflict", "lacuna/MERGE-CONFLICT"),
]


def test_each_sre_problem_brings_its_playbook_first():
    """INTEGRATION-NIGHT-2026-10-27 step 7: the owner's words pick the playbook that fixes it, specific before general."""
    for text, want in SRE_CASES:
        first = next((srcs[0] for rx, srcs in brief.KINDS if rx.search(text)), None)
        assert first == want, text
    for text in ("hey, how are you?", "tell me a joke about cats", "what a full day"):
        assert not any(rx.search(text) and srcs[0].startswith("lacuna/") and srcs[0] not in ("lacuna/AGENTS", "lacuna/ORIENTATION") for rx, srcs in brief.KINDS[:19]), text


def test_work_break_chat_follow_the_words_and_keep_the_last_mode():
    """Ruling 4 (the same cases as lacuna-node/test/brief-sre.test.mjs)."""
    assert brief.work_mode_of("/break") == "break" and brief.work_mode_of("/work please") == "work"
    assert brief.work_mode_of("the disk is almost full") == "work"
    assert brief.work_mode_of("why is the foreman failing?") == "work"
    assert brief.work_mode_of("let's take a break") == "break"
    assert brief.work_mode_of("hey there", "work") == "chat"
    assert brief.work_mode_of("and the other one?", "work") == "work"
    assert brief.work_mode_of("and the other one?", "chat") == "chat"
    assert set(brief.MODE_LINES) == {"work", "break", "chat"}
