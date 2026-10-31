# Cachewise

In-memory TypeScript cache with a logical byte budget and a cost-aware admission/eviction policy. Also provides an LRU baseline, TTL, async single-flight computation, cancellation, invalidation, disposal hooks, and statistics.

The workspace-level [README](../../README.md) has the project overview and quick example.

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
pnpm --filter cachewise test
pnpm --filter cachewise build
pnpm --filter cachewise benchmark
```

The package currently exports ESM and requires Node.js 24 or newer.
