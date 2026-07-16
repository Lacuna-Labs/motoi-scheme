---
slug: telemetry-median-1.0-eng
title: Median (Meridian) — Telemetry Engineering
category: engineering
canonical: true
version: 1.0
last-reviewed: 2026-07-11
covers-through: 2026-07-11
owner: Marcus (SRE)
codename: median
project: meridian
supersedes:
  - all-docs-lane-ac/canonical-drafts/LACUNA-TELEMETRY-1.0-ENGINEERING.md (older draft)
  - doc-expansion-staging/telemetry-gaps.md (FOLDED — §GAPS)
  - meridian/docs/lacuna-monitoring-l1-oracle-design-v0.1.md (L1 oracle design FOLDED — §ORACLE)
  - meridian/docs/deployment-sizing-v0.1.md (sizing FOLDED — §SIZING)
  - meridian/specs/probe-registry.md (probe registry FOLDED — §PROBES)
  - meridian/specs/alert-routing.md (alert routing FOLDED — §ALERTS)
  - meridian/specs/telemetry-schema.md (schema pointer)
theme: telemetry-median
codename-note: "Median" is the codename for this telemetry surface. "Meridian" is the project name on disk (~/code/meridian/). Alfred's directive per plan §8.2 Flag B.
---
# Median (Meridian) — Telemetry Engineering Manual
<!-- covers-through: 2026-07-11 (drift pass vs HEAD d4f5a8a4; Meridian project docs folded 2026-07-11) -->

> **Canonical engineering doc #8 of the sealed Sakura Scheme 1.0 doc-set.**
> Pairs with `docs/LACUNA-INTEGRATION-1.0-ENGINEERING.md` (the upstream
> wire-call manual this telemetry observes), `docs/LOAM-1.0-ENGINEERING.md`
> (the substrate where telemetry lands), and the rest of the sealed
> doc-set (HelloSurface, Scheme Engine, Scheme Reference, Automations,
> Training Manual, Sealing).
>
> **Audience.** SRE; any engineer adding instrumentation to a new
> capability; any auditor confirming the cost ledger + audit chain are
> honest; any operator who asks "is Lacuna healthy?" and expects a
> real answer.
>
> **Voice.** HelloSurface gold standard — dry, structured, data-rich,
> file:line-anchored. Instrumentation is the surface where honesty
> matters most: if telemetry lies, every downstream decision is wrong.
> This document names every signal we record, every place it lands,
> every place it is read, and — as importantly — every signal we
> deliberately do NOT record.
>
> **Author.** Alfred Robins / Claude Code (PM lane). 2026-06-30.

---

## TABLE OF CONTENTS

- [§0. Telemetry philosophy](#0-telemetry-philosophy)
- [§1. Cart lifecycle events](#1-cart-lifecycle-events)
- [§2. Cost ledger (per-vendor)](#2-cost-ledger-per-vendor)
- [§3. Per-operator usage tracking](#3-per-operator-usage-tracking)
- [§4. Wire-call observability](#4-wire-call-observability)
- [§5. Cortex write events](#5-cortex-write-events)
- [§6. Loam plane queries (cohort, world, system, public)](#6-loam-plane-queries)
- [§7. SRE dashboards at /systems/monitoring](#7-sre-dashboards-at-systemsmonitoring)
- [§8. Audit log spine](#8-audit-log-spine)
- [§9. What is NOT measured + why](#9-what-is-not-measured--why)
- [§10. LIVING:RESEARCH](#10-livingresearch)
- [§11. References](#11-references)

---

## §0. Telemetry philosophy

### §0.1 Five rules

Telemetry at Lacuna obeys five non-negotiable rules. Each rule is the
direct consequence of an architect commitment to the operators paying
for the product (`CLAUDE.md` "Honest nulls, no fluent-wrong" + the
2026-06-27 trust verbatim).

1. **Honest-null applies to metrics.** A counter that didn't fire is
   `0`, not "unavailable." A counter the host can't reach is
   `unavailable`, not `0`. The two are different. Never blur them.

2. **No fabricated numbers.** If a number is computed, it cites its
   inputs. If a number is sampled, it carries its sample window. If a
   number is estimated, the word "estimated" appears in the column
   header (`cost_ledger.py:436` `est = 0.05 if ...` is an *estimate*
   and surfaces as `estimated_cost_usd` in the response).

3. **Privacy-first.** Operator PII never lands in a telemetry row.
   The audit pipe (`preamble.py:257-278` `audit_line`) carries
   `trace_id` only — the verbatim comment from Zain (security): "this
   is what hits the log file. trace_id only — NEVER the full preamble
   (no PII bleed)."

4. **Vendor names land in ledger rows; never in operator-facing
   dashboards.** Per `cost_ledger.py:148-160` — the cost ledger
   stores literal upstream tags (`anthropic-realtime`,
   `gemini-batch`) for SRE drill-down; `rollup_for_tier` translates
   them into capability names (`reasoner-realtime`, `workhorse-batch`)
   before any operator-facing payload renders them. The leak-scan
   exclude path knows the difference (`cost_ledger.py:162-165`).

5. **Recursive observability.** Loam writes its own state into Loam.
   The substrate IS its own observability surface. No special admin
   backdoor. SRE asking "why did this read fail?" uses the same
   Shell, same cap-token, same audit log discipline as any cart
   (`docs/LOAM-1.0-ENGINEERING.md §21.1`).

### §0.2 Three observers

Telemetry serves three distinct readers. Each reader gets a different
projection of the same signal stream — never a separate stream:

| Reader | What they see | Surface |
|---|---|---|
| **SRE / Lacuna Engineering** | Raw per-vendor tags, raw per-shard latency, raw error class, raw upstream URL | `/systems/monitoring` dashboard + `/api/admin/cost/*` + `/api/sre/*` |
| **Sakura (the on-device savant + L1)** | Capability-tagged rollups, anomaly summaries, narration hooks. Vendor names FIREWALLED out. | `cart-status` thread bus events + Loam `SYSTEM/sakura-recs` |
| **Operator** | Cart-level performance receipts, per-tier budget status, per-vendor service health (UP / DEGRADED / DOWN with vendor identity scrubbed to "marketplace" or "model service") | Automations dossier + activity sheet + operator settings |

Every signal in this document carries a "who reads it" annotation.
Routing the same signal three ways without leaking SRE-level detail
to the operator (or operator PII into the SRE pipe) is the discipline.

### §0.3 What "instrumentation" means here

Three kinds of signal:

1. **Events.** A cart fires; a verb completes; an escalation surfaces.
   Append-only, sequence-numbered, timestamped. `cartBus.js` is the
   client-side event spine; `preamble.audit_line` is the server-side
   event spine. Both fan into the Loam SYSTEM plane.

2. **Counters.** A per-tier daily-cap budget; a hard-cap breach
   counter; a rolling-24h cost. Lock-protected, in-process; mirrored
   into Loam every wave. `cost_ledger.py:191-203` carries the
   canonical counter set.

3. **Health probes.** A vendor's `is_configured()` returns False —
   the wire-call surface for that vendor reports DEGRADED. A shard's
   replication lag exceeds threshold — the substrate reports
   DEGRADED-READ. Probes are pull-based (SRE asks); event + counter
   streams are push-based (the system tells SRE).

---

## §1. Cart lifecycle events

### §1.1 The cartBus event taxonomy

Source: `curator-web/src/scheme/cartBus.js:28-56`.

Every cart run emits a typed event stream. The same bus drives three
consumers (per `cartBus.js:1-22`):

- Live D3 visualisation (`CartFlowChart` subscribes, lights nodes)
- The recorder (writes events to a log buffer + exports JSON)
- The replayer (drives a fresh cart, intercepts `act` calls, returns
  the response from the log so the same sequence emerges)

Replay is the load-bearing feature — an operator's prod log replays
identically on the SRE laptop. That requires every event to carry a
sequence number and a monotonic timestamp. The event set:

| `EVENT_TYPES` symbol | Event name | When fired | Payload shape (key fields) |
|---|---|---|---|
| `CART_START` | `cart-start` | `cartHost.js` begins a cart run | `{cartId, runId, slug, startedAt}` |
| `CART_END` | `cart-end` | `done` returned OR cart halted | `{cartId, runId, reason, finishedAt}` |
| `STATE_ENTER` | `state-enter` | Driver enters a state | `{state, ctxKeys}` (ctx values NOT logged) |
| `STATE_EXIT` | `state-exit` | Driver exits a state | `{state, descriptor}` |
| `ACT_REQUEST` | `act-request` | Cart calls `(act 'verb args ...)` | `{verb, argsHash, on-result}` (args hashed, not logged verbatim) |
| `ACT_RESPONSE` | `act-response` | Driver receives verb result | `{verb, argsHash, ok, duration_ms}` |
| `ACT_PROGRESS` | `act-progress` | Long-running act emits progress | `{verb, p}` where `p ∈ [0,1]` |
| `ESCALATE` | `escalate` | State function returns `(escalate 'kind detail)` | `{kind, detailHash}` |
| `WAIT` | `wait` | State function returns `(wait 'event)` | `{event}` |
| `AFTER` | `after` | State function returns `(after seconds 'state ...)` | `{seconds, state}` |
| `ERROR` | `error` | Malformed descriptor / invariant violation | `{message, state, cartSlug}` |
| `INTERRUPTED` | `interrupted` | Live-voice mid-speech interruption | `{reason, state}` |
| `PRIMITIVE_CRASH` | `primitive-crash` | A primitive throws inside a state fn | `{cartSlug, state, primitive, message, stack, timestamp, ctxKeys}` |

Per `cartBus.js:47-55`: the `PRIMITIVE_CRASH` payload names ctx slots
present at crash time but never their values — "a crash should not
leak operator data into the log bus." This is the canonical example
of the §0.1 privacy rule applied at the event-payload boundary.

### §1.2 Sequence + timestamp guarantees

Every event carries:

- `seq`: monotonically increasing per CartBus instance
- `t`: monotonic timestamp (ms since CartBus construction)
- `dt_ms`: delta from previous event

Per `cartBus.js:96-103` — `nowMs()` is captured exactly once per emit;
the same value is reused for `t`, `dt_ms`, and `startedAt` seed so
hot cart runs don't burn CPU on three monotonic-clock reads per event.

### §1.3 The CartBus → ChipSink bridge

Per `cartBus.js:23-26` — every emitted bus event is also converted to
a chip.v1 envelope and appended to chipSink. This is how the chip
economy gets populated: operators (and Sakura) drag log entries
straight into automations without any marshaling step.

The field contract is locked at `src/lib/chipEvent.md`.

### §1.4 Multi-step gate

Per `cartBus.js:65-78` — the `isMultiStep` flag (default `true`)
filters out one-shot tool calls from the AutomationPulseButton +
ActivitySheet surfaces. Single tool calls (one-shot API hits) set
this `false` and are filtered out per `[[curator-activity-sheet]]
§filter + OAB #11`. Defaulting `true` preserves back-compat for
existing callers that haven't been annotated yet.

### §1.5 Server-side mirror

The client-side cartBus is mirrored server-side via the audit pipe
(`preamble.audit_line`, §8). Every backing handler emits one audit
line per dispatch:

- `_audit(preamble, verb, "received", ...)` on entry
- `_audit(preamble, verb, "ok", ...)` on success
- `_audit(preamble, verb, "reject", ...)` on shape/auth rejection
- `_audit(preamble, verb, "error", ...)` on exception
- `_audit(preamble, verb, "ok-degraded", ...)` on honest-null

Visible at `curator-api/curator_api/routes/verb_backings.py:153-156`
(`_audit` helper) and in every route handler in the file.

---

## §2. Cost ledger (per-vendor)

### §2.1 The cost ledger module

Source: `curator-api/curator_api/llm_router/cost_ledger.py` (787 lines
as of 2026-07-03; 732 at the 2026-06-30 draft).

The ledger replaces what Vertex AI's "consolidated invoice" would have
provided. Per its docstring (`cost_ledger.py:1-7`):

> "Matches Vertex's 'consolidated invoice' benefit on the direct-
> vendor paths. Tally every LLM wire-call into a single append-only
> ledger so operators (and SRE) get one truthful surface for spend."

Two public surfaces (`cost_ledger.py:21-23`):

```python
record_call(call)                       # write — fast hot-path
summarize(*, bucket, since, until,      # read — admin API + widget
          operator_id, tier)
```

### §2.2 The cost row schema

Per `cost_ledger.py:25-41`, each call writes one CBOR-encoded row:

```python
{
  "tier_id":       "anthropic-realtime" | "anthropic-batch" | ...,
  "verb":          "model/reasoner" | "model/opus" | ...,
  "model":         "claude-sonnet-4-5-20251022" | ...,
  "input_tokens":  int,
  "output_tokens": int,
  "cache_creation": int,
  "cache_read":    int,
  "batch_discount": bool,
  "cost_usd":      float,
  "trace_id":      str,       # cart dispatch propagation
  "operator_id":   str,
  "tier":          str,       # free | imagine | dream | magic
  "ts_unix":       float,     # auto-stamped if missing
}
```

**Vendor-name lock special case.** Per `cost_ledger.py:7-15` —
`tier_id` IS the literal upstream tag for accounting reasons. The
ledger row payload contains vendor identifiers. The ledger is read
by SRE (engineering surface) and NEVER shown verbatim on the
operator marketplace UI. The aggregate API + dashboard widget
collapses upstream tags into capability-named rollups before serving
operator-facing payloads.

### §2.3 The tier → rollup translation

Per `cost_ledger.py:148-160`:

| Wire-call tier_id | Capability rollup | Is batch? |
|---|---|---|
| `anthropic-realtime` | `reasoner-realtime` | False |
| `anthropic-batch` | `reasoner-batch` | True |
| `anthropic-opus` | `deep-reasoner-realtime` | False |
| `gemini-realtime` | `workhorse-realtime` | False |
| `gemini-batch` | `workhorse-batch` | True |
| `gemini-cache` | `cache` | False |

`rollup_for_tier(tier_id)` is the public API (`cost_ledger.py:172-179`).
Unknown tier_ids fall through as `unknown` rather than leaking the
raw upstream string. This is the §0.1 rule #4 enforcement point.

### §2.4 The Loam plane: `system/cost-ledger`

Per `cost_ledger.py:42-48`:

- Plane: `system/cost-ledger` (append-only)
- Key: `cost-ledger/<day-bucket>/<trace_id>`
- Encoding: CBOR
- Subscription pattern: per `[[loam-impl-w9]]`

Day-bucketing makes the plane partitionable for archival; `trace_id`
suffix means same trace = same key = idempotent re-write
(`docs/WAVE-7B-DIRECT-VENDOR-PARITY-2026-06-29.md:93-98`).

Loam writes can be disabled in dev via `CURATOR_COST_LEDGER_WRITE=off`
(`cost_ledger.py:67`); the ring buffer (§2.6) still works.

### §2.5 The hard caps

Per `cost_ledger.py:70-82`:

```python
HARD_CAP_USD_PER_TIER = {
    "free":    0.10,
    "imagine": 1.00,
    "dream":  10.00,
    "magic": 100.00,
    "default": 0.10,
}
```

Caps scale with the pricing ladder ($0.10 / $1 / $10 / $100 per day).
`default` covers anonymous / no-tier ledger rows.

**Override hierarchy** (`cost_ledger.py:84-114`):

1. `CURATOR_COST_HARD_CAP_OVERRIDE_USD` env (testing / emergency
   lockdown — applies to ALL tiers).
2. Per-operator Loam override at `system/cost-caps/<operator_id>`
   (resolved by `cap_for_operator`).
3. Per-tier value from `HARD_CAP_USD_PER_TIER`.
4. Legacy `CURATOR_COST_HARD_CAP_USD` env (back-compat).
5. The `default` slot ($0.10).

A request that would breach the cap is rejected with
`cost-cap-exceeded` (the breach counter `hard_cap_breaches`
increments — SRE alert).

### §2.6 The in-process ring buffer

Per `cost_ledger.py:184-203`:

```python
_RING_MAX = 4096
_RING: deque = deque(maxlen=_RING_MAX)
_RING_LOCK = threading.Lock()

_COUNTERS = {
    "total_calls": 0,
    "total_input_tokens": 0,
    "total_output_tokens": 0,
    "total_cache_creation_tokens": 0,
    "total_cache_read_tokens": 0,
    "total_cost_usd_micros": 0,  # int micros to avoid float drift
    "hard_cap_breaches": 0,
    "rolling_24h_cost_usd_micros": 0,
    "loam_write_failures": 0,
}
```

The ring buffer is the hot-read cache so `summarize()` serves fast
without a Loam round-trip; Loam is the source-of-truth (append-only).

**Float-drift discipline.** Cost is stored as integer **micros**
(`cost_usd × 1_000_000`) to avoid float accumulation error
(`cost_ledger.py:198,211-227`). This is a Wave 7B discipline — earlier
audits caught a 0.00001-USD/call drift on summarize after ~10⁴ rows
that compounded to visible mis-reporting at admin-dashboard time.

### §2.7 The admin read surface

Per `docs/WAVE-7B-DIRECT-VENDOR-PARITY-2026-06-29.md:46-57` — two
admin-only HTTP routes (404 to non-admin per the existing admin
discipline):

```
GET /api/admin/cost/summary?bucket=<day|week|month>&operator=<id>&tier=<slug>
GET /api/admin/cost/dashboard-widget
```

Both routes serve through `cost_ledger.summarize()` /
`dashboard_widget_payload()`. The dashboard-widget endpoint returns
the pre-shaped payload for the SRE monitoring page.

### §2.8 Anthropic-batch + Gemini-batch + Gemini-cache cost shaping

Per `docs/WAVE-7B-DIRECT-VENDOR-PARITY-2026-06-29.md:10-17`:

| Tier | Realtime cost | Batch cost | Cache cost |
|---|---|---|---|
| Anthropic | $X | 0.5 × $X | (not yet enabled) |
| Gemini | $Y | 0.5 × $Y | 0.25 × $Y on cached read after TTL |

The cost ledger records the actual paid amount per-call; the rollup
preserves the batch-vs-realtime distinction so SRE can confirm the
batch tier is delivering its promised discount.

---

## §3. Per-operator usage tracking

### §3.1 The token ledger (operator-facing)

Source: `docs/PRICING-TOKEN-DESIGN-2026-06-18.md`.

Each operator carries a token budget that drips daily up to a per-tier
cap. Cart cost is HMAC-signed at build time
(`scripts/build_cart_index.mjs:73-99`, `curator-api/curator_api/signing.py`);
the dispatcher verifies on every cart load and rejects tampered
costs.

### §3.2 The token event taxonomy

Per `docs/MONITORING-SPEC.md:13-27` — every change to an operator's
token balance emits a structured event:

| Event name | Required fields |
|---|---|
| `token.drip` | `operator_id`, `tier`, `tokens_added`, `new_balance`, `cap_hit: bool`, `ts` |
| `token.spend` | `operator_id`, `tier`, `tokens_deducted`, `verb`, `cart_slug`, `new_balance`, `ts` |
| `token.gift` | `operator_id`, `tier`, `tokens_added`, `reason` (`compassion` \| `sla_credit` \| `admin`), `new_balance`, `ts` |
| `token.cap_hit` | `operator_id`, `tier`, `current_balance`, `cap_value`, `ts` |
| `token.burst_reject` | `operator_id`, `tier`, `tokens_attempted`, `burst_limit`, `retry_after_ts`, `ts` |
| `token.hmac_mismatch` | `operator_id`, `cart_slug`, `claimed_cost`, `recalculated_cost`, `ts` |

**Drip cadence monitoring** (per `MONITORING-SPEC.md:25`): a histogram
of drip intervals per operator per tier. Alert if any operator's drip
skips more than two consecutive expected windows.

### §3.3 Per-operator cost cap override

Per `cost_ledger.py:262-296,297-318` — `cap_for_operator(operator_id,
tier)` resolves to a per-operator override stored in Loam at
`system/cost-caps/<operator_id>`, falling back to the tier default.
The override surface exists so SRE can:

- Grant a Magic-tier-equivalent cap to a Free user testing a feature
- Pin a runaway operator below the Free cap as an incident response
- Lift an enterprise operator above the Magic default for an
  approved tier

Each override write to Loam is an audited event with the SRE
operator's identity in the audit row.

### §3.4 The Magic-default override (2026-06-23)

Per `CLAUDE.md` "Tier override — 2026-06-23" — every account treats
as `magic` for now (`curator-web/src/lib/operatorTier.js:getOperatorTier()`).
Token model, HMAC-signed cart costs, and backend daily-drip caps
remain in place; they just never gate because Magic carries them all.

The telemetry still fires. The cap-hit counters still bump. Honest
visibility into what WOULD be gated if payment were on. When payment
lands and the flag flips, the metric stream is already in production.

### §3.5 Cortex write budget per operator

Source: `curator-api/curator_api/cortex/write_budget.py`.

Independent of the LLM cost cap — each operator has a daily Cortex
write cap (memo creation rate-limit). Visible at
`verb_backings.py:234-247` in the `cortex/remember` handler:

```python
from ..cortex import write_budget
budget = write_budget.check_and_bump(preamble.user_id or "anonymous")
if not budget["ok"]:
    _audit(preamble, "cortex/remember", "refused",
           {"reason": "budget-exceeded", "cap": budget["cap"]})
    return {
        "ok": False,
        "trace_id": preamble.trace_id,
        "error":   "budget-exceeded",
        "cap":     budget["cap"],
        "count":   budget["count"],
        "day":     budget["day"],
    }
```

This was added as the X9 / Cortex audit 2026-06-24 fix
(`verb_backings.py:228-233`): the HTTP `/api/cortex/write` route
gated, the Scheme-verb path did not. A cart-dispatch loop could drip
past the daily cap indefinitely via repeated `(cortex/remember …)`
calls. Now both paths converge on `write_budget.check_and_bump`.

---

## §4. Wire-call observability

### §4.1 The per-wire-call counters

Each wire-call module reports its outcome through the audit pipe
(§8). Aggregations:

| Counter | Source | Read at |
|---|---|---|
| `rate_limit_hits` | 429 from upstream | Per-vendor per-day |
| `quota_exhausted` | Daily quota burned | Per-vendor per-day |
| `auth_failures` | 401 → `service-not-yet-wired` | Per-operator per-vendor |
| `latency_p50_ms` / `p95` / `p99` | wire-call duration | Per-vendor per-hour |
| `upstream_error_rate` | 5xx / 502 / 504 over total | Per-vendor per-hour |
| `cost-cap-exceeded` events | Cost ledger rejection | Per-operator per-day |

### §4.2 The latency capture pattern

Every route handler measures end-to-end duration:

```python
# Conceptual pattern from verb_backings.py:170+
preamble, args = await _parse_request(request)
_audit(preamble, verb, "received")     # t0
try:
    result = await backing(...)         # t1 - t0 = backing duration
except Exception as exc:
    _audit(preamble, verb, "error",
           {"error_class": exc.__class__.__name__})
_audit(preamble, verb, "ok", {"chars": len(text), ...})  # t2
```

The duration between `received` and `ok` is the operator-perceived
latency. SRE aggregates per-vendor; alerts fire when p95 exceeds
threshold per `MONITORING-SPEC.md`.

**The per-verb latency write path (wired 2026-07).** The percentile
metric names (`latency-p50/p90/p95/p99-by-verb`) were reserved in the
metric allow-list long before anything wrote them — outside the Stores
SLO surface (`stores/slo.py`), no code populated them. `sre/latency_ring.py`
closes that gap. Its `LatencyRing` class (`:64`) is an in-process, per-verb
ring of the most recent samples (`MAX_SAMPLES_PER_VERB`, a `deque` so the
memory is bounded and the percentile sort stays cheap). The wiring at
HEAD:

- **Write.** `routes/verb_backings.py:112` imports `record_verb_latency`
  and records `duration_ms` for every backing call that reaches `t_ok`.
- **Drain.** `sre/timeseries.py:714` calls `default_latency_ring().drain_percentiles(now=…)`
  once per metric tick; draining clears the ring so each tick's
  percentiles cover only that window's samples.
- **Snapshot.** `sre/routes.py:675` calls `snapshot_percentiles()` for
  the live SRE dashboard read (non-destructive — does not clear the ring).
- **Empty window is honest-null.** A tick with no samples for a verb
  returns no percentile rows; the dashboard renders "no data", not a
  fabricated zero (`sre/latency_ring.py:26-28`). This is the §0.1 rule #1
  applied at the percentile boundary.

`_percentile` (`sre/latency_ring.py:51`) is nearest-rank and mirrors
`stores/slo.py:_percentile` so the two latency surfaces agree on the
percentile definition. The ML feature extractor
(`sre/ml/features.py:44`) reads the same `snapshot_percentiles` output,
so the anomaly model and the dashboard see identical numbers.

### §4.3 The rate-limit envelope

Per the integration manual (`LACUNA-INTEGRATION-1.0-ENGINEERING.md §4.3`)
and per `meta/dispatcher.py:73-76` — every rate-limited response
carries:

```python
{
  "ok": False,
  "error": "rate-limited",
  "reason": "<vendor>-rate-limit",
  "retry_after_s": <float>,
}
```

The SRE dashboard reads the `<vendor>` field of the reason; the
operator-facing surface translates to "the marketplace is busy."

### §4.4 The probe surface (`/api/healthz/deep`)

Source: `curator-api/curator_api/_healthz_deep.py`.

**What the deep healthcheck actually checks today.** Verified against
`_healthz_deep.py:238` (`run_deep_health`) at HEAD `d4f5a8a4`: the deep
probe runs four subchecks and returns `{db, vendor, disk, memory}` plus
an aggregate status code (`:247`). It is a **host-liveness** probe, not
a per-vendor configuration matrix:

| Subcheck | Function | What it measures |
|---|---|---|
| `db` | `_check_db(db_path)` (`:69`) | Cortex/listings SQLite reachable + writable |
| `vendor` | `_check_vendor()` (`:105`) | One egress probe — HTTP GET to `httpbin.org/get`, 2s timeout. Confirms the box can reach the public internet at all; it does NOT probe any specific upstream (`:12`, `:36`). |
| `disk` | `_check_disk()` (`:130`) | Free-space headroom |
| `memory` | `_check_memory()` (`:180`) | Available-memory headroom |

The single `vendor` egress probe is deliberately a "dummy egress"
canary (`httpbin.org`), chosen so the check names no real upstream and
leaks no vendor identity into the health surface.

**The per-vendor matrix is a separate, not-yet-unified surface.** Each
wire-call module does expose an `is_configured()` boolean
(`batch_anthropic.py`, `batch_gemini.py`, `firecrawl/client.py:13-29`
for the keyless honest-null), and the routing manifest probe
(`routing/l1_manifest.py`, §4.5) reports per-capability readiness. But
those are not aggregated into `/api/healthz/deep` today. A future
`per-vendor configured / last-success / last-rate-limit` matrix — the
shape below — is the target, capability-tagged so no vendor string
surfaces:

| Capability | Configured | Last successful call | Last rate-limit |
|---|---|---|---|
| `model/reasoner` | yes | 2 min ago | 18 min ago |
| `model/workhorse` | yes | 4 min ago | (none today) |
| `web/scrape` | yes | (in flight) | (none) |
| `etsy/*` (per-operator) | yes for operator X | — | — |

<!-- LIVING:EXPAND(2026-07-03): the per-vendor readiness matrix above is NOT wired into /api/healthz/deep at HEAD d4f5a8a4 — that endpoint returns {db, vendor, disk, memory} only. Aggregate the per-module is_configured() + l1_manifest probe into a capability-tagged matrix and splice it into run_deep_health() before claiming the matrix exists. -->
<!-- LIVING:EXPAND(2026-07-03): puppet-master interface — pending build lane. When PUPPET-MASTER-SUITE lands, add its channel health to the readiness matrix. -->

### §4.5 On-device `voice/transcribe` observability

**Vendor-naming note.** Per the `CLAUDE.md` firewall, this telemetry
doc names the **capability verb** `voice/transcribe`, never the model.
The model identifier lives only in the INTEGRATION wire-call manual
(its §2.13). Everything below is model-agnostic on purpose: the same
counters serve whichever backend (on-device or cloud fallback)
actually served the request.

**Why this verb is different from every other in §4.** Every other
row in the wire-call table observes a *network* round-trip — a request
leaving the machine. `voice/transcribe`'s primary path is **on-device**
(§2.13 INTEGRATION): the audio never leaves the phone/host, so there is
no upstream latency to capture and no rate-limit envelope to read. The
telemetry surface therefore splits by backend:

| Signal | On-device path | Cloud fallback path (`FALLBACK_STT=google`) |
|---|---|---|
| Backend label | `local` | `fallback-cloud` |
| Latency captured | model inference wall-time (local) | network round-trip (as §4.2) |
| Rate-limit envelope | n/a (no quota) | as §4.3 (cloud quota applies) |
| Privacy note | audio stays on device | audio leaves device — **must** be surfaced in the consent/audit trail |
| Configured probe | `l1_manifest.py:132` `_check_voice_transcribe` (imports `nemo.collections.asr`, `:135`) | vendor `is_configured()` (as §4.4) |

**Health/readiness.** The deep-healthcheck matrix (§4.4) gains a
`voice-transcribe` row driven by the L1 manifest probe
(`routing/l1_manifest.py:60`, `:132`, `:174`). The probe reports the
capability key, not the model — so an SRE reading `/api/healthz/deep`
sees `voice-transcribe: ready|degraded`, never a vendor string.

**Cost.** The on-device path has **zero per-call cost** — it does not
appear in the per-vendor cost ledger (§2), because there is no vendor
invoice. The cloud fallback, when explicitly enabled, bills through
the normal §2.1 cost-row path under its capability tier. This is the
telemetry consequence of the L0-STT lock: moving STT on-device removes
a recurring line item from the ledger entirely.

**Privacy signal is load-bearing.** Because the default path keeps
audio on-device, any switch to the cloud fallback is a
**privacy-material event** and must be observable: the audit trail
(§1.5 server-side mirror) records `backend=fallback-cloud` so that a
CIPA/BIPA review can prove exactly which transcriptions left the
device and which did not. A silent fallback would be a compliance
defect, not merely a telemetry gap.

<!-- LIVING:TODO(2026-07-01): the on-device voice.parakeet_stt module has landed but is not yet wired into the voice/transcribe route (INTEGRATION §2.13). Until it is, the live `local` backend label is not emitted — every real request currently takes the cloud/honest-null path. Emit the `backend` label + wire the local-inference wall-time counter when the route splice lands. -->

---

## §5. Cortex write events

### §5.1 The Cortex memory module

Source: `curator-api/curator_api/cortex/memory.py`.

Every memo creation, memo recall, and memo expunge fires through
`CortexStore`. The store is local SQLite-backed (per the Cortex shell
chain). Each operation is audited.

### §5.2 Memo lifecycle events

| Event | Verb | Audit row |
|---|---|---|
| Create | `cortex/remember` | `verb_backings.py:262` `_audit(preamble, "cortex/remember", "ok", {"memo_id": memo_id})` |
| Recall | `cortex/recall` | `verb_backings.py:197` `_audit(preamble, "cortex/recall", "ok", {"hit_count": len(hits)})` |
| Forget | `cortex/forget` | `verb_backings.py:2154+` |
| Calendar fetch | `cortex/calendar` | `verb_backings.py:2106+` |
| Cosine top-k | `cortex/cosine-topk` | `verb_backings.py:2206+` |

### §5.3 The write-budget signal

Per §3.5 — `cortex/remember` budget-exceeded events are audited
explicitly as `"refused"` outcomes (`verb_backings.py:237-246`). SRE
reads these to identify operators whose carts are looping or
mis-configured.

### §5.4 What is NOT logged in Cortex events

- **Memo body content.** The audit row carries `memo_id` and the
  caller's `trace_id`. The body is in Cortex (encrypted at rest); it
  does not appear in any log line.
- **Recall query text.** `cortex/recall` may carry a `topic` filter.
  The filter string IS logged ONLY when it appears in the args; SRE
  policy is to scrub it from any cross-operator analytics surface.
  <!-- LIVING:RESEARCH(2026-06-30): confirm the topic-filter scrubbing is enforced in any analytics pipeline that reads the audit log. -->
- **Hit memo IDs (beyond count).** `cortex/recall` audit logs
  `hit_count`, not the IDs of the hits. The operator's recall pattern
  is the operator's pattern.

---

## §6. Loam plane queries

Per `docs/LOAM-1.0-ENGINEERING.md §1` — Loam is partitioned into
planes. Each plane has its own consistency, retention, and access
contract. Telemetry queries land on specific planes.

### §6.1 The five planes

Per `LOAM-1.0-ENGINEERING.md §1.1` + §1.4:

| Plane | Visibility | Mutation pattern | Telemetry use |
|---|---|---|---|
| **TENANT** | Single operator | Read/write by that operator's carts | Per-operator cart performance receipts |
| **COHORT** | Per-cohort aggregate (K-floor-gated) | K-anonymous aggregate read-only for non-cohort-members | Sakura recommendation cohort fitness |
| **WORLD** | Public knowledge (Cortex Knowledge Loop) | Append-only, audit-trail-mandatory | Cohort outcomes opt-in publishable to PUBLIC |
| **SYSTEM** | Internal — audit, reconciliation, SRE events | Service writes; SRE reads | Every telemetry channel listed in this document |
| **PUBLIC** | OPT-IN cohort outcomes promoted from COHORT | Cohort-cohort sign-off | Anonymous trend publications |

### §6.2 The SYSTEM plane row table

The SYSTEM plane carries every telemetry channel. Per
`LOAM-1.0-ENGINEERING.md §21.1`:

| `SYSTEM/<sub-plane>` | Contents |
|---|---|
| `SYSTEM/otel` | OpenTelemetry spans per op |
| `SYSTEM/metrics` | Prometheus per-shard metrics (latency, throughput, error rate, replication lag, projection freshness) |
| `SYSTEM/slo` | Per-tenant SLO dashboards (p50/p95/p99 per tenant) |
| `SYSTEM/sakura-recs` | Sakura's recommendation outcomes (accepted / succeeded / reverse-suggested) |
| `SYSTEM/self` | Loam writing its own operational state into Loam |
| `SYSTEM/cohort-outcomes` | Per-cohort outcomes (K-floor-gated; opt-in publishable to PUBLIC) |
| `SYSTEM/pattern-proposals` | Pattern-mining signal (clusters in the audit log suggesting new cart candidates per §16.3.9) |
| `SYSTEM/cost-ledger` | Per-vendor cost ledger (§2.4 above) |
| `SYSTEM/audit` | The per-operator audit spine (§8 below) |

### §6.3 The query surface

Telemetry queries use the Loam Shell + cap-token discipline (per
`LOAM-1.0-ENGINEERING.md §14`). An SRE asking *"what was the p95
latency for Anthropic batch submits on Tuesday?"* writes a Loam read
query against `SYSTEM/metrics` with a SYSTEM-plane cap-token. The
query is itself audited (`SYSTEM/audit`).

This is the recursive observability rule (§0.1 #5) in operation: the
act of observing telemetry IS itself telemetry.

### §6.4 COHORT plane K-floor

Per `LOAM-1.0-ENGINEERING.md §13` — the cohort plane enforces a K-
anonymity floor (default K=5). A cohort query that would return data
from fewer than K operators is refused. This is the privacy floor on
cross-operator aggregate signals.

The SRE dashboard's per-vendor latency aggregates are NOT subject to
K-floor (vendor latency is not operator data); the operator cohort
outcomes ARE.

### §6.5 PUBLIC plane opt-in

Per `LOAM-1.0-ENGINEERING.md §6.7` and §21.1 — `SYSTEM/cohort-outcomes`
can be opt-in published to PUBLIC for the Cortex Knowledge Loop. The
publish step requires cohort cohort-member sign-off and strips any
metadata that could re-identify the cohort.

This is how the system gets smarter without ever betraying the
operator (per `CLAUDE.md` 2026-06-27 trust verbatim).

---

## §7. SRE dashboards at /systems/monitoring

### §7.1 The SRE web surface

Source: `curator-web/public/systems/monitoring/` (the source folder),
`curator-web/dist/systems/monitoring/` (the built artifact).

Per the dist evidence (`curator-web/dist/systems/monitoring/app.js:200,229`)
the SRE dashboard is served at `/systems/monitoring/` with a Google
SSO auth gate (`/api/sre/auth/google/start?back=...`). Modules:

| Path | Purpose |
|---|---|
| `/systems/monitoring/` | Root dashboard |
| `/systems/monitoring/#loam` | Loam health (per-shard, per-plane) |
| `/systems/monitoring/chat/` | SRE chat with provenance + identity |
| `/systems/monitoring/charts/` | D3 chart components |

Per `docs/LOAM-1.0-ENGINEERING.md §41` (the "SRE monitoring product"
chapter added 2026-06-27 per AUDIT-LIES Priya I-2):

> "Earlier drafts of this doc never named the SRE monitoring product
> even though ~6000 LoC of code under curator-api/curator_api/sre/ +
> curator-web/public/systems/monitoring/ ships it."

### §7.2 The chart surface

D3 chart modules under `/systems/monitoring/charts/` (chart-line.js
etc.) read from the admin cost endpoints (`/api/admin/cost/summary`,
`/api/admin/cost/dashboard-widget`) and from Loam SYSTEM-plane reads
via the SRE backend API.

### §7.3 The dashboard read paths

| Dashboard panel | Reads from | Read pattern |
|---|---|---|
| Per-vendor cost (24h) | `cost_ledger._RING` via `dashboard_widget_payload()` | Hot ring buffer read; ~ms latency |
| Per-tier daily-cap burn | `cost_ledger.summarize(bucket="day", tier=...)` | Ring buffer + recent Loam window |
| Cart fire rate | `SYSTEM/audit` aggregated by verb per minute | Loam range read |
| Wire-call latency p95 | `SYSTEM/metrics` per-vendor histogram | Loam projection read |
| Shard health | `SYSTEM/self` per-shard freshness | Recursive Loam read |
| Replication lag | `SYSTEM/self` per-shard | Recursive |
| Anthropic batch queue depth | `cost_ledger` + per-call `batch_id` records | Hybrid |
| Operator cost-cap breaches | `_COUNTERS["hard_cap_breaches"]` + SYSTEM/audit | Counter + audit cross-ref |

### §7.4 The chat-with-context surface

The SRE chat (`/systems/monitoring/chat/`) carries identity + crypto
(`/systems/monitoring/chat/identity.js`, `chat/crypto.js`) so SRE
queries against the substrate are signed and audited. This is the
recursive-observability rule again: SRE-on-SRE conversation is
itself an audited substrate event.

### §7.5 The bash-recovery last-resort

Per `LOAM-1.0-ENGINEERING.md §21.2.3` — `loam-health.sh` is the
last-resort observability when the dashboards themselves are
degraded. Single POSIX-tools + sqlite3 script; output is parseable,
exit code is meaningful. SRE on-call uses it when the web dashboards
are down.

Confirmed at HEAD `d4f5a8a4`: the script lives at `tools/loam-health.sh`,
which matches the operational-scripts convention (a human runs it to
operate the system → `tools/`, not `scripts/`).

---

## §8. Audit log spine

### §8.1 The `audit_line` contract

Source: `curator-api/curator_api/preamble.py:257-278`.

```python
def audit_line(preamble: Preamble, verb: str, outcome: str,
               extra: Optional[Mapping[str, Any]] = None) -> str:
    """Render the ONE-LINE structured audit string for a backing call.

    🔐 Zain: this is what hits the log file. trace_id only — NEVER the
    full preamble (no PII bleed). The handler emits this on every
    accepted + rejected dispatch.
    """
    line = {
        "ts": preamble.audit.ts_iso,
        "verb": verb,
        "trace_id": preamble.audit.trace_id,
        "parent_trace_id": preamble.audit.parent_trace_id,
        "tier": preamble.sakura.tier,
        "model_route": preamble.sakura.model_route,
        "cart_slug": preamble.doing.cart_slug,
        "turn_phase": preamble.doing.turn_phase,
        "outcome": outcome,
    }
    if extra:
        line.update({k: v for k, v in extra.items() if k not in line})
    return json.dumps(line, separators=(",", ":"), sort_keys=True)
```

### §8.2 The audit row field discipline

| Field | What it is | What it is NOT |
|---|---|---|
| `ts` | ISO-8601 timestamp from the preamble | NOT a server-side wall clock; from the cart's preamble so it ties to the cart's view of "now" |
| `verb` | Capability verb name (`etsy/listings`) | NOT a vendor name |
| `trace_id` | Opaque tracing identifier | NOT a user-meaningful ID |
| `parent_trace_id` | Trace propagation for multi-call carts | NOT operator identity |
| `tier` | `free` / `imagine` / `dream` / `magic` | NOT the literal model name |
| `model_route` | Capability route (`fast` / `reasoner` / `deep-reasoner`) | NOT vendor |
| `cart_slug` | Cart identifier | NOT cart contents |
| `turn_phase` | Phase of the cart's conversation turn | NOT message content |
| `outcome` | `received` / `ok` / `reject` / `error` / `ok-degraded` / `refused` | NOT a backtrace |

The `extra` field carries operation-specific data — never operator
PII. Pattern enforced per-handler (see `verb_backings.py:175-198`
for `cortex/recall` as canonical example).

### §8.3 The audit row destination

Per `_audit` helper at `verb_backings.py:153-156`:

```python
log = logging.getLogger("curator_api.verb_backings")

def _audit(preamble: Preamble, verb: str, outcome: str,
           extra: Mapping[str, Any] | None = None) -> None:
    """Emit ONE audit line per backing call. trace_id only — no PII."""
    log.info(audit_line(preamble, verb, outcome, extra))
```

The log line lands in the application logger; the log shipper writes
into Loam `SYSTEM/audit` for retention and into the SRE log analysis
pipeline.

Per `LOAM-1.0-ENGINEERING.md §21` — the audit log spine is itself
auditable; SYSTEM/audit can be queried for "every operation by
trace_id X" with the cap-token discipline.

### §8.4 Audit propagation across multi-call carts

`parent_trace_id` is the propagation field. A cart that fires
`(act 'cortex/recall ...)` then `(act 'model/workhorse ...)` then
`(act 'cortex/remember ...)` produces three audit rows; each shares
the same `cart_slug` but distinct `trace_id`s, and the second + third
carry the first's trace as `parent_trace_id`.

This is how SRE reconstructs the cart's narrative when investigating
an incident.

### §8.5 Audit row retention

Per `LOAM-1.0-ENGINEERING.md §9` — SYSTEM-plane retention is policy-
driven; the audit spine retention is mandatory for the compliance
window the operator's tier commits to. Default: 90 days hot, then
cold-archive.

<!-- LIVING:RESEARCH(2026-06-30): document the per-tier audit retention promise + the cold-archive surface. -->

---

## §9. What is NOT measured + why

### §9.1 The privacy floor

The following are NOT recorded under any circumstances:

| What | Why not |
|---|---|
| **Memo body content** (cortex/remember text) | Operator's data; lives encrypted in Cortex; audit logs `memo_id` only |
| **Cart state ctx values** (only key names) | A crash could leak operator data into the log bus (`cartBus.js:47-55`) |
| **Verb argument values** (only argsHash) | Same reason; replay uses the hash + log-stored response, not the live args |
| **LLM prompt content** | Sent to the vendor; not stored in our logs. Cost ledger records token counts, not text |
| **LLM response content** | Same |
| **Operator email** / **physical address** / **legal name** | The preamble carries `user_id` (opaque) — `preamble.py:207-209` heuristic rejects values that look like email or `acct_` |
| **OAuth tokens** | Encrypted in CredentialStore; logged only as the trace-correlated audit row's verb outcome |
| **Stripe payout details** | (Surface not yet wired; would be subject to same discipline) |
| **PII categories per cart category** | The Blodgett pre/post-pass (`verb_backings.py:62-128`) decisions are logged with kind + verdict only — never the cleaned/blocked text |

### §9.2 The vendor-shaping floor

The following are NOT exposed on operator-facing surfaces:

| What | Why not |
|---|---|
| **Vendor names** | `CLAUDE.md` 2026-06-22 vendor-name lock; bake-in to LLM weights |
| **Vendor cost-per-call** | Operators pay per-token-budget, not per-vendor; vendor cost is SRE-only |
| **Vendor model strings** (e.g. `claude-sonnet-4-5-20251022`) | Lives only in `_VERB_TO_MODEL` tables in wire-call modules |
| **Vendor URL paths** | Same — wire-call modules only |
| **Vendor rate-limit window sizes** | Operator sees "the marketplace is busy"; SRE sees `<vendor>-rate-limit` |
| **Vendor-specific error codes** | Translated to capability errors before any operator-facing surface renders them |

### §9.3 The signal-not-noise floor

The following ARE measurable but deliberately NOT collected:

| What | Why not |
|---|---|
| **Cursor position / keystroke timing in the cart editor** | Not load-bearing; collection cost > observability value |
| **Browser session details beyond user-agent header** | Privacy boundary; `/api/me` returns session shape, not browser fingerprint |
| **Geo IP of every request** | Coarse-bucket country at most; never lat/long |
| **Per-cart per-operator outcome cross-product** | Aggregates land in SYSTEM/sakura-recs; raw cross-product would re-identify operators below the K-floor |

### §9.4 The sampling decision

Per `LOAM-1.0-ENGINEERING.md §21.1` + the cost-ledger ring buffer
(§2.6) — we don't sample. Every wire-call records a cost-ledger row;
every cart event hits the bus; every audit line lands in the log.

The volume-control mechanism is the K-floor on COHORT plane reads
(§6.4) plus retention policies (§8.5), not on the write path.

The rationale: telemetry honesty defeats sampling. A 1-in-100
sampled cost number is a story we tell ourselves; a real per-call
number is the truth. We pay the storage cost.

---

## §10. LIVING:RESEARCH

Open uncertainties for future passes:

<!-- RESOLVED(2026-07-03): /api/healthz/deep does NOT return a per-vendor matrix — it returns {db, vendor, disk, memory} with a single httpbin.org egress canary (_healthz_deep.py:238,247). §4.4 corrected + LIVING:EXPAND left for the future per-vendor matrix. -->

<!-- LIVING:RESEARCH(2026-06-30): cortex/recall topic-filter scrubbing in cross-operator analytics — confirm the scrub pipeline exists. -->

<!-- RESOLVED(2026-07-03): loam-health.sh confirmed at tools/loam-health.sh (correct per operational-scripts convention). §7.5 updated. -->

<!-- RESOLVED(2026-07-03): per-verb latency write path is wired — sre/latency_ring.py records at verb_backings.py:112, drains at sre/timeseries.py:714, snapshots at sre/routes.py:675. §4.2 documents it. -->

<!-- LIVING:RESEARCH(2026-06-30): per-tier audit retention promise + cold-archive surface — document the exact retention SLO. -->

<!-- LIVING:RESEARCH(2026-06-30): Sakura's recommendation outcomes feed into SYSTEM/sakura-recs — confirm the cart-event → SYSTEM/sakura-recs translator is wired (or scaffolded). -->

<!-- LIVING:RESEARCH(2026-06-30): the K-floor enforcement point — confirm in code where COHORT-plane reads check K and refuse. -->

<!-- LIVING:RESEARCH(2026-06-30): OpenTelemetry span emission — is it actually wired today, or LOAM-doc'd as planned? -->

<!-- LIVING:RESEARCH(2026-06-30): Prometheus per-shard metrics — same question, scaffolded vs production. -->

<!-- LIVING:RESEARCH(2026-06-30): drip-cadence-skip alert — confirm it's wired in MONITORING-SPEC.md to a real alert rule, not just specified. -->

<!-- LIVING:RESEARCH(2026-06-30): the per-vendor latency aggregator — does it strip vendor names before rolling up to dashboard panels, or does the dashboard read the raw tier_id? -->

*[needs: real cost-per-tier figures from 30 days of production load — currently the document cites the cap config, not the actual burn]*

*[needs: real p50/p95/p99 latency figures per vendor for the 14 wired LLM vendors]*

*[needs: list of every active alert rule in MONITORING-SPEC.md cross-referenced with the actual alert backend (Pager / on-call rotation)]*

*[needs: incident-response runbook references — when alert X fires, which doc do you read]*

---

## §11. References

### §11.1 Internal references

- `curator-web/src/scheme/cartBus.js` — client-side event spine
- `curator-api/curator_api/preamble.py` — server-side preamble +
  `audit_line` (`:257-278`)
- `curator-api/curator_api/routes/verb_backings.py` — `_audit` helper
  (`:153-156`); per-route audit-emit pattern (throughout)
- `curator-api/curator_api/llm_router/cost_ledger.py` — per-vendor
  cost ledger (732 lines)
- `curator-api/curator_api/cortex/write_budget.py` — per-operator
  Cortex write budget
- `curator-api/curator_api/cortex/memory.py` — `CortexStore`
- `curator-api/curator_api/_healthz_deep.py` — deep healthcheck
  (`run_deep_health` at `:238`; `{db, vendor, disk, memory}`)
- `curator-api/curator_api/sre/latency_ring.py` — per-verb p50/p90/p95/p99
  latency write path (`LatencyRing` at `:64`)
- `curator-api/curator_api/sre/timeseries.py` — metric tick that drains
  the latency ring (`:714`) into the percentile metrics
- `curator-api/curator_api/sre/` — SRE backend API
- `curator-web/public/systems/monitoring/` — SRE dashboard
- `curator-web/src/lib/chipEvent.md` — chip envelope field contract
- `scripts/build_cart_index.mjs` — cart index builder + HMAC signer

### §11.2 Related canonical docs

- `docs/HELLO-SURFACE-1.0-ENGINEERING.md` — substrate
- `docs/SAKURA-SCHEME-1.0-ENGINEERING.md` — runtime
- `docs/SAKURA-SCHEME-1.0-REFERENCE.md` — verb catalog
- `docs/SAKURA-AUTOMATIONS-1.0.md` — cart catalog
- `docs/LOAM-1.0-ENGINEERING.md` — substrate database (§21 telemetry,
  §41 SRE monitoring product)
- `docs/SAKURA-TRAINING-MANUAL-1.0-ENGINEERING.md` — training pipeline
- `docs/LACUNA-INTEGRATION-1.0-ENGINEERING.md` — wire-call manual
  (the source of the upstream tags this document observes)
- `docs/SAKURA-SCHEME-1.0-SEALING.md` — sealing protocol

### §11.3 Spec docs (derivative)

- `docs/MONITORING-SPEC.md` — alert rules, dashboards, log formats
  authoritative spec
- `docs/SRE-MONITORING-SETUP.md` — SRE onboarding
- `docs/PRICING-TOKEN-DESIGN-2026-06-18.md` — token model + HMAC
- `docs/WAVE-7B-DIRECT-VENDOR-PARITY-2026-06-29.md` — cost ledger
  origin + Vertex-shift abandonment rationale
- `docs/PREAMBLE-ENVELOPE-DESIGN-2026-06-15.md` — the preamble
  envelope that carries every audited dispatch

### §11.4 External references (for the patterns adopted)

- **OpenTelemetry semantic conventions** —
  `https://opentelemetry.io/docs/specs/semconv/` — span shapes the
  SYSTEM/otel plane mirrors
- **Prometheus best practices** —
  `https://prometheus.io/docs/practices/naming/` — metric naming the
  SYSTEM/metrics plane follows
- **K-anonymity (Sweeney 2002)** —
  `https://epic.org/wp-content/uploads/privacy/reidentification/Sweeney_Article.pdf` —
  the privacy floor on cohort-plane reads
- **CBOR (RFC 8949)** — `https://www.rfc-editor.org/rfc/rfc8949.html` —
  the cost-ledger row encoding
- **CCPA / GDPR PII categorisation** — the floor for the §9.1 list of
  things-not-logged

---

*End of LACUNA-TELEMETRY-1.0-ENGINEERING.md.*
*Document version: 1.0.1-draft · 2026-07-03 drift pass (HEAD d4f5a8a4): §4.2 latency-ring write path added; §4.4 deep-healthcheck corrected to {db, vendor, disk, memory}; §7.5 loam-health.sh location confirmed; cost_ledger line count refreshed. Subject to remaining LIVING:RESEARCH closure per §10.*


---

# §ORACLE — L1 Oracle Design (folded from meridian/docs/lacuna-monitoring-l1-oracle-design-v0.1.md)

id: LACUNA-MONITORING-L1-ORACLE-DESIGN-v0.1
title: Lacuna Monitoring L1 (oracle / AI-judge) — design draft
status: draft v0.1 — REVERSAL 2026-05-01-PM: chat-claude's "Lacuna L0 SRE agent" was correctly L0 (operator's hardware), not Lacuna Monitoring's L1. The MRCL Router design belongs to Lacuna L0, not this doc. See § "Reversal" below.
date: 2026-05-01 (reversal addendum 2026-05-01-PM)
chair: Alfred (Architect)
scribe: Claude (PM)
provenance:
  - /Users/alfred/Downloads/HANDOFF_claude_code_1.md (chat-claude → Claude Code; 2026-05-01)
  - /Users/alfred/Downloads/lacuna_qwen_orchestration.md (the L0 SRE narrative; correctly L0 after reversal)
  - /Users/alfred/code/research/canonical-taxonomy.md (today's canon)
  - /Users/alfred/code/lacuna-monitoring/docs/deployment-sizing-v0.1.md (sizing context)
companions:
  - /Users/alfred/code/research/glossary.md (Lacuna disambiguation)
  - lacuna-monitoring/docs/canonical-taxonomy-allhands-2026-04-30.md
  - lacuna/ai/llm/docs/lacuna-design-doc-v1.md (Pillar 1 — Lacuna L0 SRE orchestrator lives there)
---

# Lacuna Monitoring L1 (oracle / AI-judge) — design draft

## Reversal 2026-05-01-PM

> The morning pass on this document claimed chat-claude's "Lacuna
> L0 SRE agent" was *incorrectly* named L0 under canonical taxonomy
> (because Fly.io hosting = off-device → L1). Alfred reviewed and
> clarified twice the same day:
>
> 1. (AM) The SRE orchestrator runs on **the operator's hardware**
>    (their Linux box, self-hosted Docker, or a small managed Fly
>    per-operator instance they run themselves). So it's L0
>    semantically — operator-hardware tier — not L1.
> 2. (PM) Lacuna L0 is **already designed** — it's the Qwen 2.5-3B
>    trained on Linux stuff that's running now. So the SRE
>    orchestrator IS Lacuna L0. Final canon: Lacuna runs L0/L1/L2,
>    same depth as Sakura.
>
> Implications:
>  - Chat-claude's "Lacuna L0 SRE agent" framing was right all
>    along. The morning's reconciliation was the drift.
>  - The MRCL Router design, diagnostic chains, host-binding
>    security, and Qwen-sizing material from chat-claude's handoff
>    are **Lacuna L0** content (Pillar 1 of the lacuna design doc),
>    not Lacuna Monitoring L1 content.
>  - **Lacuna L0 (SRE orchestrator)** and **Lacuna Monitoring L1
>    (oracle)** are two different things that share Qwen DNA but
>    sit at different canonical tiers:
>     - Lacuna L0 LLM = active diagnosis on the operator's hardware
>       (reads syscalls, runs shell, traverses MRCL chains; Qwen
>       2.5-3B trained on Linux stuff).
>     - Lacuna Monitoring L1 LLM = passive observation on our
>       hosted infra (reads LMTP traces from `lacunad`, emits
>       digests + anomaly callouts).
>  - The MRCL Router content below stays here for now as a
>    historical record of the morning's reconciliation. The
>    canonical home for that material is
>    `lacuna/ai/llm/docs/lacuna-design-doc-v1.md` § "Pillar 1 —
>    Lacuna L0 LLM: SRE orchestrator". A future pass should move
>    the implementation specifics over and leave a pointer here.
>  - **What this doc still covers correctly:** the role of Lacuna
>    Monitoring's L1 oracle (passive trace observation) and the
>    sizing question for that role specifically (whether 0.5B
>    digest-only or larger reasoning is appropriate for trace
>    digests). That role is genuinely L1 under canonical
>    taxonomy — separate from the SRE orchestrator at Lacuna L0.

## Why this doc exists (with reversal applied)

A handoff from a sibling chat session (`HANDOFF_claude_code_1.md`,
2026-05-01) proposed a Qwen-based agent with an MRCL Router
(Multi-Chain Reasoning Language) that maps system-call patterns to
diagnostic chains. The morning pass routed that material to
**Lacuna Monitoring L1**; the architecture-correction pass routes
it to **Lacuna L0** (SRE orchestrator on operator hardware) where
it actually belongs.

The remaining open question for **Lacuna Monitoring L1** itself:
sizing for *trace-digest* work (the canonical role), separate
from the SRE orchestrator's chain-traversal needs.

## Naming reconciliation (corrected — final)

| Chat-claude term | Canonical equivalent (corrected) | Note |
|---|---|---|
| "Lacuna L0 SRE agent" | **Lacuna L0 LLM (SRE orchestrator on operator hardware)** | The role lives on the operator's hardware (Linux box / self-hosted Docker / per-operator small Fly). It's L0 because that's the operator-hardware tier under canonical taxonomy. Lives in the `lacuna/` repo (Pillar 1 of `lacuna-design-doc-v1.md`). |
| "Lacuna" (when meaning the SRE agent) | **Lacuna LLM** (specifically Pillar 1: L0 SRE orchestrator) | The product. |
| "Lacuna" (when meaning trace observation) | **Lacuna Monitoring** (this product) | Different product, different role. |

Lacuna Monitoring still has no L0 and no L2 under canonical
taxonomy: the daemon (`lacunad`) runs everywhere as deterministic
infrastructure, not as a per-device LLM; the oracle is a
fixed-cost component owned by us, not third-party. The L1 tier is
the only AI tier in the stack.

## Role (what the L1 oracle does)

The oracle reads recent LMTP windows from `lacunad`, plus per-system
context (process state, syscalls, error logs), and produces:

- **Digests.** One-line `ai_note` annotations on LMTP records.
- **Anomaly callouts.** Surfaces patterns the operator should see.
- **Diagnostic chains.** Per the chat-claude handoff: maps system
  call signatures to multi-step reasoning chains (filesystem,
  memory, network, scheduler, etc.).

It **decides nothing**. Echo (graceful failure) handles the case
where the oracle declines.

## MRCL Router (chat-claude content, lifted as-is)

**MRCL — Multi-Chain Reasoning Language.** Routes patterns to
diagnostic chains:

| Signature | Chain |
|---|---|
| `stat` / `fstat` errors | Filesystem Health Chain |
| `mmap` / `brk` growth | Memory Leak Detection Chain |
| `connect` / `sendto` timeout | Network Connectivity Chain |
| `futex` contention | Lock Contention & Scheduler Chain |
| (others) | …drafted in `lacuna_qwen_orchestration.md`; not in this repo yet |

The chains live in a YAML library (per chat-claude's prototype) so
adding chains doesn't require model retraining. The model's job is
to *select* the chain and *traverse* its steps; the library is the
deterministic ML in front of the LLM (per
`/Users/alfred/code/research/ml-before-llm.md`).

## Open: model + deployment decisions

Two competing recommendations from two sessions:

### Model size

| Source | Recommendation | Rationale |
|---|---|---|
| `deployment-sizing-v0.1.md` (today's canon) | **Qwen 2.5 0.5B** at Q4_K_M, ~0.6 GB resident, 16K context | "Just digests log windows; doesn't reason multi-step" |
| `HANDOFF_claude_code_1.md` (chat-claude) | **Qwen 1.5-1.5B** quantized 4-bit, ~2-3 GB at runtime, on Fly.io 2GB instance | Multi-step diagnostic reasoning needs more capacity than digesting |

The disagreement comes from a scope difference: today's sizing
assumed the oracle would do "log digest" work only. Chat-claude's
proposal expands the role to multi-step diagnostic reasoning
(traversing MRCL chains). If the role expands, the model size has
to follow.

**Decision needed:** is the L1 oracle's role digest-only (today's
canon) or diagnostic reasoning (chat-claude)? Pick one; size
accordingly.

### Deployment topology

| Source | Topology |
|---|---|
| Today's canon | Per-machine (the daemon runs everywhere; the oracle is a fixed-cost component owned by us — but locality not specified) |
| Chat-claude | Centralized: single Fly.io 2GB instance, ~$20/mo + DeepSeek API fallback for novel incidents (~$0.25–0.50/mo) |

Centralized is cheaper but adds a network dependency (operator
must reach Fly to get diagnoses). Per-machine respects the
"daemon runs everywhere" rule but multiplies hosting cost by
operator count.

**Decision needed:** centralized Fly vs per-operator local. May
depend on whether the diagnostic chains need cross-machine
correlation (centralized wins) or not (local wins).

### DeepSeek API fallback

Chat-claude proposes routing novel incidents (where the local model
is uncertain) to DeepSeek API at ~$0.07 per complex incident. Under
canonical taxonomy this is **Lacuna Monitoring L2**. Today's canon
says Lacuna Monitoring has no L2 — but the canon was authored
before the fallback path was proposed. If chat-claude's recommendation
lands, the canon needs an update: Lacuna Monitoring grows an L2 tier
specifically for novel-incident escalation.

**Decision needed:** does Lacuna Monitoring grow an L2 tier (paid
DeepSeek class for novel incidents), or does the L1 oracle decline
to Echo when uncertain instead?

## Host binding (security)

Chat-claude's proposal:

```python
def enforce_host_binding(host_id_expected):
    current_id = compute_host_id()  # hash of hostname:mac:machine-id
    if current_id != host_id_expected:
        # Refuse to operate; reset state on copy
        ...
        sys.exit(127)
```

Multi-signal binding (hostname + MAC + `/etc/machine-id`) so a
copied instance refuses to run with the prior operator's state.
Root access defeats it; casual copying doesn't.

This is a security-domain concern (Tomas-veto) and applies whenever
the L1 oracle accumulates per-operator state (incident corpus,
fine-tuned weights). **Adopt as default for any v0.2+ artifact that
holds operator-derived state.**

## Fine-tune cadence

Chat-claude proposes: collect 1 month of incident data, then
fine-tune Qwen 1.5-7B on the postmortem corpus. Improves recurring-
pattern accuracy.

This is a Phase 4+ deliverable, gated by:
- L1 oracle shipping in any form (model size + topology decided)
- Postmortem corpus actually accumulating (operator running the
  oracle for a month)
- Kofi-veto on the corpus (per the standard fairness review path)

**Open:** parking until the oracle's role is settled. Once sized,
the fine-tune corpus + cadence becomes the natural follow-up.

## What this design does NOT cover yet

- Specific MRCL Router chain authoring (chat-claude has 30 dialogue
  examples in `lacuna_qwen_orchestration.md` — separate ingest pass)
- Operator-facing dashboard surface for diagnoses (Aiko + Dilip's
  scope)
- Cost dashboard integration (Kwame, gated on telemetry endpoint)
- Integration with personality-graph-strategy (probably none —
  Lacuna Monitoring's oracle has a tone register, not a
  personality)

## Followup all-hands

The 2026-04-30 canonical-taxonomy minutes scheduled an
"AI-judge interface design" all-hands for 2026-05-21
(Soo-Jin / Anya / Mira / Aiko). This doc is the pre-read for that
session. The decisions above (model size, topology, L2 fallback,
fine-tune cadence) are the chair questions.

```
# EOF LACUNA-MONITORING-L1-ORACLE-DESIGN-v0.1
```

---

# §SIZING — Deployment Sizing (folded from meridian/docs/deployment-sizing-v0.1.md)

id: DEPLOYMENT-SIZING-v0.1
title: Deployment sizing — what next week's box actually needs
status: chair-driven decision · pragmatic next-week scope
date: 2026-04-30
chair: Alfred (Architect)
scribe: Claude (PM)
audience: Kwame (SRE) — for hardware procurement decision
companions:
  - /Users/alfred/code/curator/research/sakura-l1-vision-plan-v0.1.md (Curator's vision model spec; renamed from sakura-llm-vision-plan-v0.1.md per canonical taxonomy)
  - /Users/alfred/code/curator/research/curator-3b-lora-training-v0.1.md (curator-3b LoRA; per-product successor to lora-training-data-v0.1.md)
  - /Users/alfred/code/curator/research/register-tuner-v0.1.md (the post-processor)
  - /Users/alfred/code/research/canonical-taxonomy.md (L0/L1/L2/Echo)
  - /Users/alfred/code/research/naming-conventions.md (`<Product> L<n> LLM`)
  - spec/log-format-v0.1.md (LMTP)
---

# Deployment sizing — pragmatic next-week scope

> Naming uses the canonical L-tier taxonomy
> (`/Users/alfred/code/research/canonical-taxonomy.md`). "Sakura LLM"
> in this doc means **Sakura L1 LLM (vision)** in production. "L4 / L5
> / L6" in cascade context maps to **Sakura L1 LLM** (text reasoner)
> and **Sakura L2 LLM** in prose; the `LAYER_*` constants in
> `cascade.py` keep their numeric forms (51 cascade tests depend on
> them — only documentation around them uses canonical taxonomy).
> The "AI-judge" is the **Lacuna Monitoring L1** oracle.

The architect asked the right pragmatic question:
*"How much brainpower do we need for each one of these things?
I'm not trying to write haikus from the thirteenth centuries."*

This document answers it. Forward-looking research items (the
dialectical Lacuna LLM, the AI-judge layer, multi-machine fabrics)
are deferred to their own roadmap docs. Here: what runs *next
week*, what model size each component genuinely needs, and what
Mac Mini SKU to buy for staging.

## TL;DR

- **The biggest single model we run locally is Qwen 2.5 3B.** Not
  7B. Not 70B. 3B handles every voice + register + light-reasoning
  task we have, passes the persona-eval rubric, runs at 30+ t/s on
  Apple Silicon.
- **The vision model is SigLIP ViT-L/16 + small heads** — about
  500 MB total. Frozen. We do NOT farm vision out to Google or any
  cloud vision API; that defeats the privacy + domain-fit + cost
  story.
- **Embeddings are `nomic-embed-text`** — 137 M params, ~270 MB.
- **Lacuna Monitoring's "AI-judge" does not run yet.** The slot
  exists in the dashboard; the filling waits for Q3 when Lacuna LLM
  is trained. Don't size for it.
- **Mac Mini sweet spot: M4 with 24 GB unified memory.** $799.
  Headroom for everything below + browser + dev tools without
  swap. 16 GB works but is tight. 32+ GB is over-spec for the
  next-week pipeline.
- **Training is NOT local.** LoRA fine-tunes go to Modal / RunPod
  for ~$10-30 a run. The Mac Mini is an inference + staging box,
  not a training rig.

## The standard pipeline — what fires when a query comes in

This is *next week's* pipeline. No future products, no Phase 4+
work assumed. Just the surfaces that exist today plus the v0.1
vision model when its training finishes.

```
   OPERATOR TYPES                        OPERATOR DROPS A PHOTO
        │                                        │
        ▼                                        ▼
   ┌────────────┐                       ┌─────────────────────┐
   │  L0 — L2   │ ── deterministic ───▶ │  Sakura LLM (vision)│
   │  string    │       no model         │  SigLIP ViT-L/16   │
   │  match,    │                        │  + 3 heads          │
   │  catalog,  │                        │  ~500 MB            │
   │  session   │                        └──────────┬──────────┘
   └─────┬──────┘                                   │
         │ escalate                                  ▼
         ▼                                  structured output
   ┌────────────┐                            (maker top-k,
   │  L3 RAG    │  embed query              era, technique,
   │  nomic-    │  + cosine over            quality flags)
   │  embed-    │  ~270 MB                   │
   │  text      │                            │
   └─────┬──────┘                            │
         │ escalate                          │
         ▼                                   ▼
   ┌────────────────────────┐    ┌──────────────────────────┐
   │  L4 LOCAL — curator-3b │    │  composer ingests        │
   │  Qwen 2.5 3B + LoRA    │    │  vision output as        │
   │  ~3.5 GB Q8            │    │  context for the L4 turn │
   │  ~2.0 GB Q4            │    └──────────────────────────┘
   │                        │
   │  uses RAG hits if any  │
   │  voice register baked  │
   └─────┬──────────────────┘
         │ escalate (rare for next week)
         ▼
   ┌────────────────────────┐
   │  L5 CLOUD              │
   │  DeepSeek / Anthropic  │
   │  ~no local memory      │
   │                        │
   │  → register-tuner pass │
   │    (re-runs Qwen 2.5   │
   │    3B with focused     │
   │    voice anchor — no   │
   │    LoRA, base model    │
   │    only, ~3.5 GB Q8    │
   │    if loaded)          │
   └────────────────────────┘
```

Plus the always-on infrastructure:

```
   ┌────────────────────────────────────────────┐
   │  lacunad daemon                            │
   │  Python stdlib · ~30 MB resident           │
   │  UDS ingest + HTTP query                   │
   │  No model. No GPU. CPU bookkeeping only.   │
   └────────────────────────────────────────────┘

   ┌────────────────────────────────────────────┐
   │  dashboard                                 │
   │  Static HTML + D3 served on demand         │
   │  ~0 resident; loads in browser only        │
   └────────────────────────────────────────────┘
```

## Per-model sizing — the size lock-in proposal

### L4 cascade + register-tuner — Qwen 2.5 3B

**Size:** 3B parameters. ~3.5 GB at Q8 quantization, ~2.0 GB at Q4.

**Why 3B and not 0.5B:**

- 0.5B drops persona invariants under load (em-dash leaks, "Great
  question" prefaces, occasional cultural-attribution slips).
  Tested informally; numbers go in the persona-eval rubric run.
- 0.5B fails at light multi-turn coherence (forgets the operator's
  prior turn ~30% of the time).
- 0.5B can't reliably handle inference-shaped turns (compare-A-vs-B,
  "should we…", etc.). Either escalates to L5 unnecessarily or
  produces shallow answers.

**Why 3B and not 7B:**

- 7B is ~2x the memory and ~2x the latency for ~10% more
  capability on our domain. The capability gain doesn't show up on
  our eval rubric — register, IACA discipline, listing copy, and
  hallmark hedging all saturate well before 7B.
- 7B Q8 is ~7 GB — eats half the 16 GB Mini's RAM by itself.
- We're not running general-purpose chat. The narrow-domain hits
  diminishing returns fast.

**Why not Phi-3 / Gemma / Llama 3:**

- We've validated Qwen 2.5's voice with our eval set; switching
  base means re-running the whole calibration.
- Open-weight licensing on Qwen 2.5 is permissive enough.
- Apple Silicon (Metal / MLX) backends for Qwen are well-supported.

**Locked at: Qwen 2.5 3B Instruct, Q8 quantization.** One model
loaded once; LoRA adapter swapped per use (curator-3b vs
register-tuner-base vs lacuna-3b when it ships).

### L3 embeddings — nomic-embed-text

**Size:** 137 M params. ~270 MB on disk and RAM.

**Why this and not OpenAI embeddings:**

- Local, no cloud round-trip
- No per-call cost
- No operator-data exfiltration
- Domain neutral — works for our jewelry corpus + general text

**Locked at: nomic-embed-text v1.5.**

### Sakura LLM (vision) — SigLIP ViT-L/16 + heads

**Size:** ~430 MB SigLIP backbone + ~3 MB total for three small MLP
heads. Backbone frozen v0.1; heads trained on operator corpus.

**Why this and not Google Vision API:**

- Domain fit. Google's general vision model knows about kitchen
  appliances and faces; it does not know mid-century Mexican
  silver hallmarks. Our heads + atlas retrieval do.
- Privacy. Operator photos never leave the machine.
- Cost. Per-call cloud vision adds up; ours is free per turn.
- Confidence vocabulary. We need *banded* confidence ("I think
  it's Spratling — the WS mark and the construction match"), not
  raw probabilities. The operator-explainable banded confidence
  pipeline (research/sakura-llm-vision-plan-v0.1.md § 2.5.4)
  requires per-head outputs we control. A black-box cloud API
  doesn't expose those.

**Why not the SigLIP-2 family or DINOv3:**

- SigLIP ViT-L/16 was confirmed at the 2026-04-29 all-hands by
  Alex (paper review). Reconsider at v0.2 only if eval falls below
  target.

**Locked at: SigLIP ViT-L/16 frozen + 3 head MLPs (trained per
operator corpus).**

### Lacuna Monitoring L1 (oracle / AI-judge) — DEFERRED

The dashboard's `ai_note` field exists in LMTP today; the **Lacuna
Monitoring L1 slot is empty**. Filling it requires a small LLM to
read recent log windows and produce digests / anomaly callouts.

The sizing below assumes a **digest-only role** (read window, emit
one-line annotation). A subsequent design proposal expands the role
to **multi-step diagnostic reasoning** (MRCL Router across
filesystem / memory / network / scheduler chains) which would push
the size up to ~1.5B + DeepSeek L2 fallback. See
`lacuna-monitoring-l1-oracle-design-v0.1.md` for the open chair
decisions on role and topology — sized values below are correct
*only if* digest-only wins.

Lacuna Monitoring has no L0 (the daemon runs everywhere; per-device
LLMs aren't the design). Whether it grows an L2 (paid DeepSeek-class
for novel-incident escalation) is open per the v0.1 design doc;
today's canon says no L2. Echo handles the AI-judge declining.

**When this matters:** Q3 (per the all-hands minutes).

**When to size for it:** Q3.

**What size when we do:** Probably **Qwen 2.5 0.5B** is plenty —
the judge digests log lines, doesn't reason multi-step. Worst case
we reuse Qwen 3B (already loaded) with a focused prompt; no extra
RAM cost.

**Don't pre-load.** Don't pre-buy RAM for it.

### Lacuna LLM (dialectical /argue) — DEFERRED

The Phase 4 dialectical model. Same base (Qwen 2.5 3B) with a
different LoRA adapter. **No additional base model load** — Ollama
swaps adapters against the resident base.

**When it ships:** Phase 4 (the all-hands set deliverables for
2026-05-13 and 2026-05-27).

**When to size for it:** Already sized. The base is the same Qwen
3B we load for L4. The LoRA adapter is ~30 MB.

## Qwen memory by workload

The model weights are fixed by quantization. The KV cache grows
with context length and number of concurrent generations.
Activations are usually negligible (hundreds of MB at most for our
sizes; reused across tokens).

**Total RAM = model weights + (KV per token × ctx length × concurrency) + activation peak**

### Qwen 2.5 3B — the model we run

Layer count 36, hidden 2048, KV heads 2 (GQA), head dim 128. KV
cache is ~36 KB per token at FP16, half that at Q8 cache, quarter
at Q4 cache.

**Model weights at common quantizations:**

| Quant | Bits/param | On disk | RAM resident |
|---|---|---|---|
| FP16 | 16 | 6.0 GB | 6.0 GB |
| Q8_0 | 8.5 | 3.2 GB | 3.2 GB |
| Q6_K | 6.6 | 2.5 GB | 2.5 GB |
| Q5_K_M | 5.7 | 2.2 GB | 2.2 GB |
| **Q4_K_M** (default) | 4.8 | **1.9 GB** | **1.9 GB** |
| Q3_K_M | 3.9 | 1.5 GB | 1.5 GB |

**KV cache size at typical contexts (FP16 cache):**

| Context length | KV cache |
|---|---|
| 1 K | 36 MB |
| 4 K | 145 MB |
| 8 K | 290 MB |
| 16 K | 580 MB |
| 32 K (max) | 1.16 GB |

KV cache halves at Q8, quarters at Q4. Most inference frameworks
default to FP16 cache; Ollama supports Q8 cache via parameter.

**Total RAM by realistic workload:**

| Workload | Quant | Ctx | Concurrency | Total RAM |
|---|---|---|---|---|
| Warm-keep idle | Q4_K_M | 1 K | 0 | **2.0 GB** |
| Cascade L4 turn (typical) | Q4_K_M | 4 K | 1 | **2.3 GB** |
| Cascade L4 turn (typical) | Q8_0 | 4 K | 1 | **3.6 GB** |
| Long-form draft (~16 K) | Q8_0 | 16 K | 1 | **4.1 GB** |
| Max context (32 K) | Q8_0 | 32 K | 1 | **4.7 GB** |
| Two operators concurrent | Q8_0 | 4 K | 2 | **3.8 GB** |
| Bench: 4 concurrent users | Q8_0 | 4 K | 4 | **4.3 GB** |
| Side-by-side experiment | Q8_0 + Q8_0 | 4 K | 1+1 | **6.8 GB** (loads model twice) |

The "side-by-side" case assumes you're running curator-3b and
base-qwen-3b as separate Ollama tags simultaneously without
adapter sharing. Ollama can dedupe base weights when LoRA
adapters are layered against the same base, but cross-tag
deduplication is not always automatic.

**LoRA adapter overhead:** ~30 MB per adapter, regardless of
quantization. Negligible.

### The full Qwen 2.5 family — download + in-memory at 4K context

Numbers below are the **whole runtime footprint** at 4 K context:
model weights + FP16 KV cache + activation buffers. Add ~0.5 GB
for Ollama runtime overhead in any deployment.

| Model | Params | Download (Q4) | Download (Q8) | Download (FP16) | RAM @ Q4 4K | RAM @ Q8 4K | RAM @ FP16 4K |
|---|---|---|---|---|---|---|---|
| Qwen 2.5 **0.5B** | 494 M | 370 MB | 530 MB | 1.0 GB | **0.5 GB** | 0.6 GB | 1.1 GB |
| Qwen 2.5 **1.5B** | 1.5 B | 1.0 GB | 1.6 GB | 3.0 GB | **1.2 GB** | 1.8 GB | 3.2 GB |
| Qwen 2.5 **3B** ★ | 3.1 B | 1.9 GB | 3.2 GB | 6.0 GB | **2.3 GB** | 3.5 GB | 6.3 GB |
| Qwen 2.5 **7B** | 7.6 B | 4.7 GB | 8.1 GB | 15 GB | **5.1 GB** | 8.5 GB | 15.5 GB |
| Qwen 2.5 **14B** | 14.7 B | 9.0 GB | 15.6 GB | 30 GB | **10.1 GB** | 16.7 GB | 31 GB |
| Qwen 2.5 **32B** | 32.5 B | 20 GB | 34.5 GB | 65 GB | **21.6 GB** | 36 GB | 67 GB |
| Qwen 2.5 **72B** | 72.7 B | 43 GB | 77 GB | 145 GB | **45 GB** | 79 GB | 147 GB |

★ = the model we run in production.

### What fits on what hardware

Mapping the Qwen ladder to the Mac Mini SKUs:

| Mini SKU | RAM ceiling | Largest Qwen at Q4 | Largest Qwen at Q8 | Notes |
|---|---|---|---|---|
| M4 / 16 GB | ~10 GB free for models | up to **7B** Q4 (tight) | up to **3B** Q8 | base Mini; headroom marginal |
| M4 / 24 GB | ~18 GB | up to **14B** Q4 | up to **7B** Q8 | comfortable for our pipeline |
| **M4 / 32 GB** | **~26 GB** | **up to 14B Q8** | **up to 14B Q8** | recommended; 14B headroom |
| M4 Pro / 48 GB | ~42 GB | up to **32B** Q4 | up to **14B** Q8 | overkill for next-week roadmap |
| M4 Pro / 64 GB | ~58 GB | up to **32B** Q4 comfortably | up to **32B** Q4 | for 32B experimentation |
| M-series Studio / 192 GB+ | very high | **72B** Q8 | **72B** Q8 | the only realistic 72B-local box |

"~free for models" ≈ unified memory − 6 GB OS/apps headroom.

### Why we sit at 3B

The eval rubric on our domain saturates well below 7B. The
incremental capability between 3B and 7B is mostly visible on
general-purpose benchmarks (math, multi-step reasoning, broad
trivia) — none of which is our workload. Voice register, IACA
discipline, hallmark hedging, listing copy: 3B passes; bigger is
not measurably better.

Going up the ladder also costs:

| 3B → | Memory cost (Q8 4K) | Latency cost | Capability gain on our domain |
|---|---|---|---|
| 7B | +5 GB | ~2× slower | ≤ 10% (not measurable on rubric) |
| 14B | +13 GB | ~4× slower | ~15% (general benchmarks) |
| 32B | +33 GB | ~10× slower | ~20% (still mostly off-domain) |
| 72B | +75 GB | ~30× slower | ~25% (still off-domain) |

For a single-operator Mac-Mini-class deployment, 3B is the
optimum. 0.5B is too small (drops voice invariants). 7B is the
"if you must scale up" step — but we don't have to.

### Quantization configurations

For any Qwen size, the GGUF / Ollama quantization ladder:

| Quant | Bits/param | Quality vs FP16 | When to use |
|---|---|---|---|
| FP16 / BF16 | 16 | reference | only if RAM is plentiful and quality matters absolutely |
| Q8_0 | 8.5 | ≥ 99.5% | high quality preserved; default for sensitive tasks |
| Q6_K | 6.6 | ≥ 99% | barely visible loss; more compact |
| Q5_K_M | 5.7 | ≥ 98% | a sensible middle |
| **Q4_K_M** | 4.8 | ~ 97% | **the popular sweet spot**; default in Ollama |
| Q3_K_M | 3.9 | ~ 95% | aggressive compression; small models suffer more |
| Q2_K | 2.6 | ~ 90% | rarely worth it; quality loss visible |

Our pipeline uses **Q8 for primary generation** (curator-3b,
lacuna-3b) and **Q4_K_M for utility passes** (register-tuner
where speed matters more than fidelity). The AI-judge in Lacuna
Monitoring (Q3+) starts at Q4_K_M on the 0.5B.

### Context length configurations

Qwen 2.5's native context is 32 K tokens. Some sizes support 128 K
via YaRN extension, but at quality cost.

| Context | KV cache for 3B (FP16) | Use case |
|---|---|---|
| 1 K | 36 MB | warm-keep idle |
| 2 K | 72 MB | Ollama default; brief turns |
| 4 K | 145 MB | typical chat exchange |
| 8 K | 290 MB | with RAG context loaded |
| 16 K | 580 MB | long-form drafting |
| 32 K (max native) | 1.16 GB | large documents |
| 128 K (YaRN) | 4.6 GB | research only; quality degraded |

KV cache can be quantized too: Q8 cache halves these numbers; Q4
quarters them. Default is FP16.

Our pipeline uses **8 K context** as the default for cascade L4
turns. The persona prompt + RAG hits + last-4-turns-history fits
comfortably. We bump to 16 K for long-form drafting only.

### Concurrency configurations

Ollama exposes parallelism settings:

| Variable | Effect | Our default |
|---|---|---|
| `OLLAMA_NUM_PARALLEL` | concurrent generations sharing one model | 1 (single operator) |
| `OLLAMA_MAX_LOADED_MODELS` | how many distinct models can be resident | 3 |
| `OLLAMA_KEEP_ALIVE` | how long a model stays warm after last use | 5 m |

Each parallel request allocates its own KV cache. So 4 concurrent
3B chats at 4 K context = 4 × 145 MB = 580 MB extra over the base
single-user case.

For a single-operator dev box / staging Mini, parallelism stays at
1. When we ship multi-tenant (Phase 4+) we re-tune.

### Summary lock-in for the documented pipeline

| Component | Model | Quant | Context | KV cache | Resident RAM |
|---|---|---|---|---|---|
| Cascade L4 (curator-3b) | Qwen 2.5 3B + LoRA | Q8_0 | 8 K | FP16 | ~3.7 GB |
| Register-tuner | Qwen 2.5 3B (base, no LoRA) | Q4_K_M | 4 K | Q8 | ~2.2 GB |
| Lacuna LLM `/argue` (Phase 4) | Qwen 2.5 3B + LoRA | Q8_0 | 8 K | FP16 | ~3.7 GB (shares base) |
| AI-judge (Q3) | Qwen 2.5 0.5B | Q4_K_M | 16 K | Q8 | ~0.6 GB |

The base Qwen 2.5 3B file is shared across curator-3b,
register-tuner-base, and lacuna-3b via Ollama's adapter-on-base
pattern — one model file on disk, one resident copy in RAM, three
LoRA-or-prompt variants.

### What this means for SKU choice

**16 GB Mini** comfortably fits:
- Q4 3B at 4 K context (steady state), plus nomic + SigLIP + dev
- 8.6 GB resident; 7.4 GB free for browser, IDE, OS slack
- Cannot run experiments: no 7B; no concurrent 3B instances; long
  context (>16 K) starts to swap

**24 GB Mini** comfortably fits:
- Q8 3B at 4 K context, plus nomic + SigLIP + dev
- 11 GB resident; 13 GB free
- Can do mild experiments (one extra small model side-by-side;
  long-context drafting)

**32 GB Mini** comfortably fits:
- Q8 3B at 16-32 K context, plus a side-by-side 7B experiment,
  plus nomic + SigLIP + multiple Ollama instances
- 19 GB resident at heaviest realistic dev-box workload
- 13 GB free for everything else
- This is the *dev-box for a while* tier

The 32 GB recommendation is exactly the line that keeps
"experiment with a 7B model side-by-side" from forcing a hardware
upgrade.

## Memory math

Worst-case "everything resident at once" footprint on the staging
Mac Mini:

| Component | Resident RAM |
|---|---|
| macOS + browser + IDE | 5.0 GB |
| Ollama runtime | 0.5 GB |
| Qwen 2.5 3B (Q8, base) | 3.5 GB |
| LoRA adapters (curator-3b, lacuna-3b later) | 0.1 GB |
| nomic-embed-text | 0.3 GB |
| SigLIP ViT-L/16 + heads | 0.5 GB |
| Inference activation buffers (peak across all) | 2.0 GB |
| `lacunad` daemon + dashboard browser tab | 0.2 GB |
| Curator API + DB + frontend dev | 1.0 GB |
| **Total worst-case** | **~13 GB** |

If we drop Qwen to Q4 (some quality loss, mostly invisible on our
domain): **~12 GB worst-case.**

## Hardware recommendation

### The two dimensions that actually matter

For LLM inference on Apple Silicon, two specs dominate. Everything
else is secondary.

**1. Unified memory size.** Determines what models can be resident
simultaneously. Models can't be efficiently swapped between RAM and
SSD during inference; if they don't fit, you don't run them.

**2. Memory bandwidth.** Determines token generation speed. LLM
inference is memory-bound — every generated token reads the entire
model's weights. Token rate scales near-linearly with bandwidth.

| Chip | Bandwidth | Qwen 3B Q8 inference (approx) |
|---|---|---|
| M1 base | 68 GB/s | ~25 t/s |
| M2 base | 100 GB/s | ~35 t/s |
| M3 base | 100 GB/s | ~35 t/s |
| **M4 base** | **120 GB/s** | **~42 t/s** |
| M2 Pro | 200 GB/s | ~65 t/s |
| **M4 Pro** | **273 GB/s** | **~90 t/s** |
| M2 Max | 400 GB/s | ~110 t/s |
| M4 Max | 410-546 GB/s | ~120-160 t/s |

Numbers are approximations from published benchmarks; real-world
varies with prompt length, context size, batch.

### Mac Mini SKUs available

| SKU | Memory options | Bandwidth | Approx price |
|---|---|---|---|
| M1 Mac Mini (2020) | 8 / 16 | 68 GB/s | $400-500 used |
| M2 Mac Mini (2023) | 8 / 16 / 24 | 100 GB/s | $500-700 used |
| M2 Pro Mac Mini (2023) | 16 / 32 | 200 GB/s | $800-1000 used |
| **M4 Mac Mini (2024)** | **16 / 24 / 32** | **120 GB/s** | **$599 / $799 / ~$999** |
| **M4 Pro Mac Mini (2024)** | **24 / 48 / 64** | **273 GB/s** | **$1399 / $1799 / +** |

**Key facts:**
- The M1 Mac Mini caps at 16 GB. There is no "32 GB M1 Mac Mini."
- The M2 Pro is the older option that shipped with 32 GB.
- The M4 base shipped with up to 32 GB (a step up from M2/M3 base).
- The M4 redesigned the chassis — physically half the footprint
  (5 × 5 × 2 inches vs. 7.7 × 7.7 × 1.4 inches), 0.7 kg vs 1.2 kg.

### Deciding between the candidates

For a *dev box for a while + no local training*, three real
candidates:

#### A. Mac Mini M4 base, 24 GB — $799

- 24 GB > 13 GB worst-case; comfortable headroom
- 120 GB/s; ~42 t/s on Qwen 3B Q8
- Cheapest comfortable option
- Smallest, newest, fanless

#### B. Mac Mini M4 base, 32 GB — ~$999

- 32 GB; substantial headroom for everything + future experiments
  with 7B models, multiple Ollama instances, more browser tabs
- Same 120 GB/s bandwidth as 24 GB
- $200 premium over (A) buys 8 GB headroom, no token-rate change
- Same chassis, same fanless design

#### C. Mac Mini M4 Pro, 24 GB — $1399

- 24 GB; same memory size as (A)
- 273 GB/s; **2.3× the inference throughput** (~90 t/s vs ~42 t/s)
- $600 premium over (A) buys speed, not RAM
- Slight fan noise under load (M4 Pro has active cooling)

#### D. Used Mac Mini M2 Pro, 32 GB — ~$800-900 refurb

- 32 GB
- 200 GB/s (~65 t/s; between M4 base and M4 Pro)
- Older chip; worse single-thread CPU; older Neural Engine
- Larger, older chassis with fan
- Used / refurb means no Apple warranty unless certified
- Compelling on price; questionable on longevity

### What I'd actually buy

**Mac Mini M4 base, 32 GB unified, 512 GB SSD — ~$999.**

For Alfred's stated requirements (dev box for a while + no local
training), this is the right pick:

- **32 GB > 13 GB worst-case + room for 7B-model experiments.**
  The dev box use case will tempt you into experiments — running a
  7B model side-by-side with a 3B, opening 30 browser tabs,
  spinning up a second `lacunad` to test cluster comms. 24 GB is
  fine for the documented pipeline; 32 GB is fine for
  documented-pipeline + headroom-for-curiosity.
- **Token rate is sufficient.** ~42 t/s on Qwen 3B Q8 is faster
  than typical operator typing. Speed isn't the bottleneck on a
  dev box.
- **Newest hardware = longest useful life.** M4's CPU + GPU + ANE
  are 2-4 generations newer than M2 Pro's. For a dev box "for a
  while," start fresh.
- **Smaller physical footprint.** The M4 chassis is 5 × 5 × 2
  inches, 0.7 kg. Slips into any setup without rearrangement.
- **Fanless.** Silent dev environment.
- **Apple warranty.** AppleCare optional if you want it.

If the 32 GB M4 isn't available in your region or the price has
shifted, the **24 GB M4 at $799** is a solid drop-down. The 8 GB
delta only matters when you start running experiments beyond the
documented pipeline.

### What I'd NOT buy for this purpose

- **M1 Mac Mini, any config.** Capped at 16 GB; bandwidth limited;
  4 chip generations old. You'd be locked at the floor of our
  workload, no growth room.
- **M4 Pro 24 GB ($1399).** Pays $600 for speed you won't notice
  on a dev box. Speed matters when you're serving operators at
  scale; not when you're iterating one turn at a time.
- **M4 Pro 48 GB ($1799+).** Truly over-spec for the pragmatic
  roadmap through Q3. Buy this when we ship to multiple operators
  simultaneously, not before.
- **Mac Mini M4 16 GB.** Tight. Will swap. Will force Q4 quant.
  Works for demos; doesn't work as a "dev box for a while" with
  experiment headroom.

### Physical size of the recommended SKU

- **5.0 × 5.0 × 2.0 inches (127 × 127 × 50 mm)**
- **0.7 kg (1.5 lb)**
- USB-C / Thunderbolt 4 (front + rear), HDMI, Ethernet
- Fanless under typical dev workload
- Sits on or under a desk; ships in a box smaller than a hardback
  book

## What this is NOT

This document is *next week's pragmatic answer*. It deliberately
excludes:

- **Multi-machine fabrics** (Phase 5+; cluster comms; daemon-to-
  daemon)
- **Per-tenant isolation** (Phase 4+; multi-operator staging)
- **Self-healing topologies** (Phase 5+; the AI-judge can act on
  alerts)
- **Cascading failure recovery** (the "L7+" research area that
  Alfred explicitly punted)
- **Training compute** (rented; Modal / RunPod; not on the Mini)
- **Image processing pipelines beyond identification** (the Mini
  doesn't render or transform images at scale; the operator's main
  workstation handles that)

For each of those, see the corresponding research / roadmap doc.

## Decision sought

**Confirm Mac Mini M4 24 GB as the staging SKU.**

If confirmed, Kwame procures and racks; staging deployment proceeds
on it whenever the box arrives. Code-complete-on-laptop is a fine
holding state until the Mini lands.

If not confirmed, name the alternative and we re-size accordingly.

## Roadmap (the pragmatic version)

| When | What | Local-RAM impact |
|---|---|---|
| **This week** | Curator runs at v2.2.7 on dev:3000; cascade emits LMTP to lacunad | none |
| **Mac Mini lands** | Migrate staging from laptop to Mini | establishes baseline |
| **Next week** | Sakura LLM v0.1 trained (off-box, Modal); deployed to Mini | +0.5 GB |
| **2 weeks** | curator-3b LoRA shipped; replaces base Qwen for L4 | swap, no RAM change |
| **3 weeks** | Lacuna LLM dialectical adapter shipped (separate Ollama tag) | +0.1 GB (LoRA only) |
| **Q3** | AI-judge slot filled (likely Qwen 3B reuse, no new base) | +0 GB if reusing base |
| **Q4+** | Multi-machine fabric, lacunad cluster, etc. | new sizing decision |

Memory ceiling stays under 14 GB through Q3. The 24 GB Mini is
right-sized for the entire pragmatic roadmap. No "bigger is better"
RAM panic-buying.

```
# EOF DEPLOYMENT-SIZING-v0.1
```

---

# §PROBES — Probe Registry (folded from meridian/specs/probe-registry.md)

slug: probe-registry
title: Probe registry
category: spec
kind: interface
version: 1.0.0
canonical: true
owner: meridian
status: draft
last-reviewed: 2026-07-09
extracted-from: THE-PLAN.md · Chapter 4 §4.9
---

# Probe registry

## Purpose

The schema for freshness probes — scheduled checks that emit an event when the world (not a git commit) causes something to drift. Meridian owns the probe run-loop and the registry format.

## Scope

**In:** the `.lacuna/freshness.yaml` schema; probe execution semantics; alert paths; enumeration guidance.

**Out:** the individual probe scripts (each lives in the owning project's `scripts/probes/`); the Meridian internal scheduler.

## Definitions

- **Probe** — a script that exits 0 (green) or non-zero (fire) and prints a slat event to stdout.
- **Freshness registry** — `.lacuna/freshness.yaml` in each project.
- **Cadence** — the interval at which a probe runs (e.g. `15m`).
- **Threshold** — the split between `warn` and `alert` levels.

## Normative content

### Registry file

```yaml
- id: shop-inventory-fresh
  probe: ./scripts/probes/shop-inventory-age.sh
  interval: 15m
  threshold:
    warn:  { rows-older-than: 6h,  percent: 5 }
    alert: { rows-older-than: 24h, percent: 1 }
  on-warn: notify:sre-channel
  on-alert: [notify:sre-channel, open-issue:in-stock-freshness]
  ttl: 90d
```

Fields:

| Field | Type | Notes |
|---|---|---|
| `id` | string | Unique per repo. |
| `probe` | path | Relative path to the check script. |
| `interval` | duration | `15m`, `1h`, `24h`, etc. |
| `threshold` | mapping | Domain-specific keys; `warn` and `alert` levels. |
| `on-warn` | string or list | Alert path (see below). |
| `on-alert` | string or list | Alert path. |
| `ttl` | duration | How long a probe can go without a green tick before it opens a "probe stale" issue. |

### Probe execution

Where probes run: `freshness-probes.yml` (GitHub Actions cron) + optionally an edge worker for sub-minute cadence. Edge worker POSTs status back to a repo Pages endpoint that `freshness-probes.yml` reads on its next run.

Every probe MUST emit a slat probe-tick record on completion (green or fire) to Meridian's log directory:

```
(probe-tick :probe "shop-inventory-fresh" :ok #t :ts "2026-07-09T22:00:00Z" :rows-older-than-6h-pct 2.1)
```

See [`../../lacuna-labs/research/lacuna-docs/specs/SLAT-1.0.SPEC.md`](../../../../lacuna-labs/research/lacuna-docs/specs/SLAT-1.0.SPEC.md) §4.1 for the canonical `probe-tick` shape (SLAT record taxonomy) and §5.1 for the `.slatl` framing that probe-tick streams use. The old `slat-format.md` is superseded by SLAT 1.0.

### Alert paths

Two destinations only:

- `notify:<channel>` — a message. No page. Weekly digest to the SRE lead.
- `page:sre-oncall` — real page. Reserved for probes where a human must act within an hour.

Between them: `open-issue:<template>` — creates a GitHub issue from a template, assigned by CODEOWNERS. This is where most alerts belong: durable, discussable, closeable.

Slack drops on the floor. Issues do not. There is no global "page for everything" — every probe declares its own escalation.

### First-cut enumeration

`shop-inventory-fresh`, `shop-price-fresh`, `easypost-signup-healthy`, `shippo-signup-healthy`, `taxjar-signup-healthy`, `cloudinary-signup-healthy`, `vies-signup-healthy`, `gsc-signup-healthy`, `bing-signup-healthy`, `cart-run-telemetry-arriving`, `marketplace-heartbeat-*` (per configured marketplace), `sakura-4b-checkpoint-load`, `loam-plane-health`, `cortex-ambient-context-fresh`.

## Non-normative examples

See [`../../lacuna-docs/engineering/THE-PLAN.md`](../../lacuna-docs/engineering/THE-PLAN.md) §4.9 for the philosophy and enumeration rationale.

## Compatibility and versioning

- **Additive:** new probe fields, new alert paths.
- **Breaking:** changing the file location, changing the probe-tick shape.

## See also

- [`./alert-routing.md`](./alert-routing.md) — how alerts get sent.
- [`../../lacuna-docs/specs/trigger-system.md`](../../lacuna-docs/specs/trigger-system.md) — sibling trigger surface.
- [`../../lacuna-labs/research/lacuna-docs/specs/SLAT-1.0.SPEC.md`](../../../../lacuna-labs/research/lacuna-docs/specs/SLAT-1.0.SPEC.md) — canonical wire form for probe-ticks (supersedes the historical `slat-format.md`).

---

# §ALERTS — Alert Routing (folded from meridian/specs/alert-routing.md)

slug: alert-routing
title: Alert routing
category: spec
kind: interface
version: 1.0.0
canonical: true
owner: meridian
status: draft
last-reviewed: 2026-07-09
extracted-from: THE-PLAN.md · Chapter 4 §4.9
---

# Alert routing

## Purpose

The three alert paths Meridian supports and the rules for which fires produce which path. No pager fatigue; no dropped alerts.

## Scope

**In:** the three alert paths (`notify`, `page`, `open-issue`); the rules that decide which fires produce which path; retry and escalation semantics.

**Out:** the specific pager service (that's a config, not a spec); the individual issue templates (those live under `.github/ISSUE_TEMPLATE/`).

## Definitions

- **Notify** — a message to a channel. No page. Aggregated into a weekly digest.
- **Page** — real page. Wakes a human. Reserved for the "must act within one hour" tier.
- **Open-issue** — creates a GitHub issue from a named template, assigned by CODEOWNERS.
- **Fire** — a probe or trigger emitting a non-green state that MAY produce an alert.

## Normative content

### The three paths

| Path | Latency | Human action expected | Aggregation |
|---|---|---|---|
| `notify:<channel>` | seconds | Read at leisure. | Weekly digest to SRE lead. |
| `page:sre-oncall` | seconds | Act within 1 h. | None — every page is individual. |
| `open-issue:<template>` | minutes | Discuss, close eventually. | None — issues are durable. |

### Which fires go to which path

- `notify` — informational fires. "Marketplace X is throttling us but we're still under quota."
- `page` — action-within-an-hour fires. "sakura-4b checkpoint fails to load", "production endpoint returning 5xx > 5%".
- `open-issue` — everything else. Durable, discussable, closeable.

**Rule.** Every probe and every trigger declares its own alert path in `.lacuna/freshness.yaml` or `.lacuna/triggers.yaml`. There is no global "page for everything." That way lies alert fatigue.

### Compound paths

A single fire MAY produce multiple paths:

```yaml
on-alert: [notify:sre-channel, open-issue:in-stock-freshness]
```

The paths run in the order listed. If any path throws an error, the remaining paths still execute — routing is best-effort per-destination.

### Retries

Meridian retries a `page` up to 3 times, 30-second backoff. `notify` retries once. `open-issue` retries up to 5 times, exponential backoff — issue creation MUST NOT be lost.

### Escalation

If a `page` is not acknowledged within 15 minutes, Meridian escalates to a second channel (declared per-probe or per-project). No further escalation past that layer — the design assumption is a small team.

## Non-normative examples

See [`../../lacuna-docs/engineering/THE-PLAN.md`](../../lacuna-docs/engineering/THE-PLAN.md) §4.9 for narrative and rationale.

## Compatibility and versioning

- **Additive:** new templates, new channels.
- **Breaking:** removing a path, changing retry semantics.

## See also

- [`./probe-registry.md`](./probe-registry.md) — where alerts originate.
- [`../../lacuna-docs/specs/enforcement-ladder.md`](../../lacuna-docs/specs/enforcement-ladder.md) — the CI layer feeds fires too.

---

# §GAPS — Telemetry Gaps (folded from doc-expansion-staging/telemetry-gaps.md)


Marcus's SRE attestation (docs/SRE-ATTESTATION-2026-07-02.md, filed 2026-07-02) identified five material gaps between this document's specifications and the running system's actual wiring as of that date. Each gap is listed below with its blocker and living marker.

| Gap | Spec says | Reality | Unblocks |
|-----|-----------|---------|----------|
| **Percentile naming drift** | p90 (multiple metric allow-list entries) | p95 (all emitted telemetry) | Standardize on p95 across allow-list and this doc |
| **Latency capture unwired** | Per-verb, per-cart, per-wire-call latency percentiles are metric-allowed | No emit sites; allow-list only | Wire latency capture at cart host |
| **Event spine not fed by prod** | `event_spine.py:emit()` fed by all cart runs | Only `hit_rate.py` + migration script call it | Wire prod cart host → event spine |
| **Alerting pipeline dark** | Alert logic in `lacuna_14b.py:180–253` + `lacuna_sre/alerting.py` | Logic exists; no daemon/poller instantiates or runs it at runtime | Attach daemon/poller; wire cost-cap webhook as template |
| **`loam-health.sh` absent** | Referenced as tools/ utility in §6 | Does not exist | Author stub under `tools/` |

---

**Percentile naming (p90 vs p95):**

The emitted telemetry uniformly reports p95 latencies. This document and the metric allow-list should be standardized to match.

<!-- LIVING:TODO(2026-07-06): standardize p90→p95 across telemetry doc and metric allow-list -->

---

**Latency percentile capture:**

Per-verb, per-cart, and per-wire-call latency percentile metrics are white-listed in the allow-list (§9) but have no corresponding emit sites in the cart host. *[needs: emit-site wiring at the cart host]*

<!-- LIVING:TODO(2026-07-06): wire latency percentile emission from cart host -->

---

**Event spine not fed by prod:**

The `event_spine.py:emit()` function exists but is called only from `hit_rate.py` and a data-migration script. Production cart host runs do not feed the event spine. *[needs: wire cart host → event spine]*

<!-- LIVING:TODO(2026-07-06): wire prod cart host to event spine emitter -->

---

**Alerting pipeline dark:**

Alert logic is implemented in `lacuna_14b.py:180–253` and `lacuna_sre/alerting.py` but has no runtime daemon or poller attached. The only live alert in production is the cost-cap webhook. *[needs: daemon/poller attachment]*

<!-- LIVING:TODO(2026-07-06): instantiate alerting daemon and wire to alert logic -->

---

**`loam-health.sh` stub:**

§6 references `tools/loam-health.sh` as a diagnostic utility. The file does not yet exist. *[needs: author stub under `tools/`]*

<!-- LIVING:TODO(2026-07-06): author tools/loam-health.sh stub -->

---

# §SLAT — Telemetry on the SLAT wire (added 2026-07-12)

> Cross-refs: `~/code/lacuna-labs/research/lacuna-docs/specs/SLAT-1.0.SPEC.md`, `LOAM-1.0.ENG.md §SLAT`, `CORTEX-1.0.ENG.md §SLAT`. Task #62 landed the ENG-tree surface pass; this section threads SLAT through the cart lifecycle events, cost ledger, wire-call observability, and probe surface. Additive to §1-§11 above and §PROBES + §ALERTS folded sections; no deletes. **Marcus reviews this section.**

## §SLAT.1 — Doctrine

Telemetry records what happens. Every record has a time, a subject, a kind, and payload. SLAT is the wire form. The load-bearing property: every record produced by the telemetry pipeline can be read by any downstream consumer with the same reader, without a translator.

The cross-binding stability (SLAT §9.4) is what makes cross-service telemetry composable. Cart-side JS emits an `event` slat; the Python-side Loam ingest reads the same bytes; the SRE dashboard's Python-side aggregator sees the same value; the operator's front-end reads it back on the way to render. Same reader, four steps.

## §SLAT.2 — cartBus events as `event` slats

`§1.1 The cartBus event taxonomy` enumerates the events. Each becomes an `event` slat (SLAT §4.1 row 2):

```slat
(event
  :ts        #inst "2026-07-12T04:22:00Z"
  :kind      "cart.gate.enter"
  :cart-id   'etsy-listing-draft
  :cart-tier 'pink
  :operator  "operator/op-042"
  :trace-id  "tr-a4f9c2"
  :duration-ms 12)
```

The taxonomy names (`cart.gate.enter`, `cart.step.enter`, `cart.step.done`, `cart.error`, `cart.done`) are `:kind` values. Downstream projections match on `:kind` lexically. The taxonomy is stable; adding a kind is additive per §1.2 sequence + timestamp guarantees.

## §SLAT.3 — Cost row schema as `record` slats

`§2.2 The cost row schema` names the persisted shape. In SLAT terms it is a `record` slat with reserved keys:

```slat
(record
  :kind          'cost-row
  :ts            #inst "2026-07-12T04:22:00Z"
  :vendor        'anthropic
  :verb          'sakura/reason
  :operator      "operator/op-042"
  :cart-id       'etsy-listing-draft
  :trace-id      "tr-a4f9c2"
  :input-tokens  1240
  :output-tokens 380
  :cost-cents    12.4M
  :cache-hit     #t)
```

`:cost-cents` uses `bigdecimal` (SLAT §3.3). Money is not a vector. Two identical cost rows produce identical canonical bytes (SLAT §6.1) — the cost-ledger deduplicator uses the content-id (SLAT §5.4) as the primary key.

## §SLAT.4 — Loam plane rows are slats

`§2.4 The Loam plane: system/cost-ledger` describes the plane. In wire form, the plane is a `.slatl` stream (SLAT §5.1) of the cost-row slats above. LOAM §SLAT.2 walks the projection-authoring pattern; every projection matches on head + keywords.

`§6.2 The SYSTEM plane row table` is one row per event, one line per row. The auto-assembly registry (SLAT §7) rehydrates each row to a native `SystemRow` object when the consumer registers a builder.

## §SLAT.5 — Wire-call counters + latency as `event` slats

`§4.1 The per-wire-call counters` maintains counters keyed on `(verb, tier, operator)`. Every increment produces an event slat:

```slat
(event
  :ts       #inst "2026-07-12T04:22:00Z"
  :kind     "wire.call.done"
  :verb     'etsy/listing-update
  :vendor   'etsy
  :operator "operator/op-042"
  :latency-ms 340
  :status   'ok
  :size-in-bytes  1240
  :size-out-bytes 380)
```

`§4.2 The latency capture pattern` shows the Python code; every capture emits one slat. `§4.3 The rate-limit envelope` produces a rate-limit `record` slat matching LACUNA-INTEGRATION §SLAT.5 exactly — one shape across the two docs.

## §SLAT.6 — Probe-tick canonical form

§PROBES §7.5 (folded above) shows the shape; SLAT §4.1 makes it the `probe-tick` registry row. The full shape:

```slat
(probe-tick
  :probe    "shop-inventory-fresh"
  :ok       #t
  :ts       #inst "2026-07-12T04:22:00Z"
  :duration-ms 45
  :context  (:rows-older-than-6h-pct 2.1M))
```

Probe-ticks land on `~/.lacuna/meridian/probe-ticks.slatl`. Loam ingest computes per-probe green/fire rates; the SRE dashboard reads the same slatl on the way to rendering the probe grid.

## §SLAT.7 — Cross-binding stability

`§2.3 The tier → rollup translation` runs in Python. `§4.2 The latency capture pattern` runs in JS on the cart side. `§7 SRE dashboards` reads both from Loam. The cross-binding contract (SLAT §9.4) means every consumer parses the same bytes to the same value.

This is what closes the observability spine. Without it, tier translation lives in Python, cart latency lives in JS, dashboards read either and hope for the best. With SLAT canonical form, all three see the same records.

## §SLAT.8 — Backward compat

Old telemetry paths that emit JSON continue to work — the ingest tries SLAT first, JSON second (SLAT §10.4 migration timeline). A deprecation warning fires on JSON reads so the migration completes.

The tools/loam-health.sh diagnostic (open in §GAPS above) will emit slat probe-ticks once authored — new tooling ships SLAT-native.

## §SLAT.9 — Cross-references

- SLAT primitives — `SLAT-1.0.SPEC.md §3`
- `event`, `record`, `probe-tick` registry rows — `SLAT-1.0.SPEC.md §4.1`
- Line-delimited `.slatl` framing — `SLAT-1.0.SPEC.md §5.1`
- Content-id + Merkle attestation — `SLAT-1.0.SPEC.md §5.4, §6.7`
- Cross-binding stability — `SLAT-1.0.SPEC.md §9.4`
- Migration timeline — `SLAT-1.0.SPEC.md §10.4`
- Loam ingest + projections — `LOAM-1.0.ENG.md §SLAT`
- Cortex event bus — `CORTEX-1.0.ENG.md §SLAT.4`
- Vendor rate-limit envelope — `LACUNA-INTEGRATION-1.0.ENG.md §SLAT.5`
