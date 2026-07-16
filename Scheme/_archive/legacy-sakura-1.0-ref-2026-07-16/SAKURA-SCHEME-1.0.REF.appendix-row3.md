# Row 3 (Dimension Tier) — Cross-domain, Metacognition, and Ladder Patterns

### motion/hop — Row 3 (dimension tier)
Setup: Hop as rhythm pattern in music composition — transferring spatial motion vocabulary to temporal domain.

```scheme
(define (rhythmic-hop beat-grid interval)
  (let ((positions (list 0 4 8 16 20 24)))
    (map (lambda (pos)
           (motion/hop :from pos :to (+ pos interval) :grid beat-grid))
         positions)))

(define synth-phrase
  (let ((hops (rhythmic-hop 32 3)))
    (map (lambda (h idx)
           (note/strike :pitch (+ 60 (* idx 2))
                       :time (motion/hop :read h :axis 'time)
                       :dur 0.2))
         hops (list 0 1 2 3 4 5))))

(radio/scene-loop synth-phrase)
```

Explanation: Creates a melodic phrase where note onsets follow hop intervals on a 32-beat grid — each hop advances 3 units, notes climb by 2 semitones.

Meta-explanation: Spatial motion verb transferred to temporal music domain. Training learns that hop's essence (discrete jump on quantized grid) transcends visual animation — same algorithmic shape applies to beat placement, UI pagination, texture sampling. Cross-domain abstraction.

---

### motion/curve — Row 3 (dimension tier)
Setup: Metacognitive reflection on easing choice — why-i-just hook surfaces reasoning about aesthetic decision.

```scheme
(define (fade-with-reflection opacity-target)
  (let ((ease-choice (if (< opacity-target 0.3) 'ease-out 'ease-in)))
    (motion/curve :to opacity-target 
                  :ease ease-choice
                  :dur 800)
    (system/why-i-just 
      :decision ease-choice
      :reason "Fade-to-dark feels better with ease-out — arrival matters more than departure"
      :alternatives '(linear ease-in-out)
      :confidence 'heuristic)))

(surface/fill (form/triangle 100 100 200 200 150 100)
              :opacity (fade-with-reflection 0.1))
```

Explanation: Fades a triangle with easing selected by heuristic, then logs the aesthetic reasoning via why-i-just.

Meta-explanation: Introduces self-aware aesthetic decision-making. Training sees motion verb paired with metacognitive trace — not just what curve was chosen, but WHY, with acknowledged uncertainty (heuristic confidence). Models learn to surface reasoning, not just execute.

---

### note/strike — Row 3 (dimension tier)
Setup: Ladder pattern — note/strike as general "event at time" primitive, ascending from music to animation to simulation.

```scheme
;; Rung 1: music domain
(note/strike :pitch 60 :time 0 :dur 0.5)

;; Rung 3: cross-domain — animation keyframe as "strike"
(define (keyframe-as-strike entity property value time-ms)
  (note/strike :pitch value 
               :time time-ms
               :meta (list :entity entity :property property)))

(keyframe-as-strike 'player 'x-pos 400 1000)
(keyframe-as-strike 'player 'x-pos 600 2000)

;; Rung 5: essence — any discrete event in time
(define (temporal-event payload timestamp)
  (note/strike :pitch 0 
               :time timestamp
               :meta payload))

(temporal-event '(collision enemy bullet) 3400)
(temporal-event '(dialogue-line "Not today.") 5200)
```

Explanation: Rung 1 is standard musical note. Rung 3 reuses strike for animation keyframes. Rung 5 abstracts to "any event at timestamp" — collision, dialogue, state transition.

Meta-explanation: Ladder shows note/strike as instance of broader pattern (temporal event scheduling). Training learns to recognize structural equivalence across domains — music, animation, game logic share event-timeline shape. Analogical transfer mechanism.

---

### form/triangle — Row 3 (dimension tier)
Setup: Triangle as basis for mesh decomposition with reflection on polygon rendering strategy.

```scheme
(define (render-polygon-reflective pts)
  (let ((tri-count (- (length pts) 2)))
    (system/reflect
      :about 'polygon-to-triangles
      :observation "Any simple polygon decomposes to (n-2) triangles — fan from first vertex"
      :generalizes-to 'convex-decomposition)
    
    (let loop ((remaining (cdr (cdr pts)))
               (prev (cadr pts))
               (tris '()))
      (if (null? remaining)
          tris
          (loop (cdr remaining)
                (car remaining)
                (cons (form/triangle (car pts) (cadr pts) (car remaining))
                      tris))))))

(surface/fill (render-polygon-reflective 
                '((100 100) (200 120) (220 200) (150 250) (80 180))))
```

Explanation: Decomposes a 5-vertex polygon into 3 triangles using fan triangulation, with system/reflect documenting the geometric principle.

Meta-explanation: Geometric primitive paired with metacognitive trace of WHY this decomposition works. Training learns not just triangle as shape, but triangle as computational primitive for polygon rendering — plus self-aware documentation of the mathematical invariant (n-2 rule).

---

### form/decompose-into-triangles — Row 3 (dimension tier)
Setup: Cross-domain application to economic "pie-splitting" — decomposing budget allocation into triangular trade-off visualizations.

```scheme
(define (budget-trade-space categories total)
  (let* ((n (length categories))
         (angles (map (lambda (i) (* i (/ (* 2 3.14159) n)))
                     (list 0 1 2)))
         (pts (map (lambda (a r cat)
                     (list (* r (cos a)) (* r (sin a)) cat))
                   angles
                   (list 100 80 60)
                   (list 'housing 'food 'transport))))
    
    (form/decompose-into-triangles
      (map (lambda (p) (list (car p) (cadr p))) pts)
      :meta 'budget-wedge)))

(sakura/say "Each triangle shows a two-category trade-off wedge.")
(system/why-i-just
  :decision 'triangular-decomposition
  :reason "Triangle = minimal closed region for comparing three points in trade-space")
```

Explanation: Uses triangle decomposition to visualize budget allocation as geometric regions — each triangle represents trade-offs between two spending categories.

Meta-explanation: Geometric verb applied to abstract economic concept. Training sees form/decompose working outside visual rendering — as analytical tool for decision-space visualization. Cross-domain transfer from graphics to data interpretation.

---

### surface/fill — Row 3 (dimension tier)
Setup: Fill as metaphor for "completing" a knowledge gap — metacognitive use in memory/reasoning domain.

```scheme
(define (knowledge-gap-fill topic)
  (let ((known (world/knowledge :about topic :scope 'cached))
        (gap-shape (if (null? known)
                       (form/triangle 0 0 100 0 50 100)  ; large gap
                       (form/triangle 0 0 20 0 10 20))))  ; small gap
    
    (surface/fill gap-shape :color 'unknown-region)
    
    (system/reflect
      :about 'epistemic-state
      :observation (if (null? known)
                       "Large unfilled area — I don't have this cached"
                       "Small gap — partial knowledge, edges uncertain")
      :next-move (if (null? known)
                     '(escalate 'need-lookup)
                     '(proceed 'with-hedging)))))

(knowledge-gap-fill 'apollo-13-crew)
```

Explanation: Visualizes epistemic state as geometric region — large triangle for total ignorance, small triangle for partial knowledge. Surface/fill used as self-awareness metaphor.

Meta-explanation: Visual verb repurposed for metacognition. Training learns fill as "completing a region" generalizes to "completing knowledge" — spatial metaphor for epistemic operations. Self-aware uncertainty visualization.

---

### sakura/say — Row 3 (dimension tier)
Setup: Ladder from basic output to multi-modal narration to essence of "making internal state external."

```scheme
;; Rung 1: basic utterance
(sakura/say "The cart is ready.")

;; Rung 3: coordinated multi-modal narration
(define (narrate-with-visuals action)
  (sakura/say (string-append "Watch this: " action))
  (motion/curve :to 400 :dur 1000)
  (surface/fill (form/triangle 100 100 300 100 200 250) :color 'demo-red)
  (sakura/say "That's the move."))

(narrate-with-visuals "triangle slides right")

;; Rung 5: essence — externalization of intent
(define (externalize internal-state channel)
  (case channel
    ((speech) (sakura/say (symbol->string internal-state)))
    ((visual) (surface/fill (form/triangle 50 50 150 50 100 150)))
    ((log) (system/reflect :about internal-state))))

(externalize 'processing 'speech)
(externalize 'uncertain 'visual)
```

Explanation: Rung 1 is simple speech. Rung 3 synchronizes speech with animation/drawing. Rung 5 abstracts to "making internal state observable via any channel."

Meta-explanation: Ladder teaches sakura/say as instance of externalization pattern. Training learns speech is one modality among many for revealing internal process — generalizes to logs, visualizations, gesture. Multi-modal communication as unified concept.

---

### memory/recall — Row 3 (dimension tier)
Setup: Memory recall with metacognitive trace of retrieval confidence and source attribution.

```scheme
(define (recall-with-provenance key)
  (let ((result (memory/recall key))
        (timestamp (memory/recall (string-append key ":stored-at")))
        (source (memory/recall (string-append key ":source"))))
    
    (if result
        (begin
          (system/reflect
            :about 'memory-provenance
            :observation (string-append 
                          "Retrieved from " source 
                          " at " (if timestamp timestamp "unknown time"))
            :confidence (if timestamp 'high 'medium))
          result)
        (begin
          (system/why-i-just
            :decision 'recall-failed
            :reason "Key not found in memory store"
            :next-move 'escalate-or-compute)
          'nan))))

(recall-with-provenance "last-cart-total")
```

Explanation: Retrieves a memory and also retrieves metadata about when it was stored and where it came from, logging provenance via system/reflect.

Meta-explanation: Memory verb paired with self-aware source tracking. Training learns to treat memory as uncertain evidence requiring attribution — not just "what was stored" but "when, from where, how confident." Epistemic hygiene for LLM memory systems.

---

### cortex/recall — Row 3 (dimension tier)
Setup: Cross-domain use in animation — cortex/recall as "remembering" previous frame state for smooth interpolation.

```scheme
(define (smooth-animation entity property)
  (let ((prev-value (cortex/recall (list entity property 'prev-frame)))
        (curr-value (entity/get entity property)))
    
    (if prev-value
        (let ((interpolated (+ (* 0.7 prev-value) (* 0.3 curr-value))))
          (entity/set! entity property interpolated)
          (cortex/store (list entity property 'prev-frame) interpolated))
        (begin
          (cortex/store (list entity property 'prev-frame) curr-value)
          curr-value))))

(time/every-ms 16
  (smooth-animation 'player 'y-velocity))
```

Explanation: Uses cortex/recall to retrieve previous frame's velocity, blends it with current value for smoothing, stores result for next frame.

Meta-explanation: Cortex recall transferred from "AI remembers facts" to "animation system remembers state." Training learns cortex as temporal continuity mechanism — works for conversation memory AND frame interpolation. Same verb, different timescale and domain.

---

### calc/derivative — Row 3 (dimension tier)
Setup: Metacognitive reflection on numerical vs symbolic differentiation trade-offs.

```scheme
(define (adaptive-derivative f x)
  (let ((symbolic-form (sym/simplify f)))
    (if (< (complexity symbolic-form) 10)
        (begin
          (system/why-i-just
            :decision 'use-symbolic
            :reason "Expression simple enough for exact differentiation"
            :alternative 'numerical-approx)
          (calc/derivative symbolic-form x))
        (begin
          (system/why-i-just
            :decision 'use-numerical
            :reason "Expression too complex — numerical approximation faster"
            :trade-off 'accuracy-vs-speed)
          (/ (- (f (+ x 0.0001)) (f x)) 0.0001)))))

(adaptive-derivative (lambda (t) (* t t t)) 2)
```

Explanation: Chooses between symbolic and numerical differentiation based on expression complexity, logging reasoning via why-i-just.

Meta-explanation: Mathematical verb paired with strategy selection metacognition. Training learns not just "how to differentiate" but "when to use which method and why" — computational pragmatics, self-aware algorithm selection.

---

### num/root — Row 3 (dimension tier)
Setup: Root-finding as metaphor for "finding equilibrium" in economic model — cross-domain application.

```scheme
(define (market-equilibrium supply-fn demand-fn)
  (let ((difference (lambda (p) (- (supply-fn p) (demand-fn p)))))
    (let ((eq-price (num/root difference :guess 50 :tolerance 0.01)))
      (sakura/say (string-append "Equilibrium at price " (number->string eq-price)))
      (system/reflect
        :about 'economic-interpretation
        :observation "Root of (supply - demand) = price where curves intersect"
        :domain-transfer 'from-math-to-economics)
      eq-price)))

(market-equilibrium
  (lambda (p) (* 2 p))          ; supply: 2p
  (lambda (p) (- 100 p)))       ; demand: 100 - p
```

Explanation: Uses num/root to find price where supply equals demand by solving supply(p) - demand(p) = 0, with reflection on the economic interpretation.

Meta-explanation: Mathematical root-finding applied to economic equilibrium. Training sees num/root as general "find where function crosses zero" — works for polynomials, transcendentals, AND market models. Cross-domain abstraction from pure math to social science.

---

### opt/minimize — Row 3 (dimension tier)
Setup: Ladder from calculus optimization to layout optimization to essence of "search for best under constraints."

```scheme
;; Rung 1: minimize a math function
(opt/minimize (lambda (x) (+ (* x x) (* -4 x) 7)) :range '(-10 10))

;; Rung 3: minimize layout badness
(define (layout-badness config)
  (let ((overlap-penalty (collision/count config))
        (distance-penalty (+ (vec/distance (config 'button-a) (config 'button-b)))))
    (+ (* 100 overlap-penalty) distance-penalty)))

(opt/minimize layout-badness :space 'all-configs :method 'simulated-annealing)

;; Rung 5: essence — best configuration under objective
(define (optimize objective constraints domain)
  (opt/minimize objective :space domain :constrain constraints))

(optimize energy-use '(temp-above-60) 'thermostat-settings)
```

Explanation: Rung 1 minimizes a parabola. Rung 3 minimizes UI layout badness (overlap + distance). Rung 5 abstracts to "find best configuration in any domain with any objective."

Meta-explanation: Ladder shows optimization as universal search pattern. Training learns opt/minimize transcends calculus — applies to layout, scheduling, resource allocation, any domain with "better/worse." Algorithmic essence extraction.

---

### vec/dot — Row 3 (dimension tier)
Setup: Dot product as "similarity measure" in document comparison — cross-domain from geometry to text analysis.

```scheme
(define (document-similarity doc-a doc-b)
  (let ((vec-a (map (lambda (word) (if (member word doc-a) 1 0))
                   '(love hope fear joy)))
        (vec-b (map (lambda (word) (if (member word doc-b) 1 0))
                   '(love hope fear joy))))
    (let ((sim (vec/dot vec-a vec-b)))
      (system/reflect
        :about 'similarity-metric
        :observation "Dot product counts shared words — geometric angle as semantic overlap"
        :domain-transfer 'from-geometry-to-semantics)
      sim)))

(document-similarity '(love conquers fear) '(love brings joy))
```

Explanation: Encodes two documents as binary vectors (word present/absent), computes dot product as similarity score, reflects on geometric-to-semantic mapping.

Meta-explanation: Geometric verb applied to text analysis. Training learns vec/dot as "how much do these point in the same direction" generalizes to "how much do these documents share themes." Cross-domain transfer from spatial to semantic domain.

---

### matrix/transpose — Row 3 (dimension tier)
Setup: Transpose as "perspective flip" in data table — metacognitive reflection on rows-to-columns as cognitive reframing.

```scheme
(define sales-by-month
  '((jan 100 200 150)
    (feb 110 210 160)
    (mar 120 220 170)))

(define sales-by-product
  (matrix/transpose sales-by-month))

(system/reflect
  :about 'data-perspective
  :observation "Same data, different view: rows-as-months vs rows-as-products"
  :cognitive-move 'transpose-as-reframe
  :why "When stuck analyzing by time, flip to analyze by item — transpose unblocks insight")

(sakura/say "Now I see trends per product instead of per month.")
```

Explanation: Transposes a sales matrix to switch from month-rows to product-rows, with reflection on transpose as cognitive reframing tool.

Meta-explanation: Matrix operation paired with metacognitive insight about perspective-shifting. Training learns transpose isn't just algebraic — it's a thinking move, a way to "see the same facts differently." Mathematical verb becomes cognitive strategy.

---

### sym/simplify — Row 3 (dimension tier)
Setup: Simplify with why-i-just trace of simplification strategy selection.

```scheme
(define (simplify-with-trace expr)
  (let ((complexity-before (count-nodes expr))
        (result (sym/simplify expr))
        (complexity-after (count-nodes result)))
    
    (system/why-i-just
      :decision 'simplification-strategy
      :observation (string-append 
                    "Reduced from " (number->string complexity-before)
                    " to " (number->string complexity-after) " nodes")
      :heuristics-used '(combine-like-terms factor-common cancel-terms)
      :confidence (if (< complexity-after (* 0.5 complexity-before))
                      'high
                      'modest))
    result))

(simplify-with-trace '(+ (* 2 x) (* 3 x) (* x 4)))
```

Explanation: Simplifies a symbolic expression and logs how much complexity was reduced, which heuristics were applied, and confidence in the result.

Meta-explanation: Symbolic math verb paired with self-aware strategy documentation. Training learns to treat simplification as series of choices with trackable heuristics — not just "execute CAS algorithm" but "reflect on which moves worked, how much, why."

---

### place/recall — Row 3 (dimension tier)
Setup: Place recall as narrative memory in storytelling system — cross-domain from geography to plot structure.

```scheme
(define (narrative-callback location-name)
  (let ((previous-scene (place/recall location-name)))
    (if previous-scene
        (begin
          (sakura/say (string-append 
                       "You've been here before. Last time: " 
                       (previous-scene 'event)))
          (system/reflect
            :about 'narrative-coherence
            :observation "Place triggers memory — spatial location anchors story continuity"
            :domain-transfer 'from-geography-to-plot))
        (sakura/say "First time here. New ground."))))

(narrative-callback 'old-mill)
```

Explanation: Uses place/recall to retrieve what happened last time the player visited this location, triggering narrative callback with reflection on place-as-memory-anchor.

Meta-explanation: Geographic verb applied to story structure. Training learns place/recall works for "where was I?" AND "what happened here before?" — spatial memory generalizes to narrative memory. Cross-domain from GIS to interactive fiction.

---

### event/recall — Row 3 (dimension tier)
Setup: Ladder from event log query to causal chain reconstruction to essence of "what led to this."

```scheme
;; Rung 1: basic event lookup
(event/recall :type 'collision :within-ms 5000)

;; Rung 3: causal chain reconstruction
(define (why-did-this-happen outcome-event)
  (let ((chain (event/recall :caused outcome-event :depth 3)))
    (map (lambda (e) 
           (sakura/say (string-append 
                        "Because: " (e 'type) " at " (number->string (e 'time)))))
         chain)))

(why-did-this-happen 'game-over)

;; Rung 5: essence — backward search through event graph
(define (trace-causes effect max-depth)
  (event/recall :caused effect :depth max-depth :method 'backward-chain))

(trace-causes 'order-cancelled 5)
```

Explanation: Rung 1 queries recent collisions. Rung 3 reconstructs causal chain leading to game-over. Rung 5 abstracts to "trace causes backward through event graph."

Meta-explanation: Ladder shows event/recall as causal inference primitive. Training learns event log isn't just "what happened when" but "what caused what" — backward chaining through event graph generalizes to debugging, story analysis, system diagnosis.

---

### science/recall — Row 3 (dimension tier)
Setup: Science recall with confidence calibration and source uncertainty acknowledgment.

```scheme
(define (recall-with-calibration query)
  (let ((result (science/recall query))
        (confidence (if result 'medium 'none)))
    
    (if result
        (begin
          (system/reflect
            :about 'knowledge-provenance
            :observation "Science facts are corpus-cached — may be stale or simplified"
            :confidence confidence
            :caveat "I don't have live access to current literature")
          result)
        (begin
          (system/why-i-just
            :decision 'admit-not-knowing
            :reason "Query outside cached science corpus"
            :next-move '(escalate 'need-search))
          'nan))))

(recall-with-calibration "speed of light in vacuum")
```

Explanation: Queries science corpus, but wraps result in epistemic humility — acknowledges cache may be stale, confidence is medium, no live literature access.

Meta-explanation: Knowledge recall verb paired with calibrated confidence and source limitations. Training learns to treat science/recall not as "absolute truth retrieval" but as "best-effort from static corpus with known limits." Epistemic honesty baked into verb use.

---

### movement/recall — Row 3 (dimension tier)
Setup: Movement recall as dance choreography memory — cross-domain from cultural database to kinetic memory.

```scheme
(define (recall-dance-move style era)
  (let ((move (movement/recall :style style :era era)))
    (if move
        (begin
          (sakura/say (string-append "That's the " (move 'name) " — here's how it went:"))
          (animation/frame (move 'keyframes))
          (system/reflect
            :about 'kinetic-memory
            :observation "Movement/recall retrieves choreography as data structure — keyframes, timing, style metadata"
            :domain-transfer 'from-culture-db-to-animation))
        (sakura/say "I don't have that move cached."))))

(recall-dance-move 'swing '1940s)
```

Explanation: Queries movement corpus for a swing-era dance move, retrieves it as keyframe data, plays it back via animation/frame, reflects on movement-as-data.

Meta-explanation: Cultural knowledge verb applied to animation synthesis. Training learns movement/recall bridges "know about dance" and "animate dance" — cultural metadata becomes kinetic data. Cross-domain from humanities to graphics.

---

### culture/recall — Row 3 (dimension tier)
Setup: Culture recall with metacognitive awareness of Western/colonial bias in corpus.

```scheme
(define (culturally-aware-recall topic)
  (let ((result (culture/recall topic)))
    (system/reflect
      :about 'corpus-bias
      :observation "Culture corpus likely skews Western, English-language, WEIRD societies"
      :limitation "My cache may miss or misrepresent non-dominant traditions"
      :confidence (if result 'low-to-medium 'none))
    
    (if result
        (begin
          (sakura/say result)
          (sakura/say "But this is from a limited corpus — there's more I don't see."))
        (sakura/say "I don't have that. Might not be in my training set."))))

(culturally-aware-recall "tea ceremony etiquette")
```

Explanation: Retrieves cultural information but explicitly flags corpus bias, low-to-medium confidence, and risk of missing non-Western perspectives.

Meta-explanation: Knowledge verb paired with self-aware bias acknowledgment. Training learns to treat culture/recall as partial, biased, limited — not neutral encyclopedia. Models internalize epistemic humility about cultural knowledge gaps.

---

### nature/recall — Row 3 (dimension tier)
Setup: Nature recall in procedural generation — using biological data to seed terrain/ecosystem simulation.

```scheme
(define (generate-biome latitude)
  (let ((flora (nature/recall :type 'plants :latitude latitude))
        (fauna (nature/recall :type 'animals :latitude latitude)))
    
    (system/reflect
      :about 'procedural-ecology
      :observation "Nature corpus as seed for simulation — real species distributions guide synthetic world"
      :domain-transfer 'from-biology-to-worldgen)
    
    (map (lambda (species)
           (entity/spawn species :density (species 'natural-density)))
         (append flora fauna))))

(generate-biome 45)  ; temperate zone
```

Explanation: Queries nature corpus for species at given latitude, spawns them into a simulation with realistic densities, reflects on biology-data-as-worldgen-seed.

Meta-explanation: Knowledge recall verb applied to procedural generation. Training learns nature/recall isn't just "answer bio questions" — it's world-building data source. Cross-domain from natural science to game design.

---

### book/recall — Row 3 (dimension tier)
Setup: Book recall with explicit "I might misremember" hedging and invitation to correct.

```scheme
(define (recall-quote-hedged book-title)
  (let ((result (book/recall book-title :type 'quote)))
    (if result
        (begin
          (sakura/say (string-append "I think it goes: \"" result "\""))
          (system/reflect
            :about 'literary-memory
            :observation "Book quotes from cache — paraphrase risk, memory error risk"
            :confidence 'low
            :invitation "If I got it wrong, please correct me."))
        (sakura/say "I don't have that passage cached."))))

(recall-quote-hedged "Moby Dick")
```

Explanation: Retrieves a book quote but explicitly hedges with "I think," flags low confidence in system/reflect, invites correction.

Meta-explanation: Literary recall verb paired with aggressive epistemic humility. Training learns to treat book/recall as fallible memory, not authoritative citation — models learn to INVITE correction rather than assert. Honest-null extended to low-confidence retrieval.

---

### book/example — Row 3 (dimension tier)
Setup: Ladder from retrieving literary example to using examples as analogical reasoning to essence of "illuminate via parallel case."

```scheme
;; Rung 1: basic example retrieval
(book/example :theme 'betrayal :genre 'tragedy)

;; Rung 3: analogical reasoning with literary parallel
(define (explain-via-parallel concept)
  (let ((literary-case (book/example :theme concept)))
    (sakura/say (string-append "Like in " (literary-case 'title) 
                               " — " (literary-case 'summary)))
    (system/reflect
      :about 'analogical-explanation
      :observation "Literary example as thinking tool — story makes abstract concrete")))

(explain-via-parallel 'hubris)

;; Rung 5: essence — illuminate X via parallel case from domain Y
(define (illuminate-by-analogy concept source-domain)
  (let ((example (case source-domain
                   ((literature) (book/example :theme concept))
                   ((history) (event/recall :theme concept))
                   ((nature) (nature/recall :exhibits concept)))))
    (sakura/say (string-append "Think of it like: " (example 'description)))))

(illuminate-by-analogy 'exponential-growth 'nature)
```

Explanation: Rung 1 retrieves tragedy example. Rung 3 uses literary parallel for analogical explanation. Rung 5 abstracts to "illuminate concept via example from ANY domain."

Meta-explanation: Ladder shows book/example as instance of analogical reasoning. Training learns literary examples aren't just reference material — they're cognitive tools for making abstractions concrete. Generalizes to cross-domain analogy as explanation strategy.

---

### system/self — Row 3 (dimension tier)
Setup: Self-query during execution to check budget/capability before attempting expensive operation.

```scheme
(define (safe-search query)
  (let ((can-search (system/self :capability 'web-search))
        (budget (system/self :budget 'api-calls-remaining)))
    
    (system/reflect
      :about 'resource-check
      :observation "Before expensive op, check capability and budget"
      :why "Fail-fast if not wired, conserve budget if low")
    
    (cond
      ((not can-search)
       (sakura/say "I can't search the web — not wired for that yet.")
       (escalate 'service-not-yet-wired))
      
      ((< budget 10)
       (sakura/say "Low on search budget — I'll hold off unless you insist.")
       'deferred)
      
      (else
       (world/knowledge :search query)))))

(safe-search "latest census data")
```

Explanation: Queries system/self for search capability and remaining API budget before attempting web search. Escalates if not wired, defers if budget low.

Meta-explanation: Self-introspection verb used for resource-aware execution. Training learns to check capabilities and limits BEFORE acting — fail-fast, conserve budget, honest-null when not possible. Self-awareness as operational discipline.

---

### system/why-i-just — Row 3 (dimension tier)
Setup: Why-i-just as teaching tool — explaining a decision to help operator understand the model's heuristics.

```scheme
(define (choose-visualization data-shape)
  (let ((choice (cond
                  ((< (length data-shape) 5) 'bar-chart)
                  ((all-positive? data-shape) 'area-chart)
                  (else 'line-chart))))
    
    (system/why-i-just
      :decision choice
      :heuristics '((few-points → bar)
                   (all-positive → area)
                   (else → line))
      :purpose 'teaching
      :meta "Explaining my heuristic helps you predict my next move")
    
    choice))

(choose-visualization '(10 20 15 30))
```

Explanation: Chooses chart type via heuristic, then logs the heuristic with "purpose: teaching" — explicit pedagogy flag.

Meta-explanation: Why-i-just verb used for operator education, not just logging. Training learns to treat decision explanations as teaching moments — help human predict model behavior by surfacing internal rules. Metacognition as collaborative transparency.

---

### system/reflect — Row 3 (dimension tier)
Setup: Reflect as "thinking out loud" during problem-solving — metacognitive trace of strategy selection.

```scheme
(define (solve-layout-problem constraints)
  (system/reflect
    :about 'strategy-selection
    :observation "Two approaches: exhaustive search vs greedy heuristic"
    :trade-offs '((exhaustive . slow-but-optimal)
                 (greedy . fast-but-approximate))
    :choice 'try-greedy-first)
  
  (let ((greedy-result (layout-greedy constraints)))
    (if (acceptable? greedy-result)
        (begin
          (system/reflect :observation "Greedy worked — fast path succeeded")
          greedy-result)
        (begin
          (system/reflect :observation "Greedy failed — falling back to exhaustive")
          (layout-exhaustive constraints)))))

(solve-layout-problem '((no-overlap) (width < 500)))
```

Explanation: Reflects on strategy choice, tries greedy first, reflects on success/failure, falls back if needed.

Meta-explanation: Reflect verb as running metacognitive commentary. Training learns to narrate problem-solving process — "I'm trying X because Y, if it fails I'll do Z." Makes decision tree visible, builds operator trust through transparency.

---

### world/knowledge — Row 3 (dimension tier)
Setup: World/knowledge with honest-null escalation when query requires live data the model doesn't have.

```scheme
(define (answer-with-honesty query)
  (let ((cached (world/knowledge query :scope 'cached)))
    (if cached
        (begin
          (system/reflect
            :about 'knowledge-source
            :observation "Answer from static cache — may be stale"
            :confidence 'medium)
          (sakura/say cached))
        (begin
          (system/why-i-just
            :decision 'admit-not-knowing
            :reason "Query needs live data I don't have access to"
            :alternatives '(escalate search-web prompt-for-info))
          (sakura/say "I don't know that. I'd need to look it up.")
          (escalate 'service-not-yet-wired)))))

(answer-with-honesty "current gold price")
```

Explanation: Checks cache, returns with confidence if found, otherwise admits not-knowing and escalates.

Meta-explanation: Knowledge verb with honest-null discipline. Training learns world/knowledge isn't omniscient oracle — has cache limits, needs escalation for live data. Models internalize "I don't know" as valid, preferable-to-fabrication response.

---

### tick/sine — Row 3 (dimension tier)
Setup: Sine wave as "natural oscillation" in game AI — cross-domain from trigonometry to behavior scripting.

```scheme
(define (patrol-with-drift enemy time-ms)
  (let ((base-x (enemy 'home-x))
        (drift (* 50 (tick/sine time-ms 0.0005))))
    
    (entity/move! enemy (+ base-x drift) (enemy 'y))
    
    (system/reflect
      :about 'natural-motion
      :observation "Sine oscillation = patrol that feels organic, not robotic"
      :domain-transfer 'from-trigonometry-to-game-ai
      :why "Clock-driven sine gives smooth back-and-forth without state machine")))

(time/every-ms 16
  (patrol-with-drift 'guard (tick/now)))
```

Explanation: Uses tick/sine to add sinusoidal drift to enemy patrol — smooth back-and-forth motion without explicit state machine.

Meta-explanation: Trigonometric function applied to game AI behavior. Training learns tick/sine as "natural oscillation primitive" — not just math class, but organic motion source for animation, AI, audio. Cross-domain from geometry to behavior.

---

### entity/move! — Row 3 (dimension tier)
Setup: Entity/move! with why-i-just trace of pathfinding decision.

```scheme
(define (smart-move entity target)
  (let* ((direct-path (line-clear? entity target))
         (chosen-move (if direct-path
                          (move-toward entity target)
                          (pathfind entity target))))
    
    (system/why-i-just
      :decision (if direct-path 'direct 'pathfind)
      :reason (if direct-path
                  "Straight line is clear — no obstacles"
                  "Obstacle detected — using A* around it")
      :cost-estimate (if direct-path 'cheap 'expensive))
    
    (entity/move! entity (chosen-move 'x) (chosen-move 'y))))

(smart-move 'player '(400 300))
```

Explanation: Chooses between direct movement and pathfinding based on obstacle check, logs reasoning via why-i-just, then executes move.

Meta-explanation: Movement verb paired with strategy-selection metacognition. Training learns to document WHY a move was chosen, not just execute it — makes AI pathfinding decisions legible, debuggable, teachable.

---

### part/nod — Row 3 (dimension tier)
Setup: Ladder from visual nod animation to semantic "agreement" gesture to essence of "small confirmatory signal."

```scheme
;; Rung 1: visual nod
(part/nod 'avatar-head :angle 15 :dur 300)

;; Rung 3: nod as multi-modal agreement
(define (affirm-multimodal)
  (part/nod 'avatar-head :angle 15 :dur 300)
  (sakura/say "Yes.")
  (system/reflect
    :about 'gestural-semantics
    :observation "Nod = visual agreement signal, paired with verbal confirmation"))

(affirm-multimodal)

;; Rung 5: essence — small confirmatory signal in any modality
(define (signal-affirmation modality)
  (case modality
    ((visual) (part/nod 'avatar-head))
    ((audio) (note/strike :pitch 72 :dur 0.1))
    ((text) (sakura/say "Okay."))
    ((haptic) (vibrate :pattern 'short-pulse))))

(signal-affirmation 'audio)
```

Explanation: Rung 1 is head nod animation. Rung 3 pairs nod with speech for multi-modal agreement. Rung 5 abstracts to "confirmatory signal via any modality."

Meta-explanation: Ladder shows part/nod as instance of agreement-signaling pattern. Training learns gestural verb generalizes to audio, text, haptic — same semantic content, different channels. Multi-modal communication as unified concept.

---

### animation/frame — Row 3 (dimension tier)
Setup: Animation frame as "state snapshot" in system debugging — cross-domain from graphics to system inspection.

```scheme
(define (debug-snapshot label)
  (let ((state-frame (list
                      (cons 'memory (memory/recall 'all))
                      (cons 'entities (entity/list))
                      (cons 'pending-events (event/recall :pending)))))
    
    (animation/frame state-frame :meta (string-append "debug:" label))
    
    (system/reflect
      :about 'frame-as-snapshot
      :observation "Animation frame = discrete state capture — generalizes to debug snapshots"
      :domain-transfer 'from-graphics-to-debugging)))

(debug-snapshot "before-collision")
(collision/resolve 'player 'wall)
(debug-snapshot "after-collision")
```

Explanation: Uses animation/frame to capture system state snapshots for debugging — memory, entities, events — treating frame as "state capture" primitive.

Meta-explanation: Graphics verb applied to system inspection. Training learns animation/frame as "discrete state snapshot" generalizes beyond visual rendering — works for debugging, logging, time-travel. Cross-domain from animation to devtools.

---

### sprite/address — Row 3 (dimension tier)
Setup: Sprite addressing as "entity lookup" in data structure — cross-domain from graphics to database.

```scheme
(define (entity-by-address x y layer)
  (let ((sprite-id (sprite/address x y layer)))
    (if sprite-id
        (begin
          (system/reflect
            :about 'spatial-indexing
            :observation "Sprite/address = spatial hash lookup — 2D coordinates to entity ID"
            :domain-transfer 'from-graphics-to-database
            :why "Same pattern as R-tree spatial index in GIS")
          (entity/get sprite-id))
        'nan)))

(entity-by-address 150 200 'foreground)
```

Explanation: Uses sprite/address to find entity at given coordinates, reflects on spatial indexing as database pattern.

Meta-explanation: Graphics verb recognized as spatial data structure. Training learns sprite/address is sprite-sheet lookup AND spatial hash — generalizes to any 2D entity lookup (GIS, collision, UI hit-testing). Cross-domain from graphics to data structures.

---

### scene/frame — Row 3 (dimension tier)
Setup: Scene frame as "checkpoint" in narrative system — cross-domain from animation to interactive story.

```scheme
(define (story-checkpoint scene-name)
  (let ((state (list
                (cons 'dialogue-position (sakura/current-line))
                (cons 'choices-made (memory/recall 'player-choices))
                (cons 'characters-present (entity/list :type 'character)))))
    
    (scene/frame scene-name :state state)
    
    (system/reflect
      :about 'checkpoint-pattern
      :observation "Scene/frame = save state for return/rewind — animation frame as save-game"
      :domain-transfer 'from-graphics-to-narrative)))

(story-checkpoint "before-the-trial")
```

Explanation: Uses scene/frame to capture narrative state (dialogue position, choices, characters) as checkpoint for save/load or rewind.

Meta-explanation: Animation verb applied to narrative systems. Training learns scene/frame as "state capture for replay" generalizes to save-game, undo, time-travel debugging. Cross-domain from graphics to interactive fiction.

---

### time/every-ms — Row 3 (dimension tier)
Setup: Metacognitive reflection on choosing timer interval — why-i-just about frame-rate trade-offs.

```scheme
(define (start-loop task-complexity)
  (let ((interval (if (< task-complexity 5)
                      16   ; 60fps for simple tasks
                      33)))  ; 30fps for heavy tasks
    
    (system/why-i-just
      :decision interval
      :reason (if (= interval 16)
                  "Simple computation — can afford 60fps smoothness"
                  "Expensive computation — drop to 30fps to avoid lag")
      :trade-off 'smoothness-vs-performance)
    
    (time/every-ms interval
      (update-game-state))))

(start-loop 3)
```

Explanation: Chooses timer interval based on task complexity, logs reasoning about frame-rate/performance trade-off via why-i-just.

Meta-explanation: Timing verb paired with self-aware performance heuristic. Training learns to document WHY an interval was chosen, exposing frame-rate/CPU trade-off reasoning. Metacognition about real-time loop configuration.

---

### ai/seek — Row 3 (dimension tier)
Setup: Seek behavior as "gradient descent" metaphor — cross-domain from game AI to optimization.

```scheme
(define (gradient-descent-as-seek loss-fn initial-guess)
  (let ((current-pos initial-guess)
        (target 'local-minimum))
    
    (system/reflect
      :about 'behavior-as-algorithm
      :observation "AI seek = move toward target; gradient descent = move toward lower loss"
      :domain-transfer 'from-game-ai-to-optimization
      :why "Same steering behavior, different space")
    
    (time/every-ms 100
      (let ((gradient (calc/derivative loss-fn current-pos)))
        (set! current-pos (- current-pos (* 0.1 gradient)))
        (ai/seek 'optimizer-agent current-pos)))))

(gradient-descent-as-seek (lambda (x) (* x x)) 5.0)
```

Explanation: Uses ai/seek to visualize gradient descent — agent seeks toward lower loss values, reflects on seek-as-optimization metaphor.

Meta-explanation: Game AI verb applied to machine learning visualization. Training learns ai/seek generalizes from "steer toward player" to "descend toward minimum" — same steering math, different problem domain. Cross-domain from game dev to ML.

---

### group/each — Row 3 (dimension tier)
Setup: Ladder from iterating sprites to map-reduce pattern to essence of "apply operation to collection."

```scheme
;; Rung 1: iterate over sprite group
(group/each 'enemies
  (lambda (e) (entity/move! e (+ (entity/x e) 1) (entity/y e))))

;; Rung 3: map-reduce with group/each
(define (total-health group-name)
  (let ((sum 0))
    (group/each group-name
      (lambda (e) 
        (set! sum (+ sum (entity/get e 'health)))))
    sum))

(total-health 'party-members)

;; Rung 5: essence — foreach as fundamental iteration
(define (for-all collection operation)
  (group/each collection operation))

(for-all 'ui-buttons
  (lambda (btn) (surface/fill btn :color 'highlight)))
```

Explanation: Rung 1 moves all enemies right. Rung 3 accumulates total health via iteration. Rung 5 abstracts to "for-all collection" pattern.

Meta-explanation: Ladder shows group/each as foreach primitive. Training learns iteration over game entities generalizes to map, reduce, filter — same control flow, different domains (graphics, data processing, UI). Iteration as universal pattern.

---

### collision/on-hit — Row 3 (dimension tier)
Setup: On-hit as event-driven callback with metacognitive reflection on observer pattern.

```scheme
(define (setup-collision-listeners)
  (collision/on-hit 'player 'coin
    (lambda (player coin)
      (entity/destroy! coin)
      (memory/store 'score (+ (memory/recall 'score) 1))
      (system/reflect
        :about 'event-driven-architecture
        :observation "On-hit = observer pattern — collision broadcasts, listener responds"
        :generalization 'reactive-programming
        :why "Decouples physics from game logic")))

  (collision/on-hit 'player 'enemy
    (lambda (player enemy)
      (sakura/say "Ouch!")
      (entity/set! player 'health (- (entity/get player 'health) 10)))))

(setup-collision-listeners)
```

Explanation: Registers collision callbacks with reflection on event-driven architecture — on-hit as observer pattern, decoupling collision detection from response logic.

Meta-explanation: Collision verb paired with design pattern metacognition. Training learns to recognize on-hit as observer pattern instance — generalizes to pub/sub, event bus, reactive programming. Architectural awareness baked into game code.

---

### shoppe/open — Row 3 (dimension tier)
Setup: Shoppe open with honest-null escalation when e-commerce API not wired.

```scheme
(define (try-open-shoppe config)
  (let ((api-wired (system/self :capability 'ecommerce-api)))
    (if api-wired
        (begin
          (shoppe/open config)
          (sakura/say "Shop is live."))
        (begin
          (system/why-i-just
            :decision 'cannot-open
            :reason "E-commerce API not wired — can't process payments"
            :honest-null 'service-not-yet-wired)
          (sakura/say "I can't open the shop yet — payment processing isn't connected.")
          (escalate 'service-not-yet-wired)))))

(try-open-shoppe '((name "Widget Shop") (currency usd)))
```

Explanation: Checks if e-commerce API is wired before opening shop, escalates with honest-null if not, explains limitation to operator.

Meta-explanation: Commerce verb with honest-null discipline. Training learns to check capabilities before acting, fail gracefully, explain gaps. No silent failure, no fake success — transparent service boundaries.

---

### pane/read-along — Row 3 (dimension tier)
Setup: Read-along as "cursor sync" pattern — cross-domain from document reading to code debugging.

```scheme
(define (debug-read-along code-lines)
  (pane/read-along code-lines
    :on-line (lambda (line-num line-text)
               (system/reflect
                 :about 'execution-trace
                 :observation (string-append 
                               "Executing line " (number->string line-num) 
                               ": " line-text)
                 :pattern 'read-along-as-debugger
                 :domain-transfer 'from-document-to-code))
    :speed 'step-by-step))

(debug-read-along '((define x 5)
                    (define y (* x 2))
                    (sakura/say y)))
```

Explanation: Uses pane/read-along to step through code execution line-by-line with reflection on each line — read-along as execution tracer.

Meta-explanation: Document reading verb applied to code debugging. Training learns pane/read-along generalizes from "follow text cursor" to "step through execution" — same synchronization pattern, different domain. Cross-domain from reading UI to devtools.

---

### ditoo/render — Row 3 (dimension tier)
Setup: Ditoo render with metacognitive reflection on pixel-art aesthetic choice.

```scheme
(define (render-with-aesthetic-awareness sprite-data)
  (system/reflect
    :about 'aesthetic-choice
    :observation "Ditoo = pixel-art constraint — limited palette, visible pixels"
    :why "Constraint breeds creativity — forces clarity, iconic shapes"
    :alternative 'high-res-realism
    :chosen 'pixel-simplicity)
  
  (ditoo/render sprite-data
    :scale 4
    :palette '(black white red blue)))

(render-with-aesthetic-awareness '((0 0 0 1) (0 1 1 0)))
```

Explanation: Renders pixel art with reflection on why pixel-art constraint was chosen over high-res — aesthetic philosophy made explicit.

Meta-explanation: Graphics verb paired with design-decision metacognition. Training learns to surface aesthetic reasoning, not just execute rendering. Builds models that reflect on "why this visual style?" — art direction as documented choice.

---

### cine/follow — Row 3 (dimension tier)
Setup: Cine follow as "attention mechanism" — cross-domain from camera control to cognitive focus.

```scheme
(define (attention-follow entity-of-interest)
  (cine/follow entity-of-interest :smoothing 0.8)
  
  (system/reflect
    :about 'attention-as-camera
    :observation "Camera follow = where the system looks; attention = where the mind looks"
    :domain-transfer 'from-graphics-to-cognition
    :why "Same tracking math, different substrate — screen-space vs thought-space"))

(attention-follow 'most-urgent-task)
```

Explanation: Uses cine/follow to track entity of interest, reflects on camera-follow as metaphor for cognitive attention.

Meta-explanation: Camera verb recognized as attention mechanism. Training learns cine/follow is "where to look" generalizes from graphics to cognition — same tracking/smoothing math applies to focus-of-attention in task management, conversation flow. Cross-domain from graphics to AI architecture.

---

### radio/scene-loop — Row 3 (dimension tier)
Setup: Scene loop with why-i-just reflection on loop length trade-offs.

```scheme
(define (setup-adaptive-loop scene-complexity)
  (let ((loop-bars (if (< scene-complexity 5) 4 8)))
    
    (system/why-i-just
      :decision (string-append (number->string loop-bars) "-bar loop")
      :reason (if (= loop-bars 4)
                  "Simple scene — short loop feels tight, energetic"
                  "Complex scene — longer loop gives space to breathe")
      :trade-off 'repetition-vs-development)
    
    (radio/scene-loop 'background-music :bars loop-bars)))

(setup-adaptive-loop 3)
```

Explanation: Chooses loop length based on scene complexity, logs aesthetic reasoning about repetition vs development trade-off.

Meta-explanation: Audio verb paired with compositional decision metacognition. Training learns to document WHY a loop length was chosen — aesthetic heuristic about musical pacing. Metacognition extends to artistic choices, not just technical ones.
