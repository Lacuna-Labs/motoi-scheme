#!/usr/bin/env python3
"""Migrate dropped hash aliases to SRFI-125 canonical names across live corpus.

Dropped names (unbound 2026-07-24) and their behavior-preserving targets,
derived from the OLD engine impl (src/_archive/r7rs-completions.pre-split-...js):

  hash-set! h k v          -> hash-table-set! h k v                (rename head)
  hash-ref  h k            -> hash-table-ref/default h k #f         (old dflt = false)
  hash-ref  h k d          -> hash-table-ref/default h k d          (rename head)
  hash-table-exists? h k   -> hash-table-contains? h k              (rename head)

Only rewrites actual paren-call sites (find_calls requires whitespace after the
head), so prose mentions like "hash-ref-first" are never touched.

Excludes records/specs: _archive, broken-examples, EVAL reports, verb-index,
worktrees (via htref EXCLUDE) PLUS Spec/ (hand-reviewed separately).

Modes: analyze (default) | migrate.
"""
import sys, importlib.util, re, glob

_spec = importlib.util.spec_from_file_location("htref", "scratch/htref-migrate.py")
_m = importlib.util.module_from_spec(_spec)
_src = open("scratch/htref-migrate.py").read().replace(
    'if __name__ == "__main__":\n    main()', '')
exec(compile(_src, "htref", "exec"), _m.__dict__)

EXCLUDE_EXTRA = re.compile(r"(/Spec/|^Spec/)")

def target_files():
    return [f for f in _m.target_files() if not EXCLUDE_EXTRA.search(f)]

def migrate_head(text, head, mode, stats):
    calls = _m.find_calls(text, head)
    new = text
    for (a, b, call) in reversed(calls):
        args = _m.split_args(call, head)
        argc = len(args)
        if head == "hash-set!":
            conv = "(hash-table-set!" + call[len("(hash-set!"):]
            stats["hash-set!"] += 1
        elif head == "hash-table-exists?":
            conv = "(hash-table-contains?" + call[len("(hash-table-exists?"):]
            stats["exists?"] += 1
        elif head == "hash-ref":
            if argc == 2:
                conv = "(hash-table-ref/default" + call[len("(hash-ref"):-1] + " #f)"
                stats["ref2"] += 1
            elif argc == 3:
                conv = "(hash-table-ref/default" + call[len("(hash-ref"):]
                stats["ref3"] += 1
            else:
                stats["ref_other"] += 1
                stats["review"].append((head, argc, call[:90]))
                continue
        else:
            continue
        if mode == "migrate":
            new = new[:a] + conv + new[b:]
    return new

def main():
    mode = sys.argv[1] if len(sys.argv) > 1 else "analyze"
    files = target_files()
    stats = {"hash-set!":0, "exists?":0, "ref2":0, "ref3":0, "ref_other":0, "review":[]}
    touched = []
    for f in files:
        with open(f) as fh:
            text = fh.read()
        if not any(h in text for h in ("(hash-set!", "(hash-ref", "(hash-table-exists?")):
            continue
        new = text
        for head in ("hash-set!", "hash-ref", "hash-table-exists?"):
            new = migrate_head(new, head, mode, stats)
        if new != text:
            touched.append(f)
            if mode == "migrate":
                with open(f, "w") as fh:
                    fh.write(new)
    print(f"=== {mode} summary ({len(files)} files scanned) ===")
    print(f"  hash-set! -> hash-table-set!            : {stats['hash-set!']}")
    print(f"  hash-ref  2-arg -> ref/default h k #f   : {stats['ref2']}")
    print(f"  hash-ref  3-arg -> ref/default h k d    : {stats['ref3']}")
    print(f"  hash-table-exists? -> contains?         : {stats['exists?']}")
    print(f"  hash-ref  other-argc (REVIEW)           : {stats['ref_other']}")
    print(f"  files touched: {len(touched)}")
    for f in touched:
        print("    " + f)
    if stats["review"]:
        print("\n  REVIEW sites:")
        for h, c, s in stats["review"]:
            print(f"    [{h} argc={c}] {s}")

if __name__ == "__main__":
    main()
