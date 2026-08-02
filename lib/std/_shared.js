// lib/std/_shared.js — runtime helpers shared across the standard parts.
//
// Extracted 2026-07-24 from src/r7rs-completions.js as part of the
// full relocation of the standard library into per-part libs
// (R7RS-small + SRFI-1 + SRFI-13 + SRFI-125 + SRFI-27). These classes
// and functions carry no env state; each standard part imports what it
// needs from here so the parts stay physically separate files while
// still agreeing on ONE representation of records, hash tables, ports,
// bytevectors, errors, and the machine-readable write format.
//
// Doctrine: the split must be behavior-identical. Nothing here changed
// from the monolithic version except its home. See
// engineering/STD-PARTS.slat for the part system.

import { Sym, Pair, pairToString } from '../../src/reader.js'
import { SchemeVector } from '../base/r7rs-types.js'

// ── Record types — R7RS §5.5 ────────────────────────────────────────
export const RECORD_TAG = Symbol('motoi:record-type')

export function makeRecordType (typeName, fieldNames) {
  return { name: typeName, fields: fieldNames, [RECORD_TAG]: true }
}

export function isRecord (value, type) {
  return value != null && typeof value === 'object'
    && value.__record_type__ === type
}

export function makeRecord (type, fieldValues) {
  const rec = { __record_type__: type }
  for (let i = 0; i < type.fields.length; i++) {
    rec[type.fields[i]] = fieldValues[i]
  }
  return rec
}

// ── Hash tables — SRFI-125 / R7RS-large ─────────────────────────────
export class HashTable {
  constructor () { this.map = new Map() }
  _key (k) {
    if (k instanceof Sym) return 'sym:' + k.name
    if (typeof k === 'string') return 'str:' + k
    if (typeof k === 'number') return 'num:' + String(k)
    if (typeof k === 'boolean') return 'bool:' + String(k)
    if (Array.isArray(k)) return 'list:' + JSON.stringify(k)
    return 'obj:' + String(k)
  }
  set (k, v) { this.map.set(this._key(k), [k, v]) }
  get (k, dflt) {
    const p = this.map.get(this._key(k))
    return p ? p[1] : dflt
  }
  has (k) { return this.map.has(this._key(k)) }
  delete (k) { return this.map.delete(this._key(k)) }
  keys () { return [...this.map.values()].map((p) => p[0]) }
  values () { return [...this.map.values()].map((p) => p[1]) }
  entries () { return [...this.map.values()].map((p) => [p[0], p[1]]) }
  get size () { return this.map.size }
}

export function isHashTable (v) { return v instanceof HashTable }

// ── String ports — R7RS §6.10.1/6.10.2 ──────────────────────────────
export class StringInputPort {
  constructor (str) { this.str = str; this.pos = 0; this.closed = false; this._kind = 'input' }
  read () {
    if (this.closed || this.pos >= this.str.length) return EOF
    return this.str.charAt(this.pos++)
  }
  peek () {
    if (this.closed || this.pos >= this.str.length) return EOF
    return this.str.charAt(this.pos)
  }
  readAll () {
    if (this.closed) return EOF
    const rest = this.str.slice(this.pos)
    this.pos = this.str.length
    return rest === '' ? EOF : rest
  }
  close () { this.closed = true }
}

export class StringOutputPort {
  constructor () { this.parts = []; this.closed = false; this._kind = 'output' }
  write (s) {
    if (this.closed) throw new Error('write on closed port')
    this.parts.push(String(s))
  }
  getOutput () { return this.parts.join('') }
  close () { this.closed = true }
}

// Carries both tag spellings — see the note on EOF in lib/base/r7rs-types.js.
export const EOF = { __eof__: true, __eof: true }

// ── Bytevectors — R7RS §6.9 ─────────────────────────────────────────
export function isBytevector (v) { return v instanceof Uint8Array }

// ── Error objects — R7RS §6.11 ──────────────────────────────────────
export class SchemeError extends Error {
  constructor (message, irritants) {
    super(String(message))
    this.name = 'SchemeError'
    this.message_ = String(message)
    this.irritants = irritants || []
    this.isSchemeError = true
  }
}

// ── Machine-readable value format for `write` — R7RS §6.10.3 ─────────
export function writeFormat (v) {
  if (v === undefined) return ''
  if (v === null) return '()'
  if (v === true) return '#t'
  if (v === false) return '#f'
  if (typeof v === 'string') return JSON.stringify(v)
  if (typeof v === 'number') return String(v)
  if (v instanceof Sym) return v.name
  if (v instanceof Uint8Array) return '#u8(' + Array.from(v).join(' ') + ')'
  if (v instanceof SchemeVector) return '#(' + v.items.map(writeFormat).join(' ') + ')'
  if (Array.isArray(v)) return '(' + v.map(writeFormat).join(' ') + ')'
  if (v instanceof Pair) return pairToString(v, writeFormat)
  if (v && typeof v === 'object' && v.__eof__) return '#<eof>'
  return String(v)
}

// Shared metadata registrar helper: parts pass their own META table.
import { registerVerbMeta } from '../../src/verbRegistry.js'

export function registerPartMeta (META, { source, since = 'motoi-scheme@0.75', tier = 'base' }) {
  for (const [name, arity, doc, exampleCode, namespace] of META) {
    registerVerbMeta(name, {
      name,
      arity,
      doc,
      examples: exampleCode ? [{ level: 'novice', code: exampleCode }] : [],
      namespace: namespace || null,
      perm: 'read',
      tier,
      source,
      since,
    })
  }
}
