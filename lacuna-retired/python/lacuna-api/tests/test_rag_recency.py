"""M3: recall scores recency (half-life 7 days) and puts the named day's talk first (M0's frozen asks #11 and #19)."""
import time

from lacuna_api.control import rag

NOW = time.mktime(time.strptime("2026-10-25 12:00", "%Y-%m-%d %H:%M"))


def test_asked_day_reads_today_yesterday_and_dates():
    assert rag.asked_day("what did I ask you yesterday?", NOW) == "2026-10-24"
    assert rag.asked_day("what happened last night", NOW) == "2026-10-24"
    assert rag.asked_day("what did we decide today", NOW) == "2026-10-25"
    assert rag.asked_day("what about 2026-10-19?", NOW) == "2026-10-19"
    assert rag.asked_day("how does the kick rule work?", NOW) is None


def test_recency_halves_every_seven_days_and_is_zero_when_unknown():
    today = {"src": "conversation", "loc": "2026-10-25", "text": "x"}
    week = {"src": "conversation", "loc": "2026-10-18", "text": "x"}
    assert abs(rag.recency(today, NOW) - rag.RECENCY_W) < 0.005
    assert abs(rag.recency(week, NOW) - rag.RECENCY_W / 2) < 0.005
    assert rag.recency({"src": "lacuna/NOPE", "loc": "NOPE.md:1", "text": "x"}, NOW) == 0.0


def test_the_last_day_reads_as_today():
    assert rag.asked_day("what failed in the last day?", NOW) == "2026-10-25"
