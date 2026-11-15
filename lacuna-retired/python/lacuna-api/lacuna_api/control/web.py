"""THE WEB — Lacuna may look things up (his, 2026-09-25: "let lacuna search the web also").

Two READ tools, standard library only: `web_search` (DuckDuckGo's HTML endpoint, parsed with html.parser — no key, no
SDK) and `read_page` (one page, as text, capped). Both are outbound and both are jailed the same way as everything
else the model touches:
  · never loopback, never a private range, never a non-http(s) scheme — the model cannot use a page fetch to reach
    :5050, :5051, :1138 or the tunnel from the inside (SSRF), and a redirect is checked hop by hop;
  · at most READ_CAP bytes of a page, as text (scripts, styles and tags stripped), and at most RESULTS results;
  · every call is audited with the query or the URL. Nothing here writes.
"""
from __future__ import annotations

import html
import ipaddress
import re
import socket
import urllib.error
import urllib.parse
import urllib.request
from html.parser import HTMLParser

from .core import audit

RESULTS = 6
READ_CAP = 200_000
UA = "Mozilla/5.0 (Macintosh) Lacuna/1.0 (+the Studio's control plane; reads pages for its operator)"
SEARCH = "https://lite.duckduckgo.com/lite/"   # the html endpoint answers a challenge page from here; lite answers results


def _private(host: str) -> bool:
    """True when the host is loopback, link-local, private or otherwise not a public address (any answer counts)."""
    h = (host or "").strip("[]").lower()
    if not h or h in ("localhost",) or h.endswith(".local") or h.endswith(".internal"):
        return True
    try:
        infos = socket.getaddrinfo(h, None)
    except socket.gaierror:
        return True
    for info in infos:
        try:
            ip = ipaddress.ip_address(info[4][0])
        except ValueError:
            return True
        if ip.is_private or ip.is_loopback or ip.is_link_local or ip.is_reserved or ip.is_multicast or ip.is_unspecified:
            return True
    return False


def allowed(url: str) -> tuple[bool, str]:
    """(ok, why) — the one rule every outbound URL passes through."""
    try:
        u = urllib.parse.urlsplit(url)
    except ValueError:
        return False, "not a URL"
    if u.scheme not in ("http", "https"):
        return False, "only http and https"
    if not u.hostname:
        return False, "no host"
    if _private(u.hostname):
        return False, "not a public address"
    if u.port not in (None, 80, 443):
        return False, "only the web's ports"
    return True, ""


class _NoRedirect(urllib.request.HTTPRedirectHandler):
    """Every hop is checked by `allowed` — a public page may not bounce the fetch into the Studio."""
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        ok, why = allowed(newurl)
        if not ok:
            raise urllib.error.URLError(f"redirect refused: {why}")
        return super().redirect_request(req, fp, code, msg, headers, newurl)


_opener = urllib.request.build_opener(_NoRedirect())


def _get(url: str, timeout: float = 12, data: bytes | None = None) -> bytes:
    ok, why = allowed(url)
    if not ok:
        raise ValueError(why)
    req = urllib.request.Request(url, data=data, headers={"User-Agent": UA, "Accept": "text/html,application/xhtml+xml,text/plain;q=0.9,*/*;q=0.5"})
    with _opener.open(req, timeout=timeout) as r:
        ctype = (r.headers.get("Content-Type") or "").lower()
        if not any(t in ctype for t in ("text/", "html", "xml", "json")):
            raise ValueError(f"not a text page ({ctype.split(';')[0] or 'unknown type'})")
        return r.read(READ_CAP + 1)


class _Text(HTMLParser):
    """The page's words: block tags become line breaks; scripts, styles and hidden things are dropped."""
    SKIP = {"script", "style", "noscript", "template", "svg", "head"}
    BLOCK = {"p", "div", "br", "li", "h1", "h2", "h3", "h4", "h5", "h6", "tr", "section", "article", "pre", "blockquote", "hr", "dt", "dd"}

    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.out: list[str] = []
        self.skip = 0
        self.title = ""
        self._in_title = False

    def handle_starttag(self, tag, attrs):
        if tag in self.SKIP:
            self.skip += 1
        if tag == "title":
            self._in_title = True
        if tag in self.BLOCK:
            self.out.append("\n")

    def handle_endtag(self, tag):
        if tag in self.SKIP and self.skip:
            self.skip -= 1
        if tag == "title":
            self._in_title = False
        if tag in self.BLOCK:
            self.out.append("\n")

    def handle_data(self, data):
        if self._in_title:
            self.title += data
        if not self.skip:
            self.out.append(data)


def to_text(raw: bytes | str) -> tuple[str, str]:
    """(title, text) — whitespace folded, blank runs collapsed."""
    s = raw.decode("utf-8", "replace") if isinstance(raw, bytes) else raw
    p = _Text()
    try:
        p.feed(s)
    except Exception:
        pass
    text = "".join(p.out)
    text = re.sub(r"[ \t\r\f\v]+", " ", text)
    text = re.sub(r"\n\s*\n+", "\n\n", text).strip()
    return p.title.strip(), text


class _Results(HTMLParser):
    """DuckDuckGo's results, lite (`a.result-link`, `td.result-snippet`) or html (`a.result__a`, `.result__snippet`)."""
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.items: list[dict] = []
        self._cur: dict | None = None
        self._field: str | None = None

    def handle_starttag(self, tag, attrs):
        a = dict(attrs)
        cls = a.get("class") or ""
        if tag == "a" and ("result__a" in cls or "result-link" in cls):
            self._cur = {"title": "", "url": _unwrap(a.get("href") or ""), "snippet": ""}
            self._field = "title"
        elif ("result__snippet" in cls or "result-snippet" in cls) and self._cur is not None:
            self._field = "snippet"

    def handle_endtag(self, tag):
        if self._field == "title" and tag == "a":
            self._field = None
        elif self._field == "snippet" and tag in ("a", "div", "td"):
            self._field = None
            if self._cur and self._cur["url"]:
                self.items.append({k: v.strip() for k, v in self._cur.items()})
            self._cur = None

    def handle_data(self, data):
        if self._cur is not None and self._field:
            self._cur[self._field] += data


def _unwrap(href: str) -> str:
    """DuckDuckGo wraps results as //duckduckgo.com/l/?uddg=<url>&…; the real URL is inside."""
    if href.startswith("//"):
        href = "https:" + href
    u = urllib.parse.urlsplit(href)
    if "duckduckgo.com" in (u.hostname or "") and u.path.startswith("/l/"):
        q = urllib.parse.parse_qs(u.query)
        return (q.get("uddg") or [""])[0]
    return href


def search(query: str, who: str = "lacuna", limit: int = RESULTS) -> dict:
    q = (query or "").strip()[:200]
    if not q:
        return {"ok": False, "why": "an empty query"}
    audit(who, "web.search", query=q)
    try:
        raw = _get(SEARCH + "?" + urllib.parse.urlencode({"q": q}), timeout=12)
    except Exception as e:
        return {"ok": False, "why": f"the search did not answer: {e.__class__.__name__}: {str(e)[:120]}"}
    p = _Results()
    try:
        p.feed(raw.decode("utf-8", "replace"))
    except Exception:
        pass
    items = [it for it in p.items if allowed(it["url"])[0]][:max(1, min(int(limit or RESULTS), 10))]
    return {"ok": True, "query": q, "results": items, "note": "read_page(url) reads one of these as text"}


def read(url: str, who: str = "lacuna", chars: int = 6000) -> dict:
    ok, why = allowed(url or "")
    if not ok:
        audit(who, "web.read.refused", url=(url or "")[:300], why=why)
        return {"ok": False, "refused": why}
    audit(who, "web.read", url=url[:300])
    try:
        raw = _get(url, timeout=15)
    except Exception as e:
        return {"ok": False, "why": f"could not read it: {e.__class__.__name__}: {str(e)[:120]}"}
    title, text = to_text(raw)
    cap = max(500, min(int(chars or 6000), 20000))
    return {"ok": True, "url": url, "title": title[:200], "text": text[:cap], "truncated": len(text) > cap or len(raw) > READ_CAP}
