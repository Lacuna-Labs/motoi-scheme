"""The cascade from Lacuna's side (LACUNA-1.3-DESIGN §40, B50): the mind door lets the 26B in only as a cascade's last
rung and only in the background lane, passes the gateway's certainty (missing = unknown), reads the box in shadow mode;
the records the foreman sends up are kept under the cascade folder, and `lacuna cascade report` reads them."""
from __future__ import annotations

import io
import json

import pytest

from lacuna_api.control import cascade, foreman


class _Resp(io.BytesIO):
    def __enter__(self):
        return self

    def __exit__(self, *a):
        return False


@pytest.fixture
def gateway(monkeypatch):
    """The gateway, faked: it records each request and answers with what the test sets."""
    seen: list[dict] = []
    answer: dict = {"message": {"content": "(label 'noise)"}}

    def urlopen(req, timeout=None):
        seen.append({"url": req.full_url, "body": json.loads(req.data), "lane": req.get_header("X-lacuna-lane"), "timeout": timeout})
        return _Resp(json.dumps(answer).encode())
    monkeypatch.setattr(foreman.urllib.request, "urlopen", urlopen)
    return seen, answer


def test_the_26b_is_a_mind_only_as_a_cascades_last_rung_and_always_in_the_background(gateway):
    seen, _ = gateway
    assert foreman.last_rung() == "lacuna-worker-lite"
    refused = foreman.mind({"model": "lacuna-worker-lite", "prompt": "p"})
    assert refused["ok"] is False and "not a mind this box lets an agent have" in refused["why"]
    assert foreman.mind({"model": "gemma4:e4b", "cascade": True, "prompt": "p"})["ok"] is False    # reserved, even as a rung
    assert not seen
    r = foreman.mind({"model": "lacuna-worker-lite", "cascade": True, "last": True, "grammar": "root ::= x", "prompt": "p"})
    assert r["ok"] and r["text"] == "(label 'noise)"
    assert seen[-1]["lane"] == "background" and seen[-1]["timeout"] > 50
    assert seen[-1]["body"]["model"] == "lacuna-worker-lite:latest" and seen[-1]["body"]["grammar"] == "root ::= x"
    small = foreman.mind({"model": "functiongemma", "cascade": True, "prompt": "p"})
    assert small["ok"] and seen[-1]["lane"] == "background" and seen[-1]["timeout"] == 50


def test_certainty_passes_through_and_missing_is_unknown(gateway, monkeypatch):
    _, answer = gateway
    assert foreman.mind({"model": "functiongemma", "prompt": "p"})["certainty"] is None
    answer["certainty"] = 0.83
    assert foreman.mind({"model": "functiongemma", "prompt": "p"})["certainty"] == 0.83
    answer.pop("certainty")
    answer["message"]["certainty"] = 0.4
    assert foreman.mind({"model": "functiongemma", "prompt": "p"})["certainty"] == 0.4
    answer["message"]["certainty"] = "sure"                       # not a probability: unknown, never a guess
    assert foreman.mind({"model": "functiongemma", "prompt": "p"})["certainty"] is None
    # shadow: the box's reading at that step comes back with the answer
    monkeypatch.setattr(cascade, "box_now", lambda: {"available_gb": 5.0, "swap_used_mb": 12.0, "load1": 1.0, "person_slot_free": True})
    r = foreman.mind({"model": "functiongemma", "prompt": "p", "shadow": True})
    assert r["box"]["swap_used_mb"] == 12.0
    assert "box" not in foreman.mind({"model": "functiongemma", "prompt": "p"})


def test_records_are_kept_where_the_report_reads_them(tmp_path):
    assert cascade.keep("nonsense", {})["ok"] is False
    esc = {"job": "label", "class": "signal->label", "input": {"line": "Traceback (most recent call last):"},
           "rungs": [{"rung": 0, "model": "functiongemma", "answer": "(label 'noise)", "certainty": 0.9, "ms": 400,
                      "climbed": "a traceback is never noise (said noise)"}],
           "accepted_by": "lacuna-worker-lite", "accepted": "(label 'real-error)", "candidate_pair": True}
    assert cascade.keep("escalation", esc)["ok"]
    rows = [("functiongemma", True, 0.95), ("functiongemma", True, 0.9), ("functiongemma", False, 0.5), ("functiongemma", True, 0.7),
            ("gemma3:270m", False, 0.9), ("gemma3:270m", False, 0.8)]
    for m, right, c in rows:
        cascade.keep("shadow", {"job": "label", "class": "signal->label", "model": m, "truth": False, "right": right, "certainty": c,
                                "ms": 300, "box": {"available_gb": 4.5, "swap_used_mb": 800}})
    cascade.keep("shadow", {"job": "label", "class": "signal->label", "model": "lacuna-worker-lite", "truth": True, "right": True,
                            "certainty": 0.99, "ms": 4000, "box": {"available_gb": 3.9, "swap_used_mb": 950}})
    lines = (tmp_path / "world" / "cascade" / "escalations.jsonl").read_text().splitlines()   # the tests' own folder
    assert json.loads(lines[0])["candidate_pair"] is True
    shadow = (tmp_path / "world" / "cascade" / "shadow.jsonl").read_text().splitlines()
    assert len(shadow) == 7 and json.loads(shadow[-1])["truth"] is True     # the report is the door's (cascade-report.mjs)


def test_the_cascade_door_takes_records_only_with_the_foremans_token(app_client, monkeypatch, tmp_path):
    from lacuna_api.control import foreman as f
    monkeypatch.setattr(f, "_token", lambda: "tok")
    rec = {"kind": "escalation", "record": {"job": "label", "accepted_by": "functiongemma"}}
    assert app_client.post("/api/foreman/cascade", json=rec).status_code == 401
    assert app_client.post("/api/foreman/cascade", json=rec, headers={"X-Foreman-Token": "nope"}).status_code == 401
    assert app_client.post("/api/foreman/cascade", json={"kind": "x", "record": {}}, headers={"X-Foreman-Token": "tok"}).status_code == 422
    assert app_client.post("/api/foreman/cascade", json=rec, headers={"X-Foreman-Token": "tok"}).json() == {"ok": True}
    kept = (tmp_path / "world" / "cascade" / "escalations.jsonl").read_text().splitlines()   # the report is the door's
    assert json.loads(kept[-1])["job"] == "label" and json.loads(kept[-1])["accepted_by"] == "functiongemma"
