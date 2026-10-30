import type { Snapshot } from './types';

export type MetricComparison = {
  label: string;
  baseline: number;
  cachewise: number;
  suffix?: string;
};

export function getMetrics(snapshot: Snapshot | undefined): MetricComparison[] {
  const lruRequests = snapshot ? snapshot.lruStats.hits + snapshot.lruStats.misses : 0;
  const smartRequests = snapshot ? snapshot.smartStats.hits + snapshot.smartStats.misses : 0;
  const hitRate = (hits: number, requests: number) => (requests ? (hits / requests) * 100 : 0);
  const reduction =
    snapshot && snapshot.lruComputeCost > 0
      ? ((snapshot.lruComputeCost - snapshot.smartComputeCost) / snapshot.lruComputeCost) * 100
      : 0;

  return [
    {
      label: 'Hit rate',
      baseline: snapshot ? hitRate(snapshot.lruStats.hits, lruRequests) : 0,
      cachewise: snapshot ? hitRate(snapshot.smartStats.hits, smartRequests) : 0,
      suffix: '%',
    },
    {
      label: 'Misses',
      baseline: snapshot?.lruStats.misses ?? 0,
      cachewise: snapshot?.smartStats.misses ?? 0,
    },
    {
      label: 'Recompute cost',
      baseline: snapshot?.lruComputeCost ?? 0,
      cachewise: snapshot?.smartComputeCost ?? 0,
    },
    {
      label: 'Cost reduction',
      baseline: 0,
      cachewise: reduction,
      suffix: '%',
    },
  ];
}

export function getCostReduction(snapshot: Snapshot | undefined): number {
  if (!snapshot || snapshot.lruComputeCost === 0) return 0;

  return ((snapshot.lruComputeCost - snapshot.smartComputeCost) / snapshot.lruComputeCost) * 100;
}
