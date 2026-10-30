<script lang="ts">
  import { ArrowUpRight, Code2, Moon, Sun } from '@lucide/svelte';
  import { Button } from '$lib/components/ui/button';

  let { darkMode, onToggleTheme }: { darkMode: boolean; onToggleTheme: () => void } = $props();
</script>

<header class="flex items-center justify-between border-b py-4">
  <a class="flex items-center gap-2 font-semibold" href="/" aria-label="Cachewise home">
    <span class="flex size-6 items-end gap-0.5 rounded-md border p-1">
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
