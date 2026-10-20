# Korra — graphics/drawing slice divergences (2026-08-02)

45 records landed across 6 chapters. Every divergence below was verified against
the live engine. All are documented in the reference with `:status "needs-alfred"`.

## Colour is three incompatible systems

1. **`color/named` and `set-color` use different vocabularies.**
   `(color/named 'red)` → `#f` but `(set-color 'red)` → `8`.
   `(color/named 'crimson)` → `"#dc143c"` but `(set-color 'crimson)` is a silent
   no-op (pen unchanged). Only `black`, `white`, `pink` are in both 16-name lists.
2. **`color/named`'s output cannot be used for drawing.**
   `(set-color (color/named 'gold))` leaves the pen where it was. Silent.
3. **Three arithmetics for one palette index.**
   `set-color` WRAPS: `(set-color 20)`→4, `(set-color -1)`→15.
   `pset`/`clear` MASK: `(pset 1 1 300)`→44, `(clear 300)` then `(pget 5 5)`→44 —
   outside the 16-entry palette.
   `fb/rect` WRAPS: `(fb/rect 0 0 1 1 300)`→12.
4. **Symbol colours honoured in some verbs, dropped in others.**
   `(set-color 'red)`→8 · `(fb/rect x y w h 'red)`→8 · `(pset 3 3 'red)`→**0** ·
   `(flower/paint 1 12 12 0 1 1 0 (list 'red 'blue))`→**defaults 14/10**.
5. Unrecognised colour name is a silent no-op everywhere (`(set-color 'chartreuse)`
   leaves the pen).
6. `color/name-of` is nearest-Euclidean-RGB (INTENDED, documented in source) so it
   never returns `#f` for well-formed hex: `(color/name-of "#010203")`→`black`,
   `(color/name-of "#808080")`→`slategray`. Hazard only when used as a validator.

## Rectangle / shape family

7. **Only `fb/rect` takes a colour.** `(rect 100 100 20 10 3)` paints the PEN, not 3.
   `circle` `disc` `line` `rect` `rect-fill` + all six rectangle aliases silently
   drop extra args. Siblings in `shapes-raster.js` DO take one:
   `(triangle 10 10 40 10 25 40 8)`→**8**. The convention is not uniform.
8. **Sizes clamp UP to 1.** `(rect 2 2 0 4)`, `(rect 8 2 -4 -4)`, `(rect-fill 4 4 0 0)`,
   `(fb/rect 3 3 0 0)` each paint one pixel. A computed-empty rectangle draws a stray dot.
   `circle`/`disc` clamp r to 0 → one pixel at the centre.
9. Six names, two behaviours: `rect`=`rectangle`=`draw-rect` (outline),
   `rect-fill`=`fill-rect`=`filled-rectangle` (solid). The `draw-`/`fill-` prefix pair
   covers rectangles ONLY — there is no `fill-circle`.

## Snapshot / restore

10. **`render` and `framebuffer` drop the pen and frame counter.**
    `(fb-restore (render))` silently sets the pen to 0; `(fb-restore (fb-snapshot))`
    preserves it (9). The engine's own comment calls them "the same".
11. **`fb-restore` WIPES the text overlay.** No capture verb stores it, so
    `(fb-restore (fb-snapshot))` — a supposed no-op — leaves `(text/overlay)` empty
    even for strings drawn BEFORE the snapshot. Verified: overlay 1 → 0.
12. **`fb-restore` silently changes the mode**, since dimensions travel in the record.
    Useful for undo, unsafe inside a loop with cached bounds.
13. Snapshot records are opaque and **not `equal?` to each other**:
    `(equal? (render) (render))` → `#f` on an unchanged canvas. No accessors.

## Reads

14. `(pget 999 999)` and `(fb/pixel 999 999)` both return **0**, indistinguishable
    from a legitimately black pixel. `(pget 4.7 4.2)` truncates to (4,4).
15. `fb/pixel` is a behavioural duplicate of `pget` with no difference at all.

## fb/dump

16. **Any argument count other than exactly 4 dumps the WHOLE canvas.**
    `(fb/dump 0 0 2)` floods the terminal. No error.
17. **The region is not clipped.** `(fb/dump 2 2 8 8)` on a 4x4 canvas reads past the
    buffer and prints the missing cells as black.
18. Writes straight to `process.stdout`, bypassing Scheme ports — cannot be captured.

## Text

19. `draw-text`/`text/draw` are POSITIONAL aliases of `fb/text (str x y [color] [font])`,
    but 64-text's pre-existing `text/draw` record documents a keyword form
    (`'at:` `'color:` `'align:` `'font:`) the engine does not implement. Extras ignored,
    string lands at (0,0). They write to the overlay, never pixels —
    `(pget 10 20)` after `(draw-text "hi" 10 20 'red)` is **0**.

## Other

20. `paint-cell` with an unregistered tag auto-assigns from a process-global rolling
    counter starting at 8, wrapping 15→8, memoised: `'aaa`→8, `'bbb`→9, `'enemy`→8
    collides. Order-dependent across a whole session.
21. `plot` with a constant series pins every sample to the BOTTOM row (`span` clamped
    to `1e-9`): `(begin (set-mode 24 8) (clear 0) (set-color 9) (plot (list 5 5 5)) (pget 0 7))` → **9**.
22. Default pen on a fresh interpreter is **14** (pink), not 0. Default mode with no
    `set-mode` is **(80 80)**.
23. `flower/paint` is a themed `flower/` namespace bound in the CORE media installer
    alongside the geometric primitives. Scope question for Alfred.
    Sprite index is taken mod 4, so `(flower/paint 9 …)` draws sprite 1 rather than raising.
    Every optional arg is coerced, never rejected: a non-numeric spin becomes 0,
    a non-positive scale becomes 1.

## Out of slice

- **`margin`** is a finance verb — `(margin price cost)` → percent. Its correct home is
  `40-math.slat`, which was off-limits this pass. NOT written.

## Harness defect

- `scratch/verify-reference-records.py` uses fixed paths `/tmp/motoi-verify-{idx}.scm`
  and `/tmp/ref-failures.tsv`. Concurrent named agents clobber each other and produce
  phantom failures (observed: 64-text reported 23 failures once, then 0 twice; rows
  from `63-system.slat` appeared in my dump file). Any red gate must be re-run before
  being believed.
