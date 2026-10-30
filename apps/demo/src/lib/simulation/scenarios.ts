import type { ScenarioDefinition, ScenarioId } from './types';

export const budgets = [64, 100, 128, 256] as const;

/**
 * Entry sizes are expressed as fractions of the selected memory budget.
 * The generator turns these into integer KB values for each budget so the
 * scenarios preserve their intended memory-pressure profile at every size.
 */
export const scenarios: Record<ScenarioId, ScenarioDefinition> = {
  balanced: {
    label: 'Mixed workload',
    description: 'Expensive reusable results compete with cheap, short-lived data.',
    seed: 7319,
    rounds: 16,
    transientSizeRatio: 0.24,
    entries: [
      { key: 'report', sizeRatio: 0.22, cost: 96, weight: 0.42 },
      { key: 'schema', sizeRatio: 0.18, cost: 58, weight: 0.30 },
      { key: 'catalog', sizeRatio: 0.16, cost: 32, weight: 0.20 },
      { key: 'profile', sizeRatio: 0.08, cost: 4, weight: 0.08 }
    ]
  },
  expensive: {
    label: 'Expensive misses',
    description: 'High-cost computations stay valuable while inexpensive keys churn.',
    seed: 19427,
    rounds: 18,
    transientSizeRatio: 0.22,
    entries: [
      { key: 'model', sizeRatio: 0.24, cost: 220, weight: 0.42 },
      { key: 'report', sizeRatio: 0.22, cost: 180, weight: 0.32 },
      { key: 'index', sizeRatio: 0.16, cost: 110, weight: 0.20 },
      { key: 'profile', sizeRatio: 0.08, cost: 5, weight: 0.06 }
    ]
  },
  pressure: {
    label: 'Memory pressure',
    description: 'A tight working set makes every eviction compete with valuable results.',
    seed: 88031,
    rounds: 20,
    transientSizeRatio: 0.20,
    entries: [
      { key: 'hot-key', sizeRatio: 0.28, cost: 240, weight: 0.44 },
      { key: 'transform', sizeRatio: 0.24, cost: 190, weight: 0.32 },
      { key: 'config', sizeRatio: 0.16, cost: 72, weight: 0.18 },
      { key: 'lookup', sizeRatio: 0.08, cost: 4, weight: 0.06 }
    ]
  }
};

export const scenarioIds: ScenarioId[] = ['balanced', 'expensive', 'pressure'];
