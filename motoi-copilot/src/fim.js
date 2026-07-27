// fim.js — Fill-In-the-Middle framing for Motoi completion + continuation.
//
// The base model's strongest native reflex is fill-in-the-middle: given code
// BEFORE the cursor (prefix) and code AFTER the cursor (suffix), predict the
// MIDDLE that joins them. Motoi already wrapped its extracted code blocks in
// FIM variants during CPT, so this reflex is aimed at Motoi's own verbs.
//
//   Completion  = cursor mid-form  `(pset 10 ▮ 7)` → prefix + suffix known,
//                 fill the hole.
//   Continuation = cursor at end, EMPTY suffix → extend the program forward
//                 (ghost the next form).
//
// Same machinery; suffix-empty is the only difference. This module owns:
//   · the FIM control-token vocabulary (kept as OPAQUE symbolic constants so the
//     packaged surface never prints a vendor token — see debrand.js),
//   · assembling a FIM prompt from an edit position,
//   · the repo/file framing tokens (repo_name / file_sep) the base model saw in
//     pretraining, which prime it toward this project's idioms,
//   · a fast structural balance check used by the PARSE gate on partial text.

// The native control tokens. They are the model's tokenizer specials; we keep
// them here as the ONLY place the raw strings live. Nothing user-facing prints
// them (they are stripped from every completion before display).
export const FIM = Object.freeze({
  PREFIX: '<|fim_prefix|>',
  MIDDLE: '<|fim_middle|>',
  SUFFIX: '<|fim_suffix|>',
  REPO: '<|repo_name|>',
  FILE_SEP: '<|file_sep|>',
})

// The project name the model was primed with during CPT framing. Not a vendor
// name — the repo's own identity. Priming with it nudges the model toward
// Motoi verbs over generic Scheme.
export const REPO_NAME = 'motoi-scheme'

/**
 * An EditPosition describes where the cursor is in a buffer.
 * @typedef {object} EditPosition
 * @property {string} text     the full buffer text
 * @property {number} offset   caret offset into `text` (0..text.length)
 * @property {string} [file]   optional file path, for repo framing
 */

/**
 * splitAtCursor — derive prefix/suffix from an EditPosition.
 * @param {EditPosition} pos
 * @returns {{prefix:string, suffix:string}}
 */
export function splitAtCursor(pos) {
  const text = pos.text ?? ''
  const off = clamp(pos.offset ?? text.length, 0, text.length)
  return { prefix: text.slice(0, off), suffix: text.slice(off) }
}

/**
 * mode — classify an edit position as 'completion' (non-empty suffix code) or
 * 'continuation' (nothing meaningful after the cursor).
 * @param {EditPosition} pos
 * @returns {'completion'|'continuation'}
 */
export function mode(pos) {
  const { suffix } = splitAtCursor(pos)
  return suffix.trim().length === 0 ? 'continuation' : 'completion'
}

/**
 * buildFimPrompt — assemble the model prompt for an edit position.
 *
 * Layout (native order for this model family — PSM: prefix, suffix, middle):
 *   [<repo><file_sep><file>]  <fim_prefix>PREFIX<fim_suffix>SUFFIX<fim_middle>
 *
 * The optional repo/file header is included when a file path is given; it primes
 * the project-idiom prior. The model continues after <fim_middle>.
 *
 * @param {EditPosition} pos
 * @param {object} [opts]
 * @param {string} [opts.repo=REPO_NAME]
 * @returns {{prompt:string, mode:string, prefix:string, suffix:string}}
 */
export function buildFimPrompt(pos, opts = {}) {
  const { prefix, suffix } = splitAtCursor(pos)
  const repo = opts.repo ?? REPO_NAME
  let header = ''
  if (pos.file) header = `${FIM.REPO}${repo}${FIM.FILE_SEP}${pos.file}\n`
  const prompt = `${header}${FIM.PREFIX}${prefix}${FIM.SUFFIX}${suffix}${FIM.MIDDLE}`
  return { prompt, mode: mode(pos), prefix, suffix }
}

/**
 * stripFimTokens — remove any control tokens that leak into raw model output.
 * A small model can echo its specials; we scrub before the completion is ever
 * parsed or shown.
 * @param {string} raw
 * @returns {string}
 */
export function stripFimTokens(raw) {
  if (typeof raw !== 'string') return ''
  let out = raw
  for (const tok of Object.values(FIM)) out = out.split(tok).join('')
  // <|endoftext|> / <|im_end|> style stops the tokenizer may emit.
  out = out.replace(/<\|[a-z_]+\|>/gi, '')
  return out
}

/**
 * reconstruct — splice a candidate middle back between prefix and suffix to
 * form the full program the sandbox will run.
 * @param {string} prefix
 * @param {string} middle
 * @param {string} suffix
 * @returns {string}
 */
export function reconstruct(prefix, middle, suffix) {
  return `${prefix}${middle}${suffix}`
}

// ── structural balance (PARSE-gate fast path) ──────────────────────────────
//
// Before invoking the reader, we can cheaply reject a candidate whose parens
// are unbalanced. This also tells the PARSE gate whether the WHOLE buffer
// (prefix+middle+suffix) is balanced, which is the real acceptance condition:
// a completion is only offerable if the resulting buffer parses.

/**
 * parenDelta — net open-paren count of `s`, ignoring string/char/comment
 * contents. Positive ⇒ needs closers; negative ⇒ too many closers; 0 ⇒ even.
 * Returns null if the text is structurally impossible (a stray close before any
 * open, or an unterminated string).
 * @param {string} s
 * @returns {number|null}
 */
export function parenDelta(s) {
  let depth = 0
  let i = 0
  const n = s.length
  while (i < n) {
    const c = s[i]
    if (c === ';') { while (i < n && s[i] !== '\n') i++; continue }        // line comment
    if (c === '"') {                                                        // string
      i++
      while (i < n && s[i] !== '"') { if (s[i] === '\\') i++; i++ }
      if (i >= n) return null                                              // unterminated
      i++; continue
    }
    if (c === '#' && s[i + 1] === '\\') {                                   // char literal
      i += 2
      if (i < n) i++                                                       // consume the char
      while (i < n && /[A-Za-z0-9]/.test(s[i])) i++                        // named char tail
      continue
    }
    if (c === '(' || c === '[') { depth++; i++; continue }
    if (c === ')' || c === ']') { depth--; if (depth < 0) return null; i++; continue }
    i++
  }
  return depth
}

/**
 * isBalanced — true when `s` has evenly matched delimiters and no dangling
 * string/char. Used by the PARSE gate on the reconstructed buffer.
 * @param {string} s
 * @returns {boolean}
 */
export function isBalanced(s) {
  return parenDelta(s) === 0
}

function clamp(x, lo, hi) { return x < lo ? lo : x > hi ? hi : x }

export default { FIM, buildFimPrompt, splitAtCursor, mode, stripFimTokens, reconstruct, parenDelta, isBalanced }
