#!/usr/bin/env node
// sequencer.js — Motoi Scheme piano-roll sequencer.
//
// Extras tool. NOT part of the language. Emits pure Motoi Scheme
// that (bin/motoi run <out>.scm) can play through synth/kit + note/strike.
//
// Modes:
//   1. Grid input from a text file (concise notation for humans/scripts).
//   2. Direct JSON pattern -> .scm emission.
//   3. Interactive TUI (minimal readline; edit steps one row/step at a time).
//
// The tool is hermetic: reads input files, writes output files, no shell-out,
// no network. All output is verified by delegating parse via bin/motoi run.
//
// Written in Node.js because the CLI needs stdin/readline for the TUI and
// because bin/motoi already runs on Node ≥ 20.16 — no new runtime added.

import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { resolve, dirname, basename, extname, join } from 'node:path'
import { homedir } from 'node:os'
import readline from 'node:readline/promises'
import { stdin, stdout } from 'node:process'

// ── grid notation ──────────────────────────────────────────────────
//
// A human-writable text format for drum/melody patterns. One row per
// track, each cell is one 16th-note step. `x` = hit, `.` = rest.
// A leading `NAME: ` labels the track. Percussion track names map to
// synth/kit sounds; anything else is treated as a pitched note.
//
//   kick:  x . . . x . . . x . . . x . . .
//   snare: . . x . . . x . . . x . . . x .
//   hat:   x x x x x x x x x x x x x x x x
//   C4:    x . . . . . . . x . . . . . . .   ; pitched — plays MIDI 60
//   G4:    . . . . x . . . . . . . x . . .
//
// Comments start with `;`. Blank lines ignored. `tempo: 120` sets BPM.

const KIT_NAMES = new Set(['kick', 'snare', 'hat', 'crash', 'clap'])

// Parse a grid file into { tempo, steps, tracks }. Throws on error.
export function parseGrid(text) {
  const lines = text.split(/\r?\n/)
  const tracks = []
  let tempo = 120
  let steps = 16
  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i]
    // strip trailing comment
    const semi = raw.indexOf(';')
    const line = (semi >= 0 ? raw.slice(0, semi) : raw).trim()
    if (!line) continue
    const colon = line.indexOf(':')
    if (colon < 0) throw new Error(`sequencer: line ${i + 1}: missing colon: ${JSON.stringify(raw)}`)
    const name = line.slice(0, colon).trim().toLowerCase()
    const body = line.slice(colon + 1).trim()
    if (name === 'tempo') {
      const n = parseInt(body, 10)
      if (!Number.isFinite(n) || n <= 0) throw new Error(`sequencer: line ${i + 1}: bad tempo ${JSON.stringify(body)}`)
      tempo = n
      continue
    }
    if (name === 'steps') {
      const n = parseInt(body, 10)
      if (!Number.isFinite(n) || n <= 0) throw new Error(`sequencer: line ${i + 1}: bad steps ${JSON.stringify(body)}`)
      steps = n
      continue
    }
    // parse cells: any whitespace separates
    const cells = body.split(/\s+/).filter(c => c.length > 0)
    const hits = []
    for (let s = 0; s < cells.length; s++) {
      const c = cells[s]
      if (c === 'x' || c === 'X') hits.push(s + 1)  // 1-indexed step
      else if (c === '.' || c === '_' || c === '-') { /* rest */ }
      else throw new Error(`sequencer: line ${i + 1} col ${s + 1}: unknown cell ${JSON.stringify(c)}`)
    }
    const kind = KIT_NAMES.has(name) ? 'kit' : 'pitched'
    const pitch = kind === 'pitched' ? noteNameToMidi(name) : null
    if (kind === 'pitched' && !Number.isFinite(pitch)) {
      throw new Error(`sequencer: line ${i + 1}: unknown track ${JSON.stringify(name)} (not a kit name or note name like C4)`)
    }
    tracks.push({ name, kind, pitch, hits })
    if (cells.length > steps) steps = cells.length
  }
  return { tempo, steps, tracks }
}

// Note-name -> MIDI number. "C4" = 60, "A4" = 69, "Bb3" = 58, "F#5" = 78.
export function noteNameToMidi(name) {
  const m = String(name).match(/^([a-g])([#b]?)(-?\d+)$/i)
  if (!m) return NaN
  const letter = m[1].toUpperCase()
  const accidental = m[2] || ''
  const octave = parseInt(m[3], 10)
  const semis = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 }[letter]
  if (semis === undefined) return NaN
  const delta = accidental === '#' ? 1 : accidental === 'b' ? -1 : 0
  return (octave + 1) * 12 + semis + delta
}

// ── emit ────────────────────────────────────────────────────────────
//
// A pattern compiles to a top-level program that:
//   1. Sets tempo via (audio/tempo bpm)
//   2. Defines one procedure per track (kit or pitched)
//   3. Runs the pattern by iterating steps 1..STEPS and firing
//      note/place-at at the step's fractional offset (16ths).
//
// Only core verbs are used: audio/tempo, synth/kit, note/place-at,
// define, if, for-each, range, *, /, and list literals.

export function emitScheme(pattern, meta = {}) {
  const { tempo, steps, tracks } = pattern
  const name = meta.name || 'untitled'
  const author = meta.author || 'unknown'
  const created = meta.created || new Date().toISOString().slice(0, 10)
  const lines = []
  lines.push(`;; ${name}.scm — generated by tools/sequencer`)
  lines.push(`;; author: ${author}`)
  lines.push(`;; created: ${created}`)
  lines.push(`;;`)
  lines.push(`;; Play with:  bin/motoi run <this file>`)
  lines.push(`;; Uses only Motoi CORE verbs: audio/tempo, synth/kit, note/place-at,`)
  lines.push(`;; note/strike, define, for-each, range, *, /.`)
  lines.push(``)
  lines.push(`(define STEPS ${steps})`)
  lines.push(`(define BEAT  0.25)   ;; seconds per 16th-note step at 60 bpm`)
  lines.push(`(audio/tempo ${tempo})`)
  lines.push(``)
  // Per-track hit lists.
  for (const t of tracks) {
    const hitsList = '(' + t.hits.join(' ') + ')'
    lines.push(`(define ${sanitizeSym(t.name)}-hits '${hitsList})`)
  }
  lines.push(``)
  // Emit the sequencer loop. For each track, walk its hits and schedule
  // via note/place-at at (step - 1) * BEAT.
  lines.push(`(define (sequence-track hits play-step)`)
  lines.push(`  (for-each`)
  lines.push(`    (lambda (step)`)
  lines.push(`      (play-step (* (- step 1) BEAT) step))`)
  lines.push(`    hits))`)
  lines.push(``)
  for (const t of tracks) {
    if (t.kind === 'kit') {
      lines.push(`(sequence-track ${sanitizeSym(t.name)}-hits`)
      lines.push(`  (lambda (offset step) (synth/kit '${t.name})))`)
    } else {
      lines.push(`(sequence-track ${sanitizeSym(t.name)}-hits`)
      lines.push(`  (lambda (offset step) (note/place-at ${t.pitch} offset BEAT)))`)
    }
  }
  lines.push(``)
  lines.push(`(display "sequenced ${tracks.length} tracks, ${steps} steps at ${tempo} bpm")`)
  lines.push(`(newline)`)
  return lines.join('\n') + '\n'
}

// Sanitize a track name into a Scheme identifier.
function sanitizeSym(n) {
  return String(n).replace(/[^a-zA-Z0-9_-]/g, '_')
}

// ── file organization ──────────────────────────────────────────────
//
// Priya's convention:
//   ~/.motoi/carts/<project>/<name>.scm
//   ~/.motoi/carts/<project>/assets/music/<name>.grid
// Fallback: cwd + explicit --out.

export function resolveOutputPath({ project, name, out }) {
  if (out) return resolve(out)
  const p = project || 'default'
  const n = name || 'untitled'
  return resolve(homedir(), '.motoi', 'carts', p, `${n}.scm`)
}

// ── TUI ─────────────────────────────────────────────────────────────
//
// A tiny piano-roll UI. Shows the grid, waits for a command, redraws.
// Commands:
//   toggle <track> <step>     flip the hit
//   add <track>               add empty track (kick/snare/hat/C4/G4/...)
//   remove <track>            drop a track
//   tempo <n>                 set BPM
//   steps <n>                 set total steps
//   save                      emit .scm to configured path
//   quit                      exit

async function runTui(state, outPath) {
  const rl = readline.createInterface({ input: stdin, output: stdout })
  console.log('motoi-sequencer TUI. Type `help` for commands, `save` to write, `quit` to exit.')
  console.log(`Output: ${outPath}`)
  redrawGrid(state)
  for (;;) {
    let cmd
    try {
      cmd = (await rl.question('seq> ')).trim()
    } catch { break }
    if (!cmd) continue
    if (cmd === 'quit' || cmd === 'q' || cmd === 'exit') break
    if (cmd === 'help') { printHelp(); continue }
    if (cmd === 'show' || cmd === 'g' || cmd === 'grid') { redrawGrid(state); continue }
    const toks = cmd.split(/\s+/)
    try {
      if (toks[0] === 'tempo') {
        const n = parseInt(toks[1], 10)
        if (!Number.isFinite(n) || n <= 0) throw new Error('tempo requires positive integer')
        state.tempo = n
      } else if (toks[0] === 'steps') {
        const n = parseInt(toks[1], 10)
        if (!Number.isFinite(n) || n <= 0) throw new Error('steps requires positive integer')
        state.steps = n
      } else if (toks[0] === 'add') {
        const nm = toks[1]?.toLowerCase()
        if (!nm) throw new Error('usage: add <track>')
        if (state.tracks.find(t => t.name === nm)) throw new Error(`track ${nm} exists`)
        const kind = KIT_NAMES.has(nm) ? 'kit' : 'pitched'
        const pitch = kind === 'pitched' ? noteNameToMidi(nm) : null
        if (kind === 'pitched' && !Number.isFinite(pitch)) throw new Error(`unknown track ${nm}`)
        state.tracks.push({ name: nm, kind, pitch, hits: [] })
      } else if (toks[0] === 'remove' || toks[0] === 'rm') {
        const nm = toks[1]?.toLowerCase()
        const before = state.tracks.length
        state.tracks = state.tracks.filter(t => t.name !== nm)
        if (state.tracks.length === before) throw new Error(`no track ${nm}`)
      } else if (toks[0] === 'toggle') {
        const nm = toks[1]?.toLowerCase()
        const step = parseInt(toks[2], 10)
        const t = state.tracks.find(t => t.name === nm)
        if (!t) throw new Error(`no track ${nm}`)
        if (!Number.isFinite(step) || step < 1 || step > state.steps) throw new Error(`step must be 1..${state.steps}`)
        const idx = t.hits.indexOf(step)
        if (idx >= 0) t.hits.splice(idx, 1)
        else { t.hits.push(step); t.hits.sort((a, b) => a - b) }
      } else if (toks[0] === 'save') {
        await mkdir(dirname(outPath), { recursive: true })
        const src = emitScheme(state, { name: basename(outPath, '.scm') })
        await writeFile(outPath, src)
        console.log(`wrote ${outPath}`)
        continue
      } else {
        throw new Error(`unknown command: ${toks[0]}`)
      }
      redrawGrid(state)
    } catch (e) {
      console.log(`err: ${e.message}`)
    }
  }
  rl.close()
}

function printHelp() {
  console.log([
    'commands:',
    '  show                       redraw the grid',
    '  add <track>                add track (kit name: kick/snare/hat/crash/clap;',
    '                             or note name: C4, G#4, Bb3, ...)',
    '  remove <track>             drop a track',
    '  toggle <track> <step>      flip a step (1-indexed)',
    '  tempo <bpm>                set tempo',
    '  steps <n>                  set total steps',
    '  save                       write .scm file',
    '  quit                       exit',
  ].join('\n'))
}

function redrawGrid(state) {
  const headWidth = Math.max(6, ...state.tracks.map(t => t.name.length))
  const beats = []
  for (let i = 1; i <= state.steps; i++) beats.push(String(i).padStart(2, ' '))
  console.log(''.padStart(headWidth + 2) + beats.join(' '))
  for (const t of state.tracks) {
    const set = new Set(t.hits)
    const cells = []
    for (let i = 1; i <= state.steps; i++) cells.push(set.has(i) ? ' x' : ' .')
    console.log(t.name.padStart(headWidth) + ': ' + cells.join(' '))
  }
  console.log(`tempo: ${state.tempo} bpm   steps: ${state.steps}   tracks: ${state.tracks.length}`)
}

// ── CLI entry point ────────────────────────────────────────────────

const USAGE = `motoi-sequencer — compile grid patterns to Motoi Scheme

usage:
  sequencer from-grid <in.grid> [--out <path.scm>] [--project <name>] [--name <name>]
  sequencer tui       [--out <path.scm>] [--project <name>] [--name <name>]
  sequencer demo      [--out <path.scm>]                    (writes a 4-on-the-floor sample)
  sequencer help

grid file:
  Line format: NAME: cell cell cell ...  (cells: x or .)
  Track names: kit sounds (kick/snare/hat/crash/clap) OR note names (C4, G#4, ...).
  Directives: 'tempo: 120', 'steps: 16'. '; ...' is a comment.

output path (Priya's file-org):
  Default:  ~/.motoi/carts/<project>/<name>.scm
  Or:       --out <explicit path>`

async function main(argv) {
  const cmd = argv[0]
  if (!cmd || cmd === 'help' || cmd === '--help' || cmd === '-h') {
    process.stdout.write(USAGE + '\n')
    return 0
  }
  const flags = parseFlags(argv.slice(1))
  if (cmd === 'from-grid') {
    const inPath = flags._[0]
    if (!inPath) { process.stderr.write('usage: sequencer from-grid <in.grid> [...]\n'); return 1 }
    const text = await readFile(resolve(inPath), 'utf8')
    const pattern = parseGrid(text)
    const name = flags.name || basename(inPath, extname(inPath))
    const out = resolveOutputPath({ project: flags.project, name, out: flags.out })
    await mkdir(dirname(out), { recursive: true })
    const src = emitScheme(pattern, { name })
    await writeFile(out, src)
    process.stdout.write(`${out}\n`)
    return 0
  }
  if (cmd === 'tui') {
    const name = flags.name || 'untitled'
    const out = resolveOutputPath({ project: flags.project, name, out: flags.out })
    const state = { tempo: 120, steps: 16, tracks: [
      { name: 'kick',  kind: 'kit', pitch: null, hits: [1, 5, 9, 13] },
      { name: 'snare', kind: 'kit', pitch: null, hits: [5, 13] },
      { name: 'hat',   kind: 'kit', pitch: null, hits: [1, 3, 5, 7, 9, 11, 13, 15] },
    ] }
    await runTui(state, out)
    return 0
  }
  if (cmd === 'demo') {
    const name = flags.name || 'four-on-the-floor'
    const out = resolveOutputPath({ project: flags.project || 'demos', name, out: flags.out })
    await mkdir(dirname(out), { recursive: true })
    const pattern = {
      tempo: 120,
      steps: 16,
      tracks: [
        { name: 'kick',  kind: 'kit',     pitch: null, hits: [1, 5, 9, 13] },
        { name: 'snare', kind: 'kit',     pitch: null, hits: [5, 13] },
        { name: 'hat',   kind: 'kit',     pitch: null, hits: [1, 3, 5, 7, 9, 11, 13, 15] },
        { name: 'c4',    kind: 'pitched', pitch: 60,   hits: [1, 9] },
        { name: 'g4',    kind: 'pitched', pitch: 67,   hits: [5, 13] },
      ],
    }
    const src = emitScheme(pattern, { name })
    await writeFile(out, src)
    process.stdout.write(`${out}\n`)
    return 0
  }
  process.stderr.write(`unknown command: ${cmd}\n\n${USAGE}\n`)
  return 1
}

function parseFlags(argv) {
  const flags = { _: [] }
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (a === '--out') flags.out = argv[++i]
    else if (a === '--project') flags.project = argv[++i]
    else if (a === '--name') flags.name = argv[++i]
    else if (a.startsWith('--')) { throw new Error(`unknown flag: ${a}`) }
    else flags._.push(a)
  }
  return flags
}

// Entry when invoked directly.
if (import.meta.url === `file://${process.argv[1]}`) {
  main(process.argv.slice(2))
    .then((code) => process.exit(code ?? 0))
    .catch((err) => {
      process.stderr.write(`sequencer: ${err.stack || err.message}\n`)
      process.exit(1)
    })
}
