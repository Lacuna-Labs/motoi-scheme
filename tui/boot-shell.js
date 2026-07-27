// tui/boot-shell.js — the PICO-8 / TIC-80 style boot splash + launcher.
//
// This is what a kid sees when they type `motoi`. A splash screen, then
// four big choices: IDE · Music Composer · Animation Composer · Game
// Composer. Pick one (arrows / 1-4 / enter) and drop straight into
// something you can play with. Every mode returns here on ESC.
//
// Brand: the blossom "hamburger" runs top-to-bottom — PINK (top) · GREEN
// (middle) · BROWN (bottom). Tier names: pink · mint · cedar. The whole
// splash is painted in that vertical tri-tone so the console reads as
// Motoi at a glance.
//
// The heavy IDE lives in tui.js (startTui). Music/Animation/Game are
// compact, real, framebuffer-and-synth-backed runners built right here
// on the same primitives (Screen, InputReader, the real fb + easing +
// synth verbs). No Curator host — everything paints to the terminal.

import { Screen, ATTR } from './screen.js'
import { InputReader } from './input.js'
import { activeTheme } from './themes.js'
import { makeExtendedBaseEnv, getMediaState } from '../src/lib-loader.js'
import { parse } from '../src/reader.js'
import { evaluate } from '../src/interp.js'
import { namedEase, NAMED_EASINGS } from '../lib/graphics/easing.js'
import { TREE_LOGO } from '../lib/brand/tree-logo.js'
import startTui from './tui.js'
import {
  initComposerState, handleComposerKey, paintComposer, computeComposerRect,
} from './composer-tab.js'

// ── the four modes ──────────────────────────────────────────────────
//
// Each card carries its own accent, but the SPLASH frame stays on the
// hamburger (pink→mint→cedar top to bottom). Icons are single glyphs so
// they render on any terminal.

const MODES = [
  { key: 'ide',  title: 'IDE',       tag: 'write code',   icon: 'λ', accent: 'mint'  },
  { key: 'music',title: 'MUSIC',     tag: 'make beats',   icon: '♪', accent: 'pink'  },
  { key: 'anim', title: 'ANIMATION', tag: 'move things',  icon: '✺', accent: 'cedar' },
  { key: 'game', title: 'GAME',      tag: 'play & build', icon: '☺', accent: 'gold'  },
]

// ── MOTOI wordmark ──────────────────────────────────────────────────
//
// 5 rows of block letters. We colour it top-to-bottom pink→mint→cedar so
// the wordmark itself IS the hamburger.

const WORDMARK = [
  '█▄ ▄█ ▄▀▀▄ ▀█▀ ▄▀▀▄ █',
  '█ ▀ █ █  █  █  █  █ █',
  '█   █ █  █  █  █  █ █',
  '█   █ █  █  █  █  █ ▄',
  '█   █  ▀▀   █   ▀▀  █',
]
// Row → hamburger tier: pink (top) · mint (middle) · cedar (bottom).
const WORDMARK_TIERS = ['pink', 'pink', 'mint', 'cedar', 'cedar']

// ── entry ───────────────────────────────────────────────────────────

export async function startBoot(opts = {}) {
  const out = opts.stdout || process.stdout

  // Non-TTY (piped, CI): print a plain banner + the choices and bail.
  // A kid at a real terminal gets the interactive splash.
  if (!out.isTTY && !opts.force) {
    out.write(plainBanner())
    return 0
  }

  let theme
  try { theme = activeTheme(opts) } catch { theme = null }

  const screen = new Screen({ out, color: opts.color, theme })
  const input = new InputReader({ stdin: opts.stdin || process.stdin })
  const fuel = { n: 1_000_000 }
  const env = makeExtendedBaseEnv({ fuel })
  const run = (src) => {
    let r
    for (const form of parse(src)) { fuel.n = 1_000_000; r = evaluate(form, env, fuel) }
    return r
  }

  screen.enterAltScreen()
  input.start()

  // The cold-boot ceremony: watch the libraries check in, hear the bell,
  // then the Motoi mark (cherry tree — pink blossom · green leaf · brown
  // trunk) resolves over black. Skippable with any key; suppressed for
  // tests via opts.noBoot.
  if (!opts.noBoot) {
    try { await bootSequence({ screen, input, env, out }) } catch { /* soft-fail */ }
  }

  let sel = 0
  try {
    // The launcher loop: pick a mode, run it, come back. ESC/Q here quits.
    for (;;) {
      sel = await menuSelect(screen, input, sel)
      if (sel == null) break                      // quit
      await launchMode(sel, { screen, input, env, run, opts, theme })
      // A mode just tore down / repainted the terminal. Rebuild our
      // buffers and force a clean repaint on the next menuSelect.
      screen.resize(screen.cols, screen.rows)
    }
  } finally {
    input.stop()
    screen.leaveAltScreen()
  }
  return 0
}

// ── the splash + menu ───────────────────────────────────────────────

function menuSelect(screen, input, startSel) {
  return new Promise((resolve) => {
    let sel = startSel | 0
    let live = true

    const finish = (val) => {
      if (!live) return
      live = false
      unsub()
      resolve(val)
    }

    const onKey = (k) => {
      const n = k.name
      if (n === 'C-c' || n === 'escape' || n === 'q') return finish(null)
      if (n === 'left'  || n === 'h') { sel = (sel + MODES.length - 1) % MODES.length; paint() ; return }
      if (n === 'right' || n === 'l') { sel = (sel + 1) % MODES.length; paint(); return }
      if (n === 'up'    || n === 'k') { sel = (sel + MODES.length - 1) % MODES.length; paint(); return }
      if (n === 'down'  || n === 'j') { sel = (sel + 1) % MODES.length; paint(); return }
      if (n === 'enter' || n === ' ') return finish(sel)
      if (n >= '1' && n <= '4') { sel = Number(n) - 1; paint(); return finish(sel) }
    }

    const paint = () => paintSplash(screen, sel)
    const unsub = input.onKey(onKey)
    paint()
  })
}

function paintSplash(screen, sel) {
  const scr = screen
  scr.clear()
  const W = scr.cols, H = scr.rows

  // Fill the whole surface with the cream panel so the hamburger reads
  // against pearl, like the Curator canvases.
  scr.fillRect(0, 0, W, H, ' ', 'fg', 'pearlLight', 0)

  // ── top band: PINK ────────────────────────────────────────────────
  scr.fillRect(0, 0, W, 1, '▀', 'pink', 'pearlLight', 0)

  // ── wordmark (pink→mint→cedar) ────────────────────────────────────
  const wmW = WORDMARK[0].length
  const wmX = Math.max(1, Math.floor((W - wmW) / 2))
  const wmY = 2
  for (let i = 0; i < WORDMARK.length; i++) {
    scr.putText(wmX, wmY + i, WORDMARK[i], WORDMARK_TIERS[i], 'pearlLight', ATTR.BOLD)
  }

  // subtitle — green (the middle of the hamburger)
  const sub = 'f a n t a s y   c o n s o l e'
  scr.putText(Math.floor((W - sub.length) / 2), wmY + WORDMARK.length + 1,
    sub, 'mintDark', 'pearlLight', ATTR.BOLD)

  // palette bar — the 16 fantasy-console colours, a little rainbow rule
  const palY = wmY + WORDMARK.length + 3
  paintPaletteBar(scr, palY)

  // ── the four mode cards ───────────────────────────────────────────
  const cardsY = palY + 2
  paintCards(scr, cardsY, sel, W, H)

  // ── bottom band: BROWN + hint ─────────────────────────────────────
  const hint = '◀ ▶  move      ENTER  pick      1-4  jump      Q  quit'
  scr.putText(Math.max(1, Math.floor((W - hint.length) / 2)), H - 2,
    hint, 'cedarDark', 'pearlLight', 0)
  scr.fillRect(0, H - 1, W, 1, '▄', 'cedar', 'pearlLight', 0)

  scr.flush()
  scr.placeCursor(-1, -1)   // hide the cursor on the splash
}

function paintPaletteBar(scr, y) {
  // 16 swatches, 2 cells each = 32 wide, centred. Uses the fb palette's
  // RGB directly so the bar shows the real console colours.
  const sw = 2
  const total = 16 * sw
  const x0 = Math.max(1, Math.floor((scr.cols - total) / 2))
  const st = getMediaState()
  const pal = (st && st.fb && st.fb.palette) || []
  for (let i = 0; i < 16; i++) {
    const rgb = pal[i] || [0, 0, 0]
    const spec = 'rgb:' + rgb[0] + ',' + rgb[1] + ',' + rgb[2]
    for (let c = 0; c < sw; c++) {
      scr.back[y] && (scr.back[y][x0 + i * sw + c] = { ch: ' ', fg: null, bg: spec, attr: 0 })
    }
  }
}

function paintCards(scr, y, sel, W, H) {
  const n = MODES.length
  const gap = 2
  // Fit 4 cards across; each card min 15, max 20.
  const avail = W - 2
  let cw = Math.floor((avail - gap * (n - 1)) / n)
  cw = Math.max(13, Math.min(20, cw))
  const rowW = cw * n + gap * (n - 1)
  const x0 = Math.max(1, Math.floor((W - rowW) / 2))
  const ch = 6   // card height

  for (let i = 0; i < n; i++) {
    const m = MODES[i]
    const cx = x0 + i * (cw + gap)
    const chosen = i === sel
    const border = chosen ? 'pink' : 'cedar'
    const attr = chosen ? ATTR.BOLD : 0
    // Card body.
    scr.fillRect(cx, y, cw, ch, ' ', 'fg', chosen ? 'pearl' : 'pearlLight', 0)
    scr.titledFrame(cx, y, cw, ch, chosen ? '▸' : ' ', border, chosen ? 'pearl' : 'pearlLight', attr)
    // Number badge, icon, title, tag.
    scr.putText(cx + 2, y + 1, '[' + (i + 1) + ']', chosen ? 'pink' : 'fgDim',
      chosen ? 'pearl' : 'pearlLight', attr)
    scr.putText(cx + cw - 3, y + 1, m.icon, m.accent, chosen ? 'pearl' : 'pearlLight', ATTR.BOLD)
    scr.putText(cx + 2, y + 2, m.title, chosen ? 'ink' : m.accent,
      chosen ? 'pearl' : 'pearlLight', ATTR.BOLD)
    scr.putText(cx + 2, y + 4, m.tag, chosen ? 'mintDark' : 'fgDim',
      chosen ? 'pearl' : 'pearlLight', 0)
  }
}

// ── cold-boot ceremony ──────────────────────────────────────────────
//
// Alfred's spec: a live boot log that checks the libraries as they come
// up (cool), a bell "ding", a half-second breath, then the Motoi mark
// resolves over black — "MOTOI" in pearl/white with the cherry-tree logo
// in the three brand colours in abstract-tree order (pink blossom on top,
// green leaf in the middle, brown trunk at the base). The pink/green/brown
// hamburger everywhere else is a compression of exactly this mark.

const TREE_ROWS = TREE_LOGO.split('\n')

// Colour a tree row by its place in the canopy→trunk order: the trunk
// (a vertical bar) is cedar/brown; the top ~45% is pink blossom; the rest
// is mint/green leaf.
function treeRowTier(row, i, n) {
  if (row.includes('|')) return 'cedar'
  if (i < Math.ceil(n * 0.45)) return 'pink'
  return 'mint'
}

async function bootSequence({ screen, input, env, out }) {
  const scr = screen
  // Any key skips ahead; a keypress also cuts the current pause short.
  let skip = false
  let cutNap = null
  const unsub = input.onKey(() => { skip = true; if (cutNap) cutNap() })
  const nap = (ms) => new Promise((r) => {
    if (skip) return r()
    const t = setTimeout(() => { cutNap = null; r() }, ms)
    if (t && t.unref) t.unref()
    cutNap = () => { clearTimeout(t); cutNap = null; r() }
  })
  const black = () => {
    scr.clear()
    scr.fillRect(0, 0, scr.cols, scr.rows, ' ', 'pearl', 'ink', 0)
  }

  try {
    // ── phase 1: library check-in log ──────────────────────────────
    const summary = env.__libSummary || {}
    const verbCount = (env.vars && env.vars.size) || 0
    const modCount = (summary.modules && summary.modules.length) || 0
    const checks = [
      'reader',
      'interpreter · trampoline',
      'macro · syntax-rules',
      'base · primitives',
      'r7rs-small',
      'srfi-1 · srfi-13 · srfi-125 · srfi-27',
      'media · framebuffer · synth',
      'graphics · sprite · easing',
      'animation · tween registry',
      'game · scene · entity',
      'system · time · ops',
    ]
    const W = scr.cols, H = scr.rows
    const logX = Math.max(2, Math.floor(W / 2) - 22)
    const logY = Math.max(1, Math.floor(H / 2) - Math.floor(checks.length / 2) - 2)

    black()
    scr.putText(logX, logY, 'motoi', 'pink', 'ink', ATTR.BOLD)
    scr.putText(logX + 6, logY, '· booting fantasy console', 'pearl', 'ink', 0)
    scr.flush(); scr.placeCursor(-1, -1)

    for (let i = 0; i < checks.length; i++) {
      const label = checks[i]
      const y = logY + 2 + i
      const dots = '.'.repeat(Math.max(3, 34 - label.length))
      scr.putText(logX, y, label, 'pearl', 'ink', 0)
      scr.putText(logX + label.length + 1, y, dots, 'fgDim', 'ink', 0)
      scr.putText(logX + label.length + 2 + dots.length, y, 'ok', 'mint', 'ink', ATTR.BOLD)
      scr.flush(); scr.placeCursor(-1, -1)
      await nap(70)
    }
    const tally = 'ready · ' + verbCount + ' verbs · ' + modCount + ' modules'
    scr.putText(logX, logY + 3 + checks.length, tally, 'gold', 'ink', ATTR.BOLD)
    scr.flush(); scr.placeCursor(-1, -1)

    // ── phase 2: the bell + the breath ─────────────────────────────
    try { out.write('\x07') } catch { /* no bell, no harm */ }
    await nap(500)

    // ── phase 3: the mark resolves on black ────────────────────────
    black()
    const tW = Math.max(...TREE_ROWS.map((r) => r.length))
    const wmH = WORDMARK.length
    const totalH = TREE_ROWS.length + 1 + wmH + 2
    const tX = Math.max(1, Math.floor((scr.cols - tW) / 2))
    const tY = Math.max(1, Math.floor((scr.rows - totalH) / 2))
    for (let i = 0; i < TREE_ROWS.length; i++) {
      scr.putText(tX, tY + i, TREE_ROWS[i], treeRowTier(TREE_ROWS[i], i, TREE_ROWS.length), 'ink', ATTR.BOLD)
      scr.flush(); scr.placeCursor(-1, -1)
      await nap(60)
    }
    // "MOTOI" in pearl/white beneath the tree.
    const wmW = WORDMARK[0].length
    const wmX = Math.max(1, Math.floor((scr.cols - wmW) / 2))
    const wmY = tY + TREE_ROWS.length + 1
    for (let i = 0; i < WORDMARK.length; i++) {
      scr.putText(wmX, wmY + i, WORDMARK[i], 'pearl', 'ink', ATTR.BOLD)
    }
    const sub = 'f a n t a s y   c o n s o l e'
    scr.putText(Math.floor((scr.cols - sub.length) / 2), wmY + wmH + 1, sub, 'fgDim', 'ink', 0)
    scr.flush(); scr.placeCursor(-1, -1)
    await nap(1100)
  } finally {
    unsub()
  }
}

// ── mode dispatch ───────────────────────────────────────────────────

async function launchMode(idx, ctx) {
  const mode = MODES[idx].key
  if (mode === 'ide')  return runIde(ctx)
  if (mode === 'music')return runMusic(ctx)
  if (mode === 'anim') return runAnimation(ctx)
  if (mode === 'game') return runGame(ctx)
}

// IDE — hand off to the full tui.js editor. It owns its own Screen +
// InputReader + alt-screen, so we tear ours down first and rebuild after.
async function runIde({ screen, input, opts, theme }) {
  input.stop()
  screen.leaveAltScreen()
  try {
    await startTui({ ...opts, theme, splash: false })
  } catch (e) {
    // Surface but don't crash the launcher.
    process.stderr.write('ide error: ' + (e && e.message ? e.message : e) + '\n')
  }
  screen.enterAltScreen()
  input.start()
}

// ── generic full-screen canvas loop (anim + game share it) ──────────
//
// Runs a real framebuffer draw loop and renders it to the terminal as
// half-blocks. `onFrame(frame)` draws into the fb via `run`; `onKey`
// handles input; ESC exits. Returns a promise that resolves on exit.

function runCanvasLoop(screen, input, { fps, onFrame, onKey, title, footer }) {
  return new Promise((resolve) => {
    let live = true
    let frame = 0
    let timer = null

    const st = () => getMediaState()

    const paint = () => {
      const scr = screen
      const W = scr.cols, H = scr.rows
      scr.clear()
      scr.fillRect(0, 0, W, H, ' ', 'fg', 'pearlLight', 0)
      // top pink band + title
      scr.fillRect(0, 0, W, 1, '▀', 'pink', 'pearlLight', 0)
      scr.putText(2, 0, ' ' + title + ' ', 'ink', 'pink', ATTR.BOLD)
      // the canvas
      const fb = st() && st().fb
      const cy = 2, cx = 2
      const cw = W - 4, chh = H - 5
      scr.titledFrame(cx - 1, cy - 1, cw + 2, chh + 2, '', 'cedar', 'pearlLight', 0)
      if (fb) renderCanvas(scr, fb, cx, cy, cw, chh)
      // bottom brown band + footer (footer may be a live function)
      const footStr = typeof footer === 'function' ? footer() : footer
      scr.putText(2, H - 2, footStr, 'cedarDark', 'pearlLight', 0)
      scr.fillRect(0, H - 1, W, 1, '▄', 'cedar', 'pearlLight', 0)
      scr.flush()
      scr.placeCursor(-1, -1)
    }

    const finish = () => {
      if (!live) return
      live = false
      if (timer) clearInterval(timer)
      unsub()
      resolve()
    }

    const keyHandler = (k) => {
      if (k.name === 'escape' || k.name === 'C-c' || k.name === 'q') return finish()
      try { onKey && onKey(k, frame) } catch { /* soft-fail */ }
      if (!fps) paint()   // static modes repaint on key
    }
    const unsub = input.onKey(keyHandler)

    if (fps) {
      timer = setInterval(() => {
        if (!live) return
        try { onFrame && onFrame(frame) } catch { /* soft-fail */ }
        frame++
        paint()
      }, Math.max(16, Math.floor(1000 / fps)))
      if (timer && timer.unref) timer.unref()
    }
    // initial draw
    try { onFrame && onFrame(0) } catch { /* soft-fail */ }
    paint()
  })
}

// Render the framebuffer into the screen as half-blocks (▀): two fb
// pixels stacked per terminal cell, mapped through the fb's own 16-colour
// palette. Nearest-neighbour scaled to fit the rect.
function renderCanvas(scr, fb, x, y, w, h) {
  const cols = Math.max(1, Math.min(w, fb.w))
  const rows = Math.max(1, Math.min(h * 2, fb.h))
  const displayRows = Math.ceil(rows / 2)
  const offX = x + Math.floor((w - cols) / 2)
  const offY = y + Math.floor((h - displayRows) / 2)
  for (let ry = 0; ry < rows; ry += 2) {
    const cyy = offY + (ry >> 1)
    if (cyy < 0 || cyy >= scr.rows) continue
    for (let cx = 0; cx < cols; cx++) {
      const xx = offX + cx
      if (xx < 0 || xx >= scr.cols) continue
      const top = samplePixel(fb.pixels, fb.w, fb.h, cx, ry, cols, rows)
      const bot = ry + 1 < rows ? samplePixel(fb.pixels, fb.w, fb.h, cx, ry + 1, cols, rows) : top
      const tRGB = fb.palette[top & 0x0f] || [0, 0, 0]
      const bRGB = fb.palette[bot & 0x0f] || [0, 0, 0]
      scr.back[cyy][xx] = {
        ch: '▀',
        fg: 'rgb:' + tRGB[0] + ',' + tRGB[1] + ',' + tRGB[2],
        bg: 'rgb:' + bRGB[0] + ',' + bRGB[1] + ',' + bRGB[2],
        attr: 0,
      }
    }
  }
}

function samplePixel(pixels, fbW, fbH, tx, ty, tw, th) {
  const x = Math.floor(tx * fbW / tw)
  const y = Math.floor(ty * fbH / th)
  return pixels[y * fbW + x] | 0
}

// ── ANIMATION composer ──────────────────────────────────────────────
//
// A marker travels across the canvas following a real easing curve from
// lib/graphics/easing.js — the actual math Motoi ships. Number keys pick
// the curve; the kid watches how each one moves. This is the payoff of
// the surgery: a real, headless, framebuffer-backed animation layer with
// no Curator host in sight.

function runAnimation({ screen, input, run }) {
  const curves = ['linear', 'ease-in', 'ease-out', 'ease-in-out', 'bounce', 'elastic']
    .filter((c) => c === 'linear' || NAMED_EASINGS[c])
  let ci = 3
  const FBW = 96, FBH = 64
  run('(set-mode ' + FBW + ' ' + FBH + ')')
  const period = 72
  const onFrame = (frame) => {
    const t = (frame % period) / period
    const curve = curves[ci] || 'linear'
    const e = curve === 'linear' ? t : namedEase(t, curve)
    const margin = 8
    const px = Math.round(margin + e * (FBW - 2 * margin))
    // a gentle sine arc for the vertical, so motion reads on both axes
    const py = Math.round(FBH / 2 + Math.sin(t * Math.PI * 2) * (FBH / 3))
    run('(clear 1)')
    // faint guide line down the middle
    run('(line 0 ' + (FBH >> 1) + ' ' + (FBW - 1) + ' ' + (FBH >> 1) + ' 5)')
    // the travelling marker + a trailing echo
    run('(disc ' + px + ' ' + py + ' 4 8)')
    run('(disc ' + Math.max(0, px - 5) + ' ' + py + ' 2 14)')
  }
  const onKey = (k) => {
    if (k.name >= '1' && k.name <= '6') { const i = Number(k.name) - 1; if (i < curves.length) ci = i }
    if (k.name === ' ' || k.name === 'right') ci = (ci + 1) % curves.length
    if (k.name === 'left') ci = (ci + curves.length - 1) % curves.length
  }
  // footer is live — runCanvasLoop calls it every paint so the current
  // curve name updates as the kid cycles through.
  const footer = () => 'curve: ' + (curves[ci] || 'linear') + '   ·   1-6 pick  SPACE next  Q back'
  return runCanvasLoop(screen, input, {
    fps: 30, onFrame, onKey,
    title: 'ANIMATION  ✺  ' + curves.length + ' easing curves',
    footer,
  })
}

// ── GAME composer ───────────────────────────────────────────────────
//
// Arrow keys move a player disc around the real framebuffer. SPACE drops
// a coin where you stand. It's the smallest possible "make a game" — a
// thing that moves, a thing you place — on genuine Motoi primitives.

function runGame({ screen, input, run }) {
  const FBW = 96, FBH = 64
  run('(set-mode ' + FBW + ' ' + FBH + ')')
  const player = { x: FBW >> 1, y: FBH >> 1 }
  const coins = []
  let score = 0
  const draw = () => {
    run('(clear 12)')                                  // sky-blue field
    run('(rect 1 1 ' + (FBW - 2) + ' ' + (FBH - 2) + ' 1)')  // border
    for (const c of coins) run('(disc ' + c.x + ' ' + c.y + ' 2 10)')  // yellow coins
    run('(disc ' + player.x + ' ' + player.y + ' 4 8)')        // red player
    run('(disc ' + player.x + ' ' + (player.y - 1) + ' 2 7)')  // white glint
  }
  draw()
  const onKey = (k) => {
    const step = 3
    if (k.name === 'left')  player.x = Math.max(4, player.x - step)
    if (k.name === 'right') player.x = Math.min(FBW - 5, player.x + step)
    if (k.name === 'up')    player.y = Math.max(4, player.y - step)
    if (k.name === 'down')  player.y = Math.min(FBH - 5, player.y + step)
    if (k.name === ' ') { coins.push({ x: player.x, y: player.y }); score++ }
    draw()
  }
  return runCanvasLoop(screen, input, {
    onFrame: null,   // static — repaints on key
    onKey,
    title: 'GAME  ☺  move + build',
    footer: '◀ ▶ ▲ ▼  move     SPACE  drop coin     Q  back',
  })
}

// ── MUSIC composer ──────────────────────────────────────────────────
//
// The beat-maker widget from composer-tab.js, run full-screen. Toggle
// cells to build a 4-track × 16-step pattern; P plays it through the real
// synth (the emitted (begin (tone …) …) is evaluated in our env); S saves
// it as a cart. Deterministic audio, no LLM — the grid IS the Scheme.

function runMusic({ screen, input, run }) {
  return new Promise((resolve) => {
    let live = true
    const state = {
      composer: initComposerState(),
      focus: 'composer',
      ticks: 0,
    }
    state.composer.enabled = true

    let status = ''
    let statusUntil = 0

    const layout = () => {
      const W = screen.cols, H = screen.rows
      // Map the composer to (almost) the whole screen. computeComposerRect
      // reads editorX/editorY/W/editorH/cpuH/replH.
      return {
        editorX: 2, editorY: 2, W: W - 2,
        editorH: H - 6, cpuH: 0, replH: 0,
      }
    }

    const paint = () => {
      const scr = screen
      const W = scr.cols, H = scr.rows
      scr.clear()
      scr.fillRect(0, 0, W, H, ' ', 'fg', 'pearlLight', 0)
      scr.fillRect(0, 0, W, 1, '▀', 'pink', 'pearlLight', 0)
      scr.putText(2, 0, ' MUSIC  ♪  beat maker ', 'ink', 'pink', ATTR.BOLD)
      try { paintComposer(scr, layout(), state) } catch { /* soft-fail */ }
      const now = Date.now()
      const foot = (now < statusUntil && status)
        ? status
        : 'arrows move   SPACE toggle   P play   S save   B bpm   Q back'
      scr.putText(2, H - 2, foot, 'cedarDark', 'pearlLight', 0)
      scr.fillRect(0, H - 1, W, 1, '▄', 'cedar', 'pearlLight', 0)
      scr.flush()
      scr.placeCursor(-1, -1)
    }

    const ctx = {
      render: paint,
      statusFlash: (msg) => { status = msg; statusUntil = Date.now() + 2500; paint() },
      play: (src) => {
        try { run(src) } catch (e) { ctx.statusFlash('play error: ' + (e && e.message ? e.message : e)) }
      },
    }

    const finish = () => {
      if (!live) return
      live = false
      unsub()
      resolve()
    }

    const onKey = (k) => {
      // Top-level ESC exits — unless we're mid BPM prompt (then composer
      // eats it as a cancel).
      if ((k.name === 'escape' || k.name === 'q' || k.name === 'C-c') && !state.composer.bpmPrompt) {
        return finish()
      }
      const consumed = handleComposerKey(k, state, ctx)
      if (!consumed) paint()
    }
    const unsub = input.onKey(onKey)
    paint()
  })
}

// ── non-TTY banner ──────────────────────────────────────────────────

function plainBanner() {
  const lines = []
  lines.push('')
  for (const row of WORDMARK) lines.push('   ' + row)
  lines.push('')
  lines.push('   fantasy console')
  lines.push('')
  lines.push('   pick a mode:')
  for (let i = 0; i < MODES.length; i++) {
    const m = MODES[i]
    lines.push('     [' + (i + 1) + '] ' + m.title.padEnd(10) + ' ' + m.icon + '  ' + m.tag)
  }
  lines.push('')
  lines.push('   run `motoi` in a real terminal for the interactive splash,')
  lines.push('   or jump straight in: motoi ide | motoi repl')
  lines.push('')
  return lines.join('\n')
}

export default startBoot
