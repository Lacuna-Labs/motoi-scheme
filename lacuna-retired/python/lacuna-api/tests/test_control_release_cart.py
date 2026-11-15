"""The release cart's own parts (playbooks/RELEASE.md): the sorter, the press per step, the judge, the release lane."""
from lacuna_api.control import acts, chat, foreman, judge, release_steps as rs


def test_sorter_rules():
    assert rs.kind_of("scratch/verb-audit/PASS1.md") == "scratch"
    assert rs.kind_of("curator-web/src/scheme/carts/pinned.generated.js") == "generated"
    assert rs.kind_of("curator-web/src/app/Shell.jsx") == "code"
    assert rs.kind_of("curator-web/src/app/Shell.test.jsx") == "test"
    assert rs.kind_of("docs/eng/X.md") == "doc"
    assert rs.kind_of("curator-api/.env.local") == "secret"
    assert rs.kind_of("weird.bin") == "unsure"


def _live(name):
    import importlib
    return importlib.import_module(f"lacuna_api.control.{name}")     # the module as loaded now (other tests re-import)


def test_check_in_takes_only_changed_paths(monkeypatch):
    acts = _live("acts")
    monkeypatch.setattr(_live("release_steps"), "changed", lambda: [("M", "a.js"), ("M", "scratch/n.md"), ("M", ".env")])
    got = acts._check_in_args(["msg", ["a.js", "scratch/n.md", ".env", "not-changed.js"]])
    assert got == {"message": "msg", "paths": ["a.js"]}
    assert acts._check_in_args(["msg", ["scratch/n.md"]]) is None


def test_customer_steps_wait_for_a_press(monkeypatch):
    acts, chat = _live("acts"), _live("chat")
    monkeypatch.setattr(acts, "_load", lambda: {"w1": {"who": "owner", "acts": ["promote-build", "pass"], "dry": False, "cart": "release"}})
    filed = {}
    monkeypatch.setattr(chat, "file_petition", lambda *a, **k: filed.update(a=a, k=k) or {"petition": "p1"})
    r = acts.do("w1", "promote-build", [])
    assert r["waiting"] == "p1" and filed["a"][0] == "cart-step"


def test_release_words_take_the_release_lane():
    lane, tools = chat.card_lane("run the release, dry", None)
    assert lane == "lean" and "start_release" in tools and "hand" in tools


def _draws(seq):
    it = iter(seq)
    return lambda prompt: next(it)


def test_judge_unanimous_and_certain_acts(monkeypatch):
    monkeypatch.setattr(judge, "_keep", lambda *a: None)
    r = judge.judge("q? yes or no", draw=_draws([{"yes": True, "certainty": 0.97, "why": "a"}] * 3))
    assert r["yes"] and r["certain"]


def test_judge_split_or_unsure_goes_to_the_owner(monkeypatch):
    monkeypatch.setattr(judge, "_keep", lambda *a: None)
    split = judge.judge("q", draw=_draws([{"yes": True, "certainty": 0.99, "why": ""}, {"yes": False, "certainty": 0.9, "why": ""}, {"yes": True, "certainty": 0.99, "why": ""}]))
    assert split["yes"] and not split["certain"]
    low = judge.judge("q", draw=_draws([{"yes": False, "certainty": 0.6, "why": ""}] * 3))
    assert not low["certain"]


def test_same_question_other_facts_is_another_question():
    assert foreman._qkey({"question": "q", "facts": ["a.js"]}) != foreman._qkey({"question": "q", "facts": ["b.js"]})


def test_release_start_words_are_code_not_a_model_choice(monkeypatch):
    chat, carts = _live("chat"), _live("carts")
    seen = {}
    monkeypatch.setattr(carts, "start_named", lambda name, who, dry, why: seen.update(name=name, dry=dry) or {"ok": True, "petition": "p9"})
    monkeypatch.setattr(_live("memory"), "remember", lambda *a, **k: None)
    r = chat.ask("Do a dry run of the release.", who="tester")
    assert seen == {"name": "release", "dry": True} and "p9" in r["answer"] and r["model"] == "code"
    assert not chat.START_RELEASE.search("when was the last release?")


def test_a_mind_is_refused_a_job_above_its_horizon(monkeypatch):
    fm = _live("foreman")
    monkeypatch.setattr(fm, "_box", lambda: {"agent_minds": ["gemma3:270m"], "horizon": {"gemma3:270m": {"max_in": 100, "job": "one label"}}})
    r = fm.mind({"model": "gemma3:270m", "system": "s", "prompt": "x" * 2000})
    assert r["ok"] is False and r.get("above_horizon")
