<script lang="ts">
  import * as Card from '$lib/components/ui/card';
  import { Progress } from '$lib/components/ui/progress';
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
  const subtitle = $derived(isCachewise ? 'Computation-aware' : 'Baseline · Least recently used');
</script>

<Card.Root class="h-full">
  <Card.Header class="space-y-1">
    <Card.Title>{title}</Card.Title>
    <Card.Description>{subtitle}</Card.Description>
  </Card.Header>

  <Card.Content class="space-y-5">
    {#each scenarioIds as id, index (id)}
      {@const run = runs[id]}
      {@const snapshot = run.snapshots[run.step - 1]}
      {@const stats = isCachewise ? snapshot?.smartStats : snapshot?.lruStats}
      {@const entries = isCachewise ? snapshot?.smart : snapshot?.lru}
      {@const bytesUsed = stats?.bytesUsed ?? 0}
      <section class="space-y-2">
        <div class="flex items-baseline justify-between gap-3">
          <h3 class="font-semibold">{definitions[id].label}</h3>
          <span class="shrink-0 text-xs tabular-nums text-muted-foreground">{run.step}/{run.snapshots.length}</span>
        </div>
        <p class="text-sm text-muted-foreground">{definitions[id].description}</p>
        <div class="flex items-center justify-between gap-2 text-sm">
          <span class="text-muted-foreground">Memory used</span>
          <span class="font-medium tabular-nums">{bytesUsed} / {capacity} KB</span>
        </div>
        <Progress value={bytesUsed} max={capacity} />
        <p class="text-xs text-muted-foreground">
          Resident entries: <span class="font-medium text-foreground">{entries?.length ?? 0}</span>
        </p>
      </section>
      {#if index < scenarioIds.length - 1}
        <div class="border-t" />
      {/if}
    {/each}
  </Card.Content>
</Card.Root>
