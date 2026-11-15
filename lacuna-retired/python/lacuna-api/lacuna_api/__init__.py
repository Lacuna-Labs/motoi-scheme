"""lacuna-api — HTTP surface for the Lacuna web console.

Hosts /ctl/* endpoints (operator-facing). Reads/writes Lacuna's own state
under ~/.lacuna/. Has no awareness of, or dependency on, sibling products.
"""

VERSION = "0.1.0"

from .app import app  # re-exported so `uvicorn lacuna_api:app` resolves

__all__ = ["VERSION", "app"]
