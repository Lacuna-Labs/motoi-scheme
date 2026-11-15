// coordinate.test.mjs — THE COORDINATE (K1.0, the day-1 contract). Owns: the proofs that print and parse round-trip over the
// widths, that a missing field is `-` in the seventh place as in the first, that a field over its width is refused by
// name, that prefix and within group a call under its run and its order, and that toULA/fromULA round-trip every complete
// coordinate (a fuzz over the widths) and refuse an address that is not a ULA. Refuses: a mock of coordinate.mjs; any
// decision made on the address (no test asks "may").
import test from 'node:test'
import assert from 'node:assert/strict'
import { FIELDS, SERVICES, BLOCK, coordinate, print, parse, prefix, within, depth, toULA, fromULA, serviceName } from '../coordinate.mjs'

const EXAMPLE = { box: 1, service: 4096, wo: 273615, run: 1, gen: 1, step: 3, call: 12 }

// spec: SENTRY-2.0 §4, ROAD category 6 unit 6.1 (the field table = 128 bits; the print form) · class: L5 a record's shape
// technique: the design's own example · method: print it, parse it back, compare field by field
// sre: can an on-call read a coordinate off a row and know box, service, order, run, generation, step and call at once?
test('the seven fields are 128 bits and the design example prints and parses back', () => {
  assert.equal(FIELDS.reduce((n, f) => n + f.bits, 0), 128)
  assert.deepEqual(FIELDS.map((f) => f.name), ['box', 'service', 'wo', 'run', 'gen', 'step', 'call'])
  const c = coordinate(EXAMPLE)
  assert.equal(print(c), 'lacuna:/1/4096/273615/1/1/3/12')
  assert.deepEqual({ ...parse(print(c)) }, EXAMPLE)
})

// spec: category 6 ("a missing field is -") · A2 §2.1 (`at` is "-" where unknown) · class: L5
// technique: a partial coordinate (the foreman's own, no run) and one with the middle missing
// method: print keeps seven places; parse reads `-` back as null; depth counts the leading present fields
// sre: does a row stamped before the run existed still parse, and does it say which fields it did not know?
test('a missing field is - and keeps its place; depth counts what is known', () => {
  const own = coordinate({ box: 1, service: 4096 })
  assert.equal(print(own), 'lacuna:/1/4096/-/-/-/-/-')
  assert.deepEqual({ ...parse('lacuna:/1/4096/-/-/-/-/-') }, { ...own })
  assert.equal(depth(own), 2)
  const gap = parse('lacuna:/1/4096/-/7/1/2/3')
  assert.equal(gap.wo, null); assert.equal(gap.run, 7); assert.equal(depth(gap), 2)
})

// spec: the widths (box 16 = fd ∥ 8, service 16, wo 32, run 16, gen 8, step 16, call 24) · class: L1 fail closed on a bad field
// technique: one value past each width, a negative, a fraction, a word; a bad print form
// method: each is refused with the field named in the sentence; nothing is coerced
// sre: can a producer stamp a row with a number the wire cannot carry and have it silently truncated? (it must not)
test('a field over its width, a negative, a fraction or a word is refused by name', () => {
  assert.throws(() => coordinate({ box: 256 }), /box is at most 255/)
  assert.throws(() => coordinate({ service: 65536 }), /service is at most 65535/)
  assert.throws(() => coordinate({ wo: 2 ** 32 }), /wo is at most 4294967295/)
  assert.throws(() => coordinate({ run: 65536 }), /run is at most 65535/)
  assert.throws(() => coordinate({ gen: 256 }), /gen is at most 255/)
  assert.throws(() => coordinate({ step: 65536 }), /step is at most 65535/)
  assert.throws(() => coordinate({ call: 2 ** 24 }), /call is at most 16777215/)
  assert.throws(() => coordinate({ run: -1 }), /run is a whole number/)
  assert.throws(() => coordinate({ step: 1.5 }), /step is a whole number/)
  assert.throws(() => coordinate({ call: 'twelve' }), /call is a whole number/)
  assert.throws(() => parse('w-393661'), /starts with lacuna:\//)
  assert.throws(() => parse('lacuna:/1/4096/273615'), /has 7 fields/)
  assert.throws(() => parse('lacuna:/1/4096/273615/1/1/3/x'), /call is a whole number or -/)
})

// spec: category 6 ("membership and grouping are prefix compares") · class: L5
// technique: the example call under its run, its order, its box; a call of another run
// method: prefix(c, 4) is the run's coordinate; within(call, run) true; within(call, otherRun) false; within(run, call) false
// sre: can the floor group every row of one work order with one compare and never mix two orders?
test('prefix and within: a call sits inside its step, run, order and box, and in no other', () => {
  const call = coordinate(EXAMPLE)
  const run = prefix(call, 4)
  assert.equal(print(run), 'lacuna:/1/4096/273615/1/-/-/-')
  assert.ok(within(call, run) && within(call, prefix(call, 3)) && within(call, prefix(call, 1)) && within(call, call))
  assert.ok(!within(run, call), 'a run is not inside one of its calls')
  assert.ok(!within(call, coordinate({ ...EXAMPLE, run: 2 })), 'another run of the same order')
  assert.ok(!within(call, coordinate({ ...EXAMPLE, wo: 273616 })), 'another order')
  assert.ok(within(call, coordinate({})), 'the empty prefix holds everything')
  assert.throws(() => prefix(call, 8), /0 to 7/)
})

// spec: SENTRY-2.0 §4 ("fits 128 bits as ULA IPv6") · category 6 ("the IPv6 ULA form is a pure function of it") · class: L5
// technique: the design example by hand, then a seeded fuzz of 2,000 complete coordinates over every width
// method: toULA → fromULA equals the input field for field; the address starts fd; a non-fd address and a short one are refused
// sre: when a second box exists, does every coordinate already have one routable address and no second numbering?
test('toULA and fromULA round-trip every complete coordinate; the address is a ULA by construction', () => {
  const c = coordinate(EXAMPLE)
  assert.equal(toULA(c), 'fd01:1000:0004:2ccf:0001:0100:0300:000c')
  assert.deepEqual({ ...fromULA(toULA(c)) }, EXAMPLE)
  let seed = 7
  const rnd = (max) => { seed = (seed * 1103515245 + 12345) % 2147483648; return Math.floor((seed / 2147483648) * (max + 1)) }
  for (let i = 0; i < 2000; i++) {
    const parts = Object.fromEntries(FIELDS.map((f) => [f.name, rnd(f.max)]))
    const x = coordinate(parts)
    const back = fromULA(toULA(x))
    assert.deepEqual({ ...back }, parts, `fuzz ${i}: ${print(x)}`)
    assert.ok(toULA(x).startsWith('fd'))
  }
  assert.equal(toULA(coordinate({ box: 1, service: 4096 })), 'fd01:1000:0000:0000:0000:0000:0000:0000', 'a prefix packs its missing fields as 0')
  assert.throws(() => toULA(coordinate({ box: 1 })), /needs box and service/)
  assert.throws(() => fromULA('fe80:1000:0004:2ccf:0001:0100:0300:000c'), /starts with fd/)
  assert.throws(() => fromULA('fd01:1000'), /eight hextets/)
})

// spec: the brief's day-1 contract (foreman 4096, door 4097, hands 4098, engine 4099, …; the block 4096–4159) · class: L5
// technique: the table as data · method: every number inside the block, no two services share one, the four named are fixed
// sre: can two services ever stamp the same service number on a row?
test('the service numbers: unique, inside the block, the four named by the brief fixed', () => {
  const nums = Object.values(SERVICES)
  assert.equal(new Set(nums).size, nums.length)
  assert.ok(nums.every((n) => n >= BLOCK.first && n <= BLOCK.last))
  assert.deepEqual([SERVICES.foreman, SERVICES.door, SERVICES.hands, SERVICES.engine], [4096, 4097, 4098, 4099])
  assert.equal(serviceName(4096), 'foreman'); assert.equal(serviceName(4200), null)
  assert.equal(SERVICES.runtime, 4109)
})
