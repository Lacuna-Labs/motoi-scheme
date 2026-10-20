#!/usr/bin/env python3
"""fix-weh-to-guard-2026-08-03.py — retire `with-exception-handler`-as-a-catch.

2026-08-03: `raise` became non-continuable in `lib/base/r7rs-small.js`, which is
what R7RS-small §6.11 has always said and what chibi-scheme does. The handler is
called for effect; if it RETURNS, a secondary exception is raised. Its value is
no longer the value of `with-exception-handler`.

The reference had been using that (wrong) return value as its everyday "catch a
condition and produce a value" idiom. Every such snippet now raises instead of
answering. The R7RS verb for that job is `guard`, which Motoi has and which
works. This rewrites the idiom, mechanically and exact-match only.

Two shapes are rewritten:

  T1  escaping handler (correct R7RS, but `guard` says it in one line)
      (call-with-current-continuation
        (lambda (K) (with-exception-handler (lambda (E) (K RESULT))
                                            (lambda () BODY ...))))
      -> (guard (E (#t RESULT)) BODY ...)
      Only when the handler body is EXACTLY one call to K and K is referenced
      nowhere else in the form. Anything cleverer, a human reads.

  T2  returning handler (the broken idiom)
      (with-exception-handler (lambda (E) BODY ...) (lambda () THUNK ...))
      -> (guard (E (#t BODY ...)) THUNK ...)

NEVER rewritten, and reported instead of guessed at:
  - any form mentioning `raise-continuable` — its handler's value genuinely does
    come back to the raise point, so the form is correct as written
  - records whose :name is a skip-listed verb (the ones that must keep TEACHING
    with-exception-handler); those are hand-authored
  - a handler or thunk that is not a literal `lambda` (e.g. passed by variable)

Re-runnable: a file already converted yields 0 rewrites on a second pass.

Usage:
    python3 scratch/fix-weh-to-guard-2026-08-03.py --report            # survey only
    python3 scratch/fix-weh-to-guard-2026-08-03.py --write CHAPTER...  # edit in place
"""

import os, re, sys

ROOT = '/Users/alfred/code/motoi-scheme'
REF_DIR = f'{ROOT}/scheme/reference'

# Records that must keep teaching with-exception-handler itself, or whose whole
# subject is the raise/raise-continuable contrast, or — for the continuation
# verbs — whose row-5 composition IS `call/cc around an escaping handler`, the
# R7RS-legal shape that guard is built out of. Hand-authored, not machined.
SKIP_RECORDS = {'with-exception-handler', 'raise-continuable',
                'call-with-current-continuation', 'call/cc'}

CHAPTERS = ['00b-introspection.slat', '01-core.slat', '02-ai.slat',
            '06-assert.slat', '26-exception.slat', '51-plot.slat']

CC_NAMES = ('call-with-current-continuation', 'call/cc')

# `[\s(\\]` and not `[\s(]`: inside a SLAT field a newline is the two characters
# backslash-n, so a head is very often followed by a literal backslash.
# Requiring real whitespace silently skipped those forms.
HEAD_RE = re.compile(r'\((?:with-exception-handler|'
                     r'call-with-current-continuation|call/cc)[\s(\\]')


# ---------------------------------------------------------------- scanning
# The forms live inside SLAT string fields, so in the raw file a Scheme string
# is written \"like this\" and a newline is a literal backslash-n. The scanner
# therefore treats \" as the string delimiter; a bare " means we walked out of
# the field, which is a bug, not a form.

def match_form(text, i):
    """End index (exclusive) of the balanced form starting at text[i] == '('."""
    assert text[i] == '('
    depth, j, n = 0, i, len(text)
    while j < n:
        c = text[j]
        if c == '\\' and j + 1 < n and text[j + 1] == '"':
            # step over an escaped Scheme string
            j += 2
            while j < n:
                # Raw `\\` is one Scheme backslash, so it escapes whatever comes
                # next — and that may itself be a raw `\"`. Reading the pair as
                # two separate tokens ended the string early on
                # (open-input-string "\"abc") and lost the whole record.
                if text.startswith('\\\\', j):
                    j += 4 if text.startswith('\\"', j + 2) else 3
                    continue
                if text[j] == '\\' and j + 1 < n:
                    if text[j + 1] == '"':
                        j += 2
                        break
                    j += 2
                    continue
                j += 1
            continue
        if c == '#' and text.startswith('#\\', j):
            j += 3          # #\( and friends carry a literal paren
            continue
        if c == '"':
            return None     # ran off the end of the SLAT field
        if c == '(':
            depth += 1
        elif c == ')':
            depth -= 1
            if depth == 0:
                return j + 1
        j += 1
    return None


def split_args(text, start, end):
    """The sub-forms/atoms of the form text[start:end], head first."""
    parts, j = [], start + 1
    while j < end - 1:
        c = text[j]
        if c in ' \t\n':
            j += 1
            continue
        if text.startswith('\\n', j):
            j += 2
            continue
        if c == '(':
            k = match_form(text, j)
            if k is None or k > end:
                return None
            parts.append((j, k))
            j = k
            continue
        k = j
        while k < end - 1 and text[k] not in ' \t\n()':
            k += 1
        if k == j:
            return None
        parts.append((j, k))
        j = k
    return parts


def is_lambda(text, s, e, arity):
    """(lambda () ...) when arity is 0, (lambda (x) ...) when arity is 1."""
    if not text.startswith('(lambda', s):
        return None
    parts = split_args(text, s, e)
    if not parts or len(parts) < 2:
        return None
    ps, pe = parts[1]
    params = text[ps:pe].strip()
    if arity == 0:
        return '' if params == '()' else None
    m = re.fullmatch(r'\(([A-Za-z_][\w?!*/<>=+-]*)\)', params)
    return m.group(1) if m else None


def lambda_body(text, s, e):
    """Source of everything after the parameter list, verbatim."""
    parts = split_args(text, s, e)
    ps, pe = parts[1]
    body = text[pe:e - 1]
    return body.strip().lstrip('\\n').strip() if body.strip().startswith('\\n') else body.strip()


# ---------------------------------------------------------------- transforms

IDENT_RE = re.compile(r'[A-Za-z_][\w?!*/<>=+.-]*')

# A handler containing one of these never returns, so the 2026-08-03 secondary
# raise can never fire and the form is already correct. Leave it alone rather
# than churn a snippet that is passing today.
NON_RETURNING = ('(emergency-exit', '(exit ', '(exit)')


def build_guard(var, handler_body, thunk_body):
    return f'(guard ({var} (#t {handler_body})) {thunk_body})'


def thunk_source(text, s, e):
    """The guard body for a with-exception-handler thunk argument.

    `(lambda () BODY ...)` contributes BODY verbatim; a thunk passed by name
    contributes a call to it, since guard takes expressions, not a procedure.
    """
    if text[s] == '(':
        return None if is_lambda(text, s, e, 0) is None else lambda_body(text, s, e)
    tok = text[s:e]
    return f'({tok})' if IDENT_RE.fullmatch(tok) else None


def try_t1(text, s, e):
    """call/cc + escaping handler -> guard. Returns replacement or None."""
    parts = split_args(text, s, e)
    if not parts or len(parts) != 2:
        return None
    ls, le = parts[1]
    k = is_lambda(text, ls, le, 1)
    if k is None:
        return None
    inner = split_args(text, ls, le)
    if len(inner) != 3:                       # lambda, (k), one body form
        return None
    ws, we = inner[2]
    if not text.startswith('(with-exception-handler', ws) or we != le - 1:
        return None
    weh = split_args(text, ws, we)
    if not weh or len(weh) != 3:
        return None
    (hs, he), (ts, te) = weh[1], weh[2]
    var = is_lambda(text, hs, he, 1)
    tbody = thunk_source(text, ts, te)
    if var is None or tbody is None:
        return None
    hbody = lambda_body(text, hs, he)
    # The handler must END in a call to the escape continuation. Anything
    # before it is effect — `(set! caught #t)` and friends — and carries over
    # verbatim into the guard clause, which also takes a sequence.
    wrapped = '(' + hbody + ')'
    forms = split_args(wrapped, 0, len(wrapped))
    if not forms:
        return None
    fs, fe = forms[-1]
    m = re.fullmatch(r'\(' + re.escape(k) + r'\s+(.*)\)', wrapped[fs:fe], re.S)
    if not m:
        return None
    result = (wrapped[1:fs].strip() + ' ' + m.group(1).strip()).strip()
    # ... and k must appear exactly twice in the whole form: once binding it in
    # `(lambda (k)`, once calling it in the handler. Any third mention means the
    # escape is load-bearing somewhere else and a human has to read it.
    # (Matching against "everything but the handler" always hit the `(k)`
    # parameter list and rejected every well-formed case.)
    tok = r'(?<![\w?!*/<>=+.-])' + re.escape(k) + r'(?![\w?!*/<>=+.-])'
    if len(re.findall(tok, text[s:e])) != 2:
        return None
    if re.search(tok, result + ' ' + tbody):
        return None
    return build_guard(var, result, tbody)


def try_t1b(text, s, e):
    """call/cc wrapped around a guard that only escapes -> drop the call/cc.

    Once T1 or T2 has turned the inner catcher into a `guard`, the surrounding
    `(call/cc (lambda (k) ...))` is dead weight: the clause already returns to
    the caller, so `(k v)` and `v` are the same value. Left in place it teaches
    a ceremony the reader will copy forever.
    """
    parts = split_args(text, s, e)
    if not parts or len(parts) != 2:
        return None
    ls, le = parts[1]
    k = is_lambda(text, ls, le, 1)
    if k is None:
        return None
    inner = split_args(text, ls, le)
    if len(inner) != 3:
        return None
    gs, ge = inner[2]
    if not text.startswith('(guard', gs) or ge != le - 1:
        return None
    g = split_args(text, gs, ge)
    if not g or len(g) < 3:
        return None
    cs, ce = g[1]                                   # (VAR (#t BODY ...))
    clause = split_args(text, cs, ce)
    if not clause or len(clause) != 2:
        return None
    var = text[clause[0][0]:clause[0][1]]
    bs, be = clause[1]
    if not text.startswith('(#t', bs):
        return None
    body = text[bs + 3:be - 1].strip()
    wrapped = '(' + body + ')'
    forms = split_args(wrapped, 0, len(wrapped))
    if not forms:
        return None
    fs, fe = forms[-1]
    m = re.fullmatch(r'\(' + re.escape(k) + r'\s+(.*)\)', wrapped[fs:fe], re.S)
    if not m:
        return None
    tok = r'(?<![\w?!*/<>=+.-])' + re.escape(k) + r'(?![\w?!*/<>=+.-])'
    if len(re.findall(tok, text[s:e])) != 2:
        return None
    result = (wrapped[1:fs].strip() + ' ' + m.group(1).strip()).strip()
    return build_guard(var, result, text[g[2][0]:ge - 1].strip())


def try_t2(text, s, e):
    """plain with-exception-handler -> guard. Returns replacement or None."""
    parts = split_args(text, s, e)
    if not parts or len(parts) != 3:
        return None
    (hs, he), (ts, te) = parts[1], parts[2]
    var = is_lambda(text, hs, he, 1)
    tbody = thunk_source(text, ts, te)
    if var is None or tbody is None:
        return None
    hbody = lambda_body(text, hs, he)
    if any(tag in hbody for tag in NON_RETURNING):
        return None
    return build_guard(var, hbody, tbody)


# ---------------------------------------------------------------- record map

def record_spans(text):
    """[(start, end, name)] for every (verb ...) record, for the skip-list.

    A record runs to the next line-anchored `(verb`. Paren-matching is no use
    here: a record's SLAT fields are bare-quoted strings, so a balanced scan
    walks straight out of the record on the first `"`.
    """
    starts = [m.start() for m in re.finditer(r'(?m)^\(verb\b', text)]
    spans = []
    for i, s in enumerate(starts):
        e = starts[i + 1] if i + 1 < len(starts) else len(text)
        m = re.search(r':name\s+"([^"]+)"', text[s:e])
        spans.append((s, e, m.group(1) if m else '<unnamed>'))
    return spans


def record_name_at(spans, pos):
    for s, e, name in spans:
        if s <= pos < e:
            return name
    return '<none>'


# ---------------------------------------------------------------- driver

def process(path, write=False):
    text = open(path).read()
    rewrites, skipped = [], []

    def sweep(text):
        """Every candidate form, left to right, with its verdict."""
        # Recomputed per sweep, NOT hoisted: every splice shortens the file, so
        # spans taken before the first rewrite drift backwards and start
        # attributing one record's forms to the record above it — which is
        # exactly the skip-list that is meant to protect the hand-authored
        # with-exception-handler record from being machined.
        spans = record_spans(text)
        for m in HEAD_RE.finditer(text):
            s = m.start()
            e = match_form(text, s)
            form = text[s:e] if e is not None else text[s:s + 120]
            # NOT form[1:].split()[0]: a SLAT newline is the two characters
            # backslash-n, which str.split does not treat as whitespace, so the
            # head came back as "call-with-current-continuation\n", missed
            # CC_NAMES, and every multi-line call/cc form fell through to the
            # plain transform and was left stranded around its own guard.
            head = re.match(r'\(([^\s(\\]+)', form).group(1)
            if head in CC_NAMES and '(with-exception-handler' not in form \
                    and '(guard' not in form:
                continue                              # plain call/cc, not ours
            name = record_name_at(spans, s)
            if e is None:
                yield s, e, name, 'unbalanced/ran-off-field', form, None
            elif name in SKIP_RECORDS:
                yield s, e, name, 'skip-listed record (hand-authored)', form, None
            elif 'raise-continuable' in form:
                yield s, e, name, 'raise-continuable — correct as written', form, None
            elif '(' not in form[1:]:
                # `... (with-exception-handler or a call/cc guard) ...` — an
                # :explanation sentence that happens to be parenthesised, not a
                # form. Prose is reviewed by eye, not rewritten.
                yield s, e, name, 'prose mention, not code', form, None
            else:
                rep = ((try_t1(text, s, e) or try_t1b(text, s, e))
                       if head in CC_NAMES else try_t2(text, s, e))
                yield s, e, name, None if rep else 'shape not exact-match', form, rep

    # OUTERMOST FIRST, restarting after each splice. A right-to-left sweep
    # rewrote the inner with-exception-handler before its call/cc wrapper and
    # stranded `(call/cc (lambda (k) (guard (e (#t (k d))) ...)))` — a redundant
    # escape around a form that no longer escapes.
    while True:
        for s, e, name, why, form, rep in sweep(text):
            if rep is not None:
                rewrites.append((name, form, rep))
                text = text[:s] + rep + text[e:]
                break
        else:
            break
    skipped = [(name, why, form[:120])
               for _, _, name, why, form, rep in sweep(text) if rep is None]

    if write and rewrites:
        open(path, 'w').write(text)
    return rewrites, skipped


def main():
    write = '--write' in sys.argv
    argv = [a for a in sys.argv[1:] if not a.startswith('--')]
    files = argv or CHAPTERS
    total_r = total_s = 0
    for f in files:
        path = f if f.startswith('/') else f'{REF_DIR}/{f}'
        if not os.path.exists(path):
            print(f'!! no such chapter: {path}')
            continue
        rewrites, skipped = process(path, write)
        total_r += len(rewrites)
        total_s += len(skipped)
        print(f'{os.path.basename(path):28} rewrote {len(rewrites):4}   left alone {len(skipped):4}'
              + ('' if write else '   (dry run)'))
        for name, why, snip in skipped:
            print(f'    LEFT  {name:28} {why}\n          {snip}')
    print(f'\ntotal rewrites {total_r}   total left alone {total_s}')
    return 0


if __name__ == '__main__':
    sys.exit(main())
