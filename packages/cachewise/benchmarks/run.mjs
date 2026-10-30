import { Cache } from '../dist/index.js';

const capacity = 256 * 1024;
const itemSize = 1024;
const operations = 100_000;
const hotKeys = 80;

function run(policy) {
  const cache = new Cache({
    maxBytes: capacity,
    policy,
    estimateSize: () => itemSize,
  });
  let avoidedCost = 0;
  const startedAt = performance.now();

  for (let index = 0; index < operations; index += 1) {
    const hot = index % 10 !== 0;
    const key = hot ? `hot:${index % hotKeys}` : `cold:${index}`;
    const cached = cache.get(key);

    if (cached === undefined) {
      const computeCost = hot ? 40 : 2;
      cache.set(key, { key }, { size: itemSize, computeCost });
    } else {
      avoidedCost += hot ? 40 : 2;
    }
  }

  return {
    policy,
    elapsedMs: Number((performance.now() - startedAt).toFixed(2)),
    avoidedCost,
    ...cache.getStats(),
  };
}

// eslint-disable-next-line no-console
console.table([run('lru'), run('cost-aware')]);
