<script lang="ts">
  import { ArrowUpRight, Code2, Moon, Sun } from '@lucide/svelte';
  import { Button } from '$lib/components/ui/button';

  let { darkMode, onToggleTheme }: { darkMode: boolean; onToggleTheme: () => void } = $props();
</script>

<header class="sticky top-4 z-40 mt-4 flex items-center justify-between rounded-full border border-black/10 bg-white/85 px-4 py-3 shadow-lg shadow-black/[0.06] backdrop-blur-xl dark:border-white/[0.12] dark:bg-[rgba(28,28,28,0.82)] dark:shadow-black/30 sm:px-5">
  <a class="flex items-center gap-2 font-semibold" href="/" aria-label="Cachewise home">
    <span class="flex size-7 items-end gap-0.5 rounded-md border p-1">
      <span class="h-2 w-0.5 bg-foreground"></span>
      <span class="h-3 w-0.5 bg-foreground"></span>
      <span class="h-2.5 w-0.5 bg-primary"></span>
    </span>
    cachewise
  </a>
  <div class="flex items-center gap-2">
    <Button variant="outline" size="icon" onclick={onToggleTheme} aria-label={darkMode ? 'Switch to light mode' : 'Switch to dark mode'}>
      {#if darkMode}<Sun size={16}/>{:else}<Moon size={16}/>{/if}
    </Button>
    <a class="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground" href="https://github.com/weluvabid/cachewise" target="_blank" rel="noreferrer">
      <Code2 size={16}/> Source <ArrowUpRight size={13}/>
    </a>
  </div>
</header>
