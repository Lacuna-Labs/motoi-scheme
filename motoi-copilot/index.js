// motoi-copilot — the public API of the self-contained copilot module.
//
// The copilot that cannot invent a function that doesn't exist. Embedded in the
// Motoi fantasy console across three surfaces (terminal/TUI, web GUI, in-repo).
// Serves an 11-year-old beginner and a 35-year-old dev at once.
//
// SELF-CONTAINED: this module imports ONLY from the `motoi-scheme` public API.
// Nothing in the base engine depends on it. De-branded: the surfaced identity is
// "the Motoi copilot"; vendor provenance never leaks (see src/debrand.js).
//
// INHERITED FOR FREE: a downstream dialect is a flag + a layered registry, not
// a fork. Pass its registry as `verbs` and the whole pipeline — validated ghost
// text, the 3 gates, the evolve-and-win selection — rides down into the Curator
// dialect unchanged. The registry is the registry.

// The orchestrator — the thing hosts drive.
export { Copilot } from './src/copilot.js'

// The three gates + the resolve authority (the defensible edge).
export { GATE, GateContext, runGates, screen } from './src/gates.js'
export { RegistryOracle, SPECIAL_FORMS, SYNTAX_KEYWORDS } from './src/registry-oracle.js'
export { speculativeRun, resetSandbox } from './src/sandbox.js'

// The broken-example guard — deterministic cross-standard tripwires read from
// the reference's trap cards (fold-left → SRFI-1 fold, and why the arg order flips).
export { BrokenGuard } from './src/broken-guard.js'

// FIM framing (completion + continuation) and structural helpers.
export {
  FIM, REPO_NAME, buildFimPrompt, splitAtCursor, mode, stripFimTokens,
  reconstruct, parenDelta, isBalanced,
} from './src/fim.js'

// The SuperRAG reasoning loop — grade → store → salt → retrieve, anti-lock-in,
// NONE/silence, person-profile accretion.
export { ReasoningStore, NONE, DEFAULT_KNOBS } from './src/reasoning-loop.js'

// Dual editing model — cursor offset AND form addressing.
export {
  scan, formAtOffset, findTopForm, listTopForms, splice, insertAt, scopeAtOffset,
} from './src/editing.js'

// Model backend wiring + de-brand.
export { configure, resetBackends, hasBackend, proposeInline, proposeAgentic } from './src/model-client.js'
export { debrand, containsVendorText, IDENTITY } from './src/debrand.js'

// Surfaces (terminal/TUI, web, in-repo/batch).
export { TuiSurface } from './surfaces/tui.js'
export { WebSurface } from './surfaces/web.js'
export { RepoSurface } from './surfaces/repo.js'

export const VERSION = '1.0.0'
