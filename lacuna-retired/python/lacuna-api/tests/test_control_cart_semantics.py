"""Cart repair goes through `card repair`; `hand` ignores its own echoes and fills in the cart we were just talking about."""
from lacuna_api.control import chat, workqueue


def _carts(tmp_path, monkeypatch, *names):
    root = tmp_path / "code" / "curator" / "carts" / "automations"
    for n in names:
        (root / n).mkdir(parents=True)
    monkeypatch.setattr("pathlib.Path.home", lambda: tmp_path)


def test_a_repair_item_names_its_cart(tmp_path, monkeypatch):
    _carts(tmp_path, monkeypatch, "custom-order-accept-notify")
    assert workqueue._cart_slug({"title": "T8: Repair the cart custom-order-accept-notify", "goal": ""}) == "custom-order-accept-notify"
    assert workqueue._cart_slug({"title": "Tidy the docs folder", "goal": "custom-order-accept-notify"}) is None      # no repair word
    assert workqueue._cart_slug({"title": "repair the thing", "goal": "no such cart here"}) is None


def test_hand_drops_echoed_names_and_infers_the_cart(tmp_path, monkeypatch):
    _carts(tmp_path, monkeypatch, "repeat-buyer-thank-you")
    seen = []
    monkeypatch.setattr("lacuna_api.control.hands.do", lambda op, args: seen.append((op, args)) or {"ok": True, "result": {}})
    monkeypatch.setattr(chat.memory, "recent", lambda n=20: [{"role": "user", "content": "fix the repeat-buyer-thank-you cart"},
                                                             {"role": "assistant", "content": "Which one?"}])
    out = chat.hand({"op": "cart-record", "args": {"name": "hand"}}, "t")
    assert seen[-1] == ("cart-record", ["repeat-buyer-thank-you"]) and "repeat-buyer-thank-you" in out["assumed_cart"]
    chat.hand({"op": "cart-record", "name": "hand", "args": ["x-y-z"]}, "t")
    assert seen[-1] == ("cart-record", ["x-y-z"])


def test_the_tool_door_drops_its_own_name_from_the_arguments(monkeypatch):
    got = {}
    monkeypatch.setattr(chat, "call_tool", lambda name, args, who, dry=False: got.update(name=name, args=args) or {"ok": True})
    chat.tool({"name": "hand", "args": {"name": "hand", "op": "cart-record"}}, "t")
    assert got == {"name": "hand", "args": {"op": "cart-record"}}


def test_an_almost_right_tool_call_runs_and_a_wrong_one_says_what_it_takes(monkeypatch):
    ran = {}
    monkeypatch.setitem(chat.TOOLS, "search_docs", chat.TOOLS["search_docs"])
    orig = chat.TOOLS["search_docs"]
    import types
    stub = lambda a, who: ran.update(a) or {"ok": True}      # noqa: E731
    stub._tool = orig._tool
    monkeypatch.setitem(chat.TOOLS, "search_docs", stub)
    assert chat.call_tool("search_docs", {"q": "how to repair a cart"}, "t")["ok"] and ran["query"] == "how to repair a cart"
    ran.clear()
    assert chat.call_tool("search_docs", {"arguments": {"query": "x y"}}, "t")["ok"] and ran["query"] == "x y"
    r = chat.call_tool("show_card", {}, "t")
    assert r["refused"] and "takes" in r and "say_it_like" in r


def test_her_links_are_checked_against_the_real_screens():
    f = chat.fix_links
    assert f("[View it](app:work/list)") == "[View it](app:s-work)"                         # near name mended, no such room
    assert f("[Finished work](app:s-work/finished)") == "[Finished work](app:s-work/finished)"
    assert f("[Finished work](app:work)") == "[Finished work](app:s-work/finished)"          # the label names the room
    assert f("[the live feed](app:agents/calls)") == "[the live feed](app:s-agents/calls)"
    assert f("[Nowhere](app:made-up/x)") == "Nowhere"                                        # unknown: just the words
    assert f("plain words, no link") == "plain words, no link"


def test_repair_task_names_are_valid_and_the_tool_and_the_api_agree():
    import importlib.machinery, importlib.util, pathlib, re
    path = pathlib.Path.home() / "lacuna-world" / "tools" / "card"
    loader = importlib.machinery.SourceFileLoader("card_tool", str(path))
    spec = importlib.util.spec_from_loader("card_tool", loader)
    mod = importlib.util.module_from_spec(spec); loader.exec_module(mod)
    for slug in ("custom-order-accept-notify", "listing-attribute-completeness-search-eligibility-scorer", "a" * 120):
        name = mod.task_name(slug)
        assert re.fullmatch(r"[a-z0-9][a-z0-9-]{0,39}", name), name              # the workshop's TASK_RX
        assert name == mod.task_name(slug)                                        # stable
    assert mod.task_name("short-cart") == "repair-short-cart"
    assert mod.task_name("x" * 60) != mod.task_name("x" * 61)                    # two long slugs never share a name
    from lacuna_api.control import cartbook
    assert cartbook._card("no-such-cart") is None                                 # the lookup uses the same shortening without error
