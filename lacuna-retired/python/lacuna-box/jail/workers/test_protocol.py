"""The protocol round-trips, both ways, and refuses what is neither (python3 -m pytest workers/test_protocol.py)."""
import json
import os
import sys

import pytest

sys.path.insert(0, os.path.dirname(__file__))
import protocol as p  # noqa: E402

BRIEF = {"kind": "brief", "id": "b-3f2a", "from": "lacuna", "to": "repair-1", "card": "fix-x",
         "job": {"class": "repair", "brief": "Fix the cart \"X\".", "constraints": {"max_wall_sec": 900, "read_only": False,
                 "hosts": ["a.com", "b.org"]}}}
REPORT = {"kind": "report", "id": "r-1", "worker": "repair-1", "brief_id": "b-3f2a", "class": "repair",
          "verdict": {"before": "strict:no-table", "after": "strict:works"}, "confidence": 0.8, "outputs": [],
          "anti_taxonomy": ["did not touch dev"]}


@pytest.mark.parametrize("msg", [BRIEF, REPORT])
def test_slat_round_trips(msg):
    assert p.parse(p.dumps_slat(msg)) == msg


@pytest.mark.parametrize("msg", [BRIEF, REPORT])
def test_json_round_trips(msg):
    assert p.parse(json.dumps(msg)) == msg


def test_the_forge_plans_slat_brief_reads():
    m = p.parse('(brief :id "b-3f2a" :from lacuna :to worker-1 :job (:class research :brief "Read it." '
                ':constraints (:read-only #t :max-writes 1 :max-wall-sec 1800)))')
    assert m["job"]["constraints"] == {"read_only": True, "max_writes": 1, "max_wall_sec": 1800}
    assert m["from"] == "lacuna" and m["to"] == "worker-1"


def test_what_is_neither_is_refused():
    with pytest.raises(p.ProtocolError):
        p.parse("brief: fix it")
    with pytest.raises(p.ProtocolError):
        p.parse('(brief :id "x")')          # a brief needs to and job
    with pytest.raises(p.ProtocolError):
        p.parse('(brief :id "x" :to w :job (:class repair)')   # never closed


def test_words_beyond_ascii_survive():
    m = {"kind": "progress", "id": "p-1", "worker": "w", "words": "the cart — fixed · 二"}
    assert p.parse(p.dumps_slat(m)) == m
