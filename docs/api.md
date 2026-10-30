# API

## `new Cache<K, V>(options)`

```ts
const cache = new Cache<string, Uint8Array>({
  maxBytes: 32 * 1024 * 1024,
  estimateSize: (value) => value.byteLength,
  policy: 'cost-aware',
  frequencyHalfLife: 60_000,
});
```

| Option               | Meaning                                                                |
| -------------------- | ---------------------------------------------------------------------- |
| `maxBytes`           | Required logical byte budget. Must be a positive finite number.        |
| `estimateSize`       | Value-size estimator. Defaults to the built-in estimator.              |
| `ttl`                | Default TTL in milliseconds.                                           |
| `policy`             | `cost-aware` by default, or `lru` for the baseline.                    |
| `defaultComputeCost` | Default relative recomputation cost; defaults to `1`.                  |
| `frequencyHalfLife`  | Frequency aging interval in milliseconds; defaults to `60_000`.        |
| `maxTrackedKeys`     | Maximum keys retained by the frequency estimator; defaults to `8_192`. |
| `now`                | Clock injection for deterministic tests.                               |
| `onDispose`          | Called when a retained value leaves the cache.                         |
| `onEvent`            | Receives hit, miss, set, rejection, eviction and compute events.       |

## Methods

- `get(key)` returns a value or `undefined` and updates recency/frequency.
- `has(key)` checks presence without updating recency.
- `set(key, value, options?)` stores a value if it can be admitted within budget.
- `delete(key)` invalidates one key and any pending factory completion for it.
- `clear()` removes all entries and invalidates pending factory completions.
- `getOrCompute(key, factory, options?)` deduplicates concurrent factories for a key.
- `getEntryMetadata(key)` returns accounting and policy metadata without recording a hit.
- `entries()` returns a snapshot iterator of currently live entries.
- `pruneExpired()` removes expired entries and returns the number removed.
- `getStats()` returns hit/miss, eviction, rejection, byte and in-flight counters.

`set` accepts `size` and `computeCost` overrides and an optional per-entry `ttl`. `size` is rounded up to a whole byte. Invalid sizes, costs, TTLs and budgets throw `RangeError`.

`getOrCompute` passes an internal `AbortSignal` to the factory. A caller-provided signal cancels only that caller's wait. When every waiter has left, the shared factory signal is aborted. Factories that ignore abort may still resolve to their original callers, but invalidated results will not be cached.

## Cost interpretation

`computeCost` is a relative unit supplied by the application, not a measured duration. The default score is based on recency decay multiplied by logarithmic reuse and logarithmic compute cost, divided by logical size.
