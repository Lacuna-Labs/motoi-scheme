# Note for Motoi — Book of Jesse on the front page

Alfred, 2026-07-16 (dictated). Save for the Motoi product design.

## The requirement

Book of Jesse must be **on the front page** of Motoi (the app / site / docs).
Not buried in a menu. Not two clicks in. A kid arriving should be able to
click and get to it.

## Why

- Book of Jesse is the onboarding book — the ramp-up from "nothing" to
  "I made a card." If a kid can't find it, they don't onboard.
- Part of Book of Jesse's job is to teach people the *differences* between
  the books (scheme / word / story / children). Front-page placement is
  what makes that curriculum discoverable.
- Alfred, verbatim: *"the book of Jesse's job is is to get people to
  understand these differences."*

## Concrete implementations to consider

- Motoi docs site (VitePress): Book of Jesse gets a hero card on the
  landing page, above the fold.
- Motoi CLI: `motoi jesse` opens the Book of Jesse in a browser or terminal
  reader. First-time-user flow suggests it automatically.
- Motoi REPL: first-boot message includes "type `,jesse` to read the
  onboarding book" or similar.
- Any Motoi-based product (Sakura's iPad app, future kid-facing
  distributions): Book of Jesse is one tap away from the home surface.

## Cross-refs

- `[[book-of-jesse]]` — the book itself
- `[[kid-from-north-georgia]]` — the floor doctrine (this is the reader)
- `[[the-differences]]` — Book of Jesse teaches these across the four
  collections (scheme / word / story / children when it lands)
