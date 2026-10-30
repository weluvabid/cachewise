<script lang="ts">
  import { Moon, Sun } from '@lucide/svelte';
  import { SiGithub } from '@icons-pack/svelte-simple-icons';
  import * as Tooltip from '$lib/components/ui/tooltip';

  let { darkMode, onToggleTheme }: { darkMode: boolean; onToggleTheme: () => void } = $props();
</script>

<header
  class="sticky top-4 z-40 mt-4 flex items-center justify-between rounded-full border border-black/10 bg-white/90 px-4 py-3 shadow-lg shadow-black/[0.07] backdrop-blur-xl transition-colors dark:border-white/15 dark:bg-[rgba(34,34,34,0.9)] dark:shadow-black/35 sm:px-5"
>
  <a class="rounded-sm font-semibold tracking-tight text-foreground focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring" href="/" aria-label="Cachewise home">
    cachewise
  </a>
  <nav class="flex items-center gap-1" aria-label="Site navigation">
    <Tooltip.Provider delayDuration={300}>
      <Tooltip.Root>
        <Tooltip.Trigger
          class="inline-flex size-9 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-black/[0.06] hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring dark:hover:bg-white/[0.10]"
          onclick={onToggleTheme}
          aria-label={darkMode ? 'Switch to light mode' : 'Switch to dark mode'}
        >
          {#if darkMode}<Sun size={20} aria-hidden="true" />{:else}<Moon size={20} aria-hidden="true" />{/if}
        </Tooltip.Trigger>
        <Tooltip.Content>{darkMode ? 'Switch to light mode' : 'Switch to dark mode'}</Tooltip.Content>
      </Tooltip.Root>
      <a
        class="inline-flex size-9 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-black/[0.06] hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring dark:hover:bg-white/[0.10]"
        href="https://github.com/weluvabid/cachewise"
        target="_blank"
        rel="noopener noreferrer"
        aria-label="Cachewise on GitHub (opens in a new tab)"
        title="View source on GitHub"
      >
        <SiGithub size={20} aria-hidden="true" />
      </a>
    </Tooltip.Provider>
  </nav>
</header>
