import type { Cache } from 'cachewise';

type CacheStats = ReturnType<Cache<string, string>['getStats']>;

export type ScenarioId = 'balanced' | 'expensive' | 'pressure';

export type Operation =
  { kind: 'get'; key: string } | { kind: 'set'; key: string; size: number; cost: number };

export type WorkloadEntry = {
  key: string;
  sizeRatio: number;
  cost: number;
  weight: number;
};

export type Snapshot = {
  lruEntryCount: number;
  cachewiseEntryCount: number;
  lruStats: CacheStats;
  cachewiseStats: CacheStats;
  lruComputeCost: number;
  cachewiseComputeCost: number;
};

export type RunState = {
  snapshots: Snapshot[];
  step: number;
};

export type ScenarioDefinition = {
  label: string;
  description: string;
  seed: number;
  rounds: number;
  transientSizeRatio: number;
  entries: WorkloadEntry[];
};
