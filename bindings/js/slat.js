// slat — line-delimited S-expressions for JavaScript.
//
// Mirrors the Python binding at bindings/python/. Round-trip contract:
// for any object `x` produced by slatLoads(...), slatDumps(x) parses
// back to a deep-equal `x` (modulo Symbol normalization).
//
// One line = one top-level form. A canonical form (`_form` key) is a
// dict with the head symbol under `_form` and keyword args folded into
// keys. Positional args (non-keyword) live under `_positional`.
//
// Public surface:
//   slatLoads(line)       string  → object
//   slatDumps(obj)        object  → string
//   slatToJsonl(text)     .slat text → .jsonl text
//   jsonlToSlat(text)     .jsonl text → .slat text

// A tagged sentinel — the JS analogue of Python's SlatValue.
// Symbols carry .kind = 'symbol' and .value = 'the-name'.
export class SlatValue {
  constructor(kind, value) { this.kind = kind; this.value = value }
}

const isSymbol = (v) => v instanceof SlatValue && v.kind === 'symbol'

// ─────────────────────────────────────────────────────────────────────
// Tokenizer
// ─────────────────────────────────────────────────────────────────────

// The set of characters that END an atom. The tokenizer used to skip only
// ' ' and '\t' while ending atoms on all of /\s/, so every OTHER whitespace
// character (vertical tab, form feed, NBSP, and the whole U+2000 space
// family) reached the atom branch, matched the terminator on its very first
// character, and produced a zero-width atom WITHOUT advancing `i`. The loop
// then pushed an empty SYM token forever until the host heap died — a hang,
// not a wrong answer. A bare apostrophe did the same, having no branch at
// all. One shared definition now serves both roles so they cannot drift.
const ATOM_END = /[\s()"';]/
const isSlatSpace = (c) => c !== undefined && /\s/.test(c)

function tokenize(src) {
  const tokens = []
  let i = 0
  const n = src.length
  while (i < n) {
    const c = src[i]
    if (c === '\n' || c === '\r') throw new Error('newline inside form (slat lines are single-line)')
    if (isSlatSpace(c)) { i++; continue }
    if (c === "'") {
      throw new Error(
        "apostrophe is not slat syntax: slat is a data format and has no quote "
        + '(write the symbol bare, or put the text inside a "double-quoted string")')
    }
    if (c === '(') { tokens.push(['(', null]); i++; continue }
    if (c === ')') { tokens.push([')', null]); i++; continue }
    if (c === ';') { while (i < n && src[i] !== '\n') i++; continue }
    if (c === '"') {
      let j = i + 1
      let out = ''
      while (j < n && src[j] !== '"') {
        if (src[j] === '\\' && j + 1 < n) {
          const esc = src[j + 1]
          if (esc === 'n') out += '\n'
          else if (esc === 't') out += '\t'
          else if (esc === 'r') out += '\r'
          else if (esc === '\\') out += '\\'
          else if (esc === '"') out += '"'
          else out += esc
          j += 2
        } else { out += src[j]; j++ }
      }
      if (j >= n) throw new Error('unterminated string')
      tokens.push(['STR', out])
      i = j + 1
      continue
    }
    if (c === ':' && /[A-Za-z_]/.test(src[i + 1] || '')) {
      let j = i + 1
      while (j < n && !ATOM_END.test(src[j])) j++
      tokens.push(['KW', src.slice(i + 1, j)])
      i = j
      continue
    }
    if (c === '#') {
      if (src[i + 1] === 't') { tokens.push(['BOOL', true]); i += 2; continue }
      if (src[i + 1] === 'f') { tokens.push(['BOOL', false]); i += 2; continue }
    }
    // atom (symbol, number, or bare word)
    let j = i
    while (j < n && !ATOM_END.test(src[j])) j++
    // A zero-width atom means the character at `i` ends an atom but no branch
    // above consumed it. Every such character is a hang, so this is a hard
    // stop rather than a skip: a new terminator can never again spin the loop.
    if (j === i) {
      throw new Error(
        `unexpected character U+${src.codePointAt(i).toString(16).toUpperCase().padStart(4, '0')} in slat text`)
    }
    const atom = src.slice(i, j)
    if (atom === 'nil') tokens.push(['NIL', null])
    else if (/^-?\d+$/.test(atom)) tokens.push(['INT', parseInt(atom, 10)])
    else if (/^-?\d+\.\d+([eE][-+]?\d+)?$/.test(atom)) tokens.push(['FLT', parseFloat(atom)])
    else if (/^-?\d+\/-?\d+$/.test(atom)) tokens.push(['RAT', atom])
    else tokens.push(['SYM', atom])
    i = j
  }
  return tokens
}

// ─────────────────────────────────────────────────────────────────────
// Parser
// ─────────────────────────────────────────────────────────────────────

function parseFrom(tokens, idx) {
  const [kind, val] = tokens[idx]
  if (kind === '(') return parseListFrom(tokens, idx + 1)
  if (kind === 'STR') return [val, idx + 1]
  if (kind === 'INT' || kind === 'FLT') return [val, idx + 1]
  if (kind === 'BOOL') return [val, idx + 1]
  if (kind === 'NIL') return [null, idx + 1]
  if (kind === 'KW') return [new SlatValue('keyword', val), idx + 1]
  if (kind === 'SYM') return [new SlatValue('symbol', val), idx + 1]
  if (kind === 'RAT') return [new SlatValue('rational', val), idx + 1]
  throw new Error(`unexpected token ${kind}`)
}

function parseListFrom(tokens, idx) {
  const items = []
  while (idx < tokens.length && tokens[idx][0] !== ')') {
    const [v, next] = parseFrom(tokens, idx)
    items.push(v)
    idx = next
  }
  if (idx >= tokens.length) throw new Error('unterminated form')
  // consume the )
  idx += 1
  // canonicalize: if the head is a symbol, fold into a canonical form.
  if (items.length && isSymbol(items[0])) {
    const form = { _form: items[0].value }
    const positional = []
    let i = 1
    while (i < items.length) {
      const el = items[i]
      if (el instanceof SlatValue && el.kind === 'keyword' && i + 1 < items.length) {
        form[el.value] = items[i + 1]
        i += 2
      } else {
        positional.push(el)
        i += 1
      }
    }
    if (positional.length) form._positional = positional
    return [form, idx]
  }
  return [items, idx]
}

/**
 * Parse one slat line (or multi-line text — each line is parsed
 * independently) into JS values.
 *
 * @param {string} src — one slat form, or multiple lines
 * @returns {any|any[]} one parsed value (single line) or array of values (multi-line)
 */
export function slatLoads(src) {
  const out = slatLoadsAll(src)
  return out.length === 1 ? out[0] : out
}

/**
 * Parse slat text into an array of top-level data, ALWAYS one array
 * element per top-level form.
 *
 * slatLoads collapses a one-element result to the element itself, which
 * makes its return shape ambiguous: a single datum that happens to be a
 * list is indistinguishable from N top-level data. A caller that has to
 * count forms — a whole-document parse, say — cannot do it from that
 * value, and guessing produced wrong answers in BOTH directions.
 *
 * @param {string} src — slat text
 * @returns {any[]} one entry per top-level form
 */
export function slatLoadsAll(src) {
  const lines = src.split('\n').map((l) => l.trim()).filter((l) => l && !l.startsWith(';'))
  const out = []
  for (const line of lines) {
    const tokens = tokenize(line)
    // Every form on the line, not just the first. This used to parse one
    // datum and discard the rest of the token stream without a word, so
    // `(a 1) (b 2)` silently became `(a 1)` — input that read as valid and
    // lost half its content. Trailing forms now surface as extra values,
    // which is the same rule multi-LINE input already followed.
    let idx = 0
    while (idx < tokens.length) {
      const [value, next] = parseFrom(tokens, idx)
      out.push(value)
      if (next <= idx) throw new Error('slat parser made no progress')
      idx = next
    }
  }
  return out
}

// ─────────────────────────────────────────────────────────────────────
// Writer
// ─────────────────────────────────────────────────────────────────────

function emit(v) {
  if (v === null) return 'nil'
  if (v === undefined) return 'nil'
  if (v === true) return '#t'
  if (v === false) return '#f'
  if (typeof v === 'number') return Number.isInteger(v) ? String(v) : String(v)
  // An exact integer is a bigint here. The tokenizer has always READ
  // arbitrary integers, so refusing to write one made the writer and the
  // reader disagree about the format.
  if (typeof v === 'bigint') return String(v)
  if (typeof v === 'string') return emitString(v)
  if (v instanceof SlatValue) {
    if (v.kind === 'symbol') return emitBareName('symbol', v.value)
    if (v.kind === 'keyword') return ':' + emitBareName('keyword', v.value)
    if (v.kind === 'rational') return String(v.value)
    if (v.kind === 'char') return `#\\${v.value}`
  }
  if (Array.isArray(v)) return '(' + v.map(emit).join(' ') + ')'
  if (typeof v === 'object') return emitForm(v)
  throw new TypeError(`cannot emit ${typeof v}`)
}

// Slat has no escape syntax for symbols, so a name holding a delimiter
// cannot be written down at all. Emitting it anyway produced text the
// reader could not read back, and the corruption was silent and shape-
// changing: the one-symbol list holding `a b` came out as `(a b)`, which
// reads back as TWO symbols. Refusing is the only honest answer available
// without inventing grammar the format does not have.
function emitBareName(kind, name) {
  const s = String(name)
  if (s === '') throw new TypeError(`cannot emit an empty ${kind} name`)
  const bad = s.match(ATOM_END)
  if (bad) {
    throw new TypeError(
      `cannot emit ${kind} ${JSON.stringify(s)}: `
      + `slat has no escape for ${JSON.stringify(bad[0])} in a name`)
  }
  // The keyword scanner only recognises `:` followed by a letter or
  // underscore; anything else reads back as a plain symbol, not a keyword.
  if (kind === 'keyword' && !/^[A-Za-z_]/.test(s)) {
    throw new TypeError(`cannot emit keyword ${JSON.stringify(s)}: a keyword name must start with a letter or underscore`)
  }
  return s
}

function emitString(s) {
  const escaped = s
    .replace(/\\/g, '\\\\')
    .replace(/"/g, '\\"')
    .replace(/\n/g, '\\n')
    .replace(/\r/g, '\\r')
    .replace(/\t/g, '\\t')
  return `"${escaped}"`
}

const _KEY_ORDER_HINTS = ['_form', 'id', 'ts', 'kind', 'from', 'to']

function orderKeys(obj) {
  const keys = Object.keys(obj).filter((k) => k !== '_form' && k !== '_positional')
  const hinted = _KEY_ORDER_HINTS.filter((k) => k in obj && k !== '_form')
  const rest = keys.filter((k) => !hinted.includes(k)).sort()
  return [...hinted, ...rest]
}

function emitForm(d) {
  if (!d._form) {
    // bare dict without form head — emit as a keyword-tagged list.
    const parts = []
    for (const k of Object.keys(d).sort()) {
      parts.push(`:${k}`, emit(d[k]))
    }
    return '(' + parts.join(' ') + ')'
  }
  const parts = [String(d._form)]
  for (const p of d._positional || []) parts.push(emit(p))
  for (const k of orderKeys(d)) parts.push(`:${k}`, emit(d[k]))
  return '(' + parts.join(' ') + ')'
}

/**
 * Serialize one JS value to a slat line (no trailing newline).
 */
export function slatDumps(obj) {
  return emit(obj)
}

/**
 * Convert slat text (one form per line) to JSONL text.
 */
export function slatToJsonl(text) {
  const lines = text.split('\n').map((l) => l.trim()).filter((l) => l && !l.startsWith(';'))
  return lines.map((line) => JSON.stringify(replacer(slatLoads(line)))).join('\n') + '\n'
}

/**
 * Convert JSONL text to slat text.
 */
export function jsonlToSlat(text) {
  const lines = text.split('\n').filter((l) => l.trim())
  return lines.map((line) => slatDumps(reviver(JSON.parse(line)))).join('\n') + '\n'
}

// JSON tagged sentinels: SlatValue → {"_type": "symbol", "value": "..."}
function replacer(v) {
  if (v instanceof SlatValue) return { _type: v.kind, value: v.value }
  if (Array.isArray(v)) return v.map(replacer)
  if (v && typeof v === 'object') {
    const out = {}
    for (const [k, val] of Object.entries(v)) out[k] = replacer(val)
    return out
  }
  return v
}

function reviver(v) {
  if (v && typeof v === 'object' && !Array.isArray(v) && v._type && 'value' in v) {
    return new SlatValue(v._type, v.value)
  }
  if (Array.isArray(v)) return v.map(reviver)
  if (v && typeof v === 'object') {
    const out = {}
    for (const [k, val] of Object.entries(v)) out[k] = reviver(val)
    return out
  }
  return v
}
