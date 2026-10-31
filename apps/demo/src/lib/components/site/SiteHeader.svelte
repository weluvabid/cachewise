<script lang="ts">
  import { Moon, Sun } from '@lucide/svelte';
  import { SiGithub } from '@icons-pack/svelte-simple-icons';
  import * as Tooltip from '$lib/components/ui/tooltip';

  let { darkMode, onToggleTheme }: { darkMode: boolean; onToggleTheme: () => void } = $props();
</script>

<header
  class="sticky top-3 z-40 mt-3 flex items-center justify-between rounded-full border border-border/80 bg-background/90 px-4 py-2.5 shadow-lg shadow-black/10 backdrop-blur-xl supports-[backdrop-filter]:bg-background/80 transition-colors dark:shadow-black/35 sm:px-5"
>
  <a
    class="rounded-sm font-semibold tracking-tight text-foreground focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring"
    href={`${import.meta.env.BASE_URL}`}
    aria-label="Cachewise home"
  >
    <span class="flex items-center gap-2">
      <img
        src={`${import.meta.env.BASE_URL}signature.svg`}
        alt=""
        width="22"
        height="22"
        class="size-[22px] dark:invert"
      />
      cachewise
    </span>
  </a>
  <nav class="flex items-center gap-1" aria-label="Site navigation">
    <Tooltip.Provider delayDuration={300}>
      <Tooltip.Root>
        <Tooltip.Trigger
          class="inline-flex size-11 items-center justify-center rounded-full text-muted-foreground surface-transition active:scale-95 hover:bg-muted hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
          onclick={onToggleTheme}
          aria-label={darkMode ? 'Switch to light mode' : 'Switch to dark mode'}
        >
          {#if darkMode}<Sun size={20} aria-hidden="true" />{:else}<Moon
              size={20}
              aria-hidden="true"
            />{/if}
        </Tooltip.Trigger>
        <Tooltip.Content
          >{darkMode ? 'Switch to light mode' : 'Switch to dark mode'}</Tooltip.Content
        >
      </Tooltip.Root>
      <a
        class="inline-flex size-11 items-center justify-center rounded-full text-muted-foreground surface-transition active:scale-95 hover:bg-muted hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
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
