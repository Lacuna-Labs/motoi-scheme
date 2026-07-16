"""Python binding for the slat serialization format.

Mirrors the JavaScript binding at ``bindings/js/slat.js``. Both bindings
implement the same on-the-wire format; a shared fixture set under
``tests/vectors.slat`` verifies they round-trip identically.
"""

from .reader import SlatSyntaxError, SlatValue, load, loads
from .writer import dumps, dump, dumps_pretty
from .jsonl import slat_to_jsonl, jsonl_to_slat

__all__ = [
    "SlatSyntaxError",
    "SlatValue",
    "load",
    "loads",
    "dump",
    "dumps",
    "dumps_pretty",
    "slat_to_jsonl",
    "jsonl_to_slat",
]
