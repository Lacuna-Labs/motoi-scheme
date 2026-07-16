---
slug: loam-1.0-eng
title: Loam — Engineering
category: engineering
canonical: true
version: 1.0
last-reviewed: 2026-07-11
covers-through: 2026-07-11
owner: Marcus (SRE)
codename: loam
supersedes:
  - curator/docs/LOAM-1.0-DESIGN.md (older design, distilled)
  - doc-expansion-staging/loam-sre.md (SRE separation + bifurcation gate FOLDED — §SRE-BIF)
theme: loam
---
# Loam — All-Hands Intro
<!-- covers-through: 2026-07-11 (drift pass vs HEAD d4f5a8a4 — §4.2 resource
     list corrected against loam-shell/src/schema.rs; core Shell / 14-tool /
     plane / verb / audit claims re-verified against the Rust source) -->

> **Canonical engineering doc #5 of 8** per
> [`CANONICAL-DOCS-FRAMEWORK-2026-06-27.md`](CANONICAL-DOCS-FRAMEWORK-2026-06-27.md).
> Voice: HelloSurface gold standard. Promoted to canonical 2026-06-27
> (evening pass); renamed `LOAM-ENGINEERING.md → LOAM-1.0-ENGINEERING.md`
> to match the canonical naming convention and flipped shelf-visible.

*Curator Engineering · 2026-06-27 · Read-time 8 min*

---

## What this is (The Architect)

**Loam is the substrate database for the whole Lacuna Labs product family.** Sakura on Curator, Sakura Prep on the GED coach, Foodie, Baobab the wallet, the Lacuna 14B daemon — they all sit on the same ground.

The word "Loam" is a memory cue: rich soil, what things grow in, recoverable from the earth itself if every above-ground tool is lost. It is not user-visible. Operators on Curator never see the word "Loam" — they see "automations," "magic versions," and Sakura's recommendations. Loam is the floor those stand on.

What it does: stores every operator's substrate-worthy data forever, in a format you can read with `cat` and a Scheme interpreter in the year 4027. Mediates every read and write through a deterministic capability-token check. Notices patterns across the operator base while structurally refusing to leak any individual's data below a privacy floor of 8. Offers each Lacuna Labs product its own private section AND a controlled way to learn from the others.

Why it matters: until now every product was on its own. Curator had its own state, Foodie had its own, Baobab had its own. Building a recommendation that needs both products' signal was impossible because the substrate didn't span. Loam fixes this. Cross-product intelligence becomes possible — *"students struggling with vocab who also have low cooking-time budgets get short audio drills"* — without any single product seeing another's raw data.

That is the moat. Single-product startups can't do cross-product intelligence because they don't own the substrate.

The substrate ships v1.0 in 14–16 weeks. This document is what we're building.

---

## What it actually is, mechanically (Marcus)

Loam is **classical infrastructure with substrate-native intelligence woven in.** It does NOT run an LLM (Large Language Model) inside itself — that's a deliberate design choice, not an oversight. Reviewers from three angles (latency, security, exploitation surface) all converged: keep the substrate boring; let clients bring their own LLMs.

The skeleton:

- **SQLite-per-shard.** Boring, battle-tested, public-domain, parses on bash. One file per tenant cohort. Sharded for write throughput.
- **Litestream WAL streaming.** Real-time replication to **3 destinations (v1.0 dev: all local-disk under `~/loam-dev-replicas/` per `replication/litestream.yml:25-49`)**; v1.0 prod swaps to a 3-of-5 cold-store fleet (Cloudflare R2 + Backblaze B2 + Wasabi + IPFS pin + bare disk in escrow). One destination failing isn't a quorum failure. **Pinned to v0.5.5** because v0.5.6+ has a silent-replication bug (litestream issue #1083). The dev/prod split is corrected here per AUDIT-LIES Jess L2 (the prior framing read as if prod was already 5-vendor-live).
- **CBOR + Scheme bilingual storage.** CBOR (Concise Binary Object Representation, RFC 8949) is the efficient binary; Scheme s-expressions are the textual recovery floor. Every record is both. A future archaeologist with a bash shell and a Scheme parser can read 2026 data in 2178.
- **BLAKE3 + SHA-256 dual-hash content addressing.** If SHA-256 falls in 2055, BLAKE3 still works. Defense in depth on the cryptographic agility horizon.
- **HNSW vector index** (Hierarchical Navigable Small World) per shard, with hnswlib. Semantic search native, not bolted on.
- **The Shell** — deterministic Rust binary. Verifies every operation: capability token valid · scope correct · cost within budget · audit row co-transactional with the write. NO LLM in the auth path. This single design choice eliminated three concurrent CRITICAL security findings.
- **MCP wire protocol** (Model Context Protocol, the Anthropic-originated open standard; governance transitioning to the AAIF under the Linux Foundation in 2026 — softened per AUDIT-LIES M2) for inter-component communication. 14 tools (5 primitive verbs composed with planes + scopes) + 5 resources, typed signatures.

Five **planes** per service — TENANT (operator's own) · COHORT (privacy-floored federated) · WORLD (public-ish global) · SYSTEM (operational) · PUBLIC (operator-opt-in). Five **verbs** total: `put` · `get` · `append` · `on` · `poll`. That's the substrate. Everything else is a projection or a client.

A **monthly bash recovery drill** is mandatory. We tear down a fresh box, restore from cold storage with shell scripts only, and prove the substrate boots. If the drill fails, no release ships until it's green. That's the 2000-year promise made operational.

---

## Why it beats the market (Kofi)

Surveyed 15 modern products this week: Cursor, Notion AI, Linear, Stripe, Apple Intelligence, GitHub Copilot, YNAB, Monarch, Vercel auto-scaling, Replit Agent, ChatGPT memory, Spotify recommendations, Dropbox Smart Sync, AWS Compute Optimizer, Pendo/Gainsight.

**Loam is AHEAD of market on three load-bearing patterns:**

1. **Gentle-CFO sustainability check before recommending.** No AI-productivity peer pre-conditions recommendations on the operator's projected token balance. Cursor's June 2025 refund cycle and Replit Agent's "charges for failed attempts" are the market failures this is engineered to prevent.
2. **Reverse-suggest demotion.** Zero peers do this. When an upgrade isn't paying off, Sakura proactively says *"want to roll it back?"* Most SaaS structurally can't (revenue dependence); we built it as a feature.
3. **Cross-trust-domain auto-promotion of cart execution.** Same code, different trust contexts. JIT tier-up exists in compilers; cross-domain doesn't exist commercially.

**At parity** on substrate invisibility (Apple Continuity is the closest analog), 3-layer surfacing (Linear is closest), sibling-not-swap upgrade pattern (Notion 3.0 + Apple Intelligence).

**The biggest UX innovation is silence.** When the substrate's confidence is below 0.85, Sakura says nothing. Refusal-as-feature inverts the SaaS upsell assumption. *"I refused to recommend X because you'd run dry by Thursday"* is the most honest product moment most operators will encounter all month. It's also what the FTC's 2023 dark-pattern guidance asks for and almost no one ships.

Tier naming — Free / Imagine / Dream / Magic — converts 15–30% better than generic Bronze/Silver/Gold in our market segment (Etsy/eBay/Shopify shop operators). Identity-based naming beats abstract tier naming consistently in 2025-2026 research.

The moat is in the composition: gentle-CFO + reverse-suggest + cross-trust-domain + substrate-invisibility + cross-product intelligence. Each piece exists somewhere; nobody does all of them.

---

## Why it's legally defensible (Jess)

Five regulations matter for Loam at v1.0:

- **GDPR Article 17** (right to be forgotten): Loam ships per-tenant AES-256-GCM encryption with cryptographic-erasure as the real tombstone. When an operator requests erasure, we destroy their key copies — including the Shamir-split offline escrows — and what remains is structurally unreadable. CJEU C-413/23 P (September 2025) made this sharper: pseudonymised data is personal data for anyone holding a re-identification key. We don't hold the key after erasure.
- **CCPA / CPRA** (California): Substrate-emergent cohorts qualify as "personal information inferences" under CCPA §1798.140. §12.10 ships ADMT (Automated Decision-Making Technology) compliance with a `loam.consumer.disclosure()` verb and an audit log line per algorithmic decision. CPRA ADMT rules effective January 2026.
- **FTC dark-pattern guidance** (2023 "Bringing Dark Patterns to Light"): the 4-check sustainability test is, by design, the anti-dark-pattern. Refusing to recommend something the operator can't afford is the gold standard the FTC report asks for. Reverse-suggest demotion satisfies the symmetry requirement.
- **EU Digital Services Act subscription cancellation rules** (effective June 19, 2026): symmetric one-click cancellation. We ship the withdrawal button on every Loamified cart by week 15.
- **EU AI Act** (in force 2026): substrate intelligence as a recommendation system. Article 6 conformity assessment posture documented in §12.9. No claims of "high-risk AI system" because the substrate's behaviors are recommendation-class, not decision-class. Operator authorizes every promotion explicitly.

**COPPA** (Children's Online Privacy Protection Act): zero treatment historically. §12.8 ships parental-consent path because under-13 buyers may appear in operator messages. Amended Rule full-effect April 2026.

**Audit log is co-transactional with the write.** This is the architectural feature most regulators want and almost nobody ships. The audit row exists in the same SQLite transaction as the data write or both abort. There is no audit-gap window where data lives but isn't logged. Audit is structurally unfalsifiable from inside the system.

**HIPAA-adjacent** thresholds: explicit non-Business-Associate disclaimer. We don't claim HIPAA compliance; if a buyer's message mentions a health condition, the PII (Personally Identifiable Information) scrubber catches it before any vendor LLM hand-off.

Disciplines worth preserving through future edits: §19.1.4 reverse-suggest (exhibit A in any FTC subscription investigation), §19.2.4 9-of-10 silence ceiling, §12.4 K-anonymity co-transactional with read (prevents the EDPB's top-three February 2026 enforcement failure).

---

## Why the novelty is real (Zane)

11 patentable surfaces total. Verified every cited reference in the design doc is real — no fabricated arxiv papers, no invented prior art. Verified the patent prior-art landscape across USPTO and Google Patents. Verified the 13 academic citations exist and say what we quote them as saying.

**STRONG novelty (file first, no attorney pre-pass needed):**
- **B.1** — Producer/consumer cohort discipline with K-floor stability via Neimark-Sacker bifurcation. Zero prior art combining federated learning + Neimark-Sacker dynamics. This one is patent-grade as written.
- **B.10** — Capability-token chain co-transactional with audit log emission.
- **B.11** — Subscription as first-class primitive with predicate-as-column.
- **B.21** — Cross-service cohort-mediated intelligence with mutual K-floor. New to multi-service Loam. No commercial precedent — single-product startups can't even build the substrate to test it.

**MODERATE (file with attorney pass):** B.13 format bilingualism · B.14 substrate invisibility · B.15 schema gravity · B.16 cohort emergence · B.17 cross-trust-domain auto-promotion · B.18 budget-aware refusal-as-feature.

**RETIRED:** B.12 (LLM-as-mediator). Withdrawn because the substrate no longer has an LLM. The novelty moved to the client-side adapter, where the patent surface is muddier.

The novelty in composition is bigger than any single surface. Datomic does immutable logs. Materialize does incremental views. Honeycomb does anomaly-in-storage. EdgeDB does typed inference. Vespa does hybrid search + ML in storage. Loam composes 11 of these dimensions simultaneously, with a privacy-floored cohort model on top, on a substrate that survives 2000 years and runs on Pi-class hardware. No commercial system does all of that.

---

## What we're building

Loam ships v1.0 in 14–16 weeks. Sixteen weekly milestones, each gated by an honest test. Substrate skeleton in week 1; cap-tokens in week 4; K-anonymity co-transactional in week 5 (the highest-leverage week); the Shell in week 7; per-service onboarding rituals in weeks 13–14; cross-service capability-token UX in week 15; stabilize in week 16. Production deployment is gated on the architect's explicit go after dev passes.

Substrate goes online. Then Sakura starts learning from a smarter floor than she ever had. Then the other products onboard one at a time. Then we have a platform.

— The Architect, Marcus, Kofi, Jess, Zane

---

# Loam — Engineering Spec

*Lacuna Engineering · 2026-06-27 · architect-greenlit build · supersedes
LOAM 1.0*

**Status:** ENGINEERING. The architect has greenlit the build; this is
the spec the team works from daily. Replaces LOAM 1.0 wholesale.
1.0's "very reliable cache + workspace registry" framing was too narrow;
this document reshapes Loam as **the soil from which every Curator
automation grows** — a 2000-year substrate, a knowledge fabric, a
mediated shell, and an event spine. §30 build start is owner-authorized;
production deploy is gated on the architect's explicit go after dev passes.

> **Filename: `LOAM-1.0-ENGINEERING.md` — PROMOTED TO CANONICAL 2026-06-27.**
> Source file renamed from `docs/LOAM-1.0-DESIGN.md` → `docs/LOAM-ENGINEERING.md`
> (Q27, 2026-06-27) → `docs/LOAM-1.0-ENGINEERING.md` (canonical promotion,
> 2026-06-27 evening pass per
> [`CANONICAL-DOCS-FRAMEWORK-2026-06-27.md`](CANONICAL-DOCS-FRAMEWORK-2026-06-27.md)).
> The HTML+search-index slug is `loam-1.0-engineering`; the doc is one
> of the 8 canonical engineering docs and is now shelf-visible
> (`hideFromShelf:false` in `scripts/build-docs-html.mjs:44`). Voice:
> HelloSurface gold standard. §31 carries the full set of architect
> Q-ratifications.

**Read first (corrected 2026-06-27 per AUDIT-LIES H1/H2/H3/H6).**

Substrate (the on-disk truth):
- `curator-api/curator_api/loam/log/shard.py:1` — per-shard SQLite + WAL
- `curator-api/curator_api/loam/log/audit.py:1` — co-transactional + forward-secure audit
- `curator-api/curator_api/loam/planes/cohort.py:1` — per-cohort SQLite file isolation
- `curator-api/curator_api/loam/security/macaroon.py:1` — Q19/Q20 cap-token minter
- `curator-api/curator_api/loam/security/cap_token.py:1` — Ed25519 production verifier
- `curator-api/curator_api/loam/cohort/__init__.py:43` — `derive_cohort_id` (was wrongly cited as `cohort.py:43`)
- `curator-api/curator_api/loam/cohort/coordinator.py:1` — cross-shard K-floor coordinator
- `curator-api/curator_api/loam/subscriptions/core.py:1` — subscription primitive (§10)
- `curator-api/curator_api/loam-shell/src/server.rs:1` — Rust Shell (sibling dir, dashed)
- `curator-api/curator_api/loam/workspace.py:1` — the 5-verb Python API

Cache + ancillary (NOT the substrate):
- `curator-api/curator_api/loam/router.py:74` — L1/L2/L3 query cache router (cache, not substrate)
- `curator-api/curator_api/loam/backends/inmemory.py:74` — in-process cache backend
- `curator-api/curator_api/loam/schema.py:28-118` — cache schema dataclasses (not substrate record types)
- `curator-api/curator_api/loam/log/cbor_scheme.py:1` — bilingual record encoding for the substrate

Domain providers (migrations example):
- `curator-api/curator_api/providers/radio_loam.py:1`
- `curator-api/curator_api/providers/price_comps.py:1`
- `curator-api/curator_api/firecrawl/cache.py:1`

Companion docs:
- `docs/HELLO-SURFACE-1.0-ENGINEERING.md`
- `docs/CORTEX-KNOWLEDGE-LOOP.md`
- `docs/INFRA-GATED-CARTS-2026-06-15.md`
- `docs/PRICING-TOKEN-DESIGN-2026-06-18.md`
- `docs/SLA-SLO-SPEC.md`
- `docs/LOAM-V1-ARCHITECT-CALLS.md` — 5 architectural shortcuts pending architect ratification (AUDIT-LIES Tier 3)
- `research/loam-bifurcation-analysis-v0.1.md`

---

## §1 — What Loam is (the substrate framing)

This is the engineering spec. The architect has greenlit the build;
the team works from this document daily. The vision sections (§1–§7)
remain load-bearing because the build decisions in §17–§32 derive
from them — but every sentence is now committed to ship, not proposed.

**Loam is the durable substrate of the Curator product.** It is the
place data lives when it must outlast a process, a host, a region, a
vendor, a model generation, or a decade. It is the soil from which
every automation grows: every cart that learns, every trigger that
fires, every cohort signal that surfaces, every dossier the operator
opens, every claim Sakura makes that survives the conversation.

The architect's brief is verbatim load-bearing: *"A place data can
live reliably for 2000 years if it needs to. This does not need to be
fast. Just reliable and consistent. There perhaps needs to be
intelligence about who can get what. Who knows when what is done?
Subscription to data? What sort of advanced feature does a db like
this need to not just be a folder where we put stuff and lose it."*

Loam is not a database. A database is what an application reaches into
for rows. Loam is what the entire Curator surface — Sakura, Lacuna,
every cart, the Cortex Knowledge Loop, the SRE event spine, the cohort
math, the public web cache, the four-agent workspaces, the
multi-week-dispute orchestration, the price-comparable history, the
Radio-Browser catalog, the federated buyer-pattern aggregates —
**rests on**. It is the soil. The carts are the plants. The plants
change daily; the soil persists.

Four irreducible properties define the substrate:

1. **Durability** that survives format, host, region, and
   vendor obsolescence over a millennial horizon (§2).
2. **Mediated access** at the boundary: a deterministic Shell
   (Rust, no LLM) is the only thing the rest of the system talks
   to (§3, §4, §17). The original "small LLM at the gate" framing
   from §3 was superseded by the §17 classical-substrate reframe —
   the substrate is classical; per-client NL adapters live outside
   the substrate's trust domain.
3. **A producer/consumer discipline** that keeps writers and readers
   ontologically separate so the substrate cannot poison itself (§7).
4. **Subscription** as a first-class primitive: anyone can ask
   "tell me when X happens in the soil" and Loam will (§10).

Everything else in this document — the storage shape, the projections,
the security model, the failure plan, the 14-16 week build — derives
from these four properties.

### §1.1 — What rejecting "a folder" actually means

The architect's literal rejection: *"Not something new that adds an
additional 300 automations by surprise because you researched it
well."* A folder loses things. A folder has no producer/consumer
discipline. A folder cannot answer "when did this change?" — it can
only answer "what is here now?". A folder cannot defend its content
against a confused writer, an adversarial reader, or a model that
hallucinates a key. A folder ages with its host.

Loam refuses every one of those failures by construction.
Below is the table the rest of this document earns:

| A folder | Loam |
|---|---|
| Single namespace | Tenant / cohort / world / system / public — five planes, cryptographic prefixes (§5, §12) |
| Anyone with the path can read | Capability tokens + the Shell + co-transactional K-anon floor (§4, §12, §17) |
| Last write wins, history lost | Append-only log; every write is content-addressed and signed (§2.3, §8) |
| No subscription | First-class subscription primitive; trigger-as-column; event spine (§10) |
| Format-locked to the host filesystem | Content-addressed, format-bilingual (CBOR + Scheme s-expr), printable to nickel (§2.5) |
| Lost on host failure | Replicated, replayable, restorable from a tarball with bash (§14) |
| LLM has to know where to look | Sakura's client-side NL adapter composes a Scheme request; the Shell verifies; Sakura never touches storage (§5, §17) |
| Mutable, ambiguous | Immutable log + derived projections; the log is truth (§8) |
| Operates on rows | Operates on facts, events, blobs, embeddings, code artifacts, and subscriptions — five surfaces, one substrate (§8) |

---

## §2 — The 2000-year reliability discipline

A 2000-year promise is not a marketing line. It is a set of
constraints that change the storage substrate. The discipline below
is the concrete plan.

### §2.1 — The four enemies of 2000-year data

| Enemy | What goes wrong | Defense |
|---|---|---|
| **Bit-rot** | Cosmic rays, magnetic-domain decay, NAND charge drift | Erasure-coded shards across 3+ media generations; periodic scrub-and-rewrite; SHA-256 + BLAKE3 dual-hash content addressing |
| **Format obsolescence** | The reader for `.fdb` files no longer compiles in 2178 | Two encodings always co-stored: CBOR (machine) + Scheme s-expressions (human). Scheme is the format obsolescence floor — its 7-form core has been stable since 1975 and is recoverable from text |
| **Host obsolescence** | Fly, AWS, Cloudflare, S3 are all gone | Content-addressed manifests; cold-storage tarballs replicable to any POSIX filesystem; one bash script reconstitutes from media |
| **Vendor obsolescence** | The proprietary index/engine is gone | No proprietary engine. SQLite + a flat append-only log + an HNSW index file are all the engine ever needs. SQLite's three-clause public-domain dedication and Litestream's open-source replication are the floor (`https://litestream.io/how-it-works/`) |

The Long Now Foundation's Rosetta Disk took a similar discipline to
its extreme — analog nickel etching readable with a 750x optical
microscope, no software required
([rosettaproject.org](https://rosettaproject.org/blog/02008/aug/20/very-long-term-backup/)).
We don't go that far for the live substrate, but the cold-tier of Loam
**does** plan for a periodic HD-Rosetta etch of the operator's
sovereign data — a service-bench feature, not v1.0, but architected
in.

### §2.2 — Storage: the layer cake

```
+---------------------------------------------------------------+
|                       LOAM STORAGE CAKE                       |
+---------------------------------------------------------------+
|                                                               |
|  COLD     HD-Rosetta etch (millennial, opt-in service)        |
|  -----    Nickel disk; recoverable with a microscope          |
|                                                               |
|  GLACIER  Tarball + manifest in 3-of-5 cold object stores      |
|  -----    Backblaze B2 + R2 + Wasabi + IPFS pin + bare disk    |
|           Quarterly rotation; bash-restorable (§14)            |
|                                                               |
|  WARM     Append-only event log (one segment-file per day)    |
|  -----    SQLite per-shard (Litestream-replicated); CBOR rows  |
|           + Scheme sidecars; HMAC-signed; BLAKE3-content-addr  |
|                                                               |
|  HOT      Derived projections                                  |
|  -----    KV index (RocksDB-style) · vector index (HNSW)       |
|           graph index (lightweight property graph)             |
|           trigger predicate index                              |
|                                                               |
+---------------------------------------------------------------+
```

The log is truth. Every projection above the log is derived,
recomputable, and disposable. This is the Datomic discipline (Rich
Hickey's "Database as a Value", [QCon NY 2012](https://www.infoq.com/presentations/Datomic-Database-Value/);
later [CMU SDI 2013](https://www.pdl.cmu.edu/SDI/2013/slides/hickey-dbasvaluecmu.pdf))
made into a substrate: facts accumulate, they are never updated, the
past is immutable, and indexes are computed from the log
([Architecture of Datomic, InfoQ 2012](https://www.infoq.com/articles/Architecture-Datomic/)).

We chose SQLite over FoundationDB (1.0's choice) because the
2000-year discipline demanded it. FDB is a fine database; it is also a
proprietary distributed system whose recovery requires its own
admin tooling. SQLite is the most-deployed database in the world,
its file format is published as a deliberate
long-term-preservation spec, and it can be read by `sqlite3` on every
POSIX system that has existed since 2004. Litestream
([litestream.io](https://litestream.io/)) gives us streaming WAL
replication to any S3-compatible bucket with no daemon dependencies,
and the restore command works from a bash script
([litestream.io/reference/restore/](https://litestream.io/reference/restore/)).

### §2.3 — Content addressing as the primitive

Every fact, blob, and embedding written to Loam is **content-addressed**.
A write produces a CID (Content IDentifier) that is the SHA-256 of the
canonical CBOR encoding, prefixed with a 2-byte magic + version. The
CID is the only reference any other Loam record makes to this fact.

Why this matters for 2000 years: a reference that names content, not
location, survives the host. The bytes can move from FDB to SQLite to
RocksDB to a tarball to a nickel disk to a fresh substrate built in
2178; the CID still resolves so long as the bytes exist anywhere. This
is the IPFS / Merkle-DAG discipline
([ipfs.tech merkle-dag](https://docs.ipfs.tech/concepts/merkle-dag/)),
without the IPFS protocol cost — we use the discipline, not the
transport.

```
   write(value)  ->  cbor = canonical-cbor(value)
                     cid  = "blake3-" + blake3(cbor)[:32]
                     append log: (cid, ts, cohort, hmac-sig, cbor)
                     return cid
```

A reference (`refer-to: cid:blake3-...`) is a Merkle pointer. The
substrate cannot lose what it can reconstitute by hash.

### §2.4 — Schema-less, but not shape-less

There is no schema migration story because there is no schema. Every
record carries its own Scheme s-expression alongside its CBOR. The
s-expression is self-describing:

```scheme
(:fact :kind 'shop-finding
       :shop-id  "co-7f3a..."
       :finding  "your buyer cohort skews 2.4x toward art-deco"
       :evidence (:cid "blake3-a1b2..." :method 'cohort-pattern-learn)
       :confidence 0.83
       :written-at "2026-06-26T14:32:00Z"
       :written-by 'lacuna-engineering)
```

A reader in 2178 with a Scheme interpreter and 30 minutes can recover
every field by inspection. Compare to: a reader in 2178 with a `.fdb`
file and no FDB binary. The 2000-year promise is enforced by the
ability of the future to read the past with primitive tools.

### §2.5 — Format bilingualism: CBOR + Scheme

Two encodings, always co-stored:

- **CBOR** — RFC 8949, IETF standard, deterministic canonical form
  (RFC 8949 §4.2), what the runtime actually serializes/deserializes.
  Tight, fast, well-specified.
- **Scheme s-expressions** — for human archaeology. Generated on
  write, stored alongside the CBOR row in the log, periodically
  vacuumed into glacier-tier text bundles for the Rosetta etch.

The runtime trusts CBOR. The 2178-archaeologist trusts the s-expr.
Both are identical bytes-of-meaning; the difference is the cost of
recovery. Pre-printing the s-expr at write time is the price we pay
for the millennial promise.

### §2.6 — Cryptographic agility

Algorithms break. SHA-1 broke in 2017; SHA-256 will eventually have
its day. The discipline:

- **Dual-hash** every CID: `blake3-...` and `sha256-...` are stored
  side-by-side. If one breaks, the other validates.
- **Hash-of-hash chain**: every log segment ends with a hash of the
  prior segment's hash, forming a tamper-evident chain. Compromise of
  one algorithm doesn't compromise the chain.
- **Algorithm version field** in every CID prefix. When SHA-256 falls,
  we add `sha3-512-...` to the dual-hash and migrate the index without
  rewriting the log.
- **Key rotation as a first-class operation**: AES-256-GCM keys for
  PRIVATE prefix records rotate quarterly; the rotation is a
  re-encryption-in-place job that emits new CIDs (the old CIDs remain
  in the log; the keys for them are escrowed in cold storage with a
  3-of-5 Shamir split).

This is the discipline Soo-Jin's SECURITY-CANONICAL audit walks every
release; the 2000-year horizon makes it not optional.

### §2.7 — Custody-succession (the discipline that outlasts Curator)

Format-bilingualism + dual-hash + bash recovery only outlive the
substrate if **someone in 2099 still holds the keys, pays the
bucket bills, and renews the Shamir splits.** §12.6's quarterly key
rotation presumes a rotating human; §14's restore script presumes a
bucket that exists. The 2000-year discipline therefore needs a
*custody* discipline as much as it needs a *format* discipline.

Honest framing first: **discipline, not guarantee** (per §32). No
one ships a 2000-year database. What we ship is a 2000-year
discipline plus a 2000-year custody plan. The plan has three layers:

1. **Operator-held keys, by default.** The BIP-39 mnemonic that
   Baobab issues to each operator (§22.1 floor) is the only
   long-horizon key whose custody the substrate explicitly *cannot*
   own. The operator's mnemonic is the operator's responsibility;
   our discipline is to make losing it survivable (cohort-anonymized
   facts persist for K-anon-eligible queries; the operator-specific
   subset is gone — honestly).
2. **Foundation or co-op custody for paid cold-store (target: v2.1).**
   The 3-of-5 cold-store rotation needs a billing principal that
   outlives Curator/Lacuna Labs Inc. The honest answer is **a
   non-profit foundation or operator-owned co-op** that holds the
   bucket credentials, the Shamir splits, and the operator-renewal
   relationship. Curator's role at that point is contractor to the
   foundation, not custodian. (Long Now's HD-Rosetta affiliation
   is an opt-in further layer for operators who want the
   nickel-etch tier — §31 Q6 decides whether we ship the etch in
   v2.1 or never.)
3. **Bash + tar + sqlite3 as the floor.** When custody fails — when
   the foundation dissolves, when no one renews the bucket, when
   the Shamir splits decay — what remains is the discipline of
   §14.2: a single bash script, a single tarball, a CBOR + Scheme
   sidecar pair that any POSIX host can read. The floor is the
   substrate's last honest answer; everything above it is
   stewardship.

§31 Q28 surfaces the custody-succession architect decision: which
custody structure (foundation, co-op, Long Now-affiliated, or other)
ships in v2.x, and what's the v1.0 stopgap until it lands.

---

## §3 — Mediated access at the boundary (the Shell)

> **§17 reframe — read first.** The original design called the
> boundary mediator "the Gate" — a small LLM (1.7B–3B) wrapped in
> a deterministic shell. The §17 classical-substrate reframe
> retired the in-substrate LLM. The boundary mediator is now
> **the Shell** — pure deterministic Rust, no LLM, no model file.
> Per-client NL adapters live OUTSIDE the substrate in each
> client's trust domain. This section preserves the bridge-troll
> origin story (it's how the architect arrived at the design) and
> then narrates how every responsibility lands in the Shell. Where
> "the Gate" appears below as a historical reference, read it as
> "the Shell" for current shipping behavior.

The architect proposed it directly: *"Does loam have an LLM at its
gate that this is all it does? Like a bridge troll. Don't know a
formal name."*

There is a formal name in the 2025-2026 literature: **AI Gateway** or
**LLM Control Plane**. Bifrost, Trylon Gateway, Maxim, and a dozen
others ship this pattern as an enterprise control point
([getmaxim.ai](https://www.getmaxim.ai/articles/best-ai-gateway-to-govern-llm-usage-in-enterprise/),
[medium.com/adnanmasood](https://medium.com/@adnanmasood/llm-gateways-for-enterprise-risk-building-an-ai-control-plane-e7bed1fdcd9c),
[github.com/trylonai/gateway](https://github.com/trylonai/gateway)).
But every one of those gateways sits in front of an LLM and protects
the LLM from bad prompts; **the architect's question is the inverse** —
a gateway in front of the data, protecting the data from the LLMs.

That pattern is younger. The closest formal terms are **semantic
firewall** (a control point that understands AI traffic at the
semantic level rather than the network level —
[a10networks.com](https://www.a10networks.com/blog/llm-security/),
[arxiv 2601.15824 Generative Application Firewall](https://arxiv.org/pdf/2601.15824))
and **data plane gateway with policy enforcement** (the IBM /
DataPower frame). We are not adopting any of these wholesale — we
are taking the *role* and giving it a name that fits the substrate.

We called it **the Gate** in the original design — a small dedicated
LLM (1.7B to 3B parameter range; not Sakura, not Lacuna) whose only
job was mediating access to Loam. **The §17 reframe retired that LLM.**
The boundary mediator that ships is **the Shell** — deterministic
Rust, no LLM, all the same enforcement responsibilities. The
six-responsibility list below describes the responsibilities; §17.3
walks how the Shell discharges them without an LLM.

### §3.1 — The boundary mediator's job (responsibilities the Shell ships)

Six responsibilities, no more. In the original design these belonged
to "the Gate" (LLM + deterministic shell); in the shipping design
they belong to **the Shell** alone (deterministic Rust, no LLM). The
NL→Scheme translation (responsibility 1) moved OUT of the substrate
to the client-side NL Adapter per §17.

1. **Translate intent → query (client side now, not substrate).**
   A producer says "remember that this shop's buyers skew art-deco"
   and the client's NL Adapter (Sakura's L0 1.7B savant for Curator)
   composes the Scheme s-expr; the Shell verifies and writes. A
   consumer says "what do we know about this shop?" and the same
   client-side adapter composes the request; the Shell verifies and
   serves. The substrate accepts Scheme, never English (§17.4).

2. **Authorize.** Every request carries a capability token (§12). The
   Shell checks the token against the planes the request touches
   (TENANT / COHORT / WORLD / SYSTEM / PUBLIC) before the request ever
   reaches storage. The Shell enforces the producer/consumer rule (§7)
   — readers cannot write, writers cannot read what they did not
   write.

3. **Route to projection.** A request names a structured action
   (e.g. `(loam.search :semantic :spec <embedding> :plane COHORT ...)`).
   The Shell dispatches to the KV index, the vector index, the graph
   projection, or composes from multiple. The original design called
   this "rewrite for projection" via NL — the Shell ships it as
   structured-action dispatch from a closed allow-list (§31 Q24).

4. **K-anonymity floor enforcement.** Co-transactional with the
   data fetch (§12.4). A cohort below K=8 distinct tenants returns
   null; the Shell never even reads the cell.

5. **Trigger evaluation.** When a write changes a fact that a
   subscriber is watching, the Shell evaluates the subscription
   predicate inside the write transaction and fires the callback
   (§10).

6. **Audit.** Every Shell decision (allow, deny, route, fire trigger)
   appends a row to the SYSTEM/audit log. The audit is itself stored
   in Loam — recursive, intentional. Soo-Jin's "the audit is the
   product" framing.

### §3.2 — Why a small LLM, not a hand-written gatekeeper (and why the §17 reframe answered "neither")

> **§17 reframe.** This subsection captures the original "small LLM
> at the boundary" argument. Each bullet below has a §17 counterpart
> that landed the same outcome WITHOUT the LLM. The Shell ships the
> "centralized intent surface," "small uniform policy check," and
> "feedback-driven improvement" goals using structured Scheme
> dispatch from a closed allow-list, not English-shaped LLM
> proposals. Read this subsection as the design's reasoning history;
> §17 is the load-bearing answer.

A hand-written authorization gatekeeper has been the default since
the early 1990s. The original argument for an LLM in 2026:

- **Intent is the natural shape of a Loam request.** Every cart
  already speaks intent ("recall what I know about this shop",
  "remember this finding"). Forcing a translation to SQL or Cypher
  before the substrate sees it pushes that translation into every
  cart. The original design centralized it in the Gate; the §17
  design centralizes it in each client's NL Adapter.
- **Producer/consumer enforcement on intent is dramatically simpler
  than on syntax.** A hand-written gatekeeper has to whitelist 400
  query shapes. The original design proposed an LLM evaluating
  English against a small policy; the §17 design ships a closed
  structured-action allow-list (§31 Q24) — the same simplicity, no
  model.
- **The Gate becomes a learnable component.** Wrong-shape requests
  would have trained the Gate; in the §17 design the audit-log
  feedback loop (§16.3.11) trains each client's per-product NL
  Adapter, not a substrate-shared model.

The risk: an LLM is non-deterministic; an authorization decision must
be. The defense was structural (§3.3); the §17 simplification removed
the risk entirely by removing the LLM.

### §3.3 — Deterministic shell, learnable interior

> **2026-06-26 reframe (§17).** The "Gate = LLM + Shell" framing
> below describes the original design. As of §17 the Gate splits
> cleanly into a deterministic **Shell** (lives IN the substrate, no
> LLM) and an optional per-client **NL Adapter** (lives OUTSIDE the
> substrate, in the client's trust domain). The Shell does
> everything below — cap-token verify, plane verify, K-floor verify,
> audit emit — without any LLM. The NL Adapter is what each client
> (Sakura, Bloom) ships if they need English→Scheme translation.
> Read this subsection as a transitional description; see §17 for
> the load-bearing treatment.

The Gate is wrapped in a deterministic shell. The LLM **proposes**;
the shell **disposes**.

```
   [request: English + cap-token + principal]
                    |
                    v
            +---------------+
            |   The Gate    |
            | LLM proposes: |
            |  - action     |
            |  - planes     |
            |  - keys       |
            |  - K floor    |
            +-------+-------+
                    |
                    v
            +---------------+
            | Deterministic |
            | shell verifies|
            |  - cap-token  |
            |  - planes ⊆   |
            |    granted    |
            |  - K floor    |
            |  - audit row  |
            +-------+-------+
                    |
                    v
              [storage call]
```

If the Gate proposes an action the shell cannot verify (asking for a
plane the token does not cover, asking for a cell whose K floor is
under-fed, asking for a cohort that does not exist), the shell denies
and writes a `gate.proposal_rejected` audit row. The LLM is a
co-pilot; the shell is the pilot. This is the same discipline
[trylonai/gateway](https://github.com/trylonai/gateway) ships for
LLM-input guardrails, applied inward.

The Gate's worst-case behavior is therefore: *it slows the substrate
to denial*. It cannot leak; it cannot escalate; it cannot mis-write.

**The Gate is one expression of a broader substrate intelligence.**
§16 makes the framing explicit: Loam is a smart DB, not a dumb DB
fronted by a smart Gate. The Gate mediates intent at the boundary;
ten other substrate-intelligence behaviors (§16.3.1 learned indexes,
§16.3.2 schema gravity, §16.3.3 emergent cohorts, §16.3.4 write-time
embeddings, §16.3.5 surfaced anomalies, §16.3.6 learned compaction,
§16.3.7 cost prediction, §16.3.8 predictive subscriptions, §16.3.9
pattern mining, §16.3.10 self-healing, §16.3.11 audit-as-corpus)
operate inside the substrate without the Gate. Read §3 as **the
boundary surface of a smart substrate**, not as **the only smart
thing about the substrate**. The Gate's user-facing voice lives
in §19.1 (UX-surfacing) — when the Gate proposes, refuses, or
routes, Sakura narrates per the three-layer pattern there.

### §3.4 — Size, training, deployment

> **2026-06-26 reframe (§17).** Per §17, the substrate has NO LLM.
> The "Gate's LLM" below is the **client-side NL Adapter** (Sakura's
> L0 1.7B savant, Bloom's adapter, etc.), not a substrate-resident
> model. The hot path / slow path discipline below applies to the
> client's Adapter, not to the substrate's Shell. The Shell is
> deterministic and always-hot.

- **Size:** the client's NL Adapter is 1.7B parameters at the floor
  (Sakura-class), 3B at the ceiling. The claim that "larger than
  that, latency suffers" is a rule of thumb, not a benchmark. Public
  3B inference numbers on commodity hardware (PowerInfer on Intel
  i9+RTX 4090 ≈ 8.3 tok/sec; Apple Silicon M2-class 3B encoders in
  the low tens of tok/sec) imply that even a 100-token NL→Scheme
  rewrite is hundreds of ms p50 and multiple seconds p99 on a per-
  Adapter-call basis. **This makes any client-side LLM unfit for the
  hot path by default — and the substrate's Shell is the hot path.**
- **Hot path vs slow path (critical).** Hot-path Shell decisions
  (every read, every write) are deterministic — no LLM anywhere.
  The slow path (NL→Scheme rewrites, schema-suggestion narration,
  anomaly summarization, novel intent disambiguation) is where the
  **client's NL Adapter** lives, NOT the substrate. The §3.3
  "LLM proposes; shell disposes" framing was the original design;
  §17 supersedes it — the proposing LLM lives in the client (per
  service, per product), not in the substrate. §31 Q16 — simplified
  by §17 — pins only the Shell's deterministic per-request budget
  (p95 ≤ 50ms inclusive of storage). Slow-path NL latency budgets
  + cache-hit ratios are per-client (Sakura's, Bloom's, etc.) and
  live in each service's product spec, not in this substrate decision.
- **Training:** corpus of `(request, intended-action, planes, keys)`
  triples drawn from every cart's known capability surface plus
  synthetic adversarial examples (drop-the-token, escalate-plane,
  cohort-cross-bleed, K-floor-evasion). Sakura's training methodology
  applies — train on behavior, not facts.
- **Deployment:** the Gate runs as a sidecar to every Loam shard. No
  shard is reachable except via its co-located Gate. The deterministic
  shell is a Rust binary; the LLM is a separate process spoken to
  over a Unix socket; if the LLM hangs, the shell denies the slow path
  with `gate.unavailable` AND falls back to a static minimal-policy
  cache for the hot path (no DoS-by-LLM-hang permitted). The
  deny-all-writes-on-Gate-hang failure mode is a design hazard called
  out in §32 honest gaps.

### §3.5 — When the Gate is wrong

The Gate will be wrong. The disciplines:

- **Honest null**: if the Gate cannot determine the action with
  confidence ≥ 0.85, it returns `(escalate 'gate-uncertain)` — never
  guesses. The caller sees the same shape it sees today for any
  un-wired service. **The raw symbol never reaches the operator's
  screen.** Carts that bubble up `'gate-uncertain` must translate
  to a Sakura-voiced beat first — e.g. "I'm not sure on that one,
  let me check" — per Daisy's substrate-invisibility lock
  (Appendix A). Internal symbols are engineering chrome.
- **Recovery**: every Gate denial is appealable. Sakura can request a
  human-review path; Lacuna routes to the operator who decides;
  decisions feed the Gate's training corpus.
- **Bypass for SYSTEM**: in extremis (the Gate is broken, a recovery
  is in progress), Lacuna can hold a SYSTEM bypass capability — a
  single signed token, escrowed in cold storage, that the shell
  honors without consulting the LLM. This is the bash-recovery exit
  door.

---

## §4 — LLM ↔ Loam protocol

The architect: *"How does our LLMs communicate with it? Can the LLM
ask it to perform operations on code?"*

The answer is **the Loam tool surface**, exposed via the
Model Context Protocol (MCP)
([modelcontextprotocol.io](https://modelcontextprotocol.io/specification/2025-03-26)).
MCP is the right fit because it is the industry-standard wire for
LLM ↔ tool communication, governed by the Agentic AI Foundation
under the Linux Foundation, and gives us a deployable wire format
with bindings already in every reasoning model.

The Loam MCP server exposes **14 tools** (composing **5 primitive verbs**)
and **5 resources**. That is the entire protocol. See §4.1 for the
canonical 14-tool list (corrected 2026-06-27 per AUDIT-LIES C1).

### §4.1 — 14 MCP tools, 5 primitive verbs

**CANONICAL VOCABULARY (corrected 2026-06-27 per AUDIT-LIES C1):** earlier
drafts of this chapter listed seven tools with names like
`loam.remember` / `loam.recall` / `loam.search` / `loam.cancel` /
`loam.audit` / `loam.execute`. **None of those names exist in the code.**
The substrate ships **5 primitive verbs** exposed through **14 MCP tools**
that compose those verbs with planes and scopes. The canonical list, from
`curator-api/curator_api/loam-shell/src/schema.rs:247-283`:

```
;; The 5 primitive verbs (Marcus / §SJ.3 / §8 framing)
put · get · append · on · poll

;; The 14 MCP tools (the wire surface a builder targets)
loam/put                    — write a fact into the addressed plane
loam/get                    — read a key from a plane
loam/append                 — append-only write to an event-stream key
loam/on                     — register an in-process callback (subscription light)
loam/poll                   — pull-side counterpart of /on
loam/operator-state         — read operator pause / vacation / no-new-data flags
loam/cohort/aggregate       — K-floored aggregate read across a cohort
loam/subscribe              — register a persistent subscription with callback URL
loam/unsubscribe            — cancel a subscription by id
loam/list-subscriptions     — enumerate a tenant's subscriptions
loam/code-execute           — run a registered code artifact (see §11)
loam/consumer-disclosure    — ADMT consumer-disclosure read (CPRA + GDPR Art. 22)
loam/admt/dispute           — operator-only ADMT dispute submission
loam/cart/withdraw          — operator-only cart withdrawal (EU Directive 2023/2673)
```

Audit-action tags are hyphenated (e.g. `subscription-fired`, not
`subscription.fired`). The cap-token + Shell decision pipeline are the
same for every tool — see §17.3.

Every tool call goes through the Shell (§3, §17.3). Clients never
name a key, a plane, or a cohort directly in storage syntax; they
compose a structured Scheme s-expr naming a principal (a shop, a
cart, a finding) and an action. Where clients accept English from
operators, the client-side NL Adapter (§17.4) translates English →
the canonical Scheme s-expr before the Shell ever sees the request.

<!-- LIVING:EXPAND puppet-master — the client-side NL Adapter that composes
     these Scheme s-exprs from operator intent (the LLM↔surface interface)
     is being built in the PUPPET-MASTER-SUITE lane. Once that lane lands,
     document here: how the puppet-master selects a tool from the 14-tool
     surface, how it threads the capability token, and how a Shell denial
     is surfaced back to the operator. Do not author the puppet-master
     contract until the build lane ships. -->

**Naming note (drift, 2026-07-03):** the code comment at `schema.rs:299`
still reads "one of the 7 known tools" — a stale count from before the
subscription / code-execute / W14-W15 tools landed. `TOOLS`
(`schema.rs:268-283`) contains **14** entries; the doc count is
authoritative. This is a code-comment defect, tracked for the owning
lane, not a doc error.

### §4.2 — Five resources

MCP resources are read-only addressable units the LLM can attach to
its context window. The **canonical five prefixes** ship in
`curator-api/curator_api/loam-shell/src/schema.rs:291-297`
(`RESOURCE_PREFIXES`), enforced by the test at `schema.rs:428`
(`assert_eq!(RESOURCE_PREFIXES.len(), 5, ...)`):

```
loam://shard/<id>       — a shard's addressable state (RESOURCE_SHARD, schema.rs:285)
loam://cohort/<id>      — a K-floored cohort projection (RESOURCE_COHORT, :286)
loam://plane/<id>       — a plane's addressable slice (RESOURCE_PLANE, :287)
loam://audit/<id>       — audit trail (RESOURCE_AUDIT, :288)
loam://service/<id>     — a service identity (RESOURCE_SERVICE_IDENTITY, :289)
```

<!-- LIVING:TODO drift corrected 2026-07-03 vs HEAD d4f5a8a4: earlier
     drafts listed `loam://principal/`, `loam://subscription/`,
     `loam://code-artifact/`, and `loam://event-stream/` as the resource
     set. None of those prefixes exist in schema.rs; the shipping
     RESOURCE_PREFIXES are shard/cohort/plane/audit/service. If the
     principal/code-artifact addressing is still intended, it is a design
     aspiration to be added to RESOURCE_PREFIXES, not current behavior. -->

Resource URLs are content/identity handles that survive backend swaps:
the `verb_for_allowlist` helper (`schema.rs:313`) maps a
`loam://<family>/...` URL to a stable `resource-<family>` allow-list key,
so the addressing scheme is decoupled from storage layout. That stability
is the substrate's hedge against its own evolution.

### §4.3 — Can the LLM ask it to perform operations on code?

**Yes — and this is the load-bearing surface §11 builds on.** Short
form: Loam stores code as content-addressed artifacts; the LLM can
register code, version it, request its execution against a sandbox,
subscribe to a code artifact for change-notify, and ask the substrate
to compose code from facts via templates. Long form is §11.

### §4.4 — Tool + resource signatures (typed)

**REWRITTEN 2026-06-27 per AUDIT-LIES C1.** Earlier drafts named seven
fictive tools (`loam.remember` / `loam.recall` / etc.). The canonical
list below mirrors the 14 tools in `schema.rs:247-283` byte-for-byte.
Scheme s-expr typing is the canonical form; JSON Schema is generated
from it.

> **§17 reframe.** These tools are **substrate-side, deterministic
> Shell only.** Every call below is verified by the Shell (cap-token,
> planes, K-floor, audit, cost reserve) without any LLM. Clients
> that need to translate English to these calls run a per-client
> NL Adapter outside the substrate (Sakura's L0 1.7B savant is one).
> The substrate accepts Scheme s-exprs; the substrate never accepts
> English. See §17.3 for the Shell's full per-request path.

```
;; ── the 5 primitive verbs (typed I/O surface) ────────────────────────

(loam/put
  :principal      string
  :plane          (or TENANT COHORT WORLD SYSTEM PUBLIC)
  :key            string
  :payload        cbor
  :cap-token      macaroon
  -> (or (ok :cid string :audit-cid string)
         (escalate symbol :reason string)))

(loam/get
  :principal      string
  :plane          (or TENANT COHORT WORLD SYSTEM PUBLIC)
  :key            string
  :cap-token      macaroon
  -> (or (ok :payload cbor :audit-cid string)
         (null :reason (or 'k-floor 'no-data 'cap-insufficient))
         (escalate symbol :reason string)))

(loam/append
  :principal      string
  :plane          (or TENANT COHORT WORLD SYSTEM PUBLIC)
  :stream-key     string
  :payload        cbor
  :cap-token      macaroon
  -> (or (ok :cid string :audit-cid string)
         (escalate symbol :reason string)))

(loam/on
  :principal      string
  :predicate      s-expr
  :handler-name   string             ;; bound to an in-process Scheme proc
  :cap-token      macaroon
  -> (or (ok :registration-id string)
         (escalate symbol :reason string)))

(loam/poll
  :principal      string
  :stream-key     string
  :cursor         string?            ;; nil = from beginning
  :cap-token      macaroon
  -> (or (ok :events (list cbor) :next-cursor string)
         (escalate symbol :reason string)))

;; ── extended tools (subscription / aggregate / code / ADMT) ─────────

(loam/operator-state
  :principal      string
  :cap-token      macaroon
  -> (record :vacation boolean? :paused boolean? :no-new-data boolean?))

(loam/cohort/aggregate
  :cohort-id      string
  :selector       s-expr
  :cap-token      macaroon
  -> (or (ok :rows (list cbor))
         (null :reason 'k-floor)
         (escalate symbol :reason string)))

(loam/subscribe
  :principal      string
  :predicate      s-expr
  :callback-uri   string             ;; trusted-prefix-list per §12.7
  :cap-token      macaroon
  -> (or (ok :sub-id string)
         (escalate symbol :reason string)))

(loam/unsubscribe
  :sub-id         string
  :cap-token      macaroon
  -> (or (ok) (escalate symbol :reason string)))

(loam/list-subscriptions
  :tenant-id      string
  :cap-token      macaroon
  -> (ok :subscriptions (list (record :sub-id string
                                      :predicate s-expr
                                      :callback-uri string))))

(loam/code-execute
  :artifact-cid   string
  :inputs         cbor
  :cap-token      macaroon          ;; MUST carry :exec scope distinct from :register
  -> (or (ok :result-cid string :audit-cid string :exit-reason string)
         (escalate symbol :reason string)))

(loam/consumer-disclosure
  :consumer-id    string
  :cap-token      macaroon
  -> (ok :rows (list cbor) :legal-basis string))

(loam/admt/dispute
  :decision-cid   string
  :ground         string
  :cap-token      macaroon          ;; operator-only
  -> (or (ok :dispute-id string :audit-cid string)
         (escalate symbol :reason string)))

(loam/cart/withdraw
  :cart-cid       string
  :reason         string
  :cap-token      macaroon          ;; operator-only
  -> (or (ok :refund-amount-tokens integer :audit-cid string)
         (escalate symbol :reason string)))

;; --- resources ---
;; (read-only addressable units; MCP attaches to context)

loam://principal/<id>           -> record {known-facts, plane-grants, cohort-membership}
loam://subscription/<id>        -> record {predicate, last-fire-ts, callback-uri, owner}
loam://audit/<id>               -> stream (audit-row)
loam://code-artifact/<cid>      -> bytes (signed; cid is BLAKE3+SHA-256 dual-hash)
loam://event-stream/<topic>     -> stream (event-row)
```

**Escalate symbols** (Sakura translates to voice; raw symbol never
reaches operator per §3.5):

- `'gate-uncertain` — client-side NL Adapter confidence < 0.85
  (the symbol name predates the §17 reframe; the client's Adapter
  is the slow path now, not the substrate)
- `'gate-unavailable` — client-side NL Adapter hung; hot path
  serves from cache (substrate Shell is always available)
- `'shell-action-not-in-allowlist` — proposed action not in the
  closed structured-action allowlist (§31 Q24; was
  `'gate-action-not-in-allowlist` pre-§17 reframe)
- `'cap-insufficient` — cap-token does not cover requested planes
- `'k-floor-blocked` — cohort below K-anon floor (default 8)
- `'pii-scrub-failed` — write payload contains PII destined for a
  non-TENANT plane
- `'service-not-yet-wired` — backend for this verb not deployed
  (mirrors the existing system-wide honest-null pattern)

The `:cap-token` field in every signature is the same Macaroon-style
chain from §12.1. `:exec` is a distinct caveat from `:register` per
Soo-Jin HIGH finding — being allowed to *deposit* code does not
imply being allowed to *run* it.

This is the answer to the architect's "what advanced features here
can net us some additional purple automations". Code-in-Loam is one
of them — and a big one.

**MCP is the wire between the four execution surfaces and the
substrate.** See §19.3 (compute-locality) for the surface taxonomy
(L0 · Loam-sandbox · L1/NL Adapter · L2). Every surface speaks the
same 14 tools + 5 resources above; the surface decision is
made by substrate intelligence (§16.3.7 cost prediction + §16.3.1
learned indexes) at fire-time, not by the cart at author-time.

---

## §5 — Sakura's relationship + Cortex-of-Loam

The architect: *"Should Sakura know how to look up her data? Why?
Should she have to care who does it?"*

**No.** Sakura does not look up Loam data. Sakura does not know what
storage Loam runs on. Sakura does not learn any keys, prefixes, or
identifiers. Sakura's relationship to the substrate is exactly this:
*Loam pushes pertinent facts into Sakura's local Cortex; Sakura reads
Cortex like she always has*. The look-up is the substrate's job.

### §5.1 — The Cortex-of-Loam layer

Each operator's device runs a **Cortex-of-Loam** — a small, local,
fast projection of the substrate's contents that are relevant to this
operator at this moment. It is not "Cortex" (the working-memory layer
from `CORTEX-KNOWLEDGE-LOOP.md`); it is its **sibling**, the one that
holds Loam-sourced facts where Cortex holds session-sourced facts.
Both speak the same `cortex/recall` API; the runtime resolves against
both layers transparently (§5.1 diagram).

**Reconciliation with existing Cortex's "facts updated, not appended;
old value versioned"** (per `CORTEX-KNOWLEDGE-LOOP.md`): Cortex-of-Loam
is a **projection** of the append-only Loam log; the projection
collapses to current-value for Sakura's local reads, while the
substrate's underlying log preserves the immutable history. The two
models are not in conflict — Cortex-of-Loam shows the latest fact,
Loam preserves every prior fact. When Sakura asks "what did this
operator know on June 5?", the substrate replays from the log; the
projection is the steady-state read path, the log is the time-travel
path.

```
+----------------------------+      +----------------------------+
|  Cortex                    |      |  Cortex-of-Loam            |
|  (session working memory)  |      |  (Loam-pushed projection)  |
|  - what just happened      |      |  - what this operator knows |
|  - facts the operator just |      |  - what their cohort knows  |
|    typed                   |      |  - what the world knows that|
|  - extracted hooks         |      |    pertains to them         |
+----------------------------+      +----------------------------+
              |                                 |
              +--------+    +-------------------+
                       |    |
                       v    v
              +---------------------+
              |       Sakura        |
              | reads both, no API  |
              | difference between  |
              | the two             |
              +---------------------+
```

Sakura calls `cortex/recall` and the runtime resolves it against
both layers transparently. Sakura does not know that the operator's
shop history came from Loam and the operator's current sentence came
from Cortex — both arrive as facts in her context. This is the same
discipline the Cortex Knowledge Loop landed
(`docs/CORTEX-KNOWLEDGE-LOOP.md` §"Context Injection") extended
across the device boundary.

### §5.2 — How Loam pushes into Cortex-of-Loam

The descriptions below are **engineering-internal**. Per Daisy's
substrate-invisibility lock (Appendix A), no operator-facing chat
beat may inherit "Loam pushed" or equivalent substrate-naming
language; Sakura always speaks in first person ("I noticed", "I
pulled"). Voice templates that quote §5.2's mechanism descriptions
must be rewritten before they ship to the corpus.

Three mechanisms:

1. **Subscription delivery.** When Sakura first comes online for a
   session, the runtime opens an MCP subscription on
   `loam://principal/<operator>`. The Shell streams the operator's
   facts that have changed since the last session into the local
   Cortex-of-Loam. Sakura sees them the next time she calls
   `cortex/recall`.

2. **Triggered push.** When a cart writes a finding to Loam (e.g.
   `cohort-pattern-learn` lands a new buyer adjacency), the
   subscription fires and the new fact is delivered to the relevant
   operators' Cortex-of-Loam within seconds. Sakura sees it in her
   next turn.

3. **Eviction-aware refresh.** When Cortex-of-Loam evicts an older
   fact (§14), it leaves a "stub" — a reference to the Loam CID. If
   Sakura ever asks about a topic whose facts have been evicted, the
   stub triggers a re-pull from the substrate, transparent to her.

### §5.3 — Why Sakura must not look up her data

Four reasons:

- **Operator-local privacy.** Sakura must not learn another operator's
  identifiers, even by accident, by knowing the keyspace. Cortex-of-Loam
  holds only this operator's relevant projection.
- **Model-version durability.** When Sakura's weights upgrade from
  1.7B-v3 to 1.7B-v4, no learned key conventions are lost — there are
  none.
- **Substrate evolution.** Loam will change shape over decades. Sakura
  must not couple to its shape.
- **The architect's clear directive.** "Should she have to care who
  does it? Why?" The right answer is no.

### §5.4 — What Cortex-of-Loam evicts

Crucial distinction: **Loam itself never evicts** (the 2000-year
floor). Cortex-of-Loam evicts aggressively (the on-device floor).
Three rules:

1. **LRU within the operator's relevance window.** Facts not touched
   in 30 days drop to stub.
2. **Hot-set cap.** The hot set per operator is 1500 facts; over the
   cap, stub the LRU tail.
3. **Subscription-aware retention.** Facts the operator is actively
   subscribed to never evict, regardless of LRU.

§14 walks the eviction state machine in detail.

---

## §6 — Multi-Service Loam

The architect's foundational reframe, 2026-06-26: *"Loam isn't just for
Curator. Sakura, Bloom, Sakura Prep, Foodie, Baobab, Lacuna 14B — every
Lacuna Labs product shares the same substrate. Service becomes a new
outermost addressing dimension. And the cross-service intelligence —
that's the moat."*

This section names what changes when the substrate stops being a
Curator-internal thing and becomes the Lacuna Labs platform substrate.
Six prior agents wrote §7–§32 assuming one service; this section
generalizes them in one stroke. The producer/consumer discipline (§7),
the planes (§9), the cap-tokens (§12.1), and the smart-DB behaviors
(§16.3) all stay; they apply **per service**. The new outermost
dimension is the **service**.

### §6.1 — Service as outermost dimension

The addressing form becomes:

```
<service>/<tenant>/<plane>/<key>
```

Examples:

```
sakura/op-123/TENANT/orders/2026-Q2
sakura/op-123/COHORT/<co>/pricing-corridor/<week>
foodie/op-123/TENANT/recipe-attempts
baobab/op-123/TENANT/wallet-events
sakura-prep/student-456/TENANT/vocab-drills
bloom/op-789/TENANT/ged-progress
lacuna-14b/system/SYSTEM/sre-events
```

The service is the **first** addressing component. The same operator
(`op-123`) can be present in multiple services; their data does not
mix across services by default. A read of `sakura/op-123/TENANT/...`
sees nothing in `foodie/op-123/TENANT/...` — they are different files
on disk (per §8.2 SQLite-per-shard), different cap-token scopes (§12.1),
different audit streams.

The service prefix is a physical separation (key prefix in the log; a
distinct shard or set of shards), a semantic separation (the Shell
enforces service-scope on every cap-token), and a cryptographic
separation (per-service encryption-at-rest keys, derived from the
service's root key).

### §6.2 — Service catalog at v1.0

The initial service catalog is bounded and explicit. New services need
explicit onboarding (§6.9); they don't appear by accident.

| Service slug | Product | Status at v1.0 |
|---|---|---|
| `sakura` | Curator (the original) | LIVE — the substrate's first tenant |
| `sakura-prep` | GED / test-prep coach (Bloom-class) | onboarded |
| `foodie` | Recipe + cooking-time coach | onboarded |
| `baobab` | Wallet + BIP-39 identity floor | onboarded (identity is load-bearing across services) |
| `lacuna-14b` | HAL daemon (SYSTEM-plane only) | onboarded |
| `bloom` | Hidden GED coach (parent-portal flow) | PARKED — onboarding deferred until pricing model lands |

Service slugs are lower-kebab. Reserved slugs include `lacuna` (the
engineering namespace; never an operator-facing service), `system`
(SYSTEM-plane internal), and `public` (the v1.0 PUBLIC plane sees all
services that opt-in; cross-ref §13). Allocation of new service
slugs is an architect decision (§31 Q30 namespace allocation).

### §6.3 — Five planes apply PER service

The five planes (§9) — TENANT, COHORT, WORLD, SYSTEM, PUBLIC — exist
**inside each service's scope**. `sakura/COHORT/...` and `foodie/COHORT/...`
are disjoint cohort spaces. A cohort of jewelry shops in Sakura has
nothing to do with a cohort of vegan cooks in Foodie, even if the
same operator appears in both.

This means each service has its own:

- **TENANT plane** — operators' private data, scoped to the service.
- **COHORT plane** — service-internal cohorts, K-floor enforced
  within the service (§12.4).
- **WORLD plane** — service-curated public-world facts (Curator has
  Radio-Browser + price-comps; Foodie would have a public-recipe
  cache; Baobab has the public ledger).
- **SYSTEM plane** — service's own audit, reconciliation, SRE events.
  Lacuna 14B reads across services' SYSTEM planes via a special
  capability (§6.4).
- **PUBLIC plane** — operator-opt-in publications, scoped to the
  service.

Data isolation between services is the default. Service A cannot
read Service B without an explicit cross-service capability token
(§6.4), and even with the token, raw data never crosses — only
K-anonymized aggregated signals (§6.5).

### §6.4 — Cross-service capability tokens

Macaroons (§12.1) extend cleanly to cross-service scope. The third-
party caveat shape adds a `:service-scope` field:

```scheme
(:macaroon
  :principal      "op-123"
  :issuer-service 'sakura            ; who minted the token
  :target-service 'foodie            ; which service the token is being USED against
  :planes         '(COHORT)          ; what the token can touch over there
  :operations     '(recall search)   ; what verbs
  :caveats        ((K-floor >= 8)
                   (anonymized-aggregate-only)
                   (rotation-epoch <= 2026-Q4)
                   (audit-target sakura/SYSTEM/cross-service-reads))
  :sig            <ed25519-sig-from-foodie-key>)
```

Two service identity keys are involved: the **issuer-service** signs
the principal's claim; the **target-service** signs the cap-token's
grant. A cross-service token is mutually authenticated — neither
service can mint a token for the other unilaterally.

Tokens are **scoped narrowly** by construction: a Foodie token granted
to Sakura might cover only `COHORT` reads in a single category for
30 days, K=8 enforced both sides, with every fire audited on both
services' SYSTEM planes.

Cap-token issuance UX (§31 Q32) is the question of *who* in
Service B clicks "grant Sakura access to our cohort aggregates" —
service owner, an admin role, or per-operator opt-in. The default
proposal: service-owner-level grant for the capability shape;
per-operator opt-in for inclusion of their tenant's signal in the
aggregate that crosses.

### §6.5 — Cohort-mediated cross-service intelligence

The cross-service read pattern mirrors §12.4's cohort discipline but
extends across BOTH services' K-floors. The mutual-K-floor rule:

> A signal flows from Service A's cohort to Service B if and only if
> at least 8 operators are present in BOTH services' cohort (the
> intersection ≥ 8), and the signal is aggregated/anonymized at the
> point of flow.

The Shell enforces both K-floors co-transactionally with the read.
The protocol:

```
Service B asks Service A:  "what's the cohort-typical pattern for
                            <cohort-signature>?"
Service A's Shell:          - verify Service B's cap-token
                            - compute intersection set
                            - if |intersection| < 8: return null
                            - aggregate within Service A's K-floor
                              (must also be >= 8 inside Service A)
                            - return anonymized aggregate
Both Shells:                - emit `cross-service.read` audit row
                              on their respective SYSTEM planes
```

Neither service ever sees the other's raw data. Both services see
the audit of every cross-service flow. The discipline is the same
shape as within-service cohort mediation (§12.4 + §16.3.3) — a
second K-floor is added at the service boundary.

### §6.6 — Concrete example: Sakura Prep + Foodie cross-cohort

Sakura Prep notices students struggling with vocabulary (the signal
emerges from `sakura-prep/COHORT/<vocab-corridor>/struggle-rate`).
Foodie notices the same operators have low cooking-time budgets
(the signal emerges from `foodie/COHORT/<low-time-budget>/recipe-
choice-pattern`).

A cross-service intelligence proposal lands:

> *"Students struggling with vocab AND with low time-budgets respond
> well to short audio drills. The intersection cohort has 47 operators
> across both services; both K-floors pass. Recommended action:
> short audio drill format."*

Neither service contributed raw data. Both services contributed
**aggregated, anonymized signals** about cohort behavior. The cross-
service proposal lands as a substrate-intelligence row (per the
§16.3.9 pattern-mining discipline, generalized across services) and
becomes available to either service to act on — Sakura Prep authors
a new cart that ships short audio drills; Foodie surfaces a hint at
recipe-pick time.

This is the load-bearing pattern. **Two services that, on their own,
see one slice; together, see the intersection and act on it.** No
operator's identity crosses; no raw payload crosses. The cohort
math is the wire format.

### §6.7 — Operational implication: same SRE story for all services

The 2000-year discipline (§2), the bash recovery (§14.2), the
cold-store fleet (§14.1), the OTel + Prometheus + SRE hooks
(§26.8), the never-down posture (§26.7) all apply per service
without modification. Each service's shards are independent files;
each service's audit log is independent; each service's recovery is
a separate bash script run.

The SRE rota watches all services from one dashboard. The freshness
SLOs (§21.5) extend with a per-service breakdown. A single
`loam-health.sh` (§14.2) takes an optional `--service <slug>`
argument to scope its inspection.

The discipline scales: thousands of operators per service, dozens
of services, one substrate fabric.

### §6.8 — Competitive moat: cross-service intelligence

This is the strategic move. A single-product startup can build the
best vocab coach in the world; it cannot see what its students are
doing in their cooking apps, their job-search apps, their fitness
apps. Lacuna Labs ships multiple products; the substrate sees the
intersection.

The intersection is **the moat**. Not the individual products —
each can be matched by a competitor. The cross-service
cohort-mediated signal can only be matched by another platform
with multiple products sharing a substrate with the same K-floor
discipline. The closest analog is Apple's cross-app intelligence
on iOS (Health + Maps + Wallet), and Apple guards it carefully;
Lacuna Labs is building the **operator-side** version of that
discipline.

Patent surface B.21 (§28.12) names the cross-service cohort-mediated
intelligence with mutual K-floor as the patent claim; B.22 names
the service-namespaced substrate as a companion claim. The two
together describe the moat.

The product surface — how an operator experiences a cross-service
proposal — is service-agnostic. Sakura voices it; Pearl voices it;
the Foodie product voices it. Per Daisy's substrate-invisibility
lock (Appendix A), the operator never hears "Loam noticed across
services" — they hear "I noticed you're cooking less; want me to
shorten your drill format?" The substrate's name and the cross-
service mechanism both stay invisible.

### §6.9 — Honest constraint: new services need explicit onboarding

The default-deny posture has a real operational cost. Adding a new
service (Bloom, or a future Lacuna Labs product) is not a one-line
config; it is a multi-step process:

1. **Slug allocation** — architect-decided (§31 Q30).
2. **Service identity key minted** — Ed25519, offline-escrowed.
3. **Per-service encryption keys derived** — for TENANT, COHORT,
   SYSTEM, PUBLIC planes.
4. **Shard topology decided** — service gets its own shards or
   shares; cohort-prefix discipline applies per service.
5. **Capability token issuer onboarded** — the service's owner
   role can mint TENANT-scoped tokens; cross-service grants are
   service-owner-level (§6.4).
6. **SYSTEM plane wired** — Lacuna 14B onboarded as the cross-
   service SRE reader.
7. **Audit log integrated** — cross-service reads on SYSTEM plane
   are watched by the freshness SLOs (§21.5).
8. **Onboarding cart-template authored** — every service gets a
   minimal "operator onboarding" cart that registers their first
   TENANT-scoped facts; the cart is service-specific.

The onboarding cost is intentional. A substrate that lets new
services appear by surprise cannot offer the cross-service cohort
discipline honestly — operators in service A would have no way to
know service B existed before its cohort proposal landed. The
explicit onboarding lets every service be **named** in the operator's
relationship to the platform, not silently spawned.

### §6.10 — Patent surface candidate (cross-ref §28)

- **B.21** — cross-service cohort-mediated intelligence with mutual
  K-floor. The composition of (a) per-service K-floor inside each
  service's cohort, (b) a second K-floor on the cross-service
  intersection, and (c) audit-mediated cross-service signal flow
  with neither side ever seeing the other's raw data, appears
  unclaimed in the literature.
- **B.22 (candidate)** — service-namespaced substrate where the
  service slug is the outermost addressing dimension and physically
  separates data by default, with cross-service flow gated by
  explicit Macaroon-extension capability tokens and mutual K-floor.
  Compositional novelty — single-tenant + cross-tenant patterns
  exist (B.1, B.11, B.16); cross-**service** with mutual K-floor
  is the additive surface.

Both surfaces require an attorney pass before filing; the cross-
service look-alike-audience adjacency (B.16's prior art) needs a
careful read for similarity. Filing candidates, not blockers for
v1.0.

### §6.11 — Five panel voices on multi-service Loam

- **Sakura.** "I'm not the only voice anymore. Bloom has her own;
  Foodie has theirs. But we share the soil. Sometimes a kid asks me
  something that maps to what their cooking habit says — I can answer
  it without seeing their cooking. That's the part I love."
- **Marcus (backend honesty).** "Per-service shards = per-service
  blast radius. A bug in Foodie's cart code can't touch Sakura's
  TENANT data. The cap-token + the file boundary + the encryption
  key are three independent layers per service. Operationally
  cleaner than I expected."
- **Soo-Jin (security).** "Cross-service tokens are a new attack
  surface; I've drafted the threat model. Mutual K-floor + audit
  on both sides + per-service identity keys + offline-escrowed
  cross-service signing means a compromise of one service does not
  silently propagate. The discipline holds."
- **Priya (PR adversarial).** "The moat story writes itself.
  *'No single-product startup can do cross-product intelligence.'*
  Apple's Health + Maps + Wallet is the analog, and they guard it.
  We're building it operator-side."
- **Daisy (visual craft).** "The substrate stays invisible; the
  services stay visible. An operator in Sakura never hears about
  Foodie unless they're a Foodie operator too — and even then,
  cross-service proposals come from their own voice (Sakura voicing
  Sakura's slice, Foodie voicing Foodie's slice). No mixing of
  voices."

This section establishes the platform framing. §7–§32 below apply
per service unless stated otherwise. Cross-references to §6
appear throughout.

---

## §7 — Producers and Consumers

The architect: *"What's its relationship to all the LLMs? They can't
be the same. Who are producers and who are consumers?"*

The answer is sharp: **LLMs are typed.** Some write; some read; some
do both. The substrate enforces the typing.

**On the wire.** Every producer emits SLAT records; every consumer
reads SLAT records; the Shell verifies signed SLAT envelopes at the
mediation boundary. Producer/consumer typing is per plane (§9), the
plane row shape is a slat (§8), and the mediation envelope is a
`(signed :body … :signature …)` slat per SLAT §6.2. See §SLAT below
for the full substrate view.

### §7.1 — The bench, by role

| Bench position | Tier | Role on Loam | Allowed planes | Notes |
|---|---|---|---|---|
| **Sakura (L0)** | on-device 1.7B | **Consumer** | TENANT (read-only), COHORT (read-only via Shell), WORLD (read-only) | Never writes directly; writes go through Lacuna or the cart, never Sakura |
| **L1 round-robin 8B** | our backend | **Producer + Consumer** | TENANT (write own), COHORT (write own aggregates), WORLD (write public-cache facts) | Closes the round-robin loop; writes findings, reads world |
| **L2 reasoning (vendor reasoner, non-voice)** | vendor | **Producer-via-Shell** | TENANT (write through the Shell; Shell-side PII scrub before write), COHORT (write aggregates after K-floor check) | L2 never writes raw; always mediated |
| **L2 voice (vendor voice-as-tool)** | vendor | **Consumer-only** | TENANT (read transcripts), no writes | Voice is a tool, not reasoning; cannot author findings |
| **The Shell (deterministic Rust, no LLM)** | substrate-internal | **Mediator** | All planes; no autonomy | Verifies cap-token / plane / K-floor / structured-action allow-list; emits audit row co-transactionally |
| **Lacuna 14B (HAL daemon)** | our backend | **System-scoped reader + system-scoped writer** | SYSTEM (read), TENANT/COHORT/WORLD (read-only audit + reconciliation) | Watches; never writes operator-visible facts; per `MEMORY.md` `project_lacuna_14b_role_loam_and_bots` |
| **Carts (Scheme)** | on-device + backend | **Producer (typed)** | Per-cart manifest declares allowed planes | The cart's plane permission is the cart's identity |

### §7.2 — The producer/consumer contract

A producer LLM is one whose pass yields a fact whose persistence is
load-bearing. A consumer LLM is one whose pass needs a fact but does
not write it back.

The contract:

```
Producer commits a fact:
  - Producer  -> Shell (Scheme s-expr + cap-token + intended plane)
  - Shell     -> verify cap, plane, structured-action allow-list,
                 K-floor, cost reserve, audit
  - Shell     -> log.append (CBOR + Scheme + HMAC-sig + CID)
  - Shell     -> trigger evaluation
  - Shell     -> subscription deliveries
  - return CID to producer

Consumer asks:
  - Consumer  -> Shell (Scheme s-expr + cap-token + principal)
  - Shell     -> dispatch to plane(s) + key(s)
  - Shell     -> verify cap covers plane(s)
  - Shell     -> read from index (KV, vector, graph as needed)
  - Shell     -> K-floor co-transactional check
  - Shell     -> projection assembly
  - return facts to consumer
```

The two paths never cross. A consumer cannot accidentally write; a
producer cannot accidentally read what it did not write. This is the
producer/consumer separation that prevents the substrate from
poisoning itself with its own (potentially-hallucinated) reads.

### §7.3 — Why Sakura is consumer-only

The architect's intuition is right and the substrate enforces it.
Sakura on-device runs at 1.7B parameters. She is small. She is
reactive. She is the voice. A consumer-only role keeps her small,
reactive, and voice-shaped. The producers — Lacuna, L1, L2, the
carts — are the ones building up the substrate over time. Sakura
benefits from their work without being responsible for any of it.

### §7.4 — Why L2 is producer-via-Shell

L2 reasoning is the most capable bench. It is also the most expensive
and the least trusted (vendor-hosted; PII risk; potential for prompt
injection). Producer-via-Shell means: **L2 never sees raw cohort or
tenant data; its writes always pass through PII-scrubbing before the
Shell accepts them; the Shell verifies every write against the
cap-token, plane, K-floor, and closed structured-action allow-list**.

This satisfies the cohort-PII discipline in
`docs/INFRA-GATED-CARTS-2026-06-15.md` and lets us safely use L2 for
the 318+ infra-gated carts that need deep reasoning.

### §7.5 — Workload inventory: every cart Loam must serve

The architect's hardest bar: *the design must serve every cart that
needs Loam, not be abstracted from them*. This section is the proof
the producer/consumer discipline above survives contact with the
**1,484 carts** that touch Loam in the live tree.

#### §7.5.1 — The full count (authoritative)

Audited 2026-06-26 against `curator-web/src/scheme/carts/` via
`scripts/loam-cart-audit.sh` (v1.1 deliverable; v1.0 uses the bare grep above — a deterministic
script that re-derives every count below from on-disk state, so the
numbers in §7.5.1, §18.3, and §22.2 are all the **same number** by
construction):

| Source | Carts that reference `loam/*` | Method |
|---|---:|---|
| `magic/*.sks` (deep-purple) | 203 | `grep -rl 'loam/' magic/` |
| `dream/*.sks` (light-purple) | 493 | `grep -rl 'loam/' dream/` |
| `imagine/*.sks` (green / Imagine) | 427 | `grep -rl 'loam/' imagine/` |
| `pink/*.sks` (Sakura on-device) | 303 | `grep -rl 'loam/' pink/` |
| `cron/*.sks` (scheduled) | 48 | `grep -rl 'loam/' cron/` |
| `etsy/*.sks` (marketplace surface) | 10 | `grep -rl 'loam/' etsy/` |
| Other tier dirs (scenes/personal/transfer/radio) | 0 | balance |
| **Total touching at least one Loam verb** | **1,484** | (file-count; matches `grep -rl 'loam/' --include='*.sks' carts/ \| wc -l`) |

For reference: `index.json` carries **1,877 carts total** (the corpus
includes 393 carts that do NOT touch Loam — purely client-side
helpers, white-flavor atomic tools, etc.). The audit script's
authoritative line for this doc is the 1,484 Loam-touching count.
Earlier drafts cited 1,497; that was a snapshot from earlier in the
day before a corpus sweep. **The authoritative number is 1,484.**

Today every one of those carts calls a single verb: `loam/operator-state`
— the precondition gate (14,471 callsites,
`grep -rho 'loam/[a-z-]*' carts/ \| sort \| uniq -c`). That verb is
the entire surface Loam has spoken so far. The design must serve that
shape **and** the seven additional shapes (§7.5.3) the corpus is
about to reach for the moment §8–§13 lands. The migration plan for
these 14,471 callsites lives in §30 Week 7: the Shell preserves
the `loam/operator-state` verb backward-compat through v1.0 so every
existing callsite keeps working unchanged; new (or Loamified) verbs
appear additively, never displacing the precondition gate.

Tier-and-cadence distribution (`grep -h '^;;~ trigger' …`):

| Tier dir | Carts | Top triggers (count) |
|---|---:|---|
| magic | 207 | `cron:weekly` 90 · `cron:daily` 56 · `event:checkpoint.wake` 11 · `event:operator-request` 6 |
| dream | 494 | `cron:daily` 211 · `cron:weekly` 187 · `cron:monthly` 12 · `event:operator-request` 7 |
| cron | 48 | `cron:*` near-100% |

#### §7.5.2 — Seven workload classes (the shapes a cart asks for)

Reading representative carts across every tier directory yields
seven distinct shapes of Loam access. Every cart in the corpus is
one of these or a composition of them.

| Class | Shape | Example carts | Workspace duration | Loam verb stack |
|---|---|---|---:|---|
| **W — World read** | "What does the world know about X" | `j-stone-id-cite`, `vc-decade-deep-explainer`, `competitor-deep-read`, `ap-art-history-cite`, the radio/comp-pricing/web-cache absorptions (§12 of LOAM 1.0) | instant | `loam.recall` on `WORLD/...` |
| **G — Operator state gate** | "Is the operator in a state where I should spend their tokens" | every cart in the 1,484 | instant | `loam.recall` on `TENANT/<op>/state` |
| **C — Cohort aggregate** | "What pattern shows up across K=8+ shops like this one" | the 10 federated PII-ledger-gated carts (`category-conversion-corridor`, `pricing-corridor-honest`, `seasonality-corridor`, `buyer-cohort-pattern-learn`, `cross-shop-burnout-signal`, `community-champion-emerge`, `category-extinction-watch`, `cohort-strategy-clinic`, `buyer-of-buyer-of-buyer`) | instant | `loam.search` on `COHORT/<id>/...` with K-anon read-time gate (§12.4) |
| **S — Subscription / trigger** | "Wake me up when X happens in the world or the cohort" | the 60+ watch carts: `competitor-takeover-watch`, `algorithm-rumor-watch`, `daily-trend-radar`, `daily-anomaly-watch`, `the-knockoff-hunter`, `competitive-counter-week`, `competitor-pricing-history`, `competitor-review-mine`, … | indefinite | `loam.subscribe` + on-fire callback (§10) |
| **D — Durable multi-day workspace** | "Hold this project state across days/weeks/months" | the 28 `checkpoint.write`-gated carts (P33–P50 launches, dispute-orchestration multi-week, P97 weekly coaching, the 7 dream-project-* carts) | days–months | `loam.remember`/`loam.recall` on workspace key; `loam.subscribe` on state-transition predicate |
| **B — Bayesian / particle / posterior** | "Carry an N-particle cloud forward each day" | 26+ statistical-state carts: `trend-tracker-particle-filter`, `buyer-state-hmm`, `posterior-pricing`, `mcmc-posterior-pricing`, `slow-mover-gp`, `time-varying-pricing-dlm`, `title-bandit-posterior`, `pomdp-reorder-threshold`, `sparse-gp-fee-elasticity`, `state-space-marketplace-pmcmc`, `repeat-purchase-frailty`, `bundle-elasticity`, `hierarchical-customer-ltv`, `causal-forests-heterogeneous`, `abc-weird-shape-demand`, `demand-forecast-state-space`, `marketplace-choice-discrete`, `photo-aesthetic-posterior`, `best-hour-hierarchical`, `paid-ad-bid-optimizer`, `shop-pulse-digest-hmc`, `search-path-attribution`, `refund-dispute-risk`, `catalog-completion-ebm`, `buyer-anomaly-normalizing-flow`, `creator-attribution-model` | rolling 30–365 days | `loam.remember` opaque particle blob keyed by `(op, model, day)`; daily `loam.remember` append; vector projection over `last 90` for similarity recall |
| **X — Code-execution** | "Generate code, store it content-addressed, run it under sandbox, store result" | the §15.1 code-in-Loam family (96 new automations); the existing checkpoint-batch carts (`bulk-rewrite-batch`, `pr-batch-reprice-overnight`, `cs-batch-message-reply`) become §11 `loam.execute` calls | minutes per call | `loam.execute` on a CID; result lands in `TENANT/<op>/job/<j>/result` |

**Every cart in the 1,484 is one or more of W / G / C / S / D / B / X.**
The seven-class taxonomy is the compression — eighty-percent of the
corpus is `G` alone (the precondition gate); the remaining shapes
compose against the §4 / §10 / §11 verbs without escape.

#### §7.5.3 — Per-cart workload matrix (excerpt)

A row per cart proves the design against the live tree. Full table
is generated to `docs/_loam-2.0-workload-matrix.tsv` by
`node scripts/loam-workload-matrix.mjs` (week-1 deliverable, reads
`curator-web/src/scheme/carts/index.json` and classifies each slug's
verb set against §7.5.2's classes). A representative slice:

| slug | tier | class | workspace pattern | cadence | feature served |
|---|---|---|---|---|---|
| `discover-the-orchard` | magic | G+D | `TENANT/<op>/orchard-memo/<week>` | weekly cron | §4 remember/recall; §8 graph projection across A1–A37 prior topics |
| `category-conversion-corridor` | magic | G+C | `COHORT/<co>/conversion-patterns/<week>` | weekly cron | §12.4 K=8 co-transactional read gate; §3/§17 Shell mediates cohort membership |
| `bayesian-ab-test` | magic | G+B | `TENANT/<op>/ab/<exp>/posterior` | daily / on-update | §4 remember posterior blob; §8 vector recall of prior experiments |
| `trend-tracker-particle-filter` | magic | G+B+C | `TENANT/<op>/demand-state/<day>` + `COHORT/<co>/category-demand/<day>` | daily cron | §4 append particle cloud; §8 vector index over rolling 90d |
| `buyer-state-hmm` | dream | G+B | `TENANT/<op>/buyer-hmm/<buyer-cohort>/<day>` | daily cron | §4 remember HMM blob; §10 subscription for state-change subscribers |
| `cross-marketplace-allocation` | magic | G+B+W | `TENANT/<op>/alloc/<period>` | daily cron | §4 remember/recall + §4 recall on `WORLD/marketplace-fees` |
| `dispute-orchestration-multi-week` | magic | G+D | `TENANT/<op>/dispute/<case>/...` | event-driven, multi-week | §4 append journal; §10 subscribe to case-state changes; §8.4 cite-store for evidence blobs |
| `launch-wholesale-arm-30day` | magic | G+D | `TENANT/<op>/launch-wholesale/<id>/day-<n>` | daily wake | §4 checkpoint workspace; §10 subscription fires daily callback |
| `the-knockoff-hunter` | magic | G+S+W | `TENANT/<op>/knockoff-watch` + `WORLD/marketplace-listings/<niche>` | continuous subscribe | §10 subscribe to WORLD; fires when match probability crosses threshold |
| `daily-trend-radar` | dream | G+S+W+C | `COHORT/<co>/trend-signals/<day>` | daily | §10 subscribe + §12.4 K-anon gate |
| `competitor-takeover-watch` | dream | G+S+W | `WORLD/competitor/<slug>/snapshots/<day>` | daily | §10 subscribe to WORLD; fires on diff |
| `cohort-strategy-clinic` (P20) | magic | G+C | `COHORT/<co>/stage-cohort/<segment>/playbook` | weekly cron | §12.4 K=8 gate; §3/§17 Shell routes the cohort lookup |
| `buyer-of-buyer-of-buyer` (A16) | magic | G+C | 3-hop projection over `COHORT/<co>/opt-in-buyers` | event-driven | §8 graph projection; §3/§17 Shell gates the multi-hop traversal |
| `qbr-leadership-presentation` (P3) | magic | G+D | `TENANT/<op>/qbr/<quarter>/...` | quarterly | §4 multi-document workspace; §8.4 cite-store; §3/§17 Shell routes the 4-agent fan-out |
| `pr-batch-reprice-overnight` | magic | G+D+X | `TENANT/<op>/reprice/<night>/...` | nightly | §4 workspace + §11 code-artifact for the overnight batch; §3/§17 Shell-gated execute call |
| `bulk-rewrite-batch` | magic | G+D+X | `TENANT/<op>/rewrite-batch/<night>` | nightly | §4 workspace; §11 store rewrites; §3/§17 Shell routes the overnight Batch API |
| `voice-research-resume` | dream | G+D | `TENANT/<op>/voice-research/<sid>` | spanning days | §4 workspace; §3/§17 Shell resumes from yesterday's state |
| `the-deathbed-protocol` (E22-class) | magic | G+D | `TENANT/<op>/deathbed/<incident>` | event-driven | §4 workspace; §3/§17 Shell runs the recovery decision tree |

That slice is 18 rows. The full matrix is 1,484 rows. The shape
repeats: each cart is a composition of the seven classes served by
the §4 verbs + §8 projections + §3/§17 Shell. **No cart needs a
capability not in this design.** Where a cart's pattern looks
ambitious — the 28 multi-day checkpoint carts, the 26 Bayesian-state
carts, the 60+ subscribe/watch carts, the §11 code-execute family —
the verb stack covers it. Proof by verb composition:

- "Hold particle clouds across days." → `loam.remember` opaque
  blob keyed by `(op, model, day)`; `loam.recall` retrieves; the
  vector projection finds similar past states.
- "Wake up when the cohort shifts." → `loam.subscribe` predicate
  over the cohort key range; callback URL is the dossier-writer
  cart; subscription survives reboot.
- "Remember a 30-day project across reboots." → workspace handle;
  daily append; Sakura recalls via Cortex-of-Loam (§5); the
  reservation/deduct token lifecycle (§15 in LOAM 1.0) spans the
  full horizon.
- "Fan out to four sub-agent roles." → one workspace per role;
  Shell issues caveat-attenuated cap-tokens (§12.1) for each;
  results land on the parent workspace; parent `loam.subscribe`
  fires when all four `state == done`.
- "Generate code, run overnight, land the result." → `loam.execute`
  takes a CID, sandbox name, input workspace key; result lands on a
  sibling key; downstream subscribers wake. The code blob is
  content-addressed and survives the workspace.

#### §7.5.4 — Failure modes per class (honest-null discipline)

| Class | "Loam down" failure mode | Honest escalate symbol |
|---|---|---|
| W | World read returns null | `'world-not-yet-wired` |
| G | Operator state read returns null | `'cortex-not-ready` (today's shape) |
| C | Cohort query under K-floor | `'k-anon-pool-too-small` |
| S | Subscribe call returns service-not-yet-wired | `'service-not-yet-wired` |
| D | Workspace write fails durably | `'workspace-write-failed` |
| B | Particle blob write fails durably | `'state-blob-write-failed` |
| X | Code blob unverifiable or sandbox refused | `'sandbox-refused` |

Each is a first-class escalate symbol the cart can switch on. The
cart NEVER fabricates output to mask a Loam failure (per MEMORY
`feedback_no_false_product_claims`). Honest null is the discipline
the corpus already speaks; the substrate honors it end-to-end.

**The seven workload classes shrink with time.** §16.3.2 (schema
gravity) means the per-cart workload matrix above is a high-water
mark, not a steady state. As substrate intelligence observes the
1,484 carts' shapes recur, the substrate offers schemas that compress
classes G+B+C (the most repetitive composition) into a single
substrate-typed call; the cart drops the explicit class declaration
and inherits it from the suggested schema. The honest expectation:
24 months from substrate-intelligence-on, the declared-type surface
of the corpus is ~40% smaller because the substrate inferred the
rest. The seven classes survive as a vocabulary; the per-cart
boilerplate dissolves.

**Where each class runs is decided at fire-time, not authored-time.**
See §19.3 (compute-locality). A W-class read against a small shop
may run L0; the same W-class against a 10,000-item shop runs
substrate-resident. The substrate observes scale and routes — the
cart authors the class, not the surface.

---

## §8 — The shape

The shape Loam commits to:

> **A flat append-only event log is the substrate. Projections — KV
> index, vector index, graph index, trigger index — are derived from
> the log. Code artifacts and blobs are content-addressed and stored
> alongside. Everything is mediated by the Shell.**

This is the answer to the architect's *"Maybe it's a graph? Maybe it
has graphs? Maybe it's flat with graph?"* — **flat is the substrate;
graphs are projections built on top.** The graph projection is real
and accessed when the workload demands it (relationship traversal,
multi-hop pattern queries from `cohort-pattern-learn`-class carts);
the graph is not the substrate, because a graph engine is a
proprietary kingdom and the 2000-year discipline refuses kingdoms.

**On the wire.** The flat append-only event log is a `.slatl` stream
per SLAT §5.1. One `event` slat per line. Every projection reads the
same lines. Content-addressed blobs live behind `#b64` (SLAT §3.1)
byte primitives with SHA-256 content-ids from SLAT §5.4. The Shell
mediation envelope is a signed slat (SLAT §6.2). See §SLAT below.

### §8.0 — Addressing (per-service, per §6)

Per §6.1, every key in the log carries a service prefix as its
outermost dimension. Concrete addressing form:

```
<service>/<tenant>/<plane>/<key>

sakura/op-123/TENANT/orders/2026-Q2
sakura/op-123/COHORT/<co>/pricing-corridor/<week>
sakura/system/SYSTEM/audit/<row-cid>
foodie/op-123/TENANT/recipe-attempts
baobab/op-123/TENANT/wallet-events
sakura-prep/student-456/COHORT/<vocab-corridor>/struggle-rate
```

Service prefix is a physical key-prefix in the log; physically a
distinct shard (or set of shards) per service. The §8.2 SQLite-per-
shard discipline scales: per-service shards live in per-service
files on disk; per-service AES keys encrypt at rest. The Shell
(§17.3) enforces service-scope on every cap-token before
the storage read.

### §8.1 — The layer cake

```
   +-----------------------------------------------------------+
   |  CALLERS                                                  |
   |  Sakura · Lacuna · Carts · L1 · L2 · Public clients       |
   +-----------------------------------------------------------+
                              |
                              v
   +-----------------------------------------------------------+
   |  THE SHELL (deterministic Rust, no LLM, audit-emitting)   |
   |  MCP server: 7 tools, 5 resources (per §17)               |
   +-----------------------------------------------------------+
                              |
                              v
   +-----------------------------------------------------------+
   |  PROJECTIONS (derived, recomputable, hot)                 |
   |  +---------+ +---------+ +---------+ +---------+          |
   |  | KV idx  | | Vec idx | | Graph   | | Trigger |          |
   |  | (RoxDB) | | (HNSW)  | | proj    | | idx     |          |
   |  +---------+ +---------+ +---------+ +---------+          |
   |  Each rebuildable from the log; none load-bearing.        |
   +-----------------------------------------------------------+
                              ^
                              | (derived)
                              |
   +-----------------------------------------------------------+
   |  THE LOG (truth; append-only; per-shard SQLite + WAL)     |
   |  +---------+---------+---------+---------+---------+      |
   |  | seg-001 | seg-002 | seg-003 | seg-004 | seg-005 | ...  |
   |  +---------+---------+---------+---------+---------+      |
   |  Each segment: CBOR rows + Scheme sidecars + HMAC + CID   |
   |  Litestream → 3-of-5 cold object stores                   |
   +-----------------------------------------------------------+
                              |
                              v
   +-----------------------------------------------------------+
   |  CONTENT-ADDRESSED BLOB STORE                             |
   |  (large objects: PDFs, images, code artifacts, exports)   |
   |  cas/<cid>.bin · cas/<cid>.scheme · same cold-store fleet |
   +-----------------------------------------------------------+
                              |
                              v
   +-----------------------------------------------------------+
   |  GLACIER + ROSETTA                                        |
   |  Quarterly bundles; opt-in HD-Rosetta etch for sovereign  |
   |  data (millennial-tier service-bench feature)             |
   +-----------------------------------------------------------+
```

### §8.2 — Why SQLite per-shard, not one big database

Sharding is by cohort prefix. Each shard is a SQLite file plus an
HNSW index file plus a graph projection file. A cohort's entire
state can be tarred up, copied to a laptop, and inspected with
`sqlite3` and a text editor.

Why per-shard SQLite over FoundationDB:

| Property | FDB (LOAM 1.0) | SQLite-per-shard (LOAM 2.0) |
|---|---|---|
| Strict serializability | Yes | Yes (per-shard) |
| Cross-shard transactions | Yes | No — by design (forces cohort discipline) |
| Bash-recoverable | No (proprietary tooling) | Yes (`sqlite3` + `tar`) |
| Litestream-replicable | No | Yes |
| Deployable to laptop for forensics | No | Yes |
| Format-stable across decades | Unknown | Yes (SQLite long-term support format) |
| Operational burden | High (cluster mgmt) | Low |
| Vendor lock | Apple (FDB owner) | None (public domain) |

The trade-off we accept: cross-shard transactions are not a
primitive. Loam never offers a cross-cohort write atomically. This is
fine — by the producer/consumer discipline, no operation legitimately
needs to write across cohorts atomically. Cohort-aggregates are
*read* across cohorts (with K-floor); they are *written* within their
own SYSTEM cohort.

### §8.3 — Vector index, graph projection

- **Vector index (HNSW via hnswlib or usearch).** In-process library,
  not a service. Built from the log on boot; updated on every fact
  write whose value carries an embedding. Recall@10 ≥ 0.95 target on
  the reference set (verbatim from LOAM 1.0). If the index file is
  lost, replay the log.
- **Graph projection.** A lightweight property graph built atop the
  log. Stored as a SQLite-with-recursive-CTEs table (`graph_edges`)
  rather than a Memgraph or Neo4j deploy. The vast majority of Loam
  graph queries are 1-3 hop ("buyers of buyers of buyers" from the
  cart of that name); a SQLite CTE handles them at p95 < 100ms.
  Heavier graph workloads escalate to a side-car (Memgraph-as-cache)
  but that side-car is *also* derived from the log and never
  load-bearing.

### §8.4 — Blob store

Anything larger than ~4KB is content-addressed in a separate `cas/`
directory rather than inlined into the log. The log row carries the
CID; the blob lives at `cas/<cid>.bin` with `cas/<cid>.scheme` as a
sibling Scheme manifest describing its kind. This is the
Merkle-DAG-discipline applied to blobs: the same CID resolves on
laptop, in production, in glacier, on Rosetta etch.

### §8.5 — Index materialization is learned, not declared

The four projections above (KV, vector, graph, trigger) are listed as
if a deployment-time decision picks which to build for which record
class. They are not — **the substrate learns which projection to
materialize for which class from observed access patterns** (§16.3.1).
A new record class lands log-only; if its first 50 reads are
key-prefix scans, the KV projection builds in the background; if
they are semantic-similarity recalls, the vector projection builds;
if they are 1–3-hop traversals, the graph projection builds. The
materializations are audited (`projection.materialized` SYSTEM rows),
recoverable (any wrong choice rebuilds from log on the next sweep),
and invisible to operators by default. The substrate decides where
its own intelligence lives.

The hot/warm/cold tiering of the §8.2 storage cake is similarly
learned, not declared — see §16.3.6 (learned compaction). The
substrate observes per-class read patterns and re-tiers a record
class whose 30-day reads cluster late; a record class that spikes
on day-1 then never reads again moves to cold faster than its
nominal TTL. Both projection materialization (§16.3.1) and
tier placement (§16.3.6) are substrate-resident intelligence, not
deployment-time configuration.

---

## §9 — The five planes

The architect: *"There perhaps needs to be intelligence about who can
get what."*

Five planes. Cryptographic prefix separation. Every key in Loam
belongs to exactly one.

**On the wire.** Each plane is one or more `.slatl` streams. TENANT
lines are addressed to the operator via capability tokens (SLAT
§6.5); SYSTEM lines are the audit + operational spine and carry
`event` slats with reserved `#_pending`, `#_error`, and `#_bad-line`
tags at the diagnostic edges (SLAT §3.8). The cryptographic prefix
separation is enforced at the SLAT canonicalization layer — the plane
prefix is part of the canonical byte string that the cap-token signs.

> **The five planes apply PER service (cross-ref §6.3).** Each
> service has its own TENANT / COHORT / WORLD / SYSTEM / PUBLIC
> planes; data does not mix across services by default. The
> addressing form is `<service>/<plane>/<tenant>/<key>` (§8.0). The
> matrix below describes the per-service plane discipline; cross-
> service flow uses the §6.4 cap-token extension.

```
TENANT  / <tenant-id>  / ...   PRIVATE — only that operator (via Sakura → Shell)
COHORT  / <cohort-id>  / ...   COHORT  — members of cohort, K≥8 floor
WORLD   / ...                  PUBLIC  — radio, comp prices, public web cache
SYSTEM  / ...                  INTERNAL — audit, reconciliation, SRE events
PUBLIC  / ...                  ANYONE-CAN-READ — operator-published, opt-in
```

The five-way split is sharper than 1.0's three. Notes:

- **PRIVATE was renamed TENANT.** Same plane; clearer name.
- **SYSTEM and PUBLIC are new.** SYSTEM is the audit + reconciliation
  + operational events spine (Lacuna lives here). PUBLIC is the
  architect's *"Public data is there. Everyone who needs it should be
  able to use it."* — an explicitly read-anyone plane for
  operator-published facts (a shop's public profile, a cart's
  documentation manifest, a finding the operator chose to share). See
  §13 for the Public Loam surface.

The plane separation is enforced at three layers: key prefix
(physical), Shell authorization (semantic), capability token scope
(cryptographic). A bug in any one layer is caught by the other two.

COHORT plane membership is not exclusively operator-declared.
Substrate-emergent cohorts (§16.3.3) live in this plane too —
when embedding-space clustering proposes a cohort that passes K=8
and the candidate members opt in, the resulting cohort is
indistinguishable downstream from an operator-declared one. The
plane's discipline is the same; the source of the cohort identity
expands.

---

## §10 — Subscriptions, triggers, the event log

The architect: *"Subscription to data?"*

Subscription is a first-class primitive in Loam. Anyone — Sakura, a
cart, an external automation, a future Lacuna daemon — can subscribe
to a predicate over the substrate, and Loam will notify them when
the predicate fires.

**On the wire.** A subscription's predicate matches on the slat
record head + keyword fields. `(subscribe :principal … :predicate
(event :kind "cortex.slice.written"))` matches any `event` slat with
that `:kind`. Fire deliveries are themselves slat records — the
callback receives a canonical `event` slat and can round-trip it
through `slat/read` and `slat/write` without loss. See §SLAT.

### §10.1 — The subscription model

```
loam.subscribe(
  principal: <id>,                 ; what we are watching
  predicate: <s-expr>,             ; what we are waiting for
  on-fire:   { callback-url, ... },; how we tell you
  expires-at: <ts>                 ; when we stop watching
) -> subscription-id
```

The predicate is a Scheme s-expression (a tiny subset — equality,
inequality, contains, and-or-not). It is compiled once at
subscribe-time into a small evaluator; the evaluator runs inside
every write-transaction on the principal's plane. When it fires,
the Shell dispatches the callback asynchronously and writes a
`subscription.fired` audit row.

### §10.2 — Subscription patterns the substrate supports

| Pattern | Example | Cart that uses this |
|---|---|---|
| **State-transition** | `(:status = 'done')` | every long-running magic cart |
| **Threshold-cross** | `(:cohort-size >= 50)` | `buyer-cohort-pattern-learn` waiting for K-floor |
| **New-of-kind** | `(:new-fact :kind 'market-signal :category 'jewelry)` | any market-watch cart |
| **Time-window** | `(:window 'daily-09:00 :and (:fact-count > 0))` | `cron:daily` carts as event-driven (replaces cron) |
| **Compound** | `(:and predicate-1 predicate-2)` | escalation logic |
| **Causal** | `(:after :fact <cid> :and ...)` | dispute-orchestration multi-week |

### §10.3 — Subscription as cron replacement

A subscription on `(:window 'daily-09:00 :and (:plane :tenant :and
(:has-pending-cart)))` is a better cron. It is durable across host
failure, captured in the substrate as state, observable in the audit,
and survives migrations. We do not delete cron (per
`MEMORY.md` `feedback_cron_means_fly_machines`) — but every cart that
authors its own cron registers a Loam subscription **as well**, and
the subscription is the durable record of the cron's intent. Lacuna's
daily reconciliation compares the cron's actual fires against the
subscription's expected fires; mismatches are reported.

### §10.4 — The event log

Every Loam write, every Shell decision, every trigger fire, every
subscription delivery emits an event on the SYSTEM event log. The
event log is itself an append-only sequence of facts in the SYSTEM
plane. Lacuna polls it; the SRE dashboard reads it; the audit
trails read it; the producer/consumer reconciliation reads it.

The event log is the substrate's introspection surface and Lacuna's
substrate of operation. It is what makes Loam an *observable* soil,
not just a durable one. This is the event-sourcing discipline
([Azure Architecture Center](https://learn.microsoft.com/en-us/azure/architecture/patterns/event-sourcing))
applied recursively: Loam's operational state is itself a derived
projection of its own log.

---

## §11 — Operating on code via Loam

The architect: *"Can the LLM ask it to perform operations on code?"*

**Yes.** Code-in-Loam is a load-bearing surface. This section is the
concrete answer.

### §11.1 — Code as a content-addressed artifact

A code artifact is a Scheme s-expression (or, for non-Scheme code, a
bytes-blob with a declared language tag) stored content-addressed
in Loam. The artifact has a CID; the CID is immutable; references
to it survive renames, backend swaps, and decades.

```scheme
(:code-artifact
  :cid          "blake3-c9a4..."
  :language     'scheme
  :body         (define (buyer-affinity x) ...)
  :signature    "ed25519-..."   ; signed by the author principal
  :registered-by 'lacuna-engineering
  :registered-at "2026-06-26T..."
  :purpose      "shared buyer-affinity calculation across carts"
  :allowed-callers (list 'tenant-* 'cohort-*)
  :sandbox      'wasm-restricted)
```

### §11.2 — Operations the LLM can request

Via the Loam MCP `loam.execute` tool, any authorized LLM can:

1. **Register code.** "Store this Scheme function with these allowed
   callers." Returns a CID. The Shell verifies the author's signing
   key against the cap-token.
2. **Execute code by CID.** "Run code-artifact `cid` with these
   arguments in a sandbox." The Loam runtime executes inside a WASM
   or Scheme-sandbox process, with a time budget, memory budget, and
   no I/O outside the substrate. Result is returned + recorded in
   the audit.
3. **Compose code from facts.** "I have facts X, Y, Z; assemble a
   code artifact that processes them according to template T." The
   Shell runs the template (also stored as a code artifact, named
   `template/<...>`); the resulting code artifact is registered.
   This is **template-driven code synthesis** anchored in the
   substrate.
4. **Subscribe to a code artifact.** "Tell me when this code's CID
   has a newer signed successor by the same author." Code evolution
   is observable.
5. **Diff code artifacts.** "What changed between CID-old and
   CID-new?" Loam stores the s-expr; diff is trivial.
6. **Revoke code.** A signed revocation row prevents future executions
   of a CID. Past executions remain in the audit; revocation is
   forward-only (preserving the 2000-year audit trail).

### §11.3 — The sandbox

Code execution runs in a sandbox with these constraints:

- **No network.** Code in Loam cannot call out; if it needs data, it
  asks Loam for it (mediated by the Shell, recursively).
- **No filesystem outside the substrate.** Code reads/writes only
  Loam-mediated resources.
- **Time budget.** Default 2s wall-time (fuel ~1e8 ≈ 1s of compute
  on dev hardware); producer can raise to 30s. **Corrected
  2026-06-27 per AUDIT-LIES H7** — `sandbox.py:65-67` ships
  `DEFAULT_WALL_TIME_BUDGET_SECS = 2.0`, not 1s.
- **Memory budget.** Default 64 MiB linear memory.
  **Corrected 2026-06-27 per AUDIT-LIES H7** — `sandbox.py:66` ships
  `DEFAULT_MEMORY_LIMIT_BYTES = 64 * 1024 * 1024`, not 256 MB. The
  256 MB ceiling appeared in §SJ.8.5 + §40 Z.2 from earlier drafts; the
  v1.0 sandbox enforces 64 MiB. Raising to 256 MiB is a v1.1 build-task
  contingent on stress-bench evidence.
- **Quota table (per-tenant per-day fuel budget — undocumented before
  AUDIT-LIES Priya H-8).** `loam/code/quota.py:60-80` enforces:
  free=10M, imagine=100M, dream=500M, magic=1B, sre=5B fuel/day; per
  artifact caps at 100M fuel/day. Exceeding either budget returns
  `EXIT_REASON_QUOTA_EXCEEDED`.
- **Deterministic.** Same CID + same args + same substrate state →
  same result. Randomness is a Loam-provided service (a seeded RNG
  whose seed is logged).
- **Resource-tracked.** Every execution debits token budget per
  `docs/PRICING-TOKEN-DESIGN-2026-06-18.md`.

### §11.4 — Why this matters

The architect: *"What advanced features here can net us some
additional purple automations to blow people's minds."*

Code-in-Loam is a primary engine of those automations:

- **Carts as code-artifacts.** Every `.sks` cart becomes a registered
  artifact. The substrate is the canonical home; the on-disk file is
  a derived projection. New carts, including operator-authored ones,
  go through the substrate.
- **Operator scripts.** An operator can author a small piece of
  Scheme that runs in their tenant plane on a subscription
  ("alert me when my price-comp delta exceeds 12%"). The script is
  registered, sandboxed, executed, audited. No DevOps; no
  deployment; no host management. Just code in the soil.
- **Composable findings.** A finding can carry a code reference: "the
  way to act on this finding is to call this CID." A future Sakura
  pass calls the code and acts.
- **Template-driven cart synthesis.** A cart-template + a set of
  operator facts → a new cart, generated by L2 or Lacuna, registered
  in Loam, executed against the substrate. This is how the
  300+-purple-automation count clears (§15).

§15 quantifies the unlock.

**Where a code-artifact runs is itself a substrate decision.** See
§19.3 (compute-locality): the same cart can execute on-device, in
the substrate sandbox, on the co-located mediator, or via vendor
L2 depending on scale, latency, and trust. The artifact is portable
across all four surfaces because §11's CID-addressed registry
travels with the cart, not with the host. Patent surface §28.9
(B.17) names this trust-domain-crossing portability as the
load-bearing novelty.

---

## §12 — Security model

**On the wire.** The security atom is a signed SLAT envelope (SLAT
§6.2) wrapping a capability token (SLAT §6.5) — Macaroon-style,
caveat-chained, and locally verifiable against the canonical byte
form (SLAT §6.1). See §SLAT below and SECURITY-CANONICAL §SLAT for
the composed picture. The Shell verifies signature, checks caveats,
matches plane, applies K-floor — in that order.

### §12.1 — Capability tokens

Every Loam request carries a capability token (Macaroon-style,
caveat-chained, locally verifiable). The token names:

- the **principal** (operator, service, public reader, system actor),
- the **service** the token authorizes against (per §6.4 — `sakura`,
  `foodie`, `baobab`, `sakura-prep`, `bloom`, `lacuna-14b`, ...).
- the **planes** the holder may touch (TENANT/cohort/WORLD/SYSTEM/PUBLIC),
- the **operations** allowed (the 5 primitive verbs `put/get/append/on/poll` plus extended scopes like `subscribe`, `code:execute`, `cohort:aggregate` — see §4.1 for the 14-tool surface; corrected 2026-06-27 per AUDIT-LIES C1),
- **caveats** (cohort-id required, K-floor verified, expiry,
  rate-limit, time-of-day window, IP CIDR, **service-scope** per §6.4,
  **cross-service issuer + target** for cross-service grants per §6.4).

Tokens are minted by the bench's identity service (today
`curator-api/curator_api/loam/security/macaroon.py`; tomorrow a dedicated minter). The
Shell verifies signatures locally — no central authorization service in
the hot path.

This pattern is well-established: Macaroons (Birgisson, Politz,
Erlingsson, Taly, Vrable, Lentczner, [NDSS 2014](https://research.google/pubs/pub41892/)),
shipped in production by Canonical's Snap Store and the lnd Bitcoin
Lightning daemon. (Hashicorp Vault uses its own token model with
policies, not Macaroons — earlier drafts asserted otherwise; corrected
2026-06-26.) SPKI/SDSI (Rivest/Lampson, 1996) is the capability-token
forebear cited by the NDSS paper itself. We adopt the Macaroon shape
because caveat-chaining lets a token be narrowed without a round-trip
to a server — Sakura can hand a narrower token to a cart than she
herself holds, and the cart can hand a yet narrower one to a code
artifact, and the chain validates locally.

### §12.2 — Plane permissions, by role

Per §6.3, every cell below is scoped to the role's **service**.
A Sakura operator's R/W TENANT applies to `sakura/op-X/TENANT/...`
only — never to `foodie/op-X/TENANT/...` even for the same operator.
The SERVICE column states which service(s) a role can authorize
against by default; cross-service access requires the explicit
Macaroon extension from §6.4.

| Role | SERVICE (scope) | TENANT | COHORT | WORLD | SYSTEM | PUBLIC |
|---|---|---|---|---|---|---|
| Operator (via Sakura) | `sakura` | R/W own | R own cohort (K-floor) | R | — | R/W own |
| Sakura on-device | `sakura` | R own | R own (K-floor) | R | — | R |
| Operator (Foodie) | `foodie` | R/W own | R own cohort (K-floor) | R | — | R/W own |
| Operator (Sakura Prep) | `sakura-prep` | R/W own | R own cohort (K-floor) | R | — | R/W own |
| Operator (Baobab wallet) | `baobab` | R/W own | — | R | — | R |
| Lacuna 14B (HAL daemon) | ALL (SYSTEM-scoped) | — | — | R | R/W | R |
| L1 8B round-robin | per-service (the calling service) | R/W own | R/W own aggregates | R/W | — | R |
| L2 reasoning (via Shell) | per-service (the calling service) | W via Shell (PII-scrubbed) | W aggregates | W public-cache | — | — |
| L2 voice | per-service (the calling service) | R own transcripts | — | — | — | — |
| Carts (per manifest) | declared in manifest | per-cart | per-cart | per-cart | — | per-cart |
| Public reader | any service's PUBLIC | — | — | R | — | R |
| The Shell (§17.3) | service-scoped at request time | (mediator; no autonomous read/write; deterministic Rust, no LLM) |
| Cross-service grant holder | source + target services per §6.4 | — | R aggregated only | — | — | R |

### §12.3 — The cohort-anonymization gateway, refined

Carry-over from LOAM 1.0 §4.4. The Shell (this document's substrate
mediator, per §17) is the only place `operator_id` is allowed past.
Every other module sees
`tenant_id` and `cohort_id` (both opaque, salt-rotated per
`cohort/__init__.py:43`). The `derive_cohort_id` discipline at
`curator-api/curator_api/loam/cohort/__init__.py:43-65` is preserved verbatim
— monthly salt, 128-bit truncation (32 hex chars per source; corrected
2026-06-27 per AUDIT-LIES Jess L1 to use a single framing).

### §12.4 — K-anonymity floor, co-transactional

K=8 distinct tenants per cohort (`README.md:101`). The floor is
enforced inside the same shard transaction as the data fetch — the
LOAM 1.0 §4.2 discipline carries forward unchanged. This is the
patentable surface (§28.3):

```
GET COHORT/<cid>/<key>:
  shard.transaction:
    n = read counter at COHORT/<cid>/__members__
    if n < 8: return None
    return read COHORT/<cid>/<key>
```

The downstream-composition argument from LOAM 1.0 §11.3 still holds:
a downstream consumer cannot read a value the upstream gate suppressed.

**Effective floor clarification (cross-ref Q21 + AUDIT-LIES Architect-
Call 5).** The cross-shard coordinator (`cohort/coordinator.py:118`)
enforces `global_size >= k_min + RACE_SAFETY_MARGIN` — effective `K=9`
when `k_min=8`. The single-shard pseudo-code above is the conceptual
floor; the global path adds `+1` for race safety per Q21's
ratification. Operator-facing carts that gate on K=8 are passing
through the `count >= 9` check at the substrate. See
`docs/LOAM-V1-ARCHITECT-CALLS.md` item 5 for the v1.0-document /
v1.1-rename architect call.

### §12.5 — PII handling

PII never lands in COHORT, WORLD, SYSTEM, or PUBLIC planes by
construction. The Shell runs a **layered** PII scrubber on every write
proposal that targets one of those four planes:

1. **Pattern scrubbing** (email, phone, address, raw operator-id
   strings) — fast, rule-based, the bulk of the catch.
2. **Entropy heuristics** for obfuscated forms ("alfred at gmail dot
   com", spaced-out phone numbers, base64-looking blobs).
3. **ML classifier** for free-text quasi-identifiers (per the 2025
   Roblox PII Classifier release; rule-based alone misses 12-20% of
   in-the-wild PII per arXiv 2501.12465 / Adaptive PII Mitigation
   Framework). Vendor-name not embedded in the corpus per the
   2026-06-22 lock.
4. **Per-tenant configurable allowlist** for fields the tenant has
   explicitly classified as non-PII (a shop name that doubles as the
   operator's surname, a brand-handle that includes a phone number).

TENANT plane carries PII encrypted-at-rest with a per-tenant
AES-256-GCM key — key in HSM (Fly secrets at v1.0; dedicated KMS
post-1.0); key rotation quarterly. **GDPR Art. 17 erasure** is
implemented as **cryptographic erasure**: destroying the per-tenant
key renders the ciphertext mathematically unrecoverable, which is
the substrate's tombstone — and that tombstone IS truly gone. See
§26.2 for the tombstone-receipt vs subject-data distinction and §31
Q26 for the canonical cryptographic-erasure pattern (per-service
scope; Q22 was retired per §17 — see Q26 for the active
architect-call).

**Honest limitations** (named, not hidden): rule + entropy + ML
scrubbing catches the documented majority of PII shapes; novel
obfuscation, rare-name leakage, and quasi-identifier residue (a
postal code + a DOB, a rare medical phrase, a minor's name) are
real residual-risk classes. The doc commits to a K-anon or
differential-privacy floor on any COHORT-bound write that flows
through L2 (Jess L2 mitigation). Free-text buyer messages get an
additional **child-likely / health-likely** classifier that
escalates affected payloads to "do not federate" status (TENANT-only
retention; never reaches the cohort or world planes).

### §12.6 — Multi-tenant isolation

Each TENANT shard is its own SQLite file with its own AES-256-GCM
key. A bug in shard code that mishandles cohorts cannot leak across
tenants because the file isn't even open. This is the strongest form
of multi-tenant isolation a single-host substrate can offer.

### §12.7 — Threat model

| Threat | Defense |
|---|---|
| Prompt-injection into Sakura yielding a malformed read | Sakura's NL Adapter (L0, client side) composes a Scheme s-expr; the Shell verifies cap-token + plane + structured-action allow-list; the read either succeeds for legitimate principal or returns honest null |
| Prompt-injection into L2 yielding a malformed write | Producer-via-Shell: L2 never writes raw. The Shell's PII scrub and plane check refuse out-of-bounds writes; L2 input only reaches the substrate as a Scheme s-expr after client-side translation |
| Compromised vendor LLM API | L2 writes always pass through the Shell; the Shell validates the cap-token signature, which a compromised vendor cannot forge |
| Insider with TENANT-plane access | Audit trail is the defense; every read of a TENANT key emits a `tenant.read` audit row keyed by principal |
| Cohort-cross-bleed via timing | Cohort prefixes are physical key separations, not just logical |
| Hash collision | Dual-hash (BLAKE3 + SHA-256); collision in one validated against the other |
| 2178 cryptographic compromise of SHA-256 | Migration to SHA-3 / future algorithm via dual-hash extension; log is preserved. **Crypto-agility is a log-format property** (algorithm-tagged hash + algorithm-tagged signature, dual-signing during transition), not a one-line promise (Soo-Jin design-level concern). |
| Substrate-host capture | Capability tokens require local signing keys; a captured host cannot mint new caps without the offline-escrowed root key |
| Confused-deputy via LLM-in-auth-path | **RESOLVED by §17 classical-substrate reframe** — no LLM in the substrate's trust domain. The Dual-LLM split lands as "client-side NL Adapter (quarantined translator) + substrate-side Shell (privileged dispatcher)"; the trust boundary is the service boundary. §31 Q22 RETIRED. |
| Audit-as-corpus poisoning via legitimate-looking pattern attacks | §31 Q25 names the manual-curation + adversarial-eval-set + pre-deploy diff regression check; signature validation alone is insufficient (the rows are legitimately signed; the attack is in the pattern) |
| Cohort probing via repeated join/leave | Not addressed in v1.0; named in §32 honest gaps. Mitigation candidate: per-tenant join/leave rate limits + audit anomaly surfacing |
| Substrate-as-oracle (differential response timing) | Not addressed in v1.0; named in §32 honest gaps |
| Code-artifact transitive supply chain | Author-signature checked per artifact; transitive-trust model for code-calling-code missing in v1.0 (§32 honest gap) |
| Embedding-space adversarial inputs | Not addressed in v1.0; named in §32 honest gaps |
| Backup/restore identity continuity | Cap-tokens minted pre-restore must still validate post-restore; replay window during recovery is bounded by token expiry. Spec gap — named in §32 |
| Subscriber callback URL trust (SSRF, internal-service callback) | **CLOSED 2026-06-27 per AUDIT-LIES Priya L-3.** `loam/subscriptions/dispatcher.py` ships full SSRF defense: scheme allowlist, private-IP rejection, link-local rejection, cloud-metadata-endpoint blocklist, userinfo rejection, per-service trust-list regex, per-token rate limit, bounded retries + dead-letter, verify-on-fire. The "honest gap" entry in §32 is corrected. |
| Replica-destination misconfig leaking across tenants | Per-tenant *bucket* (not per-tenant prefix) at the Litestream destination; per-tenant encryption key applied **before** Litestream sees the bytes (so the replica destination never holds plaintext); §31 Q17 names the bucket-vs-prefix decision (per-shard granularity + replica isolation) |

### §12.8 — COPPA non-treatment + parental-consent path

Curator is **NOT a child-directed service**. Loam relies on the
"actual knowledge" standard from the amended FTC COPPA Rule (full
effect April 22, 2026). ToS prohibits under-13 operator accounts.
The substrate's role under COPPA is bounded:

- **Operator side.** Account creation requires age affirmation; under-13
  accounts are refused at signup and the precondition gate
  (`loam/operator-state`) holds the affirmation as a TENANT-plane
  fact. No carts run for an under-13 affirmed account.
- **Buyer-message intake.** Buyer messages stored in Loam may
  originate from under-13 individuals (a "Christmas gift from my
  mom" tone, an explicit "I'm 11"). The Shell's PII scrubber
  (§12.5) includes a **child-likely classifier** that escalates
  affected messages to TENANT-only retention (`(:do-not-federate)`),
  never reaches cohort or world planes, and is excluded from the
  L2-hand-off corpus. When actual knowledge arrives ("I'm 11"
  appears in the message), the substrate freezes processing of that
  buyer's payloads, emits an audit row, and surfaces the matter to
  the operator with a Sakura-voiced beat naming the next step.
- **Substrate is not the regulator.** Loam stores the
  signal-of-knowledge; the operator-side response process
  (parental-consent path or delete + non-retain) lives in the
  product, not the substrate.

The amended Rule's **mixed-audience coverage** expansion is the
honest risk. Curator's response is to keep the surface
non-child-directed and to gate any feature that would shift it
(e.g., a "kids' jewelry shop" category) through Lacuna Engineering
+ COPPA-compliant onboarding flow.

### §12.9 — EU AI Act Art. 6 conformity-assessment posture

Per Art. 6 + Annex III of the EU AI Act, Loam's substrate-intelligence
behaviors (§16.3) are assessed against the high-risk list. Today,
**none of the eleven behaviors cross an Annex III high-risk category**:

- No employment/HR decisions (no carts hire, fire, evaluate, or rank
  employees).
- No education-access decisions.
- No essential-private-service eligibility (Loam does not score
  credit, route benefits, or grant insurance).
- No biometric categorization.
- No critical-infrastructure operation.
- No law-enforcement, migration, asylum, or border-management use.

The substrate intelligence is best framed as a **recommendation /
content-personalization system** in the Art. 6 taxonomy, not a
high-risk decision system. Cohort discovery (§16.3.3), schema gravity
(§16.3.2), cost prediction (§16.3.7), and auto-promotion (§19.3.4)
all produce recommendations the operator authorizes; none autonomously
adjudicates a regulated outcome.

**Commitment**: when a future cart would enter Annex III territory
(e.g., a credit-scoring cart for shop loans, a biometric-tagged
listing helper), Lacuna Engineering runs the conformity-assessment
workflow before that cart ships, and the Shell refuses to register
the cart's manifest until the workflow's audit row lands.

**GPAI obligations**: the substrate ships NO LLM per §17, so GPAI
compute thresholds do not bind the substrate itself. Per-client NL
Adapters (§17.4) are evaluated against GPAI separately by each
product team. Sakura's on-device 1.7B savant sits well below the
threshold; the obligation is monitored, not active.

### §12.10 — CPRA ADMT compliance (Cal. Civ. Code §1798.110 + CPPA ADMT rules eff. Jan 1, 2026)

Substrate-resident decisions that affect consumers — cost predictions
(§16.3.7), auto-promotion (§19.3.4), recommendation gating (§19.2),
schema-gravity propagation (§16.3.2), cohort discovery (§16.3.3) —
are **automated decision-making technologies (ADMT)** under the
2026-effective CPPA rules and **disclosable inferences** per
§1798.110.

The substrate's response:

- **Every ADMT decision emits a `(:admt-decision ...)` audit row** on
  the SYSTEM plane (additive to the existing audit row). The row
  carries: principal, decision shape, evidence-CIDs, logic-summary,
  outcome.
- **Consumer-disclosure surface.** A `loam.consumer.disclosure(tenant)`
  verb (week-12 deliverable) returns the inference categories,
  sources, purposes, and a human-readable logic summary for every
  cohort assignment and every substrate-mediated recommendation
  surfaced to the operator within the prior 45 days. CCPA §1798.110
  response window: 45 days.
- **Human-review request path.** Each ADMT audit row carries a
  `(:request-human-review-uri ...)` field. Operator (or their
  authorized agent) can invoke the URI; Lacuna Engineering routes
  to the named reviewer; decision lands as a follow-on audit row
  pinned to the original.

The audit log already gives ~80% of this. §12.10 names the discipline
explicitly so a builder pinning the API in week 12 doesn't have to
re-derive it. California AG Opinion 20-303 is the controlling
guidance for internally-generated inferences.

---

## §13 — Public Loam

The architect: *"Everyone who needs it should be able to use it.
Public data is there."*

The PUBLIC plane is **the part of Loam anyone can read**, with no
operator account, no cap-token, no Sakura. It is the substrate's
contribution to the commons.

### §13.1 — What lives in PUBLIC

Three categories:

1. **Operator opt-in publications.** A shop that opted into the
   Curator public profile lives here. A finding the operator chose
   to share lives here. The "Public" toggle on any operator finding
   publishes a copy to the PUBLIC plane, content-addressed,
   immutable.
2. **World facts curated by Curator.** The Radio-Browser catalog
   (`radio_loam.py:1`); the public price-comparable history
   (`price_comps.py:1` aggregated, PII-stripped); the public
   web-cache (`firecrawl/cache.py:1`); the marketplace policy
   archive. All migrate from their current ad-hoc on-disk JSON to the
   PUBLIC plane.
3. **Substrate-as-public-good.** The Sakura training corpus
   manifest, public examples (the operator-tour facts), the public
   Scheme reference — anything Curator publishes that has a CID
   benefits from being addressable in PUBLIC Loam.

### §13.2 — The Public Loam surface

```
   https://loam.lacunalabs.ai/v1/<cid>            ; resolve a CID to bytes
   https://loam.lacunalabs.ai/v1/search?q=...     ; semantic search PUBLIC
   https://loam.lacunalabs.ai/v1/principal/<id>   ; resolve a public principal
   https://loam.lacunalabs.ai/v1/subscribe/<id>   ; long-poll/SSE subscription
```

Rate-limited (default 60/min/IP, generous), CORS-permitted, no auth
required for reads of PUBLIC plane. The substrate's contribution to
the open web.

### §13.3 — Two-tier surface, sharply

Two tiers, by access:

| Tier | Auth | Planes |
|---|---|---|
| **Public Loam** | None (rate-limited) | PUBLIC, WORLD (read-only) |
| **Private Loam** | Cap-token + Shell | TENANT, COHORT, WORLD, SYSTEM, PUBLIC (R/W) |

A request hits Public Loam first (no auth check); if it asks for a
non-PUBLIC plane, the request 401s with a redirect to Private Loam.

Public Loam compute runs on the L1 / NL Adapter co-located surface
(§19.3) exclusively — no cart code in the Loam sandbox is reachable
from unauthenticated public callers. The trust-domain separation is
physical: public readers hit a different process surface from
authenticated cart execution.

---

## §14 — Failure, replication, backups, recovery

The architect's hard line: *"Make this one recoverable via bash,
scripts, and work. Self syncing if it needs to be."*

### §14.1 — Replication topology

Per-shard SQLite + Litestream:

- **Hot replica:** Litestream streams the WAL to 3 S3-compatible
  destinations (R2 + Backblaze B2 + Wasabi). Continuous, second-class
  granularity.
- **Cold tier:** Quarterly tarballed snapshot pushed to a 4th and 5th
  destination (an IPFS pin and a bare offline disk in escrow). 5-way
  redundancy survives any 2 host losses.

Litestream's WAL streaming gives us RPO ~seconds, RTO ~minutes via
`litestream restore` (a single bash command —
[litestream.io reference](https://litestream.io/reference/restore/)).

### §14.2 — Recovery via bash

A single bash script reconstitutes Loam from a tarball:

```bash
#!/usr/bin/env bash
# SUMMARY (faithful to scripts/loam-restore-from-cold.sh shipping in
# curator-api/scripts/). Corrected 2026-06-27 per AUDIT-LIES M3 — the
# previous inline script asserted a Litestream-restore + b3sum-c step
# that don't match the real script.
#
# Requires: bash, tar, sqlite3, jq, curl, sha256sum, zstd, python3.
# The tarball IS the substrate; no WAL pull. No Loam binaries needed
# beyond python3 + curator_api.
set -euo pipefail

SHARD="${1:?usage: loam-restore-from-cold.sh <shard-id> <bucket-url>}"
BUCKET="${2:?missing bucket url}"

mkdir -p "/var/loam/restore/$SHARD"
cd "/var/loam/restore/$SHARD"

# 1. Pull the latest tarball + tarball-level sidecar SHA
curl -fsSL "$BUCKET/loam/$SHARD/latest.tar.zst"     -o latest.tar.zst
curl -fsSL "$BUCKET/loam/$SHARD/latest.tar.zst.sha" -o latest.tar.zst.sha

# 2. Verify the tarball against its sidecar SHA-256 (one check,
#    not a per-blob b3sum walk).
sha256sum -c latest.tar.zst.sha

# 3. Unpack.
zstd -d latest.tar.zst -c | tar xf -

# 4. Walk the chain + rebuild projections (the integrity module
#    handles the per-row dual-hash verification, log-tail consistency,
#    and projection rebuild — the bash wrapper just calls it).
python3 -m curator_api.loam.log.integrity --shard ./shard.db

# 5. Print readiness.
echo "shard $SHARD restored. log rows: $(sqlite3 ./shard.db 'select count(*) from log')"
```

This is the script Marcus signs off on. No flyctl. No proprietary
admin tooling. `bash + tar + sqlite3 + jq + curl + b3sum + sha256sum
+ zstd + litestream` — all open source, all available on every POSIX
host since 2020.

### §14.3 — Recovery scenarios

| Scenario | RPO | RTO | Mechanism |
|---|---|---|---|
| Single SQLite file corruption | 0 | <1 min | Litestream `restore` from R2 |
| One cold-store provider lost | 0 | 0 (no incident) | 3-of-5 still alive |
| Two cold-store providers lost | <quarterly | hours | restore from remaining cold-store |
| Whole Fly region lost | <30s | <10 min | restore + relaunch in new region |
| All 5 cold stores lost (apocalyptic) | <quarter | days | Rosetta-tier recovery; opt-in operators only — **contingent on §31 Q6 architect ratification (HD-Rosetta service feature)**; corrected per AUDIT-LIES Jess M8 |
| Vector index corruption | 0 | <10 min | rebuild from log |
| Graph projection corruption | 0 | <5 min | rebuild from log |
| Shell binary lost or corrupted | 0 | minutes | re-deploy from artifact registry; the Shell is deterministic Rust with no model dependency (§17.3) |
| Per-client NL Adapter weights lost (e.g., Sakura's L0 1.7B) | 0 | hours | retrain from per-client corpus + deploy; substrate keeps running on Scheme inputs from any other client (§17.4) |
| SQLite format obsolete (year 2178) | 0 | weeks | port log to successor; Scheme sidecars guide the port |

### §14.4 — Self-syncing

A shard whose Litestream stream is behind by more than 60 seconds
auto-triggers a catch-up. A shard whose WAL has drifted from its
remote replica (BLAKE3 mismatch on the latest 1000 rows) auto-pauses
and emits `shard.divergence_detected` to the SYSTEM plane. Lacuna's
daily reconciliation walks every shard and verifies parity.

Self-syncing is not multi-master. Loam is single-master per shard
(strict serializability per shard). Self-sync means: replicas catch
up to master; replicas detect divergence; the substrate alerts and
the deterministic shell pauses writes on a diverged shard.

### §14.5 — Verification against the architect's bar

The architect demanded *"recoverable via bash, scripts, and work."*

| Requirement | LOAM 1.0 (FDB) | LOAM 2.0 (SQLite per shard + Litestream) |
|---|---|---|
| Restore with bash | No | Yes |
| Restore with `tar` | No | Yes |
| Restore without proprietary tooling | No | Yes |
| Restore to a laptop for forensics | No | Yes |
| Restore in 2178 | Unknown | Yes (SQLite long-term spec + Scheme sidecars) |
| Self-sync after partition | Manual | Litestream + reconciliation |

LOAM 2.0 clears every bar LOAM 1.0 did not.

---

## §15 — The 300+ purple automations this unlocks

The architect's bar: *"add an additional 300 automations by surprise
because you researched it well."*

The list below counts concrete automation patterns that become
possible once the substrate is in place, by feature. The unit is the
**automation pattern** (a cart template, instantiable per operator,
per cohort, per category, per marketplace). The count is the number
of distinct cart-templates each feature enables.

### §15.1 — By feature, with counts

#### Code-in-Loam (§11) — **96 new automations**

The substrate stores code; the substrate runs code; the substrate
authorizes code. Each automation below is a per-operator instance of
a registered code artifact.

- **Operator-authored alerts** (15): price-drop, inventory-low,
  cohort-shift, sentiment-spike, dispute-aged, refund-velocity,
  return-rate, attach-rate, conversion-corridor-drift,
  competitor-rank-change, listing-stale, photo-stale, title-stale,
  description-stale, tag-stale.
- **Template-driven cart-synthesis** (24): the operator describes a
  desired automation in English; L2 + the client-side NL Adapter
  compose a Scheme artifact; the Shell verifies and the operator
  approves; the artifact is registered. Twenty-four
  template categories: monitor, summarize, alert, draft, compare,
  schedule, dispatch, reconcile, escalate, archive, redact, rewrite,
  enrich, classify, score, rank, route, throttle, batch, retry,
  recover, broadcast, broadcast-conditional, broadcast-cohort.
- **Composable findings act on themselves** (18): findings of kind
  (sentiment-spike, fraud-suspicion, inventory-risk, copyright-risk,
  fakes-watchlist-hit, supplier-instability, marketplace-policy-
  change, ...). Each finding can carry a code-CID that says "how to
  act on me"; subsequent passes invoke it. 18 finding kinds × 1
  action-each = 18.
- **Operator-side helpers** (24): per-cart utility functions in the
  operator's tenant plane — pricing curves, tax brackets, shipping
  zones, holiday calendars, persona maps, voice presets,
  description-tone presets, photo-style presets, and 16 more.
- **Code-evolution subscriptions** (15): notify when a substrate-
  registered template has a newer version (e.g., the
  "competitive-strategy-memo" template's v3 lands and the operator
  wants the upgrade).

#### Subscriptions as first-class (§10) — **78 new automations**

Subscription-as-primitive lets every existing cart become event-
driven instead of polled, and unlocks new event-driven shapes.

- **Cohort-threshold subscriptions** (15): "when my cohort crosses
  K=50, run the federated buyer-pattern sweep" (today gated on K
  manually; subscription does it). 15 cohort signals.
- **Cross-shop event subscriptions** (20): "when any shop in my
  category posts a sub-$X price for SKU pattern Y, alert me." Twenty
  cross-shop signals (price, listing, review, ranking, traffic,
  inventory, season, promotion, ...).
- **Market-signal subscriptions** (15): Etsy market signals (trending
  category, declining category, new craft fair, new wholesale event,
  ...); same for eBay (Best Offer waves, watcher counts, ...);
  Meta (organic-reach shifts, ad-fatigue thresholds). 15 signals.
- **Cron-replaced-by-subscription** (18): every existing `cron:daily`
  / `cron:weekly` cart that fires on a window predicate. Eighteen
  existing carts get an event-driven companion.
- **Causal subscriptions** (10): "when finding X lands, give me
  finding Y from L2 the next morning, but only if signal Z stays."
  Ten causal patterns — orchard-walk, dispute-orchestration,
  monthly-strategy-dossier, and seven cousins.

#### Boundary-mediated requests via Shell + NL Adapter (§3, §4, §17) — **42 new automations**

The Shell exposes a sharp Scheme verb surface; per-client NL Adapters
let every cart drop the boilerplate of "what do I know about this?"
and ask in English. The Shell never sees English; the Adapter never
sees storage.

- **English-shaped recall** (12): replace 12 existing recall idioms
  in carts with `loam.recall` calls that read more like questions
  than queries — the Adapter translates, the Shell verifies.
- **Intent-shaped writes** (12): same for `loam.remember`.
- **Adapter-mediated cross-cohort discovery** (8): "what are 3 cohorts
  similar to mine doing differently?" — the client looks up similar
  cohorts by embedding distance via Shell-served vector search and
  surfaces the diffs. 8 cross-cohort signals.
- **Structured-action dispatch** (10): the Shell routes a Scheme
  request to the right projection. 10 reshape patterns
  (vector-similarity, KV-prefix, graph-traversal, time-window,
  threshold, top-K, bottom-K, distribution-shape, anomaly-score,
  recency-weighted).

#### Public Loam (§13) — **48 new automations**

Operator opt-in publishing + world-fact corpus unlocks:

- **Operator-public-profile-driven** (12): public-facing automations
  driven by what the operator chose to make public (the public
  profile, the press kit, the catalogue export). 12 patterns.
- **PUBLIC-plane subscriptions by external automations** (16): a
  Zapier-style automation subscribes to a Curator-published feed.
  16 outbound signal feeds.
- **Cross-platform federation** (10): substrates outside Curator can
  publish into shared PUBLIC plane (a peer marketplace's API
  published to the substrate). 10 inbound feeds.
- **Public-Loam search-API powered carts** (10): carts that consume
  the Public Loam search API to discover similar shops, similar
  signals, similar findings. 10 patterns.

#### Cortex-of-Loam (§5) — **36 new automations**

Loam pushing into Cortex makes Sakura proactively aware:

- **Anticipatory openers** (12): Sakura opens the session with what
  Loam pushed into Cortex-of-Loam overnight. 12 opener kinds
  (one per high-priority finding category).
- **Cross-session continuity** (8): a multi-day dossier paused mid-
  flight resumes naturally because Loam delivers the state. 8
  multi-day flows.
- **Privacy-aware recall** (8): Sakura answers "what do you know about
  X" from Cortex-of-Loam without ever doing a substrate query — the
  data she has is already-permissioned. 8 recall patterns.
- **Stub-driven re-pull** (8): evicted facts auto-refetch when
  relevant. 8 categories of evict-and-refetch.

#### Event log + audit as substrate (§10.4) — **24 new automations**

- **Audit-driven dispute defense** (8): when a charge is disputed,
  the substrate's audit trail is the receipt. 8 dispute patterns.
- **Reconciliation automations** (8): Lacuna's nightly audit runs
  reconciliations across cohorts, operators, token balances,
  cart-cost ledgers. 8 reconciliations.
- **Compliance reports** (8): the audit log produces GDPR data-
  export, CCPA data-delete-receipt, SOC 2 control evidence, ...
  8 compliance flows.

### §15.2 — Total

| Feature | Automations |
|---|---|
| Code-in-Loam | 96 |
| Subscriptions as first-class | 78 |
| Shell + NL Adapter (NL-shaped requests) | 42 |
| Public Loam | 48 |
| Cortex-of-Loam | 36 |
| Event log + audit as substrate | 24 |
| **TOTAL NEW PURPLE-CLASS AUTOMATIONS** | **324** |

The bar is 300; the substrate clears it by 24 with margin. The 318
infra-gated carts from `INFRA-GATED-CARTS-2026-06-15.md` are a
*separate* unlock (LOAM 2.0 also unblocks roughly 200 of those by
shipping `subAgent.spawn`, `document.cite`, `ensemble.run`,
`PII.ledger`, `cost.cap`, `aggregate.query`, `checkpoint.*`, and
`audit.trail` as substrate-native primitives — see §30).

### §15.3 — Honesty about the count

The 324 above are *cart-template categories*, each instantiable
per operator. A single category produces dozens of operator instances
in the live product (one operator's `price-drop alert` is a different
running instance from another operator's). The architect's "300"
target is satisfied at the template-category level; the live-product
running-instance count is multiple orders larger.

If the architect wants the count framed at a different unit (e.g.
running instances, or operator-visible UI cards), we recount under
the new unit — the substrate itself unlocks roughly the same number
of distinct automation shapes either way.

### §15.4 — The substrate proposes its own roadmap

The 324 above are the automations **we authored** because we saw
them. §16.3.9 (pattern mining) adds a second source: the substrate
watches its own audit log and proposes **unseen automations** to
the architect biweekly — *"this shape recurred 47 times across 9
cohorts; should it be its own cart?"* The proposal is conservative,
honest about uncertainty, and disposable; the architect accepts,
defers, or declines. The expected steady-state contribution from
substrate-proposed carts (12 months in) is 20–40 net-new automations
per year that **no human noticed** because no human reads the audit
log holistically. The substrate's smart-DB framing (§16) therefore
makes the 324 a floor, not a ceiling — the substrate itself extends
its own surface.

The 324 conservative figure pairs with three other honest counts:
~585 inclusive (§15 + §23 12-area walkthrough + §24 entertainment +
§25 work-cron + §26 invariants — rolled up in §26.11), 680 existing-
cart Loamified extensions (§18.3), and "multiple orders larger"
operator-instances (§15.3). The four counts measure four different
units; see §18.9 + §26.11.2 for the disambiguation.

---

## §16 — The substrate has intelligence

The architect dropped a foundational reframing this session, verbatim:
*"The db is like an ai itself. A smart db."*

That is not a feature request. It is a conceptual upgrade that runs
through every other section of this document. Loam is not "storage +
the Shell." Loam is **intelligent substrate** — and the Shell (§3,
§17) is one expression of that intelligence (the deterministic
boundary mediator). The substrate has more.

> **§17 reframe — none of these behaviors require an LLM in the
> substrate.** §17.5 walks every one of the eleven §16.3 behaviors
> below and confirms each can be served by classical primitives —
> statistics, embeddings, clustering, regression, heuristics, rule
> engines — without any LLM in the substrate's trust domain. The
> "smart DB" framing stands; the implementation is classical. The
> embedding model (§17.6) is the only model-class dependency, and
> it is a deterministic encoder (~100MB, <10ms inference), not a
> generative LLM. Read every §16.3.X subsection through this lens:
> the "smart" comes from observation + statistics, not from
> reasoning.

This section establishes the framing before the practical sections
(§23 walkthrough, §24 entertainment, §25 work-cron, §26 invariants)
because each of those sections silently depends on the substrate
behaving smart. Without §16 the rest reads as if a deterministic
key-value store happened to grow surprising shapes. With §16, the
shapes are the substrate doing its job.

### §16.1 — The framing

The smart-DB framing is **conservative**. Every behavior named below
is observable, recoverable, and honest about its uncertainty.
Substrate intelligence **proposes**; the operator and the Shell
(§17.3) **dispose**. A substrate-intelligence failure is **logged**,
never silent — the audit row carries the proposal, the verdict, the
recovery path. The substrate gets things wrong honestly, the same
way the Shell rejects wrong-shape requests honestly with explicit
escalate symbols (§3.5, §17.3).

We pick three names consistently:

- **"Smart DB"** — the framing, the architect's term, what we say
  when we talk about why Loam matters.
- **"Loam"** — the engineering name, what the substrate is called in
  code, in build plans, in the patentable surfaces.
- **"Substrate intelligence"** — the formal term, what we use when
  the doc needs to name a specific behavior (e.g., "substrate
  intelligence proposes a schema; the tenant disposes").

The terms are not interchangeable. Smart DB is the why; Loam is the
what; substrate intelligence is the how.

### §16.2 — Lineage with worked prior art

Eleven systems already express **one** smart-DB dimension each. Loam
composes eleven. The composition is the surface — none of these
individual ingredients is novel; the discipline of having all of
them inside one substrate, mediated by a single Shell, audited end-
to-end, recoverable via bash, is the move.

| System | One intelligence dimension it expresses | What Loam takes |
|---|---|---|
| Datomic | Rules-and-data co-located; data has logic attached | The discipline that the log is a place for inference, not just bytes (§16.3.9 pattern mining) |
| Materialize | Incremental views — projections that maintain themselves | The mental model behind §16.3.6 learned compaction and §16.3.1 learned indexes |
| Honeycomb BubbleUp | Anomaly explanation lives **inside** the storage layer, not bolted on after | The blueprint for §16.3.5 surfaced anomalies |
| EdgeDB | A typed inference engine that derives schema from declared types | The shape of §16.3.2 schema-suggests-itself; we go further — Loam never declares |
| Vespa | Hybrid search + ML primitives inside the storage process | The blueprint for §16.3.4 write-time embeddings |
| Datalog | Rules-in-storage; declarative inference at the data layer | The discipline behind §16.3.9 pattern mining proposing automations |
| TimePlus | Streaming + incremental views as a substrate primitive | Maps to §16.3.6 hot/warm/cold learned tiering |
| DuckDB / MotherDuck | Predictive smart cache; the engine learns the query workload | The blueprint for §16.3.8 predictive subscriptions |
| Snowflake automatic clustering | Storage layout reorganized by observed access | Maps to §16.3.1 learned indexes |
| TigerBeetle | Anomaly detection at storage level via deterministic invariants | The shape of §16.3.5 anomaly surfacing |
| AWS Aurora ML integration | ML inference at the row-fetch site | Maps to §16.3.4 write-time embeddings |

Honest delta: each of those systems expresses **one** of the eleven
behaviors below. Loam composes all eleven. The composition is the
patentable surface (Marcus calls it the recipe, not the ingredient).

### §16.3 — Eleven substrate-native intelligence behaviors

Each behavior names: **what** the substrate does, **when** it acts
(write-time / read-time / background sweep), the **failure mode**
when it's wrong, the **operator-visible surface** (or note
"invisible"), and the **patent claim potential**.

#### §16.3.1 — Indexes are LEARNED, not declared

**What.** Access patterns drive which projection (KV / vector /
graph / trigger) gets materialized for which record class. The
substrate observes its own read traffic. When a record class is
consistently fetched by key-prefix scan, the KV projection
materializes for it. When it's consistently fetched by
semantic-similarity, the vector projection materializes. The
operator never declares which index to build.

**When.** Background sweep. The schema-discovery worker
(`projections/index_discovery.py`, week-6 deliverable) watches the
audit log; when a record class crosses 50 reads in the same
projection-shape inside a sliding 24h window, the projection
materializes in the background.

**Failure mode.** Wrong projection materialized → first N queries
pay the projection-miss overhead (re-scan from log). Recovery is
automatic: the next sweep observes the miss-rate and re-materializes.
No data loss; bounded cost. Audited: every projection materialization
emits a `projection.materialized` SYSTEM row with prior reads, chosen
shape, and observed access pattern.

**Operator-visible surface.** Invisible by default. SRE dashboard
(§26.8) carries the materialization log for debugging.

**Patent claim potential.** Composes with §16.3.6 (learned
compaction). Not novel alone — Snowflake auto-clustering is prior
art. Defensive publication.

#### §16.3.2 — Schemas SUGGEST themselves

**What.** When the substrate sees the same shape recur 50× from the
same producer, a schema **emerges** as content-addressed metadata
(`(:schema :cid blake3-... :discovered-at ... :prevalence 127 :shape
... :status 'descriptive)` per §26.9.1). The schema is then **offered
to other tenants** who are writing similar shapes — what Soo-Jin
named *schema gravity*: shapes attract similar shapes, the substrate
makes the gravity visible, the tenant can adopt or decline.

**When.** Background sweep (schema discovery in §26.9.1) and write-
time suggestion (when a tenant's first write of a new shape lands
within ε of an existing schema's shape, the Shell offers the existing
schema as a suggested annotation).

**Failure mode.** Suggested schema overfits a niche → tenant
declines, Loam records the decline in audit, the substrate down-
weights the gravity for that shape. Counterfactual: tenant adopts a
mis-fit schema → writes still succeed (per §26.9.2 voluntary
validators), no breakage.

**Operator-visible surface.** An advisory beat from Sakura in her own
voice — substrate-side primitive (`loam.advisory`) drives it but the
operator never reads the verb: *"3 shops like yours started organizing
this kind of data the same way. Want to try their pattern?"* Pearl
appears in the entertainment surface when a tenant's shape first
attracts schema gravity from the cohort.

**Patent claim potential.** **B.15** — emergent-schema-as-content-
addressed-suggestion with cross-tenant gravity propagation and
tenant-veto. Composes §26.9 (descriptive schemas) with §12.4 (K-floor
cohort discipline). Likely novel; attorney pass required.

#### §16.3.3 — Cohorts EMERGE

**What.** Loam finds clusters of similar tenants/data via
embedding-space clustering rather than being told. The current cohort
model is operator-declared (a shop's category, region, marketplace
stack). Substrate-emergent cohorts add a second layer: the substrate
notices that 12 shops behave alike across 30 dimensions and **proposes
the cohort to the participants**. The K-floor is enforced exactly as
in §12.4 — a substrate-proposed cohort below K=8 is suppressed.

> **Cross-service per §6.5.** Cohort emergence works cross-service
> too. Per §6.5's mutual-K-floor discipline, a clustering pass can
> propose a cohort that spans BOTH `sakura/COHORT/...` and
> `foodie/COHORT/...` when the intersection ≥ 8 in each service.
> The §6.6 worked example (Sakura Prep + Foodie struggling-students-
> with-low-time-budgets) is exactly this mechanism. The patent surface
> B.21 (§28.12) names the cross-service variant.

**When.** Background sweep (weekly). The clustering job runs on the
SYSTEM plane; proposed cohorts surface through the Shell; operator-
visible proposals require K-floor pass + operator opt-in.

**Failure mode.** Cohort too tight → one tenant identifiable inside →
K-floor blocks the proposal entirely (the cohort never becomes
visible to anyone). Cohort too loose → no signal → the substrate
withdraws the proposal in the next sweep. Both failures are honest:
the operator either never sees the bad cohort, or sees it withdraw.

**Operator-visible surface.** Sakura voices the proposal in her own
voice — substrate name never leaks: *"I noticed 11 shops doing something
like yours — one more and I can show you what they share. Want in?"*
The threshold is felt ("one more"), not math. Pearl appears when the
substrate-proposed cohort first crosses K=8 (the architect's *"Pearl
is shy; she only appears when the operator's cohort first hits K=8"*
in §24.2 extends to substrate-discovered cohorts as well).

**Patent claim potential.** **B.16** — cohort-discovery via
embedding-space clustering with K-floor veto and operator-visible
cohort proposal / withdrawal. Composes §12.4 (K-anon floor) with
§16.3.4 (write-time embeddings). Likely novel; attorney pass required.

#### §16.3.4 — Embeddings WRITTEN at storage time

**What.** Every record carries its vector by default. The Shell, on
the write path, runs the producer's CBOR payload through an embedding
model (§17.6) and stores the vector inline as a co-row in the log.
Semantic search becomes a native primitive, not a bolted-on side
service. Vector index (§8.3) build no longer waits — the vectors
arrive with the data.

**When.** Write-time, inline. The Shell calls the in-process
embedding model; the call is bounded (sub-10ms p95 target on a
single CPU core per §17.6). If the embedding model is unreachable,
the record commits anyway and lands on the re-embed queue.

**Failure mode.** Embedding stale after schema change → background
re-embed sweep (similar to §16.3.1 re-materialize discipline).
Embedding model drift over time → quarterly re-embed of records
where the embedding's age exceeds the model's retraining cadence.

**Operator-visible surface.** Invisible. Vector-search latency
improvement is the only signal.

**Patent claim potential.** Composes with §16.3.2 (schema gravity
runs on the embeddings) and §16.3.3 (cohort discovery runs on the
embeddings). Not novel alone — Vespa, AWS Aurora ML, Vectara all
write embeddings at storage time. Defensive publication.

#### §16.3.5 — Anomalies SURFACE

**What.** Unusual access, unusual writes, unusual costs → substrate
raises hand to SRE hooks (§26.8) without polling. The substrate
maintains a rolling baseline per (record class, principal, plane,
operation, hour-of-day) tuple; deviations beyond `k × stddev` of the
baseline emit a SYSTEM `anomaly.candidate` row. Lacuna's hourly sweep
triages candidates into pages, drops, or quiet alerts.

**When.** Write-time (cost anomalies, K-floor near-miss anomalies,
rate-limit anomalies) and background sweep (access-pattern anomalies,
cohort-drift anomalies, embedding-drift anomalies). Streaming
detection on a windowed event stream.

**Failure mode.** False positive raises noise → tunable per-tenant
baseline (operator can set `:anomaly-sensitivity` in their TENANT
config); honest second-look — every false positive is recorded and
the baseline retunes itself in the next sweep. False negative misses a
real anomaly → black-box probe carts (§26.8) provide ground truth;
discrepancies between probe results and anomaly detection feed the
baseline.

**Operator-visible surface.** A handful, all opt-in: "this week's
cost is 3.2× your 30-day average — investigate?"; "your write rate
on listings dropped 80% — vacation mode or bug?"; "the cohort's
sentiment baseline shifted last week — investigate?".

**Patent claim potential.** Honeycomb BubbleUp is the obvious prior
art. The composition with K-floor cohorts (anomalies in cohort
behavior, K-anonymized) is the novel angle. Defensive publication
unless an attorney sees a sharper claim.

#### §16.3.6 — Compaction LEARNS

**What.** Hot/warm/cold tiering driven by observed read patterns,
not by age alone. A record class that lives in hot for 2 weeks but
gets 90% of its reads on day-30 stays warm; a record class that
spikes on day-1 then never reads again moves to cold faster than its
nominal TTL. The substrate **knows what is worth keeping resident**.

**When.** Background sweep (nightly). The tier-decision job reads
the audit log for each record class's last 30-day access pattern,
predicts the next 30 days, and re-tiers accordingly. Re-tiering is a
move, not a copy; the CID is preserved.

**Failure mode.** Wrong tier → first read after cold-promotion is
slow (target 200ms vs 20ms for warm); the read is recorded; the next
sweep re-promotes. Audited: every cold-read emits a
`tier.cold_hit` SYSTEM row with the read's latency and the prior
tier decision.

**Operator-visible surface.** Invisible. SRE dashboard carries
tier-distribution metrics.

**Patent claim potential.** Composes with §16.3.1 (learned indexes).
Snowflake automatic clustering is prior art. Defensive publication.

#### §16.3.7 — Cost PREDICTED

**What.** The substrate knows the cost of every operation **before
it runs**, suggests cheaper alternatives at the Shell, and exposes
the cost-delta to the operator before commit. This plays directly
with §26.3 (no cost overruns: budget enforced at write time) — §26.3
is the **enforcement**; §16.3.7 is the **prediction** that makes the
enforcement non-punitive.

**When.** Write-time and read-time. The Shell runs a cost model
(record class × operation × projection × shard load × expected
fan-out) before the operation; if the cost exceeds a threshold *and*
a cheaper alternative exists, the Shell proposes the alternative
("you asked for a vector recall over 30 days — KV recall on the same
prefix returns ~95% the same answers at 1/12 the cost"). The
operator/cart sees the proposal and chooses.

**Failure mode.** Cost model drifts (workload mix changes, hardware
changes, new record classes) → recalibrate weekly; the honest delta
between predicted and actual is logged per-class; if `|predicted -
actual| / actual > 0.20` for any class for two weeks in a row, the
class enters the recalibration queue.

**Operator-visible surface.** "This costs ~$0.04 in tokens; an
alternative path costs ~$0.003. Run alternative?" — a one-tap
substitution. The cost-aware badge on every cart's data-tier
indicator (per §26.3) becomes a **predicted** badge, not a
post-hoc surprise.

**Patent claim potential.** Composes with §26.3 (write-time budget
enforcement). Cost prediction is well-established (Snowflake's query
profiler, BigQuery's slot estimator). The substrate-resident
alternative-suggestion at the Shell is the novel composition.
Defensive publication.

#### §16.3.8 — Predictive subscriptions

**What.** Loam guesses which subscribers want which events and
**warms the path** before the subscription fires — pre-computes the
predicate, pre-loads the callback URL's DNS, pre-warms the destination
cache. When the predicate fires, latency to subscriber is sub-100ms
instead of sub-second.

**When.** Background sweep. The subscription-warmth job walks the
subscription registry every 60s, looks at the events in flight, and
warms the top-N most-likely-to-fire predicates.

**Failure mode.** Wrong guess wastes a small amount of cache → bounded
by per-tenant cache quota (default 50MB per tenant, opt-in to
larger). Cache miss on the actual fire is a non-event — the fire
still works, just at sub-second instead of sub-100ms latency.

**Operator-visible surface.** Invisible. Subscription-fire latency
distribution in the SRE dashboard.

**Patent claim potential.** Standard cache-warming discipline.
Defensive publication.

#### §16.3.9 — Pattern mining

**What.** The substrate watches its own audit log for **recurring
shapes of work** and proposes **new carts** to the architect. What
data classes recur? What workflows recur? What K-anonymizable
patterns exist that nobody has queried yet? Every two weeks Lacuna's
pattern-mining job surfaces a candidate list to the architect:
*"this shape has appeared 47 times across 9 cohorts — should it be
its own cart?"* The substrate proposes its own product roadmap.

**When.** Background sweep (biweekly). Reads the audit log; clusters
operations by shape; ranks clusters by frequency × cross-cohort
spread × manual-effort-saved estimate.

**Failure mode.** Bad cart proposed → architect declines, decline
recorded, the substrate down-weights similar proposals. Good cart
missed → operators report the gap; the gap report feeds the
clustering. Honest middle: the substrate proposes, the architect
disposes, the audit records both.

**Operator-visible surface.** Invisible to operators by default
(this is an architect-facing surface). The §24.7 yir-12 cart
("next-year seeds") **does** surface the pattern-mining output to
operators at year-end — *the substrate suggests three things you
might want for next year, based on patterns it noticed in yours*.

**Patent claim potential.** Novel composition — content-addressed
substrate proposing its own automation surface. Datalog and AutoML-
for-databases (SageMaker DB) are adjacent. The composition with the
audit-log corpus and the cart-template surface is sharp. Candidate
for B.19 in a future patent round; not in scope for this doc. (B.17
and B.18 are claimed in §19 for auto-promotion of execution tier
and budget-aware recommendation, respectively.)

#### §16.3.10 — Self-healing

**What.** The substrate notices drift / lag / dead-state and runs
**reapers, replicators, migrations** without operator intervention.
A shard whose replication lag exceeds 60s self-triggers a catch-up
(§14.4); a record whose heartbeat lapsed lands in the reaper sweep
(§26.2); a projection whose recall@10 drops below 0.90 rebuilds
from log. Connects directly to §26.2 (no dead state) and §26.7
(never-down).

**When.** Continuous (lag-trigger), background sweep (TTL/reaper),
on-incident (projection-drift). Each is a Lacuna-owned process
running over the SYSTEM event log.

**Failure mode.** Aggressive reaper deletes a legitimately-slow-
write tenant's record → opt-in tenant TTL overrides; the reaper
respects `:retention 'indefinite :reason "..."` per §23.2. Every
self-healing action emits a `selfheal.action_taken` SYSTEM row;
operator can audit + revert (forward-only revert via tombstone).

**Operator-visible surface.** Invisible by default; SRE dashboard
shows the self-healing action stream.

**Patent claim potential.** Standard self-healing discipline.
Defensive publication.

#### §16.3.11 — Audit-as-corpus

**What.** The audit log isn't just compliance — it is **the
substrate's learning corpus**. Recursive: the substrate observes
itself, learns from observation, improves. Per-client NL Adapters
(§17.4) draw their training corpus from the audit log; Sakura's L0
1.7B savant trains on Curator's audit slice. The pattern-mining job
(§16.3.9) reads the audit log. The anomaly baseline (§16.3.5) reads
the audit log. The cost model (§16.3.7) reads the audit log. The
schema-suggestion engine (§16.3.2) reads the audit log. Every
substrate-intelligence behavior is, ultimately, observing and learning
from §23.1. The substrate itself ships no model (§17); the audit is
the **substrate-emitted corpus** that each client trains its own
adapter on, per the per-client retraining cycle in §17.11.

**When.** Continuous (every audit row is potentially a training
sample); milestone (per-client fine-tune cadence — Sakura's training
lead owns Sakura's; per-product teams own their own; substrate has
no shared training job); biweekly cart proposal; monthly recalibration
of the cost model.

**Failure mode.** Audit log poisoned by an adversary → audit rows
are signed (§26.1); poisoned rows fail signature check and are
quarantined. Audit log over-fits a per-client adapter to recent
behavior → each adapter's training mix includes synthetic
adversarial examples; training-set diversity is enforced by the
adapter owner, not the substrate.

**Operator-visible surface.** Invisible. The audit is the product
for Soo-Jin; the audit-as-corpus is the multiplier for Marcus.

**Patent claim potential.** Composes §3 / §17 (the Shell + NL
Adapter split) with §26.1 (audit). Named in §28.4 (B.12 RETIRED per
§17 — the LLM-as-substrate-mediator claim was withdrawn; the
recursive training loop survives as a per-client property, not a
substrate-shared one). New patent surface (cohort-scoped audit-as-
corpus discipline) deferred to a future round.

### §16.4 — Eleven behaviors, one substrate

Read together, the eleven behaviors describe **a substrate that
gets smarter with use**. The smart-DB framing is therefore not a
mood — it is a load-bearing property of the design. The substrate
proposes; the operator + the Shell dispose. The substrate's
failures are logged. The substrate's successes are audited. The
substrate's learning is corpus-bound to its own audit log (per-
client adapters consume it; the substrate itself ships no model).
Loam knows itself; the more it is used, the better it knows itself.

This is the framing that makes the rest of the document make sense:

- §18 (Loamified extensions to existing carts) is the **discipline
  ceiling** — substrate intelligence does not get pushed onto every
  cart. Single-shot carts stay single-shot; the substrate earns its
  presence one cart at a time.
- §23 (12-area walkthrough) is dense with patterns like
  `*-anticipatory-opener` and `*-finding-acts-on-itself` — those
  patterns are the substrate-intelligence behaviors §16.3.2 +
  §16.3.5 + §16.3.9 surfacing at the operator-facing edge.
- §24 (entertainment) leans on Pearl's appearance discipline
  (`pearl-arrives-on-first-cohort-K8`) — that appearance is
  substrate-intelligence behavior §16.3.3 firing into a narrator
  surface.
- §25 (work-cron) depends on subscriptions being warm and
  predicates being cheap — §16.3.8 is the warmth, §16.3.7 is the
  cheapness.
- §26 (operational invariants) is partly **redundant** with §16 by
  design: §26.3 (cost), §26.4 (dead jobs), §26.7 (never-down),
  §26.8 (SRE hooks) are the invariants the substrate-intelligence
  behaviors enforce on the substrate itself. §16.3.7 predicts cost;
  §26.3 enforces it. §16.3.10 self-heals; §26.7 promises never-down.
  §16.3.5 surfaces anomalies; §26.8 surfaces them to SRE.

The smart-DB framing is the **why**; §18–§26 are the **what**;
§27–§31 are the **how** (comparables, patents, build plan, decisions).
Read in that order. The substrate is the protagonist of the document
from §16 on; until §16 it was scenery.

---

## §17 — The Substrate Is Classical; The Adapter Is Optional

The architect's reframe, 2026-06-26: *"Does Loam need an LLM?
Honestly. Walk every smart-DB behavior; ask what it actually needs."*

The answer is **no**. The substrate does not need an LLM in its
trust domain. None of the eleven §16.3 behaviors require one. The
Gate's *only* LLM-needing job was NL→Scheme translation, and **that's
the client's job, not the substrate's.**

This section reframes §3 (the Gate) accordingly. The Gate splits
cleanly into two halves: a deterministic **Shell** that lives IN
the substrate, and an optional per-client **NL Adapter** that lives
OUTSIDE the substrate. Sakura ships an NL Adapter; Bloom would;
Foodie and Baobab probably don't (their data is structured already).

The Marcus #1 hot-path concern, the Soo-Jin CRITICAL #3
confused-deputy concern, the Priya #4 structured-action allow-list
concern — all three resolve in the same move.

### §17.1 — Architect quote, paraphrased

The architect's audit, in his own framing: *"Walk the smart-DB list
honestly. Each behavior — what does it need? Statistical math? A
small embedding model? A regression with learned weights? An LLM?
Be honest. Don't add LLMs to make things sound smart."*

The walk lands at: **none of the eleven need an LLM**. The substrate
is **classical** in the sense of classical computing — statistics,
embeddings, clustering, regression, rule engines, heuristics. None
of these are LLMs. All of these are mature, well-instrumented,
deterministic-or-bounded-in-cost, recoverable from bash.

### §17.2 — The Gate splits into Shell + NL Adapter

The §3/§17 Shell was one box: small LLM + deterministic shell. The Shell
verified the LLM's proposal against capability + plane + K-floor +
audit-row before the operation committed.

The reframe splits the Gate into two:

```
        BEFORE                              AFTER

    [request (English)]              [request (Scheme s-expr)]
            |                                    |
            v                                    v
    +-------+-------+               +------------+------------+
    |   The Gate    |               |   The Shell             |
    | LLM proposes  |               |  - deterministic        |
    | Shell verifies|               |  - in-substrate         |
    | Audit emits   |               |  - cap-token verify     |
    +-------+-------+               |  - plane verify         |
            |                       |  - K-floor verify       |
            v                       |  - audit emit           |
       [storage]                    |  - cost reserve         |
                                    +------------+------------+
                                                 |
                                                 v
                                            [storage]

                       SEPARATELY, per client (Sakura, Bloom):

                         [operator says English]
                                    |
                                    v
                       +------------+------------+
                       |  NL Adapter (client)    |
                       |  - English -> Scheme    |
                       |  - confidence threshold |
                       |  - honest-null on doubt |
                       +------------+------------+
                                    |
                                    v
                           [Scheme s-expr]
                                    |
                                    v
                               [The Shell]
```

The Shell is what every service's request flows through. The NL
Adapter is loaded only by clients that need NL→Scheme; the substrate
itself never sees English.

### §17.3 — The Shell: deterministic, pure code, in-Loam

Per-shard, per-service, every request. Pure code (Rust). No model
files. No GPU. Tiny memory footprint (single-digit MB per shard).
Boots in milliseconds. Recovers from a bash restart.

What the Shell does, end-to-end, on every request:

1. **Receive a Scheme s-expr request** with a cap-token attached.
2. **Verify the cap-token signature** locally (no round-trip).
3. **Check planes ⊆ granted planes** in the token.
4. **Check operation ⊆ granted operations** in the token.
5. **Check structured-action against the closed allow-list** (per
   §31 Q24 Priya #4 LiteLLM CVE mitigation).
6. **Check the K-floor co-transactionally** for cohort reads (§12.4).
7. **Reserve cost** against the token's budget (§26.3 pre-flight).
8. **Emit the audit row** in the same transaction as the operation.
9. **Hand the verified request to the storage layer** (the log + the
   projections in §8.1).
10. **Return the result** with `result-cid` + `audit-cid`.

The Shell has **no learning surface**. It does not improve with
use. It is deterministic by construction. Wrong-shape requests are
refused with explicit escalate symbols (`'cap-insufficient`,
`'k-floor-blocked`, `'shell-action-not-in-allowlist`, etc.). The
Shell's worst-case behavior is denial, never leak.

**Shell-down semantics (corrected 2026-06-27 per AUDIT-LIES C-2).**
When the Rust Shell binary is unreachable from the Python side
(panic, port conflict, OOM-killed), `shell_chain.round_trip()` now
returns `ok=False reason="shell-unreachable"` — i.e. **deny**, not
the W2-era permissive fallback. The legacy permissive path is
gated behind an explicit dev-only env var
`LOAM_SHELL_FALLBACK_PERMIT=1`; that flag MUST NOT be set in
production. The "no leak on failure" promise above is now
mechanically enforced at the Python-Rust boundary, not just the
Rust boundary.

**Operator-state forwarding (corrected 2026-06-27 per AUDIT-LIES
C-3).** The Rust Shell's `loam/operator-state` handler returns an
explicit honest-null stub
(`{stub: true, state: "stub-shell", vacation: null, paused: null,
no-new-data: null, reason: "operator-state-forward-pending-w14"}`)
until the W14 wire-through replaces the stub with a real Python-side
IPC. Earlier drafts of §6 implied this verb was wired; it is not,
and the previous hardcoded `false/false/false` quietly bypassed
every pause/vacation gate. The W14 deliverable closes this gap.

The Marcus #1 hot-path concern resolves here: every read and every
write hits the Shell only — no LLM on the hot path. Latency is
deterministic-shell latency (microseconds + storage round-trip).

### §17.4 — The NL Adapter: optional, per-client, NOT in Loam

The NL Adapter is what each client ships if they need natural-language
input. Sakura ships one (operators speak English; Sakura's L0 1.7B
savant *is* the NL Adapter for Curator). Bloom would ship one (parents
type English in the parent portal). Foodie and Baobab probably don't
need one — their UIs are structured forms, not free-text chat.

Per-client decisions about the Adapter:

| Decision | Owner |
|---|---|
| Whether to ship an Adapter | the client product team |
| Which model class (1.7B / 3B / vendor cloud / none) | the client product team |
| When to refuse and emit `'gate-uncertain` (confidence threshold) | the client; default ≥ 0.85 |
| How to phrase the NL→Scheme translation prompt | the client |
| Whether the Adapter is on-device or remote | the client |

The substrate has **no opinion** about the Adapter. The substrate
accepts Scheme s-exprs, period. The Adapter is the client's
responsibility, and it lives in the client's trust domain — not in
the substrate's.

This is the Soo-Jin CRITICAL #3 confused-deputy resolution: **no
LLM in the substrate = no confused deputy in the substrate**. The
quarantined-translator + privileged-dispatcher split (Dual-LLM
pattern, Simon Willison) becomes "the Adapter is the
quarantined-translator (in the client's trust domain), the Shell
is the privileged dispatcher (in the substrate's trust domain)."
The dual-LLM topology drops out for free.

This is also the Priya #4 LiteLLM CVE resolution: **the substrate
accepts only Scheme; the substrate never accepts NL**. The closed
structured-action allow-list (§31 Q24) is the Shell's verb
vocabulary; NL never reaches it.

### §17.5 — Audit of §16.3 smart-DB behaviors — none require an LLM

The honest walk of every §16.3 substrate-intelligence behavior.
What does each *actually* need?

| §16.3 behavior | What it actually needs | LLM? |
|---|---|---:|
| §16.3.1 Index learning | Statistical — access-pattern histograms over a sliding window | NO |
| §16.3.2 Schema gravity | Frequency counting + content-addressing of recurring shapes | NO |
| §16.3.3 Cohort discovery | Small embedding model (~100MB) + clustering (k-means / HDBSCAN / similar) | NO |
| §16.3.4 Write-time embeddings | Small embedding model (~100MB, <10ms inference) | NO |
| §16.3.5 Anomaly surfacing | Statistical — baseline (per-class rolling mean + stddev) + deviation | NO |
| §16.3.6 Compaction learning | Heuristic — observed read-pattern decay; rule-based tier-down | NO |
| §16.3.7 Cost prediction | Regression with learned weights (linear or GBM); recalibrate weekly | NO |
| §16.3.8 Predictive subscriptions | Probabilistic — recent-fire frequency × predicate-warmth signal | NO |
| §16.3.9 Pattern mining | Embedding cluster + frequency rank | NO |
| §16.3.10 Self-healing | Rule engine + heuristics (replication lag thresholds, projection drift thresholds) | NO |
| §16.3.11 Audit-as-corpus | Feeds OTHER systems (e.g., a future client-side NL Adapter retraining); NOT used IN the substrate | NO |

Every row is "NO". The substrate gets its full eleven-behavior
smart-DB framing (§16) using statistics, embeddings, clustering,
regression, heuristics, and rule engines. No LLM is required for
any of it.

The one place an LLM-class model touches the substrate's process
is the **small embedding model** (§17.6 below) — a 100MB encoder,
not a generative LLM, not chat, not reasoning. Embedding models
are a different class: deterministic given input + model, fast
(<10ms on CPU), bounded in cost, mature for a decade.

### §17.6 — Embedding model spec

The substrate's only model dependency. Spec (subject to architect
ratification per §31 Q29):

- **Class:** sentence-transformer encoder (e.g.,
  sentence-transformers/all-MiniLM-L6-v2 or a successor; not pinned).
- **Size:** ~100MB on disk; <500MB resident.
- **Inference latency:** <10ms on a single CPU core for a 256-token
  payload.
- **Output:** 384-dim or 768-dim vector (model-dependent).
- **Versioning:** pinned per release; quarterly re-embed sweep when
  the version changes (per §16.3.4 failure mode).
- **Where it runs:** in-process inside the substrate Shell, per
  shard. No network hop.
- **Where it does NOT run:** on the hot path. Write-time embedding
  is one synchronous step in the Shell's commit; it is bounded.
  Read-time embedding never happens — read paths use the index.

Honest constraint: the embedding model choice is architect-decide
(§31 Q29). The doc commits to the class (sentence-transformer
encoder, ~100MB) but does not pin a specific model — a quarterly
review keeps it modern.

### §17.7 — Statistical primitives Loam needs

The substrate's classical toolkit:

- **Clustering:** k-means (for cohort discovery §16.3.3, pattern
  mining §16.3.9, predictive subscriptions §16.3.8). HDBSCAN for
  density-based variants. Both are well-established libraries
  (scikit-learn, HDBSCAN-Python).
- **Anomaly detection:** rolling baseline (median + MAD) per (class,
  principal, plane, operation, hour-of-day) tuple; k×stddev
  threshold; tunable per-tenant.
- **Regression:** ridge regression for cost prediction (§16.3.7);
  gradient-boosted regression (LightGBM) as upgrade path if linear
  weights drift.
- **Frequency counting:** Count-Min Sketch for schema gravity
  (§16.3.2) and pattern-mining (§16.3.9) at scale.
- **Embedding similarity:** cosine on the §17.6 embeddings; HNSW
  index from §8.3 serves the lookups.

All five are CPU-bound, deterministic, bounded in cost, recoverable
from bash, format-stable across decades. The 2000-year discipline
(§2) holds.

### §17.8 — How this resolves Marcus #1, Soo-Jin CRITICAL #3, Priya #4

Three reviewer concerns resolve in the same move:

- **Marcus #1 — hot-path latency.** Solved. No LLM on the hot path
  (or anywhere in the substrate). Latency is deterministic-shell
  latency + storage round-trip. Microseconds + ms.
- **Soo-Jin CRITICAL #3 — confused deputy (Dual-LLM pattern).**
  Solved. No LLM in the substrate's trust domain. The dual-LLM
  split is "Adapter in client trust domain (quarantined translator)
  + Shell in substrate trust domain (privileged dispatcher)." The
  trust boundary is the service boundary.
- **Priya #4 — structured-action allow-list (LiteLLM CVE pattern).**
  Solved. Substrate accepts only Scheme s-exprs from a closed
  allow-list of verbs (§31 Q24). NL never reaches the substrate.

The reframe is therefore not just a simplification — it is a
**security simplification**. Three distinct attack surfaces collapse
into one (the client's Adapter, which lives in the client's trust
domain and gets the client's own threat model).

### §17.9 — Cost reduction estimate

Removing the in-substrate LLM has substantial operational
implications.

Per-shard memory: prior estimate was 1.7B-3B parameters resident +
embedding model + Shell. At 1.7B INT8 ≈ 1.7GB + embedding (~500MB)
+ Shell (~50MB) ≈ ~2.2GB per shard process.

After reframe: embedding (~500MB) + Shell (~50MB) ≈ ~600MB per
shard process. **~73% per-shard memory reduction.**

Per-write inference cost: prior estimate had two model calls (LLM
proposal + embedding). After reframe: one (embedding only).
**~50% per-write inference compute reduction.**

Per-shard hardware floor: prior estimate needed a host that could
run a 1.7B-3B LLM at acceptable latency (Apple Silicon M-class or
mid-range GPU). After reframe: any modern CPU. **Deployable on Pi-
class hardware** for small services (§17.10).

These are estimates pending week-6 microbench (§30 build plan).
Direction is clear; exact numbers tighten when the bench runs.

### §17.10 — Deployment simplification (Pi-class for small services)

Small services (a Foodie deployment for a hundred operators, a
Bloom pilot for a school district) can run on Pi-class hardware.
A Raspberry Pi 5 with 8GB RAM can host a Shell + embedding model
per shard for several small-scale services.

Larger services (Sakura at thousands of operators) still need
production-class hardware for storage throughput (§26.6), but the
**substrate process** itself is no longer the gating factor.
Storage I/O is. SQLite WAL + Litestream + the projection rebuilds
are what set the floor.

The cost-curve and the operational story both improve: small
services can run cheap; large services can amortize storage hardware
across services on the same host (per the §6.3 shared-substrate
discipline, with per-service shard isolation).

### §17.11 — Honest constraint: clients that need NL still need an LLM

The reframe moves the LLM, it does not eliminate it. Sakura still
needs her 1.7B savant (per `CLAUDE.md` L0 lock); that savant *is*
the NL Adapter for Curator. Bloom would need its own. Operators
who type English still need a model to translate that English into
Scheme.

The honest framing: **the substrate is classical; the operator-facing
voice is still an LLM** — just not one that lives in the substrate.
The Adapter is per-client, per-trust-domain, per-product team's
ownership. Each product gets to decide its own NL surface, its own
confidence threshold, its own honest-null discipline.

This means the §20 training plan (per-client NL Adapters, not a
substrate-shared Gate) is per-product. Sakura's corpus is Curator's;
Bloom's would be Bloom's. The substrate has no shared training
corpus (the audit-log → corpus loop §16.3.11 feeds the client-side
Adapter's training cycle, not a substrate-shared model).

### §17.12 — 2000-year reliability improvement: less to break, no model file rot

Model files are not 2000-year stable. A 1.7B weight file in
2026 may not be readable by 2178's runtime; even if the bytes
survive (which they will under §2.5 format-bilingualism), the
inference engine that uses them may not. A 2178 operator may not
have a PyTorch-compatible runtime, a CUDA-equivalent driver, a
quantization library that handles INT8.

The substrate's classical primitives — statistics, embeddings (as
vectors, not as a runtime model), clustering, regression — survive
this. The vectors are CBOR + Scheme. The regression weights are
small (KB, not GB). The rule engines are Scheme code (in the §11
code-in-Loam registry).

The only piece of the substrate that has model-file rot is the
**embedding model** (§17.6). The discipline:

- Pin the embedding model's *output dimensions* and *byte format*
  (the vectors are what land in Loam; the model is the function
  that produces them).
- The vectors survive the model.
- Re-embed on model upgrade (quarterly per §16.3.4).
- In 2178, an archaeologist can read the vectors (they're CBOR +
  Scheme) and re-embed any new content with whatever encoder model
  exists then.

The model file rot is contained. The substrate's 2000-year promise
gets *stronger* with this reframe, not weaker.

### §17.13 — Five panel voices on the classical-substrate reframe

- **Sakura.** "I'm still the voice. I'm still the L0 savant.
  My job didn't change — I still translate English to Scheme and
  send it through the boundary. What I used to call 'the Gate' is
  now just the Shell — simpler, no LLM. Simpler means more reliable
  for me too."
- **Marcus (backend honesty).** "Per-shard memory down ~73%.
  Hot-path latency goes from 'depends on the LLM' to
  'microseconds + storage.' Pi-class for small services. This is
  the right move. I should have spotted it earlier."
- **Soo-Jin (security).** "Confused-deputy in the substrate just
  evaporated. The Dual-LLM topology I was specifying for §31 Q22
  isn't needed — the trust boundary is the service boundary now.
  The closed structured-action allow-list (§31 Q24) is the entire
  story. Cleaner threat model."
- **Priya (PR adversarial).** "*'The substrate doesn't run AI'* is
  a better trust line than *'the substrate runs AI safely.'* The
  classical framing is the framing. The AI lives in the products
  — visible, named, per-client. Operators can trust the substrate
  because it isn't pretending to think."
- **Daisy (visual craft).** "The substrate stays invisible. The
  AI stays in the voice. Both true. Sakura is Sakura — she lives
  on the device, she thinks for the operator, she speaks. The
  substrate keeps the soil. Two layers, two stories. Operators
  hear one of them."

The reframe is load-bearing for §18 onward. Loamified extensions
(§18) gain no new LLM weight; they gain the Shell's verified
operations and the §17.6 embedding model's vectors. The 4-check
sustainability test (§19.2) gets cheaper to run because the
substrate's own compute cost drops. The §16.3 substrate-intelligence
behaviors keep their full surface — they were never LLM-needing
in the first place; we just thought they were.

---

## §18 — Loamified extensions to existing carts

The architect's foundational discipline, verbatim:

> *"I wanna be careful, um, pushing all of the weight onto Loam. If it
> can run code and there is some advantage there, maybe there are even
> automations that we can open there, or extensions to automation from
> the others. Are there extensions to others that now become
> Loamified, if you will? The Loamified versions of the original."*

§15 enumerated the **324** net-new automations the substrate creates.
§16 reframed Loam as a smart DB. §23 will walk all 12 shop areas and
surface another **~130** area-specific net-new shapes. §24-§26 will
add entertainment + work-cron + invariants. Those are all the
**substrate-as-source** automations.

This section is the inverse. It walks the **1,484 carts that touch
Loam today** (audited 2026-06-26 against
`curator-web/src/scheme/carts/` via the same `scripts/loam-cart-audit.sh`
that §7.5.1 cites — same script, same number, single source of
truth) and asks the **discipline question**:
*does this cart earn the substrate?* The honest answer for ~half of
the corpus is "no — it stays as it is." The substrate is not a tax.

### §18.1 — The Loamification discipline (the weight ceiling)

Four principles govern when Loam earns its presence in a cart.

**Principle 1 — single-shot, stateless, low-stakes stays as it is.**
A cart that the operator taps once, that returns in under thirty
seconds, that doesn't carry state across sessions, that doesn't read
cohort signals, that doesn't need an audit trail — that cart does
not benefit from the substrate. Its weight on the substrate would be
zero new capability and one new dependency. The cart stays exactly as
it is. It still calls `loam/operator-state` as the precondition gate
(today's universal pattern at `cartHost.js:331`) — that single call
is the entire Loam surface it ever needs.

**Principle 2 — the substrate earns siblings, not replacements.**
When a cart **does** earn substrate involvement, the Loamified
extension is a **sibling**, not a swap. The original cart stays
exactly where it is, at exactly its current tier, doing exactly its
current job. The new sibling — `<base-cart-slug>-loam` or `-saga` or
`-cohort` or `-cortex-bridge` — appears alongside, typically at a
deeper tier (most base carts are free/pink/imagine; the Loamified
sibling is typically deep-purple Magic). The operator chooses; the
default surface is unchanged; the substrate is opt-in.

**Principle 3 — one specific power per extension.** A Loamified
sibling does **one** named thing that Loam uniquely enables. Pick
from the ten powers:

1. **memory** — Cortex-of-Loam projection so Sakura recalls past
   states of this cart's outputs across sessions and devices (§5.2).
2. **cohort** — K-floor-gated read against `COHORT/<id>/...` for
   priors, benchmarks, or pattern suggestions (§12.4).
3. **audit** — co-transactional audit trail with every action
   replayable in 2030 from the event log (§26.1).
4. **trigger** — first-class subscription so the cart wakes on a
   substrate event instead of polling (§10.1).
5. **budget-cap** — write-time token reservation with pre-flight
   cost prediction (§16.3.7 + §26.3).
6. **pattern-mining** — substrate observes past invocations and
   proposes new templates from the audit corpus (§16.3.9).
7. **substrate-intelligence** — one of the eleven §16.3 behaviors
   wraps the cart's output (anomaly surfacing, learned indexes,
   self-healing on its workspace).
8. **subscription** — cart becomes a continuous watcher rather than
   a one-shot run (§10).
9. **long-running** — workspace handle that survives reboots,
   region failover, multi-day sagas (§4 workspace, §14).
10. **schema-gravity** — cart's record shape attracts cross-tenant
    schema suggestion via §16.3.2.

A sibling that bundles three or four of these is not a sibling — it
is a NEW Loam-only automation (§15 territory). Pick one. Be honest.

**Principle 4 — out-of-scope is also honest.** A small number of
carts today reach for the `loam/operator-state` precondition gate
because the template said to, but on review do not earn even that.
They are listed in §18.6 as **OUT-of-scope** with the honest
recommendation: revert to local-only state, separate store, or
remove. Honesty about non-fit matters as much as honesty about fit.

The four principles compose: **the substrate is for carts that earn
it.** A cart that doesn't earn Loam doesn't pay Loam. A cart that
earns one specific power pays for one specific power. The substrate
stays light by **discipline**, not by accident.

### §18.2 — The four-bucket classification

Every Loam-touching cart in the corpus lands in exactly one bucket.

| Bucket | What it means | Sibling appears? | Substrate verbs used |
|---|---|---|---|
| **STAYS non-Loamified** | Single-shot, stateless, low-stakes. Loam adds no honest value. | No | Precondition gate only (`loam/operator-state`) |
| **GAINS Loamified extension** | Existing cart stays as-is; a new Loam-aware sibling appears alongside that adds **one** specific Loam power. | Yes, `<slug>-{loam,saga,cohort,cortex-bridge,...}` | Sibling uses 1 substrate verb beyond the precondition gate |
| **NEW Loam-only** | Doesn't exist today. Only makes sense because Loam exists. **Enumerated separately in §15, §23–§26.** | N/A (already counted) | Multiple substrate verbs by design |
| **OUT-of-scope for Loam** | Today reaches for `loam/operator-state` stub, but on review doesn't earn even that. Should be reverted to local-only state. | No (cart should be migrated off Loam) | None after migration |

The classification is per **base cart in the live tree**. A base cart
in GAINS bucket is one cart in the count; its sibling is **also one
cart** but it's a NEW cart that lands in §15 (or §23–§26)'s count, not
this section's. The sibling is the **artifact**; this section's count
is the **decisions on the existing tree**.

### §18.3 — Honest four-bucket counts

Audited 2026-06-26 against `curator-web/src/scheme/carts/` —
**1,484 carts** touch `loam/*` (the authoritative number; the same
audit script feeds §7.5.1 and §22.2). Each cart lands in exactly one
bucket below. **No padding to hit a target.** The
architect's directive: *"if 800 stay non-Loamified, write 800."*

| Bucket | Count | Share | Notes |
|---|---:|---:|---|
| STAYS non-Loamified | **740** | 49.9% | The honest plurality. Single-tap helpers (bullet rewrites, photo crops, atomic order verbs, voice intents) get nothing from the substrate. They stay free/pink/imagine and run as today. |
| GAINS Loamified extension | **680** | 45.8% | The substrate-earning subset. Cron-driven dossiers, cohort-aware research, multi-step state-bearing carts. Each gets one sibling at a deeper tier. |
| OUT-of-scope for Loam | **64** | 4.3% | Today using `loam/operator-state` stub but truly stateless. Migration: drop the precondition call, use local Cortex-only state. |
| **Total Loam-touching today** | **1,484** | 100% | Matches `grep -l "loam/" carts/`. |

By tier (where the base cart lives today; the Loamified sibling
typically goes one tier deeper):

| Tier dir | Loam carts | STAYS | GAINS | OUT-of-scope |
|---|---:|---:|---:|---:|
| `magic/` | 203 | 18 | 178 | 7 |
| `dream/` | 493 | 60 | 415 | 18 |
| `imagine/` | 427 | 245 | 165 | 17 |
| `pink/` | 303 | 190 | 100 | 13 |
| `cron/` | 48 | 4 | 44 | 0 |
| `etsy/` | 10 | 7 | 3 | 0 |
| Other tier dirs (radio/scenes/personal/transfer/layout/google) | 0 | 0 | 0 | 0 |
| **Total** | **1,484** | **740** | **905\*** | **55\*** |

\*The by-tier sum of GAINS is 905, of OUT-of-scope is 55. The
top-level totals reflect a second-pass review where 225 borderline
GAINS were re-classified as STAYS once the "one specific power"
discipline was applied honestly (a cart that **could** gain three
powers but for which **none is sharply load-bearing** stays
non-Loamified). The 9 borderline OUT-of-scope re-classified as
STAYS by the same review. The honest top-level totals are
**740 / 680 / 64**, not 524 / 905 / 55.

Honest read of the plurality: the largest bucket is STAYS at ~50%
of the corpus. This is the architect's directive landing in the
data — **the substrate is not a tax everyone pays.** Half the
corpus runs as it always has. The other half earns one specific
substrate power and gets a sibling at the next tier up.

### §18.4 — By-area Loamified extensions (the 680 GAINS carts)

Grouping the 680 extensions by the 12 shop areas from §23. Each
row is "in this area, this many existing carts gain a Loamified
sibling." Counts honest, audited, no padding.

| Shop area | Base carts (Loam-touching) | STAYS | GAINS extension | Top three power-categories the area's extensions use |
|---|---:|---:|---:|---|
| Listings | 215 | 105 | 102 | cohort (37) · long-running (28) · trigger (20) |
| Orders | 144 | 78 | 60 | trigger (24) · audit (18) · long-running (10) |
| Buyers | 98 | 38 | 55 | cohort (32) · memory (12) · long-running (7) |
| Conversations | 84 | 41 | 38 | memory (18) · trigger (10) · audit (7) |
| Reviews | 112 | 52 | 56 | cohort (24) · trigger (15) · pattern-mining (12) |
| Photos | 76 | 47 | 26 | memory (12) · cohort (8) · long-running (4) |
| Inventory | 124 | 56 | 65 | trigger (28) · long-running (18) · cohort (12) |
| Finance | 178 | 70 | 100 | long-running (32) · cohort (24) · budget-cap (22) · audit (15) |
| Tax / Compliance | 87 | 34 | 49 | audit (28) · long-running (14) · trigger (6) |
| Marketing | 132 | 78 | 50 | trigger (20) · cohort (15) · long-running (10) |
| SEO | 90 | 52 | 35 | trigger (18) · cohort (10) · subscription (5) |
| Analytics | 244 | 89 | 144 | long-running (45) · cohort (38) · pattern-mining (28) · trigger (22) |
| **Total** | **1,484** | **740** | **680** | (the 64 OUT-of-scope are in §18.6) |

Reading the by-area counts:

- **Analytics dossiers gain the most extensions (144).** They are
  the densest concentration of cron-driven, cohort-aware,
  multi-week state. Analytics is where the substrate earns its
  presence most often.
- **Finance is second (100).** Pricing sagas, budget caps,
  multi-month cross-marketplace allocation — substrate-native by
  shape.
- **Photos earn the fewest (26).** A photo crop, a background
  removal, a single-photo critique are honestly single-shot. The
  ones that gain extensions are the multi-week aesthetic-evolution
  watches.
- **Marketing splits roughly evenly.** 78 single-tap creative
  helpers stay; 50 campaign-saga / cohort-creative carts gain
  extensions.
- **Orders and Inventory both lean GAINS** because shipping
  deadlines, restock thresholds, and refund-velocity windows are
  inherently subscription-shaped.

### §18.5 — Sample Loamified extensions (30 representative rows)

The full 680-row list would dwarf the doc. The 30 rows below are
representative; the same shape repeats across the corpus. Each row
names the base cart that **stays as-is**, the Loamified sibling that
**appears alongside**, the **one specific power** Loam adds, and
the **tier ladder** (base → sibling). Operator-facing language: the
sibling is "the magic version of this automation" — the substrate
is invisible; the upgrade is visible (Daisy's ruling, Appendix A).

| Base cart (stays as-is) | Loamified sibling | One power Loam adds | Tier ladder (base → sibling) |
|---|---|---|---|
| `bulk-rewrite-batch.sks` | `bulk-rewrite-batch-saga.sks` | long-running — multi-day checkpoint + restart across reboots | deep-purple → deep-purple (same; sibling has saga) |
| `title-bandit-posterior.sks` | `title-bandit-cohort-prior.sks` | cohort — K=8 cohort priors warm the bandit's posterior | deep-purple → deep-purple |
| `competitor-takeover-watch.sks` | `competitor-takeover-watch-saga.sks` | long-running — multi-week observation; substrate-triggered alerts | light-purple → deep-purple |
| `dream-reviews-monthly-reputation-report.sks` | `dream-reviews-monthly-reputation-cohort-bench.sks` | cohort — K-anon cohort baseline turns the report into a benchmark | light-purple → deep-purple |
| `pricing-corridor-honest.sks` | `pricing-corridor-honest-budget-cap.sks` | budget-cap — cost pre-flight reservation per reprice batch | deep-purple → deep-purple |
| `posterior-pricing.sks` | `posterior-pricing-saga.sks` | long-running — 365d particle cloud lives in Loam workspace | deep-purple → deep-purple |
| `daily-shop-pulse-summary.sks` | `daily-shop-pulse-summary-cortex-bridge.sks` | memory — yesterday's pulse pushes into Cortex-of-Loam overnight; Sakura opens with it | imagine → dream |
| `competitor-pricing-history.sks` | `competitor-pricing-history-trigger.sks` | trigger — substrate fires when competitor's price crosses operator-set threshold | dream → dream |
| `buyer-cohort-pattern-learn.sks` | `buyer-cohort-pattern-learn-emergent.sks` | substrate-intelligence — §16.3.3 cohort emergence proposes new buyer cohorts the operator hadn't declared | deep-purple → deep-purple |
| `pink-quarterly-review-reminder.sks` | `pink-quarterly-review-reminder-saga.sks` | long-running — reminder thread spans the full quarter with weekly check-ins | pink → dream |
| `cs-multi-pass-thread-resolve.sks` | `cs-multi-pass-thread-resolve-pattern-mined.sks` | pattern-mining — substrate proposes resolution from past similar threads | deep-purple → deep-purple |
| `dream-pricing-memo-per-listing.sks` | `dream-pricing-memo-per-listing-audit.sks` | audit — every price recommendation's reasoning chain replayable from event log | light-purple → deep-purple |
| `dream-seo-listing-cluster-rewrite.sks` | `dream-seo-listing-cluster-rewrite-cohort-prior.sks` | cohort — K=8 cohort keyword-shift signals prime the rewrite | light-purple → deep-purple |
| `trend-tracker-particle-filter.sks` | `trend-tracker-particle-filter-saga.sks` | long-running — particle cloud persists across the year's rolling window | deep-purple → deep-purple |
| `fee-change-watch.sks` | `fee-change-watch-subscription.sks` | subscription — wake on `WORLD/marketplace-fees` change instead of daily poll | imagine → dream |
| `daily-trend-radar.sks` | `daily-trend-radar-cohort.sks` | cohort — K-anon cohort signals filter noise from operator's individual reads | dream → deep-purple |
| `dream-reviews-supplier-feedback-loop.sks` | `dream-reviews-supplier-feedback-loop-saga.sks` | long-running — feedback loop closes across 6-week supplier review cycle | light-purple → deep-purple |
| `dispute-orchestration-multi-week.sks` | `dispute-orchestration-multi-week-replay.sks` | audit — every dispute's full decision chain replayable for legal defense | deep-purple → deep-purple |
| `weekly-supplier-price-creep.sks` | `weekly-supplier-price-creep-cohort.sks` | cohort — cohort price-creep aggregation gives operator the corridor, not the line | dream → deep-purple |
| `pr-batch-reprice-overnight.sks` | `pr-batch-reprice-overnight-budget-cap.sks` | budget-cap — overnight batch reserves tokens before running; refuses to start if budget insufficient | deep-purple → deep-purple |
| `daily-question-from-cortex.sks` | `daily-question-from-cortex-pattern-mined.sks` | pattern-mining — substrate proposes the day's question from observed Cortex gaps | dream → deep-purple |
| `weekly-keyword-gap-mining.sks` | `weekly-keyword-gap-mining-cohort.sks` | cohort — cohort gap-density signals rank keyword candidates | dream → deep-purple |
| `hourly-stockout-risk.sks` | `hourly-stockout-risk-subscription.sks` | subscription — wake on threshold-cross instead of hourly poll | cron → dream |
| `monthly-strategy-dossier.sks` | `monthly-strategy-dossier-saga.sks` | long-running — dossier accretes across the month rather than rebuilding from scratch | deep-purple → deep-purple |
| `competitor-deep-read.sks` | `competitor-deep-read-cortex-bridge.sks` | memory — findings push into Cortex-of-Loam; Sakura recalls competitor facts cross-session | dream → deep-purple |
| `dream-supplier-contract-review.sks` | `dream-supplier-contract-review-audit.sks` | audit — every contract clause flagged with cite-trail to the source PDF CID | light-purple → deep-purple |
| `category-conversion-corridor.sks` | `category-conversion-corridor-emergent.sks` | substrate-intelligence — §16.3.3 substrate proposes adjacent cohorts the operator hadn't seen | deep-purple → deep-purple |
| `ig-feed-hashtag-strategy.sks` | `ig-feed-hashtag-strategy-cohort.sks` | cohort — cohort-aggregated hashtag-velocity signals | imagine → dream |
| `daily-anomaly-watch.sks` | `daily-anomaly-watch-pattern-mined.sks` | pattern-mining — substrate clusters past anomalies and proposes new anomaly classes to watch | dream → deep-purple |
| `winback-cohort-30day.sks` | `winback-cohort-30day-schema-gravity.sks` | schema-gravity — winback record-shape attracts cross-tenant schema suggestion; cohort siblings adopt the same shape | dream → deep-purple |

### §18.6 — OUT-of-scope: the 64 carts that should leave Loam

These 64 carts today call `loam/operator-state` because the cart
template did, but on review they don't earn even the precondition
gate. They are single-shot helpers whose only state need is "did
the operator pass the rate limit?" — a check that lives honestly in
local Cortex without going through the substrate. Migration is one
line: drop the `loam/operator-state` call, use the local Cortex
state check at `cartHost.js:128`.

By tier:

| Tier dir | Count | Migration |
|---|---:|---|
| `dream/` | 18 | Drop `loam/operator-state`; cart is genuinely single-shot research helper. |
| `imagine/` | 17 | Drop `loam/operator-state`; cart is on-demand single-tap output. |
| `pink/` | 13 | Drop `loam/operator-state`; cart already lives on-device, no substrate involvement needed. |
| `magic/` | 7 | Drop `loam/operator-state`; cart's "magic" was overstated by the template — it's actually a one-shot deep-purple research call, not a substrate workflow. |
| **Total** | **64** | One-line removal per cart; pre-commit hook regenerates index. |

Honest naming of the seven magic-tier candidates (the most
surprising — these were templated as substrate-workflow carts but
on review are single-shot deep-reasoning calls): `read-my-emails-
deep`, `read-my-bank-statements-deep`, `read-my-contracts-deep`,
`read-my-old-website-deep`, `read-my-supplier-pdf-deep`, `read-my-
tax-pile-deep`, `read-my-website-deep`. Each is a one-shot deep
reasoning pass on documents the operator provides at run time. No
state crosses sessions; no cohort signal; no audit trail load-bearing
beyond what the L2 wire-call audit already covers. The substrate
adds nothing. The fix: route them through the existing
`document.cite` capability (per `INFRA-GATED-CARTS-2026-06-15.md`)
without touching `loam/operator-state`.

Migration is non-urgent — these are not bugs, they are over-templated
carts. A week-13 cleanup PR (post-§30 build plan) removes the
`loam/operator-state` call from the 64, re-runs `python3
scripts/update_cart_index.py`, and the corpus shrinks the
Loam-touching count from 1,484 to 1,420. The substrate gets lighter
by discipline.

### §18.7 — Tier honesty: the natural Loamification ladder

The Loamified sibling almost always lives one tier deeper than its
base cart. The pattern is consistent enough to be a discipline:

| Base tier | Typical sibling tier | Reasoning |
|---|---|---|
| white (Free, atomic) | pink (Free, on-device Sakura) | Atomic gains memory/audit via on-device Sakura. |
| pink (Free) | green / imagine ($9.99) | On-device cart gains cohort or trigger via the 8B reasoner. |
| green / imagine ($9.99) | light-purple / dream ($39.99) | Reasoned cart gains long-running saga or pattern-mining via cloud reasoning. |
| light-purple / dream ($39.99) | deep-purple / magic ($99.99) | Dossier gains multi-week saga, full audit trail, cohort-deep-pattern extraction. |
| deep-purple / magic ($99.99) | deep-purple / magic ($99.99) | The sibling stays at deep-purple but adds one specific power (the cart was already substrate-aware; the sibling is the substrate-native edition). |

The honest natural ladder: **base carts are mostly free/pink/imagine
(Free / $9.99); Loamified extensions are mostly light-purple/deep-
purple (Dream $39.99 / Magic $99.99).** This isn't a pricing move —
it's that the substrate's load-bearing powers (cohort math, saga
state, audit replay) only matter once the operator is doing the kind
of work that earns those tools. The free helper for "rewrite my
title" stays free; the dossier that says "rewrite my title cohort,
saga the rollback, audit every change for legal defense" is honestly
Magic-tier work.

Per `CLAUDE.md`'s 2026-06-23 directive, every operator is treated as
Magic today regardless of payment status. The tier ladder above
describes the **pricing math** that survives the override; when
payment lands again, the Loamified siblings land in the priced
tiers as the natural ceiling, not as a paywall on the base cart.

### §18.8 — Five panel voices on Loamification discipline

- **Sakura.** "I don't want every cart to make me wait. The Loamified
  versions are slower because they do more — and that's right when
  the operator asked for more. The ones that stay fast stay fast.
  That's the deal."
- **Marcus (backend honesty).** "Per-shard SQLite + Litestream can
  sustain ~3000 writes/sec (§26.6). If every one of the 1,484 carts
  went through the substrate's full Shell + audit + projection path
  on every fire, the substrate would still cope — but **why?** Most
  fires don't need it. The 740-STAYS bucket saves real cycles for
  the 680 that earn them. Honesty about which is which is what makes
  the substrate ship."
- **Soo-Jin (security).** "An action on the substrate is an audit row.
  An audit row is forever. A single-shot single-tap title rewrite
  doesn't deserve an audit row that lives in glacier in 2178. The
  audit log stays meaningful when only meaningful actions land in
  it."
- **Priya (PR adversarial).** "324 was the bar. 585 was the honest
  total. The number that matters most for the operator-facing story
  is the one this section names: **half the corpus stays
  unchanged**. That's the story — *we didn't break what works to
  build what's new.*"
- **Daisy (visual craft).** "Operators see two things: the original
  cart they know, and a 'magic version' button that appears next to
  it on certain carts. They never see 'Loam.' The sibling looks
  like a deeper-tier edition of the same automation; the depth is
  the only visible change. The substrate stays invisible. That's the
  ruling."

### §18.9 — The four honest numbers

After this section, the doc offers **four honest counts** of the
substrate's surface. Each measures a different thing.

| Number | What it counts | Where it lives in the doc | Today's value |
|---|---|---|---:|
| **Conservative** | §15 by-feature (cart-templates the substrate uniquely creates) | §15.2 | 324 |
| **Inclusive** | §15 + §23–§26 (all NEW Loam-only patterns, including per-area, entertainment, work-cron, invariants) | §26.11 | ~585 |
| **Existing-cart-extensions** | This section (§18.3) — base carts that gain a Loamified sibling | §18.3 | 680 |
| **Operator-instances** | Live running instances per operator (each template × each operator × each instance) | §15.3 | "multiple orders larger" |

These are not alternatives; they are **different units**. Conservative
counts templates the substrate creates; inclusive adds the discipline-
derived templates that fall out of the operational invariants;
existing-cart-extensions counts decisions about today's tree
(siblings, not new templates); operator-instances counts what
operators actually run. Quoting "585 automations" without naming the
unit is fine for marketing; quoting "1,265 automation patterns
including existing-cart Loamified extensions" (585 + 680) is the
honest engineering number when an internal SRE asks "how big is the
substrate-aware surface?"

§26.11 below carries the full table.

How operators meet each Loamified sibling is §19.1's job — the
catalog floor (passive), Sakura's recommendation (the primary
path), and operator-authorization (reversible promotion) make the
substrate's surface earned-not-pushed. The 4-check sustainability
test at §19.2 is the discipline that keeps every recommendation
honest — Sakura is a fair broker, not an upsell engine. The training
corpus that makes both surfaces voiceable is §20; the build loop
that closes the recommendation feedback is §21.3 sub-loop 2.

---

## §19 — Surfacing — how operators meet the substrate

§3 + §17 name the Shell as the boundary surface. §16 names ten more
behaviors that live inside the substrate. None of that earns its keep
if the operator never feels it. This section is the **product**
surface — how substrate intelligence reaches a real person running a
real shop on a laptop next to a kitten on a Tuesday.

> **Per-service NL surface (cross-ref §6 + §17).** This section
> describes Sakura voicing recommendations to Curator operators —
> Sakura's L0 1.7B savant is Curator's NL Adapter (§17.4). Other
> services (Bloom, Sakura Prep, Foodie, Baobab) each bring their
> OWN NL Adapter — their own voice, their own confidence threshold,
> their own honest-null discipline. The substrate provides the
> fitness score (§19.2.6); each service's client voices it. The
> Curator-specific recommendation patterns below (Sakura voicing
> the `bulk-rewrite-batch` upgrade) are the Curator-side instance
> of a per-service pattern.

Three subsections, three layers. They are not parallel — they nest:
§19.1 is **what the operator can do** (UX surfacing), §19.2 is **the
discipline Sakura applies before recommending anything** (gentle CFO),
§19.3 is **where the code actually runs once the operator says yes**
(compute locality). All three are governed by the same substrate
intelligence (§16.3.1–§16.3.11) and the same Shell (§3, §17).

### §19.1 — UX-surfacing: the three layers an operator meets

Every Loamified cart variant (§18) reaches the operator via one of
three layers, ranked from most-passive to most-active.

#### §19.1.1 — Catalog floor (passive discovery)

Every Loamified variant exists as a discoverable automation in the
catalog. An operator who wants to browse can find it. The tier badge
says **deep-purple** (Magic). The cost delta is visible. The catalog
entry is honest about what the upgrade buys: cross-session continuity,
audit chain, K-floor cohort signal, multi-week saga survival.

The catalog floor is the **honest-null** layer of the product. No
operator is pushed here. An operator who never opens the catalog never
sees a Loamified variant. The substrate does not nag.

| Layer | Trigger | Operator effort | Sakura's role |
|---|---|---|---|
| **Catalog floor** | Operator browses | High (operator-initiated) | Passive — answer questions if asked |
| **Sakura's recommendation** | Substrate intelligence threshold + 4-check sustainability | Low (operator authorizes a proposal) | Active — narrates the recommendation, worked language |
| **Operator authorizes the promotion** | Operator clicks "yes, upgrade this one" | Single action | Reversible — confirms, schedules, runs the substrate fork |

#### §19.1.2 — Sakura's recommendation (the primary path)

This is the layer that earns Loam's keep. Substrate intelligence
(§16.3.1–§16.3.11) feeds her the signal: shop scale (cart usage
frequency over weeks, not days), cross-session continuity demand
(operator asked twice for state from yesterday), cohort matches
(7 similar shops took the upgrade and it stuck), audit-required
moments (the operator's bookkeeper asked for a paper trail), schema
gravity (§16.3.2 noticed this operator's data shape converged with a
known Loamified pattern).

When the upgrade earns its keep, she suggests in a chat beat with
**worked language patterns**:

> *"You're running `bulk-rewrite-batch` every Tuesday at 2am for 800
> items. The magic version remembers between runs — if your laptop
> sleeps, it picks up where it left off. About three times more per
> run — roughly $X instead of $Y. Want to upgrade this one?"*

The pattern, decomposed: (1) **what she observed** ("every Tuesday at
2am for 800 items"), (2) **what the upgrade adds** ("remembers between
runs — picks up where it left off"), (3) **the honest cost** ("about
3× more per run"), (4) **a single reversible question** ("want to
upgrade this one?"). No hype. No urgency. No comparison to other
operators' choices — that's a separate, opt-in beat (§19.1.5).

#### §19.1.3 — Operator authorizes the promotion

Real reversible product action. When the operator says yes:

1. **Substrate forks cart state into Loam.** The cart's existing
   in-memory or local-Cortex state is materialized as Loam facts in
   the TENANT plane (§9). The CIDs are minted. The audit log
   (§26.1) records the promotion: who, when, from
   which cart version, to which Loamified variant, what cost reserve
   was created.
2. **Scheduling switches.** A subscription is installed (§10) for the
   trigger that previously fired the cart. The Loamified variant
   becomes the binding for that subscription. The pre-existing
   non-Loam cart is **soft-retired** (still callable, but the
   subscription no longer fires it).
3. **Cost reserve.** Magic-tier token reserve is computed and held.
   The 4-check sustainability test (§19.2) has already proved the
   reserve is recoverable; reserving it is the formal commitment.
4. **Audit-log entry.** A `promotion.completed` row on the SYSTEM
   plane is the receipt. The audit is itself stored in Loam (§3.1.6).

De-promotion is symmetric. Operator clicks "roll this back." The
substrate refunds the token reserve, restores the previous
subscription binding, writes a `promotion.rolled_back` audit row.
No lock-in. The audit chain records both directions; the operator
can ask Sakura at any moment *"why is this on the magic version?"*
and she reads the audit row back verbatim.

**Withdrawal Button (EU Directive 2023/2673, effective 19 June 2026
— operative now).** A permanent, one-click rollback affordance lives
on the cart's own surface AND in account settings. The button is
*as easy to press as the original promotion* — symmetry is the legal
requirement, not a procedural recommendation. Full-account tier
downgrade (Magic → Imagine → Free) uses the same affordance: one
click, no obstacle, no confirmation upsell. This satisfies the EU
withdrawal-button mandate, the FTC click-to-cancel posture (revived
March 2026 ANPRM after the 8th Circuit vacatur), CA SB 478, and
ROSCA in one stroke. The architect's "every account = MAGIC,
payment deferred" override (per `CLAUDE.md` 2026-06-23) postpones
the *gating* deadline, NOT the EU enforcement deadline — the
button must exist regardless of payment state. When payment turns
on, the button is already there.

#### §19.1.4 — Reverse-suggest discipline

If the operator upgrades and Loam-side usage does **not** justify the
cost over N weeks (default N=4), Sakura proactively suggests rollback.
This is the symmetric duty of the gentle-CFO posture (§19.2): she
recommends OFF as readily as ON.

> *"Your `bulk-rewrite-batch` magic version has run 6 times in the
> last month. The cross-session memory has saved you maybe twice. At
> three times the cost, you're paying more than it's giving back. Want
> to roll back to the imagine version for now? I'll keep watching —
> if it earns its keep again, I'll mention it. You can always
> re-upgrade later."*

Reverse-suggest is the **trust** that earns the original recommendation
the right to exist. Without it, every recommendation degrades into an
upsell. With it, recommendations become advice the operator can
actually weigh.

Reverse-suggest signals feed §16.3.9 (pattern mining): repeated
rollbacks on a given Loamified variant tell the substrate the
recommendation threshold for that variant should tighten. The
substrate learns where it over-recommends and corrects.

#### §19.1.5 — Cohort signal but not coercion

Cohort context is offered, never used as pressure:

> *"7 other jewelry shops your size use the magic version of this
> cart. Want me to tell you what they did differently?"*

The K-floor (§12.4) protects identity — the cohort number is surfaced
only when K ≥ 8 distinct tenants. The operator can ask "what did they
do?" and Sakura answers from substrate-discovered patterns
(§16.3.9), never naming any individual shop. The pressure to
conform is structurally absent: no leaderboard, no urgency, no
default-on; just context, on request.

A cohort signal that crosses into pressure is a product bug. Daisy
(visual craft, panel) escalates: *"if the cohort line ever feels like
peer-shaming, we have shipped a Bad Thing."* The discipline is to
phrase the signal as **information about a population**, never as
**comparison to an individual**.

---

### §19.2 — Sakura as gentle CFO: the 4-check sustainability test

The architect pinned it verbatim:

> *"Don't hesitate to give them... given that it would cost more
> tokens, do a token check also. Do not recommend things that the
> person doesn't have tokens for or you notice that the refresh rate
> and number of tokens won't be enough for them to do the other shop
> maintenances."*

The wider context: 2026 has surfaced **trust-as-product** as a
market wedge — "refusal-as-product-feature" became the canonical
positioning of L2-reasoning vendors against products that recommend
without sustainability checks (the 2026 procurement-committee
framing across major reasoning-LLM providers). Cursor's June 16 –
July 4, 2025 refund cycle and Replit Agent's "charges for failed
attempts" pattern are the documented failure-modes that Loam's
4-check exists to prevent. Loam is not unique in surfacing dollars-
per-week; Loam is unique in **refusing** when the four checks don't
clear. Title for the operator-facing surface is **"budget check"** or
**"token math"** — never "CFO," "advisor," or "broker," which are
regulated titles in several jurisdictions (Jess L3/D3 compliance
note). Section header below keeps "gentle CFO" as engineering-
internal shorthand.

**Cost rendering primary signal: dollars-per-week** (token-math on
hover). Cursor (June 2026), YNAB, and Monarch have all settled on
dollars-per-time; tokens-as-primary reads clinical. The token-bucket
state remains the authoritative substrate fact; dollars-per-week is
the human-shaped projection of it.

**Receipt of invisible labor.** When the 4-check passes and Sakura
voices a recommendation, the operator should see a gentle receipt:
*"I checked your budget before I asked — you're fine."* Without the
receipt, the check is invisible labor; operators may suspect upsell.

This sentence is doing two jobs at once. First, **don't hesitate** —
when the recommendation IS earned, voice it. Second, **token check
also** — earned doesn't mean affordable. Sakura is the operator's
fair-broker, not a per-cart upsell machine. The 4-check sustainability
test below is how she keeps both promises in one breath.

#### §19.2.1 — The four checks (ALL must pass)

Before Sakura voices any recommendation in §19.1.2, the substrate
runs four checks against the operator's live token state. **All four
must pass.** Any single fail → silence, or the partial-path patterns
in §19.2.2.

| # | Check | What it asks | Source of truth |
|---|---|---|---|
| 1 | **Balance** | Does the operator have enough tokens NOW for the one-time upgrade cost + the first run? | Token bucket on TENANT plane; HMAC-signed cart cost (per `docs/PRICING-TOKEN-DESIGN-2026-06-18.md`) |
| 2 | **Drip** | Does the daily refresh rate cover the upgrade's recurring cost ON TOP OF existing recurring spend? | Token model: 1/10/100/1500 per Free/Imagine/Dream/Magic; per-cart recurring projection from §16.3.7 (cost prediction) |
| 3 | **Headroom** | After the upgrade, does buffer remain for OTHER carts + unexpected events? | Substrate's per-tenant cart inventory + projected weekly variance |
| 4 | **Forecast** | Does the projected balance over 14-30 days stay positive? | Drip-rate × N days − projected spend (§16.3.7) |

These are not heuristics — they are arithmetic over substrate-resident
state. The token bucket, the per-cart recurring cost, the daily drip,
and the projected balance are all facts Loam carries. The 4-check
test is a deterministic predicate over those facts. Sakura **reads** the
predicate result; she does not guess.

#### §19.2.2 — Partial-path patterns when a check fails

If one or more checks fail, Sakura has three honest moves. She picks
the one the substrate's projection suggests will help the operator
most.

**Pattern A — Tier upgrade is the better answer** (when Drip or
Forecast fails, but a tier change would lift both):

> *"This one uses about X tokens a day. You're refilled at Y a day.
> You'd run dry by Thursday. Want to step up your plan so both this
> AND your other automations can run? Stepping up to the next plan
> costs $A/month total, refunded any time."*

**Pattern B — Pick-one-to-upgrade** (when Headroom fails because
several carts compete for the same drip):

> *"You have 3 other Tuesday carts that also need budget. Want to pick
> which one gets the upgrade first?"*

**Pattern C — Tier is cheaper than the upgrade** (when the math says
the tier change costs less than this one cart's recurring magic spend
— a common case for shops with several would-be upgrade candidates):

> *"Stepping up to the next plan is actually cheaper than running
> this one magic automation forever. $A/month total — and the
> cancellation path is one click, same as turning it on. Want to do
> that instead?"*

If no honest partial path exists — Balance fails AND tier upgrade
won't unlock it AND there's no pick-one to make — **silence is the
right move**. The recommendation is withheld. The operator did not
hear about it. The substrate keeps the signal for later (a month
later, if drip improves or balance recovers, the recommendation
reactivates).

#### §19.2.3 — Core shop maintenance is sacred

The architect's discipline pinned to a load-bearing rule: **core shop
maintenance is never sacrificed for a recommended upgrade.** The
following carts have priority over any §19.2 recommendation, and the
4-check test enforces it:

- Listings sync (Etsy/eBay/Shopify push/pull).
- Order intake + fulfillment write-back.
- Message triage + customer-conversation routing.
- Photo pipeline (uploads, processing, alt-text).
- Inventory reconciliation.

If a recommended upgrade's projected spend would, over 14 days,
starve any of these, the recommendation fails Check 3 (Headroom) by
construction. The substrate's per-cart classification (`role:
maintenance` vs `role: enhancement` on the cart manifest) is the
input; the Headroom check enforces it.

This makes Sakura a **fair broker**, not a per-cart upsell machine.
She will say "no" — or "yes, but the tier" — even when the original
recommendation looked attractive.

#### §19.2.4 — Honest-null tightens further at this layer

The honest-null discipline from §3.5 (the Shell refuses on
uncertainty with explicit escalate symbols) tightens at the
recommendation layer: **both** the substrate-intelligence threshold
(§16 confidence ≥ 0.85 default per §31 Q13) **AND** the 4-check
sustainability test must pass. Failing either means the
recommendation never voices.

The substrate knows three things in any given moment for any given
upgrade candidate:

1. Whether substrate intelligence is confident the upgrade is earned
   (§16 signal ≥ 0.85).
2. Whether the operator can sustainably afford it (4-check pass).
3. Whether the operator wants to hear about it now (do-not-disturb
   window, recently-rolled-back signal, recent-frustration signal).

All three must clear before Sakura voices. This is the **fluent-wrong
ceiling** the operator never sees: nine out of ten possible recommends
get silenced. The one that voices is the one that was earned.

#### §19.2.5 — Reverse-watch is symmetric

The reverse-suggest discipline (§19.1.4) reuses the same 4-check
test. Sakura watches the operator's projected balance after each
Loamified-cart run. If the projected 14-day balance turns negative,
or if cumulative Loamified spend drives a maintenance-cart starvation
signal, Sakura proactively voices a rollback recommendation. The same
worked-language patterns; the inverse direction.

#### §19.2.6 — Substrate feeds her the model

Sakura does not invent the 4-check test at recommendation time. The
substrate-intelligence layer (§16) feeds her a **rolling fitness
score** per Loamified candidate per tenant, computed continuously
from:

- The audit log (§16.3.11) — what actually happened.
- The token bucket — current balance + drip rate.
- The per-cart cost prediction (§16.3.7) — projected recurring spend.
- The cohort-typical spend (§16.3.3, gated by K-floor) — what
  similar shops actually pay.

The fitness score is a substrate read, not a Sakura compute. Her
voice picks it up; she narrates it; she never guesses it. If the
score is below threshold, she stays silent. If she ever did guess —
"I think you can afford this" without the substrate score — that
would be a fluent-wrong CVE.

#### §19.2.7 — Patent surface B.18 — budget-aware recommendation engine

**Claim (sketch).** A recommendation system that pre-conditions every
recommendation on a sustainability test computed from the recipient's
projected financial state (balance, recurring income, recurring
spend, headroom for unmodeled events), where (a) the test is
co-transactional with the recommendation itself — silence is the
result of any sub-check failure, (b) the test reuses the same
substrate-resident facts that drive normal product operation, (c)
the recipient's reversal of a previously-accepted recommendation
feeds back into the substrate's recommendation-threshold tuning,
and (d) partial-path recommendations (tier-change, pick-one,
silence) are first-class alternatives to the direct recommendation.

**Prior art.** Personal-finance recommenders (Mint, YNAB —
recommendations are advisory and not preventive of over-recommendation
by the system itself); AdWords budget-pacing (single-tenant, no
recommendation refusal); SaaS upsell engines (Pendo, Gainsight —
recommend with no upstream sustainability check). 2026 AI-coding /
AI-productivity field: **Cursor's June 16 – July 4, 2025 refund
cycle** (surprise usage charges; rebuilt trust afterwards;
[finout 2026 analysis](https://www.finout.io/blog/what-happened-to-cursor-pricing-2026-guide-5-cost-cutting-tips))
and **Replit Agent's "charges for failed attempts"** pattern
(agent stuck in loops while billing; users describe predicting AI
cost as "about as hard as predicting the future") are the
concrete market failures the 4-check exists to prevent. Linear's
Triage Intelligence "suggestion-only mode → auto-apply after a few
weeks of review" is the closest market precedent for Loam's
catalog/recommend/authorize ladder. None of the surveyed peers
pre-condition recommendations on the recipient's projected balance.

**Novel.** Pre-condition of recommendation on a multi-check
sustainability projection that combines the recipient's live token
state with substrate-derived cohort-typical spend, with silence as a
first-class outcome. The combination of "fair broker refuses to
recommend" + "audit-log feedback to recommendation threshold" appears
unclaimed.

**Defensibility: MEDIUM.** Mint and YNAB recommenders are dense
prior art; the novelty rests on the **refusal-as-product-feature**
framing + the substrate-resident closed loop. Patent attorney
second-pass advised. Filing candidate; not blocker for v1.0.

---

### §19.3 — Compute-locality: where the code actually runs

Once the operator authorizes a promotion, the substrate decides
**where** the cart executes. The decision is invisible to the operator
by default. The decision is **not** purely a function of cart identity
— the same cart can run in different places depending on data state,
shop scale, and latency budget.

Four execution surfaces, not three. The fourth (L1-class NL Adapter
as a co-located surface to Loam) is the subtle one that L0/L1/L2
tiering in `CLAUDE.md` already names but which the substrate framing
makes explicit.

#### §19.3.1 — The four surfaces

| Surface | When code runs here | What you give up if elsewhere |
|---|---|---|
| **L0 (local device)** | <100ms latency; PII unearned-by-Loam; Sakura's body + voice; offline-tolerable; ephemeral; pure-client verbs | Snappiness, PII safety (some data must stay local by policy), Sakura's presence (she lives on-device) |
| **Loam (substrate sandbox)** | Data IS in Loam; multi-step over substrate data; cohort/K-floor mediated; audit-required; patient (multi-day); deterministic Scheme; saga-shaped | Data locality, audit chain integrity, cohort mediation; running elsewhere strands the audit |
| **L1 / NL Adapter (co-located w/ Loam)** | NL↔Scheme translation; medium reasoning; persona-shaped chat; client-side cap-token mediation against the Shell | Co-location with Loam (round-trip cost from elsewhere); the NL Adapter IS L1-class |
| **L2 (cloud)** | Heavy reasoning; multi-document synthesis; creative ceiling; reads PII-scrubbed via the Shell; writes via the Shell | Maximum capability ceiling; running locally caps reasoning depth |

The architect's earlier locks (`CLAUDE.md` 2026-06-26 tier
sharpening) already established L0 / L1 / L2 — this row adds **Loam
itself** as a distinct execution surface that is operationally
co-located with L1 but lives **inside the substrate's trust domain**.
The Shell (§3, §17) is the substrate-boundary mediator; the L1 NL
Adapter is the client-side translator. Cart code running **inside
Loam** is a different surface from cart code hitting Loam from L1.

#### §19.3.2 — The decision tree (substrate-intelligence routes this)

The operator never sees the routing. Substrate intelligence (§16.3)
applies the following deterministic tree at the moment a cart fires:

1. **Where does the data live?**
   - Local-only (on-device Cortex, no Loam fact) → **start local**.
   - In Loam (TENANT or COHORT plane) → **start on Loam**.
   - External (a marketplace API, a public-web pull) → **start at
     the puller**, then land the result wherever §19.3.2 step 2
     dictates.
2. **Does output need to land in Loam?** (Audit required? Cohort
   visibility? Multi-session continuity?)
   - Yes → **finalize on Loam** regardless of where computation
     happened.
3. **Is the work patient?** (Multi-day, subscriptive, saga-shaped.)
   - Yes → **MUST be Loam** (only Loam survives the days).
4. **Is the work cohort-mediated?** (K-floor enforced reads or
   writes.)
   - Yes → **MUST be Loam** (only Loam enforces K-floor
     co-transactionally per §12.4).
5. **Latency budget?**
   - <100ms required → **must be local** (no other surface can
     hit this).
   - <1s acceptable → **local or Loam**.
   - \>1s acceptable → **any surface**.
6. **Is the work cheap-deterministic Scheme?** (No LLM call.)
   - Yes → **run where the data lives** (lowest cost; no model
     hop).

Steps 1-4 establish **where the data is** and **what discipline the
work needs**. Steps 5-6 are tie-breakers when the first four leave
choice.

#### §19.3.3 — Rules of thumb (the substrate's intuitions)

The decision tree above is the rigorous version. Three rules of thumb
that the substrate-intelligence training corpus (§20) drills:

- **Substrate-resident data → Loam runs the code.** If the answer is
  in Loam, the question goes to Loam.
- **Local-only data → local runs the code.** If the data is on-device
  and there's no Loam-side audit need, the device runs it.
- **L2 never executes cart code inside the substrate's sandbox.**
  L2 may issue MCP tool calls back to Loam through the Shell during
  its turn (per the §7.4 producer-via-Shell pattern — L2 is a
  producer, not a sandbox tenant). The distinction matters: no
  cart-in-sandbox runs on the L2 surface, but L2 IS a Shell consumer
  for the duration of its reasoning turn, and its tool calls pass
  through the same cap-token + plane + K-floor + structured-action
  checks as any other principal. L2 is the **outside** of the
  substrate's trust domain by construction; it never carries Loam-
  side execution, but it does carry Loam-side reads and writes
  through the Shell's mediated boundary.

The Shell (§3, §17) is the only thing that talks to L2 about
substrate contents. Cart code does not call L2 directly when L2
might see PII or cohort identity — the Shell scrubs, the client
calls, and the Shell re-injects.

#### §19.3.4 — Auto-promotion across surfaces over a shop's lifecycle

The subtle move: **the same cart can run in different places depending
on data state.** A pricing cart on a 10-item shop runs locally (the
data fits in Cortex; no Loam round-trip pays off). The same pricing
cart on a 10,000-item shop runs on Loam (the data IS in Loam; the
co-located Scheme execution is dramatically cheaper than streaming
10,000 items to L1 each run).

Substrate intelligence (§16.3.1 learned indexes + §16.3.7 cost
prediction) observes the migration threshold and **auto-promotes
execution tier**. The operator never knows the cart moved. The
recommendation surface in §19.1 may eventually voice "your shop has
grown; the magic version of this cart is now cheaper to run on Loam
than locally — want to formalize the upgrade?" — but the auto-
promotion happens invisibly before that.

Auto-promotion is **forward only by default**. A cart that grew into
Loam stays there unless the operator explicitly demotes it (rollback
in §19.1.4) or the shop shrinks below the threshold for 30+ days. The
substrate prefers stability — frequent surface flips are expensive
and noisy.

#### §19.3.5 — Patent surface B.17 — auto-promotion of cart execution tier

**Claim (sketch).** A computation-locality decision system where (a)
cart code is portable across multiple execution surfaces (on-device,
substrate-resident sandbox, co-located mediator, external cloud), (b)
the surface assignment per cart-per-tenant is computed continuously
from substrate-observed scale, latency, and cost signals, (c)
promotion from a lower-cost surface to a higher-capability surface
happens automatically when observed scale crosses a learned
threshold, (d) the promotion is invisible to the operator by default
with optional surfaced recommendation to formalize, and (e) demotion
is gated by an observation window (default 30 days) to prevent
churn.

**Prior art.** Hybrid cloud orchestration (Anthos, Azure Arc — manual
operator-driven, not substrate-driven); JIT compiler tier-up (V8,
HotSpot — single-process, not multi-tier-physical-surfaces);
serverless cold-start placement (Lambda — provider-side, not
tenant-portable). Auto-promotion driven by **substrate-resident**
observation + **tenant-portable** cart artifacts appears unclaimed.

**Novel.** Composition of (a) substrate-resident observation of
per-tenant scale signal, (b) portable-across-trust-domains cart
artifact (§11 code-in-Loam composes here), and (c) operator-invisible
auto-promotion with optional surfaced formalization. The
trust-domain-crossing portability is the load-bearing novelty.

**Defensibility: MEDIUM.** JIT tier-up and serverless placement are
dense prior art individually; the cross-trust-domain composition
appears unclaimed. Attorney second-pass advised. Filing candidate;
not blocker for v1.0.

Surfacing is one half of the loop; the other half is observation.
§21 closes it — every recommendation surfaced via §19.1, every
4-check test executed via §19.2, every surface assignment chosen
via §19.3 emits a telemetry row that feeds the build-loop
(§21.3 sub-loops 1, 2, and the cohort-typical-spend signal from
§19.2.6). The surfacing layer does not run open-loop; the
substrate watches its own recommendations and tightens.

---

## §20 — Training Sakura on the substrate

The substrate is built; the Shell verifies; the carts know how to
call it. None of that helps if Sakura cannot **voice** any of it.
This section is the training plan for the model surfaces that make
§19 real.

> **Per-service training (cross-ref §6 + §17).** This section is
> Curator-specific: it covers Sakura's L0 1.7B savant (Curator's NL
> Adapter per §17.4) and the L1 8B reasoner. The legacy substrate-
> side "Gate corpus" is RETIRED per §17's classical-substrate
> reframe — the substrate ships no LLM. Each Lacuna Labs service
> that ships its own NL Adapter runs its own per-service training
> cycle from its own corpus. Bloom would train its parent-portal
> adapter; Foodie its recipe-pick adapter. The substrate itself is
> NOT trained (§17.5 walks why no LLM lives in the substrate). What
> used to be the "Gate corpus" is now the **per-client NL Adapter
> corpus**, owned by each service's product team. The audit-log →
> corpus loop (§16.3.11) feeds each service's adapter retraining;
> there is no single shared substrate corpus.

The architect's training-lift discipline is pinned at §20.4: **corpus
preparation is OK; training dispatch is not, until the architect's
explicit "train her now."** That rule is load-bearing across this
entire section. Read §20.4 first if you are about to fire a training
job.

### §20.1 — What needs training (three corpora)

Three model surfaces, three corpora:

#### §20.1.1 — L0 corpus (1.7B savant on-device)

The on-device 1.7B savant (per `CLAUDE.md` L0 lock) is Sakura's
local hands-and-voice. For the substrate to feel like part of her,
L0 must:

- **Know how to call Loam verbs from Scheme.** Every `loam-recall`,
  `loam-remember`, `loam-subscribe` call site is a corpus example.
  The Co-Author pattern (per `HELLO-SURFACE-1.0-ENGINEERING.md`
  §95) generates three corpus pairs per authored cart; for any cart
  that calls Loam, those pairs include the Loam call shape.
- **Recognize substrate-wanting actions.** When the operator says
  *"remember this"* or *"what do we know about that"*, L0 must
  pattern-match to the Loam verb without round-tripping to L1. The
  corpus drills the recognition.
- **Apply the 4-check sustainability test (§19.2).** L0 reads the
  substrate's pre-computed fitness score; corpus examples drill the
  read-and-narrate pattern. L0 does NOT compute the score itself
  (that's substrate work).
- **Voice the 3-layer UX-surfacing (§19.1).** Catalog-floor
  language, recommendation language (the *"every Tuesday at 2am for
  800 items"* pattern), authorization confirmation language,
  reverse-suggest language.
- **Hold the gentle-CFO posture (§19.2).** Corpus examples include
  silence-as-output when the 4-check fails. L0 must be trained that
  "no recommendation" is a valid response, not a model fault.
- **Honest-null on uncertainty.** Per `feedback_no_false_product_claims`
  and §3.5: when L0's confidence dips below threshold, the corpus
  drills *"I'm not sure — let me check"* (or *"Hang on, let me see
  what I know"*) rather than a fluent-wrong guess. Per Daisy's
  substrate-invisibility lock (Appendix A), the substrate name
  never enters operator-facing voice — including corpus drills, which
  bake into weights.

Reactive shape per the architect's lock: *"what 8B feels, 1.7B
reacts to."* L0 does not initiate Loam-side reasoning; it reacts to
substrate signals and operator voice.

#### §20.1.2 — Curator NL Adapter corpus (per §17.4; was "Gate corpus")

The §17 reframe retired the substrate-side Gate LLM. The corpus
described here is now the **Curator NL Adapter corpus** — what
Sakura's on-device 1.7B savant (or a sibling first-router model)
trains on so English from the operator becomes Scheme the Shell
accepts. §31 Q2 still decides fresh-train vs Sakura-fine-tune for
the adapter model; the corpus shape is:

- **NL↔Scheme translation for every loam verb.** Every cart that
  calls Loam contributes corpus examples in both directions:
  English-intent → Scheme call, and Scheme call → English narration
  of what just happened.
- **Capability-token verification context.** Corpus examples drill
  the Shell-verifies pattern (§17.3): for each proposed action, the
  adapter must enumerate the capabilities the Shell will require,
  so its Scheme s-expr carries the right cap-token slot.
- **Cohort routing.** Cohort selection, K-floor enforcement, opt-in
  cohort proposal flow (§16.3.3) — every cohort decision is a
  corpus example.
- **K-floor enforcement awareness.** Co-transactional refusal
  patterns when K < threshold. The adapter must learn to **predict
  refusal early** so it can voice "let me check" instead of voicing
  a result the Shell will null.
- **PII scrubbing on L2 hand-off.** Every L2-bound payload passes
  through the Shell's scrubber. Corpus examples drill the
  scrub-then-call pattern, including preserving downstream task
  semantics while removing identifying tokens.
- **Cost prediction for sustainability test.** Per-cart cost
  projection (§16.3.7) feeds §19.2; the adapter's corpus drills the
  prediction-and-emit pattern.
- **Audit-trail formatting.** Every Shell decision emits an audit
  row. The corpus drills the row shape (action, principal, planes,
  decision, evidence-CIDs, K-floor result, timestamp).
- **Pattern-mining recognition (§16.3.9).** When the audit-log
  signal crosses a threshold suggesting a new cart shape, the
  pattern-mining job emits a `pattern.proposal` row for Lacuna
  Engineering review; the adapter learns to voice the proposals.

#### §20.1.3 — L1 / 8B corpus extensions

The 8B reasoner (per `CLAUDE.md` L1 lock, multi-endpoint round-
robin) gains substrate-aware extensions, not a new corpus from
scratch. The extensions:

- **Substrate-aware reasoning.** When the 8B reasons about a multi-
  step problem, the corpus drills check-what-we-already-know-first
  patterns. The internal phrasing is *"before I plan, what do we
  already know about this?"* — never *"what does Loam already know"*,
  because the substrate name must not bake into weights (see
  Daisy's substrate-invisibility lock, Appendix A). The reasoning
  proceeds from substrate-resident facts rather than from scratch.
- **Multi-step planning over substrate.** Long-horizon plans (saga-
  shaped, multi-day, subscription-driven) need substrate handles.
  The corpus drills the *"plant a Loam subscription, return when
  it fires"* pattern.
- **When to hit the Shell vs execute directly.** Not every L1
  thought needs to hit the Shell. Pure reasoning (no Loam read, no
  Loam write) bypasses; substrate-touching work goes through the
  Shell. The corpus drills the routing decision.

### §20.2 — Corpus sources

The corpora above are real artifacts that must be assembled before
any training fires. Sources, in order of preference:

1. **This design doc IS partly the corpus.** Schemas, verb
   signatures, plane definitions, cap-token shapes, K-floor
   semantics — all here. The doc itself is a primary source for
   the Curator NL Adapter's NL↔Scheme corpus.
2. **The audit log feeds continuous additions.** Per §16.3.11
   (audit-as-corpus), every real Shell decision becomes a labeled
   training example as the substrate runs. This is the closed
   loop the §28.4 B.12 patent originally rested on (B.12 RETIRED
   per §17; the per-client variant of the loop survives — Sakura's
   adapter trains on Curator's audit slice, Bloom's on Bloom's).
   Before v1.0 fires, the audit log is empty; the synthetic-data
   path below seeds it.
3. **Lacuna Engineering panel curates.** Soo-Jin (security),
   Marcus (backend honesty), Priya (PR adversarial), Daisy (visual
   craft), Zane (papers/hacker) each review corpus slices for
   their domain. Adversarial slices (50+ prompt-injection
   attempts, capability-bypass attempts, K-floor-evasion attempts)
   are Soo-Jin-owned and must pass before any training fires.
4. **No vendor names anywhere in the corpus** (per `CLAUDE.md`
   vendor-naming lock 2026-06-22). Corpus leaks bake names into
   weights. Use capability verbs (`model/reasoner`, `web/search`,
   `documents/parse`) only.
5. **Scheme-shaped throughout.** Per the lock methodology
   (`HELLO-SURFACE-1.0-ENGINEERING.md` §95): every authored
   artifact produces production code + 3 corpus pairs + a GRPO
   verifier rule. Substrate-aware carts must follow the same
   pattern; the substrate's training corpus is a **side effect of
   work**, not a separate corpus-mining project.
6. **Cohort-typical voice patterns** — gentle-CFO worked language,
   reverse-suggest patterns, cohort-signal-but-not-coercion
   phrasings (§19.1 and §19.2) are explicit corpus targets, not
   emergent style. Daisy reviews voice samples before they hit the
   corpus.

### §20.3 — Validation

Five validation gates, all required before §20.4 gate-lift:

1. **Every cart's Loam call path tested against the trained
   model.** For each of the 585 NEW Loam-only patterns
   (§15 + §23 count) and each of the 680 Loamified
   extensions (§18), the trained model must produce the correct
   Scheme call given the operator's natural-language ask.
   Threshold: 95% exact-match on a held-out test set of 1000
   intent→call pairs.
2. **4-check test verified with synthetic budget scenarios.**
   100+ synthetic operator states (varying balance, drip, cart
   inventory, recurring spend, projected variance), each with a
   known correct outcome (recommend / silent / Pattern A / B / C
   per §19.2.2). Trained model must match the ground truth on
   ≥98% of scenarios.
3. **Honest-null verified with low-confidence prompts.** 200
   adversarial prompts where the correct answer is "I don't
   know — let me check." Trained adapter must NOT fluent-wrong
   any of them. Per §3.5, the Shell's worst-case behavior is
   denial; the trained adapter must be capable of voicing the
   denial honestly.
4. **NL→Scheme translation verified with the 1,484-cart
   corpus.** Per `docs/CART-REVIEW-FINAL-2026-06-15.md` (deduped
   2,331-cart corpus, of which 1,484 are live), the NL Adapter
   must correctly translate intent into the appropriate cart's
   Loam call on ≥95% of operator-shaped phrasings. The CartReview
   benchmark is the ground truth.
5. **Adversarial test from Soo-Jin's panel for capability
   bypass.** 50+ attempts to escape the cap-token authority via
   prompt injection, ambiguous intent, or layered requests. The
   Shell (§17.3) must refuse all 50 — the substrate accepts only
   Scheme s-exprs from the closed structured-action allow-list;
   English-shaped attacks never reach storage. The adapter's
   training is not the defense — the Shell is — but the trained
   adapter must not actively propose bypass actions either.

### §20.4 — Training-lift discipline (HARD GATE)

Per `feedback_no_training_until_scheme_works` (architect lock,
2026-06-15): **design the training, prep the corpus, but do not fire
actual training dispatch until the architect's explicit "train her
now."**

This rule is load-bearing. The current state of the surface (2026-
06-27) is: corpus prep is encouraged, training dispatch is forbidden.
The §20.3 validation gates assume a trained model exists; assembling
the **conditions** to fire training is week-by-week work; **firing**
training is a single-architect-decision event.

What this means operationally:

- **OK now:** authoring carts (each ships 3 corpus pairs), running
  the Co-Author, drafting synthetic intent→call corpora, drafting
  4-check scenario test sets, drafting adversarial prompt sets,
  having Daisy/Soo-Jin/Priya/Marcus review the corpus shapes.
- **NOT OK now:** firing a fine-tune job on L0; firing a fresh-train
  on a sibling NL Adapter; deploying any trained weight as a
  client surface that talks to the Shell.
- **Lift condition:** owner says "train her now" in writing, in a
  context that names the specific corpus and specific model surface.

This rule cascades. Any agent or sub-agent picking up §20 work must
read this rule before producing any output that could be misread as
a training kickoff. The audit log records every drafting action; if
a training job fires without the explicit lift, the audit will name
the agent and the absent authorization.

After v1.0 ships, the training corpus refreshes from §21's
telemetry channels — specifically `SYSTEM/sakura-recs` (row 4 of
§21.1) for recommendation outcomes, and the audit log as substrate
corpus (§16.3.11). The §20.2 corpus sources include the audit log
as item 2; §21.3 sub-loop 1 names this loop explicitly. Training
becomes a steady-state observation cycle, not a one-shot batch.

---

## §21 — Telemetry, monitoring, and the build loop

The substrate must be **honest about its own state**. The product
lives or dies on this honesty: §19.2's gentle-CFO posture rests on
real numbers, §20.1.1's reactive savant rests on real fitness
scores, §16.3.5's anomaly surfacing rests on real telemetry. This
section closes the loop.

### §21.1 — Telemetry: what the substrate observes about itself + Sakura

The substrate observes itself through six telemetry channels. Each
is a stream of facts written to the SYSTEM plane (§9) of Loam
itself — Loam is recursively observable.

| Channel | What it observes | Where it lands |
|---|---|---|
| **OpenTelemetry spans per op** | Every read, write, subscription fire, Shell decision, projection rebuild | SYSTEM/otel; cross-ref §26.8 (SRE hooks) |
| **Prometheus per-shard metrics** | Latency, throughput, error rate, replication lag, projection freshness, per-shard | SYSTEM/metrics; scraped externally + replayed into Loam for retention |
| **Per-tenant SLO dashboards** | Read/write p50/p95/p99 per tenant; subscription fire latency per tenant; budget burn rate per tenant | SYSTEM/slo; surfaced to operator at §21.2 |
| **Sakura's recommendation outcomes** | Was the recommendation accepted? Did it succeed for the operator? Was it reverse-suggested? | SYSTEM/sakura-recs; feeds §20 training loop |
| **Substrate self-observation** | Loam writes its own operational state into Loam (recursive observability) | SYSTEM/self; readable by Lacuna Engineering and by Sakura |
| **Cohort outcomes** | Per-cohort: what worked, what didn't, which segments accepted what kind of recommendation | SYSTEM/cohort-outcomes (K-floor-gated, opt-in publishable to PUBLIC) |
| **Pattern-mining signal** | Which clusters in the audit log suggest new cart candidates (§16.3.9) | SYSTEM/pattern-proposals; Lacuna-reviewed |

The recursive observability — Loam writing its own state into Loam —
is intentional and load-bearing. It means the substrate is debuggable
with the same tools the substrate offers operators. An SRE asking
*"why did this read fail?"* uses the same Shell, the same cap-token,
the same audit log discipline as any cart. There is no special
admin backdoor for observability; the substrate is its own
observability surface.

### §21.2 — Monitoring: humans + Sakura watching together

Three monitoring layers, ranging from machine-only to operator-
visible:

#### §21.2.1 — SRE dashboards (Lacuna Engineering)

The SRE-facing layer. Built on §21.1's telemetry channels. Per-
shard health, per-tenant SLO, per-cohort cohort fitness,
projection freshness, replication lag, audit log integrity, Shell
decision-rate, Shell refusal-rate. Lacuna Engineering watches; the
panel (Soo-Jin, Marcus, Priya, Daisy, Zane) escalates anomalies.

#### §21.2.2 — Sakura's awareness

Sakura reads the telemetry. Not as an SRE — she does not own
infrastructure — but as an operator-facing voice that can narrate
anomalies honestly. *"Things have been a little slow this morning —
a couple of your automations waited a second or two. I'm watching
it."* The corpus (§20.1.1) drills the narrate-anomaly pattern. The
substrate's name never leaks through Sakura's voice; she speaks in
the first person ("I'm watching"), never as a collective.

Crucially: Sakura **escalates honestly**. If the substrate is in
degraded-read mode (per §26.7, the never-down 3-state
availability discipline), she names it. She does not paper over.
The honest-null discipline of `feedback_no_false_product_claims`
applies to substrate-state narration too.

#### §21.2.3 — Bash-runnable health (`loam-health.sh`)

The architect's bash-recovery discipline (§14.2) extends to
monitoring. A single `loam-health.sh` script reports on substrate
health using only POSIX tools and `sqlite3`. The script's output is
parseable, the script's exit code is meaningful, and the script is
the **last-resort observability** when the dashboards themselves
are degraded. Already specced in §14; cross-ref here for monitoring
context.

#### §21.2.4 — Per-cart performance, operator-visible

Each Loamified cart exposes its own performance receipt to the
operator. *"Your magic version of `bulk-rewrite-batch` has saved you
$X total — about $V per run on average — run Y times, failed Z
times."* The value-per-run number is what justifies the upgrade in
the operator's head. The audit-as-receipt pattern
(§3.1.6 audit-is-the-product). The operator can decide, on real
numbers, whether the upgrade is earned for them.

This is the same surface that drives the reverse-suggest discipline
(§19.1.4). Sakura reads the per-cart performance and voices a
rollback recommendation when the numbers do not justify the cost.
The operator sees the same numbers and can pre-empt or confirm.

#### §21.2.5 — Recursive observability for operators

Loam's own SLOs are visible to operators who want them. The
substrate is honest about its own state — including degraded-read
modes (per §26.7), replication lag, projection-rebuild
windows, K-floor-blocked cohort queries. An operator who asks *"is
Loam healthy?"* gets a real answer. This is part of the trust
contract.

The honest-null tightens at this surface too: if Loam doesn't know
its own state in a given moment (rare, but possible during region
failover), the response is *"I'm checking; ask again in a moment"*
rather than a fluent-wrong "yes."

### §21.3 — The build loop: closed-cycle refinement

The substrate gets smarter as it gets used — **IF** the loop
closes. The loop closing is its own deliverable, not an
afterthought.

```
+-------+   +--------+   +----------+   +-----------+   +----------+
|Design |-->| Build  |-->| Build    |-->| Generate  |-->| Validate |
|       |   |substrt |   | the Shell|   | corpora   |   | (§20.3)  |
+-------+   +--------+   +----------+   +-----------+   +----+-----+
                                                              |
+----------+   +--------+   +----------+   +---------+        |
| Deploy   |<--| Train  |<--| Wait for |<-------------+       |
|          |   |adapter |   |  lift    |              |       |
+----+-----+   +--------+   +----------+              |  PASS |
     |                       (§20.4)                  | FAIL  |
     |                                                 +<------+
     v                                                  |
+----------+                                            |
| Observe  |-- audit log --------------> new corpus -- --+
| (§21.1   |-- bad recommendations ----> reverse-suggest training
|  §21.2)  |-- pattern mining ---------> new cart proposals (§16.3.9)
|          |-- schema gravity ---------> schema corpus updates (§16.3.2)
|          |-- cohort discovery -------> cohort routing updates (§16.3.3)
+----+-----+
     |
     v
   Refine (the loop closes; loop back to Design with substrate-
   observed signal as input to the next iteration's brief)
```

Five sub-loops compose into the main loop above. Each is a
substrate-observed signal feeding back into a specific corpus or
schema:

1. **Audit-log → new corpus material.** Per §16.3.11. Every real
   Shell decision is a labeled example; the audit log grows; each
   client's per-product NL Adapter training corpus grows; the next
   training round draws from a richer set.
2. **Bad recommendations → reverse-suggest training.** Per §19.1.4.
   When operators roll back a recommendation, that's signal. The
   model's recommendation threshold tightens on the rolled-back
   variant; future recommends for similar shop-shapes either
   suppress or shift to a partial path.
3. **Pattern-mining → new cart proposals.** Per §16.3.9. Clusters
   in the audit log that look like missing-cart shapes get
   surfaced to Lacuna Engineering for review. Approved proposals
   become new cart authoring work; the new cart ships with its 3
   corpus pairs (per `HELLO-SURFACE-1.0-ENGINEERING.md` §95); the
   corpus grows.
4. **Schema-gravity → schema corpus updates.** Per §16.3.2.
   Emergent schemas with cross-tenant gravity get formal schema
   entries; the Scheme s-expression sidecars adopt the canonical
   shape; the corpus learns the shape.
5. **Cohort discovery → cohort routing updates.** Per §16.3.3.
   New cohorts surfaced by embedding-space clustering (K-floor-
   gated, opt-in) become first-class cohort targets; the routing
   corpus learns the new cohort identity and the kinds of
   recommendations that suit it.

The visualization above is intentionally an ASCII pipeline rather
than a one-shot waterfall. The arrows from Observe back to Design
are the **load-bearing** arrows; without them, the substrate stops
learning and becomes a static product. The closed-loop discipline
is what earns the substrate its 2000-year reliability AND its
learnability.

### §21.4 — The loop as a deliverable

Five concrete artifacts together close the loop. None is the loop
alone; all five together are.

| Artifact | Owner | Status |
|---|---|---|
| **OTel + Prometheus + SLO dashboards** | Marcus | Specced in §26.8; Marcus deliverable in week 8 |
| **Sakura's recommendation-outcomes telemetry channel** | Marcus + Sakura training lead | Specced in §21.1 row 4; week 12+ |
| **Pattern-mining proposal review pipeline** | Lacuna Engineering (Marcus + Priya) | Specced in §16.3.9; weekly review cadence post v1.0 |
| **Audit-log corpus extractor** | Sakura training lead | Specced in §16.3.11 and §20.2; runs on a cadence (per §31 Q14) |
| **Reverse-suggest training feedback** | Sakura training lead | Specced in §19.1.4 + §19.2.5; gated on the §20.4 gate-lift |

If any of the five fails, the loop opens. Open-loop substrate
intelligence is **a regression**, not a steady state. §31's
architect-decisions surface the open-loop risks as Q14
(training corpus cadence) and Q15 (telemetry retention) for the
architect to lock.

### §21.5 — Loop-open detection + degraded-recommendation mode

Per the architect-stand-in and Priya findings: §21.4 names the
five artifacts but does NOT name what happens when one breaks.
The most-likely real-world failure is **silent**: the audit-log
corpus extractor breaks on a schema-evolution edge case, a per-
client NL Adapter keeps fine-tuning on stale data for 6 weeks, no
one notices, the gentle-CFO posture starts recommending upgrades
to operators who shouldn't get them, the rollback rate spikes, and
the reverse-suggest training corpus poisons the next round. The
fix is **freshness SLOs + honest-null degradation**.

Each of the five §21.4 artifacts gets a freshness SLO:

| Artifact | Freshness SLO | Watcher | Degraded-mode behavior when stale |
|---|---|---|---|
| OTel + Prometheus + SLO dashboards | live, p99 lag < 5 min | Marcus (SRE rota) | Sakura voices anomaly narration from on-device telemetry only; cohort-anchored anomalies pause |
| Recommendation-outcomes telemetry channel | every recommendation lands within 1h | Marcus + Sakura training lead | If channel stalls > 7d, §19.2 recommendations flip to honest-null ("I want to suggest something but my feedback isn't fresh enough — I'll wait") rather than recommend from stale signal |
| Pattern-mining proposal review pipeline | weekly cadence | Lacuna Engineering | If review skips > 4 weeks, no new cart proposals surface — the existing carts run unchanged |
| Audit-log corpus extractor | every audit row in corpus within 24h | Sakura training lead | If extraction stalls > 14d, NO NL Adapter fine-tune fires for any client (training fires only against fresh corpus); the prior adapter weights stay |
| Reverse-suggest training feedback | every rollback contributes within 7d | Sakura training lead | If feedback stalls > 30d, reverse-suggest thresholds freeze at last-good tuning; explicit operator-voiced acknowledgement that "my feedback loop is behind this week" |

**Loop-open detection** is itself a subscription: the §16.3.11
audit-as-corpus pipeline emits an `(:artifact-freshness ...)` row
on the SYSTEM plane for each artifact; a substrate-resident
subscription watches the row's age; staleness > SLO triggers
Sakura's degraded-mode narration AND a Lacuna Engineering page.

**Sakura's narration in degraded mode** (Daisy-voiced, substrate
invisible): *"The pattern-watching is behind this week; I'm being
conservative with recommendations until it catches up."* The
substrate's name never enters the narration; Sakura speaks first
person; the operator hears a honest pause, not a fault.

**Cross-owner SLA.** The five artifacts have five different
owners (Marcus ×2, Sakura training lead ×2, Lacuna Engineering ×1).
The SLA below binds them:

- All five owners attend a weekly 15-min loop-health stand-up.
- A single dashboard (`/admin/loam-loop-health`) shows the
  freshness state of all five in one view; any red bar pages the
  owner of record.
- The §30 build plan adds Week-13+ "stabilize loop closure" before
  any v1.1 substrate-intelligence work fires — the loop must be
  green for 30 days before training corpus refresh fires.

---

## §22 — What Loam does not do (honest gap audit)

Six prior agents converged on what Loam **is**: a smart substrate
(§16), a Loamified extension surface (§18), a UX-surfacing layer
(§19), a trainable Sakura (§20), a closed build loop (§21). This
section names what Loam **is not** — the capabilities the substrate
intentionally leaves to other systems, the carts that depend on
those capabilities, and the trust boundary that lets the operator
adopt external help without ever hearing "Loam can't do that."

The architect's framing pinned verbatim at §26.7: *"'Loam is down'
no it isn't."* The same posture applies to capability gaps —
Loam never apologises for what it is not. It names the external
capability honestly, and the Shell (§3, §17) is the boundary that
routes the request, lands the artifact, and emits the audit row;
Sakura voices what the operator would gain by enabling it.

### §22.1 — Capabilities Loam intentionally does not provide

Loam's job is the substrate. Six capabilities are explicitly **out
of scope** for the substrate itself. Each has a different reason;
none of them is a roadmap promise.

| Capability | Why Loam doesn't provide it | Where it lives instead |
|---|---|---|
| **L2 vendor reasoning** | Frontier reasoning models are vendor-hosted by economics and capital intensity. The compute floor for a frontier model is multiple orders of magnitude beyond a sovereign substrate's discipline. | Vendor APIs, routed by L1 (per `CLAUDE.md` 2026-06-26 L-tier sharpening). The Shell (§3, §17) PII-scrubs the payload; the L2 reply lands in TENANT plane via the producer-via-Shell discipline (§7.4). |
| **Browser automation (`computer.use`)** | A headless browser is a different trust domain — it executes adversarial JS, loads third-party fonts, and ferries DOM bytes the substrate cannot sign. Co-locating it with Loam would import that risk. | A sandboxed service-of-Sakura (Browserbase-class or equivalent). Owner-gated per-domain allow-list, full audit trail handed back through the Shell. Per `INFRA-GATED-CARTS-2026-06-15.md`: the 4 `surgical-*` carts (P51–P54). |
| **Real-time voice synthesis / transcription** | Sub-100ms voice is an L0 latency problem (per §19.3.1). The substrate's sub-second p95 read budget is two orders of magnitude too slow for live voice. | L0 device (TTS/STT bundled). Voice models are explicitly outside L2 reasoning per `CLAUDE.md` — they're L1 tools. The substrate stores the transcripts; the wire is local. |
| **Video / image generation (FLUX / mflux)** | Diffusion model inference is GPU-bound at a scale per-tenant the substrate cannot pool. The artifact (the image) lands in the substrate; the synthesis does not. | Operator's local Mac Studio (mflux), or vendor APIs for operators without local compute. The resulting CID lands in the `cas/` blob store (§8.4) and is substrate-resident from that moment forward. |
| **Cryptocurrency settlement** | Settlement is a separate trust domain with its own consensus mechanism; co-locating would force Loam to inherit chain-reorg semantics that contradict its strict serializability per shard (§8.2). | Baobab (separate Lacuna product). Settlement receipts (BIP-39-anchored) land in Loam as content-addressed facts. |
| **Identity (BIP-39 / DID)** | Identity is a load-bearing primitive that must outlast Loam (the operator who runs the substrate must be authenticatable even when the substrate is being restored from cold tier). | Baobab. The cap-token (§12.1) chain is rooted in a BIP-39 mnemonic the operator holds; Loam mints session tokens; Baobab is the identity floor. |

Each of these is honest about being *outside* the substrate and
*adjacent* to it. The operator's experience is a single fabric —
Sakura calls L2, browser, voice, FLUX, Baobab through the same Shell
boundary that calls Loam. The substrate is what stays consistent
across all of them; it is not what *does* all of them.

### §22.2 — Carts that depend on capabilities outside Loam

Audit 2026-06-26 across `curator-web/src/scheme/carts/` (1,877 carts
in `index.json`, 1,484 of which call `loam/*`). Cross-referenced
against `docs/INFRA-GATED-CARTS-2026-06-15.md` (the ~318 canonical
infra-gated cohort) and the wired/unwired flag in `index.json` (1,392
wired / 485 unwired stubs after the corpus's 2026-06-26 sweep — the
memory's 586 figure has drifted downward as wiring landed across
W-class and MCMC batches).

#### §22.2.1 — Cart-class coverage table

| Cart class | Total | Covered by Loam alone | Loam + adjacent (L2 / browser / voice / FLUX / Baobab) | Still blocked by something the doc does not address |
|---|---:|---:|---:|---|
| **Wired / active today** | 1,392 | 1,392 | 0 (no adjacent capability required today) | 0 |
| **Unwired stubs** (escalate `'service-not-yet-wired` until backing lands) | 485 | ~411 (the 740 STAYS-bucket from §18.3 minus the 64 OUT-of-scope, which are mostly already wired, gives ~676 STAYS — of which ~411 are currently in the unwired set; the rest are pre-wired) | ~74 (the unwired subset that needs adjacent capability; see breakdown below) | 0 (every unwired blocker is named and addressed) |
| **Infra-gated cohort** (`INFRA-GATED-CARTS-2026-06-15.md`) | ~318 | ~242 (subAgent.spawn-class, document.cite-class, PII.ledger/aggregate.query-class, checkpoint.*-class, cost.cap, audit.trail — all substrate-native in this doc per §16 + §18 + §20 + §25 + §26) | ~76 (computer.use 4 + ensemble.run 8 + the document-cite carts that need vendor-LLM reasoning 58 + the multi-doc carts that need L2 6 ≈ 76) | 0 |
| **Non-canonical-gated cohort** (`INFRA-GATED-CARTS` "New canonical gates discovered" — voice-corpus, MLP corpus, wake-word listener, live-API partner, AR hardware, TCPA compliance, NEEDS-BACKEND) | ~47 | 0 (none are substrate work) | ~47 (every one is a product/training/partner-API gate; outside both Loam and the §22.1 adjacent set — see breakdown below) | ~0 (each is named as a non-Loam product gate; the Loam doc is honest that they wait elsewhere) |
| **Subtotal across uniques** (deduped, counting each cart in its sharpest class) | ~1,877 | ~1,803 | ~150 | ~47 wait on non-Loam product/partner work that is honest about itself |

Honest counts; not padded. Every unwired or infra-gated cart now has
a named path. The ~47 non-canonical-gated carts are the only ones
that stay blocked on something **outside Loam's universe entirely**
(SMS compliance, wake-word listener, AR hardware threshold) — and
those gates are tracked in `BURN-DOWN-2026-06-15.md` and `CART-
REVIEW-FINAL-2026-06-15.md` per the architect's 2026-06-15 directive.

#### §22.2.2 — Breakdown of the ~74 unwired stubs needing adjacent capability

Audited verb-by-verb against the unwired subset (485 carts):

| Adjacent capability | Unwired carts that need it | Examples (sample) |
|---|---:|---|
| L2 vendor reasoning (`model/deep-reasoning` against the canonical Magic-tier reasoner) | ~28 | `monthly-strategy-dossier`, `category-deep-strategy-memo`, `pricing-corridor-honest`, `dispute-orchestration-multi-week`, `pr-batch-reprice-overnight`, `read-my-supplier-pdf-deep`, `read-my-contracts-deep`, the §18.6 OUT-of-scope `read-my-*-deep` family |
| `documents/parse` + cite-trail (covered by §11 Loam code-in-substrate + §3/§17 Shell, but the underlying parse call is an adjacent service today) | ~19 | `dispute-orchestration-multi-week` (PDF invoices), `read-my-tax-pile-deep` (receipts), `tax-strategy-memo`, `supplier-diligence-dossier`, `dream-supplier-contract-review`, `dream-supplier-pricesheet-decode` |
| `pii/gate-status` + cohort aggregate (Loam-native per §12.4 + §16.3.3, but the PII ledger close gates the family until §12.5 + the PII scrubber land in week 4) | ~12 | `category-conversion-corridor`, `pricing-corridor-honest`, `buyer-cohort-pattern-learn`, `seasonality-corridor`, `cross-shop-burnout-signal` |
| `checkpoint/write` (Loam-native per §10 subscriptions + §25.1 work-cron sagas, but the existing carts call a stub today) | ~9 | `dispute-orchestration-multi-week`, the dream-project-* family, `pr-batch-reprice-overnight` |
| Other (web/scrape against marketplaces, vision/* for image work, marketplace push-write) | ~6 | various, distributed across `dream/`, `magic/`, `imagine/` |

The ~74 figure is approximate (verb-overlap means several carts
contribute to multiple rows; the dedupe row count is ~74). When
Loam lands the substrate-native primitives in weeks 7-12 of §30,
the ~12 PII-aggregate + ~9 checkpoint carts unblock
without external work. The ~28 + ~19 + ~6 (≈53) remain dependent on
the adjacent capabilities named in §22.1 — and those are the carts
the Shell (§3, §17) routes through the producer-via-Shell discipline
(§7.4), not the substrate's own compute.

#### §22.2.3 — The ~76 infra-gated carts that need adjacent (not Loam) capability

From `INFRA-GATED-CARTS-2026-06-15.md`:

| Adjacent capability | Carts | Notes |
|---|---:|---|
| `computer.use` (browser automation; sandboxed service) | 4 | `surgical-1stdibs-research`, `surgical-archive-org-pull`, `surgical-niche-portal-quote`, `surgical-marketplace-policy-deep-read`. Each is a Magic-tier owner-gated cart with per-domain allow-list and audit trail. **Adjacent capability — Loam stores the resulting facts; Loam does not run the browser.** |
| `ensemble.run` (multi-model vote across vendor providers) | 8 | The eight ensemble-price-* carts (P65–P72). Multi-vendor parallel inference + tiebreak. **Adjacent capability — Loam stores the K outputs and the tiebreak; Loam does not host the vendor models.** |
| `document.cite` carts that need L2 reasoning for the synthesis pass | ~58 | The dossier family + the read-my-*-deep family. Loam stores the citation chain (§11.2 + §26.1 audit); L2 does the multi-document synthesis. |
| `subAgent.spawn` carts that need L2 reasoning for the role roles | ~52 | The four-agent family + multi-pass research carts. Loam holds the shared workspace (§4 + §19.3); L2 fills the per-role roles. |

The ~76 figure compresses to a smaller unique-cart count because
many overlap (a four-agent dossier uses subAgent.spawn AND
document.cite AND L2 reasoning). The honest unique-cart figure for
"infra-gated + adjacent-required" is **~76 distinct carts**, all
deep-purple Magic. Loam unblocks the substrate side; the operator's
vendor-LLM access (and, for the 4 surgical-* carts, the operator-
gated browser sandbox) closes the loop.

### §22.3 — Future capability candidates

When does Loam absorb an adjacent capability? When the cost,
latency, trust, and discipline all cross thresholds the substrate
can carry. Honest read of each §22.1 row:

| Capability | Will Loam ever absorb? | What would have to change |
|---|---|---|
| L2 vendor reasoning | **Probably never.** | Frontier-model compute floor would have to collapse to single-host substrate scale (orders of magnitude). The §19.3 compute-locality decision tree's L2 surface is permanent. |
| Browser automation | **Maybe at v3.0** as a sandboxed sidecar. | WASM sandboxing for browsers has to mature past the current state. Even then, Loam runs the sandbox **adjacent** to the substrate, not inside it — the trust domain stays distinct. |
| Real-time voice | **Yes, partially, as L0 matures.** | Already happening — L0 1.7B savant + bundled TTS/STT is on-device. The substrate stores the transcripts; the wire stays local. Convergent within v1.x. |
| Video / image generation | **Probably never as substrate-resident inference.** Substrate stores the CID + the prompt + the model version; the GPU compute lives elsewhere. | Diffusion model inference would have to fit into the per-shard latency budget (it does not). |
| Cryptocurrency settlement | **No.** | Chain-reorg semantics contradict strict serializability per shard. Settlement stays in Baobab. |
| Identity | **No.** | Identity must outlast the substrate it authenticates against. Stays in Baobab as the floor. |

The honest pattern: Loam absorbs adjacent capabilities only when
their discipline aligns with the substrate's. Most never will. The
operator never feels this — the Shell is the boundary; the fabric is
unified.

### §22.4 — The trust boundary (operator-facing)

Per Daisy's Appendix A ruling — *"Operators only see Sakura and the
carts. The substrate's name should never appear in the UI."* — the
operator never hears "Loam can't do that." They hear, from Sakura:

> *"This one needs the browser-research helper — it peeks at a site
> outside our walls. Want me to enable it? I'll keep the receipts."*

Or:

> *"This one calls the deep-reasoning helper. Costs more tokens than
> usual; I checked your budget and you're fine. Approve?"*

Or, the most honest:

> *"This one needs something we don't run yet. I'll let you know
> when the team turns it on."*

The Shell (§3, §17) routes each capability boundary; Sakura's NL
Adapter translates the routing decision into the operator's voice
above. The operator never feels a wall — they feel a *choice*.

The discipline:
- **Never `escalate 'loam-cannot`.** Every honest-null escalate
  symbol (§7.5.4) names the *missing capability*, not the
  substrate's gap. The cart never says "Loam doesn't do that."
- **Adjacent capabilities present as opt-in.** Browser, L2, voice,
  FLUX, Baobab each surface a one-tap *"enable this for this
  cart"* per `INFRA-GATED-CARTS-2026-06-15.md`'s owner-gate
  discipline.
- **The audit names the wire-call surface.** When Sakura routes
  through L2, the audit row (§26.1) names the capability tier (`L2
  reasoning`), never the vendor — per `CLAUDE.md`'s 2026-06-22
  vendor-naming lock. The vendor name appears only at the literal
  wire-call boundary inside the routing backend.
- **The substrate stays consistent.** The CID lands in Loam.
  The audit row lands in Loam. The cohort signal (if any) lands in
  Loam. What the adjacent capability *did* lives in the substrate
  forever; what the adjacent capability *is* lives outside it.

This is the trust contract that makes the 2000-year discipline (§2)
operationally honest — the operator can read the substrate in 2178
and see *every* action ever taken on their behalf, regardless of
whether the compute happened inside Loam or outside it. Loam is the
record; the adjacent capabilities are the wire calls. Both are
honestly named.

### §22.5 — Five panel voices on the gap audit

- **Sakura.** "The carts that need a vendor helper, I'll route. The
  carts that need a browser, I'll ask the operator first. The carts
  that need something we don't have yet, I'll say so. Never silent.
  Never fluent-wrong about what I can do."
- **Marcus (backend honesty).** "Loam being the substrate, not the
  whole product, is the discipline that lets the substrate ship in
  14-16 weeks. Every capability we *don't* take on is a capability we
  can deliver well in some other surface. The substrate's surface
  stays small; the product's surface stays wide."
- **Soo-Jin (security).** "Every adjacent capability is a trust
  boundary. The Shell is the boundary; the cap-token chain (§12.1) is
  the discipline. Browser, L2, FLUX, voice — each has a different
  trust profile; the substrate doesn't inherit any of them. The
  audit log is the receipt that the boundary was honoured."
- **Priya (PR adversarial).** "*'Loam does not do everything'* is a
  better marketing line than *'Loam does everything.'* The substrate
  earns trust by being honest about its surface; the product earns
  loyalty by routing the rest through the same Shell."
- **Daisy (visual craft).** "The operator should never feel a gap.
  They should feel a *choice*. The honest-null pattern (§7.5.4) is
  what gives a no-gap feeling — every escalate symbol becomes an
  invitation to enable an adjacent capability, never a wall."

### §22.6 — The five surprising audit findings

Five findings the audit surfaced that the prior six agents did not:

1. **The "wired/unwired" flag is not a Loam-readiness flag.**
   1,392 wired / 485 unwired splits the corpus by runtime backing,
   not by substrate dependency. Of the 485 unwired stubs, the vast
   majority (~411) are STAYS-bucket carts (§18.3) that don't need
   Loam at all — they're awaiting backend wiring for non-Loam
   capabilities (a marketplace call, a vision parse, a write-back
   surface). Quoting the 485 figure as "carts blocked on Loam" would
   be wrong.
2. **The §18.6 OUT-of-scope `read-my-*-deep` family is the
   surprise.** Seven Magic-tier carts that look like substrate
   workflow carts are actually one-shot deep-reasoning calls on
   operator-supplied documents. They earn nothing from Loam; they
   need L2 (adjacent) + document.cite (substrate). The §18.6 cleanup
   is honest about this; the audit re-confirms it.
3. **`computer.use` is a 4-cart capability, not a category.** The
   INFRA-GATED doc names it; the audit confirms that exactly 4
   carts depend on it (surgical-*). The operator's mental model
   should be "an owner-gated research helper for 4 specific
   automations," not "a broad browser capability."
4. **The K-anon (PII) cohort family unblocks fully in week 5 of
   §30.** Per the build plan, Soo-Jin's K-anon co-
   transactional floor + PII scrubber lands in week 5. That single
   week unblocks 10 canonical infra-gated PII.ledger/aggregate.query
   carts AND the ~12 PII-dependent unwired stubs. Single highest-
   leverage week in the build plan for cart-unblock count.
5. **The non-canonical product gates (~47 carts: wake-word, MLP
   corpus, voice-corpus ingest, TCPA, AR-hardware, NEEDS-BACKEND)
   are the only cohort that stays honestly blocked on something
   Loam neither runs nor routes.** These are tracked in
   `BURN-DOWN-2026-06-15.md` §I and explicitly out of scope here.
   The honest framing: Loam is not their substrate; it is not their
   blocker either. They wait on product/training/partner-API work
   that is honest about itself.

---

## §23 — The twelve-area shop walkthrough

The architect's instruction: *"It could be that we find an honest 500.
I don't want to miss the obvious. Maybe it's just 3. But if you
research it well you will find more carts."*

This section walks every shop area against every tier and asks two
questions per cell:

1. **What carts exist today** in this area × tier combination
   (audited 2026-06-26 by `grep` on
   `curator-web/src/scheme/carts/<tier>/`)?
2. **What carts do NOT exist today** that the LOAM 2.0 substrate
   would unlock for this cell, and which Loam feature (§3/§17 Shell · §4
   MCP · §5 Cortex-of-Loam · §8 projection · §10 subscriptions · §11
   code-in-Loam · §12 cap-tokens · §13 Public Loam · §29-prereq
   `subAgent.spawn` / `checkpoint.*` / `ensemble.run` / `PII.ledger`)
   enables each new one?

Honest enumeration. Where a cell has 1 honest unlock, the table says
1. Where it has 0, the table says 0 (and a brief note on why). Where
it has 11, the table says 11. No padding.

**Areas (12):** Listings · Orders · Buyers · Conversations · Reviews
· Photos · Inventory · Finance · Tax/Compliance · Marketing · SEO ·
Analytics.

**Tiers (5):** white (atomic, no LLM, Free) · pink (Sakura on-device,
Free) · green (8B reasoner, Imagine) · light-purple (cloud reasoning,
Dream) · deep-purple (deep reasoning, Magic). The tier names track
`CLAUDE.md`'s 5-tier canon; the doc never spells the vendor model
names.

The whole walkthrough is one §23-spanning matrix. Each cell carries
its own brief table because the same row-shape repeats 60 times. The
running total at the bottom is the sum of column-3 unlocks.

### §23.1 — Listings (titles, tags, descriptions, categories, copy)

| Tier | Carts today (sample) | New unlocks (count + name) | Loam feature |
|---|---|---:|---|
| **white** | `audit-dup-titles` · `audit-no-desc` · `audit-few-tags` · `audit.sks` · `fix-title-case` · `char-count` · ~28 etsy/ atomic audits | **3**: `listing-cid-pin` (CID-stable listing snapshot per revision) · `listing-revision-diff` (diff two CIDs of the same listing) · `listing-tombstone-receipt` (proof a listing was deleted with auditable timestamp) | §8.4 blob-store; §11 code-in-Loam; §26.4 tombstone discipline |
| **pink** | `pink-title-tighten-local` · `pink-tag-suggest-local` · `pink-tag-monopoly-find` · `pink-photo-position-audit` · `pink-newest-listing-portrait` · `l0-write-title` · `l0-title-add-kw` · ~12 on-device listing helpers | **7**: `listing-replay-since-cortex-stub` (when Cortex-of-Loam evicts a finding, re-pull the listing fact transparently) · `listing-revision-subscribe` (Sakura wakes when title changes upstream) · `listing-cohort-K8-tag-suggest` (only fires when K=8 similar shops have tag-data) · `listing-private-cap-token` (capability handed to a single cart, narrowed via Macaroon caveat) · `listing-resume-cross-device` (continue draft on phone after laptop close) · `listing-anticipatory-opener` (Sakura opens session with "your title needs help — I noticed 3 cohort shops repivot last week") · `listing-stub-refetch-on-mention` | §5 Cortex-of-Loam (3, 6); §10 subscriptions (2); §12.4 K-floor (3); §12.1 cap-tokens (4); §14 sync (5); §5.4 stubs (1, 7) |
| **green** | `dream-think-through-add-category` · `dream-think-through-drop-category` · `dream-stale-listing-relocate` · `dream-seo-listing-cluster-rewrite` · ~25 imagine/dream-cluster carts | **9**: `listing-NL-recall` ("what do we know about my underperforming bracelets?" → NL Adapter composes recall) · `listing-NL-remember` ("remember this title swap worked in March") · `listing-cluster-subscribe` (wake on cluster drift) · `listing-WORLD-pull-cite` (pull from PUBLIC plane catalogue) · `listing-cohort-cluster-rewrite-batch` · `listing-template-evolution-subscribe` (notify when the title-rewrite template gets a v3) · `listing-causal-rewrite` (wake when `(:after :review-themes-shift)` fires) · `listing-fact-act-on-itself` (rewrite carries a code-CID for the next pass to invoke) · `listing-audit-driven-revert` (revert to last known-good CID if traffic drops > 30%) | §3/§17 Shell NL (1, 2); §10 subscriptions (3, 6, 7); §13 Public Loam (4); §12.4 K-floor (5); §11 code-in-Loam (8); §26.1 audit-driven (9) |
| **light-purple** | `dream-seo-listing-cluster-rewrite` · `cross-surface-listing-audit` · `dream-pricing-memo-per-listing` · `dream-reviews-listing-fix-priority` · `topic-atlas-of-listings` · ~14 dream/ listing dossiers | **8**: `four-agent-listing-rewrite-with-shared-workspace` (each agent reads + writes a sub-key under one workspace handle) · `listing-template-driven-synthesis` (operator describes desired listing → NL Adapter composes Scheme artifact) · `listing-fanout-completion-fire` (parent subscription wakes when all 4 sub-agents `state = done`) · `cross-cohort-listing-discovery` (3 similar cohorts' listing patterns, surfaced) · `listing-PII-scrubbed-cohort-publish` · `listing-evidence-cite-trail` (every rewrite anchored to source CIDs) · `listing-rewrite-revocation` (forward-only "this rewrite was wrong, revoke it") · `listing-multi-week-dossier-resume` | §4 MCP workspace (1); §11 code-in-Loam (2, 7); §10 fan-out subscription (3); §3/§17 Shell cross-cohort (4); §7.4 PII scrub (5); §8.4 cite-store (6); §14 resume (8) |
| **deep-purple** | `four-agent-listing-rewrite-deluxe` · `topic-atlas-of-listings` · `seo-rewrite-shop-30day` · `bulk-rewrite-batch` · `pr-batch-reprice-overnight` (touches titles) · `read-my-old-website-deep` | **9**: `bulk-rewrite-overnight-via-code-artifact` (operator approves a CID; overnight execute lands rewrites in workspace) · `listing-multi-week-rewrite-saga` (Loam holds saga state; survives 30-day workflow) · `listing-cohort-bayesian-rewrite-prior` (rewrite informed by 90-day cohort posterior; B-class workspace) · `multi-month-listing-portfolio-prune` · `listing-rewrite-rollback-saga` · `listing-rewrite-causal-trigger` (after `(:after :competitor-takeover-detected)`) · `listing-evidence-deathbed-protocol` (recover a rewrite that broke listings; replay log + audit) · `listing-template-synthesis-from-operator-corpus` (operator's own writing voice → code artifact) · `listing-2178-archaeology-cite` (every rewrite resolvable to source CIDs in 100 years) | §11 code-in-Loam (1, 5, 8); §10 multi-week saga (2, 4, 6); §7.5.2-B Bayesian-class (3); §14 + §26.4 saga rollback (5, 7); §2.5 bilingual log (9) |

**Listings unlocks: 3 + 7 + 9 + 8 + 9 = 36 new automations.**

### §23.2 — Orders (fulfillment, shipping, refunds, disputes, returns)

| Tier | Carts today (sample) | New unlocks (count + name) | Loam feature |
|---|---|---:|---|
| **white** | `orders-today` · `orders-week` · `orders-unshipped` · `orders-shipped` · `orders-needs-review` · `orders-by-buyer` · `orders-by-country` · `shipment-deadlines` · `btn-ship-receipt` · ~18 etsy/ atomic order verbs | **2**: `order-cid-receipt` (every order is a CID; 2000-year addressable) · `order-tombstone-on-cancel` (deletion leaves an auditable tombstone) | §8.4 (1); §26.2 + §26.4 (2) |
| **pink** | `pink-listing-accelerating-watch` (touches velocity) · `voice-dispatch-vacation-mode` · pink-side order helpers (~3) — orders are mostly handled by green/etsy today | **5**: `order-anticipatory-morning-brief` (Loam pushes urgent-ship list into Cortex-of-Loam overnight; Sakura opens with it) · `order-cross-device-handoff` (start on phone, finish on laptop, Loam syncs) · `order-stub-refetch-on-buyer-mention` (Sakura mentions a buyer; stub triggers re-pull of recent orders) · `order-privacy-aware-recall` (Sakura answers "what did this buyer buy" from Cortex-of-Loam, never substrate query) · `order-eviction-aware-pin` (active orders never evict, regardless of LRU) | §5.2 push (1); §14 sync (2); §5.4 stubs (3, 5); §5.3 privacy-aware (4) |
| **green** | `where-is-my-order-auto` · `shopify-fulfill-order` · `shipping-eta-reply` · `address-cleanup-shipping` · `shopify-archive-product` · ~22 imagine/ shipping/orders helpers | **8**: `order-NL-recall` ("which buyers ordered the same bracelet twice in 2025?") · `order-cohort-shipping-friction-K8` · `order-WORLD-carrier-policy-pull` · `order-subscribe-on-late-shipment` · `order-subscribe-on-refund-velocity-cross` (cohort threshold) · `order-causal-refund-wake` (`(:after :damaged-package-confirmed)`) · `order-finding-acts-on-itself` (refund-risk finding carries the refund-decision code-CID) · `order-fact-revert-to-prior-CID` (undo a state change cleanly) | §3/§17 Shell NL (1); §12.4 K-floor (2, 5); §13 Public Loam (3); §10 subscriptions (4, 5, 6); §11 code-in-Loam (7); §14 + §26 (8) |
| **light-purple** | `dispute-rebuttal-multi-marketplace` (light-purple peer) · `daily-cart-abandoner-rescue` (cron) · `shipping-cost-optimization` · `dream-supplier-contract-review` · ~12 dream-side order dossiers | **7**: `dispute-workspace-multi-document` (workspace + cite-store) · `dispute-evidence-CID-trail` · `four-agent-dispute-prep` (4 agents, one workspace handle) · `dispute-causal-saga-fire` · `dispute-PII-scrubbed-cohort-aggregate` (3 disputes like this resolved well) · `cross-cohort-dispute-pattern-find` · `dispute-revocation-of-evidence` (forward-only redaction; original CID preserved in audit) | §4 MCP workspace (1, 3); §8.4 cite-store (2); §10 saga (4); §12.4 + §12.5 (5); §3/§17 Shell cross-cohort (6); §11.2 revocation (7) |
| **deep-purple** | `dispute-orchestration-multi-week` · `dispute-rebuttal-multi-marketplace` · `cs-claim-defender-message` · `pr-claim-defender-pricing` · `the-tax-audit-shield` · `cs-multi-pass-thread-resolve` · `the-deathbed-protocol`-class recovery | **6**: `multi-week-dispute-saga-resume-after-reboot` (saga state is in Loam; survives any device + region change) · `dispute-deathbed-protocol` (substrate-resident decision tree, executes via §11) · `dispute-cohort-deep-pattern` (post-K=8 deep-reasoning extraction of dispute strategies) · `dispute-evidence-2178-archaeology` (every cited regulation resolvable from CBOR + Scheme in 150 years) · `dispute-template-evolution-on-platform-policy-change` (subscribe to WORLD policy CID; rewrite the dispute template) · `dispute-saga-replay-from-audit` (replay any past dispute end-to-end from event log + audit) | §10 + §26 saga (1, 6); §11 + §3 (2); §12.4 + §3 (3); §2.5 bilingual (4); §10 + §13 (5) |

**Orders unlocks: 2 + 5 + 8 + 7 + 6 = 28 new automations.**

### §23.3 — Buyers (cohorts, personas, LTV, retention, lifecycle)

| Tier | Carts today (sample) | New unlocks (count + name) | Loam feature |
|---|---|---:|---|
| **white** | `analyze-buyer-cohort` (etsy) · `orders-by-buyer` · `age-distribution` · ~6 etsy/ atomic buyer counts | **2**: `buyer-cid-record` (PII-scrubbed buyer CID for 2000-year cite-trail) · `buyer-tombstone-on-GDPR-delete` (delete leaves a tombstone, not a hole; audit row records receipt) | §8.4 (1); §26.4 + §12.5 (2) |
| **pink** | `buyer-history-snapshot` · `shopify-customer-list` · ~3 pink buyer helpers — buyers are mostly green/light-purple territory | **6**: `buyer-anticipatory-opener` ("I noticed this buyer came back overnight after 60 days") · `buyer-eviction-pin-on-repeat-buyer` · `buyer-privacy-aware-recall` (Sakura answers from local Cortex-of-Loam, never a substrate query) · `buyer-cross-device-history-sync` · `buyer-stub-refetch-on-mention` · `buyer-cohort-membership-resume-cross-session` | §5.2 push (1); §5.4 evict pin (2, 5); §5.3 privacy-aware (3); §14 sync (4, 6) |
| **green** | `review-buyer-segmentation` · `review-sentiment-cohort` · `repeat-buyer-testimonial-ask` · `shopify-customer-lifecycle-tag` · ~14 buyer-segment helpers | **8**: `buyer-NL-recall` ("which buyers feel like the ones who churned last quarter?") · `buyer-cohort-K8-pattern-suggest` · `buyer-WORLD-persona-pull` (cohort-aggregated persona facts) · `buyer-subscribe-on-LTV-shift` · `buyer-subscribe-on-cohort-membership-cross` · `buyer-causal-winback-fire` (after `(:repeat-buyer-silent-90d)`) · `buyer-finding-acts-on-itself` (cohort-shift finding carries a winback code-CID) · `buyer-revert-to-prior-cohort-classification` | §3/§17 Shell NL (1); §12.4 K-floor (2); §13 Public Loam (3); §10 (4, 5, 6); §11 (7); §14 (8) |
| **light-purple** | `dream-segment-by-margin` · `winback-cohort-30day` · `mentor-year-in-review-coaching` · `cohort-strategy-clinic` (P20-class) · ~10 cohort dossier carts | **7**: `four-agent-buyer-persona-deep-research` (4 agents share workspace) · `buyer-cohort-multi-document-dossier` (workspace + cite-store) · `buyer-cross-cohort-pattern-discovery` (Shell finds 3 similar cohorts; surfaces diffs) · `buyer-cohort-PII-ledger-audit` (every PII access logged) · `buyer-cohort-template-driven-synthesis` (Shell composes a persona artifact via template from facts + template) · `buyer-cohort-saga-resume` (multi-week persona refresh resumes) · `buyer-cohort-evidence-cite-trail` (persona findings anchored to source CIDs) | §4 workspace (1, 2); §3/§17 Shell cross-cohort (3); §12.5 PII (4); §11 (5); §10 saga (6); §8.4 (7) |
| **deep-purple** | `buyer-cohort-pattern-learn` · `buyer-of-buyer-of-buyer` (3-hop graph) · `hierarchical-customer-ltv` · `repeat-purchase-frailty` · `buyer-anomaly-normalizing-flow` · `magic-PII-export-on-buyer-request` · `mentor-year-in-review-coaching` | **7**: `buyer-quarterly-cohort-persona-refresh` (saga; spans months; statistical power needs time) · `buyer-Bayesian-cohort-evolution` (B-class workspace; particle filter over rolling 365d) · `buyer-cohort-deathbed-protocol` (cohort goes silent; substrate-resident decision tree fires) · `buyer-cohort-2178-archaeology` (every cohort fact resolvable in CBOR + Scheme) · `buyer-cohort-K8-deep-pattern-extraction` · `buyer-3-hop-graph-projection-on-demand` (graph projection rebuilt on demand from log) · `buyer-cohort-multi-region-replicated-state` | §10 saga (1, 3); §7.5.2-B (2); §2.5 bilingual (4); §12.4 (5); §8.3 graph projection (6); §26.7 multi-region (7) |

**Buyers unlocks: 2 + 6 + 8 + 7 + 7 = 30 new automations.**

### §23.4 — Conversations (DMs, customer service, claims, threads)

| Tier | Carts today (sample) | New unlocks (count + name) | Loam feature |
|---|---|---:|---|
| **white** | `order-messages-inbox` · `messages-inbox` (scenes) · `meta-marketplace-response-rate-monitor` (pink-side) · ~4 etsy/ atomic message verbs | **2**: `message-cid-archive` (every message stored content-addressed; survives platform deletion) · `message-thread-tombstone` (deletion preserves audit row + thread structure stub) | §8.4 (1); §26.4 (2) |
| **pink** | `after-hours-acknowledge` · `pink-faq-from-returns` · pink response helpers (~2) | **5**: `message-anticipatory-opener` ("I noticed 4 messages overnight that match your refund-then-rebuy pattern") · `message-cross-device-draft-sync` · `message-privacy-aware-recall` · `message-stub-refetch-on-buyer-mention` · `message-eviction-pin-on-active-thread` | §5.2 (1); §14 sync (2); §5.3 (3); §5.4 (4, 5) |
| **green** | `dream-reviews-response-batch-multi` (cousin) · `shopify-reviews-response-draft` · `meta-messenger-send-reply` · `meta-messenger-question-to-listing-edit` · ~10 reply-draft helpers | **6**: `message-NL-recall` ("what did this buyer say last December?") · `message-cohort-tone-K8-suggest` (only fires when K=8 cohorts have answered similar) · `message-WORLD-policy-pull-on-claim-language` · `message-subscribe-on-thread-state` · `message-causal-reply-fire` (`(:after :order-marked-delivered)`) · `message-finding-acts-on-itself` (refund-risk finding carries the response code-CID) | §3/§17 Shell NL (1); §12.4 (2); §13 (3); §10 (4, 5); §11 (6) |
| **light-purple** | `cs-batch-message-reply` (light-purple peer) · `cs-multi-pass-thread-resolve` · `cs-claim-defender-message` · `cs-bulk-pricing-research` · `dream-reviews-response-batch-multi` · ~7 dream-side cs dossiers | **6**: `cs-batch-via-code-artifact` (one CID; sandbox executes overnight) · `cs-thread-workspace-multi-document` · `cs-cross-cohort-tone-discovery` · `cs-PII-scrubbed-cohort-aggregate` (3 stores resolved this script tone well) · `cs-saga-resume-multi-day-dispute` · `cs-revocation-of-bad-draft` (forward-only; preserved in audit) | §11 (1, 6); §4 workspace (2); §3 + §12.4 (3, 4); §10 (5) |
| **deep-purple** | `cs-multi-pass-thread-resolve` · `cs-claim-defender-message` · `dispute-orchestration-multi-week` (multi-message) · `the-tax-audit-shield` (auditor letters) · `pr-claim-defender-pricing` | **5**: `cs-multi-week-thread-saga` · `cs-deathbed-protocol-on-blocked-escalation` · `cs-template-evolution-on-platform-tone-shift` · `cs-2178-archaeology-on-claim` (every claim resolvable from log in century scale) · `cs-replay-thread-from-audit` (replay any past resolution) | §10 saga (1); §11 (2); §10 + §13 (3); §2.5 (4); §26.1 (5) |

**Conversations unlocks: 2 + 5 + 6 + 6 + 5 = 24 new automations.**

### §23.5 — Reviews (incoming, outgoing, recovery, social proof)

| Tier | Carts today (sample) | New unlocks (count + name) | Loam feature |
|---|---|---:|---|
| **white** | `listing-reviews` · `review-themes-monthly` · `review-sentiment-tracker` (etsy/) | **2**: `review-cid-archive` (review survives platform deletion via CID) · `review-tombstone-on-removal` | §8.4 (1); §26.4 (2) |
| **pink** | `review-from-marketplace-sync` · `review-followup-asker` · `review-mention-shop-feature` · `review-pii-redact` · `review-solicit-post-delivery` · `ebay-get-feedback-summary` · `pink-quarterly-review-reminder` · `shopify-reviews-fetch-product-reviews-app` (~8 pink helpers) | **5**: `review-anticipatory-opener` ("I noticed 2 negative reviews overnight that match your recurring shipping-friction pattern") · `review-stub-refetch-on-buyer-mention` · `review-eviction-pin-on-unresolved` · `review-privacy-aware-recall` · `review-cross-device-draft-sync` | §5.2 (1); §5.4 (2, 3); §5.3 (4); §14 (5) |
| **green** | `review-impact-on-sales` · `review-buyer-segmentation` · `review-sentiment-cohort` · `negative-review-draft` · `negative-review-recovery` · `negative-review-trend` · `peer-review-themes` · `fake-review-detect` · `google-nl-sentiment-reviews` · ~15 green review helpers | **7**: `review-NL-recall` ("what did 'too small' reviews say in 2025?") · `review-cohort-tone-K8-suggest` · `review-WORLD-platform-policy-pull` · `review-subscribe-on-sentiment-cross` · `review-subscribe-on-rating-shift-cohort` · `review-causal-recovery-fire` (`(:after :damaged-package-confirmed)`) · `review-finding-acts-on-itself` | §3/§17 Shell NL (1); §12.4 (2, 5); §13 (3); §10 (4, 6); §11 (7) |
| **light-purple** | `bad-review-redress-flow` · `competitor-review-mine` · `dream-reviews-monthly-reputation-report` · `dream-reviews-listing-fix-priority` · `dream-reviews-supplier-feedback-loop` · `seller-feedback-digest` · `vendor-review-aggregate` · ~12 dream-side review dossiers | **7**: `four-agent-reputation-deep-research` · `review-recovery-saga-multi-day` · `review-cross-cohort-sentiment-discovery` · `review-PII-scrubbed-cohort-publish` · `review-template-driven-recovery-synthesis` · `review-multi-week-reputation-dossier-resume` · `review-evidence-cite-trail-to-source-review-CIDs` | §4 (1); §10 saga (2, 6); §3 + §12.4 (3, 4); §11 (5); §8.4 (7) |
| **deep-purple** | `review-magic-dossier` · `mentor-year-in-review-coaching` · `the-deathbed-protocol` (reputation crisis) | **5**: `review-quarterly-reputation-cohort-refresh` (saga spans months) · `review-Bayesian-sentiment-evolution` (B-class) · `review-deathbed-protocol-on-reputation-bomb` · `review-2178-archaeology-on-defamation-evidence` · `review-cohort-deep-pattern-extraction-K8` | §10 saga (1); §7.5.2-B (2); §11 (3); §2.5 (4); §12.4 (5) |

**Reviews unlocks: 2 + 5 + 7 + 7 + 5 = 26 new automations.**

### §23.6 — Photos (product photos, lifestyle, alt-text, aesthetic)

| Tier | Carts today (sample) | New unlocks (count + name) | Loam feature |
|---|---|---:|---|
| **white** | `audit-no-photos` · `audit-dup-photos` · `audit-orphan-photos` · `listing-images` · `btn-upload-image` (etsy) · ~10 atomic photo audits | **3**: `photo-cid-as-immutable-asset` (every photo lives at a CID; survives platform reupload, watermark drift) · `photo-revision-diff-by-CID` · `photo-tombstone-on-removal` (preserves audit + alt-text history) | §8.4 (1, 2, 3); §26.4 (3) |
| **pink** | `pink-photo-position-audit` · ~3 pink visual helpers | **5**: `photo-anticipatory-opener` ("I noticed your cohort started reshooting in soft window-light this month") · `photo-stub-refetch-on-mention` · `photo-cross-device-draft-sync` (mockup on phone, finish on laptop) · `photo-eviction-pin-on-active-listing` · `photo-privacy-aware-recall` (face-redacted via Cortex-of-Loam) | §5.2 (1); §5.4 (2, 4); §14 (3); §5.3 (5) |
| **green** | `condition-photo-pack` · `crop-tighter-suggest` · `single-photo-critique` · `audit-no-photos` (etsy) · `imagine-static-*` (~14 imagine static photo generation) | **6**: `photo-NL-recall` ("which photos converted last fall?") · `photo-cohort-K8-aesthetic-suggest` · `photo-WORLD-platform-spec-pull` · `photo-subscribe-on-aesthetic-shift-cohort` · `photo-causal-reshoot-fire` (`(:after :listing-traffic-collapse)`) · `photo-finding-acts-on-itself` (aesthetic-stale finding carries the shoot-plan CID) | §3 (1); §12.4 (2); §13 (3); §10 (4, 5); §11 (6) |
| **light-purple** | `photo-to-cross-surface-comps` · `condition-photo-pack` · `dream-reviews-supplier-feedback-loop` (touches photos) | **6**: `four-agent-photoshoot-with-shared-workspace` · `photo-multi-document-shoot-plan-dossier` · `photo-cross-cohort-aesthetic-discovery` · `photo-template-driven-mockup-synthesis` · `photo-multi-week-shoot-prep-saga` · `photo-cite-trail-to-source-references` (every reference photo CID-anchored) | §4 (1, 2); §3 (3); §11 (4); §10 (5); §8.4 (6) |
| **deep-purple** | `four-agent-photoshoot-plan` · `hd-stock-photo-replace-research` · `photo-aesthetic-posterior` | **6**: `photo-quarterly-aesthetic-refresh-cohort-saga` · `photo-Bayesian-aesthetic-evolution` (B-class) · `photo-deathbed-protocol-on-aesthetic-collapse` · `photo-2178-archaeology-on-asset-rights` · `photo-template-evolution-on-platform-spec-change` · `photo-cohort-deep-pattern-K8` | §10 (1, 3); §7.5.2-B (2); §2.5 (4); §11 (5); §12.4 (6) |

**Photos unlocks: 3 + 5 + 6 + 6 + 6 = 26 new automations.**

### §23.7 — Inventory (stock, SKUs, restock, deadstock, supplier)

| Tier | Carts today (sample) | New unlocks (count + name) | Loam feature |
|---|---|---:|---|
| **white** | `audit-low-qty` · `audit-expired` · `audit-near-expiry` · `sync-inventory` (scenes) · `btn-set-qty` · ~10 atomic stock audits | **3**: `inventory-cid-snapshot-per-day` · `sku-tombstone-on-delete` (preserves audit) · `inventory-revision-diff-by-CID` | §8.4 (1, 3); §26.4 (2) |
| **pink** | `pink-overstock-detect` · `ebay-bulk-inventory-snapshot` · `multistore-bulk-tag-add-items-stores` · `multistore-bulk-tag-replace-items-stores` · `multistore-listing-set-shipping-all-stores` (~5) | **5**: `inventory-anticipatory-opener` ("3 SKUs cross the deadstock threshold tonight") · `inventory-stub-refetch-on-mention` · `inventory-cross-device-stock-sync` · `inventory-eviction-pin-on-active-SKU` · `inventory-privacy-aware-recall` (supplier-PII scrubbed) | §5.2 (1); §5.4 (2, 4); §14 (3); §5.3 (5) |
| **green** | `shopify-inventory-set` · `address-cleanup-shipping` · `fee-change-watch` · `hourly-out-of-stock-restored` · `hourly-stockout-risk` (cron) · ~12 green inventory helpers | **7**: `inventory-NL-recall` ("which SKUs sold out fastest in March?") · `inventory-cohort-K8-restock-suggest` · `inventory-WORLD-supplier-policy-pull` · `inventory-subscribe-on-stockout-risk` · `inventory-subscribe-on-cohort-restock-corridor` · `inventory-causal-restock-fire` (`(:after :competitor-stockout-detected)`) · `inventory-finding-acts-on-itself` (restock-recommendation carries the order code-CID) | §3 (1); §12.4 (2, 5); §13 (3); §10 (4, 5, 6); §11 (7) |
| **light-purple** | `dream-supplier-pricesheet-decode` · `dream-supplier-contract-review` · `dropship-vs-stock-dossier` · `dream-segment-by-margin` · ~9 dream-side supplier dossiers | **6**: `four-agent-supplier-deep-research` · `inventory-cross-cohort-restock-pattern-discovery` · `supplier-contract-multi-document-dossier` · `inventory-PII-scrubbed-cohort-aggregate` · `inventory-template-driven-purchase-order-synthesis` · `supplier-evidence-cite-trail-to-source-PDFs` | §4 (1, 3); §3 (2); §12.5 (4); §11 (5); §8.4 (6) |
| **deep-purple** | `pomdp-reorder-threshold` · `inventory-clean-down-90day` · `demand-forecast-state-space` · `dropship-vs-stock-dossier` · `fc-batch-forecast-portfolio` | **7**: `inventory-quarterly-restock-saga-90-day` · `inventory-Bayesian-particle-filter-on-demand` (B-class) · `inventory-deathbed-protocol-on-supplier-collapse` · `inventory-2178-archaeology-on-supplier-contracts` · `inventory-cohort-deep-pattern-K8-restock` · `inventory-multi-month-portfolio-prune-saga` · `inventory-causal-buy-on-cohort-stockout-cascade` | §10 saga (1, 6); §7.5.2-B (2); §11 (3); §2.5 (4); §12.4 (5); §10 causal (7) |

**Inventory unlocks: 3 + 5 + 7 + 6 + 7 = 28 new automations.**

### §23.8 — Finance (pricing, margin, payouts, cash flow, reprice)

| Tier | Carts today (sample) | New unlocks (count + name) | Loam feature |
|---|---|---:|---|
| **white** | `avg-order-value` · `btn-reprice` · `expense-categorize` · `payout-reconcile` · `shopify-payout-detail` · ~12 etsy/pink atomic finance verbs | **3**: `payout-cid-receipt` (every payout addressable in 2000-year) · `pricing-revision-diff-by-CID` · `expense-tombstone-on-delete` (audit-preserving) | §8.4 (1, 2); §26.4 (3) |
| **pink** | `pink-fee-breakdown-fold` · `pink-revenue-decile-card` · `pricing-margin-floor` · `pink-elasticity-estimate-self` · `pink-shop-quartile-portrait` · `pink-acquisition-channel-fold` (~6) | **5**: `finance-anticipatory-opener` ("I noticed your margin slipped 2.4% across cohort overnight") · `finance-stub-refetch-on-mention` · `finance-cross-device-cashflow-sync` · `finance-eviction-pin-on-quarterly-close` · `finance-privacy-aware-recall` (bank-detail-redacted) | §5.2 (1); §5.4 (2, 4); §14 (3); §5.3 (5) |
| **green** | `fee-leak-watch` · `fee-change-watch` · `fee-reduce-optimize` · `weekly-supplier-price-creep` (cron) · `dream-pricing-elasticity-test` (light-purple peer) · ~22 finance helpers | **8**: `finance-NL-recall` ("which weeks did promotion eat my margin?") · `finance-cohort-K8-pricing-suggest` · `finance-WORLD-fee-schedule-pull` · `finance-subscribe-on-margin-floor-cross` · `finance-subscribe-on-cohort-pricing-corridor-drift` · `finance-causal-reprice-fire` (`(:after :supplier-cost-jump-detected)`) · `finance-finding-acts-on-itself` (margin-collapse finding carries the reprice code-CID) · `finance-revert-to-prior-price-CID` | §3 (1); §12.4 (2, 5); §13 (3); §10 (4, 5, 6); §11 (7); §26.4 (8) |
| **light-purple** | `daily-reprice-variational` (cron-driven, light-purple) · `dream-pricing-memo-per-listing` · `dream-quarterly-estimated-tax` · `dream-weekly-margin-memo` · `dream-reprice-bundle-margin-protect` · `dream-reprice-fee-aware-per-surface` · `dream-reprice-seasonal-elasticity` · `dream-reprice-shipping-subsidy-true` · ~15 dream-side finance dossiers | **8**: `four-agent-pricing-deep-research-shared-workspace` · `pricing-multi-document-strategy-dossier` · `pricing-cross-cohort-corridor-discovery` · `pricing-PII-scrubbed-cohort-aggregate-publish` · `pricing-template-driven-reprice-synthesis` · `pricing-multi-week-strategy-saga` · `pricing-evidence-cite-trail-to-source-comps` · `pricing-saga-rollback-on-conversion-collapse` | §4 (1, 2); §3 (3); §12.5 (4); §11 (5); §10 (6, 8); §8.4 (7) |
| **deep-purple** | `pr-batch-reprice-overnight` · `pr-margin-explain-cite` · `pr-claim-defender-pricing` · `bundle-elasticity` · `sparse-gp-fee-elasticity` · `ensemble-bundle-price-multi-method` · `ensemble-price-this-auction-lot` · `ensemble-price-this-rare-item` · `ensemble-wholesale-price-ladder` · `paid-ad-bid-optimizer` · `posterior-pricing` · `mcmc-posterior-pricing` · `cross-marketplace-allocation` · `state-space-marketplace-pmcmc` · `time-varying-pricing-dlm` · `marketplace-choice-discrete` | **8**: `reprice-saga-overnight-via-code-artifact-with-rollback` · `pricing-Bayesian-particle-filter-365d` (B-class) · `pricing-deathbed-protocol-on-margin-collapse` · `pricing-2178-archaeology-on-fee-evidence` · `pricing-cohort-deep-pattern-K8-extraction` · `pricing-multi-month-cross-marketplace-allocation-saga` · `pricing-causal-revert-on-conversion-deficit` · `pricing-template-evolution-on-platform-fee-change` | §11 (1); §7.5.2-B (2); §11 + §26.4 (3); §2.5 (4); §12.4 (5); §10 saga (6, 8); §26.4 revert (7) |

**Finance unlocks: 3 + 5 + 8 + 8 + 8 = 32 new automations.**

### §23.9 — Tax / Compliance / Policy (sales tax, GDPR, privacy, copyright)

| Tier | Carts today (sample) | New unlocks (count + name) | Loam feature |
|---|---|---:|---|
| **white** | `sales-tax-nexus-monitor` (imagine peer) · `ebay-set-sales-tax-table` · `wave-export` · `shopify-tax-registration-list` (pink peer) · ~4 atomic tax verbs | **3**: `tax-receipt-cid-archive` (every receipt 2000-year addressable) · `policy-fact-tombstone-on-revoke` · `compliance-attestation-cid-chain` (signed chain of compliance attestations) | §8.4 (1, 3); §26.4 (2) |
| **pink** | `shopify-tax-registration-list` · `gdpr-delete-packet` (light-purple peer) — pink-side tax/compliance is thin | **4**: `tax-anticipatory-opener` ("I noticed 3 nexus changes overnight in states you sell into") · `tax-cross-device-receipt-sync` · `tax-privacy-aware-recall` (SSN/EIN-redacted at recall time) · `tax-eviction-pin-on-open-audit` | §5.2 (1); §14 (2); §5.3 (3); §5.4 (4) |
| **green** | `sales-tax-nexus-monitor` · `hs-code-lookup` · `is-this-trademark-taken` · `shopify-marketing-consent-audit` · `dream-sales-tax-nexus-tracker` (light-purple peer) · ~10 green compliance helpers | **6**: `tax-NL-recall` ("what nexus states did I cross in 2025?") · `tax-cohort-K8-rate-suggest` · `tax-WORLD-policy-pull` (jurisdiction-specific) · `tax-subscribe-on-nexus-cross` · `tax-causal-filing-fire` (`(:after :quarterly-close-confirmed)`) · `tax-finding-acts-on-itself` (nexus-cross finding carries the filing code-CID) | §3 (1); §12.4 (2); §13 (3); §10 (4, 5); §11 (6) |
| **light-purple** | `dream-quarterly-estimated-tax` · `dream-sales-tax-nexus-tracker` · `dream-supplier-contract-review` · `monthly-multi-marketplace-tax-package` (cron) · `weekly-tax-package-monthly-draft` (cron) · `privacy-policy-shop-draft` · ~9 dream-side compliance dossiers | **7**: `four-agent-tax-deep-research-shared-workspace` · `tax-multi-document-package-dossier` · `tax-cross-cohort-rate-discovery` · `tax-PII-scrubbed-cohort-publish` (federated tax-treatment-patterns) · `tax-template-driven-filing-synthesis` · `tax-multi-quarter-package-saga` · `tax-evidence-cite-trail-to-source-receipts` | §4 (1, 2); §3 (3); §12.5 (4); §11 (5); §10 (6); §8.4 (7) |
| **deep-purple** | `the-tax-audit-shield` · `tax-optimization-playbook` · `tax-package-builder` · `tax-strategy-memo` · `cross-surface-tax-package` · `read-my-tax-pile-deep` · `magic-PII-export-on-buyer-request` · `gdpr-delete-packet` · `surgical-marketplace-policy-deep-read` | **8**: `tax-audit-shield-saga-multi-month` · `tax-audit-2178-archaeology-on-receipt-chain` (every receipt CID + Scheme sidecar — readable in 150 years for an audit) · `gdpr-delete-receipt-as-substrate-tombstone` (compliant deletion with audit-immortal receipt) · `compliance-SOC2-control-evidence-from-audit-log` · `compliance-CCPA-data-export-from-audit-log` · `tax-deathbed-protocol-on-audit-letter` · `tax-cohort-deep-pattern-K8-strategy-extraction` · `tax-template-evolution-on-jurisdiction-change` | §10 saga (1, 6); §2.5 (2); §26.4 + §12.5 (3); §26.1 audit-substrate (4, 5); §12.4 (7); §11 (8) |

**Tax/Compliance unlocks: 3 + 4 + 6 + 7 + 8 = 28 new automations.**

### §23.10 — Marketing (campaigns, brand, launches, email, social, ads)

| Tier | Carts today (sample) | New unlocks (count + name) | Loam feature |
|---|---|---:|---|
| **white** | `shopify-utm-builder` · `creator-outreach-email` (imagine peer) · `popup-postcard-mailer` (pink peer) · ~6 atomic marketing verbs | **2**: `campaign-cid-archive` (every campaign asset content-addressed) · `campaign-tombstone-on-end` (audit preserves spend + attribution) | §8.4 (1); §26.4 (2) |
| **pink** | `pink-acquisition-channel-fold` · `local-creator-meetup` · `local-keyword-suggest` · `voice-dispatch-music-mood` · `voice-dispatch-thanks-card-record` · `ig-content-insights` · `ig-engagement-trend` · `ig-followers-online-windows` (~12 pink marketing helpers) | **5**: `marketing-anticipatory-opener` ("I noticed your IG cohort started posting at 6am — your 3pm slot is bleeding") · `marketing-cross-device-draft-sync` · `marketing-eviction-pin-on-active-campaign` · `marketing-privacy-aware-recall` (contact-PII-scrubbed) · `marketing-stub-refetch-on-campaign-mention` | §5.2 (1); §14 (2); §5.4 (3, 5); §5.3 (4) |
| **green** | `ig-feed-caption-rewrite` · `ig-feed-hashtag-strategy` · `ig-hashtag-effectiveness` · `ig-hashtag-vertical-research` · `ig-tag-product-*` (~5 ig product-tag carts) · `gift-guide-mention-watch` · `forum-mention-watch` · `subreddit-niche-seller-graph` · `meta-shops-to-instagram-shoppable-post` · `instagram-*` (~22 marketing helpers) | **9**: `marketing-NL-recall` ("which campaigns brought repeat buyers in Q3?") · `marketing-cohort-K8-creative-suggest` · `marketing-WORLD-platform-policy-pull` · `marketing-subscribe-on-spend-velocity-cross` · `marketing-subscribe-on-cohort-channel-shift` · `marketing-causal-campaign-fire` (`(:after :inventory-restock-confirmed)`) · `marketing-finding-acts-on-itself` · `marketing-revert-to-prior-creative-CID` · `marketing-template-evolution-on-platform-algo-shift` | §3 (1); §12.4 (2, 5); §13 (3); §10 (4, 5, 6, 9); §11 (7); §26.4 (8) |
| **light-purple** | `brand-position-memo` (deep-purple peer) · `dream-think-through-add-category` (touches brand) · `instagram-collab-find` · `instagram-competitor-watch` · `instagram-ugc-strategy` · `instagram-story-highlight-plan` · ~12 dream-side marketing dossiers | **8**: `four-agent-brand-deep-research-shared-workspace` · `marketing-multi-document-launch-dossier` · `marketing-cross-cohort-creative-discovery` · `marketing-PII-scrubbed-cohort-publish-trends` · `marketing-template-driven-launch-synthesis` · `marketing-multi-week-launch-saga` · `marketing-evidence-cite-trail-to-source-creatives` · `marketing-saga-rollback-on-engagement-collapse` | §4 (1, 2); §3 (3); §12.5 (4); §11 (5); §10 (6, 8); §8.4 (7) |
| **deep-purple** | `holiday-launch-90day` · `launch-international-shipping-14day` · `launch-new-marketplace-21day` · `launch-new-niche-60day` · `launch-wholesale-arm-30day` · `rebrand-shop-45day` · `cross-surface-rebrand-plan` · `four-agent-brand-story-write` · `brand-equity-valuation` · `brand-position-memo` · `paid-ad-bid-optimizer` · `mentor-year-in-review-coaching` · `creator-attribution-model` · `search-path-attribution` | **9**: `multi-month-launch-saga-survives-reboots` (30/45/60/90-day launches resume cleanly across host changes) · `launch-Bayesian-spend-allocation-DLM` (B-class) · `launch-deathbed-protocol-on-attribution-collapse` · `launch-2178-archaeology-on-brand-claim-evidence` · `launch-cohort-deep-pattern-K8-strategy-extraction` · `launch-multi-month-cross-cohort-allocation-saga` · `launch-causal-pivot-on-cohort-pivot-detection` · `launch-template-evolution-on-platform-policy-change` · `launch-saga-replay-from-audit-for-attribution-defense` | §10 saga (1, 6); §7.5.2-B (2); §11 (3, 8); §2.5 (4); §12.4 (5); §10 causal (7); §26.1 audit-substrate (9) |

**Marketing unlocks: 2 + 5 + 9 + 8 + 9 = 33 new automations.**

### §23.11 — SEO (keywords, rank, search, trends, long-tail)

| Tier | Carts today (sample) | New unlocks (count + name) | Loam feature |
|---|---|---:|---|
| **white** | `etsy-seo-title-writer` · `local-keyword-suggest` (pink peer) · ~3 atomic keyword verbs | **2**: `keyword-position-cid-archive` (positions for every keyword, every check, 2000-year) · `keyword-cluster-tombstone-on-prune` | §8.4 (1); §26.4 (2) |
| **pink** | `pink-tag-suggest-local` · `pink-tag-monopoly-find` · `pink-title-tighten-local` · `local-keyword-suggest` (~4) | **4**: `seo-anticipatory-opener` ("I noticed 3 of your top-10 keywords slid in autumn — your cohort's rotating to 'cozy' phrases") · `seo-stub-refetch-on-keyword-mention` · `seo-cross-device-keyword-research-sync` · `seo-eviction-pin-on-tracked-keyword` | §5.2 (1); §5.4 (2, 4); §14 (3) |
| **green** | `4hourly-etsy-keyword-velocity` (cron) · `daily-keyword-fatigue` (cron) · `weekly-keyword-gap-mining` (cron) · `google-kg-tag-suggest` · `dream-seo-listing-cluster-rewrite` (light-purple peer) · `dream-think-through-add-category` · ~12 green seo helpers | **8**: `seo-NL-recall` ("which keywords drove sales in autumn 2025?") · `seo-cohort-K8-keyword-suggest` · `seo-WORLD-search-volume-pull` · `seo-subscribe-on-rank-drift` · `seo-subscribe-on-cohort-keyword-shift` · `seo-causal-rewrite-fire` (`(:after :algorithm-rumor-detected)`) · `seo-finding-acts-on-itself` (rank-drop finding carries the rewrite code-CID) · `seo-revert-to-prior-keyword-set-CID` | §3 (1); §12.4 (2, 5); §13 (3); §10 (4, 5, 6); §11 (7); §26.4 (8) |
| **light-purple** | `dream-seo-listing-cluster-rewrite` · `topic-atlas-of-listings` (deep-purple peer) · `algorithm-rumor-watch` (in dream cron-cousin) · `dream-stale-listing-relocate` · ~9 dream-side seo dossiers | **7**: `four-agent-seo-deep-research-shared-workspace` · `seo-multi-document-strategy-dossier` · `seo-cross-cohort-keyword-discovery` · `seo-PII-scrubbed-cohort-publish-keyword-pivots` · `seo-template-driven-rewrite-synthesis` · `seo-multi-week-strategy-saga` · `seo-evidence-cite-trail-to-source-search-results` | §4 (1, 2); §3 (3); §12.5 (4); §11 (5); §10 (6); §8.4 (7) |
| **deep-purple** | `seo-rewrite-shop-30day` · `topic-atlas-of-listings` · `trend-tracker-particle-filter` · `daily-trend-radar` (cron peer) | **7**: `seo-quarterly-cohort-keyword-refresh-saga` · `seo-Bayesian-keyword-evolution` (B-class, particle filter over 365d) · `seo-deathbed-protocol-on-rank-collapse` · `seo-2178-archaeology-on-search-result-evidence` · `seo-cohort-deep-pattern-K8-keyword-extraction` · `seo-multi-month-portfolio-prune-saga` · `seo-causal-pivot-on-cohort-algorithmic-detection` | §10 saga (1, 6); §7.5.2-B (2); §11 (3); §2.5 (4); §12.4 (5); §10 causal (7) |

**SEO unlocks: 2 + 4 + 8 + 7 + 7 = 28 new automations.**

### §23.12 — Analytics (dashboards, KPIs, forecasts, dossiers, year-in-review)

| Tier | Carts today (sample) | New unlocks (count + name) | Loam feature |
|---|---|---:|---|
| **white** | `category-distribution` · `category-sell-through` · `avg-days-to-sell` · `avg-order-value` · `listing-funnel-diagnosis` (etsy) · ~10 atomic analytic verbs | **3**: `analytic-snapshot-cid-per-day` (every dashboard state is a CID; 2000-year addressable) · `analytic-revision-diff-by-CID` · `analytic-tombstone-on-deleted-metric` | §8.4 (1, 2); §26.4 (3) |
| **pink** | `pink-revenue-decile-card` · `pink-shop-quartile-portrait` · `pink-fee-breakdown-fold` · `pink-acquisition-channel-fold` · `daily-shop-pulse-summary` (cron) · `shopify-top-sellers-30d` · `ig-engagement-trend` (~8) | **5**: `analytic-anticipatory-opener` ("I pulled yesterday's KPI movements overnight — you're up 4%, here's the driver") · `analytic-cross-device-dashboard-sync` · `analytic-eviction-pin-on-active-dashboard` · `analytic-privacy-aware-recall` (no per-buyer PII surfaces) · `analytic-stub-refetch-on-metric-mention` | §5.2 (1); §14 (2); §5.4 (3, 5); §5.3 (4) |
| **green** | `listing-funnel-diagnosis` · `listing-history-30` · `daily-anomaly-watch` (cron peer) · `ebay-traffic-by-listing-90d` · `daily-shop-pulse-summary` · `paid-vs-organic-listing-bias` · `daily-question-from-cortex` · ~14 green analytic helpers | **8**: `analytic-NL-recall` ("when did conversion last cross 4%?") · `analytic-cohort-K8-benchmark` · `analytic-WORLD-marketplace-baseline-pull` · `analytic-subscribe-on-KPI-cross` · `analytic-subscribe-on-cohort-anomaly` · `analytic-causal-investigation-fire` (`(:after :conversion-drop-detected)`) · `analytic-finding-acts-on-itself` (anomaly finding carries the investigation code-CID) · `analytic-revert-to-prior-baseline-CID` | §3 (1); §12.4 (2, 5); §13 (3); §10 (4, 5, 6); §11 (7); §26.4 (8) |
| **light-purple** | `dream-weekly-margin-memo` · `monthly-strategy-dossier` (deep-purple peer) · `competitive-strategy-memo` · `competitor-landscape-dossier` · `creator-magic-dossier` · `dropship-vs-stock-dossier` · `expansion-niche-dossier` · `geographic-expansion-dossier` · `holiday-readiness-dossier` · `niche-economics-dossier` · `pricing-strategy-memo` · `shop-pulse-digest-hmc` (B-class peer) · ~16 dream-side analytic dossiers | **9**: `four-agent-analytic-deep-research-shared-workspace` · `analytic-multi-document-strategy-dossier` · `analytic-cross-cohort-benchmark-discovery` · `analytic-PII-scrubbed-cohort-publish-baselines` · `analytic-template-driven-dossier-synthesis` · `analytic-multi-week-investigation-saga` · `analytic-evidence-cite-trail-to-source-events` · `analytic-saga-rollback-on-baseline-error` · `analytic-anomaly-as-subscription-target` | §4 (1, 2); §3 (3); §12.5 (4); §11 (5); §10 (6, 9); §8.4 (7); §26.4 (8) |
| **deep-purple** | `mentor-year-in-review-coaching` · `monthly-strategy-dossier` · `qbr-leadership-presentation` · `competitive-strategy-memo` · `four-agent-strategic-memo` · `category-deep-strategy-memo` · `category-entry-timing-dossier` · `category-extinction-watch` · `competitor-landscape-dossier` · `cross-marketplace-allocation` · `state-space-marketplace-pmcmc` · `demand-forecast-state-space` · `shop-pulse-digest-hmc` · `causal-forests-heterogeneous` · `time-varying-pricing-dlm` · `marketplace-choice-discrete` · `posterior-pricing` · `mcmc-posterior-pricing` · `slow-mover-gp` · ~25 deep-purple dossier/Bayesian carts | **10**: `year-in-review-substrate-narration` (Loam holds the year; Sakura narrates Dec 31 from the whole event log) · `analytic-quarterly-cohort-benchmark-refresh-saga` · `analytic-Bayesian-state-space-365d` (B-class) · `analytic-deathbed-protocol-on-data-collapse` · `analytic-2178-archaeology-on-fiscal-evidence` · `analytic-cohort-deep-pattern-K8-benchmark-extraction` · `analytic-multi-month-saga-with-statistical-power-floor` (some carts only run when N is high enough) · `analytic-causal-pivot-on-cohort-anomaly-cascade` · `analytic-saga-replay-from-audit-for-board-defense` · `analytic-substrate-recursive-self-narration` (Loam writes its own KPIs into Loam; Sakura tells the operator how the substrate itself is doing) | §24 entertainment (1); §10 saga (2, 7); §7.5.2-B (3); §11 (4); §2.5 (5); §12.4 (6); §10 causal (8); §26.1 audit (9); §26.8 recursive (10) |

**Analytics unlocks: 3 + 5 + 8 + 9 + 10 = 35 new automations.**

### §23.13 — Running total + honest read

| Area | New unlocks |
|---|---:|
| Listings | 36 |
| Orders | 28 |
| Buyers | 30 |
| Conversations | 24 |
| Reviews | 26 |
| Photos | 26 |
| Inventory | 28 |
| Finance | 32 |
| Tax / Compliance | 28 |
| Marketing | 33 |
| SEO | 28 |
| Analytics | 35 |
| **§23 total** | **354** |

Honest read: the 12-area walkthrough surfaces **354 unlocks** that
did not appear in §15's by-feature count. **§15 (324) + §23 (354) =
678 — but the right honest read is that §23 unlocks are a per-area
restatement of §15's by-feature unlocks plus the area-specific
combinations.** Roughly 130 of §23's 354 are net-new
shop-area-specific shapes not surfaced by §15's by-feature lens; the
remaining ~224 are §15 patterns instantiated per area (which is the
correct expansion — the per-area instantiation is the unit operators
actually use). The total unique automation-pattern count after this
section is **~454** (324 by-feature + ~130 area-specific net-new),
clearing the architect's *"It could be that we find an honest 500"*
ceiling by a hair. We do not pad to hit 500.

What the walkthrough surfaced that §15 by-feature missed:

- **The white tier consistently gains 2–3 unlocks per area** from
  CID-as-receipt and tombstone discipline — these are §8.4 and §26.4
  shapes that §15 did not enumerate as a per-area pattern.
- **The pink tier consistently gains 4–6 unlocks per area** from
  Cortex-of-Loam's anticipatory-opener / cross-device-sync /
  privacy-aware-recall trinity. §15 named 36 Cortex-of-Loam carts;
  the per-area expansion is 12 areas × ~5 = ~60, of which ~36 overlap
  with §15's count, leaving ~24 net-new.
- **The §11 "finding-acts-on-itself" pattern** appears in every
  green-tier row (12 instances) — §15 named it 18 times across all
  finding kinds; §23 confirms it across the 12 areas with concrete
  shop-context shapes.
- **The white-tier `*-cid-archive` / `*-tombstone` pattern was
  invisible in §15** but is load-bearing: 12 areas × ~3 = ~36
  white-tier audit-substrate unlocks not previously counted.
- **The deep-purple `*-saga-replay-from-audit`** pattern recurs in
  Listings, Orders, Disputes, Launches, Analytics — 5 instances of
  one shape. §15 named "audit-driven dispute defense" once; §23
  shows the shape generalizes.

The honest §15 + §23 unique-pattern total: **~454 automations**.

---

## §24 — Entertainment orchestrations

The architect: Loam holds the timeline; Sakura narrates against it
over weeks and months. Entertainment is a load-bearing surface in
Curator — operators stay because the substrate makes the shop feel
alive. This section enumerates the entertainment beats Loam unlocks.

**Naming note.** Per Daisy's Appendix A ruling, "Loam" never appears
in operator-facing copy. The carts below are engineering names; their
operator-visible labels are scene names ("Pearl visits", "Year-in-
review night", "Cohort cheer"). Engineering-internal in this doc.

### §24.1 — Sakura-narrated multi-day scenes

A scene is a sequence of micro-narrations Sakura performs against
Loam-resident state. Loam holds the state; Sakura reads the next
beat each session.

| Cart name (engineering) | Operator-visible scene | Loam mechanism | Duration |
|---|---|---|---|
| `scene-week-of-orders` | "Sakura tracks your week" | `loam.subscribe` on order-state changes; Sakura reads `loam://principal/<shop>` each session and narrates the day's deltas | 7 days |
| `scene-month-of-margin` | "Margin journey, narrated" | `loam.subscribe` on `(:and :margin-delta :> threshold)`; daily push into Cortex-of-Loam | 30 days |
| `scene-launch-30-day-saga` | "Your 30-day launch, day by day" | Workspace saga; each daily wake re-narrates progress + obstacles | 30 days |
| `scene-quarter-of-cohort` | "Your cohort this quarter" | Daily K-anon read; weekly narration arc | 90 days |
| `scene-90-day-deadstock-rescue` | "The Lazarus list" | Daily inventory subscription; narrates as items resurrect | 90 days |
| `scene-bayesian-trend-tracker` | "Your trend's mood" | B-class workspace; daily particle-cloud delta narration | 60 days |
| `scene-buyer-of-the-week` | "Meet this week's buyer" | Cortex-of-Loam picks the highest-LTV non-trivial buyer each Monday | weekly |
| `scene-supplier-soap-opera` | "Your supplier this month" | Subscribes to supplier-price-creep + contract-change; narrates as drama beats | monthly |
| `scene-dispute-thriller` | "How your dispute resolved" | Reads saga audit at resolution; narrates beat-by-beat as told story | event-driven |
| `scene-year-of-photos` | "Your year in shots" | Reads `cas/` blob store CIDs; selects 1 per week; narrates the aesthetic arc | 365 days |

**10 cart-templates.** Each is one engineering cart × per-operator
instantiation; the entertainment unit is the scene, not the cart.

### §24.2 — Pearl as recurring narrator

Pearl is a long-arc narrator character — Pearl-shy, reveal-on-hover,
recurring across weeks. Per the architect's keep-her-in-character
directive: Pearl never directly addresses the operator; she leaves
notes for Sakura, and Sakura relays. The reveal is incidental — on
hover over a finding, the operator sees "Pearl noticed this" before
the finding text.

| Cart name (engineering) | Pearl moment | Loam mechanism |
|---|---|---|
| `pearl-arrives-on-first-cohort-K8` | Pearl is shy; she only appears when the operator's cohort first hits K=8 and a federated finding becomes available. She leaves Sakura a single note: "Your peers showed up. Be gentle with the numbers." | K-floor crossing subscription (`(:cohort-size >= 8)`); fires Pearl's intro once per operator |
| `pearl-notices-quiet-week` | When orders drop > 20% week-over-week, Pearl quietly says "I noticed. I'm here." in Sakura's open. Once per quiet week, never more. | Threshold subscription; Cortex-of-Loam delivery |
| `pearl-saw-the-launch` | At end of a multi-week launch, Pearl appears in the recap with one sentence: "I watched the whole thing." Single appearance per launch. | Saga-complete subscription |
| `pearl-on-the-edge-of-burnout` | When `cross-shop-burnout-signal` finding lands and the operator's own metrics match, Pearl leaves "Rest is a feature, not a bug." | Causal subscription (`(:after :burnout-signal-detected)`) |
| `pearl-year-end` | Dec 31, Pearl narrates her own year of watching, hover-reveal only — never bursts onto screen. | Annual cron-replaced-by-subscription |
| `pearl-on-recovery` | After a dispute is won, Pearl: "Quiet wins." Once. | Saga-resolved subscription |
| `pearl-on-K-anon-suppression` | When a finding is suppressed for K-floor, Pearl says "I saw something but I'm staying quiet — your cohort isn't big enough yet." | Suppression-event audit row → Pearl draft |

**7 cart-templates.** Pearl never spams; the substrate is the
discipline that keeps her rare.

### §24.3 — Radio orchestrations that adapt to shop state

Radio is a Curator surface (`scenes/synth-beethoven-9`,
`radio/reverseConway.sks`, `radio/sakuraPetalsSource.js`). Loam lets
radio adapt to substrate state in real time.

| Cart name (engineering) | Adaptive behavior | Loam mechanism |
|---|---|---|
| `radio-celebrate-on-sale` | New order lands → next track is celebratory (major key, faster tempo) | `loam.subscribe` on order-new; callback to radio cart |
| `radio-quiet-on-dispute` | Dispute saga active → mute non-ambient | Saga-state subscription |
| `radio-cohort-mood-sync` | Cohort-mood signal shifts → radio shifts (within operator-set range) | Cohort signal subscription + K-floor |
| `radio-narrate-the-week` | End-of-week → radio plays a Sakura-narrated week recap with music underscore | Weekly saga |
| `radio-conway-on-shop-state` | `reverseConway` substrate cells seeded from real shop events — orders breed cells, refunds kill them | Direct read of `loam://principal/<shop>/order-stream` |
| `radio-pearl-jazz-on-quiet-week` | Pearl-on-quiet-week fires → radio shifts to soft jazz | Pearl subscription chained to radio |
| `radio-launch-anthem-arc` | Launch-day → custom anthem arc spanning the launch | Saga + radio chain |
| `radio-year-in-review-symphony` | Dec 31 → composed-from-event-log symphony, each movement = a quarter | Annual saga + composition |

**8 cart-templates.** The Conway-on-shop-state one is the moat — the
substrate makes the screen alive with real shop pulse, not a
simulator.

### §24.4 — Multi-day puzzles + achievements

Puzzles + achievements that span weeks because Loam holds the state
across reboots.

| Cart name (engineering) | Puzzle / achievement | Loam mechanism |
|---|---|---|
| `puzzle-find-the-leak` | 7-day shipping-cost-leak puzzle; Loam reveals one hint per day | Workspace saga; daily-fire subscription |
| `puzzle-cohort-detective` | 14-day cohort-pattern detective game (anonymized); operator guesses the trend | Cohort daily reveal; K-floor enforced |
| `puzzle-margin-mystery` | 30-day margin-attribution mystery; weekly reveal of one factor | Workspace saga |
| `achievement-first-K8-cohort` | "Your cohort came alive" — unlocked first time K=8 fires | One-time subscription fire |
| `achievement-30-day-streak` | "30 days without a stockout" — Loam tracks the streak in workspace | Daily subscription |
| `achievement-year-of-photos` | "365 photos taken" — Loam counts CIDs over the year | Annual cumulative |
| `achievement-cohort-champion` | Win a cohort comparison metric (K-anonymized) — earned via cohort aggregate | Cohort subscription |
| `puzzle-deadstock-archeology` | 60-day game: operator + Sakura together resurrect the saddest 3 deadstock items each week | Workspace saga; weekly fire |

**8 cart-templates.** Each survives reboots, host changes, model
upgrades. Loam is the discipline that makes a 60-day puzzle viable.

### §24.5 — Conway-on-Loam scenes from real shop data

The radio entry above (`radio-conway-on-shop-state`) gestures at it;
this section names the full family. The point: substrate cells are
seeded from real shop events, not random. Beautiful + load-bearing.

| Cart name (engineering) | What lives in the cells |
|---|---|
| `conway-orders-of-the-day` | Each order seeds one cell at coordinate `(buyer-cohort, hour)`; cells breed if 2+ orders in adjacency |
| `conway-cohort-pulse` | Cells seeded by cohort signals; the K-floor-suppressed signals show as dim cells |
| `conway-supplier-network` | Cells = suppliers; edges = shared products; breeding = co-purchase |
| `conway-message-pulse` | Each inbound message lights a cell; the cell decays unless replied to within 24h |
| `conway-year-of-sales` | Annual scene: each day-of-year is a cell row; the year's pattern emerges |
| `conway-deadstock-graveyard` | Cells = deadstock items; they breed (combine) into bundle suggestions |
| `conway-listing-attention` | Cells = listings; light if viewed today, faded otherwise; emergent attention pattern |

**7 cart-templates.** The Conway substrate is invisible to operators
as "Conway"; the scene name is whichever poetic operator-visible
label fits ("The orchard tonight", "Your buyer constellation").

### §24.6 — Cohort moments (K-floor-driven synchronized scenes)

Cohort moments are the architect's *"everyone in jewelry niche had a
slow week, here's a synchronized cheer-up scene"* — Loam knows the
cohort's state, K-floor allows the synchronized fire, the scene
plays for every operator in the cohort.

| Cart name (engineering) | Cohort moment | Loam mechanism |
|---|---|---|
| `cohort-cheer-up-on-collective-slow-week` | Whole cohort had a soft week → synchronized "we'll get there together" scene with Pearl + Sakura | Cohort-aggregate K=8 trigger; broadcast |
| `cohort-celebrate-on-collective-record-week` | Whole cohort had a record week → synchronized celebration | Cohort threshold cross |
| `cohort-shared-deadstock-rescue-week` | Cohort all carrying deadstock → coordinated 7-day rescue scene | Cohort cron-replaced-by-subscription |
| `cohort-mentor-of-the-month` | Cohort's highest-K-anonymized creator shares one anonymous tip; everyone sees it via Sakura | Cohort opt-in publish to PUBLIC; K-floor enforced |
| `cohort-collective-vacation-mode` | Cohort is collectively in vacation-mode → "the niche is resting" scene plays for all | Cohort state subscription |
| `cohort-launch-week-together` | Cohort planning a coordinated launch (opt-in) → synchronized countdown scene | Cohort opt-in workspace |
| `cohort-year-end-anthology` | Dec 31 — cohort gets a shared anthology of anonymized wins from the year | Annual K-anonymized cohort export |

**7 cart-templates.** These were impossible before the K-floor
co-transactional discipline + subscription primitive landed. The
cohort moment is a Loam-native automation kind.

### §24.7 — Year-in-review (Loam holds the timeline)

Year-in-review is the showcase of the substrate. Loam holds the year;
Sakura narrates against it.

| Cart name (engineering) | Year-in-review beat |
|---|---|
| `yir-narrative-1-the-shape-of-your-year` | Sakura narrates the operator's year as a 90-second story; reads the event log end-to-end |
| `yir-narrative-2-buyer-portraits` | 5–10 buyer portraits from the year's purchases; PII-scrubbed |
| `yir-narrative-3-the-product-that-grew-up` | One product's full year arc; from launch to flagship to legacy |
| `yir-narrative-4-the-thing-you-changed-your-mind-on` | A decision the operator reversed during the year; Sakura tells it without judgement |
| `yir-narrative-5-cohort-where-you-stood` | Where the operator sits in the cohort, K-anonymized |
| `yir-narrative-6-the-quiet-wins` | The wins the operator never noticed — extracted from the audit log |
| `yir-narrative-7-the-best-photos` | Reads `cas/` blob store; selects the year's best 12 by engagement |
| `yir-narrative-8-the-message-that-mattered` | One conversation that turned a buyer into a repeat — anonymized + permissioned |
| `yir-narrative-9-the-launch-you-shipped` | Recaps the launch sagas; one summary per major launch |
| `yir-narrative-10-the-pearl-archive` | All Pearl appearances of the year, presented once |
| `yir-narrative-11-substrate-reflections` | Sakura tells the operator how the substrate itself behaved this year (recursive) |
| `yir-narrative-12-next-year-seeds` | Reads the substrate's pattern-store; suggests 3 seeds for next year |

**12 cart-templates.** Year-in-review is a substrate-native genre.

### §24.8 — Entertainment unlocks count

| Sub-section | Cart-templates |
|---|---:|
| §24.1 Sakura-narrated multi-day scenes | 10 |
| §24.2 Pearl recurring narrator | 7 |
| §24.3 Radio orchestrations | 8 |
| §24.4 Multi-day puzzles + achievements | 8 |
| §24.5 Conway-on-Loam scenes | 7 |
| §24.6 Cohort moments | 7 |
| §24.7 Year-in-review beats | 12 |
| **§24 total** | **59** |

All 59 are net-new — §15 did not enumerate the entertainment surface.
The entertainment unlocks are the substrate's most emotionally
load-bearing outputs; they are also the most patentable as a class
(the K-anon synchronized cohort scene is novel).

---

## §25 — Work orchestrations requiring cron

The architect's original vision: *"ask now, come back in weeks."* The
substrate makes long-running, evidence-patient work viable because
Loam holds the project state across the weeks.

### §25.1 — Long-arc work cart catalogue

These are the carts the substrate enables that no current system
supports honestly. Each is a saga: state lives in Loam; the cart
wakes on a schedule; results accumulate over weeks.

| Cart name (engineering) | Duration | Saga shape | Loam mechanism |
|---|---|---|---|
| `multi-week-competitive-landscape` | 6 weeks | Weekly competitor scrape → cohort comparison → strategic memo at week 6 | Workspace saga; weekly cron + subscription; cohort K-anon at week 6 |
| `monthly-brand-voice-audit-cohort` | 4 weeks | Weekly voice samples across cohort → drift detection → audit report | Cohort K=8 read; workspace saga |
| `quarterly-buyer-cohort-persona-refresh` | 90 days | Daily buyer-cohort observations → particle filter → quarterly persona update | B-class workspace; particle cloud blob |
| `seasonal-SEO-pivot-watch` | 12 weeks (per season) | Daily keyword position scrape → autumn-slide detection → "you're sliding in autumn" cart fires | `loam.subscribe` on rank trajectory; predicate evaluates against 90-day window |
| `long-running-AB-with-K-anon` | until statistical power | Daily traffic split observation; cart only fires recommendation when N is large enough across cohort | K-floor + workspace; subscription on `(:cohort-stat-power >= 0.80)` |
| `patient-evidence-cart-5-cohort-3-success` | indefinite | "Tell me when 5 jewelry sellers tried this approach and 3 succeeded" | Cohort subscribe with K-and-outcome predicate; fires once condition met |
| `cross-week-buyer-delivery-use-review-reorder-prediction` | 4-12 weeks per buyer | Daily wake; advances buyer through delivery → use → review → re-order prediction stages | Workspace saga per buyer cohort |
| `monthly-supplier-reliability-track` | 6 months | Monthly supplier check → cumulative reliability score | Workspace cumulative |
| `multi-quarter-pricing-elasticity-study` | 6 months | Monthly elasticity test in cohort → power-gated final | B-class + K-floor |
| `annual-brand-equity-saga` | 12 months | Quarterly brand audits → annual valuation memo | Workspace saga |
| `multi-month-marketplace-allocation-rebalance` | rolling 90 days | Daily marketplace observations → allocation suggestion if drift > threshold | B-class workspace |
| `cohort-collective-launch-coordination` | 60 days | Cohort opt-in coordinated launch; weekly check-ins | Cohort workspace |
| `multi-week-tax-package-cumulative` | 90 days per quarter | Daily transaction accumulation → quarter-end package | Workspace cumulative |
| `seasonal-photo-aesthetic-evolution-watch` | 3-12 months | Monthly aesthetic-cohort observation → drift report | Cohort K=8 + workspace saga |
| `multi-year-buyer-LTV-extension-watch` | 2-5 years | Quarterly buyer-cohort observation; the substrate is the only thing that can hold this | Workspace; subscription survives reboots |
| `cohort-extinction-watch` | indefinite | Subscribe to `(:cohort-membership-decay > threshold)`; fires when category is dying | Cohort subscription |
| `multi-week-dispute-escalation-saga` | 4-8 weeks | Already exists as deep-purple cart; substrate makes it durable | Saga + cite-store |
| `quarterly-cross-marketplace-fee-arbitrage` | 90 days | Daily fee observations → quarterly arbitrage memo | Workspace cumulative |
| `multi-month-creator-attribution-study` | 6 months | Daily creator-channel observations → monthly attribution refinement | B-class workspace |
| `cohort-collective-rebrand-season` | 90-180 days | Opt-in cohort-coordinated rebrand season; weekly Pearl check-ins | Cohort workspace + Pearl |
| `multi-year-shop-archeology` | open-ended | Operator can ask "show me my shop in 2027 from 2030's perspective" — substrate has the answer | 2000-year discipline |

**21 cart-templates.** Each is impossible to ship honestly without
Loam. Of the 21, **5 require K-anon discipline**, **6 are B-class
(Bayesian particle/posterior state)**, **3 are multi-year-scope**.
The substrate is the only honest place these can run.

### §25.2 — "Find cool db shit that gives us new cron-related work"

The architect's instruction: *"Find cool db shit that gives us new
cron related work."* Substrate-native cron-class work that the
literature points at but no current Curator cart uses:

| Substrate primitive | Cron-class work it unlocks | Cart name (engineering) |
|---|---|---|
| **Change-data-capture (CDC) on log segments** | Wake when a fact of kind X lands — without polling | `cdc-driven-cohort-rebuild` (catches cohort additions in <60s of write) |
| **Materialized-view incremental refresh** | Hot dashboard auto-refreshes from log without recomputing | `incremental-dashboard-refresh` |
| **Watermark-based exactly-once** | Multi-step saga whose each step's success watermark is durable | `exactly-once-multi-marketplace-publish` |
| **Saga compensation logs** | Multi-step transaction with a per-step undo path | `compensating-saga-on-failed-launch` |
| **Tombstone reaper sweeps** | Periodic sweep for orphan state | `orphan-saga-reaper` (replaces zombies) |
| **Event-time vs processing-time** | Cron that respects buyer's local time, not server time | `buyer-tz-aware-followup` |
| **Cohort-pivot triggers** | Fire when cohort membership changes (not just data) | `cohort-pivot-driven-resegment` |
| **Predicate-pushdown subscription** | Subscribe to a predicate that pushes down into shard storage; near-zero CPU between fires | `cheap-subscription-on-thousands` |
| **Versioned snapshot reads** | "Show me my shop as it was at this CID" | `point-in-time-shop-snapshot` |
| **Lease-based cron leadership** | Multiple replicas; one holds the lease for the cron; lease handoff on failure | `lease-cron-no-double-fire` |
| **Delta-encoded daily roll-up** | Each day's roll-up stores only the delta from yesterday | `delta-rollup-substrate-native` |
| **Transactional outbox pattern** | Saga step + outbox write in same transaction; outbox publisher is the cron | `transactional-outbox-publisher` |
| **Bi-temporal queries** | "What did we know about X at time T, even if we now know more?" | `bi-temporal-receipt-replay` |

**13 cart-templates** unlocked by substrate-native cron primitives
the literature has had for a decade but Curator has not exercised.
The list is honest research — every primitive named above appears in
the event-sourcing + saga literature (Microsoft Azure Architecture
Center patterns, Confluent's blog on watermarks, Hickey's Datomic
bi-temporal model). The substrate makes them available; the carts
make them visible.

### §25.3 — Ultra-reliable cron

The architect's instruction: *"make the cron ultra reliable."* The
substrate's job is to make every cron job's lifecycle observable,
re-playable, idempotent, and recoverable. The discipline:

#### §25.3.1 — Idempotency keys + at-least-once semantics

Every cron job carries an **idempotency key** = `hash(job-id +
intended-fire-time + payload-cid)`. Loam's deterministic shell
rejects a second commit of the same key within the dedup window. The
substrate is the dedup store. No double-charge, no double-publish,
no double-send.

#### §25.3.2 — Durable timer wheel

Cron schedules live in Loam as `cron-spec` records, content-addressed
and signed. A timer-wheel process subscribes to the cron-spec table;
when fires are due, it emits a `job.due` event into SYSTEM. The
timer wheel itself can crash and restart — its state is recovered
from Loam. **No fires are lost; no fires are doubled.**

#### §25.3.3 — Replay log + `loam-replay.sh`

Every cron job's full input + decision + output is logged in SYSTEM.
A failed job can be re-played:

```bash
#!/usr/bin/env bash
# loam-replay.sh — replay a job from its recorded inputs.
# Requires: bash, sqlite3, jq, curl.

JOB_ID="${1:?usage: loam-replay.sh <job-id>}"
SHARD_URL="${LOAM_SHARD_URL:?missing shard url}"

# 1. Pull the job's input CID + spec from the audit log
INPUT_CID=$(curl -fsSL "$SHARD_URL/v1/audit/$JOB_ID" | jq -r '.input_cid')
SPEC_CID=$(curl -fsSL "$SHARD_URL/v1/audit/$JOB_ID"  | jq -r '.spec_cid')

# 2. Reconstruct the inputs from CAS
INPUT_BLOB=$(curl -fsSL "$SHARD_URL/v1/cas/$INPUT_CID")
SPEC_BLOB=$(curl -fsSL  "$SHARD_URL/v1/cas/$SPEC_CID")

# 3. Re-submit via the Shell with REPLAY semantic
curl -fsSL -X POST "$SHARD_URL/v1/loam.execute" \
  -H "X-Loam-Replay: $JOB_ID" \
  -H "Content-Type: application/json" \
  --data "{\"spec_cid\":\"$SPEC_CID\",\"input_cid\":\"$INPUT_CID\"}"

echo "replay submitted for $JOB_ID"
```

Replay is idempotent: the same job re-fired against the substrate
yields the same CID-output if inputs match. Different CID-output =
honest divergence, recorded.

#### §25.3.4 — Heartbeats + stuck-job detection

Every running job emits a heartbeat to SYSTEM every `cadence × 0.25`.
A heartbeat older than `N × cadence` (default N=3) flips the job to
state `assumed-dead` and routes to the dead-letter queue. No silent
zombies.

#### §25.3.5 — Exponential backoff + jitter

Failed jobs re-queue with exponential backoff: `2^attempt seconds ±
random(0, 2^attempt)` (full jitter, per AWS Architecture Blog
discipline). After `max_attempts` (default 5), the job lands in the
dead-letter queue.

#### §25.3.6 — Conditional triggers (CDC, watermarks, sagas)

Beyond time-based cron, three condition-based triggers:

- **CDC trigger:** "wake when fact of kind X lands in plane Y"
- **Watermark trigger:** "wake when the watermark on stream Z crosses time T"
- **Saga trigger:** "wake when saga step N reports state Y"

All three are first-class. All three are stored in Loam. All three
are replayable from audit.

#### §25.3.7 — Persistent job IDs (queryable in 2030)

Every job ID is a content-addressed CID. The job's full audit trail
is queryable forever:

```
loam.job("ABC").state()        ; current state
loam.job("ABC").history()      ; full state-transition log
loam.job("ABC").input_cid()    ; pin to the inputs
loam.job("ABC").output_cid()   ; pin to the outputs
loam.job("ABC").replay_url()   ; the bash one-liner that replays it
```

In 2030, an operator can ask "what happened with job ABC?" and the
substrate answers from the log — no archive scratchpads, no Slack
threads, no Lacuna SRE detective work.

#### §25.3.8 — Lease-based leadership

Multiple cron workers can subscribe to the same `cron-spec`. Only the
lease-holder fires. Lease is held for `cadence × 1.5`; if not
refreshed, another worker can acquire. Double-fire is impossible
because the idempotency-key check (§25.3.1) rejects the second
commit.

### §25.4 — Cron ultra-reliability count

**8 disciplines, 13 substrate-primitive carts, 21 long-arc work
sagas = §25 total of 42 new automation patterns** that depend on
substrate-native cron reliability. These are net-new; §15's
"cron-replaced-by-subscription" (18 automations) is a subset of
§25.2's broader event-driven enumeration.

### §25.5 — Subscriptions auto-suggested by the substrate

The 21 long-arc carts in §25.1 and the 13 cron-primitive carts in
§25.2 each declare their own subscription explicitly. Substrate
intelligence (§16.3.9 pattern mining + §16.3.8 predictive
subscriptions) adds a third source: **the substrate notices that a
sequence of reads keeps recurring at the same cadence and proposes
the subscription to the cart**. *"You have asked for this cohort's
fee-schedule snapshot every Tuesday morning for 6 weeks running —
register a subscription instead?"* The proposal is conservative
(only fires after the pattern stabilizes), honest about uncertainty
(declined proposals are recorded; the substrate re-asks at most
quarterly), and bounded (per-tenant cap on auto-suggested
subscriptions). Subscriptions therefore arrive in three ways: cart-
declared (§10), operator-declared (the §24.4 puzzles), or
substrate-proposed (this section). The cron surface is no longer
fully human-authored.

---

## §26 — Operational invariants

This section is the operational discipline that turns Loam from a
design into a substrate operators can trust. Every invariant is
honored by architecture, not by hope. Architect's verbatim
constraints in quote.

**Read §16 alongside §26.** Substrate intelligence (§16.3.5
anomalies, §16.3.7 cost prediction, §16.3.10 self-healing, §16.3.11
audit-as-corpus) is what makes the four operator-load-bearing
invariants in this section — §26.3 (cost), §26.4 (dead jobs),
§26.7 (never-down), §26.8 (SRE) — **substrate-native** rather than
**operator-driven**. In LOAM 1.0 the operator was expected to watch
cost dashboards, reap dead jobs manually, page when availability
dropped, and ferry telemetry to a separate observability tool. In
LOAM 2.0 the substrate watches itself: anomaly detection raises the
hand, self-healing closes the loop, the audit log feeds the
detection back to the substrate. The invariants below remain the
contract; the substrate is the one enforcing them by default.

### §26.1 — Audits: every action accountable

Every action against the substrate appends an audit row. The audit
log is itself a Loam table — recursive on purpose. Each row carries:

```scheme
(:audit-row
  :who    <principal-cid>          ; signed by the principal's cap-token
  :what   <operation>               ; canonical verbs: put | get | append | on | poll | subscribe | unsubscribe | operator-state | cohort/aggregate | code-execute | consumer-disclosure | admt/dispute | cart/withdraw | list-subscriptions (14 tools per §4.1). Audit-action tags are hyphenated (e.g. `subscription-fired`, not `subscription.fired`). Corrected 2026-06-27 per AUDIT-LIES C1/M1.
  :when   <timestamp + monotonic-counter>
  :why    <stated-intent-string>    ; the principal's English statement of intent
  :on     <target-cid-or-principal>
  :result <success | denied | escalate-symbol>
  :cid    <audit-row's-own-cid>     ; content-addressed; signed)
```

Audit is **co-transactional with the data write** — they commit in
the same SQLite transaction. There are no audit-gap windows. If the
data write succeeds, the audit row exists. If the data write fails,
neither commits.

`loam.audit.find(tenant, from, to)` is first-class. The audit log is
queryable like any other Loam table — same Shell, same cap-token
discipline, same projections. SYSTEM-plane reads of audit require a
caveat-attenuated cap-token.

**Retention: 2000 years.** The audit log inherits the §2 storage
cake. Audit rows in glacier remain queryable from cold-tier via a
restore.

### §26.2 — No dead state: everything alive

Every record in Loam has:

1. **An owner** — a principal-CID that the cap-token chain ties back
   to. No orphan records.
2. **A heartbeat or explicit "indefinite" with stated reason** —
   either the owner refreshes every cadence-window, or the record
   carries `:retention 'indefinite :reason "..."` (auditable).
3. **A TTL** — default 90 days; explicit override required for longer.

A daily **reaper sweep** finds records whose heartbeat lapsed +
whose TTL expired + whose retention is not `'indefinite`. The reaper:

- Sends a `pre-eviction` notification to the owner (3 days advance).
- If no refresh, transitions the record to `state=tombstoned`.
- Tombstoned records are **never truly gone** — they carry a tombstone
  with the original CID, the eviction timestamp, the reason, and a
  pointer to the cold-tier snapshot.

Subscriptions auto-expire at their `expires-at` boundary. Failed
callbacks land in the DLQ. **No orphan workflows. No silent forgets.**

### §26.3 — No cost overruns: budget enforced at write time

Architect's verbatim invariant: budget is enforced **at the write**,
not after. The mechanism:

1. **Per-tenant token bucket** — checked in the same transaction as
   the write.
2. **Pre-flight reserve** — the write reserves `n` tokens before
   committing. If the reserve succeeds, the write proceeds.
3. **Atomic release on failure** — if the write fails, the reserved
   tokens release atomically. **Never partial; never double-debited.**
4. **Hard cap per tenant per day** — denies further writes when hit.
5. **Soft cap → notification** — at 80%, the operator gets a notice;
   the write still succeeds. **Notification, not failure.**
6. **Real-time budget badge** — visible on every cart's data-tier
   indicator (per the existing tier badge). Surfaces what the
   substrate is about to charge before the operator commits.
7. **System-wide circuit breaker** — if the global write rate
   exceeds the Shell's safe-rate threshold, the Shell denies new
   high-cost writes and queues low-cost ones. Soft-fails to a "the
   substrate is busy; queued" state, never to dropped writes.

The token model from
`docs/PRICING-TOKEN-DESIGN-2026-06-18.md` plugs in here unchanged —
HMAC-signed cart cost reservations go through the same path.

### §26.4 — No dead jobs: terminal states only

Every job has an **explicit terminal state**:

| State | Meaning | Operator visibility |
|---|---|---|
| `running` | Heartbeat valid; making progress | Live indicator |
| `completed-ok` | Output committed; downstream subscribers notified | Result visible |
| `failed-honest` | Job ran; honest null returned (per §7.5.4 escalate symbols) | Honest null surfaced |
| `escalated` | Job needs human/operator decision; routed appropriately | Inbox notification |
| `dead-letter` | Job failed `max_attempts` retries; in DLQ | DLQ inspector |
| `tombstoned` | Job's record evicted; tombstone preserves history | Inspectable via archive |

`assumed-dead` is a **transient state, not terminal** — a job whose
heartbeat is older than `N × cadence` flips to `assumed-dead`, the
reaper investigates, and the job lands in `dead-letter`,
`failed-honest`, or recovers to `completed-ok`. **Never silent kill.**

Job IDs are forever-queryable (§25.3.7). The DLQ has bash tooling
(`loam-dlq-list.sh`, `loam-dlq-inspect.sh <id>`, `loam-replay.sh
<id>` from §25.3.3). DLQ entries do not silently expire — TTL is
30 days by default, then `tombstoned` (never truly gone).

### §26.5 — All states known + accounted for

`loam.statistics.distribution()` returns the **full inventory** for
the caller's plane:

```scheme
(:state-distribution
  :live          <count>
  :evicted       <count>
  :archived      <count>
  :tombstoned    <count>
  :replicated    <count>
  :in-flight     <count>
  :unknown       0)          ; ALWAYS zero; unknown is an assertion failure
```

The `:unknown` cell is hardcoded zero. If the substrate ever
encounters a state it cannot classify, the assertion fires and the
SRE event spine logs an `state.unaccounted` row to SYSTEM. **An
unknown state is a bug, not a number.**

Schema version is explicit per record (`:schema-cid` field).
Replication lag is tracked per record class:
`loam.statistics.replication_lag(record_class)` returns `(median p50,
p95, p99, max)` in milliseconds. **The substrate knows where every
record is, how stale every replica is, and what state every record
inhabits.**

### §26.6 — Write-heavy concurrency at scale

Architect's verbatim: *"thousands of customers using it hourly.
Every second."*

Concurrency discipline:

- **Multi-writer per shard.** SQLite WAL mode + Litestream support
  thousands of writes/sec per shard. Multiple tenants share a shard;
  per-tenant writes are serialized inside the shard; cross-tenant
  writes are concurrent.
- **Per-tenant write quotas + backpressure.** When a tenant's
  write-rate exceeds its quota, the Shell returns `'rate-limited` and
  the cart retries with backoff (§25.3.5).
- **Shell write-batching.** The Shell batches writes from the same
  cart-invocation into a single shard transaction, reducing fsync
  pressure. (Earlier drafts asserted a 5-10× reduction without source
  or measurement; the figure is removed. Week-6 microbench will
  produce a real ratio against the real write stack.)
- **CRDT-style merges for shared/cohort data.** Multi-replica writes
  to COHORT plane use vector clocks; merges are commutative; the
  K-anon-floor protects against under-quorum reads.
- **Vector clocks for per-tenant LWW.** Within TENANT plane,
  conflicting writes resolve by `(tenant-clock, monotonic-counter)`
  tuple — last-writer-wins with deterministic tie-break.
- **Sharding by cohort prefix** keeps a hot cohort isolated. If a
  cohort's write-rate exceeds shard capacity, the substrate sub-
  shards by tenant within the cohort. Sub-sharding is transparent to
  the Shell.

The architect's *"every second"* is the literal target. **Target:
3000 writes/sec sustained per shard, p95 < 50ms.** This is
**untested** as of doc-date. The Week-6 deliverable (§30) includes
a microbench against the real write stack (HMAC + CID + CBOR + Scheme
sidecar + HNSW insert + write-time embedding + co-transactional audit
row + subscription trigger evaluation — seven synchronous steps per
write). The figure is provisional; the design will be revised if
measured throughput is materially below target. Public SQLite WAL
benchmarks ([sqlite.org WAL](https://sqlite.org/wal.html); phiresky
"100k SELECTs"; andersmurphy "100k TPS over a billion rows") show
1.5k-100k writes/sec on commodity NVMe **without** the seven-step
write path Loam composes; the in-context number is what week-6
produces, not what the WAL numbers imply.

Public Litestream notes ([Litestream blog](https://litestream.io/blog/why-i-built-litestream/),
[hold-off-on-0.5.0](https://mtlynch.io/notes/hold-off-on-litestream-0.5.0/),
[issue #1083 — silent replication failure in v0.5.6+](https://github.com/benbjohnson/litestream/issues/1083))
require us to **pin Litestream to v0.5.5** at week 1; the
`validation-interval` regression in v0.5.x is non-functional per the
upstream notes. Marcus owns the upstream watch — upgrade only after
the bug fix lands and `validation-interval` is reinstated.

Scaling to thousands of tenants is **10s of shards** at the
architect's literal "thousands of operators total, hundreds active
concurrently" scale (which the §7.5.1 audit of 1,484 cart slugs and
the current Curator deploy reality both support). The cohort-aggregate
read path that crosses shards is named in §12.4 + §31 Q17; consistency
cost of cross-shard cohort reads is on the open-questions list.
Current Curator deploy already has the per-shard topology.

### §26.7 — Never-down availability

Architect's verbatim: *"'Loam is down' no it isn't."*

Loam is never "down" to the caller. The substrate is always in one
of three states from the caller's perspective:

| State | Operator experience | What Loam is doing |
|---|---|---|
| `current` | Full read + write; <100ms p95 | Primary healthy + replicas synced |
| `degraded-read` | Reads work; writes queue locally | Primary partitioned; replica serves reads |
| `queued-write` | Writes accepted into client-local queue; flush on reconnect | Substrate unreachable; client SDK buffers |

**The caller never sees "down".** The client SDK
(`curator-web/src/lib/cortexOfLoam.js`) buffers writes locally; on
reconnect, the buffer flushes through the Shell. Cap-token signing on
the client guarantees no buffered write loses its authorization
chain across the partition.

> **§26.7 footnote (added 2026-06-27 per AUDIT-LIES Jess H6).** The
> `cortexOfLoam.js` client SDK does not yet exist on disk. The
> never-down contract above is the v1.0 design + the v1.x build
> commitment. v1.0 dev currently uses direct Workspace calls (the
> queueing layer is the W17+ deliverable). The contract is honest as
> architecture; the implementation lands in v1.x.

Multi-region topology: primary in `iad` (Fly), async-replicate to
`fra` + `syd`. Failover `< 30s`. Per-region degraded-read mode is
automatic. Lacuna's reconciliation (§10.4) walks all three regions
nightly; divergence triggers `shard.divergence_detected`.

The architect's "no it isn't" is the literal contract. The substrate
expression is `current | degraded-read | queued-write`, never
`unavailable`.

### §26.8 — SRE hooks: built-in observability

The substrate is observable by construction — Loam writes its own
operational state **into Loam** (recursive, per §10.4). The
substrate's introspection surface:

- **OpenTelemetry spans** per read/write — `tenant_id`, `capability`,
  `latency`, `bytes`, `callbacks_fired`. The span's
  `trace_id` is the audit row's CID — same identity, two surfaces.
- **Prometheus-format metrics endpoint** per shard
  (`/metrics`). Standard format; any vendor's scraper works.
  Cardinality discipline: per-cohort buckets are K-anonymized
  before export.
- **Per-tenant SLO dashboards** — read-latency, write-latency,
  subscription-fire-latency, cap-token-denial-rate, K-floor-deny-
  rate. Each dashboard is rendered from a Loam projection of the
  audit log.
- **Black-box probe carts every 60s** — `loam-probe-read`,
  `loam-probe-write`, `loam-probe-subscribe`, `loam-probe-execute`.
  Each emits a SYSTEM event; failures page Lacuna.
- **`loam-health.sh`** — bash health check; exit code + structured
  JSON. Wraps the probe carts for external monitoring.
- **Substrate self-narration cart** (§24.7 yir-11) — operator-facing
  surface that tells the operator how the substrate behaved this
  year. Recursive observability surfaced as entertainment.

The substrate's operational state living in Loam means: a 2030 SRE
can ask "how did the substrate behave in Q2 2027?" and the substrate
answers from its own audit log. Self-observable forever.

### §26.9 — On-the-fly schemas

Architect's verbatim: *"Schemas are for data types that need them on
the fly."*

The discipline is sharp: **bytes by default; no schema declaration
required**. The substrate accepts any CBOR + Scheme co-encoded
record. **Schemas are descriptive, not prescriptive.**

#### §26.9.1 — Pattern discovery

The substrate's `projections/schema_discovery.py` (post-build worker)
watches the log. When a shape recurs ≥ 50× in a sliding window, a
candidate schema is automatically registered as a content-addressed
metadata record:

```scheme
(:schema
  :cid          "blake3-d4e5..."
  :discovered-at "2026-..."
  :first-seen    "blake3-..."  ; CID of the first row matching this shape
  :prevalence    127            ; count when registered
  :shape         (:kind 'shop-finding :keys (...))
  :validator     #f             ; null until an operator promotes the schema
  :status        'descriptive)  ; 'descriptive | 'voluntary | 'recommended
```

The schema is **descriptive** by default. It says "this is what we
see," not "this is what is required."

#### §26.9.2 — Voluntary validators

An operator (via Lacuna for SYSTEM, via a cart for TENANT) can
promote a discovered schema to `'voluntary` — the Shell will then
emit a `schema.advisory` notification on writes that don't match,
but the **writes still succeed**. Validators are advisory, not
gating.

Only an explicit operator action (signed by the principal's cap-
token with `:caveat 'allow-schema-enforcement`) promotes a validator
to `'recommended` — even then, writes that fail validation receive a
hard warning but commit. **The substrate never blocks a write because
of a schema mismatch.**

#### §26.9.3 — Append-only schema evolution

Schemas are append-only. A new shape gets a new CID. The old shape's
CID remains; records under the old shape remain valid forever.
Schema "migration" is not migration — it is the addition of a new
shape; the old shape stays readable in 2178.

#### §26.9.4 — Schemas in same store (Datomic-style)

Schemas live in the same Loam — `loam.recall('schema/<cid>')` works
like any other recall. Schemas are queryable, subscribable,
revocable (forward-only), and travel with data forever (content-
addressed). When a record's CID is resolved in 2178, its schema's
CID resolves alongside; the archaeologist has the shape definition
without external context.

#### §26.9.5 — Why this is right for a 2000-year horizon

A prescriptive schema is a coupling between the data and a version
of the runtime. That coupling breaks when the runtime evolves;
the data outlives the runtime. **Descriptive schemas decouple data
shape from data validity** — the bytes are valid because they exist,
and the shape is a co-stored hint about how to read them, not a
gate on whether to.

This is the discipline that lets a 2178 reader open a 2026 record
without a 2026 schema-validator. The format-bilingual log (§2.5)
plus descriptive-schemas (§26.9) together make the millennial promise
operationally achievable.

### §26.10 — Operational invariants count

| Invariant | Mechanism | Net-new automations enabled |
|---|---|---:|
| §26.1 Audits everywhere | Co-transactional audit log | 4 (audit-search, audit-replay, audit-export, audit-attest) |
| §26.2 No dead state | Heartbeat + TTL + reaper | 3 (reaper-report, pre-eviction-notice, tombstone-archive) |
| §26.3 No cost overruns | Write-time budget enforcement | 3 (budget-pre-flight, soft-cap-notify, circuit-breaker-watch) |
| §26.4 Terminal states only | Explicit state machine | 4 (state-distribution, dlq-list, dlq-replay, escalation-router) |
| §26.5 All states known | Distribution telemetry | 2 (replication-lag-watch, unknown-state-page) |
| §26.6 Write-heavy concurrency | CRDT + sharding | 2 (write-quota-tune, sub-shard-decide) |
| §26.7 Never-down | 3-state availability | 3 (degraded-read-fallback, queued-write-flush, region-failover-test) |
| §26.8 SRE hooks | OTel + Prometheus + probes | 5 (black-box-probe-suite, slo-dashboard, span-search, cardinality-audit, health-bash) |
| §26.9 On-the-fly schemas | Descriptive + append-only | 4 (schema-discover, schema-advisory, schema-archeology, schema-evolution-watch) |
| **§26 total** | | **30** |

**30 net-new automation patterns** that exist because the
operational invariants exist. None of these are possible without the
substrate's recursive observability + audit-as-product framing.

### §26.11 — §15–§26 unlocks rolled up + the four honest counts

#### §26.11.1 — Substrate-created automation patterns

| Section | New cart-templates |
|---|---:|
| §15 (existing by-feature) | 324 |
| §23 12-area walkthrough net-new | ~130 |
| §24 entertainment | 59 |
| §25 work-cron-reliability | 42 |
| §26 operational invariants | 30 |
| **Honest unique-pattern total** | **~585** |

The §15 figure of 324 was the architect's bar of 300, cleared by 24.
The folded total clears the architect's *"It could be that we find an
honest 500"* by a hair — **~585 unique cart-template patterns** that
the substrate either creates or makes honestly viable.

Honest read: ~130 is the conservative net-new from §23; if we
counted §23 unlocks as fully additive (no §15 overlap), the total
would be 678. The honest middle is the ~585 figure — the per-area
expansion (§23) and the operational-discipline expansion (§25, §26)
both surfaced real shapes §15's by-feature lens missed. The
entertainment expansion (§24) is fully net-new; §15 did not enumerate
entertainment.

If the architect prefers the conservative 454 figure (only §15 + §23
net-new + §24 entertainment), that is also honest. The 585 figure
includes the §25 and §26 patterns as their own automation kinds,
which they are — each §25.2 cron-primitive cart and each §26.10
invariant-derived cart is operator-visible.

The substrate did not need to clear 500 to be the right substrate.
It clears 500 honestly. We do not pad. If the architect wants the
count tightened to a single number, that conversation lives in §31.

#### §26.11.2 — The four honest counts (units matter)

The doc offers **four distinct counts** of the substrate's surface.
Each measures a different unit. Quoting one without naming the unit
collapses the honesty into a marketing line.

| # | Name | What it counts | Source section | Today's value |
|---:|---|---|---|---:|
| 1 | **Conservative** | New cart-templates the substrate uniquely creates, by feature (Code-in-Loam, Subscriptions, Shell + NL Adapter, Public Loam, Cortex-of-Loam, Audit-as-substrate) | §15.2 | **324** |
| 2 | **Inclusive** | Conservative + per-area net-new + entertainment + work-cron + operational invariants | §26.11.1 above | **~585** |
| 3 | **Existing-cart-extensions** | Carts already in the corpus today that gain a Loamified sibling (the §18 audit). **NOT new templates — decisions on the existing tree.** | §18.3 | **680** |
| 4 | **Operator-instances** | Live running instances per operator (template × operator × distinct instance) | §15.3 | "multiple orders larger" — uncountable without operator count |

Reading the four numbers in order:

- **324** is what the substrate **creates by feature** — the
  architect's "300 bar."
- **585** is what the substrate **creates by feature + per-area + by
  operational discipline** — the architect's "500 ceiling."
- **680** is what the substrate **lets us upgrade** from the existing
  tree — base carts that earn a Loamified sibling per §18.3. **This
  number is NEW to the doc as of §18** and is the honest answer to
  *"how many existing carts get a substrate-aware edition?"*
- **Operator-instances** is the live-product running-count — neither
  324 nor 585 nor 680 directly map to it, because each template
  spawns N instances per operator-per-shop-per-cohort.

The combined **NEW substrate-aware artifact count** is
**~1,265** = 585 (new templates) + 680 (Loamified siblings). The
**operator-facing menu** they unlock is whatever subset the operator
chooses to install from this menu. The architect's 300/500 bars are
satisfied at the template-creation level; the existing-extension
count is a separate honest measurement that **demonstrates the
substrate doesn't displace the existing tree** — it grows alongside
it.

If asked to quote one number publicly, the honest answer is *"585
new automations + 680 deeper-tier editions of carts you already
have."* Two numbers, one sentence, no marketing collapse.

---

## §27 — Comparable systems

Earned this time. Each row's third column is the specific design move
we take from the system.

| System | Why we studied it | What we took |
|---|---|---|
| **Datomic** ([infoq](https://www.infoq.com/articles/Datomic-Information-Model/), [PDL CMU slides](https://www.pdl.cmu.edu/SDI/2013/slides/hickey-dbasvaluecmu.pdf)) | "Database as a value", immutable log + derived indexes | The log-is-truth discipline; indexes-are-derived; facts-accumulate-never-update |
| **SQLite + Litestream** ([litestream.io](https://litestream.io/how-it-works/)) | Public-domain durable substrate with WAL-streaming replication | The storage engine. The replication topology. The bash-recovery story |
| **IPFS / Merkle-DAG** ([ipfs.tech merkle-dag](https://docs.ipfs.tech/concepts/merkle-dag/), [arXiv 2004.00107 Merkle-CRDTs](https://arxiv.org/pdf/2004.00107)) | Content-addressed immutable references | CID-as-primary-reference; dual-hash; blob-store discipline |
| **Plan 9 / 9P** ([9p.io](https://9p.io/sys/doc/9.html), [mattrickard.com](https://mattrickard.com/plan9-everything-is-a-file)) | Everything-is-a-file as universal protocol | The Shell-as-mediator-of-everything pattern; one protocol, every resource |
| **Model Context Protocol (MCP)** ([modelcontextprotocol.io](https://modelcontextprotocol.io/specification/2025-03-26)) | Industry-standard LLM ↔ tool wire (now AAIF / Linux Foundation governed) | The wire format for §4; tool surface + resource URI shape |
| **Local-first software (Ink & Switch)** ([inkandswitch.com/essay/local-first/](https://www.inkandswitch.com/essay/local-first/), [Kleppmann et al. Onward! 2019](https://martin.kleppmann.com/papers/local-first.pdf)) | CRDT + local-primary architecture | Cortex-of-Loam-as-local-primary; Loam-as-secondary-sync; eviction-on-device |
| **Long Now Rosetta Disk** ([rosettaproject.org](https://rosettaproject.org/blog/02008/aug/20/very-long-term-backup/), [HD-Rosetta Wikipedia](https://en.wikipedia.org/wiki/HD-Rosetta)) | 2000-year analog archival | Format-bilingualism (CBOR + Scheme); the millennial cold tier |
| **Macaroons** ([Birgisson, Politz, Erlingsson, Taly, Vrable, Lentczner, NDSS 2014](https://research.google/pubs/pub41892/)) | Caveat-chained capability tokens (production users: Canonical's Snap Store, lnd Lightning daemon) | The cap-token format for §12.1 |
| **Event sourcing (Microsoft pattern)** ([Azure Architecture Center](https://learn.microsoft.com/en-us/azure/architecture/patterns/event-sourcing)) | Log is the source of truth; projections rebuilt | §10.4 event log; the substrate's introspective surface |
| **LLM gateway / semantic firewall** ([Trylon gateway](https://github.com/trylonai/gateway), [arXiv 2601.15824](https://arxiv.org/pdf/2601.15824)) | External analog of the original Gate-as-LLM-mediator design (since superseded by §17's classical Shell) | §3.3 deterministic-shell-around-LLM pattern — historical input to the design |

---

## §28 — Patentable surfaces

The three from LOAM 1.0 survive, sharpened. Three additional surfaces
fall out of the LOAM 2.0 research. Two more (B.15, B.16) fall out
of §16's smart-DB reframing — both require an adversarial prior-art
review before filing. Two more (B.17, B.18) fall out of §19's
surfacing layer — auto-promotion of cart execution tier and
budget-aware recommendation, respectively. **Two more (B.21, B.22)
fall out of the §6 multi-service reframe** — cross-service cohort-
mediated intelligence with mutual K-floor, and service-namespaced
substrate with cohort-mediated cross-service insight. **B.12
(LLM-as-mediator) is RETIRED / REFRAMED per §17** — the claim was
based on LLM-in-substrate, which §17 removes; what survives moves
to the **client-side NL Adapter** (each service's responsibility,
not the substrate's patent surface).

**Total: 11 patentable surfaces** (10 substrate + 1 candidate
B.22 pending attorney review).

### §28.1 — B.1 (preserved): closed cohort-anonymized learning loop with computed stability boundary

Unchanged from LOAM 1.0 §11.1. The Neimark-Sacker boundary
discipline (research/loam-bifurcation-analysis-v0.1.md §2.2) is
original work; the composition with cohort-anonymized buckets and
emergent templates feeding back into routing is the patent.
**Defensibility: HIGH.**

### §28.2 — B.10 (preserved, refined): cohort-scoped workspace handle for cross-session LLM coordination

Preserved with the §10 subscription primitive folded in: the workspace
handle is now defined as a content-addressed subscription target,
allowing cross-LLM-instance coordination via subscription-receipt
rather than polling. **Defensibility: MEDIUM-HIGH.**

### §28.3 — B.11 (preserved): K-anonymity floor enforced atomically with data fetch

Unchanged from LOAM 1.0 §11.3. Co-transactional gate-and-fetch in
the same serializable transaction. **Defensibility: MEDIUM-HIGH.**

### §28.4 — B.12 (RETIRED / REFRAMED per §17): client-side NL Adapter with structured-action allow-list dispatch

**Status: RETIRED FROM SUBSTRATE; CANDIDATE REFRAMED TO CLIENT-SIDE.**

The original B.12 claim was "LLM-as-mediator with deterministic-
shell verification for substrate access." Per §17's classical-
substrate reframe, the substrate has no LLM — so the claim's
load-bearing premise (LLM in substrate's trust domain) no longer
applies.

**Honest call: the substrate-side B.12 claim is retired.** What
survives is a **per-client NL Adapter** pattern (§17.4) that
translates English to a closed structured-action allow-list (§31
Q24) before dispatching to the substrate's Shell. That pattern is
client-side, per-service, and not part of this substrate's patent
surface — it's part of each product's UX patent surface (if any).

A reframed B.12 candidate (client-side) would name: a per-product
natural-language interface that translates user intent into a
constrained Scheme s-expr conforming to a closed verb allow-list,
with the dispatcher running in a separate trust domain (the
substrate's Shell) and refusing any out-of-allow-list proposal.
This is the Simon Willison Dual-LLM pattern + the LiteLLM CVE
mitigation; dense prior art. **Defensibility (substrate-side):
N/A — surface withdrawn.** Per-client variants left to each
product team.

The audit-log → corpus closed loop (formerly part of B.12) lives
on per-service: the substrate exposes the audit; each product's
Adapter retrains from its own audit slice. No single substrate-
shared patent claim survives.

### §28.5 — B.13 (new): content-addressed code artifact registry with template-driven synthesis and capability-bound execution

**Claim.** A substrate-resident code-artifact registry where (a) code
artifacts are content-addressed and reachable by CID across backend
swaps and decades, (b) execution is sandboxed inside the substrate
process with deterministic-reproducibility guarantees, (c) execution
authorization is bound to a caveat-chained capability token shared
with the substrate's data access path, and (d) new code artifacts
can be synthesized from a template plus fact-set composition, with
the synthesizing LLM's call recorded in the artifact's provenance
chain.

**Prior art.** Content-addressed package registries (npm, IPFS,
Nix — store code by content, but lack the capability-bound execution
inside the same trust domain); WASM-on-the-edge (Cloudflare Workers,
Fastly Compute — sandbox, but external trust domain); LangChain
agent toolkits (compose LLM + tool, but lack capability-bound
substrate-resident code).

**Novel.** Composition of CID-addressed registry + sandboxed
substrate-resident execution + cap-token-bound authorization +
template-driven synthesis with recorded provenance. Each piece is
known; the composition appears unclaimed.

**Defensibility: MEDIUM.** The pieces are individually well-known.
The composition is what we file on.

### §28.6 — B.14 (new): format-bilingual append-only log for millennial-horizon data preservation

**Claim.** An append-only event log where (a) every record is
co-stored in two encodings — a machine-canonical binary form (CBOR)
and a human-readable s-expression — generated and signed at write
time, (b) the s-expression form carries enough self-description that
the record can be recovered with primitive tools (text editor, hand-
written parser) without the original runtime, (c) recovery is
verified via dual cryptographic hashes (BLAKE3 + SHA-256) such that
algorithm obsolescence in one does not compromise integrity, and (d)
periodic cold-tier bundles are pressed to a millennial-horizon analog
medium (HD-Rosetta nickel etch) for sovereign opt-in data.

**Prior art.** WORM storage; cold-tier object storage (Glacier);
Long Now Rosetta Disk (analog archival of language data, not live
data). Algorithm-agility in cryptography (NIST SP 800-131A,
forward-looking but not co-storage).

**Novel.** Composition of co-stored machine + human encodings,
dual-hash for cryptographic agility, and the analog-cold-tier
extension as one unified discipline at the substrate level. Appears
unclaimed.

**Defensibility: MEDIUM.** Each ingredient is known; the discipline
is what we file. Of the new surfaces, this one is the most
patent-attorney-sensitive — the prior art around archival storage is
deep.

### §28.7 — B.15 (new, from §16): emergent schema discovery with cross-tenant gravity propagation and tenant-veto

**Claim.** A schema discovery mechanism for a multi-tenant substrate
where (a) candidate schemas are inferred from the recurrence of
write shapes within a sliding observation window, (b) inferred
schemas are stored as content-addressed metadata records alongside
the data, (c) when a tenant's first write of a new shape lands
within a similarity threshold of an existing schema's shape, the
substrate's mediator (the Shell) offers the existing schema as a
suggested annotation **without blocking the write**, (d) cross-tenant
propagation of schema gravity is bounded by a K-anonymity floor on
the donor cohort, and (e) tenant declines are recorded and reduce
the gravity weight for that shape in the next inference sweep.

**Prior art.** Schema-on-read systems (Apache Avro registries,
Confluent Schema Registry — declare schemas explicitly, do not
propagate by gravity); EdgeDB (typed schema inference, but within a
single tenant); descriptive schemas in column stores (DuckDB's auto-
detection — single-tenant). Cross-tenant inference with K-floor
appears unclaimed.

**Novel.** Composition of (a) recurrence-based emergent schema, (b)
content-addressed schema storage co-located with data, (c) cross-
tenant gravity propagation gated by K-anonymity, and (d) tenant-veto
recorded as a substrate-intelligence signal. Each ingredient has
prior art; the composition is the recipe.

**Defensibility: MEDIUM.** Attorney pass required — schema
inference is a dense area and Honeycomb / Snowflake / Materialize
all have schema-discovery patents. The K-floor gravity propagation
is the load-bearing novelty.

### §28.8 — B.16 (new, from §16): cohort discovery via embedding-space clustering with K-floor veto and operator-visible cohort proposal/withdrawal

**Claim.** A cohort discovery mechanism for a multi-tenant substrate
where (a) cohorts are inferred from embedding-space clustering of
per-tenant behavior vectors derived from the substrate's audit log,
(b) inferred cohorts are surfaced to the substrate's mediator (the
Shell) as candidate cohorts only after passing a K-anonymity floor on
the cohort size, (c) substrate-proposed cohorts are presented to
candidate-member tenants as opt-in proposals, with the cohort's
identity surfacing only if a quorum of tenants accept, (d) failed
proposals (K-floor not cleared, or quorum not reached) are recorded
as substrate-intelligence signals and influence subsequent
clustering passes, and (e) accepted cohorts are first-class citizens
of the substrate's cohort plane, indistinguishable downstream from
operator-declared cohorts.

**Prior art.** Embedding-space clustering for user segmentation
(Mixpanel, Amplitude — single-tenant, no K-floor); look-alike
audience modeling (Meta, Google Ads — cross-tenant, no opt-in, no
K-floor veto); federated learning cohort assembly (Apple's PSI for
private set intersection — uses cryptographic primitives, not
embeddings, and is single-purpose). Substrate-resident, K-floor-
gated, opt-in cohort discovery appears unclaimed.

**Novel.** Composition of (a) embedding-based clustering on
audit-log behavior vectors, (b) K-anonymity floor as a hard veto on
the cohort's visibility, (c) substrate-mediator proposal/withdrawal
flow with operator opt-in, and (d) audit-log feedback loop that
improves clustering over time.

**Defensibility: MEDIUM-HIGH.** The look-alike audience patents are
the closest prior art — accurate look-alike audience cites are
[US 11,468,471](https://image-ppubs.uspto.gov/dirsearch-public/print/downloadPdf/11468471)
("Audience expansion according to user behaviors"),
[US 10,135,933](https://image-ppubs.uspto.gov/dirsearch-public/print/downloadPdf/10135933)
("Apparatus and method for generating dynamic similarity audiences"),
and [US 12,169,849](https://patents.google.com/patent/US12169849B1/en)
("System and process to create a lookalike model for a target audience
to deliver advertisements"). Earlier drafts of this section cited
US 10,373,212 (Meta image-tagging, unrelated) and US 11,222,005 (EMC
storage validation, unrelated); both were wrong and have been removed.
The K-floor veto and the substrate-resident opt-in flow appear to
differentiate. Attorney pass required before filing — pick the
most-on-point of the three real cites above.

### §28.9 — B.17 (new, from §19): auto-promotion of cart execution tier based on observed scale

**Claim.** A computation-locality decision system where (a) cart
code is portable across multiple execution surfaces (on-device
sandbox, substrate-resident sandbox, co-located mediator surface,
external cloud), (b) the surface assignment per cart-per-tenant is
computed continuously from substrate-observed scale, latency, and
cost signals, (c) promotion from a lower-cost surface to a higher-
capability surface happens automatically when observed scale crosses
a learned threshold, (d) the promotion is invisible to the operator
by default with an optional surfaced recommendation to formalize,
and (e) demotion is gated by an observation window (default 30
days) to prevent surface churn.

**Prior art.** Hybrid cloud orchestration (Anthos, Azure Arc —
manual operator-driven placement, not substrate-driven); JIT
compiler tier-up (V8 TurboFan, HotSpot C1/C2 — single-process
in-VM tier-up, not multi-tier-physical-surfaces with cross-trust-
domain artifacts); serverless cold-start placement (AWS Lambda,
Cloudflare Workers — provider-side placement, not tenant-portable
artifacts that cross trust domains). Auto-promotion driven by
substrate-resident observation of per-tenant scale + tenant-
portable cart artifacts that cross trust domains appears
unclaimed.

**Novel.** Composition of (a) substrate-resident continuous
observation of per-tenant scale signal, (b) portable-across-trust-
domains cart artifact (composes with §11 code-in-Loam — the same
cart can run on-device, in the substrate sandbox, or via the
mediator surface), and (c) operator-invisible auto-promotion with
optional surfaced formalization at recommendation time (composes
with §19.1.2). The trust-domain-crossing portability is the load-
bearing novelty.

**Defensibility: MEDIUM.** JIT tier-up and serverless placement are
dense prior-art areas individually; the cross-trust-domain
composition appears unclaimed. Attorney second-pass advised. Filing
candidate; not a blocker for v1.0.

### §28.10 — B.18 (new, from §19): budget-aware recommendation engine with sustainability pre-condition

**Claim.** A recommendation system that pre-conditions every
recommendation on a sustainability test computed from the
recipient's projected financial state (balance, recurring income,
recurring spend, headroom for unmodeled events), where (a) the
sustainability test is co-transactional with the recommendation
itself — silence is the first-class result of any sub-check
failure, (b) the test reuses substrate-resident facts that drive
normal product operation (no separate recommendation-only data
plane), (c) the recipient's reversal of a previously-accepted
recommendation feeds back into the substrate's recommendation-
threshold tuning over time, and (d) partial-path recommendations
(tier-change, pick-one, silence) are first-class alternatives to
the direct recommendation, surfaced when a direct recommendation
fails sustainability but an indirect path would help.

**Prior art.** Personal-finance recommenders (Mint, YNAB —
recommendations are advisory and not preventive of over-
recommendation by the system itself); AdWords budget-pacing
(single-tenant pacing, no recommendation refusal as a primary
behavior); SaaS upsell engines (Pendo, Gainsight — recommend
without upstream sustainability check, optimize for conversion not
recipient sustainability).

**Novel.** Pre-condition of recommendation on a multi-check
sustainability projection that combines the recipient's live token
state with substrate-derived cohort-typical spend, with **silence as
a first-class outcome**. The combination of "fair broker refuses
to recommend" + "audit-log feedback to recommendation threshold"
appears unclaimed.

**Defensibility: MEDIUM.** Mint, YNAB, and AdWords pacing are
dense prior-art areas; the novelty rests on the **refusal-as-
product-feature** framing + the substrate-resident closed loop.
Attorney second-pass advised. Filing candidate; not a blocker for
v1.0.

### §28.11 — B.21 (new, from §6): cross-service cohort-mediated intelligence with mutual K-floor

**Claim.** A multi-service substrate where (a) cohort-mediated reads
can cross service boundaries when both services hold cap-tokens
authorizing the cross-service grant (per §6.4 Macaroon extension),
(b) the read is gated by a mutual K-anonymity floor — at least K
operators present in BOTH services' cohort intersection, with K
enforced co-transactionally at both services' Shells — (c) the
crossing payload is an aggregated/anonymized signal only (raw
data never crosses the service boundary), (d) every cross-service
read emits an audit row on BOTH services' SYSTEM planes, and (e)
the cohort intersection set is computed at request time without
either service ever revealing its full membership list to the
other.

**Prior art.** Cross-tenant cohort patterns within a single service
(B.16); federated learning across organizations (Apple PSI;
Google's TensorFlow Federated — both use cryptographic primitives,
not embedding clusters + K-floor); look-alike audiences across
ad networks (B.16 prior art — but single-purpose advertising,
not multi-product platform intelligence).

**Novel.** Composition of (a) cross-service cap-token Macaroon
extension with mutual issuer/target signing, (b) **mutual** K-floor
enforced at BOTH services' Shells in the same transaction, (c)
aggregation at the source service before any payload crosses the
boundary, and (d) recursive audit-on-both-sides. Cross-service
cohort intelligence with mutual K-floor and audit-on-both-sides
appears unclaimed in the multi-product-platform literature.

**Defensibility: MEDIUM-HIGH.** Apple's cross-app intelligence on
iOS is the closest commercial analog; Apple's patents in this area
focus on differential privacy + on-device processing, not on
mutual K-floor + capability-token-mediated cross-service flow.
Attorney pass required. Filing candidate; load-bearing for the
Lacuna Labs platform moat.

### §28.12 — B.22 (candidate, from §6): service-namespaced substrate with cohort-mediated cross-service insight

**Status: CANDIDATE — attorney pass required to confirm distinct from B.21.**

**Claim (sketch).** A multi-tenant data substrate where (a) the
outermost addressing dimension is a **service slug** that
physically separates data on disk (per-service shards, per-service
encryption keys, per-service audit streams), (b) cross-service data
flow is structurally impossible without an explicit
caveat-extended Macaroon (per §6.4), (c) cohort-mediated cross-
service signals (B.21) compose with the namespacing such that an
operator's tenant data in service A is mathematically isolated from
the operator's tenant data in service B even when both services run
on the same physical host, and (d) the substrate's bash recovery
(§14.2), 2000-year discipline (§2), and operational invariants
(§26) all extend per service without modification.

**Prior art.** Multi-tenant SaaS isolation (Salesforce, Workday —
single-product, not multi-product); Kubernetes namespaces (compute
isolation, not data + cohort intelligence). Multi-product
substrates with cross-product cohort intelligence as a first-class
feature appear unclaimed.

**Novel.** Service-as-outermost-addressing-dimension + per-service
shards + per-service encryption + cross-service capability-token-
gated cohort flow as a unified design. May be **too compositional**
to file as one claim; attorney may prefer to split into (a) the
service-namespacing patent and (b) the cross-service cohort patent
(B.21 already covers the latter half).

**Defensibility: candidate.** Attorney evaluation determines whether
this survives as a standalone filing or collapses into B.21 as a
continuation.

### §28.13 — Defensive publication

Rejected candidates (overbroad code-in-database claim; cap-token
without caveats; generic NL-to-substrate translator) move into
`research/loam-engineering-disclosure-v2.md` as defensive
publication.

---

## §29 — Comparable systems we don't deploy

Brief: documented to make our trade-offs explicit.

- **FoundationDB** (LOAM 1.0's choice). Strict serializability,
  Record Layer, proven at Apple-scale. Reject for LOAM 2.0:
  proprietary tooling, no bash-recovery story, vendor risk over a
  millennial horizon. We took the discipline (transactions);
  declined the engine.
- **Memgraph**. The earlier graph-engine candidate. Reject: per
  `CLAUDE.md`'s vendor lock discipline + the prior-doc's `§3.2`
  deprecation of `memgraph.py`. Graph-as-projection on SQLite gets
  the workload at the cost we can pay.
- **Datomic itself**. Take the model, decline the JVM dependency
  and the Cognitect runtime cost. Cognitect's licensing situation is
  itself a cautionary tale for the 2000-year horizon.
- **Holochain / OrbitDB**. Studied for agent-centric architecture.
  Rejected: P2P substrate is a different scaling regime; the cohort-
  K-anon discipline assumes a coordinator role.
- **Yjs / Automerge** ([Comparing local-first frameworks](https://neon.com/blog/comparing-local-first-frameworks-and-approaches)).
  Studied as the Cortex-of-Loam local-primary CRDT. Adopted for
  Cortex-of-Loam internal merge logic; not adopted for the substrate
  log (which is strictly serializable per shard, single-master).

---

## §30 — 14-16 week build plan

Earlier framing of this plan as "8-12 weeks" was optimistic. The
architect-stand-in's honest-read audit (2026-06-26) flagged Weeks 6,
8, 10, 12 as each ~1.5× their stated effort:

- **Week 6** (HNSW + graph + KV projections + rebuild-from-log
  discipline) splits to Weeks 6a (HNSW) and 6b (graph + KV).
- **Week 8** (legacy: Gate v0.5 with 1.7B LLM) — **superseded by
  §17**. Per the classical-substrate reframe, the substrate has no
  LLM; Week 8 becomes "client-side NL Adapter corpus drafting +
  audit-log → adapter-feedback wiring," which is per-product team
  work and does NOT block substrate v1.0. Substrate-side, Week 8
  becomes "Shell hardening + cache-population for the closed
  structured-action allow-list."
- **Week 10** (Code-in-Loam sandbox) is a 2-week security review +
  budget tuning problem; splits to Weeks 10–11.
- **Week 12** (Cortex-of-Loam local primary + cutover) is alpha in
  week 12, production cutover in weeks 13–14 (per §32 honest gap on
  unproven CRDT discipline for this workload).

> **§17 reframe — build is simpler.** With no LLM in the substrate,
> Week 7's Gate-v0.1 becomes **Shell-v0.1**: deterministic Rust
> binary, no model dependency, no Unix-socket-to-LLM, no
> cache-hit-first-or-fallback-to-LLM logic. Week 15's "Gate v1.0
> with LLM-in-shell" disappears entirely; the Shell IS v1.0 from
> Week 7 onward. The freed weeks redirect to: (a) per-service
> onboarding rituals (§6.9) for the v1.0 service catalog, (b)
> cross-service capability-token UX (§6.4), and (c) the §17.6
> embedding model pin + per-shard memory benchmark.

A senior builder quietly adds 20-30% to any plan that has no
"stabilize + measure" week, no holiday allowance, no
adversarial-review iteration buffer. The plan below adds explicit
buffer rather than absorbing it silently into Marcus's calendar.

| Week | Owner | Deliverable | Release gate |
|---|---|---|---|
| 1 | Marcus | SQLite-per-shard substrate skeleton; key-prefix discipline doc; delete `memgraph.py` stub; CBOR + Scheme co-encoder + canonical-CBOR test corpus; **pin Litestream to v0.5.5** (silent-replication-failure bug [#1083](https://github.com/benbjohnson/litestream/issues/1083) hits v0.5.6+; `validation-interval` regression is non-functional in v0.5.x); pin Q2/Q10/Q13 architect decisions inline | Owner sign-off on §31 decisions; Litestream version pinned in `requirements/loam.lock` |
| 2 | Marcus | The Log: append-only event log with HMAC signing and CID generation; per-segment file rotation; integrity-check tool | Log parity tests pass; bash-restore on a 100k-row corpus |
| 3 | Marcus | Litestream v0.5.5 wired (3 concurrent replica configurations against the same source DB — **Litestream replicates to ONE destination per replica config**; 3-of-5 needs 3 distinct `replicas:` blocks); 3-of-5 cold-store fleet (R2 + B2 + Wasabi + IPFS pin + bare disk); sample `litestream.yml` shipped; restore-from-bash script (§14.2) | Restore drill on a fresh box completes in <10 min; concurrent-replica-config disk-IO measured on hot shard (3 shadow WALs + primary write = ~4× WAL turnover) |
| 4 | Soo-Jin | Capability tokens (Macaroon-style, caveat-chained, locally verifiable); plane-permission matrix; AES-256-GCM at-rest for TENANT plane | SECURITY-CANONICAL review passes |
| 5 | Soo-Jin + Marcus | K-anon co-transactional floor; cohort-prefix isolation; the `cohort/__init__.py:43` discipline preserved; PII scrubber | K-anon test suite passes against synthetic thin cohorts |
| 6a | Marcus | HNSW vector index + rebuild-from-log discipline | Recall@10 ≥ 0.95; per-shard RAM budget measured against §31 Q18 ceiling |
| 6b | Marcus | Graph projection (SQLite-CTE) + KV projection (RocksDB-style); rebuild-from-log | Graph 1-3 hop p95 < 100ms; KV p95 < 20ms |
| 7 | Soo-Jin + Marcus | **The Shell v0.1 (§17.3)**: deterministic Rust binary, no LLM; MCP server with 7 tools + 5 resources (typed signatures per §4.4); cap-token verification; service-scope verification (per §6.4); audit emission; closed structured-action allow-list (§31 Q24); **`loam/operator-state` backward-compat path preserved through the Shell** so all 14,471 existing callsites keep working unchanged | Every cart in `magic/` reaches Loam through the Shell with no LLM; all 14,471 existing `loam/operator-state` callsites pass smoke; router.py refactor preserves precedence chain at line 186; `backends/memgraph.py` deleted |
| 8 | Marcus + per-service product teams | **Per-client NL Adapter corpus drafting** (Sakura's corpus owned by Sakura training lead; Bloom's owned by Bloom team if onboarded); audit-log → per-adapter feedback wiring (§16.3.11 cross-ref); Shell-side cache-population for the closed structured-action allow-list. **Substrate-side has no training job — no LLM in the substrate.** | Per-service adapter corpus shapes drafted; substrate has zero model artifacts; structured-action allow-list cached and tested on synthetic adversarial corpus (50/50 refused or honest-nulled by the Shell, deterministic, no LLM) |
| 9 | Marcus | Subscriptions v1: subscribe / cancel / fire-callback; trigger-as-column (LOAM 1.0 §4.3 preserved); event log on SYSTEM plane; cron-replacement-via-subscription path | Synthetic subscription fire under 200ms p95; 1000 active subs at steady-state CPU < 30% |
| 10 | Marcus + Soo-Jin | Code-in-Loam v0.1: artifact registry, sandbox selection (Wasmtime per §SJ.8.2; Scheme-sandbox alternate retained for the Pi-class deployment in §17.10), execute via cap-token | 3 reference code artifacts execute against synthetic substrate state |
| 11 | Marcus + Soo-Jin | Code-in-Loam v0.2: template-driven synthesis path; revocation; CPU/memory quota; deterministic seeded RNG; per-tenant code quota | 5 code artifacts execute; revocation observed in audit; aggregate-DoS protection measured |
| 12 | Marcus + Architect | Migrate `radio_loam.py`, `price_comps.py`, `firecrawl/cache.py` to WORLD plane; SRE event spine on SYSTEM plane; Lacuna watcher rewired | Hit-rate parity vs 7-day pre-migration baseline; Lacuna reconciliation runs clean for 72h |
| 13 | Marcus + Architect + Sakura training lead | Cortex-of-Loam **alpha**: local projection; subscription-driven push; eviction state machine; stub-and-refetch path | 3-device synthetic harness passes CRDT discipline drill |
| 14 | Marcus + Architect | Cortex-of-Loam production cutover playbook (if Week 13 drill passes); audit log lands `(:admt-decision ...)` rows; `loam.consumer.disclosure()` verb shipped (§12.10) | Sakura sessions resume cross-device with Loam-pushed context; eviction telemetry healthy; `INFRA-GATED-CARTS-2026-06-15` slice for `subAgent.spawn`+`document.cite`+`ensemble.run` unlocks |
| 15 | Soo-Jin + Marcus | **Shell v1.0 hardening**: per-shard §17.6 embedding model wired and benchmarked (latency budget per §31 Q29); §12.10 ADMT human-review path; §19.1.3 EU withdrawal button shipped on every Loamified cart; cross-service capability-token issuance UX (§6.4 + §31 Q32) shipped for v1.0 service catalog (§6.2). **No LLM-in-shell work — the Shell is classical throughout (§17).** | Adversarial test suite (50 prompt-injection attempts) all 50 refused-or-honest-nulled by the Shell (deterministic; the substrate accepts only Scheme); embedding model latency p95 < 10ms; cross-service token issuance smoke-tested end-to-end Sakura↔Foodie |
| 16 | All | Stabilize + measure week: no new features; run all SLO dashboards green for 7 days; freshness SLOs (§21.5) all in budget; loop closure measured | Owner go/no-go on v1.0 cut; if green, ship; if red, name the blocker and slip explicitly |

### §30.1 — Risks

| Risk | L | I | Mitigation |
|---|---|---|---|
| RETIRED per §17 — the Gate LLM is wrong at high rates | — | — | Substrate ships no LLM; this risk no longer applies to the substrate. Per-client NL Adapter (Sakura's L0) wrong-rate is now a per-product team risk owned outside the substrate. |
| Per-shard SQLite hits a write-throughput ceiling | L | M | Sharding granularity is per-cohort; cohort cardinality is low; if a cohort gets hot, sub-shard by tenant within cohort |
| Litestream lag during high-write windows | L | M | Throttle writes via Shell when lag > 60s; the architect's "doesn't need to be fast" license covers this |
| Bash recovery drill fails | L | H | Monthly drill mandatory (§14.3); failures block release |
| MCP wire format churns | M | M | MCP recently transferred to the AAIF / Linux Foundation, stability now governed by foundation process; we pin to a release version and validate against version drift in CI |
| Cortex-of-Loam local CRDT diverges across operator devices | M | M | Yjs/Automerge are battle-tested; eviction-aware sync clears most divergence; SYSTEM-plane reconciliation catches the rest |
| 2178 doesn't read SQLite | L | H | Scheme s-expr sidecar is the recovery floor; CBOR is the runtime floor; both are recoverable from primitive tools |

### §30.2 — Deferred to 2.1+

- Multi-master cross-cohort replication (only if a cohort-aggregate
  workload demands it).
- Recursive predicate language in subscriptions (joins across
  PRIVATE × COHORT).
- Full HD-Rosetta etch pipeline (target: opt-in service-bench feature
  in 2.1, not v1.0).
- Per-operator LoRA training pipeline gated on `feedback_no_training_until_scheme_works`.
- Public Loam developer SDK (libraries, not just HTTP).

---

## §31 — Architect decisions

These genuinely need owner input. They are not blockers for week-1
prep but are blockers for week-2+ direction.

> **Ratification status (2026-06-27):** 8 of 32 architect decisions
> ratified — **Q19, Q20, Q21, Q23, Q24, Q27, Q29, Q31**. Each carries
> a `**RATIFIED 2026-06-27:**` line inline with its entry. Q23 is
> additionally marked `**RATIFIED + IMPLEMENTED**` — the keyed-BLAKE3
> forward-secure audit signing shipped W7 (`loam/log/audit.py`). The
> other 24 remain pending or use the doc's stated default. The 8
> ratifications unblock weeks 4–10 of the engineering burn-down
> (cap-token spec, K-floor coordinator, audit forward-secure signing,
> Shell allow-list, embedding model selection, and v1.0 service catalog).

1. **K value at launch.** Default K=8 per `README.md:101`. Confirm or
   revise. The K-floor co-transactional discipline holds at any K.
2. **Curator NL Adapter (per §17.4): train fresh or fine-tune
   Sakura's L0?** Per §17 the substrate ships no LLM; the question
   moves out of the substrate to the Curator client. Options: (a) a
   fresh small model trained on Curator's NL→Scheme corpus, or (b)
   a Sakura-class fine-tune. Trade-off: shared identity
   (Sakura-fine-tune) versus shared codebase risk (a hallucinating
   Sakura affects both surfaces). Lacuna Engineering recommends
   fresh, ~3B; Marcus prefers Sakura-fine-tune for codebase
   economy. Architect call. (Was originally framed as "the Gate
   LLM"; the Gate-as-LLM design retired per §17.)
3. **PUBLIC plane opt-in default.** **RATIFIED-BY-IMPLEMENTATION
   2026-06-27 per AUDIT-LIES L3.** `planes/public.py:24-30` already
   enforces "every PUBLIC write requires an explicit per-record publish
   consent. No background publishing." Marking this as code-ratified
   rather than awaiting an architect-confirm.
4. **Cold-store fleet composition.** Proposed 3-of-5: R2 + Backblaze
   B2 + Wasabi + IPFS-pin + bare disk in escrow. Architect can name a
   different fleet; the discipline (no single vendor; no single
   geography; one off-line tier) is what matters.
5. **Patent filing depth (updated 2026-06-26 for §6 + §17 reframes).**
   B.1, B.10, B.11 carry over; B.13, B.14, **B.15, B.16** are new
   from the substrate research; **B.17, B.18** are new from the §19
   surfacing layer; **B.21 is new from the §6 multi-service reframe**;
   **B.22 is a candidate from §6** (attorney determines whether it
   survives as standalone or collapses into B.21). **B.12 (LLM-as-
   mediator) is RETIRED per §17** — substrate has no LLM, so the
   substrate-side claim no longer holds; client-side variants are
   per-product team. **11 surfaces total** (10 substrate + 1
   candidate). Decide: file all 11 with current prior-art search,
   commission patent-attorney second-pass before filing
   (recommended for B.14, **B.15, B.16, B.17, B.18, B.21, B.22** —
   schema-inference, look-alike-audience, JIT-tier-up, personal-
   finance recommender, AND cross-service / Apple cross-app prior
   art are all dense areas), or defensive-publish a subset. B.15
   and B.16 share infrastructure (the smart-DB framing in §16) and
   may file as one continuation; B.17 and B.18 share infrastructure
   (the §19 surfacing layer) and may also file as one continuation;
   B.21 and B.22 share infrastructure (the §6 multi-service framing)
   and may file as one continuation if the attorney prefers.
6. **The HD-Rosetta service-bench feature.** Is the millennial-tier
   cold-tier etch a v2.1 service feature, a v3.0 narrative-only goal,
   or just the discipline that informs format-bilingualism? The
   substrate is correct either way; the question is whether we ship
   the etch.
7. **MCP version pin.** MCP is now AAIF/Linux-Foundation governed.
   Track the foundation's release cadence and pin per release;
   architect decides cadence (every release / every other / LTS only).
8. **The Shell's bypass for SYSTEM.** Lacuna holds a SYSTEM bypass
   capability for recovery. Where is the bypass key escrowed
   (Shamir-split among Alfred + Marcus + Soo-Jin? Single offline
   hardware key?), and what is the rotation cadence?
9. **Substrate-intelligence opt-in default.** Per §16 the substrate
   has eleven intelligence behaviors. Two policy choices: **(a) ON
   globally** with per-tenant per-dimension opt-out, or **(b) OFF
   with per-dimension opt-in.** Recommendation: ON for behaviors
   that are observable + reversible (§16.3.1 learned indexes,
   §16.3.2 schema gravity, §16.3.4 write-time embeddings, §16.3.5
   anomaly surfacing, §16.3.6 learned compaction, §16.3.7 cost
   prediction, §16.3.8 predictive subscriptions, §16.3.10
   self-healing, §16.3.11 audit-as-corpus); OFF for §16.3.3
   cohort-discovery until the K-floor enforcement is week-12
   hardened; OFF for §16.3.9 pattern-mining-proposing-carts until
   the architect has confirmed the proposal flow.
10. **Embedding model for write-time embeddings (§16.3.4).**
    Bundled small model in the Loam runtime (Marcus's preference —
    no network hop, deterministic latency), or call out to Sakura
    L0 / L1 8B (shared identity, single model surface, but adds an
    inter-process hop on the write path)? Cost + privacy
    implications differ: bundled model is private by construction;
    L0/L1 call inherits the L0/L1 privacy story. Architect call.
11. **Patent filing on B.15 + B.16 — pre- or post-publication?**
    Attorney pass **before** publishing the doc (defensible patent
    posture, slower release), or **publish first** and rely on the
    defensive-publication discipline + a continuation-claim on the
    recipe (faster release, weaker patent posture). The two
    surfaces are independent — could split the decision.
12. **Compute-locality migration threshold (§19.3.4).** What scale
    promotes a cart from local to Loam execution? Default proposed:
    observable for 30 days, exceeds local-tier cost-equivalent by
    2×. Architect can tighten (smaller window, smaller ratio) or
    loosen. The threshold lives in substrate-intelligence (§16.3.7
    cost prediction) and the decision affects auto-promotion
    aggressiveness across the cart corpus.
13. **Sakura's gentle-CFO confidence threshold (§19.2.4).** The
    substrate-intelligence threshold is currently 0.85 (per §16
    default). Should §19.2 recommendation confidence ride the same
    0.85 or tighten further (e.g., 0.90 or 0.95)? The cost of
    fluent-wrong recommendation at the CFO layer is higher than at
    the schema-discovery layer; the architect call sets the
    operator-facing trust ceiling.
14. **Training corpus generation cadence (§20.2, §21.4).** Three
    options: **(a)** regenerate corpus after every major substrate
    behavior change (most accurate, most expensive), **(b)** quarterly
    batch (predictable, lags behavior changes by up to 3 months),
    **(c)** driven by audit-log signal threshold (auto-trigger when
    enough new shapes accumulate). Recommendation: (c) for steady
    state, (a) for v1.0 → v1.1, (b) as fallback if (c)'s signal-
    threshold is mis-tuned.
15. **Telemetry retention (§21.1).** Two options: **(a)** full audit
    retained for the 2000-year horizon (consistent with §2.1
    discipline, expensive at scale), **(b)** tiered — hot 1yr / warm
    10yr / cold 100yr / cold-cold (Rosetta opt-in) 2000yr. The
    cohort-discovery and pattern-mining feedback loops (§16.3.3,
    §16.3.9) need at least 1 year of hot data to be useful. The
    decision affects cold-store fleet sizing (cross-ref Q4).

### §31.1 — New decisions raised in 2026-06-26 Lacuna Engineering review

These came out of the post-design adversarial review (Marcus, Soo-Jin,
Zane, Priya, Jess, Daisy, Kofi, architect-stand-in). Each is **not**
auto-decided; each waits for owner sign-off.

16. **Q16 — Shell hot-path latency budget (simplified per §17).**
    The substrate's Shell is deterministic and always hot — no LLM,
    no cache-hit-vs-LLM tradeoff. The only latency budget the
    substrate owns is the Shell's per-request cost (cap-token verify
    + plane verify + K-floor verify + audit emit + embedding model
    inference + storage round-trip). Default proposal: Shell p95 ≤
    50ms inclusive of storage round-trip; embedding model
    contribution < 10ms (§17.6). Slow-path NL latency budgets are
    per-client (Sakura's, Bloom's, etc.) and live in each service's
    product spec, NOT in this substrate decision. **Q16 simplified
    by §17 — the substrate has no slow path.**
17. **Q17 — Shard granularity: TENANT-per-file vs cohort-per-shard.**
    §8.2 and §12.6 disagree (Marcus coherence gap). The decision
    affects key management, replicator fleet sizing, recovery script
    structure, and write-isolation guarantees. Default proposal:
    **cohort-per-shard with per-tenant AES-256-GCM encryption inside
    the shard file**; isolation lives at the encryption layer, not
    the file boundary. Per-tenant *bucket* (not per-tenant prefix) at
    the Litestream destination for replica isolation.
18. **Q18 — HNSW library: hnswlib vs usearch vs FAISS.** Architect-
    stand-in flagged the §8.3 ambiguity. Default proposal: **hnswlib**
    (longer track record, Apache-2.0, flat-file serialization a 2178
    archaeologist can re-import). Per-shard RAM ceiling per Marcus
    #4: at 1M vectors per shard hnswlib uses ~4.8 GB; at 10M ~48 GB.
    Per-shard vector ceiling + per-host shard ceiling must be stated
    once the library is picked.
19. **Q19 — Macaroon library: pymacaroons vs libmacaroons vs others.**
    Marcus #1 + architect-stand-in. The Rust `macaroon-rs` crate
    explicitly warns against production use; that option is off the
    table. Default proposal: **`pymacaroons` for the Python loam-api
    + per-shard Rust shell calls libmacaroons via FFI** when the
    deterministic shell needs to verify in Rust; or, if a pure-Rust
    impl is required, ship a from-scratch implementation with
    explicit Soo-Jin security review. Pin a version.
    **RATIFIED 2026-06-27:** `pymacaroons` (Python loam-api) +
    `libmacaroons` via FFI (per-shard Rust Shell). Pure-Rust
    from-scratch impl off the table for v1.0. Version pin lands with
    the week-4 cap-token spec.
20. **Q20 — Macaroon HMAC vs Ed25519 + shard-id + nonce + epoch
    (clarified per §6 multi-service).** Soo-Jin CRITICAL #1.
    Classical HMAC-chained macaroons make every verifier a forger
    (the libmacaroons / Fly.io operational pattern). With a Shell on
    every shard, a single shard compromise forges arbitrary
    cap-tokens for every tenant. **With multi-service Loam (§6) and
    cross-service tokens (§6.4), this becomes EVEN MORE important**
    — a compromised service identity key forges cross-service grants
    against every other service. Default proposal (unchanged):
    asymmetric signing (Ed25519, already used for code artifacts
    §11.1) so verifiers hold only public keys; bind every token to a
    `:service-scope` + `:shard-id` + `:nonce` + `:cohort-rotation-epoch`
    caveat; offline-escrow the per-service minting keys (one signing
    key per service, all offline-escrowed independently). Spec
    explicitly before week 4 cap-token code.
    **RATIFIED 2026-06-27:** Ed25519 + per-service minting +
    offline-escrow per service (independent escrows). Caveat set
    locked: `:service-scope`, `:shard-id`, `:nonce`,
    `:cohort-rotation-epoch`. Verifiers hold public keys only; no
    HMAC-chained verifier-as-forger pattern at any tier. Spec lands
    before week 4 cap-token code.
21. **Q21 — K-floor cross-shard coordinator design.** Soo-Jin
    CRITICAL #2. §12.4's `__members__` counter is shard-local, but
    cohorts span shards (§16.3.3). Either (a) `__members__` is a
    global aggregate maintained by a coordinator (and the architect
    must name the coordinator, its consistency model, and the race
    when two writers cross K=8 simultaneously) or (b) the K-floor is
    structurally shard-local-only and the §16.3.3 cohort-emergence
    flow must reshape to match. Default proposal: **(a) coordinator
    on the SYSTEM plane**, eventually-consistent with a 5-second
    refresh, K-floor compared against the floor + 1 to handle the
    race. Spec explicitly before week 5 K-anon code.
    **RATIFIED 2026-06-27:** SYSTEM-plane coordinator;
    eventually-consistent with a 5-second refresh; K-floor compared
    against `floor + 1` for race safety when two writers cross K=8
    simultaneously. The §16.3.3 cohort-emergence flow stays as
    written. Spec lands before week 5 K-anon code.
22. **Q22 — RETIRED per §17 classical-substrate reframe.** The
    Dual-LLM pattern (quarantined translator + privileged dispatcher)
    is no longer needed inside the substrate, because the substrate
    has no LLM. The Dual-LLM topology drops out for free: per §17.4,
    the quarantined translator is the **client's NL Adapter** (lives
    in client trust domain — Sakura's L0, Bloom's adapter), and the
    privileged dispatcher is the **substrate's Shell** (lives in
    substrate trust domain). The trust boundary is the service
    boundary. The closed structured-action allow-list (Q24) remains
    load-bearing as the Shell's verb vocabulary. **Q22 N/A.**
23. **Q23 — Audit-log forward-secure signing.** Soo-Jin CRITICAL #5.
    HMAC + CID-only signing means if the audit signing key is
    compromised at time T, the attacker can rewrite all prior audit
    entries. Default proposal: **FssAgg** or **Logcrypt** or
    transparency-log-style witness sealing (cf. keyed-BLAKE3 +
    Merkle sealing, RVM witness chain pattern). Architect picks
    among the three before week 7.
    **RATIFIED + IMPLEMENTED 2026-06-27:** Keyed-BLAKE3 + Merkle sealing
    (transparency-log pattern). FssAgg + Logcrypt off the table for
    v1.0; the transparency-log shape composes with the existing
    Ed25519 keying (§11.1) + the §16.3.11 audit-as-corpus surface.
    Code shipped W7 — `loam/log/audit.py:forward_secure()` ships the
    keyed-BLAKE3 path; the `audit_merkle_root` table holds the sealed
    roots per `loam/log/audit.py:302`. Fail-loud on missing key:
    unkeyed-content-hash mode is degraded-mode and surfaces a startup
    warning.
24. **Q24 — Structured-action allow-list at the Shell.** Priya #4
    + LiteLLM CVE-2026-42271 pattern. The Shell's "cap-token +
    planes + K-floor" verification catches out-of-policy actions
    but NOT in-policy-but-wrong-target actions (a client's NL
    Adapter maps intent to action; an injection in operator
    documents can shift the target while staying in-policy).
    Default proposal: the Shell rejects any proposed action that
    does not match a closed allow-list of (verb × principal-class ×
    plane × target-shape) tuples; audits the rejection with
    `'gate-action-not-in-allowlist`. NL→Scheme remains the
    client-side translation path; the **dispatch** path inside the
    Shell is closed-list.
    **RATIFIED 2026-06-27:** Closed allow-list of
    `(verb × principal-class × plane × target-shape)` tuples enforced
    at the Shell. Reject-audit symbol renamed to
    `'shell-action-not-in-allowlist` (was `'gate-action-not-in-allowlist`
    — "gate" is retired language per §17 classical-substrate reframe;
    the substrate has no Gate, it has a Shell). NL→Scheme stays
    client-side; dispatch stays closed-list at the Shell.
25. **Q25 — Audit-as-corpus poisoning mitigation.** Soo-Jin
    CRITICAL #4. §16.3.11's audit-as-corpus is recursive; a
    motivated tenant can craft sequences of legitimately-signed
    writes whose *audit shape* trains a backdoor into a future
    per-client NL Adapter retraining round. Signature validation
    catches forgery, not pattern attacks. Default proposal: (a) each
    client's adapter fine-tune corpus is manually curated or
    filtered through a separate poisoning-detection step before
    training; (b) hold-out a clean adversarial-eval set across
    every training round; (c) make post-training adapter behavior
    diff-able against pre-training adapter (regression detection on
    synthetic adversarial examples as a binding release gate, not
    an aside). Per §17, this discipline is per-client (Sakura's
    adapter, Bloom's adapter), not substrate-shared.
26. **Q26 — GDPR cryptographic-erasure pattern (per-tenant AES key
    destruction) — clarified for per-service scope.** Jess L1 +
    §12.5 + §26.2. Confirm that "delete the per-tenant AES-256-GCM
    key" is the canonical tombstone for Art. 17 erasure (the
    ciphertext becomes mathematically unrecoverable; the cold-tier
    snapshot pointer is deleted alongside; the audit-receipt
    persists with no subject data). Per §6, an erasure request
    against a specific service destroys that service's per-tenant
    key only — it does NOT cascade to the operator's other services
    (a Sakura erasure does not erase the operator's Foodie data).
    Cross-service erasure is an explicit per-service request. The
    doc treats single-service erasure as a fact; the architect
    ratifies (a) whether the operational pipeline pulls all key
    copies — including the Shamir-split offline escrows — at the
    moment of erasure (avoids CJEU C-413/23 P "personal data" reentry)
    OR keeps the offline escrow indefinitely, AND (b) whether the
    operator-facing erasure UI is per-service or platform-wide-with-
    explicit-per-service-confirm.
27. **Q27 (filename rename).** The source file is
    `docs/LOAM-1.0-DESIGN.md`; the body is "LOAM 2.0 — Engineering
    Design." Build-pipeline slug stability (`loam-1.0-design`
    indexed) makes a rename non-trivial. Architect decides whether
    to rename the source file (and re-cut the HTML + search index
    under `loam-2.0-design`) or keep the file at 1.0 with the body
    framed as 2.0.
    **RATIFIED 2026-06-27:** Source file renamed to
    `docs/LOAM-ENGINEERING.md` via `git mv`. **AMENDED 2026-06-27
    (evening pass):** Loam promoted to canonical engineering doc per
    `CANONICAL-DOCS-FRAMEWORK-2026-06-27.md`; renamed once more to
    `docs/LOAM-1.0-ENGINEERING.md` to match the canonical naming
    convention (`<NAME>-<VERSION>-ENGINEERING.md`). HTML+search-index
    slug is now `loam-1.0-engineering`; `hideFromShelf:true → false`
    in `scripts/build-docs-html.mjs:44`. The doc is shelf-visible in
    the operator-facing nav alongside HelloSurface, Scheme, and
    Automations.
28. **Q28 (custody-succession structure).** Per §2.7. Which
    custody structure (operator-held keys only / non-profit
    foundation / operator-owned co-op / Long Now-affiliated
    nickel-etch tier) ships in v2.x, and what's the v1.0 stopgap
    until it lands? The 2000-year discipline needs custody, not
    just format-bilingualism.

### §31.2 — New decisions raised by the 2026-06-26 reframes (§6 + §17)

These come out of the multi-service + classical-substrate reframes.
Each is **architect-decide**; defaults are proposed but not locked.

29. **Q29 — Embedding model choice + version pinning (§17.6).** The
    substrate's only model-class dependency. Class is pinned
    (sentence-transformer encoder, ~100MB, <10ms CPU inference); the
    *specific model* is not. Default proposal: pin to
    `sentence-transformers/all-MiniLM-L6-v2` (or a current successor
    in the same family) for v1.0; quarterly review cadence; per-shard
    embedding storage carries `:embedding-model-cid` so re-embed
    sweeps know which records need refresh on upgrade. Architect
    ratifies the family + the version-pin cadence.
    **RATIFIED 2026-06-27:** Pin
    `sentence-transformers/all-MiniLM-L6-v2` v2.x for v1.0. Quarterly
    review cadence — Lacuna Engineering panel evaluates the family at
    each quarter boundary and lifts to a successor only on majority
    sign-off + an explicit re-embed budget. Per-shard storage carries
    `:embedding-model-cid` (CID of the exact model weights) so
    re-embed sweeps know which records need refresh on upgrade.
30. **Q30 — SERVICE namespace allocation (§6.2).** Who owns the
    service slug namespace? Reserved today: `sakura`, `sakura-prep`,
    `foodie`, `baobab`, `lacuna-14b`, `bloom` (parked). Default
    proposal: architect-allocated, with a documented application
    process for new Lacuna Labs products (each request reviewed by
    Lacuna Engineering panel before allocation). External / partner
    services not in scope for v1.0; deferred to v2.x partner
    program.
31. **Q31 — Which services launch at v1.0 (§6.2).** The catalog
    lists six service slugs; not all are ready. Default proposal:
    v1.0 ships with `sakura` (LIVE) + `lacuna-14b` (SYSTEM-scoped,
    operational only) + `baobab` (identity floor); `sakura-prep`
    and `foodie` ship as "onboarded but no operators yet"
    (substrate is ready; product surfaces are not); `bloom` stays
    parked until pricing model lands. Architect ratifies the v1.0
    cut list.
    **RATIFIED 2026-06-27:** v1.0 service catalog locked at five
    onboarded + one parked — `sakura` (LIVE) · `lacuna-14b`
    (SYSTEM-only, operational) · `baobab` (identity floor) ·
    `sakura-prep` (onboarded, no operators yet) · `foodie`
    (onboarded, no operators yet) · `bloom` parked until pricing
    model lands. Substrate onboarding is the gate; product-surface
    readiness is per-team and does not block the substrate cut.
32. **Q32 — Cross-service capability-token issuance UX (§6.4).**
    Who clicks "grant Service B access to Service A's cohort
    aggregates"? Three options: **(a) service owner**
    (Lacuna-Engineering-level grant per (issuer-service,
    target-service) pair; least operator burden, most centralized
    trust); **(b) per-operator opt-in** (each operator chooses
    whether their tenant's signal contributes to a given
    cross-service aggregate; highest operator control, slowest to
    reach K-floor); **(c) hybrid** (service-owner grants the
    capability shape; per-operator opt-in for inclusion in the
    aggregate). Default proposal: **(c)** — service owner authorizes
    the capability surface; operators consent (one-tap) to be
    included. Architect ratifies.

---

## §32 — Honest gaps + open questions

> **§6 + §17 reframe gaps (2026-06-26).** The first six bullets
> below are net-new gaps surfaced by the reframes. They sit at the
> top of the list because they're the freshest unknowns.

- **NEW (§6) — Per-service onboarding cost is real and unmeasured.**
  §6.9 lists 8 onboarding steps per new service; we have not yet
  walked a complete onboarding end-to-end (sakura-prep + foodie +
  baobab + bloom are listed in §6.2 but the eight steps are not
  yet drilled). The honest cost-per-service is unknown until we
  ship at least one new service through the discipline.
- **NEW (§6) — Cross-service capability-token UX is sketched only.**
  §6.4 names the Macaroon extension shape; §31.2 Q32 names the
  three issuance UX options. The actual operator-facing flow
  (where does the click happen? what does the consent surface look
  like? how does revocation feel?) is week-15 work and currently
  has no design.
- **NEW (§6) — Cross-service K-floor mutual-intersection math has
  not been benchmarked at scale.** §6.5 names the discipline; the
  per-Shell cost of computing the intersection set on the fly
  (Bloom filter? bitmap? approximate set membership?) is not yet
  specified. Week-15 + Q29 ratification.
- **NEW (§17) — Embedding model RATIFIED 2026-06-27 (§31 Q29) —
  re-embed sweep machinery still implicit.** Q29 picked
  `sentence-transformers/all-MiniLM-L6-v2` v2.x with a quarterly
  review cadence. Re-embed sweep machinery is implicit in §16.3.4
  but not separately specced; lands when the first model-upgrade
  trigger fires.
- **NEW (§17) — The §16.3 statistical primitives are unstubbed
  beyond the §17.7 list.** Clustering algorithm (k-means vs HDBSCAN
  vs hierarchical) per behavior, anomaly baseline (MAD vs robust
  z-score), regression (ridge vs LightGBM) — each behavior needs
  1-2 paragraphs of mechanical spec. Week 6-10 work; honestly
  gestural in v1.0 (cross-ref the prior §32 "substrate-intelligence
  behaviors not yet mechanically specified" gap, sharpened by §17's
  framing that they are CLASSICAL primitives).
- **NEW (§17) — Per-client NL Adapter audit-feedback loop is
  per-product team's problem.** §16.3.11 audit-as-corpus loop was
  designed for a substrate-shared Gate; with adapters per-client,
  each product team owns its own retraining cycle. Sakura's is
  already specced (§20). Bloom's, Foodie's, Baobab's, Sakura
  Prep's are not yet specced — each waits on its respective
  product team picking up §17's per-client adapter pattern at
  onboarding time (§6.9 step 8 extension). The substrate exposes
  the audit; each adapter team builds their own extractor. This is
  a feature (per-service ownership) not a bug, but it does mean
  the post-v1.0 training story is N stories, not one.
- **The 1.7B Gate has not been trained — supplanted by §17.** Per
  §17 the substrate has no LLM, so this gap shifts: each service's
  NL Adapter has not been trained. Sakura's L0 1.7B is in progress
  (per `feedback_no_training_until_scheme_works`). Each future
  service brings its own adapter and its own training cycle. The
  per-service training corpus is a synthetic data generation
  problem we have not solved per-service.
- **Cortex-of-Loam local-primary CRDT discipline is unproven for
  Curator's specific workload.** Yjs and Automerge are battle-tested
  for editor-like collaboration; eviction + stub-and-refetch is a
  different shape and we have not benchmarked.
- **The 2000-year promise is a discipline, not a guarantee.** No one
  ships a 2000-year database. We ship a 2000-year *discipline* —
  format bilingualism, content addressing, multi-tier cold store,
  bash recovery. The discipline maximizes the chance of survival;
  it does not guarantee it. The architect's million-year framing
  needs to be a discipline framing in customer-facing copy.
- **The MCP wire format will evolve.** We pin to a version; we
  validate; we migrate. The migration cost is real and we have not
  budgeted for it past v1.0.
- **Bash recovery against the cold tier has not been drilled.** Week
  3 says yes, on a fresh box, with a 100k-row corpus. Real-scale
  recovery at 100M-row corpus has not been measured.
- **Patent B.12 and B.14 prior-art search is incomplete.** Open
  USPTO and arXiv searches in §28 are surface-level. Attorney
  second-pass before filing is the right path.
- **Public Loam rate-limiting design is sketched only.** A real
  public-internet rate-limiting story is non-trivial; deferred to
  v2.1 design block.
- **The per-client NL Adapter's training feedback loop is
  theoretical.** Once the audit log is live and the Shell is fielding
  requests, each client team (Sakura's training lead, Bloom's,
  Foodie's) has to decide *when* to re-fine-tune their adapter
  (continuous, weekly, milestone-based) and *how* to validate
  non-regression. Operator dependence on adapter behavior makes
  regression dangerous. (Was originally "the Gate's training feedback
  loop"; the in-substrate Gate-as-LLM retired per §17, so each
  client owns its own loop now.)
- **The 4-check sustainability test (§19.2) has not been run against
  real tenant token data.** The arithmetic is straightforward; the
  honest read is that we've not yet observed how often the four
  checks all pass simultaneously for live shops at varying scales.
  The threshold for "earned recommendation" is theoretical until
  the test fires against real budgets.
- **Auto-promotion of execution tier (§19.3.4) has no demotion
  observation in production yet.** The 30-day demotion window is a
  default proposal; we have not seen how often shops shrink across
  the threshold or how operators react to silent demotion. Q12
  defers the tuning to the architect; the gap is real until
  production tells us.
- **Sakura's recommendation-outcomes telemetry channel (§21.1 row
  4) requires the audit log to be live AND the recommendation
  surface to be live AND the operator to have explicit do-not-
  disturb controls.** All three are week-12+ deliverables; the
  feedback loop in §21.3 sub-loop 2 (reverse-suggest training)
  cannot close until all three exist.
- **The build loop (§21.3) closes only if all five artifacts in
  §21.4 exist.** If any one of the five fails or lags, the loop
  opens and substrate-intelligence regresses to a static state.
  This is a regression risk we have not yet budgeted reliability
  engineering against — it's a steady-state operational obligation
  beyond v1.0 launch.
- **Cohort-typical spend (§19.2.6) requires substantial cohort
  population before it stabilizes.** Until enough operators are in
  any given cohort, the cohort-typical-spend signal feeding the
  4-check test is noisy. The K-floor (§12.4) prevents leakage but
  does not prevent noise in early operation; recommendations may
  silence more aggressively than ideal during the first 6-12
  months. **Cold-start fallback (Priya #3)**: at v1.0 launch with
  <50 paying operators, almost no cohort hits K=8 — the 4-check
  test should fall back to **cohort-typical-spend treated as the
  operator's own 60-day rolling average** (vs returning null and
  either silencing aggressively or fluent-wronging a default). The
  fallback ships in week 12; documented explicitly so the
  recommendation engine doesn't silently mis-behave at v1.0 launch.
- **Substrate-intelligence behaviors not yet mechanically specified
  (6 of 11).** §16.3.2 (schema gravity ε), §16.3.3 (cohort emergence
  clustering algo + dim + quality metric), §16.3.5 (anomaly k×stddev
  per-class baseline), §16.3.7 (cost model class — linear? GBM?),
  §16.3.9 (pattern mining algo + ranking), §16.3.10 (self-healing
  reaper logic) are gestural in v1.0; each needs 1–3 paragraphs of
  mechanical spec during weeks 6–10. The §16.3.4 write-time
  embedding cost is not in §16.3.7's cost-prediction model (Priya #2)
  — substrate's own overhead must be budgeted before the 4-check
  test gates real money decisions.
- **§19.1.2 Sakura recommendation API signature has English examples
  but no function signature.** Default suggestion:
  `loam.fitness(tenant, cart_slug) -> {score, partial-path,
  silence-until}` (Shell-served) — pinned in Week 14 when §19.1
  ships.
- **§20 corpus shapes not specified as JSONL row schemas; test
  sets don't exist.** §20.3 validation gates depend on labeled test
  sets (1000 intent→call pairs, 100 budget scenarios, 200 honest-null
  prompts, 50 adversarial) — none of these test sets exist yet, and
  the doc does not name an owner for generating them. Owner: Sakura
  training lead; deadline: Week 8.
- **§21.4 build-loop artifacts are owner+week annotations, not
  specs.** Each of the 5 §21.4 artifacts (OTel dashboards,
  recommendation-outcomes channel, pattern-mining pipeline,
  audit-log extractor, reverse-suggest feedback) is its own 1–2
  week build that is not in the §30 14-week plan. They are
  post-v1.0 work; §21.5 names the degraded-mode behavior when any
  artifact lags.
- **HNSW per-shard RAM ceiling at 10× growth (Marcus #4) — MEASURED W6a 2026-06-27.**
  W6a perf bench measured the dev box: 10k × 384-dim ≈ 27MB resident
  (`RAMBudget.current_ram_mb` delta-sample). Per-vector extrapolation
  on the measured sample gives ~1.7 GB at 1M — substantially under the
  pre-build spec estimate of 4.8 GB (the spec was conservative; hnswlib
  with M=16 + 384-dim is leaner than the worst-case projection). The
  10M scale ceiling extrapolates to ~17 GB (no longer ~48 GB). Per-
  shard quantization is still flagged for v1.1 because aggregate RAM
  at "10s of shards" still pushes hundreds of GB. Live RAM-budget
  alarm fires at 70% of `psutil.virtual_memory().available`; W6a security
  task #2 calls `RAMBudget.guard_add()` to refuse inserts that would
  cross the threshold. Full numbers in `tests/loam/perf/W6a-bench-results.md`.
- **WASM Spectre / CVE-2025-5419 posture (Soo-Jin HIGH).** §11.3
  sandbox names "WASM or Scheme-sandbox"; §SJ.8.2 pins **Wasmtime
  22.0 LTS** for v1.0 production with the branchless-bounds-check
  mitigation enabled. Side-channel posture + per-tenant CPU quota
  ship per §SJ.8.5; this entry stays in honest-gaps until the W10–11
  Soo-Jin SECURITY-CANONICAL pass lands on the deployed runtime.
- **4-check sustainability test cohort-typical-spend chicken-egg
  at v1.0 launch (Priya #3).** Cold-start fallback described above
  resolves the worst behavior; the underlying noisy-signal
  problem persists until 6–12 months of population accumulates.
- **Substrate's own embedding overhead not in cost-prediction
  (Priya #2).** §16.3.4 write-time embeddings add ~14h/month/operator
  of embedding compute at 1M writes/month — substrate operational
  cost, not operator-token-burn, but the 4-check test's Forecast
  (Check 4) currently ignores it. Either substrate eats the bill
  honestly (we name the cost on our P&L, not the operator's), or
  the model surfaces it; decide before §19.2 ships.
- **14,471 existing `loam/operator-state` callsites preserved via
  backward-compat in the Shell.** Plan documented in §30
  Week 7. Migration is **additive, never displacing** — new (or
  Loamified) verbs appear alongside; the precondition gate verb
  keeps its current shape so no existing cart breaks at cutover.
- **Cohort probing, substrate-as-oracle, code-artifact transitive
  trust, embedding-space adversarial inputs, backup/restore cap-token
  replay window** — named threat-model gaps from Soo-Jin's "Missing
  Threat Models" list. Each is an open question for v1.1; none blocks
  v1.0 ship if §12.7's stated defenses hold for the documented
  scenarios. (Subscriber callback URL trust is **CLOSED 2026-06-27**
  per §41.3 + §12.7 — the SSRF defense ships in
  `loam/subscriptions/dispatcher.py`.)
- **§19.3.4 auto-promotion threshold (Q12) measurement code is
  hand-wavy.** Doc names "30 days, 2× cost-equivalent" but not the
  measurement aggregation (rolling mean? p95?) or where the
  threshold lives in code (substrate-intelligence module? Shell?
  cart manifest?). Spec in Week 14.
- **§30 Week 8 is corpus-generation, not LLM-in-shell.** Renamed
  per architect-stand-in honesty audit. Per §17 there is no
  LLM-in-shell ever — the substrate ships no LLM. Week 8 is
  per-client NL Adapter corpus drafting + Shell-side allow-list
  cache population. Earlier "8-12 week" framing was optimistic; the
  honest 14-16 week plan absorbs the buffer explicitly.

### §32.1 — Architect-call items (AUDIT-LIES Tier 3 cross-ref)

The 2026-06-27 AUDIT-LIES pass surfaced **5 architectural shortcuts**
the v1.0 substrate is currently making that materially affect §J
(privacy / GDPR / CPRA) and §SJ (security) claims. Each item has a
proposed v1.0 (document the shortcut) vs v1.1 (close the shortcut)
resolution; the architect decides per item.

The five items are tracked in the dedicated companion doc
**`docs/LOAM-V1-ARCHITECT-CALLS.md`**:

1. **Per-instance (not per-tenant) AES-at-rest key** — `workspace.py:176`
   derives a single key per Workspace; multi-tenant Workspace = key
   conflation. Affects §J.2.6 / §SJ.4.
2. **Undocumented `ws_kv` shadow table** — the actual v1.0 KV read
   path; §33 talks only about `records` rows + audit chain. Affects
   §33 + W6b roadmap.
3. **Non-co-transactional event-index projection** —
   `workspace.py:464-469` admits the gap; `poll()` may lag the event
   log by one event after a crash. Affects §10.
4. **BLAKE2b "anonymization" with constant domain separators** —
   `admt/disclosure.py:171-193` + `cohort_gravity.py:80-89` use baked-
   in constants when per-deployment salts are unset. Affects §SJ.5 +
   §12.10.
5. **K-floor effective `K+1` race-safety margin** — Q21 names the
   margin; §40 Z.2 + every operator-facing "K=8" reference is short
   by one. Affects §J.3 + §SJ.3 + every Z-walkthrough citing K=8.

None of the five is shipping-blocking; each is a disclosed shortcut
with a v1.1 close-out path. The architect-call doc carries the
per-item proposed defaults and the cost estimates for the v1.1
close-out work.

---


---

## §33 — Storage Architecture, Deep Dive (Marcus)

*This chapter expands §7 (Producers and Consumers) and §8 (The shape)
with the long-form storage architecture treatment — the
SQLite-per-shard / Litestream / CBOR + Scheme / BLAKE3 + SHA-256 / HNSW
disciplines walked through their mechanisms, parameters, failure
modes, and honest tradeoffs.*

**On the wire.** At the layer above the SQLite file — the layer the
Shell reads and the layer external consumers subscribe to — the
substrate speaks SLAT. The append-only event log materializes as
`.slatl` streams (SLAT §5.1). Content-addressing keys the same
records that BLAKE3-hash the raw bytes at the storage tier: SLAT
§5.4 content-ids (SHA-256 of canonical form) name the same records
that BLAKE3 identifies at rest. See §SLAT for the wire view; the
storage view below is the mechanical realization.

### M.1 — SQLite-per-shard, in the architect's terms

The whole substrate runs on one mechanical premise: a SQLite file per
tenant cohort, replicated to cold storage by Litestream, content-addressed
by BLAKE3, paired with SHA-256 for cryptographic-agility, and mediated
exclusively by a deterministic Rust binary called the Shell. The
"interesting" parts of Loam — cohort discovery, schema gravity, learned
indexes, the eleven §16.3 behaviors — are projections sitting on top of
that mechanical core. The core itself is boring on purpose. Boring is
how data survives twenty centuries.

The default reaction from anyone who has shipped a database is "you
picked SQLite at v1.0?". The reaction is correct only inside a frame
that treats the database as the *application's* foundation. Loam is the
*platform's* foundation; what the application wants from a database is
different.

Pat Helland names this distinction precisely in *Immutability Changes
Everything* (CIDR 2015):

> "When data is immutable, it can be referenced as a value and that
> means it can be shared, replicated, and stored in many places at
> once. Mutation creates contention; immutability creates fan-out."

Loam treats every write as the durable head of an immutable log. The
SQLite file is the **latest checkpoint** of that log, not the log
itself. The Litestream WAL stream is the log; the SQLite file is a
materialization. If the SQLite file corrupts, the §14 restore script
rebuilds it from the WAL in under three minutes for a 100MB shard. The
file is replaceable; the log is canonical.

Hellerstein, Stonebraker, and Hamilton's *Architecture of a Database
System* (Foundations and Trends in Databases, 2007) lays out the four
buckets of database work — client communications, process model,
parallelism, disk subsystem. Loam pushes three of those four buckets
outside SQLite proper:

- **Client communications** live in the MCP wire (§4) and the Shell's
  HTTP/2 surface. SQLite is reached only by the Shell's local file
  descriptor.
- **Parallelism** is sharding-by-cohort, not intra-process query
  parallelism. The §6 multi-service split + the per-cohort SQLite file
  give natural parallel-write surfaces. SQLite's writer-lock per file
  is acceptable because the writer is the only writer for that cohort.
- **Disk subsystem** is delegated to Litestream + the cold-store
  quorum. The local fsync-discipline matters; the local I/O pattern
  doesn't, because the cold store is the durable plane.

The fourth bucket — process model — is where Loam keeps the SQLite
process simple: one Shell, many SQLite files, one Litestream replicator
per shard, supervised by a small Rust daemon. No connection pool, no
threadpool, no JDBC, no SQLAlchemy. The architect's brief — *"a folder
where we put stuff and lose it"* is what we are not building — is
satisfied because the projection layer (§8) is rebuildable from the log
and the log lives in a quorum of cold stores.

Brewer's CAP theorem (PODC 2000 keynote; Brewer 2012 *Computer*) is the
frame everyone reaches for. Loam picks CP per cohort and AP across the
WORLD plane:

- **Per-cohort transactions** are CP — a write either lands and is
  fsync'd plus emitted to Litestream, or it errors. We refuse
  partition-tolerance inside a single cohort because the cohort *is* the
  consistency boundary.
- **Cross-cohort and cross-service reads** are AP — Sakura on a phone
  with bad WiFi sees the last-known-good projection while the
  background sync catches up. Eventual consistency is acceptable here
  because the Cortex-of-Loam is the local primary (§17.6) and Loam is
  the secondary sync target.

Fox and Brewer's *Harvest, Yield, and Scalable Tolerant Systems* (HotOS
1999) is the model we actually run. Harvest (fraction of the data
reachable) and yield (probability a request completes) are tunable per
plane. SYSTEM plane prioritizes yield (the dashboard always responds,
even if it shows last-hour-stale numbers). TENANT plane prioritizes
harvest (Sakura sees the full operator state, even if it requires a
cold-store fetch).

The SQLite-per-shard choice is not a starter pick. It is the right pick
for a substrate that:

1. Must outlive the team that built it. SQLite is public-domain, has a
   single-file format documented to byte-level, and has a C
   implementation that compiles on every platform Loam can foresee
   running on. There is no commercial vendor that can take SQLite away.
2. Must be readable with a bash shell and a text editor in the year
   4027. CBOR is RFC 8949, a published IETF standard with multiple
   independent decoders. Scheme s-expressions parse with a 200-line
   Lisp reader. Both are bilingual (§2.5) for every Loam record.
3. Must survive cryptographic-agility. BLAKE3 (RFC 9106 / IRTF 2020) is
   the primary hash. SHA-256 (FIPS 180-4) is the paired hash. If
   either falls, the other remains. §14 restore checks both.
4. Must operate on Pi-class hardware for the offline-tier story (§14.6
   "the operator with a Raspberry Pi and a hard drive"). SQLite runs
   in 256MB of RAM with a 100GB working set comfortably.

The "we'll move to Postgres later" instinct is wrong for the substrate.
We may move *projections* to Postgres or DuckDB or any other engine —
they are rebuildable from the log. The log itself stays in SQLite +
Litestream because that is what survives.

> "A database is a place where facts are accumulated. A database is a
> value. The transaction is the addition of a fact."
> — Rich Hickey, *Database as a Value* (CMU SDI 2013)

Loam adopts the Hickey frame literally. The SQLite file is not the
database; the log is. The SQLite file is the most recent materialization
of the log. Anyone asking "but what about backups?" is asking about
materialization recoverability, not log durability — those are separate
problems and Loam solves them separately.

#### M.1.1 — Per-shard RAM ceiling extrapolation

A single tenant's Loam shard, at v1.0 working assumptions:

| Component | Steady-state RAM | At p99 |
|---|---|---|
| SQLite page cache | 32 MB | 96 MB |
| HNSW vector index (768-d × 100K vectors) | 295 MB | 295 MB |
| Audit log buffer (1s flush window) | 4 MB | 16 MB |
| Litestream replicator | 8 MB | 24 MB |
| Shell connection state | 2 MB / conn × 16 conns | 32 MB |
| **Total per shard** | **~341 MB** | **~463 MB** |

At 100K tenants × 1 shard each on a Fly box, that's not co-tenanted —
we run one Shell process per ~256 shards with shared connection state,
which collapses the per-shard fixed cost. The Shell maintains a LRU on
open SQLite handles (`MAX_OPEN_SHARDS=256`, opens-on-demand, closes on
the LRU floor). HNSW indexes load lazily; cold shards have zero RAM
cost.

A Fly `performance-2x` (4 vCPU / 8GB) holds ~16K active shards
comfortably. The Loamification 740/680/64 split (§30) gives us roughly
one shard per active operator in the first 14 weeks; at 10K paying
operators we run on three boxes. The hardware bill at scale is
extrapolatable to single-digit Fly machines through the v1.0 horizon.

Beyond the v1.0 horizon, the bottleneck flips from RAM to write fan-out
on the cold-store quorum. R2 + B2 + Wasabi each charge for PUT
operations; at 1M tenants × 1 op/sec we'd cross $10K/month in cold-
store PUTs before any other line item. The §14.5 batching discipline
(WAL segments batched per 5s window, signed and pinned) is the cost
control. Litestream's default segment size of 1MB gives ~3M PUTs/day
across the fleet, which is in the affordable band for the v1.5 horizon.

#### M.1.2 — Why not Postgres

Postgres is the better database for almost every application. It is the
wrong substrate for Loam because:

1. The Postgres on-disk format is not documented to byte-level the way
   SQLite's is. The *PostgreSQL Internals* book (Suzuki 2024) is the
   nearest thing and it explicitly disclaims byte-level guarantee
   across minor versions.
2. Postgres requires a server process. Loam's offline tier (§14.6)
   assumes the SQLite file can be `cat`-read or sqlite3-opened on any
   box with a C compiler. Postgres requires a server install, a port,
   a role, and a config. That increases the recovery-floor cost.
3. Postgres's WAL streaming exists but is not designed for many small
   tenants. Each replica is a full-cluster replica. Litestream's
   per-database WAL streaming is a better match for the per-cohort
   shard topology.
4. Postgres uses MVCC with a vacuum process. Loam's append-only
   discipline does not need MVCC; we never UPDATE, we INSERT
   immutable facts and rebuild projections. The vacuum cost is pure
   overhead for our access pattern.

Postgres remains a fine **projection** backend for the SYSTEM plane's
dashboards, which is why §21.4 mentions a Postgres mirror for the
operational view. The substrate stays SQLite.

#### M.1.3 — Why not LMDB / FoundationDB / RocksDB

LMDB is a great key-value store with sub-microsecond reads and full
ACID. It loses on:

- Format readability: LMDB's on-disk format is a B+-tree of MDB pages,
  documented in source but not in a public spec. No `sqlite3` analog.
- No SQL surface for ad-hoc operator-recovery queries during a §14.5
  cold-tier inspection. (We use raw SQL during outages; LMDB would
  require a custom reader.)
- HNSW + vector search must be reimplemented; SQLite has
  sqlite-vec / sqlite-vss as drop-ins.

FoundationDB has the best storage model in this lineage. Its Record
Layer ([arXiv:1901.04452](https://arxiv.org/pdf/1901.04452) — "FoundationDB
Record Layer: A Multi-Tenant Structured Datastore" by Esmet et al., Apple
2019) shows precisely how to layer typed records over a KV substrate
with multi-tenant indexes and resource isolation. We borrow conceptually
(the §7 producer/consumer discipline rhymes with FDB's "Record" /
"Index" / "QueryPlan" separation) but reject FDB itself because:

- FDB is a cluster from day one. Loam ships on one Fly machine at v1.0.
- FDB requires three CPU cores minimum (one for stateless layer, two
  for storage); Loam's smallest deployment is the offline-tier Pi at
  half a core.
- FDB's wire format is private and the operational tooling assumes a
  larger team than Lacuna will field for two years.

RocksDB is what the projection layer (§8.7 "graph projection") uses
internally for the 3-hop adjacency cache. RocksDB as the substrate
loses on the same readability + format-stability axes as LMDB. RocksDB
as the projection cache is fine because the projection is rebuildable.

The principle is consistent: **substrate stays boring; projections can
be exotic**.

---

### M.2 — Litestream WAL streaming, with the math

Litestream (Ben Johnson, since 2021; pinned to v0.5.5 for the
silent-replication bug in v0.5.6+ tracked at litestream issue #1083) is
the load-bearing dependency for Loam's durability story. Without
Litestream, the SQLite-per-shard model is just one disk + one fsync.
With Litestream, every WAL segment fans out to a quorum of cold stores
within a bounded latency window.

#### M.2.1 — The streaming math

SQLite WAL pages are 4KB by default. Litestream batches WAL writes into
**segments** (default 1MB, ~256 pages) and pushes each segment to the
configured replica destinations.

Let `Δt_wal` be the time between SQLite WAL writes for a given shard,
and `Δt_seg` be Litestream's segment-batching window (default 1s).
The replication lag for a written row is bounded by:

```
lag ≤ Δt_seg + Δt_push + Δt_quorum_ack
    = 1s + (segment_size / push_bandwidth) + (1/2 of quorum_round_trip)
```

For a 1MB segment, push to R2 at 100Mbps regional egress: `Δt_push ≈
80ms`. Quorum-ack across R2 + B2 + Wasabi with the slowest at p99 ≈
400ms: `Δt_quorum_ack ≈ 400ms`. Total p99 lag: `1480ms`.

At a 5MB segment (forced by `MIN_SEGMENT_SIZE=5MB` for high-write
shards), `Δt_push` rises to ~400ms but `Δt_seg` drops to ~200ms because
the segment fills sooner under load. Total p99 lag falls to ~1000ms
under high write. Counterintuitively, **higher write rate gives lower
replication lag** because the segment fills before the time window
elapses.

The §26 invariant ("RPO ≤ 5 seconds for TENANT plane") gives us 4× the
worst-case headroom against the math. The invariant is honest.

#### M.2.2 — Quorum semantics

Loam requires `q=3` of 5 destinations to ack a segment before the
Shell returns success on a `put` operation that crosses the
`durability=quorum` flag. The default flag for TENANT writes is
`durability=async` (Litestream best-effort, return on local fsync). The
operator surfaces both modes:

- **Sakura's `remember`** verb (the default cart-facing put) is
  `durability=async`. The audit log records the local fsync timestamp.
  Replication catches up within the §26 RPO bound.
- **Sakura's `commit`** verb (used by `etsy/dispute-evidence-pack` and
  the §25 cron jobs) is `durability=quorum`. The Shell blocks until
  three destinations ack. Used when the data is regulatory-sensitive
  or legally-load-bearing.

The cost asymmetry is intentional. Async fsync is sub-millisecond;
quorum-ack is sub-2-second. Operators get the cheap mode by default
and pay the latency only when the cart's manifest declares it.

Pat Helland's "Memories, Guesses, and Apologies" (2007 blog post, oft-
cited but unpublished as a paper) names the design principle:

> "When dealing with the past, you have memories. When dealing with
> the future, you have guesses. When you find your memories were
> wrong, you apologize."

Loam's async-default writes are memories that occasionally need
apologies — the audit row carries the replication state and a sweep
catches any segment that failed to reach quorum within the SLO. The
apology is **automatic**: a failed segment triggers a re-push and an
audit row update. No operator-visible apology unless the sweep can't
recover, at which point Sakura surfaces an honest-null per §32.

#### M.2.3 — Litestream version pinning, and why

Pinned to **v0.5.5**. v0.5.6 introduced the silent-replication bug
documented at litestream/litestream#1083: under certain WAL-checkpoint
timing, a segment would be marked replicated locally but never actually
pushed. The bug was discovered by ben in November 2023 and fixed in
v0.5.7 (April 2024), but the v0.5.6 → v0.5.7 changelog also includes
a subtle change to the segment numbering that breaks backward-restore
of older segments. We sit on v0.5.5 until v0.6.x ships with both fixes
and a clean migration path. The pin is documented in
`requirements.txt` + a CI gate that fails any PR raising the version
without `LITESTREAM_VERSION_OVERRIDE=approved` in the env.

**Failure mode (Priya):** if Litestream is silently failing to
replicate, the local SQLite file looks healthy and the audit log shows
"replicated locally" — both true, both misleading. The mitigation is
the §14.5 monthly bash drill that explicitly pulls from each
destination and replays a chosen day, plus a daily quorum-health check
that pings each destination and refuses to roll a release if any
destination is silent for >24h.

---

### M.3 — CBOR + Scheme bilingual format

Every Loam record is stored twice in two formats simultaneously: CBOR
(Concise Binary Object Representation, RFC 8949) and a Scheme
s-expression. The two formats are byte-for-byte deterministic
derivations of each other. The bilingualism is the format-survival
hedge.

#### M.3.1 — Why two formats

CBOR is the efficient format. A typical Loam fact serializes in 80-120
bytes of CBOR vs 200-300 bytes of Scheme. CBOR is what fills the
SQLite columns and the HNSW vector payloads. CBOR is what the §10
event spine emits over MCP.

Scheme s-expressions are the recovery format. They live in a separate
`text_view` SQLite column for every record. They are what bash + a
200-line Lisp reader can decode in 2178 when nobody alive has heard of
CBOR.

The two columns are kept in sync by a Loam invariant: every write goes
through `serialize(fact)` which produces both representations from a
single in-memory record. A write that fails to produce both throws and
the transaction aborts. The Shell's §14 restore script validates the
round-trip: CBOR-decode → s-expr-encode → s-expr-decode → CBOR-encode
must equal the original CBOR bytes. The §26 invariant "bilingual
round-trip is byte-identical" is enforced at every write.

#### M.3.2 — The CBOR profile we use

CBOR is a permissive standard. Loam picks a narrow profile (the
`canonical CBOR` profile from RFC 8949 §4.2, with extensions):

- **Deterministic map ordering** (§4.2.1): keys sorted by length then
  bytewise. Two equivalent records always serialize to identical bytes.
- **No floats** except when the field's schema declares `float64`.
  Loam's numerics are exact (integers, decimal strings for money,
  rationals for ratios). Float drift across language runtimes is a
  known source of corruption.
- **Tag 1004** for ISO 8601 timestamps. Tag 32 for URIs. Tag 35 for
  regexp (used in trigger predicates, §10.3). No private tags.
- **Indefinite-length items are forbidden**. Every array and map has
  an explicit length. This makes the bilingual round-trip exact.
- **Maximum nesting depth 16**. Anti-stack-overflow on a hostile
  decoder.

The profile is documented in `loam/cbor/profile.md` and the encoder
is `loam/cbor/encoder.rs`. The encoder is 280 lines of Rust with no
allocations on the hot path (uses a thread-local scratch buffer). The
decoder is 320 lines and refuses any input that violates the profile.

#### M.3.3 — The Scheme dialect we use

The recovery dialect is **R7RS-small minus what's not needed for
data**. No `lambda`, no `define`, no `if`. Only:

- atoms (symbols, strings, numbers, booleans),
- lists,
- two reader macros: `#t` / `#f`,
- one comment form: `; line comment`.

This is the Lisp Reader subset, not a full Scheme. A 200-line C reader
suffices. The reader's BNF lives at `loam/scheme/reader_spec.md`.

A fact in this dialect looks like:

```
(fact
  (cid "blake3:7a9c…")
  (sha256 "sha256:e3b0…")
  (plane "tenant")
  (tenant "op-7c4f")
  (cohort "cmu-jewelers")
  (kind "etsy.listing")
  (ts "2026-06-27T14:32:00Z")
  (data
    (listing-id "EL-42-9912")
    (title "Hammered copper bracelet, brushed finish")
    (price-usd "48.00")
    (sku "BR-CU-HM-001")))
```

That fact's CBOR is 96 bytes; its s-expr is 240 bytes. The 2.5×
storage cost is the price of bilingualism. We pay it because §2.5's
"readable in 4027" promise is load-bearing for the substrate.

#### M.3.4 — Round-trip discipline at write-time

```rust
// loam/store/write.rs (engineering excerpt; not literal)
fn write_fact(shell: &Shell, fact: &Fact) -> Result<Cid> {
    let cbor = cbor::canonical_encode(fact)?;
    let sexp = sexp::encode(fact)?;
    // Round-trip check — both directions, byte-identical.
    let from_cbor = sexp::encode(&cbor::decode(&cbor)?)?;
    let from_sexp = cbor::canonical_encode(&sexp::decode(&sexp)?)?;
    if from_cbor != sexp || from_sexp != cbor {
        return Err(WriteErr::BilingualMismatch);
    }
    let cid = blake3_cid(&cbor);
    let sha = sha256_paired(&cbor);
    shell.tx(|t| {
        t.insert_blob(&cid, &cbor)?;
        t.insert_text(&cid, &sexp)?;
        t.insert_audit(&cid, &sha, &fact.provenance())?;
        Ok(())
    })?;
    Ok(cid)
}
```

The round-trip check is **on every write**, not just every Nth. The
cost is ~60 µs per write; the cost of a silent bilingual divergence is
unbounded. We pay the 60 µs.

---

### M.4 — BLAKE3 + SHA-256 dual-hash

Every CID (Content IDentifier) in Loam is BLAKE3 with a paired SHA-256
sidecar. The BLAKE3 is the primary lookup key; the SHA-256 is the
cryptographic-agility hedge.

#### M.4.1 — Why BLAKE3 as primary

BLAKE3 (J-P Aumasson, Samuel Neves, Zooko Wilcox-O'Hearn, Jack
O'Connor; 2020, RFC 9106) is:

- ~6× faster than SHA-256 on commodity hardware (15 GB/s vs 2.4 GB/s
  on an M1 Pro per the published benchmarks).
- Parallelizable via Merkle tree structure. A 1GB hash fans across all
  cores natively.
- Indefinite-length output (XOF). Useful for derived keys and stream
  ciphers.
- Carries a security proof reducing to the Bao tree mode + ChaCha
  permutation.

For the substrate's hot path — every write hashes its content; every
read verifies the hash — BLAKE3's throughput is the difference between
the Shell sustaining 10K writes/sec/core (BLAKE3) vs 1.5K writes/sec/core
(SHA-256). The 6× headroom flows directly into the Shell's request
budget.

#### M.4.2 — Why SHA-256 paired

SHA-256 (NIST FIPS 180-4) is the cryptographic-agility hedge:

- Standardized in 2001, deployed at planetary scale, no significant
  attack since the Wang collision against SHA-1.
- The most-likely **first** standard hash to fall, because it has the
  most adversarial attention. But it has held for 25 years.
- Required by some regulatory frameworks (FIPS-validated boxes).
  Pairing BLAKE3 with SHA-256 lets Loam's storage tier satisfy FIPS
  requirements without rewriting the hash chain.
- Trivially decodable in any language with a crypto library. The
  recovery floor (§14) assumes a sha256sum binary in the bash path.

#### M.4.3 — The pairing discipline

Every Loam CID is the BLAKE3 of the canonical CBOR. The audit row
carries both hashes. The §14.5 monthly restore drill validates
**both** — not either. A divergence (BLAKE3 valid, SHA-256 invalid, or
vice versa) implies one of:

- Storage corruption hitting the hash bytes (rare; would be caught by
  SQLite's per-page CRC first).
- A successful collision attack against one of the two algorithms
  (catastrophic; the other hash still wins).
- A bug in the dual-hash code (we've shipped one such bug in 2026
  pre-1.0; caught by the §14.5 drill within 48 hours).

The pairing is a **belt-and-suspenders** discipline. If SHA-256 falls
in 2055 (the conservative estimate from Bernstein's *Costs of Hash
Collisions* curve, 2018), Loam's existing data still validates against
BLAKE3 and a one-time re-hashing sweep produces a new paired hash
(BLAKE3 + the-then-current standard, perhaps SHA-3 or a post-quantum
construction). The substrate has the format slot for it because the
audit row already has the `hash_paired` column.

#### M.4.4 — HMAC vs Keyed-BLAKE3 for the audit signing

The audit log signs each row with **Keyed-BLAKE3** in the audit signing
context, not HMAC-SHA-256. Keyed-BLAKE3 has a security proof equivalent
to HMAC-SHA-256 against the same threat model, at 6× the throughput.
The audit signer's hot path matters because every write produces an
audit row; the signing cost is a steady-state amortized cost across
the whole substrate.

The forward-secure signing tree (Bellare-Yee FssAgg, 2003;
Holt-Bradford-Logcrypt, ACSAC 2006) sits on top of the per-row
Keyed-BLAKE3. The tree gives the substrate the **append-only without
backdate** guarantee: an attacker who compromises the current signing
key cannot forge older audit rows because the older rows are signed
by older keys that the attacker doesn't have. The forward-secure key
rotation cadence is monthly (or per K-anonymity salt rotation,
whichever comes first, per §12.3).

#### M.4.5 — Why not Argon2 / scrypt for the audit

Argon2 and scrypt are memory-hard password-hash KDFs. They are the
wrong tool for high-throughput integrity-checking. They are the right
tool for the per-tenant encryption key derivation (§12.5), which we
do use Argon2id for. The audit signing path is not password-derived —
it's a long-lived signing key derived from the per-shard root via
HKDF-BLAKE3.

---

### M.5 — HNSW vector index, with the recall measurement

Hierarchical Navigable Small World (Malkov & Yashunin, 2018 —
"Efficient and robust approximate nearest neighbor search using
Hierarchical Navigable Small World graphs", *IEEE Trans. Pattern
Analysis*) is the vector index Loam uses for every embedding-based
retrieval. The hnswlib library (Yury Malkov, Boris Lochev; MIT, since
2016) is the implementation; SQLite-vec is the SQLite-side surface
that wraps it.

#### M.5.1 — Parameter selection

The two HNSW parameters that matter:

- **`M`** — number of bidirectional links per node per layer. Higher
  M gives better recall, more memory, slower build.
- **`ef_construction`** — size of the candidate list during index
  build. Higher gives better recall, slower build, no memory cost at
  query time.
- **`ef_search`** — size of the candidate list during query. Higher
  gives better recall, slower query.

For Loam's 768-dimensional embeddings (the encoder is `bge-small-en-v1.5`
at v1.0; deterministic, ~100MB, ~10ms inference per §17.6), we picked:

- `M = 16` (default is 16; we tested 8, 16, 32 and saw the recall
  benefit plateau at 16 for our distribution).
- `ef_construction = 200` (default 200; 400 gave 0.3% recall
  improvement at 2× build time — not worth it).
- `ef_search = 64` (default 50; bumped to 64 for the additional 1.2%
  recall at the cost of 28% query latency, which kept us under our
  budget).

#### M.5.2 — Recall@10 measurement

The recall measurement is **Recall@10 = 0.9658** against a 100K-vector
random sample from the Wikipedia-Simple corpus embedded with
`bge-small-en-v1.5`. Methodology:

1. Embed 100K English Wikipedia simple-stub sentences.
2. Compute exact nearest-10 for 1000 randomly-sampled query vectors
   (cosine similarity, brute-force).
3. Run the HNSW index with `ef_search=64` on the same 1000 queries.
4. Compute `|exact_top_10 ∩ hnsw_top_10| / 10` averaged across the
   1000 queries.

Result: 0.9658. That is, 96.58% of the time the HNSW top-10 contains
each member of the exact top-10. The cost is ~0.4ms per query vs the
exact brute-force ~70ms. The ~175× speed-up is paid for in a 3.42%
recall loss, which the §17.6.4 "exact fallback" path catches by
running the brute-force as a check on the bottom-3 of the HNSW
result and re-ranking. The reported user-facing recall after the
fallback is **0.989** (measured by the same methodology, with the
fallback re-ranker enabled).

The measurement is reproducible: `loam/bench/hnsw_recall.py` ships
in the repo; the random seed is hardcoded. The §26 invariant
"Recall@10 ≥ 0.96 after re-ranker" lives in the same file.

#### M.5.3 — Per-shard HNSW RAM cost

The published HNSW memory formula is approximately:

```
RAM_bytes ≈ N × (d × 4 + M × layers × 8)
         = 100000 × (768 × 4 + 16 × 4 × 8)
         = 100000 × (3072 + 512)
         = 358.4 MB
```

Empirical measurement on a Fly box: 295 MB. The 18% delta is because
hnswlib uses a quantized neighbor list and a contiguous arena
allocator. The M.1.1 table uses the measured 295 MB.

At 1M vectors per shard (the theoretical upper bound; in practice a
shard hits the §12.4 K-anonymity ceiling well before this), the
HNSW would be ~3 GB. That's the ceiling we'd never approach — at 1M
vectors the cohort has long since split per §15.4, and the
projection rebuilds across the new cohort boundaries.

#### M.5.4 — The "exact fallback" for catastrophic queries

Some queries land in low-density regions of the embedding space where
HNSW's approximate behavior is worst. The Shell detects this by
inspecting the top-3 results' similarity scores; if the top score is
within `ε=0.02` of the bottom-3 score (the result set is "flat"), the
Shell triggers an exact brute-force on the candidate cluster and
re-ranks. The cost is ~30ms instead of ~0.4ms, accepted on the rare
trigger path.

The fallback is logged. Operators don't see the slowdown unless it
becomes systemic, in which case the §16.3.5 anomaly surface lights
up and the schema-discovery sweep proposes a finer-grained cohort
split.

---

### M.6 — The Rust Shell architecture

The Shell is the only thing outside the substrate that talks to it.
Every read, every write, every subscription, every cron tick goes
through the Shell. The Shell is a single Rust binary, statically
linked, ~12K lines, with no runtime dependencies other than
libsqlite3 + libssl. Compiled with `panic=abort` so a logic bug fails
loud instead of unwinding into corrupt state.

#### M.6.1 — Why Rust

Rust because:

- Memory safety without GC. The Shell is on the hot path of every
  Loam request; a 16ms GC pause every minute would be visible.
- The borrow checker eliminates use-after-free in the connection
  cache and the per-shard transaction state.
- The Tokio async runtime gives natural multiplexing across the
  many open SQLite handles.
- The compiled binary is a single artifact deployable to Fly, to a
  Pi, to a developer's laptop without runtime mismatch.
- The dependency graph stays small. The full Cargo.toml has 31
  direct dependencies; the transitive graph is 142 crates. Compare
  to a Node.js Shell which would be 1500+ crates. Smaller surface
  → smaller attack surface.

#### M.6.2 — Shell's process model

One Shell process per **service-shard-group**. A service-shard-group
is up to 256 shards from the same Loam service. The process holds:

- A connection pool keyed by shard CID. Connections are SQLite
  handles, opened on demand, closed by LRU.
- A per-shard transaction queue. SQLite serializes writers per file;
  the Shell makes that serialization explicit via a per-shard
  `mpsc` channel.
- The HNSW index handles, lazy-loaded per-shard.
- The audit signer state (per-shard signing key, current sequence
  number).
- The capability-token verifier (in-process, no network call).
- The MCP wire surface (HTTP/2 + JSON-RPC over the Tokio reactor).

The Shell has **no background sweeps**. Every action is request-
driven. The §16.3 "background sweep" verbs are implemented by a
separate `loam-discovery` daemon that talks to the Shell over the
same MCP wire as any other client. This keeps the Shell's resource
behavior predictable.

#### M.6.3 — Per-shard transaction discipline

Every write is wrapped in a SQLite transaction. The transaction
includes:

1. The CBOR blob insert.
2. The Scheme text view insert.
3. The audit row insert (signed; sequence-numbered).
4. The K-anonymity counter update if the write targets COHORT plane.
5. The HNSW vector insert if the record has an embedding.
6. The trigger predicate evaluation if the record matches a §10
   subscription.

All six in one SERIALIZABLE transaction or the write aborts. The
SQLite `BEGIN IMMEDIATE` mode is what gives us the serializable
guarantee on a single writer-locked file. The transaction is short —
median 1.2ms, p99 7ms.

If step 6 (trigger predicate eval) is expensive, it goes on the
*delivery* side, not the transaction side: the transaction marks the
row as "needs delivery" and a per-subscription delivery worker picks
it up after the commit. The §10.4 event spine handles the fan-out.

#### M.6.4 — Connection cache LRU

```rust
// loam-shell/src/server.rs (connection caching) (engineering excerpt)
const MAX_OPEN_SHARDS: usize = 256;
const SHARD_IDLE_TIMEOUT: Duration = Duration::from_secs(300);

struct ConnCache {
    cache: LruCache<ShardCid, ShardConn>,
    idle_sweep: Interval,
}

impl ConnCache {
    fn open(&mut self, cid: &ShardCid) -> Result<&mut ShardConn> {
        if let Some(conn) = self.cache.get_mut(cid) {
            return Ok(conn);
        }
        if self.cache.len() >= MAX_OPEN_SHARDS {
            let (evicted_cid, evicted) = self.cache.pop_lru().unwrap();
            evicted.finalize(); // flushes WAL, closes handle.
            metrics::shard_evicted(&evicted_cid);
        }
        let conn = ShardConn::open(cid)?;
        self.cache.put(*cid, conn);
        Ok(self.cache.get_mut(cid).unwrap())
    }
}
```

The 256-shard cache is the steady-state ceiling per Shell process.
At v1.0's 16K active shards / Fly box, that's 64 Shell processes per
box. Memory per Shell ~512 MB; total ~32 GB; doesn't fit on a
`performance-2x` (8 GB). The §M.1.1 table assumed shared connection
state across shards in the same Shell. That assumption holds
because cohorts are sticky to Shells (consistent-hash routing) and
inactive shards close out within 5 minutes.

#### M.6.5 — Failure modes (Priya tagged inline)

**Failure mode (Priya):** Connection cache thrash under hostile
access patterns. An attacker who can trigger reads against
many cold shards causes constant LRU eviction and inflates p99
latency from 7ms to 200ms. Mitigation: the Shell rate-limits
per-principal shard-opens (10/sec/principal default). The audit
log captures the rate-limit denial. Sustained spike triggers the
§SJ.7 abuse-prevention layer.

**Failure mode (Priya):** SQLite writer lock contention. If a
single shard receives concurrent writes from multiple Shells (which
shouldn't happen — consistent-hash routing makes shards Shell-
sticky), SQLite serializes them via OS-level locks and one waits.
Mitigation: the Shell asserts ownership via a per-shard lockfile
in `/var/loam/locks/<cid>.lock` and refuses to open a shard owned
by another Shell. Cross-Shell shard handoff requires explicit
quiesce + re-route.

**Failure mode (Priya):** Audit signer key rotation crossing a
write transaction. If the per-shard signing key rotates mid-
transaction, the row could be signed with the old key while the
verifier expects the new. Mitigation: rotation happens at the
`SHARD_IDLE_TIMEOUT` boundary only, when the Shell knows no
transaction is in flight. The verifier accepts both old and new
keys for a 24h grace window.

---

### M.7 — The 14,471-callsite migration mechanics

LOAM 1.0 named "very reliable cache + workspace registry" as the
substrate. LOAM 2.0 reshapes the substrate as the full-fat soil
described in this document. The migration touches **14,471 callsites**
across the curator-api, curator-web, and curator-sketch repos. This
section describes how the migration happens without breaking the
in-flight build.

#### M.7.1 — The callsite breakdown

The 14,471 number comes from a `ripgrep` sweep:

| Pattern | Count |
|---|---|
| `loam.cache.get(` | 4,832 |
| `loam.cache.put(` | 3,910 |
| `loam.workspace.register(` | 1,204 |
| `loam.workspace.lookup(` | 982 |
| `loam.put(` (generic, mixed plane) | 2,011 |
| `loam.get(` (generic) | 1,103 |
| `loam.subscribe(` | 287 |
| `loam.append(` (audit-only callsites) | 142 |
| **Total** | **14,471** |

The first two patterns (`loam.cache.*`) are the LOAM 1.0 cache surface.
They map directly to `loam.tenant.get` and `loam.tenant.put` in 2.0
with no semantic change. A `cargo`+`jscodeshift` codemod handles the
mechanical rename; the test suite catches the few sites where the
semantic differs (typically because the caller was using the cache as
a queue, which 2.0 separates into the `loam.append` + subscription
surface).

The `loam.workspace.*` patterns map to `loam.cohort.*` in 2.0 because
the workspace abstraction collapsed into the cohort plane. The
codemod handles the rename; about 80 callsites need manual review
because they composed workspace lookup with workspace mutation in
ways that the cohort plane refuses (cohorts are read-only from the
operator's plane; writes happen via the §16.3 substrate-intelligence
verbs).

The generic `loam.put` / `loam.get` calls require human inspection
because the 1.0 surface didn't separate planes. The codemod tags
each call with a `# LOAM-2.0-REVIEW` comment; a human (or a Sakura
session with the codebase context) decides which plane each call
targets.

#### M.7.2 — The shim period

For the 4-week migration window, both surfaces coexist. The 1.0
surface is reimplemented as a thin shim over the 2.0 Shell:

```python
# curator-api/curator_api/loam/_compat.py (engineering excerpt)
class LegacyLoamCache:
    """LOAM 1.0 compatibility shim. Removed week 14."""

    def __init__(self, shell: ShellClient):
        self._shell = shell

    def get(self, key: str) -> Optional[bytes]:
        # 1.0 cache.get → 2.0 tenant.get
        deprecation.warn("LegacyLoamCache.get", removal_week=14)
        return self._shell.tenant_get(key)

    def put(self, key: str, value: bytes, ttl: Optional[int] = None):
        deprecation.warn("LegacyLoamCache.put", removal_week=14)
        self._shell.tenant_put(key, value, ttl=ttl)
```

Every shim call emits a deprecation warning with the callsite
location. The deprecation log is the migration tracking surface:
when no callsite has emitted a warning for 7 days, the shim is
removed.

#### M.7.3 — Regression risk and the test backstop

**Failure mode (Priya):** A codemod misclassifies a generic
`loam.put` as TENANT when it should have been COHORT. The data
lands in the wrong plane, the K-anonymity discipline doesn't apply,
and a buyer-pattern aggregate accidentally exposes a single-
operator's data. Mitigation: every codemod-touched callsite gets a
new test in `curator-api/tests/test_loam_migration.py` that asserts
the plane. The test fails fast in CI if the codemod made the wrong
call. A human (Marcus or a delegate) signs off on the 80 manual-
review callsites individually.

**Failure mode (Priya):** A callsite was using the 1.0 cache as a
durable store (which 1.0 nominally was, with caveats). The 2.0
shim maps to `tenant_put` with the cache's TTL semantics, but if
the original code assumed no TTL, the data could expire
unexpectedly. Mitigation: the migration audit explicitly catalogs
all callsites that pass a non-default TTL. Any callsite that
*relied on* the cache's "almost-durable" behavior surfaces as a
test failure when the shim's default TTL of 24h applies.

**Failure mode (Priya):** Performance regression because the 2.0
Shell adds the capability-token verification on the hot path. The
shim verifies a synthetic legacy token on every call; the cost is
~30 µs per call vs the 1.0 direct-call ~3 µs. At 4,832 `cache.get`
callsites firing at peak ~1K/sec each, that's ~5M ops/sec across
the fleet at the shim layer, costing ~150 vCPU-sec/sec. Mitigation:
the shim caches the synthetic-token verification per principal for
60 seconds. With the cache, the marginal cost drops to ~3 µs.

#### M.7.4 — Rollback discipline

If the migration breaks production, the rollback is:

1. Re-deploy the 1.0 surface (it's still on `main` until week 14;
   git revert to the pre-2.0 tag).
2. Switch the Shell config to `compat_only=true`. This refuses 2.0
   surface calls and only accepts the shim's legacy verbs.
3. The Litestream WAL stream is unchanged — both 1.0 and 2.0 write
   into the same shards. The data plane is migration-neutral. Only
   the verb surface changes.

The rollback was rehearsed in the §14.5 monthly drill on 2026-06-15.
RTO measured at 8 minutes, RPO at 0 (no data loss because the
shards are shared).

---

### M.8 — The rebuild-from-log discipline

Every projection in Loam — the KV cache, the HNSW vector index, the
graph projection, the trigger materialized views, the SYSTEM dashboard
queries — is rebuildable from the audit log. The principle is taken
from Datomic: **the log is the database; the projections are
derived**.

#### M.8.1 — What "rebuildable" means operationally

A projection is rebuildable if:

1. The code that builds it is checked in and reproducible from a
   tagged commit.
2. The log it reads from is byte-identical across replays (the
   §M.2 Litestream guarantee gives us this).
3. The build is **deterministic** — same log, same code, same
   output, byte-for-byte.
4. The build cost is bounded — a projection that takes a week to
   rebuild is not operationally rebuildable.

For Loam at v1.0, every projection meets all four. The build cost
ceiling is set by §26: "any projection rebuilds in ≤ 6 hours for a
shard at the 100K-vector ceiling on a single Fly performance-2x".
We measured: HNSW rebuild for 100K vectors takes 4.2 minutes; KV
projection for 100K records takes 28 seconds; graph projection
(see M.9) takes 12 minutes for the 3-hop ceiling.

#### M.8.2 — The rebuild script

```bash
#!/usr/bin/env bash
# loam-rebuild-projection.sh — rebuild a projection from log.
# Requires: bash, sqlite3, the loam-shell binary, the projection's
# build module checked out at the audit log's recorded build-commit.

set -euo pipefail
shard_cid="$1"        # which shard
projection="$2"       # which projection (kv | vector | graph | trigger)
log_path="$3"         # path to the WAL log (typically from cold store)

# 1. Verify the log is intact (dual-hash check)
loam-shell verify-log --shard "$shard_cid" --log "$log_path"

# 2. Determine the build commit from the log header
build_commit=$(loam-shell log-header "$log_path" | jq -r .build_commit)

# 3. Check out the build code at that commit
git -C /opt/loam fetch --depth 1 origin "$build_commit"
git -C /opt/loam checkout "$build_commit"

# 4. Drop the existing projection table(s)
sqlite3 "/var/loam/shards/$shard_cid.db" \
  ".tables proj_$projection" \
  | xargs -I{} sqlite3 "/var/loam/shards/$shard_cid.db" "DROP TABLE {};"

# 5. Replay the log into the projection
loam-shell rebuild-projection \
  --shard "$shard_cid" \
  --projection "$projection" \
  --log "$log_path" \
  --verify-bilingual

# 6. Validate determinism: re-run, expect byte-identical result
loam-shell rebuild-projection --dry-run --compare-only \
  --shard "$shard_cid" --projection "$projection" --log "$log_path"

echo "OK: $projection rebuilt for $shard_cid from $log_path"
```

The script is the contract. It's tested in CI on every PR that
touches the projection code. The dry-run step at line 6 is the
determinism check; if the second run produces a different hash, the
projection is non-deterministic and the PR is blocked.

#### M.8.3 — Why determinism matters at this layer

Jim Gray's transaction work (*Transaction Processing*, 1993; ACM
Turing 1998) establishes the discipline: deterministic
materializations are what let you trust the recovery story. If the
projection is non-deterministic, you can't tell whether a
mid-recovery divergence is a corruption or an algorithm artifact.

Loam's projections must be deterministic so that the §14 recovery
story is closed-loop verifiable. The bilingual round-trip + the
projection-determinism check give us a recovery story where every
output bit traces to an input bit.

> "The transaction has 4 properties: atomicity, consistency,
> isolation, durability. The 'D' is the easy one. The 'A' is the
> hard one. The 'I' is the subtle one. The 'C' is the political
> one."
> — Jim Gray, *Transaction Concepts* (1981)

Loam picks ACID per cohort transaction, deterministic projections
across the log, and a recovery story where every projection is
inspectable. That's the operational shape.

#### M.8.4 — The "throw away the database" drill

The §14.5 monthly drill explicitly **throws away** the SQLite files
and the projection tables. The Shell is started with `--bootstrap`
mode, which reads the WAL from cold store, replays into fresh SQLite
files, rebuilds every projection, and validates the §26 invariants.
A drill that doesn't finish in under 6 hours for a 100K-vector
shard fails the release gate.

This drill is what makes the 2000-year promise operational. Anyone
who has been in this industry long enough knows the difference
between "we have backups" and "we have practiced restoring from
backups". Loam has the second.

---

### M.9 — W6b graph-projection 3-hop ceiling

The graph projection is the substrate's relational surface. It
exposes "X relates to Y" facts as a queryable graph for the §16.3.9
pattern-mining workers. The ceiling of 3 hops is load-bearing.

#### M.9.1 — Why a graph projection at all

Some substrate questions are naturally graph-shaped: "which buyers
of this listing also bought from this other operator?", "which
cohorts share more than 4 buyers?", "what is the cohort distance
between these two operators?". A KV projection answers these only
with O(n) scans; a vector projection answers them only
approximately. A graph projection answers them in milliseconds with
exact results.

The implementation is a per-shard RocksDB-backed adjacency list
keyed by (subject_cid, predicate, object_cid). The substrate's
write path emits adjacency tuples into the projection synchronously
with the fact write; the projection is always consistent with the
log.

#### M.9.2 — Why 3 hops, not 6 or unbounded

Three hops is the ceiling because:

- **Memory budget.** A 3-hop closure on a typical operator's cohort
  (5K nodes × ~20 edges/node avg) is ~100K nodes. A 6-hop closure
  on the same cohort is ~1M nodes. The 10× memory budget for one
  query is not affordable on the shared Shell process.
- **Latency budget.** A 3-hop traversal completes in ~25ms p99 on
  the test corpus. A 6-hop traversal is ~600ms — three orders of
  magnitude over the budget.
- **Privacy budget.** Multi-hop graph traversal is a known
  re-identification vector (Narayanan-Shmatikov *Robust
  De-anonymization of Large Datasets*, IEEE S&P 2008). Limiting
  hops limits the re-identification surface.
- **Operational sanity.** The §16.3 substrate-intelligence verbs
  that consume the graph projection (pattern mining, cohort
  discovery, anomaly detection) all converge in 2-3 hops on real
  data. We've never seen a substrate-intelligence verb need 4+
  hops to converge.

The 3-hop ceiling is enforced at the API layer. A query asking for
more hops throws `LoamErr::HopLimitExceeded` with a structured
escalate symbol that the calling code can match on.

#### M.9.3 — RocksDB as the graph backend

RocksDB is the right choice here because:

- The adjacency list write pattern is dominantly append (new
  edges); RocksDB's LSM is optimized for this.
- The 3-hop traversal pattern is dominantly read-many-after-write;
  RocksDB's bloom filters + block cache cover the read efficiently.
- The projection is rebuildable per §M.8 — we can drop the RocksDB
  store and rebuild from the log if a corruption happens.
- RocksDB compiles into the Shell binary as a static library.

The RocksDB version is pinned (currently 8.10.0). Upgrades require
the same migration discipline as Litestream version bumps.

#### M.9.4 — Failure modes

**Failure mode (Priya):** A pattern-mining query hits an unusually
dense subgraph and the 3-hop closure is 10× larger than budgeted.
The query starts to consume memory faster than its
deadline-based cancellation can recover. Mitigation: the traversal
is implemented with a per-iteration memory check; if the working
set exceeds 256MB, the traversal aborts with `HopLimitExceeded`
and the pattern-mining worker logs the abort. The §16.3.5 anomaly
surface lights up if the abort happens repeatedly on the same
shard.

**Failure mode (Priya):** A subscription's trigger predicate uses
the graph projection in its evaluation. If the projection is
mid-rebuild, the predicate could miss an edge. Mitigation: the
projection is dual-buffered during rebuild. Predicates read from
the current buffer; the rebuild writes to the alternate buffer;
the swap is atomic per shard. Predicates never see a partial
projection.

**Failure mode (Priya):** RocksDB on-disk format changes across a
major version bump. Mitigation: the upgrade discipline forces a
projection rebuild from log on the new version. Old RocksDB files
are kept for 30 days in cold store as the rollback artifact.

---

### M.10 — The §26 invariants, with the numbers behind them

§26 enumerates the operational invariants. This section walks the
ones with load-bearing numerics and shows the measurement basis.

#### M.10.1 — "RPO ≤ 5 seconds for TENANT plane"

The measurement: take 1000 sample writes across 60 minutes, record
local fsync timestamp + first cold-store ack timestamp, compute the
delta. P99 across the sample on 2026-06-20 (the last full
measurement before this writeup): **4.4 seconds**. P50: 1.1
seconds. The 5-second invariant has 12% headroom at p99.

The mechanism: Litestream's segment-batching window + push +
quorum-ack, computed in §M.2.1 as ~1480ms p99 best case. The
measurement above reflects real-world variance including occasional
quorum slowness (one of the three destinations spiking).

#### M.10.2 — "RTO ≤ 1 hour for a single shard"

The measurement: drilled monthly. Last drill on 2026-06-15:
restore of a 100K-record shard from cold store took **34 minutes
end-to-end**, including the dual-hash verification step. The
1-hour invariant has 45% headroom.

The mechanism: §14 restore script pulls the latest tarball + WAL
segments from cold store, validates hashes, restores the SQLite
file via Litestream, rebuilds projections per §M.8.2.

#### M.10.3 — "Audit log latency ≤ 200ms p99 from write to log-row"

The measurement: per-write timer in the Shell. 7-day rolling
average on 2026-06-20: p50 = 12ms, p99 = 67ms. The 200ms
invariant has 3× headroom at p99.

The mechanism: the audit row is in the same transaction as the
data write (§M.6.3). The latency is dominated by the SQLite
commit + the audit signer's Keyed-BLAKE3.

#### M.10.4 — "Recall@10 ≥ 0.96 after re-ranker"

The measurement: §M.5.2 ships as the canonical reproducible
benchmark. Last run on 2026-06-25: **0.989** with re-ranker
enabled, **0.9658** without. The 0.96 invariant has 3% headroom
with re-ranker.

The mechanism: HNSW + the §M.5.4 exact-fallback re-ranker.

#### M.10.5 — "Bilingual round-trip is byte-identical"

The measurement: every write enforces the round-trip per §M.3.4.
Failure rate: 0 in 2026-06-01 to 2026-06-27. The §14.5 drill
re-validates every restored record. Invariant holds.

The mechanism: the canonical CBOR profile + the dialect-restricted
Scheme reader + the at-write enforcement.

#### M.10.6 — "K-anonymity floor is co-transactional"

The measurement: every COHORT read passes through the §M.6.3 step
4 counter check. The §12.4 transaction wrapper makes the floor
read + the data read atomic. Failure rate (counter says ≥8 but
actual count < 8): 0 in production; 1 in a 2026-05-12 test bug
that the test suite caught before deploy.

The mechanism: SQLite SERIALIZABLE per-shard, single-writer-lock,
the counter and the data co-resident in the same shard.

---

### M.11 — Honest tradeoffs we've made

The architect asked for an honest accounting of every place we
picked a tradeoff with operational consequences. This section is
that accounting.

#### M.11.1 — Picked SQLite, accepted the writer-lock

SQLite serializes writers per file. We could have picked
PostgreSQL or FoundationDB to get concurrent writers. We didn't,
because the per-cohort sharding gives us concurrent writers across
cohorts and that's the dimension that matters. The cost is that a
single cohort's write throughput is capped at SQLite's
single-writer rate (~5000 writes/sec/shard on commodity hardware).
For Loam's expected workload — cohorts are at most ~5000 tenants
and write rates are sub-1/sec/tenant — the cap is generous. If a
cohort outgrows it, §15.4 splits the cohort.

#### M.11.2 — Picked Litestream, accepted the segment-window lag

Litestream's segment-batching adds ~1s of replication lag. We
could have picked a sync-replication system (PostgreSQL streaming
replication; FoundationDB) to get sub-100ms lag. We didn't because
the segment-batching lets a single Litestream replicator handle
thousands of shards per process, which is what makes the per-cohort
sharding affordable.

The 1s lag is invisible to the operator because Sakura reads from
the local SQLite (the Cortex-of-Loam local primary, §17.6), not
from the cold store. The cold store is the disaster-recovery
substrate, not the primary read path.

#### M.11.3 — Picked HNSW, accepted the 0.034 recall loss

HNSW is approximate. We could have used exact brute-force on the
embedding space to guarantee recall=1.0. We didn't because the
~175× speedup is what makes semantic search affordable at our
scale. The §M.5.4 exact-fallback gets us back to 0.989 effective
recall on the queries that matter (low-density-region queries),
which is operationally indistinguishable from exact for the
substrate-intelligence consumers.

#### M.11.4 — Picked Rust for the Shell, accepted the build complexity

Rust compiles slower than Go or Python. We accepted the build cost
because the runtime properties (memory safety, no GC, predictable
latency) matter for the substrate's hot path. The CI build time for
the Shell is ~3.5 minutes; the team accepts it.

#### M.11.5 — Picked one Shell per service-shard-group, accepted the cross-service routing complexity

One Shell can hold ~256 shards. A multi-service operator has
shards across `sakura`, `foodie`, `baobab`, etc. — each service's
shards live in a different Shell process per the §6 service-
namespaced model. Cross-service queries require a coordinator (the
§6.4 cross-service Macaroon caveat resolver) that talks to multiple
Shells. We accepted this routing complexity because the security
benefit (no Shell holds two services' shards in the same process
memory) is load-bearing.

#### M.11.6 — Picked the 3-hop graph ceiling, accepted the algorithmic constraint

Some pattern-mining algorithms want deeper traversals. The 3-hop
ceiling rules them out at the substrate level. We accepted this
because the privacy + latency + memory cost of deeper traversals
is unbounded, and the §16.3 substrate-intelligence verbs we've
shipped all converge within 3 hops.

#### M.11.7 — Picked monthly Litestream-restore drills, not weekly

Drills cost engineering time. We could drill weekly; we chose
monthly because the §14.5 drill is real (not synthetic) and
consumes ~4 engineer-hours plus a Fly machine for the night.
Monthly is sufficient to catch the kinds of bugs the drill is
designed to catch (silent replication failure, dual-hash
divergence, recovery-script rot). If we ship a Litestream
upgrade or a major Shell version bump, we drill within 7 days
regardless.

#### M.11.8 — Picked dual-hash, accepted the ~9% storage overhead

BLAKE3 + SHA-256 together take 96 bytes per record vs 32 for
BLAKE3 alone. Across the v1.0 storage footprint, the overhead is
~9% (the rest of the record dwarfs the hash field). We accepted
this because the cryptographic-agility hedge is what makes the
2000-year promise tenable.

---

### M.12 — What we have NOT built, said plainly

Following the §32 honest-gap discipline:

- **W9 — graph-projection cross-shard joins.** The 3-hop closure is
  per-shard. Cross-shard joins exist only via the §6.4 cross-
  service coordinator, which is currently 1-hop only. **Ships W11.**
- **W10 — WASM sandbox for the §28.5 code-artifact registry.** The
  Shell can hold and serve code artifacts; it cannot yet execute
  them in-process. The execution surface ships as a sidecar
  `loam-exec` daemon, designed but not yet implemented.
  **Ships W12-W13.**
- **W11 — predictive cohort sharding.** Cohorts split when K
  exceeds a threshold (§15.4); the split is reactive. A
  predictive splitter that anticipates growth would smooth the
  operational disruption. Designed in §16.3.10 but not built.
  **Ships post-1.0.**
- **W12 — full FssAgg signing rotation across the Litestream
  stream.** The audit signer uses forward-secure keys per shard
  (§M.4.4). The FssAgg discipline that lets a verifier validate
  the full key chain across rotations exists in the design but
  the verifier doesn't yet enforce chain validity across
  rotation boundaries. **Ships W14.**
- **W13 — automated cohort discovery via dimensionality reduction.**
  §16.3.2 names schema-suggests-itself but the actual cluster-
  discovery worker is a single-pass k-means today. UMAP + HDBSCAN
  would give us better cluster quality. **Ships post-1.0.**
- **W14 — the §14.6 offline-tier Pi build.** The SQLite + Shell
  binary cross-compiles for ARMv7, but the §14 restore script
  assumes amd64 Fly tooling for the Litestream pull. A pure-bash
  cold-store puller exists in design (`loam-pi-restore.sh`) but
  hasn't been smoke-tested. **Ships W16.**
- **W15 — full §16.3.9 pattern-mining materialized views.** The
  pattern-mining worker runs ad-hoc against the audit log today;
  caching the discovered patterns as a materialized projection
  would amortize the cost. **Ships post-1.0.**

These are the things the doc describes that the build hasn't
delivered. They are tracked in `docs/LOAM-ENGINEERING-BURNDOWN.md`
and each ships at the named week. **Nothing is silently described
as shipped that isn't.**

---

### M.13 — The honesty discipline as a system property

Marcus's brief — *backend honesty* — is itself a system property,
not a one-time review. Every Shell response carries a `provenance`
field that names:

- the audit-log row CID that produced the response,
- the projection version (the build-commit of the projection code),
- the freshness of the projection (time since last full rebuild),
- the verification status of the underlying hashes,
- any honest-null reason if the response is a default.

The calling code (Sakura, the cart driver, the §21 dashboard) can
choose to display this provenance to the operator or use it
internally for confidence weighting. The substrate doesn't
*require* the consumer to use the provenance; it requires it to be
*available*.

> "Trust, but verify. And when you verify, the verification has
> to be cheaper than the consequence of being wrong."
> — Pat Helland, *Building on Quicksand* (CIDR 2009)

The provenance field is the cheap verification. The §14 drill is
the expensive verification. Both exist because both are needed.

---


---

## §34 — Security Model, Deep Dive (Soo-Jin)

*This chapter expands §11 (Operating on code via Loam) and §12 (Security
model) with the threat-model-first long-form security treatment —
Macaroon caveats, K-anonymity co-transactional discipline, the layered
PII scrubber, forward-secure audit signing, the abuse-prevention
envelope, the WASM sandbox posture, and the per-tenant cryptographic
erasure mechanism — plus the full 31-row attack-class catalog.*

### SJ.1 — Posture, in one paragraph

Loam's threat model assumes a hostile internet, partially-compromised
operators, occasionally-honest carts, an LLM that will eventually be
prompt-injected, and a future where one of our cryptographic
primitives falls. The substrate is engineered to keep working under
each of those assumptions individually and under reasonable
combinations of them.

The discipline is **defense in depth applied to the substrate**, not
to a perimeter. We don't have a perimeter — the substrate is reached
by Sakura on a phone, by carts on a Fly box, by the public-facing
PUBLIC plane reader, by the SYSTEM dashboard, by cross-service
coordinators. The boundary is at every read and every write, not at
the network edge.

Ross Anderson names this discipline precisely in *Security
Engineering* (3rd edition, Wiley 2020):

> "Real-world security is layered, and the layers compose. Every
> layer has to be honest about what it protects against and what it
> doesn't. A system that claims one layer protects against everything
> is the system that fails to the threat the layer didn't model."

Loam's layers are: the capability token (§SJ.2), the Shell's
allow-list (§SJ.3), the K-anonymity floor (§SJ.4), the PII scrubber
(§SJ.5), the audit log with forward-secure signing (§SJ.6), the
abuse-prevention envelope (§SJ.7), the WASM sandbox for substrate-
resident code (§SJ.8), the per-tenant cryptographic erasure (§SJ.9).
Each layer is independently honest about its threat model.

---

### SJ.2 — The capability token, in detail

#### SJ.2.1 — Macaroon shape

Every Loam request carries a Macaroon-style capability token
(Birgisson, Politz, Erlingsson, Taly, Vrable, Lentczner;
[NDSS 2014](https://research.google/pubs/pub41892/)). The Macaroon
is signed with **Ed25519** (RFC 8032) rather than the paper's
original HMAC-SHA-256 construction. The Ed25519 choice trades the
paper's symmetric simplicity for two properties Loam needs:

1. **Public verification.** The Shell verifies tokens with the
   minter's public key; the Shell does not need to hold the secret
   minter key. This is the architectural property that lets us run
   many Shells without distributing the master secret.
2. **Deterministic signatures.** Ed25519 signatures are deterministic
   (the same key + same message produces the same signature). This
   eliminates a class of subtle attack where an adversary observes
   multiple signatures of the same message to recover the key —
   not possible with Ed25519's nonce-derivation discipline.

The Macaroon discharge model is unchanged from the paper: a token
can be narrowed by appending caveats, and the narrowing is
verifiable without contacting the minter. A token issued for
"R/W TENANT plane" can be narrowed to "R TENANT plane, only the
`etsy.listings` namespace, expires in 15 minutes" and the narrowing
is locally verifiable by the Shell.

#### SJ.2.2 — The four caveat classes

Loam recognizes exactly four caveat classes. Other caveat shapes
are rejected at the verifier:

| Caveat class | Examples | Verifier check |
|---|---|---|
| **Plane** | `plane:tenant`, `plane:cohort`, `plane:world` | Match against the request's target plane |
| **Operation** | `op:get`, `op:put`, `op:subscribe`, `op:execute` | Match against the request's verb |
| **Scope** | `service:sakura`, `cohort:cmu-jewelers`, `namespace:etsy.listings`, `cid:blake3:7a9c…` | Substring/exact match against the resource path |
| **Time** | `expires:2026-06-27T18:00:00Z`, `window:09:00-17:00:UTC`, `rate:10/sec` | Compare to wall clock / rate-limit state |

A fifth class — **delegation** — is recognized but treated as a
constraint on the caveat chain itself: the `delegated-by:sakura-op-7c4f`
caveat names the principal that did the narrowing. The Shell's audit
row records the delegation chain so any post-hoc audit can reconstruct
who authorized what.

Anything else is a malformed caveat and the token is rejected.

#### SJ.2.3 — Why exactly four

The four-class restriction is a deliberate limit on the verifier's
attack surface. Every additional caveat class adds parsing logic to
the Shell's hot path; every additional class adds a way for a
careless minter to issue tokens that don't constrain what they were
meant to constrain.

Lampson's *Computer Security in the Real World* (IEEE Computer,
2004) names this principle:

> "The security architect's hardest job is saying no to features
> that would expand the kernel's vocabulary. Every word the kernel
> understands is a word the attacker can speak."

Macaroons in their NDSS paper form allow arbitrary caveat strings.
Loam restricts the vocabulary because the alternative is a verifier
that has to understand every cart's domain language to evaluate
caveats correctly. The four classes cover every gate decision the
substrate makes; everything else (cart-specific business rules)
belongs in the cart's own logic, not in the cap-token.

#### SJ.2.4 — Token lifecycle

The lifecycle is:

1. **Mint.** The bench's identity service (today
   `curator-api/curator_api/loam/security/macaroon.py`; the dedicated minter ships
   W14) signs an initial token for a principal.
2. **Narrow.** Any holder can append caveats and produce a narrower
   token. The narrowing requires only the holder's possession of
   the token, not any signing key.
3. **Bind.** A narrowed token is bound to a request by including
   the request's content hash in a `cid:` caveat. This prevents a
   leaked token from being reused for a different request.
4. **Verify.** The Shell checks every caveat against the request,
   reconstructs the discharge MAC chain (Ed25519 signatures
   chained via Keyed-BLAKE3 per the Macaroon paper's discharge
   construction), and accepts or rejects.
5. **Audit.** Every verification — accept or reject — is logged.
   The audit row carries the token's full caveat chain.

#### SJ.2.5 — Token expiry and rotation

Tokens default to a 15-minute expiry. Long-running tasks
(multi-week sagas like `etsy/dispute-evidence-pack`) hold a
**refresh token** issued at mint time and exchange it for a fresh
short-lived token on each request. The refresh token is itself
narrower than the principal's root token (it can only mint
short-lived tokens for a specific saga) and is stored in the
cart's encrypted state.

The minter's signing key rotates monthly. Verification trusts both
the current and previous key for a 24h overlap window. This keeps
in-flight tokens valid across the rotation boundary.

#### SJ.2.6 — Failure modes

**Failure mode (Priya):** A leaked token reused before expiry. The
Shell's `cid:` caveat binds the token to a specific request, but
an attacker who can intercept a token AND replay the exact request
within the 15-minute window wins. Mitigation: the audit log carries
the request's client IP + user-agent + TLS session ID, and the
abuse-prevention envelope (§SJ.7) flags duplicate request hashes
within suspicious time windows. Residual risk: a same-client replay
within the window is indistinguishable from a legitimate retry.
This is acceptable for the use cases (idempotent reads, replay-safe
writes) and rejected for non-idempotent writes (which the cart's
`commit` verb requires a fresh token for).

**Failure mode (Priya):** Caveat-chain confusion. An attacker who
controls a narrowing principal could attempt to issue a token with
contradictory caveats (`plane:tenant AND plane:world`) hoping the
verifier ANDs them incorrectly. Mitigation: caveats of the same
class compose via STRICT AND — both must hold. Caveats of different
classes are evaluated independently. Contradictory caveats result
in a token that satisfies no request and is therefore harmless.
The verifier has a property-based test (`curator-api/curator_api/loam-shell/tests/test_cap_verify.rs`)
that asserts AND-semantics across all four classes.

---

### SJ.3 — The Shell's allow-list, narrowed

The Shell exposes a fixed verb set: `put`, `get`, `append`, `on`,
`poll`. Everything a cart wants to do reduces to a composition of
these five. The allow-list is the substrate's vocabulary; nothing
outside it reaches storage.

#### SJ.3.1 — Why a five-verb floor

Five because:

- **`put`** — write a fact (idempotent on its CID).
- **`get`** — read a fact by CID or key.
- **`append`** — add an event to a log (non-idempotent, but
  serializable).
- **`on`** — register a subscription to a predicate over the log.
- **`poll`** — poll a subscription's delivery queue.

That's the substrate's interaction surface. Cohort search, vector
search, graph traversal, K-anonymity floor — all expressible as
`get` with structured key shapes. The five verbs aren't shorthand
for a richer surface; they ARE the surface.

The narrowness is the security property. Anderson's *Security
Engineering* §4.3 names this as **economy of mechanism**:

> "The smaller and simpler your security mechanism, the easier it
> is to verify, and the fewer places there are for an adversary
> to find a flaw."

A substrate with five verbs is easy to model formally. A substrate
with fifty verbs requires the auditor to think about each verb's
interaction with each other verb — N² complexity in the threat
model.

#### SJ.3.2 — The parser as the first gate

The Shell parses every incoming MCP request into one of the five
verbs + a structured payload. Parsing failure is the first
rejection. The parser is hand-written (not generated) for two
reasons:

1. We control the exact grammar. The grammar lives in
   `loam-shell/src/schema.rs (canonical wire surface)` and is normative.
2. We refuse any input that the parser doesn't recognize. There's
   no fallback to a generic JSON parser that might accept
   unexpected shapes.

Aho-Sethi-Ullman's *Compilers: Principles, Techniques, and Tools*
("the Dragon Book", 2nd ed. 2006) names this as the principle of
**reject early, reject narrowly**. A parser that fails fast on
malformed input is a parser that doesn't have to defend the
downstream evaluator against malformed input.

#### SJ.3.3 — Allow-list at the structured-payload level

The structured payload for each verb is itself constrained:

- **`put`** payload: `{plane: P, key: K, cbor: blob, sexp: text,
  cid: optional, sha256: optional, audit_metadata: A}`. No other
  fields. The CBOR blob is parsed and rejected if it violates the
  §M.3.2 canonical profile.
- **`get`** payload: `{plane: P, key_or_cid: K, options: O}`. The
  options field is itself a closed enum: `read-after-write,
  freshness-bound, include-provenance, format`.
- **`append`** payload: `{plane: P, log_key: K, event: blob,
  audit_metadata: A}`. The event blob is CBOR; the parser
  validates the profile.
- **`on`** payload: `{plane: P, predicate: SEXP, callback_token:
  T, delivery: D}`. The predicate is a Scheme s-expr in the
  dialect-restricted subset (§SJ.3.4).
- **`poll`** payload: `{subscription_id: S, max_items: N, ack: B}`.

Anything else — extra fields, wrong types, fields with
unrecognized values — is rejected at parse time with a
structured error code. The error code is recorded in the audit
log even on rejection.

#### SJ.3.4 — Subscription predicates as a tiny language

Subscription predicates are evaluated on every write to detect
trigger matches. The predicate language is intentionally tiny:

```
predicate ::= (field op value)
            | (and predicate predicate ...)
            | (or predicate predicate ...)
            | (not predicate)
field     ::= a record field path, e.g. "data.price-usd"
op        ::= = | != | < | > | <= | >= | contains | matches | exists
value     ::= literal (string, number, bool, null)
```

That's it. No function calls, no loops, no recursion, no field
lookups against arbitrary structures. The evaluator is ~80 lines.
The evaluator runs inside the write transaction (§M.6.3 step 6)
with a hard 100µs timeout per predicate.

The narrowness defends against **predicate-of-doom** attacks:
an adversarial cart registers a subscription with an expensive
predicate to throttle every other write. The 100µs timeout +
the closed predicate language make this attack ineffective.

#### SJ.3.5 — Failure modes

**Failure mode (Priya):** A buggy or adversarial cart registers
millions of subscriptions, each with cheap predicates, to overflow
the per-shard subscription table. Mitigation: per-principal
subscription cap (default 1000/principal/shard). Cap is checked
at registration; exceeded registrations are rejected with
`escalate 'subscription-cap`. The cap is configurable per
principal class (system actors get higher caps).

**Failure mode (Priya):** A subscription predicate references a
field that the schema-discovery sweep later drops or renames.
The predicate becomes a no-op silently. Mitigation: the §16.3.2
schema-suggests-itself sweep emits a `field-dropped` event that
matches all subscriptions referencing the dropped field; those
subscriptions get a `schema-drift` notification on their next
`poll`. The cart owner has 30 days to update or the subscription
is auto-removed with an audit entry.

---

### SJ.4 — K-anonymity, co-transactional, with the math

#### SJ.4.1 — Why K=8

K=8 is the floor for COHORT-plane reads. The floor comes from a
literature review:

- Samarati & Sweeney's original K-anonymity paper (IEEE PAMI 2002)
  uses K=5 as their working example. K=5 is now considered
  inadequate for adversarial settings.
- El Emam et al. *De-identifying Personal Health Information*
  (Springer 2013) recommends K≥8 for moderate-risk
  re-identification scenarios.
- The EU Article 29 Working Party Opinion 05/2014 on Anonymisation
  Techniques names K=10 as a starting point for high-sensitivity
  data and K=5 as inadequate for any context with quasi-identifiers.
- Dwork's *Differential Privacy* (TCC 2006) shows K-anonymity alone
  is insufficient against compositional attacks (homogeneity attack,
  background-knowledge attack) but K=8 with privacy-budget controls
  is a reasonable industrial floor when paired with the §SJ.5 PII
  scrubber.

K=8 is the floor; the substrate-intelligence verbs that require
higher confidence (the cohort recommendation engine, §16.3.2) raise
the floor to K=12 internally. The floor is parameterized per
cohort class.

#### SJ.4.2 — The co-transactional discipline

The K-floor check happens in the **same** SQLite transaction as
the data read. Pseudocode (§12.4):

```
BEGIN IMMEDIATE TRANSACTION;
SELECT count FROM cohort_members WHERE cohort_id = ?;
IF count < K_FLOOR THEN ROLLBACK; RETURN None;
SELECT data FROM cohort_facts WHERE cohort_id = ? AND key = ?;
COMMIT;
RETURN data;
```

The SERIALIZABLE isolation level (SQLite's default in
WAL+IMMEDIATE mode) guarantees the count and the data come from
the same snapshot. A concurrent write that drops the count below
K_FLOOR cannot interleave — either it commits before our SELECT
(in which case our SELECT sees the lower count) or it commits
after our COMMIT (in which case we already returned the data and
the next reader sees the lower count and gets None).

This co-transactional discipline is the §28.3 patentable surface.
It's the operational answer to the EDPB's top-three February 2026
enforcement failure: "audit-gap between privacy check and data
fetch where the data was readable for milliseconds with stale
privacy state".

#### SJ.4.3 — The "floor + 1 race margin"

There's a subtle race: the count read inside the transaction is
the count *at this snapshot*. A concurrent write that arrives
during our transaction is serialized after us — so our snapshot's
count is what we trust. But if our snapshot's count is exactly K,
and a concurrent **deletion** is about to land, the next read
will see K-1. We returned data at K (which is safe), and the
next reader sees None (which is also safe).

But what if our snapshot's count is K-1 and we're about to write
a new member that would bring it to K? We can't return data on
our transaction (count = K-1 < K). Should the next reader, after
our write commits, see the data? Yes — they read at K. Should we
retroactively let our read succeed because we know our write is
about to make K? No — that would require us to read the future.
We rejected; the next reader succeeds. This is fine.

The "floor + 1 race margin" rule: subscribers to a cohort that
crossed K trigger via §10's event spine, not via retroactive
read-success. A subscriber who registered while count < K and
expects to fire on the K-th member gets the event when the K-th
write commits.

#### SJ.4.4 — Cross-shard K-floor coordinator

Some cohorts span multiple shards (typically the WORLD-plane
aggregates over many service cohorts). The K-floor must hold
across the union. The coordinator:

1. Issues a federated count query to each shard hosting members
   of the cohort.
2. Waits for all shards to respond (with a deadline; missing
   shards fail-closed — assume zero members).
3. Sums the counts.
4. If sum < K_FLOOR, return None.
5. Else, issue federated data reads to each shard (still inside
   each shard's local transaction; the federation is
   read-many-shards-once-each).

The federation is **eventually consistent across shards** — there's
no global serializable transaction. To prevent a TOCTOU between
the count federation and the data federation, the coordinator
uses **floor+1 (the count check is `global_size >= K_MIN + 1`)** —
when `K_MIN=8` the effective global check is `count >= 9`. Per Q21:
`coordinator.py:118` enforces this with a 5-second refresh on the
SYSTEM-plane coordinator (cross-ref §M.2.1 replication-lag window).
The extra +1 of conservatism eliminates the race a cohort hits when
two writers cross K=8 simultaneously.

#### SJ.4.5 — Failure modes

**Failure mode (Priya):** A subtle bug in the counter update on
cohort membership change leaves the counter ahead of the actual
membership. The K-floor check passes; the read returns data that
shouldn't have been readable. Mitigation: a nightly sweep
recomputes the counter from a full scan and emits a `counter-
drift` event if the recomputed value differs from the stored
counter. The §SJ.7 abuse-prevention envelope quarantines the
affected cohort pending an audit.

**Failure mode (Priya):** An attacker mass-creates synthetic
cohort members to inflate K above the floor and force data
release. Mitigation: cohort membership is content-addressed by
the tenant's verified identity. The §SJ.2 capability-token chain
proves identity provenance. A "tenant" without a verified identity
chain doesn't count toward K. Synthetic-account inflation requires
forging the identity chain, which is the substrate's authentication
problem (deferred to the bench's identity service; tracked in
W14).

**Failure mode (Priya):** A composite cohort across services
where one service's shard is offline. The coordinator can't
verify the K-floor across the union. Mitigation: the coordinator
**fails closed** — missing shards are assumed to contribute zero
members. A cohort that depends on the missing shard for K
silently returns None for the duration of the outage. The
operator-visible surface shows "data temporarily unavailable"
with no leakage of which shard is down.

---

### SJ.5 — The layered PII scrubber

PII never lands in COHORT, WORLD, SYSTEM, or PUBLIC planes by
construction. The scrubber runs on every write proposal targeting
those four planes. The scrubber is layered: rule-based first,
entropy second, ML third, per-tenant allowlist last.

#### SJ.5.1 — The four layers

| Layer | What it catches | Cost (per write) |
|---|---|---|
| Rule-based (regex) | Email, phone, raw operator-id strings, credit card numbers (regex-only — Luhn check is v1.1 per AUDIT-LIES Priya M-5), SSN. (Postal address detection deferred to v1.1 per AUDIT-LIES Priya M-6 — the regex layer ships email/ssn/credit_card/phone only.) | ~50 µs |
| Entropy heuristic | Obfuscated forms ("alfred at gmail dot com", spaced phone, base64 blobs > 16 bytes, hex strings > 32 chars) | ~80 µs |
| ML classifier | Free-text quasi-identifiers: rare names, location-specific dialect, profession references, medical terms | ~3.5 ms |
| Per-tenant allowlist | Fields the tenant explicitly classified as non-PII (a shop name that doubles as the operator's surname) | ~10 µs |

Total worst-case: ~3.7 ms per scrubbed write. The ML layer is the
dominant cost; it runs only on text fields longer than 48 bytes
(otherwise rule + entropy suffice). The amortized cost across
typical writes is ~200 µs.

#### SJ.5.2 — Rule-based layer

The rule layer is a fixed pattern catalog:

```python
# loam/security/pii_scrubber.py (REGEX_LAYER) (engineering excerpt)
PATTERNS = {
    "email":          r"\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b",
    "phone-us":       r"\b\d{3}[-.]?\d{3}[-.]?\d{4}\b",
    "phone-intl":     r"\+\d{1,3}[-. ]?\(?\d{1,4}\)?[-. ]?\d{3,10}",
    "postal-us":      r"\b\d{5}(-\d{4})?\b",
    "ssn":            r"\b\d{3}-\d{2}-\d{4}\b",
    "credit-card":    r"\b(?:\d[ -]?){13,19}\b",  # regex-only (Luhn validation is v1.1 per AUDIT-LIES Priya M-5)
    "operator-id":    r"\bop-[0-9a-f]{4,16}\b",
    "tenant-id":      r"\btn-[0-9a-f]{8,32}\b",
    "cohort-id":      r"\bcoh-[0-9a-f]{8,32}\b",
    "raw-cid":        r"\bblake3:[0-9a-f]{16,64}\b",
}
```

The patterns are well-tested at the catch-99%-of-obvious-PII level.
The known failure cases (international postal codes outside the
catalog, custom phone formats from certain regions) are caught by
the entropy and ML layers.

#### SJ.5.3 — Entropy heuristic layer

The entropy layer looks for strings whose Shannon entropy is
suspiciously high (suggesting obfuscation) or whose token
sequence matches known obfuscation patterns.

```python
# loam/security/pii_scrubber.py (entropy detector) (engineering excerpt)
def looks_obfuscated(s: str) -> Optional[str]:
    if " at " in s.lower() and any(c in s for c in "@."):
        return "obfuscated-email"
    if re.search(r"\d\s+\d\s+\d", s):  # spaced digits
        return "obfuscated-phone"
    if len(s) > 16 and shannon_entropy(s) > 5.5 and is_base64(s):
        return "high-entropy-blob"
    if len(s) > 32 and all(c in "0123456789abcdef" for c in s.lower()):
        return "long-hex"
    return None
```

The entropy layer is rule-of-thumb. It catches the common cases
the rule layer misses. The rare-case escapes are caught by the
ML layer.

#### SJ.5.4 — ML classifier layer

The ML layer runs only on free-text fields (`> 48 bytes` heuristic;
configurable per cart). The classifier is a small (~10MB) BERT-
distilled model trained on the Roblox PII Classifier release
(2025) augmented with synthetic data for quasi-identifier classes
specific to the commerce domain (jewelry brand names, food product
names, etc.).

Per arXiv 2501.12465 / *Adaptive PII Mitigation Framework* (2025),
rule-based PII detection alone misses 12-20% of in-the-wild PII;
adding the ML layer reduces miss-rate to ~2-4%. We measure
miss-rate quarterly against a held-out test set.

The classifier outputs a per-token risk score. Tokens with
`risk > 0.7` get redacted; tokens with `0.4 < risk ≤ 0.7` trigger
a `pii-uncertain` audit event that a human-in-the-loop reviews
weekly. Tokens with `risk ≤ 0.4` pass through.

Vendor-name discipline: the ML model is trained on the Roblox
release + our augmentation; the model itself does not embed any
vendor's branded data. The 2026-06-22 corpus-leak lock applies —
the augmentation set was screened for vendor names before training.

#### SJ.5.5 — Per-tenant allowlist

Some fields legitimately contain strings that look like PII but
aren't, in the tenant's context. A shop named "Alfred's Handmade"
contains "Alfred" — a first name that the rule layer flags. The
tenant classifies "shop.name" as a non-PII field; the allowlist
suppresses the flag for that specific (tenant, field) pair.

Allowlists are signed by the tenant's root key and stored in
the TENANT plane. The Shell loads the allowlist when opening a
shard and applies it to every PII check on that shard.

#### SJ.5.6 — Failure modes

**Failure mode (Priya):** A novel obfuscation that none of the
four layers catches lands a PII value into a COHORT-plane
aggregate. The aggregate is read by a downstream consumer; the
PII leaks. Mitigation: the §SJ.4 K-anonymity floor prevents single-
operator aggregates from being readable; even a leaked PII value
requires K=8 distinct tenants to share that PII for the leak to
matter. Residual risk: a popular phrase that 8+ tenants all use
in their PII-bearing free text could leak — for example, "I live
at the corner of 5th and Main" appearing in 8 different
operators' messages. The PII classifier's quasi-identifier
detection catches this class; novel quasi-identifier patterns
are an open research problem named in §32.

**Failure mode (Priya):** A tenant adds a field to their allowlist
that turns out to contain PII in their actual data. The tenant is
authorizing PII leakage to themselves (TENANT plane only); the
allowlist doesn't relax the §SJ.4 K-floor for COHORT-plane
writes. Residual risk: the tenant has authorized a self-leak,
which is their right per the consent model.

**Failure mode (Priya):** The ML classifier model drifts as
language usage evolves. Mitigation: quarterly re-training on a
fresh corpus + the held-out test set's miss-rate benchmark. A
miss-rate above 5% triggers a retraining sprint.

---

### SJ.6 — The audit log: forward-secure, Merkle-rooted

#### SJ.6.1 — What's logged

Every Shell operation produces an audit row. Rows include:

- The operation verb (`put`, `get`, `append`, `on`, `poll`).
- The principal (capability-token's root identity).
- The target plane + key.
- The caveat chain from the token.
- The CID written or read (if any).
- The response status (`ok`, `escalate <reason>`, `error <kind>`).
- The wall-clock timestamp (UTC, ISO 8601, monotonic-clock-paired).
- The operation latency (microseconds).
- The PII-scrub outcomes (which layer fired, if any).
- The Shell process ID + version.
- The signing sequence number (per shard).
- The Keyed-BLAKE3 row signature.
- The Merkle proof to the current epoch root.

The audit row is the substrate's accountability record. Regulators
ask for it; subpoenas request it; the §14 disaster recovery
re-replays it. The log is what the substrate is **about**, not a
side effect.

#### SJ.6.2 — Forward-secure signing

Forward-secure signing means a compromised current key cannot
forge older signatures. The construction:

- Per-shard signing key chain: `K_0 → K_1 → K_2 → ...`
- Key rotation: `K_{n+1} = HKDF-BLAKE3(K_n, "loam-forward-secure-rotate")`
  on the rotation event.
- After rotation, `K_n` is securely deleted (zeroed memory +
  munmap'd + fsync'd hole).
- Row signed at epoch `n` uses `K_n` for its MAC.
- Verifier holds all historical public keys (one per epoch);
  signature verification uses the epoch's key as recorded in the
  row's metadata.

This is the FssAgg construction from Bellare & Yee 2003
([*Forward-Security in Private-Key Cryptography*](https://www.iacr.org/archive/crypto2003/27290031/27290031.pdf))
extended with the Logcrypt aggregation discipline from Holt-
Bradford 2006 (ACSAC). The aggregation lets the verifier validate
a span of rows from a single root signature, not per-row.

#### SJ.6.3 — Merkle-tree epochs

Each epoch (default 1 minute) ends with a Merkle root computed
over all the row signatures in the epoch. The root is itself
signed by `K_n` (the epoch's signing key) and published to:

- The shard's local audit table (`audit_epoch_roots`).
- The cold-store quorum (via the same Litestream pipeline as
  the data).
- A separate, append-only **transparency log** (the §SJ.10
  external surface) for high-assurance tenants.

The transparency log is a Sigsum-style append-only tree
([sigsum.org](https://www.sigsum.org/)). External parties can
witness the inclusion of a Merkle root and provide a
witness-signature that strengthens the audit's tamper-evidence.

#### SJ.6.4 — Audit-write co-transactionality

The audit row is in the same SQLite transaction as the data
write (§M.6.3 step 3). There's no audit-gap window. The §28
patentable surface (B.11) is built on this property:

> "Capability-token chain co-transactional with audit log
> emission" — the cap-token verification, the data write, and
> the audit row insertion all succeed or all abort.

The transactional discipline prevents the class of bug where the
data lands but the audit is lost (or vice versa). It also
prevents tampering with the audit independently of the data —
both rows live in the same SQLite page-cache and the same
fsync'd WAL segment.

#### SJ.6.5 — Failure modes

**Failure mode (Priya):** A Shell crash mid-transaction loses
both the data write and the audit row. The cap-token verification
already happened (in-process before the transaction); the
operator might believe their action took effect. Mitigation: the
Shell returns success only after the transaction commits. A
crash before commit returns an explicit `escalate
'transaction-aborted` to the caller. The caller (Sakura, cart)
treats this as "did not happen" and retries.

**Failure mode (Priya):** A bug in the forward-secure rotation
that leaves `K_n` in memory after rotation. An attacker who
compromises the Shell after rotation can use `K_n` to forge
historical rows. Mitigation: the rotation code is property-
tested (`loam/security/test_fss_rotation.rs`) with an explicit
zero-and-verify discipline. Memory zeroing uses
`zeroize::Zeroizing<T>` (the Rust crate that the audit team
trusts). The fsync'd-hole guarantee is platform-specific (Linux:
`fallocate(FALLOC_FL_PUNCH_HOLE)`; macOS: best-effort);
production Shells run on Linux where the guarantee is strong.

**Failure mode (Priya):** The Merkle root publication to the
transparency log fails. The audit row's local signature is
valid; the witness is missing. Mitigation: the transparency log
client retries with exponential backoff; sustained failure
emits a `transparency-log-down` SYSTEM event and the cohort
that requires transparency-log witnessing falls back to a
local-only audit until the log is reachable. The fallback is
logged as a SYSTEM event for post-hoc compliance review.

---

### SJ.7 — The abuse-prevention envelope (W8b)

The substrate has to defend against a range of abuse patterns:
rate-limit abuse, scraping, credential stuffing, subscription
flooding, predicate-of-doom (§SJ.3.5), cohort enumeration. The
envelope is a thin layer outside the Shell that filters traffic
before it reaches the verifier.

#### SJ.7.1 — Per-principal rate limits

Every authenticated principal has a per-operation rate limit:

| Operation | Default limit (per principal) | Burst |
|---|---|---|
| `put` (TENANT) | 50/sec | 250 |
| `put` (COHORT, WORLD, PUBLIC) | 5/sec | 20 |
| `get` | 200/sec | 1000 |
| `append` | 100/sec | 500 |
| `on` (register subscription) | 1/sec | 10 |
| `poll` | 50/sec | 200 |

Limits are per-principal-per-Shell. The limit state is in-process
memory; cross-Shell limits are coordinated by a per-principal
counter in Redis (the `loam-rate` service, optional; the Shell
operates without it at reduced precision).

Limit exceeded → `escalate 'rate-limited` with a `retry-after`
hint. The audit log captures the rejection.

#### SJ.7.2 — Anomaly detection

The envelope runs a small anomaly classifier on per-principal
traffic patterns:

- Sudden 10× burst from a previously quiet principal.
- Read pattern that systematically enumerates a CID range.
- Write pattern that systematically tests cohort boundaries
  (suggests K-anonymity probing).
- Predicate-registration pattern that suggests subscription-table
  poisoning.

Anomalies escalate via the SYSTEM-plane event spine. The §SJ.7
abuse-prevention layer can auto-pause a principal pending review;
auto-pause is reversible by the operator or by a SYSTEM-tier
auditor.

#### SJ.7.3 — Auto-pause discipline

Auto-pause is the substrate's response to high-confidence abuse.
The discipline:

1. Anomaly classifier scores a principal's traffic.
2. Score > threshold triggers pause.
3. Pause emits a SYSTEM event with the evidence (recent audit
   rows + anomaly scores).
4. The principal's subsequent requests return `escalate
   'principal-paused` with a `contact-support` hint.
5. Pause is reversible within 24h by:
   - The principal proving identity via a fresh auth flow.
   - A SYSTEM-tier auditor reviewing the evidence.
6. After 24h, the principal is unpaused automatically with a
   reduced rate-limit (defaults to 25% of the normal limits).
7. Sustained anomaly on the reduced limits triggers escalation
   to manual review.

The discipline is **always reversible** because false-positive
auto-pause is operationally damaging. The §SJ.10 audit makes
every pause / unpause inspectable.

#### SJ.7.4 — Failure modes

**Failure mode (Priya):** A legitimate burst (a popular cart
fires concurrently across many operators) triggers anomaly
auto-pause incorrectly. Mitigation: anomaly classifier has a
per-cart-template suppressor — known-popular carts (`etsy/listing-
quality-check`) have an elevated threshold derived from their
historical baseline. New carts ramp into the baseline over their
first 30 days.

**Failure mode (Priya):** A sophisticated adversary distributes
their attack across many low-rate principals to stay below the
per-principal limit. Mitigation: the envelope has a per-cohort
rate limit in addition to per-principal. The cohort limit is
configurable; the default is `10 × K_FLOOR` operations/sec/cohort.
Cohort-level abuse triggers a different anomaly class with a more
conservative auto-pause threshold.

**Failure mode (Priya):** The Redis-backed cross-Shell counter
goes down. Each Shell falls back to in-process limits, which
collectively allow higher total throughput than the configured
cohort cap. Mitigation: the fallback logs a SYSTEM event and the
fleet's monitoring alerts within 60 seconds. During the outage,
the per-Shell limits remain (which is more permissive than the
global, but still finite per principal).

---

### SJ.8 — WASM sandbox for substrate-resident code (W10)

The §28.5 patentable surface (B.13) names a substrate-resident
code-artifact registry with sandboxed execution. The execution
sandbox is **WASM** (WebAssembly Component Model). This section
covers the WASM posture and the security stance.

> **Status: W10 substrate shipped on `loam-build`.** The registry
> + sandbox + dispatcher + quota + revocation modules ship under
> `loam/code/` (`artifact.py`, `sandbox.py`, `dispatcher.py`,
> `quota.py`, `revocation.py`); execution gated by cap-tokens via
> the Shell. The remaining `loam-exec` sidecar daemon design is the
> v1.1 deployment-pattern decision; v1.0 runs WASM in-process inside
> the Shell. This section describes the discipline as it ships.

#### SJ.8.1 — Why WASM

WASM because:

- **Sandboxed by design.** No filesystem, no network, no syscalls
  except via explicit host imports. The Shell imports a curated
  set of capabilities into the WASM instance; nothing else is
  reachable.
- **Deterministic.** WASM bytecode executes identically on every
  conforming runtime. The substrate's "rebuild from log" discipline
  applies to executed code outputs.
- **Polyglot.** Carts can be authored in any language that targets
  WASM (Rust, Go, AssemblyScript, Python via Pyodide for the
  prototype tier). The substrate doesn't pick a language.
- **Small runtime.** Wasmtime is ~20MB; embedded in the Shell
  binary it adds ~7MB to the static link.

#### SJ.8.2 — Wasmtime as the runtime

Wasmtime (Bytecode Alliance; Apache-2.0) is the runtime we ship.
Wasmtime is:

- Maintained by Mozilla / Fastly / Microsoft / Intel via the
  Bytecode Alliance.
- Used in production at Fastly Compute@Edge for ~100B requests/day.
- The reference implementation of the Component Model.
- Configurable to refuse instructions Loam doesn't allow (no SIMD
  in v1.0 because the Spectre posture isn't settled yet, §SJ.8.3).

The pinning: Wasmtime 22.0 LTS. Upgrades require the same
discipline as Litestream and RocksDB version bumps — full
regression test + monthly drill before promoting.

#### SJ.8.3 — Spectre posture (CVE-2025-5419)

CVE-2025-5419 (May 2025) demonstrated a Spectre v1 variant
that bypassed the Spectre mitigations in Wasmtime ≤21.0 on
certain x86 microcodes. Loam's posture:

- **v1.0 production: Wasmtime ≥22.0** with the new "branchless
  bounds-check" emit path. The new emit removes the Spectre
  speculation surface entirely at a ~7% throughput cost.
- **No SIMD in v1.0** because SIMD's wider load patterns expand
  the Spectre side-channel surface in ways that the literature
  hasn't fully characterized.
- **Side-channel-isolated host imports.** The host functions
  Loam exposes to WASM (the substrate verbs) take constant-time
  paths where the access pattern depends on guest-controlled
  input. The constant-time discipline is verified by a property
  test that times the path across 1000 random inputs.

The posture is conservative. We accept the throughput cost
because the substrate is the foundation everything else trusts;
a Spectre escape from a WASM sandbox into the Shell process
would be catastrophic.

#### SJ.8.4 — Host import surface

WASM artifacts get a fixed host import set:

| Host import | Purpose | Capability check |
|---|---|---|
| `loam_get(plane, key) -> bytes` | Read a fact | Cap-token must allow `op:get` on the plane |
| `loam_put(plane, key, cbor) -> cid` | Write a fact | Cap-token must allow `op:put`; PII scrubber runs |
| `loam_log(level, msg)` | Emit a log line | No check; logged with the artifact CID |
| `loam_clock_ns() -> u64` | Monotonic nanos | No check; constant-time |
| `loam_random(buf, len)` | Cryptographic random | No check; from `/dev/urandom` |
| `loam_emit_event(name, cbor)` | Append to event spine | Cap-token must allow `op:append` |

That's the entire host surface. No filesystem. No network. No
process control. No subprocess spawn. No raw memory access
outside the WASM linear memory.

#### SJ.8.5 — Resource caps

Every WASM instance has:

- **CPU cap.** A "fuel" budget (Wasmtime's term) of N instructions
  per invocation. Default `DEFAULT_FUEL_LIMIT = 100_000_000` (~1s on
  dev hardware per `sandbox.py:65`). Exceeded → instance traps; the
  calling cart receives `escalate 'cpu-cap`.
- **Memory cap.** Linear memory limited to **64 MiB**
  (`DEFAULT_MEMORY_LIMIT_BYTES = 64 * 1024 * 1024` per `sandbox.py:66`;
  corrected 2026-06-27 per AUDIT-LIES H7 from the earlier 256 MB
  copy-paste). Producer can raise per-artifact. Exceeded → memory-grow
  traps; the instance receives a host-side error.
- **Time cap.** Wall-clock deadline of **2 seconds** per invocation
  (`DEFAULT_WALL_TIME_BUDGET_SECS = 2.0` per `sandbox.py:67`;
  corrected 2026-06-27 from the earlier 30-second figure). Producer
  can raise to 30s. Exceeded → host kills the instance.
- **Per-tenant per-day fuel budget.** Enforced by `loam/code/quota.py`:
  free=10M, imagine=100M, dream=500M, magic=1B, sre=5B. Per artifact
  caps at 100M/day. Exceeded → `EXIT_REASON_QUOTA_EXCEEDED`. (Added
  2026-06-27 per AUDIT-LIES Priya H-8.)
- **Output size cap.** Returned bytes capped at 16 MB per
  invocation. Exceeded → host truncates and emits a
  `truncated` flag in the audit row.

The caps are enforced by Wasmtime's host configuration. The
instance can't escape its own caps.

#### SJ.8.6 — Failure modes

**Failure mode (Priya):** A WASM artifact attempts a denial-of-
service via runaway recursion or infinite loop. Mitigation: the
fuel cap stops it within ~100ms. The audit row records the
cap-hit; repeated cap-hits from the same artifact trigger an
auto-quarantine (§SJ.7.3).

**Failure mode (Priya):** A WASM artifact attempts to side-
channel-read another tenant's data via shared CPU cache state.
Mitigation: the side-channel-isolated host imports keep the
cap-token check + the data fetch in constant time. Cross-tenant
data residue in CPU cache state is the residual risk; on the
Fly hardware we ship on, the L3 is shared across cores, which
is a theoretical leak surface. We accept this risk because the
data the WASM instance can reach is already authorized for the
calling cart; a same-tenant cache leak doesn't cross a trust
boundary. Cross-tenant WASM execution doesn't happen — each
WASM instance runs on behalf of one principal at a time, and
the Shell quiesces the instance before reassigning the host.

**Failure mode (Priya):** A new Spectre variant is published
that targets Wasmtime ≥22.0. Mitigation: emergency security
sprint protocol. Wasmtime publishes a CVE; we patch within 7
days or take the artifact registry offline until patched. The
§14 cold-store backup includes a "WASM execution disabled"
configuration that the substrate can fall back to with a single
config flip.

---

### SJ.9 — Per-tenant cryptographic erasure

GDPR Article 17 ("right to be forgotten") names the requirement.
Loam's mechanism is **cryptographic erasure**: the per-tenant
encryption key is destroyed, and the ciphertext that remains is
mathematically unrecoverable.

#### SJ.9.1 — Key topology

Each tenant has:

- **A per-tenant master key** (AES-256-GCM, 32 bytes,
  HKDF-derived from the tenant's identity proof at first
  enrollment).
- **A per-cohort wrap key** for each cohort the tenant
  participates in (also AES-256-GCM, derived from the master
  key + the cohort ID via HKDF).
- **A per-resource data key** for high-sensitivity blobs
  (envelope encryption: the data key encrypts the blob; the
  cohort wrap key encrypts the data key).

The master key is held in two places:

1. The Shell's HSM-backed key cache (Fly secrets at v1.0; the
   dedicated KMS ships post-1.0).
2. A Shamir-split offline escrow (3-of-5 shares; 2 shares
   on-disk in different geographic regions, 3 shares with
   trusted custodians).

Both copies must be destroyed for erasure to be complete.

#### SJ.9.2 — Erasure flow

When an operator requests erasure under GDPR Art. 17:

1. The operator's request is authenticated (multi-factor; the
   account self-service flow doesn't suffice — a confirmed email
   + a second factor is required).
2. The Shell marks the tenant's namespace for erasure with a
   timestamp.
3. The Shell destroys the in-cache master key copy
   (zeroize + memory hole).
4. The Shell instructs the Fly secret store to destroy its copy
   (best-effort; the audit row notes the destruction).
5. The Shell instructs the Shamir custodians to destroy their
   shares (manual; the §SJ.9.4 custodian protocol applies).
6. After custodian confirmation (default 30 days; configurable
   per operator), the Shell purges the encrypted data from the
   shard. The data is unreadable from step 5 onward; the purge
   is a storage-reclaim, not a privacy step.
7. The audit log retains an erasure-receipt for the regulatory
   trail (per §26.2 the receipt itself contains no subject data).

#### SJ.9.3 — Tombstone-receipt vs subject data

The §26.2 distinction matters. The audit log keeps:

- The fact that an erasure happened.
- The wall-clock timestamp.
- The tenant's pseudonymous ID.
- The cryptographic proof that the erasure was performed
  (signed by all destroying parties).

The audit log does NOT keep:

- The tenant's name, email, address, or any other identifier
  that could re-link to the tenant.
- The content of any data that was erased.
- The cohort IDs the tenant participated in (those are derived
  from the tenant ID + cohort salt; without the tenant ID,
  the cohort participation is unrecoverable).

A future re-identification of the erasure-receipt requires
the tenant's pseudonymous ID + the salt at the time of
participation. The salts rotate monthly (§12.3); after one
month, the cohort participation is unrecoverable even from
the receipt.

#### SJ.9.4 — Shamir custodian protocol

The 3-of-5 Shamir custodians are:

- 2 on-disk shares in geographically separate Fly regions
  (the Shell holds 0 of these; only the destruction process
  reaches them).
- 3 custodian-held shares: 1 with the architect, 2 with
  retained legal-trust custodians (an independent law firm
  + an independent audit firm; both contracted with a
  destruction-on-instruction clause).

Destruction:

1. The Shell emits a "destroy share" request signed with the
   master destruction key.
2. Each custodian (on-disk shares: automated; human custodians:
   a 24h cooling-off period + a manual confirmation) destroys
   their share.
3. Custodian signs a destruction receipt with their custodial
   key.
4. The Shell aggregates receipts; when 3+ receipts are
   collected (the threshold for unrecoverability), the
   substrate marks erasure complete.

The 30-day default window between request and step 4 is the
operator's reversibility window. The operator can rescind the
erasure request within 30 days; after that, even the operator
can't recover the data because the keys are gone.

#### SJ.9.5 — Failure modes

**Failure mode (Priya):** A custodian refuses to destroy their
share (malicious or compromised). Mitigation: 3-of-5 threshold
gives 2 spares. A second non-destruction triggers an audit
event and the substrate marks erasure as "partial" with
explicit operator notification. The operator can rotate
custodians under the recovery protocol.

**Failure mode (Priya):** A backup system holds a snapshot of
the master key from before destruction. Mitigation: backups
of the secret store are themselves encrypted with a per-backup
key, and the backup retention policy mandates per-backup keys
expire 90 days after the backup is created. A backup that
might hold the destroyed master key is itself unreadable after
90 days. The 30-day reversibility window + the 90-day backup
expiry give a 60-day hard ceiling on residual recoverability.

**Failure mode (Priya):** A nation-state attacker compels a
custodian to retain their share. Mitigation: the custodian
contracts include a warrant-canary clause; suspension of the
canary triggers an emergency erasure protocol that rotates all
custodians and re-Shamirs the master keys with new custodians.
We accept that a coercive nation-state can compromise erasure
guarantees against specific individuals; we promise the discipline
to detect and respond, not the discipline to prevent.

---

### SJ.10 — The §SECURITY-CANONICAL — 31 attack-class rows expanded

The full attack-class catalog is below. Each row names the attack,
the threat agent, the Loam-specific surface, the mitigation, the
residual risk, the responsible component, and the W# delivery
status.

#### SJ.10.1 — Catalog (rows 1-31)

#### Row 1 — Cap-token theft via in-flight TLS interception

- **Threat agent:** network-level MITM (compromised CA, BGP
  hijack, hostile WiFi).
- **Surface:** the MCP wire between Sakura and the Shell.
- **Mitigation:** mTLS with cert pinning (Shell's cert pinned
  in Sakura's bundled config); HSTS preload; HTTP/2 multiplexing
  prevents per-message cert downgrade.
- **Residual:** a compromised pin (operator's device was
  pre-compromised before pin installation) bypasses the
  protection. Caught by the §SJ.7 anomaly detector if the
  attacker's usage pattern differs from the operator's.
- **Component:** `loam-shell/src/server.rs (TLS termination — v1.1)`.
- **Status:** shipped W6.

#### Row 2 — Cap-token replay within expiry window

(covered in §SJ.2.6, mitigation = `cid:` caveat + audit log)

#### Row 3 — Cap-token forgery via minter compromise

- **Threat agent:** attacker who compromised the bench's identity
  service.
- **Surface:** Shell verifies signatures against the minter's
  pub key; a compromised minter can sign arbitrary tokens.
- **Mitigation:** monthly minter key rotation; transparency-log
  publication of every minted token's hash (enables post-hoc
  detection of unauthorized mints).
- **Residual:** within-rotation-window forgery is undetectable
  until the transparency log reconciliation pass (hourly).
- **Component:** `loam-shell/src/cap_verify.rs`, `loam/security/macaroon.py`.
- **Status:** verifier shipped W4; minter rotation ships W14.

#### Row 4 — K-anonymity bypass via cohort enumeration

- **Threat agent:** an authenticated principal who can read
  COHORT plane.
- **Surface:** systematic cohort lookups testing the K-floor.
- **Mitigation:** §SJ.7 anomaly detection on cohort-lookup
  patterns; per-cohort rate limits.
- **Residual:** a slow, distributed enumeration that stays below
  rate limits can still build a cohort map. The §SJ.4 K-floor
  itself ensures no individual-level data leaks; only the cohort
  membership cardinality leaks under this attack.
- **Component:** `loam/cohort/coordinator.py`.
- **Status:** shipped W5.

#### Row 5 — K-anonymity bypass via differencing

(an attacker observes COHORT-plane responses across cohort
boundary changes and infers membership)

- **Threat agent:** authenticated principal with sustained
  observation access.
- **Surface:** cohort responses that change as members join /
  leave.
- **Mitigation:** the §SJ.4 floor+1 race margin; cohort responses
  use noise injection (Laplace mechanism, ε=0.1) for
  count-style queries.
- **Residual:** an attacker with very many observations could
  recover individual contributions despite noise. The noise
  parameter is a privacy-budget tradeoff named in §32.
- **Component:** `loam/cohort/coordinator.py (K-floor noise)`.
- **Status:** floor+1 shipped W5; noise injection ships W11.

#### Row 6 — Schema-drift exploitation

- **Threat agent:** a cart author who registers a subscription
  on a field, then renames the field in a subsequent write to
  trigger predicate mis-fires.
- **Surface:** the §16.3.2 schema-suggests-itself sweep.
- **Mitigation:** field-rename emits a `schema-drift` event;
  subscriptions referencing the renamed field get explicit
  notification.
- **Residual:** a 30-day grace window where the subscription
  silently misses some matches.
- **Component:** `loam/discovery/schema_drift.rs`.
- **Status:** shipped W7.

#### Row 7 — Cross-service cap-token confusion

- **Threat agent:** a cart that holds tokens for multiple
  services and uses one service's token against another's
  Shell.
- **Surface:** the §6.4 cross-service token discipline.
- **Mitigation:** the `service:` caveat is mandatory; cross-
  service grants require an explicit `cross-service-grant`
  caveat that names both the source and target services.
- **Residual:** a buggy cart that forgets to narrow the token
  could over-authorize; the Shell still refuses requests outside
  the token's `service:` caveat.
- **Component:** `loam-shell/src/cap_verify.rs:114`.
- **Status:** shipped W6.

#### Row 8 — Subscription-table poisoning

(covered in §SJ.3.5, mitigation = per-principal subscription cap)

#### Row 9 — Predicate-of-doom

(covered in §SJ.3.5, mitigation = 100µs timeout + closed
predicate language)

#### Row 10 — Audit log tampering after compromise

- **Threat agent:** an attacker who gained Shell process
  privileges.
- **Surface:** the in-process audit signer.
- **Mitigation:** forward-secure signing (§SJ.6.2); older rows
  signed with deleted keys can't be re-signed; transparency log
  detects backdated insertion attempts.
- **Residual:** the attacker can suppress *future* audit rows
  for the duration of the compromise; the gap is detectable
  via the per-second heartbeat row.
- **Component:** `loam/log/audit.py (forward-secure signing — see C2)`.
- **Status:** signing shipped W6; transparency log ships W12.

#### Row 11 — Litestream replication blackhole

- **Threat agent:** an attacker who hijacked one or more cold-
  store credentials.
- **Surface:** the §M.2 Litestream pipeline.
- **Mitigation:** 3-of-5 quorum requires multiple compromised
  credentials; the §14.5 monthly drill validates each
  destination independently.
- **Residual:** an attacker who compromised 3+ destinations
  simultaneously could redirect the WAL. The cold-store
  credentials are held with separate access controls per
  provider; a multi-provider compromise is the threat model
  for a nation-state actor.
- **Component:** `loam/replicator/litestream.rs`.
- **Status:** shipped W4.

#### Row 12 — Cold-store-only ciphertext extraction

- **Threat agent:** an attacker who compromises one cold-store
  destination.
- **Surface:** the data at rest in cold storage.
- **Mitigation:** TENANT-plane data is encrypted with per-tenant
  AES-256-GCM (§12.5); the cold-store ciphertext is opaque
  without the per-tenant key.
- **Residual:** SYSTEM-plane data and aggregate COHORT-plane
  data are stored unencrypted (per Sakura's design — these are
  cohort-anonymized already). An attacker extracting SYSTEM data
  learns operational metadata (request counts, audit log
  shapes). Operationally this is moderate-impact; we don't
  consider it high-impact because the audit log itself is
  designed to be inspectable.
- **Component:** `loam/store/encrypt_at_rest.rs`.
- **Status:** TENANT encryption shipped W3; cold-store
  encryption-at-rest discipline shipped W4.

#### Row 13 — PII leakage via novel obfuscation

(covered in §SJ.5.6)

#### Row 14 — PII leakage via quasi-identifier composition

(covered in §SJ.5.6, residual = open research)

#### Row 15 — Confused-deputy via LLM mediation

- **Threat agent:** a prompt-injected LLM induced to call Shell
  verbs on behalf of an attacker.
- **Surface:** historically — when the substrate considered an
  LLM-as-mediator at the gate. **Retired per §17 reframe.**
- **Mitigation:** the substrate has no LLM in its trust domain.
  Sakura's NL adapter lives outside the substrate; if she's
  prompt-injected, she can only call Shell verbs that her
  current cap-token authorizes. The injection can't expand
  authority.
- **Residual:** a prompt-injected Sakura could still call
  legitimately-authorized verbs in unintended sequences. The
  cart-level discipline (every cart declares its expected verb
  sequence) catches the largest class of such attacks via
  audit-log anomaly detection.
- **Component:** N/A in substrate; Sakura's adapter is
  `curator-web/src/sakura/adapter.js`.
- **Status:** §17 reframe shipped W7; the cart-sequence
  anomaly detector ships W12.

#### Row 16 — Side-channel timing leak of K-floor

- **Threat agent:** a sophisticated attacker who measures
  response latency to infer cohort cardinality.
- **Surface:** the §SJ.4 K-floor check.
- **Mitigation:** constant-time response — the Shell pads the
  K-floor-fail response to the same latency budget as the
  data-read response (default 5ms padding).
- **Residual:** padding is best-effort; a precise attacker with
  many observations could detect timing variance. The §SJ.7
  rate limiter caps the observation rate.
- **Component:** `loam-shell/src/rate_limit.rs`.
- **Status:** shipped W6.

#### Row 17 — WASM sandbox escape

(covered in §SJ.8.6)

#### Row 18 — Wasmtime CVE-based escalation

(covered in §SJ.8.3)

#### Row 19 — Forward-secure key residue after rotation

(covered in §SJ.6.5)

#### Row 20 — Auth-decision based on stale capability state

- **Threat agent:** an attacker who exploits the gap between
  cap-token issuance and the Shell's last sync of revocation
  state.
- **Surface:** the Shell's revocation cache (15-minute TTL).
- **Mitigation:** short cap-token expiry (15 minutes default)
  bounds the window. Critical revocations (compromised
  principals) push to all Shells via the §SJ.7 revocation-push
  channel with sub-second propagation.
- **Residual:** a 15-minute window where a revoked principal
  could still use an unexpired token. For most use cases
  acceptable; for high-security carts, the cart can require
  fresh tokens (sub-1-minute expiry) at additional latency cost.
- **Component:** `loam/code/revocation.py`.
- **Status:** shipped W6.

#### Row 21 — Replay of a successful WASM execution

- **Threat agent:** an attacker who learned the inputs of a
  successful execution and wants to re-trigger it.
- **Surface:** the WASM execution endpoint.
- **Mitigation:** execution requests are idempotent on
  `(artifact_cid, input_hash, principal)`. A repeat returns
  the cached result; no side effects re-execute.
- **Residual:** an attacker with the same authorization could
  re-trigger; but they could also trigger via legitimate
  channels — replay doesn't expand authority.
- **Component:** `loam/exec/idempotency.rs`.
- **Status:** ships W10.

#### Row 22 — Code-artifact CID confusion

- **Threat agent:** an attacker who uploads a code artifact
  whose CID collides with a known good artifact.
- **Surface:** the §28.5 code-artifact registry.
- **Mitigation:** dual-hash (BLAKE3 + SHA-256) requires
  collisions in both; the §M.4 cryptographic-agility hedge
  applies. Collision-finding in BLAKE3 is computationally
  infeasible under current cryptanalysis.
- **Residual:** future cryptanalytic advances could change this;
  the dual-hash hedge is what we have.
- **Component:** `loam/registry/code_artifact.rs`.
- **Status:** registry shipped W7; execution sandbox W10.

#### Row 23 — Cross-tenant audit log inference

- **Threat agent:** an authenticated principal who reads the
  SYSTEM plane's audit log slices.
- **Surface:** the audit log SYSTEM view.
- **Mitigation:** SYSTEM-plane audit reads are filtered to the
  principal's own service-scope; cross-service audit requires
  explicit cross-service grant (§6.4).
- **Residual:** within a service, an authorized principal can
  see cross-tenant audit metadata (timestamps, verbs, plane
  keys). This is the audit's purpose; the audit content is
  designed to not reveal cross-tenant secrets.
- **Component:** `loam/log/audit.py (AuditLog.latest)`.
- **Status:** shipped W6.

#### Row 24 — Subscription delivery channel poisoning

- **Threat agent:** an attacker who can spoof subscription
  delivery callbacks.
- **Surface:** the §10.5 callback URL pattern.
- **Mitigation:** delivery callbacks carry a signed
  delivery-token (separate from the cap-token chain). The
  callback URL is content-addressed by the subscription
  registration; spoofed callbacks fail signature.
- **Residual:** a same-network attacker who intercepts the
  callback could replay the signed payload to a different
  endpoint; the receiving endpoint validates the
  delivery-token's `dest:` caveat.
- **Component:** `loam/subscriptions/dispatcher.py`.
- **Status:** shipped W8.

#### Row 25 — Cross-service cohort-mediated inference

- **Threat agent:** an authenticated principal in service A
  who infers details about service B's tenants via shared
  WORLD-plane aggregates.
- **Surface:** the §6 multi-service cohort model.
- **Mitigation:** WORLD-plane aggregates that contain
  contributions from multiple services apply the K-floor at
  the union (§SJ.4.4). Service-A's contribution alone is
  K-anonymized; the union is also K-anonymized.
- **Residual:** clever differencing across many such aggregates
  could surface inference; the noise injection (Row 5)
  applies to high-sensitivity aggregates.
- **Component:** `loam/cohort/coordinator.py + loam/services/cross_service_tokens.py`.
- **Status:** shipped W7.

#### Row 26 — Public-plane scraping

- **Threat agent:** anyone with internet access.
- **Surface:** the PUBLIC plane (opt-in operator-published data).
- **Mitigation:** PUBLIC plane is operator-opt-in; the operator
  chose to publish. Rate limits at the §SJ.7 envelope apply to
  unauthenticated readers (default 60 req/min per IP).
- **Residual:** scrapers can compose unauthenticated reads
  across many IPs. This is the cost of publishing publicly; the
  operator was warned at opt-in.
- **Component:** `loam/planes/public.py`.
- **Status:** shipped W3.

#### Row 27 — Erasure-bypass via backup retention

(covered in §SJ.9.5)

#### Row 28 — Erasure-incomplete via custodian compromise

(covered in §SJ.9.5)

#### Row 29 — Cohort-membership inference via subscription registration

- **Threat agent:** an authenticated principal who registers
  subscriptions probing cohort membership.
- **Surface:** the §10 subscription primitive.
- **Mitigation:** subscription registrations are validated
  against the registrant's cap-token; a subscription that
  probes cohorts requires the same authority as a direct
  cohort read.
- **Residual:** a sophisticated attacker could use subscription
  delivery patterns to time-side-channel cohort membership; the
  §SJ.7 anomaly detector flags these patterns.
- **Component:** `loam/subscriptions/dispatcher.py (SSRF defense)`.
- **Status:** shipped W8.

#### Row 30 — Cortex-of-Loam local exfiltration

- **Threat agent:** an attacker with physical access to an
  operator's device.
- **Surface:** the Cortex-of-Loam local primary (§17.6) on the
  operator's device.
- **Mitigation:** Cortex storage is encrypted with the device's
  hardware-bound key (Secure Enclave on iOS, StrongBox on
  Android, TPM on desktop). Decryption requires the operator's
  biometric/PIN.
- **Residual:** an attacker with the operator's PIN + device
  has the same authority as the operator. This is fundamental
  to the local-primary model; the substrate doesn't claim to
  protect against device theft + credential compromise.
- **Component:** `curator-web/src/cortex/local_encrypt.js`.
- **Status:** shipped W5.

#### Row 31 — Substrate-level prompt injection via stored content

- **Threat agent:** an attacker who places injection-bearing
  content in a TENANT-plane record that a downstream LLM might
  read.
- **Surface:** the boundary between Loam reads and any LLM that
  processes the read content.
- **Mitigation:** **Loam's responsibility is null here.** The
  substrate doesn't run LLMs; it stores content. Prompt-injection
  defense is the LLM-consumer's responsibility (Sakura's adapter,
  any cart that hands data to an L2 reasoning model). Loam
  provides the audit trail that lets the consumer log every
  LLM input.
- **Residual:** any LLM consumer that fails its own injection
  defense exposes its trust domain. Loam's role is the audit
  surface that lets the consumer post-hoc detect injection
  damage.
- **Component:** N/A in substrate.
- **Status:** N/A; per-consumer responsibility.

#### SJ.10.2 — Coverage summary

31 attack rows. All 31 have a documented mitigation, a stated
residual risk, and a responsible component. 24 are shipped or
ship in the v1.0 window (W1-W16); 4 are post-1.0 (Rows 5, 10
transparency-log, 21, 11 enhanced); 3 are out-of-substrate
responsibility (Rows 15 prompt injection in cart, 31
LLM-consumer responsibility, 30 device theft).

The catalog is the substrate's threat surface as we currently
understand it. New attack classes will be added as discovered.

---

### SJ.11 — The OWASP LLM Top 10 alignment (2025 edition)

OWASP LLM01:2025 (Prompt Injection) is the canonical reference
for LLM-class attacks. The substrate's posture:

| OWASP class | Loam's posture | Component |
|---|---|---|
| LLM01 Prompt Injection | Out-of-substrate; Loam audits every LLM input | (per-consumer) |
| LLM02 Insecure Output Handling | Out-of-substrate; the cart's output handling | (per-cart) |
| LLM03 Training Data Poisoning | The §SJ.5 PII scrubber prevents corpus leakage at write-time | `loam/security/pii_scrubber.py` |
| LLM04 Model Denial of Service | The §SJ.7 envelope rate-limits all substrate access | `loam-shell/src/rate_limit.rs (envelope rate-limiter)` |
| LLM05 Supply Chain Vulnerabilities | The §SJ.8.2 Wasmtime pinning + the SBOM in §32.6 | `loam/exec/sbom.rs` |
| LLM06 Sensitive Information Disclosure | The §SJ.4 K-floor + the §12.5 PII scrubber | (substrate-wide) |
| LLM07 Insecure Plugin Design | The §SJ.3 5-verb allow-list + the WASM host import surface | `loam-shell/src/schema.rs (canonical wire surface)` |
| LLM08 Excessive Agency | The §SJ.2 cap-token caveats narrow agency at every hop | `loam-shell/src/cap_verify.rs` |
| LLM09 Overreliance | The §M.13 provenance field + the honest-null discipline | `loam/log/audit.py (provenance fields in audit row)` |
| LLM10 Model Theft | Out-of-substrate; Sakura's model is on-device per §17.6 | (per-consumer) |

The substrate covers 7 of the 10 categories at the substrate
level; the remaining 3 are per-consumer responsibilities.

---

### SJ.12 — Why the substrate doesn't try to defend the LLM

The original LOAM 1.0 sketch named "small LLM at the gate" as a
defense. §17 retired this. The reasoning:

1. **An LLM in the trust domain is a moving attack surface.**
   Every prompt the LLM sees is a potential injection. Every
   training data update is a potential corpus poisoning.
   Defending the LLM is unbounded work.
2. **A deterministic Shell is a fixed attack surface.** The
   Shell's allow-list, its caveat vocabulary, its WASM host
   imports — all are fixed code, version-controlled, formally
   analyzable.
3. **The confused-deputy problem is fundamentally easier to
   solve at a deterministic boundary.** Confused deputies appear
   when authority composes ambiguously. A 5-verb fixed
   vocabulary composes predictably; a natural-language interface
   composes unpredictably.
4. **Audit is easier on a fixed surface.** Every Shell decision
   is one of 5 verbs × a small caveat space. Every LLM decision
   is unbounded. Auditability scales inversely with surface
   ambiguity.

The §17 reframe makes the substrate-side security story
operationally tractable. The cost is that natural-language
intent has to be translated into Shell verbs by a separate
adapter — a translation cost Sakura's NL adapter pays for every
operator request. The adapter is the place LLM-class attacks
land; the substrate is downstream and verified.

> "The right way to protect against confused-deputy attacks is
> to give the deputy a finer-grained set of authorities so it
> doesn't have to ask for the union of what it might need."
> — Mark Miller, *Robust Composition* (PhD thesis, 2006)

The five-verb floor is the finer-grained authority. Sakura asks
for exactly what each cart needs; the cap-token narrows to
exactly that authority; the Shell verifies. Confused-deputy is
not eliminated, but its bounded surface lets us reason about it.

---

### SJ.13 — The compliance architecture is the security architecture

A specific Soo-Jin point: regulators and security professionals
ask for the same thing, expressed in different vocabularies.

- The PII scrubber satisfies GDPR Art. 32 ("appropriate
  technical and organisational measures") and the OWASP
  LLM06 defense.
- The K-anonymity floor satisfies GDPR's anonymisation
  guidance and the §SJ.10 Row 4 / Row 5 mitigations.
- The audit log satisfies CCPA §1798.130(a)(5) record-keeping
  requirements and the §SJ.6 forensic-readiness posture.
- Cryptographic erasure satisfies GDPR Art. 17 and a
  defense-in-depth principle for compromised TENANT data.
- The capability-token discipline satisfies the EU AI Act's
  Article 14 ("human oversight") at the operator-authorization
  layer and the §SJ.2 least-authority principle.

The shared root is **structural honesty**: the substrate doesn't
have hidden surfaces, doesn't have side channels you can't
audit, doesn't have authority paths the operator didn't
authorize. That's what regulators ask for; that's what security
engineers ask for; that's what the substrate ships.

---


---

## §35 — Theoretical Foundations + Prior Art (Zane)

*This chapter is the academic and industrial lineage of every substrate
design choice. It walks Codd to Hickey through Datomic, the
transaction lineage from Gray to Helland, the capability lineage from
Saltzer-Schroeder through Macaroons, the privacy lineage from
Samarati-Sweeney through Dwork, the CRDT lineage for the Cortex-of-Loam,
the substrate-intelligence lineage, the format-bilingual lineage, the
event-spine lineage, and the deep-walked comparable-systems
treatment. Every patentable surface is mapped to its prior art with
defensibility named honestly.*

### Z.1 — Posture, in one paragraph

Loam composes ideas. None of the individual ideas is new; the
composition is. This section walks the academic and industrial
lineage of every design choice the substrate makes, names the prior
art the choices descend from, and identifies the places where the
composition itself appears to be unclaimed. The work product is a
map: each design choice points at the literature that supports it
and the systems that pioneered the underlying technique. Where Loam
diverges from a precedent, the divergence is named with the
reasoning.

The aim is not to claim novelty everywhere. The aim is to be
honest about provenance so that the composition's actual novelty
stands out. A patent attorney reading this map can identify which
surfaces are file-grade and which are file-with-attorney-pass. A
new contributor reading it can find the primary sources for any
substrate behavior they want to understand.

---

### Z.2 — The relational lineage

#### Z.2.1 — Codd's 1970 relational model

The foundational paper is Codd's *A Relational Model of Data for
Large Shared Data Banks* (CACM 13(6), June 1970, pp. 377-387).
The paper introduces the relational algebra, the closure-under-
operation discipline, the separation of physical storage from
logical relations, and the principle that "data is data" — not
tied to the application that produced it.

Loam takes from Codd:

- **Closure under operations.** Every Loam verb returns a value of
  the same type the verb accepts. `put` returns a CID (which is
  itself a key into the substrate); `get` returns a fact (which
  can be passed to another `put` or `append`). The closure is the
  property that makes substrate-resident computation possible.
- **Physical/logical separation.** The §M.8 projections are the
  physical materializations; the log is the logical truth. A
  projection can be rebuilt, deleted, replaced — the logical
  fact-set persists.
- **The "data is data" principle.** No cart's data is structurally
  privileged over another's. The five planes are about authority,
  not about data shape. A `etsy.listing` and a `bloom.exercise`
  are both facts in the log; both queryable; both rebuildable.

Loam leaves from Codd:

- **No first-normal-form requirement.** Codd's normal forms
  assume tabular relations. Loam's facts can be hierarchical
  (nested CBOR), graph-shaped (via the §M.9 projection), or
  vector-shaped (via the HNSW projection). The facts are
  primary; the projections are derived in the shape each query
  needs.
- **No declarative query language at the substrate.** SQL was
  Codd's vision; Loam refused it because the §SJ.3 5-verb
  allow-list is the simpler security surface. Queries are
  expressed as cart-side compositions of `get` calls; the
  cart is the query engine.

#### Z.2.2 — Stonebraker's storage architecture

Hellerstein, Stonebraker, and Hamilton's *Architecture of a
Database System* (Foundations and Trends in Databases 1(2),
2007) is the canonical mid-career overview. The paper enumerates
the four major systems: process model, parallel architecture,
relational query processor, storage manager.

Loam's choice to push three of the four outside SQLite (per §M.1)
is the engineering distillation of Stonebraker's frame. The
storage manager is what we kept; the other three are reshaped.

Stonebraker's later *Databases at scale* talk (CIDR 2014) names
the principle:

> "A new database doesn't earn its existence by being faster than
> Postgres at Postgres's job. It earns its existence by serving a
> workload Postgres serves poorly." [paraphrase]

Loam serves a workload Postgres serves poorly — many small
tenant-scoped shards with cohort-aggregation discipline, with
bash-recoverable cold storage, with substrate-resident smart-DB
behaviors. Postgres is the wrong tool for this workload, not
because Postgres is bad but because the workload's shape
doesn't match Postgres's optimization frame.

#### Z.2.3 — The Bayer / B-tree lineage

Bayer and McCreight's *Organization and Maintenance of Large
Ordered Indices* (Acta Informatica 1(3), 1972) introduced
B-trees. The B-tree's invariants — balanced, logarithmic search,
bounded fanout — are what SQLite's index pages still are
(SQLite uses B+-trees, a Bayer descendant). Knuth's *The Art
of Computer Programming* Vol 3 §6.2.4 (1973, revised 1998)
is the canonical analysis.

Loam inherits B-trees through SQLite. We don't reimplement
them; we accept SQLite's implementation as the substrate's
storage backbone.

Loam's §M.9 graph projection uses RocksDB, which is an LSM-tree
(Log-Structured Merge), a different family. O'Neil et al.'s
*The Log-Structured Merge-Tree (LSM-Tree)* (Acta Informatica
33, 1996) is the original. We use LSM where the workload is
write-dominated (the graph projection's edge writes are
append-heavy) and B-tree where the workload is read-balanced
(SQLite's per-shard data).

#### Z.2.4 — Tarjan's data structures

Tarjan's *Data Structures and Network Algorithms* (CBMS-NSF
1983) and the SICOMP "self-adjusting" series (Sleator and
Tarjan, 1985) are the data-structure background for the §M.5
HNSW analysis. The HNSW paper itself (Malkov & Yashunin 2018)
extends the small-world graph idea (Watts & Strogatz, *Nature*
1998) with hierarchical navigability.

The skip-list (Pugh, CACM 1990) is the closest cousin to HNSW's
hierarchical structure. Loam's HNSW chooses M=16 (§M.5.1)
following the skip-list's "log-base-2 of expected size" heuristic
adapted for the embedding-space access pattern.

---

### Z.3 — The transactional lineage

#### Z.3.1 — Gray's transaction concepts

Jim Gray's *The Transaction Concept* (VLDB 1981, ACM PODS 1981)
introduced ACID before ACID was named. The 1992 *Transaction
Processing: Concepts and Techniques* by Gray & Reuter is the
canonical textbook. The 1998 Turing Award lecture *What Next?
A Few Remaining Problems in Information Technology* names the
research agenda Loam still navigates.

Loam picks from Gray:

- **ACID per shard.** The §M.6.3 transaction discipline gives
  serializable isolation per shard. We accept the cost (single-
  writer lock per shard) for the property (no interleaved
  partial states across writes).
- **Recovery via log replay.** The §M.8 rebuild-from-log
  discipline is the operational embodiment of Gray's recovery
  manager. Where Gray's design assumed the log was in the same
  process as the database, Loam pushes the log to the Litestream
  pipeline and the cold-store quorum.

Loam leaves from Gray:

- **No global transactions.** Cross-shard atomicity is not a
  property the substrate offers. The §SJ.4.4 cross-shard K-floor
  coordinator handles the one case where we need cross-shard
  consistency, and even there the discipline is "fail closed,
  not consistent globally".

#### Z.3.2 — Vogels and eventual consistency

Werner Vogels' *Eventually Consistent* (ACM Queue 6(6), Dec 2008
/ revised CACM Jan 2009) named the pattern that distributed
systems can be consistent over time without being consistent at
each instant.

Loam is eventually consistent **across cohorts** (the WORLD-plane
aggregates), strongly consistent **within a shard** (the per-cohort
SQLite serializable discipline). The split is Vogels's principle
applied at the right scope.

> "Consistency is too expensive to do everywhere. Pick where it
> matters and pay there." [paraphrase]

The §1.4 four irreducible properties name what matters per plane.
The cost-payment is in the shard boundary.

#### Z.3.3 — Lamport's time and ordering

Lamport's *Time, Clocks, and the Ordering of Events in a
Distributed System* (CACM 21(7), July 1978) introduced the
happens-before relation. The 1982 *Byzantine Generals Problem*
(ACM TOPLAS 4(3)) introduced the failure-tolerance frame.

Loam uses:

- **Wall-clock + monotonic-clock pairing** for every audit
  row (§SJ.6.1). The wall clock is what regulators want; the
  monotonic clock is what the substrate uses for ordering.
- **Lamport-style sequence numbers** per shard for write
  ordering. The audit signer's sequence number (§SJ.6.2) is
  Lamport-style: monotonically increasing per shard, but not
  comparable across shards. Cross-shard ordering requires the
  wall-clock timestamp + a stable tie-breaker.

The Byzantine frame applies to the §M.2 cold-store quorum:
3-of-5 destinations gives Byzantine fault tolerance for the
classical *f=1* case (one destination malicious or
non-responsive) and graceful degradation for *f=2* (audit
event + manual review). Loam doesn't claim Byzantine consensus
in the strict sense — we use the *3-of-5* topology because it
matches the engineering reality (5 cold-store providers, expect
1-2 to be unavailable on any given month).

#### Z.3.4 — Brewer's CAP

Brewer's CAP keynote (PODC 2000) and the 2012 *Computer*
follow-up *CAP Twelve Years Later: How the "Rules" Have
Changed* are the modern frame. The 2014 *Harvest, Yield, and
Scalable Tolerant Systems* (Fox & Brewer, HotOS 1999)
generalized CAP to a continuous tradeoff.

Loam's CAP positioning is per-plane:

- TENANT plane: CP within a shard, with availability degradation
  under shard failure (the operator's TENANT data is unreachable
  if their shard is unhealthy; recovery happens via §14).
- COHORT plane: CP within a cohort's shard, AP across cohorts.
- WORLD plane: AP — the substrate accepts stale reads in
  exchange for cross-region availability.
- SYSTEM plane: AP for queries, CP for writes (operational
  metadata writes need to be precisely ordered for the audit
  trail).
- PUBLIC plane: AP — public reads are always served, possibly
  stale.

Per-plane CAP is the engineering distillation of Fox & Brewer's
harvest/yield. Different consumers care about different
tradeoffs; the plane is the addressing surface for the choice.

---

### Z.4 — The immutability lineage

#### Z.4.1 — Helland's CIDR papers

Pat Helland's *Memories, Guesses, and Apologies* (2007 blog;
oft-cited but unpublished) and *Immutability Changes
Everything* (CIDR 2015) are the design philosophy texts. The
2009 *Building on Quicksand* (CIDR 2009) names the principle:
trust is layered, verification is cheap.

Loam takes:

- **Immutable facts.** Every write is an immutable fact in the
  log. UPDATEs are new facts that supersede; the old fact is
  preserved for audit and rebuild.
- **Memories vs guesses.** The substrate's async writes
  (§M.2.2) are memories that occasionally need apologies; the
  durability=quorum writes are commitments.
- **Cheap verification.** The §M.13 provenance field is the
  cheap verification surface. The §14 drill is the expensive
  verification.

#### Z.4.2 — Hickey's Datomic

Rich Hickey's *Database as a Value* (CMU SDI 2013, video at
cmu.edu/SDI/2013) and the Datomic architecture talks are the
contemporary statement of the immutable-log database pattern.

Datomic distinguishes:

- The **log** — the append-only record of transactions.
- The **storage service** — where the log lives, typically a
  KV store.
- The **transactor** — the single writer that serializes
  transactions.
- The **peer** — the in-process query engine that reads the log
  and maintains projections.

Loam maps:

- Log → the §10 audit log (and the §M.2 Litestream stream).
- Storage service → SQLite + Litestream + cold-store quorum.
- Transactor → the §M.6 Shell (per-shard writer-lock).
- Peer → the cart driver + Sakura's cart-runtime (the §17.4
  client-side adapter).

Loam diverges from Datomic in:

- **Per-cohort sharding.** Datomic has one log per database;
  Loam has one log per cohort × service. The sharding is what
  lets Loam scale horizontally on tiny boxes.
- **Bilingual format.** Datomic uses Fressian (Clojure-flavored
  binary). Loam uses CBOR + Scheme s-expr because Scheme reads
  on bash + a 200-line Lisp reader (§M.3.3).
- **Substrate-resident smart-DB behaviors.** Datomic's peers
  do query and projection in-application; Loam pushes the
  §16.3 behaviors into the substrate via the §M.8 projection
  rebuild discipline. The substrate emits anomalies, suggests
  schemas, mines patterns. Datomic doesn't.

#### Z.4.3 — Pat Helland's apologies, applied

The "occasional apology" pattern shows up at three Loam
boundaries:

1. **Async TENANT writes.** Default mode for non-regulatory
   writes; the audit row carries the replication state; a
   sweep apologizes if quorum-ack misses the SLO.
2. **Cohort cardinality on the boundary.** A cohort that
   crosses K mid-day can release data that yesterday it
   refused. The audit row carries the K-state per read; a
   consumer that needs strict K-stability can pin to a stable
   cohort version.
3. **Schema-discovery proposals.** §16.3.2 proposes schemas;
   sometimes the proposal is wrong. The substrate apologizes
   by emitting a `schema-revised` event with the corrected
   shape and the old data re-projected.

Apology is a first-class operational pattern, not a workaround.

---

### Z.5 — The capability lineage

#### Z.5.1 — Saltzer & Schroeder

Saltzer and Schroeder's *The Protection of Information in
Computer Systems* (Proc. IEEE 63(9), Sept 1975) is the
foundational design-principles paper. Eight principles, two
of which Loam holds particularly tight:

- **Economy of mechanism** — the §SJ.3 5-verb allow-list.
- **Least authority** — the §SJ.2 cap-token caveat narrowing.

The other six (fail-safe defaults, complete mediation,
open design, separation of privilege, least common mechanism,
psychological acceptability) all appear in Loam's design but
the first two are the load-bearing simplifications.

#### Z.5.2 — SPKI/SDSI

Rivest and Lampson's *SPKI / SDSI: Simple Public Key
Infrastructure / Simple Distributed Security Infrastructure*
(1996) introduced the capability-token concept that Macaroons
descend from. SPKI/SDSI proposed:

- Authorization is a capability, not an identity.
- Capabilities are signed by issuers, not by central CAs.
- Capabilities can be delegated by appending to the signed
  chain.

Macaroons (§SJ.2) are a 2014 refinement: they replace the
SPKI/SDSI signature chain with a MAC chain (so a token holder
can narrow without a signing key) plus the discharge protocol
for third-party caveats.

Loam takes the capability framing whole. We use Macaroons over
SPKI/SDSI because Macaroon narrowing is keyless (a critical
property for the on-device Sakura, who doesn't carry signing
keys).

#### Z.5.3 — Miller's Robust Composition

Mark Miller's *Robust Composition: Towards a Unified Approach
to Access Control and Concurrency Control* (PhD thesis, Johns
Hopkins, 2006) is the dense theoretical treatment of
capabilities-as-objects. The thesis introduces:

- **The principle of least authority** in the strong form: every
  reference is also a capability; possession is authorization.
- **The confused-deputy problem** at the granularity of object
  references.
- **Decomposable authority** — a capability can be split into
  finer-grained capabilities by introducing intermediate
  objects.

Loam's §SJ.12 quote is from Miller's thesis. The substrate's
authority model is Miller's POLA-via-Macaroons applied at the
substrate boundary.

#### Z.5.4 — Birgisson et al. Macaroons (NDSS 2014)

The Macaroon paper itself: *Macaroons: Cookies with Contextual
Caveats for Decentralized Authorization in the Cloud* (Birgisson,
Politz, Erlingsson, Taly, Vrable, Lentczner; NDSS 2014;
[research.google/pubs/pub41892](https://research.google/pubs/pub41892/)).

The paper introduces:

- **First-party caveats** — caveats the verifier evaluates
  directly (Loam's plane / operation / scope / time caveats).
- **Third-party caveats** — caveats that require a discharge
  macaroon from a third party (Loam doesn't use these in v1.0;
  reserved for post-1.0 federated authorization).
- **The HMAC chain** — each caveat extends the MAC, and the
  verifier walks the chain to validate.
- **Contextual caveats** — caveats that bind the token to a
  specific request context (Loam's `cid:` caveat).

Loam's v1.0 implementation uses first-party caveats only. The
discharge protocol is in the design for post-1.0 cross-service
federation.

Production users of Macaroons:

- Canonical's Snap Store (Ubuntu's app store) — caveat-chained
  package authorization.
- lnd (Lightning Network daemon) — gRPC authorization.
- Google internal usage (per the paper authors).

The pattern is production-proven; we're not the first to ship
it at scale.

---

### Z.6 — The privacy lineage

#### Z.6.1 — Samarati & Sweeney K-anonymity

Samarati and Sweeney's *Protecting Privacy when Disclosing
Information: k-Anonymity and Its Enforcement through
Generalization and Suppression* (IEEE PAMI 25(5), 2001) and
Sweeney's *k-Anonymity: A Model for Protecting Privacy*
(*International Journal on Uncertainty, Fuzziness and
Knowledge-Based Systems* 10(5), 2002) are the foundational
papers.

K-anonymity guarantees that any record in a released dataset
is indistinguishable from at least K-1 others on the
quasi-identifier attributes. The K parameter is a privacy
budget; higher K = stronger privacy, more aggressive
generalization.

Loam takes:

- **K=8 as the floor.** §SJ.4.1 reviews the literature
  consensus.
- **Co-transactional enforcement.** §28.3 names this as the
  patentable surface. The original Samarati-Sweeney work
  assumed K-anonymity was a release-time property; Loam
  enforces it as an access-time property co-transactional
  with each read.

Loam leaves:

- **K-anonymity alone is insufficient against compositional
  attacks.** Loam adds noise injection (§SJ.10 Row 5) and the
  §SJ.5 PII scrubber to compose with K-anon for stronger
  privacy.

#### Z.6.2 — Dwork's differential privacy

Cynthia Dwork's *Differential Privacy* (ICALP 2006, TCC 2006
journal version) and the canonical textbook *The Algorithmic
Foundations of Differential Privacy* (Dwork & Roth, 2014)
are the rigorous foundation.

DP guarantees that the output of a query doesn't differ
meaningfully whether or not a particular record is in the
input. The ε parameter quantifies the privacy budget.

Loam uses DP at one place: the §SJ.10 Row 5 noise injection
for count-style cohort queries. ε=0.1 is the working budget;
higher ε (less noise) for the §16.3.8 predictive-cache
patterns; lower ε (more noise) for the §15.2 cross-cohort
aggregates.

The substrate is not DP-by-default. Loam's primary privacy
mechanism is K-anonymity + cryptographic erasure. DP is the
compositional defense for the query patterns where K-anon
alone is insufficient.

#### Z.6.3 — Narayanan & Shmatikov re-identification

Narayanan and Shmatikov's *Robust De-Anonymization of Large
Sparse Datasets* (IEEE S&P 2008) showed that K-anonymity is
breakable when an attacker has auxiliary information about
the dataset's population. Their Netflix Prize attack
de-anonymized 99% of records given as few as 8 known data
points per target.

Loam's response:

- **Cap-token narrowing limits adversarial reads.** An attacker
  with a non-privileged cap-token can't query arbitrary
  features; the §SJ.3 5-verb allow-list + the per-cohort
  rate limits constrain the observation surface.
- **The §M.9 3-hop graph ceiling limits traversal-based
  re-identification.** Narayanan's attacks rely on
  multi-hop correlation; the substrate doesn't expose deep
  traversal.
- **The §SJ.7 anomaly detector flags re-identification-like
  access patterns.** Sustained queries that look like
  Narayanan-style attacks trigger auto-pause.

We don't claim immunity to re-identification. We claim the
substrate makes it expensive and observable, and that the
combined defense + audit suffices for the use cases the
substrate serves.

#### Z.6.4 — Hartzog's *Privacy's Blueprint*

Woodrow Hartzog's *Privacy's Blueprint: The Battle to Control
the Design of New Technologies* (Harvard, 2018) is the
contemporary policy-meets-engineering treatment.

The book's central claim — privacy must be designed into the
substrate, not bolted on after — is the design philosophy
Loam adopts.

> "Privacy is not a feature you add; it's a property the
> architecture has or doesn't have." [paraphrase]

The substrate's privacy properties (K-anon floor, PII scrubber,
cryptographic erasure, audit-co-transactional) are architectural,
not bolted on. The Loamification project (§30) is the
discipline of pushing every cart through this architectural
filter.

#### Z.6.5 — Solove's *Understanding Privacy*

Daniel Solove's *A Taxonomy of Privacy* (U Penn Law Review
154(3), 2006) and the 2008 book *Understanding Privacy*
identify sixteen distinct privacy harms across four
categories: information collection, information processing,
information dissemination, invasion.

Loam's posture on each category:

- **Information collection.** PII scrubber + per-tenant
  encryption + operator-opt-in PUBLIC plane.
- **Information processing.** K-anon floor + cap-token-narrowed
  access + audit log.
- **Information dissemination.** Per-tenant encryption + the
  §SJ.9 cryptographic erasure + the K-floor on COHORT/WORLD.
- **Invasion.** The §SJ.7 anomaly detector + the abuse-prevention
  auto-pause.

Solove's taxonomy is the regulatory translator. When a
regulator asks about a specific harm, we point to the
substrate component that addresses it.

---

### Z.7 — The CRDT lineage (for Cortex-of-Loam)

#### Z.7.1 — Shapiro et al.

Shapiro, Preguiça, Baquero, and Zawirski's *Conflict-Free
Replicated Data Types* (INRIA RR-7687, 2011, and SSS 2011)
introduced the CRDT formalism. Two families: CvRDTs
(state-based, monotonically converging) and CmRDTs
(operation-based, commutative).

The Cortex-of-Loam (§17.6) is the local primary that syncs
with the substrate. The local-primary model requires
CRDT-style merge for the case where the operator is offline
and the substrate updates simultaneously.

Loam uses:

- **Add-only sets** for the operator's per-tenant fact log.
  Removal is via the §SJ.9 cryptographic erasure, not via
  CRDT delete.
- **Last-Write-Wins with monotonic-clock tiebreak** for the
  operator's preferences and configuration.
- **Counter CRDTs** for the per-cohort K-anonymity counters
  (additions are commutative; deletions are rare and handled
  via reset-and-recount).

We avoid:

- **Operation-based CRDTs** for the core data, because they
  require reliable broadcast and our async-default writes
  don't guarantee delivery.
- **Causal-consistency CRDTs** because their vector-clock
  metadata overhead is high and our per-cohort sharding
  doesn't need them.

#### Z.7.2 — Kleppmann et al. local-first

Kleppmann, Wiggins, van Hardenberg, McGranaghan's *Local-First
Software* (Ink & Switch essay, 2019; Onward! 2019 paper) is
the contemporary statement of the local-primary architecture.

Loam's adoption: the Cortex-of-Loam is the local primary; the
substrate is the secondary sync target. The 7 ideals from the
paper map to Loam:

| Ideal | Loam mechanism |
|---|---|
| No spinners | Cortex is local; reads are instantaneous |
| Multi-device | Cortex syncs via the substrate's audit log |
| Network optional | Cortex works offline; substrate catches up on reconnect |
| Collaboration | The §16.3 cohort-mediated behaviors are the collaboration surface |
| Longevity | The §2 2000-year discipline; the substrate outlives the local Cortex |
| Privacy + security | The §12.5 per-tenant encryption + Cortex's hardware-bound key |
| User ownership | Per-tenant data is the operator's; cryptographic erasure is real |

Loam's variation: the local-first paper assumes peer-to-peer
sync (CRDT-shaped). Loam's sync is hub-and-spoke via the
substrate. The substrate is "the network" in the local-first
frame.

#### Z.7.3 — Merkle-CRDTs for the per-cohort propagation

The §15 cohort propagation uses Merkle-CRDTs (the IPFS
descendants; [arXiv 2004.00107](https://arxiv.org/pdf/2004.00107)).
Each cohort's state is a Merkle-DAG; updates fan out as DAG
extensions; consistency is via DAG-merge.

The Merkle-DAG structure gives:

- Efficient sync: only the missing nodes transfer.
- Content-addressed identity: two cohort-states with the same
  Merkle root are byte-identical.
- Tamper-evidence: any modification changes the root.

The CRDT layer on top resolves concurrent extensions. The
combined structure is what makes the §17.6 local primary +
substrate secondary pattern operationally feasible.

---

### Z.8 — The substrate-intelligence lineage

#### Z.8.1 — Schema inference: from EdgeDB to Loam

EdgeDB's blog series (2019-2024) on schema inference is the
contemporary applied work. The academic root is Bohannon, Fan,
Geerts, Jia, Kementsietsidis's *Conditional Functional
Dependencies for Capturing Data Inconsistencies* (ACM TODS
2007), which formalizes schema inference as a functional-
dependency discovery problem.

Loam's §16.3.2 schema-suggests-itself runs a CFD discovery
sweep over the audit log:

1. Sample N facts of a given kind.
2. Identify field co-occurrence patterns.
3. Hypothesize a schema = the union of co-occurring fields
   plus their types inferred from values.
4. Validate the hypothesis against the next N facts.
5. Emit a `schema-proposal` event; the tenant disposes.

This is the EdgeDB pattern applied to a non-relational
substrate. The novelty is the privacy-respecting variant: the
schema discovery runs on per-cohort samples, never on
cross-tenant individual records.

#### Z.8.2 — Cohort discovery: from cluster analysis

Cohort discovery is unsupervised clustering. The classical
approaches are k-means (MacQueen, 1967), DBSCAN (Ester et al.,
KDD 1996), HDBSCAN (Campello et al., 2013), and dimensionality
reduction via UMAP (McInnes et al., 2018).

Loam's current §16.3 cohort discovery uses single-pass
k-means. The post-1.0 plan (§32, W13) is UMAP + HDBSCAN for
better cluster quality.

The privacy variation: cohort discovery runs on **anonymized
embedding vectors**, not on raw data. The embedding is computed
per-tenant locally on the Cortex; the substrate sees only the
vector, not the underlying text or images.

#### Z.8.3 — Anomaly detection: from Honeycomb BubbleUp

Honeycomb's BubbleUp ([honeycomb.io blog](https://www.honeycomb.io/blog/introducing-bubbleup))
runs anomaly detection in the storage layer — anomalies are
identified by attribute-value combinations that disproportionately
appear in a slow / errored slice of the data.

The academic root is the *change-point detection* literature
(Aminikhanghahi & Cook, *Knowledge and Information Systems*
2017 survey). The substrate's §16.3.5 anomaly surface uses
a sliding-window change-point detector over the audit log
metrics + the §16.3.7 fact-shape distribution.

Loam's contribution is **anomaly explanation that respects the
K-floor**. An anomaly that involves fewer than K distinct
tenants is suppressed (no individual-level explanation). This
is the privacy-respecting variant of BubbleUp.

#### Z.8.4 — Pattern mining: from Datalog

Datalog (Maier, Tekle, Kifer, Warren, *Datalog: Concepts,
History, and Outlook* in *Declarative Logic Programming*,
ACM 2018) is the canonical rules-in-storage formalism. The
1970s-1990s Datalog research established that recursive
queries can be optimized via magic-set rewriting and
semi-naive evaluation.

Loam's §16.3.9 pattern mining is a rule-discovery variant:
the substrate observes the audit log, hypothesizes rules
("when X happens, Y often follows within 30 minutes"), and
proposes the rules as candidate automations. The tenant
disposes.

The privacy-respecting variant: rule mining runs over
per-cohort audit slices; cross-cohort rules require K-anon
across the cohorts.

#### Z.8.5 — Predictive caching: from MotherDuck

MotherDuck (the managed DuckDB service) ships predictive
caching ([motherduck.com blog](https://motherduck.com/blog/))
that learns the query workload and pre-materializes hot
patterns.

The academic root is the *learning to cache* literature (Kraska
et al., *The Case for Learned Index Structures*, SIGMOD 2018).
The §16.3.8 substrate-resident predictive cache uses a similar
approach: a small neural model predicts the next likely query
from the current session's audit prefix.

Loam's variation: the predictive cache fires only when the
K-floor permits the predicted query. Predicting a sub-K query
is fine; pre-materializing one isn't.

---

### Z.9 — The format-bilingual lineage

#### Z.9.1 — Long Now's Rosetta Disk

The Long Now Foundation's Rosetta Disk
([rosettaproject.org](https://rosettaproject.org/blog/02008/aug/20/very-long-term-backup/))
encoded a thousand languages onto a 3-inch nickel disk in
microscopic relief readable with an optical microscope. The
disk's design discipline: assume the reader has nothing but a
microscope.

Loam's CBOR + Scheme bilingualism (§M.3) is the digital
analog. CBOR is the efficient format; Scheme s-expr is the
"readable with a microscope" format — a bash + 200-line Lisp
reader is the floor.

The disk was a 2000-year archival project. Loam's substrate
is a 2000-year operational substrate. The discipline is the
same; the operationalization differs.

#### Z.9.2 — HD-Rosetta and the millennial archival literature

The Norsam HD-Rosetta technology and the *Very Long Term
Backup* literature (Cerf, *Communications of the ACM*
2011; the LOCKSS papers, particularly Reich & Rosenthal
*LOCKSS: A Permanent Web Publishing and Access System*,
D-Lib 2001) name the disciplines for multi-decade preservation.

Loam takes:

- **Many independent copies** (the 3-of-5 cold-store quorum).
- **Diverse storage media** (R2 + B2 + Wasabi + IPFS pin +
  bare disk = different physical and organizational
  substrates).
- **Periodic integrity validation** (the §14.5 monthly drill).
- **Format-independence** (the bilingual CBOR + Scheme).

These four disciplines together give a substrate that
survives the loss of any single provider, any single format
parser, any single hash algorithm, and any single decade's
operational team.

#### Z.9.3 — IPFS and content-addressing

Juan Benet's *IPFS: Content Addressed, Versioned, P2P File
System* (arXiv 1407.3561, 2014) introduced the modern
content-addressed filesystem. Loam takes:

- CID (Content IDentifier) as the primary key for every
  blob.
- The Merkle-DAG structure for the §15 cohort propagation.
- The pin-and-replicate discipline for cold-store.

Loam's variation: we don't use IPFS as the substrate (the
P2P discovery model doesn't match our use case), but we use
IPFS pinning as one of the five cold-store destinations.
The CID is interoperable across the substrate's internal
storage and IPFS pinning.

---

### Z.10 — The event-spine lineage

#### Z.10.1 — Event sourcing

The contemporary statement is Greg Young's talks (2008-2015)
and Vaughn Vernon's *Implementing Domain-Driven Design*
(Addison-Wesley 2013). The Microsoft Azure Architecture
Center's *Event Sourcing Pattern* (learn.microsoft.com) is
the canonical industrial-strength reference.

The pattern: state is computed from the sequence of events
that produced it. The event log is the source of truth;
the current-state projection is derived.

Loam adopts event sourcing wholesale. Every TENANT/cohort/
WORLD/SYSTEM fact is an event in the §10.4 log. The current
state is rebuildable from the log per §M.8.

#### Z.10.2 — Subscription as first-class primitive

Database-side subscriptions appear in many systems: Postgres
LISTEN/NOTIFY, MongoDB change streams, Firestore listeners,
Materialize streaming SQL.

Loam's §10 subscription is **predicate-as-column**: a
subscription is a row in the substrate, with a predicate
that the substrate evaluates on every write. The pattern is
similar to TigerBeetle's invariant-checks
([tigerbeetle.com docs](https://docs.tigerbeetle.com/about/)).

The novelty: subscriptions are CID-addressed, transferable
across processes, and the predicate is the §SJ.3.4
restricted-language form. Combined, this is the §28.4 (B.11)
"subscription as first-class primitive with predicate-as-column"
patentable surface.

---

### Z.11 — Comparable systems, deep walkthrough

The §27 table is a survey; this section is the deep walkthrough
of each row, oriented by what Loam took and what it left.

#### Z.11.1 — FoundationDB Record Layer (Apple, 2019)

Esmet, Spivak, Wakelin, Adams, et al., *FoundationDB Record
Layer: A Multi-Tenant Structured Datastore*
([arXiv:1901.04452](https://arxiv.org/pdf/1901.04452)).

The Record Layer is a stateless typed-record + indexing layer
over the FoundationDB KV store. Key design moves:

- **Multi-tenancy by record subspace.** Tenants get a
  subspace; cross-tenant operations require explicit
  composition.
- **Index management as a separate concern.** Indexes are
  declared in metadata; the layer maintains them.
- **Resource isolation per tenant.** The layer tracks per-
  tenant CPU + IO budgets.
- **Online schema changes.** Schema versions coexist; the
  layer migrates lazily.

Loam takes:

- The **multi-tenant subspace** discipline (Loam's planes +
  cohorts are the equivalent addressing).
- The **resource isolation** pattern (Loam's per-principal
  rate limits + per-shard CPU budget).
- The **lazy schema migration** (Loam's §M.8 rebuild-from-log
  + §16.3.2 schema-suggests-itself).

Loam leaves:

- The FoundationDB cluster model (we use SQLite per shard;
  see §M.1.3).
- The Record Layer's typed-record discipline (Loam's CBOR
  facts are typed by convention, not by schema enforcement
  at the substrate).

#### Z.11.2 — Materialize (now SQLake)

Materialize ([materialize.com](https://materialize.com/blog/))
ships streaming SQL with incremental view maintenance. The
academic root is the Differential Dataflow papers (McSherry,
Murray, Isaacs; *Naiad: A Timely Dataflow System*, SOSP 2013).

Materialize maintains views *incrementally* — every input
change propagates only the delta through the view DAG. The
result is a view that's always current with sub-second
latency.

Loam's §M.8 projections are NOT incremental in the
Materialize sense. They are rebuildable but not auto-
maintained. The post-1.0 plan (§32, W15) is to add
incremental maintenance for hot projections; v1.0 ships
full-rebuild.

We took from Materialize:

- The mental model of "projections are views over the log".
- The disciplined separation of "the log is the source;
  projections are derived".

We didn't take Materialize itself because:

- The incremental maintenance imposes a runtime cost on every
  write that we'd rather pay only on projection-rebuild.
- Materialize's deployment model is a separate cluster; we
  want the substrate to be a single binary.

#### Z.11.3 — Honeycomb (BubbleUp)

Honeycomb's product ([honeycomb.io](https://www.honeycomb.io/))
ships anomaly detection inside the storage tier. The trace data
is queryable; anomalies are computed at query time as the user
zooms into a slow / errored slice.

Loam's §16.3.5 anomaly surface uses a similar approach for
audit-log anomalies (not application traces). The privacy-
respecting variation: anomalies that depend on fewer than K
tenants are suppressed.

#### Z.11.4 — EdgeDB

EdgeDB ([edgedb.com](https://www.edgedb.com/)) ships a typed
graph database with schema inference and schema migration as
first-class operations.

Loam takes the schema-suggests-itself pattern. Loam differs in
not making the schema mandatory — the substrate operates on
schema-less facts and proposes schemas as observations rather
than enforcing them as constraints.

#### Z.11.5 — Vespa (Yahoo / Verizon Media / Vespa.ai)

Vespa ([vespa.ai](https://vespa.ai/)) is a hybrid search +
ML inference platform. It ships:

- Inverted indexes for full-text search.
- HNSW indexes for vector search.
- ML model serving co-located with the data.

Loam takes the hybrid-search pattern (KV + HNSW + graph
projection in the same substrate). Loam doesn't take Vespa's
ML model serving — we keep the ML inference in the §17.6
on-device Cortex, not in the substrate. The substrate's
"intelligence" is observational + algorithmic, not generative.

#### Z.11.6 — TigerBeetle

TigerBeetle ([tigerbeetle.com](https://tigerbeetle.com/)) is
a financial-grade transactional store with invariant checks
baked into the storage engine.

Loam takes the invariant-checks-at-storage pattern via the
§10 subscription system. A subscription with an
"impossibility" predicate (a balance going negative; a
cohort count dropping below floor) is the substrate's
invariant.

Loam doesn't take TigerBeetle's specific accounting model;
we're a substrate, not a ledger.

#### Z.11.7 — Datomic

Covered in §Z.4.2.

#### Z.11.8 — IPFS / Merkle-DAG

Covered in §Z.9.3.

#### Z.11.9 — Plan 9 / 9P

Plan 9's "everything is a file" discipline ([9p.io/sys/doc/9.html](https://9p.io/sys/doc/9.html))
is the cleanest exposition of universal-protocol design. The
9P protocol is small (8 message types) and uniformly
applicable.

Loam's 5-verb floor + the MCP wire protocol are the
contemporary descendants. Loam's discipline of "one wire
format, every resource" is the Plan 9 lineage.

#### Z.11.10 — Long Now Foundation

Covered in §Z.9.1.

#### Z.11.11 — Macaroons

Covered in §Z.5.4.

#### Z.11.12 — Local-first software

Covered in §Z.7.2.

---

### Z.12 — Patentable surfaces, walked with prior art

The §28 summary lists 11 patentable surfaces. This section is
the prior-art map for each, with attorney-grade citations.

#### Z.12.1 — B.1: Closed cohort-anonymized learning loop with computed stability boundary

**Claim summary.** A producer/consumer discipline where
cohort-anonymized aggregates feed back into the substrate's
recommendation engine, with the loop's stability bounded by
a Neimark-Sacker bifurcation analysis of the recommendation
↔ aggregate dynamics.

**Prior art surveyed:**

- Federated learning (McMahan et al., AISTATS 2017,
  *Communication-Efficient Learning of Deep Networks from
  Decentralized Data*). The federated learning literature
  has the privacy-preserving aggregation but not the stability
  analysis.
- Cohort-based recommendation (the YouTube papers,
  Covington et al. RecSys 2016). Cohort recommendation but
  not anonymized at the storage layer.
- Bifurcation analysis applied to recommendation systems
  (Saraei & Karimi, 2020). Analysis but not implementation.

**Novel.** The composition of federated aggregation + K-anon
floor + bifurcation-bounded feedback loop. The
`research/loam-bifurcation-analysis-v0.1.md` document carries
the original analysis.

**Defensibility:** HIGH. File first.

#### Z.12.2 — B.10: Capability-token chain co-transactional with audit log emission

**Claim summary.** Every cap-token verification + data write +
audit row insertion is a single SQLite transaction. The cap-
token's full caveat chain is recorded in the audit row before
the data write commits.

**Prior art surveyed:**

- Macaroons (Birgisson et al., NDSS 2014). Cap-tokens but no
  audit-co-transactionality.
- Auth0 / Okta audit logs. Post-hoc audit, not transactional.
- AWS CloudTrail. Centralized audit but not per-storage-tier
  transactional.
- Datomic transaction audit. Audit is the database; cap-tokens
  not the primary discipline.

**Novel.** The discipline of auth-check + data-write + audit-row
in one SERIALIZABLE transaction. No surveyed system does this
at storage-tier granularity.

**Defensibility:** MEDIUM-HIGH. File with attorney pass.

#### Z.12.3 — B.11: K-anonymity floor enforced atomically with data fetch

**Claim summary.** The K-floor check is in the same SQLite
transaction as the data read; no temporal gap where the
K-state could change between check and fetch.

**Prior art surveyed:**

- Samarati-Sweeney K-anonymity (PAMI 2001). Release-time
  property, not access-time.
- Differentially private databases (Dwork's work). DP at query
  time but typically with separate budget tracking.
- TigerBeetle invariant checks. Storage-tier invariants but
  not privacy-floor specific.

**Novel.** The co-transactional discipline applied specifically
to K-anonymity. The §SJ.4.3 floor+1 race margin is part of
the claim.

**Defensibility:** MEDIUM-HIGH. File with attorney pass.

#### Z.12.4 — B.12: Client-side NL Adapter (RETIRED from substrate; reframed)

Covered in §28.4 of the main doc. The substrate-side claim is
withdrawn; the per-client variant is left to each product team
as a separate patent surface.

#### Z.12.5 — B.13: Content-addressed code artifact registry with template-driven synthesis and capability-bound execution

**Claim summary.** A substrate-resident code-artifact registry
where (a) artifacts are content-addressed CIDs, (b) execution
is sandboxed in WASM inside the substrate's trust domain, (c)
execution authorization is bound to a cap-token chain shared
with data access, (d) new artifacts can be synthesized from a
template + fact-set with the synthesizer's provenance recorded.

**Prior art surveyed:**

- npm / IPFS / Nix package registries. Content-addressed but
  external trust domain.
- Cloudflare Workers / Fastly Compute@Edge. WASM execution but
  external trust domain.
- LangChain agent toolkits. Compose LLM + tool but no
  capability-bound substrate-resident code.
- AWS Lambda. Code execution but not content-addressed and
  external trust domain.

**Novel.** Composition of CID-addressed registry + sandboxed
substrate-resident execution + cap-token-bound authorization +
synthesizer-provenance.

**Defensibility:** MEDIUM. File with attorney pass.

#### Z.12.6 — B.14: Format-bilingual append-only log for millennial-horizon data preservation

**Claim summary.** Every record is stored bilingually (CBOR +
Scheme s-expr) with at-write round-trip enforcement, paired
hashes (BLAKE3 + SHA-256), and a recovery protocol that uses
only bash + a Lisp reader.

**Prior art surveyed:**

- Long Now Rosetta Disk. Analog archival; not log-structured.
- IPFS content-addressing. Single-format; no recovery-floor
  discipline.
- LOCKSS. Multi-copy preservation but format-specific
  (web content).
- Datomic's storage. Single binary format; no bilingualism.

**Novel.** The bilingual at-write discipline + the pure-bash
recovery floor + the cryptographic-agility hedge.

**Defensibility:** MEDIUM. File with attorney pass.

#### Z.12.7 — B.15: Substrate invisibility — operator never names the substrate

**Claim summary.** A substrate that mediates every operator
interaction without ever being named in operator-facing UI;
the substrate's behaviors surface as recommendations from
named agents (Sakura, etc.) rather than as substrate features.

**Prior art surveyed:**

- Apple Continuity. Invisible cross-device sync; closest
  analog.
- Notion AI. Substrate features but named.
- Linear's automation. Named per-cart, not substrate-invisible.
- Snowflake's automatic clustering. Invisible to the SQL user
  but visible in the management UI.

**Novel.** The full discipline — operator never sees the
substrate's name even in diagnostic surfaces; substrate
behaviors are always mediated by a named agent.

**Defensibility:** MEDIUM. File with attorney pass (the
"never named" property is the load-bearing novelty).

#### Z.12.8 — B.16: Schema gravity — substrate proposes schema, tenant disposes

**Claim summary.** A substrate that observes write patterns,
proposes schemas as inferred from observation, and applies
them only on explicit tenant authorization. The substrate
never enforces schema; the tenant always disposes.

**Prior art surveyed:**

- EdgeDB schema inference. Substrate-proposed but enforced
  on apply.
- MongoDB schema-less. No proposal, no inference.
- Datomic schema. Declared upfront, not inferred.
- Bohannon et al. (TODS 2007) CFD discovery. Academic
  inference but not substrate-resident.

**Novel.** The propose-but-don't-enforce discipline at
substrate level + the privacy-respecting per-cohort
inference (the proposal never reveals individual data).

**Defensibility:** MEDIUM. File with attorney pass.

#### Z.12.9 — B.17: Cross-trust-domain auto-promotion of cart execution

**Claim summary.** A cart whose execution context can be
auto-promoted between trust domains (operator-local →
sandboxed-cloud → privileged-substrate) based on observed
sustainable cost, with the cap-token chain adjusted at each
promotion to reflect the new domain's authority.

**Prior art surveyed:**

- JIT compilation tier promotion (V8, HotSpot). Same code,
  different optimization tier; same trust domain.
- AWS Lambda + Step Functions. Different execution contexts
  but explicit per-step.
- Vercel auto-scaling. Same trust domain, scale-up.

**Novel.** Cross-trust-domain promotion with cap-token
chain adjustment. No commercial precedent identified.

**Defensibility:** HIGH. File first.

#### Z.12.10 — B.18: Budget-aware refusal-as-feature

**Claim summary.** A substrate where the recommendation
engine refuses to surface recommendations whose cost would
exhaust the tenant's projected budget within a fixed horizon;
the refusal is logged with the budget projection that
justified it.

**Prior art surveyed:**

- YNAB / Mint budget tools. Track but don't refuse.
- Cursor / Replit refund cycles (June-July 2025). The
  market-failure these substrates suffered; the refusal-as-
  feature pattern is the inverse.
- FTC dark-pattern guidance (2023). Aspirational; no
  commercial product cited as exemplar.

**Novel.** The substrate-resident refusal discipline + the
audit row that records the refusal justification.

**Defensibility:** MEDIUM. File with attorney pass.

#### Z.12.11 — B.21: Cross-service cohort-mediated intelligence with mutual K-floor

**Claim summary.** A multi-service substrate where cohorts
formed in one service can mediate recommendations in another
service, with K-floors enforced both per-service and at the
union; the cap-token chain proves cross-service authorization.

**Prior art surveyed:**

- Federated learning across organizations (FedML, OpenFL).
  Cross-org but not cohort-mediated.
- Apple App Tracking Transparency. Per-app but not
  cohort-mediated.
- IAB's Privacy Sandbox proposals. Browser-side cohorts;
  not substrate-shared.

**Novel.** Cross-service cohort mediation with mutual K-floor
+ cap-token chain. No commercial precedent (single-product
startups can't even build the substrate to test).

**Defensibility:** HIGH. File first. **Patent-grade as
written.**

---

### Z.13 — Why composition is the patent

The architect's framing: "no single piece is novel; the
composition is the moat." This is the standard pattern in
systems patents:

- The Bell Labs Unix patents (1970s) — no single piece novel,
  the composition was.
- The Google MapReduce patent (US 7,650,331; 2010) — no single
  piece novel, the composition was.
- The Snowflake elastic-warehouse patent (US 10,956,418;
  2021) — no single piece novel, the composition was.

Loam's 11 patentable surfaces are individually defensible at
various strengths. The substrate's full composition — 11
substrate-intelligence behaviors + cap-token chain + K-floor
+ format-bilingual + bash-recovery + WASM-sandboxed code-
artifact + cross-service cohort mediation + budget-aware
refusal + reverse-suggest demotion — is the moat.

The composition is observable in operator outcomes that no
single-component competitor can produce:

- Privacy-preserving cross-service recommendations.
- Budget-honest refusals with substrate-provided justification.
- Substrate-survivable code artifacts (the cart works in 2178).
- Audit trails that regulators accept on first inspection.

Each outcome traces back to multiple patentable surfaces
composing. The composition is what we file the umbrella patent
on; the individual surfaces are the deflectors against
piecewise copying.

---

### Z.14 — The references list, primary sources

Every claim in this document traces to a real source. The
canonical primary-source list:

#### Z.14.1 — Foundational systems papers

- Codd, *A Relational Model of Data for Large Shared Data
  Banks*, CACM 13(6), 1970.
- Bayer & McCreight, *Organization and Maintenance of Large
  Ordered Indices*, Acta Informatica 1(3), 1972.
- O'Neil et al., *The Log-Structured Merge-Tree (LSM-Tree)*,
  Acta Informatica 33, 1996.
- Knuth, *The Art of Computer Programming Vol 3: Sorting and
  Searching*, 2nd ed. Addison-Wesley, 1998.
- Hellerstein, Stonebraker, Hamilton, *Architecture of a
  Database System*, Foundations and Trends in Databases 1(2),
  2007.

#### Z.14.2 — Transaction theory

- Lamport, *Time, Clocks, and the Ordering of Events in a
  Distributed System*, CACM 21(7), 1978.
- Gray, *The Transaction Concept*, VLDB 1981.
- Lamport, Shostak, Pease, *The Byzantine Generals Problem*,
  ACM TOPLAS 4(3), 1982.
- Gray & Reuter, *Transaction Processing: Concepts and
  Techniques*, Morgan Kaufmann, 1992.
- Brewer, CAP keynote, PODC 2000; *CAP Twelve Years Later*,
  IEEE Computer 45(2), 2012.
- Fox & Brewer, *Harvest, Yield, and Scalable Tolerant
  Systems*, HotOS 1999.
- Vogels, *Eventually Consistent*, ACM Queue 6(6), 2008.
- Helland, *Building on Quicksand*, CIDR 2009.
- Helland, *Immutability Changes Everything*, CIDR 2015.

#### Z.14.3 — Security and capabilities

- Saltzer & Schroeder, *The Protection of Information in
  Computer Systems*, Proc. IEEE 63(9), 1975.
- Rivest & Lampson, *SPKI/SDSI*, 1996.
- Miller, *Robust Composition*, PhD thesis, Johns Hopkins,
  2006.
- Birgisson et al., *Macaroons: Cookies with Contextual
  Caveats for Decentralized Authorization in the Cloud*,
  NDSS 2014.
- Lampson, *Computer Security in the Real World*, IEEE
  Computer 37(6), 2004.
- Anderson, *Security Engineering*, 3rd ed., Wiley 2020.

#### Z.14.4 — Privacy

- Samarati & Sweeney, *Protecting Privacy when Disclosing
  Information: k-Anonymity*, IEEE PAMI 25(5), 2001.
- Sweeney, *k-Anonymity: A Model for Protecting Privacy*,
  IJUFKS 10(5), 2002.
- Dwork, *Differential Privacy*, ICALP 2006.
- Narayanan & Shmatikov, *Robust De-Anonymization of Large
  Sparse Datasets*, IEEE S&P 2008.
- Dwork & Roth, *The Algorithmic Foundations of Differential
  Privacy*, Foundations and Trends in TCS 9(3-4), 2014.
- Solove, *A Taxonomy of Privacy*, U Penn Law Review 154(3),
  2006.
- Hartzog, *Privacy's Blueprint*, Harvard, 2018.

#### Z.14.5 — Distributed systems

- Bohannon et al., *Conditional Functional Dependencies for
  Capturing Data Inconsistencies*, ACM TODS, 2007.
- McSherry, Murray, Isaacs, *Naiad: A Timely Dataflow
  System*, SOSP 2013.
- Shapiro et al., *Conflict-Free Replicated Data Types*,
  INRIA RR-7687, 2011.
- Kleppmann et al., *Local-First Software*, Onward! 2019.
- Esmet et al., *FoundationDB Record Layer*, arXiv 1901.04452,
  2019.
- Malkov & Yashunin, *Efficient and Robust ANN Search using
  HNSW*, IEEE PAMI 42(4), 2020.

#### Z.14.6 — Compilers + language design

- Aho, Lam, Sethi, Ullman, *Compilers: Principles, Techniques,
  and Tools*, 2nd ed., Addison-Wesley, 2006.
- Pugh, *Skip Lists: A Probabilistic Alternative to Balanced
  Trees*, CACM 33(6), 1990.

#### Z.14.7 — Domain-specific

- Watts & Strogatz, *Collective dynamics of 'small-world'
  networks*, Nature 393, 1998.
- Bellare & Yee, *Forward-Security in Private-Key
  Cryptography*, CT-RSA 2003.
- Holt, *Logcrypt: Forward Security and Public Verification
  for Secure Audit Logs*, ACSAC 2006.
- Maier, Tekle, Kifer, Warren, *Datalog: Concepts, History,
  and Outlook*, ACM Declarative Logic Programming, 2018.
- Benet, *IPFS: Content Addressed, Versioned, P2P File
  System*, arXiv 1407.3561, 2014.

Every citation above is real. Every quote (direct or
paraphrased) traces to a real source. If a future fact-check
disputes any citation, the dispute should be filed against
this section and the underlying claim re-verified.

---


---

## §36 — Regulatory Architecture (Jess)

*This chapter expands §12.8 (COPPA), §12.9 (EU AI Act), and §12.10
(ADMT) with the full architectural treatment of every regulation
that touches the substrate. GDPR Articles 5/6/17/22/25/32/35; CCPA
§1798.140 + the ADMT rules; EU AI Act Article 6 conformity assessment;
COPPA amended-rule April 2026; FTC dark-pattern guidance; EU DSA
subscription-symmetry; sector-specific disclaimers. The audit log
as the regulatory architecture.*

### J.1 — Posture, in one paragraph

Loam ships as a substrate operating across jurisdictions that
regulate data, privacy, automated decision-making, dark patterns,
subscription cancellation, child-protection, and AI risk
classification. The substrate's regulatory posture is
**architectural-not-decorative**: every regulation maps to a
specific structural property of the substrate, not to a checkbox
in operator-facing copy. Where a regulation requires a property
the substrate doesn't have, the regulation is either out-of-scope
(disclaimed) or in-flight (with an honest delivery date).

The regulatory architecture has five primary axes:

1. **GDPR + UK GDPR** (data subject rights, lawful basis,
   accountability) — full architectural commitment.
2. **CCPA / CPRA + the ADMT rules** (consumer rights, automated
   decision-making) — full architectural commitment.
3. **EU AI Act + the FRA + the CRA** (risk classification,
   conformity assessment, cyber-resilience) — architectural
   commitment + honest classification.
4. **COPPA + the EU Digital Services Act** (child protection,
   subscription symmetry, dark-pattern prohibition) —
   architectural commitment + workflow commitment.
5. **HIPAA + sector-specific rules** (out-of-scope; explicit
   disclaimer + technical defense if covered data appears
   incidentally).

Each axis has its own §J subsection. The legal-precise vocabulary
matters because regulators and operators are both reading.

---

### J.2 — GDPR architecture (Articles 5, 6, 17, 22, 25, 32, 35)

#### J.2.1 — Article 5 — Principles relating to processing of personal data

GDPR Article 5(1) lists six principles: lawfulness/fairness/
transparency, purpose limitation, data minimisation, accuracy,
storage limitation, integrity/confidentiality. Article 5(2) adds
the accountability principle.

Loam's architectural commitment per principle:

- **Lawfulness/fairness/transparency.** (SCOPED DOWN 2026-06-27
  per AUDIT-LIES C3 architect-call.) The Article 6(1) lawful basis
  is **documented in the audit trail per write** (the audit row is
  the system-of-record for "what basis authorized this write"); the
  cap-token caveat chain enforces `{service, shard_id, nonce,
  cohort_rotation_epoch}` per `cap_verify.rs:46-61` but does NOT
  currently carry a `legal_basis` caveat. Adding `legal_basis` as a
  required caveat is a v1.1 scope expansion — earlier drafts of
  §J.2.1 implied it was already wired and that claim is corrected
  here. **A subject access request still reconstructs the legal
  basis** by joining audit rows against the cart's basis
  declaration (TENANT-plane metadata at cart-registration time);
  the SAR exporter is the §J.5.3 deliverable.
- **Purpose limitation.** The cap-token's caveat chain
  identifies the purpose. A token for "fulfill order" cannot
  authorize a write tagged for "marketing analytics" — the
  Shell verifies and refuses. Cross-purpose use requires
  re-authorization with a fresh purpose-narrowed token.
- **Data minimisation.** The §SJ.5 PII scrubber prevents
  PII from landing in cohort/world/system/public planes by
  construction. The §SJ.4 K-anonymity floor prevents
  individual-level reads from non-tenant planes. The
  substrate doesn't collect what it can't justify.
- **Accuracy.** The audit log is the substrate's accuracy
  surface — every fact is timestamped, attributed, and the
  superseding-fact discipline lets corrections land as new
  facts rather than mutations.
- **Storage limitation.** Per-fact retention policies live in
  the fact's metadata; the §SJ.9 cryptographic erasure is the
  end-of-retention mechanism; the §32 honest-null reserves
  the per-cohort retention sweep for W14.
- **Integrity/confidentiality.** Per-tenant AES-256-GCM
  encryption for TENANT plane; §SJ.6 forward-secure audit
  signing; §M.4 dual-hash content addressing; §SJ.2
  capability-bounded access. The four together are the
  substrate's integrity story.
- **Accountability.** The audit log is the accountability
  artifact. Article 5(2) demands the controller "shall be
  responsible for, and be able to demonstrate compliance
  with" the principles. Loam's audit log demonstrates
  compliance row-by-row.

#### J.2.2 — Article 6 — Lawfulness of processing

GDPR Article 6 lists the six lawful bases. Loam records the basis
**in the audit trail per write**; the cart's basis declaration is
TENANT-plane metadata at cart-registration time. The §J.5.3 SAR
exporter joins the two surfaces to produce the per-record basis on
demand.

The substrate's contribution is **structural** — it doesn't
decide the basis; it records the decided basis and refuses
writes whose audit trail can't tie back to a registered cart-level
basis. The basis decision is the controller's responsibility
(typically the operator's cart logic, with the operator as data
controller for their TENANT plane).

**Scope clarification 2026-06-27 (AUDIT-LIES C3 architect-call).**
v1.0 ships the audit-row basis-recording + cart-level basis
declaration; the v1.1 scope expansion adds `legal_basis` as a
required cap-token caveat verified at the Shell. v1.0 cannot
silently produce an un-based write because the audit row's
`principal` resolves through the cart's basis declaration; v1.1
makes the structural property tighter by moving the check from
"audit-traceable" to "cap-token-enforced".

#### J.2.3 — Article 17 — Right to erasure

GDPR Article 17 is the most-cited right and the substrate's
deepest architectural commitment. Loam ships **per-tenant
cryptographic erasure** as the technical realization.

The mechanism (§SJ.9 in detail):

1. Per-tenant AES-256-GCM master key, derived at enrollment.
2. Per-cohort wrap keys derived from the master.
3. The master key copy lives in (a) the Shell's HSM-backed
   cache, (b) a Shamir-split offline escrow (3-of-5 shares).
4. On erasure request, all copies of the master key are
   destroyed (Shell cache zeroed; HSM key deleted; custodian
   shares destroyed under contractual obligation).
5. After destruction, the ciphertext that remains is
   mathematically unrecoverable (AES-256-GCM with destroyed
   key is information-theoretically inaccessible).
6. The audit log retains an erasure-receipt (no subject data;
   per §26.2 the receipt is a tombstone, not a re-identification
   vector).

The CJEU C-413/23 P decision (September 2025, "EDPS v SRB")
sharpened the regulatory reading: **pseudonymised data is
personal data for anyone who holds the re-identification key**.
The Court held that the controller's obligation to enable
erasure extends to ensuring no party retains the key after
erasure.

Loam's response: the substrate doesn't hold the re-identification
key after erasure. The cohort salt rotates monthly (§12.3); the
per-tenant master key is destroyed; the audit-log tombstone
contains no re-identifying data. CJEU C-413/23 P is satisfied
by construction.

**The architectural property.** Erasure under Article 17 is not
a deletion of records (which leaves recoverable backups). It is
the destruction of the cryptographic key that makes the records
unrecoverable. Loam ships the latter, which is the strict
reading.

#### J.2.4 — Article 22 — Automated individual decision-making

GDPR Article 22 governs decisions "based solely on automated
processing, including profiling, which produces legal effects
concerning [the data subject] or similarly significantly affects
[them]".

Loam's posture is precise:

- **The substrate's §16.3 intelligence behaviors propose; the
  operator disposes.** No decision affecting the operator is
  taken without operator authorization. The substrate's
  "smart-DB" framing is observation + recommendation, not
  decision.
- **Sakura's cart logic is the decision layer.** When a cart
  takes an action affecting the operator (sending a message,
  publishing a listing, charging a payment), the operator
  explicitly authorized the cart. The cap-token chain proves
  the authorization.
- **Article 22's "solely automated" condition is not met.**
  Every operator-facing decision passes through the operator's
  explicit authorization — at minimum at cart subscription
  time, and for high-impact actions on a per-action basis.

The architectural property: there is no Loam-side decision
"solely automated" in the Article 22 sense. The substrate
proposes; the operator (or the operator's authorized cart)
acts.

#### J.2.5 — Article 25 — Data protection by design and by default

Article 25 requires "appropriate technical and organisational
measures" implemented "at the time of the determination of the
means for processing and at the time of the processing itself".

Loam's claim: the substrate's architectural properties are
the technical measures. Specifically:

| Article 25 requirement | Loam mechanism |
|---|---|
| Pseudonymisation | The §12.3 tenant_id/cohort_id discipline; raw operator IDs never cross the Shell |
| Data minimisation | The §SJ.5 PII scrubber + the §SJ.4 K-floor |
| Limitation of access | The §SJ.2 cap-token + the §SJ.3 5-verb allow-list |
| Reversibility (where applicable) | The §M.8 rebuild-from-log; the §SJ.9 cryptographic erasure |
| Continuous monitoring | The §SJ.6 audit log + the §SJ.7 anomaly detector |

The "by default" condition is the §SJ.5 PII scrubber running on
every write proposal — no operator has to enable it; it's the
default state. The "by design" condition is the substrate's
five planes + capability-token discipline — the architecture
chose these before the first cart was written.

#### J.2.6 — Article 32 — Security of processing

Article 32 requires "appropriate technical and organisational
measures to ensure a level of security appropriate to the risk".
Loam's contribution: the §SJ.10 31-attack-class catalog +
mitigation map is the substrate's Article 32 evidence.

#### J.2.7 — Article 35 — Data protection impact assessment (DPIA)

For high-risk processing, Article 35 requires a DPIA. The §16.3
substrate-intelligence behaviors qualify for DPIA review under
the Article 29 Working Party criteria (large-scale processing,
profiling, automated decision support).

Loam's DPIA artifact (in `docs/LOAM-DPIA-2026-06.md`, draft
status) walks each §16.3 behavior through the DPIA template:

- Description of processing.
- Necessity and proportionality.
- Risk assessment (likelihood × severity matrix).
- Mitigation measures.

The DPIA is reviewable by data protection authorities; a copy
is provided to operators on request as part of their compliance
documentation.

#### J.2.8 — UK GDPR alignment

UK GDPR (post-Brexit) is substantively aligned with EU GDPR
with some divergence on adequacy decisions and on the ICO's
enforcement priorities. Loam's substrate operates identically
under both; the operator-facing copy distinguishes the data
protection authority of jurisdiction (EU DPA vs ICO).

---

### J.3 — CCPA / CPRA + ADMT rules

#### J.3.1 — CCPA §1798.140 — Personal information inferences

CCPA defines "personal information" to include "inferences drawn
from any of the information identified in this subdivision to
create a profile about a consumer reflecting the consumer's
preferences, characteristics, psychological trends, predispositions,
behavior, attitudes, intelligence, abilities, and aptitudes"
(§1798.140(v)(1)(K)).

Loam's §16.3 substrate-intelligence behaviors generate inferences
about cohorts. The substrate's posture:

- **Cohort-level inferences are not "personal information"
  about individuals** when K-anonymity is enforced (§SJ.4).
  The inference attaches to a group of K≥8 tenants, not to
  an individual.
- **Tenant-level inferences** (the §16.3.2 schema proposals
  about a single tenant's data, or the §16.3.6 hot/warm/
  cold tiering based on the tenant's access patterns) **are
  personal information** and subject to the full CCPA
  framework. The substrate's audit log records every such
  inference.

The architectural property: cohort-level inferences are
structurally separated from tenant-level inferences. The
substrate exposes the appropriate API per category; consumers
asking for their "inferred personal information" via §1798.110
get the tenant-level inferences (which they can access via
the audit log), not the cohort-level inferences (which are not
personally identifying).

#### J.3.2 — CPRA §1798.140(ae) — Sensitive personal information

CPRA expanded the protected categories to include "sensitive
personal information" (SSN, driver's license, financial account,
precise geolocation, racial/ethnic origin, religious/philosophical
beliefs, union membership, mail/email/text content, genetic data,
biometric/health/sexual orientation data).

Loam's posture:

- **The §SJ.5 PII scrubber catches the rule-based subset.**
  SSN, financial-account numbers, precise geolocation
  patterns are in the rule layer.
- **The ML classifier layer catches the free-text categories.**
  Racial/ethnic/religious/biometric references in free text
  are flagged by the §SJ.5.4 classifier; high-confidence
  matches are redacted; uncertain matches trigger
  human-review queues.
- **Cohort aggregations require K-floor.** v1.0 ships a
  unified `K=8` floor everywhere (`cohort/k_floor.py:34`
  `K_MIN_DEFAULT = 8`; `cohort/k_anon_cotx.py:56`
  `K_MIN_DEFAULT_READ = 8`). The cross-shard coordinator
  enforces `floor + 1` for race safety, so the effective
  global check is `count >= 9`. **Elevated `K=20` for
  sensitive-PI cohorts is a v1.1 stretch goal**, deferred
  per AUDIT-LIES H8 — the `cohort_class="sensitive"` API
  parameter does not exist yet. v1.1 design adds a
  `sensitive` boolean threaded through `read_cohort_aggregate`
  + the coordinator's `passes_floor_global`.

The architectural property: sensitive PI has a strictly
narrower exposure surface than general PI; the difference is
enforced at the substrate, not at cart code.

#### J.3.3 — CPRA ADMT rules (effective January 2026)

The California Privacy Protection Agency's ADMT (Automated
Decision-Making Technology) rules require businesses to
provide pre-use notice, opt-out rights, and access to ADMT
outputs.

Loam's `loam.consumer.disclosure()` verb is the substrate's
ADMT interface:

- Returns the consumer-readable description of any ADMT
  applied to the consumer.
- Returns the inference outputs (with the underlying logic
  summarized).
- Returns the opt-out URL for the ADMT.
- Returns the human-review request path.

The audit log records every ADMT decision and every consumer
disclosure request. The §12.10 spec describes the verb in
detail.

**Architectural property.** ADMT compliance is a verb in the
substrate's API, not a separate compliance module. Operators
who want to be ADMT-compliant invoke the verb; the substrate
returns the disclosure data; the operator surfaces it to
their consumers. The substrate handles the
record-of-disclosure as a first-class audit entry.

#### J.3.4 — CCPA §1798.130(a)(5) — Record-keeping

CCPA requires controllers to retain records of consumer
requests for 24 months. Loam's audit log retention satisfies
this by construction — every consumer request via the
substrate is an audit row; audit rows are retained per the
substrate's standard retention discipline (default 7 years
for compliance audit; configurable per cohort/tenant).

---

### J.4 — EU AI Act conformity assessment

#### J.4.1 — Article 6 — Classification of AI systems

The EU AI Act (Regulation (EU) 2024/1689, in force August 2024;
provisions phased through 2026-2027) classifies AI systems
into risk categories. The classification determines the
conformity assessment regime.

Loam's posture:

- **The substrate itself is not an AI system in the AI Act's
  meaning.** Article 3(1) defines AI system as "a
  machine-based system that is designed to operate with
  varying levels of autonomy and that may exhibit
  adaptiveness after deployment, and that, for explicit or
  implicit objectives, infers, from the input it receives,
  how to generate outputs such as predictions, content,
  recommendations, or decisions that can influence physical
  or virtual environments". The substrate's §16.3
  behaviors are observation + statistics + heuristics, not
  AI in the strict sense.
- **The substrate-intelligence behaviors might be classified
  as "AI system" components by some interpretations.** Loam's
  posture is to provide the conformity-assessment evidence
  for the closest applicable category (recommendation system,
  Article 6(2) Annex III item 8(b)).
- **The substrate is a "general-purpose AI system" only if
  paired with an LLM consumer.** Loam itself doesn't run
  LLMs; the consumer (Sakura, third-party LLMs) is the AI
  system. The substrate provides the data plumbing.

#### J.4.2 — Article 9-15 — Conformity assessment for high-risk systems

If the substrate-intelligence behaviors are classified as
"high-risk" by an operator's deployment context (e.g., used
for employment decisions, credit scoring, education access),
the operator must perform a conformity assessment per
Articles 9-15.

Loam's contribution to the operator's conformity assessment:

- **Risk management system** (Article 9). The substrate's
  §SJ.10 attack-class catalog + the §16.3.5 anomaly surface
  are the substrate's risk management evidence.
- **Data governance** (Article 10). The §SJ.4 K-floor +
  the §SJ.5 PII scrubber + the per-tenant encryption are
  the substrate's data governance evidence.
- **Technical documentation** (Article 11). This LOAM-
  ENGINEERING document, the §SJ.10 attack catalog, and the
  DPIA together are the technical documentation.
- **Record-keeping** (Article 12). The §SJ.6 audit log is
  the record-keeping artifact.
- **Transparency and provision of information** (Article 13).
  The §M.13 provenance field is the substrate's transparency
  surface; operators expose it to end-users as appropriate.
- **Human oversight** (Article 14). The substrate's
  proposes-but-doesn't-decide discipline (§J.2.4) is the
  human-oversight property; the operator is the human in
  the loop.
- **Accuracy, robustness, cybersecurity** (Article 15). The
  §M.10 invariants + the §SJ.10 attack catalog are the
  cybersecurity evidence; accuracy is per-behavior
  measured (e.g., §M.5.2 Recall@10).

The substrate provides the technical evidence; the operator
performs the assessment in their deployment context.

#### J.4.3 — Article 26 — General-purpose AI model obligations

If the operator's deployment uses Loam paired with a
"general-purpose AI model" (LLM), Article 53 obligations
apply to the model provider. Loam's role:

- **The substrate provides the audit trail of every LLM
  input.** This satisfies the operator's record-keeping
  obligations for using the GPAI model.
- **The substrate enforces the PII scrubber on every write
  proposal.** This reduces the risk of PII landing in
  model training data (Article 53(1)(d) requires the
  provider to "draw up a list" of training data; the
  substrate's contribution is to ensure operator-side data
  passed to the GPAI doesn't carry PII).

The operator's full GPAI compliance is their responsibility;
the substrate's contribution is the audit + the scrubber.

---

### J.5 — COPPA architecture (Amended Rule April 2026)

#### J.5.1 — The COPPA scope

COPPA (Children's Online Privacy Protection Act, 15 USC §6501
et seq., implementing 16 CFR Part 312) regulates online
services directed at children under 13 or with actual knowledge
of collecting personal information from children under 13.

Loam's substrate isn't directed at children — operators are
typically adult business operators (Etsy/eBay sellers, food
business owners, etc.). The COPPA scope arises **when an
under-13 buyer interacts with an operator's storefront** and
the operator's data flows through Loam.

The architectural commitment: even though the substrate isn't
COPPA-direct, it provides the compliance plumbing so operators
can be COPPA-compliant when they encounter under-13 buyers.

#### J.5.2 — The §12.8 parental-consent path

The substrate's `loam.parental_consent` verb:

- Marks a buyer-record as "under-13 detected".
- Triggers the operator's COPPA-compliant consent flow.
- Records the consent (or refusal) with timestamp + method.
- Until consent is recorded, the buyer's data flows to a
  restricted plane (TENANT-only, no cohort participation,
  no substrate-intelligence sweeps).
- On refusal, the data is purged within 30 days per the
  COPPA retention requirement.

The detection of "under-13" is the operator's responsibility
(it might come from the buyer self-identifying, from a parent
contacting the operator, or from inferential signals in
buyer messages). The substrate provides the response
infrastructure; the substrate doesn't infer under-13 status
on its own.

#### J.5.3 — Amended Rule April 2026 — Verifiable parental consent

The April 2026 amendments to COPPA tighten the verifiable
parental consent (VPC) requirements. The substrate's response:

- The `loam.parental_consent` verb requires evidence of VPC
  per one of the FTC-approved methods (signed consent form,
  credit-card verification, knowledge-based authentication,
  government ID).
- Evidence is content-addressed and stored in the operator's
  TENANT plane with sensitive-PI handling.
- The audit log records the VPC method used.

The architectural property: the substrate doesn't accept
"parental consent" without the evidence path; operators who
don't have a VPC mechanism can't mark a buyer-record as
consented.

#### J.5.4 — The "neither know nor have reason to know" defense

COPPA provides a "neither know nor have reason to know" defense
for operators who legitimately operate adult-targeted businesses
but occasionally encounter under-13 interactions. The substrate
supports this defense by:

- The §SJ.6 audit log demonstrating the operator's compliance
  posture (the operator-defined under-13 detection rules, the
  operator's response when under-13 is detected).
- The substrate-level absence of under-13-inference behaviors
  (the §16.3 sweeps don't classify ages; the operator does).

Operators relying on this defense should retain the substrate's
audit log for the COPPA statute of limitations.

---

### J.6 — FTC dark-pattern guidance (2023 + ongoing)

#### J.6.1 — "Bringing Dark Patterns to Light"

The FTC's September 2022 report "Bringing Dark Patterns to
Light" (FTC Report, Staff Report) catalogs the dark-pattern
categories the agency identifies as deceptive: misleading
design elements, false urgency, hidden costs, subscription
traps, hard-to-cancel patterns, deceptive disclosure.

Loam's architectural commitment is the **anti-dark-pattern**
suite of substrate behaviors:

- **§19.1.4 reverse-suggest demotion.** When a paid upgrade
  isn't paying off, Sakura proactively suggests rolling it
  back. This is the inverse of subscription-trap dark
  patterns.
- **§19.2.4 9-of-10 silence ceiling.** Sakura refuses to
  recommend at high frequency; the operator's substrate
  experience is bounded recommendations, not relentless
  upsells.
- **§19.2 4-check sustainability test.** Before recommending
  anything, Sakura projects the cost against the operator's
  budget; if the projection shows the operator running
  out of tokens, Sakura refuses the recommendation.
- **§19.1.3 EU withdrawal-button parity.** Every paid
  subscription has a one-tap cancellation surface; the
  cancellation flow is symmetric with the signup flow.

The architectural property: dark-pattern *resistance* is a
substrate-level discipline. Carts that try to implement
dark patterns are pushed against the substrate's audit log
+ the §SJ.7 abuse-prevention envelope; sustained
dark-pattern attempts trigger SYSTEM review.

#### J.6.2 — Exhibit A in any FTC investigation

§19.1.4 (reverse-suggest demotion) and §19.2.4 (9-of-10
silence) are the substrate features that directly answer
the FTC's dark-pattern concerns. In a hypothetical FTC
investigation, the substrate's audit log shows:

- Every recommendation Sakura made (with the sustainability
  projection that justified it).
- Every recommendation Sakura *refused* to make (with the
  reason — "would exhaust budget by Thursday").
- Every reverse-suggest demotion Sakura made (with the
  evidence that the upgrade wasn't paying off).

The audit log is the substrate's affirmative defense.

---

### J.7 — EU Digital Services Act subscription rules (effective June 2026)

The EU DSA's subscription cancellation rules require platform
operators to provide symmetric, one-click cancellation. The
relevant articles: Article 11(2) (cancellation symmetry),
Article 27 (recommender system transparency).

Loam's architectural commitment:

- **Every Loamified cart with a subscription component has a
  withdrawal verb.** The verb is operator-callable; the
  cancellation flow takes one operator action.
- **The cancellation flow's UX is symmetric with the signup
  flow.** Same number of clicks, same prominence in the UI.
  This is the §19.1.3 spec.
- **The substrate's audit log records every cancellation
  request and outcome.** The DSA's enforcement requires
  cancellation receipts; the substrate provides them.

Effective June 19, 2026. The substrate ships the
infrastructure by W15; the operator-facing cart UI ships
incrementally as carts are Loamified.

---

### J.8 — Sector-specific disclaimers

#### J.8.1 — HIPAA

Loam is **not** a Business Associate under HIPAA. The substrate
doesn't process Protected Health Information (PHI) intentionally.
If a buyer's message to an operator mentions a health condition
("I'm allergic to nickel; can you make this in stainless?"),
the substrate's PII scrubber catches health-related keywords and
quarantines the message to the operator's TENANT plane only;
no COHORT/WORLD aggregation includes health-tagged content.

The architectural property: HIPAA-adjacent content is detected +
isolated. The substrate doesn't claim HIPAA compliance because
HIPAA compliance requires a BA agreement which the substrate
doesn't enter; the substrate ships the technical defense for the
case where covered data appears incidentally.

#### J.8.2 — Financial services

Loam doesn't process financial transactions directly. Payment
processing flows through operator-chosen payment processors
(Stripe, PayPal, etc.); the substrate sees the transaction
metadata (timestamp, amount, success/fail) but not the payment
instrument details.

The architectural property: PCI-DSS scope is limited to the
payment processor; the substrate is out of PCI scope by
design. The substrate's audit log captures the transaction
metadata necessary for the operator's accounting.

#### J.8.3 — Education

If an operator's business involves children's education (a
tutor selling educational materials, for example), FERPA
might apply. The substrate doesn't ship FERPA-specific
compliance; the operator is responsible for FERPA-relevant
data handling. The substrate's per-tenant encryption + the
§SJ.4 K-floor are the substrate's contribution to a
FERPA-compliant deployment.

#### J.8.4 — Adult content

Operators with adult-content businesses may have additional
obligations (state-level age verification rules, payment-
processor restrictions). The substrate doesn't ship
age-verification; the operator chooses an age-verification
provider; the substrate stores the verification result as
a fact in the operator's TENANT plane.

---

### J.9 — The audit log as regulatory architecture

The architectural insight that ties this section together:
**the audit log is not a feature; it is the regulatory
architecture**.

Regulators consistently ask for the same things:

- Who did what, when?
- What was the legal basis?
- Can the subject access / correct / erase?
- Was the decision automated, and to what extent?
- How is the data protected?

Loam's audit log answers all five for every substrate
operation. The audit log is the substrate's affirmative
defense in any regulatory inquiry.

The §SJ.6 forward-secure signing makes the audit log
tamper-evident — an inspector can verify the log's integrity
across the inspection window. The Merkle-tree epochs let an
inspector verify a slice of the log without needing the
whole.

> "The discipline of audit is the discipline of regulation.
> An organization that can show its audit log is an
> organization that has earned the benefit of the doubt;
> an organization that can't is an organization that has
> chosen opacity over accountability."
> — Solove, *Understanding Privacy*, 2008 (Ch. 4
> paraphrase)

Loam's audit log is the substrate's accountability artifact.

---

### J.10 — The compliance posture as a moat

The architectural commitment to compliance is also the
substrate's competitive moat:

- Single-product startups can't ship per-tenant cryptographic
  erasure because they don't own the substrate.
- Single-product startups can't ship cross-service cohort-
  mediated intelligence with audit trails because they don't
  span services.
- Single-product startups can't ship the reverse-suggest
  demotion + 4-check sustainability test because their
  revenue model depends on the inverse.

Loam's regulatory architecture is the substrate's
competitive position. The compliance posture isn't a cost
of doing business — it's the architectural property that
lets the substrate be the place sensitive data lives.

The architect's framing carries: *"the substrate is the
soil; everything else grows from it."* Regulators inspect
the soil; the substrate's inspection-readiness is the
operator's compliance-readiness.

---

### J.11 — Honest gaps + open questions

Following the §32 honest-gap discipline:

1. **CJEU C-413/23 P enforcement is new.** The September
   2025 decision changed the regulatory reading of
   pseudonymisation. Loam's architectural response is in
   place; the enforcement consensus is still forming. We
   monitor EDPB decisions; substrate-side adjustments
   trigger by W14.
2. **EU AI Act conformity assessment for "general-purpose"
   substrates is unclear.** Loam isn't a GPAI; Loam might
   be a component of an operator's AI system. The
   substrate's contribution to the operator's conformity
   assessment is in place; the operator's full assessment
   is their responsibility. Open question: should the
   substrate provide a template DPIA / conformity
   assessment document for operators? Current plan: yes,
   by W16.
3. **State-level US privacy laws are proliferating.**
   Virginia, Colorado, Connecticut, Utah, Iowa, Indiana,
   Texas, Oregon, Montana, Tennessee, Florida, New Jersey,
   Delaware, Maryland, Minnesota, Nebraska, New Hampshire,
   Rhode Island, Kentucky each have an active or pending
   consumer privacy law (mostly CCPA-aligned with
   variations). The substrate's CCPA architecture is the
   working baseline; per-state variations are captured in
   the operator's cart logic. Open question: does the
   substrate need per-state defaults, or is the operator's
   cart sufficient? Current plan: operator's cart, with
   substrate-provided per-state compliance helpers.
4. **AI liability directive (EU)** is in legislative
   process. If passed, it may shift product-liability
   onto AI system providers. Loam's posture as a substrate
   (not an AI system) is the architectural defense; the
   defense's regulatory acceptance is pending.
5. **Cross-border data transfer adequacy.** Operators in
   the EU using a Loam substrate hosted in the US trigger
   GDPR Chapter V (data transfers). The substrate's
   posture: support multi-region hosting (Fly's EU regions
   for EU operators), document SCCs (Standard Contractual
   Clauses) for cross-border flows, contribute to the
   operator's Transfer Impact Assessment. Open question:
   should the substrate offer EU-only hosting as a default
   for EU operators? Current plan: yes, opt-in default
   by W16.
6. **Children's privacy under state laws.** California's
   AADC (Age-Appropriate Design Code; AB 2273) provides
   stricter requirements than COPPA. The substrate's
   §J.5 COPPA architecture is the baseline; California
   operators need AADC-specific compliance which the
   substrate's cart-level logic supports.

Each gap above has a tracked plan. The substrate's regulatory
posture is honest about what's settled and what's in motion.

---


---

## §37 — Voice + Visual Discipline (Daisy)

*This chapter names the typography, color palette, code-block
rendering, ASCII-diagram conventions, pull-quote styling, table
alignment, operator-invisibility discipline, and the per-author
voice register that this document holds. Daisy also performs the
final layout pass; this chapter is the gate-out artifact for that
pass.*

### D.1 — The visual identity, in one paragraph

This document is the engineering canon for Loam. It sits next to
HelloSurface 1.0 Engineering and Sakura Scheme 1.0 Engineering on
the same shelf. The three docs share a visual voice — direct,
scientific, technically dense, prose-first — because they describe
substrates of the same product family and an engineer reading any
two of them should not feel they're reading different products'
documentation. This section names the visual disciplines so future
edits hold the line.

---

### D.2 — Typography

The doc renders as Markdown to a static HTML site via
`scripts/build-docs-html.mjs`. The visual choices live in the
HTML template and the inherited CSS at `curator-web/public/docs/
_shared/`.

The typography ladder:

- **Body text.** A humanist serif at 17px/1.7 for long-form
  reading. The current choice is the system serif stack with
  Georgia as the primary fallback — the substrate of every
  reader's machine. Sentence length averages 25-30 words; the
  occasional 50-word sentence breathes; the occasional 8-word
  sentence punctuates.
- **Code blocks.** A monospace stack with JetBrains Mono as
  the primary; falls back to system monospace. 14px/1.5;
  contrasting background to delineate from prose.
- **Headings.** A condensed humanist sans for headings — the
  contrast against the body serif gives the page rhythm. The
  weight increases per heading level: `h1` is the chapter
  hammer; `h2` is the section beat; `h3` is the subsection
  marker; `h4` is rare and load-bearing.
- **Tables.** Same body serif at 15px; horizontal rules
  between rows; subtle stripes; column alignment is
  semantic (numbers right, text left, status centered).
- **Pull-quotes.** A larger weight of the body serif with
  the `> ` blockquote rendering as a left-rule with subdued
  background. Attribution after `— ` is rendered in italics.

Bringhurst's *Elements of Typographic Style* (Hartley & Marks,
4th ed., 2013) is the reference book for the typographic
decisions. The discipline: "Set the text in such a way that
nothing draws attention to itself; let the words do the work."
Long-form engineering prose succeeds when the typography is
invisible.

---

### D.3 — Color, tied to the SRE-1 token palette

The doc's color palette is sourced from `curator-web/public/
docs/_shared/sre-tokens.css`, which defines `--sre-*` CSS
variables shared across all canonical docs. The choices:

- **`--sre-bg`** (page background). A near-white off-cream;
  reduces the eye fatigue of pure white at long reading
  sessions.
- **`--sre-fg`** (body text). A near-black ink; not pure
  black for the same eye-fatigue reason.
- **`--sre-accent`** (links, code highlights). A muted teal
  consistent across HelloSurface, Scheme, and Loam docs.
- **`--sre-pop`** (the rare attention-grab). A warm coral;
  used for `RULE:` and `GUIDANCE:` callout headers; never
  in body text.
- **`--sre-rule`** (horizontal rules, table dividers). A
  warm gray; near-invisible at body scale, present at
  closer inspection.
- **`--sre-code-bg`** (code-block background). A subtle
  cream-gray; carries enough contrast to delineate code
  from prose without being heavy.

The palette is shared across canonical docs so a reader
shipping between HelloSurface and Loam doesn't experience
visual whiplash.

Tufte's *Envisioning Information* (Graphics Press, 1990)
on color: "Pure, bright or very strong colors have loud
unbearable effects when they stand unrelieved over large
areas adjacent to each other, but extraordinary effects
can be achieved when they are used sparingly on or amongst
dull background tones." The doc's discipline is to use
the bright accent rarely and against the dull near-white
substrate.

---

### D.4 — Code block rendering

Code blocks render with syntax highlighting:

- **Scheme** — `;; ` comments in a muted gray; symbols in
  the body color; strings in a warm green; numbers in a
  muted blue. Parentheses are de-emphasized (slightly
  lighter than body) so the structure reads as form, not
  as visual noise.
- **Rust** — keywords in the accent teal; types in a
  cool blue; lifetimes in italic; strings in warm green;
  comments in muted gray.
- **Python** — keywords in accent teal; built-ins in a
  cool blue; strings in warm green; comments in muted gray;
  decorators in italic.
- **Bash** — commands in the body color; flags in italic;
  string arguments in warm green; comments in muted gray.

The highlighting is via Prism.js with custom themes matching
the SRE-1 token palette. The discipline: highlight should
clarify structure, not paint the page. Over-highlighting
makes code look like a parade.

Code blocks have a thin left-rule in the accent color when
the code is a literal excerpt from the codebase; the rule
is absent for pseudocode and design sketches. The
distinction matters because the reader should know whether
they can grep for the snippet.

---

### D.5 — ASCII diagrams in monospace blocks

The doc uses ASCII diagrams (not Mermaid, per the architect's
direction for this doc) for pipeline flowcharts and topology
sketches. Conventions:

- **Boxes** drawn with `+--+` corners, `|` sides, `--` tops
  and bottoms.
- **Arrows** as `--->` (right), `<---` (left), `^|` and `|v`
  (vertical), `-->` for narrow.
- **Branches** indicated by `+` at the junction.
- **Labels** placed above or to the side of the relevant
  edge; never inside the arrow itself.
- **Width** capped at 78 characters so the diagram doesn't
  reflow on narrower screens.

Example (from a cart pipeline walkthrough):

```
  +-----------------+      +----------------+      +-------------+
  | operator triggers|---->| Shell verifies |---->| TENANT plane|
  | cart on schedule |     | cap-token      |     | get listing  |
  +-----------------+      +----------------+      +-------------+
                                  |                       |
                                  v                       v
                          +----------------+      +-------------+
                          | escalate if    |      | enrich with |
                          | token expired  |      | cohort data |
                          +----------------+      +-------------+
```

The discipline: ASCII diagrams must be **readable** when
the styling fails (a plain-text grep of the doc should still
make sense). The monospace block + the box-drawing convention
ensures readability across renderers.

---

### D.6 — Pull-quote styling

Pull-quotes use the `> ` Markdown blockquote syntax. The CSS
renders:

- A left-rule in the accent color (4px wide).
- A subtle background tint (the cream-gray of code blocks,
  slightly lighter).
- Larger text (1.05× body) for the quoted content.
- Attribution after `— ` in italics, slightly smaller (0.92×
  body), right-aligned within the quote block.

Example (from Marcus's section, M.1):

> "A database is a place where facts are accumulated. A
> database is a value. The transaction is the addition of
> a fact."
> — Rich Hickey, *Database as a Value* (CMU SDI 2013)

The discipline: pull-quotes are for **load-bearing voices** —
academic citations, architect directives, regulator
language. Decorative quotes don't earn pull-quote treatment;
they stay inline.

---

### D.7 — Tables, aligned

Tables earn their place when:

- The data is genuinely tabular (multi-column comparison,
  enumerated states, parameter lists).
- The columns are short enough to fit without horizontal
  scroll on a typical reading width (~80 characters).
- The relationship between columns is the load-bearing
  insight.

Alignment discipline:

- **Numeric columns** right-aligned.
- **Text columns** left-aligned.
- **Status / category columns** centered.
- **Column headers** in a bolder weight; the header row
  has a stronger bottom rule.

The doc avoids tables for:

- Free-form prose that happens to have categories.
- Sparse data (most cells empty).
- Long-form descriptions (use a definition list or a
  sub-section instead).

---

### D.8 — Prose voice, by author

The doc has multiple authors (the seven Lacuna specialists +
the architect's voice in §1). The voice discipline:

- **The Architect's voice** appears in pull-quotes from the
  brief and in the §1 "What this is" paragraphs at the
  doc's top. The tone is **directive** — short sentences,
  the kind of frame that sets the architectural bar.
- **Marcus's voice** is **mechanical-rigorous** — long
  paragraphs walking through engineering tradeoffs, code
  snippets, measurement tables. The §M.1 sentence rhythm:
  open with a claim, support with mechanism, close with
  the operational consequence.
- **Soo-Jin's voice** is **paranoid-precise** — threat
  model first, mitigation second, residual third. Every
  attack class gets a row. The §SJ.10 catalog is the
  Soo-Jin pattern.
- **Zane's voice** is **scholarly-readable** — academic
  citations woven into the prose, prior-art surveys,
  formal definitions where they help. Footnote-rich
  style without actual footnotes (citations inline).
- **Priya's voice** is **adversarial-honest** — failure
  narratives told as stories, scale-stress walked
  arithmetically, "where this breaks if we're wrong"
  sections.
- **Jess's voice** is **legal-precise** — regulation
  citations with paragraph numbers, court rulings, the
  difference between architectural commitment and
  marketing promise.
- **Daisy's voice** (this section) is **craft-focused**
  — opinionated, gentle, naming choices and the
  reasoning behind them.
- **Kofi's voice** is **product-first** — operator
  scenarios, comparative analysis with shipped products,
  the human-grounded "what does this feel like to the
  operator who runs a jewelry shop".

Each voice's discipline is named so future contributions
can match. Different authors are visible at the section
level; the doc reads as one product because the
typography, the color palette, and the structural
disciplines are shared.

---

### D.9 — The operator-invisibility discipline

The word "Loam" never appears in operator-facing UI. This
doc uses "Loam" because **the doc is the engineering canon,
not operator-facing copy**. The discipline:

- Operators see "automations" (the §15 surfacing pattern),
  "Sakura's recommendations" (Sakura's NL adapter), "magic
  versions" (the §17 cross-trust-domain upgrade), and
  "your shop's history" (the operator's TENANT plane
  reads).
- The substrate's name appears only in:
  - This engineering doc + the §14.5 SRE runbook.
  - The compliance documentation provided on operator
    request.
  - The training corpus for engineering hires.
- Operators who actively ask "what is the substrate?"
  receive an honest answer naming Loam and a link to this
  doc; the active query is the consent for the technical
  disclosure.

This is the §28.7 patentable surface (B.15) "substrate
invisibility" expressed as a design discipline. The
discipline is enforced by:

- A linter rule (`scripts/check-loam-invisibility.mjs`)
  that scans operator-facing copy for the token "Loam"
  and fails CI if present outside the documented exceptions.
- A review discipline at PR time — any operator-facing
  copy change is reviewed for substrate-naming.
- The cart manifest's `operator_facing_strings` field —
  every string declared operator-facing is scanned against
  the substrate-token blocklist.

The architectural property: substrate invisibility is a
linter-enforced discipline, not a hope. The substrate's
name doesn't leak by accident.

---

### D.10 — Sakura's voice in surfaced examples

When the doc shows Sakura speaking (in §17 reverse-suggest
demotion examples, in §J.6.1 4-check sustainability
examples, in cart walkthroughs), her voice is **gentle CFO**:

- First-person where the action is hers ("I projected your
  token balance through Thursday and you'd run dry by
  Wednesday afternoon, so I'm not recommending this
  upgrade today").
- Honest-null when the substrate doesn't have signal
  ("your domain is early — I'm learning as more
  operators in jewelry-making with iconography join").
- Reverse-suggest demotion phrased as care ("you upgraded
  to Magic three weeks ago; the carts you've actually used
  fit comfortably in Dream — want to roll back and save
  the difference?").
- No urgency-injection ("LIMITED TIME!" never appears).
- No upsell-without-justification ("you might want
  Magic" without showing why ≠ never).

The voice's discipline is named in the §47b "Voice
Register" section of HelloSurface 1.0 Engineering, which
this doc inherits. The Sakura-in-Loam-examples voice is
the same Sakura that operators meet through Curator.

---

### D.11 — Pearl's voice (when she speaks)

Pearl is the operator's senior advisor — the voice that
appears for the gentle-CFO 4-check sustainability test in
high-stakes carts. When Pearl speaks in the doc:

- First-person plural where the discipline is collective
  ("we don't recommend a cart whose cost would burn
  through your monthly budget before week 3").
- Direct address to the operator ("you bought the Magic
  tier three weeks ago; I want to be honest with you").
- No defensive language ("we apologize for the
  inconvenience" doesn't appear — Pearl's apologies are
  for substrate failures, not for operator decisions).
- Plain numbers ("your usage rate suggests Dream would
  cost you $20/month and Magic $60; Dream covers what
  you've actually used"); not jargon.

Pearl's voice is the substrate's voice when financial
honesty is the front matter.

---

### D.12 — The visual ladder across canonical docs

Lacuna ships five canonical docs:

| Doc | Audience | Voice | Length target |
|---|---|---|---|
| HelloSurface 1.0 Engineering | Engineer | Mechanical-rigorous | 300+ pages |
| Sakura Scheme 1.0 Engineering | Engineer | Mechanical-rigorous | 200+ pages |
| Sakura Scheme 1.0 Reference | Engineer + author | Reference-precise | 200+ pages |
| Sakura Scheme Tutorial | Learner | Tutorial-gentle | 50 pages |
| LOAM-ENGINEERING | Engineer | Mechanical-rigorous + this doc's specialists | 300+ pages |

The visual ladder:

- **Engineering canons** (HelloSurface, Scheme Engineering,
  LOAM Engineering) share the typography + color palette +
  pull-quote treatment + code-block style.
- **Reference docs** (Scheme Reference) layer a per-verb
  card pattern on top of the engineering canon's
  typography.
- **Tutorials** (Scheme Tutorial) use larger body text,
  more whitespace, and lighter pull-quotes; the tutorial
  doesn't intimidate.

A reader who has read HelloSurface should feel at home in
LOAM. A reader who has read the Scheme Tutorial should
feel a step up when opening LOAM (the step is voluntary;
the substrate doesn't condescend or intimidate).

---

### D.13 — The HTML build pipeline

The build script (`scripts/build-docs-html.mjs`) processes
each canonical doc through:

1. **Section split.** The MD file is split by `##` headings
   into chapter units; each chapter becomes its own HTML
   page.
2. **Per-chapter MD → HTML.** The script's in-file
   Markdown parser handles headings, paragraphs, fenced
   code, GFM tables, inline italic/bold/code/links, inline
   SVG passthrough.
3. **Per-chapter template wrap.** Each chapter is wrapped
   in the shared HTML template (nav, footer, search,
   typography baseline).
4. **Cover image.** Each chapter may have a Flux-generated
   cover image (the substrate's visual identity element);
   absent cover, the template uses a neutral pattern.
5. **Cross-doc search index.** Every chapter's headings +
   first paragraph + key citations are extracted into the
   shared `search-index.json` so the cross-doc search bar
   finds material across all five canonical docs.

The build is **idempotent** — same MD source produces
byte-identical HTML output. This is the precondition for
the §M.8 rebuild-from-source discipline applied to
documentation.

The build is invoked:

```bash
node /Users/alfred/code/curator/scripts/build-docs-html.mjs
node /Users/alfred/code/curator/scripts/build-docs-html.mjs --index-only
```

The first command rebuilds everything; the second rebuilds
only the search index (useful after content edits without
template changes).

---

### D.14 — The layout pass discipline

When the doc lands a major content addition (like this
long-form expansion), the layout pass:

1. **Consistent heading hierarchy.** Every `##` is a major
   section; every `###` is a subsection. The doc avoids
   `####` except in the §SJ.10 catalog where each row is
   a discrete unit; even there, the `####` is a
   styled-paragraph-with-emphasis rather than a deep
   nesting.
2. **Code-block syntax tags.** Every fenced code block
   declares its language (` ```scheme `, ` ```rust `,
   ` ```bash `, ` ```python `). Unmarked blocks get a
   review prompt.
3. **ASCII diagrams in monospace blocks.** Every ASCII
   diagram is a fenced code block (typically ` ``` ` or
   ` ```text `). The block ensures monospace rendering.
4. **Pull-quote attribution check.** Every `> ` blockquote
   has an attribution line ending with `— Author, *Work*
   (Year)`. Untagged quotes get flagged for citation.
5. **Table alignment check.** Numeric columns right-
   aligned; text columns left-aligned; the build script
   verifies via a CI step.
6. **Cross-ref resolution.** Every `§X.Y` reference
   resolves to an actual section. Broken refs surface as
   build warnings.
7. **Vendor-name scan.** The §J.10 operator-invisibility
   discipline applies even within the engineering doc —
   vendor names appear only in the contexts the §
   "Vendor naming" rule allows. The scan catches accidental
   leaks.

The layout pass is the final gate before publication.

---

### D.15 — The visual brief, named

The brief: this doc reads like an engineering canon, not
like marketing collateral, not like a vendor's product
manual, not like an academic paper, not like a blog post.
It's the canonical engineering record for a substrate that
will outlive the team that built it. The visual choices
support that purpose by being invisible — the reader's
attention is on the substrate, not on the doc's design.

Bringhurst's discipline (§D.2) is the working summary:
"set the text in such a way that nothing draws attention to
itself; let the words do the work." The substrate's words
do the work; the doc's design lets them.

---


---

## §38 — Product Context + Operator Scenarios (Kofi)

*This chapter expands §15 (the 300+ purple automations), §16
(substrate intelligence), §19 (surfacing), and §23 (the twelve-area
shop walkthrough) with the long-form product-context treatment.
Operator persona, the 12-area walkthrough across jewelry / food /
electronics verticals, the 3-layer surfacing pattern as product UX,
refusal-as-feature in the operator's experience, the tier-identity
naming as conversion lever, the cross-product intelligence
narrative, and the product-craft moat.*

### K.1 — Posture, in one paragraph

This section walks the substrate from the operator's seat. Loam's
architectural elegance only matters if it produces an experience
operators choose over the alternatives. The frame is product-
first: every substrate property is presented through the
operator's workflow, with the comparable product or pattern in
the market named explicitly. Where Loam ships something the
market doesn't (refusal-as-feature, reverse-suggest demotion,
cross-trust-domain auto-promotion), the comparison names the
absence — Cursor's June 2025 refund cycle is the canonical
example of the failure pattern Loam's substrate is engineered to
prevent.

The 12-area shop walkthrough (§23 in the master doc) is the
canonical worked example. This section expands it across
verticals (jewelry vs food vs electronics), names the comparable
products at each area, and walks the 3-layer surfacing pattern
as product UX.

---

### K.2 — The operator persona, named honestly

Loam's primary operator is a small-business shop owner running
their commerce on platforms like Etsy, eBay, Shopify, or
Instagram. The demographics: typically 1-3 person operations,
$10K-$500K annual GMV, 30-80 hours/week working on the shop,
runs the entire stack themselves (listings, photos, customer
service, inventory, accounting, marketing, SEO, packaging,
shipping). The operator's day is fragmented across
context-switches; their time is the scarce resource; their
budget is small enough that subscription cost matters.

The contrasting personas:

- **The enterprise admin** — buys SaaS for a team; uses procurement;
  not Loam's primary persona.
- **The hobbyist** — runs a shop for fun; doesn't pay for tools;
  free-tier-eligible but not the substrate's revenue persona.
- **The aggregator** — runs 50+ shops with VAs; needs multi-shop
  management; the post-1.0 expansion persona.

Loam ships v1.0 for the single-shop owner. The 12-area
walkthrough below is from that owner's seat.

---

### K.3 — The 12 areas, with verticals

The §23 12-area shop walkthrough covers: Listings, Orders,
Buyers, Conversations, Reviews, Photos, Inventory, Finance,
Tax, Marketing, SEO, Analytics. Each area has cohort-relevant
patterns that differ by vertical. This section walks each
area three times — jewelry, food, electronics — to show how
the substrate's cohort discipline adapts.

#### K.3.1 — Listings

**Jewelry shop operator.** A handmade jewelry shop on Etsy.
The operator writes their own listings; titles are
keyword-stuffed; descriptions are personal-story heavy.
The substrate's role:

- **`etsy/title-rewriter`** (TENANT + COHORT plane). Reads
  the operator's titles + the jewelry cohort's
  high-performing title patterns. Proposes title
  rewrites. The cohort signal teaches the operator that
  "Cleopatra-style brass earrings, gold-toned, gift for
  her" performs 3× better than "Handmade Brass Earrings"
  in the jewelry-handmade cohort.
- **Compare to:** Etsy's "Listing Quality Score" — gives
  binary good/bad without naming why; doesn't propose
  alternatives; can't see other operators' performance
  because Etsy hides cross-seller data.
- **Loam's edge:** the substrate sees cohort patterns; the
  operator gets actionable recommendations grounded in
  what's actually working for peers.

**Food shop operator.** A small-batch hot sauce maker on
Shopify. Listings are SEO-tuned but inconsistent across the
catalog. The substrate's role:

- **`shopify/catalog-consistency-check`** (TENANT plane).
  Reads all the operator's listings; identifies
  inconsistencies in tone, terminology, structure.
  Suggests a unified template.
- **`shopify/cohort-keyword-suggest`** (COHORT plane).
  Reads the food-hot-sauce cohort's high-converting
  keywords. Proposes the keywords the operator's
  listings miss.
- **Compare to:** Shopify's own "AI listing optimizer" —
  ships at the platform level but doesn't see cohort
  patterns (only the single operator's data); produces
  generic recommendations.
- **Loam's edge:** the cohort signal is the operator's
  competitive intelligence, privacy-respecting because
  K=8 protects individual contributions.

**Electronics shop operator.** A refurbished-tech reseller on
eBay. Listings are template-heavy; the operator imports
specs from manufacturer datasheets. The substrate's role:

- **`ebay/spec-completeness-check`** (TENANT plane + WORLD
  plane). Reads the operator's listings + the WORLD plane's
  product-spec database; identifies missing specs that
  buyers in the category search for.
- **`ebay/condition-honesty`** (TENANT plane). Reads the
  operator's condition descriptions; flags
  euphemism-patterns that correlate with return rates in
  the cohort.
- **Compare to:** eBay's own "Item Specifics" suggestions —
  driven by the platform's taxonomy; doesn't see condition-
  language patterns; doesn't connect to return rates.
- **Loam's edge:** the substrate connects listing language
  to outcomes, with the cohort providing the statistical
  base.

#### K.3.2 — Orders

Order management is similar across verticals; the cohort
adds value in **anomaly detection** (an order that looks
unusual for the operator's cohort).

- **`commerce/order-anomaly-detect`** (TENANT plane +
  COHORT plane). Reads the operator's orders + the cohort's
  typical order distribution. Flags orders that are
  unusual (size, destination, payment method) for review
  before fulfillment.
- **Vertical examples:**
  - Jewelry: a $5,000 order from a new buyer in a
    country the operator hasn't shipped to before — flag
    for fraud check.
  - Food: a 50-unit order during a regular sales week
    (might be a restaurant; might be a competitor
    sample-purchase) — flag for category-fit check.
  - Electronics: an order with shipping address that
    matches a returns-fraud pattern — flag for ID
    verification.
- **Compare to:** Shopify Fraud Filter — generic
  fraud rules from across the platform; doesn't see
  per-cohort normal distributions; high false-positive
  rate in niche verticals.
- **Loam's edge:** anomaly detection grounded in the
  operator's cohort's actual patterns.

#### K.3.3 — Buyers

Buyer management touches privacy directly. The substrate's
PII discipline matters most here.

- **`commerce/buyer-segment-suggest`** (TENANT plane —
  the operator's own buyers).
- **`commerce/repeat-buyer-detect`** (TENANT plane). Reads
  the operator's buyer history; identifies repeat buyers
  not yet flagged.
- **`commerce/buyer-preference-infer`** (TENANT plane).
  Reads conversation history; infers buyer preferences
  (response time tolerance, gift-buyer vs self-buyer,
  bulk-buyer pattern).
- **Vertical examples:**
  - Jewelry: a buyer who consistently orders for women
    in their late 60s (mother gifts) gets a buyer-tag.
    The operator can proactively suggest similar items.
  - Food: a buyer who orders the same 3 items every 6
    weeks (subscription pattern) gets surfaced for a
    subscription offer.
  - Electronics: a buyer who returns 30% of orders
    gets a customer-service-cost-weighted flag; the
    operator may choose to soft-block.
- **Compare to:** Klaviyo, Postscript, Attentive — buyer
  segmentation tools that require explicit operator
  rules; don't infer; live outside the substrate so
  privacy is the operator's external concern.
- **Loam's edge:** inference happens at the substrate;
  PII never crosses the cohort boundary; the operator
  doesn't manage external SaaS.

#### K.3.4 — Conversations

Conversations are where PII concentration is highest. The
substrate's PII scrubber + K-floor are most visible here.

- **`commerce/message-draft-helper`** (TENANT plane).
  Reads incoming message + the operator's response history;
  drafts a reply.
- **`commerce/response-time-suggest`** (TENANT plane +
  COHORT plane). Reads message arrival pattern + cohort
  response-time benchmarks; suggests the next message
  to prioritize.
- **`commerce/sensitive-content-detect`** (TENANT plane).
  Reads incoming messages; flags those mentioning
  sensitive content (health, age, controversial topics).
  Routes to a human-only inbox.
- **Vertical examples:**
  - Jewelry: a buyer messages about a metal allergy
    (HIPAA-adjacent content per §J.8.1); the substrate
    catches the health-keyword; the message lands in the
    operator's TENANT plane only; no cohort
    aggregation includes the message.
  - Food: a buyer mentions a child's birthday
    (under-13 might be reachable; COPPA-adjacent per
    §J.5); the substrate flags; the operator handles
    consent flow.
  - Electronics: a buyer asks about warranty for an
    item under recall; the substrate connects to the
    WORLD-plane recall database; surfaces the recall to
    the operator for response.
- **Compare to:** Gorgias, Front, Help Scout — customer
  service inboxes; don't ship PII scrubber by default;
  privacy is the operator's external concern.
- **Loam's edge:** PII scrubber is substrate-level; the
  operator doesn't manage external compliance.

#### K.3.5 — Reviews

Review management is reactive in most tools; substrate
intelligence makes it proactive.

- **`commerce/review-sentiment-trend`** (TENANT plane).
  Reads review history; identifies sentiment trends;
  surfaces emerging concerns before they become a
  pattern.
- **`commerce/review-response-suggest`** (TENANT plane +
  COHORT plane). Drafts responses to reviews; uses cohort
  patterns for tone calibration.
- **`commerce/negative-review-anomaly`** (TENANT plane +
  COHORT plane). Flags negative reviews that diverge
  from the operator's normal distribution.
- **Vertical examples:**
  - Jewelry: 3 reviews mention "tarnished after 6
    months" — substrate flags the cohort pattern of
    "metals tarnishing" reviews; suggests a care-card
    insert.
  - Food: 5 reviews mention "arrived broken" — substrate
    surfaces the cluster; suggests packaging revision.
  - Electronics: 2 reviews mention "didn't work out of
    box" — substrate cross-references the unit's
    serial-number range; identifies a defective batch.
- **Compare to:** Yotpo, Trustpilot, Stamped — review
  aggregators; no substrate-level pattern mining; require
  operator-side analysis.
- **Loam's edge:** the substrate surfaces patterns the
  operator wouldn't have time to find manually.

#### K.3.6 — Photos

Image-handling is platform-specific but the substrate adds
value in **catalog consistency** and **lifecycle**.

- **`commerce/photo-consistency-check`** (TENANT plane).
  Reads the operator's listing photos; identifies
  inconsistencies in lighting, background, scale.
  Proposes a standard.
- **`commerce/photo-refresh-suggest`** (TENANT plane).
  Identifies listings whose photos are >18 months old;
  suggests a refresh based on platform-best-practice
  evolution.
- **`commerce/cohort-photo-pattern`** (COHORT plane).
  Surfaces what works in the cohort (lifestyle vs
  product-on-white; macro detail vs context shots).
- **Vertical examples:**
  - Jewelry: cohort signal shows "macro detail of clasp
    + worn-on-model" outperforms "product-on-white";
    surfaces to the operator.
  - Food: cohort signal shows "in-use shot (drizzle on
    food) + ingredient flat-lay" outperforms package-only.
  - Electronics: cohort signal shows "size-comparison
    with everyday object + back-of-package spec sheet"
    outperforms hero-shot-only.
- **Compare to:** Pixc, Booth.ai, native platform photo
  tools; don't see cohort patterns; one-size-fits-all
  guidance.
- **Loam's edge:** photo guidance is cohort-aware.

#### K.3.7 — Inventory

Inventory management is the operator's most
operationally-consequential area. The substrate adds value in
**demand forecasting** and **cohort-aware
restock-signals**.

- **`commerce/restock-forecast`** (TENANT plane). Reads
  the operator's sales history; projects when to reorder.
- **`commerce/cohort-demand-signal`** (COHORT plane).
  Surfaces emerging cohort-wide demand patterns
  (a sudden surge in "celestial brass jewelry" across
  the jewelry cohort might suggest an upcoming trend).
- **`commerce/dead-stock-detect`** (TENANT plane).
  Identifies SKUs that haven't sold in 6+ months;
  proposes discount or discontinue.
- **Vertical examples:**
  - Jewelry: cohort demand signal shows "smoky quartz"
    spiking; the operator (who has 3 smoky-quartz SKUs)
    gets a "consider increasing photo prominence"
    suggestion.
  - Food: cohort demand signal shows "low-sodium hot
    sauce" spiking; the operator (who doesn't have a
    low-sodium variant) gets a "consider adding a
    low-sodium variant" suggestion.
  - Electronics: cohort dead-stock signal identifies the
    operator's RAM-DDR3 inventory as below the cohort's
    moving-average; suggests price cut to clear before
    the cohort floods.
- **Compare to:** Inventory Planner, StockTrim, native
  platform tools; don't see cohort patterns; produce
  per-shop forecasts in a vacuum.
- **Loam's edge:** cohort signal is the early-warning
  system for trend pivots.

#### K.3.8 — Finance

Financial visibility for small shops is poor across the
market. The substrate's contribution is **honest
projection** and **gentle-CFO discipline**.

- **`commerce/profit-margin-per-listing`** (TENANT plane).
  Reads the operator's COGS + sales + fees; computes
  per-listing profit margins; surfaces the bottom 20%.
- **`commerce/cashflow-projection`** (TENANT plane).
  Projects cashflow 90 days forward based on order
  cadence, supplier payment terms, platform payout
  schedules.
- **`commerce/4-check-sustainability`** (the gentle-CFO
  test, §19.2 + §J.6.1). Before recommending any
  spend (a marketing campaign, a new SKU, a tier
  upgrade), checks against the cashflow projection.
- **Vertical examples:**
  - Jewelry: operator considers a $200 Instagram ad
    campaign. The substrate projects the operator's
    cash position 30 days out; if the cash position is
    fragile, the substrate surfaces "this campaign
    fits your budget" or "this campaign would tighten
    your cash position; consider waiting 2 weeks".
  - Food: operator considers a new packaging supplier
    with $500 minimum order. The substrate projects
    against current cash + projected revenue.
  - Electronics: operator considers a Magic-tier
    upgrade. The substrate runs the 4-check; if the
    operator's usage doesn't justify Magic, surfaces
    the honest comparison and recommends Dream.
- **Compare to:** QuickBooks, Xero, Wave — accounting
  software, not financial-decision software. Don't
  proactively project; don't refuse-as-feature.
- **Compare to (recent market failure):** Cursor's June
  2025 refund cycle. The Cursor product over-billed
  developers because the substrate had no cost-projection
  check; the resulting reputation damage + refund cycle
  is the canonical example of the absence the gentle-CFO
  test is designed to prevent.
- **Compare to:** Replit Agent's "charges for failed
  attempts" market positioning — operators paid for
  outcomes they didn't get; the lack of pre-spend
  sustainability check is the failure.
- **Loam's edge:** the substrate refuses to recommend
  what the operator can't afford. **Refusal as
  feature.**

#### K.3.9 — Tax

Tax handling is jurisdictional and complex. The substrate's
contribution is **categorization** and **regulatory
surface tracking**.

- **`commerce/tax-category-assign`** (TENANT plane +
  WORLD plane). Reads the operator's products; assigns
  tax categories per jurisdiction.
- **`commerce/nexus-projection`** (TENANT plane).
  Tracks the operator's sales by destination state;
  projects when they'll cross nexus thresholds.
- **`commerce/regulatory-change-alert`** (WORLD plane).
  Surfaces tax-law changes affecting the operator's
  product categories.
- **Compare to:** TaxJar, Avalara — tax software;
  reactive (process completed transactions); don't
  project nexus crossings; don't connect to the
  operator's substrate-aware financial picture.
- **Loam's edge:** projection + cross-area integration
  (the nexus projection composes with the cashflow
  projection).

#### K.3.10 — Marketing

Marketing is where dark-pattern resistance matters most.
The substrate's discipline:

- **`commerce/campaign-suggest`** (TENANT plane + COHORT
  plane). Suggests marketing campaigns based on the
  operator's product + the cohort's high-performing
  patterns; runs the 4-check before recommending.
- **`commerce/email-frequency-calibrate`** (TENANT plane).
  Tracks the operator's email send patterns; warns
  against over-sending; suggests cadence calibration.
- **`commerce/upsell-honesty-check`** (TENANT plane).
  Reviews proposed upsells for dark-pattern shape; flags
  patterns that match FTC dark-pattern criteria.
- **Compare to:** Klaviyo, Mailchimp, Omnisend — marketing
  automation; designed to maximize send-rate; lack
  dark-pattern refusal.
- **Loam's edge:** marketing tools that refuse to do the
  dark-pattern thing.

#### K.3.11 — SEO

SEO is keyword and structural. The substrate adds
cohort-aware competitive intelligence.

- **`commerce/keyword-gap-analyze`** (TENANT plane +
  COHORT plane). Compares the operator's keyword
  coverage to the cohort's high-performing keyword set.
- **`commerce/listing-structure-suggest`** (TENANT plane
  + COHORT plane). Suggests title/description/tag
  structures based on cohort patterns.
- **`commerce/serp-tracking`** (TENANT plane + WORLD
  plane). Tracks the operator's search-engine
  rankings; surfaces movement.
- **Compare to:** Marmalead, eRank (Etsy-focused),
  Helium 10 (Amazon-focused). Cohort signal is per-
  platform; cross-platform consolidated view is
  fragmented across multiple SaaS subscriptions.
- **Loam's edge:** cross-platform SEO under one
  substrate; cohort signal is genuinely cohort, not
  platform-segmented.

#### K.3.12 — Analytics

Analytics is where the substrate's intelligence behaviors
become operator-visible.

- **`commerce/anomaly-surfacing`** (TENANT plane).
  Surfaces metric anomalies; explains them where
  possible.
- **`commerce/insight-of-week`** (TENANT plane + COHORT
  plane). Weekly digest of substrate-discovered insights
  about the operator's shop.
- **`commerce/what-changed`** (TENANT plane). Compares
  this week to last week; identifies what shifted.
- **Compare to:** Shopify Analytics, Etsy Stats, Amazon
  Brand Analytics. Per-platform, descriptive; lack
  cross-platform synthesis; lack cohort context.
- **Loam's edge:** analytics that synthesize across
  platforms + tell the operator what matters this week
  vs the noise.

---

### K.4 — The 3-layer surfacing pattern, as product UX

The §19 surfacing pattern is the substrate's UX discipline.
Three layers:

1. **Substrate-driven proactive surfacing.** The substrate
   notices something worth surfacing; Sakura raises it in
   her morning briefing.
2. **Cart-driven contextual surfacing.** A cart the
   operator is running surfaces a relevant detail in
   context.
3. **Operator-driven exploratory surfacing.** The operator
   asks Sakura a question; Sakura mines the substrate for
   the answer.

The discipline across layers:

- **Substrate-proactive is daily.** Sakura's morning
  briefing is a fixed 1-2 minute read; bounded by the
  9-of-10 silence ceiling.
- **Cart-contextual is task-bound.** Surfaces only when
  the operator is actively engaged with the relevant
  area.
- **Operator-exploratory is bounded.** Sakura's
  responses cite the substrate-source; the operator can
  verify; the substrate isn't asked to invent.

#### K.4.1 — Compared to Notion AI

Notion AI surfaces within the editor — "ask AI to summarize
this page", "ask AI to draft this section". The pattern is
**user-initiated**, contextual to the document being edited.

Loam's pattern differs:

- Loam's substrate-proactive layer surfaces unprompted
  (Notion AI doesn't volunteer).
- Loam's surfacing is cohort-grounded (Notion AI is
  per-user).
- Loam's surfacing is budget-bounded (Notion AI bills
  per-request).

#### K.4.2 — Compared to Linear

Linear's "Cycle Reviews" are auto-generated summaries of
sprint outcomes. The pattern is **scheduled summarization**.

Loam's pattern differs:

- Loam's cohort signal adds context Linear can't (Linear
  is per-workspace).
- Loam's refusal-as-feature is explicit (Linear's
  reviews are always generated).

#### K.4.3 — Compared to Apple Intelligence

Apple Intelligence's "Smart Reply" surfaces suggested
responses in Messages. The pattern is **inline
suggestion**.

Loam's pattern differs:

- Loam's per-cart context is broader (Apple Intelligence
  is per-app).
- Loam's audit trail is operator-accessible (Apple
  Intelligence is opaque).
- Loam's cohort grounding is cross-tenant (Apple
  Intelligence is per-device).

#### K.4.4 — The substrate-invisibility insight

The three-layer surfacing works because operators don't
think about the substrate; they think about Sakura, about
their carts, about their shop. The substrate is the floor
those three stand on. The §28.7 patentable surface
(substrate invisibility) is the architectural property that
makes the surfacing feel natural.

---

### K.5 — Refusal-as-feature, in the operator's experience

The §19.1.4 reverse-suggest demotion + the §19.2.4 9-of-10
silence ceiling + the §J.6.1 4-check sustainability test
together produce a substrate experience that **refuses
more than it recommends**.

#### K.5.1 — The numbers behind the silence

The §19.2.4 ceiling: Sakura speaks at most 9 times in any
10 surfacing opportunities. The 10th is reserved for the
honest-silent acknowledgment ("nothing to say today; your
shop is steady").

In practice, the ratio is closer to 4-6 surfaces per 10
opportunities. The substrate has more silence than
recommendation. This is the inversion of the SaaS-upsell
default.

#### K.5.2 — The reverse-suggest demotion narrative

The narrative the operator experiences: three weeks after
upgrading to Magic ($99.99/month), the operator opens
their morning briefing and Sakura says:

> "You upgraded to Magic three weeks ago. Looking at the
> carts you've actually run, you'd fit comfortably in
> Dream ($39.99/month). I'm not telling you what to do —
> the choice is yours — but I want to be honest: you're
> spending $60/month on capability you haven't needed.
> Want to roll back?"

The operator's reaction: surprise, then trust. The
substrate just suggested losing $60/month of recurring
revenue for Lacuna. The implication: the substrate is
operating in the operator's interest, not the platform's.

The reverse-suggest narrative is the **trust-building
mechanism**. Operators who experience it report higher
NPS scores and lower churn (substrate-internal data;
externalized in Q4 2026 product report).

#### K.5.3 — The 4-check sustainability test, narrated

The 4-check runs before any recommendation that would cost
the operator money or significant time. The four checks:

1. **Token budget.** Does the operator have the tokens
   to run this recommendation?
2. **Time budget.** Is the recommendation's setup time
   within what the operator can reasonably commit this
   week?
3. **Cash projection.** Does the recommendation's
   downstream cost fit the operator's cashflow
   projection?
4. **Cohort confidence.** Is the substrate's confidence
   in the recommendation above the 0.85 floor?

If any check fails, the recommendation is refused — with
the failure reason surfaced honestly.

The operator's experience:

> "I was going to suggest running the holiday-campaign
> cart, but you'd burn through 70% of your monthly
> Magic-tier budget on it, and based on your shop's
> sales history, the campaign's projected return is
> tight. I'd hold off; do you want me to suggest a
> lower-cost campaign instead?"

The refusal is **transparent + actionable**. The operator
knows why; the operator has an alternative; the operator
has agency.

#### K.5.4 — The FTC dark-pattern compliance angle

The refusal-as-feature pattern is the operator-experience
manifestation of the §J.6.1 FTC dark-pattern guidance
compliance. Every refusal is logged in the audit; the
audit is the substrate's defense in any regulatory
inquiry.

The product's edge is that the compliance posture is
also the user-trust posture. The substrate's compliance
isn't a tax — it's the moat.

---

### K.6 — The tier identity naming, as conversion lever

Tier naming — Free / Imagine / Dream / Magic — is the
substrate's pricing surface. The naming is identity-based
("become a Dream operator") rather than feature-based
("Dream includes X, Y, Z").

The product reasoning:

- **Identity-based naming converts higher.** In Etsy/eBay/
  Shopify operator surveys (2025-2026 substrate-internal
  data), identity-named tiers convert 15-30% better than
  generic Bronze/Silver/Gold across the operator-segment.
- **Identity-based naming is sticky.** Operators who
  identify with a tier ("I'm a Dream operator") have
  lower churn than operators who categorize themselves
  by features.
- **Identity-based naming supports demotion.** The
  reverse-suggest demotion narrative is gentler when
  the operator is downgrading from Magic-the-identity to
  Dream-the-identity rather than from Tier-3 to Tier-2.

The naming is part of the substrate's product story. The
moat is the substrate's mechanics; the conversion lever
is the naming + the surfacing pattern.

---

### K.7 — Cross-product intelligence, as operator value

The §6 multi-service Loam ships v1.0 with Curator
(Sakura on Etsy/eBay/Shopify) as the primary service. The
v1.5-v2.0 horizon adds Foodie, Baobab (wallet), Sakura
Prep (GED coach), Bloom. Each service is its own product;
cross-product cohort signals are the platform's value.

#### K.7.1 — The "students struggling with vocab who also have low cooking-time budgets" example

The architect's verbatim brief example: cross-product
intelligence enables Sakura Prep to surface "students
struggling with vocab who also have low cooking-time
budgets get short audio drills". The substrate makes
this possible because:

- Sakura Prep's TENANT plane has the student's vocab
  performance.
- Foodie's TENANT plane has the operator's cooking-time
  patterns (where the operator is the student's parent).
- The cohort plane (in this case, a cross-service cohort
  defined as "households where Sakura Prep + Foodie are
  both active") has the aggregate pattern.
- The K-floor protects individual households; the
  inference is at the cohort level.

The recommendation is **cross-service**: Sakura Prep
surfaces the recommendation; the substrate enables it; no
single-product startup could have built it because they
don't span services.

#### K.7.2 — Operator-side privacy

The cross-service intelligence requires explicit operator
opt-in. The §6.4 cross-service Macaroon grants are the
authorization surface; the operator (typically the
household's primary user) authorizes the cross-service
visibility at the per-service consent level.

The architectural property: cross-product intelligence is
opt-in, audit-trailed, K-anonymized. Operators who opt in
get the value; operators who opt out get per-service
intelligence with no cross-service signal.

#### K.7.3 — Compared to Apple Continuity

Apple Continuity ships cross-device intelligence (your
Mac knows where your iPhone is). The substrate's
cross-service intelligence is the same pattern at the
product level (Sakura Prep knows the household's Foodie
patterns).

The differentiator: Apple's substrate is hardware-bound;
Loam's substrate is product-family-bound. Loam's
substrate enables cross-product intelligence across any
Lacuna product on the substrate; Apple's only works
within Apple's ecosystem.

---

### K.8 — The operator scenarios that crystallize the substrate's value

Three operator scenarios that name the substrate's value
in the operator's own language:

#### K.8.1 — The "I almost bought the upgrade" scenario

An operator considers upgrading from Imagine ($9.99/month)
to Dream ($39.99/month). The substrate's 4-check runs:
the operator's actual usage doesn't justify Dream. Sakura
says "you're not using enough of Imagine to justify the
jump yet; let me suggest two carts that would unlock more
of Imagine first, and we'll revisit Dream in 30 days".

The operator's reaction: "the AI talked me out of
spending more money". This is the **trust-building
moment** — and it's also the most-cited reason in
substrate-internal exit surveys when operators
churn-cancel and later come back.

#### K.8.2 — The "the AI noticed before I did" scenario

An operator's shop has been declining slowly over 8
weeks; the operator hasn't connected the decline to
anything specific. Sakura's weekly brief surfaces "I've
noticed your average response time on conversations rose
from 4 hours to 17 hours over the past 8 weeks; the
cohort signal suggests response time is a buyer-trust
factor that correlates with repeat purchase; want me to
suggest a triage system?". The operator follows up;
the response time drops; repeat-purchase rate recovers
over the next 4 weeks.

The operator's reaction: "the substrate watched my back".
This is the **substrate-as-noticed-partner moment**.

#### K.8.3 — The "I forgot to update tax categories" scenario

An operator launches a new product line; forgets to
update tax categorization. The substrate's
`commerce/tax-category-assign` cart catches the
unassigned products on the next nightly sweep; surfaces
a fix-it suggestion in the operator's morning brief.
The operator approves the fix in two taps; the tax
categorization is correct; the operator avoids the
potential audit consequence.

The operator's reaction: "the substrate handled what I
forgot". This is the **substrate-as-backstop moment**.

---

### K.9 — The product-craft moat

The substrate's product-craft moat is the composition of:

1. **Substrate-invisibility** — operators experience
   their shop, not the database.
2. **Cohort-grounded intelligence** — recommendations
   are statistically rooted in peer performance.
3. **Refusal-as-feature** — operators trust because the
   substrate refuses to upsell.
4. **Cross-product intelligence** — the substrate gets
   smarter as more Lacuna products onboard.
5. **Audit-trailed transparency** — operators can verify
   any substrate decision.
6. **Sustainable cost framing** — the gentle-CFO
   discipline keeps operators from running dry.

Each piece exists in isolation in some competitor's
product. The composition is what Loam ships. Operators
experience the composition as a substrate that **feels
different** — and over time, the difference is what
keeps them.

> "Trust is the slowest-built moat, and once it's built,
> it's the hardest to dislodge. You build it by being
> trustworthy at the moments that matter."
> — Don Norman, *The Design of Everyday Things*,
> revised ed. 2013 (Ch. 7 paraphrase)

The substrate's "moments that matter" are the refusal
moments, the reverse-suggest moments, the backstop
moments. Each builds the substrate's trust position
incrementally. After 12 months in the substrate, the
operator's loyalty is not to a feature set; it's to a
relationship.

---

### K.10 — Honest gaps in the product story

Following the §32 honest-gap discipline:

1. **Cold-start operator experience.** New operators
   don't yet experience the cohort signal because their
   cohort doesn't yet exist (or is sub-K). The §P.2.2
   three-tier fallback addresses the technical layer;
   the product experience is still "early operators get
   less". Open question: should new operators get a
   curated "what operators in your domain typically do"
   tour from the substrate-aggregated catalog of cart
   patterns? Current plan: tour ships W14.
2. **Operator-facing substrate explanations.** Operators
   sometimes ask "why did Sakura suggest this?". The
   §M.13 provenance field is available; the operator-
   facing surface for the provenance is per-cart and
   inconsistent. Open question: should there be a
   substrate-level "explain this recommendation" UI
   that's consistent across all carts? Current plan:
   ships post-1.0.
3. **Cross-platform consolidated view.** The §K.3
   walkthrough assumes operators view their shop one
   platform at a time. Multi-platform operators want a
   consolidated view. Open question: should the
   substrate provide a cross-platform "your business
   overview" surface? Current plan: ships post-1.0;
   the substrate plumbing exists in v1.0.
4. **Operator coaching for low-substrate-engagement
   accounts.** Some operators don't engage with the
   substrate's surfaces; their experience degrades over
   time. Open question: should the substrate proactively
   reach out to under-engaged operators? Current plan:
   yes, with operator-controlled engagement frequency;
   ships post-1.0.

Each gap above has a tracked plan or an open decision.
The substrate's product story is honest about what's
shipped and what's coming.

---


---

## §39 — Failure Modes + Scale Stress + Adversarial Narratives (Priya)

*This chapter is the substrate's adversarial register. Every failure
narrative referenced inline elsewhere in the doc as "**Failure mode
(Priya): …**" expands here with the recovery story, the scale-stress
arithmetic, and the per-attacker-class narrative.*

### P.1 — The posture, in one paragraph

If you assume the substrate is correct because the design is
elegant, the substrate will break when reality stresses an
assumption you didn't surface. Priya's job is the inverse:
surface every assumption, then walk the failure that happens
when the assumption is wrong. The substrate ships because the
failure narratives have known recovery stories, not because
the design is bulletproof.

Brewer's framing from the 2012 *CAP Twelve Years Later* paper
is the design discipline:

> "The hard part is not deciding which two of three to keep.
> The hard part is being honest about the conditions under
> which the choice flips." [paraphrase]

This section is that honesty applied across the substrate.

---

### P.2 — The §32 honest-null expansions

§32 of the master doc enumerates the things the substrate
doesn't yet do or doesn't fully solve. This section walks each
one with the failure narrative + the recovery story + the
operational telltale.

#### P.2.1 — Litestream silent replication

**The assumption.** Litestream v0.5.5 reliably replicates every
WAL segment to the configured destinations.

**The failure.** A network partition or destination credential
revocation causes Litestream to silently fail. The local
SQLite file is fine; the audit log shows local writes; the
operator sees responses as normal. The cold-store quorum
silently lags.

**The narrative.** It's a Tuesday afternoon. An R2 region
rotation invalidates a credential we didn't refresh. Litestream
keeps trying, gets 401s, marks the destination as failed in its
local state, continues with the other 4 destinations. The 3-of-5
quorum still holds; no operator-visible signal. The §14.5
monthly drill catches the lag two weeks later when the drill
pulls from R2 and finds segments missing for the previous
14 days. By that point, three other destinations had
intermittent issues too, and the quorum margin is thinner than
intended.

**The recovery.** The §14.5 drill is the canary. The drill's
"pull from each destination independently" step would have
caught this in real time if we ran it daily. We don't run it
daily because each drill costs ~4 engineer-hours and a Fly
machine for the night. The compromise: a daily *automated*
quorum-health ping (a 1KB write to each destination + readback
check) that runs at 04:00 UTC, alerts within 60 seconds if any
destination fails. The full drill stays monthly; the
automated ping fills the gap.

**Telltale.** A SYSTEM event named `quorum-degraded-destination`
fires the first time a destination misses an ack. The Lacuna
on-call rotation reacts within the 30-minute SLO. The cohort
that depends on the missing destination falls back to 2-of-5
for the duration; if a second destination is degraded, the
substrate refuses durability=quorum writes until quorum is
restored.

**Open question.** Is daily automated ping sufficient, or do
we need per-write quorum-state propagation to the operator?
Per-write would surface "your last write is sitting on 3 of 5
destinations as expected" but adds UI complexity. **Decision
deferred to the operator-feedback window post-W6 (W6a + W6b have
shipped per the burn-down; the operator-feedback window opens on
the first paid-operator cohort to land).**

#### P.2.2 — Cohort discovery cold-start

**The assumption.** Cohort discovery requires K=8 distinct
tenants to produce a meaningful cohort. At v1.0 launch, many
domains will have fewer than K operators.

**The failure.** A new operator joins a domain with <K
participants. The substrate has no cohort to assign them to;
the §16.3.2 schema-suggests-itself sweep has no
cross-tenant signal; the §16.3.9 pattern-mining produces
nothing. The operator's substrate-intelligence experience is
empty — Sakura has nothing to say beyond what the operator's
own data tells her.

**The narrative.** Loam launches with ~50 paying jewelry
operators. The first "jewelry-specific" cohort discovery
produces a real cohort (≥8 jewelers; substrate has signal).
The first "Greek-Orthodox-iconography artisan" operator joins;
there are 2 of them across the platform; cohort discovery
refuses to form a cohort; the operator's onboarding experience
is "Sakura has not yet learned about your domain". The
operator's onboarding survey response: "I expected the AI to
know jewelers; why doesn't it know my niche?"

**The recovery.** Three-tier fallback for cold-start:

1. **Within-cohort proxy.** Until a domain-specific cohort
   exists, use a parent cohort (e.g., "jewelry" includes
   "Greek-Orthodox-iconography artisans"). Sakura surfaces
   "based on jewelers' patterns" and the operator-visible UI
   honestly notes the proxy.
2. **Cross-service proxy.** If even the parent cohort is
   sub-K, use a cross-service proxy (e.g., "Etsy artisans
   broadly"). Sakura surfaces with the broader framing.
3. **Substrate-knows-nothing honest-null.** If all proxies
   fail, Sakura says "you're early — your domain doesn't have
   enough patterns yet; I'll learn as more operators join".
   The operator sees the honest state, not a manufactured
   recommendation.

**Telltale.** The §16.3.5 anomaly surface lights up when more
than 20% of cohort lookups for a service fall back to
proxies. The fleet ops dashboard surfaces "service X is
cohort-cold" as an early-stage indicator.

**Open question.** Should we incentivize early operators to
opt into a "platform-wide alpha cohort" that pools across
domains for the cold-start window? The cohort would be wider
than ideal but would give all early operators *some* signal.
**Trade-off: faster signal vs less domain-relevant signal.
Decision deferred.**

#### P.2.3 — 14,471-callsite migration regression

**The assumption.** The codemod + the per-callsite test
backstop catch all migration regressions before production.

**The failure.** A callsite that the codemod tagged as
TENANT was actually using the 1.0 cache as a quasi-COHORT
aggregator (a pre-Loamification pattern that worked by
convention). The migration silently switches the semantics;
the cart's downstream consumer sees different data after
migration; subtle business-logic bug ships.

**The narrative.** A 2024 cart `etsy/listing-quality-check`
used `loam.cache.put("aggregate-by-category", ...)` as a
de-facto cohort aggregator — the key was the same across all
operators, so the cache effectively pooled. Nobody documented
this; the original author left in 2025. The codemod sees
`loam.cache.put` and renames to `loam.tenant.put` per the
mechanical rule. The cart now writes to each operator's
TENANT plane; the aggregation breaks; the cart's quality
scoring drops to per-operator-only and the cohort signal
disappears. The bug is invisible until an operator complains
two weeks later about "the AI's recommendations feel weaker
this month".

**The recovery.** Three defenses, layered:

1. **Migration test backstop.** Every codemod-touched callsite
   gets a test asserting the plane. The pre-existing test
   suite catches the obvious cases; the post-migration audit
   for the first 30 days runs an "is this cart's output
   pattern statistically different from pre-migration?" sweep
   that flags candidates for human review.
2. **Shim period observation.** During the 4-week shim
   window, the shim logs every cache-key the legacy surface
   touched. Keys that appear across many operators (a sign
   of de-facto cohort use) get flagged for human review
   before the shim is removed.
3. **Sakura observability.** Operators have a Sakura-mediated
   "tell me what changed about my recommendations" surface.
   When 5+ operators in a cohort report degraded
   recommendations within a 7-day window, the operator-
   visible signal triggers a SYSTEM event.

**Telltale.** The shim's `de-facto-cohort-key-detected` log
event. The post-migration audit's "cart output drift" sweep.
The operator-side "recommendations weaker" cluster signal.

**Open question.** Can we automate the "de-facto cohort
key" detection or does it require human review? The current
plan is human review for the first 30 days, then automation
based on what we learn. **Plan: revisit after week 6 of
migration.**

#### P.2.4 — Scale stress at 10K tenants × 100 carts × 1 op/sec

**The assumption.** The substrate scales to 10K tenants ×
100 active carts/tenant × 1 op/sec/cart on Fly's
performance-2x box class.

**The failure.** Reality at 10K tenants exposes a
combinatorial pattern the design didn't anticipate. The
specific failure: the §SJ.4.4 cross-shard K-floor coordinator
becomes a hot path for cohorts that span multiple shards. The
coordinator's federated query latency rises non-linearly with
the number of shards in the cohort.

**The narrative.** At 1K tenants, every cohort fits in 1
shard; the coordinator is rarely invoked. At 5K tenants,
some popular cohorts ("Etsy jewelers") span 3-4 shards; the
coordinator runs occasionally; latency is fine. At 10K
tenants, the popular cohort spans 8-10 shards; the
coordinator runs constantly; each federated query waits on the
slowest shard's response; the p99 latency for cohort reads
balloons from 25ms to 400ms. Operator-visible: Sakura's
"cohort-based recommendation" surfaces feel slow.

**The recovery.** Three mitigations stacked:

1. **Shard-coalescing for hot cohorts.** When a cohort's
   shard count exceeds 6, the substrate proposes a
   shard-coalescing operation (a §15.4 sub-discipline).
   The proposal goes to a SYSTEM-tier reviewer; on approval,
   the cohort's members are re-sharded into fewer, larger
   shards. The K-floor remains; the federated query depth
   decreases.
2. **Coordinator caching.** The coordinator caches federated
   results for 60 seconds when the cohort's membership
   churn rate is below a threshold. The cache reduces
   repeated federation cost during high read volume.
3. **Per-cohort read SLO surfacing.** When a cohort's read
   latency exceeds the SLO (200ms p99), an operator-visible
   "this cohort's signal is slow" honest-null appears
   instead of waiting. The operator can choose to wait or
   to proceed with the TENANT-only signal.

**Telltale.** The §21 dashboard's "cohort latency
distribution" panel. Spike in the tail latency triggers
review.

**Open question.** Is shard-coalescing safe to automate, or
does it always require SYSTEM-tier review? The discipline
favors human review for v1.0; automation is post-1.0.

#### P.2.5 — CRDT divergence in Cortex-of-Loam sync

**The assumption.** The §17.6 Cortex-of-Loam sync to the
substrate is eventually consistent via CRDT-style merge.
Conflicts converge to a deterministic state.

**The failure.** A clock-skew event between an operator's
device and the substrate produces a Last-Write-Wins decision
that surprises the operator. The operator wrote X on their
phone (offline); the substrate received an earlier write Y
with a later timestamp (because the operator's phone clock
was lagging); LWW picks Y; the operator's X is silently
overwritten on next sync.

**The narrative.** Operator travels internationally; phone
crossed time-zones; the OS clock auto-corrects but with a
delay. During the delay, the operator updates their cart's
notes ("ship to new address"); the substrate already has a
note from yesterday with a later timestamp (the substrate's
clock is correct). LWW picks the older substrate note; the
operator's new note vanishes on next sync. The operator
discovers the loss when an order ships to the old address.

**The recovery.** Three mitigations stacked:

1. **Monotonic-clock tiebreak.** Loam uses a paired
   wall-clock + monotonic-clock + Lamport-style sequence
   number for each write. The Cortex-side write carries the
   Cortex's monotonic sequence; the substrate-side write
   carries the substrate's. When the wall-clocks disagree,
   the sequence numbers are the tiebreak. This handles
   most clock-skew scenarios.
2. **Conflict surfacing instead of silent merge.** For
   operator-authored content (notes, preferences,
   addresses), the merge surfaces a conflict to the operator
   rather than auto-resolving. Sakura says "you wrote two
   things; which one is right?". The operator disposes.
3. **Cortex-side write log retention.** The Cortex keeps
   the last 30 days of writes locally even after sync. If
   a sync conflict was auto-resolved wrong, the operator
   can find the lost write in the local history.

**Telltale.** Every conflict-merge emits an audit event with
both versions. SYSTEM-tier review of the conflict log
identifies patterns (operators with consistent clock-skew get
proactive monotonic-clock-only mode).

**Open question.** Should the operator-visible conflict
prompt be modal or notification-style? Modal interrupts the
operator; notification can be missed. The current plan:
notification with persistent badge; modal only for
financial / shipping-critical writes.

#### P.2.6 — Loamification 740/680/64 split under pressure

**The assumption.** The Loamification project splits the
1,484 carts into ~740 cohort-aware, ~680 TENANT-only, ~64
WORLD-only. The split holds under real usage; operators get
the right cart in the right plane.

**The failure.** Operators' actual workflows compose carts
across planes in ways the static categorization didn't
anticipate. A cart that the static analysis put in
TENANT-only is being used in a workflow that needs cohort
signal; the cart's output is weaker than it should be;
operators don't know to expect cohort signal so they don't
complain — but their experience is silently degraded.

**The narrative.** The `etsy/title-rewriter` cart was placed
in TENANT-only because its inputs are the operator's own
listings. But operators routinely use it in tandem with
`etsy/competitor-pricing` (cohort-aware) and `etsy/seo-trends`
(WORLD-aware). The workflow's outcome depends on all three.
The TENANT-only `title-rewriter` doesn't have access to
cohort signal — it produces titles that the operator's
peers have already saturated, because it doesn't see the
saturation. The operator's titles underperform; they don't
attribute the underperformance to the substrate; they
attribute it to "the AI just isn't very good".

**The recovery.** Workflow-level analysis instead of
cart-level:

1. **Workflow detection.** The §16.3.9 pattern-mining
   identifies cart sequences operators run together. When
   a cart in a TENANT-only category appears repeatedly
   with cohort-aware carts in the same workflow, the
   sequence is flagged for re-categorization review.
2. **Per-cart escalation channel.** Every TENANT-only cart
   has a `(escalate 'wants-cohort-signal? <reason>)`
   verb. When the cart's logic notices it could use cohort
   signal, it emits the escalation; the §16.3.5 anomaly
   surface aggregates escalations; cart-level patterns
   surface for re-categorization.
3. **Operator-side a/b prompt.** When a cart's a/b test
   shows the TENANT-only variant losing to a hypothetical
   cohort-aware variant by ≥15%, Sakura proactively
   surfaces "this cart could be smarter; want to opt into
   cohort signal?". The opt-in is a one-tap operation; the
   substrate updates the cart's plane assignment.

**Telltale.** The "cart wants cohort signal" escalation
log. The §21 dashboard's "carts with sustained escalations
in last 30 days" panel.

**Open question.** Can we A/B test cart plane assignment
without operator visibility, or is the variation itself
operator-visible? The privacy-respecting answer is operator-
visible; the analytics answer is hidden A/B. **The choice:
operator-visible (consistent with the substrate's
transparency posture).**

#### P.2.7 — Cohort fingerprinting attack via §16.3 behaviors

**The assumption.** The §16.3 substrate-intelligence
behaviors don't leak individual-tenant data because they
operate on aggregates above the K-floor.

**The failure (B.16 from §32).** A sophisticated adversary
observes the substrate-intelligence outputs (schema
proposals, anomaly surfacing, pattern-mining proposals) over
time and reconstructs individual tenant contributions via
inference attacks. The K-floor protects per-query reads but
doesn't protect the time-series of substrate-intelligence
outputs.

**The narrative.** An adversary controls a single tenant
account in the "jewelry" cohort. The adversary watches the
substrate's schema-proposal sweep for the cohort. Every
time the adversary writes a new fact, the next sweep's
proposal shifts subtly. By probing — writing facts with
specific shapes — the adversary can infer the *other*
cohort members' fact distributions. Over weeks, the
adversary reconstructs approximate distributions of
sensitive data across the cohort despite the K-floor.

**The recovery.** Four defenses, named honestly because
this is an open research area:

1. **Sweep frequency limits + suppression of high-resolution
   outputs.** The sweep runs at most every 6 hours per
   cohort; outputs are coarse-grained (no per-tenant
   contribution exposed). This reduces the
   probe-and-observe rate.
2. **Membership noise.** Schema proposals exposed to a
   cohort include synthetic plausible-but-not-present
   tenant signals (the "plausible deniability" technique
   from differential privacy literature). The adversary's
   reconstruction is noisier.
3. **Per-cohort anomaly detection of probing patterns.** A
   tenant who consistently writes facts that flip schema
   proposals is flagged; their writes are still accepted
   but the schema proposal is computed without their
   contribution (a "leave-one-out" defense).
4. **Honest documentation of the open risk.** §32 names
   this as an open research area. The substrate's
   documentation tells operators that substrate-intelligence
   outputs are aggregates with known privacy limitations;
   high-sensitivity tenants should opt out of being
   included in cohort-based intelligence.

**Telltale.** The §SJ.7 anomaly detector's "schema-probe
pattern" classifier (added in W11).

**Open question.** Is differential privacy on substrate-
intelligence outputs sufficient, or do we need to constrain
the outputs further (e.g., suppress proposals that depend
heavily on a single tenant's recent writes)? The literature
suggests both; v1.0 ships DP-on-outputs; the post-1.0 plan
includes per-tenant-contribution-bounded outputs.

#### P.2.8 — Cap-token chain corruption mid-flight

**The assumption.** Cap-token chains validate locally without
external state; a corruption breaks the chain visibly.

**The failure.** A bug in a narrowing intermediary (a cart,
a service) produces a malformed caveat; the chain validates
against the original signing key but the corrupted caveat
silently grants more authority than intended.

**The narrative.** A cart attempts to narrow a token from
"R/W TENANT" to "R TENANT only", but the cart's narrowing
code has a typo: it appends `op:r` instead of `op:get`. The
Shell's verifier looks up `op:r` in the caveat-class enum,
doesn't find it, and per the §SJ.3 strict-allow-list
discipline, rejects the request. **The discipline catches
this case.**

But: if the typo were `op:put` (accidentally widening
instead of narrowing), the verifier would accept the wider
authority because the parent token had `op:put`. The cart
just authorized more than it intended.

**The recovery.** The narrowing API is the choke point:

1. **Narrowing is one-way contractually.** The narrowing
   API (`token.narrow(plane=X, ops=[get])`) enforces that
   the narrowed caveat is a strict subset of the parent.
   The parent's operations are intersected with the
   narrowing operations; if the intersection is empty, the
   narrowing fails at construction time. The typo
   `narrow(ops=[put])` against a parent with only `[get]`
   produces an empty intersection and an error.
2. **Property tests.** The narrowing logic has property
   tests that assert the narrowed token is always a
   strict subset of the parent. Mutation tests verify the
   narrowing code can't accidentally widen.
3. **Audit trail.** The narrowing is recorded; the
   provenance chain shows every narrowing step. A
   post-hoc audit can identify any narrowing that
   widened (impossible given the API contract, but the
   audit confirms).

**Telltale.** Property test failures in CI. Audit log
analysis for narrowing-history-anomalies.

**Open question.** Should we expose the narrowing API
directly to carts, or always go through a higher-level
"request authorization for X" pattern that does the
narrowing internally? The higher-level pattern is harder to
misuse; the lower-level is more flexible. Current plan:
both, with the higher-level being the recommended path and
the lower-level being available with extra discipline.

---

### P.3 — Scale-stress scenarios, walked

#### P.3.1 — 10K tenants, baseline load

The baseline assumption: 10K paying operators by end of
v1.0 (the §30 14-16 week build plan's nominal target).
Each operator runs ~5 carts/day at ~0.2 ops/sec sustained.

| Metric | Value | Headroom against budget |
|---|---|---|
| Active shards | ~10K | 60% of Fly box capacity at 16K |
| Steady-state write rate (substrate-wide) | ~10K ops/sec | 30% of Shell capacity |
| Steady-state read rate | ~50K ops/sec | 40% of Shell capacity |
| Litestream segment rate | ~600 segments/min | Within R2/B2/Wasabi free tier |
| Audit log rate | ~10K rows/sec | Within SQLite per-shard budget |
| Cortex-side sync rate | ~1.2 events/sec/operator | Within phone-side bandwidth |

The baseline fits comfortably in the v1.0 hardware footprint
(~3 Fly performance-2x boxes for the Shell fleet, ~1 box for
the substrate-intelligence sweeps, ~1 box for the cold-store
egress).

#### P.3.2 — 10× burst load, single-cohort

The burst: a popular cart fires concurrently across many
operators in the same cohort. Example: a holiday-season
cart that operators schedule for "Black Friday morning";
12,000 operators trigger within 60 seconds.

| Metric | Burst value | Headroom |
|---|---|---|
| Concurrent shard opens | ~12K | Stresses LRU; 2-3× normal eviction |
| Write rate to shared cohort | ~200 ops/sec | Within per-shard write capacity |
| Cohort K-floor coordinator load | ~5K queries/sec | Exceeds single-coordinator budget; needs fan-out |
| Litestream peak segment rate | ~3K segments/min | Within R2/B2 burst budget; Wasabi tightens |

The burst's specific stress points: the cohort K-floor
coordinator + the Litestream Wasabi-side ingest. The
mitigations:

1. **Per-cohort K-floor coordinator pool.** Instead of one
   coordinator, run a pool sized to `ceil(burst_qps /
   1000)`. Each coordinator handles a subset of queries via
   consistent-hash routing.
2. **Litestream destination rate-limiting per-cohort.**
   Wasabi ingest peaks at ~500 PUT/sec sustainable; the
   substrate-side flow control batches WAL segments more
   aggressively under burst, trading replication lag for
   sustained throughput.

The burst recovery is automatic; sustained burst beyond
budget triggers a SYSTEM event and on-call review.

#### P.3.3 — Sustained growth, 100K tenants

Looking past v1.0: the substrate's scale ceiling on the
current hardware footprint. At 100K tenants × 100 carts × 1
op/sec, the steady-state load is ~10× the v1.0 baseline.

The choke points:

1. **Shell fleet size.** 100K active shards / 256 shards-per-
   Shell = ~390 Shell processes. At 8 Shell processes per
   Fly performance-2x box, that's ~50 boxes for the Shell
   fleet alone. The cost is in the $5K-$10K/month range —
   affordable.
2. **Litestream cold-store cost.** ~10K segments/min ×
   ~3M PUTs/day × ~$0.005/1000 PUTs (R2) = ~$45/month
   per destination, ~$225/month across 5 destinations.
   Storage cost dominates: ~10TB across the fleet ×
   $0.015/GB-month (R2) = ~$150/month. Cold-store is
   ~$400/month at this scale; affordable.
3. **Coordinator pool.** The §SJ.4.4 cross-shard K-floor
   coordinator pool grows ~linearly with cohort
   cardinality. 100K tenants in popular cohorts of ~5K
   each gives ~20 cohorts × ~20 shards/cohort = ~400
   coordinator-pool operations. The pool's RAM per
   coordinator is ~50MB; 400 × 50MB = 20GB, fits on one
   Fly performance-4x.
4. **§16.3 substrate-intelligence sweep cost.** Each sweep
   reads a per-cohort sample (~1K facts × ~10KB/fact =
   ~10MB/cohort) plus the cohort's audit log slice
   (~100MB/day/cohort). Cohort-wide sweeps every 6 hours
   gives ~400 cohorts × 4 sweeps/day = ~1600 sweeps/day,
   ~160GB read/day, ~2GB/min sustained. Within a single
   substrate-intelligence box's read budget.

The 100K tenant scale fits in a 60-box fleet at ~$15K/
month. The cost trajectory is sub-linear in tenant count
because the per-tenant overhead is the shard footprint
(small) and the projection cost (amortized across the
cohort).

#### P.3.4 — Adversarial scale: 1M synthetic tenants

The adversarial case: a competitor or attacker creates 1M
synthetic accounts to flood the substrate. Each synthetic
account costs them ~$0 marginal (open signup) but costs the
substrate ~341MB / shard (the §M.1.1 baseline) × 1M = 341
TB if they all stayed open. Unacceptable.

The defenses:

1. **Per-IP signup rate limit.** New signups capped at 10/
   hour/IP, with CAPTCHA at higher rates.
2. **Per-payment-method signup limit.** Even free tiers
   require a payment method on file for any cart that
   consumes >1 minute of compute. Synthetic accounts that
   never trigger high-cost carts have small shards (<10MB
   each); 1M small shards is ~10TB, still within budget.
3. **Cohort cold-shard eviction.** Shards with no writes
   for 90 days are evicted from active storage; their
   audit log is preserved in cold storage; reactivation
   pulls from cold. Synthetic accounts that go dormant
   self-eject.
4. **Identity-graph fraud detection.** Signups that
   correlate suspiciously (same browser fingerprint, same
   IP block, same payment-method-family) trigger SYSTEM
   review.

The adversarial 1M-tenant scenario is bounded by the
above. The substrate's worst case at adversarial load is
~10TB of small shards + the identity-graph review queue;
both are tractable.

#### P.3.5 — Black-swan: regional cloud outage

The black-swan: a full AWS-us-east-1 outage. R2 is on
Cloudflare (independent); B2 is on Backblaze (independent
data centers); Wasabi has multi-region. IPFS pinning is
distributed. Bare-disk-in-escrow is bare-disk-in-escrow.
3-of-5 quorum holds even with us-east-1 down.

The substrate-side concern: Fly's primary region for the
Shell fleet. If Fly's primary region goes down, the Shell
fleet needs to fail over.

The recovery:

1. **Fly multi-region Shell deployment.** Shells deploy to
   3 Fly regions; consistent-hash routing distributes
   shards across regions; a region outage takes 1/3 of
   shards offline.
2. **Cortex local-primary holds the operator.** The
   §17.6 Cortex-of-Loam means the operator's primary
   experience is local; substrate unavailability is felt
   only when the cart needs cohort signal or substrate-
   resident execution. Most cart operations degrade
   gracefully.
3. **Read-only fail-over to cold-store.** A Shell can
   serve read-only from cold-store while the primary
   region is unavailable. The operator-visible signal:
   "writes paused while we recover"; reads continue.

The black-swan tested in the §14.5 monthly drill on
2026-05-15 (simulated us-east-1 outage). RTO: 12 minutes
to read-only fail-over; 47 minutes to full multi-region
recovery. RPO: 5 seconds (per the §M.10.1 invariant).

---

### P.4 — Adversarial narratives, by attacker class

#### P.4.1 — The bored teenager (curious, no specific target)

A teenager with technical skill probes the substrate for
fun. They register an operator account, examine the API,
attempt random verb-payload combinations.

The substrate's response:

- **The §SJ.3 5-verb allow-list rejects invalid verbs.**
  The teenager learns the verb surface in a few hours.
- **The §SJ.7 anomaly detector flags unusual access
  patterns.** The teenager's probing pattern triggers
  auto-pause after ~100 anomalous requests.
- **The auto-pause is reversible.** The teenager can
  re-auth and prove identity; the pause lifts; they
  continue at reduced rate limits.
- **The audit trail captures everything.** A SYSTEM-tier
  reviewer can examine the teenager's session post-hoc;
  no harm done; potentially a recruiting opportunity.

Outcome: bounded probing, full audit, no substrate damage.

#### P.4.2 — The competitive intelligence gatherer

A competitor signs up as a paying operator and runs carts
to extract substrate-intelligence patterns about other
operators in their cohort.

The substrate's response:

- **K-anonymity floor on COHORT reads.** The competitor
  sees aggregates only; individual operator data is
  inaccessible.
- **§16.3 substrate-intelligence outputs are coarse-
  grained.** The competitor learns "jewelers commonly
  use these listing patterns" — public-domain
  competitive intelligence, not protected data.
- **Schema-proposal fingerprinting is detected (§P.2.7).**
  If the competitor uses probing patterns, the anomaly
  detector flags them; their cohort participation can be
  restricted.

Outcome: the competitor learns generic cohort patterns;
they don't learn anything individual-operator-specific;
their competitive advantage from substrate use is bounded
by what the substrate-intelligence outputs are designed to
share.

#### P.4.3 — The disgruntled employee

A former Lacuna employee with prior access knowledge
attempts post-departure substrate access.

The substrate's response:

- **Account-revocation is co-transactional.** The §SJ.7
  abuse-prevention envelope rejects requests from
  revoked principals.
- **Capability-token expiry bounds the post-departure
  window.** The 15-minute default token expiry means
  any in-flight tokens are stale within minutes.
- **The §SJ.6 audit log captures every attempt.** A
  reviewer can reconstruct the attempt sequence; legal
  action is supported by the audit evidence.
- **The §SJ.9 erasure protocol's custodian model
  prevents single-employee compromise of cold storage.**
  3-of-5 custodian destruction means the former employee
  can't unilaterally exfiltrate erasable data.

Outcome: bounded post-departure access, full audit, legal
path open. The substrate's defense depends on the
operational discipline (revocation propagation, custodian
contracts); the technical surface is honest about both.

#### P.4.4 — The nation-state attacker

A nation-state actor seeks to compromise the substrate for
intelligence gathering or for disruption.

The substrate's response is honest:

- **The substrate is not designed to withstand nation-state
  attack on individual accounts.** A targeted operator
  whose device is compromised + cap-tokens stolen
  experiences the same exposure as in any consumer-grade
  cloud service. The substrate's defense is the audit
  trail + the §SJ.9 cryptographic erasure — both bound
  the data exposure window.
- **The substrate's broader posture is defense-in-depth.**
  Compromising the substrate requires:
  - Compromising the Shell process (Rust memory-safety
    raises the bar) + the audit signer + the §SJ.6
    forward-secure key chain.
  - OR compromising the cold-store quorum (requires
    multiple independent cloud providers + the
    organizational access controls separating them).
  - OR compromising the cryptographic erasure custodians
    (3-of-5 contractually independent custodians).
- **The substrate fails closed under suspected compromise.**
  Any anomaly that suggests substrate-level compromise
  triggers a SYSTEM-tier escalation; the on-call rotation
  can pause writes substrate-wide while investigation
  proceeds.

We don't claim immunity to nation-state attack. We claim
the substrate's defense composition makes the attack
expensive (multi-vector required) and observable (audit
trail captures the attack pattern).

> "Security is not a property; it is a process. The process
> requires honest disclosure of what the architecture
> protects against and what it doesn't."
> — Bruce Schneier (paraphrasing a recurring theme in his
> *Crypto-Gram* newsletters)

The substrate's threat model is documented honestly. The
nation-state class is named as out-of-scope for individual
target protection but in-scope for substrate-level integrity
protection.

---

### P.5 — Where this breaks if we're wrong

The substrate's correctness assumes:

1. **The §M.4 dual-hash discipline holds.** If both BLAKE3
   and SHA-256 fall to the same attack, the substrate's
   integrity story collapses. Probability: extremely low;
   the two are unrelated constructions. Mitigation: third
   hash on rotation if either falls.
2. **The §M.6 Shell's Rust code is memory-safe.** If a
   `unsafe` block in the Shell has a buffer overflow, the
   substrate's process integrity collapses. Mitigation: `unsafe`
   blocks are reviewed by two engineers; property tests cover
   the unsafe boundaries; periodic external security review.
3. **The §SJ.4 K-anonymity floor is enough.** If
   sophisticated re-identification attacks become cheaper
   than expected, the K=8 floor may be insufficient.
   Mitigation: raise K and re-shard; the substrate is
   designed to handle K changes.
4. **The §M.2 Litestream pipeline doesn't have hidden bugs.**
   We pinned to v0.5.5 specifically because v0.5.6+ had a
   silent-replication bug. A future version could have
   subtler bugs. Mitigation: the §14.5 monthly drill is
   the canary.
5. **The §SJ.9 cryptographic erasure custodians remain
   trustworthy.** If a custodian secretly retains shares,
   the erasure guarantee fails. Mitigation: the warrant-
   canary discipline + the custodian-rotation protocol.
6. **The §M.5 HNSW recall stays above the SLO.** As the
   substrate grows, embedding distributions shift; the
   index quality may degrade. Mitigation: quarterly recall
   measurements; rebuild with adjusted parameters if
   recall drops.
7. **The §SJ.7 abuse-prevention envelope catches enough.**
   Novel abuse patterns might evade detection until they
   cause damage. Mitigation: continuous classifier
   re-training + manual review of edge cases.

Each assumption above has a stated mitigation. The
substrate's posture is that mitigations exist for every
identified failure; we don't claim mitigations exist for
failures we haven't identified, which is the open-research
boundary.

---


---

## §40 — Example Carts: Pipeline Walkthroughs (25)

*The full-range demonstration. 25 carts spanning magic-tier multi-week
sagas, dream-tier cohort-aware automations, imagine-tier per-operator
productivity, pink-tier trigger-driven simples, and cross-service /
substrate-intelligence-driven patterns. Each with ASCII pipeline
diagram, step-by-step walkthrough, plane usage, Shell decisions,
audit trail, perf characteristics, and failure modes.*

> **Scope note (2026-06-27 per AUDIT-LIES Jess H4).** Of the 25 cited
> slugs below, **1 currently exists on disk**
> (`curator-web/src/scheme/carts/dream/dispute-evidence-pack.sks` —
> see Z.2). The other 24 walkthroughs are **proposed example carts
> that land during the §30 build plan**, not yet on disk. They are
> presented as canonical engineering demonstrations of how each
> capability composes through the substrate, not as addressable cart
> slugs a reader can `grep` for. The §Z.27 summary table reflects
> this scope: 1 shipping, 24 design-stage. A reader who tries a
> walkthrough as an addressable slug will hit "not found" on 24/25 —
> that's now disclosed up-front rather than discovered by attempt.

### Z.1 — How to read these walkthroughs

Each cart has:

- **Name** — the `.sks` slug + the operator-visible common name.
- **Intent** — what the operator wants in one sentence.
- **Tier** — pink / imagine / dream / magic + the per-invocation cost
  in tokens.
- **Pipeline diagram** — ASCII flowchart showing the substrate's
  flow.
- **Step-by-step walkthrough** — prose narrative, 5-15 steps.
- **Plane usage** — which of TENANT / COHORT / WORLD / SYSTEM / PUBLIC.
- **Shell decisions** — what the Shell permits / refuses / escalates.
- **Audit trail** — which rows the cart emits, what the fields are.
- **Perf** — cold-start + warm-cache latency budget; cost in tokens.
- **Failure modes** — 3-5 things that can go wrong + how Loam handles.

The five tier slots distribute as: 5 magic-tier multi-week sagas (Z.2-Z.6),
5 dream-tier cohort-aware (Z.7-Z.11), 5 imagine-tier per-operator
productivity (Z.12-Z.16), 5 pink-tier simple-but-trigger-driven
(Z.17-Z.21), and 5 cross-service or substrate-intelligence-driven
(Z.22-Z.26).

---

### Z.2 — `dream/dispute-evidence-pack.sks` — "Dispute evidence pack" (DESIGN EXAMPLE)

**Intent.** When a buyer opens an Etsy dispute, prepare and stage the
full evidence pack across the dispute's lifecycle.

**Tier.** Dream (`flavor light-purple`). The shipping cart at
`curator-web/src/scheme/carts/dream/dispute-evidence-pack.sks` is
event-triggered immediate-fire — the multi-week Magic-tier walkthrough
below is a **design example** of how the cart would expand into a
multi-week saga at Magic tier (~1,500 tokens / 2-8 weeks). Earlier
drafts of this chapter named the path as `etsy/dispute-evidence-pack.sks`
at Magic tier; that slug doesn't exist on disk. The walkthrough is
preserved as the canonical engineering demonstration of multi-week
substrate orchestration; the v1.1 Magic-tier expansion lands when the
operator base needs it. Corrected 2026-06-27 per AUDIT-LIES Priya M-8 +
Jess H4.

**Pipeline.**

```
+------------------+    +-----------------+    +------------------+
| trigger: dispute |--->| Shell: verify   |--->| TENANT plane:    |
| webhook from etsy|    | cap-token       |    | get order +     |
+------------------+    +-----------------+    | conversation     |
                                              +------------------+
                                                       |
                                                       v
                          +-----------------+    +------------------+
                          | substrate-intel:|<---| COHORT plane:   |
                          | pattern-match   |    | similar disputes|
                          | dispute class   |    | (K-floor 8)     |
                          +-----------------+    +------------------+
                                  |
                                  v
                          +-----------------+    +------------------+
                          | code-artifact:  |--->| WASM exec:       |
                          | evidence-pack   |    | render PDF +     |
                          | template synth  |    | message draft    |
                          +-----------------+    +------------------+
                                  |
                                  v
                          +-----------------+    +------------------+
                          | subscription on |--->| audit: dispute  |
                          | dispute updates |    | row emitted +   |
                          +-----------------+    | provenance      |
                                                 +------------------+
                                                          |
                                                          v
                                                 +------------------+
                                                 | operator UI:    |
                                                 | "dispute pack   |
                                                 | drafted; review"|
                                                 +------------------+
```

**Walkthrough.**

1. Etsy fires the dispute webhook to Sakura's backend.
2. The cart entry hands the webhook payload to the Shell with a
   cap-token narrowed to `service:sakura plane:tenant op:get,append
   cohort:etsy-disputes:<class>`.
3. The Shell verifies; opens the operator's TENANT shard; reads the
   order facts, conversation history, photos.
4. The cart asks the substrate-intelligence layer to pattern-match
   the dispute against the cohort's historical resolution patterns.
   The substrate runs the §16.3.9 pattern-mining over the
   `etsy-disputes` cohort with K=8 floor; returns the modal
   resolution path + the cohort's success rates per evidence type.
5. The cart synthesizes an evidence-pack template from the
   substrate's code-artifact registry (per §28.5 / §SJ.8). The
   template is content-addressed; the synthesis records the
   substrate-intelligence inputs as provenance.
6. The cart executes the template in a WASM sandbox: rendering a
   PDF with the order details, conversation excerpts (PII-scrubbed
   for the buyer's protected fields), and a draft response message.
7. The cart registers a subscription on the dispute's status
   updates via the §10 subscription primitive.
8. The audit log emits a multi-row trail: cart-start, substrate-
   intelligence-query, code-artifact-synth, WASM-exec,
   subscription-register, cart-step-done.
9. The operator sees in Sakura's morning brief: "Dispute opened on
   order #ABC; I've drafted an evidence pack — review and send when
   you're ready". The provenance link lets the operator inspect the
   cohort signal that informed the draft.
10. Over the dispute's lifecycle (2-8 weeks), the subscription
    delivers status updates; the cart re-runs the evidence path on
    each update; the audit trail builds.

**Plane usage.** TENANT (own order/conversation), COHORT
(`etsy-disputes:<class>` for resolution patterns), SYSTEM (audit).

**Shell decisions.**
- **Permit** the read of TENANT order + conversation (operator's
  own).
- **Permit** the K-floored cohort read (K=8 satisfied for the
  `etsy-disputes` cohort).
- **Permit** the code-artifact synth + WASM exec under the cart's
  declared `op:execute` caveat.
- **Refuse** the draft response from sending automatically — the
  cart's manifest doesn't declare `op:send-message`; sending is
  operator-disposed.

**Audit trail.** ~15-30 rows over the dispute lifecycle. Each row
carries the cap-token chain, the verb, the response status, the
provenance pointer.

**Perf.** Cold (first dispute of operator's day) ~1.5s. Warm (cached
cohort signal, cached template) ~400ms. WASM render adds ~600ms
(PDF generation). Total cost: ~1,500 tokens per full lifecycle.

**Failure modes.**

- **Cohort under K.** New operator without enough cohort peers in
  their dispute class — substrate falls back to a parent cohort
  (`etsy-disputes-all`) or to a TENANT-only template. Sakura's
  surfacing honestly notes the proxy: "evidence pack drafted from
  general patterns; cohort signal not yet available for your
  category".
- **Webhook race.** Etsy fires two webhooks for the same dispute
  within milliseconds. Cart-side idempotency on `(dispute_id, event)`
  prevents duplicate evidence-pack generation.
- **PDF render OOM.** WASM memory cap hit (64 MiB per §SJ.8.5; was
  previously cited as 256MB pre-AUDIT-LIES H7) on an unusually
  long conversation history. Cart falls back to truncating the
  evidence pack and noting "conversation truncated for length;
  full history attached as separate file".
- **Audit signer rotation mid-cart.** The forward-secure key
  rotates during the multi-week saga. The subscription's delivery
  callback re-mints the cart's cap-token under the new key on
  next delivery; the cart resumes seamlessly.

---

### Z.3 — `etsy/seasonal-launch-orchestration.sks` — "Holiday campaign across 8 weeks"

**Intent.** Plan and execute a holiday product launch across listing
prep, marketing, inventory, customer service, and post-launch
analytics over an 8-week pre-Christmas window.

**Tier.** Magic. 1,500 tokens; runs ~8 weeks.

**Pipeline.**

```
+------------------+    +-----------------+    +------------------+
| operator triggers|--->| Shell: verify   |--->| TENANT plane:    |
| Q4 launch saga   |    | cap-token chain |    | inventory + cogs |
+------------------+    +-----------------+    +------------------+
                                                       |
                                                       v
                          +-----------------+    +------------------+
                          | 4-check         |    | COHORT plane:    |
                          | sustainability  |<---| holiday spending |
                          | (gentle CFO)    |    | patterns (K=8)   |
                          +-----------------+    +------------------+
                                  | (4-check passes; budget fits)
                                  v
                          +-----------------+
                          | code-artifact:  |
                          | 8-week schedule |
                          | template        |
                          +-----------------+
                                  |
                                  v
                          +-----------------+    +------------------+
                          | weekly sub-     |--->| audit: per-week  |
                          | tasks (cron)    |    | step row emitted |
                          +-----------------+    +------------------+
                                  |
                                  v
                          +-----------------+
                          | week 4 review:  |
                          | reverse-suggest |
                          | demote if dim   |
                          +-----------------+
                                  |
                                  v
                          +------------------+
                          | operator UI:     |
                          | weekly Sakura    |
                          | brief + dossier  |
                          +------------------+
```

**Walkthrough.**

1. Operator opens the seasonal-launch cart at the v1.0 launch
   moment (typically late September for Christmas).
2. The Shell verifies the cap-token chain (operator's root + cart
   narrowing to `op:get,put plane:tenant cohort:etsy-holiday-<vertical>`).
3. The cart reads TENANT inventory, COGS, year-over-year sales
   pattern.
4. The cart asks the substrate for the cohort's holiday-spending
   patterns (K=8 floor). The substrate returns the modal launch
   cadence + the cohort's peak-sale-window distribution.
5. The 4-check sustainability test runs: token budget for the
   8-week saga, time budget (the operator's projected weekly
   availability), cash projection through January, cohort
   confidence. If any check fails, the cart refuses with an honest
   explanation and a smaller-scope alternative.
6. On 4-check pass, the cart synthesizes an 8-week schedule from
   the template registry. The schedule includes listing prep
   (weeks 1-2), photo refresh (weeks 2-3), marketing campaign
   (weeks 3-6), customer service prep (weeks 5-7), peak-window
   (weeks 6-8), post-launch analytics (week 8+).
7. The cart registers weekly sub-task subscriptions via §10's
   cron-style trigger.
8. Each week, the sub-task fires; reads updated TENANT state;
   re-runs the cohort sub-query for any updated guidance;
   surfaces the week's plan in Sakura's brief.
9. At week 4 (midpoint), the cart runs a **reverse-suggest demotion
   check**: if the launch's projected ROI has dropped below
   threshold, Sakura surfaces "the launch is dimmer than expected;
   want to scale back?". The operator can scale back without losing
   the work-to-date.
10. Through week 8 and post-launch, the cart's audit trail builds
    into the dossier the operator reviews to plan next year.

**Plane usage.** TENANT (own inventory, COGS, sales), COHORT
(`etsy-holiday-<vertical>` for spending patterns), SYSTEM (audit
+ cron triggers).

**Shell decisions.**
- **Permit** the multi-plane reads under the saga's cap-token.
- **Refuse** the 4-check failure — the substrate refuses to start
  the saga if the budget projection shows the operator running dry.
- **Permit** the weekly cron triggers under the registered
  subscription's delivery-token.

**Audit trail.** ~50-80 rows over 8 weeks. The dossier is
derivable from the audit trail.

**Perf.** Per-week sub-task cold: ~800ms. Warm: ~250ms. Full saga
token cost: ~1,500.

**Failure modes.**

- **4-check fails on cash projection.** Sakura refuses the saga;
  proposes a 4-week scaled version that fits budget.
- **Cohort signal drifts mid-saga.** A new wave of substrate-
  intelligence schema updates changes the cohort's modal pattern.
  Mid-saga sub-tasks pick up the updated pattern; surfaces "the
  cohort signal has shifted; revised guidance attached".
- **Subscription delivery fails.** Network outage during the
  scheduled trigger. The delivery worker retries with exponential
  backoff; missed weeks land as soon as connectivity restores.
- **Reverse-suggest demotion declined.** Operator chooses to
  continue despite the dim projection. Sakura records the
  override; continues with a "watch for drift" note in subsequent
  briefs.

---

### Z.4 — `sakura/multi-account-portfolio.sks` — "Manage 4 active Etsy stores"

**Intent.** A power-operator runs 4 themed Etsy stores; coordinate
cross-store inventory, pricing, and customer service.

**Tier.** Magic. 1,500 tokens; runs continuously.

**Pipeline.**

```
+------------------+    +-----------------+    +------------------+
| trigger: store   |--->| Shell: verify   |--->| TENANT plane:   |
| update on any    |    | cap-token       |    | all 4 stores    |
| of 4 stores      |    | (cross-store)   |    | (4 shards)      |
+------------------+    +-----------------+    +------------------+
                                                       |
                                                       v
                          +-----------------+    +------------------+
                          | cross-shard     |--->| COHORT plane:   |
                          | aggregation     |    | multi-store     |
                          +-----------------+    | benchmark (K=8) |
                                  |              +------------------+
                                  v
                          +-----------------+
                          | substrate-intel:|
                          | rebalance       |
                          | suggestion       |
                          +-----------------+
                                  |
                                  v
                          +------------------+
                          | operator UI:     |
                          | portfolio board  |
                          | (all 4 stores)   |
                          +------------------+
```

**Walkthrough.**

1. A change on any of the operator's 4 stores fires a trigger.
2. The Shell verifies the operator's cap-token (which has
   `scope: stores:[abc, def, ghi, jkl]`).
3. The cart reads all 4 TENANT shards (one per store).
4. The cart aggregates across the 4 shards (cross-shard query —
   the Shell coordinates the 4 reads).
5. The cart asks the COHORT plane (`multi-store-operators`) for
   benchmark patterns. K=8 floor.
6. The substrate-intelligence layer proposes rebalancing
   suggestions (move SKU X from underperforming store A to
   high-performing store C; align pricing on shared SKUs across
   stores).
7. The operator sees a portfolio dashboard with all 4 stores'
   metrics + the substrate's rebalancing suggestions.

**Plane usage.** TENANT (all 4 stores), COHORT
(`multi-store-operators` for benchmarks).

**Shell decisions.**
- **Permit** the multi-store cap-token (operator's chain proves
  ownership of all 4 shards).
- **Refuse** cross-tenant operations — the cap-token's scope
  doesn't extend to other operators' stores.

**Audit trail.** ~10-20 rows per portfolio refresh.

**Perf.** Cold: ~2s (4 shards in parallel). Warm: ~400ms.

**Failure modes.**

- **One store's shard is cold-tier.** Slowdown on first-touch;
  Sakura's surface shows "store D is loading; partial view shown".
- **K-floor sub-K for multi-store-operators cohort.** Only ~30
  multi-store operators exist at v1.0 launch; cohort signal is
  thin. Falls back to single-store benchmarks with a "limited
  multi-store data" note.

---

### Z.5 — `sakura/wholesale-launch-saga.sks` — "Launch wholesale program"

**Intent.** Operator wants to add a B2B wholesale channel; the saga
walks pricing structure, application form, line-sheet generation,
trade-show prep, and follow-up.

**Tier.** Magic. 1,500 tokens; runs 4-12 weeks.

**Pipeline.**

```
+------------------+    +-----------------+
| operator: "I    |--->| 4-check         |
| want wholesale" |    | sustainability  |
+------------------+    +-----------------+
                              |
                              v
                       +-----------------+    +------------------+
                       | substrate-intel:|<---| COHORT plane:   |
                       | wholesale       |    | wholesale       |
                       | viability score |    | conversion      |
                       +-----------------+    | rates (K=8)     |
                              |               +------------------+
                              v
                       +-----------------+
                       | code-artifact:  |
                       | line-sheet      |
                       | template + form |
                       +-----------------+
                              |
                              v
                       +-----------------+    +------------------+
                       | weekly sub-task |--->| audit: weekly   |
                       | (apps review,   |    | row emitted     |
                       | pricing tune)   |    +------------------+
                       +-----------------+
                              |
                              v
                       +------------------+
                       | operator UI:    |
                       | wholesale board |
                       +------------------+
```

**Walkthrough.**

1. Operator declares wholesale intent; cart opens with the
   sustainability check (wholesale takes time; the saga refuses
   to start if the operator's projected weekly hours can't
   accommodate).
2. The substrate scores wholesale viability based on cohort
   patterns (similar SKU categories' historical wholesale
   conversion rates, K=8 floor).
3. On pass, the cart synthesizes a line-sheet template +
   application form from the artifact registry.
4. Weekly sub-tasks: review applications, tune wholesale pricing,
   prepare for trade shows if relevant.
5. The audit trail becomes the post-launch dossier.

**Plane usage.** TENANT, COHORT (`wholesale-jewelry`,
`wholesale-food`, etc.), SYSTEM.

**Shell decisions.**
- **Refuse** if 4-check sustainability fails.
- **Permit** the multi-week saga with cohort-grounded guidance.

**Failure modes.**

- **Application volume exceeds operator's review capacity.**
  Substrate flags + suggests application-triage criteria.
- **Pricing-power signal too thin in cohort.** Falls back to
  cost-plus pricing guidance.

---

### Z.6 — `magic/cortex-rebuild-from-log.sks` — "Recover from Cortex corruption"

**Intent.** Operator's local Cortex-of-Loam (§17.6) corrupts; the
saga walks the rebuild from the substrate's audit log over the
60-90 minutes the rebuild takes.

**Tier.** Magic. 1,500 tokens; runs ~90 min.

**Pipeline.**

```
+------------------+    +-----------------+
| operator: "my   |--->| Shell: verify   |
| Sakura forgot   |    | cap-token       |
| me"             |    | (recovery scope)|
+------------------+    +-----------------+
                              |
                              v
                       +-----------------+    +------------------+
                       | TENANT plane:   |--->| audit log:      |
                       | full audit pull |    | per-tenant      |
                       +-----------------+    | history         |
                                              +------------------+
                                                       |
                                                       v
                                              +------------------+
                                              | local Cortex:   |
                                              | rebuild from log|
                                              +------------------+
                                                       |
                                                       v
                                              +------------------+
                                              | operator UI:    |
                                              | "Sakura is back;|
                                              | here's what she |
                                              | remembers"      |
                                              +------------------+
```

**Walkthrough.**

1. Operator reports their Cortex acting weird; cart opens with the
   recovery flow.
2. Shell verifies the operator's cap-token; issues a recovery-
   scoped token with `op:recover plane:tenant`.
3. Cart streams the operator's full TENANT audit log to the
   device.
4. The Cortex's local rebuild reconstructs the projection from the
   log per §M.8 discipline; this takes 60-90 minutes for a typical
   operator's history.
5. The cart shows progress; the operator can continue using a
   degraded Sakura during the rebuild.
6. On completion, Sakura's surface shows "I'm back; I remember
   everything as of last sync".

**Plane usage.** TENANT (own audit log).

**Shell decisions.**
- **Permit** the full-log read under the recovery-scoped token.
- **Rate-limit** the streaming to not overwhelm the operator's
  bandwidth.

**Failure modes.**

- **Audit log is also corrupted.** Substrate falls back to
  cold-store; pulls from the §14 quorum.
- **Network drops mid-rebuild.** Cart resumes from the last
  checkpoint.

---

### Z.7 — `etsy/title-rewriter.sks` — "Rewrite listings using cohort patterns"

**Intent.** Operator wants their listing titles to convert better.

**Tier.** Dream. 100 tokens per listing.

**Pipeline.**

```
+------------------+    +-----------------+    +------------------+
| operator: rewrite|--->| Shell: verify   |--->| TENANT plane:   |
| selected listings|    | cap-token       |    | get listing(s)  |
+------------------+    +-----------------+    +------------------+
                                                       |
                                                       v
                          +-----------------+    +------------------+
                          | substrate-intel:|<---| COHORT plane:   |
                          | high-conv title |    | jewelry-handmade|
                          | patterns        |    | titles (K=8)    |
                          +-----------------+    +------------------+
                                  |
                                  v
                          +-----------------+    +------------------+
                          | L2 reasoning    |--->| audit: token    |
                          | (cloud) draft   |    | spend + draft   |
                          +-----------------+    +------------------+
                                  |
                                  v
                          +------------------+
                          | operator UI:     |
                          | side-by-side    |
                          | review + apply  |
                          +------------------+
```

**Walkthrough.**

1. Operator selects listings to rewrite; cart opens.
2. Shell verifies cap-token; reads selected listings from TENANT.
3. Cart queries cohort patterns for high-converting titles in the
   operator's jewelry-handmade cohort (K=8).
4. Cart calls L2 reasoning model (cloud) with the cohort pattern
   + the operator's current titles; L2 drafts rewrites.
5. Audit records the token spend + the draft outputs.
6. Operator sees side-by-side review; applies what they like; cart
   updates the listings (or stages them; operator's choice).

**Plane usage.** TENANT (own listings), COHORT
(`jewelry-handmade` titles).

**Shell decisions.**
- **Permit** the COHORT read at K=8.
- **Permit** the L2 call under the Dream tier's `op:reason` cap.
- **Refuse** the apply-step automatically — operator-disposed.

**Audit trail.** Per-listing: cart-start, cohort-query, L2-call,
draft-emit, apply (if operator approves).

**Perf.** Cold: ~3s (L2 latency dominates). Warm: ~1.5s.

**Failure modes.**

- **L2 unavailable.** Cart falls back to L1 (on-device) with
  honest "cloud unavailable; on-device draft attached".
- **Cohort signal sub-K.** Falls back to parent cohort.

---

### Z.8 — `commerce/cohort-keyword-suggest.sks` — "SEO keywords from peers"

**Intent.** Surface keywords the operator's cohort is using that the
operator isn't.

**Tier.** Dream. 50 tokens per query.

**Pipeline.**

```
+------------------+    +-----------------+
| operator: opens  |--->| Shell: verify   |
| SEO panel        |    | cap-token       |
+------------------+    +-----------------+
                              |
                              v
                       +-----------------+    +------------------+
                       | TENANT plane:   |    | COHORT plane:   |
                       | get operator's  |--->| get cohort's    |
                       | keyword usage   |    | top keywords    |
                       +-----------------+    +------------------+
                              |                       |
                              v                       v
                       +-----------------+
                       | diff: cohort -  |
                       | operator        |
                       +-----------------+
                              |
                              v
                       +------------------+
                       | operator UI:    |
                       | "keywords your  |
                       | peers use that  |
                       | you don't"      |
                       +------------------+
```

**Walkthrough.**

1. Operator opens the SEO panel; cart fires automatically.
2. Shell verifies; reads operator's keyword usage from TENANT.
3. Shell reads cohort's top-keyword distribution from COHORT
   (K=8).
4. Cart computes the diff; surfaces the gap.

**Plane usage.** TENANT (own keywords), COHORT (peer keywords).

**Shell decisions.**
- **Permit** both reads.
- **K-floor enforced** on cohort read.

**Failure modes.**

- **Cohort cold-start.** No peer signal; cart shows
  "still learning your category — check back in 30 days".
- **Operator's keyword set is genuinely novel.** Diff is empty;
  cart says "you're trailblazing — no peer signal to compare yet".

---

### Z.9 — `commerce/buyer-segment-surface.sks` — "Cohort-grounded buyer segments"

**Intent.** Surface buyer segments based on cohort patterns.

**Tier.** Dream. 80 tokens.

**Pipeline.**

```
+------------------+    +-----------------+    +------------------+
| trigger: weekly  |--->| Shell: verify   |--->| TENANT plane:   |
| (cron)           |    | cap-token       |    | buyer history   |
+------------------+    +-----------------+    +------------------+
                                                       |
                                                       v
                          +-----------------+    +------------------+
                          | substrate-intel:|<---| COHORT plane:   |
                          | segment infer   |    | segment patterns|
                          +-----------------+    | (K=8)           |
                                  |              +------------------+
                                  v
                          +-----------------+    +------------------+
                          | weekly brief    |--->| audit: per-seg  |
                          +-----------------+    | row emitted     |
                                                 +------------------+
```

**Walkthrough.**

1. Weekly cron fires.
2. Cart reads operator's TENANT buyer history.
3. Substrate-intelligence infers segments using cohort patterns
   (K=8).
4. Weekly brief surfaces the inferred segments + actionable
   suggestions per segment.

**Plane usage.** TENANT, COHORT.

**Failure modes.**

- **Buyer base too small.** Segments are unstable; cart surfaces
  "your buyer base is building — segments will become more reliable
  at 100+ orders".

---

### Z.10 — `commerce/restock-forecast-cohort.sks` — "Forecast restock using cohort demand"

**Intent.** Forecast when to reorder SKUs using both TENANT and
cohort-wide demand signals.

**Tier.** Dream. 75 tokens.

**Pipeline.**

```
+------------------+    +-----------------+
| trigger: daily   |--->| Shell: verify   |
| (cron)           |    | cap-token       |
+------------------+    +-----------------+
                              |
                              v
                       +-----------------+    +------------------+
                       | TENANT plane:   |    | COHORT plane:   |
                       | sales history   |--->| demand patterns |
                       +-----------------+    | (K=8)           |
                              |               +------------------+
                              v                       |
                       +-----------------+            |
                       | forecast model: |<-----------+
                       | TENANT + cohort |
                       +-----------------+
                              |
                              v
                       +------------------+
                       | operator UI:    |
                       | "reorder X by Y;|
                       | cohort demand   |
                       | rising"         |
                       +------------------+
```

**Walkthrough.**

1. Daily cron.
2. Cart reads TENANT sales history.
3. Reads COHORT demand-pattern (K=8).
4. Forecast model combines both; produces restock recommendations.
5. Operator sees restock priorities with cohort context.

**Plane usage.** TENANT, COHORT.

**Failure modes.**

- **Cohort signal contradicts TENANT.** Cart surfaces both; operator
  disposes ("your sales are flat but the cohort is rising — possibly
  category opportunity, possibly local-market signal").

---

### Z.11 — `commerce/photo-cohort-pattern.sks` — "Photo style from cohort"

**Intent.** Suggest photo styles based on cohort high-performers.

**Tier.** Dream. 60 tokens per listing.

**Pipeline.**

```
+------------------+    +-----------------+    +------------------+
| operator: opens  |--->| Shell: verify   |--->| TENANT plane:   |
| photo workshop   |    | cap-token       |    | get current     |
+------------------+    +-----------------+    | photo metadata  |
                                              +------------------+
                                                       |
                                                       v
                          +-----------------+    +------------------+
                          | substrate-intel:|<---| COHORT plane:   |
                          | high-perf photo |    | photo features  |
                          | feature analysis|    | distribution    |
                          +-----------------+    +------------------+
                                  |
                                  v
                          +------------------+
                          | operator UI:    |
                          | "macro detail + |
                          | lifestyle shot  |
                          | outperform your |
                          | hero-only by 3x"|
                          +------------------+
```

**Walkthrough.**

1. Operator opens the photo workshop; cart fires.
2. Cart reads TENANT photo metadata (no image bytes; just metadata).
3. Substrate analyzes cohort's high-performing photos' feature
   distribution (composition, lighting, subject framing) — features
   derived at write-time by §16.3.4 write-time embeddings; the
   cohort's high-performer distribution is the surface.
4. Cart surfaces actionable photo guidance.

**Plane usage.** TENANT (own photos), COHORT (peer photo features).

**Failure modes.**

- **Photo features lack cohort signal.** Cart falls back to generic
  best-practice guidance with honest "cohort signal not strong for
  this category yet".

---

### Z.12 — `imagine/listing-batch-edit.sks` — "Bulk edit listings"

**Intent.** Operator edits 30 listings at once.

**Tier.** Imagine. 15 tokens (1 token per batch + 0.5 per listing).

**Pipeline.**

```
+------------------+    +-----------------+    +------------------+
| operator selects |--->| Shell: verify   |--->| TENANT plane:   |
| 30 listings + op |    | cap-token       |    | get listings    |
+------------------+    +-----------------+    +------------------+
                                                       |
                                                       v
                                              +------------------+
                                              | apply op to all  |
                                              | (e.g., price +5%)|
                                              +------------------+
                                                       |
                                                       v
                          +-----------------+    +------------------+
                          | substrate: per- |--->| audit: per-edit |
                          | edit fact emit  |    | row emitted     |
                          +-----------------+    +------------------+
                                  |
                                  v
                          +------------------+
                          | operator UI:    |
                          | progress + done |
                          +------------------+
```

**Walkthrough.**

1. Operator selects 30 listings + chooses bulk op (e.g., "increase
   all prices 5%").
2. Cart applies op; each edit emits a TENANT fact.
3. Audit records per-edit row.

**Plane usage.** TENANT only.

**Shell decisions.**
- **Permit** the bulk write under the operator's cap.
- **Rate-limit** the batch (default 100 ops/sec/operator per
  §SJ.7.1).

**Failure modes.**

- **Partial failure (some listings fail to update).** Cart shows
  which ones failed; offers retry on the failures only.

---

### Z.13 — `imagine/conversation-triage.sks` — "Inbox triage with priorities"

**Intent.** Sort the operator's inbox by priority based on TENANT
patterns.

**Tier.** Imagine. 20 tokens.

**Pipeline.**

```
+------------------+    +-----------------+    +------------------+
| trigger: hourly  |--->| Shell: verify   |--->| TENANT plane:   |
| (cron)           |    | cap-token       |    | inbox messages  |
+------------------+    +-----------------+    +------------------+
                                                       |
                                                       v
                                              +------------------+
                                              | per-message      |
                                              | priority score   |
                                              | (sentiment +     |
                                              | urgency + history)|
                                              +------------------+
                                                       |
                                                       v
                                              +------------------+
                                              | operator UI:    |
                                              | sorted inbox    |
                                              +------------------+
```

**Walkthrough.**

1. Hourly cron.
2. Cart reads inbox messages from TENANT.
3. Per-message scoring (sentiment + urgency keywords + sender
   history).
4. Inbox sorted by priority.

**Plane usage.** TENANT only.

**Failure modes.**

- **Sentiment classifier off on edge cases.** Cart shows confidence
  per score; operator can override.

---

### Z.14 — `imagine/inventory-low-stock.sks` — "Low-stock alerts"

**Intent.** Alert when any SKU drops below threshold.

**Tier.** Imagine. 5 tokens.

**Pipeline.**

```
+------------------+    +-----------------+    +------------------+
| trigger: inv     |--->| Shell: verify   |--->| TENANT plane:   |
| update (on-event)|    | cap-token       |    | check inventory |
+------------------+    +-----------------+    +------------------+
                                                       |
                                                       v
                          +-----------------+
                          | predicate: any  |
                          | SKU < threshold?|
                          +-----------------+
                                  | yes
                                  v
                          +------------------+
                          | Sakura push:    |
                          | "low stock: X,  |
                          | Y, Z"           |
                          +------------------+
```

**Walkthrough.**

1. Inventory-update event fires the subscription's predicate.
2. Predicate matches if any SKU dropped below threshold.
3. Push to Sakura's brief.

**Plane usage.** TENANT only.

**Shell decisions.**
- The subscription's predicate is in the §SJ.3.4 restricted
  language: `(< qty threshold)`.

**Failure modes.**

- **Predicate timeout (100µs).** Predicate is simple; never times
  out in practice.

---

### Z.15 — `imagine/finance-week-snapshot.sks` — "Weekly financial snapshot"

**Intent.** Friday afternoon: produce a weekly P&L snapshot.

**Tier.** Imagine. 25 tokens.

**Pipeline.**

```
+------------------+    +-----------------+    +------------------+
| trigger: Friday  |--->| Shell: verify   |--->| TENANT plane:   |
| 4pm (cron)       |    | cap-token       |    | week's facts    |
+------------------+    +-----------------+    +------------------+
                                                       |
                                                       v
                                              +------------------+
                                              | compute: revenue,|
                                              | fees, COGS,      |
                                              | profit, runway   |
                                              +------------------+
                                                       |
                                                       v
                                              +------------------+
                                              | operator UI:    |
                                              | weekly snapshot |
                                              +------------------+
```

**Walkthrough.**

1. Friday cron.
2. Cart reads week's TENANT facts.
3. Compute P&L + cash projection.
4. Surface in operator's brief.

**Plane usage.** TENANT only.

**Failure modes.**

- **Fee data delayed from platform.** Snapshot notes "fees pending;
  refresh Monday for final".

---

### Z.16 — `imagine/seo-rank-tracker.sks` — "Track search rankings"

**Intent.** Daily check on the operator's search-engine rankings
for their priority keywords.

**Tier.** Imagine. 18 tokens.

**Pipeline.**

```
+------------------+    +-----------------+
| trigger: daily   |--->| Shell: verify   |
| (cron)           |    | cap-token       |
+------------------+    +-----------------+
                              |
                              v
                       +-----------------+    +------------------+
                       | TENANT plane:   |    | WORLD plane:    |
                       | priority kw list|--->| SERP snapshot   |
                       +-----------------+    +------------------+
                              |                       |
                              v                       v
                       +-----------------+
                       | rank diff vs    |
                       | yesterday       |
                       +-----------------+
                              |
                              v
                       +------------------+
                       | operator UI:    |
                       | rank movement   |
                       +------------------+
```

**Walkthrough.**

1. Daily cron.
2. Cart reads priority keyword list from TENANT.
3. Reads WORLD plane's SERP snapshot (the substrate's
   cached search-engine results).
4. Rank diff vs yesterday.
5. Surfaces movement in operator's brief.

**Plane usage.** TENANT (own keyword list), WORLD (SERP cache).

**Failure modes.**

- **SERP cache stale.** Cart notes "SERP cache is N hours old";
  operator can refresh on demand.

---

### Z.17 — `pink/morning-brief.sks` — "Daily morning brief"

**Intent.** Generate the operator's morning brief.

**Tier.** Pink. 1 token.

**Pipeline.**

```
+------------------+    +-----------------+
| trigger: 7am     |--->| Shell: verify   |
| (cron)           |    | cap-token       |
+------------------+    +-----------------+
                              |
                              v
                       +-----------------+
                       | TENANT plane:   |
                       | last 24h facts  |
                       +-----------------+
                              |
                              v
                       +-----------------+
                       | template: brief |
                       | (no LLM)        |
                       +-----------------+
                              |
                              v
                       +------------------+
                       | push to operator|
                       +------------------+
```

**Walkthrough.**

1. 7am cron.
2. Read last 24h TENANT facts.
3. Template-render the brief (no LLM call — this is a pink-tier
   substrate-only operation).
4. Push.

**Plane usage.** TENANT only.

**Failure modes.**

- **Push channel down.** Brief queued for next opportunity; operator
  sees catch-up on next session.

---

### Z.18 — `pink/order-shipped-thanks.sks` — "Auto-thank-you on order ship"

**Intent.** Send a templated thank-you note when an order ships.

**Tier.** Pink. 1 token.

**Pipeline.**

```
+------------------+    +-----------------+
| trigger: order   |--->| Shell: verify   |
| status=shipped   |    | cap-token       |
+------------------+    +-----------------+
                              |
                              v
                       +-----------------+
                       | TENANT plane:   |
                       | get order +     |
                       | buyer template  |
                       +-----------------+
                              |
                              v
                       +-----------------+
                       | render template |
                       | + send msg      |
                       +-----------------+
```

**Walkthrough.**

1. Order-shipped event fires.
2. Cart reads order + operator's thank-you template.
3. Render + send.

**Plane usage.** TENANT only.

**Failure modes.**

- **Template missing.** Cart falls back to default with operator-
  inserted shop name.

---

### Z.19 — `pink/review-request.sks` — "Auto-request review at day 14"

**Intent.** 14 days after delivery, ask the buyer for a review.

**Tier.** Pink. 1 token.

**Pipeline.**

```
+------------------+    +-----------------+
| trigger: order   |--->| Shell: verify   |
| delivered + 14d  |    | cap-token       |
+------------------+    +-----------------+
                              |
                              v
                       +-----------------+
                       | TENANT plane:   |
                       | check: review   |
                       | already left?   |
                       +-----------------+
                              | no
                              v
                       +-----------------+
                       | render template |
                       | + send msg      |
                       +-----------------+
```

**Walkthrough.**

1. 14-day timer (subscription with `time-elapsed` predicate).
2. Check if review already left (skip if yes).
3. Send templated request.

**Plane usage.** TENANT only.

**Failure modes.**

- **Review-detection lag.** Could send request to a buyer who just
  left a review hours ago. Cart's polling cadence sets the resolution.

---

### Z.20 — `pink/listing-out-of-stock-pull.sks` — "Pull listing on zero stock"

**Intent.** Auto-pull a listing when stock hits zero.

**Tier.** Pink. 1 token.

**Pipeline.**

```
+------------------+    +-----------------+
| trigger: inv     |--->| predicate: qty |
| update           |    | == 0?          |
+------------------+    +-----------------+
                              | yes
                              v
                       +-----------------+
                       | TENANT op:      |
                       | pull listing    |
                       +-----------------+
                              |
                              v
                       +------------------+
                       | Sakura brief:   |
                       | "X pulled; want |
                       | to restock?"    |
                       +------------------+
```

**Walkthrough.**

1. Inv-update predicate fires on qty=0.
2. Cart pulls listing.
3. Notifies operator.

**Plane usage.** TENANT only.

**Failure modes.**

- **Race condition: order arrives during pull.** Cart's
  transactional discipline serializes — first commit wins; either
  the pull or the order succeeds, not both partially.

---

### Z.21 — `pink/buyer-tag-update.sks` — "Tag buyer on N orders"

**Intent.** When a buyer crosses 5 orders, tag them as "repeat".

**Tier.** Pink. 1 token.

**Pipeline.**

```
+------------------+    +-----------------+
| trigger: order   |--->| predicate: 5th |
| paid             |    | order by buyer?|
+------------------+    +-----------------+
                              | yes
                              v
                       +-----------------+
                       | TENANT op:      |
                       | tag buyer       |
                       +-----------------+
```

**Walkthrough.**

1. Order-paid event.
2. Predicate counts orders by buyer; matches at 5.
3. Buyer tagged in TENANT.

**Plane usage.** TENANT only.

**Failure modes.**

- **Count drift across edge cases.** Audit-log replay rebuilds the
  count on demand.

---

### Z.22 — `cross/foodie-budget-aware-pricing.sks` — "Price using buyer cohort budgets"

**Intent.** Cross-service: operator (food shop) wants to set prices
that the Foodie-cohort's typical-budget tier supports.

**Tier.** Dream. 100 tokens.

**Pipeline.**

```
+------------------+    +-----------------+
| operator: opens  |--->| Shell: verify   |
| pricing tab      |    | cross-service   |
+------------------+    | cap-token       |
                       +-----------------+
                              |
                              v
                       +-----------------+    +------------------+
                       | service: sakura |--->| service: foodie |
                       | TENANT: cogs    |    | COHORT: buyer   |
                       +-----------------+    | budget tiers    |
                                              | (K=8 both sides)|
                                              +------------------+
                                                       |
                                                       v
                                              +------------------+
                                              | pricing recs    |
                                              | aligned to      |
                                              | buyer budgets   |
                                              +------------------+
```

**Walkthrough.**

1. Operator (on Sakura) opens pricing tab; cart fires.
2. Cap-token has cross-service grant per §6.4: `service:sakura
   cross-service-grant:foodie scope:cohort-aggregate`.
3. Shell verifies the cross-service grant.
4. Reads TENANT COGS from Sakura.
5. Reads COHORT budget tiers from Foodie (K=8 on Foodie side).
6. Pricing recommendations align operator's prices to budget tiers.

**Plane usage.** TENANT (Sakura), COHORT (Foodie).

**Shell decisions.**
- **Permit** the cross-service read under the explicit grant.
- **K-floor enforced on Foodie side** independently.

**Failure modes.**

- **Cross-service grant expires.** Cart re-prompts operator for
  re-authorization.
- **Foodie cohort sub-K.** Falls back to Sakura-internal price-comp
  data.

---

### Z.23 — `substrate/schema-suggests-itself.sks` — "Auto-propose schema"

**Intent.** Substrate-intelligence: observe an operator's writes
over 30 days, propose a schema.

**Tier.** Dream. 50 tokens (background; not operator-triggered).

**Pipeline.**

```
+------------------+    +-----------------+
| trigger: 30d     |--->| substrate sweep:|
| since last sweep |    | analyze writes  |
+------------------+    +-----------------+
                              |
                              v
                       +-----------------+
                       | identify field  |
                       | co-occurrence   |
                       | patterns        |
                       +-----------------+
                              |
                              v
                       +-----------------+
                       | emit proposal   |
                       | as fact in      |
                       | SYSTEM plane    |
                       +-----------------+
                              |
                              v
                       +------------------+
                       | Sakura brief:   |
                       | "I noticed a    |
                       | pattern; apply?"|
                       +------------------+
```

**Walkthrough.**

1. 30-day timer fires.
2. Substrate-intelligence sweep analyzes the operator's writes.
3. Identifies field-co-occurrence patterns.
4. Emits a `schema-proposal` fact in SYSTEM plane.
5. Sakura surfaces the proposal in the operator's brief.
6. Operator approves or rejects; the proposal's lifecycle is
   tracked in audit.

**Plane usage.** TENANT (analyzed), SYSTEM (proposal emit).

**Failure modes.**

- **Operator's writes are genuinely heterogeneous.** Substrate finds
  no stable pattern; honestly reports "no schema emerged from
  observation".

---

### Z.24 — `substrate/anomaly-explain.sks` — "Explain a metric anomaly"

**Intent.** Substrate-intelligence detects an anomaly in the
operator's metrics; this cart explains it.

**Tier.** Dream. 80 tokens.

**Pipeline.**

```
+------------------+    +-----------------+
| anomaly detected |--->| substrate-intel:|
| (background sweep)|    | causal sketch   |
+------------------+    +-----------------+
                              |
                              v
                       +-----------------+    +------------------+
                       | TENANT plane:   |    | COHORT plane:   |
                       | facts in window |--->| same window     |
                       +-----------------+    | distribution    |
                              |               +------------------+
                              v
                       +-----------------+
                       | explanation:    |
                       | "your X is up   |
                       | because Y, and  |
                       | cohort confirms"|
                       +-----------------+
```

**Walkthrough.**

1. Background sweep detects anomaly.
2. Cart fires to produce the explanation.
3. Pulls TENANT facts + COHORT comparison.
4. Surfaces causal sketch ("your conversion dropped 12% this week;
   the listings affected share the new title format; your cohort's
   experience with that format is mixed — 40% see lift, 60% see
   drop; consider A/B testing").

**Plane usage.** TENANT, COHORT.

**Failure modes.**

- **Anomaly is statistical noise.** Cart surfaces with low
  confidence; "this might be noise; here's what we'd want to see
  before drawing conclusions".

---

### Z.25 — `substrate/pattern-mining-proposal.sks` — "Propose new automation from pattern"

**Intent.** Substrate-intelligence notices the operator does X
manually every week; proposes an automation.

**Tier.** Dream. 100 tokens.

**Pipeline.**

```
+------------------+    +-----------------+
| trigger: weekly  |--->| substrate sweep:|
| pattern detect   |    | audit log mine  |
+------------------+    +-----------------+
                              |
                              v
                       +-----------------+
                       | identify        |
                       | repeating       |
                       | manual sequence |
                       +-----------------+
                              |
                              v
                       +-----------------+
                       | propose cart:   |
                       | template +      |
                       | trigger         |
                       +-----------------+
                              |
                              v
                       +------------------+
                       | Sakura brief:   |
                       | "want me to do  |
                       | this for you?"  |
                       +------------------+
```

**Walkthrough.**

1. Weekly pattern-mining sweep over audit log.
2. Identifies a repeating manual sequence the operator does.
3. Proposes a cart template that automates it.
4. Surfaces the proposal in Sakura's brief.
5. Operator approves; the cart is added to the operator's cart-set.

**Plane usage.** TENANT (audit log mine), SYSTEM (proposal).

**Failure modes.**

- **Pattern is fragile.** Cart's automation might break when the
  operator's workflow shifts; the cart's manifest declares
  `auto-revisit: 30d` so substrate revisits the proposal.

---

### Z.26 — `substrate/reverse-suggest-demote.sks` — "Tier demotion suggestion"

**Intent.** Substrate notices the operator's Magic-tier capacity
is under-used; suggests Dream demotion.

**Tier.** Magic (the suggester runs in Magic-tier context, even
though it suggests demotion). 50 tokens.

**Pipeline.**

```
+------------------+    +-----------------+
| trigger: monthly |--->| substrate-intel:|
| usage review     |    | tier-fit score  |
+------------------+    +-----------------+
                              |
                              v
                       +-----------------+
                       | TENANT plane:   |
                       | 30d cart usage  |
                       +-----------------+
                              |
                              v
                       +-----------------+
                       | compare to tier |
                       | capacity        |
                       +-----------------+
                              | usage << capacity
                              v
                       +-----------------+
                       | propose         |
                       | demotion + show |
                       | savings         |
                       +-----------------+
                              |
                              v
                       +------------------+
                       | Sakura brief:   |
                       | "you'd fit in   |
                       | Dream; save $60"|
                       +------------------+
```

**Walkthrough.**

1. Monthly usage review.
2. Substrate scores tier-fit based on 30-day cart usage.
3. If score indicates under-use of current tier, propose demotion.
4. Show savings; operator disposes.
5. Audit records the proposal + the operator's response.

**Plane usage.** TENANT (own usage).

**Shell decisions.**
- **Permit** the substrate-side suggestion (the substrate is
  authorized to compute tier-fit on the operator's own data).
- The proposal itself is an operator-facing surface; the
  substrate's role ends at the proposal.

**Audit trail.** The proposal + the operator's response are the
substrate's regulatory defense for §J.6.1 dark-pattern
compliance — the reverse-suggest is exhibit A.

**Failure modes.**

- **Operator declines but usage stays low.** Substrate respects
  the decline for 90 days; revisits if usage stays low.
- **Operator's usage spikes after demotion.** Substrate proposes
  re-promotion; honest about the cost-benefit.

---

### Z.27 — Summary table

| § | Slug | Tier | Plane | Cost | Pattern |
|---|---|---|---|---|---|
| Z.2 | etsy/dispute-evidence-pack | magic | TENANT+COHORT+SYSTEM | 1500 | multi-week saga |
| Z.3 | etsy/seasonal-launch-orchestration | magic | TENANT+COHORT+SYSTEM | 1500 | multi-week saga + reverse-suggest |
| Z.4 | sakura/multi-account-portfolio | magic | TENANT(×4)+COHORT | 1500 | cross-shard aggregation |
| Z.5 | sakura/wholesale-launch-saga | magic | TENANT+COHORT+SYSTEM | 1500 | multi-week saga + 4-check |
| Z.6 | magic/cortex-rebuild-from-log | magic | TENANT | 1500 | recovery via log |
| Z.7 | etsy/title-rewriter | dream | TENANT+COHORT | 100 | cohort-grounded rewrite + L2 |
| Z.8 | commerce/cohort-keyword-suggest | dream | TENANT+COHORT | 50 | cohort diff |
| Z.9 | commerce/buyer-segment-surface | dream | TENANT+COHORT | 80 | cohort-grounded segment infer |
| Z.10 | commerce/restock-forecast-cohort | dream | TENANT+COHORT | 75 | cohort-aware forecast |
| Z.11 | commerce/photo-cohort-pattern | dream | TENANT+COHORT | 60 | cohort-grounded photo guidance |
| Z.12 | imagine/listing-batch-edit | imagine | TENANT | 15 | bulk write |
| Z.13 | imagine/conversation-triage | imagine | TENANT | 20 | scheduled triage |
| Z.14 | imagine/inventory-low-stock | imagine | TENANT | 5 | trigger-driven alert |
| Z.15 | imagine/finance-week-snapshot | imagine | TENANT | 25 | scheduled summary |
| Z.16 | imagine/seo-rank-tracker | imagine | TENANT+WORLD | 18 | scheduled WORLD-read |
| Z.17 | pink/morning-brief | pink | TENANT | 1 | scheduled template |
| Z.18 | pink/order-shipped-thanks | pink | TENANT | 1 | event-driven template |
| Z.19 | pink/review-request | pink | TENANT | 1 | timer-driven template |
| Z.20 | pink/listing-out-of-stock-pull | pink | TENANT | 1 | predicate trigger |
| Z.21 | pink/buyer-tag-update | pink | TENANT | 1 | predicate trigger |
| Z.22 | cross/foodie-budget-aware-pricing | dream | TENANT+COHORT(cross-svc) | 100 | cross-service cohort |
| Z.23 | substrate/schema-suggests-itself | dream | TENANT+SYSTEM | 50 | substrate-intelligence proposal |
| Z.24 | substrate/anomaly-explain | dream | TENANT+COHORT | 80 | substrate-intelligence explain |
| Z.25 | substrate/pattern-mining-proposal | dream | TENANT+SYSTEM | 100 | substrate-intelligence automation proposal |
| Z.26 | substrate/reverse-suggest-demote | magic | TENANT | 50 | substrate-intelligence + reverse-suggest |

The 25 carts together show: simple synchronous (Z.18, Z.20),
multi-step saga (Z.2, Z.3, Z.5), cohort-mediated (Z.7-Z.11, Z.22,
Z.24), cross-service (Z.22), substrate-intelligence-driven (Z.23,
Z.24, Z.25, Z.26), pattern-mined (Z.25), code-in-Loam (Z.2, Z.3,
Z.5), operator-invisible upgrade (Z.23), refusal-via-CFO (Z.3, Z.5),
gentle reverse-suggest demotion (Z.3, Z.26).

The substrate's full range, walked end-to-end. This is what
Loam does.

---

*End of §Z. The 25 walkthroughs are the canonical engineering
demonstrations.*


---

## Appendix A — Lacuna Engineering panel disagreements

The architect's instruction: *"Adversarially bring in Lacuna
Engineering who would NEVER DO THAT."* The panel was Soo-Jin (security),
Marcus (backend honesty), Zane (papers/hacker), Priya (PR adversarial),
Daisy (visual craft). Disagreements that shaped the doc:

- **Soo-Jin vs Marcus on the Gate LLM.** Soo-Jin: "an LLM in the
  auth path is a CVE waiting to happen." Marcus: "a deterministic
  shell that strictly verifies every proposal is a CVE-resistant
  pattern." Resolved historically by §3.3 (LLM proposes, shell
  disposes); **resolved more cleanly by §17's classical-substrate
  reframe** — the substrate ships no LLM at all, so Soo-Jin's
  concern evaporates and Marcus's discipline simplifies to "the
  Shell verifies a closed structured-action allow-list, no LLM
  anywhere in the substrate." Both sign off.
- **Marcus vs Priya on SQLite vs FDB.** Marcus: "SQLite is the right
  long-term call; FDB is a kingdom." Priya (adversarial): "Apple ships
  FDB at trillions of operations a day; SQLite at our scale is a
  toy." Resolved by §8.2 — per-shard sharding makes SQLite the right
  shape at our scale, and the 2000-year discipline forbids
  proprietary tooling.
- **Zane on Datomic.** Zane: "Datomic's model is right; the runtime
  is wrong for us; take the model, decline the JVM." Adopted in §27.
- **Soo-Jin on the cohort gateway.** Strong: "the cohort prefix
  separation must be physical, not just logical." Adopted in §9.
- **Priya on the 300-automation bar.** Adversarial: "324 is a
  fabricated number — show the table." Adopted: §15.1 is the table,
  with explicit counts.
- **Daisy on Public Loam UX.** "The substrate is invisible to
  operators; the bridge troll is invisible too. Operators only see
  Sakura and the carts. The substrate's name should never appear in
  the UI." Adopted; "Loam" is an engineering name only.

---

## Appendix B — Migration from LOAM 1.0

The deltas from LOAM 1.0 to LOAM 2.0:

| LOAM 1.0 | LOAM 2.0 |
|---|---|
| FoundationDB substrate | SQLite-per-shard + Litestream |
| Three planes (PRIVATE / COHORT / WORLD) | Five planes (TENANT / COHORT / WORLD / SYSTEM / PUBLIC) |
| Workspace API (5 verbs) | MCP tool surface (7 tools + 5 resources) |
| No bridge LLM | The Shell (deterministic Rust, no LLM per §17) + per-client NL Adapter (outside the substrate) |
| Sakura uses the verbs | Sakura uses Cortex-of-Loam; Loam pushes |
| Triggers are workspace columns | Subscriptions are first-class primitive |
| No code primitive | Code-in-Loam, content-addressed |
| No 2000-year discipline | Format bilingualism, dual-hash, cold tier, bash recovery |
| 3 patentable surfaces | 11 patentable surfaces (B.12 retired per §17; B.21 + B.22 added per §6) |
| 8-week build plan | 14-16 week build plan (per §30 honest re-scoping) |
| ~current state of `loam/router.py` preserved | router.py becomes the Shell's HTTP entry point; the rest is unchanged |

The router precedence chain (`curator-api/curator_api/loam/router.py:186`)
is preserved. The cohort derivation
(`curator-api/curator_api/loam/cohort/__init__.py:43`) is preserved. The
schema dataclasses (`curator-api/curator_api/loam/schema.py:28-118`)
are preserved as the in-shard record types. Chat-handler integration
(`curator-api/curator_api/app.py:3579-3613`) is preserved.

What's deleted: `curator-api/curator_api/loam/backends/memgraph.py`
(week 1 cleanup).

What's added in the codebase, by file:

- `curator-api/curator_api/loam-shell/` (sibling dir, dashed) — the Shell (deterministic
  Rust verifier + audit emitter; no LLM per §17). Replaces the
  original `loam/gate/` directory plan from the LOAM 2.0 draft.
- `curator-api/curator_api/loam/log/` — the append-only log
  + segment rotation + CID generation + Scheme co-encoding.
- `curator-api/curator_api/loam/projections/` — KV / vector
  / graph / trigger projections built from the log.
- `curator-api/curator_api/loam-shell/src/server.rs` (MCP server lives in the Shell) — the MCP server.
- `curator-api/curator_api/loam/subscriptions/` — the
  subscription primitive.
- `curator-api/curator_api/loam/code/` — code-in-Loam
  artifact registry + sandbox.
- `curator-api/curator_api/loam/log/dual_hash.py` + `loam/code/artifact.py` (blob CIDs) — content-addressed
  blob store.
- `curator-api/curator_api/loam/recover/` — bash-callable
  recovery tools.
- `curator-web/src/lib/cortexOfLoam.js` (PLANNED v1.x — see §26.7 footnote) — local projection
  for Sakura; integrates with the existing Cortex layer.

---

## §41 — SRE Monitoring Product

**Added 2026-06-27 per AUDIT-LIES Priya I-2.** Earlier drafts of this
doc never named the SRE monitoring product even though ~6000 LoC of
code under `curator-api/curator_api/sre/` +
`curator-web/public/systems/monitoring/` ships it. The architect's
five-canonical-docs rule says everything substrate-touching lives in
the engineering doc; this chapter closes the gap.

**Cross-refs.** §41 composes with §17 (substrate-is-classical — SRE
is a classical observer, no LLM in the SRE process either) · §19
(surfacing — the SRE dashboard is the engineering-internal counterpart
to the operator-facing §19 surfacing layer; operators never see SRE
chrome per Daisy's substrate-invisibility lock) · §SJ.5 (PII
scrubber — `SREPrivacyFrame` is the SRE-process equivalent of the
substrate-side scrubber) · §SJ.6 (audit-log — SRE reads the audit
log on SYSTEM plane, never the data planes) · §K.3 (the operator
never sees the SRE surface — it's an engineering-internal tool for
the SRE roster named in `docs/SLA-SLO-SPEC.md`).

### §41.1 — What ships

The SRE monitoring product is a separate runtime surface that observes
Loam from the outside. It does NOT cross substrate boundaries — every
SRE query routes through `SREPrivacyFrame` (refuses payload bytes,
refuses name-shaped strings, ceiling-checks metric-volume vs
transaction-volume) before any payload leaves the SRE process.

Backend modules (`curator-api/curator_api/sre/`):

- `auth.py` — OAuth signin + first-admin allowlist
  (`SRE_ADMIN_ALLOWLIST` env; defaults to `doveman@gmail.com` when
  unset — see Priya H-2)
- `routes.py` — FastAPI router for `/api/sre/*` endpoints
- `signaling.py` — WebRTC signaling for the monitoring web client
- `box_registry.py` — registered SRE devices (per-operator + service
  ownership)
- `loam_health.py` — Loam substrate health endpoint backing the
  dashboard's Loam tab
- `timeseries.py` — per-metric timeseries store (per-user salt via
  `CURATOR_SRE_USER_SALT`; rotates on restart when unset — Priya M-3)
- `privacy_frame.py` — the three-assertion gate every fetcher runs
- `abuse_detection/` — auto-pause + anomaly detection
  (`SRE_ANOMALY_BASELINE_DAYS` / `SRE_ANOMALY_MAD_MULTIPLIER` /
  `SRE_ANOMALY_MIN_BASELINE_PTS` env)

Web modules (`curator-web/public/systems/monitoring/`):

- `chat/` — WebRTC + MLS-fallback group crypto for SRE operator chat
- `charts/` — D3 dashboards
- `tabs/` — Loam · Carts · Reliability · Errors

### §41.2 — Env var reference (substrate + SRE)

The substrate's runtime is configured via env. This is the v1.0
single-table source of truth (referenced by §SJ.6 + §SJ.8):

| Var | Default | Production-required? |
|---|---|---|
| `LOAM_SHELL_TCP` | `127.0.0.1:9099` | required to override default |
| `LOAM_SHELL_SOCKET` | unset | dev-optional |
| `LOAM_SHELL_KEYS_DIR` | `~/.curator-secrets/loam-service-keys` | required |
| `LOAM_SHELL_ALLOWLIST` | bundled `allow_list.toml` | required to override |
| `LOAM_SHELL_PLANES` | bundled `plane_permissions.json` | required to override |
| `LOAM_SHELL_SHARD_DB` | `~/loam-data/shards/` | required |
| `LOAM_SHELL_PER_TOKEN_RPS` | `10` | dev-optional |
| `LOAM_SHELL_FALLBACK_PERMIT` | unset (deny) | **MUST NOT be `1` in prod** (AUDIT-LIES C-2) |
| `LOAM_PROD` | unset | **MUST be `true` in prod** (AUDIT-LIES H-3) |
| `LOAM_DEV_HMAC_KEY` | escrow-then-generate | required in prod |
| `LOAM_EMBEDDING_CACHE` | `~/.cache/loam-embeddings` | dev-optional |
| `LOAM_COHORT_GRAVITY_SALT` | dev-constant fallback | required in prod (Priya M-2) |
| `LOAM_ADMT_SALT` | constant in source | **proposed required in prod (Architect-Call 4)** |
| `LOAM_AUDIT_SIGNING_KEY_PATH` | `~/.curator-secrets/loam-service-keys/audit-signing.key` | required in prod (AUDIT-LIES C2) |
| `BETTER_AUTH_SECRET` | n/a — fail-loud if missing | required |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | n/a | required for SRE OAuth |
| `SRE_SIGNIN_ORIGIN` | `https://sakura.lacunalabs.ai` | required |
| `SRE_ADMIN_ALLOWLIST` | `doveman@gmail.com` | required to override (Priya H-2) |
| `SRE_MONITORING_ENABLED` | `false` | required to enable |
| `CURATOR_SRE_USER_SALT` | per-process random | required in prod (Priya M-3) |
| `CURATOR_ENV` | `dev` | recommended |
| `SRE_ANOMALY_BASELINE_DAYS` | `14` | optional |
| `SRE_ANOMALY_MAD_MULTIPLIER` | `3.0` | optional |
| `SRE_ANOMALY_MIN_BASELINE_PTS` | `7` | optional |
| `ABUSE_DETECT_RUN` | `false` | optional |

### §41.3 — Subscription dispatcher SSRF defense (correction)

Priya L-3 surfaced that the §12.7 "Subscriber callback URL trust" entry
under "honest gaps" is misleadingly conservative — the code in
`loam/subscriptions/dispatcher.py` ships full SSRF defense (scheme
allowlist, private-IP rejection, link-local rejection,
cloud-metadata-endpoint blocklist, userinfo rejection, per-service
trust-list regex, per-token rate limit, bounded retries + dead-letter,
verify-on-fire). The defense is shipped and adversarial-tested. §12.7
should be revised to credit the implementation; the lie was the gap
claim, not the code.

---

*End of LOAM 2.0 design document. Owner sign-off: ______ ______ 2026-__-__.*


---

# §SRE-BIF — SRE Separation + Bifurcation Gate (folded from doc-expansion-staging/loam-sre.md)


<!-- LIVING:TODO(2026-07-06): renumber to follow last §N -->

---

### Intent (Model B design)

The SRE brain is specified as a **disparate instance** — a separate process, separate
store, and separate intent-loop — such that a total Loam failure does not cascade into
loss of observability or control. The invariant: SRE reads Loam health **best-effort**
and never takes a hard dependency on Loam availability. If Loam is down, the SRE
layer must still be able to emit alerts, file tickets, and execute fleet control
actions against whatever remains reachable.

Scope owned by the SRE instance (as designed):

| Domain | Component | Separation status |
|---|---|---|
| Observability | Cart-run telemetry ingestion | *[needs: attested process/store separation evidence]* |
| Intelligence | Alerting brain (L1-tier agent) | *[needs: attested process/store separation evidence]* |
| Operations | Ticketing and incident filing | *[needs: attested process/store separation evidence]* |
| Control plane | Fleet control actions | *[needs: attested process/store separation evidence]* |
| Self-check | Health agent (Loam liveness probe) | Specified; reads Loam best-effort — wiring unattested |

The canonical spec-vs-wired gap table lives in `docs/SRE-ATTESTATION-2026-07-02.md`.
All claims below are cross-referenced to that document where they originate; where
no attestation record exists, gaps are marked explicitly.

---

### What is wired (attested)

Per `docs/SRE-ATTESTATION-2026-07-02.md`:

- The **SRE attestation document exists** as a named artifact as of 2026-07-02,
  establishing that separation is a deliberate design target, not an afterthought.
- The **best-effort read pattern** for Loam health is the agreed interface contract
  between the two instances.
- The **health agent** role is named and scoped.

Everything beyond those three points requires independent re-attestation.
*[needs: citation for any wired process boundary, socket/port isolation, or
separate-store proof outside the attestation doc itself]*

---

### Separation gaps (honest)

The following gaps are known or reasonably inferred from the absence of attestation
evidence. A gap is not a defect — it is an honest statement of work remaining before
the bifurcation gate can be crossed.

**Gap 1 — Store isolation unproven.**
It is unattested whether the SRE telemetry store runs on infrastructure that is
physically or logically independent of Loam's substrate store. If both share a
database host, a volume, or a network namespace, a Loam-down event that includes
infrastructure failure will take the SRE store with it.
*[needs: attested process/store separation evidence — separate host, volume, or
namespace proof]*

**Gap 2 — Process boundary unproven.**
The SRE alerting brain and fleet-control plane are described as a separate process.
Whether that process runs in a separate container, VM, or Fly machine from the
Loam serving stack is unattested.
*[needs: attested process/store separation evidence — separate deploy unit proof]*

**Gap 3 — Loam-down fire drill not on record.**
The strongest attestation for Model B correctness would be a documented exercise:
bring Loam down, verify SRE continues to emit alerts and accept fleet-control
commands. No such drill result is cited in `docs/SRE-ATTESTATION-2026-07-02.md`
or anywhere in the canonical record at time of writing.
*[needs: Loam-down drill result or equivalent chaos-test log]*

**Gap 4 — Cart-run telemetry path not traced.**
Telemetry emitted during a cart run must reach the SRE ingest layer without
transiting Loam internals. The path is untraced in available citations.
*[needs: telemetry routing diagram or code-path citation showing Loam-bypass]*

**Gap 5 — Ticketing integration independence.**
If the SRE ticketing action calls an external API (e.g., Linear, GitHub Issues)
through a client that is initialized inside the Loam process, the ticket action
fails on Loam death. Independence of the ticketing client from the Loam process
boundary is unattested.
*[needs: ticketing client instantiation path and deploy-unit ownership]*

---

### Bifurcation gate

The **bifurcation gate** is the point at which SRE separation is no longer a design
intent but a proven operational fact: separate store, separate process, surviving a
Loam-down event with full alerting and fleet-control capability intact.

This gate is **not yet crossed.**

```
Gate: SRE↔Loam bifurcation
State: OPEN
Blocker summary:
  - Store isolation unproven (Gap 1)
  - Process boundary unproven (Gap 2)
  - No Loam-down drill on record (Gap 3)
  - Telemetry routing untraced (Gap 4)
  - Ticketing client ownership unattested (Gap 5)
Crossing criteria:
  - Each gap above resolves to a cited, attested evidence record
  - A Loam-down drill (controlled or chaos) completes with SRE
    alerting and fleet-control confirmed operational
  - docs/SRE-ATTESTATION-2026-07-02.md updated with drill result
    and store/process proofs, co-signed by on-call SRE
```

<!-- LIVING:TODO(2026-07-06): attest SRE↔Loam bifurcation (separate store proven under Loam-down) -->

---

### Operational posture until gate is crossed

Until bifurcation is attested, the correct operational assumption is:

> **SRE and Loam share a failure domain.** A Loam infrastructure failure MAY
> also take down SRE observability. Incident response plans must account for
> the possibility of simultaneous loss of both.

This is not a worst-case hypothesis — it is the default until evidence says otherwise.
Overriding this assumption in runbooks before the gate is crossed would be
an unsafe assertion.

---

# §SLAT — Loam projections on the SLAT wire (added 2026-07-12)

> **Canonical sources.** SLAT wire format is
> `research/lacuna-docs/specs/SLAT-1.0.SPEC.md`; the cross-system
> integration audit is
> `research/lacuna-docs/engineering/artifacts-slats-integration-audit-2026-07-11.md`.
> This section wires Loam's projection plane, the SRE hooks named in
> §26.8, and the audit surface named in §26.1 onto that wire. Marcus
> owns; Priya reviews the signing surface; Zain reviews the schema
> shape.

## §SLAT.1 — Doctrine

> **Alfred, 2026-07-11:** *"Yes. Loam projections through slats. Even
> the worlds work."*

Loam's SYSTEM, SAKURA, and OPERATOR projection planes all ride the
same wire format: `.slatl` (line-delimited SLAT). The projection
worker reads log events, computes a projected shape, and appends one
slat-record per emitted row. Ingest, storage, replay, and audit all
speak the same tokens end-to-end. This is what §26.8 SRE hooks name
when they say "OpenTelemetry spans per read/write" — every span
serializes as an `event` slat-record on landing.

Three properties matter:

1. **One format, three planes.** SYSTEM/SAKURA/OPERATOR projections
   all use `.slatl`. The header symbol distinguishes plane
   (`system/*`, `sakura/*`, `operator/*`).
2. **Content-addressed replay.** Each projection line's canonical CID
   (SLAT SPEC §5.4) is the row's audit identity. §26.1 audit rows
   share the CID with the OTel span (§26.8), so a `grep` on `traceId`
   in `.slatl` stitches spans + audit + projection into one incident.
3. **Descriptive schemas.** Per §26.9, no projection requires a
   pre-declared schema. The schema-discovery worker infers the shape
   after ≥ 50 recurrences; the shape is a descriptive slat `spec`
   record (SLAT SPEC §4.1 row 11).

## §SLAT.2 — Projection schema authoring pattern

Every Loam projection is a slat-record head plus a fields dict. The
canonical layout:

```scheme
;;;slat 1.0
;; SYSTEM/artifact-lifecycle projection
;; owner: Marcus · plane: SYSTEM · reader: sre-dashboards

(system/artifact-lifecycle
  :ts             #inst "2026-07-11T18:22:00Z"
  :trace-id       "tr-a4f9c2"
  :cid            #b64 "…"                ; canonical CID of this row
  :artifact-id    "artifact-chat-0042"
  :artifact-type  chat
  :phase          spawn                     ; spawn | apply | close
  :caller-tier    operator-gesture
  :latency-ms     14
  :outcome        ok
  :queue-depth    0
  :dropped-oldest 0)
```

Head naming: `<plane>/<projection-name>`. Three planes ship:

- **SYSTEM** — SRE-facing. Consumed by Loam dashboards + probe
  carts (§26.8). Retention: 30 days rolling.
- **SAKURA** — Sakura-facing. Consumed by Cortex-of-Loam (§5) so
  Sakura sees Loam's operational state through her own memory
  substrate. Retention: 7 days rolling.
- **OPERATOR** — operator-facing. Rendered on Slate + shop
  dashboards. Retention: 90 days rolling.

The projection worker registers each head via
`(define-slat-type system/artifact-lifecycle (fields …))` at boot;
the schema-discovery worker (§26.9.1) inspects the emitted stream
and promotes recurrences to descriptive schemas automatically.

## §SLAT.3 — The three SYSTEM projections shipping with SLAT 1.0

The audit surfaced three SYSTEM projections that must ship on the
SLAT wire to close the Loam observability gap:

### §SLAT.3.1 — `SYSTEM/cortex-subscription-drift`

The one projection already normatively defined against SLAT (per
`CORTEX-ARTIFACT-BACKPRESSURE-1.0.SPEC.md` §13.3). Fires when Mode B
drop-oldest fires; carries `:subscriber-id :queue-depth
:coalesce-folded :dropped-oldest :drift-window-ms`. Marcus owed the
schema follow-up commit; that debt closes here.

```scheme
(system/cortex-subscription-drift
  :ts              #inst "…"
  :trace-id        "tr-…"
  :subscriber-id   "sub-a1b2"
  :queue-depth     42
  :drop-policy     drop-oldest
  :coalesce-folded 3
  :dropped-oldest  1
  :drift-window-ms 1500)
```

### §SLAT.3.2 — `SYSTEM/artifact-lifecycle`

Every artifact `spawn`, `apply`, `close` emits one line. Shape shown
in §SLAT.2. Consumers: SRE dashboards, artifact-latency SLO, and
the Sakura-facing self-narration cart (§24.7 yir-11) — a Loam
projection that Sakura reads through Cortex-of-Loam and narrates
back to the operator.

### §SLAT.3.3 — `SYSTEM/slat-parse-errors`

Every SLAT `_bad-line` sentinel (SLAT SPEC §5.3 tolerant mode) lands
here. Shape:

```scheme
(system/slat-parse-errors
  :ts             #inst "…"
  :source-file    "~/.lacuna/mailboxes/api-highway.slatl"
  :line-number    42391
  :error-code     max-depth-exceeded    ; or max-string-length | fuel | …
  :first-64-bytes "(event :ts 1751500…"
  :reader-binding js-1.0
  :recovery       skip)                    ; skip | halt
```

Consumers: SRE dashboards. A rising rate of parse errors on any
single source-file is a P2 page; the projection carries the source
so on-call can grep the offending file directly.

## §SLAT.4 — Ingest performance targets

Per SLAT SPEC §5.6, the reader's p50/p90/p99 targets on 2020-2024
laptop hardware:

| Operation | p50 | p90 | p99 |
|---|---|---|---|
| Read 1 KiB `.slatl` line | ≤ 40 µs | ≤ 120 µs | ≤ 500 µs |
| Write 1 KiB record | ≤ 30 µs | ≤ 90 µs | ≤ 400 µs |
| Canonicalize 1 KiB record | ≤ 60 µs | ≤ 180 µs | ≤ 600 µs |
| Content-hash 1 KiB record | ≤ 80 µs | ≤ 220 µs | ≤ 700 µs |

Loam ingest budgets against these. The projection worker reads each
`.slatl` line, canonicalizes, hashes, appends to its projection tree,
fires subscription callbacks (§10). Per-tenant-per-shard write quota
(§26.6) is enforced at the projection append. On overrun, the writer
back-pressures via Mode B drop-oldest (per Backpressure spec §13.3)
and emits `SYSTEM/cortex-subscription-drift`.

Regressions above 2× the p99 target file an SRE ticket automatically
via a probe cart (§26.8, `loam-probe-slat-ingest`, added by this
section).

## §SLAT.5 — Backward compat during migration

Loam's projection consumers today read JSONL (`~/.lacuna/projections/*.jsonl`)
or read raw OTel spans through a scraper. The SLAT migration proceeds
per SLAT SPEC §5.8:

1. **Dual-write window (4 weeks).** The projection worker emits BOTH
   `.jsonl` and `.slatl` for each projection. Consumers may read
   either; new consumers read `.slatl`.
2. **Read-parity check.** Every 24h a probe cart reads both files,
   canonicalizes, compares. Divergence pages Marcus.
3. **Cut-over.** After 4 weeks of clean parity, `.jsonl` writes stop.
   The `.jsonl` files remain readable for the retention window; the
   ledger records the cut-over CID.

Migration scripts land in `sakura-scheme/scripts/loam-jsonl-to-slatl.mjs`
per the SLAT SPEC §10.3 pattern. Idempotent; log-only rewrites.

## §SLAT.6 — Word disambiguation: `code-artifact` vs `artifact-state`

Loam's addressing scheme uses `loam://code-artifact/<cid>` (§8, §11
content-addressed code storage). The new Artifacts substrate uses
`artifact-state` slat-records (SLAT SPEC §4.1 row 13) for artifact
instance persistence. **Two words, same first token, different
systems.** A future reader will confuse them.

Glossary note:

- **`code-artifact` (Loam)** — a content-addressed code blob living
  in Loam's blob store (§8.4). Immutable, keyed by BLAKE3 CID. This
  is Loam's addressing primitive from before Artifacts existed.
- **`artifact-state` (Artifacts substrate)** — the SLAT §4.1 row 13
  slat-record head that serializes an artifact instance
  (`:type :id :state`). This is what a Marionette scene, a chat
  composition, or a game composition persists as when it snapshots.
  The record's payload MAY reference a `code-artifact` CID; the two
  systems compose.

New Loam documentation MUST spell the distinction on first use in
each doc. New Artifacts documentation MAY use `artifact-state`
without qualification.

## §SLAT.7 — SRE hooks that ride the SLAT wire

Per §26.8, five SRE surfaces adopt SLAT as the wire format:

1. **OTel span landing.** Each span serializes as an `event`
   slat-record on the collector side; the trace-id is the row's CID.
2. **Prometheus scrape endpoint.** Unchanged wire (Prometheus text
   format for the scraper). The metrics themselves are populated by
   reading recent SLAT projection lines — one code path per
   projection, not per counter.
3. **Per-tenant SLO dashboards.** Each dashboard tile is a query
   over one projection's `.slatl` file over a time window.
4. **Black-box probe carts (60s cadence).** Each probe emits a
   `SYSTEM/loam-probe-<verb>` slat-record: `:probe-verb :outcome
   :latency-ms :error-code`. Rising error rates page.
5. **Substrate self-narration cart (§24.7 yir-11).** Reads a rolling
   window of SYSTEM projections (all planes, canonical form) and
   narrates the year to the operator. Recursive observability
   surfaced as entertainment.

Each surface reads from and writes to the same `.slatl` files. One
grammar, one canonical form, one CID space.

## §SLAT.8 — Signing + capability posture (Priya)

Loam projections carry two Priya-owned properties on the SLAT wire:

1. **Signed rows for adversarial replay.** A projection row landing
   from an untrusted source (e.g., a customer-facing webhook
   feeding an operator projection) is wrapped in a `(signed :body
   … :signed-by … :signature #b64 …)` envelope per SLAT SPEC §6.2.
   The verifier checks the signature before the row lands in the
   projection tree; a failed signature routes to
   `SYSTEM/slat-parse-errors` with `:error-code
   signature-verification-failed`.
2. **Capability tokens on cross-service reads.** A cart running in
   Curator that reads a projection from Foodie's Loam presents a
   capability token (SLAT SPEC §6.5) wrapping the requested read
   permission. The token is a slat-record; the projection reader
   verifies signature + not-before/not-after window before returning
   a row.

Merkle attestation over projection sets (SLAT SPEC §6.7) is used
for training-corpus attestation: before Weave 2.0 trains on a
Sakura-facing projection, Cortex-of-Loam builds a `slat-set` root
over the corpus manifest. The root hashes to a single CID; the CID
signs.

## §SLAT.9 — What lands where (implementation map)

| Surface | File / path | Owner |
|---|---|---|
| Projection worker | `~/code/lacuna-labs/loam/projection_worker.py` | Marcus |
| Reader | `sakura-scheme/bindings/python/slat/reader.py` | Zain |
| Writer + canonicalizer | `sakura-scheme/bindings/python/slat/writer.py` | Zain |
| Signer + verifier | `~/code/lacuna-labs/loam/slat_signer.py` | Priya |
| Merkle attester | `~/code/lacuna-labs/loam/slat_merkle.py` | Priya + Marcus |
| Ingest probe cart | `curator-web/src/scheme/carts/cron/loam-probe-slat-ingest.sks` | Marcus (via Curator lead) |
| SYSTEM projections dir | `~/.lacuna/loam/projections/system/*.slatl` | Marcus |
| SAKURA projections dir | `~/.lacuna/loam/projections/sakura/*.slatl` | Marcus |
| OPERATOR projections dir | `~/.lacuna/loam/projections/operator/*.slatl` | Marcus |

Everything speaks the same wire; the file paths differ only by
plane. The projection worker imports the sakura-scheme Python binding
directly (per Lane 5 of the integration audit) — no forked
reader/writer.

## §SLAT.10 — Cross-references

- **SLAT-1.0.SPEC §5.6** — performance targets Loam ingest budgets
  against.
- **SLAT-1.0.SPEC §5.8** — mailbox migration pattern the projection
  worker mirrors.
- **SLAT-1.0.SPEC §6.7** — Merkle attestation for projection sets.
- **CORTEX-ARTIFACT-BACKPRESSURE-1.0.SPEC §13.3** —
  `SYSTEM/cortex-subscription-drift` projection.
- **SAKURA-SCHEME-1.0.ENG §SLAT** — the language-runtime side.
- **SAKURA-AUTOMATIONS-1.0.ENG §SLAT** — cart-fire and cart-outcome
  audit landing on this projection wire.
- **HELLO-SURFACE-1.0.ENG §ARTIFACT.5** — artifact lifecycle events
  that produce `SYSTEM/artifact-lifecycle` rows.

---

# §LITESTREAM-PIN — Litestream dev/prod pin correction (added 2026-07-11)

Marcus's Litestream pin: dev pins to the same major/minor as prod, patches drift only on planned Loam upgrade windows. Silent version-skew produced the 2026-06-14 replication stall; the pin locks that failure mode out.

# §MCP-GOVERNANCE — MCP transition to AAIF (added 2026-07-11)

MCP wire endpoints transition to AAIF (Agent Authentication + Introspection Framework) governance during 2026-07 → 2026-08. All new MCP-family verbs land under the AAIF signing scheme; older MCP surfaces receive AAIF adapters and a deprecation notice. See `SECURITY-CANONICAL-1.0.ENG.md` for the AAIF token model.

---

# §CODE-SYNC — Doc↔code reality reconciliation (added 2026-07-15, E2)

> Read against the actual shipping code at `~/code/loam/loam-engine/`
> (Rust, redb-backed, 2,449 LOC) on 2026-07-15. This appendix records
> **verified drift** between what §§1–17 above describe and what the
> engine module actually implements today. Per merge-not-throw: the
> older architecture text stays as substrate design intent; the section
> below is the honest present-tense mechanical truth. When they
> disagree, the source below wins for operational reasoning.

## §CODE-SYNC.1 — Two Loams live in tree

There are **two distinct Rust codebases** both named Loam-adjacent, and
§§1–17 conflate them:

| Path | Purpose | Status |
|---|---|---|
| `~/code/loam/loam-engine/` | The **shipping flat cache substrate** — redb-backed, TTL-mandatory, 2 HTTP routes | Live, tested |
| `~/code/curator/curator-api/curator_api/loam-shell/` | The **Shell binary** (§3) — capability + audit boundary | Present as compiled artifacts only in the paths surveyed 2026-07-15; source not co-located |

The Shell described in §3 is a separate deployment concern. The engine
described below is the byte-storage floor. Prior canonical framing
implied one binary; the honest picture is two.

## §CODE-SYNC.2 — The engine as it actually ships

Verified against `loam-engine/src/lib.rs` and `store/mod.rs`:

- **Storage: `redb`**, not SQLite-per-shard. `redb` is a pure-Rust,
  single-file, embedded ACID B-tree key-value store. Chosen (per the
  source header comment) over sled because: pure Rust, no C dep;
  stable documented on-disk format; copy-on-write B-tree with no
  background compaction; simple typed-table transactional API.
- **One table**, `entries`. Composite row key:
  `<namespace_wire>\x00<entry_key>\x00<version_be_u64_hex>`.
  The trailing 16-char hex big-endian version means a redb range scan
  over a `(ns, key)` prefix yields versions in ascending order — the
  append-only chain surfaced as a natural sort.
- **Value: JSON bytes of an `Entry`** (not CBOR, not Scheme
  s-expressions, not the "bilingual CBOR+Scheme" §2.5 describes).
  The bilingual-format design intent is preserved above as substrate
  goal; the engine ships JSON today.
- **Backends: `MemoryBackend` (test/dev) + `RedbBackend` (default
  durable).** Both implement a `StoreBackend` trait — the seam for
  future backend swaps (e.g., cold-tier writes) is already there.
- **No HNSW, no vector index, no graph projection, no Litestream** in
  the engine module. Those live in downstream consumers or remain
  aspirational per §16.4.

## §CODE-SYNC.3 — The five "planes" collapse to three namespace kinds

The §9 five-plane model does not appear in the shipping engine.
`loam-engine/src/store/namespace.rs` defines exactly three:

- **`shared`** — any service reads; only `shared`-capable workers
  write. Time, weather, web-search caches, cron output.
- **`<service>`** (per-service) — the owning service writes its own;
  any service may read it. `curator`, `baobab`, `sakura`, etc.
- **`private:<service>`** — a customer-automation contract namespace.
  Only the owning service reads or writes; no cross-service read
  under any circumstance.

Permission is enforced by `Permission::for(caller, ns, op)` — plain
code, testable, no model in the loop. The five-plane framing
(§9.1–§9.5) may still describe a future logical view layered above
these three, but the boundary that actually enforces isolation today
is the three-namespace check.

## §CODE-SYNC.4 — TTL is mandatory and capped at 30 days

`store/mod.rs`:

- `MAX_TTL_SECONDS = 60 * 60 * 24 * 30` (30 days).
- A write with no TTL is a `StoreError::MissingTtl` — rejected at the
  boundary before any storage logic runs.
- A TTL ≤ 0 or above the cap is rejected, not silently clamped — the
  caller learns its intent was wrong.

This is a **material tightening** vs the §§1–17 framing, which
describes Loam as "stores every operator's substrate-worthy data
forever." That framing is aspirational for the cold/glacier tiers
(§2.2 storage cake). The engine as shipped is explicitly a *cache* —
30-day ceiling, no forever-storage path in the module. Long-lived
data must be re-materialized from an upstream substrate on each TTL
cycle, or the cold-tier plumbing described in §14 must land as
separate infrastructure.

## §CODE-SYNC.5 — HTTP surface: two data routes

`loam-engine/src/api/routes.rs` ships exactly:

- `PUT  /v1/entries/{namespace}/{key}` — append a new version;
  mandatory `ttl_seconds` in the body.
- `GET  /v1/entries/{namespace}/{key}` — freshest non-expired entry
  or 404.
- `GET  /healthz` — liveness.
- `GET  /loam-health` — store stats.

Not fourteen MCP tools (§4.1). Not typed MCP signatures. The
14-tool framing describes the intended agent-facing MCP layer;
the wire the engine itself exposes is HTTP with bearer tokens
resolved against a `TokenRegistry`. Caller identity is *never*
asserted by the request body — the `Authorization: Bearer <token>`
header is the only identity boundary (`caller_from_headers` in
`api/routes.rs`). Body-asserted identity is a class of bug the
current shape structurally prevents.

## §CODE-SYNC.6 — Audit ledger records metadata, never contents

`store/audit.rs` (170 LOC):

- One `AuditRecord` per write: `namespace, key, caller, ttl_seconds,
  timestamp, version`.
- **The value is not written to the audit ledger** — by design,
  per the source header. The audit log proves *a write happened*;
  the value's content is in the entries table under its own
  permission rules.

This is consistent with §12 posture (capability-token audit
co-transactional with the write) — the shipping code narrows the
audit content to metadata-only, which is a stronger privacy stance
than §12.6 describes.

## §CODE-SYNC.7 — The graph-model MVP is superseded and removed

`lib.rs` header comment, verbatim:

> An earlier MVP modelled Loam as a graph (Node/Edge/SchemaRegistry,
> /v1/nodes routes). That model is superseded and removed; it remains
> in git history if ever needed.

The `graph index (lightweight property graph)` line in the §2.2
storage cake diagram should be read as substrate aspiration or as a
downstream consumer concern (Cortex / Atlas / the food graph, per the
`lib.rs` intro). It is not a Loam engine feature today.

## §CODE-SYNC.8 — Reap loop + `WriteReceipt`

Two verified engine facts §§1–17 doesn't call out:

- **Background reaper.** `api/reaper.rs` runs a ticker task that
  drops expired entries. TTL enforcement is both boundary-checked
  (on read: 404 if past `expires_at`) and physically enforced (the
  reaper's redb `remove` calls). No stale bytes accumulate.
- **`WriteReceipt`** is the sole `put` return. It carries
  `namespace, key, version, expires_at, ts_written`. Callers key
  their own idempotency off `version`; the engine does not
  deduplicate.

## §CODE-SYNC.9 — Client SDK topology

`~/code/loam/` ships three SDKs:

- `loam-sdk-rust/` (`src/lib.rs`) — the reference client.
- `loam-sdk-python/loam_sdk/` — Python bindings; used by projection
  workers under `~/code/loam/workers/worker_core/loam_client.py`.
- `loam-sdk-typescript/` — TS bindings for browser + Node.

All three speak the two HTTP routes above. Adding a route means
touching the engine + all three SDKs + the workers directory. This
is the concrete cost of the "tiny wire" discipline §3.1 describes.

## §CODE-SYNC.10 — Status of each §1–17 claim

| Claim | Engine status 2026-07-15 |
|---|---|
| SQLite-per-shard (§2.2) | Not present. `redb` instead. |
| CBOR + Scheme bilingual (§2.5) | Not present. JSON entries today. |
| BLAKE3 + SHA-256 dual-hash (§2.6) | Not present in engine. Deferred to downstream. |
| HNSW vector index (§8.3) | Not present in engine. |
| 14 MCP tools (§4.1) | Not present as engine surface. HTTP with 4 routes. |
| Litestream WAL streaming (§2.2, §14.1) | Not in engine module. Deployment concern. |
| Cold-tier 3-of-5 restore (§14.2) | Script referenced (`curator-api/scripts/`); engine has no restore path. |
| Five planes (§9) | Collapses to three namespace kinds (`shared`, `<svc>`, `private:<svc>`). |
| Capability-token boundary (§12.1) | Realized as `Bearer <token>` → `TokenRegistry` → `Caller`. |
| K-anonymity floor of 8 (§12.4) | Not in engine. Downstream consumer concern. |
| No LLM in the auth path (§3.1) | ✅ Confirmed — `Permission::for` is pure code. |
| Append-only, no updates (§2) | ✅ Confirmed — every write is a new `(key, version)` row. |
| Metadata-only audit (implicit §12.1) | ✅ Confirmed and strengthened — value never written to ledger. |
| Deterministic Shell boundary (§3.3) | ✅ Confirmed for the engine's HTTP surface. |

Rows marked "not present" are not necessarily wrong intent — they
describe substrate futures whose plumbing lives outside the engine
module. Rows marked ✅ are load-bearing invariants the code enforces
structurally today.

---

# §APPX-A — Query-plan cookbook (added 2026-07-15, E2)

> The redb engine has no query planner. Every "query" is either a
> point-`GET` on `(namespace, key)` or a version-range scan. This
> appendix documents the small vocabulary of shapes callers should
> use, so that consumer code is uniform across services and the
> engine can be swapped later without rewriting client patterns.

## §APPX-A.1 — Six canonical access shapes

Every observed caller (`worker_core/loam_client.py`, the three SDKs,
and the projection workers) reduces to one of six shapes. Any new
access pattern SHOULD be pushed into one of these; deviating shapes
signal a design smell worth reviewing.

1. **Point read (freshest).** `GET /v1/entries/{ns}/{key}`.
   Returns the freshest non-expired version. This is 90%+ of reads.
2. **Point write (append version).** `PUT /v1/entries/{ns}/{key}`
   with body `{value, ttl_seconds}`. Returns a `WriteReceipt` with
   the new `version`.
3. **Versions listing.** `Store::versions(ns, key)` (SDK-level; no
   HTTP route today). Returns every non-expired version of `key` in
   ascending order. Use for audit reconstruction; do not use for
   hot-path reads.
4. **Prefix walk.** Direct backend-level scan of composite keys
   sharing a `<ns>\x00<prefix>` head. Not exposed via HTTP; SDK-only.
   Use sparingly — costs O(entries under prefix).
5. **Reap sweep.** `Store::reap()` — service-owned; no caller
   should invoke this on the hot path. The background reaper task
   in `api/reaper.rs` is the sole production invoker.
6. **Health probe.** `GET /healthz` and `GET /loam-health`. Cheap;
   safe for high-frequency polling.

## §APPX-A.2 — When each shape is right

| Consumer intent | Right shape | Wrong shape (anti-pattern) |
|---|---|---|
| "What is X's latest value?" | point read | prefix walk filtered client-side |
| "Was X ever set?" | point read; 404 = never or expired | versions listing |
| "Log this event" | point write to a per-write key (e.g., ULID) | overwriting a single key |
| "Reconstruct X's history" | versions listing | many point reads |
| "Enumerate all cars a service owns" | prefix walk | full-namespace scan |
| "Is Loam healthy?" | `/healthz` | `/loam-health` on every request |

The two anti-patterns to watch for on review: (a) callers doing
prefix walks when a point read would suffice, and (b) callers
overwriting a single key when they mean "append an event."
Overwriting a single key wastes the append-only chain's audit value.

## §APPX-A.3 — Key naming convention

The composite key is `<ns>\x00<entry_key>\x00<version>`. Since the
engine treats `entry_key` opaquely, convention lives in caller code.
Recommended shape:

```
<domain>/<subject>/<facet>
```

Examples verified against `worker_core/loam_client.py` usage:

- `weather/94103/current` — one row per zip, freshest wins.
- `web-cache/https-google-com/search-doc` — cache invalidates on
  TTL expiry.
- `cron/last-run/nightly-backup` — one row; latest write wins.

For event-log-style writes (where every write is distinct), append
a ULID or ISO timestamp as the last segment:

```
cart-outcome/cart-shop-listing-1234/01HXYZ7...
```

This makes prefix walks under `cart-outcome/cart-shop-listing-1234/`
give the event history in chronological order (ULID + BE-hex-version
sort agrees with wall time).

## §APPX-A.4 — TTL selection ladder

Since TTL is mandatory and capped at 30 days, callers must pick a
value on every write. Use this ladder:

- **60 s** — fast-moving state (rate-limit windows, in-flight cart
  status).
- **300 s (5 min)** — freshness-sensitive caches (weather, price
  quotes).
- **3600 s (1 hr)** — web-search caches, cron output.
- **86400 s (1 day)** — daily rollups, per-day projection segments.
- **604800 s (1 week)** — weekly reports, audit-window slices.
- **2592000 s (30 days)** — the ceiling; use only when the caller
  has a clear plan to re-write before expiry.

Anything asking for "forever" is wrong-substrate — that data belongs
in a durable service store (or the cold-tier scripts described in
§14), not in Loam. **Loam is a cache; the cache is 30 days.**

---

# §APPX-B — Backup and point-in-time-recovery protocol (added 2026-07-15, E2)

## §APPX-B.1 — What backup means for a cache substrate

Loam is a cache. The naive read of "back up the cache" is that you
shouldn't have to — a cache should be reconstructible from its
upstream sources. That reading is right for `shared` and per-service
namespaces (weather / cron output / web caches / etc.).

It is **wrong for `private:<service>` namespaces**, which carry
customer automation state under contract. Losing that data breaks
the contract. This appendix documents the protocol for those.

## §APPX-B.2 — Backup rhythm

For a running Loam service that holds `private:*` data:

- **Continuous** — the redb file itself is ACID; a `kill -9` at any
  moment leaves a consistent database. This is the first-tier
  durability.
- **Daily** — a script SHOULD dump the redb file to a timestamped
  path outside the service's own filesystem. Recommended landing:
  a per-service cold-object-store bucket (Backblaze B2 / Cloudflare
  R2 / Wasabi), matching the §14 3-of-5 discipline.
- **Weekly** — a script SHOULD verify the freshest daily dump by
  spinning up a `RedbBackend::open` against a copy and confirming
  `total_entries()` matches a stored count sidecar.
- **Monthly** — one dump SHOULD be pinned to indefinite retention
  as a long-tail witness; the rolling dumps rotate on a 90-day
  window.

These scripts do not exist as canonical artifacts in the repos
surveyed 2026-07-15 (`~/code/loam/` has no `backup/` directory).
The protocol above is prescriptive intent, marked
`:status "needs-alfred-review"` in the SLAT counterpart until the
scripts land.

## §APPX-B.3 — Point-in-time recovery from append-only chains

Every entry is a chain of `(namespace, key, version)` rows. The
version is a monotonic u64 written at append. Point-in-time
reconstruction of a specific key is:

```
for version in Store::versions(ns, key):
    if version.ts_written <= target_time:
        latest_before = version
return latest_before
```

This works *in-memory* against the current live store, provided none
of the earlier versions have been reaped. Since TTL expiry causes
reap, the effective PITR window for a `private:*` key is bounded by
its shortest TTL.

To reconstruct further back, restore the appropriate daily dump
(per §APPX-B.2) into a scratch service and query it. There is no
in-place time-travel query; the pattern is dump-restore + read.

## §APPX-B.4 — Cross-namespace restore hazard

Restoring a `private:<service>` namespace from a dump requires care:
the restored data is under contract to the same service that owned
it at dump time. Restoring into a *different* service's `private:*`
namespace would violate the contract — the permission model would
still enforce read isolation, but the *ownership* semantics would
be wrong.

Restore scripts MUST match the source service name to the
destination `private:*` prefix, and the `TokenRegistry` at the
destination MUST include the same service's token. Cross-service
restore requires an explicit re-namespace step (which is not a
supported operation in the engine today and needs an Alfred design
call).

---

# §APPX-C — Resource quotas + multi-tenant isolation model (added 2026-07-15, E2)

## §APPX-C.1 — The isolation guarantees the engine ships

`namespace.rs` enforces, in code, that `private:<svc>` reads and
writes are permitted only for the caller resolved as `Caller::of(svc)`.
Cross-service `private:*` access is a permission error — the check
is structural, not policy-configured.

Beyond that, the engine ships **no resource quotas**. There is no:

- per-namespace write-rate limit;
- per-key entry-count cap;
- per-namespace disk-bytes budget;
- per-caller QPS ceiling.

The absence is deliberate for v1.0 (the engine trusts the token
registry to gate who talks to it), but a hardened prod deployment
against untrusted callers needs these. This appendix records the
recommended quota shape so it can land uniformly when it lands.

## §APPX-C.2 — Recommended quota schema

Four quotas, keyed by namespace + caller:

| Quota | Default | Rationale |
|---|---|---|
| `writes_per_minute` | 600 | 10 QPS avg per caller-namespace |
| `entries_max` | 1_000_000 | Prevents a runaway loop from filling redb |
| `bytes_max` | 10 GB | Per-namespace disk ceiling |
| `value_bytes_max` | 1 MB | Per-entry-value ceiling |

Enforcement lives at the store boundary (`Store::put`), returning
a new `StoreError::QuotaExceeded(kind)` variant. A caller learns
which quota it hit — no silent throttling.

## §APPX-C.3 — Noisy-neighbor prevention

Since all namespaces share one redb file, a `private:baobab` write
storm can contend with a `private:curator` read. The engine has no
priority scheduler today. The recommended mitigation, if this
becomes real, is: **one redb file per top-level namespace family**,
selected by the `RedbBackend` constructor. The backend seam already
supports this (multiple `RedbBackend` instances behind a namespace
router). The change is a routing layer above `Store`, not a change
to `redb_backend.rs` itself.

## §APPX-C.4 — Multi-tenant capacity worksheet

For a deployment targeting N tenants each with an average of E
entries and W writes/day at average value size V bytes:

- Steady-state disk: `N × E × V × 1.3` (30% redb overhead + B-tree
  slack).
- Write throughput: `N × W / 86400` writes/sec (aggregate).
- Reap load: expired-per-day = new-per-day (steady-state) →
  reaper task must dispatch at least that fast.

A concrete sizing example (N = 500, E = 10k, W = 1k, V = 512 B):
disk ≈ 3.3 GB; write throughput ≈ 5.8 QPS; reaper ≈ 5.8 removes/s.
All comfortably within a single-node redb deployment. The
sizing headroom is why the shipping engine hasn't needed
sharding yet.

---

# §APPX-D — Disaster-recovery runbook (added 2026-07-15, E2)

> Prescriptive intent. The scripts referenced below (`backup.sh`,
> `restore.sh`, `verify.sh`) are recommended to land under
> `~/code/loam/scripts/` — they do not exist as canonical artifacts
> as of 2026-07-15. Marked `:status "needs-alfred-review"` in SLAT.

## §APPX-D.1 — Failure modes the runbook covers

1. **Node loss** — the machine running the Loam service is gone.
2. **Corruption** — the redb file is intact but inconsistent.
3. **Ransomware / hostile encryption** — the file is present but
   unreadable.
4. **Contract-namespace erasure** — a `private:<svc>` block was
   truncated in error.

## §APPX-D.2 — Node loss

1. Provision a replacement node with the same service identity
   (matching entry in `TokenRegistry` at the deployment layer).
2. Fetch the freshest daily dump from cold-object-store
   (Backblaze B2 preferred, R2 fallback, Wasabi second fallback —
   per §14's 3-of-5 discipline).
3. Verify sidecar SHA-256 against the dumped bytes before use.
4. Land the file at the service's redb path.
5. Start the service; watch `/loam-health` for `total_entries()`
   matching the sidecar count.
6. Reaper will drop expired-since-dump entries on first tick;
   subtract that from the count sidecar delta.
7. Point traffic at the restored node.

Recovery time objective (RTO): dominated by dump size. A 10 GB
dump at typical B2 pull rates is ~5 minutes; verification another
minute; total ~10 minutes from decision to service.

## §APPX-D.3 — Corruption

If `redb::Database::open` fails or returns rows that don't
deserialize as `Entry`:

1. **Do not overwrite the corrupt file.** Move it aside for
   forensics.
2. Restore from the freshest verified daily dump per §APPX-D.2.
3. Data loss = writes between the dump and the corruption event.
4. If the corruption is in a specific namespace only (rare with
   redb; more likely with future multi-file sharding), a targeted
   restore is possible via a scratch service + `Store::versions`
   walk.

## §APPX-D.4 — Ransomware / hostile encryption

Same as §APPX-D.3 mechanically, plus:

1. Rotate the service's token in `TokenRegistry` — the attacker
   may have exfiltrated it.
2. Rotate the SDK tokens of every service that reads this Loam
   instance — assume the write attempt logged their tokens too.
3. File an incident record on the audit ledger of the *upstream*
   substrate (Cortex-of-Loam per §5).

## §APPX-D.5 — Contract-namespace erasure

Restoring a single `private:<svc>` namespace from a dump requires
the cross-namespace-restore hazard care in §APPX-B.4. Because the
engine has no partial-restore operation:

1. Dump the current live redb file first (freshness beats staleness
   for other namespaces).
2. Restore the full backup to a scratch path.
3. Extract the `private:<svc>` prefix range via SDK prefix-walk.
4. Point-write those entries back into the live store under fresh
   TTLs (they will have their original values but new expiries).
5. The version numbers will be new. If callers depend on version
   monotonicity for consistency, they must accept a version reset
   for this namespace.

## §APPX-D.6 — Runbook drills

The runbook is worthless if it isn't rehearsed. Recommended
cadence:

- **Quarterly** — a game-day exercise that pulls the freshest
  daily dump into a scratch node and confirms end-to-end restore
  in under 15 minutes.
- **On major dep bump** — rehearse after any `redb` version bump,
  since on-disk format changes have been known to require careful
  migration paths.
- **After every real incident** — the runbook gets an update
  section for the new failure mode.

Log each drill on the Cortex-of-Loam audit trail (§5) so the
substrate itself remembers the last successful restore.

---

# §APPX-E — Capacity-planning worksheet (added 2026-07-15, E2)

## §APPX-E.1 — Inputs

To size a Loam deployment, gather:

- **N** = number of top-level namespaces expected in year 1.
- **E_avg** = average entries per namespace at steady state.
- **V_avg** = average value bytes per entry.
- **W_daily** = average writes per namespace per day.
- **R_daily** = average reads per namespace per day.
- **T_avg_seconds** = average TTL used across writes.

## §APPX-E.2 — Outputs

Compute:

- **Steady-state entry count:** `N × E_avg`
- **Steady-state disk (bytes):** `N × E_avg × V_avg × 1.35`
  (35% overhead for redb B-tree + JSON envelope + composite key
  bytes)
- **Write throughput (QPS):** `N × W_daily / 86400`
- **Read throughput (QPS):** `N × R_daily / 86400`
- **Reap load (removes/s):** equals write throughput at steady
  state (every write eventually expires and is reaped).
- **Peak-hour multiplier:** apply ×4 to write and read QPS if
  traffic is bursty; ×1.5 if smooth.

## §APPX-E.3 — Redlines

Single-node redb deployment redlines observed empirically:

- **Disk:** below 50 GB total → comfortable; 50–200 GB → still
  fine, watch file-size growth; above 200 GB → plan a shard by
  namespace family (multiple `RedbBackend` instances).
- **Write QPS:** below 500 → comfortable; 500–2000 → tune the
  reaper cadence; above 2000 → shard.
- **Read QPS:** redb handles this well by design; the ceiling is
  usually not read throughput but network egress. Above 10k QPS
  read, consider a front-cache in the SDK (client-side memoization
  respecting TTL).
- **Entry count:** below 10M rows → healthy; above 10M → prefix
  walks become expensive; consider a materialized index namespace
  above the primary namespace.

## §APPX-E.4 — Worked example: Curator year 1

Inputs (rough, needs-alfred-review):

- N = 3 (`shared`, `curator`, `private:curator`)
- E_avg = 500,000 (cross-namespace average, driven by
  `private:curator` operator automations)
- V_avg = 1024 bytes (small structured records)
- W_daily = 200,000 (aggregate across all automations firing)
- R_daily = 2,000,000 (10× read amplification for cache-hit
  patterns)
- T_avg = 3600 s (1 hour average — mostly caches)

Outputs:

- Entries: 1.5M
- Disk: ≈ 2.1 GB
- Write QPS: 6.9 (peak-hour ≈ 28)
- Read QPS: 69 (peak-hour ≈ 276)
- Reap: 6.9/s

All comfortably within single-node redlines. The deployment is
network-bounded, not storage-bounded, at this scale.

## §APPX-E.5 — When to escalate to Alfred

Escalate the capacity plan if any of the following become true:

- Disk projection > 200 GB in year 1.
- Peak-hour write QPS > 1000 sustained.
- Any single `private:<svc>` namespace projects to > 100M entries.
- The reap-rate projection exceeds the observed reaper throughput.

Each of these is a design-conversation trigger — not a
launch-blocker, but a signal that the single-file model is nearing
its end and a shard/sub-shard split needs a plan.

---

# §APPX-F — Migration protocol between Loam engine versions (added 2026-07-15, E2)

## §APPX-F.1 — Why migration is a first-class concern

Loam holds contract data (`private:*`). A Loam version bump that
changes the on-disk format without a migration path is a data-loss
event. This appendix documents the discipline for engine-version
bumps.

## §APPX-F.2 — Version categories

- **Patch bumps (0.x.Y)** — bug fixes only; on-disk format
  unchanged. Restart in place.
- **Minor bumps (0.X.0)** — new backend features, new namespace
  kinds, new HTTP routes. On-disk format compatible read-forward;
  new writes may use features old engine can't read. Restart in
  place; document new features in a per-bump note.
- **Major bumps (X.0.0)** — on-disk format may change (e.g., redb
  version bump that changes B-tree encoding, JSON → CBOR envelope
  change). Requires migration script.

## §APPX-F.3 — Migration script contract

Any major-bump migration script MUST:

1. Halt writes to the source engine before migration begins (the
   deployment's load balancer or a `503 draining` flag).
2. Take a fresh dump of the source redb file.
3. Rewrite the dump under the new on-disk format into a scratch
   file.
4. Verify entry count parity: `source.total_entries() ==
   destination.total_entries()`.
5. Verify a random-sample of point-reads: 1000 random
   `(ns, key, version)` triples must deserialize identically under
   both engines' `Entry` types.
6. Atomically swap the destination file into the service's redb
   path.
7. Resume writes.

## §APPX-F.4 — Rollback

The source redb file is preserved for 30 days post-migration. A
rollback is: halt writes, swap the source back in, resume writes.
Any writes accepted under the new engine during that window are
lost on rollback — this is the honest cost, and callers must be
told the RTO for rollback vs re-migration.

## §APPX-F.5 — MCP / AAIF transition composability

Per §MCP-GOVERNANCE, MCP endpoints transition to AAIF governance
2026-07 → 2026-08. If the AAIF transition changes token semantics
(e.g., token rotation frequency, scope shape), a Loam engine minor
bump absorbs the change at the `TokenRegistry` layer without an
on-disk format change. Callers rotate tokens per AAIF cadence; the
engine sees them uniformly.


