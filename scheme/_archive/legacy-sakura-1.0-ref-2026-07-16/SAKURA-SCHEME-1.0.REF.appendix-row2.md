# Sakura Corpus — Reference Row 2 (Audit Tier)

## Verb Examples with Generation Structure

### motion/hop — Row 2 (audit tier)

Problem: A bird character should jump from branch to branch in a tree, landing precisely on each target position rather than sliding smoothly. The jumps should feel instant but still visible, and the bird should face the direction it's jumping.

```scheme
(define (bird-foraging tree-branches)
  (let ((bird (entity/make :sprite 'sparrow :x 100 :y 200)))
    (for-each
      (lambda (branch)
        (let ((dx (- (car branch) (entity/x bird)))
              (dy (- (cdr branch) (entity/y bird))))
          (entity/turn! bird (calc/atan dy dx))
          (motion/hop bird :to-x (car branch) :to-y (cdr branch))
          (time/wait-ms 800)))
      tree-branches)))

(bird-foraging '((150 . 180) (200 . 160) (180 . 140) (220 . 130)))
```

Explanation: The program creates a bird entity, then for each branch position it calculates the angle from current position to target, rotates the bird to face that direction, executes an instant hop to the branch coordinates, and waits before the next hop.

Meta-explanation: `motion/hop` separates discrete positional change from continuous motion — essential when animation physics suggests teleportation or when frame budget prohibits interpolation. Composing with `entity/turn!` before the hop captures intent (face-then-jump) that `motion/slide` would blur. Row 1 NIE teaches the verb exists; this teaches *when* discrete beats continuous.

---

### motion/curve — Row 2 (audit tier)

Problem: A paper airplane should arc through the air following a parabolic path from a child's hand to the ground across the playground, slowing at the apex and accelerating downward, rather than moving in a straight line.

```scheme
(define (throw-paper-airplane start-x start-y target-x target-y)
  (let ((plane (entity/make :sprite 'paper-plane :x start-x :y start-y)))
    (let* ((midpoint-x (/ (+ start-x target-x) 2))
           (arc-height (- start-y 80))
           (control-points (list (cons start-x start-y)
                                (cons midpoint-x arc-height)
                                (cons target-x target-y))))
      (motion/curve plane 
                   :path control-points 
                   :duration-ms 2000
                   :ease 'quad-in-out)
      (entity/turn! plane (calc/atan 
                           (- target-y start-y)
                           (- target-x start-x))))))

(throw-paper-airplane 50 100 300 180)
```

Explanation: The program creates a plane entity, calculates a three-point Bézier path (start, high midpoint, landing), applies curved motion along that path over two seconds with easing, then tilts the plane toward the landing angle.

Meta-explanation: `motion/curve` handles paths where velocity direction changes continuously — trajectories, arcs, swoops. The control-points list defines shape; duration and easing define tempo. Contrast with `motion/hop` (instant) and `motion/slide` (linear): this verb owns the space where *how you get there* carries meaning. Row 1 shows syntax; this shows why you reach for curves instead of waypoint chains.

---

### note/strike — Row 2 (audit tier)

Problem: When a blacksmith hammers an anvil in rhythm, each strike should produce a metallic clang at a different pitch depending on where the hammer hits, creating a percussive melody synchronized with the animation frames.

```scheme
(define (hammer-rhythm anvil-sprite hammer-sprite)
  (let ((strike-points '(55 58 62 65 67)))  ; MIDI note numbers
    (animation/play hammer-sprite 'swing)
    (for-each
      (lambda (pitch)
        (time/on-frame 8
          (lambda ()
            (note/strike :pitch pitch 
                        :velocity 110 
                        :duration-ms 150
                        :timbre 'metallic)
            (part/flash anvil-sprite :duration-ms 100))))
      strike-points)
    (time/wait-ms 2000)))

(let ((anvil (sprite/address 'anvil))
      (hammer (sprite/address 'hammer)))
  (hammer-rhythm anvil hammer))
```

Explanation: The program retrieves anvil and hammer sprites, defines a sequence of MIDI pitches, starts the hammer swing animation, then for each pitch waits until animation frame 8 and triggers both a pitched metallic note and a brief flash on the anvil.

Meta-explanation: `note/strike` separates *what note* (pitch, velocity, timbre) from *when* (handled by `time/on-frame`). Composing the two lets rhythm follow visual action frame-exactly. The `:duration-ms` parameter shapes the note's decay, independent of when the next strike occurs. Row 1 teaches parameters; this teaches synchronizing audio events to animation state, where timing emerges from composition rather than hardcoded delays.

---

### form/triangle — Row 2 (audit tier)

Problem: A sailing app needs to calculate whether a boat has reached a racing buoy by checking if the boat's position falls inside the triangular zone defined by three marker buoys, returning true when inside the zone.

```scheme
(define (boat-in-zone? boat-x boat-y buoy-a buoy-b buoy-c)
  (let ((zone-triangle (form/triangle 
                         :a buoy-a 
                         :b buoy-b 
                         :c buoy-c)))
    (form/contains? zone-triangle (cons boat-x boat-y))))

(define (check-race-progress boat markers)
  (let ((boat-pos (cons (entity/x boat) (entity/y boat)))
        (zone-a (list-ref markers 0))
        (zone-b (list-ref markers 1))
        (zone-c (list-ref markers 2)))
    (when (boat-in-zone? (car boat-pos) 
                         (cdr boat-pos)
                         zone-a 
                         zone-b 
                         zone-c)
      (sakura/say "Mark reached!")
      (entity/flash boat :color 'green :duration-ms 500))))

(check-race-progress 
  (sprite/address 'sailboat)
  '((100 . 50) (200 . 80) (150 . 150)))
```

Explanation: The `boat-in-zone?` function constructs a triangle from three buoy coordinates and tests if the boat position is inside using `form/contains?`. The `check-race-progress` function extracts boat position and marker coordinates, calls the zone test, and flashes the boat green with a message when inside.

Meta-explanation: `form/triangle` creates a testable geometric primitive from three points. Composing with `form/contains?` turns spatial relationships into boolean logic — "is this point in this region?" The triangle serves as a *query structure*, not just a drawing command. Row 1 shows construction; this shows triangles as collision zones, geofences, or decision boundaries where shape becomes predicate.

---

### form/decompose-into-triangles — Row 2 (audit tier)

Problem: A quilting pattern generator needs to calculate fabric area for an irregular polygon room layout, but area formulas only work reliably on triangles. Decompose the polygon, sum triangle areas, and report total square footage needed.

```scheme
(define (quilt-fabric-needed room-corners)
  (let* ((room-polygon (form/polygon :vertices room-corners))
         (triangles (form/decompose-into-triangles room-polygon))
         (areas (map form/area triangles))
         (total-area (apply + areas))
         (fabric-sq-ft (* total-area 1.15)))  ; 15% waste margin
    (sakura/say (string-append "Fabric needed: " 
                              (number->string (num/round fabric-sq-ft 1))
                              " sq ft"))
    fabric-sq-ft))

(quilt-fabric-needed 
  '((0 . 0) (100 . 20) (120 . 80) (60 . 100) (10 . 70)))
```

Explanation: The program constructs a polygon from corner coordinates, decomposes it into a list of triangles, maps `form/area` over that list to get individual triangle areas, sums them, applies a waste margin multiplier, and reports the fabric requirement.

Meta-explanation: `form/decompose-into-triangles` bridges arbitrary polygons to triangle-only algorithms (area, centroid, moment-of-inertia). The decomposition is a *transformation into a solvable space* — complex shape becomes list of simple shapes. Composing with `map` and `apply +` turns geometric decomposition into aggregate calculation. Row 1 shows the verb exists; this shows using it as a preprocessing step before applying triangle-specific operations.

---

### surface/fill — Row 2 (audit tier)

Problem: A forest fire simulation needs to spread fire from an initial spark through contiguous dry grass regions on a terrain grid, stopping at water or rock boundaries. Color all burned cells red.

```scheme
(define (spread-fire grid start-x start-y)
  (let ((terrain-surface (surface/from-grid grid))
        (flammable? (lambda (cell-type) 
                     (or (eq? cell-type 'grass)
                         (eq? cell-type 'brush)))))
    (surface/fill terrain-surface
                 :start (cons start-x start-y)
                 :predicate flammable?
                 :new-value 'burned)
    (for-each
      (lambda (row)
        (for-each
          (lambda (cell)
            (when (eq? cell 'burned)
              (surface/draw-cell cell :color 'red)))
          row))
      (surface/to-grid terrain-surface))
    terrain-surface))

(let ((forest-grid '((grass grass water grass)
                    (grass grass grass rock)
                    (brush grass grass grass)
                    (grass grass rock grass))))
  (spread-fire forest-grid 0 0))
```

Explanation: The program converts a grid of terrain types into a surface, defines a predicate that returns true for flammable cell types, performs a flood-fill starting from coordinates (0,0) that replaces matching cells with 'burned, then iterates over the resulting grid to draw burned cells in red.

Meta-explanation: `surface/fill` implements flood-fill with a *predicate-based boundary* rather than color-matching — generalized to any property test. The `:predicate` parameter makes it work on semantic grids (terrain types, room connections) not just pixel buffers. Row 1 shows bucket-fill on a drawing; this shows fill as spatial query propagation where "same" means "predicate returns true," unlocking uses in pathfinding, region labeling, and cellular automata.

---

### sakura/say — Row 2 (audit tier)

Problem: A language-learning app shows a character describing a market scene, but the description should build incrementally — first the setting, then the people, then the action — with pauses between parts so the learner can absorb each phrase before the next appears.

```scheme
(define (describe-market-scene)
  (sakura/say "The market sprawls under bright awnings.")
  (time/wait-ms 2000)
  (sakura/say "Vendors call out prices; a child tugs her father's sleeve.")
  (time/wait-ms 2200)
  (sakura/say "She points at a wooden toy spinning on a string."))

(define (narrate-with-pacing utterances pause-ms)
  (for-each
    (lambda (utterance)
      (sakura/say utterance)
      (time/wait-ms pause-ms))
    utterances))

(narrate-with-pacing
  '("The market sprawls under bright awnings."
    "Vendors call out prices; a child tugs her father's sleeve."
    "She points at a wooden toy spinning on a string.")
  2000)
```

Explanation: The first function calls `sakura/say` three times with fixed waits between them. The second function abstracts this pattern: it takes a list of utterances and a pause duration, then iterates through the list, saying each utterance and waiting.

Meta-explanation: `sakura/say` emits text to the operator but doesn't block — composition with `time/wait-ms` creates *pacing*. The abstraction into `narrate-with-pacing` shows the pattern: separate *what to say* (data) from *rhythm* (parameter). Row 1 shows outputting one string; this shows sequencing multiple utterances as a list with timing, turning monologue into a time-distributed narrative where pauses carry meaning.

---

### memory/recall — Row 2 (audit tier)

Problem: A recipe assistant should remember the last three dishes the cook made this week and suggest a fourth that uses similar ingredients but a different cuisine, avoiding repetition while maintaining ingredient continuity.

```scheme
(define (suggest-next-dish)
  (let* ((recent-dishes (memory/recall :query 'dishes-this-week :limit 3))
         (all-ingredients (apply append 
                               (map (lambda (dish) (cdr (assoc 'ingredients dish)))
                                    recent-dishes)))
         (common-ingredients (list/mode all-ingredients))
         (cuisines-used (map (lambda (dish) (cdr (assoc 'cuisine dish)))
                           recent-dishes))
         (new-cuisine (world/knowledge 
                       :query (string-append 
                              "cuisine using " 
                              (car common-ingredients)
                              " not in "
                              (list->string cuisines-used)))))
    (sakura/say (string-append 
                "You've used " 
                (car common-ingredients)
                " three times. Try " 
                new-cuisine 
                " cuisine next."))
    new-cuisine))

(suggest-next-dish)
```

Explanation: The program recalls the last three dishes from memory, extracts all ingredients from those dishes and flattens them into one list, finds the most common ingredient using mode, extracts the cuisines already used, queries world knowledge for a cuisine that uses the common ingredient but isn't in the used-cuisine list, and suggests it.

Meta-explanation: `memory/recall` with `:limit` retrieves a bounded history window — recent context without full scan. Composing recalled data with `map`, `apply append`, and `list/mode` turns episodic memory into aggregate statistics. The pattern is *retrieve → analyze → decide* where memory provides raw material for inference rather than direct answers. Row 1 shows recalling one fact; this shows mining a sequence of memories for patterns to inform the next action.

---

### cortex/recall — Row 2 (audit tier)

Problem: During a tutoring session, the student asks "Wait, what was that formula you mentioned earlier?" The system should retrieve the most recent mathematical formula spoken in the conversation, re-present it, and offer to explain it again.

```scheme
(define (retrieve-recent-formula)
  (let ((recent-context (cortex/recall :window 10 :type 'exchange)))
    (let ((formula-utterances 
           (filter 
             (lambda (exchange)
               (string-contains? (cdr (assoc 'content exchange)) "="))
             recent-context)))
      (if (null? formula-utterances)
          (sakura/say "I haven't mentioned a formula recently.")
          (let ((last-formula (car formula-utterances)))
            (sakura/say (string-append 
                        "You mean: " 
                        (cdr (assoc 'content last-formula))
                        "?"))
            (sakura/say "Should I walk through it again?")
            last-formula)))))

(retrieve-recent-formula)
```

Explanation: The program recalls the last 10 conversational exchanges from cortex, filters them to find only those containing "=" (a heuristic for formulas), checks if any were found, and either says none exist or presents the most recent one with an offer to re-explain.

Meta-explanation: `cortex/recall` retrieves *this conversation's* short-term context, distinct from `memory/recall` (long-term cross-session facts). The `:window` parameter bounds the search to recent turns. Filtering on content properties (string-contains) lets you query by *shape* rather than explicit tags. Row 1 shows pulling one exchange; this shows scanning recent context with a predicate to answer meta-conversational questions like "what did we just talk about?"

---

### calc/derivative — Row 2 (audit tier)

Problem: A physics simulation needs to show not just a ball's position along a curved ramp, but also its instantaneous velocity (rate of position change) and acceleration (rate of velocity change) at each moment, displayed as vectors.

```scheme
(define (ramp-motion-analysis t)
  (let* ((position-fn (lambda (time) 
                       (+ (* 2 time time) (* 3 time) 1)))
         (velocity-fn (calc/derivative position-fn))
         (acceleration-fn (calc/derivative velocity-fn))
         (pos (position-fn t))
         (vel (velocity-fn t))
         (acc (acceleration-fn t)))
    (sakura/say (string-append 
                "At t=" (number->string t)
                ": pos=" (number->string (num/round pos 2))
                " vel=" (number->string (num/round vel 2))
                " acc=" (number->string (num/round acc 2))))
    (list pos vel acc)))

(define (animate-ramp-with-vectors duration-ms step-ms)
  (let ((steps (/ duration-ms step-ms)))
    (for-each
      (lambda (i)
        (let* ((t (* i (/ step-ms 1000.0)))
               (motion (ramp-motion-analysis t))
               (pos (car motion))
               (vel (cadr motion))
               (acc (caddr motion)))
          (entity/move! 'ball :x pos :y 100)
          (surface/draw-vector :origin (cons pos 100) 
                              :magnitude vel 
                              :color 'blue)
          (surface/draw-vector :origin (cons pos 120) 
                              :magnitude acc 
                              :color 'red)
          (time/wait-ms step-ms)))
      (list/range 0 steps))))

(animate-ramp-with-vectors 3000 100)
```

Explanation: The `ramp-motion-analysis` function defines position as a quadratic function of time, derives velocity by taking the derivative of position, derives acceleration by taking the derivative of velocity, evaluates all three at time `t`, and reports them. The animation function steps through time, calls the analysis at each step, moves the ball to the position, and draws velocity and acceleration as vectors.

Meta-explanation: `calc/derivative` operates on *functions* not numbers — it returns a new function representing rate-of-change. Taking the derivative twice (velocity → acceleration) shows composition. This transforms a position formula into a full kinematic description. Row 1 shows differentiating a polynomial; this shows chaining derivatives to get higher-order rates and using them in real-time simulation where derived quantities drive visualization.

---

### num/root — Row 2 (audit tier)

Problem: A gardener wants to arrange seedlings in a square plot but only has 47 seedlings. Calculate how large a square can be filled completely, how many seedlings that uses, and how many are left over for a partial row.

```scheme
(define (square-plot-layout seedling-count)
  (let* ((side-length (num/root seedling-count 2))
         (complete-square (num/floor side-length))
         (seedlings-used (* complete-square complete-square))
         (leftover (- seedling-count seedlings-used)))
    (sakura/say (string-append 
                "You can make a " 
                (number->string complete-square)
                "×" 
                (number->string complete-square)
                " square using " 
                (number->string seedlings-used)
                " seedlings."))
    (sakura/say (string-append 
                (number->string leftover)
                " seedlings left for a partial row."))
    (list complete-square leftover)))

(square-plot-layout 47)
```

Explanation: The program calculates the square root of the seedling count, floors it to get the largest integer side length, squares that to find how many seedlings fit in the complete square, subtracts from total to find leftover, and reports both the square dimensions and remainder.

Meta-explanation: `num/root` with exponent 2 computes square root; with exponent 3 it's cube root — unified interface. Composing with `num/floor` bridges continuous math (root can be irrational) to discrete constraints (can't plant fractional seedlings). The pattern is *solve in continuous space → discretize → measure remainder*. Row 1 shows computing a root; this shows using it in discrete allocation problems where you need both the theoretical answer and the practical constraint.

---

### opt/minimize — Row 2 (audit tier)

Problem: A delivery drone needs to visit five customer locations and return to base using the least total flight distance. The route order matters — find the permutation of stops that minimizes total distance traveled.

```scheme
(define (total-distance route base)
  (let ((points (cons base (append route (list base)))))
    (apply + 
      (map (lambda (i)
             (let ((p1 (list-ref points i))
                   (p2 (list-ref points (+ i 1))))
               (calc/distance p1 p2)))
           (list/range 0 (- (length points) 1))))))

(define (optimize-delivery-route customers base-location)
  (let* ((route-distance (lambda (route) 
                          (total-distance route base-location)))
         (best-route (opt/minimize route-distance
                                  :domain (list/permutations customers)
                                  :method 'exhaustive)))
    (sakura/say (string-append 
                "Optimal route distance: "
                (number->string 
                  (num/round (route-distance best-route) 1))
                " meters"))
    best-route))

(optimize-delivery-route 
  '((100 . 50) (200 . 80) (150 . 200) (50 . 150) (180 . 120))
  '(0 . 0))
```

Explanation: The `total-distance` function takes a route and base, constructs a full path (base → stops → base), calculates distances between consecutive points, and sums them. The optimization function defines a cost function (route-distance), uses `opt/minimize` to search all permutations of customer locations for the one with lowest cost, and reports the optimal distance.

Meta-explanation: `opt/minimize` takes a *cost function* and a *search domain* — it doesn't know what "distance" or "route" means, only that lower cost is better. The `:domain` parameter can be a list (search these candidates), a range (search this interval), or a constraint set. Composing with `list/permutations` frames the problem; the optimizer solves it. Row 1 shows minimizing a math function; this shows minimizing over a combinatorial space where domain generation and cost function are programmer-defined.

---

### vec/dot — Row 2 (audit tier)

Problem: A solar panel positioning system needs to calculate how much sunlight hits the panel by measuring the alignment between the sun's direction vector and the panel's surface normal vector. Maximum power occurs when vectors are parallel (dot product = 1); no power when perpendicular (dot product = 0).

```scheme
(define (solar-efficiency sun-direction panel-normal)
  (let* ((sun-unit (vec/normalize sun-direction))
         (panel-unit (vec/normalize panel-normal))
         (alignment (vec/dot sun-unit panel-unit))
         (efficiency (num/max 0 alignment)))  ; clamp to [0,1]
    efficiency))

(define (track-sun panel-id sun-position panel-position panel-orientation)
  (let* ((sun-vector (vec/subtract sun-position panel-position))
         (current-efficiency (solar-efficiency sun-vector panel-orientation))
         (rotated-normal (vec/rotate panel-orientation (/ 3.14159 12)))
         (new-efficiency (solar-efficiency sun-vector rotated-normal)))
    (sakura/say (string-append 
                "Current: " 
                (number->string (num/round (* current-efficiency 100) 0))
                "% efficiency"))
    (when (> new-efficiency current-efficiency)
      (sakura/say "Rotating 15° would improve efficiency.")
      (entity/rotate! panel-id (/ 3.14159 12)))))

(track-sun 'panel-1 
          '(1000 . 800) 
          '(0 . 0) 
          '(0.707 . 0.707))
```

Explanation: The `solar-efficiency` function normalizes both vectors to unit length, computes their dot product (cosine of angle between them), and clamps negative values to zero. The tracking function computes the vector from panel to sun, calculates current efficiency, simulates rotating the panel normal 15 degrees, calculates new efficiency, and suggests rotation if it would improve output.

Meta-explanation: `vec/dot` measures *alignment* — how much one vector points in the direction of another. The result ranges from -1 (opposite) to +1 (same direction), with 0 meaning perpendicular. Normalizing before dot product gives pure angular relationship independent of magnitude. This pattern (compute dot, threshold, decide) appears in lighting, collision detection, and visibility tests. Row 1 shows computing the product; this shows using it as an *alignment sensor* that drives physical control decisions.

---

### matrix/transpose — Row 2 (audit tier)

Problem: A spreadsheet app stores data in row-major format (each row is a record), but the user wants to pivot the view to analyze by column (each column becomes a record). Transform the data structure without copying individual cells manually.

```scheme
(define (pivot-table data)
  (let* ((original-matrix (list->matrix data))
         (transposed-matrix (matrix/transpose original-matrix))
         (pivoted-data (matrix->list transposed-matrix)))
    pivoted-data))

(define (analyze-by-column spreadsheet)
  (let ((pivoted (pivot-table spreadsheet)))
    (sakura/say "Analyzing by column:")
    (for-each
      (lambda (col-index)
        (let ((column (list-ref pivoted col-index)))
          (sakura/say (string-append 
                      "Column " 
                      (number->string col-index)
                      " sum: "
                      (number->string (apply + column))))))
      (list/range 0 (length pivoted)))))

(analyze-by-column '((10 20 30)
                    (15 25 35)
                    (12 22 32)
                    (18 28 38)))
```

Explanation: The pivot-table function converts a list-of-lists into a matrix, transposes it (swapping rows and columns), and converts back to list-of-lists. The analysis function pivots the data, then iterates over each column (which was originally a row position across all records), summing the values in that column.

Meta-explanation: `matrix/transpose` rotates data 90 degrees — rows become columns, columns become rows. This isn't just a geometric operation; it's a *perspective shift* on tabular data. Composing with list conversion bridges matrices (math objects) to lists (data structures). Row 1 shows transposing a numeric matrix; this shows using transpose as a data-reshaping tool where the same numbers answer different questions depending on orientation.

---

### sym/simplify — Row 2 (audit tier)

Problem: A physics student enters a force equation with lots of redundant terms and parentheses. The system should simplify it algebraically and show both the original and reduced forms so the student can see what canceled out.

```scheme
(define (simplify-and-explain expression)
  (let ((simplified (sym/simplify expression)))
    (sakura/say (string-append "Original: " (sym/->string expression)))
    (sakura/say (string-append "Simplified: " (sym/->string simplified)))
    (unless (equal? expression simplified)
      (sakura/say (string-append 
                  "Removed: "
                  (number->string 
                    (- (sym/term-count expression)
                       (sym/term-count simplified)))
                  " redundant terms")))
    simplified))

(define (check-student-equation student-input expected-form)
  (let ((student-simplified (sym/simplify student-input))
        (expected-simplified (sym/simplify expected-form)))
    (if (sym/equivalent? student-simplified expected-simplified)
        (sakura/say "Correct! Your equation simplifies to the same form.")
        (sakura/say (string-append 
                    "Not quite. Your simplified form: "
                    (sym/->string student-simplified)
                    " but expected: "
                    (sym/->string expected-simplified))))))

(simplify-and-explain '(+ (* 2 x) (* 3 x) (- (* 5 x) (* 4 x))))
(check-student-equation 
  '(+ (* m a) (* 0 v) (/ F 1))
  '(+ F (* m a)))
```

Explanation: The first function simplifies a symbolic expression, shows both forms, and counts how many terms were eliminated. The second function simplifies both student input and expected answer, then checks if they're algebraically equivalent even if differently written.

Meta-explanation: `sym/simplify` performs algebraic reduction — combining like terms, eliminating identities (x+0, x*1), canceling. It operates on *expression trees* not strings. Composing with `sym/equivalent?` lets you check mathematical equality independent of form. The pattern is *normalize → compare* where simplification is the normalization. Row 1 shows simplifying one expression; this shows using simplification as a *canonicalization* step for equation checking where many surface forms map to one essential form.

---

### place/recall — Row 2 (audit tier)

Problem: A travel planner needs to suggest a lunch spot within walking distance of a museum the tourist just visited. Recall the museum location, search for restaurants within 500 meters, and rank by rating.

```scheme
(define (suggest-nearby-lunch museum-name)
  (let* ((museum-location (place/recall :name museum-name :attribute 'coordinates))
         (nearby-restaurants (place/recall :near museum-location 
                                          :radius-m 500
                                          :category 'restaurant))
         (sorted-by-rating (list/sort nearby-restaurants
                                    (lambda (a b)
                                      (> (cdr (assoc 'rating a))
                                         (cdr (assoc 'rating b))))))
         (top-pick (car sorted-by-rating)))
    (sakura/say (string-append 
                "Nearby: " 
                (cdr (assoc 'name top-pick))
                " (" 
                (number->string (cdr (assoc 'rating top-pick)))
                " stars, "
                (number->string 
                  (calc/distance museum-location 
                               (cdr (assoc 'coordinates top-pick))))
                "m away)"))))

(suggest-nearby-lunch "National Gallery")
```

Explanation: The program recalls the museum's coordinates by name, recalls all restaurants within 500m of those coordinates, sorts the list by rating in descending order, selects the top result, and reports its name, rating, and distance.

Meta-explanation: `place/recall` supports multiple query modes — by name, by proximity, by category. The `:near` parameter turns it into a spatial search anchored on a location. Composing with `list/sort` on retrieved attributes (rating) turns spatial query into ranked recommendation. The pattern is *locate anchor → search radius → rank results* where each step composes cleanly. Row 1 shows recalling one place; this shows chaining place queries (name → coordinates) and spatial searches (near → filter → rank).

---

### event/recall — Row 2 (audit tier)

Problem: A conference app should show "What's happening next?" by finding the soonest upcoming event after the current time, but only events in the room the attendee is currently in.

```scheme
(define (next-event-in-room current-time current-room)
  (let* ((upcoming (event/recall :after current-time :limit 10))
         (in-this-room (filter 
                        (lambda (evt) 
                          (equal? (cdr (assoc 'room evt)) current-room))
                        upcoming))
         (sorted (list/sort in-this-room
                          (lambda (a b)
                            (< (cdr (assoc 'start-time a))
                               (cdr (assoc 'start-time b))))))
         (next (if (null? sorted) '() (car sorted))))
    (if (null? next)
        (sakura/say "No more events in this room today.")
        (sakura/say (string-append 
                    "Next: " 
                    (cdr (assoc 'title next))
                    " at "
                    (time/format (cdr (assoc 'start-time next)) 'short))))))

(next-event-in-room (time/now) "Grand Ballroom")
```

Explanation: The program recalls up to 10 events starting after the current time, filters to only those in the specified room, sorts by start time, selects the first (soonest), and either reports it or says none remain.

Meta-explanation: `event/recall` with `:after` retrieves future events; `:before` retrieves past. The `:limit` parameter bounds the search window. Filtering and sorting on recalled attributes (room, start-time) refines the query result. This pattern (broad query → filter → sort → select) lets you express complex time-and-space constraints by composition rather than a single mega-query. Row 1 shows recalling one event; this shows narrowing a time-bounded event stream through attribute filters to answer contextual "what's next" questions.

---

### science/recall — Row 2 (audit tier)

Problem: A chemistry tutor is explaining reaction rates and needs to retrieve the Arrhenius equation, then substitute specific values (activation energy, temperature, rate constant) to calculate reaction rate for a concrete example.

```scheme
(define (calculate-reaction-rate activation-energy-kj temp-kelvin)
  (let* ((arrhenius (science/recall :topic 'arrhenius-equation))
         (gas-constant 8.314)  ; J/(mol·K)
         (ea-joules (* activation-energy-kj 1000))
         (rate-constant (cdr (assoc 'A arrhenius)))
         (rate (* rate-constant 
                 (calc/exp (/ (- ea-joules) 
                            (* gas-constant temp-kelvin))))))
    (sakura/say (string-append "Arrhenius equation: " 
                              (cdr (assoc 'formula arrhenius))))
    (sakura/say (string-append 
                "At " 
                (number->string temp-kelvin) 
                "K with Ea=" 
                (number->string activation-energy-kj)
                "kJ/mol:"))
    (sakura/say (string-append 
                "Reaction rate ≈ " 
                (number->string (num/round rate 4))
                " /s"))
    rate))

(calculate-reaction-rate 75 350)
```

Explanation: The program recalls the Arrhenius equation record from the science knowledge base, extracts the pre-exponential factor A, converts activation energy to joules, applies the Arrhenius formula, and reports both the equation and the calculated rate for the given temperature and activation energy.

Meta-explanation: `science/recall` retrieves scientific formulas, constants, or principles as structured data (not just text). The `:topic` parameter queries by subject. Composing retrieved formula structure with `calc/exp` and arithmetic turns *knowledge retrieval* into *computational application*. Row 1 shows looking up a fact; this shows retrieving a formula schema, substituting parameters, and evaluating it — bridging symbolic knowledge to numeric calculation.

---

### movement/recall — Row 2 (audit tier)

Problem: A dance instruction app needs to demonstrate a specific step from a named choreography. Recall the movement sequence, extract the third step, and animate the avatar performing it.

```scheme
(define (demonstrate-step choreography-name step-number)
  (let* ((choreography (movement/recall :name choreography-name))
         (steps (cdr (assoc 'steps choreography)))
         (target-step (list-ref steps (- step-number 1)))
         (motion-data (cdr (assoc 'motion target-step)))
         (duration-ms (cdr (assoc 'duration motion-data))))
    (sakura/say (string-append 
                "Step " 
                (number->string step-number)
                ": " 
                (cdr (assoc 'name target-step))))
    (animation/play 'avatar motion-data)
    (time/wait-ms duration-ms)
    (sakura/say "Try that!")))

(demonstrate-step "Waltz Basic" 3)
```

Explanation: The program recalls a choreography by name, extracts its step list, retrieves the step at the requested position (adjusted for zero-indexing), pulls out its motion data, plays the animation on an avatar entity, waits for the duration, and prompts the user to try.

Meta-explanation: `movement/recall` retrieves *procedural knowledge* — sequences of motions rather than static facts. The returned structure contains both metadata (name, duration) and actionable data (motion). Composing with `animation/play` bridges knowledge retrieval to rendering. Row 1 shows recalling a movement; this shows indexing into a sequence, extracting a subsequence, and executing it — turning a knowledge base into an instruction generator.

---

### culture/recall — Row 2 (audit tier)

Problem: A museum exhibit about tea ceremonies needs to display the Japanese term for the tea whisk, its traditional material, and the formal gesture used when presenting it. Retrieve and format this cultural knowledge.

```scheme
(define (display-tea-tool-info tool-name)
  (let* ((tool-record (culture/recall :artifact tool-name :tradition 'japanese-tea))
         (japanese-name (cdr (assoc 'name-ja tool-record)))
         (material (cdr (assoc 'traditional-material tool-record)))
         (gesture (cdr (assoc 'presentation-gesture tool-record))))
    (sakura/say (string-append "Tool: " tool-name))
    (sakura/say (string-append "Japanese: " japanese-name))
    (sakura/say (string-append "Made from: " material))
    (sakura/say (string-append "Presented with: " gesture))
    tool-record))

(display-tea-tool-info "tea whisk")
```

Explanation: The program queries the culture knowledge base for a specific artifact within a tradition, extracts the Japanese name, traditional material, and presentation gesture, and displays them in sequence.

Meta-explanation: `culture/recall` retrieves culturally-specific knowledge indexed by tradition and artifact type. The `:tradition` parameter scopes the query. Returned records have semi-structured attributes (name variants, materials, practices). This differs from `world/knowledge` (general facts) — it's domain-specific to cultural practices, carrying both terms and contextual protocols. Row 1 shows retrieving a fact; this shows pulling *multi-attribute cultural records* where one query returns several related pieces of knowledge that together form a complete description.

---

### nature/recall — Row 2 (audit tier)

Problem: A birdwatching app identifies a bird from a photo and needs to show migration timing — when does this species arrive in spring and depart in autumn for this region?

```scheme
(define (migration-timing species region)
  (let* ((bird-record (nature/recall :species species :domain 'ornithology))
         (migration-data (cdr (assoc 'migration bird-record)))
         (regional-timing (cdr (assoc region migration-data)))
         (spring-arrival (cdr (assoc 'spring-arrival regional-timing)))
         (autumn-departure (cdr (assoc 'autumn-departure regional-timing))))
    (sakura/say (string-append 
                species 
                " migration in " 
                (symbol->string region)
                ":"))
    (sakura/say (string-append 
                "Arrives: " 
                (time/format spring-arrival 'month-day)))
    (sakura/say (string-append 
                "Departs: " 
                (time/format autumn-departure 'month-day)))
    regional-timing))

(migration-timing "American Robin" 'northeast-us)
```

Explanation: The program recalls the species record from the ornithology domain, extracts the migration data structure, narrows to the specified region, pulls spring arrival and autumn departure dates, and formats them as month-day strings.

Meta-explanation: `nature/recall` queries biological, ecological, or geological knowledge. The `:domain` parameter (ornithology, botany, geology) scopes the search. Returned data can be hierarchical (species → migration → region → dates). This pattern — *query top-level → navigate structure → extract leaf values* — lets one retrieval provide regionally-specific data without separate queries per region. Row 1 shows recalling a species; this shows navigating nested attributes to extract temporally and spatially qualified facts.

---

### book/recall — Row 2 (audit tier)

Problem: A literature student is writing about symbolism in "Moby-Dick" and needs a specific quote about the white whale. Retrieve the passage, the chapter it appears in, and the page number in the standard edition.

```scheme
(define (find-quote book-title search-phrase)
  (let* ((book-record (book/recall :title book-title))
         (passages (book/recall :title book-title 
                               :contains search-phrase 
                               :context 'paragraph))
         (first-match (car passages))
         (chapter (cdr (assoc 'chapter first-match)))
         (page (cdr (assoc 'page first-match)))
         (text (cdr (assoc 'text first-match))))
    (sakura/say (string-append 
                "From \"" 
                book-title 
                "\", Chapter " 
                (number->string chapter)
                " (p. " 
                (number->string page)
                "):"))
    (sakura/say text)
    first-match))

(find-quote "Moby-Dick" "white whale")
```

Explanation: The program first recalls the book metadata, then queries for passages containing the search phrase with paragraph-level context, retrieves the first match, extracts chapter number, page number, and text, and displays the citation and passage.

Meta-explanation: `book/recall` with `:contains` performs full-text search within a work. The `:context` parameter controls granularity (sentence, paragraph, chapter). Results include both text and metadata (chapter, page). This differs from general `world/knowledge` — it's scoped to literary texts with structural awareness (chapter/page). Row 1 shows recalling a book title; this shows searching *within* a book and retrieving location-annotated excerpts for citation.

---

### book/example — Row 2 (audit tier)

Problem: A writing teacher wants to show students three different ways published authors have written "reveal a secret" scenes — one subtle, one dramatic, one humorous. Pull examples from different books with different tones.

```scheme
(define (show-reveal-examples)
  (let ((examples (book/example :pattern 'secret-reveal 
                                :variations '(subtle dramatic humorous))))
    (for-each
      (lambda (ex)
        (sakura/say (string-append 
                    "Tone: " 
                    (symbol->string (cdr (assoc 'tone ex)))))
        (sakura/say (string-append 
                    "From \"" 
                    (cdr (assoc 'title ex))
                    "\":"))
        (sakura/say (cdr (assoc 'passage ex)))
        (sakura/say "---"))
      examples)))

(show-reveal-examples)
```

Explanation: The program calls `book/example` requesting the "secret-reveal" narrative pattern with three tonal variations, then iterates through the returned examples, displaying tone label, source title, and passage text with a separator between each.

Meta-explanation: `book/example` retrieves illustrative excerpts matching a *narrative pattern* rather than keyword search. The `:variations` parameter requests contrasting instances of the same pattern. This supports learning by comparison — seeing how different authors handle the same structural moment. It's pedagogical retrieval: "show me how this is done in different styles." Row 1 shows searching for content; this shows querying by *craft pattern* with tonal diversity, turning the corpus into a teaching resource.

---

### system/self — Row 2 (audit tier)

Problem: An operator asks "How much can you remember from this conversation after I close it?" The system should introspect its memory persistence policy and report what gets saved vs. what gets discarded.

```scheme
(define (explain-memory-persistence)
  (let* ((memory-policy (system/self :query 'memory-persistence))
         (saved-types (cdr (assoc 'saved memory-policy)))
         (discarded-types (cdr (assoc 'discarded memory-policy)))
         (retention-days (cdr (assoc 'retention-days memory-policy))))
    (sakura/say "After this conversation ends:")
    (sakura/say (string-append 
                "Saved: " 
                (string-join (map symbol->string saved-types) ", ")))
    (sakura/say (string-append 
                "Discarded: " 
                (string-join (map symbol->string discarded-types) ", ")))
    (sakura/say (string-append 
                "Retention: " 
                (number->string retention-days)
                " days"))
    memory-policy))

(explain-memory-persistence)
```

Explanation: The program queries the system's self-description for its memory persistence policy, extracts lists of saved and discarded data types and the retention period, then formats and presents them in natural language.

Meta-explanation: `system/self` enables introspection — querying the system's own configuration, policies, and capabilities. The `:query` parameter specifies which aspect to examine. This differs from `world/knowledge` (external facts) — it's *self-knowledge* about behavior and constraints. Row 1 shows retrieving one property; this shows unpacking a policy structure to explain system behavior transparently, turning implementation into operator-visible guarantees.

---

### system/why-i-just — Row 2 (audit tier)

Problem: After the system refuses to generate medical advice and instead suggests consulting a doctor, the operator asks "Why won't you just answer my question?" The system should explain the decision it just made.

```scheme
(define (explain-refusal)
  (let ((decision-record (system/why-i-just :action 'refuse-medical-advice)))
    (sakura/say "I declined because:")
    (sakura/say (cdr (assoc 'reason decision-record)))
    (sakura/say (string-append 
                "Triggered policy: " 
                (symbol->string (cdr (assoc 'policy decision-record)))))
    (sakura/say (cdr (assoc 'alternative decision-record)))
    decision-record))

(explain-refusal)
```

Explanation: The program calls `system/why-i-just` to retrieve the rationale for the most recent medical-advice refusal, extracts the reason, the policy that triggered the refusal, and the suggested alternative, then presents them.

Meta-explanation: `system/why-i-just` provides *action provenance* — explaining recent decisions by retrieving their logged rationale. The `:action` parameter identifies which decision to explain. This differs from `system/self` (general capabilities) — it's about *a specific choice just made*. The pattern is *act → operator questions → retrieve decision trace → explain*. Row 1 shows querying a capability; this shows retrospective explanation of behavior, making constraint-following visible and accountable.

---

### system/reflect — Row 2 (audit tier)

Problem: During a tutoring session that's gone off track into multiple tangents, the system should pause, assess whether the conversation is still serving the original learning goal, and suggest refocusing if drift has occurred.

```scheme
(define (check-conversation-drift original-goal)
  (let* ((reflection (system/reflect :on 'conversation-coherence))
         (current-topics (cdr (assoc 'recent-topics reflection)))
         (drift-score (cdr (assoc 'drift-from-goal reflection)))
         (suggested-action (cdr (assoc 'suggestion reflection))))
    (when (> drift-score 0.6)
      (sakura/say "Let me pause for a moment.")
      (sakura/say (string-append 
                  "We started with: " 
                  original-goal))
      (sakura/say (string-append 
                  "We've drifted into: " 
                  (string-join (map symbol->string current-topics) ", ")))
      (sakura/say suggested-action))
    reflection))

(check-conversation-drift "understanding quadratic equations")
```

Explanation: The program asks the system to reflect on conversation coherence, retrieves recent topics discussed and a numeric drift score, and if drift exceeds a threshold, pauses the conversation to name the original goal, list where it's drifted, and offer the system's suggested corrective action.

Meta-explanation: `system/reflect` triggers *meta-cognition* — evaluating the system's own recent behavior against a criterion. The `:on` parameter specifies what to evaluate (coherence, progress, tone). This differs from `system/why-i-just` (explaining one action) — it's assessing a *trajectory* across multiple turns. The pattern is *periodically step back → measure against goal → intervene if drifting*. Row 1 shows querying state; this shows using reflection to detect and correct process failures.

---

### world/knowledge — Row 2 (audit tier)

Problem: A trivia game needs to generate a question about the longest river in South America, retrieve the answer, present the question to the player, check their response, and explain if they're wrong.

```scheme
(define (trivia-question category)
  (let* ((question-data (world/knowledge :query (string-append 
                                                 "longest river in " 
                                                 category)))
         (answer (cdr (assoc 'answer question-data)))
         (player-response (pane/read-along "What is the longest river in South America?")))
    (if (string-ci=? player-response answer)
        (sakura/say "Correct!")
        (begin
          (sakura/say (string-append 
                      "Not quite. The answer is " 
                      answer 
                      "."))
          (sakura/say (cdr (assoc 'explanation question-data)))))))

(trivia-question "South America")
```

Explanation: The program queries world knowledge for the longest river in the specified region, extracts the answer, prompts the player with the question, compares their response case-insensitively to the answer, and either confirms correctness or provides the answer with an explanation.

Meta-explanation: `world/knowledge` retrieves general factual information from a broad knowledge base. The `:query` parameter is a natural-language question or topic. Composing with `pane/read-along` (user input) and conditional logic creates a quiz pattern: *retrieve fact → pose question → evaluate response → teach if wrong*. Row 1 shows looking up one fact; this shows building interactive knowledge testing where retrieval, questioning, and explanation compose.

---

### tick/sine — Row 2 (audit tier)

Problem: A breathing exercise app should pulse a circle's size smoothly in and out at 6 breaths per minute (10-second cycle), with size oscillating between 50 and 150 pixels in a calming rhythm.

```scheme
(define (breathing-guide)
  (let ((circle (entity/make :sprite 'circle :x 200 :y 200)))
    (time/every-ms 50
      (lambda ()
        (let* ((cycle-ms 10000)  ; 10 seconds per breath
               (amplitude 50)
               (baseline 100)
               (phase (tick/sine :period-ms cycle-ms))
               (radius (+ baseline (* amplitude phase))))
          (entity/scale! circle radius)
          (when (and (< phase 0.05) (> phase -0.05))
            (sakura/say "Breathe")))))))

(breathing-guide)
```

Explanation: The program creates a circle entity, then every 50ms calculates the current phase of a 10-second sine wave, maps that phase (ranging -1 to +1) to a radius between 50 and 150, scales the circle to that radius, and says "Breathe" when the phase crosses zero.

Meta-explanation: `tick/sine` returns the sine of elapsed time scaled to a specified period — a smooth oscillator tied to real time. The `:period-ms` parameter sets cycle length. Composing with `entity/scale!` turns trigonometry into animation. The pattern is *sine → scale → render* where the sine wave is a timing function, not a spatial one. Row 1 shows evaluating sine at a point; this shows using it as a *continuous time-based signal* that drives smooth periodic motion.

---

### entity/move! — Row 2 (audit tier)

Problem: A Pong game needs to update the ball's position each frame based on its velocity, bounce off walls by reversing velocity components, and detect when it goes off-screen to reset the round.

```scheme
(define (update-ball ball vx vy)
  (let ((x (entity/x ball))
        (y (entity/y ball)))
    (entity/move! ball (+ x vx) (+ y vy))
    (cond
      ((or (< (entity/x ball) 0) (> (entity/x ball) 400))
       (set! vx (- vx)))
      ((or (< (entity/y ball) 0) (> (entity/y ball) 300))
       (set! vy (- vy))))
    (when (< (entity/x ball) -10)
      (sakura/say "Left player scores!")
      (entity/move! ball 200 150))
    (list vx vy)))

(define (game-loop)
  (let ((ball (entity/make :sprite 'ball :x 200 :y 150))
        (velocity (list 3 2)))
    (time/every-ms 16
      (lambda ()
        (set! velocity (update-ball ball 
                                   (car velocity) 
                                   (cadr velocity)))))))

(game-loop)
```

Explanation: The `update-ball` function retrieves current ball position, moves it by velocity, checks if it hit horizontal or vertical walls and reverses the appropriate velocity component, checks if it went off the left edge to score and reset, and returns updated velocity. The game loop creates a ball, stores velocity in a mutable binding, and every 16ms calls update with current velocity, storing the result.

Meta-explanation: `entity/move!` sets absolute position — it's imperative placement. Composing with velocity addition turns it into physics: *current position + velocity → new position*. The exclamation mark signals mutation. Wrapping in a timed loop with mutable state creates continuous motion with collision response. Row 1 shows moving to a fixed position; this shows integrating velocity over time with state updates, where repeated mutation driven by a timer becomes animation.

---

### part/nod — Row 2 (audit tier)

Problem: A character in a dialogue scene should nod their head slightly when agreeing with what another character said, synchronized with the dialogue text appearing on screen.

```scheme
(define (character-agrees character-sprite agreement-line)
  (sakura/say agreement-line)
  (part/nod character-sprite 'head :angle 15 :duration-ms 600)
  (time/wait-ms 800)
  (part/nod character-sprite 'head :angle 15 :duration-ms 600))

(define (dialogue-exchange)
  (sakura/say "Character A: Should we take the mountain path?")
  (time/wait-ms 1500)
  (character-agrees (sprite/address 'character-b) 
                   "Character B: Yes, that's the safest route.")
  (time/wait-ms 1000)
  (sakura/say "They set off toward the peaks."))

(dialogue-exchange)
```

Explanation: The `character-agrees` function says the agreement line, tilts the character's head down 15 degrees over 600ms (a nod), waits briefly, then nods again (double-nod for emphasis). The dialogue exchange presents a question, pauses, has character B agree with a double-nod synchronized to their line, then concludes.

Meta-explanation: `part/nod` animates a subpart of an entity — head, arm, leg — separate from body motion. The `:angle` parameter controls tilt; `:duration-ms` controls speed. Composing with `sakura/say` and `time/wait-ms` creates *multimodal dialogue* where text and gesture reinforce each other. Row 1 shows nodding once; this shows nodding as *communicative gesture* synchronized with speech, where double-nod is a variation pattern (agree-strongly vs. acknowledge-weakly).

---

### animation/frame — Row 2 (audit tier)

Problem: A fighting game needs to check on which frame of a punch animation the character's fist actually extends, so that hit detection only activates during the "active frames" and not during windup or recovery.

```scheme
(define (punch-with-hitbox attacker target)
  (animation/play attacker 'punch)
  (time/every-ms 16
    (lambda ()
      (let ((current-frame (animation/frame attacker)))
        (when (and (>= current-frame 8) (<= current-frame 12))
          (let ((attacker-pos (cons (entity/x attacker) (entity/y attacker)))
                (target-pos (cons (entity/x target) (entity/y target))))
            (when (< (calc/distance attacker-pos target-pos) 50)
              (sakura/say "Hit!")
              (entity/flash target :color 'red :duration-ms 100))))))))

(punch-with-hitbox (sprite/address 'player) (sprite/address 'enemy))
```

Explanation: The program starts playing the punch animation, then every frame checks the current animation frame number, and only during frames 8-12 (the active window) it measures distance between attacker and target and triggers a hit if within range.

Meta-explanation: `animation/frame` returns the current frame index of a playing animation — enabling *frame-specific logic*. Composing with conditional checks creates "active frames" where hitboxes are on, versus startup/recovery frames where they're off. This is frame data programming: animations aren't just visual, they carry *temporal logic windows*. Row 1 shows querying a frame; this shows using frame number as a decision input for gameplay mechanics.

---

### sprite/address — Row 2 (audit tier)

Problem: A cutscene script needs to choreograph three characters entering a room in sequence — first the guard, then the prisoner, then the judge — each walking to a marked position and facing a specific direction.

```scheme
(define (courtroom-entrance)
  (let ((guard (sprite/address 'guard))
        (prisoner (sprite/address 'prisoner))
        (judge (sprite/address 'judge)))
    (sakura/say "The guard enters.")
    (motion/slide guard :to-x 150 :to-y 200 :duration-ms 1500)
    (entity/turn! guard 90)
    (time/wait-ms 500)
    
    (sakura/say "The prisoner is brought in.")
    (motion/slide prisoner :to-x 200 :to-y 200 :duration-ms 1800)
    (entity/turn! prisoner 90)
    (time/wait-ms 800)
    
    (sakura/say "All rise. The judge enters.")
    (motion/slide judge :to-x 200 :to-y 100 :duration-ms 2000)
    (entity/turn! judge 180)))

(courtroom-entrance)
```

Explanation: The program retrieves sprite handles for three characters, then sequences their entrance: narrates the guard entering, slides them to position and rotates, waits, narrates prisoner, slides and rotates them, waits, narrates judge, slides and rotates them.

Meta-explanation: `sprite/address` retrieves a sprite entity by symbolic name, returning a handle for imperative operations. It's the *lookup* that enables scripting — you reference "the guard" by name, not by searching. Composing retrieved handles with motion and timing verbs creates *choreography as code* where entities are actors, addresses are roles. Row 1 shows getting one sprite; this shows orchestrating multiple entities in timed sequence where symbolic names keep the script readable.

---

### scene/frame — Row 2 (audit tier)

Problem: A rhythm game needs to flash the background in sync with the beat, but only on specific beats (1 and 3 of a 4-beat measure). Track which beat we're on by counting frames since scene start.

```scheme
(define (beat-flash bpm)
  (let* ((ms-per-beat (/ 60000 bpm))
         (frames-per-beat (/ ms-per-beat 16)))  ; assuming 60fps
    (time/every-ms 16
      (lambda ()
        (let* ((current-frame (scene/frame))
               (beats-elapsed (/ current-frame frames-per-beat))
               (beat-in-measure (modulo (floor beats-elapsed) 4)))
          (when (or (= beat-in-measure 0) (= beat-in-measure 2))
            (surface/fill 'background :color 'white :duration-ms 100)
            (time/wait-ms 100)
            (surface/fill 'background :color 'black)))))))

(beat-flash 120)
```

Explanation: The program calculates frames per beat from BPM and frame rate, then every frame retrieves the current scene frame count, divides by frames-per-beat to get beats elapsed, takes modulo 4 to find position in measure, and flashes the background white briefly on beats 0 and 2 (the downbeats).

Meta-explanation: `scene/frame` returns the count of frames rendered since the scene started — a global timing reference. Dividing frame count by tempo-derived frame interval converts *frame space* to *beat space*. Modulo arithmetic finds cyclic position. The pattern is *frame → beat → measure position → trigger* where frame count becomes musical time. Row 1 shows querying frame count; this shows deriving rhythmic timing from frame count without explicit beat tracking.

---

### time/every-ms — Row 2 (audit tier)

Problem: A stock ticker display needs to scroll prices horizontally across the screen continuously, updating position every 30 milliseconds to create smooth motion, and wrap back to the start when it scrolls off the right edge.

```scheme
(define (ticker-scroll prices)
  (let ((x-pos 400))
    (time/every-ms 30
      (lambda ()
        (set! x-pos (- x-pos 2))
        (when (< x-pos -200)
          (set! x-pos 400))
        (surface/draw-text prices :x x-pos :y 50)))))

(ticker-scroll "AAPL 150.23 | GOOGL 2840.15 | TSLA 245.67")
```

Explanation: The program initializes a mutable x-position at 400 (right edge), then every 30ms decrements it by 2 pixels, checks if it's scrolled off the left edge and wraps back to the right if so, and draws the text at the current position.

Meta-explanation: `time/every-ms` registers a *recurring timer* — the lambda runs repeatedly at the specified interval until stopped. Composing with mutable state (`set!`) and drawing commands creates continuous animation. The pattern is *timer → update state → render → repeat* where time drives the loop. Row 1 shows calling a function once after a delay; this shows installing a *persistent callback* that fires indefinitely, turning time into an animation engine.

---

### ai/seek — Row 2 (audit tier)

Problem: An enemy character in a stealth game should move toward the player when they hear a noise, but stop and search if they lose line-of-sight, and give up if the player is too far away.

```scheme
(define (enemy-pursue enemy player)
  (let
