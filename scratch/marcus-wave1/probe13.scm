(with-exception-handler (lambda (e) (list (quote fe) (file-error? e) (quote msg) (error-object-message e))) (lambda () (open-input-file "/no/such/file")))
