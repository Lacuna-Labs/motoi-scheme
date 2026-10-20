;; ---- shape-robust alist accessor ----
;; Handles all three alist shapes Motoi produces:
;;   dotted literal  '((k . v))   -> (assoc k) = (k <dot> v), value = caddr
;;   cons-built      (cons 'k v)  -> (assoc k) = (k v),        value = cadr
;;   list-built      (list 'k v)  -> (assoc k) = (k v),        value = cadr
;; Returns #f when the key is absent (so callers can guard with `if`).
(define (alist-get key al)
  (let ((entry (assoc key al)))
    (if (not entry)
        #f
        (let ((rest (cdr entry)))
          (cond
           ((null? rest) #f)
           ;; dotted literal: (k <dot-symbol> v) -> rest = (<dot> v)
           ((and (pair? rest) (pair? (cdr rest))) (cadr rest))
           ;; plain: (k v) -> rest = (v)
           (else (car rest)))))))

;; A tiny serializer (write-to-string is not wired in Motoi base).
(define (write-to-string x)
  (cond
   ((string? x) x)
   ((number? x) (number->string x))
   ((symbol? x) (symbol->string x))
   ((null? x) "()")
   ((pair? x)
    (string-append "("
                   (fold (lambda (elt acc)
                           (if (string=? acc "")
                               (write-to-string elt)
                               (string-append acc " " (write-to-string elt))))
                         ""
                         x)
                   ")"))
   ((eq? x #t) "#t")
   ((eq? x #f) "#f")
   (else "?")))

;; ---- simulated wired surface ----
;; The verbs below stand in for capabilities that live in consumer repos
;; (Curator's automations layer), NOT in Motoi base. Here they are honest
;; local functions returning fixed, well-shaped data so every pipeline in
;; this chapter actually runs. The lesson is the *route* -- chaining verbs,
;; checking each seam, escalating cleanly -- not the network calls.

(define (web/fetch url)
  (string-append "Fetched body of " url ". Hello world this is example text."))

(define (text/word-count s)
  (length (filter (lambda (w) (not (string=? w "")))
                  (string-split s " "))))

(define (text/normalize s) (string-downcase (string-trim s)))
(define (text/flesch-kincaid s) 72)

(define (system/hash256 s)
  (number->string
   (fold (lambda (ch acc) (modulo (+ (* acc 31) (char->integer ch)) 1000000007))
         7 (string->list s))))

(define (geo/geocode-address addr)
  (list (cons 'lat 37.4224) (cons 'lng -122.0842)))

(define (wikidata/search q) (list (list (cons 'id "Q7186") (cons 'label q))))
(define (wikidata/entity id) (list (cons 'id id) (cons 'description "a scientist")))

(define (etsy/sections)
  (list (list (cons 'id 1) (cons 'active #t))
        (list (cons 'id 2) (cons 'active #f))
        (list (cons 'id 3) (cons 'active #t))))
(define (etsy/listings)
  (list (list (cons 'title "Mug")   (cons 'state "active") (cons 'tags (list "cup" "gift")))
        (list (cons 'title "Draft") (cons 'state "draft")  (cons 'tags (list "wip")))
        (list (cons 'title "Shirt") (cons 'state "active") (cons 'tags (list "gift" "wear")))))
(define (etsy/shop-stats) (list (cons 'views 1200) (cons 'sales 34)))

(define (cortex/recall-pattern pat)
  (list (list (cons 'text "order shipped to Keiko") (cons 'ts 1000))))
;; cortex/recall and cortex/remember ARE wired in Motoi, but their real shape
;; is a :plist keyed by :key, not the 'timestamp/'data shape these pipelines
;; assume. We shadow them locally with the shape this chapter's routes expect.
(define (cortex/recall key)
  (list (cons 'key key) (cons 'timestamp 1785000000000) (cons 'data "cached")))
(define (cortex/remember key val) #t)

(define (crm/contact-search q)
  (list (list (cons 'id 1) (cons 'email "a@example.com"))
        (list (cons 'id 2) (cons 'email "b@example.com"))))
(define (crm/assoc-batch-read ids)
  (list (list (cons 'email "a@example.com") (cons 'deal_stage "qualified"))
        (list (cons 'email "b@example.com") (cons 'deal_stage "new"))))

(define (model/draft prompt) (string-append "Draft: " prompt))

(define (shopify/orders)
  (list (list (cons 'id 101) (cons 'total_price 120)
              (cons 'subscription_id #f) (cons 'payment_id "pay_1")
              (cons 'line_items (list (list (cons 'quantity 4))
                                      (list (cons 'quantity 9)))))))
(define (stripe/payouts)
  (list (list (cons 'order_id 101) (cons 'fee 3))))
(define (stripe/event-fetch id) (list (cons 'id id) (cons 'amount 120)))
(define (subscribe/customer-read id) (list (cons 'id id) (cons 'plan "monthly")))

(define (time/days-since ts) 12)

(define (youtube/playlist-items-incremental pid)
  (list (list (cons 'videoId "vid1")) (list (cons 'videoId "vid2"))))
(define (youtube/videos-list ids)
  (map (lambda (id)
         (list (cons 'id id) (cons 'duration_seconds 253)
               (cons 'viewCount 1000) (cons 'likeCount 50) (cons 'commentCount 10)))
       ids))
(define (youtube/search-list q) (list (list (cons 'videoId "rel1"))))
(define (youtube/channels-uploads-playlist cid) "UUuploads")
(define (youtube/captions-list vid) (list (list (cons 'id "cap1"))))
(define (youtube/captions-download cid) "some caption text")

(define (analytics/query-revenue-by-promotion)
  (list (list (cons 'code "SAVE10") (cons 'revenue 500))
        (list (cons 'code "FREE")   (cons 'revenue 0))
        (list (cons 'code "VIP")    (cons 'revenue 900))))
(define (analytics/report) (list (cons 'total_revenue 1500)))
(define (analytics/engagement-shift email) 0.7)
(define (analytics/campaign-metrics) (list (cons 'clicks 42)))

(define (printify/blueprints)
  (list (list (cons 'type "apparel") (cons 'provider_id 7))
        (list (cons 'type "mug")     (cons 'provider_id 8))))
(define (printify/blueprint-providers id)
  (list (list (cons 'production_time 5)) (list (cons 'production_time 7))))
(define (printify/orders)
  (list (list (cons 'id 1) (cons 'status "pending"))
        (list (cons 'id 2) (cons 'status "fulfilled"))
        (list (cons 'id 3) (cons 'status "pending"))))

(define (collab/airtable-bases) (list (list (cons 'id "base1"))))
(define (collab/airtable-list base table filter)
  (list (cons 'id "rec123456") (cons 'linked_records (list))))

(define (mail/dispatch to subj body) #t)
(define (artifact/store-blob name blob) "artifact-abc123")
(define (documents/parse s) s)

(display (text/word-count (web/fetch "u")))
