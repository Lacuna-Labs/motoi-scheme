#!/usr/bin/env node
// slat-render — one-way SLAT → Markdown converter.
//
// SLAT is the source of truth. MD is rendered build output.
// See engineering/SLAT-TO-MD-CONVERTER-DESIGN-2026-07-17.ENG.slat for the
// full design. This file is the working prototype (v0.1).
//
// Usage:
//   slat-render foo.slat                 → foo.md alongside
//   slat-render foo.slatl                → foo.md alongside
//   slat-render --tree ROOT              → walk recursively, render every
//                                          .slat/.slatl found
//   slat-render --out DIR foo.slat       → render to DIR/foo.md
//   slat-render --tree ROOT --out DIR    → mirror tree under DIR
//   slat-render --check foo.slat         → parse only, no writes
//   slat-render --strict foo.slat        → escalate parse errors to exit 1
//   slat-render --quiet ...              → suppress per-file logging
//
// Exit codes:
//   0 — success
//   1 — parse error (with --strict or --check)
//   2 — bad usage
//
// No external dependencies. Node 18+.
//
// ─────────────────────────────────────────────────────────────────────
// TOLERANCE STRATEGY (added 2026-07-18)
// ─────────────────────────────────────────────────────────────────────
// SLAT is hand-authored. Real files hit five common malformations that
// used to hard-crash the renderer:
//
//   1. Unterminated string literals (missing close quote) — reader ran
//      forward until it swallowed the next quote it found, then
//      misaligned everything downstream.
//   2. Extra ')' at top level — a single stray close paren aborted
//      the entire parse.
//   3. Missing ')' at top level — parser walked off the token stream.
//   4. Digit-grouping commas in numeric atoms (e.g. `34,300`, `28,500`
//      written outside of strings for readability) — the atom terminator
//      set included `,` so tokenization crashed on the comma.
//   5. Quasi-quote / unquote (`,foo` `,@bar` `` `x``) at scalar
//      positions — very rare but present in some Scheme-y content.
//
// The strategy:
//   • The tokenizer and parser NEVER throw. They collect warnings and
//     recover in place. `convertSlatToMd` returns { markdown, warnings }
//     always (even on catastrophic input), and the rendered MD carries
//     an HTML-comment banner listing the warnings so nothing is silently
//     lost.
//   • Numeric commas: `12,345` and `12,345.67` (all-digit segments
//     separated by commas) parse as an INT/FLOAT with the commas stripped.
//     Any commas that fall outside a numeric shape are logged and
//     skipped as whitespace, not treated as errors.
//   • Unterminated regular strings: close automatically at EOF or at
//     the next line that starts with an S-expression construct
//     (`(`, `)`, `#|`, `;;`) — whichever comes first.
//   • Extra close paren: logged and dropped.
//   • Missing close paren: parser closes at end of input.
//   • processFile() now catches any residual error and emits a "partial
//     render" MD that dumps the raw SLAT in a fenced block so the source
//     remains readable while the author fixes the input.
//
// Backward compatibility: every currently-well-formed SLAT that used to
// render successfully still renders IDENTICALLY. Tolerance only kicks in
// on malformed input; well-formed input never hits a recovery path.

import { readFileSync, writeFileSync, statSync, readdirSync, mkdirSync } from 'node:fs'
import { resolve, dirname, basename, join, relative, extname } from 'node:path'

// ─────────────────────────────────────────────────────────────────────
// Multi-line S-expression tokenizer
//
// Handles:
//   - line comments ; ...
//   - block comments #| ... |#
//   - strings "..." with \\ \n \t \r \" escapes
//   - triple-quoted strings """...""" (verbatim, newlines preserved)
//   - #inst "..." reader macros → passed as { _inst: '...' }
//   - #t / #f / nil
//   - :keywords
//   - [ ... ] vector literals (treated as list-with-vector-tag)
//   - integers, floats, rationals, symbols
//   - #0= / #0# structural sharing → opaque symbols (best-effort)
// ─────────────────────────────────────────────────────────────────────

const T_LPAREN = 'LPAREN'
const T_RPAREN = 'RPAREN'
const T_LBRACK = 'LBRACK'
const T_RBRACK = 'RBRACK'
const T_STRING = 'STRING'
const T_TRIPLE = 'TRIPLE'
const T_INST = 'INST'
const T_BOOL = 'BOOL'
const T_NIL = 'NIL'
const T_KEYWORD = 'KEYWORD'
const T_SYMBOL = 'SYMBOL'
const T_INT = 'INT'
const T_FLOAT = 'FLOAT'
const T_RATIONAL = 'RATIONAL'
const T_LABEL_DEF = 'LABEL_DEF'
const T_LABEL_REF = 'LABEL_REF'

class ParseError extends Error {
  constructor(msg, pos, line, col) {
    super(`${msg} at line ${line}:${col} (pos ${pos})`)
    this.pos = pos
    this.line = line
    this.col = col
  }
}

// tokenize — tolerant tokenizer. Never throws for recoverable input;
// collects warnings on the `warnings` array supplied by the caller
// (or a fresh one). Returns { tokens, warnings }.
function tokenize(src, warnings) {
  if (!warnings) warnings = []
  const tokens = []
  let i = 0
  const n = src.length
  let line = 1
  let colStart = 0
  const col = () => i - colStart + 1

  // ATOM_TERM — characters that terminate a bare atom / keyword. Comma
  // is INCLUDED to keep Scheme-like semantics (bare commas remain
  // terminators outside numbers), but the atom-classifier below still
  // recognises digit-grouped numbers like `28,500` by peeking ahead
  // before we terminate — see the number-with-commas peek block.
  const ATOM_TERM = /[\s()[\]"';,]/

  while (i < n) {
    const c = src[i]

    // whitespace + newlines OK across a form
    if (c === ' ' || c === '\t') { i++; continue }
    if (c === '\n') { line++; colStart = i + 1; i++; continue }
    if (c === '\r') { i++; continue }

    // parens
    if (c === '(') { tokens.push([T_LPAREN, null, line, col()]); i++; continue }
    if (c === ')') { tokens.push([T_RPAREN, null, line, col()]); i++; continue }
    if (c === '[') { tokens.push([T_LBRACK, null, line, col()]); i++; continue }
    if (c === ']') { tokens.push([T_RBRACK, null, line, col()]); i++; continue }

    // line comment
    if (c === ';') {
      while (i < n && src[i] !== '\n') i++
      continue
    }

    // block comment #| ... |# (nested)
    if (c === '#' && src[i + 1] === '|') {
      const openLine = line
      const openCol = col()
      let depth = 1
      i += 2
      while (i < n && depth > 0) {
        if (src[i] === '#' && src[i + 1] === '|') { depth++; i += 2 }
        else if (src[i] === '|' && src[i + 1] === '#') { depth--; i += 2 }
        else { if (src[i] === '\n') { line++; colStart = i + 1 } i++ }
      }
      if (depth !== 0) {
        warnings.push(`tokenizer: unterminated block comment opened at ${openLine}:${openCol} — closed at EOF`)
      }
      continue
    }

    // triple-quoted string """..."""
    if (c === '"' && src[i + 1] === '"' && src[i + 2] === '"') {
      const startLine = line
      const startCol = col()
      let j = i + 3
      let out = ''
      let closed = false
      while (j < n) {
        if (src[j] === '"' && src[j + 1] === '"' && src[j + 2] === '"') {
          j += 3
          closed = true
          break
        }
        if (src[j] === '\n') { line++; colStart = j + 1 }
        out += src[j]
        j++
      }
      if (!closed) {
        warnings.push(`tokenizer: unterminated triple-quoted string opened at ${startLine}:${startCol} — closed at EOF`)
      }
      tokens.push([T_TRIPLE, out, startLine, startCol])
      i = j
      continue
    }

    // regular string "..."
    if (c === '"') {
      const startLine = line
      const startCol = col()
      const startLineSave = line
      const startColStartSave = colStart
      let j = i + 1
      let out = ''
      let closed = false
      // Recovery scanner: walk forward, but if we see a plausible
      // structural line-start (e.g. `(`, `)`, `;;`, `:kw`) after
      // consuming more than one line, we suspect the author forgot the
      // closing quote. Bail then and emit best-effort content.
      let sawNewline = false
      while (j < n) {
        if (src[j] === '"') { closed = true; break }
        if (src[j] === '\\' && j + 1 < n) {
          const esc = src[j + 1]
          if (esc === 'n') out += '\n'
          else if (esc === 't') out += '\t'
          else if (esc === 'r') out += '\r'
          else if (esc === '"') out += '"'
          else if (esc === '\\') out += '\\'
          else out += esc
          j += 2
          continue
        }
        if (src[j] === '\n') {
          line++
          colStart = j + 1
          sawNewline = true
          out += src[j]
          j++
          // Peek forward: if this line starts with clear top-level
          // structure and doesn't itself contain a closing quote soon,
          // we treat the previous string as unterminated (recovery
          // mode). Only trigger after we've already seen at least one
          // newline (so single-line strings that happen to contain
          // trailing `(`s aren't affected).
          if (sawNewline) {
            // Recovery-fire heuristic — VERY STRICT. Fires only when
            // ALL of these hold:
            //   • the new line begins at column 0
            //   • it starts with `;;;` (three or more semicolons) —
            //     the SLAT convention for a top-level section-break
            //     comment, e.g. `;;; ============`. Two-semicolon
            //     `;;` comments occur inside code blocks and inside
            //     prose all the time, so we don't fire on those.
            //   • the immediately preceding line is blank
            //   • the section-break comment is followed by a
            //     recognisable divider glyph (`=`, `-`, `─`, `─`,
            //     space+word) — this excludes `;;;` used as an ellipsis
            //     mid-prose.
            const k = j
            const looksStructural =
              src[k] === ';' && src[k + 1] === ';' && src[k + 2] === ';'
            let prevLineBlank = false
            if (looksStructural) {
              let p = j - 2
              while (p >= 0 && (src[p] === ' ' || src[p] === '\t')) p--
              if (p >= 0 && src[p] === '\n') prevLineBlank = true
              else if (p < 0) prevLineBlank = true
            }
            if (looksStructural && prevLineBlank) {
              // Confirm: no closing `"` between here and end of the
              // comment line.
              let hasCloseSoon = false
              let scanLimit = Math.min(n, k + 400)
              for (let m = k; m < scanLimit; m++) {
                if (src[m] === '"' && src[m - 1] !== '\\') { hasCloseSoon = true; break }
                if (src[m] === '\n' && src[m + 1] === '(') break
              }
              if (!hasCloseSoon) {
                warnings.push(`tokenizer: unterminated string opened at ${startLine}:${startCol} — closed via recovery before line ${line}`)
                j = k
                closed = true
                break
              }
            }
          }
          continue
        }
        out += src[j]
        j++
      }
      if (!closed) {
        warnings.push(`tokenizer: unterminated string opened at ${startLine}:${startCol} — closed at EOF`)
        tokens.push([T_STRING, out, startLine, startCol])
        i = j
        continue
      }
      // If we closed via structural recovery, don't consume a `"` we
      // never actually saw.
      if (j < n && src[j] === '"') {
        tokens.push([T_STRING, out, startLine, startCol])
        i = j + 1
      } else {
        tokens.push([T_STRING, out, startLine, startCol])
        i = j
      }
      continue
    }

    // # reader macros: #t #f #inst #0= #0#
    if (c === '#') {
      const c2 = src[i + 1]
      if (c2 === 't') { tokens.push([T_BOOL, true, line, col()]); i += 2; continue }
      if (c2 === 'f') { tokens.push([T_BOOL, false, line, col()]); i += 2; continue }
      // #inst "..."
      if (src.startsWith('#inst', i)) {
        let j = i + 5
        while (j < n && (src[j] === ' ' || src[j] === '\t')) j++
        if (src[j] === '"') {
          const strStartLine = line
          const strStartCol = j - colStart + 1
          let k = j + 1
          let out = ''
          let closed = false
          while (k < n && src[k] !== '"') {
            if (src[k] === '\n') { line++; colStart = k + 1 }
            out += src[k]; k++
          }
          if (k < n && src[k] === '"') closed = true
          if (!closed) {
            warnings.push(`tokenizer: unterminated #inst string opened at ${strStartLine}:${strStartCol}`)
            tokens.push([T_INST, out, line, col()])
            i = k
            continue
          }
          tokens.push([T_INST, out, line, col()])
          i = k + 1
          continue
        }
      }
      // #0= / #0# label
      const labelMatch = src.slice(i + 1).match(/^(\d+)([=#])/)
      if (labelMatch) {
        const num = parseInt(labelMatch[1], 10)
        const kind = labelMatch[2] === '=' ? T_LABEL_DEF : T_LABEL_REF
        tokens.push([kind, num, line, col()])
        i += 1 + labelMatch[0].length
        continue
      }
      // fall through to symbol
    }

    // Scheme reader-macro prefixes: quote `'`, quasi-quote `` ` ``,
    // unquote `,`, unquote-splicing `,@`. Tolerated: emitted as a
    // single-char symbol so downstream rendering preserves fidelity.
    // Only applies when the prefix immediately precedes a form-opening
    // char (`(`, letter, digit, `[`, `#`) — this avoids stealing
    // stray apostrophes / commas that aren't reader macros.
    if (c === "'" || c === '`' || (c === ',' && src[i + 1] === '@')) {
      const next1 = src[i + 1] || ''
      const next2 = src[i + 2] || ''
      const looksLikeMacro = (
        (c === ',' && src[i + 1] === '@' && /[A-Za-z0-9_([#]/.test(next2)) ||
        (c !== ',' && /[A-Za-z0-9_([#]/.test(next1))
      )
      if (looksLikeMacro) {
        const startLine = line
        const startCol = col()
        let prefix = c
        if (c === ',' && src[i + 1] === '@') { prefix = ',@'; i++ }
        tokens.push([T_SYMBOL, prefix, startLine, startCol])
        // no warning — this is a normal reader macro, silently
        // preserved as a symbol for fidelity
        i++
        continue
      }
    }

    // Bare `,` that's NOT the start of a digit-grouped number and NOT
    // an unquote form: treat as whitespace with a warning. This
    // catches hand-authored digit-grouping outside of strings
    // (`34,300`), keyword pairs written prose-style (`:a, :b`), etc.
    if (c === ',') {
      warnings.push(`tokenizer: bare ',' at ${line}:${col()} — treated as whitespace`)
      i++
      continue
    }

    // keyword :foo
    if (c === ':' && /[A-Za-z_-]/.test(src[i + 1] || '')) {
      let j = i + 1
      while (j < n && !ATOM_TERM.test(src[j])) j++
      tokens.push([T_KEYWORD, src.slice(i + 1, j), line, col()])
      i = j
      continue
    }

    // atom (number or symbol) — with number-comma tolerance
    let j = i
    while (j < n && !ATOM_TERM.test(src[j])) j++
    let atom = src.slice(i, j)
    // Peek: if the atom is all digits (or negative-sign + digits) AND
    // the next char is `,` AND after the `,` there are more digits,
    // this is a digit-grouped number like `28,500` or `34,300`. Glob
    // it into a single numeric atom with commas stripped.
    if (/^-?\d+$/.test(atom) && src[j] === ',' && /\d/.test(src[j + 1] || '')) {
      // consume repeated `,dddd` groups AND optional `.frac`
      let extendedAtom = atom
      let jj = j
      while (src[jj] === ',' && /\d/.test(src[jj + 1] || '')) {
        // grab `,` + trailing digits
        let start = jj
        jj++
        while (jj < n && /\d/.test(src[jj])) jj++
        extendedAtom += src.slice(start, jj)
      }
      // optional fractional part
      if (src[jj] === '.' && /\d/.test(src[jj + 1] || '')) {
        let start = jj
        jj++
        while (jj < n && /\d/.test(src[jj])) jj++
        extendedAtom += src.slice(start, jj)
      }
      // Only accept the merge if we ended at a proper terminator
      if (jj >= n || ATOM_TERM.test(src[jj])) {
        // strip commas for numeric parsing but keep original for symbol fallback
        const numericAtom = extendedAtom.replace(/,/g, '')
        if (/^-?\d+$/.test(numericAtom)) {
          tokens.push([T_INT, parseInt(numericAtom, 10), line, col()])
        } else if (/^-?\d+\.\d+$/.test(numericAtom)) {
          tokens.push([T_FLOAT, parseFloat(numericAtom), line, col()])
        } else {
          tokens.push([T_SYMBOL, extendedAtom, line, col()])
        }
        i = jj
        continue
      }
    }
    if (atom.length === 0) {
      // Should be unreachable given the bare-comma branch above, but
      // log defensively rather than crash.
      warnings.push(`tokenizer: unexpected char '${c}' at ${line}:${col()} — skipped`)
      i++
      continue
    }
    if (atom === 'nil') tokens.push([T_NIL, null, line, col()])
    else if (/^-?\d+$/.test(atom)) tokens.push([T_INT, parseInt(atom, 10), line, col()])
    else if (/^-?\d+\.\d+([eE][-+]?\d+)?$/.test(atom)) tokens.push([T_FLOAT, parseFloat(atom), line, col()])
    else if (/^-?\d+\/-?\d+$/.test(atom)) tokens.push([T_RATIONAL, atom, line, col()])
    else tokens.push([T_SYMBOL, atom, line, col()])
    i = j
  }
  return { tokens, warnings }
}

// ─────────────────────────────────────────────────────────────────────
// Parser — token stream → tree of forms
//
// A form is either:
//   - primitive (string, number, boolean, null, symbol { _sym: 'name' },
//     keyword { _kw: 'name' }, inst { _inst: '...' })
//   - list [ ... ] (bracketed vector)
//   - canonical form { _form: 'head', <keyword>: value, _positional: [] }
// ─────────────────────────────────────────────────────────────────────

const SYM = (name) => ({ _sym: name })
const KW = (name) => ({ _kw: name })
const isSym = (v) => v && typeof v === 'object' && '_sym' in v
const isKw = (v) => v && typeof v === 'object' && '_kw' in v

// parseForms — tolerant parser. Never throws for recoverable input;
// pushes warnings into the supplied `warnings` array. Returns
// { forms, warnings }.
function parseForms(tokens, warnings) {
  if (!warnings) warnings = []
  const labels = new Map()
  let pos = 0
  const forms = []

  // Sentinel returned by readOne() when it consumed something that
  // shouldn't produce a value (e.g. a stray close paren skipped at top
  // level). Distinct from `null` because `null` is a legitimate NIL.
  const SKIP = Symbol('skip')

  function readOne() {
    if (pos >= tokens.length) {
      // Should only happen if a list's readOne is called past EOF;
      // treat as sentinel so callers can bail.
      return SKIP
    }
    const [kind, val, ln, cl] = tokens[pos++]

    if (kind === T_LPAREN) {
      const items = []
      while (pos < tokens.length && tokens[pos][0] !== T_RPAREN) {
        const child = readOne()
        if (child === SKIP) {
          // stray close-of-something popped inside — bail this list
          break
        }
        items.push(child)
      }
      if (pos < tokens.length && tokens[pos][0] === T_RPAREN) {
        pos++ // consume )
      } else {
        warnings.push(`parser: unclosed '(' at ${ln}:${cl} — closed at EOF`)
      }
      return canonicalize(items)
    }

    if (kind === T_LBRACK) {
      const items = []
      while (pos < tokens.length && tokens[pos][0] !== T_RBRACK) {
        const child = readOne()
        if (child === SKIP) break
        items.push(child)
      }
      if (pos < tokens.length && tokens[pos][0] === T_RBRACK) {
        pos++ // consume ]
      } else {
        warnings.push(`parser: unclosed '[' at ${ln}:${cl} — closed at EOF`)
      }
      return { _vector: items }
    }

    if (kind === T_RPAREN) {
      warnings.push(`parser: stray ')' at ${ln}:${cl} — skipped`)
      return SKIP
    }
    if (kind === T_RBRACK) {
      warnings.push(`parser: stray ']' at ${ln}:${cl} — skipped`)
      return SKIP
    }

    if (kind === T_LABEL_DEF) {
      const child = readOne()
      if (child !== SKIP) labels.set(val, child)
      return child
    }
    if (kind === T_LABEL_REF) {
      if (!labels.has(val)) return { _labelRef: val }
      return labels.get(val)
    }

    if (kind === T_STRING) return val
    if (kind === T_TRIPLE) return val
    if (kind === T_INT) return val
    if (kind === T_FLOAT) return val
    if (kind === T_RATIONAL) return { _rational: val }
    if (kind === T_BOOL) return val
    if (kind === T_NIL) return null
    if (kind === T_INST) return { _inst: val }
    if (kind === T_KEYWORD) return KW(val)
    if (kind === T_SYMBOL) return SYM(val)

    warnings.push(`parser: unknown token kind ${kind} at ${ln}:${cl} — skipped`)
    return SKIP
  }

  function canonicalize(items) {
    // if head is a symbol, fold into canonical form
    if (items.length && isSym(items[0])) {
      const form = { _form: items[0]._sym }
      const positional = []
      let idx = 1
      while (idx < items.length) {
        const el = items[idx]
        if (isKw(el) && idx + 1 < items.length) {
          form[el._kw] = items[idx + 1]
          idx += 2
        } else {
          positional.push(el)
          idx++
        }
      }
      if (positional.length) form._positional = positional
      return form
    }
    // otherwise: bare list
    return { _list: items }
  }

  while (pos < tokens.length) {
    const form = readOne()
    if (form === SKIP) continue
    forms.push(form)
  }
  return { forms, warnings }
}

// ─────────────────────────────────────────────────────────────────────
// Renderer — form tree → Markdown
// ─────────────────────────────────────────────────────────────────────

const CANONICAL_FRONTMATTER_KEYS = [
  'doc-id', 'title', 'chapter-number', 'section-number', 'book',
  'author', 'date', 'ts', 'status', 'audience', 'dialect', 'voice',
  'training-eligible', 'confidentiality', 'provenance',
  'collection', 'version', 'owner', 'created', 'for',
  'source-slat', 'generated',
]

function renderForms(forms, opts = {}) {
  const { sourcePath = null, sourceRoot = null } = opts
  const parts = []
  const provenances = []
  const warnings = []

  // First pass: collect metadata for frontmatter
  const frontmatter = {}
  const badgeFields = []
  let dialectCallout = null
  let mainTitle = null

  for (const form of forms) {
    if (!form || typeof form !== 'object' || !form._form) continue
    const f = form._form

    // dialect declaration at top level → badge
    if (f === 'dialect' && !form._positional) {
      dialectCallout = form
      continue
    }

    // metadata scoop
    for (const key of ['doc-id', 'title', 'author', 'status', 'for',
                       'audience', 'training-eligible', 'confidentiality',
                       'provenance', 'chapter-number', 'section-number',
                       'book', 'dialect', 'voice', 'collection',
                       'version', 'owner', 'created']) {
      if (key in form && !(key in frontmatter)) {
        frontmatter[key] = form[key]
      }
    }
    // ts as date
    if ('ts' in form && !('date' in frontmatter)) {
      frontmatter.date = form.ts
    }
    if (!mainTitle) {
      if (form.title) mainTitle = form.title
      else if (form['doc-id']) mainTitle = form['doc-id']
    }
  }

  // add source-slat
  if (sourcePath) {
    const rel = sourceRoot ? relative(sourceRoot, sourcePath) : basename(sourcePath)
    frontmatter['source-slat'] = rel
  }
  frontmatter.generated = 'do not hand-edit — rendered from SLAT'

  // Emit frontmatter
  parts.push('---')
  const ordered = []
  for (const k of CANONICAL_FRONTMATTER_KEYS) {
    if (k in frontmatter) ordered.push(k)
  }
  const rest = Object.keys(frontmatter).filter(k => !CANONICAL_FRONTMATTER_KEYS.includes(k)).sort()
  for (const k of [...ordered, ...rest]) {
    parts.push(`${k}: ${yamlValue(frontmatter[k])}`)
  }
  parts.push('---')
  parts.push('')

  // H1
  if (mainTitle) {
    parts.push(`# ${primString(mainTitle)}`)
    parts.push('')
  }

  // Badges: dialect / audience / training-eligible
  const badges = []
  if (dialectCallout) {
    badges.push(renderDialectBadge(dialectCallout))
  }
  if (frontmatter.audience) {
    badges.push(`> **Audience:** ${flattenList(frontmatter.audience)}`)
  }
  if (frontmatter.dialect && !dialectCallout) {
    badges.push(`> **Dialect:** \`${primString(frontmatter.dialect)}\``)
  }
  if ('training-eligible' in frontmatter) {
    const v = frontmatter['training-eligible']
    badges.push(`> **Training-eligible:** ${v === true ? 'yes' : v === false ? 'no' : primString(v)}`)
  }
  if (frontmatter.confidentiality) {
    badges.push(`> **Confidentiality:** \`${primString(frontmatter.confidentiality)}\``)
  }
  if (badges.length) {
    parts.push(badges.join('\n'))
    parts.push('')
  }

  // Second pass: render body
  for (const form of forms) {
    const chunk = renderForm(form, { provenances, warnings, alreadyTitled: !!mainTitle })
    if (chunk) {
      parts.push(chunk)
      parts.push('')
    }
  }

  // Provenance footnotes
  if (provenances.length) {
    parts.push('---')
    parts.push('')
    parts.push('## Provenance')
    parts.push('')
    for (const p of provenances) {
      parts.push(`- ${p}`)
    }
    parts.push('')
  }

  // Trailing newline discipline
  let output = parts.join('\n').replace(/\n{3,}/g, '\n\n')
  if (!output.endsWith('\n')) output += '\n'
  return { markdown: output, warnings }
}

function renderForm(form, ctx) {
  if (form === null || form === undefined) return ''
  if (typeof form !== 'object') return String(form)

  // bare list (no head symbol)
  if ('_list' in form) {
    return renderBareList(form._list)
  }
  if ('_vector' in form) {
    return renderBareList(form._vector)
  }

  if (!form._form) return ''
  const f = form._form

  switch (f) {
    case 'chapter':      return renderChapter(form, ctx)
    case 'section':      return renderSection(form, ctx)
    case 'rules':        return renderRules(form, ctx)
    case 'slat-set':     return renderSlatSet(form, ctx)
    case 'dialect':      return '' // handled as badge; skip in body
    case 'convention':   return renderConvention(form, ctx)
    case 'prose':
    case 'paragraph':    return primString(form._positional?.[0] ?? form.text ?? '')
    case 'code':
    case 'example':      return renderCode(form, ctx)
    case 'cross-ref':    return renderCrossRef(form, ctx)
    case 'metadata':     return '' // absorbed into frontmatter
    case 'provenance':
      if (form._positional?.[0]) ctx.provenances.push(primString(form._positional[0]))
      else if (form.source || form.notes) {
        const bits = []
        if (form.source) bits.push(`source: ${primString(form.source)}`)
        if (form.date) bits.push(`date: ${primString(form.date)}`)
        if (form.notes) bits.push(primString(form.notes))
        ctx.provenances.push(bits.join(' — '))
      }
      return ''
    case 'facets':       return renderFacets(form, ctx)
    default:
      ctx.warnings.push(`unknown record type "${f}"`)
      return renderUnknown(form)
  }
}

function renderChapter(form, ctx) {
  const num = form['chapter-number']
  const title = form.title || ''
  const parts = []
  const heading = num !== undefined
    ? `# Chapter ${primString(num)} — ${primString(title)}`
    : `# ${primString(title)}`
  // ctx.alreadyTitled controls whether we suppress the H1
  if (!ctx.alreadyTitled) {
    parts.push(heading)
    parts.push('')
  }
  ctx.alreadyTitled = true
  if (form.prose) {
    parts.push(primString(form.prose))
  }
  // sub-fields like :examples, :cross-refs — render if present
  for (const key of Object.keys(form)) {
    if (['_form', '_positional', 'chapter-number', 'title', 'prose', 'book',
         'audience', 'dialect', 'voice', 'training-eligible', 'confidentiality',
         'provenance'].includes(key)) continue
    const val = form[key]
    parts.push('')
    parts.push(`## ${prettyKey(key)}`)
    parts.push('')
    parts.push(renderValue(val, ctx))
  }
  return parts.join('\n')
}

function renderSection(form, ctx) {
  const num = form.number
  const title = form.title || ''
  const short = form.short
  const parts = []
  // If we already emitted mainTitle from this same section's :title,
  // don't repeat. Otherwise emit § heading.
  if (!ctx.alreadyTitled) {
    const heading = num !== undefined
      ? `# §${primString(num)} — ${primString(title)}`
      : `# ${primString(title)}`
    parts.push(heading)
    parts.push('')
  } else if (num !== undefined) {
    // add a subtitle line with the section number
    parts.push(`_§${primString(num)}_`)
    parts.push('')
  }
  ctx.alreadyTitled = true
  if (short) {
    parts.push(`> ${primString(short)}`)
    parts.push('')
  }
  if (form.prose) {
    parts.push(primString(form.prose))
  }
  for (const key of Object.keys(form)) {
    if (['_form', '_positional', 'number', 'title', 'short', 'prose', 'book',
         'audience', 'dialect', 'voice', 'training-eligible', 'confidentiality',
         'provenance'].includes(key)) continue
    const val = form[key]
    parts.push('')
    parts.push(`## ${prettyKey(key)}`)
    parts.push('')
    parts.push(renderValue(val, ctx))
  }
  return parts.join('\n')
}

function renderRules(form, ctx) {
  const parts = []
  const collection = form.collection || form['doc-id'] || 'rules'
  if (!ctx.alreadyTitled) {
    parts.push(`# Rules — ${primString(collection)}`)
    parts.push('')
    ctx.alreadyTitled = true
  }
  const skip = new Set(['_form', '_positional', 'collection', 'version', 'created',
                        'owner', 'parent-rules', 'audience', 'dialect',
                        'training-eligible', 'confidentiality'])
  for (const key of Object.keys(form)) {
    if (skip.has(key)) continue
    const val = form[key]
    parts.push(`## ${prettyKey(key)}`)
    parts.push('')
    parts.push(renderValue(val, ctx))
    parts.push('')
  }
  return parts.join('\n')
}

function renderSlatSet(form, ctx) {
  const parts = []
  const title = form['doc-id'] || form.title || 'Document'
  if (!ctx.alreadyTitled) {
    parts.push(`# ${primString(title)}`)
    parts.push('')
    ctx.alreadyTitled = true
  }
  const skip = new Set([
    '_form', '_positional', 'doc-id', 'title', 'ts', 'author', 'for',
    'status', 'audience', 'dialect', 'training-eligible', 'confidentiality',
    'provenance', 'supersedes', 'cap', 'composes-with',
    'end', 'next-action',
  ])
  // section-N-name fields: sort by N, render as ## Section N — Name
  const sectionKeys = []
  const otherKeys = []
  for (const key of Object.keys(form)) {
    if (skip.has(key)) continue
    const m = key.match(/^section-(\d+)-(.+)$/)
    if (m) sectionKeys.push({ n: parseInt(m[1], 10), rest: m[2], key })
    else otherKeys.push(key)
  }
  sectionKeys.sort((a, b) => a.n - b.n)

  for (const { n, rest, key } of sectionKeys) {
    parts.push(`## Section ${n} — ${prettyKey(rest)}`)
    parts.push('')
    parts.push(renderValue(form[key], ctx))
    parts.push('')
  }

  for (const key of otherKeys) {
    parts.push(`## ${prettyKey(key)}`)
    parts.push('')
    parts.push(renderValue(form[key], ctx))
    parts.push('')
  }

  // trailing meta
  if (form['composes-with']) {
    parts.push('## Composes with')
    parts.push('')
    parts.push(renderValue(form['composes-with'], ctx))
    parts.push('')
  }
  if (form.end) {
    parts.push(`> End — ${primString(form.end)}`)
    parts.push('')
  }
  if (form['next-action']) {
    parts.push('## Next action')
    parts.push('')
    parts.push(primString(form['next-action']))
    parts.push('')
  }
  return parts.join('\n')
}

function renderConvention(form, ctx) {
  const parts = []
  const area = form.area || 'convention'
  const summary = form.summary
  parts.push(`## Convention — ${primString(area)}`)
  parts.push('')
  if (summary) {
    parts.push(`_${primString(summary)}_`)
    parts.push('')
  }
  if (form.rules) {
    parts.push(renderValue(form.rules, ctx))
    parts.push('')
  }
  return parts.join('\n')
}

function renderCode(form, ctx) {
  const lang = form.dialect
    ? primString(form.dialect)
    : (form.lang ? primString(form.lang) : 'motoi')
  const source = form.source || form.body || form._positional?.[0] || ''
  const fence = '```'
  return `${fence}${lang}\n${primString(source)}\n${fence}`
}

function renderCrossRef(form, ctx) {
  const text = primString(form.text || form.label || form.to || '')
  const to = primString(form.to || form.url || '')
  return `[${text}](${to})`
}

function renderFacets(form, ctx) {
  const parts = []
  parts.push('| Name | Type | Values |')
  parts.push('|---|---|---|')
  const rows = form._positional || []
  for (const row of rows) {
    if (!row || typeof row !== 'object') continue
    const name = primString(row.name || row._form || '')
    const type = primString(row.type || '')
    const values = row.values ? flattenList(row.values) : ''
    parts.push(`| ${name} | ${type} | ${values} |`)
  }
  return parts.join('\n')
}

function renderDialectBadge(form) {
  const applies = form.applies
  const note = form.note
  const list = applies && applies._list
    ? applies._list.map(primString).map(s => `\`${s}\``).join(', ')
    : (applies ? primString(applies) : '')
  const noteStr = note ? ` — ${primString(note)}` : ''
  return `> **Dialect:** ${list}${noteStr}`
}

function renderUnknown(form) {
  const parts = []
  parts.push(`<!-- warning: unknown record type "${form._form}" — rendered raw -->`)
  parts.push('```lisp')
  parts.push(emitSExpr(form))
  parts.push('```')
  return parts.join('\n')
}

function renderBareList(items) {
  // detect: list of keyword-pair-only bare lists (no head symbol).
  // Source shape: ((:name "..." :purpose "...") (:name "..." :purpose "..."))
  // Render as a definition-list-like bulleted list.
  const kwListPattern = items.every(x =>
    x && typeof x === 'object' && '_list' in x && x._list.length > 0 &&
    x._list.every((el, i) => i % 2 === 0 ? isKw(el) : true) &&
    x._list.length % 2 === 0)
  if (kwListPattern && items.length > 0) {
    const parts = []
    for (const it of items) {
      const pairs = it._list
      const bits = []
      for (let i = 0; i < pairs.length; i += 2) {
        const k = pairs[i]._kw
        const v = renderValue(pairs[i + 1], { provenances: [], warnings: [] })
        bits.push(`**${k}:** ${v}`)
      }
      parts.push(`- ${bits.join(' — ')}`)
    }
    return parts.join('\n')
  }
  // detect: list of (string . keyword-pairs) entries — the "convention rules" shape:
  //   (("text describing rule" :cross-ref "R7RS §X") ("text" :cross-ref "..."))
  const rulePattern = items.every(x =>
    x && typeof x === 'object' && '_list' in x && x._list.length > 0 &&
    typeof x._list[0] === 'string' &&
    x._list.slice(1).every((el, i) => i % 2 === 0 ? isKw(el) : true))
  if (rulePattern && items.length > 0) {
    const parts = []
    for (const it of items) {
      const list = it._list
      const head = dedent(list[0])
      const extras = []
      for (let i = 1; i < list.length; i += 2) {
        if (!isKw(list[i])) break
        const k = list[i]._kw
        const v = renderValue(list[i + 1], { provenances: [], warnings: [] })
        extras.push(`_${k}:_ ${v}`)
      }
      const extraStr = extras.length ? ` (${extras.join('; ')})` : ''
      parts.push(`- ${head}${extraStr}`)
    }
    return parts.join('\n')
  }
  // all-primitive list → bullets
  if (items.every(x => typeof x === 'string' || typeof x === 'number' ||
                       typeof x === 'boolean' || isKw(x) || isSym(x))) {
    return items.map(x => `- ${renderValue(x, { provenances: [], warnings: [] })}`).join('\n')
  }
  // mixed / form list → each item rendered separately
  const parts = []
  for (const it of items) {
    if (typeof it === 'object' && it && it._form) {
      const rendered = renderForm(it, { provenances: [], warnings: [], alreadyTitled: true })
      parts.push(rendered)
    } else {
      parts.push(`- ${renderValue(it, { provenances: [], warnings: [] })}`)
    }
  }
  return parts.join('\n\n')
}

// ─────────────────────────────────────────────────────────────────────
// Value rendering — used inside sub-sections
// ─────────────────────────────────────────────────────────────────────

function renderValue(val, ctx) {
  if (val === null || val === undefined) return '_nil_'
  if (typeof val === 'string') return dedent(val)
  if (typeof val === 'number' || typeof val === 'boolean') return String(val)
  if (isSym(val)) return `\`${val._sym}\``
  if (isKw(val)) return `\`:${val._kw}\``
  if ('_inst' in val) return `\`${val._inst}\``
  if ('_rational' in val) return `\`${val._rational}\``
  if ('_list' in val) return renderBareList(val._list)
  if ('_vector' in val) return renderBareList(val._vector)
  if (val._form) {
    return renderForm(val, ctx)
  }
  // fallback: emit as fenced lisp
  return '```lisp\n' + emitSExpr(val) + '\n```'
}

// ─────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────

function primString(v) {
  if (v === null || v === undefined) return ''
  if (typeof v === 'string') return dedent(v)
  if (typeof v === 'number' || typeof v === 'boolean') return String(v)
  if (isSym(v)) return v._sym
  if (isKw(v)) return `:${v._kw}`
  if (v && '_inst' in v) return v._inst
  if (v && '_rational' in v) return v._rational
  return String(v)
}

// dedent: strip common leading whitespace from all non-blank lines.
// Excludes the first line from the indent-computation if it hugs the
// opening quote (has no leading whitespace) — that's the SLAT convention
// for docstrings where the first character sits right after the quote.
// If single-line, just trimStart.
function dedent(s) {
  if (typeof s !== 'string' || !s.includes('\n')) return s.trimStart()
  const lines = s.split('\n')
  const firstLineHugs = lines.length > 0 && !/^\s/.test(lines[0]) && lines[0].trim() !== ''
  let minIndent = Infinity
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    if (line.trim() === '') continue
    if (i === 0 && firstLineHugs) continue // exclude
    const m = line.match(/^(\s*)/)
    const indent = m[1].length
    if (indent < minIndent) minIndent = indent
  }
  if (!isFinite(minIndent) || minIndent === 0) return s
  return lines.map((line, i) => {
    if (i === 0 && firstLineHugs) return line
    if (line.trim() === '') return ''
    return line.slice(minIndent)
  }).join('\n')
}

function flattenList(v) {
  if (Array.isArray(v)) return v.map(primString).join(', ')
  if (v && v._list) return v._list.map(primString).join(', ')
  if (v && v._vector) return v._vector.map(primString).join(', ')
  return primString(v)
}

function prettyKey(k) {
  // section-0-frame → Section 0 — Frame  (but we handle section-N-* separately)
  // book -> Book, provenance -> Provenance, the-80-percent-rule -> The 80 percent rule
  return k.replace(/[-_]/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
}

function yamlValue(v) {
  if (v === null || v === undefined) return 'null'
  if (typeof v === 'boolean') return v ? 'true' : 'false'
  if (typeof v === 'number') return String(v)
  if (typeof v === 'string') return yamlString(v)
  if (isSym(v)) return yamlString(v._sym)
  if (isKw(v)) return yamlString(':' + v._kw)
  if (v && '_inst' in v) return yamlString(v._inst)
  if (v && '_rational' in v) return yamlString(v._rational)
  if (v && '_list' in v) return '[' + v._list.map(yamlValue).join(', ') + ']'
  if (v && '_vector' in v) return '[' + v._vector.map(yamlValue).join(', ') + ']'
  if (Array.isArray(v)) return '[' + v.map(yamlValue).join(', ') + ']'
  // fallback: stringify
  return yamlString(primString(v))
}

function yamlString(s) {
  if (s === '') return '""'
  const needsQuote = /[:#\[\]{}&*!|>'"%@`\n\t]/.test(s) || /^\s|\s$/.test(s) || /^[-?]/.test(s)
  if (needsQuote) {
    // truncate very long strings (e.g. provenance) at 200 chars
    let trimmed = s
    if (trimmed.length > 200) trimmed = trimmed.slice(0, 197) + '...'
    // collapse newlines to space for YAML single-line
    trimmed = trimmed.replace(/\s+/g, ' ').trim()
    return `"${trimmed.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`
  }
  return s
}

// Emit S-expression back out (used for unknown record fallback)
function emitSExpr(v, depth = 0) {
  if (v === null || v === undefined) return 'nil'
  if (typeof v === 'boolean') return v ? '#t' : '#f'
  if (typeof v === 'number') return String(v)
  if (typeof v === 'string') return JSON.stringify(v)
  if (isSym(v)) return v._sym
  if (isKw(v)) return `:${v._kw}`
  if (v && '_inst' in v) return `#inst ${JSON.stringify(v._inst)}`
  if (v && '_rational' in v) return v._rational
  if (v && '_list' in v) return '(' + v._list.map(x => emitSExpr(x, depth + 1)).join(' ') + ')'
  if (v && '_vector' in v) return '[' + v._vector.map(x => emitSExpr(x, depth + 1)).join(' ') + ']'
  if (v && v._form) {
    const parts = [v._form]
    for (const p of v._positional || []) parts.push(emitSExpr(p, depth + 1))
    for (const k of Object.keys(v)) {
      if (k === '_form' || k === '_positional') continue
      parts.push(`:${k}`, emitSExpr(v[k], depth + 1))
    }
    return '(' + parts.join(' ') + ')'
  }
  return String(v)
}

// ─────────────────────────────────────────────────────────────────────
// File-level convert
// ─────────────────────────────────────────────────────────────────────

export function convertSlatToMd(src, opts = {}) {
  const preWarnings = []
  let tokens = []
  let forms = []
  try {
    const tokRes = tokenize(src, preWarnings)
    tokens = tokRes.tokens
  } catch (e) {
    // Should never happen (tokenizer is now non-throwing), but if it
    // does, degrade to empty tokens + warning.
    preWarnings.push(`tokenizer: threw ${e.message} — proceeding with partial tokens`)
  }
  try {
    const parseRes = parseForms(tokens, preWarnings)
    forms = parseRes.forms
  } catch (e) {
    preWarnings.push(`parser: threw ${e.message} — proceeding with partial forms`)
  }
  const result = renderForms(forms, opts)
  // Prepend tokenizer/parser warnings ahead of renderer warnings.
  result.warnings = [...preWarnings, ...result.warnings]
  // If any recovery kicked in, embed a warning banner in the MD so
  // nothing is silently lost — put it AFTER the frontmatter block so
  // frontmatter parsers still work.
  if (preWarnings.length > 0) {
    const banner = [
      '',
      '<!--',
      'SLAT-RENDER WARNINGS (parse recovery kicked in):',
      ...preWarnings.map(w => '  · ' + w),
      '-->',
      '',
    ].join('\n')
    // Insert after the closing `---` of the YAML frontmatter (first
    // occurrence after the opening `---`).
    const md = result.markdown
    const firstClose = md.indexOf('\n---\n', 4)
    if (firstClose > 0) {
      result.markdown = md.slice(0, firstClose + 5) + banner + md.slice(firstClose + 5)
    } else {
      result.markdown = banner + md
    }
  }
  return result
}

// ─────────────────────────────────────────────────────────────────────
// Path handling
// ─────────────────────────────────────────────────────────────────────

function sourceToMdPath(sourcePath, outDir = null, treeRoot = null) {
  const base = basename(sourcePath)
  // strip .slat or .slatl only from the tail; preserve interior dots
  const mdBase = base.replace(/\.(slatl|slat)$/i, '.md')
  if (outDir) {
    if (treeRoot) {
      const rel = relative(treeRoot, sourcePath)
      const relDir = dirname(rel)
      const outPath = join(outDir, relDir, mdBase)
      return outPath
    }
    return join(outDir, mdBase)
  }
  return join(dirname(sourcePath), mdBase)
}

// ─────────────────────────────────────────────────────────────────────
// Tree walking
// ─────────────────────────────────────────────────────────────────────

const SKIP_DIRS = new Set([
  '_archive', '_recycling-bin', 'node_modules', '.git', 'dist', 'build',
])

function shouldSkipDir(name) {
  if (SKIP_DIRS.has(name)) return true
  if (name.startsWith('_recycling-bin')) return true
  if (name.startsWith('.')) return true
  return false
}

function* walkSlatFiles(root) {
  let entries
  try { entries = readdirSync(root, { withFileTypes: true }) }
  catch { return }
  for (const ent of entries) {
    const p = join(root, ent.name)
    if (ent.isDirectory()) {
      if (shouldSkipDir(ent.name)) continue
      yield* walkSlatFiles(p)
    } else if (ent.isFile()) {
      if (/\.(slat|slatl)$/i.test(ent.name)) yield p
    }
  }
}

// ─────────────────────────────────────────────────────────────────────
// CLI
// ─────────────────────────────────────────────────────────────────────

function log(quiet, msg) { if (!quiet) process.stdout.write(msg + '\n') }
function err(msg) { process.stderr.write(msg + '\n') }

function usage() {
  err('usage: slat-render [--tree ROOT | FILE] [--out DIR] [--check] [--strict] [--quiet]')
  err('       renders SLAT source to Markdown alongside the source (or into --out)')
}

function processFile(sourcePath, opts) {
  const { outDir, treeRoot, checkOnly, strict, quiet } = opts
  let src
  try { src = readFileSync(sourcePath, 'utf8') }
  catch (e) {
    err(`[slat-render] read error: ${sourcePath}: ${e.message}`)
    return 2
  }
  let result
  let hardFallback = false
  try {
    result = convertSlatToMd(src, { sourcePath, sourceRoot: treeRoot })
  } catch (e) {
    // The tokenizer + parser are now non-throwing; a throw here would
    // come from renderForms — a shape it didn't expect. Emit a
    // hard-fallback MD that preserves the raw SLAT so nothing is lost.
    err(`[slat-render] partial render (renderer threw): ${sourcePath}: ${e.message}`)
    result = {
      markdown: buildHardFallbackMd(sourcePath, src, e),
      warnings: [`hard-fallback: renderer threw ${e.message}`],
    }
    hardFallback = true
  }
  if (checkOnly) {
    if (result.warnings.length > 0) {
      log(quiet, `[slat-render] ok (with ${result.warnings.length} warnings): ${sourcePath}`)
      if (!quiet) {
        for (const w of result.warnings.slice(0, 5)) err(`  · ${w}`)
        if (result.warnings.length > 5) err(`  · ...and ${result.warnings.length - 5} more`)
      }
      // In strict mode, any parse-recovery warning is an error.
      return strict ? 1 : 0
    }
    log(quiet, `[slat-render] ok: ${sourcePath}`)
    return 0
  }
  const outPath = sourceToMdPath(sourcePath, outDir, treeRoot)
  try {
    mkdirSync(dirname(outPath), { recursive: true })
    writeFileSync(outPath, result.markdown, 'utf8')
  } catch (e) {
    err(`[slat-render] write error: ${outPath}: ${e.message}`)
    return 2
  }
  const wStr = result.warnings.length
    ? ` (${result.warnings.length} warnings${hardFallback ? ', hard-fallback' : ''})`
    : ''
  log(quiet, `[slat-render] rendered: ${sourcePath} → ${outPath}${wStr}`)
  if (result.warnings.length > 0 && !quiet) {
    for (const w of result.warnings.slice(0, 5)) err(`  · ${w}`)
    if (result.warnings.length > 5) err(`  · ...and ${result.warnings.length - 5} more`)
  }
  return strict && result.warnings.length > 0 ? 1 : 0
}

// Hard-fallback MD emitter — used only when the main renderer itself
// throws (should be rare after the tokenizer/parser were made
// non-throwing). Emits enough frontmatter to identify the source, then
// dumps the raw SLAT inside a fenced block so the content survives.
function buildHardFallbackMd(sourcePath, src, err) {
  const rel = basename(sourcePath)
  const lines = [
    '---',
    `source-slat: ${rel}`,
    `status: "partial-render — renderer threw"`,
    `generated: "do not hand-edit — rendered from SLAT"`,
    '---',
    '',
    '<!--',
    'SLAT-RENDER: HARD FALLBACK.',
    'The renderer could not walk this file. Raw SLAT preserved below.',
    `Reason: ${err && err.message ? err.message : String(err)}`,
    '-->',
    '',
    '# ' + rel + ' (partial render)',
    '',
    '> The SLAT source below could not be rendered as structured Markdown.',
    '> Raw content is preserved verbatim. Fix the SLAT to get a clean render.',
    '',
    '```lisp',
    src,
    '```',
    '',
  ]
  return lines.join('\n')
}

function main(argv) {
  const args = argv.slice(2)
  let treeRoot = null
  let outDir = null
  let checkOnly = false
  let strict = false
  let quiet = false
  const files = []

  for (let i = 0; i < args.length; i++) {
    const a = args[i]
    if (a === '--tree') { treeRoot = resolve(args[++i]); continue }
    if (a === '--out') { outDir = resolve(args[++i]); continue }
    if (a === '--check') { checkOnly = true; continue }
    if (a === '--strict') { strict = true; continue }
    if (a === '--quiet' || a === '-q') { quiet = true; continue }
    if (a === '-h' || a === '--help') { usage(); return 0 }
    if (a.startsWith('--')) {
      err(`unknown flag ${a}`); usage(); return 2
    }
    files.push(resolve(a))
  }

  let toProcess = []
  if (treeRoot) {
    for (const p of walkSlatFiles(treeRoot)) toProcess.push(p)
  }
  toProcess.push(...files)

  if (toProcess.length === 0) {
    usage()
    return 2
  }

  let worst = 0
  for (const p of toProcess) {
    const code = processFile(p, { outDir, treeRoot, checkOnly, strict, quiet })
    if (code > worst) worst = code
  }
  return worst
}

// Only run main when invoked as a script
if (import.meta.url === `file://${process.argv[1]}` || process.argv[1]?.endsWith('slat-render.mjs')) {
  process.exit(main(process.argv))
}
