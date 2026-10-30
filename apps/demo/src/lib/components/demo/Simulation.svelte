<script lang="ts">
  import { onDestroy } from 'svelte';
  import { Pause, Play, RotateCcw, StepForward } from '@lucide/svelte';
  import { Badge } from '$lib/components/ui/badge';
  import * as Tooltip from '$lib/components/ui/tooltip';
  import WorkloadCard from './WorkloadCard.svelte';
  import RunSummary from './RunSummary.svelte';
  import { buildSnapshots } from '$lib/simulation/engine';
  import { scenarios, scenarioIds } from '$lib/simulation/scenarios';
  import type { RunState, ScenarioId, Snapshot } from '$lib/simulation/types';

  const capacity = 100;
  const initialSnapshots: Record<ScenarioId, Snapshot[]> = {
    balanced: buildSnapshots('balanced', capacity),
    expensive: buildSnapshots('expensive', capacity),
    pressure: buildSnapshots('pressure', capacity),
  };

  const createRuns = (): Record<ScenarioId, RunState> => ({
    balanced: { snapshots: initialSnapshots.balanced, step: 0 },
    expensive: { snapshots: initialSnapshots.expensive, step: 0 },
    pressure: { snapshots: initialSnapshots.pressure, step: 0 },
  });

  const scenarioLabels = {
    balanced: scenarios.balanced.label,
    expensive: scenarios.expensive.label,
    pressure: scenarios.pressure.label,
  } satisfies Record<ScenarioId, string>;

  let runs = $state(createRuns());
  let playing = $state(false);
  let timer: ReturnType<typeof setInterval> | undefined;

  let allComplete = $derived(scenarioIds.every((id) => runs[id].step >= runs[id].snapshots.length));
  let hasProgress = $derived(scenarioIds.some((id) => runs[id].step > 0));
  let playbackLabel = $derived(
    playing ? 'Pause' : allComplete ? 'Replay all' : hasProgress ? 'Resume' : 'Play all',
  );

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
    <Badge
      variant="outline"
      class="h-auto rounded-full border-border/80 px-4 py-2 text-[11px] font-medium tracking-[0.14em] text-muted-foreground sm:text-xs"
    >
      COMPUTATION-AWARE CACHING
    </Badge>
  </div>

  <div class="grid grid-cols-1 gap-4 md:grid-cols-2">
    <WorkloadCard policy="lru" definitions={scenarios} {runs} {scenarioIds} {capacity} />
    <WorkloadCard policy="cachewise" definitions={scenarios} {runs} {scenarioIds} {capacity} />
  </div>

  <RunSummary {runs} {scenarioIds} labels={scenarioLabels} />

  <Tooltip.Provider delayDuration={250}>
    <nav
      class="fixed bottom-4 left-1/2 z-50 flex -translate-x-1/2 items-center gap-2 rounded-full border border-border/80 bg-background/90 p-2 shadow-xl shadow-black/10 backdrop-blur-xl supports-[backdrop-filter]:bg-background/80"
      aria-label="Simulation playback controls"
    >
      <Tooltip.Root>
        <Tooltip.Trigger
          class="inline-flex size-9 items-center justify-center rounded-full text-foreground transition-colors hover:bg-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
          onclick={reset}
          aria-label="Reset all simulations"
        >
          <RotateCcw size={16} aria-hidden="true" />
        </Tooltip.Trigger>
        <Tooltip.Content>Reset all simulations</Tooltip.Content>
      </Tooltip.Root>

      <Tooltip.Root>
        <Tooltip.Trigger
          class={playing
            ? 'inline-flex size-9 items-center justify-center rounded-full border border-amber-500/40 bg-amber-500/10 text-amber-600 transition-colors hover:bg-amber-500/20 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring dark:text-amber-400'
            : 'inline-flex size-9 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-sm transition-colors hover:bg-primary/85 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring'}
          onclick={togglePlayback}
          aria-label={playbackLabel}
        >
          {#if playing}<Pause size={16} aria-hidden="true" />{:else}<Play size={16} aria-hidden="true" />{/if}
        </Tooltip.Trigger>
        <Tooltip.Content>{playbackLabel}</Tooltip.Content>
      </Tooltip.Root>

      <Tooltip.Root>
        <Tooltip.Trigger
          class="inline-flex size-9 items-center justify-center rounded-full text-foreground transition-colors hover:bg-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:pointer-events-auto disabled:cursor-not-allowed disabled:opacity-45"
          onclick={stepAll}
          disabled={allComplete || playing}
          aria-label="Step forward"
        >
          <StepForward size={16} aria-hidden="true" />
        </Tooltip.Trigger>
        <Tooltip.Content
          >{playing
            ? 'Pause playback to step manually'
            : allComplete
              ? 'Simulation complete'
              : 'Step forward'}</Tooltip.Content
        >
      </Tooltip.Root>
    </nav>
  </Tooltip.Provider>
</div>
