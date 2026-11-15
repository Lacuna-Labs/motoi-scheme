"""MENTAT OBSERVABILITY (2026-10-08): the console's /api/mentat/* carry the curator's observe routes server-side,
and the standing check says each condition once — and UNKNOWN, never green, when the curator does not answer.

No test reaches a live host: `mentat._get` is replaced by the fixture in fixtures/mentat_observe.json.
"""
from __future__ import annotations

import json
import re
from pathlib import Path

import pytest

FIX = json.loads((Path(__file__).parent / "fixtures" / "mentat_observe.json").read_text())
CONSOLE = Path(__file__).parent.parent / "lacuna_api" / "console"
ROUTES = {"/board": "board", "/impressions": "impressions", "/objects": "objects", "/explain": "explain",
          "/right-time": "right_time", "/health": "health"}


def _fake(seen, down=False, missing=False):
    def get(path, params=None, timeout=10):
        seen.append((path, dict(params or {})))
        from lacuna_api.control import mentat
        if down:
            raise mentat.Unreachable("ConnectionRefusedError: [Errno 61] Connection refused")
        if missing:
            return 404, b'{"detail":"Not Found"}', "application/json"
        if path.startswith("/cart/"):
            return (200, json.dumps(FIX["cart"]).encode(), "application/json") if path == "/cart/reprice-stale" else \
                (404, b'{"ok":false,"why":"no cart named that"}', "application/json")
        if path.startswith("/signal/"):
            return 200, json.dumps(FIX["signal"]).encode(), "application/json"
        if path.startswith("/list/"):
            return 200, json.dumps({**FIX["list_never_fire"], "name": path[6:]}).encode(), "application/json"
        if path == "/export":
            return 200, b"slug,band\nreprice-stale,3\n", "text/csv"
        return 200, json.dumps(FIX[ROUTES[path]]).encode(), "application/json"
    return get


@pytest.fixture
def m(app_client, monkeypatch):
    from lacuna_api.control import mentat
    seen = []
    monkeypatch.setattr(mentat, "_get", _fake(seen))
    mentat._last.update(t=0.0, v=None)
    return app_client, mentat, seen, monkeypatch


def test_the_board_is_carried_with_only_its_own_filters(m):
    c, _, seen, _ = m
    r = c.get("/api/mentat/board?shop=shop-a&band=3&flag=failing&evil=1&limit=9999")
    assert r.status_code == 200 and r.json()["lists"]["never_fire"]["count"] == 130
    assert seen[-1] == ("/board", {"shop": "shop-a", "band": "3", "flag": "failing", "limit": 200})


def test_a_long_list_is_read_a_page_at_a_time(m):
    c, _, seen, _ = m
    r = c.get("/api/mentat/list/never_fire?band=1&offset=-5&limit=1000&evil=1")
    assert r.status_code == 200 and r.json()["count"] == 130
    assert seen[-1] == ("/list/never_fire", {"band": "1", "offset": 0, "limit": 200})
    assert c.get("/api/mentat/list/everything").status_code == 404


@pytest.mark.parametrize("url,path,params", [
    ("/api/mentat/cart/reprice-stale", "/cart/reprice-stale", {}),
    ("/api/mentat/signal/stale-price", "/signal/stale-price", {}),
    ("/api/mentat/impressions?cart=reprice-stale&limit=9999", "/impressions", {"cart": "reprice-stale", "limit": 500}),
    ("/api/mentat/objects?shop=shop-b", "/objects", {"shop": "shop-b"}),
    ("/api/mentat/explain?cart=relist-ended&object=obj-2&shop=shop-a&impression=imp-104", "/explain",
     {"cart": "relist-ended", "object": "obj-2", "shop": "shop-a", "impression": "imp-104"}),
    ("/api/mentat/right-time", "/right-time", {}),
])
def test_each_view_is_one_get(m, url, path, params):
    c, _, seen, _ = m
    r = c.get(url)
    assert r.status_code == 200, r.text
    assert r.json()["ok"] is True and seen[-1] == (path, params)


def test_a_slug_is_quoted_never_a_path(m):
    c, _, seen, _ = m
    c.get("/api/mentat/cart/a%20b%3Fflag%3Dx")
    assert seen[-1][0] == "/cart/a%20b%3Fflag%3Dx"


def test_a_curator_404_keeps_its_status_and_words(m):
    c, *_ = m
    r = c.get("/api/mentat/cart/nope")
    assert r.status_code == 404 and "no cart named that" in r.text


def test_unreachable_is_a_502_that_says_why(m):
    c, mentat, seen, mp = m
    mp.setattr(mentat, "_get", _fake(seen, down=True))
    r = c.get("/api/mentat/board")
    assert r.status_code == 502 and r.json()["detail"]["unreachable"] is True and ":5051" in r.json()["detail"]["why"]


def test_routes_not_served_yet_is_said_plainly(m):
    c, mentat, seen, mp = m
    mp.setattr(mentat, "_get", _fake(seen, missing=True))
    r = c.get("/api/mentat/board")
    assert r.status_code == 404 and "has no /board" in r.json()["detail"]["why"]


def test_the_export_is_a_download(m):
    c, *_ = m
    r = c.get("/api/mentat/export?format=csv")
    assert r.status_code == 200 and r.text.startswith("slug,band")
    assert "attachment" in r.headers["content-disposition"]
    assert c.get("/api/mentat/export?format=xml").status_code == 422


def test_status_is_warn_with_the_curators_alerts(m):
    c, *_ = m
    s = c.get("/api/mentat/status").json()
    assert s["state"] == "warn" and s["reachable"] is True and len(s["alerts"]) == 3


@pytest.mark.parametrize("kind", ["down", "missing"])
def test_status_is_unknown_never_green_when_the_curator_cannot_say(m, kind):
    c, mentat, seen, mp = m
    mp.setattr(mentat, "_get", _fake(seen, down=kind == "down", missing=kind == "missing"))
    s = c.get("/api/mentat/status").json()
    assert s["state"] == "unknown" and s["reachable"] is False and s["why"]


def test_status_is_asked_at_most_once_a_minute(m):
    c, _, seen, _ = m
    c.get("/api/mentat/status"); c.get("/api/mentat/status")
    assert [p for p, _ in seen].count("/health") == 1


# ── the standing check through the watcher's own alert mechanism ──────────────────────────────────────────────────

class Bar:
    def __init__(self):
        self.raised, self.resolved = [], []

    def raise_alert(self, key, level, title, body, notify=True):
        self.raised.append((key, level, title))

    def resolve_alert(self, key, why):
        self.resolved.append(key)


def _v(alerts, reachable=True):
    return {"state": "warn" if alerts else "ok", "reachable": reachable, "alerts": alerts, "why": None if reachable else "no answer"}


def test_each_condition_is_said_once_and_cleared_when_it_ends():
    from lacuna_api.control import mentat
    bar, state = Bar(), {}
    alerts = FIX["health"]["alerts"]
    mentat.evaluate(bar.raise_alert, bar.resolve_alert, state, _v(alerts))
    mentat.evaluate(bar.raise_alert, bar.resolve_alert, state, _v(alerts))
    assert len(bar.raised) == 3 and all(k.startswith("mentat:") for k, *_ in bar.raised)
    mentat.evaluate(bar.raise_alert, bar.resolve_alert, state, _v(alerts[:1]))
    assert sorted(bar.resolved) == sorted(f"mentat:{a['id']}" for a in alerts[1:])
    assert len(bar.raised) == 3


def test_an_unreachable_curator_is_said_unknown_once_and_keeps_open_alerts_open():
    from lacuna_api.control import mentat
    bar, state = Bar(), {}
    mentat.evaluate(bar.raise_alert, bar.resolve_alert, state, _v(FIX["health"]["alerts"][:1]))
    mentat.evaluate(bar.raise_alert, bar.resolve_alert, state, _v([], reachable=False))
    mentat.evaluate(bar.raise_alert, bar.resolve_alert, state, _v([], reachable=False))
    unknown = [r for r in bar.raised if r[0] == "mentat:reach"]
    assert len(unknown) == 1 and "UNKNOWN" in unknown[0][2]
    assert bar.resolved == []                      # unknown is not clear
    mentat.evaluate(bar.raise_alert, bar.resolve_alert, state, _v(FIX["health"]["alerts"][:1]))
    assert bar.resolved == ["mentat:reach"]


def test_the_watcher_runs_the_check_and_keeps_its_memory(app_client, monkeypatch):
    from lacuna_api.control import mentat, workers
    seen = []
    monkeypatch.setattr(mentat, "_get", _fake(seen, down=True))
    mentat._last.update(t=0.0, v=None)
    assert ("mentat", mentat.section) in workers.SECTIONS and "mentat:" in workers._KEPT
    with workers._lock:
        del workers._alerts[:]
    workers._state.pop("mentat:reach", None)
    workers._guarded("mentat", mentat.section)
    assert [a["key"] for a in workers.alerts()] == ["mentat:reach"]


# ── the page's laws, read off the files ──────────────────────────────────────────────────────────────────────────

PAGE = sorted(CONSOLE.glob("js/mentat*.js"))


def test_the_page_exists_and_each_module_is_500_lines_or_fewer():
    assert PAGE, "console/js/mentat*.js"
    for p in PAGE:
        assert len(p.read_text().splitlines()) <= 500, p.name


@pytest.mark.parametrize("word", [r"\bher\b", r"\bshe\b", r"border-left"])
def test_the_page_speaks_generically_and_draws_no_left_bars(word):
    for p in PAGE:
        assert not re.search(word, p.read_text(), re.I), f"{p.name}: {word}"
    css = (CONSOLE / "app.css").read_text()
    block = css[css.find("/* ── MENTAT"):] if "/* ── MENTAT" in css else ""
    assert block and "border-left" not in block


def test_the_page_never_redraws_the_same_picture():
    text = "\n".join(p.read_text() for p in PAGE)
    assert "fingerprint" in text and "/api/mentat/" in text and ":5051" not in text


def test_a_list_subject_is_said_in_a_few_words_and_info_is_not_a_warning():
    from lacuna_api.control import mentat
    assert mentat.subject_words(["a", "b", "c"], most=2) == " (a, b and 1 more)"
    bar, state = Bar(), {}
    mentat.evaluate(bar.raise_alert, bar.resolve_alert, state,
                    _v([{"id": "signal-zero-7d", "level": "info", "text": "21 signals at zero", "subject": ["x", "y"]}]))
    assert bar.raised == [("mentat:signal-zero-7d", "info", "Mentat · 21 signals at zero")]


# ── "+N more" is counted from the alert's true total, never from the head of its subject list ─────────────────────

HEAD = [f"cart-{i:02d}" for i in range(12)]


def test_the_alert_text_counts_more_from_the_total():
    from lacuna_api.control import mentat
    assert mentat.subject_words(HEAD, count=7666) == f" ({', '.join(HEAD[:6])} and 7,660 more)"
    assert mentat.subject_words(HEAD) == f" ({', '.join(HEAD[:6])} and 6 more)"       # no count: the list is all there is
    bar, state = Bar(), {}
    seen = []
    mentat.evaluate(lambda k, lv, t, body, notify=True: seen.append(body), bar.resolve_alert, state,
                    _v([{"id": "cart-never-shown", "level": "warn", "text": "7666 carts never shown", "subject": HEAD, "count": 7666}]))
    assert "and 7,660 more" in seen[0]


def test_the_page_says_plus_7654_more_for_12_names_of_7666():
    import shutil
    import subprocess
    node = shutil.which("node")
    if not node:
        pytest.skip("node is not installed")
    js = CONSOLE / "js"
    code = (f"const m = await import('{(js / 'mentat.js').as_uri()}'); const u = await import('{(js / 'util.js').as_uri()}');"
            "console.log(`+${u.n(m.moreCount(7666, 12))} more|${m.moreCount(undefined, 12)}|${m.moreCount(3, 12)}`)")
    out = subprocess.run([node, "--input-type=module", "-e", code], capture_output=True, text=True, timeout=30)
    assert out.stdout.strip() == "+7,654 more|0|0", out.stderr
