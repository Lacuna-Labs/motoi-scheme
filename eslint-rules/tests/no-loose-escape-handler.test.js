/**
 * no-loose-escape-handler.test.js — RuleTester harness.
 *
 * Ported from sakura-scheme (T-09, ARTIFACT-2026-07-10 §19).
 * Verifies the Motoi base rule against three offending patterns
 * and three compliant patterns.
 */

import { describe, it } from 'node:test'
import { RuleTester } from 'eslint'
import { createRequire } from 'module'

const requireCjs = createRequire(import.meta.url)
const rule = requireCjs('../no-loose-escape-handler.cjs')

const ruleTester = new RuleTester({
  languageOptions: {
    ecmaVersion: 'latest',
    sourceType: 'module',
    parserOptions: {
      ecmaFeatures: { jsx: true },
    },
  },
})

describe('no-loose-escape-handler — RuleTester', () => {
  it('runs the standard cases', () => {
    ruleTester.run('no-loose-escape-handler', rule, {
      valid: [
        // 1. Compliant: routes through closeArtifact()
        {
          code: `
            window.addEventListener("keydown", (e) => {
              if (e.key === "Escape") closeArtifact(activeId);
            });
          `,
        },
        // 2. Compliant: file lives inside an artifact tree — frame owns it
        {
          filename: '/repo/site/apps/hello-surface/artifact/frame.js',
          code: `
            document.addEventListener("keydown", (e) => {
              if (e.key === "Escape") closeTop();
            });
          `,
        },
        // 3. Compliant: JSX handler dispatches through "artifact/close"
        {
          code: `
            const H = () => (
              <div onKeyDown={(e) => {
                if (e.key === "Escape") dispatch(id, ["artifact/close", id]);
              }} />
            );
          `,
        },
        // Bonus: non-Escape keydown handler shouldn't trigger at all
        {
          code: `
            window.addEventListener("keydown", (e) => {
              if (e.key === "Enter") submit();
            });
          `,
        },
      ],
      invalid: [
        // 1. Bare Escape check with inline .remove()
        {
          code: `
            window.addEventListener("keydown", (e) => {
              if (e.key === "Escape") {
                document.getElementById("modal").remove();
              }
            });
          `,
          errors: [{ messageId: 'looseEscape' }],
        },
        // 2. JSX onKeyDown that swallows Escape without routing
        {
          code: `
            const H = () => (
              <div onKeyDown={(e) => {
                if (e.key === "Escape") setOpen(false);
              }} />
            );
          `,
          errors: [{ messageId: 'looseEscape' }],
        },
        // 3. Array-includes check that calls a bespoke hidePanel()
        {
          code: `
            document.addEventListener("keydown", (e) => {
              if (["Escape", "Esc"].includes(e.key)) {
                hidePanel();
              }
            });
          `,
          errors: [{ messageId: 'looseEscape' }],
        },
      ],
    })
  })
})
