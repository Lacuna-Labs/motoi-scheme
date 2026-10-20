#!/usr/bin/env python3
"""Combine hand-authored + generated rows and apply to alg + calc slats."""
import sys
from pathlib import Path

HERE = Path(__file__).parent
sys.path.insert(0, str(HERE))

import gen_rows
import data_alg
import data_alg2
import data_calc
import rows_alg_a  # hand-authored takes precedence


def combine(*sources):
    """Merge dict sources; later sources override earlier ones."""
    combined = {}
    for s in sources:
        if isinstance(s, dict):
            combined.update(s)
        else:
            for k, v in s.items():
                combined[k] = v
    return combined


def main():
    # Generate rows for each data source
    alg_gen = gen_rows.build(data_alg.VERBS + data_alg2.VERBS)
    calc_gen = gen_rows.build(data_calc.VERBS)

    # Overlay hand-authored on top of generated
    alg_rows = combine(alg_gen, rows_alg_a.ROWS)
    print(f'alg: {len(alg_rows)} verbs, calc: {len(calc_gen)} verbs',
          file=sys.stderr)

    # Save to modules that apply_rows can import
    for name, data in [('_alg_rows_out', alg_rows), ('_calc_rows_out', calc_gen)]:
        p = HERE / f'{name}.py'
        with p.open('w') as f:
            f.write('# auto-generated\nROWS = {\n')
            for k, v in sorted(data.items()):
                # Repr with triple-quote to preserve newlines cleanly.
                escaped = v.replace('\\', '\\\\').replace('"""', '\\"\\"\\"')
                f.write(f'    {k!r}: r"""{v}""",\n')
            f.write('}\n')

    # Apply
    import apply_rows
    alg_target = '/Users/alfred/code/motoi-scheme/Scheme/reference/03-alg.slat'
    calc_target = '/Users/alfred/code/motoi-scheme/Scheme/reference/11-calc.slat'
    print('=== ALG ===', file=sys.stderr)
    apply_rows.apply_rows(alg_target, alg_rows)
    print('=== CALC ===', file=sys.stderr)
    apply_rows.apply_rows(calc_target, calc_gen)


if __name__ == '__main__':
    main()
