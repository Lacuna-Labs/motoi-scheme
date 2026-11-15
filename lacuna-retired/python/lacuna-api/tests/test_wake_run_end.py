"""The wake reads a retired run's own end, and never posts an eval run (wave 1's integration re-run, 2026-11-01: w-8895fe failed its
done-check and the owner's desk said "run:wo:wo-3678 finished after 38s", a test's run shown green on his desk). The ledger is a
scratch file; the foreman and the working feed are stand-ins; nothing reads the live world. The modules are imported inside each test:
the `app_client` fixture drops every lacuna_api module and imports it again, so a module-level import goes stale and a stand-in set on
it never reaches the code (the CI's run of 065d13a4 at 18:16:55Z: the wake read the real feed and posted nothing)."""
import importlib
import time

LEDGER = (
    '(run (@ ("id" "w-aaaaaa") ("run" "wo:wo-1") ("outcome" "pass") ("why" "the done-check held")))\n'
    '(swap (@ ("from" "26b") ("to" "12b") ("ok" #t)))\n'
    '(run (@ ("id" "w-8895fe") ("run" "wo:eval:wo-3678") ("outcome" "fail") ("why" "done-check: could not be judged")))\n'
    '(run (@ ("id" "w-bbbbbb") ("run" "wo:wo-2") ("outcome" "fail") ("why" "the step cap")))\n'
)


def _setup(tmp_path, monkeypatch):
    """The three modules as the code under test will import them now, with the ledger and the foreman stood in."""
    agents_live, foreman, wake = (importlib.import_module(f"lacuna_api.control.{m}") for m in ("agents_live", "foreman", "wake"))
    led = tmp_path / "runs.slat"
    led.write_text(LEDGER)
    monkeypatch.setattr(wake, "RUNS_LEDGER", led)
    monkeypatch.setattr(foreman, "workers", lambda: {"workers": []})
    return agents_live, wake


def test_a_retired_workers_end_is_its_runs_outcome_read_by_the_one_reader(tmp_path, monkeypatch):
    _, wake = _setup(tmp_path, monkeypatch)
    assert wake.run_end("w-8895fe")["outcome"] == "fail"
    assert wake.run_end("w-aaaaaa")["why"] == "the done-check held"
    assert wake.run_end("w-none") == {}
    title, outcome, _ = wake._facts("w-bbbbbb", {"kind": "worker"})
    assert (title, outcome) == ("wo:wo-2", "fail: the step cap"), "the run's own end, never the worker's 'retired'"
    assert wake.BAD.search(outcome), "a failed run reads as failed, so its chip is red"


def test_scan_posts_a_failed_run_and_never_an_eval_run(tmp_path, monkeypatch):
    agents_live, wake = _setup(tmp_path, monkeypatch)
    posted = []
    monkeypatch.setattr(wake, "post", lambda *a, **k: posted.append(a) or True)
    now = time.time()
    feeds = [
        {"working": [{"id": "w-8895fe", "kind": "worker", "name": "run:wo:wo-3678", "since": now - 38},
                     {"id": "w-bbbbbb", "kind": "worker", "name": "run:wo:wo-2", "since": now - 120}]},
        {"working": []},
    ]
    phase = [0]                                           # the test turns the feed; another caller in the process only reads it
    monkeypatch.setattr(agents_live, "working", lambda: feeds[phase[0]])
    wake._known.clear()
    wake.scan._ran = True
    wake.scan()
    phase[0] = 1
    wake.scan()
    assert [a[1] for a in posted] == ["w-bbbbbb"], "the eval run (its ledger key says so) is never posted"
    assert posted[0][3].startswith("fail")


def test_the_posted_word_says_how_it_ended_from_the_record():
    """Video B9: a paused job read "finished · paused after 4.8 h"; finished is said only from a record of a finish."""
    wake = importlib.import_module("lacuna_api.control.wake")
    assert wake.ended_word("paused by alfred") == "paused"
    assert wake.ended_word("fail: the step cap") == "failed"
    assert wake.ended_word("pass: the done-check held") == "finished"
    assert wake.ended_word("done (exit 0)") == "finished"
    assert wake.ended_word("stopped by the owner") == "stopped"
    assert wake.ended_word("gone") == "ended"
    assert wake.ended_word("") == "ended"
