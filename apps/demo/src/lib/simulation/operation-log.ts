import type { RunState, ScenarioId } from './types';

export type OperationLogRow = {
  id: string;
  sequence: number;
  workload: string;
  operation: string;
  detail: string;
  lruEntries: number;
  cachewiseEntries: number;
};

export const buildOperationLogRows = (
  runs: Record<ScenarioId, RunState>,
  scenarioIds: readonly ScenarioId[],
  labels: Record<ScenarioId, string>
): OperationLogRow[] =>
  scenarioIds
    .flatMap((id) =>
      runs[id].snapshots.slice(0, runs[id].step).map((snapshot) => ({
        id: `${id}-${snapshot.sequence}`,
        sequence: snapshot.sequence,
        workload: labels[id],
        operation: snapshot.operation,
        detail: snapshot.detail,
        lruEntries: snapshot.lru.length,
        cachewiseEntries: snapshot.smart.length
      }))
    )
    .sort((a, b) => b.sequence - a.sequence);
