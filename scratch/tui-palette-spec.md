# Motoi TUI palette — locked 2026-07-19

Alfred: *"Do the same on the TUI but the background is black."*

The **three cherry-tree colors** carry the brand identity across every
surface (web IDE, TUI, book cover, VitePress site, favicon, everything).
Only the whites differ per surface:

- **Web IDE** → whites are **pearl** (`#f4ecdc` + variants)
- **TUI** → whites are **black** (terminal-native dark theme)

Same three-stripe cherry-tree logo, same pink blossom / mint leaves /
cedar earth, same order (top to bottom). Only the background flips.

## TUI palette (canonical values)

Copy these exact hexes into whatever renderer the TUI uses
(blessed / neo-blessed / custom ANSI / termcolor). If the terminal
only supports 256-color, fall back to the nearest xterm-256 index.

```
Role                Hex        xterm-256   Notes
──────────────────  ─────────  ──────────  ────────────────────────────────
background          #000000    232         pure black (or #0a0a0a for OLED comfort)
foreground (text)   #f4ecdc    230         pearl — same as web pearl
foreground (dim)    #bfb497    144         cream-dark for dim text
border              #6b4a34    58          cedar-dark for borders (readable on black)
panel bg (subtle)   #0f0d0a    233         near-black lift for interior panels
hover / selection   #1a1410    234         cedar-tinted dark for hover

── the three cherry-tree colors (identity — NEVER change these) ──
pink (blossom)      #f4a0b5    218         top stripe
pink-dark           #a8546c    132         used for danger + close-tab hover
mint (leaves)       #9fe3c5    121         middle stripe
mint-dark           #3d9d6b    72          accent for readable-on-black spans
cedar (earth)       #a37152    137         bottom stripe
cedar-dark          #6b4a34    58          border + secondary accent
```

## Stripe order (top to bottom)

```
▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓  ← pink blossom  #f4a0b5
▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓  ← mint leaves   #9fe3c5
▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓  ← cedar earth   #a37152
```

Small vertical gap between each stripe (one row of background between
the pink → mint and mint → cedar). Reads as a hamburger-menu-thick
banner. Same silhouette as the web IDE, inverted for dark.

## ASCII tree logo — mint on black

The ASCII tree renders in mint (`#9fe3c5`, xterm-256 121) against the
black background. Same tree used in the web IDE (locked, do not
redesign). MOTOI SCHEME wordmark to the right of the tree, in pearl
(`#f4ecdc`), aligned to the tree's vertical center.

## Regions

Same 4-region layout as the web IDE:

```
┌─────────────────────────────────────────────────────────────────────┐
│ ▓ pink  ▓ mint  ▓ cedar                                             │  stripe row
│   /\    MOTOI SCHEME                            [file] [help] [q]   │  header
│  /  \                                                                │
│ /____\                                                               │
├──────────┬──────────────────────────────────┬───────────────────────┤
│ PROJECT  │ EDITOR                            │ REPL                  │
│          │                                    │                       │
│ book/    │  (edit .scm here — vim OR         │  motoi> (+ 1 2)       │
│ ├ ml/    │   emacs input mode, toggled       │  3                    │
│ ├ code/  │   from bottom bar)                │  motoi> _             │
│ └ craft/ │                                    │                       │
│          │                                    │                       │
│ carts/   │                                    │                       │
│ ...      │                                    │                       │
├──────────┴──────────────────────────────────┴───────────────────────┤
│ NORMAL │ book/of/ml/ch16.scm │ ln 42 col 8 │ mint accents on black    │
└─────────────────────────────────────────────────────────────────────┘
```

- Frames drawn in cedar-dark (`#6b4a34`) — visible on black without
  glare
- Region titles ("PROJECT", "EDITOR", "REPL") in mint-dark
  (`#3d9d6b`) uppercase small-caps
- Active tab underlined in mint (`#9fe3c5`)
- Status bar background pure black; text pearl
- Cursor: pearl block cursor, no blink

## Syntax highlighting (in the editor pane)

Cherry-tree family carries into syntax:

- Keywords (`define`, `lambda`, `let`, etc.) — **mint** `#9fe3c5`
- Strings — **pink** `#f4a0b5`
- Numbers — **cedar** `#a37152`
- Comments — cream-dark `#bfb497` italic (or dim per terminal support)
- Parens (rainbow, cycles) — mint · pink · cedar · pearl · mint · …
- Errors — pink-dark `#a8546c` underline

## Input modes

- **Vim mode** — default. Modal. `hjkl`, `:w`, `:q`, `dd`, etc.
- **Emacs mode** — toggled via config or `:set emacs`.
  `C-x C-s`, `C-x C-c`, `C-a`, `C-e`, `M-w`, etc.
- Both share the same underlying buffer + edit primitives; only the
  key mapping differs.

Bottom status bar shows current mode (`NORMAL` / `INSERT` / `VISUAL`
for vim; `EMACS` for emacs mode).

## Composability with the web IDE

Anyone who's used the web IDE recognizes the TUI in ten seconds:

- Same three-color stripe
- Same ASCII tree logo
- Same MOTOI SCHEME wordmark
- Same 4-region layout
- Same panel titles
- Same tab bar
- Same REPL prompt (`motoi> `)

Only the whites flip. Kids on a Chromebook see pearl; devs in a
terminal see black; same brand.

---

*This file is a hand-off for the Motoi TUI lane. Once the TUI lands,
promote the relevant sections into `engineering/MOTOI-TUI-ENGINEERING.md`
(canonical eng doc) and archive this scratch file.*
