#!/usr/bin/env python3
"""ken-record-tool.py — extract/replace a single (verb ...) record in a .slat.

Working file for Ken's 01-core pass (2026-08-02). Balanced-paren slicer that
respects string literals, same algorithm as verify-reference-records.py.

  extract <file> <verb-name> <out-path>
  replace <file> <verb-name> <in-path>
"""
import sys


def slice_record(text, name):
    needle = f'(verb\n  :name "{name}"'
    i = text.index(needle)
    depth = 0
    in_str = False
    esc = False
    j = i
    while j < len(text):
        c = text[j]
        if in_str:
            if esc:
                esc = False
            elif c == '\\':
                esc = True
            elif c == '"':
                in_str = False
        else:
            if c == '"':
                in_str = True
            elif c == '(':
                depth += 1
            elif c == ')':
                depth -= 1
                if depth == 0:
                    j += 1
                    break
        j += 1
    return i, j


def main():
    cmd, path, name, other = sys.argv[1], sys.argv[2], sys.argv[3], sys.argv[4]
    text = open(path).read()
    i, j = slice_record(text, name)
    if cmd == 'extract':
        open(other, 'w').write(text[i:j])
        print(f'{name}: lines {text[:i].count(chr(10)) + 1}-{text[:j].count(chr(10)) + 1}')
    elif cmd == 'replace':
        new = open(other).read().rstrip('\n')
        open(path, 'w').write(text[:i] + new + text[j:])
        print(f'{name}: replaced')
    else:
        raise SystemExit('unknown command')


if __name__ == '__main__':
    main()
