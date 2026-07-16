---
slug: security-canonical-1.0-eng
title: Security Canonical — Engineering
category: engineering
canonical: true
version: 1.0
last-reviewed: 2026-07-11
covers-through: 2026-07-11
owner: Priya (security lead)
codename: security-canonical
supersedes:
  - lacuna-labs/research/curator/SECURITY-CANONICAL.md (2026-06-15, still living — this canonical supersedes it for the sakura-scheme world)
  - curator/docs/SECURITY-CANONICAL.md (symlink to above)
priya-scope: sandbox, capability, taint, audit, keys, at-rest encryption, secret redaction, hallucination-refuse mode, HelloSurface client-side trust boundary
cross-references:
  - HELLO-SURFACE-1.0.ENG.md §132 (client-side trust boundary)
  - LACUNA-INTEGRATION-1.0.ENG.md §FC-ROUTES (vendor firewall)
  - SAKURA-AUTOMATIONS-1.0.ENG.md §E1/§E2 audit notes
---

<!-- covers-through: 2026-07-11 -->

# Security Canonical 1.0 — Engineering

> **Canonical engineering doc #8 of 12** per `docs-consolidation-plan-2026-07-11.md`. Refreshed 2026-07-11. Base substance below is the 2026-06-15 Priya-authored security manual; header + fold notes above are the 2026-07-11 refresh seal.

## §NEW 2026-07-11 — 20 Priya security features (elevated from language-features roundup)

1. **Sandboxed eval** — every Scheme evaluation runs inside a capability-gated sandbox; no ambient authority.
2. **Capability-scoped perms** — every verb call carries an explicit capability token; runtime denies calls the token doesn't authorize.
3. **Taint tracking** — data provenance travels with values; sinks refuse tainted inputs unless the sink is annotated `:accept-taint`.
4. **Signed carts + SBOM** — every deployable cart carries a signature + a Software Bill of Materials for its verb dependencies.
5. **At-rest encryption** — Loam DB, Cortex vectors, and Sakura's local model shards are all encrypted at rest.
6. **Secret redaction** — logs, telemetry, and error traces run through a redactor that catches API-key-shaped strings, PII patterns, and operator-marked secrets.
7. **Hallucination-refuse mode** — Sakura's L1/L2 escalations carry a "refuse-if-unsure" flag; low-confidence answers become "I don't know" instead of guesses.
8. **Vendor-firewall** — all vendor names are hidden behind capability verbs (see `llm-naming-canon.md`); operators never see the vendor.
9. **K-anonymity K≥50** — cohort-aggregate queries reject <50-shop cohorts to prevent single-shop deanonymization.
10. **Per-operator capability grants** — every wire call carries a per-op grant; the grant is revocable.
11. **Domain allowlist for web/*** — every `web/agent`, `web/interact`, `web/crawl-site` call MUST specify a domain allowlist enforced at verb-registration time.
12. **Max-steps / max-pages caps** — agent-family verbs require an explicit iteration cap.
13. **Confirm-gate on writes** — `web/interact` writes (form submits, purchase clicks) require an operator confirm before firing.
14. **Rate limits per capability** — every verb carries a per-op rate limit; excess triggers backoff, then refuse.
15. **Audit log immutability** — cart invocation logs write to an append-only ledger (Loam WAL + hash chain).
16. **Key rotation** — vendor keys rotate on a schedule; runtime supports zero-downtime rotation.
17. **AAIF for MCP** — new MCP surfaces use the Agent Authentication + Introspection Framework; older MCP receives AAIF adapters.
18. **Client-side trust boundary (HelloSurface §132)** — browser never has raw operator secrets or vendor keys or K<50 data.
19. **Safe Mode #277** — global switch that puts Sakura in read-only + refuse-writes mode until explicitly re-enabled.
20. **Adversarial protocol** — Priya's public-flag + peer + architect vote on all cross-lead work (see canonical memory `lacuna-engineering-team-canonical-2026-07-11`).

## §NEW 2026-07-11 — HelloSurface Client-Side Trust Boundary (§132 mirror)

Mirrored from `HELLO-SURFACE-1.0.ENG.md §132`:
- Client renders artifacts + cards + sprites + Sakura chat surface.
- Client NEVER has raw operator secrets, vendor keys, or K<50 cohort data.
- Every wire crossing is a signed cart invocation.

## §NEW 2026-07-11 — Priya audit of the 367 recovered automations

Every automation folded into `SAKURA-AUTOMATIONS-1.0.ENG.md` §E1 and §E2 was reviewed 2026-07-11:
- **§E1 (210 automations):** PASS. No `eval` of untrusted input, no shell interpolation, no unbounded loops, no unsigned network wire-calls. All use vendor-firewalled capability verbs.
- **§E2 (157 automations):** PASS with note. `web/agent` and `web/interact` require domain allowlist + max-page cap; recovered automations comply; enforce at verb-registration time.

## Base substance — 2026-06-15 canonical below

The rest of this document is the 2026-06-15 Priya-authored security canonical, unchanged in substance but refreshed with the front-matter above. Full content preserved from `~/code/lacuna-labs/research/curator/SECURITY-CANONICAL.md`.

---

# Security — Curator, Sakura, Cortex, Engram

**Status:** Living document. Last revision 2026-07-03 (drift pass against
HEAD `d4f5a8a4`; core Wave-1 / Wave-2 findings last audited 2026-06-13).
**Scope:** Cross-product engineering manual. Covers the Curator web app
(`curator-web/`), the FastAPI backend (`curator-api/`), the on-device
Sakura runtime, the Cortex memory graph (shim + Rust), and the Engram
replica layer.

This is a technical reference. It names symbols, files, and threats.
Where a control is real and shipping it says so; where a control is
designed but not yet wired it says so out loud. The honesty gate is the
point — every claim here is a claim a regulator, a customer, or a court
should be able to take at face value, and the inverse claim ("this is
not yet true") is what saves us from a sue-able promise.

Sister document: HelloSurface-specific posture lives in
[`HELLO-SURFACE-1.0-ENGINEERING.md`](https://github.com/Lacuna-Labs/curator/blob/main/docs/HELLO-SURFACE-1.0-ENGINEERING.md)
Part XVI. This document is the broader manual; HS-1.0 is the surface
view.

---

## 1. Introduction and threat model

### 1.1 What we protect

| Asset | Where it lives | Why it matters |
|---|---|---|
| Operator-authored free text — chat words, memos, notes, listing writeups, message bodies | Cortex graph (shim + Rust), Engram replica when wired, browser `localStorage` | The whole product is a memory product. Operators trust us with what they typed. |
| Operator identity | Session cookie, per-operator Cortex partition, `account_id` on every node | Cross-operator leakage is the IDOR class — historically the largest single source of incidents. |
| Vendor credentials — Etsy / Shopify / eBay / Meta OAuth tokens + webhook secrets | Per-operator credential store under `~/.curator/`, AES-256-GCM at rest | A leaked token lets an attacker post on the operator's storefront in their name; an HMAC bypass on a webhook lets an attacker forge sales. |
| Cortex master key | Today: env var `CURATOR_CORTEX_KEY` on the server. Future: device OS keystore. | The key unlocks everything sealed under it. This is the load-bearing residual — see §3.5. |
| Sakura's audit record | `chipSink`, `logbus`, Cortex audit nodes, Sentry mirror | After the fact, the audit record is the only thing that tells us what happened. Corrupting it is its own attack. |
| Billing identity + Stripe webhooks | `stripe_billing` route | A forged sale-event writes to a financial ledger. |

### 1.2 Who we're protecting it from

Listed roughly in order of expected attack frequency.

1. **A signed-in beta operator** poking at the routes of another signed-in beta operator. The IDOR class. Today this is the most likely real attacker — the beta cohort shares a deployment and the operators know each other.
2. **A casual cross-site adversary** — a malicious page that wants to forge a request to the curator origin via the operator's cookie, embed our content in a clickjack frame, or rebind a click on a provenance link.
3. **A token holder** — someone who has obtained an internal bearer token, a leaked vendor secret, or a webhook secret and wants to forge a writeback (a sale, a comment, a connection).
4. **A network adversary on the operator's path** — coffee-shop Wi-Fi, hostile DNS resolver, ISP intermediary attempting MITM, SSL strip on first visit, or DNS rebinding mid-stream.
5. **A compromised process or host** — a Fly machine takeover, a poisoned restore from backup, a co-tenant on a shared volume. The threat model the at-rest seal exists to mitigate.
6. **A regulator or auditor** — not an attacker but the third reader of every claim in customer copy. A false claim is its own kind of incident.

We deliberately do **not** model:

- A device-keystore-resident attacker on the operator's own device. Once the device is owned, the operator's content is gone; we do not promise otherwise.
- A nation-state with offensive cryptanalysis. AES-256-GCM, HMAC-SHA-256, and TLS 1.3 are the tools; we trust them at the published strength.

### 1.3 The four attacker personas

The threat-model section above lists six broad categories. The
four highest-frequency in expected practice are worth a deeper
treatment.

**Persona A — the curious co-operator.** A signed-in beta operator
who notices that `/api/listings/123` works and starts incrementing
the id. The IDOR class. The mitigation is structural per-operator
isolation (§2.1, §4.1). The detection signal is a 403
`operator_mismatch` rate spike on an authenticated route. The
remediation is the standing migration of legacy shared-table routes
to per-store paths (§11.2).

**Persona B — the malicious cross-site page.** A page on the
operator's other browser tabs runs a script that posts to the
curator origin via the operator's cookie. CSRF, clickjacking, and
the related family. The mitigation is the CSP `frame-ancestors
'none'` plus `X-Frame-Options: DENY` (no embedding), the
session-cookie `SameSite=Lax` policy (no cross-site cookie ride),
the COOP `same-origin` header (no `window.opener` side channel),
and the `Referrer-Policy: strict-origin-when-cross-origin` (no
operator path leak). Detection: CSP violation reports. Remediation:
tighten the policy directive that fired.

**Persona C — the bearer-token holder.** Someone who has obtained
the internal bearer (`CURATOR_BOT_TOKEN`,
`CURATOR_STORE_WEBHOOK_TOKEN`, `CURATOR_ADMIN_TOKEN`) and wants to
ride it into a privileged surface. The mitigation is per-token
identity gating (the bot bypass has no operator identity per §2.2),
body-derived attribution on webhook bearer paths (FINAL-016), and
fresh-session requirements on admin operations. Detection: a bearer
use from an unexpected source IP or at an unexpected cadence.
Remediation: rotate the secret and audit the recent use log.

**Persona D — the network adversary.** Coffee-shop Wi-Fi, hostile
DNS, ISP intermediary. The mitigation is HSTS with preload (no
first-visit SSL strip), DNS-pinning on the audio proxy (§5.7),
TLS 1.3 with certificate pinning at the API gateway, and the
Sentry-self-host posture (no third-party error capture sees plain
data). Detection: an HSTS violation report from the browser; a
TLS handshake failure rate spike. Remediation: rotate any
intercepted credential and force re-authentication.

The four personas cover roughly 90 percent of expected attack
volume. The remaining 10 percent — host compromise, supply chain,
insider — is treated in §11 and §12.

### 1.4 The honesty gate

Every operator-facing claim has to pass the honesty gate. The standing
rule is `[[no-false-product-claims]]`: marketing or canon copy that
says "zero-knowledge", "we cannot read your data", "encrypted at rest
the server can't open", "HMAC-signed", "interpreter exploit cannot
reach the DOM", or anything similar must EITHER (a) be true today, or
(b) be reworded to current tense until the wiring lands. The
provisional weaker claim "encrypted at rest" is the floor we ship; the
stronger claims wait.

This is not a stylistic preference. False product claims have legal
consequences. The honesty gate is also the reason this document
exists: a single canonical source the engineering team can point at
when marketing reaches for stronger language.

---

## 2. Identity and session

The identity contract is the load-bearing piece. Every other control —
encryption, ownership, the audit record — assumes a correctly attributed
operator. Get this wrong and every claim downstream is wrong.

### 2.1 The session-bound `operator_id`

The single source of truth for "who is the calling operator" on every
authenticated route is
[`current_operator_id`](https://github.com/Lacuna-Labs/curator/blob/main/curator-api/curator_api/_session.py)
in `curator-api/curator_api/_session.py`.

The contract:

```
operator_id = current_operator_id(request)   # session-bound
```

The session cookie is the only authority. `body.operator_id`,
`?operator_id=…`, `X-Operator-Id` headers, and similar wire-supplied
identity claims are all ignored. The session cookie is verified in
`_beta_gate.beta_gate_middleware`, which stamps
`request.state.account_id`. `current_operator_id` reads only from that
stamp.

Two documented exceptions:

1. **OAuth callbacks** ([`routes/oauth.py:oauth_callback`](https://github.com/Lacuna-Labs/curator/blob/main/curator-api/curator_api/routes/oauth.py)). These run before the session cookie is established for the new connection, so they read `operator_id` from a server-side PKCE state payload that the same process issued. Verified clean in Wave-1 (FINAL-062).
2. **Admin routes.** `request.state.is_admin` is the only flag that permits cross-operator behavior, and every admin code path carries a `# TODO(idor-deferred):` comment so the next audit can find them.

The IDOR class — `body.operator_id`-trusting routes — was the largest
single class of bug we have ever closed. The Wave-1 sweep landed
[`FINAL-005`](https://github.com/Lacuna-Labs/curator/blob/main/curator-api/curator_api/routes/bugs.py),
the bugs-route ownership fix; the Wave-2 follow-up (`b5fbb3a`) closed
the remaining ownership dimension. The dead `operator_id` body fields
are tracked as FINAL-025 — they are not read, but they are the schema
contract a future regression would re-read, so they get stripped.

### 2.2 The bot bypass

The Caliper / pre-prod test bot is admitted past the beta gate via the
`X-Beta-Bot` header backed by `CURATOR_BOT_TOKEN`. The bot is
deliberately not an operator: it has no `account_id`, no Cortex
partition, no credentials.
[`current_operator_id`](https://github.com/Lacuna-Labs/curator/blob/main/curator-api/curator_api/_session.py)
enforces this explicitly — when `request.state.bot_bypass` is set, any
handler that asks "who is the operator?" gets a 403
`bot_no_operator_identity`. A leaked `CURATOR_BOT_TOKEN` therefore
cannot reach an IDOR-protected surface as the shared `"anonymous"`
bucket.

Routes that the bot is legitimately allowed to hit (public pages,
static assets, `/api/beta-gate`) do not call `current_operator_id`;
routes that do call it close the door.

The fallback to `"anonymous"` survives only for dev / unit-test paths
where Google OAuth is intentionally not configured. In production the
gate forbids reaching a handler without an `account_id`, so the
fallback never fires. The Wave-2 Lane B fix (`2f6a5c6`) wired the
guard; the threat model document references the closure.

### 2.3 Path-borne operator ids

For routes that legitimately carry an `operator_id` in the URL path
(`/api/stores/{operator_id}/...`), the path value is validated against
the session via
[`enforce_operator`](https://github.com/Lacuna-Labs/curator/blob/main/curator-api/curator_api/_session.py).
The helper returns the session's id, never the claimed value, even
when they match — defense in depth. A claimed id that disagrees with
the session yields a 403 `operator_mismatch`.

### 2.4 The trust ladder

Every code path runs under a tier. The tier flows from the caller, not
from the bus; the dispatcher's five-gate chain
(`scheme/runtime/dispatch.js`) is the canonical enforcement point. The
ladder, weakest to strongest:

| Tier | What it is | Capability ceiling |
|---|---|---|
| **untrusted** | Cross-site request, untracked input, anything we did not personally route to a tier explicitly. | Read-only on public surfaces. No verb dispatch. |
| **external** | A signed third-party (webhook from Etsy / Shopify / eBay / Meta; Stripe billing event). | Restricted to the verbs the integration is allowed to fire. No `card-emit` capability. |
| **sakura** | The on-device LLM, after intent classification. | Non-destructive verbs only. The five-line belt-and-suspenders chain in `dispatch.js:608-609` is the canary — `TIER_PERMS` excludes destructive AND a redundant `sakura-cannot-destroy` reject sits at the dispatcher. |
| **operator-voice** | The operator speaking. | Most verbs, but destructive verbs go through the body-side `requestTransferConfirmation` await (rule 10) — not yet landed on every body. See §11.4. |
| **operator-gesture** | The operator pressing a button after seeing the consequence rendered. | All verbs. Destructive verbs that pop a confirmation chip have already shown the consequence. |
| **system** | The internal dispatcher itself, the boot sequencer, the migration runner. | All verbs, no rate limit, no consent ledger. Not reachable from the operator surface; the inner gate is the boundary. |

The provenance contract crosses three boundaries: the postMessage
boundary into a worker (when wired), the HTTPS boundary into the
backend, and the gRPC bidi boundary into Engram (when the sync ships).
At every boundary the tier is re-asserted from server-side state, not
re-read from the caller's claim. The Wave-1 Slice-A verified-clean
column includes `routes/sakura_tools.tools_dispatch` carrying its W1-2
closure — the consent ledger is single-use, (tool, operator, args_fp)-
bound, 5-minute TTL, canonical-JSON SHA-256 args fingerprint. A token
issued to a sakura-tier call does not redeem on a different tier.

<!-- LIVING:EXPAND(2026-07-03): puppet-master interface — pending build lane. The PUPPET-MASTER-SUITE (docs/PUPPET-MASTER-SUITE-2026-07-03.md, not yet landed) is the LLM↔surface control channel. When it lands, document how the sakura tier's capability ceiling is enforced across the puppet-master boundary: the surface receives directives, not raw verb dispatch, and the five-gate chain re-asserts tier server-side. The puppet-master channel must not become a tier-escalation path. -->

### 2.5 Bug ownership — the second tier

Identity tells you who is calling. Ownership tells you what they may
touch. The bugs router demonstrates the two-tier discipline:
session-bound identity (FINAL-005) plus per-bug ownership scoping
(R2-A-001 / R2-A-004). The
[`_enforce_bug_ownership`](https://github.com/Lacuna-Labs/curator/blob/main/curator-api/curator_api/routes/bugs.py)
helper is the canonical shape:

```
def _enforce_bug_ownership(bug_id, operator_id, is_admin):
    if is_admin:
        return
    owner = _bugs.owner_of(bug_id)
    if not operator_id or owner != operator_id:
        raise HTTPException(403, "bug_not_accessible")
```

The error is coarse on purpose: "missing" and "not yours" return the
same response so existence is not leaked through the error
distinction. The mutation endpoints (`add_comment`, `patch_bug`,
`assign_bug`) all call the helper first. Workflow-class status
transitions (`open` / `in_progress` / `needs_info`) are reserved for
the bug's reporter or an admin; close-class transitions (`closed` /
`resolved` / `infeasible`) require admin.

This is the shape every operator-scoped mutation eventually has to
take. Listing mutations on the modern per-store path
(`routes/stores.py:_listing_store`) already work this way — the store
is opened against the session's operator id, so an attempt to mutate
another operator's listing reads the wrong store and 404s. The legacy
`/api/listings` family in `app.py` does not (FINAL-001) — see §11.

### 2.6 The OAuth callback exception

`routes/oauth.py:oauth_callback` is the one route in the codebase that
reads operator identity from somewhere other than the session cookie.
The state and PKCE verifier are issued by the same process — the
server signs them, the server verifies them on return — so the
operator id riding in the `state_payload` is server-vouched, not
caller-claimed.

The Wave-1 verified-clean trace (FINAL-062) confirmed the body
`operator_id` field is ignored on the callback path; the state
payload is the authority. The Wave-1 documentation rule still
applies: the route carries a `# TODO(idor-deferred):` comment so the
next audit can find the exception.

The popup-message origin check (`c465f3e`) closes the second half of
the vector: the callback popup posts back to the opener, and the
opener verifies `event.origin` against the curator origin before
trusting the payload. A malicious page that opened a popup to the
real callback URL cannot post a forged success message back.

### 2.7 The IDOR sweep — methodology

The IDOR class was the largest single source of incidents in the
codebase's history. Both the Wave-1 sweep and the prior Sentinel
pass exist because the same shape kept regressing. The methodology
that finally pinned it:

1. **Enumerate every authenticated route.** `grep` for every `@router.{get,post,patch,delete,put}` in `routes/`. The list is the audit surface.
2. **For each route, read the handler.** Identify how it derives `operator_id`. There are exactly three legitimate sources: `current_operator_id(request)`, `enforce_operator(claimed, request)`, or the documented OAuth-callback exception. Anything else is a bug.
3. **Read the Pydantic body shape.** If the body declares `operator_id`, the handler should not read it. If the handler does read it, fix the handler. If the handler does not, the body field is dead and tracked as FINAL-025.
4. **Check the path parameters.** If the URL is `/api/stores/{operator_id}/...`, the handler must call `enforce_operator(operator_id, request)` or the equivalent.
5. **Verify against a cross-operator test.** Sign in as operator A, post to operator B's URL, assert the response uses A's id, not B's. The `test_idor.py` suite is the canonical shape.

The shape generalizes to any IDOR-class surface. The session is the
authority. The wire is a request, not a claim about identity. The
test is the contract.

The two surfaces that resist this shape are the ones that pre-date
it: the legacy `/api/listings` family (FINAL-001) and the shared
Cortex graph for RadioListen / RadioMoment (FINAL-022). Both are
tracked; the migration is in flight.

### 2.8 The consent ledger

The destructive Sakura verbs go through a consent ledger. The shape:

1. The model emits a `(consent-token-required <tool> <args>)` form.
2. The dispatcher mints a token bound to `(tool, operator, args_fp)` where `args_fp` is the SHA-256 of canonical-JSON-serialized args.
3. The UI shows a confirmation card; the operator presses confirm; the token rides back in the redemption call.
4. `_redeem_consent_token` verifies the token, the tool match, the operator match, the args fingerprint match, and the 5-minute TTL.
5. On success the token is popped; on any failure the token is also popped (FINAL-061 — documented intentional behavior to avoid replay).

The single-use guarantee is the foundation. A captured token cannot
redeem twice. A token issued for `delete_listing(123)` cannot redeem
for `delete_listing(456)` because the args fingerprint differs. A
token issued to operator A cannot redeem from operator B because the
operator binding fails.

The FINAL-061 trade-off (pop on any failure) is the documented choice:
distinguishing "wrong args fingerprint" (don't pop, log violation)
from "consumed and replayed" (pop) is a UX-vs-replay-window
trade. Today the policy is uniform pop — a buggy FE that mutates args
after token issue burns its own token and the operator re-issues. The
violation log fires either way.

---

## 3. Cryptography

### 3.1 The envelope shape

Cortex at-rest uses AES-256-GCM, with the envelope defined in
[`cortex/cortex_crypto.py`](https://github.com/Lacuna-Labs/curator/blob/main/curator-api/curator_api/cortex/cortex_crypto.py).
The wire shape:

```
CXE1:<b64url(json{alg,kid,nonce_b64})>.<b64url(ciphertext+tag)>
```

- `alg` — always `"AES-256-GCM"` in this version. Bound as AAD.
- `kid` — the key id; lets a future rotation decrypt records sealed under the retired key while new writes go under the new one. Bound as AAD.
- `nonce_b64` — 12 bytes from `os.urandom`, fresh per call. Bound as AAD.
- Ciphertext + GCM auth tag, base64url-encoded, unpadded.

The header is the AAD passed to `AESGCM.encrypt(nonce, plaintext,
header)`. Tampering with `kid` or `nonce` fails the tag check on open;
`InvalidTag` propagates and the read function never returns plaintext
on tag failure. There is no `except Exception` that swallows the tag
failure into an empty byte-string fallback. This is the fail-closed
read guarantee. The Wave-1 Slice-C audit confirmed it; the Wave-2
Slice-β verification re-confirmed the envelope shape unchanged.

### 3.2 The `seal_props` predicate

Cortex on the Rust backend writes nodes with PII-bearing props
directly to disk. Sealing happens at the Python → Rust boundary in
[`_should_seal_key`](https://github.com/Lacuna-Labs/curator/blob/main/curator-api/curator_api/cortex/cortex_crypto.py):

```
def _should_seal_key(key: str) -> bool:
    if key in PII_TEXT_PROPS:
        return True
    if key.startswith("operator_") and key not in _OPERATOR_STRUCTURAL:
        return True
    return False
```

Two rules:

1. **Kind-agnostic exact-match** for the PII names that recur across node kinds: `text`, `summary`, `content`, `body`, `title`, `name`, `note`, `meta_json`.
2. **`operator_*` prefix convention** for free-text fields the operator typed into a sheet (the `save_correction` path — `operator_notes`, `operator_writeup`, `operator_blurb`, `operator_thing`, `operator_year`, `operator_attribution`, and any future addition).

The single carve-out is `operator_id` — that field is the per-node
operator index every read path filters on by equality, and sealing is
non-deterministic, so sealing `operator_id` would silently break every
`if p.get("operator_id") != …` guard. The `_OPERATOR_STRUCTURAL` set
is the canary; the structural test
`test_rust_structural_props_stay_plaintext_for_filtering` pins the
contract.

The convention rule is the load-bearing widening from FINAL-002. The
original allow-list was set-membership only and missed every
`operator_*` key on the shared `:Entity` node; the prod Rust backend
wrote them plaintext. The widened predicate is safer-by-default: a
new sheet that adds an `operator_signature` field gets sealed
without a follow-up allow-list edit.

### 3.3 `seal_props` is idempotent

A read-modify-write loop must not double-wrap. `seal_props` skips any
value whose string form starts with the `CXE1:` envelope prefix:

```
if is_envelope(v):
    continue
```

The Wave-2 Slice-β audit pinned this with
`test_seal_props_is_idempotent_on_resealed_operator_keys`. Two
independent sealers in `save_correction` (the per-operator store
sealing wrapper and the Engram projection sealer) both see plaintext
and emit independent envelopes with different nonces; neither produces
a CXE1-of-CXE1.

### 3.4 The `KeyProvider` seam

Keys come from a `KeyProvider` interface, not a direct env-var read.
Two implementations ship:

- **`EnvKeyProvider`** reads `CURATOR_CORTEX_KEY` (64 hex chars = 32 bytes). Active on the current server build. Not the production answer.
- **`OSKeystoreKeyProvider`** binds to the platform keystore — macOS Keychain, iOS Keychain Services, Android Keystore, Windows DPAPI. The Python class is a stub: it raises `CortexKeyUnavailable` with a message naming the contract the native app must satisfy. The actual binding lives in native code.

This is the Camp C design: the master key (MK) lives on the operator's
device; the server holds ciphertext and a `kid`, nothing else. The MK
is derived from a passphrase plus a device salt; per-scope DEKs are
derived via HKDF from the MK so a leaked scope key compromises only
its scope. Single-door key recovery (the D13 decision) is anchored to
a Google sign-in — the operator's Google account is the recovery
authority of last resort, with the passphrase as the day-to-day key.

<!-- RESEARCH: confirm the D13 single-door recovery model is the live decision. CORTEX-ENGRAM-RESIDENCY §4.1 references PBKDF2 + HKDF but the Google-anchored recovery is named in chat canon, not yet in the residency spec. -->

The honest status today: the env provider is active on the server,
the keystore stub is wired but inert. The fail-closed boot guard
[`assert_cortex_crypto_configured`](https://github.com/Lacuna-Labs/curator/blob/main/curator-api/curator_api/cortex/cortex_crypto.py)
refuses to start when either `cryptography` is missing or the active
provider cannot produce a key. The key-custody gap is named in the
`TODO(key-custody)` block at `engram/storage.py:17-23` — that comment
still points at a legacy `engram/store.py` (`safe_operator_id` +
`EnvKeyProvider`) as the live data path. At HEAD `d4f5a8a4` no
`engram/store.py` file is present on disk; the live per-operator
residency runs through `cortex/memory.py:store_for_operator`'s
`_safe_operator_id` slug (§4.1), which is the same `safe_operator_id`
lineage the comment refers to. The hardened `engram/storage.py`
`op_hash` seam has no production caller (§4.9). The naming should be
reconciled — the comment names a file that no longer exists — but the
substance is unchanged: the env provider is active, the slug path is
live, the `op_hash` path is built-not-wired.

<!-- LIVING:TODO(2026-07-03): reconcile the engram/storage.py:19 TODO comment, which names a legacy engram/store.py that is absent at HEAD d4f5a8a4. Point it at cortex/memory.py:store_for_operator instead, or restore the missing module. -->
<!-- LIVING:EXPAND(2026-07-03): puppet-master interface — pending build lane. When PUPPET-MASTER-SUITE lands, document the LLM↔surface key/consent boundary here (the master key never crosses the puppet-master channel). -->


### 3.5 Camp C — what "zero-knowledge" actually requires

Until both conditions below hold, customer-facing copy stops at
**"encrypted at rest"**. Stronger claims are held.

1. The active `KeyProvider` is `OSKeystoreKeyProvider` (or a native bridge subclass), so the server process cannot produce the key.
2. The bytes the server stores are already sealed when they leave the device. The Engram replica seal happens device-side, before the ciphertext crosses the wire.

Today neither is true on the prod server build, by honest design — the
env provider is the bridge until the native side lands. The single
floor copy that is true today is "encrypted at rest." The stronger
claims ("zero-knowledge", "we cannot read your data", "server cannot
open") are reserved.

### 3.6 Vendor credential KDF

The vendor credential store (`vendors/credentials.py`,
`stores/credentials.py`) derives a per-vendor AES key from a server
secret plus the vendor domain plus the operator id:

```
key = sha256(_server_secret() + b"\x00" + domain + b"\x00" + op_id)
```

The construction is collision-safe per domain separator. The hygiene
upgrade to HKDF-Expand is tracked as FINAL-040. The construction is
not a real KDF (no iteration count, no high-entropy salt, no memory
hardness), so a leaked server secret permits offline derivation of
every operator's vendor keys. This is acceptable today because (a)
the server secret never leaves the process, (b) credential records
are AES-256-GCM at rest under the per-vendor key, and (c) the
higher-value Cortex key path has its own dedicated KDF target.

### 3.7 Camp C key delegation — passphrase → MK → per-scope DEK

The Camp C key hierarchy is three layers deep:

1. **Passphrase.** The operator's chosen passphrase, plus a device salt stored alongside the on-device Cortex. The passphrase never leaves the device.
2. **Master Key (MK).** Derived from the passphrase via PBKDF2 (target parameters: SHA-256, 600,000 iterations as of 2026; revisit per OWASP guidance every twelve months). The MK is 32 bytes; it lives in the OS keystore for the duration of an authenticated session and is purged on lock / sign-out.
3. **Per-scope Data Encryption Keys (DEKs).** Derived from the MK via HKDF-Expand with a per-scope info string. Scopes today: `cortex-log`, `cortex-snapshot`, `engram-chunk`, `engram-snapshot`, `vendor-creds`. Each scope has its own DEK so a leak of one scope key compromises only its scope.

The HKDF info strings are stable across versions. The DEK rotation
target is one rotation per quarter for active operators; the `kid` in
the envelope header (§3.1) is what makes rotation safe — the old DEK
decrypts old records, the new DEK encrypts new ones, and an explicit
rewrap pass migrates the in-flight log forward.

<!-- RESEARCH: confirm the 600,000 PBKDF2 iterations baseline. CORTEX-ENGRAM-RESIDENCY §4.1 names PBKDF2 but does not pin the iteration count; the OWASP 2024 baseline is 600k for PBKDF2-SHA-256 with the AES use case. -->

### 3.8 Single-door key recovery (the D13 decision)

If the operator forgets the passphrase, the recovery path is
Google-anchored. The operator signs in with Google; the server emits
a recovery envelope containing the MK sealed under a recovery DEK
derived from the operator's Google sub claim plus a server-side
recovery secret. The recovery flow runs once; the operator chooses a
new passphrase; the MK is re-sealed under the new passphrase-derived
DEK; the recovery envelope is invalidated.

Three properties this gives us:

- **Single door.** One recovery path, not many. Multiple recovery paths multiply the attack surface; one path can be audited.
- **No server custody.** The server never holds the MK in cleartext. The recovery envelope is sealed end-to-end; the server emits the sealed envelope and the recovery flow opens it on the operator's device.
- **Auditable.** Every recovery emit is logged with the operator id, the Google sub, the timestamp, and the device fingerprint. A second recovery within a short window flags as anomalous.

The honest status: the design is settled; the implementation lands
with the keystore provider. Until then the recovery story is "use the
passphrase or lose the data," which is the floor we ship.

### 3.9 The sync envelope

`sync/crypto.py:encrypt_envelope` and `decrypt_envelope` ship the
per-batch envelope between device and server during the (future)
delta sync. Version + alg + 32-byte key + 12-byte nonce + GCM tag.
The one structural concern (FINAL-027) is that the top-level `v` /
`alg` fields are not bound as AAD; today only one version, but the
day a v2 ships an attacker who can mutate the on-wire dict could
downgrade or version-flip. The fix is mechanical:

```
aes.encrypt(nonce, plaintext, json.dumps({"v": v, "alg": alg}).encode())
```

The pattern is already correct in the Cortex envelope (header bound
as AAD); aligning the sync envelope is a SECOND-WAVE row.

`sync/crypto.derive_key` is a self-built KDF
(`sha256(secret || 0x00 || op_id)`) explicitly marked "Not real key
derivation; see v0.3 plan." It is exported but has no server-side
callers — verified by code sweep. The function exists so a
device-side implementation has a canonical reference. Until the
PBKDF2 + HKDF-from-passphrase plan lands (CORTEX-ENGRAM-RESIDENCY
§4.1), no new caller plumbs `derive_key` for at-rest sealing.
Tracked as FINAL-028.

---

## 4. Storage residency

### 4.1 Cortex on-device

The on-device Cortex is an append-only log plus periodic compacted
snapshot, per operator. The shim path (`cortex_py_shim`) is the
reference Python implementation; the Rust crate (`cortex_py`) is the
production target.

Two backends, one seal contract. The shim seals the whole serialized
artifact (one envelope per log line, one per snapshot); the Rust
crate seals at the Python → Rust boundary via `seal_props` because
Python never sees the on-disk bytes the crate writes. Both routes
go through the same `seal` / `open_envelope` pair, the same
`KeyProvider`, the same fail-closed posture.

Per-operator isolation in `cortex/memory.py:store_for_operator` —
every operator gets a directory under
`<root>/op/<safe_id>/cortex.log`. The slug today is
`slug[:40] + "-" + sha256(op_id)[:12]` (48 bits of collision space).
Two parallel hashing schemes exist (the `_safe_operator_id` slug
here and the full `op_hash` in the Engram storage seam).
Standardizing on the full 64-hex hash is FINAL-029 — the Engram path
already does it right; `memory.py` predates the residency canon and
is the migration target.

### 4.2 Engram — per-operator encrypted folder

The Engram replica is a per-operator encrypted folder layout, indexed
only by the SHA-256 of the operator id. The storage seam is
[`engram/storage.py`](https://github.com/Lacuna-Labs/curator/blob/main/curator-api/curator_api/engram/storage.py).
The contract is deliberately small:

```
op_hash(operator_id)                              → 64-hex sha256
put_log_chunk(op_hash, lo, hi, ciphertext)        → ChunkInfo
list_chunks_since(op_hash, cursor)                → [ChunkInfo]
get_chunk(op_hash, ref)                           → Optional[bytes]
put_snapshot(op_hash, ciphertext)                 → None
get_snapshot(op_hash)                             → Optional[bytes]
forget_operator(op_hash)                          → None
```

The store handles opaque bytes. It neither encrypts nor inspects
them. The ONE identity-bearing input — the raw `operator_id` — is
hashed at the door (`op_hash`). Path layout:

```
<root>/engram/<h[0:2]>/<h[2:4]>/<full_hash>/log/<lo>-<hi>.enc
<root>/engram/<h[0:2]>/<h[2:4]>/<full_hash>/snap.enc
```

The hash-prefix fan-out is free future-proofing for an object store
that shards by key prefix — no extra lookups. We never `iterdir` the
global tree. The Protocol carries no method to enumerate operators.

Path traversal is closed at two layers. `_op_dir` validates the op
hash against `[0-9a-f]{64}` — nothing else passes. `_chunk_path`
validates the seq-range ref via `^\d+-\d+$`. The test
`test_rejects_malformed_chunk_ref` pins `../../../etc/passwd` and
`notarange`.

### 4.3 `forget_operator` — right-to-forget terminus

This is the load-bearing erasure path. Getting this wrong is a
sue-able false-erasure claim. The pre-FINAL-009 implementation was a
one-liner: `shutil.rmtree(op_dir, ignore_errors=True)`. The defect: a
co-tenant attacker or poisoned restore that swaps `op_dir` for a
symlink causes `rmtree` to raise `NotADirectoryError`,
`ignore_errors=True` swallows it, the call returns success, and the
ciphertext at the symlink target survives. Tombstoned without
purging.

The current implementation (Wave-1 fix + Wave-2 R2-MED-2 follow-up)
in
[`FilesystemEngramStorage.forget_operator`](https://github.com/Lacuna-Labs/curator/blob/main/curator-api/curator_api/engram/storage.py):

1. `os.lstat` first — does not follow symlinks. `FileNotFoundError` is the idempotent-OK path (legitimately empty operator).
2. Refuse symlinks: `stat.S_ISLNK(st.st_mode)` raises `EngramForgetFailed`, the typed exception that mirrors `CortexPurgeUnsupported`'s fail-loud posture.
3. Refuse non-directory entries (regular file, socket, pipe, device).
4. `shutil.rmtree(op_dir)` without `ignore_errors`. The whole call is wrapped in a typed-error guard so the contract is uniform: `OSError` → `EngramForgetFailed`; the inner `FileNotFoundError` (someone else won the race and the prefix is already gone) is the silent idempotent-OK branch matching the lstat side; any other condition surfaces.
5. Post-check: if the directory still exists after `rmtree`, raise. Better a loud incomplete-forget than a quiet one.

The TOCTOU between `os.lstat` and `rmtree` for the top-level swap is
closed by CPython's `shutil.rmtree.avoids_symlink_attacks` (True on
the Linux Fly target): the internal `_rmtree_safe_fd` traversal is
race-resistant. The R2-MED-2 wrapper ensures the resulting `OSError`
is re-raised as `EngramForgetFailed` for caller-side uniformity.

The deeper TOCTOU fix (open with `O_NOFOLLOW | O_DIRECTORY` for an fd
that pins inode identity, then `rmtree` against the fd) is not
necessary at the current trust boundary — the parent dir is
curator-owned, no co-tenant write — but the fd-based version is the
canonical mitigation if the trust boundary ever widens.

### 4.4 Right-to-forget propagation

`cortex/maintenance.py:_propagate_forget_to_engram` is the
device-side hard-purge propagator. Pre-FINAL-010 it called
`client.forget("", key)` — empty customer slot — which would either
match nothing (silent false erasure) or match a wildcard (collateral
cross-operator deletion) on the real Engram backend.

The current shape: `purge_expired` resolves `operator_id` from the
still-resident tombstoned node before `hard_purge_node` wipes it,
and emits a `purged_records` list carrying the binding.
`_propagate_forget_to_engram` iterates and passes the resolved id
into `client.forget(operator_id, key)`. Unresolvable ids skip with
a warning log rather than ship a wildcard.

R2-MED-3 carries the remaining honest residual: non-operator-bound
tombstones (shop-level data, system canon rows) skip propagation
entirely. Today this is inert (the Noop client discards), but on
the real Engram backend a shop-level node the operator deleted on
device would persist in the cloud copy. The owner decision is
between (a) shared canon / shop-level rows are NEVER projected to
Engram, or (b) Engram grows a second keyspace and the propagator
distinguishes. (a) is the simpler answer for the current product
shape.

### 4.5 SSD and log-structured filesystem caveat

The `forget_operator` path overwrites then unlinks. On a
log-structured filesystem (any modern SSD, including the Fly
Tigris-backed volume) the underlying flash blocks may still contain
ciphertext until garbage collection rewrites them. This is
hardware-level recovery and is **not** a control we promise to
defeat. The control we promise: from the application's perspective
the bytes are gone, and the only thing that could read them is a
forensic read of the raw flash blocks before GC completes. The
encrypted-at-rest envelope continues to apply — a forensic flash
read recovers ciphertext, not plaintext. The key custody path
(§3.5) is what gives `forget_operator` its real teeth: once the key
is purged from the OS keystore, the ciphertext is algorithmically
unrecoverable regardless of hardware GC state.

### 4.5b The residency design rationale

Why per-operator encrypted folders, why hash-prefix fan-out, why
opaque bytes — the design choices that make the threat model work
need to be named so a future change reads against them.

**Per-operator folder.** The alternative is a multi-tenant database
where rows are tagged with an `operator_id` column and a WHERE clause
keeps them apart. The multi-tenant DB has been tried twice in this
codebase (the legacy `/api/listings` table and the shared Cortex
graph) and produced the IDOR class twice. The per-operator folder
makes the isolation structural: a request for operator A's data
opens operator A's folder, full stop. There is no WHERE clause to
forget.

**Hash-prefix fan-out.** The path layout is
`engram/<h[0:2]>/<h[2:4]>/<full_hash>/...`. Two-level fan-out before
the full hash, computed from bytes we already hold. The benefit is
free future-proofing for an object store that shards by key prefix —
S3-compatible backends shard on the first few characters of the key,
so a flat layout would hot-spot the first shard. Hash-prefix
fan-out spreads the load evenly without an extra lookup.

**Opaque bytes.** The storage layer does not encrypt or inspect the
bytes it stores. The device seals, the server stores. This means
the storage layer can never leak content even on full compromise —
the worst case is the attacker reads ciphertext that they cannot
decrypt. The contract is a structural property of the API: the
`put_log_chunk` signature takes `bytes`, not a typed `LogEvent`.

**No global enumeration.** The Protocol has no method to walk the
global tree. `default_storage()` cannot answer "who are my
operators?" — that capability does not exist, so it cannot be
misused. Every method takes an `op_hash` and touches exactly one
operator's prefix.

**Object store as the prod target, not a Fly Volume.** Fly Volumes
are persistent disks attached to one Machine; using a Volume would
force operator-to-Machine affinity (a single Machine owns the disk),
which breaks the always-on region-flexible Engram-replica model. An
object store (Tigris / R2 / B2) lets any Engram process serve any
operator's prefix.

**Single-leader replication.** The device is the source of truth;
Engram is a follower replica. No multi-leader logic lives in the
storage layer. The replication model means an Engram outage degrades
the operator's experience (no cloud sync), but does not corrupt
state — the device keeps writing locally, and the next successful
push catches the replica up.

### 4.6 The shared graph caveat — RadioListen, RadioMoment, the radio diary

`routes/cards.py:radio_diary_post` / `radio_moment_post` /
`radio_moment_get` write to the SHARED Cortex graph (the G4-5
carry-over class). The shared graph predates per-operator isolation;
the read paths filter on `operator_id` but the writes share a bucket.
The `_operator_id` helper falls back to `"anonymous"` when
`account_id` is missing — every unauthenticated visitor shares one
bucket.

Today this is a latent multi-operator leak: filtered on read, but
the data sits in a shared partition. The Wave-1 finding (FINAL-022)
is to move RadioListen / RadioMoment to `store_for_operator` and
refuse the request (401 / 403) when `account_id` is missing, or
assert the gate is configured in prod. SECOND-WAVE.

The deeper carry-over is `cortex/memory.py:get_memo` /
`get_studio_artifact`, where `operator_id: Optional[str] = None`
defaults permit a cross-store search via `_store_holding_kind`. Live
HTTP callers always pass the session id, so no exploit on the wire
today — but the IDOR primitive is one careless internal call from a
leak. The fix (FINAL-023) makes `operator_id` a required keyword
with no default; cross-store helpers move to a separate admin-only
function.

### 4.7 The digest path

`routes/bugs.py` carries a digest path (`/api/bugs/digest`) and a
public digest path (`/api/public/bugs/digest`). Two surfaces, two
trust models.

The admin-gated path returns the full digest with bug bodies,
comments, images, github issue URLs, operator ids, and assignees.
Reachable from agent / cron tooling via `X-Admin-Token:
$CURATOR_ADMIN_TOKEN`; browser sessions also work for admin Google
accounts. The route name explicitly checks `request.state.is_admin`
and 403s otherwise.

The public path returns a PII-free roll-up: counts by status and
severity, plus a list of `(id, title, status, severity,
updated_at)` tuples. Bug bodies, comments, images, github URLs,
operator ids, and assignees are stripped before the response is
built. The `_digest_redact` helper projects against a fixed
allow-list `_DIGEST_PUBLIC_FIELDS`. The route accepts that
operator-authored titles surface unauth; the operator is responsible
for not putting PII in a title.

This is a good shape for any future public-data surface: a fixed
allow-list of fields, projected at the route boundary, with the
allow-list named so an audit can read it directly.

### 4.8 The debug routes

`routes/debug.py:flush_curator_home` is env-gated
(`CURATOR_DEBUG_FLUSH=1`) but the gate does not authenticate
(FINAL-063). A dev deploy with that env set exposes the flush
surface unauthenticated. The standing fix: add an `enforce_operator`
or admin gate inside the handler in addition to the env gate. The
defense-in-depth pattern: never trust the env flag alone for a
destructive surface.

The principle generalizes. Every destructive route has at least two
checks: a feature gate and an identity gate. Either one going wrong
should not open the surface.

### 4.9 Built-but-not-wired — the production posture

The hardened `engram/storage.py` seam is exercised by tests
(`tests/test_engram_storage.py`) but has no production caller at
HEAD. `cortex/maintenance.py` imports
`..engram.client.default_client`, which resolves to
`NoopEngramClient()` for every value of `ENGRAM_BACKEND`. The
right-to-forget propagator hits the noop; nothing reaches the
hardened backend.

This is honest pre-cutover: the storage module landed before the
wire-up was the plan. It is also the load-bearing residual in §11.
Customer-facing copy stays in future tense ("planned") until the
production path actually traverses the hardened backend AND the
keystore provider is the active provider. Both conditions, not one.

---

## 5. The HTTP surface

### 5.1 Response headers

The standing browser-defense headers are set by
[`_security_headers.py`](https://github.com/Lacuna-Labs/curator/blob/main/curator-api/curator_api/_security_headers.py).
The middleware is the outermost wrapper so 401 / 403 responses still
carry the headers. Idempotent — if a downstream handler already set
one of the headers (the `/docs` Swagger UI path needs an
`unsafe-eval` exception) the middleware does not clobber.

The seven headers shipping today:

1. **`Content-Security-Policy`** — see §5.2 for the full breakdown.
2. **`Strict-Transport-Security: max-age=31536000; includeSubDomains; preload`** — one-year HSTS with preload eligibility. Closes the first-visit SSL-strip vector.
3. **`X-Frame-Options: DENY`** plus CSP `frame-ancestors 'none'` — no embedding anywhere; clickjacking closed.
4. **`X-Content-Type-Options: nosniff`** — MIME-sniff confusion closed for uploaded files.
5. **`Referrer-Policy: strict-origin-when-cross-origin`** — outbound URLs do not leak the operator's path.
6. **`Permissions-Policy: camera=(), microphone=(self), geolocation=(), payment=()`** — capability surface locked.
7. **`Cross-Origin-Opener-Policy: same-origin`** plus **`Cross-Origin-Resource-Policy: same-site`** — the seventh header added in Caliper Lane 3 (`5144dc8`). COOP severs the `window.opener` side channel and is the prerequisite for `SharedArrayBuffer`; CORP opts API responses out of being fetched by naive cross-origin embedders.

The Wave-1 Slice-D audit confirmed all seven closed against the
target browsers. The header policy applies to `/healthz`, `/api/*`,
and the SPA shell uniformly — they ride on the same origin.

### 5.2 The CSP — current shape

The `_CSP_PARTS` dict in
[`_security_headers.py`](https://github.com/Lacuna-Labs/curator/blob/main/curator-api/curator_api/_security_headers.py)
assembles the directive list:

| Directive | Sources |
|---|---|
| `default-src` | `'self'` |
| `script-src` | `'self' 'wasm-unsafe-eval'` |
| `connect-src` | `'self'`, `wss://*.lacunalabs.ai`, `https://*.lacunalabs.ai`, `https://i.etsystatic.com`, `https://*.etsystatic.com` |
| `img-src` | `'self' data: blob:`, Etsy CDN, `*.gstatic.com`, `*.ytimg.com` |
| `style-src` | `'self' 'unsafe-inline'`, Google Fonts |
| `font-src` | `'self' data: https://fonts.gstatic.com` |
| `frame-ancestors` | `'none'` |
| `frame-src` | `'self'`, `https://www.youtube.com`, `https://www.youtube-nocookie.com` |
| `base-uri` | `'self'` |
| `form-action` | `'self' https://accounts.google.com` |
| `object-src` | `'none'` |
| `worker-src` | `'self' blob:` |

Two `unsafe-` directives. Both are documented liabilities.

**`script-src 'wasm-unsafe-eval'`** is required by Hugging Face
transformers.js, which we use for on-device inference. The hazard:
once `connect-src` widens to admit a CDN we cannot control (the
near-term FINAL-036 fix moves `world-atlas` self-hosted), the
combination becomes RCE-equivalent. The mitigation today is the
tight `connect-src` — every external host is enumerated. wllama (the
LLM-inference WASM) is self-hosted, not loaded from a CDN
(`e896d3c`, `583f2aa`).

**`style-src 'unsafe-inline'`** is the dot-matrix substrate. Sakura's
surface paints inline `style=""` attributes per pixel. The follow-up
is per-render nonces; debt, not breach.

A Report-Only CSP is emitted in parallel with the enforcing one
(Ticket #424). Violations post to `/api/csp-report` and surface at
the operator-only `/csp-violations` dashboard. The env knob
`CURATOR_CSP_REPORT_ONLY=1` collapses to Report-Only during policy
tightening; `CURATOR_CSP_EXTRA_CONNECT` lets dev / staging add
origins without a code change.

### 5.3 `safeHref` on the frontend

[`curator-web/src/lib/safeHref.js`](https://github.com/Lacuna-Labs/curator/blob/main/curator-web/src/lib/safeHref.js)
is the URL-scheme allowlist for anchor `href` bindings. Closes
FINAL-012 (the cardKit `ProvenanceChip` allowed
`provenance.href: "javascript:alert(document.cookie)"` to validate
clean and render as `<a href>`).

The rule: `http:`, `https:`, `mailto:`. Everything else returns null.
The Wave-2 hardening (`9ceb983`) adds three additional defenses:

- **Userinfo rejection.** `https://attacker.com@evil.com/path` parses with `host = evil.com` while the operator reads `attacker.com`. `url.username !== '' || url.password !== ''` rejects.
- **IDN homoglyph rejection.** `https://exаmple.com` (Cyrillic а, U+0430) parses to a Punycode lookalike. The WHATWG URL parser auto-converts to Punycode at parse time so a parsed-host ASCII check would never fire; the helper checks the **original** input string for non-ASCII codepoints. Legitimate pre-encoded `xn--*` URLs pass.
- **`mailto:` CRLF rejection.** Browsers strip these at navigation time, so not exploitable on Chromium / Gecko / WebKit, but the helper should not propagate them either.

The WHATWG URL parser is used instead of `startsWith()` string sniff
because string sniff is famously bypassable by leading whitespace
(`\tjavascript:`, `\x00javascript:`) and control chars. The parser
normalises the scheme; `url.protocol` is always lowercase and
trimmed.

The Zod schema refine plus render-time call is defense in depth: the
schema rejects at validate, the render call rejects at attach.

### 5.4 The Provenance schema, in detail

Every cardKit answer kind carries a Provenance chip. The chip
renders a source name, a kind classifier, and (when present) an
outbound href. The schema is `ProvenanceSchema`; the chip is
`ProvenanceChip`.

The pre-FINAL-012 schema declared `href: z.string().optional()` with
no scheme validation. The vector was direct: a model emits
`provenance.href: "javascript:alert(document.cookie)"`, the chip
renders `<a href={p.href}>`, the operator taps the chip, JS executes
in the curator origin. Full session compromise. `rel="noopener
noreferrer"` does not block the `javascript:` scheme.

The fix is the `safeHref` helper (§5.3) threaded through
`resolveProvenance` and reused on every future card href binding.
The defense is two-layered:

1. The Zod schema refine rejects at validate. A `ProvenanceSchema`-typed payload with a non-allowlisted href fails parsing; the bug never reaches the chip.
2. The render-time call rejects at attach. Even if a payload reaches the chip via a code path that bypasses Zod (a hand-built dict in a test, a hot-patched runtime), the `<a href={safeHref(p.href) ?? '#'}>` pattern returns null and the chip degrades to plain text.

The MediaPayload schema (FINAL-055) follows the same shape:
`MediaPayload.src` allowlists `https:`, `http:`, `blob:` only. No
`data:`, no `javascript:`. The reuse keeps the trust boundary in one
helper.

The NewspaperCard RSS feed (R2γ-1) was the third surface — story
links syndicated verbatim from upstream RSS. The Wave-2 Lane C fix
threaded `safeHref` through the link render. Schema validation plus
render-time check, on every card with an outbound href.

### 5.6 `target="_blank"` discipline

Every `target="_blank"` carries `rel="noopener noreferrer"`. The
Wave-1 Slice-D sweep confirmed twelve sites all clean. An ESLint
rule (`react/jsx-no-target-blank`) pins the contract (`47f5904`).

### 5.7 The audio proxy and SSRF

The `/api/proxy/audio` route re-enables the Web Audio analyser graph
that was disabled in v2.20.0-R2 when `createMediaElementSource()`
started tainting cross-origin streams. The proxy serves bytes with
a permissive `Access-Control-Allow-Origin` header so the browser
can build the analyser from the bytes again.

The SSRF guard (FINAL-007, `9b519fa`) is the load-bearing piece.
[`_validate_upstream_url`](https://github.com/Lacuna-Labs/curator/blob/main/curator-api/curator_api/routes/proxy_audio.py)
does a single `getaddrinfo` resolution at validation time, captures
every returned IP, and hands the set to a custom `httpcore` network
backend (`_PinnedDNSBackend`) that rewrites the connect target to a
validated IP literal and refuses any other address. The OS resolver
never gets a second chance at connect time.

Pre-fix, `getaddrinfo` validated once and `httpx` re-resolved on
connect — the classic DNS rebinding window to `127.0.0.1` /
`169.254.169.254` after the first answer. `follow_redirects=True`
widened the window on every hop; the post-fix route is
`follow_redirects=False`, the 30x response rides back to the browser
unchanged so the `<audio>` element follows under its own
browser-enforced origin policy.

The Wave-2 Slice-α audit verified the `_PinnedDNSBackend` preserves
SNI / TLS verification — `httpcore` derives `server_hostname` from
the URL origin, not from the substituted host literal. Routing the
connect to an IP while keeping the SNI hostname is the correct shape.

Auth-gated (401 on missing session). Private + loopback + link-local
+ reserved IP space rejected at validation. CORS origin allowlist
narrows to `*.lacunalabs.ai` and `localhost:3000` only — random
origins get no ACAO header back. Per-operator rate limit (12 streams
per 60s).

---

## 6. Input validation

### 6.1 The ingest chain

Every operator-authored ingest passes through a validation chain
before bytes reach Cortex. The chain is the kind enum guard, the
feature-gate check, the secure-delete-on-reject sweep, the
Sakura-mediated diagnostic message, and the morals / ethics
dimension (operator content that crosses a hard rule gets refused
and audited). The contract is uniform: a rejection wipes the partial
artifact, names the rejection class to the operator without exposing
internal failure surface, and leaves no remnant on disk.

The secure-delete primitive is the same one Engram's
`forget_operator` uses — overwrite then unlink — with the same SSD /
log-structured caveat called out at the top of `secure_delete`'s
docstring.

### 6.2 Pydantic at the API boundary

Every authenticated route has a Pydantic body schema. The schemas
were the IDOR exposure surface in the Wave-1 audit — sixteen sites
in `routes/stores.py` and `routes/sakura_tools.py` still declared
`operator_id: str = Field(..., min_length=1)`. Every reachable
handler correctly used `current_operator_id(request)` and ignored
the body field, but the schema is the contract the FE writes
against and a future regression that re-reads `body.operator_id`
would silently re-introduce the IDOR.

The fix is to strip the dead fields entirely (FINAL-025). FastAPI's
default `model_config` ignores unknown fields, so existing FE
clients that still post the dead `operator_id` will not break. The
integration test `test_idor.py` should cover every operator-scoped
route by posting a cross-operator `body.operator_id` and asserting
the session id wins.

### 6.3 Webhook HMAC verification

[`stores/webhook_signatures.py`](https://github.com/Lacuna-Labs/curator/blob/main/curator-api/curator_api/stores/webhook_signatures.py)
holds the per-platform verifiers. The shape:

- 300-second freshness window (replay-protected against captured signed bodies older than the window).
- Process-local nonce ring (FIFO 256) for intra-window dedupe — see §10 for the multi-machine caveat.
- `hmac.compare_digest` for constant-time compare.
- Shop key bound to the **body-derived** shop identity, not a header-claimed one. The body is what the platform actually signed.

The Shopify branch (FINAL-006, `2122073`) re-keys with the bare app
secret — real Shopify signs `orders/create` with the bare app
secret, not a `derive_shop_key`-rekeyed one. The earlier mistake
(`derive_shop_key` for Shopify too) was a coarse 403 fail-closed on
every real webhook; today's behavior accepts real Shopify signatures
and rejects forgeries.

The internal-bearer escape hatch on the sale-event route
(FINAL-016, `e65fe12`) drops the `X-Shopify-Shop-Domain` header
fallback unconditionally. The bearer path now requires the body to
carry the signed shop domain; a holder of the internal bearer can no
longer forge a sale onto an unrelated mapped shop's ledger.

The Wave-1 verified-clean column includes
`webhook_signatures.verify_etsy`, `verify_ebay`, `verify_meta` with
the carry-over (FINAL-066) that a real platform-signed body for
eBay and Meta was not round-tripped through the verifiers in the
audit pass. The Wave-2 Slice-α `2f6a5c6` aligned the Meta
`business_id` shop-key gap. The eBay / Meta round-trip is still
SECOND-WAVE.

### 6.4 The webhook re-bind hazard

`stores/webhook_operator_map.py:register` accepts a re-bind under a
different operator (FINAL-038). The re-bind is logged but not
refused; the only platform-side barrier is OAuth flow completion.
A future OAuth flow that completes for an already-mapped shop hijacks
the attribution — every subsequent webhook for that shop credits
the new operator.

The fix (SECOND-WAVE): refuse re-binds unless `force=True` admin
parameter, or escalate the log to an audit entry plus on-call alert
(financial-ledger event). The hazard today is low base rate (real
OAuth flows do not complete twice for the same shop in practice),
but it is the kind of base-rate-low / blast-radius-high event that
warrants an explicit alert.

### 6.5 The chat role gate

The chat router accepts a `from` field on the message body
(`from='operator'` or `from='sakura'`). Pre-fix, the operator could
self-set `from='sakura'`, which let a malicious FE script craft a
fake Sakura message in the same operator's view (XSS-adjacent;
self-impersonation only — bounded to the operator's own inbox).

The Wave-2 Lane B fix (`2f6a5c6`) forces `from='operator'`
server-side on the standalone POST path. Sakura's voice routes
through `/api/sakura/chat`, which is a different surface with its
own authentication discipline. The self-impersonation vector is
closed.

### 6.6 Stripe webhooks

Stripe SDK HMAC verification, no fallback secret, no header-derived
attribution. The verified-clean row in Wave-1. The route is the
only financial-ledger writeback path — keeping it tight is
non-negotiable.

---

## 7. Webhooks and the supply chain

### 7.1 Self-host the dangerous

The wllama WASM (on-device LLM inference) is self-hosted, not loaded
from a CDN (`e896d3c`). The eruda devtools shim was removed from
the production bundle (`e896d3c`). The world-atlas topojson the
WeatherGlobe and RadioGlobe cards fetch from `cdn.jsdelivr.net` is
the remaining CDN load (FINAL-036) — CSP `connect-src` blocks it at
runtime today, but the source bug is open. The fix is to self-host
the file under `/assets/world-atlas/` and update the two card
imports.

Sentry is self-hosted on Lacuna infrastructure. The `beforeSend`
hook runs the `redactString` chain over every error message and
breadcrumb so operator words and identifiers do not leak in stack
traces. The Wave-1 Slice-D verified-clean row includes the
`CardCrashBoundary` flow: `error.message` through `redactString`
BEFORE render or chip emission.

### 7.2 Service worker hardening

The service worker carries a build-step version pin and cache-key
shape gates (`583f2aa`), a bypass list, and an origin guard
(`44062ec`). A `/sw-unregister.js` kill-switch endpoint is in place
(`e0204b3`) — if a poisoned SW ships, the kill switch wipes it on
next page load without requiring a forced cache invalidation.

### 7.3 The Scheme runtime sandbox

Sakura's on-device interpreter runs Scheme code emitted by the model
or carried in carts. The runtime is in `curator-web/src/scheme/`. The
sandbox today is **discipline plus environment freezing**, not a
realm boundary. The Wave-1 Slice-B audit was explicit about this:
canon §8.9.2's "interpreter exploit cannot reach the DOM" claim is
discipline + `Env.freeze`, not the worker realm. See FINAL-044 for
the wire-up gap.

What is in place:

- `Env.prototype` is frozen at module load (`Object.freeze(Env.prototype)`, tested).
- `env.freeze()` runs AFTER every installer and BEFORE user code, in every public entry. `(define eval …)` and `(set! car …)` throw `"frozen sandbox"`.
- Macro expansion runs BEFORE the verb walk at the gate (`expandProgram` → `walkVerbCalls`). `MACRO_GATE_FUEL=100000` and `MAX_EXPAND_DEPTH=400` bound runaway expansion.
- `walkVerbCalls` does not descend into `quote` subtrees; `quasiquote` walks only `unquote` islands.
- The deterministic-RNG installer (`installSeededRandom`, `3da61f8`) and the verb-collision precedence guard (`assertVerbPrecedence`, `a654ffa`) both hold.
- No `eval`, no dynamic `Function` constructor, no dynamic-import-from-string is reachable from the interpreter.
- The intent → Scheme decoder is provenance-aware. The X7 untrusted-provenance preflight (`firstGatedVerb` walking the WHOLE decoded form via `walkVerbCalls`; `GATED_PERMS` intersects sakura floor) is real and reachable.

What is not in place:

- The per-kind worker pool plus `originGate.evaluateOrigin` is built and unit-tested but has zero production importers. The live dispatch path is `runCartLive` → `dispatchScheme` → `runWithCards` on the main thread.

The honest claim today is "sandboxed interpreter — `(define eval …)`
and `(set! car …)` throw, no `eval` / dynamic `Function` constructor /
runtime remote-import reachable; defense-in-depth worker realm built,
not wired." The stronger claim ("interpreter exploit cannot reach the
DOM") is held until the wire-up lands, per the §11.1 owner decision.

### 7.4 The gate expansion invariant

The dispatcher's gate (`dispatchScheme`) expands the user source
before walking it for verb calls. The runner (`evalSource`) expands
the joined tree (prelude + user). FINAL-019 is the latent invariant:
the gate-table must be a SUPERSET of the runner-table. Today the two
are disjoint. A future prelude `define-syntax` becomes a gate-bypass
primitive the day someone adds one.

The fix is to pass the same prelude into the gate's `expandProgram`,
or to lint-forbid `define-syntax` in any prelude and assert it. The
invariant must be testable.

### 7.5 The audit record

Every dispatch emits an audit line. The line carries `traceId`,
`caller.tier`, `result.code / reason`, and the canonical verb name.
The line shape is frozen by
`AUDIT_LINE_KEYS = Object.freeze([...])` so a corrupt sink cannot
write extra fields. Reject and accept share `buildAuditLine`; both
sides carry the same shape.

Two structural concerns:

- **The `CART_END` reason collapse (FINAL-042).** The bus terminal collapses every dispatch envelope (perm-denied / confirm-required / rate-limit / arg-shape / parse-error / fuel-exhausted) into one `'denied'` symbol. A security rejection looks the same as a typo. The fix threads `dispatch.reason` onto `CART_END` and introduces a distinct terminal-outcome kind for gate-rejections vs runtime errors.
- **The `mintTraceId` entropy (FINAL-045).** The traceId is the only key stitching dispatch across the four sinks (logbus, chipSink, Atlas, future Cortex mirror). `Math.random().toString(36).slice(2,6)` plus counter gives roughly 36 bits. A writer to any single sink (chipSink reachable from many modules) can collide with a real privileged dispatch's id and shadow the forensic record. The fix is `crypto.randomUUID()` with the counter kept as tiebreaker.

Combined with FINAL-046 (`window.__chipSink` is a same-origin global
in production builds), the practical attack on the forensic record is
to mint a colliding traceId and write a poisoned chip line. The fix
is to gate the global behind `import.meta.env.DEV` and require a
server-issued HMAC on security-relevant chip kinds.

### 7.6 `npm audit` baseline

The Caliper run on 2026-06-13 reported 2 critical / 1 high / 5
moderate npm advisories. The headline numbers are misleading: the
two criticals (vitest, esbuild dev server) are dev-only and do not
ship in the production bundle. The Caliper `active_security` runner
does not distinguish; the read-by-hand pass does.

The standing rule: any production-bundle CVE is a Caliper Fix Lane 1
row. Dev-only CVEs ride the upgrade cadence.

---

## 8. Race conditions and atomicity

### 8.1 Atomic writes

Every multi-byte write to disk goes through the `tempfile.mkstemp`
plus `os.replace` pattern. The Engram chunk write and snapshot write
both learned this (`04f59e4`) from the shim's prior mistake — a
stable `.tmp` filename (`path.with_suffix(".enc.tmp")`) races
concurrent writers, the loser's `os.replace` hits a tmp the winner
already moved, and the result is either `FileNotFoundError` or a
torn chunk. The fix:

```
fd, tmp_name = tempfile.mkstemp(
    prefix=".chunk-", suffix=".enc.tmp", dir=str(path.parent),
)
```

Per-write unique tmp name. Both writes complete; last-write-wins on
the final filename is fine because the chunk is opaque ciphertext.
`BaseException` cleanup so `KeyboardInterrupt` / `SystemExit` do not
leak the tmp.

### 8.2 The `forget_operator` typed-error wrap

Covered in §4.3. The R2-MED-2 follow-up (`f9233ff`) wraps the
`shutil.rmtree` call in a `try / except OSError` and re-raises as
`EngramForgetFailed` so the operator-facing contract is uniform —
caller catches one exception class, not two. The lstat side already
raised the typed error; aligning the rmtree side closes the
caller-side asymmetry.

### 8.3 The TOCTOU window

The window between `os.lstat` and `shutil.rmtree` is closed by
CPython's `shutil.rmtree.avoids_symlink_attacks` (True on the Linux
Fly target). The fd-based deeper fix is the canonical mitigation if
the trust boundary widens to "co-tenant write on the parent dir."
Today the parent is curator-owned and the deeper fix is not
necessary.

### 8.4 The `_currentCaller` stack discipline

The Scheme dispatcher's `_currentCaller` is a module-mutable
singleton, restored in a `try / finally`. Safe under the
synchronous runner — every dispatch enters, sets, runs, restores,
exits. The worker-port spec (FINAL-047) is the latent footgun: if
the runner ever becomes async and two dispatches interleave, the
singleton tier could leak between calls. The mitigation is to
thread `caller` through every API boundary explicitly (already
half-done via `cardDo`'s `opts.caller`) and deprecate the
singleton. Finish before the async port lands.

---

## 9. Vulnerability management

### 9.1 The Caliper pipeline

[`CALIPER-RUN-2026-06-13.md`](https://github.com/Lacuna-Labs/curator/blob/main/docs/CALIPER-RUN-2026-06-13.md)
is the canonical category-by-category quality run that gates pre-prod
review. It blends Lighthouse 13.4, axe-core 4.11, npm audit,
bundle-size measurement, and a curl-and-grep header check.

The categories Caliper covers:

- performance (LCP / TBT / FCP)
- accessibility (Lighthouse + axe blended)
- vitals (Core Web Vitals subset)
- SEO
- best-practices
- CSP / security headers
- bundle_size
- active_security (npm)

The CSP / dep-CVE category is the one that lands in this manual.
The dev-preview header check is uninformative (Vite preview is a
static dev server with no header policy) and must be re-run against
the prod target (`https://sakura.lacunalabs.ai`) to score the real
headers.

### 9.2 The merged-findings sheet

[`SECURITY-MERGED-FINDINGS-2026-06-13.md`](https://github.com/Lacuna-Labs/curator/blob/main/docs/SECURITY-MERGED-FINDINGS-2026-06-13.md)
is the single source of truth for the rolling fix cycle. Every
finding gets:

- a `FINAL-NNN` id stable across the fix cycle,
- a severity inheriting the most severe call across review slices,
- a one-sentence risk,
- a fix shape,
- a blast-radius classifier (operator / multi-operator / global),
- a confidence (CONFIRMED / NEEDS-TRACE),
- a sequencing tag (FIRST-WAVE / SECOND-WAVE / OWNER-DECISION / DEFER).

The Wave-1 burn-down sheet hit 66 findings — 4 CRITICAL, 15 HIGH,
24 MEDIUM, 23 LOW. Wave-2 verification ran the same day and
confirmed all eight first-wave-queue commits structurally correct,
opened 21 follow-up findings (0 CRITICAL, 0 HIGH from re-audit), and
closed four (`f9233ff`, `b5fbb3a`, `9ceb983`, `2f6a5c6`).

### 9.3 The fix-wave cadence

Findings flow through three lanes:

1. **First-wave queue** — standalone-fixable rows with confirmed confidence, ranked by blast radius and fix simplicity.
2. **Owner-decision queue** — rows whose fix shape depends on a product call (the "built-but-not-wired" architectural decision is the canonical example).
3. **Second-wave queue** — rows that depend on a first-wave fix or on an owner decision settling.

The standing rule is that a row in the second-wave queue does not
get touched until its blockers settle. The "built-but-not-wired"
five-row class is the largest example: the modern per-operator
Cortex, the hardened Engram storage backend, the worker-pool path,
the manifest v2 capability surface, and the async-SHA-256 HMAC all
have hardened replacements that exist but do not run. The fix cycle
treats this as one owner decision (wire the seams behind a flag, or
reword the canon and customer copy to current tense), not five.

---

## 9a. Verified-clean — the surfaces we trust

The flip side of the open-gaps list. The Wave-1 and Wave-2 audits
exercised the following surfaces end-to-end and found them correctly
built. Review #3 (when it runs) does not re-audit these unless the
underlying code has changed; the git log filter is the test.

**Identity and session.**

- `_session.current_operator_id` and `enforce_operator` — the session-bound seam is sound on every Wave-1 audited route.
- `routes/sakura_tools.tools_dispatch` (W1-2 closure) and the consent ledger (single-use, `(tool, operator, args_fp)`-bound, 5-minute TTL, canonical-JSON SHA-256 args fingerprint).
- `routes/oauth.py:oauth_callback` — the documented exception to "session-bound only"; operator id from server-side PKCE state. Verified clean (FINAL-062).
- `routes/stores.py` per-platform OAuth callbacks (operator from PKCE state, never from the wire).
- `routes/sale_events.py:_operator_for_webhook` (payload `operator_id` advisory only; resolves through signed shop key) — see FINAL-006 for the Shopify sibling that was fixed in this wave.
- `routes/account_gdpr.py` (session + fresh-session + rate-limit + server-looked-up email).
- `routes/admin.py:_require_admin` (non-admin 404 — no surface leak).

**Webhook verification.**

- `webhook_signatures.verify_etsy` / `verify_ebay` / `verify_meta` — constant-time compare, 300s freshness, nonce ring. Wave-2 Slice-α re-audited the deeper trace (FINAL-066) and aligned the Meta `business_id` shop-key gap in `2f6a5c6`.
- The Stripe billing webhook (Stripe SDK HMAC, no fallback secret).
- The Wave-2 verification of `_PinnedDNSBackend` preserving SNI / TLS verification on the audio proxy path.

**Cryptography.**

- `cortex_crypto.seal` produces `CXE1:<header>.<ct>` with `os.urandom(12)` nonce, header bound as AAD, AES-256-GCM via `cryptography`.
- `cortex_crypto.open_envelope` propagates `InvalidTag`; never returns plaintext on tag failure.
- `cortex_crypto.assert_cortex_crypto_configured` is backend-agnostic and wired into app boot; fail-closed on missing crypto library or missing key.
- `cortex_crypto.seal_props` / `unseal_props` are idempotent on re-seal; non-string and empty values pass through; structural/index props deliberately untouched.
- `cortex/memory.py:_SealingStore` is a clean transparent proxy.
- `sync/crypto.encrypt_envelope` and `decrypt_envelope` — version + alg + 32-byte key + 12-byte nonce + GCM. The MEDIUM-2 AAD gap is the only structural concern; the rest is textbook.

**Storage.**

- `engram/storage.py:op_hash` — full 64-hex sha256, deterministic, anonymous fallback.
- `engram/storage.py:_op_dir` — strict `[0-9a-f]{64}` regex; rejects every shape of traversal.
- `engram/storage.py:_chunk_path` — `_parse_chunk_ref` rejects anything outside `\d+-\d+`; the malformed-chunk-ref test pins `../../../etc/passwd` and `notarange`.
- `engram/storage.py:ObjectStoreEngramStorage` — every method raises `NotImplementedError` with a clear message. Honest stub.
- `engram/storage.py:forget_operator` interior idempotence (legitimate-empty path) — the symlink defect (FINAL-009) and the typed-error wrap (R2-MED-2) are closed in Waves 1 and 2 respectively.

**Frontend.**

- React raw-HTML injection — zero direct-HTML-prop occurrences in `curator-web/src/`.
- Direct-DOM-string write APIs (`innerHTML` / `outerHTML` / the legacy `document` writer) — zero occurrences; three explicit "no-direct-HTML" comments.
- `target="_blank"` plus `rel="noopener noreferrer"` — twelve sites swept, all clean.
- `<a href={…}>` open-redirect — `safeRedirect.js` rejects `javascript:` and `data:`; ten of eleven non-helper sites use it.
- `<iframe sandbox=…>` — zero `allow-scripts allow-same-origin` occurrences; YouTube card iframes are cross-origin and CSP `frame-src` is tight.
- `CardCrashBoundary` — `error.message` through `redactString` BEFORE render or chip emission; chips fail open-loop; Sentry `beforeSend` scrubs.

**Scheme runtime.**

- `Env.prototype` frozen at module load.
- `env.freeze()` after every installer, before user code, in every public entry.
- Macro expansion runs before the verb walk at the gate.
- `walkVerbCalls` does not descend into `quote` subtrees.
- Deterministic-RNG installer and verb-collision precedence guard both hold.
- No `eval`, no dynamic `Function` constructor, no dynamic-import-from-string reachable.
- `sound.js` and `fx/effects.js` `Math.random` survivors are deliberately outside determinism-critical paths.

The standing rule: a row enters the verified-clean column only when
the audit traced it end-to-end against the threat model. Verified-
clean is not "looks fine"; it is "I followed the bytes."

## 9b. Drift detection — the cross-product rule

The single recurring class across all six waves of audits is the
doc-versus-code drift: a canonical document names a control or a
behavior, the code is two refactors past the wording, and customer
copy reads against the document. The Wave-1 cross-cutting slice
named it as the "built-but-not-wired" pattern (§11.1); the broader
shape applies to every canonical doc in the repo.

The rule: every customer-visible claim is matched against the
current code at every Wave. Three mechanical checks pin this:

1. **Symbol-citation discipline.** Every claim in this document and the HelloSurface manual cites a file and a symbol, not a line. The grep is the canary: when a renamed symbol breaks the link, the cite is stale and the wording behind it is also stale until it gets re-verified.
2. **The verified-clean column.** Every review wave's verified-clean rollup names the surfaces it traced end-to-end. The next Wave does not re-audit those unless the underlying code changed. The git log filter is the test: if any file in the verified-clean column has a commit between Waves, the row is re-audited.
3. **The honesty-gate review.** Before any customer copy ships, the engineering team runs the copy through the matched-claims test. A claim that names a control by name (HMAC, zero-knowledge, end-to-end) cites the code that delivers it. If the citation does not survive a `grep`, the claim does not ship.

The drift class is the reason the per-product `SECURITY-DEVELOPMENT.md`
files exist. They are operational read-first documents, narrower
than this manual, with rules + threat models + validator chain +
cookbook + pre-PR checklist + do-not-pull list + incident response.
This document is the broader manual; the per-product doc is the
day-to-day reference. Both are kept current together.

## 10. Multi-machine scale and the process-local rings

### 10.1 The four rings

Four correctness rings live as process-local `OrderedDict`s today:

- `routes/sakura_tools.py:_CONSENT_TOKENS` — the consent ledger for destructive Sakura tools.
- `routes/stores.py:_SHOPIFY_WEBHOOK_SEEN` — Shopify webhook dedupe.
- `stores/webhook_signatures.py:_NONCE_RING` — per-platform replay protection.
- `stores/sale_events.py` — sale-event dedupe.

`assert_single_worker_invariant` gates more than one worker per
**process**, not more than one **machine**. Today `fly.toml` ships
one warm machine, so the exposure is latent.

### 10.2 What happens at scale

Two failure modes activate the moment a second machine boots:

- **Consent redemption fails closed.** Worker A mints a token, worker B receives the redemption. The token is not in B's ring. Sakura reports failure. User-visible but not exploitable — fail-closed.
- **Signed webhooks fail open.** An attacker captures a real signed webhook within the 300s freshness window and replays it to each machine. Each machine's `_NONCE_RING` is empty for the nonce, both accept, `record_sale` runs once per machine, duplicate financial events.

The second is the real cost.

### 10.3 The boot gate

The standing recommendation (owner decision §6 on the merged sheet)
is default-deny: ship `assert_single_machine_invariant` paralleling
the single-worker check, refusing to boot machine #2 unless the
shared store is configured. The alternative is a shared store
(Redis or one durable Fly Volume with atomic ops) for all four
rings. Either way the scale-up does not happen without the boot
gate.

Tracked as FINAL-017 / FINAL-024. Owner-blocked.

---

## 11. Open gaps and owner decisions

The list every reader of this document deserves to see. The Wave-2
cross-cutting slice (`67f6609`) is the canonical rolling source; the
shape below is the snapshot.

### 11.1 Built-but-not-wired — five rows, one owner call

The architectural call described in §9.3. Five hardened replacements
exist; the live path runs the legacy one in each case.

| # | Hardened path that exists | Live path that runs |
|---|---|---|
| 1 | `engram/storage.py` (op_hash, fail-loud `_op_dir` regex, atomic writes, `EngramForgetFailed`) | `cortex/memory.py:store_for_operator` `_safe_operator_id` slug (48-bit hash tail), `EnvKeyProvider` server-resident key. The `engram/storage.py:19` TODO still names a legacy `engram/store.py` that is absent at HEAD `d4f5a8a4` — see §3.4. |
| 2 | Phase 4–6 per-kind worker pool + `originGate.evaluateOrigin` | Synchronous main-thread `runCartLive` → `dispatchScheme` → `runWithCards` |
| 3 | Modern per-operator Cortex via `routes/stores.py:_listing_store` | Legacy `/api/listings` by-id handlers on the shared SQLite `listings` table (no `account_id`) — FINAL-001. Collection enumeration is now admin-404-gated (2026-06-13); the by-id read/mutate handlers are still ungated — see §11.2. |
| 4 | Manifest v2 (CARD-MANIFEST-CONTRACT-v2 capability surface) | `CardTemplate._manifestForKind` reads `.manifest` off an address STRING → every card mounts `manifest: null`; fix `701a3f8` lives on `HelloSurfaceFix`, unmerged |
| 5 | ~~Async `hmacHex` (real SHA-256) in `lib/persistSign.js`~~ — **RESOLVED 2026-06-13** (FINAL-013): `hmacHexSync` now uses real SHA-256 HMAC via `@noble/hashes`; sync API preserved, all consumer sites unchanged | ~~`signPayload` calls `hmacHexSync` (keyed FNV-1a) on every hot path~~ |

The owner decision is one of two postures, applied to all five (or
split deliberately):

1. **Wire the seam behind a flag.** The canon and customer copy become true present-tense claims.
2. **Reword the canon and customer copy to current tense.** The legacy path keeps serving until the wiring lands; nothing in customer-facing surface claims a capability that is not real.

The default-deny posture per `[[no-false-product-claims]]` is (2)
until (1) lands. The fix cycle does not start on rows 3 / 4 / 5
without an owner pick.

### 11.2 Legacy `/api/listings` — FINAL-001 (partially closed 2026-06-13)

The CRITICAL on the Wave-1 sheet. Routes on the legacy
`/api/listings` family in `app.py` hit a shared SQLite `listings`
table with no `account_id` column.

**What is closed.** The collection enumeration endpoint
`app.py:list_listings` (`GET /api/listings`) is now admin-gated
(2026-06-13): a non-admin caller gets a bare `404` — not `403` — so
the route looks identical to an unmounted one and leaks no existence
signal. `list_trash` (`GET /api/trash`) shares the collection shape.
The cheapest-fix path from the original finding (404-gate behind
`request.state.is_admin`) landed for the enumeration surface.

**What is still open.** The singleton and mutation handlers —
`get_listing`, `create_listing`, `update_listing`, `delete_listing`,
`restore_listing` — take no `request`, no session, and no admin
check. A signed-in beta operator who knows or guesses a `listing_id`
(a v4 UUID, so not trivially enumerable, but recoverable from a
shared bench or a leaked draft URL) can still read, patch, delete, or
restore another operator's listing directly by id. The table still
has no `account_id` column, so there is no operator-scoping to
enforce even if the handlers took a session.

The residual fix is the table migration (add `account_id`, backfill,
refuse writes without it) plus threading `current_operator_id` /
`enforce_operator` through the five by-id handlers — or, cheaper as
an interim, admin-gating the by-id handlers too until the migration
is sized. The modern `/api/stores/{op}/...` path
(`routes/stores.py:_listing_store`) is the canonical replacement and
is operator-scoped by construction; the FE already reads and writes
through it. FINAL-001 stays open at reduced severity until the by-id
handlers are gated or migrated.

### 11.3 The frontend HMAC story — resolved 2026-06-13 (FINAL-013)

Originally flagged in the merged findings as the single most
surprising gap: the hot path in `lib/persistSign.js` (`signPayload`,
`verifyAndRead`, every `localStorage`-backed cart, draft, position,
and consent token) called `hmacHexSync`, which was **keyed FNV-1a**,
not HMAC. FNV is a non-cryptographic hash; a devtools-resident
attacker could mint a valid signature in milliseconds. The codebase
called it "HMAC" and the canon copy (Rule 5 / S3) named HMAC as the
contract; the code did not deliver it.

**Resolution.** `hmacHexSync` now uses real SHA-256 HMAC via
`@noble/hashes` — audited pure-JS, ~2-3KB gzipped, no native deps,
runs in browser + jsdom + Node alike. The sync API is preserved so
the 12+ consumer sites (zustand reducers, render paths, setItem
callbacks) did not need an async sweep. The async `hmacHex` is
retained as an alias for callers that prefer Web Crypto and falls
back to the same noble path. Every previously-signed envelope is
invalidated by the swap (16-char FNV digest vs 64-char SHA-256
digest); operators get clean defaults on the first read after
upgrade — the correct posture, since FNV signatures should not
validate.

Tracked as FINAL-013, CLOSED.

### 11.4 The `localStorage` operator-content gap

FINAL-034 is the broader version of FINAL-013. Several cardKit cards
write operator-owned content to `localStorage` without
`signPayload`:

- `MessagesCard:saveLocal`
- `NotepadCard:saveLocal`
- `CalendarCard:save`
- `WeatherCard:HOME_STORAGE_KEY`
- `MetaDashboard:PLATFORM_STORAGE_KEY`

These are direct violations of canon pre-PR rule 11. The fix wraps
every operator-content `localStorage.setItem` with `signPayload`,
every read with `verifyAndRead`, and restores defaults on signature
mismatch. The existing patterns for `cardSizeMemory`,
`positionMemory`, and `vendorConnections` show the shape.

This was downstream of FINAL-013: until the underlying primitive
became real HMAC, signing operator content with `signPayload` was
the wrong dependency to deepen. FINAL-013 closed on 2026-06-13
(SHA-256 HMAC via `@noble/hashes`, sync API preserved); FINAL-034
is now unblocked and the wrap pattern (mirroring
`cardSizeMemory` / `positionMemory` / `vendorConnections`) can land.

### 11.5 The voice-path transfer confirmation

Wave-1 Slice-A noted that the body-side
`requestTransferConfirmation` await is the unlanded hardening for
voice-path destructive verbs. The surface-service event (G4-2) is
closed at the dispatcher; the body-side await is the second wall.
The v2.20.0-S5 task in SECURITY-DEVELOPMENT.md is the open lane.

### 11.6 Multi-machine scale

§10. Owner-blocked. The boot gate is the default; the shared store
is the canonical fix.

### 11.7 Lacuna roster and worker-template constraints

Lacuna is the worker / SRE / system-administration roster that lives
alongside Sakura. Lacuna 14B is the tier-permissioned daemon — its
capability matrix is `READ / WRITE / EXEC` on the axes `LOCAL / NET /
USER / ROOT`, with the default tier denying every cell except READ
LOCAL and READ NET.

Three guidance rules apply to Lacuna's security posture in this
manual's scope:

1. **Constrain with shells, not free-form.** Lacuna's specialty is worker-template-following, not deep particulars. The discipline of running it inside a tight shell with a hard timeout and a single-shot redirect is the security boundary. Free-form invocation is the hazard.
2. **The Sentinel / Warden gatekeeper.** A dedicated 3–7B LLM gatekeeps Lacuna's actions dialectically. Single responsibility, narrow corpus (5k–10k pairs), defense in depth. Build target v0.7 / v0.75 per the roadmap. Until the Sentinel lands, Lacuna's tier ceilings are the only check.
3. **Lacuna is not Sakura.** Lacuna 14B v1 carried roughly 7 percent Curator-canon drift (internal-canon plus cart-spine) flagged for cut. Sakura's corpus does not bleed into Lacuna's, and vice versa.

The Forge training pipeline produces both Sakura and Lacuna models.
The standing rule for the corpus: no operator-authored PII enters
the training set. The corpus is synthetic instruction-following
data, vetted before training. The Forge persona spec (in the Forge
repo) carries the full discipline.

### 11.8 Engram backend wire-up

The §4.6 honest status. The hardened storage seam does not yet have
a production caller. Customer copy stays at "encrypted at rest"
until both the wire-up and the keystore provider land.

### 11.9 Open audit items

The Wave-1 cross-cutting slice's "no verdict" list, carried
forward:

- The 8-stars guard surface (`safetyStars.js`) — `validateRegistry` is wired but per-call-site `guard:` declarations were not enumerated. The lint rule in the cookbook needs verification.
- Voice-path transfer confirmation enforcement (rule 10) — see §11.4.
- CSP `connect-src` for the world-atlas + WASM CDN fetches — FINAL-036.
- The sync routes' encrypted-batch contract — `derive_key` exported but no server-side caller (FINAL-028 tripwire).
- The eBay / Meta verifier round-trip — FINAL-066 deeper trace.

---

## 11a. Threat catalog by class

The finding ledger groups by symbol; the threat catalog groups by
attack class. This section names each class once with the mitigation
shape, the detection signal, and the relevant FINAL ids — so a
reader who is staring at a suspicious symptom can map it back to a
known shape.

### Class 1: IDOR (Insecure Direct Object Reference)

**Shape.** An authenticated operator reads or writes another
operator's data by supplying a non-self `operator_id` (in body, query,
path, or header) and the route trusting the value.

**Mitigation.** `current_operator_id(request)` is the only authority.
Path-borne `operator_id` goes through `enforce_operator`. Ownership
follows on top of identity (the `_enforce_bug_ownership` shape).

**Detection signal.** A 403 `operator_mismatch` rate spike, a 403
`bug_not_accessible` rate spike, or a route handler reading
`body.operator_id` directly. The `grep` for the second is the audit.

**Relevant.** FINAL-001, FINAL-005, FINAL-022, FINAL-023, FINAL-025,
FINAL-038, FINAL-039.

### Class 2: false-erasure

**Shape.** A right-to-forget request returns success without actually
purging the ciphertext. Two sub-shapes: silent failure (the call
swallows an error) and partial failure (the local purge succeeds but
the replica retains).

**Mitigation.** Typed exceptions (`EngramForgetFailed`,
`CortexPurgeUnsupported`) that the caller surfaces. Post-checks
after the delete. Operator-id binding on the propagator.

**Detection signal.** An `EngramForgetFailed` raise in the
operational logs. A `purge_summary` skip rate spike. A delta between
local-purge count and propagated-purge count.

**Relevant.** FINAL-009, FINAL-010, R2-MED-2, R2-MED-3.

### Class 3: webhook forgery

**Shape.** An attacker forges a webhook event that lands on the
financial-ledger writeback path. Three sub-shapes: HMAC bypass
(the verifier rejects real signatures and accepts forged ones),
attribution-header trust (the attacker names the target shop via an
unsigned header), and bearer-bypass replay (the attacker reuses a
captured internal bearer token).

**Mitigation.** Bare-platform-secret HMAC, body-derived attribution
(never header-derived for the canonical case), single-use bearer
tokens. The Shopify branch is the canonical shape after FINAL-006
and FINAL-016.

**Detection signal.** A 403 webhook rejection rate spike for one
platform. A `record_sale` duplicate event. A bearer token reuse log
entry.

**Relevant.** FINAL-006, FINAL-016, FINAL-024, FINAL-066.

### Class 4: SSRF

**Shape.** A server-side fetch resolves a hostname twice — once at
validation, once at connect — and the attacker rebinds DNS between
the two to point at a private address.

**Mitigation.** Single-resolve, then connect to the IP literal via a
custom transport. Disable `follow_redirects` or validate redirect
targets through the same gate. The proxy_audio route is the
canonical shape.

**Detection signal.** A `_PinnedDNSBackend` reject log entry. A
proxy_audio rate-limit spike from a single operator (probing for
the rebind window).

**Relevant.** FINAL-007.

### Class 5: XSS via attacker-controlled href

**Shape.** A `<a href={…}>` attribute receives an attacker-controlled
string whose scheme is `javascript:`, `data:`, or `vbscript:`. The
operator taps the chip, JS executes in the curator origin, full
session compromise.

**Mitigation.** `safeHref` allowlist (`http:`, `https:`, `mailto:`),
plus userinfo rejection, plus IDN homoglyph rejection, plus mailto
CRLF rejection. Zod schema refine plus render-time call.

**Detection signal.** A CSP `script-src` violation report. A
`safeHref` reject log entry on a provenance render path.

**Relevant.** FINAL-012, FINAL-055, FINAL-033, R2γ-1.

### Class 6: at-rest plaintext leak

**Shape.** Operator PII lands on disk in cleartext because the seal
predicate did not cover the prop name.

**Mitigation.** The `_should_seal_key` predicate's prefix convention
(`operator_*` minus `_OPERATOR_STRUCTURAL`) is safer-by-default. New
sheet fields are sealed without an allow-list edit.

**Detection signal.** A grep over the on-disk Cortex snapshot for
operator-typed strings. The
`test_save_correction_writeup_not_plaintext_on_disk` invariant.

**Relevant.** FINAL-002, FINAL-003, FINAL-015, FINAL-018, FINAL-060.

### Class 7: process-local-ring replay at scale

**Shape.** A correctness ring (consent token, webhook dedupe, nonce
ring, sale-event dedupe) lives in process memory. The first machine
sees the event, the second does not. A signed webhook replayed to
both machines is accepted by both.

**Mitigation.** Boot-time `assert_single_machine_invariant`
refusing machine #2 unless a shared store is configured. Or move
the ring to a shared store (Redis / Fly Volume + atomic ops) before
scale-up.

**Detection signal.** A second Fly machine entering the warm pool
without the shared-store env var. Duplicate financial events
(same `X-Shopify-Webhook-Id`, two distinct `record_sale` rows).

**Relevant.** FINAL-017, FINAL-024.

### Class 8: false product claim

**Shape.** Canon or customer-facing copy claims a capability that
is not delivered by the current code. Five examples in §11.1.

**Mitigation.** The honesty gate (§1.3). Every claim cites the code;
the citation is the test. The default-deny posture per
`[[no-false-product-claims]]`.

**Detection signal.** A copy review against the matched-claims
test. A grep for "zero-knowledge" / "HMAC-signed" / "server cannot
read" that does not survive a verification trace.

**Relevant.** FINAL-013, FINAL-014, FINAL-015, FINAL-018,
FINAL-026, FINAL-044.

### Class 9: forensic-record poisoning

**Shape.** A same-origin script (devtools, future XSS) writes to the
audit sink and forges a traceId or a chip line, corrupting the
forensic record.

**Mitigation.** `crypto.randomUUID()` for traceId entropy. Gate the
`window.__chipSink` global behind `import.meta.env.DEV`. Require a
server-issued HMAC on security-relevant chip kinds.

**Detection signal.** A traceId collision rate spike. A chip line
that does not match a corresponding logbus line.

**Relevant.** FINAL-042, FINAL-045, FINAL-046.

### Class 10: rate-limit bypass via spoofed IP

**Shape.** A rate-limited surface keys on a client-controllable
header (`X-Forwarded-For`). The attacker rotates the header and
exhausts the per-IP budget against a paid backend (Gemini Flash,
Stripe).

**Mitigation.** Take rightmost-trustworthy hop from `X-Forwarded-
For`, or use `Fly-Client-IP`. Per-account / per-Fly-app token
budget as the deeper fix.

**Detection signal.** A single-route Gemini cost spike. A
`/api/public/ask` rate-limit hit count that wraps the per-IP budget
many times over.

**Relevant.** FINAL-021, FINAL-037, FINAL-049.

## 12. Disclosure and incident response

### 12.1 What we promise

Three commitments:

1. **Honest claims.** Every operator-facing capability claim is true in the present tense, or it is reworded until it is. The `[[no-false-product-claims]]` rule is non-negotiable.
2. **Fail-closed on cryptography.** Missing keys, malformed keys, missing `cryptography` library — all raise at boot, never at first write. `assert_cortex_crypto_configured` is the wired guard.
3. **Fail-loud on erasure.** A right-to-forget that did not complete raises a typed error (`EngramForgetFailed`, `CortexPurgeUnsupported`) so the caller surfaces it instead of reporting a silent false success.

### 12.2 The finding flow

A finding moves through:

1. **Discovery.** Internal review, external report, or automated sweep (Caliper, npm audit, codeql).
2. **Triage.** The finding gets a `FINAL-NNN` id in the merged sheet, a severity, a fix shape, and a sequencing tag.
3. **Owner decision** if the fix shape is gated on a product call.
4. **Fix.** A `sec(fix):` commit cites the FINAL id, the file and symbol, the threat shape, and the test that pins the fix.
5. **Verify.** A subsequent review wave confirms the fix structurally and at the seam. The Wave-2 verification slices are the canonical shape.
6. **Roll-up.** The next manual revision updates §11 and the appendix in §13.

### 12.3 The legal floor

Three categories of operator data need a longer view than the
engineering controls above. They are not covered in detail here;
this section names them so the next regulation pass has a starting
point.

**GDPR / CCPA delete-means-delete.** The right-to-forget path (§4.3
and §4.4) is the engineering surface. The legal floor is: once the
operator requests deletion, the artifact is gone from every system
the operator's data reached, within the regulatory window. The
hardest case is the Engram replica when wired — the device emits a
tombstone, the propagator carries it to every replica node, every
replica node confirms the deletion, and the confirmation is recorded
in an audit log the regulator can read. None of this is built yet;
the residency canon names it. The standing rule for today: nothing
ships that promises a delete-means-delete contract until the path is
end-to-end auditable.

**Consent and minor data.** Curator is built for adult sellers. The
product surface does not gate on age, and we do not collect age
verification. If a minor uses the product, the parent's recourse is
the right-to-forget path. We do not market to minors.

**Health data.** Out of scope. The product is a commerce-and-memory
product, not a health product. The Wave-1 / Wave-2 audits did not
identify any health-data ingest surface; if one is added in a future
release, this section needs a new subsection.

**Sue-able claims.** The honesty gate (§1.3) is the engineering
defense against the legal hazard of customer copy that overstates a
control. The single rule is `[[no-false-product-claims]]`: do not
write "zero-knowledge" or "we cannot read" or "HMAC-signed" until
the wire actually delivers it. The Caliper category-by-category run
gates this — every claim in the canon copy is matched against the
current code at every Wave.

### 12.4 What we ask of external reporters

For now, a private message to the maintainer suffices. The product
is in a small-cohort beta. A public disclosure channel ships with
the public beta cutover.

---

## 13. Route-by-route security inventory

The authenticated route surface as of HEAD `2f6a5c6`. Every row is
a `routes/*.py` file, the authentication seam, the verified-clean
status, and the relevant FINAL ids.

| Route file | Auth seam | Verified clean? | Open FINAL |
|---|---|---|---|
| `account_gdpr.py` | session + fresh-session + rate-limit + server-looked-up email | yes | — |
| `account.py` | `current_operator_id` | yes (Wave-1) | — |
| `admin.py` | `_require_admin` (non-admin 404) | yes (Wave-1) | — |
| `ai_panel.py` | `current_operator_id` | yes (Wave-1) | — |
| `ask_automation.py` | `current_operator_id` | yes; dead body field FINAL-064 | FINAL-064 |
| `bugs.py` | `current_operator_id` + `_enforce_bug_ownership` | yes (Wave-1 + Wave-2) | — |
| `cards.py` | `_operator_id` helper with `"anonymous"` fallback | latent multi-operator on RadioListen / RadioMoment | FINAL-022 |
| `chat_threads.py` | `current_operator_id` | yes (Wave-1) | — |
| `collection.py` | `enforce_operator` | yes (Wave-1) | — |
| `cortex_snapshot.py` | `current_operator_id` | yes (Wave-1) | — |
| `debug.py:flush_curator_home` | env-gated only | env gate insufficient | FINAL-063 |
| `deeper_reasoning.py` | `current_operator_id` | yes (Wave-1) | — |
| `doc_reviews.py` | admin gate after Wave-2 Lane B | yes (Wave-2) | — |
| `docs.py` | public (read-only) | yes (Wave-1) | — |
| `google_merchant.py` | OAuth + `current_operator_id` | yes (Wave-1) | — |
| `market_workers.py` | `_operator_from_request` with `"anonymous"` fallback | latent — same shape as cards.py | FINAL-022 |
| `memos.py` | `current_operator_id` | yes (Wave-1) | — |
| `messages.py:create_message` | `current_operator_id`; `from` field forced server-side post-Wave-2 | yes (Wave-2) | — |
| `oauth.py:oauth_callback` | server-side PKCE state | yes (Wave-1, FINAL-062) | — |
| `podcasts.py` | `current_operator_id` | yes (Wave-1) | — |
| `proxy_audio.py` | session + SSRF guard + `_PinnedDNSBackend` | yes (Wave-1 + Wave-2) | — |
| `public_ask.py` | rate-limited, public | XFF-trust hazard | FINAL-021, FINAL-037 |
| `radio_safety.py` | `current_operator_id` | yes (Wave-1) | — |
| `sakura_cart.py` | `current_operator_id` | yes (Wave-1) | — |
| `sakura_chat.py:sakura_chat_route` | `current_operator_id` | yes (Wave-1) | — |
| `sakura_live.py` | `current_operator_id` | yes (Wave-1) | — |
| `sakura_mood.py` | `current_operator_id` | yes (Wave-1) | — |
| `sakura_reliability.py` | `current_operator_id` | yes (Wave-1) | — |
| `sakura_tools.py:tools_dispatch` | `current_operator_id` + consent ledger (W1-2 closure) | yes (Wave-1) | — |
| `sakura_transcribe.py` | `current_operator_id` | yes (Wave-1) | — |
| `sakura_tts.py` | `current_operator_id` | yes (Wave-1) | — |
| `sale_events.py:shopify_sale_webhook` | HMAC + body-derived attribution | yes (Wave-2, post-FINAL-016) | — |
| `search.py` | `current_operator_id` | yes (Wave-1) | — |
| `sim.py` | `current_operator_id` | yes (Wave-1) | — |
| `stores.py` (per-platform OAuth) | server-side PKCE state | yes (Wave-1) | — |
| `stores.py:_listing_store` | session-bound | yes (Wave-1) | — |
| `studio_artifacts.py` | `current_operator_id` | yes (Wave-1) | — |
| `unknowns.py` | `current_operator_id` | yes (Wave-1) | — |
| `workflows.py` | `current_operator_id` | yes (Wave-1) | — |
| `app.py` legacy `/api/listings` collection (`list_listings`, `list_trash`) | `request.state.is_admin` 404-gate | closed for enumeration (2026-06-13) | FINAL-001 (partial) |
| `app.py` legacy `/api/listings/{id}` by-id (`get_listing`, `create/update/delete/restore_listing`) | none — no session, shared SQLite table, no `account_id` column | HIGH open — direct-by-id cross-tenant read/mutate | FINAL-001 |

The inventory is the audit's standing snapshot. A new route entering
the codebase that does not pass the verified-clean column at its
landing commit is a regression by definition.

## 13a. The pre-2026-06-12 security arc

The current FINAL-NNN ledger is the rolling burn-down. The arc
before it is worth naming, both as background and as the pattern
that produced the current discipline.

**The burn-down series (early 2026).** Ten numbered items, landed
between February and April. The shape was reactive: a finding got
discovered, a `security:` commit named it, and the next item in
the burn-down took priority. Highlights:

- `e896d3c` — eruda CDN load removed from the production bundle. The CSP would have blocked it at runtime; removing the load entirely is the cleaner fix.
- `44eb128` — response-headers middleware added (CSP / HSTS / XFO). The first version of `_security_headers.py`; six headers then, seven now after Caliper Lane 3.
- `e43d860` — server-side consent-token verification on destructive tools. The consent ledger's first appearance.
- `1f9c23f` — `Env.define` captures verb meta; startup registry validation.
- `abb5a38` — `safeRedirect` helper plus the eleven call-site migration. The shape `safeHref` later borrowed.
- `47f5904` — `rel="noopener noreferrer"` on six `target="_blank"` sites + ESLint rule.
- `c465f3e` — OAuth popup `onMessage` origin check. Closed Persona-B's popup attack.
- `3950b7a` — HMAC over `localStorage` persistence (positions, carts, drafts). This is the surface that FINAL-013 / FINAL-034 later revealed to be running keyed FNV instead of real HMAC; closed 2026-06-13 with real SHA-256 HMAC via `@noble/hashes` — see §11.3.
- `94a9f40` — transfer-confirm gate on the voice path plus a dedicated surface.
- `583f2aa` — service worker build-step version pin + cache-key shape gates.

**The Sentinel series (May 2026).** Five numbered items from a
dedicated review pass. The most consequential was Sentinel #5
(`c12f199`), the binding of webhook `shop_id` to the verified owner
— the predecessor of FINAL-006 / FINAL-016.

**The X-series (May–June 2026).** Per-platform webhook signature
verification, fail-closed blob encryption, and similar. The X-series
landed the canonical webhook-verification shape that the current
verifiers descend from.

**The GAPS series.** GAPS3-SEC, GAPS4-SEC. Audit-driven lanes that
identified specific carry-overs across multiple commits. GAPS4-SEC
G4-1 / G3-3 (per-platform shop-binding) is the canonical example
— the fix landed across multiple commits and the merged sheet
tracked the burn-down.

**What changed in the Wave-1 / Wave-2 era.** The earlier security
commits were reactive — find a bug, fix it, move on. The wave model
introduces a separation of concerns: review reads and finds, fix
cycle implements and tests, verification confirms structurally and
at the seam. The merged sheet is the artifact that survives across
waves. The `sec(fix):` prefix is the rolling burn-down tag; the
`sec:` prefix is the audit doc landing.

The earlier history is worth knowing because the same shapes
recur. FINAL-013 (FNV vs SHA-256) is a regression of the burn-down
#10 work. FINAL-006 (Shopify HMAC re-keying) is a regression of
Sentinel #5. The current discipline is the answer to the
regression problem: the verified-clean column, the symbol-citation
rule, the matched-claims test. The doc and the code stay current
together or they drift together; the drift is the security risk.

## 14. Appendix — the `sec(fix)` ledger

Every `sec(fix):` commit since 2026-06-12. Drift-immune one-line
synopses; the commit SHA is the canonical reference.

- `5144dc8` — Caliper Fix Lane 3 — CSP + security-headers middleware on FastAPI app (the seventh header).
- `2f6a5c6` — Wave #2 Lane B — `bot_bypass` identity gate + chat role self-impersonation + `doc_reviews` admin gate + Meta `business_id` alignment.
- `9ceb983` — Wave #2 Lane C — `safeHref` userinfo / IDN / CRLF hardening + NewspaperCard scheme guard + `RecallNodeSchema` symmetry.
- `b5fbb3a` — R2-A-001 / R2-A-004 — bugs ownership scoping; non-admin restricted to own bugs.
- `f9233ff` — R2-MED-2 — `forget_operator` typed-error wrap (consistent `EngramForgetFailed` contract).
- `2122073` — FINAL-006 — `verify_shopify` bare app secret HMAC (alignment with `c12f199`).
- `e65fe12` — FINAL-016 — sale-events internal bearer; body-derived attribution.
- `9b519fa` — FINAL-007 — `proxy_audio` pin DNS resolution (SSRF rebind close).
- `c5a0c8c` — FINAL-009 / 010 / 011 follow-up — maintenance + memory + tests.
- `04f59e4` — FINAL-009 / 010 / 011 — engram forget symlink + operator binding + tmp race.
- `e47fdb7` — FINAL-005 — bugs route bound to session identity.
- `82b6bbe` — FINAL-002 — seal `operator_*` prop keys (Camp C predicate widening).
- `3bf6ac1` — FINAL-012 — `safeHref` allowlist (http / https / mailto).
- `c12f199` — Sentinel #5 — bind webhook `shop_id` to verified owner (the prior wave's anchor fix).

The pre-2026-06-12 ledger lives in the `security:` and prior
`fix(sec):` commit history. The shape `sec(fix):` was adopted for
the rolling FINAL-NNN burn-down so the prefix is a clean grep target.

---

## 15. Operational runbook — incident response

A finding that is exploited in the wild — or an unexplained anomaly
in the audit record that looks like one — triggers the runbook. The
shape is borrowed from the standard SRE incident playbook; the
material below names the security-specific steps.

### 14.1 T+0 — incident declared

A maintainer declares an incident the moment one of three signals
fires:

- a `/api/csp-report` violation against an enforced directive,
- an unexplained spike in the `/healthz` failure rate that traces to a security middleware path,
- an external report through the disclosure channel that names a specific exploit.

The first action is to capture state: the current commit SHA, the
Caliper run if recent, the audit log for the last hour, the recent
deploy history. Capture before triage so the forensic record is
intact.

### 14.2 T+5 minutes — scope

Three questions:

1. Is the surface live in production? (The "built-but-not-wired" theme means many findings do not have a live blast radius.)
2. Is the attack class one we have a control for? (Cross-reference the FINAL ledger.)
3. Is the operator impact bounded? (Single-operator, multi-operator, or global.)

The answer to (1) and (3) determines the response speed. A
single-operator bounded surface gets a 24-hour fix; a global live
surface gets a same-hour fix.

### 14.3 T+15 minutes — mitigation

The immediate mitigation lane:

- 404-gate the affected route if the fix is gating, not rewriting.
- Rotate any leaked secret (Stripe key, webhook secret, Sakura token).
- Force re-authentication if a session-bound seam is implicated.
- Roll forward to the last clean deploy if the incident commit is identifiable.

The standing rule: roll forward to a clean state, never roll back
without an explicit owner decision. Rolling back loses commits, and
the commits may carry unrelated fixes the operator depends on.

### 14.4 T+1 hour — fix

The `sec(fix):` commit. The commit cites the FINAL id (or opens a
new one), the file and symbol, the threat shape, and the test that
pins the fix. The test is the load-bearing piece: a fix without a
test is a regression waiting for the next refactor.

The pre-commit hook obeys the standing rules: no
`--no-verify`, no signing bypass, no skipped audit-secrets pass.

### 14.5 T+24 hours — disclosure

If the incident affected operators, the disclosure goes to the
affected operators within 24 hours. The disclosure carries:

- a one-sentence description of what happened,
- a one-sentence description of what the attacker could and could not see,
- the time window of exposure,
- the action the operator should take (rotate credentials, change passphrase, watch for anomalies).

The disclosure is plain English. No marketing language. The third
reader (the regulator) reads the disclosure too.

### 14.6 T+1 week — post-mortem

The post-mortem document covers root cause, contributing factors,
detection delay, mitigation effectiveness, and what would have
prevented the incident at design time. It lands in `docs/incidents/`
with a date-prefixed name. The post-mortem is not punitive; the
team-level review is the standing meeting that updates the canon
docs.

The post-mortem feeds the next review wave. If the incident class
is novel, the wave includes a new slice; if it is a recurrence of a
known class, the wave includes a regression-test column.

---

## 16. References

- [`HELLO-SURFACE-1.0-ENGINEERING.md`](https://github.com/Lacuna-Labs/curator/blob/main/docs/HELLO-SURFACE-1.0-ENGINEERING.md) — surface-specific engineering manual; Part XVI carries the surface security view.
- [`SECURITY-MERGED-FINDINGS-2026-06-13.md`](https://github.com/Lacuna-Labs/curator/blob/main/docs/SECURITY-MERGED-FINDINGS-2026-06-13.md) — the rolling findings ledger.
- [`SECURITY-REVIEW-1-2026-06-13.md`](https://github.com/Lacuna-Labs/curator/blob/main/docs/SECURITY-REVIEW-1-2026-06-13.md) — Wave #1 cross-cutting pass.
- `SECURITY-REVIEW-1-SLICE-{A,B,C,D}-2026-06-13.md` — Wave #1 slices.
- `SECURITY-REVIEW-2-SLICE-{A,B,C,D}-2026-06-13.md` — Wave #2 verification slices.
- [`CALIPER-RUN-2026-06-13.md`](https://github.com/Lacuna-Labs/curator/blob/main/docs/CALIPER-RUN-2026-06-13.md) — category-by-category pre-prod gate.
- [`_security_headers.py`](https://github.com/Lacuna-Labs/curator/blob/main/curator-api/curator_api/_security_headers.py) — the response-header middleware.
- [`_session.py`](https://github.com/Lacuna-Labs/curator/blob/main/curator-api/curator_api/_session.py) — `current_operator_id` and `enforce_operator`.
- [`cortex/cortex_crypto.py`](https://github.com/Lacuna-Labs/curator/blob/main/curator-api/curator_api/cortex/cortex_crypto.py) — envelope, `seal_props`, `KeyProvider` seam.
- [`engram/storage.py`](https://github.com/Lacuna-Labs/curator/blob/main/curator-api/curator_api/engram/storage.py) — per-operator encrypted folder backend.
- [`routes/bugs.py`](https://github.com/Lacuna-Labs/curator/blob/main/curator-api/curator_api/routes/bugs.py) — the two-tier identity + ownership shape, FINAL-005 + R2-A-001 / 004.
- [`routes/proxy_audio.py`](https://github.com/Lacuna-Labs/curator/blob/main/curator-api/curator_api/routes/proxy_audio.py) — the audio CORS proxy and SSRF guard.
- [`stores/webhook_signatures.py`](https://github.com/Lacuna-Labs/curator/blob/main/curator-api/curator_api/stores/webhook_signatures.py) — per-platform HMAC verifiers.
- [`curator-web/src/lib/safeHref.js`](https://github.com/Lacuna-Labs/curator/blob/main/curator-web/src/lib/safeHref.js) — URL-scheme allowlist.

---

*End of `SECURITY-CANONICAL.md`. Revise on each completed review wave.*

---

# §SLAT — Signed envelopes, capability tokens, canonicalization (added 2026-07-12)

> Cross-refs: `~/code/lacuna-labs/research/lacuna-docs/specs/SLAT-1.0.SPEC.md` §6 (Priya's scope), `CORTEX-1.0.ENG.md §SLAT`, `LOAM-1.0.ENG.md §SLAT.8`, `LACUNA-INTEGRATION-1.0.ENG.md §SLAT.4`. Task #62 landed the ENG-tree surface pass; this section threads SLAT through the security model this doc canonicalizes. Additive to §2-§7; no deletes. **Priya reviews this section.**

## §SLAT.1 — Doctrine

The security atom in the substrate is a **signed SLAT envelope**. Every capability grant, every wire-crossing message, every persisted secret, every audit line lives inside a signed slat. The envelope binds three things: the body (what's being signed), the signer (who claims it), and the nonce + timestamp (when it was signed, so it can't be replayed).

SLAT §6 was written by Priya against this same posture. This section names where in Lacuna's own security surface each SLAT §6 mechanism lands.

The load-bearing property: the security posture and the wire format share a canonicalization (SLAT §6.1). One record has one canonical byte string across every binding. Signatures verify because both sides agree on the bytes.

## §SLAT.2 — The signing envelope (SLAT §6.2 in Lacuna)

Every wire crossing at Lacuna carries the envelope:

```slat
(signed
  :body       <inner-record>
  :signed-by  "sakura@lacuna"
  :signature-algo "ed25519"
  :signature  #b64 "…"
  :cid        #b64 "…"                ; SHA-256 of canonical(body)
  :nonce      #b64 "…"                ; 128-bit fresh
  :ts-signed  #inst "2026-07-12T04:22:00Z")
```

The signer canonicalizes the `:body` (SLAT §6.1), computes the cid, signs `cid || nonce || ts-signed || signed-by`, base64-encodes the signature. Verifiers repeat the process; byte mismatch fails.

**Where this lands in the security surface:**

- **§3.1 The envelope shape.** The Cortex at-rest envelope (AES-256-GCM) wraps a SLAT canonical body. The two envelopes compose: the AES envelope keeps the bytes confidential at rest; the SLAT signed envelope keeps them authentic on the wire.
- **§5.4 The Provenance schema.** Provenance chains are Merkle attestations (SLAT §6.7) over signed slat leaves. Each provenance step is one signed envelope; the chain root is the slat-set attestation.
- **§6.3 Webhook HMAC verification.** Vendor webhooks arrive with HMAC signatures; the vendor-firewall converts to signed slats before forwarding. Downstream sees one envelope shape regardless of vendor.

## §SLAT.3 — Capability tokens (SLAT §6.5 in Lacuna)

Every Lacuna capability lives as a signed slat:

```slat
(signed
  :body (capability
          :grants     (:read  "atom/*"
                       :write "artifact-state/chat/*")
          :subject    "sakura@lacuna"
          :issuer     "cortex@lacuna"
          :not-before #inst "2026-07-12T00:00:00Z"
          :not-after  #inst "2026-07-19T00:00:00Z"
          :nonce      #b64 "…")
  :signature-algo "ed25519"
  :signature  #b64 "…"
  :cid        #b64 "…"
  :nonce      #b64 "…"
  :ts-signed  #inst "2026-07-12T00:00:00Z")
```

**Where this lands:**

- **§2 Identity and session.** The `current_operator_id` binding is derived from a signed capability envelope; the four-persona attacker model (§1.4) is bounded because each persona can only produce envelopes signed by their own private key.
- **§2.4 The trust ladder.** Each rung is expressed as a slat capability with different `:grants`. Rung-up requires a fresh envelope; the capability chain is Macaroon-style (LOAM §12.1) so narrowing does not require a round-trip.
- **§3.7 Camp C key delegation.** The delegation chain is a chain of signed slats; each delegate signs a narrower capability with their own key. Alfred's D13 single-door recovery becomes verification of a chain of these envelopes.
- **§7.3 The Scheme runtime sandbox.** The Scheme evaluator refuses any verb call whose caller does not present a valid capability envelope for that verb.

**Capability tokens do not leak the private key in transit.** The reader neither stores nor logs signature values beyond the current process (SLAT §6.5).

## §SLAT.4 — Canonicalization (SLAT §6.1 in Lacuna)

Cross-binding stability is a CI gate. The property is load-bearing:

> One record, one canonical byte string. JS reads, JS writes canonical, Python reads canonical, Python signs, JS verifies. Bytes match end-to-end.

**Where this lands:**

- **§6 Input validation.** Every canonicalized input is deterministic. Two clients writing the same logical record produce the same bytes; the deduplicator (§3.3 idempotent `seal_props`) becomes exact.
- **§7.4 The gate expansion invariant.** Whenever the security gate expands to cover a new verb, the canonical form of the verb's dispatch envelope is added to the CI test-vector set. New surface, new fixture.
- **§3.3 `seal_props` idempotence.** Idempotence is easier when both sides agree on canonical bytes — the second call re-canonicalizes to the same bytes and short-circuits.

Rules 3, 4, 6, and 10 of SLAT §6.1 caught divergence between the JS and Python writers during the SLAT 1.0 review. Both bindings are now brought into agreement; Priya's PF-1 flag closed.

## §SLAT.5 — Taint tracking (SLAT §6.4 in Lacuna)

Bindings expose an optional `tainted=True` mode. Values read from a tainted stream carry a `_tainted: True` flag; consumers that write them back propagate the taint. **Cortex writes refuse tainted input by default.**

**Where this lands:**

- **§1.3 The four attacker personas.** Untrusted-input propagation lets us block a compromised-webhook payload from reaching Cortex without an explicit un-taint step. The un-taint step is auditable — every un-taint call lands as a `record` slat on the SYSTEM audit spine.
- **§6.3 Webhook HMAC.** Incoming webhooks are tainted at ingress; the HMAC verification path is the sanctioned un-taint (`untaint-on-verified-signature`).
- **§7.4 Gate expansion.** Any new gate-expansion PR that adds a wire endpoint MUST specify whether inputs are tainted at ingress and where the un-taint happens. Priya's review checklist for gate-expansion is one line: `does taint travel end-to-end and un-taint at a documented point?`

PF-3 (Python taint parity) tracks the 1.0.1 close-out; consumers routing untrusted input through Python currently set `strict=True` in the interim.

## §SLAT.6 — At-rest encryption (SLAT §6.6 in Lacuna)

Optional. Records may carry an `:encrypted` marker whose payload is base64 ciphertext:

```slat
(record
  :encrypted #b64 "…"
  :encrypted-algo "xchacha20-poly1305"
  :key-hint "ops-2026-07")
```

**Where this lands:**

- **§4.1 Cortex on-device.** The Cortex envelope (`CXE1:` prefix per §3.1) is the encryption at rest; SLAT provides the outer transport shape. The `KeyProvider` seam (§3.4) resolves `:key-hint` to the actual key material via the OS keychain.
- **§4.2 Engram.** Per-operator encrypted folder wraps SLAT payloads; forget-operator (§4.3) is a slat-set attestation over the wiped records — the Merkle root proves what was in the folder before wipe.
- **§3.8 Sync envelope.** Cross-device sync envelopes are SLAT records; the sync path signs, encrypts, then transports; the receiver decrypts, verifies signature, replays.

Reader does NOT decrypt automatically. A separate `slat-decrypt` verb runs with the reader when the caller supplies a key.

## §SLAT.7 — Reader sandbox (SLAT §6.3 in Lacuna)

The SLAT reader does not execute. Explicitly:

- **No `eval`.** Even a form `(if …)` reads as three values. `(destroy-database :arg (quote (rm -rf /)))` reads as a list of three symbols; it does NOT execute.
- **No symbol resolution.** `sym` is registered in the interner but not looked up in any environment.
- **No I/O.** No `#include`, no `#load`, no URI dereferencing.
- **No macro expansion.**

**Where this lands:**

- **§7.3 The Scheme runtime sandbox.** The `slat/eval` mode (reader-macros permitted) MUST NOT be applied to untrusted input. Sakura's own source path may use `slat/eval`; every wire ingress path uses the plain reader.
- **§1.4 The honesty gate.** The reader sandbox means canonical form is safe to log. Even a maximally hostile slat payload cannot side-effect through parsing.

## §SLAT.8 — Merkle attestation (SLAT §6.7 in Lacuna)

For attestation over a set of slats, SLAT builds a Merkle tree:

- Leaf `= sha256(canonical_bytes(slat_i))`
- Node `= sha256(left || right)`
- Root `= "slat-merkle-v1" || sha256(recursive)`

**Where this lands:**

- **§5.4 Provenance chain.** Every provenance chain root is a slat-set attestation. Two consumers can independently verify the root and reach the same conclusion about the underlying set.
- **§4.4 Right-to-forget propagation.** Before wipe, the folder emits a slat-set attestation naming what will be wiped; after wipe, the attestation is the audit proof.
- **Training corpus attestation.** Cortex signs a slat-set root over the corpus before every Weave training run. The root is what pins the model version to the corpus version.

## §SLAT.9 — Injection prevention (SLAT §6.8 in Lacuna)

Because the reader does not execute, injection is a **canonicalization + trust** problem, not a syntax problem:

- **Quote discipline.** `'x` reads as `(quote x)`. Consumers writing dynamic queries handle it explicitly.
- **String escaping is normative.** Five escapes only. No `\uXXXX` inside strings.
- **Symbol length capped.** `max_symbol_length` (SLAT §5.3) prevents a lorem-ipsum symbol.
- **No octal / hex integer syntax in 1.0.** Ambiguity around leading `0` is not worth it.
- **`_` prefix reserved.** Consumers cannot smuggle a `:_signature` — the reader rejects reserved keywords on read.

**Where this lands:**

- **§6.1 The ingest chain.** Every ingress point runs the SLAT reader against a body; the reader guarantees the parsed value is data, not code.
- **§6.5 The chat role gate.** Role transitions arrive as slat records; the gate matches on the head symbol; injection is impossible because the head is interned before comparison.

## §SLAT.10 — Cross-references

- SLAT primitives — `SLAT-1.0.SPEC.md §3`
- Signing envelope — `SLAT-1.0.SPEC.md §6.2`
- Capability tokens — `SLAT-1.0.SPEC.md §6.5`
- Canonicalization — `SLAT-1.0.SPEC.md §6.1`
- Taint tracking — `SLAT-1.0.SPEC.md §6.4`
- At-rest encryption — `SLAT-1.0.SPEC.md §6.6`
- Reader sandbox — `SLAT-1.0.SPEC.md §6.3`
- Merkle attestation — `SLAT-1.0.SPEC.md §6.7`
- Priya's public flags (PF-1, PF-2, PF-3) — `SLAT-1.0.SPEC.md §6.9`
- Cortex on-device envelope — `CORTEX-1.0.ENG.md §SLAT.5, §SLAT.6`
- Loam capability posture — `LOAM-1.0.ENG.md §SLAT.8, §12`
- Vendor-firewall envelope — `LACUNA-INTEGRATION-1.0.ENG.md §SLAT.4`

