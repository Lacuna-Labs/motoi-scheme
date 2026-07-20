// artifact.js — artifact/save, /cite, /delete per Alfred 2026-07-16.
//
// Doctrine (Alfred, LOCK): perm 'artifact-write' + `~/motoi/artifacts/`.
// Save serializes text/data to disk in the artifact dir. Cite returns
// a citation record for a saved artifact. Delete removes one by name.
// Never throws on missing file — returns #f.

import { Sym } from '../../src/reader.js'
import { writeFileSync, readFileSync, unlinkSync, existsSync, mkdirSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { userArtifactsDir } from '../../src/paths.js'

const nm = (x) => (x instanceof Sym ? x.name : x)

const ARTIFACT_DIR = userArtifactsDir()

function ensureDir() {
  try {
    if (!existsSync(ARTIFACT_DIR)) mkdirSync(ARTIFACT_DIR, { recursive: true })
  } catch { /* soft-fail */ }
}

function safeName(name) {
  // Restrict to safe chars — no directory traversal.
  return String(nm(name) ?? 'untitled').replace(/[^a-zA-Z0-9._-]/g, '_')
}

export function installArtifact(env, fuel) {
  const def = (n, f, perm = 'read') => env.define(n, f, { perm })

  // (artifact/save name content) → path string on success, #f on failure.
  def('artifact/save', (name, content) => {
    try {
      ensureDir()
      const filename = safeName(name)
      const path = join(ARTIFACT_DIR, filename)
      const body = (typeof content === 'string')
        ? content
        : JSON.stringify(content, null, 2)
      writeFileSync(path, body, 'utf8')
      return path
    } catch { return false }
  }, 'artifact-write')

  // (artifact/cite name) → alist ((:name N)(:path P)(:size N)(:mtime N)) or #f.
  def('artifact/cite', (name) => {
    try {
      ensureDir()
      const filename = safeName(name)
      const path = join(ARTIFACT_DIR, filename)
      if (!existsSync(path)) return false
      const st = statSync(path)
      return [
        [new Sym(':name'), filename],
        [new Sym(':path'), path],
        [new Sym(':size'), st.size],
        [new Sym(':mtime'), Math.floor(st.mtimeMs)],
      ]
    } catch { return false }
  }, 'read')

  // (artifact/delete name) → boolean.
  def('artifact/delete', (name) => {
    try {
      ensureDir()
      const filename = safeName(name)
      const path = join(ARTIFACT_DIR, filename)
      if (!existsSync(path)) return false
      unlinkSync(path)
      return true
    } catch { return false }
  }, 'artifact-write')

  return env
}

export default installArtifact
