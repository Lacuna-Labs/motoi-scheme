"""Import this FIRST in any local-model script. It makes phoning home crash.

Three layers, because a promise in a comment is not a check:

  1. Hugging Face / transformers are forced into offline mode, so model loading
     reads the local cache and never asks a server whether there is a newer file.
  2. `socket.socket.connect` is wrapped. Any attempt to open a connection to
     anything but loopback raises `OfflineViolation` with the address it tried to
     reach. There is no allowlist and no env var to switch it off.
  3. `subprocess` is wrapped. Layer 2 only guards THIS process, so a script that
     shells out to a metered CLI would sail straight past it — which is exactly
     how the emitters were built. Spawning a billing CLI now raises.

So "this script makes no API calls" stops being something you have to take on
trust: if it ever did, the run would die and name the host or the binary.
"""
import os
import socket
import subprocess

os.environ.setdefault('HF_HUB_OFFLINE', '1')
os.environ.setdefault('TRANSFORMERS_OFFLINE', '1')
os.environ.setdefault('HF_DATASETS_OFFLINE', '1')
os.environ.setdefault('ANONYMIZED_TELEMETRY', 'False')


class OfflineViolation(RuntimeError):
    pass


_LOOPBACK = ('127.0.0.1', '::1', 'localhost', '0.0.0.0', '')


def _host_of(address):
    if isinstance(address, tuple) and address:
        return address[0]
    return None


def _install():
    real_connect = socket.socket.connect
    real_connect_ex = socket.socket.connect_ex

    def guard(fn):
        def wrapped(self, address, *a, **kw):
            if self.family in (socket.AF_INET, socket.AF_INET6):
                host = _host_of(address)
                if host not in _LOOPBACK:
                    raise OfflineViolation(
                        f'network call blocked: this script is local-only, '
                        f'something tried to reach {address!r}'
                    )
            return fn(self, address, *a, **kw)
        return wrapped

    socket.socket.connect = guard(real_connect)
    socket.socket.connect_ex = guard(real_connect_ex)


# Binaries that spend money per invocation. Matched on the basename of argv[0],
# so `claude`, `/usr/local/bin/claude` and `npx claude` are all caught.
_METERED = frozenset(('claude', 'claude-cli', 'anthropic', 'openai', 'llm',
                      'gemini', 'gcloud-ai', 'aws'))


def _argv0(args):
    if isinstance(args, (str, bytes)):
        args = os.fsdecode(args).split()
    try:
        first = args[0]
    except (TypeError, IndexError):
        return None
    return os.path.basename(os.fsdecode(first))


def _install_subprocess():
    real_popen_init = subprocess.Popen.__init__

    def guarded_init(self, args, *a, **kw):
        name = _argv0(args)
        if name in _METERED:
            raise OfflineViolation(
                f'metered CLI blocked: this script is local-only, something '
                f'tried to spawn {name!r}. Use backend="local" (resident MLX).'
            )
        return real_popen_init(self, args, *a, **kw)

    subprocess.Popen.__init__ = guarded_init


_install()
_install_subprocess()


def selftest():
    rc = 0
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        s.settimeout(2)
        s.connect(('api.anthropic.com', 443))
        print('offline guard FAILED — the connection SUCCEEDED')
        rc = 1
    except OfflineViolation as e:
        print('socket guard OK —', e)
    except Exception as e:  # noqa: BLE001 - any other failure means it wasn't blocked
        print(f'socket guard FAILED — connection was attempted, got {type(e).__name__}: {e}')
        rc = 1

    try:
        subprocess.run(['claude', '-p', 'hello'],  # GUARD-SELFTEST
                       capture_output=True)
        print('spawn guard FAILED — the metered CLI ran')
        rc = 1
    except OfflineViolation as e:
        print('spawn guard OK —', e)
    except Exception as e:  # noqa: BLE001
        print(f'spawn guard FAILED — spawn was attempted, got {type(e).__name__}: {e}')
        rc = 1

    # A guard that blocks everything is useless — prove the local path still runs.
    try:
        subprocess.run(['true'], capture_output=True, timeout=10)
        print('passthrough OK — non-metered binaries still run')
    except Exception as e:  # noqa: BLE001
        print(f'passthrough FAILED — {type(e).__name__}: {e}')
        rc = 1
    return rc


if __name__ == '__main__':
    raise SystemExit(selftest())
