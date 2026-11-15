"""control/stacks.py: SIGINFO writes every thread's Python stack to stderr, by name, and the process lives on; the hook
arms once. The API's own process is never signaled: the proof runs in a child Python with the conftest's throwaway home."""
from __future__ import annotations

import os
import re
import signal
import subprocess
import sys
import textwrap
from pathlib import Path

import pytest

API = Path(__file__).resolve().parents[1]


@pytest.mark.skipif(not hasattr(signal, "SIGINFO"), reason="SIGINFO is the BSDs' and macOS's")
def test_siginfo_writes_every_threads_stack_by_name_and_the_process_lives():
    child = textwrap.dedent("""
        import os, signal, threading, time
        from lacuna_api.control import stacks
        assert stacks.arm() is True
        assert stacks.arm() is False, "the hook arms once"
        def a_pool_thread_inside_a_long_parse():
            time.sleep(5)
        threading.Thread(target=a_pool_thread_inside_a_long_parse, daemon=True).start()
        time.sleep(0.2)
        os.kill(os.getpid(), signal.SIGINFO)
        time.sleep(0.2)
        print("alive")
    """)
    r = subprocess.run([sys.executable, "-c", child], cwd=API, env=dict(os.environ), capture_output=True, text=True, timeout=30)
    assert r.returncode == 0, r.stderr[-2000:]
    assert r.stdout.strip() == "alive"
    assert "a_pool_thread_inside_a_long_parse" in r.stderr, r.stderr[-2000:]
    assert len(re.findall(r"^(?:Current thread|Thread) 0x", r.stderr, re.M)) >= 2, "every thread, not the current one alone"
