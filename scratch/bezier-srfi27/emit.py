#!/usr/bin/env python3
"""emit.py — render the 4 SRFI-27 verb records into SLAT.

Programs come from gen.py (already verified runnable + deterministic).
Writes scratch/bezier-srfi27/records.slat for append to 01-core.slat.
"""
import sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from gen import RI, RR, MS, RZ, esc, PROGRAMS

E = esc


def field(k, v, indent=2):
    return ' ' * indent + ':%s "%s"' % (k, E(v) if isinstance(v, str) else v)


def strlist(k, items, indent=2):
    pad = ' ' * indent
    inner = '\n'.join('%s  "%s"' % (pad, E(s)) for s in items)
    return '%s:%s (\n%s)' % (pad, k, inner)


def examples(rows):
    out = ['  :examples (']
    for tier, code, note in rows:
        out.append('    (:dialect "motoi" :tier "%s" :code "%s" :note "%s")'
                   % (tier, E(code), E(note)))
    out.append('  )')
    return '\n'.join(out)


def row2(eng, math, cs, problem, expl, meta, l_eng, l_math, l_cs):
    return ('  :row-2-audit (\n'
            '    (:eng-program "%s"\n'
            '     :math-program "%s"\n'
            '     :cs-program "%s"\n'
            '     :problem "%s"\n'
            '     :explanation "%s"\n'
            '     :meta "%s")\n'
            '    (:eng "%s"\n'
            '     :math "%s"\n'
            '     :cs "%s")\n'
            ')' % (E(eng), E(math), E(cs), E(problem), E(expl), E(meta),
                   E(l_eng), E(l_math), E(l_cs)))


def row3(setup, rungs, expl, meta, l_eng, l_math, l_cs):
    r = '\n'.join('             (:domain "%s" :code "%s")' % (E(d), E(c))
                  for d, c in rungs)
    r = r.lstrip()
    return ('  :row-3-dimension (\n'
            '    (:setup "%s"\n'
            '     :rungs (%s)\n'
            '     :explanation "%s"\n'
            '     :meta "%s")\n'
            '    (:eng "%s"\n'
            '     :math "%s"\n'
            '     :cs "%s")\n'
            ')' % (E(setup), r, E(expl), E(meta), E(l_eng), E(l_math), E(l_cs)))


def row4(eng, math, cs, claim, invariant, meta, l_eng, l_math, l_cs):
    return ('  :row-4-proof (\n'
            '    (:eng-program "%s"\n'
            '     :math-program "%s"\n'
            '     :cs-program "%s"\n'
            '     :claim "%s"\n'
            '     :invariant "%s"\n'
            '     :meta "%s")\n'
            '    (:eng "%s"\n'
            '     :math "%s"\n'
            '     :cs "%s")\n'
            ')' % (E(eng), E(math), E(cs), E(claim), E(invariant), E(meta),
                   E(l_eng), E(l_math), E(l_cs)))


def row5(eng, math, cs, base, emergent, meta, l_eng, l_math, l_cs):
    return ('  :row-5-emergence (\n'
            '    (:eng-composition "%s"\n'
            '     :math-composition "%s"\n'
            '     :cs-composition "%s"\n'
            '     :base "%s"\n'
            '     :emergent "%s"\n'
            '     :meta "%s")\n'
            '    (:eng "%s"\n'
            '     :math "%s"\n'
            '     :cs "%s")\n'
            ')' % (E(eng), E(math), E(cs), E(base), E(emergent), E(meta),
                   E(l_eng), E(l_math), E(l_cs)))


TAIL = ('  :library "core"\n'
        '  :dialect "motoi"\n'
        '  :audience :any\n'
        '  :content-rating :G\n'
        '  :training-eligible #t\n'
        '  :confidentiality :public\n'
        '  :provenance :added-2026-08-02-srfi-27-reference-fill)')


# ══════════════════════════════════════════════════════════════════════════
# 1. random-integer
# ══════════════════════════════════════════════════════════════════════════

REC_RI = '\n'.join([
'(verb',
'  :name "random-integer" :std "SRFI-27"',
'  :library "core"',
'  :tier "core"',
'  :kind "rd"',
'  :signature "(random-integer n) -> integer"',
'  :summary "A uniformly-distributed integer in [0, n) — 0 inclusive, n exclusive — drawn from Motoi\'s one random stream."',
'  :explanation "The SRFI-27 discrete draw. It reads the next value from the single engine-level generator in src/rng.js and scales it to the half-open range [0, n): (random-integer 6) is a fair die numbered 0 through 5. The word `one` in `one random stream` is the whole point. Every random verb in Motoi — random, random-int, randint, random-range, random-pick, rng-uniform, random-real and this one — draws from that same generator, so `(with-seed n thunk)` covers all of them together and interleaved calls to different verbs replay in the same order. That was not always true: several verbs used to reach for the host\'s own generator and silently escaped the seed, a bug found and repaired three separate times before the draw was hoisted to one place. If you are learning one property of this verb, learn this one: inside `with-seed` the sequence is reproducible; outside it, it is not."',
examples([
  ('novice', RI['ex-novice'],
   'A seeded die. Wrapping the draw in with-seed 42 makes it print 1 today, tomorrow, and on somebody else\'s machine. Without the with-seed the number changes every run — which is why every example in this record is seeded.'),
  ('intermediate', RI['ex-inter'],
   'Three draws in a row under one seed, then the same thunk under the same seed again. The list is identical both times: the seed pins the whole sequence, not just the first value.'),
  ('expert', RI['ex-expert'],
   'The two properties you can assert about 200 draws without printing an unrepeatable number: every draw is inside [0, 6), and the whole sample replays under the same seed. Assert the property, not the value.'),
]),
strlist('caveats', [
  'The range is HALF-OPEN: [0, n). (random-integer 6) never returns 6. To roll a normal die, add one: (+ 1 (random-integer 6)).',
  'DIVERGENCE from SRFI-27, which requires n to be a positive integer and leaves smaller values an error. Motoi clamps instead: n is truncated toward zero and then raised to at least 1, so (random-integer 0), (random-integer 1) and (random-integer -5) all return 0 with no error raised. A bad bound fails silently rather than loudly.',
  'A non-integer bound is truncated toward zero, so (random-integer 10.9) behaves exactly like (random-integer 10).',
  'A clamped call STILL CONSUMES A DRAW. (random-integer 0) always returns 0 but advances the stream by one step, so inserting or removing one shifts every later draw in a seeded replay.',
  'Outside (with-seed …) the draw comes from host entropy and is not reproducible. Never write a test or a reference example that prints an unseeded draw.',
  'This is a linear-congruential generator — a replay device, not a cryptographic one. Do not use it for keys, tokens, passwords, or anything an adversary should not be able to predict.',
  'SRFI-27 draws from an explicit random source via random-source-make-integers. Motoi has no such accessor; random-integer always uses one built-in default source. See make-random-source.',
]),
strlist('usecases', [
  'Die rolls, coin flips, and card indices in a cart.',
  'Procedural placement: choosing a grid cell inside (cols) x (rows).',
  'Picking an index into a list for sampling or shuffling.',
  'Seeded regression tests, where a fixed seed turns a stochastic routine into an exact expected value.',
]),
strlist('related', ['random-real', 'make-random-source', 'random-source-randomize!',
                    'with-seed', 'random-int', 'randint', 'random-range', 'random-pick', 'random']),
'  :learn (:concept "The half-open discrete uniform draw, and the seed that makes a stochastic program replayable." :prerequisites ("random" "with-seed" "lambda") :progression "Start with (random-integer n) alone to feel the randomness; then wrap it in with-seed and watch the same numbers come back; then learn random-real for the continuous draw; then read random-source-randomize! to see what deliberately breaks replay.")',
'  :provenance "SRFI-27 (Sebastian Egner) §Interface, random-integer; implemented lib/std/srfi-27.js; reference record added 2026-08-02"',
row2(
  RI['r2-eng'], RI['r2-math'], RI['r2-cs'],
  'The operator needs a discrete uniform draw and needs the run to be reproducible for a bug report. Candidates: random-integer (SRFI-27, half-open [0,n), one argument), randint (Motoi-own, takes both endpoints [a,b)), random-range (endpoint-based), or (floor (* n (random))) hand-rolled. For a bound-only integer draw against the named standard, random-integer is the honest verb — and because every one of those candidates now draws from the same engine generator, the choice is about readability, not about which ones with-seed happens to cover.',
  'eng: five die rolls under a fixed seed, then the same five again — an operator can paste the seed into a bug report and get the identical rolls back. math: the mean of four thousand draws from [0,10) sits near 4.5, the expectation of the discrete uniform on {0..9}; the assertion is on the tolerance, never on the mean itself. cs: random-integer and random-int interleaved in opposite orders under the same seed produce the same two numbers, which is the direct observable consequence of there being exactly one stream.',
  'Why random-integer and not randint: randint takes a low and a high and is Motoi-own; random-integer takes only the bound and cites SRFI-27. When the lower bound is 0 — the common case for indices — random-integer says less and means the same.',
  'Prefer random-integer for a 0-based bound and randint when you genuinely have two endpoints. Wrap anything you intend to debug in with-seed.',
  'E[random-integer(n)] = (n-1)/2 and Var = (n^2 - 1)/12 — the discrete uniform on {0, 1, ..., n-1}.',
  'Analogues: Python random.randrange(n), Java Random.nextInt(n), Rust rng.gen_range(0..n), C rand() % n (biased — random-integer scales rather than folds, which is why it is not).'),
row3(
  'A bounded discrete draw: given a count of possible outcomes, pick one of them uniformly, with the outcomes numbered from zero.',
  [('motoi rng', RI['r3-a']),
   ('a cup of dice', RI['r3-b']),
   ('the discrete uniform distribution U{0..n-1}', RI['r3-c'])],
  'In Motoi, random-integer picks one of n numbered outcomes. Shaking a cup of five six-sided dice is the same shape repeated five times, only labelled 1 through 6 instead of 0 through 5 — the +1 is the whole difference. In probability, the discrete uniform on {0..n-1} is the same object stated as a distribution: three thousand draws over six faces land near five hundred each. All three share: n equally likely outcomes, one of them selected.',
  'The shape transfers wherever a system must choose one of a finite, equally-weighted set — a face, a cell, a list index, a branch.',
  'Zero-based bounds mean the draw can index a list directly with no arithmetic.',
  'The discrete uniform is the maximum-entropy distribution on a finite set: no outcome is favoured, so the draw carries log2(n) bits.',
  'A modulo-folded generator biases the low outcomes when n does not divide the generator period; scaling the unit draw instead — which is what random-integer does — does not.'),
row4(
  RI['r4-eng'], RI['r4-math'], RI['r4-cs'],
  'random-integer returns an integer in [0, n) for every n >= 1, and the same seed replays the identical sequence — including when a seeded extent is nested inside another one.',
  '∀ n ≥ 1, ∀ k. 0 ≤ random-integer(n) < n  ∧  ∀ seed s, thunk f. with-seed(s, f) = with-seed(s, f)',
  'eng: ten draws replay exactly under seed 4242. math: the range invariant holds across bounds 2, 6, 10, 52 and 1000, three hundred draws each. cs: an inner (with-seed 2 …) restarts the stream and then RESTORES the outer one on the way out, so the outer run sees 23 then 45 whether or not something seeded ran in between — dynamic extent, not a global assignment. What would falsify the claim: a verb reaching past src/rng.js to host entropy. tests/seed-determinism.test.mjs enumerates the live environment specifically to catch that. See book-of-math ch07 (probability) and book-of-computing ch03 (determinism).',
  'Seeded determinism is what makes a stochastic bug reportable: seed plus tick count reproduces the failure exactly.',
  'A seeded PRNG is a deterministic function from (seed, index) to a value; it is a pseudo-random SEQUENCE, not a random variable. The uniformity is a property of the sequence, and only sampling statistics can observe it.',
  'with-seed saves and restores the previous generator in a finally clause, so nesting composes and a throw inside the body still unwinds the seed.'),
row5(
  RI['r5-eng'], RI['r5-math'], RI['r5-cs'],
  'random-integer draws one uniform integer from the shared stream.',
  'eng: seeded procedural layout — random-integer inside map inside with-seed gives a level that is different from every other level but identical on every launch, which is how a shareable daily puzzle works. math: a 1-D random walk, where each step is drawn from {-1, 0, +1} and the endpoint is reproducible. cs: a seeded Fisher-Yates shuffle — repeatedly draw an index from the shrinking pool — which produces a permutation that both replays and provably contains exactly the original cards.',
  'The composition is random-integer + map + with-seed. What emerges is the seeded-generator family: procedural levels, replayable walks, deterministic shuffles. Same shape as a Minecraft world seed or a roguelike daily run. See book-of-composition ch11 (sampling) and book-of-sim-games ch04 (procedural generation).',
  'Naming the seed turns a generated artifact into a shareable one: the seed IS the level.',
  'A shuffle built on random-integer is a uniformly random permutation only if each index is drawn from the current remaining count — drawing from the full length instead is the classic biased shuffle.',
  'Seed-as-content is the standard trick for shipping infinite worlds in finite bytes: store the seed, regenerate the world.'),
TAIL,
])


# ══════════════════════════════════════════════════════════════════════════
# 2. random-real
# ══════════════════════════════════════════════════════════════════════════

REC_RR = '\n'.join([
'(verb',
'  :name "random-real" :std "SRFI-27"',
'  :library "core"',
'  :tier "core"',
'  :kind "rd"',
'  :signature "(random-real) -> real"',
'  :summary "A uniformly-distributed real in the OPEN interval (0, 1) — both ends excluded — drawn from Motoi\'s one random stream."',
'  :explanation "The SRFI-27 continuous draw, and the base variate every other distribution is built from. It reads the next value from the single engine generator in src/rng.js and returns it directly, retrying if the generator ever hands back exactly 0. That retry is the difference between random-real and Motoi\'s own (random): random gives [0, 1) with zero possible, random-real gives (0, 1) with zero excluded, which matters the moment you take a logarithm or a reciprocal of the draw — inverse-transform sampling for the exponential distribution divides by nothing and logs nothing at zero precisely because of that loop. Like every random verb in Motoi it draws from the one shared stream, so (with-seed n thunk) makes it replay, and interleaving it with random-integer or random under the same seed gives the same numbers in the same order."',
examples([
  ('novice', RR['ex-novice'],
   'A seeded unit draw. Under seed 42 it prints the same real every run. Unseeded it would print something new each time, which is why it is wrapped.'),
  ('intermediate', RR['ex-inter'],
   'The defining property, asserted rather than printed: the value is strictly greater than 0 and strictly less than 1. Open at both ends.'),
  ('expert', RR['ex-expert'],
   'A Bernoulli(0.3) trial is just (< (random-real) 0.3). Two thousand of them under a seed land near six hundred hits; the program asserts the band, never the count, so it cannot go red on a slow drift.'),
]),
strlist('caveats', [
  'The interval is OPEN at BOTH ends: 0 and 1 are both impossible. This is stricter than Motoi\'s own (random), which returns [0, 1) and CAN return exactly 0.',
  'Takes no arguments. Extra arguments are silently ignored rather than raising an arity error — (random-real 5) returns a draw and discards the 5.',
  'The exclusion of 0 is implemented as a retry loop on the underlying draw. It consumes one draw per attempt, so in the vanishingly rare case the generator emits 0 the stream advances by more than one step.',
  'Outside (with-seed …) the value is not reproducible. Never print a bare (random-real) in a test or a reference example.',
  'The underlying generator is a linear-congruential one — a replay device. Not cryptographic, and not a substitute for a high-quality source when you need many independent dimensions.',
  'DIVERGENCE from SRFI-27: the spec draws reals from an explicit source via random-source-make-reals and allows a requested unit of precision. Motoi binds neither; random-real always uses the one default source at the host double precision.',
]),
strlist('usecases', [
  'Probability gates: (if (< (random-real) 0.25) \'spawn \'skip).',
  'Jitter and noise in animation, scaled and centred: (* amount (- (random-real) 0.5)).',
  'Inverse-transform sampling — turning the unit draw into an exponential, a normal, or any distribution with an invertible CDF.',
  'Monte Carlo estimation, where a seeded run makes the estimate itself reproducible.',
]),
strlist('related', ['random-integer', 'make-random-source', 'random-source-randomize!',
                    'with-seed', 'random', 'rng-uniform', 'random-range']),
'  :learn (:concept "The unit uniform variate: the single continuous draw from which every other distribution is manufactured." :prerequisites ("random" "with-seed" "lambda") :progression "Learn random-real as the base draw; then scale it (* range) and shift it (+ lo) to reach any interval; then invert a CDF to reach any distribution; then read random-integer for the discrete case.")',
'  :provenance "SRFI-27 (Sebastian Egner) §Interface, random-real; implemented lib/std/srfi-27.js; reference record added 2026-08-02"',
row2(
  RR['r2-eng'], RR['r2-math'], RR['r2-cs'],
  'The operator needs a uniform real to drive a probability gate, and needs the run to replay for a bug report. Candidates: random-real (SRFI-27, open (0,1)), (random) (Motoi-own, half-open [0,1), can return 0), rng-uniform (the engine-facing name), or random-range with 0 and 1. When the value will be logged, divided by, or otherwise assumed non-zero, random-real is the honest verb — it is the only one of the four that guarantees the zero away.',
  'eng: five jitter offsets under a fixed seed, checked for replay AND for staying inside the requested +/- 2 band; two properties, no printed float that could drift. math: the sample mean of four thousand unit draws sits within 0.02 of 1/2, the expectation of U(0,1). cs: three thousand draws, every one strictly inside (0, 1) — this is the retry loop being exercised, and it is the property that separates random-real from (random).',
  'Why random-real and not (random): both are uniform on the unit interval, but (random) can return exactly 0 and random-real cannot. If the draw feeds a log, a reciprocal, or a division, that difference is the whole bug.',
  'Prefer random-real when a zero would be a defect; prefer (random) when you genuinely want [0, 1) and zero is a legal outcome.',
  'random-real samples U(0,1): E[X] = 1/2, Var[X] = 1/12, and the CDF is F(x) = x on the interval.',
  'Analogues: Python random.random() [0,1), JavaScript Math.random() [0,1), C++ uniform_real_distribution [a,b). Most host generators are half-open; the open interval is an SRFI-27 promise, not a host one.'),
row3(
  'A unit-interval draw: pick a real number between 0 and 1 with no value favoured, and never land exactly on either end.',
  [('motoi rng', RR['r3-a']),
   ('a spinner needle landing anywhere on a dial', RR['r3-b']),
   ('U(0,1), the base variate of every other distribution', RR['r3-c'])],
  'In Motoi, random-real returns a unit real. A spinner needle on a 360-degree dial is the same draw multiplied by 360 — it can land anywhere on the rim and never exactly on the peg. In probability, U(0,1) is that same object, and inverse-transform sampling turns it into anything else: -ln(1-U)/lambda is exponential with rate lambda, and a thousand of them average to 1/lambda. All three share: a continuous choice over a bounded span, uniformly weighted.',
  'The shape transfers wherever a system needs a normalized position, weight, or probability — anywhere a fraction between none and all is the right answer.',
  'A normalized 0-to-1 draw scales to any range with one multiply and one add, so the unit draw is the only one you have to reason about.',
  'Every invertible CDF turns U(0,1) into its own distribution: X = F^-1(U). That is why one uniform generator suffices for all of statistics.',
  'Analogues: numpy.random.random_sample, Go rand.Float64, Java Random.nextDouble — all half-open; the guaranteed-open interval is what the retry loop buys.'),
row4(
  RR['r4-eng'], RR['r4-math'], RR['r4-cs'],
  'random-real returns a real strictly inside (0, 1); the same seed replays the identical value; and the draws are uniform, in that a large sample spreads evenly across deciles.',
  '∀ k. 0 < random-real() < 1  ∧  ∀ seed s. with-seed(s, random-real) = with-seed(s, random-real)  ∧  P(a < X ≤ b) = b - a for 0 ≤ a < b ≤ 1',
  'eng: five draws replay exactly under seed 606. math: three thousand draws bucketed into ten deciles each land near three hundred, which is uniformity made observable — the assertion is the tolerance band, so no arithmetic drift can turn it red. cs: random-real interleaved with (random) in both orders under one seed yields the same pair, proving they are positions in a single sequence and not two generators. What would falsify all of this: a verb calling the host generator directly instead of src/rng.js — exactly the regression tests/seed-determinism.test.mjs exists to catch. See book-of-math ch07 (continuous distributions).',
  'Uniformity is testable only in aggregate; a single draw can never be wrong, which is why the proof row samples.',
  'A decile histogram is a crude empirical CDF; the flatness of the buckets is the statement F(x) = x, sampled.',
  'Two verbs producing one interleaved sequence is the observable signature of shared mutable generator state.'),
row5(
  RR['r5-eng'], RR['r5-math'], RR['r5-cs'],
  'random-real draws one uniform real from the shared stream.',
  'eng: a seeded spawn wave — a probability gate applied twelve times gives a wave that is random-looking but identical on replay, so a designer can tune the rate against a fixed run. math: Monte Carlo pi — count how many of n random points fall inside the unit quarter-circle and multiply by four; seeded, the estimate itself becomes a fixed number you can assert a tolerance on. cs: categorical (weighted) sampling — accumulate the weights, scale one unit draw by the total, and walk until you pass it; the whole loot table replays under its seed.',
  'The composition is random-real + a threshold or an accumulator. What emerges is the sampling family: Bernoulli gates, Monte Carlo integration, weighted choice. Same shape as np.random.choice(p=...) or a Unity loot table. See book-of-composition ch11 (sampling) and book-of-math ch07 (Monte Carlo).',
  'Seeding a Monte Carlo run converts a statistical estimate into a regression test with an exact expected value.',
  'Monte Carlo error shrinks as 1/sqrt(n), so four thousand samples buys roughly one and a half digits — which is why the assertion is a tolerance and not an equality.',
  'Weighted choice by cumulative sum is O(k) per draw; the alias method is O(1) but needs a build step, and needs the same one uniform draw.'),
TAIL,
])


# ══════════════════════════════════════════════════════════════════════════
# 3. make-random-source
# ══════════════════════════════════════════════════════════════════════════

REC_MS = '\n'.join([
'(verb',
'  :name "make-random-source" :std "SRFI-27"',
'  :library "core"',
'  :tier "core"',
'  :kind "constructor"',
'  :signature "(make-random-source) -> random-source"',
'  :summary "Allocate a fresh random-source object. In Motoi the source is NOT an independent stream and there is no way to draw from it — read the caveats before using this."',
'  :explanation "In SRFI-27 a random source is a first-class generator: you make one, seed it independently, and pull integers or reals out of it through random-source-make-integers and random-source-make-reals, so two sources can advance separately. Motoi implements the CONSTRUCTOR and nothing else. What you get back is a fresh, opaque object that is eq?-distinct from every other source, is truthy, works as an identity key in an alist — and has no accessor bound anywhere in the language, so no program can draw a number from it. Internally it holds a reference to the same engine draw that random-integer and random-real use, which means that even when accessors do land it will still be one stream, not an independent one. Two consequences, both verified below: making a source consumes NOTHING from the seeded stream, so sprinkling calls through a seeded run cannot shift a replay; and if you actually need two independent streams today, you must write your own generator closure in Scheme. The math and cs rows below show exactly how."',
examples([
  ('novice', MS['ex-novice'],
   'A source is an object with identity. Each call makes a NEW one — a is not b — and any source is truthy, so it can sit in a conditional. Do not (display) a source directly: it is a host object and prints as [object Object].'),
  ('intermediate', MS['ex-inter'],
   'Making a source draws nothing. The seeded stream reads 23 then the next value whether or not a source was constructed in between, so a source constructor can never shift a replay.'),
  ('expert', MS['ex-expert'],
   'The whole usable surface, stated honestly: randomize! hands the source straight back, and the two SRFI-27 accessors that would let you draw from it are unbound. The guard turns "unbound symbol" into a #f you can print, so the absence is demonstrated rather than asserted.'),
]),
strlist('caveats', [
  'DIVERGENCE, and the important one: Motoi binds NO SRFI-27 source accessors. random-source-make-integers, random-source-make-reals, random-source-state-ref, random-source-state-set!, random-source-pseudo-randomize! and default-random-source are all unbound. A source you construct cannot be drawn from. Its only legal argument position today is random-source-randomize!.',
  'NOT INDEPENDENT. The source holds a reference to the single engine draw in src/rng.js — the same one random-integer and random-real read. Two sources are two objects over ONE stream, not two streams. That is deliberate: an independent source would let a cart escape (with-seed …) and break replay.',
  'Constructing a source consumes zero draws from the stream, so adding or removing a call cannot shift a seeded replay.',
  'The returned value is a host object with no printed representation: (display (make-random-source)) prints [object Object]. Compare sources with eq?, do not print them.',
  'BUG BOUNDARY, reported not fixed: (delete-duplicates srcs eq?) collapses distinct sources to one, because delete-duplicates keys on a JSON serialization and ignores its optional equality argument. eq?, eqv? and equal? all correctly report two sources as different. Count distinct sources with an explicit memq walk, as the programs in this record do.',
  'If you genuinely need two independent streams, build a generator closure in Scheme — see the math programs in rows 2 and 5. That is a real workaround, not a hypothetical one.',
]),
strlist('usecases', [
  'Portability: keeping SRFI-27-shaped code readable when it is ported into Motoi, even though the source cannot be drawn from here.',
  'An identity token — sources are eq?-distinct and work as keys in an assq registry.',
  'The argument to random-source-randomize!, which is the only verb that takes one.',
  'A teaching contrast: what a first-class generator object WOULD buy you, against Motoi\'s deliberate single-stream design.',
]),
strlist('related', ['random-source-randomize!', 'random-integer', 'random-real', 'with-seed', 'random']),
'  :learn (:concept "A generator as an OBJECT rather than a global: what a first-class random source is, and why Motoi deliberately keeps one shared stream instead." :prerequisites ("random-integer" "with-seed" "eq?" "lambda") :progression "Make a source and confirm it is distinct and draws nothing; then confirm the accessors are unbound; then build your own generator closure to see what an independent source would actually give you; then read random-source-randomize! for the other half of the divergence.")',
'  :provenance "SRFI-27 (Sebastian Egner) §Interface, make-random-source; constructor-only implementation in lib/std/srfi-27.js; reference record added 2026-08-02"',
row2(
  MS['r2-eng'], MS['r2-math'], MS['r2-cs'],
  'The operator is porting SRFI-27 code that allocates several random sources and expects each to advance separately. Candidates: make-random-source (allocates, but yields no accessor and no separate stream), with-seed (gives reproducibility over the one shared stream, which is what Motoi actually offers), or a hand-written generator closure. If the requirement is genuinely INDEPENDENT streams, none of the built-ins meet it and the closure is the honest answer — this row shows both what the constructor does give you and what you must write yourself.',
  'eng: four sources are four distinct objects, and the same object counted three times still counts once — identity works exactly as you would expect, using an explicit memq walk rather than delete-duplicates. math: two hand-written LCG closures seeded identically produce identical sequences and advance independently of each other; that is the contract make-random-source would have if the accessors existed. cs: two source constructions inserted into the middle of a seeded run leave the stream untouched, which is why the constructor is safe to call anywhere.',
  'Why make-random-source is NOT the choice for independent streams: it returns an object, not a stream. The closure in the math program is what a source actually has to be, and Motoi does not give you one.',
  'Reach for a closure when you need separate streams; reach for with-seed when you need reproducibility, which is the far more common requirement.',
  'A generator closure is a coalgebra: a hidden state plus a step function producing (value, state\'). Two closures over the same seed are bisimilar and yield identical sequences.',
  'This is the classic global-versus-injected-dependency tradeoff. One global stream gives cheap whole-program replay; injected sources give composability and isolation. Motoi chose replay on purpose.'),
row3(
  'A generator as a thing you hold: allocate an object that stands for a source of randomness, distinct from every other such object.',
  [('motoi rng', MS['r3-a']),
   ('a fresh dice cup handed to each player at one table', MS['r3-b']),
   ('a state machine: a hidden seed plus a step function', MS['r3-c'])],
  'In Motoi, make-random-source hands back an object with stable identity. At a table, each of three players gets their own cup — three distinct cups, but they are all shaking on one table, which is exactly Motoi\'s situation: distinct objects, one shared stream. In mathematics the honest model is a state machine: a hidden seed and a step that advances it, which the third rung builds explicitly so you can watch the state move. All three share: an object that STANDS FOR a source, held separately from the numbers it produces.',
  'The shape transfers wherever a capability is handed out as a value — a file handle, a connection, a generator — so that holders can be tracked, swapped, or mocked.',
  'Handing out a generator object lets tests swap in a fake; a hard-wired global cannot be swapped.',
  'The (peek, step) pair is the coalgebraic view of a stream: state plus observation plus transition.',
  'Analogues: Java Random instances, numpy Generator objects, Rust ThreadRng — all real independent sources. Motoi\'s object is a placeholder for that shape, not an instance of it.'),
row4(
  MS['r4-eng'], MS['r4-math'], MS['r4-cs'],
  'make-random-source returns a FRESH, eq?-distinct object on every call; it consumes nothing from the engine stream; and in Motoi today it has no draw accessor, so the object cannot produce a number.',
  '∀ calls i ≠ j. source_i ≠eq? source_j  ∧  ∀ seeded run r. stream_position(r) is unchanged by any number of make-random-source calls  ∧  bound?(random-source-make-integers) = #f',
  'eng: fifty constructions yield fifty distinct objects under an eq? walk. math: five draws under seed 21 land on the same five numbers whether or not a source is constructed before each one — the stream position is provably untouched. cs: the bindings themselves, probed with guard — random-integer and make-random-source are bound, random-source-make-integers, random-source-state-ref and default-random-source are not. That last program is the honest-null made runnable: the absence is demonstrated, not claimed. What would falsify: any of those three names becoming bound, at which point this record needs revisiting.',
  'A constructor with no side effect on shared state is safe to call from anywhere, including inside a seeded replay.',
  'Freshness is object identity, not value equality; two sources are indistinguishable by content and distinguishable by eq?.',
  'Probing bindings with guard is how you assert an absence in a language with no bound? predicate — the unbound-symbol error is catchable.'),
row5(
  MS['r5-eng'], MS['r5-math'], MS['r5-cs'],
  'make-random-source allocates a distinct, draw-less source object.',
  'eng: give every player a source, then roll for all of them under one seed — the whole match replays, because the sources are decoration and the seed is what actually governs. math: two Scheme-level LCG closures seeded alike agree with each other and then diverge as each is advanced separately; this is the independent-stream shape you must build yourself. cs: sources used as eq?-keyed identities in an assq registry, giving each source a stable id — the one thing Motoi\'s source object is genuinely good for.',
  'The composition is make-random-source + assq (identity registry) or, for real independence, lambda + set! (a generator closure). What emerges is the capability-object family: hand out a token, look up what it owns. Same shape as file handles or connection pools. See book-of-composition ch05 (scoped resources) and book-of-computing ch09 (state machines).',
  'A per-holder token plus a registry gives you tracking and mocking without touching the thing being tracked.',
  'Two closures over the same seed are bisimilar until one is advanced; independence is a property of separate state, not of separate names.',
  'Identity-keyed lookup requires eq?, not equal? — which is exactly why the delete-duplicates defect noted in the caveats is worth knowing about here.'),
TAIL,
])


# ══════════════════════════════════════════════════════════════════════════
# 4. random-source-randomize!
# ══════════════════════════════════════════════════════════════════════════

REC_RZ = '\n'.join([
'(verb',
'  :name "random-source-randomize!" :std "SRFI-27"',
'  :library "core"',
'  :tier "core"',
'  :kind "state-change"',
'  :signature "(random-source-randomize! src) -> src"',
'  :summary "In SRFI-27 this reseeds a source from system entropy, deliberately DESTROYING reproducibility. In Motoi it is a documented no-op that returns its argument unchanged — the seed always wins."',
'  :explanation "This is the one verb in the family whose stated purpose is to break replay. In SRFI-27 you call it once at program start so that each launch of a game deals a different hand; the price is that the run can no longer be reproduced. Motoi does not pay that price. The implementation is a no-op that hands the argument straight back, and the reason is stated in the source: reseeding from entropy would let a cart escape (with-seed …) from INSIDE the seeded extent, which would break the promise a learner is relying on when they replay a run to find a bug. Nothing is lost by the omission, because Motoi already gives you the behaviour the other way round — outside with-seed the draw is nondeterministic by default, so a fresh game every launch is what you get for free, and with-seed is what you reach for when you want the run pinned. When WOULD you want a real randomize!? Only where unpredictability matters more than reproducibility, and even then not from inside a seeded extent. When would you emphatically NOT? In a test, and in any cart a learner is meant to be able to replay — which in Motoi is all of them."',
examples([
  ('novice', RZ['ex-novice'],
   'It hands the source straight back, unchanged and eq?-identical. That is the whole behaviour.'),
  ('intermediate', RZ['ex-inter'],
   'The load-bearing property: calling randomize! in the middle of a seeded run changes nothing. Both runs read 238 then 913. The seed is not escapable from inside.'),
  ('expert', RZ['ex-expert'],
   'A cart tick that calls randomize! every frame still replays byte-for-byte under its seed. This is the case the no-op exists to protect.'),
]),
strlist('caveats', [
  'DIVERGENCE, deliberate and load-bearing: SRFI-27 specifies a reseed from system entropy. Motoi implements a no-op. Ported code that relies on randomize! to produce a different sequence will silently get the same one.',
  'It cannot escape (with-seed …). Calling it inside a seeded extent leaves the seeded sequence exactly as it was — verified in rows 1, 2 and 4 of this record.',
  'It consumes ZERO draws, so inserting or removing calls never shifts a seeded replay.',
  'NO TYPE CHECK. It accepts and returns literally anything: (random-source-randomize! 42) returns 42, and a symbol, a list, or a string come back untouched. A caller passing the wrong thing gets no error.',
  'Called with no arguments it returns the host\'s unspecified value, which displays as empty. Not an arity error.',
  'To get a different sequence on every launch, do not call this — simply do not wrap the code in with-seed. Unseeded draws are already nondeterministic.',
  'Never reach for the SRFI-27 semantics inside a test or inside a cart a learner is meant to replay. Reproducibility is the feature; this verb is the one that would take it away.',
]),
strlist('usecases', [
  'Source compatibility: SRFI-27 code that calls randomize! at startup ports into Motoi unchanged and keeps working, because the no-op is harmless.',
  'Teaching the seed contract by counter-example — the verb that in every other Scheme would break replay, and here does not.',
  'Documenting intent in a cart ("this is where a different run per launch would be requested") without actually surrendering replay.',
  'Anti-regression testing: a run that calls randomize! throughout and still replays proves the seed cannot be escaped from inside.',
]),
strlist('related', ['make-random-source', 'random-integer', 'random-real', 'with-seed', 'random']),
'  :learn (:concept "The deliberate no-op: a standard verb whose specified behaviour would break a stronger local guarantee, so the implementation declines it and says so." :prerequisites ("make-random-source" "with-seed" "random-integer" "eq?") :progression "Confirm it returns its argument; then confirm it cannot escape with-seed; then ask what you actually wanted — a fresh run per launch is achieved by NOT seeding, not by reseeding.")',
'  :provenance "SRFI-27 (Sebastian Egner) §Interface, random-source-randomize!; deliberate no-op divergence documented in lib/std/srfi-27.js; reference record added 2026-08-02"',
row2(
  RZ['r2-eng'], RZ['r2-math'], RZ['r2-cs'],
  'The operator wants a different level on every launch and reaches for random-source-randomize!, because that is what SRFI-27 says it does. Candidates: random-source-randomize! (a no-op here — it will not do it), removing the with-seed wrapper (which is how Motoi actually spells "different every launch"), or seeding from a clock (possible, but then you must log the seed or you have lost the run forever). For nondeterminism in Motoi, NOT seeding is the honest answer; this verb is not.',
  'eng: a level builder that calls randomize! before generating still produces the identical level under a fixed seed, so the regression test that pins that level keeps passing — which is the property the no-op is protecting. math: five randomize! calls interleaved between five draws leave the stream position exactly where it would have been; the count of draws consumed is zero. cs: the total absence of a type check, made visible — an integer, a symbol, a list and a string all pass straight through and come back unchanged.',
  'Why not random-source-randomize!: in Motoi it does nothing at all. Reaching for it to get variety is a silent no-op, and the caller will not be told.',
  'To vary per launch, drop the with-seed. To pin a run, add it. There is no third mechanism, and this verb is not one.',
  'The verb is the identity function on its argument: randomize!(x) = x for every x, so it is idempotent and composes to itself under repetition.',
  'A no-op that is DOCUMENTED as a no-op is a different thing from a stub: the source states the reason, the test suite classifies it, and this record repeats it. Silent no-ops are the bug; declared ones are a design decision.'),
row3(
  'A request to shuffle that is politely declined: the call is accepted, the argument comes back, and the underlying order is untouched.',
  [('motoi rng', RZ['r3-a']),
   ('asking the dealer to reshuffle at a replay table', RZ['r3-b']),
   ('the identity function on its argument', RZ['r3-c'])],
  'In Motoi, randomize! returns its source and changes nothing. At a table set up for replay, asking the dealer to reshuffle gets a nod and the same five cards — the hand under seed 88 is identical with and without the request. In mathematics that is simply the identity function: for every value handed in, the same value comes out, integers and symbols and strings and sources alike. All three share: a call that is accepted and has no effect.',
  'The shape transfers wherever an interface must be honoured for compatibility while the behaviour behind it is deliberately withheld — a stubbed capability, a read-only mount, a dry-run flag.',
  'Accepting a call and doing nothing keeps ported code running; the cost is that the omission must be documented loudly or it becomes a trap.',
  'randomize! = id, so it is idempotent: id ∘ id = id, and any number of calls equals none.',
  'This is the Null Object pattern applied to a capability: satisfy the interface, decline the effect, and say so in the docs.'),
row4(
  RZ['r4-eng'], RZ['r4-math'], RZ['r4-cs'],
  'random-source-randomize! is the identity on its argument, consumes zero draws, and never escapes (with-seed …) — including from inside a nested seeded extent.',
  '∀ x. randomize!(x) = x  ∧  ∀ seeded thunk f. with-seed(s, f) = with-seed(s, f∘randomize!)  ∧  draws_consumed(randomize!) = 0',
  'eng: one call and two nested calls both return the very same object, so the verb is idempotent. math: twenty draws with two randomize! calls peppered through them match twenty clean draws exactly — nothing shifted, nothing consumed. cs: an inner with-seed containing a randomize! still restores the outer extent, so the outer run reads its two values unchanged; the seed survives both nesting and the verb that in any other Scheme would have destroyed it. What would falsify all three: an implementation that actually reseeded from entropy — which is precisely the change this record exists to warn against making.',
  'An anti-regression property worth restating in every cart: the seed is not escapable from inside the seeded extent.',
  'Zero draws consumed means the verb commutes with every draw in the sequence — it can be inserted or removed anywhere without renumbering.',
  'with-seed saves and restores the previous generator, so seeded extents nest properly and a no-op in the middle of one is genuinely invisible.'),
row5(
  RZ['r5-eng'], RZ['r5-math'], RZ['r5-cs'],
  'random-source-randomize! returns its argument and changes nothing.',
  'eng: a reproducible bug report — seed plus tick count plus output, regenerable on demand even though the tick calls randomize! every time; this is what "send me the seed" is worth. math: common random numbers — two strategies scored under the SAME seed, so the difference between them is signal rather than sampling noise, which is the standard variance-reduction trick and depends entirely on the seed not being escapable. cs: a golden-master suite over three seeds, stable across runs, which is only a test at all because randomize! cannot break it.',
  'The composition is with-seed + a routine that calls randomize! + an equality assertion. What emerges is the replayable-run family: bug reports carrying a seed, paired A/B comparisons, golden-master tests. Same shape as a recorded replay in a fighting game or a fixed-seed property test. See book-of-composition ch14 (reproducible runs) and book-of-cs-curriculum ch08 (testing stochastic code).',
  'The seed is the bug report. A stochastic failure that carries its seed is as debuggable as a deterministic one.',
  'Common random numbers reduce the variance of a paired comparison because the two runs share the noise; the estimator sees the difference, not the draws.',
  'A golden master over a stochastic routine is only possible when the randomness is pinned — which is why a real randomize! would have to be kept out of the seeded extent anyway.'),
TAIL,
])


HEADER = """
;; ═══ SRFI-27 — sources of random bits (4 verbs, added 2026-08-02) ═══
;;
;; Implemented in lib/std/srfi-27.js; installed by core/parts-registry.js.
;; The governing contract for this family is SEEDED DETERMINISM: every draw
;; in Motoi — random, random-int, randint, random-range, random-pick,
;; rng-uniform, random-integer, random-real — goes through the ONE generator
;; in src/rng.js, so (with-seed n thunk) covers all of them together. That
;; was broken three separate times by verbs reaching for host entropy; see
;; tests/seed-determinism.test.mjs, which enumerates the live environment so
;; a fourth regression fails the suite. Every program in these four records
;; is deterministic at the output level: seeded, or asserting a property.
"""


def main():
    out = HEADER.rstrip('\n') + '\n\n' + '\n\n'.join([REC_RI, REC_RR, REC_MS, REC_RZ]) + '\n'
    path = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'records.slat')
    with open(path, 'w') as f:
        f.write(out)
    print('wrote %s (%d bytes, %d programs referenced)' % (path, len(out), len(PROGRAMS)))


if __name__ == '__main__':
    main()
