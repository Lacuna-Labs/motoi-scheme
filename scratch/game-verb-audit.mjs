import { makeCoreEnv } from '../core/index.js'
import { VERBS } from '../lib/game/game.js'
const env = makeCoreEnv({ fuel: { n: 1_000_000 } })
const bound = new Set()
for (let e = env; e; e = e.parent) for (const k of e.vars.keys()) bound.add(k)
const yes = VERBS.filter(v => bound.has(v))
const no  = VERBS.filter(v => !bound.has(v))
console.log(`BOUND (${yes.length}):`); console.log('  ' + yes.join('\n  '))
console.log(`\nUNBOUND (${no.length}):`); console.log('  ' + no.join('\n  '))
