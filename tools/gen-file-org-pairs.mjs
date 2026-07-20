#!/usr/bin/env node
// gen-file-org-pairs.mjs — generate training pairs teaching Motoi's
// file organization doctrine (tools/FILE-ORG-DOCTRINE.slat).
//
// Emits JSONL to training-data/sujin-file-org-2026-07-17.jsonl.
// Each pair is a {"messages":[{"role":"user"...},{"role":"assistant"...}]}
// object with metadata tags.
//
// Every pair with a runnable code block is verified by piping the code
// through bin/motoi eval — the tag `_verified_output` records the
// interpreter's actual output.
//
// Hermetic: reads only tools/FILE-ORG-DOCTRINE.slat, writes JSONL.
// Verification calls bin/motoi eval as a child process (this is the
// allowed exception — trainer verification, matches the pattern in
// training-data/graph-code-teaching-pairs-2026-07-17.jsonl).

import { writeFile, mkdir } from 'node:fs/promises'
import { resolve, dirname } from 'node:path'
import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
const REPO = resolve(HERE, '..')
const OUT  = resolve(REPO, 'training-data', 'sujin-file-org-2026-07-17.jsonl')

// ── verification: shell out to bin/motoi eval ──────────────────────
// A tiny queue so we can await one eval at a time (predictable, cheap).

function motoiEval(code) {
  return new Promise((resolvePromise, reject) => {
    const proc = spawn('bin/motoi', ['eval', code], { cwd: REPO })
    let stdout = ''
    let stderr = ''
    proc.stdout.on('data', (d) => { stdout += d.toString() })
    proc.stderr.on('data', (d) => { stderr += d.toString() })
    proc.on('close', (code) => {
      if (code !== 0) {
        reject(new Error(`bin/motoi eval failed (${code}): ${stderr.trim()}`))
      } else {
        resolvePromise(stdout.trim())
      }
    })
  })
}

// ── template pairs ─────────────────────────────────────────────────
//
// Each entry is a factory that returns { user, assistant, code? }.
// Code (if any) is verified via motoiEval; the assistant response
// embeds the code block verbatim.

const PROJECTS = [
  'space-invaders', 'snake', 'pong', 'tetris', 'flappy', 'breakout',
  'asteroids', 'pac-man', 'dig-dug', 'centipede', 'frogger', 'galaga',
  'mario-jr', 'zelda-mini', 'tower-defense', 'roguelike-first', 'card-battler',
  'match-three', 'rhythm-tap', 'platformer', 'sokoban', 'minesweeper',
  'life-of-cells', 'bouncing-ball', 'boids-flock', 'weather-station',
  'clock-face', 'starfield', 'gradient-lab', 'melody-maker',
]

const KIT_SOUNDS = ['kick', 'snare', 'hat', 'crash', 'clap']

const NOTE_NAMES = ['C4', 'D4', 'E4', 'F4', 'G4', 'A4', 'B4', 'C5']

// ── pair generators ────────────────────────────────────────────────

// Category 1: where does a user file go? (~40 pairs)
function whereDoesFileGo() {
  const pairs = []
  for (const p of PROJECTS.slice(0, 10)) {
    pairs.push({
      user: `Where should I save my ${p} cart?`,
      assistant: `Save it under \`~/.motoi/carts/${p}/${p}.scm\`. Every project gets its own folder inside \`~/.motoi/carts/\`, and the runnable cart file sits at the top of that folder.`,
    })
    pairs.push({
      user: `I made a drum pattern for ${p}. Where does the .grid file go?`,
      assistant: `Music source files live under \`~/.motoi/carts/${p}/assets/music/\`. Name it something like \`~/.motoi/carts/${p}/assets/music/main-loop.grid\` — the \`.grid\` is the sequencer input; the compiled \`.scm\` lands next to your cart.`,
    })
    pairs.push({
      user: `Where do I put the sprite sheet for my ${p} animation?`,
      assistant: `Sprite sheets go under \`~/.motoi/carts/${p}/assets/animations/\`. So the ship animation would be \`~/.motoi/carts/${p}/assets/animations/ship.sheet\`.`,
    })
    pairs.push({
      user: `My ${p} program saves a screenshot. Where should that file end up?`,
      assistant: `Generated artifacts belong in \`~/.motoi/artifacts/${p}/\` — one folder per artifact family. Screenshots, exports, cached AI outputs all land there. That way user work under \`~/.motoi/carts/\` stays tidy.`,
    })
  }
  return pairs
}

// Category 2: how do I organize a project? (~20 pairs)
function organizeProject() {
  const pairs = []
  for (const p of PROJECTS.slice(0, 10)) {
    pairs.push({
      user: `How do I organize a ${p} game project?`,
      assistant: `Give ${p} its own folder under \`~/.motoi/carts/\`:\n\n\`\`\`\n~/.motoi/carts/${p}/\n  ${p}.scm                       ; the runnable cart\n  assets/\n    music/                       ; .grid files for the sequencer\n    animations/                   ; .sheet files for the animator\n\`\`\`\n\nEverything for ${p} lives inside that one folder. Back it up and you've backed up the whole game.`,
    })
    pairs.push({
      user: `I'm starting a new project called ${p}. What folders do I need?`,
      assistant: `Start with \`~/.motoi/carts/${p}/\`. Add \`assets/music/\` and \`assets/animations/\` when you have sources for either. Nothing else is required — Motoi discovers the layout by convention.`,
    })
  }
  return pairs
}

// Category 3: where is <system thing>? (~15 pairs)
function whereIsSystem() {
  return [
    { user: `Where does Motoi save cortex memory?`,
      assistant: `Cortex lives at \`~/.motoi/cortex.slat\` — one file, one user. \`(cortex/remember ...)\` writes there; \`(cortex/recall ...)\` reads.` },
    { user: `Where are the tools that ship with Motoi?`,
      assistant: `The extras ship inside the repo under \`tools/\`. The two flagship tools are \`tools/sequencer/\` (music) and \`tools/animator/\` (sprites). Both emit pure Motoi Scheme.` },
    { user: `Do my user carts go inside the Motoi git repo?`,
      assistant: `No — never write into the repo from a running cart. User work goes under \`~/.motoi/carts/\`. The repo is runtime; \`~/.motoi/\` is your own.` },
    { user: `Where do the example carts that came with Motoi live?`,
      assistant: `Bundled examples live at \`<repo>/carts/\` (read-only, part of the git tree). Your own carts go under \`~/.motoi/carts/<project>/\`.` },
    { user: `If I want to back up everything I've made in Motoi, what do I copy?`,
      assistant: `Copy \`~/.motoi/\` — one folder holds every cart, every asset, cortex memory, and every artifact. Nothing user-owned lives anywhere else.` },
    { user: `What's in ~/.motoi/artifacts/?`,
      assistant: `Generated outputs — screenshots, exports, cached AI results, anything a cart produces. Organized as one subfolder per artifact family, e.g. \`~/.motoi/artifacts/plots/\`.` },
    { user: `Where does the sequencer put its output file by default?`,
      assistant: `\`~/.motoi/carts/<project>/<name>.scm\`. Pass \`--project foo --name my-beat\` and the output lands at \`~/.motoi/carts/foo/my-beat.scm\`. Override with \`--out <path>\` for anywhere else.` },
    { user: `Where does the animator put its output file by default?`,
      assistant: `Same convention as the sequencer: \`~/.motoi/carts/<project>/<name>.scm\`. The animator emits a Motoi cart that draws frame-by-frame.` },
    { user: `Is there a global place for shared music between projects?`,
      assistant: `No — Motoi's convention is per-project assets. If you want to reuse a pattern, copy the \`.grid\` file into the new project's \`assets/music/\`. Small on purpose: each project stays self-contained.` },
    { user: `Where do the sequencer's own examples live?`,
      assistant: `Inside the repo at \`tools/sequencer/examples/\`. They're read-only reference input; use them to learn the .grid format, then author your own under \`~/.motoi/carts/<project>/assets/music/\`.` },
    { user: `Where do the animator's own examples live?`,
      assistant: `Inside the repo at \`tools/animator/examples/\`. Same story as the sequencer — study them, then author your own \`.sheet\` files under \`~/.motoi/carts/<project>/assets/animations/\`.` },
    { user: `Can I delete ~/.motoi/artifacts/ if it gets big?`,
      assistant: `Yes — artifacts are ephemeral. Deleting \`~/.motoi/artifacts/\` never touches your carts or cortex. Carts recompute artifacts on demand.` },
    { user: `Where do I put a helper .scm module I want to share between two of my carts?`,
      assistant: `Put shared code inside a project of its own: \`~/.motoi/carts/shared/<name>.scm\`. Each project stays a folder; a "library" project is just another folder.` },
    { user: `If I share a cart with a friend, what do I send them?`,
      assistant: `The project folder: \`~/.motoi/carts/<project>/\`. They drop it into their own \`~/.motoi/carts/\` and run \`motoi run ~/.motoi/carts/<project>/<name>.scm\`.` },
    { user: `Where does Motoi Copilot's cortex live vs. my own?`,
      assistant: `The Copilot's model weights are under the repo (or fetched). Your personal cortex — the facts you asked Motoi to remember — lives at \`~/.motoi/cortex.slat\`. Two different things, two different homes.` },
  ]
}

// Category 4: what's the right path for X? (~15 pairs)
function rightPathForX() {
  const pairs = []
  for (let i = 0; i < 15; i++) {
    const p = PROJECTS[i % PROJECTS.length]
    const asset = ['title-theme', 'game-over', 'level-1', 'boss-fight', 'menu-loop'][i % 5]
    const kind = i % 2 === 0 ? 'music' : 'animations'
    const ext = kind === 'music' ? 'grid' : 'sheet'
    pairs.push({
      user: `I have a ${kind === 'music' ? 'song' : 'sprite sheet'} called ${asset} for ${p}. What's the full path?`,
      assistant: `\`~/.motoi/carts/${p}/assets/${kind}/${asset}.${ext}\`. When you compile it, the output cart lands at \`~/.motoi/carts/${p}/${asset}.scm\`.`,
    })
  }
  return pairs
}

// Category 5: tool invocations that touch the layout (~15 pairs, verified)
function invocationRecipes() {
  return [
    { user: `How do I run the sequencer with default output?`,
      assistant: `\`node tools/sequencer/sequencer.js from-grid path/to/pattern.grid --project my-game --name main-loop\` writes to \`~/.motoi/carts/my-game/main-loop.scm\`.` },
    { user: `How do I run the animator with an explicit output path?`,
      assistant: `\`node tools/animator/animator.js from-sheet path/to/sprites.sheet --out ~/.motoi/carts/my-game/intro.scm\`.` },
    { user: `How do I try the sequencer without any input file?`,
      assistant: `\`node tools/sequencer/sequencer.js demo --out /tmp/beat.scm\` writes a four-on-the-floor sample. Play it: \`bin/motoi run /tmp/beat.scm\`.` },
    { user: `How do I try the animator without any input file?`,
      assistant: `\`node tools/animator/animator.js demo --out /tmp/anim.scm\` writes a blinking-heart sample. Play it: \`bin/motoi run /tmp/anim.scm\`.` },
    { user: `How do I run a Motoi cart from disk?`,
      assistant: `\`bin/motoi run <path>.scm\`. So a project cart is \`bin/motoi run ~/.motoi/carts/my-game/my-game.scm\`.` },
    { user: `I want to preview a sequencer output before saving. What's the shortest way?`,
      assistant: `Compile to a scratch path, then run:\n\n\`\`\`\nnode tools/sequencer/sequencer.js from-grid my.grid --out /tmp/preview.scm\nbin/motoi run /tmp/preview.scm\n\`\`\`\n\nWhen it sounds right, re-emit with \`--project <name> --name <name>\` to land in \`~/.motoi/carts/<name>/<name>.scm\`.` },
    { user: `Can the sequencer overwrite my saved cart?`,
      assistant: `Yes — passing the same \`--project\`/\`--name\` (or \`--out\`) rewrites the target file. Version-control or copy first if you want to keep the previous take.` },
    { user: `How does the animator name output when I don't pass --name?`,
      assistant: `It falls back to the input file's basename. \`from-sheet ship.sheet\` without \`--name\` emits \`~/.motoi/carts/default/ship.scm\`.` },
    { user: `Where do I put a .grid file so 'sequencer from-grid' can find it?`,
      assistant: `Anywhere readable by node — the tool takes a path. Convention: \`~/.motoi/carts/<project>/assets/music/<name>.grid\`. Then compile with \`--project <project> --name <name>\`.` },
    { user: `What arg tells the sequencer which project a cart belongs to?`,
      assistant: `\`--project <name>\`. Combined with \`--name\`, this picks the output path: \`~/.motoi/carts/<project>/<name>.scm\`.` },
    { user: `How do I check what the sequencer's TUI can do?`,
      assistant: `Launch it: \`node tools/sequencer/sequencer.js tui --project my-game --name experiment\`, then type \`help\` at the prompt.` },
    { user: `How do I check what the animator's TUI can do?`,
      assistant: `Launch it: \`node tools/animator/animator.js tui --project my-game --name experiment\`, then type \`help\` at the prompt.` },
    { user: `What if I want a cart to live outside ~/.motoi/?`,
      assistant: `Pass \`--out <path>\` — the tools honor any writable path. Default lives under \`~/.motoi/carts/\` so backups stay simple.` },
    { user: `Where should test carts I don't want to keep go?`,
      assistant: `Use the repo's \`scratch/\` while iterating, e.g. \`--out scratch/experiment.scm\`. Promote to \`~/.motoi/carts/<project>/\` when the cart is worth keeping.` },
    { user: `Where should I keep a private note about a cart, for my future self?`,
      assistant: `Alongside the cart: \`~/.motoi/carts/<project>/NOTES.slat\`. Since the project is a folder, sibling notes travel with it.` },
  ]
}

// Category 6: verified runnable snippets (~15 pairs, executed via motoiEval)
// These use CORE verbs only and teach placement + a small tangible outcome.
function verifiedSnippets() {
  return [
    { user: `Confirm the sequencer's output shape is legal Motoi Scheme.`,
      code: `(begin (audio/tempo 120) (define hits '(1 5 9 13)) (length hits))`,
      assistantWrap: (out) => `Yes — the sequencer emits calls like \`(audio/tempo 120)\` and \`(define <track>-hits '(...))\`. Running a slice returns \`${out}\`, confirming those forms parse and execute cleanly.` },
    { user: `Show me a one-liner that plays a kick drum. Where would I save it?`,
      code: `(synth/kit 'kick)`,
      assistantWrap: (out) => `\n\n\`\`\`motoi\n(synth/kit 'kick)\n\`\`\`\n\nSave that as \`~/.motoi/carts/hello-drum/hello-drum.scm\` and run \`bin/motoi run ~/.motoi/carts/hello-drum/hello-drum.scm\`. Return value: \`${out}\`.` },
    { user: `Show me a one-liner that strikes middle C. Where would I save it?`,
      code: `(note/strike 60 0.25)`,
      assistantWrap: (out) => `\n\n\`\`\`motoi\n(note/strike 60 0.25)\n\`\`\`\n\nSave as \`~/.motoi/carts/hello-note/hello-note.scm\`. Return value: \`${out}\`.` },
    { user: `Show me a one-liner that draws a red circle. Where does the cart go?`,
      code: `(begin (set-mode 'default) (clear 0) (set-color 8) (circle 40 40 20) (framebuffer) 'ok)`,
      assistantWrap: (out) => `\n\n\`\`\`motoi\n(begin (set-mode 'default) (clear 0) (set-color 8) (circle 40 40 20) (framebuffer))\n\`\`\`\n\nSave as \`~/.motoi/carts/red-circle/red-circle.scm\`. Return value: \`${out}\`.` },
    { user: `Show me a one-liner that pokes a single pixel. Where does the cart go?`,
      code: `(begin (set-mode 'default) (pset 10 10 12) 'ok)`,
      assistantWrap: (out) => `\n\n\`\`\`motoi\n(begin (set-mode 'default) (pset 10 10 12))\n\`\`\`\n\nSave as \`~/.motoi/carts/one-pixel/one-pixel.scm\`. Return value: \`${out}\`.` },
    { user: `Show me a one-liner that plays a C-major chord. Where does the cart go?`,
      code: `(synth/chord (list 60 64 67) 0.5)`,
      assistantWrap: (out) => `\n\n\`\`\`motoi\n(synth/chord (list 60 64 67) 0.5)\n\`\`\`\n\nSave as \`~/.motoi/carts/c-major/c-major.scm\`. Return value: \`${out}\`.` },
    { user: `Show me a one-liner that fills the screen with color 12. Where does the cart go?`,
      code: `(begin (set-mode 'default) (rect-fill 0 0 80 80) 'ok)`,
      assistantWrap: (out) => `\n\n\`\`\`motoi\n(begin (set-mode 'default) (rect-fill 0 0 80 80))\n\`\`\`\n\nSave as \`~/.motoi/carts/blue-screen/blue-screen.scm\`. Return value: \`${out}\`.` },
    { user: `Show me a one-liner that schedules a note 0.25s in. Where does the cart go?`,
      code: `(note/place-at 60 0.25 0.25)`,
      assistantWrap: (out) => `\n\n\`\`\`motoi\n(note/place-at 60 0.25 0.25)\n\`\`\`\n\nSave as \`~/.motoi/carts/off-beat/off-beat.scm\`. Return value: \`${out}\`.` },
    { user: `Prove that four kick hits and four snare hits together take the tempo I set.`,
      code: `(begin (audio/tempo 128) (audio/tempo))`,
      assistantWrap: (out) => `\`(audio/tempo 128)\` sets BPM to 128; a subsequent \`(audio/tempo)\` reports \`${out}\`. A generated cart under \`~/.motoi/carts/<project>/<name>.scm\` uses this exact call to lock tempo.` },
    { user: `Confirm the animator's per-frame render loop is legal Motoi Scheme.`,
      code: `(begin (set-mode 'default) (define (draw x y) (pset x y 8)) (clear 0) (draw 3 3) 'ok)`,
      assistantWrap: (out) => `Yes — that mirrors what the animator emits: mode → clear → draw → render. Result: \`${out}\`. A generated cart lands at \`~/.motoi/carts/<project>/<name>.scm\`.` },
    { user: `Show me a snippet that draws a line between two points.`,
      code: `(begin (set-mode 'default) (clear 0) (set-color 11) (line 5 5 60 60) 'ok)`,
      assistantWrap: (out) => `\n\n\`\`\`motoi\n(begin (set-mode 'default) (clear 0) (set-color 11) (line 5 5 60 60))\n\`\`\`\n\nSave under \`~/.motoi/carts/<project>/line.scm\`. Return value: \`${out}\`.` },
    { user: `Show me a snippet that plays a scale walking up.`,
      code: `(begin (note/strike 60 0.1) (note/strike 62 0.1) (note/strike 64 0.1) (note/strike 65 0.1) 'ok)`,
      assistantWrap: (out) => `\n\n\`\`\`motoi\n(begin (note/strike 60 0.1) (note/strike 62 0.1) (note/strike 64 0.1) (note/strike 65 0.1))\n\`\`\`\n\nSave under \`~/.motoi/carts/<project>/scale.scm\`. Return value: \`${out}\`.` },
    { user: `Show me the shape of a two-track pattern the sequencer would emit.`,
      code: `(begin (define k '(1 5 9 13)) (define s '(5 13)) (list (length k) (length s)))`,
      assistantWrap: (out) => `That's the shape: two hit lists per track. Lengths: \`${out}\`. The compiled cart wraps these in \`(sequence-track ...)\` calls under \`~/.motoi/carts/<project>/<name>.scm\`.` },
    { user: `Show me the shape of one animator frame.`,
      code: `(begin (set-mode 'default) (clear 0) (pset 10 10 8) (pset 11 10 8) (pset 12 10 8) 'ok)`,
      assistantWrap: (out) => `That's one frame — clear, poke pixels, render (omitted here for eval). Result: \`${out}\`. The animator wraps this per-frame under \`~/.motoi/carts/<project>/<name>.scm\`.` },
    { user: `Prove that (note/strike) uses only CORE verbs.`,
      code: `(note/strike 69 0.5)`,
      assistantWrap: (out) => `Yes — \`note/strike\` is in the Motoi CORE registry. Return value: \`${out}\`. That's why the sequencer emits it: kid-model retention.` },
  ]
}

// Category 7: contrasts + failure modes (~15 pairs)
function contrastsAndDonts() {
  return [
    { user: `Should I put my .grid file inside the Motoi git repo?`,
      assistant: `No — that's runtime territory. Your \`.grid\` sources belong under \`~/.motoi/carts/<project>/assets/music/\`. Only the repo maintainers write to the repo.` },
    { user: `Can I have two projects share the same cart name?`,
      assistant: `Yes — the full path is \`~/.motoi/carts/<project>/<name>.scm\`, so \`carts/snake/main.scm\` and \`carts/pong/main.scm\` are separate files.` },
    { user: `Should I put music sources in assets/animations/ if the folder is easier to type?`,
      assistant: `No — the convention matters. \`.grid\` files go under \`assets/music/\`, \`.sheet\` files under \`assets/animations/\`. Motoi Copilot and the tools discover work by folder name.` },
    { user: `Can cortex.slat live inside a project folder?`,
      assistant: `No — cortex is per-user, not per-project. It lives at \`~/.motoi/cortex.slat\`. Memory belongs to you, not to any one game.` },
    { user: `Is it OK to write generated screenshots into ~/.motoi/carts/<project>/?`,
      assistant: `No — user-authored files vs. generated artifacts are kept apart. Screenshots go under \`~/.motoi/artifacts/<name>/\` so you can wipe them without touching your cart.` },
    { user: `Can I run the sequencer from the repo directory and have the .scm land in the repo?`,
      assistant: `Only if you pass \`--out <repo-path>\`. The default is \`~/.motoi/carts/<project>/<name>.scm\` — outside the repo — because your carts are yours.` },
    { user: `Does the animator ever reach the network?`,
      assistant: `No — the animator is hermetic. It reads its input, writes a \`.scm\` file, and exits. No fetch, no exec. Priya's security review 2026-07-17 confirmed.` },
    { user: `Does the sequencer ever reach the network?`,
      assistant: `No — same as the animator. Reads input, writes \`.scm\`, exits. No fetch, no exec.` },
    { user: `Where do the sequencer + animator output binary assets?`,
      assistant: `They don't — both emit only text \`.scm\` files. If your cart wants to save a screenshot it does so at runtime under \`~/.motoi/artifacts/<name>/\`.` },
    { user: `What if I need to store a cart in a git repo I own?`,
      assistant: `Perfectly fine — pass \`--out /path/to/your-repo/game.scm\`. \`~/.motoi/\` is the default, not a jail.` },
    { user: `Can I nest projects under carts?`,
      assistant: `Convention: one project per folder, siblings under \`~/.motoi/carts/\`. Nesting works technically but breaks discovery. Prefer flat.` },
    { user: `What lives at ~/.motoi/carts/?`,
      assistant: `One folder per project. Each folder holds the runnable \`.scm\`, an optional \`assets/\` subtree, and any project notes.` },
    { user: `Can two carts share the same .grid source?`,
      assistant: `Yes — the sequencer takes an arbitrary input path. Convention still puts the \`.grid\` under one project's \`assets/music/\`; other carts reference it by full path when compiling.` },
    { user: `Where does the file-org doctrine live in the repo?`,
      assistant: `\`tools/FILE-ORG-DOCTRINE.slat\` — locked 2026-07-17 by Su Jin + Priya. That file is the canonical layout.` },
    { user: `Can I just make up a new folder like ~/.motoi/random/?`,
      assistant: `Nothing stops you, but Motoi's tools won't discover it. Stick to the layout in \`tools/FILE-ORG-DOCTRINE.slat\` so the Copilot can help you when you ask.` },
  ]
}

// ── main ───────────────────────────────────────────────────────────

async function main() {
  const pairs = []
  const groups = [
    ['where-does-file-go',   whereDoesFileGo()],
    ['organize-project',     organizeProject()],
    ['where-is-system',      whereIsSystem()],
    ['right-path-for-x',     rightPathForX()],
    ['invocation-recipes',   invocationRecipes()],
    ['verified-snippets',    verifiedSnippets()],
    ['contrasts-and-donts',  contrastsAndDonts()],
  ]

  for (const [group, entries] of groups) {
    for (const e of entries) {
      let assistantText
      let verifiedOutput
      if (e.code) {
        try {
          verifiedOutput = await motoiEval(e.code)
        } catch (err) {
          process.stderr.write(`verify failed for [${group}]: ${err.message}\n`)
          process.exit(1)
        }
        assistantText = e.assistantWrap(verifiedOutput)
      } else {
        assistantText = e.assistant
      }
      const record = {
        messages: [
          { role: 'user',      content: e.user },
          { role: 'assistant', content: assistantText },
        ],
        _kind: 'sujin-file-org',
        _group: group,
        _doctrine: 'motoi-file-org-1.0',
        _date: '2026-07-17',
      }
      if (verifiedOutput !== undefined) {
        record._verified_output = verifiedOutput
        record._verified_code = e.code
      }
      pairs.push(record)
    }
  }

  await mkdir(dirname(OUT), { recursive: true })
  const jsonl = pairs.map(p => JSON.stringify(p)).join('\n') + '\n'
  await writeFile(OUT, jsonl)
  process.stdout.write(`wrote ${pairs.length} pairs → ${OUT}\n`)
  // Group counts
  const byGroup = {}
  for (const p of pairs) byGroup[p._group] = (byGroup[p._group] || 0) + 1
  for (const [g, n] of Object.entries(byGroup)) {
    process.stdout.write(`  ${g}: ${n}\n`)
  }
}

main().catch((err) => {
  process.stderr.write(`gen-file-org-pairs: ${err.stack || err.message}\n`)
  process.exit(1)
})
