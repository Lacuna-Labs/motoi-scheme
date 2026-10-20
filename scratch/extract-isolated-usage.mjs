#!/usr/bin/env node
// For each isolated verb, pull ONE short runnable example from its home chapter.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
const REF = '/Users/alfred/code/motoi-scheme/scheme/reference';

const ISO = {
  '03-alg.slat': ['alg/action','alg/centralizer','alg/commutator','alg/derived-subgroup','alg/exponent','alg/generate','alg/generators','alg/homomorphism','alg/is-cyclic?','alg/is-homomorphism?','alg/is-isomorphic?','alg/is-simple?','alg/is-solvable?','alg/is-subgroup?','alg/isomorphism?','alg/kernel','alg/left-cosets','alg/normalizer','alg/nr-L','alg/nr-P','alg/nr-R','alg/pcset','alg/perm-cycles','alg/perm-fixed-points','alg/perm-fixed?','alg/perm-identity','alg/perm-parity','alg/perm-pow','alg/permutation-compose','alg/permutation-cycles','alg/poly-add','alg/poly-mul','alg/quotient','alg/random-element','alg/right-cosets','alg/subgroup?','alg/subgroups','alg/symmetry-group','alg/torsion'],
  '67-topo.slat': ['topo/adjacent?','topo/chain','topo/closed?','topo/dimension','topo/edges','topo/euler-characteristic','topo/faces','topo/genus','topo/homotopy','topo/interior','topo/is-manifold?','topo/klein-bottle','topo/mobius','topo/nodes','topo/open?','topo/simplex','topo/simplicial','topo/simply-connected?','topo/sphere','topo/torus','topo/vertices'],
  '74-image.slat': ['img/ellipse','img/line','img/regular-polygon','img/star','img/star-poly','img/triangle'],
  '75-image-compose.slat': ['scale/xy'],
};
const RUNNABLE_KEY = /^\s*:(code|program|composition|[a-z0-9-]*-program|[a-z0-9-]*-composition)\s+"/;

for (const [file, verbs] of Object.entries(ISO)) {
  const txt = readFileSync(join(REF, file), 'utf8');
  const lines = txt.split('\n');
  for (const v of verbs) {
    // find the shortest runnable single-line example containing (v ... )
    let best = null;
    for (const line of lines) {
      if (!RUNNABLE_KEY.test(line)) continue;
      const sm = line.match(/"((?:[^"\\]|\\.)*)"/);
      if (!sm) continue;
      const code = sm[1];
      if (code.includes('(' + v + ' ') || code.includes('(' + v + ')')) {
        if (best === null || code.length < best.length) best = code;
      }
    }
    console.log(`${v}\t${best ? best.replace(/\\n/g, ' ').slice(0,160) : '((NONE))'}`);
  }
}
