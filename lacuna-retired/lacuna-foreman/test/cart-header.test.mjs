// cart-header.test.mjs — A CART'S HEADER READ AS DATA, AND EVERY WAY IT CAN BE WRONG. Owns: the tests of cart.mjs
// `readCart` and `isCart` over the header fields (design §12.1: name does agent.tier agent.verbs acts minds judgment
// touches done exam shadow version restart deadlines contract sentry states intensity foreman author hands) and the body
// check (only the header's verbs; need-brain only at a judgment point; one handler per kind; one header). Refuses: the
// live box profile and tiers.json; a mock of cart.mjs. Implements: work order U5 §3 row cart/carts/inventory; design §12
// (carts), §7 (forms: the header is data, never evaluated), laws 2 · 9. Invariants (§18): "If a step is done, then a
// ticket closed it" — a header is a refusal or a header, never a half-read cart that runs. Faults (§16): F-02 (a verb the
// header lacks, exit 12, one sentence), F-07 (the same refusal every round until the header or the body changes), F-09
// (a bare judgment point falls back to ask-owner).
// coverage: cart.mjs — lines 100% branches 99.31% functions 100% (2026-10-24, the lane's files alone; two dead branches are todos)
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { readCart, isCart, HEADER_3 } from '../cart.mjs'

const BOX = JSON.parse(readFileSync(new URL('./fixtures/box-minds.json', import.meta.url), 'utf8'))
const CART = (fields = '', verbs = 'on report', body = '') => `(lacuna-cart 'probe '((does . "reads one thing") (done . "one pass")
  (agent . ((tier . watch) (verbs . (${verbs})))) ${fields}))
${body}`

// spec: design §12.1 (the header is the cart's FIRST form, read as data before anything is evaluated) · §7 forms · F-02 exit 12
// class: W5 malformed (size; shape; a symbol as body data) · J7 hostile input (unbalanced text, a number as a name, an empty program)
// technique: state-machine walk over every way the first form can fail to be a header
// method: readCart each malformed program; read the one sentence each throws; isCart on the same texts
// sre: if a generated cart arrives truncated or with a junk first line, is it refused with a sentence before any of it runs?
test('a program that is not a header is refused with one sentence: unreadable, not first, the wrong shape, a bad name', () => {
  assert.throws(() => readCart('(lacuna-cart \'x \'((does . "a")'), /^Error: the cart does not read: /)
  for (const p of [null, '', '(on \'x (lambda (v) v))', "(lacuna-cart 'x)", "(lacuna-cart 'x '() 'extra)", '("lacuna-cart" x y)'])
    assert.throws(() => readCart(p), /a cart opens with its header: \(lacuna-cart 'name/, String(p))
  assert.throws(() => readCart(CART().replace("'probe", "'Probe")), /a cart's name is a short lowercase word with dashes, not 'Probe'/)
  assert.throws(() => readCart(CART().replace("'probe", `'a${'b'.repeat(60)}`)), /not 'ab{60}'/)
  assert.throws(() => readCart(CART().replace("'probe", '42')), /not '42'/)
  assert.equal(readCart(CART().replace("'probe", '"probe"')).name, 'probe', 'a name written as a string reads the same')
  assert.throws(() => readCart(`(lacuna-cart 'x "does things")`), /the cart x says what it does/, 'a header that is text, not an alist')
  const loose = readCart(`(lacuna-cart 'x '((does . "d") (done . "e") (agent (tier . watch) (verbs on report)) (notes a b) (version) (exam)))`)
  assert.deepEqual([loose.verbs, loose.version, loose.exam], [['on', 'report'], null, null], 'the dotted and the plain list read alike; an empty field is unset')
  assert.deepEqual(readCart(CART('(touches . "log:dev-api")')).touches, ['log:dev-api'], 'one touch written bare is a list of one')
  assert.deepEqual(readCart(CART('(touches ("a" "b"))')).touches, ['a', 'b'], 'a list written without the dot reads the same')
  assert.deepEqual([isCart(null), isCart(';; one\n;; two\n  (lacuna-cart \'x'), isCart('(lacuna-cartx'), isCart('(lacuna-cart)')], [false, true, false, true])
})

// spec: design §12.1 (tier watch|act; does and done are sentences) · §11 (capabilities by tier; a watch cart never acts)
// class: F-02 a verb not held · J13 a field unset or blank
// technique: boundary — each required field absent, blank, or the wrong word; the agent alist absent entirely
// method: readCart each; read the sentence; then a header with no agent at all reads as a watch cart with no verbs
// sre: does a cart missing its "done" sentence ever load, so nothing could ever say it finished?
test('tier, does and done are required as written; no agent at all is a watch cart that holds no verb', () => {
  assert.throws(() => readCart(CART().replace('(tier . watch)', '(tier . root)')), /the cart probe's tier is watch or act, not root/)
  assert.throws(() => readCart(CART().replace('(does . "reads one thing")', '(does . "  ")')), /the cart probe says what it does: \(does \. "…"\)/)
  assert.throws(() => readCart(CART().replace('(done . "one pass")', '(done . 5)')), /says what it is done at: \(done \. "…"\)/)
  const h = readCart(`(lacuna-cart 'bare '((does . "d") (done . "e")))`)
  assert.deepEqual([h.tier, h.verbs, h.restart, h.minds, h.judgment], ['watch', [], 'permanent', {}, []])
  assert.equal(readCart(CART().replace('(tier . watch)', '(tier . act)')).restart, 'transient', 'an act cart restarts transient by default')
})

// spec: design §12.1 ("Judgment is an alist; a bare name defaults to ask-owner") · F-09 · law 4 (the 26B decides only at header points)
// class: F-09 the judgment fallback · J13 a fallback unset
// technique: state-machine walk over the three shapes a judgment point is written in, and the refusal without need-brain
// method: readCart; read judgment and judgmentFallback; a judgment with no need-brain verb is one sentence
// sre: when the brain is down, does every judgment point in every cart have a written answer for what happens instead?
test('judgment reads (point . fallback), (point) and point alike; a bare point is ask-owner; points without need-brain are refused', () => {
  const h = readCart(CART('(judgment . ((stale . stop) (fresh) odd))', 'on need-brain'))
  assert.deepEqual(h.judgmentFallback, { stale: 'stop', fresh: 'ask-owner', odd: 'ask-owner' })
  assert.deepEqual(h.judgment, ['stale', 'fresh', 'odd'])
  assert.throws(() => readCart(CART('(judgment . (stale))')), /the cart probe names judgment points but its verbs do not hold need-brain/)
  assert.deepEqual(readCart(CART('(judgment . ())', 'on')).judgment, [])
})

// spec: design §12.1 (minds by job class; the four 1.3 classes and condense yes-no pick nearness) · §10 (the box's list)
// class: J7 shapes of input (a mind written with one field, with none, as a bare word) · F-02 (a mind without the mind verb)
// technique: boundary over the shapes a (minds …) entry is written in
// method: readCart; read each mind's job, labels, untrusted, model and rungs; the refusals are one sentence each
// sre: is a correct one-line mind declaration read as written, or refused with a sentence that blames the wrong field?
test('a mind with one field reads as an alist of one, like inventory.mjs reads it; a mind with no class or no mind verb is refused', () => {
  const one = readCart(CART('(minds . ((l . ((job . command->verb)))))', 'on mind'), { box: BOX })
  assert.deepEqual([one.minds.l.job, one.minds.l.labels, one.minds.l.untrusted, one.minds.l.model], ['command->verb', [], false, 'functiongemma'])
  assert.deepEqual(one.minds.l.rungs, ['functiongemma', 'lacuna-worker-lite'])
  assert.throws(() => readCart(CART('(minds . ((l . signal->label)))', 'on mind')), /mind 'l has no job class we bench — use one of command->verb, signal->label/)
  assert.throws(() => readCart(CART('(minds . ((l)))', 'on mind')), /mind 'l has no job class/)
  assert.throws(() => readCart(CART('(minds . ((l . ((job . yes-no)))))', 'on report')), /declares minds but its verbs do not hold mind/)
  assert.deepEqual(readCart(CART('(minds . (loose))', 'on')).minds, {}, 'a bare word under minds is no mind')
})

// spec: design §6 change 5 (restart types; intensity 3/300) · §12.1 (author claude|26b|owner; deadlines in seconds) · §8 (contract)
// class: B7 a bound at its edge (intensity N SECONDS, both > 0; a deadline 0, negative, text) · J13 a field unset or wrong-typed
// technique: boundary — each 3.0 field at, under and beside its rule
// method: readCart each; read the value or the sentence
// sre: can a header set an intensity of 0 crashes, or a deadline of -1 s, and turn the restart rule off for a cart?
test('restart, author, intensity, deadlines and contract read as written or refuse with the rule in the sentence', () => {
  assert.throws(() => readCart(CART('(intensity . 5)')), /intensity is \(intensity N SECONDS\), e\.g\. \(intensity 3 300\)/)
  assert.throws(() => readCart(CART('(intensity . (3 0))')), /intensity/)
  assert.throws(() => readCart(CART('(intensity . ("a" 300))')), /intensity/)
  assert.deepEqual(readCart(CART('(intensity . (1 1))')).intensity, [1, 1])
  assert.deepEqual(readCart(CART()).intensity, [3, 300])
  assert.notEqual(readCart(CART()).intensity, HEADER_3.intensity, 'a copy, never the frozen default itself')
  for (const v of ['-1', '"soon"']) assert.throws(() => readCart(CART(`(deadlines . ((hand . ${v})))`)), /deadline for hand is seconds > 0/)
  assert.deepEqual(readCart(CART('(contract . ((goal . 7)))')).contract, { goal: '7', done_check: null })
  assert.deepEqual(readCart(CART('(contract . open)')).contract, { goal: null, done_check: null }, 'a word is an empty contract: the run\'s goal falls to does')
  assert.equal(readCart(CART()).contract, null)
  assert.equal(readCart(CART('(author . owner) (restart . temporary)')).author, 'owner')
  assert.throws(() => readCart(CART('(restart . always)')), /the cart probe's restart is one of permanent transient temporary, not always/)
  assert.throws(() => readCart(CART('(author . gemini)')), /the cart probe's author is one of claude 26b owner, not gemini/)
  const h = readCart(CART('(version . 3) (foreman . studio) (exam . E-1) (shadow . #t) (touches . (a b c d e f g h i j k l m n)) (states . (serving draft))'))
  assert.deepEqual([h.version, h.foreman, h.exam, h.shadow, h.touches.length, h.states], ['3', 'studio', 'E-1', true, 12, ['serving', 'draft']])
})

// spec: design §12.1 (acts: the only acts a cart may do) · §11 (an act cart is tier act) · law 4 (acts are press-gated)
// class: L3 an act without a press (a watch cart that names an act) · F-02
// technique: boundary — acts named on a watch cart; acts named without the act verb
// method: readCart; read the sentence
// sre: can a watch-tier cart (one that only reads) carry an act in its header and get it pressed later by mistake?
test('a cart that names acts must hold the act verb and be tier act; each refusal says which', () => {
  assert.throws(() => readCart(CART('(acts . (pass))', 'on act')), /may not have act|names acts, so its tier is act/)
  assert.throws(() => readCart(CART('(acts . (pass))', 'on').replace('(tier . watch)', '(tier . act)')), /names acts but its verbs do not hold act/)
  assert.deepEqual(readCart(CART('(acts . (pass))', 'on act').replace('(tier . watch)', '(tier . act)')).acts, ['pass'])
})

// spec: design §12.1 (the body calls only the header's verbs; need-brain at a judgment point) · cart.mjs checkBody · F-02 · F-07
// class: F-07 strict fails the same way after 3 rounds (the refusal is deterministic: one sentence, sorted, the same each time)
// technique: repeated read — three rounds of the same refused body; then one change at a time
// method: readCart three times; assert three identical sentences naming the verbs in order; add one verb, read the next sentence
// sre: when the 26B loops on a repair, does it get the same exact sentence each round, naming the one thing to change?
test('F-07: a body outside its header gets the same sentence every round, verbs sorted; fixing one names the next', () => {
  const body = "(on 'x (lambda (v) (remember 'a v) (hand 'disk) (spawn 'k \"(on 'y (lambda (z) z))\")))"
  const rounds = [1, 2, 3].map(() => { try { readCart(CART('', 'on', body)); return null } catch (e) { return e.message } })
  assert.equal(new Set(rounds).size, 1)
  assert.equal(rounds[0], 'the cart probe calls (hand …), (remember …), (spawn …) but its header does not hold them — add to (agent (verbs …)) or take the call out')
  assert.throws(() => readCart(CART('', 'on hand remember', body)), /calls \(spawn …\) but its header does not hold it —/)
})

// spec: cart.mjs checkBody ("one handler per kind"; "a cart has one header") · design §12.1 · §7 (quoted forms are data)
// class: E1 a handler replaced silently (the second (on 'k …) wins) · W5 a nested form as body data (a quoted header is data)
// technique: state-machine walk — two handlers for one kind (as a symbol and as a string), a second header, quoted and
//            quasiquoted calls, an empty form, a mind-job naming an undeclared job, need-brain without a quoted topic
// method: readCart each body; read the sentence or the header
// sre: can a generated cart drop its first handler without a word, or hide a second header in its body?
test('one handler per kind, one header, quoted forms are data, need-brain names a declared point, mind-job a declared mind', () => {
  assert.throws(() => readCart(CART('', 'on', "(on 'x (lambda (v) v))\n(on \"x\" (lambda (v) v))")), /has 2 handlers for 'x — the last replaces the others/)
  assert.throws(() => readCart(CART('', 'on', "(define (f) (lacuna-cart 'y '()))")), /a cart has one header, and it is the first form/)
  assert.equal(readCart(CART('', 'on', "(define data '(hand 'disk))\n(define q `(act 'pass))\n()")).name, 'probe')
  assert.throws(() => readCart(CART('(judgment . (stale))', 'on need-brain', "(on 'x (lambda (v) (need-brain v \"q\")))")), /without naming a judgment point — write \(need-brain 'stale/)
  assert.throws(() => readCart(CART('', 'on need-brain', "(on 'x (lambda (v) (need-brain 'stale \"q\")))")), /about 'stale, which is not among its judgment points \(none\)/)
  assert.throws(() => readCart(CART('(minds . ((l . ((job . pick)))))', 'on mind mind-job', "(mind-job 'other '(:needs (x)))")), /declares the mind job 'other that its header does not name/)
  assert.equal(readCart(CART('(minds . ((l . ((job . pick)))))', 'on mind mind-job', '(mind-job "l" \'(:needs (x)))')).minds.l.job, 'pick', 'a job named by a string is not checked by name here')
})

// spec: design §12.1 (sentry: none, signal names, or a plan alist) · ch. 5 §5.2.1
// class: J7 shapes of input (one bare word, a list of words, an alist, nothing)
// technique: boundary over the four ways a sentry field is written
// method: readCart; read sentry
// sre: does the sentry-watch cart's plan survive being written as one word instead of a list?
test('sentry reads a bare word as one signal, a list as signals, an alist as a plan, and absence as none', () => {
  assert.deepEqual(readCart(CART('(sentry . error)')).sentry, ['error'])
  assert.deepEqual(readCart(CART('(sentry . (error (warning fatal)))')).sentry, ['error', 'warning', 'fatal'])
  assert.deepEqual(readCart(CART('(sentry . ((cart . sentry-watch) (watch . (log)) (gates log fs)))')).sentry, { cart: 'sentry-watch', watch: 'log', gates: ['log', 'fs'] })
  assert.deepEqual(readCart(CART()).sentry, [])
})

