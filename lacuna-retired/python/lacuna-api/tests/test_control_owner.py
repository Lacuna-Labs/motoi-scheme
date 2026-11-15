"""ONLY THE OWNER CAN APPROVE (the owner's review, 2026-10-18): a press is proof of the owner key (or a paired device's
secret), never the `who` a caller claims. Filing stays open to everyone."""
from __future__ import annotations

import importlib.util
import json
import os
import shutil
import subprocess
import sys
import time
from pathlib import Path

import pytest

from lacuna_api.control import owner as _owner  # noqa: E402,F401 — imported at collection, like the other suites

REPO = Path(__file__).resolve().parents[2]


def mods():
    from lacuna_api.control import chat, core, owner
    return chat, core, owner


@pytest.fixture
def api(app_client, monkeypatch):
    """The API with QA's restart replaced (an approved qa-restart must not touch the real QA)."""
    from lacuna_api.control import services
    monkeypatch.setattr(services, "restart", lambda name, who, confirm=False: {"ok": True, "restarted": name})
    return app_client


def file(api, who="claude") -> str:
    r = api.post("/api/petitions", json={"action": "qa-restart", "reason": "a test"}, headers={"X-Lacuna-Who": who})
    assert r.status_code == 200 and r.json()["ok"]
    return r.json()["petition"]


def signed(pid, approve, key=None, t=None, device=None, secret=None):
    _, _, owner = mods()
    t = int(time.time() if t is None else t)
    h = {"X-Lacuna-Owner": owner.sign(secret or key or owner.key(), pid, approve, t), "X-Lacuna-Owner-T": str(t)}
    if device:
        h["X-Lacuna-Device"] = device
    return h


def state(api, pid):
    return next(p for p in api.get("/api/petitions").json() if p["id"] == pid)


# ── refused ────────────────────────────────────────────────────────────────────────────────────────────────────────
def test_filing_is_open_but_an_unsigned_yes_is_refused(api):
    pid = file(api, "claude")                                  # anyone may file a card
    for who in ("claude", "alfred", "lacuna"):
        r = api.post(f"/api/petitions/{pid}", json={"approve": True}, headers={"X-Lacuna-Who": who})
        assert r.status_code == 403 and r.json()["why"].startswith("only the owner's press approves; filing a card is fine")
    assert state(api, pid)["state"] == "waiting"
    r = api.post(f"/api/petitions/{pid}", json={"approve": False}, headers={"X-Lacuna-Who": "claude"})
    assert r.status_code == 403                                # a no is a decision too: it needs the press


def test_chat_decide_refuses_a_claimed_name():
    chat, core, owner = mods()
    pid = chat.file_petition("qa-restart", None, "a test", "claude")["petition"]
    out = chat.decide(pid, True, "alfred")
    assert out["ok"] is False and out["refused_press"] and chat._petitions[pid]["state"] == "waiting"
    rows = [json.loads(ln) for ln in core._audit_file().read_text().splitlines()]       
    assert rows[-1]["action"] == "petition.press-refused"


def test_forged_stale_and_replayed_presses_are_refused(api):
    pid = file(api)
    r = api.post(f"/api/petitions/{pid}", json={"approve": False}, headers=signed(pid, False, key=os.urandom(32)))
    assert r.status_code == 403                                # forged: another key
    r = api.post(f"/api/petitions/{pid}", json={"approve": True}, headers=signed(pid, False))
    assert r.status_code == 403                                # a signed no is not a yes
    other = file(api)
    r = api.post(f"/api/petitions/{pid}", json={"approve": False}, headers=signed(other, False))
    assert r.status_code == 403                                # signed for another card
    r = api.post(f"/api/petitions/{pid}", json={"approve": False}, headers=signed(pid, False, t=time.time() - 200))
    assert r.status_code == 403 and "stale" in r.json()["why"]
    h = signed(pid, False)
    r = api.post(f"/api/petitions/{pid}", json={"approve": False}, headers=h)
    assert r.status_code == 200 and r.json()["petition"]["state"] == "declined"
    assert r.json()["petition"]["decided_by"] == "owner-key"
    r = api.post(f"/api/petitions/{other}", json={"approve": False}, headers={**h})
    assert r.status_code == 403                                # replayed onto another card
    r = api.post(f"/api/petitions/{pid}", json={"approve": False}, headers=h)
    assert r.status_code == 403 and "already used" in r.json()["why"]


def test_the_owner_key_approves_whatever_name_is_claimed_and_the_audit_says_how(api):
    _, core, owner = mods()
    pid = file(api)
    r = api.post(f"/api/petitions/{pid}", json={"approve": True}, headers={"X-Lacuna-Who": "claude", **signed(pid, True)})
    assert r.status_code == 200 and r.json()["petition"]["state"] == "approved"
    rows = [json.loads(ln) for ln in core._audit_file().read_text().splitlines()]       
    row = next(x for x in rows if x["action"] == "petition.approved")
    assert row["decided_by"] == "owner-key" and row["id"] == pid
    k = Path(core.LACUNA_HOME) / "owner-key"
    assert oct(k.stat().st_mode & 0o777) == "0o600" and len(k.read_text().strip()) == 64


# ── the CLI ────────────────────────────────────────────────────────────────────────────────────────────────────────
def cli(monkeypatch, tty=True, who=None):
    spec = importlib.util.spec_from_file_location("lacuna_owner_t", REPO / "bin" / "lacuna_owner.py")
    lo = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(lo)
    _, core, _ = mods()
    monkeypatch.setattr(lo, "HOME", Path(core.LACUNA_HOME))
    monkeypatch.setattr(lo, "_is_terminal", lambda: tty)
    if who is None:
        monkeypatch.delenv("LACUNA_WHO", raising=False)
    else:
        monkeypatch.setenv("LACUNA_WHO", who)
    return lo


def test_the_cli_signs_with_the_key_file(api, monkeypatch):
    pid = file(api)
    lo = cli(monkeypatch)
    sent = {}

    def post(path, body, headers):
        sent.update(path=path, headers=headers)
        r = api.post(path, json=body, headers=headers)
        return r.status_code, r.json()
    monkeypatch.setattr(lo, "_post", post)
    out = lo.decide(pid, True)
    assert out["petition"]["state"] == "approved" and out["petition"]["decided_by"] == "owner-key"
    assert "X-Lacuna-Owner" in sent["headers"] and lo.owner_key().hex() not in json.dumps(sent)   # never the raw key


def test_the_cli_refuses_an_agent_or_a_pipe(api, monkeypatch):
    pid = file(api)
    with pytest.raises(SystemExit, match="only the owner's press"):
        cli(monkeypatch, who="claude").decide(pid, True)
    with pytest.raises(SystemExit, match="interactive terminal"):
        cli(monkeypatch, tty=False).decide(pid, True)
    assert state(api, pid)["state"] == "waiting"


# ── pairing a device ───────────────────────────────────────────────────────────────────────────────────────────────
def pair_phrase(monkeypatch, capsys) -> str:
    lo = cli(monkeypatch)
    lo.pair([])
    return capsys.readouterr().out.strip().splitlines()[0].strip()


def test_pairing_a_device_then_its_press_and_its_revoke(api, monkeypatch, capsys):
    _, core, owner = mods()
    phrase = pair_phrase(monkeypatch, capsys)
    assert len(phrase.split()) == 6
    assert oct((Path(core.LACUNA_HOME) / "owner-pairing.json").stat().st_mode & 0o777) == "0o600"
    assert not api.post("/api/owner/pair", json={"phrase": "wrong words entirely here now ok", "device": "desk"}).json()["ok"]
    r = api.post("/api/owner/pair", json={"phrase": phrase.upper().replace(" ", "-"), "device": "Desk Mac"}).json()
    assert r["ok"] and r["device"] == "desk-mac" and len(r["secret"]) == 64
    again = api.post("/api/owner/pair", json={"phrase": phrase, "device": "phone"}).json()
    assert not again["ok"] and "no pairing is waiting" in again["why"]           # one time only
    store = (Path(core.LACUNA_HOME) / "owner-devices.json")
    assert r["secret"] not in store.read_text() and oct(store.stat().st_mode & 0o777) == "0o600"   # kept hashed

    pid = file(api)
    secret = bytes.fromhex(r["secret"])
    h = signed(pid, False, secret=secret, device="desk-mac")
    out = api.post(f"/api/petitions/{pid}", json={"approve": False}, headers=h)
    assert out.status_code == 200 and out.json()["petition"]["decided_by"] == "device:desk-mac"
    assert [d["device"] for d in api.get("/api/owner/devices").json()] == ["desk-mac"]

    lo = cli(monkeypatch)
    lo.pair(["--revoke", "desk-mac"])
    pid2 = file(api)
    out = api.post(f"/api/petitions/{pid2}", json={"approve": False}, headers=signed(pid2, False, secret=secret, device="desk-mac"))
    assert out.status_code == 403 and out.json()["pair"] is True


def test_a_phrase_expires_and_five_wrong_tries_burn_it(api, monkeypatch, capsys):
    _, core, _ = mods()
    pair_phrase(monkeypatch, capsys)
    for _ in range(5):
        r = api.post("/api/owner/pair", json={"phrase": "nope", "device": "x"}).json()
    assert not r["ok"] and "five times" in r["why"]
    phrase = pair_phrase(monkeypatch, capsys)
    p = Path(core.LACUNA_HOME) / "owner-pairing.json"
    d = json.loads(p.read_text())
    d["until"] = time.time() - 1
    p.write_text(json.dumps(d))
    assert "no pairing is waiting" in api.post("/api/owner/pair", json={"phrase": phrase, "device": "x"}).json()["why"]


def test_a_device_another_key_paired_is_refused(api, monkeypatch, capsys):
    _, core, _ = mods()
    phrase = pair_phrase(monkeypatch, capsys)
    r = api.post("/api/owner/pair", json={"phrase": phrase, "device": "phone"}).json()
    (Path(core.LACUNA_HOME) / "owner-key").write_text(os.urandom(32).hex())        # the key rotated
    pid = file(api)
    out = api.post(f"/api/petitions/{pid}", json={"approve": False}, headers=signed(pid, False, secret=bytes.fromhex(r["secret"]), device="phone"))
    assert out.status_code == 403 and "pair it again" in out.json()["why"]


# ── the sandboxes deny the key ─────────────────────────────────────────────────────────────────────────────────────
SB = shutil.which("sandbox-exec") or "/usr/bin/sandbox-exec"
NODE = "/opt/homebrew/Cellar/node/26.0.0/bin/node"
REAL = "/Users/alfred/.lacuna"


def _can_sandbox() -> bool:
    try:
        return subprocess.run([SB, "-p", "(version 1)(allow default)", "/usr/bin/true"], capture_output=True, timeout=10).returncode == 0
    except OSError:
        return False


@pytest.mark.parametrize("profile", ["jail/lacuna.sb", "foreman/foreman.sb"])
def test_the_profiles_name_both_owner_files(profile):
    text = (REPO / "lacuna-box" / profile).read_text()
    for f in ("owner-key", "owner-devices.json", "owner-pairing.json"):
        assert f'(literal "{REAL}/{f}")' in text
    tail = text[text.index("THE OWNER'S PRESS"):]
    assert "(deny file-read* file-write*" in tail                       # the last word: later rules win


@pytest.mark.skipif(not _can_sandbox(), reason="sandbox-exec cannot run here (already inside a sandbox)")
@pytest.mark.parametrize("profile,runner", [("jail/lacuna.sb", ["/bin/cat"]),
                                            ("foreman/foreman.sb", [NODE, "-e", "process.stdout.write(require('fs').readFileSync(process.argv[1]))"])])
def test_the_sandboxes_cannot_read_the_owner_key(tmp_path, profile, runner):
    """A sandbox-exec probe, like the jail's own self-test: the profile with its owner paths moved to a tmp folder (the
    live ~/.lacuna is never written) must refuse the key and the devices file, and still read a file beside them."""
    if runner[0] == NODE and not os.path.exists(NODE):
        pytest.skip("no node at the foreman's path")
    probe = tmp_path / "probe"
    probe.mkdir()
    for f in ("owner-key", "owner-devices.json", "other.txt"):
        (probe / f).write_text("SECRET" if f != "other.txt" else "fine")
    text = (REPO / "lacuna-box" / profile).read_text().replace(f'"{REAL}/owner-', f'"{probe.resolve()}/owner-')
    sb = tmp_path / "p.sb"
    sb.write_text(text)
    run = lambda f: subprocess.run([SB, "-f", str(sb), *runner, str(probe.resolve() / f)], capture_output=True, text=True, timeout=30)  # noqa: E731
    assert run("other.txt").stdout == "fine"                           # the control: a neighbour is readable
    for f in ("owner-key", "owner-devices.json"):
        r = run(f)
        assert r.returncode != 0 and "SECRET" not in r.stdout


@pytest.mark.skipif(not (_can_sandbox() and os.path.exists(f"{REAL}/owner-key") and os.path.exists(f"{REAL}/jail/lacuna.sb")),
                    reason="no live key or live jail profile here")
def test_the_live_jail_cannot_read_the_live_key():
    r = subprocess.run([SB, "-f", f"{REAL}/jail/lacuna.sb", "/bin/cat", f"{REAL}/owner-key"], capture_output=True, text=True, timeout=30)
    assert r.returncode != 0 and not r.stdout.strip()
