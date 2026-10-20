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
// verb name = first symbol/keyword head of the record, or :name field
function verbName(t){
  if(Array.isArray(t)&&t[0]&&typeof t[0]==='object'&&typeof t[0].name==='string')return t[0].name
  return '?'}
const files=(await readdir(DIR)).filter(f=>f.endsWith('.slat')&&!f.endsWith('.retag-new')).sort()
const hist={}; const high=[]
for(const f of files){
  const x=parse(await readFile(`${DIR}/${f}`,'utf8'));const tops=Array.isArray(x)?x:[x]
  for(const t of tops){
    const isVerb=hasKey(t,':examples')&&(hasKey(t,':row-4-proof')||hasKey(t,':row-2-audit')||hasKey(t,':row-2-when'))
    if(!isVerb)continue
    const r=runnable(t)
    hist[r]=(hist[r]||0)+1
    if(r>15)high.push([f,verbName(t),r])
  }
}
console.log('runnable-per-verb histogram:')
Object.keys(hist).map(Number).sort((a,b)=>a-b).forEach(k=>console.log(`  ${k} programs: ${hist[k]} verbs`))
console.log(`\nverbs with >15: ${high.length}`)
high.slice(0,15).forEach(([f,v,r])=>console.log(`  ${f} ${v}: ${r}`))
