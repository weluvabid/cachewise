# cachewise

Computation-aware caching under a predictable logical memory budget.

Cachewise is ESM-first and supports Node.js 24+ and modern browsers. The package is not published yet.

```ts
import { Cache } from 'cachewise';

const cache = new Cache<string, Uint8Array>({
  maxBytes: 16 * 1024 * 1024,
  estimateSize: (value) => value.byteLength,
});

const result = await cache.getOrCompute('report', async () => createReport(), {
  computeCost: 20,
});
```

See the repository's `docs/api.md` for the API and accounting semantics.
