// actors/mind-pose.js — THE MINDS' POSE (lane F5-BC; A3 §4.1's pose table, §9: "if it passes 300, split actors/mind-pose.js";
// RULINGS C-39, C-40, M-21). Owns: a mind's pose in closed form per state: the resident swell per fresh health answer, the
// loading band, the float `max(4 s, 3.5 s × mT)`, the thinking comet at `log₂(1 + tps)` capped at 0.6 loops/s and still at
// tok/s 0, the answering base glow from the smoothed tok/s, the press edge, the frozen channels and amber elapsed ring of a
// stall, the hold-close-desaturate-lights-out of a failure, the one red flash of a refusal, the sit of an engine down, the
// lights-out-afterglow-sink of an eviction, the pass lift (the only overshoot), the half-saturation freeze of unknown, and
// the amber boundary of the `warned` flag. actors/mind.js owns the record and the statechart and re-exports this pose.
// Refuses: a clock, a frame count, green except the pass seal, overshoot except the pass, motion while stalled or unknown.
// Implements: A3 §4.1 pose rows. Invariants (design §18): "stalled and unknown have zero internal motion". Faults (§16): none.

import { blankPose, CH, FLAG } from '../keyframe.js'
import { enter, exit, rc, blink, smoothed, clamp01 } from '../curves.js'
import { HUE, riseFactor, floatPeriod } from '../vocabulary.js'

/** Resting height off the floor (floorBodies.js:148, kept). */
export const H0 = 2.6

/** The smoothed tok/s at `logT` from the last two samples (half-life 300 ms, A3 §4.1 answering row). */
export const smoothedTps = (rec, logT) => (rec.tpsSample ? smoothed(rec.tpsSample.tps0, rec.tpsSample.tps1, rec.tpsSample.t1, 0.3, logT) : 0)

/** The pose at `logT` (A3 §4.1's pose table), sixteen channels in keyframe.js's order. */
export function pose(rec, logT) {
  const p = blankPose()
  const st = rec.state ?? 'dark'
  const frozenAt = st === 'stalled' || st === 'unknown' ? rec.since : null
  const dt = Math.max(0, logT - (rec.since ?? logT))
  const tm = frozenAt ?? logT
  const mR = riseFactor(rec.m)
  const float = 0.005 * Math.sin((2 * Math.PI * (tm - (rec.turn?.startT ?? 0))) / floatPeriod(rec.m))
  p[CH.x] = rec.pos.x
  p[CH.z] = rec.pos.z
  p[CH.y] = H0
  p[CH.edgeHue] = HUE['N-STEEL']
  p[CH.hue] = HUE['N-ICE']
  if (rec.warned) {
    const dw = logT - (rec.warn.since ?? logT)
    p[CH.edgeHue] = HUE.AMBER
    p[CH.blink] = dw < 5 && rec.ackT == null ? 0.4 + 0.6 * blink(0.6, dw) : 0.9 + 0.1 * rc(0.2 * logT)
    p[CH.flags] |= FLAG.amber
  }
  switch (st) {
    case 'dark': p[CH.y] = 0; p[CH.l] = 0.12; p[CH.edge] = 0.25; p[CH.flags] |= FLAG.dashed; break
    case 'loading': p[CH.y] = 0; p[CH.scale] = 0.92; p[CH.l] = 0.6; p[CH.fill] = rec.engineSlot.prefill ?? ((dt / 1.2) % 1); p[CH.motion] = (dt / 1.2) % 1; break
    case 'resident': {
      const dh = logT - (rec.health.at ?? -1e9)
      const swell = dh < 1.2 * rec.m ? enter(dh / (1.2 * rec.m)) : dh < 3 * rec.m ? 1 - exit((dh - 1.2 * rec.m) / (1.8 * rec.m)) : 0
      p[CH.l] = 1 + 0.05 * swell
      break
    }
    case 'busy.reading':
      p[CH.y] = H0 * 1.02 + float * 4
      p[CH.fill] = rec.engineSlot.prefill ?? ((tm / 1.2) % 1)
      p[CH.l] = 1.2
      if (rec.cause) { p[CH.edgeHue] = HUE.AMBER; p[CH.flags] |= FLAG.amber }
      break
    case 'busy.thinking':
    case 'busy.condensing': {
      const tps = rec.turn?.tps ?? rec.engineSlot.tps ?? 0
      const rate = Math.min(0.6 * 2 * rec.m, Math.log2(1 + tps))
      p[CH.y] = H0 * 1.02 + float * 4
      p[CH.motion] = tps > 0 ? ((tm / (2 * rec.m)) * rate) % 1 : 0
      if (st === 'busy.condensing') p[CH.scale] = 1 - 0.02 * rc(dt / (2 * rec.m))
      break
    }
    case 'busy.answering': p[CH.y] = H0 * 1.02 + float * 4; p[CH.l] = 1.1 + 0.3 * clamp01(rec.tpsMax > 0 ? smoothedTps(rec, logT) / rec.tpsMax : 0); break
    case 'busy.calling': p[CH.y] = H0 * 1.02; break
    case 'waiting.queued':
    case 'waiting.starved': p[CH.l] = 0.7 + 0.05 * rc(0.25 * dt); p[CH.hollow] = st === 'waiting.queued' ? 1 : 0; break
    case 'waiting.press': p[CH.blink] = rec.pressYields ? 1 : blink(0.5, dt); p[CH.edgeHue] = p[CH.blink] ? HUE.AMBER : HUE['N-DARK']; p[CH.flags] |= FLAG.press; break
    case 'waiting.backpressure': p[CH.y] = H0 * 1.02; break
    case 'stalled': {
      p[CH.y] = H0 * 1.02
      p[CH.flags] |= FLAG.frozen | FLAG.amber
      p[CH.x] += dt < 0.06 || (dt >= 0.12 && dt < 0.18) ? 0.015 : 0
      p[CH.blink] = rc(0.5 * dt)
      p[CH.fill] = clamp01((logT - (rec.lastProgressT ?? rec.since)) / Math.max(1, 3 * (rec.p99Gap == null ? 10 : Math.max(10, 3 * rec.p99Gap))))
      p[CH.edgeHue] = HUE.AMBER
      break
    }
    case 'failed': {
      const past = dt - 0.15
      p[CH.y] = H0 * 1.02
      p[CH.sat] = past <= 0 ? 1 : 1 - 0.8 * exit(clamp01(past / 0.4))
      p[CH.l] = past <= 0 ? 1 : 1 - 0.6 * exit(clamp01(past / 0.4))
      p[CH.edgeHue] = HUE.RED
      p[CH.flags] |= FLAG.red
      p[CH.blink] = past < 0.24 ? clamp01(past / 0.24) : dt < 0.39 + 2 ? blink(1.5, dt - 0.39) : 1
      p[CH.fill] = clamp01(past / (0.02 * Math.max(1, rec.layers)))
      if (rec.ackT != null) p[CH.l] *= 1 - clamp01((logT - rec.ackT) / 2)
      break
    }
    case 'refused': p[CH.y] = 0; p[CH.l] = 0.12; p[CH.edge] = 0.25; p[CH.flags] |= FLAG.dashed; if (dt < 0.24) { p[CH.edgeHue] = HUE.RED; p[CH.blink] = 1 } break
    case 'engine-down': p[CH.y] = H0 * (1 - exit(clamp01(dt / (1.1 * mR)))); p[CH.l] = 0.15; p[CH.edge] = 0.5; p[CH.edgeHue] = HUE.RED; p[CH.flags] |= FLAG.dashed | FLAG.red; break
    case 'evicted': {
      const out = 0.03 * Math.max(1, rec.layers)
      p[CH.fill] = clamp01(dt / out)
      p[CH.y] = H0 - (H0 + rec.layers * 0.95 + 1.5) * exit(clamp01((dt - out) / (1.1 * mR)))
      p[CH.l] = dt < out ? 1 : Math.pow(2, -(dt - out) / 0.25)
      break
    }
    case 'passing': { const k = clamp01(dt / 0.5); p[CH.y] = H0 * (1 + 0.03 * (1 - Math.exp(-6 * k) * Math.cos(2 * Math.PI * 1.2 * k))); p[CH.ring] = 1 + 0.15 * enter(k); p[CH.hue] = HUE.GREEN; break }
    case 'unknown': p[CH.sat] = 0.5; p[CH.edge] = 0.25; p[CH.flags] |= FLAG.frozen; break
    default: break
  }
  if (rec.kvFill >= 0.9 && rec.loaded) p[CH.flags] |= FLAG.red
  if (frozenAt != null) p[CH.motion] = 0
  return p
}
