#!/usr/bin/env python3
"""Drive the row-2-5 insertion for alg + calc chapters."""
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))

from gen_rows import emit as gen_emit  # noqa: E402
import data_alg  # noqa: E402
import data_alg2  # noqa: E402
import data_calc  # noqa: E402
import rows_alg_a  # noqa: E402
from apply_rows import apply_rows  # noqa: E402


def build_alg():
    rows = {}
    # Generate from data files.
    for v in data_alg.VERBS + data_alg2.VERBS:
        # Skip placeholders (they exist in data_alg to mark hand-authored ones).
        if v.get('problem') == 'skip':
            continue
        rows[v['name']] = gen_emit(v)
    # Hand-authored overrides.
    for name, block in rows_alg_a.ROWS.items():
        rows[name] = block
    return rows


def build_calc():
    rows = {}
    for v in data_calc.VERBS:
        if v.get('problem') == 'skip':
            continue
        rows[v['name']] = gen_emit(v)
    return rows


def main():
    alg_path = "/Users/alfred/code/motoi-scheme/Scheme/reference/03-alg.slat"
    calc_path = "/Users/alfred/code/motoi-scheme/Scheme/reference/11-calc.slat"

    alg_rows = build_alg()
    calc_rows = build_calc()

    print(f"alg rows built: {len(alg_rows)}")
    print(f"calc rows built: {len(calc_rows)}")

    a_applied, a_missing = apply_rows(alg_path, alg_rows)
    c_applied, c_missing = apply_rows(calc_path, calc_rows)

    print(f"alg applied: {a_applied}, missing: {a_missing}")
    print(f"calc applied: {c_applied}, missing: {c_missing}")


if __name__ == '__main__':
    main()
