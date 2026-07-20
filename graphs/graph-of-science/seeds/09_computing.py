"""Computer science concepts. Target ~500 nodes.

Concept-level only. NO vendor names, NO product names, NO trademarks
per curator repo lock. Where a technique bears a company name in
history, we use the generic name and note the history as a synonym only
when clearly public-domain.
"""

from _helpers import S


def W(name):
    return [{"source": "wikipedia", "url": f"https://en.wikipedia.org/wiki/{name}"}]


def WD(qid, name=None):
    p = [{"source": "wikidata", "qid": qid}]
    if name:
        p.append({"source": "wikipedia", "url": f"https://en.wikipedia.org/wiki/{name}"})
    return p


def C(name, slug, kind, narr, everyday=None, extras=None, subsumed_by=None,
      applies=None, described_by=None, described_year=None, related=None,
      wp=None, wd=None):
    prov = WD(wd, wp) if wd else W(wp or name.replace(" ", "_"))
    return S(name, "computing", kind,
             id_slug=slug, extras=extras or [], narrative=narr, everyday=everyday,
             applies=applies or [":computational"],
             described_by=described_by, described_year=described_year,
             subsumed_by=subsumed_by or "computing",
             related=[(r, w) for r, w in (related or [])],
             provenance=prov)


SCIENCES = []

# ---- ABSTRACTIONS / MODELS ----
MODELS = [
    ("Algorithm", "algorithm", "A finite sequence of well-defined instructions for solving a problem.",
     "A recipe is an everyday-life algorithm.",
     ["procedure", "step-by-step method"], "cs-theory", None, None, "Algorithm", "Q8366"),
    ("Data Structure", "data-structure", "A particular way of organizing data in a computer for efficient access and modification.",
     None, [], "cs-theory", None, None, "Data_structure", "Q175263"),
    ("Turing Machine (CS)", "turing-machine-cs", "The theoretical model of a computing device manipulating symbols on a tape; the standard for computability.",
     None, [], "cs-theory", "turing-alan", 1936, "Turing_machine", "Q163310"),
    ("Church-Turing Thesis", "church-turing-thesis", "The hypothesis that any function computable by an algorithm is computable by a Turing machine.",
     None, [], "cs-theory", "turing-alan", 1936, "Church%E2%80%93Turing_thesis", "Q182458"),
    ("Big-O Notation", "big-o-notation", "Notation describing how an algorithm's runtime or memory grows with input size — captures worst-case asymptotic behavior.",
     None, ["O(n)", "asymptotic notation"], "cs-theory", "landau-edmund", 1894, "Big_O_notation", "Q217602"),
    ("NP-complete Problem", "np-complete-problem", "A decision problem that is in NP and to which every NP problem reduces in polynomial time — the hardest problems in NP.",
     None, [], "cs-theory", "cook-stephen", 1971, "NP-completeness", "Q191225"),
    ("P Complexity Class", "p-class", "The class of decision problems solvable in polynomial time by a deterministic Turing machine.",
     None, [], "cs-theory", None, None, "P_(complexity)", "Q192900"),
    ("NP Complexity Class", "np-class", "The class of decision problems whose solutions can be verified in polynomial time.",
     None, [], "cs-theory", None, None, "NP_(complexity)", "Q207714"),
    ("PSPACE", "pspace", "The class of decision problems solvable using polynomial memory.",
     None, [], "cs-theory", None, None, "PSPACE", "Q1057013"),
    ("Undecidable Problem", "undecidable-problem", "A decision problem for which no algorithm can always give a correct yes/no answer.",
     None, [], "cs-theory", "turing-alan", 1936, "Undecidable_problem", "Q207302"),
    ("Finite State Machine", "finite-state-machine", "A model of computation with a finite number of states and transitions between them driven by input symbols.",
     None, ["FSM", "finite automaton", "state machine"], "cs-theory", None, None, "Finite-state_machine", "Q211534"),
    ("Regular Expression", "regular-expression", "A sequence of characters that defines a search pattern, equivalent in power to a finite automaton.",
     None, ["regex"], "cs-theory", "kleene-stephen", 1956, "Regular_expression", "Q183196"),
    ("Context-Free Grammar", "context-free-grammar", "A formal grammar where every production rule has a single non-terminal on the left.",
     None, ["CFG", "BNF"], "cs-theory", "chomsky-noam", 1956, "Context-free_grammar", "Q207028"),
    ("Formal Language", "formal-language", "A set of strings over an alphabet, defined by a grammar.",
     None, [], "cs-theory", None, None, "Formal_language", "Q192924"),
    ("Lambda Calculus", "lambda-calculus", "A formal system for expressing computation via function abstraction and application; equivalent in power to a Turing machine.",
     None, ["λ-calculus"], "cs-theory", "church-alonzo", 1936, "Lambda_calculus", "Q194419"),
    ("Recursion", "recursion", "The technique of defining a function or structure in terms of itself.",
     None, [], "cs-theory", None, None, "Recursion_(computer_science)", "Q207765"),
    ("Iteration", "iteration", "The repetition of a process or sequence of operations, often in a loop.",
     None, ["loop"], "cs-theory", None, None, "Iteration", "Q207137"),
    ("Abstraction (CS)", "abstraction-cs", "The process of hiding implementation details behind a simple interface.",
     None, [], "cs-theory", None, None, "Abstraction_(computer_science)", "Q7987"),
    ("Encapsulation", "encapsulation", "Bundling data with the methods that operate on it, and restricting direct access to some components.",
     None, [], "cs-theory", None, None, "Encapsulation_(computer_programming)", "Q192043"),
    ("Polymorphism", "polymorphism-cs", "The provision of a single interface to entities of different types.",
     None, [], "cs-theory", None, None, "Polymorphism_(computer_science)", "Q207644"),
    ("Inheritance (CS)", "inheritance", "The mechanism by which one class can derive properties and behaviors from another class.",
     None, [], "cs-theory", None, None, "Inheritance_(object-oriented_programming)", "Q194168"),
    ("Concurrency", "concurrency", "The composition of independently-executing computations.",
     None, [], "cs-theory", None, None, "Concurrency_(computer_science)", "Q1163726"),
    ("Parallelism", "parallelism", "The simultaneous execution of computations to solve a problem faster.",
     None, ["parallel computing"], "cs-theory", None, None, "Parallel_computing", "Q232661"),
    ("Race Condition", "race-condition", "A flaw where the behavior of a system depends on the relative timing of uncontrollable events.",
     None, [], "cs-theory", None, None, "Race_condition", "Q1128322"),
    ("Deadlock", "deadlock", "A state where two or more processes each wait indefinitely for the other to release a resource.",
     None, [], "cs-theory", None, None, "Deadlock", "Q209423"),
    ("Cache", "cache", "A hardware or software component that stores data so future requests for that data can be served faster.",
     None, [], "computing", None, None, "Cache_(computing)", "Q188907"),
    ("Memory Hierarchy", "memory-hierarchy", "The organization of memory storage in a computer by speed and cost — registers, cache, RAM, disk, tape.",
     None, [], "computing", None, None, "Memory_hierarchy", "Q1131822"),
    ("Virtual Memory", "virtual-memory", "A memory management technique providing an abstraction of the storage resources actually available to a process.",
     None, [], "computing", None, None, "Virtual_memory", "Q194502"),
    ("Garbage Collection", "garbage-collection", "Automatic memory management that reclaims memory occupied by objects no longer in use.",
     None, ["GC"], "computing", "mccarthy-john", 1959, "Garbage_collection_(computer_science)", "Q207005"),
    ("Compiler", "compiler", "A program that translates code written in one programming language into another, typically machine code.",
     None, [], "computing", None, None, "Compiler", "Q47506"),
    ("Interpreter", "interpreter", "A program that directly executes instructions written in a programming language without prior compilation to machine code.",
     None, [], "computing", None, None, "Interpreter_(computing)", "Q209328"),
    ("Just-In-Time Compilation", "jit-compilation", "Compilation performed during program execution, combining benefits of interpretation and ahead-of-time compilation.",
     None, ["JIT"], "computing", None, None, "Just-in-time_compilation", "Q198573"),
]
for row in MODELS:
    name, slug, narr, everyday, extras, subsumed_by, disc_who, year, wp, wd = row
    SCIENCES.append(C(name, slug, "abstraction", narr, everyday=everyday, extras=extras,
                     subsumed_by=subsumed_by,
                     described_by=[f"person-{disc_who}"] if disc_who else None,
                     described_year=year, wp=wp, wd=wd))

# ---- ALGORITHMS ----
ALGORITHMS = [
    ("Bubble Sort", "bubble-sort", "A simple sorting algorithm that repeatedly steps through the list, comparing and swapping adjacent elements. O(n²).", "sorting"),
    ("Merge Sort", "merge-sort", "A divide-and-conquer sorting algorithm that recursively divides the list, sorts halves, and merges. O(n log n).", "sorting"),
    ("Quick Sort", "quick-sort", "A divide-and-conquer sort using a pivot to partition the list into two sublists, then recursing. Average O(n log n).", "sorting"),
    ("Insertion Sort", "insertion-sort", "Builds a sorted list one element at a time by inserting each into its correct position. O(n²) but efficient for small n.", "sorting"),
    ("Heap Sort", "heap-sort", "A comparison-based sort using a binary heap data structure. O(n log n) worst case.", "sorting"),
    ("Binary Search", "binary-search", "A search algorithm for sorted lists that halves the search interval each step. O(log n).", "searching"),
    ("Linear Search", "linear-search", "A search algorithm that checks each element in sequence. O(n).", "searching"),
    ("Depth-First Search", "depth-first-search", "A graph traversal exploring as far as possible along each branch before backtracking.", "graph-algorithms"),
    ("Breadth-First Search", "breadth-first-search", "A graph traversal exploring all neighbors at the present depth before moving deeper.", "graph-algorithms"),
    ("Dijkstra's Algorithm", "dijkstras-algorithm", "An algorithm for finding shortest paths from a source vertex to all others in a graph with non-negative edge weights.", "graph-algorithms"),
    ("Bellman-Ford Algorithm", "bellman-ford-algorithm", "A shortest-path algorithm that handles graphs with negative edge weights.", "graph-algorithms"),
    ("A* Search", "a-star-search", "A best-first search algorithm using a heuristic to guide toward the goal — the workhorse of pathfinding.", "graph-algorithms"),
    ("Kruskal's Algorithm", "kruskals-algorithm", "A greedy algorithm for finding a minimum spanning tree of a weighted graph.", "graph-algorithms"),
    ("Prim's Algorithm", "prims-algorithm", "A greedy algorithm for finding a minimum spanning tree by growing one from an arbitrary starting vertex.", "graph-algorithms"),
    ("Dynamic Programming", "dynamic-programming", "A method for solving complex problems by breaking them into simpler overlapping subproblems and storing solutions.", "optimization"),
    ("Divide and Conquer", "divide-and-conquer", "An algorithm design paradigm that breaks a problem into smaller subproblems, solves them recursively, and combines results.", "algorithm-design"),
    ("Greedy Algorithm", "greedy-algorithm", "An algorithm that makes locally-optimal choices at each stage.", "algorithm-design"),
    ("Backtracking", "backtracking", "An algorithm design paradigm that incrementally builds candidates, abandoning a candidate as soon as it can't lead to a valid solution.", "algorithm-design"),
    ("Hashing", "hashing", "A technique that maps data of arbitrary size to fixed-size values, enabling O(1) average-case lookup.", "data-structures"),
    ("MD5", "md5-hash", "A widely-used cryptographic hash function producing 128-bit hashes — now considered cryptographically broken.", "cryptography"),
    ("SHA-256", "sha-256", "A member of the SHA-2 family of cryptographic hash functions producing 256-bit hashes.", "cryptography"),
    ("RSA Cryptosystem", "rsa-cryptosystem", "An asymmetric public-key cryptosystem based on the difficulty of factoring large numbers.", "cryptography"),
    ("Public-Key Cryptography", "public-key-cryptography", "Cryptography using pairs of keys — public and private — that let anyone encrypt but only the private holder decrypt.", "cryptography"),
    ("Symmetric Encryption", "symmetric-encryption", "Encryption in which the same key is used for both encryption and decryption.", "cryptography"),
    ("Advanced Encryption Standard", "aes", "A widely-adopted symmetric-key encryption standard using 128-, 192-, or 256-bit keys.", "cryptography"),
    ("Elliptic Curve Cryptography", "ecc", "Cryptography based on the algebraic structure of elliptic curves over finite fields.", "cryptography"),
    ("Diffie-Hellman Key Exchange", "diffie-hellman", "A method for two parties to jointly establish a shared secret over an insecure channel.", "cryptography"),
    ("Machine Learning", "machine-learning", "The study of algorithms that improve automatically through experience with data.", "ai"),
    ("Neural Network", "neural-network", "A model inspired by biological neurons, consisting of layers of connected artificial neurons.", "ai"),
    ("Deep Learning", "deep-learning", "Machine learning using neural networks with many layers.", "ai"),
    ("Convolutional Neural Network", "convolutional-neural-network", "A neural network specialized for grid-like data such as images, using convolutional layers.", "ai"),
    ("Recurrent Neural Network", "recurrent-neural-network", "A neural network with connections forming a cycle, allowing use of internal memory over time.", "ai"),
    ("Transformer Architecture", "transformer-architecture", "A neural network architecture based on self-attention, central to modern large language models.", "ai"),
    ("Backpropagation", "backpropagation", "The algorithm for computing gradients of a loss function with respect to a neural network's weights.", "ai"),
    ("Gradient Descent", "gradient-descent", "An iterative optimization algorithm for finding a local minimum of a differentiable function.", "optimization"),
    ("Stochastic Gradient Descent", "sgd", "A variant of gradient descent that updates parameters using a random subset (mini-batch) of data.", "optimization"),
    ("Supervised Learning", "supervised-learning", "Machine learning where the model learns from labeled input-output pairs.", "ai"),
    ("Unsupervised Learning", "unsupervised-learning", "Machine learning where the model finds patterns in unlabeled data.", "ai"),
    ("Reinforcement Learning", "reinforcement-learning", "Machine learning where an agent learns by acting in an environment and receiving rewards.", "ai"),
    ("Clustering (ML)", "clustering-ml", "The task of grouping a set of objects so that objects in the same group are more similar to each other.", "ai"),
    ("K-Means Clustering", "k-means-clustering", "A partitioning algorithm that clusters n points into k groups by minimizing within-cluster variance.", "ai"),
    ("Decision Tree", "decision-tree", "A tree-structured classifier or regressor where each internal node tests a feature and each leaf assigns a prediction.", "ai"),
    ("Random Forest", "random-forest", "An ensemble learning method that builds many decision trees on random subsets and aggregates their predictions.", "ai"),
    ("Support Vector Machine", "support-vector-machine", "A supervised learning model that finds the hyperplane maximizing the margin between classes.", "ai"),
    ("Naive Bayes Classifier", "naive-bayes", "A probabilistic classifier based on Bayes' theorem with a strong (naive) independence assumption between features.", "ai"),
    ("Attention Mechanism", "attention-mechanism", "A neural-network technique that lets a model focus on different parts of the input when producing each output token.", "ai"),
    ("Diffusion Model", "diffusion-model", "A generative model that learns to reverse a gradual noising process to synthesize new data.", "ai"),
]
for name, slug, narr, subsumed_by in ALGORITHMS:
    SCIENCES.append(C(name, slug, "algorithm", narr, subsumed_by=subsumed_by,
                     wp=name.replace(" ", "_")))

# ---- DATA STRUCTURES ----
DATA_STRUCTURES = [
    ("Array", "array-data", "A collection of elements identified by index, stored contiguously in memory."),
    ("Linked List", "linked-list", "A linear data structure where elements are chained via pointers rather than contiguity."),
    ("Doubly Linked List", "doubly-linked-list", "A linked list where each node holds pointers to both the next and the previous node."),
    ("Stack", "stack-data", "A last-in, first-out (LIFO) data structure supporting push and pop."),
    ("Queue", "queue-data", "A first-in, first-out (FIFO) data structure supporting enqueue and dequeue."),
    ("Deque", "deque", "A double-ended queue allowing insertion and removal at both ends."),
    ("Hash Table", "hash-table", "A data structure mapping keys to values using a hash function; average-case O(1) lookup."),
    ("Binary Tree", "binary-tree", "A tree where every node has at most two children."),
    ("Binary Search Tree", "binary-search-tree", "A binary tree with the invariant that left subtree keys are smaller and right larger than the node."),
    ("Balanced Tree", "balanced-tree", "A tree maintained near-optimally shallow to ensure O(log n) operations."),
    ("AVL Tree", "avl-tree", "A self-balancing binary search tree named for its inventors Adelson-Velsky and Landis."),
    ("Red-Black Tree", "red-black-tree", "A self-balancing binary search tree with color-coded nodes and balance invariants."),
    ("B-Tree", "b-tree", "A self-balancing tree data structure that maintains sorted data and allows sequential access; commonly used in databases."),
    ("Heap (data structure)", "heap-data", "A tree-based data structure satisfying the heap property; the basis of priority queues and heap sort."),
    ("Priority Queue", "priority-queue", "A data structure where elements are served according to priority, typically implemented with a heap."),
    ("Trie", "trie", "A tree data structure storing strings as paths, used for prefix search and autocomplete."),
    ("Graph (data structure)", "graph-data", "A data structure representing vertices and edges; typically stored as adjacency lists or matrices."),
    ("Bloom Filter", "bloom-filter", "A space-efficient probabilistic data structure for set membership queries with false positives but no false negatives."),
    ("Union-Find", "union-find", "A data structure tracking a partition of a set into disjoint subsets, supporting fast union and find operations."),
    ("Skip List", "skip-list", "A probabilistic data structure allowing fast search within an ordered sequence via multi-level linked lists."),
]
for name, slug, narr in DATA_STRUCTURES:
    SCIENCES.append(C(name, slug, "data-structure", narr, subsumed_by="data-structures",
                     wp=name.replace(" ", "_")))

# ---- NETWORKING + PROTOCOLS ----
NETWORKING = [
    ("TCP/IP", "tcp-ip", "The suite of communication protocols underlying the internet — Transmission Control Protocol / Internet Protocol.", ["Internet protocol suite"], "Internet_protocol_suite"),
    ("IP Address", "ip-address", "A numerical label assigned to each device on an IP network.", ["IPv4", "IPv6"], "IP_address"),
    ("HTTP", "http", "HyperText Transfer Protocol — the application-layer protocol of the World Wide Web.", [], "Hypertext_Transfer_Protocol"),
    ("HTTPS", "https", "HTTP over Transport Layer Security — encrypted HTTP.", [], "HTTPS"),
    ("TLS", "tls", "Transport Layer Security — the successor of SSL for cryptographically-secured network communication.", ["SSL", "Transport Layer Security"], "Transport_Layer_Security"),
    ("DNS", "dns", "The Domain Name System — the phonebook of the internet, translating names to IP addresses.", ["Domain Name System"], "Domain_Name_System"),
    ("SMTP", "smtp", "Simple Mail Transfer Protocol — the standard protocol for sending email.", [], "Simple_Mail_Transfer_Protocol"),
    ("IMAP", "imap", "Internet Message Access Protocol — for retrieving email while leaving it on the server.", [], "Internet_Message_Access_Protocol"),
    ("SSH", "ssh", "Secure Shell — a cryptographic network protocol for secure remote login and command execution.", [], "Secure_Shell"),
    ("FTP", "ftp", "File Transfer Protocol — one of the oldest internet protocols for moving files between hosts.", [], "File_Transfer_Protocol"),
    ("OSI Model", "osi-model", "The seven-layer reference model for network communication — physical, data link, network, transport, session, presentation, application.", [], "OSI_model"),
    ("Ethernet", "ethernet", "The dominant family of wired local-area network technologies.", [], "Ethernet"),
    ("Wi-Fi", "wi-fi", "Family of wireless networking protocols based on the IEEE 802.11 standards.", ["WiFi", "wireless LAN"], "Wi-Fi"),
    ("Cellular Data (5G)", "5g", "The fifth-generation mobile-network technology, offering higher throughput and lower latency than 4G.", ["fifth generation"], "5G"),
    ("BGP", "bgp", "Border Gateway Protocol — the routing protocol that stitches together the internet's autonomous systems.", [], "Border_Gateway_Protocol"),
    ("URL", "url", "Uniform Resource Locator — the address of a resource on the web.", [], "URL"),
    ("Client-Server Model", "client-server-model", "A network architecture where clients request services from servers.", [], "Client%E2%80%93server_model"),
    ("Peer-to-Peer", "peer-to-peer", "A network architecture where participants act as both clients and servers.", ["P2P"], "Peer-to-peer"),
    ("REST", "rest-api", "Representational State Transfer — an architectural style for network-based software.", [], "Representational_state_transfer"),
    ("Firewall", "firewall", "A network security device or software that monitors and controls incoming and outgoing traffic based on rules.", [], "Firewall_(computing)"),
]
for name, slug, narr, extras, wp in NETWORKING:
    SCIENCES.append(C(name, slug, "protocol", narr, extras=extras, subsumed_by="networking", wp=wp))

# ---- OPERATING SYSTEMS + SYSTEMS ----
SYSTEMS_CS = [
    ("Operating System", "operating-system", "System software managing hardware, software resources, and providing services to programs.", ["OS"], "Operating_system"),
    ("Kernel", "kernel", "The core component of an operating system, managing hardware access and resource allocation.", [], "Kernel_(operating_system)"),
    ("Process", "process", "An instance of a running program with its own address space and resources.", [], "Process_(computing)"),
    ("Thread", "thread-cs", "A unit of execution within a process; multiple threads share the process's memory.", [], "Thread_(computing)"),
    ("File System", "file-system", "The method by which an operating system organizes and stores files on storage devices.", [], "File_system"),
    ("Inode", "inode", "A data structure describing a file-system object such as a file or directory in Unix-like systems.", [], "Inode"),
    ("Device Driver", "device-driver", "A software component allowing the operating system to interact with a specific hardware device.", [], "Device_driver"),
    ("System Call", "system-call", "The programmatic way a program requests a service from the operating system kernel.", ["syscall"], "System_call"),
    ("Semaphore", "semaphore", "A synchronization primitive with a counter, used to control access to shared resources.", [], "Semaphore_(programming)"),
    ("Mutex", "mutex", "A mutual-exclusion synchronization primitive — either locked or unlocked.", [], "Mutual_exclusion"),
    ("Scheduler", "scheduler", "The operating-system component that decides which process runs when.", [], "Scheduling_(computing)"),
    ("Paging", "paging", "Memory-management scheme where the OS stores and retrieves data from secondary storage in fixed-size blocks called pages.", [], "Memory_paging"),
    ("Virtual Machine", "virtual-machine", "An emulation of a computer system providing the functionality of a physical computer.", ["VM"], "Virtual_machine"),
    ("Container", "container-computing", "OS-level virtualization for running isolated application instances sharing the same kernel.", [], "Containerization_(computing)"),
    ("Hypervisor", "hypervisor", "Software or firmware that creates and runs virtual machines.", [], "Hypervisor"),
    ("Distributed System", "distributed-system", "A system whose components run on networked computers and communicate by passing messages.", [], "Distributed_computing"),
    ("Consensus Algorithm", "consensus-algorithm", "A protocol enabling a distributed system to agree on a single data value or state.", ["Paxos", "Raft"], "Consensus_(computer_science)"),
    ("CAP Theorem", "cap-theorem", "In a distributed data store, one can guarantee at most two of Consistency, Availability, and Partition tolerance.", [], "CAP_theorem"),
    ("Load Balancing", "load-balancing", "The technique of distributing workloads across multiple resources to optimize resource use and throughput.", [], "Load_balancing_(computing)"),
    ("Sharding", "sharding", "A partitioning technique splitting large databases into smaller, faster pieces called shards.", [], "Shard_(database_architecture)"),
]
for name, slug, narr, extras, wp in SYSTEMS_CS:
    SCIENCES.append(C(name, slug, "architecture", narr, extras=extras, subsumed_by="systems", wp=wp))

# ---- PROGRAMMING PARADIGMS + LANGUAGES ----
PARADIGMS = [
    ("Programming Language", "programming-language", "A formal language comprising instructions for a computer.", ["language"], "Programming_language"),
    ("Imperative Programming", "imperative-programming", "Programming paradigm that uses statements changing a program's state.", [], "Imperative_programming"),
    ("Declarative Programming", "declarative-programming", "Programming paradigm that expresses the logic of computation without describing control flow.", [], "Declarative_programming"),
    ("Functional Programming", "functional-programming", "Programming paradigm treating computation as evaluation of mathematical functions, avoiding state and mutable data.", [], "Functional_programming"),
    ("Object-Oriented Programming", "object-oriented-programming", "Programming paradigm based on 'objects' — data with associated procedures — and messages between them.", ["OOP"], "Object-oriented_programming"),
    ("Logic Programming", "logic-programming", "Programming paradigm expressing computation as a set of logical rules — Prolog is the canonical example.", [], "Logic_programming"),
    ("Static Typing", "static-typing", "Type checking performed at compile time.", [], "Type_system"),
    ("Dynamic Typing", "dynamic-typing", "Type checking performed at run time.", [], "Type_system"),
    ("Type System", "type-system", "A logical system for classifying constructs of a program by types.", [], "Type_system"),
    ("Higher-Order Function", "higher-order-function", "A function that takes other functions as arguments or returns a function.", [], "Higher-order_function"),
    ("Closure", "closure", "A function bundled with references to its surrounding lexical state.", [], "Closure_(computer_programming)"),
    ("Continuation", "continuation", "An abstraction representing 'the rest of the computation' at a given point.", [], "Continuation"),
    ("Monad", "monad", "A design pattern from category theory used to structure computations with effects in functional languages.", [], "Monad_(functional_programming)"),
    ("Immutability", "immutability", "The property that an object's state cannot change after creation.", [], "Immutable_object"),
    ("Lazy Evaluation", "lazy-evaluation", "An evaluation strategy that delays computation of an expression until its value is needed.", ["call-by-need"], "Lazy_evaluation"),
    ("Eager Evaluation", "eager-evaluation", "An evaluation strategy that computes an expression as soon as it is bound.", ["strict evaluation"], "Eager_evaluation"),
    ("Metaprogramming", "metaprogramming", "Writing programs that write, manipulate, or reason about other programs.", [], "Metaprogramming"),
    ("Macro (programming)", "macro-programming", "A rule specifying how an input sequence should be mapped to an output sequence at compile time.", [], "Macro_(computer_science)"),
    ("Domain-Specific Language", "dsl", "A programming language specialized to a particular application domain.", ["DSL"], "Domain-specific_language"),
    ("Turing-Complete", "turing-complete", "A property of a computational system that can simulate any Turing machine.", [], "Turing_completeness"),
    ("Reference (CS)", "reference", "A value referring to another value in memory, enabling shared and mutable state.", ["pointer"], "Reference_(computer_science)"),
    ("Pointer", "pointer", "A programming-language reference to a memory location.", [], "Pointer_(computer_programming)"),
    ("Concurrency Primitive", "concurrency-primitive", "Low-level operations enabling coordination between concurrent tasks — locks, atomics, futures.", [], "Concurrency_control"),
]
for name, slug, narr, extras, wp in PARADIGMS:
    kind = "abstraction" if slug in ("higher-order-function", "closure", "monad", "immutability", "reference", "pointer", "concurrency-primitive", "macro-programming", "continuation") else "framework"
    SCIENCES.append(C(name, slug, kind, narr, extras=extras, subsumed_by="programming-languages", wp=wp))

# ---- DATABASES ----
DATABASES = [
    ("Database", "database", "An organized collection of data, generally stored and accessed electronically.", [], "Database"),
    ("Relational Database", "relational-database", "A database structured to recognize relations between stored items using tables.", ["RDBMS"], "Relational_database"),
    ("SQL", "sql", "Structured Query Language — the domain-specific language for managing relational databases.", ["Structured Query Language"], "SQL"),
    ("NoSQL Database", "nosql-database", "A database that stores and retrieves data without the tabular relations of relational databases.", [], "NoSQL"),
    ("Document Database", "document-database", "A NoSQL database storing data as flexible JSON-like documents.", [], "Document-oriented_database"),
    ("Key-Value Store", "key-value-store", "A NoSQL database that stores data as a collection of key-value pairs.", [], "Key%E2%80%93value_database"),
    ("Graph Database", "graph-database", "A NoSQL database using graph structures (nodes and edges) for semantic queries.", [], "Graph_database"),
    ("Column-Family Store", "column-family-store", "A NoSQL database organizing data by columns rather than rows for analytic workloads.", [], "Wide-column_store"),
    ("ACID", "acid", "Set of properties guaranteeing database transactions are Atomic, Consistent, Isolated, Durable.", [], "ACID"),
    ("Normalization (DB)", "database-normalization", "The process of structuring a relational database to minimize redundancy.", [], "Database_normalization"),
    ("Foreign Key", "foreign-key", "A column in one table that uniquely identifies a row in another table.", [], "Foreign_key"),
    ("Primary Key", "primary-key", "A column or set of columns uniquely identifying each row in a table.", [], "Primary_key"),
    ("Index (DB)", "database-index", "A data structure improving the speed of data-retrieval operations in a database.", [], "Database_index"),
    ("Transaction", "transaction", "A sequence of operations executed as a single logical unit; either all succeed or none do.", [], "Database_transaction"),
    ("Join", "sql-join", "A SQL operation combining rows from two or more tables based on a related column.", [], "Join_(SQL)"),
]
for name, slug, narr, extras, wp in DATABASES:
    kind = "protocol" if slug in ("sql",) else "abstraction"
    SCIENCES.append(C(name, slug, kind, narr, extras=extras, subsumed_by="databases", wp=wp))

# ---- INFORMATION THEORY ----
INFO = [
    ("Bit", "bit", "The basic unit of information — a single 0 or 1.", ["binary digit"], "Bit"),
    ("Byte", "byte", "A unit of digital information typically consisting of 8 bits.", [], "Byte"),
    ("Entropy (info theory)", "shannon-entropy", "The average level of information or 'surprise' inherent to a random variable's possible outcomes.", ["Shannon entropy"], "Entropy_(information_theory)"),
    ("Channel Capacity", "channel-capacity", "The maximum rate at which information can be reliably transmitted over a communication channel.", [], "Channel_capacity"),
    ("Shannon-Hartley Theorem", "shannon-hartley-theorem", "Theorem giving the maximum rate at which information can be transmitted over a communication channel with a given bandwidth in the presence of noise.", [], "Shannon%E2%80%93Hartley_theorem"),
    ("Huffman Coding", "huffman-coding", "An optimal prefix-code compression algorithm.", [], "Huffman_coding"),
    ("Lossless Compression", "lossless-compression", "Data compression that allows the original data to be perfectly reconstructed.", [], "Lossless_compression"),
    ("Lossy Compression", "lossy-compression", "Data compression that reduces size by discarding some information, trading fidelity for size.", [], "Lossy_compression"),
    ("Error Correcting Code", "error-correcting-code", "A code that adds redundancy allowing errors introduced by noise to be detected and corrected.", ["ECC", "Hamming code"], "Error_correction_code"),
    ("Kolmogorov Complexity", "kolmogorov-complexity", "The length of the shortest program that produces a given object as output — a measure of algorithmic randomness.", [], "Kolmogorov_complexity"),
]
for name, slug, narr, extras, wp in INFO:
    kind = "quantity" if slug in ("bit", "byte", "shannon-entropy", "channel-capacity", "kolmogorov-complexity") else ("theorem" if "theorem" in slug else "method")
    SCIENCES.append(C(name, slug, kind, narr, extras=extras, subsumed_by="information-theory", wp=wp))

# ---- SUB-AREAS ----
for name, slug, narr in [
    ("Computer Science", "computer-science", "The study of computers and computation, from theory to applications."),
    ("CS Theory", "cs-theory", "The mathematical study of computation — computability, complexity, algorithms, formal languages."),
    ("Information Theory", "information-theory", "The mathematical study of quantification, storage, and communication of information."),
    ("Cryptography", "cryptography", "The practice and study of secure communication in the presence of adversaries."),
    ("Artificial Intelligence", "ai", "The field concerned with building systems that perform tasks requiring intelligence."),
    ("Machine Learning (field)", "machine-learning-field", "The subfield of AI concerned with algorithms that improve from data."),
    ("Systems", "systems", "The design and study of computer systems — operating systems, distributed systems, virtualization."),
    ("Networking", "networking", "The study of computer networks — protocols, topologies, routing, security."),
    ("Databases", "databases", "The theory and practice of data storage, retrieval, and management."),
    ("Programming Languages", "programming-languages", "The design, implementation, and analysis of programming languages."),
    ("Software Engineering", "software-engineering", "The disciplined application of engineering principles to software development."),
    ("Human-Computer Interaction", "hci", "The study of how people interact with computers and how to design more usable interfaces."),
    ("Computer Graphics", "computer-graphics", "The generation of visual images and animations by computers."),
    ("Compilers", "compilers-field", "The design of programs that translate between programming languages."),
    ("Operating Systems (field)", "os-field", "The design of operating systems and their components."),
    ("Sorting", "sorting", "The task of arranging items in a defined order — canonical setting for algorithm analysis."),
    ("Searching", "searching", "The task of finding an item in a collection — foundational to computer science."),
    ("Graph Algorithms", "graph-algorithms", "Algorithms operating on graph structures — traversal, shortest paths, matching, flow."),
    ("Optimization", "optimization", "The task of finding the best element from some set of available alternatives."),
    ("Algorithm Design", "algorithm-design", "The methodology of building efficient algorithms — paradigms like divide-and-conquer, dynamic programming, greedy."),
    ("Data Structures (field)", "data-structures", "The study of how to organize data for efficient access and modification."),
]:
    SCIENCES.append(S(name, "computing", "classification",
                     id_slug=slug, narrative=narr,
                     subsumed_by="computing",
                     provenance=W(name.replace(" ", "_"))))
