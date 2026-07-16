// sakura-scheme — bash CLI entry point
//
// Called via bin/sakura-scheme (which is a shebang stub).
//
//   sakura-scheme repl              Interactive REPL.
//   sakura-scheme eval "<code>"     Evaluate one expression, print result.
//   sakura-scheme run <file.scm>    Run a program file to completion.
//   sakura-scheme help <verb>       Print help for a verb.
//   sakura-scheme docs              Print MD reference to stdout.
//   sakura-scheme docs regen        Regenerate reference/ MD from live registry.
//   sakura-scheme version           Print version + git sha.
//   sakura-scheme slat parse <f>    Parse a .slat file; print as JSON.
//   sakura-scheme slat emit <f>     Convert a JSONL log to slat.

import { parse } from './reader.js'
import { evaluate } from './interp.js'
import { makeBaseEnv } from './base.js'
import { expandProgram } from './macro.js'
import { help } from './introspect.js'
import { startRepl } from './repl.js'
import { emitDocs } from './docs-emitter.js'
import { slatLoads, slatDumps, slatToJsonl, jsonlToSlat } from './slat.js'
import { readFile, writeFile } from 'node:fs/promises'
import { VERSION } from './index.js'

function usage() {
  return `sakura-scheme ${VERSION} — the language

Usage: sakura-scheme <command> [options]

Commands:
  repl                     Interactive REPL. Loads current dir's verb layer if present.
  eval "<code>"            Evaluate one expression, print result.
  run <file.scm>           Run a program file to completion.
  help <verb>              Print help for a verb (same as REPL ,help).
  docs                     Print MD reference to stdout, or --serve to launch local doc site.
  docs regen               Regenerate reference/ MD from live registry. Idempotent.
  version                  Print version + git sha of the interpreter.
  slat parse <file.slat>   Parse a .slat file; print as JSON.
  slat emit <file.jsonl>   Convert a JSONL log to slat.

Options:
  --verb-layer <path>      Load this verb layer instead of auto-detecting.
  --fuel <n>               Fuel budget (default 200000).
  --seed <n>               PRNG seed (default: process time).
  --no-color               Disable ANSI.
`
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
  const env = makeBaseEnv(fuelBudget)
  const forms = parse(src)
  const { forms: expanded } = expandProgram(forms, { fuel: { n: fuelBudget } })
  const fuel = { n: fuelBudget }
  let result
  for (const f of expanded) result = evaluate(f, env, fuel)
  return result
}

export async function main(argv = process.argv.slice(2)) {
  const cmd = argv[0]
  if (!cmd || cmd === '--help' || cmd === '-h') { process.stdout.write(usage()); return 0 }

  if (cmd === 'version' || cmd === '--version' || cmd === '-v') {
    process.stdout.write(`sakura-scheme ${VERSION}\n`)
    return 0
  }

  if (cmd === 'repl') {
    await startRepl({})
    return 0
  }

  if (cmd === 'eval' || cmd === '-e') {
    const src = argv.slice(1).join(' ')
    if (!src) { process.stderr.write('usage: sakura-scheme eval "<code>"\n'); return 1 }
    try {
      const result = evalSource(src)
      if (result !== undefined) process.stdout.write(format(result) + '\n')
      return 0
    } catch (e) {
      process.stderr.write(`error: ${e.message}\n`)
      return 1
    }
  }

  if (cmd === 'run') {
    const file = argv[1]
    if (!file) { process.stderr.write('usage: sakura-scheme run <file.scm>\n'); return 1 }
    try {
      const src = await readFile(file, 'utf8')
      const result = evalSource(src)
      if (result !== undefined) process.stdout.write(format(result) + '\n')
      return 0
    } catch (e) {
      process.stderr.write(`error: ${e.message}\n`)
      return 1
    }
  }

  if (cmd === 'help') {
    const verb = argv[1]
    if (!verb) { process.stderr.write('usage: sakura-scheme help <verb>\n'); return 1 }
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
      const files = emitDocs({ outDir })
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
    process.stderr.write('usage: sakura-scheme slat <parse|emit> <file>\n')
    return 1
  }

  process.stderr.write(`unknown command: ${cmd}\n\n`)
  process.stderr.write(usage())
  return 1
}
