"""The owner's half of the CLI (2026-10-18): the press signed with ~/.lacuna/owner-key, pairing a device, trained minds.

  lacuna petitions approve|decline <id>   signs the press with the owner key (the owner at his terminal; never a pipe)
  lacuna pair                             a six-word phrase, good once for 10 minutes: type it into the desk's permission
                                          card (or the phone) on its first press; that device then signs its own presses
  lacuna pair --list | --revoke <device>  the paired devices; unpair one
  lacuna minds [history]                  the trained minds in service: each role's version and the one before it
  lacuna minds rollback <role>            back to the previous version (a forge-rollback card, signed here, like any press)

Only an interactive terminal signs: Lacuna, the foreman and the workers cannot read the key (their sandboxes deny it), and a
process without a terminal (an agent's shell) is refused here. LACUNA_WHO other than the owner is refused too.
Standard library only (bin/lacuna imports it).
"""
import hashlib
import hmac
import json
import os
import secrets
import sys
import time
import urllib.error
import urllib.request
from pathlib import Path

HOME = Path(os.environ.get("LACUNA_HOME") or Path.home() / ".lacuna")
BASE = os.environ.get("LACUNA_URL", "http://127.0.0.1:1138")
OWNER_NAMES = ("", "alfred", "owner")
PAIR_MINUTES = 10
WORDS = """acorn amber anchor apple arrow aspen atlas autumn badge bakery bamboo banjo barley basil beacon bear berry birch
biscuit blossom bluebird bonfire branch bread breeze brook bucket butter cabin cactus camel candle canoe canyon carpet
carrot castle cedar cello chalk cherry chestnut cider cinnamon circle cliff clover cobalt comet compass copper coral
cotton cradle crane crayon creek cricket crystal cupboard daisy dancer delta desert dolphin dove dragon drum dune eagle
ember engine falcon feather fern fiddle field fig firefly flannel flute forest fossil fountain fox garden garnet ginger
glacier globe goose granite grape harbor harvest hazel heron hickory honey horizon husky iris island ivory jacket jasmine
jelly jigsaw juniper kettle kite koala ladder lagoon lantern lark lavender lemon library lily linen lotus lumber magnet
maple marble meadow melon mint mitten moon moss mountain muffin nectar needle nest nickel noodle nutmeg oasis oak ocean
olive onion orbit orchard otter owl paddle panda paper parsley pebble pepper piano pillow pine planet plum pocket pond
poppy prairie pumpkin quail quartz quilt rabbit radish rain raven reef ribbon river robin rocket saddle sage sail salmon
sandal satin scarf shell silver sketch sky sparrow spruce squirrel star stone storm sugar summit sun swan tablet teapot
thistle thunder tiger timber tomato topaz tulip tunnel turtle velvet violet walnut wave whistle willow window winter
wren yarrow zephyr zinnia""".split()


def _is_terminal() -> bool:
    return sys.stdin.isatty() and sys.stdout.isatty()


def _need_owner_terminal():
    who = os.environ.get("LACUNA_WHO", "").strip().lower()
    if who not in OWNER_NAMES:
        sys.exit(f"lacuna: refused — only the owner's press approves (LACUNA_WHO={who}); filing a card is fine")
    if not _is_terminal():
        sys.exit("lacuna: refused — the owner's press is signed only at an interactive terminal, never from a pipe or an agent")


def _write_private(p: Path, text: str):
    p.parent.mkdir(parents=True, exist_ok=True)
    tmp = p.with_name(f".{p.name}.{os.getpid()}.tmp")
    fd = os.open(tmp, os.O_WRONLY | os.O_CREAT | os.O_TRUNC, 0o600)
    with os.fdopen(fd, "w") as f:
        f.write(text)
    os.replace(tmp, p)


def owner_key() -> bytes:
    p = HOME / "owner-key"
    if not p.exists():
        _write_private(p, secrets.token_hex(32) + "\n")
    try:
        return bytes.fromhex(p.read_text().strip())
    except (OSError, ValueError) as e:
        sys.exit(f"lacuna: the owner key at {p} cannot be read ({e})")


def sign(key: bytes, pid: str, approve: bool, t: int) -> str:
    return hmac.new(key, f"{pid}:{'yes' if approve else 'no'}:{int(t)}".encode(), hashlib.sha256).hexdigest()


def _post(path: str, body: dict, headers: dict) -> tuple[int, dict]:
    req = urllib.request.Request(BASE + path, method="POST", data=json.dumps(body).encode(),
                                 headers={"Content-Type": "application/json", "X-Lacuna-Who": "alfred", **headers})
    try:
        with urllib.request.urlopen(req, timeout=300) as r:
            return r.status, json.loads(r.read().decode() or "null")
    except urllib.error.HTTPError as e:
        try:
            return e.code, json.loads(e.read().decode())
        except ValueError:
            return e.code, {"why": str(e)}
    except urllib.error.URLError as e:
        sys.exit(f"lacuna: the console on {BASE} did not answer ({e.reason})")


def decide(pid: str, approve: bool) -> dict:
    """The owner's press from his terminal: signed with the key file, the key itself never sent."""
    _need_owner_terminal()
    t = int(time.time())
    code, r = _post(f"/api/petitions/{pid}", {"approve": approve},
                    {"X-Lacuna-Owner": sign(owner_key(), pid, approve, t), "X-Lacuna-Owner-T": str(t)})
    if code >= 400 or not (r or {}).get("ok", False):
        sys.exit(f"lacuna: {(r or {}).get('why') or (r or {}).get('detail') or code}")
    return r


def pair(rest: list):
    _need_owner_terminal()
    devices_file = HOME / "owner-devices.json"
    try:
        devs = json.loads(devices_file.read_text()).get("devices") or {}
    except (OSError, ValueError):
        devs = {}
    if "--list" in rest:
        if not devs:
            print("no paired devices — `lacuna pair` makes a phrase for one")
        for n, d in devs.items():
            used = time.strftime("%m-%d %H:%M", time.localtime(d["last_used"])) if d.get("last_used") else "never"
            print(f"{n:<24} paired {time.strftime('%Y-%m-%d %H:%M', time.localtime(d.get('created') or 0))} · last press {used}")
        return
    if "--revoke" in rest:
        i = rest.index("--revoke")
        name = rest[i + 1] if i + 1 < len(rest) else ""
        if name not in devs:
            sys.exit(f"lacuna: no paired device named {name!r} — `lacuna pair --list`")
        del devs[name]
        _write_private(devices_file, json.dumps({"devices": devs}, indent=1))
        print(f"{name} is unpaired: its presses are refused from now on")
        return
    owner_key()                                            # a device's secret comes from the key: it must exist first
    phrase = " ".join(secrets.choice(WORDS) for _ in range(6))
    _write_private(HOME / "owner-pairing.json", json.dumps({"hash": hashlib.sha256(phrase.encode()).hexdigest(),
                                                            "until": time.time() + PAIR_MINUTES * 60, "tries": 0}))
    print(f"\n    {phrase}\n")
    print(f"Good once, for {PAIR_MINUTES} minutes. Press yes or no on a permission card on the desk (or the phone); it asks for "
          "these six words once, and that device signs its own presses from then on. `lacuna pair --list` shows the devices.")


def _get(path: str):
    try:
        with urllib.request.urlopen(BASE + path, timeout=30) as r:
            return json.loads(r.read().decode() or "null")
    except urllib.error.URLError as e:
        sys.exit(f"lacuna: the console on {BASE} did not answer ({e})")


def minds(rest: list):
    op = rest[0] if rest else "status"
    if op == "rollback":
        if len(rest) < 2:
            sys.exit("lacuna minds rollback <role>")
        _need_owner_terminal()
        code, r = _post("/api/forge/rollback", {"specialist": rest[1], "reason": "lacuna minds rollback, at the owner's terminal"}, {})
        if not (r or {}).get("petition"):
            sys.exit(f"lacuna: {(r or {}).get('refused') or (r or {}).get('why') or code}")
        out = decide(r["petition"], True)
        res = (out.get("petition") or {}).get("result") or {}
        print(res.get("said") or json.dumps(res, default=str))
        return
    r = _get("/api/minds/roles")
    if op == "history":
        for h in r.get("history") or []:
            print(f"{time.strftime('%m-%d %H:%M', time.localtime(h.get('t') or 0))}  {h.get('role'):<8} {h.get('event'):<16} "
                  f"{h.get('from') or '—'} → {h.get('to') or '—'}  {h.get('said') or ''}")
        return
    if not r.get("roles"):
        print("no trained mind is in service yet")
    for role, e in (r.get("roles") or {}).items():
        print(f"{role:<8} {e.get('version')}  (previous {e.get('previous') or '—'})  {e.get('model')}")


def release(skip_pass: bool) -> dict:
    """`lacuna release --yes` at the owner's terminal: the release route takes only the owner key's signature (2026-10-19)."""
    _need_owner_terminal()
    t = int(time.time())
    code, r = _post("/api/release", {"confirm": True, "skip_pass": skip_pass},
                    {"X-Lacuna-Owner": sign(owner_key(), "release", True, t), "X-Lacuna-Owner-T": str(t)})
    if code >= 400 or not (r or {}).get("ok", False):
        d = (r or {}).get("detail")
        sys.exit(f"lacuna: {(d or {}).get('why') if isinstance(d, dict) else d or (r or {}).get('why') or code}")
    return r
