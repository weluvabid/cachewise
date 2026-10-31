import { describe, expect, it, vi } from 'vitest';
import fc from 'fast-check';
import { Cache } from '../src/index.js';

describe('Cache', () => {
  it('accounts for bytes and rejects entries larger than the budget', () => {
    const cache = new Cache<string, string>({ maxBytes: 8, estimateSize: (value) => value.length });

    expect(cache.set('a', '12345')).toBe(true);
    expect(cache.set('b', '123456789')).toBe(false);
    expect(cache.getStats().bytesUsed).toBe(5);
    expect(cache.getStats().rejections).toBe(1);
  });

  it('expires entries at the TTL boundary', () => {
    let now = 10;
    const cache = new Cache<string, string>({ maxBytes: 20, ttl: 5, now: () => now });

    cache.set('a', 'value');
    now = 15;

    expect(cache.get('a')).toBeUndefined();
    expect(cache.getStats().bytesUsed).toBe(0);
  });

  it('disposes replaced, deleted, expired and cleared values', () => {
    const dispose = vi.fn();
    const cache = new Cache<string, string>({ maxBytes: 100, onDispose: dispose });

    cache.set('a', 'one');
    cache.set('a', 'two');
    cache.delete('a');
    cache.set('b', 'three');
    cache.clear();

    expect(dispose).toHaveBeenCalledTimes(3);
    expect(dispose).toHaveBeenNthCalledWith(1, 'one', 'a', 'replaced');
    expect(dispose).toHaveBeenNthCalledWith(2, 'two', 'a', 'deleted');
    expect(dispose).toHaveBeenNthCalledWith(3, 'three', 'b', 'cleared');
  });

  it('deduplicates concurrent computations', async () => {
    const cache = new Cache<string, number>({ maxBytes: 100, estimateSize: () => 8 });
    let calls = 0;
    let resolve!: (value: number) => void;
    const factory = vi.fn(() => {
      calls += 1;

      return new Promise<number>((done) => {
        resolve = done;
      });
    });

    const first = cache.getOrCompute('answer', factory);
    const second = cache.getOrCompute('answer', factory);

    await Promise.resolve();
    resolve(42);

    await expect(Promise.all([first, second])).resolves.toEqual([42, 42]);
    expect(calls).toBe(1);
    expect(cache.get('answer')).toBe(42);
  });

  it('does not repopulate an entry invalidated during computation', async () => {
    const cache = new Cache<string, number>({ maxBytes: 100, estimateSize: () => 8 });
    let resolve!: (value: number) => void;

    const pending = cache.getOrCompute(
      'key',
      () =>
        new Promise<number>((done) => {
          resolve = done;
        }),
    );

    await Promise.resolve();

    cache.delete('key');
    resolve(7);

    await expect(pending).resolves.toBe(7);
    expect(cache.has('key')).toBe(false);
  });

  it('evicts multiple entries when one larger candidate needs their combined space', () => {
    const disposed: Array<[string, string]> = [];
    const cache = new Cache<string, string>({
      maxBytes: 9,
      policy: 'lru',
      estimateSize: (value) => value.length,
      onDispose: (value, key, reason) => {
        if (reason === 'evicted') disposed.push([key, value]);
      },
    });

    cache.set('oldest', 'aaa');
    cache.set('middle', 'bbb');
    cache.set('newest', 'ccc');

    expect(cache.set('incoming', '12345')).toBe(true);
    expect(cache.has('oldest')).toBe(false);
    expect(cache.has('middle')).toBe(false);
    expect(cache.has('newest')).toBe(true);
    expect(cache.getStats().bytesUsed).toBe(8);
    expect(disposed).toEqual([
      ['oldest', 'aaa'],
      ['middle', 'bbb'],
    ]);
  });

  it('starts a replacement TTL when the computed value is inserted', async () => {
    let now = 0;
    const cache = new Cache<string, string>({ maxBytes: 20, now: () => now });
    let resolve!: (value: string) => void;

    const pending = cache.getOrCompute(
      'delayed',
      () =>
        new Promise<string>((done) => {
          resolve = done;
        }),
      { ttl: 5 },
    );

    await Promise.resolve();
    now = 100;
    resolve('ready');
    await expect(pending).resolves.toBe('ready');

    expect(cache.has('delayed')).toBe(true);
    now = 105;
    expect(cache.get('delayed')).toBeUndefined();
  });

  it('invalidates in-flight computations without retaining historical key metadata', async () => {
    const cache = new Cache<number, number>({ maxBytes: 32, estimateSize: () => 1 });

    for (let key = 0; key < 500; key += 1) {
      let resolve!: (value: number) => void;
      const pending = cache.getOrCompute(
        key,
        () =>
          new Promise<number>((done) => {
            resolve = done;
          }),
      );

      await Promise.resolve();
      cache.delete(key);
      resolve(key);
      await expect(pending).resolves.toBe(key);
      expect(cache.has(key)).toBe(false);
    }

    expect(cache.getStats().inflight).toBe(0);
  });

  it('does not repopulate after clear invalidates an in-flight computation', async () => {
    const cache = new Cache<string, number>({ maxBytes: 20, estimateSize: () => 4 });
    let resolve!: (value: number) => void;
    const pending = cache.getOrCompute(
      'key',
      () =>
        new Promise<number>((done) => {
          resolve = done;
        }),
    );

    await Promise.resolve();
    cache.clear();
    resolve(12);

    await expect(pending).resolves.toBe(12);
    expect(cache.has('key')).toBe(false);
    expect(cache.getStats().bytesUsed).toBe(0);
  });

  it('does not overwrite a newer explicit value when an older computation resolves', async () => {
    const cache = new Cache<string, number>({ maxBytes: 20, estimateSize: () => 4 });
    let resolve!: (value: number) => void;
    const pending = cache.getOrCompute(
      'key',
      () =>
        new Promise<number>((done) => {
          resolve = done;
        }),
    );

    await Promise.resolve();
    cache.set('key', 99);
    resolve(12);

    await expect(pending).resolves.toBe(12);
    expect(cache.get('key')).toBe(99);
  });

  it('supports caller cancellation without cancelling other waiters', async () => {
    const cache = new Cache<string, number>({ maxBytes: 100, estimateSize: () => 8 });
    const controller = new AbortController();
    let resolve!: (value: number) => void;
    const factory = vi.fn(
      () =>
        new Promise<number>((done) => {
          resolve = done;
        }),
    );
    const cancelled = cache.getOrCompute('k', factory, { signal: controller.signal });
    const active = cache.getOrCompute('k', factory);

    await Promise.resolve();
    controller.abort();
    await expect(cancelled).rejects.toMatchObject({ name: 'AbortError' });
    resolve(9);

    await expect(active).resolves.toBe(9);
    expect(factory).toHaveBeenCalledTimes(1);
  });

  it('uses LRU as the explicit baseline policy', () => {
    let now = 0;
    const cache = new Cache<string, string>({
      maxBytes: 6,
      estimateSize: (value) => value.length,
      policy: 'lru',
      now: () => now,
    });

    cache.set('a', 'aaa');
    now = 1;
    cache.set('b', 'bbb');
    now = 2;
    expect(cache.get('a')).toBe('aaa');
    now = 3;
    cache.set('c', 'ccc');

    expect(cache.has('a')).toBe(true);
    expect(cache.has('b')).toBe(false);
  });

  it('validates budgets, sizes and costs', () => {
    expect(() => new Cache({ maxBytes: 0 })).toThrow(RangeError);
    const cache = new Cache<string, string>({ maxBytes: 10, estimateSize: () => -1 });

    expect(() => cache.set('a', 'x')).toThrow(RangeError);
    expect(() => cache.set('a', 'x', { computeCost: Number.NaN })).toThrow(RangeError);
  });

  it('requires an integer byte budget instead of silently flooring fractions', () => {
    expect(() => new Cache({ maxBytes: 0.5 })).toThrow(RangeError);
    expect(() => new Cache({ maxBytes: 1.5 })).toThrow(RangeError);
    expect(() => new Cache({ maxBytes: Number.MAX_SAFE_INTEGER + 1 })).toThrow(RangeError);
    expect(new Cache({ maxBytes: 1 }).maxBytes).toBe(1);
  });

  it('charges at least one logical byte for zero-sized values', () => {
    const cache = new Cache<number, undefined>({
      maxBytes: 3,
      estimateSize: () => 0,
      policy: 'lru',
    });

    expect(cache.set(1, undefined)).toBe(true);
    expect(cache.set(2, undefined)).toBe(true);
    expect(cache.set(3, undefined)).toBe(true);
    expect(cache.set(4, undefined)).toBe(true);
    expect(cache.has(1)).toBe(false);
    expect(cache.getStats()).toMatchObject({ entries: 3, bytesUsed: 3, bytesAvailable: 0 });
  });

  it('keeps lifecycle operations consistent when user callbacks throw', () => {
    const callbackErrors: Array<[unknown, 'dispose' | 'event']> = [];
    const cache = new Cache<string, string>({
      maxBytes: 10,
      onDispose: () => {
        throw new Error('dispose failed');
      },
      onEvent: () => {
        throw new Error('event failed');
      },
      onCallbackError: (error, callback) => callbackErrors.push([error, callback]),
    });

    expect(() => cache.set('key', 'value')).not.toThrow();
    expect(() => cache.delete('key')).not.toThrow();
    expect(cache.getStats()).toMatchObject({ entries: 0, bytesUsed: 0 });
    expect(callbackErrors.map(([, callback]) => callback)).toContain('event');
    expect(callbackErrors.map(([, callback]) => callback)).toContain('dispose');
  });

  it('completes clear when every disposal callback throws', () => {
    const disposed: string[] = [];
    const cache = new Cache<string, string>({
      maxBytes: 10,
      onDispose: (value) => {
        disposed.push(value);
        throw new Error('dispose failed');
      },
    });

    cache.set('a', 'one');
    cache.set('b', 'two');
    expect(() => cache.clear()).not.toThrow();
    expect(disposed).toEqual(['one', 'two']);
    expect(cache.getStats()).toMatchObject({ entries: 0, bytesUsed: 0 });
  });

  it('does not let a throwing callback-error handler interrupt cache operations', () => {
    const cache = new Cache<string, string>({
      maxBytes: 10,
      onEvent: () => {
        throw new Error('event failed');
      },
      onCallbackError: () => {
        throw new Error('reporting failed');
      },
    });

    expect(() => cache.set('key', 'value')).not.toThrow();
    expect(cache.get('key')).toBe('value');
  });
});

describe('cost-aware retention', () => {
  it('prefers expensive, frequently reused work over cheap one-off work', () => {
    let now = 0;
    const cache = new Cache<string, string>({
      maxBytes: 10,
      estimateSize: (value) => value.length,
      now: () => now,
    });

    cache.set('expensive', '12345', { computeCost: 100 });
    cache.set('cheap', 'abcde', { computeCost: 1 });

    for (let index = 0; index < 8; index += 1) cache.get('expensive');

    now = 1;
    cache.set('incoming', 'vwxyz', { computeCost: 10 });

    expect(cache.has('expensive')).toBe(true);
    expect(cache.has('cheap')).toBe(false);
  });

  it('keeps the original cache intact when admission is rejected', () => {
    const cache = new Cache<string, string>({
      maxBytes: 10,
      estimateSize: (value) => value.length,
    });

    cache.set('valuable', '12345', { computeCost: 1_000 });
    cache.set('other', 'abcde', { computeCost: 1 });

    const accepted = cache.set('low-value', 'vwxyz', { computeCost: 0 });

    expect(accepted).toBe(false);
    expect(cache.has('valuable')).toBe(true);
    expect(cache.has('other')).toBe(true);
    expect(cache.getStats().bytesUsed).toBe(10);
  });

  it('does not partially evict when a multi-victim admission plan fails', () => {
    const cache = new Cache<string, string>({
      maxBytes: 10,
      estimateSize: (value) => value.length,
    });

    cache.set('cheap', 'aaa', { computeCost: 1 });
    cache.set('medium', 'bbbb', { computeCost: 10 });
    cache.set('valuable', 'ccc', { computeCost: 1_000 });

    const accepted = cache.set('candidate', '123456', { computeCost: 10 });

    expect(accepted).toBe(false);
    expect(cache.has('cheap')).toBe(true);
    expect(cache.has('medium')).toBe(true);
    expect(cache.has('valuable')).toBe(true);
    expect(cache.getStats().bytesUsed).toBe(10);
  });

  it('supports caching undefined values in getOrCompute', async () => {
    const cache = new Cache<string, undefined>({ maxBytes: 10, estimateSize: () => 0 });
    const factory = vi.fn(() => undefined);

    await expect(cache.getOrCompute('undefined', factory)).resolves.toBeUndefined();
    await expect(cache.getOrCompute('undefined', factory)).resolves.toBeUndefined();

    expect(factory).toHaveBeenCalledTimes(1);
  });
});

describe('budget invariants', () => {
  it('never exceeds the configured logical byte budget', () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.record({
            key: fc.integer({ min: 0, max: 40 }),
            size: fc.integer({ min: 0, max: 40 }),
            cost: fc.integer({ min: 0, max: 100 }),
          }),
          { maxLength: 300 },
        ),
        (operations) => {
          const cache = new Cache<number, string>({
            maxBytes: 128,
            estimateSize: (value) => value.length,
          });

          for (const operation of operations) {
            cache.set(operation.key, 'x'.repeat(operation.size), {
              computeCost: operation.cost,
            });

            expect(cache.getStats().bytesUsed).toBeLessThanOrEqual(128);
            expect(cache.getStats().bytesUsed).toBeGreaterThanOrEqual(0);
          }
        },
      ),
    );
  });
});

describe('maintenance and observability', () => {
  it('prunes expired entries and reports the count', () => {
    let now = 0;
    const cache = new Cache<string, string>({
      maxBytes: 20,
      ttl: 5,
      now: () => now,
    });

    cache.set('a', 'one');
    cache.set('b', 'two');
    now = 5;

    expect(cache.pruneExpired()).toBe(2);
    expect(cache.getStats().bytesUsed).toBe(0);
  });

  it('includes a reason when capacity eviction occurs', () => {
    const events: Array<{ type: string; explanation?: string }> = [];
    const cache = new Cache<string, string>({
      maxBytes: 6,
      policy: 'lru',
      estimateSize: (value) => value.length,
      onEvent: (event) => events.push(event),
    });

    cache.set('a', 'aaa');
    cache.set('b', 'bbb');
    cache.set('c', 'ccc');

    const eviction = events.find((event) => event.type === 'evict');

    expect(eviction?.explanation).toContain('LRU');
  });

  it('retains hot-key frequency through high-cardinality miss traffic', () => {
    const cache = new Cache<string, string>({
      maxBytes: 10,
      maxTrackedKeys: 4_096,
      frequencyHalfLife: 1_000_000,
      estimateSize: () => 1,
    });

    for (let index = 0; index < 100; index += 1) cache.get('hot');

    for (let index = 0; index < 20_000; index += 1) cache.get(`cold:${index}`);

    expect(cache.getEntryMetadata('hot')).toBeUndefined();
    cache.set('hot', 'value');
    expect(cache.getEntryMetadata('hot')?.frequency).toBeGreaterThanOrEqual(100);
  });

  it('updates recency and frequency metadata on successful reads only', () => {
    let now = 0;
    const cache = new Cache<string, string>({
      maxBytes: 20,
      estimateSize: () => 1,
      now: () => now,
    });

    cache.set('key', 'v');
    now = 10;
    expect(cache.get('key')).toBe('v');
    const afterHit = cache.getEntryMetadata('key');

    expect(afterHit?.lastAccessedAt).toBe(10);
    expect(afterHit?.frequency).toBe(1);

    now = 20;
    expect(cache.get('missing')).toBeUndefined();
    expect(cache.getEntryMetadata('key')?.lastAccessedAt).toBe(10);
  });

  it('disposes values exactly once for capacity eviction and replacement', () => {
    const dispose = vi.fn();
    const cache = new Cache<string, string>({
      maxBytes: 6,
      policy: 'lru',
      estimateSize: (value) => value.length,
      onDispose: dispose,
    });

    cache.set('a', 'aaa');
    cache.set('b', 'bbb');
    cache.set('c', 'ccc');
    cache.set('c', 'new');

    expect(dispose).toHaveBeenCalledTimes(2);
    expect(dispose).toHaveBeenNthCalledWith(1, 'aaa', 'a', 'evicted');
    expect(dispose).toHaveBeenNthCalledWith(2, 'ccc', 'c', 'replaced');
    expect(cache.getStats().bytesUsed).toBe(6);
  });

  it('rejects invalid frequency estimator settings', () => {
    expect(() => new Cache({ maxBytes: 10, frequencyHalfLife: 0 })).toThrow(RangeError);
    expect(() => new Cache({ maxBytes: 10, maxTrackedKeys: 0 })).toThrow(RangeError);
  });
});
