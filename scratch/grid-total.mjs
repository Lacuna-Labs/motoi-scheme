import { parse } from '../src/reader.js'
import { readFile, readdir } from 'node:fs/promises'
const DIR='scheme/reference'
const DISC=new Set(['eng-program','math-program','cs-program','program',
  'eng-composition','math-composition','cs-composition','composition'])
// count runnable slots: bare :code (string) + discipline keys with STRING value
function runnable(node){
  let n=0
  if(Array.isArray(node)){
    for(let i=0;i<node.length;i++){
      const el=node[i]
      if(el&&typeof el==='object'&&typeof el.name==='string'&&el.name.startsWith(':')){
        const k=el.name.slice(1), v=node[i+1]
        if((k==='code'||DISC.has(k)) && typeof v==='string') n++
      }
      n+=runnable(el)
    }
  }
  return n
}
function hasKey(node,name){
  if(Array.isArray(node)){for(const e of node)if(hasKey(e,name))return true}
  else if(node&&typeof node==='object'&&node.name===name)return true
  return false}
const files=(await readdir(DIR)).filter(f=>f.endsWith('.slat')&&!f.endsWith('.retag-new')).sort()
let verbGrid=0, verbs=0, introExtra=0
const introFiles=[]
for(const f of files){
  const x=parse(await readFile(`${DIR}/${f}`,"utf8"));const tops=Array.isArray(x)?x:[x];
  let fileIntro=0
  for(const t of tops){
    const isVerb=hasKey(t,':examples')&&(hasKey(t,':row-4-proof')||hasKey(t,':row-2-audit')||hasKey(t,':row-2-when'))
    const r=runnable(t)
    if(isVerb){verbs++; verbGrid+=r} else {introExtra+=r; fileIntro+=r}
  }
  if(fileIntro>30)introFiles.push([f,fileIntro])
}
console.log(`verb records: ${verbs}`)
console.log(`runnable programs INSIDE verb grids: ${verbGrid}  (avg ${(verbGrid/verbs).toFixed(2)}/verb)`)
console.log(`15 x ${verbs} = ${15*verbs}`)
console.log(`runnable programs OUTSIDE grids (intro/teaching): ${introExtra}`)
console.log(`GRAND TOTAL runnable: ${verbGrid+introExtra}`)
console.log('\nintro/teaching chapters carrying the extras:')
introFiles.sort((a,b)=>b[1]-a[1]).forEach(([f,n])=>console.log(`  ${f}: ${n}`))
