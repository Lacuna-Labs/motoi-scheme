// paths.js — where Motoi's install and user data live.
//
// One layout, Mac + Linux identical:
//   ~/.motoi/   install (git checkout, safe to nuke on re-install)
//   ~/motoi/    user saves (carts, cortex, reading state, artifacts)
//
// Same on both platforms. Undotted so it shows up in `ls ~`, in Finder, in
// file managers — the kid opens home, sees "motoi/", knows their stuff is real.

import { homedir } from 'node:os'
import { join } from 'node:path'
import { existsSync, mkdirSync, renameSync, readdirSync, statSync } from 'node:fs'

export function motoiInstallDir() { return join(homedir(), '.motoi') }
export function motoiUserDir()    { return join(homedir(), 'motoi') }

export function userCartsDir()      { return join(motoiUserDir(), 'carts') }
export function userSavesDir()      { return join(motoiUserDir(), 'saves') }
export function userArtifactsDir()  { return join(motoiUserDir(), 'artifacts') }
export function userCortexPath()    { return join(motoiUserDir(), 'cortex.slat') }
export function userReadingPath()   { return join(motoiUserDir(), 'reading-state.slat') }

export function ensureDir(dir) {
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
  return dir
}

// One-time migration: move any legacy files from ~/.motoi/{cortex.slat,
// reading-state.slat, artifacts/, carts/} into ~/motoi/. Skips files that
// already exist at the new location (never overwrites user work). Idempotent.
// Returns a list of {from, to} pairs actually moved.
export function migrateLegacyMotoiData() {
  const legacy = motoiInstallDir()
  const dest = motoiUserDir()
  const moved = []

  const moveFile = (legacyPath, newPath) => {
    if (!existsSync(legacyPath)) return
    if (existsSync(newPath)) return  // never clobber
    ensureDir(dest)
    renameSync(legacyPath, newPath)
    moved.push({ from: legacyPath, to: newPath })
  }

  const moveDirContents = (legacyPath, newPath) => {
    if (!existsSync(legacyPath) || !statSync(legacyPath).isDirectory()) return
    ensureDir(newPath)
    for (const name of readdirSync(legacyPath)) {
      const src = join(legacyPath, name)
      const dst = join(newPath, name)
      if (existsSync(dst)) continue  // never clobber
      renameSync(src, dst)
      moved.push({ from: src, to: dst })
    }
  }

  moveFile(join(legacy, 'cortex.slat'),        userCortexPath())
  moveFile(join(legacy, 'reading-state.slat'), userReadingPath())
  moveDirContents(join(legacy, 'artifacts'),   userArtifactsDir())
  moveDirContents(join(legacy, 'carts'),       userCartsDir())

  return moved
}
