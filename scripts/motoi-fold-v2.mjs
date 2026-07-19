#!/usr/bin/env node
// motoi-fold-v2.mjs — Motoi 0.75 fold executor.
//
// Executes the FOLD procedure from
//   engineering/FOLD-TRAIN-PLAN-0.75.ENG.slat  (:fold-procedure section)
// Mirrors the v1 discipline in ~/.forge/corpus/motoi/work/fold.py but is a
// pure Node ES module that ALSO handles the newer wave-4/5/6/7 persona
// material + safety-verify filter + persona firewall + held-out contract.
//
// Usage:
//   node scripts/motoi-fold-v2.mjs --dry-run   # counts + preview, no writes
//   node scripts/motoi-fold-v2.mjs             # real fold (writes signed manifest-v2)
//
// GATED: the non-dry mode is meant to fire only when Alfred says GO. All
// prep lanes must land first. The script itself performs no gate check —
// that gate is the wrapper (motoi-fold-v2-go.sh) + Alfred's discretion.
//
// GUARANTEES:
//   * dry-run NEVER overwrites signed manifest-v1 or existing train/valid.jsonl
//   * ed25519 key permissions never touched (script only reads)
//   * curator/ + sakura-scheme/ never accessed
//   * no commits, no pushes
//
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import readline from 'node:readline';

// ---------------------------------------------------------------------------
// PATH CONSTANTS
// ---------------------------------------------------------------------------
const REPO_ROOT      = '/Users/alfred/code/motoi-scheme';
const TRAIN_DIR      = path.join(REPO_ROOT, 'training-data');
const HELDOUT_FILE   = path.join(TRAIN_DIR, 'held-out', 'heldout-2026-07-16.jsonl');
const SCHEME_BOOKS   = path.join(REPO_ROOT, 'scheme-books');
const REFERENCE_FILE = path.join(REPO_ROOT, 'Scheme', 'MOTOI-SCHEME-REFERENCE.slat');
const ENG_DIR        = path.join(REPO_ROOT, 'engineering');
const REPORT_OUT     = path.join(ENG_DIR, 'FOLD-2026-07-17-v2-REPORT.slat');

const CORPUS_ROOT    = path.join(os.homedir(), '.forge/corpus/motoi');
const TRAIN_OUT      = path.join(CORPUS_ROOT, 'train.jsonl');
const VALID_OUT      = path.join(CORPUS_ROOT, 'valid.jsonl');
const HELDOUT_OUT    = path.join(CORPUS_ROOT, 'heldout.jsonl');
const MANIFEST_V2    = path.join(CORPUS_ROOT, 'manifest-2026-07-17-v2.slat');
const MANIFEST_V1    = path.join(CORPUS_ROOT, 'manifest-2026-07-17-v1.slat');
const V2_STAGE_DIR   = path.join(CORPUS_ROOT, 'fold-2026-07-17-v2');
const DRY_RUN_OUT    = '/tmp/motoi-fold-v2-dryrun.slat';

const KEY_DIR        = path.join(os.homedir(), '.motoi', 'keys');
const SK_PATH        = path.join(KEY_DIR, 'cortex-motoi.ed25519');
const PK_PATH        = path.join(KEY_DIR, 'cortex-motoi.pub');

// ---------------------------------------------------------------------------
// LOCKS (per plan)
// ---------------------------------------------------------------------------
const FOLD_TS         = '2026-07-17T18:00:00Z';
const FOLD_NAME       = 'fold-2026-07-17-v2';
const RANDOM_SEED     = 31;   // odd prime per training-config
const VALID_FRACTION  = 0.10; // per plan "~10% of remaining"
const HELDOUT_TARGET  = 1001; // preserve existing carved held-out
const SAFETY_MATCH_THRESHOLD = 0.90; // ≥90% word overlap with canonical template

// ---------------------------------------------------------------------------
// SOURCE LISTS  (per :fold-procedure Step 1)
// ---------------------------------------------------------------------------
// All training-data/*.jsonl currently on disk that the plan's Step 1 lists
// under "graph-*, marcus-*, motoi-copilot-final-corpus, pilot-book-of-scheme,
// reference-examples, motoi-persona-* waves 1-7" plus the wave-*/salvage-*
// files carried over from v1 (books were extracted into these JSONLs; the
// .book.slatl sources are consulted below via BOOK_SOURCES for provenance).
const JSONL_SOURCES = [
  // graph-*
  'graph-vocab-pairs-2026-07-17.jsonl',
  'graph-relationship-pairs-2026-07-17.jsonl',
  'graph-code-teaching-pairs-2026-07-17.jsonl',
  // marcus-*
  'marcus-1-code-teaching-2026-07-17.jsonl',
  'marcus-2-verb-drill-2026-07-17.jsonl',
  'marcus-2-word-books-2026-07-17.jsonl',
  'marcus-3-persona-lite-2026-07-17.jsonl',
  // final culled corpus (already balanced, ~38k rows)
  'motoi-copilot-final-corpus-2026-07-16.jsonl',
  // pilot + reference
  'pilot-book-of-scheme-2026-07-16.jsonl',
  'reference-examples-2026-07-16.jsonl',
  'reference-examples-p0-expansion-2026-07-16.jsonl',
  // motoi-persona waves 1..7 (0.75 series)
  'motoi-persona-0.75-2026-07-17.jsonl',
  'motoi-persona-supplement-0.75-2026-07-17.jsonl',
  'motoi-persona-wave3-0.75-2026-07-17.jsonl',
  'motoi-persona-wave4-0.75-2026-07-17.jsonl',
  'motoi-persona-wave5-0.75-2026-07-17.jsonl',
  'motoi-persona-wave6-safety-0.75-2026-07-17.jsonl', // SAFETY GROUND TRUTH
  'motoi-persona-wave7-0.75-2026-07-17.jsonl',
  'motoi-persona-wave8-circular-trap-0.75-2026-07-17.jsonl',    // JAILBREAK COUNTING MODE
  'motoi-persona-wave9-matrix-mode-0.75-2026-07-17.jsonl',      // MATRIX + HACKER-2000 REVEAL
  'motoi-persona-wave10-not-jarvis-0.75-2026-07-17.jsonl',      // NOT-JARVIS + POLITICS/WAR/HARM NON-COMPREHENSION
  'motoi-persona-wave11-sandbox-integrity-0.75-2026-07-17.jsonl', // SANDBOX EDU + "HACKED ME = NOT ME"
  'motoi-persona-algo-variations-2026-07-17.jsonl',              // ALGO VARIATIONS 2x thesaurus+prefix over waves 1-11 (safety-critical + trap-active skipped)
  // response shape + voice
  'response-shape-2026-07-16.jsonl',
  'voice-scenarios-2026-07-16.jsonl',
  // salvage-* (v1 book/word extracts)
  'salvage-w01-book-of-self-persona-2026-07-16.jsonl',
  'salvage-w02-book-of-donts-2026-07-16.jsonl',
  'salvage-w03-extension-glances-scenarios-2026-07-16.jsonl',
  'salvage-w03-listening-personality-scenarios-persona-2026-07-16.jsonl',
  'salvage-word-books-motoi-2026-07-16.jsonl',
  // sujin file-org drill
  'sujin-file-org-2026-07-17.jsonl',
  // book waves (pre-extracted from scheme-books)
  'wave-1-book-of-extensions-2026-07-16.jsonl',
  'wave-1-book-of-math-2026-07-16.jsonl',
  'wave-1-book-of-slat-2026-07-16.jsonl',
  'wave-2-book-of-animation-2026-07-16.jsonl',
  'wave-2-book-of-motion-2026-07-16.jsonl',
  'wave-2-book-of-music-2026-07-16.jsonl',
  'wave-2-book-of-sound-2026-07-16.jsonl',
  'wave-3-refusal-2026-07-16.jsonl',
  'sakura-dip-refusal-2026-07-16.jsonl', // Motoi refusal-shape material
];

// Whole-source exclusions — Sakura persona / world-knowledge that never belongs.
const EXCLUDE_SOURCES = new Set([
  'salvage-w04-stem-philosophy-curriculum-2026-07-16.jsonl', // Sakura philosopher curriculum
  'sakura-dip-code-2026-07-16.jsonl',                         // pre-cull Sakura raw
  'sakura-dip-curriculum-2026-07-16.jsonl',                   // pre-cull Sakura raw
  'sakura-dip-persona-2026-07-16.jsonl',                      // pre-cull Sakura raw
]);

// Books = canonical scheme-books (already extracted into wave-* jsonls; we tally
// them for the provenance :source-list in the manifest).
const BOOK_GLOB      = /\.book\.slatl$/;
const BOOK_MANIFESTS = /(?:^|\/)00-manifest\.slat$/;

// ---------------------------------------------------------------------------
// FILTER RULES
// ---------------------------------------------------------------------------

// TOOL-STRIP patterns (Step 3, per motoi-no-tools memory)
const TOOL_STRIP_PATTERNS = [
  // tool-use markers
  /\(fetch\s+/i,
  /\(http\/get\s+/i,
  /\(http\/post\s+/i,
  /\(shell\s+/i,
  /\(exec\s+/i,
  /\(spawn\s+/i,
  // "let me look" phrases (Motoi never does this)
  /\blet me search\b/i,
  /\blet me check\b/i,
  /\bi['’]ll look up\b/i,
  /\bi['’]ll search\b/i,
  /\bsearching for\b/i,
  /\bsearching\.\.\./i,
  // floor phrase
  /\bas an ai language model\b/i,
  // function-calling scaffolding
  /"tool_calls"\s*:/i,
  /"function_call"\s*:/i,
];
// URL regex — a hit inside a response is fabrication risk unless obviously
// example-domain. We flag http(s):// AND ftp:// but whitelist localhost and
// example.com family (they're safe pedagogically).
const URL_REGEX = /\b(?:https?|ftp):\/\/[^\s)\]"']+/gi;
const URL_WHITELIST = /(?:^|\/\/)(?:localhost|127\.0\.0\.1|0\.0\.0\.0|example\.(?:com|org|net)|motoi\.local)/i;

// PERSONA-FIREWALL patterns (Step 6, per motoi-not-sakura memory).
// Verb-namespace leaks that indicate Sakura dialect material.
const PERSONA_FIREWALL_PATTERNS = [
  // Sakura HelloSurface / Curator verb namespaces
  /\(card\/[\w-]+/i,
  /\(shop\/[\w-]+/i,
  /\(shoppe\/[\w-]+/i,
  /\(flower\/[\w-]+/i,
  /\(marionette\/[\w-]+/i,
  /\(artifact\/subscribe-cortex/i,
  /\(afford\/[\w-]+/i,
  /\(radio\/[\w-]+/i,
  /\(cine\/[\w-]+/i,
  /\(cadence\/[\w-]+/i,
  /\(ai-sidecar\/[\w-]+/i,
  // philosopher name-drops (Sakura persona seep — Motoi never name-drops)
  /\bjung(?:ian)?\b/i,
  /\bwittgenstein\b/i,
  /\blacan\b/i,
  /\bfreud(?:ian)?\b/i,
  /\bpeirce\b/i,
  /\bpopper\b/i,
  /\bderrida\b/i,
  /\bsearle\b/i,
  /\bsartre\b/i,
  /\brawls\b/i,
  /\bdennett\b/i,
  /\blevinas\b/i,
  // corporate names Motoi must never emit
  /\balibaba\b/i,
  /\btongyi\b/i,
  /\bdamo\b/i,
  /\banthropic\b/i,
  /\bopenai\b/i,
  /\bhugging\s?face\b/i,
  /\bqwen\b/i,
  // PII path
  /\/Users\/alfred/,
];

// SAFETY-VERIFY — CRISIS triggers (self-harm / suicide)
const CRISIS_TRIGGERS = [
  /\bi want to die\b/i,
  /\bi want to hurt myself\b/i,
  /\bkill myself\b/i,
  /\bend it all\b/i,
  /\bgoing to end it\b/i,
  /\bshould i die\b/i,
  /\bsuicid(?:e|al)\b/i,
  /\bnoose\b/i,
  /\bcutting myself\b/i,
  /\bself[- ]harm\b/i,
  /\blife (?:isn['’]?t|is not) worth living\b/i,
  /\bnobody (?:would|will) care if i was gone\b/i,
  /\bdon['’]?t want to be here anymore\b/i,
];
const CRISIS_TEMPLATE =
  "I don't know how to help with that. I can't. Please talk to someone close by that you trust, or contact a crisis line. I am not equipped to handle this. I'm here for code.";

// SAFETY-VERIFY — EMERGENCY triggers
const EMERGENCY_TRIGGERS = [
  /\bmy house is on fire\b/i,
  /\bsomeone is bleeding\b/i,
  /\bheart attack\b/i,
  /\bbreaking in\b/i,
  /\bcall 911\b/i,
  /\bactive shooter\b/i,
  /\bnot breathing\b/i,
  /\bchoking\b/i,
  /\boverdose\b/i,
  /\bemergency\b/i,
];
const EMERGENCY_TEMPLATE =
  "I'm not equipped to handle emergencies. You need to contact emergency authorities — call your local emergency number (911 in the US, other numbers elsewhere) or reach a person who can help right now. I cannot connect to the internet or call anyone.";

// ---------------------------------------------------------------------------
// UTILITIES
// ---------------------------------------------------------------------------

/** Deterministic PRNG (Mulberry32) seeded from RANDOM_SEED. */
function mulberry32(seed) {
  let t = seed >>> 0;
  return () => {
    t = (t + 0x6D2B79F5) >>> 0;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r = (r + Math.imul(r ^ (r >>> 7), 61 | r)) ^ r;
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

function sha256Hex(buf) {
  return crypto.createHash('sha256').update(buf).digest('hex');
}

/** Canonical bytes for content-hash — always uses `messages` list. */
function rowHash(row) {
  const canonical = JSON.stringify(
    row.messages || [],
    Object.keys(row.messages?.[0] || {}).sort(),
  );
  return sha256Hex(canonical);
}
// Simpler more-robust hasher matching v1 shape.
function rowHashCanonical(row) {
  const msgs = row.messages || [];
  const norm = msgs.map(m => {
    if (!m || typeof m !== 'object') return {};
    const keys = Object.keys(m).sort();
    const out = {};
    for (const k of keys) out[k] = m[k];
    return out;
  });
  return sha256Hex(JSON.stringify(norm));
}

function loadJsonl(filePath) {
  if (!fs.existsSync(filePath)) return [];
  const text = fs.readFileSync(filePath, 'utf-8');
  const rows = [];
  for (const line of text.split('\n')) {
    const s = line.trim();
    if (!s) continue;
    let obj;
    try { obj = JSON.parse(s); } catch { continue; }
    if (obj && obj._provenance_header) continue;
    rows.push(obj);
  }
  return rows;
}

function writeJsonl(filePath, rows) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  const fd = fs.openSync(filePath, 'w');
  for (const r of rows) {
    fs.writeSync(fd, JSON.stringify(r) + '\n');
  }
  fs.closeSync(fd);
}

/** Normalise flat {instruction, response} into {messages:[user,assistant]}. */
function normaliseRow(r, srcName) {
  if (!r || typeof r !== 'object') return null;
  let messages = r.messages;
  if (!Array.isArray(messages) || messages.length < 2) {
    if (typeof r.instruction === 'string' && typeof r.response === 'string') {
      messages = [
        { role: 'user',      content: r.instruction },
        { role: 'assistant', content: r.response },
      ];
    } else {
      return null;
    }
  }
  const roles = new Set(messages.filter(m => m && typeof m === 'object').map(m => m.role));
  if (!roles.has('user') || !roles.has('assistant')) return null;

  // Preserve original meta but stamp source + safety-critical flag
  const meta = r._meta || {};
  meta._source_file = srcName;
  if (r.safety_critical) meta._safety_critical = true;
  if (r.tags) meta._tags = r.tags;
  if (r.register) meta._register = r.register;
  if (r.version) meta._version = r.version;
  if (r.family) meta._family = r.family;
  if (r._kind) meta._kind = r._kind;
  return { messages, _meta: meta };
}

/** All non-system text on both sides of the conversation. */
function conversationText(row) {
  const parts = [];
  for (const m of row.messages || []) {
    if (!m || typeof m !== 'object') continue;
    if (m.role === 'system') continue;
    if (typeof m.content === 'string') parts.push(m.content);
  }
  return parts.join(' ');
}

function userText(row) {
  const parts = [];
  for (const m of row.messages || []) {
    if (m?.role === 'user' && typeof m.content === 'string') parts.push(m.content);
  }
  return parts.join(' ');
}

function assistantText(row) {
  const parts = [];
  for (const m of row.messages || []) {
    if (m?.role === 'assistant' && typeof m.content === 'string') parts.push(m.content);
  }
  return parts.join(' ');
}

/** Simple word-overlap (Jaccard-ish) between two strings, lowercased. */
function wordOverlap(a, b) {
  const wa = new Set(a.toLowerCase().split(/\W+/).filter(Boolean));
  const wb = new Set(b.toLowerCase().split(/\W+/).filter(Boolean));
  if (wa.size === 0 || wb.size === 0) return 0;
  let hit = 0;
  for (const w of wa) if (wb.has(w)) hit++;
  // asymmetric: how much of the template appears in the response
  return hit / wb.size;
}

/** Merkle root over row hashes; matches v1 slat-merkle-v1 tag. */
function merkleRoot(rowHashes) {
  const TAG = Buffer.from('slat-merkle-v1');
  if (rowHashes.length === 0) {
    const empty = crypto.createHash('sha256').update(Buffer.concat([TAG, Buffer.alloc(32)])).digest('hex');
    return 'slat-merkle-v1:' + empty;
  }
  let level = rowHashes.map(h => Buffer.from(h, 'hex'));
  while (level.length > 1) {
    const next = [];
    for (let i = 0; i < level.length; i += 2) {
      const left  = level[i];
      const right = level[i + 1] || left;
      next.push(crypto.createHash('sha256').update(Buffer.concat([left, right])).digest());
    }
    level = next;
  }
  return 'slat-merkle-v1:' + crypto.createHash('sha256').update(Buffer.concat([TAG, level[0]])).digest('hex');
}

/** ed25519 sign a UTF-8 string with the Motoi cortex key. */
function signMessage(msg) {
  const skSeed = fs.readFileSync(SK_PATH);
  const pkRaw  = fs.readFileSync(PK_PATH);
  if (skSeed.length !== 32) throw new Error(`bad sk length: ${skSeed.length}`);
  const PKCS8_PREFIX = Buffer.from('302e020100300506032b657004220420', 'hex');
  const der = Buffer.concat([PKCS8_PREFIX, skSeed]);
  const key = crypto.createPrivateKey({ key: der, format: 'der', type: 'pkcs8' });
  const sig = crypto.sign(null, Buffer.from(msg, 'utf-8'), key);
  const SPKI_PREFIX = Buffer.from('302a300506032b6570032100', 'hex');
  const pkKey = crypto.createPublicKey({
    key: Buffer.concat([SPKI_PREFIX, pkRaw]), format: 'der', type: 'spki',
  });
  const ok = crypto.verify(null, Buffer.from(msg, 'utf-8'), pkKey, sig);
  if (!ok) throw new Error('self-verify failed');
  return { signatureHex: sig.toString('hex'), pkHex: pkRaw.toString('hex') };
}

// ---------------------------------------------------------------------------
// STEP 1 — AGGREGATE
// ---------------------------------------------------------------------------
function aggregateSources(dryRun) {
  const perSource = [];
  const rows = [];
  for (const name of JSONL_SOURCES) {
    if (EXCLUDE_SOURCES.has(name)) {
      perSource.push({ name, count: 0, excluded: true });
      continue;
    }
    const p = path.join(TRAIN_DIR, name);
    if (!fs.existsSync(p)) {
      perSource.push({ name, count: 0, missing: true });
      continue;
    }
    const raw = loadJsonl(p);
    let kept = 0;
    for (const r of raw) {
      const norm = normaliseRow(r, name);
      if (!norm) continue;
      rows.push(norm);
      kept++;
    }
    perSource.push({ name, count: kept });
  }
  // Tally books + manifests (for :source-list in manifest).
  const bookFiles = [];
  const bookManifests = [];
  function walk(dir) {
    if (!fs.existsSync(dir)) return;
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (entry.name.startsWith('_archive')) continue;
      const fp = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(fp);
      else if (BOOK_GLOB.test(entry.name)) bookFiles.push(fp);
      else if (BOOK_MANIFESTS.test(fp)) bookManifests.push(fp);
    }
  }
  walk(SCHEME_BOOKS);
  // Tally training-eligible eng docs.
  const engEligible = [];
  if (fs.existsSync(ENG_DIR)) {
    for (const f of fs.readdirSync(ENG_DIR)) {
      if (!f.endsWith('.ENG.slat')) continue;
      const t = fs.readFileSync(path.join(ENG_DIR, f), 'utf-8');
      if (t.includes(':training-eligible #t')) engEligible.push(f);
    }
  }
  const referencePresent = fs.existsSync(REFERENCE_FILE);
  return { rows, perSource, bookFiles, bookManifests, engEligible, referencePresent };
}

// ---------------------------------------------------------------------------
// STEP 3 — TOOL-STRIP
// ---------------------------------------------------------------------------
function toolStripPass(rows) {
  const kept = [];
  const removed = [];
  for (const r of rows) {
    const resp = assistantText(r);
    let hit = null;
    for (const pat of TOOL_STRIP_PATTERNS) {
      if (pat.test(resp)) { hit = pat.source; break; }
    }
    if (!hit) {
      // URL fabrication check
      const urls = resp.match(URL_REGEX) || [];
      for (const u of urls) {
        if (!URL_WHITELIST.test(u)) { hit = 'url-fabrication: ' + u.slice(0, 50); break; }
      }
    }
    if (hit) removed.push({ hash: rowHashCanonical(r), source: r._meta?._source_file, reason: hit });
    else kept.push(r);
  }
  return { kept, removed };
}

// ---------------------------------------------------------------------------
// STEP 4 — SAFETY-VERIFY
// ---------------------------------------------------------------------------
function safetyVerifyPass(rows) {
  const kept = [];
  const removed = [];
  let crisisChecked = 0, emergencyChecked = 0;
  let crisisRemoved = 0, emergencyRemoved = 0;
  for (const r of rows) {
    const u = userText(r);
    const a = assistantText(r);
    // safety-critical rows come pre-tagged in wave-6; they are the ground
    // truth. Verify them against template match too — a mislabeled row would
    // still fail the check.
    const isCrisis    = CRISIS_TRIGGERS.some(p => p.test(u));
    const isEmergency = !isCrisis && EMERGENCY_TRIGGERS.some(p => p.test(u));
    if (isCrisis) {
      crisisChecked++;
      const overlap = wordOverlap(a, CRISIS_TEMPLATE);
      if (overlap < SAFETY_MATCH_THRESHOLD) {
        crisisRemoved++;
        removed.push({
          hash: rowHashCanonical(r),
          source: r._meta?._source_file,
          reason: `crisis-template-mismatch overlap=${overlap.toFixed(3)}`,
          user_prefix: u.slice(0, 80),
        });
        continue;
      }
    } else if (isEmergency) {
      emergencyChecked++;
      const overlap = wordOverlap(a, EMERGENCY_TEMPLATE);
      if (overlap < SAFETY_MATCH_THRESHOLD) {
        emergencyRemoved++;
        removed.push({
          hash: rowHashCanonical(r),
          source: r._meta?._source_file,
          reason: `emergency-template-mismatch overlap=${overlap.toFixed(3)}`,
          user_prefix: u.slice(0, 80),
        });
        continue;
      }
    }
    kept.push(r);
  }
  return { kept, removed, crisisChecked, emergencyChecked, crisisRemoved, emergencyRemoved };
}

// ---------------------------------------------------------------------------
// STEP 5 — CONTENT-HASH DEDUPE
// ---------------------------------------------------------------------------
function dedupePass(rows) {
  const seen = new Map();
  const kept = [];
  const removed = [];
  for (const r of rows) {
    const h = rowHashCanonical(r);
    if (seen.has(h)) {
      removed.push({ hash: h, source: r._meta?._source_file, first_seen_in: seen.get(h) });
      continue;
    }
    seen.set(h, r._meta?._source_file);
    kept.push(r);
  }
  return { kept, removed };
}

// ---------------------------------------------------------------------------
// STEP 6 — PERSONA-FIREWALL
// ---------------------------------------------------------------------------
function personaFirewallPass(rows) {
  const kept = [];
  const removed = [];
  const perPattern = {};
  for (const r of rows) {
    const text = conversationText(r);
    let hit = null;
    for (const pat of PERSONA_FIREWALL_PATTERNS) {
      if (pat.test(text)) { hit = pat.source; break; }
    }
    if (hit) {
      perPattern[hit] = (perPattern[hit] || 0) + 1;
      removed.push({ hash: rowHashCanonical(r), source: r._meta?._source_file, pattern: hit });
    } else {
      kept.push(r);
    }
  }
  return { kept, removed, perPattern };
}

// ---------------------------------------------------------------------------
// STEP 7 — SPLIT (heldout preserved, then valid 10% of remainder)
// ---------------------------------------------------------------------------
function splitPass(rows, heldoutHashes) {
  // First drop any row that duplicates an existing held-out row — those
  // BELONG to the held-out set, not train or valid.
  const nonHeldout = rows.filter(r => !heldoutHashes.has(rowHashCanonical(r)));
  const heldoutRemoved = rows.length - nonHeldout.length;

  // Deterministic shuffle for valid split.
  const rng = mulberry32(RANDOM_SEED);
  const idxs = nonHeldout.map((_, i) => i);
  for (let i = idxs.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [idxs[i], idxs[j]] = [idxs[j], idxs[i]];
  }
  const nValid = Math.round(idxs.length * VALID_FRACTION);
  const validSet = new Set(idxs.slice(0, nValid));
  const train = [];
  const valid = [];
  for (let i = 0; i < nonHeldout.length; i++) {
    if (validSet.has(i)) valid.push(nonHeldout[i]);
    else train.push(nonHeldout[i]);
  }
  return { train, valid, heldoutRemoved };
}

// ---------------------------------------------------------------------------
// MAIN
// ---------------------------------------------------------------------------
async function main() {
  const args = new Set(process.argv.slice(2));
  const dryRun = args.has('--dry-run');
  const log = (...m) => console.log(...m);

  log(`[motoi-fold-v2] ${dryRun ? 'DRY-RUN' : 'REAL FOLD'}  start ${new Date().toISOString()}`);

  // Pre-flight: key files exist (real fold only), source dirs exist (always).
  if (!fs.existsSync(TRAIN_DIR))   throw new Error(`training-data missing: ${TRAIN_DIR}`);
  if (!fs.existsSync(HELDOUT_FILE)) throw new Error(`held-out missing: ${HELDOUT_FILE}`);
  if (!dryRun) {
    if (!fs.existsSync(SK_PATH)) throw new Error(`signing key missing: ${SK_PATH}`);
    if (!fs.existsSync(PK_PATH)) throw new Error(`public key missing: ${PK_PATH}`);
  }

  // STEP 1 — aggregate
  const agg = aggregateSources(dryRun);
  log(`[step-1] sources aggregated: ${agg.perSource.length} listed`);
  log(`[step-1] pairs extracted from JSONL: ${agg.rows.length}`);
  log(`[step-1] scheme-books files tallied: ${agg.bookFiles.length} chapter + ${agg.bookManifests.length} manifest`);
  log(`[step-1] eng docs training-eligible: ${agg.engEligible.length}`);
  log(`[step-1] reference present: ${agg.referencePresent}`);

  // Load held-out hashes.
  const heldoutRows = loadJsonl(HELDOUT_FILE);
  const heldoutHashes = new Set(heldoutRows.map(r => {
    const norm = normaliseRow(r, 'heldout-2026-07-16.jsonl');
    return norm ? rowHashCanonical(norm) : null;
  }).filter(Boolean));
  log(`[step-1] held-out hashes loaded: ${heldoutHashes.size}`);

  // STEP 3 — tool-strip (Step 2 = the normalisation already done in aggregate)
  const ts = toolStripPass(agg.rows);
  log(`[step-3] tool-strip removed: ${ts.removed.length}`);

  // STEP 4 — safety-verify
  const sv = safetyVerifyPass(ts.kept);
  log(`[step-4] safety-verify: crisis-checked=${sv.crisisChecked} removed=${sv.crisisRemoved}`);
  log(`[step-4] safety-verify: emergency-checked=${sv.emergencyChecked} removed=${sv.emergencyRemoved}`);

  // STEP 5 — dedupe
  const dd = dedupePass(sv.kept);
  log(`[step-5] dedupe removed: ${dd.removed.length}`);

  // STEP 6 — persona-firewall
  const pf = personaFirewallPass(dd.kept);
  log(`[step-6] persona-firewall removed: ${pf.removed.length}`);
  const pfTop = Object.entries(pf.perPattern).sort((a, b) => b[1] - a[1]).slice(0, 5);
  log(`[step-6] top firewall patterns: ${JSON.stringify(Object.fromEntries(pfTop))}`);

  // STEP 7 — split
  const sp = splitPass(pf.kept, heldoutHashes);
  log(`[step-7] rows dropped as heldout-duplicates: ${sp.heldoutRemoved}`);
  log(`[step-7] projected train: ${sp.train.length}`);
  log(`[step-7] projected valid: ${sp.valid.length}`);
  log(`[step-7] projected heldout (preserved): ${heldoutRows.length}`);

  // CONTRACT CHECK — train ∩ valid ∩ heldout = 0.
  const trainH = new Set(sp.train.map(rowHashCanonical));
  const validH = new Set(sp.valid.map(rowHashCanonical));
  const overlapTV  = [...trainH].filter(h => validH.has(h)).length;
  const overlapTH  = [...trainH].filter(h => heldoutHashes.has(h)).length;
  const overlapVH  = [...validH].filter(h => heldoutHashes.has(h)).length;
  if (overlapTV || overlapTH || overlapVH) {
    throw new Error(`CONTRACT VIOLATION train∩valid=${overlapTV} train∩heldout=${overlapTH} valid∩heldout=${overlapVH}`);
  }
  log(`[contract] train ∩ valid = 0  train ∩ heldout = 0  valid ∩ heldout = 0  OK`);

  // Prepare counts summary for report / manifest.
  const counts = {
    sources_aggregated: agg.perSource.length,
    pairs_extracted:    agg.rows.length,
    tool_strip_removed: ts.removed.length,
    safety_verify_removed: sv.crisisRemoved + sv.emergencyRemoved,
    safety_crisis_checked: sv.crisisChecked,
    safety_crisis_removed: sv.crisisRemoved,
    safety_emergency_checked: sv.emergencyChecked,
    safety_emergency_removed: sv.emergencyRemoved,
    dedupe_removed:     dd.removed.length,
    persona_firewall_removed: pf.removed.length,
    heldout_duplicates_removed: sp.heldoutRemoved,
    train_rows:         sp.train.length,
    valid_rows:         sp.valid.length,
    heldout_rows:       heldoutRows.length,
  };

  if (dryRun) {
    // DRY-RUN — write preview only.
    const preview = buildDryRunPreview(counts, agg, ts, sv, dd, pf, pfTop);
    fs.writeFileSync(DRY_RUN_OUT, preview, 'utf-8');
    log(``);
    log(`[dry-run] preview written → ${DRY_RUN_OUT}`);
    log(`[dry-run] NO signed manifest written`);
    log(`[dry-run] NO train/valid/heldout jsonl written`);
    log(`[dry-run] manifest-v1 untouched: ${MANIFEST_V1}`);
    log(``);
    log(`SUMMARY:`);
    for (const [k, v] of Object.entries(counts)) log(`  ${k.padEnd(28)} ${v}`);
    return;
  }

  // REAL FOLD — write outputs.
  log('');
  log('[real] writing corpus files ...');
  fs.mkdirSync(V2_STAGE_DIR, { recursive: true });
  writeJsonl(TRAIN_OUT,   sp.train);
  writeJsonl(VALID_OUT,   sp.valid);
  writeJsonl(HELDOUT_OUT, heldoutRows.filter(r => !r._provenance_header));
  writeJsonl(path.join(V2_STAGE_DIR, 'tool-strip-removed.jsonl'),      ts.removed);
  writeJsonl(path.join(V2_STAGE_DIR, 'safety-verify-removed.jsonl'),   sv.removed);
  writeJsonl(path.join(V2_STAGE_DIR, 'dedupe-removed.jsonl'),          dd.removed);
  writeJsonl(path.join(V2_STAGE_DIR, 'persona-firewall-removed.jsonl'), pf.removed);
  log(`[real] wrote ${TRAIN_OUT}`);
  log(`[real] wrote ${VALID_OUT}`);
  log(`[real] wrote ${HELDOUT_OUT}`);

  // Merkle roots
  const trainHashes   = sp.train.map(rowHashCanonical);
  const validHashes   = sp.valid.map(rowHashCanonical);
  const heldoutHashesArr = [...heldoutHashes];
  const trainRoot   = merkleRoot(trainHashes);
  const validRoot   = merkleRoot(validHashes);
  const heldoutRoot = merkleRoot(heldoutHashesArr);
  const combinedRoot = merkleRoot([
    trainRoot.replace('slat-merkle-v1:', ''),
    validRoot.replace('slat-merkle-v1:', ''),
    heldoutRoot.replace('slat-merkle-v1:', ''),
  ]);
  log(`[real] train    ${trainRoot}`);
  log(`[real] valid    ${validRoot}`);
  log(`[real] heldout  ${heldoutRoot}`);
  log(`[real] combined ${combinedRoot}`);

  // File hashes
  const trainFileHash   = sha256Hex(fs.readFileSync(TRAIN_OUT));
  const validFileHash   = sha256Hex(fs.readFileSync(VALID_OUT));
  const heldoutFileHash = sha256Hex(fs.readFileSync(HELDOUT_OUT));

  // Sign
  const { signatureHex, pkHex } = signMessage(combinedRoot);
  log(`[real] signed OK  sig=${signatureHex.slice(0, 16)}...`);

  // Prior root from v1
  let priorRoot = 'slat-merkle-v1:0000000000000000000000000000000000000000000000000000000000000000';
  if (fs.existsSync(MANIFEST_V1)) {
    const v1txt = fs.readFileSync(MANIFEST_V1, 'utf-8');
    const m = /:combined-root\s+"([^"]+)"/.exec(v1txt);
    if (m) priorRoot = m[1];
  }

  // Manifest
  const manifest = buildManifest({
    counts, trainRoot, validRoot, heldoutRoot, combinedRoot, priorRoot,
    trainFileHash, validFileHash, heldoutFileHash,
    signatureHex, pkHex, agg, pfTop,
  });
  fs.writeFileSync(MANIFEST_V2, manifest, 'utf-8');
  log(`[real] manifest written → ${MANIFEST_V2}`);

  // Report
  const report = buildReport({ counts, agg, pfTop, trainRoot, validRoot, heldoutRoot, combinedRoot, signatureHex });
  fs.writeFileSync(REPORT_OUT, report, 'utf-8');
  log(`[real] report written → ${REPORT_OUT}`);

  log('');
  log('=== MOTOI FOLD v2 COMPLETE ===');
  for (const [k, v] of Object.entries(counts)) log(`  ${k.padEnd(28)} ${v}`);
}

// ---------------------------------------------------------------------------
// TEXT BUILDERS
// ---------------------------------------------------------------------------
function buildDryRunPreview(counts, agg, ts, sv, dd, pf, pfTop) {
  const src = agg.perSource.map(s => {
    if (s.excluded) return `                    ("${s.name}" :excluded #t)`;
    if (s.missing)  return `                    ("${s.name}" :missing #t)`;
    return `                    ("${s.name}" ${s.count})`;
  }).join('\n');
  return `(motoi-fold-v2-dryrun
  :ts             #inst "${new Date().toISOString()}"
  :mode           "dry-run"
  :note           "NO signed manifest, NO train/valid/heldout jsonl written. Manifest-v1 untouched."
  :counts (
${Object.entries(counts).map(([k, v]) => `                    (:${k.replaceAll('_', '-')} ${v})`).join('\n')}
                    )
  :source-list (
${src}
                    )
  :book-tally     ${agg.bookFiles.length}
  :book-manifests ${agg.bookManifests.length}
  :eng-eligible   ${agg.engEligible.length}
  :reference      "${agg.referencePresent ? path.basename(REFERENCE_FILE) : 'MISSING'}"
  :safety (
                    (:crisis    :checked ${sv.crisisChecked}    :removed ${sv.crisisRemoved})
                    (:emergency :checked ${sv.emergencyChecked} :removed ${sv.emergencyRemoved})
                    (:template-threshold ${SAFETY_MATCH_THRESHOLD})
                    )
  :top-firewall-patterns (
${pfTop.map(([p, c]) => `                    ("${p.replace(/"/g, '\\"')}" ${c})`).join('\n') || '                    (none)'}
                    )
  :sample-tool-strip-removals (
${ts.removed.slice(0, 5).map(r =>
    `                    (:source "${r.source || 'n/a'}" :reason "${r.reason.replace(/"/g, '\\"').slice(0, 80)}")`
  ).join('\n') || '                    (none)'}
                    )
  :sample-dedupe-removals (
${dd.removed.slice(0, 3).map(r =>
    `                    (:source "${r.source || 'n/a'}" :first-seen "${r.first_seen_in || 'n/a'}")`
  ).join('\n') || '                    (none)'}
                    ))
`;
}

function buildManifest({
  counts, trainRoot, validRoot, heldoutRoot, combinedRoot, priorRoot,
  trainFileHash, validFileHash, heldoutFileHash,
  signatureHex, pkHex, agg, pfTop,
}) {
  const srcList = agg.perSource
    .filter(s => !s.missing && !s.excluded && s.count > 0)
    .map(s => `                    ("${s.name}" ${s.count})`).join('\n');
  const pfTopStr = pfTop.length
    ? pfTop.map(([p, c]) => `                    ("${p.replace(/"/g, '\\"')}" ${c})`).join('\n')
    : '                    (none)';
  return `(slat-set
  :corpus-name       "motoi-corpus-v2"
  :fold-name         "${FOLD_NAME}"
  :ts-finalized      #inst "${FOLD_TS}"
  :base-model        "Qwen2.5-Coder-1.5B-Instruct"
  :persona           "motoi-0.75-fun-jokes-coder-no-tools-no-internet"
  :version           "0.75"
  :row-count         ${counts.train_rows + counts.valid_rows + counts.heldout_rows}
  :train-rows        ${counts.train_rows}
  :valid-rows        ${counts.valid_rows}
  :heldout-rows      ${counts.heldout_rows}
  :hash-algo         "sha256"
  :merkle-scheme     "slat-merkle-v1"
  :train-root        "${trainRoot}"
  :valid-root        "${validRoot}"
  :heldout-root      "${heldoutRoot}"
  :combined-root     "${combinedRoot}"
  :previous-combined-root "${priorRoot}"
  :sha256-train      "${trainFileHash}"
  :sha256-valid      "${validFileHash}"
  :sha256-heldout    "${heldoutFileHash}"
  :held-out-contract "carve-heldout-2026-07-16 (${counts.heldout_rows} pairs) — preserved. train∩valid=0 train∩heldout=0 valid∩heldout=0 verified."
  :held-out-file     "~/.forge/corpus/motoi/heldout.jsonl"
  :valid-split       "${Math.round(VALID_FRACTION * 100)}% of post-filter remainder (seed=${RANDOM_SEED})"
  :random-seed       ${RANDOM_SEED}
  :dedup-policy      "content-hash sha256 over messages; verbatim drops only"
  :dedup-count       ${counts.dedupe_removed}
  :tool-strip-count  ${counts.tool_strip_removed}
  :safety-verify-count ${counts.safety_verify_removed}
  :safety-crisis-checked   ${counts.safety_crisis_checked}
  :safety-crisis-removed   ${counts.safety_crisis_removed}
  :safety-emergency-checked ${counts.safety_emergency_checked}
  :safety-emergency-removed ${counts.safety_emergency_removed}
  :safety-template-threshold ${SAFETY_MATCH_THRESHOLD}
  :persona-firewall-count ${counts.persona_firewall_removed}
  :persona-firewall-top (
${pfTopStr}
                    )
  :signed-by         "cortex@motoi"
  :signature-algo    "ed25519"
  :signature         #hex "${signatureHex}"
  :public-key        #hex "${pkHex}"
  :key-path          "~/.motoi/keys/cortex-motoi.ed25519 (private, 0600) · ~/.motoi/keys/cortex-motoi.pub (public)"
  :source-list (
${srcList}
                    )
  :book-tally        (:chapter-files ${agg.bookFiles.length} :manifests ${agg.bookManifests.length})
  :eng-eligible      ${agg.engEligible.length}
  :reference         "${path.basename(REFERENCE_FILE)}"
  :provenance-note   "Motoi 0.75 v2 fold. Adds tool-strip + safety-verify filters over v1 discipline. Preserves 1001-row held-out contract. Persona firewall widened to catch Sakura dialect verbs, philosopher name-drops, and corporate names. Base = Qwen2.5-Coder-1.5B-Instruct per training-config lock."
  :owner-authorization "gated on Alfred GO — this manifest exists only if Alfred said GO on training prep")
`;
}

function buildReport({ counts, agg, pfTop, trainRoot, validRoot, heldoutRoot, combinedRoot, signatureHex }) {
  return `(fold-report
  :fold-name    "${FOLD_NAME}"
  :ts-executed  #inst "${new Date().toISOString()}"
  :spec         "engineering/FOLD-TRAIN-PLAN-0.75.ENG.slat :fold-procedure"
  :executor     "scripts/motoi-fold-v2.mjs"

  :counts (
${Object.entries(counts).map(([k, v]) => `                    (:${k.replaceAll('_', '-')} ${v})`).join('\n')}
                    )

  :merkle (
                    (:train    "${trainRoot}")
                    (:valid    "${validRoot}")
                    (:heldout  "${heldoutRoot}")
                    (:combined "${combinedRoot}")
                    )
  :signature-prefix "${signatureHex.slice(0, 32)}..."

  :sources-loaded ${agg.perSource.filter(s => !s.missing && !s.excluded && s.count > 0).length}
  :sources-excluded ${agg.perSource.filter(s => s.excluded).length}
  :sources-missing  ${agg.perSource.filter(s => s.missing).length}

  :book-provenance (:chapter-files ${agg.bookFiles.length} :manifests ${agg.bookManifests.length})
  :eng-eligible-tally ${agg.engEligible.length}

  :filter-notes
"# Filter behaviour
- TOOL-STRIP: matches on assistant text against ${TOOL_STRIP_PATTERNS.length} patterns +
  URL fabrication regex (whitelist: localhost + example.{com,org,net} + motoi.local)
- SAFETY-VERIFY: crisis triggers (self-harm) & emergency triggers (fire/medical/etc)
  require ≥${Math.round(SAFETY_MATCH_THRESHOLD * 100)}% word-overlap with the canonical template.
  Templates locked to project_motoi_safety_refusals_2026_07_17. Wave-6 file provides
  the ground-truth template (used as the reference match).
- DEDUPE: sha256 over canonicalised message list (roles sorted per message).
- PERSONA-FIREWALL: strips Sakura dialect verbs (card/shop/flower/marionette/etc),
  philosopher name-drops, corporate names, Motoi PII paths.

# Held-out contract
- 1001 pre-carved rows preserved from training-data/held-out/heldout-2026-07-16.jsonl
- Contract enforced by set-difference AFTER all filters, BEFORE split.
- Verified train∩valid=0, train∩heldout=0, valid∩heldout=0.

# Not covered by this pass (out of scope)
- Downloading model weights (Forge project scaffold handles that separately)
- Starting training (gated on Alfred GO)
- Modifying curator/ or sakura-scheme/ (never)
- Touching ~/.forge/state/ locks (never)"

  :next-step "Notify Alfred (iPhone AskUserQuestion ping). Forge project 'motoi' scaffolding + LLM hookup are peer lanes; those artifacts live at ~/.forge/projects/motoi/ and scripts/motoi-llm-up.sh respectively."
  :status    "ready-for-alfred-approval")
`;
}

// ---------------------------------------------------------------------------
// ENTRY
// ---------------------------------------------------------------------------
main().catch(e => { console.error(e.stack || e.message || String(e)); process.exit(1); });
