"""Round-trip test for the Python slat binding.

Shares fixture vectors with the JS binding at
``../../../tests/vectors.slat``.
"""

from __future__ import annotations

import pathlib
import sys

# Add parent so `import slat` resolves.
sys.path.insert(0, str(pathlib.Path(__file__).parent.parent))

from slat import loads, dumps  # noqa: E402


FIXTURES_PATH = pathlib.Path(__file__).parent.parent.parent.parent / "tests" / "vectors.slat"


def test_round_trip_shared_vectors() -> None:
    with open(FIXTURES_PATH, "r", encoding="utf-8") as fp:
        lines = [ln.strip() for ln in fp if ln.strip() and not ln.startswith(";")]
    assert len(lines) > 0, "no vectors"
    for line in lines:
        parsed = loads(line)
        emitted = dumps(parsed)
        reparsed = loads(emitted)
        assert parsed == reparsed, f"round-trip failed for: {line}"


if __name__ == "__main__":
    test_round_trip_shared_vectors()
    print("OK")
