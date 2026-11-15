"""Safe-delete contract for Lacuna.

No other module in this package may call ``os.remove``, ``os.unlink``,
``shutil.rmtree``, or ``Path.unlink`` directly. Every delete MUST route
through :func:`send_to_trash`.

The trash folder lives at ``~/.lacuna/trash/`` and is organized by
timestamped bucket: ``~/.lacuna/trash/<YYYYMMDD-HHMMSS-NNN>/``.

Cron purges entries older than :data:`TRASH_RETENTION_DAYS` via
``lacuna trash purge``.

Audit: ``scripts/audit-safedelete.sh`` greps the source for forbidden
delete calls. CI runs it on every PR.
"""
from __future__ import annotations

import json
import os
import random
import shutil
from dataclasses import dataclass, asdict
from datetime import datetime, timezone, timedelta
from enum import Enum
from pathlib import Path
from typing import Optional

from .config import Paths
from . import log


TRASH_RETENTION_DAYS = 30


class EntryKind(str, Enum):
    FILE = "file"
    DIRECTORY = "directory"
    CONTAINER = "container"
    SYMLINK = "symlink"


@dataclass
class TrashEntry:
    id: str
    original_path: str
    trashed_path: str
    trashed_at: str       # RFC3339 UTC
    kind: str             # EntryKind value
    reason: Optional[str] = None

    def to_dict(self) -> dict:
        return asdict(self)

    @classmethod
    def from_dict(cls, d: dict) -> "TrashEntry":
        return cls(**d)


def _make_id() -> str:
    ts = datetime.now(timezone.utc).strftime("%Y%m%d-%H%M%S")
    suffix = random.randint(0, 999)
    return f"{ts}-{suffix:03d}"


def send_to_trash(
    src: Path,
    kind: EntryKind = EntryKind.FILE,
    reason: Optional[str] = None,
) -> TrashEntry:
    """Move `src` into the trash.

    This is the ONLY sanctioned delete path in the Lacuna codebase.
    Returns the TrashEntry that was written.

    L3 fix: does NOT call .resolve() — symlinks are trashed as-is,
    leaving the symlink target untouched.
    """
    src = Path(src)  # do NOT call .resolve() — that follows symlinks
    if not (src.exists() or src.is_symlink()):
        raise FileNotFoundError(f"cannot trash non-existent path: {src}")

    paths = Paths.init()
    entry_id = _make_id()
    bucket = paths.trash_dir / entry_id
    bucket.mkdir(parents=True, exist_ok=True)

    filename = src.name if src.name else "unnamed"
    trashed_path = bucket / filename

    # Atomic move on same filesystem; fallback to copy+remove on cross-device.
    try:
        src.rename(trashed_path)
    except OSError:
        # Cross-device or permission issue — copy then remove original.
        # Preserve symlinks: never follow them into their targets.
        if src.is_symlink():
            link_target = os.readlink(src)
            os.symlink(link_target, trashed_path)
        elif src.is_dir():
            shutil.copytree(src, trashed_path, symlinks=True)
        else:
            shutil.copy2(src, trashed_path, follow_symlinks=False)

        if not (trashed_path.exists() or trashed_path.is_symlink()):
            raise RuntimeError("copy verification failed; original preserved")

        # SAFE-DELETE EXCEPTION: original content is now in trash.
        if src.is_symlink():
            src.unlink()  # noqa: allowed-after-copy-to-trash
        elif src.is_dir():
            shutil.rmtree(src)  # noqa: allowed-after-copy-to-trash
        else:
            src.unlink()  # noqa: allowed-after-copy-to-trash

    entry = TrashEntry(
        id=entry_id,
        original_path=str(src),
        trashed_path=str(trashed_path),
        trashed_at=datetime.now(timezone.utc).isoformat(),
        kind=kind.value if isinstance(kind, EntryKind) else str(kind),
        reason=reason,
    )
    (bucket / "manifest.json").write_text(json.dumps(entry.to_dict(), indent=2))

    log.info("trash", f"{src} → {trashed_path} ({entry_id})")
    return entry


def restore(entry_id: str) -> TrashEntry:
    """Restore a trashed entry to its original location.

    Refuses if the original path is now occupied (no silent overwrites).
    Handles symlinks: checks both .exists() and .is_symlink() so broken
    symlinks at the original location also block the restore.
    """
    paths = Paths.init()
    bucket = paths.trash_dir / entry_id
    manifest_path = bucket / "manifest.json"
    if not manifest_path.exists():
        raise FileNotFoundError(f"no trash entry with id '{entry_id}'")

    entry = TrashEntry.from_dict(json.loads(manifest_path.read_text()))

    target = Path(entry.original_path)
    if target.exists() or target.is_symlink():
        raise FileExistsError(f"refuse to overwrite: something already exists at {target}")

    target.parent.mkdir(parents=True, exist_ok=True)
    Path(entry.trashed_path).rename(target)

    # Tidy the now-empty bucket. SAFE-DELETE EXCEPTION: trash bookkeeping only.
    try:
        manifest_path.unlink()  # noqa: trash-own-bookkeeping
    except FileNotFoundError:
        pass
    try:
        bucket.rmdir()  # noqa: trash-own-bookkeeping
    except OSError:
        pass

    log.info("trash", f"restore: {entry.trashed_path} → {entry.original_path}")
    return entry


def list_all() -> list[TrashEntry]:
    """Return all trash entries, newest first."""
    paths = Paths.init()
    if not paths.trash_dir.exists():
        return []

    entries: list[TrashEntry] = []
    for bucket in paths.trash_dir.iterdir():
        if not bucket.is_dir():
            continue
        manifest = bucket / "manifest.json"
        if not manifest.exists():
            continue
        try:
            entries.append(TrashEntry.from_dict(json.loads(manifest.read_text())))
        except Exception as e:
            log.warn("trash", f"malformed manifest at {manifest}: {e}")

    entries.sort(key=lambda e: e.trashed_at, reverse=True)
    return entries


def purge_old() -> int:
    """Purge entries older than TRASH_RETENTION_DAYS. Returns count purged."""
    cutoff = datetime.now(timezone.utc) - timedelta(days=TRASH_RETENTION_DAYS)
    purged = 0
    for entry in list_all():
        try:
            trashed_at = datetime.fromisoformat(entry.trashed_at)
        except ValueError:
            continue
        if trashed_at < cutoff:
            _purge_entry(entry.id)
            purged += 1
    log.info("trash", f"purge: removed {purged} entries older than {TRASH_RETENTION_DAYS} days")
    return purged


def empty_all() -> int:
    """Permanently remove ALL trash entries. Caller is responsible for confirmation."""
    entries = list_all()
    count = len(entries)
    for e in entries:
        _purge_entry(e.id)
    log.info("trash", f"empty: removed {count} entries")
    return count


def _purge_entry(entry_id: str) -> None:
    """Internal: permanently remove one bucket. This is the ONLY sanctioned
    hard-delete path, scoped to the trash bookkeeping we own.
    """
    paths = Paths.init()
    bucket = paths.trash_dir / entry_id
    if not bucket.exists():
        return
    # SAFE-DELETE EXCEPTION: purging expired trash we explicitly own.
    shutil.rmtree(bucket)  # noqa: sanctioned-trash-purge
