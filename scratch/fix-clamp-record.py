#!/usr/bin/env python3
"""Rewrite the one generated SFT pair that teaches the substring clamp.

The advice in the record (use string-prefix?) was always right. The factual
frame was wrong: it asserted Motoi clamps and showed a worked `;=>` for it.
Motoi raises. Highest poison-per-token record in the tree, so it gets the
careful rewrite rather than a deletion.
"""
import json, sys

PATH = 'scratch/sft-plans/pairs-dotted-and-srfi-2026-08-02.jsonl'

NEW_RESPONSE = (
    "It gives the right answer only when the string is long enough, and it "
    "raises the moment it is not:\n\n"
    "    (substring \"ab\" 0 3)\n"
    "    ;=> error: substring: end 3 is past the end of a string of length 2\n\n"
    "That is the correct behaviour. **R7RS section 6.7 requires** "
    "`0 <= start <= end <= (string-length s)`, so asking for characters that "
    "are not there is an error, not a shorter answer. Some Schemes clamp "
    "silently instead; relying on that is how a prefix test comes to work on "
    "one implementation and crash on another.\n\n"
    "So the bug is not stylistic. `(string=? (substring s 0 3) \"foo\")` is a "
    "crash waiting for its first short input, and the input that triggers it "
    "is exactly the one you were trying to reject.\n\n"
    "`string-prefix?` from SRFI-13 asks the question directly and is total -- "
    "it is defined for every string, including ones shorter than the prefix:\n\n"
    "    (string-prefix? \"foo\" \"foobar\")   ;=> #t\n"
    "    (string-prefix? \"foobar!\" \"foo\")   ;=> #f\n\n"
    "Note the argument order -- prefix first, the string being tested second. "
    "`string-suffix?` is the same shape for the other end. If you genuinely "
    "want truncation rather than a test, say so explicitly with "
    "`(substring s 0 (min 3 (string-length s)))`; then the clamp is a choice "
    "in your code instead of an accident in someone else's."
)

NEW_BLOCKS = [
    '(string-prefix? "foo" "foobar")',
    '(string-prefix? "foobar!" "foo")',
    '(substring "ab" 0 3)',
    '(substring s 0 (min 3 (string-length s)))',
]

lines = open(PATH).read().splitlines()
hits = 0
for i, line in enumerate(lines):
    if not line.strip():
        continue
    rec = json.loads(line)
    if 'That silent clamp' in rec.get('response', ''):
        rec['response'] = NEW_RESPONSE
        rec['code_blocks'] = NEW_BLOCKS
        rec['corrected'] = '2026-08-02: asserted a clamp Motoi does not do; rewritten around the raise'
        lines[i] = json.dumps(rec, ensure_ascii=False)
        hits += 1

if hits != 1:
    sys.exit(f'expected exactly 1 poisoned record, found {hits} — aborting without writing')

open(PATH, 'w').write('\n'.join(lines) + '\n')
print(f'rewrote {hits} record in {PATH}')
