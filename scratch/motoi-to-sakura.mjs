#!/usr/bin/env node
// motoi-to-sakura — the copy-in tool for the Motoi→Sakura anchor flip.
//
// This promotes Motoi's superset engine BODY onto the canonical
// sakura-scheme repo (Sakura is the parent Motoi forked from on 2026-07-16;
// this is a homecoming, not a fork). It is deterministic and reviewable:
// it copies a fixed manifest of engine files + dirs, PRESERVES Sakura's
// skin (name, bin, dialect layer, render-adapter seam), and stamps the
// dialect identity via --dialect.
//
// It never touches git history (the working tree only). Motoi's own
// history is preserved by tag + CHANGELOG reference, per the plan.
//
// Usage:
//   node motoi-to-sakura.mjs --dest ~/code/sakura-scheme --dialect Sakura [--apply]
//
// Default is a DRY RUN (prints the plan). Pass --apply to write.
//
// Manifest rationale (derived 2026-07-27):
//   • Motoi's src/ core engine files are supersets of Sakura's (reader,
//     interp, base, macro, dispatch, verbRegistry, introspect, slat,
//     slat-verbs, repl, cli, docs-emitter, lib-loader) + Motoi-only
//     support files (paths, lib-register, ide-server, r7rs-completions).
//   • Motoi's dispatch.js is already HERMETIC (no-op sinks +
//     installDispatchHooks) — adopting it resolves the Curator-coupling
//     debt Sakura's CLAUDE.md flags.
//   • Engine closure needs top-level core/ lib/ bindings/js/ tui/ (+ the
//     loadable modules/). These do NOT exist in Sakura → purely additive.
//   • Sakura's src/lib/ (dialect, marionette, ...) lives at a DIFFERENT
//     path than Motoi's top-level lib/ → they coexist; skin preserved.
//   • src/index.js and package.json are NOT copied — they are hand-merged
//     (Sakura keeps its name + skin exports; adopts Motoi's engine
//     exports + CORE partition + hermetic dispatch). The tool writes a
//     merge REPORT so the hand-merge is mechanical.

import { promises as fs } from 'node:fs'
import { existsSync } from 'node:fs'
import path from 'node:path'
import os from 'node:os'

const SRC_DEFAULT = path.join(os.homedir(), 'code/motoi-scheme')

function parseArgs (argv) {
  const a = { src: SRC_DEFAULT, dest: null, dialect: 'Sakura', apply: false }
  for (let i = 0; i < argv.length; i++) {
    const t = argv[i]
    if (t === '--src') a.src = expand(argv[++i])
    else if (t === '--dest') a.dest = expand(argv[++i])
    else if (t === '--dialect') a.dialect = argv[++i]
    else if (t === '--apply') a.apply = true
    else throw new Error(`unknown arg: ${t}`)
  }
  if (!a.dest) throw new Error('--dest is required')
  return a
}
function expand (p) {
  if (!p) return p
  return p.startsWith('~') ? path.join(os.homedir(), p.slice(1)) : path.resolve(p)
}

// ---- The manifest -----------------------------------------------------

// src/ engine files copied verbatim (overwrite Sakura's drifted copies).
const SRC_ENGINE_FILES = [
  'reader.js', 'interp.js', 'base.js', 'macro.js', 'dispatch.js',
  'verbRegistry.js', 'introspect.js', 'slat.js', 'slat-verbs.js',
  'repl.js', 'cli.js', 'docs-emitter.js', 'lib-loader.js',
  // Motoi-only support files:
  'paths.js', 'lib-register.js', 'ide-server.js', 'r7rs-completions.js',
]

// Top-level engine dirs brought in whole (additive — absent in Sakura,
// except bindings/ which is reconciled file-by-file below).
const TOP_DIRS = [
  'core', 'lib', 'modules', 'tui', 'rosetta', 'adapters', 'spec',
]

// bindings/js is the only overlapping engine dir. Bring Motoi's JS binding
// (slat.js) which the engine imports; leave any Python binding as-is.
const BINDINGS_FILES = ['js/slat.js']

// NEVER overwrite these dest paths — Sakura's skin.
const SKIN_PRESERVE = [
  'src/index.js',            // hand-merged
  'src/lib',                 // dialect + marionette surfaces
  'src/adapters',            // render-adapter seam (setAdapters/getAdapters)
  'package.json',            // name + version + bin (hand-merged)
  'LICENSE',                 // license decision is Alfred's
  'bin/sakura-scheme',       // Sakura's bin entry
]

// ---- Copy helpers -----------------------------------------------------

async function copyFile (from, to, plan) {
  plan.files.push([from, to])
  if (!plan.apply) return
  await fs.mkdir(path.dirname(to), { recursive: true })
  await fs.copyFile(from, to)
}
async function copyDir (from, to, plan) {
  const entries = await fs.readdir(from, { withFileTypes: true })
  for (const e of entries) {
    const f = path.join(from, e.name)
    const t = path.join(to, e.name)
    if (e.isDirectory()) await copyDir(f, t, plan)
    else if (e.isFile()) await copyFile(f, t, plan)
  }
}

// ---- Dialect stamp ----------------------------------------------------

function dialectSlat (dialectName) {
  const slug = dialectName.toLowerCase()
  return `;; dialect.slat — ${dialectName} Scheme's dialect declaration.
;;
;; Authored by motoi-to-sakura --dialect ${dialectName} on the anchor flip.
;; ${dialectName} is a dialect of Motoi (its :parent). The schema lives in
;; the base Motoi dialect.slat; this file computes ${dialectName}'s delta.
;;
;; At this stage the delta is empty-additive: ${dialectName} adopts the
;; whole Motoi base library unchanged and ADDS its three verb surfaces
;; (Marionette, the ${dialectName} dialect layer, Curator-live) via
;; installers. refuses/modifies get populated in Stage 3 (wire-up), when
;; the collision policy (dialect-wins, environment-selected) is applied.

(dialect
  :name          "${slug}"
  :display-name  "${dialectName} Scheme"
  :version       "1.5.0"
  :parent        "motoi"
  :governance    "Lacuna-Labs stewardship; consumers subscribe by SemVer pin"
  :repo          "git@github.com:Lacuna-Labs/sakura-scheme.git"
  :license       "MIT")

;; --- The 4 dialect operations (see base motoi dialect.slat for schema) ---

(refuses)     ; none yet — Stage 3 populates per collision policy
(modifies)    ; none yet — Stage 3 populates per collision policy
(adopts
  :note "The entire Motoi base library, unchanged."
  :source-of-truth "parent: motoi")
(adds
  :note "${dialectName}'s three verb surfaces, installed on the merged engine."
  :surfaces ("marionette" "${slug}-dialect" "curator-live"))

(schema-version "1.0.0")
(schema-date    "2026-07-27")
(schema-notes
  "Anchor-flip stamp. refuses/modifies stay empty until Stage 3 wire-up"
  "applies the environment-selected, dialect-wins collision policy.")
`
}

// ---- Main -------------------------------------------------------------

async function main () {
  const args = parseArgs(process.argv.slice(2))
  const { src, dest, dialect, apply } = args
  if (!existsSync(src)) throw new Error(`src not found: ${src}`)
  if (!existsSync(dest)) throw new Error(`dest not found: ${dest}`)

  const plan = { apply, files: [], dirs: [], stamps: [] }

  // 1. src/ engine files
  for (const f of SRC_ENGINE_FILES) {
    const from = path.join(src, 'src', f)
    if (existsSync(from)) await copyFile(from, path.join(dest, 'src', f), plan)
  }
  // 2. top-level engine dirs
  for (const d of TOP_DIRS) {
    const from = path.join(src, d)
    if (existsSync(from)) { plan.dirs.push(d); await copyDir(from, path.join(dest, d), plan) }
  }
  // 3. bindings/js
  for (const f of BINDINGS_FILES) {
    const from = path.join(src, 'bindings', f)
    if (existsSync(from)) await copyFile(from, path.join(dest, 'bindings', f), plan)
  }
  // 4. dialect stamp
  const slatPath = path.join(dest, 'rosetta', 'dialect.slat')
  plan.stamps.push(slatPath)
  if (apply) {
    await fs.mkdir(path.dirname(slatPath), { recursive: true })
    await fs.writeFile(slatPath, dialectSlat(dialect))
  }

  // ---- Report ----
  console.log(`motoi-to-sakura ${apply ? '(APPLY)' : '(DRY RUN)'}`)
  console.log(`  src:     ${src}`)
  console.log(`  dest:    ${dest}`)
  console.log(`  dialect: ${dialect}`)
  console.log(`  files copied:  ${plan.files.length}`)
  console.log(`  top dirs:      ${plan.dirs.join(', ')}`)
  console.log(`  dialect stamp: ${path.relative(dest, slatPath)}`)
  console.log(`\n  SKIN PRESERVED (never touched): ${SKIN_PRESERVE.join(', ')}`)
  console.log(`\n  HAND-MERGE STILL REQUIRED:`)
  console.log(`    • src/index.js  — add Motoi engine exports (makeCoreEnv,`)
  console.log(`      installCore, CORE_VERBS, dispatchScheme + hooks) while`)
  console.log(`      keeping Sakura's skin exports (installSakuraDialect*,`)
  console.log(`      setAdapters/getAdapters, resetMediaState); VERSION=1.5.0.`)
  console.log(`    • package.json  — keep name sakura-scheme; version 1.5.0;`)
  console.log(`      add "motoi" bin alias; adopt Motoi exports map; keep`)
  console.log(`      vitest test script (gate: Sakura's 654 tests).`)
  if (!apply) console.log(`\n  (dry run — pass --apply to write)`)
}

main().catch((e) => { console.error('ERROR:', e.message); process.exit(1) })
