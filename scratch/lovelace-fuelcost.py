#!/usr/bin/env python3
"""Measure minimum fuel for a program by doubling, then report."""
import sys, importlib.util
from pathlib import Path
sys.path.insert(0, '/Users/alfred/code/motoi-scheme/scratch')
_s = importlib.util.spec_from_file_location('lf', '/Users/alfred/code/motoi-scheme/scratch/lovelace-fuel.py')
lf = importlib.util.module_from_spec(_s); _s.loader.exec_module(lf)


def min_fuel(code, start=200_000, cap=80_000_000, timeout=300):
    """Return (fuel_that_worked_or_None, last_category)."""
    f = start
    while f <= cap:
        c, i, o, e = lf.cat(code, fuel=f, timeout=timeout)
        if 'fuel exhausted' not in (i or '').lower():
            return f, c, i
        f *= 4
    return None, 'fuel', 'exceeded cap'
