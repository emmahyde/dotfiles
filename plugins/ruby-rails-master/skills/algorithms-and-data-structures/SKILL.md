---
name: algorithms-and-data-structures
description: Choose the right algorithm and data structure for a problem, analyze its complexity, and recognize classic problem patterns. Use when picking a structure (array vs hash vs tree vs graph), analyzing whether code will scale, designing a non-trivial algorithm, or recognizing that a problem reduces to a known one. Distills CLRS, Sedgewick & Wayne (Algorithms 4e), Skiena (Algorithm Design Manual), and Knuth TAoCP Vol 3 (Sorting & Searching).
---

# Algorithms & Data Structures

The two questions to ask of any algorithm: **does it terminate, and at what cost?** The two questions to ask of any data structure: **what does it make fast, and what does it make slow?**

## Choosing a data structure (decision rules)

| If you need... | Use | Cost |
|---|---|---|
| Indexed access by position, growable | dynamic array / `Vec` / `ArrayList` | O(1) access, O(1)* push, O(n) insert/delete mid |
| Lookup by key, no order | hash table | O(1)* avg; O(n) worst, no ordering |
| Lookup by key, sorted iteration, range queries | balanced BST (red-black, AVL) / sorted map | O(log n) ops |
| Min or max, repeatedly | binary heap | O(log n) push/pop, O(1) peek |
| FIFO | queue (linked list / ring buffer) | O(1) ends |
| LIFO | stack | O(1) |
| Membership-only, fast | hash set | O(1)* |
| String/prefix search | trie or suffix array | O(m) for length-m key |
| Connectivity / dynamic equivalence | union-find (DSU) | nearly O(α(n)) ≈ O(1) |
| Range sum/min updates | Fenwick tree (BIT) or segment tree | O(log n) |
| Approximate membership in tiny space | Bloom filter | O(k) hashes, false positives only |

The default: **array + hash map** solve more problems than anything else. Reach for trees only when you need ordered iteration or range queries.

## Choosing an algorithmic strategy

When you're stuck on a hard problem, run down this list before inventing something:

1. **Brute force / generate-and-test.** Start here to validate correctness. Often gives you a baseline test for the optimized version.
2. **Sorting.** Sort first, then sweep. Many problems collapse from O(n²) to O(n log n) once sorted (e.g. closest pair, interval merging, k-th element).
3. **Hashing.** Replace search with lookup. Two-sum, anagram grouping, dedup, caching memoized calls.
4. **Two pointers / sliding window.** For problems on sorted arrays or contiguous subranges.
5. **Divide and conquer.** Mergesort, quicksort, binary search, FFT, closest pair. Recurrence: T(n) = aT(n/b) + f(n), solve via Master Theorem.
6. **Greedy.** When local optima provably extend to global (matroid structure, exchange argument). Activity selection, Huffman, Dijkstra, MST.
7. **Dynamic programming.** When the problem has overlapping subproblems and optimal substructure. Define the state precisely; write the recurrence; memoize or fill bottom-up.
8. **Graph search.** BFS for shortest unweighted, Dijkstra for non-negative weighted, Bellman-Ford for negative weights, Floyd-Warshall for all-pairs, A* when you have an admissible heuristic.
9. **Reduction.** Reduce your problem to a known one (max flow, 2-SAT, shortest path, MST, sorting). Most "weird" interview problems are flow or DP in disguise.
10. **Randomization.** When deterministic is hard, randomized often gives expected-good behavior with simple code (randomized quicksort, treaps, skip lists, Karger's min-cut).

## Complexity analysis (rules of thumb)

- Anything depending only on `log n` is essentially free up to billions.
- O(n) is the baseline; O(n log n) is "I sorted."
- O(n²) breaks somewhere around n = 10⁴–10⁵; O(n³) at 10³.
- Exponential / O(2ⁿ) breaks around n = 25–40 — bound the search space (bitmask DP, branch-and-bound, meet-in-the-middle) or accept approximation.
- Average ≠ worst. Hash tables, quicksort, randomized BSTs are O(log n) average and O(n) worst — assume worst for adversarial inputs (e.g. user-controlled keys).
- Amortized counts. Vector push is amortized O(1); union-find is amortized O(α(n)). Fine for batch totals; not fine for hard real-time.

## Recognizing classic problems

Many "hard" problems are an old friend in disguise:

- *Find duplicates / pairs that sum to k* → hash set.
- *k-th smallest / largest* → quickselect or heap.
- *Schedule non-overlapping intervals* → sort by end-time, greedy.
- *Edit distance / longest common subsequence / knapsack / coin change* → DP.
- *Shortest path through a grid with obstacles* → BFS.
- *Min cost to connect all nodes* → MST (Kruskal/Prim).
- *Topologically order tasks* → Kahn's algorithm or DFS post-order.
- *Detect cycle in a directed graph* → DFS with three colors, or Kahn's running out of nodes.
- *Strongly connected components* → Tarjan or Kosaraju.
- *Match items left/right* → bipartite matching (Hopcroft-Karp / Hungarian).
- *Find anagrams or duplicates of strings up to permutation* → sort each string, group by sorted form, or use frequency-tuple hash.

## Triggers (when to load this skill)

- Designing or reviewing an algorithm.
- Code is too slow; want to know if a better complexity exists.
- Choosing a data structure for a workload.
- Reading a paper or textbook chapter and want context.
- Estimating whether n = 10⁶ will fit in time / memory.

## Anti-heuristics

- Optimizing constants before complexity. Get to the right Big-O first; only then chase cache locality.
- Reaching for fancy structures (segment tree, splay) when a sorted array + binary search will do.
- Ignoring worst-case in adversarial settings (web inputs, contest, security).
- Confusing "average" complexity with what you'll actually observe.
- Choosing recursion when iteration is clearer; choosing iteration when recursion mirrors the structure.
- Believing benchmarks of yours that don't include warm-up and statistical variance.

See `lessons.md` for the long-form lessons distilled from each book.
