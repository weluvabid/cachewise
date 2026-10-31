<script lang="ts">
  import { Info } from '@lucide/svelte';
  import * as Card from '$lib/components/ui/card';
  import * as Table from '$lib/components/ui/table';
  import * as Popover from '$lib/components/ui/popover';
  import { calculateRunSummary, formatCount, formatPercentage } from '$lib/simulation/summary';
  import type { RunState, ScenarioId } from '$lib/simulation/types';

  type Props = {
    runs: Record<ScenarioId, RunState>;
    scenarioIds: ScenarioId[];
    labels: Record<ScenarioId, string>;
  };

  let { runs, scenarioIds, labels }: Props = $props();

  const results = $derived(calculateRunSummary(runs, scenarioIds, labels));
  const status = $derived(
    results.completed ? 'Complete' : results.started ? 'In progress' : 'Ready',
  );
  const hitRate = (hits: number, requests: number): number =>
    requests > 0 ? (hits / requests) * 100 : 0;
</script>

<Card.Root>
  <Card.Header class="space-y-1">
    <div class="flex items-center gap-2">
      <Card.Title>Run summary</Card.Title>
      <span class="ml-auto">
        <Popover.Root>
          <Popover.Trigger
            class="touch-target inline-flex size-8 items-center justify-center rounded-full text-muted-foreground transition-[background-color,transform,color] duration-150 active:scale-95 hover:bg-muted hover:text-foreground"
            aria-label={`Simulation status: ${status}`}
          >
            <Info size={15} aria-hidden="true" />
          </Popover.Trigger>
          <Popover.Content side="bottom" align="end" class="w-72">
            Simulation status: {status}. Metrics update as the three deterministic workloads
            execute.
          </Popover.Content>
        </Popover.Root>
      </span>
    </div>
    <Card.Description>Aggregate results across all three workloads.</Card.Description>
  </Card.Header>

  <Card.Content class="space-y-7">
    <div class="grid gap-6 sm:grid-cols-2">
      {#each [{ label: 'LRU', data: results.lru }, { label: 'Cachewise', data: results.cachewise }] as policy (policy.label)}
        <section class="space-y-3">
          <h3 class="font-semibold">{policy.label}</h3>
          <dl class="space-y-2 text-sm">
            <div class="flex justify-between gap-4">
              <dt class="text-muted-foreground">Cache lookups</dt>
              <dd class="font-medium tabular-nums">{formatCount(policy.data.requests)}</dd>
            </div>
            <div class="flex justify-between gap-4">
              <dt class="text-muted-foreground">Cache hits</dt>
              <dd class="font-medium tabular-nums">{formatCount(policy.data.hits)}</dd>
            </div>
            <div class="flex justify-between gap-4">
              <dt class="text-muted-foreground">Cache misses</dt>
              <dd class="font-medium tabular-nums">{formatCount(policy.data.misses)}</dd>
            </div>
            <div class="flex justify-between gap-4">
              <dt class="text-muted-foreground">Hit rate</dt>
              <dd class="font-medium tabular-nums">
                {formatPercentage(hitRate(policy.data.hits, policy.data.requests))}
              </dd>
            </div>
            <div class="flex justify-between gap-4">
              <dt class="text-muted-foreground">Miss recomputation cost</dt>
              <dd class="font-medium tabular-nums">{formatCount(policy.data.computeCost)}</dd>
            </div>
            <div class="flex justify-between gap-4">
              <dt class="text-muted-foreground">Evictions</dt>
              <dd class="font-medium tabular-nums">{formatCount(policy.data.evictions)}</dd>
            </div>
            <div class="flex justify-between gap-4">
              <dt class="text-muted-foreground">Admission rejections</dt>
              <dd class="font-medium tabular-nums">{formatCount(policy.data.rejections)}</dd>
            </div>
          </dl>
        </section>
      {/each}
    </div>

    <section class="rounded-lg border bg-muted/30 p-4">
      <p class="text-sm text-muted-foreground">Recomputation cost reduction</p>
      <p class="mt-1 text-3xl font-semibold tabular-nums">
        {formatPercentage(results.costReduction)}
      </p>
      <p class="mt-1 text-xs text-muted-foreground">
        Compared with LRU across the workloads. Negative values mean Cachewise incurred more
        recomputation cost.
      </p>
    </section>

    <section class="space-y-3">
      <h3 class="font-semibold">Workload breakdown</h3>
      <div class="overflow-x-auto">
        <Table.Root>
          <caption class="sr-only"
            >Hit rate and recomputation cost by workload for each caching policy.</caption
          >
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
                <Table.Cell class="text-right tabular-nums"
                  >{formatPercentage(workload.lruHitRate)}</Table.Cell
                >
                <Table.Cell class="text-right tabular-nums"
                  >{formatPercentage(workload.cachewiseHitRate)}</Table.Cell
                >
                <Table.Cell class="text-right tabular-nums"
                  >{formatPercentage(workload.costReduction)}</Table.Cell
                >
              </Table.Row>
            {/each}
          </Table.Body>
        </Table.Root>
      </div>
    </section>

    <section class="border-t pt-4">
      <p class="text-xs text-muted-foreground">- LRU remembers what you touched last.</p>
      <p class="text-xs text-muted-foreground">
        - Cachewise weighs what it would cost to compute again.
      </p>
    </section>
  </Card.Content>
</Card.Root>
