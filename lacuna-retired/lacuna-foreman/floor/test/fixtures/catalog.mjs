// catalog.mjs — THE CATALOG, AS THE FOLD'S TESTS READ IT (lane F5-BC test fixture; since 2026-11-01 F5-A's catalog). Owns:
// the catalog of `lacuna-foreman/floor/kinds.slat` (through validate.js's `kinds()`) as a Map in the shape these tests were
// written to, and validating one event against it: the kind exists, every data key is one of its fields, `at` and `ref` are
// present where mandatory. Refuses: a guess at a kind; a second reader. F5-BC's local copy of the catalog is retired: F5-A's
// lands as the one catalog (RULINGS §1(a)).
import { kinds } from '../../validate.js'

/**
 * The catalog: kind name → {family, record, fields: Set, at, ref}.
 * @return {!Map<string, !Object>}
 */
export function readCatalog() {
  const out = new Map()
  for (const [name, k] of kinds()) out.set(name, { name, family: k.family, record: k.record, fields: new Set(k.fields.keys()), at: k.at, ref: k.ref })
  return out
}

/**
 * Validates one event against the catalog.
 * @param {!Map<string, !Object>} catalog @param {!Object} ev
 * @return {{ok: boolean, why: ?string}}
 */
export function validate(catalog, ev) {
  const k = catalog.get(ev.kind)
  if (!k) return { ok: false, why: `unknown kind ${ev.kind}` }
  for (const key of Object.keys(ev.data || {})) if (!k.fields.has(key)) return { ok: false, why: `${ev.kind}: field ${key} is not in the catalog` }
  if (k.at && (!ev.at || ev.at === '-')) return { ok: false, why: `${ev.kind}: at is mandatory` }
  if (k.ref && ev.ref == null) return { ok: false, why: `${ev.kind}: ref is mandatory` }
  if (!/^[a-z0-9][a-z0-9:._#-]*$/.test(String(ev.actor))) return { ok: false, why: `${ev.kind}: actor id ${ev.actor}` }
  return { ok: true, why: null }
}
