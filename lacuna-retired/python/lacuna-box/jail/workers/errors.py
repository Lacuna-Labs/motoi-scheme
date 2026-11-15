"""The words a worker class and run.py share (one module, so `except NotNow` catches what a class raises)."""


class NotNow(Exception):
    """The class cannot run now (the GPU lease is someone else's); the runner tries again in five minutes."""
