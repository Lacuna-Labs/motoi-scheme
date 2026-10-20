import { parse } from '../src/reader.js'
import { readFile, readdir } from 'node:fs/promises'
const DIR='scheme/reference'
const DISC=new Set(['eng-program','math-program','cs-program','program',
  'eng-composition','math-composition','cs-composition','composition'])
function runnable(node){let n=0
  if(Array.isArray(node)){for(let i=0;i<node.length;i++){const el=node[i]
    if(el&&typeof el==='object'&&typeof el.name==='string'&&el.name.startsWith(':')){
      const k=el.name.slice(1),v=node[i+1]
      if((k==='code'||DISC.has(k))&&typeof v==='string')n++}
    n+=runnable(el)}}
  return n}
function hasKey(node,name){if(Array.isArray(node)){for(const e of node)if(hasKey(e,name))return true}
  else if(node&&typeof node==='object'&&node.name===name)return true;return false}
// value paired with a given row-key inside a record
function valOf(t,key){if(Array.isArray(t)){for(let i=0;i<t.length;i++){
  const el=t[i];if(el&&typeof el==='object'&&el.name===key)return t[i+1]}
  for(const e of t){const r=valOf(e,key);if(r!==undefined)return r}}return undefined}
const ROWKEYS=[':examples',':row-2-audit',':row-2-when',':row-3-dimension',':row-3-where-else',':row-4-proof',':row-4-why',':row-5-emergence',':row-5-with']
const files=(await readdir(DIR)).filter(f=>f.endsWith('.slat')&&!f.endsWith('.retag-new')).sort()
const rowTot={}; let verbs=0; const outliers=[]
for(const f of files){
  const x=parse(await readFile(`${DIR}/${f}`,'utf8'));const tops=Array.isArray(x)?x:[x]
  for(const t of tops){
    const isVerb=hasKey(t,':examples')&&(hasKey(t,':row-4-proof')||hasKey(t,':row-2-audit')||hasKey(t,':row-2-when'))
    if(!isVerb)continue
    const tot=runnable(t)
    if(tot>30){outliers.push([f,tot]);continue}
    verbs++
    for(const rk of ROWKEYS){const v=valOf(t,rk);if(v!==undefined)rowTot[rk]=(rowTot[rk]||0)+runnable(v)}
  }
}
console.log(`normal verbs (<=30): ${verbs}`)
console.log('runnable programs per row-section (summed, avg/verb):')
for(const rk of ROWKEYS)if(rowTot[rk])console.log(`  ${rk.padEnd(22)} total=${String(rowTot[rk]).padStart(6)}  avg=${(rowTot[rk]/verbs).toFixed(2)}`)
console.log(`\noutlier teaching-forms (>30 programs): ${outliers.length}`)
outliers.forEach(([f,n])=>console.log(`  ${f}: ${n}`))
