### READ-RADIX - 95 failures - category (a)

**Root cause:** reader does not implement radix/exactness prefixes (#x #o #b #d #e #i)

| suite | assertion (source text) | expected | actual |
|---|---|---|---|
| chibi L761 | `(test #t (real? #e1e10))` | `#t` | `RAISED: unbound symbol: #e1e10` |
| chibi L775 | `(test #t (exact? #e3.0))` | `#t` | `RAISED: unbound symbol: #e3.0` |
| chibi L973 | `(test #i1/3 (rationalize .3 1/10))` | `RAISED: unbound symbol: #i1/3` | `1/3` |
| chibi L2234 | `(test #x7F (char->integer (read (open-input-string "#\\delete"))))` | `RAISED: unbound symbol: #x7F` | `127` |
| chibi L2235 | `(test #x1B (char->integer (read (open-input-string "#\\escape"))))` | `RAISED: unbound symbol: #x1B` | `27` |
| chibi L2236 | `(test #x03BB (char->integer (read (open-input-string "#\\λ"))))` | `RAISED: unbound symbol: #x03BB` | `955` |
| chibi L2237 | `(test #x03BB (char->integer (read (open-input-string "#\\x03BB"))))` | `RAISED: unbound symbol: #x03BB` | `955` |
| chibi L2248 | `(test #x22 (char->integer (string-ref (read (open-input-string "\"\\\"\"")) 0)))` | `RAISED: unbound symbol: #x22` | `34` |
| chibi L2249 | `(test #x7C (char->integer (string-ref (read (open-input-string "\"\\\|\"")) 0)))` | `RAISED: unbound symbol: #x7C` | `124` |
| chibi L2256 | `(test #x03BB (char->integer (string-ref (read (open-input-string "\"\\x03BB;\"")) 0)))` | `RAISED: unbound symbol: #x03BB` | `120` |
| chibi L2324 | `(test-numeric-syntax "#i1" 1.0 "1.0" "1.")` | `1` | `#i1` |
| chibi L2325 | `(test-numeric-syntax "#I1" 1.0 "1.0" "1.")` | `1` | `#I1` |
| chibi L2326 | `(test-numeric-syntax "#i-1" -1.0 "-1.0" "-1.")` | `-1` | `#i-1` |
| chibi L2335 | `(test-numeric-syntax "#i1.0" 1.0 "1.0" "1.")` | `1` | `#i1.0` |
| chibi L2336 | `(test-numeric-syntax "#e1.0" 1 "1")` | `1` | `#e1.0` |
| chibi L2337 | `(test-numeric-syntax "#e-.0" 0 "0")` | `0` | `#e-.0` |
| chibi L2338 | `(test-numeric-syntax "#e-0." 0 "0")` | `0` | `#e-0.` |
| chibi L2357 | `(test-numeric-syntax "#i+nan.0" +nan.0 "+nan.0" "+NaN.0")` | `+nan.0` | `#i+nan.0` |
| chibi L2358 | `(test-numeric-syntax "#i+inf.0" +inf.0 "+inf.0" "+Inf.0")` | `+inf.0` | `#i+inf.0` |
| chibi L2359 | `(test-numeric-syntax "#i-inf.0" -inf.0 "-inf.0" "-Inf.0")` | `-inf.0` | `#i-inf.0` |
| chibi L2362 | `(test-numeric-syntax "#e1/2" (/ 1 2) "1/2")` | `0.5` | `#e1/2` |
| chibi L2366 | `(test-numeric-syntax "#e0/10" 0 "0")` | `0` | `#e0/10` |
| chibi L2367 | `(test-numeric-syntax "#i3/2" (/ 3.0 2.0) "1.5")` | `1.5` | `#i3/2` |
| chibi L2404 | `(test-numeric-syntax "#x11" 17 "17")` | `17` | `#x11` |
| chibi L2405 | `(test-numeric-syntax "#X11" 17 "17")` | `17` | `#X11` |
| chibi L2406 | `(test-numeric-syntax "#d11" 11 "11")` | `11` | `#d11` |
| chibi L2407 | `(test-numeric-syntax "#D11" 11 "11")` | `11` | `#D11` |
| chibi L2408 | `(test-numeric-syntax "#o11" 9 "9")` | `9` | `#o11` |
| chibi L2409 | `(test-numeric-syntax "#O11" 9 "9")` | `9` | `#O11` |
| chibi L2410 | `(test-numeric-syntax "#b11" 3 "3")` | `3` | `#b11` |
| chibi L2411 | `(test-numeric-syntax "#B11" 3 "3")` | `3` | `#B11` |
| chibi L2412 | `(test-numeric-syntax "#o7" 7 "7")` | `7` | `#o7` |
| chibi L2413 | `(test-numeric-syntax "#xa" 10 "10")` | `10` | `#xa` |
| chibi L2414 | `(test-numeric-syntax "#xA" 10 "10")` | `10` | `#xA` |
| chibi L2415 | `(test-numeric-syntax "#xf" 15 "15")` | `15` | `#xf` |
| chibi L2416 | `(test-numeric-syntax "#x-10" -16 "-16")` | `-16` | `#x-10` |
| chibi L2417 | `(test-numeric-syntax "#d-10" -10 "-10")` | `-10` | `#d-10` |
| chibi L2418 | `(test-numeric-syntax "#o-10" -8 "-8")` | `-8` | `#o-10` |
| chibi L2419 | `(test-numeric-syntax "#b-10" -2 "-2")` | `-2` | `#b-10` |
| chibi L2421 | `(test-numeric-syntax "#e#x10" 16 "16")` | `16` | `#e#x10` |
| chibi L2422 | `(test-numeric-syntax "#i#x10" 16.0 "16.0" "16.")` | `16` | `#i#x10` |
| chibi L2423 | `(test-numeric-syntax "#x#i10" 16.0 "16.0" "16.")` | `16` | `#x#i10` |
| chibi L2424 | `(test-numeric-syntax "#i#x1/10" 0.0625 "0.0625")` | `0.0625` | `#i#x1/10` |
| chibi L2425 | `(test-numeric-syntax "#x#i1/10" 0.0625 "0.0625")` | `0.0625` | `#x#i1/10` |
| chibi L2427 | `(test-numeric-syntax "#d1." 1.0 "1.0" "1.")` | `1` | `#d1.` |
| chibi L2428 | `(test-numeric-syntax "#d.1" 0.1 "0.1" ".1" "100.0e-3")` | `0.1` | `#d.1` |
| chibi L2429 | `(test-numeric-syntax "#x1e2" 482 "482")` | `482` | `#x1e2` |
| chibi L2430 | `(test-numeric-syntax "#d1e2" 100.0 "100.0" "100.")` | `100` | `#d1e2` |
| chibi L2432 | `(test-numeric-syntax "#x10/2" 8 "8")` | `8` | `#x10/2` |
| chibi L2433 | `(test-numeric-syntax "#x11/2" (/ 17 2) "17/2")` | `8.5` | `#x11/2` |
| chibi L2434 | `(test-numeric-syntax "#d11/2" (/ 11 2) "11/2")` | `5.5` | `#d11/2` |
| chibi L2435 | `(test-numeric-syntax "#o11/2" (/ 9 2) "9/2")` | `4.5` | `#o11/2` |
| chibi L2436 | `(test-numeric-syntax "#b11/10" (/ 3 2) "3/2")` | `1.5` | `#b11/10` |
| larc base.sld | `(test-string-to-number ("10" 10) ("1" 1) ("-17" -17) ("#x24" 36) ("#x-24" -36) ("#b+00000110110" 54) ("#e10" 10) ("#e1" 1) ("#e-17" -17) ("#e#x24" 36) ("#e#x-24" -36) ("#e#b+00000110110" 54) ("#x#e24" 36) ("#x#e-24" -36)` | `10` | `#f` |
| larc base.sld | `(test-string-to-number ("10" 10) ("1" 1) ("-17" -17) ("#x24" 36) ("#x-24" -36) ("#b+00000110110" 54) ("#e10" 10) ("#e1" 1) ("#e-17" -17) ("#e#x24" 36) ("#e#x-24" -36) ("#e#b+00000110110" 54) ("#x#e24" 36) ("#x#e-24" -36)` | `1` | `#f` |
| larc base.sld | `(test-string-to-number ("10" 10) ("1" 1) ("-17" -17) ("#x24" 36) ("#x-24" -36) ("#b+00000110110" 54) ("#e10" 10) ("#e1" 1) ("#e-17" -17) ("#e#x24" 36) ("#e#x-24" -36) ("#e#b+00000110110" 54) ("#x#e24" 36) ("#x#e-24" -36)` | `-17` | `#f` |
| larc base.sld | `(test-string-to-number ("10" 10) ("1" 1) ("-17" -17) ("#x24" 36) ("#x-24" -36) ("#b+00000110110" 54) ("#e10" 10) ("#e1" 1) ("#e-17" -17) ("#e#x24" 36) ("#e#x-24" -36) ("#e#b+00000110110" 54) ("#x#e24" 36) ("#x#e-24" -36)` | `36` | `#f` |
| larc base.sld | `(test-string-to-number ("10" 10) ("1" 1) ("-17" -17) ("#x24" 36) ("#x-24" -36) ("#b+00000110110" 54) ("#e10" 10) ("#e1" 1) ("#e-17" -17) ("#e#x24" 36) ("#e#x-24" -36) ("#e#b+00000110110" 54) ("#x#e24" 36) ("#x#e-24" -36)` | `-36` | `#f` |
| larc base.sld | `(test-string-to-number ("10" 10) ("1" 1) ("-17" -17) ("#x24" 36) ("#x-24" -36) ("#b+00000110110" 54) ("#e10" 10) ("#e1" 1) ("#e-17" -17) ("#e#x24" 36) ("#e#x-24" -36) ("#e#b+00000110110" 54) ("#x#e24" 36) ("#x#e-24" -36)` | `54` | `#f` |
| larc base.sld | `(test-string-to-number ("10" 10) ("1" 1) ("-17" -17) ("#x24" 36) ("#x-24" -36) ("#b+00000110110" 54) ("#e10" 10) ("#e1" 1) ("#e-17" -17) ("#e#x24" 36) ("#e#x-24" -36) ("#e#b+00000110110" 54) ("#x#e24" 36) ("#x#e-24" -36)` | `36` | `#f` |
| larc base.sld | `(test-string-to-number ("10" 10) ("1" 1) ("-17" -17) ("#x24" 36) ("#x-24" -36) ("#b+00000110110" 54) ("#e10" 10) ("#e1" 1) ("#e-17" -17) ("#e#x24" 36) ("#e#x-24" -36) ("#e#b+00000110110" 54) ("#x#e24" 36) ("#x#e-24" -36)` | `-36` | `#f` |
| larc base.sld | `(test-string-to-number ("10" 10) ("1" 1) ("-17" -17) ("#x24" 36) ("#x-24" -36) ("#b+00000110110" 54) ("#e10" 10) ("#e1" 1) ("#e-17" -17) ("#e#x24" 36) ("#e#x-24" -36) ("#e#b+00000110110" 54) ("#x#e24" 36) ("#x#e-24" -36)` | `54` | `#f` |
| larc read.sld | `(test "\x7f;\x4c;\x61;\x72;\x63;\x65;\x6e;\x79;\x0;#x21;" (list->string (map integer->char '(127 76 97 114 99 101 110 121 0 35 120 50 49 59))))` | `"Larceny\u0000#x21;"` | `"x7f;x4c;x61;x72;x63;x65;x6e;x79;x0;#x21;"` |
| larc read.sld | `(test (read-data (string-append "#e0 #e+0 #e-0 #e00 #e+0000 #e-00000 " "#e001 #e2 #e-003 #e007 #e97 #e1001")) '(0 0 0 0 0 0 1 2 -3 7 97 1001))` | `(0 0 0 0 0 0 1 2 -3 7 97 1001)` | `(#e0 #e+0 #e-0 #e00 #e+0000 #e-00000 #e001 #e2 #e-003 #e007 #e97 #e1001)` |
| larc read.sld | `(test (read-data (string-append "#d0 #d+0 #d-0 #d00 #d+0000 #d-00000 " "#d001 #d2 #d-003 #d007 #d97 #d1001")) '(0 0 0 0 0 0 1 2 -3 7 97 1001))` | `(0 0 0 0 0 0 1 2 -3 7 97 1001)` | `(#d0 #d+0 #d-0 #d00 #d+0000 #d-00000 #d001 #d2 #d-003 #d007 #d97 #d1001)` |
| larc read.sld | `(test (read-data (string-append "#e#d0 #e#d+0 #e#d-0 #e#d00 #e#d+00 #e#d-0000 " "#e#d01 #e#d2 #e#d-3 #e#d007 #e#d97 #e#d1001")) '(0 0 0 0 0 0 1 2 -3 7 97 1001))` | `(0 0 0 0 0 0 1 2 -3 7 97 1001)` | `(#e#d0 #e#d+0 #e#d-0 #e#d00 #e#d+00 #e#d-0000 #e#d01 #e#d2 #e#d-3 #e#d007 #e#d97 #e#d1001)` |
| larc read.sld | `(test (read-data (string-append "#d#e0 #d#e+0 #d#e-0 #d#e00 #d#e+00 #d#e-0000 " "#d#e01 #d#e2 #d#e-3 #d#e007 #d#e97 #d#e1001")) '(0 0 0 0 0 0 1 2 -3 7 97 1001))` | `(0 0 0 0 0 0 1 2 -3 7 97 1001)` | `(#d#e0 #d#e+0 #d#e-0 #d#e00 #d#e+00 #d#e-0000 #d#e01 #d#e2 #d#e-3 #d#e007 #d#e97 #d#e1001)` |
| larc read.sld | `(test (read-data (string-append "#x0 #x+0 #x-0 #x00 #x+0000 #x-00000 " "#x001 #x2 #x-003 #x007 #x97 #x1001 " "#xabcd #x-fedc")) '(0 0 0 0 0 0 1 2 -3 7 151 4097 43981 -65244))` | `(0 0 0 0 0 0 1 2 -3 7 151 4097 43981 -65244)` | `(#x0 #x+0 #x-0 #x00 #x+0000 #x-00000 #x001 #x2 #x-003 #x007 #x97 #x1001 #xabcd #x-fedc)` |
| larc read.sld | `(test (read-data (string-append "#e#x0 #e#x+0 #e#x-0 #e#x00 #e#x+00 #e#x-0000 " "#e#x01 #e#x2 #e#x-3 #e#x007 #e#x97 #e#x1001 " "#xabcd #x-fedc")) '(0 0 0 0 0 0 1 2 -3 7 151 4097 43981 -65244))` | `(0 0 0 0 0 0 1 2 -3 7 151 4097 43981 -65244)` | `(#e#x0 #e#x+0 #e#x-0 #e#x00 #e#x+00 #e#x-0000 #e#x01 #e#x2 #e#x-3 #e#x007 #e#x97 #e#x1001 #xabcd #x-fedc)` |
| larc read.sld | `(test (read-data (string-append "#x#e0 #x#e+0 #x#e-0 #x#e00 #x#e+00 #x#e-0000 " "#x#e01 #x#e2 #x#e-3 #x#e007 #x#e97 #x#e1001 " "#xabcd #x-fedc")) '(0 0 0 0 0 0 1 2 -3 7 151 4097 43981 -65244))` | `(0 0 0 0 0 0 1 2 -3 7 151 4097 43981 -65244)` | `(#x#e0 #x#e+0 #x#e-0 #x#e00 #x#e+00 #x#e-0000 #x#e01 #x#e2 #x#e-3 #x#e007 #x#e97 #x#e1001 #xabcd #x-fedc)` |
| larc read.sld | `(test (read-data (string-append "#o0 #o+0 #o-0 #o00 #o+0000 #o-00000 " "#o001 #o2 #o-003 #o007 #o77 #o1001")) '(0 0 0 0 0 0 1 2 -3 7 63 513))` | `(0 0 0 0 0 0 1 2 -3 7 63 513)` | `(#o0 #o+0 #o-0 #o00 #o+0000 #o-00000 #o001 #o2 #o-003 #o007 #o77 #o1001)` |
| larc read.sld | `(test (read-data (string-append "#e#o0 #e#o+0 #e#o-0 #e#o00 #e#o+00 #e#o-0000 " "#e#o01 #e#o2 #e#o-3 #e#o007 #e#o77 #e#o1001")) '(0 0 0 0 0 0 1 2 -3 7 63 513))` | `(0 0 0 0 0 0 1 2 -3 7 63 513)` | `(#e#o0 #e#o+0 #e#o-0 #e#o00 #e#o+00 #e#o-0000 #e#o01 #e#o2 #e#o-3 #e#o007 #e#o77 #e#o1001)` |
| larc read.sld | `(test (read-data (string-append "#o#e0 #o#e+0 #o#e-0 #o#e00 #o#e+00 #o#e-0000 " "#o#e01 #o#e2 #o#e-3 #o#e007 #o#e77 #o#e1001")) '(0 0 0 0 0 0 1 2 -3 7 63 513))` | `(0 0 0 0 0 0 1 2 -3 7 63 513)` | `(#o#e0 #o#e+0 #o#e-0 #o#e00 #o#e+00 #o#e-0000 #o#e01 #o#e2 #o#e-3 #o#e007 #o#e77 #o#e1001)` |
| larc read.sld | `(test (read-data (string-append "#b0 #b+0 #b-0 #b00 #b+000 #b-000 " "#b001 #b1001 #b-111111 #b+10101010")) '(0 0 0 0 0 0 1 9 -63 170))` | `(0 0 0 0 0 0 1 9 -63 170)` | `(#b0 #b+0 #b-0 #b00 #b+000 #b-000 #b001 #b1001 #b-111111 #b+10101010)` |
| larc read.sld | `(test (read-data (string-append "#e#b0 #e#b+0 #e#b-0 #e#b00 #e#b+000 #e#b-000 " "#e#b001 #e#b1001 #e#b-111111 #e#b+10101010")) '(0 0 0 0 0 0 1 9 -63 170))` | `(0 0 0 0 0 0 1 9 -63 170)` | `(#e#b0 #e#b+0 #e#b-0 #e#b00 #e#b+000 #e#b-000 #e#b001 #e#b1001 #e#b-111111 #e#b+10101010)` |
| larc read.sld | `(test (read-data (string-append "#b#e0 #b#e+0 #b#e-0 #b#e00 #b#e+000 #b#e-000 " "#b#e001 #b#e1001 #b#e-111111 #b#e+10101010")) '(0 0 0 0 0 0 1 9 -63 170))` | `(0 0 0 0 0 0 1 9 -63 170)` | `(#b#e0 #b#e+0 #b#e-0 #b#e00 #b#e+000 #b#e-000 #b#e001 #b#e1001 #b#e-111111 #b#e+10101010)` |
| larc write.sld | `(test (write-then-read "\x7f;\x4c;\x61;\x72;\x63;\x65;\x6e;\x79;\x0;#x21;") (list->string (map integer->char '(127 76 97 114 99 101 110 121 0 35 120 50 49 59))))` | `"Larceny\u0000#x21;"` | `#f` |
| larc inexact.sld | `(test (real? #e1e10) #t)` | `#t` | `&error` |
| larc inexact.sld | `(test (exact? #e3.0) #t)` | `#t` | `&error` |
| larc inexact.sld | `(test-string-to-number ("10" 10) ("1" 1) ("-17" -17) ("#x24" 36) ("#x-24" -36) ("#b+00000110110" 54) ("#e10" 10) ("#e1" 1) ("#e-17" -17) ("#e#x24" 36) ("#e#x-24" -36) ("#e#b+00000110110" 54) ("#x#e24" 36) ("#x#e-24" -36)` | `10` | `#f` |
| larc inexact.sld | `(test-string-to-number ("10" 10) ("1" 1) ("-17" -17) ("#x24" 36) ("#x-24" -36) ("#b+00000110110" 54) ("#e10" 10) ("#e1" 1) ("#e-17" -17) ("#e#x24" 36) ("#e#x-24" -36) ("#e#b+00000110110" 54) ("#x#e24" 36) ("#x#e-24" -36)` | `1` | `#f` |
| larc inexact.sld | `(test-string-to-number ("10" 10) ("1" 1) ("-17" -17) ("#x24" 36) ("#x-24" -36) ("#b+00000110110" 54) ("#e10" 10) ("#e1" 1) ("#e-17" -17) ("#e#x24" 36) ("#e#x-24" -36) ("#e#b+00000110110" 54) ("#x#e24" 36) ("#x#e-24" -36)` | `-17` | `#f` |
| larc inexact.sld | `(test-string-to-number ("10" 10) ("1" 1) ("-17" -17) ("#x24" 36) ("#x-24" -36) ("#b+00000110110" 54) ("#e10" 10) ("#e1" 1) ("#e-17" -17) ("#e#x24" 36) ("#e#x-24" -36) ("#e#b+00000110110" 54) ("#x#e24" 36) ("#x#e-24" -36)` | `36` | `#f` |
| larc inexact.sld | `(test-string-to-number ("10" 10) ("1" 1) ("-17" -17) ("#x24" 36) ("#x-24" -36) ("#b+00000110110" 54) ("#e10" 10) ("#e1" 1) ("#e-17" -17) ("#e#x24" 36) ("#e#x-24" -36) ("#e#b+00000110110" 54) ("#x#e24" 36) ("#x#e-24" -36)` | `-36` | `#f` |
| larc inexact.sld | `(test-string-to-number ("10" 10) ("1" 1) ("-17" -17) ("#x24" 36) ("#x-24" -36) ("#b+00000110110" 54) ("#e10" 10) ("#e1" 1) ("#e-17" -17) ("#e#x24" 36) ("#e#x-24" -36) ("#e#b+00000110110" 54) ("#x#e24" 36) ("#x#e-24" -36)` | `54` | `#f` |
| larc inexact.sld | `(test-string-to-number ("10" 10) ("1" 1) ("-17" -17) ("#x24" 36) ("#x-24" -36) ("#b+00000110110" 54) ("#e10" 10) ("#e1" 1) ("#e-17" -17) ("#e#x24" 36) ("#e#x-24" -36) ("#e#b+00000110110" 54) ("#x#e24" 36) ("#x#e-24" -36)` | `36` | `#f` |
| larc inexact.sld | `(test-string-to-number ("10" 10) ("1" 1) ("-17" -17) ("#x24" 36) ("#x-24" -36) ("#b+00000110110" 54) ("#e10" 10) ("#e1" 1) ("#e-17" -17) ("#e#x24" 36) ("#e#x-24" -36) ("#e#b+00000110110" 54) ("#x#e24" 36) ("#x#e-24" -36)` | `-36` | `#f` |
| larc inexact.sld | `(test-string-to-number ("10" 10) ("1" 1) ("-17" -17) ("#x24" 36) ("#x-24" -36) ("#b+00000110110" 54) ("#e10" 10) ("#e1" 1) ("#e-17" -17) ("#e#x24" 36) ("#e#x-24" -36) ("#e#b+00000110110" 54) ("#x#e24" 36) ("#x#e-24" -36)` | `54` | `#f` |
| larc inexact.sld | `(test-string-to-number ("10" 10) ("1" 1) ("-17" -17) ("#x24" 36) ("#x-24" -36) ("#b+00000110110" 54) ("#e10" 10) ("#e1" 1) ("#e-17" -17) ("#e#x24" 36) ("#e#x-24" -36) ("#e#b+00000110110" 54) ("#x#e24" 36) ("#x#e-24" -36)` | `+inf.0` | `#f` |
| larc inexact.sld | `(test-string-to-number ("10" 10) ("1" 1) ("-17" -17) ("#x24" 36) ("#x-24" -36) ("#b+00000110110" 54) ("#e10" 10) ("#e1" 1) ("#e-17" -17) ("#e#x24" 36) ("#e#x-24" -36) ("#e#b+00000110110" 54) ("#x#e24" 36) ("#x#e-24" -36)` | `-inf.0` | `#f` |
| larc inexact.sld | `(test-string-to-number ("10" 10) ("1" 1) ("-17" -17) ("#x24" 36) ("#x-24" -36) ("#b+00000110110" 54) ("#e10" 10) ("#e1" 1) ("#e-17" -17) ("#e#x24" 36) ("#e#x-24" -36) ("#e#b+00000110110" 54) ("#x#e24" 36) ("#x#e-24" -36)` | `0` | `#f` |
| larc inexact.sld | `(test-string-to-number ("10" 10) ("1" 1) ("-17" -17) ("#x24" 36) ("#x-24" -36) ("#b+00000110110" 54) ("#e10" 10) ("#e1" 1) ("#e-17" -17) ("#e#x24" 36) ("#e#x-24" -36) ("#e#b+00000110110" 54) ("#x#e24" 36) ("#x#e-24" -36)` | `0` | `#f` |
| larc inexact.sld | `(test/approx-string-to-number ("#i1e100" (inexact (expt 10 100))) ("#i1e1000" (inexact (expt 10 1000))) ("#i-1e1000" (inexact (- (expt 10 1000)))) ("1e100" (inexact (expt 10 100))) ("1.0e100" (inexact (expt 10 100))) ("1` | `approx 1e+100` | `approx #f` |
| larc inexact.sld | `(test/approx-string-to-number ("#i1e100" (inexact (expt 10 100))) ("#i1e1000" (inexact (expt 10 1000))) ("#i-1e1000" (inexact (- (expt 10 1000)))) ("1e100" (inexact (expt 10 100))) ("1.0e100" (inexact (expt 10 100))) ("1` | `approx +inf.0` | `approx #f` |
| larc inexact.sld | `(test/approx-string-to-number ("#i1e100" (inexact (expt 10 100))) ("#i1e1000" (inexact (expt 10 1000))) ("#i-1e1000" (inexact (- (expt 10 1000)))) ("1e100" (inexact (expt 10 100))) ("1.0e100" (inexact (expt 10 100))) ("1` | `approx -inf.0` | `approx #f` |

### READ-BARSYM - 26 failures - category (a)

**Root cause:** reader does not implement |vertical bar| symbol syntax

| suite | assertion (source text) | expected | actual |
|---|---|---|---|
| chibi L2197 | `(test 'Hello (read (open-input-string "\|H\\x65;llo\|")))` | `Hello` | `\|H\x65` |
| chibi L2272 | `(test-write-syntax "a" '\|a\|)` | `"a"` | `"\|a\|"` |
| larc read.sld | `(test (read-datum "\|;alskjdf;aqwjepojq-1945apgf ;bna]as\|") (string->symbol ";alskjdf;aqwjepojq-1945apgf ;bna]as"))` | `;alskjdf;aqwjepojq-1945apgf ;bna]as` | `\|` |
| larc read.sld | `(test (read-datum (string #\\| #\\ #\a #\\ #\b #\\ #\t #\\ #\n #\\ #\r #\\ #\\| #\\ #\" #\\ #\\ #\\|)) (string->symbol (string #\alarm #\backspace #\tab #\newline #\return #\\| #\" #\\)))` | `	  \|"\` | `&error` |
| larc read.sld | `(test (read-data "\|\\\\\\\\|\\\" a\| \|\\\"\\\\|\\\\ b\|") (map string->symbol (list (string #\\ #\\| #\" #\space #\a) (string #\" #\\| #\\ #\space #\b))))` | `(\\|" a "\|\ b)` | `&error` |
| larc read.sld | `(test (read-datum "\|\x000;\x01;\x2;\t\r\x41;\n\t\x7e;\x7f;\|") (string->symbol (string #\null #\x1 #\x2 #\tab #\return #\A #\newline #\tab #\~ #\delete)))` | ` 	 A 	~` | `\|x000` |
| larc write.sld | `(test (write-then-read "\r\n\t\b\a\\|\"\\") (list->string (map integer->char '(13 10 9 8 7 124 34 92))))` | `"\r\n\t\b\u0007\|\"\\"` | `#f` |
| larc write.sld | `(test (write-then-read (map integer->char '(32 9 10 13))) '(#\space #\tab #\newline #\return))` | `(#\space #\tab #\newline #\return)` | `#f` |
| larc write.sld | `(test (write-then-read '(#\alarm #\backspace #\delete #\escape #\newline)) (map integer->char '(7 8 127 27 10)))` | `(#\alarm #\backspace #\delete #\escape #\newline)` | `#f` |
| larc write.sld | `(test (write-then-read '(#\null #\return #\space #\tab)) (map integer->char '(0 13 32 9)))` | `(#\null #\return #\space #\tab)` | `#f` |
| larc write.sld | `(test (write-then-read '(#\x0 #\x00 #\x1 #\x20 #\x5f #\x7c #\x7f)) (map integer->char '(0 0 1 32 95 124 127)))` | `(#\null #\null #\ #\space #\_ #\\| #\delete)` | `#f` |
| larc write.sld | `(test (write-then-read (map string->symbol '("a" "!" "$" "%" "&" "*" "/" ":" "<" "=" ">" "?" "^" "_" "~" "@"))) '(a ! $ % & * / : < = > ? ^ _ ~ @))` | `(a ! $ % & * / : < = > ? ^ _ ~ @)` | `#f` |
| larc write.sld | `(test (write-then-read '(Z: !z $0 %/ &? *^ /~ :@ <9 =+ >- ?@ ^+- _-+ ~@- @@@@@)) (map string->symbol '("Z:" "!z" "$0" "%/" "&?" "*^" "/~" ":@" "<9" "=+" ">-" "?@" "^+-" "_-+" "~@-" "@@@@@")))` | `(Z: !z $0 %/ &? *^ /~ :@ <9 =+ >- ?@ ^+- _-+ ~@- @@@@@)` | `#f` |
| larc write.sld | `(test (write-then-read '(+ -)) '(+ -))` | `(+ -)` | `#f` |
| larc write.sld | `(test (write-then-read '(+: -@ +- -- +@ -@ +$$ -@3 +-4 --5 +@_ -@.)) (map string->symbol '("+:" "-@" "+-" "--" "+@" "-@" "+$$" "-@3" "+-4" "--5" "+@_" "-@.")))` | `(+: -@ +- -- +@ -@ +$$ -@3 +-4 --5 +@_ -@.)` | `#f` |
| larc write.sld | `(test (write-then-read '(+.! -.+ +.. -.. +.@ -.@)) (map string->symbol '("+.!" "-.+" "+.." "-.." "+.@" "-.@")))` | `(+.! -.+ +.. -.. +.@ -.@)` | `#f` |
| larc write.sld | `(test (write-then-read '(+.<.+ -.++. +..:? -..- +.@&. -.@24)) (map string->symbol '("+.<.+" "-.++." "+..:?" "-..-" "+.@&." "-.@24")))` | `(+.<.+ -.++. +..:? -..- +.@&. -.@24)` | `#f` |
| larc write.sld | `(test (write-then-read '(._ .+ .- .@ .. ._. .+. .-. .@. ...)) (map string->symbol '("._" ".+" ".-" ".@" ".." "._." ".+." ".-." ".@." "...")))` | `(._ .+ .- .@ .. ._. .+. .-. .@. ...)` | `#f` |
| larc write.sld | `(test (read-from-string (write-datum display '(( ) #( ) #u8( ) 'x `x ,x ,@x (a . b)))) '(() #() #u8() 'x `x ,x ,@x (a . b)))` | `(() #() #u8() (quote x) (quasiquote x) (unquote x) (unquote-splicing x) (a . b))` | `#t` |
| larc write.sld | `(test (write-then-read '(( ) #( ) #u8( ) 'x `x ,x ,@x (a . b))) '(() #() #u8() 'x `x ,x ,@x (a . b)))` | `(() #() #u8() (quote x) (quasiquote x) (unquote x) (unquote-splicing x) (a . b))` | `#f` |
| larc write.sld | `(test (write-then-read (let* ((x (list 1 2)) (y (list x x))) (list y y))) '(((1 2) (1 2)) ((1 2) (1 2))))` | `(((1 2) (1 2)) ((1 2) (1 2)))` | `#f` |
| larc write.sld | `(test (let ((z (read-from-string (write-datum write-shared (let* ((x (list 1 2)) (y (list x x))) (list y y)))))) (list (eq? (car z) (cadr z)) (eq? (car (car z)) (cadr (car z))))) '(#t #t))` | `(#t #t)` | `&error` |
| larc write.sld | `(test (write-data display '(#e0 #e+0 #e-0 #e00 #e+0000 #e-00000 #e001 #e2 #e-003 #e007 #e97 #e1001)) '("0" "0" "0" "0" "0" "0" "1" "2" "-3" "7" "97" "1001"))` | `("0" "0" "0" "0" "0" "0" "1" "2" "-3" "7" "97" "1001")` | `("#e0" "#e+0" "#e-0" "#e00" "#e+0000" "#e-00000" "#e001" "#e2" "#e-003" "#e007" "#e97" "#e1001")` |
| larc write.sld | `(test (write-data write '(#e0 #e+0 #e-0 #e00 #e+0000 #e-00000 #e001 #e2 #e-003 #e007 #e97 #e1001)) '("0" "0" "0" "0" "0" "0" "1" "2" "-3" "7" "97" "1001"))` | `("0" "0" "0" "0" "0" "0" "1" "2" "-3" "7" "97" "1001")` | `("#e0" "#e+0" "#e-0" "#e00" "#e+0000" "#e-00000" "#e001" "#e2" "#e-003" "#e007" "#e97" "#e1001")` |
| larc write.sld | `(test (write-data write-shared '(#e0 #e+0 #e-0 #e00 #e+0000 #e-00000 #e001 #e2 #e-003 #e007 #e97 #e1001)) '("0" "0" "0" "0" "0" "0" "1" "2" "-3" "7" "97" "1001"))` | `("0" "0" "0" "0" "0" "0" "1" "2" "-3" "7" "97" "1001")` | `("#e0" "#e+0" "#e-0" "#e00" "#e+0000" "#e-00000" "#e001" "#e2" "#e-003" "#e007" "#e97" "#e1001")` |
| larc write.sld | `(test (write-data write-simple '(#e0 #e+0 #e-0 #e00 #e+0000 #e-00000 #e001 #e2 #e-003 #e007 #e97 #e1001)) '("0" "0" "0" "0" "0" "0" "1" "2" "-3" "7" "97" "1001"))` | `("0" "0" "0" "0" "0" "0" "1" "2" "-3" "7" "97" "1001")` | `("#e0" "#e+0" "#e-0" "#e00" "#e+0000" "#e-00000" "#e001" "#e2" "#e-003" "#e007" "#e97" "#e1001")` |

### NUM-EXACTNESS - 14 failures - category (a)

**Root cause:** exactness is not tracked: exact?/inexact?/exact-integer? answer by integrality, not representation

| suite | assertion (source text) | expected | actual |
|---|---|---|---|
| chibi L774 | `(test #f (exact? 3.0))` | `#f` | `#t` |
| chibi L776 | `(test #t (inexact? 3.))` | `#t` | `#f` |
| chibi L779 | `(test #f (exact-integer? 32.0))` | `#f` | `#t` |
| chibi L949 | `(test 2.0 (denominator (inexact (/ 6 4))))` | `2` | `1` |
| chibi L1041 | `(test #t (inexact? (inexact 1)))` | `#t` | `#f` |
| larc base.sld | `(test (eqv? 2 (inexact 2)) #f)` | `#f` | `#t` |
| larc base.sld | `(test (denominator (inexact (/ 6 4))) 2.0)` | `2` | `1` |
| larc base.sld | `(test (inexact? (inexact 3)) #t)` | `#t` | `#f` |
| larc base.sld | `(test (exact? (inexact 3)) #f)` | `#f` | `#t` |
| larc inexact.sld | `(test (exact? 3.0) #f)` | `#f` | `#t` |
| larc inexact.sld | `(test (inexact? 3.) #t)` | `#t` | `#f` |
| larc inexact.sld | `(test (exact-integer? 32.0) #f)` | `#f` | `#t` |
| larc inexact.sld | `(test (denominator (inexact (/ 6 4))) 2.0)` | `2` | `1` |
| larc inexact.sld | `(test (inexact? (expt 0.0 0.0)) #t)` | `#t` | `#f` |

### UNICODE - 14 failures - category (a)

**Root cause:** Unicode case/character handling diverges

| suite | assertion (source text) | expected | actual |
|---|---|---|---|
| chibi L1274 | `(test 4 (digit-value #\x0664))` | `4` | `#f` |
| chibi L1275 | `(test 0 (digit-value #\x0AE6))` | `0` | `#f` |
| chibi L1405 | `(test "mass" (string-foldcase "Maß"))` | `"mass"` | `"maß"` |
| chibi L1407 | `(test "i\x0307;" (string-downcase "İ"))` | `"ix0307;"` | `"i̇"` |
| chibi L1408 | `(test "i\x0307;" (string-foldcase "İ"))` | `"ix0307;"` | `"i̇"` |
| chibi L1411 | `(test "s" (string-foldcase "ſ"))` | `"s"` | `"ſ"` |
| chibi L1419 | `(test "μέλοσ" (string-foldcase "ΜΈΛΟΣ"))` | `"μέλοσ"` | `"μέλος"` |
| chibi L2020 | `(test #\x10F700 c0)` | `#\􏜀` | `#\�` |
| chibi L2021 | `(test #\x10F700 c1)` | `#\􏜀` | `#\�` |
| chibi L2022 | `(test #\x10F701 c2)` | `#\􏜁` | `#\�` |
| chibi L2023 | `(test #\x10F702 c3)` | `#\􏜂` | `#\�` |
| larc base.sld | `(cond-expand (full-unicode (test (integer->char #xDF) #\xDF) (test (integer->char #x10AAAA) #\x10AAAA) (test (char->integer (integer->char 5000)) 5000)) (else))` | `#\ß` | `&error` |
| larc base.sld | `(cond-expand (full-unicode (test (integer->char #xDF) #\xDF) (test (integer->char #x10AAAA) #\x10AAAA) (test (char->integer (integer->char 5000)) 5000)) (else))` | `#\􊪪` | `&error` |
| larc read.sld | `(test "\r\n\t\b\a\\|\"\\" (list->string (map integer->char '(13 10 9 8 7 124 34 92))))` | `"\r\n\t\b\u0007\|\"\\"` | `"\r\n\tba\|\"\\"` |

### MACRO-HYGIENE - 13 failures - category (a)

**Root cause:** syntax-rules hygiene / referential transparency defect

| suite | assertion (source text) | expected | actual |
|---|---|---|---|
| chibi L408 | `(test 'outer (let ((x 'outer)) (let-syntax ((m (syntax-rules () ((m) x)))) (let ((x 'inner)) (m)))))` | `outer` | `inner` |
| chibi L413 | `(test 7 (letrec-syntax ((my-or (syntax-rules () ((my-or) #f) ((my-or e) e) ((my-or e1 e2 ...) (let ((temp e1)) (if temp temp (my-or e2 ...))))))) (let ((x #f) (y 7) (temp 8) (let odd?) (if even?)) (my-or x (let temp) (if` | `7` | `RAISED: Cannot read properties of undefined (reading 'map')` |
| chibi L538 | `(test 'ok (let ((=> #f)) (cond (#t => 'ok))))` | `ok` | `RAISED: not a function: ok` |
| chibi L545 | `(test 1 x)` | `1` | `2` |
| chibi L555 | `(test 'x (bar 1))` | `x` | `1` |
| chibi L592 | `(test 'bound-identifier=? (m k))` | `bound-identifier=?` | `free-identifier=?` |
| larc base.sld | `(test (let ((x 'outer)) (let-syntax ((m (syntax-rules () ((m) x)))) (let ((x 'inner)) (m)))) 'outer)` | `outer` | `inner` |
| larc base.sld | `(test (let ((x 13)) (define y 14) (letrec-syntax ((def (syntax-rules () ((_ var val) (define var val))))) (def x 56) (set! y (+ x y))) (list x y)) '(13 70))` | `(13 70)` | `(56 70)` |
| larc base.sld | `(test (let-syntax ((m (syntax-rules () ((m x) (let-syntax ((n (syntax-rules (k) ((n x) 'bound-identifier=?) ((n y) 'free-identifier=?)))) (n z)))))) (m k)) 'bound-identifier=?)` | `bound-identifier=?` | `free-identifier=?` |
| larc base.sld | `(test (let ((f (lambda (x) (+ x 1)))) (let-syntax ((f (syntax-rules () ((f x) x))) (g (syntax-rules () ((g x) (f x))))) (list (f 1) (g 1)))) '(1 2))` | `(1 2)` | `(1 1)` |
| larc base.sld | `(test (let () (be-like-begin-alt sequence) (sequence 1 2 3 4)) 4)` | `4` | `&error` |
| larc base.sld | `(test (let ((=> #f)) (cond (#t => 'ok))) 'ok)` | `ok` | `&error` |
| larc base.sld | `(test (let ((... 19)) (define-syntax bar (syntax-rules () ((bar x y) (list y x ...)))) (bar 1 2)) '(2 1 19))` | `(2 1 19)` | `(2 1)` |

### IMPROPER - 9 failures - category (a)

**Root cause:** improper / circular list handling diverges

| suite | assertion (source text) | expected | actual |
|---|---|---|---|
| chibi L1113 | `(test #f (let ((x (list 'a))) (set-cdr! x x) (list? x)))` | `#f` | `RAISED: set-cdr!: the new tail leads back to this same list, which would make it circular. Motoi spells a proper list as a flat array and cannot hold a cycle, so this is refused rather than left half-done.` |
| chibi L1676 | `(test '(10 200 3000 40 500 6000) (let ((ls1 (list 10 100 1000)) (ls2 (list 1 2 3 4 5 6))) (set-cdr! (cddr ls1) ls1) (map * ls1 ls2)))` | `(10 200 3000 40 500 6000)` | `(10 200 3000)` |
| chibi L1720 | `(test 9750 (let ((ls1 (list 10 100 1000)) (ls2 (list 1 2 3 4 5 6)) (count 0)) (set-cdr! (cddr ls1) ls1) (for-each (lambda (x y) (set! count (+ count (* x y)))) ls2 ls1) count))` | `9750` | `3210` |
| chibi L2128 | `(test #t (and (member (let ((out (open-output-string)) (x (list 1))) (set-cdr! x x) (write x out) (get-output-string out)) ;; labels not guaranteed to be 0 indexed, spacing may differ '("#0=(1 . #0#)" "#1=(1 . #1#)")) #t` | `#t` | `RAISED: set-cdr!: the new tail leads back to this same list, which would make it circular. Motoi spells a proper list as a flat array and cannot hold a cycle, so this is refused rather than left half-done.` |
| larc base.sld | `(test (let ((x (list 'a 'b 'c 'a)) (y (list 'a 'b 'c 'a 'b 'c 'a))) (set-cdr! (list-tail x 2) x) (set-cdr! (list-tail y 5) y) (list (equal? x x) (equal? x y) (equal? (list x y 'a) (list y x 'b)))) '(#t #t #f))` | `(#t #t #f)` | `(#t #f #f)` |
| larc base.sld | `(test (let ((x (list 'a))) (set-cdr! x x) (list? x)) #f)` | `#f` | `&error` |
| larc base.sld | `(test (list-tail '(a b . c) 2) 'c)` | `c` | `&error` |
| larc base.sld | `(test (list-ref '(a b c . d) 2) 'c)` | `c` | `&error` |
| larc base.sld | `(test (list-ref '(a b c . d) (exact (round (/ 18 10)))) 'c)` | `c` | `&error` |

### EXN - 9 failures - category (a)

**Root cause:** exception-system semantics diverge (raise-continuable, guard re-raise, file-error?)

| suite | assertion (source text) | expected | actual |
|---|---|---|---|
| chibi L1792 | `(test 65 (with-exception-handler (lambda (con) 42) (lambda () (+ (raise-continuable "should be a number") 23))))` | `65` | `42` |
| chibi L1844 | `(test 'caught-another-exception (test-exception-handler-2 -1))` | `caught-another-exception` | `("exception:" an-error)` |
| chibi L1865 | `(test 65 value)` | `65` | `42` |
| chibi L1914 | `(test 42 (guard (condition ((assq 'a condition) => cdr) ((assq 'b condition))) (raise (list (cons 'a 42)))))` | `42` | `RAISED: unbound symbol: =>` |
| larc base.sld | `(test (guard (condition ((assq 'a condition) => cdr) ((assq 'b condition))) (raise (list (cons 'a 42)))) 42)` | `42` | `&error` |
| larc base.sld | `(let ((v '())) (test (guard (exn ((equal? exn 5) 'five)) ;; `guard' should jump back in before re-raising (guard (exn ((equal? exn 6) 'six)) (dynamic-wind (lambda () (set! v (cons 'in v))) (lambda () (raise 5)) (lambda (` | `(out in out in)` | `(out in)` |
| larc base.sld | `(let ((v '())) (test (guard (exn ((equal? exn 5) 'five)) ;; `guard' should jump back in before re-raising (guard (exn ((equal? exn 6) 'six)) (dynamic-wind (lambda () (set! v (cons 'in v))) (lambda () (raise 5)) (lambda (` | `(out in out in)` | `(out in)` |
| larc base.sld | `(test (let* ((q (open-output-string)) (x (call-with-current-continuation (lambda (k) (with-exception-handler (lambda (exn) (display "threw second exception\n" q) (k 'done)) (lambda () (with-exception-handler (lambda (x) ` | `(done "something went wrong\nthrew second exception\n")` | `( "something went wrong\n")` |
| larc base.sld | `(test (let* ((q (open-output-string)) (x (with-exception-handler (lambda (con) (cond ((string? con) (display con q)) (else (display "a warning has been issued" q))) 42) (lambda () (+ (raise-continuable "should be a numbe` | `(65 "should be a number")` | `(42 "should be a number")` |

### READ-DCOMM - 9 failures - category (a)

**Root cause:** `read` does not implement #; datum comments

| suite | assertion (source text) | expected | actual |
|---|---|---|---|
| chibi L2202 | `(test 'def (read (open-input-string "#; abc def")))` | `def` | `#` |
| chibi L2206 | `(test 'ghi (read (open-input-string "#; ; abc\n def ghi")))` | `ghi` | `#` |
| chibi L2207 | `(test '(abs -16) (read (open-input-string "(#;sqrt abs -16)")))` | `(abs -16)` | `RAISED: missing ) (line 1, col 1)` |
| chibi L2208 | `(test '(a d) (read (open-input-string "(a #; #;b c d)")))` | `(a d)` | `RAISED: missing ) (line 1, col 1)` |
| chibi L2209 | `(test '(a e) (read (open-input-string "(a #;(b #;c d) e)")))` | `(a e)` | `RAISED: missing ) (line 1, col 1)` |
| chibi L2210 | `(test '(a . c) (read (open-input-string "(a . #;b c)")))` | `(a . c)` | `RAISED: more than one form after . in pair (line 1, col 4)` |
| chibi L2211 | `(test '(a . b) (read (open-input-string "(a . b #;c)")))` | `(a . b)` | `RAISED: more than one form after . in pair (line 1, col 4)` |
| larc read.sld | `(test (read-data "1 #;2 3 #;(4 5) 6 #;(7 (8)) 9") '(1 3 6 9))` | `(1 3 6 9)` | `(1 #)` |
| larc read.sld | `(test (read-data "#\|yes; this is \|#a comment #\|\nbut;\r\n\|# this is #;too\rnot") '(a comment this is not))` | `(a comment this is not)` | `(#\|yes but \|# this is #)` |

### READ-STRESC - 9 failures - category (a)

**Root cause:** reader silently drops string escapes (\a \b \xHH; \<newline> continuation)

| suite | assertion (source text) | expected | actual |
|---|---|---|---|
| chibi L2242 | `(test "Hello" (read (open-input-string "\"H\\x65;llo\"")))` | `"Hello"` | `"Hx65;llo"` |
| chibi L2243 | `(test 7 (char->integer (string-ref (read (open-input-string "\"\\a\"")) 0)))` | `7` | `97` |
| chibi L2244 | `(test 8 (char->integer (string-ref (read (open-input-string "\"\\b\"")) 0)))` | `8` | `98` |
| chibi L2251 | `(test "line 1continued\n" (read (open-input-string "\"line 1\\\ncontinued\n\"")))` | `"line 1continued\n"` | `"line 1\ncontinued\n"` |
| chibi L2252 | `(test "line 1continued\n" (read (open-input-string "\"line 1\\ \ncontinued\n\"")))` | `"line 1continued\n"` | `"line 1 \ncontinued\n"` |
| chibi L2253 | `(test "line 1continued\n" (read (open-input-string "\"line 1\\\n continued\n\"")))` | `"line 1continued\n"` | `"line 1\n continued\n"` |
| chibi L2254 | `(test "line 1continued\n" (read (open-input-string "\"line 1\\ \t \n \t continued\n\"")))` | `"line 1continued\n"` | `"line 1 \t \n \t continued\n"` |
| chibi L2255 | `(test "line 1\n\nline 3\n" (read (open-input-string "\"line 1\\ \t \n \t \n\nline 3\n\"")))` | `"line 1\n\nline 3\n"` | `"line 1 \t \n \t \n\nline 3\n"` |
| larc read.sld | `(test (read-data "yes; this is a comment \nbut;\r\n this is;too\rnot") '(yes but this is not))` | `(yes but this is not)` | `(yes but this is)` |

### QUASIQUOTE - 8 failures - category (a)

**Root cause:** quasiquote defect (vectors, multi-operand unquote, nesting)

| suite | assertion (source text) | expected | actual |
|---|---|---|---|
| chibi L347 | `(test #(10 5 4 16 9 8) `#(10 5 ,(square 2) ,@(map square '(4 3)) 8))` | `#(10 5 4 16 9 8)` | `#(10 5 (unquote (square 2)) (unquote-splicing (map square (quote (4 3)))) 8)` |
| chibi L349 | `(test '(a `(b ,(+ 1 2) ,(foo 4 d) e) f) `(a `(b ,(+ 1 2) ,(foo ,(+ 1 3) d) e) f) )` | `(a (quasiquote (b (unquote (+ 1 2)) (unquote (foo 4 d)) e)) f)` | `RAISED: unbound symbol: foo` |
| larc base.sld | `(test `#(10 5 ,(- 4) ,@(map - '(16 9)) 8) '#(10 5 -4 -16 -9 8))` | `#(10 5 -4 -16 -9 8)` | `#(10 5 (unquote (- 4)) (unquote-splicing (map - (quote (16 9)))) 8)` |
| larc base.sld | `(test (let ((name 'foo)) `((unquote name name name))) '(foo foo foo))` | `(foo foo foo)` | `(foo)` |
| larc base.sld | `(test (let ((name '(foo))) `((unquote-splicing name name name))) '(foo foo foo))` | `(foo foo foo)` | `(foo)` |
| larc base.sld | `(test (let ((q '((append x y) (sqrt 9)))) ``(foo ,,@q)) '`(foo (unquote (append x y) (sqrt 9))))` | `(quasiquote (foo (unquote (append x y) (sqrt 9))))` | `&error` |
| larc base.sld | `(test (let ((x '(2 3)) (y '(4 5))) `(foo (unquote (append x y) (- 9)))) '(foo (2 3 4 5) -9))` | `(foo (2 3 4 5) -9)` | `(foo (2 3 4 5))` |
| larc base.sld | `(test `(a `(b ,(+ 1 2) ,(foo ,(+ 1 3) d) e) f) '(a `(b ,(+ 1 2) ,(foo 4 d) e) f))` | `(a (quasiquote (b (unquote (+ 1 2)) (unquote (foo 4 d)) e)) f)` | `&error` |

### BV-READER - 8 failures - category (a)

**Root cause:** the #u8 reader silently substitutes 0 for an element it cannot parse and wraps out-of-range ones

| suite | assertion (source text) | expected | actual |
|---|---|---|---|
| chibi L1626 | `(test "ABC" (utf8->string #u8(#x41 #x42 #x43)))` | `"ABC"` | `"\u0000\u0000\u0000"` |
| chibi L1627 | `(test "ABC" (utf8->string #u8(0 #x41 #x42 #x43) 1))` | `"ABC"` | `"\u0000\u0000\u0000"` |
| chibi L1628 | `(test "ABC" (utf8->string #u8(0 #x41 #x42 #x43 0) 1 4))` | `"ABC"` | `"\u0000\u0000\u0000"` |
| chibi L1629 | `(test "λ" (utf8->string #u8(0 #xCE #xBB 0) 1 3))` | `"λ"` | `"\u0000\u0000"` |
| chibi L1630 | `(test #u8(#x41 #x42 #x43) (string->utf8 "ABC"))` | `#u8(0 0 0)` | `#u8(65 66 67)` |
| chibi L1631 | `(test #u8(#x42 #x43) (string->utf8 "ABC" 1))` | `#u8(0 0)` | `#u8(66 67)` |
| chibi L1632 | `(test #u8(#x42) (string->utf8 "ABC" 1 2))` | `#u8(0)` | `#u8(66)` |
| chibi L1633 | `(test #u8(#xCE #xBB) (string->utf8 "λ"))` | `#u8(0 0)` | `#u8(206 187)` |

### READ-EXPMARK - 8 failures - category (a)

**Root cause:** reader does not accept the s/f/d/l exponent markers

| suite | assertion (source text) | expected | actual |
|---|---|---|---|
| chibi L2342 | `(test-numeric-syntax "1s2" 100.0 "100.0" "100.")` | `100` | `1s2` |
| chibi L2343 | `(test-numeric-syntax "1S2" 100.0 "100.0" "100.")` | `100` | `1S2` |
| chibi L2344 | `(test-numeric-syntax "1f2" 100.0 "100.0" "100.")` | `100` | `1f2` |
| chibi L2345 | `(test-numeric-syntax "1F2" 100.0 "100.0" "100.")` | `100` | `1F2` |
| chibi L2346 | `(test-numeric-syntax "1d2" 100.0 "100.0" "100.")` | `100` | `1d2` |
| chibi L2347 | `(test-numeric-syntax "1D2" 100.0 "100.0" "100.")` | `100` | `1D2` |
| chibi L2348 | `(test-numeric-syntax "1l2" 100.0 "100.0" "100.")` | `100` | `1l2` |
| chibi L2349 | `(test-numeric-syntax "1L2" 100.0 "100.0" "100.")` | `100` | `1L2` |

### RANGE-ARG - 6 failures - category (a)

**Root cause:** optional start/end arguments ignored

| suite | assertion (source text) | expected | actual |
|---|---|---|---|
| chibi L1507 | `(test '(dah didah) (vector->list '#(dah dah didah) 1))` | `(dah didah)` | `(dah dah didah)` |
| chibi L1508 | `(test '(dah) (vector->list '#(dah dah didah) 1 2))` | `(dah)` | `(dah dah didah)` |
| larc base.sld | `(test (vector->list '#(dah dah didah) 1) '(dah didah))` | `(dah didah)` | `(dah dah didah)` |
| larc base.sld | `(test (vector->list '#(dah dah didah) 1 2) '(dah))` | `(dah)` | `(dah dah didah)` |
| larc base.sld | `(let () (define a (vector 1 2 3 4 5)) (define b (vector 10 20 30 40 50)) (test/unspec (vector-copy! b 1 a 0 4)) (test b '#(10 1 2 3 4)) (test/unspec (vector-copy! b 2 b 1 4)) (test b '#(10 1 1 2 3)) (test/unspec (vector-` | `unspec` | `&error` |
| larc base.sld | `(let () (define a (vector 1 2 3 4 5)) (define b (vector 10 20 30 40 50)) (test/unspec (vector-copy! b 1 a 0 4)) (test b '#(10 1 2 3 4)) (test/unspec (vector-copy! b 2 b 1 4)) (test b '#(10 1 1 2 3)) (test/unspec (vector-` | `#(1 2 1 2 3)` | `#(1 2 3 4 5)` |

### WRITE-FLONUM - 6 failures - category (a)

**Root cause:** `write` prints an integral flonum without its decimal point (1.0 -> "1"), so output does not round-trip

| suite | assertion (source text) | expected | actual |
|---|---|---|---|
| chibi L2328 | `(test-numeric-syntax "1.0" 1.0 "1.0" "1.")` | `#t` | `#f` |
| chibi L2329 | `(test-numeric-syntax "1." 1.0 "1.0" "1.")` | `#t` | `#f` |
| chibi L2333 | `(test-numeric-syntax "-.0" -0.0 "-0." "-0.0" "0.0" "0." ".0")` | `#t` | `#f` |
| chibi L2334 | `(test-numeric-syntax "-0." -0.0 "-.0" "-0.0" "0.0" "0." ".0")` | `#t` | `#f` |
| chibi L2340 | `(test-numeric-syntax "1e2" 100.0 "100.0" "100.")` | `#t` | `#f` |
| chibi L2341 | `(test-numeric-syntax "1E2" 100.0 "100.0" "100.")` | `#t` | `#f` |

### READ-BOOL - 5 failures - category (a)

**Root cause:** reader does not accept the long boolean spellings #true / #false

| suite | assertion (source text) | expected | actual |
|---|---|---|---|
| chibi L2163 | `(test #t (read (open-input-string "#true")))` | `#t` | `#true` |
| chibi L2165 | `(test #f (read (open-input-string "#false")))` | `#f` | `#false` |
| chibi L2171 | `(test '(#t . 6) (read2 (open-input-string "#true 6 ")))` | `(#t . 6)` | `(#true . 6)` |
| chibi L2173 | `(test '(#f . "8") (read2 (open-input-string "#false\"8\"")))` | `(#f . "8")` | `(#false . "8")` |
| larc read.sld | `(test (read-data "#t #f #true #false #T #F #TRUE #FALSE #tRuE #False") '(#t #f #t #f #t #f #t #f #t #f))` | `(#t #f #t #f #t #f #t #f #t #f)` | `(#t #f #true #false #T #F #TRUE #FALSE #tRuE #False)` |

### EQV-MUT - 4 failures - category (a)

**Root cause:** eqv? conflates distinct freshly-allocated mutable objects

| suite | assertion (source text) | expected | actual |
|---|---|---|---|
| larc base.sld | `(test (eqv? (make-string 5 #\c) "ccccc") #f)` | `#f` | `#t` |
| larc base.sld | `(test (eqv? (string #\c #\b #\a) "cba") #f)` | `#f` | `#t` |
| larc base.sld | `(let ((s "apple")) (test (eq? s (string-copy s)) #f))` | `#f` | `#t` |
| larc base.sld | `(test (eqv? (string-copy "apple") "apple") #f)` | `#f` | `#t` |

### NUM-IEEE - 4 failures - category (a)

**Root cause:** inexact division by inexact zero raises instead of yielding +-inf.0 / +nan.0

| suite | assertion (source text) | expected | actual |
|---|---|---|---|
| larc inexact.sld | `(test (/ 0.0) +inf.0)` | `+inf.0` | `&error` |
| larc inexact.sld | `(test (/ -1 0.0) -inf.0)` | `-inf.0` | `&error` |
| larc inexact.sld | `(test (/ 0 0.0) +nan.0)` | `+nan.0` | `&error` |
| larc inexact.sld | `(test (/ 0.0 0.0) +nan.0)` | `+nan.0` | `&error` |

### READ-BCOMM - 3 failures - category (a)

**Root cause:** `read` does not implement #| |# block comments

| suite | assertion (source text) | expected | actual |
|---|---|---|---|
| chibi L2204 | `(test 'def (read (open-input-string "#\| abc \|# def")))` | `def` | `#\|` |
| chibi L2205 | `(test 'ghi (read (open-input-string "#\| abc #\| def \|# \|# ghi")))` | `ghi` | `#\|` |
| larc read.sld | `(test (read-data "and #\|they #\|nest\|# like\|# this") '(and this))` | `(and this)` | `(and #\|they #\|nest\|# like\|# this)` |

### READ-INFNAN - 3 failures - category (a)

**Root cause:** reader does not accept +inf.0/+nan.0 case-insensitively

| suite | assertion (source text) | expected | actual |
|---|---|---|---|
| chibi L2352 | `(test-numeric-syntax "+NAN.0" +nan.0 "+nan.0" "+NaN.0")` | `+nan.0` | `+NAN.0` |
| chibi L2354 | `(test-numeric-syntax "+InF.0" +inf.0 "+inf.0" "+Inf.0")` | `+inf.0` | `+InF.0` |
| chibi L2356 | `(test-numeric-syntax "-iNF.0" -inf.0 "-inf.0" "-Inf.0")` | `-inf.0` | `-iNF.0` |

### NUM-PRECISION - 3 failures - category (a)

**Root cause:** flonum printing does not round-trip subnormals

| suite | assertion (source text) | expected | actual |
|---|---|---|---|
| chibi L2464 | `(test-precision "4.940656458412465e-324" "4.94065645841247e-324" "5.0e-324" "0.0")` | `a-true-value` | `#f` |
| chibi L2465 | `(test-precision "9.881312916824931e-324" "9.88131291682493e-324" "1.0e-323" "0.0")` | `a-true-value` | `#f` |
| chibi L2467 | `(test-precision "1.976262583364986e-323" "1.97626258336499e-323" "2.0e-323" "0.0")` | `a-true-value` | `#f` |

### DELAY - 2 failures - category (a)

**Root cause:** force on a self-referential promise does not yield the memoized value

| suite | assertion (source text) | expected | actual |
|---|---|---|---|
| chibi L315 | `(test 6 (force p))` | `6` | `` |
| chibi L316 | `(test 6 (begin (set! x 10) (force p)))` | `6` | `` |

### DEFVALUES - 2 failures - category (a)

**Root cause:** define-values / let-values reject a dotted (rest-arg) formals list

| suite | assertion (source text) | expected | actual |
|---|---|---|---|
| chibi L658 | `(test 10 (let () (define-values (x y . z) (values 1 2 3 4)) (+ x y (car z) (cadr z))))` | `10` | `RAISED: let-values: malformed formals` |
| larc base.sld | `(test (let-values (((a b . c) (values 1 2 3 4))) (list a b c)) '(1 2 (3 4)))` | `(1 2 (3 4))` | `&error` |

### MACRO-PATTERN - 2 failures - category (a)

**Root cause:** syntax-rules pattern matching defect (dotted tails, _, literals)

| suite | assertion (source text) | expected | actual |
|---|---|---|---|
| larc base.sld | `(test (underscore-as-literal 5) 'other)` | `other` | `under` |
| larc base.sld | `(test (ellipses-as-literal ...) 'under)` | `under` | `other` |

### MUTABLE-STR - 49 failures - category (b)

**Root cause:** strings are immutable; string-set!/-fill!/-copy! absent

| suite | assertion (source text) | expected | actual |
|---|---|---|---|
| chibi L1320 | `(test "a-c" (let ((str (string #\a #\b #\c))) (string-set! str 1 #\-) str))` | `"a-c"` | `RAISED: unbound symbol: string-set!` |
| chibi L1322 | `(test (string #\a #\x1F700 #\c) (let ((s (string #\a #\b #\c))) (string-set! s 1 #\x1F700) s))` | `"a🜀c"` | `RAISED: unbound symbol: string-set!` |
| chibi L1456 | `(test "-----" (let ((str (make-string 5 #\x))) (string-fill! str #\-) str))` | `"-----"` | `RAISED: unbound symbol: string-fill!` |
| chibi L1458 | `(test "xx---" (let ((str (make-string 5 #\x))) (string-fill! str #\- 2) str))` | `"xx---"` | `RAISED: unbound symbol: string-fill!` |
| chibi L1460 | `(test "xx-xx" (let ((str (make-string 5 #\x))) (string-fill! str #\- 2 3) str))` | `"xx-xx"` | `RAISED: unbound symbol: string-fill!` |
| chibi L1463 | `(test "a12de" (let ((str (string-copy "abcde"))) (string-copy! str 1 "12345" 0 2) str))` | `"a12de"` | `RAISED: unbound symbol: string-copy!` |
| chibi L1465 | `(test "-----" (let ((str (make-string 5 #\x))) (string-copy! str 0 "-----") str))` | `"-----"` | `RAISED: unbound symbol: string-copy!` |
| chibi L1467 | `(test "---xx" (let ((str (make-string 5 #\x))) (string-copy! str 0 "-----" 2) str))` | `"---xx"` | `RAISED: unbound symbol: string-copy!` |
| chibi L1469 | `(test "xx---" (let ((str (make-string 5 #\x))) (string-copy! str 2 "-----" 0 3) str))` | `"xx---"` | `RAISED: unbound symbol: string-copy!` |
| chibi L1471 | `(test "xx-xx" (let ((str (make-string 5 #\x))) (string-copy! str 2 "-----" 2 3) str))` | `"xx-xx"` | `RAISED: unbound symbol: string-copy!` |
| chibi L1475 | `(test "aabde" (let ((str (string-copy "abcde"))) (string-copy! str 1 str 0 2) str))` | `"aabde"` | `RAISED: unbound symbol: string-copy!` |
| chibi L1477 | `(test "abcab" (let ((str (string-copy "abcde"))) (string-copy! str 3 str 0 2) str))` | `"abcab"` | `RAISED: unbound symbol: string-copy!` |
| larc base.sld | `(let () (define (f) (make-string 3 #\*)) (define (g) "***") (test/unspec (string-set! (f) 0 #\?)) ;(string-set! (g) 0 #\?) ; is an error ;(string-set! (symbol->string 'immutable) 0 #\?) ; is an error (let ((s (f))) (test` | `unspec` | `&error` |
| larc base.sld | `(let () (define (f) (make-string 3 #\*)) (define (g) "***") (test/unspec (string-set! (f) 0 #\?)) ;(string-set! (g) 0 #\?) ; is an error ;(string-set! (symbol->string 'immutable) 0 #\?) ; is an error (let ((s (f))) (test` | `unspec` | `&error` |
| larc base.sld | `(let () (define (f) (make-string 3 #\*)) (define (g) "***") (test/unspec (string-set! (f) 0 #\?)) ;(string-set! (g) 0 #\?) ; is an error ;(string-set! (symbol->string 'immutable) 0 #\?) ; is an error (let ((s (f))) (test` | `#\?` | `#\*` |
| larc base.sld | `(let ((s (make-string 6 #\!))) (test/unspec (string-copy! s 0 "apple")) (test s "apple!") (test/unspec (string-copy! s 2 "pears are nice too" 0 4)) (test s "appear") (test/unspec (string-copy! s 0 "blink" 1 4)) (test s "` | `unspec` | `&error` |
| larc base.sld | `(let ((s (make-string 6 #\!))) (test/unspec (string-copy! s 0 "apple")) (test s "apple!") (test/unspec (string-copy! s 2 "pears are nice too" 0 4)) (test s "appear") (test/unspec (string-copy! s 0 "blink" 1 4)) (test s "` | `"apple!"` | `"!!!!!!"` |
| larc base.sld | `(let ((s (make-string 6 #\!))) (test/unspec (string-copy! s 0 "apple")) (test s "apple!") (test/unspec (string-copy! s 2 "pears are nice too" 0 4)) (test s "appear") (test/unspec (string-copy! s 0 "blink" 1 4)) (test s "` | `unspec` | `&error` |
| larc base.sld | `(let ((s (make-string 6 #\!))) (test/unspec (string-copy! s 0 "apple")) (test s "apple!") (test/unspec (string-copy! s 2 "pears are nice too" 0 4)) (test s "appear") (test/unspec (string-copy! s 0 "blink" 1 4)) (test s "` | `"appear"` | `"!!!!!!"` |
| larc base.sld | `(let ((s (make-string 6 #\!))) (test/unspec (string-copy! s 0 "apple")) (test s "apple!") (test/unspec (string-copy! s 2 "pears are nice too" 0 4)) (test s "appear") (test/unspec (string-copy! s 0 "blink" 1 4)) (test s "` | `unspec` | `&error` |
| larc base.sld | `(let ((s (make-string 6 #\!))) (test/unspec (string-copy! s 0 "apple")) (test s "apple!") (test/unspec (string-copy! s 2 "pears are nice too" 0 4)) (test s "appear") (test/unspec (string-copy! s 0 "blink" 1 4)) (test s "` | `"linear"` | `"!!!!!!"` |
| larc base.sld | `(let ((s (make-string 6 #\!))) (test/unspec (string-copy! s 0 "apple")) (test s "apple!") (test/unspec (string-copy! s 2 "pears are nice too" 0 4)) (test s "appear") (test/unspec (string-copy! s 0 "blink" 1 4)) (test s "` | `unspec` | `&error` |
| larc base.sld | `(let ((s (make-string 6 #\!))) (test/unspec (string-copy! s 0 "apple")) (test s "apple!") (test/unspec (string-copy! s 2 "pears are nice too" 0 4)) (test s "appear") (test/unspec (string-copy! s 0 "blink" 1 4)) (test s "` | `"line  "` | `"!!!!!!"` |
| larc base.sld | `(let ((s (make-string 6 #\!))) (test/unspec (string-copy! s 0 "apple")) (test s "apple!") (test/unspec (string-copy! s 2 "pears are nice too" 0 4)) (test s "appear") (test/unspec (string-copy! s 0 "blink" 1 4)) (test s "` | `unspec` | `&error` |
| larc base.sld | `(let ((s (make-string 6 #\!))) (test/unspec (string-copy! s 0 "apple")) (test s "apple!") (test/unspec (string-copy! s 2 "pears are nice too" 0 4)) (test s "appear") (test/unspec (string-copy! s 0 "blink" 1 4)) (test s "` | `"list  "` | `"!!!!!!"` |
| larc base.sld | `(let ((s (make-string 6 #\!))) (test/unspec (string-copy! s 0 "apple")) (test s "apple!") (test/unspec (string-copy! s 2 "pears are nice too" 0 4)) (test s "appear") (test/unspec (string-copy! s 0 "blink" 1 4)) (test s "` | `unspec` | `&error` |
| larc base.sld | `(let ((s (make-string 6 #\!))) (test/unspec (string-copy! s 0 "apple")) (test s "apple!") (test/unspec (string-copy! s 2 "pears are nice too" 0 4)) (test s "appear") (test/unspec (string-copy! s 0 "blink" 1 4)) (test s "` | `"lilist"` | `"!!!!!!"` |
| larc base.sld | `(let ((s (make-string 6 #\!))) (test/unspec (string-copy! s 0 "apple")) (test s "apple!") (test/unspec (string-copy! s 2 "pears are nice too" 0 4)) (test s "appear") (test/unspec (string-copy! s 0 "blink" 1 4)) (test s "` | `unspec` | `&error` |
| larc base.sld | `(let ((s (make-string 6 #\!))) (test/unspec (string-copy! s 0 "apple")) (test s "apple!") (test/unspec (string-copy! s 2 "pears are nice too" 0 4)) (test s "appear") (test/unspec (string-copy! s 0 "blink" 1 4)) (test s "` | `"ilistt"` | `"!!!!!!"` |
| larc base.sld | `(let ((s (make-string 6 #\*))) (test/unspec (string-copy! s 0 "apple!")) (test s "apple!") (test/unspec (string-copy! s 2 "pears are nice too" 0 4)) (test s "appear") (test/unspec (string-copy! s 1 "fiction" 2)) (test s ` | `unspec` | `&error` |
| larc base.sld | `(let ((s (make-string 6 #\*))) (test/unspec (string-copy! s 0 "apple!")) (test s "apple!") (test/unspec (string-copy! s 2 "pears are nice too" 0 4)) (test s "appear") (test/unspec (string-copy! s 1 "fiction" 2)) (test s ` | `"apple!"` | `"******"` |
| larc base.sld | `(let ((s (make-string 6 #\*))) (test/unspec (string-copy! s 0 "apple!")) (test s "apple!") (test/unspec (string-copy! s 2 "pears are nice too" 0 4)) (test s "appear") (test/unspec (string-copy! s 1 "fiction" 2)) (test s ` | `unspec` | `&error` |
| larc base.sld | `(let ((s (make-string 6 #\*))) (test/unspec (string-copy! s 0 "apple!")) (test s "apple!") (test/unspec (string-copy! s 2 "pears are nice too" 0 4)) (test s "appear") (test/unspec (string-copy! s 1 "fiction" 2)) (test s ` | `"appear"` | `"******"` |
| larc base.sld | `(let ((s (make-string 6 #\*))) (test/unspec (string-copy! s 0 "apple!")) (test s "apple!") (test/unspec (string-copy! s 2 "pears are nice too" 0 4)) (test s "appear") (test/unspec (string-copy! s 1 "fiction" 2)) (test s ` | `unspec` | `&error` |
| larc base.sld | `(let ((s (make-string 6 #\*))) (test/unspec (string-copy! s 0 "apple!")) (test s "apple!") (test/unspec (string-copy! s 2 "pears are nice too" 0 4)) (test s "appear") (test/unspec (string-copy! s 1 "fiction" 2)) (test s ` | `"action"` | `"******"` |
| larc base.sld | `(let ((s (make-string 6 #\*))) (test/unspec (string-copy! s 0 "apple!")) (test s "apple!") (test/unspec (string-copy! s 2 "pears are nice too" 0 4)) (test s "appear") (test/unspec (string-copy! s 1 "fiction" 2)) (test s ` | `unspec` | `&error` |
| larc base.sld | `(let ((s (make-string 6 #\*))) (test/unspec (string-copy! s 0 "apple!")) (test s "apple!") (test/unspec (string-copy! s 2 "pears are nice too" 0 4)) (test s "appear") (test/unspec (string-copy! s 1 "fiction" 2)) (test s ` | `"active"` | `"******"` |
| larc base.sld | `(let ((s (make-string 6 #\*))) (test/unspec (string-copy! s 0 "apple!")) (test s "apple!") (test/unspec (string-copy! s 2 "pears are nice too" 0 4)) (test s "appear") (test/unspec (string-copy! s 1 "fiction" 2)) (test s ` | `unspec` | `&error` |
| larc base.sld | `(let ((s (make-string 6 #\*))) (test/unspec (string-copy! s 0 "apple!")) (test s "apple!") (test/unspec (string-copy! s 2 "pears are nice too" 0 4)) (test s "appear") (test/unspec (string-copy! s 1 "fiction" 2)) (test s ` | `"aactiv"` | `"******"` |
| larc base.sld | `(let ((s (make-string 6 #\!))) (test/unspec (string-fill! s #\space)) (test s " ") (test/unspec (string-fill! s #\o 2)) (test s " oooo") (test/unspec (string-fill! s #\k 3)) (test s " okkk") (test/unspec (string-fill! s ` | `unspec` | `&error` |
| larc base.sld | `(let ((s (make-string 6 #\!))) (test/unspec (string-fill! s #\space)) (test s " ") (test/unspec (string-fill! s #\o 2)) (test s " oooo") (test/unspec (string-fill! s #\k 3)) (test s " okkk") (test/unspec (string-fill! s ` | `"      "` | `"!!!!!!"` |
| larc base.sld | `(let ((s (make-string 6 #\!))) (test/unspec (string-fill! s #\space)) (test s " ") (test/unspec (string-fill! s #\o 2)) (test s " oooo") (test/unspec (string-fill! s #\k 3)) (test s " okkk") (test/unspec (string-fill! s ` | `unspec` | `&error` |
| larc base.sld | `(let ((s (make-string 6 #\!))) (test/unspec (string-fill! s #\space)) (test s " ") (test/unspec (string-fill! s #\o 2)) (test s " oooo") (test/unspec (string-fill! s #\k 3)) (test s " okkk") (test/unspec (string-fill! s ` | `"  oooo"` | `"!!!!!!"` |
| larc base.sld | `(let ((s (make-string 6 #\!))) (test/unspec (string-fill! s #\space)) (test s " ") (test/unspec (string-fill! s #\o 2)) (test s " oooo") (test/unspec (string-fill! s #\k 3)) (test s " okkk") (test/unspec (string-fill! s ` | `unspec` | `&error` |
| larc base.sld | `(let ((s (make-string 6 #\!))) (test/unspec (string-fill! s #\space)) (test s " ") (test/unspec (string-fill! s #\o 2)) (test s " oooo") (test/unspec (string-fill! s #\k 3)) (test s " okkk") (test/unspec (string-fill! s ` | `"  okkk"` | `"!!!!!!"` |
| larc base.sld | `(let ((s (make-string 6 #\!))) (test/unspec (string-fill! s #\space)) (test s " ") (test/unspec (string-fill! s #\o 2)) (test s " oooo") (test/unspec (string-fill! s #\k 3)) (test s " okkk") (test/unspec (string-fill! s ` | `unspec` | `&error` |
| larc base.sld | `(let ((s (make-string 6 #\!))) (test/unspec (string-fill! s #\space)) (test s " ") (test/unspec (string-fill! s #\o 2)) (test s " oooo") (test/unspec (string-fill! s #\k 3)) (test s " okkk") (test/unspec (string-fill! s ` | `"  ok  "` | `"!!!!!!"` |
| larc base.sld | `(let ((s (make-string 6 #\!))) (test/unspec (string-fill! s #\space)) (test s " ") (test/unspec (string-fill! s #\o 2)) (test s " oooo") (test/unspec (string-fill! s #\k 3)) (test s " okkk") (test/unspec (string-fill! s ` | `unspec` | `&error` |
| larc base.sld | `(let ((s (make-string 6 #\!))) (test/unspec (string-fill! s #\space)) (test s " ") (test/unspec (string-fill! s #\o 2)) (test s " oooo") (test/unspec (string-fill! s #\k 3)) (test s " okkk") (test/unspec (string-fill! s ` | `"  ok! "` | `"!!!!!!"` |

### PORT - 22 failures - category (b)

**Root cause:** port procedure absent or diverges

| suite | assertion (source text) | expected | actual |
|---|---|---|---|
| chibi L2075 | `(test #t (eof-object? (read-bytevector 3 (open-input-bytevector #u8()))))` | `#t` | `RAISED: unbound symbol: read-bytevector` |
| chibi L2077 | `(test #u8(1) (read-bytevector 3 (open-input-bytevector #u8(1))))` | `#u8(1)` | `RAISED: unbound symbol: read-bytevector` |
| chibi L2078 | `(test #u8(1 2) (read-bytevector 3 (open-input-bytevector #u8(1 2))))` | `#u8(1 2)` | `RAISED: unbound symbol: read-bytevector` |
| chibi L2079 | `(test #u8(1 2 3) (read-bytevector 3 (open-input-bytevector #u8(1 2 3))))` | `#u8(1 2 3)` | `RAISED: unbound symbol: read-bytevector` |
| chibi L2080 | `(test #u8(1 2 3) (read-bytevector 3 (open-input-bytevector #u8(1 2 3 4))))` | `#u8(1 2 3)` | `RAISED: unbound symbol: read-bytevector` |
| chibi L2082 | `(test #t (let ((bv (bytevector 1 2 3 4 5))) (eof-object? (read-bytevector! bv (open-input-bytevector #u8())))))` | `#t` | `RAISED: unbound symbol: read-bytevector!` |
| chibi L2086 | `(test #u8(6 7 8 9 10) (let ((bv (bytevector 1 2 3 4 5))) (read-bytevector! bv (open-input-bytevector #u8(6 7 8 9 10)) 0 5) bv))` | `#u8(6 7 8 9 10)` | `RAISED: unbound symbol: read-bytevector!` |
| chibi L2091 | `(test #u8(6 7 8 4 5) (let ((bv (bytevector 1 2 3 4 5))) (read-bytevector! bv (open-input-bytevector #u8(6 7 8 9 10)) 0 3) bv))` | `#u8(6 7 8 4 5)` | `RAISED: unbound symbol: read-bytevector!` |
| chibi L2096 | `(test #u8(1 2 3 6 5) (let ((bv (bytevector 1 2 3 4 5))) (read-bytevector! bv (open-input-bytevector #u8(6 7 8 9 10)) 3 4) bv))` | `#u8(1 2 3 6 5)` | `RAISED: unbound symbol: read-bytevector!` |
| chibi L2108 | `(test #u8(1 2 3 4 5) (let ((out (open-output-bytevector))) (write-bytevector #u8(1 2 3 4 5) out) (get-output-bytevector out)))` | `#u8(1 2 3 4 5)` | `RAISED: unbound symbol: write-bytevector` |
| chibi L2113 | `(test #u8(3 4 5) (let ((out (open-output-bytevector))) (write-bytevector #u8(1 2 3 4 5) out 2) (get-output-bytevector out)))` | `#u8(3 4 5)` | `RAISED: unbound symbol: write-bytevector` |
| chibi L2118 | `(test #u8(3 4) (let ((out (open-output-bytevector))) (write-bytevector #u8(1 2 3 4 5) out 2 4) (get-output-bytevector out)))` | `#u8(3 4)` | `RAISED: unbound symbol: write-bytevector` |
| larc base.sld | `(test (call-with-port (open-input-string "Do you read this?") read-line) "Do you read this?")` | `"Do you read this?"` | `&error` |
| larc base.sld | `(test (map (lambda (s) (call-with-port (open-input-string s) read-line)) '("abc\ndef" "abc\rdef" "abc\r\ndef")) '("abc" "abc" "abc"))` | `("abc" "abc" "abc")` | `&error` |
| larc base.sld | `(test (call-with-port (open-output-string) (lambda (p) (write-string "No, but I can write." p) (get-output-string p))) "No, but I can write.")` | `"No, but I can write."` | `&error` |
| larc base.sld | `(test (call-with-port (open-output-string) (lambda (p) (write-string "No, but I can write." p 4) (get-output-string p))) "but I can write.")` | `"but I can write."` | `&error` |
| larc base.sld | `(test (call-with-port (open-output-string) (lambda (p) (write-string "No, but I can write." p 4 13) (get-output-string p))) "but I can")` | `"but I can"` | `&error` |
| larc base.sld | `(test (call-with-port (open-input-bytevector '#u8(115 111 109 101 32 98 121 116 101 115)) (lambda (p) (read-bytevector 9 p))) '#u8(115 111 109 101 32 98 121 116 101))` | `#u8(115 111 109 101 32 98 121 116 101)` | `&error` |
| larc base.sld | `(test (call-with-port (open-output-bytevector) (lambda (p) (write-bytevector '#u8(115 111 109 101) p) (write-bytevector '#u8(98 121 116 101 115) p) (get-output-bytevector p))) '#u8(115 111 109 101 98 121 116 101 115))` | `#u8(115 111 109 101 98 121 116 101 115)` | `&error` |
| larc base.sld | `(test (call-with-port (open-output-bytevector) (lambda (p) (write-bytevector '#u8(115 111 109 101) p 2) (write-bytevector '#u8(98 121 116 101 115) p 1 4) (get-output-bytevector p))) '#u8(109 101 121 116 101))` | `#u8(109 101 121 116 101)` | `&error` |
| larc base.sld | `(test (call-with-port (open-output-string) (lambda (hesse) (test/unspec (write-string "Du kannst reiten und fahren" hesse)) (test/unspec (flush-output-port hesse)) (test (get-output-string hesse) "Du kannst reiten und fa` | `"Du kannst reiten und fahren, zu zweien und zu dreien...\nDen letzten Schritt musst du gehen allein.\n"` | `&error` |
| larc base.sld | `(test (call-with-port (open-output-bytevector) (lambda (melville) (test/unspec (write-bytevector '#u8(67 97 108 108 32 109 101) melville)) (test/unspec (write-u8 32 melville)) (flush-output-port melville) (test/unspec (w` | `"Call me Ishmael."` | `&error` |

### TOWER-RATIO - 11 failures - category (b)

**Root cause:** exact rationals unimplemented (R7RS-small permits a subset); ratios collapse to flonums

| suite | assertion (source text) | expected | actual |
|---|---|---|---|
| chibi L202 | `(test 1800/497 c)` | `1800/497` | `3.6217303822937628` |
| chibi L904 | `(test 3/20 (/ 3 4 5))` | `3/20` | `0.15` |
| chibi L905 | `(test 1/3 (/ 3))` | `1/3` | `0.3333333333333333` |
| chibi L947 | `(test 3 (numerator (/ 6 4)))` | `3` | `1.5` |
| chibi L948 | `(test 2 (denominator (/ 6 4)))` | `2` | `1` |
| chibi L950 | `(test 11.0 (numerator 5.5))` | `11` | `5.5` |
| chibi L951 | `(test 2.0 (denominator 5.5))` | `2` | `1` |
| larc base.sld | `(test (vector-map (lambda (x y f) (f (- x y))) '#(3 4 5) '#(0 -1 2) (vector - * /)) '#(-3 5 1/3))` | `#(-3 5 1/3)` | `#(-3 5 0.3333333333333333)` |
| larc inexact.sld | `(test (rationalize +inf.0 3) +inf.0)` | `+inf.0` | `&error` |
| larc inexact.sld | `(test (rationalize +inf.0 +inf.0) +nan.0)` | `+nan.0` | `&error` |
| larc inexact.sld | `(test (rationalize 3 +inf.0) 0.0)` | `0` | `&error` |

### READ-LABEL - 6 failures - category (b)

**Root cause:** datum labels #n= / #n# unimplemented

| suite | assertion (source text) | expected | actual |
|---|---|---|---|
| chibi L2180 | `(test '1 (cadr (read (open-input-string "#0=(1 . #0#)"))))` | `1` | `RAISED: cadr: expected a pair or a non-empty list, got the symbol #0=` |
| larc base.sld | `(test (equal? '#1=(a b . #1#) '#2=(a b a b . #2#)) #t)` | `#t` | `#f` |
| larc read.sld | `(test (read-datum "#125=#(#213=(1 2 #125# 4 . #213#) (#125#) #213#)") (let* ((x (list 1 2 3 4 5)) (v (vector x x x))) (set-car! (cddr x) v) (set-cdr! (cdr (cdr (cdr x))) x) (vector-set! v 1 (list v)) v))` | `#0=#((1 2 3 4 5) (#0#) (1 2 3 4 5))` | `#125=#` |
| larc read.sld | `(test (read-datum "(#0=#1=(a) #0#)") '((a) (a)))` | `((a) (a))` | `(#0=#1= (a) #0#)` |
| larc write.sld | `(test (read-from-string (write-datum write (let* ((x (list 1 2 3 4 5)) (v (vector x x x))) (set-car! (cddr x) v) (set-cdr! (cdr (cdr (cdr x))) x) (vector-set! v 1 (list v)) v))) (let* ((x (list 1 2 3 4 5)) (v (vector x x` | `#0=#((1 2 3 4 5) (#0#) (1 2 3 4 5))` | `#t` |
| larc write.sld | `(test (read-from-string (write-datum write-shared (let* ((x (list 1 2 3 4 5)) (v (vector x x x))) (set-car! (cddr x) v) (set-cdr! (cdr (cdr (cdr x))) x) (vector-set! v 1 (list v)) v))) (let* ((x (list 1 2 3 4 5)) (v (vec` | `#0=#((1 2 3 4 5) (#0#) (1 2 3 4 5))` | `#t` |

### TOWER-BIGNUM - 5 failures - category (b)

**Root cause:** bignums unimplemented (R7RS-small permits a subset)

| suite | assertion (source text) | expected | actual |
|---|---|---|---|
| chibi L211 | `(test '(1518500249 3000631951) (let*-values (((root rem) (exact-integer-sqrt (expt 2 61)))) (list root rem)))` | `(1518500249 3000631951)` | `(1518500249 3000632064)` |
| chibi L215 | `(test '(815238614083298888 443242361398135744) (let*-values (((root rem) (exact-integer-sqrt (expt 2 119)))) (list root rem)))` | `(815238614083299000 443242361398135740)` | `(815238614083299000 -147573952589676410000)` |
| chibi L223 | `(test '(1630477228166597776 1772969445592542976) (let*-values (((root rem) (exact-integer-sqrt (expt 2 121)))) (list root rem)))` | `(1630477228166598000 1772969445592543000)` | `(1630477228166598000 -590295810358705700000)` |
| chibi L227 | `(test '(31622776601683793319 62545769258890964239) (let*-values (((root rem) (exact-integer-sqrt (expt 10 39)))) (list root rem)))` | `(31622776601683790000 62545769258890960000)` | `(31622776601683790000 0)` |
| chibi L811 | `(test #f (= 9007199254740992.0 9007199254740993))` | `#f` | `#t` |

### MACRO-ELLIPSIS - 5 failures - category (b)

**Root cause:** custom ellipsis `(syntax-rules E () ...)` and the `(... ...)` escape unimplemented

| suite | assertion (source text) | expected | actual |
|---|---|---|---|
| chibi L450 | `(test 4 (sequence2 1 2 3 4))` | `4` | `RAISED: unbound symbol: sequence2` |
| chibi L460 | `(test 5 (sequence3 2 3 4 5))` | `5` | `RAISED: unbound symbol: sequence3` |
| chibi L472 | `(test '... (elli-esc-1))` | `...` | `(...)` |
| chibi L473 | `(test '(100 ...) (elli-esc-1 100))` | `(100 ...)` | `(... (100))` |
| chibi L474 | `(test '(... 100 200) (elli-esc-1 100 200))` | `(... 100 200)` | `(... (... 100 200))` |

### UNBOUND - 5 failures - category (b)

**Root cause:** required R7RS-small binding is absent

| suite | assertion (source text) | expected | actual |
|---|---|---|---|
| chibi L991 | `(test 0.0 (inexact (asin 0)))` | `0` | `RAISED: unbound symbol: asin` |
| chibi L992 | `(test 1.5707963267949 (asin 1))` | `1.5707963267949` | `RAISED: unbound symbol: asin` |
| chibi L993 | `(test 0.0 (inexact (acos 1)))` | `0` | `RAISED: unbound symbol: acos` |
| chibi L994 | `(test 3.14159265358979 (acos -1))` | `3.14159265358979` | `RAISED: unbound symbol: acos` |
| chibi L1496 | `(test 13 (vector-ref '#(1 1 2 3 5 8 13 21) (let ((i (round (* 2 (acos -1))))) (if (inexact? i) (exact i) i))))` | `13` | `RAISED: unbound symbol: acos` |

### FILE - 4 failures - category (b)

**Root cause:** (scheme file) absent - Motoi has no file I/O

| suite | assertion (source text) | expected | actual |
|---|---|---|---|
| chibi L1808 | `(test #t (file-error? (guard (exn (else exn)) (open-input-file " no such file "))))` | `#t` | `#f` |
| chibi L2507 | `(test #t (file-exists? "."))` | `#t` | `RAISED: unbound symbol: file-exists?` |
| chibi L2508 | `(test #f (file-exists? " no such file "))` | `#f` | `RAISED: unbound symbol: file-exists?` |
| chibi L2510 | `(test #t (file-error? (guard (exn (else exn)) (delete-file " no such file "))))` | `#t` | `#f` |

### ENVEVAL - 4 failures - category (b)

**Root cause:** (scheme eval) environment procedures absent

| suite | assertion (source text) | expected | actual |
|---|---|---|---|
| chibi L1944 | `(test 20 (let ((f (eval '(lambda (f x) (f x x)) (null-environment 5)))) (f + 10)))` | `20` | `RAISED: unbound symbol: null-environment` |
| chibi L1948 | `(test 1024 (eval '(expt 2 10) (environment '(scheme base))))` | `1024` | `RAISED: unbound symbol: environment` |
| chibi L1950 | `(test 0.0 (inexact (eval '(sin 0) (environment '(scheme inexact)))))` | `0` | `RAISED: unbound symbol: environment` |
| chibi L1952 | `(test 1024.0 (eval '(+ (expt 2 10) (inexact (sin 0))) (environment '(scheme base) '(scheme inexact))))` | `1024` | `RAISED: unbound symbol: environment` |

### INCLUDE - 3 failures - category (b)

**Root cause:** `include` / `include-ci` unimplemented (R7RS-small 5.7)

| suite | assertion (source text) | expected | actual |
|---|---|---|---|
| larc base.sld | `(test (fact 6) 720)` | `720` | `&error` |
| larc base.sld | `(test (fib 10) 55)` | `55` | `&error` |
| larc base.sld | `(test bd578d6d 319)` | `319` | `&error` |

### CONT - 2 failures - category (b)

**Root cause:** re-entrant continuations / dynamic-wind re-entry unsupported

| suite | assertion (source text) | expected | actual |
|---|---|---|---|
| chibi L1770 | `(test '(connect talk1 disconnect connect talk2 disconnect) (let ((path '()) (c #f)) (let ((add (lambda (s) (set! path (cons s path))))) (dynamic-wind (lambda () (add 'connect)) (lambda () (add (call-with-current-continua` | `(connect talk1 disconnect connect talk2 disconnect)` | `RAISED: [object Object]` |
| larc base.sld | `(test (let ((path '()) (c #f)) (let ((add (lambda (s) (set! path (cons s path))))) (dynamic-wind (lambda () (add 'connect)) (lambda () (add (call-with-current-continuation (lambda (c0) (set! c c0) 'talk1)))) (lambda () (` | `(connect talk1 disconnect connect talk2 disconnect)` | `&error` |

### READ-FOLD - 2 failures - category (b)

**Root cause:** #!fold-case / #!no-fold-case directives unimplemented

| suite | assertion (source text) | expected | actual |
|---|---|---|---|
| chibi L2199 | `(test 'abc (read (open-input-string "#!fold-case ABC")))` | `abc` | `#!fold-case` |
| chibi L2200 | `(test 'ABC (read (open-input-string "#!fold-case #!no-fold-case ABC")))` | `ABC` | `#!fold-case` |

### TOWER-COMPLEX - 42 failures - category (c)

**Root cause:** optional complex tower (R7RS-small permits a subset) - NOT counted against Motoi

| suite | assertion (source text) | expected | actual |
|---|---|---|---|
| chibi L756 | `(test #t (complex? 3+4i))` | `#t` | `RAISED: unbound symbol: 3+4i` |
| chibi L759 | `(test #t (real? -2.5+0i))` | `#t` | `RAISED: unbound symbol: -2.5+0i` |
| chibi L760 | `(test #f (real? -2.5+0.0i))` | `#f` | `RAISED: unbound symbol: -2.5+0.0i` |
| chibi L770 | `(test #t (integer? 3+0i))` | `#t` | `RAISED: unbound symbol: 3+0i` |
| chibi L784 | `(test #f (finite? 3.0+inf.0i))` | `#f` | `RAISED: unbound symbol: 3.0+inf.0i` |
| chibi L789 | `(test #t (infinite? 3.0+inf.0i))` | `#t` | `RAISED: unbound symbol: 3.0+inf.0i` |
| chibi L794 | `(test #f (nan? 1+2i))` | `#f` | `RAISED: unbound symbol: 1+2i` |
| chibi L796 | `(test #t (= 1 1.0 1.0+0.0i))` | `#t` | `RAISED: unbound symbol: 1.0+0.0i` |
| chibi L797 | `(test #f (= 1.0 1.0+1.0i))` | `#f` | `RAISED: unbound symbol: 1.0+1.0i` |
| chibi L849 | `(test #t (zero? 0.0+0.0i))` | `#t` | `RAISED: unbound symbol: 0.0+0.0i` |
| chibi L903 | `(test -3/2-i (- 3/2+i))` | `RAISED: unbound symbol: -3/2-i` | `RAISED: unbound symbol: 3/2+i` |
| chibi L1016 | `(test 0.0+1.0i (inexact (sqrt -1)))` | `RAISED: unbound symbol: 0.0+1.0i` | `RAISED: sqrt: -1 has no real square root; use (make-rectangular 0 (sqrt 1)) for the complex one` |
| chibi L1017 | `(test 0.0+1.0i (sqrt -1.0-0.0i))` | `RAISED: unbound symbol: 0.0+1.0i` | `RAISED: unbound symbol: -1.0-0.0i` |
| chibi L1028 | `(test 1+2i (make-rectangular 1 2))` | `RAISED: unbound symbol: 1+2i` | `1+2i` |
| chibi L1030 | `(test 0.54030230586814+0.841470984807897i (make-polar 1 1))` | `RAISED: unbound symbol: 0.54030230586814+0.841470984807897i` | `0.5403023058681398+0.8414709848078965i` |
| chibi L1032 | `(test 1 (real-part 1+2i))` | `1` | `RAISED: unbound symbol: 1+2i` |
| chibi L1034 | `(test 2 (imag-part 1+2i))` | `2` | `RAISED: unbound symbol: 1+2i` |
| chibi L1036 | `(test 2.23606797749979 (magnitude 1+2i))` | `2.23606797749979` | `RAISED: unbound symbol: 1+2i` |
| chibi L1038 | `(test 1.10714871779409 (angle 1+2i))` | `1.10714871779409` | `RAISED: unbound symbol: 1+2i` |
| chibi L2370 | `(test-numeric-syntax "1+2I" (make-rectangular 1 2) "1+2i")` | `1+2i` | `1+2I` |
| chibi L2374 | `(test-numeric-syntax "+i" (make-rectangular 0 1) "+i" "+1i" "0+i" "0+1i")` | `i` | `+i` |
| chibi L2375 | `(test-numeric-syntax "0+i" (make-rectangular 0 1) "+i" "+1i" "0+i" "0+1i")` | `i` | `0+i` |
| chibi L2376 | `(test-numeric-syntax "0+1i" (make-rectangular 0 1) "+i" "+1i" "0+i" "0+1i")` | `i` | `0+1i` |
| chibi L2378 | `(test-numeric-syntax "0-i" (make-rectangular 0 -1) "-i" "-1i" "0-i" "0-1i")` | `-i` | `0-i` |
| chibi L2379 | `(test-numeric-syntax "0-1i" (make-rectangular 0 -1) "-i" "-1i" "0-i" "0-1i")` | `-i` | `0-1i` |
| chibi L2380 | `(test-numeric-syntax "+2i" (make-rectangular 0 2) "2i" "+2i" "0+2i")` | `2i` | `+2i` |
| chibi L2383 | `(test-numeric-syntax "1.0+2i" (make-rectangular 1.0 2) "1.0+2.0i" "1.0+2i" "1.+2i" "1.+2.i")` | `1+2i` | `1.0+2i` |
| chibi L2384 | `(test-numeric-syntax "1+2.0i" (make-rectangular 1 2.0) "1.0+2.0i" "1+2.0i" "1.+2.i" "1+2.i")` | `1+2i` | `1+2.0i` |
| chibi L2385 | `(test-numeric-syntax "1e2+1.0i" (make-rectangular 100.0 1.0) "100.0+1.0i" "100.+1.i")` | `100+i` | `1e2+1.0i` |
| chibi L2386 | `(test-numeric-syntax "1s2+1.0i" (make-rectangular 100.0 1.0) "100.0+1.0i" "100.+1.i")` | `100+i` | `1s2+1.0i` |
| chibi L2387 | `(test-numeric-syntax "1.0+1e2i" (make-rectangular 1.0 100.0) "1.0+100.0i" "1.+100.i")` | `1+100i` | `1.0+1e2i` |
| chibi L2388 | `(test-numeric-syntax "1.0+1s2i" (make-rectangular 1.0 100.0) "1.0+100.0i" "1.+100.i")` | `1+100i` | `1.0+1s2i` |
| chibi L2390 | `(test-numeric-syntax "1/2+3/4i" (make-rectangular (/ 1 2) (/ 3 4)))` | `0.5+0.75i` | `1/2+3/4i` |
| chibi L2392 | `(test-numeric-syntax "0.5+3/4i" (make-rectangular 0.5 (/ 3 4)) "0.5+0.75i" ".5+.75i" "0.5+3/4i" ".5+3/4i" "500.0e-3+750.0e-3i")` | `0.5+0.75i` | `0.5+3/4i` |
| chibi L2396 | `(test-numeric-syntax "+inf.0+inf.0i" (make-rectangular +inf.0 +inf.0) "+Inf.0+Inf.0i")` | `Infinity+Infinityi` | `+inf.0+inf.0i` |
| chibi L2397 | `(test-numeric-syntax "-inf.0+inf.0i" (make-rectangular -inf.0 +inf.0) "-Inf.0+Inf.0i")` | `-Infinity+Infinityi` | `-inf.0+inf.0i` |
| chibi L2398 | `(test-numeric-syntax "-inf.0-inf.0i" (make-rectangular -inf.0 -inf.0) "-Inf.0-Inf.0i")` | `-Infinity-Infinityi` | `-inf.0-inf.0i` |
| chibi L2399 | `(test-numeric-syntax "+inf.0-inf.0i" (make-rectangular +inf.0 -inf.0) "+Inf.0-Inf.0i")` | `Infinity-Infinityi` | `+inf.0-inf.0i` |
| chibi L2439 | `(test-numeric-syntax "#d1.0+1.0i" (make-rectangular 1.0 1.0) "1.0+1.0i" "1.+1.i")` | `1+i` | `#d1.0+1.0i` |
| chibi L2440 | `(test-numeric-syntax "#d10+11i" (make-rectangular 10 11) "10+11i")` | `10+11i` | `#d10+11i` |
| larc inexact.sld | `(test (real? -2.5+0.0i) #f)` | `#f` | `&error` |
| larc inexact.sld | `(test (real? -2.5+0i) #t)` | `#t` | `&error` |

### NUM-DIVEXACT0 - 2 failures - category (c)

**Root cause:** R7RS-small says `(/ x 0)` with an EXACT zero divisor `is an error`; Larceny's +-inf.0 is an extension

| suite | assertion (source text) | expected | actual |
|---|---|---|---|
| larc inexact.sld | `(test (/ 1.0 0) +inf.0)` | `+inf.0` | `&error` |
| larc inexact.sld | `(test (/ 0.0 0) +nan.0)` | `+nan.0` | `&error` |

### HARNESS - 1 failures - category (c)

**Root cause:** measurement artifact - the assertion's subject behaved correctly

| suite | assertion (source text) | expected | actual |
|---|---|---|---|
| larc base.sld | `(test/output/unspec (begin (display "4 plus 1 equals ") (display (+ 4 1))) "4 plus 1 equals 5")` | `"4 plus 1 equals 5"` | `"4 plus 1 equals 5\n@@T (begin (begin (display \"4 plus 1 equals \") (display (+ 4 1))) (quote unspec))\n@@X ok unspec\n@@A ok unspec\n@@R PASS\n"` |
