<script lang="ts">
  import { onDestroy } from 'svelte';
  import { Pause, Play, RotateCcw, SkipForward } from '@lucide/svelte';
  import { Button } from '$lib/components/ui/button';
  import { Badge } from '$lib/components/ui/badge';
  import * as Tooltip from '$lib/components/ui/tooltip';
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
  let hasProgress = $derived(scenarioIds.some((id) => runs[id].step > 0));
  let playbackLabel = $derived(playing ? 'Pause' : allComplete ? 'Replay all' : hasProgress ? 'Resume' : 'Play all');

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
    <div
      class="fixed bottom-4 left-1/2 z-50 flex -translate-x-1/2 items-center gap-2 rounded-full border border-border/70 bg-background/75 p-2 shadow-xl shadow-black/10 backdrop-blur-xl supports-[backdrop-filter]:bg-background/65"
      aria-label="Simulation playback controls"
    >
      <Tooltip.Root>
        <Tooltip.Trigger>
          <Button
            variant="outline"
            size="icon"
            class="rounded-full border-transparent bg-transparent shadow-none hover:bg-muted"
            onclick={reset}
            aria-label="Reset all simulations"
          >
            <RotateCcw size={16} />
          </Button>
        </Tooltip.Trigger>
        <Tooltip.Content>Reset all simulations</Tooltip.Content>
      </Tooltip.Root>

      <Tooltip.Root>
        <Tooltip.Trigger>
          <Button
            variant={playing ? 'outline' : 'default'}
            size="icon"
            class={playing
              ? 'rounded-full border-amber-500/40 bg-amber-500/10 text-amber-600 shadow-none hover:bg-amber-500/20 hover:text-amber-600 dark:text-amber-400 dark:hover:text-amber-400'
              : 'rounded-full shadow-sm'}
            onclick={togglePlayback}
            aria-label={playbackLabel}
          >
            {#if playing}<Pause size={16} />{:else}<Play size={16} />{/if}
          </Button>
        </Tooltip.Trigger>
        <Tooltip.Content>{playbackLabel}</Tooltip.Content>
      </Tooltip.Root>

      <Tooltip.Root>
        <Tooltip.Trigger>
          <span class="inline-flex">
            <Button
              variant="outline"
              size="icon"
              class="rounded-full border-transparent bg-transparent shadow-none hover:bg-muted disabled:pointer-events-auto disabled:cursor-not-allowed"
              onclick={stepAll}
              disabled={allComplete || playing}
              aria-label="Step forward"
            >
              <SkipForward size={16} />
            </Button>
          </span>
        </Tooltip.Trigger>
        <Tooltip.Content>{playing ? 'Pause playback to step manually' : allComplete ? 'Simulation complete' : 'Step forward'}</Tooltip.Content>
      </Tooltip.Root>
    </div>
  </Tooltip.Provider>
</div>
