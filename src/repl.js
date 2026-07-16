// sakura-scheme — REPL machinery
//
// This module is a stub of the full REPL described in the Sakura Scheme
// Book, Chapter 9. It implements the essentials — read/eval/print/loop
// with meta-command dispatch — and reserves slots for tab-complete,
// inline signature help, live docstring popup, structural editing,
// rich display, `,ask sakura`, live reload, and notebook mode. Those
// arrive in follow-up sprints.
//
// The meta-command dispatch table is authoritative: every meta-command
// the Book documents is registered here, so the introspection surface
// is one source of truth.

import { parse } from './reader.js'
import { evaluate, Env } from './interp.js'
import { makeBaseEnv } from './base.js'
import { expandProgram } from './macro.js'
import { help, describe, typeOf, arityOf, docOf, sourceOf, allVerbs } from './introspect.js'
import { snapshotRegistry } from './verbRegistry.js'

/**
 * Meta-command dispatch table.
 * Each entry: { command: string, args: string, doc: string, run: (rl, ctx, argv) => any }
 * The `run` function may print via ctx.output; return value ignored.
 */
export const META_COMMANDS = {
  ',help': {
    args: '<verb>',
    doc: 'Print help for a verb (name, doc, contract, examples, source).',
    run: (ctx, argv) => {
      const name = argv[0]
      if (!name) return ctx.output('usage: ,help <verb>')
      const meta = help(name)
      if (!meta) return ctx.output(`unknown verb: ${name}`)
      printHelp(ctx, meta)
    },
  },
  ',type': {
    args: '<verb>',
    doc: 'Print the verb contract, e.g. "(symbol [options]) -> boolean".',
    run: (ctx, argv) => ctx.output(typeOf(argv[0]) || '(no contract)'),
  },
  ',doc': {
    args: '<verb>',
    doc: 'Print the docstring alone.',
    run: (ctx, argv) => ctx.output(docOf(argv[0]) || '(no doc)'),
  },
  ',arity': {
    args: '<verb>',
    doc: 'Print the verb arity — scalar or [min, max].',
    run: (ctx, argv) => ctx.output(String(arityOf(argv[0]) ?? '(no arity)')),
  },
  ',source': {
    args: '<verb>',
    doc: 'Print the source location where the verb impl lives.',
    run: (ctx, argv) => ctx.output(sourceOf(argv[0]) || '(no source)'),
  },
  ',examples': {
    args: '<verb>',
    doc: 'Print the tiered examples (novice / intermediate / expert).',
    run: (ctx, argv) => {
      const meta = help(argv[0])
      if (!meta) return ctx.output(`unknown verb: ${argv[0]}`)
      for (const ex of meta.examples) ctx.output(`  ${ex.level.padEnd(14)} ${ex.code}`)
    },
  },
  ',apropos': {
    args: '<regex>',
    doc: 'Every symbol whose name matches. Sorted by namespace.',
    run: (ctx, argv) => {
      const re = new RegExp(argv[0] || '.')
      const names = Object.keys(snapshotRegistry()).filter((n) => re.test(n)).sort()
      for (const n of names) ctx.output(n)
    },
  },
  ',namespace': {
    args: '<ns>',
    doc: 'List every verb in a namespace.',
    run: (ctx, argv) => {
      const ns = argv[0]
      const names = Object.keys(snapshotRegistry()).filter((n) => n.startsWith(ns + '/')).sort()
      for (const n of names) ctx.output(n)
    },
  },
  ',time': {
    args: '<expr>',
    doc: 'Evaluate and print wall time + fuel used.',
    run: (ctx, argv) => {
      const src = argv.join(' ')
      const t0 = performance.now()
      const result = evalOne(src, ctx)
      const dt = (performance.now() - t0).toFixed(3)
      ctx.output(`=> ${format(result)}`)
      ctx.output(`   (${dt} ms)`)
    },
  },
  ',expand': {
    args: '<expr>',
    doc: 'Show the macroexpanded form.',
    run: (ctx, argv) => {
      const src = argv.join(' ')
      const forms = parse(src)
      const { forms: expanded } = expandProgram(forms, {})
      ctx.output(JSON.stringify(expanded, null, 2))
    },
  },
  ',exit': {
    args: '',
    doc: 'Leave the REPL.',
    run: (ctx) => {
      ctx.output('bye')
      ctx.exit()
    },
  },
  // The following meta-commands are the wow-layer targets from the
  // Book. Their handlers are stubs; the harness is here so the API
  // surface is stable while implementations land.
  ',trace': { args: '<fn>', doc: 'Record every call to fn.', run: (ctx) => ctx.output('(,trace: not yet implemented)') },
  ',untrace': { args: '<fn>', doc: 'Stop tracing fn.', run: (ctx) => ctx.output('(,untrace: not yet implemented)') },
  ',watch': { args: '<expr>', doc: 'Re-evaluate on every prompt.', run: (ctx) => ctx.output('(,watch: not yet implemented)') },
  ',inspect': { args: '<val>', doc: 'Walk into a value interactively.', run: (ctx) => ctx.output('(,inspect: not yet implemented)') },
  ',undo': { args: '', doc: 'Pop the last evaluation.', run: (ctx) => ctx.output('(,undo: not yet implemented)') },
  ',save': { args: '<file>', doc: 'Dump the session to a slat file.', run: (ctx) => ctx.output('(,save: not yet implemented)') },
  ',load': { args: '<file>', doc: 'Restore a session from a slat file.', run: (ctx) => ctx.output('(,load: not yet implemented)') },
  ',shell': { args: '<cmd>', doc: 'Pipe into a shell command.', run: (ctx) => ctx.output('(,shell: not yet implemented)') },
  ',ask': { args: 'sakura "how do I ..."', doc: 'Direct line to the persona.', run: (ctx) => ctx.output('(,ask sakura: not yet implemented)') },
}

function printHelp(ctx, meta) {
  ctx.output(`${meta.name}  —  ${meta.doc || '(no doc)'}`)
  if (meta.arity !== null) ctx.output(`Arity:      ${JSON.stringify(meta.arity)}`)
  if (meta.contract) ctx.output(`Contract:   ${meta.contract}`)
  if (meta.namespace) ctx.output(`Namespace:  ${meta.namespace}`)
  if (meta.tier) ctx.output(`Tier:       ${meta.tier}${meta.perm ? ` (perm: ${meta.perm})` : ''}`)
  if (meta.since) ctx.output(`Since:      ${meta.since}`)
  if (meta.source) ctx.output(`Source:     ${meta.source}`)
  if (meta.examples?.length) {
    ctx.output('')
    ctx.output('Examples:')
    for (const ex of meta.examples) {
      ctx.output(`  ${ex.level.padEnd(14)} ${ex.code}`)
    }
  }
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

function evalOne(src, ctx) {
  const forms = parse(src)
  const { forms: expanded } = expandProgram(forms, { fuel: { n: ctx.fuel } })
  const fuel = { n: ctx.fuel }
  let result
  for (const f of expanded) result = evaluate(f, ctx.env, fuel)
  return result
}

/**
 * Start an interactive REPL.
 * Minimal implementation: readline over stdin, no tab-complete yet.
 * Full features (structural editing, ghost signatures, notebook mode)
 * arrive in follow-up sprints; see docs/SAKURA-SCHEME-BOOK.md Ch 9.
 *
 * @param {object} opts
 * @param {number} [opts.fuel=200000] — evaluation fuel budget
 * @param {object} [opts.env] — pre-built environment (defaults to base env)
 * @param {object} [opts.stdin=process.stdin] — input stream
 * @param {object} [opts.stdout=process.stdout] — output stream
 * @param {string} [opts.prompt='> '] — prompt string
 */
export async function startRepl(opts = {}) {
  const readline = await import('node:readline')
  const fuel = opts.fuel ?? 200000
  const env = opts.env || makeBaseEnv(fuel)
  const prompt = opts.prompt ?? '> '
  const rl = readline.createInterface({
    input: opts.stdin || process.stdin,
    output: opts.stdout || process.stdout,
    terminal: true,
    prompt,
  })

  const ctx = {
    env,
    fuel,
    output: (line) => rl.output.write(line + '\n'),
    exit: () => rl.close(),
  }

  ctx.output('sakura-scheme 1.4.0  —  type ,help <verb> or ,exit')
  rl.prompt()
  rl.on('line', (line) => {
    const trimmed = line.trim()
    if (!trimmed) { rl.prompt(); return }
    try {
      if (trimmed.startsWith(',')) {
        const [cmd, ...argv] = trimmed.split(/\s+/)
        const handler = META_COMMANDS[cmd]
        if (!handler) ctx.output(`unknown meta-command: ${cmd}. Try ,help.`)
        else handler.run(ctx, argv)
      } else {
        const result = evalOne(trimmed, ctx)
        if (result !== undefined) ctx.output(format(result))
      }
    } catch (e) {
      ctx.output(`error: ${e.message}`)
    }
    rl.prompt()
  })
  rl.on('close', () => process.exit(0))
}
