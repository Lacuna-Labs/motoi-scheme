# Book of Motoi — verified require-recipes (working area)

Every fenced program must pass `echo '<prog>' | ./bin/motoi run /dev/stdin`.
Console verbs are LAZY — `(require 'lib)` first. Recipe per chapter:

| Ch | Subsystem | require | star verbs |
|----|-----------|---------|------------|
| 2 The REPL | (none — base lang) | — | define, lambda, map, cond, let |
| 3 The Screen | `graphics/framebuffer` | fb/pixel, fb/rect, fb/text, fb/dump |
| 4 The Sprite | `graphics/sprite` | sprite/define, sprite/rasterize, sprite/address, sprite/landmarks |
| 5 The Tick | `game/scheduler` | on-tick, after, wait, tempo, beat/on |
| 6 The Buttons | (input lib — TBD) | |
| 7 Motion | `graphics/animation` | motion/move-to, animation/tick, animation/tweens, easing/standard |
| 8 Sound | `audio/synth` | synth/808, synth/orchestra, synth/load-score (kit-based) |
| 9 The Beat | `game/scheduler` + `audio/tick` | tempo, beat/on, at-beat |
| 10 Animation | `graphics/animation` | animation/clear!, animation/tick, motion/on-settle, easing/spring |
| 11 Collision | `game/world` | on-collision, entity/*, world/step |
| 12 The Scene | `game/grid` | grid/dot, grid/clear, tilemap/set! |

vec/* (graphics/vec): vec/make vec/add vec/sub vec/scale vec/lerp vec/normalize vec/distance vec/dot
geom/* (graphics/geom): geom/point geom/distance geom/circle geom/triangle-area etc.

CONFIRMED loadable: graphics/framebuffer, graphics/sprite, graphics/animation,
graphics/text, game/scheduler, game/world, audio/synth, audio/tick, animation, text.
