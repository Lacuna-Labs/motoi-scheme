import re, os, sys
os.chdir('/Users/alfred/code/motoi-scheme')
BOOK='scheme-books/book-of-music'

PRE=open('scratch/FINAL-preamble.scm').read().split('(display (as-freq')[0].rstrip()

MARKER='<!-- waves-foundation -->'
# The section to inject, as it should appear in the RENDERED prose (unescaped form).
SECTION = (
'\n---\n\n'
'## Waves — the signal-math foundation\n\n'
'Before the first sound, load this foundation. In Motoi a **note is a frequency** '
'and a **sound is a waveform** — samples of a sine. Every music verb this chapter '
'uses (`tone`, `note/strike`, `audio/play`, `create-periodic-wave`, the score verbs) '
'is defined here from `math/sin`, `expt`, and lists. Run this block first; the rest '
'of the chapter builds on it.\n\n'
+ MARKER + '\n'
'```scheme\n' + PRE + '\n```\n\n'
'---\n'
)

def esc(s):
    # escape for embedding inside the SLATL :prose "..." double-quoted string
    return s.replace('\\','\\\\').replace('"','\\"')

def inject(fn):
    p=os.path.join(BOOK,fn)
    txt=open(p,encoding='utf-8').read()
    if MARKER in txt:
        print(f"{fn}: already injected, skipping"); return
    esc_section=esc(SECTION)
    # find first ```scheme (escaped form in file is literally ```scheme on its own line)
    idx=txt.find('```scheme')
    if idx<0:
        print(f"{fn}: no scheme block, skipping"); return
    # back up to start of that line
    line_start=txt.rfind('\n', 0, idx)+1
    new=txt[:line_start]+esc_section+'\n'+txt[line_start:]
    open(p,'w',encoding='utf-8').write(new)
    print(f"{fn}: injected foundation before first block at offset {line_start}")

for fn in sys.argv[1:]:
    inject(fn)
