import { defineConfig } from 'vitepress'

// VitePress config for the Motoi Scheme docs site.
//
// Motoi Scheme is the base dialect. This site presents:
//   - The reference (MOTOI-SCHEME-REFERENCE.slat) — canonical language
//   - The book (scheme-books/) — 20+ mini-books
//   - Engineering (engineering/) — arch + eng docs
//
// Sidebar is authored explicitly. A future generator will emit
// per-verb pages from the reference SLAT into site/reference/.

export default defineConfig({
  title: 'Motoi Scheme',
  description: 'The base Scheme dialect Sakura and Lacuna share.',
  cleanUrls: true,
  themeConfig: {
    nav: [
      { text: 'Composer', link: '/composer/' },
      { text: 'Reference', link: '/reference/' },
      { text: 'Book', link: '/book/' },
      { text: 'Engineering', link: '/engineering/' },
    ],
    sidebar: {
      '/composer/': [
        {
          text: 'Composer',
          items: [
            { text: 'Overview', link: '/composer/' },
          ],
        },
      ],
      '/reference/': [
        {
          text: 'Reference',
          items: [
            { text: 'Overview', link: '/reference/' },
          ],
        },
      ],
      '/book/': [
        {
          text: 'The Book',
          items: [
            { text: 'Overview', link: '/book/' },
          ],
        },
      ],
      '/engineering/': [
        {
          text: 'Engineering',
          items: [
            { text: 'Overview', link: '/engineering/' },
          ],
        },
      ],
    },
    socialLinks: [
      { icon: 'github', link: 'https://github.com/Lacuna-Labs/motoi-scheme' },
    ],
    footer: {
      message: 'Apache-2.0 · Motoi Scheme · the base dialect',
    },
  },
})
