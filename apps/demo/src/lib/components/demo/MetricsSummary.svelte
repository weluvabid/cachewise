<script lang="ts">
  import * as Card from '$lib/components/ui/card';
  import { Progress } from '$lib/components/ui/progress';
  import type { RunState, ScenarioId } from '$lib/simulation/types';

  let { runs, scenarioIds }: { runs: Record<ScenarioId, RunState>; scenarioIds: ScenarioId[] } =
    $props();

  let totals = $derived.by(() => {
    const result = {
      lruHits: 0,
      smartHits: 0,
      lruMisses: 0,
      smartMisses: 0,
      lruCost: 0,
      smartCost: 0,
      completed: 0,
      total: 0,
    };

    for (const id of scenarioIds) {
      const run = runs[id];
      const snapshot = run.snapshots[run.step - 1];
      result.completed += run.step;
      result.total += run.snapshots.length;
      if (!snapshot) continue;

      result.lruHits += snapshot.lruStats.hits;
      result.smartHits += snapshot.smartStats.hits;
      result.lruMisses += snapshot.lruStats.misses;
      result.smartMisses += snapshot.smartStats.misses;
      result.lruCost += snapshot.lruComputeCost;
      result.smartCost += snapshot.smartComputeCost;
    }
    return result;
  });

  const rate = (part: number, whole: number): number => (whole ? (part / whole) * 100 : 0);
  const formatRate = (value: number): string => `${value.toFixed(1)}%`;
  let lruRequests = $derived(totals.lruHits + totals.lruMisses);
  let smartRequests = $derived(totals.smartHits + totals.smartMisses);
  let lruHitRate = $derived(rate(totals.lruHits, lruRequests));
  let smartHitRate = $derived(rate(totals.smartHits, smartRequests));
  let lruMissRate = $derived(rate(totals.lruMisses, lruRequests));
  let smartMissRate = $derived(rate(totals.smartMisses, smartRequests));
  let costReduction = $derived(
    totals.lruCost > 0 ? ((totals.lruCost - totals.smartCost) / totals.lruCost) * 100 : 0,
  );
  let progress = $derived(totals.total ? (totals.completed / totals.total) * 100 : 0);
</script>

<Card.Root class="flex h-full flex-col">
  <Card.Header class="space-y-2">
    <div class="space-y-1">
      <Card.Title>Run summary</Card.Title>
      <Card.Description>Combined results across all workloads.</Card.Description>
    </div>
    <Progress value={progress} />
  </Card.Header>

  <Card.Content class="flex flex-1 flex-col gap-4">
    <section class="space-y-3">
      <h4 class="text-sm font-semibold">Hits &amp; misses</h4>
      <div class="space-y-2">
        <div class="flex items-center justify-between gap-2 text-xs">
          <span class="font-medium">LRU</span>
          <span class="tabular-nums text-muted-foreground"
            >{formatRate(lruHitRate)} hits · {formatRate(lruMissRate)} misses</span
          >
        </div>
        <div
          class="flex h-2 w-full overflow-hidden rounded-full bg-muted"
          role="img"
          aria-label={`LRU hit rate ${formatRate(lruHitRate)}, miss rate ${formatRate(lruMissRate)}`}
        >
          <div class="h-full bg-primary" style={`width: ${lruHitRate}%`}></div>
          <div class="h-full bg-muted-foreground/40" style={`width: ${lruMissRate}%`}></div>
        </div>
      </div>
      <div class="space-y-2">
        <div class="flex items-center justify-between gap-2 text-xs">
          <span class="font-medium">Cachewise</span>
          <span class="tabular-nums text-muted-foreground"
            >{formatRate(smartHitRate)} hits · {formatRate(smartMissRate)} misses</span
          >
        </div>
        <div
          class="flex h-2 w-full overflow-hidden rounded-full bg-muted"
          role="img"
          aria-label={`Cachewise hit rate ${formatRate(smartHitRate)}, miss rate ${formatRate(smartMissRate)}`}
        >
          <div class="h-full bg-primary" style={`width: ${smartHitRate}%`}></div>
          <div class="h-full bg-muted-foreground/40" style={`width: ${smartMissRate}%`}></div>
        </div>
      </div>
    </section>

    <div class="border-t"></div>

    <section class="space-y-2">
      <h4 class="text-sm font-semibold">Recompute cost</h4>
      <div class="flex items-center justify-between gap-3 text-sm">
        <span class="text-muted-foreground">LRU</span>
        <span class="font-mono font-semibold tabular-nums">{totals.lruCost.toLocaleString()}</span>
      </div>
      <div class="flex items-center justify-between gap-3 text-sm">
        <span class="text-muted-foreground">Cachewise</span>
        <span class="font-mono font-semibold tabular-nums">{totals.smartCost.toLocaleString()}</span
        >
      </div>
      <div class="flex items-center justify-between gap-3 border-t pt-2 text-sm">
        <span class="text-muted-foreground">Cost reduction</span>
        <span class="font-mono font-semibold tabular-nums">{formatRate(costReduction)}</span>
      </div>
    </section>
  </Card.Content>
</Card.Root>
