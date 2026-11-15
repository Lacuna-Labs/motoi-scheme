"""A pytest plugin: the REAL clock reads as if it were TESTFIX_SHIFT_DAYS days later (or earlier). A test's own patch of
time.time still wins inside the test; only reads that bypass it — datetime.now(), date.today(), time.gmtime() — move.
Loaded with `-p testfix_shiftclock` (testfix puts this folder on PYTHONPATH). The stdlib's datetime classes are NOT
swapped globally (that changed third-party behavior); only the names bound in modules under TESTFIX_ROOT (never a
.venv or site-packages) are rebound — after collection, before each test's fixtures, and again before its body, so a
module a fixture imports lazily is caught too. Proven on the pinned shop-series test (2026-10-18): it passes with the
clock moved back to the day its fixture was recorded, and fails on every other day."""
import datetime as _dt
import os
import sys
import time as _time

SHIFT = float(os.environ.get("TESTFIX_SHIFT_DAYS") or 0) * 86400
ROOT = os.path.realpath(os.environ.get("TESTFIX_ROOT") or os.getcwd())
_real_dt, _real_date, _real_time = _dt.datetime, _dt.date, _time.time
_real = {"gmtime": _time.gmtime, "localtime": _time.localtime, "strftime": _time.strftime}


class _Meta(type):
    def __instancecheck__(cls, obj):
        return isinstance(obj, _real_date if cls is _D else _real_dt)

    def __subclasscheck__(cls, sub):
        return issubclass(sub, _real_date if cls is _D else _real_dt)


class _D(_real_date, metaclass=_Meta):
    @classmethod
    def today(cls):
        t = _real_date.fromtimestamp(_real_time() + SHIFT)
        return cls(t.year, t.month, t.day)


class _DT(_real_dt, metaclass=_Meta):
    @classmethod
    def now(cls, tz=None):
        return cls.fromtimestamp(_real_time() + SHIFT, tz)

    @classmethod
    def utcnow(cls):
        return cls.fromtimestamp(_real_time() + SHIFT, _dt.timezone.utc).replace(tzinfo=None)

    @classmethod
    def today(cls):
        return cls.fromtimestamp(_real_time() + SHIFT)


def _gmtime(secs=None):
    return _real["gmtime"](_real_time() + SHIFT if secs is None else secs)


def _localtime(secs=None):
    return _real["localtime"](_real_time() + SHIFT if secs is None else secs)


def _strftime(fmt, t=None):
    return _real["strftime"](fmt, _localtime() if t is None else t)


SWAP = {id(_real_dt): _DT, id(_real_date): _D, id(_real["gmtime"]): _gmtime, id(_real["localtime"]): _localtime,
        id(_real["strftime"]): _strftime, id(_real_time): lambda: _real_time() + SHIFT}


def _rebind():
    for mod in list(sys.modules.values()):
        f = getattr(mod, "__file__", None) or ""
        f = os.path.realpath(f) if f else ""
        if not f.startswith(ROOT + os.sep) or "/site-packages/" in f or "/.venv/" in f or f == os.path.realpath(__file__):
            continue
        for k, v in list(vars(mod).items()):
            new = SWAP.get(id(v))
            if new is not None:
                setattr(mod, k, new)


if SHIFT:
    _time.gmtime, _time.localtime, _time.strftime, _time.time = _gmtime, _localtime, _strftime, SWAP[id(_real_time)]


def pytest_collection_finish(session):
    if SHIFT:
        _rebind()


def pytest_runtest_setup(item):
    if SHIFT:
        _rebind()


def pytest_runtest_call(item):
    if SHIFT:                                   # modules a fixture imported lazily are bound by now
        _rebind()
