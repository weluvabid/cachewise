# Memory accounting

`maxBytes` is a logical accounting budget. It is not a hard limit on JavaScript heap usage or process resident memory.

`maxBytes` must be a positive safe integer. Cachewise tracks the charged size of each retained entry and ensures the sum does not exceed that budget. The estimate does not include the `Map`, entry metadata, keys, promise state, closures, the fixed frequency sketch (four `Uint8Array` rows, one byte per counter, plus a bounded object-key identity table), allocator overhead, or garbage-collector fragmentation. With the default width of 8,192, the sketch uses 32 KiB for counters, plus small object metadata.

## Built-in estimator

The default estimator uses these approximations:

| Value                       |                    Estimated size |
| --------------------------- | --------------------------------: |
| `null` / `undefined`        | 0 bytes estimated; 1 byte charged |
| string                      |      2 bytes per UTF-16 code unit |
| number / boolean / bigint   |                           8 bytes |
| `ArrayBuffer`               |                      `byteLength` |
| typed-array or `DataView`   |                      `byteLength` |
| `Blob`                      |                            `size` |
| `ImageBitmap`               |              `width × height × 4` |
| Other objects and functions | 0 bytes estimated; 1 byte charged |

These are accounting conventions, not measurements of the heap. In particular, ordinary objects default to zero. A cache containing objects should provide `estimateSize`, or pass `size` to `set` / `getOrCompute`.

```ts
const cache = new Cache<string, ParsedDocument>({
  maxBytes: 64 * 1024 * 1024,
  estimateSize: (document) => document.approximateBytes,
});
```

You can override an individual entry's estimate:

```ts
cache.set('thumbnail', bitmap, {
  size: bitmap.width * bitmap.height * 4,
  computeCost: 12,
});
```

Fractional entry sizes are rounded up to the next whole byte. Negative and non-finite sizes are rejected. A value larger than the entire budget is rejected without evicting existing entries.

## Shared backing storage

Two typed-array views can refer to the same `ArrayBuffer`. The default estimator charges each view for its own `byteLength`; it does not deduplicate shared backing storage. If several entries share memory, provide an estimator and accounting scheme that reflects how your application wants that memory charged.

## Zero-sized estimates

An estimator may return zero, but Cachewise charges every retained entry at least one logical byte. This prevents zero-sized entries from bypassing the entry-count bound: the cache can retain at most `maxBytes` entries. It does not make the logical budget a heap limit. Ordinary objects still need realistic estimates because the one-byte minimum is only a floor, not a useful estimate of their actual memory use.

## Choosing a budget

Treat `maxBytes` as a policy budget for values, not as a process memory safety mechanism. Leave room for application data structures and runtime overhead. If you need a strict heap ceiling, enforce it at the process or worker level and use realistic application-specific size estimates.
