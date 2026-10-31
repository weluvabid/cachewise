# API reference

## `new Cache<K, V>(options)`

```ts
import { Cache } from 'cachewise';

const cache = new Cache<string, Uint8Array>({
  maxBytes: 32 * 1024 * 1024,
  estimateSize: (value) => value.byteLength,
  policy: 'cost-aware',
  frequencyHalfLife: 60_000,
});
```

`K` must be a `CacheKey` (`string | number | symbol | object`).

| Option               | Default            | Meaning                                                                                                                              |
| -------------------- | ------------------ | ------------------------------------------------------------------------------------------------------------------------------------ |
| `maxBytes`           | required           | Positive safe integer logical byte budget, in bytes.                                                                                 |
| `estimateSize`       | built-in estimator | Returns the logical size of a value in bytes. Receives `(value, key)`.                                                               |
| `ttl`                | no expiry          | Default TTL in milliseconds. Zero means immediately expired.                                                                         |
| `policy`             | `cost-aware`       | `cost-aware` or `lru`.                                                                                                               |
| `defaultComputeCost` | `1`                | Default relative recomputation-cost weight.                                                                                          |
| `frequencyHalfLife`  | `60_000`           | Frequency counter decay interval in milliseconds.                                                                                    |
| `maxTrackedKeys`     | `8_192`            | Frequency-sketch width per row; total counters are four times this value. Larger widths reduce collisions and use more fixed memory. |
| `now`                | `Date.now`         | Clock function, useful for deterministic tests.                                                                                      |
| `onDispose`          | none               | Synchronous callback when a retained value is removed.                                                                               |
| `onEvent`            | none               | Synchronous callback for cache events.                                                                                               |
| `onCallbackError`    | none               | Receives exceptions thrown by `onDispose` or `onEvent`, with the callback name. Exceptions thrown by this handler are swallowed.     |

`maxBytes` must be a positive safe integer. TTL and compute cost must be finite and non-negative. Frequency half-life and tracked-key capacity must be positive. Entry sizes are rounded up to whole bytes and charged at a minimum of one byte, including values whose estimator returns zero.

## `set` options

```ts
cache.set('compiled:template', compiledTemplate, {
  size: 48_000,
  computeCost: 25,
  ttl: 30_000,
});
```

| Option        | Meaning                                                                             |
| ------------- | ----------------------------------------------------------------------------------- |
| `size`        | Overrides the configured size estimator for this entry. Rounded up to a whole byte. |
| `computeCost` | Relative recomputation-cost weight used by the cost-aware policy.                   |
| `ttl`         | Per-entry TTL in milliseconds; overrides the default when supplied.                 |

`set` returns `true` when the candidate is retained and `false` when it is rejected. Invalid sizes, costs, TTLs, and budgets throw `RangeError`.

An entry larger than the entire budget is rejected. Under the cost-aware policy, a candidate can also be rejected when its score does not justify displacing the selected victim. A rejected insertion leaves the existing entry set intact.

## Methods

### `get(key): V | undefined`

Returns the value and updates recency and frequency on a live hit. A miss increments the miss counter. Expired entries are removed and treated as misses.

Because `undefined` is also the miss sentinel, use `has` or `getOrCompute` when cached `undefined` values are possible.

### `has(key): boolean`

Checks whether a live entry exists. It does not update recency, frequency, hit count, or miss count. An expired entry is removed.

### `set(key, value, options?): boolean`

Attempts to retain a value within the logical byte budget. See [set options](#set-options).

### `delete(key): boolean`

Invalidates the key and removes its current value, if present. It also prevents a currently running `getOrCompute` factory for that key from populating the cache when it later settles.

### `clear(): void`

Invalidates all in-flight computations and removes all retained entries. The cache's counters are not reset; `getStats()` continues to report accumulated hits, misses, evictions, and rejections.

### `getOrCompute(key, factory, options?): Promise<V>`

Returns a cached value or runs the factory. Concurrent calls for the same key share one factory execution.

```ts
const result = await cache.getOrCompute(
  'report:2026-10',
  async (signal) => {
    const response = await fetch('/api/report', { signal });

    if (!response.ok) throw new Error(`Report request failed: ${response.status}`);

    return new Uint8Array(await response.arrayBuffer());
  },
  { computeCost: 30, ttl: 60_000 },
);
```

The factory receives the shared internal `AbortSignal`. `options.signal` is a caller-specific signal that cancels only that caller's wait. See [Concurrency](./concurrency.md).

### `getEntryMetadata(key): CacheEntryMetadata | undefined`

Returns `size`, `computeCost`, `createdAt`, `lastAccessedAt`, `expiresAt`, and the last stored frequency estimate. It does not count as a hit or update recency. Expired entries are removed.

### `entries(): IterableIterator<[K, V]>`

Returns an iterator over a snapshot of live `[key, value]` pairs. Expired entries encountered during snapshot creation are removed. The snapshot means later cache mutations do not change the already-created iterator.

### `pruneExpired(): number`

Scans the cache, removes expired entries, and returns the number removed.

### `getStats(): CacheStats`

Returns:

| Field              | Meaning                                                                            |
| ------------------ | ---------------------------------------------------------------------------------- |
| `size` / `entries` | Current number of retained entries. These fields currently contain the same value. |
| `hits`             | Successful `get` calls, including the cache lookup performed by `getOrCompute`.    |
| `misses`           | Failed `get` calls, including the first lookup performed by `getOrCompute`.        |
| `evictions`        | Capacity and expiration removals.                                                  |
| `rejections`       | Oversized or admission-rejected candidates.                                        |
| `hitRate`          | `hits / (hits + misses)`, or zero before lookups.                                  |
| `bytesUsed`        | Sum of logical sizes of retained entries.                                          |
| `bytesAvailable`   | `maxBytes - bytesUsed`.                                                            |
| `inflight`         | Number of currently registered in-flight computations.                             |

## Events

`onEvent` receives a discriminated union:

- `hit` / `miss`: lookup result.
- `set`: successful insertion and logical size.
- `reject`: oversized or admission-rejected candidate.
- `evict`: capacity or expiration removal, with an optional explanation.
- `delete`: explicit deletion.
- `clear`: cache-wide clear.
- `compute`: factory completion duration in milliseconds.

Events are synchronous. Exceptions from `onDispose` and `onEvent` are isolated from cache operations and optionally reported through `onCallbackError`. See [Concurrency and callbacks](./concurrency.md#callback-behavior).

## Disposal

`onDispose(value, key, reason)` runs when a retained value leaves the cache. Reasons are `evicted`, `deleted`, `expired`, `cleared`, and `replaced`.

The callback is not a finalizer and does not imply that JavaScript memory has been reclaimed. It is useful for application-managed resources that need explicit cleanup.
