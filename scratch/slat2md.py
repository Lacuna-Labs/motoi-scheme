#!/usr/bin/env python3
"""slat2md.py — deterministic Slat reference chapter -> beautiful Markdown.

Implements scratch/slat-md-presentation-spec.md. Scheme is pretty-printed by a
fixed algorithm (never hand-formatted), programs are executed through bin/motoi
so `; => value` annotations are truthful, and the page layout follows the spec.

Usage:  python3 scratch/slat2md.py scheme/reference/04-animation.slat [out.md]
"""
from __future__ import annotations
import sys, subprocess
from pathlib import Path

REPO = Path('/Users/alfred/code/motoi-scheme')
MOTOI = str(REPO / 'bin' / 'motoi')
WIDTH = 56

# ─────────────────────────── reader (slat IS s-expressions) ───────────────────────────
class Sym:
    __slots__ = ('name',)
    def __init__(self, name): self.name = name
class Str:
    __slots__ = ('val',)
    def __init__(self, val): self.val = val
class Quote:
    __slots__ = ('d',)
    def __init__(self, d): self.d = d

def tokenize(text):
    toks, i, n = [], 0, len(text)
    while i < n:
        c = text[i]
        if c in ' \t\r\n':
            i += 1; continue
        if c == ';':
            while i < n and text[i] != '\n': i += 1
            continue
        if c == '"':
            j, out = i + 1, []
            while j < n:
                d = text[j]
                if d == '\\':
                    nxt = text[j+1] if j+1 < n else ''
                    out.append({'n':'\n','t':'\t','r':'\r','"':'"','\\':'\\'}.get(nxt, nxt))
                    j += 2; continue
                if d == '"': break
                out.append(d); j += 1
            toks.append(('str', ''.join(out))); i = j + 1; continue
        if c in '()':
            toks.append((c, c)); i += 1; continue
        if c == "'":
            toks.append(("'", "'")); i += 1; continue
        j = i
        while j < n and text[j] not in ' \t\r\n()";':
            j += 1
        toks.append(('atom', text[i:j])); i = j
    return toks

def parse_all(text):
    toks = tokenize(text); pos = [0]
    def parse():
        t = toks[pos[0]]
        if t[0] == '(':
            pos[0] += 1; lst = []
            while toks[pos[0]][0] != ')':
                lst.append(parse())
            pos[0] += 1
            return lst
        if t[0] == "'":
            pos[0] += 1; return Quote(parse())
        if t[0] == 'str':
            pos[0] += 1; return Str(t[1])
        pos[0] += 1; return Sym(t[1])
    forms = []
    while pos[0] < len(toks):
        forms.append(parse())
    return forms

def plist(lst):
    """A slat form: (head :k v :k v ...). Return (head_syms, dict)."""
    d, i, heads = {}, 0, []
    while i < len(lst):
        el = lst[i]
        if isinstance(el, Sym) and el.name.startswith(':'):
            d[el.name[1:]] = lst[i+1] if i+1 < len(lst) else None
            i += 2
        else:
            heads.append(el); i += 1
    return heads, d

def s(node):
    return node.val if isinstance(node, Str) else (node.name if isinstance(node, Sym) else '')

# ─────────────────────────── scheme pretty-printer (spec §D) ───────────────────────────
BODY = {'begin':0, 'define':1, 'lambda':1, 'let*':1, 'letrec':1, 'when':1, 'unless':1}
ALIGN = {'if', 'and', 'or', 'cond', 'map', 'for-each'}

def flat(node):
    if isinstance(node, Sym): return node.name
    if isinstance(node, Str): return '"' + node.val + '"'
    if isinstance(node, Quote): return "'" + flat(node.d)
    return '(' + ' '.join(flat(x) for x in node) + ')'

def opname(node):
    return node[0].name if node and isinstance(node[0], Sym) else None

def pp(node, col):
    if isinstance(node, Quote):
        inner = pp(node.d, col + 1)
        return "'" + inner
    if not isinstance(node, list):
        return flat(node)
    f = flat(node)
    if col + len(f) <= WIDTH and '\n' not in f:
        return f
    if not node:
        return '()'
    op = opname(node)
    # header-datum count
    if op in BODY:
        special = BODY[op]; style = 'body'
    elif op == 'let':
        named = len(node) > 1 and isinstance(node[1], Sym)
        special = 2 if named else 1; style = 'body'
    else:
        special = 1; style = 'align'   # if/and/or/cond/map + every call

    if style == 'body':
        head = node[:1 + special]
        body = node[1 + special:]
        head_line = '(' + ' '.join(flat(h) for h in head)
        ind = ' ' * (col + 2)
        lines = [head_line]
        for b in body:
            lines.append(ind + pp(b, col + 2))
        return '\n'.join(lines) + ')'
    else:
        if len(node) == 1:
            return '(' + flat(node[0]) + ')'
        acol = col + 1 + len(flat(node[0])) + 1
        first = pp(node[1], acol)
        head_line = '(' + flat(node[0]) + ' ' + first
        ind = ' ' * acol
        lines = [head_line]
        for rest in node[2:]:
            lines.append(ind + pp(rest, acol))
        return '\n'.join(lines) + ')'

def run(code, timeout=15):
    try:
        r = subprocess.run([MOTOI, 'run', '/dev/stdin'], input=code,
                           capture_output=True, text=True, timeout=timeout)
        return r.returncode, (r.stdout or '').strip(), (r.stderr or '').strip()
    except subprocess.TimeoutExpired:
        return -1, '', 'timeout'

def block(code_text):
    """Pretty-print (possibly multi top-level-form) code, run it, annotate result."""
    forms = parse_all(code_text)
    pretty = '\n\n'.join(pp(fm, 0) for fm in forms)
    rc, out, err = run(code_text)
    ann = ''
    if rc == 0 and out and '\n' not in out and len(out) <= 40:
        ann = f'\n; ⇒ {out}'
    ok = (rc == 0 and 'error' not in (err + out).lower())
    return f'```scheme\n{pretty}{ann}\n```', ok

# ─────────────────────────── md emitter (spec §C/§E) ───────────────────────────
KIND_GLOSS = {'pure': 'pure (no mutation)', 'state-change': 'state-change (mutates)'}
ROW_SUB = {
    2: 'Audit — reach for the right verb',
    3: 'Dimension — the same idea across engineering · maths · CS',
    4: 'Proof — the invariant that always holds',
    5: 'Emergence — what it composes into',
}

def emit(chapter_path):
    text = Path(chapter_path).read_text()
    forms = parse_all(text)
    verbs, chapter = [], {}
    for fm in forms:
        if not isinstance(fm, list) or not fm: continue
        h = opname(fm)
        if h == 'chapter':
            _, chapter = plist(fm)
        elif h == 'verb':
            _, d = plist(fm)
            verbs.append(d)

    lib = s(chapter.get('library'))
    num = s(chapter.get('number'))
    out, green, total = [], 0, 0

    out.append(f'# Chapter {num} · `{lib}`\n')
    out.append('**The tween lifecycle — a value moving through time.**  ')
    out.append(f'_Motoi Scheme Reference · {len(verbs)} verbs · '
               f'rendered by `slat2md.py` (spec: `slat-md-presentation-spec.md`)_\n')
    out.append('---\n')
    # verb index
    out.append('### Verbs in this chapter\n')
    out.append('| # | verb | kind | summary |')
    out.append('|---|------|------|---------|')
    for i, v in enumerate(verbs, 1):
        out.append(f"| {i} | `{s(v.get('name'))}` | {s(v.get('kind'))} | "
                   f"{s(v.get('summary')).split('.')[0]}. |")
    out.append('\n---\n')

    for i, v in enumerate(verbs, 1):
        name = s(v.get('name')); kind = s(v.get('kind'))
        out.append(f'## {i} · `{name}`\n')
        out.append(f'> {s(v.get("summary"))}\n')
        out.append('| | |')
        out.append('|---|---|')
        out.append(f"| **signature** | `{s(v.get('signature'))}` |")
        out.append(f"| **kind** | {KIND_GLOSS.get(kind, kind)} |")
        out.append(f"| **tier** | {s(v.get('tier'))} |")
        out.append(f"| **std** | {s(v.get('std'))} |")
        out.append('')

        # Row 1 — examples
        out.append('### Row 1 · Examples — novice → intermediate → expert\n')
        exs = v.get('examples') or []
        for ex in exs:
            _, e = plist(ex)
            b, ok = block(s(e.get('code'))); total += 1; green += ok
            out.append(f"**{s(e.get('tier'))}**")
            out.append(b)
            out.append(f"*{s(e.get('note'))}*\n")

        # Rows 2-5
        for rk, key in ((2, 'row-2-audit'), (3, 'row-3-dimension'),
                        (4, 'row-4-proof'), (5, 'row-5-emergence')):
            val = v.get(key)
            if not val: continue
            prog, prose = plist(val[0])[1], plist(val[1])[1] if len(val) > 1 else {}
            out.append(f'### Row {rk} · {ROW_SUB[rk]}\n')
            if rk == 3:
                out.append(f"{s(prog.get('setup'))}\n")
                for rung in (prog.get('rungs') or []):
                    _, rd = plist(rung)
                    b, ok = block(s(rd.get('code'))); total += 1; green += ok
                    out.append(f"**{s(rd.get('domain'))}**"); out.append(b); out.append('')
            else:
                trip = [('eng-program', 'eng'), ('math-program', 'math'), ('cs-program', 'cs')] \
                    if rk in (2, 4) else \
                    [('eng-composition', 'eng'), ('math-composition', 'math'), ('cs-composition', 'cs')]
                for pk, label in trip:
                    if prog.get(pk) is None: continue
                    b, ok = block(s(prog.get(pk))); total += 1; green += ok
                    out.append(f"**{label}**"); out.append(b); out.append('')
                if rk == 2:
                    out.append(f"- **problem:** {s(prog.get('problem'))}")
                    out.append(f"- **meta:** {s(prog.get('meta'))}\n")
                if rk == 4:
                    out.append(f"- **claim:** {s(prog.get('claim'))}")
                    out.append(f"- **invariant:** `{s(prog.get('invariant'))}`\n")
                if rk == 5:
                    out.append(f"- **emergent:** {s(prog.get('emergent'))} "
                               f"_{s(prog.get('meta'))}_\n")
        out.append('---\n')

    out.append(f'_All {total} embedded programs verified: **{green}/{total} green** '
               f'via `node bin/motoi run /dev/stdin`._')
    return '\n'.join(out), green, total

if __name__ == '__main__':
    src = sys.argv[1]
    md, green, total = emit(src)
    dst = sys.argv[2] if len(sys.argv) > 2 else \
        str(REPO / 'scratch' / (Path(src).stem + '.md'))
    Path(dst).write_text(md)
    print(f'{green}/{total} green -> {dst}')
