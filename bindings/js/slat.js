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

function tokenize(src) {
  const tokens = []
  let i = 0
  const n = src.length
  while (i < n) {
    const c = src[i]
    if (c === ' ' || c === '\t') { i++; continue }
    if (c === '\n' || c === '\r') throw new Error('newline inside form (slat lines are single-line)')
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
      while (j < n && !/[\s()"';]/.test(src[j])) j++
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
    while (j < n && !/[\s()"';]/.test(src[j])) j++
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
  const lines = src.split('\n').map((l) => l.trim()).filter((l) => l && !l.startsWith(';'))
  const out = []
  for (const line of lines) {
    const tokens = tokenize(line)
    const [value] = parseFrom(tokens, 0)
    out.push(value)
  }
  return out.length === 1 ? out[0] : out
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
  if (typeof v === 'string') return emitString(v)
  if (v instanceof SlatValue) {
    if (v.kind === 'symbol') return String(v.value)
    if (v.kind === 'keyword') return `:${v.value}`
    if (v.kind === 'rational') return String(v.value)
    if (v.kind === 'char') return `#\\${v.value}`
  }
  if (Array.isArray(v)) return '(' + v.map(emit).join(' ') + ')'
  if (typeof v === 'object') return emitForm(v)
  throw new TypeError(`cannot emit ${typeof v}`)
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
