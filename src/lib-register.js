// src/lib-register.js — the register/install mechanism, in the language.
//
// Created 2026-07-24. One validator, two front doors:
//
//   • CLI          — `motoi lib register <file.js>` (src/cli.js)
//   • in-language  — `(register-lib "<file.js>")`, `(std-parts)`,
//                    `(lib-info 'SRFI-13)`, `(lib-validate ...)`
//                    (lib/system/lib-tools.js)
//
// Both call validatePart() from core/parts-registry.js — the SAME 5-point
// gate that governs the standard parts. "Write a lib, run this on it, it
// installs it" means: the candidate module must clear all five criteria
// (own bucket + provenance · spec kept alongside · every verb correct ·
// includable/excludable + lazy-loadable · it runs) before a single verb
// lands on the env. A part that fails the gate installs NOTHING.

import { pathToFileURL } from 'node:url'
import { resolve, isAbsolute } from 'node:path'
import {
  STD_PARTS, findPart, validatePart, validateStandard, installStandard,
} from '../core/parts-registry.js'

export { STD_PARTS, findPart, validatePart, validateStandard, installStandard }

// A part module must export the contract. This shapes the "raw module
// namespace" into the record validatePart/installers expect.
function recordFromModule (mod, sourcePath) {
  const installer = typeof mod.default === 'function'
    ? mod.default
    : Object.entries(mod).find(([k, v]) =>
        k.startsWith('install') && typeof v === 'function')?.[1] || null
  return {
    name: mod.STD,
    std: mod.STD,
    spec: mod.SPEC,
    mode: mod.LAZY ? 'lazy' : 'eager',
    verbs: mod.VERBS,
    install: installer,
    module: mod,
    source: sourcePath,
  }
}

// registerLib(filePath, { env, fuelBox, install }) — the workhorse.
//   1. Dynamically import the candidate module.
//   2. Validate it against the 5-point gate (needs env for gates 3 + 5).
//   3. If ok AND opts.install !== false, the installer has ALREADY run
//      (validatePart installs into env to prove gates 3 + 5). So a passing
//      validation leaves the verbs live on env. On failure, we do not
//      re-install; the throwaway state stays as-is (caller should pass a
//      scratch env if they want atomicity).
//
// Returns { ok, source, std, report } — report is the validatePart result.
export async function registerLib (filePath, opts = {}) {
  const abs = isAbsolute(filePath) ? filePath : resolve(process.cwd(), filePath)
  let mod
  try {
    mod = await import(pathToFileURL(abs).href)
  } catch (e) {
    return {
      ok: false, source: filePath, std: null,
      report: { ok: false, checks: [{ id: '0-import', pass: false, detail: `import failed: ${e.message}` }] },
    }
  }
  const record = recordFromModule(mod, abs)
  const report = validatePart(record, { env: opts.env, fuelBox: opts.fuelBox })
  return { ok: report.ok, source: filePath, std: record.std, report, record }
}

// libInfo(name) — metadata for a standard part (or null).
export function libInfo (name) {
  const part = findPart(name)
  if (!part) return null
  return {
    name: part.name,
    std: part.std,
    spec: part.spec,
    mode: part.mode,
    verbs: part.verbs.slice(),
    count: part.verbs.length,
  }
}

// stdParts() — the registry as a plain list, for `(std-parts)` and
// `motoi lib list`.
export function stdParts () {
  return STD_PARTS.map((p) => ({
    name: p.name,
    std: p.std,
    spec: p.spec,
    mode: p.mode,
    count: p.verbs.length,
  }))
}
