import { readFileSync, writeFileSync } from 'node:fs';
const FILE = 'scheme/reference/99-appendix-prose.slat';

const TOK = /card-set!|card\/[a-z!?-]+|card-id-of|card-list|card-rect|card-screen-rect|card-rows|card-do|card-emit|on-minimap-click|define-card/;

let lines = readFileSync(FILE, 'utf8').split('\n');

// Identify subsection header lines: "; ### ..."
// A card-contaminated subsection = one whose header OR body (up to next ; ###
// or ; ## header) contains a grep-matched card token.
const isSubHeader = l => /^; ### /.test(l);
const isBatchHeader = l => /^; ## /.test(l);

// Build subsection spans: [startIdx, endIdxExclusive]
const spans = [];
for (let i = 0; i < lines.length; i++) {
  if (isSubHeader(lines[i])) {
    let j = i + 1;
    while (j < lines.length && !isSubHeader(lines[j]) && !isBatchHeader(lines[j])) j++;
    spans.push([i, j]);
  }
}

// A span is contaminated if any line in it matches TOK.
const contaminated = spans.filter(([a, b]) => {
  for (let k = a; k < b; k++) if (TOK.test(lines[k])) return true;
  return false;
});

// Verify: total TOK-matching lines are all inside contaminated spans.
const allTokLines = [];
for (let i = 0; i < lines.length; i++) if (TOK.test(lines[i])) allTokLines.push(i);
const coveredSet = new Set();
for (const [a, b] of contaminated) for (let k = a; k < b; k++) coveredSet.add(k);
const uncovered = allTokLines.filter(i => !coveredSet.has(i));
if (uncovered.length) {
  console.error('ABORT: TOK lines outside any contaminated subsection:');
  for (const i of uncovered) console.error(`  ${i + 1}: ${lines[i]}`);
  process.exit(1);
}

console.log(`Contaminated subsections: ${contaminated.length}`);
for (const [a] of contaminated) console.log(`  L${a + 1}: ${lines[a].replace(/^; ### /, '')}`);

// Replace each contaminated span with a boundary-teaching stub.
// Process from bottom to top to keep indices valid.
// Reword header + stub so they teach the boundary WITHOUT re-emitting any
// Curator verb token (keeps the reference grep-clean; original prose is in
// the backup). Row tier is preserved for structure.
contaminated.sort((x, y) => y[0] - x[0]);
for (const [a, b] of contaminated) {
  const header = lines[a];
  const tier = /Row 5/.test(header) ? 'Row 5 (composition tier)' : 'Row 4 (proof tier)';
  const stub = [
    `; ### Curator surface verbs (removed) — ${tier}`,
    `; `,
    `; **Boundary note (not base Motoi).** A block of Curator-dialect surface`,
    `; verbs previously documented here was removed 2026-07-26. Those verbs`,
    `; belong to the **Curator** consumer dialect (reached via the Sakura`,
    `; dialect), NOT to base Motoi Scheme — documenting them here taught`,
    `; consumer vocabulary as if it were core, which is contamination.`,
    `; In base Motoi, use the entity surface instead: entity/set!, entity/all,`,
    `; entity/state, entity/emit, entity-rect, grid-rows, and friends.`,
    `; The original Curator prose is archived verbatim under`,
    `; scratch/attic/card-strip-2026-07-26/99-appendix-prose.slat.bak.`,
    `; `,
    `; ---`,
    `; `,
  ];
  lines.splice(a, b - a, ...stub);
}

writeFileSync(FILE, lines.join('\n'), 'utf8');
console.log('99-appendix: written.');
