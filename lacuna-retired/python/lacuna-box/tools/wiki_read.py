"""wiki_read.py QUERY — the offline Wikipedia (Kiwix ZIM in ~/.lacuna/library): the top titles and the best article as plain
text, JSON on stdout. Run by the chat's `wiki` tool in openzim-mcp's own Python (libzim)."""
import html, json, re, sys
from libzim.reader import Archive
from libzim.search import Query, Searcher
ZIM = "/Users/alfred/.lacuna/library/wikipedia_en-simple_all_maxi_2026-09.zim"
q = " ".join(sys.argv[1:]).strip()
z = Archive(ZIM)
paths = list(Searcher(z).search(Query().set_query(q)).getResults(0, 5))
out = {"ok": bool(paths), "query": q, "titles": [], "article": None}
for p in paths:
    try:
        out["titles"].append(z.get_entry_by_path(p).title)
    except Exception:
        pass
if paths:
    e = z.get_entry_by_path(paths[0])
    raw = bytes(e.get_item().content).decode("utf-8", "replace")
    raw = re.sub(r"(?is)<(script|style|table|sup)[^>]*>.*?</\1>", " ", raw)
    text = html.unescape(re.sub(r"<[^>]+>", " ", raw))
    text = re.sub(r"[ \t]+", " ", re.sub(r"\n\s*\n+", "\n", text)).strip()
    out["article"] = {"title": e.title, "text": text[:6000]}
print(json.dumps(out))
