"""TRAINED MINDS IN SERVICE (the owner's review, 2026-10-18): an owner-approved propose installs the next version of a role,
restarts only the gateway, and must answer a smoke call or roll back by itself; `previous` is always one step away."""
from __future__ import annotations

import json
from pathlib import Path

import pytest

from lacuna_api.control import chat, forge, minds_roles as mr  # noqa: F401 — imported at collection, like the other suites


@pytest.fixture
def box(tmp_path, monkeypatch):
    """A test's own box-minds.json, trained folder and world; the gateway's restart and smoke are recorded, not run."""
    import importlib
    import sys
    for n in ("chat", "forge", "mr"):
        monkeypatch.setattr(sys.modules[__name__], n, importlib.import_module(
            "lacuna_api.control.minds_roles" if n == "mr" else f"lacuna_api.control.{n}"))
    monkeypatch.setenv("LACUNA_HOME", str(tmp_path / "lh"))
    monkeypatch.setenv("LACUNA_WORLD", str(tmp_path / "w"))
    (tmp_path / "w" / "forge").mkdir(parents=True)
    prof = tmp_path / "w" / "box-minds.json"
    prof.write_text(json.dumps({"brain": "gemma4:26b", "agent_minds": ["functiongemma"]}))
    monkeypatch.setenv("LACUNA_BOX_MINDS", str(prof))
    monkeypatch.setattr(chat, "_petitions", {})
    monkeypatch.setattr(chat, "PETITIONS", tmp_path / "petitions.json")
    monkeypatch.setattr(chat, "_after_press", lambda p, pid, approve: None)
    seen = {"restarts": 0, "smoke": [], "answers": True}
    monkeypatch.setattr(mr, "restart_gateway", lambda: seen.__setitem__("restarts", seen["restarts"] + 1) or "restarted")

    def smoke(role):
        seen["smoke"].append((role, mr.roles()[role]["version"] if role in mr.roles() else None))
        ok = seen["answers"] if not callable(seen["answers"]) else seen["answers"](mr.roles()[role]["version"])
        return (True, "it answered") if ok else (False, "HTTP 500: llama.cpp could not load it")
    monkeypatch.setattr(mr, "smoke", smoke)
    return {"tmp": tmp_path, "prof": prof, "seen": seen}


def gguf(box, name="sentry-270m.bf16.gguf") -> str:
    p = box["tmp"] / "w" / "forge" / "trained" / name
    p.parent.mkdir(parents=True, exist_ok=True)
    p.write_bytes(b"GGUF" + name.encode())
    return str(p)


def facts():
    return {"base": "gemma-3-270m-it", "pairs": {"set": "forge-pairs-w1", "n": 400},
            "eval": {"before": {"accuracy": 0.6}, "after": {"accuracy": 0.9}}, "gold": {"accuracy": 0.8, "n": 40}}


def test_promote_keeps_previous_and_never_overwrites_a_version(box):
    v1 = mr.install("sentry", gguf(box), facts())
    assert mr.promote("sentry", v1, "owner-key")["ok"]
    v2 = mr.install("sentry", gguf(box, "sentry-v2.gguf"), facts())
    out = mr.promote("sentry", v2, "owner-key")
    assert out["ok"] and (v1, v2) == ("v1", "v2")
    role = json.loads(box["prof"].read_text())["roles"]["sentry"]
    assert (role["version"], role["previous"], role["family"]) == ("v2", "v1", "gemma3")
    assert role["model"].endswith("trained/sentry/v2/sentry-v2.gguf") and Path(role["model"]).is_file()
    man = mr.manifest("sentry", "v1")
    assert man["base"] == "gemma-3-270m-it" and man["gold"]["accuracy"] == 0.8 and man["pairs"]["set"] == "forge-pairs-w1"
    assert json.loads(box["prof"].read_text())["agent_minds"] == ["functiongemma"]     # the rest of the profile is kept
    assert box["seen"]["restarts"] == 2 and box["seen"]["smoke"] == [("sentry", "v1"), ("sentry", "v2")]
    (Path(mr.trained_dir()) / "sentry" / "v3").mkdir()
    assert mr.install("sentry", gguf(box), facts()) == "v4"                            # never a reused number


def test_a_failed_smoke_rolls_back_by_itself_and_says_so(box):
    mr.promote("sentry", mr.install("sentry", gguf(box), facts()), "owner-key")
    box["seen"]["answers"] = lambda v: v != "v2"
    out = mr.promote("sentry", mr.install("sentry", gguf(box, "bad.gguf"), facts()), "owner-key")
    assert not out["ok"] and out["rolled_back"] and "rolled back to v1 by itself" in out["said"]
    assert mr.roles()["sentry"]["version"] == "v1"
    assert [h["event"] for h in mr.history()] == ["promote", "auto-rollback"]
    assert box["seen"]["restarts"] == 3                                                # promote v1, try v2, back to v1


def test_a_first_version_that_fails_leaves_no_role(box):
    box["seen"]["answers"] = False
    out = mr.promote("worker", mr.install("worker", gguf(box, "w.gguf"), {"base": "functiongemma-270m"}), "owner-key")
    assert not out["ok"] and "untrained one serves" in out["said"] and "worker" not in mr.roles()


def test_manual_rollback_and_its_history(box):
    for n in ("a.gguf", "b.gguf", "c.gguf"):
        mr.promote("sentry", mr.install("sentry", gguf(box, n), facts()), "owner-key")
    out = mr.rollback("sentry", "device:desk")
    assert out["ok"] and (mr.roles()["sentry"]["version"], mr.roles()["sentry"]["previous"]) == ("v2", "v1")
    assert mr.rollback("sentry", "owner-key")["ok"] and mr.roles()["sentry"]["version"] == "v1"
    assert "no previous version" in mr.rollback("sentry", "owner-key")["said"]
    h = mr.history()
    assert [(x["event"], x["from"], x["to"], x["by"]) for x in h[-2:]] == [("rollback", "v3", "v2", "device:desk"),
                                                                           ("rollback", "v2", "v1", "owner-key")]
    assert "no trained worker" in mr.rollback("worker", "owner-key")["said"]


def test_the_forge_rollback_card_is_owner_signed(box, press):
    from lacuna_api.control import forge_verbs
    for n in ("a.gguf", "b.gguf"):
        mr.promote("sentry", mr.install("sentry", gguf(box, n), facts()), "owner-key")
    r = forge_verbs.petition("rollback", "sentry", "claude")
    assert "returns Sentry from v2 to v1" in r["if_approved"]
    assert chat.decide(r["petition"], True, "claude")["refused_press"]                 # a claimed name rolls back nothing
    assert mr.roles()["sentry"]["version"] == "v2"
    out = chat.decide(r["petition"], True, "claude", press(r["petition"], True))
    assert out["ok"] and out["petition"]["result"]["version"] == "v1" and mr.history()[-1]["by"] == "owner-key"
    assert "has no previous" in forge_verbs.petition("rollback", "sentry", "alfred")["refused"]


def test_an_approved_propose_puts_the_forges_gguf_in_service(box, press):
    from lacuna_api.control import forge_verbs
    d = box["tmp"] / "w" / "forge" / "results"
    d.mkdir(parents=True)
    (d / "gemma-3-270m-it-w1.json").write_text(json.dumps({
        "model": "gemma-3-270m-it", "job": "w1", "train_pairs": 400, "held_out": 60, "untrained": {"accuracy": 0.55},
        "trained": {"accuracy": 0.86}, "wins": True, "gguf": gguf(box), "gold": {"accuracy": 0.8}}))
    r = forge_verbs.petition("propose", "sentry", "lacuna")
    assert "smoke call" in r["if_approved"]
    out = chat.decide(r["petition"], True, "alfred", press(r["petition"], True))
    res = out["petition"]["result"]
    assert res["ok"] and res["version"] == "v1" and mr.roles()["sentry"]["version"] == "v1"
    assert mr.manifest("sentry", "v1")["eval"]["after"]["accuracy"] == 0.86 and mr.manifest("sentry", "v1")["approved_by"] == "owner-key"
    dec = forge.decisions()[-1]
    assert dec["applied"] is True and dec["by"] == "owner-key"


def test_a_propose_without_a_gguf_puts_nothing_in_service(box, press):
    from lacuna_api.control import forge_verbs
    d = box["tmp"] / "w" / "forge" / "results"
    d.mkdir(parents=True)
    (d / "w1.json").write_text(json.dumps({"specialist": "sentry", "model": "sentry-270m-lora",
                                           "after": {"accuracy": 0.9}, "before": {"accuracy": 0.6}}))
    r = forge_verbs.petition("propose", "sentry", "lacuna")
    res = chat.decide(r["petition"], True, "alfred", press(r["petition"], True))["petition"]["result"]
    assert not res["ok"] and "no exported GGUF" in res["said"] and not mr.roles()
    assert box["seen"]["restarts"] == 0


def test_the_roles_route(box, app_client):
    r = app_client.get("/api/minds/roles").json()
    assert r == {"roles": {}, "history": []}
