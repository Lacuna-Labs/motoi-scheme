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

import { parse } from './reader.js'
import { evaluate } from './interp.js'
import { makeCoreEnv } from '../core/index.js'
import { expandProgram } from './macro.js'
import { help } from './introspect.js'
import { startRepl, detectColor } from './repl.js'
import { emitDocs } from './docs-emitter.js'
import { slatLoads, slatDumps, slatToJsonl, jsonlToSlat } from './slat.js'
import { readFile, writeFile } from 'node:fs/promises'
import { VERSION } from './index.js'
import { migrateLegacyMotoiData } from './paths.js'
import { startIdeServer } from './ide-server.js'
import { startTui } from '../tui/tui.js'

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
      row('--hacker',          `Verbose stacks, fuel at exit, show macroexpansion.`),
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
  if (typeof v === 'string') return JSON.stringify(v)
  if (Array.isArray(v)) return '(' + v.map(format).join(' ') + ')'
  return String(v)
}

function evalSource(src, fuelBudget = 200000) {
  const env = makeCoreEnv({ fuel: { n: fuelBudget } })
  const forms = parse(src)
  const { forms: expanded } = expandProgram(forms, { fuel: { n: fuelBudget } })
  const fuel = { n: fuelBudget }
  let result
  for (const f of expanded) result = evaluate(f, env, fuel)
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
    // Unknown top-level flag → refuse. Sub-command flags and -h/--help/-v
    // pass through untouched.
    if (a.startsWith('--') && !SUBCOMMAND_FLAGS.has(a) && a !== '--help' && a !== '--version') {
      const err = new Error(`unknown flag '${a}' — see 'motoi --help'`)
      err.unknownFlag = true
      throw err
    }
    rest.push(a)
  }
  return { fuel, seed, noColor, verbLayer, hacker, quiet, json, rest }
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
  const { noColor, hacker, quiet, json } = cliOpts

  // Two binaries, one script: `motoi` (the tool) boots the fantasy console
  // when no subcommand is given; `motoi-scheme` (the language) boots the
  // REPL. Explicit subcommands always win.
  const invokedAs = String(meta.invokedAs || 'motoi').toLowerCase()
  const isSchemeInvocation = invokedAs.startsWith('motoi-scheme')
  const defaultCmd = isSchemeInvocation ? 'repl' : 'tui'

  const cmd = argv[0] || defaultCmd
  if (argv[0] === '--help' || argv[0] === '-h') {
    process.stdout.write(usage({ noColor, invokedAs })); return 0
  }

  if (cmd === 'version' || cmd === '--version' || cmd === '-v') {
    process.stdout.write(`motoi ${VERSION}\n`)
    return 0
  }

  if (cmd === 'repl') {
    await startRepl({ hacker, quiet, noColor })
    return 0
  }

  if (cmd === 'tui') {
    // motoi tui [--splash] — the terminal-hosted 4-region IDE. Same
    // runtime as motoi ide, painted with the Sakura palette in ANSI.
    // No browser, no HTTP server — pure alt-screen ANSI over
    // stdin/stdout. --splash forces the retro boot even after first
    // launch (Wave 4).
    const splash = argv.includes('--splash')
    try {
      await startTui({ fuel: fuelBudget, splash, hacker, quiet, noColor })
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

  if (cmd === 'help') {
    const verb = argv[1]
    if (!verb) { process.stderr.write('usage: motoi help <verb>\n'); return 1 }
    const meta = help(verb)
    if (!meta) { process.stderr.write(`unknown verb: ${verb}\n`); return 1 }
    process.stdout.write(`${meta.name}  —  ${meta.doc || '(no doc)'}\n`)
    if (meta.contract) process.stdout.write(`Contract: ${meta.contract}\n`)
    if (meta.arity !== null) process.stdout.write(`Arity:    ${JSON.stringify(meta.arity)}\n`)
    return 0
  }

  if (cmd === 'docs') {
    const sub = argv[1]
    if (sub === 'regen') {
      const outDir = argv[2] || 'docs/reference'
      const files = await emitDocs({ outDir })
      process.stdout.write(`emitted ${files.length} files under ${outDir}\n`)
      return 0
    }
    // default: print full MD to stdout
    const md = emitDocs({ inline: true })
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

  process.stderr.write(`motoi: unknown command '${cmd}' — see 'motoi --help'\n`)
  return 1
}
