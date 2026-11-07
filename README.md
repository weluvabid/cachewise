# Cachewise

**Recompute less. Remember smarter.**

Cachewise is a TypeScript in-memory cache with a logical byte budget and cost-aware retention. Its default policy considers four signals: recency, estimated reuse frequency, caller-supplied recomputation cost, and logical entry size. An LRU policy is available as a baseline.

The distinction matters when entries have different costs. The least recently used value is not necessarily the least valuable one to retain: a compact result that is expensive to rebuild may be a better use of the budget than a large, cheap value accessed more recently.

Cachewise is designed for one JavaScript agent. It is not a distributed cache, and `maxBytes` is an accounting budget for cached values rather than a hard limit on JavaScript heap or process memory.

## Capabilities

- Cost-aware admission and eviction, with an explicit LRU policy
- Caller-defined logical size estimates and a bounded byte budget
- TTL expiration, explicit deletion, and manual expiration pruning
- Per-key single-flight asynchronous computation
- Per-caller cancellation without cancelling other waiters
- Protection against stale factory results after `set`, `delete`, or `clear`
- Disposal callbacks, synchronous events, entry metadata, and aggregate statistics

## Install

```sh
pnpm add @weluvabid/cachewise
```

## Quick start

```ts
import { Cache } from '@weluvabid/cachewise';

const cache = new Cache<string, Uint8Array>({
  maxBytes: 16 * 1024 * 1024,
  estimateSize: (value) => value.byteLength,
  policy: 'cost-aware',
});

const report = await cache.getOrCompute(
  'report:2026-10',
  async (signal) => {
    const response = await fetch('/api/report', { signal });

    if (!response.ok) {
      throw new Error(`Report request failed: ${response.status}`);
    }

    return new Uint8Array(await response.arrayBuffer());
  },
  {
    computeCost: 25,
    ttl: 60_000,
  },
);
```

`computeCost` is a relative weight supplied by the application. Cachewise does not measure execution time or infer the cost of recomputation. Use a consistent scale within a cache instance. The `estimateSize` callback serves the same purpose for logical size: it lets the application choose an accounting convention that fits its values.

## Retention policy

The cost-aware policy assigns each entry a score based on its current state:

```text
score = (recency × log2(1 + frequency) × log2(1 + computeCost)) / size
```

Recency decays over time, frequency is an approximate bounded estimate, and the logarithms limit the influence of very large frequency and cost weights. Dividing by size favours entries that provide more estimated reuse value per logical byte.

When capacity is needed, Cachewise plans a victim set before changing the cache. The candidate must justify displacing the selected entries; otherwise the insertion is rejected and the existing entries remain in place. This is a heuristic, not an optimal policy or a prediction of future access patterns. The [eviction and admission guide](docs/eviction-and-admission.md) describes the calculation and its limits.

## Documentation

- [Architecture](docs/architecture.md) — runtime components, insertion path, and complexity
- [API reference](docs/api.md) — constructor options, methods, events, and disposal
- [Eviction and admission](docs/eviction-and-admission.md) — scoring, victim selection, and admission
- [Concurrency](docs/concurrency.md) — single-flight lifecycle, cancellation, and invalidation
- [Memory accounting](docs/memory-accounting.md) — estimator behavior and budget boundaries
- [Design decisions](docs/design-decisions.md) — implementation trade-offs and constraints
- [Benchmarking](docs/benchmarking.md) — workloads, metrics, and interpretation

## Development

Requires Node.js 24 or later and pnpm 12.

```sh
pnpm install
pnpm check
```

Run the benchmark suite after building the package:

```sh
pnpm --filter @weluvabid/cachewise benchmark
```

The benchmark suite compares the cost-aware policy with LRU under three deterministic workloads: scan pollution, skewed expensive reuse, and byte pressure. See [Benchmarking](docs/benchmarking.md) for methodology and limitations.

## License

MIT
