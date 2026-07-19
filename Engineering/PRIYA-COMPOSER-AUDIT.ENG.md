---
status: vulnerable
audience: engineering
dialect: motoi-base
training-eligible: false
confidentiality: internal
provenance: priya-independent-audit-2026-07-17
source-slat: PRIYA-COMPOSER-AUDIT.ENG.slat
generated: do not hand-edit — rendered from SLAT
---

> **Audience:** engineering
> **Dialect:** `motoi-base`
> **Training-eligible:** no
> **Confidentiality:** `internal`

<!-- warning: unknown record type "audit" — rendered raw -->
```lisp
(audit :doc "PRIYA-COMPOSER-AUDIT" :section "meta" :audience "engineering" :dialect "motoi-base" :provenance "priya-independent-audit-2026-07-17" :training-eligible #f :confidentiality "internal" :subject "lib/net/http-serve.js @ v1.1" :ship-blocking #t :ship-blocking-reason "one HIGH (symlink escape breaks documented trust contract) + zero-day-worthy in a kid-facing product")
```

<!-- warning: unknown record type "summary" — rendered raw -->
```lisp
(summary :doc "PRIYA-COMPOSER-AUDIT" :section "summary" :audience "engineering" :counts (:crit 0 :high 1 :med 4 :low 5 :info 3) :headline "Path-traversal defense is genuinely sound. XSS surface is clean.\nCompose auth model is honest. The one real bug is SYMLINK ESCAPE inside cart-dir:\na local user (kid, friend) who plants a symlink pointing at /etc/passwd will\nhave that file served over HTTP under the cart's name. Doctrine comment at\nline 19 promises 'Only fs.readFileSync + fs.readdirSync inside cart-dir' —\nsymlinks silently break that promise. Fix is a two-line change (use lstatSync\n+ realpathSync verification). All other findings are hardening opportunities,\nnot exploits.")
```

<!-- warning: unknown record type "finding" — rendered raw -->
```lisp
(finding :id "P-01" :severity "high" :attack "symlink escape from cart-dir" :status "vulnerable" :file "lib/net/http-serve.js" :lines "83-104 (safeCartPathWithSubdir); 101 uses statSync" :repro-steps "1. cd carts/ && echo 'secret' > /tmp/passwd-like\n 2. ln -s /tmp/passwd-like carts/leak.slat\n 3. Start server: (http/serve :port 8080 :cart-dir \"carts\")\n 4. curl http://localhost:8080/play/leak\n 5. Response body embeds the contents of /tmp/passwd-like inside the\n    <pre> block of the cart shell HTML.\n Root cause: statSync + readFileSync FOLLOW symlinks. resolve() does NOT\n resolve them; realpathSync would. The prefix-startsWith check runs\n against the symlink path, not its target." :suggested-fix "Use lstatSync in place of statSync at line 101, refuse if isSymbolicLink().\n Belt-and-braces: also realpathSync the candidate and re-check the prefix\n against cartDir. Same fix goes into safeResolveCartDir at line 53 to reject\n symlink cart-dirs. In listCarts, Dirent.isFile() already returns false for\n symlinks, so the LISTING correctly hides them — but hidden symlinks are\n still readable by name, which is worse (harder to notice)." :also-affects "safeResolveCartDir at line 53 (statSync there too)")
```

<!-- warning: unknown record type "finding" — rendered raw -->
```lisp
(finding :id "P-02" :severity "med" :attack "TOCTOU between existsSync and readFileSync" :status "vulnerable-but-narrow" :file "lib/net/http-serve.js" :lines "101 (existsSync + statSync), 314/338 (readFileSync)" :repro-steps "A local process racing the server can swap cartDir/foo.slat from a\n benign file to a symlink between safeCartPathWithSubdir returning a\n resolved path and the readFileSync call in the handler. Requires local\n write access to cartDir and precise timing; nearly impossible over\n network. Combines with P-01 to become worse (if P-01 fixed via\n lstat-check, the check must happen atomically — check-then-open is\n still racy)." :suggested-fix "Open with openSync(path, 'r' | O_NOFOLLOW) via fs.constants.O_NOFOLLOW,\n then fstatSync + readFileSync-from-fd. O_NOFOLLOW makes the open fail\n if the final path component is a symlink and closes the TOCTOU window\n in one syscall. Simpler alternative: single try/catch readFileSync,\n accept the read only if lstatSync of the same path (called AFTER open\n via fstat) confirms non-symlink. Best: openSync with O_NOFOLLOW.")
```

<!-- warning: unknown record type "finding" — rendered raw -->
```lisp
(finding :id "P-03" :severity "med" :attack "Slowloris — server has no explicit timeouts set" :status "mitigated-by-node-defaults-only" :file "lib/net/http-serve.js" :lines "369-374 (createServer + listen)" :repro-steps "Open TCP to server, dribble one byte of the request line per second.\n Node 18+ has headersTimeout=60s and requestTimeout=300s as defaults —\n so the socket dies within a minute — but the server doesn't set these\n explicitly, so it silently inherits whatever the host Node picks. On\n a future Node upgrade or a Node fork with different defaults, this\n becomes a real DoS surface. Test with `slowhttptest -c 200 -H\n -i 10 -r 200 -t GET -u http://127.0.0.1:PORT -x 24 -p 3`." :suggested-fix "After createServer(), set: server.headersTimeout = 5000;\n server.requestTimeout = 10000; server.keepAliveTimeout = 5000;\n server.maxConnections = 200. Kids' friends don't need long-poll HTTP.\n Document the numbers in the doctrine block at the top of the file.")
```

<!-- warning: unknown record type "finding" — rendered raw -->
```lisp
(finding :id "P-04" :severity "med" :attack "double-listen silent failure (EADDRINUSE)" :status "vulnerable-to-confusion" :file "lib/net/http-serve.js" :lines "369-384 (http/serve installer)" :repro-steps "1. (define s1 (http/serve :port 8080 :cart-dir \"carts\"))\n 2. (define s2 (http/serve :port 8080 :cart-dir \"carts\"))  ;; same port\n 3. Node emits 'error' event on s2's server with code EADDRINUSE.\n 4. No 'error' listener is attached → Node unhandledError → currently\n    the server object stays in the _servers Map with a broken socket.\n 5. http/wait-until-ready s2 returns #f after timeout.\n 6. Caller sees false, but the record is still in _servers, and the\n    error event may crash the process depending on Node behavior.\n Root: never attach an 'error' listener to server; never remove\n from _servers on bind failure." :suggested-fix "Attach server.on('error', (e) => { record.error = e; _servers.delete(id) }).\n Have http/wait-until-ready return (:error e) or reject when record.error\n is set instead of a bland #f. Optional: throw synchronously on\n EADDRINUSE if you can detect it early via a synchronous probe.")
```

<!-- warning: unknown record type "finding" — rendered raw -->
```lisp
(finding :id "P-05" :severity "med" :attack "listCarts unbounded directory recursion" :status "vulnerable-to-DoS-and-doctrine-mismatch" :file "lib/net/http-serve.js" :lines "107-126" :repro-steps "Doctrine comment at line 106 says 'recursive, one level' — code is\n actually unbounded recursion. A deep genuine directory tree under\n carts/ (e.g. an unpacked node_modules dropped by mistake) will\n recurse arbitrarily deep on every GET /. Each landing-page request\n does a full walk with no cache. Symlinks are Dirent.isDirectory()\n =false so they don't recurse (mitigation), but genuine deep trees do.\n Requires local write of a deep tree — DoS impact bounded to CPU/IO." :suggested-fix "Cap depth at 2 (matches doctrine claim of 'one level below cartDir').\n Cache the listing for N seconds. Better: read the entries lazily\n and paginate. At minimum, update the comment to match the code\n OR update the code to match the comment.")
```

<!-- warning: unknown record type "finding" — rendered raw -->
```lisp
(finding :id "P-06" :severity "low" :attack "cart-name regex allows dot-only names ('.' and '..')" :status "mitigated-by-explicit-check" :file "lib/net/http-serve.js" :lines "66-67 (safeCartPath — dead code), 88-91 (safeCartPathWithSubdir — live)" :repro-steps "/^[A-Za-z0-9._-]+$/.test('.')  → true\n /^[A-Za-z0-9._-]+$/.test('..') → true\n In safeCartPathWithSubdir the explicit `if (p === '.' || p === '..')\n return null` catches both. In the OLDER safeCartPath (lines 63-79) it\n does NOT — but that function is exported only via _internal and is\n not wired into the request handler. Still, its presence is a trap:\n a future refactor that swaps back to it reintroduces the traversal." :suggested-fix "Delete safeCartPath (dead code) OR add the same p==='.' / p==='..'\n rejection at line 67. Also consider tightening the regex to\n /^[A-Za-z0-9](?:[A-Za-z0-9._-]*[A-Za-z0-9])?$/ to forbid names\n ending in '.' or '-' or containing consecutive dots. Kid-cart names\n don't need those.")
```

<!-- warning: unknown record type "finding" — rendered raw -->
```lisp
(finding :id "P-07" :severity "low" :attack "dot-file cart is readable if name is guessed" :status "mitigated-by-listing-only" :file "lib/net/http-serve.js" :lines "113 (listCarts skips dotfiles), 88-91 (safeCartPathWithSubdir accepts them)" :repro-steps "Drop carts/.secret.slat — listCarts hides it from GET /. But GET\n /play/.secret returns it (regex allows leading dot; explicit check\n only forbids exact '.' and '..'). Trust asymmetry between listing\n and reading." :suggested-fix "Add `if (p.startsWith('.')) return null` at line 89 to align read\n policy with list policy. Dot-prefixed cart names have no legitimate\n use in the kid product.")
```

<!-- warning: unknown record type "finding" — rendered raw -->
```lisp
(finding :id "P-08" :severity "low" :attack "IPv6 loopback variants not recognized as local" :status "safe-but-brittle" :file "lib/net/http-serve.js" :lines "135-139 (isLocalRequest)" :repro-steps "isLocalRequest recognizes exactly '127.0.0.1', '::1', '::ffff:127.0.0.1'.\n It rejects '127.0.0.2' (also loopback per RFC 3330), '::ffff:127.0.0.2',\n '::ffff:7f00:0001' (equivalent IPv6-mapped form), and any 127.0.0.0/8\n address. False-negative → deny. Direction is safe (fail-closed) but\n causes surprising 403s on unusual OS configurations." :suggested-fix "Parse addr with node:net.isIP, then check the numeric range: any\n IPv4 in 127.0.0.0/8, or IPv6 '::1', or IPv6-mapped-v4 with the\n embedded v4 in 127.0.0.0/8. Reject Unix sockets or missing addr as\n non-local (unchanged).")
```

<!-- warning: unknown record type "finding" — rendered raw -->
```lisp
(finding :id "P-09" :severity "low" :attack "HEAD requests get 405 instead of 200" :status "not-a-vuln-but-user-visible-bug" :file "lib/net/http-serve.js" :lines "271-276 (method check)" :repro-steps "curl -I http://localhost:8080/ → 405. RFC 7231 says HEAD MUST be\n supported wherever GET is supported. Browsers use HEAD for\n preflight/prefetch. Not exploitable, just wrong." :suggested-fix "Change `req.method !== 'GET'` to `req.method !== 'GET' && req.method\n !== 'HEAD'`. For HEAD, set headers then res.end() with no body.\n OPTIONS could be added later if CORS matters (currently not needed).")
```

<!-- warning: unknown record type "finding" — rendered raw -->
```lisp
(finding :id "P-10" :severity "low" :attack "URL length limit relies on Node's max-header-size" :status "mitigated-by-Node-default-16KB" :file "lib/net/http-serve.js" :lines "267-291 (no explicit length check)" :repro-steps "1KB path → served. 100KB path → Node parser rejects with 431 before\n handler runs. If maxHeaderSize is bumped (--max-http-header-size CLI\n flag), the handler will accept it. Not exploitable, but a small\n explicit check would harden." :suggested-fix "After parsed = new URL(req.url, ...), reject if pathname.length > 512.\n Cart names cap at 128 chars per segment × 4 segments + '/play/'\n prefix ≈ 520 chars max. 512 leaves margin.")
```

<!-- warning: unknown record type "finding" — rendered raw -->
```lisp
(finding :id "P-11" :severity "info" :attack "path traversal via encoded/unicode/null byte" :status "mitigated" :file "lib/net/http-serve.js" :lines "277-285, 88-91" :repro-steps "Tested vectors, all blocked:\n   /play/..%2Fpackage.json      → 403 (literal .. in raw url)\n   /play/%2E%2E%2Fpackage.json  → 404 (decoded '..' rejected in segment)\n   /play/%252e%252e             → 404 (double-decode not attempted; '%2e%2e' fails regex)\n   /play/..%00.slat             → 403 (literal .. in raw url) + \\0 also blocked\n   /play/‥%2Fpackage.json       → 404 (unicode '‥' fails regex)\n   /play/foo%5Cbar               → 404 ('\\\\' fails regex, so safe on Windows too)\n The layered defense (raw-url string check + regex + segment check +\n resolved-prefix check) is genuinely thorough. Nice work by previous author." :suggested-fix "No fix needed. Keep the pattern.")
```

<!-- warning: unknown record type "finding" — rendered raw -->
```lisp
(finding :id "P-12" :severity "info" :attack "XSS via cart name or cart contents" :status "mitigated" :file "lib/net/http-serve.js" :lines "256-263 (escapeHtml), 196-235 (shell HTMLs)" :repro-steps "cart name is regex-restricted to [A-Za-z0-9._-] so no HTML chars\n possible. Cart file contents are piped through escapeHtml before\n landing in <pre>. escapeHtml handles &<>'\". No script execution\n possible from cart source or cart name. Content-Type is\n text/html; charset=utf-8 — no MIME confusion." :suggested-fix "No fix needed. Consider adding a strict Content-Security-Policy\n header (default-src 'none'; style-src 'unsafe-inline') so that when\n the composer eventually loads JS bundles the surface is intentional.")
```

<!-- warning: unknown record type "finding" — rendered raw -->
```lisp
(finding :id "P-13" :severity "info" :attack "X-Forwarded-For / Host header spoofing" :status "mitigated-by-design" :file "lib/net/http-serve.js" :lines "128-139" :repro-steps "Handler never reads req.headers.host, x-forwarded-for, x-real-ip,\n forwarded, or any client-controlled header for authorization decisions.\n isLocalRequest uses only req.socket.remoteAddress. Test covered by\n http-serve.test.js line 156 (XFF spoof from 203.0.113.42 → 403).\n Correct and honestly documented in the SECURITY REVIEW block at top." :suggested-fix "No fix needed. If a future wave adds a reverse-proxy deployment mode,\n introduce an explicit :trust-forwarded config knob rather than\n sniffing headers.")
```

<!-- warning: unknown record type "coverage" — rendered raw -->
```lisp
(coverage :doc "PRIYA-COMPOSER-AUDIT" :section "coverage" :probed ("path traversal: literal ../, %2E%2E, double-URL-encode, null byte, unicode ‥, backslash cross-platform" "cart-name regex: dot-only, dot-dot, hyphen-leading, unicode homoglyph" "long paths: 1KB served, 100KB rejected by Node parser at 16KB" "symlink escape: file symlink readable (P-01), dir symlink not walked, dir symlink not readable as cart" "TOCTOU: window exists (P-02) — narrow" "large POST body: 405 short-circuits, body not buffered by handler" "header CRLF injection: setHeader values are static; no user-input in headers" "XSS: cart-name regex + escapeHtml cover reflection and source" "cart file with <script>: escaped in <pre>; not executed" "HTTP smuggling (CL + TE): non-GET returns 405 before body parsing" "Slowloris: mitigated only by Node defaults (P-03)" "method confusion: HEAD wrong (P-09); OPTIONS/TRACE/CONNECT correctly 405" "Host header trust: not read → not exploitable" "compose without remoteAddress: falls to '' → not-local → 403 (correct)" "IPv6-mapped ::ffff:127.0.0.1: recognized; 127.0.0.2/other loopback variants not (P-08)" "double http/serve on same port: silent-failure (P-04)"))
```

<!-- warning: unknown record type "decision" — rendered raw -->
```lisp
(decision :doc "PRIYA-COMPOSER-AUDIT" :section "decision" :recommendation "block-ship-until-P-01-fixed" :rationale "The audit found NO critical remote-exploit bugs and the traversal\n defense is genuinely well-layered. Compose-auth model is honest.\n The blocker is P-01 (symlink escape): it violates a promise made\n in the doctrine comment (line 19: 'Only fs.readFileSync +\n fs.readdirSync INSIDE cart-dir') and any kid who runs `ln -s\n /some/private/file carts/foo.slat` — including by accident via\n rsync -a, tar -xh, or a git checkout of a symlinked repo — leaks\n that file to every friend who visits /play/foo. In a product\n whose entire threat model is 'my kid's friends visit', that's\n not-shippable. Fix is 2-3 lines (lstatSync + refuse-symlinks).\n P-02 through P-05 should be batched into the same patch since\n they cluster around the same fs surface. P-06 through P-13 are\n hardening — schedule but do not block." :priority-fix-order ("P-01" "P-04" "P-03" "P-02" "P-05" "P-06" "P-07" "P-09" "P-08" "P-10") :effort-estimate-hours 3 :re-audit-after-fix "yes — 30-min diff review, no need to rerun full sweep")
```
