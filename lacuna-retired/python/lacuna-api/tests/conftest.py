"""Shared pytest fixtures for lacuna-api tests.

The vendored ~/.lacuna/ filesystem is redirected to a per-test tmp dir via
LACUNA_HOME so tests can't pollute the user's real state.
"""
from __future__ import annotations

import os
from pathlib import Path

import pytest

# NO TEST REACHES THE CURATOR (2026-10-08): the watcher's minute pass asks the dev API's Mentat health check
# (control/mentat.py). Its address points at a closed port, and every test gets a quiet answer in its place.
os.environ["LACUNA_MENTAT_URL"] = "http://127.0.0.1:9/api/mentat/observe"
os.environ["LACUNA_NO_CLOUD"] = "1"          # a test never reaches the cloud seat (cloud.py): no outside call from a test, ever

# NO TEST WRITES THE REAL ~/.lacuna, EVEN AT IMPORT (2026-10-18): importing the app logs a "boot" to sessions.jsonl
# (lacuna/state.py, which reads LACUNA_HOME) — before a fixture could redirect it, test runs wrote fake boots into the
# live log. The whole session starts in a throwaway home; each test still gets its own below.
import tempfile  # noqa: E402

os.environ["LACUNA_HOME"] = tempfile.mkdtemp(prefix="lacuna-test-home-")
# and the whole session's world is a throwaway one too (2026-11-01): a thread a test starts may outlive the test, and
# between one test's teardown and the next one's setup LACUNA_WORLD was unset, so a module that reads it at each call read
# the live ~/lacuna-world; each test still gets its own world below (own_world)
os.environ["LACUNA_WORLD"] = tempfile.mkdtemp(prefix="lacuna-test-world-")


def _quiet_mentat(monkeypatch):
    import sys
    m = sys.modules.get("lacuna_api.control.mentat")
    if m is None:
        from lacuna_api.control import mentat as m
    monkeypatch.setattr(m, "_get", lambda path, params=None, timeout=10: (
        (200, b'{"ok": true, "checked_at": 0, "alerts": []}', "application/json") if path == "/health"
        else (503, b'{"why": "no curator in tests"}', "application/json")))
    m._last.update(t=0.0, v=None)


@pytest.fixture(autouse=True)
def quiet_mentat(monkeypatch):
    _quiet_mentat(monkeypatch)


@pytest.fixture(autouse=True)
def own_world(tmp_path, monkeypatch):
    """SELF.slat and the run artifacts go to the test's own folder (the chat writes SELF.slat when it builds a prompt),
    and the self-portrait does not read the live foreman or the real jobs."""
    monkeypatch.setenv("LACUNA_SELF", str(tmp_path / "world" / "SELF.slat"))
    monkeypatch.setenv("LACUNA_ARTIFACTS", str(tmp_path / "world" / "artifacts"))
    monkeypatch.setenv("LACUNA_SELF_LIVE", "0")
    # the forge's reader and its watcher (forge.py, forge_verbs.section in the minute pass) read the world and keep their
    # marks under LACUNA_HOME: a test never reads the live forge or says its transitions to the live desk
    monkeypatch.setenv("LACUNA_WORLD", str(tmp_path / "world"))
    if not os.environ.get("LACUNA_HOME"):
        monkeypatch.setenv("LACUNA_HOME", str(tmp_path / "lacuna-home"))
    monkeypatch.setenv("LACUNA_CASCADE", str(tmp_path / "world" / "cascade"))
    # trained minds' roles (minds_roles.py): a test's own box-minds.json, no gateway restart, a gateway that never answers
    monkeypatch.setenv("LACUNA_BOX_MINDS", str(tmp_path / "world" / "box-minds.json"))
    monkeypatch.setenv("LACUNA_GATEWAY_LABEL", "")
    monkeypatch.setenv("LACUNA_GATEWAY_URL", "http://127.0.0.1:9")


# ★ NO TEST BUILDS OR INSTALLS THE IPAD APP (2026-11-01: a watcher pass in the suite, and then the lead's own new test on a
# stale module after an app_client test, started real Xcode builds of main bound for her iPad; P-2026-11-01-ipad-refresh-loop).
# Every process a test starts that names the real build or install tools FAILS the test; a stand-in of the same name in
# tmp_path runs (test_release_modes' cut.sh).
_TOOLBOX = Path(__file__).resolve().parents[2] / "toolbox"
_DEVICE = (str(_TOOLBOX / "build-ipad.sh"), str(_TOOLBOX / "install-ipad.sh"), "tools/env/ota-ipad.sh")


class DeviceReached(AssertionError):
    pass


@pytest.fixture(autouse=True)
def never_her_ipad(monkeypatch):
    import subprocess
    real_init = subprocess.Popen.__init__

    def init(self, args, *a, **k):
        words = [args] if isinstance(args, (str, bytes, os.PathLike)) else list(args)
        text = " ".join(os.fsdecode(w) if isinstance(w, (bytes, os.PathLike)) else str(w) for w in words)
        if any(d in text for d in _DEVICE):
            raise DeviceReached("a test tried to build or install the iPad app: stand in for start_job where the code imports it")
        return real_init(self, args, *a, **k)
    monkeypatch.setattr(subprocess.Popen, "__init__", init)


# ★ NO TEST WRITES THE LIVE ~/.lacuna (2026-10-18: a forge test's petitions were audited as "filed" and "approved" by
# alfred in the real audit.jsonl — core.audit writes to core.LACUNA_HOME, fixed at import). Every write-mode open of a
# path under the real ~/.lacuna now FAILS the test, and the module-level paths that point there are moved to tmp_path.
REAL_LACUNA = (Path.home() / ".lacuna").resolve()
_WRITES = set("wax+")


class LiveLacunaWrite(AssertionError):
    pass


def _guarded_open(real_open):
    def opener(file, mode="r", *a, **k):
        if isinstance(file, (str, os.PathLike)) and _WRITES & set(str(mode)):
            try:
                target = Path(os.fspath(file)).resolve()
            except (OSError, ValueError):
                target = None
            if target is not None and (target == REAL_LACUNA or REAL_LACUNA in target.parents):
                raise LiveLacunaWrite(f"a test tried to write the LIVE {target} — use tmp_path / LACUNA_HOME")
        return real_open(file, mode, *a, **k)
    return opener


@pytest.fixture(autouse=True)
def never_the_live_lacuna(tmp_path, monkeypatch):
    import builtins
    import io
    guarded = _guarded_open(io.open)
    monkeypatch.setattr(builtins, "open", guarded)
    monkeypatch.setattr(io, "open", guarded)
    home = tmp_path / "lacuna-core"
    for d in ("logs", "jobs", "builds", "drafts", "work"):
        (home / d).mkdir(parents=True, exist_ok=True)
    from lacuna_api.control import chat, core, workers
    if True:                                    # every test its own home (the session's throwaway one is shared)
        monkeypatch.setenv("LACUNA_HOME", str(home))                      # the env and core agree, per test
        monkeypatch.setattr(core, "LACUNA_HOME", home)
        monkeypatch.setattr(chat, "PETITIONS", home / "petitions.json")
        monkeypatch.setattr(chat, "_petitions", {})
        monkeypatch.setattr(chat, "DRAFTS", home / "drafts")
        monkeypatch.setattr(workers, "NOTIFY_FILE", home / "notify.json")
        monkeypatch.setattr(workers, "_SAID", home / "alert-state.json")
    yield


@pytest.fixture
def lacuna_home(tmp_path, monkeypatch) -> Path:
    """Redirect ~/.lacuna/ to a per-test tmp dir."""
    home = tmp_path / ".lacuna"
    home.mkdir()
    monkeypatch.setenv("LACUNA_HOME", str(home))
    return home


@pytest.fixture
def app_client(lacuna_home, monkeypatch):
    """A FastAPI TestClient with a clean state dir.

    Re-imports lacuna_api.app inside the fixture so the TestClient sees
    the redirected LACUNA_HOME (some module-level state initializes at
    import time).
    """
    # Force a clean import each test so module-level constants resolve
    # against the current LACUNA_HOME.
    import sys
    for mod in [m for m in list(sys.modules) if m.startswith("lacuna_api")]:
        del sys.modules[mod]

    from fastapi.testclient import TestClient
    from lacuna_api.app import app
    _quiet_mentat(monkeypatch)
    # the Door admits loopback clients only; the TestClient's default client is ("testclient", 50000)
    return TestClient(app, client=("127.0.0.1", 50000))


@pytest.fixture
def press():
    """The owner's press, signed with the test's own owner key (control/owner.py): press(pid, approve) → the proof."""
    import time as _t

    def sign(pid: str, approve: bool, t: float | None = None) -> dict:
        from lacuna_api.control import owner
        t = int(_t.time() if t is None else t)
        return {"sig": owner.sign(owner.key(), pid, approve, t), "t": t}
    return sign
