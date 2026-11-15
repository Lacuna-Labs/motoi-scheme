"""The foreman protocol from Lacuna's side (§36, B43): a sealed message opens; unsigned, forged, stale, replayed and
malformed ones are dropped and counted; and the foreman's own reader (node) opens what Python sealed, and back."""
from __future__ import annotations

import json
import shutil
import subprocess
from pathlib import Path

import pytest

from lacuna_api.control import slatwire

KEY = "k" * 48
FOREMAN = Path(__file__).resolve().parents[2] / "lacuna-foreman"


def test_a_sealed_message_opens_with_its_body_whole():
    body = {"ticket": "w1-2", "ok": True, "result": [{"name": "a \"b\"\n", "mb": 1.5, "n": None}], "empty": []}
    r = slatwire.open_(KEY, slatwire.seal(KEY, "lacuna", "w-1", "hand", body))
    assert r["ok"] and r["msg"]["body"] == body and r["msg"]["kind"] == "hand"


def test_every_bad_message_is_dropped_and_counted():
    before = dict(slatwire.DROPS)
    env = slatwire.seal(KEY, "lacuna", "w-1", "ping", 1)
    assert slatwire.open_(KEY, {"kind": "ping", "value": 1})["drop"] == "unsigned"
    assert slatwire.open_(KEY, {**env, "sig": "0" * 64})["drop"] == "forged"
    assert slatwire.open_(KEY, {**env, "slat": env["slat"].replace("(body 1)", "(body 2)")})["drop"] == "forged"
    assert slatwire.open_(KEY, slatwire.seal(KEY, "lacuna", "w-1", "ping", 1, at=1000.0))["drop"] == "stale"
    assert slatwire.open_(KEY, env)["ok"]
    assert slatwire.open_(KEY, env)["drop"] == "replayed"
    bad = "(msg (v 1) (from \"x\"))"
    assert slatwire.open_(KEY, {"slat": bad, "sig": slatwire._mac(KEY, bad)})["drop"] == "malformed"
    assert {k: slatwire.DROPS[k] - before[k] for k in before} == {"unsigned": 1, "forged": 2, "stale": 1, "replayed": 1, "malformed": 1}


@pytest.mark.skipif(not shutil.which("node"), reason="node is not here")
def test_python_and_the_foreman_read_each_other():
    body = {"rows": [{"path": "~/x", "mb": 12.25}], "yes": False, "what": "restart \"vite\""}
    env = slatwire.seal(KEY, "lacuna", "w-1", "answer", body)
    js = ("import('./protocol.mjs').then(({Gate, seal}) => {"
          f"const g = new Gate({json.dumps(KEY)}, () => Date.now() / 1000);"
          f"const r = g.open({json.dumps(env)});"
          f"const back = seal({json.dumps(KEY)}, {{from: 'foreman:t', to: 'lacuna', kind: 'upstream', body: r.msg.body, at: Date.now() / 1000}});"
          "console.log(JSON.stringify({r, back}))})")
    out = json.loads(subprocess.run(["node", "-e", js], cwd=FOREMAN, capture_output=True, text=True, check=True).stdout)
    assert out["r"]["ok"] and out["r"]["msg"]["body"] == body
    back = slatwire.open_(KEY, out["back"])
    assert back["ok"] and back["msg"]["body"] == body
