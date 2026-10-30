<script lang="ts">
  import { Search } from '@lucide/svelte';
  import * as Select from '$lib/components/ui/select';
  import * as Table from '$lib/components/ui/table';
  import { Button } from '$lib/components/ui/button';
  import type { RunState, ScenarioId } from '$lib/simulation/types';
  import { buildOperationLogRows, filterOperationLogRows } from '$lib/simulation/operation-log';

  type Props = {
    runs: Record<ScenarioId, RunState>;
    scenarioIds: ScenarioId[];
    labels: Record<ScenarioId, string>;
  };

  let { runs, scenarioIds, labels }: Props = $props();
  let workloadFilter = $state('all');
  let query = $state('');
  let allOperations = $derived(buildOperationLogRows(runs, scenarioIds, labels));
  let visibleOperations = $derived(filterOperationLogRows(allOperations, workloadFilter, query));

  function setWorkload(value: string): void {
    workloadFilter = value;
  }
</script>

<section class="space-y-3">
  <div class="flex flex-wrap items-center justify-between gap-3">
    <h3 class="font-semibold">Operation log <span class="font-normal text-muted-foreground">· All workloads</span></h3>
    <span class="text-xs text-muted-foreground">{visibleOperations.length} of {allOperations.length} operations</span>
  </div>

  <div class="flex flex-wrap items-center gap-2">
    <div class="relative min-w-0 flex-1 sm:max-w-sm">
      <Search size={16} class="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
      <input
        aria-label="Search operation log"
        placeholder="Search operations..."
        bind:value={query}
        class="border-input placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-ring/50 h-9 w-full min-w-0 rounded-md border bg-transparent py-1 pe-3 ps-9 text-sm shadow-xs outline-none focus-visible:ring-[3px]"
      />
    </div>
    <Select.Root type="single" value={workloadFilter} onValueChange={setWorkload}>
      <Select.Trigger class="w-44"><Select.Value placeholder="All workloads" /></Select.Trigger>
      <Select.Content>
        <Select.Item value="all">All workloads</Select.Item>
        {#each scenarioIds as id (id)}
          <Select.Item value={labels[id]}>{labels[id]}</Select.Item>
        {/each}
      </Select.Content>
    </Select.Root>
    {#if query || workloadFilter !== 'all'}
      <Button variant="ghost" size="sm" onclick={() => { query = ''; workloadFilter = 'all'; }}>Clear</Button>
    {/if}
  </div>

  <div class="max-h-80 overflow-auto rounded-md border">
    <Table.Root class="min-w-[56rem]">
      <Table.Header>
        <Table.Row>
          <Table.Head class="w-16">#</Table.Head>
          <Table.Head>Workload</Table.Head>
          <Table.Head>Operation</Table.Head>
          <Table.Head>LRU result</Table.Head>
          <Table.Head>Cachewise result</Table.Head>
          <Table.Head class="text-right">LRU entries</Table.Head>
          <Table.Head class="text-right">Cachewise entries</Table.Head>
        </Table.Row>
      </Table.Header>
      <Table.Body>
        {#each visibleOperations as item (item.id)}
          <Table.Row>
            <Table.Cell class="font-mono tabular-nums">{item.sequence}</Table.Cell>
            <Table.Cell>{item.workload}</Table.Cell>
            <Table.Cell class="font-medium">{item.operation}</Table.Cell>
            <Table.Cell class="text-muted-foreground">{item.lruResult}</Table.Cell>
            <Table.Cell class="text-muted-foreground">{item.cachewiseResult}</Table.Cell>
            <Table.Cell class="text-right tabular-nums">{item.lruEntries}</Table.Cell>
            <Table.Cell class="text-right tabular-nums">{item.cachewiseEntries}</Table.Cell>
          </Table.Row>
        {:else}
          <Table.Row>
            <Table.Cell colspan={7} class="h-24 text-center text-muted-foreground">
              {allOperations.length ? 'No operations match these filters.' : 'Operations will appear here as the simulations run.'}
            </Table.Cell>
          </Table.Row>
        {/each}
      </Table.Body>
    </Table.Root>
  </div>
</section>
