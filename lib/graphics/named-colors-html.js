// named-colors-html.js — the 16-color HTML/CSS palette for the composer.
//
// Doctrine (Alfred, 2026-07-17): the composer's 16 colors are HTML color
// names (crimson, forestgreen, peachpuff, etc.), NOT palette indices.
// Kids recognize "gold" and "coral"; nobody recognizes color 9.
//
// Provenance: memory/project_motoi_branding_2026_07_17.md (locked
// 2026-07-17). Composer v1.1 (engineering/COMPOSER-1.1.ENG.slat).
//
// This module lives BESIDE lib/graphics/framebuffer.js's NAMED_COLORS
// (PICO-8 style palette-indexed) — that palette stays for back-compat.
// The composer picks between them via `:palette 'pico-8` (default) or
// `:palette 'html-16`.
//
// ─────────────────────────────────────────────────────────────────────
// Curated 16 (2026-07-17) — final selection with per-slot rationale.
// Constraints Alfred handed us:
//   REQUIRED — black, white, crimson, forestgreen, peachpuff, gold,
//              coral, plum, teal, sienna, pink            (11 slots)
//   FREE     — 5 more, spanning the wheel, kid-legible against the
//              pink/green/brown brand stripes.
//
// Slot-by-slot rationale (why each color earned the seat):
//   01 black          — required. Ink; grounding for high-contrast lines.
//   02 white          — required. Paper; anchors any light-on-dark surface.
//   03 crimson        — required. Deep pure red; safe against pink stripe.
//   04 forestgreen    — required. Brand middle stripe color.
//   05 peachpuff      — required. Warm pale; a soft peer to pink.
//   06 gold           — required. Saturated yellow; the palette's warmth.
//   07 coral          — required. Orange mid; sits between crimson & gold.
//   08 plum           — required. Muted violet; opposite the greens.
//   09 teal           — required. Cool cyan-green anchor; opposite coral.
//   10 sienna         — required. Warm mid brown; kid word for "dirt".
//   11 pink           — required. Brand top stripe color.
//   12 skyblue        — cool mid; the palette had NO true blue without it.
//                       Pairs with gold (complement) and coral (contrast).
//                       Beats lavender (which vanishes on white bg).
//   13 mediumseagreen — brand-family green cousin; distinct from
//                       forestgreen (lighter, cooler). Two greens is
//                       fine when they read as sibling and elder.
//   14 saddlebrown    — brand bottom stripe color; deeper than sienna.
//                       Two browns for the same reason as two greens.
//   15 slategray      — critical NEUTRAL mid; without it, greyed-out UI
//                       states have to reach for pure black or white,
//                       which look "broken" on a colored surface.
//                       Beats khaki (too close to gold + peachpuff).
//   16 navy           — deep blue anchor; sky's dark partner. Grounds
//                       the whole palette on any background, gives text
//                       a serious-mode option that isn't pure black.
//                       Beats lavender (too washed out on light bg).
//
// Substitutions vs the earlier draft:
//   khaki    -> slategray  (khaki was fighting gold + peachpuff in the
//                           warm zone; slategray fills the missing neutral)
//   lavender -> navy       (lavender disappeared on white; navy gives
//                           the palette a real dark blue and pairs with
//                           skyblue as a hue family)
//
// Hex values sourced from the CSS Level 3 named colors spec. Frozen so
// tests can safely deep-import and consumers cannot mutate the palette
// in place.
export const NAMED_COLORS_HTML = Object.freeze({
  black:          '#000000',
  white:          '#ffffff',
  crimson:        '#dc143c',
  forestgreen:    '#228b22',
  peachpuff:      '#ffdab9',
  gold:           '#ffd700',
  coral:          '#ff7f50',
  plum:           '#dda0dd',
  teal:           '#008080',
  sienna:         '#a0522d',
  pink:           '#ffc0cb',
  skyblue:        '#87ceeb',
  mediumseagreen: '#3cb371',
  saddlebrown:    '#8b4513',
  slategray:      '#708090',
  navy:           '#000080',
})

// The palette in a stable insertion order — used by widgets that show a
// palette strip (color-picker) and by tests that assert count/order.
// Order matches the rationale above (required 11, then 5 curated).
export const NAMED_COLORS_HTML_ORDER = Object.freeze([
  'black', 'white', 'crimson', 'forestgreen',
  'peachpuff', 'gold', 'coral', 'plum',
  'teal', 'sienna', 'pink', 'skyblue',
  'mediumseagreen', 'saddlebrown', 'slategray', 'navy',
])

// Parse a "#rrggbb" hex string into [r, g, b] in 0-255. Returns null on
// malformed input. Accepts 3-digit shorthand ("#f00" → [255, 0, 0]).
function parseHex(h) {
  if (typeof h !== 'string') return null
  let s = h.trim().toLowerCase()
  if (s.startsWith('#')) s = s.slice(1)
  if (s.length === 3) {
    s = s[0] + s[0] + s[1] + s[1] + s[2] + s[2]
  }
  if (s.length !== 6) return null
  const r = parseInt(s.slice(0, 2), 16)
  const g = parseInt(s.slice(2, 4), 16)
  const b = parseInt(s.slice(4, 6), 16)
  if (Number.isNaN(r) || Number.isNaN(g) || Number.isNaN(b)) return null
  return [r, g, b]
}

// Return the hex code for a named color, or null if the name isn't in
// the HTML palette. Name lookup is case-insensitive.
export function colorNamed(name) {
  if (name == null) return null
  const key = String(name).toLowerCase()
  return NAMED_COLORS_HTML[key] || null
}

// Nearest-name lookup — given a hex string, return the palette name whose
// hex is closest in Euclidean RGB distance. Returns null on malformed
// input. Ties resolve to the palette's earlier entry (insertion order).
export function colorNameOf(hex) {
  const target = parseHex(hex)
  if (!target) return null
  let best = null
  let bestDist = Infinity
  for (const name of NAMED_COLORS_HTML_ORDER) {
    const c = parseHex(NAMED_COLORS_HTML[name])
    if (!c) continue
    const dr = c[0] - target[0]
    const dg = c[1] - target[1]
    const db = c[2] - target[2]
    const d = dr * dr + dg * dg + db * db
    if (d < bestDist) {
      bestDist = d
      best = name
    }
  }
  return best
}

// The three-stripe brand tokens (per memory:motoi-branding). Not part of
// the 16-color palette count but referenced by composer widgets that
// display the brand stripes.
export const BRAND_STRIPES = Object.freeze({
  pink:  NAMED_COLORS_HTML.pink,
  green: NAMED_COLORS_HTML.mediumseagreen,
  brown: NAMED_COLORS_HTML.saddlebrown,
})
