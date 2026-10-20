// scratch/fix-oneshot.mjs — transform failing ```scheme fences in one-shot book.
// Strategy per fence (operating on the ESCAPED prose text in-file):
//   1. Decode the fence body (\n, \", \\).
//   2. Find "bad" (imaginary/unbound host) verbs used.
//   3. If the ONLY bad token is a `surface` wrapper AND unwrapping the
//      (surface :say TPL :from (list E...)) leaves code with no bad verbs,
//      rewrite the fence to the unwrapped expression(s) (rewrite-to-real).
//   4. Otherwise, if the fence has any bad verb, change ```scheme -> ```text.
//   5. Leave clean fences alone.
// Writes files in place. Prints a per-fence decision log. DOES NOT decide
// non-host failures (.slice/.findIndex/every?/etc) — those are handled by hand.
import { readFileSync, writeFileSync } from 'node:fs'

const BAD = [
  'clock/now','surface','fetch','knowledge/of','world/knowledge',
  'system/registry','system/env','weather/','loam/store','loam/recall',
  'loam/remember','sys/exec','http/get','http/post','json/parse','json/',
  'contact/','calendar/','bank/','profile/','currency/','author/','email/',
  'geo/','home/','device/','academic/','fitness/','article/','cart/',
  'projects/','grocery/','finance/','location/','quiz/','todo/','sms/',
  'stock/','net/','music/','battery/','photo/','maps/','news/',
  'clock/','sensor/','interaction-environment',
]
// a bare (store ...) call — store is not bound. Match as a call head only.
function usesBad(code){
  const hits = new Set()
  for(const b of BAD){ if(code.includes(b)) hits.add(b) }
  if(/\(store\s/.test(code) || /\(store\)/.test(code)) hits.add('store')
  return hits
}

// Inside a fence: newlines are literal; only \" and \\ are escaped.
function decode(s){ return s.replace(/\\"/g,'"').replace(/\\\\/g,'\\') }
function encode(s){ return s.replace(/\\/g,'\\\\').replace(/"/g,'\\"') }

// Try to unwrap a single (surface :say TPL :from (list E1 E2 ...)) into its
// inner expressions. Returns null if not a clean single-surface wrapper.
function unwrapSurface(code){
  const t = code.trim()
  if(!t.startsWith('(surface')) return null
  // must be exactly one top-level form
  // find ":from (list ...)" — extract the list contents by paren matching.
  const fromIdx = t.indexOf(':from')
  if(fromIdx<0) return null
  const listIdx = t.indexOf('(list', fromIdx)
  if(listIdx<0) return null
  // paren-match from listIdx to get the (list ...) form
  let depth=0, end=-1
  for(let i=listIdx;i<t.length;i++){
    if(t[i]==='(')depth++
    else if(t[i]===')'){depth--; if(depth===0){end=i;break}}
  }
  if(end<0) return null
  // ensure the surface form closes right after (only whitespace + ')')
  const after = t.slice(end+1).trim()
  if(after!==')') return null
  const inner = t.slice(listIdx+5, end).trim() // contents after "(list"
  // inner may be multiple expressions; split at top level
  const exprs=[]
  let d=0,start=0
  for(let i=0;i<inner.length;i++){
    const c=inner[i]
    if(c==='(')d++
    else if(c===')')d--
    else if(/\s/.test(c) && d===0){
      if(i>start){const seg=inner.slice(start,i).trim(); if(seg) exprs.push(seg)}
      start=i+1
    }
  }
  const last=inner.slice(start).trim(); if(last) exprs.push(last)
  if(exprs.length===0) return null
  return exprs.join('\n')
}

for(const f of process.argv.slice(2)){
  let text = readFileSync(f,'utf8')
  const re=/```scheme\n([\s\S]*?)```/g
  let out='', last=0, m, n=0, rw=0, dm=0, hand=0
  while((m=re.exec(text))!==null){
    n++
    const code=decode(m[1])
    const bad=usesBad(code)
    let replacement=null, kind='keep'
    if(bad.size>0){
      // try unwrap if the only bad thing is surface
      if(bad.size===1 && bad.has('surface')){
        const uw=unwrapSurface(code)
        if(uw!==null && usesBad(uw).size===0){
          replacement='```scheme\n'+encode(uw)+'\n```'
          kind='rewrite'; rw++
        }
      }
      if(!replacement){
        // demote to text with a one-line note (illustrative host-I/O that
        // base Motoi does not expose). Note lives inside the fence as a comment.
        const note=';; [illustrative: uses host I/O ('+[...bad].join(', ')+') base Motoi does not expose]\n'
        replacement='```text\n'+note+m[1]+'```'
        kind='demote'; dm++
      }
    }
    if(replacement){
      out+=text.slice(last, m.index)+replacement
      last=m.index+m[0].length
    }
    console.log(`${f.split('/').pop()}  #${n}  ${kind}  [${[...bad].join(',')}]`)
  }
  out+=text.slice(last)
  writeFileSync(f,out)
  console.log(`  -> ${f.split('/').pop()}: rewrote ${rw}, demoted ${dm}`)
}
