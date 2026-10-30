<script lang="ts">
  import * as ScrollArea from '$lib/components/ui/scroll-area';
  import * as Table from '$lib/components/ui/table';
  import type { RunState, ScenarioId } from '$lib/simulation/types';
  import { buildOperationLogRows } from '$lib/simulation/operation-log';

  type Props = {
    runs: Record<ScenarioId, RunState>;
    scenarioIds: ScenarioId[];
    labels: Record<ScenarioId, string>;
  };

  let { runs, scenarioIds, labels }: Props = $props();

  let visibleOperations = $derived(buildOperationLogRows(runs, scenarioIds, labels));
</script>

<section class="space-y-2">
  <div class="flex items-center justify-between gap-3">
    <h3 class="font-semibold">Operation log <span class="font-normal text-muted-foreground">· All workloads</span></h3>
    <span class="text-xs text-muted-foreground">{visibleOperations.length} operations</span>
  </div>
  <ScrollArea.Root class="h-64 rounded-md border">
    <Table.Root class="min-w-[48rem]">
      <Table.Header>
        <Table.Row>
          <Table.Head class="w-16">#</Table.Head>
          <Table.Head>Workload</Table.Head>
          <Table.Head>Operation</Table.Head>
          <Table.Head class="text-right">LRU entries</Table.Head>
          <Table.Head class="text-right">Cachewise entries</Table.Head>
          <Table.Head>Details</Table.Head>
        </Table.Row>
      </Table.Header>
      <Table.Body>
        {#each visibleOperations as item (item.id)}
          <Table.Row>
            <Table.Cell class="font-mono tabular-nums">{item.sequence}</Table.Cell>
            <Table.Cell>{item.workload}</Table.Cell>
            <Table.Cell class="font-medium">{item.operation}</Table.Cell>
            <Table.Cell class="text-right tabular-nums">{item.lruEntries}</Table.Cell>
            <Table.Cell class="text-right tabular-nums">{item.cachewiseEntries}</Table.Cell>
            <Table.Cell class="text-muted-foreground">{item.detail}</Table.Cell>
          </Table.Row>
        {:else}
          <Table.Row>
            <Table.Cell colspan={6} class="h-24 text-center text-muted-foreground">
              Operations will appear here as the simulations run.
            </Table.Cell>
          </Table.Row>
        {/each}
      </Table.Body>
    </Table.Root>
    <ScrollArea.Scrollbar orientation="vertical" />
    <ScrollArea.Scrollbar orientation="horizontal" />
  </ScrollArea.Root>
</section>
