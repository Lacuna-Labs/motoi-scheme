---
title: The Composer
titleTemplate: Make sounds, sprites, worlds
---

# The Composer

::: info
Every widget writes Scheme. Move a slider, a number changes in the file. Draw a pixel, a list changes in the file. Save it, open it in a text editor — you can still read it.
:::

<div class="motoi-terminal motoi-terminal--dark">
<span class="motoi-ansi-brightgreen">;; piano-roll — one measure, C major up the ladder</span>

  B  ................
  A  .............<span class="motoi-ansi-brightyellow">#</span>..
  G  ...........<span class="motoi-ansi-brightyellow">#</span>....
  F  .........<span class="motoi-ansi-brightyellow">#</span>......
  E  .......<span class="motoi-ansi-brightyellow">#</span>........
  D  .....<span class="motoi-ansi-brightyellow">#</span>..........
  C  ...<span class="motoi-ansi-brightyellow">#</span>............
  B  .<span class="motoi-ansi-brightyellow">#</span>..............
  ─  ────────────────
     1  2  3  4  5  6  7  8

  [<span class="motoi-ansi-brightgreen">play</span>]   BPM <span class="motoi-tok-number">120</span>   sequence: <span class="motoi-tok-number">8</span> notes
</div>

## Here is what you can build

### Wobble Synth
<div class="motoi-terminal">
<span class="motoi-ansi-brightgreen">;; synth-patch.slat</span>

  Attack   [=====|-------] <span class="motoi-tok-number">0.05</span>
  Decay    [===|---------] <span class="motoi-tok-number">0.10</span>
  Sustain  [==========|--] <span class="motoi-tok-number">0.70</span>
  Release  [===|---------] <span class="motoi-tok-number">0.30</span>

  wave:  <span class="motoi-tok-keyword">sine</span> | square | triangle | saw | noise

  [<span class="motoi-ansi-brightgreen">preview</span>]  press to hear it
</div>

### Little Green Hero
<div class="motoi-terminal">
<span class="motoi-ansi-brightgreen">;; sprite-editor.slat  (8x8, palette: html-16)</span>

    <span class="motoi-tok-comment">01234567</span>
  0 ...<span class="motoi-ansi-brightgreen">##</span>...
  1 ..<span class="motoi-ansi-brightgreen">####</span>..
  2 .<span class="motoi-ansi-brightgreen">#</span>.<span class="motoi-ansi-brightgreen">##</span>.<span class="motoi-ansi-brightgreen">#</span>.
  3 <span class="motoi-ansi-brightgreen">########</span>
  4 .<span class="motoi-ansi-brightyellow">##</span>..<span class="motoi-ansi-brightyellow">##</span>.
  5 .<span class="motoi-ansi-brightyellow">#</span>....<span class="motoi-ansi-brightyellow">#</span>.
  6 ..<span class="motoi-ansi-red">#</span>..<span class="motoi-ansi-red">#</span>..
  7 ..<span class="motoi-ansi-red">#</span>..<span class="motoi-ansi-red">#</span>..

  ink: <span class="motoi-ansi-brightgreen">forestgreen</span> | fill | line | rect
</div>

### A World To Walk In
<div class="motoi-terminal">
<span class="motoi-ansi-brightgreen">;; tile-map.slat  (8 columns, 4 rows)</span>

  · · · · · · · ·
  · · · <span class="motoi-ansi-brightgreen">♣</span> · · · ·
  · <span class="motoi-ansi-brightyellow">☺</span> · · · · <span class="motoi-ansi-brightgreen">♣</span> ·
  <span class="motoi-ansi-brightgreen">▓ ▓ ▓ ▓ ▓ ▓ ▓ ▓</span>

  tileset: grass, tree, hero
  tools:   paint · erase · fill · stamp
</div>

## The round-trip promise

You edit the widget, the file changes. You edit the file, the widget follows. Neither is the real copy — they are the same thing shown two ways.

```scheme
(composer/canvas (:bind '(cart/main))
  (composer/slider :label "Attack" :bind '(synth :a)
                   :min 0.0 :max 2.0 :step 0.01 :value 0.05)
  (composer/piano-roll :bind '(cart/main :song)
                       :range '(C3 . C6) :steps 32))
```

Save the canvas — you get a `.slat` file that reads like the Scheme above. Open the file in the composer — the sliders and piano roll come back.

## Try one of the starter carts

- **[synth-patch.slat](https://github.com/Lacuna-Labs/motoi-scheme/blob/main/carts/composer/synth-patch.slat)** — Wobble Synth. Four sliders and a play button.
- **[piano-song.slat](https://github.com/Lacuna-Labs/motoi-scheme/blob/main/carts/composer/piano-song.slat)** — Do-Re-Mi Party. A 16-step piano roll.
- **[sprite-editor.slat](https://github.com/Lacuna-Labs/motoi-scheme/blob/main/carts/composer/sprite-editor.slat)** — Little Green Hero. An 8×8 pixel editor.

Run any of them:

```
bin/motoi run carts/composer/synth-patch.slat
```

## Fifteen verbs, one substrate

`composer/canvas` · `composer/slider` · `composer/button` · `composer/piano-roll` · `composer/sprite-grid` · `composer/tile-map` · `composer/timeline` · `composer/adsr` · `composer/instrument-picker` · `composer/fx-chain` · `composer/text-field` · `composer/toggle` · `composer/color-picker` · `composer/live-code` · `composer/emit`

Every widget is a plain record. `composer/emit` walks the canvas and returns the Scheme. `composer/apply` walks a Scheme form and updates the canvas. That is the whole trick.

## What's next

The visual half (v2) adds symmetry, onion-skin, infinite tile maps, per-widget undo, palette-designer with three modes, live reload. See [Composer v2 design study](https://github.com/Lacuna-Labs/motoi-scheme/blob/main/engineering/COMPOSER-2-VISUAL-DESIGN.ENG.slat).

---

<small>Composer v1.0 is spec-frozen. v1.1 lands the terminal renderer + the curated 16 HTML-name palette. v2 is a design study awaiting review.</small>
