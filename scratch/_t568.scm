(let ((input "I love apples and oranges")
      (keyword "apples"))
  (when (string-contains input keyword)
    (string-append "Found keyword: " keyword)))
