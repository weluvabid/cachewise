import type { RunState, ScenarioId } from './types';

export type OperationLogRow = {
  id: string;
  sequence: number;
  workload: string;
  operation: string;
  lruResult: string;
  cachewiseResult: string;
  lruEntries: number;
  cachewiseEntries: number;
  detail: string;
};

export const buildOperationLogRows = (
  runs: Record<ScenarioId, RunState>,
  scenarioIds: readonly ScenarioId[],
  labels: Record<ScenarioId, string>,
): OperationLogRow[] =>
  scenarioIds
    .flatMap((id) => {
      const snapshots = runs[id].snapshots.slice(0, runs[id].step);

      return snapshots.map((snapshot, index) => {
        const previous = snapshots[index - 1];
        const lruResult = snapshot.operation.startsWith('Read ')
          ? snapshot.lruStats.hits > (previous?.lruStats.hits ?? 0)
            ? 'Hit'
            : 'Miss'
          : snapshot.lruRejected
            ? 'Declined'
            : 'Admitted';
        const cachewiseResult = snapshot.operation.startsWith('Read ')
          ? snapshot.smartStats.hits > (previous?.smartStats.hits ?? 0)
            ? 'Hit'
            : 'Miss'
          : snapshot.smartRejected
            ? 'Declined'
            : 'Admitted';

        return {
          id: `${id}-${snapshot.sequence}`,
          sequence: snapshot.sequence,
          workload: labels[id],
          operation: snapshot.operation,
          lruResult,
          cachewiseResult,
          lruEntries: snapshot.lru.length,
          cachewiseEntries: snapshot.smart.length,
          detail: snapshot.detail,
        };
      });
    })
    .sort((a, b) => b.sequence - a.sequence);

export const filterOperationLogRows = (
  rows: readonly OperationLogRow[],
  workload: string,
  query: string,
): OperationLogRow[] => {
  const normalizedQuery = query.trim().toLowerCase();

  return rows.filter((row) => {
    const matchesWorkload = workload === 'all' || row.workload === workload;
    const matchesQuery =
      !normalizedQuery ||
      `${row.sequence} ${row.workload} ${row.operation} ${row.lruResult} ${row.cachewiseResult} ${row.detail}`
        .toLowerCase()
        .includes(normalizedQuery);

    return matchesWorkload && matchesQuery;
  });
};
