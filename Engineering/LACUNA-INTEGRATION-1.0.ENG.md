---
slug: lacuna-integration-1.0-eng
title: Lacuna Integration — Engineering
category: engineering
canonical: true
version: 1.0
last-reviewed: 2026-07-11
covers-through: 2026-07-11
owner: Marcus (SRE) + Priya (security)
codename: lacuna-integration
supersedes:
  - doc-expansion-staging/lacuna-integration.md (FOLDED)
  - all-docs-lane-ac/canonical-drafts/LACUNA-INTEGRATION-1.0-ENGINEERING.md (older draft)
  - all-docs-lane-ac/FIRECRAWL-EXPERT-DEEP-DIVE-2026-06-29.md (Firecrawl route expansion — §FC-ROUTES)
  - all-docs-lane-ac/FIRECRAWL-INTEGRATION-AUDIT-2026-06-29.md
  - all-docs-lane-ac/LACUNA-FIRECRAWL-USE-CASES-2026-06-29.md
  - all-docs-lane-ac/WAVE-3-FIRECRAWL-V2-MIGRATION-2026-06-29.md
theme: lacuna-integration
---
# Lacuna Integration 1.0 — Engineering Manual
<!-- covers-through: 2026-07-11 (drift pass vs HEAD d4f5a8a4; P2/HN-1 verb wave reflected; Firecrawl-family routes folded from recovery lane 2026-07-11) -->

> **Canonical engineering doc #7 of the sealed Sakura Scheme 1.0 doc-set.**
> Pairs with `docs/HELLO-SURFACE-1.0-ENGINEERING.md` (substrate),
> `docs/SAKURA-SCHEME-1.0-ENGINEERING.md` (runtime),
> `docs/SAKURA-SCHEME-1.0-REFERENCE.md` (verb catalog),
> `docs/SAKURA-AUTOMATIONS-1.0.md` (cart catalog),
> `docs/LOAM-1.0-ENGINEERING.md` (substrate database),
> `docs/SAKURA-TRAINING-MANUAL-1.0-ENGINEERING.md` (training pipeline),
> `docs/LACUNA-TELEMETRY-1.0-ENGINEERING.md` (instrumentation), and
> `docs/SAKURA-SCHEME-1.0-SEALING.md` (sealing protocol).
>
> **Audience.** SRE; any engineer touching a wire-call module; any future
> archaeologist trying to understand which capability calls which upstream;
> any auditor reviewing the vendor-naming firewall.
>
> **Voice.** HelloSurface gold standard — dry, structured, data-rich,
> file:line-anchored. The integration boundary is the one place vendor
> names ARE permitted in the codebase (`CLAUDE.md` 2026-06-22 lock), so
> this doc names every vendor explicitly. The corresponding cart-side,
> Scheme-side, and operator-side surfaces never name them.
>
> **Author.** Alfred Robins / Claude Code (PM lane). 2026-06-30.

---

## TABLE OF CONTENTS

- [§0. What integration means at Lacuna](#0-what-integration-means-at-lacuna)
- [§1. The verb → backing map](#1-the-verb--backing-map)
- [§2. Per-vendor wire-call modules](#2-per-vendor-wire-call-modules)
  - [§2.1 Etsy (openapi.etsy.com/v3)](#21-etsy)
  - [§2.2 eBay (api.ebay.com/sell)](#22-ebay)
  - [§2.3 Shopify (admin GraphQL/REST 2026-01)](#23-shopify)
  - [§2.4 Printify (api.printify.com/v1)](#24-printify)
  - [§2.5 Meta (graph.facebook.com)](#25-meta)
  - [§2.6 Instagram (instagram graph)](#26-instagram)
  - [§2.7 Google (Merchant Center, Places, GA4, Calendar, Drive, Sheets, Docs, Gmail, Vertex AI)](#27-google)
  - [§2.8 Anthropic (api.anthropic.com/v1/messages)](#28-anthropic)
  - [§2.9 Gemini (generativelanguage.googleapis.com/v1beta — direct AI Studio)](#29-gemini)
  - [§2.10 Firecrawl (api.firecrawl.dev/v1)](#210-firecrawl)
  - [§2.11 Stripe](#211-stripe)
  - [§2.12 Web search routing](#212-web-search-routing)
- [§3. OAuth + token model](#3-oauth--token-model)
- [§4. Rate limiting + back-pressure](#4-rate-limiting--back-pressure)
- [§5. Error handling per vendor](#5-error-handling-per-vendor)
- [§6. The 13 new Wave-4/5/6 route handlers (2026-06-30)](#6-the-13-new-route-handlers)
- [§7. Vertex-shift note (W7B-DIRECT-VENDOR-PARITY)](#7-vertex-shift-note)
- [§8. The W2-§4 namespace blocks (3 resolutions)](#8-the-w2-4-namespace-blocks)
- [§9. LIVING:RESEARCH](#9-livingresearch)
- [§10. References](#10-references)

---

## §0. What integration means at Lacuna

### §0.1 Two-axis design

Lacuna's integration story has two axes that look similar from a distance
and are radically different up close. They MUST be kept distinct.

**Axis 1 — Capability verbs (cart-facing).** The cart corpus calls
capability-shape verb names: `etsy/listings`, `model/workhorse`,
`web/search`, `cortex/recall`, `mail/dispatch`. These are the names cart
authors (human and LLM) write. They appear in cart source. They appear
in `sakura-corpus.jsonl`. They appear in operator-facing tooltips and
the Automations dossier. They are the language Sakura speaks.

A capability verb names **what work happens** without committing to who
does it. `etsy/listings` says "list this operator's Etsy listings,"
not "make an HTTP call to openapi.etsy.com." The cart corpus does not
know which upstream services Lacuna talks to. It cannot — the corpus
trains on this surface; if vendor identifiers leak into the corpus,
they bake into the on-device savant's weights, and Sakura starts
hallucinating vendor names back at operators (`CLAUDE.md` 2026-06-22
"Vendor naming — STRIP from the product" lock).

**Axis 2 — Wire-call modules (vendor-facing).** Behind each capability
verb is exactly one Python module that owns the HTTP boundary to a
named upstream. `etsy/listings` resolves to
`curator_api.stores.etsy.EtsyClient.list_listings(...)`. The
`EtsyClient` module is the ONE place `openapi.etsy.com/v3/application`
appears in the codebase. Same for every other vendor: one module, one
boundary, one allowed location for the vendor name.

This document maps Axis 1 onto Axis 2. The vendor names appear here
because this is where they must — at the wire-call boundary. Nowhere
else.

### §0.2 The vendor-naming firewall

Per `CLAUDE.md` 2026-06-22 lock, the following 14 tokens are banned
EVERYWHERE except the literal wire-call HTTP method that posts to the
vendor's URL:

```
Claude · Anthropic · Sonnet · Opus · Qwen · Llama · Mistral · Gemini
Perplexity · Firecrawl · DeepSeek · Vertex · OpenAI · GPT
```

Banned in:

- Operator-facing UI copy
- Cart `;;~ explain` doc-blocks (visible in the Automations dossier)
- Training corpus (`curator-web/src/scheme/carts/sakura-corpus.jsonl`,
  `curator-web/src/scheme/sakura-cart-breadcrumbs.json`,
  any `.jsonl` Sakura trains on)
- System prompts sent to models
- Internal backend modules, route names, function names, log messages
  (use capability verbs, not vendor names)
- Backend Python where it's choosing between vendors (the router /
  dispatch layer names the capability tier, not the vendor)

Permitted in:

- `curator-api/curator_api/llm_router/batch_anthropic.py`
  (`batch_anthropic.py:1-12`, the wire-call module — its docstring is
  explicit: "THIS IS THE WIRE-CALL BOUNDARY. Per CLAUDE.md 2026-06-22
  vendor-name lock, this is the ONE module where vendor identifiers
  (Anthropic, api.anthropic.com, the message-batches URL path) are
  permitted.")
- `curator-api/curator_api/llm_router/batch_gemini.py`
  (`batch_gemini.py:1-12`)
- `curator-api/curator_api/llm_router/cache_gemini.py`
- `curator-api/curator_api/llm_router/direct_clients.py`
- `curator-api/curator_api/_llm.py:438` (`URL = "https://api.anthropic.com/v1/messages"`)
- `curator-api/curator_api/_llm.py:674-675` (`generativelanguage.googleapis.com`)
- `curator-api/curator_api/_llm.py:959` (`"https://api.openai.com/v1/chat/completions"` — present in code but routed away from per the 2026-06-22 lock)
- This document (vendor names are the unit of the document)
- `README.md` · `LICENSE` · `NOTICE` (OSS attribution requirements)
- `lacuna-curator-api/Dockerfile` to the extent it pulls an upstream
  image base

The audit (`scripts/audit_carts.py:108-118`) and the lint
(`scripts/cart_lint.py:139-152`) enforce the ban on the cart corpus.
A vendor-name leak in a cart is a hard fail.

**Marketplace names STAY visible.** Etsy · eBay · Shopify · Meta ·
Instagram · Printify · Stripe · Google (Shopping/Merchant). These are
the product surfaces operators actually sell on; they appear in the
UI, in cart explanations, in operator dashboards. The marketplace name
is the operator's literal context. Only the LLM / scrape / vision
**reasoning** vendors are firewalled.

### §0.3 The integration contract

Every wire-call module in this codebase satisfies four invariants. If
any module breaks one, the integration boundary is broken and the
audit flags it.

1. **Single boundary.** Each vendor has exactly one Python module that
   owns its HTTP surface. Other code calls into the module via a
   capability function, never directly.

2. **Honest-null on missing credential.** When the credential isn't
   configured, the function returns the structured envelope
   `{"ok": False, "error": "service-not-yet-wired", "reason": "<vendor>-not-connected"}`
   instead of raising. The cart layer reads this and escalates
   (`'service-not-yet-wired`).

3. **Mock-first.** Each public function accepts an optional
   `transport: httpx.BaseTransport` argument so tests can inject
   `httpx.MockTransport(...)` for zero-network test coverage. The W4
   spec mandates this; `batch_anthropic.py:31-34`,
   `etsy/client.py:14-17`, `shopify/client.py:71`, etc. all comply.

4. **Operator-commit gate on every write.** Any verb that mutates
   upstream state requires `operator_commit: true` on the ctx, checked
   defensively at the wire-call module boundary (not just at the
   Scheme macro that emitted it). The pattern is in every dispatcher:
   `etsy/client.py:50-55`, `shopify/client.py:38-43`,
   `meta/dispatcher.py:79-82`, `batch_anthropic.py:90-101`.

### §0.4 Document scope

This document covers vendors **shipping production wire-calls** as of
2026-06-30. The verb-routing table in §1 is canonical for the sealed
1.0 surface. Per `CLAUDE.md` "Out-of-scope vendors (W01 wire lock,
2026-06-14)" — Perplexity, Pinterest, Reddit, and Spotify are
deliberately not integrated. The lint blocks any cart that references
their namespaces.

Vendor wire-calls listed but marked "**status: NOT WIRED**" exist in
shops/router descriptors but lack the HTTP-route layer; the
corresponding carts return `service-not-yet-wired`. Section §1 makes
this explicit.

---

## §1. The verb → backing map

The verb registry is the single source of truth for which capabilities
exist. The HTTP route module (`curator-api/curator_api/routes/verb_backings.py`)
is the single source of truth for which capabilities have a wire-call
backing. The intersection is the set of carts that actually run today.

### §1.1 The wired-verb set (83 verbs, 7 waves)

Source: `scripts/build_cart_index.mjs:324` (`WIRED_VERBS` set). The set
grew from 62 to 83 between the 2026-06-30 draft and HEAD `d4f5a8a4`; the
canonical count is whatever `WIRED_VERBS` holds — the number here is a
convenience, not a second source of truth. To re-derive it exactly:
`awk '/WIRED_VERBS = new Set/,/\]\)/' scripts/build_cart_index.mjs`.

| Wave | Date | Verbs added | Spec doc |
|---|---|---|---|
| 1 | 2026-06-15 | `cortex/recall`, `cortex/remember`, `loam/operator-state`, `model/fast`, `model/workhorse` | `docs/PREAMBLE-ENVELOPE-DESIGN-2026-06-15.md` |
| 2 | 2026-06-15 | `lacuna/ask`, `etsy/listings`, `etsy/receipts`, `sakura/decide`, `shopify/products`, `web/scrape`, `web/search` | n/a |
| 3 | 2026-06-15 | `etsy/listing`, `model/draft`, `model/deep-reasoning`, `ebay/listings`, `ebay/sold`, `ebay/update`, `shopify/orders`, `shopify/update`, `meta/products`, `pii/gate-status`, `documents/parse-invoice`, `vision/label`, `cortex/multi-store-publish`, `cortex/multi-store-unpublish`, `cortex/multi-store-publish-dry-run` | n/a |
| 4 | 2026-06-15 | `etsy/images`, `etsy/conversations`, `etsy/reviews`, `etsy/shop`, `analytics/report`, `ship/rate`, `instagram/post`, `meta/marketplace`, `ads/insights`, `stripe/dashboard` | n/a |
| 5 | 2026-06-22 | `stats/zscore`, `stats/delta`, `stats/cooc`, `stats/cosine`, `stats/percentile`, `cortex/calendar`, `cortex/forget`, `cortex/cosine-topk`, `sakura/say`, `sakura/cloud-reason` | n/a |
| 6 | 2026-06-30 | `voice/transcribe`, `voice/synthesize`, `mail/dispatch`, `mail/template`, `mail/draft`, `mail/with-gifs`, `mail/unsubscribe`, `notify/push`, `etsy/orders`, `etsy/inventory`, `etsy/ledger`, `etsy/reprice`, `meta/orders` | `docs/CART-WIREUP-AUDIT-2026-06-30.md` |

Wave 7B (2026-06-29) added 8 admin-only routes for batch / cache —
`model/batch-anthropic-{submit,status,retrieve}`,
`model/batch-gemini-{submit,status,retrieve}`,
`model/cache-gemini-{create,delete}` — and 2 SRE admin endpoints
(`/api/admin/cost/summary`, `/api/admin/cost/dashboard-widget`) per
`docs/WAVE-7B-DIRECT-VENDOR-PARITY-2026-06-29.md:27-57`. (The batch /
cache verbs are admin-only route handlers and are not members of the
cart-facing `WIRED_VERBS` set.)

Wave 7 (2026-07 — the "honest-null wiring" burndown) added the
remaining 21 verbs that lift the set to 83. These fall into three
groups, each backed by a real handler in `verb_backings.py` and mapped
in `curator-web/src/scheme/runtime/verbBackings.js`:

| Group | Verbs added | Backing | Wire status |
|---|---|---|---|
| Marketplace read-siblings (2026-07-03 P1/HN-3, commits `d4f5a8a4`, `e2cba8cd`, `6c861827`) | `etsy/messages`, `etsy/sections`, `ebay/feedback`, `shopify/customers`, `ebay/fees`, `ebay/orders`, `etsy/list-listings`, `etsy/list-orders`, `etsy/list-sales`, `etsy/listing-detail`, `etsy/order-detail`, `shopify/listings` | `EtsyClient.list_shop_messages` (`stores/etsy.py:1120`), `.list_shop_sections` (`:1194`), `EbayClient` feedback/fees, `ShopifyClient` customers | wired against the real client methods |
| Web / documents (2026-07-03 P2/HN-1) | `documents/parse`, `web/extract-schema`, `web/monitor` | `documents_parse` (`verb_backings.py:1596`), `web_extract_schema` (`:944`), `web_monitor` (`:993`) | wired |
| Vision / Cortex read family (Wave 7) | `vision/describe`, `vision/embed`, `vision/ocr`, `cortex/event`, `cortex/fetch`, `cortex/query`, `cortex/read`, `cortex/read-memory` | `vision_describe` (`verb_backings.py:1671`), `vision_embed` (`:1717`), `vision_ocr` (`:1694`); Cortex read siblings (commit `c7e2bbab`) | wired |

A CI sync-guard pins the two sides in agreement:
`curator-web/src/scheme/runtime/__tests__/wiredVerbsSync.test.js`
asserts every `WIRED_VERBS` member has a route mapping in
`verbBackings.js` (commit `d1c77085`). A verb added to one side without
the other fails CI.

<!-- LIVING:TODO(2026-07-03): the per-verb line-number cites in §1.2 predate the Wave-7 growth of verb_backings.py and have drifted (the file grew ~800 lines). The handler NAMES are stable and re-greppable; the `:NNNN` anchors need a bulk re-verification pass. Prefer `grep -n "async def <handler>" routes/verb_backings.py` over trusting the cited line. -->


### §1.2 The verb → wire-call resolution table

Cart calls `(act 'verb-name args 'on-result)`. The dispatcher routes
to the HTTP handler in `verb_backings.py`. The handler delegates to a
backing module. Resolution order:

| Verb (Axis 1) | Route handler (verb_backings.py) | Backing module (Axis 2) | Upstream URL |
|---|---|---|---|
| `cortex/recall` | `:171` `cortex_recall` | `cortex.memory.CortexStore.list_memos` | local (SQLite + Cortex shell) |
| `cortex/remember` | `:214` `cortex_remember` | `cortex.memory.CortexStore.create_memo` | local |
| `cortex/forget` | `:2154` `cortex_forget` | `cortex.expunge` | local |
| `cortex/calendar` | `:2106` `cortex_calendar` | `cortex.memo_calendar` | local |
| `cortex/cosine-topk` | `:2206` `cortex_cosine_topk` | `cortex.search` | local |
| `cortex/multi-store-publish` | `:1346` | `cross_marketplace.publish` | multi (etsy/ebay/shopify fan-out) |
| `cortex/multi-store-unpublish` | `:1406` | `cross_marketplace.unpublish` | multi |
| `cortex/multi-store-publish-dry-run` | `:1467` | `cross_marketplace.dry_run` | (no wire) |
| `loam/operator-state` | `:284` | `_operator_settings.get_settings` + `loam.shell_chain` | local + Rust shell |
| `model/fast` | `:360` | `_llm.LocalOllamaBackend` (degrades to honest-null) | `localhost:11434` (degraded path) |
| `model/workhorse` | `:429` | `_llm.LocalOllamaBackend` (Sonnet wiring pending) | (degraded) |
| `model/draft` | `:868` | `_llm` family | (per route preferences) |
| `model/deep-reasoning` | `:886` | `llm_router.router` → `direct_clients` | `api.anthropic.com/v1/messages` |
| `model/batch-anthropic-*` | (W7B) | `llm_router.batch_anthropic` | `api.anthropic.com/v1/messages/batches` |
| `model/batch-gemini-*` | (W7B) | `llm_router.batch_gemini` | `generativelanguage.googleapis.com/v1beta/.../batchGenerateContent` |
| `model/cache-gemini-*` | (W7B) | `llm_router.cache_gemini` | `generativelanguage.googleapis.com/v1beta` |
| `lacuna/ask` | `:526` | (stub — honest-null) | (NOT WIRED — pending knowledge graph) |
| `sakura/decide` | `:672` | local routing logic | local |
| `sakura/say` | `:2271` | local | local |
| `sakura/cloud-reason` | `:2305` | `llm_router.router` | (routes to model/deep-reasoning path) |
| `etsy/listings` | `:556` | `stores.etsy.EtsyClient.list_listings` | `openapi.etsy.com/v3/application` |
| `etsy/listing` | `:855` | `stores.etsy.EtsyClient.get_listing` | etsy |
| `etsy/receipts` | `:624` | `stores.etsy.EtsyClient.list_receipts` | etsy |
| `etsy/images` | `:1506` | `stores.etsy.EtsyClient.list_images` | etsy |
| `etsy/conversations` | `:1548` | `stores.etsy.EtsyClient.list_conversations` | etsy |
| `etsy/reviews` | `:1585` | `stores.etsy.EtsyClient.list_reviews` | etsy |
| `etsy/shop` | `:1622` | `stores.etsy.EtsyClient.get_shop` | etsy |
| `etsy/orders` | `:2678` (W6) | `stores.etsy.EtsyClient` orders surface | etsy |
| `etsy/inventory` | `:2725` (W6) | `etsy.client` (Wave 5a dispatcher) | etsy |
| `etsy/ledger` | `:2770` (W6) | `stores.etsy.EtsyClient.list_ledger` | etsy |
| `etsy/reprice` | `:2815` (W6) | `stores.etsy.EtsyClient.update_price` | etsy |
| `ebay/listings` | `:978` | `stores.ebay.EbayClient.list_listings` | `api.ebay.com/sell/inventory/v1` |
| `ebay/sold` | `:1025` | `stores.ebay.EbayClient.list_sold` | ebay |
| `ebay/update` | `:1069` | `stores.ebay.EbayClient.update_listing` | ebay |
| `shopify/products` | `:720` | `stores.shopify.ShopifyClient.list_products` | `<shop>.myshopify.com/admin/api/2026-01` |
| `shopify/orders` | `:1112` | `stores.shopify.ShopifyClient.list_orders` | shopify |
| `shopify/update` | `:1162` | `stores.shopify.ShopifyClient.update_product` | shopify |
| `meta/products` | `:1215` | `stores.meta.MetaClient` (catalog products) | `graph.facebook.com/v22.0` |
| `meta/marketplace` | `:1753` | `stores.meta.MetaClient` (marketplace listing) | meta |
| `meta/orders` | `:2876` (W6) | `meta.dispatcher.shop_orders` | meta |
| `instagram/post` | `:1703` | `instagram.dispatcher` | `graph.facebook.com` (Instagram Graph) |
| `web/scrape` | `:774` | `firecrawl.tools.scrape` | `api.firecrawl.dev/v1/scrape` |
| `web/search` | `:816` | `firecrawl.tools.search` | `api.firecrawl.dev/v1/search` |
| `voice/transcribe` | `:2365` (W6) | `voice.transcribe.transcribe` (route wire) | Google Speech-to-Text OR honest-null. On-device Parakeet TDT 0.6B v2 module **has landed but is not yet wired to this route** — see §2.13 |
| `voice/synthesize` | `:2404` (W6) | `voice.synth.synthesize` | (Google TTS via L1 router) |
| `mail/dispatch` | `:2443` (W6) | `mail.dispatcher.dispatch` | (SMTP / SES upstream) |
| `mail/template` | `:2478` (W6) | `mail.dispatcher.template` | (pure render — no wire) |
| `mail/draft` | `:2507` (W6) | `mail.dispatcher.draft` | (pure render) |
| `mail/with-gifs` | `:2537` (W6) | `mail.dispatcher.with_gifs` | (pure render) |
| `mail/unsubscribe` | `:2579` (W6) | `mail.unsubscribe` | local (signed token store) |
| `notify/push` | `:2634` (W6) | `push.dispatcher.push` | (W3C Web Push to operator browser) |
| `documents/parse-invoice` | `:1286` | `google.document_ai` (per W2 §4 resolution) | (NOT YET WIRED — see §8) |
| `vision/label` | `:1316` | `vision.label` | (NOT YET WIRED beyond label stub) |
| `analytics/report` | `:1646` | `google.ga4_data` (per W2 §4 resolution) | `analyticsdata.googleapis.com/v1beta` |
| `ads/insights` | `:1779` | `google.ads` (NOT YET WIRED) | (planned) |
| `ship/rate` | `:1678` | `vendors.shippo` / `vendors.aftership` | (NOT YET WIRED beyond stub) |
| `stripe/dashboard` | `:1803` | (link generator only — no API call) | `dashboard.stripe.com/<account>` deeplink |
| `pii/gate-status` | `:1262` | local PII ledger | local |
| `stats/zscore` | `:1839` | local (deterministic math) | local |
| `stats/delta` | `:1889` | local | local |
| `stats/cooc` | `:1947` | local | local |
| `stats/cosine` | `:2002` | local | local |
| `stats/percentile` | `:2042` | local | local |

### §1.3 Verbs in shops.js but NOT yet wired (the unwired surface)

Source: `docs/CART-WIREUP-AUDIT-2026-06-30.md §3` plus `scripts/audit_carts.py:38-62` (the `INFRA_WAITING_NS` set). The audit
counts 2,628 carts as INFRA-WAITING (audit output 2026-06-30) — they
declare verbs whose namespaces are reserved but not yet backed.

The top-20 leverage verbs (fix one → unlock dozens of carts) per
`docs/CART-WIREUP-AUDIT-2026-06-30.md:296-309`. The **Status** column is
re-verified against HEAD `d4f5a8a4`; the audit's carts-blocked/solo-unlocks
counts are as of 2026-06-30 and predate the P2/HN-1 wave that landed the
five verbs now marked **wired**:

| Verb | Carts blocked | Solo unlocks | Status |
|---|---|---|---|
| `documents/parse` | 113 | 69 | **Wired** (P2/HN-1, 2026-07-03) — `routes/verb_backings.py:1596` `documents_parse()`; route `/api/verbs/documents/parse` (`verbBackings.js:49`) |
| `model/vision-photo` | 115 | 59 | No backing anywhere |
| `model/grounded` | 55 | 43 | No backing anywhere |
| `model/cache-warm` | 66 | 37 | No backing anywhere |
| `web/extract-schema` | 77 | 29 | **Wired** (P2/HN-1) — `routes/verb_backings.py:944` `web_extract_schema()`; route `verbBackings.js:135` |
| `model/code-execute` | 60 | 29 | No backing anywhere |
| `web/monitor` | 41 | 29 | **Wired** (P2/HN-1) — `routes/verb_backings.py:993` `web_monitor()`; route `verbBackings.js:136` |
| `image/compose` | 107 | 24 | No backing anywhere |
| `vision/describe` | 60 | 23 | **Wired** (P2/HN-1) — `routes/verb_backings.py:1671` `vision_describe()`; route `verbBackings.js:126` |
| `scene/imagine` | 54 | 22 | Canvas-side only |
| `vision/embed` | 71 | 20 | **Wired** (P2/HN-1) — `routes/verb_backings.py:1717` `vision_embed()`; route `verbBackings.js:127` |
| `stripe/payouts` | 17 | (varies) | Stripe Payouts API NOT WIRED — see §2.11 |
| `google/merchant-feed` | 5 | (varies) | Google Merchant NOT WIRED — see §2.7 + §8 |
| `google/merchant-center` | 3 | (varies) | (same) |

<!-- LIVING:TODO re-run scripts/audit_carts.py against HEAD to refresh the
     carts-blocked / solo-unlocks columns now that the P2/HN-1 verbs are
     backed; the 2,628 INFRA-WAITING count and the per-verb blocked counts
     above are 2026-06-30 figures and now overstate the gap. -->

The five verbs backed by the P2/HN-1 wave (`documents/parse`,
`web/extract-schema`, `web/monitor`, `vision/describe`, `vision/embed`)
degrade honestly: when the upstream model/scrape dependency is unavailable
the handler returns `ok-degraded` with a `reason` (see the `_audit(...,
"ok-degraded", ...)` calls in `routes/verb_backings.py`), not a fabricated
result. `vision/ocr` shares the same wave (`vision_ocr()` at
`routes/verb_backings.py:1694`).

The remaining unwired surface is documented as a feature, not a defect:
every infra-waiting cart returns a structured `service-not-yet-wired`
envelope so operators see the gap and the cart can be re-tried after the
wave lands.

<!-- LIVING:EXPAND puppet-master — the LLM↔surface interface that selects
     which leverage verb to escalate on a `service-not-yet-wired` envelope
     is being built in the PUPPET-MASTER-SUITE lane; document the
     escalation/repair contract here once that lane lands. -->

The verb table is kept honest by a CI sync-guard: `WIRED_VERBS`
(`src/scheme/runtime/verbBackings.js`) must match the backing routes
registered in `routes/verb_backings.py`; the guard test
(`wiredVerbsSync.test.js`, landed commit `d1c77085`) fails the build on
drift.

---

## §2. Per-vendor wire-call modules

### §2.1 Etsy

**Capability namespace.** `etsy/*` (12 verbs wired as of W6).

**Wire-call modules.**

| Module | Owns | Surface |
|---|---|---|
| `curator-api/curator_api/stores/etsy.py` | The OAuth-bound, rate-limit-aware EtsyClient | `EtsyClient.list_listings`, `.get_listing`, `.list_receipts`, `.list_images`, `.list_conversations`, `.list_reviews`, `.get_shop` (and the W6 orders / inventory / ledger / reprice extensions) |
| `curator-api/curator_api/etsy/client.py:44` (`ETSY_API_BASE`) | The thin capability wrapper for Wave-5a routes | Functions called by the new W6 endpoints when an OAuth'd client is unavailable; returns honest-null envelopes |

**Upstream URL.** `https://openapi.etsy.com/v3/application`
(`etsy/client.py:44`).

**Auth.** OAuth 2.0 + x-api-key. The route layer threads the
operator's stored OAuth token onto the ctx as `oauth_token`, plus the
app's API key as `api_key` (`etsy/client.py:75-79`). Both are
mandatory; either missing yields `service-not-yet-wired` with reason
`etsy-not-connected` or `etsy-shop-id-missing`
(`etsy/client.py:66-72`).

**Verb table.**

| Verb | Etsy v3 path | Method | Operator-commit |
|---|---|---|---|
| `etsy/listings` | `/shops/{shop_id}/listings` | GET | no |
| `etsy/listing` | `/listings/{listing_id}` | GET | no |
| `etsy/receipts` | `/shops/{shop_id}/receipts` | GET | no |
| `etsy/images` | `/listings/{listing_id}/images` | GET | no |
| `etsy/conversations` | `/conversations` | GET | no |
| `etsy/reviews` | `/listings/{listing_id}/reviews` | GET | no |
| `etsy/shop` | `/shops/{shop_id}` | GET | no |
| `etsy/orders` (W6) | `/shops/{shop_id}/receipts?was_paid=true` | GET | no |
| `etsy/inventory` (W6) | `/listings/{listing_id}/inventory` | GET | no |
| `etsy/ledger` (W6) | `/shops/{shop_id}/payment-account/ledger-entries` | GET | no |
| `etsy/reprice` (W6) | `/shops/{shop_id}/listings/{listing_id}/inventory` | PUT | **yes** |

The wire-call discipline is in `etsy/client.py:82-128` (`_wire_get` +
`_wire_write` are the only two places HTTP methods land). Both accept
the `transport` injection seam for mock testing.

**Rate limit.** Etsy v3 enforces 10 queries/second per app and
10,000 per day per app. The `EtsyClient` consults a per-operator
RateLimiter; the new wrapper layer relies on the caller to space
requests. <!-- LIVING:RESEARCH(2026-06-30): confirm the RateLimiter in stores/etsy.py reads Etsy's 429 + Retry-After headers, not just a local token bucket. -->

**Vendor docs cite.** Etsy Open API v3 reference —
`https://developers.etsy.com/documentation/reference` (consulted for
endpoint shapes; not reproduced verbatim).

### §2.2 eBay

**Capability namespace.** `ebay/*` (3 verbs wired).

**Wire-call modules.**

- `curator-api/curator_api/stores/ebay.py` — the OAuth-bound EbayClient.
- `curator-api/curator_api/ebay/sell.py:26` — capability wrapper for
  new W6/Wave-5b routes ("the new verb_backings... exposes both
  endpoints; both delegate to" the underlying client).

**Upstream URLs.** `api.ebay.com/sell/inventory/v1`,
`api.ebay.com/sell/account/v1`, `api.ebay.com/buy/browse/v1`.

**Auth.** OAuth 2.0 with refresh tokens. Sandbox uses
`api.sandbox.ebay.com`; the env toggle is documented in the W5b
spec.

**Verb table.**

| Verb | eBay path family | Method | Operator-commit |
|---|---|---|---|
| `ebay/listings` | `sell/inventory/v1/inventory_item` | GET | no |
| `ebay/sold` | `sell/fulfillment/v1/order` (paid filter) | GET | no |
| `ebay/update` | `sell/inventory/v1/inventory_item/{sku}` | PUT | **yes** |

**Surface NOT wired.** Cart corpus declares ~16 additional ebay/*
verbs that are not yet wired (per
`docs/CART-WIREUP-AUDIT-2026-06-30.md`): `ebay/fees`,
`ebay/seller-standards`, `ebay/offer-create`, `ebay/policies`, etc.
Carts that touch them return `service-not-yet-wired`.

**Vendor docs cite.** eBay Sell APIs —
`https://developer.ebay.com/api-docs/sell/static/overview.html`.

### §2.3 Shopify

**Capability namespace.** `shopify/*` (3 verbs wired).

**Wire-call modules.**

- `curator-api/curator_api/stores/shopify.py` — production client.
- `curator-api/curator_api/shopify/client.py` — Wave-5a capability
  dispatcher for Shopify Admin GraphQL 2026-01 + REST.

**Upstream URL.** `https://{shop_domain}/admin/api/2026-01`
(`shopify/client.py:62-64`). Shopify is multi-tenant — each operator's
shop owns its own subdomain (`<shop>.myshopify.com`).

**API version.** `2026-01` (`shopify/client.py:32`). Shopify rolls a
new API version every quarter; we pin to the most recent stable
release at module load time. Migration plan when a new version ships:
update the constant, run the GraphQL schema diff, fix breakers, ship.

**Auth.** OAuth 2.0 with shop-scoped tokens, threaded as
`oauth_token` + `shop_domain` on the ctx (`shopify/client.py:46-59`).
Missing either yields `service-not-yet-wired` with `shopify-not-connected`
or `shopify-shop-domain-missing`.

**Verb table.**

| Verb | Shopify path | Method | Operator-commit |
|---|---|---|---|
| `shopify/products` | GraphQL `products` query | POST GraphQL | no |
| `shopify/orders` | GraphQL `orders` query | POST GraphQL | no |
| `shopify/update` | GraphQL `productUpdate` mutation | POST GraphQL | **yes** |

**Surface declared but NOT wired.** Wave-5a doc-block lists ~28
shopify/* verbs the dispatcher knows about (Functions, Markets, Flow,
ReturnReasonDefinition, orderUpdate.phone, Discount Functions, Cart
Transform Functions, Validation Functions, X-01 inventory firewall
reservation) per `shopify/client.py:1-17`. Carts targeting them
return honest-null.

**Vendor docs cite.** Shopify Admin GraphQL —
`https://shopify.dev/docs/api/admin-graphql/2026-01`.

### §2.4 Printify

**Capability namespace.** `printify/*` (1 verb partially wired —
`printify/products` via stores).

**Wire-call modules.**

- `curator-api/curator_api/printify/client.py` — capability client.
- `curator-api/curator_api/dispatchers/printify_dispatcher.py` —
  cross-marketplace dispatcher hook (publishing to Printify alongside
  Etsy/Shopify).
- `curator-api/curator_api/vendors/printify.py` — Bearer-token shape
  for Printify Public app per `vendors/registry.py:82-86`.

**Upstream URL.** `https://api.printify.com/v1`.

**Auth.** OAuth 2.0 public-app (per `vendors/registry.py:16`).

**Status.** Partial. `printify/products` (cross-store publishing
fan-out) is wired through the `cross_marketplace` module. ~49 other
printify/* verbs (`printify/orders`, `printify/designs`, `printify/blueprints`,
`printify/print-providers`) are declared but unwired — see
`docs/CART-WIREUP-AUDIT-2026-06-30.md:261`.

**Vendor docs cite.** Printify API —
`https://developers.printify.com/`.

### §2.5 Meta

**Capability namespace.** `meta/*` (3 verbs wired, ~27 declared).

**Wire-call modules.**

- `curator-api/curator_api/stores/meta.py` — production MetaClient.
- `curator-api/curator_api/meta/dispatcher.py` — Wave-5c dispatcher
  seam over MetaClient (`meta/dispatcher.py:1-50` lists 27 verbs).

**Upstream URL.** `https://graph.facebook.com/v22.0` (Meta Graph
API).

**Auth.** OAuth 2.0 with long-lived page tokens; the route threads
`oauth_token` + `page_id` (or `business_id`) onto the ctx.

**Verb table (wired).**

| Verb | Graph API path | Method | Operator-commit |
|---|---|---|---|
| `meta/products` | `/{catalog_id}/products` | GET | no |
| `meta/marketplace` | `/{page_id}/marketplace_listings` | GET / POST | varies |
| `meta/orders` (W6) | `/{page_id}/commerce_orders` | GET | no |

**Surface declared but NOT wired** (per `meta/dispatcher.py:1-31`):
`meta/catalog-product-create`, `meta/catalog-product-update`,
`meta/catalog-product-delete`, `meta/catalog-batch`,
`meta/catalog-audit`, `meta/catalog-feed-push`, `meta/catalog-summary`,
`meta/product-set-create`, `meta/product-set-list`, `meta/shop-stats`,
`meta/shop-refund`, `meta/page-post`, `meta/page-roles`,
`meta/page-insights`, `meta/messenger-send` (24h window enforced),
`meta/messenger-template`, `meta/marketplace-listing-create`,
`meta/marketplace-listing-renew`, `meta/marketplace-respond`
(response-rate budget), `meta/lead-form-rows`,
`meta/ads-creative-create`, `meta/ads-audience-create` (lookalike),
`meta/pixel-events`, `meta/webhook-subscribe`,
`meta/app-deprecation-watch`, `meta/business-assets`.

**Rate limit.** Meta enforces Business Use Case (BUC) rate limits per
operator. The dispatcher (`meta/dispatcher.py:38-46`) consults a
per-operator RateLimiter that MetaClient owns; honest rate-limited
envelope `{"ok": False, "error": "rate-limited", "reason":
"meta-rate-limit", "retry_after_s": <float>}` is returned per
`meta/dispatcher.py:73-76`.

**Vendor docs cite.** Meta Graph API —
`https://developers.facebook.com/docs/graph-api`.

### §2.6 Instagram

**Capability namespace.** `instagram/*` (1 verb wired).

**Wire-call module.** `curator-api/curator_api/instagram/dispatcher.py`
(plus `human_agent.py` for the human-handoff workflow).

**Upstream URL.** Instagram Graph API surfaces under
`graph.facebook.com/v22.0/{user_id}` and Instagram Basic Display
`graph.instagram.com`.

**Auth.** OAuth via Meta Business; tokens are scoped to the
Instagram Business Account.

**Verb table.**

| Verb | Path | Method | Operator-commit |
|---|---|---|---|
| `instagram/post` | `/{ig_user_id}/media` + `/media_publish` | POST | **yes** |

**Surface NOT wired.** `instagram/insights` (9 carts blocked),
`instagram/comments` (5), `instagram/container` (3), `instagram/dm`,
`instagram/stories` — per `docs/CART-WIREUP-AUDIT-2026-06-30.md:260`.

**Vendor docs cite.** Instagram Graph API —
`https://developers.facebook.com/docs/instagram-api`.

### §2.7 Google

Google is the broadest vendor surface. Multiple modules under
`curator-api/curator_api/google/` each own a distinct Google API
boundary. The directory has 22 modules per the ls in the project
audit — the ones with active wire-calls are listed below.

| Module | Owns | Capability verbs (Axis 1) | Upstream URL |
|---|---|---|---|
| `google/places.py` | Places (Nearby Search, Place Details) | `places/near-me` (NOT yet wired beyond stub) | `places.googleapis.com/v1` |
| `google/ga4_data.py` + `google/ga4_admin.py` | Google Analytics 4 (Data + Admin) | `analytics/report` (wired) | `analyticsdata.googleapis.com/v1beta` |
| `google/merchant_api.py` + `google/merchant_center.py` | Google Merchant Center API | `google/merchant-feed` · `google/merchant-center` · `google-merchant/*` — **STATUS: NOT WIRED** per W2 audit | `merchantapi.googleapis.com/products/v1beta` |
| `google/gmail.py` | Gmail (read/draft) | Used by `mail/*` template paths (NOT a direct cart verb) | `gmail.googleapis.com/v1` |
| `google/calendar_api.py` | Google Calendar | `cortex/calendar` (local) consults this for upcoming events when wired | `calendar.googleapis.com/v3` |
| `google/drive.py` | Google Drive | (no direct cart verb; used by Cortex artifact persistence) | `www.googleapis.com/drive/v3` |
| `google/sheets.py` | Google Sheets | (no direct cart verb yet) | `sheets.googleapis.com/v4` |
| `google/docs.py` | Google Docs | (no direct cart verb yet) | `docs.googleapis.com/v1` |
| `google/document_ai.py` | Document AI | `documents/parse-invoice` route (W3) | `<region>-documentai.googleapis.com` |
| `google/vision_web.py` | Vision (web detection) | `vision/label` (partial) | `vision.googleapis.com/v1` |
| `google/translate.py` | Cloud Translation | `translate/text` (NOT yet wired) | `translation.googleapis.com/v3` |
| `google/natural_language.py` | Cloud Natural Language | `entity/lookup` (NOT yet wired) | `language.googleapis.com/v1` |
| `google/speech_to_text.py` | Speech-to-Text | backs `voice/transcribe` (W6, indirect via `voice.transcribe`) | `speech.googleapis.com/v1` |
| `google/tts.py` | Text-to-Speech | backs `voice/synthesize` (W6, indirect via `voice.synth`) | `texttospeech.googleapis.com/v1` |
| `google/geocoding.py` | Geocoding | `geo/geocode-address` (NOT yet wired) | `maps.googleapis.com/maps/api/geocode/json` |
| `google/routes.py` | Routes (drive-time) | `routes/drive-time` (NOT yet wired) | `routes.googleapis.com` |
| `google/search_console.py` | Search Console | `seo/queries` (NOT yet wired) | `searchconsole.googleapis.com/v1` |
| `google/knowledge_graph.py` | Knowledge Graph | (internal lookups) | `kgsearch.googleapis.com/v1/entities:search` |
| `google/ads.py` | Google Ads | `ads/insights` route exists but `google.ads` NOT WIRED | `googleads.googleapis.com/v17` |
| `google/recaptcha.py` | reCAPTCHA Enterprise | server-side gating | `recaptchaenterprise.googleapis.com/v1` |
| `google/vertex_ai.py` | Vertex AI | **NOT USED** per W7B Vertex-shift abandonment (see §7) | `<region>-aiplatform.googleapis.com` |

**Auth.** Service-account credentials (JSON key file or workload
identity); OAuth 2.0 for end-user Drive/Sheets/Docs/Gmail/Calendar.
Per-operator credentials live in encrypted Loam state; service-account
keys live in `~/.curator-secrets/` (per `CLAUDE.md` "Memory + secrets").

**Quota.** `google/quota.py` is the centralized quota tracker for
Google API daily caps. <!-- LIVING:RESEARCH(2026-06-30): confirm google/quota.py is consulted by every google/*.py module and not just the Search/Places paths. -->

**Vendor docs cite.** Each module's docstring names its upstream API
reference URL.

### §2.8 Anthropic

**Capability verbs.** `model/deep-reasoning`, `model/workhorse`
(routed through router); `model/batch-anthropic-*` (W7B).

**Wire-call modules.**

- `curator-api/curator_api/_llm.py:438` — `URL = "https://api.anthropic.com/v1/messages"` (the realtime Messages endpoint).
- `curator-api/curator_api/llm_router/batch_anthropic.py` — the
  batch-tier wire-call. `batch_anthropic.py:61` declares
  `_API_BASE = "https://api.anthropic.com/v1/messages/batches"`.
- `curator-api/curator_api/llm_router/direct_clients.py` — the
  realtime direct client used by the router.
- `curator-api/curator_api/llm_router/router.py` — the capability
  router that decides realtime vs batch.

**Upstream URLs.**

| Endpoint | Path |
|---|---|
| Messages (realtime) | `https://api.anthropic.com/v1/messages` |
| Messages Batches | `https://api.anthropic.com/v1/messages/batches` |

**API version header.** `anthropic-version: 2023-06-01`
(`batch_anthropic.py:62`).

**Batch beta header.** `anthropic-beta: message-batches-2024-09-24`
(`batch_anthropic.py:63`).

**Auth.** `x-api-key` header (`batch_anthropic.py:106`). The key is
read from `ANTHROPIC_API_KEY` env var (`batch_anthropic.py:79`); if
unset, `is_configured()` returns False and routes return
honest-null.

**Models in production routing.**

| Verb | Model | Source |
|---|---|---|
| `model/reasoner` (light-purple / Dream) | `claude-sonnet-4-5-20251022` | `batch_anthropic.py:68` `_VERB_TO_MODEL` |
| `model/opus` (deep-purple / Magic) | `claude-opus-4-5-20251022` | `batch_anthropic.py:69` |

The cart corpus calls these via the capability verbs
`model/deep-reasoning`, `model/workhorse`, `sakura/cloud-reason`. The
router resolves capability → model. The model strings are vendor
identifiers and live only in the wire-call modules.

**Operator-commit gate.** Every batch SUBMIT requires
`operator_commit: true` on the ctx (`batch_anthropic.py:39-41`,
`:90-101`). Even at 50% batch discount, a single submit can fan out
to thousands of requests; the operator-commit gate stands.

**Cost.** Batch tier is 50% off realtime per
`docs/WAVE-7B-DIRECT-VENDOR-PARITY-2026-06-29.md:10-17`. The cost
ledger records both tiers; see `LACUNA-TELEMETRY-1.0-ENGINEERING.md §2`.

**Vendor docs cite.** Anthropic API —
`https://docs.anthropic.com/en/api/messages`; Message Batches —
`https://docs.anthropic.com/en/api/creating-message-batches`.

### §2.9 Gemini

**Capability verbs.** `model/workhorse` / `model/fast` may route to
Gemini in mixed-vendor configurations; `model/batch-gemini-*` and
`model/cache-gemini-*` (W7B).

**Wire-call modules.**

- `curator-api/curator_api/_llm.py:674-675` — realtime + streaming
  generateContent URL templates.
- `curator-api/curator_api/llm_router/batch_gemini.py` —
  `_API_BASE = "https://generativelanguage.googleapis.com/v1beta"`
  (`batch_gemini.py:52`).
- `curator-api/curator_api/llm_router/cache_gemini.py` — context
  caching for 75% off cached reads
  (`cache_gemini.py:61`).

**Upstream URLs.**

| Endpoint | Path |
|---|---|
| Generate (realtime) | `https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent` |
| Stream generate | `https://generativelanguage.googleapis.com/v1beta/models/{model}:streamGenerateContent` |
| Batch generate | `https://generativelanguage.googleapis.com/v1beta/models/{model}:batchGenerateContent` |
| Cache (CRUD) | `https://generativelanguage.googleapis.com/v1beta/cachedContents` |

**Crucial distinction (W7B-DIRECT-VENDOR-PARITY).** This is the **AI
Studio direct API** (`generativelanguage.googleapis.com`), NOT the
Vertex AI managed surface (`aiplatform.googleapis.com`). Per W7B 2026-06-29
the Vertex-shift was abandoned; we ship the equivalent economic value
(batch discount, prompt caching) on the direct paths. See §7.

**Auth.** API key as `?key=<API_KEY>` query parameter
(`batch_gemini.py:223,243`). Key env var: `GEMINI_API_KEY` (per
`batch_gemini.py` convention; <!-- LIVING:RESEARCH(2026-06-30): confirm the env var name in `_api_key()` against `cache_gemini.py:_api_key()` to ensure they match. -->).

**Vendor docs cite.** Gemini API —
`https://ai.google.dev/api`; Batch mode —
`https://ai.google.dev/gemini-api/docs/batch-mode`; Context caching —
`https://ai.google.dev/gemini-api/docs/caching`.

### §2.10 Firecrawl

**Capability namespace.** `web/*` (`web/scrape`, `web/search` wired;
`web/extract`, `web/monitor`, `web/batch-scrape`, `web/map`,
`web/agent`, `web/crawl`, `web/crawl-site`, `web/batch-status`,
`web/monitor-create`, `web/map-urls`, `web/interact`,
`web/extract-schema` per `scripts/audit_carts.py:29-34`
`V2_PENDING_VERBS` — these are the v2 surface awaiting wave-up).

Plus `firecrawl/policy-lookup` for marketplace policy doc lookups.

**Wire-call modules.**

- `curator-api/curator_api/firecrawl/client.py` — the thin HTTP
  client. `firecrawl/client.py:42` declares
  `FIRECRAWL_BASE_URL = "https://api.firecrawl.dev"`.
- `curator-api/curator_api/firecrawl/tools.py` — capability functions
  (`scrape`, `search`, `extract`, `crawl`, `map`, ...).
- `curator-api/curator_api/firecrawl/cache.py` — local response cache.
- `curator-api/curator_api/firecrawl/quota.py` — daily-spend budget.

**Upstream URL.** `https://api.firecrawl.dev`.

**Three endpoints currently exercised.** Per `firecrawl/client.py:4-13`:

| Capability | Firecrawl path | Method |
|---|---|---|
| `web/scrape` | `/v1/scrape` | POST |
| `web/search` | `/v1/search` | POST |
| `web/extract` (NOT wired in routes) | `/v1/extract` | POST |

**Auth.** API key resolution per `firecrawl/client.py:13-29`:

1. `FIRECRAWL_API_KEY` env var (preferred).
2. `~/.curator/secrets/firecrawl.json` with `api_key` key (matches
   the LiveKit secrets convention per `firecrawl/client.py:18`).

If neither is set, the module does NOT raise — `firecrawl/tools.py`
returns a structured `not_configured` envelope so the LLM can
gracefully explain.

**Default search whitelist.** Per `firecrawl/client.py:46-58`,
`DEFAULT_SEARCH_SITES` constrains the unsealed search tool to
seller-handbook / community sites: Etsy seller handbook + community,
eBay help + community + developer, Shopify help + community + dev,
Meta business help + developers. The model can override with a custom
list.

**Policy doc roots.** `POLICY_DOC_ROOTS` (`firecrawl/client.py:62-84`)
bounds policy lookups to canonical policy pages per marketplace.

**Memory note.** Per `MEMORY.md` "Firebase ALWAYS means Firecrawl" —
voice-to-text slip; the project's voice transcripts that say
"Firebase" mean Firecrawl.

**Vendor docs cite.** Firecrawl API —
`https://docs.firecrawl.dev/api-reference/introduction`.

### §2.11 Stripe

**Capability verbs.**

| Verb | Status |
|---|---|
| `stripe/dashboard` | **WIRED** (link generator only — `:1803` returns a deeplink, not an API call) |
| `stripe/payouts` | **NOT WIRED** — 17 carts blocked per `docs/CART-WIREUP-AUDIT-2026-06-30.md:274` |

**Wire-call module.** None production today for the API surface;
`stripe/dashboard` is a link generator (`dashboard.stripe.com/<account>`).

**Vendor docs cite.** Stripe Payouts API —
`https://docs.stripe.com/api/payouts`. Adding `stripe/payouts` would
target `POST https://api.stripe.com/v1/payouts` plus `GET /v1/payouts`
list. Per the W7B Magic-tier override (CLAUDE.md 2026-06-23 directive)
gating is academic for now — payment-on flip will make this an
operator-tier-gated surface again.

**Surface gap.** 17 carts (light-purple / Dream tier) wait on
`stripe/payouts` to land. Examples: `1099-prep-annual`,
`accountant-handoff-pack`, `bnpl-conversion-lift`,
`cash-flow-forecast`, `chargeback-evidence-auto`,
`chargeback-submit-auto`, `chargeback-win-rate`, `fee-reduce-optimize`,
`gst-vat-handle`, `loan-readiness-check`, `payment-method-mix-opt`,
`quarterly-est-tax-pay`, `runway-stress-test` (per
`docs/CART-VALIDATION-AUDIT-2026-06-29.md:1584-2215`).

### §2.12 Web search routing

**Background.** Per `CLAUDE.md` 2026-06-14 W01 wire lock — web search
routes through `web/search` + `model/reasoner` (L1) or on-device
Sakura (L0). Perplexity, Pinterest, Reddit, Spotify were
intentionally dropped.

**Today.** `web/search` is backed by `firecrawl/tools.search` (§2.10).
The `firecrawl/client.py:46-58` default whitelist focuses the search
on seller-handbook + community + dev docs so the operator's "ask
about Etsy policy" pattern returns the canonical source, not a SERP
of forum threads.

### §2.13 On-device speech-to-text (Parakeet TDT 0.6B v2)

**Vendor-naming note.** This subsection is inside §2 — the wire-call
boundary — which per `CLAUDE.md` (2026-06-22 lock) is the one place a
vendor/model identifier may be written. "Parakeet" and "NVIDIA" appear
here and nowhere else in the product; every other layer (Scheme,
corpus, UI, TELEMETRY) uses the capability verb `voice/transcribe`.
Do not copy the model string out of this subsection.

**Status — honest, 2026-07-01.** The on-device model is a **LOCKED
design decision** with a **landed-but-unwired** implementation module.
The module exists and is complete; **nothing imports it yet**, so the
live `voice/transcribe` route (§2.12-adjacent table, `verb_backings.py:2365`)
still delegates to `voice/transcribe.py` → Google Speech-to-Text
(`speech.googleapis.com/v1/speech:recognize`, `transcribe.py:30`) or
returns the honest-null `service-not-yet-wired` (`transcribe.py:106`)
when unconfigured. The Parakeet module is the successor path; splicing
it into the route is the remaining wiring task.

<!-- LIVING:TODO(2026-07-01): wire voice.parakeet_stt.transcribe_audio into the voice/transcribe route (verb_backings.py:2375 currently imports voice.transcribe.transcribe). When spliced, flip the §6.1 + §2 wire-table backing columns and drop this marker. -->

**Design rationale (per the L0-STT lock, 2026-06-30).** STT moves
on-device: RTFx > 2000 (≈40× a Whisper baseline), model footprint
≈ 600 MB, top-10 Open ASR leaderboard, $0/min, and — the load-bearing
property — **audio never leaves the device**, which is what makes the
CIPA/BIPA/consent posture defensible. The capability generalizes past
the voice-agent: every text field can carry a mic button because the
transcription cost is local and instant.

**Module.** `curator-api/curator_api/voice/parakeet_stt.py` (359 lines).

| Function | Line | Role |
|---|---|---|
| `_load_parakeet_model()` | `:29` | Loads `nvidia/parakeet-tdt-0.6b-v2`. Tries `transformers` first (`:48`); on ImportError/failure falls back to `nemo_toolkit` (`:69`–`:78`). Caches model + records `_model_load_error` on total failure (`:84`). |
| `_apply_phrase_boosting()` | `:93` | Pure logit re-weighting: raises scores for tokens in `hot_words` (`:115`) so operator-specific vocabulary (shop names, SKUs) transcribes correctly. No-op when `hot_words` empty (`:105`). |
| `_transcribe_with_google_cloud()` | `:128` | **Fallback path only.** Gated by `FALLBACK_STT=google` (checked at `:240`). Uses `speech.SpeechContext(phrases=hot_words, boost=20.0)` (`:153`) for the same phrase-boost intent via the cloud API. |
| `transcribe_audio()` | `:214` | Async entry point. `hot_words` param (`:217`). If the local model is `None` **and** `FALLBACK_STT=google`, delegates to the cloud fallback (`:240`–`:245`); otherwise runs the local model, applying phrase-boosting when `hot_words` present (`:302`–`:304`). |

**Model load order (`:29`).** `transformers` → `nemo_toolkit` →
`_model_load_error`. Two independent loaders because deployment
targets differ: the `transformers` path suits the standard inference
image; `nemo_toolkit` is the NVIDIA-native fallback. If neither imports,
`transcribe_audio` has no local model and the module is inert unless
`FALLBACK_STT=google` is set — an honest degradation, never a silent
success.

**Fallback gating.** The Google cloud path is **opt-in via env var
only** (`FALLBACK_STT=google`). Default deployment has no fallback: if
the on-device model fails to load and no fallback is configured, the
caller gets an explicit error, not a cloud round-trip it didn't
consent to. This preserves the "audio never leaves the device"
guarantee as the default posture.

**Health probe.** `routing/l1_manifest.py:132` `_check_voice_transcribe()`
imports `nemo.collections.asr` (`:135`) to report readiness; the probe
is registered under the `voice-transcribe` capability key (`:60`, `:174`).
The probe intentionally names the capability, not the vendor, in its
manifest key.

**Capability registry.** `verbs/system_capabilities.py:233` exposes
`audio/parakeet` (STT), sibling to `audio/aoede` (TTS) in the same
`audio/*` check block (`:226`). <!-- LIVING:RESEARCH(2026-07-01): system_capabilities.py:233 lists audio/parakeet with tier="L2" — reconcile against the L0-STT lock which places on-device STT at L0. Likely a stale tier tag from before the on-device move; confirm and correct the tier field, not the doc. -->

**Phrase-boosting parity.** Both the local (`_apply_phrase_boosting:93`)
and cloud (`SpeechContext boost=20.0:153`) paths honor the same
`hot_words` contract, so operator vocabulary transcribes identically
regardless of which backend serves the request. This matters for the
"mic button on every field" generalization: a field that knows its
domain (e.g. a SKU field) can pass its known terms as `hot_words`.

---

## §3. OAuth + token model

### §3.1 The credential store

Per-operator OAuth tokens for marketplace vendors (Etsy, eBay,
Shopify, Meta, Instagram, Google) live in
`curator-api/curator_api/vendors/credentials.py` (the CredentialStore).
The store is encrypted at rest via the Cortex crypto module
(`curator-api/curator_api/cortex/cortex_crypto.py`); the key derives
from the operator's session + a per-machine HMAC key.

### §3.2 Service-account credentials

Cross-operator service-account keys (Google Cloud, Stripe, Firecrawl,
Anthropic, Gemini API) live in `~/.curator-secrets/*` with mode 0600
per `CLAUDE.md` "Memory + secrets". Names follow the env-var
convention:

```
~/.curator-secrets/ANTHROPIC_API_KEY
~/.curator-secrets/GEMINI_API_KEY
~/.curator-secrets/FIRECRAWL_API_KEY
~/.curator-secrets/CURATOR_CART_HMAC_KEY
```

The build script (`scripts/build_cart_index.mjs:46-57`,
`loadCartHmacKey`) reads the canonical file path as a fallback when the
env var is unset; per-vendor wire-call modules do the same.

### §3.3 OAuth flow per vendor

| Vendor | Flow | Authorization URL | Token URL | Scope examples |
|---|---|---|---|---|
| Etsy | OAuth 2.0 + PKCE | `https://www.etsy.com/oauth/connect` | `https://api.etsy.com/v3/public/oauth/token` | `listings_r listings_w transactions_r email_r shops_r shops_w` |
| eBay | OAuth 2.0 auth-code | `https://auth.ebay.com/oauth2/authorize` | `https://api.ebay.com/identity/v1/oauth2/token` | `sell.inventory sell.marketing sell.account` |
| Shopify | OAuth 2.0 (shop-scoped) | `https://{shop}.myshopify.com/admin/oauth/authorize` | `https://{shop}.myshopify.com/admin/oauth/access_token` | `read_products write_products read_orders` |
| Printify | OAuth 2.0 | `https://printify.com/oauth/authorize` | (per `vendors/registry.py:85-86`) | `(per Printify API docs)` |
| Meta | OAuth 2.0 + long-lived | `https://www.facebook.com/v22.0/dialog/oauth` | `https://graph.facebook.com/v22.0/oauth/access_token` | `pages_manage_metadata catalog_management commerce_account_read_orders` |
| Instagram | (via Meta Business) | (Meta auth) | (Meta token + IG account link) | `instagram_basic instagram_content_publish` |
| Google | OAuth 2.0 + service-account | `https://accounts.google.com/o/oauth2/v2/auth` | `https://oauth2.googleapis.com/token` | varies per API |

OAuth callbacks land at `/api/oauth/<vendor>/callback`
(`curator-api/curator_api/routes/oauth.py` — <!-- LIVING:RESEARCH(2026-06-30): confirm each vendor's callback path; the oauth.py module owns the dispatch. -->).

### §3.4 Token refresh + rotation

Refresh tokens are stored with the access token. The wire-call modules
detect 401 + refresh-on-need (lazy refresh — no background timer). On
refresh failure, the operator's credential is marked stale and any
verb call returns `service-not-yet-wired` with reason
`<vendor>-token-expired`.

<!-- LIVING:RESEARCH(2026-06-30): audit every store/<vendor>.py for the 401-handling path; confirm the refresh-on-need pattern is uniform vs ad-hoc. -->

### §3.5 The HMAC chain for cart cost

Independent of vendor OAuth, the cart corpus carries an HMAC over
`(slug, cost_tokens)` per cart per `docs/PRICING-TOKEN-DESIGN-2026-06-18.md`.
The signer lives in `curator-api/curator_api/signing.py`; the build
script (`scripts/build_cart_index.mjs:73-99`) calls it as a subprocess.
The dispatcher (`curator-api/curator_api/_layer0.py` and the dispatch
chain) verifies the HMAC on every cart load; a tampered cost field
fails the verify and the cart refuses to run.

This is integration-adjacent — it's the spine that keeps the token
budget honest across the verb-routing layer. The vendor cost ledger
(§ next doc) reads the same secret indirectly via the audit chain.

---

## §4. Rate limiting + back-pressure

### §4.1 Per-vendor rate limit philosophy

Every vendor has its own rate-limit shape (per-second token bucket,
per-day quota, per-operator concurrency cap, per-app fair-share).
Lacuna's wire-call modules implement three layers:

1. **Local token bucket.** Per-operator rate counter inside the store
   client. Prevents accidental burst on the operator's account.
2. **429 + Retry-After honoring.** Every wire-call honors the upstream
   429 and returns a `rate-limited` envelope with the
   `retry_after_s` payload so the cart can re-schedule. Pattern
   visible in `meta/dispatcher.py:73-76`.
3. **Daily-spend cap.** For LLM vendors (Anthropic, Gemini), the cost
   ledger enforces a per-tier daily cap
   (`llm_router/cost_ledger.py:75-82`):

   ```python
   HARD_CAP_USD_PER_TIER = {
       "free":    0.10,
       "imagine": 1.00,
       "dream":  10.00,
       "magic": 100.00,
       "default": 0.10,
   }
   ```

   A request that would breach the cap is rejected with
   `cost-cap-exceeded`. SRE override via
   `CURATOR_COST_HARD_CAP_OVERRIDE_USD` env (intended for testing).

### §4.2 Per-vendor specifics

| Vendor | Rate limit | Override surface |
|---|---|---|
| Etsy v3 | 10 q/s, 10,000/day per app | RateLimiter in `stores/etsy.py` |
| eBay | Per-API per-token-type — varies | RateLimiter in `stores/ebay.py` |
| Shopify | Bucket-leak at 2 q/s (REST), GraphQL credits | RateLimiter in `stores/shopify.py` |
| Meta | Business Use Case (BUC) per operator | `meta/dispatcher.py` consults RateLimiter |
| Instagram | Shared with Meta BUC | (same) |
| Printify | 600 req/minute per shop | <!-- LIVING:RESEARCH(2026-06-30): confirm Printify rate limit configured in printify/client.py --> |
| Anthropic | RPM / TPM per org (tier-scaled) | Router + cost ledger |
| Gemini | RPM / RPD per project (tier-scaled) | Router + cost ledger |
| Firecrawl | Per-API-key quota per month | `firecrawl/quota.py` |
| Google APIs | Per-project quota per API per day | `google/quota.py` |

### §4.3 The back-pressure envelope

Every rate-limited or quota-exceeded response uses the canonical
envelope:

```python
{
  "ok": False,
  "error": "rate-limited",         # or "cost-cap-exceeded"
  "reason": "<vendor>-rate-limit", # or "<vendor>-quota-exceeded"
  "retry_after_s": <float>,        # advisory only
}
```

The cart escalates `'service-not-yet-wired` (per
`SAKURA-SCHEME-1.0-SEALING.md §1.6` escalation kinds) or, when the
cart was explicitly written to handle rate-limit, branches into a
backoff state via `(after retry_after_s 'retry ctx)`.

---

## §5. Error handling per vendor

The pattern is uniform across every wire-call module. Every exception
class maps to a structured envelope; the cart layer reads the envelope
and escalates.

### §5.1 The error envelope canon

```python
{
  "ok": False,
  "error": "<short-class>",     # honest classification
  "reason": "<vendor>-<detail>" # capability-tagged
}
```

Recognized error classes (per `curator-api/curator_api/meta/dispatcher.py:62-82`
+ similar patterns across modules):

| `error` | Meaning |
|---|---|
| `arg-shape` | Cart sent malformed args; cart bug |
| `operator-commit-required` | Write attempted without `operator_commit: true` |
| `service-not-yet-wired` | OAuth missing OR backing not yet shipped OR upstream unreachable |
| `rate-limited` | Upstream 429 OR local bucket exhausted |
| `cost-cap-exceeded` | LLM cost ledger refused |
| `upstream-rejected` | Upstream 4xx not in {429, 401} — surfaced honestly with status |
| `upstream-error` | Upstream 5xx; transient |
| `network-error` | Connection refused / DNS / TLS |

### §5.2 Per-vendor exception mapping

**Etsy.** `etsy/client.py` returns the envelope directly. Auth fail =
`service-not-yet-wired` (`etsy-not-connected`); 4xx = `upstream-rejected`;
5xx = `upstream-error`.

**eBay.** Same pattern.

**Shopify.** Same pattern. GraphQL errors are unwrapped:
`errors[].message` becomes the `reason` if no other classification
applies.

**Meta.** `meta/dispatcher.py:39-46` documents the seven-step
translation: input shape check → operator-commit check → BUC headroom
check → MetaClient call → `NotAuthorized` → `service-not-yet-wired`,
`RateLimited` → `rate-limited`, other upstream error → honest
pass-through.

**Instagram.** Same pattern as Meta.

**Anthropic.** `batch_anthropic.py` honest-null on missing key
(`service-not-yet-wired`); 4xx (other than 429) returns
`upstream-rejected`; 429 returns `rate-limited`; 5xx returns
`upstream-error`. Cost-cap is enforced at the route layer
(`verb_backings.py:436-447`).

**Gemini.** Same shape.

**Firecrawl.** Not-configured returns `not_configured` (a Firecrawl-
specific shape inherited from `firecrawl/tools.py`). The cart-layer
shim normalizes to `service-not-yet-wired`.

**Google.** Each `google/*.py` returns the canonical envelope or
delegates to the standard Google API client which raises typed
exceptions; the wire-call shim catches and translates.

### §5.3 The honest-null discipline (cross-cutting)

Per `CLAUDE.md` "Honest nulls, no fluent-wrong" + sealed protocol
§1.9 — every cart that receives `null` from a verb MUST escalate or
branch explicitly. Silent-success a no-op is prohibited. The
wire-call modules cooperate by returning the structured envelope
above; the cart-side cooperates by inspecting `ok` before treating the
payload as data.

---

## §6. The 13 new route handlers

Per `docs/CART-WIREUP-AUDIT-2026-06-30.md` and Wave-4/5/6 the
following 13 routes were added to `verb_backings.py` on 2026-06-30.
Together they unlocked ~131 carts that had been INFRA-WAITING.

### §6.1 Voice (2 routes)

| Verb | Route line | Backing | Upstream |
|---|---|---|---|
| `voice/transcribe` | `verb_backings.py:2366` | `voice.transcribe.transcribe(ctx)` | Google Speech-to-Text (L1 — tool call, not reasoning per `CLAUDE.md` L1/L2 definition). The on-device Parakeet path (§2.13) is the locked design successor but is not yet spliced into this backing. |
| `voice/synthesize` | `verb_backings.py:2404` | `voice.synth.synthesize(ctx)` | Google TTS |

Both require `operator_commit: true` (W6 task spec). The route layer
injects `operator_commit` from the preamble so the second-wall check
in `voice/transcribe.py` and `voice/synth.py` passes when the Scheme
`with-comms-compliance` macro set it
(`verb_backings.py:2371-2373`).

### §6.2 Mail (5 routes)

| Verb | Route line | Backing | Notes |
|---|---|---|---|
| `mail/dispatch` | `verb_backings.py:2443` | `mail.dispatcher.dispatch(ctx)` | Operator-commit required; upstream SMTP / SES |
| `mail/template` | `verb_backings.py:2478` | `mail.dispatcher.template(ctx)` | Pure render; no wire |
| `mail/draft` | `verb_backings.py:2507` | `mail.dispatcher.draft(ctx)` | Pure render; no wire |
| `mail/with-gifs` | `verb_backings.py:2537` | `mail.dispatcher.with_gifs(ctx)` | Pure render; no wire |
| `mail/unsubscribe` | `verb_backings.py:2579` | `mail.unsubscribe.honor_token` / `.mint_token` | Local signed-token store |

The `mail/dispatcher.py:128` comment names this surface: "public surface
— what verb_backings.py calls into."

### §6.3 Notifications (1 route)

| Verb | Route line | Backing | Notes |
|---|---|---|---|
| `notify/push` | `verb_backings.py:2634` | `push.dispatcher.push(ctx)` | W3C Web Push; operator-commit required |

### §6.4 Etsy orders / inventory / ledger / reprice (4 routes)

| Verb | Route line | Backing | Notes |
|---|---|---|---|
| `etsy/orders` | `verb_backings.py:2678` | `stores.etsy.EtsyClient` orders | Receipts where `was_paid=true` |
| `etsy/inventory` | `verb_backings.py:2725` | `etsy.client` (Wave-5a wrapper) | Listing inventory rows |
| `etsy/ledger` | `verb_backings.py:2770` | `stores.etsy.EtsyClient.list_ledger` | Payment account ledger entries |
| `etsy/reprice` | `verb_backings.py:2815` | `stores.etsy.EtsyClient` price update | Operator-commit required |

### §6.5 Meta orders (1 route)

| Verb | Route line | Backing | Notes |
|---|---|---|---|
| `meta/orders` | `verb_backings.py:2876` | `meta.dispatcher.shop_orders` | Commerce orders endpoint |

Each route follows the same scaffold: parse preamble, audit
"received", inject `operator_commit`, call backing, audit
ok/module-error, return `{trace_id, **result}`. The pattern is the
ONE that gives the cost ledger + audit chain free observability.

### §6.6 World knowledge — the catch-all research-and-learn route

**Route.** `POST /api/verbs/world/knowledge` —
`verbs/world_knowledge.py:117` (`world_knowledge_verb`). Backs the
Scheme verb `(world/knowledge :query X)`. This is the multi-upstream
route: it is where a factual question that the on-device 1.7B savant
cannot answer gets escalated, answered, and — critically — **written
back so Sakura learns**.

**Two backings for the same verb.** The Scheme-runtime L0 stub
(`curator-web/src/scheme/base.js:425`) returns the honest-null
escalator `{ kind: 'escalate', reason: 'service-not-yet-wired' }`. The
real answering happens here in the L1/L2 backend route. The doc-level
truth: L0 knows it does not know; this route is the "then find out"
half.

**Four-step resolution (`world_knowledge.py`).**

| Step | Line(s) | What | Upstream |
|---|---|---|---|
| 1 · Cache recall | `:174` `cortex_client.recall` | Check the operator's `world-knowledge` Cortex topic for a prior answer keyed by `slugify(query)` (`:72`). Hit → return `source="cache"`, no wire-call. | Cortex (L1) |
| 2 · Workhorse | `:209`–`:250` `model_client.generate(tier="L1", capability="workhorse")` | The self-hosted 8B answers from weights. Response parsed by `parse_model_response` (`:81`) into `{answer, confidence}`. | L1 8B round-robin |
| 3 · Escalate | `:261`–`:317` | Fires when `time_sensitive OR confidence < confidence_threshold OR answer is None` (`:261`–`:265`). Runs `web_search_client.search(max_results=5)` (`:272`), builds a 3-source context (`:281`–`:283`), and asks `model_client.generate(tier="L2", capability="reasoner", temperature=0.2)` (`:302`) to synthesize. `source_tier="web_search+model_reasoner"`. | web search + L2 reasoner |
| 4 · Writeback | `:350`–`:363` `cortex_client.store(topic='world-knowledge', …)` | Persists `{query, answer, confidence, source_tier, time_sensitive, retrieved_at}` so the next identical query short-circuits at Step 1. **This is the learning loop.** | Cortex (L1) |

**Vendor-naming.** Every module reference above uses the capability
tier (`model_workhorse`, `model_reasoner`, `web_search`) — no vendor
identifier appears in `world_knowledge.py`. The upstream selection is
the router's job (§2.12 for web search; the L1/L2 model router names
the vendor only at its own wire-call boundary). Correct per the
`CLAUDE.md` 2026-06-22 lock.

**Honest-null discipline.** Two explicit escalate-returns guard the
failure paths: escalation-failed-with-no-prior-answer (`:324`–`:332`)
and final-answer-still-None (`:335`–`:343`). Both return
`{kind:"escalate", reason:"service-not-yet-wired", verb:"world/knowledge"}`
— the same shape the L0 stub emits, so the Scheme runtime handles a
backend miss identically to a not-yet-wired local verb. A Cortex
writeback failure (`:364`–`:366`) is logged but does **not** fail the
request — the operator still gets their answer; only the learning
side-effect is skipped.

**Operator context.** `operator_id` is read from request middleware
(`:32`–`:33` under `world_knowledge_verb`); a missing operator id
returns early rather than writing to a null Cortex namespace.

<!-- LIVING:RESEARCH(2026-07-01): confirm CortexClient.recall/store (clients/cortex_client.py) and WebSearchClient.search (clients/web_search_client.py) are the production clients, not stubs — the world/knowledge learning loop is only real if both round-trip to live Cortex + live search. -->

---

## §7. Vertex-shift note

### §7.1 The original plan

Wave 7 (V1-V16) was originally scoped per
`docs/WAVE-7-VERTEX-V1-V6-2026-06-29.md` to migrate the LLM router
through Google Vertex AI. The promise: consolidated invoicing,
context-cache pricing, regional residency (EU / HIPAA), and a single
managed surface for Anthropic + Gemini + future models.

### §7.2 The pivot

Per `docs/WAVE-7B-DIRECT-VENDOR-PARITY-2026-06-29.md:1-9` (architect
directive 2026-06-29):

> "Architect rescoped per the 2026-06-29 directive — Vertex's GCP
> setup overhead isn't worth our scale today. W7B wires the equivalent
> economic value on the DIRECT vendor paths instead."

The Vertex AI module (`curator-api/curator_api/google/vertex_ai.py`)
remains in the tree for posterity; nothing in the production routing
calls it. The router lands every LLM call on the direct vendor APIs
(`api.anthropic.com`, `generativelanguage.googleapis.com` —
specifically AI Studio, NOT Vertex).

### §7.3 What W7B delivered instead

Four new modules under `curator-api/curator_api/llm_router/`:

- `batch_anthropic.py` — 50% off batch tier direct
- `batch_gemini.py` — 50% off batch tier direct (AI Studio, NOT Vertex)
- `cache_gemini.py` — 75% off cached read after TTL direct
- `cost_ledger.py` — per-vendor consolidated cost ledger (the
  consolidated-invoice equivalent on the direct-vendor path)

Per `docs/WAVE-7B-DIRECT-VENDOR-PARITY-2026-06-29.md:60-67`:

| Module | Tests | File |
|---|---|---|
| `batch_anthropic` | 29 | `tests/test_batch_anthropic_wave7b.py` |
| `batch_gemini` | 27 | `tests/test_batch_gemini_wave7b.py` |
| `cache_gemini` | 30 | `tests/test_cache_gemini_wave7b.py` |
| `cost_ledger` | 26 | `tests/test_cost_ledger_wave7b.py` |
| **Total** | 112 | (220/220 LLM tests pass) |

### §7.4 The carts that "wait on Vertex"

Per `docs/CART-VALIDATION-AUDIT-2026-06-29.md:1331` — 237 carts
classified as WIRES-AFTER-VERTEX use `model/deep-reasoning` or
`model/workhorse` on a non-realtime cadence (weekly/monthly/quarterly/
biweekly). They **work today on direct vendor** because both verbs
have backing routes. The "Vertex shift" label was a cost-reduction
candidate, not a correctness gate. The W7B batch tier delivers the
same cost reduction on the direct path; the carts now benefit
without any cart-side change.

### §7.5 EU residency / HIPAA

The features Vertex would have offered (EU residency, HIPAA-eligible
managed surface) are not delivered by W7B. They remain open. The path
forward when needed: route specific operator IDs to a Vertex-managed
deployment via the router config, keeping the direct path as default.
<!-- LIVING:RESEARCH(2026-06-30): document the proposed dual-route fallback for the day EU residency becomes a customer ask. -->

---

## §8. The W2-§4 namespace blocks

Per `docs/CART-CANON-2026-06-30.md:1121,1219` — three verb-namespace
blocks needed architect resolution before sealing. All three are
resolved as of 2026-06-30 and documented inline below.

### §8.1 `documents/*` resolution

**Decision.** `documents/parse-invoice` (W3) routes through Google
Document AI per `google/document_ai.py`. The broader `documents/parse`
verb (113 carts blocked per the leverage table) lands in a future
wave behind the same module — Document AI's invoice processor is
the floor.

**Rationale.** Document AI is the only general-purpose document
parsing API with structured output for invoice / receipt / W-2 / form
shapes. The cart corpus is dominated by Etsy receipts + supplier
invoices; Document AI's invoice processor covers both.

**Status.** `documents/parse-invoice` route exists at
`verb_backings.py:1286` but the underlying `google/document_ai.py`
module is partial — the cart returns honest-null on most inputs.
**NOT WIRED.** Surfaced as `service-not-yet-wired`.

### §8.2 `analytics/*` resolution

**Decision.** `analytics/report` (W3) routes through GA4 via
`google/ga4_data.py`. The broader `analytics/ga4` namespace (2 carts
blocked) lands in a follow-up wave.

**Rationale.** GA4 is the operator's canonical analytics surface for
their own store traffic. The report shape is opinionated (sessions /
conversions / source-medium / event count) so the cart layer can
read it without per-operator schema chase.

**Status.** Route exists at `verb_backings.py:1646`; the
`google/ga4_data.py` module is wired against the GA4 Data API. <!--
LIVING:RESEARCH(2026-06-30): confirm GA4 module pulls live data
end-to-end with a real GA4 property; could be in degraded path today.
-->

### §8.3 `ads/*` resolution

**Decision.** `ads/insights` (W3) routes through Google Ads via
`google/ads.py`. Reuse the operator's existing Google ad account
credentials.

**Rationale.** Google Ads insights are the highest-leverage paid-ads
signal for the cart corpus (the alternative — Meta Ads insights —
goes through the existing `meta/*` surface).

**Status.** Route exists at `verb_backings.py:1779`; `google/ads.py`
is partial. **NOT WIRED.** Surfaced as `service-not-yet-wired`.

---

## §9. LIVING:RESEARCH

Open uncertainties for future passes:

<!-- LIVING:RESEARCH(2026-06-30): RateLimiter in stores/etsy.py — does it honor Etsy's 429 + Retry-After, or only a local token bucket? -->

<!-- LIVING:RESEARCH(2026-06-30): google/quota.py — confirm every google/*.py consults it; some may bypass for tests. -->

<!-- LIVING:RESEARCH(2026-06-30): batch_gemini env var name vs cache_gemini env var name — confirm both read GEMINI_API_KEY (or a common variant). -->

<!-- LIVING:RESEARCH(2026-06-30): OAuth callback paths under routes/oauth.py — enumerate each vendor's callback URL. -->

<!-- LIVING:RESEARCH(2026-06-30): per-vendor 401 + refresh-on-need path — confirm uniform across stores/*.py. -->

<!-- LIVING:RESEARCH(2026-06-30): Printify rate-limit config in printify/client.py — confirm 600 req/min figure. -->

<!-- LIVING:RESEARCH(2026-06-30): document GA4 module live-data verification (currently could be in degraded path). -->

<!-- LIVING:RESEARCH(2026-06-30): dual-route fallback design for EU residency / HIPAA when needed. -->

<!-- LIVING:RESEARCH(2026-06-30): stripe/payouts wire-call wave plan + scope (17 carts wait). -->

<!-- LIVING:RESEARCH(2026-06-30): catalog the 13 firecrawl v2 verbs (V2_PENDING_VERBS) per cart-side need; some may be dead and can be lint-killed. -->

*[needs: explicit per-vendor secret-rotation schedule]*

*[needs: webhook subscription map — which vendors push events to us]*

*[needs: vendor-status page integration for SRE dashboard]*

---

## §10. References

### §10.1 Internal references

- `curator-api/curator_api/routes/verb_backings.py` — HTTP routes
  (2,901 lines as of 2026-06-30)
- `curator-api/curator_api/llm_router/router.py` — capability →
  vendor routing
- `curator-api/curator_api/llm_router/batch_anthropic.py` — Anthropic
  batch wire-call
- `curator-api/curator_api/llm_router/batch_gemini.py` — Gemini batch
  wire-call
- `curator-api/curator_api/llm_router/cache_gemini.py` — Gemini cache
  wire-call
- `curator-api/curator_api/llm_router/cost_ledger.py` — per-vendor
  cost ledger
- `curator-api/curator_api/_llm.py` — direct LLM client (legacy +
  routing endpoints)
- `curator-api/curator_api/stores/{etsy,ebay,shopify,meta}.py` —
  marketplace clients
- `curator-api/curator_api/etsy/client.py` — Etsy capability wrapper
- `curator-api/curator_api/shopify/client.py` — Shopify GraphQL
  dispatcher
- `curator-api/curator_api/meta/dispatcher.py` — Meta capability
  dispatcher
- `curator-api/curator_api/instagram/dispatcher.py` — Instagram
  dispatcher
- `curator-api/curator_api/google/*.py` — 22 Google API modules
- `curator-api/curator_api/firecrawl/client.py` — Firecrawl client
- `curator-api/curator_api/printify/client.py` — Printify client
- `curator-api/curator_api/dispatchers/printify_dispatcher.py` —
  cross-marketplace Printify hook
- `curator-api/curator_api/vendors/` — vendor registry + per-vendor
  shape stubs
- `curator-api/curator_api/voice/{transcribe,synth}.py` — voice
  backings
- `curator-api/curator_api/mail/dispatcher.py` — mail dispatcher
- `curator-api/curator_api/push/dispatcher.py` — push dispatcher
- `curator-api/curator_api/preamble.py` — preamble envelope parsing
- `curator-web/src/scheme/registry/VerbRegistry.js` — verb registry
- `scripts/build_cart_index.mjs:294-363` — WIRED_VERBS set
- `scripts/audit_carts.py:15-62` — wired / pending / infra-waiting
  classification

### §10.2 Related canonical docs

- `docs/HELLO-SURFACE-1.0-ENGINEERING.md` — substrate
- `docs/SAKURA-SCHEME-1.0-ENGINEERING.md` — runtime engineering
- `docs/SAKURA-SCHEME-1.0-REFERENCE.md` — verb catalog
- `docs/SAKURA-AUTOMATIONS-1.0.md` — cart catalog
- `docs/LOAM-1.0-ENGINEERING.md` — substrate database
- `docs/SAKURA-TRAINING-MANUAL-1.0-ENGINEERING.md` — training
- `docs/LACUNA-TELEMETRY-1.0-ENGINEERING.md` — instrumentation
- `docs/SAKURA-SCHEME-1.0-SEALING.md` — sealing protocol

### §10.3 Wave + audit docs (derivative — useful for archaeology)

- `docs/CART-WIREUP-AUDIT-2026-06-30.md` — wire-up audit
- `docs/CART-VALIDATION-AUDIT-2026-06-29.md` — cart validation classes
- `docs/WAVE-4-WIRE-CALLS-2026-06-29.md` — W4 specs
- `docs/WAVE-5a-ETSY-SHOPIFY-BACKINGS-2026-06-29.md`
- `docs/WAVE-5b-EBAY-PRINTIFY-BACKINGS-2026-06-29.md`
- `docs/WAVE-5c-META-INSTAGRAM-BACKINGS-2026-06-29.md`
- `docs/WAVE-6-GOOGLE-MERCHANT-MIGRATION-2026-06-29.md`
- `docs/WAVE-7B-DIRECT-VENDOR-PARITY-2026-06-29.md`
- `docs/PREAMBLE-ENVELOPE-DESIGN-2026-06-15.md`
- `docs/CART-CANON-2026-06-30.md` — §4 namespace block resolutions
- `docs/PRICING-TOKEN-DESIGN-2026-06-18.md` — token model + HMAC

### §10.4 External references (vendor docs)

- Etsy Open API v3 — `https://developers.etsy.com/documentation/reference`
- eBay Sell APIs — `https://developer.ebay.com/api-docs/sell/static/overview.html`
- Shopify Admin GraphQL — `https://shopify.dev/docs/api/admin-graphql/2026-01`
- Printify API — `https://developers.printify.com/`
- Meta Graph API — `https://developers.facebook.com/docs/graph-api`
- Instagram Graph API — `https://developers.facebook.com/docs/instagram-api`
- Google APIs — `https://developers.google.com/apis-explorer`
- Anthropic API — `https://docs.anthropic.com/en/api/messages`
- Anthropic Message Batches — `https://docs.anthropic.com/en/api/creating-message-batches`
- Gemini API — `https://ai.google.dev/api`
- Gemini Batch mode — `https://ai.google.dev/gemini-api/docs/batch-mode`
- Gemini Context caching — `https://ai.google.dev/gemini-api/docs/caching`
- Firecrawl API — `https://docs.firecrawl.dev/api-reference/introduction`
- Stripe Payouts API — `https://docs.stripe.com/api/payouts`
- Document AI — `https://cloud.google.com/document-ai/docs`
- GA4 Data API — `https://developers.google.com/analytics/devguides/reporting/data/v1`
- Google Ads API — `https://developers.google.com/google-ads/api/docs/start`

---

*End of LACUNA-INTEGRATION-1.0-ENGINEERING.md.*
*Document version: 1.0.1-draft · 2026-07-03 · Subject to LIVING:RESEARCH closure per §9.*


---

# §FC-ROUTES — Firecrawl-family expanded routes (added 2026-07-11 from recovery lane)

The 2026-06-29 recovery-lane docs describe 9 web/* verbs Sakura now uses; each maps to a Firecrawl-family route. Vendor names appear nowhere; capability verbs only. The vendor firewall (`lacuna-docs/canon/llm-naming-canon.md`) hides the underlying provider.

| Capability verb | Route intent | K-anon / safety |
|---|---|---|
| `web/search` | Vendor-firewalled web search; returns URLs + snippets | Per-op rate limit |
| `documents/parse` | Parse a PDF/DOCX from URL or upload | Sanitize on upload |
| `web/extract-schema` | LLM-guided schema extraction from URL | Domain allowlist |
| `web/monitor` | Subscription: watch URL, fire event on diff | Per-op quota |
| `web/crawl-site` | Bounded site crawl (max-pages cap) | Domain allowlist + max-pages required |
| `web/agent` | LLM-directed browsing (goal, not URL) | Domain allowlist + max-steps required + Priya audit |
| `web/map-urls` | Return the URL-graph of a site | Domain allowlist |
| `web/interact` | Click / fill / submit on a page | Domain allowlist + confirm-gate on writes |
| `web/batch-scrape` | Parallel scrape of URL list | Per-op quota |

Full use-case survey is in the recovery-lane FIRECRAWL-* docs; they move to `_archive-2026-07-11/lacuna-integration/` during archive pass.

## Capability → vendor mapping for the 9 new verbs

Marcus + Priya locked the vendor mapping 2026-06-29; the LLM-naming canon (`llm-naming-canon.md`) is the reference. Every crossing carries the Priya audit note "domain allowlist enforced at verb-registration time" per `SAKURA-AUTOMATIONS-1.0.ENG.md` §E2 audit.

---

# §SLAT — Cross-system messages on the SLAT wire (added 2026-07-12)

> Cross-refs: `~/code/lacuna-labs/research/lacuna-docs/specs/SLAT-1.0.SPEC.md`, `LOAM-1.0.ENG.md §SLAT`, `CORTEX-1.0.ENG.md §SLAT`, `SECURITY-CANONICAL-1.0.ENG.md §SLAT`. Task #62 landed the ENG-tree surface pass; this section threads SLAT through the integration contract, wire-call envelopes, OAuth capability tokens, rate-limit envelopes, and error envelopes. Additive to §0-§7; no deletes.

## §SLAT.1 — Doctrine

Integration is the discipline of speaking to systems Lacuna does not own. The vendor speaks its own protocol; the vendor-firewall (§0.2) translates that into Lacuna's capability verbs; the capability verbs consume and produce SLAT records. Every message crossing the integration seam is a slat.

The load-bearing property: cross-system messages have the same shape as intra-system messages. Foreman-to-worker (intra-Lacuna) is a `message` slat. Sakura-to-Etsy (extra-Lacuna, through the vendor-firewall) is a `message` slat whose `:to` field names the capability verb, whose `:detail` is the vendor-neutral operation, and whose signed envelope carries the OAuth capability that authorizes the call.

## §SLAT.2 — Mailbox envelopes are `.slatl`

Worker mailboxes live at `~/.lacuna/mailboxes/<name>.slatl` (SLAT §5.8 migration path). One message per line. Producers append; consumers tail. Every line is a `message` slat:

```slat
(message
  :v      1
  :from   'foreman
  :to     'worker/mlx-1
  :ts     #inst "2026-07-12T04:22:00Z"
  :detail (start-training-run
            :seed 4137
            :adapters "adapters.safetensors"
            :max-iter 68520))
```

Malformed lines produce `_bad-line` sentinels (SLAT §5.3 tolerant mode) — the mailbox never blocks on a parse failure. Consumers that don't recognize the head symbol on `:detail` treat it as a generic record and pass it forward.

Backward compat: mailboxes accept JSON lines during the migration window. Reader tries SLAT first, JSON second, emits a deprecation warning on the JSON path (SLAT §10.4 timeline).

## §SLAT.3 — Vendor wire-call envelopes are `record` slats

§2 walks the per-vendor modules. Each module hides a vendor API behind a capability verb. Wire-call responses fit the `record` slat shape:

```slat
(record
  :kind        'etsy-listing-response
  :listing-id  "1234567890"
  :title       "Vintage Cherry Blossom Print"
  :price-cents 3400
  :currency    "USD"
  :quantity    3
  :updated-at  #inst "2026-07-12T04:20:00Z")
```

The vendor's raw JSON never crosses the firewall in that shape — the wire-call shim reads the vendor JSON and emits a canonical slat record. Downstream — cart code, Cortex writes, telemetry — sees the slat, not the vendor JSON. Vendor swaps become adapter changes; nothing above the firewall notices.

Money fields use `bigdecimal` (`M`-suffix per SLAT §3.3) because money is not a vector (memory `money_book_conversion_and_grounding_2026_07_04`). Currency stays typed on the field name, not on the value.

## §SLAT.4 — OAuth + capability envelopes

§3 describes the OAuth model. Every wire call carries a capability token; the token is a signed slat (SLAT §6.5):

```slat
(capability
  :grants     (:read  "etsy/listings/*"
               :write "etsy/listings/1234567890")
  :subject    "operator/op-042"
  :issuer     "lacuna-vendor-firewall"
  :vendor     'etsy
  :not-before #inst "2026-07-12T00:00:00Z"
  :not-after  #inst "2026-07-12T23:59:59Z"
  :nonce      #b64 "…")
```

Wrapped in `(signed :body <capability> :signature <ed25519> …)`. The vendor-firewall verifies the signature, checks `:vendor`, matches `:grants` against the call, then translates to the vendor's OAuth headers. Rogue calls fail signature verification before any vendor API is touched.

The HMAC chain for cart cost (§3.5) uses the same signed-slat pattern; each stage's HMAC is one signature; the chain of envelopes is a Merkle tree per SLAT §6.7.

## §SLAT.5 — Rate-limit + back-pressure envelopes

§4 covers rate limiting. When the vendor-firewall throttles a call, the response envelope carries a `record` slat with the rate-limit context:

```slat
(record
  :kind        'rate-limit-hit
  :vendor      'etsy
  :verb        'etsy/listing-update
  :remaining   0
  :reset-at    #inst "2026-07-12T04:30:00Z"
  :backoff-ms  8000
  :suggestion  'defer-and-retry)
```

Consumers pattern-match on `:kind rate-limit-hit` and enter the back-pressure envelope path (§4.3). Deferred work uses SLAT §3.8 reserved `#_pending` tag on the deferred body — see CORTEX §SLAT.8 for the same shape at the storage layer.

## §SLAT.6 — Error envelopes use the reserved `#_error` tag

§5 covers error handling. Every vendor error crosses the firewall as a slat with the reserved `#_error` tag (SLAT §3.8):

```slat
#_error
  (error
    :vendor      'etsy
    :verb        'etsy/listing-update
    :code        403
    :vendor-code "OAUTH_INVALID_SCOPE"
    :capability-canon 'insufficient-scope
    :recoverable #f
    :ts          #inst "2026-07-12T04:22:00Z")
```

The reserved-tag shape means downstream consumers can distinguish a real record from an error record with one lexical check. `#_error` (SLAT §3.8) is one of the four reserved diagnostic tags; it MUST be honored by any consumer.

`:capability-canon` normalizes the vendor's error code to the Lacuna capability-error taxonomy (§5.1 error envelope canon). Vendor-specific `:vendor-code` stays available for audit but downstream logic uses the canonical form.

## §SLAT.7 — Cross-refs

- SLAT primitives — `SLAT-1.0.SPEC.md §3`
- Mailbox migration to `.slatl` — `SLAT-1.0.SPEC.md §5.8`
- Signing envelope — `SLAT-1.0.SPEC.md §6.2`
- Capability tokens — `SLAT-1.0.SPEC.md §6.5`
- Reserved tags (`#_error`, `#_pending`) — `SLAT-1.0.SPEC.md §3.8`
- Merkle attestation over signed chain — `SLAT-1.0.SPEC.md §6.7`
- Loam ingest of integration events — `LOAM-1.0.ENG.md §SLAT`
- SECURITY-CANONICAL — signed envelopes + capability posture
- TELEMETRY-MEDIAN §SLAT — cost row schema uses the `record` slat form above


