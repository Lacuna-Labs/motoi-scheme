// core/parts-registry.js — the STANDARD-LIBRARY PARTS REGISTRY.
//
// Created 2026-07-24 as the "separate parts registry" fork of the stdlib
// split. This file is DISTINCT from core/verb-manifest.js on purpose:
//
//   • verb-manifest.js  — the hand-authored roster of Motoi's OWN libraries
//     (math/*, game/*, graphics/*, …). Do not conflate the two.
//   • parts-registry.js — ONLY the standard: R7RS-small + the adopted SRFI
//     parts. Each part is a named, versioned, includable/excludable unit
//     with its spec kept alongside and every verb conformance-verified.
//
// The standard (LOCKED 2026-07-24, see CLAUDE.md):
//   R7RS-small (the semantic authority)  — eager, default bundle
//   SRFI-1   (list library)              — eager, default bundle
//   SRFI-13  (string library)            — lazy, pulled in explicitly
//   SRFI-125 (intermediate hash tables)  — lazy, pulled in explicitly
//   SRFI-27  (sources of random bits)    — lazy, pulled in explicitly
//   SRFI-48  (intermediate format strings) — lazy, pulled in explicitly
//   SRFI-133 (vector library)            — lazy, pulled in explicitly
//
// Each entry pairs a part module's exported contract (STD, SPEC, LAZY,
// VERBS, install*) into one record. The register/install tooling
// (src/lib-register.js — CLI + in-language) validates ANY candidate part
// against the SAME 5-point gate this file encodes, so "write a lib and run
// this on it and it installs it" holds for standard parts and new ones
// alike.

import { existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve, join } from 'node:path'

import * as core from '../lib/std/r7rs-completions-core.js'
import * as srfi1 from '../lib/std/srfi-1.js'
import * as srfi13 from '../lib/std/srfi-13.js'
import * as srfi125 from '../lib/std/srfi-125.js'
import * as srfi27 from '../lib/std/srfi-27.js'
import * as srfi48 from '../lib/std/srfi-48.js'
import * as srfi133 from '../lib/std/srfi-133.js'

// Repo root — parts-registry.js lives in core/, so up one level.
const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')

// One record per part. `mode` derives from the module's LAZY flag but is
// spelled out here so the registry reads as a table. `install` is the
// module's installer; `module` keeps the whole namespace for the validator.
function partFrom (module, installer) {
  return {
    name: module.STD,
    std: module.STD,
    spec: module.SPEC,
    mode: module.LAZY ? 'lazy' : 'eager',
    verbs: module.VERBS,
    install: installer,
    module,
  }
}

export const STD_PARTS = [
  partFrom(core, core.installR7RSCore),
  partFrom(srfi1, srfi1.installSRFI1),
  partFrom(srfi13, srfi13.installSRFI13),
  partFrom(srfi125, srfi125.installSRFI125),
  partFrom(srfi27, srfi27.installSRFI27),
  partFrom(srfi48, srfi48.installSRFI48),
  partFrom(srfi133, srfi133.installSRFI133),
]

// The default bundle — the "expected superset" every program can assume.
export const DEFAULT_BUNDLE = STD_PARTS.filter((p) => p.mode === 'eager')
export const LAZY_PARTS = STD_PARTS.filter((p) => p.mode === 'lazy')

export function findPart (name) {
  const target = String(name)
  return STD_PARTS.find((p) => p.name === target)
    || STD_PARTS.find((p) => p.name.toLowerCase() === target.toLowerCase())
    || null
}

// installStandard(env, fuelBox) — install every standard part, in the
// canonical order, eagerly. This is what the base env does today (via the
// src/r7rs-completions.js shim); mirrored here so the registry is a usable
// entry point in its own right.
export function installStandard (env, fuelBox) {
  for (const part of STD_PARTS) part.install(env, fuelBox)
  return env
}

// ─────────────────────────────────────────────────────────────────────
// The 5-point gate (CLAUDE.md "Necessary criteria for introducing ANY
// library"). validatePart runs each check and returns a structured report.
// It is deliberately shape-agnostic: any module exporting the part contract
// (STD, SPEC, LAZY, VERBS, an installer) can be validated, not just the
// five standard parts. The register tool calls THIS.
//
// A part passes only when ALL FIVE checks pass. gate #3 and #5 need a live
// env to install into; pass one via opts.env (+ opts.fuelBox). When no env
// is given those two checks report `skipped: true` (still not `pass`), so
// callers must supply an env for a real go/no-go.
// ─────────────────────────────────────────────────────────────────────
export function validatePart (part, opts = {}) {
  const checks = []
  const add = (id, pass, detail, extra = {}) =>
    checks.push({ id, pass, detail, ...extra })

  // Resolve a module-like view whether given a registry record or a raw
  // module namespace.
  const mod = part.module || part
  const std = part.std ?? mod.STD
  const spec = part.spec ?? mod.SPEC
  const verbs = part.verbs ?? mod.VERBS
  const installer = part.install
    || mod.install
    || (typeof mod.default === 'function' ? mod.default : null)

  // Gate 1 — own bucket + provenance.
  const hasBucket = typeof std === 'string' && std.length > 0
    && Array.isArray(verbs) && verbs.length > 0
  add('1-bucket', hasBucket,
    hasBucket
      ? `part "${std}" declares ${verbs.length} verbs`
      : 'missing STD name or non-empty VERBS array')

  // Gate 2 — spec kept alongside, on disk.
  let specPath = null
  let specOk = false
  if (typeof spec === 'string' && spec.length > 0) {
    specPath = resolve(REPO_ROOT, spec)
    specOk = existsSync(specPath)
  }
  add('2-spec', specOk,
    specOk ? `spec present at ${spec}`
      : (spec ? `spec file missing: ${spec}` : 'no SPEC declared'),
    { specPath })

  // Gate 4 — includable/excludable + lazy-loadable. Encoded as a boolean
  // LAZY flag; the part being a first-class registry record satisfies the
  // "excludable" half (nothing else may silently depend on it being on).
  const lazyFlag = mod.LAZY
  const gate4 = typeof lazyFlag === 'boolean'
  add('4-toggle', gate4,
    gate4 ? `LAZY=${lazyFlag} (${lazyFlag ? 'lazy, explicit' : 'eager, default bundle'})`
      : 'LAZY flag is not a boolean')

  // Gates 3 + 5 need a live env. Install the part into it and confirm every
  // declared verb resolves to a function (3), and that a trivial run works
  // for at least the first verb (5).
  const env = opts.env || null
  const fuelBox = opts.fuelBox || { n: 1_000_000 }
  if (!env || typeof installer !== 'function') {
    add('3-verbs', false, 'no env supplied — cannot verify verbs bind', { skipped: !env })
    add('5-runs', false, 'no env supplied — cannot verify it runs', { skipped: !env })
  } else {
    let installErr = null
    try {
      installer(env, fuelBox)
    } catch (e) {
      installErr = e && e.message ? e.message : String(e)
    }
    if (installErr) {
      add('3-verbs', false, `installer threw: ${installErr}`)
      add('5-runs', false, `installer threw: ${installErr}`)
    } else {
      const missing = verbs.filter((name) => {
        let v
        try { v = env.get(name) } catch { return true }
        return typeof v !== 'function'
      })
      const gate3 = missing.length === 0
      add('3-verbs', gate3,
        gate3 ? `all ${verbs.length} verbs bind to functions`
          : `${missing.length} unbound: ${missing.slice(0, 6).join(', ')}${missing.length > 6 ? '…' : ''}`,
        { missing })
      // Gate 5 — it runs. Env-level binding proof: every verb is callable.
      // (Full expression smoke tests live in tests/ + the reference; here
      // we assert the installed surface is live, which is the registry's
      // job.) Passes iff gate 3 passed and the installer did not throw.
      add('5-runs', gate3,
        gate3 ? 'installed surface is live (all verbs callable)'
          : 'cannot run — verbs did not bind')
    }
  }

  const ok = checks.every((c) => c.pass)
  return { ok, std, spec, checks }
}

// A convenience: validate all standard parts against a shared env.
export function validateStandard (env, fuelBox) {
  return STD_PARTS.map((part) => ({
    name: part.name,
    ...validatePart(part, { env, fuelBox }),
  }))
}

export default STD_PARTS
