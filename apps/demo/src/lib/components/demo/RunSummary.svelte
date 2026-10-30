<script lang="ts">
  import { Info } from '@lucide/svelte';
  import * as Card from '$lib/components/ui/card';
  import * as Table from '$lib/components/ui/table';
  import * as Tooltip from '$lib/components/ui/tooltip';
  import type { RunState, ScenarioId } from '$lib/simulation/types';

  type Props = {
    runs: Record<ScenarioId, RunState>;
    scenarioIds: ScenarioId[];
    labels: Record<ScenarioId, string>;
  };

  let { runs, scenarioIds, labels }: Props = $props();

  type Totals = {
    requests: number;
    hits: number;
    misses: number;
    evictions: number;
    rejections: number;
    computeCost: number;
  };

  const emptyTotals = (): Totals => ({
    requests: 0,
    hits: 0,
    misses: 0,
    evictions: 0,
    rejections: 0,
    computeCost: 0
  });

  const results = $derived.by(() => {
    const lru = emptyTotals();
    const cachewise = emptyTotals();
    const workloads = scenarioIds.map((id) => {
      const run = runs[id];
      const snapshot = run.snapshots[run.step - 1];
      if (!snapshot) {
        return {
          id,
          label: labels[id],
          complete: false,
          lruHitRate: 0,
          cachewiseHitRate: 0,
          costReduction: 0
        };
      }

      const lruRequests = snapshot.lruStats.hits + snapshot.lruStats.misses;
      const cachewiseRequests = snapshot.smartStats.hits + snapshot.smartStats.misses;
      lru.requests += lruRequests;
      lru.hits += snapshot.lruStats.hits;
      lru.misses += snapshot.lruStats.misses;
      lru.evictions += snapshot.lruStats.evictions;
      lru.rejections += snapshot.lruStats.rejections;
      lru.computeCost += snapshot.lruComputeCost;

      cachewise.requests += cachewiseRequests;
      cachewise.hits += snapshot.smartStats.hits;
      cachewise.misses += snapshot.smartStats.misses;
      cachewise.evictions += snapshot.smartStats.evictions;
      cachewise.rejections += snapshot.smartStats.rejections;
      cachewise.computeCost += snapshot.smartComputeCost;

      return {
        id,
        label: labels[id],
        complete: run.step >= run.snapshots.length,
        lruHitRate: lruRequests ? snapshot.lruStats.hits / lruRequests * 100 : 0,
        cachewiseHitRate: cachewiseRequests ? snapshot.smartStats.hits / cachewiseRequests * 100 : 0,
        costReduction: snapshot.lruComputeCost > 0
          ? (snapshot.lruComputeCost - snapshot.smartComputeCost) / snapshot.lruComputeCost * 100
          : 0
      };
    });

    const costReduction = lru.computeCost > 0
      ? (lru.computeCost - cachewise.computeCost) / lru.computeCost * 100
      : 0;
    const completed = workloads.every((workload) => workload.complete);
    const started = workloads.some((workload) => runs[workload.id].step > 0);

    return { lru, cachewise, workloads, costReduction, completed, started };
  });

  const hitRate = (hits: number, requests: number): number => requests ? hits / requests * 100 : 0;
  const formatRate = (value: number): string => `${value.toFixed(1)}%`;
  const formatCost = (value: number): string => value.toLocaleString();
  const status = $derived(results.completed ? 'Complete' : results.started ? 'In progress' : 'Ready');
</script>

<Tooltip.Provider>
  <Card.Root>
    <Card.Header class="space-y-1">
      <div class="flex items-center gap-2">
        <Card.Title>Run summary</Card.Title>
        <span class="ml-auto">
          <Tooltip.Root>
            <Tooltip.Trigger>
              <Info size={15} class="text-muted-foreground" aria-label={`Simulation status: ${status}`} />
            </Tooltip.Trigger>
            <Tooltip.Content>Simulation status: {status}. Metrics update as the three deterministic workloads execute.</Tooltip.Content>
          </Tooltip.Root>
        </span>
      </div>
      <Card.Description>Aggregate results across all three workloads.</Card.Description>
    </Card.Header>

    <Card.Content class="space-y-7">
      <div class="grid gap-6 sm:grid-cols-2">
        {#each [{ label: 'LRU', data: results.lru }, { label: 'Cachewise', data: results.cachewise }] as policy}
          <section class="space-y-3">
            <h3 class="font-semibold">{policy.label}</h3>
            <dl class="space-y-2 text-sm">
              <div class="flex justify-between gap-4"><dt class="text-muted-foreground">Cache lookups</dt><dd class="font-medium tabular-nums">{policy.data.requests.toLocaleString()}</dd></div>
              <div class="flex justify-between gap-4"><dt class="text-muted-foreground">Cache hits</dt><dd class="font-medium tabular-nums">{policy.data.hits.toLocaleString()}</dd></div>
              <div class="flex justify-between gap-4"><dt class="text-muted-foreground">Cache misses</dt><dd class="font-medium tabular-nums">{policy.data.misses.toLocaleString()}</dd></div>
              <div class="flex justify-between gap-4"><dt class="text-muted-foreground">Hit rate</dt><dd class="font-medium tabular-nums">{formatRate(hitRate(policy.data.hits, policy.data.requests))}</dd></div>
              <div class="flex justify-between gap-4"><dt class="text-muted-foreground">Miss recomputation cost</dt><dd class="font-medium tabular-nums">{formatCost(policy.data.computeCost)}</dd></div>
              <div class="flex justify-between gap-4"><dt class="text-muted-foreground">Evictions</dt><dd class="font-medium tabular-nums">{policy.data.evictions.toLocaleString()}</dd></div>
              <div class="flex justify-between gap-4"><dt class="text-muted-foreground">Admission rejections</dt><dd class="font-medium tabular-nums">{policy.data.rejections.toLocaleString()}</dd></div>
            </dl>
          </section>
        {/each}
      </div>

      <section class="rounded-lg border bg-muted/30 p-4">
        <p class="text-sm text-muted-foreground">Recomputation cost reduction</p>
        <p class="mt-1 text-3xl font-semibold tabular-nums">{formatRate(results.costReduction)}</p>
        <p class="mt-1 text-xs text-muted-foreground">Compared with LRU across the workloads. Negative values mean Cachewise incurred more recomputation cost.</p>
      </section>

      <section class="space-y-3">
        <h3 class="font-semibold">Workload breakdown</h3>
        <div class="overflow-x-auto">
          <Table.Root>
            <Table.Header>
              <Table.Row>
                <Table.Head>Workload</Table.Head>
                <Table.Head class="text-right">LRU hit rate</Table.Head>
                <Table.Head class="text-right">Cachewise hit rate</Table.Head>
                <Table.Head class="text-right">Cost reduction</Table.Head>
              </Table.Row>
            </Table.Header>
            <Table.Body>
              {#each results.workloads as workload (workload.id)}
                <Table.Row>
                  <Table.Cell class="font-medium">{workload.label}</Table.Cell>
                  <Table.Cell class="text-right tabular-nums">{formatRate(workload.lruHitRate)}</Table.Cell>
                  <Table.Cell class="text-right tabular-nums">{formatRate(workload.cachewiseHitRate)}</Table.Cell>
                  <Table.Cell class="text-right tabular-nums">{formatRate(workload.costReduction)}</Table.Cell>
                </Table.Row>
              {/each}
            </Table.Body>
          </Table.Root>
        </div>
      </section>

      <section class="border-t pt-4">
        <p class="text-xs text-muted-foreground">
          - LRU remembers what you touched last.
        </p>
        <p class="text-xs text-muted-foreground">
          - Cachewise weighs what it would cost to compute again.
        </p>
      </section>
    </Card.Content>
  </Card.Root>
</Tooltip.Provider>
