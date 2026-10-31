import type { CachePolicyEntry } from '../types.js';
import type { EvictionPolicy } from './policy.js';

export class LruPolicy<K> implements EvictionPolicy<K> {
  selectVictims(
    entries: readonly CachePolicyEntry<K>[],
    _now: number,
    bytesNeeded: number,
  ): readonly CachePolicyEntry<K>[] {
    let firstVictim: CachePolicyEntry<K> | undefined;

    for (const entry of entries) {
      if (!firstVictim || entry.lastAccessedAt < firstVictim.lastAccessedAt) {
        firstVictim = entry;
      }
    }

    if (!firstVictim) return [];

    if (firstVictim.size >= bytesNeeded) return [firstVictim];

    const ordered = [...entries].sort((left, right) => left.lastAccessedAt - right.lastAccessedAt);
    const victims: CachePolicyEntry<K>[] = [];
    let selectedBytes = 0;

    for (const entry of ordered) {
      victims.push(entry);
      selectedBytes += entry.size;

      if (selectedBytes >= bytesNeeded) break;
    }

    return victims;
  }

  shouldAdmit(): boolean {
    return true;
  }
}
