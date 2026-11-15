"""The Claude chat's desk context (lacuna_api/control/claude_chat.py): it carries the first-person rule (video B12).

spec: VIDEO-PASS-2026-10-31 B12 ("first person only with a ticket: 'the record says …', with its age") · class: L4 a claim in
`said` · technique: the context built with every live read stubbed out · method: desk_context() with the foreman, the petitions
and the alerts replaced by stubs, so nothing reaches a live daemon · sre: can the desk's Claude chat say it did work another
session did?
"""
from lacuna_api.control import claude_chat, chat, foreman, workers


def test_the_context_says_other_sessions_work_is_said_as_the_record_says_it(monkeypatch):
    monkeypatch.setattr(chat, "petitions", lambda: [])
    monkeypatch.setattr(workers, "alerts", lambda n: [])

    def no_foreman(*a, **k):
        raise OSError("no live foreman in a test")

    monkeypatch.setattr(foreman, "call", no_foreman)
    ctx = claude_chat.desk_context(None)
    assert claude_chat.RECORD_RULE in ctx
    assert "the record says" in ctx and "Say \"I\" only for what this session did" in ctx
