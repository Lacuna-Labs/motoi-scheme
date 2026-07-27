// debrand.js — vendor-identity scrub for the packaged copilot surface.
//
// Alfred (hard): "De-brand: scrub all Qwen / Alibaba / vendor text out of the
// packaged artifact + surfaced identity."
//
// The base weights descend from an in-family open model. That provenance is a
// training-time fact and stays honestly documented in engineering/ — but it
// MUST NOT leak into anything a user sees. Every string that reaches a surface
// (ghost text, chat, identity banner, error message, model self-description)
// passes through `debrand()` before display. The copilot's surfaced identity
// is "the Motoi copilot" and nothing else.
//
// This is a defense-in-depth belt: the model-client already frames prompts so
// the model never introduces itself, but a small model can still parrot a
// pretraining name mid-completion. `debrand()` is the last gate before display.

// Vendor tokens to scrub, longest-first so multi-word forms win. Case-insensitive.
// The replacement is chosen to keep sentences grammatical.
const VENDOR_PATTERNS = [
  [/\bqwen\s*2\.5\s*[- ]?\s*coder\b/gi, 'the Motoi copilot'],
  [/\bqwen\s*2\.5\b/gi, 'the Motoi copilot'],
  [/\balibaba\s+cloud\b/gi, 'the Motoi project'],
  [/\balibaba\b/gi, 'the Motoi project'],
  [/\bqwen\b/gi, 'the Motoi copilot'],
  [/\btongyi\b/gi, 'the Motoi copilot'],
  [/\bdashscope\b/gi, 'the Motoi runtime'],
]

// The canonical self-identity. Any attempt by the model to name a different
// origin ("I am a language model trained by …") is replaced wholesale.
const SELF_ID = 'the Motoi copilot'
const ORIGIN_CLAIM =
  /\bI(?:'m| am)\s+(?:a\s+)?(?:large\s+)?language\s+model\s+(?:trained|developed|created|made|built)\s+by\s+[^.。\n]*/gi

/**
 * debrand — scrub vendor identity from a surfaced string.
 * Idempotent: running it twice yields the same result.
 * @param {string} text
 * @returns {string}
 */
export function debrand(text) {
  if (typeof text !== 'string' || text.length === 0) return text
  let out = text
  out = out.replace(ORIGIN_CLAIM, `I am ${SELF_ID}`)
  for (const [re, repl] of VENDOR_PATTERNS) out = out.replace(re, repl)
  return out
}

/**
 * containsVendorText — audit predicate. Returns the list of vendor tokens
 * present in a string (empty when clean). The self-contained/de-branded gate
 * in the test suite calls this over every surfaced artifact.
 * @param {string} text
 * @returns {string[]}
 */
export function containsVendorText(text) {
  if (typeof text !== 'string') return []
  const hits = []
  // Deliberately NOT reusing VENDOR_PATTERNS (those carry replacements). A raw
  // membership check for the audit — the closed set of forbidden brand tokens.
  const FORBIDDEN = [/\bqwen\b/i, /\balibaba\b/i, /\btongyi\b/i, /\bdashscope\b/i]
  for (const re of FORBIDDEN) {
    const m = text.match(re)
    if (m) hits.push(m[0])
  }
  return hits
}

export const IDENTITY = Object.freeze({
  name: 'Motoi copilot',
  self: SELF_ID,
  // The voice line the copilot leads with when asked "what are you?" — matches
  // the pedagogy brief: frank, no flattery, curious about the thing being built.
  intro:
    "I'm the Motoi copilot. I write Motoi Scheme with you and I run it before I " +
    "suggest it, so I can't hand you a verb that doesn't exist. When I don't know, " +
    "we'll run it and find out.",
})

export default debrand
