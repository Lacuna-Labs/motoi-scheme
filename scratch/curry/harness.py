#!/usr/bin/env python3
"""harness.py — Curry's authoring harness for 39-list.slat.

Holds the render + verify pipeline. The verb DATA lives in verbs_*.py.

Pipeline:
  1. collect every code cell from the verb dicts
  2. run each through ./bin/motoi run  -> pre-write pass/fail
  3. render the .slat text with programmatic escaping
  4. re-extract from the WRITTEN file (balanced-paren scan + unescape)
     and run those -> post-round-trip pass/fail
"""

import os, re, subprocess, sys, tempfile

ROOT = '/Users/alfred/code/motoi-scheme'
MOTOI = os.path.join(ROOT, 'bin/motoi')
TARGET = os.path.join(ROOT, 'scheme/reference/39-list.slat')


# ── escaping ────────────────────────────────────────────────────────
def esc(s):
    """Escape a python string into a slat double-quoted string body."""
    if '\\' in s:
        raise ValueError('backslash in payload (unsafe for the naive '
                         'unescapers in scripts/): %r' % s[:80])
    return s.replace('"', '\\"').replace('\n', '\\n')


def unesc(s):
    """Mirror of scripts/compliance-check-runnable.py unescape()."""
    return s.replace(r'\n', '\n').replace(r'\"', '"').replace('\\\\', '\\')


# ── running ─────────────────────────────────────────────────────────
TMP = '/tmp/curry-check.scm'


def run(code, timeout=20):
    with open(TMP, 'w') as f:
        f.write(code)
    try:
        r = subprocess.run([MOTOI, 'run', TMP], capture_output=True,
                           timeout=timeout, cwd=ROOT, text=True)
        return (r.returncode == 0, (r.stdout + r.stderr).strip())
    except subprocess.TimeoutExpired:
        return (False, '<timeout>')
    except Exception as e:  # noqa
        return (False, '<exception: %s>' % e)


# ── code-cell collection ────────────────────────────────────────────
def cells(v):
    """Yield (label, code) for all 15 code cells of a verb dict."""
    for tier, code, _note in v['examples']:
        yield ('examples/%s' % tier, code)
    for row, keys in (('r2', ('eng', 'math', 'cs')),
                      ('r4', ('eng', 'math', 'cs')),
                      ('r5', ('eng', 'math', 'cs'))):
        for k in keys:
            yield ('%s/%s' % (row, k), v[row][k])
    for i, (dom, code) in enumerate(v['r3']['rungs']):
        yield ('r3/rung%d(%s)' % (i + 1, dom[:24]), code)


# ── rendering ───────────────────────────────────────────────────────
def _strlist(xs):
    return ' '.join('"%s"' % esc(x) for x in xs)


def render(v):
    ex = '\n'.join(
        '    (:dialect "motoi" :tier "%s" :code "%s" :note "%s")'
        % (t, esc(c), esc(n)) for (t, c, n) in v['examples'])
    concept, prereqs, progression = v['learn']
    rungs = '\n'.join(
        '             (:domain "%s" :code "%s")' % (esc(d), esc(c))
        for (d, c) in v['r3']['rungs'])
    r2, r3, r4, r5 = v['r2'], v['r3'], v['r4'], v['r5']
    return f'''(verb
  :name "{esc(v['name'])}" :std "SRFI-1"
  :library "list"
  :tier "{v.get('vtier', 'core')}"
  :kind "pure"
  :signature "{esc(v['signature'])}"
  :summary "{esc(v['summary'])}"
  :explanation "{esc(v['explanation'])}"
  :examples (
{ex}
  )
  :caveats ({_strlist(v['caveats'])})
  :usecases ({_strlist(v['usecases'])})
  :related ({_strlist(v['related'])})
  :learn (:concept "{esc(concept)}" :prerequisites ({_strlist(prereqs)}) :progression "{esc(progression)}")
  :provenance "{esc(v['provenance'])}"
  :row-2-audit (
    (:eng-program "{esc(r2['eng'])}"
     :math-program "{esc(r2['math'])}"
     :cs-program "{esc(r2['cs'])}"
     :problem "{esc(r2['problem'])}"
     :explanation "{esc(r2['explanation'])}"
     :meta "{esc(r2['meta'])}")
    (:eng "{esc(r2['c_eng'])}"
     :math "{esc(r2['c_math'])}"
     :cs "{esc(r2['c_cs'])}")
)
  :row-3-dimension (
    (:setup "{esc(r3['setup'])}"
     :rungs (
{rungs}
     )
     :explanation "{esc(r3['explanation'])}"
     :meta "{esc(r3['meta'])}")
    (:eng "{esc(r3['c_eng'])}"
     :math "{esc(r3['c_math'])}"
     :cs "{esc(r3['c_cs'])}")
)
  :row-4-proof (
    (:eng-program "{esc(r4['eng'])}"
     :math-program "{esc(r4['math'])}"
     :cs-program "{esc(r4['cs'])}"
     :claim "{esc(r4['claim'])}"
     :invariant "{esc(r4['invariant'])}"
     :meta "{esc(r4['meta'])}")
    (:eng "{esc(r4['c_eng'])}"
     :math "{esc(r4['c_math'])}"
     :cs "{esc(r4['c_cs'])}")
)
  :row-5-emergence (
    (:eng-composition "{esc(r5['eng'])}"
     :math-composition "{esc(r5['math'])}"
     :cs-composition "{esc(r5['cs'])}"
     :base "{esc(r5['base'])}"
     :emergent "{esc(r5['emergent'])}"
     :meta "{esc(r5['meta'])}")
    (:eng "{esc(r5['c_eng'])}"
     :math "{esc(r5['c_math'])}"
     :cs "{esc(r5['c_cs'])}")
)
)
'''


# ── post-write re-extraction (independent of the data) ──────────────
def extract_records(text, tag='(verb'):
    records, i, n = [], 0, len(text)
    while i < n:
        if (i == 0 or text[i - 1] == '\n') and text.startswith(tag, i):
            start, depth, in_str, esc_, j = i, 0, False, False, i
            while j < n:
                c = text[j]
                if in_str:
                    if esc_: esc_ = False
                    elif c == '\\': esc_ = True
                    elif c == '"': in_str = False
                else:
                    if c == '"': in_str = True
                    elif c == '(': depth += 1
                    elif c == ')':
                        depth -= 1
                        if depth == 0:
                            j += 1
                            break
                j += 1
            records.append(text[start:j])
            i = j
        else:
            i += 1
    return records


CODE_FIELDS = ['eng-program', 'math-program', 'cs-program',
               'eng-composition', 'math-composition', 'cs-composition',
               'code']


def reextract(path, only_names=None):
    """Return [(verb, field, code)] for every code cell in the file."""
    text = open(path).read()
    out = []
    for rec in extract_records(text):
        m = re.search(r':name\s+"([^"]+)"', rec)
        name = m.group(1) if m else '<unnamed>'
        if only_names is not None and name not in only_names:
            continue
        for field in CODE_FIELDS:
            for mm in re.finditer(r':%s\s+"((?:[^"\\]|\\.)*)"' % field, rec):
                out.append((name, field, unesc(mm.group(1))))
    return out
