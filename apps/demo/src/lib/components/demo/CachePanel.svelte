<script lang="ts">
  import { Activity, Zap } from '@lucide/svelte';
  import * as Card from '$lib/components/ui/card';
  import * as ScrollArea from '$lib/components/ui/scroll-area';
  import type { EntryView, Snapshot } from '$lib/simulation/types';

  type Props = {
    title: string;
    subtitle: string;
    entries: EntryView[];
    bytesUsed: number;
    capacity: number;
    isCachewise?: boolean;
    snapshot?: Snapshot;
  };

  let { title, subtitle, entries, bytesUsed, capacity, isCachewise = false, snapshot }: Props = $props();

  const evictionMessage = (keys: string[], rejected: boolean): string => {
    if (rejected) return 'Admission declined; resident entries were retained.';
    return keys.length ? `Evicted ${keys.join(', ')}.` : 'No eviction required.';
  };

  let decision = $derived(snapshot
    ? evictionMessage(
        isCachewise ? snapshot.smartEvicted : snapshot.lruEvicted,
        isCachewise ? snapshot.smartRejected : snapshot.lruRejected
      )
    : 'Waiting for workload.');
</script>

<Card.Root class="flex h-full min-h-0 flex-col">
  <Card.Header>
    <Card.Title>{title}</Card.Title>
    <Card.Description>{subtitle}</Card.Description>
  </Card.Header>
  <Card.Content class="flex min-h-0 flex-1 flex-col gap-4">
    <div class="flex items-center justify-between gap-3 text-sm">
      <span class="text-muted-foreground">Memory used</span>
      <span class="shrink-0 font-medium">{bytesUsed} / {capacity} KB</span>
    </div>
    <progress class="w-full" value={Math.min(bytesUsed, capacity)} max={capacity}></progress>
    <div class="flex items-center justify-between text-xs text-muted-foreground">
      <span>RESIDENT ENTRIES</span><span>{entries.length}</span>
    </div>
    <ScrollArea.Root class="h-56 rounded-md border">
      <div class="space-y-2 p-3">
        {#each entries as entry (entry.key)}
          <div class="flex items-center justify-between gap-3 rounded-md border p-3 text-sm">
            <span class="min-w-0 truncate font-medium">{entry.key}</span>
            <span class="shrink-0 text-muted-foreground">{entry.size} KB · cost {entry.cost}</span>
          </div>
        {:else}
          <p class="py-8 text-center text-sm text-muted-foreground">Run the workload to populate the cache.</p>
        {/each}
      </div>
      <ScrollArea.Scrollbar orientation="vertical" />
    </ScrollArea.Root>
    <div class="mt-auto flex items-start gap-2 rounded-md bg-muted p-3 text-sm text-muted-foreground" aria-live="polite">
      {#if isCachewise}<Zap size={16} class="mt-0.5 shrink-0" />{:else}<Activity size={16} class="mt-0.5 shrink-0" />{/if}
      <span>{decision}</span>
    </div>
  </Card.Content>
</Card.Root>
