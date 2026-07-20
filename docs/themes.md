# Themes

Motoi ships with two themes and lets you write your own. Every REPL, TUI, and browser IDE surface reads the same theme file, so a color decision made once shows up everywhere.

## Switching themes

At the command line:

```bash
motoi tui                        # default — Sakura
motoi tui --theme hacker         # 80s phosphor terminal
motoi tui --hacker               # same as --theme hacker
motoi tui --theme <yourname>     # your own theme from ~/motoi/themes/

motoi repl --theme hacker        # the REPL respects themes too
motoi --theme hacker eval "(+ 1 2)"
```

Or by environment variable, which sticks across a whole shell session:

```bash
export MOTOI_THEME=hacker
motoi tui
motoi repl
```

Resolution order (highest wins):

1. `--theme <name>` on the command line
2. `MOTOI_THEME` environment variable
3. `--hacker` (shorthand for `--theme hacker`)
4. `sakura` (default)

## Where themes live

Themes ship inside the repo at:

```
<motoi-install>/themes/sakura.slat
<motoi-install>/themes/hacker.slat
```

On first run, Motoi copies both files into your home directory:

```
~/motoi/themes/sakura.slat
~/motoi/themes/hacker.slat
```

The user directory takes precedence, so you can edit `~/motoi/themes/sakura.slat` and reload Motoi to see your changes. If a file becomes broken or missing, Motoi falls back to the shipped copy silently.

To add your own theme, drop a file at `~/motoi/themes/<name>.slat` and pass `--theme <name>`.

## The shipped themes

### Sakura — cherry blossom · soft · warm

The default. Motoi's canonical look — soft pink blossoms, mint leaves, cedar-warm trunk, pearl page. Feels like paper. Reads well in daylight.

Signature colors: `pink`, `mint`, `cedar`, `pearl`, `cream`. The 16 Sakura blossom-named colors (`cherry`, `petal`, `tea-rose`, `gold`, `amber`, `sage`, `moss`, `plum`, `lavender`, `mist`, `cobalt`, `coral`, `terracotta`, plus `black` and `white`) are all first-class and available under any theme.

### Hacker — phosphor · monochrome · retro-terminal

For people who don't want pink. Reads like a VT220 in a submarine bay. Everything is a shade of green over black, with amber highlights on prompts and warnings. No blossoms — the tree stems and petals are all phosphor. Boot splash reads `M O T O I   S C H E M E` in bright green over dim scanlines.

Signature colors: `void`, `shadow`, `phosphorDim`, `phosphorDeep`, `phosphorMid`, `phosphor`, `phosphorBright`, `phosphorGlow`, plus `amber` / `amberBright` for accents.

## Schema

A theme file is a line-delimited SLAT (S-expression per line). Three form types:

```lisp
;; Header — declares the theme's identity.
(theme :name "<name>" :aesthetic "<one-line prose>")

;; Named color — an RGB triple you can reference by name.
(color :name "<colorname>" :rgb (R G B))

;; Semantic role — which color paints which UI element.
(role :name "<rolename>" :color "<colorname>")
```

Comments start with `;`. Order doesn't matter — parsing is form-by-form.

### Roles the TUI paints

If a role is missing from your theme, the loader fills it in from the Sakura fallback so nothing breaks. This is the full list:

```
bg          bgPanel      bgHover
fg          fgDim
border      borderDim
focus       accent       muted
primary     primaryDark
secondary   secondaryDark
tertiary    tertiaryDark
danger      warning      success
prompt      cursor       selection
stripe1     stripe2      stripe3
statusBar   statusInk
titleBar    titleInk
codeParen   codeString   codeComment  codeIdent
ghost
splashTree  splashLeaves splashTrunk
splashTitle splashHint   splashBlossom
```

### Minimal example

Save as `~/motoi/themes/mono.slat`:

```lisp
(theme :name "mono" :aesthetic "pure monochrome · print on paper")

(color :name "paper" :rgb (250 250 245))
(color :name "ink"   :rgb ( 20  20  20))
(color :name "gray"  :rgb (140 140 140))

(role :name "bg"      :color "paper")
(role :name "bgPanel" :color "paper")
(role :name "fg"      :color "ink")
(role :name "fgDim"   :color "gray")
(role :name "border"  :color "gray")
(role :name "primary" :color "ink")
(role :name "accent"  :color "ink")
(role :name "danger"  :color "ink")
;; anything you don't set inherits from the Sakura fallback.
```

Then:

```bash
motoi tui --theme mono
```

## Palette vocabulary

Motoi's built-in RGB constants match Sakura's 16-color fantasy console palette so a color named `cherry` is the same red in both languages. You can reference these names directly in a theme without redeclaring them:

```
black         cherry       petal        tea-rose     cream
gold          amber        sage         moss         plum
lavender      mist         cobalt       coral        terracotta
white
```

Plus Motoi's own softer tints:

```
pink   pinkDark   mint   mintDark   cedar   cedarDark
pearl  pearlLight pearlShadow  creamDark  ink
```

A theme's `(color …)` declarations override any built-in with the same name — that's how the Hacker theme repaints `pink` as bright phosphor green so panel code that references "pink" for focus rings still works, but paints green.

## Notes

- Themes are hermetic. No network, no CDN, no fonts — just RGB and role names.
- No emojis in theme files. Ink names carry semantic weight; keep them literal.
- Order doesn't matter inside a theme file.
- Empty lines and `;` comments are skipped by the parser.
- The user directory (`~/motoi/themes/`) is authoritative; the shipped directory is the fallback.
