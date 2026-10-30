<script lang="ts">
  import { Moon, Sun } from '@lucide/svelte';
  import { SiGithub } from '@icons-pack/svelte-simple-icons';
  import { Button } from '$lib/components/ui/button';

  let { darkMode, onToggleTheme }: { darkMode: boolean; onToggleTheme: () => void } = $props();
</script>

<header
  class="sticky top-4 z-40 mt-4 flex items-center justify-between rounded-full border border-black/10 bg-white/85 px-4 py-3 shadow-lg shadow-black/[0.06] backdrop-blur-xl dark:border-white/[0.12] dark:bg-[rgba(28,28,28,0.82)] dark:shadow-black/30 sm:px-5"
>
  <a class="flex items-center gap-2 font-semibold" href="/" aria-label="Cachewise home">
    cachewise
  </a>
  <div class="flex items-center gap-2">
    <Button
      variant="ghost"
      size="icon"
      onclick={onToggleTheme}
      aria-label={darkMode ? 'Switch to light mode' : 'Switch to dark mode'}
    >
      {#if darkMode}<Sun size={20} />{:else}<Moon size={20} />{/if}
    </Button>
    <a
      class="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      href="https://github.com/weluvabid/cachewise"
      target="_blank"
      rel="noreferrer"
    >
      <SiGithub size={20} />
    </a>
  </div>
</header>
