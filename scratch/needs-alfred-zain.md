# needs-alfred — Zain (book-claim repair, book-of-challenges)

## non-deterministic

### ch09-memory-and-cortex.book.slatl — scheme-block-18 `enqueue-task`

**Left alone. Not repaired.** Its value changes between two identical runs, so
there is no value I can splice honestly.

- CODE: `(enqueue-task "send-email" "alice@example.com")`
- CLAIM (in book): `"task-f47ac10b-58cc-4372-a567-0e02b2c3d479"`
- RUN 1: `"uuid-1785832504646-2"`
- RUN 2: `"uuid-1785832508339-2"`

**Cause.** The chapter's own stub embeds the wall clock:

```scheme
(define _ch9-uuid-counter 0)
(define (system/uuid)
  (set! _ch9-uuid-counter (+ _ch9-uuid-counter 1))
  (string-append "uuid-" (number->string (time/now)) "-" (number->string _ch9-uuid-counter)))
```

`(time/now)` is milliseconds since epoch, so the middle field is different on
every run. The trailing counter IS stable (`-2` both runs); only the timestamp
moves.

**Options for Alfred (I did not pick one):**
1. Make the stub deterministic — drop `(time/now)`, keep the counter, so IDs are
   `"uuid-1"`, `"uuid-2"`, … Then the block becomes checkable and the claim can
   be spliced. Changes chapter code, not just a claim.
2. Teach the gate an "unstable-value" annotation so a block can declare that its
   value is not reproducible and be excluded from value matching.
3. Leave as-is and accept one permanent mismatch in this chapter.

Note the same `system/uuid` also feeds Program 15's `decision:` keys, which is
why Program 25 (`decay-scores`) can never find `decision:d-101` — that is a
separate, deterministic finding and is explained in the book text now.

## engine bugs found and not fixed

None. Every mismatch across my eight files traced to a stale claim (shape a) or
a wrong call (shape b). No silent-wrong engine values were found.
