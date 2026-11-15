"""THE WEB is read-only and jailed: public http(s) only, never the Studio's own ports, capped, audited."""
import pytest

from lacuna_api.control import web


@pytest.mark.parametrize("url,why", [
    ("http://127.0.0.1:5050/healthz", "not a public address"),
    ("http://localhost:1138/api/self", "not a public address"),
    ("http://mac-studio.local:5050/", "not a public address"),
    ("http://10.0.0.5/", "not a public address"),
    ("http://192.168.1.2:3000/", "not a public address"),
    ("http://[::1]:1138/", "not a public address"),
    ("file:///etc/passwd", "only http and https"),
    ("ftp://example.com/x", "only http and https"),
    ("https://example.com:8443/", "only the web's ports"),
    ("not a url", "only http and https"),
])
def test_the_studio_and_everything_private_is_refused(url, why):
    ok, reason = web.allowed(url)
    assert ok is False and reason == why


def test_a_public_page_is_allowed():
    ok, _ = web.allowed("https://developer.apple.com/documentation/")
    assert ok is True


def test_read_refuses_and_audits_without_touching_the_network(monkeypatch):
    seen = []
    monkeypatch.setattr(web, "audit", lambda who, action, **d: seen.append((who, action, d)))
    monkeypatch.setattr(web, "_get", lambda *a, **k: (_ for _ in ()).throw(AssertionError("the network was touched")))
    out = web.read("http://127.0.0.1:1138/api/audit", who="claude")
    assert out["ok"] is False and "refused" in out
    assert seen and seen[0][1] == "web.read.refused" and seen[0][0] == "claude"


def test_to_text_drops_scripts_and_keeps_the_words():
    title, text = web.to_text(b"<html><head><title>launchctl(1)</title><style>x{}</style></head><body><script>evil()</script>"
                              b"<h1>bootout</h1><p>Unloads a service.</p><div>Second&nbsp;line</div></body></html>")
    assert title == "launchctl(1)"
    assert "evil" not in text and "x{}" not in text
    assert "bootout" in text and "Unloads a service." in text and "Second" in text


def test_search_results_are_parsed_from_duckduckgo_html_and_unwrapped():
    page = ('<div class="result"><a class="result__a" href="//duckduckgo.com/l/?uddg=https%3A%2F%2Fexample.com%2Fa&amp;rut=1">Example A</a>'
            '<a class="result__snippet" href="x">the snippet</a></div>'
            '<div class="result"><a class="result__a" href="http://127.0.0.1:1138/">Inside</a><a class="result__snippet">nope</a></div>')
    p = web._Results()
    p.feed(page)
    assert p.items[0]["url"] == "https://example.com/a" and p.items[0]["title"] == "Example A" and p.items[0]["snippet"] == "the snippet"
    assert [it for it in p.items if web.allowed(it["url"])[0]] == [p.items[0]]


def test_read_caps_the_text(monkeypatch):
    monkeypatch.setattr(web, "_get", lambda url, timeout=15, data=None: b"<p>" + b"word " * 20000 + b"</p>")
    out = web.read("https://example.com/long", chars=800)
    assert out["ok"] and len(out["text"]) <= 800 and out["truncated"] is True
