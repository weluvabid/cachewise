import { shouldAdmit } from '../admission/admission.js';
import { estimateSize as defaultEstimateSize, validateSize } from '../accounting/size-estimator.js';
import { CostAwarePolicy } from '../eviction/cost-aware-policy.js';
import { LruPolicy } from '../eviction/lru-policy.js';
import { FrequencySketch } from '../statistics/frequency-sketch.js';
import type {
  CacheEntryMetadata,
  CacheEvent,
  CacheKey,
  CacheOptions,
  CachePolicyEntry,
  CacheStats,
  DisposeReason,
  SetOptions,
} from '../types.js';
import type { EvictionPolicy } from '../eviction/policy.js';

interface Entry<K, V> {
  readonly key: K;
  readonly value: V;
  readonly size: number;
  readonly computeCost: number;
  readonly costWeight: number;
  readonly createdAt: number;
  readonly expiresAt: number | undefined;
  lastAccessedAt: number;
  frequency: number;
  reuseWeight: number;
}

interface Flight<V> {
  readonly controller: AbortController;
  readonly promise: Promise<V>;
  waiters: number;
  cacheable: boolean;
}

export class Cache<K extends CacheKey, V> {
  readonly #entries = new Map<K, Entry<K, V>>();
  readonly #flights = new Map<K, Flight<V>>();
  readonly #maxBytes: number;
  readonly #defaultTtl: number | undefined;
  readonly #defaultComputeCost: number;
  readonly #estimate: (value: V, key: K) => number;
  readonly #now: () => number;
  readonly #policy: EvictionPolicy<K>;
  readonly #policyName: 'cost-aware' | 'lru';
  readonly #frequency: FrequencySketch<K>;
  readonly #onDispose: CacheOptions<K, V>['onDispose'];
  readonly #onEvent: CacheOptions<K, V>['onEvent'];
  readonly #onCallbackError: CacheOptions<K, V>['onCallbackError'];
  #bytesUsed = 0;
  #hits = 0;
  #misses = 0;
  #evictions = 0;
  #rejections = 0;
  #epoch = 0;

  constructor(options: CacheOptions<K, V>) {
    if (!Number.isSafeInteger(options.maxBytes) || options.maxBytes <= 0) {
      throw new RangeError('maxBytes must be a positive safe integer.');
    }

    this.#maxBytes = options.maxBytes;
    this.#defaultTtl = options.ttl;
    this.#defaultComputeCost = options.defaultComputeCost ?? 1;
    this.#estimate = options.estimateSize ?? ((value) => defaultEstimateSize(value));
    this.#now = options.now ?? Date.now;
    this.#frequency = new FrequencySketch(
      options.frequencyHalfLife ?? 60_000,
      this.#now(),
      options.maxTrackedKeys ?? 8_192,
    );
    this.#policyName = options.policy === 'lru' ? 'lru' : 'cost-aware';
    this.#policy = this.#policyName === 'lru' ? new LruPolicy<K>() : new CostAwarePolicy<K>();
    this.#onDispose = options.onDispose;
    this.#onEvent = options.onEvent;
    this.#onCallbackError = options.onCallbackError;

    this.#validateDuration(this.#defaultTtl, 'ttl');
    this.#validateCost(this.#defaultComputeCost);
  }

  get(key: K): V | undefined {
    const entry = this.#entries.get(key);

    if (!entry) {
      this.#misses += 1;
      this.#frequency.record(key, this.#now());
      this.#emit({ type: 'miss', key });

      return undefined;
    }

    const now = this.#now();

    if (this.#isExpired(entry, now)) {
      this.#remove(entry, 'expired');
      this.#misses += 1;
      this.#emit({ type: 'miss', key });

      return undefined;
    }

    entry.lastAccessedAt = now;
    entry.frequency = this.#frequency.record(key, now);
    entry.reuseWeight = Math.log2(1 + entry.frequency);
    this.#hits += 1;
    this.#emit({ type: 'hit', key });

    return entry.value;
  }

  has(key: K): boolean {
    const entry = this.#entries.get(key);

    if (!entry) return false;

    if (this.#isExpired(entry, this.#now())) {
      this.#remove(entry, 'expired');

      return false;
    }

    return true;
  }

  set(key: K, value: V, options: SetOptions = {}): boolean {
    const now = this.#now();
    // Every resident entry consumes at least one logical byte. This keeps the
    // entry count bounded even when callers provide zero-sized values.
    const size = Math.max(1, validateSize(options.size ?? this.#estimate(value, key)));
    const computeCost = options.computeCost ?? this.#defaultComputeCost;
    const ttl = options.ttl ?? this.#defaultTtl;

    this.#validateCost(computeCost);
    this.#validateDuration(ttl, 'ttl');

    if (size > this.#maxBytes) {
      this.#rejections += 1;
      this.#emit({ type: 'reject', key, reason: 'oversized' });

      return false;
    }

    const existing = this.#entries.get(key);
    const frequency = Math.max(1, this.#frequency.estimate(key, now));

    const candidate: Entry<K, V> = {
      key,
      value,
      size,
      computeCost,
      costWeight: Math.log2(1 + computeCost),
      createdAt: now,
      lastAccessedAt: now,
      expiresAt: ttl === undefined ? undefined : now + ttl,
      frequency,
      reuseWeight: Math.log2(1 + frequency),
    };

    const bytesAfterReplacement = this.#bytesUsed - (existing?.size ?? 0);
    const bytesNeeded = bytesAfterReplacement + size - this.#maxBytes;
    const victims: Entry<K, V>[] = [];

    // The common path does not allocate a copy of the resident map or build
    // policy records. Planning is only needed when capacity is actually tight.
    if (bytesNeeded > 0) {
      const policyEntries: CachePolicyEntry<K>[] = [];

      for (const entry of this.#entries.values()) {
        if (entry === existing) continue;

        policyEntries.push(entry);
      }

      const selected = this.#policy.selectVictims(policyEntries, now, bytesNeeded);
      let selectedBytes = 0;
      const candidatePolicyEntry: CachePolicyEntry<K> = candidate;

      for (const selectedEntry of selected) {
        const victim = this.#entries.get(selectedEntry.key);

        if (!victim) continue;

        if (!shouldAdmit(this.#policy, candidatePolicyEntry, selectedEntry, now)) {
          this.#rejections += 1;
          this.#emit({ type: 'reject', key, reason: 'admission' });

          return false;
        }

        victims.push(victim);
        selectedBytes += victim.size;

        if (selectedBytes >= bytesNeeded) break;
      }

      if (selectedBytes < bytesNeeded) {
        this.#rejections += 1;
        this.#emit({ type: 'reject', key, reason: 'admission' });

        return false;
      }
    }

    this.#invalidatePending(key);

    if (existing) this.#remove(existing, 'replaced');

    for (const victim of victims) {
      this.#remove(victim, 'evicted');
      this.#evictions += 1;
      this.#emit({
        type: 'evict',
        key: victim.key,
        reason: 'capacity',
        explanation:
          this.#policyName === 'lru'
            ? 'Least recently accessed entry under the LRU baseline.'
            : 'Lowest estimated avoided-computation value per logical byte.',
      });
    }

    this.#entries.set(key, candidate);
    this.#bytesUsed += size;
    this.#emit({ type: 'set', key, size });

    return true;
  }

  delete(key: K): boolean {
    this.#invalidatePending(key);
    const entry = this.#entries.get(key);

    if (!entry) return false;

    this.#remove(entry, 'deleted');
    this.#emit({ type: 'delete', key });

    return true;
  }

  clear(): void {
    this.#epoch += 1;

    for (const flight of this.#flights.values()) flight.controller.abort();

    this.#flights.clear();

    for (const entry of this.#entries.values()) this.#dispose(entry, 'cleared');

    this.#entries.clear();
    this.#frequency.clear();
    this.#bytesUsed = 0;
    this.#emit({ type: 'clear' });
  }

  async getOrCompute(
    key: K,
    factory: (signal: AbortSignal) => Promise<V> | V,
    options: SetOptions & { readonly signal?: AbortSignal } = {},
  ): Promise<V> {
    const cached = this.get(key);

    if (cached !== undefined || this.has(key)) return cached as V;

    if (options.signal?.aborted) throw this.#abortError();

    let flight = this.#flights.get(key);

    if (!flight) {
      const controller = new AbortController();
      const epoch = this.#epoch;
      const startedAt = this.#now();
      const promise = Promise.resolve()
        .then(() => factory(controller.signal))
        .then((value) => {
          if (!controller.signal.aborted && epoch === this.#epoch && flight?.cacheable === true) {
            this.set(key, value, options);
          }

          this.#emit({ type: 'compute', key, duration: Math.max(0, this.#now() - startedAt) });

          return value;
        })
        .finally(() => {
          if (this.#flights.get(key) === flight) this.#flights.delete(key);
        });

      flight = { controller, promise, waiters: 0, cacheable: true };
      this.#flights.set(key, flight);
    }

    flight.waiters += 1;

    try {
      return await this.#waitForFlight(flight, options.signal);
    } finally {
      flight.waiters -= 1;

      if (flight.waiters === 0 && this.#flights.get(key) === flight) {
        if (!flight.controller.signal.aborted) flight.controller.abort();

        this.#flights.delete(key);
      }
    }
  }

  getEntryMetadata(key: K): CacheEntryMetadata | undefined {
    const entry = this.#entries.get(key);

    if (!entry) return undefined;

    if (this.#isExpired(entry, this.#now())) {
      this.#remove(entry, 'expired');

      return undefined;
    }

    return {
      size: entry.size,
      computeCost: entry.computeCost,
      createdAt: entry.createdAt,
      lastAccessedAt: entry.lastAccessedAt,
      expiresAt: entry.expiresAt,
      frequency: entry.frequency,
    };
  }

  entries(): IterableIterator<[K, V]> {
    const snapshot: Array<[K, V]> = [];

    for (const entry of this.#entries.values()) {
      if (this.#isExpired(entry, this.#now())) this.#remove(entry, 'expired');
      else snapshot.push([entry.key, entry.value]);
    }

    return snapshot[Symbol.iterator]();
  }

  pruneExpired(): number {
    const now = this.#now();
    let removed = 0;

    for (const entry of this.#entries.values()) {
      if (this.#isExpired(entry, now)) {
        this.#remove(entry, 'expired');
        removed += 1;
      }
    }

    return removed;
  }

  getStats(): CacheStats {
    return {
      size: this.#entries.size,
      entries: this.#entries.size,
      hits: this.#hits,
      misses: this.#misses,
      evictions: this.#evictions,
      rejections: this.#rejections,
      hitRate: this.#hits + this.#misses === 0 ? 0 : this.#hits / (this.#hits + this.#misses),
      bytesUsed: this.#bytesUsed,
      bytesAvailable: this.#maxBytes - this.#bytesUsed,
      inflight: this.#flights.size,
    };
  }

  get maxBytes(): number {
    return this.#maxBytes;
  }

  #remove(entry: Entry<K, V>, reason: DisposeReason): void {
    if (!this.#entries.delete(entry.key)) return;

    this.#bytesUsed -= entry.size;
    this.#dispose(entry, reason);

    if (reason === 'expired') {
      this.#evictions += 1;
      this.#emit({ type: 'evict', key: entry.key, reason: 'expired' });
    }
  }

  #dispose(entry: Entry<K, V>, reason: DisposeReason): void {
    if (!this.#onDispose) return;

    try {
      this.#onDispose(entry.value, entry.key, reason);
    } catch (error) {
      this.#reportCallbackError(error, 'dispose');
    }
  }

  #isExpired(entry: Entry<K, V>, now: number): boolean {
    return entry.expiresAt !== undefined && entry.expiresAt <= now;
  }

  #invalidatePending(key: K): void {
    const flight = this.#flights.get(key);

    if (flight) flight.cacheable = false;
  }

  #validateDuration(value: number | undefined, name: string): void {
    if (value !== undefined && (!Number.isFinite(value) || value < 0)) {
      throw new RangeError(`${name} must be a finite, non-negative number.`);
    }
  }

  #validateCost(value: number): void {
    if (!Number.isFinite(value) || value < 0) {
      throw new RangeError('computeCost must be a finite, non-negative number.');
    }
  }

  #emit(event: CacheEvent<K>): void {
    if (!this.#onEvent) return;

    try {
      this.#onEvent(event);
    } catch (error) {
      this.#reportCallbackError(error, 'event');
    }
  }

  #reportCallbackError(error: unknown, callback: 'dispose' | 'event'): void {
    try {
      this.#onCallbackError?.(error, callback);
    } catch {
      // Error reporting must never interfere with cache state transitions.
    }
  }

  #abortError(): Error {
    return new DOMException('The operation was aborted.', 'AbortError');
  }

  #waitForFlight(flight: Flight<V>, signal: AbortSignal | undefined): Promise<V> {
    if (!signal) return flight.promise;

    if (signal.aborted) return Promise.reject(this.#abortError());

    return new Promise<V>((resolve, reject) => {
      const onAbort = (): void => {
        signal.removeEventListener('abort', onAbort);
        reject(this.#abortError());
      };

      signal.addEventListener('abort', onAbort, { once: true });
      flight.promise.then(
        (value) => {
          signal.removeEventListener('abort', onAbort);
          resolve(value);
        },
        (error: unknown) => {
          signal.removeEventListener('abort', onAbort);
          reject(error);
        },
      );
    });
  }
}
