import type { CachePolicyEntry } from '../types.js';

export interface EvictionPolicy<K> {
  selectVictim(
    entries: readonly CachePolicyEntry<K>[],
    now: number,
  ): CachePolicyEntry<K> | undefined;
  shouldAdmit(candidate: CachePolicyEntry<K>, victim: CachePolicyEntry<K>, now: number): boolean;
}
