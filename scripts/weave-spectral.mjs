#!/usr/bin/env node
// weave-spectral.mjs — Weave 0.75 Step 1 (Spectral Surgery) driver.
//
// Doctrine: engineering/WEAVE-RECIPE.md (Weave 0.75 Step 1)
// Runbook: SRE-MANUAL/chapters/03-weave-finish.slat (section-2)
// Research: engineering/FINISHING-MOVE-RESEARCH-2026-07-20.md (section 10)
// Implementation: scripts/weave-spectral-impl.py (Python side, MLX + numpy)
//
// This Node driver:
//   1. Parses args (matches the doctrine's CLI shape).
//   2. Prepares a temporary "adapter load dir" so mlx_lm.load can find
//      the SFT safetensors under its expected filename adapters.safetensors,
//      alongside adapter_config.json. Uses symlinks — the SFT file itself
//      is not copied and not modified.
//   3. Shells out to the Python implementation.
//   4. Verifies output existence + report JSON.
//
// Constraints:
//   - Never overwrite --input.
//   - Local only.
//   - No new npm deps (uses node:fs, node:child_process, node:path only).

import { existsSync, mkdirSync, symlinkSync, unlinkSync, readFileSync } from 'node:fs'
import { dirname, resolve, join } from 'node:path'
import { spawnSync } from 'node:child_process'
import { tmpdir } from 'node:os'

const FORGE_VENV_PYTHON = '/Users/alfred/code/forge/.venv/bin/python'

function parseArgs(argv) {
  const args = {
    input: null,
    calibration: null,
    output: null,
    report: null,
    amplifyTopFrac: 0.15,
    shrinkBottomFrac: 0.30,
    amplifyFactor: 1.5,
    shrinkFactor: 0.5,
    baseModel: 'Qwen/Qwen2.5-Coder-1.5B-Instruct',
    maxTokensPerPrompt: 64,
    python: FORGE_VENV_PYTHON,
    dryRun: false,
    adapterConfig: null,  // path to adapter_config.json for load-dir prep
  }
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i]
    const takeVal = () => {
      const v = argv[++i]
      if (v === undefined) { console.error(`--${a} needs a value`); process.exit(2) }
      return v
    }
    if (a === '--input') args.input = takeVal()
    else if (a.startsWith('--input=')) args.input = a.split('=')[1]
    else if (a === '--calibration') args.calibration = takeVal()
    else if (a.startsWith('--calibration=')) args.calibration = a.split('=')[1]
    else if (a === '--output') args.output = takeVal()
    else if (a.startsWith('--output=')) args.output = a.split('=')[1]
    else if (a === '--report') args.report = takeVal()
    else if (a.startsWith('--report=')) args.report = a.split('=')[1]
    else if (a === '--amplify-top-frac') args.amplifyTopFrac = parseFloat(takeVal())
    else if (a.startsWith('--amplify-top-frac=')) args.amplifyTopFrac = parseFloat(a.split('=')[1])
    else if (a === '--shrink-bottom-frac') args.shrinkBottomFrac = parseFloat(takeVal())
    else if (a.startsWith('--shrink-bottom-frac=')) args.shrinkBottomFrac = parseFloat(a.split('=')[1])
    else if (a === '--amplify-factor') args.amplifyFactor = parseFloat(takeVal())
    else if (a.startsWith('--amplify-factor=')) args.amplifyFactor = parseFloat(a.split('=')[1])
    else if (a === '--shrink-factor') args.shrinkFactor = parseFloat(takeVal())
    else if (a.startsWith('--shrink-factor=')) args.shrinkFactor = parseFloat(a.split('=')[1])
    else if (a === '--base-model') args.baseModel = takeVal()
    else if (a.startsWith('--base-model=')) args.baseModel = a.split('=')[1]
    else if (a === '--max-tokens-per-prompt') args.maxTokensPerPrompt = parseInt(takeVal(), 10)
    else if (a.startsWith('--max-tokens-per-prompt=')) args.maxTokensPerPrompt = parseInt(a.split('=')[1], 10)
    else if (a === '--python') args.python = takeVal()
    else if (a === '--adapter-config') args.adapterConfig = takeVal()
    else if (a === '--dry-run') args.dryRun = true
    else if (a === '-h' || a === '--help') {
      console.log(`weave-spectral.mjs — Weave 0.75 Step 1 (Spectral Surgery)

Required:
  --input PATH               SFT adapter safetensors (immutable)
  --calibration PATH         Calibration JSONL
  --output PATH              Rescaled adapter safetensors output
  --report PATH              JSON report output

Optional:
  --amplify-top-frac F       Fraction of top singular directions amplified (default 0.15)
  --shrink-bottom-frac F     Fraction of bottom shrunk (default 0.30)
  --amplify-factor F         Multiplier for top (default 1.5)
  --shrink-factor F          Multiplier for bottom (default 0.5)
  --base-model NAME          HF base model id (default Qwen/Qwen2.5-Coder-1.5B-Instruct)
  --max-tokens-per-prompt N  Cap prompt tokens for activation capture (default 64)
  --python PATH              Python interpreter (default forge venv)
  --adapter-config PATH      Optional adapter_config.json to use for load-dir
  --dry-run                  Print plan and exit`)
      process.exit(0)
    }
    else {
      console.error(`Unknown arg: ${a}`)
      process.exit(2)
    }
  }
  const req = ['input', 'calibration', 'output', 'report']
  for (const r of req) {
    if (!args[r]) { console.error(`Missing --${r}`); process.exit(2) }
  }
  args.input = resolve(args.input)
  args.calibration = resolve(args.calibration)
  args.output = resolve(args.output)
  args.report = resolve(args.report)
  if (args.adapterConfig) args.adapterConfig = resolve(args.adapterConfig)
  return args
}

function prepAdapterLoadDir(sftInput, adapterConfigPath) {
  // mlx_lm.load(adapter_path=DIR) expects DIR to contain BOTH:
  //   adapter_config.json
  //   adapters.safetensors
  // Our SFT is named mk1-sft-final-*.safetensors — different filename.
  // Create a tmp dir with symlinks. Do NOT modify the input file.
  const tmp = join(tmpdir(), `weave-spectral-load-${Date.now()}`)
  mkdirSync(tmp, { recursive: true })

  const configTarget = join(tmp, 'adapter_config.json')
  const cfgSrc = adapterConfigPath || sftInput.replace(/\.safetensors$/, '.adapter_config.json')
  if (!existsSync(cfgSrc)) {
    // Fallback: look next to SFT for a file named adapter_config.json (sibling)
    const sibling = join(dirname(sftInput), 'adapter_config.json')
    if (existsSync(sibling)) {
      symlinkSync(sibling, configTarget)
    } else {
      throw new Error(`No adapter_config.json found at ${cfgSrc} or ${sibling}`)
    }
  } else {
    symlinkSync(cfgSrc, configTarget)
  }

  symlinkSync(sftInput, join(tmp, 'adapters.safetensors'))
  return tmp
}

function main() {
  const args = parseArgs(process.argv)

  if (!existsSync(args.input)) {
    console.error(`--input not found: ${args.input}`)
    process.exit(2)
  }
  if (!existsSync(args.calibration)) {
    console.error(`--calibration not found: ${args.calibration}`)
    process.exit(2)
  }
  mkdirSync(dirname(args.output), { recursive: true })
  mkdirSync(dirname(args.report), { recursive: true })

  console.log('weave-spectral (Weave 0.75 Step 1)')
  console.log(`  input:            ${args.input}`)
  console.log(`  calibration:      ${args.calibration}`)
  console.log(`  output:           ${args.output}`)
  console.log(`  report:           ${args.report}`)
  console.log(`  amplify-top-frac: ${args.amplifyTopFrac}`)
  console.log(`  shrink-bot-frac:  ${args.shrinkBottomFrac}`)
  console.log(`  amplify-factor:   ${args.amplifyFactor}`)
  console.log(`  shrink-factor:    ${args.shrinkFactor}`)
  console.log(`  base-model:       ${args.baseModel}`)
  console.log(`  max-tokens:       ${args.maxTokensPerPrompt}`)

  if (args.dryRun) {
    console.log('\n[dry-run] Not executing.')
    process.exit(0)
  }

  // Prep load dir
  const loadDir = prepAdapterLoadDir(args.input, args.adapterConfig)
  console.log(`\nPrepared temp load dir: ${loadDir}`)

  // Modify args.input for the Python impl to be the loadDir/adapters.safetensors
  // symlink so downstream `os.path.dirname(input)` = loadDir which mlx_lm.load
  // accepts.
  const inputForPython = join(loadDir, 'adapters.safetensors')

  const script = resolve(new URL('.', import.meta.url).pathname, 'weave-spectral-impl.py')
  if (!existsSync(script)) {
    console.error(`Implementation script missing: ${script}`)
    process.exit(2)
  }

  const argv = [
    script,
    '--input', inputForPython,
    '--calibration', args.calibration,
    '--output', args.output,
    '--report', args.report,
    '--amplify-top-frac', String(args.amplifyTopFrac),
    '--shrink-bottom-frac', String(args.shrinkBottomFrac),
    '--amplify-factor', String(args.amplifyFactor),
    '--shrink-factor', String(args.shrinkFactor),
    '--base-model', args.baseModel,
    '--max-tokens-per-prompt', String(args.maxTokensPerPrompt),
  ]

  console.log(`\nInvoking: ${args.python} ${script} ...`)
  const t0 = Date.now()
  const res = spawnSync(args.python, argv, {
    stdio: 'inherit',
    timeout: 3 * 60 * 60 * 1000,  // 3h hard cap
  })
  const dtSec = ((Date.now() - t0) / 1000).toFixed(1)

  // Cleanup temp load dir
  try {
    unlinkSync(join(loadDir, 'adapters.safetensors'))
    unlinkSync(join(loadDir, 'adapter_config.json'))
    // rmdir best-effort
    const { rmdirSync } = require('node:fs')  // may not exist in ESM but fallback
  } catch (e) { /* ignore */ }

  if (res.status !== 0) {
    console.error(`\nPython impl failed (exit ${res.status}) after ${dtSec}s`)
    process.exit(res.status || 1)
  }

  if (!existsSync(args.output)) {
    console.error(`Output not written: ${args.output}`)
    process.exit(1)
  }
  if (!existsSync(args.report)) {
    console.error(`Report not written: ${args.report}`)
    process.exit(1)
  }

  console.log(`\nSpectral Surgery complete in ${dtSec}s.`)
  console.log(`  output: ${args.output}`)
  console.log(`  report: ${args.report}`)
  try {
    const rpt = JSON.parse(readFileSync(args.report, 'utf8'))
    console.log(`  layers rescaled: ${rpt.n_layers_rescaled}`)
    console.log(`  activations captured for: ${rpt.activations_captured_for?.length ?? 0} projections`)
  } catch (e) { /* ignore */ }
}

main()
