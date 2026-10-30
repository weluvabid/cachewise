<script lang="ts">
  import { Info } from '@lucide/svelte';
  import * as Card from '$lib/components/ui/card';
  import { Badge } from '$lib/components/ui/badge';
  import { Progress } from '$lib/components/ui/progress';
  import * as Tooltip from '$lib/components/ui/tooltip';
  import type { RunState, ScenarioDefinition, ScenarioId } from '$lib/simulation/types';

  type Policy = 'lru' | 'cachewise';
  type Props = {
    policy: Policy;
    definitions: Record<ScenarioId, ScenarioDefinition>;
    runs: Record<ScenarioId, RunState>;
    scenarioIds: ScenarioId[];
    capacity: number;
  };

  let { policy, definitions, runs, scenarioIds, capacity }: Props = $props();

  const isCachewise = $derived(policy === 'cachewise');
  const title = $derived(isCachewise ? 'Cachewise' : 'LRU');
  const badge = $derived(isCachewise ? 'Computation Aware' : 'Least Recently Used');
</script>

<Tooltip.Provider>
  <Card.Root class="h-full">
    <Card.Header class="pb-4">
      <div class="flex flex-wrap items-center gap-2">
        <Card.Title>{title}</Card.Title>
        <Badge variant="outline" class="font-normal text-muted-foreground">{badge}</Badge>
      </div>
    </Card.Header>

    <Card.Content class="space-y-5">
      {#each scenarioIds as id, index (id)}
        {@const run = runs[id]}
        {@const snapshot = run.snapshots[run.step - 1]}
        {@const stats = isCachewise ? snapshot?.cachewiseStats : snapshot?.lruStats}
        {@const entryCount = isCachewise ? snapshot?.cachewiseEntryCount : snapshot?.lruEntryCount}
        {@const bytesUsed = stats?.bytesUsed ?? 0}
        <section class="space-y-2">
          <div class="flex items-center justify-between gap-3">
            <div class="flex min-w-0 items-center gap-1.5">
              <h3 class="font-semibold">{definitions[id].label}</h3>
              <Tooltip.Root>
                <Tooltip.Trigger
                  class="inline-flex size-7 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ring"
                  aria-label={`About ${definitions[id].label}`}
                >
                  <Info size={14} aria-hidden="true" />
                </Tooltip.Trigger>
                <Tooltip.Content>{definitions[id].description}</Tooltip.Content>
              </Tooltip.Root>
            </div>
            <span class="shrink-0 text-xs tabular-nums text-muted-foreground"
              >{run.step}/{run.snapshots.length}</span
            >
          </div>
          <div class="flex items-center justify-between gap-2 text-sm">
            <span class="text-muted-foreground">Memory used</span>
            <span class="font-medium tabular-nums">{bytesUsed} / {capacity} KB</span>
          </div>
          <Progress
            value={bytesUsed}
            max={capacity}
            aria-label={`${title} ${definitions[id].label} memory usage`}
          />
          <p class="text-xs text-muted-foreground">
            Resident entries: <span class="font-medium text-foreground">{entryCount ?? 0}</span>
          </p>
        </section>
        {#if index < scenarioIds.length - 1}
          <div class="border-t"></div>
        {/if}
      {/each}
    </Card.Content>
  </Card.Root>
</Tooltip.Provider>
