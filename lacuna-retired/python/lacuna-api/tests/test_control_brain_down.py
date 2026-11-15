"""THE DESK WORKS WITH THE BRAIN DOWN (the finish, E6 startup check). Every read the desk polls answers — quickly, with
honest words — when the brain (:8091), its gateway (:11434), the foreman and every other socket refuse. A hung brain
is held to the reads' own timeouts; a refused one costs nothing."""
import time
import urllib.error
import urllib.request

import pytest

DESK_POLLS = ["/api/home", "/api/home/series?names=disk_free_gb&hours=1", "/api/home/board?screen=desk",
              "/api/minds/live", "/api/petitions", "/api/logs?env=dev&limit=10&quiet=true", "/api/security",
              "/api/caliper/run"]   # /api/triggers and /api/drills/targets are the door's (no brain in either read)


@pytest.fixture
def nothing_answers(monkeypatch):
    calls = []

    def refused(req, *a, **kw):
        url = req.full_url if hasattr(req, "full_url") else str(req)
        calls.append(url)
        raise urllib.error.URLError("refused (the brain is down in this test)")
    monkeypatch.setattr(urllib.request, "urlopen", refused)
    return calls


@pytest.fixture
def desk():
    # the app as already imported (app_client re-imports every module, which splits the modules later test files hold)
    from fastapi.testclient import TestClient

    from lacuna_api.app import app
    return TestClient(app, client=("127.0.0.1", 50000))


@pytest.mark.parametrize("path", DESK_POLLS)
def test_every_desk_read_answers_with_the_brain_down(desk, nothing_answers, path):
    t0 = time.time()
    r = desk.get(path)
    took = time.time() - t0
    assert r.status_code == 200, f"{path} → {r.status_code}: {r.text[:200]}"
    assert took < 5, f"{path} took {took:.1f} s with the brain down"
