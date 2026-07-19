#!/usr/bin/env node
/*
 * render-diagrams.mjs — transform ::: diagram fences in Markdown
 * into rendered <figure class="diagram">...</figure> blocks.
 *
 * Ported from sakura-scheme (Lane C, book-pretty pass, 2026-07-10).
 * Fully generic — no dialect branding leaks into the DSL.
 *
 * DSL choice
 * ==========
 * Two accepted body forms inside the fence:
 *
 *   (1) raw SVG source - anything starting with `<svg` is passed through
 *       verbatim after we assert the tokens.css palette contract.
 *
 *   (2) mini-DSL "diagram-dsl" - one directive per line. Small, obvious,
 *       and covers ~80% of book diagrams without hand-rolling SVG.
 *
 *       viewBox 0 0 640 260             (optional; default 0 0 640 260)
 *       use kit#hand-drawn-defs
 *       box       name=parser  at=40,60   w=160 h=64  label="parser"
 *       box*      name=interp  at=240,60  w=160 h=64  label="interpreter"  (emph)
 *       arrow     from=parser  to=interp  style=solid|dashed|double
 *       callout   at=440,60    text="hot path"
 *       group     at=20,20     w=420 h=160  label="core"
 *       actor     at=520,80    label="operator"
 *       code      at=40,180    w=280 h=60   text="(car (cdr xs))"
 *       layer     at=40,20     w=260 h=90   label="L1 - reasoners"
 *       label     at=200,40    text="dispatcher"           class=emphasized|small|accent
 *       text      at=x,y       text="..."                  (alias for label)
 *
 *       Names on boxes are used as endpoints for arrows; the renderer
 *       resolves centre-points automatically.
 *
 * Fence syntax
 * ============
 *
 *   ::: diagram slug=dispatcher-graph caption="How dispatch flows"
 *   viewBox 0 0 640 260
 *   box  name=reader  at=40,80  w=160 h=64 label="reader"
 *   box  name=interp  at=240,80 w=160 h=64 label="interp"
 *   arrow from=reader to=interp
 *   :::
 *
 * or
 *
 *   ::: diagram slug=my-diagram caption="Raw SVG example"
 *   <svg viewBox="0 0 400 200" xmlns="http://www.w3.org/2000/svg">
 *     <use href="/theme/diagrams/kit.svg#hand-drawn-defs"/>
 *     <use href="/theme/diagrams/kit.svg#box-plain" x="20" y="20"/>
 *   </svg>
 *   :::
 *
 * Output shape
 * ============
 *   <figure class="diagram" id="dispatcher-graph">
 *     <svg ...>...</svg>
 *     <figcaption class="diagram-caption">How dispatch flows</figcaption>
 *   </figure>
 *
 * Public API
 * ==========
 *   renderDiagramFences(markdown: string): string
 *   renderDiagramBody(body: string, {slug, caption, legend?}): string
 *   compileDsl(dslSource: string): string      // returns inner-SVG body
 *
 * CLI
 * ===
 *   node scripts/render-diagrams.mjs INPUT.md > OUTPUT.md
 *   node scripts/render-diagrams.mjs --dsl INPUT.dsl > OUTPUT.svg
 */

import fs from 'node:fs'

// ------------------------------------------------------------
// Fence parsing
// ------------------------------------------------------------

const FENCE_OPEN = /^:::\s*diagram\b(.*)$/
const FENCE_CLOSE = /^:::\s*$/

/**
 * Parse the header attribute string:
 *   slug=foo caption="a b c" legend=yes
 * into an object.
 */
function parseHeaderAttrs (rest) {
  return parseInlineAttrs(rest)
}

export function renderDiagramFences (markdown) {
  const lines = markdown.split('\n')
  const out = []
  let i = 0
  while (i < lines.length) {
    const openMatch = lines[i].match(FENCE_OPEN)
    if (!openMatch) {
      out.push(lines[i])
      i += 1
      continue
    }
    const attrs = parseHeaderAttrs(openMatch[1])
    const body = []
    i += 1
    while (i < lines.length && !FENCE_CLOSE.test(lines[i])) {
      body.push(lines[i])
      i += 1
    }
    // consume closing fence (or EOF)
    if (i < lines.length) i += 1
    out.push(renderDiagramBody(body.join('\n'), attrs))
  }
  return out.join('\n')
}

// ------------------------------------------------------------
// renderDiagramBody
// ------------------------------------------------------------

export function renderDiagramBody (body, opts = {}) {
  const trimmed = body.trim()
  let inner
  if (trimmed.startsWith('<svg')) {
    inner = trimmed
  } else {
    inner = compileDsl(trimmed)
  }
  const slug = opts.slug ? ` id="${escapeHtml(opts.slug)}"` : ''
  const caption = opts.caption
    ? `\n  <figcaption class="diagram-caption">${escapeHtml(opts.caption)}</figcaption>`
    : ''
  return `<figure class="diagram"${slug}>\n  ${inner}${caption}\n</figure>`
}

// ------------------------------------------------------------
// Mini-DSL compiler
// ------------------------------------------------------------

const KIT_HREF = '/theme/diagrams/kit.svg'

export function compileDsl (source) {
  const lines = source.split('\n').map(s => s.trim()).filter(Boolean)
  let viewBox = '0 0 640 260'
  const nodes = []       // {kind, name?, x, y, w?, h?, label?, text?, cls?, style?}
  const arrows = []      // {fromName?, toName?, fromXY?, toXY?, style}
  const raw = []         // pre-serialised extras

  for (const line of lines) {
    if (line.startsWith('#')) continue // comment
    const [head, ...restToks] = line.split(/\s+/)
    const rest = restToks.join(' ')
    const attrs = parseInlineAttrs(rest)
    switch (head) {
      case 'viewBox': {
        viewBox = restToks.join(' ')
        break
      }
      case 'use': {
        // kit#foo - registration is a no-op; kept for readability
        break
      }
      case 'box':
      case 'box*': {
        const emph = head === 'box*'
        const [x, y] = parseXY(attrs.at)
        const w = num(attrs.w, 160), h = num(attrs.h, 64)
        nodes.push({ kind: emph ? 'box-emphasized' : 'box-plain',
                     name: attrs.name, x, y, w, h, label: attrs.label })
        break
      }
      case 'group': {
        const [x, y] = parseXY(attrs.at)
        const w = num(attrs.w, 320), h = num(attrs.h, 180)
        nodes.push({ kind: 'dashed-group', x, y, w, h, label: attrs.label })
        break
      }
      case 'callout': {
        const [x, y] = parseXY(attrs.at)
        nodes.push({ kind: 'callout-tag', x, y, w: num(attrs.w, 120), h: num(attrs.h, 28),
                     text: attrs.text })
        break
      }
      case 'actor': {
        const [x, y] = parseXY(attrs.at)
        nodes.push({ kind: 'actor-figure', x, y, w: num(attrs.w, 40), h: num(attrs.h, 72),
                     label: attrs.label })
        break
      }
      case 'code': {
        const [x, y] = parseXY(attrs.at)
        nodes.push({ kind: 'code-embed', x, y, w: num(attrs.w, 220), h: num(attrs.h, 80),
                     text: attrs.text })
        break
      }
      case 'layer': {
        const [x, y] = parseXY(attrs.at)
        nodes.push({ kind: 'layer-plane', x, y, w: num(attrs.w, 260), h: num(attrs.h, 100),
                     label: attrs.label })
        break
      }
      case 'arrow': {
        arrows.push({
          fromName: attrs.from,
          toName: attrs.to,
          fromXY: attrs.fromXY ? parseXY(attrs.fromXY) : undefined,
          toXY: attrs.toXY ? parseXY(attrs.toXY) : undefined,
          style: attrs.style || 'solid'
        })
        break
      }
      case 'label':
      case 'text': {
        const [x, y] = parseXY(attrs.at)
        raw.push(textEl(x, y, attrs.text || '', attrs.class))
        break
      }
      default:
        // unknown directive - ignored on purpose so authors can experiment
        break
    }
  }

  // Resolve arrow endpoints against named boxes.
  const byName = Object.fromEntries(
    nodes.filter(n => n.name).map(n => [n.name, n])
  )
  const arrowSvg = arrows.map(a => {
    const from = a.fromXY || centre(byName[a.fromName])
    const to   = a.toXY   || centre(byName[a.toName])
    if (!from || !to) return ''
    return arrowPath(from, to, a.style)
  }).join('\n  ')

  // Emit nodes.
  const nodeSvg = nodes.map(n => nodeToSvg(n)).join('\n  ')

  return `<svg viewBox="${viewBox}" xmlns="http://www.w3.org/2000/svg" role="img">
  <use href="${KIT_HREF}#hand-drawn-defs"/>
  ${nodeSvg}
  ${arrowSvg}
  ${raw.join('\n  ')}
</svg>`
}

// -------- helpers --------

function parseInlineAttrs (s) {
  const out = {}
  const re = /(\w[\w-]*)\s*=\s*(?:"([^"]*)"|([^\s"]+))/g
  let m
  while ((m = re.exec(s))) {
    out[m[1]] = m[2] !== undefined ? m[2] : m[3]
  }
  return out
}

function parseXY (s) {
  if (!s) return [0, 0]
  const [a, b] = s.split(',').map(t => t.trim())
  return [num(a, 0), num(b, 0)]
}

function num (v, d) {
  const n = Number(v)
  return Number.isFinite(n) ? n : d
}

function centre (n) {
  if (!n) return null
  return [n.x + (n.w || 0) / 2, n.y + (n.h || 0) / 2]
}

function nodeToSvg (n) {
  const w = n.w || naturalW(n.kind)
  const h = n.h || naturalH(n.kind)
  const usePart = `<use href="${KIT_HREF}#${n.kind}" x="${n.x}" y="${n.y}" width="${w}" height="${h}"/>`
  const cx = n.x + w / 2
  const cy = n.y + h / 2
  const labelPart = n.label
    ? textEl(cx, cy + 4, n.label, n.kind === 'box-emphasized' ? 'label-emphasized' : null, 'middle')
    : ''
  const textPart = n.text && (n.kind === 'callout-tag' || n.kind === 'code-embed')
    ? textEl(n.x + (n.kind === 'code-embed' ? 12 : w / 2 - 8),
             n.y + (n.kind === 'code-embed' ? 40 : h / 2 + 4),
             n.text, n.kind === 'code-embed' ? 'code' : null,
             n.kind === 'code-embed' ? 'start' : 'middle')
    : ''
  const actorLabelPart = n.kind === 'actor-figure' && n.label
    ? textEl(cx, n.y + h + 12, n.label, 'label-small', 'middle')
    : ''
  const layerLabelPart = n.kind === 'layer-plane' && n.label
    ? textEl(n.x + 40, n.y + h / 2 + 4, n.label, null, 'start')
    : ''
  const groupLabelPart = n.kind === 'dashed-group' && n.label
    ? textEl(n.x + 10, n.y + 16, n.label, 'label-small', 'start')
    : ''
  return [usePart,
          n.kind === 'callout-tag' || n.kind === 'code-embed' ? textPart : labelPart,
          actorLabelPart, layerLabelPart, groupLabelPart]
         .filter(Boolean).join(' ')
}

function naturalW (kind) {
  return ({ 'box-plain': 160, 'box-emphasized': 160, 'callout-tag': 120,
            'dashed-group': 320, 'actor-figure': 40, 'code-embed': 220,
            'layer-plane': 260 })[kind] || 100
}
function naturalH (kind) {
  return ({ 'box-plain': 64, 'box-emphasized': 64, 'callout-tag': 28,
            'dashed-group': 180, 'actor-figure': 72, 'code-embed': 80,
            'layer-plane': 100 })[kind] || 60
}

function textEl (x, y, text, cls, anchor = 'middle') {
  const c = cls ? ` class="${cls}"` : ''
  const a = ` text-anchor="${anchor}"`
  return `<text x="${x}" y="${y}"${a}${c}>${escapeXml(text)}</text>`
}

function arrowPath (from, to, style) {
  const marker = style === 'double' ? 'arrow-head' : (style === 'dashed' ? 'arrow-head-open' : 'arrow-head')
  const dash = style === 'dashed' ? ' stroke-dasharray="6 4"' : ''
  const startMarker = style === 'double' ? ` marker-start="url(#${marker})"` : ''
  return `<line x1="${from[0]}" y1="${from[1]}" x2="${to[0]}" y2="${to[1]}" ` +
    `stroke="#1A1626" stroke-width="1.5"${dash}` +
    `${startMarker} marker-end="url(#${marker})" filter="url(#hand-drawn)"/>`
}

function escapeHtml (s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}
function escapeXml (s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

// ------------------------------------------------------------
// CLI
// ------------------------------------------------------------
if (import.meta.url === `file://${process.argv[1]}`) {
  const args = process.argv.slice(2)
  const dslMode = args.includes('--dsl')
  const inputArg = args.find(a => !a.startsWith('-'))
  if (!inputArg) {
    process.stderr.write('usage: render-diagrams.mjs [--dsl] INPUT\n')
    process.exit(2)
  }
  const src = fs.readFileSync(inputArg, 'utf8')
  if (dslMode) {
    process.stdout.write(compileDsl(src) + '\n')
  } else {
    process.stdout.write(renderDiagramFences(src))
  }
}
