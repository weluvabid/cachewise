export type ScenarioId = 'balanced' | 'expensive' | 'pressure';
export type Operation =
  | { kind: 'get'; key: string }
  | { kind: 'set'; key: string; size: number; cost: number };
export type WorkloadEntry = { key: string; sizeRatio: number; cost: number; weight: number };
export type EntryView = { key: string; size: number; cost: number; frequency: number };
export type Snapshot = {
  sequence: number;
  operation: string;
  detail: string;
  lru: EntryView[];
  smart: EntryView[];
  lruStats: ReturnType<import('cachewise').Cache<string, string>['getStats']>;
  smartStats: ReturnType<import('cachewise').Cache<string, string>['getStats']>;
  lruEvicted: string[];
  smartEvicted: string[];
  lruRejected: boolean;
  smartRejected: boolean;
  lruComputeCost: number;
  smartComputeCost: number;
};
export type RunState = { snapshots: Snapshot[]; step: number };
export type ScenarioDefinition = {
  label: string;
  description: string;
  seed: number;
  rounds: number;
  transientSizeRatio: number;
  entries: WorkloadEntry[];
};
