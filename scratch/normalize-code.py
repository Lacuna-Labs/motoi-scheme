#!/usr/bin/env python3
"""normalize-code.py — reformat every :code block in the reference in place.

Pluck each :code "…" string, enumerate it (file#N), pretty-print it through the
SAME formatter slat2md uses (slat2md.pp), verify the reshaping is byte-safe via a
faithful-token round-trip, then splice the multi-line form back into the .slat.

Safety:
  * flat() is patched to re-escape strings faithfully (fixes \\n collapse and the
    embedded-quote break in the stock renderer).
  * A block is only rewritten when faithful_tokens(before) == faithful_tokens(after)
    AND the formatted form actually differs (multi-line). Anything the minimal
    parser would mangle (vectors #(...), quasiquote, named chars) fails the gate
    and is LEFT UNTOUCHED and logged — never corrupted.
  * Originals backed up to scratch/attic/ before any write.
"""
from __future__ import annotations
import sys, re, shutil, datetime, json
from pathlib import Path

REPO = Path('/Users/alfred/code/motoi-scheme')
REF = REPO / 'scheme' / 'reference'
sys.path.insert(0, str(REPO / 'scratch'))
import slat2md  # noqa: E402

# ── patch flat() for faithful string handling ──────────────────────────────
def safe_flat(node):
    if isinstance(node, slat2md.Str):
        v = (node.val.replace('\\', '\\\\').replace('"', '\\"')
             .replace('\n', '\\n').replace('\t', '\\t').replace('\r', '\\r'))
        return '"' + v + '"'
    if isinstance(node, slat2md.Quote):
        return "'" + safe_flat(node.d)
    if isinstance(node, slat2md.Sym):
        return node.name
    return '(' + ' '.join(safe_flat(x) for x in node) + ')'
slat2md.flat = safe_flat  # pp() reads flat as a module global → picks this up

# ── faithful tokenizer (comparison gate only; strings opaque) ───────────────
def faithful_tokens(text):
    toks, i, n = [], 0, len(text)
    while i < n:
        c = text[i]
        if c in ' \t\r\n':
            i += 1; continue
        if c == ';':
            while i < n and text[i] != '\n':
                i += 1
            continue
        if c == '"':
            j = i + 1
            while j < n:
                if text[j] == '\\':
                    j += 2; continue
                if text[j] == '"':
                    break
                j += 1
            toks.append(text[i:j+1]); i = j + 1; continue
        if text[i:i+2] == '#(':
            toks.append('#('); i += 2; continue
        if text[i:i+2] == ',@':
            toks.append(',@'); i += 2; continue
        if c in "()'`,":
            toks.append(c); i += 1; continue
        j = i
        while j < n and text[j] not in ' \t\r\n()";\'`,':
            j += 1
        toks.append(text[i:j]); i = j
    return toks

# ── slat string <-> program text ────────────────────────────────────────────
_DEC = {'n': '\n', 't': '\t', 'r': '\r', '"': '"', '\\': '\\'}
def decode(raw):
    out, i, n = [], 0, len(raw)
    while i < n:
        if raw[i] == '\\' and i + 1 < n:
            out.append(_DEC.get(raw[i+1], raw[i+1])); i += 2; continue
        out.append(raw[i]); i += 1
    return ''.join(out)

def encode(prog):
    # escape backslash + quote; keep newlines LITERAL (that's the whole point)
    return prog.replace('\\', '\\\\').replace('"', '\\"')

def fmt_program(prog):
    forms = slat2md.parse_all(prog)
    return '\n\n'.join(slat2md.pp(f, 0) for f in forms)

# ── find :code "…" spans (returns list of (start,end,raw_inner)) ─────────────
def code_spans(text):
    spans = []
    for m in re.finditer(r':code\s*"', text):
        j = m.end()            # first char inside the string
        k = j
        while k < len(text):
            if text[k] == '\\':
                k += 2; continue
            if text[k] == '"':
                break
            k += 1
        spans.append((j, k, text[j:k]))   # inner raw bytes, exclusive of quotes
    return spans

def process(path, atticdir, log):
    stem = path.stem
    text = path.read_text()
    spans = code_spans(text)
    edits = []            # (start,end,new_raw)
    for idx, (a, b, raw) in enumerate(spans, 1):
        bid = f'{stem}#{idx}'
        prog = decode(raw)
        try:
            newprog = fmt_program(prog)
        except Exception as e:
            log.append({'id': bid, 'status': 'skip-parse-error', 'err': str(e)}); continue
        if newprog == prog:
            log.append({'id': bid, 'status': 'unchanged'}); continue
        if faithful_tokens(prog) != faithful_tokens(newprog):
            log.append({'id': bid, 'status': 'skip-token-mismatch',
                        'code': prog[:120]}); continue
        edits.append((a, b, encode(newprog)))
        log.append({'id': bid, 'status': 'reformatted', 'lines': newprog.count('\n') + 1})
    if not edits:
        return 0
    shutil.copy2(path, atticdir / path.name)
    for a, b, newraw in sorted(edits, key=lambda e: -e[0]):   # right-to-left
        text = text[:a] + newraw + text[b:]
    path.write_text(text)
    return len(edits)

def main():
    targets = sys.argv[1:] or [p.name for p in sorted(REF.glob('*.slat'))
                               if p.name != 'MANIFEST.slat']
    attic = REPO / 'scratch' / 'attic' / ('normalize-code-' +
                                          datetime.date.today().strftime('%Y%m%d'))
    attic.mkdir(parents=True, exist_ok=True)
    log, total = [], 0
    for name in targets:
        path = REF / name if not name.endswith('/') else None
        if path is None or not path.exists():
            print(f'skip missing {name}'); continue
        n = process(path, attic, log)
        total += n
        print(f'{name}: {n} blocks reformatted')
    (REPO / 'scratch' / 'normalize-code-log.json').write_text(json.dumps(log, indent=1))
    skips = [l for l in log if l['status'].startswith('skip')]
    print(f'\nTOTAL reformatted: {total}')
    print(f'blocks: {len(log)}  reformatted: {sum(1 for l in log if l["status"]=="reformatted")}'
          f'  unchanged: {sum(1 for l in log if l["status"]=="unchanged")}'
          f'  skipped: {len(skips)}')
    if skips:
        print('skips ->', json.dumps(skips[:20], indent=1))

if __name__ == '__main__':
    main()
