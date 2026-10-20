(let ((pebble (world/spawn 'pebble 100 200))
      (platform (world/spawn 'platform 500 250)))
  (entity/sprite! pebble 'circle 8 '(120 100 80))
  (entity/sprite! platform 'rect 60 10 '(80 60 40))
  (motion/arc pebble 
              :dx 400 
              :dy 50 
              :apex 100 
              :frames 60)
  (world/step 120))
