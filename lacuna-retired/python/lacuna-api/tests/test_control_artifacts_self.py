"""Run artifacts + INDEX.slat (B47) and SELF.slat (B49), LACUNA-1.3-DESIGN §37.3."""
from __future__ import annotations

import json
import subprocess
import sys
import time
from pathlib import Path

import pytest

from lacuna_api.control import artifacts, chat, self_portrait

JAIL = Path(__file__).resolve().parents[2] / "lacuna-box" / "jail" / "workers"


def _job(jobs: Path, wid: str, *, cls: str = "repair", state: str = "retired", report: dict | None = None,
         log: str = "", card: str | None = None, at: float | None = None) -> None:
    d = jobs / wid
    d.mkdir(parents=True)
    brief = {"kind": "brief", "id": f"b-{wid[2:]}", "from": "lacuna", "to": wid,
             "job": {"class": cls, "brief": f"do the {cls} thing", "inputs": {}}}
    (d / "mailbox.jsonl").write_text(json.dumps(brief) + "\n")
    (d / "job.json").write_text(json.dumps({"name": wid, "worker": cls, "state": "done", **({"card": card} if card else {})}))
    t = at or time.time()
    (d / "state.json").write_text(json.dumps({"state": state, "at": t, "note": "boom: it fell over",
                                              "history": [{"state": "spawned", "at": t - 120}, {"state": state, "at": t}]}))
    if report is not None:
        (d / "report.json").write_text(json.dumps({"kind": "report", "id": "r", "worker": wid, "brief_id": "b", "class": cls,
                                                   **report}))
    (d / "run.log").write_text(log)


REPAIR_LOG = """── 2026-10-18 03:18 start (first run) ──
03:19:00 making the worktree r-x-180319 for x
03:19:08 before: strict:works-model · the model is handed 104,966 bytes (target 8,000)
03:19:09 round 1: asking the worker (lacuna-worker-lite)
03:27:23 round 1: no answer — Overtime: the worker ran past 480 s on one round
03:28:00 round 2: x already passes the quick check
"""


@pytest.fixture
def world(tmp_path, monkeypatch):
    jobs = tmp_path / "jobs"
    jobs.mkdir()
    monkeypatch.setenv("LACUNA_JOBS", str(jobs))
    return jobs


def test_backfill_reads_steps_minds_and_outcomes(world):
    _job(world, "w-repair-1018-010000", log=REPAIR_LOG,
         report={"ok": False, "said": "x: still strict:not-done after 2 round(s)", "minutes": 9.5,
                 "usage": {"brain_seconds": 480.4, "seat": "worker"}, "branch": "lacuna-r-x",
                 "outputs": [{"path": "carts/x/x.sks", "kind": "cart"}]})
    _job(world, "w-review-1018-020000", cls="review",
         report={"ok": True, "said": "t: all seven signed", "task": "r-x", "handoff": {"next": "the owner's press"}})
    _job(world, "w-docs-1018-030000", cls="docs", state="crashed", log="03:00:01 reading tools\nTraceback ...\n")
    _job(world, "w-fetch-1018-040000", cls="fetch", state="executing")          # still running: no artifact yet
    jail = artifacts._jail()
    wrote = jail.backfill()
    assert len(wrote) == 3

    rep = artifacts.read("w-repair-1018-010000")
    assert rep["run"]["asked"] == "do the repair thing"
    assert [s["status"] for s in rep["steps"]] == ["done", "done", "done", "stopped", "skipped"]
    assert rep["steps"][2]["name"] == "round 1"
    assert rep["minds"]["used"] == ["lacuna-worker-lite"] and rep["minds"]["brain_seconds"] == 480.4
    assert rep["made"]["branches"] == ["lacuna-r-x"] and rep["made"]["files"] == ["carts/x/x.sks"]
    assert rep["outcome"]["is"] == "stopped"

    assert artifacts.read("w-review-1018-020000")["outcome"]["is"] == "press"
    assert artifacts.read("w-review-1018-020000")["made"]["petitions"] == ["merge r-x"]
    crashed = artifacts.read("w-docs-1018-030000")
    assert crashed["outcome"]["is"] == "stopped" and "fell over" in crashed["outcome"]["reason"]
    assert artifacts.read("w-fetch-1018-040000") is None

    carts = {r["cart"]: r for r in artifacts.index()}
    assert set(carts) == {"repair", "review", "docs"}
    assert artifacts.latest("review")["run"]["id"] == "w-review-1018-020000"
    assert jail.backfill() == []                                                   # a second backfill writes nothing new
    assert "w-repair-1018-010000" in chat.runs({}, "test") and "round 1" in chat.runs({"cart": "repair"}, "test")


def test_every_line_is_one_slat_form(world):
    _job(world, "w-echo-1018-000001", cls="echo", report={"ok": True, "said": 'a "quoted"\nline\x1b[0m'},
         log="00:00:01 echoing: \"hi\" \\ there\n")
    path = artifacts._jail().leave("w-echo-1018-000001")
    text = Path(path).read_text()
    for ln in text.splitlines():
        assert ln.startswith("(") and ln.endswith(")") and "\x1b" not in ln
    assert len(artifacts._jail().parse_lines(text)) == len(text.splitlines())


def test_index_holds_every_cart_when_runs_finish_at_once(world):
    """Twelve runs over four carts, finishing at the same moment in separate processes: every cart lands, the newest
    run of each wins, and no temp file is left behind."""
    t0 = time.time()
    for i in range(12):
        _job(world, f"w-echo-1018-1000{i:02d}", cls="echo", card=f"cart{i % 4}", report={"ok": True, "said": f"run {i}"},
             at=t0 + i)
    procs = [subprocess.Popen([sys.executable, str(JAIL / "artifact.py"), "leave", f"w-echo-1018-1000{i:02d}"],
                              stdout=subprocess.DEVNULL, stderr=subprocess.PIPE) for i in range(12)]
    assert all(p.wait(timeout=60) == 0 for p in procs)
    rows = {r["cart"]: r for r in artifacts.index()}
    assert set(rows) == {"cart0", "cart1", "cart2", "cart3"}
    for c in range(4):
        assert rows[f"cart{c}"]["id"] == f"w-echo-1018-1000{8 + c:02d}"
    assert not list(artifacts.root().rglob("*.tmp"))
    assert len(list(artifacts.root().rglob("w-*.slat"))) == 12


def test_runs_is_a_chat_tool_picked_by_away_words():
    assert "runs" in chat.TOOLS and chat.TOOLS["runs"]._tool["tier"] == "read"
    assert "runs" in chat.pick_tools("what happened while I was away?")
    assert "runs" in chat.pick_tools("how did the repair go")
    assert chat.runs({}, "test") == "no run has left an artifact yet"


# ── SELF.slat ─────────────────────────────────────────────────────────────────────────────────────────────────

@pytest.fixture
def self_world(tmp_path, monkeypatch, world):
    carts = tmp_path / "carts"
    carts.mkdir()
    (carts / "log-sentry.sks").write_text("(lacuna-cart 'log-sentry\n  '((does . \"reads the dev logs and files what is real\")\n"
                                          "    (done . \"a day of log read\")))\n(define (start) 1)\n")
    monkeypatch.setenv("LACUNA_CARTS", str(carts))
    monkeypatch.setenv("LACUNA_TIERS", str(tmp_path / "no-tiers.json"))
    _job(world, "w-docs-1018-050000", cls="docs", report={"ok": True, "said": "README written"})
    artifacts._jail().backfill()
    return tmp_path


def test_self_has_every_section_and_names_its_sources(self_world):
    head = self_portrait.write()
    text = head + "\n" + self_portrait.live()                # the head is cached; the live sections ride each turn (G3)
    forms = artifacts._jail().parse_lines(text)
    kinds = [f["kind"] for f in forms]
    head_kinds = [f["kind"] for f in artifacts._jail().parse_lines(head)]
    assert not set(head_kinds) & set(self_portrait.LIVE) and "written" not in head
    for k in ("self", "carts", "scheme", "verbs", "minds", "hands", "running", "runs", "limits", "laws"):
        assert k in kinds, k
    for f in forms:
        if f["kind"] not in ("self", "cart", "latest"):
            assert f.get("source") or f.get("unread"), f["kind"]
    by = {f["kind"]: f for f in forms}
    assert by["carts"]["count"] == 1 and any(f.get("name") == "log-sentry" for f in forms if f["kind"] == "cart")
    assert by["minds"]["tiers"] == "benching"
    assert "tail-log" in by["hands"]["ops"]
    assert "ask" in by["verbs"]["tier_act"]
    assert any(f["kind"] == "latest" and f["id"] == "w-docs-1018-050000" for f in forms)
    assert by["limits"]["brain_lane"] in ("free", "held", "unknown") and 0 < by["limits"]["disk_free_pct"] <= 100
    assert any("permission card" in law for law in by["laws"]["are"])
    assert len(text) <= self_portrait.MAX_CHARS
    assert self_portrait.path().read_text() == head


def test_self_is_bounded_and_keeps_its_laws(self_world, monkeypatch):
    monkeypatch.setattr(self_portrait, "MAX_CHARS", 1500)
    text = self_portrait.build()
    assert "(laws " in text and text.startswith("(self ")
    assert len(text) <= 1500 + len(self_portrait.laws()[0]) + 1


def test_head_refreshes_only_when_stale(self_world):
    first = self_portrait.head()
    p = self_portrait.path()
    p.write_text("(self :name \"kept\")\n")
    assert self_portrait.head() == "(self :name \"kept\")\n"                      # fresh: read as it is
    assert self_portrait.head(max_age=0).startswith("(self :name \"Lacuna\"")       # stale: rewritten
    assert first.startswith("(self ")


def test_chat_prompt_is_the_manual_and_self_rides_elsewhere(self_world):
    # 2026-10-19 21:40: SELF.slat left the system prompt (the head is sized for this box: 10k tokens); self_portrait.head() still renders it
    prompt = chat.system_prompt()
    assert chat.PROMPT.read_text()[:200] in prompt                                    # the manual, unedited
    assert self_portrait.head().startswith("(self ")
