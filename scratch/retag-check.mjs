import { parse } from '../src/reader.js'
import { readFile } from 'node:fs/promises'
const TARGETS = new Set(['eng-program','math-program','cs-program','program',
  'eng-composition','math-composition','cs-composition','composition'])
function walk(node, counts) {
  if (Array.isArray(node)) { for (const el of node) walk(el, counts) }
  else if (node && typeof node==='object' && typeof node.name==='string' && node.name.startsWith(':')) {
    const k = node.name.slice(1); counts[k]=(counts[k]||0)+1
  }
}
for (const path of process.argv.slice(2)) {
  const forms = parse(await readFile(path,'utf8'))
  const c = {}; walk(forms, c)
  const tgt = [...TARGETS].reduce((a,k)=>a+(c[k]||0),0)
  console.log(path.split('/').pop(),
    '| :code =', c['code']||0, '| targets-remaining =', tgt,
    '| :tags =', c['tags']||0, '| :programs =', c['programs']||0)
}
