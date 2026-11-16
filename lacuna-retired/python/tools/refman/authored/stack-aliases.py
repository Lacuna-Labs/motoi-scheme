#!/usr/bin/env python3
"""stack-aliases.py — write stack-aliases.ref from stack.ref.

The motoi/stack-* and sakura/stack-* names are the lacuna/stack-* procedures under their old names. Their entries carry
the same fifteen programs with the old name put in, and words that send the reader to the lacuna/ name. Run this after
every change of stack.ref:  python3 tools/refman/authored/stack-aliases.py
"""
import os
import re

HERE = os.path.dirname(os.path.abspath(__file__))
PROSE = ('@exp', '@when', '@not', '@cav', '@see', '@ask', '@err')


def alias_text(source, family):
    out = []
    for block in re.split(r'\n(?=@verb )', source):
        if not block.startswith('@verb '):
            continue
        name = block.split('\n', 1)[0][len('@verb '):].strip()
        old = name.replace('lacuna/', family + '/')
        lines = []
        for line in block.split('\n'):
            if line.startswith(PROSE):
                continue
            if line.startswith('@sum '):
                lines.append(f'@sum Deprecated name of {name}: the same procedure.')
                lines.append(f'@exp ({old} …) and ({name} …) are one procedure with one recorder. The {family}/ name is '
                             f'kept so that old programs run. The programs below are those of {name} with the old name.')
                lines.append(f'@when You read or keep an old program that has this name.')
                lines.append(f'@not You write a new program: use {name}.')
                lines.append(f'@cav Every caveat of {name} applies.')
                lines.append(f'@see {name}')
                lines.append(f'@ask {old}')
                continue
            lines.append(line.replace('lacuna/stack', family + '/stack'))
        out.append('\n'.join(lines).rstrip() + '\n')
    return '\n'.join(out)


def main():
    source = open(os.path.join(HERE, 'stack.ref')).read()
    head = ('@@ stack-aliases.ref — the deprecated names of the stack recorder: motoi/stack-* and sakura/stack-*.\n'
            '@@ WRITTEN BY stack-aliases.py FROM stack.ref. Do not edit; change stack.ref and run the script.\n\n')
    body = '\n'.join(alias_text(source, family) for family in ('motoi', 'sakura'))
    open(os.path.join(HERE, 'stack-aliases.ref'), 'w').write(head + body)


if __name__ == '__main__':
    main()
