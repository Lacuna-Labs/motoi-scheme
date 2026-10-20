#!/usr/bin/env python3
"""fix-ai-prose-2026-08-03.py — bring 02-ai's PROSE in line with its code.

The mechanical pass rewrote every catch in 02-ai from `with-exception-handler`
(+ a call/cc escape) to `guard`. The surrounding :explanation / :caveats /
:learn / :progression sentences still name the old idiom, so the chapter now
recommends one verb and demonstrates another — and a reader following the prose
would write code that raises.

Exact-string replacements only, each one asserted present before it is applied,
so a partial or repeated run cannot silently do half the job. Re-runnable:
a second pass reports every replacement as already-applied and changes nothing.
"""

import sys

PATH = '/Users/alfred/code/motoi-scheme/scheme/reference/02-ai.slat'

EDITS = [
    (";;     in with-exception-handler if you want to keep running offline.",
     ";;     in guard if you want to keep running offline."),

    ("then wrap ai/generate in with-exception-handler for the raise-shape verbs.",
     "then wrap ai/generate in guard for the raise-shape verbs."),

    ("move to ai/generate (raise-degrade) and learn with-exception-handler; use llm/config to gate either.",
     "move to ai/generate (raise-degrade) and learn guard; use llm/config to gate either."),

    ("To run offline you must CATCH the error (with-exception-handler or a call/cc guard) and take your own path.",
     "To run offline you must CATCH the error with `guard` and take your own path."),

    ("RAISES with no model wired — you MUST catch it (with-exception-handler / call/cc) to run offline, unlike llm/ask which returns #f.",
     "RAISES with no model wired — you MUST catch it with `guard` to run offline, unlike llm/ask which returns #f. `with-exception-handler` will not do this job: since 2026-08-03 a handler that returns from a plain raise triggers a secondary exception rather than answering.",),

    ("a verb that refuses to fake output raises, and with-exception-handler + call/cc converts the raise into a value you choose.\" :prerequisites (\"call-with-current-continuation\" \"with-exception-handler\")",
     "a verb that refuses to fake output raises, and guard converts the raise into a value you choose.\" :prerequisites (\"guard\" \"error-object-message\")"),

    ("\"Exception-to-value conversion via a delimited escape (call/cc + handler).\"",
     "\"Exception-to-value conversion via guard, the standard eliminator for a raise.\""),

    ("RAISES a catchable 'needs an LLM provider' error offline — so wrap it in with-exception-handler / call/cc to run without a model.",
     "RAISES a catchable 'needs an LLM provider' error offline — so wrap it in `guard` to run without a model."),

    ("but with a RAISE-degrade instead of #f — the elimination form is with-exception-handler.\" :prerequisites (\"call-with-current-continuation\" \"with-exception-handler\")",
     "but with a RAISE-degrade instead of #f — the elimination form is guard.\" :prerequisites (\"guard\" \"error-object-message\")"),

    ("you supply a labeled estimate if you need one.\" :prerequisites (\"call-with-current-continuation\" \"quotient\" \"string-length\")",
     "you supply a labeled estimate if you need one.\" :prerequisites (\"guard\" \"quotient\" \"string-length\")"),

    ("Catch it with with-exception-handler / call/cc to keep a program total, or gate on a caught flag.",
     "Catch it with `guard` to keep a program total, or gate on a caught flag."),

    ("so it raises rather than fabricates; the elimination form is with-exception-handler.\" :prerequisites (\"call-with-current-continuation\" \"with-exception-handler\" \"map\")",
     "so it raises rather than fabricates; the elimination form is guard.\" :prerequisites (\"guard\" \"error-object-message\" \"map\")"),

    ("a truncation is not a summary and must be labeled.\" :prerequisites (\"call-with-current-continuation\" \"with-exception-handler\" \"substring\")",
     "a truncation is not a summary and must be labeled.\" :prerequisites (\"guard\" \"error-object-message\" \"substring\")"),

    ("a passthrough is not a translation and must be labeled.\" :prerequisites (\"call-with-current-continuation\" \"with-exception-handler\" \"string-append\")",
     "a passthrough is not a translation and must be labeled.\" :prerequisites (\"guard\" \"error-object-message\" \"string-append\")"),

    ("rather than pretend it is semantic.\" :prerequisites (\"call-with-current-continuation\" \"with-exception-handler\" \"sort\")",
     "rather than pretend it is semantic.\" :prerequisites (\"guard\" \"error-object-message\" \"sort\")"),

    ("so it raises; the offline fallback is the prior order.\" :prerequisites (\"call-with-current-continuation\" \"with-exception-handler\")",
     "so it raises; the offline fallback is the prior order.\" :prerequisites (\"guard\" \"error-object-message\")"),

    ("a brute-force ai/embed sort is a labeled stand-in, not the real thing.\" :prerequisites (\"call-with-current-continuation\" \"with-exception-handler\" \"sort\" \"map\")",
     "a brute-force ai/embed sort is a labeled stand-in, not the real thing.\" :prerequisites (\"guard\" \"error-object-message\" \"sort\" \"map\")"),
]


def main():
    write = '--write' in sys.argv
    text = open(PATH).read()
    applied = pending = missing = 0
    for old, new in EDITS:
        if old in text:
            text = text.replace(old, new)
            pending += 1
        elif new in text:
            applied += 1
        else:
            missing += 1
            print(f'!! NOT FOUND, hand-check: {old[:110]}')
    if write and pending:
        open(PATH, 'w').write(text)
    print(f'02-ai.slat prose: {pending} to apply, {applied} already applied, '
          f'{missing} not found' + ('' if write else '   (dry run)'))
    return missing


if __name__ == '__main__':
    sys.exit(main())
