// seed.js — THE SEED (lane F5-BC; THE-FLOOR-5.0 law 2; A3 §2 `seed`, §10.3; A6 §14 item 2). Owns: FNV-1a 32 over an id (kept
// from life.js:11-13, the one seed the floor had), the PCG hash of JCGT 2020 that lane D runs again in GLSL ES 3.00 so the
// GPU draws the same numbers (A6 §14), the actor seed `seedOf(id, slot) = pcg(fnv1a(id) ^ slot)`, and the k-th unit draw in
// closed form (no stream to advance: the same number for the same k at any frame). Refuses: `Math.random` (law 2), a
// `fract(sin(…))` hash (it differs by GPU, A6 §14), any state. Implements: master law 2; A3 §2, §8; A6 §14.
// Invariants (design §18): "every pose is a closed-form function of a record and logT" (a draw is a pure function of
// seed and k). Faults (§16): none.

/**
 * FNV-1a, 32-bit, over the UTF-16 code units of `id` (life.js:11-13).
 * @param {string} id
 * @return {number} uint32
 */
export function fnv1a(id) {
  let h = 2166136261
  for (const ch of String(id)) {
    h ^= ch.charCodeAt(0)
    h = Math.imul(h, 16777619) >>> 0
  }
  return h >>> 0
}

/**
 * The PCG hash (JCGT 2020; A6 §14): `state = v × 747796405 + 2891336453; word = ((state >> ((state >> 28) + 4)) ^ state) ×
 * 277803737; return (word >> 22) ^ word`, every step mod 2^32 as the GPU does it.
 * @param {number} v uint32
 * @return {number} uint32
 */
export function pcg(v) {
  const state = (Math.imul(v >>> 0, 747796405) + 2891336453) >>> 0
  const word = Math.imul(((state >>> ((state >>> 28) + 4)) ^ state) >>> 0, 277803737) >>> 0
  return ((word >>> 22) ^ word) >>> 0
}

/**
 * An actor's seed: `pcg(fnv1a(id) ^ slot)` (A6 §14 item 2); `slot` tells one voxel or draw from another.
 * @param {string} id
 * @param {number=} slot
 * @return {number} uint32
 */
export const seedOf = (id, slot = 0) => pcg((fnv1a(id) ^ (slot >>> 0)) >>> 0)

/**
 * The k-th unit draw of a seed in [0, 1), in closed form: `pcg(seed + k × 0x9E3779B9) / 2^32` (A3 §2 `seed.u(k)`).
 * @param {number} seed uint32
 * @param {number=} k
 * @return {number}
 */
export const draw = (seed, k = 0) => pcg((seed + Math.imul(k | 0, 0x9e3779b9)) >>> 0) / 4294967296
