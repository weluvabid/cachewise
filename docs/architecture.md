# Architecture

Cachewise keeps the public API small and splits the work behind it into a few focused pieces.

## Runtime path

`Cache<K, V>` owns the entries and coordinates the other components:

- `Map<K, Entry<K, V>>` stores values and their metadata
- `FrequencySketch<K>` keeps a bounded, decaying estimate of recent reuse
- `EvictionPolicy<K>` chooses a victim when the logical byte budget is full
- The admission check decides whether a candidate is worth keeping instead of that victim
- In-flight computation state deduplicates concurrent `getOrCompute` calls for the same key

The current implementation is synchronous except for `getOrCompute`. There is no background worker, timer, or automatic maintenance loop. Expiration is checked when an entry is accessed or during an explicit prune.

## Insert and admission path

A call to `set` follows this sequence:

1. Resolve entry size, compute cost, and TTL. Sizes are rounded up to whole bytes and charged at a minimum of one byte, so zero-sized estimates cannot bypass the entry-count bound.
2. Validate the values and reject an entry larger than the entire budget.
3. Build a candidate entry.
4. If the candidate fits without eviction, insert it directly. This common path does not copy the resident map or allocate policy records.
5. Under capacity pressure, build one policy snapshot and order potential victims once. The candidate is checked against every victim needed to free enough bytes.
6. Only after the complete plan passes admission are victims removed and the candidate inserted.

Capacity-pressure planning is read-only until the full victim set passes admission. A rejected candidate therefore does not evict entries as a side effect of the attempt.

A replacement is treated as a new candidate: the previous value is excluded from the capacity calculation and is disposed only after the replacement has passed admission.

## Eviction policies

The `lru` policy selects the entry with the smallest `lastAccessedAt` timestamp and always admits a candidate once space has been made.

The default `cost-aware` policy selects the lowest-scoring entry and admits a candidate only when its score is positive and at least as high as the selected victim's score. The score is described in [Eviction and admission](./eviction-and-admission.md).

Both policies scan a temporary candidate list when an insertion needs space. A single-victim insertion uses one linear scan; multi-victim insertion sorts once to establish victim order. Cachewise does not maintain a linked-list LRU structure or a heap of cost scores.

## Frequency tracking

`FrequencySketch` is a fixed-width Count-Min Sketch with four rows of 8-bit counters by default. Each key is hashed into one counter per row; the minimum counter is returned as its estimated frequency. Counters saturate at 255 and are halved after each elapsed half-life period.

The sketch does not retain a per-key `Map`, so unique-key churn cannot grow metadata, and a frequently observed key is not evicted merely because it was inserted earlier. Hash collisions can overestimate frequency; they do not cause the sketch to grow. Object keys receive identities through a bounded LRU identity table with at most `maxTrackedKeys` objects. Distinct local symbols with identical descriptions can collide.

The existing `maxTrackedKeys` option controls the number of counters per row (the sketch width), not a literal number of tracked keys. Larger values reduce collisions at the cost of more fixed memory.

## Async computation

`getOrCompute` stores one in-flight promise per key. Concurrent callers join that promise. Each caller can cancel its own wait with an `AbortSignal`; the underlying factory receives a separate shared signal. When the final waiter leaves, Cachewise aborts the shared signal.

An invalidation flag on each active flight and a cache-wide epoch prevent a factory result from being inserted after that key was invalidated or after `clear()` was called. The original promise still resolves or rejects according to the factory; invalidation controls cache population, not the value returned to callers. Keeping the marker on the active flight avoids retaining historical metadata for keys that are no longer in use.

See [Concurrency](./concurrency.md) for the lifecycle and edge cases.

## Complexity

Let `n` be the number of retained entries and `v` the number of victims needed for an insertion.

- `get`, `has`, and `getEntryMetadata` are expected O(1) map lookups, excluding callback work and expiration cleanup.
- `delete` is expected O(1), excluding callback work.
- `getOrCompute` is expected O(1) to find or register a flight, excluding factory execution and waiter scheduling.
- `entries` and `pruneExpired` are O(n).
- Under capacity pressure, single-victim admission is O(n); multi-victim admission is O(n log n) for the sort plus O(v) for the admission checks.
