// tree-logo.js — single source of truth for the Motoi ASCII tree logo.
//
// Doctrine (Alfred, 2026-07-17): "the ASCII tree is the logo now. I know
// you made that possible by accident, but it's there forever."
//
// Zain audit (ZAIN-CROSS-SURFACE-AUDIT.ENG.slat, F1): the tree used to
// live in THREE places — a TODO stub in site/.vitepress/theme/logo.txt,
// a hardcoded copy in lib/composer/tui.js, and a copy-pasted array in
// lib/net/http-serve.js. Consequence: the REPL banner and the browser
// landing page showed DIFFERENT marks. This module consolidates them.
//
// Behavior:
//   - If site/.vitepress/theme/logo.txt exists and is NOT the TODO
//     placeholder, use its contents (Alfred's final art wins).
//   - Otherwise, export the fallback stub — the same 7-row lockup that
//     shipped in tui.js + http-serve.js as an interim. This keeps three
//     surfaces visually identical until Alfred pastes the real tree.
//   - The result is cached at module init; consumers just import
//     TREE_LOGO (string, newline-joined).
//
// When Alfred edits logo.txt, restart the process (REPL / http server /
// TUI caller) picks up the new art everywhere at once. No copy-paste.

import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

// Fallback stub — matches the shape that shipped in tui.js and
// http-serve.js before consolidation. Kept identical so downgrading
// (or a missing logo.txt) doesn't change what surfaces render.
const FALLBACK_TREE_LOGO = [
  '     /\\',
  '    /  \\',
  '   /----\\',
  '  /      \\',
  ' /--------\\',
  '     ||',
  '     ||',
].join('\n')

function loadFromLogoTxt() {
  try {
    const here = dirname(fileURLToPath(import.meta.url))
    // lib/brand/ → repo root is two up.
    const path = join(here, '..', '..', 'site', '.vitepress', 'theme', 'logo.txt')
    const raw = readFileSync(path, 'utf8')
    if (raw.trimStart().startsWith('TODO')) return null
    return raw.replace(/\r\n/g, '\n').replace(/\n+$/, '')
  } catch {
    return null
  }
}

const loaded = loadFromLogoTxt()

// The canonical export. Prefer Alfred's art from logo.txt; fall back to
// the stub if the file is unavailable or still the TODO placeholder.
export const TREE_LOGO = loaded || FALLBACK_TREE_LOGO

// Also expose the fallback for tests / diagnostics that want to check
// which branch the surface is rendering.
export const TREE_LOGO_IS_FALLBACK = loaded == null
export { FALLBACK_TREE_LOGO }
