import type { CachePolicyEntry } from '../types.js';

export interface EvictionPolicy<K> {
  selectVictims(
    entries: readonly CachePolicyEntry<K>[],
    now: number,
    bytesNeeded: number,
  ): readonly CachePolicyEntry<K>[];
  shouldAdmit(candidate: CachePolicyEntry<K>, victim: CachePolicyEntry<K>, now: number): boolean;
}
