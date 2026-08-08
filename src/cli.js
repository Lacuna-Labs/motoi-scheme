// motoi — bash CLI entry point
//
// Called via bin/motoi (which is a shebang stub).
//
//   motoi repl              Interactive REPL.
//   motoi eval "<code>"     Evaluate one expression, print result.
//   motoi run <file.scm>    Run a program file to completion.
//   motoi help <verb>       Print help for a verb.
//   motoi docs              Print MD reference to stdout.
//   motoi docs regen        Regenerate reference/ MD from live registry.
//   motoi version           Print version + git sha.
//   motoi slat parse <f>    Parse a .slat file; print as JSON.
//   motoi slat emit <f>     Convert a JSONL log to slat.

import { parse, Pair, pairToString, writeString } from './reader.js'
import { SchemeVector } from '../lib/base/r7rs-types.js'
import { isFlo, numToString } from '../lib/math/tower.js'
import { isStr, str as _sstr } from '../lib/base/mutable-string.js'
import { isCpx, cpxToString } from '../lib/math/complex.js'
import { opaqueRepr } from './opaque-print.js'
import { evaluate, noteError } from './interp.js'
import { makeCoreEnv } from '../core/index.js'
import { expandProgram } from './macro.js'
import { help } from './introspect.js'
import { startRepl, detectColor } from './repl.js'
import { emitDocs } from './docs-emitter.js'
import { slatLoads, slatDumps, slatToJsonl, jsonlToSlat } from './slat.js'
import { registerLib, stdParts, libInfo, validateStandard } from './lib-register.js'
import { readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { VERSION } from './index.js'
import { migrateLegacyMotoiData } from './paths.js'
import { startIdeServer } from './ide-server.js'
import { startTui } from '../tui/tui.js'
import startBoot from '../tui/boot-shell.js'

import { NIL, arrayToList, isList, isListish, isNull, isPair, listLength, listToArray, seqVerb, toJS, toScheme } from '../lib/base/list.js'
// Brand pink for section headers, matching renderSplash()'s MOTOI_PINK_256.
const PINK_256 = 218
const ANSI_RESET = '\x1b[0m'

// Resolve color mode for --help output. Mirrors repl.detectColor() so
// piping motoi --help gives plain text automatically.
function helpPaint({ noColor = false } = {}) {
  const mode = noColor ? 'none' : detectColor()
  const pink = (s) => mode === 'none' ? s : `\x1b[38;5;${PINK_256}m${s}${ANSI_RESET}`
  const dim  = (s) => mode === 'none' ? s : `\x1b[2m${s}\x1b[22m`
  const bold = (s) => mode === 'none' ? s : `\x1b[1m${s}\x1b[22m`
  return { pink, dim, bold, mode }
}

function usage({ noColor = false } = {}) {
  const { pink, dim, bold } = helpPaint({ noColor })
  const header = (s) => pink(s)
  // Two-column row: name gets a fixed 26-cell gutter, description is dimmed.
  const row = (name, desc) => `  ${name.padEnd(24)}${dim(desc)}`

  const sections = [
    [header('RUN'), [
      row('repl',              `Interactive REPL. Loads local verb layer if present.`),
      row('eval "<code>"',     `Evaluate one expression, print result.`),
      row('run <file.scm>',    `Run a program file to completion.`),
    ]],
    [header('TALK TO CODE'), [
      row('help <verb>',       `Print help for a verb (same as REPL ,help).`),
      row('docs',              `Print MD reference to stdout.`),
      row('docs regen [dir]',  `Regenerate reference/ MD from live registry.`),
    ]],
    [header('SURFACES'), [
      row('console',           `Boot splash → pick IDE / Music / Animation / Game. Bare 'motoi'.`),
      row('ide',               `3-panel browser IDE (default 127.0.0.1:3737).`),
      row('tui',               `4-region in-terminal IDE. Same runtime as ide.`),
    ]],
    [header('TOOLS'), [
      row('slat parse <file>', `Parse a .slat file; print as JSON.`),
      row('slat emit <file>',  `Convert a JSONL log to slat.`),
      row('version',           `Print version + git sha of the interpreter.`),
    ]],
    [header('GLOBAL OPTIONS'), [
      row('--fuel <n>',        `Fuel budget (default 200000).`),
      row('--seed <n>',        `PRNG seed (default: process time).`),
      row('--verb-layer <p>',  `Load this verb layer instead of auto-detecting.`),
      row('--no-color',        `Disable ANSI colour output.`),
      row('--hacker',          `80s phosphor theme (shorthand for --theme hacker).`),
      row('--theme <name>',    `Pick a theme (blossom | hacker | user). ~/motoi/themes/.`),
      row('--quiet',           `Suppress REPL banner.`),
      row('--json',            `Print eval/run results as JSON instead of s-exp.`),
    ]],
    [header('IDE OPTIONS'), [
      row('--port <n>',        `Listen port (ide, default 3737).`),
      row('--host <h>',        `Listen host (ide, default 127.0.0.1).`),
      row('--splash',          `Force retro boot splash (tui).`),
    ]],
    [header('EXAMPLES'), [
      `  ${dim('$')} motoi repl`,
      `  ${dim('$')} motoi eval "(+ 1 2)"`,
      `  ${dim('$')} motoi run hello.scm --fuel 500000`,
      `  ${dim('$')} motoi ide --port 4000`,
    ]],
  ]

  const head =
    `${bold('motoi')} ${dim('v' + VERSION)}  ${dim('— the base Scheme dialect')}\n` +
    `\n${dim('Usage:')} motoi <command> [options]\n`

  const body = sections.map(([h, lines]) => `\n${h}\n${lines.join('\n')}`).join('\n')
  return head + body + '\n'
}

function format(v) {
  if (v === undefined) return ''
  if (v === null) return '()'
  if (v === true) return '#t'
  if (v === false) return '#f'
  // Without this branch numbers fell through to String(v) at the bottom and the
  // top level printed the JavaScript spellings NaN and Infinity, while `display`
  // printed the R7RS ones. Two printers, one engine, different answers.
  // One printer for the whole tower (lib/math/tower.js), so an inexact integer
  // shows its point — `1.0`, not `1` — and cannot read back exact.
  if (typeof v === 'number' || typeof v === 'bigint' || isFlo(v)) return numToString(v)
  if (isStr(v)) return writeString(_sstr(v))
  // R7RS §6.9 bytevectors print as #u8(b0 b1 …).
  if (v instanceof Uint8Array) return '#u8(' + Array.from(v).join(' ') + ')'
  // R7RS §6.8 vectors print as #(e0 e1 …).
  if (v instanceof SchemeVector) return '#(' + v.items.map(format).join(' ') + ')'
  if (v instanceof Pair) return pairToString(v, format)
  if (isNull(v)) return '()'
  // Cells are handled above; `pairToString` only walks cells, so an array
  // reaching it would print `( . <array>)`.
  if (Array.isArray(v)) return '(' + v.map(format).join(' ') + ')'
  // Symbol-tagged runtime values (Sym): print by name.
  if (v && typeof v === 'object' && 'name' in v && typeof v.name === 'string'
      && Object.keys(v).length === 1) return v.name
  // Motoi rationals — Symbol.for('motoi:rational').
  const RAT_TAG = Symbol.for('motoi:rational')
  if (v && typeof v === 'object' && v[RAT_TAG] === true) {
    return v.d === 1n ? String(v.n) : `${v.n}/${v.d}`
  }
  // Motoi complex — Symbol.for('motoi:complex').
  if (isCpx(v)) return cpxToString(v)
  // Everything below used to fall through to String(v) and print the JS
  // artifact `[object Object]` — the same meaningless text for four unrelated
  // Scheme types, at the top level where a learner reads the answer.
  if (v && typeof v === 'object' && v.__eof__ === true) return '#<eof>'
  if (v && typeof v === 'object' && Array.isArray(v.vals)) {
    return v.vals.map(format).join(' ')
  }
  if (v && typeof v === 'object' && v.__promise__ === true) {
    return v.forced ? format(v.value) : '#<promise>'
  }
  if (typeof v === 'function') return '#<procedure>'
  // A Scheme lambda is a Closure object, not a JS function, so it missed the
  // test above and printed as `[object Object]` here and `#<record>` through
  // display. `(display car)` said `#<procedure>` for the same kind of thing.
  // Duck-typed rather than imported so all three renderers can agree without
  // src/cli.js, src/base.js and lib/base/r7rs-small.js taking a dependency.
  if (v && typeof v === 'object' && isList(v.params) && 'body' in v && 'env' in v) {
    return '#<procedure>'
  }
  if (v && typeof v === 'object' && typeof v.kind === 'string' && 'buffer' in v) {
    return `#<port ${v.kind}>`
  }
  // Host-backed opaque values — entities, hash tables, random sources, audio
  // records, SLAT records. All of these reached String(v) below and printed
  // `[object Object]`, the same six characters for five unrelated Scheme
  // types, at the top level where a learner reads the answer. The rule lives
  // in ONE place (src/opaque-print.js) rather than being duck-typed into each
  // of the four renderers, because four copies of a rule is four chances to
  // drift and drift is how `display` came to say `#<record>` for a value the
  // top level called `[object Object]`.
  const opaque = opaqueRepr(v)
  if (opaque) return opaque
  return String(v)
}

// `baseDir` is the directory of the file being run, so an `include` inside it
// resolves the way §4.1.7 suggests — relative to the file that wrote it, not
// to wherever the shell happened to be. Left undefined for `eval`, which has
// no file, and falls back to the working directory.
function evalSource(src, fuelBudget = 200000, baseDir = undefined) {
  const env = makeCoreEnv({ fuel: { n: fuelBudget } })
  const forms = parse(src)
  const { forms: expanded } = expandProgram(forms, { fuel: { n: fuelBudget }, baseDir })
  const fuel = { n: fuelBudget }
  let result
  try {
    for (const f of expanded) result = evaluate(f, env, fuel)
  } catch (err) {
    // Record the escaped error in the self-census, then re-raise unchanged.
    throw noteError(err)
  }
  return result
}

// Extract known top-level options from argv, returning { fuel, seed,
// noColor, verbLayer, hacker, quiet, json, rest }. Leaves everything
// else (subcommand + its arguments) in `rest` for downstream to handle.
//
// --seed and --verb-layer are captured but not yet wired to the
// evaluator (parked for a follow-up); they are accepted so scripts and
// docs that pass them do not break. --no-color is captured for later
// REPL/output plumbing. --hacker/--quiet forward to REPL and TUI as
// opts even before those surfaces consume them (forward-compat).
//
// Sub-command-scoped flags (--port, --host, --splash) are NOT consumed
// here — they get passed through in `rest` so the ide/tui branches can
// parse them locally.
const SUBCOMMAND_FLAGS = new Set(['--port', '--host', '--splash', '--serve'])

function extractOptions(argv) {
  let fuel = 200000
  let seed = null
  let noColor = false
  let verbLayer = null
  let hacker = false
  let quiet = false
  let json = false
  let theme = null
  const rest = []
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (a === '--fuel') {
      const next = argv[i + 1]
      const n = parseInt(next, 10)
      if (!Number.isFinite(n) || n <= 0) {
        throw new Error(`--fuel expects a positive integer, got ${JSON.stringify(next)}`)
      }
      fuel = n
      i++
      continue
    }
    if (a === '--seed') {
      const next = argv[i + 1]
      const n = parseInt(next, 10)
      if (!Number.isFinite(n)) {
        throw new Error(`--seed expects an integer, got ${JSON.stringify(next)}`)
      }
      seed = n
      i++
      continue
    }
    if (a === '--verb-layer') {
      const next = argv[i + 1]
      if (!next || next.startsWith('--')) {
        throw new Error(`--verb-layer expects a path, got ${JSON.stringify(next)}`)
      }
      verbLayer = next
      i++
      continue
    }
    if (a === '--no-color') { noColor = true; continue }
    if (a === '--hacker')   { hacker = true; continue }
    if (a === '--quiet')    { quiet = true; continue }
    if (a === '--json')     { json = true; continue }
    if (a === '--theme') {
      const next = argv[i + 1]
      if (!next || next.startsWith('--')) {
        throw new Error(`--theme expects a name, got ${JSON.stringify(next)}`)
      }
      theme = next
      i++
      continue
    }
    // Unknown top-level flag → refuse. Sub-command flags and -h/--help/-v
    // pass through untouched.
    if (a.startsWith('--') && !SUBCOMMAND_FLAGS.has(a) && a !== '--help' && a !== '--version') {
      const err = new Error(`unknown flag '${a}' — see 'motoi --help'`)
      err.unknownFlag = true
      throw err
    }
    rest.push(a)
  }
  // --hacker is a shorthand for --theme hacker when no explicit theme
  // was requested. Explicit --theme wins if both are passed.
  if (!theme && hacker) theme = 'hacker'
  return { fuel, seed, noColor, verbLayer, hacker, quiet, json, theme, rest }
}

export async function main(rawArgv = process.argv.slice(2), meta = {}) {
  // Migrate legacy ~/.motoi/{cortex.slat, reading-state.slat, artifacts/, carts/}
  // into ~/motoi/. Idempotent; never clobbers. Silent unless something moves.
  try {
    const moved = migrateLegacyMotoiData()
    if (moved.length > 0) {
      process.stderr.write(`[motoi] migrated ${moved.length} legacy file(s) from ~/.motoi/ to ~/motoi/\n`)
    }
  } catch { /* soft-fail — migration is best-effort */ }

  let fuelBudget
  let argv
  let cliOpts
  try {
    cliOpts = extractOptions(rawArgv)
    fuelBudget = cliOpts.fuel
    argv = cliOpts.rest
  } catch (e) {
    // Unknown flags get the requested "motoi: unknown flag …" shape;
    // other extract errors stay on the generic error prefix.
    const prefix = e.unknownFlag ? 'motoi' : 'error'
    process.stderr.write(`${prefix}: ${e.message}\n`)
    return 1
  }
  const { noColor, hacker, quiet, json, theme } = cliOpts

  // Two binaries, one script: `motoi` (the tool) boots the fantasy console
  // when no subcommand is given; `motoi-scheme` (the language) boots the
  // REPL. Explicit subcommands always win.
  const invokedAs = String(meta.invokedAs || 'motoi').toLowerCase()
  const isSchemeInvocation = invokedAs.startsWith('motoi-scheme')
  const defaultCmd = isSchemeInvocation ? 'repl' : 'console'

  const cmd = argv[0] || defaultCmd
  if (argv[0] === '--help' || argv[0] === '-h') {
    process.stdout.write(usage({ noColor, invokedAs })); return 0
  }

  if (cmd === 'version' || cmd === '--version' || cmd === '-v') {
    process.stdout.write(`motoi ${VERSION}\n`)
    return 0
  }

  if (cmd === 'repl') {
    // Warm the env with CORE so the copilot meta-commands (,ask ,fix ,explain
    // ,what ,rag) resolve to live copilot/* verbs instead of degrading to
    // "not registered". A bare makeBaseEnv REPL has no persona surface.
    const env = makeCoreEnv({ fuel: { n: fuelBudget } })
    await startRepl({ env, hacker, quiet, noColor, theme })
    return 0
  }

  if (cmd === 'console' || cmd === 'boot') {
    // The kid's front door: cold-boot ceremony → splash → pick a mode
    // (IDE · Music · Animation · Game), à la PICO-8 / TIC-80. This is what
    // bare `motoi` runs. `motoi tui` still drops straight into the IDE.
    try {
      await startBoot({ fuel: fuelBudget, hacker, quiet, noColor, theme })
    } catch (e) {
      process.stderr.write(`error: ${e.message}\n`)
      return 1
    }
    return 0
  }

  if (cmd === 'tui') {
    // motoi tui [--splash] [--theme <name>] — the terminal-hosted
    // 4-region IDE. Same runtime as motoi ide, painted through the
    // active theme (Blossom default, Hacker phosphor available).
    // --splash forces the retro boot even after first launch.
    const splash = argv.includes('--splash')
    try {
      await startTui({ fuel: fuelBudget, splash, hacker, quiet, noColor, theme })
    } catch (e) {
      process.stderr.write(`error: ${e.message}\n`)
      return 1
    }
    return 0
  }

  if (cmd === 'ide') {
    // motoi ide [--port N] [--host HOST]
    // The IDE is a browser-hosted 3-panel VS Code-style surface:
    // file tree · tabbed editor · REPL panel. Runs against the same
    // CORE roster the REPL has, so every book/*, cpu/*, composer/*
    // verb works the same way.
    let port = 3737
    let host = '127.0.0.1'
    for (let i = 1; i < argv.length; i++) {
      const a = argv[i]
      if (a === '--port') { port = parseInt(argv[++i], 10) || port; continue }
      if (a === '--host') { host = argv[++i] || host; continue }
    }
    try {
      await startIdeServer({ port, host, fuel: fuelBudget })
    } catch (e) {
      process.stderr.write(`error: ${e.message}\n`)
      return 1
    }
    // Keep the process alive — the server will hold the event loop.
    return new Promise(() => {})
  }

  if (cmd === 'eval' || cmd === '-e') {
    const src = argv.slice(1).join(' ')
    if (!src) { process.stderr.write('usage: motoi eval "<code>"\n'); return 1 }
    try {
      const result = evalSource(src, fuelBudget)
      if (result !== undefined) {
        const out = json ? JSON.stringify(result) : format(result)
        process.stdout.write(out + '\n')
      }
      return 0
    } catch (e) {
      process.stderr.write(hacker && e.stack ? `error: ${e.stack}\n` : `error: ${e.message}\n`)
      return 1
    }
  }

  if (cmd === 'run') {
    const file = argv[1]
    if (!file) { process.stderr.write('usage: motoi run <file.scm>\n'); return 1 }
    try {
      const src = await readFile(file, 'utf8')
      const result = evalSource(src, fuelBudget, path.dirname(path.resolve(file)))
      if (result !== undefined) {
        const out = json ? JSON.stringify(result) : format(result)
        process.stdout.write(out + '\n')
      }
      return 0
    } catch (e) {
      process.stderr.write(hacker && e.stack ? `error: ${e.stack}\n` : `error: ${e.message}\n`)
      return 1
    }
  }

  if (cmd === 'help') {
    const verb = argv[1]
    if (!verb) { process.stderr.write('usage: motoi help <verb>\n'); return 1 }
    // The verb registry is populated BY the installers — a verb's metadata is
    // recorded when its library is installed, not when its module is imported.
    // Without this, `motoi help` only ever saw the handful of verbs that
    // happened to register at import time, and answered "unknown verb" for
    // every library verb in the language: `motoi help entity/make` failed
    // while `motoi help car` worked, which reads as the verb not existing.
    makeCoreEnv({ fuel: { n: fuelBudget } })
    const meta = help(verb)
    if (!meta) { process.stderr.write(`unknown verb: ${verb}\n`); return 1 }
    process.stdout.write(`${meta.name}  —  ${meta.doc || '(no doc)'}\n`)
    if (meta.contract) process.stdout.write(`Contract: ${meta.contract}\n`)
    if (meta.arity !== null) process.stdout.write(`Arity:    ${JSON.stringify(meta.arity)}\n`)
    return 0
  }

  if (cmd === 'docs') {
    const sub = argv[1]
    // Same reason as `help` above — emitDocs reads the verb registry, which
    // only the installers fill in.
    makeCoreEnv({ fuel: { n: fuelBudget } })
    if (sub === 'regen') {
      // `scheme/reference` is canonical (CLAUDE.md: "the reference IS the
      // language"). The old default of `docs/reference` wrote a second,
      // divergent copy to a path nothing reads.
      const outDir = argv[2] || 'scheme/reference'
      const files = await emitDocs({ outDir })
      process.stdout.write(`emitted ${files.length} files under ${outDir}\n`)
      return 0
    }
    // default: print full MD to stdout
    const md = await emitDocs({ inline: true })
    process.stdout.write(md)
    return 0
  }

  if (cmd === 'slat') {
    const sub = argv[1]
    if (sub === 'parse') {
      const file = argv[2]
      const src = await readFile(file, 'utf8')
      const forms = slatLoads(src)
      process.stdout.write(JSON.stringify(forms, null, 2) + '\n')
      return 0
    }
    if (sub === 'emit') {
      const file = argv[2]
      const src = await readFile(file, 'utf8')
      const out = jsonlToSlat(src)
      process.stdout.write(out)
      return 0
    }
    process.stderr.write('usage: motoi slat <parse|emit> <file>\n')
    return 1
  }

  if (cmd === 'lib') {
    // motoi lib list                 — the standard parts table
    // motoi lib info <STD>           — one part's metadata + verbs
    // motoi lib validate [STD]       — run the 5-point gate (all, or one)
    // motoi lib register <file.js>   — validate + install a candidate part
    const sub = argv[1]

    if (!sub || sub === 'list') {
      const parts = stdParts()
      for (const p of parts) {
        process.stdout.write(`${p.std.padEnd(12)} ${p.mode.padEnd(6)} ${String(p.count).padStart(3)} verbs   ${p.spec}\n`)
      }
      return 0
    }

    if (sub === 'info') {
      const info = libInfo(argv[2] || '')
      if (!info) { process.stderr.write(`motoi lib: unknown part '${argv[2]}'\n`); return 1 }
      process.stdout.write(`${info.std}\n  spec:  ${info.spec}\n  mode:  ${info.mode}\n  verbs: ${info.count}\n`)
      process.stdout.write('  ' + info.verbs.join(', ') + '\n')
      return 0
    }

    if (sub === 'validate') {
      const env = makeCoreEnv({ fuel: { n: fuelBudget } })
      const only = argv[2]
      const reports = validateStandard(env, { n: fuelBudget })
        .filter((r) => !only || r.std === only || r.name === only)
      if (only && reports.length === 0) { process.stderr.write(`motoi lib: unknown part '${only}'\n`); return 1 }
      let allOk = true
      for (const r of reports) {
        process.stdout.write(`${r.ok ? 'PASS' : 'FAIL'}  ${r.name}\n`)
        for (const c of r.checks) {
          process.stdout.write(`      ${c.pass ? '✓' : '✗'} ${c.id}: ${c.detail}\n`)
        }
        allOk = allOk && r.ok
      }
      return allOk ? 0 : 1
    }

    if (sub === 'register') {
      const file = argv[2]
      if (!file) { process.stderr.write('usage: motoi lib register <file.js>\n'); return 1 }
      const env = makeCoreEnv({ fuel: { n: fuelBudget } })
      const res = await registerLib(file, { env, fuelBox: { n: fuelBudget } })
      process.stdout.write(`${res.ok ? 'INSTALLED' : 'REJECTED'}  ${res.std || file}\n`)
      for (const c of res.report.checks) {
        process.stdout.write(`      ${c.pass ? '✓' : '✗'} ${c.id}: ${c.detail}\n`)
      }
      if (!res.ok) {
        process.stderr.write('motoi lib: part failed the 5-point gate — nothing installed.\n')
        return 1
      }
      process.stdout.write(`installed ${res.record.verbs.length} verbs from ${res.std}.\n`)
      return 0
    }

    process.stderr.write('usage: motoi lib <list|info|validate|register> [arg]\n')
    return 1
  }

  process.stderr.write(`motoi: unknown command '${cmd}' — see 'motoi --help'\n`)
  return 1
}
