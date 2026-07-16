

<!-- highway landing: new-verb-nie.md -->

verb: place/recall
tier: novice
example: |
  (place/recall "Paris")
what-it-teaches: >
  Retrieve basic facts about a well-known location by name.
```

---

```yaml
verb: place/recall
tier: intermediate
example: |
  (let ((info (place/recall "Mariana Trench" :aspects '(depth geology))))
    (display ($ info 'depth))
    (display ($ info 'geology)))
what-it-teaches: >
  Request specific aspects of a place to narrow the retrieval scope.
```

---

```yaml
verb: place/recall
tier: expert
example: |
  (define (compare-ports names)
    (map (lambda (name)
           (let ((p (place/recall name :aspects '(tonnage trade-routes))))
             (list name ($ p 'tonnage) (length ($ p 'trade-routes)))))
         names))
  (compare-ports '("Rotterdam" "Singapore" "Shanghai"))
what-it-teaches: >
  Batch retrieval across multiple places and extract structured comparisons.
```

---

```yaml
verb: event/recall
tier: novice
example: |
  (event/recall "Apollo 11 moon landing")
what-it-teaches: >
  Retrieve facts about a historical event by its common name.
```

---

```yaml
verb: event/recall
tier: intermediate
example: |
  (let ((evt (event/recall "Treaty of Westphalia" :aspects '(date participants outcomes))))
    (when ($ evt 'outcomes)
      (for-each display ($ evt 'outcomes))))
what-it-teaches: >
  Focus retrieval on specific aspects and conditionally process structured results.
```

---

```yaml
verb: event/recall
tier: expert
example: |
  (define (timeline-between start-year end-year domain)
    (let ((events (event/recall :filter `((year-range ,start-year ,end-year)
                                          (domain ,domain)))))
      (sort events (lambda (a b) (< ($ a 'year) ($ b 'year))))))
  (timeline-between 1914 1918 'military)
what-it-teaches: >
  Query events by temporal and categorical filters, then sort results programmatically.
```

---

```yaml
verb: science/recall
tier: novice
example: |
  (science/recall "photosynthesis")
what-it-teaches: >
  Retrieve core facts about a scientific concept by name.
```

---

```yaml
verb: science/recall
tier: intermediate
example: |
  (let ((concept (science/recall "CRISPR" :aspects '(mechanism applications ethics))))
    (display ($ concept 'mechanism))
    (newline)
    (display ($ concept 'ethics)))
what-it-teaches: >
  Request multiple dimensions of a concept and selectively extract them.
```

---

```yaml
verb: science/recall
tier: expert
example: |
  (define (find-related-theories base-theory relation-type)
    (let ((base (science/recall base-theory :aspects '(related-theories))))
      (filter (lambda (rel) (eq? ($ rel 'type) relation-type))
              ($ base 'related-theories))))
  (find-related-theories "general relativity" 'extends)
what-it-teaches: >
  Navigate semantic relationships between scientific theories using structured filters.
```

---

```yaml
verb: craft/recall
tier: novice
example: |
  (craft/recall "knitting")
what-it-teaches: >
  Retrieve foundational knowledge about a craft or skill.
```

---

```yaml
verb: craft/recall
tier: intermediate
example: |
  (let ((pottery (craft/recall "pottery" :aspects '(tools techniques traditions))))
    (for-each (lambda (tool) (display tool) (newline))
              ($ pottery 'tools)))
what-it-teaches: >
  Extract and iterate over structured lists within craft knowledge.
```

---

```yaml
verb: craft/recall
tier: expert
example: |
  (define (compare-traditions craft region-a region-b)
    (let ((info (craft/recall craft :aspects '(regional-traditions))))
      (let ((traditions ($ info 'regional-traditions)))
        (list (assoc region-a traditions)
              (assoc region-b traditions)))))
  (compare-traditions "weaving" 'Navajo 'Andean)
what-it-teaches: >
  Query regional variations of a craft and perform associative lookups on nested data.
```

---

```yaml
verb: movement/recall
tier: novice
example: |
  (movement/recall "Impressionism")
what-it-teaches: >
  Retrieve basic facts about an artistic or cultural movement.
```

---

```yaml
verb: movement/recall
tier: intermediate
example: |
  (let ((mv (movement/recall "Bauhaus" :aspects '(key-figures principles influence))))
    (display ($ mv 'principles))
    (newline)
    (map display ($ mv 'key-figures)))
what-it-teaches: >
  Extract multiple structured aspects and iterate over lists of contributors.
```

---

```yaml
verb: movement/recall
tier: expert
example: |
  (define (trace-influence movement)
    (let ((mv (movement/recall movement :aspects '(influenced-by influenced))))
      (list :predecessors ($ mv 'influenced-by)
            :successors ($ mv 'influenced))))
  (trace-influence "Surrealism")
what-it-teaches: >
  Map bidirectional influence relationships to understand movement genealogy.
```

---

```yaml
verb: nature/recall
tier: novice
example: |
  (nature/recall "oak tree")
what-it-teaches: >
  Retrieve natural-world facts about a species or phenomenon.
```

---

```yaml
verb: nature/recall
tier: intermediate
example: |
  (let ((species (nature/recall "gray wolf" :aspects '(habitat diet social-structure))))
    (when (member 'pack ($ species 'social-structure))
      (display "Lives in packs")))
what-it-teaches: >
  Query specific biological or ecological aspects and branch on their presence.
```

---

```yaml
verb: nature/recall
tier: expert
example: |
  (define (ecosystem-roles biome role)
    (let ((info (nature/recall biome :aspects '(species))))
      (filter (lambda (sp) (member role ($ sp 'ecological-roles)))
              ($ info 'species))))
  (ecosystem-roles "coral reef" 'herbivore)
what-it-teaches: >
  Filter species within an ecosystem by ecological role using nested predicates.
```

---

```yaml
verb: culture/recall
tier: novice
example: |
  (culture/recall "Diwali")
what-it-teaches: >
  Retrieve facts about a cultural practice, holiday, or tradition.
```

---

```yaml
verb: culture/recall
tier: intermediate
example: |
  (let ((festival (culture/recall "Carnival" :aspects '(regions rituals history))))
    (for-each (lambda (region) (display region) (newline))
              ($ festival 'regions)))
what-it-teaches: >
  Extract regional variation data and iterate over geographic distributions.
```

---

```yaml
verb: culture/recall
tier: expert
example: |
  (define (compare-ritual-elements culture-a culture-b ritual-type)
    (let ((a (culture/recall culture-a :aspects (list ritual-type)))
          (b (culture/recall culture-b :aspects (list ritual-type))))
      (list :a-elements ($ a ritual-type)
            :b-elements ($ b ritual-type)
            :shared (intersection ($ a ritual-type) ($ b ritual-type)))))
  (compare-ritual-elements "Japanese tea ceremony" "Chinese tea culture" 'elements)
what-it-teaches: >
  Perform cross-cultural structural comparison with set operations on ritual components.
```

---

```yaml
verb: language/recall
tier: novice
example: |
  (language/recall "Spanish")
what-it-teaches: >
  Retrieve basic linguistic facts about a language.
```

---

```yaml
verb: language/recall
tier: intermediate
example: |
  (let ((lang (language/recall "Mandarin" :aspects '(writing-system tones speakers))))
    (display ($ lang 'writing-system))
    (newline)
    (display ($ lang 'tones)))
what-it-teaches: >
  Query structural linguistic features and demographic data together.
```

---

```yaml
verb: language/recall
tier: expert
example: |
  (define (find-related-languages base relation)
    (let ((info (language/recall base :aspects '(language-family related))))
      (filter (lambda (rel) (eq? ($ rel 'relation) relation))
              ($ info 'related))))
  (find-related-languages "Latin" 'descended-into)
what-it-teaches: >
  Navigate language family trees by filtering typed linguistic relationships.
```

---

```yaml
verb: common/recall
tier: novice
example: |
  (common/recall "bicycle")
what-it-teaches: >
  Retrieve everyday knowledge about a common object or concept.
```

---

```yaml
verb: common/recall
tier: intermediate
example: |
  (let ((obj (common/recall "umbrella" :aspects '(parts uses materials))))
    (when (member 'rain ($ obj 'uses))
      (display "Used for rain protection")))
what-it-teaches: >
  Query structural and functional aspects and test for specific features.
```

---

```yaml
verb: common/recall
tier: expert
example: |
  (define (compare-tool-evolution tool-a tool-b aspect)
    (let ((a (common/recall tool-a :aspects (list aspect 'history)))
          (b (common/recall tool-b :aspects (list aspect 'history))))
      (list :a-timeline ($ a 'history)
            :b-timeline ($ b 'history)
            :a-aspect ($ a aspect)
            :b-aspect ($ b aspect))))
  (compare-tool-evolution "typewriter" "keyboard" 'mechanism)
what-it-teaches: >
  Compare historical evolution and technical aspects of related everyday objects.
```

---

```yaml
verb: book/quote-from
tier: novice
example: |
  (book/quote-from "Pride and Prejudice" :about 'first-impressions)
what-it-teaches: >
  Retrieve a thematic quotation from a known work.
```

---

```yaml
verb: book/quote-from
tier: intermediate
example: |
  (let ((quote (book/quote-from "Meditations" 
                                :author "Marcus Aurelius" 
                                :about 'impermanence)))
    (display ($ quote 'text))
    (newline)
    (display ($ quote 'book-location)))
what-it-teaches: >
  Retrieve a quote with metadata and extract both text and source location.
```

---

```yaml
verb: book/quote-from
tier: expert
example: |
  (define (collect-quotes-on-theme works theme)
    (map (lambda (work)
           (let ((q (book/quote-from ($ work 'title) 
                                     :author ($ work 'author)
                                     :about theme)))
             (list ($ work 'title) ($ q 'text))))
         works))
  (collect-quotes-on-theme 
    '(((title . "Walden") (author . "Henry David Thoreau"))
      ((title . "Desert Solitaire") (author . "Edward Abbey")))
    'solitude)
what-it-teaches: >
  Batch thematic quote retrieval across multiple works with structured output.
```

---

```yaml
verb: book/reason-about
tier: novice
example: |
  (book/reason-about "To Kill a Mockingbird" :question "What does Atticus teach Scout?")
what-it-teaches: >
  Ask an interpretive question about a literary work.
```

---

```yaml
verb: book/reason-about
tier: intermediate
example: |
  (let ((analysis (book/reason-about "1984" 
                                     :question "How does Newspeak relate to power?"
                                     :aspects '(language control))))
    (display ($ analysis 'reasoning))
    (newline)
    (for-each display ($ analysis 'supporting-passages)))
what-it-teaches: >
  Request focused analysis with supporting evidence from the text.
```

---

```yaml
verb: book/reason-about
tier: expert
example: |
  (define (compare-interpretations work question lens-a lens-b)
    (let ((interp-a (book/reason-about work :question question :lens lens-a))
          (interp-b (book/reason-about work :question question :lens lens-b)))
      (list :question question
            :lens-a (list lens-a ($ interp-a 'reasoning))
            :lens-b (list lens-b ($ interp-b 'reasoning))
            :tension (find-tension ($ interp-a 'reasoning) 
                                   ($ interp-b 'reasoning)))))
  (compare-interpretations "Frankenstein" 
                          "Who is the real monster?"
                          'romantic
                          'feminist)
what-it-teaches: >
  Apply multiple critical lenses to the same question and analyze interpretive differences.
```

---

```yaml
verb: book/lookup
tier: novice
example: |
  (book/lookup "The Great Gatsby")
what-it-teaches: >
  Retrieve bibliographic and thematic metadata about a book.
```

---

```yaml
verb: book/lookup
tier: intermediate
example: |
  (let ((info (book/lookup "One Hundred Years of Solitude" 
                           :aspects '(structure themes publication))))
    (display ($ info 'structure))
    (newline)
    (map display ($ info 'themes)))
what-it-teaches: >
  Request specific metadata dimensions and iterate over thematic lists.
```

---

```yaml
verb: book/lookup
tier: expert
example: |
  (define (find-books-by-criteria criteria)
    (filter (lambda (book)
              (and (member ($ criteria 'theme) ($ book 'themes))
                   (>= ($ book 'publication-year) ($ criteria 'after-year))
                   (eq? ($ book 'form) ($ criteria 'form))))
            (book/lookup :query ($ criteria 'theme))))
  (find-books-by-criteria '((theme . magical-realism)
                            (after-year . 1960)
                            (form . novel)))
what-it-teaches: >
  Build complex filtered searches across thematic, temporal, and formal dimensions.
```

---

```yaml
verb: system/reflect
tier: novice
example: |
  (system/reflect :on-last-exchange)
what-it-teaches: >
  Request introspection on the most recent interaction.
```

---

```yaml
verb: system/reflect
tier: intermediate
example: |
  (let ((reflection (system/reflect :on-last-exchange :aspects '(uncertainty gaps))))
    (when ($ reflection 'uncertainty)
      (display "Uncertain about: ")
      (display ($ reflection 'uncertainty)))
    (when ($ reflection 'gaps)
      (display "Missing: ")
      (display ($ reflection 'gaps))))
what-it-teaches: >
  Inspect specific dimensions of uncertainty and knowledge gaps after a response.
```

---

```yaml
verb: system/reflect
tier: expert
example: |
  (define (iterative-clarify question max-rounds)
    (let loop ((q question) (round 0))
      (if (>= round max-rounds)
          'max-iterations-reached
          (let* ((answer (query q))
                 (reflection (system/reflect :on-last-exchange 
                                            :aspects '(ambiguity-remaining))))
            (if (null? ($ reflection 'ambiguity-remaining))
                answer
                (loop (cons q ($ reflection 'suggested-clarifications))
                      (+ round 1)))))))
  (iterative-clarify "What causes tides?" 3)
what-it-teaches: >
  Use reflection in a loop to detect ambiguity and iteratively refine questions.
```

---

```yaml
verb: system/why-i-just
tier: novice
example: |
  (system/why-i-just :did 'choose-this-answer)
what-it-teaches: >
  Ask for explanation of a reasoning choice just made.
```

---

```yaml
verb: system/why-i-just
tier: intermediate
example: |
  (let ((rationale (system/why-i-just :did 'prioritize-this-source
                                      :aspects '(relevance authority recency))))
    (display "Relevance weight: ")
    (display ($ rationale 'relevance))
    (newline)
    (display "Authority weight: ")
    (display ($ rationale 'authority)))
what-it-teaches: >
  Inspect the multidimensional reasoning behind a source or method selection.
```

---

```yaml
verb: system/why-i-just
tier: expert
example: |
  (define (audit-decision-path action)
    (let ((trace (system/why-i-just :did action :aspects '(alternatives costs trade-offs))))
      (list :chosen action
            :rejected ($ trace 'alternatives)
            :because ($ trace 'trade-offs)
            :cost-estimate ($ trace 'costs))))
  (let ((path (audit-decision-path 'used-approximate-method)))
    (when (> ($ path 'cost-estimate) threshold)
      (display "High cost detected")
      (display ($ path 'because))))
what-it-teaches: >
  Trace full decision branches including rejected alternatives and cost trade-offs.
```

---

```yaml
verb: system/self
tier: novice
example: |
  (system/self :read-source 'cart-signing-trust)
what-it-teaches: >
  Read a single atom from the substrate's self-knowledge by ID.
```

---

```yaml
verb: system/self
tier: intermediate
example: |
  (let ((atom (system/self :read-source 'cart-signing-trust)))
    (display ($ atom 'title))
    (newline)
    (display ($ ($ atom 'layers) 'meaning)))
what-it-teaches: >
  Extract and navigate the three-layer structure of a self-knowledge atom.
```

---

```yaml
verb: system/self
tier: expert
example: |
  (define (trace-edge-path start-id relation-type max-depth)
    (let loop ((current-id start-id) (depth 0) (visited '()))
      (if (or (>= depth max-depth) (member current-id visited))
          (reverse visited)
          (let* ((atom (system/self :read-source current-id))
                 (edges ($ atom 'edges))
                 (next (find (lambda (e) (eq? ($ e 'rel) relation-type)) edges)))
            (if next
                (loop ($ next 'to) (+ depth 1) (cons current-id visited))
                (reverse (cons current-id visited)))))))
  (trace-edge-path 'cart-signing-trust 'is-part-of 5)
what-it-teaches: >
  Walk the knowledge graph by following typed edges with depth limits and cycle detection.


<!-- highway landing: new-verb-nie.md -->

verb: place/recall
tier: novice
example: |
  (place/recall "Paris")
what-it-teaches: >
  Retrieve basic facts about a well-known location by name.
```

---

```yaml
verb: place/recall
tier: intermediate
example: |
  (let ((info (place/recall "Mariana Trench" :aspects '(depth geology))))
    (display ($ info 'depth))
    (display ($ info 'geology)))
what-it-teaches: >
  Request specific aspects of a place to narrow the retrieval scope.
```

---

```yaml
verb: place/recall
tier: expert
example: |
  (define (compare-ports names)
    (map (lambda (name)
           (let ((p (place/recall name :aspects '(tonnage trade-routes))))
             (list name ($ p 'tonnage) (length ($ p 'trade-routes)))))
         names))
  (compare-ports '("Rotterdam" "Singapore" "Shanghai"))
what-it-teaches: >
  Batch retrieval across multiple places and extract structured comparisons.
```

---

```yaml
verb: event/recall
tier: novice
example: |
  (event/recall "Apollo 11 moon landing")
what-it-teaches: >
  Retrieve facts about a historical event by its common name.
```

---

```yaml
verb: event/recall
tier: intermediate
example: |
  (let ((evt (event/recall "Treaty of Westphalia" :aspects '(date participants outcomes))))
    (when ($ evt 'outcomes)
      (for-each display ($ evt 'outcomes))))
what-it-teaches: >
  Focus retrieval on specific aspects and conditionally process structured results.
```

---

```yaml
verb: event/recall
tier: expert
example: |
  (define (timeline-between start-year end-year domain)
    (let ((events (event/recall :filter `((year-range ,start-year ,end-year)
                                          (domain ,domain)))))
      (sort events (lambda (a b) (< ($ a 'year) ($ b 'year))))))
  (timeline-between 1914 1918 'military)
what-it-teaches: >
  Query events by temporal and categorical filters, then sort results programmatically.
```

---

```yaml
verb: science/recall
tier: novice
example: |
  (science/recall "photosynthesis")
what-it-teaches: >
  Retrieve core facts about a scientific concept by name.
```

---

```yaml
verb: science/recall
tier: intermediate
example: |
  (let ((concept (science/recall "CRISPR" :aspects '(mechanism applications ethics))))
    (display ($ concept 'mechanism))
    (newline)
    (display ($ concept 'ethics)))
what-it-teaches: >
  Request multiple dimensions of a concept and selectively extract them.
```

---

```yaml
verb: science/recall
tier: expert
example: |
  (define (find-related-theories base-theory relation-type)
    (let ((base (science/recall base-theory :aspects '(related-theories))))
      (filter (lambda (rel) (eq? ($ rel 'type) relation-type))
              ($ base 'related-theories))))
  (find-related-theories "general relativity" 'extends)
what-it-teaches: >
  Navigate semantic relationships between scientific theories using structured filters.
```

---

```yaml
verb: craft/recall
tier: novice
example: |
  (craft/recall "knitting")
what-it-teaches: >
  Retrieve foundational knowledge about a craft or skill.
```

---

```yaml
verb: craft/recall
tier: intermediate
example: |
  (let ((pottery (craft/recall "pottery" :aspects '(tools techniques traditions))))
    (for-each (lambda (tool) (display tool) (newline))
              ($ pottery 'tools)))
what-it-teaches: >
  Extract and iterate over structured lists within craft knowledge.
```

---

```yaml
verb: craft/recall
tier: expert
example: |
  (define (compare-traditions craft region-a region-b)
    (let ((info (craft/recall craft :aspects '(regional-traditions))))
      (let ((traditions ($ info 'regional-traditions)))
        (list (assoc region-a traditions)
              (assoc region-b traditions)))))
  (compare-traditions "weaving" 'Navajo 'Andean)
what-it-teaches: >
  Query regional variations of a craft and perform associative lookups on nested data.
```

---

```yaml
verb: movement/recall
tier: novice
example: |
  (movement/recall "Impressionism")
what-it-teaches: >
  Retrieve basic facts about an artistic or cultural movement.
```

---

```yaml
verb: movement/recall
tier: intermediate
example: |
  (let ((mv (movement/recall "Bauhaus" :aspects '(key-figures principles influence))))
    (display ($ mv 'principles))
    (newline)
    (map display ($ mv 'key-figures)))
what-it-teaches: >
  Extract multiple structured aspects and iterate over lists of contributors.
```

---

```yaml
verb: movement/recall
tier: expert
example: |
  (define (trace-influence movement)
    (let ((mv (movement/recall movement :aspects '(influenced-by influenced))))
      (list :predecessors ($ mv 'influenced-by)
            :successors ($ mv 'influenced))))
  (trace-influence "Surrealism")
what-it-teaches: >
  Map bidirectional influence relationships to understand movement genealogy.
```

---

```yaml
verb: nature/recall
tier: novice
example: |
  (nature/recall "oak tree")
what-it-teaches: >
  Retrieve natural-world facts about a species or phenomenon.
```

---

```yaml
verb: nature/recall
tier: intermediate
example: |
  (let ((species (nature/recall "gray wolf" :aspects '(habitat diet social-structure))))
    (when (member 'pack ($ species 'social-structure))
      (display "Lives in packs")))
what-it-teaches: >
  Query specific biological or ecological aspects and branch on their presence.
```

---

```yaml
verb: nature/recall
tier: expert
example: |
  (define (ecosystem-roles biome role)
    (let ((info (nature/recall biome :aspects '(species))))
      (filter (lambda (sp) (member role ($ sp 'ecological-roles)))
              ($ info 'species))))
  (ecosystem-roles "coral reef" 'herbivore)
what-it-teaches: >
  Filter species within an ecosystem by ecological role using nested predicates.
```

---

```yaml
verb: culture/recall
tier: novice
example: |
  (culture/recall "Diwali")
what-it-teaches: >
  Retrieve facts about a cultural practice, holiday, or tradition.
```

---

```yaml
verb: culture/recall
tier: intermediate
example: |
  (let ((festival (culture/recall "Carnival" :aspects '(regions rituals history))))
    (for-each (lambda (region) (display region) (newline))
              ($ festival 'regions)))
what-it-teaches: >
  Extract regional variation data and iterate over geographic distributions.
```

---

```yaml
verb: culture/recall
tier: expert
example: |
  (define (compare-ritual-elements culture-a culture-b ritual-type)
    (let ((a (culture/recall culture-a :aspects (list ritual-type)))
          (b (culture/recall culture-b :aspects (list ritual-type))))
      (list :a-elements ($ a ritual-type)
            :b-elements ($ b ritual-type)
            :shared (intersection ($ a ritual-type) ($ b ritual-type)))))
  (compare-ritual-elements "Japanese tea ceremony" "Chinese tea culture" 'elements)
what-it-teaches: >
  Perform cross-cultural structural comparison with set operations on ritual components.
```

---

```yaml
verb: language/recall
tier: novice
example: |
  (language/recall "Spanish")
what-it-teaches: >
  Retrieve basic linguistic facts about a language.
```

---

```yaml
verb: language/recall
tier: intermediate
example: |
  (let ((lang (language/recall "Mandarin" :aspects '(writing-system tones speakers))))
    (display ($ lang 'writing-system))
    (newline)
    (display ($ lang 'tones)))
what-it-teaches: >
  Query structural linguistic features and demographic data together.
```

---

```yaml
verb: language/recall
tier: expert
example: |
  (define (find-related-languages base relation)
    (let ((info (language/recall base :aspects '(language-family related))))
      (filter (lambda (rel) (eq? ($ rel 'relation) relation))
              ($ info 'related))))
  (find-related-languages "Latin" 'descended-into)
what-it-teaches: >
  Navigate language family trees by filtering typed linguistic relationships.
```

---

```yaml
verb: common/recall
tier: novice
example: |
  (common/recall "bicycle")
what-it-teaches: >
  Retrieve everyday knowledge about a common object or concept.
```

---

```yaml
verb: common/recall
tier: intermediate
example: |
  (let ((obj (common/recall "umbrella" :aspects '(parts uses materials))))
    (when (member 'rain ($ obj 'uses))
      (display "Used for rain protection")))
what-it-teaches: >
  Query structural and functional aspects and test for specific features.
```

---

```yaml
verb: common/recall
tier: expert
example: |
  (define (compare-tool-evolution tool-a tool-b aspect)
    (let ((a (common/recall tool-a :aspects (list aspect 'history)))
          (b (common/recall tool-b :aspects (list aspect 'history))))
      (list :a-timeline ($ a 'history)
            :b-timeline ($ b 'history)
            :a-aspect ($ a aspect)
            :b-aspect ($ b aspect))))
  (compare-tool-evolution "typewriter" "keyboard" 'mechanism)
what-it-teaches: >
  Compare historical evolution and technical aspects of related everyday objects.
```

---

```yaml
verb: book/quote-from
tier: novice
example: |
  (book/quote-from "Pride and Prejudice" :about 'first-impressions)
what-it-teaches: >
  Retrieve a thematic quotation from a known work.
```

---

```yaml
verb: book/quote-from
tier: intermediate
example: |
  (let ((quote (book/quote-from "Meditations" 
                                :author "Marcus Aurelius" 
                                :about 'impermanence)))
    (display ($ quote 'text))
    (newline)
    (display ($ quote 'book-location)))
what-it-teaches: >
  Retrieve a quote with metadata and extract both text and source location.
```

---

```yaml
verb: book/quote-from
tier: expert
example: |
  (define (collect-quotes-on-theme works theme)
    (map (lambda (work)
           (let ((q (book/quote-from ($ work 'title) 
                                     :author ($ work 'author)
                                     :about theme)))
             (list ($ work 'title) ($ q 'text))))
         works))
  (collect-quotes-on-theme 
    '(((title . "Walden") (author . "Henry David Thoreau"))
      ((title . "Desert Solitaire") (author . "Edward Abbey")))
    'solitude)
what-it-teaches: >
  Batch thematic quote retrieval across multiple works with structured output.
```

---

```yaml
verb: book/reason-about
tier: novice
example: |
  (book/reason-about "To Kill a Mockingbird" :question "What does Atticus teach Scout?")
what-it-teaches: >
  Ask an interpretive question about a literary work.
```

---

```yaml
verb: book/reason-about
tier: intermediate
example: |
  (let ((analysis (book/reason-about "1984" 
                                     :question "How does Newspeak relate to power?"
                                     :aspects '(language control))))
    (display ($ analysis 'reasoning))
    (newline)
    (for-each display ($ analysis 'supporting-passages)))
what-it-teaches: >
  Request focused analysis with supporting evidence from the text.
```

---

```yaml
verb: book/reason-about
tier: expert
example: |
  (define (compare-interpretations work question lens-a lens-b)
    (let ((interp-a (book/reason-about work :question question :lens lens-a))
          (interp-b (book/reason-about work :question question :lens lens-b)))
      (list :question question
            :lens-a (list lens-a ($ interp-a 'reasoning))
            :lens-b (list lens-b ($ interp-b 'reasoning))
            :tension (find-tension ($ interp-a 'reasoning) 
                                   ($ interp-b 'reasoning)))))
  (compare-interpretations "Frankenstein" 
                          "Who is the real monster?"
                          'romantic
                          'feminist)
what-it-teaches: >
  Apply multiple critical lenses to the same question and analyze interpretive differences.
```

---

```yaml
verb: book/lookup
tier: novice
example: |
  (book/lookup "The Great Gatsby")
what-it-teaches: >
  Retrieve bibliographic and thematic metadata about a book.
```

---

```yaml
verb: book/lookup
tier: intermediate
example: |
  (let ((info (book/lookup "One Hundred Years of Solitude" 
                           :aspects '(structure themes publication))))
    (display ($ info 'structure))
    (newline)
    (map display ($ info 'themes)))
what-it-teaches: >
  Request specific metadata dimensions and iterate over thematic lists.
```

---

```yaml
verb: book/lookup
tier: expert
example: |
  (define (find-books-by-criteria criteria)
    (filter (lambda (book)
              (and (member ($ criteria 'theme) ($ book 'themes))
                   (>= ($ book 'publication-year) ($ criteria 'after-year))
                   (eq? ($ book 'form) ($ criteria 'form))))
            (book/lookup :query ($ criteria 'theme))))
  (find-books-by-criteria '((theme . magical-realism)
                            (after-year . 1960)
                            (form . novel)))
what-it-teaches: >
  Build complex filtered searches across thematic, temporal, and formal dimensions.
```

---

```yaml
verb: system/reflect
tier: novice
example: |
  (system/reflect :on-last-exchange)
what-it-teaches: >
  Request introspection on the most recent interaction.
```

---

```yaml
verb: system/reflect
tier: intermediate
example: |
  (let ((reflection (system/reflect :on-last-exchange :aspects '(uncertainty gaps))))
    (when ($ reflection 'uncertainty)
      (display "Uncertain about: ")
      (display ($ reflection 'uncertainty)))
    (when ($ reflection 'gaps)
      (display "Missing: ")
      (display ($ reflection 'gaps))))
what-it-teaches: >
  Inspect specific dimensions of uncertainty and knowledge gaps after a response.
```

---

```yaml
verb: system/reflect
tier: expert
example: |
  (define (iterative-clarify question max-rounds)
    (let loop ((q question) (round 0))
      (if (>= round max-rounds)
          'max-iterations-reached
          (let* ((answer (query q))
                 (reflection (system/reflect :on-last-exchange 
                                            :aspects '(ambiguity-remaining))))
            (if (null? ($ reflection 'ambiguity-remaining))
                answer
                (loop (cons q ($ reflection 'suggested-clarifications))
                      (+ round 1)))))))
  (iterative-clarify "What causes tides?" 3)
what-it-teaches: >
  Use reflection in a loop to detect ambiguity and iteratively refine questions.
```

---

```yaml
verb: system/why-i-just
tier: novice
example: |
  (system/why-i-just :did 'choose-this-answer)
what-it-teaches: >
  Ask for explanation of a reasoning choice just made.
```

---

```yaml
verb: system/why-i-just
tier: intermediate
example: |
  (let ((rationale (system/why-i-just :did 'prioritize-this-source
                                      :aspects '(relevance authority recency))))
    (display "Relevance weight: ")
    (display ($ rationale 'relevance))
    (newline)
    (display "Authority weight: ")
    (display ($ rationale 'authority)))
what-it-teaches: >
  Inspect the multidimensional reasoning behind a source or method selection.
```

---

```yaml
verb: system/why-i-just
tier: expert
example: |
  (define (audit-decision-path action)
    (let ((trace (system/why-i-just :did action :aspects '(alternatives costs trade-offs))))
      (list :chosen action
            :rejected ($ trace 'alternatives)
            :because ($ trace 'trade-offs)
            :cost-estimate ($ trace 'costs))))
  (let ((path (audit-decision-path 'used-approximate-method)))
    (when (> ($ path 'cost-estimate) threshold)
      (display "High cost detected")
      (display ($ path 'because))))
what-it-teaches: >
  Trace full decision branches including rejected alternatives and cost trade-offs.
```

---

```yaml
verb: system/self
tier: novice
example: |
  (system/self :read-source 'cart-signing-trust)
what-it-teaches: >
  Read a single atom from the substrate's self-knowledge by ID.
```

---

```yaml
verb: system/self
tier: intermediate
example: |
  (let ((atom (system/self :read-source 'cart-signing-trust)))
    (display ($ atom 'title))
    (newline)
    (display ($ ($ atom 'layers) 'meaning)))
what-it-teaches: >
  Extract and navigate the three-layer structure of a self-knowledge atom.
```

---

```yaml
verb: system/self
tier: expert
example: |
  (define (trace-edge-path start-id relation-type max-depth)
    (let loop ((current-id start-id) (depth 0) (visited '()))
      (if (or (>= depth max-depth) (member current-id visited))
          (reverse visited)
          (let* ((atom (system/self :read-source current-id))
                 (edges ($ atom 'edges))
                 (next (find (lambda (e) (eq? ($ e 'rel) relation-type)) edges)))
            (if next
                (loop ($ next 'to) (+ depth 1) (cons current-id visited))
                (reverse (cons current-id visited)))))))
  (trace-edge-path 'cart-signing-trust 'is-part-of 5)
what-it-teaches: >
  Walk the knowledge graph by following typed edges with depth limits and cycle detection.
