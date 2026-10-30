import { scenarios } from './scenarios';
import type { Operation, ScenarioId } from './types';

function createRandom(seed: number): () => number {
  let state = seed >>> 0;

  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

type SizedEntry = {
  key: string;
  size: number;
  cost: number;
  weight: number;
};

function toKilobytes(capacity: number, ratio: number): number {
  return Math.max(4, Math.round(capacity * ratio));
}

/**
 * Generate a reproducible, capacity-aware workload.
 *
 * Each stream first admits and warms its valuable working set. It then
 * introduces cheap transient values in bursts and revisits the expensive
 * entries. This creates the recency-vs-retention trade-off Cachewise is built
 * to handle, while both policies receive exactly the same operations.
 */
export function generateWorkload(id: ScenarioId, capacity: number): Operation[] {
  const definition = scenarios[id];
  const random = createRandom(definition.seed + capacity * 97);
  const entries: SizedEntry[] = definition.entries.map((entry) => ({
    key: entry.key,
    size: toKilobytes(capacity, entry.sizeRatio),
    cost: entry.cost,
    weight: entry.weight,
  }));
  const operations: Operation[] = entries.map(({ key, size, cost }) => ({
    kind: 'set',
    key,
    size,
    cost,
  }));

  // Warm the valuable entries so the frequency-aware policy has reuse evidence.
  for (let pass = 0; pass < 4; pass += 1) {
    for (const entry of entries) {
      operations.push({ kind: 'get', key: entry.key });
    }
  }

  // Deterministic transient churn. The small variation prevents every
  // admission decision from having an identical size while remaining
  // proportional to the selected budget.
  const transientBase = definition.transientSizeRatio;

  for (let round = 0; round < definition.rounds; round += 1) {
    const variation = [0.92, 1, 1.08, 0.96][round % 4] ?? 1;
    const size = toKilobytes(capacity, transientBase * variation);
    const transientKey = `transient-${round + 1}`;

    operations.push({
      kind: 'set',
      key: transientKey,
      size,
      cost: 1 + (round % 4),
    });
    operations.push({ kind: 'get', key: transientKey });

    // Revisit valuable keys after each transient insertion. The sequence
    // deliberately alternates expensive and medium-cost entries rather than
    // refreshing every resident key on every round.
    const roll = random();
    let cumulativeWeight = 0;
    let primary = entries[0];

    for (const entry of entries) {
      cumulativeWeight += entry.weight;

      if (roll <= cumulativeWeight) {
        primary = entry;
        break;
      }
    }

    const secondary = entries[(round * 2 + 1) % entries.length];

    if (primary) operations.push({ kind: 'get', key: primary.key });

    if (round % 2 === 0 && secondary && secondary.key !== primary?.key) {
      operations.push({ kind: 'get', key: secondary.key });
    }
  }

  // A final focused pass makes any valuable entries displaced by recency
  // pressure visible as misses and exposes the recomputation-cost difference.
  for (const entry of entries) {
    operations.push({ kind: 'get', key: entry.key });
  }

  return operations;
}
