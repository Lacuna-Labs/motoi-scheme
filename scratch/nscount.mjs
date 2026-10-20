import { makeBaseEnv } from '../src/base.js';
const env = makeBaseEnv();
const names = [...env.vars.keys()];
for (const p of ['animation','linalg','hash','list','string','core']) {
  console.log(p, names.filter(n => n.startsWith(p + '/')).length);
}
