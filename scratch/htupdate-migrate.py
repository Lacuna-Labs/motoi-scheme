#!/usr/bin/env python3
"""Migrate hash-table-update! plain-value-default calls for strict SRFI-125.

Strict SRFI-125: (hash-table-update! h k updater [failure [success]]) — the 4th
arg is a FAILURE THUNK, not a plain seed value; a missing key with no failure
raises. Corpus written against old semantics used a plain VALUE as the 4th arg.
The behavior-preserving conformance fix is: 4-arg plain-value form ->
hash-table-update!/default.

Reuses find_calls/split_args/target_files from htref-migrate.py.

Modes:
  analyze  — dry run: report every call, argc, and arg4 shape.
  migrate  — rewrite exactly-4-arg plain-value calls to hash-table-update!/default.
             Leaves 3-arg (raises on miss, strict) and 4-arg thunk-form
             (arg4 starts with '(lambda') untouched; reports 5-arg for review.
"""
import sys, importlib.util

# import htref-migrate.py helpers without running its main()
_src = open("scratch/htref-migrate.py").read().replace(
    'if __name__ == "__main__":\n    main()', '')
_m = importlib.util.module_from_spec(
    importlib.util.spec_from_file_location("htref", "scratch/htref-migrate.py"))
exec(compile(_src, "htref", "exec"), _m.__dict__)

HEAD = "hash-table-update!"

def main():
    mode = sys.argv[1] if len(sys.argv) > 1 else "analyze"
    files = _m.target_files()
    n_convert = n_3arg = n_thunk = n_5arg = 0
    review = []
    for f in files:
        with open(f) as fh:
            text = fh.read()
        calls = _m.find_calls(text, HEAD)
        if not calls:
            continue
        new = text
        changes = 0
        for (a, b, call) in reversed(calls):
            args = _m.split_args(call, HEAD)
            argc = len(args)
            if argc <= 3:
                n_3arg += 1
                continue
            arg4 = args[3]
            if arg4.startswith("(lambda"):
                n_thunk += 1
                continue
            if argc >= 5:
                n_5arg += 1
                review.append((f, "ARGC>=5: " + call[:80]))
                continue
            # exactly 4 args, plain value -> /default
            n_convert += 1
            if mode == "migrate":
                converted = "(hash-table-update!/default" + call[len("(hash-table-update!"):]
                new = new[:a] + converted + new[b:]
                changes += 1
        if mode == "migrate" and changes:
            with open(f, "w") as fh:
                fh.write(new)
            print(f"  migrated {changes:3d}  {f}")
    print(f"\n=== {mode} summary ===")
    print(f"  4-arg plain-value -> /default : {n_convert}")
    print(f"  3-arg (strict raise on miss)  : {n_3arg}")
    print(f"  4-arg thunk-form (strict)     : {n_thunk}")
    print(f"  5-arg (manual review)         : {n_5arg}")
    if review:
        print("\n  Manual-review sites:")
        for f, c in review:
            print(f"    {f}\n      {c}")

if __name__ == "__main__":
    main()
