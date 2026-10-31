# Cachewise

**Recompute less. Remember smarter.**

Cachewise is a TypeScript in-memory cache with a logical byte budget. The default policy looks at four things when deciding what to keep: how recently a value was used, how often it has been reused, how expensive it is to recompute, and how much space it occupies. An LRU policy is also available as a baseline.

The core idea is simple: when the cache is full, the entry used least recently is not always the cheapest one to lose.

## What it provides

- Cost-aware admission and eviction, plus an explicit LRU baseline
- Logical byte budget with caller-provided size estimates
- TTL expiration, explicit deletion, and manual expiration pruning
- Per-key single-flight async computation
- Per-caller cancellation that does not cancel other waiters
- Protection against stale factory results after `delete`, `set`, or `clear`
- Disposal callbacks, events, entry metadata, and aggregate statistics

Cachewise is an in-memory cache for a single JavaScript agent. It is not a distributed cache. The byte budget is an accounting limit, not a hard JavaScript heap limit.

## Quick example

```ts
import { Cache } from 'cachewise';

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

`computeCost` is a relative weight you supply. It is not measured in milliseconds automatically. Keep the scale consistent inside a given cache instance.

## How retention works

The cost-aware policy scores an entry like this:

```text
score = (recency × log2(1 + frequency) × log2(1 + computeCost)) / size
```

Recency decays over time. Larger entries have to justify more of the budget. When space is needed, the policy looks at the lowest-scoring entry and admits the candidate only if its score is at least as high.

This is a heuristic, not a claim of optimal caching. The [eviction and admission notes](docs/eviction-and-admission.md) explain the formula and its limits.

## Documentation

- [Architecture](docs/architecture.md)
- [API reference](docs/api.md)
- [Eviction and admission](docs/eviction-and-admission.md)
- [Concurrency and async computation](docs/concurrency.md)
- [Memory accounting](docs/memory-accounting.md)
- [Design decisions and trade-offs](docs/design-decisions.md)
- [Benchmark methodology](docs/benchmarking.md)

## Development

Requires Node.js 24+ and pnpm 12.

```sh
pnpm install
pnpm check
pnpm --filter @cachewise/demo dev
```

Run the benchmark suite after building:

```sh
pnpm --filter cachewise benchmark
```

The benchmark focuses on expensive hot-set protection under scan pollution, skewed expensive reuse, and mixed-size byte pressure. It reports repeated-trial medians and percentile ranges, with weighted hit ratio as the primary outcome. See [Benchmarking](docs/benchmarking.md) for workload definitions and how to read the numbers.

## License

MIT
