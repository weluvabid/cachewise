<script lang="ts">
  import { onDestroy, onMount } from 'svelte';
  import { Keyboard, Pause, Play, RotateCcw, StepForward } from '@lucide/svelte';
  import { Badge } from '$lib/components/ui/badge';
  import * as Tooltip from '$lib/components/ui/tooltip';
  import * as Dialog from '$lib/components/ui/dialog';
  import { Separator } from '$lib/components/ui/separator';
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
  let shortcutsOpen = $state(false);
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

  function handleKeydown(event: KeyboardEvent): void {
    if (event.defaultPrevented || event.ctrlKey || event.metaKey || event.altKey || event.repeat) {
      return;
    }

    const target = event.target;
    if (!(target instanceof Element)) return;

    const isInteractive = target.closest(
      'input, textarea, select, button, a, summary, [contenteditable="true"], [role="button"], [role="textbox"]',
    );
    if (isInteractive) return;

    if (shortcutsOpen) return;

    if (event.key === '?') {
      event.preventDefault();
      shortcutsOpen = true;
      return;
    }

    if (event.shiftKey) return;

    switch (event.code) {
      case 'Space':
        event.preventDefault();
        togglePlayback();
        break;
      case 'ArrowRight':
        event.preventDefault();
        if (!playing && !allComplete) stepAll();
        break;
      case 'KeyR':
        event.preventDefault();
        reset();
        break;
    }
  }

  onMount(() => {
    window.addEventListener('keydown', handleKeydown);
    return () => window.removeEventListener('keydown', handleKeydown);
  });

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
        <Tooltip.Content>Reset all simulations · R</Tooltip.Content>
      </Tooltip.Root>

      <Tooltip.Root>
        <Tooltip.Trigger
          class={playing
            ? 'inline-flex size-9 items-center justify-center rounded-full border border-amber-500/40 bg-amber-500/10 text-amber-600 transition-colors hover:bg-amber-500/20 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring dark:text-amber-400'
            : 'inline-flex size-9 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-sm transition-colors hover:bg-primary/85 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring'}
          onclick={togglePlayback}
          aria-label={playbackLabel}
        >
          {#if playing}<Pause size={16} aria-hidden="true" />{:else}<Play
              size={16}
              aria-hidden="true"
            />{/if}
        </Tooltip.Trigger>
        <Tooltip.Content>{playbackLabel} · Space</Tooltip.Content>
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
              : 'Step forward · →'}</Tooltip.Content
        >
      </Tooltip.Root>

      <div class="mx-0.5 h-5 w-px bg-border" aria-hidden="true"></div>

      <Dialog.Root bind:open={shortcutsOpen}>
        <Tooltip.Root>
          <Tooltip.Trigger
            class="inline-flex size-9 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
            onclick={() => (shortcutsOpen = true)}
            aria-label="Show keyboard shortcuts"
          >
            <Keyboard size={16} aria-hidden="true" />
          </Tooltip.Trigger>
          <Tooltip.Content>Keyboard shortcuts (?)</Tooltip.Content>
        </Tooltip.Root>

        <Dialog.Content class="gap-5 sm:max-w-sm">
          <Dialog.Header>
            <Dialog.Title class="text-base">Keyboard shortcuts</Dialog.Title>
            <Dialog.Description>
              Control the Cachewise simulation without reaching for the playback dock.
            </Dialog.Description>
          </Dialog.Header>

          <div class="space-y-3">
            <p class="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Playback
            </p>
            <div class="flex items-center justify-between gap-4">
              <span>Play / pause</span>
              <kbd
                class="min-w-16 rounded-md border border-border bg-muted px-2 py-1 text-center font-mono text-xs text-foreground shadow-sm"
                >Space</kbd
              >
            </div>
            <div class="flex items-center justify-between gap-4">
              <span>Step forward</span>
              <kbd
                class="min-w-16 rounded-md border border-border bg-muted px-2 py-1 text-center font-mono text-xs text-foreground shadow-sm"
                >→</kbd
              >
            </div>
            <div class="flex items-center justify-between gap-4">
              <span>Reset simulation</span>
              <kbd
                class="min-w-16 rounded-md border border-border bg-muted px-2 py-1 text-center font-mono text-xs text-foreground shadow-sm"
                >R</kbd
              >
            </div>
          </div>

          <Separator />

          <div class="space-y-3">
            <p class="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              General
            </p>
            <div class="flex items-center justify-between gap-4">
              <span>Show shortcuts</span>
              <kbd
                class="min-w-16 rounded-md border border-border bg-muted px-2 py-1 text-center font-mono text-xs text-foreground shadow-sm"
                >?</kbd
              >
            </div>
            <div class="flex items-center justify-between gap-4">
              <span>Close dialog</span>
              <kbd
                class="min-w-16 rounded-md border border-border bg-muted px-2 py-1 text-center font-mono text-xs text-foreground shadow-sm"
                >Esc</kbd
              >
            </div>
          </div>
        </Dialog.Content>
      </Dialog.Root>
    </nav>
  </Tooltip.Provider>
</div>
