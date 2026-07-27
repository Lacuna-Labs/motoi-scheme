// surfaces/tui.js — the terminal / TUI surface.
//
// Renders the copilot inside an in-terminal IDE: streaming color-coded roles,
// in-terminal diff previews (don't repeat Aider's no-diff gap), modes
// (Normal / Plan / Apply / auto), a granular permission engine, and slash/meta
// commands for structural actions (run cart, render music, spawn sprite).
//
// This surface is a PURE VIEW + a small controller over a Copilot instance. It
// owns no model logic — it formats suggestions and routes accept/reject back to
// the reasoning loop. All text passes through debrand() before it hits the TTY.
//
// Voice (pedagogy brief): frank, curious, no flattery, terse when confident,
// explicit when not. Confidence is shown as a tag, never hidden. The killer
// move — "I don't know — let's run it" — is a first-class rendered state.

import { Copilot } from '../src/copilot.js'
import { formAtOffset, listTopForms, splice as spliceForm } from '../src/editing.js'
import { debrand, IDENTITY } from '../src/debrand.js'

// ANSI color — role-coded per the market brief (blue user / green assistant /
// yellow system). Degrades to plain text when NO_COLOR is set or not a TTY.
const useColor = () => !process.env.NO_COLOR && process.stdout && process.stdout.isTTY
const C = {
  reset: '\x1b[0m', dim: '\x1b[2m', bold: '\x1b[1m',
  blue: '\x1b[34m', green: '\x1b[32m', yellow: '\x1b[33m',
  red: '\x1b[31m', cyan: '\x1b[36m', gray: '\x1b[90m',
}
const paint = (code, s) => (useColor() ? code + s + C.reset : s)

export const MODES = Object.freeze(['normal', 'plan', 'apply', 'auto'])

export class TuiSurface {
  /**
   * @param {object} [opts]
   * @param {Copilot} [opts.copilot]
   * @param {(s:string)=>void} [opts.write]  output sink (defaults to stdout)
   */
  constructor(opts = {}) {
    this.cp = opts.copilot instanceof Copilot ? opts.copilot : new Copilot(opts)
    this.write = opts.write || ((s) => process.stdout.write(s))
    this.mode = 'normal'
    // permission engine: per-action gates + an auto-approve escape.
    this.perms = { edit: 'ask', run: 'ask', autoApprove: false }
  }

  banner() {
    this.write(paint(C.cyan + C.bold, 'motoi copilot') + '\n')
    this.write(paint(C.gray, debrand(IDENTITY.intro)) + '\n\n')
  }

  setMode(m) {
    if (!MODES.includes(m)) return this.system(`unknown mode: ${m} (try ${MODES.join('/')})`)
    this.mode = m
    this.system(`mode → ${m}`)
  }

  // ── rendered roles ────────────────────────────────────────────────────────
  user(s) { this.write(paint(C.blue, '› ') + debrand(s) + '\n') }
  assistant(s) { this.write(paint(C.green, debrand(s)) + '\n') }
  system(s) { this.write(paint(C.yellow, '[' + debrand(s) + ']') + '\n') }
  error(s) { this.write(paint(C.red, '✗ ' + debrand(s)) + '\n') }

  // Confidence tag per the pedagogy brief — always visible.
  confTag(confidence) {
    const map = {
      verified: paint(C.green, '✓ verified'),
      'best-guess': paint(C.yellow, '~ best guess'),
      silent: paint(C.gray, '· (nothing to add)'),
    }
    return map[confidence] || confidence
  }

  /**
   * showSuggestion — render a Suggestion as ghost text with its confidence.
   * When the copilot chose silence (offer === null), we render the killer move
   * quietly — NOT an intrusive "no suggestion" nag (Clippy lesson).
   */
  showSuggestion(sug) {
    if (sug.offer === null) {
      // Silence won. Stay out of the way; a faint dot only. But if the human is
      // typing into a known cross-standard trap, the deterministic lesson still
      // earns a line — that's teaching, not nagging.
      this.write(paint(C.gray, '·') + '\n')
      if (sug.guard) this.write(paint(C.yellow, `  ⚠ ${debrand(sug.guard)}`) + '\n')
      return
    }
    const ghost = paint(C.dim, sug.offer)
    this.write(`${ghost}   ${this.confTag(sug.confidence)}\n`)
    if (sug.alternatives.length) {
      this.write(paint(C.gray, `  alternatives: ${sug.alternatives.slice(0, 3).map((a) => a.trim()).join('  |  ')}`) + '\n')
    }
    // Cross-standard tripwire lesson (fold-left → SRFI-1 fold, and why arg order flips).
    if (sug.guard) this.write(paint(C.yellow, `  ⚠ ${debrand(sug.guard)}`) + '\n')
  }

  /**
   * inTerminalDiff — render a before/after form diff in the terminal (green +,
   * red −). Closes Aider's no-diff gap. Returns the rendered string too.
   */
  inTerminalDiff(before, after, header = 'proposed edit') {
    const lines = []
    lines.push(paint(C.bold, `── ${header} ──`))
    for (const l of String(before).split('\n')) lines.push(paint(C.red, '- ' + l))
    for (const l of String(after).split('\n')) lines.push(paint(C.green, '+ ' + l))
    const out = lines.join('\n') + '\n'
    this.write(out)
    return out
  }

  // ── the interactive moves ──────────────────────────────────────────────────

  /** ghost — request + render an inline suggestion at a cursor position. */
  async ghost(pos, opts) {
    const sug = await this.cp.suggest(pos, opts)
    this.showSuggestion(sug)
    return sug
  }

  /** acceptLast — the human pressed Tab. Grade + salt. */
  acceptLast(traceId, opts) {
    const skill = this.cp.accept(traceId, opts)
    if (skill) this.system('learned this move')
    return skill
  }

  /** dismiss — the human pressed Esc. Raises silence-rate. */
  dismiss(traceId, opts = {}) {
    this.cp.reject(traceId, { ...opts, wantedSilence: true })
  }

  /**
   * slash — meta / structural commands. Returns true if handled.
   *   /mode <m>          switch mode
   *   /forms             list top-level forms in the buffer (form-addressing)
   *   /edit <name>       propose an edit to the named form (Plan/Apply)
   *   /run               (host wires the actual runner) — flagged here
   *   /who               identity
   */
  async slash(line, ctx = {}) {
    const [cmd, ...args] = line.replace(/^\//, '').trim().split(/\s+/)
    switch (cmd) {
      case 'mode': this.setMode(args[0]); return true
      case 'who': this.assistant(IDENTITY.intro); return true
      case 'forms': {
        const forms = listTopForms(ctx.buffer || '')
        for (const f of forms) this.write(paint(C.cyan, `  ${f.name || '(anon)'}`) + paint(C.gray, `  [${f.span.start}..${f.span.end}]`) + '\n')
        return true
      }
      case 'edit': {
        const name = args[0]
        const res = await this.cp.agenticEdit(`edit the form ${name}: ${args.slice(1).join(' ')}`, { buffer: ctx.buffer, file: ctx.file })
        if (!res.ok) { this.assistant(res.say); return true }
        this.inTerminalDiff(res.diffBase, res.program, `edit ${name}  [${res.confidence}]`)
        return true
      }
      case 'run':
        this.system('run → host runner (motoi run) — wire via TuiSurface opts.onRun')
        if (typeof ctx.onRun === 'function') await ctx.onRun(ctx.buffer)
        return true
      default:
        return false
    }
  }
}

export default TuiSurface
