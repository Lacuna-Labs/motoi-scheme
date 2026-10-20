(with-exception-handler (lambda (e) 'caught) (lambda () (error "boom" 1)))
(display (list 'after-caught (inspect (last-error)))) (newline)
