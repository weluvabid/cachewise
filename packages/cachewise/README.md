# Cachewise

Cachewise is a TypeScript in-memory cache with a logical byte budget, cost-aware admission and eviction, and an LRU baseline. It also supports TTL, per-key single-flight computation, per-caller cancellation, invalidation, disposal callbacks, and statistics.

The workspace [README](../../README.md) contains the overview and quick-start example.

## Documentation

- [API reference](../../docs/api.md)
- [Architecture](../../docs/architecture.md)
- [Eviction and admission](../../docs/eviction-and-admission.md)
- [Concurrency](../../docs/concurrency.md)
- [Memory accounting](../../docs/memory-accounting.md)
- [Design decisions](../../docs/design-decisions.md)
- [Benchmarking](../../docs/benchmarking.md)

## Development

From the workspace root:

```sh
pnpm install
pnpm check
pnpm --filter cachewise benchmark
```

The benchmark command builds the package before running the deterministic workload suite. See the benchmarking guide for its metrics and limitations.

The package publishes ESM and requires Node.js 24 or later.
