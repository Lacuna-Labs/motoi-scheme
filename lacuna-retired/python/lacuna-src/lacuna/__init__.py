"""Lacuna Labs dev environment. Mind the gaps."""

# Version is the single source of truth in pyproject.toml. Reading it
# from package metadata at import time prevents drift between the
# packaging layer and the runtime layer (the 0.3.0 / 0.4.0 split this
# replaces was operator-visible across `lacuna version`, `--version`,
# and every log record).
from importlib.metadata import PackageNotFoundError as _PackageNotFoundError
from importlib.metadata import version as _pkg_version

try:
    __version__ = _pkg_version("lacuna")
except _PackageNotFoundError:
    # Source checkout without an install — fall back to a marker so
    # callers can detect the situation rather than seeing a stale string.
    __version__ = "0.0.0+source"
