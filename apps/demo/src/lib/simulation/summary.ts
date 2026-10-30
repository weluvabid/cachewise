import type { RunState, ScenarioId } from './types';

export type PolicyTotals = {
  requests: number;
  hits: number;
  misses: number;
  evictions: number;
  rejections: number;
  computeCost: number;
};

export type WorkloadResult = {
  id: ScenarioId;
  label: string;
  complete: boolean;
  lruHitRate: number;
  cachewiseHitRate: number;
  costReduction: number;
};

export type RunSummary = {
  lru: PolicyTotals;
  cachewise: PolicyTotals;
  workloads: WorkloadResult[];
  costReduction: number;
  completed: boolean;
  started: boolean;
};

const createTotals = (): PolicyTotals => ({
  requests: 0,
  hits: 0,
  misses: 0,
  evictions: 0,
  rejections: 0,
  computeCost: 0,
});

const percentage = (part: number, total: number): number => (total > 0 ? (part / total) * 100 : 0);

/** Derive aggregate and per-workload metrics from the current playback state. */
export function calculateRunSummary(
  runs: Record<ScenarioId, RunState>,
  scenarioIds: readonly ScenarioId[],
  labels: Record<ScenarioId, string>,
): RunSummary {
  const lru = createTotals();
  const cachewise = createTotals();
  const workloads = scenarioIds.map((id): WorkloadResult => {
    const run = runs[id];
    const snapshot = run.snapshots[run.step - 1];

    if (!snapshot) {
      return {
        id,
        label: labels[id],
        complete: false,
        lruHitRate: 0,
        cachewiseHitRate: 0,
        costReduction: 0,
      };
    }

    const lruRequests = snapshot.lruStats.hits + snapshot.lruStats.misses;
    const cachewiseRequests = snapshot.cachewiseStats.hits + snapshot.cachewiseStats.misses;

    lru.requests += lruRequests;
    lru.hits += snapshot.lruStats.hits;
    lru.misses += snapshot.lruStats.misses;
    lru.evictions += snapshot.lruStats.evictions;
    lru.rejections += snapshot.lruStats.rejections;
    lru.computeCost += snapshot.lruComputeCost;

    cachewise.requests += cachewiseRequests;
    cachewise.hits += snapshot.cachewiseStats.hits;
    cachewise.misses += snapshot.cachewiseStats.misses;
    cachewise.evictions += snapshot.cachewiseStats.evictions;
    cachewise.rejections += snapshot.cachewiseStats.rejections;
    cachewise.computeCost += snapshot.cachewiseComputeCost;

    return {
      id,
      label: labels[id],
      complete: run.step >= run.snapshots.length,
      lruHitRate: percentage(snapshot.lruStats.hits, lruRequests),
      cachewiseHitRate: percentage(snapshot.cachewiseStats.hits, cachewiseRequests),
      costReduction: percentage(
        snapshot.lruComputeCost - snapshot.cachewiseComputeCost,
        snapshot.lruComputeCost,
      ),
    };
  });

  return {
    lru,
    cachewise,
    workloads,
    costReduction: percentage(lru.computeCost - cachewise.computeCost, lru.computeCost),
    completed: workloads.every((workload) => workload.complete),
    started: scenarioIds.some((id) => runs[id].step > 0),
  };
}

export const formatPercentage = (value: number): string => `${value.toFixed(1)}%`;
export const formatCount = (value: number): string => value.toLocaleString();
