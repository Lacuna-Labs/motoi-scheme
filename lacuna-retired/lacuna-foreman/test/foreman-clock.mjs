// foreman-clock.mjs — U3'S TIME TRAVEL FOR A SCRATCH FOREMAN (a preload, `--import` through NODE_OPTIONS). Owns: the
// environment's clock in the child, never the module: `setTimeout`/`setInterval` delays of 1 s or more are multiplied by
// U3_CLOCK_SCALE (0.01 makes the 30 s drain 300 ms and the 15 s judge 150 ms), and SIGUSR2 moves `Date.now` forward by
// U3_CLOCK_JUMP_S (default 61 s: past the 60 s calm, inside the 120 s envelope window). Refuses: changing any code of the
// foreman; shortening a delay under 1 s (the debounce and the probes keep their own clock). Implements: unit-test work
// order §5 (techniques: fake clock, time travel; J14 clock jumps). Invariants (§18): none. Faults (§16): none.
const scale = Number(process.env.U3_CLOCK_SCALE || 1)
const jumpS = Number(process.env.U3_CLOCK_JUMP_S || 61)
const fast = (ms) => (Number(ms) >= 1000 ? Math.max(1, Math.round(Number(ms) * scale)) : ms)
const st = globalThis.setTimeout, si = globalThis.setInterval
globalThis.setTimeout = (fn, ms, ...a) => st(fn, fast(ms), ...a)
globalThis.setInterval = (fn, ms, ...a) => si(fn, fast(ms), ...a)
let offset = 0
const realNow = Date.now
Date.now = () => realNow() + offset
process.on('SIGUSR2', () => { offset += jumpS * 1000; console.log(`clock jumped ${jumpS} s`) })
