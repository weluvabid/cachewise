# Design decisions

This page records the behavior visible in the current implementation. It is not a claim that every choice is the only reasonable one.

## Logical byte budget

Cachewise accounts for caller-estimated value sizes instead of trying to inspect the JavaScript heap. Heap inspection is runtime-specific and still would not give a reliable, low-cost measure of retained memory. The trade-off is that callers must supply sensible estimates for values the built-in estimator does not understand.

## Cost-aware policy with an LRU baseline

The default policy combines recency, bounded reuse estimates, caller-provided recomputation cost, and logical size. LRU remains available so the same cache mechanics can be measured against a familiar baseline.

The score is intentionally heuristic. It is easy to explain and deterministic for a given entry state and clock value, but it cannot predict future access patterns.

## Bounded frequency state

Frequency tracking uses a fixed-width Count-Min Sketch with four rows of 8-bit counters and periodic aging. It avoids keeping a counter per key, so unique-key churn does not grow the sketch. Object keys use a separate bounded LRU identity table; symbol descriptions can collide. The sketch is approximate and can overestimate frequency when hashes collide.

In-flight invalidation state lives on each active flight rather than in a historical per-key version map, so completed keys leave no invalidation metadata behind.

## Synchronous core

Cache reads, writes, policy decisions, and accounting are synchronous. This keeps ordering and state transitions straightforward inside one JavaScript agent. `getOrCompute` adds asynchronous coordination only where the work itself is asynchronous.

## Single-flight rather than implicit cancellation ownership

Concurrent callers share one factory execution, but each caller owns its own wait. One caller cancelling should not cancel work still needed by another caller. The shared factory is aborted only after the final waiter leaves.

## No automatic expiry timer

TTL is checked on access and by `pruneExpired()`. An idle expired entry can remain in the map and continue contributing to `bytesUsed` until it is accessed or pruned. This avoids a timer per entry and keeps lifecycle behavior explicit.

## Current trade-offs

- Admission planning scans entries and allocates temporary collections. It favors a straightforward implementation over an indexed eviction structure.
- The cost-aware recency half-life is currently fixed internally at 60 seconds.
- The default estimator returns zero for ordinary objects. Cachewise applies a one-byte minimum charge to every retained entry, but callers should still supply realistic estimates for object-heavy workloads.
- Exceptions from disposal and event callbacks are isolated and can be observed through `onCallbackError`. Exceptions from the error handler itself are swallowed so they cannot corrupt cache state transitions.
- `maxBytes` must be a positive safe integer. Rejecting fractional budgets avoids silently turning a positive sub-byte budget into zero or flooring caller input unexpectedly.

These details matter when deciding whether Cachewise fits a workload. The logical value budget and bounded frequency sketch do not imply a strict process-heap ceiling. The active flight map is bounded by concurrent computations, and invalidation metadata is retained only for those active flights.
