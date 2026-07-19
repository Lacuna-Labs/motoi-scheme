---
layout: home
title: Motoi Scheme
titleTemplate: A language you can hold and change

hero:
  name: Motoi Scheme
  text: A language you can hold and change
  tagline: Small enough for an 11-year-old. Open. Nobody's product. The substrate Sakura, Curator, and Lacuna share.
  actions:
    - theme: brand
      text: Try the Composer
      link: /composer/
    - theme: alt
      text: Reference
      link: /reference/
    - theme: alt
      text: The Book
      link: /book/

features:
  - title: The Composer
    details: Sliders, piano rolls, sprite grids that write Scheme. Move a widget, a number changes. Edit the file, the widget follows.
    link: /composer/
    linkText: Open the Composer
  - title: The REPL
    details: bin/motoi opens a prompt with the brand stripes, the wordmark, and ,help. The same substrate the composer sits on.
  - title: The Book
    details: Twenty mini-books, sixteen chapters each. Introspection, composition, motion, music, math, sound, games.
    link: /book/
    linkText: Read the Book
  - title: The Reference
    details: MOTOI-SCHEME-REFERENCE.slat is canonical. Every verb, every core form, one file, one truth.
    link: /reference/
    linkText: Look up a verb
---

# Motoi Scheme

Motoi (基, "foundation") is the base Scheme dialect Sakura and Lacuna share. It's small. Open source. Not a product.

The point of Motoi isn't Motoi. It's the kid — the one who opens the composer, drags a slider, sees a number change in the file, and realizes the file was hers all along. Motoi is a stepping stone to Claude, to other languages, to systems the kid didn't know were reachable.

## Where to start

| Start here | If you want to |
| --- | --- |
| **[The Composer](/composer/)** | Make sounds, sprites, worlds. Widgets write Scheme. |
| **[The Book](/book/)** | Read your way in. Introspection, composition, motion, sound, games. |
| **[The Reference](/reference/)** | Look up a verb. Every verb documented in one file. |
| **[Engineering](/engineering/)** | See how it's built. |

## Doctrine (short form)

- **The reference IS the language.** Not documentation *of* the language.
- **16-chapter invariant.** Every canonical book is exactly 16 chapters; overflow → appendices.
- **SLAT is the working format.** MD is archived. No deletes, ever.
- **No fabrication.** If unsure, log `:status "needs-alfred"` and stop.

## Install and run the REPL

```
git clone https://github.com/Lacuna-Labs/motoi-scheme
cd motoi-scheme
bin/motoi repl
```

You'll see three stripes (pink, green, brown), the wordmark, and a prompt. Type `,help <verb>` to explore. Type `(+ 1 2)` if you're curious what it prints back.
