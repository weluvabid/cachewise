<script lang="ts">
  import { onDestroy } from 'svelte';
  import { Pause, Play, RotateCcw, SkipForward } from '@lucide/svelte';
  import { Button } from '$lib/components/ui/button';
  import WorkloadCard from './WorkloadCard.svelte';
  import RunSummary from './RunSummary.svelte';
  import { buildSnapshots } from '$lib/simulation/engine';
  import { scenarios, scenarioIds } from '$lib/simulation/scenarios';
  import type { RunState, ScenarioId } from '$lib/simulation/types';

  const capacity = 100;
  const createRuns = (): Record<ScenarioId, RunState> => ({
    balanced: { snapshots: buildSnapshots('balanced', capacity), step: 0 },
    expensive: { snapshots: buildSnapshots('expensive', capacity), step: 0 },
    pressure: { snapshots: buildSnapshots('pressure', capacity), step: 0 }
  });

  const scenarioLabels = {
    balanced: scenarios.balanced.label,
    expensive: scenarios.expensive.label,
    pressure: scenarios.pressure.label
  } satisfies Record<ScenarioId, string>;

  let runs = $state(createRuns());
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
    runs = createRuns();
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

  onDestroy(stop);
</script>

<div class="space-y-8">
  <div class="flex justify-center">
    <div class="flex flex-wrap items-center justify-center gap-2">
      <Button variant="outline" onclick={togglePlayback}>
        {#if playing}<Pause size={16} />{:else}<Play size={16} />{/if}
      </Button>
      <Button variant="outline" onclick={stepAll} disabled={allComplete || playing}>
        <SkipForward size={16} />
      </Button>
      <Button variant="outline" size="icon" onclick={reset} aria-label="Reset all simulations">
        <RotateCcw size={16} />
      </Button>
    </div>
  </div>

  <div class="grid grid-cols-1 gap-4 md:grid-cols-2">
    <WorkloadCard policy="lru" definitions={scenarios} {runs} {scenarioIds} {capacity} />
    <WorkloadCard policy="cachewise" definitions={scenarios} {runs} {scenarioIds} {capacity} />
  </div>

  <RunSummary {runs} {scenarioIds} labels={scenarioLabels} />
</div>
