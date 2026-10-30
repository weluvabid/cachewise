export { Cache } from './core/cache.js';
export { estimateSize } from './accounting/size-estimator.js';
export { CostAwarePolicy } from './eviction/cost-aware-policy.js';
export { LruPolicy } from './eviction/lru-policy.js';
export { FrequencySketch } from './statistics/frequency-sketch.js';
export type {
  CacheEntryMetadata,
  CacheEvent,
  CacheKey,
  CacheOptions,
  CacheStats,
  DisposeReason,
  SetOptions,
} from './types.js';
