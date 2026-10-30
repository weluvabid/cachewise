import type { CachePolicyEntry } from '../types.js';
import type { EvictionPolicy } from '../eviction/policy.js';

export function shouldAdmit<K>(
  policy: EvictionPolicy<K>,
  candidate: CachePolicyEntry<K>,
  victim: CachePolicyEntry<K>,
  now: number,
): boolean {
  return policy.shouldAdmit(candidate, victim, now);
}
