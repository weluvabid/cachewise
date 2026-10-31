<script lang="ts">
  import { onDestroy, onMount } from 'svelte';
  import { Keyboard, Pause, Play, RotateCcw, StepForward } from '@lucide/svelte';
  import { Badge } from '$lib/components/ui/badge';
  import * as Tooltip from '$lib/components/ui/tooltip';
  import * as Dialog from '$lib/components/ui/dialog';
  import { Spinner } from '$lib/components/ui/spinner';
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
  let keyboardPressed = $state<string | null>(null);
  let keyboardPressTimer: ReturnType<typeof setTimeout> | undefined;
  let badgeSentinel: HTMLDivElement;
  let badgePinned = $state(false);

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

  function triggerKeyboardClick(id: string): void {
    const button = document.getElementById(id);
    if (!(button instanceof HTMLButtonElement) || button.disabled) return;

    keyboardPressed = id;
    button.click();

    if (keyboardPressTimer !== undefined) clearTimeout(keyboardPressTimer);
    keyboardPressTimer = setTimeout(() => {
      keyboardPressed = null;
      keyboardPressTimer = undefined;
    }, 140);
  }

  function handleKeydown(event: KeyboardEvent): void {
    if (event.defaultPrevented || event.ctrlKey || event.metaKey || event.altKey || event.repeat) {
      return;
    }

    if (shortcutsOpen && event.key === 'Escape') {
      event.preventDefault();
      shortcutsOpen = false;
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
      triggerKeyboardClick('simulation-shortcuts');
      return;
    }

    if (event.shiftKey) return;

    switch (event.code) {
      case 'Space':
        event.preventDefault();
        triggerKeyboardClick('simulation-playback');
        break;
      case 'ArrowRight':
        event.preventDefault();
        if (!playing && !allComplete) triggerKeyboardClick('simulation-step');
        break;
      case 'KeyR':
        event.preventDefault();
        triggerKeyboardClick('simulation-reset');
        break;
    }
  }

  onMount(() => {
    window.addEventListener('keydown', handleKeydown);

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (entry) badgePinned = !entry.isIntersecting;
      },
      { rootMargin: '-84px 0px 0px 0px', threshold: 0 },
    );
    observer.observe(badgeSentinel);

    return () => {
      window.removeEventListener('keydown', handleKeydown);
      observer.disconnect();
    };
  });

  onDestroy(() => {
    stop();
    if (keyboardPressTimer !== undefined) clearTimeout(keyboardPressTimer);
  });
</script>

<div class="space-y-8">
  <div bind:this={badgeSentinel} class="h-px" aria-hidden="true"></div>
  <div class="sticky top-[5.25rem] z-30 -mt-8 flex justify-center py-2">
    <Badge
      variant="outline"
      class={`rounded-full border-border/80 bg-card/95 font-medium tracking-[0.14em] text-muted-foreground shadow-sm backdrop-blur-xl transition-[padding,font-size] duration-200 ${badgePinned ? 'h-7 px-3 text-[10px] sm:text-[11px]' : 'h-auto px-4 py-2 text-[11px] sm:text-xs'}`}
    >
      <span class="status-indicator" aria-hidden="true">
        {#if playing}
          <Spinner class="!size-full text-[var(--brand)]" role="presentation" aria-hidden="true" />
        {:else}
          <span class="status-dot"></span>
        {/if}
      </span>
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
      class="playback-dock fixed bottom-4 left-1/2 z-50 flex -translate-x-1/2 items-center gap-2 rounded-full border border-border/80 bg-background/90 p-2 shadow-xl shadow-black/10 backdrop-blur-xl supports-[backdrop-filter]:bg-background/80"
      aria-label="Simulation playback controls"
    >
      <Tooltip.Root>
        <Tooltip.Trigger
          class={`playback-control inline-flex size-11 items-center justify-center rounded-full text-foreground transition-[background-color,transform,filter,box-shadow] duration-150 active:scale-95 hover:bg-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring ${keyboardPressed === 'simulation-reset' ? 'scale-95 bg-muted brightness-90 ring-2 ring-primary/30' : ''}`}
          onclick={reset}
          id="simulation-reset"
          aria-label="Reset all simulations"
        >
          <RotateCcw size={16} aria-hidden="true" />
        </Tooltip.Trigger>
        <Tooltip.Content>Reset all simulations</Tooltip.Content>
      </Tooltip.Root>

      <Tooltip.Root>
        <Tooltip.Trigger
          class={`playback-control inline-flex size-11 items-center justify-center rounded-full ${
            playing
              ? 'border border-amber-500/40 bg-amber-500/10 text-amber-600 hover:bg-amber-500/20 dark:text-amber-400'
              : 'bg-primary text-primary-foreground shadow-sm hover:bg-primary/85'
          } transition-[background-color,transform,filter,box-shadow] duration-150 active:scale-95 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring ${
            keyboardPressed === 'simulation-playback'
              ? 'scale-95 brightness-90 ring-2 ring-primary/30'
              : ''
          }`}
          onclick={togglePlayback}
          id="simulation-playback"
          aria-label={playbackLabel}
        >
          {#if playing}<Pause size={16} aria-hidden="true" />{:else}<Play
              size={16}
              aria-hidden="true"
            />{/if}
        </Tooltip.Trigger>
        <Tooltip.Content>{playbackLabel}</Tooltip.Content>
      </Tooltip.Root>

      <Tooltip.Root>
        <Tooltip.Trigger
          class={`playback-control inline-flex size-11 items-center justify-center rounded-full text-foreground transition-[background-color,transform,filter,box-shadow] duration-150 active:scale-95 hover:bg-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:pointer-events-auto disabled:cursor-not-allowed disabled:opacity-45 ${keyboardPressed === 'simulation-step' ? 'scale-95 bg-muted brightness-90 ring-2 ring-primary/30' : ''}`}
          onclick={stepAll}
          id="simulation-step"
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

      <div class="keyboard-shortcut-control mx-0.5 h-5 w-px bg-border" aria-hidden="true"></div>

      <Dialog.Root bind:open={shortcutsOpen}>
        <Tooltip.Root>
          <Tooltip.Trigger
            class={`keyboard-shortcut-control playback-control inline-flex size-11 items-center justify-center rounded-full text-muted-foreground transition-[background-color,transform,filter,box-shadow] duration-150 active:scale-95 hover:bg-muted hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring ${keyboardPressed === 'simulation-shortcuts' ? 'scale-95 bg-muted brightness-90 ring-2 ring-primary/30' : ''}`}
            onclick={() => (shortcutsOpen = true)}
            id="simulation-shortcuts"
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
