"""The Gallery's draw (CARDS-2.0 §6.15, lane C12): the `draw` petition carries the brief and schnell's four controls, its
contract is written by code, and the owner's yes runs the hands' `draw` act through the foreman's gallery-draw playbook,
pressed; a decline or a control outside schnell's four runs nothing. The wall (GET /api/gallery) is the door's, tested in
lacuna-node/test/gallery.test.mjs. Nothing here paints on the live box, reaches a port or touches ~/lacuna-world or
~/.lacuna (the foreman call is answered by the test). Session: eval:c12-gallery."""
ARGS = {"brief": "A sitting dog, flat stencil, one colour.", "size": 512, "steps": 2, "seed": 4411, "count": 1}


def test_the_draw_contract_names_the_brief_the_controls_and_the_park(lacuna_home):
    from lacuna_api.control import chat
    assert "draw" in chat.FOREMAN_ACTIONS and "kill" in chat.FOREMAN_ACTIONS
    e = chat._foreman_effect("draw", ARGS)
    assert e.startswith('paints 1 picture of "A sitting dog, flat stencil, one colour." at 512 px, 2 steps, seed 4411')
    assert "parks the 26B" in e and "one try, 120 s" in e and "owed" in e
    assert chat._foreman_effect("draw", {**ARGS, "size": 640}).startswith("refuses")
    assert chat._card_of({"action": "draw", "args": {}}) == ["s-gallery"]
    for bad in ({"brief": " "}, {"brief": "x" * 2001}, {"steps": 5}, {"count": 3}, {"seed": -1}, {"seed": 2 ** 32}, {"size": "big"}):
        assert chat.draw_args({**ARGS, **bad}) is None, bad
    assert chat.draw_args({k: v for k, v in ARGS.items() if k != "count"})["count"] == 1


def test_filing_a_draw_waits_for_the_owner(monkeypatch, lacuna_home):
    from lacuna_api.control import chat, foreman
    calls = []
    monkeypatch.setattr(foreman, "call", lambda *a, **k: calls.append(a) or {"ok": True})
    r = chat.file_petition("draw", None, "pressed on the Gallery: paint 1 at 512 px, 2 steps, seed 4411", "eval:c12-gallery", args=ARGS)
    assert r["ok"] and r["petition"] and r["if_approved"].startswith("paints 1 picture")
    assert calls == [], "filing runs nothing"


def test_the_yes_runs_the_gallery_draw_playbook_pressed(monkeypatch, lacuna_home):
    from lacuna_api.control import foreman
    calls = []
    monkeypatch.setattr(foreman, "call", lambda m, p, b=None, timeout=10: calls.append((m, p, b)) or {"ok": True, "run": "w-d1"})
    out = foreman.decided("draw", ARGS, True, "alfred")
    assert out["ok"] and calls[0][:2] == ("POST", "/playbooks/gallery-draw/run")
    b = calls[0][2]
    assert b["pressed"] is True and b["shadow"] is False
    assert b["bindings"]["2"] == [ARGS]
    assert b["bindings"]["1"] == b["bindings"]["3"] and b["bindings"]["1"][0]["glob"] == "draw-*.slat"
    assert b["bindings"]["1"][0]["path"].endswith("/lacuna-world/runs")
    assert b["bindings"]["4"][0]["to"] == "desk"
    assert foreman.decided("draw", ARGS, False, "alfred") == {"ok": True, "declined": True}
    assert "schnell's four controls" in foreman.decided("draw", {**ARGS, "steps": 9}, True, "alfred")["why"]
    assert len(calls) == 1, "a decline or a control outside schnell's four reaches no foreman"
