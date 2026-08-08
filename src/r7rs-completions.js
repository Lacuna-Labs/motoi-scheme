// r7rs-completions.js — DELEGATING SHIM (post-split 2026-07-24).
//
// The standard library was relocated out of this monolith into per-part
// libs under lib/std/ (full-relocation, per Alfred 2026-07-24). Each part
// now owns its bucket, its spec, its provenance, and its metadata:
//
//   lib/std/r7rs-completions-core.js  — R7RS-small (§6.x completions)  EAGER
//   lib/std/srfi-1.js                 — SRFI-1  list library            EAGER
//   lib/std/srfi-13.js                — SRFI-13 string library          lazy
//   lib/std/srfi-125.js               — SRFI-125 hash tables            lazy
//   lib/std/srfi-27.js                — SRFI-27 random                  lazy
//   lib/std/srfi-133.js               — SRFI-133 vector library          lazy
//   lib/std/_shared.js                — shared runtime helpers (records,
//                                        hash table, ports, errors, write).
//
// This file stays because `src/base.js` imports `installR7RSCompletions`
// from it (the ONLY cross-file importer — verified 2026-07-24). To keep
// behavior BYTE-IDENTICAL to the pre-split monolith, the shim installs all
// five parts EAGERLY in the original order. The LAZY flags on SRFI-13/125/27
// describe default-BUNDLE membership for the parts registry + loader; they
// do not change what base.js wires today (nothing may silently lose a verb
// that reference programs and carts already depend on).
//
// The pre-split monolith is archived verbatim at
//   src/_archive/r7rs-completions.pre-split-20260724.js
// (No deletes — CLAUDE.md.)
//
// Helper classes/functions (records, HashTable, ports, EOF, SchemeError,
// bytevector predicate) are re-exported from lib/std/_shared.js so any
// legacy `import { ... } from './r7rs-completions.js'` keeps resolving.

import { installR7RSCore } from '../lib/std/r7rs-completions-core.js'
import { installSRFI1 } from '../lib/std/srfi-1.js'
import { installSRFI13 } from '../lib/std/srfi-13.js'
import { installSRFI125 } from '../lib/std/srfi-125.js'
import { installSRFI27 } from '../lib/std/srfi-27.js'
import { installSRFI48 } from '../lib/std/srfi-48.js'
import { installSRFI133 } from '../lib/std/srfi-133.js'

// Re-export shared helpers for any legacy importer of this module.
export {
  makeRecordType, isRecord, makeRecord, isHashTable, EOF, isBytevector,
  SchemeError,
} from '../lib/std/_shared.js'

// installR7RSCompletions(env, fuelBox) — the historical entry point, called
// from makeBaseEnv AFTER the base primitives are wired. Delegates to the
// per-part installers in the original monolith order.
export function installR7RSCompletions (env, fuelBox) {
  installR7RSCore(env, fuelBox)
  installSRFI1(env, fuelBox)
  installSRFI13(env, fuelBox)
  installSRFI125(env, fuelBox)
  installSRFI27(env, fuelBox)
  // SRFI-48 binds `format`, a name R7RS-small does not define, so it shadows
  // nothing. Its directives render by calling `display`/`write` at CALL time,
  // so install order does not constrain it.
  installSRFI48(env, fuelBox)
  // SRFI-133 installs LAST so it can never shadow an R7RS-small vector verb;
  // it binds only names R7RS-small does not have.
  installSRFI133(env, fuelBox)
  return env
}

export default installR7RSCompletions
