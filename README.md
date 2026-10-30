# Cachewise

**Recompute less. Remember smarter.**

Cachewise is a TypeScript cache that prioritizes avoided computation within a logical memory budget.

## Features

- Cost-aware eviction with LRU support.
- Frequency and recency tracking.
- Logical byte-budget accounting.
- TTL and explicit invalidation.
- Async single-flight computation.
- Safe invalidation during async computation.
- Per-caller cancellation.
- Disposal callbacks, events and statistics.

## Usage

```ts
import { Cache } from 'cachewise';

const cache = new Cache<string, Uint8Array>({
  maxBytes: 16 * 1024 * 1024,
  estimateSize: (value) => value.byteLength,
});

const data = await cache.getOrCompute('report:2026-10', async () => buildReport(), {
  computeCost: 25,
});
```

## Memory accounting

Memory usage is estimated, not measured from the JavaScript heap. Provide `size` when setting an entry or configure `estimateSize` for custom value types.

## Development

Requirements: Node.js >=24 and pnpm 12.

```sh
pnpm install
pnpm check
pnpm --filter @cachewise/demo dev
```

CI tests Node.js 24 and 26.

## Design

See [docs/design.md](docs/design.md).
