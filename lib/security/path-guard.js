// path-guard.js — one-source-of-truth path sandbox for every Motoi
// file-touching verb.
//
// Provenance: Alfred lock (2026-07-17) — "carts can't traverse out of
// their own dir, no cross-cart execution outside cart's own tree."
// Mirrors the P-01 (symlink-escape) fix Priya landed in
// lib/net/http-serve.js so every file verb enforces the same rules.
//
// Rules enforced:
//   1. Empty / non-string path → reject.
//   2. Null-byte / literal ".." segment → reject.
//   3. Absolute path outside the caller's ROOT set (cwd + ~/.motoi/ by
//      default; caller may pass extra roots) → reject.
//   4. Relative path that resolves outside every allowed root → reject.
//   5. If the target already exists AND is a symlink → reject (Priya
//      P-01 pattern; symlinks can point at anything).
//   6. If any ANCESTOR of the target is a symlink → reject
//      (realpathSync-of-parent equivalence check).
//
// The helper returns the canonical absolute path on success and throws
// a clear Error on refusal. Callers may pass { softFail: true } to get
// `null` on refusal instead — useful for verbs whose contract already
// returns #f on failure.

import { resolve, normalize, sep, dirname, isAbsolute } from 'node:path'
import { existsSync, lstatSync, realpathSync } from 'node:fs'
import { homedir } from 'node:os'

// The set of roots any file verb may touch by default. Callers can
// override via opts.roots but the defaults cover 95% of cases:
//   - cwd()          : current project (composer carts, scratch)
//   - ~/.motoi/      : cortex.slat + artifacts/ + carts/
//   - repo scheme-books dir (added dynamically when book verbs call in)
function defaultRoots() {
  return [
    process.cwd(),
    resolveHomedir('.motoi'),
  ]
}

function resolveHomedir(sub) {
  return resolve(homedir(), sub)
}

// Normalize a directory so startsWith comparisons don't mis-match on
// prefix collisions (e.g. /home/alice would otherwise match /home/al).
function withTrailingSep(p) {
  return normalize(p + sep)
}

// Is `abs` inside `root` (or equal to it)?
function isUnder(abs, root) {
  const a = normalize(abs)
  const r = withTrailingSep(root)
  return a === normalize(root) || a.startsWith(r)
}

/**
 * safePath — canonicalize a caller-supplied path and refuse anything
 * that would escape the allowed roots or resolve through a symlink.
 *
 * @param {string} p           the raw path from the caller
 * @param {object} [opts]
 * @param {string[]} [opts.roots]     additional allowed roots (dirs).
 * @param {boolean}  [opts.softFail]   return null instead of throwing.
 * @param {string}   [opts.verb]       verb name for error messages.
 * @param {boolean}  [opts.mustExist]  reject if the target doesn't exist.
 *
 * @returns {string|null} canonical absolute path (or null when softFail).
 */
export function safePath(p, opts = {}) {
  const verb = opts.verb || 'file-verb'
  const softFail = opts.softFail === true
  const roots = [...defaultRoots(), ...(opts.roots || [])].map((r) => resolve(String(r)))

  const fail = (msg) => {
    if (softFail) return null
    throw new Error(`${verb}: ${msg}`)
  }

  // (1) shape checks
  if (typeof p !== 'string' || p.length === 0) {
    return fail('path must be a non-empty string')
  }
  if (p.includes('\0')) {
    return fail(`path contains null byte (rejected)`)
  }
  if (p.length > 4096) {
    return fail(`path exceeds 4096 chars (rejected)`)
  }

  // (2) resolve against cwd if relative
  const abs = isAbsolute(p) ? resolve(p) : resolve(process.cwd(), p)

  // (3) root containment — must be inside at least one allowed root
  const inSomeRoot = roots.some((r) => isUnder(abs, r))
  if (!inSomeRoot) {
    return fail(`path '${p}' resolves outside allowed roots (${roots.join(', ')})`)
  }

  // (4) mustExist gate — only meaningful for read verbs
  if (opts.mustExist && !existsSync(abs)) {
    return fail(`path '${abs}' does not exist`)
  }

  // (5) symlink checks on the target (only if it exists)
  if (existsSync(abs)) {
    let lst
    try { lst = lstatSync(abs) } catch { return fail(`cannot lstat '${abs}'`) }
    if (lst.isSymbolicLink()) {
      return fail(`path '${abs}' is a symlink (refused: symlink escape)`)
    }
    // Belt-and-braces: realpath of the target equals the resolved path
    // when NO ancestor is a symlink. If any ancestor is a link, they
    // differ — refuse.
    let real
    try { real = realpathSync(abs) } catch { real = abs }
    if (real !== abs) {
      return fail(`path '${abs}' resolves via symlink to '${real}' (refused)`)
    }
  } else {
    // For a NEW file we can't check the target, but we can check the
    // PARENT dir the same way — an ancestor-symlink attack still applies.
    const parent = dirname(abs)
    if (existsSync(parent)) {
      let lstp
      try { lstp = lstatSync(parent) } catch { return fail(`cannot lstat parent of '${abs}'`) }
      if (lstp.isSymbolicLink()) {
        return fail(`parent of '${abs}' is a symlink (refused: symlink escape)`)
      }
      let realp
      try { realp = realpathSync(parent) } catch { realp = parent }
      if (realp !== parent) {
        return fail(`parent of '${abs}' resolves via symlink to '${realp}' (refused)`)
      }
      // Final check: does the realpath'd parent still land under an allowed root?
      const inSomeRootAfterReal = roots.some((r) => isUnder(realp, r))
      if (!inSomeRootAfterReal) {
        return fail(`parent of '${abs}' resolves outside allowed roots after realpath`)
      }
    }
  }

  return abs
}

// ── cart-cross-execution guard ──────────────────────────────────────
//
// Tracks the current cart's root directory while it executes. Any
// cart/run or cart/load call must target a path INSIDE this root
// (or a subdir under it). Cross-cart calls that escape → refuse.
//
// Alfred lock (2026-07-17): "no cross-cart execution outside cart's
// own tree."
//
// This module-scope slot mirrors the _currentCaller pattern in
// src/dispatch.js. Callers push a root when a cart begins running and
// pop it (via the returned closer) when it ends.

let _currentCartRoot = null

/**
 * currentCartRoot — read the currently active cart's root, or null.
 */
export function currentCartRoot() {
  return _currentCartRoot
}

/**
 * withCartRoot — run `fn` with `root` set as the active cart root.
 * Returns whatever fn returns. Restores the previous root on exit
 * (even if fn throws) so nested cart execution nests cleanly.
 *
 * The runtime (or a future cart/run implementation) calls this. Until
 * cart/run exists no code paths hit it — the guard is inert.
 */
export function withCartRoot(root, fn) {
  const prev = _currentCartRoot
  _currentCartRoot = root ? resolve(String(root)) : null
  try {
    return fn()
  } finally {
    _currentCartRoot = prev
  }
}

/**
 * assertCartRootContains — throw unless `target` is inside the active
 * cart root. If no cart root is active, this is a no-op (base-runtime
 * calls from the REPL don't get sandboxed to a cart tree).
 *
 * Used by cart/run + cart/load implementations when they land.
 */
export function assertCartRootContains(target, verb = 'cart-verb') {
  const root = _currentCartRoot
  if (!root) return   // no active cart; base runtime call — allowed
  const abs = resolve(String(target))
  if (!isUnder(abs, root)) {
    throw new Error(
      `${verb}: target '${target}' escapes current cart root '${root}' ` +
      `(cross-cart execution refused)`)
  }
}

// Test-only reset seam.
export function __resetCartRoot() { _currentCartRoot = null }

export default {
  safePath,
  currentCartRoot,
  withCartRoot,
  assertCartRootContains,
  __resetCartRoot,
}
