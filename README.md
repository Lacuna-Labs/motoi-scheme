# Motoi Scheme

**基** — foundation. A tiny Scheme with interesting tools.

Motoi is a small, valid R7RS-small Scheme you can hold in your head. It runs at the terminal, in the browser, or embedded in whatever you're building. It comes with books that teach you the language through runnable examples, a fantasy console, sound and framebuffer verbs, math and physics, a beat maker, and a small AI companion called Motoi Copilot that reads the same reference you do.

```scheme
(display "hello") (newline)
(display (+ 1 2))
```

That's a program. Run it.

---

## Table of contents

- [Install and run](#install-and-run)
- [Your first five minutes](#your-first-five-minutes)
- [Scheme basics](#scheme-basics)
- [Draw colored dots](#draw-colored-dots)
- [Make beats and notes](#make-beats-and-notes)
- [Math and vectors](#math-and-vectors)
- [Read the books](#read-the-books)
- [Ask the language about itself](#ask-the-language-about-itself)
- [Motoi Copilot — the small AI](#motoi-copilot--the-small-ai)
- [Themes](#themes)
- [The web IDE](#the-web-ide)
- [Reference manual](#reference-manual)
- [Dialects, variants, forks](#dialects-variants-forks)
- [Repo layout](#repo-layout)
- [License](#license)

---

## Install and run

Motoi is `0.75-beta`. It runs on macOS and Linux with Node ≥ 20.

**One-line install** (recommended):

```bash
curl -sSL https://raw.githubusercontent.com/Lacuna-Labs/motoi-scheme/main/install.sh | bash
```

That clones to `~/.motoi`, runs `npm install`, and puts `motoi` on your PATH (via a symlink in `~/.local/bin/`). Re-running it updates.

**Or, git clone directly:**

```bash
git clone https://github.com/Lacuna-Labs/motoi-scheme.git
cd motoi-scheme && npm install
./bin/motoi repl
```

No build step. First run:

```bash
motoi run carts/cart-pico8-demo/pico8-dots.scm    # colored dots + smiley
motoi repl                                         # interactive
```

---

## Your first five minutes

Save this as `hello.scm`:

```scheme
(display "hello, motoi") (newline)
(display (+ 1 2)) (newline)
(display (map (lambda (x) (* x x)) (list 1 2 3 4))) (newline)
```

Run it:

```bash
./bin/motoi run hello.scm
```

You should see:

```
hello, motoi
3
(1 4 9 16)
```

If that worked, everything below will work too.

---

## Scheme basics

Motoi is R7RS-small. If you know Scheme, you already know Motoi.

```scheme
(define (square x) (* x x))
(define (sum-of-squares xs)
  (if (null? xs)
      0
      (+ (square (car xs)) (sum-of-squares (cdr xs)))))

(display (sum-of-squares (list 1 2 3 4))) (newline)   ; 30
```

Closures work:

```scheme
(define (make-adder n) (lambda (x) (+ x n)))
(define add5 (make-adder 5))
(display (add5 10)) (newline)   ; 15
```

Higher-order pipeline:

```scheme
(define evens '(2 4 6 8 10))
(display (filter (lambda (x) (> x 4)) evens)) (newline)   ; (6 8 10)
```

---

## Draw colored dots

Motoi has a framebuffer. In your terminal, `fb/dump` renders the current frame as real colored blocks using the PICO-8 palette.

```scheme
(set-mode 20 10)
(begin-frame)

;; palette test — all 16 colors across the top
(let loop ((x 0))
  (when (< x 16)
    (set-color x)
    (pixel x 0)
    (loop (+ x 1))))

;; a yellow smiley face
(set-color 'yellow)
(disc 10 6 3)
(set-color 'black)
(pixel 9 5) (pixel 11 5)                 ; eyes
(pixel 9 8) (pixel 10 8) (pixel 11 8)    ; mouth

(end-frame)
(fb/dump)
```

Save as `carts/pico8-demo.scm` and run it. You get 16 real colored blocks and a yellow smiley in your terminal.

The demo cart lives at `carts/cart-pico8-demo/pico8-dots.scm` — try it first:

```bash
./bin/motoi run carts/cart-pico8-demo/pico8-dots.scm
```

---

## Make beats and notes

Kicks, snares, hats, notes.

```scheme
(kick) (snare) (kick) (snare)
(display "one bar of four-on-the-floor") (newline)
```

Or write a melody using notes:

```scheme
(note 'C4 0.5 0.6)
(note 'E4 0.5 0.6)
(note 'G4 0.5 0.6)
```

The `note` verb takes a pitch symbol, a duration in seconds, and a velocity between 0 and 1. There are complete music carts under `carts/cart-maker-3-music/` including a Twinkle melody, an arpeggio, a drum loop, a chord progression, and a layered song.

```bash
./bin/motoi run carts/cart-maker-3-music/twinkle-melody.scm
```

At the terminal, the audio verbs print a trace of what would play. In the browser IDE, they route to Web Audio and you hear it.

---

## Math and vectors

```scheme
(display (math/pow 2 10))                     ; 1024
(display (math/sqrt 144))                     ; 12
(display (math/gcd 12 18))                    ; 6
(display (vec/dot '(1 2 3) '(4 5 6)))         ; 32
(display (matrix/transpose '((1 2) (3 4))))   ; ((1 3) (2 4))
```

Motoi has algebra, calculus, complex numbers, geometry, matrices, statistics, and more. Full list under `Scheme/reference/` — every verb has a signature, examples, and cross-book citations.

---

## Read the books

Motoi comes with books that teach the language through runnable examples. List them:

```scheme
(book/list)
;; → (ai-tech-cards animation arcade-games challenges code composition
;;    computing craft cs-curriculum instruments introspection jesse
;;    language-ancestors limits logic math ml modules motion music
;;    narrative-games one-shot r7rs-recipes reminded scheme self
;;    sick-composition simulation-games slat sound systems values)
```

Open one:

```scheme
(book/read :book 'scheme :chapter 1)
```

That prints the first chapter of the Book of Scheme in your terminal.

---

## Ask the language about itself

Every verb in Motoi is documented in the reference. You can ask about any of them.

```scheme
(display (motoi/explain 'vec/dot))
;; → [motoi] we're calling vec/dot. It's a registered verb, namespace root.
```

At the REPL (`./bin/motoi repl`), you can use meta-commands:

```
,help vec/dot
,type vec/dot
,arity vec/dot
,source vec/dot
,apropos "^vec/"
,expand (when x body)
```

---

## Motoi Copilot — the small AI

Motoi ships with **Motoi Copilot**, a small language model trained on this reference and these books. It's not required to use Motoi; it's a companion. When you have it running, you can ask it things in plain English and it will answer with runnable Motoi Scheme.

Motoi Copilot is trained on the reference manual you're reading. When it answers, it can quote the reference, not confabulate. If you're building your own AI, this repo shows the whole recipe: the corpus, the reference, the training runbook.

---

## Themes

Motoi ships with two themes. Sakura (default) is soft blossom pink; Hacker is 80s phosphor green over black. Switch with `--theme` or `--hacker`:

```bash
motoi tui                        # Sakura — soft, warm
motoi tui --theme hacker         # phosphor green terminal
motoi tui --hacker               # same
motoi repl --theme hacker        # REPL wears the theme too
```

Set `MOTOI_THEME=hacker` in your shell to make it stick. Roll your own by dropping a `.slat` file in `~/motoi/themes/` — see `docs/themes.md` for the schema.

---

## The web IDE

Motoi also runs in a browser. There's a 3-panel terminal-in-browser IDE with a REPL, editor, and rendered canvas. It's under `site/ide-assets/` and gets served through VitePress:

```bash
npm run docs:dev
# then open the IDE panel from the docs sidebar
```

Same runtime code as the CLI. In the browser, framebuffer verbs paint on a canvas and audio verbs route through Web Audio, so beats you couldn't hear at the terminal actually play.

---

## Reference manual

The reference lives at `Scheme/reference/`. It's the language talking about itself. Every callable verb has a record with a signature, five rows of examples, caveats, drawbacks, use cases, and cross-references. Start with:

- `Scheme/reference/00-intro.slat` — welcome + how to read the manual
- `Scheme/reference/00b-introspection.slat` — how the language sees itself
- `Scheme/reference/00c-runtime-and-composition.slat` — how the runtime works
- `Scheme/reference/01-core.slat` — 97 core forms and primitives
- `Scheme/reference/02-ai.slat` through `72-world.slat` — one file per library

The reference is machine-readable (SLAT format) and also the source of truth for Motoi Copilot's training corpus.

---

## Dialects, variants, forks

Motoi is a base language. Other projects can build on top:

- **Dialect** — a verb layer + semantics on top of Motoi. Each dialect declares its delta in a `dialect.slat`. Motoi doesn't know about the dialect; the dialect knows about Motoi.
- **Variant** — a dialect that preserves Motoi's semantics and stays round-trippable via adapters. Variants get the compat layer for free.
- **Fork** — a dialect (or a rename of Motoi) that walks away from Motoi's semantics. Can't round-trip back. Community-friendly, but consumers of the fork are not consumers of Motoi.

Motoi is open — MIT license. Dialect it, variant it, teach with it. Forking is fine too.

---

## Repo layout

```
motoi-scheme/
├── bin/motoi                 CLI entry point
├── src/                      reader, interpreter, macros, base library, REPL, CLI
├── lib/                      libraries: ai, audio, graphics, media, security, system, book, composer
├── core/                     runtime bootstrap
├── adapters/                 host adapters (terminal, browser)
├── carts/                    example programs (cart-maker-1 through cart-maker-6)
├── Scheme/reference/         the reference manual (76 chapter files)
├── scheme-books/             32 books, each in its own folder with chapters
├── engineering/              architecture docs
├── SRE-MANUAL/               ops runbooks (forge, training signals)
├── site/                     VitePress docs site + browser IDE
├── training-data/            corpora for Motoi Copilot
├── scripts/                  fold, audit, preflight, balance
└── tests/                    vitest suite
```

---

## License

MIT. See [LICENSE](LICENSE).
