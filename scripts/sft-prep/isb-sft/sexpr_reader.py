"""Proper SLAT s-expression reader — string-aware, comment-aware, nested-safe.

Replaces the fragile regex extraction in the prior emit_sft.py which lost
everything after the first `:code` field in multi-example verbs.

Public API:
    iter_top_level_forms(path, prefix) → yields raw (form ...) strings
    read_field(raw, key) → single-value field extractor
    read_field_list_strings(raw, key) → list-of-strings field extractor
    read_field_form(raw, key) → nested-form field (returns raw text)
    iter_records_in_list(raw_list) → sub-records inside a list field
"""
from __future__ import annotations

import re
from pathlib import Path
from typing import Iterator


def _paren_scan(text: str, start_idx: int) -> tuple[int, bool]:
    if text[start_idx] != "(":
        return start_idx, False
    depth = 0
    in_string = False
    i = start_idx
    n = len(text)
    while i < n:
        c = text[i]
        if in_string:
            if c == "\\" and i + 1 < n:
                i += 2
                continue
            if c == '"':
                in_string = False
            i += 1
            continue
        if c == '"':
            in_string = True
            i += 1
            continue
        if c == ";":
            eol = text.find("\n", i)
            if eol == -1:
                return n, False
            i = eol + 1
            continue
        if c == "(":
            depth += 1
        elif c == ")":
            depth -= 1
            if depth == 0:
                return i + 1, True
        i += 1
    return n, False


def iter_top_level_forms(path: Path, prefix: str = "(") -> Iterator[str]:
    """Yield each top-level (form ...) as raw string. prefix filters head symbol."""
    text = path.read_text(encoding="utf-8", errors="replace")
    n = len(text)
    i = 0
    want = prefix[1:] if prefix.startswith("(") else prefix
    while i < n:
        while i < n and text[i] in " \t\n\r":
            i += 1
        if i >= n:
            break
        if text[i] == ";":
            eol = text.find("\n", i)
            i = n if eol == -1 else eol + 1
            continue
        if text[i] != "(":
            i += 1
            continue
        actual_start = i + 1
        while actual_start < n and text[actual_start] in " \t\n\r":
            actual_start += 1
        if want:
            candidate = text[actual_start : actual_start + len(want)]
            end_char_pos = actual_start + len(want)
            end_char = text[end_char_pos : end_char_pos + 1]
            if candidate != want or (end_char and end_char not in " \t\n\r()"):
                end_idx, ok = _paren_scan(text, i)
                i = end_idx if ok else i + 1
                continue
        end_idx, ok = _paren_scan(text, i)
        if not ok:
            break
        yield text[i:end_idx]
        i = end_idx


def read_field(raw: str, key: str) -> str | None:
    m = re.search(rf':{re.escape(key)}\s+"((?:[^"\\]|\\.)*)"', raw)
    if m:
        return m.group(1).replace('\\"', '"').replace("\\n", "\n").replace("\\t", "\t")
    m = re.search(rf":{re.escape(key)}\s+([^\s\(\)]+)", raw)
    if m:
        return m.group(1)
    return None


def read_field_list_strings(raw: str, key: str) -> list[str]:
    m = re.search(rf":{re.escape(key)}\s+\(", raw)
    if not m:
        return []
    start = m.end() - 1
    end, ok = _paren_scan(raw, start)
    if not ok:
        return []
    inner = raw[start + 1 : end - 1]
    return [
        s.replace('\\"', '"').replace("\\n", "\n")
        for s in re.findall(r'"((?:[^"\\]|\\.)*)"', inner)
    ]


def read_field_form(raw: str, key: str) -> str | None:
    m = re.search(rf":{re.escape(key)}\s+\(", raw)
    if not m:
        return None
    start = m.end() - 1
    end, ok = _paren_scan(raw, start)
    if not ok:
        return None
    return raw[start:end]


def iter_records_in_list(raw_list: str) -> Iterator[str]:
    if not raw_list or raw_list[0] != "(":
        return
    inner = raw_list[1:-1]
    n = len(inner)
    i = 0
    in_string = False
    while i < n:
        c = inner[i]
        if in_string:
            if c == "\\" and i + 1 < n:
                i += 2
                continue
            if c == '"':
                in_string = False
            i += 1
            continue
        if c == '"':
            in_string = True
            i += 1
            continue
        if c == "(":
            end, ok = _paren_scan(inner, i)
            if not ok:
                break
            yield inner[i:end]
            i = end
            continue
        i += 1


if __name__ == "__main__":
    import sys
    if len(sys.argv) != 2:
        print("usage: sexpr_reader.py <file.slat>")
        sys.exit(1)
    p = Path(sys.argv[1])
    for kind in ("(verb", "(node", "(chapter"):
        forms = list(iter_top_level_forms(p, prefix=kind))
        if forms:
            print(f"found {len(forms)} {kind[1:]} forms in {p.name}")
            v = forms[0]
            for k in ("name", "canonical", "title", "contract", "definition"):
                val = read_field(v, k)
                if val:
                    print(f"  first :{k} = {val[:80]!r}")
            for k in ("examples", "caveats", "related"):
                form = read_field_form(v, k)
                if form:
                    recs = list(iter_records_in_list(form))
                    print(f"  first :{k} has {len(recs)} sub-records")
            break
