#!/usr/bin/env node
// animator.js — Motoi Scheme frame-by-frame sprite animator.
//
// Extras tool. NOT part of the language. Emits pure Motoi Scheme that
// (bin/motoi run <out>.scm) can play through the framebuffer draw verbs.
//
// A "sprite" here is a small 2D grid of palette-index pixels. An
// "animation" is a sequence of frames, each holding one sprite placed
// at (x, y) with a per-frame duration in seconds.
//
// Input formats:
//   1. JSON scene (portable, hermetic):
//        { "mode":"default", "clear-color":0, "sprites":{...},
//          "frames":[ {"sprite":"a","x":10,"y":20,"dur":0.1}, ... ] }
//   2. ASCII sprite sheet (concise) — see parseSheet() below.
//   3. Interactive TUI — pixel-poke on a 16×16 canvas.
//
// The tool is hermetic: reads input files, writes .scm output, no shell-out,
// no network. Output emits only Motoi CORE verbs.
//
// Written in Node.js so the CLI + TUI can share readline/stdout with
// tools/sequencer and reuse the same runtime bin/motoi already requires.

import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { resolve, dirname, basename, extname, join } from 'node:path'
import { homedir } from 'node:os'
import readline from 'node:readline/promises'
import { stdin, stdout } from 'node:process'

// ── ASCII sprite sheet ─────────────────────────────────────────────
//
// A tiny format for authoring sprites by hand or from generation:
//
//   mode: default
//   clear: 0
//   sprite ship 5x5:
//     . . 8 . .
//     . 8 8 8 .
//     8 8 8 8 8
//     . 8 . 8 .
//     . 8 . 8 .
//   sprite ship-tilt 5x5:
//     . 8 . . .
//     8 8 8 . .
//     . 8 8 8 8
//     8 8 . 8 .
//     8 . . 8 .
//   frame ship 30 40 0.15
//   frame ship-tilt 30 40 0.15
//   frame ship 30 40 0.15
//   frame ship-tilt 30 40 0.15
//
// Cells are palette indices 0..15 or `.` (== 0/transparent, meaning
// "don't paint"). Frames replay in order; `dur` is seconds per frame.

export function parseSheet(text) {
  const lines = text.split(/\r?\n/)
  let mode = 'default'
  let clear = 0
  const sprites = {}
  const frames = []
  let i = 0
  while (i < lines.length) {
    const raw = lines[i]
    const semi = raw.indexOf(';')
    const line = (semi >= 0 ? raw.slice(0, semi) : raw).trim()
    if (!line) { i++; continue }
    if (line.startsWith('mode:')) { mode = line.slice(5).trim(); i++; continue }
    if (line.startsWith('clear:')) {
      const n = parseInt(line.slice(6).trim(), 10)
      if (!Number.isFinite(n)) throw new Error(`animator: line ${i + 1}: bad clear ${JSON.stringify(line)}`)
      clear = n
      i++
      continue
    }
    if (line.startsWith('sprite ')) {
      const m = line.match(/^sprite\s+([\w-]+)\s+(\d+)x(\d+)\s*:\s*$/)
      if (!m) throw new Error(`animator: line ${i + 1}: sprite header ${JSON.stringify(line)}`)
      const name = m[1]
      const w = parseInt(m[2], 10)
      const h = parseInt(m[3], 10)
      i++
      const grid = []
      for (let r = 0; r < h; r++) {
        while (i < lines.length) {
          const rawR = lines[i]
          const semiR = rawR.indexOf(';')
          const l = (semiR >= 0 ? rawR.slice(0, semiR) : rawR).trim()
          if (!l) { i++; continue }
          const cells = l.split(/\s+/).filter(c => c.length > 0)
          if (cells.length !== w) throw new Error(`animator: line ${i + 1}: sprite ${name} row ${r + 1}: expected ${w} cells, got ${cells.length}`)
          const row = cells.map((c, ci) => {
            if (c === '.') return null
            const n = parseInt(c, 10)
            if (!Number.isFinite(n)) throw new Error(`animator: line ${i + 1} col ${ci + 1}: bad cell ${JSON.stringify(c)}`)
            return n & 0xff
          })
          grid.push(row)
          i++
          break
        }
      }
      sprites[name] = { w, h, grid }
      continue
    }
    if (line.startsWith('frame ')) {
      const m = line.match(/^frame\s+([\w-]+)\s+(-?\d+)\s+(-?\d+)\s+([\d.]+)\s*$/)
      if (!m) throw new Error(`animator: line ${i + 1}: frame header ${JSON.stringify(line)}`)
      const sprite = m[1]
      const x = parseInt(m[2], 10)
      const y = parseInt(m[3], 10)
      const dur = parseFloat(m[4])
      if (!Number.isFinite(dur) || dur <= 0) throw new Error(`animator: line ${i + 1}: bad dur ${JSON.stringify(m[4])}`)
      frames.push({ sprite, x, y, dur })
      i++
      continue
    }
    throw new Error(`animator: line ${i + 1}: unexpected ${JSON.stringify(line)}`)
  }
  // sanity check: every frame references an existing sprite
  for (const f of frames) {
    if (!sprites[f.sprite]) throw new Error(`animator: frame references unknown sprite ${JSON.stringify(f.sprite)}`)
  }
  return { mode, clear, sprites, frames }
}

// ── emit ────────────────────────────────────────────────────────────
//
// A scene compiles to a top-level program that:
//   1. (set-mode 'default) or the named mode.
//   2. Defines each sprite as a list of (pset x y c) commands relative
//      to a top-left origin (0,0).
//   3. Defines (play-frame sprite-fn x y) that clears, invokes the
//      sprite fn shifted by (x,y), and (render)s.
//   4. Iterates frames, calling (play-frame ...) then (wait dur).
//
// Only core verbs are used: set-mode, clear, pset, render, wait, define,
// let, for-each, list, +, -, *.

export function emitScheme(scene, meta = {}) {
  const { mode, clear, sprites, frames } = scene
  const name = meta.name || 'untitled'
  const author = meta.author || 'unknown'
  const created = meta.created || new Date().toISOString().slice(0, 10)
  const lines = []
  lines.push(`;; ${name}.scm — generated by tools/animator`)
  lines.push(`;; author: ${author}`)
  lines.push(`;; created: ${created}`)
  lines.push(`;;`)
  lines.push(`;; Play with:  bin/motoi run <this file>`)
  lines.push(`;; Uses only Motoi CORE verbs: set-mode, clear, pset, render, wait,`)
  lines.push(`;; define, lambda, for-each, +, list.`)
  lines.push(``)
  lines.push(`(set-mode '${mode})`)
  lines.push(``)
  // Emit each sprite as a procedure that takes an offset (x0 y0) and
  // pokes its non-transparent pixels.
  const spriteNames = Object.keys(sprites)
  for (const sname of spriteNames) {
    const s = sprites[sname]
    lines.push(`;; sprite ${sname} (${s.w}x${s.h})`)
    lines.push(`(define (draw-${sanitizeSym(sname)} x0 y0)`)
    for (let r = 0; r < s.h; r++) {
      for (let c = 0; c < s.w; c++) {
        const col = s.grid[r][c]
        if (col === null || col === 0) continue
        lines.push(`  (pset (+ x0 ${c}) (+ y0 ${r}) ${col})`)
      }
    }
    lines.push(`  #t)`)
    lines.push(``)
  }
  // Emit the frame runner.
  lines.push(`(define (play-frame draw-fn x y clear-color dur)`)
  lines.push(`  (clear clear-color)`)
  lines.push(`  (draw-fn x y)`)
  lines.push(`  (render)`)
  lines.push(`  (wait dur))`)
  lines.push(``)
  // Emit each frame.
  lines.push(`;; ${frames.length} frames`)
  for (const f of frames) {
    lines.push(`(play-frame draw-${sanitizeSym(f.sprite)} ${f.x} ${f.y} ${clear} ${f.dur})`)
  }
  lines.push(``)
  lines.push(`(display "played ${frames.length} frames of ${spriteNames.length} sprite(s)")`)
  lines.push(`(newline)`)
  return lines.join('\n') + '\n'
}

function sanitizeSym(n) {
  return String(n).replace(/[^a-zA-Z0-9_-]/g, '_')
}

// ── file organization ──────────────────────────────────────────────

export function resolveOutputPath({ project, name, out }) {
  if (out) return resolve(out)
  const p = project || 'default'
  const n = name || 'untitled'
  return resolve(homedir(), '.motoi', 'carts', p, `${n}.scm`)
}

// ── TUI ─────────────────────────────────────────────────────────────
//
// A tiny sprite editor + frame timeline. Canvas is one sprite at a time
// on a small grid (default 8×8). Commands:
//   sprite <name> <w> <h>   create / switch active sprite
//   pixel <x> <y> <color>   set a pixel (color 0..15; 0 = transparent)
//   fill <color>            fill active sprite with color
//   frame <sprite> <x> <y> <dur>   push a frame
//   frames                  list frames
//   sprites                 list sprites
//   mode <name>             set framebuffer mode
//   clear <color>           set background color
//   show                    ASCII-render active sprite
//   save                    write .scm
//   quit                    exit

async function runTui(state, outPath) {
  const rl = readline.createInterface({ input: stdin, output: stdout })
  console.log('motoi-animator TUI. Type `help` for commands, `save` to write, `quit` to exit.')
  console.log(`Output: ${outPath}`)
  let active = null
  for (;;) {
    let cmd
    try {
      cmd = (await rl.question(`anim${active ? '/' + active : ''}> `)).trim()
    } catch { break }
    if (!cmd) continue
    if (cmd === 'quit' || cmd === 'q' || cmd === 'exit') break
    if (cmd === 'help') { printHelp(); continue }
    const toks = cmd.split(/\s+/)
    try {
      if (toks[0] === 'sprite') {
        const nm = toks[1]
        const w = parseInt(toks[2] || '8', 10)
        const h = parseInt(toks[3] || '8', 10)
        if (!nm) throw new Error('usage: sprite <name> [w] [h]')
        if (!state.sprites[nm]) {
          state.sprites[nm] = { w, h, grid: Array.from({ length: h }, () => Array(w).fill(null)) }
        }
        active = nm
        showSprite(state.sprites[nm])
      } else if (toks[0] === 'pixel' || toks[0] === 'p') {
        if (!active) throw new Error('no active sprite; use `sprite <name>` first')
        const x = parseInt(toks[1], 10)
        const y = parseInt(toks[2], 10)
        const c = toks[3] === '.' ? null : parseInt(toks[3], 10)
        const s = state.sprites[active]
        if (x < 0 || x >= s.w || y < 0 || y >= s.h) throw new Error(`out of bounds: 0..${s.w - 1} × 0..${s.h - 1}`)
        s.grid[y][x] = c
        showSprite(s)
      } else if (toks[0] === 'fill') {
        if (!active) throw new Error('no active sprite')
        const c = toks[1] === '.' ? null : parseInt(toks[1], 10)
        const s = state.sprites[active]
        for (let r = 0; r < s.h; r++) for (let cc = 0; cc < s.w; cc++) s.grid[r][cc] = c
        showSprite(s)
      } else if (toks[0] === 'frame' || toks[0] === 'f') {
        const sp = toks[1]
        const x = parseInt(toks[2], 10)
        const y = parseInt(toks[3], 10)
        const dur = parseFloat(toks[4])
        if (!sp || !state.sprites[sp]) throw new Error(`unknown sprite ${sp}`)
        if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(dur)) throw new Error('usage: frame <sprite> <x> <y> <dur>')
        state.frames.push({ sprite: sp, x, y, dur })
        console.log(`frames: ${state.frames.length}`)
      } else if (toks[0] === 'frames') {
        state.frames.forEach((f, i) => console.log(`  ${i}: ${f.sprite} @ (${f.x},${f.y}) for ${f.dur}s`))
      } else if (toks[0] === 'sprites') {
        for (const nm of Object.keys(state.sprites)) console.log(`  ${nm} (${state.sprites[nm].w}x${state.sprites[nm].h})`)
      } else if (toks[0] === 'mode') {
        state.mode = toks[1] || 'default'
      } else if (toks[0] === 'clear') {
        state.clear = parseInt(toks[1], 10) || 0
      } else if (toks[0] === 'show') {
        if (!active) throw new Error('no active sprite')
        showSprite(state.sprites[active])
      } else if (toks[0] === 'save') {
        await mkdir(dirname(outPath), { recursive: true })
        const src = emitScheme(state, { name: basename(outPath, '.scm') })
        await writeFile(outPath, src)
        console.log(`wrote ${outPath}`)
      } else {
        throw new Error(`unknown command: ${toks[0]}`)
      }
    } catch (e) {
      console.log(`err: ${e.message}`)
    }
  }
  rl.close()
}

function printHelp() {
  console.log([
    'commands:',
    '  sprite <name> [w] [h]      create/switch active sprite (default 8x8)',
    '  pixel <x> <y> <c>          set pixel (c = 0..15 or . for transparent)',
    '  fill <c>                   fill active sprite',
    '  frame <sprite> <x> <y> <dur>   append a frame',
    '  frames                     list frames',
    '  sprites                    list sprites',
    '  mode <name>                framebuffer mode',
    '  clear <c>                  background color',
    '  show                       ASCII-render active sprite',
    '  save                       write .scm file',
    '  quit                       exit',
  ].join('\n'))
}

function showSprite(s) {
  for (let r = 0; r < s.h; r++) {
    let row = ''
    for (let c = 0; c < s.w; c++) {
      const v = s.grid[r][c]
      row += v == null ? ' .' : ' ' + v.toString(16)
    }
    console.log(row)
  }
}

// ── CLI entry point ────────────────────────────────────────────────

const USAGE = `motoi-animator — compile sprite sheets to Motoi Scheme

usage:
  animator from-sheet <in.sheet> [--out <path.scm>] [--project <name>] [--name <name>]
  animator from-json  <in.json>  [--out <path.scm>] [--project <name>] [--name <name>]
  animator tui                   [--out <path.scm>] [--project <name>] [--name <name>]
  animator demo                  [--out <path.scm>]
  animator help

sheet file:
  mode: default
  clear: 0
  sprite ship 5x5:
    . . 8 . .
    . 8 8 8 .
    8 8 8 8 8
    . 8 . 8 .
    . 8 . 8 .
  frame ship 30 40 0.15
  ...

output path (Priya's file-org):
  Default: ~/.motoi/carts/<project>/<name>.scm`

async function main(argv) {
  const cmd = argv[0]
  if (!cmd || cmd === 'help' || cmd === '--help' || cmd === '-h') {
    process.stdout.write(USAGE + '\n')
    return 0
  }
  const flags = parseFlags(argv.slice(1))
  if (cmd === 'from-sheet') {
    const inPath = flags._[0]
    if (!inPath) { process.stderr.write('usage: animator from-sheet <in.sheet>\n'); return 1 }
    const text = await readFile(resolve(inPath), 'utf8')
    const scene = parseSheet(text)
    const name = flags.name || basename(inPath, extname(inPath))
    const out = resolveOutputPath({ project: flags.project, name, out: flags.out })
    await mkdir(dirname(out), { recursive: true })
    await writeFile(out, emitScheme(scene, { name }))
    process.stdout.write(`${out}\n`)
    return 0
  }
  if (cmd === 'from-json') {
    const inPath = flags._[0]
    if (!inPath) { process.stderr.write('usage: animator from-json <in.json>\n'); return 1 }
    const text = await readFile(resolve(inPath), 'utf8')
    const scene = JSON.parse(text)
    const name = flags.name || basename(inPath, extname(inPath))
    const out = resolveOutputPath({ project: flags.project, name, out: flags.out })
    await mkdir(dirname(out), { recursive: true })
    await writeFile(out, emitScheme(scene, { name }))
    process.stdout.write(`${out}\n`)
    return 0
  }
  if (cmd === 'tui') {
    const name = flags.name || 'untitled'
    const out = resolveOutputPath({ project: flags.project, name, out: flags.out })
    const state = { mode: 'default', clear: 0, sprites: {}, frames: [] }
    await runTui(state, out)
    return 0
  }
  if (cmd === 'demo') {
    const name = flags.name || 'blinking-heart'
    const out = resolveOutputPath({ project: flags.project || 'demos', name, out: flags.out })
    await mkdir(dirname(out), { recursive: true })
    // Two-frame blink between a filled heart and its outline.
    const heart = {
      w: 7, h: 6, grid: [
        [null, 8, 8, null, 8, 8, null],
        [8, 8, 8, 8, 8, 8, 8],
        [8, 8, 8, 8, 8, 8, 8],
        [null, 8, 8, 8, 8, 8, null],
        [null, null, 8, 8, 8, null, null],
        [null, null, null, 8, null, null, null],
      ],
    }
    const outline = {
      w: 7, h: 6, grid: [
        [null, 14, 14, null, 14, 14, null],
        [14, null, null, 14, null, null, 14],
        [14, null, null, null, null, null, 14],
        [null, 14, null, null, null, 14, null],
        [null, null, 14, null, 14, null, null],
        [null, null, null, 14, null, null, null],
      ],
    }
    const scene = {
      mode: 'default',
      clear: 0,
      sprites: { heart, outline },
      frames: [
        { sprite: 'heart',   x: 30, y: 30, dur: 0.30 },
        { sprite: 'outline', x: 30, y: 30, dur: 0.15 },
        { sprite: 'heart',   x: 30, y: 30, dur: 0.30 },
        { sprite: 'outline', x: 30, y: 30, dur: 0.15 },
      ],
    }
    await writeFile(out, emitScheme(scene, { name }))
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
    else if (a.startsWith('--')) throw new Error(`unknown flag: ${a}`)
    else flags._.push(a)
  }
  return flags
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main(process.argv.slice(2))
    .then((code) => process.exit(code ?? 0))
    .catch((err) => {
      process.stderr.write(`animator: ${err.stack || err.message}\n`)
      process.exit(1)
    })
}
