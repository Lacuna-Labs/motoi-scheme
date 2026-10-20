#!/usr/bin/env python3
"""Split a Scheme source file into top-level forms, preserving exact source text.

Handles: strings w/ escapes, #\<char> literals (incl. #\( #\; #\space),
block comments #| ... |#, datum comments #;, |bar symbols|, vectors #(,
bytevectors #u8(, quote/quasiquote/unquote prefixes.
"""
import sys


def split_forms(src):
    """Return list of (start_index, end_index, line_no) for each top-level datum.

    Datum comments (#;<datum>) at top level are attached to nothing and skipped
    (the commented datum is consumed as part of the skip).
    """
    i = 0
    n = len(src)
    line = 1
    forms = []

    def linecount(a, b):
        return src.count("\n", a, b)

    while i < n:
        c = src[i]
        if c in " \t\n\r\f":
            if c == "\n":
                line += 1
            i += 1
            continue
        if c == ";":
            j = src.find("\n", i)
            i = n if j < 0 else j
            continue
        if src.startswith("#|", i):
            depth = 1
            j = i + 2
            while j < n and depth:
                if src.startswith("#|", j):
                    depth += 1
                    j += 2
                elif src.startswith("|#", j):
                    depth -= 1
                    j += 2
                else:
                    j += 1
            line += linecount(i, j)
            i = j
            continue
        if src.startswith("#;", i):
            j = read_datum(src, i + 2)
            line += linecount(i, j)
            i = j
            continue
        start = i
        j = read_datum(src, i)
        if j is None or j <= i:
            raise ValueError("cannot read datum at line %d: %r" % (line, src[i:i + 60]))
        forms.append((start, j, line))
        line += linecount(start, j)
        i = j
    return forms


PREFIXES = ("#'", ",@", "'", "`", ",")


def read_datum(src, i):
    """Return index just past the datum starting at/after i."""
    n = len(src)
    # skip whitespace/comments
    while i < n:
        c = src[i]
        if c in " \t\n\r\f":
            i += 1
            continue
        if c == ";":
            j = src.find("\n", i)
            i = n if j < 0 else j
            continue
        if src.startswith("#|", i):
            depth = 1
            j = i + 2
            while j < n and depth:
                if src.startswith("#|", j):
                    depth += 1
                    j += 2
                elif src.startswith("|#", j):
                    depth -= 1
                    j += 2
                else:
                    j += 1
            i = j
            continue
        if src.startswith("#;", i):
            i = read_datum(src, i + 2)
            continue
        break
    if i >= n:
        return None

    for p in PREFIXES:
        if src.startswith(p, i):
            return read_datum(src, i + len(p))

    c = src[i]
    if c == '"':
        j = i + 1
        while j < n:
            if src[j] == "\\":
                j += 2
                continue
            if src[j] == '"':
                return j + 1
            j += 1
        raise ValueError("unterminated string at %d" % i)
    if c == "|":
        j = i + 1
        while j < n:
            if src[j] == "\\":
                j += 2
                continue
            if src[j] == "|":
                return j + 1
            j += 1
        raise ValueError("unterminated |symbol| at %d" % i)
    if src.startswith("#\\", i):
        # char literal: #\x, #\space, #\x41, #\(  -- consume one char then
        # any following identifier chars.
        j = i + 2
        if j < n:
            j += 1
        while j < n and (src[j].isalnum() or src[j] == "-"):
            j += 1
        return j
    if c == "(" or c == "[" or src.startswith("#(", i) or src.startswith("#u8(", i) or src.startswith("#U8(", i):
        if c == "(" or c == "[":
            j = i + 1
        elif src.startswith("#(", i):
            j = i + 2
        else:
            j = i + 4
        close = "]" if c == "[" else ")"
        while True:
            # skip whitespace/comments
            while j < n:
                ch = src[j]
                if ch in " \t\n\r\f":
                    j += 1
                    continue
                if ch == ";":
                    k = src.find("\n", j)
                    j = n if k < 0 else k
                    continue
                if src.startswith("#|", j):
                    depth = 1
                    k = j + 2
                    while k < n and depth:
                        if src.startswith("#|", k):
                            depth += 1
                            k += 2
                        elif src.startswith("|#", k):
                            depth -= 1
                            k += 2
                        else:
                            k += 1
                    j = k
                    continue
                if src.startswith("#;", j):
                    j = read_datum(src, j + 2)
                    continue
                break
            if j >= n:
                raise ValueError("unterminated list at %d" % i)
            if src[j] in ")]":
                return j + 1
            j = read_datum(src, j)
    # atom: read until delimiter
    j = i
    while j < n and src[j] not in ' \t\n\r\f()[]";':
        if src[j] == "|":  # |bar| inside identifier
            j += 1
            while j < n and src[j] != "|":
                j += 1
        j += 1
    return j


if __name__ == "__main__":
    src = open(sys.argv[1], encoding="utf-8").read()
    fs = split_forms(src)
    print("forms:", len(fs))
    for s, e, ln in fs[:5]:
        print(ln, repr(src[s:e][:70]))
