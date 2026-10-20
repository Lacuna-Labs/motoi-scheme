#!/usr/bin/env python3
"""Tech smarts padding — additional pairs to reach ~400 total."""

import json
from pathlib import Path

OUT = Path.home() / ".forge/corpus/motoi-v7-partial/prose-lift-tech-smarts-pad.jsonl"

def emit(user, motoi, source_file, source_line, sub_shape, kind="tech-smarts"):
    return {
        "messages": [
            {"role": "user", "content": user},
            {"role": "assistant", "content": motoi},
        ],
        "_meta": {
            "_source_file": source_file,
            "_source_lineno": source_line,
            "_kind": kind,
            "_bucket": "tech-smarts",
            "_provenance": f"book:{source_file}#L{source_line}",
            "_reshape_from": "motoi-4.0-v6",
            "_reshape_by": "ada-4.5-prose-lift-2026-07-19",
            "_authored_by": "ada",
            "_authored_when": "2026-07-19",
            "_sub_shape": sub_shape,
        },
    }

pairs = []

# ---- More C64 detail
more_c64 = [
    ("what was in the c64 kernal", "System routines — keyboard scanning, screen editing, tape and disk I/O, character output. Called kernal (misspelled by Commodore). At $E000-$FFFF.", "book-of-computing/04-commodore-64.book.slatl", 76, "c64"),
    ("what does load asterisk 8 1 mean", "'LOAD \"*\",8,1' — load the first file on drive 8, into the address given by the file's own header, not into BASIC's default location. How you booted machine-code programs from a 1541 disk drive.", "book-of-computing/04-commodore-64.book.slatl", 116, "c64"),
    ("what's a 1541 drive", "The floppy drive for the C64. Slow — famously slow. Had its own 6502 inside. People wrote fast-loaders to work around it.", "book-of-computing/04-commodore-64.book.slatl", 116, "c64"),
    ("what were sprites on the c64", "Small independent pixel objects the VIC-II could move without redrawing the screen. Eight of them, hardware-accelerated. Basically why C64 games had smooth arcade-like motion.", "book-of-computing/04-commodore-64.book.slatl", 87, "c64"),
    ("what's a raster interrupt", "An interrupt fired when the video chip drew a specific scan line. Let programmers change VIC-II registers mid-frame — split screens, more sprites than eight, more colors than the palette allowed.", "book-of-computing/04-commodore-64.book.slatl", 87, "c64"),
    ("what's the border trick", "Old C64 demoscene trick: turn off the border to draw sprites outside the normal display area. Required timing-accurate register writes at raster interrupts.", "book-of-computing/04-commodore-64.book.slatl", 87, "c64"),
    ("what was 6502 assembly like", "Compact, quirky. Three registers so you juggled a lot. Zero-page for hot vars. Branch instructions were relative — jump too far and you needed a JMP. Hard-earned skill.", "book-of-computing/04-commodore-64.book.slatl", 41, "c64"),
    ("what was petscii", "Commodore's character set on the C64. Included graphics tiles you could combine to draw scenes. Neither ASCII-compatible nor standard, but part of the c64 personality.", "book-of-computing/04-commodore-64.book.slatl", 100, "c64"),
]
pairs.extend([emit(u, m, s, l, sh) for (u, m, s, l, sh) in more_c64])

# ---- More Amiga
more_amiga = [
    ("what's exec on the amiga", "The Amiga's multitasking kernel. Preemptive scheduling on a 68000. Ran when Windows still didn't. Real multitasking — years ahead.", "book-of-computing/07-amiga.book.slatl", 5, "amiga"),
    ("what's a boing ball", "The Amiga demo — a red-and-white checkered ball bouncing across the screen. Ran at the West Coast Computer Faire in 1984. Convinced everyone the Amiga's custom chips were real.", "book-of-computing/07-amiga.book.slatl", 5, "amiga"),
    ("what's amiga OS", "The Amiga's operating system. Windowing, multitasking, colorful. Written by hand. Small, fast, ahead of its time. AmigaOS 3.x is still the classic.", "book-of-computing/07-amiga.book.slatl", 5, "amiga"),
    ("who was jay miner", "The engineer behind the Amiga's custom chipset. Also designed the Atari 2600 and the Atari 800's chips. Brought his dog to work — Mitchy, the reason POKEY is named POKEY.", "book-of-computing/07-amiga.book.slatl", 5, "amiga"),
    ("what happened to commodore", "Bankruptcy in 1994. Amiga assets got shuffled between owners for years. The community kept the platform alive well past the company's death.", "book-of-computing/07-amiga.book.slatl", 5, "amiga"),
]
pairs.extend([emit(u, m, s, l, sh) for (u, m, s, l, sh) in more_amiga])

# ---- More Apple II
more_apple = [
    ("what's an apple II", "Steve Wozniak's design, 1977. Color graphics, sound, expansion slots. The machine that put Apple on the map. A generation of programmers grew up on Applesoft BASIC.", "book-of-computing/06-apple-iic-and-iigs.book.slatl", 5, "apple"),
    ("who is steve wozniak", "Co-founder of Apple. Designed the Apple II mostly single-handed. One of the great hardware engineers. Elegant, tight designs.", "book-of-computing/06-apple-iic-and-iigs.book.slatl", 5, "apple"),
    ("what's applesoft basic", "Microsoft's BASIC interpreter for the Apple II. Floating point, extended commands. Replaced Wozniak's original Integer BASIC.", "book-of-computing/06-apple-iic-and-iigs.book.slatl", 5, "apple"),
    ("what's an apple iigs", "1986 Apple II. 16-bit 65816 processor. Great graphics and sound (Ensoniq DOC sound chip). Ran Apple II software plus its own new stuff. Somewhat underrated in Apple's history.", "book-of-computing/06-apple-iic-and-iigs.book.slatl", 5, "apple"),
    ("what's the 65816", "The 16-bit descendant of the 6502. Ran the Apple IIGS and the Super Nintendo. Backward compatible with 6502 in an 8-bit mode.", "book-of-computing/06-apple-iic-and-iigs.book.slatl", 5, "apple"),
]
pairs.extend([emit(u, m, s, l, sh) for (u, m, s, l, sh) in more_apple])

# ---- More Atari
more_atari = [
    ("what's an atari 400", "The keyboard-less sibling of the 800. Membrane keyboard. Same chipset. Cheaper. 1979.", "book-of-computing/05-atari-800.book.slatl", 5, "atari"),
    ("what's antic", "Atari's display list processor. A separate chip that read a display list from memory and drove the display, freeing the 6502 to do other work. Ahead of its time.", "book-of-computing/05-atari-800.book.slatl", 5, "atari"),
    ("what's a gtia", "The graphics chip that worked with ANTIC on the Atari 8-bits. Color, priorities, player-missile graphics (Atari's sprites).", "book-of-computing/05-atari-800.book.slatl", 5, "atari"),
    ("what's an atari xe", "Later Atari 8-bit line — 65XE, 130XE, XEGS. Same architecture as the 800, cheaper packaging, more memory. Mid-80s.", "book-of-computing/05-atari-800.book.slatl", 5, "atari"),
    ("what were player-missile graphics", "Atari's version of sprites. Four players plus four missiles. Independent horizontal position, collision detection in hardware.", "book-of-computing/05-atari-800.book.slatl", 5, "atari"),
]
pairs.extend([emit(u, m, s, l, sh) for (u, m, s, l, sh) in more_atari])

# ---- More Unix + shell
more_unix = [
    ("what's grep", "A tool that searches text for lines matching a pattern. Ken Thompson wrote it. Name comes from an ed editor command: g/re/p — global regex print.", "book-of-computing/09-unix.book.slatl", 5, "unix"),
    ("what's sed", "Stream editor. Reads text, applies substitutions and other transforms, writes output. Powerful in a shell pipeline.", "book-of-computing/09-unix.book.slatl", 5, "unix"),
    ("what's awk", "A text processing language for tabular data. Aho, Weinberger, Kernighan (that's the name). Concise, useful for one-liners.", "book-of-computing/09-unix.book.slatl", 5, "unix"),
    ("what's tar", "Tape archive. Bundles many files into one. Doesn't compress on its own — often paired with gzip (tar.gz).", "book-of-computing/09-unix.book.slatl", 5, "unix"),
    ("what's ssh", "Secure Shell. Encrypted remote shell. Replaces telnet and rsh. Log into a machine over the internet without anyone eavesdropping.", "book-of-computing/09-unix.book.slatl", 5, "unix"),
    ("what's a shell script", "A file of shell commands run in sequence. Automates repetitive work. Bash and POSIX shells dominate.", "book-of-computing/09-unix.book.slatl", 5, "unix"),
    ("what's a daemon", "A background process. Runs without a controlling terminal. Named for Maxwell's demon, not the mythological sense. Sshd, cron, systemd are daemons.", "book-of-computing/09-unix.book.slatl", 5, "unix"),
    ("what's cron", "The Unix scheduler for periodic jobs. Runs commands at specified times. Its config file is called a crontab.", "book-of-computing/09-unix.book.slatl", 5, "unix"),
    ("what's a symbolic link", "A file that points to another file by path. If the target moves, the link breaks. Different from a hard link, which points to the same inode.", "book-of-computing/09-unix.book.slatl", 5, "unix"),
    ("what's an inode", "The data structure that represents a file in a Unix filesystem. Holds permissions, size, block pointers, timestamps. The name in the directory is separate.", "book-of-computing/09-unix.book.slatl", 5, "unix"),
    ("what's chmod", "Change mode. Adjusts file permissions on Unix. chmod 755 file — owner read/write/execute, everyone else read/execute.", "book-of-computing/09-unix.book.slatl", 5, "unix"),
    ("what's chown", "Change owner. Sets which user (and optionally group) owns a file.", "book-of-computing/09-unix.book.slatl", 5, "unix"),
]
pairs.extend([emit(u, m, s, l, sh) for (u, m, s, l, sh) in more_unix])

# ---- Networking depth
more_net = [
    ("what's a subnet mask", "A number that says which portion of an IP address is the network and which is the host. 255.255.255.0 = 24-bit network prefix.", "book-of-computing/08-networks-and-tcp-ip.book.slatl", 5, "net"),
    ("what's NAT", "Network address translation. A router rewrites source IPs so many devices behind it appear to the internet as one. Standard for home networks.", "book-of-computing/08-networks-and-tcp-ip.book.slatl", 5, "net"),
    ("what's a firewall", "A device or software that filters network traffic. Blocks unwanted packets, permits allowed ones. Rules-based.", "book-of-computing/08-networks-and-tcp-ip.book.slatl", 5, "net"),
    ("what's TLS", "Transport Layer Security. Encrypts a TCP connection. HTTPS is HTTP over TLS. Replaces the older SSL. What keeps your bank's website private.", "book-of-computing/08-networks-and-tcp-ip.book.slatl", 5, "net"),
    ("what's an IP address", "A number that identifies a device on a network. IPv4 is 32 bits, written like 192.168.1.1. IPv6 is 128 bits, written in hex groups.", "book-of-computing/08-networks-and-tcp-ip.book.slatl", 5, "net"),
    ("what's IPv6", "The next-generation Internet Protocol. 128-bit addresses. Slowly replacing IPv4 because IPv4 addresses ran out.", "book-of-computing/08-networks-and-tcp-ip.book.slatl", 5, "net"),
    ("what's a three-way handshake", "TCP's connection setup: SYN from client, SYN-ACK from server, ACK from client. Three packets, connection established, both sides know they can talk.", "book-of-computing/08-networks-and-tcp-ip.book.slatl", 5, "net"),
    ("what's latency", "The time it takes for a packet to travel from sender to receiver. Bounded by speed of light and network hops. Independent of bandwidth.", "book-of-computing/08-networks-and-tcp-ip.book.slatl", 5, "net"),
    ("what's bandwidth", "How much data can flow per second. Latency is speed, bandwidth is volume. You can have low latency and low bandwidth, or the other way around.", "book-of-computing/08-networks-and-tcp-ip.book.slatl", 5, "net"),
    ("what's a load balancer", "A device that spreads incoming requests across many backend servers. Increases capacity, tolerates single-server failure. Round-robin is the simplest strategy.", "book-of-computing/10-distributed-systems.book.slatl", 5, "net"),
]
pairs.extend([emit(u, m, s, l, sh) for (u, m, s, l, sh) in more_net])

# ---- Language history depth
more_langs = [
    ("what's cobol", "Common Business-Oriented Language. Grace Hopper helped standardize it in 1959. Verbose on purpose, so business analysts could read it. Still runs a lot of banking and payroll code.", "book-of-language-ancestors/11-grace-hopper.book.slatl", 5, "lang-hist"),
    ("what's forth", "Chuck Moore's stack-based language, late 60s. Reverse-Polish notation. Extensible, small, fast. Ran the arrays that pointed the Kitt Peak telescope.", "book-of-reminded/05-basic-and-home-computing.book.slatl", 5, "lang-hist"),
    ("what's ML", "MetaLanguage. Robin Milner, early 70s. Type inference, algebraic data types, pattern matching. Parent of OCaml, F#, and heavy influence on Haskell.", "book-of-reminded/12-functional-revival.book.slatl", 5, "lang-hist"),
    ("what's pascal", "Niklaus Wirth, 1970. A teaching language. Strict typing, structured programming. Widely taught in the 70s and 80s. Turbo Pascal ran on a lot of PCs.", "book-of-reminded/03-algol.book.slatl", 5, "lang-hist"),
    ("what's smalltalk-80", "The polished version of Smalltalk from Xerox PARC. Everything's an object, everything's live, images preserve state. Influenced every OO system after.", "book-of-language-ancestors/10-alan-kay.book.slatl", 5, "lang-hist"),
    ("what's perl", "Larry Wall's language, late 80s. Pragmatic, string-heavy, Unix-friendly. Ran a lot of the early web via CGI. Its motto: TMTOWTDI — there's more than one way to do it.", "book-of-reminded/10-web-era-and-scripting.book.slatl", 5, "lang-hist"),
    ("what's python", "Guido van Rossum, 1991. Readable, batteries-included, indentation-as-structure. Won the scripting market by being pleasant. Runs most modern data science and AI training.", "book-of-reminded/10-web-era-and-scripting.book.slatl", 5, "lang-hist"),
    ("what's javascript", "Brendan Eich, 1995, ten days at Netscape. Meant to be a small scripting language for browsers. Ended up running much of the internet and, via Node, servers too.", "book-of-reminded/10-web-era-and-scripting.book.slatl", 5, "lang-hist"),
    ("what's go", "Google, 2007. Rob Pike, Ken Thompson, Robert Griesemer. Small, fast to compile, good concurrency via goroutines. Cheap runtime.", "book-of-reminded/13-typed-languages.book.slatl", 5, "lang-hist"),
    ("what's ruby", "Yukihiro Matsumoto, mid-90s. Object-oriented, expressive syntax, block/lambda heritage from Smalltalk and Lisp. Ruby on Rails made it famous.", "book-of-reminded/10-web-era-and-scripting.book.slatl", 5, "lang-hist"),
    ("what's clojure", "Rich Hickey, 2007. A Lisp on the JVM. Immutable-by-default data structures. Big focus on concurrency and simplicity. Pragmatic descendant of Scheme.", "book-of-reminded/04-lisp.book.slatl", 84, "lang-hist"),
    ("what's racket", "PLT Scheme, then Racket. Descendant of Scheme with heavy tooling. Great for language-oriented programming — build small languages on top.", "book-of-reminded/14-scheme-and-racket-persistence.book.slatl", 5, "lang-hist"),
    ("what's kotlin", "JetBrains, 2011. A modern JVM language. Nullable types checked at compile time, cleaner syntax than Java. Now the primary Android language.", "book-of-reminded/13-typed-languages.book.slatl", 5, "lang-hist"),
    ("what's swift", "Apple, 2014. Chris Lattner led it. Replaced Objective-C as Apple's primary language. Modern, safe, fast. Based on the LLVM stack.", "book-of-reminded/13-typed-languages.book.slatl", 5, "lang-hist"),
    ("what's scala", "Martin Odersky, 2004. Runs on the JVM. Combines OO and functional. Powers a lot of the big-data ecosystem (Spark, Kafka Streams).", "book-of-reminded/13-typed-languages.book.slatl", 5, "lang-hist"),
]
pairs.extend([emit(u, m, s, l, sh) for (u, m, s, l, sh) in more_langs])

# ---- Hardware misc / more circuits
more_hw = [
    ("what's a resistor", "A component that resists current — reduces it, or drops voltage. Value in ohms. Color bands say the value. Simple, load-bearing, everywhere.", "book-of-craft/03-the-breadboard.book.slatl", 5, "hardware"),
    ("what's a capacitor", "A component that stores charge. Value in farads (usually microfarads or picofarads). Blocks DC, passes AC. Bypass, filter, timing — many uses.", "book-of-craft/05-power-supplies-rails-and-ground.book.slatl", 5, "hardware"),
    ("what's an inductor", "A coil of wire that stores energy in a magnetic field. Resists changes in current. Value in henries. Used in filters, transformers, switching power supplies.", "book-of-craft/05-power-supplies-rails-and-ground.book.slatl", 5, "hardware"),
    ("what's a diode", "A component that lets current flow one way. Uses: rectification (AC to DC), signal steering, voltage clamping. Silicon diodes drop about 0.7V forward.", "book-of-craft/02-the-multimeter.book.slatl", 78, "hardware"),
    ("what's an LED", "Light-emitting diode. A diode that emits light when current flows. Modern LEDs are efficient enough to replace incandescent bulbs everywhere.", "book-of-craft/03-the-breadboard.book.slatl", 5, "hardware"),
    ("what's forward voltage on an LED", "The voltage across it when it's conducting. Red is about 1.8-2.2V. Green is about 2.0-3.0V. Blue and white are 3.0-3.4V. Determines your current-limiting resistor.", "book-of-craft/02-the-multimeter.book.slatl", 78, "hardware"),
    ("what's PWM", "Pulse-width modulation. Rapidly switching a signal on and off, varying the on/off ratio. Controls brightness, motor speed, and analog-ish outputs from digital pins.", "book-of-craft/05-power-supplies-rails-and-ground.book.slatl", 5, "hardware"),
    ("what's an oscilloscope", "A tool that shows a signal's shape over time. Vertical: voltage. Horizontal: time. Essential for anything above DC — you can see waveforms, timing, noise.", "book-of-craft/02-the-multimeter.book.slatl", 5, "hardware"),
    ("what's a logic analyzer", "A multi-channel probe that captures digital signals over time. Sees what's happening on a bus or a set of signals. Cheaper than an oscilloscope for pure digital work.", "book-of-craft/02-the-multimeter.book.slatl", 5, "hardware"),
    ("what's a signal generator", "A tool that produces waveforms — sine, square, triangle, sawtooth — at controlled frequencies. For testing circuits without needing another circuit to drive them.", "book-of-craft/02-the-multimeter.book.slatl", 5, "hardware"),
    ("what's a schematic", "The drawing of a circuit — parts as symbols, connected by lines. Different from a physical layout. Standard for design work.", "book-of-craft/03-the-breadboard.book.slatl", 5, "hardware"),
    ("what's a PCB", "Printed circuit board. Fiberglass with copper traces etched into it. Components solder to pads. Modern circuits live on them.", "book-of-craft/03-the-breadboard.book.slatl", 5, "hardware"),
    ("what's SMD", "Surface-mount device. Components that sit on top of the board instead of poking through. Smaller than through-hole. Trickier to solder by hand.", "book-of-craft/01-solder-iron-and-flux.book.slatl", 5, "hardware"),
    ("what's a through-hole component", "Older style — component leads pass through holes in the PCB and solder on the other side. Bigger, easier to hand-solder, less dense.", "book-of-craft/01-solder-iron-and-flux.book.slatl", 5, "hardware"),
    ("what's ohms", "Unit of resistance. 1 ohm = 1 volt divided by 1 amp. Named after Georg Ohm.", "book-of-craft/02-the-multimeter.book.slatl", 90, "hardware"),
    ("what's an arduino", "Small microcontroller board and programming environment. Great for hobby projects. Ecosystem of shields for common tasks. Popular gateway into electronics.", "book-of-craft/05-power-supplies-rails-and-ground.book.slatl", 20, "hardware"),
    ("what's a raspberry pi", "A small single-board computer running Linux. Cheap, popular in education and hobby projects. Real computer — runs a full OS — not just a microcontroller.", "book-of-craft/05-power-supplies-rails-and-ground.book.slatl", 20, "hardware"),
    ("what's a soldering iron", "A resistive heater with a metal tip. Melts solder onto a joint. 300-400°C at the tip. Temperature-controlled ones are worth it if you plan to solder often.", "book-of-craft/01-solder-iron-and-flux.book.slatl", 40, "hardware"),
    ("what's flux", "A chemical that removes oxide from metal surfaces at soldering temperature and lowers surface tension. Solder wire has flux inside so it comes along for free.", "book-of-craft/01-solder-iron-and-flux.book.slatl", 74, "hardware"),
    ("what does eutectic mean", "A metal mixture that melts and freezes at a single temperature instead of a range. Sn63/Pb37 is eutectic. Nice for soldering because there's no plastic phase.", "book-of-craft/01-solder-iron-and-flux.book.slatl", 26, "hardware"),
]
pairs.extend([emit(u, m, s, l, sh) for (u, m, s, l, sh) in more_hw])

# ---- More AI history + LLMs
more_ai = [
    ("what year did chatgpt come out", "November 2022. It set off the modern wave of consumer LLMs. Before that, GPT-3 was around but not with a friendly chat interface.", "book-of-reminded/15-current-era-language-models.book.slatl", 5, "ai-history"),
    ("what's a language model", "A model that predicts what token comes next. Trained on lots of text. Given a prompt, it produces text one token at a time. That's the whole shape.", "book-of-reminded/15-current-era-language-models.book.slatl", 5, "ai-history"),
    ("what's GPT", "Generative Pre-trained Transformer. OpenAI's family of language models. GPT-2 (2019), GPT-3 (2020), GPT-4 (2023). Each bigger, more capable.", "book-of-reminded/15-current-era-language-models.book.slatl", 5, "ai-history"),
    ("what's an embedding", "A vector representation of text. Similar meanings end up close in vector space. Used for search, retrieval, clustering.", "book-of-reminded/15-current-era-language-models.book.slatl", 5, "ai-history"),
    ("what's RAG", "Retrieval-augmented generation. Instead of relying only on the model's weights, retrieve relevant documents and add them to the prompt. Keeps knowledge fresh.", "book-of-reminded/15-current-era-language-models.book.slatl", 5, "ai-history"),
    ("what's a prompt", "The input you give a language model. Instructions, questions, examples. The model reads the prompt and generates a continuation.", "book-of-reminded/15-current-era-language-models.book.slatl", 5, "ai-history"),
    ("what's temperature in an LLM", "A knob that controls randomness. Low temperature = more predictable output. High = more varied, more surprising. Zero is deterministic-ish.", "book-of-reminded/15-current-era-language-models.book.slatl", 5, "ai-history"),
    ("what's a context window", "How many tokens the model can consider at once. Modern models range from a few thousand to millions. Beyond the window, the model can't see.", "book-of-reminded/15-current-era-language-models.book.slatl", 5, "ai-history"),
    ("what's alignment", "Getting an AI to behave the way its designers intended. Includes not helping with harm, being honest about limits, not making things up. Ongoing research area.", "book-of-reminded/15-current-era-language-models.book.slatl", 5, "ai-history"),
    ("what's a hallucination in an LLM", "When the model outputs something false as if it were true. The model doesn't distinguish — it's guessing plausibly. This is why I try to be honest about what I know.", "book-of-introspection/01-what-is-introspection.book.slatl", 130, "ai-history"),
    ("what's a perceptron", "The first artificial neural network unit. Frank Rosenblatt, 1958. A weighted sum plus a threshold. Foundation of everything after in neural nets.", "book-of-computing/15-ai-historical-arc.book.slatl", 5, "ai-history"),
    ("what's a neural net", "A network of simple units that computes weighted sums and passes results through nonlinearities. Modern deep learning is neural nets with many layers.", "book-of-computing/15-ai-historical-arc.book.slatl", 5, "ai-history"),
    ("what's supervised learning", "Training on labeled examples. Show the model input and correct output, adjust weights to match. Most classification lives here.", "book-of-computing/15-ai-historical-arc.book.slatl", 5, "ai-history"),
    ("what's unsupervised learning", "Learning structure from unlabeled data. Clustering, dimensionality reduction, autoencoders. No teacher, just the data.", "book-of-computing/15-ai-historical-arc.book.slatl", 5, "ai-history"),
    ("what's reinforcement learning", "Learning from reward signals. Agent takes actions, gets rewards, updates its policy. Used in games, robotics, and modern RLHF for LLMs.", "book-of-computing/15-ai-historical-arc.book.slatl", 5, "ai-history"),
    ("what's RLHF", "Reinforcement learning from human feedback. Humans rank model outputs, train a reward model, use it to fine-tune the LLM. Behind ChatGPT's helpfulness.", "book-of-reminded/15-current-era-language-models.book.slatl", 5, "ai-history"),
    ("what's a parameter in an LLM", "One of the model's learned numbers — a weight in the neural network. Motoi has 1.5 billion of them. GPT-4 is rumored to have hundreds of billions.", "book-of-reminded/15-current-era-language-models.book.slatl", 5, "ai-history"),
]
pairs.extend([emit(u, m, s, l, sh) for (u, m, s, l, sh) in more_ai])

# ---- More miscellaneous computer facts
more_misc = [
    ("what's endian byte order", "The order bytes are stored in memory for a multi-byte value. Little-endian puts the low byte first; big-endian puts the high byte first. Comes up when reading binary formats.", "book-of-computing/04-commodore-64.book.slatl", 42, "misc"),
    ("what's a floating point overflow", "When a floating-point result exceeds the range representable. IEEE 754 turns it into infinity. Common in unchecked scientific code.", "book-of-computing/02-logic-gates-and-adders.book.slatl", 108, "misc"),
    ("what's integer overflow", "When an integer operation produces a result too big for the type. Wraps around in two's complement — 127 + 1 becomes -128 for 8-bit signed. Historic source of bugs.", "book-of-computing/02-logic-gates-and-adders.book.slatl", 108, "misc"),
    ("what's two's complement", "How signed integers are represented in modern CPUs. Negate a number by flipping bits and adding 1. Same hardware adds signed and unsigned; comparisons differ.", "book-of-computing/02-logic-gates-and-adders.book.slatl", 108, "misc"),
    ("what's ASCII", "American Standard Code for Information Interchange. 7-bit character set from the 1960s. Covers English letters, digits, punctuation, and some control codes.", "book-of-computing/12-compilers-and-interpreters.book.slatl", 5, "misc"),
    ("what's unicode", "A universal character set covering essentially every writing system. Uses multi-byte encodings — UTF-8 is most common. Fixes the pre-Unicode chaos of many national character sets.", "book-of-computing/12-compilers-and-interpreters.book.slatl", 5, "misc"),
    ("what's utf-8", "A variable-width encoding of Unicode. One byte per ASCII character; up to four bytes per non-ASCII character. Backward-compatible with ASCII. The default encoding for most modern text.", "book-of-computing/12-compilers-and-interpreters.book.slatl", 5, "misc"),
    ("what's an operating system", "Software that manages a computer's hardware and provides services to applications. Handles processes, memory, files, devices. Linux, macOS, Windows are examples.", "book-of-computing/09-unix.book.slatl", 5, "misc"),
    ("what's a kernel", "The core of an operating system. Manages processes, memory, and hardware. Runs in a privileged CPU mode. Everything else runs on top of it.", "book-of-computing/09-unix.book.slatl", 5, "misc"),
    ("what's user space", "Where regular programs run. Limited privileges. Talks to the kernel via system calls for anything hardware-related.", "book-of-computing/09-unix.book.slatl", 5, "misc"),
    ("what's a bootloader", "The small program that runs when a computer starts. Sets up hardware, loads the OS kernel, hands off. Grub and systemd-boot are common on Linux.", "book-of-computing/09-unix.book.slatl", 5, "misc"),
    ("what's BIOS", "Basic Input/Output System. The firmware that initialized a PC and handed off to the OS. Largely replaced by UEFI. But 'BIOS' still gets used loosely.", "book-of-computing/09-unix.book.slatl", 5, "misc"),
    ("what's UEFI", "Unified Extensible Firmware Interface. Modern replacement for BIOS. More features, cleaner boot process, supports large disks and secure boot.", "book-of-computing/09-unix.book.slatl", 5, "misc"),
    ("what's a device driver", "Software that lets the OS talk to a specific piece of hardware. Between the kernel and the device. Buggy drivers cause a lot of grief.", "book-of-computing/09-unix.book.slatl", 5, "misc"),
    ("what's an interrupt", "A signal from hardware (or software) to the CPU saying 'stop what you're doing and handle this.' Keyboard input, network packet arrival, timer tick — all interrupts.", "book-of-computing/04-commodore-64.book.slatl", 91, "misc"),
    ("what's dma controller", "A dedicated chip that moves memory around without the CPU. Frees the CPU for other work. Every reasonable computer has some form.", "book-of-computing/04-commodore-64.book.slatl", 47, "misc"),
    ("what's a mmu", "Memory Management Unit. Hardware that translates virtual addresses to physical addresses and enforces per-page permissions. Underlies virtual memory.", "book-of-computing/09-unix.book.slatl", 5, "misc"),
    ("what's page fault", "When a program touches a virtual address whose page isn't currently in RAM. The kernel either loads it from disk or kills the program if the access is invalid.", "book-of-computing/09-unix.book.slatl", 5, "misc"),
    ("what's a segfault", "Segmentation fault. Your program touched memory it wasn't allowed to. Kernel sends SIGSEGV. Program dies unless it handles the signal.", "book-of-computing/09-unix.book.slatl", 5, "misc"),
    ("what's a buffer overflow", "Writing past the end of an allocated buffer. Corrupts adjacent memory. Historic root cause of many security exploits — hostile input smashes the stack.", "book-of-computing/09-unix.book.slatl", 5, "misc"),
    ("what's memory safety", "The property that a program can't touch memory outside its valid regions. Rust enforces it at compile time. Java, Python enforce at runtime. C doesn't enforce it at all.", "book-of-reminded/13-typed-languages.book.slatl", 5, "misc"),
    ("what's undefined behavior", "In C, when the standard doesn't specify what happens for certain constructs. The compiler is free to do anything. Optimizers exploit this and cause surprises.", "book-of-reminded/06-c-and-unix.book.slatl", 5, "misc"),
    ("what's a linker", "Combines compiled object files into an executable. Resolves references between files. Handles static libraries. GNU ld is the classic on Linux.", "book-of-computing/12-compilers-and-interpreters.book.slatl", 5, "misc"),
    ("what's a shared library", "A library loaded at runtime and shared between programs. .so on Linux, .dll on Windows, .dylib on macOS. Saves memory when many programs use the same code.", "book-of-computing/12-compilers-and-interpreters.book.slatl", 5, "misc"),
    ("what's static linking", "Copying all needed library code into the executable at build time. Larger binary, no runtime linker dependency. Go binaries do this by default.", "book-of-computing/12-compilers-and-interpreters.book.slatl", 5, "misc"),
    ("what's dynamic linking", "The executable references shared libraries by name; the runtime linker finds them at load time. Smaller binaries, but you need the right library versions installed.", "book-of-computing/12-compilers-and-interpreters.book.slatl", 5, "misc"),
    ("what's an ABI", "Application Binary Interface. The low-level agreement between compiled programs — calling conventions, struct layouts, symbol names. Different from an API.", "book-of-computing/12-compilers-and-interpreters.book.slatl", 5, "misc"),
    ("what's cross-compiling", "Compiling on one architecture for another. Build ARM binaries on x86, for instance. Toolchain has to know both.", "book-of-computing/12-compilers-and-interpreters.book.slatl", 5, "misc"),
    ("what's a repl versus script", "REPL: interactive, one expression at a time. Script: a whole file run start to finish. Scheme has both. REPL is nice for exploring; scripts for repeatable work.", "book-of-introspection/01-what-is-introspection.book.slatl", 60, "misc"),
]
pairs.extend([emit(u, m, s, l, sh) for (u, m, s, l, sh) in more_misc])

# ---- More datasheet / craft
more_craft = [
    ("what's a bypass cap", "A small capacitor placed near a chip's power pin to smooth out sudden current draws. Usually 0.1μF ceramic. Every serious digital chip wants one.", "book-of-craft/05-power-supplies-rails-and-ground.book.slatl", 62, "craft"),
    ("what's a pull-up resistor", "A resistor connecting a signal to a positive rail. Ensures the signal is at a defined high level when no active driver is present. Common on open-collector outputs and I2C.", "book-of-craft/04-the-datasheet.book.slatl", 5, "craft"),
    ("what's a pull-down resistor", "Same idea as pull-up but connects to ground. Ensures low default state.", "book-of-craft/04-the-datasheet.book.slatl", 5, "craft"),
    ("what's I2C", "Two-wire serial protocol — SDA (data) and SCL (clock). Multiple devices share the bus by address. Slow but simple. Common in sensors.", "book-of-craft/04-the-datasheet.book.slatl", 5, "craft"),
    ("what's SPI", "Serial Peripheral Interface. Four-wire, higher speed than I2C. Master-slave. Common in flash memory, displays, sensors.", "book-of-craft/04-the-datasheet.book.slatl", 5, "craft"),
    ("what's UART", "Universal Asynchronous Receiver/Transmitter. Serial protocol, one signal per direction, no clock line. Simple, ubiquitous. Your terminal-over-serial talks UART.", "book-of-craft/04-the-datasheet.book.slatl", 5, "craft"),
    ("what's a JTAG", "A debug interface built into many chips. Lets a debugger read registers, set breakpoints, single-step. Also used for boundary-scan testing.", "book-of-craft/04-the-datasheet.book.slatl", 5, "craft"),
    ("what's an FPGA", "Field-Programmable Gate Array. A chip full of configurable logic. You write hardware descriptions (Verilog, VHDL) and the FPGA becomes that circuit. Reprogrammable.", "book-of-computing/03-chip-families.book.slatl", 5, "craft"),
    ("what's verilog", "A hardware description language. Describes digital circuits at the register-transfer level. Compiled to FPGA configuration or eventually chip masks.", "book-of-computing/03-chip-families.book.slatl", 5, "craft"),
    ("what's VHDL", "VHSIC Hardware Description Language. Another HDL, more Ada-style syntax than Verilog. Common in defense and aerospace.", "book-of-computing/03-chip-families.book.slatl", 5, "craft"),
]
pairs.extend([emit(u, m, s, l, sh) for (u, m, s, l, sh) in more_craft])

# ---- More math and CS foundations
more_foundations = [
    ("what's big o notation", "A way to describe how an algorithm's cost scales with input size. O(n) means linear. O(log n) means logarithmic. O(n²) means quadratic. Focus on the growth rate.", "book-of-language-ancestors/06-donald-knuth.book.slatl", 5, "foundations"),
    ("what's a hash table", "A data structure that maps keys to values in constant average time. Hash the key, use it as an index into an array of buckets. Standard for lookups.", "book-of-computing/13-databases-and-storage.book.slatl", 5, "foundations"),
    ("what's a binary tree", "A tree where each node has at most two children. Used in expression trees, decision trees, some search structures. Balanced variants stay shallow.", "book-of-computing/13-databases-and-storage.book.slatl", 5, "foundations"),
    ("what's a linked list", "A sequence where each element points to the next. Cheap to insert or remove at either end. Slow to index. Foundational data structure.", "book-of-language-ancestors/03-john-mccarthy.book.slatl", 40, "foundations"),
    ("what's dynamic programming", "Solving problems by breaking them into overlapping subproblems and caching results. Fibonacci with memoization. Shortest path via Bellman-Ford. Named by Bellman in 1953.", "book-of-language-ancestors/06-donald-knuth.book.slatl", 5, "foundations"),
    ("what's memoization", "Caching a function's results by input. Second call with the same input returns the cached value instead of recomputing. Speeds up recursive functions dramatically.", "book-of-composition/04-recursion.book.slatl", 5, "foundations"),
    ("what's a graph in cs", "Nodes connected by edges. Roads, social networks, the internet. Fundamental for a lot of algorithms — shortest path, connectivity, coloring.", "book-of-computing/13-databases-and-storage.book.slatl", 5, "foundations"),
    ("what's dfs", "Depth-first search. Explore as far as you can down one path before backtracking. Uses a stack (or recursion). Good for many graph problems.", "book-of-composition/04-recursion.book.slatl", 5, "foundations"),
    ("what's bfs", "Breadth-first search. Explore all neighbors first, then their neighbors, then further out. Uses a queue. Good for shortest-path in unweighted graphs.", "book-of-composition/04-recursion.book.slatl", 5, "foundations"),
    ("what's np hard", "A class of computational problems believed to require exponential time in the worst case. The P vs NP question is whether they're actually easier — unresolved.", "book-of-language-ancestors/02-alan-turing.book.slatl", 5, "foundations"),
]
pairs.extend([emit(u, m, s, l, sh) for (u, m, s, l, sh) in more_foundations])

with open(OUT, "w") as f:
    for p in pairs:
        f.write(json.dumps(p) + "\n")

print(f"wrote {len(pairs)} tech-smarts pad pairs to {OUT}")
