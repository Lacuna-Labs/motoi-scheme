// alist.js — THE FLOOR VERBS' SCHEME VALUES AS JS (lane CL-UX Part A / F5-H; A8-SCENE-SCHEME §3). Owns: reading what a
// cart passes the twelve floor verbs (a symbol, a Pair list, an alist of pairs or two-element lists, a plain object) as
// JS values, and writing a JS object back as an alist of symbols. Split from verbs.js (finale order §3.16 unit 4),
// which reads its arguments through these, as the eval floor's replay does. Refuses: nothing: a key that is not there
// reads undefined and a value that is not a list reads empty, never a guess. Implements: A8-SCENE-SCHEME §3 (the verbs'
// argument shapes). Invariants (design §18): none of its own. Faults (§16): none.
import { Sym, sym, Pair } from '../../../lacuna-scheme/src/reader.js'

/** A symbol's name, an object's `name`, or the value itself. */
export const atom = (x) => (x instanceof Sym ? x.name : x && typeof x === 'object' && !Array.isArray(x) && 'name' in x ? x.name : x)

/** Converts a Scheme alist / Pair list / plain object into a JS object. */
export function alistToObj(list) {
  if (!list || list === false) return {}
  if (!Array.isArray(list) && !(list instanceof Pair) && typeof list === 'object') return { ...list }
  const arr = list instanceof Pair ? pairToArray(list) : Array.isArray(list) ? list : []
  const out = {}
  for (const item of arr) {
    if (item instanceof Pair) {
      const k = String(atom(item.car))
      const cdr = item.cdr
      out[k] = cdr instanceof Pair ? pairToArray(cdr).map(atom) : atom(cdr)
    } else if (Array.isArray(item) && item.length >= 2) {
      const k = String(atom(item[0]))
      out[k] = item.length === 2 ? atom(item[1]) : item.slice(1).map(atom)
    }
  }
  return out
}

/** A Pair list as an array; an improper tail is its last item. */
export function pairToArray(p) {
  const out = []
  let cur = p
  while (cur instanceof Pair) {
    out.push(cur.car)
    cur = cur.cdr
  }
  if (cur !== null && cur !== undefined && !(Array.isArray(cur) && cur.length === 0)) out.push(cur)
  return out
}

/** Converts a JS map/object to a Scheme alist `[[Sym(k), v], ...]`. */
export function objToAlist(obj) {
  return Object.entries(obj).map(([k, v]) => [sym(k), v])
}

/** Lookup helper for Scheme alists or JS objects. */
export function getField(alistOrObj, key) {
  if (!alistOrObj) return undefined
  if (Array.isArray(alistOrObj)) {
    for (const pair of alistOrObj) {
      if (Array.isArray(pair) && pair.length >= 2 && String(atom(pair[0])) === key) return pair[1]
      if (pair instanceof Pair && String(atom(pair.car)) === key) return pair.cdr instanceof Pair && pair.cdr.cdr === null ? pair.cdr.car : pair.cdr
    }
    return undefined
  }
  return alistOrObj[key]
}
