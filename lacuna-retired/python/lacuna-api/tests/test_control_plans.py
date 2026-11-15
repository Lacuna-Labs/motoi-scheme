"""Cloud routing: Gemma takes no thinkingLevel, a refusal rests that model and the chain moves on, a 429 teaches the limit,
customer words never leave, and a plan that lands is a chip, never a turn."""
import json
import urllib.error

from lacuna_api.control import cloud, plans


def test_gemma_gets_no_thinking_level_and_gemini_does():
    assert "thinkingConfig" not in cloud._gen_cfg("gemma-4-31b-it", "plan", 0.2, 100)
    assert cloud._gen_cfg("gemini-3.8-flash", "plan", 0.2, 100)["thinkingConfig"]["thinkingLevel"] == "high"


def test_a_429_names_its_limit_and_a_day_limit_rests_to_midnight(tmp_path, monkeypatch):
    monkeypatch.setattr(cloud, "LEARNED", tmp_path / "limits.json")
    body = json.dumps({"error": {"details": [{"@type": "x.QuotaFailure", "violations": [
        {"quotaMetric": "m", "quotaId": "GenerateRequestsPerDayPerProjectPerModel-FreeTier", "quotaValue": "20"}]}]}})
    secs, said = cloud.learn_429("gemini-3.8-flash", body)
    assert "per-day" in said and secs > 60 and cloud.learned_per_day("gemini-3.8-flash") == 20
    minute = body.replace("PerDay", "PerMinute")
    assert cloud.learn_429("gemini-x", minute)[0] < 120


def test_the_chain_moves_on_after_a_refusal(monkeypatch):
    monkeypatch.delenv("LACUNA_NO_CLOUD", raising=False)
    monkeypatch.setattr(cloud, "_key", lambda: "k")
    monkeypatch.setattr(cloud, "_note", lambda *a, **k: None)
    monkeypatch.setattr(cloud, "_today_count", lambda m: 0)
    monkeypatch.setattr(cloud, "GAP_S", 0)
    cloud._model_rest.clear()
    seen = []

    class R:
        def __init__(self, lines): self.lines = lines
        def __enter__(self): return self
        def __exit__(self, *a): pass
        def __iter__(self): return iter(self.lines)

    def fake(req, timeout=0):
        model = req.full_url.split("/models/")[1].split(":")[0]
        seen.append(model)
        if model.startswith("gemma"):
            raise urllib.error.HTTPError(req.full_url, 503, "busy", {}, __import__("io").BytesIO(b"{}"))
        return R([b'data: {"candidates":[{"content":{"parts":[{"text":"hmm","thought":true},{"text":"BLUF: do it"}]}}]}\n'])
    monkeypatch.setattr(cloud.urllib.request, "urlopen", fake)
    got = []
    r = cloud.ask_stream("plan", "head", "body", got.append, models=["gemma-4-31b-it", "gemini-3.8-flash"])
    assert r["ok"] and r["model"] == "gemini-3.8-flash" and seen[0].startswith("gemma")
    assert [g["type"] for g in got] == ["thought", "text"]


def test_a_landed_plan_is_a_chip_and_never_a_turn(monkeypatch):
    """Order §1.13a and the lead's ruling (2026-11-06): a plan that comes back, or fails, is a chip on the desk with its BLUF and its
    note; Lacuna is given no turn to tell it or to begin it. Failure class: a wrong road (a result as a turn)."""
    from lacuna_api.control import chat, lacuna_cortex, workers
    chips, turns, notes = [], [], []
    monkeypatch.setattr(workers, "raise_alert", lambda key, level, title, body, notify=True: chips.append((key, level, title, body)))
    monkeypatch.setattr(chat, "ask", lambda *a, **k: turns.append(a) or {"ok": True})
    monkeypatch.setattr(chat, "notes", lambda args, who: notes.append(args["topic"]) or {"ok": True})
    monkeypatch.setattr(lacuna_cortex, "remember", lambda *a, **k: None)
    plans._land({"id": "p-1", "goal": "retrain the sentry", "state": "done", "model": "gemini-3.8-flash", "text": "BLUF: train the 1B first\n1. pairs"})
    plans._land({"id": "p-2", "goal": "fix carts", "state": "failed", "model": None, "text": "", "why": "429 per-day"})
    assert [(c[0], c[1]) for c in chips] == [("work:plan-p-1", "done"), ("work:plan-p-2", "error")]
    assert "train the 1B first" in chips[0][3] and "note plan-p-1" in chips[0][3] and "429 per-day" in chips[1][3]
    assert notes == ["plan-p-1"] and turns == [] and not hasattr(chat, "system_turn")


def test_customer_words_stop_a_plan_before_it_starts():
    assert not plans.start("fix the buyer email for order id 55", "", "t")["ok"]


def test_flash_is_cloud_lacuna_and_gemma_is_the_bulk_worker():
    assert cloud.PLAN_MODELS[0] == "gemini-3.8-flash" and "gemma-4-31b-it" in cloud.PLAN_MODELS      # Gemma answers if Flash refuses
    assert cloud.FARM_MODELS[0] == "gemma-4-31b-it"
