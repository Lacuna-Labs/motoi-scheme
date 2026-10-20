#!/usr/bin/env python3
"""render-theme.py — render the house-formatted Scheme sampler under every theme
in themes.json, as one contact-sheet HTML page, for a true-color screenshot.
One theme definition; theme change flips all surfaces (terminal · REPL · docs)."""
import sys, html, re, json
from pathlib import Path
sys.path.insert(0, 'scratch')
import slat2md

def sf(node):
    if isinstance(node, slat2md.Str):
        v = (node.val.replace('\\', '\\\\').replace('"', '\\"')
             .replace('\n', '\\n').replace('\t', '\\t'))
        return '"' + v + '"'
    if isinstance(node, slat2md.Quote):
        return "'" + sf(node.d)
    if isinstance(node, slat2md.Sym):
        return node.name
    return '(' + ' '.join(sf(x) for x in node) + ')'
slat2md.flat = sf

def fmt(prog):
    return '\n\n'.join(slat2md.pp(f, 0) for f in slat2md.parse_all(prog))

SPECIAL = {'begin','let','let*','letrec','lambda','if','cond','define','and','or',
           'when','unless','loop','map','for-each','case','do','quote','else','set!'}
PRIM = {'car','cdr','cons','list','length','null?','list?','number?','pair?','not',
        'eq?','equal?','append','reverse','apply','vector','display','newline','+',
        '-','*','/','=','<','>','<=','>=','modulo','abs','min','max','zero?','even?','odd?'}
NUM = re.compile(r'^[+-]?(\d+\.?\d*|\.\d+)(/\d+)?$')

def highlight(code, T):
    def span(txt, color, ital=False):
        st = f'color:{color}' + (';font-style:italic' if ital else '')
        return f'<span style="{st}">{html.escape(txt)}</span>'
    out, i, n, depth = [], 0, len(code), 0
    quoted = False
    while i < n:
        c = code[i]
        if c in ' \n\t':
            out.append(c); i += 1; continue
        if c == ';':
            j = code.find('\n', i); j = n if j < 0 else j
            out.append(span(code[i:j], T['comment'], True)); i = j; continue
        if c == '"':
            j = i + 1
            while j < n:
                if code[j] == '\\': j += 2; continue
                if code[j] == '"': break
                j += 1
            out.append(span(code[i:j+1], T['lit'])); i = j + 1; continue
        if c == '(':
            out.append(span('(', T['parens'][depth % 3])); depth += 1; i += 1; continue
        if c == ')':
            depth = max(0, depth - 1); out.append(span(')', T['parens'][depth % 3])); i += 1; continue
        if c == "'":
            out.append(span("'", T['quote'])); quoted = True; i += 1; continue
        j = i
        while j < n and code[j] not in ' \n\t()";\'':
            j += 1
        tok = code[i:j]; i = j
        if quoted: col = T['quote']; quoted = False
        elif tok in ('#t', '#f'): col = T['bool']
        elif tok.startswith(':'): col = T['kw']
        elif NUM.match(tok): col = T['lit']
        elif '/' in tok: col = T['verb']
        elif tok in SPECIAL: col = T['special']
        elif tok in PRIM: col = T['prim']
        else: col = T['deflt']
        out.append(span(tok, col))
    return ''.join(out)

PROGRAMS = [
    "(begin (animation/clear!) (motion/move-to (list 'star 0 0) (list 9 0)) (let loop ((n 0)) (if (< n 5) (begin (animation/tick) (loop (+ n 1))) (length (animation/tweens)))))",
    "(list (null? (animation/tweens)) (number? (animation/tick)) #t #f)",
]

def panel(key, T):
    blocks = ''.join(
        f'<pre style="background:{T["panel"]};border:1px solid {T["border"]};'
        f'border-radius:9px;padding:14px 16px;margin:0 0 10px;font-size:13.5px;'
        f'line-height:1.55;color:{T["deflt"]};white-space:pre;overflow-x:auto">'
        f'{highlight(fmt(p), T)}</pre>'
        for p in PROGRAMS)
    return f'''<div style="background:{T['bg']};border-radius:14px;padding:20px 22px">
      <div style="color:{T['heading']};font-size:15px;font-weight:600">{T['label']}</div>
      <div style="color:{T['muted']};font-size:11px;margin:0 0 14px">{T['role']}</div>
      {blocks}</div>'''

def main():
    data = json.loads(Path('scratch/themes.json').read_text())['themes']
    order = ['motoi-dusk', 'motoi-bloom', 'grayscale', 'hacker', 'none']
    panels = ''.join(panel(k, data[k]) for k in order)
    page = f'''<!doctype html><html><head><meta charset="utf-8"><style>
      body {{ background:#2A2A32; margin:0; padding:26px;
              font-family:Menlo,"SF Mono",monospace; }}
      h1 {{ color:#E8E8F0; font-size:20px; margin:0 0 3px; }}
      .sub {{ color:#8A8A9A; font-size:12px; margin:0 0 20px; }}
      .grid {{ display:grid; grid-template-columns:1fr 1fr; gap:16px; }}
    </style></head><body>
      <h1>Motoi Scheme — 5 unified themes</h1>
      <p class="sub">one theme switch flips every surface: terminal · REPL · docs · renderer. red reserved for booleans.</p>
      <div class="grid">{panels}</div>
    </body></html>'''
    Path('scratch/themes-preview.html').write_text(page)
    print('scratch/themes-preview.html')

if __name__ == '__main__':
    main()
