import type { CachePolicyEntry } from '../types.js';
import type { EvictionPolicy } from './policy.js';

export interface CostAwarePolicyOptions {
  readonly recencyHalfLife?: number;
}

export class CostAwarePolicy<K> implements EvictionPolicy<K> {
  readonly #recencyHalfLife: number;

  constructor(options: CostAwarePolicyOptions = {}) {
    this.#recencyHalfLife = options.recencyHalfLife ?? 60_000;
  }

  score(entry: CachePolicyEntry<K>, now: number): number {
    const age = Math.max(0, now - entry.lastAccessedAt);
    const recency = 0.5 ** (age / this.#recencyHalfLife);
    const reuse = Math.log2(1 + entry.frequency);
    const cost = Math.log2(1 + entry.computeCost);
    const size = Math.max(1, entry.size);

    return (recency * reuse * cost) / size;
  }

  selectVictim(
    entries: readonly CachePolicyEntry<K>[],
    now: number,
  ): CachePolicyEntry<K> | undefined {
    let victim: CachePolicyEntry<K> | undefined;
    let lowestScore = Number.POSITIVE_INFINITY;

    for (const entry of entries) {
      const score = this.score(entry, now);

      if (score < lowestScore) {
        lowestScore = score;
        victim = entry;
      }
    }

    return victim;
  }

  shouldAdmit(candidate: CachePolicyEntry<K>, victim: CachePolicyEntry<K>, now: number): boolean {
    const candidateScore = this.score(candidate, now);

    return candidateScore > 0 && candidateScore >= this.score(victim, now);
  }
}
