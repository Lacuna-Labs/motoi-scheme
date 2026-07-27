#!/usr/bin/env python3
"""fix-auto-generated-stubs.py — delete every (:math-program ... :meta "Auto-generated 2026-07-22...")
and matching :cs-program / :math-composition / :cs-composition forms.

Marcus flagged 2,988 spots as phrase-lock hazard: the `expand-to-15` pass injected
identical (define (math-view v) v) / (define (cs-guard v) ...) stubs on every wired
verb. Same skeleton per verb → the model would learn to always emit those defines.

Restores rows to their pre-expansion (7-11 program) shape. Honest.
"""
import re, os, glob

REF = '/Users/alfred/code/motoi-scheme/scheme/reference'
# The exact marker signature used by the expander:
#   :meta "Auto-generated 2026-07-22 by expand-to-15."
#   :meta "Auto-generated 2026-07-22."
MARKER_RE = re.compile(r':meta\s+"Auto-generated 2026-07-22')

# We match (:eng-composition|:math-composition|:cs-composition|:eng-program|:math-program|:cs-program)
# forms whose body contains the auto-generated marker. Delete the whole form
# from its opening `(` to matching `)`.

def find_form_starting_before(text, pos):
    """Given a position inside a paren form, find the ( that opens it. Return that idx."""
    depth = 0
    i = pos
    while i >= 0:
        c = text[i]
        if c == ')': depth += 1
        elif c == '(':
            if depth == 0: return i
            depth -= 1
        i -= 1
    return None

def find_form_end(text, open_paren):
    """From position of opening (, find matching ) and return its idx."""
    depth = 0; ins = False; esc = False; j = open_paren
    while j < len(text):
        c = text[j]
        if ins:
            if esc: esc = False
            elif c == '\\': esc = True
            elif c == '"': ins = False
        else:
            if c == '"': ins = True
            elif c == '(': depth += 1
            elif c == ')':
                depth -= 1
                if depth == 0: return j
        j += 1
    return None

total_deleted = 0
files_touched = 0
for path in sorted(glob.glob(os.path.join(REF, '*.slat'))):
    text = open(path).read()
    marks = list(MARKER_RE.finditer(text))
    if not marks: continue
    # Process from end → start so indices stay valid
    n_this_file = 0
    for m in reversed(marks):
        # The marker sits INSIDE a form like (:math-program "..." :meta "Auto...")
        # Walk back from marker position to find the ( that opens THIS form
        open_p = find_form_starting_before(text, m.start())
        if open_p is None: continue
        close_p = find_form_end(text, open_p)
        if close_p is None: continue
        # Verify this is a program/composition form (not something bigger)
        head = text[open_p:open_p+30]
        if not re.match(r'\(:?(?:math|cs|eng)-(?:program|composition)', head):
            # Marker is inside a nested string — skip
            continue
        # Delete the form + surrounding whitespace/newline
        # Extend to swallow trailing newline if present
        end = close_p + 1
        while end < len(text) and text[end] in ' \t\n' and text[end] != ')':
            if text[end] == '\n':
                end += 1; break
            end += 1
        # Extend backwards to swallow leading whitespace to previous newline
        start = open_p
        while start > 0 and text[start-1] in ' \t':
            start -= 1
        text = text[:start] + text[end:]
        n_this_file += 1
    if n_this_file:
        with open(path, 'w') as f: f.write(text)
        files_touched += 1
        total_deleted += n_this_file
        print(f'{os.path.basename(path):<40s} deleted {n_this_file} auto-generated stubs')

print(f'\nTotal auto-generated stubs deleted: {total_deleted}')
print(f'Files touched: {files_touched}')
