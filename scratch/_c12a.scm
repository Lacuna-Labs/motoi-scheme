(define (convert value from-unit to-unit)
  (let ((conversions (list
                       (list (list 'celsius 'fahrenheit) (lambda (c) (+ (* c (/ 9 5)) 32)))
                       (list (list 'fahrenheit 'celsius) (lambda (f) (* (- f 32) (/ 5 9))))
                       (list (list 'meters 'feet) (lambda (m) (* m 3.28084))))))
    (let ((pair (assoc (list from-unit to-unit) conversions)))
      (if pair
          ((cadr pair) value)
          'nan))))
(display (convert 0 'celsius 'fahrenheit))(newline)
(display (convert 100 'celsius 'kelvin))(newline)
