"""control/lacuna_cortex.py: a test's throwaway home reaches no broker, so no test writes into Lacuna's memory
(P-2026-11-01-tests-wrote-the-live-cortex: bound to the real home at import, the suite's remember calls wrote test
facts over live ones, a fake owner grant among them). The socket is asserted inside the throwaway home before any call."""
from __future__ import annotations

import os

from lacuna_api.control import lacuna_cortex


def test_a_tests_home_reaches_no_broker_and_a_remember_never_lands():
    home = os.environ["LACUNA_HOME"]
    assert home and os.path.realpath(home) != os.path.realpath(os.path.expanduser("~/.lacuna")), "the conftest's home"
    sock = lacuna_cortex._sock()
    assert sock.startswith(home) and not os.path.exists(sock), "no broker in a test's home"
    r = lacuna_cortex.remember("fact", "a-test-fact-that-never-lands", {"text": "x"})
    assert r.get("ok") is False and "did not answer" in str(r.get("error"))
