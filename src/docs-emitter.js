// motoi-scheme — verb-metadata → Markdown reference emitter
//
// Reads the live verb registry and writes one .md file per verb
// (grouped by namespace) into an output directory, plus an index.md.
// Callers: `motoi docs regen`, `.lacuna/triggers.yaml` on
// verb-added, weekly cron on the doc site rebuild.

import { mkdir, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { snapshotRegistry } from './verbRegistry.js'

function slugify(name) {
  return name.replace(/[^\w./-]/g, '-').replace(/\//g, '/')
}

function mdForVerb(name, meta) {
  const lines = []
  lines.push(`# ${name}`)
  lines.push('')
  if (meta.doc) { lines.push(meta.doc); lines.push('') }
  if (meta.contract) { lines.push('## Contract'); lines.push('```'); lines.push(meta.contract); lines.push('```'); lines.push('') }
  if (meta.arity !== null && meta.arity !== undefined) { lines.push('## Arity'); lines.push('```'); lines.push(String(meta.arity)); lines.push('```'); lines.push('') }
  if (meta.examples?.length) {
    lines.push('## Examples')
    for (const ex of meta.examples) {
      lines.push(`### ${ex.level}`)
      lines.push('```scheme')
      lines.push(ex.code)
      lines.push('```')
      lines.push('')
    }
  }
  if (meta.namespace) { lines.push(`Namespace: \`${meta.namespace}\``); lines.push('') }
  if (meta.tier) { lines.push(`Tier: \`${meta.tier}\``); lines.push('') }
  if (meta.perm) { lines.push(`Permission: \`${meta.perm}\``); lines.push('') }
  if (meta.since) { lines.push(`Introduced in: \`${meta.since}\``); lines.push('') }
  if (meta.source) { lines.push(`Source: \`${meta.source}\``); lines.push('') }
  return lines.join('\n')
}

/**
 * Emit Markdown reference for every registered verb.
 *
 * @param {object} opts
 * @param {string} [opts.outDir='docs/reference'] — where to write files
 * @param {boolean} [opts.inline=false] — return one MD string instead of writing files
 * @returns {string[]|string} paths written, or the concatenated MD when inline
 */
export async function emitDocs(opts = {}) {
  const outDir = opts.outDir || 'docs/reference'
  const inline = opts.inline || false
  const registry = snapshotRegistry()
  const names = Object.keys(registry).sort()

  if (inline) {
    const chunks = []
    for (const name of names) {
      chunks.push(mdForVerb(name, registry[name]))
      chunks.push('\n---\n')
    }
    return chunks.join('\n')
  }

  const paths = []
  for (const name of names) {
    const meta = registry[name]
    const [ns, verb] = name.includes('/') ? name.split('/', 2) : ['', name]
    const rel = ns ? `${ns}/${verb}.md` : `${verb}.md`
    const abs = join(outDir, rel)
    await mkdir(dirname(abs), { recursive: true })
    await writeFile(abs, mdForVerb(name, meta), 'utf8')
    paths.push(abs)
  }

  // Also emit an index.md listing every verb by namespace.
  const idx = ['# Reference index', '']
  const byNs = {}
  for (const name of names) {
    const ns = name.includes('/') ? name.split('/', 2)[0] : ''
    ;(byNs[ns] = byNs[ns] || []).push(name)
  }
  for (const ns of Object.keys(byNs).sort()) {
    idx.push(`## ${ns || '(no namespace)'}`)
    for (const n of byNs[ns]) {
      const rel = n.includes('/') ? `${n.split('/', 2)[0]}/${n.split('/', 2)[1]}.md` : `${n}.md`
      idx.push(`- [\`${n}\`](./${rel})`)
    }
    idx.push('')
  }
  const idxPath = join(outDir, 'index.md')
  await mkdir(outDir, { recursive: true })
  await writeFile(idxPath, idx.join('\n'), 'utf8')
  paths.push(idxPath)

  return paths
}
