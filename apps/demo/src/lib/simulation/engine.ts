import { Cache } from 'cachewise';
import { generateWorkload } from './generator';
import type { EntryView, ScenarioId, Snapshot } from './types';

export function buildSnapshots(id: ScenarioId, capacity: number): Snapshot[] {
  let now = 1_000;
  const lruEvents: string[] = [];
  const smartEvents: string[] = [];
  const operations = generateWorkload(id, capacity);
  const costByKey = new Map(
    operations.filter((operation) => operation.kind === 'set')
      .map((operation) => [operation.key, operation.cost])
  );
  const lru = new Cache<string, string>({
    maxBytes: capacity,
    policy: 'lru',
    now: () => now,
    estimateSize: (value) => Number(value.split('|')[0]),
    onEvent: (event) => { if (event.type === 'evict') lruEvents.push(event.key); }
  });
  const smart = new Cache<string, string>({
    maxBytes: capacity,
    policy: 'cost-aware',
    now: () => now,
    frequencyHalfLife: 100_000,
    estimateSize: (value) => Number(value.split('|')[0]),
    onEvent: (event) => { if (event.type === 'evict') smartEvents.push(event.key); }
  });
  const snapshots: Snapshot[] = [];
  let lruComputeCost = 0;
  let smartComputeCost = 0;

  const view = (cache: Cache<string, string>): EntryView[] =>
    [...cache.entries()].map(([key]) => {
      const metadata = cache.getEntryMetadata(key)!;
      return {
        key,
        size: metadata.size,
        cost: metadata.computeCost,
        frequency: metadata.frequency
      };
    });

  for (const [index, operation] of operations.entries()) {
    now += 1_000;
    const lruEventStart = lruEvents.length;
    const smartEventStart = smartEvents.length;
    let lruRejected = false;
    let smartRejected = false;

    if (operation.kind === 'get') {
      const lruMisses = lru.getStats().misses;
      const smartMisses = smart.getStats().misses;
      lru.get(operation.key);
      smart.get(operation.key);
      const cost = costByKey.get(operation.key) ?? 1;
      if (lru.getStats().misses > lruMisses) lruComputeCost += cost;
      if (smart.getStats().misses > smartMisses) smartComputeCost += cost;
    } else {
      const value = `${operation.size}|${operation.key}`;
      lruRejected = !lru.set(operation.key, value, {
        size: operation.size,
        computeCost: operation.cost
      });
      smartRejected = !smart.set(operation.key, value, {
        size: operation.size,
        computeCost: operation.cost
      });
    }

    const description = operation.kind === 'get'
      ? `Read ${operation.key}`
      : `Computed ${operation.key}`;
    snapshots.push({
      sequence: index + 1,
      operation: description,
      detail: operation.kind === 'get'
        ? 'Both policies receive the same lookup.'
        : `${operation.size} KB resident size · recomputation cost ${operation.cost}.`,
      lru: view(lru),
      smart: view(smart),
      lruStats: lru.getStats(),
      smartStats: smart.getStats(),
      lruEvicted: lruEvents.slice(lruEventStart),
      smartEvicted: smartEvents.slice(smartEventStart),
      lruRejected,
      smartRejected,
      lruComputeCost,
      smartComputeCost
    });
  }

  return snapshots;
}
