// motoi-scheme — REPL machinery
//
// This module is a stub of the full REPL described in the Motoi Scheme
// Book, Chapter 9. It implements the essentials — read/eval/print/loop
// with meta-command dispatch — and reserves slots for tab-complete,
// inline signature help, live docstring popup, structural editing,
// rich display, `,ask <persona>`, live reload, and notebook mode. Those
// arrive in follow-up sprints. Downstream dialects (e.g. Sakura) fill
// in the persona name via their own REPL layer.
//
// The meta-command dispatch table is authoritative: every meta-command
// the Book documents is registered here, so the introspection surface
// is one source of truth.

import { parse, sym } from './reader.js'
import { evaluate, Env } from './interp.js'
import { makeBaseEnv } from './base.js'
import { expandProgram } from './macro.js'
import { help, describe, typeOf, arityOf, docOf, sourceOf, allVerbs } from './introspect.js'
import { snapshotRegistry } from './verbRegistry.js'
import { VERSION } from './index.js'
import { TREE_LOGO } from '../lib/brand/tree-logo.js'

// ---------------------------------------------------------------------------
// Splash / brand banner
// ---------------------------------------------------------------------------
//
// The visual identity is locked (2026-07-17): three horizontal stripes —
// pink · green · brown — with an ASCII tree logo on the left and
// "MOTOI SCHEME" on the right. The tree lives in
// site/.vitepress/theme/logo.txt (canonical single source of truth); we
// read it from there so the REPL and the web header render the same mark.
// If logo.txt is unavailable (installed package, missing file), we degrade
// gracefully to a text-only banner — never invent an ASCII tree.
//
// Color tiers:
//   - `truecolor` — 24-bit ANSI (\x1b[38;2;R;G;Bm). Best fidelity.
//                   Detected via COLORTERM=truecolor|24bit.
//   - `256`       — 256-color ANSI (\x1b[38;5;Nm). Approximates the brand
//                   RGB with nearest xterm slots. Detected via TERM
//                   containing "256color" or any non-dumb terminal.
//   - `none`      — no escapes at all. Wordmark only. Automatic when
//                   stdout is not a TTY (piped, redirected, CI).
//
// Non-TTY behavior: startRepl suppresses the splash entirely when
// stdout isn't a TTY. renderSplash({ plain: true }) returns just the
// centered wordmark (single line) for callers that want a minimal
// banner without stripes.

const MOTOI_PINK  = [255, 192, 203]
const MOTOI_GREEN = [ 34, 139,  34]
const MOTOI_BROWN = [139,  69,  19]
const ANSI_RESET  = '\x1b[0m'

// Approximate xterm-256 slots for the brand RGBs. Chosen by nearest-hex
// scan against the standard xterm 256-color chart (spot-checked on
// macOS Terminal, iTerm2, and Alacritty).
const MOTOI_PINK_256  = 218   // ~#ffafd7
const MOTOI_GREEN_256 = 28    // ~#008700
const MOTOI_BROWN_256 = 94    // ~#875f00

function fg24(rgb) { return `\x1b[38;2;${rgb[0]};${rgb[1]};${rgb[2]}m` }
function fg256(n)  { return `\x1b[38;5;${n}m` }

/**
 * Detect the color capability of a stream.
 * Returns 'none' | '256' | 'truecolor'.
 * Honours NO_COLOR (https://no-color.org) and FORCE_COLOR.
 * Non-TTY streams get 'none'.
 */
export function detectColor(stream = process.stdout) {
  if (process.env.NO_COLOR) return 'none'
  if (process.env.FORCE_COLOR === '3') return 'truecolor'
  if (process.env.FORCE_COLOR === '2') return '256'
  if (process.env.FORCE_COLOR === '1') return '256'
  if (process.env.FORCE_COLOR === '0') return 'none'
  if (!stream || stream.isTTY !== true) return 'none'
  const colorterm = String(process.env.COLORTERM || '').toLowerCase()
  if (colorterm === 'truecolor' || colorterm === '24bit') return 'truecolor'
  const term = String(process.env.TERM || '').toLowerCase()
  if (!term || term === 'dumb') return 'none'
  if (term.includes('256color')) return '256'
  return '256'   // any non-dumb TERM at least does 256
}

// Consolidated to lib/brand/tree-logo.js per Zain audit F1 — one source
// of truth for the ASCII tree across REPL, TUI, and browser surfaces.
// When Alfred pastes the canonical art into site/.vitepress/theme/logo.txt,
// all three surfaces pick it up on next process start. Until then the
// same fallback stub renders in all three places (was: REPL degraded to
// text-only while TUI + browser used a hardcoded copy).
function loadLogoAscii() {
  return TREE_LOGO
}

/**
 * Render the Motoi splash banner (already newline-terminated).
 *
 * Layout (≤ 8 lines total):
 *   ▂▂▂▂▂▂▂▂▂▂▂▂▂▂▂▂▂▂▂▂▂▂▂▂▂▂▂▂▂▂▂▂▂▂▂▂▂▂▂▂▂▂  (pink stripe)
 *   ▂▂▂▂▂▂▂▂▂▂▂▂▂▂▂▂▂▂▂▂▂▂▂▂▂▂▂▂▂▂▂▂▂▂▂▂▂▂▂▂▂▂  (green stripe)
 *   ▂▂▂▂▂▂▂▂▂▂▂▂▂▂▂▂▂▂▂▂▂▂▂▂▂▂▂▂▂▂▂▂▂▂▂▂▂▂▂▂▂▂  (brown stripe)
 *   (blank)
 *   <tree row>          MOTOI SCHEME v0.1.0
 *   <tree row>       type ,help for commands
 *   <tree rows...>
 *   (blank)
 *
 * When the tree is absent (logo.txt still holds the TODO), the wordmark
 * and hint sit right-aligned within the stripe's column so the header
 * still reads as a lockup.
 *
 * Options:
 *   color   'auto' | 'truecolor' | '256' | 'none' | true | false
 *           'auto' (default) → detectColor(stdout).
 *   version defaults to VERSION.
 *   width   1..80; stripe width in cells; default 42.
 *   plain   if true, return only the wordmark on one line — no stripes,
 *           no tree, no hint. Callers who want a one-line banner.
 */
export function renderSplash({ color = 'auto', version = VERSION, width = 42, plain = false } = {}) {
  if (plain) return `Motoi Scheme  v${version}`

  // Resolve color mode.
  let mode
  if (color === 'auto') mode = detectColor()
  else if (color === true) mode = 'truecolor'
  else if (color === false) mode = 'none'
  else mode = color

  const paint = (rgb, code256, s) => {
    if (mode === 'truecolor') return fg24(rgb) + s + ANSI_RESET
    if (mode === '256')       return fg256(code256) + s + ANSI_RESET
    return s
  }
  const dim = (s) => mode === 'none' ? s : `\x1b[2m${s}\x1b[22m`
  const bold = (s) => mode === 'none' ? s : `\x1b[1m${s}\x1b[22m`

  // Color the ❀ blossoms pink — the tree carries Sakura-roundness by design.
  const colorTree = (row) => row.replace(/❀/g, paint(MOTOI_PINK, MOTOI_PINK_256, '❀'))

  const nodeVer = process.versions?.node?.split('.')[0] ?? '20'
  const tree = loadLogoAscii()
  const treeLines = tree.split('\n')

  // Layout, matching the Sakura lockup: tree on the left, four lines of
  // brand text on the right, hint on the tree's ground row.
  //
  //   ❀ ❀ ·          Motoi Scheme  v0.75.0-beta
  //   ❀ ❀ ❀          the base Scheme · node 20
  //   · ❀ ·          a small language for humans and AI
  //     |
  //    ~~~~          ,help · ,ask motoi · ,exit
  //
  // We align every text line at a fixed left column so the tree stays
  // in its column even if row widths vary.
  const treeCol = Math.max(...treeLines.map(l => l.length)) + 3
  const pad = (l) => l + ' '.repeat(Math.max(0, treeCol - l.length))
  const rightLines = [
    `${bold('Motoi Scheme')}  ${dim('v' + version)}`,
    dim(`the base Scheme · node ${nodeVer}`),
    dim('a small language for humans and AI'),
    '',
    dim(',help · ,ask motoi · ,exit'),
  ]

  const rows = treeLines.map((row, i) => {
    const painted = colorTree(row)
    // padded-length uses uncolored row width so column stays stable
    const leftPad = pad(row).slice(row.length)
    const right = rightLines[i] ?? ''
    return painted + leftPad + right
  })

  return rows.join('\n') + '\n'
}

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
  // ── LLM Tier-0 meta-commands (2026-07-17) ─────────────────────────
  // Non-UI-dependent — these just call the same-named verb and print
  // the result. Every verb is renderable by default. See
  // engineering/LLM-AUGMENTED-REPL-1.0.ENG.slat.
  //
  // Persona-scoped rename (2026-07-17, Alfred): meta-commands now route
  // to copilot/* verbs so the persona flavor is applied by default.
  // ,llm-raw remains for raw model access via llm/ask.
  ',ask': {
    args: '<question…>',
    doc: 'Ask Motoi Copilot (copilot/ask). Persona-flavored, registry-grounded.',
    run: (ctx, argv) => {
      const q = argv.join(' ')
      if (!q) return ctx.output('usage: ,ask <question…>')
      const fn = ctx.env.get('copilot/ask')
      if (typeof fn !== 'function') return ctx.output('(,ask: copilot/ask not registered)')
      const out = fn(q)
      if (out === false || out == null) ctx.output('(no LLM backend — set MOTOI_LLM_ENDPOINT + MOTOI_LLM_MODEL)')
      else ctx.output(String(out))
    },
  },
  ',llm-raw': {
    args: '<question…>',
    doc: 'Ask the raw LLM directly (llm/ask). No persona wrapper.',
    run: (ctx, argv) => {
      const q = argv.join(' ')
      if (!q) return ctx.output('usage: ,llm-raw <question…>')
      const fn = ctx.env.get('llm/ask')
      if (typeof fn !== 'function') return ctx.output('(,llm-raw: llm/ask not registered)')
      const out = fn(q)
      if (out === false || out == null) ctx.output('(no LLM backend — set MOTOI_LLM_ENDPOINT + MOTOI_LLM_MODEL)')
      else ctx.output(String(out))
    },
  },
  ',explain': {
    args: '<symbol-or-form>',
    doc: 'Prose explanation of a symbol or form (grounded in verb docs).',
    run: (ctx, argv) => {
      const src = argv.join(' ')
      if (!src) return ctx.output('usage: ,explain <symbol-or-form>')
      const fn = ctx.env.get('copilot/explain')
      if (typeof fn !== 'function') return ctx.output('(,explain: copilot/explain not registered)')
      let arg
      try {
        arg = parse(src)[0]
      } catch (e) { return ctx.output(`parse error: ${e.message}`) }
      const out = fn(arg)
      if (out === false || out == null) ctx.output('(no LLM backend — set MOTOI_LLM_ENDPOINT + MOTOI_LLM_MODEL)')
      else ctx.output(String(out))
    },
  },
  ',fix': {
    args: '',
    doc: 'Ask the LLM to suggest a fix for the last error.',
    run: (ctx) => {
      const fn = ctx.env.get('copilot/fix')
      if (typeof fn !== 'function') return ctx.output('(,fix: copilot/fix not registered)')
      const out = fn(undefined)
      if (out === false || out == null) ctx.output('(no last-error or no LLM backend)')
      else ctx.output(String(out))
    },
  },
  ',what': {
    args: '<symbol>',
    doc: 'Unified lookup — registry + reference + LLM guess.',
    run: (ctx, argv) => {
      const name = argv[0]
      if (!name) return ctx.output('usage: ,what <symbol>')
      const fn = ctx.env.get('copilot/what-is')
      if (typeof fn !== 'function') return ctx.output('(,what: copilot/what-is not registered)')
      const out = fn(sym(name))
      ctx.output(format(out))
    },
  },
  ',rag': {
    args: '<question…>',
    doc: 'Retrieval-augmented answer — searches verb registry + LLM.',
    run: (ctx, argv) => {
      const q = argv.join(' ')
      if (!q) return ctx.output('usage: ,rag <question…>')
      const fn = ctx.env.get('copilot/rag')
      if (typeof fn !== 'function') return ctx.output('(,rag: copilot/rag not registered)')
      const out = fn(q)
      ctx.output(format(out))
    },
  },
  // ── Completions meta-commands (2026-07-17) ────────────────────────
  ',complete': {
    args: '<partial>',
    doc: 'Tier-A completions (fast, local, no LLM tokens).',
    run: (ctx, argv) => {
      const partial = argv[0]
      if (!partial) return ctx.output('usage: ,complete <partial>')
      const fn = ctx.env.get('completions/at-point')
      if (typeof fn !== 'function') return ctx.output('(,complete: completions/at-point not registered)')
      const out = fn(partial)
      for (const rec of out) ctx.output(format(rec))
    },
  },
  ',smart-complete': {
    args: '<partial>',
    doc: 'Tier-B completions (LLM-augmented; costs tokens if backend set).',
    run: (ctx, argv) => {
      const partial = argv[0]
      if (!partial) return ctx.output('usage: ,smart-complete <partial>')
      const fn = ctx.env.get('completions/smart-at-point')
      if (typeof fn !== 'function') return ctx.output('(,smart-complete: completions/smart-at-point not registered)')
      const t0 = performance.now()
      const out = fn(partial, sym(':mode'), sym('llm-fallback'))
      const dt = (performance.now() - t0).toFixed(1)
      for (const rec of out) ctx.output(format(rec))
      ctx.output(`  (${dt} ms; LLM cost = whatever your endpoint charges)`)
    },
  },
  ',import?': {
    args: '<symbol>',
    doc: 'Suggest import(s) that provide a symbol.',
    run: (ctx, argv) => {
      const name = argv[0]
      if (!name) return ctx.output('usage: ,import? <symbol>')
      const fn = ctx.env.get('completions/import-suggestions')
      if (typeof fn !== 'function') return ctx.output('(,import?: completions/import-suggestions not registered)')
      const out = fn(sym(name))
      if (!out || out.length === 0) return ctx.output('(no import suggestions)')
      for (const rec of out) ctx.output(format(rec))
    },
  },
  // ── Book reader meta-commands (2026-07-17) ────────────────────────
  // The books-in-the-REPL surface Alfred asked for: read tutorials at
  // the prompt, hit enter on an example to run it. Every command wraps
  // a book/* verb; the output printing is the only REPL-specific piece.
  ',books': {
    args: '',
    doc: 'List every book in scheme-books/.',
    run: (ctx) => {
      const fn = ctx.env.get('book/list')
      if (typeof fn !== 'function') return ctx.output('(,books: book/list not registered)')
      const list = fn()
      if (!Array.isArray(list) || list.length === 0) return ctx.output('(no books found)')
      for (const name of list) ctx.output(`  ${name}`)
    },
  },
  ',read': {
    args: '<book> [<chapter>]',
    doc: 'Read a book (outline) or a specific chapter.',
    run: (ctx, argv) => {
      const bookName = argv[0]
      if (!bookName) return ctx.output('usage: ,read <book> [<chapter>]')
      const fn = ctx.env.get('book/read')
      if (typeof fn !== 'function') return ctx.output('(,read: book/read not registered)')
      const args = [sym(':book'), sym(bookName)]
      if (argv[1]) {
        const n = parseInt(argv[1], 10)
        if (Number.isFinite(n)) args.push(sym(':chapter'), n)
      }
      const out = fn(...args)
      ctx.output(String(out))
    },
  },
  ',example': {
    args: '<book> <chapter> <n>',
    doc: 'Print example N from a chapter — hit enter to eval the returned form.',
    run: (ctx, argv) => {
      const [bookName, chapStr, exStr] = argv
      if (!bookName || !chapStr || !exStr) {
        return ctx.output('usage: ,example <book> <chapter> <n>')
      }
      const chapNum = parseInt(chapStr, 10)
      const exNum   = parseInt(exStr, 10)
      if (!Number.isFinite(chapNum) || !Number.isFinite(exNum)) {
        return ctx.output('chapter + n must be integers')
      }
      const fn = ctx.env.get('book/example')
      if (typeof fn !== 'function') return ctx.output('(,example: book/example not registered)')
      const form = fn(
        sym(':book'), sym(bookName),
        sym(':chapter'), chapNum,
        sym(':example'), exNum,
      )
      if (form === false) return ctx.output(`(no example ${exNum} in chapter ${chapNum} of ${bookName})`)
      ctx.output(format(form))
    },
  },
  ',search': {
    args: '<query>',
    doc: 'Search across all books; print top 5 matches.',
    run: (ctx, argv) => {
      const q = argv.join(' ')
      if (!q) return ctx.output('usage: ,search <query>')
      const fn = ctx.env.get('book/search')
      if (typeof fn !== 'function') return ctx.output('(,search: book/search not registered)')
      const hits = fn(q)
      if (!Array.isArray(hits) || hits.length === 0) return ctx.output('(no results)')
      for (const hit of hits.slice(0, 5)) ctx.output(format(hit))
    },
  },
  ',next': {
    args: '',
    doc: 'Advance the book cursor to the next chapter.',
    run: (ctx) => {
      const fn = ctx.env.get('book/next')
      if (typeof fn !== 'function') return ctx.output('(,next: book/next not registered)')
      const out = fn()
      ctx.output(format(out))
    },
  },
  ',prev': {
    args: '',
    doc: 'Rewind the book cursor to the previous chapter.',
    run: (ctx) => {
      const fn = ctx.env.get('book/prev')
      if (typeof fn !== 'function') return ctx.output('(,prev: book/prev not registered)')
      const out = fn()
      ctx.output(format(out))
    },
  },
  // ── Composer v1.1 meta-commands (2026-07-17) ─────────────────────
  ',composer-show': {
    args: '[canvas-symbol]',
    doc: 'Render a canvas as ASCII/ANSI via composer/render-tui. Defaults to `patch` if bound.',
    run: (ctx, argv) => {
      const name = argv[0] || 'patch'
      let canvas
      try {
        canvas = ctx.env.get(name)
      } catch { /* not bound */ }
      if (!canvas || canvas.kind !== 'canvas') {
        return ctx.output(`(,composer-show: '${name}' is not bound to a canvas record)`)
      }
      const fn = ctx.env.get('composer/render-tui')
      if (typeof fn !== 'function') {
        return ctx.output('(,composer-show: composer/render-tui not registered)')
      }
      ctx.output(fn(canvas))
    },
  },
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
 * arrive in follow-up sprints; see scheme/MOTOI-SCHEME-BOOK.md Ch 9.
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

  // Splash: ANSI stripe motif + ASCII tree + wordmark.
  // - TTY: full splash. Color mode auto-detected (truecolor/256).
  // - Non-TTY (piped, redirected, dumb): suppress entirely — the prompt
  //   is the only signal a script consumer wants.
  // Callers can force with opts.splash = 'always' | 'never'.
  const wantSplash = opts.splash === 'always'
    ? true
    : opts.splash === 'never'
      ? false
      : (rl.output.isTTY === true)
  if (wantSplash) {
    const colorOpt = opts.color ?? 'auto'
    ctx.output(renderSplash({ color: colorOpt }))
  }
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
      // Stash for (fix (last-error)) / ,fix.
      if (ctx.env.__llmLastError) {
        ctx.env.__llmLastError.value = e.message
      }
    }
    rl.prompt()
  })
  rl.on('close', () => process.exit(0))
}
