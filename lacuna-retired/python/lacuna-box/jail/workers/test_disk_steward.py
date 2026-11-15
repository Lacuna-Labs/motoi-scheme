"""disk-steward removes only what it can prove is Lacuna's own, done and safe — never anything else (E8)."""
import itertools
import json
import os
import subprocess
import sys

sys.path.insert(0, os.path.dirname(__file__))
from classes import disk_steward as ds  # noqa: E402


def own_status(root, name):
    return {"task": name, "worktree": os.path.join(root, name), "branch": f"lacuna-{name}", "head": "abc", "passed": False}


def test_is_own_only_for_the_workshops_own_folder(tmp_path):
    root = str(tmp_path / "worktrees")
    os.makedirs(f"{root}/r-cart-1")
    ok, why = ds.is_own(f"{root}/r-cart-1", own_status(root, "r-cart-1"), root)
    assert ok, why


def test_is_own_refuses_everything_short_of_proof(tmp_path):
    root = str(tmp_path / "worktrees")
    os.makedirs(f"{root}/r-cart-1")
    os.makedirs(f"{root}/_lacuna")
    os.makedirs(f"{root}/nested/r-cart-2")
    os.makedirs(str(tmp_path / "elsewhere" / "r-cart-3"))
    os.symlink(str(tmp_path / "elsewhere" / "r-cart-3"), f"{root}/r-cart-3")
    os.makedirs(f"{root}/Owner Stuff")
    good = own_status(root, "r-cart-1")
    cases = [
        (f"{root}/r-cart-1", None),                                                  # no record
        (f"{root}/r-cart-1", {}),                                                    # an empty answer
        (f"{root}/r-cart-1", "no task 'r-cart-1'"),                                  # the workshop's refusal in words
        (f"{root}/r-cart-1", {**good, "task": "r-cart-9"}),                          # a record for another task
        (f"{root}/r-cart-1", {**good, "worktree": str(tmp_path / "elsewhere")}),     # its record points elsewhere
        (f"{root}/r-cart-1", {**good, "branch": "dev"}),                             # not a lacuna-* branch
        (f"{root}/r-cart-1", {**good, "branch": "main"}),
        (f"{root}/_lacuna", own_status(root, "_lacuna")),                            # the integration checkout
        (f"{root}/nested/r-cart-2", own_status(f"{root}/nested", "r-cart-2")),       # not directly in the folder
        (f"{root}/r-cart-3", own_status(root, "r-cart-3")),                          # a link out of the folder
        (str(tmp_path / "elsewhere" / "r-cart-3"), own_status(str(tmp_path / "elsewhere"), "r-cart-3")),
        (f"{root}/../elsewhere/r-cart-3", own_status(root, "r-cart-3")),             # .. out of the folder
        (f"{root}/Owner Stuff", own_status(root, "Owner Stuff")),                    # not a task's name
        (os.path.expanduser("~/code/curator"), own_status(root, "curator")),         # the repo itself
    ]
    for path, st in cases:
        ok, why = ds.is_own(path, st, root)
        assert not ok, (path, st)
        assert why


def test_classify_never_removes_what_is_not_its_own():
    flags = ["live", "passed", "merged", "finished"]
    for combo in itertools.product([None, "x"], [False, True], [None, "into dev"], [None, "2 worker(s)"]):
        for clean in (True, False, None):
            for days in (None, 0.5, 30.0):
                row = dict(zip(flags, combo), clean=clean, days=days, own=False, why_own="no record")
                assert ds.classify(row)[0] == "owner"


def test_classify_removes_only_own_done_and_safe():
    base = {"own": True, "live": None, "clean": True, "passed": False, "merged": None, "finished": None, "days": 1.0}
    assert ds.classify({**base, "merged": "into dev abc"})[0] == "remove"
    assert ds.classify({**base, "finished": "1 worker(s): w-repair-1"})[0] == "remove"
    assert ds.classify({**base, "days": 9.0})[0] == "remove"
    assert ds.classify(base)[0] == "keep"                                            # recent, no worker record: in use
    assert ds.classify({**base, "merged": "x", "live": "w-repair-2"})[0] == "keep"   # a worker is on it
    assert ds.classify({**base, "merged": "x", "clean": False})[0] == "keep"         # uncommitted work
    assert ds.classify({**base, "merged": "x", "clean": None})[0] == "keep"          # could not read its tree
    assert ds.classify({**base, "days": 30, "passed": True})[0] == "keep"            # waits on the owner's merge
    assert ds.classify({**base, "passed": True, "merged": "into dev"})[0] == "remove"


def test_jobs_by_task_reads_reports_and_briefs(tmp_path):
    def worker(wid, state, task=None, brief_task=None, job_state="on"):
        d = tmp_path / wid
        d.mkdir()
        (d / "state.json").write_text(json.dumps({"state": state, "at": 100}))
        (d / "job.json").write_text(json.dumps({"state": job_state}))
        (d / "mailbox.jsonl").write_text(json.dumps({"job": {"inputs": {"task": brief_task} if brief_task else {}}}) + "\n")
        if task:
            (d / "report.json").write_text(json.dumps({"task": task}))
    worker("w-repair-1", "retired", task="r-a-1")
    worker("w-repair-2", "executing", brief_task="r-b-1")
    worker("w-repair-3", "crashed", task="r-c-1")                       # the runner will retry it: still live
    worker("w-repair-4", "crashed", task="r-d-1", job_state="failed")   # its retries are spent: ended
    got = ds.jobs_by_task(str(tmp_path))
    assert got["r-a-1"][0]["state"] == "retired"
    assert got["r-b-1"][0]["state"] == "executing"
    assert got["r-c-1"][0]["state"] in ds.LIVE
    assert got["r-d-1"][0]["state"] not in ds.LIVE


class FakeWorker:
    def __init__(self, inputs):
        self.id, self.inputs, self.touched, self.lines = "w-disk-steward-t", inputs, [], []

    def progress(self, words, done=None, total=None):
        self.lines.append(words)

    def over(self):
        return None


FAKE_BOX = r'''#!/usr/bin/env python3
import json, os, shutil, sys
st = json.load(open(os.environ["FAKE_STATUS"]))
a = sys.argv[1:]
open(os.environ["FAKE_LOG"], "a").write(" ".join(a) + "\n")
if a[:2] == ["work", "status"]:
    print(json.dumps(st[a[2]]) if a[2] in st else f"no task {a[2]!r}")
elif a[:2] == ["work", "drop"]:
    shutil.rmtree(st[a[2]]["worktree"])
    print("worktree removed; branch kept")
'''


def test_run_drops_only_its_own_done_worktrees(tmp_path, monkeypatch):
    root = tmp_path / "worktrees"
    tools = tmp_path / "tools"
    tools.mkdir()
    (tools / "box").write_text(FAKE_BOX)
    (tools / "box").chmod(0o755)
    status = {}
    for name in ("r-merged-1", "r-live-1", "r-dirty-1", "r-waiting-1", "r-recent-1"):
        p = root / name
        p.mkdir(parents=True)
        subprocess.run(["git", "init", "-q", str(p)], check=True)
        (p / "x.txt").write_text("x")
        subprocess.run(["git", "-C", str(p), "add", "x.txt"], check=True)
        subprocess.run(["git", "-C", str(p), "-c", "user.name=t", "-c", "user.email=t@t", "commit", "-qm", "x"], check=True)
        status[name] = own_status(str(root), name)
    status["r-merged-1"]["merged"] = "abc at now by owner"
    status["r-live-1"]["merged"] = "abc"
    status["r-dirty-1"]["merged"] = "abc"
    (root / "r-dirty-1" / "x.txt").write_text("changed, not committed")
    status["r-waiting-1"]["passed"] = True
    (root / "_lacuna").mkdir()                                            # the integration checkout: never its to drop
    (root / "someone-elses").mkdir()                                     # no record at all
    jobs = tmp_path / "jobs"
    (jobs / "w-repair-9").mkdir(parents=True)
    (jobs / "w-repair-9" / "state.json").write_text(json.dumps({"state": "executing", "at": 1}))
    (jobs / "w-repair-9" / "report.json").write_text(json.dumps({"task": "r-live-1"}))
    (tmp_path / "status.json").write_text(json.dumps(status))
    monkeypatch.setenv("FAKE_STATUS", str(tmp_path / "status.json"))
    monkeypatch.setenv("FAKE_LOG", str(tmp_path / "box.log"))
    monkeypatch.setenv("LACUNA_JOBS", str(jobs))
    monkeypatch.setattr(ds, "ROOT", str(root))
    monkeypatch.setattr(ds, "TOOLS", str(tools))
    monkeypatch.setattr(ds, "REPO", str(tmp_path / "no-repo"))
    monkeypatch.setattr(ds, "SCRATCH", [])
    monkeypatch.setattr(ds, "RUNS", str(tmp_path / "no-runs"))
    rep = ds.run(FakeWorker({}))
    drops = [l.split()[2] for l in (tmp_path / "box.log").read_text().splitlines() if l.startswith("work drop")]
    assert drops == ["r-merged-1"], rep
    assert [r["name"] for r in rep["removed"]] == ["r-merged-1"]
    assert rep["freed_bytes"] > 0
    for left in ("r-live-1", "r-dirty-1", "r-waiting-1", "r-recent-1", "_lacuna", "someone-elses"):
        assert (root / left).exists(), left
    owners = {os.path.basename(r["path"]) for r in rep["for_the_owner"]}
    assert {"_lacuna", "someone-elses"} <= owners
    kept = {r["name"]: r["why"] for r in rep["kept"]}
    assert "worker" in kept["r-live-1"] and "uncommitted" in kept["r-dirty-1"] and "merge" in kept["r-waiting-1"]
    assert "no branch was deleted" in rep["said"]


def test_a_dry_run_removes_nothing(tmp_path, monkeypatch):
    root = tmp_path / "worktrees"
    (root / "r-old-1").mkdir(parents=True)
    tools = tmp_path / "tools"
    tools.mkdir()
    (tools / "box").write_text(FAKE_BOX)
    (tools / "box").chmod(0o755)
    (tmp_path / "status.json").write_text(json.dumps({"r-old-1": {**own_status(str(root), "r-old-1"), "merged": "x"}}))
    monkeypatch.setenv("FAKE_STATUS", str(tmp_path / "status.json"))
    monkeypatch.setenv("FAKE_LOG", str(tmp_path / "box.log"))
    monkeypatch.setenv("LACUNA_JOBS", str(tmp_path / "jobs"))
    monkeypatch.setattr(ds, "ROOT", str(root))
    monkeypatch.setattr(ds, "TOOLS", str(tools))
    monkeypatch.setattr(ds, "SCRATCH", [])
    monkeypatch.setattr(ds, "RUNS", str(tmp_path / "no-runs"))
    monkeypatch.setattr(ds, "clean_of", lambda p: True)
    rep = ds.run(FakeWorker({"dry": True}))
    assert (root / "r-old-1").exists()
    assert "would remove 1" in rep["said"]
    assert "work drop" not in (tmp_path / "box.log").read_text()
