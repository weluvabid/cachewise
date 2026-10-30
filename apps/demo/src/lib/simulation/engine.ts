import { Cache } from 'cachewise';
import { generateWorkload } from './generator';
import type { ScenarioId, Snapshot } from './types';

/**
 * Execute one deterministic workload against both cache policies.
 * Snapshots retain only data consumed by the UI, keeping the playback model
 * compact instead of copying every resident entry after every operation.
 */
export function buildSnapshots(id: ScenarioId, capacity: number): Snapshot[] {
  let now = 1_000;
  const operations = generateWorkload(id, capacity);
  const costByKey = new Map<string, number>();

  for (const operation of operations) {
    if (operation.kind === 'set') costByKey.set(operation.key, operation.cost);
  }

  const createCache = (policy: 'lru' | 'cost-aware') =>
    new Cache<string, string>({
      maxBytes: capacity,
      policy,
      now: () => now,
      ...(policy === 'cost-aware' ? { frequencyHalfLife: 100_000 } : {}),
      estimateSize: (value) => Number(value.slice(0, value.indexOf('|'))),
    });

  const lru = createCache('lru');
  const cachewise = createCache('cost-aware');
  const snapshots: Snapshot[] = [];
  const countEntries = (cache: Cache<string, string>): number => {
    let count = 0;

    for (const _entry of cache.entries()) count += 1;

    return count;
  };
  let lruComputeCost = 0;
  let cachewiseComputeCost = 0;
  let lruStats = lru.getStats();
  let cachewiseStats = cachewise.getStats();

  for (const operation of operations) {
    now += 1_000;

    if (operation.kind === 'get') {
      const lruMissesBefore = lruStats.misses;
      const cachewiseMissesBefore = cachewiseStats.misses;

      lru.get(operation.key);
      cachewise.get(operation.key);

      const recomputeCost = costByKey.get(operation.key) ?? 1;

      lruStats = lru.getStats();
      cachewiseStats = cachewise.getStats();

      if (lruStats.misses > lruMissesBefore) lruComputeCost += recomputeCost;

      if (cachewiseStats.misses > cachewiseMissesBefore) cachewiseComputeCost += recomputeCost;
    } else {
      const value = `${operation.size}|${operation.key}`;
      const metadata = { size: operation.size, computeCost: operation.cost };

      lru.set(operation.key, value, metadata);
      cachewise.set(operation.key, value, metadata);
      lruStats = lru.getStats();
      cachewiseStats = cachewise.getStats();
    }

    snapshots.push({
      lruEntryCount: countEntries(lru),
      cachewiseEntryCount: countEntries(cachewise),
      lruStats,
      cachewiseStats,
      lruComputeCost,
      cachewiseComputeCost,
    });
  }

  return snapshots;
}
