# Algorithms & Data Structures — Lessons

Sources: *Introduction to Algorithms* (Cormen, Leiserson, Rivest, Stein — CLRS), *Algorithms 4e* (Sedgewick & Wayne), *The Algorithm Design Manual 3e* (Skiena), *The Art of Computer Programming Vol. 3: Sorting and Searching* (Knuth).

The four books occupy four corners. CLRS is the standard university textbook — proofs, formality, encyclopedic. Sedgewick is the *implementation* textbook — clear Java with empirical analysis. Skiena is the *practitioner's* handbook — "I have a problem; what algorithm fits?" Knuth is the deepest theoretical analysis ever written for sorting and searching, and serves as a reference rather than a read-through.

## Foundations

**Asymptotic analysis (CLRS Ch. 3, Sedgewick 1.4).** Big-O bounds growth from above; Big-Ω from below; Big-Θ both. We almost always reason about worst case unless we explicitly say "expected" or "amortized." For randomized algorithms (quicksort, treap, skip list), expected behavior is over the algorithm's coin flips, not over inputs — so worst-case input is irrelevant.

**The Master Theorem (CLRS Ch. 4).** For T(n) = aT(n/b) + f(n) with a≥1, b>1:
- If f(n) = O(n^(log_b(a) − ε)) → T(n) = Θ(n^log_b(a))
- If f(n) = Θ(n^log_b(a)) → T(n) = Θ(n^log_b(a) · log n)
- If f(n) = Ω(n^(log_b(a) + ε)) and regular → T(n) = Θ(f(n))

Mergesort = T(n) = 2T(n/2) + n → Θ(n log n). Binary search = T(n) = T(n/2) + 1 → Θ(log n). Strassen's matrix multiply = T(n) = 7T(n/2) + n² → Θ(n^log_2 7).

**Amortized analysis (CLRS Ch. 17).** Three methods: aggregate, accounting, potential. Used when an operation occasionally is expensive but the *sequence* is cheap. Vector push: each doubling redistributes the cost so the average per push is O(1). Union-find: with union by rank + path compression, m operations take O(m α(n)).

**Probabilistic analysis & randomized algorithms (CLRS Ch. 5).** Hiring problem, indicator random variables, expected value. Randomization breaks worst-case adversaries. Randomized quicksort has expected O(n log n) regardless of input; deterministic quicksort with naive pivot is O(n²) on already-sorted input.

## Sorting

**Comparison sorts** are bounded below by Ω(n log n) (CLRS 8.1; decision-tree argument: a tree with n! leaves has height log₂(n!) = Θ(n log n)).

| Algorithm | Best | Avg | Worst | Stable | In-place | Notes |
|---|---|---|---|---|---|---|
| Insertion | n | n² | n² | yes | yes | Best on small/almost-sorted |
| Mergesort | n log n | n log n | n log n | yes | no (Θ(n) aux) | Predictable; great for linked lists |
| Quicksort | n log n | n log n | n² | no | yes | Best constants in practice; randomize pivot |
| Heapsort | n log n | n log n | n log n | no | yes | No worst case; bad cache behavior |
| Timsort | n | n log n | n log n | yes | no | Default in Python/Java; merges runs |
| Introsort | n log n | n log n | n log n | no | yes | C++ `std::sort`; quicksort with heapsort fallback |

**Linear-time sorts** (CLRS 8.2–8.4) when input is constrained: counting sort (small integer range), radix sort (fixed-width keys), bucket sort (uniform distribution).

**Knuth (Vol. 3, Ch. 5).** Catalogues every variant — internal vs. external sorting, in-place vs. not, key-based vs. addressable. Key insight: for sorting on tape (external), the goal is to minimize passes over the data, not comparisons. For RAM, comparisons dominate. Knuth proves the lower bound carefully and analyzes constants other books wave away. *When you actually need a custom sort* (huge keys on disk, sorting networks, optimal merging) — Knuth is the source.

**Quickselect (CLRS 9.2).** k-th order statistic in expected O(n). Same partition step as quicksort; recurse only on the side containing rank k. The deterministic *median-of-medians* (Ch. 9.3) gives O(n) worst case with worse constants — beautiful theoretically, rarely used in practice.

## Search structures

**Hash tables (CLRS 11; Sedgewick 3.4).** Universal hashing is the standard answer to adversarial keys. Open addressing (linear/quadratic probing, double hashing) has better cache behavior but worse worst-case clustering; chaining is robust and simple. Always know your load factor (rehash at ~0.7).

**BSTs and balancing.** A plain BST is O(n) worst case (Sedgewick 3.2). Red-black (CLRS 13) and AVL (Knuth) trees give O(log n) worst case. Splay trees (Sedgewick reference) self-organize for working-set behavior — recently accessed keys stay near the root.

**B-trees (CLRS 18).** The data structure of every database and filesystem index. Designed for disk: minimize node accesses by making each node a disk page (fanout in the hundreds). Height is logarithmic in n, base = fanout, so even billions of keys are 3–4 levels deep.

**Skip lists (Sedgewick reference).** Probabilistic O(log n) without rotations. Used in Redis, LevelDB. Easier to implement and reason about than red-black trees.

**Tries (Sedgewick 5.2).** Prefix tree. Searching by prefix is O(length-of-key), independent of dictionary size. Memory hungry; use ternary search trees or compressed (radix/Patricia) variants for large alphabets.

## Graphs (Sedgewick Ch. 4; CLRS Ch. 22–26)

**Representations.** Adjacency list for sparse graphs; adjacency matrix for dense or when you need O(1) edge queries. Memory: list O(V+E), matrix O(V²).

**Search.** BFS uses a queue and gives shortest paths in unweighted graphs. DFS uses a stack (or recursion) and gives topological sort, cycle detection, strongly connected components.

**Shortest paths.**
- Single-source non-negative: **Dijkstra** with binary heap, O((V+E) log V).
- Single-source with negatives: **Bellman-Ford**, O(VE), detects negative cycles.
- All-pairs: **Floyd-Warshall**, O(V³), handles negatives but no negative cycles.
- DAG single-source: topological sort then relax edges in order, O(V+E).
- A* when you have an admissible heuristic — same as Dijkstra with priority `g(n) + h(n)`.

**MST.** Kruskal (sort edges, union-find) or Prim (priority queue, like Dijkstra). Both O(E log V). Use Kruskal when edges are easy to enumerate; Prim when adjacency is convenient.

**Network flow (CLRS 26).** Max-flow = min-cut (Ford-Fulkerson). Edmonds-Karp gives O(VE²). Many problems reduce to flow: bipartite matching, project selection, edge-disjoint paths, min-cut image segmentation.

**Strongly connected components.** Tarjan (one DFS, low-link values) or Kosaraju (two DFS passes on G and Gᵀ). Both O(V+E).

## Dynamic programming (CLRS 15; Sedgewick exercises; Skiena Ch. 8)

The ritual:
1. Define the subproblem precisely. The state is what determines the answer; nothing extraneous.
2. Write the recurrence — how the answer at state s depends on smaller states.
3. Identify the base cases.
4. Decide bottom-up (table) or top-down (memoization). Bottom-up is cache-friendlier; top-down is easier when not all states are needed.
5. Reconstruct the solution from the table by tracing decisions backward.

**Canonical DPs.**
- Fibonacci, climbing stairs (1D, trivial).
- Longest increasing subsequence (n²; with patience sort + binary search, n log n).
- Edit distance (Levenshtein) — 2D table over prefixes.
- Longest common subsequence — 2D over both prefixes.
- 0/1 knapsack — 2D (item × capacity).
- Matrix chain multiplication — interval DP, O(n³).
- Coin change — 1D over amount; classic "how many ways" vs. "minimum coins" distinction.
- Bitmask DP for TSP-style problems on small n (≤20).

**When DP doesn't apply:** when subproblems aren't independent (greedy might still work), or when the state space is exponential (need pruning, branch-and-bound, or approximation).

## Greedy (CLRS 16; Skiena Ch. 6)

Greedy works when:
1. **Greedy choice property.** A globally optimal solution can be reached by making locally optimal choices.
2. **Optimal substructure.** Each remaining subproblem is itself solved optimally.

Prove via exchange argument: take any optimal solution and show you can swap in the greedy choice without losing optimality.

Examples: activity selection (sort by end-time), Huffman coding (always merge two least-frequent), Dijkstra (relax cheapest edge), MST (Kruskal/Prim). Coin change is famously *not* greedy in general (works for US coins; fails for {1, 3, 4} on 6: greedy = 4+1+1, optimal = 3+3).

## Strings (CLRS 32; Sedgewick Ch. 5)

- **Substring search.** Naive O(nm); KMP O(n+m) using failure function; Boyer-Moore sublinear in practice; Rabin-Karp uses rolling hash, O(n+m) expected, useful for multiple-pattern.
- **Suffix arrays / suffix trees.** Build in O(n log n) (or O(n) with linear-time construction); enable substring queries in O(m log n).
- **Tries** for prefix search and dictionary autocomplete.
- **Z-function and prefix function.** Linear-time pattern matching primitives; appear in many string interview problems.

## Skiena's "war stories" lessons

Skiena's *Algorithm Design Manual* is unique in interleaving "war stories" — real cases where picking the right model collapsed a problem. Recurring lessons:

1. **Modeling is the hard part.** "What is the actual graph here?" Often a problem doesn't look like a graph until you draw it. Once you find the right abstraction, the algorithm follows.
2. **Be lazy: reduce to a known problem.** TSP-like? Probably exponential — give up on exact, use approximation. Looks like assignment? Hungarian. Looks like covering? Linear programming relaxation.
3. **The catalog matters more than the proofs.** Skiena's part 2 is a 200-page catalog of algorithms by problem. When you face a new problem, you scan the catalog before inventing.
4. **Empirical analysis beats asymptotic for n ≤ 1000.** Constants and cache behavior dominate. Profile first.

## Knuth's deeper lessons (Vol. 3)

Knuth proves precise constants where other books prove asymptotics. Key takeaways:

- **Sorting networks.** Fixed comparator order, no branching — useful for hardware and SIMD. Bitonic and odd-even mergesort networks have depth O(log² n); AKS has depth O(log n) but enormous constants.
- **External sorting** is its own discipline: replacement selection for run generation, polyphase merge for tape devices. Modern equivalents matter for huge-data sorts on SSDs and distributed shuffles.
- **Hashing.** Knuth carefully analyzes universal hashing, double hashing, the *birthday paradox* (you expect a collision after √n insertions), and the famously underrated *hash function quality* problem.
- **Searching by digital methods.** Tries, B-trees, digital search trees — Knuth derives expected depths and proves optimality results for specific access patterns.
- **The notation matters.** Knuth invented or popularized: O/Ω/Θ in CS, the "harmonic" formulation of expected number of comparisons, big-step generating functions for analysis. *Concrete Mathematics* (Graham/Knuth/Patashnik) is the companion.

## Cross-cutting practical advice

1. **Solve a small case by hand first.** If you can't, you don't understand the problem yet.
2. **Find an invariant.** Most algorithms preserve a loop invariant; finding it is half the proof.
3. **Pick the simplest implementation that meets the asymptotic target.** Don't write a segment tree when a sorted vector + binary search suffices.
4. **Test against the brute force.** For any non-trivial algorithm, write a tiny brute force and run both on random inputs — they should always agree.
5. **Measure before optimizing.** Constants are real but can only be predicted by running.
6. **Cache-aware > cache-oblivious > pointer-chasing.** Modern CPUs reward sequential scans. A `Vec<T>` linear scan often beats a "logarithmic" pointer-following data structure for n ≤ 10⁵.
7. **Floats are not real numbers.** Equality is forbidden; use tolerance. Sums lose precision; use Kahan summation when it matters. NaN poisons all comparisons.
