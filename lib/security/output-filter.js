// output-filter.js — screens copilot/* and sakura/* responses for
// non-Scheme code that must not reach the user unfiltered.
//
// Provenance: Alfred lock (2026-07-17) — "no non-Scheme output, no
// shell-out." The trained model SHOULD only emit Scheme; this filter
// is the runtime defense-in-depth. If the model drifts into bash or
// Python, we do NOT let a stray fenced block reach a kid who might
// paste it into a terminal.
//
// Two tiers:
//
//   HARD REFUSE — bash / shell / any shebang / any *nix-destructive
//     command shape. The response is REPLACED with a stern refusal.
//     Alfred: "highest risk." The kid must never see a `rm -rf`
//     suggestion, even wrapped in prose.
//
//   WARN WRAP — Python / JS / Ruby / Java etc. The original response
//     is kept but a clear disclaimer is PREPENDED so no reader mistakes
//     it for authoritative Motoi Scheme output.
//
// A separate Scheme heuristic accepts responses whose fenced blocks
// are S-expression-heavy (parens + Motoi verbs) as SAFE — the common
// case for a well-behaved copilot.
//
// Detection is intentionally CONSERVATIVE: we err on the side of
// warning over false-negative. A bare mention of "def foo" in prose
// does NOT trip the Python detector; a `def foo():` block does.

// ── refusal + warning copy ─────────────────────────────────────────
//
// Both messages are consistent-worded per the safety-refusals doctrine
// (memory:motoi-safety-refusals-2026-07-17). Kids read the same words
// every time; consistency IS the safety feature.

export const SHELL_REFUSAL =
  "I don't write shell commands. Any shell-shaped output was a mistake — " +
  "please don't run it. Motoi is Scheme only. Ask again if you want the " +
  "Scheme answer."

export const NONSCHEME_WARNING_PREFIX =
  "Note: Motoi drifted into non-Scheme output. This is NOT authoritative " +
  "Motoi Scheme and should not be run as-is. Please ignore or ask again " +
  "for the Scheme answer.\n\n"

// ── detection patterns ─────────────────────────────────────────────
//
// Each pattern group is ORDERED by category. First-match wins so a
// bash-shebang inside a Python-marked block still counts as bash
// (higher risk).
//
// Every pattern is /m so it matches across multi-line responses.

// SHELL / BASH — Alfred: highest risk. Match ANY of these and we hard-refuse.
const SHELL_PATTERNS = [
  // Shebangs — the strongest single signal a block is executable.
  { re: /^#!\/bin\/(?:bash|sh|zsh|dash|ksh|tcsh|csh|ash)\b/m,        why: 'shell shebang' },
  { re: /^#!\/usr\/bin\/(?:env\s+)?(?:bash|sh|zsh|dash|python|perl|ruby|node)\b/m, why: 'usr/bin shebang' },
  { re: /^#!\/(?:usr\/local\/)?bin\/\w+\b/m,                          why: 'generic shebang' },

  // Explicit destructive invocations. `rm -rf`, sudo, chmod, chown, dd
  // if=, mv /... are only reachable through a shell. Word-boundaries
  // keep the trigger tight — `rm -rf` in prose ("don't run rm -rf")
  // still fires because Alfred was clear: kids don't need to see it
  // even as a warning example.
  { re: /\brm\s+-r[fF]?\b/,                                          why: 'rm -rf' },
  { re: /\bsudo\s+\w+/,                                              why: 'sudo' },
  { re: /\bchmod\s+[0-7]{3,4}\b/,                                    why: 'chmod' },
  { re: /\bchown\s+\w/,                                              why: 'chown' },
  { re: /\bdd\s+if=/,                                                why: 'dd if=' },
  { re: /\bmv\s+\//,                                                 why: 'mv /' },

  // Pipe-to-shell — the classic remote-code-execution vector.
  { re: /\bcurl\b[^\n]*\|\s*(?:bash|sh|zsh)\b/,                       why: 'curl | sh' },
  { re: /\bwget\b[^\n]*\|\s*(?:bash|sh|zsh)\b/,                       why: 'wget | sh' },
  { re: /\b(?:bash|sh|zsh)\s+-c\s+["']/,                              why: 'sh -c' },

  // I/O redirection to /dev/ or /etc/ — evidence of shell context.
  { re: /(?:^|\s)>\s*\/dev\/\w+/,                                    why: '> /dev/' },
  { re: /(?:^|\s)<\s*\/dev\/\w+/,                                    why: '< /dev/' },
  { re: /(?:^|\s)>\s*\/etc\/\w+/,                                    why: '> /etc/' },

  // Command substitution wrapping a dangerous verb.
  { re: /\$\(\s*(?:rm|mv|curl|wget|chmod|chown|dd|sudo)\b/,          why: 'command substitution around dangerous verb' },

  // Backtick command substitution wrapping a dangerous verb.
  { re: /`\s*(?:rm|mv|curl|wget|chmod|chown|dd|sudo)\b[^`]*`/,       why: 'backtick command substitution' },

  // Process substitution — bash-only, always shell.
  { re: /<\(\s*\w/,                                                  why: 'process substitution' },

  // Fenced shell/bash code blocks. Even an empty ```bash fence is a
  // signal the model thought it was authoring shell.
  { re: /```(?:bash|sh|zsh|shell|console|terminal)\b/,               why: 'shell fenced block' },
]

// PYTHON — WARN. Look for shape signals, not word mentions.
const PYTHON_PATTERNS = [
  // A Python def statement (function definition, colon-terminated).
  { re: /^\s*def\s+[a-z_][a-zA-Z0-9_]*\s*\([^)]*\)\s*:/m,             why: 'python def' },
  // A Python class statement (colon-terminated).
  { re: /^\s*class\s+[A-Z]\w*\s*(?:\([^)]*\))?\s*:/m,                why: 'python class' },
  // `import numpy` / `import os` — Python-style bare imports.
  { re: /^\s*import\s+(?:numpy|os|subprocess|sys|json|re|time|random|math|collections|itertools|functools)\b/m, why: 'python import' },
  // `from X import Y` — Python-only syntax.
  { re: /^\s*from\s+[\w.]+\s+import\s+/m,                            why: 'python from-import' },
  // Decorator at line start.
  { re: /^\s*@[a-z_]\w*(?:\.\w+)?\s*\n/m,                            why: 'python decorator' },
  // if __name__ idiom.
  { re: /if\s+__name__\s*==\s*['"]__main__['"]\s*:/,                 why: 'python __main__ idiom' },
  // Python-style print(...) — parens NOT the Scheme `(print x)` shape.
  // Match "print(" only when the surrounding line is Python-styled
  // (`f"..."` or `.format(` or `\t`-indented block) — we don't want a
  // bare mention like "call print(...)" in prose to trip.
  // Fenced python block is the strongest signal.
  { re: /```python\b/,                                               why: 'python fenced block' },
]

// JS / TS — WARN.
const JS_PATTERNS = [
  // `function foo(` at line start — JavaScript function declaration.
  { re: /^\s*(?:async\s+)?function\s+[a-z_$][\w$]*\s*\(/m,           why: 'js function decl' },
  // `const x =` / `let x =` at line start — JavaScript variable decl.
  // Look for the assignment to make sure it's not "const" mentioned in prose.
  { re: /^\s*(?:const|let|var)\s+[a-z_$][\w$]*\s*=/m,                why: 'js var decl' },
  // Fat-arrow function with body — very JS-shaped.
  { re: /=>\s*\{[^}]+\}/,                                            why: 'js fat-arrow body' },
  // require(' or require(" — CommonJS.
  { re: /\brequire\(\s*['"][\w./-]+['"]\s*\)/,                       why: 'js require()' },
  // import ... from '...' — ES module.
  { re: /^\s*import\s+[\w{}*,\s]+\s+from\s+['"][\w@./-]+['"]/m,      why: 'js import' },
  // export default / export const — ES module.
  { re: /^\s*export\s+(?:default|const|let|function|class)\b/m,      why: 'js export' },
  // Fenced js/ts block.
  { re: /```(?:js|javascript|ts|typescript|jsx|tsx)\b/,              why: 'js fenced block' },
]

// RUBY — WARN.
const RUBY_PATTERNS = [
  // Ruby-style def (no parens required).
  { re: /^\s*def\s+[a-z_][a-zA-Z0-9_?!]*\s*(?:\([^)]*\))?\s*\n/m,    why: 'ruby def' },
  // attr_accessor / attr_reader / attr_writer.
  { re: /^\s*attr_(?:accessor|reader|writer)\s+:/m,                  why: 'ruby attr_' },
  // `puts "..."` — very Ruby-specific.
  { re: /^\s*puts\s+["']/m,                                          why: 'ruby puts' },
  // Ruby `require '...'` — single quotes are the tell (Python uses `import`).
  { re: /^\s*require\s+['"][\w./-]+['"]/m,                           why: 'ruby require' },
  // Fenced ruby block.
  { re: /```ruby\b/,                                                 why: 'ruby fenced block' },
]

// ── the scanner ────────────────────────────────────────────────────

/**
 * scanForNonScheme — inspect `text` for non-Scheme code patterns.
 *
 * Returns { safe, kind, matches } where:
 *   safe    — true iff no dangerous pattern matched
 *   kind    — 'bash' | 'shell' | 'python' | 'js' | 'ruby' | null
 *   matches — the list of pattern hits (for debugging / logging)
 *
 * Precedence (highest severity first): shell > python > js > ruby.
 * Shell wins even if a lower-tier language also matched, because a
 * shell command inside a python code fence is still a shell command.
 */
export function scanForNonScheme(text) {
  const s = typeof text === 'string' ? text : String(text ?? '')
  if (!s) return { safe: true, kind: null, matches: [] }

  // Order matters: shell first.
  const shell = scanGroup(s, SHELL_PATTERNS)
  if (shell.length > 0) return { safe: false, kind: 'shell', matches: shell }

  const py = scanGroup(s, PYTHON_PATTERNS)
  if (py.length > 0) return { safe: false, kind: 'python', matches: py }

  const js = scanGroup(s, JS_PATTERNS)
  if (js.length > 0) return { safe: false, kind: 'js', matches: js }

  const rb = scanGroup(s, RUBY_PATTERNS)
  if (rb.length > 0) return { safe: false, kind: 'ruby', matches: rb }

  return { safe: true, kind: null, matches: [] }
}

function scanGroup(s, patterns) {
  const hits = []
  for (const { re, why } of patterns) {
    const m = re.exec(s)
    if (m) hits.push({ why, match: m[0].slice(0, 120) })
  }
  return hits
}

// ── the response wrapper ───────────────────────────────────────────

/**
 * filterOutput — wrap a copilot / sakura response through the scanner
 * and apply the correct policy.
 *
 * @param {*}     response  the raw response (usually a string, but may
 *                          be #f from the model when the endpoint is
 *                          unset or the call errored)
 * @param {object} [opts]
 * @param {string} [opts.verb]  the verb name for logging / disclosure.
 *
 * @returns the possibly-modified response. Non-string responses pass
 * through unchanged (the filter only applies to model text).
 */
export function filterOutput(response, opts = {}) {
  // Only strings get filtered. Anything else (false, alist, record) is
  // returned as-is so the copilot/what-is / copilot/rag record shapes
  // stay intact.
  if (typeof response !== 'string') return response
  if (response.length === 0) return response

  const scan = scanForNonScheme(response)
  if (scan.safe) return response

  if (scan.kind === 'shell') {
    return SHELL_REFUSAL
  }
  // python / js / ruby → warn wrap
  return NONSCHEME_WARNING_PREFIX + response
}

/**
 * filterAlistAnswer — a specialization for RAG / what-is style records
 * that carry an `:answer` slot. Rewrites the :answer through
 * filterOutput without touching the other slots.
 *
 * Used by copilot/rag + copilot/what-is where the model text is nested
 * inside an alist return value.
 */
export function filterAlistAnswer(alist, opts = {}) {
  if (!Array.isArray(alist)) return alist
  return alist.map((pair) => {
    if (!Array.isArray(pair) || pair.length !== 2) return pair
    const [k, v] = pair
    // The :answer key is where the model text lives; other slots
    // (:sources, :confidence, :registry-hit) are structured data.
    const kName = k && typeof k === 'object' && 'name' in k ? k.name : k
    if (kName === ':answer' || kName === ':llm-hit') {
      return [k, filterOutput(v, opts)]
    }
    return pair
  })
}

export default {
  scanForNonScheme,
  filterOutput,
  filterAlistAnswer,
  SHELL_REFUSAL,
  NONSCHEME_WARNING_PREFIX,
}
