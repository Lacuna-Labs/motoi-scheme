# The Sakura Scheme REPL — feature bar

A one-page cheat sheet of what the REPL does. If a command below rings
the wrong bell, `,help` at the prompt has the details. If you want
narrative, `docs/REPL.md`.

## Feature bar (shipped)

### The input line
- Fuzzy tab-complete (env + doc table)
- Syntax highlighting per keystroke
- Rainbow parens by depth
- Ghost signature hints in the row above
- Auto-close `(`, `[`, `"`
- Multi-line balanced-Enter editing
- Vim mode (`keybindings: vim`) — insert / normal, `h/j/k/l/w/b/0/$/x/u/:q`
- Ctrl-R fuzzy history search
- Ctrl-O opens the current buffer in `$EDITOR`

### Rich display
- Bordered ASCII tables for long number lists
- Column tables for same-length rows
- Key/value grids for plain objects (hash-tables)
- Braille graphics for `(circle …)` / `(disc …)` / `(line …)` / `(rect …)`
- **Inline image router** — iTerm2, WezTerm, kitty, Sixel, Braille fallback

### Named results
- `_`, `_1` … `_9` bind to prior results
- Use them anywhere: `(* _ 2)` doubles the last answer

### Meta-commands

Help + docs

    ,help              ,help <sym>      ,type <sym>        ,doc <sym>
    ,arity <sym>       ,examples <sym>  ,source <sym>

Exploration

    ,apropos <regex>   ,namespace <ns>  ,search <regex>

Timing + expansion

    ,time <expr>       ,expand <form>   ,expand-1 <form>

**Watch + trace**

    ,watch <expr>      ,unwatch         ,trace <fn>        ,untrace <fn>
    ,inspect <val>

**Live reload**

    ,watch-file <path> [--yes-all]    ,unwatch-file [path]

**Session**

    ,save <file>.slat  ,load <file>.slat [--yes-all]
    ,undo              ,reset

**Graphics**

    ,image             — report iTerm2 / kitty / WezTerm / Sixel availability

Escape hatches

    ,shell <cmd>       ,ask sakura "…"  ,clear   ,keys   ,exit / ,quit

### Trace details (v1.1)

`,trace fn` wraps the current binding for `fn`. Every call prints
`→ fn args` at the current indent; every return prints `← fn = result`.
Nested traces multiplex on shared indent depth:

    sakura> ,trace fib
    sakura> (fib 3)
    → fib 3
      → fib 2
        → fib 1
        ← fib = 1
        → fib 0
        ← fib = 0
      ← fib = 1
      → fib 1
      ← fib = 1
    ← fib = 2

`,untrace fn` restores the original binding exactly. `,untrace` with
no arg lifts every active trace.

### Inspect walker (v1.1)

`,inspect` (or `,inspect <expr>`) opens an arrow-key walker over the
value tree:

    ↑ ↓    move between siblings
    →      descend into the focused child
    ←      ascend one level
    Enter  bind the current focus to `_` and quit
    q Esc  quit without binding

Non-compound values print inline and offer only `←` and quit.

### Live reload (v1.1)

`,watch-file path/to/lib.scm` starts an `fs.watch` on the file, loads
its `define`s into the current environment, and re-runs them any time
the file changes. Bindings that already exist require confirmation
unless `--yes-all` was passed. Multiple watches can run at once. Bare
`,unwatch-file` stops all of them.

### Session replay (v1.1)

`,save session.slat` writes a SLAT-lite file with three sections:
`## defines`, `## history` (base64), and `## results`. `,load` replays
the defines against the current env (per-binding confirmation unless
`--yes-all`), restores the history, and rebinds `_` through `_9`. The
round-trip is stable — save, load into a fresh REPL, keep going.

### Inline image router (v1.1)

Graphics automatically render through the richest inline protocol the
terminal supports. Detection is env-driven (`TERM_PROGRAM`, `TERM`,
`KITTY_WINDOW_ID`, `COLORTERM`) — no TTY probes, no waits. The order
of preference:

1. iTerm2 (also picked up on WezTerm)
2. kitty graphics
3. Sixel
4. Braille (always available)

`,image` reports what the router found for the current shell.
`SCHEME_LANG_FORCE_BRAILLE=1` pins the fallback (used by tests).

## Roadmap (v1.2+)

- Full paredit (splurge / slurp / kill-form / select-form). Auto-close
  plus `Ctrl-W` gets 80% of the way today.
- Notebook mode (`--web` / `.snb`).
- Real `,ask sakura` wire — the plumbing is here; the endpoint spec
  belongs to Sakura.
- LSP mode.
