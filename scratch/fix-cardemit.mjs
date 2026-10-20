import { readFileSync, writeFileSync } from 'node:fs'
const FILE='scheme/reference/01-core.slat'
const enc = s => s.replace(/\\/g,'\\\\').replace(/"/g,'\\"').replace(/\n/g,'\\n')
// [decoded-old, decoded-new] pairs. Each must match exactly once (as raw-encoded).
const P = [
  // slot [0]
  [`(define was-playing #f)
(on-frame
  (lambda ()
    (let ((now (audio-playing?)))
      (when (and now (not was-playing)) (card-emit 'audio-started '()))
      (when (and (not now) was-playing) (card-emit 'audio-stopped '()))
      (set! was-playing now))))`,
   `(define was-playing #f)
(define (emit tag data) (list tag data))
(on-frame
  (lambda ()
    (let ((now (audio-playing?)))
      (when (and now (not was-playing)) (emit 'audio-started '()))
      (when (and (not now) was-playing) (emit 'audio-stopped '()))
      (set! was-playing now))))`],
  // slot [1]
  [`(cue-at-time 2.5 (lambda () (card-emit (card-list) 'beat)))`,
   `(define (emit tag data) (list tag data))
(cue-at-time 2.5 (lambda () (emit 'beat 'all)))`],
  // slot [2]
  [`            (card-emit 'section (cdr c))`,
   `            (emit 'section (cdr c))`],
  // slot [2] prepend emit define
  [`(define cues '((0 . intro) (8 . verse) (24 . chorus) (40 . outro)))
(define fired '())`,
   `(define cues '((0 . intro) (8 . verse) (24 . chorus) (40 . outro)))
(define fired '())
(define (emit tag data) (list tag data))`],
  // slot [4]
  [`           (card-emit 'telemetry (list 'gen gen 'live live)))`,
   `           (emit 'telemetry (list 'gen gen 'live live)))`],
  // slot [4] prepend emit define
  [`(define (evolve ctx)
  (grid-step conway-rule)`,
   `(define (emit tag data) (list tag data))
(define (evolve ctx)
  (grid-step conway-rule)`],
]
let buf = readFileSync(FILE,'utf8')
let ok=true
for(const [o,n] of P){
  const eo=enc(o), en=enc(n)
  const count = buf.split(eo).length-1
  if(count!==1){ console.log(`MISMATCH count=${count} for:\n${o.slice(0,60)}...`); ok=false; continue }
  buf = buf.replace(eo,en)
}
if(!ok){ console.log('ABORT — not written'); process.exit(1) }
writeFileSync(FILE,buf)
console.log(`applied ${P.length}/${P.length} — written`)
