#!/usr/bin/env python3
"""Verify every `export const TESTS` assertion in lib/ against the engine.

The books are not the only substrate whose `=>` claims get lifted verbatim
into CPT: emit_cpt_v5's F-lib-tests shape prints each lib smoke test as

    ```
    <expr>
    ; => <expected>
    ```

Nothing in the test suite ever RUNS those assertions, so a stale one is
training text asserting a value the interpreter does not produce — the same
defect that put 85 wrong claims into the last corpus source.

This runs each one and writes the set that actually holds. The emitter emits
only those. It fails SAFE: an assertion we cannot confirm is dropped, never
rewritten, and the file shrinks to nothing as lib is repaired.

  python3 scratch/build_lib_tests_gate.py
"""
import json
import os
import re
import subprocess
import sys
from pathlib import Path

REPO = Path("/Users/alfred/code/motoi-scheme")
OUT = REPO / "scratch" / "cpt-lib-tests-verified.json"

sys.path.insert(0, str(REPO / "scripts" / "cpt-prep"))
import emit_cpt_v5 as em  # noqa: E402

ENV = {**os.environ, "MOTOI_HOME": "/tmp/mx"}


def norm(s: str) -> str:
    return re.sub(r"\s+", " ", (s or "").strip())


def main():
    verified: dict[str, list[list[str]]] = {}
    ok = bad = err = 0
    failures = []

    for path in sorted((REPO / "lib").rglob("*.js")):
        m = em._LIB_TESTS_RE.search(path.read_text(errors="replace"))
        if not m:
            continue
        rel = str(path.relative_to(REPO))
        for expr, want in em._parse_tests_literal(m.group(1)):
            try:
                r = subprocess.run([str(REPO / "bin" / "motoi"), "eval", expr],
                                   capture_output=True, text=True, env=ENV,
                                   timeout=60, cwd=REPO)
            except subprocess.TimeoutExpired:
                err += 1
                failures.append(("TIMEOUT", rel, expr, want, ""))
                continue
            got = norm(r.stdout)
            if r.returncode != 0 or not got:
                err += 1
                failures.append(("ERROR", rel, expr, want,
                                 norm(r.stderr)[:120] or "(no output)"))
            elif got == norm(want) or norm(want) in got:
                ok += 1
                verified.setdefault(rel, []).append([expr, want])
            else:
                bad += 1
                failures.append(("WRONG", rel, expr, want, got))

    OUT.write_text(json.dumps(verified, indent=1))

    for v, rel, expr, want, got in failures:
        print(f"{v} {rel}\n   expr: {expr}\n   want: {want!r}\n   got : {got!r}")
    total = ok + bad + err
    print(f"\nlib TESTS: {ok} verified / {bad} wrong / {err} error  (of {total})")
    print(f"-> {OUT.relative_to(REPO)}")


if __name__ == "__main__":
    main()
