---
source-slat: PERF-COMPOSER-V11.ENG.slat
generated: do not hand-edit — rendered from SLAT
---

- `:doc`
- PERF-COMPOSER-V11
- `:audience`
- engineering
- `:dialect`
- motoi
- `:provenance`
- zane #3 perf + memory hunt, 2026-07-17
- `:training-eligible`
- false
- `:confidentiality`
- internal
- `:status`
- measured
- `:method`
- process.hrtime.bigint() + process.memoryUsage(); node v22+; MacBook darwin arm64; runs 1x each unless noted

- `:section`

- measurements

- `:table`

- - **scenario:** emit(canvas N sliders) — **N:** 1 — **time-ms:** 0.126
- **scenario:** apply(canvas N sliders) — **N:** 1 — **time-ms:** 0.138
- **scenario:** emit(canvas N sliders) — **N:** 10 — **time-ms:** 0.014
- **scenario:** apply(canvas N sliders) — **N:** 10 — **time-ms:** 0.033
- **scenario:** emit(canvas N sliders) — **N:** 100 — **time-ms:** 0.081
- **scenario:** apply(canvas N sliders) — **N:** 100 — **time-ms:** 0.119
- **scenario:** emit(canvas N sliders) — **N:** 1000 — **time-ms:** 0.307
- **scenario:** apply(canvas N sliders) — **N:** 1000 — **time-ms:** 0.556
- **scenario:** emit(canvas N sliders) — **N:** 10000 — **time-ms:** 1.876
- **scenario:** apply(canvas N sliders) — **N:** 10000 — **time-ms:** 4.26
- **scenario:** emit(canvas N sliders) — **N:** 50000 — **time-ms:** 5.85 — **extra:** linear ~117ns/widget
- **scenario:** apply(canvas N sliders) — **N:** 50000 — **time-ms:** 19.61
- **scenario:** emit(piano-roll 12000 notes) — **N:** 12000 — **time-ms:** 0.021 — **extra:** CORRECTNESS BUG: emit walks DECLARATION only, does NOT include notes; time is O(1) in notes
- **scenario:** apply(piano-roll 12000 notes) — **N:** 12000 — **time-ms:** 0.038 — **extra:** same bug — apply cannot restore notes
- **scenario:** emit(sprite-grid 64x64) — **N:** 4096 — **time-ms:** 0.011 — **extra:** same bug — pixel array not emitted
- **scenario:** apply(sprite-grid 64x64) — **N:** 4096 — **time-ms:** 0.016 — **extra:** same bug — pixels not restored
- **scenario:** emit(tile-map 128x128x3) — **N:** 49152 — **time-ms:** 0.023 — **extra:** same bug — cells not emitted
- **scenario:** apply(tile-map 128x128x3) — **N:** 49152 — **time-ms:** 0.03 — **extra:** same bug — cells not restored
- **scenario:** timelinePlace 500 keyframes (sort each add) — **N:** 500 — **time-ms:** 0.792
- **scenario:** emit(timeline 500 keyframes) — **N:** 500 — **time-ms:** 0.017 — **extra:** declaration only — frames not emitted
- **scenario:** apply(timeline 500 keyframes) — **N:** 500 — **time-ms:** 0.021 — **extra:** frames not restored
- **scenario:** timelinePlace N reverse-order — **N:** 500 — **time-ms:** 1.63 — **extra:** per-op 3.27μs
- **scenario:** timelinePlace N reverse-order — **N:** 1000 — **time-ms:** 5.32 — **extra:** per-op 5.32μs
- **scenario:** timelinePlace N reverse-order — **N:** 2000 — **time-ms:** 21.65 — **extra:** per-op 10.82μs — 2x N = ~4x time = O(N^2)
- **scenario:** timelinePlace N reverse-order — **N:** 5000 — **time-ms:** 129.57 — **extra:** per-op 25.9μs
- **scenario:** timelinePlace N reverse-order — **N:** 8000 — **time-ms:** 328.99 — **extra:** per-op 41.1μs — CONFIRMED O(N^2)
- **scenario:** timelinePlace N random-order — **N:** 8000 — **time-ms:** 328.39 — **extra:** sort() dominates regardless of order
- **scenario:** renderCanvasToTUI large canvas — **N:** 2276 — **time-ms:** 0.603 — **extra:** output=7363B; 100 sliders + 32x32 sprite + 128-step piano-roll + 32x32 tilemap
- **scenario:** voice/mix ×100000 with 15 voices — **N:** 15 — **time-ms:** 8.694 — **extra:** per-call ~87ns; O(N) as expected
- **scenario:** voicePoolSetMix ×100000 with 15 voices — **N:** 15 — **time-ms:** 30.31 — **extra:** Set-based dedup, O(N)
- **scenario:** voice/mix with 100000 user-supplied IDs — **N:** 100000 — **time-ms:** 0.581 — **extra:** DoS SHAPE: record.voices.length=100000 — NO cap on input length
- **scenario:** voice/mix with 1_000_000 user-supplied IDs — **N:** 1000000 — **time-ms:** 20.63 — **extra:** DoS SHAPE: record.voices.length=1000000 — unbounded allocation from Scheme args
- **scenario:** voicePoolSetMix with 100000 IDs — **N:** 100000 — **time-ms:** 0.46 — **extra:** correctly caps mixer at 15 slots (via id-range check)
- **scenario:** voicePoolSetMix with 1_000_000 IDs — **N:** 1000000 — **time-ms:** 13.55 — **extra:** still walks all 1M inputs though final output capped at 15
- **scenario:** http GET /play/demo ×100 — **N:** 100 — **time-ms:** 17.027 — **extra:** p50=0.165 p95=0.220 p99=0.288 ms; throughput 5873 req/s (loopback)
- **scenario:** http heap delta over 100 warmup req — **N:** 100 — **time-ms:** 0 — **extra:** heapUsed Δ=+4965KB (JIT + first-time allocations; not a leak)
- **scenario:** http 1000 req memory delta post-warmup (--expose-gc) — **N:** 1000 — **time-ms:** 0 — **extra:** heapUsed Δ=+582KB, rss Δ=+6800KB after two forced GCs — no clear leak
- **scenario:** http GET /play/<10000-char cart name> — **N:** 10000 — **time-ms:** 0.505 — **extra:** returns 403 fast (regex + length gate); safe against long-name amplification

- `:section`
- round-trip-correctness-audit
- `:prose`
- The composer.js module docstring claims: `(composer/apply c (composer/emit c)) ≡ c`. That claim is FALSE for every stateful widget. `emitCanvas` emits per-child `emitWidgetDeclaration` forms, which serialize opts.* but NOT state.notes / state.pixels / state.cells / state.frames / state.chain. Direct test (scratch/_zane3_roundtrip_check.mjs): piano-roll 3 notes → 0 notes after round-trip; sprite-grid painted pixel → 0 after round-trip; tile-map 2 cells → 0 cells after round-trip. Round-trip only works for scalar-state widgets (slider, toggle, text-field, color-picker, adsr).

- `:section`

- findings

- `:perf-o-n2`

- - **site:** lib/composer/composer.js timelinePlace — **cause:** state.frames[key].sort() called after EVERY push — sort is O(N log N) per insert → O(N^2 log N) total; observed as clean O(N^2) at N up to 8000 — **severity:** medium — **impact:** 500 keyframes = 1ms; 8000 keyframes = 330ms; a kid animating a 60fps 60-sec timeline = 3600 keyframes per entity = >100ms per new keyframe insertion at the top of the range — **fix:** insertion-sort into pre-sorted list (binary search + splice) OR sort lazily at emit-time only

- `:dos-shapes`

- - **site:** lib/composer/composer-v11.js makeMixRecord (verbs voice/mix + voice/compose) — **cause:** no cap on voiceIds length; the id-range filter (1..15) preserves duplicates and does not bound total output length. record.voices holds every accepted id — **severity:** medium — **impact:** a Scheme program calling (voice/mix (iota 1000000 1)) allocates a 1M-element JS array in the returned record — unbounded allocation from user input — **fix:** cap voices to 15 with a Set (mirror voicePoolSetMix), or explicitly reject oversized input

- `:memory-leaks`

- - **site:** lib/net/http-serve.js — **cause:** none observed; 1000 requests post-warmup with forced GC → +582KB heap, +6.8MB rss which flattens; no unbounded caches or global maps besides _servers (bounded by http/stop) — **severity:** none

- `:correctness-bugs`

- - **site:** lib/composer/composer.js emitCanvas + applyForm — **cause:** emitCanvas emits widget-declaration forms (opts only) but the round-trip claim needs widget-target forms (state) too — piano-roll notes / sprite pixels / tile cells / timeline frames / fx-chain / instrument-picker choice / live-code source are all dropped on emit — **severity:** HIGH — **impact:** composer/save + composer/load loses all authored content for these widgets; the invariant asserted at composer.js:6-9 is broken — **fix:** either (a) emitCanvas also emits per-child state as a `(:state ...)` clause and applyForm reads it, or (b) rewrite the doctrine to say `(composer/apply c (composer/emit c)) ≡ scalar-fields-of c`; option (a) is what tests likely need

- `:section`
- sanity
- `:canvas-emit-scaling`
- emit(N sliders): 1000→0.31ms, 10000→1.88ms, 50000→5.85ms — clean O(N)
- `:canvas-apply-scaling`
- apply(N sliders): 1000→0.56ms, 10000→4.26ms, 50000→19.6ms — clean O(N), ~4x slower than emit
- `:tui-render`
- large mixed canvas renders in 0.6ms → OK for interactive
- `:http-serve`
- p50 165μs, p95 220μs, p99 288μs on loopback; no leak
- `:voice-mix-fast-path`
- with capped 15 voices → ~87ns/call — allocation is O(N) in the input length not the output
- `:process`
- Node v22 on darwin arm64; runs are single-shot except voice/mix which averaged 100k iters
