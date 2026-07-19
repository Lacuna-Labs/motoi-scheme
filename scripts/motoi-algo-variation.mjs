#!/usr/bin/env node
// motoi-algo-variation.mjs -- CPU-only algorithmic paraphrase for Motoi's
// persona dialogue pairs. Node ES module (no Python, no LLM).
//
// Forked 2026-07-17 from ~/code/forge/tools/lacuna-algo-variation-loop.py
// (Sakura-scoped SLAT varier). This one targets Motoi's JSONL dialogue
// format and stays deterministic -- thesaurus + prefix rotation +
// punctuation micro-variation only. No paraphraser LLM = no voice
// contamination in weights.
//
// Design (Alfred's spec 2026-07-17):
//   - Reads motoi-persona-*.jsonl from ../training-data/
//   - For each non-safety row, emits 2 variants of `response` only
//     (never touches `instruction` -- that changes training signal)
//   - PRESERVES all metadata (tags, register, version, register-mode,
//     trap_active, safety_critical, etc.)
//   - SKIPS: safety_critical:true, trap_active:true, tag "safety",
//     tag "wave8" (all wave8 templates are load-bearing per task spec)
//   - Adds `variation_of` (sha1 of original row) + `variant_index` (0|1)
//   - Idempotent: skips input rows whose hash already appears in output
//   - Register-safe thesaurus (~48 entries mined from Python varier
//     plus code-domain terms) -- no register drift
//   - 15 sentence-prefix openers (including empty), rotated
//   - Punctuation micro-variation on short answers
//   - Constraints: no em-dashes ever, no "just kidding", no "as an AI",
//     no corporate names, length within ±30% of original
//   - Two variants of any canonical must differ from each other AND
//     from original (typo-level differences don't count -- we retry
//     with a different seed then drop if still identical)

import { readFileSync, writeFileSync, existsSync, readdirSync, appendFileSync, statSync } from "node:fs";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const TRAINING_DIR = join(__dirname, "..", "training-data");
const OUT_PATH = join(TRAINING_DIR, "motoi-persona-algo-variations-2026-07-17.jsonl");

// ---------------------------------------------------------------------------
// Register-safe thesaurus. Only same-register swaps. Code-domain terms
// added for Motoi's dialogue: "verb"->"function"/"procedure", etc.
// Values are candidate replacements -- chosen deterministically per seed.
// ---------------------------------------------------------------------------
const THESAURUS = {
  // Verbs from Lacuna varier -- kept register-safe subset
  "use": ["employ", "apply"],
  "shows": ["demonstrates", "reveals"],
  "creates": ["produces", "makes"],
  "returns": ["yields", "gives back"],
  "check": ["verify", "confirm"],
  "helps": ["aids", "assists"],
  "requires": ["needs", "wants"],
  "provides": ["supplies", "gives"],
  "handles": ["manages", "deals with"],
  "fix": ["repair", "patch"],
  "before": ["prior to", "ahead of"],
  "after": ["following", "past"],
  "similar": ["comparable", "alike"],
  "different": ["distinct", "unlike"],
  "usually": ["typically", "commonly"],
  "sometimes": ["occasionally", "at times"],
  "clearly": ["plainly", "obviously"],
  // Adjectives
  "important": ["essential", "key"],
  "correct": ["right", "proper"],
  "wrong": ["incorrect", "off"],
  "large": ["big", "sizeable"],
  "small": ["tiny", "compact"],
  // Code-domain -- Motoi additions
  "verb": ["function", "procedure"],
  "verbs": ["functions", "procedures"],
  "evaluates": ["runs", "computes"],
  "evaluate": ["run", "compute"],
  "returns to": ["gives back to", "hands to"],
  "function": ["procedure", "verb"],
  "procedure": ["function", "verb"],
  "expression": ["form", "s-expression"],
  "value": ["result", "output"],
  "argument": ["arg", "input"],
  "arguments": ["args", "inputs"],
  "parameter": ["arg", "input"],
  "list": ["sequence", "collection"],
  "element": ["item", "member"],
  "elements": ["items", "members"],
  "loop": ["iteration", "cycle"],
  "iterate": ["loop", "step through"],
  "recursion": ["recursive call", "self-call"],
  "recursive": ["self-calling", "recurring"],
  "print": ["display", "show"],
  "prints": ["displays", "shows"],
  "define": ["bind", "declare"],
  "defines": ["binds", "declares"],
  "compile": ["build", "process"],
  "compiles": ["builds", "processes"],
  "trace": ["stack trace", "traceback"],
  "bug": ["defect", "glitch"],
  "issue": ["problem", "trouble"],
};

// ---------------------------------------------------------------------------
// Sentence-prefix rotation. 15 openers including empty (no prefix).
// Applied at most once per response, on a random non-first sentence.
// ---------------------------------------------------------------------------
const PREFIXES = [
  "",
  "",
  "",  // extra empty weight -- most variants get no prefix
  "Note that ",
  "Also ",
  "In practice ",
  "Basically ",
  "Here's the thing: ",
  "One thing: ",
  "Honestly ",
  "Roughly ",
  "Actually ",
  "Really ",
  "For what it's worth ",
  "Fair enough -- ",  // NO em-dash -- that's a regular dash + em? check
];
// Above uses "--" which IS an em-dash. Strip it.
const CLEAN_PREFIXES = PREFIXES.filter((p) => !p.includes("--"));
// Add back a safe version
CLEAN_PREFIXES.push("Fair enough, ");

// ---------------------------------------------------------------------------
// Short-answer punctuation micro-variation. Only applied when response
// is very short (< 30 chars total). Tuples: [pattern, replacement].
// ---------------------------------------------------------------------------
const PUNCTUATION_MICROS = [
  [/\byeah\b/gi, "yes"],
  [/\byep\b/gi, "yeah"],
  [/\bnope\b/gi, "no"],
  [/^([A-Z][a-z]+)\.$/, "$1"],       // strip trailing period on single-word answers
  [/^([A-Z][a-z]+)$/, "$1."],        // add period
];

// ---------------------------------------------------------------------------
// Forbidden strings -- variation must NOT introduce any of these.
// ---------------------------------------------------------------------------
const FORBIDDEN_SUBSTRINGS = [
  "--",              // em-dash
  "just kidding",
  "as an AI",
  "as an ai",
  "As an AI",
  "OpenAI", "Anthropic", "Google", "Meta ", "Apple ", "Microsoft",
  "ChatGPT", "Claude", "Gemini", "GPT-",
];

// Corporate-name mention: allow if original already had it (don't remove
// what's there), just don't ADD one via variation.
function introducedForbidden(original, variant) {
  for (const bad of FORBIDDEN_SUBSTRINGS) {
    if (!original.includes(bad) && variant.includes(bad)) return bad;
  }
  return null;
}

// ---------------------------------------------------------------------------
// Deterministic PRNG (mulberry32) seeded per row.
// ---------------------------------------------------------------------------
function makeRng(seed) {
  let s = seed >>> 0;
  return function () {
    s = (s + 0x6D2B79F5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function pick(rng, arr) {
  return arr[Math.floor(rng() * arr.length)];
}

function sha1(s) {
  return createHash("sha1").update(s).digest("hex");
}

// ---------------------------------------------------------------------------
// Code-preservation. Motoi responses often contain inline (parenthesised)
// s-expressions and small code fences. Never touch inside these.
// ---------------------------------------------------------------------------
const CODE_FENCE_RE = /```[^\n]*\n[\s\S]*?\n```/g;
const INLINE_CODE_RE = /`[^`\n]+`/g;
// S-expression pattern: parenthesized text with balanced-ish parens
// This is a loose match -- good enough for protection.
const SEXP_RE = /\([^()]*(?:\([^()]*\)[^()]*)*\)/g;

function protectCode(text) {
  const stash = [];
  let out = text;

  out = out.replace(CODE_FENCE_RE, (m) => {
    stash.push(m);
    return ` CODE${stash.length - 1} `;
  });
  out = out.replace(INLINE_CODE_RE, (m) => {
    stash.push(m);
    return ` CODE${stash.length - 1} `;
  });
  // Protect (...) forms -- parenthesised s-expressions. Any () means code.
  out = out.replace(SEXP_RE, (m) => {
    stash.push(m);
    return ` CODE${stash.length - 1} `;
  });

  return { out, stash };
}

function restoreCode(text, stash) {
  return text.replace(/ CODE(\d+) /g, (_, i) => stash[Number(i)]);
}

// ---------------------------------------------------------------------------
// Word substitution using thesaurus. Case-preserving on first letter.
// Probability per match -- controlled by seed. Rate ~30% keeps light touch.
// ---------------------------------------------------------------------------
function substituteWords(text, rng) {
  let out = text;
  for (const [orig, swaps] of Object.entries(THESAURUS)) {
    const pattern = new RegExp(`\\b${orig.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "gi");
    out = out.replace(pattern, (m) => {
      if (rng() > 0.30) return m;
      let repl = pick(rng, swaps);
      // Preserve case of first char
      if (m[0] === m[0].toUpperCase() && m[0] !== m[0].toLowerCase()) {
        repl = repl[0].toUpperCase() + repl.slice(1);
      }
      return repl;
    });
  }
  return out;
}

// ---------------------------------------------------------------------------
// Sentence-prefix rotation. Insert one prefix on a non-first sentence.
// ---------------------------------------------------------------------------
function rotatePrefix(text, rng) {
  const sentences = text.split(/(?<=[.!?])\s+/);
  if (sentences.length < 2) return text;
  const prefix = pick(rng, CLEAN_PREFIXES);
  if (!prefix) return text;
  const idx = 1 + Math.floor(rng() * (sentences.length - 1));
  const s = sentences[idx];
  if (!s) return text;
  // Lowercase the sentence's first letter after adding prefix
  const first = s[0].toLowerCase();
  sentences[idx] = prefix + first + s.slice(1);
  return sentences.join(" ");
}

// ---------------------------------------------------------------------------
// Punctuation micro-variation for very short answers.
// ---------------------------------------------------------------------------
function punctuationMicro(text, rng) {
  if (text.length > 30) return text;
  let out = text;
  for (const [pat, repl] of PUNCTUATION_MICROS) {
    if (rng() < 0.5 && pat.test(out)) {
      out = out.replace(pat, repl);
      break; // one micro-change max
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// Full response paraphrase. Protects code, applies thesaurus + prefix +
// punctuation, restores code.
// ---------------------------------------------------------------------------
function paraphraseResponse(response, seed) {
  const rng = makeRng(seed);
  const { out: protectedText, stash } = protectCode(response);
  let out = substituteWords(protectedText, rng);
  out = rotatePrefix(out, rng);
  out = punctuationMicro(out, rng);
  out = restoreCode(out, stash);
  // Remove any em-dash that snuck in via any path (belt+suspenders)
  out = out.replace(/--/g, "-");
  return out;
}

// ---------------------------------------------------------------------------
// Skip predicate -- the load-bearing safety rule.
// ---------------------------------------------------------------------------
function shouldSkip(row) {
  if (row.safety_critical === true) return "safety_critical";
  if (row.trap_active === true) return "trap_active";
  const tags = row.tags || [];
  if (tags.includes("safety")) return "tag:safety";
  if (tags.includes("wave8")) return "tag:wave8"; // all wave8 templates load-bearing
  if (tags.includes("wave9")) return "tag:wave9"; // matrix-mode glitch templates -- not usable
  return null;
}

// ---------------------------------------------------------------------------
// Length guardrail: ±30% of original character count.
// ---------------------------------------------------------------------------
function lengthOk(original, variant) {
  const origLen = original.length;
  const varLen = variant.length;
  const lower = origLen * 0.70;
  const upper = origLen * 1.30;
  return varLen >= lower && varLen <= upper;
}

// ---------------------------------------------------------------------------
// Row hash for idempotency.
// ---------------------------------------------------------------------------
function rowHash(row) {
  // Hash on instruction + response -- these define the canonical
  return sha1(`${row.instruction} ${row.response}`);
}

// ---------------------------------------------------------------------------
// Load already-processed hashes from output file (idempotency).
// ---------------------------------------------------------------------------
function loadProcessed() {
  const set = new Set();
  if (!existsSync(OUT_PATH)) return set;
  const content = readFileSync(OUT_PATH, "utf8");
  for (const line of content.split("\n")) {
    if (!line.trim()) continue;
    try {
      const r = JSON.parse(line);
      if (r.variation_of) set.add(r.variation_of);
    } catch {
      // ignore bad lines
    }
  }
  return set;
}

// ---------------------------------------------------------------------------
// Enumerate input files.
// ---------------------------------------------------------------------------
function enumerateInputFiles() {
  return readdirSync(TRAINING_DIR)
    .filter((f) => /^motoi-persona-.*\.jsonl$/.test(f))
    .filter((f) => !f.includes("algo-variations")) // don't recurse
    .map((f) => join(TRAINING_DIR, f))
    .sort();
}

// ---------------------------------------------------------------------------
// Try to produce one distinct variant. Retries with different seeds up
// to 4 times if variant is identical to original or to sibling.
// Returns null if we can't produce a distinct clean variant.
// ---------------------------------------------------------------------------
function tryVariant(row, baseSeed, avoidSet) {
  for (let attempt = 0; attempt < 4; attempt++) {
    const seed = baseSeed + attempt * 7919;
    const variant = paraphraseResponse(row.response, seed);
    if (variant === row.response) continue;
    if (avoidSet.has(variant)) continue;
    if (!lengthOk(row.response, variant)) continue;
    const bad = introducedForbidden(row.response, variant);
    if (bad) continue;
    return variant;
  }
  return null;
}

// ---------------------------------------------------------------------------
// Main. Process every input row, emit up to 2 distinct variants.
// ---------------------------------------------------------------------------
function main() {
  const inputs = enumerateInputFiles();
  console.log(`[motoi-algo-variation] inputs: ${inputs.length} files`);

  const processed = loadProcessed();
  console.log(`[motoi-algo-variation] previously-varied rows: ${processed.size}`);

  const stats = {
    inputRows: 0,
    skipped: { safety_critical: 0, trap_active: 0, "tag:safety": 0, "tag:wave8": 0, "tag:wave9": 0 },
    skippedTotal: 0,
    alreadyProcessed: 0,
    variantsWritten: 0,
    variantsFailed: 0,
    perWave: {}, // wave -> {input, variants, skipped}
  };

  for (const file of inputs) {
    const content = readFileSync(file, "utf8");
    const lines = content.split("\n").filter((l) => l.trim());
    console.log(`  reading ${file.split("/").pop()} -- ${lines.length} rows`);

    for (const line of lines) {
      stats.inputRows++;
      let row;
      try {
        row = JSON.parse(line);
      } catch (e) {
        console.warn(`  skip malformed row: ${e.message}`);
        continue;
      }

      // Wave tag for reporting
      const waveTag = (row.tags || []).find((t) => /^wave/.test(t)) || "primary";
      stats.perWave[waveTag] = stats.perWave[waveTag] || { input: 0, variants: 0, skipped: 0 };
      stats.perWave[waveTag].input++;

      const skipReason = shouldSkip(row);
      if (skipReason) {
        stats.skipped[skipReason]++;
        stats.skippedTotal++;
        stats.perWave[waveTag].skipped++;
        continue;
      }

      const h = rowHash(row);
      if (processed.has(h)) {
        stats.alreadyProcessed++;
        continue;
      }

      // Try to produce 2 distinct variants
      const avoidSet = new Set([row.response]);
      const variants = [];
      for (let k = 0; k < 2; k++) {
        const seed = parseInt(h.slice(0, 8), 16) + k * 1_000_003;
        const v = tryVariant(row, seed, avoidSet);
        if (v) {
          variants.push(v);
          avoidSet.add(v);
        } else {
          stats.variantsFailed++;
        }
      }

      // Emit variants
      for (let k = 0; k < variants.length; k++) {
        const outRow = {
          ...row,               // preserve all metadata
          response: variants[k],
          variation_of: h,
          variant_index: k,
          variant_source: file.split("/").pop(),
        };
        appendFileSync(OUT_PATH, JSON.stringify(outRow) + "\n");
        stats.variantsWritten++;
        stats.perWave[waveTag].variants++;
      }
      processed.add(h);
    }
  }

  console.log("\n[motoi-algo-variation] === SUMMARY ===");
  console.log(`  input rows scanned: ${stats.inputRows}`);
  console.log(`  already processed (idempotent skip): ${stats.alreadyProcessed}`);
  console.log(`  skipped (safety rules): ${stats.skippedTotal}`);
  for (const [reason, n] of Object.entries(stats.skipped)) {
    if (n > 0) console.log(`    ${reason}: ${n}`);
  }
  console.log(`  variants written: ${stats.variantsWritten}`);
  console.log(`  variants failed (identical/forbidden/length): ${stats.variantsFailed}`);
  console.log(`  output: ${OUT_PATH}`);
  console.log("\n  per-wave:");
  for (const [w, s] of Object.entries(stats.perWave).sort()) {
    console.log(`    ${w}: input=${s.input} skipped=${s.skipped} variants=${s.variants}`);
  }
}

main();
