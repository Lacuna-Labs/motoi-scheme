// scheme-engine.test.mjs — U1 unit test for `scheme.mjs`'s engine-range guard (O-68), in a scratch child process.
// owns: the proof that the foreman refuses to boot on an engine major outside ^3.0.0.
// refuses: to edit the engine; the engine's version module is replaced inside one scratch child by a resolve hook
//   (a dependency mocked, never the module under test); the child runs `scheme.mjs` itself, from disk.
// implements: design §6 (the kernel's reader), work order §2 (one upstream engine); eng §3.7 (the engine is imported).
// invariants: none written in the module.
// faults: none by id; the refusal is a boot failure (the process exits before any door opens).
// coverage: scheme.mjs — lines 100% branches 100% functions 100% (2026-10-24, with scheme.test.mjs)
import test from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'

const SCHEME = new URL('../scheme.mjs', import.meta.url).href
const HOOK = `import { registerHooks } from 'node:module'
registerHooks({ resolve(spec, ctx, next) {
  if (spec.endsWith('/version.js') && ctx.parentURL?.endsWith('/scheme.mjs')) return { url: 'data:text/javascript,export const VERSION = "4.0.0"', shortCircuit: true }
  return next(spec, ctx) } })`

// spec: design §6 · eng §3.7 (the engine is imported, never copied) · O-68
// class: J12 process signals and exit codes (a module that throws at import ends the boot with exit 1)
// technique: process kill of a scratch child: the child boots with a resolve hook that makes version.js answer 4.0.0
// method: spawn `node --import <hook> -e "import scheme.mjs"`; read its exit status and the sentence on stderr; then
//         import the real module here and read ENGINE_RANGE (the engine on disk still loads)
// sre: if someone bumps the engine to 4.x on the box, does the foreman refuse to boot with a sentence, not run wrong?
test('an engine major outside ^3.0.0 refuses to load the foreman with a sentence and exit 1', async () => {
  const r = spawnSync(process.execPath, ['--input-type=module', '--import', `data:text/javascript,${encodeURIComponent(HOOK)}`,
    '-e', `await import(${JSON.stringify(SCHEME)})`], { encoding: 'utf8', timeout: 10_000 })
  assert.equal(r.status, 1)
  assert.match(r.stderr, /Error: lacuna-scheme 4\.0\.0 is outside the foreman's range \^3\.0\.0/)
  const ok = await import('../scheme.mjs')
  assert.equal(ok.ENGINE_RANGE, '^3.0.0')
})
