export type CacheKey = string | number | symbol | object;

export interface CacheEntryMetadata {
  readonly size: number;
  readonly computeCost: number;
  readonly createdAt: number;
  readonly lastAccessedAt: number;
  readonly expiresAt: number | undefined;
  readonly frequency: number;
}

export interface CacheOptions<K, V> {
  readonly maxBytes: number;
  readonly ttl?: number;
  readonly policy?: 'cost-aware' | 'lru';
  readonly estimateSize?: (value: V, key: K) => number;
  readonly defaultComputeCost?: number;
  readonly frequencyHalfLife?: number;
  /** Number of counters per row in the bounded frequency sketch. */
  readonly maxTrackedKeys?: number;
  readonly now?: () => number;
  readonly onDispose?: (value: V, key: K, reason: DisposeReason) => void;
  readonly onEvent?: (event: CacheEvent<K>) => void;
  readonly onCallbackError?: (error: unknown, callback: 'dispose' | 'event') => void;
}

export type DisposeReason = 'evicted' | 'deleted' | 'expired' | 'cleared' | 'replaced';

export type CacheEvent<K> =
  | { readonly type: 'hit'; readonly key: K }
  | { readonly type: 'miss'; readonly key: K }
  | { readonly type: 'set'; readonly key: K; readonly size: number }
  | {
      readonly type: 'evict';
      readonly key: K;
      readonly reason: 'capacity' | 'expired';
      readonly explanation?: string;
    }
  | { readonly type: 'reject'; readonly key: K; readonly reason: 'oversized' | 'admission' }
  | { readonly type: 'delete'; readonly key: K }
  | { readonly type: 'clear' }
  | { readonly type: 'compute'; readonly key: K; readonly duration: number };

export interface SetOptions {
  readonly ttl?: number;
  readonly computeCost?: number;
  readonly size?: number;
}

export interface CacheStats {
  readonly size: number;
  readonly entries: number;
  readonly hits: number;
  readonly misses: number;
  readonly evictions: number;
  readonly rejections: number;
  readonly hitRate: number;
  readonly bytesUsed: number;
  readonly bytesAvailable: number;
  readonly inflight: number;
}

export interface CachePolicyEntry<K> {
  readonly key: K;
  readonly size: number;
  readonly computeCost: number;
  readonly costWeight?: number;
  readonly reuseWeight?: number;
  readonly lastAccessedAt: number;
  readonly frequency: number;
}
