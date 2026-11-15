// box.test.mjs — this box's profile: states, the price of a wake, cart admission (O1–O4).
import test from 'node:test'
import assert from 'node:assert/strict'
import { readBox, mindOf, stateOf, priceOf, admitCart } from '../box.mjs'

const P = readBox(`(box (name "t") (wired-limit-mb 27917) (admit-floor-mb 1500))
(mind (id 26b) (tag "gemma4:26b") (alias "lacuna-worker-lite") (seat brain) (use-mb 22500) (load-s 16 31) (fits alone))
(mind (id 12b) (tag "gemma4:12b-it-q8_0") (seat brain) (use-mb 14500) (load-s 9 20) (fits alone))
(mind (id e4b) (tag "gemma4:e4b-it-q8_0") (seat pool) (use-mb 9500) (load-s 6 6) (fits without-26b))
(mind (id 270m) (tag "gemma3:270m") (seat pool) (use-mb 380) (load-s 0.82 0.82) (fits beside-26b))
(mind (id embeddinggemma) (tag "embeddinggemma:latest") (seat resident) (use-mb 650) (fits beside-26b))
(mind (id 31b) (tag "gemma4:31b") (seat brain) (use-mb 33000) (load-s null null) (fits never))`)
const LIVE = { brain: '26b', loaded: ['embeddinggemma:latest'], availMB: 5400 }

test('names resolve by id, tag or alias; states are lit, asleep or dark', () => {
  assert.equal(mindOf(P, 'lacuna-worker-lite').id, '26b')
  assert.equal(mindOf(P, 'embeddinggemma').id, 'embeddinggemma')
  assert.equal(stateOf(P, mindOf(P, '26b'), LIVE), 'lit')
  assert.equal(stateOf(P, mindOf(P, '12b'), LIVE), 'asleep')
  assert.equal(stateOf(P, mindOf(P, '31b'), LIVE), 'dark')
})

test('the price of a wake: a brain swap, a fit beside, an unload, a dark model', () => {
  const twelve = priceOf(P, '12b', LIVE)
  assert.deepEqual([twelve.ok, twelve.unload, twelve.seconds], [true, ['26b'], [9, 20]])
  assert.match(twelve.say, /the 26b unloads, about 9–20 s here/)
  assert.deepEqual(priceOf(P, '270m', LIVE).unload, [])
  assert.deepEqual(priceOf(P, 'e4b', LIVE).unload, ['26b'])
  const big = priceOf(P, '31b', LIVE)
  assert.equal(big.ok, false); assert.match(big.say, /stays dark here/)
  assert.match(priceOf(P, 'nope', LIVE).say, /not on this box/)
})

test('a cart is admitted by its minds against the live free memory; never-fits and dark are refused with the numbers', () => {
  assert.equal(admitCart({ name: 'small', minds: { label: { model: 'gemma3:270m' } } }, P, LIVE).ok, true)
  assert.equal(admitCart({ name: 'brainy', minds: { j: { model: 'lacuna-worker-lite' } } }, P, LIVE).why, 'every mind it names is awake')
  const e4 = admitCart({ name: 'team', minds: { w: { model: 'gemma4:e4b-it-q8_0' } } }, P, LIVE)
  assert.deepEqual([e4.ok, e4.exit], [false, 89]); assert.match(e4.why, /runs once the brain is unloaded/)
  assert.match(admitCart({ name: 'huge', minds: { b: { model: 'gemma4:31b' } } }, P, LIVE).why, /stays dark here/)
  assert.match(admitCart({ name: 'both', minds: { a: { model: 'gemma4:12b-it-q8_0' }, b: { model: 'gemma4:e4b-it-q8_0' }, c: { model: 'lacuna-worker-lite' } } }, P, LIVE).why, /never runs here/)
})

// K1 (2026-10-26): free memory alone admitted a 9.5 GB load the wired wall could not hold; the price and the cart admission
// read wired memory too
test('a wake that fits in free memory but not under the wired limit is not priced as fitting beside', () => {
  const p = readBox(`(box (name "t") (wired-limit-mb 27917) (admit-floor-mb 1500))
(mind (id e4b) (tag "gemma4:e4b-it-q8_0") (seat pool) (use-mb 9500) (load-s 6 6) (seats worker) (fits without-26b))`)
  assert.match(priceOf(p, 'e4b', { availMB: 11592, wiredMB: 9000 }).say, /fits beside/)
  assert.doesNotMatch(priceOf(p, 'e4b', { availMB: 11592, wiredMB: 17085 }).say, /fits beside/)
  const cart = { name: 'c', minds: { w: { model: 'e4b' } } }
  assert.equal(admitCart(cart, p, { availMB: 11592, wiredMB: 9000 }).ok, true)
  assert.match(admitCart(cart, p, { availMB: 11592, wiredMB: 17085 }).why, /wired/)
})

// spec: ruling t2 and the owner's video, 2026-10-27 (the 12B priced as taking the desk's seat with 16.8 GB free) · class: W ·
// technique: state table · sre: does waking a mind that fits ever unload the desk?
test('a brain-seat mind that fits wakes beside the desk; one that does not fit takes the seat', () => {
  const p = readBox(`(box (name "t") (wired-limit-mb 27917) (admit-floor-mb 1500))
(mind (id e4b) (tag "gemma4:e4b-it-qat") (seat brain) (use-mb 7000) (load-s 7 7))
(mind (id 12b) (tag "gemma4:12b-it-qat") (seat brain) (use-mb 7900) (load-s null null))
(mind (id 26b) (tag "gemma4:26b-a4b-it-qat") (seat brain) (use-mb 19000) (load-s 16 31))`)
  const live = { brain: 'e4b', availMB: 16808, wiredMB: 3667, loaded: [] }
  const twelve = priceOf(p, '12b', live)
  assert.deepEqual(twelve.unload, []); assert.match(twelve.say, /fits beside/)
  const big = priceOf(p, '26b', live)
  assert.deepEqual(big.unload, ['e4b']); assert.match(big.say, /takes the brain's seat/)
})

// spec: docs/eng/VIDEO-PASS-2026-10-31.md D4, D6 ("an unmeasured size is 'unmeasured', not 'does not fit'"; "one sentence that is
// true; no template holes ('about unmeasured')") · class: L4 a false or holed sentence · technique: a brain-seat mind with no load
// time; pool minds with no measured size, with and without a brain to unload · method: the sentence · sre: does a wake's price
// ever read "about unmeasured" or "? MB", or say a mind does not fit when its size was never measured?
test('a price says "unmeasured" where a number is missing: never "about unmeasured" or "? MB", never no room for an unmeasured size', () => {
  const U = readBox(`(box (name "t") (wired-limit-mb 27917) (admit-floor-mb 1500))
(mind (id 26b) (tag "gemma4:26b") (seat brain) (use-mb 22500) (load-s 16 31) (fits alone))
(mind (id 12b) (tag "gemma4:12b") (seat brain) (use-mb 14500) (load-s null null) (fits alone))
(mind (id e4b) (tag "gemma4:e4b") (seat pool) (load-s 6 6) (fits without-26b))
(mind (id e2b) (tag "gemma4:e2b") (seat pool) (load-s 3 3) (fits beside-26b))`)
  const twelve = priceOf(U, '12b', LIVE)
  assert.match(twelve.say, /the 26b unloads, its load time here is unmeasured;/); assert.doesNotMatch(twelve.say, /about unmeasured/)
  const e4 = priceOf(U, 'e4b', LIVE)
  assert.doesNotMatch(e4.say, /\? MB/); assert.match(e4.say, /^e4b needs an unmeasured amount of memory;/)
  const e2 = priceOf(U, 'e2b', { ...LIVE, brain: null })
  assert.equal(e2.ok, false)
  assert.doesNotMatch(e2.say, /nothing it may unload makes room|\? MB/)
  assert.match(e2.say, /^e2b's memory here is unmeasured and 5400 MB is free: its price waits for a measure/)
})
