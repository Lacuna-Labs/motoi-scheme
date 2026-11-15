"""The cloud seat: customer data refused, secrets scrubbed, one try then rest, the budget, the cloud only confirms."""
import urllib.error

from lacuna_api.control import cloud, cloud_kinds


def test_customer_data_is_refused_and_secrets_scrubbed():
    assert cloud.scrub("the buyer's ship to address")[0] is None
    assert cloud.scrub("mail jo@example.com")[0] is None
    text, why = cloud.scrub("key AIza" + "x" * 35 + " and a cart")
    assert why is None and "<secret>" in text and "AIza" not in text


def test_one_try_then_rest(tmp_path, monkeypatch):
    monkeypatch.setenv("LACUNA_HOME", str(tmp_path))
    monkeypatch.setattr(cloud, "_key", lambda: "k")
    monkeypatch.setattr(cloud, "GAP_S", 0)
    cloud._state.update(rest_until=0, why=None, last=0)
    calls = []

    def refuse(model, req, key):
        calls.append(model)
        raise urllib.error.HTTPError("u", 402, "credits", {}, None)
    r = cloud.ask("review", "head", "body", send=refuse)
    assert r["resting"] and "credits" in r["why"] and calls == ["gemini-3.8-flash"]
    r2 = cloud.ask("review", "head", "body", send=refuse)
    assert r2["resting"] and calls == ["gemini-3.8-flash"]            # resting: no second call
    cloud._state.update(rest_until=0)


def test_second_opinion_only_confirms(monkeypatch):
    monkeypatch.setattr(cloud, "ask", lambda *a, **k: {"ok": True, "text": "no — it is generated", "model": "m"})
    assert cloud_kinds.second_opinion("q", [], local_yes=True)["confirmed"] is False
    assert cloud_kinds.second_opinion("q", [], local_yes=False)["confirmed"] is True
    monkeypatch.setattr(cloud, "ask", lambda *a, **k: {"ok": False, "why": "resting"})
    assert cloud_kinds.second_opinion("q", [], local_yes=True)["confirmed"] is False
