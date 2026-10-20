# Note for Rosetta / SLAT — Content Rating field

Alfred, 2026-07-16 (dictated). Save for the SLAT 1.1 spec revision.

## The requirement

Add a **content rating** field to SLAT records that carry any kind of
content (chapter, story, dialogue, scene, verb example). The rating tells
Sakura, the corpus filter, the docs renderer, and downstream consumers
what audience the material is safe for.

## Proposed field

```
:content-rating :G | :PG | :PG-13 | :R | :NC-17
```

Or perhaps a more Sakura-native shape:

```
:rating :children | :family | :teen | :adult | :restricted
```

Alfred's language during dictation: *"children would be rated G. So no
violence, no whatever."* The MPAA-style names are recognizable to parents
but somewhat US-centric. The kid/family/teen/adult set is more universal.
Pick one and stick.

## What the rating gates

- **Sakura's behavior at request time.** If a user says "make something
  for my child" (Alfred: *"my baby. That's a child, I should say"*),
  Sakura filters her generation to `:children` or `:family` content.
  She would NOT quote Hamlet's violence. She would NOT compose flower
  stories where the flowers stab each other. (Alfred: *"they should not
  stab each other, by the way. They should not kill each other. I don't
  think that's fair."*)
- **Corpus filter.** Training runs targeted at kid-audience models
  include only `:children` and `:family` rated records. Adult persona
  models pull from the whole set.
- **Docs renderer.** A `children/` view of the doc site includes only
  low-rated content. A parent handing the tablet to their kid can trust
  the surface.
- **Sakura's outbound content.** Anything Sakura generates carries a
  self-assigned rating in metadata; downstream renderers respect it.

## Where the field lives

- In every chapter SLAT record (`:content-rating :G`).
- Book-level default in MANIFEST.slat (`:default-content-rating :family`);
  chapters may override.
- Sakura's response records at serving time (self-assigned).

## Training-data implications

Include the content-rating field in every training pair as a native tag.
Then:
- Pairs where a user asks for kid-safe content pair with model responses
  that stay at :children rating.
- Pairs where a user asks for adult content that the persona should
  decline pair with a gentle refusal + offer of a kid-safe alternative.
- The rating field becomes a first-class filter dimension, not an
  afterthought.

## Rosetta translation

Rosetta maps `:content-rating` to consumer conventions:
- `:G / :PG / :children / :family` → MPAA-family or "safe"
- `:teen` → "13+"
- `:adult` → "18+"
- `:restricted` → gated behind explicit consent

## Cross-refs

- `[[SLAT-1.0.SPEC]]` — this field is a 1.1 addition (backward-compatible;
  missing rating defaults to `:family` or `:not-rated`)
- `[[sakura-silent-if-trouble-doctrine]]` — related restraint
- `[[the-kid-from-north-georgia]]` — why this matters
- Flower stories doctrine — no violence, no business, no stabbing

## Author's aside

Verbatim: *"So she would get some idea that these are for children also.
We could even put that into training data."*

Also verbatim: *"if someone says, 'hey, make something for my baby.
That's a child, I should say,' and she wouldn't make something like
Hamlet. I'm choking, but on flower stabbing the other, they should not
stab each other, by the way. They should not kill each other. I don't
think that's fair."*
