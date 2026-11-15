# lacuna

Lacuna Labs dev environment orchestrator. Mind the gaps.

## Install

```bash
pip install --user .
```

That's the whole install. The `lacuna` command lands at `~/.local/bin/lacuna`.
Add that to your PATH if it isn't already:

```bash
export PATH="$HOME/.local/bin:$PATH"
```

Requires Python 3.10+. The only runtime dependency is
[`textual`](https://textual.textualize.io/).

## Commands

```
lacuna up              start project backend + open browser
lacuna tui             open the tabbed terminal UI (5 tabs)
lacuna trash list      show safe-deleted items
lacuna trash rm <p>    move a path into trash (not gone, just out of sight)
lacuna trash restore   put something back
lacuna projects add .  register the current dir as a project
lacuna doctor          verify install
```

## TUI tabs

1. **Repo** — directory tree + preview pane
2. **Server** — project backend status
3. **Logs** — live tail of `.project.log`
4. **Trash** — safe-delete inbox; `r` restores selected
5. **GitHub** — link list; `enter` opens in browser

Global keys: `tab` / `shift-tab` switch · `1..5` jump · `q` quit · `?` help.

## Safe-delete contract

No code in this package calls `os.remove`, `os.unlink`, `shutil.rmtree`, or
`Path.unlink` directly. Every delete routes through
`lacuna.trash.send_to_trash`, which moves the target to a timestamped bucket
under `~/.lacuna/trash/`. A daily cron purges items older than 30 days.

The contract is enforced by `scripts/audit-safedelete.sh` in the repo root.

## Tests

```bash
pip install --user pytest
python -m pytest tests/ -v
```

## License

MIT. See LICENSE in the repo root.
