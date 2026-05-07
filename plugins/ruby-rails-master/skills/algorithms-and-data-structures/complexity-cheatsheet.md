# Complexity & Data Structures Cheatsheet

A reach-for-it reference for Big-O of the operations you actually do. Pair with `SKILL.md`/`lessons.md` for the deeper material.

## Common operations by structure

| Structure | Access | Search | Insert | Delete | Notes |
|---|---|---|---|---|---|
| Array (Ruby `Array`) | O(1) | O(n) | O(n) (head/mid), O(1)* (tail) | O(n) (head/mid), O(1)* (tail) | Amortized for tail; `Array#push`/`pop` |
| Linked list | O(n) | O(n) | O(1) at known node | O(1) at known node | Rare in Ruby — `Array` covers most cases |
| Hash table (Ruby `Hash`) | O(1)* | O(1)* | O(1)* | O(1)* | * = expected; worst case O(n) on bad hashing |
| Set (Ruby `Set`) | — | O(1)* | O(1)* | O(1)* | Hash-backed in Ruby |
| Sorted array | O(1) | O(log n) | O(n) | O(n) | Binary search via `bsearch` |
| Binary heap | O(1) for top | — | O(log n) | O(log n) | Ruby: no stdlib; use `algorithms` gem or implement |
| Balanced BST | O(log n) | O(log n) | O(log n) | O(log n) | Ruby: no stdlib; rare in practice |
| Trie | — | O(m) m=key length | O(m) | O(m) | Prefix search dominates |
| Union-Find (DSU) | — | — | O(α(n)) ≈ O(1) | — | For dynamic connectivity |
| B-tree | — | O(log n) | O(log n) | O(log n) | Used by DBs/filesystems; high fanout |
| Bloom filter | — | O(k) hashes | O(k) | not supported | False positives only |

## Sorting algorithms

| Algorithm | Best | Avg | Worst | Stable | Space | Notes |
|---|---|---|---|---|---|---|
| Insertion | n | n² | n² | yes | 1 | Best on small or near-sorted |
| Mergesort | n log n | n log n | n log n | yes | n | Predictable; good for linked lists |
| Quicksort | n log n | n log n | n² | no | log n | Best constants; randomize pivot |
| Heapsort | n log n | n log n | n log n | no | 1 | No worst-case; bad cache behavior |
| Timsort | n | n log n | n log n | yes | n | Default in Python/Java/Ruby (≥ 2.6) |
| Counting | n+k | n+k | n+k | yes | n+k | Integer keys, small range |
| Radix | nk | nk | nk | yes | n+k | Fixed-width keys |

Ruby's `Array#sort` uses an introspective hybrid; `sort_by(&:key)` uses Schwartzian transform for cheaper key extraction.

## Big-O thresholds (rules of thumb)

| n | What's tractable | What's not |
|---|---|---|
| 10⁶ | O(n), O(n log n) | O(n²) |
| 10⁵ | O(n²) (a few seconds) | O(n³) |
| 10³ | O(n³) | O(n⁴), exponential |
| 25–40 | O(2ⁿ) (with bitmask DP) | O(n!) |
| 10–12 | O(n!) (with smart pruning) | — |

If your inputs are bigger than the column-of-tractability, don't even try the corresponding algorithm without optimization.

## Algorithmic strategy decision tree

When stuck:

```
Is the answer over a range? (sum/max/min/count)
├── Yes → Try sorting / two-pointer / sliding window
│         Or: prefix sums / Fenwick / segment tree
└── No → Is there a graph?
        ├── Yes → BFS (unweighted shortest), Dijkstra (non-neg), Bellman-Ford (negative)
        │         Or: MST (Kruskal/Prim), SCC (Tarjan/Kosaraju), flow
        └── No → Is the optimal substructure decomposable?
                 ├── Yes + overlapping → DP
                 ├── Yes + greedy property → Greedy
                 └── No → Brute force or NP-hard escape: approximation, ILP, SAT
```

## Recurrences (Master Theorem)

For T(n) = aT(n/b) + f(n):
- f(n) = O(n^(log_b(a) - ε)) → T(n) = Θ(n^log_b(a))
- f(n) = Θ(n^log_b(a)) → T(n) = Θ(n^log_b(a) · log n)
- f(n) = Ω(n^(log_b(a) + ε)) and regular → T(n) = Θ(f(n))

| Recurrence | Solution | Example |
|---|---|---|
| T(n) = T(n/2) + 1 | Θ(log n) | Binary search |
| T(n) = 2T(n/2) + n | Θ(n log n) | Mergesort |
| T(n) = 2T(n/2) + 1 | Θ(n) | Tree traversal |
| T(n) = T(n-1) + 1 | Θ(n) | Linear recursion |
| T(n) = T(n-1) + n | Θ(n²) | Quadratic recursion |
| T(n) = 2T(n-1) + 1 | Θ(2ⁿ) | Hanoi, naive Fib |
| T(n) = 7T(n/2) + n² | Θ(n^log₂7) ≈ n^2.81 | Strassen |

## Classic problems by recognized pattern

| Pattern | Examples |
|---|---|
| Sort + sweep | Closest pair, interval merging, k-th smallest |
| Hash dedupe | Two-sum, anagram grouping, finding duplicates |
| Two pointers | Sum to target on sorted, palindrome check |
| Sliding window | Longest no-repeat substring, max-sum subarray of size k |
| Divide and conquer | Mergesort, FFT, matrix multiply |
| Greedy | Activity selection, Huffman, Dijkstra, MST |
| DP (1D) | Climbing stairs, max subarray, LIS |
| DP (2D) | Edit distance, LCS, knapsack, coin change |
| DP (interval) | Matrix chain mult, palindrome partitioning |
| DP (bitmask) | TSP, assignment with small n ≤ 20 |
| BFS | Unweighted shortest path, level-order |
| Dijkstra | Non-negative shortest path |
| Topological sort | Course schedule, build order |
| Union-Find | Dynamic connectivity, cycle detection in undirected |
| Trie | Prefix search, autocomplete |
| Bit manipulation | Find single, count bits, subset enumeration |

## Ruby-specific notes

- `Array#bsearch` is O(log n) on a sorted array.
- `Hash#each` order is insertion order (since 1.9).
- `Integer` is unbounded — overflow is a non-issue at the language level (but DB columns aren't).
- `Array#sort` and `Array#sort_by` are stable since Ruby 2.3.
- `Set` is in stdlib as `require "set"`; backed by a Hash.
- `lazy` on enumerables for streaming: `(1..Float::INFINITY).lazy.select(&:prime?).first(10)`.
- Use `Hash.new { |h, k| h[k] = [] }` for default-value hashes (poor man's `defaultdict`).
- For priority queues, the `algorithms` gem or hand-rolled heap; or sort a small array.

## Rails-specific notes

- AR `find` is a primary-key lookup (B-tree, O(log n)).
- AR `where(...)` without an index is a sequential scan (O(n) on the table).
- Composite indexes match leftmost prefix only — `INDEX (a, b, c)` covers `(a)`, `(a, b)`, `(a, b, c)` but not `(b)` alone.
- `count` is `SELECT COUNT(*)` — O(n) on big tables; cache it (`counter_cache`) when called often.
- `find_each(batch_size: 1000)` is O(n) memory-bounded.
- `in_batches.update_all(...)` is the right way to bulk-update.
- N+1 query = N×O(query) instead of 1×O(query) — eager-load.

## Recognizing NP-hardness

If your problem is hard, look for these patterns:
- Variable assignment satisfying many constraints → SAT
- Subset selection optimizing a sum → subset sum / knapsack
- Routing through every node → Hamiltonian / TSP
- Coloring / partitioning → graph coloring / set cover
- Scheduling with constraints → job-shop / interval scheduling

If you recognize one, your moves are:
1. Restricted version that's in P
2. Approximation (constant-factor or PTAS)
3. Exact via SAT solver / ILP / branch-and-bound
4. Exact only for small n
5. Heuristic that's "good enough"

Don't grind on an exact polynomial-time solution to a known NP-hard problem.
