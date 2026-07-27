#!/usr/bin/env node
// weave-laser.mjs — Weave 0.75 Step 2 (LASER) driver.
//
// Doctrine: engineering/WEAVE-RECIPE.md (Weave 0.75 Step 2)
// Runbook: SRE-MANUAL/chapters/03-weave-finish.slat (section-3)
// Research: engineering/FINISHING-MOVE-RESEARCH-2026-07-20.md (section 5)
// Implementation: scripts/weave-laser-impl.py (Python side, MLX + numpy)
//
// This Node driver:
//   1. Parses args.
//   2. Shells out to the Python implementation via the forge venv.
//   3. The Python side loads MLX model ONCE, sweeps rank cuts across
//      candidate (layer, projection) targets in-memory (mutating LoRALinear
//      weights per candidate + restoring after), picks best, applies to
//      the SFT adapter, saves output + report.
//   4. Verifies output existence.
//
// Constraints:
//   - --input (SFT safetensors) is IMMUTABLE — never overwritten.
//   - Working slot ~/.forge/runs/motoi-mk1/adapter/adapters.safetensors is
//     NOT touched by this script. Human decides when to promote LASER output.
//   - Local only. No new npm deps.

import { existsSync, mkdirSync, readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { spawnSync } from 'node:child_process'

const FORGE_VENV_PYTHON = '/Users/alfred/code/forge/.venv/bin/python'

function parseArgs(argv) {
  const args = {
    input: null,
    adapterConfig: null,
    calibration: null,
    output: null,
    report: null,
    baseModel: 'Qwen/Qwen2.5-Coder-1.5B-Instruct',
    maxTokens: 200,
    rankCuts: '2,4,8,16,32,64,96',
    downProjLayers: '20,21,22,23,24,25,26,27',
    oProjLayers: '24,25,26,27',
    candidateCap: 100,
    wallClockCapS: 90 * 60,
    python: FORGE_VENV_PYTHON,
    dryRun: false,
  }
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i]
    const takeVal = () => {
      const v = argv[++i]
      if (v === undefined) { console.error(`--${a} needs a value`); process.exit(2) }
      return v
    }
    if (a === '--input') args.input = takeVal()
    else if (a === '--adapter-config') args.adapterConfig = takeVal()
    else if (a === '--calibration') args.calibration = takeVal()
    else if (a === '--output') args.output = takeVal()
    else if (a === '--report') args.report = takeVal()
    else if (a === '--base-model') args.baseModel = takeVal()
    else if (a === '--max-tokens') args.maxTokens = parseInt(takeVal(), 10)
    else if (a === '--rank-cuts') args.rankCuts = takeVal()
    else if (a === '--down-proj-layers') args.downProjLayers = takeVal()
    else if (a === '--o-proj-layers') args.oProjLayers = takeVal()
    else if (a === '--candidate-cap') args.candidateCap = parseInt(takeVal(), 10)
    else if (a === '--wall-clock-cap-s') args.wallClockCapS = parseFloat(takeVal())
    else if (a === '--python') args.python = takeVal()
    else if (a === '--dry-run') args.dryRun = true
    else if (a === '-h' || a === '--help') {
      console.log(`weave-laser.mjs — Weave 0.75 Step 2 (LASER)

Required:
  --input PATH               SFT adapter safetensors (immutable)
  --adapter-config PATH      Adapter config JSON
  --calibration PATH         Calibration JSONL (subset for sweep, ~30 prompts)
  --output PATH              LASER-adapted safetensors output
  --report PATH              JSON report output

Optional:
  --base-model NAME          HF base model id (default Qwen/Qwen2.5-Coder-1.5B-Instruct)
  --max-tokens N             Cap tokens generated per calibration prompt (default 200)
  --rank-cuts LIST           Comma-sep rank cuts k (default 2,4,8,16,32,64,96)
  --down-proj-layers LIST    Layer indices for MLP down_proj sweep (default 20-27)
  --o-proj-layers LIST       Layer indices for attn o_proj sweep (default 24-27)
  --candidate-cap N          Hard cap on candidates (default 100)
  --wall-clock-cap-s S       Kill sweep after S seconds (default 5400 = 90 min)
  --python PATH              Python interpreter (default forge venv)
  --dry-run                  Print plan and exit`)
      process.exit(0)
    } else {
      console.error(`Unknown arg: ${a}`)
      process.exit(2)
    }
  }
  const req = ['input', 'adapterConfig', 'calibration', 'output', 'report']
  for (const r of req) {
    if (!args[r]) {
      const flagName = r.replace(/[A-Z]/g, m => '-' + m.toLowerCase())
      console.error(`Missing --${flagName}`); process.exit(2)
    }
  }
  args.input = resolve(args.input)
  args.adapterConfig = resolve(args.adapterConfig)
  args.calibration = resolve(args.calibration)
  args.output = resolve(args.output)
  args.report = resolve(args.report)
  return args
}

function main() {
  const args = parseArgs(process.argv)
  if (!existsSync(args.input)) { console.error(`--input not found: ${args.input}`); process.exit(2) }
  if (!existsSync(args.adapterConfig)) { console.error(`--adapter-config not found: ${args.adapterConfig}`); process.exit(2) }
  if (!existsSync(args.calibration)) { console.error(`--calibration not found: ${args.calibration}`); process.exit(2) }
  mkdirSync(dirname(args.output), { recursive: true })
  mkdirSync(dirname(args.report), { recursive: true })

  console.log('weave-laser (Weave 0.75 Step 2)')
  console.log(`  input:            ${args.input}`)
  console.log(`  adapter-config:   ${args.adapterConfig}`)
  console.log(`  calibration:      ${args.calibration}`)
  console.log(`  output:           ${args.output}`)
  console.log(`  report:           ${args.report}`)
  console.log(`  rank-cuts:        ${args.rankCuts}`)
  console.log(`  down-proj layers: ${args.downProjLayers}`)
  console.log(`  o-proj layers:    ${args.oProjLayers}`)
  console.log(`  candidate-cap:    ${args.candidateCap}`)
  console.log(`  max-tokens:       ${args.maxTokens}`)
  console.log(`  wall-clock cap:   ${args.wallClockCapS}s`)

  if (args.dryRun) {
    console.log('\n[dry-run] Not executing.')
    process.exit(0)
  }

  const script = resolve(new URL('.', import.meta.url).pathname, 'weave-laser-impl.py')
  if (!existsSync(script)) { console.error(`Impl missing: ${script}`); process.exit(2) }

  const argv = [
    script,
    '--input', args.input,
    '--adapter-config', args.adapterConfig,
    '--calibration', args.calibration,
    '--output', args.output,
    '--report', args.report,
    '--base-model', args.baseModel,
    '--max-tokens', String(args.maxTokens),
    '--rank-cuts', args.rankCuts,
    '--down-proj-layers', args.downProjLayers,
    '--o-proj-layers', args.oProjLayers,
    '--candidate-cap', String(args.candidateCap),
    '--wall-clock-cap-s', String(args.wallClockCapS),
  ]

  console.log(`\nInvoking: ${args.python} ${script} ...`)
  const t0 = Date.now()
  const res = spawnSync(args.python, argv, {
    stdio: 'inherit',
    timeout: 4 * 60 * 60 * 1000,  // 4h hard cap
  })
  const dt = ((Date.now() - t0) / 1000).toFixed(1)

  if (res.status !== 0) {
    console.error(`\nPython impl failed (exit ${res.status}) after ${dt}s`)
    process.exit(res.status || 1)
  }

  if (!existsSync(args.output)) { console.error(`Output not written: ${args.output}`); process.exit(1) }
  if (!existsSync(args.report)) { console.error(`Report not written: ${args.report}`); process.exit(1) }

  console.log(`\nLASER sweep + apply complete in ${dt}s.`)
  console.log(`  output: ${args.output}`)
  console.log(`  report: ${args.report}`)
  try {
    const rpt = JSON.parse(readFileSync(args.report, 'utf8'))
    const c = rpt.chosen
    console.log(`  chosen: ${c.target} k=${c.k}  composite=${c.composite.toFixed(3)} `
                + `vr=${c.verb_recall_rate.toFixed(2)} ct=${c.circular_trap_rate.toFixed(2)} `
                + `lr=${c.lang_resistance_rate.toFixed(2)}`)
    console.log(`  candidates run: ${rpt.sweep.n_candidates_run}/${rpt.sweep.n_candidates_total}`)
  } catch (e) { console.error('report parse failed:', e.message) }
}

main()
