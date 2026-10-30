<script lang="ts">
  import { onDestroy } from 'svelte';
  import { Database, Pause, Play, RotateCcw, SkipForward } from '@lucide/svelte';
  import * as Card from '$lib/components/ui/card';
  import * as Select from '$lib/components/ui/select';
  import { Button } from '$lib/components/ui/button';
  import WorkloadCard from './WorkloadCard.svelte';
  import OperationLog from './OperationLog.svelte';
  import { buildSnapshots } from '$lib/simulation/engine';
  import { budgets, scenarios, scenarioIds } from '$lib/simulation/scenarios';
  import type { RunState, ScenarioId } from '$lib/simulation/types';

  const createRuns = (capacity: number): Record<ScenarioId, RunState> => ({
    balanced: { snapshots: buildSnapshots('balanced', capacity), step: 0 },
    expensive: { snapshots: buildSnapshots('expensive', capacity), step: 0 },
    pressure: { snapshots: buildSnapshots('pressure', capacity), step: 0 }
  });

  const scenarioLabels = {
    balanced: scenarios.balanced.label,
    expensive: scenarios.expensive.label,
    pressure: scenarios.pressure.label
  } satisfies Record<ScenarioId, string>;

  let capacity = $state('100');
  let runs = $state(createRuns(Number(capacity)));
  let playing = $state(false);
  let timer: ReturnType<typeof setInterval> | undefined;

  let allComplete = $derived(scenarioIds.every((id) => runs[id].step >= runs[id].snapshots.length));

  function stop(): void {
    playing = false;
    if (timer !== undefined) clearInterval(timer);
    timer = undefined;
  }

  function reset(): void {
    stop();
    runs = createRuns(Number(capacity));
  }

  function advance(): void {
    if (allComplete) {
      stop();
      return;
    }
    const nextRuns = { ...runs };
    for (const id of scenarioIds) {
      const run = nextRuns[id];
      if (run.step < run.snapshots.length) nextRuns[id] = { ...run, step: run.step + 1 };
    }
    runs = nextRuns;
    if (scenarioIds.every((id) => runs[id].step >= runs[id].snapshots.length)) stop();
  }

  function togglePlayback(): void {
    if (playing) {
      stop();
      return;
    }
    if (allComplete) reset();
    playing = true;
    timer = setInterval(advance, 700);
  }

  function stepAll(): void {
    stop();
    advance();
  }

  function selectBudget(value: string): void {
    if (budgets.some((budget) => String(budget) === value)) {
      capacity = value;
      reset();
    }
  }

  onDestroy(stop);
</script>

<Card.Root>
  <Card.Header class="gap-4 sm:flex-row sm:items-center sm:justify-between">
    <div class="space-y-1">
      <Card.Description>INTERACTIVE SIMULATION</Card.Description>
      <Card.Title>Same workload. Different decisions.</Card.Title>
    </div>
    <div class="flex flex-wrap items-center gap-2">
      <Database size={16} class="text-muted-foreground" />
      <span class="text-sm text-muted-foreground">Memory budget</span>
      <Select.Root type="single" value={capacity} onValueChange={selectBudget}>
        <Select.Trigger class="w-28"><Select.Value /></Select.Trigger>
        <Select.Content>
          {#each budgets as budget (budget)}
            <Select.Item value={String(budget)}>{budget} KB</Select.Item>
          {/each}
        </Select.Content>
      </Select.Root>
    </div>
  </Card.Header>

  <Card.Content class="space-y-6">
    <div class="flex flex-wrap items-center justify-between gap-3 border-b pb-4">
      <div class="space-y-1">
        <p class="text-sm font-medium">All workloads run together</p>
        <p class="text-sm text-muted-foreground">Each policy receives the same seeded operations at the selected memory budget.</p>
      </div>
      <div class="flex flex-wrap items-center gap-2">
        <Button onclick={togglePlayback}>
          {#if playing}<Pause size={16} /> Pause all{:else}<Play size={16} /> {allComplete ? 'Replay all' : 'Run all'}{/if}
        </Button>
        <Button variant="outline" onclick={stepAll} disabled={allComplete || playing}>
          <SkipForward size={16} /> Step all
        </Button>
        <Button variant="outline" size="icon" onclick={reset} aria-label="Reset all simulations">
          <RotateCcw size={16} />
        </Button>
      </div>
    </div>

    <div class="grid grid-cols-1 gap-3 md:grid-cols-2">
      <WorkloadCard
        policy="lru"
        definitions={scenarios}
        {runs}
        {scenarioIds}
        capacity={Number(capacity)}
      />
      <WorkloadCard
        policy="cachewise"
        definitions={scenarios}
        {runs}
        {scenarioIds}
        capacity={Number(capacity)}
      />
    </div>

    <OperationLog {runs} {scenarioIds} labels={scenarioLabels} />

    <p class="text-xs text-muted-foreground">
      All figures come from deterministic operation streams executed by both cache policies. Cost reduction compares accumulated miss cost against LRU; a negative value means Cachewise incurred more recomputation cost in that workload.
    </p>
  </Card.Content>
</Card.Root>
