# The Sakura Scheme REPL

The Sakura Scheme REPL is the interactive way to talk to the language.
Type an expression, press Enter when it's balanced, get a result. Type
`,help` to see the command list.

This doc covers everything you can do at the prompt: keybindings,
meta-commands, rich display, tab completion, graphics, and the
launcher.

## Two binaries

```
scheme-lang        the launcher (neutral — discovers dialects)
sakura-scheme      the Sakura dialect binary
```

`scheme-lang` is what you type by default. It scans for installed
dialects and either drops you into the only one, shows a picker for
multiple, or launches the specific one you name (`scheme-lang sakura`).

`sakura-scheme` is the underlying dialect — you can call it directly
if you already know what you want.

## Starting the REPL

```
$ scheme-lang
```

or

```
$ sakura-scheme
```

You'll see the Sakura banner and land at `sakura>` .

Non-interactive uses:

```
$ scheme-lang sakura eval "(+ 1 2)"
3

$ scheme-lang sakura run examples/hello.scm

$ scheme-lang sakura help map
```

`sakura-scheme` accepts the same subcommands (`eval`, `run`, `help`,
`repl`).

## Input line

Everything about the REPL input line is designed to fade — you don't
notice syntax highlighting, ghost hints, or rainbow parens until you'd
miss them.

### Syntax highlighting

Every keystroke re-renders. Keywords (`define`, `lambda`, `let`,
`cond`) get a cool blue-gray; strings and comments get muted green;
numbers get amber; the parens cycle through six rainbow colors by
depth.

### Rainbow parens

Matching parens are the same color. Nesting cycles through a small
closed palette so no depth level gets a garish color.

### Ghost signature hints

As you type inside a form, the row **above** the input dims to show
the head verb's signature:

```
  ⤷ (map fn lst)   Apply fn to each element, return list of results.
sakura> (map (lambda (x) (* x _
```

Turn off with `ghost-hints: #f` in `~/.scheme-lang/config.slat`.

### Auto-close parens

Type `(` — you get `()` with the cursor between. Same for `[` and
`"`. Type the closing character while sitting on one and the cursor
skips over it (no double-close). Type `Backspace` right after
auto-close and both chars go together.

Disable with `auto-close-parens: #f` in config.

### Multi-line editing

Enter evaluates when the input is balanced. If parens or strings
aren't closed, Enter adds a new line and shows a `~>` continuation
prompt.

Shift-Enter (or Alt-Enter) always adds a new line, even when balanced,
in case you want to keep typing after a closed form.

## Tab completion

Fuzzy. Not just prefix.

- Type `mp` + Tab → `map`
- Type `fil` + Tab → `filter`
- Type `ca` + Tab → `car`; Tab again cycles to `cadr`, `caddr`

When multiple candidates share a common prefix beyond what you've
typed, Tab advances to that prefix. Tab again cycles through
candidates.

Meta-commands complete too: `,he` + Tab → `,help`.

The completion source is the live environment plus every symbol
mentioned in the core doc-table.

## Named results

- `_`  — last result
- `_1` — result from one prompt ago
- `_2` — two prompts ago
- ...  up to `_9`

Use them anywhere. `(* _ 2)` doubles the previous answer.

## Rich display

Return values render as more than raw S-expressions when the shape
warrants:

- **Number list of length > 12** → bordered ASCII table, N per row
- **List of same-length rows** → column table with header separator
- **Plain object (hash-table)** → key/value grid with column dividers
- **Graphic value** (`'(circle 100 100 50)` etc.) → Braille rendering

Everything else falls back to colored S-expression form.

## Graphics — it's filled with stars

Type a shape and the REPL fills the screen with stars. That's how Sakura
puts it. Under the hood: a 2×4 subpixel Braille grid, where each glyph
covers 8 dots, so a 40-char-wide render is an 80×80 dot picture — plenty
for a readable circle, a line, a plot.

The shape verbs are real functions in the base — call them directly:

```
(circle 40 40 15)             outline circle
(disc   40 40 20)             filled disc
(line   0 0 60 30)            line segment
(rect   10 10 60 30)          outlined rectangle
```

You can also hand the REPL the tagged-list data yourself:

```
'(circle 40 40 15)
```

Or the JS-object form (for programmatic use):

```
{ kind: 'graphic', shapes: [['circle', 40, 40, 15], …] }
{ kind: 'plot',    data:   [1 2 3 4 5], w: 40, h: 10 }
```

Color defaults to sakura pink; override with `:fill` or `:stroke`
metadata (v1.1).

If your terminal supports iTerm2, WezTerm, kitty, or Sixel, the REPL
automatically routes graphics to the richest inline protocol available.
Braille remains the universal fallback so a plain xterm still gets a
picture. Type `,image` to see what your terminal advertises. Set
`SCHEME_LANG_FORCE_BRAILLE=1` to force the fallback (useful in tests).

## Meta commands

Every REPL command starts with `,`. Type `,help` for the full list;
here's the ones you'll actually use:

### Help + docs
- `,help`                    — the command list
- `,help <sym>`              — arity + doc + examples for a verb
- `,type <sym>`              — just the signature
- `,doc <sym>`               — just the docstring
- `,arity <sym>`             — just the arity
- `,examples <sym>`          — the three tiered examples

### Exploration
- `,apropos <regex>`         — every bound symbol whose name matches
- `,namespace <ns>`          — every verb in a namespace prefix
- `,search <regex>`          — regex over doc + example text

### Timing + expansion
- `,time <expr>`             — wall time + fuel + heap delta
- `,expand <form>`           — macroexpand
- `,expand-1 <form>`         — one-step macroexpand

### Watch + trace
- `,watch <expr>`            — reprint the value at every prompt
- `,unwatch`                 — clear the watch
- `,trace <fn>`              — log every call to `fn` with nested indent
- `,untrace <fn>`            — remove one trace (or bare `,untrace` clears all)
- `,inspect <val>`           — walk into a value with arrow keys (TTY only)

### Live reload
- `,watch-file <path>`       — reload `.scm` defines when the file changes
- `,watch-file <path> --yes-all` — silently overwrite existing bindings
- `,unwatch-file <path>`     — stop watching one file
- `,unwatch-file`            — stop watching every file

### Session
- `,save <file>.slat`        — dump defines + history + `_` results
- `,load <file>.slat`        — replay the defines, restore history + `_`s
- `,load <file> --yes-all`   — skip the per-binding confirmation
- `,undo`                    — pop the last result
- `,reset`                   — reset the environment (stub)

### Graphics
- `,image`                   — report inline-image protocol availability

### Escape hatches
- `,shell <cmd>`             — pipe into the shell, print output
- `,ask sakura "…"`          — ask Sakura for help (requires config)
- `,clear`                   — clear the screen
- `,keys`                    — show key bindings
- `,exit` / `,quit`          — leave the REPL

### The flagship: `,ask sakura`

The idea: you type a natural-language question, the REPL sends it
along with the current session bindings and the last few evaluations,
and Sakura answers with runnable code you can Enter to eval.

Configure the endpoint at `~/.scheme-lang/config.slat`:

```
sakura-endpoint: http://localhost:8080/ask
sakura-token:    <bearer>
```

The wire is stubbed in v1.0 — `,ask sakura "…"` currently prints the
config hint. Real wiring is a follow-on.

## Keybindings

The full list is `,keys`. The load-bearing ones:

| Key                     | Action                                          |
| ----------------------- | ----------------------------------------------- |
| `Tab`                   | fuzzy complete symbol                           |
| `Shift-Tab`             | cycle backward through completions              |
| `Enter`                 | evaluate (if balanced) or add a newline         |
| `Shift-Enter` / `Alt-Enter` | force a newline                             |
| `Ctrl-C`                | cancel current input                            |
| `Ctrl-D`                | exit (on empty line)                            |
| `Ctrl-L`                | clear the screen                                |
| `Ctrl-A` / `Ctrl-E`     | start / end of line                             |
| `Ctrl-U` / `Ctrl-K`     | kill to start / end of line                     |
| `Ctrl-W`                | delete previous word                            |
| `Ctrl-R`                | reverse history search (fuzzy)                  |
| `Ctrl-O`                | open the current buffer in `$EDITOR`            |
| `Ctrl-Y`                | yank last kill                                  |
| `Up` / `Down`           | history                                         |
| `Left` / `Right`        | move cursor                                     |
| `Alt-B` / `Alt-F`       | word left / right                               |
| `Ctrl-]` / `Alt-]`      | paredit: barf-forward (splurge)                 |
| `Ctrl-\` / `Alt-S`      | paredit: slurp-forward                          |
| `Alt-[`                 | paredit: slurp-backward                         |
| `Alt-K`                 | paredit: kill enclosing form                    |
| `F1`                    | help for the symbol under the cursor            |

### Vim mode

Alfred is a vim guy — set:

```
;; ~/.scheme-lang/config.slat
keybindings: vim
```

In vim mode you land in **insert** mode by default. Press `Esc` to
enter **normal** mode. Supported normal-mode commands:

| Key   | Action                                     |
| ----- | ------------------------------------------ |
| `i`   | insert mode                                |
| `a`   | insert mode after cursor                   |
| `A`   | insert at end of line                      |
| `I`   | insert at start of line                    |
| `o`   | new line below                             |
| `h l` | move left / right                          |
| `j k` | history down / up                          |
| `w b` | word right / left                          |
| `0 $` | line start / end                           |
| `x`   | delete char under cursor                   |
| `u`   | clear the buffer                           |
| `:q`  | exit                                       |

For full vim, use `Ctrl-O` and edit in your actual `$EDITOR`.

### Ctrl-R history search

Press `Ctrl-R` at the prompt. Type what you remember from an earlier
input; the matching entry shows above the search prompt. `Ctrl-R`
again to cycle to the next match. Enter to accept, Esc to cancel.

## Config file

Location: `$XDG_CONFIG_HOME/scheme-lang/config.slat` (or
`~/.scheme-lang/config.slat`). SLAT-lite format:

```
;; comments start with ;;
keybindings:       vim         ;; 'vim | 'emacs | 'default
theme:             sakura      ;; 'sakura | 'neutral
auto-close-parens: #t
show-signature:    #t
ghost-hints:       #t
editor:            nvim
history-max:       5000
sakura-endpoint:   ;; set when you have one
sakura-token:      ;; bearer
```

Unknown keys are preserved (so you can leave tomorrow's settings today).

## History

Persistent per-user at `$XDG_STATE_HOME/scheme-lang/history` (or
`~/.scheme-lang/history`). Multi-line entries are stored one per
line (newlines encoded).

Max entries: 5000 (rotates).

## Dialect discovery

The launcher scans for installed dialects at:

1. `./dialect.json` (current directory)
2. `./scheme-lang/dialect.json`
3. `$XDG_DATA_HOME/scheme-lang/dialects/*/dialect.json`
4. `~/.scheme-lang/dialects/*/dialect.json`
5. `/usr/local/share/scheme-lang/dialects/*/dialect.json`
6. `$SCHEME_LANG_HOME/dialect.json`

The bundled Sakura dialect is discovered because the launcher lives
next to the Sakura `dialect.json` in this repo.

### Dialect manifest format

```json
{
  "name": "sakura",
  "displayName": "Sakura Scheme",
  "version": "1.0.0",
  "core": true,
  "entrypoint": "./bin/sakura-scheme",
  "tagline": "a language for humans and AI to program together"
}
```

`entrypoint` is a path relative to the manifest. The launcher runs
it with any leftover args. Zero args → your REPL. `eval "…"` etc.
are conventional but not enforced by the launcher.

## Shipped in v1.1

- `,trace <fn>` — per-call render with nested indent (see above).
- `,inspect <val>` — arrow-key value walker (see above).
- `,watch-file <path>` — live reload of `.scm` defines on save.
- `,save` / `,load` — full session replay: defines + history + `_`.
- Inline image router — iTerm2, WezTerm, kitty, Sixel, Braille fallback.
- Paredit — slurp / barf / kill-form key bindings (see keybindings).

## Not for v1.1 (coming in v1.2+)

Named on the tin so you don't wait for what isn't here:

- Extended paredit: splice, wrap-round, raise, transpose. Slurp/barf/
  kill-form ship in v1.1; the additional forms follow in v1.2.
- Notebook mode (`--web` / `.snb`).
- Real `,ask sakura` wiring — the REPL has the plumbing; the endpoint
  isn't wired.
- LSP mode.

## Not for the REPL, ever

- IDE features (file tree, project management, LSP integration). The
  REPL is a REPL.
- Automatic vendor-cloud lookups for autocomplete. The completion
  source is local: the env, the doc-table, the reference.
- Emojis in output text (banner uses one flower glyph on purpose).

## Design notes

- **Clean lines and intent to purpose.** Nothing in excess. The frame
  frames the frame that frames the code. Bauhaus, IKEA, KDE, Volvo,
  mid-century modern, brutalist — that discipline. 16 colors, warm
  center, no gradients, no animation.
- Every key is decoded from raw bytes — no `readline` dep.
- Rendering is clear-and-repaint per keystroke; under 1KB/keystroke
  for typical inputs.
- Startup latency budget: under 100ms cold (measured on Alfred's Mac
  Studio, 250ms first-launch, ~40ms subsequent).
- No animation, no ASCII fireworks, no "you did great" prompts. The
  point is code.
