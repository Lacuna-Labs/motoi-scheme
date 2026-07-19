// theme/index.js — Motoi Scheme VitePress theme extension.
//
// Extends the default theme with:
//   - the three-stripe brand overlay (custom.css)
//   - the ASCII tree logo, injected into the nav title
//   - the terminal-look surface classes for prose (terminal-look.css)
//
// The ASCII tree is loaded from logo.txt at build time (Vite's ?raw
// import) so the source of truth stays in one file. If Alfred updates
// logo.txt, the header rebuilds with the new tree — no template edit.

import DefaultTheme from 'vitepress/theme'
import { h } from 'vue'
import './custom.css'

// Vite: ?raw returns the file contents as a string at build time.
// If logo.txt is missing, this import fails at build; keep the
// file in place even when it holds only the TODO stub.
import logoAscii from './logo.txt?raw'

export default {
  extends: DefaultTheme,

  Layout() {
    return h(DefaultTheme.Layout, null, {
      // Slot into VitePress's nav-bar-title-before area so the ASCII
      // tree lands LEFT of the wordmark. The wordmark itself remains
      // whatever `title:` says in config.mjs (currently "Motoi Scheme").
      'nav-bar-title-before': () =>
        h(
          'pre',
          { class: 'motoi-tree', 'aria-label': 'Motoi Scheme logo' },
          asciiForHeader(logoAscii)
        ),
    })
  },
}

/**
 * The nav is short. If the raw logo.txt is many lines, we'd blow the
 * header height. Trim to the first non-TODO block and cap at 6 lines.
 * If the file is still the TODO placeholder, render a discreet marker
 * so nothing crashes and the layout is visible for review.
 */
function asciiForHeader(raw) {
  const s = String(raw || '').replace(/\r\n/g, '\n')
  if (s.trimStart().startsWith('TODO')) return '[tree]'
  const lines = s.split('\n')
  // Drop leading/trailing blank lines
  while (lines.length && !lines[0].trim()) lines.shift()
  while (lines.length && !lines[lines.length - 1].trim()) lines.pop()
  return lines.slice(0, 6).join('\n')
}
