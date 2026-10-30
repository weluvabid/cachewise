import type { CachePolicyEntry } from '../types.js';
import type { EvictionPolicy } from './policy.js';

export class LruPolicy<K> implements EvictionPolicy<K> {
  selectVictim(entries: readonly CachePolicyEntry<K>[]): CachePolicyEntry<K> | undefined {
    let victim: CachePolicyEntry<K> | undefined;

    for (const entry of entries) {
      if (!victim || entry.lastAccessedAt < victim.lastAccessedAt) victim = entry;
    }

    return victim;
  }

  shouldAdmit(): boolean {
    return true;
  }
}
