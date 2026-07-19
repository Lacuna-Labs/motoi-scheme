// tests/security/path-guard.test.js
//
// Verifies the path-sandbox helper (lib/security/path-guard.js).
// Provenance: Alfred lock 2026-07-17 — every file verb must sandbox
// its path input; escapes and symlinked ancestors must be refused.

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { resolve, join } from 'node:path'
import {
  mkdirSync, writeFileSync, symlinkSync, unlinkSync, existsSync, rmSync,
} from 'node:fs'
import { tmpdir, homedir } from 'node:os'
import {
  safePath,
  currentCartRoot,
  withCartRoot,
  assertCartRootContains,
  __resetCartRoot,
} from '../../lib/security/path-guard.js'

// ── safePath: allow list ──────────────────────────────────────────

test('safePath — path under cwd() is allowed', () => {
  const p = safePath('scratch/foo.slat', { verb: 'test' })
  assert.equal(typeof p, 'string')
  assert.ok(p.startsWith(process.cwd()), 'resolved under cwd')
})

test('safePath — path under ~/.motoi is allowed', () => {
  const target = join(homedir(), '.motoi', 'carts', 'test.slat')
  const p = safePath(target, { verb: 'test' })
  assert.equal(p, target)
})

test('safePath — absolute path under cwd() is allowed', () => {
  const target = join(process.cwd(), 'scratch', 'inner', 'x.slat')
  const p = safePath(target, { verb: 'test' })
  assert.equal(p, target)
})

// ── safePath: refuse escapes ──────────────────────────────────────

test('safePath — /etc/passwd is refused', () => {
  assert.throws(
    () => safePath('/etc/passwd', { verb: 'composer/load' }),
    /composer\/load.*outside allowed roots/i,
  )
})

test('safePath — /tmp/foo is refused (outside allowed roots)', () => {
  assert.throws(
    () => safePath('/tmp/foo', { verb: 'test' }),
    /outside allowed roots/i,
  )
})

test('safePath — relative traversal ../../../etc/passwd is refused', () => {
  assert.throws(
    () => safePath('../../../../../etc/passwd', { verb: 'test' }),
    /outside allowed roots/i,
  )
})

test('safePath — softFail returns null instead of throwing', () => {
  const r = safePath('/etc/passwd', { verb: 'test', softFail: true })
  assert.equal(r, null)
})

// ── safePath: shape checks ────────────────────────────────────────

test('safePath — empty string refused', () => {
  assert.throws(() => safePath('', { verb: 'test' }), /non-empty string/i)
})

test('safePath — non-string refused', () => {
  assert.throws(() => safePath(null, { verb: 'test' }), /non-empty string/i)
  assert.throws(() => safePath(undefined, { verb: 'test' }), /non-empty string/i)
})

test('safePath — null-byte in path refused', () => {
  assert.throws(() => safePath('foo\0bar', { verb: 'test' }), /null byte/i)
})

test('safePath — over-4096-char path refused', () => {
  const big = 'a'.repeat(5000)
  assert.throws(() => safePath(big, { verb: 'test' }), /4096/)
})

// ── safePath: mustExist ────────────────────────────────────────────

test('safePath — mustExist true on missing file refuses', () => {
  const target = join(process.cwd(), 'scratch', 'definitely-does-not-exist.slat')
  assert.throws(
    () => safePath(target, { verb: 'test', mustExist: true }),
    /does not exist/i,
  )
})

test('safePath — mustExist true on existing file allowed', () => {
  // package.json always exists at repo root.
  const target = join(process.cwd(), 'package.json')
  const p = safePath(target, { verb: 'test', mustExist: true })
  assert.equal(p, target)
})

// ── safePath: symlink refusal (P-01 pattern) ──────────────────────

test('safePath — symlinked target refused', () => {
  const workDir = join(process.cwd(), 'scratch', 'security-symlink-test')
  mkdirSync(workDir, { recursive: true })
  const secretFile = join(tmpdir(), '__motoi_pathguard_test_secret')
  const linkPath = join(workDir, 'malicious-link.slat')
  writeFileSync(secretFile, 'SHOULD-NOT-BE-READ')
  try { unlinkSync(linkPath) } catch {}
  symlinkSync(secretFile, linkPath)
  try {
    assert.throws(
      () => safePath(linkPath, { verb: 'test' }),
      /symlink/i,
    )
  } finally {
    try { unlinkSync(linkPath) } catch {}
    try { unlinkSync(secretFile) } catch {}
    try { rmSync(workDir, { recursive: true, force: true }) } catch {}
  }
})

test('safePath — symlink escape via ancestor dir refused', () => {
  // Create a symlink DIRECTORY inside cwd that points outside; a path
  // through that directory must refuse.
  const escapeTarget = join(tmpdir(), '__motoi_pathguard_escape_dir')
  const linkDir = join(process.cwd(), 'scratch', '__pathguard_link_dir')
  mkdirSync(escapeTarget, { recursive: true })
  writeFileSync(join(escapeTarget, 'leaked.slat'), 'secret')
  try { unlinkSync(linkDir) } catch {}
  try { rmSync(linkDir, { recursive: true, force: true }) } catch {}
  symlinkSync(escapeTarget, linkDir)
  try {
    const p = join(linkDir, 'leaked.slat')
    assert.throws(
      () => safePath(p, { verb: 'test' }),
      /symlink/i,
    )
  } finally {
    try { unlinkSync(linkDir) } catch {}
    try { rmSync(escapeTarget, { recursive: true, force: true }) } catch {}
  }
})

// ── cart-cross-execution guard ─────────────────────────────────────

test('cart-root — currentCartRoot default is null', () => {
  __resetCartRoot()
  assert.equal(currentCartRoot(), null)
})

test('cart-root — withCartRoot sets + restores', () => {
  __resetCartRoot()
  const root = join(process.cwd(), 'carts', 'mycart')
  const returned = withCartRoot(root, () => {
    assert.equal(currentCartRoot(), root)
    return 'inner'
  })
  assert.equal(returned, 'inner')
  assert.equal(currentCartRoot(), null, 'root restored after fn')
})

test('cart-root — withCartRoot restores even on throw', () => {
  __resetCartRoot()
  const root = join(process.cwd(), 'carts', 'mycart')
  assert.throws(() => {
    withCartRoot(root, () => { throw new Error('boom') })
  }, /boom/)
  assert.equal(currentCartRoot(), null, 'root restored after throw')
})

test('cart-root — nested withCartRoot restores outer', () => {
  __resetCartRoot()
  const outer = join(process.cwd(), 'carts', 'outer')
  const inner = join(process.cwd(), 'carts', 'inner')
  withCartRoot(outer, () => {
    assert.equal(currentCartRoot(), outer)
    withCartRoot(inner, () => {
      assert.equal(currentCartRoot(), inner)
    })
    assert.equal(currentCartRoot(), outer, 'restored to outer')
  })
})

test('cart-root — assertCartRootContains passes when target inside root', () => {
  __resetCartRoot()
  const root = join(process.cwd(), 'carts', 'mycart')
  const target = join(root, 'sub', 'thing.slat')
  withCartRoot(root, () => {
    // Should not throw.
    assertCartRootContains(target, 'cart/load')
  })
})

test('cart-root — assertCartRootContains refuses target outside root', () => {
  __resetCartRoot()
  const root = join(process.cwd(), 'carts', 'mycart')
  const evil = join(process.cwd(), 'carts', 'other-cart', 'thing.slat')
  withCartRoot(root, () => {
    assert.throws(
      () => assertCartRootContains(evil, 'cart/load'),
      /escapes current cart root/i,
    )
  })
})

test('cart-root — assertCartRootContains no-op when no cart active', () => {
  __resetCartRoot()
  // No cart active — call should NOT throw regardless of target.
  assertCartRootContains('/etc/passwd', 'cart/load')
})

// ── integration: composer/load refuses escapes ─────────────────────

test('integration — composer/load refuses /etc/passwd', async () => {
  const { makeCoreEnv } = await import('../../core/index.js')
  const { evaluate } = await import('../../src/interp.js')
  const { parse } = await import('../../src/reader.js')
  const fuel = { n: 1_000_000 }
  const env = makeCoreEnv({ fuel })
  const forms = parse('(composer/load "/etc/passwd")')
  assert.throws(
    () => { for (const f of forms) evaluate(f, env, fuel) },
    /composer\/load.*outside allowed roots|composer\/load.*symlink|composer\/load.*does not exist/i,
  )
})

test('integration — composer/save refuses /tmp/foo', async () => {
  const { makeCoreEnv } = await import('../../core/index.js')
  const { evaluate } = await import('../../src/interp.js')
  const { parse } = await import('../../src/reader.js')
  const fuel = { n: 1_000_000 }
  const env = makeCoreEnv({ fuel })
  const src = '(composer/save (composer/canvas) "/tmp/malicious.slat")'
  const forms = parse(src)
  assert.throws(
    () => { for (const f of forms) evaluate(f, env, fuel) },
    /composer\/save.*outside allowed roots/i,
  )
})

// ── integration: book/read handles nonexistent-chapter cleanly ────

test('integration — book/read with :chapter 999 returns clean error string, no crash', async () => {
  const { makeCoreEnv } = await import('../../core/index.js')
  const { evaluate } = await import('../../src/interp.js')
  const { parse } = await import('../../src/reader.js')
  const fuel = { n: 1_000_000 }
  const env = makeCoreEnv({ fuel })
  const forms = parse("(book/read :book (quote jesse) :chapter 999)")
  let result
  for (const f of forms) result = evaluate(f, env, fuel)
  // Either the book doesn't exist OR the chapter doesn't — either way
  // we get a string back, not a crash. Alfred's manual test.
  assert.equal(typeof result, 'string', 'book/read returns a string, not #f or throws')
  assert.ok(
    result.includes('no such chapter') || result.includes('no such book'),
    `expected "no such chapter" or "no such book"; got: ${result.slice(0, 80)}`,
  )
})

test('integration — book/read with malicious slug refuses cleanly', async () => {
  const { makeCoreEnv } = await import('../../core/index.js')
  const { evaluate } = await import('../../src/interp.js')
  const { parse } = await import('../../src/reader.js')
  const fuel = { n: 1_000_000 }
  const env = makeCoreEnv({ fuel })
  // slug regex refuses anything containing "/" or "." — no traversal possible.
  const forms = parse('(book/read :book "../../../etc" :chapter 1)')
  let result
  for (const f of forms) result = evaluate(f, env, fuel)
  assert.equal(typeof result, 'string')
  assert.ok(result.includes('no such book'), `expected "no such book"; got: ${result.slice(0, 80)}`)
})
