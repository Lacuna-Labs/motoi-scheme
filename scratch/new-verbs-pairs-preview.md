# Motoi 5.0 new-verb teaching pairs — 49 total

Every pair teaches one of 19 verbs added today. Read a few — is the shape right? If yes, we fire 5.0. If no, tell me what to fix.

---

### 1. `lib/media/media.js:540`
**User:** What does sleep-ms do?

**Motoi:** Blocking pause for N milliseconds. `(sleep-ms 500)` blocks for half a second. Capped at 5000. Use this when you want a delay a kid can predict — `(wait ms)` returns a tagged clause and does not block, which is a foot-gun.

---

### 2. `lib/media/media.js:540`
**User:** How do I pause for a second?

**Motoi:** `(sleep-ms 1000)` — a thousand milliseconds. Or `(sleep 1)` — one second. Both block until the time passes.

---

### 3. `lib/media/media.js:540`
**User:** What's the difference between sleep and sleep-ms?

**Motoi:** `sleep` takes seconds — `(sleep 0.5)`. `sleep-ms` takes milliseconds — `(sleep-ms 500)`. Same pause, kid-friendly units. Both cap at 5 seconds.

---

### 4. `lib/media/media.js:552`
**User:** What does print do?

**Motoi:** Same as `display` — writes a value to stdout without a newline. `(print 5)` writes `5`. Familiar to kids from Python and Racket.

---

### 5. `lib/media/media.js:555`
**User:** What's println?

**Motoi:** `(println x)` writes x AND a newline. Same as `(display x) (newline)`. `(println)` alone writes just a newline.

---

### 6. `lib/media/media.js:555`
**User:** How do I print hello world?

**Motoi:** `(println "hello world")` — writes hello world and drops to a new line. Or the R7RS form: `(display "hello world") (newline)`.

---

### 7. `lib/media/media.js:277`
**User:** What does background do?

**Motoi:** Fills the framebuffer with a single color — alias of `clear`. `(background 3)` paints every pixel palette-index 3. `(background)` clears to color 0. Same signature both ways.

---

### 8. `lib/media/media.js:277`
**User:** How do I set the background color?

**Motoi:** `(background 'sky)` for the sky palette color, `(background 3)` for palette index 3, `(bg-clear)` for default. Same as `(clear …)` — just a friendlier name.

---

### 9. `lib/media/media.js:278`
**User:** What's bg-clear?

**Motoi:** Alias of `clear`. Wipes the framebuffer. Same as `(background)` and `(clear)`.

---

### 10. `lib/graphics/framebuffer-verbs.js:170`
**User:** How do I draw text?

**Motoi:** `(draw-text "hi" 5 5)` — writes hi at pixel (5, 5) in the current color. Alias of `fb/text`. Set the color first with `(set-color 'white)` if you need a specific tint.

---

### 11. `lib/audio/audio-verbs.js:170`
**User:** What does kick do?

**Motoi:** Plays a kick drum. `(kick)` — one hit. Optional step index `(kick 0)` for pattern position. Dispatches to `synth/kit` under the hood.

---

### 12. `lib/audio/audio-verbs.js:171`
**User:** How do I play a snare?

**Motoi:** `(snare)` — one snare hit. `(snare 4)` at step 4 of a pattern. Same shape as `kick`, `hat`, `crash`, `clap`.

---

### 13. `lib/audio/audio-verbs.js:170`
**User:** What percussion do I have?

**Motoi:** Five bare drum verbs: `(kick)`, `(snare)`, `(hat)`, `(crash)`, `(clap)`. All optional step arg. Or the canonical form `(synth/kit 'kick)` if you want to be explicit.

---

### 14. `lib/audio/audio-verbs.js:170`
**User:** How do I make a drum pattern?

**Motoi:** Loop over steps and dispatch each drum. `(for-each (lambda (step) (kick step) (sleep-ms 250)) (list 0 4 8 12))` — four-on-the-floor at 240 BPM.

---

### 15. `lib/audio/audio-verbs.js:172`
**User:** What does hat do?

**Motoi:** Plays a hi-hat. `(hat)` — one tick. Higher frequency than the kick, drier tail. Same optional step arg pattern.

---

### 16. `lib/system/stack.js`
**User:** What does motoi/stack do?

**Motoi:** Returns the current evaluation stack as a list of frame records. Each frame is an alist `((:name …) (:kind primitive|closure) (:depth N))`. Useful for the call-stack panel and for debugging.

---

### 17. `lib/system/stack.js`
**User:** How do I see the call stack?

**Motoi:** `(motoi/stack)` returns the live stack. `(motoi/stack-peak)` returns the deepest stack seen since the last clear. `(motoi/stack-depth)` returns just the current depth as an integer.

---

### 18. `lib/system/stack.js`
**User:** What's the difference between stack and stack-peak?

**Motoi:** `motoi/stack` is what's on the stack RIGHT NOW. `motoi/stack-peak` is the deepest it has been since the last time you cleared it. Use peak to profile recursion depth.

---

### 19. `lib/system/stack.js`
**User:** How do I reset the stack tracker?

**Motoi:** `(motoi/stack-clear!)` — clears the peak. Fresh baseline for the next measurement.

---

### 20. `Spec/CART-TEMPLATE.slat`
**User:** What is the cart template?

**Motoi:** A canonical 7-section Scheme bundle every fantasy console cart follows: `(:meta … :palette … :sprites … :tiles … :sounds … :music … :code …)`. Missing sections stay empty `()`. Composer widgets emit into their slot.

---

### 21. `lib/composer/composer.js`
**User:** How do I make an empty cart?

**Motoi:** `(composer/cart-empty)` — returns the canonical template with every section empty. Then fill sections in Scheme, or open the sprite/tile/piano widgets in the IDE and they emit into their slots.

---

### 22. `lib/composer/composer.js`
**User:** What does composer/cart-emit do?

**Motoi:** Serializes a cart record into the canonical template Scheme form. Every widget's state gets tucked into its section. Empty widgets → empty section.

---

### 23. `lib/composer/composer.js`
**User:** What's composer/cart-apply?

**Motoi:** Inverse of `cart-emit`. Reads a cart template Scheme form and restores widget state. Round-trip contract: `(equal? c (composer/cart-apply c (composer/cart-emit c)))` must be `#t`.

---

### 24. `lib/composer/composer.js`
**User:** How does the cart round-trip work?

**Motoi:** Emit-then-apply preserves state exactly. `(let ((t (composer/cart-emit cart))) (composer/cart-apply cart t))` gives you back the same cart. That's how save/load work under the hood.

---

### 25. `lib/composer/composer.js`
**User:** How do I save my cart?

**Motoi:** Press the Save button in the header — writes to `~/.motoi/carts/<name>.scm` via `save-cart`. Or call `(save-cart "my-cart.scm" (composer/cart-emit cart))` directly.

---

### 26. `lib/composer/composer.js`
**User:** How do I load a cart?

**Motoi:** Press Load in the header — reads from `~/.motoi/carts/`. Or `(load-cart "my-cart.scm")` to get the template Scheme form back. `(composer/cart-apply cart it)` restores widget state.

---

### 27. `Spec/CART-TEMPLATE.slat`
**User:** What sections does a cart have?

**Motoi:** Seven: `:meta` (name, author, version), `:palette` (colors), `:sprites` (pixel data), `:tiles` (map data), `:sounds` (sfx), `:music` (song data), `:code` (the main program). Every section optional. Missing = `()`.

---

### 28. `lib/system/hacker-mode.js`
**User:** What does motoi/hacker-mode-on! do?

**Motoi:** Switches Motoi's register to hacker mode — palette flips to green-on-black, and I stay silent unless you ask directly. `,ask <question>` or `,help <verb>` still work. `(motoi/hacker-mode-off!)` restores cherry-tree mode.

---

### 29. `lib/system/hacker-mode.js`
**User:** How do I turn on hacker mode?

**Motoi:** Header button labeled Hacker, or `,hacker` at the REPL, or Alt-H in the terminal. Or from Scheme: `(motoi/hacker-mode-on!)`. Silence and green until you turn it off.

---

### 30. `site/ide-assets/ide.css`
**User:** What color is hacker mode?

**Motoi:** Phosphor green `#7EFF7E` on near-black `#0a0f0a`. Optional amber accent `#ffb84d`. Old-school terminal, modernized. Subtle scanline layer for CRT feel.

---

### 31. `authored-example`
**User:** Give me a code example with the new verbs

**Motoi:** ```
(begin-frame)
(background 'black)
(set-color 'white)
(draw-text "HELLO" 5 5)
(rectangle 0 0 20 20)
(pixel 10 10)
(end-frame)
(println "drew a title screen")
(sleep-ms 200)
(kick) (snare) (hat)
```
Text frame drawn, message printed, quarter-second pause, three drum hits.

---

### 32. `authored-example`
**User:** How do I make a beat with sleep-ms?

**Motoi:** ```
(for-each
  (lambda (step)
    (kick step)
    (sleep-ms 125)
    (when (odd? step) (snare))
    (hat)
    (sleep-ms 125))
  (iota 8))
```
16-step pattern, 125ms per subdivision = 120 BPM.

---

### 33. `lib/system/stack.js`
**User:** How do I inspect what my function is doing?

**Motoi:** `(motoi/stack-clear!)` first. Run the function. Then `(motoi/stack-peak)` shows the deepest stack it reached. `(motoi/stack-depth)` gives a scalar you can log with `println`.

---

### 34. `authored-example`
**User:** Debug my recursion depth

**Motoi:** ```
(motoi/stack-clear!)
(fib 20)
(println "peak depth was:")
(println (motoi/stack-depth))
```
After the call, depth tells you how deep the recursion went.

---

### 35. `authored-example`
**User:** How do I write a simple splash?

**Motoi:** ```
(background 'black)
(set-color 'pink)
(draw-text "MOTOI" 30 30)
(println "press any key")
(tone 660 0.15)
(sleep-ms 150)
(tone 880 0.15)
```
Canvas paints, text draws, message prints, two tones chime — deterministic, all runtime.

---

### 36. `authored-example`
**User:** [hacker mode] ,ask what verbs did you get today

**Motoi:** sleep-ms · print · println · background · bg-clear · draw-text · kick · snare · hat · crash · clap · motoi/stack · motoi/stack-peak · motoi/stack-depth · motoi/stack-clear! · composer/cart-emit · composer/cart-apply · composer/cart-empty · motoi/hacker-mode-on!

---

### 37. `lib/media/media.js:540`
**User:** ,help sleep-ms

**Motoi:** sleep-ms — blocking pause for N milliseconds. Arity 1. Caps at 5000. Alias-adjacent to `sleep` which takes seconds.

---

### 38. `lib/media/media.js:555`
**User:** ,help println

**Motoi:** println — writes a value to stdout followed by a newline. Arity 0..1. Same as display + newline.

---

### 39. `lib/audio/audio-verbs.js:170`
**User:** ,help kick

**Motoi:** kick — plays a kick drum. Arity 0..1. Optional step index for pattern position. Dispatches to synth/kit.

---

### 40. `lib/composer/composer.js`
**User:** ,help composer/cart-empty

**Motoi:** composer/cart-empty — returns the canonical empty cart template. Every section is `()`. Fill sections manually or via widgets.

---

### 41. `lib/system/stack.js`
**User:** ,help motoi/stack

**Motoi:** motoi/stack — returns the live evaluation stack as a list of frame alists. Each frame has :name :kind :depth. Zero-arg.

---

### 42. `lib/audio/audio-verbs.js:172`
**User:** Does Motoi have a hi-hat verb?

**Motoi:** Yes. `(hat)`. Same shape as `kick` and `snare` — optional step arg.

---

### 43. `lib/audio/audio-verbs.js:173`
**User:** crash cymbal?

**Motoi:** `(crash)`. Long tail, high frequency. Optional step arg.

---

### 44. `lib/audio/audio-verbs.js:174`
**User:** clap sound?

**Motoi:** `(clap)`. Sharp attack, short. Optional step arg.

---

### 45. `lib/media/media.js:277`
**User:** How do I background clear before drawing?

**Motoi:** `(background)` or `(background 0)` at the top of the frame. Then `begin-frame` isn't needed if you're doing manual redraw — but with on-frame the pattern is `(begin-frame) (background) …draw stuff… (end-frame)`.

---

### 46. `lib/composer/composer.js`
**User:** How do I emit my sprite from the composer?

**Motoi:** The sprite-grid widget calls its `emit` on save — result goes into cart's `:sprites` section. From Scheme: `(composer/cart-emit cart)` gets you the whole template, look inside the `:sprites` key for the list.

---

### 47. `authored-example`
**User:** Show me stack usage

**Motoi:** ```
(motoi/stack-clear!)
(println (motoi/stack-depth))
(define (deep n)
  (if (zero? n) (motoi/stack-depth) (deep (- n 1))))
(println (deep 10))
(println (motoi/stack-peak))
```

---

### 48. `lib/graphics/framebuffer-verbs.js:170`
**User:** draw-text with a color?

**Motoi:** Set the color first. `(set-color 'yellow)` then `(draw-text "OK" 5 5)`. Text draws in the current color.

---

### 49. `authored-example`
**User:** Five-line demo using everything

**Motoi:** ```
(background 'black) (set-color 'pink) (draw-text "YO" 5 5)
(rectangle 0 0 10 10) (pixel 20 20)
(kick) (sleep-ms 200) (snare) (sleep-ms 200) (hat)
(println (motoi/stack-depth))
(println (composer/cart-empty))
```

---

