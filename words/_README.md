# Words/

Vocabulary, glossary, naming conventions, canonical taxonomy for Motoi Scheme.

## First-pass state (2026-07-16)

Empty. The rich vocabulary work — marketplace primers (jewelry, electronics,
apparel with DEEP / AWARE / REASONED tiers), the ordinary-world prose, the
philosopher lens glossary — currently lives in
`~/code/curator/scheme-books/book-of-words/`.

## Next-pass plan

Migrate the dialect-neutral portions here. Sakura-specific vocabulary
(character voice, teaching-voice register, poem forms) stays in Curator or
sakura-scheme — those aren't Motoi's business.

## Word entries follow this shape

```
(word
  :term "manifold"
  :dialect "motoi"
  :tier "deep|aware|reasoned"
  :domain "jewelry|electronics|shipping|..."
  :definition "..."
  :used-in ("marketplace-primer" "shop-scenarios")
  :provenance "curator/scheme-books/book-of-words/marketplace-primers/etsy-jewelry.book.slatl")
```
