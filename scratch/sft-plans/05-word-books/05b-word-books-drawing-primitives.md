# Word-Books → Drawing Primitives (objects from math) — research + contract

**MOTOI ONLY · DESIGN-ONLY · no fold, no commit.** Peer to `word-books-sft-walk.md`. This is the
*third face of every word-book object*: the word book says what a thing **is** (referent), Lens 2B says
what it **does** (affordance), and THIS says how it's **built** — drawn from math primitives as Scheme
code. It is the geometry branch of the "bridge back to code" (point B of the SFT-additions menu) and it
lands squarely on the **Sensation axis** (concrete things) that regressed in Mk2 CPT — drawing IS sensory
grounding.

Origin: Alfred wanted objects DRAWN from math ("like you were drawing vectors, draw every single one of
them using the math"), NOT a hand-authored catalog, NOT emojis. The worry was it "could get ridiculous."
It doesn't, because of the resolution contract below (single-target) + a generative basis (seed the rule,
let instances emerge).

---

## 1 — Resolution decision (LOCKED direction, Alfred 2026-07-28)

- **Default canvas = SD, 320×240, 4:3, square pixels, chunky.** This is "the law."
- **Menu of presets** the user may switch to: PICO-8 `128×128`, TIC-80 `240×136`, and **name-your-own**
  custom resolution. Everyone STARTS at SD; they opt into others.
- **Why 320×240 over full SD (640×480):** SD's *instincts* are right (4:3, low-res, chunky,
  scanline-friendly) but full SD's *pixel count* (307k) is overkill. 320×240 = 77k px: integer-scales
  clean to 640×480/960×720/1280×960 (sharp on any modern screen), 8px tiles → tidy 40×30 grid, round
  center (160,120), coordinates a 1.5B can actually reason about (0–320 / 0–240), cheap to render + grade.
- **Aspect fork (open):** stay **4:3 (320×240)** unless the iPad-on-counter ambient surface (#87) is the
  PRIMARY display, in which case **16:9 (~384×216)**. Keep resolution a single **named constant** so
  drawing verbs, tiles, camera, and the SFT render-grader all read one source.

### 1a — The primitive CONTRACT (the load-bearing decision)

> **Primitives are guaranteed at SD only. Change resolution → the primitive guarantee lapses.**

- Stay at SD → object-primitives (frog, lily pad, door…) are first-class and *promised*.
- Pick any other resolution → you keep the **raw drawing verbs** (circle/line/bézier/etc.) but the
  **object-primitive promise is void**. SD is the law; the primitive library is SD-law; everything else is
  *lawless-but-allowed*.
- **Keep drawing verbs PIXEL-NATIVE** (coords in SD pixels). A primitive authored at SD simply draws its
  SD coordinates into whatever canvas you picked — it may sit small or overflow, and that's *fine*; that's
  "no guarantee" made concrete.
- **DO NOT** use normalized `0..1` coordinates — that would let primitives scale for free but quietly
  re-introduces exactly the resolution-independence contract Alfred is trying to shed. Stay pixel-native.

**Why the contract is load-bearing, not just tidy:** it's what makes the whole draw-from-math plan
*tractable*. One canvas → one coordinate vocabulary the model learns (vs. "draw at any resolution" = an
open research problem). One target → one grade (render + eyeball at SD only). "Draw a frog" means "draw a
frog at SD." Bounded, verifiable, done. **This is the containment that de-ridiculouses the catalog.**

---

## 2 — The shape-math stack (four cooperating layers; all 1:1 s-expr, bidirectional, cheap at SD)

Verified by 3 parallel research agents 2026-07-28. Every layer defines shapes as *readable parameter
literals*, so the model can emit code AND parse params back out ("to and from").

### 2a — Organic generator: the Gielis SUPERFORMULA
One equation, six numbers, generates circles, polygons, stars, flowers, leaves, **lily pads**, starfish.

```
r(φ) = ( |cos(mφ/4)/a|^n2 + |sin(mφ/4)/b|^n3 )^(−1/n1)      x = r·cosφ, y = r·sinφ
```
- Params (6): `m` = lobe/petal count (symmetry); `a,b` = axis scale; `n1,n2,n3` = curvature
  (pointed / rounded / bulging). → `(superformula m n1 n2 n3 a b)`.
- Render: sample `r(θ)` over 0..2π (64–256 pts) → polygon → scanline fill. **Cheapest layer**, integer-
  friendly once vertices are rounded. The single best "one formula → many organic shapes."

### 2b — Engineered/compositional vocabulary: 2D SDFs (Inigo Quilez, ~45 primitives)
Circle, box, rounded/chamfer box, oriented box, segment, rhombus, trapezoid, parallelogram, triangles,
pentagon/hexagon/octagon, hexagram, pentagram, star, pie, cut-disk, arc, ring, horseshoe, vesica, moon,
egg, heart, cross, rounded-X, N-gon polygon, ellipse, parabola, quadratic bézier, and more. Each returns a
signed distance `d` (negative inside).
- **Composition is arithmetic:** union = `min(a,b)`; intersect = `max(a,b)`; subtract = `max(a,-b)`;
  smooth-union = `smin` (blend radius `k`); round = `d-r`; **outline/onion = `abs(d)-w`**; transforms act
  on the point (translate `p-off`, rotate `R⁻¹p`, scale `sdf(p/s)*s`).
- **One function → fill (`d<0`), stroke (`abs(d)<w`), and free antialiasing** (`1-smoothstep(-e,e,d)`).
- Nests as s-expressions 1:1: a door = `(subtract (rounded-box …) (box …))`.
- Cost @ 320×240: per-pixel eval is trivially cheap for **one-shot render-to-grade**; cheap for ~60fps
  games too **if bounded to each shape's AABB**.
- License: iq states formulas are his own; no explicit license on the page — **attribute "Inigo Quilez /
  iquilezles.org" and re-express the formulas in our own Scheme.**

### 2c — The Scheme-native API to CONFORM to: Racket `2htdp/image` + SICP/Henderson
This is the "repository of Scheme shape primitives" Alfred asked whether existed. **It does**, and it's
kid-facing and permissively licensed.
- **`2htdp/image`** (the HtDP teaching library — explicitly beginner/child-facing):
  constructors `circle` `ellipse` `rectangle` `square` `triangle` (+ `right-triangle`,
  `isosceles-triangle`, `triangle/sss`) `regular-polygon` `star` `star-polygon` `radial-star` `polygon`
  `line` `add-line` `add-curve` `wedge` `text`/`text/font` `empty-scene`; combinators `overlay`
  (`/xy`,`/align`) `underlay` `beside`(`/align`) `above`(`/align`) `rotate` `scale` `scale/xy`
  `flip-horizontal`/`vertical` `crop` `frame` `place-image`(`/align`). Mode = `"solid"`/`"outline"`.
- **SICP picture language / Henderson "Functional Geometry":** a *painter is a function of a frame*;
  combinators `beside` `below` `flip-horiz`/`vert` `rotate90/180/270` `superpose`, general
  `transform-painter`, builders `segments->painter` `procedure->painter`; `square-limit` demonstrates the
  algebra is **closed + recursive** (a combination of shapes is itself a shape).
- **License:** both ship in Racket under **MIT/Apache-2.0** (permissive — reuse names/signatures, reimplement
  freely with attribution); SICP itself is **CC BY-SA 4.0**; the API/algebra is not the paper's copyright.
- **Recommendation (open decision):** **conform Motoi's shape verbs to `2htdp/image` names VERBATIM** (same
  move as the SRFI conformance ladder in CLAUDE.md) so a 1.5B transfers from real Scheme corpus and is
  child-facing by construction; borrow Henderson's *painter-is-a-function-of-a-frame closure* as the design
  invariant (every drawing verb returns a composable value; combinators return the same type) and as the
  bridge that maps the unit square onto the fixed 320×240 frame. Alfred's lean: verbatim.

### 2d — Interchange + FREE repositories to MINE (don't hand-author)
- **SVG path grammar** (`M/L/H/V/C/S/Q/T/A/Z`, W3C standard) is a flat tagged-tuple stream → maps trivially
  to `(path (M 10 10) (C x1 y1 x2 y2 x y) (Z))`. `S`/`T` reflect the previous control point at flatten time;
  `A` (arc) is the only real work (arc → center parameterization). Enormous existing corpora.
- **Mineable shape sets (licenses verified):**

  | Set | Size | License | Mine it? |
  |---|---|---|---|
  | Feather / Lucide / Bootstrap Icons / Material Symbols | ~300–2.5k each | MIT / ISC / MIT / Apache-2.0 | ✅ freely |
  | Twemoji | ~3.6k | CC-BY 4.0 | ✅ attribution only (NOTICE file) |
  | Noto Emoji | full | OFL 1.1 / Apache-2.0 (per-folder) | ✅ check the folder LICENSE |
  | **OpenMoji** | ~4k | **CC-BY-SA 4.0** | ⚠️ **AVOID** — copyleft/share-alike could infect our vocabulary |
  | Hershey vector fonts | glyph tables | public domain (+ acknowledgement) | ✅ cheapest to draw (pure line segments) |

### 2e — Cheap RENDER: integer rasterizers (no floats needed)
Bresenham line · midpoint/Bresenham circle & ellipse · scanline polygon fill (nonzero = SVG default) ·
flood fill · bézier flattening (recursive subdivide → segments → Bresenham). All classic, integer-only,
**trivially cheap** at 76,800 px — and our main use (render-once-to-grade) isn't even real-time.

---

## 3 — The pipeline it implies

**DEFINE** (superformula = organic · SDF = engineered/boolean · surfaced under friendly `2htdp` names)
→ **MINE** (SVG-path from Feather/Lucide/Bootstrap/Material/Twemoji/Noto; **skip OpenMoji**; Hershey for
glyphs) → **RENDER** (flatten curves/arcs → integer rasterizers → 320×240 SD buffer) → **GRADE** (render +
eyeball; the interpreter is the grader — same verifier-in-the-loop doctrine as the copilot lane #388).

---

## 4 — SFT connection ("could even tell it that via SFT")

- **Every object = an abductive draw pair** (matches the abductive-SFT doctrine): *"draw a lily pad"* →
  **reason** (*a superformula blob with a wedge subtracted*) → **emit Scheme** → **renders correctly at
  SD**. Not "lily pad → memorized sprite." The SD-only contract (§1a) is what makes each pair *gradeable*.
- **Seed, don't enumerate.** Author a small basis (primitive verbs + a few dozen composition patterns:
  dome-on-stalk, disc-with-notch, symmetric-pair, stacked, radial-array) on ~50–150 objects that are
  ALREADY nouns in book-of-words (frog, lily pad, pond, door, house…). Novel objects emerge from
  composition; the catalog is *emergent*, not authored — same shape as the honest-null / generative-rule
  doctrine.
- **Teach the contract itself via SFT** — the resolution law, the SD-only primitive guarantee, and the
  shape vocabulary can be declarative + demonstrated pairs.
- **Three-tier ladder still applies** (Child/Layperson/PhD): Child = "a lily pad is a round pad with a
  little slice cut out"; Layperson = "one blob shape + subtract a wedge"; PhD = "superformula(m=…) minus an
  SDF wedge; fill by scanline, outline by |d|−w."

---

## 5 — Open items / dependency before authoring pairs

1. **~~CONFIRM~~ CONFIRMED the real framebuffer primitive inventory (2026-07-28, via `./bin/motoi run`).**
   Result: `circle` / `rectangle` / `line` **run** (return opaque image, no error, no render sink yet);
   `triangle` / `star` / `polygon` / `overlay` / `place-image` / `empty-scene` **unbound**; `square`
   **collides** with arithmetic (returns 64, not a shape); `define-record-type` **broken**
   (`fieldSyms.map is not a function`); `cond`/`if`/`lambda`/`let`/`eq?`/`max`/`quotient`/lists run clean.
   ⇒ **The 2htdp shape+combinator vocabulary is NOT wired** — drawing SFT pairs are NOT gradeable today;
   the render-to-grade loop is blocked on **phases 1–2** (rasterizers + conformed shape/combinator verbs +
   a render-to-PNG sink onto the existing framebuffer). Object-from-math draw-pairs need **phases 3–4**
   (superformula + SDF). The framebuffer substrate already exists (#371/#380: circle/rectangle/line render),
   so 1–2 is *wire-onto-existing*, likely days — read the framebuffer layer to firm the estimate (don't
   guess twice). `define-record-type` fix is adjacent, not required for drawing. Verb-wired = `motoi run` passes.
2. **Aspect-ratio fork** (§1) — 4:3 default vs 16:9 if iPad is primary.
3. **Conform-verbatim vs adapt** the `2htdp/image` names (Alfred leans verbatim).
4. Fidelity bar = **PICO-8/TIC-80 chunky** (not photoreal) — generative geometry looks *good* there.

## Sources (verified 2026-07-28)
- Inigo Quilez — 2D distance functions: https://iquilezles.org/articles/distfunctions2d/ (+ 3D ops page)
- Gielis superformula — Wikipedia; dynamicmathematicslearning.com/super-ellipse.html
- Racket `2htdp/image`: docs.racket-lang.org/teachpack/2htdpimage.html
- Racket SICP Picture Language: docs.racket-lang.org/sicp-manual/SICP_Picture_Language.html
- Henderson, "Functional Geometry" (HOSC 2002)
- Licenses: OpenMoji (CC-BY-SA), Noto Emoji (OFL/Apache), Lucide (ISC), Feather (MIT), Twemoji (CC-BY),
  Material (Apache); Hershey — Paul Bourke format page + python-hershey (CC0/WTFPL data)
