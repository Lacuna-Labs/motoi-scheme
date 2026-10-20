(display (with-exception-handler (lambda (e) (list 'read-error? (read-error? e) 'file-error? (file-error? e) 'msg (error-object-message e)))
  (lambda () (read (open-input-string "(1 2"))))) (newline)
