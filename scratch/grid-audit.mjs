import { parse } from '../src/reader.js'
import { readFile, readdir } from 'node:fs/promises'
const DIR='scheme/reference'
function count(node,name){let n=0
  if(Array.isArray(node)){for(const e of node)n+=count(e,name)}
  else if(node&&typeof node==='object'&&node.name===name)n++
  return n}
// a verb record = top-level form containing :examples AND :row-2-* (the 5-row grid)
function hasKey(node,name){
  if(Array.isArray(node)){for(const e of node)if(hasKey(e,name))return true}
  else if(node&&typeof node==='object'&&node.name===name)return true
  return false}
const files=(await readdir(DIR)).filter(f=>f.endsWith('.slat')&&!f.endsWith('.retag-new')).sort()
let gridVerbs=0, gridCode=0, nonGridCode=0, totCode=0
const perFile=[]
for(const f of files){
  const forms=parse(await readFile(`${DIR}/${f}`,'utf8'))
  const tops=Array.isArray(forms)?forms:[forms]
  let vf=0, vc=0, oc=0
  for(const t of tops){
    const c=count(t,':code')
    const isVerb = hasKey(t,':examples') && (hasKey(t,':row-4-proof')||hasKey(t,':row-2-audit')||hasKey(t,':row-2-when'))
    if(isVerb){vf++; vc+=c} else {oc+=c}
  }
  gridVerbs+=vf; gridCode+=vc; nonGridCode+=oc; totCode+=vc+oc
  perFile.push({f,vf,vc,oc})
}
console.log(`VERB RECORDS (5-row grid): ${gridVerbs}`)
console.log(`  :code inside verb grids: ${gridCode}  (avg ${(gridCode/gridVerbs).toFixed(2)}/verb)`)
console.log(`  :code outside grids (intro/prose): ${nonGridCode}`)
console.log(`  TOTAL :code: ${totCode}`)
console.log('\ntop non-grid-:code files:')
perFile.filter(x=>x.oc>50).sort((a,b)=>b.oc-a.oc).slice(0,12).forEach(x=>console.log(`  ${x.f}: verbs=${x.vf} gridCode=${x.vc} nonGrid=${x.oc}`))
