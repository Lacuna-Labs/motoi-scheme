"""The release cart's four modes at the door (CARDS-2.0 §6.14, lane C11): POST /api/release/cart checks the mode and its one
argument, writes them into the cart's mode lines, files the press (nothing runs before it), and records the filing in the
world's ledger as what it was; GET /api/release/run lists the modes. The foreman, the petitions, the builds and the board
are stubbed: nothing builds, pushes or installs here. The cart is the repo's toolbox/carts/release.sks."""
import importlib
import json
import os
import shutil
import subprocess
from pathlib import Path

import pytest

CART = Path(__file__).resolve().parents[2] / "toolbox" / "carts" / "release.sks"
CUT = Path(__file__).resolve().parents[2] / "toolbox" / "cut.sh"
B_OLD = {"id": "20261017-090000-main-aaa111", "version": "1.0.7", "ok": True, "created": 100}
B_NOW = {"id": "20261019-170853-main-bbb222", "version": "1.0.8", "ok": True, "created": 200}


def _live(name):
    return importlib.import_module(f"lacuna_api.control.{name}")     # the module as loaded now (other tests re-import)


@pytest.fixture
def door(tmp_path, monkeypatch):
    rr, carts, chat, foreman, deploys, rb = (_live(n) for n in ("release_run", "carts", "chat", "foreman", "deploys", "release_board"))
    (tmp_path / "carts").mkdir()
    shutil.copy(CART, tmp_path / "carts" / "release.sks")
    monkeypatch.setenv("LACUNA_WORLD", str(tmp_path / "world"))
    monkeypatch.setattr(carts, "carts_dir", lambda: tmp_path / "carts")
    monkeypatch.setattr(rr, "_hold_file", lambda: tmp_path / "release-hold.json")
    checked = []
    monkeypatch.setattr(foreman, "call", lambda m, p, b=None, **k: checked.append(b) or {"ok": True, "cart": {"acts": ["cut"]}})
    filed = []
    monkeypatch.setattr(chat, "petitions", lambda: [])
    monkeypatch.setattr(chat, "file_petition", lambda action, _x, why, who, args=None: filed.append((action, why, args)) or
                        {"ok": True, "petition": f"p{len(filed)}", "filed": action})
    monkeypatch.setattr(deploys, "builds", lambda: [B_NOW, B_OLD])
    monkeypatch.setattr(rb, "board", lambda: {"ipad": dict(B_NOW)})
    return rr, filed, checked, tmp_path


def _start(rr, **body):
    return rr.r_start(rr.Start(**body), "alfred")


def test_each_mode_files_its_press_with_its_lines_and_is_recorded_as_what_it_was(door):
    rr, filed, checked, tmp = door
    cases = [({"mode": "push"}, "push", ""), ({"mode": "skip-tests", "skip_tests": True}, "skip-tests", ""),
             ({"mode": "cut", "version": "1.0.9"}, "cut", "1.0.9"), ({"mode": "rollback", "target": B_OLD["id"]}, "rollback", B_OLD["id"])]
    for i, (body, mode, arg) in enumerate(cases):
        r = _start(rr, **body)
        assert r["ok"] and r["petition"] == f"p{i + 1}" and r["mode"] == mode
        action, why, args = filed[-1]
        assert action == "spawn-cart" and args["mode"] == mode and args["arg"] == arg
        assert f"(define release-mode '{mode})" in args["program"] and f'(define release-arg "{arg}")' in args["program"]
        assert checked[-1]["program"] == args["program"]             # the trial saw the program the press runs
    assert "NO BATTERY" in filed[1][1]
    rows = [json.loads(x) for x in (tmp / "world" / "ledger" / "releases.jsonl").read_text().splitlines()]
    assert [r["mode"] for r in rows] == ["push", "skip-tests", "cut", "rollback"]
    assert [r["skip_tests"] for r in rows] == [False, True, False, False]
    assert rows[2]["version"] == "1.0.9" and rows[3]["target"] == B_OLD["id"]
    assert [r["mode"] for r in rr.ledger()] == ["rollback", "cut", "skip-tests", "push"]


@pytest.mark.parametrize("body,said", [
    ({"mode": "ship-it"}, "the release cart has no mode 'ship-it': it takes cut, push, skip-tests or rollback"),
    ({"mode": "push", "skip_tests": True}, "skip_tests belongs to the skip-tests mode only"),
    ({"mode": "cut", "version": "1.0"}, "a cut names its version as x.y.z"),
    ({"mode": "cut", "version": '1.0.9") (act \'pass'}, "a cut names its version as x.y.z"),
    ({"mode": "rollback", "target": "../../etc"}, "is not one"),
    ({"mode": "rollback", "target": B_NOW["id"]}, "her iPad already runs"),
])
def test_a_wrong_mode_or_argument_is_refused_in_one_sentence_and_files_nothing(door, body, said):
    rr, filed, checked, tmp = door
    r = _start(rr, **body)
    assert r["ok"] is False and said in r["why"] and r["why"].count(". ") == 0
    assert filed == [] and checked == [] and not (tmp / "world" / "ledger" / "releases.jsonl").exists()


def test_a_hold_stops_every_real_mode_but_the_roll_back(door):
    rr, filed, _, _ = door
    rr.r_hold(rr.Hold(on=True, why="the battery is red"), "alfred")
    assert "held" in _start(rr, mode="skip-tests", skip_tests=True)["why"]
    assert _start(rr, mode="rollback", target=B_OLD["id"])["ok"]
    rr.r_hold(rr.Hold(on=False), "alfred")


def test_a_waiting_card_of_another_mode_is_never_offered_for_this_one(door, monkeypatch):
    rr, filed, _, _ = door
    monkeypatch.setattr(_live("chat"), "petitions", lambda: [{"id": "p7", "action": "spawn-cart", "state": "waiting", "args": {"cart": "release", "mode": "push"}}])
    r = _start(rr, mode="rollback", target=B_OLD["id"])
    assert r["ok"] is False and "push is already waiting (p7)" in r["why"] and filed == []


def test_a_cart_without_mode_lines_runs_only_a_push(door):
    rr, filed, _, tmp = door
    (tmp / "carts" / "release.sks").write_text(";; an old release cart\n")
    assert _start(rr, mode="push")["ok"]
    r = _start(rr, mode="cut", version="1.0.9")
    assert r["ok"] is False and "no mode lines" in r["why"]


def test_the_run_lists_the_modes_and_draws_only_its_mode_s_steps(door, monkeypatch):
    rr, _, _, _ = door
    monkeypatch.setattr(rr, "_newest", lambda: None)
    none = rr.run()
    assert none["modes"] == ["cut", "push", "skip-tests", "rollback"] and "cut" not in [s["key"] for s in none["steps"]]
    rep = lambda kind, text: {"kind": kind, "data": [text]}                       # noqa: E731
    w = {"id": "w1", "state": "done", "reports": [rep("mode", "skip-tests"), rep("step", "starting read"), rep("step", "starting tests"),
                                                  rep("step", "starting check-in"), rep("skip", "pass"), rep("step", "starting promote-build"),
                                                  rep("step", "starting install-ipad"), rep("summary", "released without the battery")]}
    monkeypatch.setattr(rr, "_newest", lambda: w)
    out = rr.run()
    states = {s["key"]: s["state"] for s in out["steps"]}
    assert out["mode"] == "skip-tests" and states["pass"] == "skipped" and states["install-ipad"] == "done" and "cut" not in states
    w["reports"] = [rep("mode", "rollback"), rep("step", "starting install-ipad")]
    w["state"] = "running"
    assert [s["key"] for s in rr.run()["steps"]] == ["install-ipad"]


def test_the_cut_and_the_roll_back_are_pressed_acts_with_their_argument(monkeypatch, tmp_path):
    acts, chat, deploys = _live("acts"), _live("chat"), _live("deploys")
    monkeypatch.setattr(deploys, "builds", lambda: [B_NOW, B_OLD])
    monkeypatch.setattr(acts, "_load", lambda: {"w1": {"who": "owner", "acts": ["cut", "install-ipad"], "dry": False, "cart": "release"}})
    filed = []
    monkeypatch.setattr(chat, "file_petition", lambda *a, **k: filed.append((a, k)) or {"petition": f"p{len(filed)}"})
    assert acts.do("w1", "cut", ["1.0.9"])["waiting"] == "p1"
    assert filed[0][0][0] == "cart-step" and "beta-1.0.9" in filed[0][1]["args"]["words"]
    assert acts.do("w1", "install-ipad", [B_OLD["id"]])["waiting"] == "p2"
    assert B_OLD["id"] in filed[1][1]["args"]["words"]
    assert acts.do("w1", "install-ipad", ["../x"])["ok"] is False
    assert acts.do("w1", "cut", ["1.0"])["ok"] is False and len(filed) == 2


def test_cut_sh_tags_dev_s_head_stages_the_build_and_never_moves_a_tag(tmp_path):
    repo, bin_ = tmp_path / "repo", tmp_path / "bin"
    bin_.mkdir()
    shutil.copy(CUT, bin_ / "cut.sh")
    (bin_ / "build-ipad.sh").write_text('#!/usr/bin/env bash\nmkdir -p "$2"; echo "{\\"ref\\": \\"$1\\"}" > "$2/meta.json"\n')
    env = {**os.environ, "LACUNA_CURATOR_REPO": str(repo), "GIT_AUTHOR_NAME": "t", "GIT_AUTHOR_EMAIL": "t@t", "GIT_COMMITTER_NAME": "t", "GIT_COMMITTER_EMAIL": "t@t"}
    git = lambda *a: subprocess.run(["git", "-C", str(repo), *a], env=env, capture_output=True, text=True, check=True).stdout.strip()   # noqa: E731
    repo.mkdir()
    git("init", "-q", "-b", "dev")
    (repo / "a.txt").write_text("a")
    git("add", "a.txt")
    git("commit", "-qm", "a")
    run = lambda v: subprocess.run(["bash", str(bin_ / "cut.sh"), v, str(tmp_path / "out")], env=env, capture_output=True, text=True)   # noqa: E731
    r = run("1.0.9")
    assert r.returncode == 0, r.stderr
    assert git("rev-list", "-n1", "beta-1.0.9") == git("rev-parse", "dev")
    assert json.loads((tmp_path / "out" / "meta.json").read_text())["ref"] == "beta-1.0.9"
    again = run("1.0.9")
    assert again.returncode == 3 and "never moved" in again.stderr
    assert run("1.0").returncode == 2
